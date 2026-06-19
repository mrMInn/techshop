// scripts/verify-business-logic.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../src/lib/db/schema'; // Trỏ đúng tới thư mục chứa file schema tổng của mày
import { eq, and, sql, or } from 'drizzle-orm'; // Đã vá thêm 'or' vào đây chuẩn bài

dotenv.config({ path: '.env.local' });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('❌ DATABASE_URL chưa được cấu hình trong .env.local');

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function executeAbsoluteBusinessLogicAudit() {
  console.log('🏁 =================================================================');
  console.log('⚙️ KÍCH HOẠT ENGINE KIỂM TOÁN VÀ THẨM ĐỊNH TOÀN BỘ LOGIC NGHIỆP VỤ ERP');
  console.log('🏁 =================================================================\n');

  try {
    // =========================================================================
    // 💸 MA TRẬN 1: KIỂM TOÁN DOANH THU & CHỐT LÃI (Anti Double-Counting)
    // =========================================================================
    console.log('👉 [MA TRẬN 1]: Thẩm định công thức tính toán Lợi Nhuận ròng trên 50 đơn hàng...');
    const allOrders = await db.select().from(schema.orders);
    
    for (const order of allOrders) {
      const totalAmount = Number(order.totalAmount || 0);
      const totalCost = Number(order.totalCost || 0);
      const savedProfit = Number(order.profit || 0);

      const expectedProfit = totalAmount - totalCost;

      if (Math.abs(savedProfit - expectedProfit) > 0.01) {
        throw new Error(`🔴 TOANG LOGIC TÀI CHÍNH: Mã đơn ${order.orderNumber} tính sai tiền Lãi! DB lưu: ${savedProfit}đ, Kỳ vọng thực tế: ${expectedProfit}đ.`);
      }
    }
    console.log(`   ✅ Khớp tài chính thành công: 100% đơn hàng lưu đúng công thức biên lãi.`);

    // =========================================================================
    // 📒 MA TRẬN 2: ĐỐI SOÁT CHÉO DÒNG TIỀN SỔ QUỸ (Cashbook Integrity)
    // =========================================================================
    console.log('\n👉 [MA TRẬN 2]: Kiếm toán đối soát dòng tiền nạp/rút và số dư lũy kế Sổ quỹ...');
    const cashEntries = await db.select().from(schema.cashBookEntries);
    
    cashEntries.sort((a, b) => {
      const timeA = new Date(a.entryDate).getTime();
      const timeB = new Date(b.entryDate).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let calculatedBalance = 0;
    for (let i = 0; i < cashEntries.length; i++) {
      const entry = cashEntries[i];
      const amount = Number(entry.amount || 0);
      const savedRunningBalance = Number(entry.runningBalance || 0);

      if (entry.type === 'income') {
        calculatedBalance += amount;
      } else {
        calculatedBalance -= amount;
      }

      if (i === cashEntries.length - 1 && Math.abs(calculatedBalance - savedRunningBalance) > 0.01) {
        throw new Error(`🔴 BUG SỔ QUỸ CHÍ MẠNG: Số dư lũy kế runningBalance dòng cuối bị lệch! DB lưu: ${savedRunningBalance}đ, Thực tế cộng dồn: ${calculatedBalance}đ`);
      }
    }
    console.log(`   ✅ Đối soát chéo Sổ quỹ OK. Điểm cân bằng Quỹ Tiền Mặt cuối kỳ khớp 100% thực tế.`);

    // =========================================================================
    // 🔒 MA TRẬN 3: KIỂM TRA KHÓA CÁCH LY HÀNG LỖI (Defective Item Lockout)
    // =========================================================================
    console.log('\n👉 [MA TRẬN 3]: Quét rà soát rủi ro - Đảm bảo xác máy hỏng (Defective) không bị lọt đơn bán...');
    const defectiveItems = await db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.status, 'defective'));
    
    for (const item of defectiveItems) {
      const linkedOrderItems = await db.select().from(schema.orderItems).where(eq(schema.orderItems.inventoryItemId, item.id));
      
      for (const oItem of linkedOrderItems) {
        const [linkedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, oItem.orderId)).limit(1);
        
        if (linkedOrder && linkedOrder.status === 'completed') {
          const [returnRecord] = await db.select().from(schema.returns).where(eq(schema.returns.orderId, linkedOrder.id)).limit(1);
          if (!returnRecord || returnRecord.status !== 'completed') {
            throw new Error(`🔴 BUG KHO NGUY HIỂM: Thiết bị Serial [${item.serialNumber}] đã báo HỎNG (Defective) nhưng vẫn nằm trong Đơn hàng hoàn thành [${linkedOrder.orderNumber}]!`);
          }
        }
      }
    }
    console.log('   ✅ Phân hệ cách ly hoạt động tốt. 100% xác máy hỏng đã bị cô lập phong tỏa.');

    // =========================================================================
    // 🔧 MA TRẬN 4: THẨM ĐỊNH TRẠNG THÁI LUỒNG BẢO HÀNH (Warranty State Machine)
    // =========================================================================
    console.log('\n👉 [MA TRẬN 4]: Đối soát chéo luồng kỹ thuật sửa chữa và trạng thái thẻ kho...');
    const itemsInRepair = await db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.status, 'warranty_repair'));
    
    for (const item of itemsInRepair) {
      const activeClaims = await db.select().from(schema.warrantyClaims).where(and(
        eq(schema.warrantyClaims.inventoryItemId, item.id),
        or(
          eq(schema.warrantyClaims.status, 'pending'),
          eq(schema.warrantyClaims.status, 'inspecting'),
          eq(schema.warrantyClaims.status, 'repairing'),
          eq(schema.warrantyClaims.status, 'waiting_parts')
        )
      ));

      if (activeClaims.length === 0) {
        throw new Error(`🔴 BUG LUỒNG KỸ THUẬT: Thiết bị Serial [${item.serialNumber}] báo sửa chữa trong kho, nhưng không thấy có Phiếu bảo hành nào đang mở cứu xét!`);
      }
    }
    console.log('   ✅ Phân hệ bảo hành đạt chuẩn: Trạng thái thiết bị khớp khít với luồng lệnh kỹ sư.');

    // =========================================================================
    // 📆 MA TRẬN 5: KIỂM TOÁN TRỤC THỜI GIAN NGHIỆP VỤ (Chronological Timeline Check)
    // =========================================================================
    console.log('\n👉 [MA TRẬN 5]: Kiểm toán trục thời gian tịnh tiến - Chặn đứng lỗi xuyên không dữ liệu...');
    const allClaims = await db.select().from(schema.warrantyClaims);
    
    for (const claim of allClaims) {
      const [item] = await db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, claim.inventoryItemId)).limit(1);
      
      if (item && item.soldDate) {
        const soldTime = new Date(item.soldDate).getTime();
        const claimTime = new Date(claim.receivedDate).getTime();

        if (claimTime < soldTime) {
          throw new Error(`🔴 LỖI THỜI GIAN VÔ LÝ: Phiếu bảo hành ${claim.claimNumber} có ngày nhận máy bảo hành nằm TRƯỚC cả ngày store bán con máy đó!`);
        }
      }
    }
    console.log('   ✅ Trục thời gian hoàn hảo: Logic tịnh tiến nghiệp vụ chuẩn chỉ.');

    console.log('\n🏆 =================================================================');
    console.log('🎉 KẾT LUẬN KIỂM TOÁN: TOÀN BỘ 5 MA TRẬN LOGIC NGHIỆP VỤ ĐÃ PASS SUÔN SẺ!');
    console.log('====================================================================');

  } catch (error) {
    console.error('\n❌ PHÁT HIỆN BUG NGHIỆP VỤ TRONG HỆ THỐNG DỮ LIỆU NỀN:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeAbsoluteBusinessLogicAudit();