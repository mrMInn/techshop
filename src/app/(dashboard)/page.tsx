"use client";

import { useQuery } from "@tanstack/react-query";
import { getFinancialSummary, getDashboardBentoData } from "@/app/actions/accounting";
import { getAgedInventoryItems } from "@/app/actions/inventory";
import {
  ChevronDown,
} from "lucide-react";
import { SFSymbolBanknote, SFSymbolCreditCard } from "@/components/ui/apple-icons";
import Link from "next/link";
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

// KPI card with Apple Shortcuts dynamic gradient styling
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
        "relative rounded-[22px] p-5 flex flex-col justify-between h-[120px] text-white shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-[1.02] hover:shadow-[0_15px_30px_rgba(0,0,0,0.12)] transition-all duration-300 border border-white/10 overflow-hidden group select-none cursor-pointer"
      )}
    >
      {/* Background Gradient */}
      <div className={cn("absolute inset-0 z-0", bgGradient)} />
      
      {/* Gloss shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

      {/* Top Row with Label and Icon */}
      <div className="relative z-20 flex justify-between items-start">
        <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
          {nhan}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
        {giaTri}
      </div>
    </div>
  );
}

// KPI Cards Skeleton
function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-[22px] h-[120px] bg-slate-200/50" />
      ))}
    </div>
  );
}

