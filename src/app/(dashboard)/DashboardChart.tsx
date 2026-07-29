"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Cell,
} from "recharts";
import React from "react";

// Helper function to concatenate classes
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Compact currency formatting
function formatCompactCurrency(value: number) {
  const n = Number(value || 0);
  const isNegative = n < 0;
  const absN = Math.abs(n);
  
  let formatted = "";
  if (absN >= 1_000_000_000) {
    formatted = `${(absN / 1_000_000_000).toFixed(1)} tỷ`;
  } else if (absN >= 1_000_000) {
    formatted = `${(absN / 1_000_000).toFixed(1)} triệu`;
  } else if (absN >= 1_000) {
    formatted = `${(absN / 1_000).toFixed(0)}k`;
  } else {
    formatted = `${Math.round(absN)}`;
  }
  
  formatted = formatted.replace(".0", "").replace(".", ",");
  return isNegative ? `-${formatted}` : formatted;
}

// Formatting helpers
function formatCurrency(value: number) {
  return `${Math.round(value || 0).toLocaleString("vi-VN")}đ`;
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

// Custom Glass Tooltip for ComposedChart
function TooltipBaoCao({ active, payload, label, activeMetric }: any) {
  if (!active || !payload?.length) return null;

  const dataPoint = payload[0].payload;
  const thu = Number(dataPoint.thu || 0);
  const chi = Number(dataPoint.chi || 0);
  const loiNhuan = Number(dataPoint.loiNhuan || thu - chi);

  return (
    <div className="min-w-[210px] rounded-[24px] border border-white/80 bg-white/70 backdrop-blur-xl px-4 py-3.5 shadow-[0_20px_40px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)]">
      <div className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div className="mt-3 space-y-2 text-[13.5px] font-semibold text-slate-700">
        <div className={cn("flex items-center justify-between gap-6 p-1 rounded-lg transition-colors", activeMetric === "revenue" && "bg-blue-500/10 border border-blue-500/20")}>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0071e3] border border-white shadow-sm" /> 
            Doanh thu
          </span>
          <span className={cn("font-bold tabular-nums", activeMetric === "revenue" ? "text-[#0071e3]" : "text-slate-900")}>
            {formatCurrency(thu)}
          </span>
        </div>

        <div className={cn("flex items-center justify-between gap-6 p-1 rounded-lg transition-colors", activeMetric === "expense" && "bg-amber-500/10 border border-amber-500/20")}>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff9f0a] border border-white shadow-sm" /> 
            Chi phí
          </span>
          <span className={cn("font-bold tabular-nums", activeMetric === "expense" ? "text-[#ff9f0a]" : "text-slate-900")}>
            {formatCurrency(chi)}
          </span>
        </div>

        <div className="h-px bg-slate-200/50 my-1" />

        <div className={cn("flex items-center justify-between gap-6 p-1 rounded-lg transition-colors", activeMetric === "profit" && "bg-emerald-500/10 border border-emerald-500/20")}>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#30d158] border border-white shadow-sm" /> 
            Lợi nhuận
          </span>
          <span className={cn("font-bold tabular-nums", activeMetric === "profit" ? "text-emerald-600" : "text-slate-900")}>
            {loiNhuan >= 0 ? "+" : ""}
            {formatCurrency(loiNhuan)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom Apple-style Inline Date Picker for Dashboard
function InlineDatePicker({
  value,
  onChange,
  label,
  active,
  align = "left",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  active: boolean;
  align?: "left" | "right";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse date
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-");
    if (parts.length !== 3) return new Date(value);
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }, [value]);

  const [viewYear, setViewYear] = useState(() => selectedDate ? selectedDate.getFullYear() : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate ? selectedDate.getMonth() : new Date().getMonth());

  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayValue = useMemo(() => {
    if (!selectedDate) return "";
    const d = String(selectedDate.getDate()).padStart(2, "0");
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const y = selectedDate.getFullYear().toString().slice(-2);
    return `${d}/${m}/${y}`;
  }, [selectedDate]);

  // Calendar math
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const cells: Date[] = [];
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      cells.push(new Date(viewYear, viewMonth - 1, prevMonthDays - i));
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(new Date(viewYear, viewMonth, i));
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push(new Date(viewYear, viewMonth + 1, i));
    }
    return cells;
  }, [viewYear, viewMonth]);

  const isSelected = (d: Date) => {
    if (!selectedDate) return false;
    return d.getDate() === selectedDate.getDate() &&
           d.getMonth() === selectedDate.getMonth() &&
           d.getFullYear() === selectedDate.getFullYear();
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const handleSelectDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const MONTHS_VN = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", 
    "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", 
    "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 select-none text-slate-700">
      <span className="opacity-80">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "h-6 rounded-[8px] border px-2 text-[12px] font-bold focus:outline-none transition-all min-w-[85px] text-center cursor-pointer",
          active
            ? "bg-blue-500/10 border-blue-500/30 text-[#0066cc] hover:bg-blue-500/15"
            : "bg-white/60 border-slate-200/80 text-slate-700 hover:bg-white/80"
        )}
      >
        {displayValue}
      </button>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-[calc(100%+6px)] w-[240px] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-[#e0e0e0] p-2.5 z-[99] text-slate-800",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#f5f5f7]">
            <span className="text-[12.5px] font-bold">
              {MONTHS_VN[viewMonth]}, {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear(y => y - 1);
                  } else {
                    setViewMonth(m => m - 1);
                  }
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft size={10} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear(y => y + 1);
                  } else {
                    setViewMonth(m => m + 1);
                  }
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronRight size={10} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mt-1.5 text-center">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => (
              <span key={d} className="text-[10px] font-bold text-slate-400 py-0.5">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 mt-0.5">
            {calendarCells.map((cell, idx) => {
              const selected = isSelected(cell);
              const currentMonth = cell.getMonth() === viewMonth;
              const today = isToday(cell);

              return (
                <button
                  type="button"
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectDate(cell);
                  }}
                  className={cn(
                    "aspect-square w-full rounded-md flex items-center justify-center text-[11.5px] font-medium transition-all active:scale-90 cursor-pointer",
                    selected
                      ? "bg-[#0066cc] text-white font-bold"
                      : today
                      ? "bg-[#0066cc]/10 text-[#0066cc] font-bold"
                      : currentMonth
                      ? "text-slate-800 hover:bg-slate-100"
                      : "text-slate-300 hover:bg-slate-50"
                  )}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Apple-style Inline Month Picker for Dashboard
function InlineMonthPicker({
  value,
  onChange,
  label,
  active,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  active: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-");
    if (parts.length !== 2) return null;
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10) - 1,
    };
  }, [value]);

  const [viewYear, setViewYear] = useState(() => parsed ? parsed.year : new Date().getFullYear());

  useEffect(() => {
    if (parsed) setViewYear(parsed.year);
  }, [parsed]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayValue = useMemo(() => {
    if (!parsed) return "";
    return `Tháng ${parsed.month + 1}/${parsed.year}`;
  }, [parsed]);

  const handleSelectMonth = (monthIndex: number) => {
    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`);
    setIsOpen(false);
  };

  const isSelected = (monthIndex: number) => {
    if (!parsed) return false;
    return parsed.year === viewYear && parsed.month === monthIndex;
  };

  const MONTHS_VN = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 select-none text-slate-700">
      <span className="opacity-80">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "h-6 rounded-[8px] border px-2 text-[12px] font-bold focus:outline-none transition-all min-w-[95px] text-center cursor-pointer",
          active
            ? "bg-blue-500/10 border-blue-500/30 text-[#0066cc] hover:bg-blue-500/15"
            : "bg-white/60 border-slate-200/80 text-slate-700 hover:bg-white/80"
        )}
      >
        {displayValue || "Chọn..."}
      </button>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-[calc(100%+6px)] right-0 w-[180px] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-[#e0e0e0] p-2.5 z-[99] text-slate-800"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#f5f5f7]">
            <span className="text-[12.5px] font-bold">Năm {viewYear}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewYear(y => y - 1);
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft size={10} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewYear(y => y + 1);
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronRight size={10} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-2">
            {MONTHS_VN.map((mName, idx) => {
              const selected = isSelected(idx);
              return (
                <button
                  type="button"
                  key={mName}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectMonth(idx);
                  }}
                  className={cn(
                    "py-1.5 rounded-md text-center text-[11.5px] font-medium transition-all active:scale-95 cursor-pointer",
                    selected
                      ? "bg-[#0066cc] text-white font-bold"
                      : "text-slate-800 hover:bg-slate-100"
                  )}
                >
                  {mName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Props interface for the chart component
interface DashboardChartProps {
  chartData: any[];
  monthlyChartData: any[];
  isLoading: boolean;
  onMonthChange?: (month: string) => void;
}

function DashboardChartInner({ chartData, monthlyChartData, isLoading, onMonthChange }: DashboardChartProps) {
  // Unified chart controllers
  const [activeMetric, setActiveMetric] = useState<"revenue" | "expense" | "profit">("revenue");
  const [activeTimeframe, setActiveTimeframe] = useState<"weekly" | "monthly" | "yearly" | "custom" | "month-select">("monthly");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Custom range and specific month selector states
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  // Notify parent when month-select changes
  useEffect(() => {
    if (activeTimeframe === "month-select" && onMonthChange) {
      onMonthChange(selectedSpecificMonth);
    } else if (onMonthChange) {
      const today = new Date();
      onMonthChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [activeTimeframe, selectedSpecificMonth, onMonthChange]);

  // 1. Timeframe Data Aggregations
  const dataTheoTuan = useMemo(() => {
    return (chartData || []).slice(-7);
  }, [chartData]);

  const dataTheoThang = useMemo(() => {
    return (monthlyChartData || []).map((item: any) => {
      const cleaned = item.date.replace("Thg ", "").trim();
      const parts = cleaned.split("/");
      let formattedDate = item.date;
      if (parts.length === 2) {
        const month = parts[0].padStart(2, "0");
        const year = parts[1];
        formattedDate = `${month}/${year}`;
      }
      return {
        ...item,
        date: formattedDate,
      };
    });
  }, [monthlyChartData]);

  const dataTheoNam = useMemo(() => {
    const map: Record<string, { date: string; thu: number; chi: number; loiNhuan: number }> = {};
    (monthlyChartData || []).forEach((item: any) => {
      const parts = item.date.split("/");
      const year2 = parts[1] || "26";
      const year4 = `20${year2}`;
      const label = `Năm ${year4}`;
      if (!map[label]) {
        map[label] = { date: label, thu: 0, chi: 0, loiNhuan: 0 };
      }
      map[label].thu += item.thu || 0;
      map[label].chi += item.chi || 0;
      map[label].loiNhuan += item.loiNhuan || 0;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [monthlyChartData]);

  const dataTieuChuanKhoangNgay = useMemo(() => {
    return (chartData || [])
      .filter((item: any) => {
        if (!item.fullDate) return false;
        return item.fullDate >= customStartDate && item.fullDate <= customEndDate;
      })
      .sort((a: any, b: any) => a.fullDate.localeCompare(b.fullDate));
  }, [chartData, customStartDate, customEndDate]);

  const dataTieuChuanThangCuThe = useMemo(() => {
    return (chartData || [])
      .filter((item: any) => {
        if (!item.fullDate) return false;
        return item.fullDate.startsWith(selectedSpecificMonth);
      })
      .sort((a: any, b: any) => a.fullDate.localeCompare(b.fullDate));
  }, [chartData, selectedSpecificMonth]);

  const duLieuChartHienTai = useMemo(() => {
    if (activeTimeframe === "weekly") return dataTheoTuan;
    if (activeTimeframe === "yearly") return dataTheoNam;
    if (activeTimeframe === "custom") return dataTieuChuanKhoangNgay;
    if (activeTimeframe === "month-select") return dataTieuChuanThangCuThe;
    return dataTheoThang;
  }, [activeTimeframe, dataTheoTuan, dataTheoThang, dataTheoNam, dataTieuChuanKhoangNgay, dataTieuChuanThangCuThe]);

  // Dynamic Chart Picker based on parameters
  const renderBieuDo = () => {
    if (!mounted) return null;
    if (activeMetric === "revenue") {
      if (activeTimeframe === "yearly") {
        return (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart data={duLieuChartHienTai} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} />
              <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
              <Tooltip content={<TooltipBaoCao activeMetric={activeMetric} />} />
              <Bar dataKey="thu" fill="#0071e3" radius={[8, 8, 0, 0] as any} maxBarSize={45} />
            </ComposedChart>
          </ResponsiveContainer>
        );
      } else {
        return (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart data={duLieuChartHienTai} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0071e3" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0071e3" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} />
              <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
              <Tooltip content={<TooltipBaoCao activeMetric={activeMetric} />} />
              <Area type="monotone" dataKey="thu" stroke="#0071e3" strokeWidth={2.5} fill="url(#colorRevenue)" />
            </ComposedChart>
          </ResponsiveContainer>
        );
      }
    }

    if (activeMetric === "expense") {
      return (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <ComposedChart data={duLieuChartHienTai} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} />
            <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
            <Tooltip content={<TooltipBaoCao activeMetric={activeMetric} />} />
            <Bar dataKey="chi" fill="#ff9f0a" radius={[8, 8, 0, 0] as any} maxBarSize={45} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (activeMetric === "profit") {
      if (activeTimeframe === "yearly") {
        return (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart data={duLieuChartHienTai} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} />
              <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
              <Tooltip content={<TooltipBaoCao activeMetric={activeMetric} />} />
              <Bar dataKey="loiNhuan" radius={[8, 8, 0, 0] as any} maxBarSize={45}>
                {duLieuChartHienTai.map((entry: any, index: number) => {
                  const isPositive = (entry.loiNhuan || 0) >= 0;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isPositive ? "#30d158" : "#ff3b30"}
                    />
                  );
                })}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        );
      } else {
        return (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart data={duLieuChartHienTai} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} />
              <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} fontWeight={600} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
              <Tooltip content={<TooltipBaoCao activeMetric={activeMetric} />} />
              <Line
                type="monotone"
                dataKey="loiNhuan"
                stroke="#30d158"
                strokeWidth={3.5}
                dot={{ r: 4, fill: "#30d158", strokeWidth: 0 }}
                activeDot={{ r: 7, fill: "#30d158", strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        );
      }
    }
    return null;
  };

  if (isLoading) {
    return (
      <KinhPanel className="p-5 bg-white/35 backdrop-blur-xl flex flex-col justify-between">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-white/40 rounded-full w-[280px]" />
          <div className="h-[310px] rounded-[24px] bg-white/20 border border-white/70" />
        </div>
      </KinhPanel>
    );
  }

  return (
    <KinhPanel className="p-5 bg-white/35 backdrop-blur-xl flex flex-col justify-between" overflowVisible={true}>
      <div className="relative z-30 flex flex-wrap items-center justify-between gap-3 px-1 border-b border-white/40 pb-3">

        {/* Segmented Controls for Metric and Timeframe */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Metric Selector */}
          <div className="relative flex bg-white/40 border border-white/60 backdrop-blur-md p-[3px] rounded-full w-[280px] h-10 select-none z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] shrink-0">
            {/* Sliding Active Capsule Overlay */}
            <div
              className={cn(
                "absolute top-[3px] bottom-[3px] left-[3px] w-[calc((100%-6px)/3)] rounded-full bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
                activeMetric === "revenue" && "translate-x-0",
                activeMetric === "expense" && "translate-x-full",
                activeMetric === "profit" && "translate-x-[200%]"
              )}
            />

            <button
              onClick={() => setActiveMetric("revenue")}
              className="relative z-10 flex-1 h-full text-[13px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] group"
            >
              <span className={cn(
                "transition-all duration-200",
                activeMetric === "revenue" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
              )}>
                Doanh thu
              </span>
            </button>
            <button
              onClick={() => setActiveMetric("expense")}
              className="relative z-10 flex-1 h-full text-[13px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] group"
            >
              <span className={cn(
                "transition-all duration-200",
                activeMetric === "expense" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
              )}>
                Chi phí
              </span>
            </button>
            <button
              onClick={() => setActiveMetric("profit")}
              className="relative z-10 flex-1 h-full text-[13px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] group"
            >
              <span className={cn(
                "transition-all duration-200",
                activeMetric === "profit" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
              )}>
                Lợi nhuận
              </span>
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex bg-white/40 border border-white/60 backdrop-blur-md p-[3px] rounded-full w-[220px] h-10 select-none z-10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] shrink-0">
              {/* Sliding Active Capsule Overlay */}
              <div
                className={cn(
                  "absolute top-[3px] bottom-[3px] left-[3px] w-[calc((100%-6px)/3)] rounded-full bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  activeTimeframe === "weekly" && "translate-x-0 opacity-100",
                  activeTimeframe === "monthly" && "translate-x-full opacity-100",
                  activeTimeframe === "yearly" && "translate-x-[200%] opacity-100",
                  (activeTimeframe === "custom" || activeTimeframe === "month-select") && "opacity-0 scale-95 pointer-events-none"
                )}
              />

              <button
                onClick={() => setActiveTimeframe("weekly")}
                className="relative z-10 flex-1 h-full text-[13px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] group"
              >
                <span className={cn(
                  "transition-all duration-200",
                  activeTimeframe === "weekly" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
                )}>
                  Tuần
                </span>
              </button>
              <button
                onClick={() => setActiveTimeframe("monthly")}
                className="relative z-10 flex-1 h-full text-[13px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] group"
              >
                <span className={cn(
                  "transition-all duration-200",
                  activeTimeframe === "monthly" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
                )}>
                  Tháng
                </span>
              </button>
              <button
                onClick={() => setActiveTimeframe("yearly")}
                className="relative z-10 flex-1 h-full text-[13px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] group"
              >
                <span className={cn(
                  "transition-all duration-200",
                  activeTimeframe === "yearly" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
                )}>
                  Năm
                </span>
              </button>
            </div>
            
            {/* From Date to Date Picker Inline */}
            <div
              onClick={() => setActiveTimeframe("custom")}
              className={cn(
                "h-10 rounded-full px-3.5 text-[13px] font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none border",
                activeTimeframe === "custom"
                  ? "bg-white border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-slate-800"
                  : "bg-white/60 border-white/80 text-slate-700 hover:bg-white/85"
              )}
            >
              <InlineDatePicker
                label="Từ:"
                value={customStartDate}
                active={activeTimeframe === "custom"}
                onChange={(val) => {
                  setCustomStartDate(val);
                  setActiveTimeframe("custom");
                  if (customEndDate && val > customEndDate) {
                    setCustomEndDate(val);
                  }
                }}
              />
              <InlineDatePicker
                label="đến:"
                value={customEndDate}
                active={activeTimeframe === "custom"}
                onChange={(val) => {
                  setCustomEndDate(val);
                  setActiveTimeframe("custom");
                  if (customStartDate && val < customStartDate) {
                    setCustomStartDate(val);
                  }
                }}
              />
            </div>

            {/* Specific Month Selector Inline */}
            <div
              onClick={() => setActiveTimeframe("month-select")}
              className={cn(
                "h-10 rounded-full px-3.5 text-[13px] font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none border",
                activeTimeframe === "month-select"
                  ? "bg-white border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-slate-800"
                  : "bg-white/60 border-white/80 text-slate-700 hover:bg-white/85"
              )}
            >
              <InlineMonthPicker
                label="Chọn tháng:"
                value={selectedSpecificMonth}
                active={activeTimeframe === "month-select"}
                onChange={(val) => {
                  setSelectedSpecificMonth(val);
                  setActiveTimeframe("month-select");
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 w-full h-[310px] rounded-[24px] border border-white/70 bg-white/20 backdrop-blur-md p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]">
        {renderBieuDo()}
      </div>
    </KinhPanel>
  );
}

// Export with React.memo to prevent re-renders from parent state changes
const DashboardChart = React.memo(DashboardChartInner);
export default DashboardChart;
