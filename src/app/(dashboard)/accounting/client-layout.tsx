"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Landmark, Receipt, FileText, Percent } from "lucide-react";

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    {
      label: "Nhật ký thu chi",
      href: "/accounting",
      active: pathname === "/accounting",
      
    },
    {
      label: "Chi phí vận hành",
      href: "/accounting/expenses",
      active: pathname === "/accounting/expenses",
      
    },
    {
      label: "Báo cáo tài chính",
      href: "/accounting/reports",
      active: pathname === "/accounting/reports",
      
    },
  ];

  return (
    <div 
      className="space-y-6"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
    >
      {/* Premium Tab Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#e0e0e0] pb-6 gap-4">
        <div>
          <h1 className="text-[40px] font-semibold tracking-tight leading-[1.10] bg-clip-text text-transparent select-none" style={{ backgroundImage: "linear-gradient(90deg, #2997ff, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Sổ quỹ
          </h1>
         
        </div>
        
        {/* Navigation tabs - Premium Apple Pill Segmented Control */}
        <div className="flex bg-[#f5f5f7] p-[3px] rounded-full border border-[#e0e0e0] gap-1 shrink-0 self-start md:self-auto select-none h-[40px] items-center">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center px-5 h-full rounded-full text-[13px] transition-all duration-200 select-none cursor-pointer active:scale-[0.98] ${
                tab.active
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.2)] border border-white/10 scale-[1.01]"
                  : "text-slate-600 hover:text-slate-900 font-semibold"
              }`}
            >
              <span>{tab.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="animate-fade-in">{children}</div>
    </div>
  );
}
