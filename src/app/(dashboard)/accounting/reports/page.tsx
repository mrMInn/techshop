"use client";

import { useQuery } from "@tanstack/react-query";
import { getIncomeStatementReport, getCashFlowStatementReport } from "@/app/actions/reports";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { 
  Loader2, 
  Printer, 
  Download, 
  RefreshCcw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const formatToDDMMYYYY = (dateString: string | Date | null) => {
  if (!dateString) return "N/A";
  try {
    let d: Date;
    if (typeof dateString === "string") {
      const parts = dateString.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        d = new Date(year, month, day);
      } else {
        d = new Date(dateString);
      }
    } else {
      d = dateString;
    }
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "N/A";
  }
};

export default function ReportsPage() {
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  });
  const [activeReportTab, setActiveReportTab] = useState<"pl" | "cashflow">("pl");
  const [selectedPeriod, setSelectedPeriod] = useState<"this_month" | "this_quarter" | "this_year" | "last_30" | null>("this_month");

  // Queries
  const { 
    data: plData, 
    isLoading: isLoadingPL, 
    refetch: refetchPL,
    isFetching: isFetchingPL
  } = useQuery({
    queryKey: ["income_statement", startDate, endDate],
    queryFn: () => getIncomeStatementReport(startDate, endDate),
    enabled: activeReportTab === "pl",
  });

  const { 
    data: cashFlowData, 
    isLoading: isLoadingCashFlow, 
    refetch: refetchCashFlow,
    isFetching: isFetchingCashFlow
  } = useQuery({
    queryKey: ["cashflow_statement", startDate, endDate],
    queryFn: () => getCashFlowStatementReport(startDate, endDate),
    enabled: activeReportTab === "cashflow",
  });

  const formatVND = (val: string | number) => {
    return Math.round(Number(val || 0)).toLocaleString("vi-VN") + "đ";
  };

  const handleQuickFilter = (type: "this_month" | "this_quarter" | "this_year" | "last_30") => {
    const today = new Date(); // Sử dụng ngày hệ thống thực tế động
    const year = today.getFullYear();
    const month = today.getMonth();
    setSelectedPeriod(type);

    if (type === "this_month") {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(lastDay.toISOString().split("T")[0]);
    } else if (type === "this_quarter") {
      const quarter = Math.floor(month / 3);
      const firstDay = new Date(year, quarter * 3, 1);
      const lastDay = new Date(year, (quarter + 1) * 3, 0);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(lastDay.toISOString().split("T")[0]);
    } else if (type === "this_year") {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (type === "last_30") {
      const priorDate = new Date(today);
      priorDate.setDate(today.getDate() - 30);
      setStartDate(priorDate.toISOString().split("T")[0]);
      setEndDate(today.toISOString().split("T")[0]);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    toast.info("Đang xuất dữ liệu báo cáo...");
    const wb = XLSX.utils.book_new();
    
    if (activeReportTab === "pl" && plData) {
      const sheetData = [
        ["BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH (P&L)"],
        [`Từ ngày: ${startDate} - Đến ngày: ${endDate}`],
        [],
        ["Chỉ tiêu", "Mã số", "Số tiền (VNĐ)"],
        ["I. DOANH THU & KHOẢN GIẢM TRỪ", "", ""],
        ["1. Doanh thu bán lẻ sản phẩm", "01", Math.round(plData.salesRevenue)],
        ["2. Doanh thu dịch vụ sửa chữa & bảo hành", "02", Math.round(plData.warrantyIncome)],
        ["3. Các khoản giảm trừ doanh thu (Đổi trả hoàn tiền)", "03", -Math.round(plData.salesRefunds)],
        ["Doanh thu thuần trong kỳ (01 + 02 - 03)", "10", Math.round(plData.netRevenue)],
        ["II. GIÁ VỐN HÀNG BÁN & LỢI NHUẬN GỘP", "", ""],
        ["1. Trị giá gốc xuất kho (COGS)", "11", -Math.round(plData.costOfGoodsSold)],
        ["Lợi nhuận gộp từ bán hàng & dịch vụ (10 - 11)", "20", Math.round(plData.salesGrossMargin)],
        ["III. CHI PHÍ VẬN HÀNH DOANH NGHIỆP", "", ""],
        ...plData.expenseBreakdown.map((exp, idx) => [
          `Chi phí ${exp.categoryName}`,
          `21.${idx + 1}`,
          -Math.round(exp.amount)
        ]),
        ["Tổng chi phí hoạt động kinh doanh", "25", -Math.round(plData.totalOperatingExpenses)],
        ["IV. LỢI NHUẬN RÒNG TRƯỚC THUẾ (20 - 25)", "30", Math.round(plData.netProfit)]
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Auto-fit columns
      const maxColWidth: number[] = [];
      sheetData.forEach((row) => {
        row.forEach((cell, i) => {
          const cellLen = cell ? cell.toString().length : 10;
          maxColWidth[i] = Math.max(maxColWidth[i] || 10, cellLen + 3);
        });
      });
      ws["!cols"] = maxColWidth.map(w => ({ wch: w }));
      
      XLSX.utils.book_append_sheet(wb, ws, "Báo cáo P&L");
    } else if (activeReportTab === "cashflow" && cashFlowData) {
      const sheetData = [
        ["BÁO CÁO LƯU CHUYỂN TIỀN TỆ TRỰC TIẾP (CASH FLOW)"],
        [`Từ ngày: ${startDate} - Đến ngày: ${endDate}`],
        [],
        ["Chỉ tiêu", "Số tiền (VNĐ)"],
        ["Dòng tiền vào từ hoạt động kinh doanh", Math.round(cashFlowData.operatingInflow)],
        ["Dòng tiền ra từ hoạt động kinh doanh", -Math.round(cashFlowData.operatingOutflow)],
        ["Dòng tiền thuần hoạt động kinh doanh", Math.round(cashFlowData.netOperatingCashFlow)],
        ["Dòng tiền ra hoạt động đầu tư (Mua sắm thiết bị)", -Math.round(cashFlowData.investingOutflow)],
        ["Dòng tiền thuần hoạt động đầu tư", Math.round(cashFlowData.netInvestingCashFlow)],
        ["LƯU CHUYỂN TIỀN THUẦN TRONG KỲ", Math.round(cashFlowData.netCashFlow)]
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Auto-fit columns
      const maxColWidth: number[] = [];
      sheetData.forEach((row) => {
        row.forEach((cell, i) => {
          const cellLen = cell ? cell.toString().length : 10;
          maxColWidth[i] = Math.max(maxColWidth[i] || 10, cellLen + 3);
        });
      });
      ws["!cols"] = maxColWidth.map(w => ({ wch: w }));
      
      XLSX.utils.book_append_sheet(wb, ws, "Lưu chuyển tiền tệ");
    }
    
    XLSX.writeFile(wb, `BaoCaoTaiChinh_${activeReportTab}_${startDate}_${endDate}.xlsx`);
    toast.success("Đã xuất báo cáo Excel (.xlsx) thành công");
  };

  const isDataLoading = activeReportTab === "pl" ? isLoadingPL : isLoadingCashFlow;
  const isRefreshing = activeReportTab === "pl" ? isFetchingPL : isFetchingCashFlow;

  return (
    <div className="space-y-6 font-sans print:bg-white print:text-black">
      {/* CSS overrides specifically for clean page borders when printing */}
      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          /* Hide sidebar, headers, and controllers */
          aside, nav, header, .print\\:hidden, button, input, select {
            display: none !important;
          }
          /* Remove layout wrapping margins */
          main, .workspace, .container {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .print\\:w-full {
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
          }
          .print\\:text-black {
            color: #000000 !important;
          }
        }
      `}</style>

      {/* Controller & Filter Bar - Apple Executive Style - Unified & Flat */}
      <div className="pb-6 border-b border-[#e0e0e0] print:hidden">
        <div className="flex flex-wrap items-center gap-3 justify-start">
          
          {/* 1. Toggle Report Type Tabs (P&L vs Cash Flow) - Apple Segmented Control Style */}
          <div className="relative flex bg-[#f5f5f7] p-[3px] rounded-full border border-[#e0e0e0] h-9 w-[290px] shrink-0 select-none overflow-hidden">
            {/* Sliding active indicator */}
            <div 
              className="absolute top-[3px] bottom-[3px] rounded-full bg-[#0066cc] shadow-[0_2px_4px_rgba(0,102,204,0.25)]"
              style={{
                width: "calc(50% - 6px)",
                left: `calc(${(activeReportTab === "pl" ? 0 : 1) * 50}% + 3px)`,
                transition: "left 280ms cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            />
            <button
              onClick={() => setActiveReportTab("pl")}
              className={`w-1/2 h-full relative z-10 flex items-center justify-center text-[12.5px] transition-colors duration-200 cursor-pointer active:scale-98 ${
                activeReportTab === "pl" ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
              }`}
            >
              Báo cáo lãi lỗ
            </button>
            <button
              onClick={() => setActiveReportTab("cashflow")}
              className={`w-1/2 h-full relative z-10 flex items-center justify-center text-[12.5px] transition-colors duration-200 cursor-pointer active:scale-98 ${
                activeReportTab === "cashflow" ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
              }`}
            >
              Báo cáo dòng tiền
            </button>
          </div>

          {/* 2. Segmented Control style for Quick Period Filters */}
          <div className="relative flex bg-[#f5f5f7] p-[3px] rounded-full border border-[#e0e0e0] h-9 w-full sm:w-[420px] shrink-0 select-none overflow-hidden">
            {/* Sliding active indicator */}
            {selectedPeriod !== null && (
              <div 
                className="absolute top-[3px] bottom-[3px] rounded-full bg-[#0066cc] shadow-[0_2px_4px_rgba(0,102,204,0.25)]"
                style={{
                  width: "calc(25% - 6px)",
                  left: `calc(${((selectedPeriod === "this_month" ? 0 : selectedPeriod === "this_quarter" ? 1 : selectedPeriod === "this_year" ? 2 : 3)) * 25}% + 3px)`,
                  transition: "left 280ms cubic-bezier(0.16, 1, 0.3, 1)"
                }}
              />
            )}
            {(["this_month", "this_quarter", "this_year", "last_30"] as const).map((type) => {
              const labelMap: Record<string, string> = {
                this_month: "Tháng này",
                this_quarter: "Quý này",
                this_year: "Năm nay",
                last_30: "30 ngày qua",
              };
              const active = selectedPeriod === type;
              return (
                <button
                  key={type}
                  onClick={() => handleQuickFilter(type)}
                  className={`w-1/4 h-full relative z-10 flex items-center justify-center text-[12.5px] transition-colors duration-200 cursor-pointer active:scale-98 ${
                    active ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
                  }`}
                >
                  {labelMap[type]}
                </button>
              );
            })}
          </div>

          {/* 3. Custom Date Pickers Range */}
          <InlineDatePicker
            label="Từ:"
            value={startDate}
            active={selectedPeriod === null}
            onChange={(val) => {
              setStartDate(val);
              setSelectedPeriod(null);
              if (endDate && val > endDate) {
                setEndDate(val);
              }
            }}
          />
          <span className="text-slate-300 font-semibold select-none">/</span>
          <InlineDatePicker
            label="Đến:"
            value={endDate}
            active={selectedPeriod === null}
            onChange={(val) => {
              setEndDate(val);
              setSelectedPeriod(null);
              if (startDate && val < startDate) {
                setStartDate(val);
              }
            }}
            align="right"
          />

          {/* 4. Action Buttons */}
          <div className="flex gap-2 h-9 items-center shrink-0 sm:ml-auto">
            <button
              onClick={() => activeReportTab === "pl" ? refetchPL() : refetchCashFlow()}
              className="flex items-center justify-center h-9 w-9 bg-[#f5f5f7] border border-[#e0e0e0] hover:bg-[#e8e8ed] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer shadow-sm active:scale-[0.95]"
              title="Cập nhật dữ liệu"
            >
              <RefreshCcw size={14} className={isRefreshing ? "animate-spin text-[#0066cc]" : ""} />
            </button>
            <button
              onClick={handlePrint}
              disabled={isDataLoading}
              className="flex items-center justify-center h-9 w-9 bg-[#f5f5f7] border border-[#e0e0e0] hover:bg-[#e8e8ed] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer shadow-sm active:scale-[0.95] disabled:opacity-50"
              title="In báo cáo tài chính"
            >
              <Printer size={14} />
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isDataLoading}
              className="flex items-center justify-center h-9 w-9 bg-[#f5f5f7] border border-[#e0e0e0] hover:bg-[#e8e8ed] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer shadow-sm active:scale-[0.95] disabled:opacity-50"
              title="Xuất báo cáo Excel"
            >
              <Download size={14} />
            </button>
          </div>

        </div>
      </div>

      {/* Main Container */}
      <div className="space-y-6 print:space-y-4">

        {/* Loading Indicator */}
        {isDataLoading ? (
          <div className="bg-white rounded-3xl border border-[#e0e0e0] p-24 flex flex-col items-center justify-center text-[#7a7a7a] shadow-sm">
            <Loader2 className="animate-spin mb-3 text-[#0066cc]" size={28} />
            <p className="text-[13px] font-medium">Đang tính toán và kết xuất dữ liệu tài chính...</p>
          </div>
        ) : activeReportTab === "pl" && plData ? (
          /* ==================== P&L REPORT VIEW ==================== */
          <div className="space-y-6 print:space-y-4">
            


            {/* Apple Flat Structured General Ledger Page */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_15px_50px_rgba(0,0,0,0.06)] overflow-hidden pt-5 pb-8 px-6 md:pt-6 md:pb-10 md:px-10 print:w-full print:border-none print:p-0 print:shadow-none">
              
              {/* Printed Document Header */}
              <div className="print-only text-center pb-8 border-b border-[#e0e0e0]/70 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0066cc]">TechStore ERP System</p>
                <h3 className="text-[22px] font-black text-[#1d1d1f] tracking-tight uppercase">Báo Cáo Kết Quả Hoạt Động Kinh Doanh</h3>
                <p className="text-[13px] text-[#7a7a7a] font-medium">
                  Từ ngày: <span className="font-semibold text-[#1d1d1f]">{formatToDDMMYYYY(startDate)}</span> đến ngày: <span className="font-semibold text-[#1d1d1f]">{formatToDDMMYYYY(endDate)}</span>
                </p>
                <p className="text-[11px] text-[#a0a0a0] italic print:block hidden">Thời gian xuất báo cáo: {formatToDDMMYYYY("2026-05-30")} 19:00</p>
              </div>

              {/* General Ledger Table Structure */}
              <div className="print:mt-8 mt-0">
                <table className="w-full text-left border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b-2 border-[#1d1d1f] text-[#7a7a7a] font-bold uppercase text-[11px] tracking-wider">
                      <th className="py-3.5 pl-2">Mục Chỉ tiêu Kế toán</th>
                      <th className="py-3.5 text-center w-24">Mã số</th>
                      <th className="py-3.5 text-right pr-2">Số tiền kỳ này</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-[#1d1d1f]">
                    
                    {/* Section I */}
                    <tr className="bg-slate-50/70 border-t border-slate-200/80">
                      <td className="py-4 pl-3 font-extrabold text-[14px] text-slate-800" colSpan={3}>
                        I. DOANH THU & KHOẢN GIẢM TRỪ
                      </td>
                    </tr>
                    
                    <tr className="hover:bg-[#f5f5f7]/30 transition-colors">
                      <td className="py-3.5 pl-8 text-[#4a4a4d] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        1. Doanh thu bán lẻ sản phẩm
                      </td>
                      <td className="py-3.5 text-center font-mono text-slate-400 text-[12.5px]">01</td>
                      <td className="py-3.5 text-right pr-3 text-[#1d1d1f] font-semibold tabular-nums">{formatVND(plData.salesRevenue)}</td>
                    </tr>

                    <tr className="hover:bg-[#f5f5f7]/30 transition-colors">
                      <td className="py-3.5 pl-8 text-[#4a4a4d] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        2. Doanh thu dịch vụ sửa chữa & bảo hành
                      </td>
                      <td className="py-3.5 text-center font-mono text-slate-400 text-[12.5px]">02</td>
                      <td className="py-3.5 text-right pr-3 text-[#1d1d1f] font-semibold tabular-nums">{formatVND(plData.warrantyIncome)}</td>
                    </tr>

                    <tr className="hover:bg-[#f5f5f7]/30 transition-colors">
                      <td className="py-3.5 pl-8 text-[#4a4a4d] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        3. Các khoản giảm trừ doanh thu (Đổi trả hoàn tiền)
                      </td>
                      <td className="py-3.5 text-center font-mono text-slate-400 text-[12.5px]">03</td>
                      <td className="py-3.5 text-right pr-3 text-rose-600 font-semibold tabular-nums">- {formatVND(plData.salesRefunds)}</td>
                    </tr>

                    <tr className="bg-blue-50/20 font-bold border-t border-slate-200">
                      <td className="py-3.5 pl-6 text-[#0066cc]">Doanh thu thuần trong kỳ (01 + 02 - 03)</td>
                      <td className="py-3.5 text-center font-mono text-[#0066cc] text-[12.5px]">10</td>
                      <td className="py-3.5 text-right pr-3 text-[#0066cc] font-extrabold tabular-nums">{formatVND(plData.netRevenue)}</td>
                    </tr>

                    {/* Section II */}
                    <tr className="bg-slate-50/70 border-t border-slate-200/80">
                      <td className="py-4 pl-3 font-extrabold text-[14px] text-slate-800" colSpan={3}>
                        II. GIÁ VỐN HÀNG BÁN & LỢI NHUẬN GỘP
                      </td>
                    </tr>

                    <tr className="hover:bg-[#f5f5f7]/30 transition-colors">
                      <td className="py-3.5 pl-8 text-[#4a4a4d] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        1. Trị giá gốc xuất kho (COGS)
                      </td>
                      <td className="py-3.5 text-center font-mono text-slate-400 text-[12.5px]">11</td>
                      <td className="py-3.5 text-right pr-3 text-rose-600 font-semibold tabular-nums">- {formatVND(plData.costOfGoodsSold)}</td>
                    </tr>

                    <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                      <td className="py-3.5 pl-6 text-[#1d1d1f]">Lợi nhuận gộp từ bán hàng & dịch vụ (10 - 11)</td>
                      <td className="py-3.5 text-center font-mono text-gray-600 text-[12.5px]">20</td>
                      <td className="py-3.5 text-right pr-3 text-[#1d1d1f] font-extrabold tabular-nums">{formatVND(plData.salesGrossMargin)}</td>
                    </tr>

                    {/* Section III */}
                    <tr className="bg-slate-50/70 border-t border-slate-200/80">
                      <td className="py-4 pl-3 font-extrabold text-[14px] text-slate-800" colSpan={3}>
                        III. CHI PHÍ VẬN HÀNH DOANH NGHIỆP
                      </td>
                    </tr>

                    {plData.expenseBreakdown.length > 0 ? (
                      plData.expenseBreakdown.map((exp, idx) => (
                        <tr key={idx} className="hover:bg-[#f5f5f7]/30 transition-colors">
                          <td className="py-3.5 pl-8 text-[#4a4a4d] flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Chi phí {exp.categoryName}
                          </td>
                          <td className="py-3.5 text-center font-mono text-slate-400 text-[12.5px]">21.{idx+1}</td>
                          <td className="py-3.5 text-right pr-3 text-rose-600 font-semibold tabular-nums">- {formatVND(exp.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="hover:bg-[#f5f5f7]/30 transition-colors">
                        <td className="py-4 pl-8 text-slate-400 italic font-normal" colSpan={3}>
                          Không ghi nhận chi phí vận hành nào trong khoảng thời gian lọc.
                        </td>
                      </tr>
                    )}

                    <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                      <td className="py-3.5 pl-6 text-[#1d1d1f]">Tổng chi phí hoạt động kinh doanh</td>
                      <td className="py-3.5 text-center font-mono text-gray-600 text-[12.5px]">25</td>
                      <td className="py-3.5 text-right pr-3 text-rose-600 font-extrabold tabular-nums">- {formatVND(plData.totalOperatingExpenses)}</td>
                    </tr>

                    {/* Section IV */}
                    <tr className="bg-[#1d1d1f] text-white border-t-2 border-double border-[#1d1d1f] rounded-b-2xl">
                      <td className="py-4.5 pl-4 font-extrabold text-[14px] text-white">
                        IV. LỢI NHUẬN RÒNG TRƯỚC THUẾ (20 - 25)
                      </td>
                      <td className="py-4.5 text-center font-mono font-extrabold text-white">30</td>
                      <td className="py-4.5 text-right pr-4 font-extrabold text-[16px] text-white tabular-nums">
                        {formatVND(plData.netProfit)}
                      </td>
                    </tr>
                    
                  </tbody>
                </table>
              </div>

              {/* Signature section optimized for corporate documents */}
              <div className="mt-20 grid grid-cols-2 text-center text-[12.5px] font-sans print:mt-24">
                <div className="space-y-1">
                  <p className="text-slate-400 font-extrabold uppercase tracking-widest text-[10.5px]">Người lập biểu</p>
                  <p className="text-[#7a7a7a] text-[11px] font-medium">(Ký, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-[#1d1d1f] text-[13.5px]">Bộ phận Kế toán</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 font-extrabold uppercase tracking-widest text-[10.5px]">Giám đốc duyệt</p>
                  <p className="text-[#7a7a7a] text-[11px] font-medium">(Ký, đóng dấu, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-[#1d1d1f] text-[13.5px]">Chủ cửa hàng / Owner</p>
                </div>
              </div>

            </div>
          </div>
        ) : activeReportTab === "cashflow" && cashFlowData ? (
          /* ==================== CASH FLOW REPORT VIEW ==================== */
          <div className="space-y-6 print:space-y-4">
            


            {/* Apple Flat Structured Cashflow Ledger Page */}
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_15px_50px_rgba(0,0,0,0.06)] overflow-hidden pt-5 pb-8 px-6 md:pt-6 md:pb-10 md:px-10 print:w-full print:border-none print:p-0 print:shadow-none">
              
              {/* Printed Document Header */}
              <div className="print-only text-center pb-8 border-b border-[#e0e0e0]/70 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#0066cc]">TechStore ERP System</p>
                <h3 className="text-[22px] font-black text-[#1d1d1f] tracking-tight uppercase">Báo Cáo Lưu Chuyển Tiền Tệ Trực Tiếp</h3>
                <p className="text-[13px] text-[#7a7a7a] font-medium">
                  Từ ngày: <span className="font-semibold text-[#1d1d1f]">{formatToDDMMYYYY(startDate)}</span> đến ngày: <span className="font-semibold text-[#1d1d1f]">{formatToDDMMYYYY(endDate)}</span>
                </p>
                <p className="text-[11px] text-[#a0a0a0] italic print:block hidden">Thời gian xuất báo cáo: {formatToDDMMYYYY("2026-05-30")} 19:00</p>
              </div>

              {/* Cashflow Table Structure */}
              <div className="print:mt-8 mt-0">
                <table className="w-full text-left border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b-2 border-[#1d1d1f] text-[#7a7a7a] font-bold uppercase text-[11px] tracking-wider">
                      <th className="py-3.5 pl-2">Chỉ tiêu Lưu chuyển Dòng tiền</th>
                      <th className="py-3.5 text-center w-24">Mã số</th>
                      <th className="py-3.5 text-right pr-2">Số tiền kỳ này</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-[#1d1d1f]">
                    
                    {/* Section I */}
                    <tr className="bg-slate-50/70 border-t border-slate-200/80">
                      <td className="py-4 pl-3 font-extrabold text-[14px] text-slate-800" colSpan={3}>
                        I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG KINH DOANH
                      </td>
                    </tr>
                    
                    <tr className="hover:bg-[#f5f5f7]/30 transition-colors">
                      <td className="py-3.5 pl-8 text-[#4a4a4d] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        1. Tiền thu từ bán hàng, cung cấp dịch vụ kỹ thuật
                      </td>
                      <td className="py-3.5 text-center font-mono text-slate-400 text-[12.5px]">01</td>
                      <td className="py-3.5 text-right pr-3 text-emerald-600 font-semibold tabular-nums">+ {formatVND(cashFlowData.operatingInflow)}</td>
                    </tr>

                    <tr className="hover:bg-[#f5f5f7]/30 transition-colors">
                      <td className="py-3.5 pl-8 text-[#4a4a4d] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        2. Tiền chi trả cho nhà cung cấp, chi phí vận hành
                      </td>
                      <td className="py-3.5 text-center font-mono text-slate-400 text-[12.5px]">02</td>
                      <td className="py-3.5 text-right pr-3 text-rose-600 font-semibold tabular-nums">- {formatVND(cashFlowData.operatingOutflow)}</td>
                    </tr>

                    <tr className="bg-blue-50/20 font-bold border-t border-slate-200">
                      <td className="py-3.5 pl-6 text-[#1d1d1f]">Lưu chuyển tiền thuần từ hoạt động kinh doanh (01 - 02)</td>
                      <td className="py-3.5 text-center font-mono text-gray-600 text-[12.5px]">20</td>
                      <td className={`py-3.5 text-right pr-3 font-extrabold tabular-nums ${cashFlowData.netOperatingCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {cashFlowData.netOperatingCashFlow >= 0 ? "+" : ""}{formatVND(cashFlowData.netOperatingCashFlow)}
                      </td>
                    </tr>

                    {/* Section II */}
                    <tr className="bg-slate-50/70 border-t border-slate-200/80">
                      <td className="py-4 pl-3 font-extrabold text-[14px] text-slate-800" colSpan={3}>
                        II. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG ĐẦU TƯ
                      </td>
                    </tr>

                    <tr className="hover:bg-[#f5f5f7]/30 transition-colors">
                      <td className="py-3.5 pl-8 text-[#4a4a4d] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        1. Tiền chi mua sắm tài sản cố định, máy móc & công cụ (Thiết bị)
                      </td>
                      <td className="py-3.5 text-center font-mono text-slate-400 text-[12.5px]">21</td>
                      <td className="py-3.5 text-right pr-3 text-rose-600 font-semibold tabular-nums">- {formatVND(cashFlowData.investingOutflow)}</td>
                    </tr>

                    <tr className="bg-slate-50/80 font-bold border-t border-slate-200">
                      <td className="py-3.5 pl-6 text-[#1d1d1f]">Lưu chuyển tiền thuần từ hoạt động đầu tư</td>
                      <td className="py-3.5 text-center font-mono text-gray-600 text-[12.5px]">30</td>
                      <td className="py-3.5 text-right pr-3 text-rose-600 font-extrabold tabular-nums">
                        {formatVND(cashFlowData.netInvestingCashFlow)}
                      </td>
                    </tr>

                    {/* Section III: Cash Flow Summary */}
                    <tr className="bg-[#1d1d1f] text-white border-t-2 border-double border-[#1d1d1f]">
                      <td className="py-4.5 pl-4 font-extrabold text-[14px] text-white">
                        III. LƯU CHUYỂN TIỀN THUẦN TRONG KỲ (20 + 30)
                      </td>
                      <td className="py-4.5 text-center font-mono font-extrabold text-white">50</td>
                      <td className={`py-4.5 text-right pr-4 font-extrabold text-[16px] tabular-nums ${cashFlowData.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {cashFlowData.netCashFlow >= 0 ? "+" : ""}{formatVND(cashFlowData.netCashFlow)}
                      </td>
                    </tr>
                    
                  </tbody>
                </table>
              </div>

              {/* Signature section */}
              <div className="mt-20 grid grid-cols-2 text-center text-[12.5px] font-sans print:mt-24">
                <div className="space-y-1">
                  <p className="text-slate-400 font-extrabold uppercase tracking-widest text-[10.5px]">Người lập biểu</p>
                  <p className="text-[#7a7a7a] text-[11px] font-medium">(Ký, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-[#1d1d1f] text-[13.5px]">Thủ quỹ / Kế toán</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 font-extrabold uppercase tracking-widest text-[10.5px]">Giám đốc duyệt</p>
                  <p className="text-[#7a7a7a] text-[11px] font-medium">(Ký, đóng dấu, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-[#1d1d1f] text-[13.5px]">Chủ cửa hàng / Owner</p>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#e0e0e0] p-16 text-center text-gray-400">
            Không tìm thấy thông tin báo cáo.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// INLINE CUSTOM PICKERS (DASHBOARD SYNCED)
// ============================================================

// Custom Apple-style Inline Date Picker
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
    <div ref={containerRef} className="relative select-none shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "h-9 rounded-full border px-4 text-[12.5px] font-bold focus:outline-none transition-all flex items-center gap-2 cursor-pointer bg-[#f5f5f7] border-[#e0e0e0] text-[#1d1d1f] hover:bg-[#e8e8ed] active:scale-98 duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          active
            ? "bg-blue-500/10 border-blue-500/30 text-[#0066cc] hover:bg-blue-500/15"
            : ""
        )}
      >
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="tabular-nums">{displayValue}</span>
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
