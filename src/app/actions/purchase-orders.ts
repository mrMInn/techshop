"use server";

import { db } from "@/lib/db";
import { purchaseOrders, suppliers, purchaseOrderItems, inventoryItems, products } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

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
        taxImport: purchaseOrders.taxImport,
        totalItemsCount: sql<number>`cast(count(${inventoryItems.id}) as integer)`,
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
        purchaseOrders.shippingCost,
        purchaseOrders.taxImport
      )
      .orderBy(desc(purchaseOrders.createdAt));

    return { success: true, purchaseOrders: list };
  } catch (error: any) {
    console.error("Lỗi lấy danh sách đơn nhập hàng:", error);
    return { success: false, message: error.message || "Lỗi truy vấn danh sách đơn nhập" };
  }
}

// 2. Lấy thông tin chi tiết một đơn nhập hàng (kèm danh sách máy lẻ và phân bổ chi phí)
export async function getPurchaseOrderDetail(poId: string) {
  try {
    // Run queries in parallel to optimize latency (saving ~330ms RTT)
    const [poResult, items] = await Promise.all([
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
          taxImport: purchaseOrders.taxImport,
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
          condition: inventoryItems.condition,
          status: inventoryItems.status,
          costPrice: inventoryItems.costPrice,
          sellingPrice: inventoryItems.sellingPrice,
          accessoryCost: inventoryItems.accessoryCost,
          accessoryNotes: inventoryItems.accessoryNotes,
          stockedDate: inventoryItems.stockedDate,
        })
        .from(inventoryItems)
        .leftJoin(purchaseOrderItems, eq(inventoryItems.purchaseOrderItemId, purchaseOrderItems.id))
        .leftJoin(products, eq(inventoryItems.productId, products.id))
        .where(eq(purchaseOrderItems.purchaseOrderId, poId))
        .orderBy(inventoryItems.serialNumber)
    ]);

    if (poResult.length === 0) {
      return { success: false, message: "Không tìm thấy đơn nhập hàng" };
    }

    const po = poResult[0];

    const totalItemsCount = items.length;

    // C. Tính toán phân bổ chi phí vận chuyển & thuế
    const allocatedShipping = totalItemsCount > 0 
      ? Number(po.shippingCost || 0) / totalItemsCount 
      : 0;

    const allocatedTax = totalItemsCount > 0 
      ? Number(po.taxImport || 0) / totalItemsCount 
      : 0;

    // D. Bổ sung trường chi phí tính toán cho mỗi máy lẻ
    const processedItems = items.map(item => {
      const priceVal = Number(item.costPrice || 0);
      const accVal = Number(item.accessoryCost || 0);
      const totalActualCost = priceVal + allocatedShipping + allocatedTax + accVal;
      
      return {
        ...item,
        allocatedShipping,
        allocatedTax,
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
      totalAccessoryCost: items.reduce((sum, i) => sum + Number(i.accessoryCost || 0), 0),
    };

    return { 
      success: true, 
      po, 
      items: processedItems, 
      stats 
    };
  } catch (error: any) {
    console.error("Lỗi lấy chi tiết đơn nhập hàng:", error);
    return { success: false, message: error.message || "Lỗi truy vấn chi tiết đơn nhập" };
  }
}

// 3. Cập nhật chi phí mua sạc/phụ kiện phát sinh lẻ cho từng máy
export async function updateAccessoryCostAction(
  itemId: string,
  cost: number,
  notes: string | null
) {
  try {
    const [updatedItem] = await db
      .update(inventoryItems)
      .set({
        accessoryCost: cost.toFixed(2),
        accessoryNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, itemId))
      .returning();

    return {
      success: true,
      message: "Cập nhật chi phí sạc/phụ kiện thành công",
      item: updatedItem,
    };
  } catch (error: any) {
    console.error("Lỗi cập nhật chi phí sạc/phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi cập nhật dữ liệu" };
  }
}
