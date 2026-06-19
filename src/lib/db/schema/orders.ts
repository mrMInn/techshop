import { pgTable, uuid, varchar, text, timestamp, integer, decimal, pgEnum, index } from 'drizzle-orm/pg-core';
import { customers, leadSources } from './customers';
import { products } from './products';
import { inventoryItems } from './inventory';
import { profiles } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const orderStatusEnum = pgEnum('order_status', [
  'draft', 'confirmed', 'processing', 'completed', 'cancelled', 'refunded',
]);

export const saleChannelEnum = pgEnum('sale_channel', ['online', 'offline']);

export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid', 'partial', 'paid', 'refunded',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash', 'bank_transfer', 'card', 'mixed',
]);

export const paymentItemMethodEnum = pgEnum('payment_item_method', [
  'cash', 'bank_transfer', 'card', 'momo', 'vnpay',
]);

// ============================================================
// ORDERS — Đơn hàng bán
// ============================================================

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: varchar('order_number', { length: 30 }).unique().notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  leadSourceId: uuid('lead_source_id').references(() => leadSources.id),
  status: orderStatusEnum('status').default('draft').notNull(),
  saleChannel: saleChannelEnum('sale_channel').notNull(),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  totalCost: decimal('total_cost', { precision: 15, scale: 2 }).notNull(),
  profit: decimal('profit', { precision: 15, scale: 2 }),
  profitMargin: decimal('profit_margin', { precision: 5, scale: 2 }),
  paymentStatus: paymentStatusEnum('payment_status').default('unpaid').notNull(),
  paymentMethod: paymentMethodEnum('payment_method'),
  shippingAddress: text('shipping_address'),
  shippingCarrier: varchar('shipping_carrier', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  packingVideoUrl: text('packing_video_url'),
  notes: text('notes'),
  soldBy: uuid('sold_by').references(() => profiles.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_orders_customer').on(table.customerId),
  index('idx_orders_status').on(table.status),
  index('idx_orders_created').on(table.createdAt),
  index('idx_orders_sold_by').on(table.soldBy),
  index('idx_orders_lead_source').on(table.leadSourceId),
]);

// ============================================================
// ORDER_ITEMS — Chi tiết đơn hàng
// ============================================================

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  sellingPrice: decimal('selling_price', { precision: 15, scale: 2 }).notNull(),
  costPrice: decimal('cost_price', { precision: 15, scale: 2 }).notNull(),
  discount: decimal('discount', { precision: 15, scale: 2 }).default('0'),
  profit: decimal('profit', { precision: 15, scale: 2 }),
  warrantyMonths: integer('warranty_months').notNull(),
});

// ============================================================
// PAYMENTS — Thanh toán
// ============================================================

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  paymentMethod: paymentItemMethodEnum('payment_method').notNull(),
  paymentDate: timestamp('payment_date', { withTimezone: true }).defaultNow().notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
