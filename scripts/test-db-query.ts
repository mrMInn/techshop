import dotenv from "dotenv";
import path from "path";

// Load env.local first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");

  console.log("Testing optimized recalculation query...");
  
  // Start a transaction to test and roll it back
  await db.transaction(async (tx) => {
    const start = Date.now();
    
    // Test the CTE window function update query
    await tx.execute(sql`
      WITH updated AS (
        SELECT id, 
               SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) 
               OVER (ORDER BY created_at, id) as new_balance
        FROM cash_book_entries
      )
      UPDATE cash_book_entries
      SET running_balance = updated.new_balance
      FROM updated
      WHERE cash_book_entries.id = updated.id
    `);

    const elapsed = Date.now() - start;
    console.log(`Optimized query executed successfully in ${elapsed}ms!`);
    
    // Rollback so we don't accidentally save changes during testing
    tx.rollback();
  }).catch((err) => {
    // If it is rollback, it's expected
    if (err.message && err.message.includes("rollback")) {
      console.log("Transaction rolled back successfully.");
    } else {
      console.error("Query test failed:", err);
    }
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
