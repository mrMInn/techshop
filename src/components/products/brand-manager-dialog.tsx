"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { getBrands, createBrand, updateBrand, deleteBrand } from "@/app/actions/products";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface BrandManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function BrandManagerDialog({ isOpen, onClose, onUpdate }: BrandManagerDialogProps) {
  const [brandsList, setBrandsList] = useState<{ id: string; name: string }[]>([]);
  const [newBrandName, setNewBrandName] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Inline editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Deletion confirm state
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadBrands = async () => {
    try {
      const data = await getBrands();
      setBrandsList(data);
    } catch (error) {
      toast.error("Lỗi lấy danh sách thương hiệu");
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBrands();
    }
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;

    setLoading(true);
    try {
      const res = await createBrand(newBrandName.trim());
      if (res.success) {
        toast.success(res.message);
        setNewBrandName("");
        await loadBrands();
        onUpdate(); // Update parent dropdown
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể thêm thương hiệu mới");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;

    setLoading(true);
    try {
      const res = await updateBrand(id, editingName.trim());
      if (res.success) {
        toast.success(res.message);
        setEditingId(null);
        await loadBrands();
        onUpdate(); // Update parent dropdown
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể cập nhật thương hiệu");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setItemToDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setLoading(true);
    try {
      const res = await deleteBrand(itemToDelete.id);
      if (res.success) {
        toast.success(res.message);
        setItemToDelete(null);
        await loadBrands();
        onUpdate(); // Update parent dropdown
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể xóa thương hiệu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Quản lý Thương hiệu"
      
      size="md"
    >
      <div className="space-y-4">
        {/* Form thêm mới */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newBrandName}
            onChange={(e) => setNewBrandName(e.target.value)}
            placeholder="Tên thương hiệu mới"
            className="flex-1 h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[16px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newBrandName.trim()}
            className="h-[44px] px-6 rounded-full bg-[#0066cc] text-white text-[14px] font-semibold hover:bg-[#0071e3] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95 duration-150 shadow-[0_2px_8px_rgba(0,102,204,0.12)]"
          >
            <Plus size={16} />
            Thêm
          </button>
        </form>

        {/* Danh sách thương hiệu */}
        <div className="border-t border-[#e0e0e0] pt-4">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] mb-2.5">Danh sách hiện tại ({brandsList.length})</h3>
          
          {brandsList.length === 0 ? (
            <p className="text-[14px] text-[#7a7a7a] text-center py-6">Chưa có thương hiệu nào.</p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {brandsList.map((brand) => {
                const isEditing = editingId === brand.id;

                return (
                  <div
                    key={brand.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#f5f5f7] border border-transparent hover:border-[#e0e0e0] transition-all"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex gap-2 items-center">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 h-[36px] px-3 rounded-md bg-white border border-[#0066cc] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(brand.id)}
                          className="w-8 h-8 rounded-md bg-[#0066cc] text-white flex items-center justify-center hover:bg-[#0071e3] transition-colors"
                          title="Lưu"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="w-8 h-8 rounded-md bg-[#e0e0e0] text-[#7a7a7a] flex items-center justify-center hover:bg-[#d0d0d0] hover:text-[#1d1d1f] transition-colors"
                          title="Hủy"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-[15px] text-[#1d1d1f] font-normal truncate pr-4">
                          {brand.name}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(brand.id, brand.name)}
                            className="w-8 h-8 rounded-full bg-white hover:bg-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] flex items-center justify-center transition-all cursor-pointer"
                            title="Sửa tên"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(brand.id, brand.name)}
                            className="w-8 h-8 rounded-full bg-white hover:bg-[#b91c1c]/10 text-[#7a7a7a] hover:text-[#b91c1c] flex items-center justify-center transition-all cursor-pointer"
                            title="Xóa thương hiệu"
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
        title="Xác nhận xóa thương hiệu"
        description={`Bạn có chắc chắn muốn xóa thương hiệu "${itemToDelete?.name}"? Thao tác này không thể hoàn tác và sẽ thất bại nếu thương hiệu đang được liên kết với sản phẩm.`}
        confirmText="Xóa thương hiệu"
        cancelText="Hủy"
        variant="danger"
        isLoading={loading}
      />
    </Dialog>
  );
}
