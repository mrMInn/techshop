import { pgTable, uuid, varchar, text, boolean, timestamp, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { customers } from './customers';
import { inventoryItems } from './inventory';
import { products } from './products';
import { profiles } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const returnTypeEnum = pgEnum('return_type', ['return', 'exchange']);

export const returnReasonEnum = pgEnum('return_reason', [
  'defective', 'wrong_item', 'changed_mind', 'upgrade', 'downgrade', 'other',
]);

export const returnStatusEnum = pgEnum('return_status', [
  'pending', 'approved', 'processing', 'completed', 'rejected',
]);

export const returnItemReasonEnum = pgEnum('return_item_reason', [
  'defective', 'cosmetic', 'wrong_specs', 'customer_request', 'other',
]);

export const returnItemConditionEnum = pgEnum('return_item_condition', [
  'like_new', 'good', 'damaged', 'defective',
]);

// ============================================================
// RETURNS — Đổi/Trả hàng
// ============================================================

export const returns = pgTable('returns', {
  id: uuid('id').primaryKey().defaultRandom(),
  returnNumber: varchar('return_number', { length: 30 }).unique().notNull(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  type: returnTypeEnum('type').notNull(),
  reason: returnReasonEnum('reason').notNull(),
  reasonDetail: text('reason_detail').notNull(),
  status: returnStatusEnum('status').default('pending').notNull(),
  hasFee: boolean('has_fee').default(false).notNull(),
  feeAmount: decimal('fee_amount', { precision: 15, scale: 2 }).default('0'),
  refundAmount: decimal('refund_amount', { precision: 15, scale: 2 }).default('0'),
  exchangeDifference: decimal('exchange_difference', { precision: 15, scale: 2 }).default('0'),
  newOrderId: uuid('new_order_id').references(() => orders.id),
  notes: text('notes'),
  processedBy: uuid('processed_by').references(() => profiles.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// RETURN_ITEMS — Chi tiết sản phẩm đổi/trả
// ============================================================

export const returnItems = pgTable('return_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  returnId: uuid('return_id').references(() => returns.id).notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  returnReason: returnItemReasonEnum('return_reason').notNull(),
  conditionOnReturn: returnItemConditionEnum('condition_on_return').notNull(),
  isDefective: boolean('is_defective').default(false).notNull(),
  defectDescription: text('defect_description'),
  originalPrice: decimal('original_price', { precision: 15, scale: 2 }).notNull(),
  refundPrice: decimal('refund_price', { precision: 15, scale: 2 }).notNull(),
  newInventoryItemId: uuid('new_inventory_item_id').references(() => inventoryItems.id),
  notes: text('notes'),
});
