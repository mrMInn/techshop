import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { profiles } from './auth';

// ============================================================
// AUDIT_LOGS — Nhật ký hệ thống
// Ghi lại mọi thay đổi (CREATE, UPDATE, DELETE) trên tất cả bảng
// ============================================================

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id),
  action: varchar('action', { length: 50 }).notNull(), // CREATE, UPDATE, DELETE
  tableName: varchar('table_name', { length: 50 }).notNull(),
  recordId: uuid('record_id').notNull(),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_table').on(table.tableName),
  index('idx_audit_user').on(table.userId),
]);
