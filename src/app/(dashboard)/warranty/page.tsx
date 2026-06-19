"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWarrantyClaims, createWarrantyClaim, deleteWarrantyClaim } from "@/app/actions/warranty";
import { GlassCard } from "@/components/ui/glass-card";
import { 
  Search, Plus, ShieldAlert, Wrench, PackageCheck, AlertCircle,
  Eye, Pencil, Trash2
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { WarrantyForm } from "@/components/warranty/warranty-form";
import { WarrantyDetailDialog } from "@/components/warranty/warranty-detail-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { 
  SFSymbolDocText, 
  SFSymbolShieldCheck, 
  SFSymbolWrench, 
  SFSymbolCheckmarkCircle 
} from "@/components/ui/apple-icons";

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string, className: string }> = {
    pending: { label: "Đã tiếp nhận", className: "bg-blue-600 text-white border-blue-700 shadow-sm" },
    inspecting: { label: "Đang kiểm tra", className: "bg-indigo-600 text-white border-indigo-700 shadow-sm" },
    waiting_parts: { label: "Chờ linh kiện", className: "bg-amber-500 text-white border-amber-600 shadow-sm" },
    repairing: { label: "Đang sửa chữa", className: "bg-orange-500 text-white border-orange-600 shadow-sm animate-pulse" },
    completed: { label: "Đã hoàn thành", className: "bg-emerald-600 text-white border-emerald-700 shadow-sm" },
    rejected: { label: "Từ chối", className: "bg-rose-600 text-white border-rose-700 shadow-sm" },
    replaced: { label: "Đổi máy mới", className: "bg-cyan-600 text-white border-cyan-700 shadow-sm" },
  };
  const item = map[status] || { label: status, className: "bg-gray-500 text-white border-gray-600 shadow-sm" };
  return (
    <span className={`px-3 py-1 text-[11px] font-bold rounded-full border shadow-sm ${item.className}`}>
      {item.label}
    </span>
  );
};

