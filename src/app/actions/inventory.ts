"use server";

import { 
  inventoryItems, 
  products, 
  brands, 
  categories, 
  inventoryMovements, 
  profiles,
  warrantyLogs,
  warrantyClaims,
  returnItems,
  returns,
  payments,
  orderItems,
  orders,
  quotationItems,
  quotations,
  purchaseOrderItems,
  purchaseOrders,
  cashBookEntries,
  expenses,
  customers,
  suppliers
} from "@/lib/db/schema";
import { db, recalculateRunningBalances } from "@/lib/db";
import { eq, desc, inArray, sql, and, or } from "drizzle-orm";
import { syncHistoricalData } from "./accounting";
import { after } from "next/server";

// Helper function: Đồng bộ số lượng thực nhận và trạng thái của Đơn nhập hàng (Purchase Order)
export async function syncPurchaseOrderStatus(tx: any, purchaseOrderId: string) {
  // 1. Lấy tất cả chi tiết sản phẩm thuộc đơn nhập hàng
  const poItems = await tx
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

  let totalQty = 0;
  let totalReceived = 0;

  for (const item of poItems) {
    // Đếm số lượng máy lẻ tương ứng đã được nhập kho thành công (in_stock, sold, warranty_repair, defective)
    const receivedItems = await tx
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.purchaseOrderItemId, item.id),
          or(
            eq(inventoryItems.status, "in_stock"),
            eq(inventoryItems.status, "sold"),
            eq(inventoryItems.status, "warranty_repair"),
            eq(inventoryItems.status, "defective")
          )
        )
      );

    const receivedCount = Number(receivedItems[0]?.count || 0);

    // Cập nhật số lượng đã nhận thực tế cho sản phẩm này trong đơn nhập
    await tx
      .update(purchaseOrderItems)
      .set({ receivedQuantity: receivedCount })
      .where(eq(purchaseOrderItems.id, item.id));

    totalQty += item.quantity;
    totalReceived += receivedCount;
  }

  // Xác định trạng thái mới của đơn nhập hàng
  let newStatus: "in_transit" | "partially_received" | "received" = "in_transit";
  if (totalReceived > 0) {
    if (totalReceived >= totalQty) {
      newStatus = "received";
    } else {
      newStatus = "partially_received";
    }
  }

  // Cập nhật trạng thái và ngày nhận thực tế của đơn nhập hàng
  const todayStr = new Date().toISOString().split("T")[0];
  await tx
    .update(purchaseOrders)
    .set({
      status: newStatus,
      actualArrival: newStatus === "received" || newStatus === "partially_received" ? todayStr : null,
      updatedAt: new Date(),
    })
    .where(eq(purchaseOrders.id, purchaseOrderId));
}

export async function getInventoryItems() {
  console.log("SERVER: getInventoryItems called");
  
  const poCounts = db
    .select({
      purchaseOrderId: purchaseOrderItems.purchaseOrderId,
      totalItems: sql<number>`cast(count(${inventoryItems.id}) as integer)`.as('total_items'),
    })
    .from(inventoryItems)
    .innerJoin(purchaseOrderItems, eq(inventoryItems.purchaseOrderItemId, purchaseOrderItems.id))
    .groupBy(purchaseOrderItems.purchaseOrderId)
    .as('po_counts');

  const items = await db
    .select({
      id: inventoryItems.id,
      serialNumber: inventoryItems.serialNumber,
      condition: inventoryItems.condition,
      status: inventoryItems.status,
      costPrice: inventoryItems.costPrice,
      sellingPrice: inventoryItems.sellingPrice,
      accessoryCost: inventoryItems.accessoryCost,
      accessoryNotes: inventoryItems.accessoryNotes,
      stockedDate: inventoryItems.stockedDate,
      expectedArrivalDate: inventoryItems.expectedArrivalDate,
      receivedDate: inventoryItems.receivedDate,
      soldDate: inventoryItems.soldDate,
      warrantyStart: inventoryItems.warrantyStart,
      warrantyEnd: inventoryItems.warrantyEnd,
      notes: inventoryItems.notes,
      specsOverride: inventoryItems.specsOverride,
      originCountry: inventoryItems.originCountry,
      location: inventoryItems.location,
      createdAt: inventoryItems.createdAt,
      productName: products.name,
      productSku: products.sku,
      brandName: brands.name,
      categoryName: categories.name,
      images: inventoryItems.images,
      productSpecs: products.specs,
      productId: inventoryItems.productId,
      supplierName: suppliers.name,
      supplierId: suppliers.id,
      poNumber: purchaseOrders.poNumber,
      purchaseOrderId: purchaseOrders.id,
      trackingNumber: purchaseOrders.trackingNumber,
      trackingUrl: purchaseOrders.trackingUrl,
      shippingMethod: purchaseOrders.shippingMethod,
      shippingCost: purchaseOrders.shippingCost,
      taxImport: purchaseOrders.taxImport,
      poStatus: purchaseOrders.status,
      poItemsCount: sql<number>`coalesce(${poCounts.totalItems}, 0)`,
    })
    .from(inventoryItems)
    .innerJoin(products, eq(inventoryItems.productId, products.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(purchaseOrderItems, eq(inventoryItems.purchaseOrderItemId, purchaseOrderItems.id))
    .leftJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(poCounts, eq(purchaseOrders.id, poCounts.purchaseOrderId))
    .where(inArray(inventoryItems.status, ['incoming', 'in_stock', 'sold', 'warranty_repair', 'returned', 'defective', 'deleted']))
    .orderBy(desc(inventoryItems.createdAt), desc(inventoryItems.id));

  return items;
}



// Lấy danh sách sản phẩm (Model) cho dropdown
export async function getProductsForDropdown() {
  return await db.select({
    id: products.id,
    name: products.name,
    sku: products.sku,
    specs: products.specs,
  }).from(products).orderBy(products.name);
}

// Thêm mới một sản phẩm vào kho
export async function createInventoryItem(data: {
  productId: string;
  serialNumber: string;
  condition: "new" | "used";
  status: "incoming" | "in_stock";
  costPrice: string;
  sellingPrice?: string;
  originCountry?: string;
  notes?: string;
  stockedDate?: string;
  expectedArrivalDate?: string;
  images?: string[];
  supplierId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingMethod?: string;
  shippingCost?: string;
  taxImport?: string;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      // Lấy nhân viên thực hiện
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;

      let purchaseOrderItemId: string | null = null;
      let targetSupplierId = data.supplierId;

      // Nếu không có supplierId, tự động gán nhà cung cấp mặc định tùy thuộc vào quốc tế hay trong nước
      if (!targetSupplierId || targetSupplierId === "") {
        const isIntl = data.trackingNumber || data.shippingMethod || (data.originCountry && data.originCountry !== "VN");
        const defaultName = isIntl ? "Nhập khẩu quốc tế" : "Nhà cung cấp lẻ";
        const defaultCountry = isIntl ? (data.originCountry || "US") : "VN";

        const defaultSuppliers = await tx.select().from(suppliers).where(eq(suppliers.name, defaultName)).limit(1);
        if (defaultSuppliers.length > 0) {
          targetSupplierId = defaultSuppliers[0].id;
        } else {
          const [newSupplier] = await tx.insert(suppliers).values({
            name: defaultName,
            country: defaultCountry,
            isActive: true,
          }).returning();
          targetSupplierId = newSupplier.id;
        }
      }

      if (targetSupplierId) {
        // Sinh poNumber ngẫu nhiên độc nhất
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        const poNumber = `PO-${dateStr}-${rand}`;

        const count = 1;
        const unitCost = Number(data.costPrice) || 0;
        const totalItemsCost = unitCost * count;
        const shippingCost = Number(data.shippingCost) || 0;
        const taxImport = Number(data.taxImport) || 0;
        const totalCost = (totalItemsCost + shippingCost + taxImport).toFixed(2);

        // Tạo đơn nhập purchaseOrders
        const [newPo] = await tx.insert(purchaseOrders).values({
          poNumber,
          supplierId: targetSupplierId,
          status: data.status === "incoming" ? "in_transit" : "received",
          originCountry: data.originCountry || "VN",
          shippingMethod: data.shippingMethod || null,
          trackingNumber: data.trackingNumber || null,
          trackingUrl: data.trackingUrl || null,
          shippingCost: String(shippingCost),
          taxImport: String(taxImport),
          totalCost: String(totalCost),
          notes: data.notes || null,
          expectedArrival: data.status === 'incoming' ? (data.expectedArrivalDate || null) : null,
          actualArrival: data.status === 'in_stock' ? (data.stockedDate || new Date().toISOString().split('T')[0]) : null,
          createdBy: performedById || null,
        }).returning();

        // Tạo chi tiết đơn nhập purchaseOrderItems
        const [newPoItem] = await tx.insert(purchaseOrderItems).values({
          purchaseOrderId: newPo.id,
          productId: data.productId,
          quantity: count,
          unitCost: data.costPrice,
          totalCost: String(totalItemsCost.toFixed(2)),
          receivedQuantity: data.status === "in_stock" ? count : 0,
          notes: data.notes || null,
        }).returning();

        purchaseOrderItemId = newPoItem.id;
      }

      // 1. Tạo inventory item
      const [newItem] = await tx.insert(inventoryItems).values({
        productId: data.productId,
        serialNumber: data.serialNumber,
        condition: data.condition,
        status: data.status,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice || null,
        purchaseOrderItemId: purchaseOrderItemId || null,
        originCountry: data.originCountry || 'VN',
        stockedDate: data.status === 'incoming' ? null : (data.stockedDate || new Date().toISOString().split('T')[0]),
        expectedArrivalDate: data.status === 'incoming' ? (data.expectedArrivalDate || null) : null,
        notes: data.notes || null,
        images: data.images || null,
      }).returning();

      // 2. Ghi nhận stock card (thẻ kho)
      if (performedById) {
         await tx.insert(inventoryMovements).values({
           inventoryItemId: newItem.id,
           movementType: 'stocked',
           fromStatus: null,
           toStatus: data.status,
           referenceType: purchaseOrderItemId ? 'purchase_order' : 'manual',
           referenceId: purchaseOrderItemId || null,
           quantityChange: 1,
           performedBy: performedById,
           notes: purchaseOrderItemId ? 'Nhập kho từ đơn hàng NCC' : 'Tạo mới sản phẩm vào kho (Thủ công)',
         });
      }

      // 3. Đồng bộ trạng thái đơn nhập hàng
      if (purchaseOrderItemId) {
        const poItem = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, purchaseOrderItemId)).limit(1);
        if (poItem.length > 0) {
          await syncPurchaseOrderStatus(tx, poItem[0].purchaseOrderId);
        }
      }

      return { success: true, message: "Nhập kho thành công", item: newItem };
    });

    if (result.success) {
      try {
        after(() => {
          syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
        });
      } catch (e) {
        syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
      }
    }
    return result;
  } catch (error: any) {
    console.error("Lỗi tạo inventory item:", error);
    if (error.code === '23505') { // unique_violation
      return { success: false, message: "Serial Number đã tồn tại" };
    }
    return { success: false, message: error.message || "Không thể nhập kho. Vui lòng thử lại." };
  }
}

