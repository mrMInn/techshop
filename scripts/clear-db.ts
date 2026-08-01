// File: scripts/clear-db.ts
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  inventoryMovements,
  cashBookEntries,
  payments,
  orderItems,
  orders,
  quotationItems,
  quotations,
  inventoryItems,
  products,
  brands,
  categories,
  expenses,
  expenseCategories,
  incomeCategories,
  customers,
  leadSources,
  accountingPeriods,
  purchaseOrderItems,
  purchaseOrders,
  returnItems,
  returns,
  warrantyLogs,
  warrantyClaims,
  suppliers,
  telegramNotificationLogs,
  telegramNotificationEvents,
  telegramSettings,
  countries,
  shippingCarriers,
} from '../src/lib/db/schema'; 

const sqlDb = postgres(process.env.DATABASE_URL!);
const db = drizzle(sqlDb);

async function main() {
  console.log('🚨 [CẢNH BÁO] Bắt đầu quét sạch TOÀN BỘ dữ liệu Database...');

  try {
    await db.transaction(async (tx) => {
      
      // Bước 1: Xóa logs & audit
      console.log('🧹 Đang xóa Telegram logs...');
      await tx.delete(telegramNotificationLogs);
      await tx.delete(telegramNotificationEvents);
      await tx.delete(telegramSettings);

      // Bước 2: Xóa lịch sử biến động kho và dòng tiền
      console.log('🧹 Đang xóa Thẻ kho, Sổ quỹ, Thanh toán...');
      await tx.delete(inventoryMovements);
      await tx.delete(cashBookEntries);
      await tx.delete(payments);

      // Bước 3: Xóa Bảo hành
      console.log('🧹 Đang xóa Bảo hành...');
      await tx.delete(warrantyLogs);
      await tx.delete(warrantyClaims);

      // Bước 4: Xóa Đổi/Trả hàng
      console.log('🧹 Đang xóa Đổi/Trả hàng...');
      await tx.delete(returnItems);
      await tx.delete(returns);

      // Bước 5: Xóa Đơn bán hàng và chi tiết
      console.log('🧹 Đang xóa Đơn bán lẻ và chi tiết...');
      await tx.delete(orderItems);
      await tx.delete(orders);

      // Bước 6: Xóa Báo giá
      console.log('🧹 Đang xóa Báo giá...');
      await tx.delete(quotationItems);
      await tx.delete(quotations);

      // Bước 7: Xóa Đơn NHẬP HÀNG
      console.log('🧹 Đang xóa đơn Nhập Hàng (Purchase Orders)...');
      await tx.delete(purchaseOrderItems);
      await tx.delete(purchaseOrders);

      // Bước 8: Xóa Phiếu chi & phiếu thu kế toán
      console.log('🧹 Đang xóa Phiếu chi, Phiếu thu, Kỳ kế toán...');
      await tx.delete(expenses);
      await tx.delete(expenseCategories);
      await tx.delete(incomeCategories);
      await tx.delete(accountingPeriods);

      // Bước 9: Xóa Kho hàng
      console.log('🧹 Đang dọn danh sách máy trong kho...');
      await tx.delete(inventoryItems);

      // Bước 10: Xóa Model sản phẩm, Thương hiệu, Danh mục
      console.log('🧹 Đang dọn dẹp danh mục sản phẩm...');
      await tx.delete(products);
      await tx.delete(brands);
      await tx.delete(categories);

      // Bước 11: Xóa Nhà cung cấp
      console.log('🧹 Đang xóa Nhà cung cấp...');
      await tx.delete(suppliers);

      // Bước 12: Xóa Khách hàng và nguồn dữ liệu
      console.log('🧹 Đang xóa Khách hàng...');
      await tx.delete(customers);
      await tx.delete(leadSources);

      // Bước 13: Xóa Quốc gia và đơn vị vận chuyển
      console.log('🧹 Đang xóa Quốc gia và đơn vị vận chuyển...');
      await tx.delete(countries);
      await tx.delete(shippingCarriers);

      // Chừa bảng 'profiles' để giữ tài khoản admin
    });

    console.log('✨ THÀNH CÔNG! Toàn bộ Database đã được dọn sạch bong kin kít.');
    process.exit(0);

  } catch (error) {
    console.error('❌ THẤT BẠI khi dọn dẹp Database:', error);
    process.exit(1);
  }
}

main();