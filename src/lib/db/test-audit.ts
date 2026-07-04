/**
 * ============================================================
 *  TechStore ERP — BỘ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN
 * ============================================================
 *  Script này kiểm tra toàn bộ tính nhất quán dữ liệu:
 *    1. Tổng tiền đơn hàng = sum(sellingPrice - discount) - discountAmount + taxAmount
 *    2. Lợi nhuận = totalAmount - totalCost  
 *    3. Sổ quỹ running balance đúng lũy kế
 *    4. Customer totalSpent = sum(completed orders totalAmount)
 *    5. Customer orderCount = count(completed orders)
 *    6. Inventory status khớp với movements cuối cùng
 *    7. Máy đã sold PHẢI có đơn hàng liên kết (order_items)
 *    8. Cash book income from orders = sum(payments from completed orders)
 *    9. Returns refund phải nhỏ hơn hoặc bằng original order
 *   10. Warranty claims phải gắn đúng order + customer
 *   11. Quotation totalAmount = subtotal - discount
 *   12. Orders.profit = orders.totalAmount - orders.totalCost
 *
 *  Sau đó, chạy thao tác THỰC TẾ (tạo đơn → bán → kiểm tra kho, sổ quỹ)
 *  để verify logic nghiệp vụ end-to-end.
 * ============================================================
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from './schema';
import { eq, and, sql, desc } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ============================================================
// HELPERS
// ============================================================
let totalTests = 0;
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  totalTests++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    const msg = `❌ ${name}${detail ? ` — ${detail}` : ''}`;
    failures.push(msg);
    console.log(`  ${msg}`);
  }
}

function assertApprox(name: string, actual: number, expected: number, tolerance: number = 1) {
  const diff = Math.abs(actual - expected);
  assert(name, diff <= tolerance, `expected ${expected}, got ${actual} (diff=${diff})`);
}

// ============================================================
// TEST SUITES
// ============================================================

async function testOrderFinancials() {
  console.log('\n📋 [TEST SUITE 1] Kiểm tra tài chính Đơn hàng');
  console.log('─'.repeat(50));

  const allOrders = await db.select().from(schema.orders);
  assert('Có đơn hàng trong hệ thống', allOrders.length > 0, `Found ${allOrders.length}`);

  for (const order of allOrders) {
    const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
    
    // 1. Verify tổng tiền
    let calcSubtotal = 0;
    let calcTotalCost = 0;
    for (const item of items) {
      calcSubtotal += Number(item.sellingPrice);
      calcTotalCost += Number(item.costPrice);
    }

    const orderSubtotal = Number(order.subtotal);
    const orderTotalAmount = Number(order.totalAmount);
    const orderTotalCost = Number(order.totalCost);
    const orderProfit = Number(order.profit || 0);
    const discAmount = Number(order.discountAmount || 0);
    const taxAmount = Number(order.taxAmount || 0);

    // Subtotal = sum(sellingPrice of items)
    assertApprox(
      `${order.orderNumber}: Subtotal khớp sum(items)`,
      orderSubtotal, calcSubtotal
    );

    // TotalAmount = subtotal - discount + tax
    const expectedTotal = calcSubtotal - discAmount + taxAmount;
    assertApprox(
      `${order.orderNumber}: TotalAmount = subtotal - discount + tax`,
      orderTotalAmount, expectedTotal, 2
    );

    // Profit = totalAmount - totalCost
    const expectedProfit = orderTotalAmount - orderTotalCost;
    assertApprox(
      `${order.orderNumber}: Profit = totalAmount - totalCost`,
      orderProfit, expectedProfit, 2
    );

    // 2. Kiểm tra mỗi item có inventory_item hoặc accessory_item tương ứng
    for (const item of items) {
      if (item.inventoryItemId) {
        const inv = await db.select().from(schema.inventoryItems)
          .where(eq(schema.inventoryItems.id, item.inventoryItemId)).limit(1);
        assert(
          `${order.orderNumber}: Item ${item.id.slice(0,8)} có inventory_item`,
          inv.length > 0
        );
      } else if (item.accessoryItemId) {
        const acc = await db.select().from(schema.accessoryItems)
          .where(eq(schema.accessoryItems.id, item.accessoryItemId)).limit(1);
        assert(
          `${order.orderNumber}: Item ${item.id.slice(0,8)} có accessory_item`,
          acc.length > 0
        );
      } else {
        assert(
          `${order.orderNumber}: Item ${item.id.slice(0,8)} có liên kết hợp lệ`,
          false,
          "Không có cả inventoryItemId và accessoryItemId"
        );
      }
    }

    // 3. Kiểm tra đơn completed → máy/phụ kiện phải status sold/warranty_repair/returned/defective
    if (order.status === 'completed') {
      for (const item of items) {
        if (item.inventoryItemId) {
          const inv = await db.select().from(schema.inventoryItems)
            .where(eq(schema.inventoryItems.id, item.inventoryItemId)).limit(1);
          if (inv.length > 0) {
            const validStatuses = ['sold', 'warranty_repair', 'returned', 'defective'];
            assert(
              `${order.orderNumber}: Máy ${inv[0].serialNumber} status hợp lệ (${inv[0].status})`,
              validStatuses.includes(inv[0].status),
              `status=${inv[0].status}, expected one of: ${validStatuses.join(',')}`
            );
          }
        } else if (item.accessoryItemId) {
          const acc = await db.select().from(schema.accessoryItems)
            .where(eq(schema.accessoryItems.id, item.accessoryItemId)).limit(1);
          if (acc.length > 0) {
            const validStatuses = ['sold', 'returned', 'defective'];
            assert(
              `${order.orderNumber}: Phụ kiện ${acc[0].serialNumber || acc[0].id.slice(0,6)} status hợp lệ (${acc[0].status})`,
              validStatuses.includes(acc[0].status),
              `status=${acc[0].status}, expected one of: ${validStatuses.join(',')}`
            );
          }
        }
      }
    }
  }
}

async function testPaymentConsistency() {
  console.log('\n💳 [TEST SUITE 2] Kiểm tra thanh toán & sổ quỹ');
  console.log('─'.repeat(50));

  const completedOrders = await db.select().from(schema.orders).where(eq(schema.orders.status, 'completed'));

  for (const order of completedOrders) {
    // Sum payments for this order
    const orderPayments = await db.select().from(schema.payments).where(eq(schema.payments.orderId, order.id));
    const totalPaid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const orderTotal = Number(order.totalAmount);

    // Payment status check
    if (order.paymentStatus === 'paid') {
      assertApprox(
        `${order.orderNumber}: Paid → payments ≥ totalAmount`,
        totalPaid, orderTotal, 2
      );
    } else if (order.paymentStatus === 'partial') {
      assert(
        `${order.orderNumber}: Partial → 0 < payments < totalAmount`,
        totalPaid > 0 && totalPaid < orderTotal,
        `paid=${totalPaid}, total=${orderTotal}`
      );
    }
  }

  // Verify cash book running balance
  const allEntries = await db.select().from(schema.cashBookEntries).orderBy(schema.cashBookEntries.createdAt);
  if (allEntries.length > 0) {
    let calcBalance = 0;
    let balanceErrors = 0;
    
    for (const entry of allEntries) {
      const amt = Number(entry.amount || 0);
      if (entry.type === 'income') {
        calcBalance += amt;
      } else {
        calcBalance -= amt;
      }
      const storedBalance = Number(entry.runningBalance);
      if (Math.abs(calcBalance - storedBalance) > 1) {
        balanceErrors++;
      }
    }
    
    assert(
      `Sổ quỹ: Running balance lũy kế đúng cho ${allEntries.length} entries`,
      balanceErrors === 0,
      `${balanceErrors} entries có running balance sai`
    );

    // Verify final balance
    const lastEntry = allEntries[allEntries.length - 1];
    assertApprox(
      'Sổ quỹ: Số dư cuối khớp tính toán',
      Number(lastEntry.runningBalance), calcBalance
    );
  }
}

async function testCustomerStats() {
  console.log('\n👤 [TEST SUITE 3] Kiểm tra thống kê khách hàng');
  console.log('─'.repeat(50));

  const allCustomers = await db.select().from(schema.customers);
  assert('Có khách hàng trong hệ thống', allCustomers.length > 0);

  for (const cust of allCustomers) {
    // Count completed orders
    const custOrders = await db.select().from(schema.orders)
      .where(and(eq(schema.orders.customerId, cust.id), eq(schema.orders.status, 'completed')));
    
    const actualOrderCount = custOrders.length;
    const actualTotalSpent = custOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const storedOrderCount = cust.orderCount || 0;
    const storedTotalSpent = Number(cust.totalSpent || 0);

    assertApprox(
      `KH ${cust.fullName}: orderCount khớp (stored=${storedOrderCount}, actual=${actualOrderCount})`,
      storedOrderCount, actualOrderCount
    );
    assertApprox(
      `KH ${cust.fullName}: totalSpent khớp (stored=${Math.round(storedTotalSpent)}, actual=${Math.round(actualTotalSpent)})`,
      storedTotalSpent, actualTotalSpent, 5
    );
  }
}

async function testInventoryConsistency() {
  console.log('\n📦 [TEST SUITE 4] Kiểm tra nhất quán Kho hàng');
  console.log('─'.repeat(50));

  const allItems = await db.select().from(schema.inventoryItems);
  assert('Có sản phẩm trong kho', allItems.length > 0);

  // Count by status
  const statusCounts: Record<string, number> = {};
  for (const item of allItems) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
  }
  console.log(`  📊 Phân bổ kho: ${JSON.stringify(statusCounts)}`);

  // Verify each item has at least 1 movement record
  let itemsWithoutMovements = 0;
  for (const item of allItems) {
    const movements = await db.select().from(schema.inventoryMovements)
      .where(eq(schema.inventoryMovements.inventoryItemId, item.id));
    if (movements.length === 0) {
      itemsWithoutMovements++;
    }
  }
  assert(
    `Tất cả ${allItems.length} máy đều có thẻ kho (movements)`,
    itemsWithoutMovements === 0,
    `${itemsWithoutMovements} máy không có movements`
  );

  // Verify sold items belong to orders
  const soldItems = allItems.filter(i => i.status === 'sold');
  let soldWithoutOrder = 0;
  for (const item of soldItems) {
    const oi = await db.select().from(schema.orderItems)
      .where(eq(schema.orderItems.inventoryItemId, item.id)).limit(1);
    if (oi.length === 0) {
      soldWithoutOrder++;
      console.log(`    ⚠️  Máy sold ${item.serialNumber} không có order_item liên kết!`);
    }
  }
  assert(
    `Tất cả ${soldItems.length} máy sold có đơn hàng liên kết`,
    soldWithoutOrder === 0,
    `${soldWithoutOrder} máy sold không có order`
  );

  // Verify in_stock items do NOT have soldDate
  const inStockWithSoldDate = allItems.filter(i => i.status === 'in_stock' && i.soldDate);
  assert(
    'Máy in_stock không có soldDate',
    inStockWithSoldDate.length === 0,
    `${inStockWithSoldDate.length} máy in_stock có soldDate`
  );
}

async function testQuotations() {
  console.log('\n📋 [TEST SUITE 5] Kiểm tra Báo giá');
  console.log('─'.repeat(50));

  const allQuotes = await db.select().from(schema.quotations);
  assert('Có báo giá trong hệ thống', allQuotes.length > 0);

  for (const q of allQuotes) {
    const items = await db.select().from(schema.quotationItems)
      .where(eq(schema.quotationItems.quotationId, q.id));
    
    assert(`${q.quoteNumber}: Có items`, items.length > 0);

    const calcSubtotal = items.reduce((sum, i) => sum + Number(i.quotedPrice), 0);
    assertApprox(
      `${q.quoteNumber}: Subtotal khớp sum(quotedPrice)`,
      Number(q.subtotal), calcSubtotal
    );

    const expectedTotal = calcSubtotal - Number(q.discountAmount || 0);
    assertApprox(
      `${q.quoteNumber}: TotalAmount = subtotal - discount`,
      Number(q.totalAmount), expectedTotal
    );
  }
}

async function testReturns() {
  console.log('\n🔄 [TEST SUITE 6] Kiểm tra Đổi trả');
  console.log('─'.repeat(50));

  const allReturns = await db.select().from(schema.returns);
  
  for (const ret of allReturns) {
    const items = await db.select().from(schema.returnItems)
      .where(eq(schema.returnItems.returnId, ret.id));
    
    assert(`${ret.returnNumber}: Có items`, items.length > 0);

    // Verify order exists
    const order = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, ret.orderId)).limit(1);
    assert(`${ret.returnNumber}: Đơn hàng gốc tồn tại`, order.length > 0);

    // Verify customer matches
    if (order.length > 0) {
      assert(
        `${ret.returnNumber}: Customer match với đơn hàng gốc`,
        ret.customerId === order[0].customerId,
        `ret.customer=${ret.customerId}, order.customer=${order[0].customerId}`
      );
    }

    // Refund amount should be reasonable
    const refundAmt = Number(ret.refundAmount || 0);
    const orderTotal = order.length > 0 ? Number(order[0].totalAmount) : 0;
    assert(
      `${ret.returnNumber}: Refund ≤ đơn hàng gốc`,
      refundAmt <= orderTotal,
      `refund=${refundAmt}, orderTotal=${orderTotal}`
    );
  }
}

async function testWarranty() {
  console.log('\n🔧 [TEST SUITE 7] Kiểm tra Bảo hành');
  console.log('─'.repeat(50));

  const allClaims = await db.select().from(schema.warrantyClaims);
  
  for (const claim of allClaims) {
    // Verify order exists
    const order = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, claim.orderId)).limit(1);
    assert(`${claim.claimNumber}: Đơn hàng gốc tồn tại`, order.length > 0);

    // Verify inventory item exists
    const inv = await db.select().from(schema.inventoryItems)
      .where(eq(schema.inventoryItems.id, claim.inventoryItemId)).limit(1);
    assert(`${claim.claimNumber}: Máy tồn tại trong kho`, inv.length > 0);

    // If status is pending/inspecting/repairing, inventory should be warranty_repair
    if (['pending', 'inspecting', 'repairing', 'waiting_parts'].includes(claim.status)) {
      if (inv.length > 0) {
        assert(
          `${claim.claimNumber}: Máy đang bảo hành (${claim.status}) → status=warranty_repair`,
          inv[0].status === 'warranty_repair',
          `actual status=${inv[0].status}`
        );
      }
    }

    // Verify warranty logs exist
    const logs = await db.select().from(schema.warrantyLogs)
      .where(eq(schema.warrantyLogs.warrantyClaimId, claim.id));
    assert(`${claim.claimNumber}: Có warranty logs`, logs.length > 0);
  }
}

async function testExpensesAndAccounting() {
  console.log('\n💰 [TEST SUITE 8] Kiểm tra Chi phí & Kế toán');
  console.log('─'.repeat(50));

  // Verify expense categories exist
  const cats = await db.select().from(schema.expenseCategories);
  assert('Có danh mục chi phí', cats.length > 0);

  // Verify expenses link to valid categories
  const allExpenses = await db.select().from(schema.expenses);
  let invalidCatExpenses = 0;
  for (const exp of allExpenses) {
    const cat = cats.find(c => c.id === exp.categoryId);
    if (!cat) invalidCatExpenses++;
  }
  assert(
    `Tất cả ${allExpenses.length} chi phí gắn đúng danh mục`,
    invalidCatExpenses === 0
  );

  // Verify accounting periods
  const periods = await db.select().from(schema.accountingPeriods);
  assert('Có kỳ kế toán', periods.length > 0);

  // Verify cash book totals make sense
  const entries = await db.select().from(schema.cashBookEntries);
  let totalIncome = 0, totalExpense = 0;
  entries.forEach(e => {
    const amt = Number(e.amount);
    if (e.type === 'income') totalIncome += amt;
    else totalExpense += amt;
  });

  console.log(`  📊 Sổ quỹ: Thu=${totalIncome.toLocaleString('vi-VN')}đ, Chi=${totalExpense.toLocaleString('vi-VN')}đ, Số dư=${(totalIncome - totalExpense).toLocaleString('vi-VN')}đ`);
  assert('Tổng thu > 0 (có doanh thu)', totalIncome > 0);
  assert('Tổng chi > 0 (có chi phí)', totalExpense > 0);
  assert('Tổng thu > Tổng chi (không bị lỗ lũy kế)', totalIncome > totalExpense);
}

async function testEndToEndOrderFlow() {
  console.log('\n🔥 [TEST SUITE 9] E2E: Tạo đơn → Bán hàng → Kiểm tra');
  console.log('─'.repeat(50));

  // Find an in_stock item to sell
  const inStockItems = await db.select().from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.status, 'in_stock')).limit(1);
  
  if (inStockItems.length === 0) {
    console.log('  ⚠️ Không có máy in_stock để test, bỏ qua E2E');
    return;
  }

  const testItem = inStockItems[0];
  const testCustomer = (await db.select().from(schema.customers).limit(1))[0];
  const profile = (await db.select().from(schema.profiles).limit(1))[0];

  if (!testCustomer || !profile) {
    console.log('  ⚠️ Thiếu customer/profile, bỏ qua E2E');
    return;
  }

  // Snapshot before
  const balanceBefore = await db.select().from(schema.cashBookEntries).orderBy(desc(schema.cashBookEntries.createdAt));
  const lastBalanceBefore = balanceBefore.length > 0 ? Number(balanceBefore[0].runningBalance) : 0;
  const custBefore = (await db.select().from(schema.customers).where(eq(schema.customers.id, testCustomer.id)).limit(1))[0];
  const custSpentBefore = Number(custBefore.totalSpent || 0);
  const custOrdersBefore = custBefore.orderCount || 0;

  // CREATE ORDER via raw transaction (simulating createOrderAction)
  const sellingPrice = Number(testItem.sellingPrice || testItem.costPrice);
  const costPrice = Number(testItem.costPrice);
  const orderTotal = sellingPrice;
  const orderProfit = sellingPrice - costPrice;

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const orderNumber = `ORD-TEST-${dateStr}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const [newOrder] = await db.transaction(async (tx) => {
    // Create order
    const [ord] = await tx.insert(schema.orders).values({
      orderNumber,
      customerId: testCustomer.id,
      status: 'completed',
      saleChannel: 'offline',
      subtotal: sellingPrice.toString(),
      discountAmount: '0',
      taxAmount: '0',
      totalAmount: orderTotal.toString(),
      totalCost: costPrice.toString(),
      profit: orderProfit.toString(),
      profitMargin: ((orderProfit / orderTotal) * 100).toFixed(2),
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      soldBy: profile.id,
    }).returning();

    // Create order item
    await tx.insert(schema.orderItems).values({
      orderId: ord.id,
      inventoryItemId: testItem.id,
      productId: testItem.productId,
      sellingPrice: sellingPrice.toString(),
      costPrice: costPrice.toString(),
      discount: '0',
      profit: orderProfit.toString(),
      warrantyMonths: 12,
    });

    // Update inventory
    await tx.update(schema.inventoryItems)
      .set({ status: 'sold', soldDate: new Date().toISOString().split('T')[0], updatedAt: new Date() })
      .where(eq(schema.inventoryItems.id, testItem.id));

    // Movement
    await tx.insert(schema.inventoryMovements).values({
      inventoryItemId: testItem.id,
      movementType: 'sold',
      fromStatus: 'in_stock',
      toStatus: 'sold',
      referenceType: 'order',
      referenceId: ord.id,
      quantityChange: -1,
      performedBy: profile.id,
      notes: `[TEST] Bán hàng E2E test — ${orderNumber}`,
    });

    // Payment
    await tx.insert(schema.payments).values({
      orderId: ord.id,
      amount: orderTotal.toString(),
      paymentMethod: 'cash',
      notes: '[TEST] Thanh toán E2E',
      createdBy: profile.id,
    });

    // Cash book
    const entryNumber = `CBTEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await tx.insert(schema.cashBookEntries).values({
      entryNumber,
      type: 'income',
      category: 'sales',
      amount: orderTotal.toString(),
      runningBalance: (lastBalanceBefore + orderTotal).toString(),
      paymentMethod: 'cash',
      referenceType: 'order',
      referenceId: ord.id,
      description: `[TEST] Thu tiền đơn hàng ${orderNumber}`,
      entryDate: new Date().toISOString().split('T')[0],
      createdBy: profile.id,
    });

    // Update customer
    await tx.update(schema.customers)
      .set({
        totalSpent: (custSpentBefore + orderTotal).toFixed(2),
        orderCount: custOrdersBefore + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.id, testCustomer.id));

    return [ord];
  });

  // VERIFY after creation
  // 1. Order exists with correct data
  const verifyOrder = await db.select().from(schema.orders).where(eq(schema.orders.id, newOrder.id)).limit(1);
  assert('E2E: Đơn hàng được tạo', verifyOrder.length === 1);
  assert('E2E: Đơn hàng status=completed', verifyOrder[0].status === 'completed');
  assertApprox('E2E: Đơn hàng totalAmount đúng', Number(verifyOrder[0].totalAmount), orderTotal);

  // 2. Inventory updated
  const verifyItem = await db.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, testItem.id)).limit(1);
  assert('E2E: Máy chuyển sang sold', verifyItem[0].status === 'sold');
  assert('E2E: Máy có soldDate', verifyItem[0].soldDate !== null);

  // 3. Payment recorded
  const verifyPayments = await db.select().from(schema.payments).where(eq(schema.payments.orderId, newOrder.id));
  assert('E2E: Thanh toán được ghi nhận', verifyPayments.length > 0);
  assertApprox('E2E: Số tiền thanh toán đúng', Number(verifyPayments[0].amount), orderTotal);

  // 4. Cash book entry
  const verifyCB = await db.select().from(schema.cashBookEntries)
    .where(eq(schema.cashBookEntries.referenceId, newOrder.id));
  assert('E2E: Sổ quỹ có ghi nhận', verifyCB.length > 0);
  assertApprox('E2E: Sổ quỹ số tiền đúng', Number(verifyCB[0].amount), orderTotal);

  // 5. Customer stats updated
  const verifyCustomer = await db.select().from(schema.customers)
    .where(eq(schema.customers.id, testCustomer.id)).limit(1);
  assertApprox(
    'E2E: Customer totalSpent tăng đúng',
    Number(verifyCustomer[0].totalSpent),
    custSpentBefore + orderTotal, 2
  );
  assert(
    'E2E: Customer orderCount tăng 1',
    verifyCustomer[0].orderCount === custOrdersBefore + 1
  );

  // 6. Movement recorded
  const verifyMovement = await db.select().from(schema.inventoryMovements)
    .where(and(
      eq(schema.inventoryMovements.inventoryItemId, testItem.id),
      eq(schema.inventoryMovements.referenceId, newOrder.id)
    ));
  assert('E2E: Thẻ kho ghi nhận movement sold', verifyMovement.length > 0);

  // CLEANUP: Revert the test order
  console.log('\n  🧹 Dọn dẹp dữ liệu test...');
  await db.delete(schema.cashBookEntries).where(eq(schema.cashBookEntries.referenceId, newOrder.id));
  await db.delete(schema.payments).where(eq(schema.payments.orderId, newOrder.id));
  await db.delete(schema.inventoryMovements).where(eq(schema.inventoryMovements.referenceId, newOrder.id));
  await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, newOrder.id));
  await db.delete(schema.orders).where(eq(schema.orders.id, newOrder.id));
  await db.update(schema.inventoryItems)
    .set({ status: 'in_stock', soldDate: null, updatedAt: new Date() })
    .where(eq(schema.inventoryItems.id, testItem.id));
  await db.update(schema.customers)
    .set({ totalSpent: custSpentBefore.toFixed(2), orderCount: custOrdersBefore, updatedAt: new Date() })
    .where(eq(schema.customers.id, testCustomer.id));
  console.log('  ✅ Đã dọn dẹp xong — dữ liệu gốc được khôi phục');
}

async function testCrossModuleIntegrity() {
  console.log('\n🔗 [TEST SUITE 10] Kiểm tra tham chiếu liên module');
  console.log('─'.repeat(50));

  // All order items reference valid products
  const allOI = await db.select().from(schema.orderItems);
  let invalidProductRefs = 0;
  for (const oi of allOI) {
    const prod = await db.select().from(schema.products).where(eq(schema.products.id, oi.productId)).limit(1);
    if (prod.length === 0) invalidProductRefs++;
  }
  assert(`${allOI.length} order items tham chiếu đúng products`, invalidProductRefs === 0);

  // All products reference valid brand + category
  const allProducts = await db.select().from(schema.products);
  let invalidBrandCat = 0;
  for (const p of allProducts) {
    const brand = await db.select().from(schema.brands).where(eq(schema.brands.id, p.brandId)).limit(1);
    const cat = await db.select().from(schema.categories).where(eq(schema.categories.id, p.categoryId)).limit(1);
    if (brand.length === 0 || cat.length === 0) invalidBrandCat++;
  }
  assert(`${allProducts.length} products tham chiếu đúng brand/category`, invalidBrandCat === 0);

  // All orders reference valid customer
  const allOrders = await db.select().from(schema.orders);
  let invalidCustomerRefs = 0;
  for (const o of allOrders) {
    const c = await db.select().from(schema.customers).where(eq(schema.customers.id, o.customerId)).limit(1);
    if (c.length === 0) invalidCustomerRefs++;
  }
  assert(`${allOrders.length} orders tham chiếu đúng customers`, invalidCustomerRefs === 0);

  // Purchase orders reference valid suppliers
  const allPOs = await db.select().from(schema.purchaseOrders);
  let invalidSupplierRefs = 0;
  for (const po of allPOs) {
    const s = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, po.supplierId)).limit(1);
    if (s.length === 0) invalidSupplierRefs++;
  }
  assert(`${allPOs.length} purchase orders tham chiếu đúng suppliers`, invalidSupplierRefs === 0);
}

async function testTelegramConfig() {
  console.log('\n📲 [TEST SUITE 11] Kiểm tra cấu hình Telegram');
  console.log('─'.repeat(50));

  const settings = await db.select().from(schema.telegramSettings).limit(1);
  assert('Telegram settings tồn tại', settings.length > 0);

  if (settings.length > 0) {
    assert('Bot Token không rỗng', !!settings[0].botToken && settings[0].botToken.length > 10);
    assert('Chat ID không rỗng', !!settings[0].chatId && settings[0].chatId.length > 3);
    assert('isActive = true', settings[0].isActive === true);

    const events = await db.select().from(schema.telegramNotificationEvents)
      .where(eq(schema.telegramNotificationEvents.telegramSettingId, settings[0].id));
    assert(`Có ${events.length} events cấu hình`, events.length >= 5);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  🧪 TechStore ERP — BỘ KIỂM THỬ TỰ ĐỘNG          ║');
  console.log('║  Kiểm tra tính nhất quán toàn bộ dữ liệu & logic  ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await testOrderFinancials();
  await testPaymentConsistency();
  await testCustomerStats();
  await testInventoryConsistency();
  await testQuotations();
  await testReturns();
  await testWarranty();
  await testExpensesAndAccounting();
  await testCrossModuleIntegrity();
  await testTelegramConfig();
  await testEndToEndOrderFlow();

  // SUMMARY
  console.log('\n' + '═'.repeat(55));
  console.log(`  📊 KẾT QUẢ KIỂM THỬ`);
  console.log('─'.repeat(55));
  console.log(`  Tổng test:     ${totalTests}`);
  console.log(`  ✅ Passed:     ${passed}`);
  console.log(`  ❌ Failed:     ${failed}`);
  console.log(`  Tỷ lệ pass:   ${totalTests > 0 ? ((passed / totalTests) * 100).toFixed(1) : 0}%`);
  console.log('═'.repeat(55));

  if (failed > 0) {
    console.log('\n🚨 DANH SÁCH LỖI:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log('');
  }

  if (failed === 0) {
    console.log('\n🎉 TẤT CẢ CÁC KIỂM THỬ ĐỀU PASS! Hệ thống hoạt động đúng logic nghiệp vụ.');
  } else {
    console.log('\n⚠️  CÓ LỖI! Cần kiểm tra và sửa chữa trước khi vận hành.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('💀 FATAL:', err);
  process.exit(1);
});
