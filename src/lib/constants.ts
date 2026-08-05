import {
  LayoutDashboard,
  Package,
  Laptop,
  ShoppingCart,
  FileText,
  RotateCcw,
  Users,
  Wrench,
  Wallet,
  Receipt,
  BarChart3,
  Settings,
  Search,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// NAVIGATION
// ============================================================

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavItem[];
  roles?: ('admin' | 'staff')[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin'],
  },
  {
    title: 'Kho hàng',
    href: '/inventory',
    icon: Package,
  },
  {
    title: 'Sản phẩm',
    href: '/products',
    icon: Laptop,
  },
  {
    title: 'Đơn hàng',
    href: '/orders',
    icon: ShoppingCart,
  },
  {
    title: 'Báo giá',
    href: '/quotations',
    icon: FileText,
  },
  {
    title: 'Đổi/Trả',
    href: '/returns',
    icon: RotateCcw,
  },
  {
    title: 'Tra cứu',
    href: '/lookup',
    icon: Search,
  },
  {
    title: 'Bảo hành',
    href: '/warranty',
    icon: Wrench,
  },
  {
    title: 'Kế toán',
    href: '/accounting',
    icon: Wallet,
    roles: ['admin'],
    children: [
      { title: 'Tổng quan', href: '/accounting', icon: Wallet },
      { title: 'Chi phí', href: '/accounting/expenses', icon: Wallet },
      { title: 'Sổ quỹ', href: '/accounting/cashbook', icon: Wallet },
    ],
  },
  {
    title: 'Báo cáo',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin'],
  },
  {
    title: 'Cài đặt',
    href: '/settings',
    icon: Settings,
  },
];

// ============================================================
// STATUS LABELS & COLORS
// ============================================================

export const INVENTORY_STATUS = {
  incoming: { label: 'Đang về', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  in_stock: { label: 'Trong kho', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  sold: { label: 'Đã bán', color: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
  warranty_repair: { label: 'Đang BH', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  returned: { label: 'Đã trả', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  defective: { label: 'Lỗi', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
} as const;

export const ORDER_STATUS = {
  draft: { label: 'Nháp', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  processing: { label: 'Đang xử lý', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  completed: { label: 'Hoàn thành', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  refunded: { label: 'Đã hoàn tiền', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
} as const;

export const PO_STATUS = {
  draft: { label: 'Nháp', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  ordered: { label: 'Đã đặt', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  in_transit: { label: 'Đang vận chuyển', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  partially_received: { label: 'Nhận một phần', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  received: { label: 'Đã sẵn hàng', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  cancelled: { label: 'Đã hủy', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  warranty_supplier: { label: 'Bảo hành NCC', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  returned_supplier: { label: 'Đã trả NCC', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
} as const;

export const WARRANTY_STATUS = {
  pending: { label: 'Chờ xử lý', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  inspecting: { label: 'Đang kiểm tra', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  repairing: { label: 'Đang sửa', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  waiting_parts: { label: 'Chờ linh kiện', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  completed: { label: 'Hoàn thành', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  rejected: { label: 'Từ chối', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  replaced: { label: 'Đã thay thế', color: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
} as const;

export const PAYMENT_STATUS = {
  unpaid: { label: 'Chưa thanh toán', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  partial: { label: 'Thanh toán một phần', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  paid: { label: 'Đã thanh toán', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  refunded: { label: 'Đã hoàn tiền', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
} as const;

export const QUOTATION_STATUS = {
  draft: { label: 'Nháp', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  sent: { label: 'Chưa xem', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  viewed: { label: 'Khách đã xem', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' },
  accepted: { label: 'Khách đồng ý', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  rejected: { label: 'Khách từ chối', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  expired: { label: 'Hết hạn', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  converted: { label: 'Đã lên đơn', color: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
} as const;

export const ITEM_CONDITION = {
  new: { label: 'Mới 100%', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  like_new: { label: 'Like New 99%', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
  used_good: { label: 'Đã dùng (Tốt)', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  used_fair: { label: 'Đã dùng (Khá)', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  refurbished: { label: 'Refurbished', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
} as const;

// ============================================================
// LEAD SOURCES (seed data)
// ============================================================

export const DEFAULT_LEAD_SOURCES = [
  { name: 'Facebook', icon: '', color: '#0066CC' },
  { name: 'Chợ Tốt', icon: '', color: '#FF9500' },
  { name: 'Website', icon: '', color: '#34C759' },
  { name: 'Shopee', icon: '', color: '#FF5E3A' },
  { name: 'TikTok', icon: '', color: '#1D1D1F' },
  { name: 'Giới thiệu', icon: '', color: '#AF52DE' },
  { name: 'Khách cũ', icon: '', color: '#8E8E93' },
  { name: 'Khác', icon: '', color: '#636366' },
] as const;

// ============================================================
// APP CONFIG
// ============================================================

export const APP_CONFIG = {
  name: 'Nơi Bán Phụ Kiện',
  description: 'Hệ thống quản lý kho & bán hàng',
  currency: 'VND',
  locale: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  defaultWarrantyMonths: 12,
  stockAlertDays: {
    warning: 30,
    danger: 60,
    critical: 90,
  },
} as const;
