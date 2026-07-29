"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GlassCard } from "@/components/ui/glass-card";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { 
  Search, Database, RefreshCcw, Download, Upload, Eye, 
  AlertTriangle, ArrowRightLeft, ShieldAlert, History,
  CheckCircle, ChevronLeft, ChevronRight, X
} from "lucide-react";
import { getAuditLogsAction } from "@/app/actions/audit";
import { exportBackupAction, importRestoreAction } from "@/app/actions/backup";

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<"logs" | "backup">("logs");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // States for Audit Logs
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  const [selectedTable, setSelectedTable] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 15;

  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // States for Backup & Restore
  const [backupLoading, setBackupLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Query Audit Logs
  const { data: logsRes, isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["audit_logs", page, search, selectedAction, selectedTable],
    queryFn: () => getAuditLogsAction({
      page,
      limit,
      search,
      action: selectedAction,
      tableName: selectedTable,
    }),
    enabled: mounted,
  });

  const logs = logsRes?.data || [];
  const total = logsRes?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedAction, selectedTable]);

  // Handle Export Backup
  const handleExportBackup = async () => {
    setBackupLoading(true);
    const toastId = toast.loading("Đang chuẩn bị bản sao lưu cơ sở dữ liệu...");
    try {
      const res = await exportBackupAction();
      if (res.success && res.payload && res.filename) {
        // Create download blob
        const blob = new Blob([res.payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Tải xuống bản sao lưu thành công!", { id: toastId });
      } else {
        toast.error(res.message || "Tạo bản sao lưu thất bại.", { id: toastId });
      }
    } catch (err: any) {
      toast.error("Lỗi: " + err.message, { id: toastId });
    } finally {
      setBackupLoading(false);
    }
  };

  // Handle Restore Backup
  const handleRestoreBackup = async () => {
    if (!selectedFile) return;
    setRestoreConfirmOpen(false);
    setRestoreLoading(true);
    const toastId = toast.loading("Đang khôi phục dữ liệu hệ thống (Quá trình này xóa dữ liệu hiện tại)...");
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target?.result as string;
        try {
          const res = await importRestoreAction(fileContent);
          if (res.success) {
            toast.success("Khôi phục toàn bộ dữ liệu hệ thống thành công!", { id: toastId });
            setSelectedFile(null);
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            toast.error(res.message || "Khôi phục thất bại.", { id: toastId });
          }
        } catch (err: any) {
          toast.error("Lỗi cú pháp file sao lưu: " + err.message, { id: toastId });
        } finally {
          setRestoreLoading(false);
        }
      };
      reader.readAsText(selectedFile);
    } catch (err: any) {
      toast.error("Lỗi đọc file: " + err.message, { id: toastId });
      setRestoreLoading(false);
    }
  };

  // Format date helper
  const formatDateTime = (dateStr: string | Date | null) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "N/A";
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch {
      return "N/A";
    }
  };

  // Audit Logs Filter Tables options
  const tableOptions = [
    { value: "all", label: "Tất cả bảng dữ liệu" },
    { value: "orders", label: "Đơn bán lẻ (orders)" },
    { value: "order_items", label: "Chi tiết đơn bán (order_items)" },
    { value: "inventory_items", label: "Thiết bị kho (inventory_items)" },
    { value: "accessory_items", label: "Phụ kiện kho (accessory_items)" },
    { value: "products", label: "Sản phẩm (products)" },
    { value: "brands", label: "Thương hiệu (brands)" },
    { value: "warranty_claims", label: "Phiếu bảo hành (warranty_claims)" },
    { value: "returns", label: "Phiếu đổi trả (returns)" },
    { value: "cash_book_entries", label: "Sổ quỹ (cash_book_entries)" },
    { value: "customers", label: "Khách hàng (customers)" },
    { value: "suppliers", label: "Nhà cung cấp (suppliers)" },
    { value: "purchase_orders", label: "Đơn nhập (purchase_orders)" },
    { value: "database_backup", label: "Sao lưu (database_backup)" },
    { value: "database_restore", label: "Phục hồi (database_restore)" },
  ];

  // Helper render code comparison side-by-side / highlighting diff
  const renderDataDiff = (log: any) => {
    if (!log) return null;
    const { action, oldData, newData } = log;

    if (action === "CREATE") {
      return (
        <div className="space-y-1">
          <span className="text-[12px] font-semibold text-emerald-600 uppercase">Thêm mới dữ liệu</span>
          <pre className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-[12.5px] font-mono overflow-auto max-h-[300px] text-emerald-800">
            {JSON.stringify(newData, null, 2)}
          </pre>
        </div>
      );
    }

    if (action === "DELETE") {
      return (
        <div className="space-y-1">
          <span className="text-[12px] font-semibold text-red-600 uppercase">Dữ liệu bị xóa</span>
          <pre className="p-4 bg-red-50/50 border border-red-100 rounded-2xl text-[12.5px] font-mono overflow-auto max-h-[300px] text-red-800">
            {JSON.stringify(oldData, null, 2)}
          </pre>
        </div>
      );
    }

    if (action === "UPDATE") {
      const oldObj = oldData || {};
      const newObj = newData || {};
      const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
      const changedList = [];

      for (const key of allKeys) {
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          changedList.push({
            key,
            oldVal: oldObj[key],
            newVal: newObj[key],
          });
        }
      }

      return (
        <div className="space-y-3">
          <span className="text-[12px] font-semibold text-blue-600 uppercase">Các trường thay đổi (Dữ liệu cũ ➔ Dữ liệu mới)</span>
          {changedList.length === 0 ? (
            <p className="text-[13px] text-slate-500 italic">Không có thay đổi về mặt dữ liệu các trường chính (chỉ cập nhật mốc thời gian hệ thống).</p>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase border-b border-slate-200">
                    <th className="px-4 py-2.5">Trường dữ liệu</th>
                    <th className="px-4 py-2.5">Giá trị cũ (Trước)</th>
                    <th className="px-4 py-2.5">Giá trị mới (Sau)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[12px]">
                  {changedList.map((c) => (
                    <tr key={c.key} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700 font-sans">{c.key}</td>
                      <td className="px-4 py-3 text-red-600 bg-red-50/30 line-through">
                        {c.oldVal !== undefined && c.oldVal !== null ? (typeof c.oldVal === 'object' ? JSON.stringify(c.oldVal) : String(c.oldVal)) : "(trống)"}
                      </td>
                      <td className="px-4 py-3 text-emerald-600 bg-emerald-50/30 font-semibold">
                        {c.newVal !== undefined && c.newVal !== null ? (typeof c.newVal === 'object' ? JSON.stringify(c.newVal) : String(c.newVal)) : "(trống)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <span className="text-[13px] font-bold">Đang tải cấu hình hệ thống...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#e0e0e0]">
        <div>
          <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-red-500" size={26} />
            <span>Hệ thống Giám sát & An toàn Dữ liệu</span>
          </h1>
          <p className="text-[14px] text-[#7a7a7a] mt-1">Giám sát hoạt động nhân sự, quản lý sao lưu và phục hồi dữ liệu ERP.</p>
        </div>

        {/* Tab Selector - Apple Segment Style */}
        <div className="bg-[#e5e5ea]/50 p-1.5 rounded-full flex gap-1 select-none w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-5 py-2 text-[13px] font-medium rounded-full cursor-pointer transition-all duration-200 ${
              activeTab === "logs" 
                ? "bg-white text-[#1d1d1f] shadow-sm font-semibold" 
                : "text-[#7a7a7a] hover:text-[#1c1c1e]"
            }`}
          >
            <History size={14} />
            <span>Nhật ký hoạt động</span>
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`flex items-center gap-2 px-5 py-2 text-[13px] font-medium rounded-full cursor-pointer transition-all duration-200 ${
              activeTab === "backup" 
                ? "bg-white text-[#1d1d1f] shadow-sm font-semibold" 
                : "text-[#7a7a7a] hover:text-[#1c1c1e]"
            }`}
          >
            <Database size={14} />
            <span>Sao lưu & Phục hồi</span>
          </button>
        </div>
      </div>

      {/* Content Tab 1: Audit Logs */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 justify-start">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
              <input 
                type="text" 
                placeholder="Tìm người dùng, bảng..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9.5 pr-4 py-2 bg-white border border-[#e0e0e0] focus:border-[#0066cc] rounded-full text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/10 transition-all placeholder:text-[#7a7a7a]/60 placeholder:text-[13px]"
              />
              {search && (
                <button 
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a7a] hover:text-[#1d1d1f]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Bảng dữ liệu dropdown */}
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="px-4 py-2 bg-white border border-[#e0e0e0] rounded-full text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/10"
            >
              {tableOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Thao tác dropdown */}
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-4 py-2 bg-white border border-[#e0e0e0] rounded-full text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/10"
            >
              <option value="all">Tất cả thao tác</option>
              <option value="CREATE">CREATE (Thêm mới)</option>
              <option value="UPDATE">UPDATE (Sửa đổi)</option>
              <option value="DELETE">DELETE (Xóa bỏ)</option>
            </select>

            <button 
              onClick={() => refetchLogs()}
              className="w-9 h-9 bg-white border border-[#e0e0e0] hover:border-[#0066cc] text-[#7a7a7a] hover:text-[#0066cc] rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-95 duration-200 shadow-sm"
              title="Làm mới danh sách"
            >
              <RefreshCcw size={14} />
            </button>
          </div>

          {/* Main Table */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead>
                  <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                    <th className="px-6 py-4 w-12 text-center border-b border-[#e0e0e0]">STT</th>
                    <th className="px-6 py-4 border-b border-[#e0e0e0]">Thời gian</th>
                    <th className="px-6 py-4 border-b border-[#e0e0e0]">Người thực hiện</th>
                    <th className="px-6 py-4 border-b border-[#e0e0e0]">Thao tác</th>
                    <th className="px-6 py-4 border-b border-[#e0e0e0]">Bảng dữ liệu</th>
                    <th className="px-6 py-4 border-b border-[#e0e0e0]">Mã bản ghi (ID)</th>
                    <th className="px-6 py-4 w-28 text-center border-b border-[#e0e0e0]">Tác vụ</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-[#1d1d1f]">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-[#7a7a7a]">Đang tải dữ liệu nhật ký hệ thống...</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-[#7a7a7a]">Không tìm thấy hoạt động nào phù hợp.</td>
                    </tr>
                  ) : (
                    logs.map((log: any, index) => {
                      const isLast = index === logs.length - 1;
                      const globalIdx = (page - 1) * limit + index + 1;
                      
                      let actionText = "Sửa đổi";
                      let actionColor = "text-[#0066cc]";
                      if (log.action === "CREATE") {
                        actionText = "Thêm mới";
                        actionColor = "text-[#34c759]";
                      } else if (log.action === "DELETE") {
                        actionText = "Xóa bỏ";
                        actionColor = "text-[#ff3b30]";
                      }

                      return (
                        <tr 
                          key={log.id} 
                          className="group hover:bg-[#f5f5f7]/30 transition-colors"
                        >
                          <td className={`px-6 py-4 text-center font-semibold text-[#7a7a7a] text-[13px] ${isLast ? "" : "border-b border-[#e0e0e0]"}`}>
                            {globalIdx}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-[13px] text-[#7a7a7a] ${isLast ? "" : "border-b border-[#e0e0e0]"}`}>
                            {formatDateTime(log.createdAt)}
                          </td>
                          <td className={`px-6 py-4 ${isLast ? "" : "border-b border-[#e0e0e0]"}`}>
                            <p className="font-semibold">{log.userFullName || "Hệ thống / Tác vụ ẩn"}</p>
                            <p className="text-[11.5px] text-[#7a7a7a] font-mono">{log.userEmail || "N/A"}</p>
                          </td>
                          <td className={`px-6 py-4 font-semibold text-[13.5px] ${actionColor} ${isLast ? "" : "border-b border-[#e0e0e0]"}`}>
                            {actionText}
                          </td>
                          <td className={`px-6 py-4 font-semibold text-[#1d1d1f] font-mono text-[13px] ${isLast ? "" : "border-b border-[#e0e0e0]"}`}>
                            {log.tableName}
                          </td>
                          <td className={`px-6 py-4 font-mono text-[12.5px] text-[#7a7a7a] ${isLast ? "" : "border-b border-[#e0e0e0]"}`}>
                            {log.recordId}
                          </td>
                          <td className={`px-6 py-4 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"}`}>
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="w-8.5 h-8.5 rounded-xl border border-[#e5e5ea] hover:border-[#0066cc] bg-white text-[#48484a] hover:text-[#0066cc] flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-[0_1px_4px_rgba(0,0,0,0.02)] shrink-0 mx-auto"
                              title="Xem thay đổi dữ liệu"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#e0e0e0] bg-[#f5f5f7]/30 select-none">
                <span className="text-[13px] text-[#7a7a7a]">
                  Hiển thị <strong className="font-semibold text-[#1d1d1f]">{logs.length}</strong> trên <strong className="font-semibold text-[#1d1d1f]">{total}</strong> bản ghi log
                </span>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-[#e5e5ea] text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[13px] font-semibold text-[#1d1d1f] px-3">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-[#e5e5ea] text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Content Tab 2: Backup & Restore */}
      {activeTab === "backup" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Backup */}
          <GlassCard className="p-8 space-y-6 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0066cc] shadow-sm">
                <Download size={22} />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-[#1d1d1f] tracking-tight">Sao lưu dữ liệu hệ thống (Export)</h3>
                <p className="text-[14px] text-[#7a7a7a] mt-1.5 leading-relaxed">
                  Xuất toàn bộ cấu trúc cơ sở dữ liệu hệ thống (bao gồm sản phẩm, kho hàng, danh sách khách hàng, lịch sử đơn hàng, phiếu bảo hành/đổi trả, sổ quỹ,...) thành một tệp tin sao lưu dạng cấu trúc JSON để tải xuống và lưu giữ an toàn.
                </p>
              </div>
              <ul className="text-[13px] text-slate-600 space-y-1.5 pl-4 list-disc">
                <li>Sao lưu đầy đủ 20 bảng cơ sở dữ liệu của dự án.</li>
                <li>Hỗ trợ tải xuống tức thì từ trình duyệt.</li>
                <li>Dùng để tạo file lưu trữ trước mỗi đợt bảo trì.</li>
              </ul>
            </div>

            <button
              onClick={handleExportBackup}
              disabled={backupLoading || restoreLoading}
              className="w-full flex items-center justify-center gap-2 h-12 bg-[#0066cc] text-white font-semibold text-[14px] rounded-2xl hover:bg-[#0071e3] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] duration-200 cursor-pointer shadow-md shadow-[#0066cc]/10"
            >
              {backupLoading ? (
                <RefreshCcw className="animate-spin" size={16} />
              ) : (
                <Download size={16} />
              )}
              <span>Tạo & Tải Xuống Bản Sao Lưu</span>
            </button>
          </GlassCard>

          {/* Card 2: Restore */}
          <GlassCard className="p-8 space-y-6 flex flex-col justify-between h-full border border-red-100 bg-red-50/5">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shadow-sm">
                <Upload size={22} />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-red-600 tracking-tight">Khôi phục dữ liệu (Import / Restore)</h3>
                <p className="text-[14px] text-[#7a7a7a] mt-1.5 leading-relaxed">
                  ⚠️ **CẢNH BÁO:** Thao tác khôi phục dữ liệu sẽ **xóa hoàn toàn** mọi bản ghi dữ liệu hiện tại trong hệ thống và tải lại dữ liệu từ file sao lưu đã chọn. Vui lòng kiểm tra kỹ lưỡng tệp tin sao lưu trước khi xác nhận khôi phục!
                </p>
              </div>

              {/* Custom File Selector */}
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">Chọn tệp tin sao lưu (.json)</label>
                <div className={`border-2 border-dashed ${selectedFile ? "border-emerald-300 bg-emerald-50/5" : "border-slate-300 hover:border-slate-400"} rounded-2xl p-6 text-center cursor-pointer transition-colors relative`}>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-[14px] font-bold text-emerald-600 flex items-center justify-center gap-1.5">
                        <CheckCircle size={16} />
                        <span>Đã nhận file sao lưu</span>
                      </p>
                      <p className="text-[12.5px] text-slate-700 font-semibold truncate max-w-xs mx-auto">{selectedFile.name}</p>
                      <p className="text-[11px] text-[#7a7a7a]">Dung lượng: {(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-500">
                      <Upload className="mx-auto" size={24} />
                      <p className="text-[13px] font-medium">Nhấp hoặc kéo thả file `.json` vào đây</p>
                      <p className="text-[11px] text-[#7a7a7a]">Chỉ chấp nhận file định dạng đuôi .json</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setRestoreConfirmOpen(true)}
              disabled={!selectedFile || restoreLoading || backupLoading}
              className="w-full flex items-center justify-center gap-2 h-12 bg-red-600 text-white font-semibold text-[14px] rounded-2xl hover:bg-[#ff3b30] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] duration-200 cursor-pointer shadow-md shadow-red-600/10"
            >
              {restoreLoading ? (
                <RefreshCcw className="animate-spin" size={16} />
              ) : (
                <Upload size={16} />
              )}
              <span>Bắt Đầu Khôi Phục Dữ Liệu</span>
            </button>
          </GlassCard>
        </div>
      )}

      {/* Dialog: Xem chi tiết Nhật ký */}
      <Dialog
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Chi tiết Nhật Ký Hoạt Động"
        description="So sánh sự thay đổi chi tiết của bản ghi cơ sở dữ liệu."
        size="3xl"
      >
        {selectedLog && (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* Metadata Card */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-[13.5px]">
              <div>
                <span className="text-slate-500 block">Người thực hiện:</span>
                <span className="font-semibold text-slate-800">{selectedLog.userFullName || "Hệ thống / Tác vụ ẩn"}</span>
                <span className="block text-[11px] text-slate-500 font-mono mt-0.5">{selectedLog.userEmail || "system"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Thời gian:</span>
                <span className="font-semibold text-slate-800">{formatDateTime(selectedLog.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Bảng dữ liệu:</span>
                <span className="font-semibold text-[#1d1d1f] font-mono">{selectedLog.tableName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Thao tác:</span>
                <span className={`font-bold ${
                  selectedLog.action === 'CREATE' ? 'text-emerald-600' : selectedLog.action === 'DELETE' ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {selectedLog.action === 'CREATE' ? 'THÊM MỚI (CREATE)' : selectedLog.action === 'DELETE' ? 'XÓA BỎ (DELETE)' : 'CẬP NHẬT (UPDATE)'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Mã bản ghi ID:</span>
                <span className="font-semibold text-slate-800 font-mono text-[12px]">{selectedLog.recordId}</span>
              </div>
            </div>

            {/* Dữ liệu Diff */}
            {renderDataDiff(selectedLog)}
          </div>
        )}
      </Dialog>

      {/* Dialog: Confirm Restore */}
      <ConfirmDialog
        isOpen={restoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        title="⚠️ XÁC NHẬN KHÔI PHỤC CƠ SỞ DỮ LIỆU?"
        description={`Hành động này sẽ XÓA TOÀN BỘ dữ liệu hiện tại trong hệ thống TechShop ERP và khôi phục dữ liệu từ tệp tin "${selectedFile?.name}". Hành động này không thể hoàn tác sau khi thực hiện!\n\nBạn có thực sự chắc chắn muốn tiếp tục không?`}
        onConfirm={handleRestoreBackup}
      />
    </div>
  );
}
