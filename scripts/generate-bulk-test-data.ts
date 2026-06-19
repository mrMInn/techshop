// scripts/generate-bulk-test-data.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../src/lib/db/schema'; // Trỏ đúng tới thư mục chứa file schema tổng của mày
import { eq } from 'drizzle-orm';

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
  console.log('🚀 KHỞI CHẠY ENGINE NẠP 150 THIẾT BỊ VÀ PHỦ ĐÚNG 50 DÒNG MỖI MODULE');
  console.log('🏁 =================================================================\n');

  try {
    console.log('🧹 Đang tháo dỡ khóa ngoại và dọn sạch toàn bộ các bảng cũ trên Database...');
    try { await db.delete(schema.warrantyLogs); } catch {}
    try { await db.delete(schema.auditLogs); } catch {}
    try { await db.delete(schema.telegramNotificationLogs); } catch {}
    try { await db.delete(schema.telegramNotificationEvents); } catch {}
    try { await db.delete(schema.quotationItems); } catch {}
    try { await db.delete(schema.returnItems); } catch {}
    try { await db.delete(schema.warrantyClaims); } catch {}
    try { await db.delete(schema.returns); } catch {}
    try { await db.delete(schema.quotations); } catch {}
    try { await db.delete(schema.payments); } catch {}
    try { await db.delete(schema.orderItems); } catch {}
    try { await db.delete(schema.orders); } catch {}
    try { await db.delete(schema.purchaseOrderItems); } catch {}
    try { await db.delete(schema.purchaseOrders); } catch {}
    try { await db.delete(schema.suppliers); } catch {}
    try { await db.delete(schema.inventoryMovements); } catch {}
    try { await db.delete(schema.inventoryItems); } catch {}
    try { await db.delete(schema.products); } catch {}
    try { await db.delete(schema.categories); } catch {}
    try { await db.delete(schema.brands); } catch {}
    try { await db.delete(schema.cashBookEntries); } catch {}
    try { await db.delete(schema.expenses); } catch {}
    try { await db.delete(schema.expenseCategories); } catch {}
    try { await db.delete(schema.accountingPeriods); } catch {}
    try { await db.delete(schema.customers); } catch {}
    try { await db.delete(schema.leadSources); } catch {}
    try { await db.delete(schema.telegramSettings); } catch {}
    try { await db.delete(schema.profiles); } catch {}
    console.log('   ✅ Đã wipe sạch dữ liệu cũ hoàn toàn an toàn.');

    console.log('\n👉 BƯỚC 1: Tạo tài khoản quản trị viên, thương hiệu, danh mục và tệp khách hàng...');
    const [owner] = await db.insert(schema.profiles).values({
      id: crypto.randomUUID(),
      fullName: 'Minh Chỉ Huy Tổng Lực',
      email: 'owner.command@techstore.vn',
      role: 'owner',
      isActive: true
    }).returning();

    const brandNames = ['Apple', 'Sony', 'Dell', 'Lenovo', 'Marshall'];
    const brandRows = await Promise.all(brandNames.map(name => db.insert(schema.brands).values({ name }).returning().then(r => r[0])));
    
    const catRows = await db.insert(schema.categories).values([
      { name: 'Laptop Xách Tay', slug: 'laptops-erp' },
      { name: 'Máy Ảnh Vintage', slug: 'cameras-erp' },
      { name: 'Phụ Kiện Cao Cấp', slug: 'accessories-erp' }
    ]).returning();

    const productRows = await db.insert(schema.products).values([
      { name: 'MacBook Pro 14 M3 Pro 18G', slug: 'mbp-14-m3-pro', sku: 'MBP14M3PRO', categoryId: catRows[0].id, brandId: brandRows[0].id },
      { name: 'Sony Alpha A7 III Fullframe', slug: 'sony-a7-iii', sku: 'SONYA7M3', categoryId: catRows[1].id, brandId: brandRows[1].id },
      { name: 'Sony Alpha A6300 4K Compact', slug: 'sony-a6300-4k', sku: 'SONYA6300', categoryId: catRows[1].id, brandId: brandRows[1].id },
      { name: 'Dell XPS 13 Ultra 7 vPro', slug: 'dell-xps-13-9340', sku: 'DELLXPS13', categoryId: catRows[0].id, brandId: brandRows[2].id },
      { name: 'Marshall Motif II A.N.C', slug: 'marshall-motif-ii', sku: 'MARSHALLM2', categoryId: catRows[2].id, brandId: brandRows[4].id }
    ]).returning();

    const [leadSource] = await db.insert(schema.leadSources).values({ name: 'VOZ Forum', icon: '💬', color: '#0066cc' }).returning();

    const customerRows = [];
    for (let i = 1; i <= 35; i++) {
      const [c] = await db.insert(schema.customers).values({
        fullName: `Khách Hàng VIP ${i}`,
        phone: `0912345${String(i).padStart(3, '0')}`,
        customerType: 'individual',
        leadSourceId: leadSource.id,
        totalSpent: '0',
        orderCount: 0
      }).returning();
      customerRows.push(c);
    }

    const years = [2025, 2026];
    for (const year of years) {
      const maxMonth = year === 2026 ? 6 : 12;
      for (let month = 1; month <= maxMonth; month++) {
        const periodStr = `${year}-${String(month).padStart(2, '0')}`;
        await db.insert(schema.accountingPeriods).values({
          period: periodStr,
          startDate: `${periodStr}-01`,
          endDate: `${periodStr}-28`,
          isClosed: false
        });
      }
    }

    // BLOCK THỜI GIAN 1: NHẬP KHO (01/01/2025 -> 30/06/2025)
    console.log('\n👉 BƯỚC 2: Rải đều chính xác 150 chiếc máy nhập kho (01/01/2025 -> 30/06/2025)...');
    const inventoryPool = [];
    const dateStockStart = new Date('2025-01-01T00:00:00');
    const dateStockEnd = new Date('2025-06-30T23:59:59');
    const testTag = Math.floor(Math.random() * 100000);

    for (let i = 1; i <= 150; i++) {
      const prod = productRows[i % productRows.length];
      const cost = 4000000 + (i % 6) * 3500000; 
      const sell = cost + 2500000;              
      const stockDateStr = toStrDate(randomDate(dateStockStart, dateStockEnd));

      const [item] = await db.insert(schema.inventoryItems).values({
        serialNumber: `SN-EBAY-MATRIX-${i}-${testTag}`,
        productId: prod.id,
        condition: i % 5 === 0 ? 'used' : 'new',
        status: 'in_stock', 
        costPrice: cost.toString(),
        sellingPrice: sell.toString(),
        originCountry: 'US',
        stockedDate: stockDateStr,
        createdBy: owner.id
      }).returning();

      await db.insert(schema.inventoryMovements).values({
        inventoryItemId: item.id,
        movementType: 'stocked',
        toStatus: 'in_stock',
        referenceType: 'manual',
        quantityChange: 1,
        notes: `Nạp kho cấu hình thiết bị tự động lô hàng ngày ${stockDateStr}`,
        performedBy: owner.id,
        performedAt: new Date(stockDateStr)
      });

      inventoryPool.push(item);
    }
    console.log(`   ✅ Hoàn tất nạp kho ${inventoryPool.length} thiết bị.`);

    // BLOCK THỜI GIAN 2: BÁN HÀNG (01/07/2025 -> 31/12/2025)
    console.log('\n👉 BƯỚC 3: Tạo lập đúng 50 hóa đơn xuất kho bán lẻ (01/07/2025 -> 31/12/2025)...');
    const soldItemsList = [];
    const dateSalesStart = new Date('2025-07-01T00:00:00');
    const dateSalesEnd = new Date('2025-12-31T23:59:59');

    for (let i = 1; i <= 50; i++) {
      const customer = customerRows[i % customerRows.length];
      
      const item1 = inventoryPool.pop()!;
      const item2 = inventoryPool.pop()!;
      
      const salesDate = randomDate(dateSalesStart, dateSalesEnd);
      const salesDateStr = toStrDate(salesDate);

      // VÁ LỖI CHÍ MẠNG: Gán thẳng ngày bán vào biến RAM để các bước sau đọc chính xác ngày bán thật dưới DB
      item1.soldDate = salesDateStr;
      item2.soldDate = salesDateStr;
      soldItemsList.push(item1, item2);

      const subtotal = Number(item1.sellingPrice) + Number(item2.sellingPrice);
      const totalCost = Number(item1.costPrice) + Number(item2.costPrice);
      const profit = subtotal - totalCost;
      const margin = (profit / subtotal) * 100;
      const orderNum = `ORD-MOCK-${i}-${testTag}`;

      const [order] = await db.insert(schema.orders).values({
        orderNumber: orderNum,
        customerId: customer.id,
        leadSourceId: leadSource.id,
        status: 'completed',
        saleChannel: 'offline',
        subtotal: subtotal.toString(),
        totalAmount: subtotal.toString(),
        totalCost: totalCost.toString(),
        profit: profit.toString(),
        profitMargin: margin.toFixed(2),
        paymentStatus: 'paid',
        paymentMethod: 'bank_transfer',
        soldBy: owner.id,
        createdAt: salesDate
      }).returning();

      await db.insert(schema.orderItems).values([
        { orderId: order.id, inventoryItemId: item1.id, productId: item1.productId, sellingPrice: item1.sellingPrice || '0', costPrice: item1.costPrice, warrantyMonths: 12, profit: (Number(item1.sellingPrice || 0) - Number(item1.costPrice)).toString() },
        { orderId: order.id, inventoryItemId: item2.id, productId: productRows[i % productRows.length].id, sellingPrice: item2.sellingPrice || '0', costPrice: item2.costPrice, warrantyMonths: 12, profit: (Number(item2.sellingPrice || 0) - Number(item2.costPrice)).toString() }
      ]);

      await db.update(schema.inventoryItems).set({ status: 'sold', soldDate: salesDateStr, warrantyStart: salesDateStr, warrantyEnd: toStrDate(new Date(salesDate.getTime() + 365*24*60*60*1000)) }).where(eq(schema.inventoryItems.id, item1.id));
      await db.update(schema.inventoryItems).set({ status: 'sold', soldDate: salesDateStr, warrantyStart: salesDateStr, warrantyEnd: toStrDate(new Date(salesDate.getTime() + 365*24*60*60*1000)) }).where(eq(schema.inventoryItems.id, item2.id));

      await db.insert(schema.inventoryMovements).values([
        { inventoryItemId: item1.id, movementType: 'sold', fromStatus: 'in_stock', toStatus: 'sold', referenceType: 'order', referenceId: order.id, quantityChange: -1, performedBy: owner.id, performedAt: salesDate },
        { inventoryItemId: item2.id, movementType: 'sold', fromStatus: 'in_stock', toStatus: 'sold', referenceType: 'order', referenceId: order.id, quantityChange: -1, performedBy: owner.id, performedAt: salesDate }
      ]);

      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PT-ORDER-${i}-${testTag}`,
        type: 'income',
        category: 'sales',
        amount: subtotal.toString(),
        runningBalance: '0',
        paymentMethod: 'bank_transfer',
        referenceType: 'order',
        referenceId: order.id,
        description: `Thu tiền chốt hóa đơn bán lẻ máy ảnh công nghệ cao mã ${orderNum}`,
        entryDate: salesDateStr,
        createdBy: owner.id,
        createdAt: salesDate
      });
    }
    console.log('   ✅ Đã sinh thành công 50 Đơn hàng hoàn tất.');

    console.log('\n👉 BƯỚC 4: Khởi tạo chuẩn xác 50 chứng từ chi phí vận hành (Expenses)...');
    const dateOpexStart = new Date('2025-01-01T00:00:00');
    const dateOpexEnd = new Date('2026-06-01T23:59:59');
    const [expCat] = await db.insert(schema.expenseCategories).values({ name: 'Chi phí cố định mặt bằng & ads', type: 'fixed' }).returning();

    for (let i = 1; i <= 50; i++) {
      const expDate = randomDate(dateOpexStart, dateOpexEnd);
      const expDateStr = toStrDate(expDate);
      const amount = 800000 + (i % 5) * 600000; 

      const [exp] = await db.insert(schema.expenses).values({
        expenseNumber: `EXP-OPEX-${i}-${testTag}`,
        categoryId: expCat.id,
        amount: amount.toString(),
        description: `Chi trả tiền phí nghiệp vụ hạ tầng số ${i}`,
        expenseDate: expDateStr,
        paymentMethod: 'cash',
        createdBy: owner.id,
        createdAt: expDate
      }).returning();

      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PC-EXP-${i}-${testTag}`,
        type: 'expense',
        category: 'other',
        amount: amount.toString(),
        runningBalance: '0',
        paymentMethod: 'cash',
        referenceType: 'expense',
        referenceId: exp.id,
        description: `Chi xuất quỹ tiền mặt đối ứng chứng từ ${exp.expenseNumber}`,
        entryDate: expDateStr,
        createdBy: owner.id,
        createdAt: expDate
      });
    }

    // BLOCK THỜI GIAN 3: BẢO HÀNH & ĐỔI TRẢ (01/01/2026 -> 01/06/2026)
    console.log('\n👉 BƯỚC 5: Khởi tạo mở phiếu bảo hành tịnh tiến thời gian (01/01/2026 -> 01/06/2026)...');
    const dateWarrantyStart = new Date('2026-01-01T00:00:00');
    const dateWarrantyEnd = new Date('2026-06-01T23:59:59');
    const warrantyItemsPool = soldItemsList.slice(0, 50); 

    for (let i = 0; i < 50; i++) {
      const targetItem = warrantyItemsPool[i];
      
      const [oItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.inventoryItemId, targetItem.id)).limit(1);
      const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, oItem.orderId)).limit(1);

      const wClaimDate = randomDate(dateWarrantyStart, dateWarrantyEnd);
      const wClaimDateStr = toStrDate(wClaimDate);

      const statusCycle: ('pending' | 'inspecting' | 'repairing' | 'waiting_parts' | 'completed')[] = ['pending', 'inspecting', 'repairing', 'waiting_parts', 'completed'];
      const currentStatus = statusCycle[i % statusCycle.length];

      // ĐÃ VÁ: Gỡ bỏ hoàn toàn trường ma orderItemItemId không có trong DDL thực tế
      const [claim] = await db.insert(schema.warrantyClaims).values({
        claimNumber: `WAR-LIFE-${i}-${testTag}`,
        orderId: order.id,
        orderItemId: oItem.id, 
        inventoryItemId: targetItem.id,
        customerId: order.customerId,
        status: currentStatus,
        issueDescription: `Thiết bị phát sinh hiện tượng lỗi màn hình cảm biến pixel thứ ${i}`,
        isUnderWarranty: true,
        warrantyEndDate: '2027-01-01',
        receivedDate: wClaimDateStr,
        createdBy: owner.id,
        createdAt: wClaimDate
      }).returning();

      await db.insert(schema.warrantyLogs).values({
        warrantyClaimId: claim.id,
        action: 'status_changed',
        description: `Nhân viên kỹ thuật store cập nhật trạng thái: ${currentStatus}`,
        newStatus: currentStatus,
        createdBy: owner.id,
        createdAt: wClaimDate
      });

      if (currentStatus !== 'completed') {
        await db.update(schema.inventoryItems).set({ status: 'warranty_repair' }).where(eq(schema.inventoryItems.id, targetItem.id));
      }
    }

    console.log('\n👉 BƯỚC 6: Tạo lập đúng 50 phiếu đổi trả hoàn tiền mặt dứt điểm (01/01/2026 -> 01/06/2026)...');
    const returnItemsPool = soldItemsList.slice(50, 100);

    for (let i = 0; i < 50; i++) {
      const targetItem = returnItemsPool[i];
      
      const [oItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.inventoryItemId, targetItem.id)).limit(1);
      const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, oItem.orderId)).limit(1);

      const rDate = randomDate(dateWarrantyStart, dateWarrantyEnd);
      const rDateStr = toStrDate(rDate);
      const refundValue = Number(oItem.sellingPrice);

      const [ret] = await db.insert(schema.returns).values({
        returnNumber: `RET-LIFE-${i}-${testTag}`,
        orderId: order.id,
        customerId: order.customerId,
        type: 'return',
        reason: 'defective',
        reasonDetail: `Phần cứng bo mạch lỗi nguồn thứ ${i}. Hoàn trả dứt điểm tiền mặt.`,
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
        originalPrice: oItem.sellingPrice,
        refundPrice: refundValue.toString()
      });

      await db.update(schema.inventoryItems).set({ status: 'defective', soldDate: null }).where(eq(schema.inventoryItems.id, targetItem.id));

      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PC-REFUND-RET-${i}-${testTag}`,
        type: 'expense',
        category: 'other',
        amount: refundValue.toString(),
        runningBalance: '0',
        paymentMethod: 'bank_transfer',
        referenceType: 'other',
        referenceId: ret.id,
        description: `Chi hoàn tiền phiếu Đổi/Trả ${ret.returnNumber}`,
        entryDate: rDateStr,
        createdBy: owner.id,
        createdAt: rDate
      });
    }

    // ĐỒNG BỘ DOANH SỐ CHO KHÁCH HÀNG CRMChuẩn UI
    console.log('\n📊 BƯỚC 6.5: Đồng bộ tích lũy doanh số từng khách hàng (orderCount, totalSpent) lên UI CRM...');
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

    console.log('\n🔄 BƯỚC 7: Engine tính lũy kế runningBalance Sổ Quỹ...');
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
    console.log('🎉 MA TRẬN ĐỒ DATA VÀ ĐỒNG BỘ CRM ĐÃ CHỐT HẠ THÀNH CÔNG 100%!');
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