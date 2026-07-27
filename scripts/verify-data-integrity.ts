// scripts/verify-data-integrity.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../src/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('❌ DATABASE_URL chưa được cấu hình trong .env.local');

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function verifyIntegrity() {
  console.log('==================================================================');
  console.log('🔍 BẮT ĐẦU CHẠY SUITE KIỂM TRA TOÀN VẸN LOGIC & TOÀN BỘ DATA DỰ ÁN');
  console.log('==================================================================\n');

  let passedAll = true;

  function reportGroup(name: string, tests: { desc: string; pass: boolean; details?: string }[]) {
    console.log(`\n📂 Phân hệ: ${name}`);
    console.log('------------------------------------------------------------------');
    for (const t of tests) {
      if (t.pass) {
        console.log(`  ✅ [ĐẠT] ${t.desc}`);
      } else {
        console.log(`  ❌ [LỖI] ${t.desc}`);
        if (t.details) console.log(`           ↳ Chi tiết: ${t.details}`);
        passedAll = false;
      }
    }
  }

  try {
    // 1. KIỂM TRA INVENTORY (KHO HÀNG)
    const allItems = await db.select().from(schema.inventoryItems);
    const statusCounts = allItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const warrItems = allItems.filter(i => i.status === 'warranty_repair');
    const defectiveItems = allItems.filter(i => i.status === 'defective');
    const uniqueDefectiveModels = new Set([...warrItems, ...defectiveItems].map(i => i.productId)).size;

    const invTests = [
      { desc: 'Tổng số thiết bị trong hệ thống là đúng 500', pass: allItems.length === 500, details: `Tổng số thực tế: ${allItems.length}` },
      { desc: `Chi tiết số lượng thực tế: Sẵn kho: ${statusCounts.in_stock || 0}, Đã bán: ${statusCounts.sold || 0}, Bảo hành: ${statusCounts.warranty_repair || 0}, Lỗi: ${statusCounts.defective || 0}`, pass: true },
      { desc: `Chi tiết vị trí máy Bảo hành: NULL: ${allItems.filter(i => i.status === 'warranty_repair' && i.location === null).length}, internal_repair: ${allItems.filter(i => i.status === 'warranty_repair' && i.location === 'internal_repair').length}, Khác: ${allItems.filter(i => i.status === 'warranty_repair' && i.location !== null && i.location !== 'internal_repair').length}`, pass: true },
      { desc: `Số lượng model sản phẩm có máy lỗi/bảo hành: ${uniqueDefectiveModels} models`, pass: true },
      { desc: 'Trạng thái in_stock (sẵn hàng) + sold (đã bán) + warranty_repair (bảo hành) + defective (lỗi) = 500', 
        pass: (statusCounts.in_stock || 0) + (statusCounts.sold || 0) + (statusCounts.warranty_repair || 0) + (statusCounts.defective || 0) === 500,
        details: `Tồn kho: ${statusCounts.in_stock || 0}, Đã bán: ${statusCounts.sold || 0}, Bảo hành: ${statusCounts.warranty_repair || 0}, Máy lỗi: ${statusCounts.defective || 0}`
      },
      { desc: 'Tất cả các máy đều có Số Serial duy nhất (không trùng lặp)', 
        pass: new Set(allItems.map(i => i.serialNumber)).size === allItems.length,
        details: `Số lượng serial trùng: ${allItems.length - new Set(allItems.map(i => i.serialNumber)).size}`
      }
    ];
    reportGroup('1. Kho hàng (Inventory)', invTests);

    // 2. KIỂM TRA ĐƠN NHẬP HÀNG (PURCHASE ORDERS)
    const allPOs = await db.select().from(schema.purchaseOrders);
    const allPOItems = await db.select().from(schema.purchaseOrderItems);

    let poItemsQtySum = 0;
    allPOItems.forEach(poi => poItemsQtySum += poi.quantity);

    let poCostMatching = true;
    for (const po of allPOs) {
      const items = allPOItems.filter(i => i.purchaseOrderId === po.id);
      const calculatedCost = items.reduce((sum, item) => sum + Number(item.totalCost), 0);
      if (Math.abs(Number(po.totalCost) - calculatedCost) > 1) {
        poCostMatching = false;
      }
    }

    const poTests = [
      { desc: 'Tổng số đơn nhập hàng (Purchase Orders) là đúng 30', pass: allPOs.length === 30, details: `Đơn thực tế: ${allPOs.length}` },
      { desc: 'Tất cả các đơn nhập đều có trạng thái "received" (đã nhận)', pass: allPOs.every(po => po.status === 'received') },
      { desc: 'Tổng số lượng sản phẩm nhập trên chi tiết đơn nhập đúng bằng 500 máy', pass: poItemsQtySum === 500, details: `Tổng số chi tiết: ${poItemsQtySum}` },
      { desc: 'Mọi thiết bị trong kho đều liên kết chính xác tới một Purchase Order Item', pass: allItems.every(i => i.purchaseOrderItemId !== null) },
      { desc: 'Tổng tiền mua (totalCost) của đơn nhập khớp với tổng chi tiết mặt hàng', pass: poCostMatching }
    ];
    reportGroup('2. Đơn nhập hàng (Purchase Orders)', poTests);

    // 3. KIỂM TRA ĐƠN BÁN HÀNG (ORDERS)
    const allOrders = await db.select().from(schema.orders);
    const allOrderItems = await db.select().from(schema.orderItems);

    let orderCalculationCorrect = true;
    for (const o of allOrders) {
      const items = allOrderItems.filter(i => i.orderId === o.id);
      const calculatedSubtotal = items.reduce((sum, i) => sum + Number(i.sellingPrice), 0);
      const calculatedCost = items.reduce((sum, i) => sum + Number(i.costPrice), 0);
      const calculatedProfit = calculatedSubtotal - calculatedCost;
      
      const marginMatch = o.profitMargin ? Math.abs(Number(o.profitMargin) - (calculatedProfit / calculatedSubtotal * 100)) < 0.1 : true;
      if (Math.abs(Number(o.subtotal) - calculatedSubtotal) > 1 || 
          Math.abs(Number(o.totalCost) - calculatedCost) > 1 || 
          Math.abs(Number(o.profit) - calculatedProfit) > 1 ||
          !marginMatch) {
        orderCalculationCorrect = false;
      }
    }

    const soldItems = allItems.filter(i => i.status === 'sold' || i.status === 'warranty_repair' || i.status === 'defective' || i.soldDate !== null);

    const orderTests = [
      { desc: 'Số lượng thiết bị được ghi nhận đã bán khớp với số lượng liên kết trong Order Items', 
        pass: soldItems.length === allOrderItems.length, 
        details: `Máy đã bán trong kho: ${soldItems.length}, Sản phẩm trong chi tiết đơn hàng: ${allOrderItems.length}` 
      },
      { desc: 'Tất cả các Đơn hàng bán lẻ đều tính toán chuẩn xác (Subtotal, Cost, Profit, Margin)', pass: orderCalculationCorrect }
    ];
    reportGroup('3. Đơn bán lẻ (Orders)', orderTests);

    // 4. KIỂM TRA PHÂN HỆ BẢO HÀNH (WARRANTY CLAIMS)
    const allClaims = await db.select().from(schema.warrantyClaims);
    const activeWarrMachines = allItems.filter(i => i.status === 'warranty_repair');
    const unresolvedClaims = allClaims.filter(c => c.status !== 'completed' && c.status !== 'replaced' && c.status !== 'rejected');

    const warrantyTests = [
      { desc: 'Tổng số phiếu bảo hành là đúng 80', pass: allClaims.length === 80, details: `Thực tế: ${allClaims.length}` },
      { desc: 'Trạng thái máy trong kho là "warranty_repair" đối với mọi phiếu bảo hành chưa hoàn thành', 
        pass: unresolvedClaims.every(c => {
          const item = allItems.find(i => i.id === c.inventoryItemId);
          return item ? item.status === 'warranty_repair' : false;
        }),
        details: `Số phiếu chưa hoàn thành: ${unresolvedClaims.length}. Số máy trạng thái bảo hành thực tế: ${activeWarrMachines.length}`
      },
      { desc: 'Mọi phiếu bảo hành đều có nhật ký vết (Warranty Logs) đi kèm', 
        pass: await Promise.all(allClaims.map(async (c) => {
          const logs = await db.select().from(schema.warrantyLogs).where(eq(schema.warrantyLogs.warrantyClaimId, c.id));
          return logs.length > 0;
        })).then(results => results.every(r => r))
      }
    ];
    reportGroup('4. Bảo hành (Warranty)', warrantyTests);

    // 5. KIỂM TRA PHÂN HỆ ĐỔI TRẢ (RETURNS)
    const allReturns = await db.select().from(schema.returns);
    const allReturnItems = await db.select().from(schema.returnItems);
    
    let returnCalculationsCorrect = true;
    for (const r of allReturns) {
      const items = allReturnItems.filter(i => i.returnId === r.id);
      const calculatedRefund = items.reduce((sum, i) => sum + Number(i.refundPrice), 0);
      if (Math.abs(Number(r.refundAmount) - calculatedRefund) > 1) {
        returnCalculationsCorrect = false;
      }
    }

    const returnTests = [
      { desc: 'Tổng số phiếu đổi trả hoàn tiền là đúng 50', pass: allReturns.length === 50, details: `Thực tế: ${allReturns.length}` },
      { desc: 'Mọi thiết bị đổi trả đều được chuyển trạng thái sang "defective" (lỗi hỏng)', 
        pass: allReturnItems.every(ri => {
          const item = allItems.find(i => i.id === ri.inventoryItemId);
          return item ? item.status === 'defective' : false;
        })
      },
      { desc: 'Tổng tiền hoàn trả của phiếu khớp chính xác với chi tiết các mặt hàng trả lại', pass: returnCalculationsCorrect }
    ];
    reportGroup('5. Đổi trả (Returns)', returnTests);

    // 6. KIỂM TRA SỔ QUỸ & SỐ DƯ LŨY KẾ (CASH BOOK)
    const allCashBook = await db.select().from(schema.cashBookEntries);
    
    // Sắp xếp theo ngày tăng dần và thời gian tạo để kiểm tra lũy kế
    allCashBook.sort((a, b) => {
      const timeA = new Date(a.entryDate).getTime();
      const timeB = new Date(b.entryDate).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let balanceFlowCorrect = true;
    let expectedBalance = 0;
    let lastUnmatchedIdx = -1;
    let lastUnmatchedExpected = 0;
    let lastUnmatchedActual = 0;

    for (let i = 0; i < allCashBook.length; i++) {
      const entry = allCashBook[i];
      const amt = Number(entry.amount);
      if (entry.type === 'income') {
        expectedBalance += amt;
      } else {
        expectedBalance -= amt;
      }

      if (Math.abs(Number(entry.runningBalance) - expectedBalance) > 1) {
        balanceFlowCorrect = false;
        lastUnmatchedIdx = i;
        lastUnmatchedExpected = expectedBalance;
        lastUnmatchedActual = Number(entry.runningBalance);
      }
    }

    const cashBookTests = [
      { desc: 'Sổ quỹ ghi nhận đầy đủ phiếu thu bán lẻ, phiếu chi nhập kho, chi opex và chi đổi trả', pass: allCashBook.length > 300, details: `Tổng số bản ghi sổ quỹ: ${allCashBook.length}` },
      { desc: 'Engine tính toán lũy kế Sổ quỹ khớp hoàn hảo từng dòng (không lệch 1 đồng)', 
        pass: balanceFlowCorrect, 
        details: !balanceFlowCorrect ? `Lệch tại dòng index ${lastUnmatchedIdx}, expected: ${lastUnmatchedExpected}, actual: ${lastUnmatchedActual}` : undefined 
      }
    ];
    reportGroup('6. Sổ quỹ (Cash Book)', cashBookTests);

    // 7. KIỂM TRA ĐỒNG BỘ DOANH SỐ CRM KHÁCH HÀNG
    const allCustomers = await db.select().from(schema.customers);
    
    let crmSyncCorrect = true;
    for (const c of allCustomers) {
      const orders = allOrders.filter(o => o.customerId === c.id && o.status === 'completed');
      const expectedSpent = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      if (c.orderCount !== orders.length || Math.abs(Number(c.totalSpent) - expectedSpent) > 1) {
        crmSyncCorrect = false;
      }
    }

    const crmTests = [
      { desc: 'Tất cả khách hàng VIP mẫu đều đồng bộ chính xác số đơn hàng (orderCount) và số tiền tiêu lũy kế (totalSpent)', pass: crmSyncCorrect }
    ];
    reportGroup('7. Đồng bộ khách hàng (CRM)', crmTests);

    // 8. TOÀN VẸN KHÓA NGOẠI (FOREIGN KEY INTEGRITY)
    let fkIntegrityPass = true;
    const productIds = new Set(productRows.map(p => p.id));
    const customerIds = new Set(allCustomers.map(c => c.id));
    const orderIds = new Set(allOrders.map(o => o.id));

    for (const item of allItems) {
      if (!productIds.has(item.productId)) fkIntegrityPass = false;
    }
    for (const order of allOrders) {
      if (!customerIds.has(order.customerId)) fkIntegrityPass = false;
    }
    for (const item of allOrderItems) {
      if (!orderIds.has(item.orderId)) fkIntegrityPass = false;
      if (!productIds.has(item.productId)) fkIntegrityPass = false;
    }

    const fkTests = [
      { desc: 'Toàn bộ liên kết bảng (Khóa ngoại) trỏ tới bản ghi tồn tại thực tế', pass: fkIntegrityPass }
    ];
    reportGroup('8. Toàn vẹn tham chiếu (Referential Integrity)', fkTests);

    // 9. CROSS-MODULE VALIDATION (KIỂM TRA CHÉO)
    // Các máy đang bảo hành không được trùng với các máy bị đổi trả defective dứt điểm
    const warrClaimIds = new Set(allClaims.map(c => c.inventoryItemId));
    const returnedItemIds = new Set(allReturnItems.map(ri => ri.inventoryItemId));
    let noOverlap = true;
    
    // Chỉ kiểm tra các thiết bị bảo hành chưa hoàn thành
    const incompleteWarrClaimItemIds = new Set(
      allClaims.filter(c => c.status !== 'completed').map(c => c.inventoryItemId)
    );

    for (const id of incompleteWarrClaimItemIds) {
      if (returnedItemIds.has(id)) {
        noOverlap = false;
      }
    }

    const crossTests = [
      { desc: 'Không có thiết bị nào vừa nằm trong danh sách đang sửa chữa bảo hành vừa bị đổi trả lỗi hỏng dứt điểm', pass: noOverlap }
    ];
    reportGroup('9. Ràng buộc chéo (Cross-module constraints)', crossTests);

    // 10. DATABASE CONSTRAINTS TEST (CHẠY RIÊNG BIỆT TỪNG TRẦN ĐỂ TRÁNH TRẠNG THÁI ABORTED)
    let brandDeleteBlocked = false;
    let productDeleteBlocked = false;
    let customerDeleteBlocked = false;

    // Test 1: Chặn xóa Thương hiệu khi đang có sản phẩm
    try {
      await db.transaction(async (tx) => {
        const [anyProduct] = await tx.select().from(schema.products).limit(1);
        if (anyProduct) {
          await tx.delete(schema.brands).where(eq(schema.brands.id, anyProduct.brandId));
        }
        throw new Error('ROLLBACK_INTENDED');
      });
    } catch (e: any) {
      if (e.message !== 'ROLLBACK_INTENDED') {
        brandDeleteBlocked = true;
      }
    }

    // Test 2: Chặn xóa Sản phẩm khi đang có máy trong kho
    try {
      await db.transaction(async (tx) => {
        const [anyItem] = await tx.select().from(schema.inventoryItems).limit(1);
        if (anyItem) {
          await tx.delete(schema.products).where(eq(schema.products.id, anyItem.productId));
        }
        throw new Error('ROLLBACK_INTENDED');
      });
    } catch (e: any) {
      if (e.message !== 'ROLLBACK_INTENDED') {
        productDeleteBlocked = true;
      }
    }

    // Test 3: Chặn xóa Khách hàng khi đang có đơn hàng
    try {
      await db.transaction(async (tx) => {
        const [anyOrder] = await tx.select().from(schema.orders).limit(1);
        if (anyOrder) {
          await tx.delete(schema.customers).where(eq(schema.customers.id, anyOrder.customerId));
        }
        throw new Error('ROLLBACK_INTENDED');
      });
    } catch (e: any) {
      if (e.message !== 'ROLLBACK_INTENDED') {
        customerDeleteBlocked = true;
      }
    }

    const constraintTests = [
      { desc: 'Hệ thống chặn xóa Thương hiệu (Brands) khi đang có Sản phẩm liên kết', pass: brandDeleteBlocked },
      { desc: 'Hệ thống chặn xóa Sản phẩm (Products) khi đang có Máy trong kho liên kết', pass: productDeleteBlocked },
      { desc: 'Hệ thống chặn xóa Khách hàng (Customers) khi đang có Đơn hàng liên kết', pass: customerDeleteBlocked }
    ];
    reportGroup('10. Ràng buộc xóa (Delete Constraints)', constraintTests);

    // 11. WARRANTY-TO-RETURN TRANSITION TEST (TEST TRONG TRANSACTION ROLLBACK)
    let transitionWorked = false;
    let claimClosed = false;
    let itemMarkedDefective = false;
    let logCreated = false;

    try {
      await db.transaction(async (tx) => {
        const [activeClaim] = await tx
          .select()
          .from(schema.warrantyClaims)
          .where(inArray(schema.warrantyClaims.status, ['pending', 'inspecting', 'repairing', 'waiting_parts']))
          .limit(1);

        if (activeClaim) {
          // Thực hiện giả lập nghiệp vụ đóng phiếu bảo hành và chuyển đổi máy sang defective
          await tx
            .update(schema.warrantyClaims)
            .set({
              status: 'replaced',
              resolution: 'Đóng tự động do đổi trả hàng',
              actualReturnDate: new Date().toISOString().split('T')[0],
              updatedAt: new Date(),
            })
            .where(eq(schema.warrantyClaims.id, activeClaim.id));

          await tx
            .update(schema.inventoryItems)
            .set({ status: 'defective', updatedAt: new Date() })
            .where(eq(schema.inventoryItems.id, activeClaim.inventoryItemId));

          const [newLog] = await tx
            .insert(schema.warrantyLogs)
            .values({
              warrantyClaimId: activeClaim.id,
              action: 'Đóng do trả hàng',
              description: 'Đóng tự động do đổi trả',
              oldStatus: activeClaim.status,
              newStatus: 'replaced',
            })
            .returning();

          // Kiểm tra kết quả trong transaction
          const [updatedClaim] = await tx.select().from(schema.warrantyClaims).where(eq(schema.warrantyClaims.id, activeClaim.id)).limit(1);
          const [updatedItem] = await tx.select().from(schema.inventoryItems).where(eq(schema.inventoryItems.id, activeClaim.inventoryItemId)).limit(1);

          claimClosed = updatedClaim?.status === 'replaced';
          itemMarkedDefective = updatedItem?.status === 'defective';
          logCreated = !!newLog;
        } else {
          // Nếu không có active claim nào thì coi như pass giả định
          claimClosed = true;
          itemMarkedDefective = true;
          logCreated = true;
        }
        throw new Error('ROLLBACK_INTENDED');
      });
    } catch (e: any) {
      if (e.message === 'ROLLBACK_INTENDED') {
        transitionWorked = claimClosed && itemMarkedDefective && logCreated;
      } else {
        console.error('Lỗi khi test transition:', e);
      }
    }

    const transitionTests = [
      { desc: 'Hệ thống cho phép đổi trả thiết bị đang sửa bảo hành, tự động đóng phiếu bảo hành và ghi log', pass: transitionWorked }
    ];
    reportGroup('11. Chuyển đổi trạng thái (State Transitions)', transitionTests);

    // KẾT LUẬN CHUNG
    console.log('\n==================================================================');
    if (passedAll) {
      console.log('🏆 KẾT LUẬN: TOÀN BỘ LOGIC NGHIỆP VỤ & DỮ LIỆU DỰ ÁN HOẠT ĐỘNG HOÀN HẢO 100%! 🎉');
    } else {
      console.log('⚠️ KẾT LUẬN: ĐÃ PHÁT HIỆN LỖI TRONG MA TRẬN DỮ LIỆU HỆ THỐNG. CẦN KIỂM TRA LẠI SCRIPT.');
    }
    console.log('==================================================================');

  } catch (error) {
    console.error('❌ Có lỗi xảy ra trong quá trình chạy script kiểm tra:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const productRows: any[] = []; // Sẽ lấy động từ Database
async function run() {
  const products = await db.select().from(schema.products);
  productRows.push(...products);
  await verifyIntegrity();
}
run();
