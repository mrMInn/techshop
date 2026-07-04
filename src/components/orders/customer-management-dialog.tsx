"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { 
  getCustomersList, 
  createCustomerFullAction, 
  updateCustomerAction, 
  deleteCustomerAction 
} from "@/app/actions/customers";
import { Trash2, Plus, Edit2, Loader2, Check, Search, User, Briefcase, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxCode: string | null;
  customerType: "individual" | "business";
  notes: string | null;
  leadSourceId: string | null;
}

interface CustomerManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: { id: string; fullName: string; phone: string; leadSourceId?: string | null }) => void;
  onUpdate: () => void;
}

export function CustomerManagementDialog({
  isOpen,
  onClose,
  onSelect,
  onUpdate
}: CustomerManagementDialogProps) {
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog con để thêm/sửa và xác nhận xóa
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomersList();
      setCustomersList(data as any);
    } catch (error) {
      toast.error("Lỗi lấy danh sách khách hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  const handleDeleteClick = (id: string, name: string) => {
    setItemToDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    try {
      const res = await deleteCustomerAction(itemToDelete.id);
      if (res.success) {
        toast.success(res.message);
        setItemToDelete(null);
        await loadCustomers();
        onUpdate();
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể xóa khách hàng");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    loadCustomers();
    onUpdate();
  };

  // Lọc danh sách khách hàng theo search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customersList;
    const query = searchQuery.trim().toLowerCase();
    return customersList.filter(c => 
      c.fullName.toLowerCase().includes(query) || 
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query))
    );
  }, [customersList, searchQuery]);

  function getInitials(name: string) {
    if (!name) return "KH";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Quản lý Khách hàng"
        size="2xl"
      >
        <div className="space-y-4">
          {/* Header với ô tìm kiếm và nút thêm mới */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center pb-3 border-b border-[#e0e0e0]">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={15} />
              <input
                type="text"
                placeholder="Tìm tên, số điện thoại, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-[38px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
              />
            </div>
            
            <button
              type="button"
              onClick={() => {
                setEditingCustomer(null);
                setIsFormOpen(true);
              }}
              className="h-[38px] px-4 rounded-full bg-[#0066cc] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95 duration-150"
            >
              <Plus size={15} />
              Thêm khách hàng
            </button>
          </div>

          {/* Danh sách các khách hàng */}
          {loading && customersList.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#7a7a7a]">
              <Loader2 size={24} className="animate-spin text-[#0066cc] mb-2" />
              <span className="text-[14px]">Đang tải danh sách...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-20 text-center text-[#7a7a7a]">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <User size={20} className="text-slate-400" />
              </div>
              <p className="text-[15px]">Không tìm thấy khách hàng nào.</p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {filteredCustomers.map((customer, index) => {
                const isGuest = customer.fullName === "Khách vãng lai";
                return (
                  <div
                    key={customer.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-[#f5f5f7] border border-transparent hover:border-[#e0e0e0] transition-all gap-3"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Vòng tròn STT */}
                      <div className="w-10 h-10 rounded-full border border-[#e0e0e0] bg-white flex items-center justify-center text-[14px] font-bold text-[#0066cc] shrink-0 shadow-sm">
                        {index + 1}
                      </div>
                      
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[15px] font-bold text-[#1d1d1f] truncate leading-tight">
                            {customer.fullName}
                          </p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                            customer.customerType === "business"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            {customer.customerType === "business" ? "Doanh nghiệp" : "Cá nhân"}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#7a7a7a]">
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} /> {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={12} /> {customer.email}
                            </span>
                          )}
                          {customer.address && (
                            <span className="flex items-center gap-1 max-w-[250px] truncate" title={customer.address}>
                              <MapPin size={12} /> {customer.address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center self-end shrink-0">
                      {/* Nút Chọn */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelect({
                            id: customer.id,
                            fullName: customer.fullName,
                            phone: customer.phone || "",
                            leadSourceId: customer.leadSourceId,
                          });
                          onClose();
                        }}
                        className="h-[32px] px-3.5 rounded-full bg-white hover:bg-[#0066cc] hover:text-white text-[#0066cc] text-[12.5px] font-bold transition-all cursor-pointer shadow-sm border border-[#e0e0e0] flex items-center justify-center active:scale-95 duration-150"
                      >
                        Chọn
                      </button>

                      {/* Nút Sửa */}
                      <button
                        type="button"
                        disabled={isGuest}
                        onClick={() => {
                          setEditingCustomer(customer);
                          setIsFormOpen(true);
                        }}
                        className={`w-8.5 h-8.5 rounded-full bg-white hover:bg-[#0066cc]/10 text-[#7a7a7a] hover:text-[#0066cc] flex items-center justify-center transition-all cursor-pointer shadow-sm border border-[#e0e0e0]/50 active:scale-95 duration-150 ${
                          isGuest ? "opacity-35 cursor-not-allowed pointer-events-none" : ""
                        }`}
                        title={isGuest ? "Không thể sửa khách vãng lai" : "Sửa khách hàng"}
                      >
                        <Edit2 size={13} />
                      </button>

                      {/* Nút Xóa */}
                      <button
                        type="button"
                        disabled={isGuest}
                        onClick={() => handleDeleteClick(customer.id, customer.fullName)}
                        className={`w-8.5 h-8.5 rounded-full bg-white hover:bg-red-50 text-[#7a7a7a] hover:text-red-500 flex items-center justify-center transition-all cursor-pointer shadow-sm border border-[#e0e0e0]/50 active:scale-95 duration-150 ${
                          isGuest ? "opacity-35 cursor-not-allowed pointer-events-none" : ""
                        }`}
                        title={isGuest ? "Không thể xóa khách vãng lai" : "Xóa khách hàng"}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>

      {/* Xác nhận xóa */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa khách hàng"
        description={`Bạn có chắc chắn muốn xóa khách hàng "${itemToDelete?.name}"? Thao tác này chỉ thực hiện được nếu khách hàng chưa từng phát sinh giao dịch/đơn hàng nào.`}
        confirmText="Xóa khách hàng"
        cancelText="Hủy"
        variant="danger"
        isLoading={loading}
      />

      {/* Form chi tiết Thêm/Sửa */}
      <CustomerDetailFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

// ============================================================
// HỘP THOẠI CHI TIẾT THÊM/SỬA KHÁCH HÀNG (CustomerDetailFormDialog)
// ============================================================

interface CustomerDetailFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSuccess: () => void;
}

export function CustomerDetailFormDialog({
  isOpen,
  onClose,
  customer,
  onSuccess
}: CustomerDetailFormDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [customerType, setCustomerType] = useState<"individual" | "business">("individual");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!customer;

  useEffect(() => {
    if (isOpen) {
      if (customer) {
        setFullName(customer.fullName);
        setPhone(customer.phone || "");
        setEmail(customer.email || "");
        setAddress(customer.address || "");
        setTaxCode(customer.taxCode || "");
        setCustomerType(customer.customerType);
        setNotes(customer.notes || "");
      } else {
        setFullName("");
        setPhone("");
        setEmail("");
        setAddress("");
        setTaxCode("");
        setCustomerType("individual");
        setNotes("");
      }
    }
  }, [isOpen, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        taxCode: customerType === "business" ? taxCode.trim() || undefined : undefined,
        customerType,
        notes: notes.trim() || undefined
      };

      if (isEditing) {
        const res = await updateCustomerAction(customer.id, payload);
        if (res.success) {
          toast.success(res.message);
          onSuccess();
          onClose();
        } else {
          toast.error(res.message);
        }
      } else {
        const res = await createCustomerFullAction(payload);
        if (res.success) {
          toast.success(res.message);
          onSuccess();
          onClose();
        } else {
          toast.error(res.message);
        }
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi lưu khách hàng");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Sửa thông tin khách hàng" : "Thêm khách hàng mới"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        
        {/* Là khách doanh nghiệp */}
        <div className="flex items-center gap-2 pl-1 py-1 select-none">
          <label className="flex items-center gap-2.5 text-[14px] font-semibold text-[#1d1d1f] cursor-pointer">
            <input
              type="checkbox"
              checked={customerType === "business"}
              onChange={(e) => setCustomerType(e.target.checked ? "business" : "individual")}
              disabled={submitting}
              className="w-4 h-4 rounded text-[#0066cc] border-[#e0e0e0] focus:ring-[#0066cc]/40 focus:ring-1 cursor-pointer"
            />
            <span>Là khách hàng Doanh nghiệp</span>
          </label>
        </div>

        {/* Tên & SĐT */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
              Họ và tên *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
              className="w-full px-4 h-[44px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
              Số điện thoại
            </label>
            <input
              type="text"
              placeholder="09xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
              className="w-full px-4 h-[44px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>
        </div>

        {/* Email & Mã số thuế */}
        {customerType === "business" ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Địa chỉ Email
              </label>
              <input
                type="email"
                placeholder="customer@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full px-4 h-[44px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Mã số thuế *
              </label>
              <input
                type="text"
                required
                placeholder="Mã số thuế công ty"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
                disabled={submitting}
                className="w-full px-4 h-[44px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
              Địa chỉ Email
            </label>
            <input
              type="email"
              placeholder="customer@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full px-4 h-[44px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>
        )}

        {/* Địa chỉ */}
        <div className="space-y-1.5">
          <label className="block text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
            Địa chỉ thường trú
          </label>
          <input
            type="text"
            placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={submitting}
            className="w-full px-4 h-[44px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
          />
        </div>

        {/* Ghi chú */}
        <div className="space-y-1.5">
          <label className="block text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
            Ghi chú khách hàng
          </label>
          <textarea
            placeholder="Mô tả đặc điểm khách hàng hoặc lưu ý thêm..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60 resize-none"
          />
        </div>

        {/* Nút lưu/hủy */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e0e0e0] mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 h-[44px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[14px] font-semibold text-[#1d1d1f] rounded-full transition-all cursor-pointer active:scale-95 duration-200"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 h-[44px] bg-[#0066cc] hover:bg-[#0071e3] disabled:opacity-50 text-white text-[14px] font-semibold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 duration-200 flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : isEditing ? (
              <Check size={15} />
            ) : (
              <Plus size={15} />
            )}
            <span>{isEditing ? "Lưu thay đổi" : "Tạo khách hàng"}</span>
          </button>
        </div>

      </form>
    </Dialog>
  );
}
