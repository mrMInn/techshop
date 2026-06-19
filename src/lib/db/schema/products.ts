import { pgTable, uuid, varchar, text, boolean, timestamp, integer, jsonb, AnyPgColumn } from 'drizzle-orm/pg-core';

// ============================================================
// CATEGORIES — Danh mục sản phẩm (hỗ trợ sub-category)
// ============================================================

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// BRANDS — Thương hiệu
// ============================================================

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// PRODUCTS — Sản phẩm (model chung, không phải từng chiếc máy)
// VD: "MacBook Pro M3 14 inch" là 1 product
// Từng chiếc máy cụ thể nằm ở inventory_items
// ============================================================

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  sku: varchar('sku', { length: 50 }).unique(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  brandId: uuid('brand_id').references(() => brands.id).notNull(),
  description: text('description'),
  specs: jsonb('specs'), // JSONB: { cpu, ram, ssd, gpu, screen, battery, weight, color }
  warrantyMonths: integer('warranty_months').default(12).notNull(),
  images: text('images').array(), // Array of image URLs (Telegram file_ids)
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
