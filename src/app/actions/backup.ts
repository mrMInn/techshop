"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { logAndNotify } from "@/lib/db/audit";
import { getCurrentUserAction } from "@/app/actions/auth";

/**
 * Xuất toàn bộ dữ liệu cơ sở dữ liệu thành file cấu trúc JSON (Sao lưu)
 */
export async function exportBackupAction() {
  const user = await getCurrentUserAction();
  if (!user.success || user.profile?.role !== "admin") {
    return { success: false, message: "Không có quyền thực hiện hành động này." };
  }

  try {
    const backupData: Record<string, any[]> = {};
    
    // Lần lượt truy vấn lấy toàn bộ dòng trong các bảng
    backupData.profiles = await db.select().from(schema.profiles);
    backupData.customers = await db.select().from(schema.customers);
    backupData.suppliers = await db.select().from(schema.suppliers);
    backupData.brands = await db.select().from(schema.brands);
    backupData.products = await db.select().from(schema.products);
    backupData.quotations = await db.select().from(schema.quotations);
    backupData.quotationItems = await db.select().from(schema.quotationItems);
    backupData.accessoryItems = await db.select().from(schema.accessoryItems);
    backupData.inventoryItems = await db.select().from(schema.inventoryItems);
    backupData.purchaseOrders = await db.select().from(schema.purchaseOrders);
    backupData.purchaseOrderItems = await db.select().from(schema.purchaseOrderItems);
    backupData.orders = await db.select().from(schema.orders);
    backupData.orderItems = await db.select().from(schema.orderItems);
    backupData.cashBookEntries = await db.select().from(schema.cashBookEntries);
    backupData.returns = await db.select().from(schema.returns);
    backupData.returnItems = await db.select().from(schema.returnItems);
    backupData.warrantyClaims = await db.select().from(schema.warrantyClaims);
    backupData.warrantyLogs = await db.select().from(schema.warrantyLogs);
    backupData.telegramConfigs = await db.select().from(schema.telegramConfigs);
    backupData.auditLogs = await db.select().from(schema.auditLogs);

    const payload = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      backupBy: user.profile.fullName || user.profile.email,
      data: backupData,
    };

    // Ghi nhận nhật ký sao lưu hệ thống
    await logAndNotify("CREATE", "database_backup", "SYSTEM", null, { backupBy: payload.backupBy });

    return {
      success: true,
      filename: `techshop_backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`,
      payload: JSON.stringify(payload),
    };
  } catch (error: any) {
    console.error("Lỗi khi xuất sao lưu dữ liệu:", error);
    return { success: false, message: "Lỗi hệ thống: " + error.message };
  }
}

/**
 * Khôi phục toàn bộ dữ liệu cơ sở dữ liệu từ file sao lưu JSON (Phục hồi)
 * Hoạt động bên trong một Transaction để đảm bảo tính toàn vẹn 100%
 */
export async function importRestoreAction(backupJsonString: string) {
  const user = await getCurrentUserAction();
  if (!user.success || user.profile?.role !== "admin") {
    return { success: false, message: "Không có quyền thực hiện hành động này." };
  }

  try {
    const payload = JSON.parse(backupJsonString);
    if (!payload.version || !payload.data) {
      return { success: false, message: "File sao lưu không hợp lệ hoặc sai định dạng cấu trúc." };
    }

    const { data } = payload;

    // Chạy trong Database Transaction để đảm bảo tính nguyên tử (Atomicity)
    await db.transaction(async (tx) => {
      // 1. Xóa toàn bộ dữ liệu hiện có theo thứ tự khóa ngoại ngược (bảng con trước)
      await tx.delete(schema.warrantyLogs);
      await tx.delete(schema.warrantyClaims);
      await tx.delete(schema.returnItems);
      await tx.delete(schema.returns);
      await tx.delete(schema.cashBookEntries);
      await tx.delete(schema.orderItems);
      await tx.delete(schema.orders);
      await tx.delete(schema.purchaseOrderItems);
      await tx.delete(schema.purchaseOrders);
      await tx.delete(schema.inventoryItems);
      await tx.delete(schema.accessoryItems);
      await tx.delete(schema.quotationItems);
      await tx.delete(schema.quotations);
      await tx.delete(schema.products);
      await tx.delete(schema.brands);
      await tx.delete(schema.suppliers);
      await tx.delete(schema.customers);
      await tx.delete(schema.telegramConfigs);
      await tx.delete(schema.auditLogs);
      await tx.delete(schema.profiles);

      // 2. Nạp dữ liệu mới theo thứ tự khóa ngoại thuận (bảng cha trước)
      if (data.profiles?.length > 0) await tx.insert(schema.profiles).values(data.profiles);
      if (data.customers?.length > 0) await tx.insert(schema.customers).values(data.customers);
      if (data.suppliers?.length > 0) await tx.insert(schema.suppliers).values(data.suppliers);
      if (data.brands?.length > 0) await tx.insert(schema.brands).values(data.brands);
      if (data.products?.length > 0) await tx.insert(schema.products).values(data.products);
      if (data.quotations?.length > 0) await tx.insert(schema.quotations).values(data.quotations);
      if (data.quotationItems?.length > 0) await tx.insert(schema.quotationItems).values(data.quotationItems);
      if (data.accessoryItems?.length > 0) await tx.insert(schema.accessoryItems).values(data.accessoryItems);
      if (data.inventoryItems?.length > 0) await tx.insert(schema.inventoryItems).values(data.inventoryItems);
      if (data.purchaseOrders?.length > 0) await tx.insert(schema.purchaseOrders).values(data.purchaseOrders);
      if (data.purchaseOrderItems?.length > 0) await tx.insert(schema.purchaseOrderItems).values(data.purchaseOrderItems);
      if (data.orders?.length > 0) await tx.insert(schema.orders).values(data.orders);
      if (data.orderItems?.length > 0) await tx.insert(schema.orderItems).values(data.orderItems);
      if (data.cashBookEntries?.length > 0) await tx.insert(schema.cashBookEntries).values(data.cashBookEntries);
      if (data.returns?.length > 0) await tx.insert(schema.returns).values(data.returns);
      if (data.returnItems?.length > 0) await tx.insert(schema.returnItems).values(data.returnItems);
      if (data.warrantyClaims?.length > 0) await tx.insert(schema.warrantyClaims).values(data.warrantyClaims);
      if (data.warrantyLogs?.length > 0) await tx.insert(schema.warrantyLogs).values(data.warrantyLogs);
      if (data.telegramConfigs?.length > 0) await tx.insert(schema.telegramConfigs).values(data.telegramConfigs);
      if (data.auditLogs?.length > 0) await tx.insert(schema.auditLogs).values(data.auditLogs);

      // Ghi nhận nhật ký khôi phục hệ thống (ngay trong transaction)
      await logAndNotify("CREATE", "database_restore", "SYSTEM", null, { restoredBy: user.profile.fullName || user.profile.email }, tx);
    });

    return { success: true, message: "Khôi phục dữ liệu hệ thống thành công!" };
  } catch (error: any) {
    console.error("Lỗi khi khôi phục dữ liệu hệ thống:", error);
    return { success: false, message: "Khôi phục thất bại: " + error.message };
  }
}
