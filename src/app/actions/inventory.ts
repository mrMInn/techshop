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
  suppliers,
  accessoryCatalog,
  accessoryItems
} from "@/lib/db/schema";
import { db, recalculateRunningBalances } from "@/lib/db";
import { eq, desc, inArray, sql, and, or, like, ilike, lte } from "drizzle-orm";
import { syncHistoricalData } from "./accounting";
import { sendSystemNotification } from "@/lib/notifications";
import { after } from "next/server";
import { serverCache } from "@/lib/cache";

// Helper function: Đồng bộ số lượng thực nhận và trạng thái của Đơn nhập hàng (Purchase Order)
export async function syncPurchaseOrderStatus(tx: any, purchaseOrderId: string) {
  // 1. Lấy tất cả chi tiết sản phẩm thuộc đơn nhập hàng
  const poItems = await tx
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

  if (poItems.length === 0) return;

  const poItemIds = poItems.map((item: any) => item.id);

  // 2. Lấy số lượng máy lẻ đã nhận của tất cả poItems trong PO này bằng một câu query duy nhất
  const receivedCounts = await tx
    .select({
      purchaseOrderItemId: inventoryItems.purchaseOrderItemId,
      count: sql<number>`cast(count(${inventoryItems.id}) as integer)`
    })
    .from(inventoryItems)
    .where(
      and(
        inArray(inventoryItems.purchaseOrderItemId, poItemIds),
        inArray(inventoryItems.status, [
          "in_stock",
          "reserved",
          "sold",
          "warranty_repair",
          "returned",
          "defective"
        ])
      )
    )
    .groupBy(inventoryItems.purchaseOrderItemId);

  const countMap: Record<string, number> = {};
  for (const row of receivedCounts) {
    if (row.purchaseOrderItemId) {
      countMap[row.purchaseOrderItemId] = Number(row.count || 0);
    }
  }

  let totalQty = 0;
  let totalReceived = 0;

  for (const item of poItems) {
    const receivedCount = countMap[item.id] || 0;

    // Cập nhật số lượng đã nhận thực tế cho sản phẩm này trong đơn nhập
    await tx
      .update(purchaseOrderItems)
      .set({ receivedQuantity: receivedCount })
      .where(eq(purchaseOrderItems.id, item.id));

    totalQty += item.quantity;
    totalReceived += receivedCount;
  }

  // Lấy thông tin đơn nhập hiện tại
  const currentPo = await tx
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, purchaseOrderId))
    .limit(1);

  if (currentPo.length === 0) return;
  const currentStatus = currentPo[0].status;

  // Đếm tất cả máy lẻ thuộc đơn nhập này và trạng thái của chúng
  const allPoItemsInInventory = await tx
    .select({ 
      id: inventoryItems.id,
      status: inventoryItems.status 
    })
    .from(inventoryItems)
    .innerJoin(purchaseOrderItems, eq(inventoryItems.purchaseOrderItemId, purchaseOrderItems.id))
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

  const totalInventoryCount = allPoItemsInInventory.length;
  const returnedCount = allPoItemsInInventory.filter((i: any) => i.status === "returned").length;

  let newStatus: any = currentStatus;

  // Nếu tất cả máy đều đã được trả lại NCC
  if (totalInventoryCount > 0 && returnedCount === totalInventoryCount) {
    newStatus = "returned_supplier";
  } else if (currentStatus === "warranty_supplier" || currentStatus === "returned_supplier") {
    // Giữ nguyên trạng thái thủ công
    newStatus = currentStatus;
  } else {
    // Trạng thái bình thường: Đang vận chuyển, Nhận một phần hoặc Đã sẵn hàng
    if (totalReceived > 0) {
      if (totalReceived >= totalQty) {
        newStatus = "received";
      } else {
        newStatus = "partially_received";
      }
    } else {
      newStatus = "in_transit";
    }
  }

  // Cập nhật trạng thái và ngày nhận thực tế của đơn nhập hàng
  const todayStr = new Date().toISOString().split("T")[0];
  await tx
    .update(purchaseOrders)
    .set({
      status: newStatus,
      actualArrival: newStatus === "received" ? todayStr : (newStatus === "in_transit" ? null : currentPo[0].actualArrival),
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

  // Fetch attached accessories
  const attachedAccs = await db
    .select({
      id: accessoryItems.id,
      inventoryItemId: accessoryItems.inventoryItemId,
      serialNumber: accessoryItems.serialNumber,
      unitCost: accessoryItems.unitCost,
      sellingPrice: accessoryItems.sellingPrice,
      catalogName: accessoryCatalog.name,
    })
    .from(accessoryItems)
    .innerJoin(accessoryCatalog, eq(accessoryItems.accessoryCatalogId, accessoryCatalog.id))
    .where(eq(accessoryItems.status, "attached"));

  const accMap: Record<string, any[]> = {};
  for (const acc of attachedAccs) {
    if (acc.inventoryItemId) {
      if (!accMap[acc.inventoryItemId]) {
        accMap[acc.inventoryItemId] = [];
      }
      accMap[acc.inventoryItemId].push(acc);
    }
  }

  const itemsWithAccessories = items.map(item => ({
    ...item,
    accessoryCost: "0",
    accessoryNotes: null,
    taxImport: "0",
    accessories: accMap[item.id] || [],
  }));

  return itemsWithAccessories;
}

/**
 * Lấy danh sách tồn kho quá hạn (trên 45 ngày) đã tối ưu cho Dashboard
 */
export async function getAgedInventoryItems(daysThreshold = 45) {
  const cacheKey = `aged_inventory_items_${daysThreshold}`;
  const cached = serverCache.get(cacheKey);
  if (cached) {
    console.log(`CACHE HIT: getAgedInventoryItems (${daysThreshold})`);
    return cached;
  }
  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
    const thresholdDateStr = thresholdDate.toISOString().split("T")[0];

    const items = await db
      .select({
        id: inventoryItems.id,
        productId: inventoryItems.productId,
        productName: products.name,
        productSpecs: products.specs,
        brandName: brands.name,
        categoryName: categories.name,
        costPrice: inventoryItems.costPrice,
        stockedDate: inventoryItems.stockedDate,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(inventoryItems.status, "in_stock"),
          sql`${inventoryItems.stockedDate} IS NOT NULL`,
          lte(inventoryItems.stockedDate, thresholdDateStr)
        )
      )
      .orderBy(inventoryItems.stockedDate)
      .limit(500);

    if (items.length === 0) {
      return { agedItems: [], tongVonDong: 0, totalCount: 0 };
    }

    const productIds = Array.from(new Set(items.map(i => i.productId)));

    const inStockStats = await db
      .select({
        productId: inventoryItems.productId,
        count: sql<number>`cast(count(${inventoryItems.id}) as integer)`,
        totalCost: sql<number>`cast(coalesce(sum(${inventoryItems.costPrice}), 0) as double precision)`,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.status, "in_stock"),
          inArray(inventoryItems.productId, productIds)
        )
      )
      .groupBy(inventoryItems.productId);

    const statsMap: Record<string, { count: number; totalCost: number }> = {};
    inStockStats.forEach(s => {
      statsMap[s.productId] = { count: Number(s.count || 0), totalCost: Number(s.totalCost || 0) };
    });

    const agedModelsMap: Record<string, any> = {};
    const today = new Date();

    items.forEach((item) => {
      const stocked = new Date(item.stockedDate!);
      const diffTime = today.getTime() - stocked.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const key = item.productId;
      if (!agedModelsMap[key]) {
        const stats = statsMap[key] || { count: 1, totalCost: Number(item.costPrice || 0) };
        const avgCost = stats.count > 0 ? Math.round(stats.totalCost / stats.count) : 0;
        agedModelsMap[key] = {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productSpecs: item.productSpecs,
          brandName: item.brandName,
          categoryName: item.categoryName,
          stockedDate: item.stockedDate,
          diffDays,
          stockQty: stats.count,
          rowDongVon: stats.totalCost,
          avgCost,
        };
      } else {
        if (diffDays > agedModelsMap[key].diffDays) {
          agedModelsMap[key].diffDays = diffDays;
          agedModelsMap[key].stockedDate = item.stockedDate;
        }
      }
    });

    const agedItemsList = Object.values(agedModelsMap).sort((a: any, b: any) => b.diffDays - a.diffDays);
    const tongVonDong = agedItemsList.reduce((sum: number, item: any) => sum + item.rowDongVon, 0);

    const result = {
      agedItems: agedItemsList,
      tongVonDong,
      totalCount: agedItemsList.length,
    };
    serverCache.set(cacheKey, result, 300); // 5 minutes cache
    return result;
  } catch (error) {
    console.error("Lỗi lấy danh sách tồn kho quá hạn:", error);
    return { agedItems: [], tongVonDong: 0, totalCount: 0 };
  }
}


