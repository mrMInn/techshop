"use client";

import { Package, ShoppingCart, Users, Wrench, Settings, BarChart2, RefreshCcw, Wallet, FileText, Search, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<{ fullName: string; role: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await getCurrentUserAction();
        if (res.success && res.profile) {
          setProfile(res.profile);
          
          // Redirect staff if they try to access restricted pages
          if (res.profile.role === "staff") {
            const isRestrictedPath = 
              pathname === "/" || 
              pathname?.startsWith("/accounting") || 
              pathname?.startsWith("/settings");
            if (isRestrictedPath) {
              router.replace("/orders");
            }
          }
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
  }, [pathname, router]);

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
            
            <nav className="space-y-1">
              {isAdmin && (
                <SidebarLink 
                  href="/" 
                  bgColor="bg-gradient-to-br from-blue-500 to-blue-600 shadow-[0_2px_6px_rgba(0,113,227,0.15)]"
                  icon={<BarChart2 size={13} strokeWidth={2.5} />} 
                  label="Dashboard" 
                  active={pathname === "/"} 
                />
              )}
              <SidebarLink 
                href="/inventory" 
                bgColor="bg-gradient-to-br from-teal-500 to-emerald-600 shadow-[0_2px_6px_rgba(48,209,88,0.15)]"
                icon={<Package size={13} strokeWidth={2.5} />} 
                label="Quản lý kho" 
                active={pathname?.startsWith("/inventory")} 
              />
              <SidebarLink 
                href="/orders" 
                bgColor="bg-gradient-to-br from-pink-500 to-rose-600 shadow-[0_2px_6px_rgba(255,45,85,0.15)]"
                icon={<ShoppingCart size={13} strokeWidth={2.5} />} 
                label="Đơn hàng" 
                active={pathname?.startsWith("/orders")} 
              />
              <SidebarLink 
                href="/quotations" 
                bgColor="bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_2px_6px_rgba(255,159,10,0.15)]"
                icon={<FileText size={13} strokeWidth={2.5} />} 
                label="Báo giá" 
                active={pathname?.startsWith("/quotations")} 
              />
              <SidebarLink 
                href="/warranty" 
                bgColor="bg-gradient-to-br from-purple-500 to-indigo-600 shadow-[0_2px_6px_rgba(175,82,222,0.15)]"
                icon={<Wrench size={13} strokeWidth={2.5} />} 
                label="Bảo hành" 
                active={pathname?.startsWith("/warranty")} 
              />
              <SidebarLink 
                href="/returns" 
                bgColor="bg-gradient-to-br from-sky-400 to-sky-500 shadow-[0_2px_6px_rgba(90,200,250,0.15)]"
                icon={<RefreshCcw size={13} strokeWidth={2.5} />} 
                label="Đổi trả" 
                active={pathname?.startsWith("/returns")} 
              />
              <SidebarLink 
                href="/lookup" 
                bgColor="bg-gradient-to-br from-yellow-400 to-amber-500 shadow-[0_2px_6px_rgba(255,204,0,0.15)]"
                icon={<Search size={13} strokeWidth={2.5} />} 
                label="Tra cứu" 
                active={pathname?.startsWith("/lookup")} 
              />
              {isAdmin && (
                <SidebarLink 
                  href="/accounting" 
                  bgColor="bg-gradient-to-br from-emerald-500 to-green-600 shadow-[0_2px_6px_rgba(48,209,88,0.15)]"
                  icon={<Wallet size={13} strokeWidth={2.5} />} 
                  label="Sổ quỹ" 
                  active={pathname?.startsWith("/accounting")} 
                />
              )}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer: System Config & Profile */}
        <div className="space-y-3.5 border-t border-slate-200/50 pt-4">
          {isAdmin && (
            <SidebarLink 
              href="/settings" 
              bgColor="bg-gradient-to-br from-slate-400 to-slate-500 shadow-[0_2px_6px_rgba(142,142,147,0.15)]"
              icon={<Settings size={13} strokeWidth={2.5} />} 
              label="Cấu hình hệ thống" 
              active={pathname?.startsWith("/settings")}
            />
          )}

          
          {/* Quick tactile Profile Chip */}
          <div className="flex items-center gap-3 px-3.5 py-2.5 bg-white/50 border border-slate-200/60 rounded-2xl shadow-[0_2px_6px_rgba(0,0,0,0.02)] select-none group relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0066cc]/10 to-[#0066cc]/5 border border-[#0066cc]/20 flex items-center justify-center font-black text-[12px] text-[#0066cc] shrink-0 shadow-sm">
              {getInitials(profile?.fullName || "")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-black text-slate-800 truncate leading-none">
                {profile?.fullName || "Đang tải..."}
              </p>
              <span className="text-[9.5px] font-extrabold text-[#009b72] uppercase tracking-wider leading-none mt-1 block select-none">
                {profile ? ROLE_MAP[profile.role] || profile.role : "..."}
              </span>
            </div>
            {profile && (
              <button 
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors duration-200 cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-white overflow-y-auto p-8 relative">
        {/* Decorative Liquid Glass light beam background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#0066cc]/2 blur-[100px] rounded-full pointer-events-none z-0" />
        
        <div className="max-w-[1200px] mx-auto relative z-10">
          {children}
        </div>
      </main>

    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  bgColor,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-[14px] transition-all duration-200 text-[13px] active:scale-[0.98] hover:scale-[1.01] ${
        active 
          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_4px_12px_rgba(0,102,204,0.18)] border-white/10 font-bold" 
          : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/30 hover:translate-x-0.5 font-semibold"
      }`}
    >
      <div className={`flex h-7.5 w-7.5 items-center justify-center rounded-[9.5px] shadow-sm border shrink-0 transition-colors duration-200 ${
        active 
          ? "bg-white/25 text-white border-white/20" 
          : `${bgColor} text-white border-white/20`
      }`}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
    </Link>
  );
}
