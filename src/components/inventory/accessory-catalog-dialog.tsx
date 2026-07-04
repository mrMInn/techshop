"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccessoryCatalog, createAccessoryCatalogItem, updateAccessoryCatalogItem, toggleAccessoryCatalogItem } from "@/app/actions/inventory";
import { toast } from "sonner";
import { SFSymbolPlus, SFSymbolSquareAndPencil } from "@/components/ui/apple-icons";
import { Dialog } from "@/components/ui/dialog";

interface AccessoryCatalogDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccessoryCatalogDialog({ isOpen, onClose }: AccessoryCatalogDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [defaultCost, setDefaultCost] = useState("");
  const [defaultSellingPrice, setDefaultSellingPrice] = useState("");
  const [description, setDescription] = useState("");
  const [editingItem, setEditingItem] = useState<any>(null);

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
        setName("");
        setDefaultCost("");
        setDefaultSellingPrice("");
        setDescription("");
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
        setEditingItem(null);
        setName("");
        setDefaultCost("");
        setDefaultSellingPrice("");
        setDescription("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Vui lòng nhập tên phụ kiện");

    const payload = {
      name,
      defaultCost: defaultCost || "0",
      defaultSellingPrice: defaultSellingPrice || "0",
      description,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name);
    setDefaultCost(Math.round(Number(item.defaultCost)).toString());
    setDefaultSellingPrice(Math.round(Number(item.defaultSellingPrice)).toString());
    setDescription(item.description || "");
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setName("");
    setDefaultCost("");
    setDefaultSellingPrice("");
    setDescription("");
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose}
      title="Danh mục loại phụ kiện"
      description="Quản lý danh mục các loại phụ kiện dùng chung và đơn giá mặc định trong hệ thống"
      size="4xl"
    >
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full md:w-[320px] shrink-0 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-[#e0e0e0] pb-6 md:pb-0 md:pr-8">
          <h3 className="text-[16px] font-bold text-[#1d1d1f]">
            {editingItem ? "Sửa loại phụ kiện" : "Thêm loại phụ kiện mới"}
          </h3>

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
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Giá vốn mặc định (đ)</label>
            <input
              type="number"
              value={defaultCost}
              onChange={(e) => setDefaultCost(e.target.value)}
              placeholder="VD: 350000"
              className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Giá bán lẻ mặc định (đ)</label>
            <input
              type="number"
              value={defaultSellingPrice}
              onChange={(e) => setDefaultSellingPrice(e.target.value)}
              placeholder="VD: 490000"
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
              className="flex-1 h-[40px] px-5 rounded-full bg-[#0066cc] text-white font-semibold text-[13px] hover:bg-[#0071e3] transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              {editingItem ? "Cập nhật" : "Thêm mới"}
            </button>
            {editingItem && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex-1 h-[40px] px-5 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] font-semibold text-[13px] transition cursor-pointer"
              >
                Hủy
              </button>
            )}
          </div>
        </form>

        {/* List */}
        <div className="flex-1 w-full flex flex-col gap-4">
          <h3 className="text-[16px] font-bold text-[#1d1d1f]">Danh sách hiện có</h3>
          
          {isLoading ? (
            <p className="text-[14px] text-[#7a7a7a] italic">Đang tải danh mục...</p>
          ) : !catalogData?.catalog || catalogData.catalog.length === 0 ? (
            <p className="text-[14px] text-[#7a7a7a] italic">Chưa có loại phụ kiện nào</p>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-2">
              {catalogData.catalog.map((item: any) => (
                <div 
                  key={item.id}
                  className={`p-4 border rounded-[16px] flex items-center justify-between transition-all duration-200 ${
                    item.isActive ? "bg-white border-[#e0e0e0]" : "bg-slate-50/70 border-slate-200 opacity-60"
                  }`}
                >
                  <div>
                    <h4 className="text-[15px] font-bold text-[#1d1d1f]">{item.name}</h4>
                    <p className="text-[12.5px] text-[#7a7a7a] mt-0.5">
                      Giá vốn: {Number(item.defaultCost).toLocaleString("vi-VN")}đ | Giá bán: {Number(item.defaultSellingPrice).toLocaleString("vi-VN")}đ
                    </p>
                    {item.description && (
                      <p className="text-[12px] text-slate-500 mt-1 italic">{item.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="w-8 h-8 flex items-center justify-center text-[#7a7a7a] hover:text-[#0066cc] hover:bg-[#f5f5f7] rounded-full transition cursor-pointer"
                      title="Sửa"
                    >
                      <SFSymbolSquareAndPencil size={15} />
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
      </div>
    </Dialog>
  );
}
