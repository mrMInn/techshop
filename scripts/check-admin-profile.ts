import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/lib/db");
  const { profiles } = await import("../src/lib/db/schema");

  const result = await db.select().from(profiles);
  console.log("Profiles list:", result);
  process.exit(0);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
