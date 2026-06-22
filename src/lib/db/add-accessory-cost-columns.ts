import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  console.log("=== Adding accessory_cost and accessory_notes columns to inventory_items table ===");
  try {
    // Add accessory_cost if not exists
    await sql`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "accessory_cost" decimal(15, 2) DEFAULT '0' NOT NULL;
    `;
    console.log("✔ Added column accessory_cost");

    // Add accessory_notes if not exists
    await sql`
      ALTER TABLE "inventory_items" 
      ADD COLUMN IF NOT EXISTS "accessory_notes" text;
    `;
    console.log("✔ Added column accessory_notes");

    console.log("=== ALL COLUMNS ADDED SUCCESSFULLY ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error running migration:", error);
    process.exit(1);
  }
}

run();
