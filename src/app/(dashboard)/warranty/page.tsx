"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWarrantyClaims, createWarrantyClaim, deleteWarrantyClaim } from "@/app/actions/warranty";
import { GlassCard } from "@/components/ui/glass-card";
import { 
  Search, Plus, ShieldAlert, Wrench, PackageCheck, AlertCircle,
  Pencil, Trash2, RefreshCw
} from "lucide-react";
import { useState, useEffect, useMemo, Suspense } from "react";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
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
  const map: Record<string, { label: string; textClass: string }> = {
    pending: { label: "Đã tiếp nhận", textClass: "text-[#0066cc]" },
    inspecting: { label: "Đang kiểm tra", textClass: "text-[#d97706]" },
    waiting_parts: { label: "Chờ linh kiện", textClass: "text-[#7c3aed]" },
    repairing: { label: "Đang sửa chữa", textClass: "text-[#b45309]" },
    completed: { label: "Đã hoàn thành", textClass: "text-[#16a34a]" },
    rejected: { label: "Từ chối", textClass: "text-[#dc2626]" },
    replaced: { label: "Đổi máy mới", textClass: "text-[#4f46e5]" },
  };
  const item = map[status] || { label: status, textClass: "text-[#7a7a7a]" };
  return (
    <span className={`text-[13.5px] font-semibold ${item.textClass}`}>
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

  // Kích hoạt Supabase Realtime cho bảo hành
  useRealtimeSubscription("warranty_claims", [["warranty_claims"]]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
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

  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    setPage(1);
  }, [search, selectedStatus]);

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

  const totalItems = filteredWarranties?.length || 0;
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const paginatedWarranties = useMemo(() => {
    const offset = (page - 1) * limit;
    return filteredWarranties?.slice(offset, offset + limit) || [];
  }, [filteredWarranties, page, limit]);

  const activeSegmentIndex = useMemo(() => {
    if (selectedStatus === "all") return 0;
    if (selectedStatus === "pending") return 1;
    if (selectedStatus === "processing") return 2;
    if (selectedStatus === "completed") return 3;
    return 0;
  }, [selectedStatus]);

  const formatToDDMMYYYY = (dateString: string | Date | null) => {
    if (!mounted) return "";
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

  if (!mounted) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-[#7a7a7a]">
        <RefreshCw className="animate-spin mb-4 text-[#0066cc]" size={24} />
        <p className="text-[15px] font-medium">Đang tải trang bảo hành...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        {!mounted || isLoadingWarranties ? (
          <div className="p-16 flex flex-col items-center justify-center text-[#7a7a7a]">
            <RefreshCw className="animate-spin mb-4 text-[#0066cc]" size={24} />
            <p className="text-[15px] font-medium">Đang truy xuất sổ bảo hành...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
              <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                <th className="px-3 py-3 w-10 text-center border-b border-[#e0e0e0]">STT</th>
                <th className="px-4 py-3 border-b border-[#e0e0e0]">Mã Phiếu</th>
                <th className="px-4 py-3 border-b border-[#e0e0e0]">Sản Phẩm & Serial</th>
                <th className="px-4 py-3 border-b border-[#e0e0e0]">Khách Hàng</th>
                <th className="px-4 py-3 border-b border-[#e0e0e0]">Trạng Thái</th>
                <th className="px-3 py-3 w-[160px] text-center border-b border-[#e0e0e0]">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="text-[15px] text-[#1d1d1f]">
              {paginatedWarranties?.map((w, index) => {
                const isLast = index === paginatedWarranties.length - 1;
                return (
                  <tr 
                    key={w.id} 
                    className="group cursor-pointer"
                    onClick={() => setDetailClaimId(w.id)}
                  >
                    <td className={`px-3 py-4 text-center font-semibold text-[#7a7a7a] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className={`px-4 py-4 font-semibold ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <span className="text-[#0066cc] group-hover:underline font-semibold block">
                        {w.claimNumber}
                      </span>
                      <span className="text-[12px] text-[#7a7a7a] block mt-0.5 font-normal whitespace-nowrap">
                        Ngày nhận: {formatToDDMMYYYY(w.receivedDate)}
                      </span>
                    </td>
                    <td className={`px-4 py-4 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <p className="font-semibold text-[#0066cc]">{w.productName}</p>
                      <span className="text-[12px] text-[#7a7a7a] block mt-0.5">SN: {w.serialNumber}</span>
                    </td>
                    <td className={`px-4 py-4 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <p className="font-semibold text-[#0066cc]">{w.customerName}</p>
                      <p className="text-[12px] text-[#5856d6] font-medium mt-0.5">{w.customerPhone || "Không có SĐT"}</p>
                    </td>
                    <td className={`px-4 py-4 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {getStatusBadge(w.status)}
                    </td>
                    
                    <td 
                      className={`px-3 py-4 text-center whitespace-nowrap w-[160px] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}
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
              {totalItems === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[#7a7a7a]">Không tìm thấy phiếu bảo hành nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Bộ điều khiển phân trang */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#e0e0e0] flex flex-col sm:flex-row items-center justify-between gap-4 bg-white text-[14px] select-none">
            <div className="text-[#7a7a7a]">
              Hiển thị dòng <b>{(page - 1) * limit + 1}</b> - <b>{Math.min(page * limit, totalItems)}</b> trong tổng số <b>{totalItems}</b> phiếu bảo hành
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 hover:border-[#0071e3] hover:text-[#0071e3] hover:bg-blue-50/30 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
              >
                Trước
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  if (
                    totalPages > 5 &&
                    Math.abs(p - page) > 2 &&
                    p !== 1 &&
                    p !== totalPages
                  ) {
                    if (p === 2 && page > 4) return <span key="dots-1" className="px-1.5 text-slate-400 font-bold">...</span>;
                    if (p === totalPages - 1 && page < totalPages - 3) return <span key="dots-2" className="px-1.5 text-slate-400 font-bold">...</span>;
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-7.5 h-7.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer flex items-center justify-center active:scale-90 ${
                        p === page
                          ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
                          : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 hover:border-[#0071e3] hover:text-[#0071e3] hover:bg-blue-50/30 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Dialogs */}
      <Dialog 
        isOpen={isWarrantyOpen} 
        onClose={() => setIsWarrantyOpen(false)}
        title={<span className="text-[#0066cc]">Tiếp Nhận Bảo Hành</span>}
        size="xl"
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
        title={<span className="text-[#0066cc]">Chi Tiết Phiếu Bảo Hành</span>}
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
