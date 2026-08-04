import * as dotenv from "dotenv";
import * as path from "path";

// Load dotenv before any imports run
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function run() {
  const { db } = await import("../src/lib/db");
  const { purchaseOrders, suppliers, purchaseOrderItems, inventoryItems, products, accessoryItems, accessoryCatalog } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  console.log("Fetching a sample purchase order...");
  const poList = await db.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber }).from(purchaseOrders).limit(1);
  if (poList.length === 0) {
    console.log("No purchase orders found in DB.");
    process.exit(0);
  }
  const poId = poList[0].id;
  const poNumber = poList[0].poNumber;
  console.log(`Testing performance for PO: ${poNumber} (ID: ${poId})`);

  console.log("\n--- Query 1: PO & Supplier details ---");
  const t1 = Date.now();
  const q1 = await db
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
    .limit(1);
  console.log(`Query 1 took: ${Date.now() - t1}ms (returned ${q1.length} row)`);

  console.log("\n--- Query 2: Inventory Items & Products ---");
  const t2 = Date.now();
  const q2 = await db
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
    .orderBy(inventoryItems.serialNumber);
  console.log(`Query 2 took: ${Date.now() - t2}ms (returned ${q2.length} rows)`);

  console.log("\n--- Query 3: Accessory Items ---");
  const t3 = Date.now();
  const q3 = await db
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
    .where(eq(accessoryItems.purchaseOrderId, poId));
  console.log(`Query 3 took: ${Date.now() - t3}ms (returned ${q3.length} rows)`);

  console.log("\n--- Executing queries in Promise.all ---");
  const tAll = Date.now();
  await Promise.all([
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
  console.log(`Promise.all took: ${Date.now() - tAll}ms`);

  process.exit(0);
}

run().catch(console.error);
