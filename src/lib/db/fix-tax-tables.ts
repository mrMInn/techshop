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
  console.log("=== Fixing tax_declarations table schema ===");
  try {
    // Drop and recreate tax_declarations with all required columns
    await sql`DROP TABLE IF EXISTS "tax_declaration_items" CASCADE`;
    await sql`DROP TABLE IF EXISTS "tax_declarations" CASCADE`;
    console.log("✔ Dropped old tax tables");

    // Create enums if not exist
    await sql`
      DO $$ BEGIN
          CREATE TYPE tax_declaration_status AS ENUM ('draft', 'submitted');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;
    await sql`
      DO $$ BEGIN
          CREATE TYPE tax_declaration_ref_type AS ENUM ('order', 'purchase_order', 'expense');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;

    // Create tax_declarations with declaration_number column
    await sql`
      CREATE TABLE "tax_declarations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "declaration_number" varchar(30) UNIQUE NOT NULL,
        "period" varchar(7) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "total_sales" decimal(15, 2) NOT NULL,
        "total_vat_output" decimal(15, 2) NOT NULL,
        "total_vat_input" decimal(15, 2) NOT NULL,
        "tax_payable" decimal(15, 2) NOT NULL,
        "status" tax_declaration_status DEFAULT 'draft' NOT NULL,
        "submitted_at" timestamp with time zone,
        "created_by" uuid REFERENCES profiles(id),
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log("✔ Created tax_declarations table with declaration_number");

    // Create tax_declaration_items
    await sql`
      CREATE TABLE "tax_declaration_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tax_declaration_id" uuid REFERENCES tax_declarations(id) NOT NULL,
        "reference_type" tax_declaration_ref_type NOT NULL,
        "reference_id" uuid NOT NULL,
        "amount" decimal(15, 2) NOT NULL,
        "vat_amount" decimal(15, 2) NOT NULL
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS "idx_tax_decl_item_ref" ON "tax_declaration_items" ("reference_type", "reference_id");`;
    console.log("✔ Created tax_declaration_items table");

    // Also ensure accounting_periods exists
    await sql`
      CREATE TABLE IF NOT EXISTS "accounting_periods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "period" varchar(7) UNIQUE NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "is_closed" boolean DEFAULT false NOT NULL,
        "closed_at" timestamp with time zone,
        "closed_by" uuid REFERENCES profiles(id),
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log("✔ Ensured accounting_periods exists");

    console.log("=== ALL FIXES APPLIED SUCCESSFULLY ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

run();
