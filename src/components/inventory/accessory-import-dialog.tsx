"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccessoryCatalog, importAccessoryItems } from "@/app/actions/inventory";
import { getSuppliersList } from "@/app/actions/suppliers";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";

interface AccessoryImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccessoryImportDialog({ isOpen, onClose }: AccessoryImportDialogProps) {
  const queryClient = useQueryClient();
  const [catalogId, setCatalogId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [serialNumbersText, setSerialNumbersText] = useState("");
  const [notes, setNotes] = useState("");

  const { data: catalogData } = useQuery({
    queryKey: ["accessoryCatalog"],
    queryFn: () => getAccessoryCatalog(),
    enabled: isOpen,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => getSuppliersList(),
    enabled: isOpen,
  });

  const activeCatalog = catalogData?.catalog?.filter((c: any) => c.isActive) || [];
  const suppliers = suppliersData || [];

  // Auto-set unitCost when catalog selection changes
  useEffect(() => {
    if (catalogId) {
      const selected = activeCatalog.find((c: any) => c.id === catalogId);
      if (selected) {
        setUnitCost(Math.round(Number(selected.defaultCost)).toString());
      }
    }
  }, [catalogId]);

  // Auto-set default supplier "Nhập khẩu quốc tế" or first supplier if none selected
  useEffect(() => {
    if (suppliers.length > 0 && !supplierId) {
      const defaultSupplier = suppliers.find((s: any) => s.name === "Nhập khẩu quốc tế");
      if (defaultSupplier) {
        setSupplierId(defaultSupplier.id);
      } else {
        setSupplierId(suppliers[0].id);
      }
    }
  }, [suppliers]);

  const importMutation = useMutation({
    mutationFn: importAccessoryItems,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        setCatalogId("");
        setQuantity("1");
        setUnitCost("");
        setSerialNumbersText("");
        setNotes("");
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
        queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
        onClose();
      } else {
        toast.error(res.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogId) return toast.error("Vui lòng chọn loại phụ kiện");
    if (!supplierId) return toast.error("Vui lòng chọn nhà cung cấp");
    
    const costNum = Number(unitCost);
    if (isNaN(costNum) || costNum <= 0) return toast.error("Giá vốn không hợp lệ");

    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) return toast.error("Số lượng phải lớn hơn 0");

    // Parse serial numbers
    const serials = serialNumbersText
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    importMutation.mutate({
      catalogId,
      quantity: qtyNum,
      unitCost: unitCost,
      supplierId,
      serialNumbers: serials,
      notes,
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Nhập kho phụ kiện"
      description="Nhập kho lô phụ kiện mới (theo số lượng hoặc theo danh sách mã serial)"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        <div className="space-y-1">
          <label className="block text-[13px] font-semibold text-[#1d1d1f]">Loại phụ kiện *</label>
          <select
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all cursor-pointer"
            required
          >
            <option value="">-- Chọn phụ kiện --</option>
            {activeCatalog.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} (Gốc: {Number(c.defaultCost).toLocaleString("vi-VN")}đ)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Số lượng nhập *</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Đơn giá vốn (đ) *</label>
            <input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="VD: 300000"
              className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[13px] font-semibold text-[#1d1d1f]">Nhà cung cấp *</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all cursor-pointer"
            required
          >
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Danh sách mã Serial (Mỗi dòng 1 mã)</label>
            <span className="text-[11px] text-slate-400 italic">Không bắt buộc</span>
          </div>
          <textarea
            value={serialNumbersText}
            onChange={(e) => setSerialNumbersText(e.target.value)}
            placeholder="VD:&#10;SERIAL12345&#10;SERIAL67890"
            className="w-full h-24 p-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] text-[#1d1d1f] font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[13px] font-semibold text-[#1d1d1f]">Ghi chú nhập hàng</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nhập ghi chú (nếu có)"
            className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={importMutation.isPending}
          className="w-full h-[44px] bg-[#0066cc] hover:bg-[#0071e3] text-white font-semibold text-[14px] rounded-full transition active:scale-95 flex items-center justify-center gap-2 mt-4 shadow-sm cursor-pointer"
        >
          {importMutation.isPending ? "Đang nhập kho..." : "Xác nhận nhập kho"}
        </button>

      </form>
    </Dialog>
  );
}
