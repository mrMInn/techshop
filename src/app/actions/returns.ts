"use server";

import { db, recalculateRunningBalances } from "@/lib/db";
import { after } from "next/server";
import { invalidateDashboardCache } from "@/lib/cache";
import { 
  returns, 
  returnItems, 
  orders, 
  customers, 
  inventoryItems, 
  products,
  profiles,
  inventoryMovements,
  cashBookEntries,
  orderItems,
  accessoryItems,
  warrantyClaims,
  warrantyLogs
} from "@/lib/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export async function getReturnsList() {
  try {
    const list = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        type: returns.type,
        reason: returns.reason,
        status: returns.status,
        hasFee: returns.hasFee,
        feeAmount: returns.feeAmount,
        refundAmount: returns.refundAmount,
        exchangeDifference: returns.exchangeDifference,
        createdAt: returns.createdAt,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        orderNumber: orders.orderNumber,
      })
      .from(returns)
      .innerJoin(customers, eq(returns.customerId, customers.id))
      .innerJoin(orders, eq(returns.orderId, orders.id))
      .orderBy(desc(returns.createdAt));

    return list;
  } catch (error) {
    console.error("Lỗi lấy danh sách đổi trả:", error);
    return [];
  }
}

export async function createReturn(data: {
  orderId: string;
  customerId: string;
  type: 'return' | 'exchange';
  reason: 'defective' | 'wrong_item' | 'changed_mind' | 'upgrade' | 'downgrade' | 'other';
  reasonDetail: string;
  hasFee: boolean;
  feeAmount: string;
  refundAmount: string;
  exchangeDifference: string;
  notes?: string;
  returnedAccessoryIds?: string[];
  items: {
    inventoryItemId: string;
    productId: string;
    returnReason: 'defective' | 'cosmetic' | 'wrong_specs' | 'customer_request' | 'other';
    conditionOnReturn: 'like_new' | 'good' | 'damaged' | 'defective';
    isDefective: boolean;
    defectDescription?: string;
    originalPrice: string;
    refundPrice: string;
    newInventoryItemId?: string;
    newSellingPrice?: string;
  }[];
}) {
  try {
    return await db.transaction(async (tx) => {
      // 0. Kiểm tra ngày tháng so với đơn hàng gốc
      const orderData = await tx.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
      if (!orderData.length) throw new Error("Không tìm thấy đơn hàng gốc");
      const orderDateStr = orderData[0].createdAt 
        ? new Date(orderData[0].createdAt).toISOString().split("T")[0] 
        : new Date().toISOString().split("T")[0];
      const todayStr = new Date().toISOString().split("T")[0];
      if (todayStr < orderDateStr) {
        throw new Error(`Ngày đổi trả (${todayStr}) không thể trước ngày mua hàng (${orderDateStr})`);
      }

      // 1. Tạo returnNumber duy nhất
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const returnNumber = `RET-${dateStr}-${randomSuffix}`;

      // Lấy người tạo
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const processedById = ownerProfiles[0]?.id;
      if (!processedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      // Kiểm tra trạng thái máy cũ & máy mới (nếu có)
      for (const item of data.items) {
        const oldMachine = await tx
          .select({
            status: inventoryItems.status,
            serialNumber: inventoryItems.serialNumber,
          })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, item.inventoryItemId))
          .limit(1);

        if (oldMachine.length === 0) {
          throw new Error(`Không tìm thấy sản phẩm cần trả (ID: ${item.inventoryItemId})`);
        }

        if (oldMachine[0].status !== 'sold' && oldMachine[0].status !== 'warranty_repair') {
          throw new Error(`Sản phẩm (SN: ${oldMachine[0].serialNumber}) không ở trạng thái đã bán hoặc bảo hành, không thể đổi trả`);
        }

        // Tự động đóng các phiếu bảo hành đang chạy của sản phẩm này
        if (oldMachine[0].status === 'warranty_repair') {
          const activeClaims = await tx
            .select()
            .from(warrantyClaims)
            .where(
              and(
                eq(warrantyClaims.inventoryItemId, item.inventoryItemId),
                inArray(warrantyClaims.status, ['pending', 'inspecting', 'repairing', 'waiting_parts'])
              )
            );

          for (const claim of activeClaims) {
            await tx
              .update(warrantyClaims)
              .set({
                status: 'replaced',
                resolution: `Đóng tự động do khách hàng đổi trả hàng/hoàn tiền theo phiếu ${returnNumber}`,
                actualReturnDate: new Date().toISOString().split('T')[0],
                updatedAt: new Date(),
              })
              .where(eq(warrantyClaims.id, claim.id));

            await tx.insert(warrantyLogs).values({
              warrantyClaimId: claim.id,
              action: 'Đóng do trả hàng',
              description: `Phiếu bảo hành được đóng tự động do thiết bị được hoàn trả theo phiếu đổi trả ${returnNumber}`,
              oldStatus: claim.status,
              newStatus: 'replaced',
              createdBy: processedById,
            });
          }
        }

        if (data.type === 'exchange' && item.newInventoryItemId) {
          const newMachine = await tx
            .select({
              status: inventoryItems.status,
              serialNumber: inventoryItems.serialNumber,
            })
            .from(inventoryItems)
            .where(eq(inventoryItems.id, item.newInventoryItemId))
            .limit(1);

          if (newMachine.length === 0) {
            throw new Error(`Không tìm thấy máy mới có ID: ${item.newInventoryItemId} trong kho`);
          }

          if (newMachine[0].status !== 'in_stock') {
            throw new Error(`Máy mới (SN: ${newMachine[0].serialNumber}) đã được bán hoặc không còn sẵn trong kho`);
          }
        }
      }

      // 2. Tạo phiếu Đổi/Trả
      const [newReturn] = await tx
        .insert(returns)
        .values({
          returnNumber,
          orderId: data.orderId,
          customerId: data.customerId,
          type: data.type,
          reason: data.reason,
          reasonDetail: data.reasonDetail,
          status: "completed", // Tạm thời set completed sau khi làm xong form
          hasFee: data.hasFee,
          feeAmount: data.feeAmount,
          refundAmount: data.refundAmount,
          exchangeDifference: data.exchangeDifference,
          notes: data.notes || null,
          processedBy: processedById,
        })
        .returning();

      // 3. Nghiệp vụ Sổ quỹ (Cashbook entries)
      const refundVal = Number(data.refundAmount || 0); // Thực hoàn khách
      const feeVal = Number(data.feeAmount || 0);       // Phí dịch vụ thu được
      
      const originalOrder = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, data.orderId))
        .limit(1);
      
      const mappedMethod = originalOrder[0]?.paymentMethod || 'cash';
      const cashBookPaymentMethod = 
        mappedMethod === "bank_transfer" || mappedMethod === "card" 
          ? mappedMethod 
          : "cash";

      const dateStrCB = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      let needRecalc = false;

      if (data.type === 'return') {
        // A. Nếu có phí dịch vụ thu được, hạch toán dòng THU QUỸ (Income)
        if (data.hasFee && feeVal > 0) {
          const randomSuffixCB1 = Math.random().toString(36).substring(2, 6).toUpperCase();
          const entryNumber1 = `CB${dateStrCB}-${randomSuffixCB1}`;

          await tx.insert(cashBookEntries).values({
            entryNumber: entryNumber1,
            type: "income",
            category: "other",
            amount: feeVal.toString(),
            runningBalance: "0",
            paymentMethod: cashBookPaymentMethod,
            referenceType: "other",
            referenceId: newReturn.id,
            description: `[Đồng bộ] Thu phí dịch vụ đổi trả (máy không lỗi) - Phiếu: ${returnNumber}`,
            entryDate: new Date().toISOString().split("T")[0],
            createdBy: processedById,
          });
          
          needRecalc = true;
        }

        // B. Hạch toán dòng CHI QUỸ (Expense) hoàn trả giá trị máy gốc cho khách
        const totalOriginalPrice = refundVal + feeVal; // e.g. 18.500.000đ
        if (totalOriginalPrice > 0) {
          const randomSuffixCB2 = Math.random().toString(36).substring(2, 6).toUpperCase();
          const entryNumber2 = `CB${dateStrCB}-${randomSuffixCB2}`;

          await tx.insert(cashBookEntries).values({
            entryNumber: entryNumber2,
            type: "expense",
            category: "other",
            amount: totalOriginalPrice.toString(),
            runningBalance: "0",
            paymentMethod: cashBookPaymentMethod,
            referenceType: "other",
            referenceId: newReturn.id,
            description: `[Đồng bộ] Chi hoàn giá trị sản phẩm từ phiếu Đổi/Trả ${returnNumber}`,
            entryDate: new Date().toISOString().split("T")[0],
            createdBy: processedById,
          });

          needRecalc = true;
        }
      } else {
        // C. Nghiệp vụ Đổi hàng (Exchange)
        // Hạch toán chênh lệch (Thu quỹ nếu > 0, Chi quỹ nếu < 0)
        const exchangeDiff = Number(data.exchangeDifference || 0);
        if (exchangeDiff > 0) {
          const randomSuffixCB1 = Math.random().toString(36).substring(2, 6).toUpperCase();
          const entryNumber1 = `CB${dateStrCB}-${randomSuffixCB1}`;

          await tx.insert(cashBookEntries).values({
            entryNumber: entryNumber1,
            type: "income",
            category: "other",
            amount: exchangeDiff.toString(),
            runningBalance: "0",
            paymentMethod: cashBookPaymentMethod,
            referenceType: "other",
            referenceId: newReturn.id,
            description: `[Đồng bộ] Thu chênh lệch đổi máy mới - Phiếu: ${returnNumber}`,
            entryDate: new Date().toISOString().split("T")[0],
            createdBy: processedById,
          });
          needRecalc = true;
        } else if (exchangeDiff < 0) {
          const randomSuffixCB2 = Math.random().toString(36).substring(2, 6).toUpperCase();
          const entryNumber2 = `CB${dateStrCB}-${randomSuffixCB2}`;

          await tx.insert(cashBookEntries).values({
            entryNumber: entryNumber2,
            type: "expense",
            category: "other",
            amount: Math.abs(exchangeDiff).toString(),
            runningBalance: "0",
            paymentMethod: cashBookPaymentMethod,
            referenceType: "other",
            referenceId: newReturn.id,
            description: `[Đồng bộ] Chi hoàn tiền chênh lệch đổi máy mới - Phiếu: ${returnNumber}`,
            entryDate: new Date().toISOString().split("T")[0],
            createdBy: processedById,
          });
          needRecalc = true;
        }
      }

      // 4. Xử lý từng item bị trả lại
      for (const item of data.items) {
        await tx.insert(returnItems).values({
          returnId: newReturn.id,
          inventoryItemId: item.inventoryItemId,
          productId: item.productId,
          returnReason: item.returnReason,
          conditionOnReturn: item.conditionOnReturn,
          isDefective: item.isDefective,
          defectDescription: item.defectDescription || null,
          originalPrice: item.originalPrice,
          refundPrice: item.refundPrice,
          newInventoryItemId: item.newInventoryItemId || null,
        });

        // 5. Nhập lại kho máy cũ
        let newInvStatus: 'in_stock' | 'defective' | 'returned' = 'in_stock';
        if (item.isDefective || item.conditionOnReturn === 'defective') {
          newInvStatus = 'defective';
        }

        // Lấy các phụ kiện được bán kèm với máy này (trạng thái đang là sold và được liên kết với máy)
        const machineAccessories = await tx
          .select()
          .from(accessoryItems)
          .where(and(eq(accessoryItems.inventoryItemId, item.inventoryItemId), eq(accessoryItems.status, 'sold')));

        let totalDeduction = 0;
        const returnedAccessoryIds = data.returnedAccessoryIds || [];

        for (const acc of machineAccessories) {
          const isAccReturned = returnedAccessoryIds.includes(acc.id);
          const newStatus = isAccReturned ? 'in_stock' : 'sold';
          
          await tx
            .update(accessoryItems)
            .set({
              status: newStatus,
              inventoryItemId: null, // unlink in both cases
              updatedAt: new Date(),
            })
            .where(eq(accessoryItems.id, acc.id));

          totalDeduction += Number(acc.unitCost);
        }

        // Load machine's current costPrice to reduce it by totalDeduction
        const currentMachine = await tx
          .select({ costPrice: inventoryItems.costPrice })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, item.inventoryItemId))
          .limit(1);
        const currentCost = Number(currentMachine[0]?.costPrice || 0);
        const finalCostPrice = Math.max(0, currentCost - totalDeduction).toFixed(2);

        await tx
          .update(inventoryItems)
          .set({
            status: newInvStatus,
            costPrice: finalCostPrice,
            soldDate: null, 
            warrantyStart: null,
            warrantyEnd: null,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, item.inventoryItemId));

        // 6. Ghi log thẻ kho máy cũ
        const returnReasonVi: Record<string, string> = {
          defective: "Lỗi kỹ thuật",
          cosmetic: "Lỗi ngoại quan",
          wrong_specs: "Sai cấu hình",
          customer_request: "Khách yêu cầu",
          other: "Khác",
        };
        await tx.insert(inventoryMovements).values({
          inventoryItemId: item.inventoryItemId,
          movementType: "returned",
          fromStatus: "sold",
          toStatus: newInvStatus,
          referenceType: "manual",
          referenceId: newReturn.id,
          quantityChange: 1,
          notes: `Nhập lại kho từ phiếu Đổi/Trả ${returnNumber}. Lý do: ${returnReasonVi[item.returnReason] || item.returnReason}`,
          performedBy: processedById,
        });

        // 7. Nếu là đổi máy: xử lý máy mới thế vào
        if (data.type === 'exchange' && item.newInventoryItemId) {
          const today = new Date();

          // Lấy cấu hình bảo hành và chiết khấu từ order_item gốc
          const originalOrderItem = await tx
            .select({ 
              warrantyMonths: orderItems.warrantyMonths,
              discount: orderItems.discount,
            })
            .from(orderItems)
            .where(and(eq(orderItems.orderId, data.orderId), eq(orderItems.inventoryItemId, item.inventoryItemId)))
            .limit(1);

          const warrantyMonths = originalOrderItem[0]?.warrantyMonths || 12;
          const discount = Number(originalOrderItem[0]?.discount || 0);

          const warrantyEndDate = new Date();
          warrantyEndDate.setMonth(today.getMonth() + warrantyMonths);

          // Lấy thông tin máy mới
          const newMachineQuery = await tx
            .select({ costPrice: inventoryItems.costPrice })
            .from(inventoryItems)
            .where(eq(inventoryItems.id, item.newInventoryItemId))
            .limit(1);

          if (newMachineQuery.length === 0) {
            throw new Error(`Không tìm thấy máy mới có ID: ${item.newInventoryItemId} trong kho`);
          }

          const newCostPrice = Number(newMachineQuery[0].costPrice || 0);
          const newSellingPrice = item.newSellingPrice ? Number(item.newSellingPrice) : Number(item.originalPrice);
          const itemProfit = newSellingPrice - newCostPrice - discount;

          // Cập nhật máy mới thành sold
          const todayStr = today.toISOString().split("T")[0];
          const warrantyEndStr = warrantyEndDate.toISOString().split("T")[0];
          await tx
            .update(inventoryItems)
            .set({
              status: 'sold',
              soldDate: todayStr,
              warrantyStart: todayStr,
              warrantyEnd: warrantyEndStr,
              updatedAt: today,
            })
            .where(eq(inventoryItems.id, item.newInventoryItemId));

          // Thẻ kho máy mới
          await tx.insert(inventoryMovements).values({
            inventoryItemId: item.newInventoryItemId,
            movementType: "sold",
            fromStatus: "in_stock",
            toStatus: "sold",
            referenceType: "manual",
            referenceId: newReturn.id,
            quantityChange: -1,
            notes: `Xuất kho máy mới đổi thế vào từ phiếu Đổi/Trả ${returnNumber}. Thế vào cho máy lỗi.`,
            performedBy: processedById,
          });

          // Cập nhật chi tiết đơn hàng gốc: thay thế máy cũ bằng máy mới, cập nhật giá bán, giá vốn và lợi nhuận
          await tx
            .update(orderItems)
            .set({
              inventoryItemId: item.newInventoryItemId,
              sellingPrice: newSellingPrice.toString(),
              costPrice: newCostPrice.toString(),
              profit: itemProfit.toString(),
            })
            .where(and(eq(orderItems.orderId, data.orderId), eq(orderItems.inventoryItemId, item.inventoryItemId)));
        }
      }

      // Xử lý các phụ kiện bán lẻ độc lập được trả lại
      const returnedAccessoryIds = data.returnedAccessoryIds || [];
      if (returnedAccessoryIds.length > 0) {
        await tx
          .update(accessoryItems)
          .set({
            status: 'in_stock',
            inventoryItemId: null,
            updatedAt: new Date(),
          })
          .where(and(eq(accessoryItems.status, 'sold'), inArray(accessoryItems.id, returnedAccessoryIds)));
      }

      // Cập nhật lại tổng tiền/lợi nhuận của đơn hàng gốc & thống kê chi tiêu khách hàng
      await recalculateOrderTotals(tx, data.orderId);
      await recalculateCustomerStats(tx, data.customerId);

      if (needRecalc) {
        await recalculateRunningBalances(tx);
      }

      const result = { success: true, message: "Tạo phiếu Đổi/Trả thành công. Đã cập nhật kho & đơn hàng gốc.", return: newReturn };
      after(() => {
        invalidateDashboardCache();
      });
      return result;
    });
  } catch (error: any) {
    console.error("Lỗi tạo phiếu Đổi/Trả:", error);
    return { success: false, message: error.message || "Lỗi tạo phiếu Đổi/Trả" };
  }
}


