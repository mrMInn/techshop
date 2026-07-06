"use server";

import { db, recalculateRunningBalances } from "@/lib/db";
import { after } from "next/server";

import { 
  cashBookEntries, 
  expenses, 
  expenseCategories, 
  incomeCategories,
  profiles,
  payments,
  orders,
  warrantyClaims,
  returns,
  inventoryItems,
  customers,
  products,
  accountingPeriods,
  quotations,
  purchaseOrders,
  accessoryItems
} from "@/lib/db/schema";
import { eq, desc, and, sql, or, like, gte } from "drizzle-orm";
import { sendTelegramNotification } from "@/lib/telegram/notifier";
async function requireOwner() {
  // Bỏ qua kiểm tra quyền khi chạy ở chế độ không đăng nhập
  return;
}


// Helper function: Chuẩn hóa mọi định dạng ngày (như ddmmyyyy, dd/mm/yyyy, dd-mm-yyyy) về YYYY-MM-DD
function parseDateStringToYYYYMMDD(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  
  if (dateStr instanceof Date) {
    return dateStr.toISOString().split("T")[0];
  }

  const cleanStr = String(dateStr).trim();
  
  // Định dạng 1: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    return cleanStr;
  }
  
  // Định dạng 2: DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanStr)) {
    const [d, m, y] = cleanStr.split("/");
    return `${y}-${m}-${d}`;
  }
  
  // Định dạng 3: DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleanStr)) {
    const [d, m, y] = cleanStr.split("-");
    return `${y}-${m}-${d}`;
  }
  
  // Định dạng 4: DDMMYYYY (ddmmyyyy)
  if (/^\d{8}$/.test(cleanStr)) {
    const d = cleanStr.slice(0, 2);
    const m = cleanStr.slice(2, 4);
    const y = cleanStr.slice(4, 8);
    return `${y}-${m}-${d}`;
  }
  
  // Dự phòng: parse standard Date
  try {
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  } catch (e) {}
  
  return cleanStr;
}


