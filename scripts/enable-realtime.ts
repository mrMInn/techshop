import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('❌ DATABASE_URL chưa được cấu hình trong .env.local');

const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  console.log("⏳ Bắt đầu cấu hình Supabase Realtime publication cho các bảng...");
  try {
    // 1. Tạo publication supabase_realtime nếu chưa tồn tại
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;
      END $$;
    `);
    console.log("ℹ️ Đã kiểm tra/khởi tạo supabase_realtime publication.");

    // 2. Thêm từng bảng nghiệp vụ vào publication
    const tables = [
      'inventory_items', 
      'cash_book_entries', 
      'orders', 
      'quotations', 
      'returns', 
      'warranty_claims', 
      'customers'
    ];

    for (const table of tables) {
      try {
        await db.execute(sql.raw(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${table};`));
        console.log(`✅ Đã thêm bảng [${table}] vào supabase_realtime.`);
      } catch (err: any) {
        if (err.message.includes('already exists') || err.message.includes('already member') || err.message.includes('đã tồn tại')) {
          console.log(`ℹ️ Bảng [${table}] đã được thêm trước đó.`);
        } else {
          console.warn(`⚠️ Cảnh báo đối với bảng [${table}]:`, err.message);
        }
      }
    }
    console.log("🎉 Hoàn tất cấu hình Postgres Replication!");
  } catch (error: any) {
    console.error("❌ Lỗi cấu hình publication:", error.message);
  } finally {
    await client.end();
  }
}

main();
