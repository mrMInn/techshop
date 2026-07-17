"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  getCustomersForSelect, 
  getInStockItemsForSelect, 
  getLeadSourcesAction,
  getInStockAccessoriesForSelect
} from "@/app/actions/orders";
import { CustomerManagementDialog } from "./customer-management-dialog";
import { LeadSourceManagerDialog } from "./lead-source-management-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { Plus, Trash2, ShoppingBag, DollarSign, Tag, Landmark, Truck, MessageSquare, PlusCircle, Banknote } from "lucide-react";
import { toast } from "sonner";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
};

const getActualCost = (item: any) => {
  return Number(item.costPrice || 0);
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

const formatSpecs = (specsObj: any) => {
  if (!specsObj) return "";
  let s = specsObj;
  if (typeof specsObj === "string") {
    try {
      s = JSON.parse(specsObj);
    } catch {
      return specsObj;
    }
  }
  const parts = [];
  if (s.cpu) parts.push(s.cpu);
  if (s.ram) parts.push(s.ram);
  if (s.ssd) parts.push(s.ssd);
  if (s.gpu) parts.push(s.gpu);
  if (s.screen) parts.push(s.screen);
  if (s.color) parts.push(s.color);
  return parts.join(" / ");
};


interface OrderFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function OrderForm({ onSubmit, onCancel, isLoading }: OrderFormProps) {
  // 1. Dữ liệu từ API (React Query)
  const { data: customerList, refetch: refetchCustomers } = useQuery({
    queryKey: ["customers-select"],
    queryFn: getCustomersForSelect,
  });

  const { data: stockItems, refetch: refetchStock } = useQuery({
    queryKey: ["stock-items-select"],
    queryFn: getInStockItemsForSelect,
  });

  const { data: leadSourceList, refetch: refetchLeadSources } = useQuery({
    queryKey: ["lead-sources-select"],
    queryFn: getLeadSourcesAction,
  });

  const { data: stockAccessories } = useQuery({
    queryKey: ["stock-accessories-select"],
    queryFn: getInStockAccessoriesForSelect,
  });

  // 2. State quản lý form
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [leadSourceId, setLeadSourceId] = useState("");
  const [saleChannel, setSaleChannel] = useState<"online" | "offline">("offline");
  const [isLeadSourceManageOpen, setIsLeadSourceManageOpen] = useState(false);
  
  // Danh sách sản phẩm được chọn trong đơn hàng
  const [selectedItems, setSelectedItems] = useState<{
    inventoryItemId?: string;
    accessoryItemId?: string;
    productId: string;
    productName: string;
    serialNumber: string;
    costPrice: number;
    actualCost: number;
    specs?: any;
    sellingPrice: string;
    discount: string;
    warrantyMonths: string;
    accessories?: any[];
  }[]>([]);

  // Trường chọn máy hiện tại để thêm vào đơn
  const [currentSelectedItemId, setCurrentSelectedItemId] = useState("");
  const [selectedAccessoryId, setSelectedAccessoryId] = useState("");

  // Các trường thanh toán & giao hàng
  const [discountAmount, setDiscountAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");
  const [payInFull, setPayInFull] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "card" | "mixed">("cash");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Dropdown options
  const customerOptions = useMemo(() => {
    return customerList?.map(c => ({
      value: c.id,
      label: c.phone ? `${c.fullName} (${c.phone})` : c.fullName
    })) || [];
  }, [customerList]);

  const channelOptions = [
    { value: "offline", label: "Tại cửa hàng" },
    { value: "online", label: "Trực tuyến" },
  ];

  const leadSourceOptions = useMemo(() => {
    return leadSourceList?.map(s => ({
      value: s.id,
      label: s.name
    })) || [];
  }, [leadSourceList]);

  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState("");

  const availableStockItems = useMemo(() => {
    return stockItems?.filter(item => !selectedItems.some(si => si.inventoryItemId === item.id)) || [];
  }, [stockItems, selectedItems]);

  const stockItemOptions = useMemo(() => {
    const formatSpecs = (specsObj: any) => {
      if (!specsObj) return "";
      const s = specsObj as { cpu?: string; ram?: string; ssd?: string; gpu?: string; screen?: string; color?: string };
      const parts = [];
      if (s.cpu) parts.push(s.cpu);
      if (s.ram) parts.push(s.ram);
      if (s.ssd) parts.push(s.ssd);
      if (s.gpu) parts.push(s.gpu);
      if (s.screen) parts.push(s.screen);
      if (s.color) parts.push(s.color);
      return parts.join(" / ");
    };

    return availableStockItems.map((item) => {
      const specsStr = formatSpecs(item.specs);
      return {
        value: item.id,
        label: `${item.productName} (${item.condition === "new" ? "Mới" : "Cũ"})`,
        subLabel: `${specsStr ? specsStr + " - " : ""}${item.serialNumber}`,
        searchKeywords: `${item.serialNumber} ${item.productName} ${specsStr}`,
        price: formatPrice(Number(item.costPrice || 0)),
      };
    });
  }, [availableStockItems]);

  const handleAddItemDirectly = (item: any) => {
    const exists = selectedItems.some(i => i.inventoryItemId === item.id);
    if (exists) {
      toast.warning("Sản phẩm này đã có trong đơn hàng");
      return;
    }

    const actualCost = getActualCost(item);
    setSelectedItems([
      ...selectedItems,
      {
        inventoryItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        serialNumber: item.serialNumber,
        costPrice: Number(item.costPrice),
        actualCost: actualCost,
        specs: item.specs || null,
        sellingPrice: item.sellingPrice && Number(item.sellingPrice) > 0 ? Math.round(Number(item.sellingPrice)).toString() : "",
        discount: "",
        warrantyMonths: "",
        accessories: (item.accessories || []).map((acc: any) => ({
          ...acc,
          warrantyMonths: "0",
        })),
      }
    ]);
  };

  useEffect(() => {
    if (selectedInventoryItemId) {
      const item = availableStockItems.find(i => i.id === selectedInventoryItemId);
      if (item) {
        handleAddItemDirectly(item);
        setSelectedInventoryItemId("");
      }
    }
  }, [selectedInventoryItemId, availableStockItems]);

  const accessoryOptions = useMemo(() => {
    const availableAccessories = stockAccessories?.filter(
      acc => !selectedItems.some(si => si.accessoryItemId === acc.id)
    ) || [];

    return availableAccessories.map(acc => ({
      value: acc.id,
      label: acc.catalogName,
      subLabel: acc.serialNumber ? `S/N: ${acc.serialNumber}` : `Không serial (ID: ${acc.id.slice(0, 6)})`,
    })) || [];
  }, [stockAccessories, selectedItems]);

  const handleAddAccessoryDirectly = (accId: string) => {
    const acc = stockAccessories?.find(a => a.id === accId);
    if (!acc) return;

    setSelectedItems([
      ...selectedItems,
      {
        accessoryItemId: acc.id,
        productId: acc.catalogId,
        productName: acc.catalogName,
        serialNumber: acc.serialNumber || "Không serial",
        costPrice: Number(acc.unitCost),
        actualCost: Number(acc.unitCost),
        sellingPrice: acc.sellingPrice && Number(acc.sellingPrice) > 0 ? Math.round(Number(acc.sellingPrice)).toString() : "",
        discount: "",
        warrantyMonths: "12",
      }
    ]);
    setSelectedAccessoryId("");
  };

  useEffect(() => {
    if (selectedAccessoryId) {
      handleAddAccessoryDirectly(selectedAccessoryId);
    }
  }, [selectedAccessoryId]);

  const paymentMethodOptions = [
    { value: "cash", label: "Tiền mặt" },
    { value: "bank_transfer", label: "Chuyển khoản" },
    { value: "card", label: "Thanh toán thẻ" },
    { value: "mixed", label: "Hỗn hợp" },
  ];

  // Dialog quản lý khách hàng
  const [isCustomerManageOpen, setIsCustomerManageOpen] = useState(false);



  // Xóa sản phẩm khỏi đơn hàng
  const handleRemoveItem = (index: number) => {
    const updated = [...selectedItems];
    updated.splice(index, 1);
    setSelectedItems(updated);
  };

  // Cập nhật giá trị thuộc tính của sản phẩm đã thêm
  const handleUpdateItemValue = (index: number, key: "sellingPrice" | "discount" | "warrantyMonths", value: string) => {
    const updated = [...selectedItems];
    if (key === "warrantyMonths") {
      updated[index][key] = value.replace(/\D/g, ""); // Chỉ nhận số nguyên dương hoặc trống
    } else {
      updated[index][key] = value;
    }
    setSelectedItems(updated);
  };

  // Cập nhật thời gian bảo hành cho phụ kiện đính kèm máy
  const handleUpdateAttachedAccessoryWarranty = (itemIndex: number, accIndex: number, value: string) => {
    const updated = [...selectedItems];
    const item = { ...updated[itemIndex] };
    const accs = [...(item.accessories || [])];
    accs[accIndex] = {
      ...accs[accIndex],
      warrantyMonths: value.replace(/\D/g, ""), // Chỉ nhận số nguyên dương hoặc trống
    };
    item.accessories = accs;
    updated[itemIndex] = item;
    setSelectedItems(updated);
  };

  // 4. Tính toán số liệu đơn hàng real-time
  const subtotal = selectedItems.reduce((sum, item) => sum + (Number(item.sellingPrice) || 0), 0);
  const totalItemDiscounts = selectedItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0);
  const totalCost = selectedItems.reduce((sum, item) => sum + item.actualCost, 0);

  const generalDiscount = Number(discountAmount) || 0;
  const tax = Number(taxAmount) || 0;
  const totalAmount = subtotal - totalItemDiscounts - generalDiscount + tax;

  const projectProfit = totalAmount - totalCost;
  const profitMargin = totalAmount > 0 ? (projectProfit / totalAmount) * 100 : 0;

  // Tự động đồng bộ số tiền khách trả trước khi chọn "Trả đủ" hoặc bán tại cửa hàng offline
  useEffect(() => {
    if (saleChannel === "offline" || payInFull) {
      setInitialPaymentAmount(totalAmount.toString());
    }
  }, [totalAmount, payInFull, saleChannel]);

  // Tự động chọn Khách vãng lai làm mặc định nếu có trong danh sách
  useEffect(() => {
    if (customerList && !selectedCustomerId) {
      const guest = customerList.find(c => c.fullName === "Khách vãng lai");
      if (guest) {
        setSelectedCustomerId(guest.id);
      }
    }
  }, [customerList, selectedCustomerId]);

  // Tự động điền Nguồn khách hàng khi chọn Khách hàng có sẵn nguồn
  useEffect(() => {
    if (selectedCustomerId && customerList) {
      const selectedCustomer = customerList.find(c => c.id === selectedCustomerId);
      if (selectedCustomer?.leadSourceId) {
        setLeadSourceId(selectedCustomer.leadSourceId);
      }
    }
  }, [selectedCustomerId, customerList]);

  // Xử lý gửi dữ liệu đơn hàng đi
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 sản phẩm vào đơn hàng");
      return;
    }

    // Format dữ liệu gửi lên action
    const payload = {
      customerId: selectedCustomerId || undefined,
      leadSourceId: leadSourceId || undefined,
      saleChannel,
      items: selectedItems.map(item => ({
        inventoryItemId: item.inventoryItemId || undefined,
        accessoryItemId: item.accessoryItemId || undefined,
        productId: item.productId,
        sellingPrice: item.sellingPrice || "0",
        discount: item.discount || "0",
        warrantyMonths: Number(item.warrantyMonths) || 0,
        attachedAccessories: item.accessories 
          ? item.accessories.map((acc: any) => ({
              accessoryItemId: acc.id,
              warrantyMonths: Number(acc.warrantyMonths) || 0,
            }))
          : undefined,
      })),
      discountAmount,
      taxAmount,
      initialPaymentAmount,
      paymentMethod,
      shippingAddress: shippingAddress.trim() || undefined,
      notes: notes.trim() || undefined,
      paymentNotes: paymentNotes.trim() || undefined,
    };

    onSubmit(payload);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CỘT TRÁI + GIỮA: Chọn sản phẩm & Thông tin đơn hàng (Chiếm 2 phần) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* CARD 1: Thông tin Khách hàng & Kênh bán */}
            <div className="p-6 rounded-[18px] bg-[#f5f5f7] border border-[#e0e0e0]/70 space-y-4">
              <h3 className="text-[16px] font-semibold text-[#1d1d1f] flex items-center gap-2">
                
                Thông tin khách
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Khách hàng */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                      Khách hàng
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setIsCustomerManageOpen(true)}
                      className="text-[11.5px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
                    >
                      Quản lý khách hàng
                    </button>
                  </div>
                  <CustomSelect
                    options={customerOptions}
                    value={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                    placeholder="Mặc định: Khách vãng lai"
                    searchable={true}
                    dropdownWidth="full"
                  />
                </div>

                {/* Kênh bán hàng */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                    Kênh bán
                  </label>
                  <CustomSelect
                    options={channelOptions}
                    value={saleChannel}
                    onChange={(val) => setSaleChannel(val as any)}
                    align="right"
                    dropdownWidth="full"
                  />
                </div>

                {/* Nguồn khách */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                      Nguồn khách
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setIsLeadSourceManageOpen(true)}
                      className="text-[11.5px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
                    >
                      Quản lý nguồn khách
                    </button>
                  </div>
                  <CustomSelect
                    options={leadSourceOptions}
                    value={leadSourceId}
                    onChange={setLeadSourceId}
                    searchable={true}
                    placeholder="Chọn nguồn..."
                    dropdownWidth="full"
                  />
                </div>

                {/* Địa chỉ giao hàng */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                    Địa chỉ giao hàng (Nếu có)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Nhận máy tại nhà riêng..."
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50"
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: Chọn thiết bị bán từ Kho */}
            <div className="p-6 rounded-[18px] bg-white border border-[#e0e0e0] space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-[16px] font-semibold text-[#1d1d1f]">
                  Danh sách sản phẩm trong đơn ({selectedItems.length})
                </h3>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                  {/* Dropdown chọn model sẵn hàng */}
                  <div className="relative w-full sm:w-72">
                    <CustomSelect
                      options={stockItemOptions}
                      value={selectedInventoryItemId}
                      onChange={setSelectedInventoryItemId}
                      placeholder="Tìm máy theo Model/Serial..."
                      searchable={true}
                      align="right"
                      dropdownWidth="full"
                    />
                  </div>

                  {/* Dropdown chọn phụ kiện lẻ */}
                  <div className="relative w-full sm:w-60">
                    <CustomSelect
                      options={accessoryOptions}
                      value={selectedAccessoryId}
                      onChange={setSelectedAccessoryId}
                      placeholder="Bán phụ kiện lẻ..."
                      searchable={true}
                      align="right"
                      dropdownWidth="full"
                    />
                  </div>
                </div>
              </div>

              {/* Bảng danh sách items đã chọn */}
              {selectedItems.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-[#e0e0e0] rounded-xl flex flex-col items-center justify-center text-center">
                  <ShoppingBag size={24} className="text-[#7a7a7a] mb-2" />
                  <p className="text-[14px] font-semibold text-[#1d1d1f]">Chưa có thiết bị nào</p>
                  <p className="text-[12px] text-[#7a7a7a] max-w-[320px] mt-1">
                    Hãy lựa chọn Model sản phẩm ở dropdown góc trên để đưa vào hóa đơn bán lẻ.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto space-y-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#e0e0e0] bg-[#f5f5f7]/40 text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                        <th className="px-3 py-2.5">Sản phẩm / Serial</th>
                        <th className="px-3 py-2.5 w-32 text-right">Giá nhập</th>
                        <th className="px-3 py-2.5 w-32 text-right">Giá bán</th>
                        <th className="px-3 py-2.5 w-28 text-right">Giảm giá</th>
                        <th className="px-3 py-2.5 w-24 text-center">Bảo hành</th>
                        <th className="px-3 py-2.5 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="text-[14px] text-[#1d1d1f]">
                      {selectedItems.map((item, index) => {
                        const sellingNum = Number(item.sellingPrice) || 0;
                        const discNum = Number(item.discount) || 0;
                        const finalNum = sellingNum - discNum;
                        const profit = finalNum - item.actualCost;
                        const originalCost = item.costPrice;
                        const hasCostDiff = item.actualCost !== originalCost;

                        return (
                          <tr key={item.inventoryItemId || item.accessoryItemId} className="border-b border-[#e0e0e0]/60 last:border-0 hover:bg-[#f5f5f7]/30 transition-colors">
                            {/* Tên máy & Serial */}
                            <td className="px-3 py-3.5">
                              <div className="flex flex-col">
                                <p className="font-semibold text-[#1d1d1f] tracking-tight truncate max-w-[240px]">
                                  {item.productName}
                                </p>
                                {item.specs && formatSpecs(item.specs) && (
                                  <span className="text-[11px] text-[#7a7a7a] font-normal mt-0.5 truncate max-w-[280px]">
                                    {formatSpecs(item.specs)}
                                  </span>
                                )}
                                <span className="text-[12px] font-medium text-[#7a7a7a] bg-[#f5f5f7] px-2 py-0.5 rounded border border-[#e0e0e0] mt-1 inline-block w-fit">
                                  {item.serialNumber}
                                </span>
                                {item.accessories && item.accessories.length > 0 && (
                                  <div className="flex flex-col gap-2 mt-2 border-t border-slate-100 pt-2">
                                    {item.accessories.map((acc: any, accIdx: number) => (
                                      <div key={acc.id} className="flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-[11px] text-[#0066cc] font-medium bg-[#0066cc]/5 px-2.5 py-0.5 rounded-full border border-[#0066cc]/10">
                                          🎁 Tặng kèm: {acc.catalogName} {acc.serialNumber ? `(${acc.serialNumber})` : ""}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-[11px] text-[#7a7a7a] font-medium">BH:</span>
                                          <input
                                            type="text"
                                            value={acc.warrantyMonths ?? "0"}
                                            onChange={(e) => handleUpdateAttachedAccessoryWarranty(index, accIdx, e.target.value)}
                                            className="w-10 h-5 px-1 bg-[#f5f5f7] border border-[#e0e0e0] rounded text-[11px] text-center font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0066cc] placeholder:text-[#7a7a7a]/50"
                                            placeholder="0"
                                          />
                                          <span className="text-[11px] text-[#7a7a7a] font-medium">tháng</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Giá nhập (Read-only) */}
                            <td className="px-3 py-3.5 text-right text-[14px] text-[#7a7a7a] font-medium">
                              <div className="flex flex-col items-end">
                                <span className={hasCostDiff ? "line-through text-[11px] opacity-60" : ""}>
                                  {formatPrice(originalCost)}
                                </span>
                                {hasCostDiff && (
                                  <span className="text-[13px] font-semibold text-amber-600">
                                    {formatPrice(item.actualCost)}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Giá bán (Editable) */}
                            <td className="px-3 py-3.5">
                              <input
                                type="text"
                                value={formatNumberInput(item.sellingPrice)}
                                onChange={(e) => handleUpdateItemValue(index, "sellingPrice", parseNumberInput(e.target.value))}
                                placeholder="VNĐ"
                                className="w-full h-[36px] px-2 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-right font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0066cc] placeholder:text-[#7a7a7a]/50 placeholder:font-normal"
                              />
                            </td>

                            {/* Giảm giá riêng (Editable) */}
                            <td className="px-3 py-3.5">
                              <input
                                type="text"
                                value={formatNumberInput(item.discount)}
                                onChange={(e) => handleUpdateItemValue(index, "discount", parseNumberInput(e.target.value))}
                                placeholder="VNĐ"
                                className="w-full h-[36px] px-2 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-right focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0066cc] placeholder:text-[#7a7a7a]/50"
                              />
                            </td>

                            {/* Số tháng bảo hành (Editable) */}
                            <td className="px-3 py-3.5">
                              <input
                                type="text"
                                value={item.warrantyMonths}
                                onChange={(e) => handleUpdateItemValue(index, "warrantyMonths", e.target.value)}
                                placeholder="Tháng"
                                className="w-full h-[36px] px-2 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-center focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0066cc] placeholder:text-[#7a7a7a]/50 text-[14px]"
                              />
                            </td>

                            {/* Nút xóa */}
                            <td className="px-3 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                                title="Xóa mặt hàng này"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* CARD 3: Ghi chú Đơn hàng */}
            <div className="p-6 rounded-[18px] bg-[#f5f5f7] border border-[#e0e0e0]/70 space-y-4">
              <h3 className="text-[16px] font-semibold text-[#1d1d1f] flex items-center gap-2">
                Ghi chú đơn hàng
              </h3>
              <textarea
                placeholder="Nhập ghi chú chi tiết về thỏa thuận đơn hàng, điều kiện giao hàng..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#e0e0e0] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50 resize-none"
              />
            </div>

          </div>

          {/* CỘT PHẢI: Thanh toán & Bảng Tổng kết tài chính (Chiếm 1 phần) */}
          <div className="space-y-6">
            {/* CARD 4: Chi tiết thanh toán dòng tiền */}
            <div className="p-6 rounded-[18px] bg-[#f5f5f7] border border-[#e0e0e0]/70 space-y-4">
              <h3 className="text-[16px] font-semibold text-[#1d1d1f] flex items-center gap-2">
                
                Thanh toán
              </h3>

              {/* Khấu trừ giảm giá đơn */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                  Giảm giá chung đơn (VND)
                </label>
                <input
                  type="text"
                  value={formatNumberInput(discountAmount)}
                  onChange={(e) => setDiscountAmount(parseNumberInput(e.target.value))}
                  placeholder="0"
                  className="w-full h-[44px] px-4 rounded-xl bg-white border border-[#e0e0e0] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50"
                />
              </div>

              {/* Thuế VAT */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                  Thuế phát sinh (VND)
                </label>
                <input
                  type="text"
                  value={formatNumberInput(taxAmount)}
                  onChange={(e) => setTaxAmount(parseNumberInput(e.target.value))}
                  placeholder="0"
                  className="w-full h-[44px] px-4 rounded-xl bg-white border border-[#e0e0e0] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50"
                />
              </div>

              {/* Phương thức thanh toán */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                  Phương thức thanh toán
                </label>
                <CustomSelect
                  options={paymentMethodOptions}
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val as any)}
                  placeholder="Chọn phương thức thanh toán"
                  align="right"
                  dropdownWidth="full"
                />
              </div>

              {/* Khách đã trả trước */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider flex items-center gap-1">
                    {saleChannel === "online" ? "Tiền cọc trước (VND)" : "Khách trả trước (VND)"}
                  </label>
                  <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#1d1d1f] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={saleChannel === "offline"}
                      checked={saleChannel === "offline" ? true : payInFull}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPayInFull(checked);
                        if (checked) {
                          setInitialPaymentAmount(totalAmount.toString());
                        }
                      }}
                      className="w-3.5 h-3.5 rounded text-[#0066cc] border-[#e0e0e0] focus:ring-[#0066cc]/40 focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className={saleChannel === "offline" ? "opacity-50" : ""}>Khách trả đủ</span>
                  </label>
                </div>
                <input
                  type="text"
                  disabled={saleChannel === "offline"}
                  value={formatNumberInput(initialPaymentAmount)}
                  onChange={(e) => {
                    const val = parseNumberInput(e.target.value);
                    setInitialPaymentAmount(val);
                    if (val !== totalAmount.toString()) {
                      setPayInFull(false);
                    }
                  }}
                  placeholder="0"
                  className="w-full h-[44px] px-4 rounded-xl border border-[#e0e0e0] text-[14px] font-semibold text-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50 placeholder:font-normal disabled:bg-[#f5f5f7] disabled:text-[#7a7a7a] disabled:cursor-not-allowed bg-white"
                />
              </div>

              {/* Ghi chú thanh toán */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider pl-1">
                  Ghi chú thanh toán
                </label>
                <input
                  type="text"
                  placeholder="Mã giao dịch chuyển khoản..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full h-[44px] px-4 rounded-xl bg-white border border-[#e0e0e0] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/50"
                />
              </div>
            </div>

            {/* CARD 5: Bảng Tổng Kết Tài Chính Đơn */}
            <div className="p-6 rounded-[18px] bg-white border border-[#e0e0e0] space-y-4 shadow-sm">
              <h3 className="text-[16px] font-semibold text-[#1d1d1f]">
                Hóa đơn thanh toán
              </h3>

              <div className="space-y-3 text-[14px] text-[#7a7a7a]">
                <div className="flex justify-between">
                  <span>Tổng tiền niêm yết:</span>
                  <span className="font-semibold text-[#1d1d1f]">{formatPrice(subtotal)}</span>
                </div>
                
                {totalItemDiscounts > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Khấu trừ giảm giá máy:</span>
                    <span>-{formatPrice(totalItemDiscounts)}</span>
                  </div>
                )}

                {generalDiscount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Khấu trừ giảm giá đơn:</span>
                    <span>-{formatPrice(generalDiscount)}</span>
                  </div>
                )}

                {tax > 0 && (
                  <div className="flex justify-between">
                    <span>Thuế phát sinh:</span>
                    <span className="font-semibold text-[#1d1d1f]">{formatPrice(tax)}</span>
                  </div>
                )}

                <div className="border-t border-[#e0e0e0] pt-3 flex justify-between text-[18px] text-[#1d1d1f] font-semibold">
                  <span>Tổng thanh toán:</span>
                  <span className="text-[#0066cc]">{formatPrice(totalAmount)}</span>
                </div>

                <div className="flex justify-between text-[13px]">
                  <span>{saleChannel === "online" ? "Tiền cọc trước:" : "Khách trả trước:"}</span>
                  <span className="font-medium text-[#1d1d1f]">{formatPrice(Number(initialPaymentAmount) || 0)}</span>
                </div>

                <div className="flex justify-between text-[13px] border-b border-[#e0e0e0]/70 pb-3">
                  <span>{saleChannel === "online" ? "Cần thu COD từ khách:" : "Còn lại cần thu:"}</span>
                  <span className={`font-semibold ${totalAmount - (Number(initialPaymentAmount) || 0) <= 0 ? "text-green-600" : "text-amber-600"}`}>
                    {formatPrice(Math.max(0, totalAmount - (Number(initialPaymentAmount) || 0)))}
                  </span>
                </div>

                {/* Phần ước toán lợi nhuận đơn hàng dành cho owner */}
                <div className="pt-1 space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span>Ước tính giá vốn:</span>
                    <span className="font-medium text-[#1d1d1f]">{formatPrice(totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span>Ước toán lợi nhuận:</span>
                    <span className={`font-bold ${projectProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {projectProfit >= 0 ? "+" : ""}{formatPrice(projectProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] uppercase tracking-wider font-semibold">
                    <span>Biên lợi nhuận %:</span>
                    <span className={projectProfit >= 0 ? "text-green-600" : "text-red-600"}>
                      {profitMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút submit lập đơn hàng */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading || selectedItems.length === 0}
                  className="w-full h-[46px] bg-[#0066cc] text-white rounded-full text-[15px] font-semibold hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoading ? "Đang xử lý giao dịch..." : "Hoàn tất"}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full mt-2.5 h-[46px] bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#1d1d1f] rounded-full text-[15px] font-medium transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>

            </div>
          </div>
        </div>
      </form>

      {/* Dialog quản lý khách hàng */}
      <CustomerManagementDialog
        isOpen={isCustomerManageOpen}
        onClose={() => setIsCustomerManageOpen(false)}
        onSelect={(cust) => {
          setSelectedCustomerId(cust.id);
          if (cust.leadSourceId) {
            setLeadSourceId(cust.leadSourceId);
          }
        }}
        onUpdate={refetchCustomers}
      />

      {/* Modal quản lý nguồn khách */}
      <LeadSourceManagerDialog
        isOpen={isLeadSourceManageOpen}
        onClose={() => setIsLeadSourceManageOpen(false)}
        onUpdate={refetchLeadSources}
      />
    </div>
  );
}
