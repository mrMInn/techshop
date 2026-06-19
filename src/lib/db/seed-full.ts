import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ============================================================
// HELPERS
// ============================================================
function generateSerial(prefix: string, length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = prefix + '-';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function genCode(prefix: string): string {
  const dateS = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateS}-${rand}`;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🗑️  WIPING ALL EXISTING DATA...');
  
  // Delete in reverse FK dependency order
  await db.delete(schema.telegramNotificationLogs);
  await db.delete(schema.telegramNotificationEvents);
  await db.delete(schema.telegramSettings);
  await db.delete(schema.auditLogs);
  await db.delete(schema.accountingPeriods);
  await db.delete(schema.cashBookEntries);
  await db.delete(schema.expenses);
  await db.delete(schema.expenseCategories);
  await db.delete(schema.warrantyLogs);
  await db.delete(schema.warrantyClaims);
  await db.delete(schema.returnItems);
  await db.delete(schema.returns);
  await db.delete(schema.quotationItems);
  await db.delete(schema.quotations);
  await db.delete(schema.payments);
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.inventoryMovements);
  await db.delete(schema.inventoryItems);
  await db.delete(schema.purchaseOrderItems);
  await db.delete(schema.purchaseOrders);
  await db.delete(schema.products);
  await db.delete(schema.categories);
  await db.delete(schema.brands);
  await db.delete(schema.suppliers);
  await db.delete(schema.customers);
  await db.delete(schema.leadSources);
  // Don't delete profiles — they're linked to auth.users
  console.log('✅ All data wiped.\n');

  // ============================================================
  // 0. PROFILE (Owner)
  // ============================================================
  console.log('👤 Ensuring owner profile...');
  let profileId: string;
  const existingProfiles = await db.select().from(schema.profiles).limit(1);
  if (existingProfiles.length > 0) {
    profileId = existingProfiles[0].id;
    console.log(`   Using existing: ${existingProfiles[0].fullName}`);
  } else {
    const dummyId = '77777777-7777-7777-7777-777777777777';
    await db.insert(schema.profiles).values({
      id: dummyId,
      fullName: 'Nguyễn Minh',
      email: 'owner@techshop.vn',
      phone: '0909123456',
      role: 'admin',
      isActive: true,
    });
    profileId = dummyId;
    console.log(`   Created dummy owner profile`);
  }

  // ============================================================
  // 1. BRANDS
  // ============================================================
  console.log('🏭 Seeding brands...');
  const brandsData = [
    { name: 'Apple', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' },
    { name: 'Dell', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/48/Dell_Logo.svg' },
    { name: 'Asus', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/ASUS_Logo.svg' },
    { name: 'Lenovo', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg' },
    { name: 'HP', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/HP_logo_2012.svg' },
  ];
  const brands = await db.insert(schema.brands).values(brandsData).returning();
  const brandMap = Object.fromEntries(brands.map(b => [b.name, b.id]));

  // ============================================================
  // 2. CATEGORIES
  // ============================================================
  console.log('📁 Seeding categories...');
  const [laptopCat] = await db.insert(schema.categories).values({ name: 'Laptop', slug: 'laptop', description: 'Máy tính xách tay các loại' }).returning();
  const subCats = await db.insert(schema.categories).values([
    { name: 'MacBook Air', slug: 'macbook-air', description: 'Apple MacBook Air', parentId: laptopCat.id },
    { name: 'MacBook Pro', slug: 'macbook-pro', description: 'Apple MacBook Pro', parentId: laptopCat.id },
  ]).returning();
  const [iphoneCat] = await db.insert(schema.categories).values({ name: 'iPhone', slug: 'iphone', description: 'Điện thoại Apple iPhone' }).returning();
  const [ipadCat] = await db.insert(schema.categories).values({ name: 'iPad', slug: 'ipad', description: 'Máy tính bảng Apple iPad' }).returning();
  const [accessoryCat] = await db.insert(schema.categories).values({ name: 'Phụ kiện', slug: 'phu-kien', description: 'Phụ kiện công nghệ' }).returning();

  const catMap: Record<string, string> = {
    'MacBook Air': subCats.find(c => c.name === 'MacBook Air')!.id,
    'MacBook Pro': subCats.find(c => c.name === 'MacBook Pro')!.id,
    'iPhone': iphoneCat.id,
    'iPad': ipadCat.id,
    'Laptop': laptopCat.id,
    'Phụ kiện': accessoryCat.id,
  };

  // ============================================================
  // 3. PRODUCTS (12 models)
  // ============================================================
  console.log('💻 Seeding products...');
  const productDefinitions = [
    { name: 'MacBook Air 13-inch M3', slug: 'macbook-air-13-m3', sku: 'MBA13-M3', cat: 'MacBook Air', brand: 'Apple', specs: { cpu: 'Apple M3 8-core', gpu: '8-core GPU', ram: '8GB', ssd: '256GB SSD', screen: '13.6" Liquid Retina', color: 'Midnight' }, baseCost: 23500000, baseSell: 27990000, prefix: 'MBA13' },
    { name: 'MacBook Air 15-inch M3', slug: 'macbook-air-15-m3', sku: 'MBA15-M3', cat: 'MacBook Air', brand: 'Apple', specs: { cpu: 'Apple M3 8-core', gpu: '10-core GPU', ram: '16GB', ssd: '512GB SSD', screen: '15.3" Liquid Retina', color: 'Starlight' }, baseCost: 30000000, baseSell: 34990000, prefix: 'MBA15' },
    { name: 'MacBook Pro 14-inch M3 Pro', slug: 'macbook-pro-14-m3-pro', sku: 'MBP14-M3P', cat: 'MacBook Pro', brand: 'Apple', specs: { cpu: 'Apple M3 Pro 11-core', gpu: '14-core GPU', ram: '18GB', ssd: '512GB SSD', screen: '14.2" Liquid Retina XDR', color: 'Space Black' }, baseCost: 39900000, baseSell: 45990000, prefix: 'MBP14' },
    { name: 'MacBook Pro 16-inch M3 Max', slug: 'macbook-pro-16-m3-max', sku: 'MBP16-M3X', cat: 'MacBook Pro', brand: 'Apple', specs: { cpu: 'Apple M3 Max 14-core', gpu: '30-core GPU', ram: '36GB', ssd: '1TB SSD', screen: '16.2" Liquid Retina XDR', color: 'Space Black' }, baseCost: 65000000, baseSell: 74990000, prefix: 'MBP16' },
    { name: 'iPhone 15 Pro Max 256GB', slug: 'iphone-15-pro-max-256', sku: 'IP15PM-256', cat: 'iPhone', brand: 'Apple', specs: { cpu: 'Apple A17 Pro', ram: '8GB', ssd: '256GB', screen: '6.7" Super Retina XDR', color: 'Natural Titanium' }, baseCost: 26000000, baseSell: 29990000, prefix: 'IP15PM' },
    { name: 'iPhone 14 Pro 128GB', slug: 'iphone-14-pro-128', sku: 'IP14P-128', cat: 'iPhone', brand: 'Apple', specs: { cpu: 'Apple A16 Bionic', ram: '6GB', ssd: '128GB', screen: '6.1" Super Retina XDR', color: 'Deep Purple' }, baseCost: 17500000, baseSell: 19990000, prefix: 'IP14P' },
    { name: 'iPad Pro 11-inch M4', slug: 'ipad-pro-11-m4', sku: 'IPDP11-M4', cat: 'iPad', brand: 'Apple', specs: { cpu: 'Apple M4 9-core', ram: '8GB', ssd: '256GB', screen: '11" Ultra Retina XDR OLED', color: 'Space Gray' }, baseCost: 22500000, baseSell: 25990000, prefix: 'IPDP11' },
    { name: 'iPad Air 11-inch M2', slug: 'ipad-air-11-m2', sku: 'IPDA11-M2', cat: 'iPad', brand: 'Apple', specs: { cpu: 'Apple M2 8-core', ram: '8GB', ssd: '128GB', screen: '11" Liquid Retina', color: 'Blue' }, baseCost: 13000000, baseSell: 15490000, prefix: 'IPDA11' },
    { name: 'Dell XPS 13 9340', slug: 'dell-xps-13-9340', sku: 'DXPS13-9340', cat: 'Laptop', brand: 'Dell', specs: { cpu: 'Intel Core Ultra 7 155H', ram: '16GB LPDDR5X', ssd: '512GB NVMe', screen: '13.4" FHD+ InfinityEdge', color: 'Platinum Silver' }, baseCost: 31000000, baseSell: 35990000, prefix: 'DXPS13' },
    { name: 'ThinkPad X1 Carbon Gen 12', slug: 'thinkpad-x1-carbon-g12', sku: 'TPX1-G12', cat: 'Laptop', brand: 'Lenovo', specs: { cpu: 'Intel Core Ultra 7 165U vPro', ram: '32GB LPDDR5X', ssd: '1TB NVMe', screen: '14" 2.8K OLED', color: 'Matte Black' }, baseCost: 45000000, baseSell: 52000000, prefix: 'TPX1' },
    { name: 'Asus ROG Zephyrus G14 OLED', slug: 'asus-rog-zephyrus-g14', sku: 'ROG-G14-OLED', cat: 'Laptop', brand: 'Asus', specs: { cpu: 'AMD Ryzen 9 8945HS', gpu: 'RTX 4060 8GB', ram: '16GB LPDDR5X', ssd: '1TB NVMe', screen: '14" 3K OLED 120Hz', color: 'Eclipse Gray' }, baseCost: 35000000, baseSell: 39990000, prefix: 'ROGG14' },
    { name: 'HP Spectre x360 14', slug: 'hp-spectre-x360-14', sku: 'HPSX360-14', cat: 'Laptop', brand: 'HP', specs: { cpu: 'Intel Core Ultra 7 155H', ram: '16GB LPDDR5X', ssd: '512GB NVMe', screen: '14" 2.8K OLED Touch', color: 'Nightfall Black' }, baseCost: 33000000, baseSell: 38990000, prefix: 'HPSX14' },
  ];

  const productRows: Array<typeof productDefinitions[0] & { id: string }> = [];
  for (const p of productDefinitions) {
    const [row] = await db.insert(schema.products).values({
      name: p.name, slug: p.slug, sku: p.sku,
      categoryId: catMap[p.cat], brandId: brandMap[p.brand],
      description: `${p.name} — máy chính hãng, bảo hành 12 tháng tại TechStore.`,
      specs: p.specs, warrantyMonths: 12, isActive: true,
    }).returning();
    productRows.push({ ...p, id: row.id });
  }

  // ============================================================
  // 4. SUPPLIERS
  // ============================================================
  console.log('🏪 Seeding suppliers...');
  const suppliersData = [
    { name: 'Apple Việt Nam (Authorized)', contactName: 'Trần Văn Hùng', phone: '028 3825 1234', email: 'orders@apple-vn.com', address: '89 Nguyễn Huệ, Q.1, TP.HCM', country: 'VN', taxCode: '0301234567' },
    { name: 'FPT Trading JSC', contactName: 'Nguyễn Thị Lan', phone: '024 3795 5566', email: 'wholesale@fpt.com.vn', address: '17 Duy Tân, Cầu Giấy, Hà Nội', country: 'VN', taxCode: '0102345678' },
    { name: 'Digiworld Corp', contactName: 'Lê Minh Tuấn', phone: '028 3812 7890', email: 'b2b@digiworld.com.vn', address: '47 Điện Biên Phủ, Q.3, TP.HCM', country: 'VN', taxCode: '0303456789' },
    { name: 'MacStore US (Importer)', contactName: 'John Nguyen', phone: '+1-408-555-0192', email: 'wholesale@macstore.us', address: '1 Infinite Loop, Cupertino, CA', country: 'US', taxCode: 'US-EIN-12345' },
    { name: 'Phong Vũ Computer', contactName: 'Phạm Đức Anh', phone: '028 3866 7788', email: 'doanhnghiep@phongvu.vn', address: '258 Trần Hưng Đạo, Q.5, TP.HCM', country: 'VN', taxCode: '0304567890' },
  ];
  const suppliers = await db.insert(schema.suppliers).values(suppliersData).returning();

  // ============================================================
  // 5. LEAD SOURCES
  // ============================================================
  console.log('📣 Seeding lead sources...');
  const leadSourcesData = [
    { name: 'Facebook', icon: '📘', color: '#1877F2' },
    { name: 'Chợ Tốt', icon: '🛒', color: '#F5A623' },
    { name: 'VOZ Forum', icon: '💬', color: '#2196F3' },
    { name: 'Zalo', icon: '💙', color: '#0068FF' },
    { name: 'Website', icon: '🌐', color: '#4CAF50' },
    { name: 'Giới thiệu', icon: '🤝', color: '#9C27B0' },
  ];
  const leadSources = await db.insert(schema.leadSources).values(leadSourcesData).returning();

  // ============================================================
  // 6. CUSTOMERS (15)
  // ============================================================
  console.log('👤 Seeding 15 customers...');
  const customersData = [
    { fullName: 'Nguyễn Văn An', phone: '0901234567', email: 'an.nguyen@gmail.com', address: '123 Nguyễn Trãi, Q.5, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[0].id },
    { fullName: 'Trần Thị Bình', phone: '0912345678', email: 'binh.tran@yahoo.com', address: '45 Lê Lợi, Q.1, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[1].id },
    { fullName: 'Lê Hoàng Cường', phone: '0923456789', email: 'cuong.le@outlook.com', address: '78 Hai Bà Trưng, Q.3, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[2].id },
    { fullName: 'Phạm Minh Đức', phone: '0934567890', email: 'duc.pham@gmail.com', address: '12 Trần Hưng Đạo, Q.1, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[3].id },
    { fullName: 'Hoàng Thị Hoa', phone: '0945678901', email: 'hoa.hoang@gmail.com', address: '56 Võ Văn Tần, Q.3, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[0].id },
    { fullName: 'Vũ Đình Khoa', phone: '0956789012', email: 'khoa.vu@gmail.com', address: '234 Cách Mạng Tháng 8, Q.10, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[4].id },
    { fullName: 'Đặng Thanh Linh', phone: '0967890123', address: '89 Phan Xích Long, Phú Nhuận, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[5].id },
    { fullName: 'Bùi Quốc Minh', phone: '0978901234', email: 'minh.bui@tech.vn', address: '167 Nguyễn Đình Chiểu, Q.3, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[2].id },
    { fullName: 'Ngô Thị Ngọc', phone: '0989012345', email: 'ngoc.ngo@gmail.com', address: '23 Lý Tự Trọng, Q.1, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[1].id },
    { fullName: 'Cao Hữu Phát', phone: '0990123456', address: '45 Đinh Tiên Hoàng, Bình Thạnh, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[3].id },
    { fullName: 'Lý Quang Sơn', phone: '0901111222', email: 'son.ly@gmail.com', address: '78 Nguyễn Thị Minh Khai, Q.1, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[4].id },
    { fullName: 'Đỗ Thị Trang', phone: '0912222333', address: '90 Bùi Viện, Q.1, TP.HCM', customerType: 'individual' as const, leadSourceId: leadSources[5].id },
    { fullName: 'Công ty TNHH ABC Tech', phone: '028 3811 1234', email: 'mua@abctech.vn', address: '100 Nguyễn Văn Trỗi, Phú Nhuận, TP.HCM', customerType: 'business' as const, taxCode: '0312345678', leadSourceId: leadSources[4].id },
    { fullName: 'Công ty CP Sáng Tạo Số', phone: '028 3822 5678', email: 'it@sangtaoso.vn', address: '50 Lê Duẩn, Q.1, TP.HCM', customerType: 'business' as const, taxCode: '0315678901', leadSourceId: leadSources[0].id },
    { fullName: 'Trường ĐH Bách Khoa TP.HCM', phone: '028 3864 7256', email: 'phongthietbi@hcmut.edu.vn', address: '268 Lý Thường Kiệt, Q.10, TP.HCM', customerType: 'business' as const, taxCode: '0301098765', leadSourceId: leadSources[5].id },
  ];
  const customerRows = await db.insert(schema.customers).values(customersData).returning();

  // ============================================================
  // 7. PURCHASE ORDERS (5 POs)
  // ============================================================
  console.log('📥 Seeding purchase orders...');
  const poStatuses: Array<'received' | 'in_transit' | 'draft'> = ['received', 'received', 'received', 'in_transit', 'draft'];
  const poData = [
    { supplier: suppliers[0], status: 'received' as const, total: '280000000', arrival: daysAgo(45), products: [productRows[0], productRows[2]], qtys: [5, 3] },
    { supplier: suppliers[1], status: 'received' as const, total: '195000000', arrival: daysAgo(30), products: [productRows[4], productRows[5]], qtys: [4, 3] },
    { supplier: suppliers[3], status: 'received' as const, total: '450000000', arrival: daysAgo(20), products: [productRows[3], productRows[8]], qtys: [3, 5] },
    { supplier: suppliers[2], status: 'in_transit' as const, total: '150000000', arrival: null, products: [productRows[6], productRows[7]], qtys: [3, 4] },
    { supplier: suppliers[4], status: 'draft' as const, total: '210000000', arrival: null, products: [productRows[9], productRows[10]], qtys: [2, 3] },
  ];

  const poRows: any[] = [];
  for (let i = 0; i < poData.length; i++) {
    const po = poData[i];
    const [poRow] = await db.insert(schema.purchaseOrders).values({
      poNumber: `PO-2026${String(i + 1).padStart(2, '0')}-${String(i * 100 + 1).padStart(4, '0')}`,
      supplierId: po.supplier.id,
      status: po.status,
      originCountry: po.supplier.country || 'VN',
      shippingMethod: po.status === 'draft' ? null : 'Vận chuyển đường biển',
      totalCost: po.total,
      shippingCost: po.status === 'received' ? String(randomInt(2000000, 8000000)) : '0',
      taxImport: po.status === 'received' ? String(randomInt(5000000, 15000000)) : '0',
      expectedArrival: po.arrival ? dateStr(po.arrival) : (po.status === 'in_transit' ? dateStr(daysAgo(-10)) : null),
      actualArrival: po.status === 'received' ? dateStr(po.arrival!) : null,
      notes: `Đơn nhập hàng từ ${po.supplier.name}`,
      createdBy: profileId,
    }).returning();
    poRows.push(poRow);

    // PO Items
    for (let j = 0; j < po.products.length; j++) {
      const prod = po.products[j];
      const qty = po.qtys[j];
      await db.insert(schema.purchaseOrderItems).values({
        purchaseOrderId: poRow.id,
        productId: prod.id,
        quantity: qty,
        unitCost: String(prod.baseCost),
        totalCost: String(prod.baseCost * qty),
        receivedQuantity: po.status === 'received' ? qty : 0,
      });
    }
  }

  // ============================================================
  // 8. INVENTORY ITEMS (100 machines)
  // ============================================================
  console.log('📦 Seeding 100 inventory items...');
  const statusPool = [
    ...Array(60).fill('in_stock'),
    ...Array(10).fill('incoming'),
    ...Array(20).fill('sold'),
    ...Array(4).fill('warranty_repair'),
    ...Array(2).fill('returned_in_stock'),
    ...Array(1).fill('returned_defective'),
    ...Array(3).fill('defective'),
  ];

  const locations = ['Kệ A-1', 'Kệ A-2', 'Kệ B-1', 'Kệ B-2', 'Tủ Kính 1', 'Tủ Kính 2', 'Kho A', 'Kho B'];
  const notesBank = {
    new: ['Hàng nguyên seal hộp', 'Fullbox chính hãng', 'Seal nguyên vẹn', 'Đầy đủ phụ kiện'],
    used: ['Máy đẹp 99%', 'Ngoại hình 98%, xước nhẹ', 'Pin cycle 45, 98% capacity', 'Đủ sạc cáp, không hộp'],
  };

  const allItems: any[] = [];
  for (let i = 0; i < 100; i++) {
    const model = productRows[i % productRows.length];
    const status = statusPool[i];
    const condition: 'new' | 'used' = Math.random() < 0.8 ? 'new' : 'used';
    const priceVar = 0.95 + Math.random() * 0.1;
    const costPrice = Math.round((model.baseCost * priceVar) / 10000) * 10000;
    const sellingPrice = Math.round((model.baseSell * priceVar) / 10000) * 10000;

    const basePast = daysAgo(randomInt(10, 90));

    let expectedArrivalDate: string | null = null;
    let receivedDate: string | null = null;
    let stockedDate: string | null = null;
    let tempSoldDate: string | null = null;
    let tempWarrantyStart: string | null = null;
    let tempWarrantyEnd: string | null = null;

    if (status === 'incoming') {
      expectedArrivalDate = dateStr(daysAgo(-randomInt(3, 15)));
    } else {
      receivedDate = dateStr(basePast);
      stockedDate = dateStr(basePast);
      if (status === 'sold' || status === 'warranty_repair' || status === 'returned_in_stock' || status === 'returned_defective') {
        const soldDateObj = new Date(basePast);
        soldDateObj.setDate(soldDateObj.getDate() + randomInt(1, 5));
        tempSoldDate = dateStr(soldDateObj);
        tempWarrantyStart = tempSoldDate;
        const endObj = new Date(soldDateObj);
        endObj.setMonth(endObj.getMonth() + 12);
        tempWarrantyEnd = dateStr(endObj);
      }
    }

    const dbStatus = (status === 'returned_in_stock') ? 'in_stock' : ((status === 'returned_defective') ? 'defective' : status) as any;
    const isReturned = (status === 'returned_in_stock' || status === 'returned_defective');

    const [item] = await db.insert(schema.inventoryItems).values({
      serialNumber: generateSerial(model.prefix, 8),
      productId: model.id,
      condition,
      status: dbStatus,
      costPrice: costPrice.toString(),
      sellingPrice: sellingPrice.toString(),
      originCountry: pick(['VN', 'VN', 'VN', 'US', 'SG']),
      location: status === 'incoming' ? null : pick(locations),
      expectedArrivalDate, 
      receivedDate, 
      stockedDate, 
      soldDate: isReturned ? null : tempSoldDate, 
      warrantyStart: isReturned ? null : tempWarrantyStart, 
      warrantyEnd: isReturned ? null : tempWarrantyEnd,
      notes: pick(notesBank[condition]),
      createdBy: profileId,
    }).returning();
    allItems.push({ ...item, model, originalStatus: status, tempSoldDate });
  }

  // Insert movements for all items
  console.log('📈 Seeding inventory movements...');
  for (const item of allItems) {
    if (item.status !== 'incoming') {
      await db.insert(schema.inventoryMovements).values({
        inventoryItemId: item.id,
        movementType: 'stocked', fromStatus: null, toStatus: 'in_stock',
        referenceType: 'manual', quantityChange: 1,
        locationTo: item.location, notes: 'Nhập kho lô hàng',
        performedBy: profileId, performedAt: item.stockedDate ? new Date(item.stockedDate) : new Date(),
      });
      if (item.originalStatus === 'sold') {
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'sold', fromStatus: 'in_stock', toStatus: 'sold',
          referenceType: 'order', quantityChange: -1,
          locationFrom: item.location, notes: 'Xuất bán hàng',
          performedBy: profileId, performedAt: item.tempSoldDate ? new Date(item.tempSoldDate) : new Date(),
        });
      } else if (item.status === 'defective' && item.originalStatus !== 'returned_defective') {
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'defective', fromStatus: 'in_stock', toStatus: 'defective',
          referenceType: 'stocktake', quantityChange: -1,
          locationFrom: item.location, locationTo: 'Khu hàng hỏng',
          notes: 'Phát hiện lỗi phần cứng', performedBy: profileId,
        });
      } else if (item.originalStatus === 'warranty_repair') {
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'sold', fromStatus: 'in_stock', toStatus: 'sold',
          referenceType: 'order', quantityChange: -1,
          locationFrom: item.location, notes: 'Xuất bán hàng',
          performedBy: profileId, performedAt: item.tempSoldDate ? new Date(item.tempSoldDate) : new Date(),
        });
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'warranty_in', fromStatus: 'sold', toStatus: 'warranty_repair',
          referenceType: 'warranty_claim', quantityChange: 1,
          locationTo: 'Khu bảo hành', notes: 'Khách gửi bảo hành',
          performedBy: profileId,
        });
      } else if (item.originalStatus === 'returned_in_stock') {
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'sold', fromStatus: 'in_stock', toStatus: 'sold',
          referenceType: 'order', quantityChange: -1,
          locationFrom: item.location, notes: 'Xuất bán hàng',
          performedBy: profileId, performedAt: item.tempSoldDate ? new Date(item.tempSoldDate) : new Date(),
        });
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'returned', fromStatus: 'sold', toStatus: 'in_stock',
          referenceType: 'manual', quantityChange: 1,
          locationTo: item.location, notes: 'Khách trả máy đổi model (Không lỗi -> Hoàn về sẵn bán)',
          performedBy: profileId,
          performedAt: item.tempSoldDate ? new Date(new Date(item.tempSoldDate).getTime() + 3 * 24 * 60 * 60 * 1000) : new Date(),
        });
      } else if (item.originalStatus === 'returned_defective') {
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'sold', fromStatus: 'in_stock', toStatus: 'sold',
          referenceType: 'order', quantityChange: -1,
          locationFrom: item.location, notes: 'Xuất bán hàng',
          performedBy: profileId, performedAt: item.tempSoldDate ? new Date(item.tempSoldDate) : new Date(),
        });
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'returned', fromStatus: 'sold', toStatus: 'defective',
          referenceType: 'manual', quantityChange: 1,
          locationTo: item.location, notes: 'Khách trả máy do lỗi (Máy lỗi -> Hoàn về kho lỗi)',
          performedBy: profileId,
          performedAt: item.tempSoldDate ? new Date(new Date(item.tempSoldDate).getTime() + 3 * 24 * 60 * 60 * 1000) : new Date(),
        });
      }
    } else {
      await db.insert(schema.inventoryMovements).values({
        inventoryItemId: item.id,
        movementType: 'received', fromStatus: null, toStatus: 'incoming',
        referenceType: 'purchase_order', quantityChange: 1,
        notes: 'Chờ hàng về', performedBy: profileId,
      });
    }
  }

  // ============================================================
  // 9. ORDERS (10 đơn hàng)
  // ============================================================
  console.log('🛒 Seeding 10 orders...');
  const soldItems = allItems.filter(i => i.status === 'sold');
  const warrantyItems = allItems.filter(i => i.status === 'warranty_repair');
  const returnedInStockItems = allItems.filter(i => i.originalStatus === 'returned_in_stock');
  const returnedDefectiveItems = allItems.filter(i => i.originalStatus === 'returned_defective');
  const allOrderableItems = [...soldItems, ...warrantyItems, ...returnedInStockItems, ...returnedDefectiveItems];

  const orderRows: any[] = [];
  const orderItemRows: any[] = [];
  let itemIdx = 0;

  for (let i = 0; i < 10; i++) {
    const customer = customerRows[i % customerRows.length];
    const itemCount = i < 3 ? 3 : (i < 6 ? 2 : 1);
    const orderItems: any[] = [];

    for (let j = 0; j < itemCount && itemIdx < allOrderableItems.length; j++) {
      const inv = allOrderableItems[itemIdx++];
      orderItems.push(inv);
    }
    if (orderItems.length === 0) continue;

    let subtotal = 0, totalCost = 0;
    orderItems.forEach(inv => {
      subtotal += Number(inv.sellingPrice);
      totalCost += Number(inv.costPrice);
    });
    const discAmount = i % 4 === 0 ? Math.round(subtotal * 0.02) : 0;
    const taxAmount = i % 3 === 0 ? Math.round(subtotal * 0.1) : 0;
    const totalAmount = subtotal - discAmount + taxAmount;
    const profit = totalAmount - totalCost;
    const margin = totalAmount > 0 ? (profit / totalAmount) * 100 : 0;

    const isCancelled = i === 8;
    const status = isCancelled ? 'cancelled' as const : 'completed' as const;
    const payStatus = isCancelled ? 'refunded' as const : (i === 7 ? 'partial' as const : 'paid' as const);
    const payMethod = pick(['cash', 'bank_transfer', 'card', 'mixed'] as const);
    const channel = pick(['online', 'offline'] as const);
    const createdAt = daysAgo(randomInt(1, 60));

    const [order] = await db.insert(schema.orders).values({
      orderNumber: `ORD-${dateStr(createdAt).replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
      customerId: customer.id,
      leadSourceId: pick(leadSources).id,
      status, saleChannel: channel,
      subtotal: subtotal.toString(),
      discountAmount: discAmount.toString(),
      taxAmount: taxAmount.toString(),
      totalAmount: totalAmount.toString(),
      totalCost: totalCost.toString(),
      profit: profit.toString(),
      profitMargin: margin.toFixed(2),
      paymentStatus: payStatus,
      paymentMethod: payMethod,
      notes: isCancelled ? 'Khách hủy đơn, không còn nhu cầu' : null,
      soldBy: profileId,
      createdAt,
    }).returning();
    orderRows.push(order);

    // Order Items
    for (const inv of orderItems) {
      const sellingP = Number(inv.sellingPrice);
      const costP = Number(inv.costPrice);
      const [oi] = await db.insert(schema.orderItems).values({
        orderId: order.id,
        inventoryItemId: inv.id,
        productId: inv.productId,
        sellingPrice: sellingP.toString(),
        costPrice: costP.toString(),
        discount: '0',
        profit: (sellingP - costP).toString(),
        warrantyMonths: 12,
      }).returning();
      orderItemRows.push({ ...oi, inventoryItem: inv });
    }

    // Payments
    if (!isCancelled) {
      const paidAmount = payStatus === 'partial' ? Math.round(totalAmount * 0.6) : totalAmount;
      const mappedPayMethod = payMethod === 'mixed' ? 'cash' : payMethod;
      await db.insert(schema.payments).values({
        orderId: order.id,
        amount: paidAmount.toString(),
        paymentMethod: mappedPayMethod as any,
        notes: 'Thanh toán khi lập đơn',
        createdBy: profileId,
      });

      // Update customer stats
      const cust = customerRows.find(c => c.id === customer.id);
      if (cust) {
        cust.totalSpent = String(Number(cust.totalSpent || 0) + totalAmount);
        cust.orderCount = (cust.orderCount || 0) + 1;
      }
    }
  }

  // Update customer stats in DB
  for (const c of customerRows) {
    if (Number(c.totalSpent || 0) > 0) {
      await db.update(schema.customers)
        .set({ totalSpent: c.totalSpent, orderCount: c.orderCount })
        .where(sql`${schema.customers.id} = ${c.id}`);
    }
  }

  // ============================================================
  // 10. QUOTATIONS (5)
  // ============================================================
  console.log('📋 Seeding 5 quotations...');
  const inStockItems = allItems.filter(i => i.status === 'in_stock');
  const quoteStatuses: Array<'draft' | 'sent' | 'viewed' | 'accepted' | 'converted'> = ['draft', 'sent', 'viewed', 'accepted', 'converted'];

  for (let i = 0; i < 5; i++) {
    const qCustomer = customerRows[i + 5];
    const invItem = inStockItems[i * 2] || inStockItems[0];
    const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const subtotal = Number(invItem.sellingPrice);
    const disc = i === 2 ? Math.round(subtotal * 0.05) : 0;
    const total = subtotal - disc;

    const [quote] = await db.insert(schema.quotations).values({
      quoteNumber: `QT-${dateStr(daysAgo(i * 3)).replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
      shareToken,
      customerId: qCustomer?.id || null,
      customerName: qCustomer ? null : 'Khách vãng lai',
      customerPhone: qCustomer ? null : '0999888777',
      leadSourceId: pick(leadSources).id,
      status: quoteStatuses[i],
      subtotal: subtotal.toString(),
      discountAmount: disc.toString(),
      totalAmount: total.toString(),
      validUntil: dateStr(daysAgo(-30)),
      notes: `Báo giá ${invItem.model.name} cho khách`,
      viewCount: quoteStatuses[i] === 'viewed' ? 3 : (quoteStatuses[i] === 'accepted' ? 5 : 0),
      convertedOrderId: quoteStatuses[i] === 'converted' ? orderRows[0]?.id : null,
      createdBy: profileId,
    }).returning();

    await db.insert(schema.quotationItems).values({
      quotationId: quote.id,
      inventoryItemId: invItem.id,
      productId: invItem.productId,
      quotedPrice: subtotal.toString(),
    });
  }

  // ============================================================
  // 11. RETURNS (3)
  // ============================================================
  console.log('🔄 Seeding 3 returns...');
  // Use first 3 completed orders for returns
  const completedOrders = orderRows.filter(o => o.status === 'completed');
  const returnReasons: Array<'defective' | 'changed_mind' | 'upgrade'> = ['defective', 'changed_mind', 'upgrade'];
  const returnTypes: Array<'return' | 'exchange' | 'return'> = ['return', 'exchange', 'return'];

  for (let i = 0; i < 3 && i < completedOrders.length; i++) {
    const ord = completedOrders[i];
    const customer = customerRows.find(c => c.id === ord.customerId) || customerRows[0];
    const ordItem = orderItemRows.find((oi: any) => oi.orderId === ord.id);
    if (!ordItem) continue;

    const refundAmt = Math.round(Number(ordItem.sellingPrice) * 0.95);

    const [ret] = await db.insert(schema.returns).values({
      returnNumber: `RET-${dateStr(daysAgo(i * 5)).replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
      orderId: ord.id,
      customerId: customer.id,
      type: returnTypes[i],
      reason: returnReasons[i],
      reasonDetail: i === 0 ? 'Màn hình có chỉ chết ở góc trái dưới' : (i === 1 ? 'Khách muốn đổi sang model cao hơn' : 'Khách cần máy mạnh hơn cho công việc'),
      status: 'completed',
      hasFee: i === 1,
      feeAmount: i === 1 ? '500000' : '0',
      refundAmount: refundAmt.toString(),
      exchangeDifference: i === 1 ? '5000000' : '0',
      notes: `Phiếu đổi trả #${i + 1}`,
      processedBy: profileId,
    }).returning();

    await db.insert(schema.returnItems).values({
      returnId: ret.id,
      inventoryItemId: ordItem.inventoryItem.id,
      productId: ordItem.productId,
      returnReason: i === 0 ? 'defective' : 'customer_request',
      conditionOnReturn: i === 0 ? 'defective' : 'like_new',
      isDefective: i === 0,
      defectDescription: i === 0 ? 'Màn hình hiển thị chỉ chết (dead pixel)' : null,
      originalPrice: ordItem.sellingPrice,
      refundPrice: refundAmt.toString(),
    });
  }

  // ============================================================
  // 12. WARRANTY CLAIMS (4)
  // ============================================================
  console.log('🔧 Seeding 4 warranty claims...');
  const warrantySeedItems = warrantyItems.slice(0, 4);
  // Find orders and order items that match warranty items
  const warrantyStatuses: Array<'pending' | 'inspecting' | 'repairing' | 'completed'> = ['pending', 'inspecting', 'repairing', 'completed'];
  const warrantyIssues = [
    'Máy bị nóng bất thường khi sạc, quạt kêu to',
    'Màn hình bị nhấp nháy sau 2 tuần sử dụng',
    'Loa rè tiếng khi mở volume lớn hơn 80%',
    'Pin tụt nhanh bất thường, chỉ dùng được 3 tiếng',
  ];

  for (let i = 0; i < warrantySeedItems.length && i < 4; i++) {
    const invItem = warrantySeedItems[i];
    // Find matching order item
    const oi = orderItemRows.find((o: any) => o.inventoryItem?.id === invItem.id);
    if (!oi) continue;
    const ord = orderRows.find((o: any) => o.id === oi.orderId);
    if (!ord) continue;

    const customer = customerRows.find(c => c.id === ord.customerId) || customerRows[0];
    const warrantyEnd = invItem.warrantyEnd || dateStr(daysAgo(-180));
    const receivedDate = dateStr(daysAgo(randomInt(1, 10)));

    const [claim] = await db.insert(schema.warrantyClaims).values({
      claimNumber: `WAR-${dateStr(daysAgo(i * 3)).replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
      orderId: ord.id,
      orderItemId: oi.id,
      inventoryItemId: invItem.id,
      customerId: customer.id,
      status: warrantyStatuses[i],
      issueDescription: warrantyIssues[i],
      diagnosis: i >= 1 ? 'Phát hiện lỗi phần cứng tại bo mạch chủ' : null,
      resolution: i === 3 ? 'Thay thế mainboard mới, kiểm tra toàn bộ hệ thống' : null,
      repairCost: i === 3 ? '2500000' : '0',
      isUnderWarranty: true,
      warrantyEndDate: warrantyEnd,
      receivedDate,
      expectedReturnDate: dateStr(daysAgo(-7)),
      actualReturnDate: i === 3 ? dateStr(daysAgo(1)) : null,
      createdBy: profileId,
    }).returning();

    // Warranty logs
    await db.insert(schema.warrantyLogs).values({
      warrantyClaimId: claim.id,
      action: 'created',
      description: `Khởi tạo phiếu bảo hành: ${warrantyIssues[i]}`,
      newStatus: 'pending',
      createdBy: profileId,
    });
    if (i >= 1) {
      await db.insert(schema.warrantyLogs).values({
        warrantyClaimId: claim.id,
        action: 'status_changed',
        description: 'Bắt đầu kiểm tra thiết bị, mở máy kiểm tra phần cứng',
        oldStatus: 'pending', newStatus: 'inspecting',
        createdBy: profileId,
      });
    }
    if (i >= 2) {
      await db.insert(schema.warrantyLogs).values({
        warrantyClaimId: claim.id,
        action: 'status_changed',
        description: 'Xác nhận lỗi, tiến hành sửa chữa/thay linh kiện',
        oldStatus: 'inspecting', newStatus: 'repairing',
        createdBy: profileId,
      });
    }
    if (i === 3) {
      await db.insert(schema.warrantyLogs).values({
        warrantyClaimId: claim.id,
        action: 'status_changed',
        description: 'Hoàn thành sửa chữa, máy đã chạy ổn định. Trả máy cho khách.',
        oldStatus: 'repairing', newStatus: 'completed',
        createdBy: profileId,
      });
    }
  }

  // ============================================================
  // 13. EXPENSE CATEGORIES + EXPENSES
  // ============================================================
  console.log('💰 Seeding expense categories & expenses...');
  const expCatData = [
    { name: 'Lương nhân viên', type: 'fixed' as const, description: 'Chi phí lương tháng cho nhân viên bán hàng & kỹ thuật' },
    { name: 'Thuê mặt bằng', type: 'fixed' as const, description: 'Tiền thuê cửa hàng/văn phòng hàng tháng' },
    { name: 'Điện nước internet', type: 'variable' as const, description: 'Chi phí tiện ích hàng tháng' },
    { name: 'Vận chuyển & Giao hàng', type: 'variable' as const, description: 'Phí ship cho khách, phí vận chuyển nội bộ' },
    { name: 'Marketing & Quảng cáo', type: 'variable' as const, description: 'Chi phí chạy ads Facebook, Google, nội dung' },
    { name: 'Bảo trì thiết bị', type: 'one_time' as const, description: 'Sửa chữa trang thiết bị cửa hàng' },
    { name: 'Đóng gói & Bao bì', type: 'variable' as const, description: 'Hộp, túi, phụ kiện đóng gói cho khách' },
    { name: 'Thuế & Phí pháp lý', type: 'fixed' as const, description: 'Thuế TNDN, phí giấy phép kinh doanh' },
  ];
  const expCats = await db.insert(schema.expenseCategories).values(expCatData).returning();

  const expensesSeeds = [
    { cat: 0, amount: '25000000', desc: 'Lương tháng 5/2026 - 2 nhân viên bán hàng', date: dateStr(daysAgo(30)), method: 'bank_transfer' as const },
    { cat: 0, amount: '25000000', desc: 'Lương tháng 4/2026 - 2 nhân viên bán hàng', date: dateStr(daysAgo(60)), method: 'bank_transfer' as const },
    { cat: 1, amount: '15000000', desc: 'Tiền thuê mặt bằng tháng 5/2026 - Q.1 TP.HCM', date: dateStr(daysAgo(28)), method: 'bank_transfer' as const },
    { cat: 2, amount: '3500000', desc: 'Tiền điện + nước + internet tháng 5/2026', date: dateStr(daysAgo(25)), method: 'cash' as const },
    { cat: 3, amount: '2000000', desc: 'Phí giao hàng GrabExpress + GHTK tháng 5', date: dateStr(daysAgo(15)), method: 'cash' as const },
    { cat: 4, amount: '5000000', desc: 'Chạy Facebook Ads - Chiến dịch MacBook Air M3', date: dateStr(daysAgo(10)), method: 'card' as const },
    { cat: 5, amount: '1500000', desc: 'Sửa chữa tủ kính trưng bày bị nứt', date: dateStr(daysAgo(20)), method: 'cash' as const },
    { cat: 6, amount: '800000', desc: 'Mua 200 hộp đóng gói cao cấp in logo TechStore', date: dateStr(daysAgo(18)), method: 'cash' as const },
  ];

  for (const exp of expensesSeeds) {
    await db.insert(schema.expenses).values({
      expenseNumber: genCode('EXP'),
      categoryId: expCats[exp.cat].id,
      amount: exp.amount,
      description: exp.desc,
      expenseDate: exp.date,
      paymentMethod: exp.method,
      createdBy: profileId,
    });
  }

  // ============================================================
  // 14. CASH BOOK ENTRIES
  // ============================================================
  console.log('📒 Seeding cash book entries...');
  let runningBalance = 0;

  // Income from completed orders
  for (const ord of orderRows.filter(o => o.status === 'completed')) {
    const amt = Number(ord.totalAmount);
    runningBalance += amt;
    await db.insert(schema.cashBookEntries).values({
      entryNumber: genCode('CB'),
      type: 'income', category: 'sales',
      amount: amt.toString(), runningBalance: runningBalance.toString(),
      paymentMethod: ord.paymentMethod === 'bank_transfer' || ord.paymentMethod === 'card' ? ord.paymentMethod : 'cash',
      referenceType: 'order', referenceId: ord.id,
      description: `Thu tiền đơn hàng ${ord.orderNumber}`,
      entryDate: dateStr(new Date(ord.createdAt)),
      createdBy: profileId,
    });
  }

  // Expenses
  for (const exp of expensesSeeds) {
    const amt = Number(exp.amount);
    runningBalance -= amt;
    await db.insert(schema.cashBookEntries).values({
      entryNumber: genCode('CB'),
      type: 'expense', category: exp.cat === 0 ? 'salary' : (exp.cat === 1 ? 'rent' : (exp.cat === 2 ? 'utility' : (exp.cat === 3 ? 'shipping' : 'other'))),
      amount: amt.toString(), runningBalance: runningBalance.toString(),
      paymentMethod: exp.method === 'card' ? 'card' : (exp.method === 'bank_transfer' ? 'bank_transfer' : 'cash'),
      referenceType: 'expense',
      description: exp.desc,
      entryDate: exp.date,
      createdBy: profileId,
    });
  }

  // ============================================================
  // 15. ACCOUNTING PERIODS + TAX DECLARATION
  // ============================================================
  console.log('📊 Seeding accounting periods & tax...');
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const start = dateStr(d);
    const end = dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));

    await db.insert(schema.accountingPeriods).values({
      period, startDate: start, endDate: end,
      isClosed: i === 2, // Oldest month is closed
      closedAt: i === 2 ? new Date() : null,
      closedBy: i === 2 ? profileId : null,
    });
  }



  // ============================================================
  // 16. TELEGRAM SETTINGS
  // ============================================================
  console.log('📲 Seeding Telegram settings...');
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';

  if (botToken && chatId) {
    const [tgSetting] = await db.insert(schema.telegramSettings).values({
      botToken, chatId, isActive: true,
      storeName: 'TechStore',
      storeAddress: '123 Nguyễn Huệ, Q.1, TP.HCM',
      storePhone: '0909123456',
      storeEmail: 'contact@techstore.vn',
      storeTaxCode: '0301234567',
      bankName: 'Vietcombank',
      bankAccount: '1234567890',
      bankOwner: 'NGUYEN MINH',
      invoiceFooter: 'Cảm ơn quý khách đã tin tưởng TechStore! Bảo hành 12 tháng chính hãng.',
      defaultVat: 10,
      defaultWarranty: 12,
      lowStockThreshold: 2,
      stockAgingThreshold: 90,
      createdBy: profileId,
    }).returning();

    // Enable notification events
    const eventTypes: Array<'order_completed' | 'order_cancelled' | 'inventory_added' | 'warranty_created' | 'expense_created' | 'low_stock_alert'> = [
      'order_completed', 'order_cancelled', 'inventory_added',
      'warranty_created', 'expense_created', 'low_stock_alert',
    ];
    for (const eventType of eventTypes) {
      await db.insert(schema.telegramNotificationEvents).values({
        telegramSettingId: tgSetting.id,
        eventType,
        isEnabled: true,
      });
    }
    console.log('   ✅ Telegram bot configured with 6 event types');
  } else {
    console.log('   ⚠️ No TELEGRAM_BOT_TOKEN/CHAT_ID found, skipping...');
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('🎉 COMPREHENSIVE SEED COMPLETE!');
  console.log('='.repeat(60));
  console.log(`   👤 Profiles:           1 owner`);
  console.log(`   🏭 Brands:             ${brands.length}`);
  console.log(`   📁 Categories:         ${Object.keys(catMap).length}`);
  console.log(`   💻 Products:           ${productRows.length}`);
  console.log(`   🏪 Suppliers:          ${suppliers.length}`);
  console.log(`   📥 Purchase Orders:    ${poRows.length}`);
  console.log(`   📣 Lead Sources:       ${leadSources.length}`);
  console.log(`   👤 Customers:          ${customerRows.length}`);
  console.log(`   📦 Inventory Items:    ${allItems.length}`);
  console.log(`   🛒 Orders:             ${orderRows.length}`);
  console.log(`   📋 Quotations:         5`);
  console.log(`   🔄 Returns:            3`);
  console.log(`   🔧 Warranty Claims:    ${warrantySeedItems.length}`);
  console.log(`   💰 Expense Categories: ${expCats.length}`);
  console.log(`   💸 Expenses:           ${expensesSeeds.length}`);
  console.log(`   📒 Cash Book:          ${orderRows.filter(o => o.status === 'completed').length + expensesSeeds.length} entries`);
  console.log(`   📊 Accounting Periods: 3`);
  console.log(`   📄 Tax Declarations:   1 (draft)`);
  console.log(`   📲 Telegram:           ${botToken ? 'Configured ✅' : 'Skipped ⚠️'}`);
  console.log('='.repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
});
