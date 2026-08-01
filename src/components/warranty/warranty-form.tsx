"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomSelect } from "@/components/ui/custom-select";
import { ShieldAlert } from "lucide-react";
import { getCompletedOrdersForSelect, getEligibleOrderItemsForWarranty } from "@/app/actions/warranty";
import { toast } from "sonner";

interface WarrantyFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function WarrantyForm({ onSubmit, onCancel, isLoading }: WarrantyFormProps) {
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [issueDescription, setIssueDescription] = useState("");

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["completed-orders-for-warranty"],
    queryFn: getCompletedOrdersForSelect,
  });

  const { data: items, isLoading: isLoadingItems } = useQuery({
    queryKey: ["eligible-items-for-warranty", selectedOrderId],
    queryFn: () => getEligibleOrderItemsForWarranty(selectedOrderId),
    enabled: !!selectedOrderId,
  });

  const orderOptions = useMemo(() => {
    return orders?.map(o => ({
      value: o.id,
      label: o.customerName,
      subLabel: o.customerPhone ? o.customerPhone : "Không có SĐT",
      extraBadge: o.orderNumber,
      searchKeywords: `${o.customerName} ${o.customerPhone || ""} ${o.orderNumber}`
    })) || [];
  }, [orders]);

  const itemOptions = useMemo(() => {
    return items?.map(i => ({
      value: i.inventoryItemId, // using inventoryItemId as value to easily pick
      label: `${i.productName} (SN: ${i.serialNumber})`,
    })) || [];
  }, [items]);

  const selectedItemDetail = useMemo(() => {
    return items?.find(i => i.inventoryItemId === selectedItemId) || null;
  }, [items, selectedItemId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toast.error("Vui lòng chọn đơn hàng gốc");
      return;
    }
    if (!selectedItemId) {
      toast.error("Vui lòng chọn sản phẩm bảo hành");
      return;
    }

    if (!selectedItemDetail) return;

    onSubmit({
      orderId: selectedOrderId,
      orderItemId: selectedItemDetail.orderItemId,
      inventoryItemId: selectedItemDetail.inventoryItemId,
      customerId: selectedItemDetail.customerId,
      issueDescription,
      receivedDate: new Date().toISOString().split("T")[0],
    });
  };

  return (
    <div className="space-y-4 animate-fade-in text-[14px]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4.5 rounded-[18px] bg-[#f5f5f7] border border-[#e5e5ea] space-y-3.5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chọn Đơn Hàng */}
            <div className="col-span-1 md:col-span-2 space-y-1.5">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Đơn hàng gốc
              </label>
              <CustomSelect
                options={orderOptions}
                value={selectedOrderId}
                onChange={(val) => {
                  setSelectedOrderId(val);
                  setSelectedItemId(""); // reset selected item when order changes
                }}
                placeholder={isLoadingOrders ? "Đang tải đơn hàng..." : "Tìm tên khách, SĐT, mã đơn..."}
                searchable={true}
                dropdownWidth="full"
              />
            </div>
            
            {/* Chọn sản phẩm cần bảo hành */}
            {selectedOrderId && (
              <div className="col-span-1 md:col-span-2 space-y-2 mt-1">
                <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 block">
                  Chọn sản phẩm cần bảo hành
                </label>
                
                {isLoadingItems ? (
                  <div className="text-center py-4 text-[#7a7a7a]">Đang tải danh sách sản phẩm...</div>
                ) : items && items.length > 0 ? (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {items.map((item: any) => {
                      const isSelected = selectedItemId === item.inventoryItemId;
                      return (
                        <label 
                          key={item.inventoryItemId}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                            isSelected 
                              ? "bg-[#0066cc]/5 border-[#0066cc] text-[#0066cc]" 
                              : "bg-white border-[#e5e5ea] hover:bg-[#f5f5f7] text-[#1d1d1f]"
                          }`}
                        >
                           <div className="relative flex items-center justify-center shrink-0">
                             <input 
                               type="radio"
                               name="warranty-item"
                               checked={isSelected}
                               onChange={() => setSelectedItemId(item.inventoryItemId)}
                               className="sr-only"
                             />
                             <div className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
                               isSelected 
                                 ? "border-[#0066cc] bg-[#0066cc]" 
                                 : "border-[#d1d1d6] bg-white"
                             }`}>
                               {isSelected && (
                                 <div className="w-1.5 h-1.5 rounded-full bg-white" />
                               )}
                             </div>
                           </div>
                           <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[14px] truncate">{item.productName}</p>
                            <p className={`text-[12px] ${isSelected ? "text-[#0066cc]/70" : "text-[#7a7a7a]"} mt-0.5`}>
                              Serial: {item.serialNumber}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-[14px]">{item.warrantyMonths} tháng BH</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[#7a7a7a]">Đơn hàng không có sản phẩm đủ điều kiện bảo hành</div>
                )}
              </div>
            )}

            {/* Hiển thị tóm tắt thông tin đơn hàng nếu đã chọn */}
            {selectedOrderId && orders && (
              <div className="col-span-1 md:col-span-2 mt-1 p-4 rounded-xl bg-white border border-[#e5e5ea] flex flex-col gap-1 shadow-sm">
                <span className="text-[13px] text-[#7a7a7a]">Khách hàng: 
                  <span className="font-bold text-[#0066cc] ml-1">
                    {orders.find(o => o.id === selectedOrderId)?.customerName}
                  </span> 
                  <span className="mx-2 text-slate-300">|</span> 
                  <span className="text-[#5856d6] font-medium">
                    {orders.find(o => o.id === selectedOrderId)?.customerPhone || "Không có SĐT"}
                  </span>
                </span>
                <span className="text-[12px] text-[#7a7a7a]">
                  Ngày mua: {new Date(orders.find(o => o.id === selectedOrderId)?.createdAt || "").toLocaleDateString("vi-VN")}
                </span>
              </div>
            )}

            {/* Hiển thị chi tiết thời hạn bảo hành thực tế */}
            {selectedItemId && selectedItemDetail && (
              <div className="col-span-1 md:col-span-2 mt-1 p-4 rounded-xl bg-[#0066cc]/5 border border-[#0066cc]/10 flex flex-col gap-2 shadow-sm">
                <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#0066cc]">Thời hạn bảo hành thiết bị</span>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[13px]">
                  <div>
                    <span className="text-[#7a7a7a]">Ngày mua hàng:</span>
                    <strong className="text-[#1d1d1f] ml-1.5">
                      {new Date(selectedItemDetail.purchaseDate).toLocaleDateString("vi-VN")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#7a7a7a]">Thời hạn bảo hành:</span>
                    <strong className="text-[#1d1d1f] ml-1.5">{selectedItemDetail.warrantyMonths} tháng</strong>
                  </div>
                  <div>
                    <span className="text-[#7a7a7a]">Hạn bảo hành đến:</span>
                    <strong className="text-[#1d1d1f] ml-1.5">
                      {(() => {
                        const d = new Date(selectedItemDetail.purchaseDate);
                        d.setMonth(d.getMonth() + selectedItemDetail.warrantyMonths);
                        return d.toLocaleDateString("vi-VN");
                      })()}
                    </strong>
                  </div>
                  <div className="flex items-center">
                    <span className="text-[#7a7a7a] mr-1.5">Trạng thái:</span>
                    {(() => {
                      const d = new Date(selectedItemDetail.purchaseDate);
                      d.setMonth(d.getMonth() + selectedItemDetail.warrantyMonths);
                      const isUnder = new Date() <= d;
                      return isUnder ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
                          Còn bảo hành
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                          Hết bảo hành
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div className="col-span-1 md:col-span-2 space-y-1.5 mt-1">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Mô tả lỗi của khách báo
              </label>
              <textarea
                placeholder="Khách báo máy sọc màn hình, pin ảo, không lên nguồn..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#e5e5ea] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 h-[40px] bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#1d1d1f] rounded-full text-[14px] font-medium transition-all cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isLoading || !issueDescription || !selectedItemId || !selectedOrderId}
            className="px-7 h-[40px] bg-[#0066cc] text-white rounded-full text-[14px] font-semibold hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? "Đang xử lý..." : "Xác nhận tạo phiếu"}
          </button>
        </div>
      </form>
    </div>
  );
}
