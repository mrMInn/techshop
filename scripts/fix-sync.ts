import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { customers, orders } from '../src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const sqlDb = postgres(process.env.DATABASE_URL!);
const db = drizzle(sqlDb);

async function main() {
  console.log('🔄 Đang đồng bộ lại số liệu khách hàng bằng truy vấn gom nhóm (GroupBy)...');
  
  // 1. Reset toàn bộ về 0
  await db.update(customers).set({ totalSpent: "0", orderCount: 0 });

  // 2. Tính tổng tiền và số đơn hàng cho tất cả khách hàng cùng lúc (Không bị tràn Stack)
  const stats = await db
    .select({
      customerId: orders.customerId,
      count: sql<number>`count(${orders.id})`,
      total: sql<string>`sum(${orders.totalAmount})`,
    })
    .from(orders)
    .where(eq(orders.status, "completed"))
    .groupBy(orders.customerId);

  // 3. Cập nhật lại số liệu chuẩn xác
  for (const stat of stats) {
    if (stat.customerId) {
      await db
        .update(customers)
        .set({
          orderCount: Number(stat.count || 0),
          totalSpent: stat.total ? Number(stat.total).toString() : "0",
        })
        .where(eq(customers.id, stat.customerId));
    }
  }
  
  console.log('✅ Đã đồng bộ xong! Số liệu khách hàng đã chuẩn 100%.');
  process.exit(0);
}

main();