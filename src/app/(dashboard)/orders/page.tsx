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
  TrendingUp, AlertCircle, Eye, Trash2, 
  Banknote
} from "lucide-react";
import { useState, useEffect, Suspense } from "react";
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
  
  // Kích hoạt realtime đồng bộ đơn hàng
  useRealtimeSubscription("orders", [["orders"]]);

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

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

  // 1. Fetch danh sách đơn hàng với bộ lọc từ server
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
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: "bg-[#f5f5f7] border-[#e0e0e0]", text: "text-[#7a7a7a]", label: "Nháp" },
      confirmed: { bg: "bg-[#e0f2fe]/60 border-[#bae6fd]", text: "text-[#0369a1]", label: "Đang xử lý" },
      processing: { bg: "bg-[#fef3c7]/60 border-[#fde68a]", text: "text-[#b45309]", label: "Đang giao" },
      completed: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "Đã hoàn thành" },
      cancelled: { bg: "bg-[#fee2e2]/60 border-[#fecaca]", text: "text-[#b91c1c]", label: "Đã hủy" },
      refunded: { bg: "bg-[#f3e8ff] border-[#e9d5ff]", text: "text-[#6b21a8]", label: "Hoàn tiền" },
    };
    const c = configs[status] || { bg: "bg-[#f5f5f7] border-[#e0e0e0]", text: "text-[#1d1d1f]", label: status };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold border ${c.bg} ${c.text}`}>
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

  // Số liệu thống kê ở đầu trang lấy từ backend
  const completedOrdersCount = stats.completedCount;
  const processingOrdersCount = stats.processingCount;
  const cancelledOrdersCount = stats.cancelledCount;
  const onlineOrdersCount = stats.onlineCount;

  return (
    <div className="space-y-8">
      {/* 1. Header Section - Apple premium single-row layout */}
      <div className="pb-6 border-b border-[#e0e0e0]">
        <div className="flex flex-wrap items-center gap-3 justify-start">
            {/* Search Input - Leftmost */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
              <input 
                type="text" 
                placeholder="Tìm mã đơn, SĐT..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
              />
            </div>

            {/* Trạng thái đơn hàng Filter */}
            <div className="w-full sm:w-44">
              <CustomSelect
                options={statusFilterOptions}
                value={selectedStatus}
                onChange={setSelectedStatus}
                size="sm"
                rounded="full"
                dropdownWidth="full"
              />
            </div>

            {/* Trạng thái thanh toán Filter */}
            <div className="w-full sm:w-48">
              <CustomSelect
                options={paymentFilterOptions}
                value={selectedPaymentStatus}
                onChange={setSelectedPaymentStatus}
                size="sm"
                rounded="full"
                dropdownWidth="full"
              />
            </div>

            {/* Kênh bán hàng Filter */}
            <div className="w-full sm:w-32">
              <CustomSelect
                options={channelFilterOptions}
                value={selectedChannel}
                onChange={setSelectedChannel}
                size="sm"
                rounded="full"
                dropdownWidth="full"
              />
            </div>

            {/* Reset Button */}
            {(selectedStatus !== "all" || selectedPaymentStatus !== "all" || selectedChannel !== "all" || search !== "") && (
              <button
                onClick={() => {
                  setSelectedStatus("all");
                  setSelectedPaymentStatus("all");
                  setSelectedChannel("all");
                  setSearch("");
                }}
                className="h-[40px] w-[40px] bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 duration-200"
                title="Đặt lại bộ lọc"
              >
                <RefreshCw size={14} />
              </button>
            )}

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Đơn hoàn tất */}
        <div 
          onClick={() => {
            setSelectedStatus(selectedStatus === "completed" ? "all" : "completed");
            setSelectedPaymentStatus("all");
          }}
          className={`group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 cursor-pointer select-none active:scale-[0.97] border border-white/10 ${
            selectedStatus === "completed"
              ? "bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] shadow-[0_10px_25px_rgba(0,102,204,0.3)] opacity-100 scale-100 ring-2 ring-[#0066cc]/40 ring-offset-2 ring-offset-white"
              : "bg-gradient-to-br from-[#2ea1ff]/90 to-[#0066cc]/90 shadow-[0_4px_12px_rgba(0,0,0,0.05)] opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(0,102,204,0.15)]"
          }`}
        >
          {/* Top Row with Label and Icon */}
          <div className="relative z-20 flex justify-between items-start">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
              Đơn hoàn thành
            </span>
            <div className="relative w-8 h-8 shrink-0">
              {/* Main Icon */}
              <div className="absolute inset-0 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:opacity-0 group-hover:scale-75 transition-all duration-200">
                <SFSymbolCheckmarkCircle size={16} />
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
            {completedOrdersCount}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* Card 2: Đang giao */}
        <div 
          onClick={() => {
            setSelectedStatus(selectedStatus === "processing" ? "all" : "processing");
            setSelectedPaymentStatus("all");
          }}
          className={`group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 cursor-pointer select-none active:scale-[0.97] border border-white/10 ${
            selectedStatus === "processing"
              ? "bg-gradient-to-br from-[#ff9f0a] to-[#ff7b00] shadow-[0_10px_25px_rgba(255,159,10,0.3)] opacity-100 scale-100 ring-2 ring-[#ff9f0a]/40 ring-offset-2 ring-offset-white"
              : "bg-gradient-to-br from-[#ff9f0a]/90 to-[#ff7b00]/90 shadow-[0_4px_12px_rgba(0,0,0,0.05)] opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(255,159,10,0.15)]"
          }`}
        >
          {/* Top Row with Label and Icon */}
          <div className="relative z-20 flex justify-between items-start">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
              Đơn đang giao
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
            {processingOrdersCount}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* Card 3: Đơn bán online */}
        <div 
          onClick={() => {
            setSelectedChannel(selectedChannel === "online" ? "all" : "online");
            setSelectedStatus("all");
            setSelectedPaymentStatus("all");
          }}
          className={`group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 cursor-pointer select-none active:scale-[0.97] border border-white/10 ${
            selectedChannel === "online"
              ? "bg-gradient-to-br from-[#af52de] to-[#892ec0] shadow-[0_10px_25px_rgba(175,82,222,0.3)] opacity-100 scale-100 ring-2 ring-[#af52de]/40 ring-offset-2 ring-offset-white"
              : "bg-gradient-to-br from-[#af52de]/90 to-[#892ec0]/90 shadow-[0_4px_12px_rgba(0,0,0,0.05)] opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(175,82,222,0.15)]"
          }`}
        >
          {/* Top Row with Label and Icon */}
          <div className="relative z-20 flex justify-between items-start">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
              Đơn bán online
            </span>
            <div className="relative w-8 h-8 shrink-0">
              {/* Main Icon */}
              <div className="absolute inset-0 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:opacity-0 group-hover:scale-75 transition-all duration-200">
                <SFSymbolShoppingBag size={16} />
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
            {onlineOrdersCount}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>

        {/* Card 4: Đã hủy */}
        <div 
          onClick={() => {
            setSelectedStatus(selectedStatus === "cancelled" ? "all" : "cancelled");
            setSelectedPaymentStatus("all");
          }}
          className={`group relative overflow-hidden rounded-[22px] p-5 h-[120px] flex flex-col justify-between transition-all duration-300 cursor-pointer select-none active:scale-[0.97] border border-white/10 ${
            selectedStatus === "cancelled"
              ? "bg-gradient-to-br from-slate-400 to-slate-600 shadow-[0_10px_25px_rgba(100,116,139,0.3)] opacity-100 scale-100 ring-2 ring-slate-400/40 ring-offset-2 ring-offset-white"
              : "bg-gradient-to-br from-slate-400/90 to-slate-600/90 shadow-[0_4px_12px_rgba(0,0,0,0.05)] opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-[0_8px_20px_rgba(100,116,139,0.15)]"
          }`}
        >
          {/* Top Row with Label and Icon */}
          <div className="relative z-20 flex justify-between items-start">
            <span className="text-[12px] font-bold uppercase tracking-wider text-white/70">
              Đơn đã hủy
            </span>
            <div className="relative w-8 h-8 shrink-0">
              {/* Main Icon */}
              <div className="absolute inset-0 rounded-[9px] bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:opacity-0 group-hover:scale-75 transition-all duration-200">
                <SFSymbolXmarkCircle size={16} />
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
            {cancelledOrdersCount}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
            <div className="w-16 h-16 bg-[#f5f5f7] rounded-full border border-[#e0e0e0] flex items-center justify-center mb-6 text-[#7a7a7a]">
              <ShoppingCart size={24} />
            </div>
            <h3 className="text-[21px] font-semibold text-[#1d1d1f] mb-2">Chưa có đơn hàng nào</h3>
            <p className="text-[17px] text-[#7a7a7a] mb-8 max-w-md leading-[1.47]">
              Sổ đơn hàng hiện tại đang trống. Hãy lập đơn hàng mới để bắt đầu ghi nhận doanh thu.
            </p>
            <button 
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-6 h-[44px] bg-[#0066cc] text-white text-[14px] font-normal rounded-full hover:bg-[#0071e3] transition-all cursor-pointer active:scale-95 duration-200"
            >
              <Plus size={16} />
              <span>Tạo mới ngay</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e0e0e0] bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                  <th className="px-3 py-3 w-10 text-center whitespace-nowrap">STT</th>
                  <th className="px-4 py-3 whitespace-nowrap">Đơn hàng</th>
                  <th className="px-4 py-3 whitespace-nowrap">Khách hàng</th>
                  <th className="px-4 py-3 whitespace-nowrap">Kênh bán</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Trạng thái</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Tổng cộng</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Lợi nhuận</th>
                  <th className="px-3 py-3 w-28 text-center whitespace-nowrap">Tác vụ</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-[#1d1d1f]">
                {filteredOrders?.map((order, index) => (
                  <tr 
                    key={order.id} 
                    className="border-b border-[#e0e0e0] last:border-0 hover:bg-[#f5f5f7]/60 transition-colors"
                  >
                    {/* STT */}
                    <td className="px-3 py-4 w-10 text-center font-semibold text-[#7a7a7a] text-[13px] whitespace-nowrap">
                      {index + 1}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-semibold text-[#0066cc] tracking-tight hover:underline cursor-pointer whitespace-nowrap" onClick={() => setSelectedOrderIdForDetails(order.id)} title={order.orderNumber}>
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
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="max-w-[150px] truncate" title={order.customerName}>
                        <p className="font-semibold text-[#1d1d1f] tracking-tight truncate">{order.customerName}</p>
                        <p className="text-[12px] text-[#7a7a7a] mt-0.5 truncate">{order.customerPhone}</p>
                      </div>
                    </td>

                    {/* Kênh bán */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="capitalize text-[14px] text-[#1d1d1f] font-medium">{order.saleChannel}</span>
                      {order.leadSourceName && (
                        <span className="block text-[11px] text-[#7a7a7a] mt-0.5 truncate max-w-[120px]" title={`Nguồn: ${order.leadSourceName}`}>
                          Nguồn: {order.leadSourceName}
                        </span>
                      )}
                    </td>

                    {/* Trạng thái đơn */}
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      {renderOrderStatus(order.status)}
                    </td>



                    {/* Doanh thu */}
                    <td className="px-4 py-4 text-right font-semibold text-[#1d1d1f] whitespace-nowrap">
                      {formatPrice(order.totalAmount)}
                    </td>

                    {/* Lợi nhuận */}
                    <td className="px-4 py-4 text-right font-semibold whitespace-nowrap">
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
                    <td className="px-3 py-4 text-center w-28 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Chi tiết */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderIdForDetails(order.id);
                          }}
                          className="w-8 h-8 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#0066cc] hover:text-[#0071e3] flex items-center justify-center cursor-pointer transition-all active:scale-95 duration-150 border border-[#e0e0e0]"
                          title="Chi tiết đơn hàng"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Hủy đơn */}
                        {order.status !== "cancelled" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToCancel(order);
                            }}
                            className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 flex items-center justify-center cursor-pointer transition-all active:scale-95 duration-150 border border-red-200/50"
                            title="Hủy giao dịch"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-8 h-8 rounded-lg bg-[#f5f5f7]/50 text-slate-400 flex items-center justify-center cursor-not-allowed border border-[#e0e0e0]"
                            title="Đơn đã hủy"
                          >
                            <Trash2 size={14} className="text-slate-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
                className="px-4 h-[36px] rounded-full border border-[#e0e0e0] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-[13px] font-medium active:scale-95 duration-150"
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
                      className={`w-[36px] h-[36px] rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                        p === page
                          ? "bg-[#0066cc] text-white shadow-sm"
                          : "hover:bg-[#f5f5f7] text-[#1d1d1f]"
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
                className="px-4 h-[36px] rounded-full border border-[#e0e0e0] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-[13px] font-medium active:scale-95 duration-150"
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
