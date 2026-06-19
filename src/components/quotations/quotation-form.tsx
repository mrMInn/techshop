"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  getCustomersForSelect, 
  getInStockItemsForSelect, 
  getLeadSourcesAction,
  createCustomerAction
} from "@/app/actions/orders";
import { CustomSelect } from "@/components/ui/custom-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Plus, Trash2, FileText, Tag, Landmark, Calendar, MessageSquare, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { CustomerQuickDialog } from "@/components/orders/customer-quick-dialog";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
};

const formatNumberInput = (val: string) => {
  if (!val) return "";
  const clean = val.replace(/\D/g, "");
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseNumberInput = (val: string) => {
  return val.replace(/\D/g, "");
};

interface QuotationFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function QuotationForm({ onSubmit, onCancel, isLoading }: QuotationFormProps) {
  // 1. Fetch Dữ liệu (React Query)
  const { data: customerList, refetch: refetchCustomers } = useQuery({
    queryKey: ["customers-select"],
    queryFn: getCustomersForSelect,
  });

  const { data: stockItems } = useQuery({
    queryKey: ["stock-items-select"],
    queryFn: getInStockItemsForSelect,
  });

  const { data: leadSourceList } = useQuery({
    queryKey: ["lead-sources-select"],
    queryFn: getLeadSourcesAction,
  });

  // 2. State quản lý form
  const [customerMode, setCustomerMode] = useState<"select" | "manual">("select");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");
  const [leadSourceId, setLeadSourceId] = useState("");
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3); // Mặc định hiệu lực trong 3 ngày tới
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");

  // Danh sách sản phẩm trong báo giá
  const [selectedItems, setSelectedItems] = useState<{
    productId: string;
    productName: string;
    inventoryItemId?: string;
    serialNumber?: string;
    costPrice: number;
    quotedPrice: string; // Đơn giá báo cho khách
    notes?: string;
    mediaUrls?: string;
  }[]>([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [isCustomerQuickOpen, setIsCustomerQuickOpen] = useState(false);

  // Select Options Mapping
  const customerOptions = useMemo(() => {
    return customerList?.map(c => ({
      value: c.id,
      label: `${c.fullName} (${c.phone})`
    })) || [];
  }, [customerList]);

  const leadSourceOptions = useMemo(() => {
    return leadSourceList?.map(s => ({
      value: s.id,
      label: s.name
    })) || [];
  }, [leadSourceList]);

  // Nhóm máy sẵn kho theo Model
  const availableStockItems = useMemo(() => {
    return stockItems?.filter(item => !selectedItems.some(si => si.inventoryItemId === item.id)) || [];
  }, [stockItems, selectedItems]);

  const groupedStockItems = useMemo(() => {
    const groups: Record<string, {
      productId: string;
      productName: string;
      brandName: string;
      specs: any;
      items: any[];
    }> = {};

    for (const item of availableStockItems) {
      const key = item.productId;
      if (!groups[key]) {
        groups[key] = {
          productId: item.productId,
          productName: item.productName,
          brandName: item.brandName,
          specs: item.specs,
          items: [],
        };
      }
      groups[key].items.push(item);
    }

    return Object.values(groups);
  }, [availableStockItems]);

  const stockItemOptions = useMemo(() => {
    const formatSpecs = (specsObj: any) => {
      if (!specsObj) return "";
      const s = specsObj as { cpu?: string; ram?: string; ssd?: string; gpu?: string; screen?: string; color?: string };
      const parts = [];
      if (s.cpu) parts.push(s.cpu);
      if (s.ram) parts.push(s.ram);
      if (s.ssd) parts.push(s.ssd);
      return parts.join(" / ");
    };

    return groupedStockItems.map((group, index) => {
      const specsStr = formatSpecs(group.specs);
      const serialKeywords = group.items.map(item => item.serialNumber).join(" ");
      return {
        value: group.productId,
        label: `[${index + 1}] ${group.productName}`,
        subLabel: `${specsStr || "Không cấu hình"} • (Sẵn ${group.items.length} máy)`,
        searchKeywords: serialKeywords,
      };
    });
  }, [groupedStockItems]);

  const availableSerialsForSelectedProduct = useMemo(() => {
    if (!selectedProductId) return [];
    const group = groupedStockItems.find(g => g.productId === selectedProductId);
    return group ? group.items : [];
  }, [selectedProductId, groupedStockItems]);

  const handleAddItemDirectly = (item: any) => {
    const exists = selectedItems.some(i => i.inventoryItemId === item.id);
    if (exists) {
      toast.warning("Thiết bị này đã có trong báo giá");
      return;
    }

    setSelectedItems([
      ...selectedItems,
      {
        productId: item.productId,
        productName: item.productName,
        inventoryItemId: item.id,
        serialNumber: item.serialNumber,
        costPrice: Number(item.costPrice),
        quotedPrice: Math.round(Number(item.sellingPrice || item.costPrice)).toString(),
        notes: "",
        mediaUrls: "",
      }
    ]);
  };

  useEffect(() => {
    if (selectedProductId) {
      const serials = availableSerialsForSelectedProduct;
      if (serials.length === 1) {
        handleAddItemDirectly(serials[0]);
        setSelectedProductId("");
      }
    }
  }, [selectedProductId, availableSerialsForSelectedProduct]);

  // Xóa item khỏi danh sách chọn
  const handleRemoveItem = (index: number) => {
    const updated = [...selectedItems];
    updated.splice(index, 1);
    setSelectedItems(updated);
  };

  // Cập nhật giá trị quotedPrice hoặc notes hoặc mediaUrls riêng cho từng item
  const handleUpdateItemValue = (index: number, key: "quotedPrice" | "notes" | "mediaUrls", value: string) => {
    const updated = [...selectedItems];
    (updated[index] as any)[key] = value;
    setSelectedItems(updated);
  };

  // Tính toán số liệu
  const subtotal = selectedItems.reduce((sum, item) => sum + (Number(item.quotedPrice) || 0), 0);
  const discount = Number(discountAmount) || 0;
  const totalAmount = Math.max(0, subtotal - discount);



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 sản phẩm vào báo giá");
      return;
    }

    const payload = {
      customerId: (customerMode === "select" && selectedCustomerId) ? selectedCustomerId : undefined,
      customerName: customerMode === "manual" ? (manualCustomerName.trim() || undefined) : undefined,
      customerPhone: customerMode === "manual" ? (manualCustomerPhone.trim() || undefined) : undefined,
      leadSourceId: leadSourceId || undefined,
      discountAmount: discountAmount || "0",
      validUntil: validUntil || undefined,
      notes: notes.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
      items: selectedItems.map(item => ({
        productId: item.productId,
        inventoryItemId: item.inventoryItemId,
        quotedPrice: item.quotedPrice,
        notes: item.mediaUrls?.trim() 
          ? `${item.notes?.trim() || ""} ||media: ${item.mediaUrls.trim()}`
          : (item.notes?.trim() || undefined),
      })),
    };

    onSubmit(payload);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Products selector & settings */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Customer Info Card */}
            <div className="p-6 rounded-[18px] bg-[#f5f5f7] border border-[#e0e0e0]/70 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                    Thông tin khách hàng nhận báo giá
                  </h3>
                 
                </div>
                <div className="flex bg-[#f5f5f7] p-[3px] rounded-full text-[12.5px] font-semibold border border-[#e0e0e0] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.03)] gap-1 select-none shrink-0">
                  <button
                    type="button"
                    onClick={() => setCustomerMode("select")}
                    className={`px-4.5 py-1.5 rounded-full cursor-pointer transition-all duration-200 flex items-center justify-center active:scale-[0.98] ${
                      customerMode === "select" 
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_2px_6px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]" 
                        : "text-slate-600 hover:text-slate-900 font-semibold"
                    }`}
                  >
                    Khách có sẵn
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode("manual")}
                    className={`px-4.5 py-1.5 rounded-full cursor-pointer transition-all duration-200 flex items-center justify-center active:scale-[0.98] ${
                      customerMode === "manual" 
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_2px_6px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]" 
                        : "text-slate-600 hover:text-slate-900 font-semibold"
                    }`}
                  >
                    Khách vãng lai
                  </button>
                </div>
              </div>

              {customerMode === "select" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                      Chọn khách hàng
                    </label>
                    <div className="flex items-center gap-2">
                      <CustomSelect
                        options={customerOptions}
                        value={selectedCustomerId}
                        onChange={setSelectedCustomerId}
                        placeholder="Chọn khách hàng hoặc bỏ trống"
                        searchable={true}
                        dropdownWidth="full"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomerQuickOpen(true)}
                        className="h-[44px] w-[44px] bg-[#0066cc] text-white rounded-lg hover:bg-[#0071e3] transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                        title="Thêm khách hàng nhanh"
                      >
                        <PlusCircle size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                      Nguồn khách hàng
                    </label>
                    <CustomSelect
                      options={leadSourceOptions}
                      value={leadSourceId}
                      onChange={setLeadSourceId}
                      placeholder="Chọn nguồn khách"
                      dropdownWidth="full"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                      Tên khách hàng
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Nguyễn Văn A"
                      value={manualCustomerName}
                      onChange={(e) => setManualCustomerName(e.target.value)}
                      className="w-full h-[44px] px-4 rounded-lg bg-white border border-[#e0e0e0] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      placeholder="09xxxxxxxx"
                      value={manualCustomerPhone}
                      onChange={(e) => setManualCustomerPhone(e.target.value)}
                      className="w-full h-[44px] px-4 rounded-lg bg-white border border-[#e0e0e0] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                      Nguồn khách hàng
                    </label>
                    <CustomSelect
                      options={leadSourceOptions}
                      value={leadSourceId}
                      onChange={setLeadSourceId}
                      placeholder="Chọn nguồn..."
                      dropdownWidth="full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Selected Items Card */}
            <div className="p-6 rounded-[18px] bg-white border border-[#e0e0e0] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                  Danh sách sản phẩm báo giá ({selectedItems.length})
                </h3>
                <div className="relative w-full sm:w-80 shrink-0">
                  <CustomSelect
                    options={stockItemOptions}
                    value={selectedProductId}
                    onChange={setSelectedProductId}
                    placeholder="Tìm theo Model hoặc Serial..."
                    searchable={true}
                    align="right"
                    dropdownWidth="full"
                  />
                </div>
              </div>

              {/* Secondary Serial Selector Picker */}
              {selectedProductId && availableSerialsForSelectedProduct.length > 1 && (
                <div className="p-4 bg-[#f5f5f7] rounded-xl border border-[#e0e0e0] space-y-3 shadow-inner animate-fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-[12.5px] font-bold text-[#1d1d1f]">
                      👉 Chọn 1 mã Serial có sẵn trong kho để gán cụ thể cho báo giá:
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedProductId("")}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Hủy chọn
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {availableSerialsForSelectedProduct.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          handleAddItemDirectly(item);
                          setSelectedProductId("");
                        }}
                        className="flex flex-col p-3 bg-white border border-[#e0e0e0] hover:border-[#0066cc] rounded-xl text-left transition-all hover:shadow-sm cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-1.5 w-full mb-0.5">
                          <span className="font-mono text-[13px] font-bold text-[#1d1d1f] group-hover:text-[#0066cc] truncate">
                            {item.serialNumber}
                          </span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-[#f5f5f7] rounded text-[#7a7a7a] border uppercase tracking-wider">
                            {item.condition === "new" ? "Mới" : "Cũ"}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#7a7a7a] font-semibold mt-0.5">
                          Giá niêm yết: <span className="font-bold text-[#1d1d1f]">{formatPrice(Number(item.sellingPrice || item.costPrice))}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items List Table */}
              {selectedItems.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-[#e0e0e0] rounded-xl flex flex-col items-center justify-center text-center">
                  <FileText size={24} className="text-[#7a7a7a] mb-2" />
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">Chưa có sản phẩm nào được chọn</p>
                  <p className="text-[11.5px] text-[#7a7a7a] max-w-[280px] mt-1">
                    Hãy lựa chọn Model sản phẩm ở bộ lọc phía trên để soạn thảo báo giá.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto space-y-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#e0e0e0] bg-[#f5f5f7]/40 text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                        <th className="px-3 py-2.5 whitespace-nowrap">Sản phẩm / Serial</th>
                        <th className="px-3 py-2.5 w-28 text-right whitespace-nowrap">Giá vốn</th>
                        <th className="px-3 py-2.5 w-36 text-right whitespace-nowrap">Giá báo khách</th>
                        <th className="px-3 py-2.5 w-40 whitespace-nowrap">Mô tả riêng (VD: xước mặt A...)</th>
                        <th className="px-3 py-2.5 w-10 whitespace-nowrap"></th>
                      </tr>
                    </thead>
                    <tbody className="text-[14px] text-[#1d1d1f]">
                      {selectedItems.map((item, index) => (
                        <React.Fragment key={index}>
                          {/* Main Attribute Row */}
                          <tr className="border-b-0 hover:bg-[#f5f5f7]/30 transition-colors whitespace-nowrap">
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div>
                                <p className="font-semibold text-[#1d1d1f] tracking-tight truncate max-w-[200px]">
                                  {item.productName}
                                </p>
                                {item.serialNumber && (
                                  <span className="font-mono text-[11px] text-[#7a7a7a] bg-[#f5f5f7] px-2 py-0.5 rounded border border-[#e0e0e0] mt-1 inline-block">
                                    Serial: {item.serialNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-[13px] text-[#7a7a7a] whitespace-nowrap">
                              {formatPrice(item.costPrice)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <input
                                type="text"
                                value={formatNumberInput(item.quotedPrice)}
                                onChange={(e) => handleUpdateItemValue(index, "quotedPrice", parseNumberInput(e.target.value))}
                                placeholder="VNĐ"
                                className="w-full h-[36px] px-2.5 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-right font-semibold text-[#0066cc] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0066cc]"
                              />
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => handleUpdateItemValue(index, "notes", e.target.value)}
                                placeholder="VD: Cáp sạc đi kèm..."
                                className="w-full h-[36px] px-2.5 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[12.5px] focus:bg-white focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>

                          {/* Media URL Pasting Row */}
                          <tr className="border-b border-[#e0e0e0]/60 hover:bg-[#f5f5f7]/20">
                            <td colSpan={5} className="px-3 pb-3 pt-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[#7a7a7a] uppercase tracking-wider pl-1 shrink-0 flex items-center gap-1">
                                  🖼️ Link Ảnh/Video:
                                </span>
                                <input
                                  type="text"
                                  value={item.mediaUrls || ""}
                                  onChange={(e) => handleUpdateItemValue(index, "mediaUrls", e.target.value)}
                                  placeholder="Dán link hình ảnh hoặc video (VD: từ Telegram channel, Youtube, Imgur...), ngăn cách bởi dấu phẩy..."
                                  className="flex-1 h-[28px] px-2.5 rounded bg-[#f5f5f7] border border-[#e0e0e0] text-[11.5px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0066cc]"
                                />
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notes Area */}
            <div className="p-6 rounded-[18px] bg-[#f5f5f7] border border-[#e0e0e0]/70 space-y-4">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                Điều khoản & Ghi chú
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                    Ghi chú gửi khách (Hiển thị công khai)
                  </label>
                  <textarea
                    placeholder="VD: Bảo hành 3 tháng"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#e0e0e0] text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                    Ghi chú nội bộ
                  </label>
                  <textarea
                    placeholder="VD: Khách cực kỳ tiềm năng..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#e0e0e0] text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Quotation financials summary */}
          <div className="space-y-6">
            
            {/* Financial configs */}
            <div className="p-6 rounded-[18px] bg-[#f5f5f7] border border-[#e0e0e0]/70 space-y-4">
              <h3 className="text-[15px] font-semibold text-[#1d1d1f]">
                Giá trị & Điều khoản
              </h3>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 flex items-center gap-1">
                  <Tag size={12} /> Khấu trừ Giảm giá (VND)
                </label>
                <input
                  type="text"
                  value={formatNumberInput(discountAmount)}
                  onChange={(e) => setDiscountAmount(parseNumberInput(e.target.value))}
                  className="w-full h-[42px] px-4 rounded-xl bg-white border border-[#e0e0e0] text-[15px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                />
              </div>

               <div className="space-y-1.5 relative">
                <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1 flex items-center gap-1">
                  <Calendar size={12} className="text-[#0066cc]" /> Giá trị có hiệu lực đến ngày
                </label>
                <CustomDatePicker
                  value={validUntil}
                  onChange={setValidUntil}
                  placeholder="Chọn ngày hiệu lực..."
                />
              </div>
            </div>

            {/* Financial summary invoice preview */}
            <div className="p-6 rounded-[18px] bg-white border border-[#e0e0e0] space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 w-20 h-20 bg-[#0066cc]/5 blur-2xl rounded-full" />
              
              <h3 className="text-[15px] font-bold text-[#1d1d1f]">
                Tóm tắt cơ hội báo giá
              </h3>

              <div className="space-y-3 text-[13.5px] text-[#7a7a7a]">
                <div className="flex justify-between">
                  <span>Tổng tiền thô:</span>
                  <span className="font-semibold text-[#1d1d1f]">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Khấu trừ giảm giá:</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                
                <div className="border-t border-[#e0e0e0] pt-3 flex justify-between text-[18px] text-[#1d1d1f] font-semibold">
                  <span>Tổng giá trị báo:</span>
                  <span className="text-[#0066cc] font-bold">{formatPrice(totalAmount)}</span>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <button
                  type="submit"
                  disabled={isLoading || selectedItems.length === 0}
                  className="w-full h-[46px] bg-[#0066cc] text-white rounded-full text-[14px] font-bold hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoading ? "Đang xử lý..." : "Khởi tạo Báo giá"}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full h-[46px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] rounded-full text-[14px] font-semibold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>
            </div>

          </div>
        </div>
      </form>

      {/* Dialog thêm nhanh khách hàng */}
      <CustomerQuickDialog
        isOpen={isCustomerQuickOpen}
        onClose={() => setIsCustomerQuickOpen(false)}
        onSuccess={async (newCustomer) => {
          await refetchCustomers();
          setSelectedCustomerId(newCustomer.id);
          setCustomerMode("select");
        }}
      />
    </div>
  );
}
