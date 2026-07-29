"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getInventoryGroups,
  getInventoryItemsByProduct,
  getInventoryStats,
  createInventoryItem, 
  createInventoryItemsBatch,
  updateInventoryItem, 
  deleteInventoryItem,
  softDeleteInventoryItem,
  restoreInventoryItem,
  bulkConfirmArrival,
  bulkDeleteInventoryItems,
} from "@/app/actions/inventory";
import { getCategories, getBrands } from "@/app/actions/products";
import { getPurchaseOrdersList, getPurchaseOrderDetail, updatePurchaseOrderAction } from "@/app/actions/purchase-orders";
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
  SFSymbolCheckmarkCircle,
  SFSymbolCPU,
  SFSymbolMemoryChip,
  SFSymbolInternalDrive,
  SFSymbolActivity,
  SFSymbolExclamationCircle,
  SFSymbolWrench,
  SFSymbolDollarSign,
  SFSymbolArrowRightLeft,
  SFSymbolDisplay
} from "@/components/ui/apple-icons";
import { useState, useMemo, useEffect, Suspense, useRef } from "react";
import { Filter } from "lucide-react";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
import { useDebounce } from "@/hooks/use-debounce";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AccessoryInventoryTab } from "@/components/inventory/accessory-inventory-tab";

import { CustomSelect } from "@/components/ui/custom-select";
import Link from "next/link";
import { DefectiveActionsDialog } from "@/components/inventory/defective-actions-dialog";
import { useSearchParams, useRouter, usePathname } from "next/navigation";


