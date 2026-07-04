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
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { 
  SFSymbolPlus, 
  SFSymbolShippingBox, 
  SFSymbolActivity, 
  SFSymbolArrowClockwise,
  SFSymbolExclamationTriangle,
  SFSymbolTrash,
  SFSymbolCheckmarkCircle,
  SFSymbolWrench,
  SFSymbolMagnifyingGlass
} from "@/components/ui/apple-icons";
import { CustomSelect } from "@/components/ui/custom-select";

// Dialog imports
import { AccessoryCatalogDialog } from "./accessory-catalog-dialog";
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
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
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

  // Filtered Summary List (Left side)
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

  // Filtered Details List (Right side panel)
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

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6 animate-in fade-in duration-200">
      
      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[#e0e0e0]">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <SFSymbolMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
            <input 
              type="text" 
              placeholder="Tìm tên phụ kiện, serial..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13.5px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <CustomSelect
              options={[
                { value: "all", label: "Tất cả trạng thái" },
                { value: "in_stock", label: "Sẵn có trong kho" },
                { value: "attached", label: "Đang gắn kèm máy" },
                { value: "defective", label: "Hàng bị lỗi" },
                { value: "sold", label: "Đã bán / Quà tặng" },
                { value: "returned", label: "Đã trả NCC" },
              ]}
              value={selectedStatus}
              onChange={setSelectedStatus}
              size="sm"
              rounded="full"
              dropdownWidth="full"
            />
          </div>

          {/* Reset Filter Button */}
          {(searchQuery !== "" || selectedStatus !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("all");
              }}
              className="h-[40px] px-4 bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 duration-200 text-[13px] font-medium"
              title="Đặt lại bộ lọc"
            >
              <SFSymbolArrowClockwise size={12} />
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        {/* Quick Stats Ribbon */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/60 px-4.5 py-2.5 rounded-2xl self-stretch lg:self-auto justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span>Tổng nhập: <strong className="text-slate-800 font-bold">{stats.total}</strong></span>
          </div>
          <span className="text-slate-300 select-none hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Sẵn hàng: <strong className="text-emerald-700 font-bold">{stats.available}</strong></span>
          </div>
          <span className="text-slate-300 select-none hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Đang gắn: <strong className="text-blue-700 font-bold">{stats.attached}</strong></span>
          </div>
          <span className="text-slate-300 select-none hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span>Lỗi: <strong className="text-red-700 font-bold">{stats.defective}</strong></span>
          </div>
          <span className="text-slate-300 select-none hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            <span>Đã bán/tặng: <strong className="text-indigo-700 font-bold">{stats.sold}</strong></span>
          </div>
        </div>
      </div>

      {/* Toolbar & Catalog Table */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Side: Summary table */}
        <div className="flex-1 w-full bg-white/70 backdrop-blur-md border border-[#e0e0e0] rounded-3xl overflow-hidden shadow-sm">
          <div className="px-8 py-5 border-b border-[#e0e0e0] flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-[19px] font-bold text-[#1d1d1f]">Kho hàng theo loại phụ kiện</h2>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsCatalogOpen(true)}
                className="px-4 h-[36px] text-[13px] font-semibold rounded-full border border-[#ccc] hover:bg-slate-50 transition cursor-pointer active:scale-95 duration-200 flex items-center justify-center"
              >
                Quản lý danh mục
              </button>
              <button 
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-1.5 px-4 h-[36px] bg-[#0066cc] text-white text-[13px] font-semibold rounded-full hover:bg-[#0071e3] transition cursor-pointer active:scale-95 duration-200 shadow-sm"
              >
                <SFSymbolPlus size={13} />
                <span>Nhập kho phụ kiện</span>
              </button>
            </div>
          </div>

          {isLoadingSummary ? (
            <div className="p-20 text-center flex flex-col items-center justify-center text-[#7a7a7a]">
              <SFSymbolArrowClockwise className="animate-spin mb-4 text-[#0066cc]" size={24} />
              <p className="text-[16px]">Đang tải kho phụ kiện...</p>
            </div>
          ) : summary.length === 0 ? (
            <div className="p-20 text-center text-[#7a7a7a] flex flex-col items-center justify-center">
              <SFSymbolShippingBox size={40} className="mb-4 text-slate-300" />
              <p className="text-[17px] font-semibold text-[#1d1d1f] mb-1">Chưa có dữ liệu kho phụ kiện</p>
              <p className="text-[14px]">Vui lòng tạo danh mục và nhập kho lô phụ kiện đầu tiên.</p>
            </div>
          ) : filteredSummary.length === 0 ? (
            <div className="p-20 text-center text-[#7a7a7a] flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-slate-50 border border-slate-200/50 rounded-full flex items-center justify-center text-slate-400 mb-4">
                <SFSymbolMagnifyingGlass size={20} />
              </div>
              <p className="text-[16px] font-semibold text-[#1d1d1f] mb-1">Không tìm thấy phụ kiện phù hợp</p>
              <p className="text-[13px]">Vui lòng điều chỉnh từ khóa tìm kiếm hoặc bộ lọc trạng thái.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0 border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                    <th className="px-6 py-3 border-b border-[#e0e0e0] w-14 text-center">STT</th>
                    <th className="px-6 py-3 border-b border-[#e0e0e0]">Tên phụ kiện</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0]">Sẵn hàng</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0]">Gắn kèm</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0]">Đã bán</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0]">Kho lỗi</th>
                    <th className="px-6 py-3 text-center border-b border-[#e0e0e0]">Tổng nhập</th>
                    <th className="px-6 py-3 text-right border-b border-[#e0e0e0]">Giá vốn TB</th>
                    <th className="px-6 py-3 text-center w-28 border-b border-[#e0e0e0]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="text-[16px] text-[#1d1d1f]">
                  {filteredSummary.map((row: any, index: number) => {
                    const isSelected = selectedCatalogId === row.id;
                    const isLast = index === summary.length - 1;
                    return (
                      <tr 
                        key={row.id}
                        onClick={() => {
                          setSelectedCatalogId(row.id);
                          setSelectedCatalogName(row.name);
                        }}
                        className={`hover:bg-[#f5f5f7]/40 cursor-pointer transition-colors duration-150 ${
                          isSelected ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <td className={`px-6 py-3 text-center border-b border-[#e0e0e0] ${isLast ? "border-b-0" : ""}`}>
                          {index + 1}
                        </td>
                        <td className={`px-6 py-3 font-semibold border-b border-[#e0e0e0] ${isLast ? "border-b-0" : ""}`}>
                          {row.name}
                        </td>
                        <td className={`px-6 py-3 text-center border-b border-[#e0e0e0] text-emerald-600 font-bold ${isLast ? "border-b-0" : ""}`}>
                          {row.available}
                        </td>
                        <td className={`px-6 py-3 text-center border-b border-[#e0e0e0] text-blue-600 font-semibold ${isLast ? "border-b-0" : ""}`}>
                          {row.attached}
                        </td>
                        <td className={`px-6 py-3 text-center border-b border-[#e0e0e0] text-slate-500 ${isLast ? "border-b-0" : ""}`}>
                          {row.sold}
                        </td>
                        <td className={`px-6 py-3 text-center border-b border-[#e0e0e0] text-red-500 font-semibold ${isLast ? "border-b-0" : ""}`}>
                          {row.defective}
                        </td>
                        <td className={`px-6 py-3 text-center border-b border-[#e0e0e0] font-bold ${isLast ? "border-b-0" : ""}`}>
                          {row.total}
                        </td>
                        <td className={`px-6 py-3 text-right border-b border-[#e0e0e0] font-mono text-[14px] ${isLast ? "border-b-0" : ""}`}>
                          {Number(row.averageCost).toLocaleString("vi-VN")}đ
                        </td>
                        <td className={`px-6 py-3 text-center border-b border-[#e0e0e0] ${isLast ? "border-b-0" : ""}`}>
                          <button
                            type="button"
                            className={`px-3 py-1 text-[12px] font-semibold rounded-full border transition active:scale-95 cursor-pointer ${
                              isSelected 
                                ? "bg-[#0066cc] text-white border-transparent" 
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            Chi tiết
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

        {/* Right Side: Detailed Items lists */}
        {selectedCatalogId && (
          <div className="w-full lg:w-[480px] shrink-0 bg-white/80 backdrop-blur-md border border-[#e0e0e0] rounded-3xl shadow-sm overflow-hidden flex flex-col max-h-[750px]">
            <div className="px-6 py-5 border-b border-[#e0e0e0] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">Danh sách chi tiết</span>
                <span className="text-[16px] font-bold text-[#1d1d1f] truncate max-w-[280px]">{selectedCatalogName}</span>
              </div>
              <button 
                onClick={() => setSelectedCatalogId(null)}
                className="text-[13px] font-semibold text-[#7a7a7a] hover:text-[#1d1d1f]"
              >
                Đóng
              </button>
            </div>

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
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                {filteredDetails.map((item: any) => {
                  const statusConfig: Record<string, { label: string; class: string }> = {
                    in_stock: { label: "Sẵn có", class: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
                    attached: { label: "Đang gắn", class: "bg-blue-50 text-blue-600 border border-blue-200" },
                    sold: { label: "Đã bán/tặng", class: "bg-slate-100 text-slate-600 border border-slate-200" },
                    defective: { label: "Kho lỗi", class: "bg-red-50 text-red-600 border border-red-200" },
                    returned: { label: "Trả NCC", class: "bg-amber-50 text-amber-600 border border-amber-200" },
                  };
                  const cfg = statusConfig[item.status] || { label: item.status, class: "bg-slate-100" };

                  return (
                    <div 
                      key={item.id}
                      className="p-4 bg-white/70 border border-[#e0e0e0] rounded-2xl flex flex-col gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13.5px] font-mono font-bold text-[#1d1d1f]">
                          {item.serialNumber ? `S/N: ${item.serialNumber}` : "Không Serial"}
                        </span>
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full leading-none ${cfg.class}`}>
                          {cfg.label}
                        </span>
                      </div>

                      <div className="text-[13px] text-[#7a7a7a] flex flex-col gap-1 border-t border-slate-100 pt-2">
                        <div className="flex justify-between">
                          <span>Mã lô nhập:</span>
                          <span className="font-mono text-slate-800">{item.batchCode?.slice(0, 16) || "N/A"}</span>
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
                            <span className="font-mono text-blue-700">S/N máy: {item.machineSerialNumber}</span>
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
          </div>
        )}

      </div>

      {/* Dialogs */}
      <AccessoryCatalogDialog 
        isOpen={isCatalogOpen} 
        onClose={() => setIsCatalogOpen(false)} 
      />

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
