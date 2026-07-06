"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAccessoryStockSummary, 
  getAccessoryItemsByCatalog, 
  detachAccessoryFromMachine, 
  markAccessoryDefective, 
  restoreAccessoryFromDefective 
} from "@/app/actions/inventory";
import { GlassCard } from "@/components/ui/glass-card";
import { toast } from "sonner";
import { 
  SFSymbolPlus, 
  SFSymbolShippingBox, 
  SFSymbolArrowClockwise,
  SFSymbolExclamationTriangle,
  SFSymbolCheckmarkCircle,
  SFSymbolWrench,
  SFSymbolMagnifyingGlass
} from "@/components/ui/apple-icons";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog } from "@/components/ui/dialog";

// Dialog imports
import { AccessoryImportDialog } from "./accessory-import-dialog";
import { AttachAccessoryDialog } from "./attach-accessory-dialog";

export function AccessoryInventoryTab() {
  const queryClient = useQueryClient();
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedCatalogName, setSelectedCatalogName] = useState<string>("");
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  
  // Dialog Open states
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [targetAccIdForAttach, setTargetAccIdForAttach] = useState<string | undefined>(undefined);

  // Fetch stock summary (catalog-level)
  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["accessoryStockSummary"],
    queryFn: () => getAccessoryStockSummary(),
  });

  // Fetch detailed items (item-level) for selected catalog type
  const { data: itemsData, isLoading: isLoadingItems } = useQuery({
    queryKey: ["accessoryItems", selectedCatalogId],
    queryFn: () => getAccessoryItemsByCatalog(selectedCatalogId!),
    enabled: !!selectedCatalogId,
  });

  // Mutations
  const detachMutation = useMutation({
    mutationFn: detachAccessoryFromMachine,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryItems", selectedCatalogId] });
      } else {
        toast.error(res.message);
      }
    },
  });

  const defectiveMutation = useMutation({
    mutationFn: markAccessoryDefective,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryItems", selectedCatalogId] });
      } else {
        toast.error(res.message);
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreAccessoryFromDefective,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["accessoryStockSummary"] });
        queryClient.invalidateQueries({ queryKey: ["accessoryItems", selectedCatalogId] });
      } else {
        toast.error(res.message);
      }
    },
  });

  const summary = summaryData?.summary || [];
  const detailsList = itemsData?.items || [];

  // Filtered Summary List
  const filteredSummary = useMemo(() => {
    return summary.filter((row: any) => {
      const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = true;
      if (selectedStatus === "in_stock") matchesStatus = row.available > 0;
      else if (selectedStatus === "attached") matchesStatus = row.attached > 0;
      else if (selectedStatus === "defective") matchesStatus = row.defective > 0;
      else if (selectedStatus === "sold") matchesStatus = row.sold > 0;
      else if (selectedStatus === "returned") matchesStatus = row.returned > 0;

      return matchesSearch && matchesStatus;
    });
  }, [summary, searchQuery, selectedStatus]);

  // Filtered Details List
  const filteredDetails = useMemo(() => {
    return detailsList.filter((item: any) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        (item.serialNumber && item.serialNumber.toLowerCase().includes(query)) ||
        (item.batchCode && item.batchCode.toLowerCase().includes(query)) ||
        (item.supplierName && item.supplierName.toLowerCase().includes(query)) ||
        (item.productName && item.productName.toLowerCase().includes(query)) ||
        (item.machineSerialNumber && item.machineSerialNumber.toLowerCase().includes(query));

      const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [detailsList, searchQuery, selectedStatus]);

  // Compute total stats
  const stats = summary.reduce(
    (acc, cur) => {
      acc.total += cur.total;
      acc.available += cur.available;
      acc.attached += cur.attached;
      acc.sold += cur.sold;
      acc.defective += cur.defective;
      return acc;
    },
    { total: 0, available: 0, attached: 0, sold: 0, defective: 0 }
  );

  const handleOpenAttach = (accId: string) => {
    setTargetAccIdForAttach(accId);
    setIsAttachOpen(true);
  };

  // Determine active tab index for sliding indicator position and width in Segmented Control
  const activeSegmentIndex = useMemo(() => {
    if (selectedStatus === "all") return 0;
    if (selectedStatus === "in_stock") return 1;
    if (selectedStatus === "attached") return 2;
    if (selectedStatus === "defective") return 3;
    return 0;
  }, [selectedStatus]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. Filter Bar - Unified style */}
      <div className="flex flex-wrap items-center gap-3 pb-6 border-b border-[#e0e0e0] w-full">
        
        {/* Status Segmented Control (replaces Status Dropdown) */}
        <div className="relative flex bg-[#f5f5f7] p-[3px] rounded-full border border-[#e0e0e0] h-[40px] w-full sm:w-[540px] shrink-0 select-none overflow-hidden">
          {/* Sliding active indicator */}
          <div 
            className="absolute top-[3px] bottom-[3px] rounded-full bg-[#0066cc] shadow-[0_2px_4px_rgba(0,102,204,0.25)]"
            style={{
              width: "calc(25% - 6px)",
              left: `calc(${activeSegmentIndex * 25}% + 3px)`,
              transition: "left 280ms cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          />

          {/* Tab 1: Tất cả */}
          <button
            onClick={() => setSelectedStatus("all")}
            className={`w-1/4 h-full relative z-10 flex items-center justify-center gap-1.5 px-1 rounded-full text-[13px] transition-colors duration-200 cursor-pointer active:scale-98 ${
              activeSegmentIndex === 0 ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
            }`}
          >
            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-white shrink-0 transition-all duration-200 ${
              activeSegmentIndex === 0
                ? "bg-transparent shadow-none"
                : "bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] shadow-[0_1px_2px_rgba(0,102,204,0.1)]"
            }`}>
              <SFSymbolShippingBox size={activeSegmentIndex === 0 ? 13 : 10} className="transition-all duration-200" />
            </div>
            <span className="truncate">Tất cả</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors duration-200 ${activeSegmentIndex === 0 ? "bg-white/20 text-white" : "bg-slate-200/50 text-[#7a7a7a]"}`}>
              {stats.total || 0}
            </span>
          </button>

          {/* Tab 2: Sẵn kho */}
          <button
            onClick={() => setSelectedStatus("in_stock")}
            className={`w-1/4 h-full relative z-10 flex items-center justify-center gap-1.5 px-1 rounded-full text-[13px] transition-colors duration-200 cursor-pointer active:scale-98 ${
              activeSegmentIndex === 1 ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
            }`}
          >
            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-white shrink-0 transition-all duration-200 ${
              activeSegmentIndex === 1
                ? "bg-transparent shadow-none"
                : "bg-gradient-to-br from-[#34c759] to-[#28a745] shadow-[0_1px_2px_rgba(52,199,89,0.1)]"
            }`}>
              <SFSymbolCheckmarkCircle size={activeSegmentIndex === 1 ? 13 : 10} className="transition-all duration-200" />
            </div>
            <span className="truncate">Sẵn kho</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors duration-200 ${activeSegmentIndex === 1 ? "bg-white/20 text-white" : "bg-slate-200/50 text-[#7a7a7a]"}`}>
              {stats.available || 0}
            </span>
          </button>

          {/* Tab 3: Đang gắn */}
          <button
            onClick={() => setSelectedStatus("attached")}
            className={`w-1/4 h-full relative z-10 flex items-center justify-center gap-1.5 px-1 rounded-full text-[13px] transition-colors duration-200 cursor-pointer active:scale-98 ${
              activeSegmentIndex === 2 ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
            }`}
          >
            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-white shrink-0 transition-all duration-200 ${
              activeSegmentIndex === 2
                ? "bg-transparent shadow-none"
                : "bg-gradient-to-br from-[#af52de] to-[#7a2bc2] shadow-[0_1px_2px_rgba(175,82,222,0.1)]"
            }`}>
              <SFSymbolWrench size={activeSegmentIndex === 2 ? 13 : 10} className="transition-all duration-200" />
            </div>
            <span className="truncate">Đang gắn</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors duration-200 ${activeSegmentIndex === 2 ? "bg-white/20 text-white" : "bg-slate-200/50 text-[#7a7a7a]"}`}>
              {stats.attached || 0}
            </span>
          </button>

          {/* Tab 4: Hàng lỗi */}
          <button
            onClick={() => setSelectedStatus("defective")}
            className={`w-1/4 h-full relative z-10 flex items-center justify-center gap-1.5 px-1 rounded-full text-[13px] transition-colors duration-200 cursor-pointer active:scale-98 ${
              activeSegmentIndex === 3 ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
            }`}
          >
            <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-white shrink-0 transition-all duration-200 ${
              activeSegmentIndex === 3
                ? "bg-transparent shadow-none"
                : "bg-gradient-to-br from-[#ff2d55] to-[#d6001c] shadow-[0_1px_2px_rgba(255,45,85,0.15)]"
            }`}>
              <SFSymbolExclamationTriangle size={activeSegmentIndex === 3 ? 13 : 10} className="transition-all duration-200" />
            </div>
            <span className="truncate">Hàng lỗi</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors duration-200 ${activeSegmentIndex === 3 ? "bg-white/20 text-white" : "bg-slate-200/50 text-[#7a7a7a]"}`}>
              {stats.defective || 0}
            </span>
          </button>
        </div>

        {/* Search Input - Spotlight dynamic layout */}
        <div className="relative flex-1 min-w-[180px] max-w-[320px] transition-all duration-300">
          <SFSymbolMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
          <input 
            type="text" 
            placeholder="Tìm phụ kiện..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#7a7a7a]/60 shadow-sm"
          />
        </div>

        {/* Reset Filter Button */}
        {(searchQuery !== "" || selectedStatus !== "all") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedStatus("all");
            }}
            className="h-[40px] w-[40px] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 duration-200"
            title="Đặt lại bộ lọc"
          >
            <SFSymbolArrowClockwise size={14} />
          </button>
        )}

        {/* Nhập kho Button */}
        <button 
          onClick={() => setIsImportOpen(true)}
          className="flex items-center gap-1.5 px-5 h-[40px] bg-[#0066cc] text-white text-[13px] font-semibold rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0 sm:ml-auto"
        >
          <SFSymbolPlus size={13} />
          <span>Nhập kho phụ kiện</span>
        </button>
      </div>

      {/* 4. Main Data Card - Uniform GlassCard Style */}
      <GlassCard className="p-0 overflow-hidden">
        {isLoadingSummary ? (
          <div className="p-16 flex flex-col items-center justify-center text-[#7a7a7a]">
            <SFSymbolArrowClockwise className="animate-spin mb-4 text-[#0066cc]" size={24} />
            <p className="text-[17px]">Đang truy xuất kho phụ kiện...</p>
          </div>
        ) : summary.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-[#f5f5f7] rounded-full border border-[#e0e0e0] flex items-center justify-center mb-6 text-[#7a7a7a]">
              <SFSymbolShippingBox size={24} />
            </div>
            <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-2">
              Kho phụ kiện chưa có sản phẩm
            </h3>
            <p className="text-[17px] text-[#7a7a7a] mb-8 max-w-md leading-[1.47]">
              Hệ thống chưa ghi nhận loại phụ kiện nào. Hãy click vào nút Nhập kho phụ kiện để bắt đầu thêm mới.
            </p>
          </div>
        ) : filteredSummary.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-[#f5f5f7] rounded-full border border-[#e0e0e0] flex items-center justify-center mb-6 text-[#7a7a7a]">
              <SFSymbolMagnifyingGlass size={24} />
            </div>
            <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-2">
              Không tìm thấy kết quả phù hợp
            </h3>
            <p className="text-[17px] text-[#7a7a7a] mb-8 max-w-md leading-[1.47]">
              Hãy điều chỉnh từ khóa tìm kiếm hoặc bộ lọc trạng thái để tìm thấy phụ kiện của bạn.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0 border-collapse">
              <thead>
                <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                  <th className="px-6 py-3 w-16 text-center border-b border-[#e0e0e0] whitespace-nowrap">STT</th>
                  <th className="px-6 py-3 border-b border-[#e0e0e0] whitespace-nowrap">Tên phụ kiện</th>
                  <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Sẵn hàng</th>
                  <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Gắn kèm</th>
                  <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Đã bán</th>
                  <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Kho lỗi</th>
                  <th className="px-6 py-3 text-center border-b border-[#e0e0e0] whitespace-nowrap">Tổng nhập</th>
                  <th className="px-6 py-3 text-right border-b border-[#e0e0e0] whitespace-nowrap">Giá vốn TB</th>
                </tr>
              </thead>
              <tbody className="text-[16px] text-[#1d1d1f]">
                {filteredSummary.map((row: any, index: number) => {
                  const isLast = index === filteredSummary.length - 1;
                  return (
                    <tr 
                      key={row.id} 
                      className="group cursor-pointer"
                      onClick={() => {
                        setSelectedCatalogId(row.id);
                        setSelectedCatalogName(row.name);
                      }}
                    >
                      <td className={`px-6 py-3 text-center font-semibold text-[#7a7a7a] text-[14px] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {index + 1}
                      </td>
                      <td className={`px-6 py-3 ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <p className="font-semibold text-[#1d1d1f] tracking-tight group-hover:text-[#0066cc] transition-colors duration-200">
                          {row.name}
                        </p>
                      </td>
                      <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <span className="text-[13.5px] font-semibold text-emerald-600">
                          {row.available} cái
                        </span>
                      </td>
                      <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <span className="text-[13.5px] font-semibold text-blue-600">
                          {row.attached} cái
                        </span>
                      </td>
                      <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <span className="text-[13.5px] font-semibold text-[#7a7a7a]">
                          {row.sold} cái
                        </span>
                      </td>
                      <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <span className="text-[13.5px] font-semibold text-red-600">
                          {row.defective} cái
                        </span>
                      </td>
                      <td className={`px-6 py-3 text-center ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <span className="text-[13.5px] font-bold text-[#1d1d1f]">
                          {row.total} cái
                        </span>
                      </td>
                      <td className={`px-6 py-3 text-right font-semibold text-[#1d1d1f] ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {Number(row.averageCost).toLocaleString("vi-VN")}đ
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* 5. Detailed Items Dialog overlay */}
      <Dialog
        isOpen={!!selectedCatalogId}
        onClose={() => setSelectedCatalogId(null)}
        title={selectedCatalogName}
        description="Chi tiết từng chiếc phụ kiện vật lý và lịch sử luồng kho"
        size="2xl"
      >
        {isLoadingItems ? (
          <div className="p-16 text-center flex flex-col items-center justify-center text-[#7a7a7a]">
            <SFSymbolArrowClockwise className="animate-spin mb-3 text-[#0066cc]" size={20} />
            <p className="text-[14px]">Đang tải chi tiết...</p>
          </div>
        ) : filteredDetails.length === 0 ? (
          <div className="p-16 text-center text-[#7a7a7a]">
            Không tìm thấy phụ kiện lẻ nào khớp với bộ lọc/tìm kiếm hiện tại.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1 flex flex-col gap-4">
            {filteredDetails.map((item: any) => {
              const statusConfig: Record<string, { label: string; class: string }> = {
                in_stock: { label: "Sẵn hàng", class: "bg-emerald-50 text-emerald-700 border border-emerald-200/50" },
                attached: { label: "Đang gắn", class: "bg-blue-50 text-blue-700 border border-blue-200/50" },
                sold: { label: "Đã bán", class: "bg-slate-50 text-slate-500 border-slate-200/50" },
                defective: { label: "Lỗi", class: "bg-red-50 text-red-600 border-red-200/50" },
                returned: { label: "Đã trả NCC", class: "bg-slate-50 text-slate-500 border-slate-200/50" },
              };
              const cfg = statusConfig[item.status] || { label: item.status, class: "bg-slate-100" };

              return (
                <div 
                  key={item.id}
                  className="p-4 bg-white/70 border border-[#e0e0e0] rounded-2xl flex flex-col gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-semibold text-[#1d1d1f]">
                      {item.serialNumber ? `S/N: ${item.serialNumber}` : "Không Serial"}
                    </span>
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full leading-none ${cfg.class}`}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="text-[13px] text-[#7a7a7a] flex flex-col gap-1 border-t border-slate-100 pt-2">
                    <div className="flex justify-between">
                      <span>Mã lô nhập:</span>
                      <span className="font-semibold text-slate-800">{item.batchCode?.slice(0, 16) || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Giá vốn nhập:</span>
                      <span className="font-semibold text-slate-800">{Number(item.unitCost).toLocaleString("vi-VN")}đ</span>
                    </div>
                    {item.supplierName && (
                      <div className="flex justify-between">
                        <span>NCC:</span>
                        <span className="text-slate-800 truncate max-w-[200px]">{item.supplierName}</span>
                      </div>
                    )}
                    
                    {item.status === 'attached' && (
                      <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 mt-1.5 flex flex-col gap-1 text-[12px]">
                        <span className="font-bold text-blue-800">Gắn vào thiết bị:</span>
                        <span className="text-blue-900 font-semibold">{item.productName}</span>
                        <span className="font-semibold text-blue-700">S/N máy: {item.machineSerialNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Item-level Actions */}
                  <div className="flex gap-2 justify-end border-t border-slate-100 pt-2">
                    {item.status === 'in_stock' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenAttach(item.id)}
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[12px] font-bold rounded-lg transition active:scale-95"
                        >
                          Gắn vào máy
                        </button>
                        <button
                          type="button"
                          onClick={() => defectiveMutation.mutate(item.id)}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-[12px] font-bold rounded-lg transition active:scale-95"
                        >
                          Báo lỗi
                        </button>
                      </>
                    )}

                    {item.status === 'attached' && (
                      <button
                        type="button"
                        onClick={() => detachMutation.mutate(item.id)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg transition active:scale-95 flex items-center gap-1"
                      >
                        <SFSymbolWrench size={11} />
                        <span>Tháo khỏi máy</span>
                      </button>
                    )}

                    {item.status === 'defective' && (
                      <button
                        type="button"
                        onClick={() => restoreMutation.mutate(item.id)}
                        className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-[12px] font-bold rounded-lg transition active:scale-95"
                      >
                        Khôi phục kho
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Dialog>

      {/* Dialogs */}
      <AccessoryImportDialog 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
      />

      <AttachAccessoryDialog 
        isOpen={isAttachOpen} 
        onClose={() => {
          setIsAttachOpen(false);
          setTargetAccIdForAttach(undefined);
        }}
        accessoryItemId={targetAccIdForAttach}
      />

    </div>
  );
}
