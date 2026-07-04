"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attachAccessoryToMachine } from "@/app/actions/inventory";
import { getInStockItemsForSelect, getInStockAccessoriesForSelect } from "@/app/actions/orders";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";

interface AttachAccessoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accessoryItemId?: string; // If pre-selected
  inventoryItemId?: string; // If pre-selected
}

export function AttachAccessoryDialog({ isOpen, onClose, accessoryItemId, inventoryItemId }: AttachAccessoryDialogProps) {
  const queryClient = useQueryClient();
  const [selectedAccId, setSelectedAccId] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [searchMachine, setSearchMachine] = useState("");

  const { data: machines = [], isLoading: isLoadingMachines } = useQuery({
    queryKey: ["inStockMachinesForSelect"],
    queryFn: () => getInStockItemsForSelect(),
    enabled: isOpen && !inventoryItemId,
  });

  const { data: accessories = [], isLoading: isLoadingAccessories } = useQuery({
    queryKey: ["inStockAccessoriesForSelect"],
    queryFn: () => getInStockAccessoriesForSelect(),
    enabled: isOpen && !accessoryItemId,
  });

  // Reset states when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAccId(accessoryItemId || "");
      setSelectedMachineId(inventoryItemId || "");
      setSellingPrice("0");
      setSearchMachine("");
    }
  }, [isOpen, accessoryItemId, inventoryItemId]);

  const attachMutation = useMutation({
    mutationFn: ({ accId, machineId, price }: { accId: string; machineId: string; price: string }) => 
      attachAccessoryToMachine(accId, machineId, price),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryItems"] });
        onClose();
      } else {
        toast.error(res.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const accId = accessoryItemId || selectedAccId;
    const machineId = inventoryItemId || selectedMachineId;

    if (!accId) return toast.error("Vui lòng chọn phụ kiện");
    if (!machineId) return toast.error("Vui lòng chọn máy lẻ");

    attachMutation.mutate({ accId, machineId, price: sellingPrice });
  };

  const filteredMachines = machines.filter(m => 
    m.serialNumber.toLowerCase().includes(searchMachine.toLowerCase()) ||
    m.productName.toLowerCase().includes(searchMachine.toLowerCase())
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Gắn kèm phụ kiện vào máy"
      description="Liên kết phụ kiện sẵn hàng vào một thiết bị cụ thể để làm quà tặng kèm trọn gói"
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* Select Accessory if not provided */}
        {!accessoryItemId ? (
          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Chọn phụ kiện trống trong kho *</label>
            {isLoadingAccessories ? (
              <p className="text-[13px] italic text-[#7a7a7a]">Đang tải phụ kiện...</p>
            ) : (
              <select
                value={selectedAccId}
                onChange={(e) => setSelectedAccId(e.target.value)}
                className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all cursor-pointer"
                required
              >
                <option value="">-- Chọn phụ kiện --</option>
                {accessories.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.catalogName} {a.serialNumber ? `(S/N: ${a.serialNumber})` : `(Không serial, ID: ${a.id.slice(0,6)})`} - Giá: {Number(a.unitCost).toLocaleString("vi-VN")}đ
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="p-4 bg-[#f5f5f7] border border-[#e0e0e0] rounded-xl">
            <span className="block text-[13px] font-semibold text-[#7a7a7a] mb-1">Phụ kiện được chọn</span>
            <span className="text-[15px] font-bold text-[#1d1d1f]">
              {accessories.find(a => a.id === accessoryItemId)?.catalogName || "Đang xác định..."}
            </span>
          </div>
        )}

        {/* Select Machine if not provided */}
        {!inventoryItemId ? (
          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Tìm và chọn Máy lẻ sẵn hàng *</label>
            
            <input
              type="text"
              placeholder="Tìm theo Serial hoặc tên sản phẩm..."
              value={searchMachine}
              onChange={(e) => setSearchMachine(e.target.value)}
              className="w-full h-[40px] px-4 mb-2 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />

            {isLoadingMachines ? (
              <p className="text-[13px] italic text-[#7a7a7a]">Đang tải máy...</p>
            ) : (
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="w-full rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all cursor-pointer p-2"
                size={5}
                required
              >
                {filteredMachines.map((m: any) => (
                  <option key={m.id} value={m.id} className="p-1 text-[13px]">
                    {m.serialNumber} - {m.productName} ({m.condition})
                  </option>
                ))}
                {filteredMachines.length === 0 && (
                  <option disabled className="p-1 italic text-slate-400">Không tìm thấy máy phù hợp</option>
                )}
              </select>
            )}
          </div>
        ) : (
          <div className="p-4 bg-[#f5f5f7] border border-[#e0e0e0] rounded-xl">
            <span className="block text-[13px] font-semibold text-[#7a7a7a] mb-1">Máy lẻ được gắn kèm</span>
            <span className="text-[15px] font-bold text-[#1d1d1f]">
              {machines.find(m => m.id === inventoryItemId)?.productName || "Đang xác định..."} ({machines.find(m => m.id === inventoryItemId)?.serialNumber})
            </span>
          </div>
        )}

        {/* Optional Gift Selling Price */}
        <div className="space-y-1">
          <label className="block text-[13px] font-semibold text-[#1d1d1f]">Giá bán phụ kiện kèm máy (đ)</label>
          <input
            type="number"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            className="w-full h-[40px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
          />
          <p className="text-[11px] text-[#7a7a7a] italic mt-1">Mặc định 0đ đại diện cho tặng kèm miễn phí</p>
        </div>

        <button
          type="submit"
          disabled={attachMutation.isPending}
          className="w-full h-[44px] bg-[#0066cc] hover:bg-[#0071e3] text-white font-semibold text-[14px] rounded-full transition active:scale-95 flex items-center justify-center gap-2 mt-4 shadow-sm cursor-pointer"
        >
          {attachMutation.isPending ? "Đang liên kết..." : "Xác nhận gắn phụ kiện"}
        </button>

      </form>
    </Dialog>
  );
}