function InventoryPageContent() {
  const queryClient = useQueryClient();
  
  // Kích hoạt Supabase Realtime cho kho hàng
  useRealtimeSubscription("inventory_items", [["inventory"], ["inventory_stats"], ["inventory_items_by_product"]]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [instantSearch, setInstantSearch] = useState<string | null>(null);

  const activeSearchQuery = instantSearch !== null ? instantSearch : debouncedSearch;

  useEffect(() => {
    setInstantSearch(null);
  }, [debouncedSearch]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const selectedStatus = searchParams.get("status") || "in_stock";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Custom dialog states
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Sync activeTab with URL query param 'tab'
  const tabParam = searchParams.get("tab");
  const activeTab = (tabParam === "defective" || tabParam === "returned" || tabParam === "purchase_orders" || tabParam === "accessories" ? tabParam : "active") as "active" | "defective" | "returned" | "purchase_orders" | "accessories";

  const setActiveTab = (tab: "active" | "defective" | "returned" | "purchase_orders" | "accessories") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("modelId");
    params.delete("poId");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Sync activeDrawerProductId with URL query param 'modelId'
  const activeDrawerProductId = searchParams.get("modelId");
  const setActiveDrawerProductId = (productId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (productId) {
      params.set("modelId", productId);
    } else {
      params.delete("modelId");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [isDrawerAnimatingOut, setIsDrawerAnimatingOut] = useState(false);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCloseDrawer = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsDrawerAnimatingOut(true);
    closeTimerRef.current = setTimeout(() => {
      setActiveDrawerProductId(null);
      closeTimerRef.current = null;
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Reset animating out state when drawer opens
  useEffect(() => {
    if (activeDrawerProductId) {
      setIsDrawerAnimatingOut(false);
    }
  }, [activeDrawerProductId]);

  // Listen for Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeDrawerProductId) {
        setActiveDrawerProductId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDrawerProductId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setInstantSearch(search);
    }
  };

  const prefetchDrawerItems = (productId: string) => {
    queryClient.prefetchQuery({
      queryKey: ["inventory_items_by_product", productId],
      queryFn: () => getInventoryItemsByProduct(productId),
      staleTime: 30_000,
    });
  };

  // Sync selectedPoId with URL query param 'poId'
  const selectedPoId = searchParams.get("poId");
  const setSelectedPoId = (poId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (poId) {
      params.set("poId", poId);
    } else {
      params.delete("poId");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Purchase Orders & Cost allocation states
  const [isEditingPo, setIsEditingPo] = useState(false);
  const [poStatusInput, setPoStatusInput] = useState<string>("");
  const [poShippingCostInput, setPoShippingCostInput] = useState<string>("");
  const [poTaxImportInput, setPoTaxImportInput] = useState<string>("");

  // Defective inventory / Kho lỗi states
  const [defectiveItem, setDefectiveItem] = useState<any>(null);
  const [defectiveActionType, setDefectiveActionType] = useState<"report" | "repair" | "complete" | "refund" | "writeoff" | null>(null);

  // Purchase Orders filter states
  const [selectedPoStatus, setSelectedPoStatus] = useState<string>("all");
  const [selectedPoSupplier, setSelectedPoSupplier] = useState<string>("all");

  // Reset all filters and search keyword when switching tab to avoid mismatch results
  useEffect(() => {
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



  // Server-side pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedBrand, selectedStatus, search, activeTab]);

  const { data: categoriesData } = useQuery({
    queryKey: ["db_categories"],
    queryFn: getCategories,
  });

  const { data: brandsData } = useQuery({
    queryKey: ["db_brands"],
    queryFn: getBrands,
  });

  const { data: inventoryData, isLoading, error } = useQuery({
    queryKey: ["inventory", selectedCategory, selectedBrand, selectedStatus, activeSearchQuery, currentPage, activeTab],
    queryFn: () => getInventoryGroups({
      page: currentPage,
      limit: itemsPerPage,
      categoryName: selectedCategory,
      brandName: selectedBrand,
      status: activeTab === "defective" ? "defective" : (activeTab === "returned" ? "returned" : selectedStatus),
      search: activeSearchQuery || undefined,
    }),
    placeholderData: (prev: any) => prev,
    staleTime: 15_000,
  });

  const groupedItems = inventoryData?.list || [];
  const totalCount = inventoryData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const { data: drawerItems, isLoading: isDrawerItemsLoading } = useQuery({
    queryKey: ["inventory_items_by_product", activeDrawerProductId],
    queryFn: () => getInventoryItemsByProduct(activeDrawerProductId!),
    enabled: !!activeDrawerProductId,
    staleTime: 10_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["inventory_stats"],
    queryFn: getInventoryStats,
    placeholderData: (prev: any) => prev,
    staleTime: 15_000,
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

  const isPoDetailLoadingState = !!selectedPoId && (
    isPoDetailLoading || 
    (!poDetailData && !isPoDetailError) || 
    (poDetailData && poDetailData.po?.id !== selectedPoId && !isPoDetailError && poDetailData.success !== false)
  );

  useEffect(() => {
    if (poDetailData?.po) {
      setPoStatusInput(poDetailData.po.status);
      setPoShippingCostInput(poDetailData.po.shippingCost ? Math.round(Number(poDetailData.po.shippingCost)).toString() : "0");
      setPoTaxImportInput(poDetailData.po.taxImport ? Math.round(Number(poDetailData.po.taxImport)).toString() : "0");
    }
  }, [poDetailData]);

  useEffect(() => {
    if (!selectedPoId) {
      setIsEditingPo(false);
    }
  }, [selectedPoId]);



  const updatePoMutation = useMutation({
    mutationFn: (data: { id: string; payload: { status?: any; shippingCost?: string; taxImport?: string } }) =>
      updatePurchaseOrderAction(data.id, data.payload),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
        queryClient.invalidateQueries({ queryKey: ["purchaseOrderDetail", selectedPoId] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setIsEditingPo(false);
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi cập nhật phiếu nhập"),
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: (data: { id: string; status: any }) => updateInventoryItem(data.id, { status: data.status }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["purchaseOrderDetail", selectedPoId] });
        queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Có lỗi xảy ra khi cập nhật trạng thái sản phẩm"),
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
        queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
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
        queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
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

  const formatVNDInput = (value: string) => {
    if (!value) return "";
    const num = parseInt(value.replace(/\D/g, ""), 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("vi-VN");
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
    const cats = categoriesData || [];
    return [
      { value: "all", label: "Tất cả danh mục" },
      ...cats.map((c) => ({ value: c.name, label: c.name })),
    ];
  }, [categoriesData]);

  const brandOptions = useMemo(() => {
    const brs = brandsData || [];
    return [
      { value: "all", label: "Tất cả thương hiệu" },
      ...brs.map((b) => ({ value: b.name, label: b.name })),
    ];
  }, [brandsData]);

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
        { value: "internal_repair", label: "Đang sửa" },
        { value: "supplier_warranty", label: "Đang BH" },
      ];
    } else {
      return [
        { value: "all", label: "Tất cả máy đã trả NCC" },
      ];
    }
  }, [activeTab]);

  const poStatusOptions = [
    { value: "all", label: "Tất cả trạng thái" },
    { value: "in_transit", label: "Đang vận chuyển" },
    { value: "received", label: "Đã sẵn hàng" },
    { value: "warranty_supplier", label: "Bảo hành NCC" },
    { value: "returned_supplier", label: "Đã trả NCC" },
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
    if (!drawerItems) return [];
    return drawerItems.filter((item: any) => {
      if (activeTab === "defective") {
        return item.status === "defective" || item.status === "warranty_repair";
      }
      if (activeTab === "returned") {
        return item.status === "returned";
      }
      if (activeTab === "active") {
        if (selectedStatus === "in_stock") {
          return item.status === "in_stock" || item.status === "reserved";
        }
        if (selectedStatus === "incoming") {
          return item.status === "incoming";
        }
        return item.status === "in_stock" || item.status === "reserved" || item.status === "incoming";
      }
      return true;
    });
  }, [drawerItems, activeTab, selectedStatus]);

  const handleSelectAll = () => {
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

  const selectedItems = filteredItems.filter(item => selectedIds.includes(item.id));
  const hasIncomingSelected = selectedItems.some(item => item.status === 'incoming');

  const activeDrawerProductFromList = useMemo(() => {
    const found = groupedItems.find((g) => g.productId === activeDrawerProductId);
    if (!found || !drawerItems) return null;
    return {
      ...found,
      items: filteredItems,
      costPrices: filteredItems.map((item: any) => Number(item.costPrice || 0)),
      supplierNames: Array.from(new Set(filteredItems.map((item: any) => item.supplierName).filter(Boolean))) as string[],
    };
  }, [groupedItems, activeDrawerProductId, drawerItems, filteredItems]);

  const [cachedDrawerProduct, setCachedDrawerProduct] = useState<any>(null);

  useEffect(() => {
    if (activeDrawerProductId === null) {
      setCachedDrawerProduct(null);
    } else if (activeDrawerProductFromList) {
      setCachedDrawerProduct(activeDrawerProductFromList);
    }
  }, [activeDrawerProductFromList, activeDrawerProductId]);
  const activeDrawerProduct = activeDrawerProductFromList || cachedDrawerProduct;

  const activeDrawerDefectiveCount = useMemo(() => {
    if (!drawerItems) return 0;
    return drawerItems.filter((item: any) => item.status === 'defective' || item.status === 'warranty_repair').length;
  }, [drawerItems]);

  return (
    <div className="space-y-6">
      {/* Dropdown Filters & Search & Action Buttons */}
      {activeTab !== "accessories" && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e0e0e0] w-full print:hidden">
          
          {/* Left side: Search & Filters Group - unified toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
            {/* Search Input - Spotlight dynamic layout */}
            <div className="relative w-full sm:w-[280px] md:w-[320px] transition-all duration-300">
              <SFSymbolMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
              <input 
                type="text" 
                placeholder={activeTab === "purchase_orders" ? "Tìm số đơn, nhà cung cấp..." : "Tìm sản phẩm"} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#7a7a7a]/60 shadow-sm"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Direct Filters for PO Tab */}
              {activeTab === "purchase_orders" && (
                <>
                  <div className="w-[150px] sm:w-[160px] shrink-0">
                    <CustomSelect
                      options={poStatusOptions}
                      value={selectedPoStatus}
                      onChange={setSelectedPoStatus}
                      size="sm"
                      rounded="full"
                      dropdownWidth="full"
                    />
                  </div>
                  <div className="w-[170px] sm:w-[180px] shrink-0">
                    <CustomSelect
                      options={poSupplierOptions}
                      value={selectedPoSupplier}
                      onChange={setSelectedPoSupplier}
                      size="sm"
                      rounded="full"
                      dropdownWidth="full"
                    />
                  </div>
                </>
              )}

              {/* Direct Filters for other Tabs (Category & Brand) */}
              {activeTab !== "purchase_orders" && (
                <>
                  <div className="w-[160px] sm:w-[180px] shrink-0">
                    <CustomSelect
                      options={categoryOptions}
                      value={selectedCategory}
                      onChange={setSelectedCategory}
                      size="sm"
                      rounded="full"
                      dropdownWidth="full"
                    />
                  </div>
                  <div className="w-[170px] sm:w-[190px] shrink-0">
                    <CustomSelect
                      options={brandOptions}
                      value={selectedBrand}
                      onChange={setSelectedBrand}
                      size="sm"
                      rounded="full"
                      dropdownWidth="full"
                    />
                  </div>
                </>
              )}

              {/* Reset Button */}
              {((activeTab !== "purchase_orders" && (selectedCategory !== "all" || selectedBrand !== "all" || selectedStatus !== "in_stock" || search !== "")) ||
                (activeTab === "purchase_orders" && (selectedPoStatus !== "all" || selectedPoSupplier !== "all" || search !== ""))) && (
                <button
                  onClick={() => {
                    if (activeTab === "purchase_orders") {
                      setSelectedPoStatus("all");
                      setSelectedPoSupplier("all");
                    } else {
                      setSelectedCategory("all");
                      setSelectedBrand("all");
                    }
                    setSearch("");
                    router.push(`${pathname}?tab=${activeTab}${activeTab === "active" ? "&status=in_stock" : ""}`);
                  }}
                  className="h-[40px] w-[40px] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 duration-200"
                  title="Đặt lại bộ lọc"
                >
                  <SFSymbolArrowClockwise size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Right side: Action Buttons - Call to Action */}
          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto w-full md:w-auto justify-end">
            {/* Nhập kho Button */}
            {(activeTab === "active" || activeTab === "defective") && (
              <button 
                onClick={handleOpenCreateDialog}
                className="flex items-center gap-1.5 px-5 h-[40px] bg-[#0066cc] text-white text-[13px] font-semibold rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0 w-full sm:w-auto justify-center"
              >
                <SFSymbolPlus size={13} />
                <span>Nhập kho mới</span>
              </button>
            )}
          </div>
        </div>
      )}




      {/* 4. Main Data Card - Crisp Apple store card layout */}
      {activeTab === "accessories" ? (
        <AccessoryInventoryTab />
      ) : (
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
              <div className="w-12 h-12 bg-[#f5f5f7] rounded-full border border-[#e0e0e0] flex items-center justify-center mb-4 text-[#7a7a7a]/60">
                <SFSymbolShippingBox size={18} />
              </div>
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-1">
                Không tìm thấy đơn nhập hàng
              </h3>
              <p className="text-[13px] text-[#7a7a7a]">
                Không có dữ liệu đơn nhập nào khớp với bộ lọc hoặc tìm kiếm.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0 border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                    <th className="px-6 py-3 w-16 text-center border-b border-[#e0e0e0] whitespace-nowrap">STT</th>
                    <th className="px-6 py-3 border-b border-[#e0e0e0] whitespace-nowrap">Mã đơn nhập</th>
                    <th className="px-6 py-3 border-b border-[#e0e0e0] whitespace-nowrap">Nhà cung cấp</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Số lượng máy</th>
                    <th className="px-6 py-3 text-right border-b border-[#e0e0e0] whitespace-nowrap">Tổng tiền hàng</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Trạng thái</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-[#1d1d1f]">
                  {filteredPurchaseOrders.map((po: any, index: number) => {
                    const isLast = index === filteredPurchaseOrders.length - 1;
                    const poStatusConfig: Record<string, { color: string; label: string }> = {
                      draft: { color: "text-slate-500", label: "Nháp" },
                      ordered: { color: "text-amber-600", label: "Đã đặt hàng" },
                      in_transit: { color: "text-blue-600", label: "Đang vận chuyển" },
                      partially_received: { color: "text-indigo-600", label: "Nhận một phần" },
                      received: { color: "text-emerald-600", label: "Đã sẵn hàng" },
                      cancelled: { color: "text-red-600", label: "Đã hủy" },
                      warranty_supplier: { color: "text-orange-600", label: "Bảo hành NCC" },
                      returned_supplier: { color: "text-slate-600", label: "Đã trả NCC" },
                    };
                    const statusInfo = poStatusConfig[po.status] || { color: "text-slate-800", label: po.status };

                    return (
                      <tr 
                        key={po.id} 
                        className="group cursor-pointer"
                        onClick={() => setSelectedPoId(po.id)}
                      >
                        <td className={`px-6 py-3 text-center font-semibold text-[#7a7a7a] text-[13px] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
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
                          <span className="text-[13px] font-semibold text-slate-700">
                            {po.totalItemsCount} máy
                          </span>
                        </td>
                        <td className={`px-6 py-3 text-right font-bold text-[#1d1d1f] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          {formatPrice(po.totalCost)}
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
        ) : groupedItems.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-[#f5f5f7] rounded-full border border-[#e0e0e0] flex items-center justify-center mb-4 text-[#7a7a7a]/60">
              <SFSymbolShippingBox size={18} />
            </div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-1">
              Không tìm thấy sản phẩm
            </h3>
            <p className="text-[13px] text-[#7a7a7a]">
              Không có dữ liệu thiết bị nào khớp với bộ lọc hoặc tìm kiếm.
            </p>
          </div>
        ) : (
          <>
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
                  {activeTab === "defective" ? (
                    <>
                      <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Đang sửa</th>
                      <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Đang BH</th>
                    </>
                  ) : (
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">
                      {activeTab === "active" ? "Đang về" : "Trạng thái"}
                    </th>
                  )}

                  <th className="px-6 py-3 text-right border-b border-[#e0e0e0] whitespace-nowrap">Giá vốn trung bình</th>
                </tr>
              </thead>
              <tbody className="text-[14px] text-[#1d1d1f]">
                 {groupedItems.map((group, index) => {
                  const avgCost = Number(group.avgCost || 0);
                  const isLast = index === groupedItems.length - 1;
                  const specs = group.productSpecs as any;
                  return (
                    <tr 
                      key={group.productId} 
                      className="group cursor-pointer"
                      onClick={() => setActiveDrawerProductId(group.productId)}
                      onMouseEnter={() => prefetchDrawerItems(group.productId)}
                    >
                      <td className={`px-6 py-3 text-center font-semibold text-[#7a7a7a] text-[13px] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td className={`px-6 py-3 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-semibold text-[#1d1d1f] tracking-tight group-hover:text-[#0066cc] transition-colors duration-200">
                              <span className="mr-1.5">{group.brandName}</span>
                              {group.productName}
                            </p>
                            {specs && (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[12px] text-[#7a7a7a] font-medium tracking-tight select-none">
                                {[
                                  specs.cpu,
                                  specs.ram ? `RAM ${specs.ram}` : null,
                                  specs.ssd ? `SSD ${specs.ssd}` : null,
                                  specs.screen,
                                ].filter(Boolean).map((spec, sIdx) => (
                                  <span key={sIdx} className="flex items-center gap-2">
                                    {sIdx > 0 && <span className="text-slate-300 select-none">•</span>}
                                    <span>{spec}</span>
                                  </span>
                                ))}
                                {!specs.cpu && !specs.ram && !specs.ssd && !specs.screen && (
                                  <span className="text-[#a0a0a5] italic text-[11.5px]">Chưa cấu hình</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {activeTab === "returned" && (
                        <td className={`px-6 py-3 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          {group.supplierNames && group.supplierNames.length > 0 ? (
                            <span className="text-[13px] text-[#1d1d1f] font-medium">
                              {group.supplierNames.join(", ")}
                            </span>
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
                            {group.defectiveOnlyCount} máy
                          </span>
                        ) : (
                          <span className="text-[13px] font-semibold text-slate-600">
                            {group.returnedCount} máy
                          </span>
                        )}
                      </td>
                      {activeTab === "defective" ? (
                        <>
                          <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                            <span className="text-[13px] font-semibold text-amber-600">
                              {group.internalRepairCount} máy
                            </span>
                          </td>
                          <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                            <span className="text-[13px] font-semibold text-[#0066cc]">
                              {group.externalWarrantyCount} máy
                            </span>
                          </td>
                        </>
                      ) : (
                        <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                          {activeTab === "active" ? (
                            <span className="text-[13px] font-semibold text-amber-600">
                              {group.incomingCount} máy
                            </span>
                          ) : (
                            <span className="text-[13px] font-semibold text-orange-600">
                              Đã trả
                            </span>
                          )}
                        </td>
                      )}

                      <td className={`px-6 py-3 text-right font-semibold text-[#1d1d1f] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {formatPrice(avgCost.toFixed(0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination controls for model list */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-[#e0e0e0] bg-[#f5f5f7]/30 select-none gap-3">
              <span className="text-[12px] font-medium text-slate-500">
                Hiển thị dòng {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} trong tổng số {totalCount} sản phẩm
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 hover:border-[#0071e3] hover:text-[#0071e3] hover:bg-blue-50/30 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
                >
                  Trước
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    const isCurrent = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7.5 h-7.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer flex items-center justify-center active:scale-90 ${
                          isCurrent
                            ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
                            : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 hover:border-[#0071e3] hover:text-[#0071e3] hover:bg-blue-50/30 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </GlassCard>
  )}

      {/* 5. Giao diện Modal bảng chi tiết cấu hình và danh sách Serials - Centered & Portal UI/UX */}
      {mounted && activeDrawerProduct && createPortal(
        <>
          {/* Backdrop overlay */}
          <div 
            className={`fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-[8px] z-40 transition-opacity duration-200 ${
              isDrawerAnimatingOut ? "opacity-0" : "opacity-100 animate-in fade-in"
            }`}
            onClick={handleCloseDrawer}
          />
          
          {/* Responsive Modal / Bottom Sheet Wrapper */}
          <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 pointer-events-none p-0 sm:p-6">
            <div className={`w-full max-w-7xl bg-white rounded-t-[32px] sm:rounded-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.12),0_12px_50px_rgba(0,0,0,0.18)] border-t sm:border border-[#e0e0e0]/80 overflow-hidden transform transition-all duration-200 flex flex-col max-h-[94vh] sm:max-h-[88vh] pointer-events-auto ${
              isDrawerAnimatingOut 
                ? "opacity-0 translate-y-10 sm:translate-y-4 sm:scale-95" 
                : "opacity-100 translate-y-0 sm:scale-100 animate-in slide-in-from-bottom sm:slide-in-from-none sm:zoom-in-95"
            }`}>
              
              {/* Mobile drag handle indicator */}
              <div className="w-full flex justify-center py-3.5 sm:hidden shrink-0 bg-[#f5f5f7]/55 border-b border-[#e0e0e0]/40">
                <div className="w-12 h-1.5 rounded-full bg-[#d2d2d7]" />
              </div>

              {/* Modal Header - Clean Apple Style */}
              <div className="px-8 py-6 border-b border-[#e0e0e0] bg-[#f5f5f7]/50 flex items-start justify-between">
                <div className="space-y-2">
                  <h2 className="text-[24px] font-extrabold tracking-tight leading-snug bg-gradient-to-r from-[#1d1d1f] via-[#2d2d30] to-[#434345] bg-clip-text text-transparent flex items-center gap-2">
                    <span>{activeDrawerProduct.productName}</span>
                  </h2>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[14.5px] text-[#7a7a7a] font-medium">
                      {activeDrawerProduct.brandName} • {activeDrawerProduct.categoryName} {activeDrawerProduct.productSku && `• SKU: ${activeDrawerProduct.productSku}`}
                    </span>
                    {activeTab === "active" && (
                      <div className="flex items-center gap-2.5 ml-2 flex-wrap select-none text-[13.5px]">
                        <span className="text-slate-300">•</span>
                        <span className="font-semibold text-emerald-600">
                          Sẵn kho: {activeDrawerProduct.inStockCount}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-semibold text-blue-600">
                          Đang về: {activeDrawerProduct.incomingCount}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-semibold text-red-600">
                          Đang lỗi: {activeDrawerDefectiveCount}
                        </span>
                      </div>
                    )}
                  </div>
                  {activeDrawerProduct.productSpecs && (
                    <div className="flex items-center gap-5 text-[14.5px] text-[#1d1d1f] mt-2 font-medium flex-wrap">
                      {activeDrawerProduct.productSpecs.cpu && (
                        <span>
                          <span className="text-[#7a7a7a] font-semibold">CPU:</span> {activeDrawerProduct.productSpecs.cpu}
                        </span>
                      )}
                      {activeDrawerProduct.productSpecs.ram && (
                        <span>
                          <span className="text-[#7a7a7a] font-semibold">RAM:</span> {activeDrawerProduct.productSpecs.ram}
                        </span>
                      )}
                      {activeDrawerProduct.productSpecs.ssd && (
                        <span>
                          <span className="text-[#7a7a7a] font-semibold">SSD:</span> {activeDrawerProduct.productSpecs.ssd}
                        </span>
                      )}
                      {activeDrawerProduct.productSpecs.screen && (
                        <span>
                          <span className="text-[#7a7a7a] font-semibold">Màn hình:</span> {activeDrawerProduct.productSpecs.screen}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={handleCloseDrawer}
                  className="w-9 h-9 text-[15px] rounded-full flex items-center justify-center bg-[#e8e8ed] text-[#7a7a7a] hover:text-[#1d1d1f] hover:bg-[#d5d5da] cursor-pointer transition-colors active:scale-95 duration-200 shrink-0"
                >
                  ✕
                </button>
              </div>



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
                      className="flex items-center gap-1.5 px-4 h-9 bg-[#0066cc] hover:bg-[#0071e3] disabled:opacity-50 text-white text-[13px] font-semibold rounded-full transition-all cursor-pointer active:scale-95 duration-200 shadow-sm"
                    >
                      <SFSymbolCheckmarkCircle size={14} />
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
                                  className={`text-[15px] font-semibold ${
                                    item.serialNumber.startsWith("SN-PENDING-")
                                      ? "text-amber-600"
                                      : "text-[#1d1d1f]"
                                  }`}
                                >
                                  {item.serialNumber.startsWith("SN-PENDING-") ? "Chờ cập nhật" : item.serialNumber}
                                </span>
                                {item.condition && (
                                  <span className="text-[11.5px] text-[#7a7a7a] mt-0.5">
                                    {item.condition === 'new' ? 'Mới 100%' : 'Like New 99%'}
                                  </span>
                                )}
                                {item.accessories && item.accessories.length > 0 && (
                                  <div className="flex flex-col gap-1 mt-1.5 border-t border-slate-100 pt-1">
                                    {item.accessories.map((acc: any) => (
                                      <span key={acc.id} className="inline-flex items-center gap-1 text-[11px] text-[#0066cc] font-medium bg-blue-50/50 px-2 py-0.5 rounded-full w-fit">
                                        📎 {acc.catalogName} {acc.serialNumber ? `(${acc.serialNumber})` : ""}
                                      </span>
                                    ))}
                                  </div>
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

                            <td className="px-5 py-3 whitespace-nowrap text-[13.5px] font-semibold">
                              {(() => {
                                const statusConfig: Record<string, { text: string; label: string }> = {
                                  in_stock: { text: "text-emerald-600", label: "Sẵn" },
                                  incoming: { text: "text-blue-600", label: "Đang về" },
                                  sold: { text: "text-slate-500", label: "Đã bán" },
                                  warranty_repair: { text: "text-amber-600", label: "Bảo hành" },
                                  returned: { text: "text-slate-500", label: "Đã trả NCC" },
                                  defective: { text: "text-red-600", label: "Lỗi" },
                                  deleted: { text: "text-red-500", label: "Đã xóa" },
                                };
                                
                                if (item.status === 'warranty_repair') {
                                  const repairLabel = item.location === 'internal_repair' ? 'Đang sửa' : 'Đang BH';
                                  const repairColor = item.location === 'internal_repair' ? 'text-orange-600' : 'text-amber-600';
                                  return <span className={repairColor}>{repairLabel}</span>;
                                }
                                
                                const config = statusConfig[item.status] || { text: "text-slate-700", label: item.status };
                                return <span className={config.text}>{config.label}</span>;
                              })()}
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
                                      <div className={`absolute right-0 ${idx < 3 ? 'top-full mt-2' : 'bottom-full mb-2'} hidden group-hover/cost:block bg-white border border-[#e0e0e0] rounded-2xl shadow-xl p-4 w-72 z-50 text-[13px] text-left text-[#1d1d1f] font-normal pointer-events-none animate-in fade-in zoom-in-95 duration-150`}>
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
                                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 hover:bg-[#d97706] border border-amber-100 hover:border-[#d97706] text-[#d97706] hover:text-white cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(217,119,6,0.05)] hover:shadow-[0_4px_12px_rgba(217,119,6,0.2)]"
                                        >
                                          <SFSymbolExclamationCircle size={14} />
                                        </button>
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                          Báo máy lỗi
                                        </span>
                                      </div>
                                    )}
                                    <div className="relative group/tooltip">
                                      <Link
                                        href={`/lookup?serial=${item.serialNumber}`}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] hover:border-[#d1d1d6] text-[#48484a] hover:text-[#0066cc] cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                                      >
                                        <SFSymbolActivity size={14} />
                                      </Link>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Lịch sử máy
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleOpenEditDialog(item)}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] hover:border-[#d1d1d6] text-[#48484a] hover:text-[#1c1c1e] cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
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
                                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 hover:bg-[#ff3b30] border border-red-100 hover:border-[#ff3b30] text-[#ff3b30] hover:text-white cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(255,59,48,0.08)] hover:shadow-[0_4px_12px_rgba(255,59,48,0.2)]"
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
                                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 hover:bg-[#0066cc] border border-blue-100 hover:border-[#0066cc] text-[#0066cc] hover:text-white cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(0,102,204,0.08)] hover:shadow-[0_4px_12px_rgba(0,102,204,0.2)]"
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
                                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 hover:bg-[#34c759] border border-emerald-100 hover:border-[#34c759] text-[#34c759] hover:text-white cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(52,199,89,0.08)] hover:shadow-[0_4px_12px_rgba(52,199,89,0.2)]"
                                        >
                                          <SFSymbolCheckmarkCircle size={14} />
                                        </button>
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                          Nhận về kho
                                        </span>
                                      </div>
                                    )}
                                    {(item.status === "defective" || item.status === "warranty_repair") && (
                                      <div className="relative group/tooltip">
                                        <button
                                          onClick={() => {
                                            setDefectiveItem(item);
                                            setDefectiveActionType("refund");
                                          }}
                                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 hover:bg-[#34c759] border border-emerald-100 hover:border-[#34c759] text-[#34c759] hover:text-white cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(52,199,89,0.08)] hover:shadow-[0_4px_12px_rgba(52,199,89,0.2)]"
                                        >
                                          <SFSymbolDollarSign size={14} />
                                        </button>
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                          NCC hoàn tiền
                                        </span>
                                      </div>
                                    )}
                                    {(item.status === "defective" || item.status === "warranty_repair") && (
                                      <div className="relative group/tooltip">
                                        <button
                                          onClick={() => {
                                            setDefectiveItem(item);
                                            setDefectiveActionType("writeoff");
                                          }}
                                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50 hover:bg-[#af52de] border border-purple-100 hover:border-[#af52de] text-[#af52de] hover:text-white cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(175,82,222,0.08)] hover:shadow-[0_4px_12px_rgba(175,82,222,0.2)]"
                                        >
                                          <SFSymbolArrowRightLeft size={14} />
                                        </button>
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                          NCC đổi máy mới
                                        </span>
                                      </div>
                                    )}
                                    <div className="relative group/tooltip">
                                      <Link
                                        href={`/lookup?serial=${item.serialNumber}`}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] hover:border-[#d1d1d6] text-[#48484a] hover:text-[#0066cc] cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                                      >
                                        <SFSymbolActivity size={14} />
                                      </Link>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Lịch sử máy
                                      </span>
                                    </div>
                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleDeleteClick(item)}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 hover:bg-[#ff3b30] border border-red-100 hover:border-[#ff3b30] text-[#ff3b30] hover:text-white cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(255,59,48,0.08)] hover:shadow-[0_4px_12px_rgba(255,59,48,0.2)]"
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
                                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white hover:bg-[#f5f5f7] border border-[#e5e5ea] hover:border-[#d1d1d6] text-[#48484a] hover:text-[#0066cc] cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                                      >
                                        <SFSymbolActivity size={14} />
                                      </Link>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 bg-[#1d1d1f] text-white text-[10px] font-bold rounded-md opacity-0 pointer-events-none group-hover/tooltip:opacity-100 scale-95 group-hover/tooltip:scale-100 transition-all duration-150 shadow-md whitespace-nowrap z-50">
                                        Lịch sử máy
                                      </span>
                                    </div>

                                    <div className="relative group/tooltip">
                                      <button
                                        onClick={() => handleDeleteClick(item)}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 hover:bg-[#ff3b30] border border-red-100 hover:border-[#ff3b30] text-[#ff3b30] hover:text-white cursor-pointer transition-all duration-200 active:scale-95 shadow-[0_2px_8px_rgba(255,59,48,0.08)] hover:shadow-[0_4px_12px_rgba(255,59,48,0.2)]"
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
                  Nhấp vào mã serial để xem cấu hình chi tiết sản phẩm cụ thể.
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
          
          {/* Centered Modal Wrapper */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4 sm:p-6 lg:p-10">
            <div 
              className={`w-full bg-[#f5f5f7] rounded-[24px] sm:rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.25)] border border-[#e0e0e0]/50 overflow-hidden transform transition-all duration-300 ease-out flex flex-col pointer-events-auto animate-in fade-in zoom-in-95 ${
                isPoDetailLoadingState 
                  ? "max-w-md h-[180px]" 
                  : isPoDetailError || !poDetailData?.success || !poDetailData.po
                  ? "max-w-xl h-[340px]" 
                  : "max-w-7xl max-h-[85vh]"
              }`}
              style={{ 
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif', 
                fontFeatureSettings: '"zero" off' 
              }}
            >
            
            {isPoDetailLoadingState ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#7a7a7a] relative">
                <button 
                  onClick={() => setSelectedPoId(null)}
                  className="absolute right-4 top-4 w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-[#7a7a7a] hover:text-[#1d1d1f] cursor-pointer transition-all duration-200"
                >
                  ✕
                </button>
                <SFSymbolArrowClockwise className="animate-spin mb-3 text-[#0066cc]" size={22} />
                <p className="text-[15px] font-medium text-[#1d1d1f]">Đang tải chi tiết đơn nhập...</p>
              </div>
            ) : isPoDetailError || !poDetailData?.success || !poDetailData.po ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-3.5 text-red-500 font-bold text-xl">
                  ✕
                </div>
                <h3 className="text-[19px] font-bold text-[#1d1d1f] mb-1.5">Lỗi tải dữ liệu</h3>
                <p className="text-[15px] text-[#7a7a7a] mb-5 max-w-sm leading-relaxed">
                  {poDetailData?.message || (poDetailError as any)?.message || "Không thể tải chi tiết đơn nhập hàng. Vui lòng thử lại."}
                </p>
                <button 
                  onClick={() => setSelectedPoId(null)}
                  className="px-5 h-[36px] bg-slate-100 hover:bg-slate-200 text-[#1d1d1f] text-[13px] font-semibold rounded-full transition-all active:scale-95 duration-200 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <>
                {/* 1. Modal Header */}
                <div className="px-6 py-4.5 border-b border-slate-200/60 bg-white flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[17px] font-bold text-[#1d1d1f] tracking-[-0.02em]">
                      Chi tiết Đơn nhập: {poDetailData.po.poNumber}
                    </h2>
                    <div 
                      className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full select-none ${
                        poDetailData.po.status === "received" 
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : poDetailData.po.status === "in_transit"
                          ? "bg-blue-50 text-blue-600 border border-blue-100"
                          : poDetailData.po.status === "cancelled"
                          ? "bg-red-50 text-red-600 border border-red-100"
                          : "bg-slate-50 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {poDetailData.po.status === "received" 
                        ? "Đã sẵn hàng"
                        : poDetailData.po.status === "in_transit"
                        ? "Đang vận chuyển"
                        : poDetailData.po.status === "cancelled"
                        ? "Đã hủy"
                        : poDetailData.po.status === "draft"
                        ? "Bản nháp"
                        : poDetailData.po.status === "ordered"
                        ? "Đã đặt hàng"
                        : poDetailData.po.status === "partially_received"
                        ? "Nhận một phần"
                        : poDetailData.po.status === "warranty_supplier"
                        ? "Bảo hành NCC"
                        : poDetailData.po.status === "returned_supplier"
                        ? "Đã trả NCC"
                        : poDetailData.po.status}
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedPoId(null)}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-[#7a7a7a] hover:text-[#1d1d1f] cursor-pointer transition-all duration-200"
                  >
                    ✕
                  </button>
                </div>

                {/* 2. Split Body Layout */}
                <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                  
                  {/* Left Side: Table of items */}
                  <div className="flex-1 flex flex-col min-w-0 min-h-0 p-5">
                    <div className="bg-white rounded-2xl border border-slate-200/50 p-4 shadow-sm flex flex-col flex-1 overflow-hidden">
                      <h3 className="text-[12.5px] font-bold text-[#86868b] uppercase tracking-wider mb-3.5 px-1 select-none">
                        Danh sách máy đã nhập theo đơn ({Number(poDetailData.items?.length || 0)})
                      </h3>
                      
                      <div className="overflow-auto flex-1 rounded-xl border border-slate-100">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-[#f5f5f7] text-[#8e8e93] font-semibold uppercase text-[11px] tracking-wide whitespace-nowrap border-b border-slate-200/60 select-none">
                              <th className="px-4 py-2.5 w-14 text-center whitespace-nowrap">STT</th>
                              <th className="px-4 py-2.5 whitespace-nowrap">Tên sản phẩm / Model</th>
                              <th className="px-4 py-2.5 whitespace-nowrap">Số Serial</th>
                              <th className="px-4 py-2.5 text-center whitespace-nowrap">Trạng thái máy</th>
                              <th className="px-4 py-2.5 text-right whitespace-nowrap">Giá vốn nhập kho</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/80 text-[14px] text-[#1d1d1f]">
                            {poDetailData.items?.map((item: any, idx: number) => {
                              const costPriceVal = Number(item.costPrice || 0);
                              return (
                                <tr key={item.id} className="hover:bg-[#f5f5f7]/40 transition-colors">
                                  <td className="px-4 py-2.5 text-center text-[#8e8e93] font-medium text-[13px] whitespace-nowrap">
                                    {idx + 1}
                                  </td>
                                  <td className="px-4 py-2.5 font-medium text-[#1d1d1f]">
                                    <div className="flex flex-col">
                                      <span className="text-[13.5px]">{item.productName}</span>
                                      
                                      {/* Specs/Configuration */}
                                      {item.productSpecs && (
                                        <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] text-[#86868b] font-semibold mt-1 select-none">
                                          {item.productSpecs.cpu && (
                                            <span className="bg-[#f5f5f7] px-1.5 py-0.5 rounded">{item.productSpecs.cpu}</span>
                                          )}
                                          {item.productSpecs.ram && (
                                            <span className="bg-[#f5f5f7] px-1.5 py-0.5 rounded">RAM {item.productSpecs.ram}</span>
                                          )}
                                          {item.productSpecs.ssd && (
                                            <span className="bg-[#f5f5f7] px-1.5 py-0.5 rounded">SSD {item.productSpecs.ssd}</span>
                                          )}
                                          {item.productSpecs.screen && (
                                            <span className="bg-[#f5f5f7] px-1.5 py-0.5 rounded">{item.productSpecs.screen}</span>
                                          )}
                                        </div>
                                      )}

                                      {item.condition && (
                                        <span className="text-[11px] text-[#8e8e93] font-normal mt-0.5">
                                          {item.condition === 'new' ? 'Mới 100%' : 'Like New 99%'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    <span className="font-medium text-[13px] text-[#48484a] tracking-[0.01em]">
                                      {item.serialNumber}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                    <StatusBadge status={item.status} className="text-[12.5px]" />
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-[#1d1d1f] whitespace-nowrap text-[13.5px]">
                                    {formatPrice(costPriceVal.toString())}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Invoice Summary Sidebar */}
                  <div className="w-full lg:w-[320px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
                    <div className="space-y-6">
                      
                      {/* Section 1: General Metadata */}
                      {isEditingPo ? (
                        <div className="space-y-4">
                          <h3 className="text-[11.5px] font-bold text-[#86868b] uppercase tracking-wider select-none">
                            Cập nhật chi phí
                          </h3>
                          
                          {/* Status Input */}
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#86868b]">Trạng thái đơn nhập:</label>
                            <CustomSelect
                              options={[
                                { value: "in_transit", label: "Đang vận chuyển" },
                                { value: "received", label: "Đã sẵn hàng" },
                                { value: "cancelled", label: "Đã hủy" },
                              ]}
                              value={poStatusInput}
                              onChange={setPoStatusInput}
                              size="sm"
                              rounded="full"
                              dropdownWidth="full"
                            />
                          </div>

                          {/* Shipping Input */}
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-semibold text-[#86868b]">Phí vận chuyển:</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={formatVNDInput(poShippingCostInput)}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "");
                                  setPoShippingCostInput(val ? parseInt(val, 10).toString() : "");
                                }}
                                className="w-full pl-4 pr-8 h-[36px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all text-right"
                                placeholder="0"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#7a7a7a] font-medium pointer-events-none">₫</span>
                            </div>
                          </div>

                          {/* Action Save/Cancel inside sidebar */}
                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                const shippingDigits = poShippingCostInput.replace(/\D/g, "");
                                updatePoMutation.mutate({
                                  id: selectedPoId!,
                                  payload: {
                                    status: poStatusInput as any,
                                    shippingCost: shippingDigits || "0",
                                  }
                                });
                              }}
                              disabled={updatePoMutation.isPending}
                              className="flex-1 h-9 bg-[#0066cc] hover:bg-[#0071e3] text-white text-[13px] font-semibold rounded-full cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center shadow-sm"
                            >
                              {updatePoMutation.isPending ? "Đang lưu..." : "Lưu"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPoStatusInput(poDetailData.po.status);
                                setPoShippingCostInput(poDetailData.po.shippingCost ? Math.round(Number(poDetailData.po.shippingCost)).toString() : "0");
                                setIsEditingPo(false);
                              }}
                              className="px-4 h-9 bg-slate-100 hover:bg-slate-200 text-[#1d1d1f] text-[13px] font-semibold rounded-full cursor-pointer transition-all active:scale-95"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[11.5px] font-bold text-[#86868b] uppercase tracking-wider select-none">
                              Thông tin chung
                            </h3>
                            <button
                              type="button"
                              onClick={() => setIsEditingPo(true)}
                              className="text-[12px] text-[#0066cc] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <SFSymbolSquareAndPencil size={11} />
                              <span>Sửa</span>
                            </button>
                          </div>
                          
                          <div className="space-y-2 text-[13px] text-slate-600">
                            <div className="flex justify-between">
                              <span className="text-[#86868b]">Nhà cung cấp:</span>
                              <span className="font-semibold text-[#1d1d1f]">{poDetailData.po.supplierName || "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#86868b]">Quốc gia gửi:</span>
                              <span className="font-semibold text-[#1d1d1f]">{poDetailData.po.originCountry || "VN"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#86868b]">Hình thức:</span>
                              <span className="font-semibold text-[#1d1d1f]">{poDetailData.po.shippingMethod || "N/A"}</span>
                            </div>
                            {poDetailData.po.trackingNumber && (
                              <div className="flex justify-between">
                                <span className="text-[#86868b]">Mã vận đơn:</span>
                                <span className="font-semibold text-[#1d1d1f] tracking-tight">{poDetailData.po.trackingNumber}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-[#86868b]">Ngày tạo:</span>
                              <span className="font-semibold text-[#1d1d1f]">{formatToDDMMYYYY(poDetailData.po.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <hr className="border-slate-100" />

                      {/* Section 2: Quantities Stats */}
                      <div className="space-y-3">
                        <h3 className="text-[11.5px] font-bold text-[#86868b] uppercase tracking-wider select-none">
                          Phân bổ số lượng
                        </h3>
                        <div className="space-y-2.5 text-[13px]">
                          <div className="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded-lg font-bold text-slate-700">
                            <span>Tổng số máy:</span>
                            <span>{Number(poDetailData.stats?.totalItemsCount || 0)} máy</span>
                          </div>
                          <div className="flex justify-between items-center px-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-slate-600">Sẵn bán:</span>
                            </div>
                            <span className="font-bold text-emerald-600">{Number(poDetailData.stats?.inStockCount || 0)} máy</span>
                          </div>
                          <div className="flex justify-between items-center px-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-slate-600">Đang về:</span>
                            </div>
                            <span className="font-bold text-blue-600">{Number(poDetailData.stats?.incomingCount || 0)} máy</span>
                          </div>
                          <div className="flex justify-between items-center px-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-slate-600">Đang lỗi:</span>
                            </div>
                            <span className="font-bold text-amber-600">{Number(poDetailData.stats?.defectiveCount || 0)} máy</span>
                          </div>
                          <div className="flex justify-between items-center px-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              <span className="text-slate-600">Đã trả NCC:</span>
                            </div>
                            <span className="font-bold text-slate-600">{Number(poDetailData.stats?.returnedCount || 0)} máy</span>
                          </div>
                        </div>
                      </div>

                      <hr className="border-slate-100" />

                      {/* Section 3: Cost Invoice Summary */}
                      <div className="space-y-3 bg-[#f5f5f7]/55 p-3 rounded-xl border border-slate-100">
                        <h3 className="text-[11.5px] font-bold text-[#86868b] uppercase tracking-wider select-none">
                          Hóa đơn chi phí
                        </h3>
                        <div className="space-y-2 text-[13px]">
                          <div className="flex justify-between text-slate-600">
                            <span>Tiền hàng:</span>
                            <span className="font-semibold text-[#1d1d1f]">{formatPrice(poDetailData.po.totalCost)}</span>
                          </div>
                          
                          <div className="flex justify-between text-slate-600">
                            <div className="flex flex-col">
                              <span>Vận chuyển:</span>
                              <span className="text-[10px] text-[#86868b] leading-tight font-medium">
                                Mỗi máy: +{formatPrice((Number(poDetailData.po.shippingCost || 0) / (Number(poDetailData.stats?.totalItemsCount || 0) || 1)).toFixed(2))}
                              </span>
                            </div>
                            <span className="font-semibold text-[#1d1d1f]">
                              +{formatPrice(Number(poDetailData.po.shippingCost || 0).toFixed(2))}
                            </span>
                          </div>

                          {Number(poDetailData.stats?.totalAccessoryCost || 0) > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span>Phụ kiện lẻ:</span>
                              <span className="font-semibold text-[#1d1d1f]">
                                +{formatPrice(Number(poDetailData.stats?.totalAccessoryCost || 0).toFixed(2))}
                              </span>
                            </div>
                          )}

                          <hr className="border-slate-200/80 my-1" />

                          {/* Grand Total Cost */}
                          <div className="flex justify-between items-baseline pt-1">
                            <span className="font-bold text-[#1d1d1f] text-[13.5px]">Tổng đơn nhập:</span>
                            <span className="font-black text-[#0066cc] text-[17px] tracking-tight">
                              {formatPrice(
                                (
                                  Number(poDetailData.po.totalCost || 0) + 
                                  Number(poDetailData.po.shippingCost || 0) + 
                                  Number(poDetailData.stats?.totalAccessoryCost || 0)
                                ).toFixed(2)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                    
                    {/* Sidebar Footer Hint */}
                    <div className="pt-4 text-center text-[10.5px] text-[#86868b] font-medium leading-relaxed border-t border-slate-100 select-none">
                      Phí vận chuyển được phân bổ đều cho tổng số máy thực tế của đơn nhập này.
                    </div>
                  </div>

                </div>
              </>
            )}
            
            </div>
          </div>
        </>,
        document.body
      )}



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

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-32 text-[#86868b]">
        <SFSymbolArrowClockwise className="animate-spin mb-4 text-[#0066cc]" size={28} />
        <p className="text-[16px] font-semibold text-[#1d1d1f]">Đang tải dữ liệu kho hàng...</p>
      </div>
    }>
      <InventoryPageContent />
    </Suspense>
  );
}
