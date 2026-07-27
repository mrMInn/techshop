"use server";

import { db, recalculateRunningBalances } from "@/lib/db";
import { after } from "next/server";
import { 
  warrantyClaims, 
  warrantyLogs, 
  orders, 
  customers, 
  inventoryItems, 
  products,
  profiles,
  inventoryMovements,
  orderItems,
  cashBookEntries
} from "@/lib/db/schema";
import { eq, desc, and, asc } from "drizzle-orm";
import { sendTelegramNotification } from "@/lib/telegram/notifier";
import { invalidateDashboardCache } from "@/lib/cache";

export async function getCompletedOrdersForSelect() {
  try {
    const list = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.status, "completed"))
      .orderBy(desc(orders.createdAt));
    return list;
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn hàng:", error);
    return [];
  }
}

export async function getEligibleOrderItemsForWarranty(orderId: string) {
  try {
    const items = await db
      .select({
        orderItemId: orderItems.id,
        inventoryItemId: inventoryItems.id,
        productId: products.id,
        productName: products.name,
        serialNumber: inventoryItems.serialNumber,
        customerId: orders.customerId,
        purchaseDate: orders.createdAt,
        warrantyMonths: orderItems.warrantyMonths,
        sellingPrice: orderItems.sellingPrice,
        costPrice: orderItems.costPrice,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(inventoryItems, eq(orderItems.inventoryItemId, inventoryItems.id))
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .where(
        and(
          eq(orderItems.orderId, orderId),
          eq(inventoryItems.status, "sold")
        )
      );
    return items;
  } catch (error) {
    console.error("Lỗi lấy chi tiết máy trong đơn hàng:", error);
    return [];
  }
}

export async function getAvailableReplacementItems(productId: string) {
  try {
    const items = await db
      .select({
        id: inventoryItems.id,
        serialNumber: inventoryItems.serialNumber,
        condition: inventoryItems.condition,
        sellingPrice: inventoryItems.sellingPrice,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.productId, productId),
          eq(inventoryItems.status, "in_stock")
        )
      )
      .orderBy(inventoryItems.serialNumber);
    return items;
  } catch (error) {
    console.error("Lỗi lấy danh sách máy thay thế sẵn kho:", error);
    return [];
  }
}

// 1. Lấy danh sách bảo hành
export async function getWarrantyClaims() {
  try {
    const list = await db
      .select({
        id: warrantyClaims.id,
        claimNumber: warrantyClaims.claimNumber,
        status: warrantyClaims.status,
        issueDescription: warrantyClaims.issueDescription,
        isUnderWarranty: warrantyClaims.isUnderWarranty,
        receivedDate: warrantyClaims.receivedDate,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        serialNumber: inventoryItems.serialNumber,
        productName: products.name,
      })
      .from(warrantyClaims)
      .innerJoin(customers, eq(warrantyClaims.customerId, customers.id))
      .innerJoin(inventoryItems, eq(warrantyClaims.inventoryItemId, inventoryItems.id))
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .orderBy(desc(warrantyClaims.createdAt));

    return list;
  } catch (error) {
    console.error("Lỗi lấy danh sách bảo hành:", error);
    return [];
  }
}

// 2. Lấy chi tiết bảo hành
export async function getWarrantyClaimDetail(id: string) {
  try {
    const claim = await db
      .select({
        id: warrantyClaims.id,
        claimNumber: warrantyClaims.claimNumber,
        status: warrantyClaims.status,
        issueDescription: warrantyClaims.issueDescription,
        diagnosis: warrantyClaims.diagnosis,
        resolution: warrantyClaims.resolution,
        repairCost: warrantyClaims.repairCost,
        isUnderWarranty: warrantyClaims.isUnderWarranty,
        warrantyEndDate: warrantyClaims.warrantyEndDate,
        receivedDate: warrantyClaims.receivedDate,
        expectedReturnDate: warrantyClaims.expectedReturnDate,
        actualReturnDate: warrantyClaims.actualReturnDate,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        serialNumber: inventoryItems.serialNumber,
        productName: products.name,
        productId: products.id,
        orderNumber: orders.orderNumber,
      })
      .from(warrantyClaims)
      .innerJoin(customers, eq(warrantyClaims.customerId, customers.id))
      .innerJoin(inventoryItems, eq(warrantyClaims.inventoryItemId, inventoryItems.id))
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .innerJoin(orders, eq(warrantyClaims.orderId, orders.id))
      .where(eq(warrantyClaims.id, id))
      .limit(1);

    if (!claim.length) return null;

    const logs = await db
      .select({
        id: warrantyLogs.id,
        action: warrantyLogs.action,
        description: warrantyLogs.description,
        oldStatus: warrantyLogs.oldStatus,
        newStatus: warrantyLogs.newStatus,
        createdAt: warrantyLogs.createdAt,
        createdByName: profiles.fullName,
      })
      .from(warrantyLogs)
      .leftJoin(profiles, eq(warrantyLogs.createdBy, profiles.id))
      .where(eq(warrantyLogs.warrantyClaimId, id))
      .orderBy(asc(warrantyLogs.createdAt));

    return { claim: claim[0], logs };
  } catch (error) {
    console.error("Lỗi lấy chi tiết bảo hành:", error);
    return null;
  }
}

// 3. Tạo phiếu bảo hành
export async function createWarrantyClaim(data: {
  orderId: string;
  orderItemId: string;
  inventoryItemId: string;
  customerId: string;
  issueDescription: string;
  receivedDate: string;
  expectedReturnDate?: string;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lấy thông tin chi tiết bảo hành và đơn hàng để tính toán tự động
      const orderItem = await tx.select().from(orderItems).where(eq(orderItems.id, data.orderItemId)).limit(1);
      if (!orderItem.length) throw new Error("Không tìm thấy sản phẩm trong chi tiết đơn hàng");
      const warrantyMonths = orderItem[0].warrantyMonths;

      const orderData = await tx.select().from(orders).where(eq(orders.id, data.orderId)).limit(1);
      if (!orderData.length) throw new Error("Không tìm thấy đơn hàng gốc");
      const purchaseDate = new Date(orderData[0].createdAt);
      const purchaseDateStr = orderData[0].createdAt.toISOString().split("T")[0];

      if (data.receivedDate < purchaseDateStr) {
        throw new Error(`Ngày tiếp nhận bảo hành (${data.receivedDate}) không thể trước ngày mua hàng (${purchaseDateStr})`);
      }

      const warrantyEndDateObj = new Date(purchaseDate);
      warrantyEndDateObj.setMonth(warrantyEndDateObj.getMonth() + warrantyMonths);
      const calculatedWarrantyEndDateStr = warrantyEndDateObj.toISOString().split("T")[0];

      const receivedDateObj = new Date(data.receivedDate);
      const calculatedIsUnderWarranty = receivedDateObj <= warrantyEndDateObj;

      // 2. Tạo claimNumber duy nhất
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const claimNumber = `WAR-${dateStr}-${randomSuffix}`;

      // Lấy người tạo (tạm thời lấy user đầu tiên nếu chưa có Auth)
      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const createdById = ownerProfiles[0]?.id;
      if (!createdById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      // 3. Insert vào warrantyClaims
      const [newClaim] = await tx
        .insert(warrantyClaims)
        .values({
          claimNumber,
          orderId: data.orderId,
          orderItemId: data.orderItemId,
          inventoryItemId: data.inventoryItemId,
          customerId: data.customerId,
          status: "pending",
          issueDescription: data.issueDescription,
          isUnderWarranty: calculatedIsUnderWarranty,
          warrantyEndDate: calculatedWarrantyEndDateStr,
          receivedDate: data.receivedDate,
          expectedReturnDate: data.expectedReturnDate || null,
          createdBy: createdById,
        })
        .returning();

      // 4. Cập nhật status inventory item thành warranty_repair
      await tx.update(inventoryItems)
        .set({ status: 'warranty_repair', updatedAt: new Date() })
        .where(eq(inventoryItems.id, data.inventoryItemId));

      // 5. Ghi nhận thẻ kho: warranty_in (Từ sold -> warranty_repair)
      await tx.insert(inventoryMovements).values({
        inventoryItemId: data.inventoryItemId,
        movementType: "warranty_in",
        fromStatus: "sold",
        toStatus: "warranty_repair",
        referenceType: "warranty_claim",
        referenceId: newClaim.id,
        quantityChange: 1,
        notes: `Nhận máy bảo hành từ khách hàng. Mã phiếu: ${claimNumber}`,
        performedBy: createdById,
      });

      // 6. Ghi log khởi tạo
      await tx.insert(warrantyLogs).values({
        warrantyClaimId: newClaim.id,
        action: "created",
        description: `Khởi tạo phiếu bảo hành mới cho lỗi: ${data.issueDescription}. Thiết bị: ${calculatedIsUnderWarranty ? "Còn trong hạn bảo hành" : "Đã hết hạn bảo hành"} (Thời hạn đến: ${calculatedWarrantyEndDateStr})`,
        newStatus: "pending",
        createdBy: createdById,
      });

      // 7. Lấy thêm tên sản phẩm và tên khách hàng để gửi Telegram
      const customer = await tx.select().from(customers).where(eq(customers.id, data.customerId)).limit(1);
      const customerName = customer[0]?.fullName || "Khách hàng lẻ";
      const customerPhone = customer[0]?.phone || "";

      const item = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, data.inventoryItemId)).limit(1);
      let productName = "Thiết bị";
      let serialNumber = item[0]?.serialNumber || "";
      
      if (item.length > 0) {
        const prod = await tx.select().from(products).where(eq(products.id, item[0].productId)).limit(1);
        if (prod.length > 0) {
          productName = prod[0].name;
        }
      }

      return { 
        success: true, 
        message: "Tạo phiếu bảo hành thành công", 
        claim: newClaim,
        telegramData: {
          claimNumber,
          customerName,
          customerPhone,
          productName,
          serialNumber,
          issueDescription: data.issueDescription,
        }
      };
    });

    // Gửi thông báo Telegram ngoài Transaction (Asynchronous)
    if (result.success && result.telegramData) {
      after(() => {
        sendTelegramNotification("warranty_created", {
          claim_number: result.telegramData.claimNumber,
          customer_name: result.telegramData.customerName,
          customer_phone: result.telegramData.customerPhone,
          product_name: result.telegramData.productName,
          serial_number: result.telegramData.serialNumber,
          issue_description: result.telegramData.issueDescription,
        }).catch((err) => console.error("Lỗi gửi thông báo Telegram tạo phiếu bảo hành:", err));
      });
    }

    if (result.success) {
      after(() => {
        invalidateDashboardCache();
      });
    }

    return result;
  } catch (error: any) {
    console.error("Lỗi tạo phiếu bảo hành:", error);
    return { success: false, message: error.message || "Lỗi tạo phiếu bảo hành" };
  }
}

