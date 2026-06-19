"use server";

import { db, recalculateRunningBalances } from "@/lib/db";
import { 
  quotations, 
  quotationItems, 
  customers, 
  products, 
  inventoryItems, 
  orders, 
  orderItems,
  inventoryMovements,
  cashBookEntries,
  profiles,
  telegramSettings,
  payments
} from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// 1. Lấy danh sách báo giá
export async function getQuotationsList() {
  try {
    const list = await db
      .select({
        id: quotations.id,
        quoteNumber: quotations.quoteNumber,
        shareToken: quotations.shareToken,
        status: quotations.status,
        subtotal: quotations.subtotal,
        discountAmount: quotations.discountAmount,
        totalAmount: quotations.totalAmount,
        validUntil: quotations.validUntil,
        notes: quotations.notes,
        viewCount: quotations.viewCount,
        lastViewedAt: quotations.lastViewedAt,
        createdAt: quotations.createdAt,
        customerName: quotations.customerName,
        customerPhone: quotations.customerPhone,
        customerId: quotations.customerId,
        dbCustomerName: customers.fullName,
        dbCustomerPhone: customers.phone,
        creatorName: profiles.fullName,
        convertedOrderId: quotations.convertedOrderId,
        convertedOrderNumber: orders.orderNumber,
      })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(profiles, eq(quotations.createdBy, profiles.id))
      .leftJoin(orders, eq(quotations.convertedOrderId, orders.id))
      .orderBy(desc(quotations.createdAt));

    return list.map(q => ({
      ...q,
      customerName: q.customerId ? q.dbCustomerName : q.customerName,
      customerPhone: q.customerId ? q.dbCustomerPhone : q.customerPhone,
    }));
  } catch (error) {
    console.error("Lỗi lấy danh sách báo giá:", error);
    return [];
  }
}

// 2. Tạo báo giá mới
export async function createQuotation(data: {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  leadSourceId?: string;
  discountAmount: string;
  validUntil?: string;
  notes?: string;
  internalNotes?: string;
  items: {
    productId: string;
    inventoryItemId?: string;
    quotedPrice: string;
    notes?: string;
  }[];
}) {
  try {
    return await db.transaction(async (tx) => {
      // A. Tạo mã báo giá duy nhất
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const quoteNumber = `QT-${dateStr}-${randomSuffix}`;

      // B. Sinh share token ngẫu nhiên bảo mật
      const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      // Lấy người tạo
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const createdById = ownerProfiles[0]?.id;
      if (!createdById) throw new Error("Hệ thống chưa có tài khoản nhân viên");

      // C. Tính toán tổng tiền
      let subtotalVal = 0;
      data.items.forEach(item => {
        subtotalVal += Number(item.quotedPrice || 0);
      });
      const discVal = Number(data.discountAmount || 0);
      const totalAmountVal = Math.max(0, subtotalVal - discVal);

      // D. Insert bảng quotations
      const [newQuote] = await tx
        .insert(quotations)
        .values({
          quoteNumber,
          shareToken,
          customerId: data.customerId || null,
          customerName: data.customerId ? null : (data.customerName || null),
          customerPhone: data.customerId ? null : (data.customerPhone || null),
          leadSourceId: data.leadSourceId || null,
          status: "draft",
          subtotal: subtotalVal.toString(),
          discountAmount: data.discountAmount,
          totalAmount: totalAmountVal.toString(),
          validUntil: data.validUntil || null,
          notes: data.notes || null,
          internalNotes: data.internalNotes || null,
          createdBy: createdById,
        })
        .returning();

      // E. Insert bảng quotation_items
      for (const item of data.items) {
        await tx.insert(quotationItems).values({
          quotationId: newQuote.id,
          productId: item.productId,
          inventoryItemId: item.inventoryItemId || null,
          quotedPrice: item.quotedPrice,
          notes: item.notes || null,
        });
      }

      return { success: true, message: "Tạo báo giá thành công", quotation: newQuote };
    });
  } catch (error: any) {
    console.error("Lỗi tạo báo giá:", error);
    return { success: false, message: error.message || "Lỗi tạo báo giá" };
  }
}

