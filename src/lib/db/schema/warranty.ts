import { pgTable, uuid, varchar, text, boolean, timestamp, decimal, date, pgEnum, index } from 'drizzle-orm/pg-core';
import { orders, orderItems } from './orders';
import { customers } from './customers';
import { inventoryItems } from './inventory';
import { profiles } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const warrantyStatusEnum = pgEnum('warranty_status', [
  'pending', 'inspecting', 'repairing', 'waiting_parts',
  'completed', 'rejected', 'replaced',
]);

// ============================================================
// WARRANTY_CLAIMS — Yêu cầu bảo hành
// ============================================================

export const warrantyClaims = pgTable('warranty_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimNumber: varchar('claim_number', { length: 30 }).unique().notNull(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  orderItemId: uuid('order_item_id').references(() => orderItems.id).notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  status: warrantyStatusEnum('status').default('pending').notNull(),
  issueDescription: text('issue_description').notNull(),
  diagnosis: text('diagnosis'),
  resolution: text('resolution'),
  repairCost: decimal('repair_cost', { precision: 15, scale: 2 }).default('0'),
  isUnderWarranty: boolean('is_under_warranty').notNull(),
  warrantyEndDate: date('warranty_end_date').notNull(),
  receivedDate: date('received_date').notNull(),
  expectedReturnDate: date('expected_return_date'),
  actualReturnDate: date('actual_return_date'),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_warranty_inventory').on(table.inventoryItemId),
  index('idx_warranty_order').on(table.orderId),
  index('idx_warranty_status').on(table.status),
]);

// ============================================================
// WARRANTY_LOGS — Nhật ký bảo hành (audit trail)
// ============================================================

export const warrantyLogs = pgTable('warranty_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  warrantyClaimId: uuid('warranty_claim_id').references(() => warrantyClaims.id).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  description: text('description').notNull(),
  oldStatus: varchar('old_status', { length: 30 }),
  newStatus: varchar('new_status', { length: 30 }),
  attachments: text('attachments').array(),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