// Nhập kho hàng loạt (Nhập theo lô nhiều máy cùng model)
export async function createInventoryItemsBatch(data: {
  productId: string;
  serialNumbers: string[];
  condition: "new" | "used";
  status: "incoming" | "in_stock";
  costPrice: string;
  sellingPrice?: string;
  originCountry?: string;
  notes?: string;
  stockedDate?: string;
  expectedArrivalDate?: string;
  images?: string[];
  supplierId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingMethod?: string;
  shippingCost?: string;
  taxImport?: string;
}) {
  try {
    if (!data.serialNumbers || data.serialNumbers.length === 0) {
      return { success: false, message: "Danh sách Serial Number không được để trống" };
    }

    // Lọc bỏ serials trống và trim khoảng trắng
    const cleanSerials = data.serialNumbers.map(s => s.trim()).filter(Boolean);
    if (cleanSerials.length === 0) {
      return { success: false, message: "Danh sách Serial Number không hợp lệ" };
    }

    // Kiểm tra trùng lặp trong chính lô nhập
    const duplicates = cleanSerials.filter((item, index) => cleanSerials.indexOf(item) !== index);
    if (duplicates.length > 0) {
      return { success: false, message: `Serial Number trùng lặp trong lô nhập: ${Array.from(new Set(duplicates)).join(", ")}` };
    }

    const result = await db.transaction(async (tx) => {
      // Lấy nhân viên thực hiện
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) {
        throw new Error("Hệ thống chưa có tài khoản nhân viên");
      }

      let purchaseOrderItemId: string | null = null;
      let targetSupplierId = data.supplierId;

      // Nếu không có supplierId, tự động gán nhà cung cấp mặc định tùy thuộc vào quốc tế hay trong nước
      if (!targetSupplierId || targetSupplierId === "") {
        const isIntl = data.trackingNumber || data.shippingMethod || (data.originCountry && data.originCountry !== "VN");
        const defaultName = isIntl ? "Nhập khẩu quốc tế" : "Nhà cung cấp lẻ";
        const defaultCountry = isIntl ? (data.originCountry || "US") : "VN";

        const defaultSuppliers = await tx.select().from(suppliers).where(eq(suppliers.name, defaultName)).limit(1);
        if (defaultSuppliers.length > 0) {
          targetSupplierId = defaultSuppliers[0].id;
        } else {
          const [newSupplier] = await tx.insert(suppliers).values({
            name: defaultName,
            country: defaultCountry,
            isActive: true,
          }).returning();
          targetSupplierId = newSupplier.id;
        }
      }

      if (targetSupplierId) {
        // Sinh poNumber ngẫu nhiên độc nhất
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        const poNumber = `PO-${dateStr}-${rand}`;

        const count = cleanSerials.length;
        const unitCost = Number(data.costPrice) || 0;
        const totalItemsCost = unitCost * count;
        const shippingCost = Number(data.shippingCost) || 0;
        const taxImport = Number(data.taxImport) || 0;
        const totalCost = (totalItemsCost + shippingCost + taxImport).toFixed(2);

        // Tạo đơn nhập purchaseOrders
        const [newPo] = await tx.insert(purchaseOrders).values({
          poNumber,
          supplierId: targetSupplierId,
          status: data.status === "incoming" ? "in_transit" : "received",
          originCountry: data.originCountry || "VN",
          shippingMethod: data.shippingMethod || null,
          trackingNumber: data.trackingNumber || null,
          trackingUrl: data.trackingUrl || null,
          shippingCost: String(shippingCost),
          taxImport: String(taxImport),
          totalCost: String(totalCost),
          notes: data.notes || null,
          expectedArrival: data.status === 'incoming' ? (data.expectedArrivalDate || null) : null,
          actualArrival: data.status === 'in_stock' ? (data.stockedDate || new Date().toISOString().split('T')[0]) : null,
          createdBy: performedById || null,
        }).returning();

        // Tạo chi tiết đơn nhập purchaseOrderItems
        const [newPoItem] = await tx.insert(purchaseOrderItems).values({
          purchaseOrderId: newPo.id,
          productId: data.productId,
          quantity: count,
          unitCost: data.costPrice,
          totalCost: String(totalItemsCost.toFixed(2)),
          receivedQuantity: data.status === "in_stock" ? count : 0,
          notes: data.notes || null,
        }).returning();

        purchaseOrderItemId = newPoItem.id;
      }

      // 1. Kiểm tra trùng lặp hàng loạt trên database trong 1 câu query
      const existing = await tx
        .select({ serialNumber: inventoryItems.serialNumber })
        .from(inventoryItems)
        .where(inArray(inventoryItems.serialNumber, cleanSerials));

      if (existing.length > 0) {
        const dupSerials = existing.map(e => e.serialNumber).join(", ");
        throw new Error(`Serial Number đã tồn tại trên hệ thống: ${dupSerials}`);
      }

      // 2. Tạo các items hàng loạt (Bulk Insert)
      const itemsToInsert = cleanSerials.map(serial => ({
        productId: data.productId,
        serialNumber: serial,
        condition: data.condition,
        status: data.status,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice || null,
        purchaseOrderItemId: purchaseOrderItemId || null,
        originCountry: data.originCountry || 'VN',
        stockedDate: data.status === 'incoming' ? null : (data.stockedDate || new Date().toISOString().split('T')[0]),
        expectedArrivalDate: data.status === 'incoming' ? (data.expectedArrivalDate || null) : null,
        notes: data.notes || null,
        images: data.images || null,
      }));

      const insertedItems = await tx.insert(inventoryItems).values(itemsToInsert).returning();

      // 3. Ghi nhận thẻ kho hàng loạt (Bulk Insert)
      const movementsToInsert = insertedItems.map(item => ({
        inventoryItemId: item.id,
        movementType: 'stocked' as const,
        fromStatus: null,
        toStatus: data.status,
        referenceType: (purchaseOrderItemId ? 'purchase_order' : 'manual') as any,
        referenceId: purchaseOrderItemId || null,
        quantityChange: 1,
        performedBy: performedById,
        notes: purchaseOrderItemId ? 'Nhập kho theo lô từ đơn hàng NCC' : 'Tạo mới sản phẩm vào kho theo lô (Thủ công hàng loạt)',
      }));

      await tx.insert(inventoryMovements).values(movementsToInsert);

      // 4. Đồng bộ trạng thái đơn nhập hàng
      if (purchaseOrderItemId) {
        const poItem = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, purchaseOrderItemId)).limit(1);
        if (poItem.length > 0) {
          await syncPurchaseOrderStatus(tx, poItem[0].purchaseOrderId);
        }
      }

      return { 
        success: true, 
        message: `Nhập kho thành công lô hàng ${cleanSerials.length} máy!`, 
        items: insertedItems 
      };
    });

    if (result.success) {
      try {
        after(() => {
          syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
        });
      } catch (e) {
        syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
      }
    }
    return result;
  } catch (error: any) {
    console.error("Lỗi nhập kho hàng loạt:", error);
    return { success: false, message: error.message || "Không thể nhập kho hàng loạt. Vui lòng kiểm tra lại." };
  }
}