// 1.5 Tự động đối chiếu và đồng bộ ngược dữ liệu lịch sử chưa được ghi nhận trong sổ quỹ
// 1.5 Tự động đối chiếu và đồng bộ ngược dữ liệu lịch sử chưa được ghi nhận trong sổ quỹ
export async function syncHistoricalData() {
  try {
    let needRecalc = false;

    // A. Quét toàn bộ lịch sử thanh toán đơn hàng thành công chưa có sổ quỹ
    const dbPayments = await db
      .select({
        paymentId: payments.id,
        orderId: payments.orderId,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paymentDate: payments.paymentDate,
        notes: payments.notes,
        createdBy: payments.createdBy,
        orderNumber: orders.orderNumber,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .leftJoin(
        cashBookEntries,
        and(
          eq(cashBookEntries.referenceType, "order"),
          eq(cashBookEntries.referenceId, payments.orderId),
          eq(cashBookEntries.amount, payments.amount)
        )
      )
      .where(
        and(
          eq(orders.status, "completed"),
          sql`${cashBookEntries.id} IS NULL`
        )
      );

    for (const pay of dbPayments) {
      // Đồng bộ ngược vào sổ quỹ
      const dateStr = new Date(pay.paymentDate).toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const entryNumber = `CB${dateStr}-${randomSuffix}`;
      
      const cashBookPaymentMethod = 
        pay.paymentMethod === "bank_transfer" || pay.paymentMethod === "card" || pay.paymentMethod === "vnpay" || pay.paymentMethod === "momo"
          ? "bank_transfer" 
          : "cash";

      await db.insert(cashBookEntries).values({
        entryNumber,
        type: "income",
        category: "sales",
        amount: pay.amount,
        runningBalance: "0",
        paymentMethod: cashBookPaymentMethod,
        referenceType: "order",
        referenceId: pay.orderId,
        description: `[Đồng bộ] Thu tiền thanh toán đơn hàng ${pay.orderNumber} - ${pay.notes || ""}`,
        entryDate: new Date(pay.paymentDate).toISOString().split("T")[0],
        createdBy: pay.createdBy,
      });
      
      needRecalc = true;
    }

    // B. Quét toàn bộ phí sửa chữa bảo hành thành công chưa có sổ quỹ
    const dbClaims = await db
      .select({
        id: warrantyClaims.id,
        claimNumber: warrantyClaims.claimNumber,
        receivedDate: warrantyClaims.receivedDate,
        actualReturnDate: warrantyClaims.actualReturnDate,
        repairCost: warrantyClaims.repairCost,
        createdBy: warrantyClaims.createdBy,
      })
      .from(warrantyClaims)
      .leftJoin(
        cashBookEntries,
        and(
          eq(cashBookEntries.referenceType, "other"),
          eq(cashBookEntries.referenceId, warrantyClaims.id),
          eq(cashBookEntries.type, "income")
        )
      )
      .where(
        and(
          sql`${warrantyClaims.repairCost} IS NOT NULL`,
          sql`CAST(${warrantyClaims.repairCost} AS DECIMAL) > 0`,
          sql`${cashBookEntries.id} IS NULL`
        )
      );

    for (const claim of dbClaims) {
      const dateStr = new Date(claim.receivedDate).toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const entryNumber = `CB${dateStr}-${randomSuffix}`;

      await db.insert(cashBookEntries).values({
        entryNumber,
        type: "income",
        category: "warranty_repair",
        amount: claim.repairCost!,
        runningBalance: "0",
        paymentMethod: "cash",
        referenceType: "other",
        referenceId: claim.id,
        description: `[Đồng bộ] Thu phí sửa chữa bảo hành - Phiếu: ${claim.claimNumber}`,
        entryDate: claim.actualReturnDate || claim.receivedDate,
        createdBy: claim.createdBy,
      });

      needRecalc = true;
    }

    // C. Quét toàn bộ phiếu Đổi/Trả thành công chưa có sổ quỹ
    // C.1. Thu phí dịch vụ đổi trả (nếu có và chưa có dòng THU QUỸ)
    const missingIncomeReturns = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        createdAt: returns.createdAt,
        feeAmount: returns.feeAmount,
        hasFee: returns.hasFee,
        processedBy: returns.processedBy,
        orderId: returns.orderId,
        paymentMethod: orders.paymentMethod,
      })
      .from(returns)
      .innerJoin(orders, eq(returns.orderId, orders.id))
      .leftJoin(
        cashBookEntries,
        and(
          eq(cashBookEntries.referenceType, "other"),
          eq(cashBookEntries.referenceId, returns.id),
          eq(cashBookEntries.type, "income")
        )
      )
      .where(
        and(
          eq(returns.status, "completed"),
          eq(returns.hasFee, true),
          sql`CAST(${returns.feeAmount} AS DECIMAL) > 0`,
          sql`${cashBookEntries.id} IS NULL`
        )
      );

    for (const ret of missingIncomeReturns) {
      const feeVal = Number(ret.feeAmount || 0);
      const mappedMethod = ret.paymentMethod || 'cash';
      const cashBookPaymentMethod = 
        mappedMethod === "bank_transfer" || mappedMethod === "card" 
          ? mappedMethod 
          : "cash";

      const dateStrCB = new Date(ret.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffixCB1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const entryNumber1 = `CB${dateStrCB}-${randomSuffixCB1}`;

      await db.insert(cashBookEntries).values({
        entryNumber: entryNumber1,
        type: "income",
        category: "other",
        amount: feeVal.toString(),
        runningBalance: "0",
        paymentMethod: cashBookPaymentMethod,
        referenceType: "other",
        referenceId: ret.id,
        description: `[Đồng bộ] Thu phí dịch vụ đổi trả (máy không lỗi) - Phiếu: ${ret.returnNumber}`,
        entryDate: new Date(ret.createdAt).toISOString().split("T")[0],
        createdBy: ret.processedBy,
      });
      
      needRecalc = true;
    }

    // C.2. Chi hoàn tiền cho khách (nếu chưa có dòng CHI QUỸ)
    const missingExpenseReturns = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        createdAt: returns.createdAt,
        feeAmount: returns.feeAmount,
        refundAmount: returns.refundAmount,
        processedBy: returns.processedBy,
        orderId: returns.orderId,
        paymentMethod: orders.paymentMethod,
      })
      .from(returns)
      .innerJoin(orders, eq(returns.orderId, orders.id))
      .leftJoin(
        cashBookEntries,
        and(
          eq(cashBookEntries.referenceType, "other"),
          eq(cashBookEntries.referenceId, returns.id),
          eq(cashBookEntries.type, "expense")
        )
      )
      .where(
        and(
          eq(returns.status, "completed"),
          sql`(CAST(${returns.refundAmount} AS DECIMAL) + CAST(${returns.feeAmount} AS DECIMAL)) > 0`,
          sql`${cashBookEntries.id} IS NULL`
        )
      );

    for (const ret of missingExpenseReturns) {
      const refundVal = Number(ret.refundAmount || 0);
      const feeVal = Number(ret.feeAmount || 0);
      const totalOriginalPrice = refundVal + feeVal;

      const mappedMethod = ret.paymentMethod || 'cash';
      const cashBookPaymentMethod = 
        mappedMethod === "bank_transfer" || mappedMethod === "card" 
          ? mappedMethod 
          : "cash";

      const dateStrCB = new Date(ret.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffixCB2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const entryNumber2 = `CB${dateStrCB}-${randomSuffixCB2}`;

      await db.insert(cashBookEntries).values({
        entryNumber: entryNumber2,
        type: "expense",
        category: "other",
        amount: totalOriginalPrice.toString(),
        runningBalance: "0",
        paymentMethod: cashBookPaymentMethod,
        referenceType: "other",
        referenceId: ret.id,
        description: `[Đồng bộ] Chi hoàn giá trị sản phẩm từ phiếu Đổi/Trả ${ret.returnNumber}`,
        entryDate: new Date(ret.createdAt).toISOString().split("T")[0],
        createdBy: ret.processedBy,
      });

      needRecalc = true;
    }

    // D. Quét toàn bộ đơn nhập hàng (purchase_orders) thành công chưa có sổ quỹ
    const dbPos = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        totalCost: purchaseOrders.totalCost,
        actualArrival: purchaseOrders.actualArrival,
        createdBy: purchaseOrders.createdBy,
        createdAt: purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .leftJoin(
        cashBookEntries,
        and(
          eq(cashBookEntries.referenceType, "purchase_order"),
          eq(cashBookEntries.referenceId, purchaseOrders.id)
        )
      )
      .where(
        and(
          or(
            eq(purchaseOrders.status, "received"),
            eq(purchaseOrders.status, "partially_received"),
            eq(purchaseOrders.status, "warranty_supplier"),
            eq(purchaseOrders.status, "returned_supplier")
          ),
          sql`${cashBookEntries.id} IS NULL`
        )
      );

    for (const po of dbPos) {
      const dateStr = new Date(po.actualArrival || po.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const entryNumber = `CB${dateStr}-${randomSuffix}`;

      await db.insert(cashBookEntries).values({
        entryNumber,
        type: "expense",
        category: "purchase",
        amount: po.totalCost,
        runningBalance: "0",
        paymentMethod: "bank_transfer",
        referenceType: "purchase_order",
        referenceId: po.id,
        description: `[Đồng bộ] Thanh toán đơn nhập hàng ${po.poNumber}`,
        entryDate: po.actualArrival || new Date(po.createdAt).toISOString().split("T")[0],
        createdBy: po.createdBy,
      });

      needRecalc = true;
    }

    // E. Quét các lô nhập phụ kiện trực tiếp (không qua PO/nhà cung cấp) chưa có sổ quỹ
    const accessoryBatches = await db
      .select({
        batchCode: accessoryItems.batchCode,
        createdAt: sql<string>`min(cast(${accessoryItems.createdAt} as text))`,
        totalCost: sql<string>`sum(${accessoryItems.unitCost})`,
        notes: sql<string>`min(${accessoryItems.notes})`,
      })
      .from(accessoryItems)
      .where(sql`${accessoryItems.purchaseOrderId} IS NULL`)
      .groupBy(accessoryItems.batchCode);

    for (const batch of accessoryBatches) {
      if (!batch.batchCode) continue;
      const totalCostNum = Number(batch.totalCost || 0);
      if (totalCostNum <= 0) continue;

      // Kiểm tra xem đã có dòng chi tương ứng cho lô này chưa
      const existingEntry = await db
        .select()
        .from(cashBookEntries)
        .where(
          and(
            eq(cashBookEntries.type, "expense"),
            sql`${cashBookEntries.description} LIKE ${`%${batch.batchCode}%`}`
          )
        )
        .limit(1);

      if (existingEntry.length === 0) {
        const dateStr = new Date(batch.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const entryNumber = `CB${dateStr}-${randomSuffix}`;

        await db.insert(cashBookEntries).values({
          entryNumber,
          type: "expense",
          category: "purchase",
          amount: totalCostNum.toFixed(2),
          runningBalance: "0",
          paymentMethod: "bank_transfer",
          referenceType: null,
          referenceId: null,
          description: `[Đồng bộ] Chi tiền nhập kho phụ kiện trực tiếp (Lô ${batch.batchCode})`,
          entryDate: new Date(batch.createdAt).toISOString().split("T")[0],
          createdBy: null,
        });

        needRecalc = true;
      }
    }

    // Nếu có dữ liệu mới phát sinh, thực hiện tính toán lại số dư lũy kế
    if (needRecalc) {
      await recalculateRunningBalances(db);
    }
  } catch (error) {
    console.error("Lỗi đồng bộ ngược dữ liệu lịch sử tài chính:", error);
  }
}

// 1.8. Action chạy đồng bộ lịch sử độc lập
export async function syncHistoricalAccountingDataAction() {
  await requireOwner();
  await syncHistoricalData();
  return { success: true };
}

// 2. Lấy tóm tắt tài chính (Tổng thu, chi, lãi/lỗ và thống kê biểu đồ)
export async function getFinancialSummary() {
  console.log("SERVER: getFinancialSummary called");
  await requireOwner();
  try {
    const totals = await db
      .select({
        type: cashBookEntries.type,
        sum: sql<string>`sum(${cashBookEntries.amount})`
      })
      .from(cashBookEntries)
      .groupBy(cashBookEntries.type);

    let totalIncome = 0;
    let totalExpense = 0;
    totals.forEach((t) => {
      if (t.type === 'income') totalIncome = Number(t.sum || 0);
      else if (t.type === 'expense') totalExpense = Number(t.sum || 0);
    });

    const catStats = await db
      .select({
        category: cashBookEntries.category,
        type: cashBookEntries.type,
        sum: sql<string>`sum(${cashBookEntries.amount})`
      })
      .from(cashBookEntries)
      .groupBy(cashBookEntries.category, cashBookEntries.type);

    const categoryStats: Record<string, number> = {};
    catStats.forEach((c) => {
      const cat = c.category || "other";
      const amt = Number(c.sum || 0);
      if (c.type === 'income') {
        categoryStats[cat] = (categoryStats[cat] || 0) + amt;
      } else {
        categoryStats[cat] = (categoryStats[cat] || 0) - amt;
      }
    });

    const ordersStats = await db
      .select({
        totalProfit: sql<string>`sum(${orders.profit})`
      })
      .from(orders)
      .where(eq(orders.status, "completed"));
    const warrantyStats = await db
      .select({
        totalWarrantyCost: sql<string>`sum(${warrantyClaims.repairCost})`
      })
      .from(warrantyClaims);
    const expensesStats = await db
      .select({
        totalExpense: sql<string>`sum(${expenses.amount})`
      })
      .from(expenses);
    const returnsStats = await db
      .select({
        totalRefund: sql<string>`sum(${returns.refundAmount})`,
        totalFee: sql<string>`sum(${returns.feeAmount})`
      })
      .from(returns)
      .where(eq(returns.status, "completed"));

    // Lọc lấy 7 ngày gần nhất cho biểu đồ hàng ngày
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const daysData = await db
      .select({
        date: cashBookEntries.entryDate,
        type: cashBookEntries.type,
        totalAmount: sql<string>`sum(${cashBookEntries.amount})`,
      })
      .from(cashBookEntries)
      .where(gte(cashBookEntries.entryDate, sevenDaysAgoStr))
      .groupBy(cashBookEntries.entryDate, cashBookEntries.type)
      .orderBy(cashBookEntries.entryDate);

    // Tính toán lợi nhuận kinh doanh ròng thực tế (Lợi nhuận gộp đơn hàng + Doanh thu bảo hành - Chi vận hành - Hoàn tiền khách trả)
    const salesProfit = Number(ordersStats[0]?.totalProfit || 0);
    const warrantyIncome = Number(warrantyStats[0]?.totalWarrantyCost || 0);
    const operationalExpenses = Number(expensesStats[0]?.totalExpense || 0);
    const returnsRefund = Number(returnsStats[0]?.totalRefund || 0);
    const returnServiceFees = Number(returnsStats[0]?.totalFee || 0);

    const netProfit = salesProfit + warrantyIncome + returnServiceFees - operationalExpenses - returnsRefund;

    // Chuẩn hóa dữ liệu biểu đồ hàng ngày
    const chartMap: Record<string, { date: string; fullDate: string; thu: number; chi: number; loiNhuan: number }> = {};
    
    // Khởi tạo 7 ngày gần nhất nếu chưa có dữ liệu để biểu đồ trông mượt mà hơn
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const formattedDate = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
      chartMap[dateStr] = { date: formattedDate, fullDate: dateStr, thu: 0, chi: 0, loiNhuan: 0 };
    }

    daysData.forEach((item) => {
      const dateStr = item.date;
      const amt = Number(item.totalAmount || 0);
      
      const formattedDate = new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
      
      if (!chartMap[dateStr]) {
        chartMap[dateStr] = { date: formattedDate, fullDate: dateStr, thu: 0, chi: 0, loiNhuan: 0 };
      }
      
      if (item.type === "income") {
        chartMap[dateStr].thu += amt;
      } else {
        chartMap[dateStr].chi += amt;
      }
      chartMap[dateStr].loiNhuan = chartMap[dateStr].thu - chartMap[dateStr].chi;
    });

    const chartData = Object.keys(chartMap)
      .sort()
      .map((key) => chartMap[key]);

    // --- Tính toán biểu đồ hàng tháng (12 tháng gần nhất - 1 năm) ---
    const monthlyMap: Record<string, { date: string; thu: number; chi: number; loiNhuan: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const formattedMonth = `Thg ${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
      monthlyMap[yearMonth] = { date: formattedMonth, thu: 0, chi: 0, loiNhuan: 0 };
    }

    // Lọc 12 tháng gần nhất từ database bằng SQL aggregation
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1); // Ngày đầu tiên của tháng đó
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split("T")[0];

    const monthlyData = await db
      .select({
        month: sql<string>`to_char(${cashBookEntries.entryDate}, 'YYYY-MM')`,
        type: cashBookEntries.type,
        sum: sql<string>`sum(${cashBookEntries.amount})`
      })
      .from(cashBookEntries)
      .where(gte(cashBookEntries.entryDate, twelveMonthsAgoStr))
      .groupBy(sql`to_char(${cashBookEntries.entryDate}, 'YYYY-MM')`, cashBookEntries.type);

    monthlyData.forEach((m) => {
      if (!m.month) return;
      const amt = Number(m.sum || 0);
      const yearMonth = m.month;
      if (monthlyMap[yearMonth]) {
        if (m.type === "income") {
          monthlyMap[yearMonth].thu += amt;
        } else {
          monthlyMap[yearMonth].chi += amt;
        }
        monthlyMap[yearMonth].loiNhuan = monthlyMap[yearMonth].thu - monthlyMap[yearMonth].chi;
      }
    });

    const monthlyChartData = Object.keys(monthlyMap)
      .sort()
      .map((key) => monthlyMap[key]);

    return {
      totalIncome,
      totalExpense,
      netProfit,
      categoryStats,
      chartData,
      monthlyChartData,
    };
  } catch (error) {
    console.error("Lỗi lấy tóm tắt tài chính:", error);
    return {
      totalIncome: 0,
      totalExpense: 0,
      netProfit: 0,
      categoryStats: {},
      chartData: [],
      monthlyChartData: [],
    };
  }
}

// 3. Lấy danh sách nhật ký Sổ quỹ Thu/Chi
export async function getCashBookEntries(filters?: {
  type?: "income" | "expense";
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  await requireOwner();
  try {
    let query = db.select({
      id: cashBookEntries.id,
      entryNumber: cashBookEntries.entryNumber,
      type: cashBookEntries.type,
      category: cashBookEntries.category,
      amount: cashBookEntries.amount,
      runningBalance: cashBookEntries.runningBalance,
      paymentMethod: cashBookEntries.paymentMethod,
      referenceType: cashBookEntries.referenceType,
      referenceId: cashBookEntries.referenceId,
      description: cashBookEntries.description,
      entryDate: cashBookEntries.entryDate,
      createdBy: cashBookEntries.createdBy,
      createdAt: cashBookEntries.createdAt,
      incomeCategoryId: cashBookEntries.incomeCategoryId,
      incomeCategoryName: incomeCategories.name,
    })
    .from(cashBookEntries)
    .leftJoin(incomeCategories, eq(cashBookEntries.incomeCategoryId, incomeCategories.id));

    const conditions = [];

    if (filters?.type) {
      conditions.push(eq(cashBookEntries.type, filters.type));
    }
    if (filters?.category && filters.category !== "all") {
      conditions.push(
        or(
          eq(cashBookEntries.category, filters.category as any),
          eq(cashBookEntries.incomeCategoryId, filters.category)
        )
      );
    }
    if (filters?.search) {
      conditions.push(
        or(
          like(cashBookEntries.entryNumber, `%${filters.search}%`),
          like(cashBookEntries.description, `%${filters.search}%`)
        )
      );
    }
    if (filters?.startDate) {
      conditions.push(sql`DATE(${cashBookEntries.entryDate}) >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`DATE(${cashBookEntries.entryDate}) <= ${filters.endDate}`);
    }

    const list = await (conditions.length > 0
      ? query.where(and(...conditions))
      : query
    ).orderBy(desc(cashBookEntries.createdAt));

    return list;
  } catch (error) {
    console.error("Lỗi lấy nhật ký sổ quỹ:", error);
    return [];
  }
}

