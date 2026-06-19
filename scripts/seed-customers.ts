import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { customers, leadSources } from '../src/lib/db/schema'; // Nhớ check đường dẫn

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Bộ từ điển để random tên người Việt Nam
const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const middleNames = ['Văn', 'Thị', 'Hữu', 'Ngọc', 'Minh', 'Thanh', 'Đức', 'Xuân', 'Thu', 'Hải', 'Gia', 'Hoàng', 'Anh'];
const firstNames = ['Anh', 'Bình', 'Châu', 'Dũng', 'Dương', 'Đạt', 'Hà', 'Hải', 'Hiếu', 'Hòa', 'Huy', 'Hưng', 'Khánh', 'Khoa', 'Kiên', 'Lâm', 'Lan', 'Linh', 'Long', 'Ly', 'Mai', 'Minh', 'Nam', 'Nga', 'Ngọc', 'Nhi', 'Nhung', 'Phát', 'Phong', 'Phú', 'Phương', 'Quân', 'Quang', 'Quyên', 'Quỳnh', 'Sơn', 'Tài', 'Tâm', 'Thảo', 'Thắng', 'Thành', 'Tiến', 'Trang', 'Trí', 'Trinh', 'Trung', 'Tuấn', 'Tú', 'Uyên', 'Vinh', 'Việt', 'Vy', 'Xuân', 'Yến'];
const districts = ['Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 7', 'Quận 10', 'Tân Bình', 'Bình Thạnh', 'Phú Nhuận', 'Gò Vấp', 'Thủ Đức', 'Bình Tân'];

function getRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('👥 Bắt đầu bơm 100 khách hàng vào Database...');

  // Lấy danh sách nguồn khách hàng (Facebook, Zalo, Cửa hàng...) để random gán cho khách
  const sources = await db.select().from(leadSources);
  const sourceIds = sources.map(s => s.id);

  const customersToInsert = [];

  for (let i = 1; i <= 100; i++) {
    // Random 15% là khách doanh nghiệp (công ty)
    const isBusiness = Math.random() > 0.85; 
    
    const fullName = isBusiness
      ? `Công ty TNHH Thương Mại ${getRandom(firstNames)} ${getRandom(firstNames)}`
      : `${getRandom(lastNames)} ${getRandom(middleNames)} ${getRandom(firstNames)}`;

    // Random số điện thoại mượt mà
    const prefixes = ['090', '093', '089', '091', '094', '088', '098', '097', '096', '086'];
    const phone = `${getRandom(prefixes)}${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;

    // Random địa chỉ
    const address = `${Math.floor(Math.random() * 500) + 1} Đường ${getRandom(firstNames)}, ${getRandom(districts)}, TP.HCM`;
    
    // Random mã số thuế cho doanh nghiệp
    const taxCode = isBusiness ? `031${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}` : null;

    customersToInsert.push({
      fullName,
      phone,
      email: Math.random() > 0.5 ? `khachhang_${i}@gmail.com` : null, // 50% để trống email
      address: Math.random() > 0.2 ? address : null, // 80% có địa chỉ
      taxCode,
      customerType: isBusiness ? 'business' as const : 'individual' as const,
      leadSourceId: sourceIds.length > 0 && Math.random() > 0.2 ? getRandom(sourceIds) : null,
      notes: isBusiness ? 'Khách hàng công ty, nhớ xuất VAT khi mua laptop' : 'Khách vãng lai',
      totalSpent: "0",
      orderCount: 0,
    });
  }

  // Drizzle hỗ trợ insert mảng, nhưng để an toàn tao chia lô 50 khách một lần đẩy lên DB
  for (let i = 0; i < customersToInsert.length; i += 50) {
    const chunk = customersToInsert.slice(i, i + 50);
    await db.insert(customers).values(chunk);
  }

  console.log('✅ Đã nhồi xong 100 khách hàng mẫu! Mở UI lên test ngay cho nóng.');
  process.exit(0);
}

main();