// 4. Cập nhật trạng thái bảo hành
export async function updateWarrantyStatus(data: {
  claimId: string;
  newStatus: 'pending' | 'inspecting' | 'repairing' | 'waiting_parts' | 'completed' | 'rejected' | 'replaced';
  description: string;
  diagnosis?: string;
  resolution?: string;
  repairCost?: string;
  newInventoryItemId?: string; // Thêm: ID máy mới để đổi trả bảo hành
}) {
  try {
    return await db.transaction(async (tx) => {
      const claim = await tx.select().from(warrantyClaims).where(eq(warrantyClaims.id, data.claimId)).limit(1);
      if (!claim.length) throw new Error("Không tìm thấy phiếu bảo hành");
      
      const oldStatus = claim[0].status;
      const inventoryItemId = claim[0].inventoryItemId;

      const ownerProfiles = await tx.select().from(profiles).limit(1);
      const createdById = ownerProfiles[0]?.id;
      if (!createdById) throw new Error("Hệ thống chưa cấu hình tài khoản nhân viên");

      // 1. Tự động so sánh thay đổi các trường dữ liệu để tạo log chi tiết
      const changes: string[] = [];
      const statusLabels: Record<string, string> = {
        pending: "Đã tiếp nhận",
        inspecting: "Đang kiểm tra",
        waiting_parts: "Chờ linh kiện",
        repairing: "Đang sửa chữa",
        completed: "Đã hoàn thành",
        rejected: "Từ chối bảo hành",
        replaced: "Đổi máy mới"
      };

      if (oldStatus !== data.newStatus) {
        changes.push(`Trạng thái: ${statusLabels[oldStatus] || oldStatus} ➔ ${statusLabels[data.newStatus] || data.newStatus}`);
      }
      if (data.diagnosis !== undefined && data.diagnosis !== (claim[0].diagnosis || "")) {
        changes.push(`Chẩn đoán kỹ thuật: "${claim[0].diagnosis || 'Chưa có'}" ➔ "${data.diagnosis}"`);
      }
      if (data.resolution !== undefined && data.resolution !== (claim[0].resolution || "")) {
        changes.push(`Giải pháp xử lý: "${claim[0].resolution || 'Chưa có'}" ➔ "${data.resolution}"`);
      }
      if (data.repairCost !== undefined && Math.round(Number(data.repairCost)) !== Math.round(Number(claim[0].repairCost || 0))) {
        const oldCost = Math.round(Number(claim[0].repairCost || 0)).toLocaleString('vi-VN') + ' VNĐ';
        const newCost = Math.round(Number(data.repairCost || 0)).toLocaleString('vi-VN') + ' VNĐ';
        changes.push(`Chi phí sửa chữa: ${oldCost} ➔ ${newCost}`);
      }

      let changeLog = "";
      if (changes.length > 0) {
        changeLog = "- " + changes.join("\n- ");
      }

      const finalDescription = data.description 
        ? (changeLog ? `${data.description}\n${changeLog}` : data.description)
        : (changeLog || "Cập nhật thông tin phiếu bảo hành");

      // Update claim
      await tx
        .update(warrantyClaims)
        .set({
          status: data.newStatus,
          diagnosis: data.diagnosis !== undefined ? data.diagnosis : claim[0].diagnosis,
          resolution: data.resolution !== undefined ? data.resolution : claim[0].resolution,
          repairCost: data.repairCost !== undefined ? data.repairCost : claim[0].repairCost,
          actualReturnDate: (data.newStatus === 'completed' || data.newStatus === 'rejected' || data.newStatus === 'replaced')
            ? new Date().toISOString().split("T")[0] 
            : claim[0].actualReturnDate,
          updatedAt: new Date(),
        })
        .where(eq(warrantyClaims.id, data.claimId));

      // Nếu completed hoặc rejected, khôi phục trạng thái kho máy cũ về 'sold'
      if (data.newStatus === 'completed' || data.newStatus === 'rejected') {
        await tx.update(inventoryItems)
          .set({ status: 'sold', updatedAt: new Date() })
          .where(eq(inventoryItems.id, inventoryItemId));

        // Ghi thẻ kho: warranty_out (Từ warranty_repair -> sold)
        await tx.insert(inventoryMovements).values({
          inventoryItemId: inventoryItemId,
          movementType: "warranty_out",
          fromStatus: "warranty_repair",
          toStatus: "sold",
          referenceType: "warranty_claim",
          referenceId: data.claimId,
          quantityChange: -1,
          notes: `Trả máy bảo hành cho khách hàng. Trạng thái: ${data.newStatus === 'completed' ? 'Đã hoàn thành' : 'Từ chối bảo hành'}`,
          performedBy: createdById,
        });
      }

      // Nếu replaced (Đổi máy mới)
      if (data.newStatus === 'replaced') {
        if (!data.newInventoryItemId) {
          throw new Error("Vui lòng chọn máy thay thế mới");
        }

        // 1. Cập nhật máy cũ thành trạng thái hỏng (defective)
        await tx.update(inventoryItems)
          .set({ status: 'defective', updatedAt: new Date() })
          .where(eq(inventoryItems.id, inventoryItemId));

        // Ghi thẻ kho máy cũ: defective (Từ warranty_repair -> defective)
        await tx.insert(inventoryMovements).values({
          inventoryItemId: inventoryItemId,
          movementType: "defective",
          fromStatus: "warranty_repair",
          toStatus: "defective",
          referenceType: "warranty_claim",
          referenceId: data.claimId,
          quantityChange: 0,
          notes: `Máy lỗi nặng được thu hồi làm máy hỏng để đổi mới cho khách. Mã phiếu: ${claim[0].claimNumber}`,
          performedBy: createdById,
        });

        // 2. Cập nhật máy mới thành trạng thái bán (sold) và điền soldDate
        await tx.update(inventoryItems)
          .set({ 
            status: 'sold', 
            soldDate: new Date().toISOString().split("T")[0],
            updatedAt: new Date() 
          })
          .where(eq(inventoryItems.id, data.newInventoryItemId));

        // Ghi thẻ kho máy mới: sold (Từ in_stock -> sold)
        await tx.insert(inventoryMovements).values({
          inventoryItemId: data.newInventoryItemId,
          movementType: "sold",
          fromStatus: "in_stock",
          toStatus: "sold",
          referenceType: "warranty_claim",
          referenceId: data.claimId,
          quantityChange: -1,
          notes: `Xuất máy mới thay thế cho máy lỗi theo phiếu bảo hành ${claim[0].claimNumber}`,
          performedBy: createdById,
        });

        // 3. Liên kết chi tiết đơn hàng cũ trỏ sang serial của máy mới
        await tx.update(orderItems)
          .set({ inventoryItemId: data.newInventoryItemId })
          .where(eq(orderItems.id, claim[0].orderItemId));
      }

      // Ghi log
      await tx.insert(warrantyLogs).values({
        warrantyClaimId: data.claimId,
        action: "status_changed",
        description: finalDescription,
        oldStatus: oldStatus,
        newStatus: data.newStatus,
        createdBy: createdById,
      });

      // 5. Đồng bộ Sổ quỹ Kế toán
      const finalRepairCostStr = data.repairCost !== undefined ? data.repairCost : claim[0].repairCost;
      const finalRepairCost = Number(finalRepairCostStr || 0);

      const existingCashEntry = await tx
        .select()
        .from(cashBookEntries)
        .where(
          and(
            eq(cashBookEntries.referenceType, "other"),
            eq(cashBookEntries.referenceId, data.claimId)
          )
        )
        .limit(1);

      if (finalRepairCost > 0) {
        if (existingCashEntry.length > 0) {
          const oldAmount = Number(existingCashEntry[0].amount || 0);
          if (oldAmount !== finalRepairCost) {
            await tx
              .update(cashBookEntries)
              .set({
                amount: finalRepairCost.toString(),
                description: `Thu phí sửa chữa bảo hành - Phiếu: ${claim[0].claimNumber}`,
              })
              .where(eq(cashBookEntries.id, existingCashEntry[0].id));
            
            await recalculateRunningBalances(tx);
          }
        } else {
          // Tạo mã giao dịch sổ quỹ
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const entryNumber = `CB${dateStr}-${randomSuffix}`;

          await tx.insert(cashBookEntries).values({
            entryNumber,
            type: "income",
            category: "warranty_repair",
            amount: finalRepairCost.toString(),
            runningBalance: "0",
            paymentMethod: "cash",
            referenceType: "other",
            referenceId: data.claimId,
            description: `Thu phí sửa chữa bảo hành - Phiếu: ${claim[0].claimNumber}`,
            entryDate: new Date().toISOString().split("T")[0],
            createdBy: createdById,
          });

          await recalculateRunningBalances(tx);
        }
      } else {
        // Nếu chi phí bằng 0đ, xóa giao dịch sổ quỹ liên kết nếu có
        if (existingCashEntry.length > 0) {
          await tx
            .delete(cashBookEntries)
            .where(eq(cashBookEntries.id, existingCashEntry[0].id));
          
          await recalculateRunningBalances(tx);
        }
      }

      const result = { success: true, message: "Cập nhật trạng thái thành công" };
      after(() => {
        invalidateDashboardCache();
      });
      return result;
    });
  } catch (error: any) {
    console.error("Lỗi cập nhật bảo hành:", error);
    return { success: false, message: error.message || "Lỗi cập nhật bảo hành" };
  }
}

