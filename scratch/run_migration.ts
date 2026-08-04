import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Running SQL migration...");
  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_acc_items_po ON accessory_items (purchase_order_id);`);
    console.log("Success! Index idx_acc_items_po created.");
  } catch (error) {
    console.error("Migration error:", error);
  }
  process.exit(0);
}

run().catch(console.error);
