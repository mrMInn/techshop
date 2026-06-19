import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/lib/db");
  const { 
    categories, 
    brands, 
    products, 
    inventoryItems, 
    inventoryMovements, 
    profiles,
    purchaseOrders,
    purchaseOrderItems,
    suppliers
  } = await import("../src/lib/db/schema");
  const { syncHistoricalData } = await import("../src/app/actions/accounting");

  console.log("🚀 Bắt đầu tạo dữ liệu mẫu kèm hóa đơn nhập hàng & sổ quỹ...");

  // 1. Lấy admin profile đầu tiên
  const adminProfiles = await db.select().from(profiles).limit(1);
  const adminId = adminProfiles[0]?.id;
  if (!adminId) {
    console.error("❌ Không tìm thấy profile nào trong bảng profiles. Vui lòng tạo tài khoản trước.");
    process.exit(1);
  }
  console.log(`👤 Người thực hiện: ${adminProfiles[0].fullName} (${adminId})`);

  // 2. Tạo Danh mục (Categories)
  console.log("📦 Đang tạo danh mục...");
  const categoryData = [
    { name: "Laptop", slug: "laptop", description: "Máy tính xách tay" },
    { name: "Điện thoại", slug: "dien-thoai", description: "Điện thoại di động thông minh" },
    { name: "Máy tính bảng", slug: "may-tinh-bang", description: "Bảng vẽ, iPad và máy tính bảng Android" },
    { name: "Đồng hồ thông minh", slug: "dong-ho-thong-minh", description: "Smartwatch và vòng đeo tay sức khỏe" },
    { name: "Phụ kiện", slug: "phu-kien", description: "Tai nghe, chuột, bàn phím, loa..." },
  ];

  const insertedCats: Record<string, any> = {};
  for (const cat of categoryData) {
    const [inserted] = await db.insert(categories).values(cat).returning();
    insertedCats[cat.slug] = inserted;
  }

  // 3. Tạo Thương hiệu (Brands)
  console.log("🏷️ Đang tạo thương hiệu...");
  const brandData = [
    { name: "Apple", logoUrl: null },
    { name: "Samsung", logoUrl: null },
    { name: "Asus", logoUrl: null },
    { name: "Sony", logoUrl: null },
    { name: "Logitech", logoUrl: null },
  ];

  const insertedBrands: Record<string, any> = {};
  for (const brand of brandData) {
    const [inserted] = await db.insert(brands).values(brand).returning();
    insertedBrands[brand.name] = inserted;
  }

  // 4. Định nghĩa 10 sản phẩm khác nhau
  console.log("💻 Đang tạo 10 model sản phẩm...");
  const productsData = [
    {
      name: "iPhone 15 Pro Max 256GB",
      slug: "iphone-15-pro-max-256gb",
      sku: "IP15PM-256",
      categorySlug: "dien-thoai",
      brandName: "Apple",
      specs: { cpu: "Apple A17 Pro", ram: "8GB", ssd: "256GB", screen: "6.7 inch Super Retina XDR", color: "Titan Tự Nhiên" },
      warrantyMonths: 12,
    },
    {
      name: "MacBook Pro 14 M3 Pro",
      slug: "macbook-pro-14-m3-pro",
      sku: "MBP14-M3PRO",
      categorySlug: "laptop",
      brandName: "Apple",
      specs: { cpu: "Apple M3 Pro (11-core)", ram: "18GB", ssd: "512GB", screen: "14.2 inch Liquid Retina XDR", color: "Space Black" },
      warrantyMonths: 12,
    },
    {
      name: "iPad Pro 11 inch M4 Wi-Fi",
      slug: "ipad-pro-11-m4-wifi",
      sku: "IPAD-M4-11",
      categorySlug: "may-tinh-bang",
      brandName: "Apple",
      specs: { cpu: "Apple M4", ram: "8GB", ssd: "256GB", screen: "11 inch Ultra Retina Tandem OLED", color: "Silver" },
      warrantyMonths: 12,
    },
    {
      name: "Apple Watch Ultra 2 GPS + Cellular",
      slug: "apple-watch-ultra-2",
      sku: "AWU2-49",
      categorySlug: "dong-ho-thong-minh",
      brandName: "Apple",
      specs: { cpu: "Apple S9 Sip", screen: "1.92 inch Always-On Retina LTPO OLED", size: "49mm", color: "Titanium" },
      warrantyMonths: 12,
    },
    {
      name: "Samsung Galaxy S24 Ultra 5G",
      slug: "samsung-galaxy-s24-ultra-5g",
      sku: "S24U-512",
      categorySlug: "dien-thoai",
      brandName: "Samsung",
      specs: { cpu: "Snapdragon 8 Gen 3 for Galaxy", ram: "12GB", ssd: "512GB", screen: "6.8 inch Dynamic AMOLED 2X", color: "Titanium Gray" },
      warrantyMonths: 12,
    },
    {
      name: "Samsung Galaxy Watch 6 Classic 47mm",
      slug: "galaxy-watch-6-classic-47mm",
      sku: "GW6C-47",
      categorySlug: "dong-ho-thong-minh",
      brandName: "Samsung",
      specs: { cpu: "Exynos W930", ram: "2GB", storage: "16GB", screen: "1.5 inch Super AMOLED", color: "Black" },
      warrantyMonths: 12,
    },
    {
      name: "Asus ROG Zephyrus G14 OLED (2024)",
      slug: "asus-rog-zephyrus-g14-2024",
      sku: "ROG-G14-2024",
      categorySlug: "laptop",
      brandName: "Asus",
      specs: { cpu: "AMD Ryzen 9 8945HS", ram: "32GB LPDDR5X", ssd: "1TB PCIe 4.0 NVMe", gpu: "RTX 4060 8GB", screen: "14 inch 3K OLED 120Hz", color: "Platinum White" },
      warrantyMonths: 24,
    },
    {
      name: "Sony WH-1000XM5 Noise Cancelling Headset",
      slug: "sony-wh-1000xm5",
      sku: "SONY-XM5",
      categorySlug: "phu-kien",
      brandName: "Sony",
      specs: { type: "Over-ear", connection: "Bluetooth 5.2 & 3.5mm", battery: "30 hours (ANC ON)", weight: "250g", color: "Silver" },
      warrantyMonths: 12,
    },
    {
      name: "Logitech MX Master 3S Wireless Mouse",
      slug: "logitech-mx-master-3s",
      sku: "LOGI-MX3S",
      categorySlug: "phu-kien",
      brandName: "Logitech",
      specs: { sensor: "Darkfield high precision", dpi: "8000", connection: "Logi Bolt & Bluetooth", buttons: "7", color: "Graphite" },
      warrantyMonths: 12,
    },
    {
      name: "Logitech G Pro X TKL Wireless Keyboard",
      slug: "logitech-g-pro-x-tkl",
      sku: "LOGI-GPX-TKL",
      categorySlug: "phu-kien",
      brandName: "Logitech",
      specs: { layout: "Tenkeyless (80%)", switches: "GX Brown Tactile", connection: "Lightspeed & Bluetooth", color: "Black" },
      warrantyMonths: 24,
    },
  ];

  const insertedProducts = [];
  for (const prod of productsData) {
    const categoryId = insertedCats[prod.categorySlug].id;
    const brandId = insertedBrands[prod.brandName].id;
    const [inserted] = await db.insert(products).values({
      name: prod.name,
      slug: prod.slug,
      sku: prod.sku,
      categoryId,
      brandId,
      specs: prod.specs,
      warrantyMonths: prod.warrantyMonths,
    }).returning();
    insertedProducts.push(inserted);
  }

  // Tạo nhà cung cấp mẫu
  const [defaultSupplier] = await db.insert(suppliers).values({
    name: "Tổng Kho Công Nghệ TechShop",
    country: "VN",
    isActive: true,
  }).returning();

  // 5. Tạo 100 inventory items thông qua đơn nhập hàng PO để hạch toán Sổ quỹ
  console.log("⚙️ Đang sinh 10 hóa đơn nhập hàng PO, 100 thiết bị và ghi nhận sổ quỹ...");

  for (const prod of insertedProducts) {
    // Giá nhập và bán giả định
    let costPrice = "10000000";
    let sellingPrice = "12000000";
    const sku = prod.sku || "";

    if (sku.includes("IP15PM")) {
      costPrice = "27000000";
      sellingPrice = "31500000";
    } else if (sku.includes("MBP14")) {
      costPrice = "42000000";
      sellingPrice = "48000000";
    } else if (sku.includes("IPAD-M4")) {
      costPrice = "22000000";
      sellingPrice = "25500000";
    } else if (sku.includes("AWU2")) {
      costPrice = "17000000";
      sellingPrice = "19900000";
    } else if (sku.includes("S24U")) {
      costPrice = "23000000";
      sellingPrice = "26900000";
    } else if (sku.includes("GW6C")) {
      costPrice = "6500000";
      sellingPrice = "7900000";
    } else if (sku.includes("ROG-G14")) {
      costPrice = "36000000";
      sellingPrice = "42000000";
    } else if (sku.includes("SONY-XM5")) {
      costPrice = "6000000";
      sellingPrice = "7200000";
    } else if (sku.includes("LOGI-MX3S")) {
      costPrice = "2000000";
      sellingPrice = "2490000";
    } else if (sku.includes("LOGI-GPX-TKL")) {
      costPrice = "3500000";
      sellingPrice = "4290000";
    }

    const count = 10;
    const totalCost = (Number(costPrice) * count).toFixed(2);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const poNumber = `PO-${dateStr}-${rand}`;

    // Tạo PO nhập hàng
    const [newPo] = await db.insert(purchaseOrders).values({
      poNumber,
      supplierId: defaultSupplier.id,
      status: "received",
      originCountry: "VN",
      totalCost,
      actualArrival: new Date().toISOString().split("T")[0],
      createdBy: adminId,
    }).returning();

    // Tạo PO Item chi tiết
    const [newPoItem] = await db.insert(purchaseOrderItems).values({
      purchaseOrderId: newPo.id,
      productId: prod.id,
      quantity: count,
      unitCost: costPrice,
      totalCost,
      receivedQuantity: count,
    }).returning();

    // Tạo 10 items lẻ
    const itemsToInsert = [];
    for (let i = 1; i <= 10; i++) {
      itemsToInsert.push({
        productId: prod.id,
        serialNumber: `SN-${sku}-${String(i).padStart(4, "0")}`,
        condition: (i % 2 === 0 ? "new" : "used") as "new" | "used",
        status: "in_stock" as const,
        costPrice,
        sellingPrice,
        originCountry: "VN",
        location: `Kho Ha Noi - Kệ ${String.fromCharCode(65 + (i % 4))}`,
        createdBy: adminId,
        purchaseOrderItemId: newPoItem.id,
        stockedDate: new Date().toISOString().split("T")[0],
      });
    }

    const insertedItems = await db.insert(inventoryItems).values(itemsToInsert).returning();

    // Tạo thẻ kho tương ứng
    const movementsToInsert = [];
    for (const item of insertedItems) {
      movementsToInsert.push({
        inventoryItemId: item.id,
        movementType: "stocked" as const,
        fromStatus: null,
        toStatus: "in_stock",
        referenceType: "purchase_order" as const,
        referenceId: newPoItem.id,
        quantityChange: 1,
        performedBy: adminId,
        notes: "Nhập kho sản phẩm mẫu đầy đủ thông số cấu trúc bảng từ PO",
      });
    }
    await db.insert(inventoryMovements).values(movementsToInsert);
  }

  // 6. Thực hiện đồng bộ ngược sổ quỹ từ các đơn PO đã nhập thành công
  console.log("💰 Đang hạch toán chi phí nhập hàng sang Sổ quỹ...");
  await syncHistoricalData();

  console.log(`✅ Hoàn thành! Đã đẩy thành công:`);
  console.log(`- 5 Danh mục & 5 Thương hiệu`);
  console.log(`- 10 Sản phẩm khác nhau`);
  console.log(`- 10 Hóa đơn nhập hàng PO tương ứng`);
  console.log(`- 100 items trong kho (kèm theo 100 thẻ kho tương ứng)`);
  console.log(`- Tự động tạo 10 Phiếu chi tiền nhập hàng vào Sổ quỹ.`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Lỗi khi seed dữ liệu:", err);
  process.exit(1);
});
