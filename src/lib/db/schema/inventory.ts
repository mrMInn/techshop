import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb, date, pgEnum, index } from 'drizzle-orm/pg-core';
import { products } from './products';
import { profiles } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const itemConditionEnum = pgEnum('item_condition', [
  'new', 'used',
]);

export const itemStatusEnum = pgEnum('item_status', [
  'incoming', 'in_stock', 'reserved', 'sold', 'warranty_repair', 'returned', 'defective', 'deleted',
]);

export const movementTypeEnum = pgEnum('movement_type', [
  'received', 'stocked', 'transferred', 'sold',
  'warranty_in', 'warranty_out', 'returned',
  'adjusted', 'checked', 'defective',
]);

export const movementRefTypeEnum = pgEnum('movement_ref_type', [
  'purchase_order', 'order', 'warranty_claim', 'manual', 'stocktake',
]);

// ============================================================
// INVENTORY_ITEMS — Kho hàng (từng chiếc máy theo Serial)
// Mỗi row = 1 chiếc máy cụ thể với Serial riêng
// ============================================================

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  serialNumber: varchar('serial_number', { length: 100 }).unique().notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  purchaseOrderItemId: uuid('purchase_order_item_id'), // FK set in suppliers.ts to avoid circular
  condition: itemConditionEnum('condition').notNull(),
  status: itemStatusEnum('status').default('incoming').notNull(),
  costPrice: decimal('cost_price', { precision: 15, scale: 2 }).notNull(),
  sellingPrice: decimal('selling_price', { precision: 15, scale: 2 }),
  specsOverride: jsonb('specs_override'), // Override specs if different from product model
  originCountry: varchar('origin_country', { length: 50 }).default('VN'),
  location: varchar('location', { length: 100 }),
  expectedArrivalDate: date('expected_arrival_date'),
  receivedDate: date('received_date'),
  stockedDate: date('stocked_date'),
  soldDate: date('sold_date'),
  warrantyStart: date('warranty_start'),
  warrantyEnd: date('warranty_end'),
  notes: text('notes'),
  images: text('images').array(),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_inventory_serial').on(table.serialNumber),
  index('idx_inventory_status').on(table.status),
  index('idx_inventory_product').on(table.productId),
  index('idx_inventory_stocked').on(table.stockedDate),
]);

// ============================================================
// INVENTORY_MOVEMENTS — Thẻ kho (Stock Card)
// Ghi lại MỌI DI CHUYỂN của từng chiếc máy
// ============================================================

export const inventoryMovements = pgTable('inventory_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id).notNull(),
  movementType: movementTypeEnum('movement_type').notNull(),
  fromStatus: varchar('from_status', { length: 30 }),
  toStatus: varchar('to_status', { length: 30 }).notNull(),
  referenceType: movementRefTypeEnum('reference_type').notNull(),
  referenceId: uuid('reference_id'),
  quantityChange: integer('quantity_change').notNull(), // +1 (nhập) hoặc -1 (xuất)
  locationFrom: varchar('location_from', { length: 100 }),
  locationTo: varchar('location_to', { length: 100 }),
  notes: text('notes'),
  performedBy: uuid('performed_by').references(() => profiles.id).notNull(),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_inv_movements_item').on(table.inventoryItemId),
  index('idx_inv_movements_type').on(table.movementType),
  index('idx_inv_movements_date').on(table.performedAt),
  index('idx_inv_movements_by').on(table.performedBy),
]);

// ============================================================
// COUNTRIES — Quốc gia xuất xứ
// ============================================================
export const countries = pgTable('countries', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 10 }).unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// SHIPPING_CARRIERS — Đơn vị vận chuyển quốc tế/nội địa
// ============================================================
export const shippingCarriers = pgTable('shipping_carriers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
