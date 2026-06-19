"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { getCountriesList, createCountry, updateCountry, deleteCountry } from "@/app/actions/shipping-countries";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CountryManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function CountryManagerDialog({ isOpen, onClose, onUpdate }: CountryManagerDialogProps) {
  const [countriesList, setCountriesList] = useState<{ id: string; code: string; name: string; isActive: boolean }[]>([]);
  const [newCountryCode, setNewCountryCode] = useState("");
  const [newCountryName, setNewCountryName] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Inline editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState("");
  const [editingName, setEditingName] = useState("");

  // Deletion confirm state
  const [itemToDelete, setItemToDelete] = useState<{ id: string; code: string; name: string } | null>(null);

  const loadCountries = async () => {
    try {
      const data = await getCountriesList();
      setCountriesList(data);
    } catch (error) {
      toast.error("Lỗi lấy danh sách quốc gia");
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCountries();
    }
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryCode.trim() || !newCountryName.trim()) return;

    setLoading(true);
    try {
      const res = await createCountry({
        code: newCountryCode.trim().toUpperCase(),
        name: newCountryName.trim()
      });
      if (res.success) {
        toast.success(res.message);
        setNewCountryCode("");
        setNewCountryName("");
        await loadCountries();
        onUpdate(); // Update parent dropdown
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể thêm quốc gia mới");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (id: string, currentCode: string, currentName: string) => {
    setEditingId(id);
    setEditingCode(currentCode);
    setEditingName(currentName);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingCode("");
    setEditingName("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingCode.trim() || !editingName.trim()) return;

    setLoading(true);
    try {
      const res = await updateCountry(id, {
        code: editingCode.trim().toUpperCase(),
        name: editingName.trim()
      });
      if (res.success) {
        toast.success(res.message);
        setEditingId(null);
        await loadCountries();
        onUpdate(); // Update parent dropdown
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể cập nhật quốc gia");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, code: string, name: string) => {
    setItemToDelete({ id, code, name });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setLoading(true);
    try {
      const res = await deleteCountry(itemToDelete.id);
      if (res.success) {
        toast.success(res.message);
        setItemToDelete(null);
        await loadCountries();
        onUpdate(); // Update parent dropdown
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể xóa quốc gia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Quản lý Quốc gia"
      size="lg"
    >
      <div className="space-y-4">
        {/* Form thêm mới */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newCountryCode}
            onChange={(e) => setNewCountryCode(e.target.value)}
            placeholder="VD: US"
            maxLength={10}
            className="w-1/4 h-[44px] px-3.5 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all uppercase"
            disabled={loading}
            required
          />
          <input
            type="text"
            value={newCountryName}
            onChange={(e) => setNewCountryName(e.target.value)}
            placeholder="Tên quốc gia VD: Mỹ"
            className="flex-1 h-[44px] px-3.5 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            disabled={loading}
            required
          />
          <button
            type="submit"
            disabled={loading || !newCountryCode.trim() || !newCountryName.trim()}
            className="h-[44px] px-5 rounded-full bg-[#0066cc] text-white text-[14px] font-semibold hover:bg-[#0071e3] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95 duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.12)]"
          >
            <Plus size={16} />
            Thêm
          </button>
        </form>

        {/* Danh sách quốc gia */}
        <div className="border-t border-[#e0e0e0] pt-4">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] mb-2.5">Danh sách hiện tại ({countriesList.length})</h3>
          
          {countriesList.length === 0 ? (
            <p className="text-[14px] text-[#7a7a7a] text-center py-6">Chưa có quốc gia nào.</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {countriesList.map((country) => {
                const isEditing = editingId === country.id;

                return (
                  <div
                    key={country.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#f5f5f7] border border-transparent hover:border-[#e0e0e0] transition-all"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex gap-2 items-center">
                        <input
                          type="text"
                          value={editingCode}
                          onChange={(e) => setEditingCode(e.target.value)}
                          maxLength={10}
                          className="w-1/4 h-[36px] px-3 rounded-md bg-white border border-[#0066cc] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 uppercase"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 h-[36px] px-3 rounded-md bg-white border border-[#0066cc] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(country.id)}
                          className="w-8 h-8 rounded-md bg-[#0066cc] text-white flex items-center justify-center hover:bg-[#0071e3] transition-colors shrink-0"
                          title="Lưu"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="w-8 h-8 rounded-md bg-[#e0e0e0] text-[#7a7a7a] flex items-center justify-center hover:bg-[#d0d0d0] hover:text-[#1d1d1f] transition-colors shrink-0"
                          title="Hủy"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 flex items-center justify-between min-w-0 pr-4 gap-2">
                          <span className="text-[15px] text-[#1d1d1f] font-normal truncate">
                            {country.name}
                          </span>
                          <span className="font-mono text-[12px] font-bold text-[#0066cc] bg-[#0066cc]/10 px-2 py-0.5 rounded border border-[#0066cc]/20 shrink-0">
                            {country.code}
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(country.id, country.code, country.name)}
                            className="w-8 h-8 rounded-full bg-white hover:bg-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] flex items-center justify-center transition-all cursor-pointer"
                            title="Sửa"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(country.id, country.code, country.name)}
                            className="w-8 h-8 rounded-full bg-white hover:bg-[#b91c1c]/10 text-[#7a7a7a] hover:text-[#b91c1c] flex items-center justify-center transition-all cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xóa quốc gia"
        description={`Bạn có chắc chắn muốn xóa quốc gia "${itemToDelete?.name}" (${itemToDelete?.code})? Thao tác này không thể hoàn tác và sẽ thất bại nếu quốc gia đang được dùng trong kho hàng hoặc đơn nhập hàng.`}
        confirmText="Xóa quốc gia"
        cancelText="Hủy"
        variant="danger"
        isLoading={loading}
      />
    </Dialog>
  );
}
