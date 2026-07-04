"use client";

import { Package, ShoppingCart, Users, Wrench, Settings, BarChart2, RefreshCcw, Wallet, FileText, Search, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, Fragment } from "react";
import { getCurrentUserAction, logoutAction } from "@/app/actions/auth";
import { toast } from "sonner";

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

function getPageTitle(path: string | null) {
  if (!path) return "Hệ thống";
  if (path === "/") return "Dashboard";
  if (path.startsWith("/inventory")) return "Kho hàng";
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{ fullName: string; role: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile once on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await getCurrentUserAction();
        if (res.success && res.profile) {
          setProfile(res.profile);
        } else {
          router.replace("/login");
        }
      } catch (err) {
        console.error("Lỗi tải thông tin tài khoản:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [router]);

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
    ...(isAdmin ? [{ href: "/", label: "Dashboard", icon: <BarChart2 size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-blue-500 to-blue-600 shadow-[0_2px_6px_rgba(0,113,227,0.15)]", match: (p: string) => p === "/" }] : []),
    { href: "/inventory", label: "Quản lý kho", icon: <Package size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-[0_2px_6px_rgba(48,209,88,0.15)]", match: (p: string) => p.startsWith("/inventory") },
    { href: "/orders", label: "Đơn hàng", icon: <ShoppingCart size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-pink-500 to-rose-600 shadow-[0_2px_6px_rgba(255,45,85,0.15)]", match: (p: string) => p.startsWith("/orders") },
    { href: "/quotations", label: "Báo giá", icon: <FileText size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_2px_6px_rgba(255,159,10,0.15)]", match: (p: string) => p.startsWith("/quotations") },
    { href: "/warranty", label: "Bảo hành", icon: <Wrench size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-[0_2px_6px_rgba(175,82,222,0.15)]", match: (p: string) => p.startsWith("/warranty") },
    { href: "/returns", label: "Đổi trả", icon: <RefreshCcw size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-sky-400 to-sky-500 shadow-[0_2px_6px_rgba(90,200,250,0.15)]", match: (p: string) => p.startsWith("/returns") },
    { href: "/lookup", label: "Tra cứu", icon: <Search size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-[0_2px_6px_rgba(255,204,0,0.15)]", match: (p: string) => p.startsWith("/lookup") },
    ...(isAdmin ? [{ href: "/accounting", label: "Sổ quỹ", icon: <Wallet size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-emerald-500 to-green-600 shadow-[0_2px_6px_rgba(48,209,88,0.15)]", match: (p: string) => p.startsWith("/accounting") }] : []),
  ];

  const settingsItem = isAdmin ? { href: "/settings", label: "Cấu hình hệ thống", icon: <Settings size={13} strokeWidth={2.5} />, bgColor: "bg-gradient-to-br from-slate-400 to-slate-500 shadow-[0_2px_6px_rgba(142,142,147,0.15)]", match: (p: string) => p.startsWith("/settings") } : null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 antialiased font-sans">
      
      {/* Apple Premium Frosted Glass Sidebar */}
      <aside className="w-64 bg-[#f8f9fa]/75 backdrop-blur-2xl border-r border-slate-200/80 hidden md:flex flex-col p-5 justify-between z-40 select-none">
        
        <div className="space-y-6">
          {/* Glowing Brand Header */}
          <div className="flex items-center gap-3 px-2.5 py-1.5 border-b border-slate-200/50 pb-4.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0066cc] to-[#0088ff] flex items-center justify-center shadow-[0_4px_12px_rgba(0,102,204,0.22)] transform hover:rotate-6 transition-all duration-300">
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
        <div className="space-y-3.5 border-t border-slate-200/50 pt-4">
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
      <main className="flex-1 bg-white overflow-y-auto p-8 relative">
        {/* Decorative Liquid Glass light beam background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#0066cc]/2 blur-[100px] rounded-full pointer-events-none z-0" />
        
        <div className="max-w-[1200px] mx-auto relative z-10 space-y-6">
          {/* Global Top Header: Title & Profile Info */}
          <div className="flex justify-between items-center pb-6 border-b border-[#e0e0e0] select-none">
            <h1 className="text-[40px] font-semibold tracking-tight leading-normal py-1 bg-clip-text text-transparent select-none shrink-0" style={{ backgroundImage: "linear-gradient(90deg, #2997ff, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {getPageTitle(pathname)}
            </h1>

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
      className={`group relative z-10 flex items-center gap-3 px-3.5 py-2 rounded-full transition-all duration-150 ease-out text-[13px] active:scale-[0.98] ${
        active 
          ? "bg-[#0071e3] text-white font-bold shadow-[0_2px_8px_rgba(0,113,227,0.18)]" 
          : "text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 font-semibold"
      }`}
    >
      <div className={`flex h-7.5 w-7.5 items-center justify-center rounded-[9px] shadow-sm border shrink-0 transition-all duration-150 ease-out group-hover:scale-[1.03] ${
        active 
          ? "bg-white/20 text-white border-transparent" 
          : `${bgColor} text-white border-white/20 group-hover:bg-white/25 group-hover:shadow-none`
      }`}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
      {hasSubmenu && (
        <span className={`ml-auto transition-transform duration-200 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`}>
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
  const [activeTab, setActiveTab] = useState("active");
  const [inventoryExpanded, setInventoryExpanded] = useState(!!pathname?.startsWith("/inventory"));
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
    <>
      {menuItems.map((item) => (
        <Fragment key={item.href}>
          <SidebarLink
            href={item.href}
            bgColor={item.bgColor}
            icon={item.icon}
            label={item.label}
            active={!!(pathname && item.match(pathname))}
            hasSubmenu={item.href === "/inventory" || item.href === "/accounting"}
            isSubmenuExpanded={
              item.href === "/inventory" 
                ? inventoryExpanded 
                : item.href === "/accounting" 
                  ? accountingExpanded 
                  : false
            }
            onClick={(e) => {
              if (item.href === "/inventory") {
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
          {item.href === "/inventory" && inventoryExpanded && (
            <div className="mt-1 mb-2 ml-4 pl-3.5 border-l border-slate-200/80 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
              <SubmenuLink 
                href="/inventory?tab=active" 
                label="Kho bán" 
                active={activeTab === "active"} 
              />
              <SubmenuLink 
                href="/inventory?tab=defective" 
                label="Kho lỗi" 
                active={activeTab === "defective"} 
              />
              <SubmenuLink 
                href="/inventory?tab=purchase_orders" 
                label="Đơn nhập hàng" 
                active={activeTab === "purchase_orders"} 
              />
              <SubmenuLink 
                href="/inventory?tab=returned" 
                label="Trả NCC" 
                active={activeTab === "returned"} 
              />
              <SubmenuLink 
                href="/inventory?tab=accessories" 
                label="Kho phụ kiện" 
                active={activeTab === "accessories"} 
              />
            </div>
          )}
          {item.href === "/accounting" && accountingExpanded && (
            <div className="mt-1 mb-2 ml-4 pl-3.5 border-l border-slate-200/80 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-200">
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
    </>
  );
}

function SubmenuLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      className={`group flex items-center py-2 px-4 rounded-full text-[12.5px] transition-all duration-150 ease-out cursor-pointer active:scale-[0.98] select-none ${
        active
          ? "bg-[#0071e3] text-white font-bold shadow-[0_2px_6px_rgba(0,113,227,0.12)]"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold"
      }`}
    >
      <span>{label}</span>
    </Link>
  );
}