// 3. Lấy báo giá theo token chia sẻ (Public View - Bypass Auth)
export async function getQuotationByToken(token: string) {
  try {
    const cleanToken = token.trim();
    if (!cleanToken) return { success: false, message: "Mã token không hợp lệ" };

    const quoteQuery = await db
      .select({
        id: quotations.id,
        quoteNumber: quotations.quoteNumber,
        status: quotations.status,
        subtotal: quotations.subtotal,
        discountAmount: quotations.discountAmount,
        totalAmount: quotations.totalAmount,
        validUntil: quotations.validUntil,
        notes: quotations.notes,
        createdAt: quotations.createdAt,
        customerId: quotations.customerId,
        customerName: quotations.customerName,
        customerPhone: quotations.customerPhone,
        dbCustomerName: customers.fullName,
        dbCustomerPhone: customers.phone,
        dbCustomerAddress: customers.address,
        creatorName: profiles.fullName,
      })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(profiles, eq(quotations.createdBy, profiles.id))
      .where(eq(quotations.shareToken, cleanToken))
      .limit(1);

    if (quoteQuery.length === 0) {
      return { success: false, message: "Không tìm thấy báo giá hoặc đường dẫn đã hết hiệu lực" };
    }

    const quotation = quoteQuery[0];

    // Lấy chi tiết báo giá
    const items = await db
      .select({
        id: quotationItems.id,
        productId: quotationItems.productId,
        quotedPrice: quotationItems.quotedPrice,
        notes: quotationItems.notes,
        productName: products.name,
        productSpecs: products.specs,
        productSku: products.sku,
        serialNumber: inventoryItems.serialNumber,
        itemImages: inventoryItems.images,
        productImages: products.images,
      })
      .from(quotationItems)
      .innerJoin(products, eq(quotationItems.productId, products.id))
      .leftJoin(inventoryItems, eq(quotationItems.inventoryItemId, inventoryItems.id))
      .where(eq(quotationItems.quotationId, quotation.id));

    // Lấy thông tin cấu hình cửa hàng & thanh toán VietQR
    const storeSettingsQuery = await db.select().from(telegramSettings).limit(1);
    const storeSettings = storeSettingsQuery.length > 0 ? storeSettingsQuery[0] : null;

    return {
      success: true,
      quotation: {
        ...quotation,
        customerName: quotation.customerId ? quotation.dbCustomerName : quotation.customerName,
        customerPhone: quotation.customerId ? quotation.dbCustomerPhone : quotation.customerPhone,
        customerAddress: quotation.customerId ? quotation.dbCustomerAddress : "N/A",
      },
      items,
      storeSettings,
    };
  } catch (error: any) {
    console.error("Lỗi lấy báo giá theo token:", error);
    return { success: false, message: "Lỗi tải dữ liệu báo giá" };
  }
}

// 4. Ghi nhận lượt xem báo giá (Client opened link)
export async function incrementQuotationViewCount(id: string) {
  try {
    const existing = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
    if (existing.length === 0) return { success: false };

    const q = existing[0];
    const newCount = q.viewCount + 1;
    
    // Nếu trạng thái đang là 'draft', tự động chuyển sang 'sent' hoặc 'viewed'
    const newStatus = q.status === "draft" ? "viewed" : q.status;

    await db
      .update(quotations)
      .set({
        viewCount: newCount,
        lastViewedAt: new Date(),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id));

    return { success: true };
  } catch (error) {
    console.error("Lỗi tăng lượt xem báo giá:", error);
    return { success: false };
  }
}

// 5. Khách phản hồi Duyệt/Từ chối trực tuyến
export async function updateQuotationStatus(id: string, status: "accepted" | "rejected") {
  try {
    await db
      .update(quotations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, id));

    return { success: true, message: `Đã phản hồi trạng thái: ${status === "accepted" ? "Duyệt" : "Từ chối"}` };
  } catch (error: any) {
    console.error("Lỗi cập nhật phản hồi:", error);
    return { success: false, message: "Không thể ghi nhận phản hồi" };
  }
}

