"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomSelect } from "@/components/ui/custom-select";
import { RefreshCcw, Search, AlertCircle, ShieldAlert, DollarSign } from "lucide-react";
import { getCompletedOrdersForSelect, getEligibleOrderItemsForWarranty } from "@/app/actions/warranty";
import { getInventoryItems } from "@/app/actions/inventory";
import { toast } from "sonner";

interface ReturnFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function ReturnForm({ onSubmit, onCancel, isLoading }: ReturnFormProps) {
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [returnType, setReturnType] = useState<"return" | "exchange">("return");
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [hasFee, setHasFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState("0");
  
  // State lưu thông tin cấu hình của từng máy lẻ được chọn
  const [itemConfigs, setItemConfigs] = useState<Record<string, {
    conditionOnReturn: 'like_new' | 'good' | 'damaged' | 'defective';
    isDefective: boolean;
    defectDescription: string;
    refundPrice: string;
    originalPrice: string;
    newInventoryItemId?: string;
    newSellingPrice?: string;
  }>>({});

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["completed-orders-for-returns"],
    queryFn: getCompletedOrdersForSelect,
  });

  const { data: items, isLoading: isLoadingItems } = useQuery({
    queryKey: ["eligible-items-for-returns", selectedOrderId],
    queryFn: () => getEligibleOrderItemsForWarranty(selectedOrderId),
    enabled: !!selectedOrderId,
  });

  const { data: stockItems } = useQuery({
    queryKey: ["available-stock-for-exchange"],
    queryFn: getInventoryItems,
  });

  const availableStock = useMemo(() => {
    return stockItems?.filter(i => i.status === 'in_stock') || [];
  }, [stockItems]);

  const availableStockOptions = useMemo(() => {
    return availableStock.map(item => ({
      value: item.id,
      label: `${item.productName} - SN: ${item.serialNumber} (${formatPrice(item.sellingPrice || 0)})`,
      sellingPrice: item.sellingPrice || "0",
    }));
  }, [availableStock]);

  const orderOptions = useMemo(() => {
    return orders?.map(o => ({
      value: o.id,
      label: `[${o.orderNumber}] ${o.customerName} - ${o.customerPhone}`,
    })) || [];
  }, [orders]);

  const typeOptions = [
    { value: "return", label: "Trả hàng (Hoàn tiền)" },
    { value: "exchange", label: "Đổi hàng (Lấy máy khác)" },
  ];

  const reasonOptions = [
    { value: "defective", label: "Lỗi từ nhà sản xuất" },
    { value: "changed_mind", label: "Khách đổi ý / Nâng cấp" },
    { value: "wrong_item", label: "Giao sai hàng" },
    { value: "other", label: "Lý do khác" },
  ];

  const conditionOptions = [
    { value: "like_new", label: "Mới 100% / Like New" },
    { value: "good", label: "Hoạt động tốt / Xước nhẹ" },
    { value: "damaged", label: "Ngoại hình xấu / Móp méo" },
    { value: "defective", label: "Lỗi chức năng / Lỗi phần cứng" },
  ];

  // Cập nhật cấu hình mặc định khi đổi Lý do chung của phiếu
  useEffect(() => {
    if (!reason) return;
    setItemConfigs(prev => {
      const next = { ...prev };
      selectedItemIds.forEach(id => {
        if (next[id]) {
          next[id] = {
            ...next[id],
            conditionOnReturn: reason === "defective" ? "defective" : next[id].conditionOnReturn,
            isDefective: reason === "defective" ? true : next[id].isDefective,
          };
        }
      });
      return next;
    });
  }, [reason, selectedItemIds]);

  const handleToggleItem = (inventoryItemId: string, originalPrice: string) => {
    setSelectedItemIds(prev => {
      const isSelected = prev.includes(inventoryItemId);
      if (isSelected) {
        const nextConfigs = { ...itemConfigs };
        delete nextConfigs[inventoryItemId];
        setItemConfigs(nextConfigs);
        return prev.filter(id => id !== inventoryItemId);
      } else {
        setItemConfigs(prevConfigs => ({
          ...prevConfigs,
          [inventoryItemId]: {
            conditionOnReturn: reason === "defective" ? "defective" : "like_new",
            isDefective: reason === "defective",
            defectDescription: "",
            refundPrice: originalPrice,
            originalPrice: originalPrice,
            newInventoryItemId: "",
            newSellingPrice: "0",
          }
        }));
        return [...prev, inventoryItemId];
      }
    });
  };

  const handleSelectReplacement = (id: string, newId: string) => {
    const selectedItem = availableStock.find(item => item.id === newId);
    setItemConfigs(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        newInventoryItemId: newId,
        newSellingPrice: selectedItem?.sellingPrice || "0",
      }
    }));
  };

  const handleUpdateItemConfig = (id: string, key: string, value: any) => {
    setItemConfigs(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [key]: value,
        // Nếu chọn tình trạng lỗi thì tự động check là máy lỗi
        ...(key === "conditionOnReturn" ? {
          isDefective: value === "defective"
        } : {})
      }
    }));
  };

  // Tính tổng số tiền hoàn
  const computedTotalRefund = useMemo(() => {
    return selectedItemIds.reduce((sum, id) => {
      const config = itemConfigs[id];
      return sum + Number(config?.refundPrice || 0);
    }, 0);
  }, [selectedItemIds, itemConfigs]);

  // Tính chênh lệch đổi máy
  const computedExchangeDifference = useMemo(() => {
    if (returnType !== "exchange") return 0;
    const totalNewPrice = selectedItemIds.reduce((sum, id) => {
      const config = itemConfigs[id];
      return sum + Number(config?.newSellingPrice || 0);
    }, 0);
    const totalRefund = selectedItemIds.reduce((sum, id) => {
      const config = itemConfigs[id];
      return sum + Number(config?.refundPrice || 0);
    }, 0);
    const feeVal = Number(hasFee ? feeAmount : 0);
    return totalNewPrice - (totalRefund - feeVal);
  }, [returnType, selectedItemIds, itemConfigs, hasFee, feeAmount]);

  function formatPrice(price: string | number) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(price) || 0);
  }

  const formatNumberInput = (val: string | number) => {
    if (val === undefined || val === null || val === "") return "";
    const cleanVal = val.toString();
    
    let num: number;
    const directNum = Number(cleanVal);
    if (!isNaN(directNum)) {
      num = Math.round(directNum);
    } else {
      const digitsOnly = cleanVal.replace(/\D/g, "");
      num = Math.round(Number(digitsOnly || 0));
    }
    
    const clean = num.toString();
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumberInput = (val: string) => {
    return val.replace(/\D/g, "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toast.error("Vui lòng chọn đơn hàng gốc");
      return;
    }
    if (selectedItemIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 sản phẩm để hoàn trả");
      return;
    }
    if (!reason) {
      toast.error("Vui lòng chọn lý do");
      return;
    }

    // Kiểm tra mô tả lỗi và kiểm tra việc chọn máy thế vào cho Đổi hàng
    for (const id of selectedItemIds) {
      const config = itemConfigs[id];
      const itemDetail = items?.find(i => i.inventoryItemId === id);
      if (config?.isDefective && !config.defectDescription.trim()) {
        toast.error(`Vui lòng nhập mô tả chi tiết lỗi cho máy: ${itemDetail?.productName}`);
        return;
      }
      if (returnType === "exchange" && !config?.newInventoryItemId) {
        toast.error(`Vui lòng chọn máy mới đổi thế vào cho máy: ${itemDetail?.productName}`);
        return;
      }
    }

    const selectedCustomer = items?.[0]?.customerId;
    if (!selectedCustomer) return;

    const mapGlobalReasonToItemReason = (globalReason: string): any => {
      if (globalReason === "defective") return "defective";
      if (globalReason === "changed_mind") return "customer_request";
      if (globalReason === "wrong_item") return "wrong_specs";
      return "other";
    };

    const returnItemsData = selectedItemIds.map(id => {
      const itemDetail = items?.find(i => i.inventoryItemId === id);
      const config = itemConfigs[id];
      return {
        inventoryItemId: id,
        productId: itemDetail?.productId,
        returnReason: mapGlobalReasonToItemReason(reason),
        conditionOnReturn: config.conditionOnReturn,
        isDefective: config.isDefective,
        defectDescription: config.defectDescription.trim() || null,
        originalPrice: config.originalPrice,
        refundPrice: config.refundPrice,
        newInventoryItemId: config.newInventoryItemId || null,
        newSellingPrice: config.newSellingPrice || null,
      };
    });

    const finalRefundAmount = Math.max(0, computedTotalRefund - Number(hasFee ? feeAmount : 0));

    onSubmit({
      orderId: selectedOrderId,
      customerId: selectedCustomer,
      type: returnType,
      reason,
      reasonDetail,
      hasFee,
      feeAmount: hasFee ? feeAmount : "0",
      refundAmount: returnType === "return" ? finalRefundAmount.toString() : "0",
      exchangeDifference: returnType === "exchange" ? computedExchangeDifference.toString() : "0",
      items: returnItemsData
    });
  };

  return (
    <div className="space-y-6 animate-fade-in text-[14px]">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 rounded-[18px] bg-[#f5f5f7] border border-[#e0e0e0]/70 space-y-4">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f] flex items-center gap-2">
            <RefreshCcw size={18} className="text-[#0066cc]" />
            Thông tin Phiếu Đổi/Trả & Nhập kho lỗi
          </h3>
          
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
                  setSelectedItemIds([]);
                  setItemConfigs({});
                }}
                placeholder={isLoadingOrders ? "Đang tải đơn hàng..." : "Tìm tên khách, SĐT, mã đơn..."}
                searchable={true}
                dropdownWidth="full"
              />
            </div>

            {/* Hiển thị tóm tắt thông tin đơn hàng nếu đã chọn */}
            {selectedOrderId && orders && (
              <div className="col-span-1 md:col-span-2 mt-2 p-4 rounded-xl bg-white border border-[#e0e0e0] flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] text-[#7a7a7a]">Khách hàng: 
                      <strong className="text-[#1d1d1f] ml-1">
                        {orders.find(o => o.id === selectedOrderId)?.customerName}
                      </strong> 
                      <span className="mx-2">-</span> 
                      {orders.find(o => o.id === selectedOrderId)?.customerPhone}
                    </span>
                    <span className="text-[12px] text-[#7a7a7a]">
                      Ngày mua: {new Date(orders.find(o => o.id === selectedOrderId)?.createdAt || "").toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>

                {/* Danh sách máy trong đơn để tích chọn trả */}
                <div className="pt-3 border-t border-[#e0e0e0]">
                  <p className="text-[12px] font-semibold text-[#1d1d1f] mb-2">Chọn các máy cần Đổi/Trả:</p>
                  {isLoadingItems ? (
                    <p className="text-[12px] text-[#7a7a7a]">Đang tải danh sách máy...</p>
                  ) : items && items.length > 0 ? (
                    <div className="space-y-2">
                      {items.map(item => {
                        const originalPrice = item.sellingPrice || "0";
                        return (
                          <label key={item.inventoryItemId} className="flex items-center gap-3 p-3 rounded-lg border border-[#e0e0e0] hover:bg-[#f5f5f7] cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              checked={selectedItemIds.includes(item.inventoryItemId)}
                              onChange={() => handleToggleItem(item.inventoryItemId, originalPrice)}
                              className="w-4 h-4 rounded text-[#0066cc] focus:ring-[#0066cc]"
                            />
                            <div className="flex justify-between items-center w-full">
                              <div className="flex flex-col">
                                <span className="text-[14px] font-semibold text-[#1d1d1f]">{item.productName}</span>
                                <span className="text-[12px] text-[#7a7a7a]">SN: {item.serialNumber}</span>
                              </div>
                              <span className="text-[13px] font-bold text-[#1d1d1f]">{formatPrice(originalPrice)}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[12px] text-red-500">Đơn hàng này không có máy nào (hoặc đã trả hết).</p>
                  )}
                </div>
              </div>
            )}

            {/* Các tùy chọn chung của Phiếu */}
            <div className="space-y-1.5 mt-2">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Loại xử lý của Phiếu
              </label>
              <CustomSelect
                options={typeOptions}
                value={returnType}
                onChange={(val) => setReturnType(val as any)}
                placeholder="Chọn loại"
                dropdownWidth="full"
              />
            </div>
            
            <div className="space-y-1.5 mt-2">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Lý do chung của Phiếu
              </label>
              <CustomSelect
                options={reasonOptions}
                value={reason}
                onChange={setReason}
                placeholder="Chọn lý do"
                dropdownWidth="full"
              />
            </div>

            <div className="col-span-1 md:col-span-2 space-y-1.5 mt-2">
              <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Ghi chú diễn giải chung
              </label>
              <textarea
                placeholder="Diễn giải chung về phiếu nhập trả..."
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none text-[#1d1d1f] border border-[#e0e0e0]"
              />
            </div>
          </div>
        </div>

        {/* -------------------- DYNAMIC PER-ITEM SETTINGS -------------------- */}
        {selectedItemIds.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-[13px] font-bold text-[#7a7a7a] uppercase tracking-wider pl-1">
              CẤU HÌNH CHI TIẾT TỪNG MÁY NHẬN LẠI ({selectedItemIds.length})
            </h4>
            
            <div className="space-y-4">
              {selectedItemIds.map(id => {
                const itemDetail = items?.find(i => i.inventoryItemId === id);
                const config = itemConfigs[id];
                if (!config) return null;
 
                const showDefectInput = config.conditionOnReturn === "defective" || config.conditionOnReturn === "damaged" || config.isDefective;
 
                return (
                  <div key={id} className="p-5 rounded-2xl bg-white border border-[#e0e0e0] shadow-sm space-y-4 transition-all">
                    {/* Item header */}
                    <div className="flex justify-between items-start border-b border-[#f5f5f7] pb-3">
                      <div>
                        <h5 className="font-bold text-[#1d1d1f] text-[15px]">{itemDetail?.productName}</h5>
                        <p className="text-[12px] text-[#7a7a7a] font-mono mt-0.5">Serial: {itemDetail?.serialNumber}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-[#7a7a7a] block">Giá bán ban đầu</span>
                        <span className="font-bold text-[#1d1d1f]">{formatPrice(config.originalPrice)}</span>
                      </div>
                    </div>
 
                    {/* Form fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. Tình trạng lúc nhận lại */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-0.5">
                          Tình trạng lúc nhận lại
                        </label>
                        <CustomSelect
                          options={conditionOptions}
                          value={config.conditionOnReturn}
                          onChange={(val) => handleUpdateItemConfig(id, "conditionOnReturn", val)}
                          placeholder="Chọn tình trạng"
                          dropdownWidth="full"
                        />
                      </div>
 
                      {/* 2. Tiền hoàn trả riêng cho máy */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-0.5 flex items-center gap-1">
                          {returnType === "return" ? "Số tiền hoàn trả (VND)" : "Giá trị máy thu hồi (VND)"}
                        </label>
                        <input
                          type="text"
                          value={formatNumberInput(config.refundPrice)}
                          onChange={(e) => handleUpdateItemConfig(id, "refundPrice", parseNumberInput(e.target.value))}
                          className="w-full h-[40px] px-3.5 rounded-xl border border-[#e0e0e0] font-semibold text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                        />
                      </div>

                      {/* Select replacement machine (Exchange only) */}
                      {returnType === "exchange" && (
                        <div className="col-span-1 md:col-span-2 space-y-1.5 p-4 rounded-xl border border-[#0066cc]/10 bg-[#0066cc]/5">
                          <label className="text-[11px] font-bold text-[#0066cc] uppercase tracking-wider pl-0.5 block">
                            Chọn máy mới đổi thế vào *
                          </label>
                          <CustomSelect
                            options={availableStockOptions}
                            value={config.newInventoryItemId || ""}
                            onChange={(val) => handleSelectReplacement(id, val)}
                            placeholder="Chọn máy có sẵn trong kho sẵn hàng..."
                            searchable={true}
                            dropdownWidth="full"
                          />
                          {config.newInventoryItemId && (
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/50 text-[13px]">
                              <span className="text-[#7a7a7a]">Chênh lệch máy này:</span>
                              <span className={`font-bold ${
                                Number(config.newSellingPrice || 0) - Number(config.refundPrice || 0) >= 0 
                                  ? "text-green-600" 
                                  : "text-rose-600"
                              }`}>
                                {formatPrice(Number(config.newSellingPrice || 0) - Number(config.refundPrice || 0))}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
 
                      {/* Checkbox đánh dấu máy lỗi */}
                      <div className="col-span-1 md:col-span-2 flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          id={`defective-check-${id}`}
                          checked={config.isDefective}
                          onChange={(e) => handleUpdateItemConfig(id, "isDefective", e.target.checked)}
                          className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-[#e0e0e0]"
                        />
                        <label htmlFor={`defective-check-${id}`} className="text-[13px] font-semibold text-red-600 cursor-pointer flex items-center gap-1">
                          <ShieldAlert size={14} />
                          Xác nhận máy bị lỗi cần đưa vào kho lỗi (Defective)
                        </label>
                      </div>
 
                      {/* 3. Mô tả chi tiết tình trạng máy khi nhận lại */}
                      <div className={`col-span-1 md:col-span-2 space-y-1.5 p-4 rounded-xl border transition-colors ${
                        config.isDefective 
                          ? "bg-red-50/30 border-red-100" 
                          : "bg-slate-50 border-slate-200/50"
                      }`}>
                        <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          config.isDefective ? "text-[#b91c1c]" : "text-slate-600"
                        }`}>
                          <AlertCircle size={12} className={config.isDefective ? "text-red-500" : "text-slate-400"} />
                          {config.isDefective 
                            ? "Mô tả chi tiết tình trạng lỗi của máy *" 
                            : "Mô tả chi tiết/Ghi chú về tình trạng máy khi nhận lại"
                          }
                        </label>
                        <textarea
                          required={config.isDefective}
                          placeholder={config.isDefective 
                            ? "Ghi rõ chi tiết lỗi phần cứng, trầy xước móp méo hay tình trạng lỗi cụ thể để bộ phận kỹ thuật tiếp nhận..." 
                            : "Ghi chú bổ sung (không bắt buộc). Ví dụ: Máy còn đẹp 99%, đầy đủ hộp phụ kiện, dán cường lực sẵn..."
                          }
                          value={config.defectDescription}
                          onChange={(e) => handleUpdateItemConfig(id, "defectDescription", e.target.value)}
                          rows={2}
                          className={`w-full px-4 py-3 rounded-xl bg-white text-[14px] focus:outline-none focus:ring-2 transition-all resize-none text-[#1d1d1f] ${
                            config.isDefective 
                              ? "border-red-200 focus:ring-red-500/40" 
                              : "border-slate-200 focus:ring-[#0066cc]/40"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
 
            {/* Phân hệ chiết khấu giảm trừ hao hụt (Khách trả máy không lỗi) */}
            <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[13px] font-bold text-[#1d1d1f]">
                    {returnType === "return" ? "Khấu hao chiết khấu giảm trừ" : "Chiết khấu khấu hao máy cũ"}
                  </span>
                  <p className="text-[11.5px] text-[#7a7a7a]">
                    {returnType === "return" 
                      ? "Áp dụng giảm trừ tiền hoàn trả nếu khách trả hàng máy không lỗi (Đổi ý/Nâng cấp)" 
                      : "Áp dụng trừ khấu hao trị giá máy cũ thu hồi khi đổi sang máy mới không lỗi"
                    }
                  </p>
                </div>
                
                {/* Segmented Toggle Control */}
                <div className="flex bg-[#f5f5f7] p-0.5 rounded-xl border border-slate-200 gap-0.5 shadow-inner shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setHasFee(false);
                      setFeeAmount("0");
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      !hasFee 
                        ? "bg-white text-slate-700 shadow-sm border border-slate-200/40" 
                        : "text-[#7a7a7a] hover:text-[#1d1d1f]"
                    }`}
                  >
                    Không áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasFee(true)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                      hasFee 
                        ? "bg-white text-rose-600 shadow-sm border border-rose-100" 
                        : "text-[#7a7a7a] hover:text-[#1d1d1f]"
                    }`}
                  >
                    Có chiết khấu
                  </button>
                </div>
              </div>
 
              {/* Standard VND Formatted Input field */}
              {hasFee && (
                <div className="pt-4 border-t border-slate-100 space-y-2 animate-fade-in">
                  <label className="text-[11px] font-bold text-rose-600 uppercase tracking-wider pl-0.5">
                    {returnType === "return" ? "Số tiền chiết khấu giảm trừ (VND) *" : "Phí khấu hao đổi máy (VND) *"}
                  </label>
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      value={formatNumberInput(feeAmount)}
                      onChange={(e) => setFeeAmount(parseNumberInput(e.target.value))}
                      placeholder="0"
                      className="w-full pl-3.5 pr-12 h-[40px] rounded-xl border border-slate-200 font-extrabold text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all text-[#1d1d1f]"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-extrabold text-slate-400">VNĐ</span>
                  </div>
                  <p className="text-[11px] text-[#7a7a7a] pl-0.5 leading-relaxed">
                    {returnType === "return" 
                      ? "Số tiền này sẽ được khấu trừ tự động vào dòng tiền chi ngân quỹ ở hệ thống Sổ quỹ kế toán."
                      : "Số tiền khấu hao này sẽ giảm trừ giá trị thu hồi của máy cũ khi hạch toán dòng tiền hoàn trả liên kết Sổ quỹ."
                    }
                  </p>
                </div>
              )}
            </div>
 
            {/* Total refund visual summary banner with detailed balance breakdown */}
            <div className="p-5 rounded-2xl bg-[#0066cc]/5 border border-[#0066cc]/10 flex flex-col md:flex-row md:items-center justify-between text-[#1d1d1f] gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0066cc] text-white rounded-lg shrink-0">
                  <DollarSign size={16} />
                </div>
                <div>
                  <span className="text-[11.5px] text-[#7a7a7a] font-extrabold uppercase tracking-wider block">
                    {returnType === "return" ? "Cân đối hoàn trả ngân quỹ" : "Cân đối đổi hàng thu hồi"}
                  </span>
                  <span className="text-[12px] text-[#7a7a7a]">
                    {returnType === "return" 
                      ? "Khấu trừ tự động và đồng bộ hạch toán dòng tiền sổ quỹ"
                      : "Ghi nhận trị giá thu hồi của sản phẩm cũ phục vụ khấu trừ đơn hàng mới"
                    }
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col md:items-end text-right shrink-0">
                {returnType === "return" ? (
                  <>
                    {hasFee && (
                      <div className="text-[12px] text-[#7a7a7a] space-y-0.5 mb-1.5 font-medium leading-none">
                        <div>
                          Tổng trị giá máy:{" "}
                          <span className="font-bold text-[#1d1d1f]">{formatPrice(computedTotalRefund)}</span>
                        </div>
                        <div className="mt-1">
                          Hao hụt khấu trừ:{" "}
                          <span className="font-bold text-rose-600">-{formatPrice(feeAmount)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <span className="text-[11px] text-[#7a7a7a] font-extrabold uppercase tracking-wider mr-1 font-sans">
                        Thực tế hoàn khách:
                      </span>
                      <span className="text-[22px] font-extrabold text-[#0066cc] tracking-tight">
                        {formatPrice(Math.max(0, computedTotalRefund - Number(hasFee ? feeAmount : 0)))}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[12px] text-[#7a7a7a] space-y-0.5 mb-1.5 font-medium leading-none">
                      <div>
                        Trị giá máy cũ thu hồi:{" "}
                        <span className="font-bold text-[#1d1d1f]">{formatPrice(computedTotalRefund)}</span>
                      </div>
                      {hasFee && (
                        <div className="mt-1">
                          Phí khấu hao đổi trả:{" "}
                          <span className="font-bold text-rose-600">-{formatPrice(feeAmount)}</span>
                        </div>
                      )}
                      <div className="mt-1">
                        Trị giá máy mới đổi:{" "}
                        <span className="font-bold text-[#0066cc]">
                          {formatPrice(selectedItemIds.reduce((sum, id) => sum + Number(itemConfigs[id]?.newSellingPrice || 0), 0))}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <span className="text-[11px] text-[#7a7a7a] font-extrabold uppercase tracking-wider mr-1 font-sans">
                        {computedExchangeDifference >= 0 ? "Khách cần trả thêm:" : "Cửa hàng hoàn lại khách:"}
                      </span>
                      <span className={`text-[22px] font-extrabold tracking-tight ${
                        computedExchangeDifference >= 0 ? "text-green-600" : "text-rose-600"
                      }`}>
                        {formatPrice(Math.abs(computedExchangeDifference))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
 
          </div>
        )}

        <div className="pt-4 flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 h-[46px] bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#1d1d1f] rounded-full text-[15px] font-medium transition-all cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isLoading || !selectedOrderId || selectedItemIds.length === 0 || !reason}
            className="px-8 h-[46px] bg-[#0066cc] text-white rounded-full text-[15px] font-semibold hover:bg-[#0071e3] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? "Đang xử lý..." : "Xác nhận tạo phiếu"}
          </button>
        </div>
      </form>
    </div>
  );
}
