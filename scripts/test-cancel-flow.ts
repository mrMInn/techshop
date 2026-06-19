import dotenv from "dotenv";
import path from "path";

// Load env.local first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/lib/db");
  const { customers, inventoryItems } = await import("../src/lib/db/schema");
  const { eq, and, sql } = await import("drizzle-orm");
  const { createOrderAction, cancelOrderAction } = await import("../src/app/actions/orders");
  const { getDashboardBentoData } = await import("../src/app/actions/accounting");

  console.log("--- START TEST CANCEL FLOW ---");

  // 1. Get a customer
  const custs = await db.select().from(customers).limit(1);
  if (custs.length === 0) {
    console.error("No customer found. Please run seed first.");
    process.exit(1);
  }
  const customerId = custs[0].id;

  // 2. Get an in-stock inventory item
  const stockItems = await db.select().from(inventoryItems).where(eq(inventoryItems.status, "in_stock")).limit(1);
  if (stockItems.length === 0) {
    console.error("No in-stock item found.");
    process.exit(1);
  }
  const stockItem = stockItems[0];

  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-06"
  console.log(`Current month is: ${currentMonth}`);

  // 3. Get initial bento stats
  let bentoBefore = await getDashboardBentoData(currentMonth);
  const revenueBefore = bentoBefore.todayIncome;
  console.log(`Revenue today BEFORE order creation: ${revenueBefore}`);

  // 4. Create an offline order (completed immediately)
  console.log("Creating order...");
  const orderRes = (await createOrderAction({
    customerId,
    saleChannel: "offline",
    items: [
      {
        inventoryItemId: stockItem.id,
        productId: stockItem.productId,
        sellingPrice: "10000000", // 10 million VND
        warrantyMonths: 12,
      }
    ],
    paymentMethod: "cash",
  })) as any;

  if (!orderRes.success || !orderRes.order) {
    console.error("Failed to create order:", orderRes.message);
    process.exit(1);
  }

  const orderId = orderRes.order.id;
  const orderNum = orderRes.order.orderNumber;
  console.log(`Created order ${orderNum} successfully with ID: ${orderId}`);

  // 5. Get bento stats AFTER creation
  let bentoAfter = await getDashboardBentoData(currentMonth);
  const revenueAfter = bentoAfter.todayIncome;
  console.log(`Revenue today AFTER order creation: ${revenueAfter}`);
  console.log(`Difference: ${revenueAfter - revenueBefore} (Expected: 10000000)`);

  // 6. Cancel the order
  console.log(`Cancelling order ${orderNum}...`);
  const cancelRes = await cancelOrderAction(orderId);
  if (!cancelRes.success) {
    console.error("Failed to cancel order:", cancelRes.message);
    process.exit(1);
  }
  console.log("Cancelled order successfully.");

  // 7. Get bento stats AFTER cancellation
  let bentoAfterCancel = await getDashboardBentoData(currentMonth);
  const revenueAfterCancel = bentoAfterCancel.todayIncome;
  console.log(`Revenue today AFTER cancellation: ${revenueAfterCancel}`);
  console.log(`Difference: ${revenueAfterCancel - revenueAfter} (Expected: -10000000)`);
  console.log(`Final revenue matches initial: ${revenueAfterCancel === revenueBefore}`);

  console.log("--- END TEST CANCEL FLOW ---");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
