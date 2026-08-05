"use server";

import { db } from "@/lib/db";
import { 
  orders, 
  expenses, 
  expenseCategories,
  warrantyClaims, 
  returns, 
  cashBookEntries 
} from "@/lib/db/schema";
import { eq, and, sql, or, gte, lte, lt } from "drizzle-orm";
import { serverCache } from "@/lib/cache";

type IncomeStatementReport = {
  salesRevenue: number;
  costOfGoodsSold: number;
  salesGrossMargin: number;
  warrantyIncome: number;
  salesRefunds: number;
  netRevenue: number;
  expenseBreakdown: { categoryName: string; amount: number }[];
  totalOperatingExpenses: number;
  netProfit: number;
};

type CashFlowStatementReport = {
  operatingInflow: number;
  operatingOutflow: number;
  netOperatingCashFlow: number;
  investingOutflow: number;
  netInvestingCashFlow: number;
  netCashFlow: number;
  categoryBreakdown: { category: string; income: number; expense: number }[];
};
// 1. Lấy Báo cáo Kết quả Kinh doanh (P&L - Profit & Loss)
export async function getIncomeStatementReport(startDate: string, endDate: string): Promise<IncomeStatementReport> {
  const cacheKey = `income_statement_${startDate}_${endDate}`;
  const cached = serverCache.get<IncomeStatementReport>(cacheKey);
  if (cached) {
    console.log(`CACHE HIT: getIncomeStatementReport (${startDate} - ${endDate})`);
    return cached;
  }
  try {
    // A. Doanh thu bán lẻ từ Đơn hàng hoàn thành
    const salesStats = await db
      .select({
        revenue: sql<string>`sum(${orders.totalAmount})`,
        cogs: sql<string>`sum(${orders.totalCost})`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, "completed"),
          gte(orders.createdAt, sql`${startDate}::timestamp`),
          lt(orders.createdAt, sql`(${endDate}::date + 1)::timestamp`)
        )
      );

    const salesRevenue = Number(salesStats[0]?.revenue || 0);
    const costOfGoodsSold = Number(salesStats[0]?.cogs || 0);
    const salesGrossMargin = salesRevenue - costOfGoodsSold;

    // B. Doanh thu bảo hành sửa chữa dịch vụ
    const warrantyStats = await db
      .select({
        warrantyRevenue: sql<string>`sum(${warrantyClaims.repairCost})`,
      })
      .from(warrantyClaims)
      .where(
        and(
          gte(warrantyClaims.createdAt, sql`${startDate}::timestamp`),
          lt(warrantyClaims.createdAt, sql`(${endDate}::date + 1)::timestamp`)
        )
      );
    const warrantyIncome = Number(warrantyStats[0]?.warrantyRevenue || 0);

    // C. Khoản giảm trừ doanh thu (Đổi trả hoàn tiền)
    const returnsStats = await db
      .select({
        refunds: sql<string>`sum(${returns.refundAmount})`,
      })
      .from(returns)
      .where(
        and(
          eq(returns.status, "completed"),
          gte(returns.createdAt, sql`${startDate}::timestamp`),
          lt(returns.createdAt, sql`(${endDate}::date + 1)::timestamp`)
        )
      );
    const salesRefunds = Number(returnsStats[0]?.refunds || 0);

    // D. Chi phí vận hành phân loại chi tiết theo danh mục
    const dbExpenses = await db
      .select({
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        total: sql<string>`sum(${expenses.amount})`,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        and(
          gte(expenses.expenseDate, startDate),
          lte(expenses.expenseDate, endDate)
        )
      )
      .groupBy(expenses.categoryId, expenseCategories.name);

    let totalOperatingExpenses = 0;
    const expenseBreakdown = dbExpenses.map((exp) => {
      const amt = Number(exp.total || 0);
      totalOperatingExpenses += amt;
      return {
        categoryName: exp.categoryName,
        amount: amt,
      };
    });

    // E. Tổng hợp lợi nhuận
    const netRevenue = salesRevenue + warrantyIncome - salesRefunds;
    const netProfit = netRevenue - costOfGoodsSold - totalOperatingExpenses;

    const result = {
      salesRevenue,
      costOfGoodsSold,
      salesGrossMargin,
      warrantyIncome,
      salesRefunds,
      netRevenue,
      expenseBreakdown,
      totalOperatingExpenses,
      netProfit,
    };
    serverCache.set(cacheKey, result, 120); // Cache for 2 minutes
    return result;
  } catch (error) {
    console.error("Lỗi lấy báo cáo P&L:", error);
    return {
      salesRevenue: 0,
      costOfGoodsSold: 0,
      salesGrossMargin: 0,
      warrantyIncome: 0,
      salesRefunds: 0,
      netRevenue: 0,
      expenseBreakdown: [],
      totalOperatingExpenses: 0,
      netProfit: 0,
    };
  }
}

