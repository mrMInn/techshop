import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Fetching unique purchase order statuses from database...");
  const results = await db.execute(sql`
    SELECT status, COUNT(*) as count 
    FROM purchase_orders 
    GROUP BY status
  `);
  console.log("Results:", results);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
