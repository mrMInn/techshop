"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReturnsList, createReturn, deleteReturnAction, getReturnDetailAction } from "@/app/actions/returns";
import { GlassCard } from "@/components/ui/glass-card";
import { 
  Search, Plus, RefreshCcw, Pencil, Trash2
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { ReturnForm } from "@/components/returns/return-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Modals
  const [isReturnOpen, setIsReturnOpen] = useState(false);

  // Detail Dialog states
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [returnDetail, setReturnDetail] = useState<any | null>(null);

  // Delete states
  const [returnToDelete, setReturnToDelete] = useState<any | null>(null);

  // Queries
  const { data: returnsData, isLoading: isLoadingReturns } = useQuery({
    queryKey: ["returns"],
    queryFn: getReturnsList,
  });

  // Mutations
  const createReturnMutation = useMutation({
    mutationFn: createReturn,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["returns"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setIsReturnOpen(false);
      } else {
        toast.error(res.message);
      }
    }
  });

  const handleReturnSubmit = (data: any) => {
    createReturnMutation.mutate(data);
  };

  const handleViewDetail = async (id: string) => {
    setSelectedReturnId(id);
    setIsDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await getReturnDetailAction(id);
      if (res.success) {
        setReturnDetail(res);
      } else {
        toast.error(res.message || "Không thể lấy chi tiết phiếu đổi trả");
        setIsDetailOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi lấy chi tiết");
      setIsDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleEditReturn = (returnNumber: string) => {
    toast.info(`Phiếu đổi trả ${returnNumber} đã được hạch toán hoàn thành và lưu vào sổ quỹ. Không được phép chỉnh sửa trực tiếp để bảo toàn dữ liệu đối soát.`);
  };

  const deleteMutation = useMutation({
    mutationFn: deleteReturnAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["returns"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setReturnToDelete(null);
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Lỗi khi xóa phiếu đổi trả");
    }
  });

  // Lọc dữ liệu
  const filteredReturns = returnsData?.filter(r => 
    r.returnNumber.toLowerCase().includes(search.toLowerCase()) ||
    r.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.customerPhone || "").includes(search)
  );

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

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(price) || 0);
  };

  const getReturnReasonLabel = (reason: string) => {
    const mapping: Record<string, string> = {
      defective: "Lỗi nhà sản xuất",
      changed_mind: "Khách đổi ý / Nâng cấp",
      wrong_item: "Giao sai hàng",
      other: "Lý do khác",
    };
    return mapping[reason] || reason.replace("_", " ");
  };



  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-start pb-6 border-b border-[#e0e0e0]">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
            <input 
              type="text" 
              placeholder="Tìm mã phiếu đổi trả, SĐT..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>

          <button 
            onClick={() => setIsReturnOpen(true)}
            className="flex items-center gap-1.5 px-5 h-[40px] bg-[#0066cc] text-white text-[13px] font-medium rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200"
          >
            <Plus size={14} />
            <span>Tạo Phiếu Đổi/Trả</span>
          </button>
        </div>



      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                <th className="px-6 py-4 w-12 text-center border-b border-[#e0e0e0]">STT</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Mã Phiếu</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Đơn Gốc</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Khách Hàng</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Loại Phiếu</th>
                <th className="px-6 py-4 border-b border-[#e0e0e0]">Lý do</th>
                <th className="px-6 py-4 text-right border-b border-[#e0e0e0]">Tiền Hoàn</th>
                <th className="px-6 py-4 w-44 text-center border-b border-[#e0e0e0]">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="text-[14px] text-[#1d1d1f]">
              {filteredReturns?.map((r, index) => {
                const isLast = index === filteredReturns.length - 1;
                return (
                  <tr 
                    key={r.id} 
                    className="group cursor-pointer"
                    onClick={() => handleViewDetail(r.id)}
                  >
                    <td className={`px-6 py-5 text-center font-semibold text-[#7a7a7a] text-[13px] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {index + 1}
                    </td>
                    <td className={`px-6 py-5 font-semibold text-[#dc2626] group-hover:underline ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <span className="block">{r.returnNumber}</span>
                      <span className="text-[12px] text-[#7a7a7a] block mt-0.5 font-normal whitespace-nowrap">Ngày tạo: {formatToDDMMYYYY(r.createdAt)}</span>
                    </td>
                    <td className={`px-6 py-5 font-semibold ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {r.orderNumber}
                    </td>
                    <td className={`px-6 py-5 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <p className="font-semibold">{r.customerName}</p>
                      <p className="text-[12px] text-[#7a7a7a]">{r.customerPhone}</p>
                    </td>
                    <td className={`px-6 py-5 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      <span className={`font-semibold ${r.type === 'exchange' ? 'text-blue-600' : 'text-[#ff3b30]'}`}>
                        {r.type === 'exchange' ? 'Đổi hàng' : 'Trả hàng'}
                      </span>
                    </td>
                    <td className={`px-6 py-5 text-[#7a7a7a] text-[13px] capitalize ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {getReturnReasonLabel(r.reason)}
                    </td>
                    <td className={`px-6 py-5 text-right font-bold ${Number(r.refundAmount || 0) > 0 ? "text-[#ff3b30]" : "text-[#7a7a7a]"} ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                      {formatPrice(r.refundAmount || 0)}
                    </td>
                    <td 
                      className={`px-6 py-5 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-2.5">
                        {/* Sửa */}
                        <button
                          onClick={() => handleEditReturn(r.returnNumber)}
                          className="w-10 h-10 bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] hover:border-[#d1d1d6] rounded-2xl text-[#48484a] hover:text-[#1c1c1e] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                          title="Chỉnh sửa"
                        >
                          <Pencil size={18} />
                        </button>

                        {/* Xóa */}
                        <button
                          onClick={() => setReturnToDelete(r)}
                          className="w-10 h-10 bg-red-50 hover:bg-[#ff3b30] border border-red-100 hover:border-[#ff3b30] rounded-2xl text-[#ff3b30] hover:text-white flex items-center justify-center shadow-[0_2px_8px_rgba(255,59,48,0.08)] hover:shadow-[0_4px_12px_rgba(255,59,48,0.2)] transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                          title="Xóa phiếu"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredReturns?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-[#7a7a7a]">Không tìm thấy phiếu đổi trả nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Dialogs */}
      <Dialog 
        isOpen={isReturnOpen} 
        onClose={() => setIsReturnOpen(false)}
        title="Tạo Phiếu Đổi/Trả"
        description="Xử lý đổi hàng hoặc hoàn tiền cho khách."
        size="3xl"
      >
        <ReturnForm
          onSubmit={handleReturnSubmit}
          onCancel={() => setIsReturnOpen(false)}
          isLoading={createReturnMutation.isPending}
        />
      </Dialog>

      {/* Dialog xem chi tiết phiếu đổi trả */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setReturnDetail(null);
        }}
        title={`Chi Tiết Phiếu Đổi Trả #${returnDetail?.returnData?.returnNumber || ""}`}
        size="2xl"
      >
        {detailLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#7a7a7a]">
            <RefreshCcw className="animate-spin mb-3 text-[#0066cc]" size={20} />
            <p className="text-[14px]">Đang tải chi tiết phiếu...</p>
          </div>
        ) : returnDetail?.success ? (
          <div className="space-y-6">
            {/* Thông tin chung */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-[14px]">
              <div>
                <span className="text-slate-500">Mã đơn hàng gốc:</span>
                <p className="font-semibold text-slate-800 mt-0.5">{returnDetail.returnData.orderNumber}</p>
              </div>
              <div>
                <span className="text-slate-500">Khách hàng:</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {returnDetail.returnData.customerName} ({returnDetail.returnData.customerPhone})
                </p>
              </div>
              <div>
                <span className="text-slate-500">Phân loại đổi trả:</span>
                <p className="mt-0.5">
                  <span className={`font-semibold ${
                    returnDetail.returnData.type === "exchange" ? "text-blue-600" : "text-[#ff3b30]"
                  }`}>
                    {returnDetail.returnData.type === "exchange" ? "Đổi hàng" : "Trả hàng"}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-slate-500">Lý do chính:</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {getReturnReasonLabel(returnDetail.returnData.reason)}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Chi tiết lý do:</span>
                <p className="text-slate-700 mt-0.5 italic">"{returnDetail.returnData.reasonDetail}"</p>
              </div>
            </div>

            {/* Chi tiết sản phẩm đổi trả */}
            <div>
              <h4 className="text-[14px] font-semibold text-slate-700 mb-2 uppercase tracking-wider">Sản phẩm hoàn trả</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="px-4 py-2.5">Sản phẩm</th>
                      <th className="px-4 py-2.5 text-center">Tình trạng</th>
                      <th className="px-4 py-2.5 text-right">Giá gốc mua</th>
                      <th className="px-4 py-2.5 text-right">Giá hoàn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnDetail.items.map((item: any) => (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{item.productName}</p>
                          {item.defectDescription && (
                            <p className="text-[11px] text-red-500 mt-0.5">Lỗi: {item.defectDescription}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            item.conditionOnReturn === "like_new" ? "bg-green-100 text-green-800" :
                            item.conditionOnReturn === "good" ? "bg-emerald-100 text-emerald-800" :
                            item.conditionOnReturn === "damaged" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                          }`}>
                            {item.conditionOnReturn === "like_new" ? "Như mới" :
                             item.conditionOnReturn === "good" ? "Tốt" :
                             item.conditionOnReturn === "damaged" ? "Trầy xước" : "Lỗi hỏng"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatPrice(item.originalPrice)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatPrice(item.refundPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chi tiết tài chính & hạch toán */}
            <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                <span className="text-[12px] text-slate-500">Phí dịch vụ</span>
                <p className="text-[16px] font-semibold text-slate-800 mt-0.5">
                  {formatPrice(returnDetail.returnData.feeAmount || 0)}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                <span className="text-[12px] text-slate-500">Thực hoàn khách</span>
                <p className="text-[16px] font-bold text-red-600 mt-0.5">
                  {formatPrice(returnDetail.returnData.refundAmount || 0)}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                <span className="text-[12px] text-slate-500">Chênh lệch đổi hàng</span>
                <p className="text-[16px] font-semibold text-slate-800 mt-0.5">
                  {formatPrice(returnDetail.returnData.exchangeDifference || 0)}
                </p>
              </div>
            </div>

            {/* Thông tin thêm */}
            <div className="text-[12px] text-slate-500 flex justify-between pt-2 border-t border-slate-100">
              <span>Nhân viên lập: <strong className="text-slate-700">{returnDetail.returnData.processedByName}</strong></span>
              <span>Ngày hạch toán: <strong className="text-slate-700">{formatToDDMMYYYY(returnDetail.returnData.createdAt)}</strong></span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-red-500 text-[14px]">Không thể tải chi tiết phiếu đổi trả.</div>
        )}
      </Dialog>

      {/* Dialog xác nhận xóa phiếu đổi trả */}
      <ConfirmDialog
        isOpen={!!returnToDelete}
        onClose={() => setReturnToDelete(null)}
        onConfirm={() => returnToDelete && deleteMutation.mutate(returnToDelete.id)}
        title="Xác nhận xóa phiếu đổi trả"
        description={`Bạn có chắc chắn muốn xóa phiếu đổi trả "${returnToDelete?.returnNumber}"? Hành động này sẽ hoàn tác toàn bộ số lượng sản phẩm nhập lại kho về trạng thái 'đã bán' của đơn gốc, đồng thời xóa các bút toán Thu/Chi liên quan trong Sổ quỹ kế toán. Lưu ý: hành động này KHÔNG THỂ HOÀN TÁC.`}
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
