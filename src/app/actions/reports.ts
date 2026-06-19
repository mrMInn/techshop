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
import { eq, and, sql, or } from "drizzle-orm";

// 1. Lấy Báo cáo Kết quả Kinh doanh (P&L - Profit & Loss)
export async function getIncomeStatementReport(startDate: string, endDate: string) {
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
          sql`DATE(${orders.createdAt}) >= ${startDate}`,
          sql`DATE(${orders.createdAt}) <= ${endDate}`
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
          sql`DATE(${warrantyClaims.createdAt}) >= ${startDate}`,
          sql`DATE(${warrantyClaims.createdAt}) <= ${endDate}`
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
          sql`DATE(${returns.createdAt}) >= ${startDate}`,
          sql`DATE(${returns.createdAt}) <= ${endDate}`
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
          sql`DATE(${expenses.expenseDate}) >= ${startDate}`,
          sql`DATE(${expenses.expenseDate}) <= ${endDate}`
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

    return {
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
export async function getCashFlowStatementReport(startDate: string, endDate: string) {
  try {
    const entries = await db
      .select()
      .from(cashBookEntries)
      .where(
        and(
          sql`DATE(${cashBookEntries.entryDate}) >= ${startDate}`,
          sql`DATE(${cashBookEntries.entryDate}) <= ${endDate}`
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

    return {
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
