import { pgTable, uuid, varchar, text, timestamp, integer, decimal, date, pgEnum } from 'drizzle-orm/pg-core';
import { customers, leadSources } from './customers';
import { products } from './products';
import { inventoryItems } from './inventory';
import { orders } from './orders';
import { profiles } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const quotationStatusEnum = pgEnum('quotation_status', [
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted',
]);

// ============================================================
// QUOTATIONS — Báo giá
// Tạo 1 click → Gửi link chuyên nghiệp qua Facebook/Zalo
// ============================================================

export const quotations = pgTable('quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteNumber: varchar('quote_number', { length: 30 }).unique().notNull(),
  shareToken: varchar('share_token', { length: 64 }).unique().notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  customerName: varchar('customer_name', { length: 100 }),
  customerPhone: varchar('customer_phone', { length: 20 }),
  leadSourceId: uuid('lead_source_id').references(() => leadSources.id),
  status: quotationStatusEnum('status').default('draft').notNull(),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(),
  validUntil: date('valid_until'),
  notes: text('notes'),
  internalNotes: text('internal_notes'),
  convertedOrderId: uuid('converted_order_id').references(() => orders.id),
  viewCount: integer('view_count').default(0).notNull(),
  lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// QUOTATION_ITEMS — Chi tiết báo giá
// ============================================================

export const quotationItems = pgTable('quotation_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationId: uuid('quotation_id').references(() => quotations.id).notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quotedPrice: decimal('quoted_price', { precision: 15, scale: 2 }).notNull(),
  notes: text('notes'),
});
