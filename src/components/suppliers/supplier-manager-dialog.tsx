"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { getSuppliersList, deleteSupplier } from "@/app/actions/suppliers";
import { Trash2, Plus, Users, Phone, Mail, Edit2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
import { getCountriesList } from "@/app/actions/shipping-countries";

interface SupplierManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void; // Refresh inventory form dropdown if opened from there
}

export function SupplierManagerDialog({ isOpen, onClose, onUpdate }: SupplierManagerDialogProps) {
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  
  // Deletion state
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliersList();
      setSuppliersList(data);
    } catch (error) {
      toast.error("Lỗi lấy danh sách đối tác nhà cung cấp");
    }
  };

  const loadCountries = async () => {
    try {
      const data = await getCountriesList();
      setCountries(data);
    } catch (error) {
      console.error("Lỗi lấy danh sách quốc gia", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      loadCountries();
    }
  }, [isOpen]);

  const handleDeleteClick = (id: string, name: string) => {
    setItemToDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    try {
      const res = await deleteSupplier(itemToDelete.id);
      if (res.success) {
        toast.success(res.message);
        setItemToDelete(null);
        await loadSuppliers();
        onUpdate(); // Refresh inventory dropdown
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể xóa nhà cung cấp");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    loadSuppliers();
    onUpdate(); // Refresh parent dropdown
  };

  const getCountryName = (code: string | null) => {
    if (!code) return "Việt Nam";
    const found = countries.find((c) => c.code === code);
    return found ? found.name : code;
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Quản lý Nhà cung cấp"
        
        size="xl"
      >
        <div className="space-y-4">
          {/* Nút thêm mới */}
          <div className="flex justify-between items-center pb-2 border-b border-[#e0e0e0]">
            <span className="text-[13px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
              Tổng số đối tác: {suppliersList.length}
            </span>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-[38px] px-4 rounded-full bg-[#0066cc] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              Thêm nhà cung cấp
            </button>
          </div>

          {/* Danh sách nhà cung cấp */}
          {suppliersList.length === 0 ? (
            <div className="p-16 text-center text-[#7a7a7a]">
              <Users size={36} className="mx-auto mb-3 text-[#7a7a7a]/50" />
              <p className="text-[15px]">Chưa có đối tác nhà cung cấp nào.</p>
            </div>
          ) : (
            <div className="max-h-[390px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {suppliersList.map((sup, index) => {
                return (
                  <div
                    key={sup.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-[#f5f5f7] border border-transparent hover:border-[#e0e0e0] transition-all gap-3"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-white border border-[#e0e0e0] flex items-center justify-center text-[14px] font-bold text-[#0066cc] bg-[#0066cc]/5 shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-bold text-[#1d1d1f] truncate leading-tight">
                            {sup.name}
                          </p>
                          {!sup.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                              Ngừng đối tác
                            </span>
                          )}
                        </div>
                        
                        <p className="text-[12px] text-[#7a7a7a] mt-1 font-normal leading-normal">
                          {sup.contactName && <span>Liên hệ: <strong className="text-[#1d1d1f] font-semibold">{sup.contactName}</strong> • </span>}
                          <span>Quốc gia: <strong className="text-[#1d1d1f] font-semibold">{getCountryName(sup.country)}</strong></span>
                          {sup.taxCode && <span> • MST: <strong className="text-[#1d1d1f] font-semibold font-mono">{sup.taxCode}</strong></span>}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          {sup.phone && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#7a7a7a]">
                              <Phone size={10} />
                              {sup.phone}
                            </span>
                          )}
                          {sup.email && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#7a7a7a]">
                              <Mail size={10} />
                              {sup.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center self-end shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingSupplier(sup)}
                        className="w-8.5 h-8.5 rounded-full bg-white hover:bg-[#0066cc]/10 text-[#7a7a7a] hover:text-[#0066cc] flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Sửa thông tin đối tác"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(sup.id, sup.name)}
                        className="w-8.5 h-8.5 rounded-full bg-white hover:bg-red-50 text-[#7a7a7a] hover:text-red-500 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Xóa đối tác"
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

      {/* Warning Deletion Modal */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa nhà cung cấp"
        description={`Bạn có chắc chắn muốn xóa đối tác "${itemToDelete?.name}"? Thao tác này sẽ thất bại nếu đối tác đã có đơn nhập hàng phát sinh trong hệ thống.`}
        confirmText="Xóa đối tác"
        cancelText="Hủy"
        variant="danger"
        isLoading={loading}
      />

      {/* Supplier Spec Creator Dialog */}
      <SupplierDialog
        isOpen={isCreateOpen || !!editingSupplier}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingSupplier(null);
        }}
        supplier={editingSupplier}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}
