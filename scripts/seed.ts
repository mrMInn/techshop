// File: scripts/seed.ts
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Ép nó đọc file .env.local của Next.js
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  categories, brands, products, inventoryItems, inventoryMovements, profiles 
} from '../src/lib/db/schema'; // Sửa path nếu cần

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  console.log('🚀 Bắt đầu nhồi data vào Database...');

  // 1. Lấy user admin đầu tiên làm người thực hiện
  const adminProfiles = await db.select().from(profiles).limit(1);
  const adminId = adminProfiles[0]?.id;

  if (!adminId) {
    console.log('⚠️ Chưa có tài khoản nhân viên nào trong bảng profiles. Dừng chạy script.');
    process.exit(1);
  }

  // 2. Tạo Danh mục & Thương hiệu
  console.log('📦 Đang tạo Danh mục & Thương hiệu...');
  const [catLaptop] = await db.insert(categories).values({ name: 'Laptop Nhập Khẩu', slug: 'laptop-nhap-khau' }).returning();
  const [catCamera] = await db.insert(categories).values({ name: 'Máy Ảnh & Ống Kính', slug: 'may-anh-ong-kinh' }).returning();

  const [brandThinkpad] = await db.insert(brands).values({ name: 'ThinkPad' }).returning();
  const [brandApple] = await db.insert(brands).values({ name: 'Apple' }).returning();
  const [brandSony] = await db.insert(brands).values({ name: 'Sony' }).returning();
  const [brandSigma] = await db.insert(brands).values({ name: 'Sigma' }).returning();

  // 3. Tạo Model Sản phẩm
  console.log('💻 Đang tạo Model Sản phẩm...');
  const [prodThinkpad] = await db.insert(products).values({
    name: 'ThinkPad X1 Carbon Gen 10', slug: 'thinkpad-x1-carbon-gen-10', sku: 'TP-X1-G10',
    categoryId: catLaptop.id, brandId: brandThinkpad.id,
    specs: { cpu: 'i7-1260P', ram: '16GB', ssd: '512GB' }
  }).returning();

  const [prodMacbook] = await db.insert(products).values({
    name: 'MacBook Pro M3 14 inch', slug: 'macbook-pro-m3-14', sku: 'MAC-M3-14',
    categoryId: catLaptop.id, brandId: brandApple.id,
  }).returning();

  const [prodSony] = await db.insert(products).values({
    name: 'Sony a6300 Body', slug: 'sony-a6300-body', sku: 'SONY-A6300',
    categoryId: catCamera.id, brandId: brandSony.id,
  }).returning();

  const [prodSigma] = await db.insert(products).values({
    name: 'Sigma 30mm f/1.4 DC DN', slug: 'sigma-30mm-f14', sku: 'SIGMA-30-14',
    categoryId: catCamera.id, brandId: brandSigma.id,
  }).returning();

  // 4. Sinh 200 chiếc máy thực tế trong kho
  console.log('⚙️ Đang sinh 200 thiết bị vào kho (Inventory Items)...');
  const itemsToInsert = [];
  const movementsToInsert = [];

  // Tạo 100 con Thinkpad
  for (let i = 1; i <= 100; i++) {
    itemsToInsert.push({
      productId: prodThinkpad.id,
      serialNumber: `SN-TPX1-US-${String(i).padStart(4, '0')}`,
      condition: 'used' as const,
      status: 'in_stock' as const,
      costPrice: '18000000',
      sellingPrice: '21000000',
      originCountry: 'US',
      stockedDate: new Date().toISOString().split('T')[0],
      location: 'Kho Ho Chi Minh City - Kệ A',
    });
  }

  // Tạo 50 con Sony a6300 & 50 Lens Sigma
  for (let i = 1; i <= 50; i++) {
    itemsToInsert.push({
      productId: prodSony.id,
      serialNumber: `SN-A6300-JP-${String(i).padStart(4, '0')}`,
      condition: 'used' as const, status: 'in_stock' as const,
      costPrice: '11000000', sellingPrice: '13500000',
    });
    itemsToInsert.push({
      productId: prodSigma.id,
      serialNumber: `SN-SIG30-JP-${String(i).padStart(4, '0')}`,
      condition: 'new' as const, status: 'in_stock' as const,
      costPrice: '5000000', sellingPrice: '6200000',
    });
  }

  // Drizzle có thể không cho insert mảng quá lớn một lúc, ta chia nhỏ chunk 50 cái
  for (let i = 0; i < itemsToInsert.length; i += 50) {
    const chunk = itemsToInsert.slice(i, i + 50);
    const insertedChunk = await db.insert(inventoryItems).values(chunk).returning();
    
    // Ghi thẻ kho cho chunk này
    for (const item of insertedChunk) {
      movementsToInsert.push({
        inventoryItemId: item.id,
        movementType: 'stocked' as const,
        fromStatus: null,
        toStatus: 'in_stock',
        referenceType: 'manual' as const,
        quantityChange: 1,
        performedBy: adminId,
        notes: 'Nhập kho hệ thống tự động (Seed Data)',
      });
    }
  }

  // Insert thẻ kho
  for (let i = 0; i < movementsToInsert.length; i += 50) {
    await db.insert(inventoryMovements).values(movementsToInsert.slice(i, i + 50));
  }

  console.log('✅ Đã nhồi xong 200 data mẫu vào Database!');
  process.exit(0);
}

main();