export default function WarrantyPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  
  // Modals & States
  const [isWarrantyOpen, setIsWarrantyOpen] = useState(false);
  const [detailClaimId, setDetailClaimId] = useState<string | null>(null);
  const [claimToDelete, setClaimToDelete] = useState<any | null>(null);

  // Queries
  const { data: warranties, isLoading: isLoadingWarranties } = useQuery({
    queryKey: ["warranty_claims"],
    queryFn: getWarrantyClaims,
  });

  // Mutations - Tạo Phiếu
  const createWarrantyMutation = useMutation({
    mutationFn: createWarrantyClaim,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["warranty_claims"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setIsWarrantyOpen(false);
      } else {
        toast.error(res.message);
      }
    }
  });

  // Mutations - Xóa Phiếu
  const deleteMutation = useMutation({
    mutationFn: deleteWarrantyClaim,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["warranty_claims"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setClaimToDelete(null);
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Lỗi khi xóa phiếu bảo hành");
    }
  });

  const handleWarrantySubmit = (data: any) => {
    createWarrantyMutation.mutate(data);
  };

  // Lọc dữ liệu
  const filteredWarranties = warranties?.filter(w => 
    w.claimNumber.toLowerCase().includes(search.toLowerCase()) ||
    w.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
    (w.customerPhone || "").includes(search)
  );

  const formatToDDMMYYYY = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "N/A";
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "N/A";
    }
  };

  const pendingCount = warranties?.filter(w => w.status === 'pending').length || 0;
  const processingCount = warranties?.filter(w => w.status === 'repairing' || w.status === 'inspecting' || w.status === 'waiting_parts').length || 0;
  const completedCount = warranties?.filter(w => w.status === 'completed' || w.status === 'replaced' || w.status === 'rejected').length || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between pb-6 border-b border-[#e0e0e0]">
        <div>
          <h1 className="text-[40px] font-semibold tracking-tight leading-[1.10] bg-clip-text text-transparent select-none" style={{ backgroundImage: "linear-gradient(90deg, #2997ff, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Bảo hành & sửa chữa
          </h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
            <input 
              type="text" 
              placeholder="Tìm mã phiếu, Serial, SĐT..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>

          <button 
            onClick={() => setIsWarrantyOpen(true)}
            className="flex items-center gap-1.5 px-5 h-[40px] bg-[#0066cc] text-white text-[13px] font-medium rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200"
          >
            <Plus size={14} />
            <span>Tạo Phiếu Bảo Hành</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Tổng Phiếu */}
        <div 
          className="group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 select-none border border-white/10 bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(0,102,204,0.15)]"
        >
          {/* Top Row with Label and Icon */}
          <div className="relative z-20 flex justify-between items-start">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
              Tổng Phiếu
            </span>
            <div className="w-8 h-8 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <SFSymbolDocText size={16} />
            </div>
          </div>
          {/* Bottom Value */}
          <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
            {warranties?.length || 0}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* Card 2: Đã Tiếp Nhận */}
        <div 
          className="group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 select-none border border-white/10 bg-gradient-to-br from-[#af52de] to-[#892ec0] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(175,82,222,0.15)]"
        >
          {/* Top Row with Label and Icon */}
          <div className="relative z-20 flex justify-between items-start">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
              Đã Tiếp Nhận
            </span>
            <div className="w-8 h-8 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <SFSymbolShieldCheck size={16} />
            </div>
          </div>
          {/* Bottom Value */}
          <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
            {pendingCount}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* Card 3: Đang Xử Lý */}
        <div 
          className="group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 select-none border border-white/10 bg-gradient-to-br from-[#ff9f0a] to-[#ff7b00] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(255,159,10,0.15)]"
        >
          {/* Top Row with Label and Icon */}
          <div className="relative z-20 flex justify-between items-start">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
              Đang Xử Lý
            </span>
            <div className="w-8 h-8 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <SFSymbolWrench size={16} />
            </div>
          </div>
          {/* Bottom Value */}
          <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
            {processingCount}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* Card 4: Đã Hoàn Tất */}
        <div 
          className="group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 select-none border border-white/10 bg-gradient-to-br from-[#34c759] to-[#28a745] shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(52,199,89,0.15)]"
        >
          {/* Top Row with Label and Icon */}
          <div className="relative z-20 flex justify-between items-start">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
              Đã Hoàn Tất
            </span>
            <div className="w-8 h-8 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <SFSymbolCheckmarkCircle size={16} />
            </div>
          </div>
          {/* Bottom Value */}
          <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
            {completedCount}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
      </div>

      {/* Main Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e0e0e0] bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                <th className="px-6 py-4 w-12 text-center">STT</th>
                <th className="px-6 py-4">Mã Phiếu</th>
                <th className="px-6 py-4">Sản Phẩm & Serial</th>
                <th className="px-6 py-4">Khách Hàng</th>
                <th className="px-6 py-4">Ngày Nhận</th>
                <th className="px-6 py-4">Trạng Thái</th>
                <th className="px-6 py-4 w-[160px] text-center">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="text-[14px] text-[#1d1d1f]">
              {filteredWarranties?.map((w, index) => (
                <tr key={w.id} className="border-b border-[#e0e0e0] last:border-0 hover:bg-[#f5f5f7]/60 transition-colors">
                  <td className="px-6 py-5 text-center font-semibold text-[#7a7a7a]">{index + 1}</td>
                  <td className="px-6 py-5 font-semibold text-[#0066cc]">{w.claimNumber}</td>
                  <td className="px-6 py-5">
                    <p className="font-semibold">{w.productName}</p>
                    <span className="font-mono text-[12px] text-[#7a7a7a] bg-[#f5f5f7] px-2 rounded border">{w.serialNumber}</span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-semibold">{w.customerName}</p>
                    <p className="text-[12px] text-[#7a7a7a]">{w.customerPhone}</p>
                  </td>
                  <td className="px-6 py-5">{formatToDDMMYYYY(w.receivedDate)}</td>
                  <td className="px-6 py-5">
                    {getStatusBadge(w.status)}
                  </td>
                  
                  {/* Cột Tác vụ Apple Premium */}
                  <td className="px-6 py-5 text-center whitespace-nowrap w-[160px]">
                    <div className="flex items-center justify-center gap-2.5">
                      {/* Xem chi tiết */}
                      <button
                        onClick={() => setDetailClaimId(w.id)}
                        className="w-10 h-10 bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] hover:border-[#d1d1d6] rounded-2xl text-[#48484a] hover:text-[#1c1c1e] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                        title="Xem chi tiết"
                      >
                        <Eye size={18} />
                      </button>

                      {/* Chỉnh sửa/Cập nhật */}
                      <button
                        onClick={() => setDetailClaimId(w.id)}
                        className="w-10 h-10 bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] hover:border-[#d1d1d6] rounded-2xl text-[#48484a] hover:text-[#1c1c1e] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                        title="Cập nhật tiến độ & Sửa"
                      >
                        <Pencil size={18} />
                      </button>

                      {/* Xóa phiếu */}
                      <button
                        onClick={() => setClaimToDelete(w)}
                        className="w-10 h-10 bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] hover:border-[#d1d1d6] rounded-2xl text-[#48484a] hover:text-[#1c1c1e] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                        title="Xóa phiếu vĩnh viễn"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredWarranties?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-[#7a7a7a]">Không tìm thấy phiếu bảo hành nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Dialogs */}
      <Dialog 
        isOpen={isWarrantyOpen} 
        onClose={() => setIsWarrantyOpen(false)}
        title="Tiếp Nhận Bảo Hành"
        description="Ghi nhận máy bảo hành từ khách hàng."
        size="3xl"
      >
        <WarrantyForm
          onSubmit={handleWarrantySubmit}
          onCancel={() => setIsWarrantyOpen(false)}
          isLoading={createWarrantyMutation.isPending}
        />
      </Dialog>

      <Dialog 
        isOpen={!!detailClaimId} 
        onClose={() => setDetailClaimId(null)}
        title="Chi tiết Phiếu Bảo Hành"
        description="Xem lỗi kỹ thuật và cập nhật tiến độ xử lý."
        size="4xl"
      >
        <WarrantyDetailDialog
          claimId={detailClaimId}
          onClose={() => setDetailClaimId(null)}
        />
      </Dialog>

      {/* Dialog xác nhận xóa phiếu bảo hành */}
      <ConfirmDialog
        isOpen={!!claimToDelete}
        onClose={() => setClaimToDelete(null)}
        onConfirm={() => {
          if (claimToDelete) {
            deleteMutation.mutate(claimToDelete.id);
          }
        }}
        title="Xác nhận xóa phiếu bảo hành"
        description={`Bạn có chắc chắn muốn xóa Phiếu bảo hành "${claimToDelete?.claimNumber}"? Toàn bộ nhật ký liên quan sẽ bị xóa, và trạng thái thiết bị Serial "${claimToDelete?.serialNumber}" sẽ được tự động khôi phục về trạng thái "Đã bán" trong kho.`}
        confirmText="Xóa vĩnh viễn"
        cancelText="Giữ lại phiếu"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