// Cập nhật thông tin máy trong kho
export async function updateInventoryItem(
  id: string, 
  data: Partial<Omit<typeof inventoryItems.$inferInsert, "id" | "productId" | "createdAt" | "updatedAt">> & {
    supplierId?: string;
    shippingMethod?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    shippingCost?: string;
    taxImport?: string;
  }
) {
  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
      if (!existing.length) return { success: false, message: "Không tìm thấy sản phẩm" };

      const oldItem = existing[0];
      const finalData = { ...data };

      // Tách riêng các trường liên quan đến đơn nhập hàng (Purchase Order)
      const {
        supplierId,
        shippingMethod,
        trackingNumber,
        trackingUrl,
        shippingCost,
        taxImport,
        ...itemData
      } = finalData;

      let purchaseOrderItemId = oldItem.purchaseOrderItemId;

      // Lấy nhân viên thực hiện
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;

      // Xử lý cập nhật/liên kết Purchase Order
      let targetSupplierId = supplierId;

      // Nếu không chọn nhà cung cấp hoặc bỏ trống, nhưng vẫn nhập mã vận đơn/đơn vị vận chuyển
      if ((!targetSupplierId || targetSupplierId === "") && (trackingNumber || shippingMethod)) {
        // Tìm hoặc tạo Nhà cung cấp mặc định "Nhập khẩu quốc tế"
        const defaultSuppliers = await tx.select().from(suppliers).where(eq(suppliers.name, "Nhập khẩu quốc tế")).limit(1);
        if (defaultSuppliers.length > 0) {
          targetSupplierId = defaultSuppliers[0].id;
        } else {
          const [newSupplier] = await tx.insert(suppliers).values({
            name: "Nhập khẩu quốc tế",
            country: itemData.originCountry || oldItem.originCountry || "US",
            isActive: true,
          }).returning();
          targetSupplierId = newSupplier.id;
        }
      }

      if (targetSupplierId && targetSupplierId !== "") {
        if (purchaseOrderItemId) {
          // 1. Đã có PO liên kết trước đó: Cập nhật PO hiện tại
          const poItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, purchaseOrderItemId)).limit(1);
          if (poItems.length > 0) {
            const poItem = poItems[0];
            const purchaseOrderId = poItem.purchaseOrderId;

            const unitCost = Number(itemData.costPrice || oldItem.costPrice) || 0;
            const quantity = poItem.quantity || 1;
            const totalItemsCost = unitCost * quantity;
            
            // Lấy giá trị cũ hoặc mới của shippingCost & taxImport
            const existingPo = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, purchaseOrderId)).limit(1);
            const oldShippingCost = existingPo[0]?.shippingCost ? Number(existingPo[0].shippingCost) : 0;
            const oldTaxImport = existingPo[0]?.taxImport ? Number(existingPo[0].taxImport) : 0;

            const finalShippingCost = shippingCost !== undefined ? (Number(shippingCost) || 0) : oldShippingCost;
            const finalTaxImport = taxImport !== undefined ? (Number(taxImport) || 0) : oldTaxImport;
            const totalCost = (totalItemsCost + finalShippingCost + finalTaxImport).toFixed(2);

            // Cập nhật thông tin trong purchaseOrders
            await tx.update(purchaseOrders).set({
              supplierId: targetSupplierId,
              shippingMethod: shippingMethod !== undefined ? (shippingMethod || null) : existingPo[0]?.shippingMethod,
              trackingNumber: trackingNumber !== undefined ? (trackingNumber || null) : existingPo[0]?.trackingNumber,
              trackingUrl: trackingUrl !== undefined ? (trackingUrl || null) : existingPo[0]?.trackingUrl,
              shippingCost: String(finalShippingCost),
              taxImport: String(finalTaxImport),
              totalCost: String(totalCost),
              originCountry: itemData.originCountry || oldItem.originCountry || "VN",
              updatedAt: new Date(),
            }).where(eq(purchaseOrders.id, purchaseOrderId));

            // Cập nhật chi tiết purchaseOrderItems nếu có thay đổi đơn giá costPrice
            if (itemData.costPrice) {
              await tx.update(purchaseOrderItems).set({
                unitCost: itemData.costPrice,
                totalCost: String(totalItemsCost.toFixed(2)),
              }).where(eq(purchaseOrderItems.id, purchaseOrderItemId));
            }
          }
        } else {
          // 2. Chưa có PO liên kết: Tạo PO mới và liên kết
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
          const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
          const poNumber = `PO-${dateStr}-${rand}`;

          const unitCost = Number(itemData.costPrice || oldItem.costPrice) || 0;
          const count = 1;
          const totalItemsCost = unitCost * count;
          const finalShippingCost = Number(shippingCost || 0);
          const finalTaxImport = Number(taxImport || 0);
          const totalCost = (totalItemsCost + finalShippingCost + finalTaxImport).toFixed(2);

          const [newPo] = await tx.insert(purchaseOrders).values({
            poNumber,
            supplierId: targetSupplierId,
            status: (itemData.status || oldItem.status) === "incoming" ? "in_transit" : "received",
            originCountry: itemData.originCountry || oldItem.originCountry || "VN",
            shippingMethod: shippingMethod || null,
            trackingNumber: trackingNumber || null,
            trackingUrl: trackingUrl || null,
            shippingCost: String(finalShippingCost),
            taxImport: String(finalTaxImport),
            totalCost: String(totalCost),
            notes: itemData.notes || oldItem.notes || null,
            expectedArrival: (itemData.status || oldItem.status) === 'incoming' ? (itemData.expectedArrivalDate || oldItem.expectedArrivalDate || null) : null,
            actualArrival: (itemData.status || oldItem.status) === 'in_stock' ? (itemData.stockedDate || oldItem.stockedDate || new Date().toISOString().split('T')[0]) : null,
            createdBy: performedById || null,
          }).returning();

          const [newPoItem] = await tx.insert(purchaseOrderItems).values({
            purchaseOrderId: newPo.id,
            productId: oldItem.productId,
            quantity: count,
            unitCost: String(unitCost),
            totalCost: String(totalItemsCost.toFixed(2)),
            receivedQuantity: (itemData.status || oldItem.status) === "in_stock" ? count : 0,
            notes: itemData.notes || oldItem.notes || null,
          }).returning();

          purchaseOrderItemId = newPoItem.id;
          (itemData as any).purchaseOrderItemId = purchaseOrderItemId;
        }
      } else if (supplierId === "") {
        // 3. User hủy chọn nhà cung cấp và không có tracking: Hủy liên kết PO
        purchaseOrderItemId = null;
        (itemData as any).purchaseOrderItemId = null;
      }

      // Tự động thiết lập ngày nhập kho thực tế và xóa ngày dự kiến khi chuyển từ incoming sang in_stock
      if (oldItem.status === 'incoming' && itemData.status === 'in_stock') {
        itemData.stockedDate = new Date().toISOString().split('T')[0];
        itemData.expectedArrivalDate = null;
      }

      const [updatedItem] = await tx.update(inventoryItems)
        .set({ ...itemData, updatedAt: new Date() })
        .where(eq(inventoryItems.id, id))
        .returning();

      // So sánh sự thay đổi để ghi nhận vào thẻ kho (Stock Card / Inventory Movements)
      const changes: string[] = [];
      const formatVND = (value: string | number | null) => {
        if (value === null || value === undefined || value === "") return "N/A";
        const num = Math.round(Number(value));
        if (isNaN(num)) return "N/A";
        return num.toLocaleString("vi-VN") + " ₫";
      };

      if (itemData.serialNumber && itemData.serialNumber !== oldItem.serialNumber) {
        changes.push(`Đổi Serial: "${oldItem.serialNumber}" ➔ "${itemData.serialNumber}"`);
      }
      if (itemData.costPrice && Number(itemData.costPrice) !== Number(oldItem.costPrice)) {
        changes.push(`Đổi Giá vốn: ${formatVND(oldItem.costPrice)} ➔ ${formatVND(itemData.costPrice)}`);
      }
      if (itemData.sellingPrice !== undefined && Number(itemData.sellingPrice || 0) !== Number(oldItem.sellingPrice || 0)) {
        changes.push(`Đổi Giá bán: ${formatVND(oldItem.sellingPrice)} ➔ ${formatVND(itemData.sellingPrice)}`);
      }
      if (itemData.condition && itemData.condition !== oldItem.condition) {
        const condMap = { new: "Mới", used: "Đã sử dụng" };
        changes.push(`Đổi Tình trạng: "${condMap[oldItem.condition as 'new'|'used'] || oldItem.condition}" ➔ "${condMap[itemData.condition as 'new'|'used'] || itemData.condition}"`);
      }
      if (itemData.status && itemData.status !== oldItem.status) {
        const statusMap = { incoming: "Đang về", in_stock: "Sẵn hàng", sold: "Đã bán", defective: "Lỗi", deleted: "Đã xóa" };
        changes.push(`Đổi Trạng thái: "${statusMap[oldItem.status as keyof typeof statusMap] || oldItem.status}" ➔ "${statusMap[itemData.status as keyof typeof statusMap] || itemData.status}"`);
      }

      if (changes.length > 0 && performedById) {
        const isStatusChanged = itemData.status && itemData.status !== oldItem.status;
        
        await tx.insert(inventoryMovements).values({
          inventoryItemId: id,
          movementType: isStatusChanged 
            ? (itemData.status === 'sold' ? 'sold' : 
               (itemData.status === 'warranty_repair' ? 'warranty_in' : 
               ((oldItem.status === 'incoming' && itemData.status === 'in_stock') ? 'stocked' : 'adjusted')))
            : 'adjusted',
          fromStatus: oldItem.status,
          toStatus: itemData.status || oldItem.status,
          referenceType: purchaseOrderItemId ? 'purchase_order' : 'manual',
          quantityChange: isStatusChanged 
            ? ((itemData.status === 'sold' || itemData.status === 'defective' || itemData.status === 'deleted') ? -1 : 
               ((oldItem.status === 'deleted' || oldItem.status === 'incoming') && itemData.status === 'in_stock' ? 1 : 0))
            : 0,
          performedBy: performedById,
          notes: itemData.notes || `Cập nhật thông tin: ${changes.join(", ")}`,
        });
      }

      // Đồng bộ trạng thái đơn nhập hàng
      if (purchaseOrderItemId) {
        const poItem = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, purchaseOrderItemId)).limit(1);
        if (poItem.length > 0) {
          await syncPurchaseOrderStatus(tx, poItem[0].purchaseOrderId);
        }
      }

      return { success: true, message: "Cập nhật thành công", item: updatedItem };
    });

    if (result.success) {
      try {
        after(() => {
          syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
        });
      } catch (e) {
        syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
      }
    }
    return result;
  } catch (error: any) {
    console.error("Lỗi cập nhật inventory item:", error);
    return { success: false, message: "Có lỗi xảy ra khi cập nhật." };
  }
}

