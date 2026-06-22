"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getInventoryItems, 
  createInventoryItem, 
  createInventoryItemsBatch,
  updateInventoryItem, 
  deleteInventoryItem,
  softDeleteInventoryItem,
  restoreInventoryItem,
  bulkConfirmArrival,
  bulkDeleteInventoryItems,
} from "@/app/actions/inventory";
import { getPurchaseOrdersList, getPurchaseOrderDetail, updateAccessoryCostAction } from "@/app/actions/purchase-orders";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { 
  SFSymbolMagnifyingGlass,
  SFSymbolPlus,
  SFSymbolArrowClockwise,
  SFSymbolShippingBox,
  SFSymbolLaptopComputer,
  SFSymbolTruck,
  SFSymbolSquareAndPencil,
  SFSymbolTrash,
  SFSymbolEye,
  SFSymbolCheckmarkCircle,
  SFSymbolCPU,
  SFSymbolMemoryChip,
  SFSymbolInternalDrive,
  SFSymbolActivity,
  SFSymbolExclamationTriangle,
  SFSymbolWrench,
  SFSymbolDollarSign,
  SFSymbolArrowRightLeft,
  SFSymbolDisplay
} from "@/components/ui/apple-icons";
import { useState, useMemo, Fragment, useEffect } from "react";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InventoryDetailDialog } from "@/components/inventory/inventory-detail-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import Link from "next/link";
import { DefectiveActionsDialog } from "@/components/inventory/defective-actions-dialog";


