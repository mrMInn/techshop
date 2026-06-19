"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWarrantyClaimDetail, updateWarrantyStatus, getAvailableReplacementItems, deleteWarrantyClaim } from "@/app/actions/warranty";
import { CustomSelect } from "@/components/ui/custom-select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  return (
    <div className="space-y-6">
      {/* Thông tin chung */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-[#f5f5f7] rounded-xl border border-[#e0e0e0]">
          <h4 className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider mb-2">Thông tin máy</h4>
          <p className="text-[14px] font-semibold text-[#1d1d1f]">{claim.productName}</p>
          <p className="text-[13px] text-[#7a7a7a] font-mono mt-1">SN: {claim.serialNumber}</p>
          <p className="text-[13px] mt-1.5 flex items-center">
            Hạn BH: <span className="font-semibold ml-1">{new Date(claim.warrantyEndDate).toLocaleDateString("vi-VN")}</span>
            <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${claim.isUnderWarranty ? 'bg-emerald-600 text-white border border-emerald-700' : 'bg-rose-600 text-white border border-rose-700'}`}>
              {claim.isUnderWarranty ? 'Còn BH' : 'Hết BH'}
            </span>
          </p>
          <p className="text-[13px] mt-1.5">
            Đơn gốc: <span className="font-semibold">{claim.orderNumber}</span>
          </p>
        </div>
        <div className="p-4 bg-[#f5f5f7] rounded-xl border border-[#e0e0e0]">
          <h4 className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider mb-2">Khách hàng</h4>
          <p className="text-[14px] font-semibold text-[#1d1d1f]">{claim.customerName}</p>
          <p className="text-[13px] text-[#7a7a7a] mt-1">{claim.customerPhone}</p>
          <p className="text-[13px] mt-2">
            Tiếp nhận: <span className="font-semibold">{new Date(claim.receivedDate).toLocaleDateString("vi-VN")}</span>
          </p>
        </div>
      </div>

      <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-[#b91c1c]">
        <h4 className="text-[12px] font-bold uppercase tracking-wider mb-1">Lỗi khách báo</h4>
        <p className="text-[14px]">{claim.issueDescription}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form cập nhật */}
        <div className="space-y-4">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] border-b pb-2">Cập nhật xử lý</h3>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase">Trạng thái mới</label>
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
              <div className="space-y-1.5 p-4 rounded-xl bg-amber-50 border border-amber-200 animate-fade-in">
                <label className="text-[11px] font-semibold text-amber-800 uppercase pl-1 block">Chọn máy thay thế mới (Sẵn kho)</label>
                {isLoadingReplacements ? (
                  <div className="text-[12px] text-amber-600 pl-1">Đang tải máy sẵn kho...</div>
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
                  <div className="text-[12px] font-semibold text-red-600 pl-1">
                    Không có máy nào cùng dòng sản phẩm sẵn kho! Vui lòng nhập thêm hàng trước.
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase">Chẩn đoán kỹ thuật (Nội bộ)</label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Nguyên nhân lỗi..."
                className="w-full px-3 py-2 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase">Giải pháp / Đã xử lý</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Thay thế linh kiện gì..."
                className="w-full px-3 py-2 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase">Chi phí sửa chữa (Khách trả nếu ngoài BH)</label>
              <div className="relative">
                <input
                  type="text"
                  value={formatVNDInput(repairCost)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, "");
                    setRepairCost(rawValue);
                  }}
                  placeholder="0"
                  className="w-full pl-3 pr-12 py-2 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#7a7a7a]">VNĐ</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase">Ghi chú log lần này</label>
              <input
                type="text"
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                placeholder="VD: Đã đặt mua linh kiện..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#0066cc] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending || updateMutation.isPending}
                className="px-4 h-[40px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[14px] font-semibold transition-all disabled:opacity-50 cursor-pointer"
              >
                Xóa phiếu
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending || deleteMutation.isPending}
                className="flex-1 h-[40px] bg-[#0066cc] text-white rounded-lg text-[14px] font-semibold hover:bg-[#0071e3] transition-all disabled:opacity-50 cursor-pointer"
              >
                {updateMutation.isPending ? "Đang lưu..." : "Cập Nhật Phiếu"}
              </button>
            </div>
          </form>
        </div>

        {/* Lịch sử Logs */}
        <div className="space-y-4">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] border-b pb-2">Lịch sử xử lý</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 pl-2 py-1">
            {logs?.length === 0 ? (
              <p className="text-[13px] text-[#7a7a7a]">Chưa có lịch sử</p>
            ) : (
              logs?.map((log) => (
                <div key={log.id} className="relative pl-4 border-l-2 border-[#e0e0e0]">
                  <div className="absolute w-2 h-2 rounded-full bg-[#0066cc] -left-[5px] top-1.5"></div>
                  <p className="text-[11px] text-[#7a7a7a] font-semibold">
                    {new Date(log.createdAt).toLocaleString("vi-VN")} - {log.createdByName}
                  </p>
                  <p className="text-[13px] text-[#1d1d1f] mt-0.5 whitespace-pre-wrap">{translateLogDescription(log.description)}</p>
                  
                  {log.oldStatus && log.newStatus && log.oldStatus !== log.newStatus ? (
                    <p className="text-[11px] bg-gray-100 inline-block px-2 py-0.5 rounded mt-1 text-[#7a7a7a] border border-gray-200">
                      {statusLabels[log.oldStatus] || log.oldStatus} ➔ {statusLabels[log.newStatus] || log.newStatus}
                    </p>
                  ) : log.newStatus && !log.oldStatus && log.action === "created" ? (
                    <p className="text-[11px] bg-blue-50 inline-block px-2 py-0.5 rounded mt-1 text-blue-700 border border-blue-100 font-semibold animate-fade-in">
                      Trạng thái ban đầu: {statusLabels[log.newStatus] || log.newStatus}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