// 4. Lấy danh sách Chi phí vận hành thực tế
export async function getExpenses() {
  await requireOwner();
  try {
    const list = await db
      .select({
        id: expenses.id,
        expenseNumber: expenses.expenseNumber,
        categoryId: expenses.categoryId,
        amount: expenses.amount,
        description: expenses.description,
        expenseDate: expenses.expenseDate,
        paymentMethod: expenses.paymentMethod,
        categoryName: expenseCategories.name,
        createdByName: profiles.fullName,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(profiles, eq(expenses.createdBy, profiles.id))
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));

    return list;
  } catch (error) {
    console.error("Lỗi lấy danh sách chi phí:", error);
    return [];
  }
}

// 4.5. Lấy chi tiết một chi phí
export async function getExpenseById(id: string) {
  await requireOwner();
  try {
    const list = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1);
    return list[0] || null;
  } catch (error) {
    console.error("Lỗi lấy chi tiết chi phí:", error);
    return null;
  }
}

// 5. Lấy danh sách danh mục Chi phí
export async function getExpenseCategories() {
  await requireOwner();
  try {
    return await db.select().from(expenseCategories).orderBy(expenseCategories.name);
  } catch (error) {
    console.error("Lỗi lấy danh mục chi phí:", error);
    return [];
  }
}

