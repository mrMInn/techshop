"use client";
 
import { useState, useMemo } from "react";
import { Info } from "lucide-react";
 
interface CategoryStat {
  category: string;
  label: string;
  amount: number;
  percentage: number;
  color: string;
}
 
interface CashBookDonutProps {
  entries: any[];
}
 
const categoryLabels: Record<string, { label: string; color: string }> = {
  sales: { label: "Doanh thu lẻ", color: "bg-emerald-500" },
  purchase: { label: "Nhập hàng", color: "bg-amber-500" },
  salary: { label: "Lương nhân viên", color: "bg-violet-500" },
  rent: { label: "Thuê mặt bằng", color: "bg-blue-500" },
  utility: { label: "Điện nước mạng", color: "bg-orange-500" },
  shipping: { label: "Vận chuyển hàng", color: "bg-cyan-500" },
  tax: { label: "Thuế nhà nước", color: "bg-rose-500" },
  warranty_repair: { label: "Dịch vụ sửa chữa", color: "bg-teal-500" },
  other: { label: "Chi phí khác", color: "bg-slate-400" },
};
 
// Hex codes for progress bar colors
const strokeColors: Record<string, string> = {
  sales: "#10b981", // emerald
  purchase: "#f59e0b", // amber
  salary: "#8b5cf6", // violet
  rent: "#3b82f6", // blue
  utility: "#f97316", // orange
  shipping: "#06b6d4", // cyan
  tax: "#f43f5e", // rose
  warranty_repair: "#14b8a6", // teal
  other: "#94a3b8", // slate
};
 
export function CashBookDonut({ entries }: CashBookDonutProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
 
  // Group and calculate only "expense" entries
  const stats = useMemo(() => {
    const expenseEntries = entries.filter((e) => e.type === "expense");
    const totalExpense = expenseEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
 
    const grouped: Record<string, number> = {};
    expenseEntries.forEach((e) => {
      const cat = e.category || "other";
      grouped[cat] = (grouped[cat] || 0) + Number(e.amount || 0);
    });
 
    const rawStats = Object.keys(grouped).map((cat) => {
      const amount = grouped[cat];
      const meta = categoryLabels[cat] || {
        label: cat,
        color: "bg-slate-400",
      };
      return {
        category: cat,
        label: meta.label,
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
        color: meta.color,
      };
    });
 
    return {
      totalExpense,
      list: rawStats.sort((a, b) => b.amount - a.amount),
    };
  }, [entries]);
 
  const formatPrice = (price: number) => {
    return Math.round(price).toLocaleString("vi-VN") + "đ";
  };
 
  if (stats.totalExpense === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center w-full">
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/50">
          <Info size={16} />
        </div>
        <p className="text-[12px] font-bold text-[#1d1d1f]">Không có dữ liệu chi phí</p>
        <p className="text-[11px] text-[#7a7a7a] mt-1 max-w-[200px] leading-relaxed">
          Chưa phát sinh dòng tiền chi ra trong khoảng thời gian đã lọc.
        </p>
      </div>
    );
  }
 
  return (
    <div className="space-y-4 w-full">
      {/* Header section with summary total */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu Chi tiêu quỹ</h4>
          <h3 className="text-[20px] font-bold text-slate-800 mt-1 tracking-tight">
            {formatPrice(stats.totalExpense)}
          </h3>
        </div>
        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-wide">
          Chi quỹ
        </span>
      </div>
 
      {/* Apple Health-style Vertical Progress Bars List */}
      <div className="space-y-4 pt-1 max-h-[380px] overflow-y-auto pr-3">
        {stats.list.map((stat, index) => {
          const isHovered = hoveredIndex === index;
          const colorCode = strokeColors[stat.category] || "#94a3b8";
          return (
            <div 
              key={stat.category} 
              className={`space-y-2 p-2 rounded-xl transition-all duration-200 border ${
                isHovered 
                  ? "bg-slate-50/75 border-slate-100 shadow-sm" 
                  : "border-transparent"
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex justify-between text-[12px] font-semibold leading-normal">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${stat.color}`} />
                  <span className="text-slate-700 truncate">{stat.label}</span>
                </div>
                <div className="flex gap-2 text-right shrink-0">
                  <span className="text-slate-900 tracking-tight">{formatPrice(stat.amount)}</span>
                  <span className="text-slate-400 font-medium">{stat.percentage.toFixed(1)}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  style={{ 
                    width: `${stat.percentage}%`, 
                    backgroundColor: colorCode 
                  }}
                  className={`h-full rounded-full transition-all duration-300 ${
                    isHovered ? "brightness-105 saturate-110 shadow-sm" : ""
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