export async function getReturnDetailAction(id: string) {
  try {
    const returnRow = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        type: returns.type,
        reason: returns.reason,
        reasonDetail: returns.reasonDetail,
        status: returns.status,
        hasFee: returns.hasFee,
        feeAmount: returns.feeAmount,
        refundAmount: returns.refundAmount,
        exchangeDifference: returns.exchangeDifference,
        createdAt: returns.createdAt,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        orderNumber: orders.orderNumber,
        processedByName: profiles.fullName,
      })
      .from(returns)
      .innerJoin(customers, eq(returns.customerId, customers.id))
      .innerJoin(orders, eq(returns.orderId, orders.id))
      .leftJoin(profiles, eq(returns.processedBy, profiles.id))
      .where(eq(returns.id, id))
      .limit(1);

    if (returnRow.length === 0) {
      return { success: false, message: "Không tìm thấy phiếu đổi trả" };
    }

    const items = await db
      .select({
        id: returnItems.id,
        productId: returnItems.productId,
        productName: products.name,
        returnReason: returnItems.returnReason,
        conditionOnReturn: returnItems.conditionOnReturn,
        isDefective: returnItems.isDefective,
        defectDescription: returnItems.defectDescription,
        originalPrice: returnItems.originalPrice,
        refundPrice: returnItems.refundPrice,
        newInventoryItemId: returnItems.newInventoryItemId,
        newSerialNumber: sql<string | null>`(SELECT serial_number FROM inventory_items WHERE id = ${returnItems.newInventoryItemId})`,
        newProductName: sql<string | null>`(
          SELECT p.name FROM inventory_items ii 
          JOIN products p ON ii.product_id = p.id 
          WHERE ii.id = ${returnItems.newInventoryItemId}
        )`,
      })
      .from(returnItems)
      .innerJoin(products, eq(returnItems.productId, products.id))
      .where(eq(returnItems.returnId, id));

    return { success: true, returnData: returnRow[0], items };
  } catch (error: any) {
    console.error("Lỗi lấy chi tiết phiếu đổi trả:", error);
    return { success: false, message: error.message || "Lỗi lấy chi tiết phiếu đổi trả" };
  }
}