// 6. Ghi nhận Chi phí mới và hạch toán Sổ quỹ
export async function createExpense(data: {
  categoryId: string;
  amount: string;
  description: string;
  expenseDate: string;
  paymentMethod: "cash" | "bank_transfer" | "card";
}) {
  await requireOwner();
  try {
    const result = await db.transaction(async (tx) => {
      // 0. Chuẩn hóa ngày nhập liệu (chấp nhận ddmmyyyy, dd/mm/yyyy, dd-mm-yyyy)
      const sanitizedDate = parseDateStringToYYYYMMDD(data.expenseDate);
      const periodName = sanitizedDate.slice(0, 7);
      
      const closedPeriod = await tx
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.period, periodName),
            eq(accountingPeriods.isClosed, true)
          )
        )
        .limit(1);
      if (closedPeriod.length > 0) {
        throw new Error(`Kỳ kế toán tháng ${periodName} đã chốt sổ, không thể ghi nhận chi phí!`);
      }

      // 1. Lấy thông tin nhân viên ghi nhận
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const createdById = ownerProfiles[0]?.id;
      if (!createdById) throw new Error("Chưa cấu hình tài khoản nhân viên");

      // 2. Tạo mã chi phí duy nhất
      const dateStr = sanitizedDate.replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const expenseNumber = `EXP-${dateStr}-${randomSuffix}`;

      // 3. Lấy tên danh mục chi phí để phân loại sổ quỹ
      const category = await tx
        .select()
        .from(expenseCategories)
        .where(eq(expenseCategories.id, data.categoryId))
        .limit(1);
      
      if (!category.length) throw new Error("Danh mục chi phí không hợp lệ");
      const categoryName = category[0].name.toLowerCase();

      // Ánh xạ danh mục chi phí sang danh mục Sổ quỹ
      let cashBookCategory: "salary" | "rent" | "utility" | "shipping" | "tax" | "other" = "other";
      if (categoryName.includes("lương") || categoryName.includes("salary")) {
        cashBookCategory = "salary";
      } else if (categoryName.includes("mặt bằng") || categoryName.includes("thuê") || categoryName.includes("rent")) {
        cashBookCategory = "rent";
      } else if (categoryName.includes("điện") || categoryName.includes("nước") || categoryName.includes("utility")) {
        cashBookCategory = "utility";
      } else if (categoryName.includes("vận chuyển") || categoryName.includes("ship")) {
        cashBookCategory = "shipping";
      } else if (categoryName.includes("thuế") || categoryName.includes("tax")) {
        cashBookCategory = "tax";
      }

      // 4. Tạo chi phí thực tế
      const [newExpense] = await tx
        .insert(expenses)
        .values({
          expenseNumber,
          categoryId: data.categoryId,
          amount: data.amount,
          description: data.description,
          expenseDate: sanitizedDate,
          paymentMethod: data.paymentMethod,
          createdBy: createdById,
        })
        .returning();

      // 5. Tạo dòng hạch toán âm (Expense) trong Sổ quỹ
      const entryNumber = `CB${dateStr}-${randomSuffix}`;
      await tx.insert(cashBookEntries).values({
        entryNumber,
        type: "expense",
        category: cashBookCategory,
        amount: data.amount,
        runningBalance: "0",
        paymentMethod: data.paymentMethod,
        referenceType: "expense",
        referenceId: newExpense.id,
        description: `Chi phí vận hành (${category[0].name}) - EXP: ${expenseNumber} - ${data.description}`,
        entryDate: sanitizedDate,
        createdBy: createdById,
      });

      // 6. Tính toán lại số dư sổ quỹ
      await recalculateRunningBalances(tx);

      return { 
        success: true, 
        message: "Ghi nhận chi phí vận hành thành công",
        telegramData: {
          expenseNumber,
          expenseDate: new Date(sanitizedDate).toLocaleDateString("vi-VN"),
          categoryName: category[0].name,
          amount: Math.round(Number(data.amount)).toLocaleString("vi-VN") + "đ",
          paymentMethod: data.paymentMethod,
          description: data.description,
        }
      };
    });

    // Gửi thông báo Telegram ngoài Transaction (Asynchronous)
    if (result.success && result.telegramData) {
      const payMethods: Record<string, string> = {
        cash: "Tiền mặt",
        bank_transfer: "Chuyển khoản",
        card: "Thẻ ngân hàng",
      };

      after(() => {
        sendTelegramNotification("expense_created", {
          expense_number: result.telegramData.expenseNumber,
          expense_date: result.telegramData.expenseDate,
          category_name: result.telegramData.categoryName,
          amount: result.telegramData.amount,
          payment_method: payMethods[result.telegramData.paymentMethod] || result.telegramData.paymentMethod,
          description: result.telegramData.description,
        }).catch((err) => console.error("Lỗi gửi thông báo Telegram chi phí vận hành:", err));
      });
    }

    return result;
  } catch (error: any) {
    console.error("Lỗi tạo chi phí:", error);
    return { success: false, message: error.message || "Ghi nhận chi phí thất bại" };
  }
}

