"use server";

import { db } from "@/lib/db";
import {
  customers,
  leadSources,
  orders,
  orderItems,
  inventoryItems,
  products,
  brands,
  quotations,
  returns,
  returnItems,
} from "@/lib/db/schema";
import { eq, desc, ilike, or, sql, and, inArray } from "drizzle-orm";

// ============================================================
// 1. Lấy danh sách toàn bộ khách hàng (có kèm nguồn khách)
// ============================================================
export async function getCustomersList() {
  try {
    const list = await db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        taxCode: customers.taxCode,
        customerType: customers.customerType,
        notes: customers.notes,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        leadSourceId: customers.leadSourceId,
        leadSourceName: leadSources.name,
        leadSourceIcon: leadSources.icon,
        leadSourceColor: leadSources.color,
      })
      .from(customers)
      .leftJoin(leadSources, eq(customers.leadSourceId, leadSources.id))
      .orderBy(desc(customers.createdAt));

    return list;
  } catch (error) {
    console.error("Lỗi lấy danh sách khách hàng:", error);
    return [];
  }
}

// ============================================================
// 1.5. Tìm kiếm khách hàng bằng số điện thoại (chắp vá/tra cứu)
// ============================================================
export async function searchCustomersByPhone(phone: string) {
  try {
    const cleanPhone = phone.trim();
    if (!cleanPhone) return { success: false, message: "Số điện thoại trống" };

    const list = await db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
      })
      .from(customers)
      .where(ilike(customers.phone, `%${cleanPhone}%`))
      .orderBy(desc(customers.createdAt))
      .limit(10);

    return { success: true, customers: list };
  } catch (error: any) {
    console.error("Lỗi tìm kiếm khách hàng bằng SĐT:", error);
    return { success: false, message: error.message || "Lỗi tìm kiếm khách hàng" };
  }
}

// ============================================================
// 2. Lấy chi tiết khách hàng + lịch sử đơn hàng
// ============================================================
export async function getCustomerDetail(customerId: string) {
  try {
    // Thông tin khách hàng
    const customerData = await db
      .select({
        id: customers.id,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        taxCode: customers.taxCode,
        customerType: customers.customerType,
        notes: customers.notes,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        leadSourceId: customers.leadSourceId,
        leadSourceName: leadSources.name,
        leadSourceIcon: leadSources.icon,
      })
      .from(customers)
      .leftJoin(leadSources, eq(customers.leadSourceId, leadSources.id))
      .where(eq(customers.id, customerId))
      .limit(1);

    if (customerData.length === 0) return null;

    // Lịch sử đơn hàng
    const orderHistory = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalAmount: orders.totalAmount,
        profit: orders.profit,
        createdAt: orders.createdAt,
        saleChannel: orders.saleChannel,
      })
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));

    // Các sản phẩm đã mua (từ order_items)
    const purchasedItems = await db
      .select({
        itemId: inventoryItems.id,
        serialNumber: inventoryItems.serialNumber,
        status: inventoryItems.status,
        productName: products.name,
        productSpecs: products.specs,
        brandName: brands.name,
        sellingPrice: orderItems.sellingPrice,
        warrantyMonths: orderItems.warrantyMonths,
        orderId: orderItems.orderId,
        orderNumber: orders.orderNumber,
        orderDate: orders.createdAt,
        orderStatus: orders.status,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(inventoryItems, eq(orderItems.inventoryItemId, inventoryItems.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));

    // Lịch sử Đổi/Trả hàng chi tiết
    const returnsHistory = await db
      .select({
        id: returns.id,
        returnNumber: returns.returnNumber,
        type: returns.type,
        reason: returns.reason,
        status: returns.status,
        refundAmount: returns.refundAmount,
        exchangeDifference: returns.exchangeDifference,
        createdAt: returns.createdAt,
        orderNumber: orders.orderNumber,
        productName: products.name,
        oldSerialNumber: sql<string>`(SELECT serial_number FROM inventory_items WHERE id = ${returnItems.inventoryItemId})`,
        newSerialNumber: sql<string | null>`(SELECT serial_number FROM inventory_items WHERE id = ${returnItems.newInventoryItemId})`,
      })
      .from(returns)
      .innerJoin(orders, eq(returns.orderId, orders.id))
      .innerJoin(returnItems, eq(returns.id, returnItems.returnId))
      .innerJoin(products, eq(returnItems.productId, products.id))
      .where(eq(returns.customerId, customerId))
      .orderBy(desc(returns.createdAt));

    return {
      customer: customerData[0],
      orders: orderHistory,
      purchasedItems,
      returns: returnsHistory,
    };
  } catch (error) {
    console.error("Lỗi lấy chi tiết khách hàng:", error);
    return null;
  }
}

