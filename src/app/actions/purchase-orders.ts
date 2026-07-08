"use server";

import { db, recalculateRunningBalances } from "@/lib/db";
import { purchaseOrders, suppliers, purchaseOrderItems, inventoryItems, products, cashBookEntries, profiles, accessoryItems, accessoryCatalog } from "@/lib/db/schema";
import { eq, desc, sql, inArray, and } from "drizzle-orm";

// 1. Lấy danh sách toàn bộ đơn nhập hàng
export async function getPurchaseOrdersList() {
  try {
    const list = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        createdAt: purchaseOrders.createdAt,
        totalCost: purchaseOrders.totalCost,
        shippingCost: purchaseOrders.shippingCost,
        totalItemsCount: sql<number>`cast(count(${inventoryItems.id}) as integer)`,
        returnedItemsCount: sql<number>`cast(sum(case when ${inventoryItems.status} = 'returned' then 1 else 0 end) as integer)`,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .leftJoin(inventoryItems, eq(inventoryItems.purchaseOrderItemId, purchaseOrderItems.id))
      .groupBy(
        purchaseOrders.id,
        purchaseOrders.poNumber,
        suppliers.name,
        purchaseOrders.status,
        purchaseOrders.createdAt,
        purchaseOrders.totalCost,
        purchaseOrders.shippingCost
      )
      .orderBy(desc(purchaseOrders.createdAt));

    const mappedList = list.map((po) => {
      let status = po.status;
      const totalItemsCount = po.totalItemsCount || 0;
      const returnedItemsCount = po.returnedItemsCount || 0;
      if (totalItemsCount > 0 && returnedItemsCount === totalItemsCount) {
        status = "returned_supplier";
      }
      return {
        id: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        status,
        createdAt: po.createdAt,
        totalCost: po.totalCost,
        shippingCost: po.shippingCost,
        totalItemsCount,
      };
    });

    return { success: true, purchaseOrders: mappedList };
  } catch (error: any) {
    console.error("Lỗi lấy danh sách đơn nhập hàng:", error);
    return { success: false, message: error.message || "Lỗi truy vấn danh sách đơn nhập" };
  }
}

