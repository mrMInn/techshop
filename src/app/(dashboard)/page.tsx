"use client";

import { useQuery } from "@tanstack/react-query";
import { getFinancialSummary, getDashboardBentoData } from "@/app/actions/accounting";
import { getAgedInventoryItems, getInventoryCapitalSummary } from "@/app/actions/inventory";
import { SFSymbolBanknote, SFSymbolCreditCard } from "@/components/ui/apple-icons";
import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

// Lazy load the chart component (recharts ~200KB will NOT be in initial bundle)
const DashboardChartSection = dynamic(() => import("./DashboardChart"), {
  ssr: false,
  loading: () => (
    <section className="relative rounded-[28px] border border-white/70 bg-white/45 backdrop-blur-xl shadow-[0_12px_32px_rgba(31,38,135,0.03),inset_0_1px_1px_rgba(255,255,255,0.7)] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/5 to-white/20 pointer-events-none" />
      <div className="relative z-10 p-5 animate-pulse space-y-4">
        <div className="h-10 bg-white/40 rounded-full w-[280px]" />
        <div className="h-[310px] rounded-[24px] bg-white/20 border border-white/70" />
      </div>
    </section>
  ),
});

// Helper function to concatenate classes
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Formatting helpers
function formatCurrency(value: number) {
  return `${Math.round(value || 0).toLocaleString("vi-VN")}đ`;
}

