import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
  const { db } = await import("../src/lib/db");
  const { profiles } = await import("../src/lib/db/schema");
  try {
    const list = await db.select().from(profiles);
    console.log("=== PROFILES TABLE ===");
    console.log(JSON.stringify(list, null, 2));
  } catch (e: any) {
    console.error("Error querying profiles:", e.message);
  }
}

run();
