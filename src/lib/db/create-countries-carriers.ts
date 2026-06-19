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
  console.log("=== Creating countries and shipping_carriers tables ===");
  try {
    // 1. Create countries table
    await sql`
      CREATE TABLE IF NOT EXISTS "countries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(10) UNIQUE NOT NULL,
        "name" varchar(100) NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log("✔ Ensured 'countries' table exists");

    // 2. Create shipping_carriers table
    await sql`
      CREATE TABLE IF NOT EXISTS "shipping_carriers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(50) UNIQUE NOT NULL,
        "name" varchar(100) NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    console.log("✔ Ensured 'shipping_carriers' table exists");

    // 3. Seed countries
    const defaultCountries = [
      { code: "US", name: "Mỹ" },
      { code: "VN", name: "Việt Nam" },
      { code: "JP", name: "Nhật Bản" },
      { code: "CN", name: "Trung Quốc" },
      { code: "KR", name: "Hàn Quốc" },
      { code: "SG", name: "Singapore" }
    ];

    for (const country of defaultCountries) {
      await sql`
        INSERT INTO "countries" ("code", "name", "is_active")
        VALUES (${country.code}, ${country.name}, true)
        ON CONFLICT ("code") DO UPDATE SET "name" = ${country.name}
      `;
    }
    console.log("✔ Seeded initial countries");

    // 4. Seed shipping carriers
    const defaultCarriers = [
      { code: "USPS", name: "USPS" },
      { code: "FedEx", name: "FedEx" },
      { code: "UPS", name: "UPS" },
      { code: "DHL", name: "DHL" },
      { code: "EMS", name: "EMS" }
    ];

    for (const carrier of defaultCarriers) {
      await sql`
        INSERT INTO "shipping_carriers" ("code", "name", "is_active")
        VALUES (${carrier.code}, ${carrier.name}, true)
        ON CONFLICT ("code") DO UPDATE SET "name" = ${carrier.name}
      `;
    }
    console.log("✔ Seeded initial shipping carriers");

    console.log("=== MIGRATION AND SEEDING COMPLETED SUCCESSFULLY ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration Error:", error);
    process.exit(1);
  }
}

run();