// 6. Chuyển đổi báo giá thành Đơn bán lẻ chính thức (1-Click Convert to Order)
// export async function convertQuotationToOrder(
//   quotationId: string,
//   data: {
//     initialPaymentAmount: string;
//     paymentMethod: "cash" | "bank_transfer" | "card";
//   }
// ) {
//   try {
//     return await db.transaction(async (tx) => {
//       // A. Truy vấn thông tin báo giá gốc
//       const quoteQuery = await tx
//         .select()
//         .from(quotations)
//         .where(eq(quotations.id, quotationId))
//         .limit(1);

//       if (quoteQuery.length === 0) throw new Error("Không tìm thấy báo giá gốc");
//       const quote = quoteQuery[0];
//       if (quote.status === "converted") throw new Error("Báo giá này đã được chuyển thành đơn hàng trước đó");

//       // B. Lấy các item trong báo giá
//       const quoteItemsQuery = await tx
//         .select()
//         .from(quotationItems)
//         .where(eq(quotationItems.quotationId, quotationId));

//       if (quoteItemsQuery.length === 0) throw new Error("Báo giá không có mặt hàng nào");

//       // Lấy profile thực hiện
//       const ownerProfiles = await tx.select().from(profiles).limit(1);
//       const processedById = ownerProfiles[0]?.id;
//       if (!processedById) throw new Error("Hệ thống chưa có tài khoản nhân viên");

//       // C. Lấy hoặc tạo khách hàng trong bảng customers
//       let customerId = quote.customerId;
//       if (!customerId) {
//         // Tạo khách hàng mới tự động nếu chưa có trong DB
//         const [newCust] = await tx
//           .insert(customers)
//           .values({
//             fullName: quote.customerName || "Khách mua báo giá lẻ",
//             phone: quote.customerPhone || "0000000000",
//             customerType: "individual",
//             leadSourceId: quote.leadSourceId || null,
//           })
//           .returning();
//         customerId = newCust.id;
//       }

//       // D. Tìm máy sẵn có trong kho (in_stock) cho từng sản phẩm trong báo giá
//       const itemsToOrder = [];
//       let totalCostVal = 0;

//       for (const item of quoteItemsQuery) {
//         let selectedItem;

//         if (item.inventoryItemId) {
//           // Nếu báo giá chọn đích danh chiếc máy (theo Serial)
//           const invQuery = await tx
//             .select()
//             .from(inventoryItems)
//             .where(
//               and(
//                 eq(inventoryItems.id, item.inventoryItemId),
//                 eq(inventoryItems.status, "in_stock")
//               )
//             )
//             .limit(1);

//           if (invQuery.length === 0) {
//             // Tìm serial bị thiếu
//             const itemDetails = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, item.inventoryItemId)).limit(1);
//             throw new Error(`Chiếc máy có Serial "${itemDetails[0]?.serialNumber || 'N/A'}" đã không còn trong kho (Đã bán hoặc đang bảo hành)`);
//           }
//           selectedItem = invQuery[0];
//         } else {
//           // Nếu báo giá chỉ chọn Model chung, tự động bốc 1 chiếc có trạng thái in_stock trong kho
//           const invQuery = await tx
//             .select()
//             .from(inventoryItems)
//             .where(
//               and(
//                 eq(inventoryItems.productId, item.productId),
//                 eq(inventoryItems.status, "in_stock")
//               )
//             )
//             .limit(1);

//           if (invQuery.length === 0) {
//             const prodDetails = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
//             throw new Error(`Sản phẩm "${prodDetails[0]?.name || 'N/A'}" đã hết sạch hàng sẵn trong kho`);
//           }
//           selectedItem = invQuery[0];
//         }

//         itemsToOrder.push({
//           quoteItemId: item.id,
//           inventoryItemId: selectedItem.id,
//           productId: item.productId,
//           quotedPrice: item.quotedPrice,
//           costPrice: selectedItem.costPrice,
//           serialNumber: selectedItem.serialNumber,
//         });

//         totalCostVal += Number(selectedItem.costPrice || 0);
//       }

//       // E. Tạo mã đơn hàng mới
//       const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
//       const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
//       const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

//       const subtotalVal = Number(quote.subtotal);
//       const discountVal = Number(quote.discountAmount || 0);
//       const totalAmountVal = Number(quote.totalAmount);

