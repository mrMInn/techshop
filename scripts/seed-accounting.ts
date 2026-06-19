import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  profiles, expenseCategories, expenses, cashBookEntries, accountingPeriods 
} from '../src/lib/db/schema'; // Nhớ check lại đường dẫn schema

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log('💰 Bắt đầu bơm data Kế Toán & Sổ Quỹ...');

  // 1. Lấy user admin
  const adminProfiles = await db.select().from(profiles).limit(1);
  const adminId = adminProfiles[0]?.id;

  if (!adminId) {
    console.log('⚠️ Không tìm thấy user nào, hãy chạy script seed.ts kho hàng trước.');
    process.exit(1);
  }

  // 2. Tạo các Danh mục chi phí (Expense Categories)
  console.log('📂 Đang tạo Danh mục chi phí...');
  const [catRent] = await db.insert(expenseCategories).values({ name: 'Tiền thuê mặt bằng', type: 'fixed' }).returning();
  const [catSalary] = await db.insert(expenseCategories).values({ name: 'Lương nhân viên', type: 'fixed' }).returning();
  const [catMkt] = await db.insert(expenseCategories).values({ name: 'Chi phí Marketing', type: 'variable' }).returning();

  // 3. Khởi tạo Sổ quỹ (Cashbook) & Số dư lũy kế
  console.log('💵 Đang tạo dòng tiền Thu/Chi...');
  let currentBalance = 0;
  const entriesToInsert = [];

  // Giả lập Giao dịch 1: Nạp vốn ban đầu (Thu)
  currentBalance += 500000000; // 500 củ
  entriesToInsert.push({
    entryNumber: 'CB-2026-IN-001',
    type: 'income' as const,
    category: 'other' as const,
    amount: '500000000',
    runningBalance: currentBalance.toString(),
    paymentMethod: 'bank_transfer' as const,
    description: 'Nạp vốn kinh doanh ban đầu',
    entryDate: '2026-05-01',
    createdBy: adminId,
  });

  // Giả lập Giao dịch 2: Bán được vài đơn hàng lắt nhắt (Thu)
  currentBalance += 45000000; // 45 củ
  entriesToInsert.push({
    entryNumber: 'CB-2026-IN-002',
    type: 'income' as const,
    category: 'sales' as const,
    amount: '45000000',
    runningBalance: currentBalance.toString(),
    paymentMethod: 'card' as const,
    description: 'Doanh thu bán lẻ tại cửa hàng tuần 1',
    entryDate: '2026-05-10',
    createdBy: adminId,
  });

  // 4. Tạo các Phiếu Chi (Expenses) và liên kết với Sổ quỹ
  // Chi 1: Trả tiền nhà
  const [expRent] = await db.insert(expenses).values({
    expenseNumber: 'EXP-2026-001',
    categoryId: catRent.id,
    amount: '20000000',
    expenseDate: '2026-05-05',
    paymentMethod: 'bank_transfer' as const,
    description: 'Thanh toán tiền nhà tháng 5',
    createdBy: adminId,
    approvedBy: adminId,
  }).returning();

  currentBalance -= 20000000;
  entriesToInsert.push({
    entryNumber: 'CB-2026-OUT-001',
    type: 'expense' as const,
    category: 'rent' as const,
    amount: '20000000',
    runningBalance: currentBalance.toString(),
    paymentMethod: 'bank_transfer' as const,
    referenceType: 'expense' as const,
    referenceId: expRent.id,
    description: 'Chi tiền thuê mặt bằng tháng 5',
    entryDate: '2026-05-05',
    createdBy: adminId,
  });

  // Chi 2: Chạy Ads
  const [expMkt] = await db.insert(expenses).values({
    expenseNumber: 'EXP-2026-002',
    categoryId: catMkt.id,
    amount: '5000000',
    expenseDate: '2026-05-15',
    paymentMethod: 'card' as const,
    description: 'Nạp tiền chạy Ads Facebook',
    createdBy: adminId,
    approvedBy: adminId,
  }).returning();

  currentBalance -= 5000000;
  entriesToInsert.push({
    entryNumber: 'CB-2026-OUT-002',
    type: 'expense' as const,
    category: 'other' as const, // Hoặc category tương ứng
    amount: '5000000',
    runningBalance: currentBalance.toString(),
    paymentMethod: 'card' as const,
    referenceType: 'expense' as const,
    referenceId: expMkt.id,
    description: 'Chi phí Marketing Facebook Ads',
    entryDate: '2026-05-15',
    createdBy: adminId,
  });

  // Insert toàn bộ sổ quỹ vào DB
  await db.insert(cashBookEntries).values(entriesToInsert);

  // 5. Mở một kỳ kế toán (Tháng 5/2026) chưa chốt sổ
  console.log('📅 Đang tạo Kỳ kế toán (Tháng 5/2026)...');
  await db.insert(accountingPeriods).values({
    period: '2026-05',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    isClosed: false,
  });

  console.log('✅ Đã bơm xong data Kế toán! Két sắt hiện tại đang có:', currentBalance.toLocaleString(), 'VNĐ');
  process.exit(0);
}

main();