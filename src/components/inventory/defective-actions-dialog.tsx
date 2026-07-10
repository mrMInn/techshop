"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  sendToRepairAction, 
  completeRepairAction, 
  supplierRefundAction, 
  supplierReplaceAction,
  reportItemDefectiveAction
} from "@/app/actions/inventory";

interface DefectiveActionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  actionType: "report" | "repair" | "complete" | "refund" | "writeoff" | null;
}

// Format VND: "15000000" -> "15.000.000"
function formatVND(value: string | number): string {
  if (value === null || value === undefined || value === "") return "";
  const num = String(value).replace(/\D/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("vi-VN");
}

// Parse VND: "15.000.000" -> "15000000"
function parseVND(value: string): string {
  return value.replace(/\D/g, "");
}

export function DefectiveActionsDialog({ isOpen, onClose, item, actionType }: DefectiveActionsDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Form states
  const [notes, setNotes] = useState("");
  const [repairType, setRepairType] = useState<"internal" | "supplier">("internal");
  const [repairCost, setRepairCost] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "card">("cash");
  const [newSerial, setNewSerial] = useState("");
  const [newCondition, setNewCondition] = useState<"new" | "used">("new");

  // Reset form when modal opens/changes
  useEffect(() => {
    if (isOpen) {
      setNotes("");
      setRepairType("internal");
      setRepairCost("");
      setPaymentMethod("cash");
      setNewSerial("");
      setNewCondition("new");
      
      if (actionType === "refund" && item?.costPrice) {
        const priceVal = Math.round(Number(item.costPrice));
        setRefundAmount(formatVND(priceVal));
      } else {
        setRefundAmount("");
      }
    }
  }, [isOpen, actionType, item]);

  if (!item || !actionType) return null;

  const getTitle = () => {
    switch (actionType) {
      case "report": return "Báo máy lỗi";
      case "repair": return "Gửi máy đi sửa chữa / bảo hành";
      case "complete": return "Hoàn tất sửa chữa / bảo hành";
      case "refund": return "Nhập máy trả NCC - Nhận hoàn tiền";
      case "writeoff": return "Đổi máy mới từ NCC";
      default: return "Xử lý máy lỗi";
    }
  };

  const getButtonText = () => {
    switch (actionType) {
      case "report": return "Xác nhận báo lỗi";
      case "repair": return "Xác nhận gửi đi";
      case "complete": return "Xác nhận hoàn tất";
      case "refund": return "Xác nhận hoàn tiền";
      case "writeoff": return "Xác nhận đổi máy";
      default: return "Xác nhận";
    }
  };

  const paymentOptions = [
    { value: "cash", label: "Tiền mặt" },
    { value: "bank_transfer", label: "Chuyển khoản ngân hàng" },
    { value: "card", label: "Thẻ ngân hàng" },
  ];

  const repairOptions = [
    { value: "internal", label: "Sửa chữa nội bộ tại cửa hàng" },
    { value: "supplier", label: "Gửi bảo hành của Nhà cung cấp (NCC)" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      const rawCost = parseVND(repairCost);
      const rawRefund = parseVND(refundAmount);

      switch (actionType) {
        case "report":
          result = await reportItemDefectiveAction(item.id, notes);
          break;
        case "repair":
          result = await sendToRepairAction(item.id, repairType, undefined, notes);
          break;
        case "complete":
          result = await completeRepairAction(item.id, rawCost, paymentMethod);
          break;
        case "refund":
          result = await supplierRefundAction(item.id, rawRefund, paymentMethod, notes);
          break;
        case "writeoff":
          if (!newSerial.trim() || newSerial.trim().length < 3) {
            toast.error("Vui lòng nhập số Serial máy mới (tối thiểu 3 ký tự)");
            setLoading(false);
            return;
          }
          result = await supplierReplaceAction(item.id, newSerial.trim(), newCondition, notes || undefined);
          break;
        default:
          throw new Error("Hành động không hợp lệ");
      }

      if (result.success) {
        toast.success(result.message);
        await queryClient.refetchQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Đã xảy ra lỗi khi thực hiện thao tác");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      description={`Thiết bị: ${item.productName} • Serial: ${item.serialNumber}${item.supplierName ? ` • NCC: ${item.supplierName}` : ""}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        
        {/* REPORT ACTION (Báo máy lỗi) */}
        {actionType === "report" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Lý do báo lỗi / Chi tiết lỗi
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập mô tả lỗi (Ví dụ: Hỏng màn hình, lỗi phím...)"
                required
                rows={3}
                className="w-full p-3.5 rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none placeholder:text-[#7a7a7a]/60"
              />
            </div>
          </div>
        )}

        {/* REPAIR ACTION (Gửi sửa chữa) */}
        {actionType === "repair" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Hình thức sửa chữa
              </label>
              <CustomSelect
                options={repairOptions}
                value={repairType}
                onChange={(val) => setRepairType(val as any)}
                dropdownWidth="full"
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Ghi chú bảo hành / Nơi sửa chữa
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú thêm thông tin liên hệ, nơi nhận sửa hoặc ghi chú gửi bảo hành..."
                rows={3}
                className="w-full p-3.5 rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none placeholder:text-[#7a7a7a]/60"
              />
            </div>
          </div>
        )}

        {/* COMPLETE ACTION (Đã sửa xong) */}
        {actionType === "complete" && (
          <div className="space-y-4">
            <div className="bg-[#f5f5f7] p-4 rounded-xl border border-[#e0e0e0]/50 text-[13px] text-[#7a7a7a] leading-relaxed">
              💡 Máy sau khi xác nhận sửa xong sẽ được chuyển lại về trạng thái <span className="font-semibold text-[#1d1d1f]">Sẵn hàng (in_stock)</span>. Nếu phát sinh chi phí sửa chữa, hệ thống sẽ tự động hạch toán một khoản **Chi Quỹ** tương ứng vào Sổ quỹ để đảm bảo chính xác dòng tiền.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 whitespace-nowrap">
                  Chi phí sửa chữa (VND)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={repairCost}
                    onChange={(e) => setRepairCost(formatVND(e.target.value))}
                    placeholder="Mặc định: 0 đ"
                    className="w-full pl-3.5 pr-8 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#7a7a7a]">đ</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 whitespace-nowrap">
                  Phương thức thanh toán
                </label>
                <CustomSelect
                  options={paymentOptions}
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val as any)}
                  dropdownWidth="full"
                  disabled={!repairCost || parseVND(repairCost) === "0"}
                  size="sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* REFUND ACTION (Trả hàng hoàn tiền) */}
        {actionType === "refund" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 whitespace-nowrap">
                  Số tiền hoàn lại (VND)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(formatVND(e.target.value))}
                    placeholder="Nhập số tiền nhận lại..."
                    required
                    className="w-full pl-3.5 pr-8 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#7a7a7a]">đ</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 whitespace-nowrap">
                  Phương thức thanh toán
                </label>
                <CustomSelect
                  options={paymentOptions}
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val as any)}
                  dropdownWidth="full"
                  size="sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Lý do hoàn trả / Ghi chú
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập lý do xuất trả NCC, thông tin hoàn tiền..."
                rows={2}
                className="w-full p-3.5 rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none placeholder:text-[#7a7a7a]/60"
              />
            </div>
          </div>
        )}

        {/* WRITEOFF ACTION (Đổi máy mới) */}
        {actionType === "writeoff" && (
          <div className="space-y-4">
            <div className="bg-[#f0f7ff] p-4 rounded-xl border border-[#0066cc]/15 text-[13px] text-[#1d1d1f] leading-relaxed">
              🔄 Hệ thống sẽ tự động <span className="font-semibold">xuất trả máy cũ</span> cho NCC và <span className="font-semibold">nhập kho máy mới</span> thay thế trong cùng 1 thao tác.
              <br />
              <span className="text-[#86868b]">Máy mới kế thừa đơn nhập hàng gốc → không phát sinh thêm chi phí.</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 whitespace-nowrap">
                  Serial máy mới <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  placeholder="Nhập số Serial máy thay thế..."
                  required
                  autoFocus
                  className="w-full px-3.5 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60 font-mono tracking-wider"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 whitespace-nowrap">
                  Tình trạng máy mới
                </label>
                <CustomSelect
                  options={[
                    { value: "new", label: "Máy mới (New)" },
                    { value: "used", label: "Máy đã qua sử dụng (Used)" },
                  ]}
                  value={newCondition}
                  onChange={(val) => setNewCondition(val as any)}
                  dropdownWidth="full"
                  size="sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Ghi chú (tùy chọn)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Lý do đổi máy, ghi chú thêm..."
                rows={2}
                className="w-full p-3.5 rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none placeholder:text-[#7a7a7a]/60"
              />
            </div>

            {/* Thông tin máy cũ */}
            <div className="bg-[#f5f5f7] p-3.5 rounded-xl border border-[#e0e0e0]/50">
              <p className="text-[11.5px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Máy cũ sẽ trả NCC</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                <p className="text-[#86868b]">Serial: <span className="text-[#1d1d1f] font-medium font-mono">{item.serialNumber}</span></p>
                <p className="text-[#86868b]">Giá vốn: <span className="text-[#1d1d1f] font-medium">{item.costPrice ? Math.round(Number(item.costPrice)).toLocaleString('vi-VN') + 'đ' : 'N/A'}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Footers / Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e0e0e0]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 h-[38px] bg-white hover:bg-[#f5f5f7] border border-[#e0e0e0] text-[#1d1d1f] text-[13px] font-medium rounded-full transition-all cursor-pointer shadow-sm active:scale-95 duration-200"
          >
            Đóng
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="px-5 h-[38px] bg-[#0066cc] text-white text-[13px] font-medium rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : getButtonText()}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