// 2. Lấy thông tin chi tiết một đơn nhập hàng (kèm danh sách máy lẻ và phân bổ chi phí)
export async function getPurchaseOrderDetail(poId: string) {
  try {
    // Run queries in parallel to optimize latency (saving ~330ms RTT)
    const [poResult, items, accessories] = await Promise.all([
      db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          originCountry: purchaseOrders.originCountry,
          shippingMethod: purchaseOrders.shippingMethod,
          trackingNumber: purchaseOrders.trackingNumber,
          trackingUrl: purchaseOrders.trackingUrl,
          shippingCost: purchaseOrders.shippingCost,
          totalCost: purchaseOrders.totalCost,
          notes: purchaseOrders.notes,
          createdAt: purchaseOrders.createdAt,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(eq(purchaseOrders.id, poId))
        .limit(1),

      db
        .select({
          id: inventoryItems.id,
          serialNumber: inventoryItems.serialNumber,
          productId: inventoryItems.productId,
          productName: products.name,
          productSpecs: products.specs,
          condition: inventoryItems.condition,
          status: inventoryItems.status,
          costPrice: inventoryItems.costPrice,
          sellingPrice: inventoryItems.sellingPrice,
          stockedDate: inventoryItems.stockedDate,
        })
        .from(inventoryItems)
        .leftJoin(purchaseOrderItems, eq(inventoryItems.purchaseOrderItemId, purchaseOrderItems.id))
        .leftJoin(products, eq(inventoryItems.productId, products.id))
        .where(eq(purchaseOrderItems.purchaseOrderId, poId))
        .orderBy(inventoryItems.serialNumber),

      db
        .select({
          id: accessoryItems.id,
          serialNumber: accessoryItems.serialNumber,
          unitCost: accessoryItems.unitCost,
          status: accessoryItems.status,
          sellingPrice: accessoryItems.sellingPrice,
          catalogName: accessoryCatalog.name,
        })
        .from(accessoryItems)
        .innerJoin(accessoryCatalog, eq(accessoryItems.accessoryCatalogId, accessoryCatalog.id))
        .where(eq(accessoryItems.purchaseOrderId, poId))
    ]);

    if (poResult.length === 0) {
      return { success: false, message: "Không tìm thấy đơn nhập hàng" };
    }

    const po = poResult[0];

    const totalItemsCount = items.length;
    const returnedItemsCount = items.filter((i: any) => i.status === 'returned').length;
    if (totalItemsCount > 0 && returnedItemsCount === totalItemsCount) {
      po.status = "returned_supplier";
    }

    // C. Tính toán phân bổ chi phí vận chuyển
    const allocatedShipping = totalItemsCount > 0 
      ? Number(po.shippingCost || 0) / totalItemsCount 
      : 0;

    // D. Bổ sung trường chi phí tính toán cho mỗi máy lẻ
    const processedItems = items.map(item => {
      const priceVal = Number(item.costPrice || 0);
      const totalActualCost = priceVal;
      
      return {
        ...item,
        allocatedShipping,
        allocatedTax: 0,
        totalActualCost,
      };
    });

    // E. Thống kê nhanh các số liệu đối soát
    const stats = {
      totalItemsCount,
      inStockCount: items.filter(i => i.status === 'in_stock').length,
      incomingCount: items.filter(i => i.status === 'incoming').length,
      soldCount: items.filter(i => i.status === 'sold').length,
      defectiveCount: items.filter(i => i.status === 'defective').length,
      returnedCount: items.filter(i => i.status === 'returned').length,
      totalAccessoryCost: accessories.reduce((sum, i) => sum + Number(i.unitCost || 0), 0),
    };

    return { 
      success: true, 
      po: { ...po, taxImport: "0" },
      items: processedItems, 
      accessories,
      stats 
    };
  } catch (error: any) {
    console.error("Lỗi lấy chi tiết đơn nhập hàng:", error);
    return { success: false, message: error.message || "Lỗi truy vấn chi tiết đơn nhập" };
  }
}