export async function deleteReturnAction(id: string) {
  try {
    return await db.transaction(async (tx) => {
      // 1. Fetch returnRow & returnItems to find the inventory items that were returned
      const returnRow = await tx
        .select()
        .from(returns)
        .where(eq(returns.id, id))
        .limit(1);
      
      if (returnRow.length === 0) {
        return { success: false, message: "Không tìm thấy phiếu đổi trả" };
      }

      const items = await tx
        .select()
        .from(returnItems)
        .where(eq(returnItems.returnId, id));

      // Kiểm tra tính hợp lệ của trạng thái sản phẩm trước khi hoàn tác
      for (const item of items) {
        // A. Máy cũ: phải đang ở kho ('in_stock' hoặc 'defective') - chưa bị bán lại
        const currentOldItem = await tx
          .select({ status: inventoryItems.status, serialNumber: inventoryItems.serialNumber })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, item.inventoryItemId))
          .limit(1);

        if (currentOldItem.length > 0) {
          if (currentOldItem[0].status !== 'in_stock' && currentOldItem[0].status !== 'defective') {
            throw new Error(`Không thể xóa phiếu đổi trả vì sản phẩm (SN: ${currentOldItem[0].serialNumber}) đã được bán lại hoặc xuất kho`);
          }
        }

        // B. Máy mới (nếu là đổi hàng): phải đang ở trạng thái 'sold'
        if (item.newInventoryItemId) {
          const currentNewItem = await tx
            .select({ status: inventoryItems.status, serialNumber: inventoryItems.serialNumber })
            .from(inventoryItems)
            .where(eq(inventoryItems.id, item.newInventoryItemId))
            .limit(1);

          if (currentNewItem.length > 0 && currentNewItem[0].status !== 'sold') {
            throw new Error(`Không thể xóa phiếu đổi trả vì thiết bị đổi mới thế vào (SN: ${currentNewItem[0].serialNumber}) đã bị thay đổi trạng thái kho`);
          }
        }
      }

      // 2. Revert inventory item statuses back to 'sold' (as they were before the return)
      const oldItemIds = items.map(item => item.inventoryItemId);
      if (oldItemIds.length > 0) {
        await tx
          .update(inventoryItems)
          .set({
            status: "sold",
            updatedAt: new Date(),
          })
          .where(inArray(inventoryItems.id, oldItemIds));
      }

      const newItemIds = items.map(item => item.newInventoryItemId).filter(Boolean) as string[];
      if (newItemIds.length > 0) {
        await tx
          .update(inventoryItems)
          .set({
            status: "in_stock",
            soldDate: null,
            warrantyStart: null,
            warrantyEnd: null,
            updatedAt: new Date(),
          })
          .where(inArray(inventoryItems.id, newItemIds));
      }

      const orderItemRevertPromises = [];
      for (const item of items) {
        if (item.newInventoryItemId) {
          orderItemRevertPromises.push(
            tx
              .update(orderItems)
              .set({
                inventoryItemId: item.inventoryItemId,
                sellingPrice: item.originalPrice,
                costPrice: sql<string>`(SELECT cost_price FROM inventory_items WHERE id = ${item.inventoryItemId})`,
                profit: sql<string>`(${item.originalPrice} - (SELECT cost_price FROM inventory_items WHERE id = ${item.inventoryItemId}) - discount)`,
              })
              .where(and(
                eq(orderItems.orderId, returnRow[0].orderId),
                eq(orderItems.inventoryItemId, item.newInventoryItemId)
              ))
          );
        }
      }
      if (orderItemRevertPromises.length > 0) {
        await Promise.all(orderItemRevertPromises);
      }

      // 4. Delete inventoryMovements linked to this return
      await tx
        .delete(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.referenceId, id),
            eq(inventoryMovements.referenceType, "manual")
          )
        );

      // 5. Delete returnItems
      await tx
        .delete(returnItems)
        .where(eq(returnItems.returnId, id));

      // 6. Delete cashBookEntries associated with this return
      await tx
        .delete(cashBookEntries)
        .where(
          and(
            eq(cashBookEntries.referenceId, id),
            eq(cashBookEntries.referenceType, "other")
          )
        );

      // 7. Delete the return entry itself
      const [deletedReturn] = await tx
        .delete(returns)
        .where(eq(returns.id, id))
        .returning();

      // Recalculate order totals & customer stats after deleting the return
      await recalculateOrderTotals(tx, returnRow[0].orderId);
      await recalculateCustomerStats(tx, returnRow[0].customerId);

      // 8. Recalculate Cashbook balances
      await recalculateRunningBalances(tx);

      const result = { 
        success: true, 
        message: `Đã xóa thành công phiếu đổi trả ${deletedReturn?.returnNumber} và hoàn tác kho hàng/sổ quỹ/đơn hàng gốc.` 
      };
      after(() => {
        invalidateDashboardCache();
      });
      return result;
    });
  } catch (error: any) {
    console.error("Lỗi xóa phiếu đổi trả:", error);
    return { success: false, message: error.message || "Lỗi xóa phiếu đổi trả" };
  }
}

