"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  getAccessoryCatalog, 
  createAccessoryCatalogItem, 
  updateAccessoryCatalogItem, 
  toggleAccessoryCatalogItem, 
  deleteAccessoryCatalogItem 
} from "@/app/actions/inventory";
import { toast } from "sonner";
import { SFSymbolPlus, SFSymbolSquareAndPencil, SFSymbolTrash, SFSymbolArrowClockwise, SFSymbolShippingBox } from "@/components/ui/apple-icons";
import { Dialog } from "@/components/ui/dialog";

const formatNumberWithCommas = (val: string) => {
  const clean = val.replace(/\D/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("en-US");
};

const parseCommaNumber = (val: string) => {
  return val.replace(/,/g, "");
};

interface AccessoryCatalogDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccessoryCatalogDialog({ isOpen, onClose }: AccessoryCatalogDialogProps) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form input states
  const [name, setName] = useState("");
  const [defaultCost, setDefaultCost] = useState("");
  const [defaultSellingPrice, setDefaultSellingPrice] = useState("");
  const [description, setDescription] = useState("");

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ["accessoryCatalog"],
    queryFn: () => getAccessoryCatalog(),
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: createAccessoryCatalogItem,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        handleCloseForm();
        queryClient.invalidateQueries({ queryKey: ["accessoryCatalog"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
      } else {
        toast.error(res.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAccessoryCatalogItem(id, data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        handleCloseForm();
        queryClient.invalidateQueries({ queryKey: ["accessoryCatalog"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
      } else {
        toast.error(res.message);
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAccessoryCatalogItem,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["accessoryCatalog"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
      } else {
        toast.error(res.message);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccessoryCatalogItem,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["accessoryCatalog"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
      } else {
        toast.error(res.message);
      }
    },
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName("");
    setDefaultCost("");
    setDefaultSellingPrice("");
    setDescription("");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name);
    setDefaultCost(formatNumberWithCommas(Math.round(Number(item.defaultCost)).toString()));
    setDefaultSellingPrice(formatNumberWithCommas(Math.round(Number(item.defaultSellingPrice)).toString()));
    setDescription(item.description || "");
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
    setName("");
    setDefaultCost("");
    setDefaultSellingPrice("");
    setDescription("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Vui lòng nhập tên phụ kiện");

    const payload = {
      name,
      defaultCost: parseCommaNumber(defaultCost) || "0",
      defaultSellingPrice: parseCommaNumber(defaultSellingPrice) || "0",
      description,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const catalog = catalogData?.catalog || [];

  return (
    <>
      <Dialog 
        isOpen={isOpen} 
        onClose={onClose}
        title="Danh mục loại phụ kiện"
        description="Quản lý danh mục các loại phụ kiện dùng chung và đơn giá mặc định trong hệ thống"
        size="xl"
      >
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex justify-between items-center pb-2 border-b border-[#e0e0e0]">
            <span className="text-[13px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
              Tổng số danh mục: {catalog.length}
            </span>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="h-[38px] px-4 rounded-full bg-[#0066cc] text-white text-[13px] font-semibold hover:bg-[#0071e3] transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <SFSymbolPlus size={13} />
              Thêm loại phụ kiện mới
            </button>
          </div>

          {/* List of items */}
          {isLoading ? (
            <div className="p-16 text-center flex flex-col items-center justify-center text-[#7a7a7a]">
              <SFSymbolArrowClockwise className="animate-spin mb-3 text-[#0066cc]" size={20} />
              <p className="text-[14px]">Đang tải danh sách...</p>
            </div>
          ) : catalog.length === 0 ? (
            <div className="p-16 text-center text-[#7a7a7a]">
              <SFSymbolShippingBox size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="text-[15px]">Chưa có loại phụ kiện nào.</p>
            </div>
          ) : (
            <div className="max-h-[390px] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {catalog.map((item: any, index: number) => (
                <div 
                  key={item.id}
                  className={`flex items-center justify-between p-4 border rounded-2xl transition-all duration-200 ${
                    item.isActive 
                      ? "bg-white border-[#e0e0e0] hover:border-[#ccc]" 
                      : "bg-[#f5f5f7] border-slate-200/60 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200/50 flex items-center justify-center text-[13px] font-bold text-[#0066cc] shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-bold text-[#1d1d1f] leading-tight truncate">{item.name}</h4>
                      <p className="text-[12.5px] text-[#7a7a7a] mt-1 font-normal leading-none">
                        Giá vốn gốc: {Number(item.defaultCost) > 0 ? `${Number(item.defaultCost).toLocaleString("vi-VN")}đ` : "0đ"}
                        {" • "}
                        Giá bán gốc: {Number(item.defaultSellingPrice) > 0 ? `${Number(item.defaultSellingPrice).toLocaleString("vi-VN")}đ` : "0đ"}
                      </p>
                      {item.description && (
                        <p className="text-[12px] text-slate-500 mt-1.5 italic truncate max-w-[320px]">{item.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="w-8.5 h-8.5 rounded-full bg-white border border-[#e0e0e0] hover:border-[#0066cc] flex items-center justify-center text-[#7a7a7a] hover:text-[#0066cc] transition cursor-pointer shadow-sm"
                      title="Sửa"
                    >
                      <SFSymbolSquareAndPencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Bạn có chắc chắn muốn xóa danh mục "${item.name}"?`)) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                      className="w-8.5 h-8.5 rounded-full bg-white border border-[#e0e0e0] hover:border-red-500 flex items-center justify-center text-[#7a7a7a] hover:text-red-500 transition cursor-pointer shadow-sm"
                      title="Xóa"
                    >
                      <SFSymbolTrash size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate(item.id)}
                      className={`px-3 py-1 text-[12px] font-semibold rounded-full transition active:scale-95 cursor-pointer ${
                        item.isActive 
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100" 
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                      }`}
                    >
                      {item.isActive ? "Hoạt động" : "Ngưng"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>

      {/* Nested Create/Edit Form Dialog */}
      <Dialog
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingItem ? "Sửa loại phụ kiện" : "Thêm loại phụ kiện mới"}
        description="Thông tin chi tiết của danh mục phụ kiện"
        size="md"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Tên phụ kiện *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Sạc nhanh Apple 20W"
              className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Giá vốn mặc định (Không bắt buộc)</label>
            <input
              type="text"
              value={defaultCost}
              onChange={(e) => setDefaultCost(formatNumberWithCommas(e.target.value))}
              placeholder="VD: 350,000"
              className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Giá bán lẻ mặc định (Không bắt buộc)</label>
            <input
              type="text"
              value={defaultSellingPrice}
              onChange={(e) => setDefaultSellingPrice(formatNumberWithCommas(e.target.value))}
              placeholder="VD: 490,000"
              className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Thông tin chi tiết"
              className="w-full h-20 p-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 h-[40px] px-5 rounded-full bg-[#0066cc] text-white font-semibold text-[13px] hover:bg-[#0071e3] transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              {createMutation.isPending || updateMutation.isPending 
                ? "Đang lưu..." 
                : editingItem ? "Cập nhật" : "Thêm mới"}
            </button>
            <button
              type="button"
              onClick={handleCloseForm}
              className="flex-1 h-[40px] px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] font-semibold text-[13px] transition cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
