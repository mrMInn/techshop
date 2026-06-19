"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { getProductsList, deleteProduct } from "@/app/actions/products";
import { Trash2, Plus, Laptop, Package, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductDialog } from "@/components/products/product-dialog";

interface ProductManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function ProductManagerDialog({ isOpen, onClose, onUpdate }: ProductManagerDialogProps) {
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  
  // Deletion state
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadProducts = async () => {
    try {
      const data = await getProductsList();
      setProductsList(data);
    } catch (error) {
      toast.error("Lỗi lấy danh sách model sản phẩm");
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  const handleDeleteClick = (id: string, name: string) => {
    setItemToDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    try {
      const res = await deleteProduct(itemToDelete.id);
      if (res.success) {
        toast.success(res.message);
        setItemToDelete(null);
        await loadProducts();
        onUpdate(); // Refresh inventory form dropdown
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Không thể xóa model sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    loadProducts();
    onUpdate(); // Refresh parent dropdown
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Quản lý Sản phẩm"
        
        size="xl"
      >
        <div className="space-y-4">
          {/* Nút thêm mới */}
          <div className="flex justify-between items-center pb-2 border-b border-[#e0e0e0]">
            <span className="text-[13px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
              Tổng số model: {productsList.length}
            </span>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="h-[38px] px-4 rounded-full bg-[#0066cc] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              Thêm mã sản phẩm mới
            </button>
          </div>

          {/* Danh sách model */}
          {productsList.length === 0 ? (
            <div className="p-16 text-center text-[#7a7a7a]">
              <Package size={36} className="mx-auto mb-3 text-[#7a7a7a]/50" />
              <p className="text-[15px]">Chưa có model sản phẩm nào.</p>
            </div>
          ) : (
            <div className="max-h-[390px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {productsList.map((prod, index) => {
                const specs = prod.specs as { cpu?: string; ram?: string; ssd?: string; screen?: string } | null;
                const specsText = [specs?.cpu, specs?.ram, specs?.ssd, specs?.screen].filter(Boolean).join(" • ");

                return (
                  <div
                    key={prod.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-[#f5f5f7] border border-transparent hover:border-[#e0e0e0] transition-all gap-3"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-white border border-[#e0e0e0] flex items-center justify-center text-[14px] font-bold text-[#0066cc] shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-[#1d1d1f] truncate leading-tight">
                          {prod.name}
                        </p>
                        <p className="text-[12px] text-[#7a7a7a] mt-1 font-normal leading-normal truncate">
                          SKU: <span className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#e0e0e0]">{prod.sku || "N/A"}</span>
                          {" • "}
                          {prod.brandName}
                          {" • "}
                          {prod.categoryName}
                        </p>
                        {specsText && (
                          <p className="text-[11px] text-[#0066cc] font-semibold mt-1.5">
                            {specsText}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center self-end shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(prod)}
                        className="w-8.5 h-8.5 rounded-full bg-white hover:bg-[#0066cc]/10 text-[#7a7a7a] hover:text-[#0066cc] flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Sửa thông tin sản phẩm"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(prod.id, prod.name)}
                        className="w-8.5 h-8.5 rounded-full bg-white hover:bg-red-50 text-[#7a7a7a] hover:text-red-500 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Xóa sản phẩm"
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
        title="Xác nhận xóa model"
        description={`Bạn có chắc chắn muốn xóa model sản phẩm "${itemToDelete?.name}"? Thao tác này sẽ thất bại nếu đang có máy thuộc model này trong kho.`}
        confirmText="Xóa model"
        cancelText="Hủy"
        variant="danger"
        isLoading={loading}
      />

      {/* Model Spec Creator Dialog (Handles both Create and Edit) */}
      <ProductDialog
        isOpen={isCreateOpen || !!editingProduct}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}
