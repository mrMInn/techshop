"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWarrantyClaims, createWarrantyClaim, deleteWarrantyClaim } from "@/app/actions/warranty";
import { GlassCard } from "@/components/ui/glass-card";
import { 
  Search, Plus, ShieldAlert, Wrench, PackageCheck, AlertCircle,
  Pencil, Trash2, RefreshCw
} from "lucide-react";
import { useState, useMemo, Suspense } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { WarrantyForm } from "@/components/warranty/warranty-form";
import { WarrantyDetailDialog } from "@/components/warranty/warranty-detail-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { 
  SFSymbolDocText, 
  SFSymbolShieldCheck, 
  SFSymbolWrench, 
  SFSymbolCheckmarkCircle 
} from "@/components/ui/apple-icons";

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string, className: string }> = {
    pending: { label: "Đã tiếp nhận", className: "text-blue-600" },
    inspecting: { label: "Đang kiểm tra", className: "text-indigo-600" },
    waiting_parts: { label: "Chờ linh kiện", className: "text-amber-600" },
    repairing: { label: "Đang sửa chữa", className: "text-orange-600" },
    completed: { label: "Đã hoàn thành", className: "text-emerald-600" },
    rejected: { label: "Từ chối", className: "text-rose-600" },
    replaced: { label: "Đổi máy mới", className: "text-cyan-600" },
  };
  const item = map[status] || { label: status, className: "text-slate-600" };
  return (
    <span className={`text-[13.5px] font-semibold ${item.className}`}>
      {item.label}
    </span>
  );
};

export default function WarrantyPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <span className="text-[13px] font-bold">Đang tải trang bảo hành...</span>
      </div>
    }>
      <WarrantyPageContent />
    </Suspense>
  );
}

function WarrantyPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const selectedStatus = searchParams.get("status") || "all";

  const setSelectedStatus = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  
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
  const filteredWarranties = warranties?.filter(w => {
    const matchesSearch = 
      w.claimNumber.toLowerCase().includes(search.toLowerCase()) ||
      w.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      (w.customerPhone || "").includes(search);
      
    if (!matchesSearch) return false;
    
    if (selectedStatus === "all") return true;
    if (selectedStatus === "pending") return w.status === "pending";
    if (selectedStatus === "processing") return w.status === "repairing" || w.status === "inspecting" || w.status === "waiting_parts";
    if (selectedStatus === "completed") return w.status === "completed" || w.status === "replaced" || w.status === "rejected";
    
    return true;
  });

  const activeSegmentIndex = useMemo(() => {
    if (selectedStatus === "all") return 0;
    if (selectedStatus === "pending") return 1;
    if (selectedStatus === "processing") return 2;
    if (selectedStatus === "completed") return 3;
    return 0;
  }, [selectedStatus]);

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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header - Apple premium single-row layout */}
      <div className="pb-6 border-b border-[#e0e0e0]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          
          {/* Left side: Search & Reset button */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-[280px] md:w-[320px] transition-all duration-300">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
              <input 
                type="text" 
                placeholder="Tìm mã phiếu, Serial, SĐT..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#7a7a7a]/60 shadow-sm"
              />
            </div>

            {/* Reset Button */}
            {(selectedStatus !== "all" || search !== "") && (
              <button
                onClick={() => {
                  setSelectedStatus("all");
                  setSearch("");
                }}
                className="h-[40px] w-[40px] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 duration-200"
                title="Đặt lại bộ lọc"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>

          {/* Right side: Action Button */}
          <div className="flex items-center justify-end md:justify-start shrink-0">
            {/* Create Button */}
            <button 
              onClick={() => setIsWarrantyOpen(true)}
              className="flex items-center gap-1.5 px-5 h-[40px] bg-[#0066cc] text-white text-[13px] font-medium rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0"
            >
              <Plus size={14} />
              <span>Tạo Phiếu</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                <th className="px-6 py-4 w-12 text-center border-b border-[#e0e0e0]">STT</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Mã Phiếu</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Sản Phẩm & Serial</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Khách Hàng</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Ngày Nhận</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Trạng Thái</th>
                <th className="px-6 py-4 w-[160px] text-center border-b border-[#e0e0e0]">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="text-[14px] text-[#1d1d1f]">
              {filteredWarranties?.map((w, index) => {
                const isLast = index === filteredWarranties.length - 1;
                return (
                  <tr 
                    key={w.id} 
                    className="group cursor-pointer"
                    onClick={() => setDetailClaimId(w.id)}
                  >
                    <td className={`px-6 py-5 text-center font-semibold text-[#7a7a7a] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {index + 1}
                    </td>
                    <td className={`px-6 py-5 font-semibold ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <span className="text-[#0066cc] group-hover:underline font-semibold">
                        {w.claimNumber}
                      </span>
                    </td>
                    <td className={`px-6 py-5 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <p className="font-semibold">{w.productName}</p>
                      <span className="text-[12.5px] text-[#7a7a7a] block mt-0.5">{w.serialNumber}</span>
                    </td>
                    <td className={`px-6 py-5 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <p className="font-semibold">{w.customerName}</p>
                      <p className="text-[12px] text-[#7a7a7a]">{w.customerPhone}</p>
                    </td>
                    <td className={`px-6 py-5 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {formatToDDMMYYYY(w.receivedDate)}
                    </td>
                    <td className={`px-6 py-5 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {getStatusBadge(w.status)}
                    </td>
                    
                    <td 
                      className={`px-6 py-5 text-center whitespace-nowrap w-[160px] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-2.5">
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
                          className="w-10 h-10 bg-red-50 hover:bg-[#ff3b30] border border-red-100 hover:border-[#ff3b30] rounded-2xl text-[#ff3b30] hover:text-white flex items-center justify-center shadow-[0_2px_8px_rgba(255,59,48,0.08)] hover:shadow-[0_4px_12px_rgba(255,59,48,0.2)] transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                          title="Xóa phiếu vĩnh viễn"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
