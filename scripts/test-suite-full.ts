// scripts/generate-bulk-test-data.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../src/lib/db/schema'; // Trỏ đúng tới thư mục chứa file schema tổng của mày
import { eq, and, sql } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('❌ DATABASE_URL chưa được cấu hình trong .env.local');

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Hàm helper sinh ngày ngẫu nhiên tịnh tiến nằm trong dải mốc thời gian yêu cầu
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
const toStrDate = (d: Date) => d.toISOString().split('T')[0];

async function generateBulkSystemTestData() {
  console.log('🏁 =================================================================');
  console.log('🚀 KHỞI CHẠY ENGINE NẠP 150 THIẾT BỊ VÀ PHỦ ĐÚNG 50 DÒNG MỖI MODULE');
  console.log('🏁 =================================================================\n');

  try {
    // ── BƯỚC 0: SÁT THỦ DIỆT BUG - QUÉT SẠCH DATA CŨ THEO ĐÚNG THỨ TỰ THÁP KHÓA NGOẠI DDL ──
    console.log('🧹 Đang tháo dỡ khóa ngoại và dọn sạch toàn bộ các bảng cũ trên Database...');
    
    // Cấp 1: Các bảng nhật ký vết và audit logs thô độc lập
    try { await db.delete(schema.warrantyLogs); } catch {}
    try { await db.delete(schema.auditLogs); } catch {}
    try { await db.delete(schema.telegramNotificationLogs); } catch {}
    try { await db.delete(schema.telegramNotificationEvents); } catch {}
    try { await db.delete(schema.quotationItems); } catch {}
    try { await db.delete(schema.returnItems); } catch {}
    
    // Cấp 2: Các phân hệ dịch vụ mở rộng (Bảo hành, Đổi trả, Báo giá)
    try { await db.delete(schema.warrantyClaims); } catch {}
    try { await db.delete(schema.returns); } catch {}
    try { await db.delete(schema.quotations); } catch {}
    try { await db.delete(schema.payments); } catch {}
    try { await db.delete(schema.orderItems); } catch {}
    
    // Cấp 3: Phân hệ hóa đơn bán lẻ, đơn sỉ PO và dòng tiền cashbook
    try { await db.delete(schema.orders); } catch {}
    try { await db.delete(schema.purchaseOrderItems); } catch {}
    try { await db.delete(schema.purchaseOrders); } catch {}
    try { await db.delete(schema.inventoryMovements); } catch {}
    try { await db.delete(schema.cashBookEntries); } catch {}
    try { await db.delete(schema.expenses); } catch {}
    
    // Cấp 4: Phân hệ cấu hình lõi, danh mục, kho bãi và tài chính thuế
    try { await db.delete(schema.inventoryItems); } catch {}
    try { await db.delete(schema.products); } catch {}
    try { await db.delete(schema.categories); } catch {}
    try { await db.delete(schema.brands); } catch {}
    try { await db.delete(schema.suppliers); } catch {}
    try { await db.delete(schema.expenseCategories); } catch {}
    try { await db.delete(schema.accountingPeriods); } catch {}
    
    // Cấp 5: Phân hệ tài khoản CRM khách hàng và Telegram gốc tổng
    try { await db.delete(schema.customers); } catch {}
    try { await db.delete(schema.leadSources); } catch {}
    try { await db.delete(schema.telegramSettings); } catch {}
    try { await db.delete(schema.profiles); } catch {}
    
    console.log('   ✅ Đã wipe sạch dữ liệu test cũ hoàn toàn an toàn.');

    // ── BƯỚC 1: KHỞI TẠO MASTER DATA NỀN ──
    console.log('\n👉 BƯỚC 1: Tạo tài khoản quản trị viên, thương hiệu, danh mục và tệp khách hàng...');
    const [owner] = await db.insert(schema.profiles).values({
      id: crypto.randomUUID(),
      fullName: 'Minh Chỉ Huy Tổng Lực',
      email: 'owner.command@techstore.vn',
      role: 'admin',
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
    for (let i = 1; i <= 40; i++) {
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

    // Đúc hòm các kỳ kế toán từ 2021-06 đến 2026-06 (Format varchar(7) chuẩn chỉ chặn lỗi quá ký tự)
    const years = [2021, 2022, 2023, 2024, 2025, 2026];
    for (const year of years) {
      const minMonth = year === 2021 ? 6 : 1;
      const maxMonth = year === 2026 ? 6 : 12;
      for (let month = minMonth; month <= maxMonth; month++) {
        const periodStr = `${year}-${String(month).padStart(2, '0')}`;
        await db.insert(schema.accountingPeriods).values({
          period: periodStr,
          startDate: `${periodStr}-01`,
          endDate: `${periodStr}-28`,
          isClosed: false
        });
      }
    }

    // ── BƯỚC 2: PHỦ ĐÚNG 300 THIẾT BỊ KHO HÀNG TRẢI DÀI TRÊN 5 NĂM (01/06/2021 -> 01/06/2026) ──
    console.log('\n👉 BƯỚC 2: Rải đều chính xác 300 chiếc máy định danh theo mã Serial suốt dải thời gian...');
    const inventoryPool = [];
    const dateTimelineStart = new Date('2021-06-01T00:00:00');
    const dateTimelineEnd = new Date('2026-06-01T23:59:59');
    const testTag = Math.floor(Math.random() * 100000);

    for (let i = 1; i <= 300; i++) {
      const prod = productRows[i % productRows.length];
      const cost = 4000000 + (i % 6) * 3500000; // Chi phí vốn dao động từ 4tr -> 21.5tr
      const sell = cost + 2500000;              // Lãi biên niêm yết 2.5tr
      
      // Ngày nhập máy trải dọc toàn bộ dải thời gian từ 1/1/2025 đến 1/6/2026 theo yêu cầu
      const stockDateStr = toStrDate(randomDate(dateTimelineStart, dateTimelineEnd));

      const [item] = await db.insert(schema.inventoryItems).values({
        serialNumber: `SN-EBAY-MATRIX-${i}-${testTag}`,
        productId: prod.id,
        condition: i % 5 === 0 ? 'used' : 'new',
        status: 'in_stock', // Trạng thái sẵn sàn bán kệ kho
        costPrice: cost.toString(),
        sellingPrice: sell.toString(),
        originCountry: 'US',
        stockedDate: stockDateStr,
        createdBy: owner.id
      }).returning();

      // Log vết Thẻ kho (Stock card) tịnh tiến theo ngày nhập tương ứng
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
    console.log(`   ✅ Hoàn tất nạp kho ${inventoryPool.length} thiết bị độc bản lên kệ.`);

    // ── BƯỚC 3: PHỦ ĐÚNG 150 ĐƠN HÀNG BÁN LẺ THÀNH CÔNG (Completed Orders) ──
    console.log('\n👉 BƯỚC 3: Khởi tạo khớp đúng 150 hóa đơn xuất kho bán lẻ (Mỗi đơn rút 2 máy = Tiêu thụ 300 máy)...');
    const soldItemsList = [];

    for (let i = 1; i <= 150; i++) {
      const customer = customerRows[i % customerRows.length];
      
      // Lấy 2 con máy từ pool kho ra xuất xưởng
      const item1 = inventoryPool.pop()!;
      const item2 = inventoryPool.pop()!;
      // Ngày bán đơn hàng bắt buộc phải sau hoặc bằng ngày con máy 1 nạp kho để logic thời gian hoàn hảo
      const item1StockDate = new Date(item1.stockedDate || '2025-01-01');
      const salesDate = randomDate(item1StockDate, dateTimelineEnd);
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

      // 3.1 Tạo hóa đơn bán lẻ hoàn tất
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

      // 3.2 Đẩy dòng thiết bị vào chi tiết dòng đơn hàng order_items
      await db.insert(schema.orderItems).values([
        { orderId: order.id, inventoryItemId: item1.id, productId: item1.productId, sellingPrice: item1.sellingPrice || '0', costPrice: item1.costPrice, warrantyMonths: 12, profit: (Number(item1.sellingPrice || 0) - Number(item1.costPrice)).toString() },
        { orderId: order.id, inventoryItemId: item2.id, productId: item2.productId, sellingPrice: item2.sellingPrice || '0', costPrice: item2.costPrice, warrantyMonths: 12, profit: (Number(item2.sellingPrice || 0) - Number(item2.costPrice)).toString() }
      ]);

      // 3.3 Chuyển trạng thái máy kho hàng sang SOLD và mở luồng hạn bảo hành lẻ
      await db.update(schema.inventoryItems).set({ status: 'sold', soldDate: salesDateStr, warrantyStart: salesDateStr, warrantyEnd: toStrDate(new Date(salesDate.setMonth(salesDate.getMonth() + 12))) }).where(eq(schema.inventoryItems.id, item1.id));
      await db.update(schema.inventoryItems).set({ status: 'sold', soldDate: salesDateStr, warrantyStart: salesDateStr, warrantyEnd: toStrDate(new Date(salesDate.setMonth(salesDate.getMonth() + 12))) }).where(eq(schema.inventoryItems.id, item2.id));

      // 3.4 Bắn log Thẻ kho xuất hàng
      await db.insert(schema.inventoryMovements).values([
        { inventoryItemId: item1.id, movementType: 'sold', fromStatus: 'in_stock', toStatus: 'sold', referenceType: 'order', referenceId: order.id, quantityChange: -1, performedBy: owner.id, performedAt: salesDate },
        { inventoryItemId: item2.id, movementType: 'sold', fromStatus: 'in_stock', toStatus: 'sold', referenceType: 'order', referenceId: order.id, quantityChange: -1, performedBy: owner.id, performedAt: salesDate }
      ]);

      // 3.5 Bắn dòng thu nhập đối ứng vào Sổ quỹ Cashbook
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
    console.log('   ✅ Đã sinh thành công 50 Đơn hàng hoàn tất. Kho hàng còn lại đúng 50 máy sẵn kệ IN_STOCK.');

    // ── BƯỚC 4: PHỦ ĐÚNG 100 CHỨNG TỪ CHI PHÍ VẬN HÀNH OPEX ──
    console.log('\n👉 BƯỚC 4: Khởi tạo chuẩn xác 100 chứng từ chi phí vận hành (Expenses)...');
    const [expCat] = await db.insert(schema.expenseCategories).values({ name: 'Chi phí cố định mặt bằng & ads', type: 'fixed' }).returning();

    for (let i = 1; i <= 100; i++) {
      const expDate = randomDate(dateTimelineStart, dateTimelineEnd);
      const expDateStr = toStrDate(expDate);
      const amount = 800000 + (i % 5) * 600000; // Chi phí vận hành từ 800k -> 3.2tr

      const [exp] = await db.insert(schema.expenses).values({
        expenseNumber: `EXP-OPEX-${i}-${testTag}`,
        categoryId: expCat.id,
        amount: amount.toString(),
        description: `Chi trả tiền phí nghiệp vụ hạ tầng, đóng gói bao bì, tiền điện mã chứng từ số ${i}`,
        expenseDate: expDateStr,
        paymentMethod: 'cash',
        createdBy: owner.id,
        createdAt: expDate
      }).returning();

      // Bắn dòng chi tiền mặt ra khỏi Sổ quỹ tổng Cashbook tương ứng
      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PC-EXP-${i}-${testTag}`,
        type: 'expense',
        category: 'other',
        amount: amount.toString(),
        runningBalance: '0',
        paymentMethod: 'cash',
        referenceType: 'expense',
        referenceId: exp.id,
        description: `Chi xuất quỹ tiền mặt đối ứng chứng từ chi phí vận hành cửa hàng ${exp.expenseNumber}`,
        entryDate: expDateStr,
        createdBy: owner.id,
        createdAt: expDate
      });
    }
    console.log('   ✅ Đã phủ xong 50 dòng Chi phí và đối ứng luồng dòng tiền Chi Quỹ.');

    // ── BƯỚC 5: PHỦ ĐÚNG 100 PHIẾU TIẾP NHẬN BẢO HÀNH KỸ THUẬT (Warranty Claims) ──
    console.log('\n👉 BƯỚC 5: Khởi tạo chuẩn xác 100 ca mở phiếu nhận sửa chữa bảo hành từ khách hàng...');
    // Cắt phom 100 con máy đầu tiên trong mớ đã bán đem đi làm hồ sơ bảo hành kỹ thuật
    const warrantyItemsPool = soldItemsList.slice(0, 100);

    for (let i = 0; i < 100; i++) {
      const targetItem = warrantyItemsPool[i];
      
      // Bốc ngược thông tin dòng hóa đơn bán lẻ chi tiết để làm khóa ngoại
      const [oItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.inventoryItemId, targetItem.id)).limit(1);
      const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, oItem.orderId)).limit(1);

      const itemSoldDate = new Date(targetItem.soldDate || '2025-07-01');
      const wClaimDate = randomDate(itemSoldDate, dateTimelineEnd);
      const wClaimDateStr = toStrDate(wClaimDate);

      const statusCycle: ('pending' | 'inspecting' | 'repairing' | 'waiting_parts' | 'completed')[] = ['pending', 'inspecting', 'repairing', 'waiting_parts', 'completed'];
      const currentStatus = statusCycle[i % statusCycle.length];

      const [claim] = await db.insert(schema.warrantyClaims).values({
        claimNumber: `WAR-LIFE-${i}-${testTag}`,
        orderId: order.id,
        orderItemId: oItem.id, // Point khít khao vào ID dòng order_items thực tế
        inventoryItemId: targetItem.id,
        customerId: order.customerId,
        status: currentStatus,
        issueDescription: `Thiết bị phát sinh hiện tượng sọc chỉ màn hình, thỉnh thoảng sập nguồn do lỗi linh kiện số ${i}`,
        isUnderWarranty: true,
        warrantyEndDate: '2027-01-01',
        receivedDate: wClaimDateStr,
        createdBy: owner.id,
        createdAt: wClaimDate
      }).returning();

      // Lưu vết log tiến trình kỹ thuật viên bung máy
      await db.insert(schema.warrantyLogs).values({
        warrantyClaimId: claim.id,
        action: 'status_changed',
        description: `Nhân viên kỹ thuật store ghi vết cập nhật trạng thái luồng sửa máy: ${currentStatus}`,
        newStatus: currentStatus,
        createdBy: owner.id,
        createdAt: wClaimDate
      });

      // Nếu lệnh sửa chữa chưa đóng, chuyển máy kho hàng sang khu cách ly 'warranty_repair'
      if (currentStatus !== 'completed') {
        await db.update(schema.inventoryItems).set({ status: 'warranty_repair' }).where(eq(schema.inventoryItems.id, targetItem.id));
      }
    }
    console.log('   ✅ Đã hoàn tất phủ đúng 50 dòng Nhật ký & Phiếu Tiếp nhận bảo hành mở.');

    // ── BƯỚC 6: PHỦ ĐÚNG 100 PHIẾU ĐỔI TRẢ HOÀN TIỀN MẶT CÁCH LY HÀNG LỖI (Returns) ──
    console.log('\n👉 BƯỚC 6: Khởi tạo chuẩn xác 100 phiếu đổi trả bồi hoàn tiền mặt dứt điểm (Hủy đơn trả phế liệu)...');
    // Bốc 100 con máy tiếp theo trong mớ máy đã bán mang đi làm thủ tục đổi trả hủy mã
    const returnItemsPool = soldItemsList.slice(100, 200);

    for (let i = 0; i < 100; i++) {
      const targetItem = returnItemsPool[i];
      
      const [oItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.inventoryItemId, targetItem.id)).limit(1);
      const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, oItem.orderId)).limit(1);

      const itemSoldDate = new Date(targetItem.soldDate || '2025-07-01');
      const rDate = randomDate(itemSoldDate, dateTimelineEnd);
      const rDateStr = toStrDate(rDate);
      const refundValue = Number(oItem.sellingPrice);

      // Tạo lệnh hoàn trả hoàn tất
      const [ret] = await db.insert(schema.returns).values({
        returnNumber: `RET-LIFE-${i}-${testTag}`,
        orderId: order.id,
        customerId: order.customerId,
        type: 'return',
        reason: 'defective',
        reasonDetail: `Phần cứng máy dính lỗi bo mạch nghiêm trọng ca số ${i}, không thể sửa chữa. Lập lệnh bồi hoàn tiền.`,
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
        isDefective: true, // GẮN CỜ PHẾ LIỆU HỎNG
        originalPrice: oItem.sellingPrice,
        refundPrice: refundValue.toString()
      });

      // ÉP CHẾT TRẠNG THÁI MÁY THÀNH DEFECTIVE (Biệt giam vĩnh viễn chặn tuyệt đối nhân viên bán nhầm)
      await db.update(schema.inventoryItems).set({ status: 'defective', soldDate: null }).where(eq(schema.inventoryItems.id, targetItem.id));

      // Xuất tiền quỹ bồi hoàn hạch toán âm (Expense) Sổ quỹ tổng
      await db.insert(schema.cashBookEntries).values({
        entryNumber: `PC-REFUND-RET-${i}-${testTag}`,
        type: 'expense',
        category: 'other',
        amount: refundValue.toString(),
        runningBalance: '0',
        paymentMethod: 'bank_transfer',
        referenceType: 'other',
        referenceId: ret.id,
        description: `Chi xuất quỹ hoàn trả tiền mặt giá trị máy lỗi phế liệu theo chứng từ phiếu ${ret.returnNumber}`,
        entryDate: rDateStr,
        createdBy: owner.id,
        createdAt: rDate
      });
    }
    console.log('   ✅ Đã phủ xong 50 hồ sơ Đổi/Trả hoàn tiền dứt điểm giao dịch.');

    // ── BƯỚC 7: KÍCH HOẠT ENGINE KIỂM TOÁN TÍNH TOÁN LŨY KẾ SỔ QUỸ (Flawless Ledger Engine) ──
    console.log('\n🔄 BƯỚC 7: Đang chạy trục vớt lịch sử đối soát, sắp thứ tự thời gian tính runningBalance Sổ Quỹ...');
    const allEntries = await db.select().from(schema.cashBookEntries);
    
    // Xếp dòng tiền tịnh tiến chuẩn: Ngày nhỏ chạy trước ➔ Ngày lớn chạy sau
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
    console.log(`   ✅ Sổ quỹ kế toán hạch toán xong dứt điểm. Điểm cân bằng cuối quỹ chốt ở: ${currentBalance.toLocaleString()}đ`);

    console.log('\n🏆 =================================================================');
    console.log('🎉 MA TRẬN ĐỔ ĐỒNG LOẠT BULK DATA TÍNH TOÁN TẢI ĐÃ CHỐT HẠ THÀNH CÔNG!');
    console.log('   - 300 Thiết bị độc bản rải trên trục thời gian (01/06/2021 -> 01/06/2026)');
    console.log('   - 150 Hóa đơn chốt đơn lẻ hoàn thành (Completed)');
    console.log('   - 100 Chứng từ chi phí vận hành OPEX cửa hàng');
    console.log('   - 100 Phiếu tiếp nhận bảo hành dịch vụ sửa chữa mở rộng');
    console.log('   - 100 Phiếu đổi trả hoàn tiền mặt giam lỏng xác máy defective');
    console.log('====================================================================');

  } catch (error) {
    console.error('\n❌ TIẾN TRÌNH THẤT BẠI. DỮ LIỆU BÌ NGHẼN BỞI LỖI RÀNG BUỘC HỆ THỐNG:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

generateBulkSystemTestData();