// ============================================================
// 3. Tạo mới khách hàng
// ============================================================
export async function createCustomerFullAction(data: {
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  customerType?: "individual" | "business";
  leadSourceId?: string;
  notes?: string;
}) {
  try {
    if (!data.fullName?.trim()) {
      return { success: false, message: "Họ tên không được để trống" };
    }

    const [newCustomer] = await db
      .insert(customers)
      .values({
        fullName: data.fullName.trim(),
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        taxCode: data.taxCode?.trim() || null,
        customerType: data.customerType || "individual",
        leadSourceId: data.leadSourceId || null,
        notes: data.notes?.trim() || null,
        totalSpent: "0",
        orderCount: 0,
      })
      .returning();

    return { success: true, message: "Thêm khách hàng thành công", customer: newCustomer };
  } catch (error: any) {
    console.error("Lỗi tạo khách hàng:", error);
    if (error.code === "23505") {
      return { success: false, message: "Số điện thoại hoặc email đã tồn tại trong hệ thống" };
    }
    return { success: false, message: "Không thể thêm khách hàng. Vui lòng thử lại." };
  }
}

// ============================================================
// 4. Cập nhật thông tin khách hàng
// ============================================================
export async function updateCustomerAction(
  id: string,
  data: {
    fullName?: string;
    phone?: string;
    email?: string;
    address?: string;
    taxCode?: string;
    customerType?: "individual" | "business";
    leadSourceId?: string;
    notes?: string;
  }
) {
  try {
    const existing = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!existing.length) return { success: false, message: "Không tìm thấy khách hàng" };

    const updateData: any = { updatedAt: new Date() };

    if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
    if (data.phone !== undefined) updateData.phone = data.phone.trim() || null;
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;
    if (data.address !== undefined) updateData.address = data.address?.trim() || null;
    if (data.taxCode !== undefined) updateData.taxCode = data.taxCode?.trim() || null;
    if (data.customerType !== undefined) updateData.customerType = data.customerType;
    if (data.leadSourceId !== undefined) updateData.leadSourceId = data.leadSourceId || null;
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

    const [updatedCustomer] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, id))
      .returning();

    return { success: true, message: "Cập nhật khách hàng thành công", customer: updatedCustomer };
  } catch (error: any) {
    console.error("Lỗi cập nhật khách hàng:", error);
    if (error.code === "23505") {
      return { success: false, message: "Số điện thoại hoặc email đã tồn tại" };
    }
    return { success: false, message: "Không thể cập nhật khách hàng" };
  }
}

// ============================================================
// 5. Xóa khách hàng (chỉ khi chưa có đơn hàng)
// ============================================================
export async function deleteCustomerAction(id: string) {
  try {
    // Kiểm tra khách hàng có đơn hàng không
    const customerOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.customerId, id))
      .limit(1);

    if (customerOrders.length > 0) {
      return {
        success: false,
        message: "Không thể xóa khách hàng đã có đơn hàng. Bạn có thể cập nhật ghi chú để đánh dấu.",
      };
    }

    await db.delete(customers).where(eq(customers.id, id));
    return { success: true, message: "Xóa khách hàng thành công" };
  } catch (error: any) {
    console.error("Lỗi xóa khách hàng:", error);
    return { success: false, message: "Không thể xóa khách hàng" };
  }
}

// ============================================================
// 6. Lấy danh sách nguồn khách hàng (Lead Sources)
// ============================================================
export async function getLeadSourcesList() {
  try {
    // Tự động đồng bộ/upsert DEFAULT_LEAD_SOURCES từ constant vào database bằng 1 query duy nhất
    const { DEFAULT_LEAD_SOURCES } = await import("@/lib/constants");
    const activeNames: string[] = DEFAULT_LEAD_SOURCES.map((ls) => ls.name);

    // 1. Tìm các nguồn không nằm trong DEFAULT_LEAD_SOURCES (ví dụ: VOZ Forum, Zalo) để dọn dẹp
    const allSources = await db
      .select({ id: leadSources.id, name: leadSources.name })
      .from(leadSources);
      
    const toDelete = allSources.filter((s) => !activeNames.includes(s.name));
    
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map((s) => s.id);
      
      // Gỡ liên kết khóa ngoại bằng cách set NULL ở các bảng liên quan để tránh lỗi CONSTRAINT
      await db
        .update(customers)
        .set({ leadSourceId: null })
        .where(inArray(customers.leadSourceId, deleteIds));
        
      await db
        .update(orders)
        .set({ leadSourceId: null })
        .where(inArray(orders.leadSourceId, deleteIds));
        
      await db
        .update(quotations)
        .set({ leadSourceId: null })
        .where(inArray(quotations.leadSourceId, deleteIds));
        
      // Tiến hành xóa các nguồn khách hàng không còn sử dụng khỏi database
      await db
        .delete(leadSources)
        .where(inArray(leadSources.id, deleteIds));
    }

    // 2. Chạy Bulk Upsert cho các nguồn khách hàng đang hoạt động
    await db
      .insert(leadSources)
      .values(
        DEFAULT_LEAD_SOURCES.map((source) => ({
          name: source.name,
          icon: source.icon,
          color: source.color,
          isActive: true,
        }))
      )
      .onConflictDoUpdate({
        target: leadSources.name,
        set: {
          icon: sql`excluded.icon`,
          color: sql`excluded.color`,
        },
      });

    return await db
      .select({
        id: leadSources.id,
        name: leadSources.name,
        icon: leadSources.icon,
        color: leadSources.color,
        isActive: leadSources.isActive,
      })
      .from(leadSources)
      .where(eq(leadSources.isActive, true))
      .orderBy(leadSources.name);
  } catch (error) {
    console.error("Lỗi lấy danh sách nguồn khách:", error);
    return [];
  }
}