// 7. Tạo danh mục chi phí mới trực tiếp từ giao diện
export async function createExpenseCategory(data: {
  name: string;
  type: "fixed" | "variable" | "one_time";
  description?: string;
}) {
  await requireOwner();
  try {
    const [newCategory] = await db
      .insert(expenseCategories)
      .values({
        name: data.name,
        type: data.type,
        description: data.description || null,
      })
      .returning();

    return { success: true, message: "Tạo danh mục chi phí thành công", category: newCategory };
  } catch (error: any) {
    console.error("Lỗi tạo danh mục chi phí:", error);
    return { success: false, message: error.message || "Tạo danh mục chi phí thất bại" };
  }
}

// 7.1. Cập nhật danh mục chi phí
export async function updateExpenseCategory(
  id: string,
  data: {
    name: string;
    type: "fixed" | "variable" | "one_time";
    description?: string;
  }
) {
  await requireOwner();
  try {
    const [updated] = await db
      .update(expenseCategories)
      .set({
        name: data.name,
        type: data.type,
        description: data.description || null,
      })
      .where(eq(expenseCategories.id, id))
      .returning();

    return { success: true, message: "Cập nhật danh mục chi phí thành công", category: updated };
  } catch (error: any) {
    console.error("Lỗi cập nhật danh mục chi phí:", error);
    return { success: false, message: error.message || "Cập nhật danh mục chi phí thất bại" };
  }
}

// 7.2. Xóa danh mục chi phí
export async function deleteExpenseCategory(id: string) {
  await requireOwner();
  try {
    // Kiểm tra xem danh mục có đang được sử dụng bởi khoản chi phí nào không
    const countUse = await db
      .select()
      .from(expenses)
      .where(eq(expenses.categoryId, id))
      .limit(1);

    if (countUse.length > 0) {
      return { 
        success: false, 
        message: "Danh mục này đã có các khoản chi phí phát sinh, không thể xóa để bảo toàn lịch sử kế toán!" 
      };
    }

    await db.delete(expenseCategories).where(eq(expenseCategories.id, id));

    return { success: true, message: "Xóa danh mục chi phí thành công" };
  } catch (error: any) {
    console.error("Lỗi xóa danh mục chi phí:", error);
    return { success: false, message: error.message || "Xóa danh mục chi phí thất bại" };
  }
}

// ============================================================
// INCOME_CATEGORIES ACTIONS — Danh mục thu nhập
// ============================================================

export async function getIncomeCategories() {
  await requireOwner();
  try {
    return await db.select().from(incomeCategories).orderBy(incomeCategories.name);
  } catch (error) {
    console.error("Lỗi lấy danh mục thu nhập:", error);
    return [];
  }
}

export async function createIncomeCategory(data: {
  name: string;
  description?: string;
}) {
  await requireOwner();
  try {
    const [newCategory] = await db
      .insert(incomeCategories)
      .values({
        name: data.name,
        description: data.description || null,
      })
      .returning();

    return { success: true, message: "Tạo danh mục thu nhập thành công", category: newCategory };
  } catch (error: any) {
    console.error("Lỗi tạo danh mục thu nhập:", error);
    return { success: false, message: error.message || "Tạo danh mục thu nhập thất bại" };
  }
}

export async function updateIncomeCategory(
  id: string,
  data: {
    name: string;
    description?: string;
  }
) {
  await requireOwner();
  try {
    const [updated] = await db
      .update(incomeCategories)
      .set({
        name: data.name,
        description: data.description || null,
      })
      .where(eq(incomeCategories.id, id))
      .returning();

    return { success: true, message: "Cập nhật danh mục thu nhập thành công", category: updated };
  } catch (error: any) {
    console.error("Lỗi cập nhật danh mục thu nhập:", error);
    return { success: false, message: error.message || "Cập nhật danh mục thu nhập thất bại" };
  }
}

export async function deleteIncomeCategory(id: string) {
  await requireOwner();
  try {
    // Kiểm tra xem danh mục có đang được sử dụng bởi phiếu thu nào không
    const countUse = await db
      .select()
      .from(cashBookEntries)
      .where(eq(cashBookEntries.incomeCategoryId, id))
      .limit(1);

    if (countUse.length > 0) {
      return { 
        success: false, 
        message: "Danh mục này đã có các phiếu thu phát sinh, không thể xóa để bảo toàn lịch sử kế toán!" 
      };
    }

    await db.delete(incomeCategories).where(eq(incomeCategories.id, id));

    return { success: true, message: "Xóa danh mục thu nhập thành công" };
  } catch (error: any) {
    console.error("Lỗi xóa danh mục thu nhập:", error);
    return { success: false, message: error.message || "Xóa danh mục thu nhập thất bại" };
  }
}

// 8. Lấy danh sách phiếu bảo hành cho dropdown chọn liên kết
export async function getWarrantyClaimsForSelect() {
  await requireOwner();
  try {
    const list = await db
      .select({
        id: warrantyClaims.id,
        claimNumber: warrantyClaims.claimNumber,
        serialNumber: inventoryItems.serialNumber,
        customerName: customers.fullName,
        productName: products.name,
      })
      .from(warrantyClaims)
      .innerJoin(inventoryItems, eq(warrantyClaims.inventoryItemId, inventoryItems.id))
      .innerJoin(customers, eq(warrantyClaims.customerId, customers.id))
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .orderBy(desc(warrantyClaims.createdAt));
    
    return list;
  } catch (error) {
    console.error("Lỗi lấy danh sách phiếu bảo hành cho select:", error);
    return [];
  }
}

