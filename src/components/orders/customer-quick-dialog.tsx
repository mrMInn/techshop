"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createCustomerAction } from "@/app/actions/orders";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CustomerQuickDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCustomer: { id: string; fullName: string; phone: string }) => void;
}

export function CustomerQuickDialog({ isOpen, onClose, onSuccess }: CustomerQuickDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Vui lòng nhập Họ tên");
      return;
    }

    setLoading(true);
    try {
      const res = await createCustomerAction({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        notes: notes.trim(),
      });

      if (res.success && res.customer) {
        toast.success(res.message);
        onSuccess({
          id: res.customer.id,
          fullName: res.customer.fullName,
          phone: res.customer.phone || "",
        });
        // Clear fields
        setFullName("");
        setPhone("");
        setEmail("");
        setAddress("");
        setNotes("");
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi thêm khách hàng");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Thêm khách hàng"
      
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Họ tên & SĐT */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Tên hoặc Họ Tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
              Số điện thoại (Nếu có)
            </label>
            <input
              type="text"
              placeholder="0987xxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
            Địa chỉ Email (Nếu có)
          </label>
          <input
            type="email"
            placeholder="customer@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
          />
        </div>

        {/* Địa chỉ */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-[#7aƒ7a7a] uppercase tracking-wider pl-1">
            Địa chỉ thường trú
          </label>
          <input
            type="text"
            placeholder="VD: Võ Văn Kiệt, Phường Chợ Quán"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
          />
        </div>

        {/* Ghi chú */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
            Ghi chú khách hàng
          </label>
          <textarea
            placeholder="Mô tả đặc điểm khách hàng hoặc thông tin thêm..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#e0e0e0] mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-[40px] rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#1d1d1f] text-[14px] font-medium transition-all cursor-pointer active:scale-95 duration-150 flex items-center justify-center"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[40px] rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-[14px] font-semibold transition-all cursor-pointer disabled:opacity-50 active:scale-95 duration-150 flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(0,102,204,0.12)]"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : null}
            <span>{loading ? "Đang xử lý..." : "Thêm khách hàng"}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
