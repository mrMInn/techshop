"use server";

import { db } from "@/lib/db";
import { countries, shippingCarriers, inventoryItems, purchaseOrders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// ============================================================
// COUNTRIES ACTIONS
// ============================================================

// Get list of active countries
export async function getCountriesList() {
  try {
    return await db
      .select()
      .from(countries)
      .orderBy(countries.name);
  } catch (error) {
    console.error("Lỗi lấy danh sách quốc gia:", error);
    return [];
  }
}

// Create new country
export async function createCountry(data: {
  code: string;
  name: string;
}) {
  try {
    const formattedCode = data.code.trim().toUpperCase();
    const formattedName = data.name.trim();

    if (!formattedCode || !formattedName) {
      return { success: false, message: "Vui lòng nhập đầy đủ mã và tên quốc gia" };
    }

    const [newCountry] = await db
      .insert(countries)
      .values({
        code: formattedCode,
        name: formattedName,
        isActive: true,
      })
      .returning();

    return { success: true, message: "Thêm quốc gia thành công", data: newCountry };
  } catch (error: any) {
    console.error("Lỗi tạo quốc gia:", error);
    if (error.code === "23505") { // unique_violation
      return { success: false, message: "Mã quốc gia đã tồn tại" };
    }
    return { success: false, message: "Không thể thêm quốc gia. Vui lòng thử lại." };
  }
}

// Update country
export async function updateCountry(
  id: string,
  data: {
    code: string;
    name: string;
    isActive?: boolean;
  }
) {
  try {
    const formattedCode = data.code.trim().toUpperCase();
    const formattedName = data.name.trim();

    if (!formattedCode || !formattedName) {
      return { success: false, message: "Vui lòng nhập đầy đủ mã và tên quốc gia" };
    }

    const [updatedCountry] = await db
      .update(countries)
      .set({
        code: formattedCode,
        name: formattedName,
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
      .where(eq(countries.id, id))
      .returning();

    return { success: true, message: "Cập nhật quốc gia thành công", data: updatedCountry };
  } catch (error: any) {
    console.error("Lỗi cập nhật quốc gia:", error);
    if (error.code === "23505") {
      return { success: false, message: "Mã quốc gia đã tồn tại" };
    }
    return { success: false, message: "Không thể cập nhật quốc gia. Vui lòng thử lại." };
  }
}

// Delete country
export async function deleteCountry(id: string) {
  try {
    // Get country code first to check if used
    const found = await db.select().from(countries).where(eq(countries.id, id)).limit(1);
    if (found.length === 0) {
      return { success: false, message: "Không tìm thấy quốc gia cần xóa" };
    }
    const countryCode = found[0].code;

    // Check if referenced in inventory items
    const usedInItems = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(eq(inventoryItems.originCountry, countryCode))
      .limit(1);

    if (usedInItems.length > 0) {
      return {
        success: false,
        message: "Không thể xóa quốc gia này vì đã có sản phẩm trong kho đang liên kết.",
      };
    }

    // Check if referenced in purchase orders
    const usedInPOs = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.originCountry, countryCode))
      .limit(1);

    if (usedInPOs.length > 0) {
      return {
        success: false,
        message: "Không thể xóa quốc gia này vì đã có đơn nhập hàng đang liên kết.",
      };
    }

    await db.delete(countries).where(eq(countries.id, id));
    return { success: true, message: "Xóa quốc gia thành công" };
  } catch (error) {
    console.error("Lỗi xóa quốc gia:", error);
    return { success: false, message: "Không thể xóa quốc gia. Vui lòng thử lại." };
  }
}


// ============================================================
// SHIPPING CARRIERS ACTIONS
// ============================================================

// Get list of active carriers
export async function getCarriersList() {
  try {
    return await db
      .select()
      .from(shippingCarriers)
      .orderBy(shippingCarriers.name);
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn vị vận chuyển:", error);
    return [];
  }
}

// Create shipping carrier
export async function createCarrier(data: {
  code: string;
  name: string;
}) {
  try {
    const formattedCode = data.code.trim();
    const formattedName = data.name.trim();

    if (!formattedCode || !formattedName) {
      return { success: false, message: "Vui lòng nhập đầy đủ mã và tên đơn vị vận chuyển" };
    }

    const [newCarrier] = await db
      .insert(shippingCarriers)
      .values({
        code: formattedCode,
        name: formattedName,
        isActive: true,
      })
      .returning();

    return { success: true, message: "Thêm đơn vị vận chuyển thành công", data: newCarrier };
  } catch (error: any) {
    console.error("Lỗi tạo đơn vị vận chuyển:", error);
    if (error.code === "23505") {
      return { success: false, message: "Mã/Tên đơn vị vận chuyển đã tồn tại" };
    }
    return { success: false, message: "Không thể thêm đơn vị vận chuyển. Vui lòng thử lại." };
  }
}

// Update shipping carrier
export async function updateCarrier(
  id: string,
  data: {
    code: string;
    name: string;
    isActive?: boolean;
  }
) {
  try {
    const formattedCode = data.code.trim();
    const formattedName = data.name.trim();

    if (!formattedCode || !formattedName) {
      return { success: false, message: "Vui lòng nhập đầy đủ mã và tên đơn vị vận chuyển" };
    }

    const [updatedCarrier] = await db
      .update(shippingCarriers)
      .set({
        code: formattedCode,
        name: formattedName,
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
      .where(eq(shippingCarriers.id, id))
      .returning();

    return { success: true, message: "Cập nhật đơn vị vận chuyển thành công", data: updatedCarrier };
  } catch (error: any) {
    console.error("Lỗi cập nhật đơn vị vận chuyển:", error);
    if (error.code === "23505") {
      return { success: false, message: "Mã/Tên đơn vị vận chuyển đã tồn tại" };
    }
    return { success: false, message: "Không thể cập nhật đơn vị vận chuyển. Vui lòng thử lại." };
  }
}

// Delete shipping carrier
export async function deleteCarrier(id: string) {
  try {
    const found = await db.select().from(shippingCarriers).where(eq(shippingCarriers.id, id)).limit(1);
    if (found.length === 0) {
      return { success: false, message: "Không tìm thấy đơn vị vận chuyển cần xóa" };
    }
    const carrierCode = found[0].code;

    // Check if referenced in purchase orders
    const usedInPOs = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.shippingMethod, carrierCode))
      .limit(1);

    if (usedInPOs.length > 0) {
      return {
        success: false,
        message: "Không thể xóa đơn vị vận chuyển này vì đã có đơn nhập hàng liên kết.",
      };
    }

    await db.delete(shippingCarriers).where(eq(shippingCarriers.id, id));
    return { success: true, message: "Xóa đơn vị vận chuyển thành công" };
  } catch (error) {
    console.error("Lỗi xóa đơn vị vận chuyển:", error);
    return { success: false, message: "Không thể xóa đơn vị vận chuyển. Vui lòng thử lại." };
  }
}
