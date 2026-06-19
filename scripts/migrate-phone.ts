import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { prepare: false });

async function run() {
  try {
    console.log("Running migration to drop NOT NULL on customers.phone...");
    await client`ALTER TABLE "customers" ALTER COLUMN "phone" DROP NOT NULL;`;
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

run();