// 9. Cập nhật chi phí vận hành thủ công và hạch toán Sổ quỹ tương ứng
export async function updateExpenseAction(data: {
  id: string;
  categoryId: string;
  amount: string;
  description: string;
  expenseDate: string;
  paymentMethod: "cash" | "bank_transfer" | "card";
}) {
  await requireOwner();
  try {
    return await db.transaction(async (tx) => {
      // 0. Kiểm tra chốt sổ kỳ kế toán cho ngày mới hoặc ngày cũ của chứng từ
      const sanitizedDate = parseDateStringToYYYYMMDD(data.expenseDate);
      const periodNameNew = sanitizedDate.slice(0, 7);
      
      const closedPeriodNew = await tx
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.period, periodNameNew),
            eq(accountingPeriods.isClosed, true)
          )
        )
        .limit(1);
      if (closedPeriodNew.length > 0) {
        throw new Error(`Kỳ kế toán tháng ${periodNameNew} đã chốt sổ, không thể chỉnh sửa chi phí!`);
      }

      // 1. Kiểm tra chi phí tồn tại
      const existing = await tx
        .select()
        .from(expenses)
        .where(eq(expenses.id, data.id))
        .limit(1);

      if (!existing.length) {
        throw new Error("Không tìm thấy khoản chi phí cần cập nhật");
      }

      // 2. Lấy danh mục chi phí mới để phân loại sổ quỹ
      const category = await tx
        .select()
        .from(expenseCategories)
        .where(eq(expenseCategories.id, data.categoryId))
        .limit(1);
      
      if (!category.length) throw new Error("Danh mục chi phí không hợp lệ");
      const categoryName = category[0].name.toLowerCase();

      // Ánh xạ danh mục chi phí sang danh mục Sổ quỹ
      let cashBookCategory: "salary" | "rent" | "utility" | "shipping" | "tax" | "other" = "other";
      if (categoryName.includes("lương") || categoryName.includes("salary")) {
        cashBookCategory = "salary";
      } else if (categoryName.includes("mặt bằng") || categoryName.includes("thuê") || categoryName.includes("rent")) {
        cashBookCategory = "rent";
      } else if (categoryName.includes("điện") || categoryName.includes("nước") || categoryName.includes("utility")) {
        cashBookCategory = "utility";
      } else if (categoryName.includes("vận chuyển") || categoryName.includes("ship")) {
        cashBookCategory = "shipping";
      } else if (categoryName.includes("thuế") || categoryName.includes("tax")) {
        cashBookCategory = "tax";
      }

      // 3. Cập nhật bảng expenses
      await tx
        .update(expenses)
        .set({
          categoryId: data.categoryId,
          amount: data.amount,
          description: data.description,
          expenseDate: sanitizedDate,
          paymentMethod: data.paymentMethod,
        })
        .where(eq(expenses.id, data.id));

      // 4. Cập nhật dòng tương ứng trong cashBookEntries
      await tx
        .update(cashBookEntries)
        .set({
          category: cashBookCategory,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          description: `Chi phí vận hành (${category[0].name}) - EXP: ${existing[0].expenseNumber} - ${data.description}`,
          entryDate: sanitizedDate,
        })
        .where(
          and(
            eq(cashBookEntries.referenceType, "expense"),
            eq(cashBookEntries.referenceId, data.id)
          )
        );

      // 5. Tính toán lại số dư lũy kế của toàn bộ sổ quỹ
      await recalculateRunningBalances(tx);

      return { success: true, message: "Cập nhật chi phí và sổ quỹ thành công" };
    });
  } catch (error: any) {
    console.error("Lỗi cập nhật chi phí:", error);
    return { success: false, message: error.message || "Cập nhật chi phí thất bại" };
  }
}

// 10. Xóa chi phí vận hành thủ công và hạch toán Sổ quỹ tương ứng
export async function deleteExpenseAction(expenseId: string) {
  await requireOwner();
  try {
    return await db.transaction(async (tx) => {
      // 1. Kiểm tra tồn tại
      const existing = await tx
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1);

      if (!existing.length) {
        throw new Error("Không tìm thấy khoản chi phí cần xóa");
      }

      // 0. Kiểm tra chốt sổ kỳ kế toán cho ngày của chứng từ cần xóa
      const periodName = existing[0].expenseDate.slice(0, 7);
      const closedPeriod = await tx
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.period, periodName),
            eq(accountingPeriods.isClosed, true)
          )
        )
        .limit(1);
      if (closedPeriod.length > 0) {
        throw new Error(`Kỳ kế toán tháng ${periodName} đã chốt sổ, không thể xóa chi phí!`);
      }

      // 2. Xóa hạch toán trong cashBookEntries trước
      await tx
        .delete(cashBookEntries)
        .where(
          and(
            eq(cashBookEntries.referenceType, "expense"),
            eq(cashBookEntries.referenceId, expenseId)
          )
        );

      // 3. Xóa chi phí trong expenses
      await tx.delete(expenses).where(eq(expenses.id, expenseId));

      // 4. Tính toán lại số dư lũy kế của toàn bộ sổ quỹ
      await recalculateRunningBalances(tx);

      return { success: true, message: "Xóa chi phí và hạch toán sổ quỹ thành công" };
    });
  } catch (error: any) {
    console.error("Lỗi xóa chi phí:", error);
    return { success: false, message: error.message || "Xóa chi phí thất bại" };
  }
}

//         totalFee: sql<string>`sum(${returns.feeAmount})`
//       })
//       .from(returns)
//       .where(eq(returns.status, "completed"));
//     const returnsRefund = Number(returnsStats[0]?.totalRefund || 0);
//     const returnServiceFees = Number(returnsStats[0]?.totalFee || 0);

//     const netProfit = salesProfit + warrantyIncome + returnServiceFees - operationalExpenses - returnsRefund;

//     return {
//       success: true,
//       todayCount,
//       scheduledCount,
//       allCount,
//       flaggedCount,
//       urgentCount,
//       completedCount,
//       totalIncome,
//       totalExpense,
//       netProfit,
//       todayIncome,
//       todayExpense,
//       todayNetProfit,
//       thisMonthIncome,
//       thisMonthExpense,
//       thisMonthNetProfit,
//     };
//   } catch (error) {
//     console.error("Lỗi lấy thống kê kiểu Apple:", error);
//     return {
//       success: false,
//       todayCount: 0,
//       scheduledCount: 0,
//       allCount: 0,
//       flaggedCount: 0,
//       urgentCount: 0,
//       completedCount: 0,
//       totalIncome: 0,
//       totalExpense: 0,
//       netProfit: 0,
//       todayIncome: 0,
//       todayExpense: 0,
//       todayNetProfit: 0,
//       thisMonthIncome: 0,
//       thisMonthExpense: 0,
//       thisMonthNetProfit: 0,
//     };
//   }
// }

// src/app/actions/accounting.ts
// THAY THẾ HOÀN TOÀN HÀM getAppleDashboardStats CŨ BẰNG HÀM NÀY:

export async function getDashboardBentoData(targetMonth: string) {
  console.log(`SERVER: getDashboardBentoData called for ${targetMonth}`);
  await requireOwner();
  try {
    const todayStr = new Date().toISOString().split("T")[0]; // e.g. "2026-06-01"
    const currentMonthStr = targetMonth || todayStr.slice(0, 7); // e.g. "2026-06"

    // ==========================================
    // 1. THỐNG KÊ SỐ LIỆU VẬN HÀNH (OPERATIONS)
    // ==========================================
    
    // Đơn hàng hoàn thành (Hôm nay vs Tháng này), báo giá, kho hàng, bảo hành, tài chính, đơn hàng gần nhất, và phiếu hoàn trả tháng này
    const todayOrdersCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.status, "completed"), sql`DATE(${orders.createdAt}) = ${todayStr}`));
    
    const monthOrdersCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(eq(orders.status, "completed"), sql`to_char(${orders.createdAt}, 'YYYY-MM') = ${currentMonthStr}`));
    
    const activeQuotes = await db
      .select({ count: sql<number>`count(*)` })
      .from(quotations)
      .where(or(eq(quotations.status, "draft"), eq(quotations.status, "sent"), eq(quotations.status, "viewed")));
    
    const inventoryStatusStats = await db
      .select({ status: inventoryItems.status, count: sql<number>`count(*)` })
      .from(inventoryItems)
      .groupBy(inventoryItems.status);
    
    const warrantyStatusStats = await db
      .select({ status: warrantyClaims.status, count: sql<number>`count(*)` })
      .from(warrantyClaims)
      .groupBy(warrantyClaims.status);
    
    const monthSales = await db
      .select({
        revenue: sql<string>`sum(${orders.totalAmount})`,
        cogs: sql<string>`sum(${orders.totalCost})`,
      })
      .from(orders)
      .where(and(eq(orders.status, "completed"), sql`to_char(${orders.createdAt}, 'YYYY-MM') = ${currentMonthStr}`));
    
    const monthExpenses = await db
      .select({ total: sql<string>`sum(${expenses.amount})` })
      .from(expenses)
      .where(sql`to_char(${expenses.expenseDate}, 'YYYY-MM') = ${currentMonthStr}`);
    
    const monthReturns = await db
      .select({ refund: sql<string>`sum(${returns.refundAmount})`, fee: sql<string>`sum(${returns.feeAmount})` })
      .from(returns)
      .where(and(eq(returns.status, "completed"), sql`to_char(${returns.createdAt}, 'YYYY-MM') = ${currentMonthStr}`));
    
    const monthWarrantyIncome = await db
      .select({ total: sql<string>`sum(${warrantyClaims.repairCost})` })
      .from(warrantyClaims)
      .where(and(eq(warrantyClaims.status, "completed"), sql`to_char(${warrantyClaims.createdAt}, 'YYYY-MM') = ${currentMonthStr}`));
    
    const todaySales = await db
      .select({
        revenue: sql<string>`sum(${orders.totalAmount})`,
        cogs: sql<string>`sum(${orders.totalCost})`,
      })
      .from(orders)
      .where(and(eq(orders.status, "completed"), sql`DATE(${orders.createdAt}) = ${todayStr}`));
    
    const todayExpenses = await db
      .select({ total: sql<string>`sum(${expenses.amount})` })
      .from(expenses)
      .where(sql`DATE(${expenses.expenseDate}) = ${todayStr}`);
    
    const todayReturns = await db
      .select({ refund: sql<string>`sum(${returns.refundAmount})`, fee: sql<string>`sum(${returns.feeAmount})` })
      .from(returns)
      .where(and(eq(returns.status, "completed"), sql`DATE(${returns.createdAt}) = ${todayStr}`));
    
    const recentOrdersList = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: customers.fullName,
        totalAmount: orders.totalAmount,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .orderBy(desc(orders.createdAt))
      .limit(5);
    
    const monthReturnCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(returns)
      .where(and(eq(returns.status, "completed"), sql`to_char(${returns.createdAt}, 'YYYY-MM') = ${currentMonthStr}`));


    const invMap = { in_stock: 0, incoming: 0, defective: 0 };
    inventoryStatusStats.forEach((row) => {
      if (row.status in invMap) {
        invMap[row.status as keyof Omit<typeof invMap, 'reserved'>] = Number(row.count || 0);
      }
    });

    const warrantyMap = { pending: 0, inspecting: 0, repairing: 0, waiting_parts: 0, completed: 0 };
    warrantyStatusStats.forEach((row) => {
      if (row.status in warrantyMap) {
        warrantyMap[row.status as keyof typeof warrantyMap] = Number(row.count || 0);
      }
    });

    // --- ĐỔ DATA & TÍNH TOÁN CÔNG THỨC DUY NHẤT ĐỠ DOUBLE COUNT ---
    const mRev = Number(monthSales[0]?.revenue || 0);
    const mCogs = Number(monthSales[0]?.cogs || 0);
    const mExp = Number(monthExpenses[0]?.total || 0);
    const mRef = Number(monthReturns[0]?.refund || 0);
    const mFee = Number(monthReturns[0]?.fee || 0);
    const mWarr = Number(monthWarrantyIncome[0]?.total || 0);

    const thisMonthIncome = mRev + mWarr + mFee;
    const thisMonthExpense = mCogs + mExp + mRef;
    const thisMonthNetProfit = thisMonthIncome - thisMonthExpense;
    const thisMonthMargin = thisMonthIncome > 0 ? (thisMonthNetProfit / thisMonthIncome) * 100 : 0;

    const tRev = Number(todaySales[0]?.revenue || 0);
    const tCogs = Number(todaySales[0]?.cogs || 0);
    const tExp = Number(todayExpenses[0]?.total || 0);
    const tRef = Number(todayReturns[0]?.refund || 0);
    const tFee = Number(todayReturns[0]?.fee || 0);

    const todayIncome = tRev + tFee;
    const todayExpense = tCogs + tExp + tRef;
    const todayNetProfit = todayIncome - todayExpense;

    return {
      success: true,
      todayCount: Number(todayOrdersCount[0]?.count || 0),
      completedCount: Number(monthOrdersCount[0]?.count || 0),
      scheduledCount: Number(activeQuotes[0]?.count || 0),
      
      // Kho & bảo hành
      inventory: invMap,
      warranty: warrantyMap,
      returnCount: Number(monthReturnCount[0]?.count || 0),

      // Tài chính đã tính toán chuẩn xác
      todayIncome,
      todayExpense,
      todayNetProfit,
      
      thisMonthIncome,
      thisMonthExpense,
      thisMonthNetProfit,
      thisMonthMargin,

      recentOrders: recentOrdersList,
    };
  } catch (error) {
    console.error("Lỗi chí mạng hệ thống Dashboard Bento API:", error);
    throw error;
  }
}

// ============================================================
// HÀNH ĐỘNG THU THỦ CÔNG (MANUAL INCOME ACTIONS)
// ============================================================