// Inventory Skeleton
function InventorySkeleton() {
  return (
    <KinhPanel className="p-5 bg-white/35 backdrop-blur-xl">
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-white/40 rounded w-[250px]" />
        <div className="h-px bg-slate-200/60" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white/20 rounded-[20px] border border-white/60" />
        ))}
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
    data: bentoData,
    isLoading: isBentoLoading,
    isFetching: isBentoFetching,
  } = useQuery({
    queryKey: ["dashboard_bento_stats", thangDuocChon],
    queryFn: () => getDashboardBentoData(thangDuocChon),
    enabled: mounted,
    staleTime: 5 * 60 * 1000,
  });

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

  const isRefreshing = isBentoFetching || isSummaryFetching || isInventoryFetching;

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
  const { tongDoanhThu, tongChiPhi, tongLoiNhuan, nhanThang } = useMemo(() => {
    const data = bentoData || {
      todayIncome: 0, todayExpense: 0, todayNetProfit: 0,
      thisMonthIncome: 0, thisMonthExpense: 0, thisMonthNetProfit: 0,
    };
    const doanhThu = kyTaiChinh === "today" ? Number(data.todayIncome || 0) : Number(data.thisMonthIncome || 0);
    const chiPhi = kyTaiChinh === "today" ? Number(data.todayExpense || 0) : Number(data.thisMonthExpense || 0);
    const loiNhuan = kyTaiChinh === "today" ? Number(data.todayNetProfit || 0) : Number(data.thisMonthNetProfit || 0);
    const nhan = luaChonThang.find((opt) => opt.value === thangDuocChon)?.label || "Tháng hiện tại";
    return { tongDoanhThu: doanhThu, tongChiPhi: chiPhi, tongLoiNhuan: loiNhuan, nhanThang: nhan };
  }, [bentoData, kyTaiChinh, thangDuocChon, luaChonThang]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#f4f7f6]">
        <div className="mx-auto max-w-[1450px] px-4 md:px-5 py-5 md:py-6">
          <div className="space-y-4 animate-pulse">
            <div className="h-[40px]" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[1, 2, 3].map(i => <div key={i} className="rounded-[22px] h-[120px] bg-slate-200/50" />)}
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <TheChiSo
                nhan={`Tổng doanh thu (${nhanThang})`}
                giaTri={formatCurrency(tongDoanhThu)}
                bgGradient="bg-gradient-to-br from-[#2ea1ff] to-[#0066cc]"
                icon={<SFSymbolBanknote size={16} />}
              />

              <TheChiSo
                nhan={`Tổng chi phí (${nhanThang})`}
                giaTri={formatCurrency(tongChiPhi)}
                bgGradient="bg-gradient-to-br from-[#ff9f0a] to-[#ff8000]"
                icon={<SFSymbolCreditCard size={16} />}
              />

              <TheChiSo
                nhan={`Lợi nhuận ròng (${nhanThang})`}
                giaTri={`${tongLoiNhuan >= 0 ? "+" : ""}${formatCurrency(tongLoiNhuan)}`}
                bgGradient="bg-gradient-to-br from-[#34c759] to-[#28a745]"
                icon={<SFSymbolTrendingUp size={16} />}
              />
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

              {/* Aging Inventory Alert Card — Progressive: own skeleton */}
              {isInventoryLoading ? (
                <InventorySkeleton />
              ) : (
              <KinhPanel className="p-5 bg-white/35 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-bold text-[#d12229]">
                      Cảnh báo tồn kho quá hạn
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {agedItems.length > 0 ? (
                      <div className="text-[13px] font-medium text-slate-500 flex items-center gap-2.5 select-none">
                        <span>Đọng vốn: <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(tongVonDong)}</span></span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>Tổng số: <span className="font-semibold text-slate-800">{agedItems.length} máy</span></span>
                      </div>
                    ) : (
                      <span className="text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                        Kho an toàn
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[350px] pr-1 space-y-2">
                  {agedItems.length > 0 && (
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-200/30 mb-2 uppercase tracking-wider">
                      <div className="col-span-1 text-center">STT</div>
                      <div className="col-span-4">Sản phẩm & Cấu hình</div>
                      <div className="col-span-1 text-center">Tồn kho</div>
                      <div className="col-span-2 text-right">Tồn đọng vốn</div>
                      <div className="col-span-2 text-center">Ngày nhập</div>
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
                        <div className="col-span-12 md:col-span-4 space-y-0.5">
                          <div className="text-[13.5px] font-semibold text-slate-800">
                            {item.productName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-semibold truncate" title={`${item.brandName} • ${item.categoryName} ${getSpecsLabel(item.productSpecs) ? ` • ${getSpecsLabel(item.productSpecs)}` : ""}`}>
                            {item.brandName || "TechShop"} • {item.categoryName || "Thiết bị"} {getSpecsLabel(item.productSpecs) ? ` • ${getSpecsLabel(item.productSpecs)}` : ""}
                          </div>
                        </div>

                        {/* Tồn kho (Model) */}
                        <div className="col-span-12 md:col-span-1 mt-1 md:mt-0 text-left md:text-center text-[13px] font-bold text-slate-700 whitespace-nowrap">
                          <span className="inline md:hidden text-slate-400 font-semibold text-[11px] mr-1 uppercase">Tồn kho:</span>
                          {stockQty} máy
                        </div>

                        {/* Giá vốn */}
                        <div className="col-span-12 md:col-span-2 mt-1 md:mt-0 text-left md:text-right text-[13px] font-bold text-slate-700 tabular-nums whitespace-nowrap leading-tight">
                          <span className="inline md:hidden text-slate-400 font-semibold text-[11px] mr-1 uppercase">Giá vốn:</span>
                          <div>{formatCurrency(rowDongVon)}</div>
                          {stockQty > 1 && (
                            <div className="text-[10px] text-slate-400 font-semibold normal-case">
                              (TB: {formatCurrency(avgCost)})
                            </div>
                          )}
                        </div>

                        {/* Ngày nhập */}
                        <div className="col-span-12 md:col-span-2 mt-1 md:mt-0 text-left md:text-center text-[12px] text-slate-500 font-medium whitespace-nowrap">
                          <span className="inline md:hidden text-slate-400 font-semibold text-[11px] mr-1 uppercase">Ngày nhập:</span>
                          {formatToDDMMYYYY(item.stockedDate)}
                        </div>

                        {/* Thời gian tồn */}
                        <div className="col-span-12 md:col-span-2 mt-1.5 md:mt-0 text-left md:text-right">
                          <span className="inline md:hidden text-slate-400 font-semibold text-[11px] mr-1 uppercase">Thời gian:</span>
                          <span className="text-[13px] font-bold text-[#d12229] tabular-nums whitespace-nowrap">
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
                      className="w-full py-2.5 mt-2 rounded-[16px] border border-white/60 bg-white/30 backdrop-blur-md text-[13px] font-semibold text-[#0066cc] hover:bg-white/50 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                    >
                      Xem thêm ({agedItems.length - visibleAgedCount} còn lại)
                    </button>
                  )}

                  {agedItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
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
  );
}