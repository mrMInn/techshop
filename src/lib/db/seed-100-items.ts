import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Helper to generate a random uppercase serial number
function generateSerial(prefix: string, length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = prefix + '-';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper to get random item from array
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to generate a random date in the past
function randomDatePast(daysAgoMax: number, daysAgoMin: number = 1): Date {
  const date = new Date();
  const diff = Math.floor(Math.random() * (daysAgoMax - daysAgoMin + 1)) + daysAgoMin;
  date.setDate(date.getDate() - diff);
  return date;
}

// Helper to generate a random date in the future
function randomDateFuture(daysAheadMax: number, daysAheadMin: number = 1): Date {
  const date = new Date();
  const diff = Math.floor(Math.random() * (daysAheadMax - daysAheadMin + 1)) + daysAheadMin;
  date.setDate(date.getDate() + diff);
  return date;
}

async function main() {
  console.log('🚀 Starting seed generation of 100 inventory items...');

  try {
    // ----------------------------------------------------
    // 1. ENSURE DUMMY PROFILE EXISTS (for Movements)
    // ----------------------------------------------------
    let profileId: string | null = null;
    try {
      const existingProfiles = await db.select().from(schema.profiles).limit(1);
      if (existingProfiles.length > 0) {
        profileId = existingProfiles[0].id;
        console.log(`👤 Using existing profile: ${existingProfiles[0].fullName} (ID: ${profileId})`);
      } else {
        const dummyId = '77777777-7777-7777-7777-777777777777';
        await db.insert(schema.profiles).values({
          id: dummyId,
          fullName: 'Quản trị viên Hệ thống',
          email: 'admin@techshop.vn',
          phone: '0987654321',
          role: 'owner',
          isActive: true,
        });
        profileId = dummyId;
        console.log(`👤 Created dummy profile for seeding: ${profileId}`);
      }
    } catch (e: any) {
      console.log('ℹ️ Profiles creation skipped:', e.message);
    }

    // ----------------------------------------------------
    // 2. ENSURE BRANDS EXIST
    // ----------------------------------------------------
    console.log('📦 Synchronizing brands...');
    const existingBrands = await db.select().from(schema.brands);
    const getBrandId = async (name: string, logoUrl: string) => {
      const found = existingBrands.find(b => b.name.toLowerCase() === name.toLowerCase());
      if (found) return found.id;
      const [newBrand] = await db.insert(schema.brands).values({ name, logoUrl }).returning();
      console.log(`➕ Brand added: ${name}`);
      return newBrand.id;
    };

    const appleId = await getBrandId('Apple', 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg');
    const asusId = await getBrandId('Asus', 'https://upload.wikimedia.org/wikipedia/commons/2/2e/ASUS_Logo.svg');
    const dellId = await getBrandId('Dell', 'https://upload.wikimedia.org/wikipedia/commons/4/48/Dell_Logo.svg');
    const lenovoId = await getBrandId('Lenovo', 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg');
    const hpId = await getBrandId('HP', 'https://upload.wikimedia.org/wikipedia/commons/a/ad/HP_logo_2012.svg');

    // ----------------------------------------------------
    // 3. ENSURE CATEGORIES EXIST
    // ----------------------------------------------------
    console.log('📁 Synchronizing categories...');
    const existingCategories = await db.select().from(schema.categories);
    const getCategoryId = async (name: string, slug: string, description: string, parentId?: string | null) => {
      const found = existingCategories.find(c => c.name.toLowerCase() === name.toLowerCase() || c.slug === slug);
      if (found) return found.id;
      const [newCat] = await db.insert(schema.categories).values({ name, slug, description, parentId }).returning();
      console.log(`➕ Category added: ${name}`);
      return newCat.id;
    };

    const laptopId = await getCategoryId('Laptop', 'laptop', 'Máy tính xách tay các loại');
    const macbookAirId = await getCategoryId('MacBook Air', 'macbook-air', 'Apple MacBook Air', laptopId);
    const macbookProId = await getCategoryId('MacBook Pro', 'macbook-pro', 'Apple MacBook Pro', laptopId);
    
    // Add iPhone and iPad categories as requested
    const iphoneId = await getCategoryId('iPhone', 'iphone', 'Điện thoại Apple iPhone');
    const ipadId = await getCategoryId('iPad', 'ipad', 'Máy tính bảng Apple iPad');

    // ----------------------------------------------------
    // 4. ENSURE PRODUCTS (MODELS) EXIST
    // ----------------------------------------------------
    console.log('💻 Synchronizing products (models)...');
    const existingProducts = await db.select().from(schema.products);
    
    const productList = [
      {
        name: 'MacBook Air 13-inch M3',
        slug: 'macbook-air-13-m3',
        sku: 'MBA13-M3',
        categoryId: macbookAirId,
        brandId: appleId,
        description: 'MacBook Air 13 inch với chip Apple M3, thiết kế siêu mỏng nhẹ.',
        specs: { cpu: 'Apple M3 8-core CPU', gpu: '8-core GPU', ram: '8GB Unified Memory', ssd: '256GB SSD', color: 'Midnight', screen: '13.6-inch Liquid Retina display' },
        baseCost: 23500000,
        baseSell: 27990000,
        prefix: 'MBA13'
      },
      {
        name: 'MacBook Pro 14-inch M3 Pro',
        slug: 'macbook-pro-14-m3-pro',
        sku: 'MBP14-M3-PRO',
        categoryId: macbookProId,
        brandId: appleId,
        description: 'MacBook Pro 14 inch với chip Apple M3 Pro, sức mạnh đồ hoạ vượt trội.',
        specs: { cpu: 'Apple M3 Pro 11-core CPU', gpu: '14-core GPU', ram: '18GB Unified Memory', ssd: '512GB SSD', color: 'Space Black', screen: '14.2-inch Liquid Retina XDR display' },
        baseCost: 39900000,
        baseSell: 45990000,
        prefix: 'MBP14M3'
      },
      {
        name: 'MacBook Pro 16-inch M3 Max',
        slug: 'macbook-pro-16-m3-max',
        sku: 'MBP16-M3-MAX',
        categoryId: macbookProId,
        brandId: appleId,
        description: 'MacBook Pro 16 inch với chip Apple M3 Max mạnh nhất.',
        specs: { cpu: 'Apple M3 Max 14-core CPU', gpu: '30-core GPU', ram: '36GB Unified Memory', ssd: '1TB SSD', color: 'Space Black', screen: '16.2-inch Liquid Retina XDR display' },
        baseCost: 65000000,
        baseSell: 74990000,
        prefix: 'MBP16M3'
      },
      {
        name: 'Macbook Pro 14 inch 2021',
        slug: 'macbook-pro-14-inch-2021',
        sku: 'MBP14-M1-Pro',
        categoryId: macbookProId,
        brandId: appleId,
        description: 'MacBook Pro 14 inch đời 2021 chip M1 Pro hiệu năng cao.',
        specs: { cpu: 'Apple M1 Pro 8-core CPU', ram: '32GB Unified Memory', ssd: '512GB SSD', color: 'Space Gray', screen: '14.2-inch Liquid Retina XDR' },
        baseCost: 21500000,
        baseSell: 25500000,
        prefix: 'MBP14M1'
      },
      // New products to add
      {
        name: 'iPhone 15 Pro Max 256GB',
        slug: 'iphone-15-pro-max-256gb',
        sku: 'IPH15PM-256',
        categoryId: iphoneId,
        brandId: appleId,
        description: 'iPhone 15 Pro Max vỏ Titan siêu nhẹ, camera zoom 5x, chip A17 Pro.',
        specs: { cpu: 'Apple A17 Pro', ram: '8GB RAM', ssd: '256GB Storage', color: 'Natural Titanium', screen: '6.7-inch Super Retina XDR' },
        baseCost: 26000000,
        baseSell: 29990000,
        prefix: 'IP15PM'
      },
      {
        name: 'iPhone 14 Pro 128GB',
        slug: 'iphone-14-pro-128gb',
        sku: 'IPH14P-128',
        categoryId: iphoneId,
        brandId: appleId,
        description: 'iPhone 14 Pro màn hình Dynamic Island, camera 48MP.',
        specs: { cpu: 'Apple A16 Bionic', ram: '6GB RAM', ssd: '128GB Storage', color: 'Deep Purple', screen: '6.1-inch Super Retina XDR' },
        baseCost: 17500000,
        baseSell: 19990000,
        prefix: 'IP14P'
      },
      {
        name: 'iPad Pro 11-inch M4 256GB',
        slug: 'ipad-pro-11-m4-256gb',
        sku: 'IPDP11-M4-256',
        categoryId: ipadId,
        brandId: appleId,
        description: 'iPad Pro 11-inch M4 thế hệ mới siêu mỏng, màn hình Tandem OLED.',
        specs: { cpu: 'Apple M4 9-core', ram: '8GB RAM', ssd: '256GB SSD', color: 'Space Gray', screen: '11-inch Ultra Retina XDR Tandem OLED' },
        baseCost: 22500000,
        baseSell: 25990000,
        prefix: 'IPDP11'
      },
      {
        name: 'iPad Air 11-inch M2 128GB',
        slug: 'ipad-air-11-m2-128gb',
        sku: 'IPDA11-M2-128',
        categoryId: ipadId,
        brandId: appleId,
        description: 'iPad Air 11-inch M2 mạnh mẽ, nhiều màu sắc năng động.',
        specs: { cpu: 'Apple M2 8-core', ram: '8GB RAM', ssd: '128GB Storage', color: 'Blue', screen: '11-inch Liquid Retina display' },
        baseCost: 13000000,
        baseSell: 15490000,
        prefix: 'IPDA11'
      },
      {
        name: 'Dell XPS 13 9340 Intel Ultra 7',
        slug: 'dell-xps-13-9340-ultra-7',
        sku: 'DELL-XPS13-9340',
        categoryId: laptopId,
        brandId: dellId,
        description: 'Dell XPS 13 thiết kế viền siêu mỏng, chip Intel Core Ultra 7 mạnh mẽ và tiết kiệm pin.',
        specs: { cpu: 'Intel Core Ultra 7 155H', ram: '16GB LPDDR5X', ssd: '512GB Gen4 PCIe SSD', color: 'Platinum Silver', screen: '13.4-inch FHD+ InfinityEdge' },
        baseCost: 31000000,
        baseSell: 35990000,
        prefix: 'DELXPS'
      },
      {
        name: 'ThinkPad X1 Carbon Gen 12',
        slug: 'thinkpad-x1-carbon-gen-12',
        sku: 'LNV-TPX1-G12',
        categoryId: laptopId,
        brandId: lenovoId,
        description: 'Dòng laptop doanh nhân huyền thoại Lenovo ThinkPad X1 Carbon Gen 12 siêu nhẹ từ sợi carbon.',
        specs: { cpu: 'Intel Core Ultra 7 165U vPro', ram: '32GB LPDDR5X', ssd: '1TB NVMe PCIe Gen4', color: 'Matte Black', screen: '14-inch 2.8K OLED Antiglare' },
        baseCost: 45000000,
        baseSell: 52000000,
        prefix: 'TPX1'
      },
      {
        name: 'Asus ROG Zephyrus G14 OLED',
        slug: 'asus-rog-zephyrus-g14-oled',
        sku: 'ASUS-ROG-G14-OLED',
        categoryId: laptopId,
        brandId: asusId,
        description: 'Laptop gaming cao cấp Asus ROG Zephyrus G14 màn hình OLED siêu đẹp, card RTX 4060.',
        specs: { cpu: 'AMD Ryzen 9 8945HS', gpu: 'NVIDIA GeForce RTX 4060 8GB', ram: '16GB LPDDR5X', ssd: '1TB NVMe SSD', color: 'Eclipse Gray', screen: '14-inch 3K OLED 120Hz' },
        baseCost: 35000000,
        baseSell: 39990000,
        prefix: 'ZEPHYR'
      },
      {
        name: 'Dell Latitude 7440 Core i7',
        slug: 'dell-latitude-7440-i7',
        sku: 'DELL-LAT7440-I7',
        categoryId: laptopId,
        brandId: dellId,
        description: 'Laptop phân khúc doanh nghiệp siêu bền Dell Latitude 7440.',
        specs: { cpu: 'Intel Core i7-1365U vPro', ram: '16GB LPDDR5', ssd: '512GB SSD', color: 'Titan Gray', screen: '14-inch FHD+ ComfortView Plus' },
        baseCost: 19000000,
        baseSell: 22500000,
        prefix: 'DELLAT'
      }
    ];

    const modelDatabaseList: Array<typeof productList[0] & { id: string }> = [];

    for (const prodData of productList) {
      const found = existingProducts.find(p => p.sku === prodData.sku || p.slug === prodData.slug);
      if (found) {
        modelDatabaseList.push({
          ...prodData,
          id: found.id
        });
      } else {
        const [newProd] = await db.insert(schema.products).values({
          name: prodData.name,
          slug: prodData.slug,
          sku: prodData.sku,
          categoryId: prodData.categoryId,
          brandId: prodData.brandId,
          description: prodData.description,
          specs: prodData.specs,
          warrantyMonths: 12,
          isActive: true
        }).returning();
        console.log(`➕ Product added: ${prodData.name}`);
        modelDatabaseList.push({
          ...prodData,
          id: newProd.id
        });
      }
    }

    // ----------------------------------------------------
    // 5. GENERATE 100 INVENTORY ITEMS
    // ----------------------------------------------------
    console.log('💻 Clearing old items from demo database to avoid seed conflicts (optional but safer)...');
    // Wait, let's keep existing items if we want, or we can just seed 100 more!
    // Since serial numbers are unique, we generate random unique serial numbers so there won't be conflicts.
    // Let's generate 100 brand new inventory items.

    console.log('⚡ Generating 100 inventory items data...');
    const itemsToInsert: Array<any> = [];
    const statusDistribution = [
      ...Array(65).fill('in_stock'),
      ...Array(15).fill('incoming'),
      ...Array(15).fill('sold'),
      ...Array(2).fill('warranty_repair'),
      ...Array(2).fill('returned_in_stock'),
      ...Array(1).fill('defective')
    ];

    const originCountries = ['VN', 'VN', 'VN', 'VN', 'US', 'US', 'JP', 'SG'];
    const locations = ['Kệ A-1', 'Kệ A-2', 'Kệ B-1', 'Kệ B-2', 'Tủ Kính 1', 'Tủ Kính 2', 'Kho A', 'Kho B'];
    
    // Notes corresponding to status or condition
    const notesPool = {
      new: ['Hàng nguyên seal hộp', 'Hàng new fullbox chính hãng', 'Seal hộp nguyên vẹn', 'Đầy đủ phụ kiện chính hãng'],
      used: ['Máy đẹp 99%, không cấn móp', 'Ngoại hình 98%, xước nhẹ mặt lưng', 'Pin sạc 45 lần, dung lượng 98%', 'Đầy đủ sạc cáp, không hộp', 'Ngoại hình 95%, cấn nhẹ góc trái'],
      defective: ['Màn hình sọc chỉ dọc đỏ', 'Không lên nguồn, sạc không báo đèn', 'Bàn phím liệt vài phím hàng số'],
      warranty_repair: ['Lỗi loa rè, đang chờ trung tâm bảo hành hãng trả', 'Lỗi sạc chậm, đang bảo hành sửa main'],
      returned: ['Khách đổi máy sang model cao hơn, hoàn trả nguyên trạng', 'Khách đổi trả trong 7 ngày đầu']
    };

    for (let i = 1; i <= 100; i++) {
      const model = getRandomItem(modelDatabaseList);
      const status = statusDistribution[i - 1] || 'in_stock';
      const condition = Math.random() < 0.8 ? 'new' : 'used'; // 80% new, 20% used
      
      const serial = generateSerial(model.prefix, 8);
      
      // Cost & selling price with minor random variations (+/- 5%)
      const priceVariation = 0.95 + Math.random() * 0.1; // 0.95 to 1.05
      const costPrice = Math.round((model.baseCost * priceVariation) / 10000) * 10000;
      
      // Selling price based on cost + markup, with random variation
      let sellingPrice: number | null = null;
      if (status !== 'incoming') {
        const markup = condition === 'new' ? 1.15 : 1.10; // 15% markup for new, 10% for used
        sellingPrice = Math.round((costPrice * markup * priceVariation) / 10000) * 10000;
      } else {
        // Expected selling price
        sellingPrice = Math.round((model.baseSell * priceVariation) / 10000) * 10000;
      }

      // Origin country and location
      const originCountry = getRandomItem(originCountries);
      const location = status === 'incoming' ? null : getRandomItem(locations);

      // Define Dates
      let expectedArrivalDate: string | null = null;
      let receivedDate: string | null = null;
      let stockedDate: string | null = null;
      let tempSoldDate: string | null = null;
      let tempWarrantyStart: string | null = null;
      let tempWarrantyEnd: string | null = null;

      const basePastDate = randomDatePast(90, 10);
      const basePastDateStr = basePastDate.toISOString().split('T')[0];

      if (status === 'incoming') {
        expectedArrivalDate = randomDateFuture(15, 2).toISOString().split('T')[0];
      } else if (status === 'in_stock' || status === 'defective') {
        receivedDate = basePastDateStr;
        stockedDate = basePastDateStr;
      } else if (status === 'sold' || status === 'warranty_repair' || status === 'returned_in_stock') {
        receivedDate = basePastDateStr;
        stockedDate = basePastDateStr;
        
        // Sold date must be after stocked date
        const soldOffset = Math.floor(Math.random() * 5) + 1; // 1-5 days after
        const soldDateObj = new Date(basePastDate);
        soldDateObj.setDate(soldDateObj.getDate() + soldOffset);
        tempSoldDate = soldDateObj.toISOString().split('T')[0];
        
        tempWarrantyStart = tempSoldDate;
        const warrantyEndObj = new Date(soldDateObj);
        warrantyEndObj.setMonth(warrantyEndObj.getMonth() + 12);
        tempWarrantyEnd = warrantyEndObj.toISOString().split('T')[0];
      }

      // Generate notes based on state
      let notes = '';
      if (status === 'defective') {
        notes = getRandomItem(notesPool.defective);
      } else if (status === 'warranty_repair') {
        notes = getRandomItem(notesPool.warranty_repair);
      } else if (status === 'returned_in_stock') {
        notes = getRandomItem(notesPool.returned);
      } else {
        notes = getRandomItem(notesPool[condition]);
      }

      // Custom specs overrides for 10% of items to demonstrate override capabilities in ERP
      let specsOverride: any = null;
      if (Math.random() < 0.1) {
        specsOverride = { ...model.specs };
        if (specsOverride.ram) {
          specsOverride.ram = specsOverride.ram.replace('8GB', '16GB').replace('16GB', '32GB').replace('18GB', '36GB') + ' (Upgraded)';
        }
        if (specsOverride.ssd) {
          specsOverride.ssd = specsOverride.ssd.replace('256GB', '512GB').replace('512GB', '1TB').replace('1TB', '2TB') + ' (Upgraded)';
        }
        notes += ' (Đã nâng cấp cấu hình phần cứng)';
      }

      itemsToInsert.push({
        serialNumber: serial,
        productId: model.id,
        purchaseOrderItemId: null,
        condition,
        status: status === 'returned_in_stock' ? 'in_stock' : status,
        originalStatus: status,
        tempSoldDate,
        costPrice: costPrice.toString(), // decimals in drizzle require strings
        sellingPrice: sellingPrice ? sellingPrice.toString() : null,
        specsOverride,
        originCountry,
        location,
        expectedArrivalDate,
        receivedDate,
        stockedDate,
        soldDate: status === 'returned_in_stock' ? null : tempSoldDate,
        warrantyStart: status === 'returned_in_stock' ? null : tempWarrantyStart,
        warrantyEnd: status === 'returned_in_stock' ? null : tempWarrantyEnd,
        notes,
        createdBy: profileId,
      });
    }

    console.log(`🔌 Inserting 100 inventory items into the database...`);
    
    // Chunk database insertions to avoid query payload limitations
    const chunkSize = 20;
    const insertedItems: any[] = [];
    for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
      const chunk = itemsToInsert.slice(i, i + chunkSize);
      const inserted = await db.insert(schema.inventoryItems).values(chunk).returning();
      insertedItems.push(...inserted);
      console.log(`✅ Inserted chunk ${i / chunkSize + 1} (${inserted.length} items)`);
    }

    // ----------------------------------------------------
    // 6. GENERATE STOCK CARD MOVEMENTS (optional but highly premium)
    // ----------------------------------------------------
    if (profileId && insertedItems.length > 0) {
      console.log('📈 Seeding stock card movement history (Thẻ kho)...');
      const movementsToInsert: any[] = [];

      for (let idx = 0; idx < insertedItems.length; idx++) {
        const item = insertedItems[idx];
        const originalItem = itemsToInsert[idx];
        const originalStatus = originalItem.originalStatus;
        const tempSoldDate = originalItem.tempSoldDate;

        // Stock movement (every item in stock, sold, reserved, defective, etc. was received and stocked)
        if (item.status !== 'incoming') {
          // 1. Stocked movement
          movementsToInsert.push({
            inventoryItemId: item.id,
            movementType: 'stocked',
            fromStatus: null,
            toStatus: 'in_stock',
            referenceType: 'manual',
            referenceId: null,
            quantityChange: 1,
            locationFrom: null,
            locationTo: item.location,
            notes: 'Nhập kho lô hàng đầu kỳ (Tự động seed)',
            performedBy: profileId,
            performedAt: item.stockedDate ? new Date(item.stockedDate) : new Date(),
          });

          // 2. Additional movements if sold, reserved, warranty, etc.
          if (originalStatus === 'sold') {
            movementsToInsert.push({
              inventoryItemId: item.id,
              movementType: 'sold',
              fromStatus: 'in_stock',
              toStatus: 'sold',
              referenceType: 'order',
              referenceId: null,
              quantityChange: -1,
              locationFrom: item.location,
              locationTo: null,
              notes: 'Xuất kho bán hàng cho khách lẻ',
              performedBy: profileId,
              performedAt: tempSoldDate ? new Date(tempSoldDate) : new Date(),
            });
          } else if (item.status === 'defective') {
            movementsToInsert.push({
              inventoryItemId: item.id,
              movementType: 'defective',
              fromStatus: 'in_stock',
              toStatus: 'defective',
              referenceType: 'stocktake',
              referenceId: null,
              quantityChange: -1,
              locationFrom: item.location,
              locationTo: 'Khu hàng hỏng',
              notes: 'Phát hiện lỗi phần cứng khi kiểm kho',
              performedBy: profileId,
              performedAt: new Date(new Date(item.stockedDate!).getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days after
            });
          } else if (originalStatus === 'warranty_repair') {
            // First sold, then brought in for warranty
            movementsToInsert.push({
              inventoryItemId: item.id,
              movementType: 'sold',
              fromStatus: 'in_stock',
              toStatus: 'sold',
              referenceType: 'order',
              referenceId: null,
              quantityChange: -1,
              locationFrom: item.location,
              locationTo: null,
              notes: 'Xuất bán hàng',
              performedBy: profileId,
              performedAt: tempSoldDate ? new Date(tempSoldDate) : new Date(),
            });

            movementsToInsert.push({
              inventoryItemId: item.id,
              movementType: 'warranty_in',
              fromStatus: 'sold',
              toStatus: 'warranty_repair',
              referenceType: 'warranty_claim',
              referenceId: null,
              quantityChange: 0,
              locationFrom: null,
              locationTo: 'Khu hàng bảo hành',
              notes: 'Khách gửi bảo hành - Lỗi phần cứng phát sinh',
              performedBy: profileId,
              performedAt: new Date(new Date(tempSoldDate!).getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days after sold
            });
          } else if (originalStatus === 'returned_in_stock') {
            // First sold, then returned
            movementsToInsert.push({
              inventoryItemId: item.id,
              movementType: 'sold',
              fromStatus: 'in_stock',
              toStatus: 'sold',
              referenceType: 'order',
              referenceId: null,
              quantityChange: -1,
              locationFrom: item.location,
              locationTo: null,
              notes: 'Xuất bán hàng',
              performedBy: profileId,
              performedAt: tempSoldDate ? new Date(tempSoldDate) : new Date(),
            });

            movementsToInsert.push({
              inventoryItemId: item.id,
              movementType: 'returned',
              fromStatus: 'sold',
              toStatus: 'in_stock',
              referenceType: 'manual',
              referenceId: null,
              quantityChange: 1,
              locationFrom: null,
              locationTo: item.location,
              notes: 'Nhập lại kho - Khách trả máy đổi model',
              performedBy: profileId,
              performedAt: new Date(new Date(tempSoldDate!).getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days after sold
            });
          }
        } else {
          // Incoming movement
          movementsToInsert.push({
            inventoryItemId: item.id,
            movementType: 'received',
            fromStatus: null,
            toStatus: 'incoming',
            referenceType: 'purchase_order',
            referenceId: null,
            quantityChange: 1,
            locationFrom: null,
            locationTo: null,
            notes: 'Tạo đơn đặt hàng nhà cung cấp - Chờ hàng về',
            performedBy: profileId,
            performedAt: new Date(),
          });
        }
      }

      console.log(`🔌 Inserting ${movementsToInsert.length} movement records into the database...`);
      for (let i = 0; i < movementsToInsert.length; i += chunkSize) {
        const chunk = movementsToInsert.slice(i, i + chunkSize);
        await db.insert(schema.inventoryMovements).values(chunk);
      }
      console.log('✅ Stock movements history successfully seeded!');
    }

    console.log('🎉 100 inventory items and movement histories seeded successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    process.exit(0);
  }
}

main();