export default function InventoryPage() {
  const queryClient = useQueryClient();
  
  // Kích hoạt Supabase Realtime cho kho hàng
  useRealtimeSubscription("inventory_items", [["inventory"]]);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Custom dialog states
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [activeDrawerProductId, setActiveDrawerProductId] = useState<string | null>(null);

  // Purchase Orders & Cost allocation states
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [editingAccessoryItem, setEditingAccessoryItem] = useState<any>(null);
  const [accessoryCostInput, setAccessoryCostInput] = useState<string>("0");
  const [accessoryNotesInput, setAccessoryNotesInput] = useState<string>("");

  // Defective inventory / Kho lỗi states
  const [activeTab, setActiveTab] = useState<"active" | "defective" | "returned" | "purchase_orders">("active");
  const [defectiveItem, setDefectiveItem] = useState<any>(null);
  const [defectiveActionType, setDefectiveActionType] = useState<"report" | "repair" | "complete" | "refund" | "writeoff" | null>(null);

  // Purchase Orders filter states
  const [selectedPoStatus, setSelectedPoStatus] = useState<string>("all");
  const [selectedPoSupplier, setSelectedPoSupplier] = useState<string>("all");

  // Reset all filters and search keyword when switching tab to avoid mismatch results
  useEffect(() => {
    setSelectedStatus("all");
    setSelectedPoStatus("all");
    setSelectedPoSupplier("all");
    setSearch("");
  }, [activeTab]);

  // Mounted state to ensure safe Portal rendering in Next.js SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const bulkConfirmMutation = useMutation({
    mutationFn: (ids: string[]) => bulkConfirmArrival(ids),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setSelectedIds([]);
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi xác nhận về kho"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteInventoryItems(ids, false),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setSelectedIds([]);
        setIsBulkDeleteConfirmOpen(false);
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi xóa hàng loạt"),
  });



  const { data: items, isLoading, error } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => getInventoryItems(),
  });

  const { data: purchaseOrdersData, isLoading: isPoLoading } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => getPurchaseOrdersList(),
    enabled: true,
  });

  const { data: poDetailData, isLoading: isPoDetailLoading, isError: isPoDetailError, error: poDetailError } = useQuery({
    queryKey: ["purchaseOrderDetail", selectedPoId],
    queryFn: () => getPurchaseOrderDetail(selectedPoId!),
    enabled: !!selectedPoId,
    staleTime: 10000, // Cache for 10 seconds to make Drawer toggle instant
  });

  const updateAccessoryCostMutation = useMutation({
    mutationFn: (data: { itemId: string; cost: number; notes: string | null }) =>
      updateAccessoryCostAction(data.itemId, data.cost, data.notes),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
        if (selectedPoId) {
          queryClient.invalidateQueries({ queryKey: ["purchaseOrderDetail", selectedPoId] });
        }
        setEditingAccessoryItem(null);
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi cập nhật chi phí phụ kiện"),
  });

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrdersData?.purchaseOrders?.filter((po: any) => {
      const matchesSearch =
        po.poNumber.toLowerCase().includes(search.toLowerCase()) ||
        (po.supplierName || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus = selectedPoStatus === "all" || po.status === selectedPoStatus;
      const matchesSupplier = selectedPoSupplier === "all" || po.supplierName === selectedPoSupplier;

      return matchesSearch && matchesStatus && matchesSupplier;
    }) || [];
  }, [purchaseOrdersData, search, selectedPoStatus, selectedPoSupplier]);

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.serialNumbers) {
        return createInventoryItemsBatch(data);
      }
      return createInventoryItem(data);
    },
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setIsDialogOpen(false);
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi tạo"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) => updateInventoryItem(data.id, data.payload),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setIsDialogOpen(false);
        setEditingItem(null);
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi cập nhật"),
  });

  const deleteMutation = useMutation({
    mutationFn: (data: { id: string; isHardDelete: boolean }) =>
      data.isHardDelete ? deleteInventoryItem(data.id) : softDeleteInventoryItem(data.id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setItemToDelete(null);
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi xóa"),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreInventoryItem,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi khôi phục"),
  });

  const handleDeleteClick = (item: any) => {
    setActiveMenuId(null);
    setItemToDelete(item);
  };

  const handleRestoreClick = (item: any) => {
    setActiveMenuId(null);
    restoreMutation.mutate(item.id);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate({
        id: itemToDelete.id,
        isHardDelete: itemToDelete.status === "deleted",
      });
    }
  };

  const handleOpenDetails = (item: any) => {
    setActiveMenuId(null);
    setSelectedItemForDetails(item);
  };



  const handleOpenCreateDialog = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (item: any) => {
    setActiveMenuId(null);
    setEditingItem(item);
    setIsDialogOpen(true);
  };


  const handleFormSubmit = (data: any) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(price));
  };

  const formatToDDMMYYYY = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    try {
      const d = typeof dateString === "string" ? new Date(dateString) : dateString;
      if (isNaN(d.getTime())) return "N/A";
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "N/A";
    }
  };

  const categoryOptions = useMemo(() => {
    const uniqueCategories = Array.from(new Set(items?.map((item: any) => item.categoryName) || [])) as string[];
    return [
      { value: "all", label: "Tất cả danh mục" },
      ...uniqueCategories.map((cat) => ({ value: cat, label: cat })),
    ];
  }, [items]);

  const brandOptions = useMemo(() => {
    const uniqueBrands = Array.from(new Set(items?.map((item: any) => item.brandName) || [])) as string[];
    return [
      { value: "all", label: "Tất cả thương hiệu" },
      ...uniqueBrands.map((brand) => ({ value: brand, label: brand })),
    ];
  }, [items]);

  const statusOptions = useMemo(() => {
    if (activeTab === "active") {
      return [
        { value: "all", label: "Tất cả trạng thái" },
        { value: "in_stock", label: "Sẵn hàng" },
        { value: "incoming", label: "Đang về" },
      ];
    } else if (activeTab === "defective") {
      return [
        { value: "all", label: "Tất cả trạng thái lỗi" },
        { value: "defective", label: "Máy lỗi" },
        { value: "warranty_repair", label: "Đang sửa/BH" },
      ];
    } else {
      return [
        { value: "all", label: "Tất cả máy đã trả NCC" },
      ];
    }
  }, [activeTab]);

  const poStatusOptions = [
    { value: "all", label: "Tất cả trạng thái" },
    { value: "draft", label: "Bản nháp" },
    { value: "ordered", label: "Đã đặt hàng" },
    { value: "in_transit", label: "Đang vận chuyển" },
    { value: "partially_received", label: "Nhận một phần" },
    { value: "received", label: "Đã hoàn thành" },
    { value: "cancelled", label: "Đã hủy" },
  ];

  const poSupplierOptions = useMemo(() => {
    const uniqueSuppliers = Array.from(
      new Set(purchaseOrdersData?.purchaseOrders?.map((po: any) => po.supplierName).filter(Boolean) || [])
    ) as string[];
    return [
      { value: "all", label: "Tất cả nhà cung cấp" },
      ...uniqueSuppliers.map((sup) => ({ value: sup, label: sup })),
    ];
  }, [purchaseOrdersData]);

  const filteredItems = useMemo(() => {
    return items?.filter((item) => {
      const specs = item.productSpecs as { cpu?: string; ram?: string; ssd?: string; screen?: string } | null;
      const specsStr = specs ? `${specs.cpu || ""} ${specs.ram || ""} ${specs.ssd || ""} ${specs.screen || ""}`.toLowerCase() : "";

      const matchesSearch =
        item.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
        item.productName.toLowerCase().includes(search.toLowerCase()) ||
        specsStr.includes(search.toLowerCase());

      const matchesCategory = selectedCategory === "all" || item.categoryName === selectedCategory;
      const matchesBrand = selectedBrand === "all" || item.brandName === selectedBrand;
      
      let matchesStatus = false;
      if (activeTab === "active") {
        matchesStatus = selectedStatus === "all"
          ? (item.status !== "deleted" && item.status !== "sold" && item.status !== "defective" && item.status !== "warranty_repair" && item.status !== "returned")
          : item.status === selectedStatus;
      } else if (activeTab === "defective") {
        matchesStatus = selectedStatus === "all"
          ? (item.status === "defective" || item.status === "warranty_repair")
          : item.status === selectedStatus;
      } else if (activeTab === "returned") {
        matchesStatus = item.status === "returned";
      }

      return matchesSearch && matchesCategory && matchesBrand && matchesStatus;
    }) || [];
  }, [items, search, selectedCategory, selectedBrand, selectedStatus, activeTab]);

  const handleSelectAll = () => {
    if (!filteredItems) return;
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(item => item.id));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectedItems = items?.filter(item => selectedIds.includes(item.id)) || [];
  const hasIncomingSelected = selectedItems.some(item => item.status === 'incoming');

  const groupedItems = useMemo(() => {
    if (!filteredItems) return [];
    
    const groups: Record<string, {
      productId: string;
      productName: string;
      productSku: string | null;
      brandName: string;
      categoryName: string;
      productSpecs: any;
      inStockCount: number;
      incomingCount: number;
      totalCount: number;
      costPrices: number[];
      items: any[];
      supplierNames: string[];
    }> = {};

    for (const item of filteredItems) {
      const key = item.productId;
      if (!groups[key]) {
        groups[key] = {
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          brandName: item.brandName,
          categoryName: item.categoryName,
          productSpecs: item.productSpecs,
          inStockCount: 0,
          incomingCount: 0,
          totalCount: 0,
          costPrices: [],
          items: [],
          supplierNames: [],
        };
      }
      
      groups[key].items.push(item);
      groups[key].totalCount += 1;
      if (item.status === 'in_stock') {
        groups[key].inStockCount += 1;
      } else if (item.status === 'incoming') {
        groups[key].incomingCount += 1;
      }
      if (item.supplierName && !groups[key].supplierNames.includes(item.supplierName)) {
        groups[key].supplierNames.push(item.supplierName);
      }
      
      // Calculate true actual cost including PO allocation and accessory cost
      const costVal = Number(item.costPrice || 0);
      const accVal = Number(item.accessoryCost || 0);
      const shipVal = Number(item.shippingCost || 0);
      const taxVal = Number(item.taxImport || 0);
      const poCount = Number(item.poItemsCount || 0);
      
      const allocShip = poCount > 0 ? shipVal / poCount : 0;
      const allocTax = poCount > 0 ? taxVal / poCount : 0;
      const totalCost = costVal + allocShip + allocTax + accVal;
      
      groups[key].costPrices.push(totalCost);
    }

    return Object.values(groups);
  }, [filteredItems]);

  const activeDrawerProductFromList = useMemo(() => {
    return groupedItems.find((g) => g.productId === activeDrawerProductId) || null;
  }, [groupedItems, activeDrawerProductId]);

  const [cachedDrawerProduct, setCachedDrawerProduct] = useState<any>(null);

  useEffect(() => {
    if (activeDrawerProductId === null) {
      setCachedDrawerProduct(null);
    } else if (activeDrawerProductFromList) {
      setCachedDrawerProduct(activeDrawerProductFromList);
    }
  }, [activeDrawerProductFromList, activeDrawerProductId]);

  const activeDrawerProduct = activeDrawerProductFromList || cachedDrawerProduct;

  return (
    <div className="space-y-8">
      {/* Header section - Photography-first presentation, clean, spacious */}
      {/* Header section - Premium 2-row presentation, clean, spacious */}
      <div className="space-y-6 pb-6 border-b border-[#e0e0e0]">
        {/* Row 1: Title & Tabs & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-[40px] font-semibold tracking-tight leading-[1.10] bg-clip-text text-transparent select-none shrink-0" style={{ backgroundImage: "linear-gradient(90deg, #2997ff, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Kho hàng
          </h1>
          
          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
            {/* Premium Apple-Style Segmented Control (Matching Quotations Tab Style) */}
            <div className="flex bg-[#f5f5f7] p-[3px] rounded-full text-[12.5px] border border-[#e0e0e0] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.03)] gap-1 select-none">
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={`px-4.5 py-1.5 rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
                  activeTab === "active"
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]"
                    : "text-slate-600 hover:text-slate-900 font-semibold"
                }`}
              >
                <span>Kho bán</span>
                {(items?.filter((i) => i.status === "in_stock" || i.status === "incoming").length || 0) > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full leading-none transition-all duration-200 ${
                    activeTab === "active" 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "bg-[#0066cc] text-white shadow-[0_1px_3px_rgba(0,102,204,0.25)]"
                  }`}>
                    {items?.filter((i) => i.status === "in_stock" || i.status === "incoming").length || 0}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("defective")}
                className={`px-4.5 py-1.5 rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
                  activeTab === "defective"
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]"
                    : "text-slate-600 hover:text-slate-900 font-semibold"
                }`}
              >
                <span>Kho lỗi</span>
                {(items?.filter((i) => i.status === "defective" || i.status === "warranty_repair").length || 0) > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full leading-none transition-all duration-200 ${
                    activeTab === "defective" 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "bg-[#ff3b30] text-white shadow-[0_1px_3px_rgba(255,59,48,0.25)]"
                  }`}>
                    {items?.filter((i) => i.status === "defective" || i.status === "warranty_repair").length || 0}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("returned")}
                className={`px-4.5 py-1.5 rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
                  activeTab === "returned"
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]"
                    : "text-slate-600 hover:text-slate-900 font-semibold"
                }`}
              >
                <span>Đã trả NCC</span>
                {(items?.filter((i) => i.status === "returned").length || 0) > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full leading-none transition-all duration-200 ${
                    activeTab === "returned" 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "bg-slate-500 text-white shadow-[0_1px_3px_rgba(100,116,139,0.25)]"
                  }`}>
                    {items?.filter((i) => i.status === "returned").length || 0}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("purchase_orders")}
                className={`px-4.5 py-1.5 rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
                  activeTab === "purchase_orders"
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]"
                    : "text-slate-600 hover:text-slate-900 font-semibold"
                }`}
              >
                <span>Phiếu nhập hàng</span>
                {purchaseOrdersData?.purchaseOrders && purchaseOrdersData.purchaseOrders.length > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full leading-none transition-all duration-200 ${
                    activeTab === "purchase_orders" 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "bg-[#0066cc] text-white shadow-[0_1px_3px_rgba(0,102,204,0.25)]"
                  }`}>
                    {purchaseOrdersData.purchaseOrders.length}
                  </span>
                )}
              </button>
            </div>

            {/* Nhập kho Button */}
            <button 
              onClick={handleOpenCreateDialog}
              className="flex items-center gap-1.5 px-4 h-[34px] bg-[#0066cc] text-white text-[12.5px] font-semibold rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0"
            >
              <SFSymbolPlus size={13} />
              <span>Nhập kho</span>
            </button>
          </div>
        </div>

        {/* Row 2: Dropdown Filters & Search & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Category Filter */}
          {activeTab !== "purchase_orders" && (
            <div className="w-full sm:w-40">
              <CustomSelect
                options={categoryOptions}
                value={selectedCategory}
                onChange={setSelectedCategory}
                size="sm"
                rounded="full"
                dropdownWidth="full"
              />
            </div>
          )}

          {/* Brand Filter */}
          {activeTab !== "purchase_orders" && (
            <div className="w-full sm:w-44">
              <CustomSelect
                options={brandOptions}
                value={selectedBrand}
                onChange={setSelectedBrand}
                size="sm"
                rounded="full"
                dropdownWidth="full"
              />
            </div>
          )}

          {/* Status Filter */}
          {activeTab !== "purchase_orders" && (
            <div className="w-full sm:w-40">
              <CustomSelect
                options={statusOptions}
                value={selectedStatus}
                onChange={setSelectedStatus}
                size="sm"
                rounded="full"
                dropdownWidth="full"
              />
            </div>
          )}

          {/* Purchase Order Status Filter */}
          {activeTab === "purchase_orders" && (
            <div className="w-full sm:w-44">
              <CustomSelect
                options={poStatusOptions}
                value={selectedPoStatus}
                onChange={setSelectedPoStatus}
                size="sm"
                rounded="full"
                dropdownWidth="full"
              />
            </div>
          )}

          {/* Purchase Order Supplier Filter */}
          {activeTab === "purchase_orders" && (
            <div className="w-full sm:w-48">
              <CustomSelect
                options={poSupplierOptions}
                value={selectedPoSupplier}
                onChange={setSelectedPoSupplier}
                size="sm"
                rounded="full"
                dropdownWidth="full"
              />
            </div>
          )}

          {/* Search Input */}
          <div className="relative w-full sm:w-48 shrink-0">
            <SFSymbolMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
            <input 
              type="text" 
              placeholder={activeTab === "purchase_orders" ? "Tìm số đơn, nhà cung cấp..." : "Tìm sản phẩm"} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>

          {/* Reset Button */}
          {((activeTab !== "purchase_orders" && (selectedCategory !== "all" || selectedBrand !== "all" || selectedStatus !== "all" || search !== "")) ||
            (activeTab === "purchase_orders" && (selectedPoStatus !== "all" || selectedPoSupplier !== "all" || search !== ""))) && (
            <button
              onClick={() => {
                if (activeTab === "purchase_orders") {
                  setSelectedPoStatus("all");
                  setSelectedPoSupplier("all");
                } else {
                  setSelectedCategory("all");
                  setSelectedBrand("all");
                  setSelectedStatus("all");
                }
                setSearch("");
              }}
              className="h-[40px] w-[40px] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 duration-200"
              title="Đặt lại bộ lọc"
            >
              <SFSymbolArrowClockwise size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards - Premium Apple Shortcuts style */}
      {activeTab === "active" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Tổng sản phẩm */}
          <div 
            onClick={() => setSelectedStatus("all")}
            className={`group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 cursor-pointer select-none active:scale-[0.97] border border-white/10 ${
              selectedStatus === "all"
                ? "bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] shadow-[0_10px_25px_rgba(0,102,204,0.3)] opacity-100 scale-100 ring-2 ring-[#0066cc]/40 ring-offset-2 ring-offset-white"
                : "bg-gradient-to-br from-[#2ea1ff]/90 to-[#0066cc]/90 shadow-[0_4px_12px_rgba(0,0,0,0.05)] opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(0,102,204,0.15)]"
            }`}
          >
            {/* Top Row with Label and Icon */}
            <div className="relative z-20 flex justify-between items-start">
              <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
                Tổng sản phẩm
              </span>
              <div className="relative w-8 h-8 shrink-0">
                {/* Main Icon */}
                <div className="absolute inset-0 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:opacity-0 group-hover:scale-75 transition-all duration-200">
                  <SFSymbolShippingBox size={16} />
                </div>
                {/* Play Icon on Hover */}
                <div className="absolute inset-0 rounded-[9px] bg-white/35 flex items-center justify-center text-white backdrop-blur-md border border-white/10 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 shadow-sm">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Bottom Value */}
            <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
              {items?.filter((i) => i.status !== "deleted" && i.status !== "sold" && i.status !== "returned").length || 0}
            </div>
            {/* Gloss shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>

          {/* Card 2: Đang sẵn hàng */}
          <div 
            onClick={() => setSelectedStatus("in_stock")}
            className={`group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 cursor-pointer select-none active:scale-[0.97] border border-white/10 ${
              selectedStatus === "in_stock"
                ? "bg-gradient-to-br from-[#34c759] to-[#28a745] shadow-[0_10px_25px_rgba(52,199,89,0.3)] opacity-100 scale-100 ring-2 ring-[#34c759]/40 ring-offset-2 ring-offset-white"
                : "bg-gradient-to-br from-[#34c759]/90 to-[#28a745]/90 shadow-[0_4px_12px_rgba(0,0,0,0.05)] opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(52,199,89,0.15)]"
            }`}
          >
            {/* Top Row with Label and Icon */}
            <div className="relative z-20 flex justify-between items-start">
              <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
                Đang sẵn hàng
              </span>
              <div className="relative w-8 h-8 shrink-0">
                {/* Main Icon */}
                <div className="absolute inset-0 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:opacity-0 group-hover:scale-75 transition-all duration-200">
                  <SFSymbolLaptopComputer size={16} />
                </div>
                {/* Play Icon on Hover */}
                <div className="absolute inset-0 rounded-[9px] bg-white/35 flex items-center justify-center text-white backdrop-blur-md border border-white/10 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 shadow-sm">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Bottom Value */}
            <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
              {items?.filter((i) => i.status === "in_stock").length || 0}
            </div>
            {/* Gloss shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>

          {/* Card 3: Đang về */}
          <div 
            onClick={() => setSelectedStatus("incoming")}
            className={`group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 cursor-pointer select-none active:scale-[0.97] border border-white/10 ${
              selectedStatus === "incoming"
                ? "bg-gradient-to-br from-[#ff9f0a] to-[#ff7b00] shadow-[0_10px_25px_rgba(255,159,10,0.3)] opacity-100 scale-100 ring-2 ring-[#ff9f0a]/40 ring-offset-2 ring-offset-white"
                : "bg-gradient-to-br from-[#ff9f0a]/90 to-[#ff7b00]/90 shadow-[0_4px_12px_rgba(0,0,0,0.05)] opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(255,159,10,0.15)]"
            }`}
          >
            {/* Top Row with Label and Icon */}
            <div className="relative z-20 flex justify-between items-start">
              <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
                Đang về
              </span>
              <div className="relative w-8 h-8 shrink-0">
                {/* Main Icon */}
                <div className="absolute inset-0 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:opacity-0 group-hover:scale-75 transition-all duration-200">
                  <SFSymbolTruck size={16} />
                </div>
                {/* Play Icon on Hover */}
                <div className="absolute inset-0 rounded-[9px] bg-white/35 flex items-center justify-center text-white backdrop-blur-md border border-white/10 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 shadow-sm">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Bottom Value */}
            <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
              {items?.filter((i) => i.status === "incoming").length || 0}
            </div>
            {/* Gloss shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>

          {/* Card 4: Đang bị lỗi */}
          <div 
            onClick={() => {
              setActiveTab("defective");
              setSelectedStatus("all");
            }}
            className="group relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#ff2d55] to-[#d6001c] p-5 h-[120px] flex flex-col justify-between shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_rgba(255,45,85,0.15)] hover:scale-[1.02] transition-all duration-300 cursor-pointer select-none active:scale-[0.97] border border-white/10 opacity-80 hover:opacity-100"
          >
            {/* Top Row with Label and Icon */}
            <div className="relative z-20 flex justify-between items-start">
              <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
                Đang bị lỗi
              </span>
              <div className="relative w-8 h-8 shrink-0">
                {/* Main Icon */}
                <div className="absolute inset-0 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:opacity-0 group-hover:scale-75 transition-all duration-200">
                  <SFSymbolExclamationTriangle size={16} />
                </div>
                {/* Play Icon on Hover */}
                <div className="absolute inset-0 rounded-[9px] bg-white/35 flex items-center justify-center text-white backdrop-blur-md border border-white/10 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 shadow-sm">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Bottom Value */}
            <div className="relative z-20 text-[28px] font-black text-white tracking-tight leading-none tabular-nums mt-auto">
              {items?.filter((i) => i.status === "defective" || i.status === "warranty_repair").length || 0}
            </div>
            {/* Gloss shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
        </div>
      )}


      {/* Smart Model Summary Header */}
      <div className="flex items-center justify-between text-[13px] text-[#7a7a7a] font-medium px-1">
        {activeTab === "active" ? (
          <>
            <div>Đang quản lý <span className="font-bold text-[#1d1d1f]">{groupedItems.length}</span> cấu hình sản phẩm khác nhau.</div>
            <div>Tổng tồn trong kho: <span className="font-bold text-[#0066cc]">{items?.filter(i => i.status === "in_stock").length || 0}</span> máy.</div>
          </>
        ) : activeTab === "defective" ? (
          <>
            <div>Có <span className="font-bold text-[#1d1d1f]">{groupedItems.length}</span> cấu hình sản phẩm đang có thiết bị lỗi.</div>
            <div>Tổng máy lỗi/đang sửa: <span className="font-bold text-red-500">{items?.filter(i => i.status === "defective" || i.status === "warranty_repair").length || 0}</span> máy.</div>
          </>
        ) : (
          <>
            <div>Có <span className="font-bold text-[#1d1d1f]">{groupedItems.length}</span> cấu hình sản phẩm đã trả nhà cung cấp.</div>
            <div>Tổng máy đã trả NCC: <span className="font-bold text-slate-500">{items?.filter(i => i.status === "returned").length || 0}</span> máy.</div>
          </>
        )}
      </div>

      {/* 4. Main Data Card - Crisp Apple store card layout */}
      <GlassCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-[#7a7a7a]">
            <SFSymbolArrowClockwise className="animate-spin mb-4 text-[#0066cc]" size={24} />
            <p className="text-[17px]">Đang truy xuất kho...</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-[#b91c1c] text-[17px]">
            Đã xảy ra lỗi khi kết nối database. Vui lòng thử lại.
          </div>
        ) : activeTab === "purchase_orders" ? (
          filteredPurchaseOrders.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-[#f5f5f7] rounded-full border border-[#e0e0e0] flex items-center justify-center mb-6 text-[#7a7a7a]">
                <SFSymbolShippingBox size={24} />
              </div>
              <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-2">
                Không tìm thấy đơn nhập hàng nào
              </h3>
              <p className="text-[17px] text-[#7a7a7a] mb-8 max-w-md leading-[1.47]">
                Hệ thống chưa ghi nhận đơn nhập hàng (Purchase Order) nào phù hợp với tìm kiếm của bạn.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0 border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                    <th className="px-6 py-3 w-16 text-center border-b border-[#e0e0e0] whitespace-nowrap">STT</th>
                    <th className="px-6 py-3 border-b border-[#e0e0e0] whitespace-nowrap">Mã Đơn Nhập (PO)</th>
                    <th className="px-6 py-3 border-b border-[#e0e0e0] whitespace-nowrap">Nhà cung cấp (NCC)</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Số lượng máy</th>
                    <th className="px-6 py-3 text-right border-b border-[#e0e0e0] whitespace-nowrap">Tổng tiền hàng</th>
                    <th className="px-6 py-3 text-right border-b border-[#e0e0e0] whitespace-nowrap">Phí VC & Thuế</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Trạng thái</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="text-[16px] text-[#1d1d1f]">
                  {filteredPurchaseOrders.map((po: any, index: number) => {
                    const isLast = index === filteredPurchaseOrders.length - 1;
                    const poStatusConfig: Record<string, { color: string; label: string }> = {
                      draft: { color: "text-slate-500", label: "Nháp" },
                      ordered: { color: "text-amber-600", label: "Đã đặt hàng" },
                      in_transit: { color: "text-blue-600", label: "Đang vận chuyển" },
                      partially_received: { color: "text-indigo-600", label: "Nhận một phần" },
                      received: { color: "text-emerald-600", label: "Đã hoàn thành" },
                      cancelled: { color: "text-red-600", label: "Đã hủy" },
                    };
                    const statusInfo = poStatusConfig[po.status] || { color: "text-slate-800", label: po.status };
                    const shippingVal = Number(po.shippingCost || 0);
                    const taxVal = Number(po.taxImport || 0);
                    const addCost = shippingVal + taxVal;

                    return (
                      <tr 
                        key={po.id} 
                        className="group cursor-pointer"
                        onClick={() => setSelectedPoId(po.id)}
                      >
                        <td className={`px-6 py-3 text-center font-semibold text-[#7a7a7a] text-[14px] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          {index + 1}
                        </td>
                        <td className={`px-6 py-3 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          <span className="font-bold text-[#0066cc] group-hover:underline">
                            {po.poNumber}
                          </span>
                        </td>
                        <td className={`px-6 py-3 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          <span className="font-semibold text-[#1d1d1f]">
                            {po.supplierName || "N/A"}
                          </span>
                        </td>
                        <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          <span className="text-[14px] font-semibold text-slate-700">
                            {po.totalItemsCount} máy
                          </span>
                        </td>
                        <td className={`px-6 py-3 text-right font-bold text-[#1d1d1f] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          {formatPrice(po.totalCost)}
                        </td>
                        <td className={`px-6 py-3 text-right font-medium text-slate-600 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          {addCost > 0 ? (
                            <div className="flex flex-col items-end">
                              <span>{formatPrice(addCost.toFixed(2))}</span>
                              <span className="text-[11px] text-[#7a7a7a]">VC: {formatPrice(po.shippingCost)} • Thuế: {formatPrice(po.taxImport)}</span>
                            </div>
                          ) : (
                            <span className="text-[#7a7a7a]">—</span>
                          )}
                        </td>
                        <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          <span className={`text-[13px] font-semibold ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className={`px-6 py-3 text-center text-[#7a7a7a] font-medium ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          {formatToDDMMYYYY(po.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : filteredItems?.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-[#f5f5f7] rounded-full border border-[#e0e0e0] flex items-center justify-center mb-6 text-[#7a7a7a]">
              <SFSymbolShippingBox size={24} />
            </div>
            <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-2">
              {activeTab === "active" 
                ? "Kho hàng chưa có máy" 
                : activeTab === "defective"
                ? "Không tìm thấy máy lỗi nào"
                : "Không tìm thấy máy nào đã trả NCC"}
            </h3>
            <p className="text-[17px] text-[#7a7a7a] mb-8 max-w-md leading-[1.47]">
              {activeTab === "active"
                ? "Hệ thống chưa ghi nhận chiếc máy nào bằng Serial cụ thể. Hãy bấm nút nhập kho bên dưới để bắt đầu thêm sản phẩm mới."
                : activeTab === "defective"
                ? "Chúc mừng! Hiện tại kho hàng hoạt động tốt và không ghi nhận máy nào bị lỗi hoặc đang bảo hành."
                : "Hệ thống chưa ghi nhận chiếc máy nào đã xuất trả nhà cung cấp (NCC)."}
            </p>
            {activeTab === "active" && (
              <button 
                onClick={handleOpenCreateDialog}
                className="flex items-center gap-2 px-6 h-[44px] bg-[#0066cc] text-white text-[14px] font-normal rounded-full hover:bg-[#0071e3] transition-all cursor-pointer active:scale-95 duration-200"
              >
                <SFSymbolPlus size={16} />
                <span>Nhập kho ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0 border-collapse">
              <thead>
                <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                  <th className="px-6 py-3 w-16 text-center border-b border-[#e0e0e0] whitespace-nowrap">STT</th>
                  <th className="px-6 py-3 border-b border-[#e0e0e0] whitespace-nowrap">Model Sản phẩm</th>
                  {activeTab === "returned" && (
                    <th className="px-6 py-3 border-b border-[#e0e0e0] whitespace-nowrap">Nhà cung cấp</th>
                  )}
                  <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">
                    {activeTab === "active" ? "Sẵn kho" : activeTab === "defective" ? "Lỗi (Kho)" : "Đã trả NCC"}
                  </th>
                  <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">
                    {activeTab === "active" ? "Đang về" : activeTab === "defective" ? "Đang sửa / BH" : "Trạng thái"}
                  </th>
                  <th className="px-6 py-3 text-right border-b border-[#e0e0e0] whitespace-nowrap">Giá vốn trung bình</th>
                </tr>
              </thead>
              <tbody className="text-[16px] text-[#1d1d1f]">
                {groupedItems.map((group, index) => {
                  const avgCost = group.costPrices.reduce((a, b) => a + b, 0) / (group.costPrices.length || 1);
                  const isLast = index === groupedItems.length - 1;
                  return (
                    <tr 
                      key={group.productId} 
                      className="group cursor-pointer"
                      onClick={() => setActiveDrawerProductId(group.productId)}
                    >
                      <td className={`px-6 py-3 text-center font-semibold text-[#7a7a7a] text-[14px] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {index + 1}
                      </td>
                      <td className={`px-6 py-3 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold text-[#1d1d1f] tracking-tight group-hover:text-[#0066cc] transition-colors duration-200">{group.productName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[12px] text-[#7a7a7a] font-normal">{group.brandName} • {group.categoryName}</span>
                              {group.productSpecs && (
                                <>
                                  <span className="text-[11px] text-[#e0e0e0]">•</span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-[#f5f5f7] text-[#1d1d1f] border border-[#e0e0e0]/60 group-hover:bg-white group-hover:border-[#0066cc]/20 transition-colors duration-200">
                                    {((specs: any) => {
                                      const parts = [];
                                      if (specs.cpu) parts.push(specs.cpu);
                                      if (specs.ram) parts.push(`RAM ${specs.ram}`);
                                      if (specs.ssd) parts.push(`SSD ${specs.ssd}`);
                                      if (specs.screen) parts.push(specs.screen);
                                      return parts.join(" • ") || "Chưa cấu hình";
                                    })(group.productSpecs)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {activeTab === "returned" && (
                        <td className={`px-6 py-3 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          {group.supplierNames && group.supplierNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {group.supplierNames.map((name) => (
                                <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#7a7a7a] text-[13px]">N/A</span>
                          )}
                        </td>
                      )}
                      <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {activeTab === "active" ? (
                          <span className="text-[13px] font-semibold text-emerald-600">
                            {group.inStockCount} máy
                          </span>
                        ) : activeTab === "defective" ? (
                          <span className="text-[13px] font-semibold text-red-600">
                            {group.items.filter((i: any) => i.status === 'defective').length} máy
                          </span>
                        ) : (
                          <span className="text-[13px] font-semibold text-slate-600">
                            {group.items.filter((i: any) => i.status === 'returned').length} máy
                          </span>
                        )}
                      </td>
                      <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {activeTab === "active" ? (
                          <span className="text-[13px] font-semibold text-amber-600">
                            {group.incomingCount} máy
                          </span>
                        ) : activeTab === "defective" ? (
                          <span className="text-[13px] font-semibold text-[#0066cc]">
                            {group.items.filter((i: any) => i.status === 'warranty_repair').length} máy
                          </span>
                        ) : (
                          <span className="text-[13px] font-semibold text-orange-600">
                            Đã trả
                          </span>
                        )}
                      </td>
                      <td className={`px-6 py-3 text-right font-semibold text-[#1d1d1f] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {formatPrice(avgCost.toFixed(2))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* 5. Giao diện Modal bảng chi tiết cấu hình và danh sách Serials - Centered & Portal UI/UX */}
      {mounted && activeDrawerProduct && createPortal(
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-[8px] z-40 transition-opacity duration-300 animate-in fade-in"
            onClick={() => setActiveDrawerProductId(null)}
          />
          
          {/* Responsive Modal / Bottom Sheet Wrapper */}
          <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 pointer-events-none p-0 sm:p-6">
            <div className="w-full max-w-7xl bg-white rounded-t-[32px] sm:rounded-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.12),0_12px_50px_rgba(0,0,0,0.18)] border-t sm:border border-[#e0e0e0]/80 overflow-hidden transform transition-all flex flex-col max-h-[94vh] sm:max-h-[88vh] pointer-events-auto animate-in slide-in-from-bottom sm:slide-in-from-none sm:zoom-in-95 duration-300 ease-out">
              
              {/* Mobile drag handle indicator */}
              <div className="w-full flex justify-center py-3.5 sm:hidden shrink-0 bg-[#f5f5f7]/55 border-b border-[#e0e0e0]/40">
                <div className="w-12 h-1.5 rounded-full bg-[#d2d2d7]" />
              </div>

              {/* Modal Header - Clean Apple Style */}
              <div className="px-8 py-6 border-b border-[#e0e0e0] bg-[#f5f5f7]/50 flex items-start justify-between">
                <div className="space-y-2">
                  <h2 className="text-[23px] font-bold text-[#1d1d1f] leading-snug tracking-tight">
                    {activeDrawerProduct.productName}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] text-[#7a7a7a] font-medium">
                      {activeDrawerProduct.brandName} • {activeDrawerProduct.categoryName}
                    </span>
                    {activeDrawerProduct.productSku && (
                      <span className="text-[12px] text-[#7a7a7a] bg-[#f5f5f7] border border-[#e0e0e0] px-2 py-0.5 rounded-md">
                        SKU: {activeDrawerProduct.productSku}
                      </span>
                    )}
                  </div>
                  {activeDrawerProduct.productSpecs && (
                    <div className="flex items-center gap-4 text-[13.5px] text-[#1d1d1f] mt-1.5">
                      {activeDrawerProduct.productSpecs.cpu && (
                        <span className="flex items-center gap-1.5">
                          <SFSymbolCPU size={13} className="text-[#0066cc]" /> {activeDrawerProduct.productSpecs.cpu}
                        </span>
                      )}
                      {activeDrawerProduct.productSpecs.ram && (
                        <span className="flex items-center gap-1.5">
                          <SFSymbolMemoryChip size={13} className="text-[#0066cc]" /> {activeDrawerProduct.productSpecs.ram}
                        </span>
                      )}
                      {activeDrawerProduct.productSpecs.ssd && (
                        <span className="flex items-center gap-1.5">
                          <SFSymbolInternalDrive size={13} className="text-[#0066cc]" /> {activeDrawerProduct.productSpecs.ssd}
                        </span>
                      )}
                      {activeDrawerProduct.productSpecs.screen && (
                        <span className="flex items-center gap-1.5">
                          <SFSymbolDisplay size={13} className="text-[#0066cc]" /> {activeDrawerProduct.productSpecs.screen}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => setActiveDrawerProductId(null)}
                  className="w-9 h-9 text-[15px] rounded-full flex items-center justify-center bg-[#e8e8ed] text-[#7a7a7a] hover:text-[#1d1d1f] hover:bg-[#d5d5da] cursor-pointer transition-colors active:scale-95 duration-200 shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Quick Stats - Simple inline */}
              {activeTab === "active" && (
                <div className="flex items-center gap-8 px-8 py-4 border-b border-[#e0e0e0] bg-white">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[14.5px] text-[#7a7a7a] font-medium">Sẵn kho</span>
                    <span className="text-[17px] font-bold text-emerald-600">{activeDrawerProduct.inStockCount}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-[14.5px] text-[#7a7a7a] font-medium">Đang về</span>
                    <span className="text-[17px] font-bold text-amber-600">{activeDrawerProduct.incomingCount}</span>
                  </div>
                </div>
              )}

              {/* Serials Scrollable List - Concept 2: iOS-style Interactive List */}
              <div className="flex-1 overflow-y-auto p-8 bg-white max-h-[58vh]">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[14.5px] font-bold text-[#7a7a7a] uppercase tracking-wider">
                    Danh Sách Máy Lẻ ({activeDrawerProduct.items.length})
                  </h3>
                  {activeDrawerProduct.items.filter((item: any) => item.status === 'incoming').length > 0 ? (
                    <button
                      onClick={() => {
                        const ids = activeDrawerProduct.items
                          .filter((item: any) => item.status === 'incoming')
                          .map((item: any) => item.id);
                        bulkConfirmMutation.mutate(ids);
                      }}
                      disabled={bulkConfirmMutation.isPending}
                      className="flex items-center gap-1.5 px-4 h-[34px] bg-[#0066cc]/10 hover:bg-[#0066cc]/20 disabled:opacity-50 text-[#0066cc] text-[13.5px] font-semibold rounded-full border border-[#0066cc]/15 transition-all cursor-pointer active:scale-95 duration-200"
                    >
                      <span>Nhận về kho tất cả ({activeDrawerProduct.items.filter((item: any) => item.status === 'incoming').length} máy)</span>
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#7a7a7a] font-medium">
                      Chọn số Serial để xem lịch sử thẻ kho
                    </span>
                  )}
                </div>
                
                <div className="border border-[#e0e0e0] rounded-2xl overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[980px]">
                      <thead>
                        <tr className="bg-[#f5f5f7] border-b border-[#e0e0e0] text-[#7a7a7a] font-bold uppercase text-[12px] tracking-wider whitespace-nowrap">
                          <th className="px-5 py-3 w-14 text-center whitespace-nowrap">STT</th>
                          <th className="px-5 py-3 whitespace-nowrap">Mã Serial</th>
                          <th className="px-5 py-3 whitespace-nowrap">Đơn nhập</th>
                          <th className="px-5 py-3 whitespace-nowrap">Nhà cung cấp (NCC)</th>
                          <th className="px-5 py-3 whitespace-nowrap">Trạng thái</th>
                          <th className="px-5 py-3 whitespace-nowrap">Ngày nhập</th>
                          <th className="px-5 py-3 text-right whitespace-nowrap">Chi phí vốn</th>
                          <th className="px-5 py-3 text-center w-[210px] whitespace-nowrap">Tác vụ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e0e0e0] text-[14.5px] text-[#1d1d1f]">
                        {activeDrawerProduct.items.map((item: any, idx: number) => (
                          <tr key={item.id} className="hover:bg-[#f5f5f7]/40 transition-colors">
                            {/* STT */}
                            <td className="px-5 py-3 text-center text-[#7a7a7a] font-semibold text-[13.5px] whitespace-nowrap">
                              {idx + 1}
                            </td>

                            {/* Mã Serial & Sub-details */}
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span 
                                  onClick={() => handleOpenDetails(item)}
                                  className={`text-[15px] font-semibold cursor-pointer transition-colors ${
                                    item.serialNumber.startsWith("SN-PENDING-")
                                      ? "text-amber-600 hover:text-amber-700"
                                      : "text-[#1d1d1f] hover:text-[#0066cc]"
                                  }`}
                                >
                                  {item.serialNumber.startsWith("SN-PENDING-") ? "Chờ cập nhật" : item.serialNumber}
                                </span>
                                {item.condition && (
                                  <span className="text-[11.5px] text-[#7a7a7a] mt-0.5">
                                    {item.condition === 'new' ? 'Mới 100%' : 'Like New 99%'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Đơn nhập & Vận chuyển */}
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                {item.poNumber ? (
                                  <button 
                                    onClick={() => {
                                      setSelectedPoId(item.purchaseOrderId);
                                    }}
                                    className="text-[13.5px] font-semibold text-[#0066cc] hover:underline text-left cursor-pointer transition-all"
                                    title="Xem chi tiết đơn nhập hàng"
                                  >
                                    {item.poNumber}
                                  </button>
                                ) : (
                                  <span className="text-[13px] text-[#7a7a7a] font-medium">—</span>
                                )}
                                {(item.trackingNumber || item.shippingMethod) && (
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {item.shippingMethod && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#7a7a7a] bg-[#f5f5f7] border border-[#e0e0e0] px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                        {item.shippingMethod}
                                      </span>
                                    )}
                                    {item.trackingNumber && (
                                      item.trackingUrl ? (
                                        <a 
                                          href={item.trackingUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc]/10 px-1.5 py-0.5 rounded-md hover:underline whitespace-nowrap"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {item.trackingNumber} ↗
                                        </a>
                                      ) : (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#7a7a7a] bg-[#f5f5f7] border border-[#e0e0e0] px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                          {item.trackingNumber}
                                        </span>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Nhà cung cấp */}
                            <td className="px-5 py-3 whitespace-nowrap">
                              {item.supplierName ? (
                                <span className="text-[13.5px] font-semibold text-slate-700">
                                  {item.supplierName}
                                </span>
                              ) : (
                                <span className="text-[13px] text-[#7a7a7a] font-medium">—</span>
                              )}
                            </td>

                            {/* Trạng thái */}
                            <td className="px-5 py-3 whitespace-nowrap">
                              <StatusBadge status={item.status} className="text-[14px]" />
                            </td>

                            {/* Ngày nhập */}
                            <td className="px-5 py-3 text-[#7a7a7a] font-medium whitespace-nowrap">
                              {formatToDDMMYYYY(item.stockedDate)}
                            </td>

                            {/* Chi phí vốn thực tế */}
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              {(() => {
                                const costVal = Number(item.costPrice || 0);
                                const accVal = Number(item.accessoryCost || 0);
                                const shipVal = Number(item.shippingCost || 0);
                                const taxVal = Number(item.taxImport || 0);
                                const poCount = Number(item.poItemsCount || 0);
                                
                                const allocShip = poCount > 0 ? shipVal / poCount : 0;
                                const allocTax = poCount > 0 ? taxVal / poCount : 0;
                                const totalCost = costVal + allocShip + allocTax + accVal;
                                
                                const hasAdd = allocShip > 0 || allocTax > 0 || accVal > 0;
                                
                                return (
                                  <div className="relative group/cost flex flex-col items-end">
                                    <span className="font-extrabold text-[#1d1d1f] hover:text-[#0066cc] cursor-help text-[15px]">
                                      {formatPrice(totalCost.toFixed(2))}
                                    </span>
                                    {hasAdd && (
                                      <span className="text-[11.5px] text-[#7a7a7a] font-normal mt-0.5">
                                        Gốc: {formatPrice(item.costPrice)}
                                      </span>
                                    )}
                                    
                                    {/* Tooltip on hover */}
                                    {hasAdd && (
                                      <div className="absolute right-0 bottom-full mb-2 hidden group-hover/cost:block bg-white border border-[#e0e0e0] rounded-2xl shadow-xl p-4 w-72 z-50 text-[13px] text-left text-[#1d1d1f] font-normal pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                                        <div className="font-bold mb-2 pb-1.5 border-b border-[#e0e0e0] text-[#1d1d1f]">
                                          Chi tiết Phân rã giá vốn
                                        </div>
                                        <div className="space-y-1.5 font-medium">
                                          <div className="flex justify-between">
                                            <span className="text-[#7a7a7a]">Giá gốc NCC:</span>
                                            <span>{formatPrice(item.costPrice)}</span>
                                          </div>
                                          {allocShip > 0 && (
                                            <div className="flex justify-between text-emerald-600">
                                              <span className="text-[#7a7a7a]">Phí VC phân bổ:</span>
                                              <span>+{formatPrice(allocShip.toFixed(2))}</span>
                                            </div>
                                          )}
                                          {allocTax > 0 && (
                                            <div className="flex justify-between text-emerald-600">
                                              <span className="text-[#7a7a7a]">Thuế NK phân bổ:</span>
                                              <span>+{formatPrice(allocTax.toFixed(2))}</span>
                                            </div>
                                          )}
                                          {accVal > 0 && (
                                            <div className="flex justify-between text-emerald-600">
                                              <span className="text-[#7a7a7a]">Mua sạc/phụ kiện:</span>
                                              <span>+{formatPrice(item.accessoryCost)}</span>
                                            </div>
                                          )}
                                          {item.accessoryNotes && (
                                            <div className="mt-2 pt-1.5 border-t border-[#e0e0e0]/60 text-[11px] text-[#7a7a7a] italic">
                                              Ghi chú: {item.accessoryNotes}
                                            </div>
                                          )}
                                          <div className="pt-2 border-t border-[#e0e0e0] flex justify-between font-bold text-[#0066cc]">
                                            <span>Tổng giá vốn:</span>
                                            <span>{formatPrice(totalCost.toFixed(2))}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Tác vụ */}
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                {activeTab === "active" ? (
                                  <>
                                    {item.status === "in_stock" && (
                                      <div className="relative group/tooltip">
                                        <button
                                          onClick={() => {
                                            setDefectiveItem(item);
                                            setDefectiveActionType("report");
                                          }}
                                          className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-amber-50 border border-slate-200/50 hover:border-amber-200/80 text-slate-500 hover:text-amber-600 cursor-pointer transition-all duration-150 active:scale-95"
                                        >
                                          <SFSymbolExclamationTriangle size={14} />
                                        </button>
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                          Báo máy lỗi
                                        </span>
                                      </div>
                                    )}
                                    <div className="relative group/tooltip">
                                      <Link
                                        href={`/lookup?serial=${item.serialNumber}`}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-blue-50 border border-slate-200/50 hover:border-blue-200/80 text-slate-500 hover:text-[#0066cc] cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolActivity size={14} />
                                      </Link>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Lịch sử máy
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleOpenDetails(item)}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200/50 hover:border-slate-300 text-slate-500 hover:text-slate-800 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolEye size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Thông tin chi tiết
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleOpenEditDialog(item)}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200/50 hover:border-slate-300 text-slate-500 hover:text-slate-800 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolSquareAndPencil size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Sửa thông tin
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleDeleteClick(item)}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-slate-200/50 hover:border-red-200/80 text-slate-500 hover:text-red-600 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolTrash size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Xóa máy
                                      </span>
                                    </div>
                                  </>
                                ) : activeTab === "defective" ? (
                                  <>
                                    {item.status === "defective" && (
                                      <div className="relative group/tooltip">
                                        <button
                                          onClick={() => {
                                            setDefectiveItem(item);
                                            setDefectiveActionType("repair");
                                          }}
                                          className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-blue-50 border border-slate-200/50 hover:border-blue-200/80 text-slate-500 hover:text-[#0066cc] cursor-pointer transition-all duration-150 active:scale-95"
                                        >
                                          <SFSymbolWrench size={14} />
                                        </button>
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                          Gửi sửa / BH
                                        </span>
                                      </div>
                                    )}
                                    {item.status === "warranty_repair" && (
                                      <div className="relative group/tooltip">
                                        <button
                                          onClick={() => {
                                            setDefectiveItem(item);
                                            setDefectiveActionType("complete");
                                          }}
                                          className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-emerald-50 border border-slate-200/50 hover:border-emerald-200/80 text-slate-500 hover:text-emerald-600 cursor-pointer transition-all duration-150 active:scale-95"
                                        >
                                          <SFSymbolCheckmarkCircle size={14} />
                                        </button>
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                          Nhận về kho
                                        </span>
                                      </div>
                                    )}
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => {
                                          setDefectiveItem(item);
                                          setDefectiveActionType("refund");
                                        }}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-green-50 border border-slate-200/50 hover:border-green-200/80 text-slate-500 hover:text-green-600 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolDollarSign size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        NCC hoàn tiền
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => {
                                          setDefectiveItem(item);
                                          setDefectiveActionType("writeoff");
                                        }}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-purple-50 border border-slate-200/50 hover:border-purple-200/80 text-slate-500 hover:text-purple-600 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolArrowRightLeft size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        NCC đổi máy mới
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <Link
                                        href={`/lookup?serial=${item.serialNumber}`}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-blue-50 border border-slate-200/50 hover:border-blue-200/80 text-slate-500 hover:text-[#0066cc] cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolActivity size={14} />
                                      </Link>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Lịch sử máy
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleOpenDetails(item)}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200/50 hover:border-slate-300 text-slate-500 hover:text-slate-800 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolEye size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Thông tin chi tiết
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleDeleteClick(item)}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-slate-200/50 hover:border-red-200/80 text-slate-500 hover:text-red-600 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolTrash size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Xóa máy
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="relative group/tooltip">
                                      <Link
                                        href={`/lookup?serial=${item.serialNumber}`}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-blue-50 border border-slate-200/50 hover:border-blue-200/80 text-slate-500 hover:text-[#0066cc] cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolActivity size={14} />
                                      </Link>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Lịch sử máy
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleOpenDetails(item)}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200/50 hover:border-slate-300 text-slate-500 hover:text-slate-800 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolEye size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Thông tin chi tiết
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleDeleteClick(item)}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-slate-200/50 hover:border-red-200/80 text-slate-500 hover:text-red-600 cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolTrash size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Xóa máy
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-[#e0e0e0] bg-[#f5f5f7]/30 text-center">
                <span className="text-[13.5px] text-[#7a7a7a] font-medium">
                  Nhấp vào tiêu đề serial hoặc biểu tượng chi tiết để chỉnh sửa sản phẩm cụ thể.
                </span>
              </div>
              
            </div>
          </div>
        </>,
        document.body
      )}


      <Dialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)}
        title={editingItem ? "Sửa thông tin sản phẩm" : "Nhập kho mới"}
        description={editingItem ? `Chỉnh sửa thông tin cho ${editingItem.serialNumber}` : ""}
        size="2xl"
      >
        <InventoryForm 
          initialData={editingItem || undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => setIsDialogOpen(false)}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Dialog>

      <InventoryDetailDialog
        isOpen={!!selectedItemForDetails}
        onClose={() => setSelectedItemForDetails(null)}
        item={selectedItemForDetails}
      />



      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={itemToDelete?.status === "deleted" ? "Xác nhận xóa vĩnh viễn" : "Xác nhận xóa khỏi kho"}
        description={
          itemToDelete?.status === "deleted"
            ? `Bạn có chắc chắn muốn XÓA VĨNH VIỄN sản phẩm có Serial "${itemToDelete?.serialNumber}" khỏi cơ sở dữ liệu? Toàn bộ lịch sử thẻ kho liên quan cũng sẽ bị xóa sạch và KHÔNG THỂ HOÀN TÁC.`
            : `Bạn có chắc chắn muốn xóa sản phẩm có Serial "${itemToDelete?.serialNumber}" khỏi kho hàng hoạt động? Sản phẩm sẽ được đưa vào lưu trữ Đã xóa (Có thể khôi phục lại sau).`
        }
        confirmText={itemToDelete?.status === "deleted" ? "Xóa vĩnh viễn" : "Xóa lưu trữ"}
        cancelText="Hủy"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      <ConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        title="Xác nhận xóa hàng loạt"
        description={`Bạn có chắc chắn muốn xóa ${selectedIds.length} sản phẩm đã chọn khỏi kho hàng hoạt động? Các sản phẩm này sẽ được đưa vào lưu trữ Đã xóa (Có thể khôi phục lại sau).`}
        confirmText="Xóa hàng loạt"
        cancelText="Hủy"
        variant="danger"
        isLoading={bulkDeleteMutation.isPending}
      />

      <DefectiveActionsDialog
        isOpen={defectiveItem !== null}
        onClose={() => {
          setDefectiveItem(null);
          setDefectiveActionType(null);
        }}
        item={defectiveItem}
        actionType={defectiveActionType}
      />

      {/* 6. Giao diện Drawer chi tiết đơn nhập hàng PO */}
      {mounted && selectedPoId && createPortal(
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-[8px] z-40 transition-opacity duration-300 animate-in fade-in"
            onClick={() => setSelectedPoId(null)}
          />
          
          {/* Drawer Wrapper */}
          <div className="fixed inset-4 sm:inset-6 lg:inset-8 bg-[#f5f5f7] rounded-[24px] sm:rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.25)] border border-[#e0e0e0]/50 overflow-hidden transform transition-all flex flex-col z-50 pointer-events-auto animate-in fade-in zoom-in-95 duration-300 ease-out" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif', fontFeatureSettings: '"zero" off' }}>
            
            {isPoDetailLoading || (!poDetailData && !isPoDetailError) || (poDetailData && poDetailData.po?.id !== selectedPoId && !isPoDetailError && poDetailData.success !== false) ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#7a7a7a]">
                <SFSymbolArrowClockwise className="animate-spin mb-4 text-[#0066cc]" size={24} />
                <p className="text-[17px]">Đang tải chi tiết đơn nhập...</p>
              </div>
            ) : isPoDetailError || !poDetailData?.success || !poDetailData.po ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500 font-bold text-xl">
                  ✕
                </div>
                <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-2">Lỗi tải dữ liệu</h3>
                <p className="text-[17px] text-[#7a7a7a] mb-6 max-w-md leading-relaxed">
                  {poDetailData?.message || (poDetailError as any)?.message || "Không thể tải chi tiết đơn nhập hàng. Vui lòng thử lại."}
                </p>
                <button 
                  onClick={() => setSelectedPoId(null)}
                  className="px-6 h-[40px] bg-slate-100 hover:bg-slate-200 text-[#1d1d1f] font-semibold rounded-full transition-all active:scale-95 duration-200 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <>
                {/* 1. Header Card - Premium white card floating on gray bg */}
                <div className="mx-6 mt-5 mb-3 p-4 bg-white rounded-2xl border border-slate-200/50 shadow-sm flex items-start justify-between shrink-0">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h2 className="text-[20px] font-bold text-[#1d1d1f] leading-none tracking-[-0.02em]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>
                        Chi tiết Đơn nhập: {poDetailData.po.poNumber}
                      </h2>
                      {((status: string) => {
                          const mapping: Record<string, { label: string; bg: string; text: string; border: string }> = {
                            draft: { label: "Nháp", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200/60" },
                            ordered: { label: "Đã đặt hàng", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200/60" },
                            in_transit: { label: "Đang vận chuyển", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/60" },
                            partially_received: { label: "Nhận một phần", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200/60" },
                            received: { label: "Đã hoàn thành", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/60" },
                            cancelled: { label: "Đã hủy", bg: "bg-red-50", text: "text-red-600", border: "border-red-200/60" },
                          };
                          const cfg = mapping[status] || { label: status, bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200/60" };
                          if (status === "received") {
                            return (
                              <span className="text-[13px] font-bold text-emerald-600">
                                {cfg.label}
                              </span>
                            );
                          }
                          return (
                            <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                              {cfg.label}
                            </span>
                          );
                        })(poDetailData.po.status)}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#86868b] font-medium">
                      <div>
                        Nhà cung cấp: <span className="font-bold text-[#1d1d1f]">{poDetailData.po.supplierName || "N/A"}</span>
                      </div>
                      <span className="text-slate-200">|</span>
                      <div>
                        Quốc gia gửi: <span className="font-bold text-[#1d1d1f]">{poDetailData.po.originCountry || "VN"}</span>
                      </div>
                      <span className="text-slate-200">|</span>
                      <div>
                        Vận chuyển: <span className="font-bold text-[#1d1d1f]">
                          {poDetailData.po.shippingMethod || "N/A"} 
                          {poDetailData.po.trackingNumber && ` (Mã: ${poDetailData.po.trackingNumber})`}
                        </span>
                      </div>
                      <span className="text-slate-200">|</span>
                      <div>
                        Ngày nhập: <span className="font-bold text-[#1d1d1f]">{formatToDDMMYYYY(poDetailData.po.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedPoId(null)}
                    className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-[#7a7a7a] hover:text-[#1d1d1f] cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* 2. Stats Cards Grid */}
                <div className="mx-6 mb-3 grid grid-cols-3 md:grid-cols-6 gap-2.5 shrink-0">
                  {/* Card: Tổng số máy */}
                  <div className="relative overflow-hidden rounded-[22px] p-3 bg-gradient-to-br from-[#8e8e93] to-[#636366] text-white shadow-sm hover:scale-[1.02] transition-all duration-200 select-none">
                    <div className="relative z-10">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Tổng số máy</div>
                      <div className="text-[17px] font-extrabold mt-0.5">
                        {Number(poDetailData.stats?.totalItemsCount || 0)} <span className="text-[11px] font-semibold text-white/80">máy</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-100 pointer-events-none z-0" />
                  </div>
                  
                  {/* Card: Sẵn bán */}
                  <div className="relative overflow-hidden rounded-[22px] p-3 bg-gradient-to-br from-[#34c759] to-[#28a745] text-white shadow-sm hover:scale-[1.02] transition-all duration-200 select-none">
                    <div className="relative z-10">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Sẵn bán / Đang về</div>
                      <div className="text-[17px] font-extrabold mt-0.5">
                        {Number(poDetailData.stats?.inStockCount || 0) + Number(poDetailData.stats?.incomingCount || 0)} <span className="text-[11px] font-semibold text-white/80">máy</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-100 pointer-events-none z-0" />
                  </div>

                  {/* Card: Máy lỗi */}
                  <div className="relative overflow-hidden rounded-[22px] p-3 bg-gradient-to-br from-[#ff3b30] to-[#d12229] text-white shadow-sm hover:scale-[1.02] transition-all duration-200 select-none">
                    <div className="relative z-10">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Máy lỗi / Trả hàng</div>
                      <div className="text-[17px] font-extrabold mt-0.5">
                        {Number(poDetailData.stats?.defectiveCount || 0) + Number(poDetailData.stats?.returnedCount || 0)} <span className="text-[11px] font-semibold text-white/80">máy</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-100 pointer-events-none z-0" />
                  </div>

                  {/* Card: Tổng tiền hàng */}
                  <div className="relative overflow-hidden rounded-[22px] p-3 bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] text-white shadow-sm hover:scale-[1.02] transition-all duration-200 select-none">
                    <div className="relative z-10">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Tổng tiền hàng</div>
                      <div className="text-[16px] font-extrabold mt-0.5">
                        {formatPrice(poDetailData.po.totalCost)}
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-100 pointer-events-none z-0" />
                  </div>

                  {/* Card: VC & Thuế */}
                  <div className="relative overflow-hidden rounded-[22px] p-3 bg-gradient-to-br from-[#af52de] to-[#892ec0] text-white shadow-sm hover:scale-[1.02] transition-all duration-200 select-none">
                    <div className="relative z-10">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">VC & Thuế phân bổ</div>
                      <div className="text-[16px] font-extrabold mt-0.5">
                        {formatPrice((Number(poDetailData.po.shippingCost || 0) + Number(poDetailData.po.taxImport || 0)).toFixed(2))}
                      </div>
                      <div className="text-[9px] text-white/80 font-medium mt-0.5">
                        Mỗi máy: +{formatPrice(((Number(poDetailData.po.shippingCost || 0) + Number(poDetailData.po.taxImport || 0)) / (Number(poDetailData.stats?.totalItemsCount || 0) || 1)).toFixed(2))}
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-100 pointer-events-none z-0" />
                  </div>

                  {/* Card: Phụ kiện lẻ */}
                  <div className="relative overflow-hidden rounded-[22px] p-3 bg-gradient-to-br from-[#ff9f0a] to-[#ff8000] text-white shadow-sm hover:scale-[1.02] transition-all duration-200 select-none">
                    <div className="relative z-10">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">Chi phí phụ kiện lẻ</div>
                      <div className="text-[16px] font-extrabold mt-0.5">
                        {formatPrice(Number(poDetailData.stats?.totalAccessoryCost || 0).toFixed(2))}
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-100 pointer-events-none z-0" />
                  </div>
                </div>

                {/* 3. Table Card */}
                <div className="mx-6 mb-3 flex-1 flex flex-col min-h-0">
                  <div className="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm flex flex-col flex-1 overflow-hidden">
                    <h3 className="text-[13.5px] font-bold text-[#86868b] uppercase tracking-wider mb-4 px-1">
                      Danh sách máy đã nhập theo đơn ({Number(poDetailData.items?.length || 0)})
                    </h3>
                    
                    <div className="overflow-auto flex-1 rounded-xl border border-slate-100">
                      <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-[#f5f5f7] text-[#8e8e93] font-semibold uppercase text-[11px] tracking-wide whitespace-nowrap border-b border-slate-200/60">
                            <th className="px-5 py-3 w-14 text-center whitespace-nowrap">STT</th>
                            <th className="px-5 py-3 whitespace-nowrap">Tên sản phẩm / Model</th>
                            <th className="px-5 py-3 whitespace-nowrap">Số Serial</th>
                            <th className="px-5 py-3 text-center whitespace-nowrap">Trạng thái máy</th>
                            <th className="px-5 py-3 text-right whitespace-nowrap">Giá gốc NCC</th>
                            <th className="px-5 py-3 text-right whitespace-nowrap">VC & Thuế phân bổ</th>
                            <th className="px-5 py-3 text-right whitespace-nowrap">Phụ kiện phát sinh</th>
                            <th className="px-5 py-3 text-right whitespace-nowrap">Giá vốn thực tế</th>
                            <th className="px-5 py-3 text-center w-[120px] whitespace-nowrap">Tác vụ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80 text-[14px] text-[#1d1d1f]">
                          {poDetailData.items?.map((item: any, idx: number) => {
                            const costPriceVal = Number(item.costPrice || 0);
                            const accessoryCostVal = Number(item.accessoryCost || 0);
                            const allocShippingVal = Number(item.allocatedShipping || 0);
                            const allocTaxVal = Number(item.allocatedTax || 0);
                            const allocatedAdd = allocShippingVal + allocTaxVal;
                            const totalActualCostVal = Number(item.totalActualCost || 0);
                            
                            const hasAccessory = accessoryCostVal > 0;
                            
                            return (
                              <tr key={item.id} className="hover:bg-[#f5f5f7]/40 transition-colors">
                                <td className="px-5 py-3 text-center text-[#8e8e93] font-medium text-[13px] whitespace-nowrap">
                                  {idx + 1}
                                </td>
                                <td className="px-5 py-3 font-medium text-[#1d1d1f]">
                                  <div className="flex flex-col">
                                    <span className="text-[13.5px]">{item.productName}</span>
                                    {item.condition && (
                                      <span className="text-[11px] text-[#8e8e93] font-normal mt-0.5">
                                        {item.condition === 'new' ? 'Mới 100%' : 'Like New 99%'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap">
                                  <span className="font-medium text-[13px] text-[#48484a] tracking-[0.01em]">
                                    {item.serialNumber}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-center whitespace-nowrap">
                                  <StatusBadge status={item.status} className="text-[12.5px]" />
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-[#1d1d1f] whitespace-nowrap text-[13.5px]">
                                  {formatPrice(costPriceVal.toString())}
                                </td>
                                <td className="px-5 py-3 text-right text-[#8e8e93] font-medium whitespace-nowrap text-[13px]">
                                  {allocatedAdd > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span>+{formatPrice(allocatedAdd.toFixed(2))}</span>
                                      <span className="text-[10px] text-slate-400">VC: {formatPrice(allocShippingVal.toFixed(2))} | Thuế: {formatPrice(allocTaxVal.toFixed(2))}</span>
                                    </div>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-right whitespace-nowrap text-[13px]">
                                  <div className="flex flex-col items-end">
                                    {hasAccessory ? (
                                      <span className="font-semibold text-blue-600">+{formatPrice(accessoryCostVal.toString())}</span>
                                    ) : (
                                      <span className="text-[#7a7a7a]">—</span>
                                    )}
                                    {item.accessoryNotes && (
                                      <span className="text-[11px] text-[#7a7a7a] max-w-[180px] truncate" title={item.accessoryNotes}>
                                        {item.accessoryNotes}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-right font-semibold text-[#1d1d1f] whitespace-nowrap">
                                  <div className="relative group/cost flex flex-col items-end">
                                    <span className="text-[14px] text-[#1d1d1f] hover:text-[#0066cc] cursor-help font-bold">
                                      {formatPrice(totalActualCostVal.toFixed(2))}
                                    </span>
                                    
                                    {/* Tooltip on hover */}
                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/cost:block bg-white border border-[#e0e0e0] rounded-2xl shadow-xl p-4 w-72 z-50 text-[13px] text-left text-[#1d1d1f] font-normal pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                                      <div className="font-bold mb-2 pb-1.5 border-b border-[#e0e0e0] text-[#1d1d1f]">
                                        Chi tiết Phân rã giá vốn
                                      </div>
                                      <div className="space-y-1.5 font-medium">
                                        <div className="flex justify-between">
                                          <span className="text-[#7a7a7a]">Giá gốc NCC:</span>
                                          <span>{formatPrice(costPriceVal.toString())}</span>
                                        </div>
                                        {allocShippingVal > 0 && (
                                          <div className="flex justify-between text-emerald-600">
                                            <span className="text-[#7a7a7a]">Phí VC phân bổ:</span>
                                            <span>+{formatPrice(allocShippingVal.toFixed(2))}</span>
                                          </div>
                                        )}
                                        {allocTaxVal > 0 && (
                                          <div className="flex justify-between text-emerald-600">
                                            <span className="text-[#7a7a7a]">Thuế NK phân bổ:</span>
                                            <span>+{formatPrice(allocTaxVal.toFixed(2))}</span>
                                          </div>
                                        )}
                                        {hasAccessory && (
                                          <div className="flex justify-between text-emerald-600">
                                            <span className="text-[#7a7a7a]">Mua sạc/phụ kiện:</span>
                                            <span>+{formatPrice(accessoryCostVal.toString())}</span>
                                          </div>
                                        )}
                                        {item.accessoryNotes && (
                                          <div className="mt-2 pt-1.5 border-t border-[#e0e0e0]/60 text-[11px] text-[#7a7a7a] italic">
                                            Ghi chú: {item.accessoryNotes}
                                          </div>
                                        )}
                                        <div className="pt-2 border-t border-[#e0e0e0] flex justify-between font-bold text-[#0066cc]">
                                          <span>Tổng giá vốn:</span>
                                          <span>{formatPrice(totalActualCostVal.toFixed(2))}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center">
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => {
                                          setEditingAccessoryItem(item);
                                          setAccessoryCostInput(Number(item.accessoryCost || 0).toString());
                                          setAccessoryNotesInput(item.accessoryNotes || "");
                                        }}
                                        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-slate-50 hover:bg-blue-50 border border-slate-200/50 hover:border-blue-200/80 text-slate-500 hover:text-[#0066cc] cursor-pointer transition-all duration-150 active:scale-95"
                                      >
                                        <SFSymbolSquareAndPencil size={14} />
                                      </button>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Thêm chi phí
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-2.5 bg-transparent text-center text-[12px] text-[#86868b] font-semibold shrink-0">
                  Phí vận chuyển và Thuế nhập khẩu được phân bổ đều cho tổng số máy thực tế của đơn nhập này.
                </div>
              </>
            )}
            
          </div>
        </>,
        document.body
      )}

      {/* 7. Modal cập nhật chi phí sạc/phụ kiện */}
      <Dialog
        isOpen={!!editingAccessoryItem}
        onClose={() => setEditingAccessoryItem(null)}
        title="Cập nhật Chi phí Sạc / Phụ kiện"
        description={`Cập nhật chi phí phát sinh ngoài (mua sạc, phụ kiện, sửa chữa nhanh) cho máy có Serial ${editingAccessoryItem?.serialNumber}`}
        size="lg"
      >
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const costVal = parseFloat(accessoryCostInput) || 0;
            updateAccessoryCostMutation.mutate({
              itemId: editingAccessoryItem.id,
              cost: costVal,
              notes: accessoryNotesInput.trim() || null
            });
          }}
          className="space-y-6 pt-2"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                Chi phí phụ kiện / sạc phát sinh (VND)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={accessoryCostInput}
                onChange={(e) => setAccessoryCostInput(e.target.value)}
                className="w-full px-4 h-[44px] rounded-2xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
                placeholder="Nhập số tiền phát sinh, ví dụ: 250000"
                required
              />
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                Nhập số tiền lẻ. Ví dụ: 250000 = 250.000đ. Hệ thống lưu dạng Decimal chính xác.
              </span>
            </div>
            
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                Ghi chú chi tiết phụ kiện
              </label>
              <textarea
                value={accessoryNotesInput}
                onChange={(e) => setAccessoryNotesInput(e.target.value)}
                rows={3}
                className="w-full p-4 rounded-2xl bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
                placeholder="Ví dụ: Mua sạc xin Type-C 96W, dán cường lực..."
              />
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e0e0e0]">
            <button
              type="button"
              onClick={() => setEditingAccessoryItem(null)}
              className="px-5 h-[44px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[14px] font-semibold text-[#1d1d1f] rounded-full transition-all cursor-pointer active:scale-95 duration-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={updateAccessoryCostMutation.isPending}
              className="px-6 h-[44px] bg-[#0066cc] hover:bg-[#0071e3] disabled:opacity-50 text-white text-[14px] font-semibold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 duration-200 flex items-center justify-center gap-2"
            >
              {updateAccessoryCostMutation.isPending && (
                <SFSymbolArrowClockwise className="animate-spin text-white" size={14} />
              )}
              <span>Lưu chi phí</span>
            </button>
          </div>
        </form>
      </Dialog>

      {/* Floating Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-3 bg-[#1d1d1f]/95 text-white rounded-full shadow-2xl border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-[14px] font-semibold text-white/90">
            Đã chọn <span className="text-[#0066cc] font-bold bg-white px-2 py-0.5 rounded-full text-[12px] ml-1">{selectedIds.length}</span> máy
          </span>
          
          <div className="h-4 w-[1px] bg-white/20" />
          
          <div className="flex items-center gap-3">
            {hasIncomingSelected && (
              <button
                onClick={() => bulkConfirmMutation.mutate(selectedIds)}
                disabled={bulkConfirmMutation.isPending}
                className="flex items-center gap-2 px-4 h-[36px] bg-[#0066cc] hover:bg-[#0071e3] disabled:opacity-50 text-white text-[13px] font-medium rounded-full transition-all cursor-pointer shadow-sm active:scale-95 duration-200"
              >
                <SFSymbolCheckmarkCircle size={14} />
                <span>Xác nhận hàng về ({selectedItems.filter(i => i.status === 'incoming').length} máy)</span>
              </button>
            )}
            
            <button
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-2 px-4 h-[36px] bg-red-600/90 hover:bg-red-600 disabled:opacity-50 text-white text-[13px] font-medium rounded-full transition-all cursor-pointer shadow-sm active:scale-95 duration-200"
            >
              <SFSymbolTrash size={14} />
              <span>Xóa hàng loạt</span>
            </button>
            
            <button
              onClick={() => setSelectedIds([])}
              className="text-[13px] text-white/60 hover:text-white transition-colors px-2 py-1 font-medium cursor-pointer"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