// Xóa mềm máy (Đổi trạng thái sang deleted - Đã xóa)
export async function softDeleteInventoryItem(id: string) {
  return await updateInventoryItem(id, { 
    status: "deleted", 
    notes: "Xóa sản phẩm khỏi kho hàng (Ẩn lưu trữ dữ liệu)" 
  });
}

// Khôi phục máy đã xóa về kho hàng
export async function restoreInventoryItem(id: string) {
  return await updateInventoryItem(id, { 
    status: "in_stock", 
    notes: "Khôi phục sản phẩm từ trạng thái đã xóa về lại kho hàng" 
  });
}

// Xóa cứng máy khỏi kho (Xóa bản ghi nhật ký kho trước)
export async function deleteInventoryItem(id: string) {
  try {
    // 1. Xóa movements liên quan
    await db.delete(inventoryMovements).where(eq(inventoryMovements.inventoryItemId, id));
    // 2. Xóa item
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    
    return { success: true, message: "Xóa sản phẩm khỏi kho thành công" };
  } catch (error: any) {
    console.error("Lỗi xóa cứng inventory item:", error);
    return { success: false, message: "Không thể xóa sản phẩm khỏi kho." };
  }
}

// Lấy lịch sử thẻ kho (Stock Card Movements) của máy cụ thể
export async function getInventoryItemMovements(itemId: string) {
  try {
    const movements = await db
      .select({
        id: inventoryMovements.id,
        movementType: inventoryMovements.movementType,
        fromStatus: inventoryMovements.fromStatus,
        toStatus: inventoryMovements.toStatus,
        referenceType: inventoryMovements.referenceType,
        quantityChange: inventoryMovements.quantityChange,
        notes: inventoryMovements.notes,
        performedAt: inventoryMovements.performedAt,
        performedByName: profiles.fullName,
      })
      .from(inventoryMovements)
      .leftJoin(profiles, eq(inventoryMovements.performedBy, profiles.id))
      .where(eq(inventoryMovements.inventoryItemId, itemId))
      .orderBy(desc(inventoryMovements.performedAt));
    
    return movements;
  } catch (error) {
    console.error("Lỗi lấy lịch sử thẻ kho:", error);
    return [];
  }
}

