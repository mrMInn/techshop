// scripts/generate-bulk-test-data.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../src/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('❌ DATABASE_URL chưa được cấu hình trong .env.local');

const client = postgres(connectionString);
const db = drizzle(client, { schema });

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
const toStrDate = (d: Date) => d.toISOString().split('T')[0];

async function generateBulkSystemTestData() {
  console.log('🏁 =================================================================');
  console.log('🚀 KHỞI CHẠY ENGINE NẠP ĐƠN NHẬP HÀNG, 500 THIẾT BỊ VÀ LIÊN THÔNG MODULE');
  console.log('🏁 =================================================================\n');

  try {
    console.log('🧹 Đang dọn sạch toàn bộ các bảng cũ trên Database...');
    // Sử dụng TRUNCATE CASCADE để quét sạch nhanh chóng và bảo toàn profiles (tài khoản đăng nhập)
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
        public.income_categories,
        public.accounting_periods,
        public.customers,
        public.lead_sources,
        public.telegram_settings,
        public.countries,
        public.shipping_carriers
      RESTART IDENTITY CASCADE;
    `);
    console.log('   ✅ Đã wipe sạch dữ liệu cũ hoàn toàn an toàn (Giữ nguyên bảng profiles).');

    // ── BƯỚC 1: KHỞI TẠO MASTER DATA NỀN ──
    console.log('\n👉 BƯỚC 1: Tạo tài khoản quản trị viên, thương hiệu, danh mục và tệp khách hàng...');
    
    // Lấy hoặc tạo admin profile
    let [owner] = await db.select().from(schema.profiles).where(eq(schema.profiles.role, 'admin')).limit(1);
    if (!owner) {
      console.log('   ℹ️ Không tìm thấy admin profile, tiến hành tạo mới tài khoản admin test...');
      [owner] = await db.insert(schema.profiles).values({
        id: 'a5016fa3-4c7d-492e-b229-0756c42c9b4c',
        fullName: 'Quản trị viên TechStore',
        email: 'admin@techstore.vn',
        role: 'admin',
        isActive: true
      }).returning();
    }
    console.log(`   👤 Sử dụng Admin: ${owner.fullName} (${owner.id})`);

    const brandNames = ['Apple', 'Sony', 'Dell', 'Lenovo', 'Marshall', 'Samsung', 'LG', 'Keychron'];
    const brandRows = await Promise.all(brandNames.map(name => 
      db.insert(schema.brands).values({ name }).returning().then(r => r[0])
    ));
    console.log(`   🏷️  Đã nạp ${brandRows.length} thương hiệu.`);

    const catRows = await db.insert(schema.categories).values([
      { name: 'Laptop Xách Tay', slug: 'laptops-erp' },
      { name: 'Máy Ảnh Vintage', slug: 'cameras-erp' },
      { name: 'Phụ Kiện Cao Cấp', slug: 'accessories-erp' },
      { name: 'Điện Thoại Lướt', slug: 'phones-erp' },
      { name: 'Máy Tính Bảng', slug: 'tablets-erp' },
      { name: 'Màn Hình Đồ Họa', slug: 'monitors-erp' },
      { name: 'Âm Thanh Hi-End', slug: 'audio-erp' }
    ]).returning();
    console.log(`   📁 Đã nạp ${catRows.length} danh mục hàng hóa.`);

    const productRows = await db.insert(schema.products).values([
      // Laptops
      { name: 'MacBook Pro 14 M3 Pro 18G', slug: 'mbp-14-m3-pro', sku: 'MBP14M3PRO', categoryId: catRows[0].id, brandId: brandRows[0].id },
      { name: 'MacBook Air 13 M3 8G 256G', slug: 'mba-13-m3', sku: 'MBA13M3', categoryId: catRows[0].id, brandId: brandRows[0].id },
      { name: 'Dell XPS 13 Ultra 7 vPro', slug: 'dell-xps-13-9340', sku: 'DELLXPS13', categoryId: catRows[0].id, brandId: brandRows[2].id },
      { name: 'Lenovo ThinkPad X1 Carbon Gen 11', slug: 'lenovo-x1-carbon-11', sku: 'THINKPADX1', categoryId: catRows[0].id, brandId: brandRows[3].id },
      
      // Cameras
      { name: 'Sony Alpha A7 III Fullframe', slug: 'sony-a7-iii', sku: 'SONYA7M3', categoryId: catRows[1].id, brandId: brandRows[1].id },
      { name: 'Sony Alpha A6300 4K Compact', slug: 'sony-a6300-4k', sku: 'SONYA6300', categoryId: catRows[1].id, brandId: brandRows[1].id },
      
      // Accessories
      { name: 'Marshall Motif II A.N.C', slug: 'marshall-motif-ii', sku: 'MARSHALLM2', categoryId: catRows[2].id, brandId: brandRows[4].id },
      { name: 'Keychron K2 V2 Wireless', slug: 'keychron-k2-v2', sku: 'KEYCHRONK2', categoryId: catRows[2].id, brandId: brandRows[7].id },
      { name: 'Apple Magic Mouse 3', slug: 'magic-mouse-3', sku: 'MAGICMOUSE3', categoryId: catRows[2].id, brandId: brandRows[0].id },
      
      // Phones
      { name: 'iPhone 15 Pro Max 256GB', slug: 'iphone-15-pro-max', sku: 'IP15PM256', categoryId: catRows[3].id, brandId: brandRows[0].id },
      { name: 'iPhone 14 Pro 128GB', slug: 'iphone-14-pro', sku: 'IP14P128', categoryId: catRows[3].id, brandId: brandRows[0].id },
      { name: 'Samsung Galaxy S24 Ultra', slug: 'samsung-s24-ultra', sku: 'SAMS24U', categoryId: catRows[3].id, brandId: brandRows[5].id },
      
      // Tablets
      { name: 'iPad Pro 11 M4 Wifi 256GB', slug: 'ipad-pro-11-m4', sku: 'IPADPROM4', categoryId: catRows[4].id, brandId: brandRows[0].id },
      { name: 'iPad Air 5 M1 64GB', slug: 'ipad-air-5-m1', sku: 'IPADAIR5', categoryId: catRows[4].id, brandId: brandRows[0].id },
      { name: 'Samsung Galaxy Tab S9 FE', slug: 'samsung-tab-s9-fe', sku: 'SAMTABS9', categoryId: catRows[4].id, brandId: brandRows[5].id },
      
      // Monitors
      { name: 'LG UltraFine 27UP850 4K IPS', slug: 'lg-27up850-4k', sku: 'LG27UP850', categoryId: catRows[5].id, brandId: brandRows[6].id },
      { name: 'Dell UltraSharp U2723QE 4K IPS Black', slug: 'dell-u2723qe', sku: 'DELLU2723QE', categoryId: catRows[5].id, brandId: brandRows[2].id },
      { name: 'Samsung Odyssey G7 32 inch', slug: 'samsung-odyssey-g7', sku: 'SAMG732', categoryId: catRows[5].id, brandId: brandRows[5].id },
      
      // Audio
      { name: 'Marshall Woburn III Bluetooth', slug: 'marshall-woburn-iii', sku: 'MARSHALLW3', categoryId: catRows[6].id, brandId: brandRows[4].id },
      { name: 'Sony WH-1000XM5 ANC', slug: 'sony-wh-1000xm5', sku: 'SONYXM5', categoryId: catRows[6].id, brandId: brandRows[1].id },
      { name: 'AirPods Pro 2 USB-C', slug: 'airpods-pro-2-usbc', sku: 'AIRPODSPRO2', categoryId: catRows[6].id, brandId: brandRows[0].id }
    ]).returning();
    console.log(`   📦 Đã nạp ${productRows.length} mẫu sản phẩm gốc.`);

    // ── TẠO CÁC NHÀ CUNG CẤP (SUPPLIERS) ──
    const supplierNames = [
      'Tổng kho Apple Asia Distribution',
      'Sony Vietnam Authorized Distributor',
      'Dell Technologies Vietnam Import',
      'Lenovo Global Supply Chain',
      'Marshall Sound Sound System Factory'
    ];
    const supplierRows = await Promise.all(supplierNames.map(name => 
      db.insert(schema.suppliers).values({
        name,
        contactName: `Đại diện kinh doanh ${name.split(' ')[0]}`,
        phone: '0988666333',
        email: `partner@${name.toLowerCase().split(' ')[0]}.com.vn`,
        address: 'Khu công nghiệp cao, TP. HCM',
        country: 'VN',
        isActive: true
      }).returning().then(r => r[0])
    ));
    console.log(`   🤝 Đã nạp ${supplierRows.length} nhà cung cấp.`);

    const [leadSourceVoz] = await db.insert(schema.leadSources).values({ name: 'VOZ Forum', icon: '💬', color: '#0066cc' }).returning();
    const [leadSourceFb] = await db.insert(schema.leadSources).values({ name: 'Facebook', icon: '📱', color: '#1877f2' }).returning();
    const [leadSourceGoogle] = await db.insert(schema.leadSources).values({ name: 'Google Search', icon: '🔍', color: '#ea4335' }).returning();
    const [leadSourceYoutube] = await db.insert(schema.leadSources).values({ name: 'Youtube', icon: '🎥', color: '#ff0000' }).returning();
    const leadSourcesList = [leadSourceVoz, leadSourceFb, leadSourceGoogle, leadSourceYoutube];

    const customerRows = [];
    for (let i = 1; i <= 100; i++) {
      const ls = leadSourcesList[i % leadSourcesList.length];
      const [c] = await db.insert(schema.customers).values({
        fullName: `Khách Hàng VIP ${i}`,
        phone: `0912345${String(i).padStart(3, '0')}`,
        customerType: 'individual',
        leadSourceId: ls.id,
        totalSpent: '0',
        orderCount: 0
      }).returning();
      customerRows.push(c);
    }
    console.log(`   👥 Đã khởi tạo ${customerRows.length} khách hàng VIP mẫu.`);

    const years = [2025, 2026];
    for (const year of years) {
      for (let month = 1; month <= 12; month++) {
        const periodStr = `${year}-${String(month).padStart(2, '0')}`;
        await db.insert(schema.accountingPeriods).values({
          period: periodStr,
          startDate: `${periodStr}-01`,
          endDate: `${periodStr}-28`,
          isClosed: false
        });
      }
    }
    console.log('   📅 Đã mở kỳ kế toán cho năm 2025 và 2026.');

    const testTag = Math.floor(Math.random() * 100000);

    // ── KHỞI TẠO VỐN ĐIỀU LỆ BAN ĐẦU TRONG SỔ QUỸ (ĐỂ TRÁNH BỊ ÂM TIỀN KHI NHẬP HÀNG) ──
    await db.insert(schema.cashBookEntries).values({
      entryNumber: `PT-INVESTMENT-${testTag}`,
      type: 'income',
      category: 'other',
      amount: '10000000000', // 10 tỷ VNĐ vốn điều lệ
      runningBalance: '0',
      paymentMethod: 'bank_transfer',
      referenceType: 'other',
      description: 'Nạp vốn điều lệ thành lập doanh nghiệp TechStore',
      entryDate: '2025-01-01',
      createdBy: owner.id,
      createdAt: new Date('2025-01-01T08:00:00Z')
    });
    console.log('   💰 Đã nạp 10,000,000,000đ vốn điều lệ ban đầu vào Sổ Quỹ.');


    // ── BƯỚC 2: TẠO 30 ĐƠN NHẬP HÀNG (PURCHASE ORDERS) VÀ 500 THIẾT BỊ ──
    console.log('\n👉 BƯỚC 2: Tạo lập 30 đơn nhập hàng (Purchase Orders) chứa tổng cộng 500 thiết bị...');
    const inventoryPool = [];
    const dateStockStart = new Date('2025-01-02T00:00:00'); // Nhập hàng sau khi nạp vốn 1 ngày
    const dateStockEnd = new Date('2026-06-30T23:59:59');

    const numPOs = 30;
    let totalItemsAllocated = 0;
    const poQuantities = Array(numPOs).fill(0);
    
    // Đảm bảo mỗi PO có tối thiểu 10 máy để dữ liệu phân bổ đều
    for (let p = 0; p < numPOs; p++) {
      poQuantities[p] = 10;
      totalItemsAllocated += 10;
    }
    // Phân bổ ngẫu nhiên 200 máy còn lại để đạt tổng cộng 500 máy
    while (totalItemsAllocated < 500) {
      const p = Math.floor(Math.random() * numPOs);
      poQuantities[p] += 1;
      totalItemsAllocated += 1;
    }

    let globalItemCounter = 0;

    for (let p = 0; p < numPOs; p++) {
      const poQty = poQuantities[p];
      const supplier = supplierRows[p % supplierRows.length];
      const poDate = randomDate(dateStockStart, dateStockEnd);
      const poDateStr = toStrDate(poDate);
      const poNum = `PO-TEST-${p + 1}-${testTag}`;

      // Tạo đơn nhập trước
      const [po] = await db.insert(schema.purchaseOrders).values({
        poNumber: poNum,
        supplierId: supplier.id,
        status: 'received',
        originCountry: supplier.country || 'VN',
        shippingMethod: 'Đường bộ',
        expectedArrival: poDateStr,
        actualArrival: poDateStr,
        shippingCost: '150000',
        totalCost: '0', // tính toán sau
        createdBy: owner.id,
        createdAt: poDate
      }).returning();

      // Chia poQty máy trong PO này cho 2 đến 3 sản phẩm ngẫu nhiên
      const numProductsInPo = Math.min(2 + (p % 2), productRows.length);
      const selectedProducts = [...productRows]
        .sort(() => Math.random() - 0.5)
        .slice(0, numProductsInPo);

      let allocatedQty = 0;
      const productQuantities = Array(numProductsInPo).fill(0);
      for (let j = 0; j < numProductsInPo; j++) {
        productQuantities[j] = 1; 
        allocatedQty += 1;
      }
      while (allocatedQty < poQty) {
        const j = Math.floor(Math.random() * numProductsInPo);
        productQuantities[j] += 1;
        allocatedQty += 1;
      }

      let poTotalCost = 0;

      for (let j = 0; j < numProductsInPo; j++) {
        const prod = selectedProducts[j];
        const qty = productQuantities[j];

        let baseCost = 5000000;
        if (prod.sku?.startsWith('MBP') || prod.sku?.startsWith('DELLXPS') || prod.sku?.startsWith('THINKPAD')) {
          baseCost = 25000000 + (globalItemCounter % 5) * 3000000;
        } else if (prod.sku?.startsWith('SONY') || prod.sku?.startsWith('FUJI')) {
          baseCost = 15000000 + (globalItemCounter % 4) * 2500000;
        } else if (prod.sku?.startsWith('MARSHALL') || prod.sku?.startsWith('KEYCHRON')) {
          baseCost = 1500000 + (globalItemCounter % 3) * 800000;
        } else if (prod.sku?.startsWith('IP') || prod.sku?.startsWith('SAM')) {
          baseCost = 10000000 + (globalItemCounter % 5) * 2000000;
        } else if (prod.sku?.startsWith('LG') || prod.sku?.startsWith('DELLU')) {
          baseCost = 8000000 + (globalItemCounter % 3) * 1500000;
        }

        const cost = baseCost;
        const totalItemCost = cost * qty;
        poTotalCost += totalItemCost;

        // Tạo chi tiết đơn nhập hàng
        const [poItem] = await db.insert(schema.purchaseOrderItems).values({
          purchaseOrderId: po.id,
          productId: prod.id,
          quantity: qty,
          unitCost: cost.toString(),
          totalCost: totalItemCost.toString(),
          receivedQuantity: qty,
          notes: `Nhập tự động sản phẩm ${prod.name}`
        }).returning();

        // Tạo từng máy cụ thể và liên kết tới PO Item
        for (let k = 0; k < qty; k++) {
          globalItemCounter++;
          const profitMargin = 0.15 + (globalItemCounter % 6) * 0.05; // 15% - 40%
          const sell = Math.round((cost * (1 + profitMargin)) / 50000) * 50000;

          const [invItem] = await db.insert(schema.inventoryItems).values({
            serialNumber: `SN-TEST-${globalItemCounter}-${testTag}`,
            productId: prod.id,
            purchaseOrderItemId: poItem.id, // Liên kết
            condition: globalItemCounter % 7 === 0 ? 'used' : 'new',
            status: 'in_stock', 
            costPrice: cost.toString(),
            sellingPrice: sell.toString(),
            originCountry: globalItemCounter % 2 === 0 ? 'US' : 'VN',
            location: `Kệ A-${(globalItemCounter % 10) + 1}`,
            stockedDate: poDateStr,
            createdBy: owner.id
          }).returning();

          // Ghi nhận biến động thẻ kho
          await db.insert(schema.inventoryMovements).values({
            inventoryItemId: invItem.id,
            movementType: 'received',
            fromStatus: 'incoming',
            toStatus: 'in_stock',
            referenceType: 'purchase_order', // Liên kết
            referenceId: po.id,
            quantityChange: 1,
            notes: `Nhập kho tự động theo Đơn Nhập ${poNum}`,
            performedBy: owner.id,
            performedAt: poDate
          });

          inventoryPool.push(invItem);
        }
      }

      // Cập nhật lại tổng chi phí thực tế cho đơn nhập hàng
      await db.update(schema.purchaseOrders)
        .set({ totalCost: poTotalCost.toString() })
        .where(eq(schema.purchaseOrders.id, po.id));

      // Tạo phiếu chi cho đơn nhập hàng trong sổ quỹ
      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PC-PO-${p + 1}-${testTag}`,
        type: 'expense',
        category: 'purchase',
        amount: poTotalCost.toString(),
        runningBalance: '0',
        paymentMethod: 'bank_transfer',
        referenceType: 'purchase_order',
        referenceId: po.id,
        description: `Chi tiền thanh toán đơn nhập hàng ${poNum}`,
        entryDate: poDateStr,
        createdBy: owner.id,
        createdAt: poDate
      });
    }
    console.log(`   ✅ Hoàn tất tạo 30 đơn nhập hàng (Purchase Orders) và nạp kho ${inventoryPool.length} thiết bị.`);

    // ── BƯỚC 3: BÁN 300 THIẾT BỊ QUA CÁC ĐƠN HÀNG ──
    console.log('\n👉 BƯỚC 3: Bán 300 thiết bị, tạo lập các hóa đơn xuất kho bán lẻ (Orders)...');
    const soldItemsList = [];
    const dateSalesEnd = new Date('2026-07-25T23:59:59');

    // Shuffle inventory để chọn ngẫu nhiên 300 thiết bị để bán
    const itemsToSell = [...inventoryPool];
    itemsToSell.sort(() => Math.random() - 0.5);
    const selectedToSell = itemsToSell.slice(0, 300);

    let orderCount = 0;
    let soldItemIndex = 0;

    while (soldItemIndex < selectedToSell.length) {
      orderCount++;
      const customer = customerRows[Math.floor(Math.random() * customerRows.length)];
      
      // Số lượng sản phẩm trong đơn hàng này: 1-3 máy
      let itemsInOrderCount = 1;
      const randVal = Math.random();
      if (randVal < 0.6) {
        itemsInOrderCount = 1;
      } else if (randVal < 0.9) {
        itemsInOrderCount = 2;
      } else {
        itemsInOrderCount = 3;
      }
      
      itemsInOrderCount = Math.min(itemsInOrderCount, selectedToSell.length - soldItemIndex);
      
      const orderItemsToInsert = [];
      let maxStockedTime = 0;
      for (let j = 0; j < itemsInOrderCount; j++) {
        const item = selectedToSell[soldItemIndex + j];
        orderItemsToInsert.push(item);
        const stockedTime = new Date(item.stockedDate!).getTime();
        if (stockedTime > maxStockedTime) {
          maxStockedTime = stockedTime;
        }
      }
      
      // Ngày bán phải sau ngày nhập muộn nhất của các thiết bị trong đơn hàng
      let salesDate = new Date(maxStockedTime + 24*60*60*1000); 
      if (salesDate.getTime() > dateSalesEnd.getTime()) {
        salesDate = new Date(dateSalesEnd.getTime() - 2*24*60*60*1000);
      }
      const dateRange = dateSalesEnd.getTime() - salesDate.getTime();
      if (dateRange > 0) {
        salesDate = new Date(salesDate.getTime() + Math.random() * dateRange);
      }
      const salesDateStr = toStrDate(salesDate);

      let subtotal = 0;
      let totalCost = 0;
      for (const item of orderItemsToInsert) {
        (item as any).soldDate = salesDateStr;
        soldItemsList.push(item);
        subtotal += Number(item.sellingPrice || 0);
        totalCost += Number(item.costPrice || 0);
      }
      
      const profit = subtotal - totalCost;
      const margin = subtotal > 0 ? (profit / subtotal) * 100 : 0;
      const orderNum = `ORD-TEST-${orderCount}-${testTag}`;

      const [order] = await db.insert(schema.orders).values({
        orderNumber: orderNum,
        customerId: customer.id,
        leadSourceId: customer.leadSourceId,
        status: 'completed',
        saleChannel: Math.random() > 0.3 ? 'offline' : 'online',
        subtotal: subtotal.toString(),
        totalAmount: subtotal.toString(),
        totalCost: totalCost.toString(),
        profit: profit.toString(),
        profitMargin: margin.toFixed(2),
        paymentStatus: 'paid',
        paymentMethod: Math.random() > 0.5 ? 'bank_transfer' : 'cash',
        soldBy: owner.id,
        createdAt: salesDate
      }).returning();

      for (const item of orderItemsToInsert) {
        const itemSellingPrice = Number(item.sellingPrice || 0);
        const itemCostPrice = Number(item.costPrice || 0);
        const itemProfit = itemSellingPrice - itemCostPrice;
        
        const [oItem] = await db.insert(schema.orderItems).values({
          orderId: order.id,
          inventoryItemId: item.id,
          productId: item.productId,
          sellingPrice: item.sellingPrice || '0',
          costPrice: item.costPrice,
          warrantyMonths: 12,
          profit: itemProfit.toString(),
          isGift: false
        }).returning();
        
        // Lưu ngược orderItemId và orderId vào RAM để dùng cho module Bảo hành, Đổi trả
        (item as any).orderItemId = oItem.id;
        (item as any).orderId = order.id;

        const wEnd = new Date(salesDate.getTime() + 365*24*60*60*1000);
        await db.update(schema.inventoryItems).set({
          status: 'sold',
          soldDate: salesDateStr,
          warrantyStart: salesDateStr,
          warrantyEnd: toStrDate(wEnd)
        }).where(eq(schema.inventoryItems.id, item.id));

        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: item.id,
          movementType: 'sold',
          fromStatus: 'in_stock',
          toStatus: 'sold',
          referenceType: 'order',
          referenceId: order.id,
          quantityChange: -1,
          performedBy: owner.id,
          performedAt: salesDate
        });
      }

      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PT-ORD-${orderCount}-${testTag}`,
        type: 'income',
        category: 'sales',
        amount: subtotal.toString(),
        runningBalance: '0',
        paymentMethod: order.paymentMethod === 'cash' ? 'cash' : 'bank_transfer',
        referenceType: 'order',
        referenceId: order.id,
        description: `Thu tiền bán hàng đơn mã ${orderNum}`,
        entryDate: salesDateStr,
        createdBy: owner.id,
        createdAt: salesDate
      });

      soldItemIndex += itemsInOrderCount;
    }
    console.log(`   ✅ Đã bán thành công 300 sản phẩm qua ${orderCount} đơn hàng.`);

    // ── BƯỚC 4: TẠO OPEX EXPENSES ──
    console.log('\n👉 BƯỚC 4: Khởi tạo 60 chứng từ chi phí opex cửa hàng (Expenses)...');
    const dateOpexStart = new Date('2025-01-01T00:00:00');
    const dateOpexEnd = new Date('2026-07-25T23:59:59');
    
    let [expCat] = await db.select().from(schema.expenseCategories).limit(1);
    if (!expCat) {
      [expCat] = await db.insert(schema.expenseCategories).values({ name: 'Chi phí cố định mặt bằng & ads', type: 'fixed' }).returning();
    }

    for (let i = 1; i <= 60; i++) {
      const expDate = randomDate(dateOpexStart, dateOpexEnd);
      const expDateStr = toStrDate(expDate);
      const amount = 500000 + (i % 10) * 500000; 

      const [exp] = await db.insert(schema.expenses).values({
        expenseNumber: `EXP-OPEX-${i}-${testTag}`,
        categoryId: expCat.id,
        amount: amount.toString(),
        description: `Chi trả tiền phí hạ tầng, mặt bằng đợt ${i}`,
        expenseDate: expDateStr,
        paymentMethod: i % 2 === 0 ? 'cash' : 'bank_transfer',
        createdBy: owner.id,
        createdAt: expDate
      }).returning();

      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PC-EXP-${i}-${testTag}`,
        type: 'expense',
        category: 'other',
        amount: amount.toString(),
        runningBalance: '0',
        paymentMethod: exp.paymentMethod === 'cash' ? 'cash' : 'bank_transfer',
        referenceType: 'expense',
        referenceId: exp.id,
        description: `Chi xuất quỹ tiền đối ứng chứng từ ${exp.expenseNumber}`,
        entryDate: expDateStr,
        createdBy: owner.id,
        createdAt: expDate
      });
    }
    console.log(`   ✅ Đã sinh thành công 60 chứng từ chi phí.`);

    // ── BƯỚC 5: TẠO PHIẾU BẢO HÀNH (80 CLAIMS) ──
    console.log('\n👉 BƯỚC 5: Khởi tạo 80 phiếu bảo hành từ các sản phẩm đã bán...');
    const warrantyItemsPool = soldItemsList.slice(0, 80); 
    const dateWarrantyEndLimit = new Date('2026-07-26T23:59:59');

    const statusCycle: ('pending' | 'inspecting' | 'repairing' | 'waiting_parts' | 'completed')[] = [
      'pending', 'inspecting', 'repairing', 'waiting_parts', 'completed'
    ];

    for (let i = 0; i < warrantyItemsPool.length; i++) {
      const targetItem = warrantyItemsPool[i];
      const orderId = (targetItem as any).orderId;
      const orderItemId = (targetItem as any).orderItemId;
      
      const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);

      const soldTime = new Date(order.createdAt).getTime();
      let wClaimDate = new Date(soldTime + 5*24*60*60*1000); // 5 ngày sau bán
      if (wClaimDate.getTime() > dateWarrantyEndLimit.getTime()) {
        wClaimDate = new Date(dateWarrantyEndLimit.getTime() - 2*24*60*60*1000);
      }
      const dateRange = dateWarrantyEndLimit.getTime() - wClaimDate.getTime();
      if (dateRange > 0) {
        wClaimDate = new Date(wClaimDate.getTime() + Math.random() * dateRange);
      }
      const wClaimDateStr = toStrDate(wClaimDate);

      const currentStatus = statusCycle[i % statusCycle.length];

      const [claim] = await db.insert(schema.warrantyClaims).values({
        claimNumber: `WAR-TEST-${i}-${testTag}`,
        orderId: order.id,
        orderItemId: orderItemId, 
        inventoryItemId: targetItem.id,
        customerId: order.customerId,
        status: currentStatus,
        issueDescription: `Lỗi linh kiện thiết bị test phát sinh tại bước ${i}`,
        isUnderWarranty: true,
        warrantyEndDate: order.createdAt.toISOString().split('T')[0], // placeholder
        receivedDate: wClaimDateStr,
        createdBy: owner.id,
        createdAt: wClaimDate
      }).returning();

      await db.insert(schema.warrantyLogs).values({
        warrantyClaimId: claim.id,
        action: 'status_changed',
        description: `Kỹ thuật viên cập nhật trạng thái sửa chữa thành: ${currentStatus}`,
        newStatus: currentStatus,
        createdBy: owner.id,
        createdAt: wClaimDate
      });

      if (currentStatus !== 'completed') {
        await db.update(schema.inventoryItems).set({ status: 'warranty_repair' }).where(eq(schema.inventoryItems.id, targetItem.id));
        
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: targetItem.id,
          movementType: 'warranty_in',
          fromStatus: 'sold',
          toStatus: 'warranty_repair',
          referenceType: 'warranty_claim',
          referenceId: claim.id,
          quantityChange: 0,
          performedBy: owner.id,
          performedAt: wClaimDate
        });
      } else {
        await db.insert(schema.inventoryMovements).values({
          inventoryItemId: targetItem.id,
          movementType: 'warranty_out',
          fromStatus: 'warranty_repair',
          toStatus: 'sold',
          referenceType: 'warranty_claim',
          referenceId: claim.id,
          quantityChange: 0,
          performedBy: owner.id,
          performedAt: wClaimDate
        });
      }
    }
    console.log(`   ✅ Đã tạo thành công 80 phiếu bảo hành tịnh tiến.`);

    // ── BƯỚC 6: TẠO PHIẾU ĐỔI TRẢ HOÀN TIỀN (50 RETURNS) ──
    console.log('\n👉 BƯỚC 6: Tạo lập 50 phiếu đổi trả hoàn tiền từ các sản phẩm đã bán khác...');
    const returnItemsPool = soldItemsList.slice(100, 150);

    for (let i = 0; i < returnItemsPool.length; i++) {
      const targetItem = returnItemsPool[i];
      const orderId = (targetItem as any).orderId;
      const orderItemId = (targetItem as any).orderItemId;
      
      const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);

      const soldTime = new Date(order.createdAt).getTime();
      let rDate = new Date(soldTime + 2*24*60*60*1000); // 2 ngày sau bán
      if (rDate.getTime() > dateWarrantyEndLimit.getTime()) {
        rDate = new Date(dateWarrantyEndLimit.getTime() - 2*24*60*60*1000);
      }
      const dateRange = dateWarrantyEndLimit.getTime() - rDate.getTime();
      if (dateRange > 0) {
        rDate = new Date(rDate.getTime() + Math.random() * dateRange);
      }
      const rDateStr = toStrDate(rDate);
      const refundValue = Number(targetItem.sellingPrice);

      const [ret] = await db.insert(schema.returns).values({
        returnNumber: `RET-TEST-${i}-${testTag}`,
        orderId: order.id,
        customerId: order.customerId,
        type: 'return',
        reason: 'defective',
        reasonDetail: `Phần cứng phát sinh lỗi sau khi mua. Tiến hành hoàn tiền mặt cho khách.`,
        status: 'completed',
        hasFee: false,
        feeAmount: '0',
        refundAmount: refundValue.toString(),
        processedBy: owner.id,
        createdAt: rDate
      }).returning();

      await db.insert(schema.returnItems).values({
        returnId: ret.id,
        inventoryItemId: targetItem.id,
        productId: targetItem.productId,
        returnReason: 'defective',
        conditionOnReturn: 'defective',
        isDefective: true, 
        originalPrice: targetItem.sellingPrice!,
        refundPrice: refundValue.toString()
      });

      await db.update(schema.inventoryItems).set({ status: 'defective', soldDate: null }).where(eq(schema.inventoryItems.id, targetItem.id));

      await db.insert(schema.inventoryMovements).values({
        inventoryItemId: targetItem.id,
        movementType: 'returned',
        fromStatus: 'sold',
        toStatus: 'defective',
        referenceType: 'order',
        referenceId: order.id,
        quantityChange: 1, // tăng 1 trong kho dưới dạng defective
        performedBy: owner.id,
        performedAt: rDate
      });

      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PC-REFUND-RET-${i}-${testTag}`,
        type: 'expense',
        category: 'other',
        amount: refundValue.toString(),
        runningBalance: '0',
        paymentMethod: 'bank_transfer',
        referenceType: 'other',
        referenceId: ret.id,
        description: `Chi tiền hoàn trả khách hàng đơn hàng trả mã ${ret.returnNumber}`,
        entryDate: rDateStr,
        createdBy: owner.id,
        createdAt: rDate
      });
    }
    console.log(`   ✅ Đã tạo thành công 50 phiếu đổi trả hoàn tiền.`);

    // ── BƯỚC 7: ĐỒNG BỘ DOANH SỐ CRM & SỐ DƯ QUỸ ──
    console.log('\n📊 BƯỚC 7: Đồng bộ tích lũy doanh số từng khách hàng (orderCount, totalSpent) lên CRM...');
    const allCompletedOrders = await db.select().from(schema.orders).where(eq(schema.orders.status, 'completed'));
    const customerStatsMap = new Map<string, { count: number; spent: number }>();
    
    for (const o of allCompletedOrders) {
      const cId = o.customerId;
      const amount = Number(o.totalAmount || 0);
      const current = customerStatsMap.get(cId) || { count: 0, spent: 0 };
      customerStatsMap.set(cId, { count: current.count + 1, spent: current.spent + amount });
    }
    
    for (const [cId, stats] of customerStatsMap.entries()) {
      await db.update(schema.customers)
        .set({
          orderCount: stats.count,
          totalSpent: stats.spent.toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(schema.customers.id, cId));
    }
    console.log('   ✅ Đã hoàn tất đồng bộ CRM khách hàng.');

    console.log('\n🔄 BƯỚC 8: Khởi chạy Engine tính lũy kế runningBalance Sổ Quỹ...');
    const allEntries = await db.select().from(schema.cashBookEntries);
    
    allEntries.sort((a, b) => {
      const timeA = new Date(a.entryDate).getTime();
      const timeB = new Date(b.entryDate).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let currentBalance = 0;
    for (const entry of allEntries) {
      const amountVal = Number(entry.amount || 0);
      if (entry.type === 'income') {
        currentBalance += amountVal;
      } else {
        currentBalance -= amountVal;
      }

      await db.update(schema.cashBookEntries)
        .set({ runningBalance: currentBalance.toString() })
        .where(eq(schema.cashBookEntries.id, entry.id));
    }
    console.log(`   ✅ Điểm cân bằng cuối quỹ chốt ở: ${currentBalance.toLocaleString()}đ`);

    console.log('\n🏆 =================================================================');
    console.log('🎉 MA TRẬN DỮ LIỆU ĐƠN NHẬP HÀNG & 500 SẢN PHẨM ĐÃ ĐƯỢC THIẾT LẬP THÀNH CÔNG!');
    console.log('====================================================================');

  } catch (error) {
    console.error('\n❌ TIẾN TRÌNH THẤT BẠI. DỮ LIỆU BÌ NGHỄN BỞI LỖI RÀNG BUỘC HỆ THỐNG:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

generateBulkSystemTestData();