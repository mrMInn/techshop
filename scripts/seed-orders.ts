import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  customers, profiles, products, inventoryItems, orders, orderItems, 
  payments, cashBookEntries, inventoryMovements 
} from '../src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// Hàm lấy ngày ngẫu nhiên trong khoảng 90 ngày qua (để vẽ biểu đồ cho đẹp)
function getRandomDateLast90Days() {
  const today = new Date();
  const past = new Date(today);
  past.setDate(today.getDate() - Math.floor(Math.random() * 90));
  return past;
}

async function main() {
  console.log('🚀 Bắt đầu quy trình tạo 300 Đơn hàng khổng lồ...');

  // 1. Lấy user admin
  const adminProfiles = await db.select().from(profiles).limit(1);
  const adminId = adminProfiles[0]?.id;
  if (!adminId) {
    console.log('⚠️ Không tìm thấy admin.');
    process.exit(1);
  }

  // 2. Lấy danh sách 100 khách hàng đã tạo lúc nãy
  const allCustomers = await db.select().from(customers);
  if (allCustomers.length === 0) {
    console.log('⚠️ Chưa có khách hàng. Hãy chạy seed-customers.ts trước!');
    process.exit(1);
  }
  console.log(`✅ Đã tải ${allCustomers.length} khách hàng.`);

  // 3. Lấy danh sách model sản phẩm
  const allProducts = await db.select().from(products);
  if (allProducts.length === 0) {
    console.log('⚠️ Chưa có sản phẩm mẫu.');
    process.exit(1);
  }

  // 4. Bơm cấp tốc 500 chiếc máy vào kho để lấy hàng bán
  console.log('📦 Đang nhập cấp tốc 500 máy vào kho để chuẩn bị bán...');
  const itemsToInsert = [];
  for (let i = 0; i < 500; i++) {
    const randomProduct = allProducts[Math.floor(Math.random() * allProducts.length)];
    // Giả lập giá vốn từ 10-30 triệu
    const costPrice = Math.floor(Math.random() * 20 + 10) * 1000000; 
    
    itemsToInsert.push({
      productId: randomProduct.id,
      serialNumber: `SN-AUTO-${Date.now()}-${i}`,
      condition: Math.random() > 0.5 ? 'new' as const : 'used' as const,
      status: 'in_stock' as const,
      costPrice: costPrice.toString(),
      originCountry: 'US',
      stockedDate: new Date().toISOString().split('T')[0],
    });
  }

  // Insert kho theo chunk 100 máy/lần để không bị nghẽn
  const availableInventory = [];
  for (let i = 0; i < itemsToInsert.length; i += 100) {
    const chunk = itemsToInsert.slice(i, i + 100);
    const inserted = await db.insert(inventoryItems).values(chunk).returning();
    availableInventory.push(...inserted);
  }
  console.log(`✅ Đã nhập xong ${availableInventory.length} máy sẵn sàng bán.`);

  // 5. Bắt đầu tạo 300 Đơn hàng
  console.log('🛒 Đang tạo 300 đơn hàng bán lẻ và hạch toán kế toán...');
  
  let inventoryIndex = 0;
  let totalRevenue = 0;

  for (let i = 1; i <= 300; i++) {
    // Random 1 khách hàng
    const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
    const orderDate = getRandomDateLast90Days();
    const orderDateStr = orderDate.toISOString().split('T')[0];
    
    // Random mua 1 hoặc 2 máy
    const itemsCount = Math.random() > 0.8 ? 2 : 1; 
    if (inventoryIndex + itemsCount >= availableInventory.length) break; // Hết hàng thì nghỉ

    let subtotal = 0;
    let totalCost = 0;
    const orderItemsData = [];

    // Lấy máy ra để bán
    for (let j = 0; j < itemsCount; j++) {
      const invItem = availableInventory[inventoryIndex++];
      const cost = Number(invItem.costPrice);
      // Bán chênh lên 15% - 30% để có lời
      const selling = Math.floor(cost * (1 + (Math.random() * 0.15 + 0.15))); 
      
      subtotal += selling;
      totalCost += cost;

      orderItemsData.push({
        inventoryItem: invItem,
        sellingPrice: selling.toString(),
        costPrice: cost.toString(),
        profit: (selling - cost).toString(),
      });
    }

    const discountAmount = Math.random() > 0.7 ? 500000 : 0; // 30% cơ hội được giảm 500k
    const totalAmount = subtotal - discountAmount;
    const profit = totalAmount - totalCost;
    const profitMargin = (profit / totalAmount) * 100;
    totalRevenue += totalAmount;

    const paymentMethods = ['cash', 'bank_transfer', 'card'] as const;
    const payMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

    const orderNumber = `ORD-${orderDateStr.replace(/-/g, '')}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;

    // A. Insert bảng Orders
    const [newOrder] = await db.insert(orders).values({
      orderNumber,
      customerId: customer.id,
      status: 'completed',
      saleChannel: Math.random() > 0.5 ? 'online' : 'offline',
      subtotal: subtotal.toString(),
      discountAmount: discountAmount.toString(),
      taxAmount: '0',
      totalAmount: totalAmount.toString(),
      totalCost: totalCost.toString(),
      profit: profit.toString(),
      profitMargin: profitMargin.toString(),
      paymentStatus: 'paid',
      paymentMethod: payMethod,
      soldBy: adminId,
      createdAt: orderDate,
    }).returning();

    // B. Insert OrderItems & Cập nhật trạng thái máy thành 'sold'
    for (const data of orderItemsData) {
      await db.insert(orderItems).values({
        orderId: newOrder.id,
        inventoryItemId: data.inventoryItem.id,
        productId: data.inventoryItem.productId,
        sellingPrice: data.sellingPrice,
        costPrice: data.costPrice,
        profit: data.profit,
        warrantyMonths: 12,
      });

      await db.update(inventoryItems).set({
        status: 'sold',
        soldDate: orderDateStr,
        warrantyStart: orderDateStr,
      }).where(eq(inventoryItems.id, data.inventoryItem.id));
    }

    // C. Insert Payment
    await db.insert(payments).values({
      orderId: newOrder.id,
      amount: totalAmount.toString(),
      paymentMethod: payMethod,
      paymentDate: orderDate,
      notes: 'Thanh toán toàn bộ khi nhận hàng',
      createdBy: adminId,
    });

    // D. Insert Sổ Quỹ (Cashbook)
    const cbNumber = `CB${orderDateStr.replace(/-/g, '')}-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
    await db.insert(cashBookEntries).values({
      entryNumber: cbNumber,
      type: 'income',
      category: 'sales',
      amount: totalAmount.toString(),
      runningBalance: '0', // Mình sẽ chạy hàm recalculate ở action sau
      paymentMethod: payMethod,
      referenceType: 'order',
      referenceId: newOrder.id,
      description: `Thu tiền thanh toán đơn hàng ${orderNumber}`,
      entryDate: orderDateStr,
      createdBy: adminId,
      createdAt: orderDate, // Set createdAt lùi về quá khứ để biểu đồ chuẩn
    });
  }

  console.log(`✅ Tạo thành công 300 Đơn hàng. Tổng doanh thu giả lập: ${totalRevenue.toLocaleString('vi-VN')} VNĐ`);
  console.log('⏳ Đang chạy đồng bộ lại số liệu Tổng chi tiêu cho Khách hàng...');
  
  // E. Cập nhật lại totalSpent và orderCount cho 100 khách hàng
  for (const customer of allCustomers) {
    const stats = await db.select({
      count: sql<number>`count(${orders.id})`,
      total: sql<number>`sum(${orders.totalAmount})`,
    })
    .from(orders)
    .where(eq(orders.customerId, customer.id)) as any[];

    if (stats[0] && stats[0].count > 0) {
      await db.update(customers).set({
        orderCount: Number(stats[0].count),
        totalSpent: Number(stats[0].total).toString(),
      }).where(eq(customers.id, customer.id));
    }
  }

  console.log('🎉 TẤT CẢ ĐÃ XONG! Bật giao diện Dashboard lên để chiêm ngưỡng biểu đồ siêu đẹp nhé!');
  process.exit(0);
}

main();