//       // F. Insert đơn bán hàng (Orders)
//       const [newOrder] = await tx
//         .insert(orders)
//         .values({
//           orderNumber,
//           customerId: customerId,
//           leadSourceId: quote.leadSourceId || null,
//           status: "completed",
//           saleChannel: "offline",
//           subtotal: subtotalVal.toString(),
//           discountAmount: discountVal.toString(),
//           taxAmount: "0",
//           totalAmount: totalAmountVal.toString(),
//           totalCost: totalCostVal.toString(),
//           paymentStatus: Number(data.initialPaymentAmount || 0) >= totalAmountVal ? "paid" : (Number(data.initialPaymentAmount || 0) > 0 ? "partial" : "unpaid"),
//           paymentMethod: data.paymentMethod,
//           soldBy: processedById,
//           notes: `[Đồng bộ Báo giá] Chuyển đổi tự động từ báo giá ${quote.quoteNumber}`,
//         })
//         .returning();

//       // G. Insert chi tiết đơn hàng & Cập nhật trạng thái máy
//       for (const io of itemsToOrder) {
//         const itemSellingPrice = Number(io.quotedPrice);
//         const itemCostPrice = Number(io.costPrice);
//         const itemProfit = itemSellingPrice - itemCostPrice;

//         // 1. Thêm order item
//         await tx.insert(orderItems).values({
//           orderId: newOrder.id,
//           inventoryItemId: io.inventoryItemId,
//           productId: io.productId,
//           sellingPrice: io.quotedPrice,
//           costPrice: io.costPrice,
//           discount: "0",
//           warrantyMonths: 12, // Mặc định 12 tháng
//         });

//         // 2. Chuyển trạng thái máy sang sold
//         await tx
//           .update(inventoryItems)
//           .set({
//             status: "sold",
//             soldDate: new Date().toISOString().split("T")[0],
//             warrantyStart: new Date().toISOString().split("T")[0],
//             warrantyEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0], // Bảo hành 1 năm
//             updatedAt: new Date(),
//           })
//           .where(eq(inventoryItems.id, io.inventoryItemId));

//         // 3. Ghi nhận thẻ kho
//         await tx.insert(inventoryMovements).values({
//           inventoryItemId: io.inventoryItemId,
//           movementType: "sold",
//           fromStatus: "in_stock",
//           toStatus: "sold",
//           referenceType: "manual",
//           referenceId: newOrder.id,
//           quantityChange: -1,
//           performedBy: processedById,
//           notes: `Bán máy tự động chuyển đổi từ báo giá ${quote.quoteNumber}. Đơn hàng: ${orderNumber}`,
//         });
//       }

//       // H. Hạch toán dòng tiền Sổ quỹ (nếu khách hàng thanh toán trước/cọc tiền)
//       const payVal = Number(data.initialPaymentAmount || 0);
//       if (payVal > 0) {
//         const randomSuffixCB = Math.random().toString(36).substring(2, 6).toUpperCase();
//         const entryNumber = `CB${dateStr}-${randomSuffixCB}`;

//         await tx.insert(cashBookEntries).values({
//           entryNumber,
//           type: "income",
//           category: "sales",
//           amount: payVal.toString(),
//           runningBalance: "0",
//           paymentMethod: data.paymentMethod,
//           referenceType: "order",
//           referenceId: newOrder.id,
//           description: `[Đồng bộ Báo giá] Thu tiền thanh toán đơn hàng ${orderNumber} (Đổi từ báo giá ${quote.quoteNumber})`,
//           entryDate: new Date().toISOString().split("T")[0],
//           createdBy: processedById,
//         });

//         // Tính toán lại toàn bộ số dư lũy kế sổ quỹ
//         await recalculateRunningBalances(tx);
//       }

//       // I. Cập nhật trạng thái báo giá gốc
//       await tx
//         .update(quotations)
//         .set({
//           status: "converted",
//           convertedOrderId: newOrder.id,
//           updatedAt: new Date(),
//         })
//         .where(eq(quotations.id, quotationId));

