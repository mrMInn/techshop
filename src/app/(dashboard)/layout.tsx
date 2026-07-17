"use client";

import { Package, ShoppingCart, Users, Wrench, Settings, BarChart2, RefreshCcw, Wallet, FileText, Search, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Fragment } from "react";
import { getCurrentUserAction, logoutAction } from "@/app/actions/auth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { getOrdersList } from "@/app/actions/orders";
import { getInventoryStats, getAccessoryStockSummary } from "@/app/actions/inventory";
import { getPurchaseOrdersList } from "@/app/actions/purchase-orders";

const ROLE_MAP: Record<string, string> = {
  admin: "Quản trị viên",
  staff: "Nhân viên",
};


function getInitials(name: string) {
  if (!name) return "TS";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPageTitle(path: string | null, searchParams?: any) {
  if (!path) return "Hệ thống";
  if (path === "/") return "Dashboard";
  if (path.startsWith("/inventory")) {
    const tab = searchParams?.get("tab") || "active";
    if (tab === "active") {
      const status = searchParams?.get("status") || "in_stock";
      if (status === "incoming") return "Hàng đang về";
      return "Kho bán";
    }
    if (tab === "defective") return "Kho lỗi";
    if (tab === "purchase_orders") return "Đơn nhập hàng";
    if (tab === "returned") return "Trả NCC";
    if (tab === "accessories") return "Kho phụ kiện";
    return "Kho hàng";
  }
  if (path.startsWith("/orders")) return "Đơn hàng";
  if (path.startsWith("/quotations")) return "Báo giá";
  if (path.startsWith("/warranty")) return "Bảo hành";
  if (path.startsWith("/returns")) return "Đổi trả";
  if (path.startsWith("/lookup")) return "Tra cứu";
  if (path.startsWith("/accounting/expenses")) return "Chi phí";
  if (path.startsWith("/accounting/reports")) return "Báo cáo tài chính";
  if (path.startsWith("/accounting")) return "Sổ quỹ";
  if (path.startsWith("/settings")) return "Cấu hình hệ thống";
  return "TechStore ERP";
}

function getBreadcrumbs(path: string | null, searchParams?: any): { label: string; href?: string }[] {
  if (!path) return [];
  const crumbs: { label: string; href?: string }[] = [];
  
  if (path === "/") {
    return [{ label: "Dashboard" }];
  }
  
  if (path.startsWith("/inventory")) {
    crumbs.push({ label: "Kho hàng", href: "/inventory" });
    const tab = searchParams?.get("tab") || "active";
    if (tab === "active") {
      const status = searchParams?.get("status") || "in_stock";
      if (status === "incoming") {
        crumbs.push({ label: "Hàng đang về" });
      } else {
        crumbs.push({ label: "Kho bán" });
      }
    } else if (tab === "defective") {
      crumbs.push({ label: "Kho lỗi" });
    } else if (tab === "purchase_orders") {
      crumbs.push({ label: "Đơn nhập hàng" });
    } else if (tab === "returned") {
      crumbs.push({ label: "Trả NCC" });
    } else if (tab === "accessories") {
      crumbs.push({ label: "Kho phụ kiện" });
    }
  } else if (path.startsWith("/orders")) {
    crumbs.push({ label: "Đơn hàng", href: "/orders" });
    const status = searchParams?.get("status");
    const channel = searchParams?.get("channel");
    if (status === "completed") {
      crumbs.push({ label: "Hoàn tất" });
    } else if (status === "processing") {
      crumbs.push({ label: "Đang giao" });
    } else if (status === "cancelled") {
      crumbs.push({ label: "Đã hủy" });
    } else if (channel === "online") {
      crumbs.push({ label: "Kênh Online" });
    } else {
      crumbs.push({ label: "Tất cả đơn" });
    }
  } else if (path.startsWith("/quotations")) {
    crumbs.push({ label: "Báo giá", href: "/quotations" });
  } else if (path.startsWith("/warranty")) {
    crumbs.push({ label: "Bảo hành", href: "/warranty" });
  } else if (path.startsWith("/returns")) {
    crumbs.push({ label: "Đổi trả", href: "/returns" });
  } else if (path.startsWith("/lookup")) {
    crumbs.push({ label: "Tra cứu", href: "/lookup" });
  } else if (path.startsWith("/accounting/expenses")) {
    crumbs.push({ label: "Sổ quỹ", href: "/accounting" });
    crumbs.push({ label: "Chi phí vận hành" });
  } else if (path.startsWith("/accounting/reports")) {
    crumbs.push({ label: "Sổ quỹ", href: "/accounting" });
    crumbs.push({ label: "Báo cáo tài chính" });
  } else if (path.startsWith("/accounting")) {
    crumbs.push({ label: "Sổ quỹ", href: "/accounting" });
    crumbs.push({ label: "Nhật ký thu chi" });
  } else if (path.startsWith("/settings")) {
    crumbs.push({ label: "Cấu hình hệ thống", href: "/settings" });
  }
  
  return crumbs;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const breadcrumbs = getBreadcrumbs(pathname, searchParams);
  // Fetch profile via TanStack Query for automatic caching, deduplication, and resilience against DB locks
  const { data: profileData, isLoading: loading } = useQuery({
    queryKey: ["currentUserProfile"],
    queryFn: () => getCurrentUserAction(),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes to avoid database queries on transition
  });

  const profile = profileData?.profile || null;

  // Handle unauthenticated user redirect
  useEffect(() => {
    if (profileData && (!profileData.success || !profileData.profile)) {
      router.replace("/login");
    }
  }, [profileData, router]);

  // Handle staff redirect on path change
  useEffect(() => {
    if (!profile) return;
    if (profile.role === "staff") {
      const isRestrictedPath = 
        pathname === "/" || 
        pathname?.startsWith("/accounting") || 
        pathname?.startsWith("/settings");
      if (isRestrictedPath) {
        router.replace("/orders");
      }
    }
  }, [pathname, profile, router]);

  const handleLogout = async () => {
    try {
      toast.info("Đang đăng xuất...");
      const res = await logoutAction();
      if (res.success) {
        toast.success("Đăng xuất thành công!");
        router.push("/login");
        router.refresh();
      } else {
        toast.error(res.error || "Đăng xuất thất bại.");
      }
    } catch (err: any) {
      toast.error("Đăng xuất thất bại: " + err.message);
    }
  };


  const isAdmin = !loading && profile?.role === "admin";

  // Build menu items list based on role
  const menuItems = [
    ...(isAdmin ? [{ href: "/", label: "Dashboard", icon: <BarChart2 size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#2ea1ff] to-[#0066cc]", match: (p: string) => p === "/" }] : []),
    { href: "/inventory", label: "Quản lý kho", icon: <Package size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#34c759] to-[#28a745]", match: (p: string) => p.startsWith("/inventory") },
    { href: "/orders", label: "Đơn hàng", icon: <ShoppingCart size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#ff2d55] to-[#d6001c]", match: (p: string) => p.startsWith("/orders") },
    { href: "/quotations", label: "Báo giá", icon: <FileText size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#ff9f0a] to-[#ff7b00]", match: (p: string) => p.startsWith("/quotations") },
    { href: "/warranty", label: "Bảo hành", icon: <Wrench size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#af52de] to-[#7a2bc2]", match: (p: string) => p.startsWith("/warranty") },
    { href: "/returns", label: "Đổi trả", icon: <RefreshCcw size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#5ac8fa] to-[#0071e3]", match: (p: string) => p.startsWith("/returns") },
    { href: "/lookup", label: "Tra cứu", icon: <Search size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#ffcc00] to-[#ff9500]", match: (p: string) => p.startsWith("/lookup") },
    ...(isAdmin ? [{ href: "/accounting", label: "Sổ quỹ", icon: <Wallet size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#34c759] to-[#28a745]", match: (p: string) => p.startsWith("/accounting") }] : []),
  ];

  const settingsItem = isAdmin ? { href: "/settings", label: "Cấu hình hệ thống", icon: <Settings size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-[#8e8e93] to-[#636366]", match: (p: string) => p.startsWith("/settings") } : null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 antialiased font-sans">
      
      {/* Apple Premium Frosted Glass Sidebar */}
      <aside className="w-64 bg-[#f5f5f7]/80 backdrop-blur-2xl border-r border-[#e0e0e0]/80 hidden md:flex flex-col p-5 justify-between z-40 select-none">
        
        <div className="space-y-6">
          {/* Glowing Brand Header */}
          <div className="flex items-center gap-3 px-2.5 py-1.5 border-b border-[#e0e0e0]/50 pb-4.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] flex items-center justify-center transform hover:rotate-6 transition-all duration-300">
              <BarChart2 className="text-white" size={17} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] font-bold text-slate-800 tracking-tight leading-none">
                TechStore ERP
              </h1>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#0066cc] leading-none mt-1 block">
                Workspace
              </span>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2">Chọn chức năng</p>
            
            <nav className="relative space-y-1">
              <SidebarNavList
                menuItems={menuItems}
                pathname={pathname}
              />
            </nav>
          </div>
        </div>

        {/* Sidebar Footer: System Config & Profile */}
        <div className="space-y-3.5 border-t border-[#e0e0e0]/50 pt-4">
          {settingsItem && (
            <SidebarLink
              href={settingsItem.href}
              bgColor={settingsItem.bgColor}
              icon={settingsItem.icon}
              label={settingsItem.label}
              active={!!(pathname && settingsItem.match(pathname))}
            />
          )}
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-white overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
        {/* Decorative Liquid Glass light beam background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#0066cc]/2 blur-[100px] rounded-full pointer-events-none z-0" />
        
        <div className="max-w-[1440px] mx-auto relative z-10 space-y-6">
          {/* Global Top Header: Title & Profile Info */}
          <div className="flex justify-between items-center pb-6 border-b border-[#e0e0e0] select-none">
            <div className="flex items-center gap-6 min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0">
                {/* Breadcrumbs tree */}
                {breadcrumbs.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 select-none">
                    {breadcrumbs.map((crumb, idx) => (
                      <Fragment key={crumb.label}>
                        {idx > 0 && <span className="text-slate-300">/</span>}
                        {crumb.href ? (
                          <Link 
                            href={crumb.href} 
                            scroll={false}
                            className="hover:text-[#0066cc] transition-colors"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className="text-[#0066cc] font-extrabold">{crumb.label}</span>
                        )}
                      </Fragment>
                    ))}
                  </div>
                )}
                
                <h1 className="text-[40px] font-semibold tracking-tight leading-normal py-1 bg-clip-text text-transparent select-none shrink-0" style={{ backgroundImage: "linear-gradient(90deg, #2997ff, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {getPageTitle(pathname, searchParams)}
                </h1>
              </div>
              {/* Portal target for custom header components (like page stats) */}
              <div id="header-custom-portal" className="hidden lg:flex items-center gap-2.5" />
            </div>

            <div 
              style={{
                transitionProperty: "all",
                transitionDuration: "800ms",
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)"
              }}
              className="flex items-center bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] rounded-full select-none shadow-[0_1px_2px_rgba(0,0,0,0.01)] group relative h-11 p-1 max-w-[46px] hover:max-w-[260px] overflow-hidden"
            >
              <div className="w-[36px] h-[36px] rounded-full bg-gradient-to-tr from-[#2997ff] via-[#a855f7] to-[#ec4899] flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.05)] shrink-0">
                <svg className="w-[18px] h-[18px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <span 
                style={{
                  transitionProperty: "all",
                  transitionDuration: "800ms",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: "200ms"
                }}
                className="text-[13.5px] font-semibold text-[#1d1d1f] tracking-tight leading-none whitespace-nowrap opacity-0 transform translate-x-[-12px] group-hover:opacity-100 group-hover:translate-x-0 shrink-0 ml-3"
              >
                {profile?.fullName || "Đang tải..."}
              </span>
              {profile && (
                <button 
                  onClick={handleLogout}
                  style={{
                    transitionProperty: "all",
                    transitionDuration: "600ms",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    transitionDelay: "300ms"
                  }}
                  className="w-8 h-8 rounded-full hover:bg-rose-500 hover:text-white text-[#7a7a7a] flex items-center justify-center cursor-pointer ml-2.5 active:scale-90 opacity-0 transform scale-50 group-hover:opacity-100 group-hover:scale-100 shrink-0 mr-1.5"
                  title="Đăng xuất"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>

          {children}
        </div>
      </main>

    </div>
  );
}

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  active?: boolean;
  hasSubmenu?: boolean;
  isSubmenuExpanded?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function SidebarLink({ 
  href, 
  icon, 
  label, 
  bgColor, 
  active, 
  hasSubmenu, 
  isSubmenuExpanded, 
  onClick 
}: SidebarLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      prefetch={false}
      className={`group relative z-10 flex items-center gap-3 px-3.5 py-2 rounded-full transition-all duration-200 ease-out text-[13px] active:scale-[0.98] hover:translate-x-[2px] ${
        active 
          ? "bg-[#0066cc]/10 text-[#0066cc] font-semibold" 
          : "text-[#1d1d1f] hover:bg-slate-200/60 font-semibold"
      }`}
    >
      <div className={`sidebar-icon-container flex h-7.5 w-7.5 items-center justify-center rounded-[8px] border border-white/10 shrink-0 transition-transform duration-200 ease-out group-hover:scale-[1.08] ${bgColor} text-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]`}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
      {hasSubmenu && (
        <span className={`ml-auto transition-transform duration-200 ${active ? "text-[#0066cc]" : "text-slate-400 group-hover:text-slate-600"}`}>
          {isSubmenuExpanded ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          )}
        </span>
      )}
    </Link>
  );
}

function SidebarNavList({ 
  menuItems, 
  pathname, 
}: { 
  menuItems: any[]; 
  pathname: string | null; 
}) {
  const searchParams = useSearchParams();
  
  // Fetch order counts for sidebar badges
  const { data: statsData } = useQuery({
    queryKey: ["orders", "stats-sidebar"],
    queryFn: () => getOrdersList({ page: 1, limit: 1, search: "", status: "all", paymentStatus: "all", saleChannel: "all" }),
  });
  const stats = statsData?.stats || { completedCount: 0, processingCount: 0, cancelledCount: 0, onlineCount: 0 };
  const totalCount = statsData?.pagination?.totalItems || 0;

  // Fetch inventory stats for sidebar badges
  const { data: invStats } = useQuery({
    queryKey: ["inventory_stats"],
    queryFn: () => getInventoryStats(),
  });

  // Fetch purchase orders list for sidebar badges
  const { data: poList } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => getPurchaseOrdersList(),
  });

  // Fetch accessories stock summary for sidebar badges
  const { data: accSummary } = useQuery({
    queryKey: ["accessoryStockSummary"],
    queryFn: () => getAccessoryStockSummary(),
  });

  // Calculate accessory total count
  const totalAccCount = accSummary?.summary?.reduce((sum: number, cat: any) => sum + (cat.total || 0), 0) || 0;

  const [activeTab, setActiveTab] = useState("active");
  const [inventoryExpanded, setInventoryExpanded] = useState(!!pathname?.startsWith("/inventory"));
  const [ordersExpanded, setOrdersExpanded] = useState(!!pathname?.startsWith("/orders"));
  const [accountingExpanded, setAccountingExpanded] = useState(!!pathname?.startsWith("/accounting"));
  const lastPathRef = useRef(pathname);

  useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        setActiveTab(params.get("tab") || "active");
      }
    };

    handleUrlChange();

    window.addEventListener("popstate", handleUrlChange);

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setTimeout(handleUrlChange, 0);
    };
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      setTimeout(handleUrlChange, 0);
    };

    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [pathname]);

  useEffect(() => {
    const wasInInventory = lastPathRef.current?.startsWith("/inventory");
    const isInInventory = pathname?.startsWith("/inventory");
    if (isInInventory && !wasInInventory) {
      setInventoryExpanded(true);
    } else if (!isInInventory) {
      setInventoryExpanded(false);
    }

    const wasInOrders = lastPathRef.current?.startsWith("/orders");
    const isInOrders = pathname?.startsWith("/orders");
    if (isInOrders && !wasInOrders) {
      setOrdersExpanded(true);
    } else if (!isInOrders) {
      setOrdersExpanded(false);
    }

    const wasInAccounting = lastPathRef.current?.startsWith("/accounting");
    const isInAccounting = pathname?.startsWith("/accounting");
    if (isInAccounting && !wasInAccounting) {
      setAccountingExpanded(true);
    } else if (!isInAccounting) {
      setAccountingExpanded(false);
    }

    lastPathRef.current = pathname;
  }, [pathname]);

  return (
    <div className="flex flex-col gap-1">
      {menuItems.map((item) => (
        <Fragment key={item.href}>
          <SidebarLink
            href={item.href}
            bgColor={item.bgColor}
            icon={item.icon}
            label={item.label}
            active={!!(pathname && item.match(pathname))}
            hasSubmenu={item.href === "/orders" || item.href === "/inventory" || item.href === "/accounting"}
            isSubmenuExpanded={
              item.href === "/orders"
                ? ordersExpanded
                : item.href === "/inventory" 
                  ? inventoryExpanded 
                  : item.href === "/accounting" 
                    ? accountingExpanded 
                    : false
            }
            onClick={(e) => {
              if (item.href === "/orders") {
                if (pathname?.startsWith("/orders")) {
                  e.preventDefault();
                  setOrdersExpanded(!ordersExpanded);
                } else {
                  setOrdersExpanded(true);
                }
              } else if (item.href === "/inventory") {
                if (pathname?.startsWith("/inventory")) {
                  // Toggle collapse when clicking on the already active link
                  e.preventDefault();
                  setInventoryExpanded(!inventoryExpanded);
                } else {
                  // Open dropdown when navigating to inventory
                  setInventoryExpanded(true);
                }
              } else if (item.href === "/accounting") {
                if (pathname?.startsWith("/accounting")) {
                  // Toggle collapse when clicking on the already active link
                  e.preventDefault();
                  setAccountingExpanded(!accountingExpanded);
                } else {
                  // Open dropdown when navigating to accounting
                  setAccountingExpanded(true);
                }
              }
            }}
          />
          {item.href === "/orders" && ordersExpanded && (
            <div className="mt-1 mb-2 ml-4 pl-3.5 border-l border-[#e0e0e0]/80 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
              <SubmenuLink 
                href="/orders" 
                label="Tất cả đơn" 
                active={pathname === "/orders" && !searchParams.get("status") && !searchParams.get("channel")} 
                badge={totalCount}
              />
              <SubmenuLink 
                href="/orders?status=completed" 
                label="Hoàn tất" 
                active={pathname === "/orders" && searchParams.get("status") === "completed"} 
                badge={stats.completedCount}
              />
              <SubmenuLink 
                href="/orders?status=processing" 
                label="Đang giao" 
                active={pathname === "/orders" && searchParams.get("status") === "processing"} 
                badge={stats.processingCount}
              />
              <SubmenuLink 
                href="/orders?channel=online" 
                label="Kênh Online" 
                active={pathname === "/orders" && searchParams.get("channel") === "online"} 
                badge={stats.onlineCount}
              />
              <SubmenuLink 
                href="/orders?status=cancelled" 
                label="Đã hủy" 
                active={pathname === "/orders" && searchParams.get("status") === "cancelled"} 
                badge={stats.cancelledCount}
              />
            </div>
          )}
          {item.href === "/inventory" && inventoryExpanded && (
            <div className="mt-1 mb-2 ml-4 pl-3.5 border-l border-[#e0e0e0]/80 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
              <SubmenuLink 
                href="/inventory?tab=active&status=in_stock" 
                label="Kho bán" 
                active={(activeTab === "active" && searchParams.get("status") === "in_stock") || (pathname === "/inventory" && !searchParams.get("tab") && !searchParams.get("status"))} 
                badge={invStats?.inStock}
              />
              <SubmenuLink 
                href="/inventory?tab=active&status=incoming" 
                label="Hàng đang về" 
                active={activeTab === "active" && searchParams.get("status") === "incoming"} 
                badge={invStats?.incoming}
              />
              <SubmenuLink 
                href="/inventory?tab=defective" 
                label="Kho lỗi" 
                active={activeTab === "defective"} 
                badge={invStats?.defective}
              />
              <SubmenuLink 
                href="/inventory?tab=purchase_orders" 
                label="Đơn nhập hàng" 
                active={activeTab === "purchase_orders"} 
                badge={poList?.purchaseOrders?.length}
              />
              <SubmenuLink 
                href="/inventory?tab=returned" 
                label="Trả NCC" 
                active={activeTab === "returned"} 
                badge={invStats?.returned}
              />
              <SubmenuLink 
                href="/inventory?tab=accessories" 
                label="Kho phụ kiện" 
                active={activeTab === "accessories"} 
                badge={totalAccCount}
              />
            </div>
          )}
          {item.href === "/accounting" && accountingExpanded && (
            <div className="mt-1 mb-2 ml-4 pl-3.5 border-l border-[#e0e0e0]/80 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
              <SubmenuLink 
                href="/accounting" 
                label="Nhật ký thu chi" 
                active={pathname === "/accounting"} 
              />
              <SubmenuLink 
                href="/accounting/expenses" 
                label="Chi phí vận hành" 
                active={pathname === "/accounting/expenses"} 
              />
              <SubmenuLink 
                href="/accounting/reports" 
                label="Báo cáo tài chính" 
                active={pathname === "/accounting/reports"} 
              />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function SubmenuLink({ href, label, active, badge }: { href: string; label: string; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      className={`group relative flex items-center justify-between py-2 px-4 rounded-full text-[12.5px] transition-all duration-150 ease-out cursor-pointer active:scale-[0.98] select-none ${
        active
          ? "bg-[#0066cc]/10 text-[#0066cc] font-semibold"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold"
      }`}
    >
      {/* Horizontal connector line pointing back to parent vertical border */}
      <span 
        className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-[1.5px] transition-colors duration-200 ${
          active ? "bg-[#0066cc]" : "bg-[#e0e0e0]/80 group-hover:bg-slate-400"
        }`} 
        style={{ left: "-14px" }}
      />
      
      <span className="truncate">{label}</span>
      {badge !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors duration-200 ${
          active ? "bg-[#0066cc] text-white" : "bg-slate-200/50 text-[#7a7a7a] group-hover:bg-slate-300/50"
        }`}>
          {badge}
        </span>
      )}
    </Link>
  );
}