// Date formatting helper
function formatToDDMMYYYY(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    return `${d}/${m}/${y}`;
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

// Specs formatting helper
function getSpecsLabel(productSpecs: any) {
  if (!productSpecs) return "";
  try {
    const specs = typeof productSpecs === "string" ? JSON.parse(productSpecs) : productSpecs;
    const parts = [];
    if (specs.cpu) parts.push(specs.cpu);
    if (specs.ram) parts.push(specs.ram);
    if (specs.ssd) parts.push(specs.ssd);
    if (specs.screen) parts.push(specs.screen);
    return parts.join(" / ");
  } catch {
    return "";
  }
}

// SF Symbol: chart.line.uptrend.xyaxis / trending.up
function SFSymbolTrendingUp({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

// macOS Liquid Glass card container
function KinhPanel({
  children,
  className,
  overflowVisible = false,
}: {
  children: React.ReactNode;
  className?: string;
  overflowVisible?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative rounded-[28px] border border-white/70 bg-white/45 backdrop-blur-xl shadow-[0_12px_32px_rgba(31,38,135,0.03),inset_0_1px_1px_rgba(255,255,255,0.7)] hover:bg-white/55 hover:shadow-[0_20px_50px_rgba(0,102,204,0.05)] hover:-translate-y-0.5 transition-all duration-300",
        overflowVisible ? "overflow-visible" : "overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/5 to-white/20 pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

// SF Symbol: shippingbox / box
function SFSymbolShippingBox({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

// SF Symbol: wrench / screwdriver
function SFSymbolWrench({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

// SF Symbol: coins / centralbank
function SFSymbolCoins({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="6" />
      <circle cx="18" cy="18" r="4" />
      <path d="M12 18a6 6 0 0 0-6-6" />
    </svg>
  );
}

// KPI card with Apple Shortcuts dynamic gradient styling (Compact design for 6 columns grid)
function TheChiSo({
  nhan,
  giaTri,
  bgGradient,
  icon,
}: {
  nhan: string;
  giaTri: string;
  bgGradient: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[20px] p-4 flex flex-col justify-between h-[105px] text-white shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:scale-[1.02] hover:shadow-[0_12px_24px_rgba(0,0,0,0.1)] transition-all duration-300 border border-white/10 overflow-hidden group select-none cursor-pointer"
      )}
    >
      {/* Background Gradient */}
      <div className={cn("absolute inset-0 z-0", bgGradient)} />
      
      {/* Gloss shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

      {/* Top Row with Label and Icon */}
      <div className="relative z-20 flex justify-between items-start">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/85 line-clamp-1">
          {nhan}
        </span>
        {icon && (
          <div className="w-7 h-7 rounded-[8px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative z-20 text-[22px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
        {giaTri}
      </div>
    </div>
  );
}

// KPI Cards Skeleton
function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
      {[1, 2, 3].map((colIdx) => (
        <div key={colIdx} className="flex flex-col gap-3">
          <div className="rounded-[20px] h-[105px] bg-slate-200/50" />
          <div className="rounded-[20px] h-[105px] bg-slate-200/50" />
        </div>
      ))}
    </div>
  );
}

// Inventory Skeleton
function InventorySkeleton() {
  return (
    <KinhPanel className="p-5 bg-white/35 backdrop-blur-xl h-[480px]">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-white/40 rounded w-[250px]" />
        <div className="h-px bg-slate-200/60" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white/20 rounded-[20px] border border-white/60" />
        ))}
      </div>
    </KinhPanel>
  );
}

// Capital Skeleton
function CapitalSkeleton() {
  return (
    <KinhPanel className="p-5 bg-white/35 backdrop-blur-xl h-[480px]">
      <div className="animate-pulse space-y-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
            <div className="h-6 bg-white/40 rounded w-[180px]" />
            <div className="h-6 bg-white/40 rounded w-[120px]" />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div className="h-16 bg-white/20 rounded-[20px] border border-white/60" />
            <div className="h-16 bg-white/20 rounded-[20px] border border-white/60" />
          </div>
          <div className="space-y-3.5">
            <div className="h-4 bg-white/30 rounded w-[150px]" />
            {[1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-4 bg-white/20 rounded w-[100px]" />
                  <div className="h-4 bg-white/20 rounded w-[70px]" />
                </div>
                <div className="h-2 bg-white/10 rounded-full w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </KinhPanel>
  );
}



export default function DashboardHome() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [kyTaiChinh, setKyTaiChinh] = useState<"today" | "month">("month");
  const [thangDuocChon, setThangDuocChon] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  // Callback for chart month change (stable ref via useCallback)
  const handleChartMonthChange = useCallback((month: string) => {
    setThangDuocChon(month);
  }, []);



  const {
    data: financialSummary,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
  } = useQuery({
    queryKey: ["financial_summary"],
    queryFn: () => getFinancialSummary(),
    enabled: mounted,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: agedInventoryData,
    isLoading: isInventoryLoading,
    isFetching: isInventoryFetching,
  } = useQuery({
    queryKey: ["aged_inventory_items"],
    queryFn: () => getAgedInventoryItems(45),
    enabled: mounted,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: capitalData,
    isLoading: isCapitalLoading,
    isFetching: isCapitalFetching,
  } = useQuery({
    queryKey: ["inventory_capital_summary"],
    queryFn: () => getInventoryCapitalSummary(),
    enabled: mounted,
    staleTime: 5 * 60 * 1000,
  });

    const {
    data: bentoData,
    isLoading: isBentoLoading,
    isFetching: isBentoFetching,
  } = useQuery({
    queryKey: ["dashboard_bento_stats", thangDuocChon],
    queryFn: () => getDashboardBentoData(thangDuocChon),
    enabled: mounted,
    staleTime: 5 * 60 * 1000,
  });

  const isRefreshing = isBentoFetching || isSummaryFetching || isInventoryFetching || isCapitalFetching;

  // Month selector options
  const luaChonThang = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      options.push({
        value: val,
        label: `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
      });
    }
    return options;
  }, []);

  // Aged inventory with client-side pagination
  const agedItems = useMemo(() => agedInventoryData?.agedItems || [], [agedInventoryData]);
  const tongVonDong = agedInventoryData?.tongVonDong || 0;
  const [visibleAgedCount, setVisibleAgedCount] = useState(20);

  const visibleAgedItems = useMemo(() => {
    return agedItems.slice(0, visibleAgedCount);
  }, [agedItems, visibleAgedCount]);

  // Chart data (memoized)
  const chartData = useMemo(() => financialSummary?.chartData || [], [financialSummary]);
  const monthlyChartData = useMemo(() => financialSummary?.monthlyChartData || [], [financialSummary]);

  // KPI computed values (memoized)
  const { tongDoanhThu, tongChiPhi, tongLoiNhuan, nhanThang, tonKhoBanHang, tonKhoBaoHanh, giaVonTonKho } = useMemo(() => {
    const data = bentoData || {
      todayIncome: 0, todayExpense: 0, todayNetProfit: 0,
      thisMonthIncome: 0, thisMonthExpense: 0, thisMonthNetProfit: 0,
      warranty: { pending: 0, inspecting: 0, repairing: 0, waiting_parts: 0, completed: 0 }
    };
    const doanhThu = kyTaiChinh === "today" ? Number(data.todayIncome || 0) : Number(data.thisMonthIncome || 0);
    const chiPhi = kyTaiChinh === "today" ? Number(data.todayExpense || 0) : Number(data.thisMonthExpense || 0);
    const loiNhuan = kyTaiChinh === "today" ? Number(data.todayNetProfit || 0) : Number(data.thisMonthNetProfit || 0);
    const nhan = luaChonThang.find((opt) => opt.value === thangDuocChon)?.label || "Tháng hiện tại";

    // New inventory stats
    const machineCount = capitalData?.machineCapital?.count || 0;
    const accessoryCount = capitalData?.accessoryCapital?.count || 0;
    const salesInv = machineCount + accessoryCount;

    const wPending = data.warranty?.pending || 0;
    const wInspecting = data.warranty?.inspecting || 0;
    const wRepairing = data.warranty?.repairing || 0;
    const wWaiting = data.warranty?.waiting_parts || 0;
    const activeWarr = wPending + wInspecting + wRepairing + wWaiting;

    const totalCap = capitalData?.totalCapital || 0;

    return {
      tongDoanhThu: doanhThu,
      tongChiPhi: chiPhi,
      tongLoiNhuan: loiNhuan,
      nhanThang: nhan,
      tonKhoBanHang: salesInv,
      tonKhoBaoHanh: activeWarr,
      giaVonTonKho: totalCap
    };
  }, [bentoData, kyTaiChinh, thangDuocChon, luaChonThang, capitalData]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#f4f7f6]">
        <div className="mx-auto max-w-[1450px] px-4 md:px-5 py-5 md:py-6">
          <div className="space-y-4 animate-pulse">
            <div className="h-[40px]" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(colIdx => (
                <div key={colIdx} className="flex flex-col gap-3">
                  <div className="rounded-[20px] h-[105px] bg-slate-200/50" />
                  <div className="rounded-[20px] h-[105px] bg-slate-200/50" />
                </div>
              ))}
            </div>
            <div className="rounded-[28px] border border-white/60 bg-white/70 h-[400px]" />
            <div className="rounded-[28px] border border-white/60 bg-white/70 h-[300px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-900 relative overflow-hidden font-sans pb-8">
      {/* Floating macOS Liquid Glass light blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-gradient-to-tr from-sky-300/15 to-sky-200/25 blur-3xl animate-pulse" />
        <div className="absolute top-[20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-gradient-to-br from-indigo-300/20 to-pink-300/15 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[20%] h-[40%] w-[45%] rounded-full bg-gradient-to-tr from-emerald-300/10 to-teal-300/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1450px] px-4 md:px-5 py-5 md:py-6">
        <div className="space-y-5">
          {/* Apple-style Dashboard Hero Header */}
          <div className="pb-2">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
              <div>
                <p className="text-[15px] font-semibold text-slate-500">
                  {(() => {
                    const now = new Date();
                    const hour = now.getHours();
                    const greeting =
                      hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
                    const dayNames = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
                    const dayOfWeek = dayNames[now.getDay()];
                    const dd = String(now.getDate()).padStart(2, "0");
                    const mm = String(now.getMonth() + 1).padStart(2, "0");
                    const yyyy = now.getFullYear();
                    return `${greeting} — ${dayOfWeek}, ${dd}/${mm}/${yyyy}`;
                  })()}
                </p>
              </div>

              {isRefreshing && (
                <div className="flex items-center gap-1.5 px-3 h-[36px] rounded-full bg-[#0066cc]/8 border border-[#0066cc]/15 text-[#0066cc]">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  <span className="text-[12px] font-semibold">Đang cập nhật...</span>
                </div>
              )}
            </div>
          </div>

          {/* Metric Cards Grid — Progressive: shows skeleton only for this section */}
          {isBentoLoading ? (
            <KPISkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cột 1: Tài chính (Doanh thu & Chi phí) */}
              <div className="flex flex-col gap-3">
                <TheChiSo
                  nhan={`Doanh thu (${nhanThang})`}
                  giaTri={formatCurrency(tongDoanhThu)}
                  bgGradient="bg-gradient-to-br from-[#2ea1ff] to-[#0066cc]"
                  icon={<SFSymbolBanknote size={16} />}
                />
                <TheChiSo
                  nhan={`Chi phí (${nhanThang})`}
                  giaTri={formatCurrency(tongChiPhi)}
                  bgGradient="bg-gradient-to-br from-[#ff9f0a] to-[#ff8000]"
                  icon={<SFSymbolCreditCard size={16} />}
                />
              </div>

              {/* Cột 2: Hiệu quả & Vốn (Lợi nhuận & Vốn tồn kho) */}
              <div className="flex flex-col gap-3">
                <TheChiSo
                  nhan={`Lợi nhuận (${nhanThang})`}
                  giaTri={`${tongLoiNhuan >= 0 ? "+" : ""}${formatCurrency(tongLoiNhuan)}`}
                  bgGradient="bg-gradient-to-br from-[#34c759] to-[#28a745]"
                  icon={<SFSymbolTrendingUp size={16} />}
                />
                <TheChiSo
                  nhan="Vốn tồn kho"
                  giaTri={formatCurrency(giaVonTonKho)}
                  bgGradient="bg-gradient-to-br from-[#bf5af2] to-[#5e5ce6]"
                  icon={<SFSymbolCoins size={16} />}
                />
              </div>

              {/* Cột 3: Số lượng kho (Tồn kho bán hàng & Tồn kho bảo hành) */}
              <div className="flex flex-col gap-3">
                <TheChiSo
                  nhan="Tồn kho bán hàng"
                  giaTri={`${tonKhoBanHang} sản phẩm`}
                  bgGradient="bg-gradient-to-br from-[#5e5ce6] to-[#0066cc]"
                  icon={<SFSymbolShippingBox size={16} />}
                />
                <TheChiSo
                  nhan="Tồn kho bảo hành"
                  giaTri={`${tonKhoBaoHanh} máy`}
                  bgGradient="bg-gradient-to-br from-[#ff453a] to-[#ff9f0a]"
                  icon={<SFSymbolWrench size={16} />}
                />
              </div>
            </div>
          )}

          {/* Main Charts & Aging Inventory Alerts */}
          <div className="space-y-4">
              {/* Beautiful Multi-series Chart — Lazy loaded */}
              <DashboardChartSection
                chartData={chartData}
                monthlyChartData={monthlyChartData}
                isLoading={isSummaryLoading}
                onMonthChange={handleChartMonthChange}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Capital Inventory Valuation Card */}
                {isCapitalLoading ? (
                  <CapitalSkeleton />
                ) : (
                  <KinhPanel className="p-5 bg-white/35 backdrop-blur-xl flex flex-col h-[480px]">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[16px] font-bold text-[#0066cc]">
                          Thống kê vốn tồn kho
                        </h3>
                      </div>
                      <div className="text-[13px] font-medium text-slate-500 select-none">
                        Tổng vốn: <span className="font-extrabold text-[#0066cc] tabular-nums text-[15px]">{formatCurrency(capitalData?.totalCapital || 0)}</span>
                      </div>
                    </div>

                    <div className="overflow-y-auto flex-1 pr-1 space-y-4 scrollbar-thin">
                      {/* Grid showing simple machine and accessory stats */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="rounded-[20px] border border-white/60 bg-white/20 p-3 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Vốn Máy Lẻ ({capitalData?.machineCapital?.count || 0} máy)
                          </span>
                          <span className="text-[16px] font-black text-[#0066cc] tabular-nums mt-1.5">
                            {formatCurrency(capitalData?.machineCapital?.totalCost || 0)}
                          </span>
                        </div>
                        <div className="rounded-[20px] border border-white/60 bg-white/20 p-3 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Vốn Phụ Kiện ({capitalData?.accessoryCapital?.count || 0} món)
                          </span>
                          <span className="text-[16px] font-black text-[#ff8000] tabular-nums mt-1.5">
                            {formatCurrency(capitalData?.accessoryCapital?.totalCost || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Machine Category breakdown */}
                      <div className="space-y-2.5">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/30 pb-1">
                          Cơ cấu vốn theo Danh mục máy lẻ
                        </div>
                        {capitalData?.machineCategoryStats?.length > 0 ? (
                          <div className="space-y-3">
                            {capitalData.machineCategoryStats.slice(0, 5).map((cat: any) => {
                              const pct = Math.round(
                                ((cat.totalCost || 0) / (capitalData.machineCapital?.totalCost || 1)) * 100
                              );
                              return (
                                <div key={cat.categoryId} className="space-y-1">
                                  <div className="flex justify-between text-[12.5px] font-medium text-slate-700">
                                    <span className="truncate max-w-[200px]" title={`${cat.categoryName} (${cat.count} máy)`}>
                                      {cat.categoryName} <span className="text-[11px] text-slate-400">({cat.count} máy)</span>
                                    </span>
                                    <span className="tabular-nums font-bold text-slate-800">
                                      {formatCurrency(cat.totalCost)} <span className="text-[10px] text-slate-400 font-semibold ml-0.5">({pct}%)</span>
                                    </span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden border border-white/40">
                                    <div
                                      className="h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all duration-500"
                                      style={{ width: `${Math.max(1, pct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[12px] text-slate-400 italic text-center py-2">
                            Không có máy lẻ nào trong kho.
                          </div>
                        )}
                      </div>

                      {/* Accessory breakdown */}
                      <div className="space-y-2.5 pt-1">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/30 pb-1">
                          Cơ cấu vốn theo Loại phụ kiện
                        </div>
                        {capitalData?.accessoryCatalogStats?.length > 0 ? (
                          <div className="space-y-3">
                            {capitalData.accessoryCatalogStats.slice(0, 5).map((item: any) => {
                              const pct = Math.round(
                                ((item.totalCost || 0) / (capitalData.accessoryCapital?.totalCost || 1)) * 100
                              );
                              return (
                                <div key={item.catalogId} className="space-y-1">
                                  <div className="flex justify-between text-[12.5px] font-medium text-slate-700">
                                    <span className="truncate max-w-[200px]" title={`${item.catalogName} (${item.count} món)`}>
                                      {item.catalogName} <span className="text-[11px] text-slate-400">({item.count} món)</span>
                                    </span>
                                    <span className="tabular-nums font-bold text-slate-800">
                                      {formatCurrency(item.totalCost)} <span className="text-[10px] text-slate-400 font-semibold ml-0.5">({pct}%)</span>
                                    </span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden border border-white/40">
                                    <div
                                      className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                                      style={{ width: `${Math.max(1, pct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[12px] text-slate-400 italic text-center py-2">
                            Không có phụ kiện nào trong kho.
                          </div>
                        )}
                      </div>
                    </div>
                  </KinhPanel>
                )}



                {/* Aging Inventory Alert Card — Progressive: own skeleton */}
                {isInventoryLoading ? (
                  <InventorySkeleton />
                ) : (
                  <KinhPanel className="p-5 bg-white/35 backdrop-blur-xl flex flex-col h-[480px]">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[16px] font-bold text-[#d12229]">
                          Cảnh báo tồn kho quá hạn
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {agedItems.length > 0 && (
                          <div className="text-[13px] font-medium text-slate-500 flex items-center gap-2.5 select-none">
                            <span>Đọng vốn: <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(tongVonDong)}</span></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            <span>Tổng số: <span className="font-semibold text-slate-800">{agedItems.length} máy</span></span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="overflow-y-auto flex-1 pr-1 space-y-2 scrollbar-thin">
                      {agedItems.length > 0 && (
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-200/30 mb-2 uppercase tracking-wider">
                          <div className="col-span-1 text-center">STT</div>
                          <div className="col-span-5">Sản phẩm</div>
                          <div className="col-span-2 text-center">Tồn kho</div>
                          <div className="col-span-2 text-right">Giá vốn</div>
                          <div className="col-span-2 text-right">Thời gian</div>
                        </div>
                      )}

                      {visibleAgedItems.map((item: any, index: number) => {
                        const stockQty = item.stockQty;
                        const avgCost = item.avgCost;
                        const rowDongVon = item.rowDongVon;
                        return (
                          <div
                            key={item.id}
                            className="rounded-[20px] border border-white/60 bg-white/20 backdrop-blur-md p-3.5 flex flex-col md:grid md:grid-cols-12 md:gap-4 md:items-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] hover:bg-white/35 transition-colors duration-200"
                          >
                            {/* STT */}
                            <div className="hidden md:block col-span-1 text-center text-[12px] font-bold text-slate-400">
                              {index + 1}
                            </div>

                            {/* Tên & cấu hình */}
                            <div className="col-span-12 md:col-span-5 space-y-0.5">
                              <div className="text-[13px] font-semibold text-slate-800 truncate" title={item.productName}>
                                {item.productName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-semibold truncate" title={`${item.brandName} • ${item.categoryName} ${getSpecsLabel(item.productSpecs) ? ` • ${getSpecsLabel(item.productSpecs)}` : ""}`}>
                                {item.brandName || "TechShop"} • {item.categoryName || "Thiết bị"} {getSpecsLabel(item.productSpecs) ? ` • ${getSpecsLabel(item.productSpecs)}` : ""}
                              </div>
                            </div>

                            {/* Tồn kho (Model) */}
                            <div className="col-span-12 md:col-span-2 mt-1 md:mt-0 text-left md:text-center text-[12.5px] font-bold text-slate-700 whitespace-nowrap">
                              <span className="inline md:hidden text-slate-400 font-semibold text-[10px] mr-1 uppercase">Tồn kho:</span>
                              {stockQty} máy
                            </div>

                            {/* Giá vốn */}
                            <div className="col-span-12 md:col-span-2 mt-1 md:mt-0 text-left md:text-right text-[12.5px] font-bold text-slate-700 tabular-nums whitespace-nowrap leading-tight">
                              <span className="inline md:hidden text-slate-400 font-semibold text-[10px] mr-1 uppercase">Giá vốn:</span>
                              <div>{formatCurrency(rowDongVon)}</div>
                            </div>

                            {/* Thời gian tồn */}
                            <div className="col-span-12 md:col-span-2 mt-1.5 md:mt-0 text-left md:text-right">
                              <span className="inline md:hidden text-slate-400 font-semibold text-[10px] mr-1 uppercase">Thời gian:</span>
                              <span className="text-[12.5px] font-bold text-[#d12229] tabular-nums whitespace-nowrap">
                                Tồn {item.diffDays} ngày
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* "Xem thêm" pagination button */}
                      {agedItems.length > visibleAgedCount && (
                        <button
                          onClick={() => setVisibleAgedCount(prev => prev + 20)}
                          className="w-full py-2 mt-2 rounded-[16px] border border-white/60 bg-white/30 backdrop-blur-md text-[12px] font-semibold text-[#0066cc] hover:bg-white/50 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                        >
                          Xem thêm ({agedItems.length - visibleAgedCount} còn lại)
                        </button>
                      )}

                      {agedItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="text-[14px] font-bold text-slate-800">Kho hàng an toàn</div>
                          <div className="text-[12px] text-slate-500 mt-1">
                            Không có sản phẩm nào tồn kho vượt quá 45 ngày.
                          </div>
                        </div>
                      )}
                    </div>
                  </KinhPanel>
                )}
              </div>
            </div>

        </div>
      </div>
    </div>
  );
}