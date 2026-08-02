"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getOrdersList, 
  createOrderAction, 
  cancelOrderAction 
} from "@/app/actions/orders";
import { GlassCard } from "@/components/ui/glass-card";
import { 
  Search, Plus, RefreshCw, ShoppingCart, DollarSign, 
  TrendingUp, AlertCircle, Trash2, 
  Banknote, FileSpreadsheet
} from "lucide-react";
import * as XLSX from "xlsx";
import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { OrderForm } from "@/components/orders/order-form";
import { OrderDetailDialog } from "@/components/orders/order-detail-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { 
  SFSymbolCheckmarkCircle, 
  SFSymbolTruck, 
  SFSymbolShoppingBag, 
  SFSymbolXmarkCircle 
} from "@/components/ui/apple-icons";

function OrdersPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Kích hoạt realtime đồng bộ đơn hàng
  useRealtimeSubscription("orders", [["orders"]]);

  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const selectedStatus = searchParams.get("status") || "all";
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");
  const selectedChannel = searchParams.get("channel") || "all";

  const statusFilterOptions = [
    { value: "all", label: "Tất cả trạng thái" },
    { value: "completed", label: "Hoàn tất" },
    { value: "processing", label: "Đang giao" },
    { value: "cancelled", label: "Đã hủy đơn" },
  ];

  const paymentFilterOptions = [
    { value: "all", label: "Trạng thái thanh toán" },
    { value: "paid", label: "Thanh toán đủ" },
    { value: "partial", label: "Trả một phần" },
    { value: "unpaid", label: "Chờ thanh toán" },
    { value: "refunded", label: "Đã hoàn tiền" },
  ];

  const channelFilterOptions = [
    { value: "all", label: "Kênh bán" },
    { value: "offline", label: "Trực tiếp" },
    { value: "online", label: "Online" },
  ];
  
  // Dialog controls
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Sync selectedOrderIdForDetails with URL query param 'orderId'
  const selectedOrderIdForDetails = searchParams.get("orderId");
  const setSelectedOrderIdForDetails = (orderId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (orderId) {
      params.set("orderId", orderId);
    } else {
      params.delete("orderId");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null);

  // Phân trang & bộ lọc
  const [page, setPage] = useState(1);
  const limit = 20;

  // Tự động quay về trang 1 khi thay đổi bộ lọc hoặc từ khóa tìm kiếm
  useEffect(() => {
    setPage(1);
  }, [search, selectedStatus, selectedPaymentStatus, selectedChannel]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", page, search, selectedStatus, selectedPaymentStatus, selectedChannel],
    queryFn: () => getOrdersList({
      page,
      limit,
      search,
      status: selectedStatus,
      paymentStatus: selectedPaymentStatus,
      saleChannel: selectedChannel,
    }),
    placeholderData: (prev: any) => prev,
    staleTime: 10000,
  });

  const ordersList = data?.orders || [];
  const pagination = data?.pagination || { page: 1, limit: 20, totalItems: 0, totalPages: 1 };
  const stats = data?.stats || { completedCount: 0, processingCount: 0, cancelledCount: 0, onlineCount: 0 };

  // 3. Tạo Đơn hàng
  const createMutation = useMutation({
    mutationFn: createOrderAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["stock-items-select"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setIsCreateOpen(false);
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Lỗi khi lập đơn hàng");
    }
  });

  // 4. Hủy Đơn hàng
  const cancelMutation = useMutation({
    mutationFn: cancelOrderAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["stock-items-select"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setOrderToCancel(null);
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Lỗi khi hủy đơn hàng");
    }
  });

  // Form submit handler
  const handleCreateSubmit = (payload: any) => {
    createMutation.mutate(payload);
  };

  const handleConfirmCancel = () => {
    if (orderToCancel) {
      cancelMutation.mutate(orderToCancel.id);
    }
  };

  const formatPrice = (price: string | number | null) => {
    if (price === null || price === undefined) return "N/A";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(price));
  };

  const formatToDDMMYYYY = (dateString: string | Date | null) => {
    if (!mounted) return "";
    if (!dateString) return "N/A";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "N/A";
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "N/A";
    }
  };

  // Render Status Badge Đơn hàng - Apple style & color-coded matching inventory
  const renderOrderStatus = (status: string) => {
    const configs: Record<string, { text: string; label: string }> = {
      draft: { text: "text-[#7a7a7a]", label: "Nháp" },
      confirmed: { text: "text-[#0369a1]", label: "Đang xử lý" },
      processing: { text: "text-[#b45309]", label: "Đang giao" },
      completed: { text: "text-green-600", label: "Đã hoàn thành" },
      cancelled: { text: "text-[#b91c1c]", label: "Đã hủy" },
      refunded: { text: "text-[#6b21a8]", label: "Hoàn tiền" },
    };
    const c = configs[status] || { text: "text-[#1d1d1f]", label: status };
    return (
      <span className={`text-[13px] font-semibold ${c.text}`}>
        {c.label}
      </span>
    );
  };


  // Render Status Badge Thanh toán - Apple style & color-coded matching inventory
  const renderPaymentStatus = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      unpaid: { bg: "bg-[#fee2e2]/60 border-[#fecaca]", text: "text-[#b91c1c]", label: "Chờ thanh toán" },
      partial: { bg: "bg-[#fef3c7]/60 border-[#fde68a]", text: "text-[#b45309]", label: "Trả một phần" },
      paid: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "Đã thanh toán" },
      refunded: { bg: "bg-[#f5f5f7] border-[#e0e0e0]", text: "text-[#7a7a7a]", label: "Đã hoàn tiền" },
    };
    const c = configs[status] || { bg: "bg-[#f5f5f7] border-[#e0e0e0]", text: "text-[#1d1d1f]", label: status };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold border ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  // Gán filteredOrders bằng danh sách đơn hàng đã được lọc/phân trang từ backend
  const filteredOrders = ordersList;

  // Hàm xuất file Excel danh sách đơn hàng đã lọc
  const handleExportExcel = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      toast.error("Không có dữ liệu đơn hàng để xuất");
      return;
    }

    const wb = XLSX.utils.book_new();
    
    // Tiêu đề và thông tin tổng quan
    const sheetData = [
      ["DANH SÁCH ĐƠN HÀNG TECHSHOP"],
      [`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")} - Tổng số đơn: ${filteredOrders.length}`],
      [],
      [
        "STT",
        "Mã đơn hàng",
        "Ngày tạo",
        "Tên khách hàng",
        "Số điện thoại",
        "Kênh bán",
        "Nguồn dẫn",
        "Trạng thái đơn",
        "Trạng thái thanh toán",
        "Mã vận đơn",
        "Đơn vị vận chuyển",
        "Doanh số (VNĐ)",
        "Lợi nhuận (VNĐ)",
        "Tỷ suất lợi nhuận (%)"
      ],
      ...filteredOrders.map((order, idx) => {
        let statusVN: string = order.status;
        if (order.status === "completed") statusVN = "Hoàn tất";
        else if (order.status === "processing") statusVN = "Đang giao";
        else if (order.status === "cancelled") statusVN = "Đã hủy";
        else if (order.status === "confirmed") statusVN = "Đang xử lý";
        else if (order.status === "draft") statusVN = "Nháp";
        else if (order.status === "refunded") statusVN = "Hoàn tiền";

        let paymentStatusVN: string = order.paymentStatus;
        if (order.paymentStatus === "paid") paymentStatusVN = "Đã thanh toán";
        else if (order.paymentStatus === "unpaid") paymentStatusVN = "Chờ thanh toán";
        else if (order.paymentStatus === "partial") paymentStatusVN = "Trả một phần";
        else if (order.paymentStatus === "refunded") paymentStatusVN = "Đã hoàn tiền";

        const profitMarginVal = order.status === "cancelled" ? 0 : Number(order.profitMargin) || 0;

        return [
          idx + 1,
          order.orderNumber,
          formatToDDMMYYYY(order.createdAt),
          order.customerName,
          order.customerPhone,
          order.saleChannel === "offline" ? "Cửa hàng" : order.saleChannel === "online" ? "Online" : order.saleChannel,
          order.leadSourceName || "",
          statusVN,
          paymentStatusVN,
          order.trackingNumber || "",
          order.shippingCarrier || "",
          order.status === "cancelled" ? 0 : Math.round(Number(order.totalAmount) || 0),
          order.status === "cancelled" ? 0 : Math.round(Number(order.profit) || 0),
          order.status === "cancelled" ? "—" : `${profitMarginVal.toFixed(1)}%`
        ];
      })
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Tự động căn chỉnh độ rộng cột
    const maxColWidth: number[] = [];
    sheetData.forEach((row) => {
      row.forEach((cell, i) => {
        const cellLen = cell ? cell.toString().length : 10;
        maxColWidth[i] = Math.max(maxColWidth[i] || 10, cellLen + 3);
      });
    });
    ws["!cols"] = maxColWidth.map((w) => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, "Danh sách đơn hàng");
    
    // Tải xuống file Excel
    XLSX.writeFile(wb, `DanhSachDonHang_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Đã xuất danh sách đơn hàng ra file Excel (.xlsx) thành công");
  };

  // Số liệu thống kê ở đầu trang lấy từ backend
  const completedOrdersCount = stats.completedCount;
  const processingOrdersCount = stats.processingCount;
  const cancelledOrdersCount = stats.cancelledCount;
  const onlineOrdersCount = stats.onlineCount;

  if (!mounted) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-[#7a7a7a]">
        <RefreshCw className="animate-spin mb-4 text-[#0066cc]" size={24} />
        <p className="text-[15px] font-medium">Đang tải sổ đơn hàng...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Section - Apple premium responsive layout */}
      <div className="pb-6 border-b border-[#e0e0e0]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            
            {/* Search Input - Spotlight dynamic layout */}
            <div className="relative w-full sm:w-[320px] transition-all duration-300">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
              <input 
                type="text" 
                placeholder="Tìm mã đơn, tên khách, số điện thoại..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#7a7a7a]/60 shadow-sm"
              />
            </div>

            {/* Action Buttons Group */}
            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
              {/* Reset Button */}
              {(selectedStatus !== "all" || selectedChannel !== "all" || selectedPaymentStatus !== "all" || search !== "") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedPaymentStatus("all");
                    router.push(pathname);
                  }}
                  className="h-[40px] w-[40px] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 duration-200"
                  title="Đặt lại bộ lọc"
                >
                  <RefreshCw size={14} />
                </button>
              )}

              {/* Excel Export Button */}
              <button
                onClick={handleExportExcel}
                className="h-[40px] w-[40px] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 duration-200"
                title="Xuất file Excel (.xlsx)"
              >
                <FileSpreadsheet size={15} />
              </button>

              {/* Create Button - Rightmost */}
              <button 
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-1.5 px-5 h-[40px] bg-[#0066cc] text-white text-[13px] font-medium rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0"
              >
                <Plus size={14} />
                <span>Tạo đơn hàng</span>
              </button>
            </div>
        </div>
      </div>

      {/* 4. Main Data Card - Crisp Apple store card layout */}
      <GlassCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-[#7a7a7a]">
            <RefreshCw className="animate-spin mb-4 text-[#0066cc]" size={24} />
            <p className="text-[17px]">Đang truy xuất sổ đơn hàng...</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center text-[#b91c1c] text-[17px]">
            Đã xảy ra lỗi khi kết nối dữ liệu đơn hàng. Vui lòng thử lại.
          </div>
        ) : filteredOrders?.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-[#f5f5f7] rounded-full border border-[#e0e0e0] flex items-center justify-center mb-4 text-[#7a7a7a]/60">
              <SFSymbolShoppingBag size={18} />
            </div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-1">Không tìm thấy đơn hàng</h3>
            <p className="text-[13px] text-[#7a7a7a]">
              Không có dữ liệu đơn hàng nào khớp với bộ lọc hoặc tìm kiếm.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap">
                  <th className="px-3 py-3 w-10 text-center border-b border-[#e0e0e0]">STT</th>
                  <th className="px-4 py-3 border-b border-[#e0e0e0]">Đơn hàng</th>
                  <th className="px-4 py-3 border-b border-[#e0e0e0]">Khách hàng</th>
                  <th className="px-4 py-3 border-b border-[#e0e0e0]">Kênh bán</th>
                  <th className="px-4 py-3 text-center border-b border-[#e0e0e0]">Trạng thái</th>
                  <th className="px-4 py-3 text-right border-b border-[#e0e0e0]">Tổng cộng</th>
                  <th className="px-4 py-3 text-right border-b border-[#e0e0e0]">Lợi nhuận</th>
                  <th className="px-3 py-3 w-28 text-center border-b border-[#e0e0e0]">Tác vụ</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-[#1d1d1f]">
                {filteredOrders?.map((order, index) => {
                  const isLast = index === filteredOrders.length - 1;
                  return (
                    <tr 
                      key={order.id} 
                      className="group cursor-pointer"
                      onClick={() => setSelectedOrderIdForDetails(order.id)}
                    >
                      {/* STT */}
                      <td className={`px-3 py-4 w-10 text-center font-semibold text-[#7a7a7a] text-[13px] whitespace-nowrap ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {(page - 1) * limit + index + 1}
                      </td>

                      <td className={`px-4 py-4 whitespace-nowrap ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <div>
                          <p className="font-semibold text-[#0066cc] tracking-tight group-hover:underline whitespace-nowrap" title={order.orderNumber}>
                            {order.orderNumber}
                          </p>
                          <p className="text-[12px] text-[#7a7a7a] font-normal mt-0.5">{formatToDDMMYYYY(order.createdAt)}</p>
                          {order.trackingNumber && (
                            <div className="mt-1 max-w-[160px] truncate" title={`${order.shippingCarrier ? `${order.shippingCarrier}: ` : ""}${order.trackingNumber}`}>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f5f5f7] border border-[#e0e0e0] font-mono text-[11px] text-[#1d1d1f] truncate w-full">
                                🚚 {order.shippingCarrier ? `${order.shippingCarrier}: ` : ""}{order.trackingNumber}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Khách hàng */}
                      <td className={`px-4 py-4 whitespace-nowrap ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <div className="max-w-[150px] truncate" title={order.customerName}>
                          <p className="font-semibold text-[#0066cc] tracking-tight truncate">{order.customerName}</p>
                          <p className="text-[12px] text-[#5856d6] font-medium mt-0.5 truncate">{order.customerPhone}</p>
                        </div>
                      </td>

                      {/* Kênh bán */}
                      <td className={`px-4 py-4 whitespace-nowrap ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        <span className={`capitalize text-[14px] font-semibold ${
                          order.saleChannel === "online" ? "text-[#5856d6]" : "text-[#16a34a]"
                        }`}>{order.saleChannel === "online" ? "Online" : "Offline"}</span>
                        {order.leadSourceName && (
                          <span className="block text-[11px] text-[#7a7a7a] mt-0.5 truncate max-w-[120px]" title={`Nguồn: ${order.leadSourceName}`}>
                            Nguồn: {order.leadSourceName}
                          </span>
                        )}
                      </td>

                      {/* Trạng thái đơn */}
                      <td className={`px-4 py-4 text-center whitespace-nowrap ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {renderOrderStatus(order.status)}
                      </td>

                      {/* Doanh thu */}
                      <td className={`px-4 py-4 text-right whitespace-nowrap ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {order.status === "cancelled" ? (
                          <span className="text-slate-400 font-medium line-through text-[14px]">
                            {formatPrice(order.totalAmount)}
                          </span>
                        ) : (
                          <span className="font-bold text-[#0071e3] text-[15.5px] tracking-tight">
                            {formatPrice(order.totalAmount)}
                          </span>
                        )}
                      </td>

                      {/* Lợi nhuận */}
                      <td className={`px-4 py-4 text-right font-semibold whitespace-nowrap ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}>
                        {order.status === "cancelled" ? (
                          <span className="text-gray-400 font-medium">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className={`block font-bold ${Number(order.profit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {Number(order.profit) >= 0 ? "+" : ""}{formatPrice(order.profit)}
                            </span>
                            <span className={`block text-[11px] font-semibold ${Number(order.profit) >= 0 ? "text-green-500" : "text-red-500"}`}>
                              ({Number(order.profitMargin).toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Tác vụ */}
                      <td 
                        className={`px-3 py-4 text-center w-28 whitespace-nowrap ${isLast ? "" : "border-b border-[#e0e0e0]"} group-hover:border-transparent group-hover:bg-[#0066cc]/10 first:rounded-l-2xl last:rounded-r-2xl transition-all duration-200`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Hủy đơn */}
                          {order.status !== "cancelled" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOrderToCancel(order);
                              }}
                              className="w-10 h-10 bg-red-50 hover:bg-[#ff3b30] border border-red-100 hover:border-[#ff3b30] rounded-2xl text-[#ff3b30] hover:text-white flex items-center justify-center shadow-[0_2px_8px_rgba(255,59,48,0.08)] hover:shadow-[0_4px_12px_rgba(255,59,48,0.2)] transition-all duration-200 cursor-pointer active:scale-95 shrink-0"
                              title="Hủy giao dịch"
                            >
                              <Trash2 size={18} />
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-10 h-10 rounded-2xl bg-[#f5f5f7]/50 border border-[#e0e0e0] text-slate-400 flex items-center justify-center cursor-not-allowed shrink-0"
                              title="Đơn đã hủy"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bộ điều khiển phân trang */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#e0e0e0] flex flex-col sm:flex-row items-center justify-between gap-4 bg-white text-[14px] select-none">
            <div className="text-[#7a7a7a]">
              Hiển thị dòng <b>{(page - 1) * limit + 1}</b> - <b>{Math.min(page * limit, pagination.totalItems)}</b> trong tổng số <b>{pagination.totalItems}</b> đơn hàng
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 hover:border-[#0071e3] hover:text-[#0071e3] hover:bg-blue-50/30 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
              >
                Trước
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                  // Chỉ hiển thị tối đa 5 nút trang xung quanh trang hiện tại
                  if (
                    pagination.totalPages > 5 &&
                    Math.abs(p - page) > 2 &&
                    p !== 1 &&
                    p !== pagination.totalPages
                  ) {
                    if (p === 2 && page > 4) return <span key="dots-1" className="px-1.5 text-slate-400 font-bold">...</span>;
                    if (p === pagination.totalPages - 1 && page < pagination.totalPages - 3) return <span key="dots-2" className="px-1.5 text-slate-400 font-bold">...</span>;
                    return null;
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-7.5 h-7.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer flex items-center justify-center active:scale-90 ${
                        p === page
                          ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20"
                          : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 hover:border-[#0071e3] hover:text-[#0071e3] hover:bg-blue-50/30 disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* dialog Lập đơn hàng mới */}
      <Dialog 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)}
        title="Tạo Đơn Hàng"
        
        size="7xl"
      >
        <OrderForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setIsCreateOpen(false)}
          isLoading={createMutation.isPending}
        />
      </Dialog>

      {/* Dialog chi tiết đơn hàng */}
      <OrderDetailDialog
        isOpen={!!selectedOrderIdForDetails}
        onClose={() => setSelectedOrderIdForDetails(null)}
        orderId={selectedOrderIdForDetails}
      />

      {/* Dialog xác nhận hủy đơn */}
      <ConfirmDialog
        isOpen={!!orderToCancel}
        onClose={() => setOrderToCancel(null)}
        onConfirm={handleConfirmCancel}
        title="Xác nhận hủy đơn bán lẻ"
        description={`Bạn có chắc chắn muốn hủy Đơn hàng "${orderToCancel?.orderNumber}"? Toàn bộ sản phẩm trong đơn sẽ được tự động khôi phục về trạng thái "Sẵn hàng" trong kho, số tiền tích lũy và đơn hàng của khách hàng "${orderToCancel?.customerName}" cũng sẽ tự động khấu trừ.`}
        confirmText="Hủy đơn hàng"
        cancelText="Giữ lại đơn"
        variant="danger"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-32 text-[#86868b]">
        <RefreshCw className="animate-spin mb-4 text-[#0066cc]" size={28} />
        <p className="text-[16px] font-semibold text-[#1d1d1f]">Đang tải danh sách đơn hàng...</p>
      </div>
    }>
      <OrdersPageContent />
    </Suspense>
  );
}