/**
 * Lấy báo cáo tổng hợp vốn tồn kho (Tổng vốn máy lẻ + Phụ kiện + Cơ cấu danh mục)
 */
export async function getInventoryCapitalSummary() {
  const cacheKey = "inventory_capital_summary";
  const cached = serverCache.get(cacheKey);
  if (cached) {
    console.log("CACHE HIT: getInventoryCapitalSummary");
    return cached;
  }

  try {
    // 1. Tổng vốn máy lẻ
    const [machineStats] = await db
      .select({
        count: sql<number>`cast(count(${inventoryItems.id}) as integer)`,
        totalCost: sql<number>`cast(coalesce(sum(${inventoryItems.costPrice}), 0) as double precision)`,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.status, "in_stock"));

    // 2. Tổng vốn phụ kiện
    const [accessoryStats] = await db
      .select({
        count: sql<number>`cast(count(${accessoryItems.id}) as integer)`,
        totalCost: sql<number>`cast(coalesce(sum(${accessoryItems.unitCost}), 0) as double precision)`,
      })
      .from(accessoryItems)
      .where(eq(accessoryItems.status, "in_stock"));

    // 3. Cơ cấu vốn máy lẻ theo danh mục
    const machineCategoryStats = await db
      .select({
        categoryId: products.categoryId,
        categoryName: categories.name,
        count: sql<number>`cast(count(${inventoryItems.id}) as integer)`,
        totalCost: sql<number>`cast(coalesce(sum(${inventoryItems.costPrice}), 0) as double precision)`,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(inventoryItems.status, "in_stock"))
      .groupBy(products.categoryId, categories.name)
      .orderBy(desc(sql`sum(${inventoryItems.costPrice})`));

    // 4. Cơ cấu vốn phụ kiện theo loại phụ kiện
    const accessoryCatalogStats = await db
      .select({
        catalogId: accessoryItems.accessoryCatalogId,
        catalogName: accessoryCatalog.name,
        count: sql<number>`cast(count(${accessoryItems.id}) as integer)`,
        totalCost: sql<number>`cast(coalesce(sum(${accessoryItems.unitCost}), 0) as double precision)`,
      })
      .from(accessoryItems)
      .innerJoin(accessoryCatalog, eq(accessoryItems.accessoryCatalogId, accessoryCatalog.id))
      .where(eq(accessoryItems.status, "in_stock"))
      .groupBy(accessoryItems.accessoryCatalogId, accessoryCatalog.name)
      .orderBy(desc(sql`sum(${accessoryItems.unitCost})`));

    const totalMachineCapital = Number(machineStats?.totalCost || 0);
    const totalAccessoryCapital = Number(accessoryStats?.totalCost || 0);
    const totalCapital = totalMachineCapital + totalAccessoryCapital;

    const result = {
      totalCapital,
      machineCapital: {
        totalCost: totalMachineCapital,
        count: Number(machineStats?.count || 0),
      },
      accessoryCapital: {
        totalCost: totalAccessoryCapital,
        count: Number(accessoryStats?.count || 0),
      },
      machineCategoryStats: machineCategoryStats.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        count: Number(c.count || 0),
        totalCost: Number(c.totalCost || 0),
      })),
      accessoryCatalogStats: accessoryCatalogStats.map(a => ({
        catalogId: a.catalogId,
        catalogName: a.catalogName,
        count: Number(a.count || 0),
        totalCost: Number(a.totalCost || 0),
      })),
    };

    serverCache.set(cacheKey, result, 300); // 5 minutes cache
    return result;
  } catch (error) {
    console.error("Lỗi lấy báo cáo vốn tồn kho:", error);
    return {
      totalCapital: 0,
      machineCapital: { totalCost: 0, count: 0 },
      accessoryCapital: { totalCost: 0, count: 0 },
      machineCategoryStats: [],
      accessoryCatalogStats: [],
    };
  }
}


/**
 * Lấy danh sách thiết bị gom nhóm theo Model Sản phẩm (có phân trang và bộ lọc phía máy chủ)
 */
