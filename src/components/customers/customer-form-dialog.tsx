"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Loader2, Save, UserPlus } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";

interface LeadSource {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface CustomerFormData {
  id?: string;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  taxCode: string | null;
  customerType: "individual" | "business";
  leadSourceId: string | null;
  notes: string | null;
}

interface CustomerFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
  editData?: CustomerFormData | null;
  leadSources: LeadSource[];
}

export function CustomerFormDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  editData,
  leadSources,
}: CustomerFormDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [customerType, setCustomerType] = useState<"individual" | "business">("individual");
  const [leadSourceId, setLeadSourceId] = useState("");
  const [notes, setNotes] = useState("");

  const isEditing = !!editData?.id;

  // Populate form khi edit
  useEffect(() => {
    if (editData) {
      setFullName(editData.fullName || "");
      setPhone(editData.phone || "");
      setEmail(editData.email || "");
      setAddress(editData.address || "");
      setTaxCode(editData.taxCode || "");
      setCustomerType(editData.customerType || "individual");
      setLeadSourceId(editData.leadSourceId || "");
      setNotes(editData.notes || "");
    } else {
      // Reset form
      setFullName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setTaxCode("");
      setCustomerType("individual");
      setLeadSourceId("");
      setNotes("");
    }
  }, [editData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      taxCode: taxCode.trim() || undefined,
      customerType,
      leadSourceId: leadSourceId || undefined,
      notes: notes.trim() || undefined,
    };

    if (isEditing) {
      payload.id = editData!.id;
    }

    onSubmit(payload);
  };

  const inputClass =
    "w-full h-[40px] px-3.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60";
  const labelClass =
    "text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1";

  const typeOptions = [
    { value: "individual", label: "Cá nhân" },
    { value: "business", label: "Doanh nghiệp" },
  ];

  const leadSourceOptions = [
    { value: "", label: "Không chọn" },
    ...leadSources.map((ls) => ({
      value: ls.id,
      label: `${ls.icon || ""} ${ls.name}`.trim(),
    })),
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Chỉnh Sửa Khách Hàng" : "Thêm Khách Hàng Mới"}
      description={
        isEditing
          ? "Cập nhật thông tin khách hàng trong hệ thống."
          : "Đăng ký thông tin khách hàng mới vào hệ thống."
      }
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Row 1: Loại & Nguồn khách hàng */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Loại khách hàng</label>
            <CustomSelect
              options={typeOptions}
              value={customerType}
              onChange={(val) => setCustomerType(val as "individual" | "business")}
              size="sm"
              dropdownWidth="full"
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Nguồn khách hàng</label>
            <CustomSelect
              options={leadSourceOptions}
              value={leadSourceId}
              onChange={setLeadSourceId}
              placeholder="Chọn nguồn..."
              size="sm"
              dropdownWidth="full"
            />
          </div>
        </div>

        {/* Row 2: Họ tên & SĐT */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Số điện thoại (Nếu có)</label>
            <input
              type="text"
              placeholder="0987 xxx xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 3: Email & MST */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Email</label>
            <input
              type="email"
              placeholder="customer@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>
              {customerType === "business" ? "Mã số thuế (MST)" : "Mã số thuế"}
            </label>
            <input
              type="text"
              placeholder="0123456789"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 4: Địa chỉ */}
        <div className="space-y-1">
          <label className={labelClass}>Địa chỉ</label>
          <input
            type="text"
            placeholder="VD: 123 Nguyễn Huệ, Quận 1, TP.HCM"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Row 5: Ghi chú */}
        <div className="space-y-1">
          <label className={labelClass}>Ghi chú</label>
          <textarea
            placeholder="Mô tả thêm thông tin khách hàng, sở thích, yêu cầu đặc biệt..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60 resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-[#e0e0e0]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-5 h-[40px] bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#1d1d1f] text-[14px] font-medium rounded-full border border-[#e0e0e0] transition-all cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-6 h-[40px] bg-[#0066cc] text-white text-[14px] font-medium rounded-full hover:bg-[#0071e3] transition-all cursor-pointer disabled:opacity-50 active:scale-95 duration-200"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isEditing ? (
              <Save size={16} />
            ) : (
              <UserPlus size={16} />
            )}
            <span>{isEditing ? "Lưu thay đổi" : "Thêm khách hàng"}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