// 2. Lấy Báo cáo Lưu chuyển Tiền tệ (Cash Flow Statement)
export async function getCashFlowStatementReport(startDate: string, endDate: string): Promise<CashFlowStatementReport> {
  const cacheKey = `cashflow_statement_${startDate}_${endDate}`;
  const cached = serverCache.get<CashFlowStatementReport>(cacheKey);
  if (cached) {
    console.log(`CACHE HIT: getCashFlowStatementReport (${startDate} - ${endDate})`);
    return cached;
  }
  try {
    const entries = await db
      .select()
      .from(cashBookEntries)
      .where(
        and(
          gte(cashBookEntries.entryDate, startDate),
          lte(cashBookEntries.entryDate, endDate)
        )
      );

    let operatingInflow = 0;  // Dòng tiền vào từ kinh doanh
    let operatingOutflow = 0; // Dòng tiền ra cho kinh doanh
    let investingOutflow = 0; // Dòng tiền ra cho đầu tư (Ví dụ chi phí tài sản cố định mua máy)
    
    const categoryStats: Record<string, { income: number; expense: number }> = {};

    entries.forEach((entry) => {
      const amt = Number(entry.amount || 0);
      const cat = entry.category;

      if (!categoryStats[cat]) {
        categoryStats[cat] = { income: 0, expense: 0 };
      }

      if (entry.type === "income") {
        operatingInflow += amt;
        categoryStats[cat].income += amt;
      } else {
        // Ánh xạ chi phí mua tài sản cố định/linh kiện nâng cấp vào dòng tiền đầu tư nếu thuộc 'other' chi tiết
        if (entry.description.toLowerCase().includes("thiết bị") || entry.description.toLowerCase().includes("tài sản")) {
          investingOutflow += amt;
        } else {
          operatingOutflow += amt;
        }
        categoryStats[cat].expense += amt;
      }
    });

    const netOperatingCashFlow = operatingInflow - operatingOutflow;
    const netInvestingCashFlow = -investingOutflow;
    const netCashFlow = netOperatingCashFlow + netInvestingCashFlow;

    const result = {
      operatingInflow,
      operatingOutflow,
      netOperatingCashFlow,
      investingOutflow,
      netInvestingCashFlow,
      netCashFlow,
      categoryBreakdown: Object.keys(categoryStats).map((key) => ({
        category: key,
        income: categoryStats[key].income,
        expense: categoryStats[key].expense,
      })),
    };
    serverCache.set(cacheKey, result, 120); // Cache for 2 minutes
    return result;
  } catch (error) {
    console.error("Lỗi lấy báo cáo dòng tiền:", error);
    return {
      operatingInflow: 0,
      operatingOutflow: 0,
      netOperatingCashFlow: 0,
      investingOutflow: 0,
      netInvestingCashFlow: 0,
      netCashFlow: 0,
      categoryBreakdown: [],
    };
  }
}
