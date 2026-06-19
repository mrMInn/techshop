import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Profiles count:", (await db.execute(sql`select count(*) from profiles`))[0]);
  console.log("Inventory items count:", (await db.execute(sql`select count(*) from inventory_items`))[0]);
  console.log("Orders count:", (await db.execute(sql`select count(*) from orders`))[0]);
  console.log("Cash book count:", (await db.execute(sql`select count(*) from cash_book_entries`))[0]);
  console.log("Expenses count:", (await db.execute(sql`select count(*) from expenses`))[0]);
  console.log("Warranty claims count:", (await db.execute(sql`select count(*) from warranty_claims`))[0]);
  process.exit(0);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
