"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWarrantyClaimDetail, updateWarrantyStatus, getAvailableReplacementItems, deleteWarrantyClaim } from "@/app/actions/warranty";
import { CustomSelect } from "@/components/ui/custom-select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Loader2, Check, Clock
} from "lucide-react";

const formatVNDInput = (value: string) => {
  if (!value) return "";
  const num = parseInt(value.replace(/\D/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("vi-VN");
};

const statusLabels: Record<string, string> = {
  pending: "Đã tiếp nhận",
  inspecting: "Đang kiểm tra",
  waiting_parts: "Chờ linh kiện",
  repairing: "Đang sửa chữa",
  completed: "Đã hoàn thành",
  rejected: "Từ chối bảo hành",
  replaced: "Đổi máy mới"
};

const translateLogDescription = (desc: string) => {
  if (!desc) return "";
  let result = desc;
  Object.keys(statusLabels).forEach(key => {
    result = result.replace(new RegExp(key, "g"), statusLabels[key]);
  });
  return result;
};

interface WarrantyDetailDialogProps {
  claimId: string | null;
  onClose: () => void;
}

export function WarrantyDetailDialog({ claimId, onClose }: WarrantyDetailDialogProps) {
  const queryClient = useQueryClient();
  const [selectedReplacementId, setSelectedReplacementId] = useState("");
  const [newStatus, setNewStatus] = useState<any>("");
  const [diagnosis, setDiagnosis] = useState("");
  const [resolution, setResolution] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [logDescription, setLogDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["warranty_detail", claimId],
    queryFn: () => getWarrantyClaimDetail(claimId as string),
    enabled: !!claimId,
  });

  const claim = data?.claim;
  const logs = data?.logs;

  const { data: replacements, isLoading: isLoadingReplacements } = useQuery({
    queryKey: ["available_replacements", claim?.productId],
    queryFn: () => getAvailableReplacementItems(claim?.productId as string),
    enabled: !!claim?.productId && newStatus === 'replaced',
  });

  useEffect(() => {
    if (claim) {
      setNewStatus(claim.status);
      setDiagnosis(claim.diagnosis || "");
      setResolution(claim.resolution || "");
      const costVal = claim.repairCost && Number(claim.repairCost) > 0 
        ? Math.round(Number(claim.repairCost)).toString() 
        : "";
      setRepairCost(costVal);
      setSelectedReplacementId("");
    }
  }, [claim]);

  const updateMutation = useMutation({
    mutationFn: updateWarrantyStatus,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["warranty_detail", claimId] });
        queryClient.invalidateQueries({ queryKey: ["warranty_claims"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setLogDescription("");
        onClose(); // Tự động đóng dialog khi cập nhật thành công
      } else {
        toast.error(res.message);
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWarrantyClaim,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["warranty_claims"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        onClose();
      } else {
        toast.error(res.message);
      }
    }
  });

  const handleDelete = () => {
    if (!claimId) return;
    if (confirm("Bạn có chắc chắn muốn xóa phiếu bảo hành này? Thiết bị sẽ được khôi phục về trạng thái Đã bán (sold).")) {
      deleteMutation.mutate(claimId);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimId) return;
    if (newStatus === claim?.status && !logDescription) {
      toast.info("Vui lòng thay đổi trạng thái hoặc nhập ghi chú log");
      return;
    }
    
    if (newStatus === 'replaced' && !selectedReplacementId) {
      toast.error("Vui lòng chọn máy thay thế mới");
      return;
    }
    
    const newStatusLabel = statusLabels[newStatus] || newStatus;

    updateMutation.mutate({
      claimId,
      newStatus,
      diagnosis,
      resolution,
      repairCost: repairCost || "0",
      newInventoryItemId: newStatus === 'replaced' ? selectedReplacementId : undefined,
      description: logDescription || "",
    });
  };

  if (!claimId) return null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#7a7a7a]">
        <Loader2 className="animate-spin mb-2" size={24} />
        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (!claim) {
    return <div className="p-4 text-red-500">Không tìm thấy thông tin bảo hành</div>;
  }

  const statusOptions = [
    { value: "pending", label: "Đã tiếp nhận" },
    { value: "inspecting", label: "Đang kiểm tra" },
    { value: "waiting_parts", label: "Chờ linh kiện" },
    { value: "repairing", label: "Đang sửa chữa" },
    { value: "completed", label: "Đã hoàn thành" },
    { value: "rejected", label: "Từ chối bảo hành" },
    { value: "replaced", label: "Đổi máy mới" },
  ];

  const steps = [
    { key: "pending", label: "Tiếp nhận" },
    { key: "inspecting", label: "Kiểm tra" },
    { key: "waiting_parts", label: "Chờ linh kiện" },
    { key: "repairing", label: "Đang sửa" },
    { key: "completed", label: "Hoàn tất" },
  ];

  const getActiveStepIndex = (status: string) => {
    if (status === "pending") return 0;
    if (status === "inspecting") return 1;
    if (status === "waiting_parts") return 2;
    if (status === "repairing") return 3;
    if (status === "completed" || status === "replaced" || status === "rejected") return 4;
    return 0;
  };
  const activeStepIndex = getActiveStepIndex(claim.status);

  return (
    <div className="space-y-5">
      {/* Thanh tiến trình Stepper */}
      <div className="p-5 bg-white/40 backdrop-blur-md rounded-2xl border border-[#e5e5ea] select-none">
        <div className="flex items-center justify-between relative w-full">
          {/* Progress bar background line */}
          <div className="absolute top-[18px] left-[10%] right-[10%] h-0.5 bg-[#e5e5ea] -z-10" />
          {/* Active progress bar line */}
          <div 
            className="absolute top-[18px] left-[10%] h-0.5 bg-[#34c759] transition-all duration-500 -z-10"
            style={{ width: `${(activeStepIndex / 4) * 80}%` }}
          />

          {steps.map((step, idx) => {
            const isCompleted = idx < activeStepIndex || ((claim.status === 'completed' || claim.status === 'replaced' || claim.status === 'rejected') && idx === 4);
            const isActive = idx === activeStepIndex && !isCompleted;
            const isFinalStep = idx === 4;
            
            let displayLabel = step.label;
            if (isFinalStep) {
              if (claim.status === "replaced") displayLabel = "Đổi máy mới";
              else if (claim.status === "rejected") displayLabel = "Từ chối";
              else displayLabel = "Hoàn tất";
            }

            return (
              <div key={step.key} className="flex flex-col items-center flex-1 relative">
                {/* Step Circle */}
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 font-semibold text-[14px] ${
                    isCompleted 
                      ? "bg-[#34c759] border-[#34c759] text-white shadow-[0_0_10px_rgba(52,199,89,0.3)]" 
                      : isActive 
                        ? "bg-[#0071e3] border-[#0071e3] text-white shadow-[0_0_10px_rgba(0,113,227,0.3)] animate-pulse" 
                        : "bg-white border-[#d1d1d6] text-[#8e8e93]"
                  }`}
                >
                  {isCompleted ? (
                    <Check size={16} strokeWidth={3} />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                {/* Step Label */}
                <span 
                  className={`text-[13px] font-semibold mt-2 transition-all ${
                    isCompleted 
                      ? "text-[#34c759]" 
                      : isActive 
                        ? "text-[#0071e3]" 
                        : "text-[#8e8e93]"
                  }`}
                >
                  {displayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Thông tin chung */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-[#e5e5ea] shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
          <div className="mb-2.5">
            <h4 className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wider">Thông tin máy</h4>
          </div>
          <p className="text-[15.5px] font-bold text-[#1d1d1f] leading-snug">{claim.productName}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-[#8e8e93] mt-3 pt-2.5 border-t border-[#f5f5f7]">
            <span>SN: <span className="font-semibold text-[#1d1d1f]">{claim.serialNumber}</span></span>
            <span className="text-slate-200">|</span>
            <span className={claim.isUnderWarranty ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
              {claim.isUnderWarranty ? 'Còn BH hãng' : 'Hết BH/Dịch vụ'}
            </span>
            <span className="text-slate-200">|</span>
            <span>Đơn gốc: <span className="font-semibold text-[#1d1d1f]">{claim.orderNumber}</span></span>
            <span className="text-slate-200">|</span>
            <span className="text-amber-600 font-semibold">
              Đã xử lý {Math.max(1, Math.ceil((new Date().getTime() - new Date(claim.receivedDate).getTime()) / (1000 * 60 * 60 * 24)))} ngày
            </span>
          </div>
        </div>
        <div className="p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-[#e5e5ea] shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
          <div className="mb-2.5">
            <h4 className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wider">Khách hàng</h4>
          </div>
          <p className="text-[15.5px] font-bold text-[#1d1d1f]">{claim.customerName}</p>
          <p className="text-[14px] text-[#515154] font-semibold mt-1">SĐT: {claim.customerPhone}</p>
          <div className="flex items-center gap-3 text-[13.5px] text-[#8e8e93] mt-3 pt-2.5 border-t border-[#f5f5f7]">
            <span>Tiếp nhận: <span className="font-semibold text-[#1d1d1f]">{new Date(claim.receivedDate).toLocaleDateString("vi-VN")}</span></span>
            <span className="text-slate-200">|</span>
            <span>Hạn BH: <span className="font-semibold text-[#1d1d1f]">{new Date(claim.warrantyEndDate).toLocaleDateString("vi-VN")}</span></span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100/60 text-[#b91c1c] text-[14.5px]">
        <h4 className="text-[12px] font-bold uppercase tracking-wider mb-1.5 opacity-90">Lỗi khách báo</h4>
        <p className="font-medium">{claim.issueDescription}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
        {/* Form cập nhật */}
        <div className="space-y-4">
          <h3 className="text-[16.5px] font-semibold text-[#1d1d1f] border-b border-[#e5e5ea] pb-2">Cập nhật xử lý</h3>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">Trạng thái mới</label>
              <CustomSelect
                options={statusOptions}
                value={newStatus}
                onChange={(val) => {
                  setNewStatus(val);
                  setSelectedReplacementId(""); // Reset replacement machine on status change
                }}
                dropdownWidth="full"
              />
            </div>
            
            {newStatus === 'replaced' && (
              <div className="space-y-1.5 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 animate-fade-in">
                <label className="text-[12px] font-semibold text-amber-800 uppercase pl-1 block tracking-wider">Chọn máy thay thế mới (Sẵn kho)</label>
                {isLoadingReplacements ? (
                  <div className="text-[13px] text-amber-600 pl-1">Đang tải máy sẵn kho...</div>
                ) : replacements && replacements.length > 0 ? (
                  <CustomSelect
                    options={replacements.map(r => ({
                      value: r.id,
                      label: `SN: ${r.serialNumber} (${r.condition === 'new' ? 'Mới' : 'Đã dùng'} - Giá vốn: ${Number(r.sellingPrice || 0).toLocaleString("vi-VN")}đ)`,
                    }))}
                    value={selectedReplacementId}
                    onChange={setSelectedReplacementId}
                    placeholder="Chọn số Serial máy mới..."
                    dropdownWidth="full"
                    searchable={true}
                  />
                ) : (
                  <div className="text-[13px] font-semibold text-red-600 pl-1">
                    Không có máy nào cùng dòng sản phẩm sẵn kho! Vui lòng nhập thêm hàng trước.
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">Chẩn đoán kỹ thuật (Nội bộ)</label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Nguyên nhân lỗi..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[14px] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#7a7a7a]/60 resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">Giải pháp / Đã xử lý</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Thay thế linh kiện gì..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[14px] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#7a7a7a]/60 resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">Chi phí sửa chữa (Khách trả nếu ngoài BH)</label>
              <div className="relative">
                <input
                  type="text"
                  value={formatVNDInput(repairCost)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, "");
                    setRepairCost(rawValue);
                  }}
                  placeholder="0"
                  className="w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[14px] font-semibold focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#7a7a7a]/60"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[#7a7a7a]">VNĐ</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">Ghi chú log lần này</label>
              <input
                type="text"
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                placeholder="VD: Đã đặt mua linh kiện..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[14px] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#7a7a7a]/60"
              />
            </div>

            <div className="pt-2 flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending || updateMutation.isPending}
                className="px-6 h-[40px] rounded-full bg-transparent border border-[#ff3b30] text-[#ff3b30] text-[14px] font-semibold hover:bg-[#ff3b30] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all duration-200 cursor-pointer shadow-sm active:scale-95 shrink-0"
              >
                Xóa phiếu
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending || deleteMutation.isPending}
                className="flex-1 h-[40px] rounded-full bg-[#0071e3] text-white text-[14px] font-semibold hover:bg-[#0062c4] disabled:opacity-50 transition-all duration-200 cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
              >
                {updateMutation.isPending && <Loader2 className="animate-spin" size={14} />}
                <span>{updateMutation.isPending ? "Đang lưu..." : "Cập Nhật Phiếu"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Lịch sử Logs */}
        <div className="space-y-4">
          <h3 className="text-[16.5px] font-semibold text-[#1d1d1f] border-b border-[#e5e5ea] pb-2">Lịch sử xử lý</h3>
          <div className="space-y-4 max-h-[440px] overflow-y-auto pr-2 pl-1 py-1">
            {logs?.length === 0 ? (
              <p className="text-[14px] text-[#7a7a7a] pl-1">Chưa có lịch sử</p>
            ) : (
              logs?.map((log) => (
                <div key={log.id} className="relative pl-4 border-l border-[#e5e5ea] pb-4 last:pb-0">
                  {/* Simple small dot bullet */}
                  <div className={`absolute w-2 h-2 rounded-full -left-[4.5px] top-1.5 ${
                    log.newStatus === 'completed' || log.newStatus === 'replaced'
                      ? "bg-[#34c759]"
                      : log.newStatus === 'rejected'
                        ? "bg-[#ff3b30]"
                        : "bg-[#0071e3]"
                  }`} />
                  <div className="pl-1.5">
                    <p className="text-[11.5px] text-[#8e8e93] font-bold uppercase tracking-wider">
                      {new Date(log.createdAt).toLocaleString("vi-VN", {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })} - {log.createdByName}
                    </p>
                    <p className="text-[14px] text-[#1d1d1f] font-medium mt-1 whitespace-pre-wrap">{translateLogDescription(log.description)}</p>
                    
                    {log.oldStatus && log.newStatus && log.oldStatus !== log.newStatus ? (
                      <span className="block text-[12.5px] text-[#7a7a7a] mt-2 font-medium">
                        Chuyển trạng thái: <span className="font-semibold text-[#1d1d1f]">{statusLabels[log.oldStatus] || log.oldStatus}</span> ➔ <span className="font-semibold text-[#0071e3]">{statusLabels[log.newStatus] || log.newStatus}</span>
                      </span>
                    ) : log.newStatus && !log.oldStatus && log.action === "created" ? (
                      <span className="block text-[12.5px] text-[#7a7a7a] mt-2 font-medium">
                        Trạng thái ban đầu: <span className="font-semibold text-[#0071e3]">{statusLabels[log.newStatus] || log.newStatus}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
