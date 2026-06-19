import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, pgEnum, index } from 'drizzle-orm/pg-core';

// ============================================================
// ENUMS
// ============================================================

export const customerTypeEnum = pgEnum('customer_type', ['individual', 'business']);

// ============================================================
// LEAD_SOURCES — Nguồn khách hàng
// Quản lý khách đến từ đâu: Facebook, Chợ Tốt, VOZ, Zalo...
// ============================================================

export const leadSources = pgTable('lead_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  icon: varchar('icon', { length: 50 }),
  color: varchar('color', { length: 7 }), // Hex color: #FF5722
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// CUSTOMERS — Khách hàng
// ============================================================

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  taxCode: varchar('tax_code', { length: 20 }),
  customerType: customerTypeEnum('customer_type').default('individual').notNull(),
  leadSourceId: uuid('lead_source_id').references(() => leadSources.id),
  notes: text('notes'),
  totalSpent: decimal('total_spent', { precision: 15, scale: 2 }).default('0').notNull(),
  orderCount: integer('order_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_customers_lead_source').on(table.leadSourceId),
]);