//       return { success: true, message: `Chuyển đổi thành công. Tạo đơn hàng ${orderNumber}!`, order: newOrder };
//     });
//   } catch (error: any) {
//     console.error("Lỗi chuyển đổi báo giá sang đơn hàng:", error);
//     return { success: false, message: error.message || "Lỗi chuyển đổi báo giá" };
//   }
// }

// 6. Chuyển đổi báo giá thành Đơn bán lẻ chính thức (1-Click Convert to Order)
export async function convertQuotationToOrder(
  quotationId: string,
  data: {
    initialPaymentAmount: string;
    paymentMethod: "cash" | "bank_transfer" | "card";
  }
) {
  try {
    return await db.transaction(async (tx) => {
      // A. Truy vấn thông tin báo giá gốc
      const quoteQuery = await tx
        .select()
        .from(quotations)
        .where(eq(quotations.id, quotationId))
        .limit(1);

      if (quoteQuery.length === 0) throw new Error("Không tìm thấy báo giá gốc");
      const quote = quoteQuery[0];
      if (quote.status === "converted") throw new Error("Báo giá này đã được chuyển thành đơn hàng trước đó");

      // B. Lấy các item trong báo giá
      const quoteItemsQuery = await tx
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, quotationId));

      if (quoteItemsQuery.length === 0) throw new Error("Báo giá không có mặt hàng nào");

      // Lấy profile thực hiện
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const processedById = ownerProfiles[0]?.id;
      if (!processedById) throw new Error("Hệ thống chưa có tài khoản nhân viên");

      // C. Lấy hoặc tạo khách hàng trong bảng customers
      let customerId = quote.customerId;
      if (!customerId) {
        // Tạo khách hàng mới tự động nếu chưa có trong DB
        const [newCust] = await tx
          .insert(customers)
          .values({
            fullName: quote.customerName || "Khách mua báo giá lẻ",
            phone: quote.customerPhone || "0000000000",
            customerType: "individual",
            leadSourceId: quote.leadSourceId || null,
          })
          .returning();
        customerId = newCust.id;
      }

      // D. Tìm máy sẵn có trong kho (in_stock) cho từng sản phẩm trong báo giá
      const itemsToOrder = [];
      let totalCostVal = 0;

      for (const item of quoteItemsQuery) {
        let selectedItem;

        if (item.inventoryItemId) {
          // Nếu báo giá chọn đích danh chiếc máy (theo Serial)
          const invQuery = await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.id, item.inventoryItemId),
                eq(inventoryItems.status, "in_stock")
              )
            )
            .limit(1);

          if (invQuery.length === 0) {
            // Tìm serial bị thiếu
            const itemDetails = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, item.inventoryItemId)).limit(1);
            throw new Error(`Chiếc máy có Serial "${itemDetails[0]?.serialNumber || 'N/A'}" đã không còn trong kho (Đã bán hoặc đang bảo hành)`);
          }
          selectedItem = invQuery[0];
        } else {
          // Nếu báo giá chỉ chọn Model chung, tự động bốc 1 chiếc có trạng thái in_stock trong kho
          const invQuery = await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.productId, item.productId),
                eq(inventoryItems.status, "in_stock")
              )
            )
            .limit(1);

          if (invQuery.length === 0) {
            const prodDetails = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
            throw new Error(`Sản phẩm "${prodDetails[0]?.name || 'N/A'}" đã hết sạch hàng sẵn trong kho`);
          }
          selectedItem = invQuery[0];
        }

        itemsToOrder.push({
          quoteItemId: item.id,
          inventoryItemId: selectedItem.id,
          productId: item.productId,
          quotedPrice: item.quotedPrice,
          costPrice: selectedItem.costPrice,
          serialNumber: selectedItem.serialNumber,
        });

        totalCostVal += Number(selectedItem.costPrice || 0);
      }

      // E. Tạo mã đơn hàng mới
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNumber = `ORD-${dateStr}-${randomSuffix}`;

      const subtotalVal = Number(quote.subtotal);
      const discountVal = Number(quote.discountAmount || 0);
      const totalAmountVal = Number(quote.totalAmount);

      // F. Insert đơn bán hàng (Orders)
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerId: customerId,
          leadSourceId: quote.leadSourceId || null,
          status: "completed",
          saleChannel: "offline",
          subtotal: subtotalVal.toString(),
          discountAmount: discountVal.toString(),
          taxAmount: "0",
          totalAmount: totalAmountVal.toString(),
          totalCost: totalCostVal.toString(),
          paymentStatus: "paid",
          paymentMethod: data.paymentMethod,
          soldBy: processedById,
          notes: `[Đồng bộ Báo giá] Chuyển đổi tự động từ báo giá ${quote.quoteNumber}`,
        })
        .returning();

      // G. Insert chi tiết đơn hàng & Cập nhật trạng thái máy
      for (const io of itemsToOrder) {
        // 1. Thêm order item
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          inventoryItemId: io.inventoryItemId,
          productId: io.productId,
          sellingPrice: io.quotedPrice,
          costPrice: io.costPrice,
          discount: "0",
          warrantyMonths: 12, // Mặc định 12 tháng
        });

        // 2. Chuyển trạng thái máy sang sold
        await tx
          .update(inventoryItems)
          .set({
            status: "sold",
            soldDate: new Date().toISOString().split("T")[0],
            warrantyStart: new Date().toISOString().split("T")[0],
            warrantyEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0], // Bảo hành 1 năm
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, io.inventoryItemId));

        // 3. Ghi nhận thẻ kho
        await tx.insert(inventoryMovements).values({
          inventoryItemId: io.inventoryItemId,
          movementType: "sold",
          fromStatus: "in_stock",
          toStatus: "sold",
          referenceType: "manual",
          referenceId: newOrder.id,
          quantityChange: -1,
          performedBy: processedById,
          notes: `Bán máy tự động chuyển đổi từ báo giá ${quote.quoteNumber}. Đơn hàng: ${orderNumber}`,
        });
      }

      // H. Ghi nhận lịch sử thanh toán & hạch toán dòng tiền Sổ quỹ đầy đủ trị giá đơn hàng
      const randomSuffixCB = Math.random().toString(36).substring(2, 6).toUpperCase();
      const entryNumber = `CB${dateStr}-${randomSuffixCB}`;

      // 1. Thêm bản ghi thanh toán
      await tx.insert(payments).values({
        orderId: newOrder.id,
        amount: totalAmountVal.toFixed(2),
        paymentMethod: data.paymentMethod,
        notes: `[Đồng bộ Báo giá] Thanh toán đơn hàng chuyển đổi từ báo giá ${quote.quoteNumber}`,
        createdBy: processedById,
      });

      // 2. Đồng bộ Sổ quỹ Kế toán
      await tx.insert(cashBookEntries).values({
        entryNumber,
        type: "income",
        category: "sales",
        amount: totalAmountVal.toString(),
        runningBalance: "0", // Tính lại ngay bên dưới
        paymentMethod: data.paymentMethod,
        referenceType: "order",
        referenceId: newOrder.id,
        description: `[Đồng bộ Báo giá] Thu tiền thanh toán đơn hàng ${orderNumber} (Đổi từ báo giá ${quote.quoteNumber})`,
        entryDate: new Date().toISOString().split("T")[0],
        createdBy: processedById,
      });

      // Tính toán lại toàn bộ số dư lũy kế sổ quỹ
      await recalculateRunningBalances(tx);

      // I. Bơm doanh thu và đơn hàng vào hồ sơ Khách hàng (VÁ LỖI Ở ĐÂY)
      await tx
        .update(customers)
        .set({
          orderCount: sql`${customers.orderCount} + 1`,
          totalSpent: sql`${customers.totalSpent} + ${totalAmountVal}`,
        })
        .where(eq(customers.id, customerId));

      // J. Cập nhật trạng thái báo giá gốc
      await tx
        .update(quotations)
        .set({
          status: "converted",
          convertedOrderId: newOrder.id,
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, quotationId));

      return { success: true, message: `Chuyển đổi thành công. Tạo đơn hàng ${orderNumber}!`, order: newOrder };
    });
  } catch (error: any) {
    console.error("Lỗi chuyển đổi báo giá sang đơn hàng:", error);
    return { success: false, message: error.message || "Lỗi chuyển đổi báo giá" };
  }
}