// Xóa sạch dữ liệu giao dịch và kho hàng để nhập lại từ đầu
export async function clearAllSystemData() {
  try {
    return await db.transaction(async (tx) => {
      // 1. Xóa nhật ký và yêu cầu bảo hành
      await tx.delete(warrantyLogs);
      await tx.delete(warrantyClaims);
      
      // 2. Xóa chi tiết đổi trả và đơn đổi trả
      await tx.delete(returnItems);
      await tx.delete(returns);
      
      // 3. Xóa thanh toán và chi tiết đơn hàng
      await tx.delete(payments);
      await tx.delete(orderItems);
      
      // 4. Xóa chi tiết báo giá và báo giá
      await tx.delete(quotationItems);
      await tx.delete(quotations);
      
      // 5. Xóa đơn hàng
      await tx.delete(orders);
      
      // 6. Xóa chi tiết đơn nhập và đơn nhập
      await tx.delete(purchaseOrderItems);
      await tx.delete(purchaseOrders);
      
      // 7. Xóa lịch sử thẻ kho và sản phẩm trong kho
      await tx.delete(inventoryMovements);
      await tx.delete(inventoryItems);
      
      // 8. Xóa sổ quỹ và chi phí phát sinh
      await tx.delete(cashBookEntries);
      await tx.delete(expenses);
      
      // 9. Reset số liệu tích lũy của khách hàng về 0
      await tx.update(customers).set({
        totalSpent: "0",
        orderCount: 0,
        updatedAt: new Date(),
      });

      return { success: true, message: "Xóa sạch dữ liệu hệ thống thành công. Bạn có thể bắt đầu nhập kho mới." };
    });
  } catch (error: any) {
    console.error("Lỗi xóa sạch dữ liệu hệ thống:", error);
    return { success: false, message: error.message || "Không thể xóa sạch dữ liệu hệ thống" };
  }
}

// Cập nhật trạng thái hàng loạt (xác nhận hàng về kho hàng loạt)
export async function bulkConfirmArrival(ids: string[]) {
  try {
    if (!ids || ids.length === 0) return { success: false, message: "Danh sách sản phẩm trống" };

    const result = await db.transaction(async (tx) => {
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa có tài khoản nhân viên");

      const todayStr = new Date().toISOString().split('T')[0];
      const poIdsToSync = new Set<string>();

      for (const id of ids) {
        const existing = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
        if (existing.length > 0 && existing[0].status === 'incoming') {
          const item = existing[0];
          // 1. Cập nhật trạng thái máy
          await tx.update(inventoryItems)
            .set({
              status: 'in_stock',
              stockedDate: todayStr,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, id));

          // 2. Ghi nhận thẻ kho
          await tx.insert(inventoryMovements).values({
            inventoryItemId: id,
            movementType: 'stocked',
            fromStatus: 'incoming',
            toStatus: 'in_stock',
            referenceType: item.purchaseOrderItemId ? 'purchase_order' : 'manual',
            referenceId: item.purchaseOrderItemId || null,
            quantityChange: 1,
            performedBy: performedById,
            notes: 'Xác nhận hàng về kho hàng loạt',
          });

          // Lưu lại PO Id cần đồng bộ
          if (item.purchaseOrderItemId) {
            const poItem = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, item.purchaseOrderItemId)).limit(1);
            if (poItem.length > 0) {
              poIdsToSync.add(poItem[0].purchaseOrderId);
            }
          }
        }
      }

      // Đồng bộ trạng thái cho các đơn nhập hàng bị ảnh hưởng
      for (const poId of poIdsToSync) {
        await syncPurchaseOrderStatus(tx, poId);
      }

      return { success: true, message: `Đã xác nhận về kho thành công cho ${ids.length} máy!` };
    });

    if (result.success) {
      try {
        after(() => {
          syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
        });
      } catch (e) {
        syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
      }
    }
    return result;
  } catch (error: any) {
    console.error("Lỗi xác nhận về kho hàng loạt:", error);
    return { success: false, message: error.message || "Không thể xác nhận hàng về kho hàng loạt" };
  }
}

