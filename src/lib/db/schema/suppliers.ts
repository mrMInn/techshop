import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, date, pgEnum, index } from 'drizzle-orm/pg-core';
import { products } from './products';
import { profiles } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const poStatusEnum = pgEnum('po_status', [
  'draft', 'ordered', 'in_transit', 'partially_received', 'received', 'cancelled', 'warranty_supplier', 'returned_supplier',
]);

// ============================================================
// SUPPLIERS — Nhà cung cấp
// ============================================================

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  contactName: varchar('contact_name', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  country: varchar('country', { length: 50 }).default('VN'),
  taxCode: varchar('tax_code', { length: 20 }),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// PURCHASE_ORDERS — Đơn nhập hàng
// ============================================================

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  poNumber: varchar('po_number', { length: 30 }).unique().notNull(),
  supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
  status: poStatusEnum('status').default('draft').notNull(),
  originCountry: varchar('origin_country', { length: 50 }).default('VN'),
  shippingMethod: varchar('shipping_method', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  trackingUrl: text('tracking_url'),
  expectedArrival: date('expected_arrival'),
  actualArrival: date('actual_arrival'),
  shippingCost: decimal('shipping_cost', { precision: 15, scale: 2 }).default('0'),
  totalCost: decimal('total_cost', { precision: 15, scale: 2 }).notNull(),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_purchase_orders_supplier').on(table.supplierId),
]);

// ============================================================
// PURCHASE_ORDER_ITEMS — Chi tiết đơn nhập
// ============================================================

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitCost: decimal('unit_cost', { precision: 15, scale: 2 }).notNull(),
  totalCost: decimal('total_cost', { precision: 15, scale: 2 }).notNull(),
  receivedQuantity: integer('received_quantity').default(0).notNull(),
  notes: text('notes'),
}, (table) => [
  index('idx_po_items_po').on(table.purchaseOrderId),
  index('idx_po_items_product').on(table.productId),
]);
