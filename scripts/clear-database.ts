// scripts/clear-database.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema'; // Trỏ đúng tới thư mục chứa schema tổng của mày

dotenv.config({ path: '.env.local' });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('❌ DATABASE_URL chưa được cấu hình trong .env.local');

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function clearAllDatabaseTables() {
  console.log('🚨 =======================================================');
  console.log('⚠️  CẢNH BÁO TỐI CAO: TIẾN TRÌNH XÓA SẠCH TOÀN BỘ DATABASE');
  console.log('🚨 =======================================================\n');

  try {
    console.log('⏳ Đang kích nổ lệnh TRUNCATE CASCADE trên các bảng nghiệp vụ...');

    // Sử dụng sức mạnh của raw SQL TRUNCATE CASCADE để quét sạch data trong 1 nốt nhạc
    // Giữ lại bảng public.profiles để bảo toàn user auth đăng nhập Next.js
    await db.execute(sql`
      TRUNCATE TABLE 
        public.warranty_logs,
        public.audit_logs,
        public.telegram_notification_logs,
        public.telegram_notification_events,
        public.quotation_items,
        public.return_items,
        public.warranty_claims,
        public.returns,
        public.quotations,
        public.payments,
        public.order_items,
        public.orders,
        public.purchase_order_items,
        public.purchase_orders,
        public.inventory_movements,
        public.cash_book_entries,
        public.expenses,
        public.inventory_items,
        public.products,
        public.categories,
        public.brands,
        public.suppliers,
        public.expense_categories,
        public.accounting_periods,
        public.customers,
        public.lead_sources,
        public.telegram_settings
      RESTART IDENTITY CASCADE;
    `);

    console.log('\n✨ =======================================================');
    console.log('🎉 XÓA SẠCH DỮ LIỆU THÀNH CÔNG! DATABASE ĐÃ VỀ TRẠNG THÁI RỖNG.');
    console.log('   (Tài khoản nhân sự và cấu hình quyền Profiles được giữ lại an toàn)');
    console.log('==========================================================');

  } catch (error) {
    console.error('\n❌ TIẾN TRÌNH THẤT BẠI. LỖI HỆ THỐNG BAN KHÔNG THỂ XÓA BẢNG:');
    console.error(error);
    process.exit(1);
  } finally {
    // Ngắt kết nối để giải phóng tài nguyên pooling cho Supabase
    await client.end();
  }
}

clearAllDatabaseTables();