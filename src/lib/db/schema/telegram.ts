import { pgTable, uuid, varchar, text, boolean, timestamp, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { profiles } from './auth';

// ============================================================
// ENUMS
// ============================================================

export const telegramEventTypeEnum = pgEnum('telegram_event_type', [
  'order_created', 'order_completed', 'order_cancelled',
  'inventory_added', 'inventory_sold',
  'purchase_order_created', 'purchase_order_received',
  'warranty_created', 'warranty_status_changed',
  'expense_created', 'payment_received',
  'user_login', 'low_stock_alert',
]);

export const telegramLogStatusEnum = pgEnum('telegram_log_status', [
  'sent', 'failed', 'retrying',
]);

// ============================================================
// TELEGRAM_SETTINGS — Cấu hình Telegram Bot
// ============================================================

export const telegramSettings = pgTable('telegram_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  botToken: text('bot_token').notNull(),
  chatId: varchar('chat_id', { length: 50 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  
  // General Store Settings
  storeName: text('store_name'),
  storeAddress: text('store_address'),
  storePhone: varchar('store_phone', { length: 50 }),
  storeEmail: varchar('store_email', { length: 255 }),
  storeTaxCode: varchar('store_tax_code', { length: 50 }),
  
  // VietQR Config
  bankName: varchar('bank_name', { length: 100 }),
  bankAccount: varchar('bank_account', { length: 50 }),
  bankOwner: varchar('bank_owner', { length: 100 }),
  
  // Invoice Footer text
  invoiceFooter: text('invoice_footer'),
  
  // Rules & Thresholds
  defaultVat: integer('default_vat').default(10),
  defaultWarranty: integer('default_warranty').default(12),
  lowStockThreshold: integer('low_stock_threshold').default(2),
  stockAgingThreshold: integer('stock_aging_threshold').default(90),
});

// ============================================================
// TELEGRAM_NOTIFICATION_EVENTS — Cấu hình sự kiện thông báo
// ============================================================

export const telegramNotificationEvents = pgTable('telegram_notification_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramSettingId: uuid('telegram_setting_id').references(() => telegramSettings.id).notNull(),
  eventType: telegramEventTypeEnum('event_type').notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  template: text('template'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// TELEGRAM_NOTIFICATION_LOGS — Lịch sử gửi thông báo
// ============================================================

export const telegramNotificationLogs = pgTable('telegram_notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramSettingId: uuid('telegram_setting_id').references(() => telegramSettings.id).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  message: text('message').notNull(),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  status: telegramLogStatusEnum('status').notNull(),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_telegram_logs_event').on(table.eventType),
  index('idx_telegram_logs_status').on(table.status),
  index('idx_telegram_logs_sent').on(table.sentAt),
]);
