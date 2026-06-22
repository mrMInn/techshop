"use server";

import { db, recalculateRunningBalances } from "@/lib/db";
import { after } from "next/server";

import { 
  orders, 
  orderItems, 
  payments, 
  customers, 
  inventoryItems, 
  inventoryMovements, 
  profiles, 
  products, 
  leadSources,
  brands,
  cashBookEntries,
  returns
} from "@/lib/db/schema";
import { eq, desc, inArray, and, or, ilike, sql } from "drizzle-orm";
import { sendTelegramNotification } from "@/lib/telegram/notifier";

// 1. Lấy danh sách đơn hàng có phân trang và lọc từ Backend
export async function getOrdersList(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  saleChannel?: string;
}) {
  try {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params?.status && params.status !== "all") {
      conditions.push(eq(orders.status, params.status as any));
    }

    if (params?.paymentStatus && params.paymentStatus !== "all") {
      conditions.push(eq(orders.paymentStatus, params.paymentStatus as any));
    }

    if (params?.saleChannel && params.saleChannel !== "all") {
      conditions.push(eq(orders.saleChannel, params.saleChannel as any));
    }

    if (params?.search && params.search.trim() !== "") {
      const searchLower = `%${params.search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          ilike(orders.orderNumber, searchLower),
          ilike(customers.fullName, searchLower),
          ilike(customers.phone, searchLower)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // A. Truy vấn dữ liệu đơn hàng phân trang
    const listQuery = db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        saleChannel: orders.saleChannel,
        totalAmount: orders.totalAmount,
        totalCost: orders.totalCost,
        profit: orders.profit,
        profitMargin: orders.profitMargin,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        soldByName: profiles.fullName,
        leadSourceName: leadSources.name,
        trackingNumber: orders.trackingNumber,
        shippingCarrier: orders.shippingCarrier,
        packingVideoUrl: orders.packingVideoUrl,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(profiles, eq(orders.soldBy, profiles.id))
      .leftJoin(leadSources, eq(orders.leadSourceId, leadSources.id));

    if (whereClause) {
      listQuery.where(whereClause);
    }

    const list = await listQuery
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // B. Đếm tổng số đơn hàng thỏa mãn điều kiện lọc
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }
    const [countResult] = await countQuery;
    const totalItems = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalItems / limit);

    // C. Truy vấn thống kê nhanh toàn hệ thống (không bị ảnh hưởng bởi phân trang)
    const statsResult = await db
      .select({
        completedCount: sql<number>`count(case when ${orders.status} = 'completed' then 1 end)`,
        processingCount: sql<number>`count(case when ${orders.status} = 'processing' then 1 end)`,
        cancelledCount: sql<number>`count(case when ${orders.status} = 'cancelled' then 1 end)`,
        onlineCount: sql<number>`count(case when ${orders.saleChannel} = 'online' and ${orders.status} != 'cancelled' then 1 end)`,
      })
      .from(orders);

    const stats = statsResult[0] || { completedCount: 0, processingCount: 0, cancelledCount: 0, onlineCount: 0 };

    return {
      orders: list,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
      stats: {
        completedCount: Number(stats.completedCount || 0),
        processingCount: Number(stats.processingCount || 0),
        cancelledCount: Number(stats.cancelledCount || 0),
        onlineCount: Number(stats.onlineCount || 0),
      }
    };
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn hàng:", error);
    return {
      orders: [],
      pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
      stats: { completedCount: 0, processingCount: 0, cancelledCount: 0, onlineCount: 0 }
    };
  }
}

// 2. Lấy danh sách máy đang "Sẵn hàng" trong kho để bán
export async function getInStockItemsForSelect() {
  try {
    const items = await db
      .select({
        id: inventoryItems.id,
        serialNumber: inventoryItems.serialNumber,
        sellingPrice: inventoryItems.sellingPrice,
        costPrice: inventoryItems.costPrice,
        productName: products.name,
        productSku: products.sku,
        brandName: brands.name,
        specs: products.specs,
        productId: inventoryItems.productId,
        condition: inventoryItems.condition,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(inventoryItems.status, "in_stock"))
      .orderBy(products.name);

    return items;
  } catch (error) {
    console.error("Lỗi lấy danh sách máy sẵn kho:", error);
    return [];
  }
}

// 3. Lấy danh sách khách hàng cho dropdown
export async function getCustomersForSelect() {
  try {
    return await db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        phone: customers.phone,
      })
      .from(customers)
      .orderBy(customers.fullName);
  } catch (error) {
    console.error("Lỗi lấy danh sách khách hàng:", error);
    return [];
  }
}

// 4. Lấy danh sách nguồn khách hàng
export async function getLeadSourcesAction() {
  try {
    return await db
      .select({
        id: leadSources.id,
        name: leadSources.name,
      })
      .from(leadSources)
      .where(eq(leadSources.isActive, true))
      .orderBy(leadSources.name);
  } catch (error) {
    console.error("Lỗi lấy danh sách nguồn khách hàng:", error);
    return [];
  }
}

// 5. Thêm nhanh khách hàng mới
export async function createCustomerAction(data: {
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}) {
  try {
    const [newCustomer] = await db
      .insert(customers)
      .values({
        fullName: data.fullName,
        phone: data.phone?.trim() || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
        totalSpent: "0",
        orderCount: 0,
      })
      .returning();

    return { success: true, message: "Thêm khách hàng thành công", customer: newCustomer };
  } catch (error: any) {
    console.error("Lỗi thêm nhanh khách hàng:", error);
    return { success: false, message: "Không thể thêm khách hàng. Vui lòng kiểm tra lại." };
  }
}

// 6. Tạo Đơn hàng mới (Transaction)
export async function createOrderAction(data: {
  customerId?: string;
  leadSourceId?: string;
  saleChannel: "online" | "offline";
  items: {
    inventoryItemId: string;
    productId: string;
    sellingPrice: string;
    discount?: string;
    warrantyMonths: number;
  }[];
  discountAmount?: string;
  discountPercent?: string;
  taxAmount?: string;
  paymentMethod?: "cash" | "bank_transfer" | "card" | "mixed";
  shippingAddress?: string;
  notes?: string;
  initialPaymentAmount?: string;
  paymentNotes?: string;
}) {
  try {
    if (!data.items || data.items.length === 0) {
      return { success: false, message: "Đơn hàng phải chứa ít nhất 1 sản phẩm" };
    }

    const result = await db.transaction(async (tx) => {
      // Find or create "Khách vãng lai" customer if none is specified
      let finalCustomerId = data.customerId;
      if (!finalCustomerId || finalCustomerId.trim() === "") {
        const guestCustomers = await tx
          .select()
          .from(customers)
          .where(eq(customers.fullName, "Khách vãng lai"))
          .limit(1);

        if (guestCustomers.length > 0) {
          finalCustomerId = guestCustomers[0].id;
        } else {
          const [newGuest] = await tx
            .insert(customers)
            .values({
              fullName: "Khách vãng lai",
              phone: "0999888777",
              notes: "Khách vãng lai",
            })
            .returning();
          finalCustomerId = newGuest.id;
        }
      }

      // 1. Tạo số đơn hàng duy nhất ORD-YYYYMMDD-[XXXX]
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

      // 2. Kiểm tra tính sẵn sàng của các máy trong kho
      const itemIds = data.items.map((i) => i.inventoryItemId);
      const dbItems = await tx
        .select()
        .from(inventoryItems)
        .where(inArray(inventoryItems.id, itemIds));

      if (dbItems.length !== data.items.length) {
        throw new Error("Một số sản phẩm không tồn tại trong hệ thống kho");
      }

      const anyNotStock = dbItems.some((i) => i.status !== "in_stock");
      if (anyNotStock) {
        throw new Error("Một số sản phẩm đã được bán hoặc không sẵn sàng trong kho");
      }

      const itemCostMap = new Map(dbItems.map((i) => [i.id, Number(i.costPrice)]));

      // 3. Lấy nhân viên bán hàng (Lấy profile đầu tiên làm người tạo nếu chưa có auth)
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const soldById = ownerProfiles[0]?.id;
      if (!soldById) {
        throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");
      }

      // 4. Tính toán chi tiết tài chính đơn hàng
      let subtotal = 0;
      let totalCost = 0;
      let totalItemDiscounts = 0;

      const itemsToInsert = data.items.map((item) => {
        const cost = itemCostMap.get(item.inventoryItemId) || 0;
        const selling = Number(item.sellingPrice);
        const disc = Number(item.discount || 0);
        const profit = selling - cost - disc;

        subtotal += selling;
        totalCost += cost;
        totalItemDiscounts += disc;

        return {
          inventoryItemId: item.inventoryItemId,
          productId: item.productId,
          sellingPrice: item.sellingPrice,
          costPrice: cost.toString(),
          discount: disc.toString(),
          profit: profit.toString(),
          warrantyMonths: item.warrantyMonths,
        };
      });

      const generalDiscount = Number(data.discountAmount || 0);
      const tax = Number(data.taxAmount || 0);
      const totalAmount = subtotal - totalItemDiscounts - generalDiscount + tax;
      const orderProfit = totalAmount - totalCost;
      const profitMargin = totalAmount > 0 ? (orderProfit / totalAmount) * 100 : 0;

      // Xác định trạng thái thanh toán ban đầu (Nếu bán tại quầy offline thì bắt buộc thanh toán đủ)
      const initialPay = data.saleChannel === "offline" ? totalAmount : Number(data.initialPaymentAmount || 0);
      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
      if (data.saleChannel === "offline") {
        paymentStatus = "paid";
      } else if (initialPay > 0) {
        if (initialPay >= totalAmount) {
          paymentStatus = "paid";
        } else {
          paymentStatus = "partial";
        }
      }

      // 5. Thêm Đơn hàng vào Database
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerId: finalCustomerId,
          leadSourceId: data.leadSourceId || null,
          status: data.saleChannel === "online" ? "processing" : "completed", // Đang giao nếu bán online, ngược lại hoàn tất
          saleChannel: data.saleChannel,
          subtotal: subtotal.toString(),
          discountAmount: data.discountAmount || "0",
          discountPercent: data.discountPercent || "0",
          taxAmount: data.taxAmount || "0",
          totalAmount: totalAmount.toFixed(2),
          totalCost: totalCost.toFixed(2),
          profit: orderProfit.toFixed(2),
          profitMargin: profitMargin.toFixed(2),
          paymentStatus,
          paymentMethod: data.paymentMethod || null,
          shippingAddress: data.shippingAddress || null,
          notes: data.notes || null,
          soldBy: soldById,
        })
        .returning();

      // 6. Thêm các item của đơn hàng và cập nhật kho hàng loạt
      const orderItemsToInsert = itemsToInsert.map(item => ({
        orderId: newOrder.id,
        ...item,
      }));
      await tx.insert(orderItems).values(orderItemsToInsert);

      const movementsToInsert = [];
      const updatePromises = [];

      for (const item of itemsToInsert) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(startDate.getMonth() + (item.warrantyMonths || 0));

        const warrantyStartStr = startDate.toISOString().split("T")[0];
        const warrantyEndStr = endDate.toISOString().split("T")[0];

        updatePromises.push(
          tx
            .update(inventoryItems)
            .set({
              status: "sold",
              soldDate: startDate.toISOString().split("T")[0],
              warrantyStart: warrantyStartStr,
              warrantyEnd: warrantyEndStr,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, item.inventoryItemId))
        );

        movementsToInsert.push({
          inventoryItemId: item.inventoryItemId,
          movementType: "sold" as const,
          fromStatus: "in_stock",
          toStatus: "sold",
          referenceType: "order" as const,
          referenceId: newOrder.id,
          quantityChange: -1,
          notes: `Bán sản phẩm theo Đơn hàng ${orderNumber}`,
          performedBy: soldById,
        });
      }

      await Promise.all(updatePromises);
      await tx.insert(inventoryMovements).values(movementsToInsert);

      // 7. Cập nhật thống kê chi tiêu của Khách hàng
      const customer = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, finalCustomerId))
        .limit(1);

      if (customer.length > 0) {
        const currentSpent = Number(customer[0].totalSpent || 0);
        const newSpent = currentSpent + totalAmount;
        await tx
          .update(customers)
          .set({
            totalSpent: newSpent.toFixed(2),
            orderCount: customer[0].orderCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, finalCustomerId));
      }

      // 8. Lưu lịch sử thanh toán nếu có trả trước
      if (initialPay > 0) {
        const mappedMethod = 
          data.paymentMethod === "mixed" 
            ? "cash" 
            : (data.paymentMethod || "cash");

        await tx.insert(payments).values({
          orderId: newOrder.id,
          amount: initialPay.toFixed(2),
          paymentMethod: mappedMethod,
          notes: data.paymentNotes || "Thanh toán khi lập đơn hàng",
          createdBy: soldById,
        });

        // 9. Đồng bộ Sổ quỹ Kế toán
        const cashBookPaymentMethod = 
          mappedMethod === "bank_transfer" || mappedMethod === "card" 
            ? mappedMethod 
            : "cash";

        const dateStrCB = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffixCB = Math.random().toString(36).substring(2, 6).toUpperCase();
        const entryNumber = `CB${dateStrCB}-${randomSuffixCB}`;

        await tx.insert(cashBookEntries).values({
          entryNumber,
          type: "income",
          category: "sales",
          amount: initialPay.toString(),
          runningBalance: "0",
          paymentMethod: cashBookPaymentMethod,
          referenceType: "order",
          referenceId: newOrder.id,
          description: `Thu tiền thanh toán đơn hàng ${orderNumber}`,
          entryDate: new Date().toISOString().split("T")[0],
          createdBy: soldById,
        });

        await recalculateRunningBalances(tx);
      }

      // 10. Lấy danh sách thiết bị và tên sản phẩm để gửi Telegram
      const soldItemsDetails = await tx
        .select({
          serialNumber: inventoryItems.serialNumber,
          productName: products.name,
          sellingPrice: orderItems.sellingPrice,
        })
        .from(orderItems)
        .innerJoin(inventoryItems, eq(orderItems.inventoryItemId, inventoryItems.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, newOrder.id));

      const itemsListStr = soldItemsDetails
        .map((item, idx) => `${idx + 1}. <b>${item.productName}</b>\n   • SN: <code>${item.serialNumber}</code>\n   • Giá: ${Math.round(Number(item.sellingPrice)).toLocaleString("vi-VN")}đ`)
        .join("\n");

      let customerName = "Khách hàng lẻ";
      let customerPhone = "";
      if (customer.length > 0) {
        customerName = customer[0].fullName;
        customerPhone = customer[0].phone || "";
      }

      return { 
        success: true, 
        message: `Lập đơn hàng ${orderNumber} thành công`, 
        order: newOrder,
        telegramData: {
          orderNumber,
          customerName,
          customerPhone,
          totalAmount: Math.round(totalAmount).toLocaleString("vi-VN") + "đ",
          paymentMethod: data.paymentMethod || "cash",
          itemsList: itemsListStr,
        }
      };
    });

    // Gửi thông báo Telegram ngoài Transaction (Asynchronous, không block database)
    if (result.success && result.telegramData) {
      const payMethods: Record<string, string> = {
        cash: "Tiền mặt",
        bank_transfer: "Chuyển khoản",
        card: "Thẻ ngân hàng",
        mixed: "Hỗn hợp",
      };

      after(() => {
        sendTelegramNotification(
          data.saleChannel === "online" ? "order_created" : "order_completed",
          {
            order_number: result.telegramData.orderNumber,
            customer_name: result.telegramData.customerName,
            customer_phone: result.telegramData.customerPhone,
            total_amount: result.telegramData.totalAmount,
            payment_method: payMethods[result.telegramData.paymentMethod] || result.telegramData.paymentMethod,
            items_list: result.telegramData.itemsList,
          }
        ).catch((err) => console.error("Lỗi gửi thông báo Telegram đơn hàng:", err));
      });
    }

    return result;
  } catch (error: any) {
    console.error("Lỗi tạo đơn hàng:", error);
    return { success: false, message: error.message || "Không thể tạo đơn hàng" };
  }
}

// 7. Hủy Đơn hàng (Transaction - Trả máy về kho)
export async function cancelOrderAction(orderId: string) {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Kiểm tra đơn hàng tồn tại
      const order = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order.length) throw new Error("Không tìm thấy đơn hàng");
      if (order[0].status === "cancelled") throw new Error("Đơn hàng đã được hủy trước đó");

      const orderData = order[0];
      
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      // 2. Lấy danh sách item của đơn hàng
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

      // 3. Khôi phục trạng thái máy về sẵn kho hàng loạt
      const inventoryItemIds = items.map((i) => i.inventoryItemId);
      if (inventoryItemIds.length > 0) {
        await tx
          .update(inventoryItems)
          .set({
            status: "in_stock",
            soldDate: null,
            warrantyStart: null,
            warrantyEnd: null,
            updatedAt: new Date(),
          })
          .where(inArray(inventoryItems.id, inventoryItemIds));

        const movementsToInsert = items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          movementType: "returned" as const,
          fromStatus: "sold",
          toStatus: "in_stock",
          referenceType: "order" as const,
          referenceId: orderId,
          quantityChange: 1,
          notes: `Khôi phục máy vào kho hàng do hủy Đơn hàng ${orderData.orderNumber}`,
          performedBy: performedById,
        }));

        await tx.insert(inventoryMovements).values(movementsToInsert);
      }

      // 4. Khấu trừ tích lũy mua hàng của khách hàng
      const customer = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, orderData.customerId))
        .limit(1);

      if (customer.length > 0) {
        const currentSpent = Number(customer[0].totalSpent || 0);
        const newSpent = Math.max(0, currentSpent - Number(orderData.totalAmount));
        const newCount = Math.max(0, customer[0].orderCount - 1);

        await tx
          .update(customers)
          .set({
            totalSpent: newSpent.toFixed(2),
            orderCount: newCount,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, orderData.customerId));
      }

      // 5. Cập nhật trạng thái đơn hàng thành Hủy và trạng thái thanh toán hoàn tiền
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: "cancelled",
          paymentStatus: "refunded",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      // 6. Xóa sổ quỹ liên quan đến đơn hàng bị hủy
      await tx.delete(cashBookEntries).where(
        and(
          eq(cashBookEntries.referenceType, "order"),
          eq(cashBookEntries.referenceId, orderId)
        )
      );

      // 7. Tính toán lại số dư sổ quỹ
      await recalculateRunningBalances(tx);

      // 8. Lấy thông tin khách hàng để gửi Telegram hủy đơn
      let customerName = "Khách hàng";
      if (customer && customer.length > 0) {
        customerName = customer[0].fullName;
      }

      return { 
        success: true, 
        message: "Hủy đơn hàng và khôi phục kho thành công", 
        order: updatedOrder,
        telegramData: {
          orderNumber: orderData.orderNumber,
          customerName,
          totalAmount: Math.round(Number(orderData.totalAmount)).toLocaleString("vi-VN") + "đ",
        }
      };
    });

    // Gửi thông báo Telegram ngoài Transaction (Asynchronous, không block database)
    if (result.success && result.telegramData) {
      after(() => {
        sendTelegramNotification("order_cancelled", {
          order_number: result.telegramData.orderNumber,
          customer_name: result.telegramData.customerName,
          total_amount: result.telegramData.totalAmount,
          reason: "Yêu cầu hoàn trả máy / Hủy giao dịch lập đơn",
        }).catch((err) => console.error("Lỗi gửi thông báo Telegram hủy đơn hàng:", err));
      });
    }

    return result;
  } catch (error: any) {
    console.error("Lỗi hủy đơn hàng:", error);
    return { success: false, message: error.message || "Không thể hủy đơn hàng" };
  }
}

// 8. Ghi nhận thanh toán bổ sung cho đơn hàng
export async function recordPaymentAction(data: {
  orderId: string;
  amount: string;
  paymentMethod: "cash" | "bank_transfer" | "card" | "momo" | "vnpay";
  referenceNumber?: string;
  notes?: string;
}) {
  try {
    const paymentAmount = Number(data.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return { success: false, message: "Số tiền thanh toán phải lớn hơn 0" };
    }

    return await db.transaction(async (tx) => {
      // 1. Kiểm tra đơn hàng
      const order = await tx.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
      if (!order.length) throw new Error("Không tìm thấy đơn hàng");

      const orderData = order[0];
      const totalAmount = Number(orderData.totalAmount);

      // 2. Tính tổng số tiền đã trả trước đó
      const existingPayments = await tx.select().from(payments).where(eq(payments.orderId, data.orderId));
      const totalPaidAlready = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      const totalPaidNew = totalPaidAlready + paymentAmount;

      let paymentStatus: "unpaid" | "partial" | "paid" = "partial";
      if (totalPaidNew >= totalAmount) {
        paymentStatus = "paid";
      }

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      // 3. Thêm bản ghi thanh toán
      const [newPayment] = await tx
        .insert(payments)
        .values({
          orderId: data.orderId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber || null,
          notes: data.notes || "Ghi nhận thanh toán bổ sung",
          createdBy: performedById,
        })
        .returning();

      // 4. Cập nhật trạng thái thanh toán trên đơn
      await tx
        .update(orders)
        .set({
          paymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, data.orderId));

      // 5. Đồng bộ Sổ quỹ Kế toán
      const cashBookPaymentMethod = 
        data.paymentMethod === "bank_transfer" || data.paymentMethod === "card" || data.paymentMethod === "vnpay" || data.paymentMethod === "momo"
          ? "bank_transfer" 
          : "cash";

      const dateStrCB = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffixCB = Math.random().toString(36).substring(2, 6).toUpperCase();
      const entryNumber = `CB${dateStrCB}-${randomSuffixCB}`;

      await tx.insert(cashBookEntries).values({
        entryNumber,
        type: "income",
        category: "sales",
        amount: data.amount,
        runningBalance: "0",
        paymentMethod: cashBookPaymentMethod,
        referenceType: "order",
        referenceId: orderData.id,
        description: `Thu tiền thanh toán bổ sung cho đơn hàng ${orderData.orderNumber} - ${data.notes || ""}`,
        entryDate: new Date().toISOString().split("T")[0],
        createdBy: performedById,
      });

      await recalculateRunningBalances(tx);

      return { success: true, message: "Ghi nhận thanh toán bổ sung thành công", payment: newPayment };
    });
  } catch (error: any) {
    console.error("Lỗi ghi nhận thanh toán bổ sung:", error);
    return { success: false, message: error.message || "Không thể thanh toán đơn hàng" };
  }
}

// 8.5. Xác nhận giao hàng thành công cho đơn hàng online
export async function completeOnlineOrderAction(data: {
  orderId: string;
  amount: string; // Số tiền COD thu được thực tế
  paymentMethod: "cash" | "bank_transfer" | "card" | "momo" | "vnpay";
  referenceNumber?: string;
  notes?: string;
}) {
  try {
    const paymentAmount = Number(data.amount);
    if (isNaN(paymentAmount) || paymentAmount < 0) {
      return { success: false, message: "Số tiền thanh toán COD không hợp lệ" };
    }

    const result = await db.transaction(async (tx) => {
      // 1. Kiểm tra đơn hàng
      const order = await tx.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
      if (!order.length) throw new Error("Không tìm thấy đơn hàng");

      const orderData = order[0];
      if (orderData.status !== "processing") {
        throw new Error("Chỉ đơn hàng đang xử lý/đang giao mới có thể xác nhận giao thành công");
      }

      const totalAmount = Number(orderData.totalAmount);

      // 2. Tính tổng số tiền đã trả trước đó
      const existingPayments = await tx.select().from(payments).where(eq(payments.orderId, data.orderId));
      const totalPaidAlready = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Số tiền COD thực thu khi giao thành công chính là số tiền còn lại chưa thanh toán (đảm bảo hoàn thành = paid)
      const paymentAmount = Math.max(0, totalAmount - totalPaidAlready);
      const paymentStatus = "paid";

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      // 3. Thêm bản ghi thanh toán nếu paymentAmount > 0
      if (paymentAmount > 0) {
        await tx.insert(payments).values({
          orderId: data.orderId,
          amount: paymentAmount.toFixed(2),
          paymentMethod: data.paymentMethod,
          referenceNumber: data.referenceNumber || null,
          notes: data.notes || "Ghi nhận thanh toán COD khi giao thành công",
          createdBy: performedById,
        });

        // 4. Đồng bộ Sổ quỹ Kế toán
        const cashBookPaymentMethod = 
          data.paymentMethod === "bank_transfer" || data.paymentMethod === "card" || data.paymentMethod === "vnpay" || data.paymentMethod === "momo"
            ? "bank_transfer" 
            : "cash";

        const dateStrCB = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffixCB = Math.random().toString(36).substring(2, 6).toUpperCase();
        const entryNumber = `CB${dateStrCB}-${randomSuffixCB}`;

        await tx.insert(cashBookEntries).values({
          entryNumber,
          type: "income",
          category: "sales",
          amount: paymentAmount.toString(),
          runningBalance: "0",
          paymentMethod: cashBookPaymentMethod,
          referenceType: "order",
          referenceId: orderData.id,
          description: `Thu tiền COD đơn hàng ${orderData.orderNumber} khi giao thành công - ${data.notes || ""}`,
          entryDate: new Date().toISOString().split("T")[0],
          createdBy: performedById,
        });
      }

      // 5. Cập nhật trạng thái đơn hàng thành hoàn tất (completed)
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: "completed",
          paymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, data.orderId))
        .returning();

      // Tính lại balances sổ quỹ
      await recalculateRunningBalances(tx);

      // Lấy danh sách thiết bị để gửi thông báo hoàn tất
      const soldItemsDetails = await tx
        .select({
          serialNumber: inventoryItems.serialNumber,
          productName: products.name,
          sellingPrice: orderItems.sellingPrice,
        })
        .from(orderItems)
        .innerJoin(inventoryItems, eq(orderItems.inventoryItemId, inventoryItems.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, orderData.id));

      const itemsListStr = soldItemsDetails
        .map((item, idx) => `${idx + 1}. <b>${item.productName}</b>\n   • SN: <code>${item.serialNumber}</code>\n   • Giá: ${Math.round(Number(item.sellingPrice)).toLocaleString("vi-VN")}đ`)
        .join("\n");

      const customer = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, orderData.customerId))
        .limit(1);

      let customerName = "Khách hàng lẻ";
      let customerPhone = "";
      if (customer.length > 0) {
        customerName = customer[0].fullName;
        customerPhone = customer[0].phone || "";
      }

      return {
        success: true,
        message: `Đơn hàng ${orderData.orderNumber} đã giao thành công và hoàn tất`,
        order: updatedOrder,
        telegramData: {
          orderNumber: orderData.orderNumber,
          customerName,
          customerPhone,
          totalAmount: Math.round(totalAmount).toLocaleString("vi-VN") + "đ",
          paymentMethod: data.paymentMethod,
          itemsList: itemsListStr,
        }
      };
    });

    if (result.success && result.telegramData) {
      const payMethods: Record<string, string> = {
        cash: "Tiền mặt",
        bank_transfer: "Chuyển khoản",
        card: "Thẻ ngân hàng",
        momo: "Ví MoMo",
        vnpay: "Cổng VNPay",
      };

      after(() => {
        sendTelegramNotification("order_completed", {
          order_number: result.telegramData.orderNumber,
          customer_name: result.telegramData.customerName,
          customer_phone: result.telegramData.customerPhone,
          total_amount: result.telegramData.totalAmount,
          payment_method: payMethods[result.telegramData.paymentMethod] || result.telegramData.paymentMethod,
          items_list: result.telegramData.itemsList,
        }).catch((err) => console.error("Lỗi gửi thông báo Telegram đơn hàng hoàn tất:", err));
      });
    }

    return result;
  } catch (error: any) {
    console.error("Lỗi xác nhận giao hàng thành công:", error);
    return { success: false, message: error.message || "Không thể xác nhận giao hàng thành công" };
  }
}

// 8.7. Cập nhật thông tin vận chuyển của đơn hàng
export async function updateOrderShippingAction(data: {
  orderId: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  packingVideoUrl?: string;
  notes?: string;
}) {
  try {
    await db
      .update(orders)
      .set({
        trackingNumber: data.trackingNumber?.trim() || null,
        shippingCarrier: data.shippingCarrier?.trim() || null,
        packingVideoUrl: data.packingVideoUrl?.trim() || null,
        notes: data.notes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, data.orderId));

    return { success: true, message: "Cập nhật thông tin vận chuyển thành công" };
  } catch (error: any) {
    console.error("Lỗi cập nhật thông tin vận chuyển:", error);
    return { success: false, message: error.message || "Không thể cập nhật thông tin vận chuyển" };
  }
}

// 9. Lấy chi tiết đơn hàng (Sản phẩm, Thanh toán, Khách hàng)
export async function getOrderDetail(orderId: string) {
  try {
    const orderData = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        saleChannel: orders.saleChannel,
        subtotal: orders.subtotal,
        discountAmount: orders.discountAmount,
        taxAmount: orders.taxAmount,
        totalAmount: orders.totalAmount,
        totalCost: orders.totalCost,
        profit: orders.profit,
        profitMargin: orders.profitMargin,
        shippingAddress: orders.shippingAddress,
        notes: orders.notes,
        trackingNumber: orders.trackingNumber,
        shippingCarrier: orders.shippingCarrier,
        packingVideoUrl: orders.packingVideoUrl,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        customerAddress: customers.address,
        soldByName: profiles.fullName,
        leadSourceName: leadSources.name,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(profiles, eq(orders.soldBy, profiles.id))
      .leftJoin(leadSources, eq(orders.leadSourceId, leadSources.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) return null;

    // Lấy danh sách máy đã bán trong đơn
    const items = await db
      .select({
        id: orderItems.id,
        sellingPrice: orderItems.sellingPrice,
        costPrice: orderItems.costPrice,
        discount: orderItems.discount,
        profit: orderItems.profit,
        warrantyMonths: orderItems.warrantyMonths,
        serialNumber: inventoryItems.serialNumber,
        productName: products.name,
        productSku: products.sku,
        productSpecs: products.specs,
        status: inventoryItems.status,
      })
      .from(orderItems)
      .innerJoin(inventoryItems, eq(orderItems.inventoryItemId, inventoryItems.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    // Lấy lịch sử thanh toán của đơn
    const orderPayments = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paymentDate: payments.paymentDate,
        referenceNumber: payments.referenceNumber,
        notes: payments.notes,
        createdByName: profiles.fullName,
      })
      .from(payments)
      .leftJoin(profiles, eq(payments.createdBy, profiles.id))
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.paymentDate));

    // Lấy lịch sử đổi trả hoàn tiền
    const orderReturns = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        type: returns.type,
        reason: returns.reason,
        status: returns.status,
        refundAmount: returns.refundAmount,
        createdAt: returns.createdAt,
        processedByName: profiles.fullName,
      })
      .from(returns)
      .leftJoin(profiles, eq(returns.processedBy, profiles.id))
      .where(eq(returns.orderId, orderId))
      .orderBy(desc(returns.createdAt));

    return {
      order: orderData[0],
      items,
      payments: orderPayments,
      returns: orderReturns,
    };
  } catch (error) {
    console.error("Lỗi lấy chi tiết đơn hàng:", error);
    return null;
  }
}


