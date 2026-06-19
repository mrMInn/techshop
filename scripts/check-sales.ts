import dotenv from "dotenv";
import path from "path";

// Load env.local first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/lib/db");
  const { orders } = await import("../src/lib/db/schema");
  const { sql } = await import("drizzle-orm");

  console.log("Checking order status counts in DB...");
  const statusCounts = await db.select({
    status: orders.status,
    count: sql`count(*)`
  }).from(orders).groupBy(orders.status);
  console.log("Order Status Counts:", statusCounts);

  console.log("\nChecking payment status counts in DB...");
  const paymentStatusCounts = await db.select({
    paymentStatus: orders.paymentStatus,
    count: sql`count(*)`
  }).from(orders).groupBy(orders.paymentStatus);
  console.log("Payment Status Counts:", paymentStatusCounts);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