// Xóa hàng loạt sản phẩm khỏi kho (Soft delete hoặc Hard delete)
export async function bulkDeleteInventoryItems(ids: string[], isHardDelete: boolean = false) {
  try {
    if (!ids || ids.length === 0) return { success: false, message: "Danh sách sản phẩm trống" };

    return await db.transaction(async (tx) => {
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa có tài khoản nhân viên");

      for (const id of ids) {
        if (isHardDelete) {
          // Xóa thẻ kho trước
          await tx.delete(inventoryMovements).where(eq(inventoryMovements.inventoryItemId, id));
          // Xóa sản phẩm
          await tx.delete(inventoryItems).where(eq(inventoryItems.id, id));
        } else {
          const existing = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
          if (existing.length > 0) {
            const oldStatus = existing[0].status;
            await tx.update(inventoryItems)
              .set({
                status: 'deleted',
                notes: 'Xóa hàng loạt khỏi kho hàng',
                updatedAt: new Date(),
              })
              .where(eq(inventoryItems.id, id));

            // Ghi thẻ kho
            await tx.insert(inventoryMovements).values({
              inventoryItemId: id,
              movementType: 'adjusted',
              fromStatus: oldStatus,
              toStatus: 'deleted',
              referenceType: 'manual',
              quantityChange: -1,
              performedBy: performedById,
              notes: 'Xóa hàng loạt khỏi kho hàng (Ẩn lưu trữ)',
            });
          }
        }
      }
      return { success: true, message: `Đã xóa thành công ${ids.length} sản phẩm!` };
    });
  } catch (error: any) {
    console.error("Lỗi xóa hàng loạt sản phẩm:", error);
    return { success: false, message: error.message || "Không thể xóa hàng loạt sản phẩm" };
  }
}