// 4. Cập nhật thông tin đơn nhập hàng (trạng thái, chi phí vận chuyển, thuế nhập khẩu)
export async function updatePurchaseOrderAction(
  poId: string,
  data: {
    status?: 'in_transit' | 'received' | 'cancelled';
    shippingCost?: string;
  }
) {
  try {
    const result = await db.transaction(async (tx) => {
      // A. Lấy thông tin đơn nhập hiện tại
      const existing = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, poId))
        .limit(1);

      if (existing.length === 0) {
        throw new Error("Không tìm thấy đơn nhập hàng");
      }

      const po = existing[0];

      // B. Tính toán lại totalCost của PO
      // Lấy tổng tiền của các sản phẩm trong PO
      const poItems = await tx
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, poId));

      const totalItemsCost = poItems.reduce(
        (sum: number, item: any) => sum + Number(item.totalCost || 0),
        0
      );

      const finalShippingCost = data.shippingCost !== undefined ? (Number(data.shippingCost) || 0) : Number(po.shippingCost || 0);
      const totalCost = (totalItemsCost + finalShippingCost).toFixed(2);

      // C. Cập nhật đơn nhập
      const updateData: any = {
        updatedAt: new Date(),
        totalCost,
      };

      if (data.status !== undefined) updateData.status = data.status;
      if (data.shippingCost !== undefined) updateData.shippingCost = String(finalShippingCost);

      const [updated] = await tx
        .update(purchaseOrders)
        .set(updateData)
        .where(eq(purchaseOrders.id, poId))
        .returning();

      // D. Cập nhật trạng thái các máy lẻ trong lô tương ứng
      const poItemIds = poItems.map((pi: any) => pi.id);

      if (data.status !== undefined && poItemIds.length > 0) {
        if (data.status === "received") {
          // Nếu chuyển thành đã sẵn hàng, cập nhật các máy đang ở 'incoming' sang 'in_stock'
          await tx
            .update(inventoryItems)
            .set({
              status: "in_stock",
              stockedDate: new Date().toISOString().split("T")[0],
              updatedAt: new Date(),
            })
            .where(
              and(
                inArray(inventoryItems.purchaseOrderItemId, poItemIds),
                eq(inventoryItems.status, 'incoming')
              )
            );
        } else if (data.status === "in_transit") {
          // Nếu chuyển về đang vận chuyển, cập nhật các máy đang ở 'in_stock' về 'incoming'
          await tx
            .update(inventoryItems)
            .set({
              status: "incoming",
              stockedDate: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                inArray(inventoryItems.purchaseOrderItemId, poItemIds),
                eq(inventoryItems.status, 'in_stock')
              )
            );
        } else if (data.status === "cancelled") {
          // Nếu hủy đơn nhập, chuyển toàn bộ máy lẻ thuộc PO này sang trạng thái 'deleted'
          await tx
            .update(inventoryItems)
            .set({
              status: "deleted",
              updatedAt: new Date(),
            })
            .where(inArray(inventoryItems.purchaseOrderItemId, poItemIds));
        }
      }

      // E. Đồng bộ Sổ quỹ Kế toán
      const finalStatus = updated.status;
      const finalTotalCost = Number(updated.totalCost || 0);

      if (finalStatus === "received") {
        if (finalTotalCost > 0) {
          const existingCashEntry = await tx
            .select()
            .from(cashBookEntries)
            .where(
              and(
                eq(cashBookEntries.referenceType, "purchase_order"),
                eq(cashBookEntries.referenceId, poId)
              )
            )
            .limit(1);

          if (existingCashEntry.length > 0) {
            await tx
              .update(cashBookEntries)
              .set({
                amount: finalTotalCost.toFixed(2),
                description: `Chi tiền thanh toán đơn nhập hàng ${updated.poNumber}`,
                entryDate: new Date().toISOString().split("T")[0],
              })
              .where(eq(cashBookEntries.id, existingCashEntry[0].id));
          } else {
            const dateStrCB = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const randomSuffixCB = Math.random().toString(36).substring(2, 6).toUpperCase();
            const entryNumber = `CB${dateStrCB}-${randomSuffixCB}`;

            let createdByUserId = updated.createdBy;
            if (!createdByUserId) {
              const ownerProfiles = await tx.select().from(profiles).limit(1);
              createdByUserId = ownerProfiles[0]?.id || null;
            }

            await tx.insert(cashBookEntries).values({
              entryNumber,
              type: "expense",
              category: "purchase",
              amount: finalTotalCost.toFixed(2),
              runningBalance: "0",
              paymentMethod: "bank_transfer",
              referenceType: "purchase_order",
              referenceId: poId,
              description: `Chi tiền thanh toán đơn nhập hàng ${updated.poNumber}`,
              entryDate: new Date().toISOString().split("T")[0],
              createdBy: createdByUserId,
            });
          }

          await recalculateRunningBalances(tx);
        } else {
          const existingCashEntry = await tx
            .select()
            .from(cashBookEntries)
            .where(
              and(
                eq(cashBookEntries.referenceType, "purchase_order"),
                eq(cashBookEntries.referenceId, poId)
              )
            )
            .limit(1);

          if (existingCashEntry.length > 0) {
            await tx
              .delete(cashBookEntries)
              .where(eq(cashBookEntries.id, existingCashEntry[0].id));
            
            await recalculateRunningBalances(tx);
          }
        }
      } else {
        const existingCashEntry = await tx
          .select()
          .from(cashBookEntries)
          .where(
            and(
              eq(cashBookEntries.referenceType, "purchase_order"),
              eq(cashBookEntries.referenceId, poId)
            )
          )
          .limit(1);

        if (existingCashEntry.length > 0) {
          await tx
            .delete(cashBookEntries)
            .where(eq(cashBookEntries.id, existingCashEntry[0].id));
          
          await recalculateRunningBalances(tx);
        }
      }

      return {
        success: true,
        message: "Cập nhật đơn nhập hàng thành công",
        po: updated,
      };
    });

    return result;
  } catch (error: any) {
    console.error("Lỗi cập nhật đơn nhập:", error);
    return { success: false, message: error.message || "Lỗi cập nhật đơn nhập" };
  }
}