export async function getInventoryGroups(filters?: {
  page?: number;
  limit?: number;
  categoryName?: string;
  brandName?: string;
  status?: string; // 'all' | 'in_stock' | 'incoming' | 'defective'
  search?: string;
}) {
  try {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters?.categoryName && filters.categoryName !== "all") {
      conditions.push(eq(categories.name, filters.categoryName));
    }
    if (filters?.brandName && filters.brandName !== "all") {
      conditions.push(eq(brands.name, filters.brandName));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(brands.name, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`),
          ilike(inventoryItems.serialNumber, `%${filters.search}%`)
        )
      );
    }

    let statusCondition;
    if (filters?.status === "in_stock") {
      statusCondition = eq(inventoryItems.status, "in_stock");
    } else if (filters?.status === "incoming") {
      statusCondition = eq(inventoryItems.status, "incoming");
    } else if (filters?.status === "defective") {
      statusCondition = or(
        eq(inventoryItems.status, "defective"),
        eq(inventoryItems.status, "warranty_repair")
      );
    } else if (filters?.status === "returned") {
      statusCondition = eq(inventoryItems.status, "returned");
    } else {
      statusCondition = inArray(inventoryItems.status, ["in_stock", "incoming", "defective", "warranty_repair"]);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Đếm tổng số nhóm sản phẩm
    let countGroupsQuery = db
      .select({
        count: sql<number>`cast(count(distinct ${products.id}) as integer)`
      })
      .from(products)
      .innerJoin(inventoryItems, and(eq(inventoryItems.productId, products.id), statusCondition))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id));

    if (whereClause) {
      countGroupsQuery.where(whereClause);
    }
    const countRes = await countGroupsQuery;
    const totalCount = countRes[0]?.count || 0;

    // 2. Query lấy danh sách gom nhóm và tính toán AVG/COUNT
    let selectQuery = db
      .select({
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        productSpecs: products.specs,
        brandName: brands.name,
        categoryName: categories.name,
        inStockCount: sql<number>`cast(count(case when ${inventoryItems.status} = 'in_stock' then 1 end) as integer)`,
        incomingCount: sql<number>`cast(count(case when ${inventoryItems.status} = 'incoming' then 1 end) as integer)`,
        defectiveOnlyCount: sql<number>`cast(count(case when ${inventoryItems.status} = 'defective' then 1 end) as integer)`,
        internalRepairCount: sql<number>`cast(count(case when ${inventoryItems.status} = 'warranty_repair' and ${inventoryItems.location} = 'internal_repair' then 1 end) as integer)`,
        externalWarrantyCount: sql<number>`cast(count(case when ${inventoryItems.status} = 'warranty_repair' and ${inventoryItems.location} != 'internal_repair' then 1 end) as integer)`,
        returnedCount: sql<number>`cast(count(case when ${inventoryItems.status} = 'returned' then 1 end) as integer)`,
        defectiveTotalCount: sql<number>`cast(count(case when ${inventoryItems.status} in ('defective', 'warranty_repair') then 1 end) as integer)`,
        totalCount: sql<number>`cast(count(case when ${inventoryItems.status} in ('in_stock', 'incoming', 'defective', 'warranty_repair') then 1 end) as integer)`,
        avgCost: sql<number>`cast(coalesce(avg(${inventoryItems.costPrice}), 0) as double precision)`,
        supplierNamesAgg: sql<string>`coalesce(string_agg(distinct ${suppliers.name}, ','), '')`,
      })
      .from(products)
      .innerJoin(inventoryItems, and(eq(inventoryItems.productId, products.id), statusCondition))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(purchaseOrderItems, eq(inventoryItems.purchaseOrderItemId, purchaseOrderItems.id))
      .leftJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id));

    if (whereClause) {
      selectQuery.where(whereClause);
    }

    selectQuery
      .groupBy(products.id, brands.name, categories.name)
      .orderBy(desc(sql`max(${inventoryItems.createdAt})`))
      .limit(limit)
      .offset(offset);

    const list = await selectQuery;
    
    // Convert avgCost sang chuỗi định dạng tiền số để client dễ nhận diện
    const formattedList = list.map(item => ({
      ...item,
      avgCost: String(item.avgCost || 0),
      costPrices: [Number(item.avgCost || 0)], // support client fallback costPrices array
      supplierNames: item.supplierNamesAgg ? item.supplierNamesAgg.split(',').filter(Boolean) : [],
    }));

    return { list: formattedList, totalCount };
  } catch (error) {
    console.error("Lỗi lấy danh sách gom nhóm kho hàng:", error);
    return { list: [], totalCount: 0 };
  }
}

/**
 * Lấy danh sách máy lẻ chi tiết của 1 sản phẩm cụ thể (cho Drawer chi tiết)
 */
export async function getInventoryItemsByProduct(productId: string) {
  try {
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
      .where(
        and(
          eq(inventoryItems.productId, productId),
          inArray(inventoryItems.status, ['incoming', 'in_stock', 'sold', 'warranty_repair', 'returned', 'defective', 'deleted'])
        )
      )
      .orderBy(desc(inventoryItems.createdAt), desc(inventoryItems.id));

    // Fetch attached accessories
    const attachedAccs = await db
      .select({
        id: accessoryItems.id,
        inventoryItemId: accessoryItems.inventoryItemId,
        serialNumber: accessoryItems.serialNumber,
        unitCost: accessoryItems.unitCost,
        sellingPrice: accessoryItems.sellingPrice,
        catalogName: accessoryCatalog.name,
      })
      .from(accessoryItems)
      .innerJoin(accessoryCatalog, eq(accessoryItems.accessoryCatalogId, accessoryCatalog.id))
      .where(eq(accessoryItems.status, "attached"));

    const accMap: Record<string, any[]> = {};
    for (const acc of attachedAccs) {
      if (acc.inventoryItemId) {
        if (!accMap[acc.inventoryItemId]) {
          accMap[acc.inventoryItemId] = [];
        }
        accMap[acc.inventoryItemId].push(acc);
      }
    }

    const itemsWithAccessories = items.map(item => ({
      ...item,
      accessoryCost: "0",
      accessoryNotes: null,
      taxImport: "0",
      accessories: accMap[item.id] || [],
    }));

    return itemsWithAccessories;
  } catch (error) {
    console.error("Lỗi lấy danh sách máy lẻ theo sản phẩm:", error);
    return [];
  }
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
  accessoryCost?: string;
  accessoryNotes?: string;
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

      const unitCost = Number(data.costPrice) || 0;
      const shippingCost = Number(data.shippingCost) || 0;
      const loadedCostPrice = (unitCost + shippingCost).toFixed(2);

      if (targetSupplierId) {
        // Sinh poNumber ngẫu nhiên độc nhất
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        const poNumber = `PO-${dateStr}-${rand}`;

        const count = 1;
        const totalItemsCost = unitCost * count;
        const totalCost = (totalItemsCost + shippingCost).toFixed(2);

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
        costPrice: loadedCostPrice,
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
        const totalCost = (totalItemsCost + shippingCost).toFixed(2);

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

      const count = cleanSerials.length;
      const unitCost = Number(data.costPrice) || 0;
      const shippingCost = Number(data.shippingCost) || 0;
      const allocatedShipping = count > 0 ? shippingCost / count : 0;
      const loadedCostPrice = (unitCost + allocatedShipping).toFixed(2);

      // 2. Tạo các items hàng loạt (Bulk Insert)
      const itemsToInsert = cleanSerials.map(serial => ({
        productId: data.productId,
        serialNumber: serial,
        condition: data.condition,
        status: data.status,
        costPrice: loadedCostPrice,
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

    if (result.success && result.items) {
      try {
        after(async () => {
          syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));

          if (process.env.NODE_ENV !== 'test') {
            try {
              const product = await db.select().from(products).where(eq(products.id, data.productId)).limit(1);
              const productName = product[0]?.name || "Thiết bị";

              const statusMap = { incoming: "Đang về", in_stock: "Sẵn hàng", sold: "Đã bán", defective: "Lỗi", deleted: "Đã xóa", warranty_repair: "Bảo hành" };
              const statusLabel = statusMap[data.status as keyof typeof statusMap] || data.status;

              const condMap = { new: "Mới", used: "Đã sử dụng" };
              const condLabel = condMap[data.condition as 'new'|'used'] || data.condition;

              const formatVND = (value: string | number | null) => {
                if (value === null || value === undefined || value === "") return "N/A";
                const num = Math.round(Number(value));
                if (isNaN(num)) return "N/A";
                return num.toLocaleString("vi-VN") + " ₫";
              };

              await sendSystemNotification("inventory_added", {
                product_name: productName,
                quantity: String(cleanSerials.length),
                condition: condLabel,
                cost_price: formatVND(data.costPrice),
                status: statusLabel,
                serials_list: cleanSerials.map((s, idx) => `${idx + 1}. <code>${s}</code>`).join("\n")
              });
            } catch (notifyErr) {
              console.error("Lỗi gửi thông báo nhập kho:", notifyErr);
            }
          }
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
        taxImport, // ignored
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
            
            // Lấy giá trị cũ hoặc mới của shippingCost
            const existingPo = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, purchaseOrderId)).limit(1);
            const oldShippingCost = existingPo[0]?.shippingCost ? Number(existingPo[0].shippingCost) : 0;

            const finalShippingCost = shippingCost !== undefined ? (Number(shippingCost) || 0) : oldShippingCost;
            const totalCost = (totalItemsCost + finalShippingCost).toFixed(2);

            // Cập nhật thông tin trong purchaseOrders
            await tx.update(purchaseOrders).set({
              supplierId: targetSupplierId,
              shippingMethod: shippingMethod !== undefined ? (shippingMethod || null) : existingPo[0]?.shippingMethod,
              trackingNumber: trackingNumber !== undefined ? (trackingNumber || null) : existingPo[0]?.trackingNumber,
              trackingUrl: trackingUrl !== undefined ? (trackingUrl || null) : existingPo[0]?.trackingUrl,
              shippingCost: String(finalShippingCost),
              totalCost: String(totalCost),
              originCountry: itemData.originCountry || oldItem.originCountry || "VN",
              updatedAt: new Date(),
            }).where(eq(purchaseOrders.id, purchaseOrderId));

            // Tính toán lại loadedCostPrice cho máy
            const poCountResult = await tx
              .select({ count: sql<number>`cast(count(${inventoryItems.id}) as integer)` })
              .from(inventoryItems)
              .where(eq(inventoryItems.purchaseOrderItemId, purchaseOrderItemId));
            const poCount = poCountResult[0]?.count || 1;
            const allocatedShipping = finalShippingCost / poCount;
            itemData.costPrice = (unitCost + allocatedShipping).toFixed(2);

            // Cập nhật chi tiết purchaseOrderItems nếu có thay đổi đơn giá costPrice
            await tx.update(purchaseOrderItems).set({
              unitCost: String(unitCost),
              totalCost: String(totalItemsCost.toFixed(2)),
            }).where(eq(purchaseOrderItems.id, purchaseOrderItemId));
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
          const totalCost = (totalItemsCost + finalShippingCost).toFixed(2);

          const [newPo] = await tx.insert(purchaseOrders).values({
            poNumber,
            supplierId: targetSupplierId,
            status: (itemData.status || oldItem.status) === "incoming" ? "in_transit" : "received",
            originCountry: itemData.originCountry || oldItem.originCountry || "VN",
            shippingMethod: shippingMethod || null,
            trackingNumber: trackingNumber || null,
            trackingUrl: trackingUrl || null,
            shippingCost: String(finalShippingCost),
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
          itemData.costPrice = (unitCost + finalShippingCost).toFixed(2);
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

      return { success: true, message: "Cập nhật thành công", item: updatedItem, changes };
    });

    if (result.success && result.item) {
      try {
        after(async () => {
          syncHistoricalData().catch(err => console.error("Lỗi đồng bộ lịch sử tài chính:", err));
          
          if (result.changes && result.changes.length > 0 && process.env.NODE_ENV !== 'test') {
            try {
              const product = await db.select().from(products).where(eq(products.id, result.item.productId)).limit(1);
              const productName = product[0]?.name || "Thiết bị";
              
              const statusMap = { incoming: "Đang về", in_stock: "Sẵn hàng", sold: "Đã bán", defective: "Lỗi", deleted: "Đã xóa", warranty_repair: "Bảo hành" };
              const statusLabel = statusMap[result.item.status as keyof typeof statusMap] || result.item.status;

              await sendSystemNotification("inventory_updated", {
                product_name: productName,
                serial_number: result.item.serialNumber,
                status: statusLabel,
                change_log: result.changes.join("\n")
              });
            } catch (notifyErr) {
              console.error("Lỗi gửi thông báo cập nhật kho:", notifyErr);
            }
          }
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

      // 1. Lấy tất cả các items được yêu cầu bằng một câu SELECT duy nhất
      const existing = await tx
        .select()
        .from(inventoryItems)
        .where(inArray(inventoryItems.id, ids));

      const itemsToConfirm = existing.filter(item => item.status === 'incoming');
      if (itemsToConfirm.length === 0) {
        return { success: true, message: "Không có sản phẩm nào ở trạng thái 'Đang về' cần xác nhận" };
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const itemsToConfirmIds = itemsToConfirm.map(i => i.id);

      // 2. Cập nhật hàng loạt trạng thái máy sang 'in_stock'
      await tx
        .update(inventoryItems)
        .set({
          status: 'in_stock',
          stockedDate: todayStr,
          updatedAt: new Date(),
        })
        .where(inArray(inventoryItems.id, itemsToConfirmIds));

      // 3. Ghi nhận thẻ kho hàng loạt (bulk insert)
      const movementsToInsert = itemsToConfirm.map(item => ({
        inventoryItemId: item.id,
        movementType: 'stocked' as const,
        fromStatus: item.status,
        toStatus: 'in_stock' as const,
        referenceType: item.purchaseOrderItemId ? ('purchase_order' as const) : ('manual' as const),
        referenceId: item.purchaseOrderItemId || null,
        quantityChange: 1,
        performedBy: performedById,
        notes: 'Xác nhận hàng về kho hàng loạt',
      }));

      await tx.insert(inventoryMovements).values(movementsToInsert);

      // 4. Lấy tất cả purchaseOrderItems liên quan để xác định PO Ids cần đồng bộ
      const poItemIds = itemsToConfirm
        .map(item => item.purchaseOrderItemId)
        .filter((id): id is string => !!id);

      const poIdsToSync = new Set<string>();
      if (poItemIds.length > 0) {
        const poItems = await tx
          .select({ purchaseOrderId: purchaseOrderItems.purchaseOrderId })
          .from(purchaseOrderItems)
          .where(inArray(purchaseOrderItems.id, poItemIds));
        
        for (const poItem of poItems) {
          poIdsToSync.add(poItem.purchaseOrderId);
        }
      }

      // Đồng bộ trạng thái cho các đơn nhập hàng bị ảnh hưởng
      for (const poId of poIdsToSync) {
        await syncPurchaseOrderStatus(tx, poId);
      }

      return { success: true, message: `Đã xác nhận về kho thành công cho ${itemsToConfirm.length} máy!` };
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

      if (isHardDelete) {
        // 1. Xóa thẻ kho của tất cả sản phẩm
        await tx.delete(inventoryMovements).where(inArray(inventoryMovements.inventoryItemId, ids));
        // 2. Xóa tất cả sản phẩm
        await tx.delete(inventoryItems).where(inArray(inventoryItems.id, ids));
      } else {
        // 1. Lấy trạng thái của các items cần xóa mềm
        const existing = await tx
          .select()
          .from(inventoryItems)
          .where(inArray(inventoryItems.id, ids));

        if (existing.length > 0) {
          const existingIds = existing.map(item => item.id);
          
          // 2. Cập nhật trạng thái sang 'deleted' hàng loạt
          await tx.update(inventoryItems)
            .set({
              status: 'deleted',
              notes: 'Xóa hàng loạt khỏi kho hàng',
              updatedAt: new Date(),
            })
            .where(inArray(inventoryItems.id, existingIds));

          // 3. Ghi nhận thẻ kho hàng loạt (bulk insert)
          const movementsToInsert = existing.map(item => ({
            inventoryItemId: item.id,
            movementType: 'adjusted' as const,
            fromStatus: item.status,
            toStatus: 'deleted' as const,
            referenceType: 'manual' as const,
            quantityChange: -1,
            performedBy: performedById,
            notes: 'Xóa hàng loạt khỏi kho hàng (Ẩn lưu trữ)',
          }));

          await tx.insert(inventoryMovements).values(movementsToInsert);
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

    const [movements, sales, warranties, returnsList, replacementForList] = await Promise.all([
      db
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
        .orderBy(desc(inventoryMovements.performedAt)),

      db
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
        .where(eq(orderItems.inventoryItemId, item.id)),

      db
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
          customerPhone: customers.phone,
        })
        .from(warrantyClaims)
        .innerJoin(customers, eq(warrantyClaims.customerId, customers.id))
        .where(eq(warrantyClaims.inventoryItemId, item.id))
        .orderBy(desc(warrantyClaims.receivedDate)),

      db
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
          customerPhone: customers.phone,
        })
        .from(returnItems)
        .innerJoin(returns, eq(returnItems.returnId, returns.id))
        .innerJoin(customers, eq(returns.customerId, customers.id))
        .where(eq(returnItems.inventoryItemId, item.id))
        .orderBy(desc(returns.createdAt)),

      db
        .select({
          returnItemId: returnItems.id,
          returnId: returns.id,
          returnNumber: returns.returnNumber,
          type: returns.type,
          reason: returnItems.returnReason,
          createdAt: returns.createdAt,
          customerName: customers.fullName,
          customerPhone: customers.phone,
          oldItemSerial: sql<string>`(SELECT serial_number FROM inventory_items WHERE id = ${returnItems.inventoryItemId})`,
        })
        .from(returnItems)
        .innerJoin(returns, eq(returnItems.returnId, returns.id))
        .innerJoin(customers, eq(returns.customerId, customers.id))
        .where(eq(returnItems.newInventoryItemId, item.id))
        .orderBy(desc(returns.createdAt))
    ]);

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
      date: item.createdAt ? item.createdAt.toISOString() : (item.stockedDate ? new Date(item.stockedDate).toISOString() : new Date().toISOString()),
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
        date: new Date(s.createdAt).toISOString(),
        title: "Bán hàng thành công",
        description: `Bán thành công cho khách hàng ${s.customerName} (${s.customerPhone}) theo hóa đơn ${s.orderNumber}. Trị giá bán lẻ: ${Math.round(Number(s.sellingPrice)).toLocaleString("vi-VN")}đ.`,
        meta: {
          orderNumber: s.orderNumber,
          customerName: s.customerName,
          customerPhone: s.customerPhone,
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
        date: new Date(r.createdAt).toISOString(),
        title: `Phiếu đổi/trả phát sinh (${typeLabel})`,
        description: `Khách hàng ${r.customerName} yêu cầu ${typeLabel.toLowerCase()} máy. Tình trạng lúc nhận lại: ${
          (r.conditionOnReturn === 'like_new' || r.conditionOnReturn === 'good') ? 'Hoạt động tốt' : 'Lỗi'
        }. ${r.defectDescription ? `Ghi chú chi tiết: "${r.defectDescription}"` : ""}`,
        meta: {
          returnNumber: r.returnNumber,
          refundPrice: r.refundPrice,
          isDefective: r.isDefective,
          defectDescription: r.defectDescription,
          customerPhone: r.customerPhone
        }
      });
    });

    // 3b. Mốc đổi thế vào (Replacement For)
    replacementForList.forEach((r) => {
      milestones.push({
        type: "return",
        date: new Date(r.createdAt).toISOString(),
        title: `Được xuất đổi thế cho máy lỗi`,
        description: `Xuất thiết bị này để đổi thế cho máy lỗi (Serial cũ: ${r.oldItemSerial}) của khách hàng ${r.customerName} theo Phiếu đổi trả ${r.returnNumber}.`,
        meta: {
          returnNumber: r.returnNumber,
          oldItemSerial: r.oldItemSerial,
          customerPhone: r.customerPhone
        }
      });
    });

    // 4. Bảo hành (Warranties)
    warranties.forEach((w) => {
      milestones.push({
        type: "warranty",
        date: new Date(w.receivedDate).toISOString(),
        title: `Tiếp nhận Bảo hành dịch vụ`,
        description: `Mã phiếu nhận bảo hành: ${w.claimNumber}. Khách bảo hành: ${w.customerName}. Mô tả lỗi: "${w.issueDescription}". Chi phí sửa chữa phát sinh: ${Math.round(Number(w.repairCost || 0)).toLocaleString("vi-VN")}đ. ${w.technicianNotes ? `Ghi chú kỹ thuật: "${w.technicianNotes}"` : ""}`,
        meta: {
          claimNumber: w.claimNumber,
          status: w.status,
          repairCost: w.repairCost,
          actualReturnDate: w.actualReturnDate,
          customerPhone: w.customerPhone
        }
      });
    });

    // 5. Thẻ kho thô (Movements) quan trọng
    movements.forEach((m) => {
      if (
        m.movementType === 'adjusted' || 
        m.movementType === 'warranty_in' || 
        m.movementType === 'warranty_out' ||
        m.movementType === 'defective' ||
        (m.movementType === 'returned' && m.toStatus === 'returned')
      ) {
        let typeLabel = m.movementType === 'adjusted' ? 'Điều chỉnh kho' : 
                        m.movementType === 'warranty_in' ? 'Nhập kho bảo hành' : 
                        m.movementType === 'warranty_out' ? 'Xuất kho bảo hành' : 
                        m.movementType === 'defective' ? 'Báo máy lỗi (Kho lỗi)' : 
                        'Xuất trả Nhà cung cấp';
        if (m.movementType === 'warranty_out' && m.notes) {
          if (m.notes.includes('Sửa chữa nội bộ')) {
            typeLabel = 'Xuất sửa nội bộ';
          } else if (m.notes.includes('Gửi bảo hành NCC')) {
            typeLabel = 'Gửi bảo hành NCC';
          }
        }
        milestones.push({
          type: m.movementType === 'returned' ? "return" : "movement",
          date: new Date(m.performedAt).toISOString(),
          title: m.movementType === 'returned' ? 'Xuất trả Nhà cung cấp' : 
                 m.movementType === 'defective' ? 'Báo hỏng / lỗi thiết bị' : 
                 `Giao dịch thẻ kho: ${typeLabel}`,
          description: `Giao dịch được thực hiện bởi nhân viên ${m.performedByName || 'Hệ thống'}. Ghi chú: ${m.notes || 'Không có'}`,
          meta: {
            fromStatus: m.fromStatus,
            toStatus: m.toStatus
          }
        });
      }
    });

    // Sắp xếp Milestones giảm dần theo ngày và giờ (Mốc mới nhất lên đầu)
    const sortedMilestones = milestones.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Fetch attached accessories
    const attachedAccs = await db
      .select({
        id: accessoryItems.id,
        serialNumber: accessoryItems.serialNumber,
        unitCost: accessoryItems.unitCost,
        sellingPrice: accessoryItems.sellingPrice,
        catalogName: accessoryCatalog.name,
      })
      .from(accessoryItems)
      .innerJoin(accessoryCatalog, eq(accessoryItems.accessoryCatalogId, accessoryCatalog.id))
      .where(and(eq(accessoryItems.inventoryItemId, item.id), eq(accessoryItems.status, "attached")));

    const itemWithAccessories = {
      ...item,
      accessoryCost: "0",
      accessoryNotes: null,
      accessories: attachedAccs,
    };

    const serializedItem = {
      ...itemWithAccessories,
      createdAt: itemWithAccessories.createdAt ? new Date(itemWithAccessories.createdAt).toISOString() : null,
      receivedDate: itemWithAccessories.receivedDate ? new Date(itemWithAccessories.receivedDate).toISOString() : null,
      warrantyStart: itemWithAccessories.warrantyStart ? new Date(itemWithAccessories.warrantyStart).toISOString() : null,
      warrantyEnd: itemWithAccessories.warrantyEnd ? new Date(itemWithAccessories.warrantyEnd).toISOString() : null,
      stockedDate: itemWithAccessories.stockedDate ? new Date(itemWithAccessories.stockedDate).toISOString() : null,
      expectedArrivalDate: itemWithAccessories.expectedArrivalDate ? new Date(itemWithAccessories.expectedArrivalDate).toISOString() : null,
      soldDate: itemWithAccessories.soldDate ? new Date(itemWithAccessories.soldDate).toISOString() : null,
    };

    return {
      success: true,
      item: serializedItem,
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
          location: repairType === 'internal' ? 'internal_repair' : 'supplier_warranty',
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
          location: null,
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
        const randomSuffix = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
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
    const msg = error?.message?.includes("unique") || error?.message?.includes("duplicate")
      ? "Lỗi trùng mã phiếu sổ quỹ, vui lòng thử lại"
      : (error.message || "Lỗi hoàn tất sửa chữa");
    return { success: false, message: msg };
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

      // Cập nhật trạng thái đơn nhập PO liên đới (nếu có)
      if (item.purchaseOrderItemId) {
        const poItem = await tx
          .select({ purchaseOrderId: purchaseOrderItems.purchaseOrderId })
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId))
          .limit(1);
        if (poItem.length > 0 && poItem[0].purchaseOrderId) {
          await syncPurchaseOrderStatus(tx, poItem[0].purchaseOrderId);
        }
      }

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
        const randomSuffix = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
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
    const msg = error?.message?.includes("unique") || error?.message?.includes("duplicate")
      ? "Lỗi trùng mã phiếu sổ quỹ, vui lòng thử lại"
      : (error.message || "Lỗi xuất trả hoàn tiền NCC");
    return { success: false, message: msg };
  }
}

export async function supplierReturnWriteOffAction(itemId: string) {
  return supplierRefundAction(itemId, "0");
}

/**
 * Xuất trả máy cũ cho NCC và nhập máy mới thay thế trong cùng một giao dịch.
 * Máy mới kế thừa PO cũ → không tạo phiếu chi mới → không bị gấp đôi tiền.
 */
export async function supplierReplaceAction(
  oldItemId: string,
  newSerialNumber: string,
  newCondition?: "new" | "used",
  notes?: string,
) {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lấy thông tin máy cũ đang trả
      const existing = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, oldItemId))
        .limit(1);

      if (existing.length === 0) {
        return { success: false, message: "Không tìm thấy sản phẩm cũ" };
      }

      const oldItem = existing[0];
      if (oldItem.status !== 'defective' && oldItem.status !== 'warranty_repair') {
        return { success: false, message: "Chỉ xuất trả máy lỗi hoặc đang bảo hành NCC" };
      }

      const cleanSerial = newSerialNumber.trim();
      if (!cleanSerial || cleanSerial.length < 3) {
        return { success: false, message: "Số Serial máy mới phải có ít nhất 3 ký tự" };
      }

      // Kiểm tra serial mới chưa tồn tại
      const duplicateCheck = await tx
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.serialNumber, cleanSerial))
        .limit(1);
      if (duplicateCheck.length > 0) {
        return { success: false, message: `Serial "${cleanSerial}" đã tồn tại trong hệ thống` };
      }

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (!performedById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      // 2. Xuất máy cũ → trạng thái 'returned'
      await tx
        .update(inventoryItems)
        .set({
          status: 'returned',
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, oldItemId));

      await tx.insert(inventoryMovements).values({
        inventoryItemId: oldItemId,
        movementType: 'returned',
        fromStatus: oldItem.status,
        toStatus: 'returned',
        referenceType: 'manual',
        quantityChange: 0,
        notes: notes 
          ? `[Trả NCC đổi máy] ${notes} → Máy mới: ${cleanSerial}`
          : `Xuất trả NCC để đổi máy mới (Serial mới: ${cleanSerial})`,
        performedBy: performedById,
      });

      // 3. Nhập máy mới - kế thừa purchaseOrderItemId từ máy cũ (KHÔNG tạo PO/phiếu chi mới)
      const todayStr = new Date().toISOString().split('T')[0];
      const [newItem] = await tx.insert(inventoryItems).values({
        productId: oldItem.productId,
        serialNumber: cleanSerial,
        condition: newCondition || 'new',
        status: 'in_stock',
        costPrice: oldItem.costPrice, // Kế thừa giá vốn từ máy cũ
        sellingPrice: oldItem.sellingPrice,
        purchaseOrderItemId: oldItem.purchaseOrderItemId, // Cùng PO → không ghi chi thêm
        originCountry: oldItem.originCountry,
        stockedDate: todayStr,
        receivedDate: todayStr,
        notes: notes
          ? `[Đổi máy từ NCC] Thay thế ${oldItem.serialNumber}. ${notes}`
          : `[Đổi máy từ NCC] Thay thế máy cũ Serial: ${oldItem.serialNumber}`,
        createdBy: performedById,
      }).returning();

      // 4. Ghi movement cho máy mới
      await tx.insert(inventoryMovements).values({
        inventoryItemId: newItem.id,
        movementType: 'stocked',
        fromStatus: null,
        toStatus: 'in_stock',
        referenceType: oldItem.purchaseOrderItemId ? 'purchase_order' : 'manual',
        referenceId: oldItem.purchaseOrderItemId || null,
        quantityChange: 1,
        notes: `Nhập kho máy thay thế từ NCC (thay cho máy cũ ${oldItem.serialNumber})`,
        performedBy: performedById,
      });

      // 5. Đồng bộ trạng thái PO (nếu có)
      if (oldItem.purchaseOrderItemId) {
        const poItem = await tx
          .select({ purchaseOrderId: purchaseOrderItems.purchaseOrderId })
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.id, oldItem.purchaseOrderItemId))
          .limit(1);
        if (poItem.length > 0 && poItem[0].purchaseOrderId) {
          await syncPurchaseOrderStatus(tx, poItem[0].purchaseOrderId);
        }
      }

      return {
        success: true,
        message: `Đổi máy thành công! Máy cũ (${oldItem.serialNumber}) đã trả NCC, máy mới (${cleanSerial}) đã nhập kho.`,
        newItem,
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
    console.error("Lỗi đổi máy NCC:", error);
    if (error.code === '23505') {
      return { success: false, message: "Serial Number máy mới đã tồn tại trong hệ thống" };
    }
    return { success: false, message: error.message || "Lỗi đổi máy thay thế NCC" };
  }
}

// ============================================================
// ACCESSORY CATALOG ACTIONS
// ============================================================

export async function getAccessoryCatalog() {
  try {
    const list = await db
      .select()
      .from(accessoryCatalog)
      .orderBy(accessoryCatalog.name);
    return { success: true, catalog: list };
  } catch (error: any) {
    console.error("Lỗi lấy danh mục phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi truy vấn danh mục phụ kiện" };
  }
}

export async function createAccessoryCatalogItem(data: {
  name: string;
  defaultCost: string;
  defaultSellingPrice: string;
  description?: string;
}) {
  try {
    const [newItem] = await db
      .insert(accessoryCatalog)
      .values({
        name: data.name.trim(),
        defaultCost: data.defaultCost,
        defaultSellingPrice: data.defaultSellingPrice,
        description: data.description || null,
        isActive: true,
      })
      .returning();
    return { success: true, message: "Tạo danh mục phụ kiện thành công", item: newItem };
  } catch (error: any) {
    console.error("Lỗi tạo danh mục phụ kiện:", error);
    if (error.code === '23505') {
      return { success: false, message: "Tên phụ kiện đã tồn tại trong danh mục" };
    }
    return { success: false, message: error.message || "Lỗi tạo danh mục phụ kiện" };
  }
}

export async function updateAccessoryCatalogItem(
  id: string,
  data: Partial<Omit<typeof accessoryCatalog.$inferInsert, "id" | "createdAt">>
) {
  try {
    const [updatedItem] = await db
      .update(accessoryCatalog)
      .set(data)
      .where(eq(accessoryCatalog.id, id))
      .returning();
    return { success: true, message: "Cập nhật danh mục thành công", item: updatedItem };
  } catch (error: any) {
    console.error("Lỗi cập nhật danh mục phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi cập nhật danh mục" };
  }
}

export async function toggleAccessoryCatalogItem(id: string) {
  try {
    const existing = await db.select().from(accessoryCatalog).where(eq(accessoryCatalog.id, id)).limit(1);
    if (existing.length === 0) return { success: false, message: "Không tìm thấy phụ kiện" };

    const [updatedItem] = await db
      .update(accessoryCatalog)
      .set({ isActive: !existing[0].isActive })
      .where(eq(accessoryCatalog.id, id))
      .returning();

    return { success: true, message: "Cập nhật trạng thái thành công", item: updatedItem };
  } catch (error: any) {
    console.error("Lỗi đổi trạng thái hoạt động phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi đổi trạng thái hoạt động" };
  }
}

export async function deleteAccessoryCatalogItem(id: string) {
  try {
    const items = await db.select().from(accessoryItems).where(eq(accessoryItems.accessoryCatalogId, id)).limit(1);
    if (items.length > 0) {
      return { success: false, message: "Không thể xóa danh mục này vì đã có phụ kiện trong kho thuộc danh mục này. Hãy chuyển trạng thái ngưng hoạt động thay vì xóa." };
    }
    await db.delete(accessoryCatalog).where(eq(accessoryCatalog.id, id));
    return { success: true, message: "Xóa danh mục phụ kiện thành công" };
  } catch (error: any) {
    console.error("Lỗi xóa danh mục phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi xóa danh mục phụ kiện" };
  }
}

// ============================================================
// ACCESSORY ITEMS & IMPORT ACTIONS
// ============================================================

export async function importAccessoryItems(data: {
  catalogId: string;
  quantity: number;
  unitCost: string;
  supplierId?: string | null;
  serialNumbers?: string[];
  notes?: string;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;

      // Sinh mã lô nhập và các thông tin định danh
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const batchCode = `BAT-ACC-${dateStr}-${rand}`;

      let purchaseOrderId: string | null = null;
      const finalSupplierId = data.supplierId || null;

      // Chỉ sinh PO mới cho phụ kiện nếu có chọn nhà cung cấp
      if (finalSupplierId) {
        const poNumber = `PO-ACC-${dateStr}-${rand}`;
        const totalCost = (Number(data.unitCost) * data.quantity).toFixed(2);

        const [newPo] = await tx.insert(purchaseOrders).values({
          poNumber,
          supplierId: finalSupplierId,
          status: "received", // Always received immediately since accessories are imported in-place
          originCountry: "VN",
          shippingCost: "0",
          totalCost: String(totalCost),
          notes: data.notes || "Nhập kho phụ kiện",
          actualArrival: new Date().toISOString().split('T')[0],
          createdBy: performedById || null,
        }).returning();

        purchaseOrderId = newPo.id;
      }

      // Đồng bộ Sổ quỹ Kế toán (Chỉ tạo giao dịch nếu có tổng chi phí vốn > 0)
      const costVal = Number(data.unitCost || 0);
      const qtyVal = Number(data.quantity || 0);
      const totalCostVal = costVal * qtyVal;

      if (totalCostVal > 0) {
        const dateStrCB = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomSuffixCB = Math.random().toString(36).substring(2, 6).toUpperCase();
        const entryNumber = `CB${dateStrCB}-${randomSuffixCB}`;

        await tx.insert(cashBookEntries).values({
          entryNumber,
          type: "expense",
          category: "purchase",
          amount: totalCostVal.toFixed(2),
          runningBalance: "0",
          paymentMethod: "bank_transfer",
          referenceType: purchaseOrderId ? "purchase_order" as const : null,
          referenceId: purchaseOrderId,
          description: purchaseOrderId 
            ? `Chi tiền thanh toán đơn nhập phụ kiện PO-ACC-${dateStr}-${rand}`
            : `Chi tiền nhập kho phụ kiện trực tiếp (Lô BAT-ACC-${dateStr}-${rand})`,
          entryDate: new Date().toISOString().split("T")[0],
          createdBy: performedById || null,
        });

        await recalculateRunningBalances(tx);
      }

      const itemsToInsert: any[] = [];
      const serials = data.serialNumbers || [];

      // Lọc bỏ serials trống và trim
      const cleanSerials = serials.map(s => s.trim()).filter(Boolean);

      // Nếu số lượng nhập ít hơn số serial nhập vào, tăng số lượng nhập lên bằng số serial
      const finalQuantity = Math.max(data.quantity, cleanSerials.length);

      // Tạo các item có serial
      for (let i = 0; i < cleanSerials.length; i++) {
        itemsToInsert.push({
          accessoryCatalogId: data.catalogId,
          serialNumber: cleanSerials[i],
          unitCost: data.unitCost,
          status: "in_stock" as const,
          sellingPrice: "0", // Default to 0, will be set when sold or attached
          supplierId: finalSupplierId,
          purchaseOrderId: purchaseOrderId,
          batchCode,
          notes: data.notes || null,
        });
      }

      // Tạo các item còn lại không có serial
      const remainingCount = finalQuantity - cleanSerials.length;
      for (let i = 0; i < remainingCount; i++) {
        itemsToInsert.push({
          accessoryCatalogId: data.catalogId,
          serialNumber: null,
          unitCost: data.unitCost,
          status: "in_stock" as const,
          sellingPrice: "0",
          supplierId: finalSupplierId,
          purchaseOrderId: purchaseOrderId,
          batchCode,
          notes: data.notes || null,
        });
      }

      const inserted = await tx.insert(accessoryItems).values(itemsToInsert).returning();

      return { success: true, message: `Nhập kho thành công ${inserted.length} phụ kiện!`, items: inserted };
    });

    return result;
  } catch (error: any) {
    console.error("Lỗi nhập kho phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi nhập kho phụ kiện" };
  }
}

export async function getAccessoryStockSummary() {
  try {
    // Truy vấn tổng hợp tồn kho từng loại phụ kiện
    const catalog = await db.select().from(accessoryCatalog).orderBy(accessoryCatalog.name);
    const items = await db.select().from(accessoryItems);

    const summary = catalog.map(cat => {
      const catItems = items.filter(i => i.accessoryCatalogId === cat.id);
      const available = catItems.filter(i => i.status === 'in_stock').length;
      const attached = catItems.filter(i => i.status === 'attached').length;
      const sold = catItems.filter(i => i.status === 'sold').length;
      const defective = catItems.filter(i => i.status === 'defective').length;

      // Tính giá nhập trung bình
      const totalCost = catItems.reduce((sum, item) => sum + Number(item.unitCost), 0);
      const averageCost = catItems.length > 0 ? (totalCost / catItems.length).toFixed(0) : cat.defaultCost;

      return {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        defaultCost: cat.defaultCost,
        defaultSellingPrice: cat.defaultSellingPrice,
        isActive: cat.isActive,
        averageCost: String(averageCost),
        available,
        attached,
        sold,
        defective,
        total: catItems.length,
      };
    });

    return { success: true, summary };
  } catch (error: any) {
    console.error("Lỗi thống kê tồn kho phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi thống kê tồn kho phụ kiện" };
  }
}

export async function getAccessoryItemsByCatalog(catalogId: string) {
  try {
    const list = await db
      .select({
        id: accessoryItems.id,
        serialNumber: accessoryItems.serialNumber,
        unitCost: accessoryItems.unitCost,
        status: accessoryItems.status,
        sellingPrice: accessoryItems.sellingPrice,
        batchCode: accessoryItems.batchCode,
        notes: accessoryItems.notes,
        createdAt: accessoryItems.createdAt,
        inventoryItemId: accessoryItems.inventoryItemId,
        machineSerialNumber: inventoryItems.serialNumber,
        productName: products.name,
        supplierName: suppliers.name,
      })
      .from(accessoryItems)
      .leftJoin(suppliers, eq(accessoryItems.supplierId, suppliers.id))
      .leftJoin(inventoryItems, eq(accessoryItems.inventoryItemId, inventoryItems.id))
      .leftJoin(products, eq(inventoryItems.productId, products.id))
      .where(eq(accessoryItems.accessoryCatalogId, catalogId))
      .orderBy(desc(accessoryItems.createdAt));

    return { success: true, items: list };
  } catch (error: any) {
    console.error("Lỗi lấy danh sách chi tiết phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi truy vấn phụ kiện" };
  }
}

// ============================================================
// ATTACH / DETACH / DEFECTIVE ACTIONS
// ============================================================

export async function attachAccessoryToMachine(
  accessoryItemId: string,
  inventoryItemId: string,
  sellingPrice: string = "0"
) {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lấy thông tin phụ kiện
      const accs = await tx.select().from(accessoryItems).where(eq(accessoryItems.id, accessoryItemId)).limit(1);
      if (accs.length === 0) return { success: false, message: "Không tìm thấy phụ kiện" };
      const acc = accs[0];

      if (acc.status !== 'in_stock') {
        return { success: false, message: `Trạng thái phụ kiện không hợp lệ: ${acc.status}` };
      }

      // 2. Lấy thông tin máy lẻ
      const machines = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, inventoryItemId)).limit(1);
      if (machines.length === 0) return { success: false, message: "Không tìm thấy máy lẻ" };
      const machine = machines[0];

      // 3. Cập nhật phụ kiện
      await tx
        .update(accessoryItems)
        .set({
          status: 'attached',
          inventoryItemId: inventoryItemId,
          sellingPrice: sellingPrice,
          updatedAt: new Date(),
        })
        .where(eq(accessoryItems.id, accessoryItemId));

      // 4. Cộng dồn chi phí mua phụ kiện vào giá vốn máy lẻ
      const finalCostPrice = (Number(machine.costPrice) + Number(acc.unitCost)).toFixed(2);
      await tx
        .update(inventoryItems)
        .set({
          costPrice: finalCostPrice,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, inventoryItemId));

      // 5. Ghi nhận thẻ kho máy lẻ
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (performedById) {
        const catalog = await tx.select().from(accessoryCatalog).where(eq(accessoryCatalog.id, acc.accessoryCatalogId)).limit(1);
        await tx.insert(inventoryMovements).values({
          inventoryItemId: inventoryItemId,
          movementType: 'adjusted',
          fromStatus: machine.status,
          toStatus: machine.status,
          referenceType: 'manual',
          quantityChange: 0,
          performedBy: performedById,
          notes: `Gắn phụ kiện: ${catalog[0]?.name || "Phụ kiện"} (${acc.serialNumber ? "S/N: " + acc.serialNumber : "Không serial"}). Giá vốn tăng từ ${Number(machine.costPrice).toLocaleString("vi-VN")}đ ➔ ${Number(finalCostPrice).toLocaleString("vi-VN")}đ`,
        });
      }

      return { success: true, message: "Gắn phụ kiện vào máy thành công!" };
    });

    return result;
  } catch (error: any) {
    console.error("Lỗi gắn phụ kiện vào máy:", error);
    return { success: false, message: error.message || "Lỗi gắn phụ kiện" };
  }
}

export async function detachAccessoryFromMachine(accessoryItemId: string) {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lấy thông tin phụ kiện
      const accs = await tx.select().from(accessoryItems).where(eq(accessoryItems.id, accessoryItemId)).limit(1);
      if (accs.length === 0) return { success: false, message: "Không tìm thấy phụ kiện" };
      const acc = accs[0];

      if (acc.status !== 'attached' || !acc.inventoryItemId) {
        return { success: false, message: "Phụ kiện chưa được gắn vào máy" };
      }

      const inventoryItemId = acc.inventoryItemId;

      // 2. Lấy thông tin máy lẻ
      const machines = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, inventoryItemId)).limit(1);
      if (machines.length === 0) return { success: false, message: "Không tìm thấy máy lẻ" };
      const machine = machines[0];

      // 3. Cập nhật phụ kiện
      await tx
        .update(accessoryItems)
        .set({
          status: 'in_stock',
          inventoryItemId: null,
          sellingPrice: '0',
          updatedAt: new Date(),
        })
        .where(eq(accessoryItems.id, accessoryItemId));

      // 4. Giảm trừ chi phí mua phụ kiện khỏi giá vốn máy lẻ
      const finalCostPrice = Math.max(0, Number(machine.costPrice) - Number(acc.unitCost)).toFixed(2);
      await tx
        .update(inventoryItems)
        .set({
          costPrice: finalCostPrice,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, inventoryItemId));

      // 5. Ghi nhận thẻ kho máy lẻ
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const performedById = ownerProfiles[0]?.id;
      if (performedById) {
        const catalog = await tx.select().from(accessoryCatalog).where(eq(accessoryCatalog.id, acc.accessoryCatalogId)).limit(1);
        await tx.insert(inventoryMovements).values({
          inventoryItemId: inventoryItemId,
          movementType: 'adjusted',
          fromStatus: machine.status,
          toStatus: machine.status,
          referenceType: 'manual',
          quantityChange: 0,
          performedBy: performedById,
          notes: `Tháo phụ kiện: ${catalog[0]?.name || "Phụ kiện"} (${acc.serialNumber ? "S/N: " + acc.serialNumber : "Không serial"}). Giá vốn giảm từ ${Number(machine.costPrice).toLocaleString("vi-VN")}đ ➔ ${Number(finalCostPrice).toLocaleString("vi-VN")}đ`,
        });
      }

      return { success: true, message: "Tháo phụ kiện thành công, đã hoàn tồn kho phụ kiện." };
    });

    return result;
  } catch (error: any) {
    console.error("Lỗi tháo phụ kiện khỏi máy:", error);
    return { success: false, message: error.message || "Lỗi tháo phụ kiện" };
  }
}

export async function markAccessoryDefective(accessoryItemId: string) {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lấy thông tin phụ kiện
      const accs = await tx.select().from(accessoryItems).where(eq(accessoryItems.id, accessoryItemId)).limit(1);
      if (accs.length === 0) return { success: false, message: "Không tìm thấy phụ kiện" };
      const acc = accs[0];

      if (acc.status === 'defective') {
        return { success: false, message: "Phụ kiện đã nằm trong kho lỗi" };
      }

      // Nếu đang gắn kèm máy, phải tháo ra trước
      if (acc.status === 'attached' && acc.inventoryItemId) {
        const inventoryItemId = acc.inventoryItemId;
        const machines = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, inventoryItemId)).limit(1);
        if (machines.length > 0) {
          const machine = machines[0];
          // Giảm trừ chi phí khỏi máy
          const finalCostPrice = Math.max(0, Number(machine.costPrice) - Number(acc.unitCost)).toFixed(2);
          await tx.update(inventoryItems).set({ costPrice: finalCostPrice, updatedAt: new Date() }).where(eq(inventoryItems.id, inventoryItemId));
          
          // Ghi thẻ kho máy lẻ
          const ownerProfiles = await tx.select().from(profiles).limit(1);
          const performedById = ownerProfiles[0]?.id;
          if (performedById) {
            const catalog = await tx.select().from(accessoryCatalog).where(eq(accessoryCatalog.id, acc.accessoryCatalogId)).limit(1);
            await tx.insert(inventoryMovements).values({
              inventoryItemId: inventoryItemId,
              movementType: 'adjusted',
              fromStatus: machine.status,
              toStatus: machine.status,
              referenceType: 'manual',
              quantityChange: 0,
              performedBy: performedById,
              notes: `Tháo phụ kiện hỏng: ${catalog[0]?.name || "Phụ kiện"}. Giá vốn giảm từ ${Number(machine.costPrice).toLocaleString("vi-VN")}đ ➔ ${Number(finalCostPrice).toLocaleString("vi-VN")}đ`,
            });
          }
        }
      }

      // Cập nhật phụ kiện sang defective
      await tx
        .update(accessoryItems)
        .set({
          status: 'defective',
          inventoryItemId: null,
          sellingPrice: '0',
          updatedAt: new Date(),
        })
        .where(eq(accessoryItems.id, accessoryItemId));

      return { success: true, message: "Đã chuyển phụ kiện sang kho lỗi thành công" };
    });

    return result;
  } catch (error: any) {
    console.error("Lỗi đánh dấu phụ kiện lỗi:", error);
    return { success: false, message: error.message || "Lỗi cập nhật phụ kiện" };
  }
}

export async function restoreAccessoryFromDefective(accessoryItemId: string) {
  try {
    const [updated] = await db
      .update(accessoryItems)
      .set({
        status: 'in_stock',
        updatedAt: new Date(),
      })
      .where(eq(accessoryItems.id, accessoryItemId))
      .returning();
    return { success: true, message: "Đã khôi phục phụ kiện từ kho lỗi", item: updated };
  } catch (error: any) {
    console.error("Lỗi khôi phục phụ kiện:", error);
    return { success: false, message: error.message || "Lỗi khôi phục phụ kiện" };
  }
}

/**
 * Lấy số lượng thống kê thiết bị theo từng trạng thái (để hiển thị badge trên các tab)
 */
export async function getInventoryStats() {
  try {
    const stats = await db
      .select({
        status: inventoryItems.status,
        count: sql<number>`cast(count(${inventoryItems.id}) as integer)`
      })
      .from(inventoryItems)
      .groupBy(inventoryItems.status);

    let inStock = 0;
    let incoming = 0;
    let defective = 0;
    let returned = 0;
    let total = 0;

    stats.forEach(s => {
      const cnt = s.count || 0;
      if (s.status === 'in_stock') inStock += cnt;
      else if (s.status === 'incoming') incoming += cnt;
      else if (s.status === 'defective' || s.status === 'warranty_repair') defective += cnt;
      else if (s.status === 'returned') returned += cnt;
      
      if (s.status !== 'deleted' && s.status !== 'sold' && s.status !== 'returned') {
        total += cnt;
      }
    });

    return {
      total,
      inStock,
      incoming,
      defective,
      returned
    };
  } catch (error) {
    console.error("Lỗi lấy thống kê kho hàng:", error);
    return { total: 0, inStock: 0, incoming: 0, defective: 0, returned: 0 };
  }
}