// 12. Truy vết vòng đời sản phẩm chi tiết bằng số Serial
export async function getInventoryItemLifecycle(serialNumber: string) {
  try {
    const cleanSerial = serialNumber.trim();
    if (!cleanSerial) return { success: false, message: "Số Serial không hợp lệ" };

    // A. Tìm kiếm sản phẩm trong bảng inventoryItems
    const itemQuery = await db
      .select({
        id: inventoryItems.id,
        serialNumber: inventoryItems.serialNumber,
        condition: inventoryItems.condition,
        status: inventoryItems.status,
        costPrice: inventoryItems.costPrice,
        sellingPrice: inventoryItems.sellingPrice,
        accessoryCost: inventoryItems.accessoryCost,
        accessoryNotes: inventoryItems.accessoryNotes,
        stockedDate: inventoryItems.stockedDate,
        expectedArrivalDate: inventoryItems.expectedArrivalDate,
        receivedDate: inventoryItems.receivedDate,
        soldDate: inventoryItems.soldDate,
        warrantyStart: inventoryItems.warrantyStart,
        warrantyEnd: inventoryItems.warrantyEnd,
        notes: inventoryItems.notes,
        location: inventoryItems.location,
        createdAt: inventoryItems.createdAt,
        productName: products.name,
        productSku: products.sku,
        brandName: brands.name,
        categoryName: categories.name,
        productSpecs: products.specs,
        productId: inventoryItems.productId,
        supplierName: suppliers.name,
        poNumber: purchaseOrders.poNumber,
        purchaseOrderId: purchaseOrders.id,
        trackingNumber: purchaseOrders.trackingNumber,
        trackingUrl: purchaseOrders.trackingUrl,
        shippingMethod: purchaseOrders.shippingMethod,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(purchaseOrderItems, eq(inventoryItems.purchaseOrderItemId, purchaseOrderItems.id))
      .leftJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(inventoryItems.serialNumber, cleanSerial))
      .limit(1);

    if (itemQuery.length === 0) {
      return { success: false, message: `Không tìm thấy thiết bị nào có số Serial "${cleanSerial}"` };
    }

    const item = itemQuery[0];

    // B. Lấy lịch sử thẻ kho thô (Movements)
    const movements = await db
      .select({
        id: inventoryMovements.id,
        movementType: inventoryMovements.movementType,
        fromStatus: inventoryMovements.fromStatus,
        toStatus: inventoryMovements.toStatus,
        referenceType: inventoryMovements.referenceType,
        quantityChange: inventoryMovements.quantityChange,
        notes: inventoryMovements.notes,
        performedAt: inventoryMovements.performedAt,
        performedByName: profiles.fullName,
      })
      .from(inventoryMovements)
      .leftJoin(profiles, eq(inventoryMovements.performedBy, profiles.id))
      .where(eq(inventoryMovements.inventoryItemId, item.id))
      .orderBy(desc(inventoryMovements.performedAt));

    // C. Truy vấn lịch sử đơn hàng bán lẻ (Orders)
    const sales = await db
      .select({
        orderItemId: orderItems.id,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        sellingPrice: orderItems.sellingPrice,
        createdAt: orders.createdAt,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        status: orders.status,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orderItems.inventoryItemId, item.id));

    // D. Truy vấn lịch sử bảo hành/sửa chữa (Warranty Claims)
    const warranties = await db
      .select({
        id: warrantyClaims.id,
        claimNumber: warrantyClaims.claimNumber,
        issueDescription: warrantyClaims.issueDescription,
        repairCost: warrantyClaims.repairCost,
        status: warrantyClaims.status,
        receivedDate: warrantyClaims.receivedDate,
        actualReturnDate: warrantyClaims.actualReturnDate,
        technicianNotes: warrantyClaims.diagnosis,
        customerName: customers.fullName,
      })
      .from(warrantyClaims)
      .innerJoin(customers, eq(warrantyClaims.customerId, customers.id))
      .where(eq(warrantyClaims.inventoryItemId, item.id))
      .orderBy(desc(warrantyClaims.receivedDate));

    // E. Truy vấn lịch sử đổi trả (Returns)
    const returnsList = await db
      .select({
        returnItemId: returnItems.id,
        returnId: returns.id,
        returnNumber: returns.returnNumber,
        type: returns.type,
        reason: returnItems.returnReason,
        conditionOnReturn: returnItems.conditionOnReturn,
        isDefective: returnItems.isDefective,
        defectDescription: returnItems.defectDescription,
        refundPrice: returnItems.refundPrice,
        createdAt: returns.createdAt,
        customerName: customers.fullName,
      })
      .from(returnItems)
      .innerJoin(returns, eq(returnItems.returnId, returns.id))
      .innerJoin(customers, eq(returns.customerId, customers.id))
      .where(eq(returnItems.inventoryItemId, item.id))
      .orderBy(desc(returns.createdAt));

    // E2. Truy vấn lịch sử máy này được xuất để đổi thế vào (Replacement For)
    const replacementForList = await db
      .select({
        returnItemId: returnItems.id,
        returnId: returns.id,
        returnNumber: returns.returnNumber,
        type: returns.type,
        reason: returnItems.returnReason,
        createdAt: returns.createdAt,
        customerName: customers.fullName,
        oldItemSerial: sql<string>`(SELECT serial_number FROM inventory_items WHERE id = ${returnItems.inventoryItemId})`,
      })
      .from(returnItems)
      .innerJoin(returns, eq(returnItems.returnId, returns.id))
      .innerJoin(customers, eq(returns.customerId, customers.id))
      .where(eq(returnItems.newInventoryItemId, item.id))
      .orderBy(desc(returns.createdAt));

    // F. Tổng hợp Milestone Timeline
    const milestones: {
      type: "purchase" | "sale" | "warranty" | "return" | "movement";
      date: string;
      title: string;
      description: string;
      meta?: any;
    }[] = [];

    // 1. Nhập kho gốc (Stocked)
    milestones.push({
      type: "purchase",
      date: item.stockedDate || item.createdAt.toISOString().split("T")[0],
      title: "Nhập kho sản phẩm",
      description: `Nhập kho thiết bị tình trạng ${item.condition === 'new' ? 'Mới 100%' : 'Đã qua sử dụng'}. Giá vốn gốc nhập PO: ${Math.round(Number(item.costPrice)).toLocaleString("vi-VN")}đ.`,
      meta: {
        costPrice: item.costPrice,
        location: item.location || "Kệ chính",
        notes: item.notes,
        trackingNumber: item.trackingNumber,
        trackingUrl: item.trackingUrl,
        shippingMethod: item.shippingMethod,
      }
    });

    // 2. Bán lẻ (Sales)
    sales.forEach((s) => {
      milestones.push({
        type: "sale",
        date: new Date(s.createdAt).toISOString().split("T")[0],
        title: "Bán hàng thành công",
        description: `Bán thành công cho khách hàng ${s.customerName} (${s.customerPhone}) theo hóa đơn ${s.orderNumber}. Trị giá bán lẻ: ${Math.round(Number(s.sellingPrice)).toLocaleString("vi-VN")}đ.`,
        meta: {
          orderNumber: s.orderNumber,
          customerName: s.customerName,
          sellingPrice: s.sellingPrice,
          status: s.status
        }
      });
    });

    // 3. Đổi/Trả (Returns)
    returnsList.forEach((r) => {
      const typeLabel = r.type === "return" ? "Trả hàng hoàn tiền" : "Đổi hàng lấy máy khác";
      milestones.push({
        type: "return",
        date: new Date(r.createdAt).toISOString().split("T")[0],
        title: `Phiếu đổi/trả phát sinh (${typeLabel})`,
        description: `Khách hàng ${r.customerName} yêu cầu ${typeLabel.toLowerCase()} máy. Tình trạng lúc nhận lại: ${
          r.conditionOnReturn === 'like_new' ? 'Mới 100%' : 
          (r.conditionOnReturn === 'good' ? 'Hoạt động tốt / Xước nhẹ' : 
          (r.conditionOnReturn === 'damaged' ? 'Ngoại hình xấu' : 'Lỗi chức năng'))
        }. ${r.defectDescription ? `Ghi chú chi tiết: "${r.defectDescription}"` : ""}`,
        meta: {
          returnNumber: r.returnNumber,
          refundPrice: r.refundPrice,
          isDefective: r.isDefective,
          defectDescription: r.defectDescription
        }
      });
    });

    // 3b. Mốc đổi thế vào (Replacement For)
    replacementForList.forEach((r) => {
      milestones.push({
        type: "return",
        date: new Date(r.createdAt).toISOString().split("T")[0],
        title: `Được xuất đổi thế cho máy lỗi`,
        description: `Xuất thiết bị này để đổi thế cho máy lỗi (Serial cũ: ${r.oldItemSerial}) của khách hàng ${r.customerName} theo Phiếu đổi trả ${r.returnNumber}.`,
        meta: {
          returnNumber: r.returnNumber,
          oldItemSerial: r.oldItemSerial
        }
      });
    });

    // 4. Bảo hành (Warranties)
    warranties.forEach((w) => {
      milestones.push({
        type: "warranty",
        date: w.receivedDate,
        title: `Tiếp nhận Bảo hành dịch vụ`,
        description: `Mã phiếu nhận bảo hành: ${w.claimNumber}. Khách bảo hành: ${w.customerName}. Mô tả lỗi: "${w.issueDescription}". Chi phí sửa chữa phát sinh: ${Math.round(Number(w.repairCost || 0)).toLocaleString("vi-VN")}đ. ${w.technicianNotes ? `Ghi chú kỹ thuật: "${w.technicianNotes}"` : ""}`,
        meta: {
          claimNumber: w.claimNumber,
          status: w.status,
          repairCost: w.repairCost,
          actualReturnDate: w.actualReturnDate
        }
      });
    });

    // 5. Thẻ kho thô (Movements) quan trọng
    movements.forEach((m) => {
      if (m.movementType === 'adjusted' || m.movementType === 'warranty_in' || m.movementType === 'warranty_out') {
        const typeLabel = m.movementType === 'adjusted' ? 'Điều chỉnh kho' : (m.movementType === 'warranty_in' ? 'Nhập kho bảo hành' : 'Xuất kho bảo hành');
        milestones.push({
          type: "movement",
          date: new Date(m.performedAt).toISOString().split("T")[0],
          title: `Giao dịch thẻ kho: ${typeLabel}`,
          description: `Giao dịch được thực hiện bởi nhân viên ${m.performedByName || 'Hệ thống'}. Ghi chú: ${m.notes || 'Không có'}`,
          meta: {
            fromStatus: m.fromStatus,
            toStatus: m.toStatus
          }
        });
      }
    });

    // Sắp xếp Milestones tăng dần theo ngày
    const sortedMilestones = milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      success: true,
      item,
      milestones: sortedMilestones,
    };
  } catch (error: any) {
    console.error("Lỗi truy vết vòng đời thiết bị:", error);
    return { success: false, message: error.message || "Ghi nhận lỗi truy vết vòng đời thiết bị" };
  }
}

// ============================================================
// DEFECTIVE INVENTORY / KHO LỖI ACTIONS
// ============================================================



export async function reportItemDefectiveAction(itemId: string, notes: string) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, itemId))
        .limit(1);

      if (existing.length === 0) {
        return { success: false, message: "Không tìm thấy sản phẩm" };
      }

      const item = existing[0];
      if (item.status === 'deleted') {
        return { success: false, message: "Sản phẩm đã bị xóa" };
      }

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      await tx
        .update(inventoryItems)
        .set({
          status: 'defective',
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));

      await tx.insert(inventoryMovements).values({
        inventoryItemId: itemId,
        movementType: 'defective',
        fromStatus: item.status,
        toStatus: 'defective',
        referenceType: 'manual',
        quantityChange: -1,
        notes: notes || "Báo lỗi máy từ kho hàng",
        performedBy: performedById,
      });

      return { success: true, message: "Báo lỗi máy thành công" };
    });
  } catch (error: any) {
    console.error("Lỗi báo lỗi máy:", error);
    return { success: false, message: error.message || "Lỗi báo lỗi máy" };
  }
}