async function recalculateOrderTotals(tx: any, orderId: string) {
  // Query all order items joined with inventoryItems and accessoryItems to get their current status
  const allOrderItems = await tx
    .select({
      sellingPrice: orderItems.sellingPrice,
      costPrice: orderItems.costPrice,
      discount: orderItems.discount,
      machineStatus: inventoryItems.status,
      accessoryStatus: accessoryItems.status,
    })
    .from(orderItems)
    .leftJoin(inventoryItems, eq(orderItems.inventoryItemId, inventoryItems.id))
    .leftJoin(accessoryItems, eq(orderItems.accessoryItemId, accessoryItems.id))
    .where(eq(orderItems.orderId, orderId));

  let subtotal = 0;
  let totalCost = 0;
  let totalItemDiscounts = 0;
  let activeItemsCount = 0;

  for (const oi of allOrderItems) {
    const isMachineActive = oi.machineStatus === 'sold' || oi.machineStatus === 'warranty_repair';
    const isAccessoryActive = oi.accessoryStatus === 'sold';

    // Only count items that are sold or in warranty repair (meaning they are still with the customer)
    if (isMachineActive || isAccessoryActive) {
      subtotal += Number(oi.sellingPrice || 0);
      totalCost += Number(oi.costPrice || 0);
      totalItemDiscounts += Number(oi.discount || 0);
      activeItemsCount++;
    }
  }

  // Get original order details (general discount, tax)
  const origOrder = await tx
    .select({
      discountAmount: orders.discountAmount,
      taxAmount: orders.taxAmount,
      saleChannel: orders.saleChannel,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (origOrder.length === 0) return;

  const discountAmount = Number(origOrder[0].discountAmount || 0);
  const taxAmount = Number(origOrder[0].taxAmount || 0);
  const saleChannel = origOrder[0].saleChannel;

  const finalTotal = Math.max(0, subtotal - totalItemDiscounts - discountAmount + taxAmount);
  const profit = finalTotal - totalCost;
  const profitMargin = finalTotal > 0 ? (profit / finalTotal) * 100 : 0;

  const updateFields: any = {
    subtotal: subtotal.toString(),
    totalAmount: finalTotal.toString(),
    totalCost: totalCost.toString(),
    profit: profit.toString(),
    profitMargin: profitMargin.toFixed(2),
    updatedAt: new Date(),
  };

  // If all items in the order have been returned/refunded, update order status to refunded
  if (activeItemsCount === 0) {
    updateFields.status = 'refunded';
    updateFields.paymentStatus = 'refunded';
  } else {
    // If it was refunded but now has active items (reverted return), we restore status to completed/processing
    const currentOrder = await tx
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    
    if (currentOrder.length > 0 && currentOrder[0].status === 'refunded') {
      updateFields.status = saleChannel === 'online' ? 'processing' : 'completed';
      updateFields.paymentStatus = 'paid';
    }
  }

  await tx
    .update(orders)
    .set(updateFields)
    .where(eq(orders.id, orderId));
}

async function recalculateCustomerStats(tx: any, customerId: string) {
  // Query all completed and processing orders of this customer
  // Exclude cancelled and refunded orders from cumulative spend and order count
  const customerOrders = await tx
    .select({
      totalAmount: orders.totalAmount,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        eq(orders.customerId, customerId),
        sql`${orders.status} NOT IN ('cancelled', 'refunded')`
      )
    );

  let totalSpent = 0;
  let orderCount = 0;

  for (const o of customerOrders) {
    totalSpent += Number(o.totalAmount || 0);
    orderCount++;
  }

  await tx
    .update(customers)
    .set({
      totalSpent: totalSpent.toFixed(2),
      orderCount: orderCount,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}

