// ============================================================
// Shared TypeScript types
// ============================================================

export type UserRole = 'admin' | 'staff';

export type ItemCondition = 'new' | 'like_new' | 'used_good' | 'used_fair' | 'refurbished';

export type ItemStatus = 'incoming' | 'in_stock' | 'sold' | 'warranty_repair' | 'returned' | 'defective';

export type OrderStatus = 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled' | 'refunded';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export type SaleChannel = 'online' | 'offline' | 'phone';

export type POStatus = 'draft' | 'ordered' | 'in_transit' | 'partially_received' | 'received' | 'cancelled';

export type WarrantyStatus = 'pending' | 'inspecting' | 'repairing' | 'waiting_parts' | 'completed' | 'rejected' | 'replaced';

export type QuotationStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'converted';

export type ReturnType = 'return' | 'exchange';

// Product Specs (JSONB)
export interface ProductSpecs {
  cpu?: string;
  ram?: string;
  ssd?: string;
  gpu?: string;
  screen?: string;
  battery?: string;
  weight?: string;
  color?: string;
  os?: string;
  ports?: string;
  [key: string]: string | undefined;
}

// Dashboard Stats
export interface DashboardStats {
  totalInventoryValue: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  totalOrders: number;
  inStockCount: number;
  incomingCount: number;
  warrantyCount: number;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
