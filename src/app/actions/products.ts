"use server";

import { db } from "@/lib/db";
import { products, categories, brands } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getCategories() {
  return await db.select().from(categories).orderBy(categories.name);
}

export async function getBrands() {
  return await db.select().from(brands).orderBy(brands.name);
}

// Thêm nhanh Danh mục
export async function createCategory(name: string) {
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    const [newCategory] = await db.insert(categories).values({
      name,
      slug,
    }).returning();
    return { success: true, message: "Thêm danh mục thành công", data: newCategory };
  } catch (error: any) {
    if (error.code === '23505') return { success: false, message: "Tên danh mục đã tồn tại" };
    return { success: false, message: "Không thể thêm danh mục" };
  }
}

// Thêm nhanh Thương hiệu
export async function createBrand(name: string) {
  try {
    const [newBrand] = await db.insert(brands).values({
      name,
    }).returning();
    return { success: true, message: "Thêm thương hiệu thành công", data: newBrand };
  } catch (error: any) {
    if (error.code === '23505') return { success: false, message: "Tên thương hiệu đã tồn tại" };
    return { success: false, message: "Không thể thêm thương hiệu" };
  }
}

// Thêm Model Sản Phẩm
export async function createProduct(data: {
  name: string;
  sku: string;
  categoryId: string;
  brandId: string;
  specs: { cpu?: string; ram?: string; ssd?: string };
}) {
  try {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + "-" + Date.now();
    
    const [newProduct] = await db.insert(products).values({
      name: data.name,
      slug,
      sku: data.sku,
      categoryId: data.categoryId,
      brandId: data.brandId,
      specs: data.specs,
    }).returning();
    
    return { success: true, message: "Thêm sản phẩm thành công", data: newProduct };
  } catch (error: any) {
    if (error.code === '23505') return { success: false, message: "SKU hoặc tên đã tồn tại" };
    return { success: false, message: "Không thể thêm sản phẩm" };
  }
}

// Cập nhật Danh mục
export async function updateCategory(id: string, name: string) {
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    const [updatedCategory] = await db.update(categories)
      .set({ name, slug })
      .where(eq(categories.id, id))
      .returning();
    return { success: true, message: "Cập nhật danh mục thành công", data: updatedCategory };
  } catch (error: any) {
    if (error.code === '23505') return { success: false, message: "Tên danh mục đã tồn tại" };
    return { success: false, message: "Không thể cập nhật danh mục" };
  }
}

// Xóa Danh mục
export async function deleteCategory(id: string) {
  try {
    await db.delete(categories).where(eq(categories.id, id));
    return { success: true, message: "Xóa danh mục thành công" };
  } catch (error: any) {
    if (error.code === '23503') {
      return { success: false, message: "Không thể xóa danh mục vì đang có sản phẩm thuộc danh mục này" };
    }
    return { success: false, message: "Không thể xóa danh mục" };
  }
}

// Cập nhật Thương hiệu
export async function updateBrand(id: string, name: string) {
  try {
    const [updatedBrand] = await db.update(brands)
      .set({ name })
      .where(eq(brands.id, id))
      .returning();
    return { success: true, message: "Cập nhật thương hiệu thành công", data: updatedBrand };
  } catch (error: any) {
    if (error.code === '23505') return { success: false, message: "Tên thương hiệu đã tồn tại" };
    return { success: false, message: "Không thể cập nhật thương hiệu" };
  }
}

// Xóa Thương hiệu
export async function deleteBrand(id: string) {
  try {
    await db.delete(brands).where(eq(brands.id, id));
    return { success: true, message: "Xóa thương hiệu thành công" };
  } catch (error: any) {
    if (error.code === '23503') {
      return { success: false, message: "Không thể xóa thương hiệu vì đang có sản phẩm thuộc thương hiệu này" };
    }
    return { success: false, message: "Không thể xóa thương hiệu" };
  }
}

// Xóa Sản phẩm (Model)
export async function deleteProduct(id: string) {
  try {
    await db.delete(products).where(eq(products.id, id));
    return { success: true, message: "Xóa model sản phẩm thành công" };
  } catch (error: any) {
    if (error.code === '23503') {
      return { success: false, message: "Không thể xóa model này vì đang có máy thuộc model này trong kho" };
    }
    return { success: false, message: "Không thể xóa model sản phẩm" };
  }
}

// Lấy danh sách sản phẩm đầy đủ thông tin (Category, Brand)
export async function getProductsList() {
  try {
    return await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        specs: products.specs,
        categoryId: products.categoryId,
        brandId: products.brandId,
        categoryName: categories.name,
        brandName: brands.name,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .innerJoin(brands, eq(products.brandId, brands.id))
      .orderBy(products.name);
  } catch (error) {
    console.error("Lỗi lấy danh sách sản phẩm:", error);
    return [];
  }
}

// Cập nhật Model Sản Phẩm
export async function updateProduct(
  id: string,
  data: {
    name: string;
    sku: string;
    categoryId: string;
    brandId: string;
    specs: { cpu?: string; ram?: string; ssd?: string };
  }
) {
  try {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + "-" + Date.now();
    
    const [updatedProduct] = await db
      .update(products)
      .set({
        name: data.name,
        slug,
        sku: data.sku,
        categoryId: data.categoryId,
        brandId: data.brandId,
        specs: data.specs,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    
    return { success: true, message: "Cập nhật Model sản phẩm thành công", data: updatedProduct };
  } catch (error: any) {
    if (error.code === '23505') return { success: false, message: "SKU hoặc tên đã tồn tại" };
    return { success: false, message: "Không thể cập nhật Model sản phẩm" };
  }
}