export async function sendToRepairAction(
  itemId: string, 
  repairType: 'internal' | 'supplier', 
  supplierId?: string, 
  notes?: string
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, itemId))
        .limit(1);

      if (existing.length === 0) {
        return { success: false, message: "Không tìm thấy sản phẩm" };
      }

      const item = existing[0];
      if (item.status !== 'defective') {
        return { success: false, message: "Chỉ được gửi đi sửa các thiết bị đang lỗi" };
      }

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      await tx
        .update(inventoryItems)
        .set({
          status: 'warranty_repair',
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));

      const typeLabel = repairType === 'internal' ? 'Sửa chữa nội bộ' : 'Gửi bảo hành NCC';

      await tx.insert(inventoryMovements).values({
        inventoryItemId: itemId,
        movementType: 'warranty_out',
        fromStatus: 'defective',
        toStatus: 'warranty_repair',
        referenceType: 'manual',
        quantityChange: 0,
        notes: notes ? `[${typeLabel}] ${notes}` : `Gửi máy đi sửa: ${typeLabel}`,
        performedBy: performedById,
      });

      return { success: true, message: "Gửi sửa máy thành công" };
    });
  } catch (error: any) {
    console.error("Lỗi gửi sửa máy:", error);
    return { success: false, message: error.message || "Lỗi gửi sửa máy" };
  }
}

export async function completeRepairAction(
  itemId: string, 
  repairCost: string, 
  paymentMethod?: 'cash' | 'bank_transfer' | 'card'
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, itemId))
        .limit(1);

      if (existing.length === 0) {
        return { success: false, message: "Không tìm thấy sản phẩm" };
      }

      const item = existing[0];
      if (item.status !== 'warranty_repair') {
        return { success: false, message: "Thiết bị không ở trạng thái đang bảo hành/sửa chữa" };
      }

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      await tx
        .update(inventoryItems)
        .set({
          status: 'in_stock',
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));

      await tx.insert(inventoryMovements).values({
        inventoryItemId: itemId,
        movementType: 'warranty_in',
        fromStatus: 'warranty_repair',
        toStatus: 'in_stock',
        referenceType: 'manual',
        quantityChange: 1,
        notes: "Nhập lại kho sau khi sửa chữa/bảo hành hoàn tất",
        performedBy: performedById,
      });

      const costVal = Number(repairCost || 0);
      if (costVal > 0) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const entryNumber = `CB${dateStr}-${randomSuffix}`;

        await tx.insert(cashBookEntries).values({
          entryNumber,
          type: "expense",
          category: "warranty_repair",
          amount: costVal.toString(),
          runningBalance: "0",
          paymentMethod: paymentMethod || "cash",
          referenceType: "other",
          referenceId: itemId,
          description: `[Đồng bộ] Chi phí sửa chữa/bảo hành thiết bị lỗi (Serial: ${item.serialNumber})`,
          entryDate: new Date().toISOString().split("T")[0],
          createdBy: performedById,
        });

        await recalculateRunningBalances(tx);
      }

      return { success: true, message: "Hoàn tất sửa chữa, đã nhập lại kho sẵn hàng" };
    });
  } catch (error: any) {
    console.error("Lỗi hoàn tất sửa chữa:", error);
    return { success: false, message: error.message || "Lỗi hoàn tất sửa chữa" };
  }
}

export async function supplierRefundAction(
  itemId: string, 
  refundAmount: string, 
  paymentMethod?: 'cash' | 'bank_transfer' | 'card', 
  notes?: string
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, itemId))
        .limit(1);

      if (existing.length === 0) {
        return { success: false, message: "Không tìm thấy sản phẩm" };
      }

      const item = existing[0];
      if (item.status !== 'defective' && item.status !== 'warranty_repair') {
        return { success: false, message: "Chỉ hoàn tiền cho máy lỗi hoặc đang bảo hành" };
      }

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      await tx
        .update(inventoryItems)
        .set({
          status: 'returned',
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));

      await tx.insert(inventoryMovements).values({
        inventoryItemId: itemId,
        movementType: 'returned',
        fromStatus: item.status,
        toStatus: 'returned',
        referenceType: 'manual',
        quantityChange: 0,
        notes: notes ? `[Trả NCC hoàn tiền] ${notes}` : `Xuất trả hàng lỗi cho NCC để lấy lại tiền`,
        performedBy: performedById,
      });

      const refundVal = Number(refundAmount || 0);
      if (refundVal > 0) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const entryNumber = `CB${dateStr}-${randomSuffix}`;

        await tx.insert(cashBookEntries).values({
          entryNumber,
          type: "income",
          category: "purchase",
          amount: refundVal.toString(),
          runningBalance: "0",
          paymentMethod: paymentMethod || "cash",
          referenceType: "other",
          referenceId: itemId,
          description: `[Đồng bộ] Thu hồi tiền hoàn từ NCC cho máy lỗi (Serial: ${item.serialNumber})`,
          entryDate: new Date().toISOString().split("T")[0],
          createdBy: performedById,
        });

        await recalculateRunningBalances(tx);
      }

      return { success: true, message: "Trả hàng hoàn tiền thành công, đã tạo phiếu thu và xuất kho" };
    });
  } catch (error: any) {
    console.error("Lỗi xuất trả hoàn tiền NCC:", error);
    return { success: false, message: error.message || "Lỗi xuất trả hoàn tiền NCC" };
  }
}

export async function supplierReturnWriteOffAction(itemId: string) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, itemId))
        .limit(1);

      if (existing.length === 0) {
        return { success: false, message: "Không tìm thấy sản phẩm" };
      }

      const item = existing[0];
      if (item.status !== 'defective' && item.status !== 'warranty_repair') {
        return { success: false, message: "Chỉ xuất trả máy lỗi hoặc đang bảo hành" };
      }

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      await tx
        .update(inventoryItems)
        .set({
          status: 'returned',
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, itemId));

      await tx.insert(inventoryMovements).values({
        inventoryItemId: itemId,
        movementType: 'returned',
        fromStatus: item.status,
        toStatus: 'returned',
        referenceType: 'manual',
        quantityChange: 0,
        notes: `Xuất trả máy cũ lỗi cho NCC để đổi máy mới (Người dùng tự nhập kho máy mới)`,
        performedBy: performedById,
      });

      return { success: true, message: "Xuất trả máy cũ thành công. Vui lòng nhập kho máy mới thủ công." };
    });
  } catch (error: any) {
    console.error("Lỗi xuất trả máy đổi trả NCC:", error);
    return { success: false, message: error.message || "Lỗi xuất trả máy đổi trả NCC" };
  }
}