export async function deleteWarrantyClaim(claimId: string) {
  try {
    return await db.transaction(async (tx) => {
      const claim = await tx.select().from(warrantyClaims).where(eq(warrantyClaims.id, claimId)).limit(1);
      if (!claim.length) throw new Error("Không tìm thấy phiếu bảo hành");
      
      const inventoryItemId = claim[0].inventoryItemId;

      // 1. Khôi phục máy về trạng thái sold
      await tx.update(inventoryItems)
        .set({ status: 'sold', updatedAt: new Date() })
        .where(eq(inventoryItems.id, inventoryItemId));

      // 2. Xóa các logs liên quan
      await tx.delete(warrantyLogs).where(eq(warrantyLogs.warrantyClaimId, claimId));

      // 3. Xóa các inventory movements liên quan
      await tx.delete(inventoryMovements).where(
        and(
          eq(inventoryMovements.inventoryItemId, inventoryItemId),
          eq(inventoryMovements.referenceType, "warranty_claim"),
          eq(inventoryMovements.referenceId, claimId)
        )
      );

      // 4. Xóa phiếu bảo hành
      await tx.delete(warrantyClaims).where(eq(warrantyClaims.id, claimId));

      // 5. Xóa sổ quỹ liên quan
      await tx.delete(cashBookEntries).where(
        and(
          eq(cashBookEntries.referenceType, "other"),
          eq(cashBookEntries.referenceId, claimId)
        )
      );

      // 6. Tính toán lại số dư sổ quỹ
      await recalculateRunningBalances(tx);

      const result = { success: true, message: "Xóa phiếu bảo hành thành công. Đã khôi phục trạng thái máy." };
      after(() => {
        invalidateDashboardCache();
      });
      return result;
    });
  } catch (error: any) {
    console.error("Lỗi xóa phiếu bảo hành:", error);
    return { success: false, message: error.message || "Lỗi xóa phiếu bảo hành" };
  }
}

