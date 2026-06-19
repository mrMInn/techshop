"use server";

import { db } from "@/lib/db";
import { suppliers, purchaseOrders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// Lấy danh sách tất cả nhà cung cấp
export async function getSuppliersList() {
  try {
    return await db
      .select()
      .from(suppliers)
      .orderBy(suppliers.name);
  } catch (error) {
    console.error("Lỗi lấy danh sách nhà cung cấp:", error);
    return [];
  }
}

// Tạo mới nhà cung cấp
export async function createSupplier(data: {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  taxCode?: string;
  notes?: string;
}) {
  try {
    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        name: data.name,
        contactName: data.contactName || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        country: data.country || "VN",
        taxCode: data.taxCode || null,
        notes: data.notes || null,
        isActive: true,
      })
      .returning();

    return { success: true, message: "Thêm nhà cung cấp thành công", data: newSupplier };
  } catch (error: any) {
    console.error("Lỗi tạo nhà cung cấp:", error);
    if (error.code === "23505") { // unique_violation
      return { success: false, message: "Tên nhà cung cấp đã tồn tại" };
    }
    return { success: false, message: "Không thể thêm nhà cung cấp. Vui lòng thử lại." };
  }
}

// Cập nhật nhà cung cấp
export async function updateSupplier(
  id: string,
  data: {
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    country?: string;
    taxCode?: string;
    notes?: string;
    isActive?: boolean;
  }
) {
  try {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set({
        name: data.name,
        contactName: data.contactName || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        country: data.country || "VN",
        taxCode: data.taxCode || null,
        notes: data.notes || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
      .where(eq(suppliers.id, id))
      .returning();

    return { success: true, message: "Cập nhật nhà cung cấp thành công", data: updatedSupplier };
  } catch (error: any) {
    console.error("Lỗi cập nhật nhà cung cấp:", error);
    if (error.code === "23505") {
      return { success: false, message: "Tên nhà cung cấp đã tồn tại" };
    }
    return { success: false, message: "Không thể cập nhật nhà cung cấp. Vui lòng thử lại." };
  }
}

// Xóa nhà cung cấp
export async function deleteSupplier(id: string) {
  try {
    // Kiểm tra xem nhà cung cấp đã được dùng trong Đơn nhập hàng chưa
    const poList = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, id))
      .limit(1);

    if (poList.length > 0) {
      return {
        success: false,
        message: "Không thể xóa nhà cung cấp này vì đã có đơn nhập hàng liên kết.",
      };
    }

    await db.delete(suppliers).where(eq(suppliers.id, id));
    return { success: true, message: "Xóa nhà cung cấp thành công" };
  } catch (error) {
    console.error("Lỗi xóa nhà cung cấp:", error);
    return { success: false, message: "Không thể xóa nhà cung cấp. Vui lòng thử lại." };
  }
}
