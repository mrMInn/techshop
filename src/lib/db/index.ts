import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Disable prefetch as it is not supported for "Transaction" pool mode
// Maintain a global reference to the connection pool in development to prevent exhaustion during hot reloads
declare global {
  // eslint-disable-next-line no-var
  var postgresClient: any;
}

export const client = globalThis.postgresClient || postgres(connectionString, { 
  prepare: false, 
  max: process.env.NODE_ENV === "production" ? undefined : 10
});

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresClient = client;
}

export const db = drizzle(client, { schema });

/**
 * Recalculate running balances for all cash book entries in a single optimized query
 */
export async function recalculateRunningBalances(tx: any) {
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
}
