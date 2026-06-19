import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum('user_role', ['owner', 'manager', 'staff']);

// ============================================================
// PROFILES — Quản lý người dùng & phân quyền
// Extends từ auth.users của Supabase
// ============================================================

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // FK → auth.users.id (set manually, no default)
  fullName: varchar('full_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }).unique(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  role: userRoleEnum('role').notNull().default('staff'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
