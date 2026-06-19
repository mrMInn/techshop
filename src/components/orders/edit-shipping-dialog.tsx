"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { updateOrderShippingAction } from "@/app/actions/orders";
import { Truck, Video, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface EditShippingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    orderNumber: string;
    trackingNumber?: string | null;
    shippingCarrier?: string | null;
    packingVideoUrl?: string | null;
    notes?: string | null;
  } | null;
}

export function EditShippingDialog({ isOpen, onClose, order }: EditShippingDialogProps) {
  const queryClient = useQueryClient();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [packingVideoUrl, setPackingVideoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (order) {
      setTrackingNumber(order.trackingNumber || "");
      setShippingCarrier(order.shippingCarrier || "");
      setPackingVideoUrl(order.packingVideoUrl || "");
      setNotes(order.notes || "");
    }
  }, [order, isOpen]);

  if (!order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await updateOrderShippingAction({
        orderId: order.id,
        trackingNumber: trackingNumber || undefined,
        shippingCarrier: shippingCarrier || undefined,
        packingVideoUrl: packingVideoUrl || undefined,
        notes: notes || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi cập nhật thông tin vận chuyển");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Cập nhật Vận chuyển & Ghi chú"
      description={`Mã đơn hàng: ${order.orderNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Đơn vị vận chuyển */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 flex items-center gap-1.5">
            <Truck size={13} className="text-[#0066cc]" /> Đơn vị vận chuyển (Carrier)
          </label>
          <input
            type="text"
            placeholder="VD: Giao Hàng Tiết Kiệm, Shopee Express, Viettel Post..."
            value={shippingCarrier}
            onChange={(e) => setShippingCarrier(e.target.value)}
            className="w-full h-[44px] px-4 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50"
          />
        </div>

        {/* Mã vận đơn */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 flex items-center gap-1.5">
            <Truck size={13} className="text-[#0066cc]" /> Mã vận đơn (Tracking Code)
          </label>
          <input
            type="text"
            placeholder="VD: SPXVN03998238, GHTK-88283-B..."
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            className="w-full h-[44px] px-4 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50"
          />
        </div>

        {/* Link video đóng gói */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 flex items-center gap-1.5">
            <Video size={13} className="text-[#0066cc]" /> Link Video đóng hàng (YouTube/Drive...)
          </label>
          <input
            type="url"
            placeholder="https://drive.google.com/... hoặc https://youtube.com/..."
            value={packingVideoUrl}
            onChange={(e) => setPackingVideoUrl(e.target.value)}
            className="w-full h-[44px] px-4 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50"
          />
        </div>

        {/* Ghi chú đơn hàng */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 flex items-center gap-1.5">
            <FileText size={13} className="text-[#7a7a7a]" /> Ghi chú nội bộ đơn hàng
          </label>
          <textarea
            placeholder="Nhập các ghi chú đặc biệt cho đơn hàng hoặc đóng gói..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50 resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 h-[42px] rounded-full bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#1d1d1f] text-[14px] font-medium transition-all cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 h-[42px] rounded-full bg-[#0066cc] text-white text-[14px] font-semibold hover:bg-[#0071e3] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 duration-150"
          >
            {loading ? <RefreshCw className="animate-spin" size={14} /> : null}
            Cập nhật
          </button>
        </div>
      </form>
    </Dialog>
  );
}
