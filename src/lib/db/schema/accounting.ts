import { pgTable, uuid, varchar, text, boolean, timestamp, decimal, date, pgEnum, index } from 'drizzle-orm/pg-core';
import { suppliers } from './suppliers';
import { profiles } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const expenseTypeEnum = pgEnum('expense_type', ['fixed', 'variable', 'one_time']);

export const expensePaymentMethodEnum = pgEnum('expense_payment_method', [
  'cash', 'bank_transfer', 'card',
]);

export const cashBookTypeEnum = pgEnum('cash_book_type', ['income', 'expense']);

export const cashBookCategoryEnum = pgEnum('cash_book_category', [
  'sales', 'purchase', 'salary', 'rent', 'utility',
  'shipping', 'tax', 'warranty_repair', 'other',
]);

export const cashBookPaymentMethodEnum = pgEnum('cash_book_payment_method', [
  'cash', 'bank_transfer', 'card',
]);

export const cashBookRefTypeEnum = pgEnum('cash_book_ref_type', [
  'order', 'purchase_order', 'expense', 'salary', 'tax', 'other',
]);

// ============================================================
// EXPENSE_CATEGORIES — Danh mục chi phí
// ============================================================

export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  type: expenseTypeEnum('type').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// INCOME_CATEGORIES — Danh mục thu nhập
// ============================================================

export const incomeCategories = pgTable('income_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// EXPENSES — Chi phí phát sinh
// ============================================================

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  expenseNumber: varchar('expense_number', { length: 30 }).unique().notNull(),
  categoryId: uuid('category_id').references(() => expenseCategories.id).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  description: text('description').notNull(),
  expenseDate: date('expense_date').notNull(),
  paymentMethod: expensePaymentMethodEnum('payment_method').notNull(),
  receiptUrl: text('receipt_url'),
  isTaxDeductible: boolean('is_tax_deductible').default(false).notNull(),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  approvedBy: uuid('approved_by').references(() => profiles.id),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// CASH_BOOK_ENTRIES — Sổ quỹ (Thu - Chi)
// Mỗi giao dịch tạo 1 entry, sổ quỹ luôn cân bằng
// ============================================================

export const cashBookEntries = pgTable('cash_book_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryNumber: varchar('entry_number', { length: 30 }).unique().notNull(),
  type: cashBookTypeEnum('type').notNull(),
  category: cashBookCategoryEnum('category').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  runningBalance: decimal('running_balance', { precision: 15, scale: 2 }).notNull(),
  paymentMethod: cashBookPaymentMethodEnum('payment_method').notNull(),
  referenceType: cashBookRefTypeEnum('reference_type'),
  referenceId: uuid('reference_id'),
  description: text('description').notNull(),
  entryDate: date('entry_date').notNull(),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  incomeCategoryId: uuid('income_category_id').references(() => incomeCategories.id),
}, (table) => [
  index('idx_cashbook_date').on(table.entryDate),
  index('idx_cashbook_type').on(table.type),
]);

// ============================================================
// ACCOUNTING_PERIODS — Quản lý kỳ đóng sổ kế toán
// ============================================================

export const accountingPeriods = pgTable('accounting_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  period: varchar('period', { length: 7 }).unique().notNull(), // Định dạng YYYY-MM, ví dụ "2026-05"
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isClosed: boolean('is_closed').default(false).notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: uuid('closed_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
