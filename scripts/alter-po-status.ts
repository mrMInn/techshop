import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Altering pgEnum po_status in database...");
  await db.execute(sql`
    ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'warranty_supplier';
  `);
  await db.execute(sql`
    ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'returned_supplier';
  `);
  console.log("Successfully altered po_status enum.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