export async function createManualIncome(data: {
  amount: string;
  incomeCategoryId: string;
  description: string;
  entryDate: string;
  paymentMethod: "cash" | "bank_transfer" | "card";
}) {
  await requireOwner();
  try {
    const result = await db.transaction(async (tx) => {
      // 0. Chuẩn hóa ngày nhập liệu (chấp nhận ddmmyyyy, dd/mm/yyyy, dd-mm-yyyy)
      const sanitizedDate = parseDateStringToYYYYMMDD(data.entryDate);
      const periodName = sanitizedDate.slice(0, 7);

      const closedPeriod = await tx
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.period, periodName),
            eq(accountingPeriods.isClosed, true)
          )
        )
        .limit(1);
      if (closedPeriod.length > 0) {
        throw new Error(`Kỳ kế toán tháng ${periodName} đã chốt sổ, không thể ghi nhận phiếu thu!`);
      }

      // 1. Lấy thông tin nhân viên ghi nhận
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const createdById = ownerProfiles[0]?.id;
      if (!createdById) throw new Error("Chưa cấu hình tài khoản nhân viên");

      // 2. Tạo mã phiếu thu duy nhất
      const dateStr = sanitizedDate.replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const entryNumber = `CB-INC-${dateStr}-${randomSuffix}`;

      // 2.5 Lấy tên danh mục để map enum category tương thích
      const categoryObj = await tx
        .select()
        .from(incomeCategories)
        .where(eq(incomeCategories.id, data.incomeCategoryId))
        .limit(1);
      if (!categoryObj.length) throw new Error("Danh mục thu nhập không hợp lệ");
      const categoryName = categoryObj[0].name.toLowerCase();

      let cashBookCategory: "sales" | "warranty_repair" | "other" = "other";
      if (categoryName.includes("bán lẻ") || categoryName.includes("sales") || categoryName.includes("bán hàng")) {
        cashBookCategory = "sales";
      } else if (categoryName.includes("bảo hành") || categoryName.includes("sửa chữa") || categoryName.includes("warranty")) {
        cashBookCategory = "warranty_repair";
      }

      // 3. Tạo dòng hạch toán dương (Income) trong Sổ quỹ
      const [newEntry] = await tx
        .insert(cashBookEntries)
        .values({
          entryNumber,
          type: "income",
          category: cashBookCategory,
          amount: data.amount,
          runningBalance: "0",
          paymentMethod: data.paymentMethod,
          referenceType: null,
          referenceId: null,
          description: data.description,
          entryDate: sanitizedDate,
          createdBy: createdById,
          incomeCategoryId: data.incomeCategoryId,
        })
        .returning();

      // 4. Tính toán lại số dư sổ quỹ
      await recalculateRunningBalances(tx);

      return {
        success: true,
        message: "Ghi nhận phiếu thu thành công",
        entry: newEntry,
        telegramData: {
          entryNumber,
          entryDate: new Date(sanitizedDate).toLocaleDateString("vi-VN"),
          categoryName: categoryObj[0].name,
          amount: Math.round(Number(data.amount)).toLocaleString("vi-VN") + "đ",
          paymentMethod: data.paymentMethod,
          description: data.description,
        }
      };
    });

    // Gửi thông báo Telegram ngoài Transaction (Asynchronous)
    if (result.success && result.telegramData) {
      const payMethods: Record<string, string> = {
        cash: "Tiền mặt",
        bank_transfer: "Chuyển khoản",
        card: "Thẻ ngân hàng",
      };

      after(() => {
        sendTelegramNotification("payment_received", {
          income_number: result.telegramData.entryNumber,
          income_date: result.telegramData.entryDate,
          category_name: result.telegramData.categoryName,
          amount: result.telegramData.amount,
          payment_method: payMethods[result.telegramData.paymentMethod] || result.telegramData.paymentMethod,
          description: result.telegramData.description,
        }).catch((err) => console.error("Lỗi gửi thông báo Telegram phiếu thu:", err));
      });
    }

    return result;
  } catch (error: any) {
    console.error("Lỗi tạo phiếu thu:", error);
    return { success: false, message: error.message || "Ghi nhận phiếu thu thất bại" };
  }
}

export async function updateManualIncome(data: {
  id: string;
  amount: string;
  incomeCategoryId: string;
  description: string;
  entryDate: string;
  paymentMethod: "cash" | "bank_transfer" | "card";
}) {
  await requireOwner();
  try {
    return await db.transaction(async (tx) => {
      // 0. Kiểm tra chốt sổ kỳ kế toán cho ngày mới
      const sanitizedDate = parseDateStringToYYYYMMDD(data.entryDate);
      const periodNameNew = sanitizedDate.slice(0, 7);

      const closedPeriodNew = await tx
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.period, periodNameNew),
            eq(accountingPeriods.isClosed, true)
          )
        )
        .limit(1);
      if (closedPeriodNew.length > 0) {
        throw new Error(`Kỳ kế toán tháng ${periodNameNew} đã chốt sổ, không thể chỉnh sửa phiếu thu!`);
      }

      // 1. Kiểm tra phiếu thu tồn tại và là thủ công
      const existing = await tx
        .select()
        .from(cashBookEntries)
        .where(eq(cashBookEntries.id, data.id))
        .limit(1);

      if (!existing.length) {
        throw new Error("Không tìm thấy phiếu thu cần cập nhật");
      }

      if (existing[0].referenceType !== null || existing[0].type !== "income") {
        throw new Error("Không thể chỉnh sửa phiếu thu tự động từ hệ thống");
      }

      // 1.5. Kiểm tra chốt sổ kỳ kế toán của ngày cũ
      const periodNameOld = existing[0].entryDate.slice(0, 7);
      const closedPeriodOld = await tx
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.period, periodNameOld),
            eq(accountingPeriods.isClosed, true)
          )
        )
        .limit(1);
      if (closedPeriodOld.length > 0) {
        throw new Error(`Kỳ kế toán tháng ${periodNameOld} đã chốt sổ, không thể chỉnh sửa phiếu thu!`);
      }

      // 1.6 Lấy tên danh mục để map enum category tương thích
      const categoryObj = await tx
        .select()
        .from(incomeCategories)
        .where(eq(incomeCategories.id, data.incomeCategoryId))
        .limit(1);
      if (!categoryObj.length) throw new Error("Danh mục thu nhập không hợp lệ");
      const categoryName = categoryObj[0].name.toLowerCase();

      let cashBookCategory: "sales" | "warranty_repair" | "other" = "other";
      if (categoryName.includes("bán lẻ") || categoryName.includes("sales") || categoryName.includes("bán hàng")) {
        cashBookCategory = "sales";
      } else if (categoryName.includes("bảo hành") || categoryName.includes("sửa chữa") || categoryName.includes("warranty")) {
        cashBookCategory = "warranty_repair";
      }

      // 2. Cập nhật cashBookEntries
      await tx
        .update(cashBookEntries)
        .set({
          category: cashBookCategory,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          description: data.description,
          entryDate: sanitizedDate,
          incomeCategoryId: data.incomeCategoryId,
        })
        .where(eq(cashBookEntries.id, data.id));

      // 3. Tính toán lại số dư sổ quỹ
      await recalculateRunningBalances(tx);

      return { success: true, message: "Cập nhật phiếu thu thành công" };
    });
  } catch (error: any) {
    console.error("Lỗi cập nhật phiếu thu:", error);
    return { success: false, message: error.message || "Cập nhật phiếu thu thất bại" };
  }
}

export async function deleteManualIncome(id: string) {
  await requireOwner();
  try {
    return await db.transaction(async (tx) => {
      // 1. Kiểm tra tồn tại
      const existing = await tx
        .select()
        .from(cashBookEntries)
        .where(eq(cashBookEntries.id, id))
        .limit(1);

      if (!existing.length) {
        throw new Error("Không tìm thấy phiếu thu cần xóa");
      }

      if (existing[0].referenceType !== null || existing[0].type !== "income") {
        throw new Error("Không thể xóa phiếu thu tự động từ hệ thống");
      }

      // 0. Kiểm tra chốt sổ kỳ kế toán cho ngày của chứng từ cần xóa
      const periodName = existing[0].entryDate.slice(0, 7);
      const closedPeriod = await tx
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.period, periodName),
            eq(accountingPeriods.isClosed, true)
          )
        )
        .limit(1);
      if (closedPeriod.length > 0) {
        throw new Error(`Kỳ kế toán tháng ${periodName} đã chốt sổ, không thể xóa phiếu thu!`);
      }

      // 2. Xóa hạch toán trong cashBookEntries
      await tx.delete(cashBookEntries).where(eq(cashBookEntries.id, id));

      // 3. Tính toán lại số dư lũy kế
      await recalculateRunningBalances(tx);

      return { success: true, message: "Xóa phiếu thu thành công" };
    });
  } catch (error: any) {
    console.error("Lỗi xóa phiếu thu:", error);
    return { success: false, message: error.message || "Xóa phiếu thu thất bại" };
  }
}


