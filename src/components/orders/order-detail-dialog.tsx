"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { getOrderDetail, completeOnlineOrderAction, cancelOrderAction } from "@/app/actions/orders";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar, Tag, ShieldCheck, DollarSign, FileText, User, RefreshCw, ShoppingBag, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditShippingDialog } from "@/components/orders/edit-shipping-dialog";

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

interface OrderDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function OrderDetailDialog({ isOpen, onClose, orderId }: OrderDetailDialogProps) {
  const queryClient = useQueryClient();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);



  // Trạng thái vận chuyển đơn hàng Online (Đang giao -> Thành công/Thất bại)
  const [loadingDeliverSuccess, setLoadingDeliverSuccess] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [isConfirmDeliverOpen, setIsConfirmDeliverOpen] = useState(false);
  const [isEditShippingOpen, setIsEditShippingOpen] = useState(false);

  const payMethodOptions = [
    { value: "bank_transfer", label: "Chuyển khoản" },
    { value: "cash", label: "Tiền mặt" },
    { value: "card", label: "ATM / VISA" },
    { value: "momo", label: "Ví Momo" },
    { value: "vnpay", label: "Cổng VNPay" },
  ];

  const loadOrderDetail = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await getOrderDetail(orderId);
      setData(res);
      
      // Khởi tạo mặc định số tiền còn thiếu cho form thanh toán
      if (res) {
        // No additional payment setup needed
      }
    } catch (error) {
      toast.error("Lỗi tải chi tiết đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderDetail();

      setIsConfirmDeliverOpen(false);
      setIsConfirmCancelOpen(false);
    }
  }, [isOpen, orderId]);

  const handleDeliverSuccess = async () => {
    if (!orderId) return;
    setLoadingDeliverSuccess(true);
    try {
      const res = await completeOnlineOrderAction({
        orderId,
        amount: remainingAmount.toString(),
        paymentMethod: "bank_transfer",
        referenceNumber: order.trackingNumber || "",
        notes: `Thu hộ COD qua đơn vị vận chuyển${order.shippingCarrier ? ` ${order.shippingCarrier}` : ""}`.trim(),
      });

      if (res.success) {
        toast.success(res.message);
        setIsConfirmDeliverOpen(false);
        // Reload details & main orders list
        await loadOrderDetail();
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi xác nhận giao hàng thành công");
    } finally {
      setLoadingDeliverSuccess(false);
    }
  };

  const handleDeliverFailed = async () => {
    if (!orderId) return;
    setLoadingCancel(true);
    try {
      const res = await cancelOrderAction(orderId);
      if (res.success) {
        toast.success(res.message);
        setIsConfirmCancelOpen(false);
        onClose(); // Đóng dialog chi tiết đơn hàng
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["stock-items-select"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi hủy giao dịch đơn hàng");
    } finally {
      setLoadingCancel(false);
    }
  };

  const renderDetailOrderStatus = (status: string) => {
    const configs: Record<string, { bg: string; label: string }> = {
      draft: { bg: "bg-[#7a8a99]/10 text-[#7a8a99] border-[#7a8a99]/20", label: "Nháp" },
      confirmed: { bg: "bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20", label: "Đang xử lý" },
      processing: { bg: "bg-[#f59e0b]/10 text-[#d97706] border-[#f59e0b]/20", label: "Đang giao hàng" },
      completed: { bg: "bg-[#009b72]/10 text-[#009b72] border-[#009b72]/20", label: "Đã hoàn thành" },
      cancelled: { bg: "bg-[#df2935]/10 text-[#df2935] border-[#df2935]/20", label: "Đã hủy" },
      refunded: { bg: "bg-[#6366f1]/10 text-[#6366f1] border-[#6366f1]/20", label: "Hoàn tiền" },
    };
    const c = configs[status] || { bg: "bg-gray-100 text-gray-700 border-gray-200", label: status };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold border ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  const renderDetailPaymentStatus = (status: string) => {
    const configs: Record<string, { bg: string; label: string }> = {
      unpaid: { bg: "bg-[#df2935]/10 text-[#df2935] border-[#df2935]/20", label: "Chờ thanh toán" },
      partial: { bg: "bg-[#f4a261]/10 text-[#d97706] border-[#f4a261]/20", label: "Trả một phần" },
      paid: { bg: "bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/20", label: "Đã thanh toán" },
      refunded: { bg: "bg-[#7a8a99]/10 text-[#7a7a7a] border-[#7a8a99]/20", label: "Đã hoàn tiền" },
    };
    const c = configs[status] || { bg: "bg-gray-100 text-gray-700 border-gray-200", label: status };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold border ${c.bg}`}>
        {c.label}
      </span>
    );
  };



  if (!orderId || !data) return null;

  const { order, items, payments: paymentList, returns: returnsList } = data;

  const formatPrice = (price: string | number | null) => {
    if (price === null || price === undefined) return "N/A";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(price));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "N/A";
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "N/A";
    }
  };

  const formatDateTime = (dateVal: any) => {
    if (!dateVal) return "N/A";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "N/A";
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return "N/A";
    }
  };

  const totalPaid = paymentList.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remainingAmount = Math.max(0, Number(order.totalAmount) - totalPaid);

  const getOrderStatusName = (status: string) => {
    const map: Record<string, string> = {
      draft: "Nháp",
      confirmed: "Đang xử lý",
      processing: "Đang giao",
      completed: "Đã hoàn tất",
      cancelled: "Đã hủy",
      refunded: "Đã hoàn tiền",
    };
    return map[status] || status;
  };

  const getPaymentStatusName = (status: string) => {
    const map: Record<string, string> = {
      unpaid: "Chờ thanh toán",
      partial: "Trả một phần",
      paid: "Đã thanh toán",
      refunded: "Đã hoàn tiền",
    };
    return map[status] || status;
  };

  const getPaymentMethodName = (method: string) => {
    const map: Record<string, string> = {
      cash: "Tiền mặt",
      bank_transfer: "Chuyển khoản",
      card: "Thẻ ATM/Visa",
      momo: "Ví Momo",
      vnpay: "Cổng VNPay",
      mixed: "Hỗn hợp",
    };
    return map[method] || method;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Chi tiết đơn hàng"
      description={`Mã đơn: ${order.orderNumber} • Ngày lập: ${formatDate(order.createdAt)}`}
      size="6xl"
    >
      <div className="space-y-5">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#7a7a7a]">
            <RefreshCw className="animate-spin mb-4 text-[#0066cc]" size={24} />
            <p className="text-[16px]">Đang truy xuất thông tin giao dịch...</p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* ROW 1: Trạng thái đơn + Đang giao hàng (Online) + Ghi chú nội bộ */}
            <div className={`grid grid-cols-1 ${order.status === "processing" ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-6`}>
              {/* 1.1 Status Badges Card */}
              <div className="bg-white border border-[#e3e3e7] rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-center space-y-4">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-[#7a7a7a] font-semibold">Trạng thái đơn:</span>
                  {renderDetailOrderStatus(order.status)}
                </div>
                <div className="border-t border-[#e3e3e7]/60"></div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-[#7a7a7a] font-semibold">Thanh toán:</span>
                  {renderDetailPaymentStatus(order.paymentStatus)}
                </div>
              </div>

              {/* 1.2 Delivery Action Card (if processing) */}
              {order.status === "processing" && (
                <div className="bg-gradient-to-tr from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-5 rounded-[20px] shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[14px] font-bold text-amber-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Đang giao hàng
                    </span>
                    <div className="text-[12px] text-amber-700/80 space-y-1">
                      <div className="flex justify-between">
                        <span>Đã cọc trước:</span>
                        <span className="font-semibold text-[#1d1d1f]">{formatPrice(totalPaid)}</span>
                      </div>
                      <div className="flex justify-between border-t border-amber-500/10 pt-1 mt-1 font-bold text-amber-900">
                        <span>COD cần thu:</span>
                        <span>{formatPrice(remainingAmount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsConfirmDeliverOpen(true)}
                      className="w-full h-[40px] bg-[#0066cc] hover:bg-[#0071e3] text-white text-[14px] font-semibold rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm shadow-[0_2px_8px_rgba(0,102,204,0.15)] active:scale-95 duration-150"
                    >
                      Giao thành công
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmCancelOpen(true)}
                      className="w-full h-[40px] bg-[#df2935] hover:bg-[#c2242e] text-white text-[14px] font-semibold rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm shadow-[0_2px_8px_rgba(223,41,53,0.15)] active:scale-95 duration-150"
                    >
                      Giao thất bại
                    </button>
                  </div>
                </div>
              )}

              {/* 1.3 Internal Notes Widget */}
              <div className="bg-white border border-[#e3e3e7] rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-[#e3e3e7]/60">
                  
                  <span className="text-[13px] font-bold text-[#7a7a7a] uppercase tracking-wider">Ghi chú đơn hàng</span>
                </div>
                <div className="bg-[#f5f5f7] p-3 rounded-xl border border-[#e3e3e7]/40 text-[13px] leading-relaxed text-[#1d1d1f] min-h-[60px] italic">
                  {order.notes || "Không có ghi chú thêm."}
                </div>
              </div>
            </div>

            {/* ROW 2: Khách hàng & Giao dịch + Chi tiết tài chính */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 2.1 Customer & Transaction Card */}
              <div className="bg-white border border-[#e3e3e7] rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#e3e3e7]/60">
                  <span className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider">Khách hàng & Giao dịch</span>
                  <button
                    type="button"
                    onClick={() => setIsEditShippingOpen(true)}
                    className="text-[12px] font-semibold text-[#0066cc] hover:text-[#0071e3] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil size={12} />
                    <span>Cập nhật vận đơn</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[14px]">
                  {/* Customer Section */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider block">Khách hàng</span>
                    <p className="text-[15px] text-[#1d1d1f] font-bold leading-tight">{order.customerName}</p>
                    <p className="text-[#515154] font-medium text-[13px]">SĐT: <span className="text-[#1d1d1f]">{order.customerPhone}</span></p>
                    {order.customerAddress && (
                      <p className="text-[#515154] text-[13px] leading-relaxed">Địa chỉ: <span className="text-[#1d1d1f]">{order.customerAddress}</span></p>
                    )}
                    {order.shippingAddress && (
                      <p className="text-[#515154] text-[13px] leading-relaxed">Giao tới: <span className="text-[#1d1d1f]">{order.shippingAddress}</span></p>
                    )}
                    {order.leadSourceName && (
                      <p className="text-[#515154] text-[13px]">Nguồn khách: <span className="text-[#1d1d1f]">{order.leadSourceName}</span></p>
                    )}
                    {order.shippingCarrier && (
                      <p className="text-[#515154] text-[13px] mt-1">
                        Vận chuyển: <span className="text-[#1d1d1f] font-semibold">{order.shippingCarrier}</span>
                      </p>
                    )}
                    {order.trackingNumber && (
                      <p className="text-[#515154] text-[13px] mt-1">
                        Vận đơn: <span className="font-mono bg-[#f5f5f7] border border-[#e0e0e0] px-1.5 py-0.5 rounded text-[12px] text-[#1d1d1f] font-semibold">{order.trackingNumber}</span>
                      </p>
                    )}
                    {order.packingVideoUrl && (
                      <p className="text-[#515154] text-[13px] mt-1">
                        🎥 Video đóng gói: <a href={order.packingVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#0066cc] hover:underline font-semibold">Xem video</a>
                      </p>
                    )}
                  </div>

                  {/* Transaction Section */}
                  <div className="space-y-1.5 md:border-l border-[#e3e3e7]/80 md:pl-6">
                    <span className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider block">Giao dịch</span>
                    <p className="text-[#515154] text-[13px]">Nhân viên: <span className="font-semibold text-[#1d1d1f]">{order.soldByName || "Hệ thống"}</span></p>
                    <p className="text-[#515154] text-[13px]">Kênh bán: <span className="capitalize font-semibold text-[#1d1d1f]">{order.saleChannel}</span></p>
                    <p className="text-[#515154] text-[13px]">Thanh toán: <span className="font-semibold text-[#1d1d1f]">{getPaymentMethodName(order.paymentMethod)}</span></p>
                  </div>
                </div>
              </div>

              {/* 2.2 Financial Details Card */}
              <div className="bg-white border border-[#e3e3e7] rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#e3e3e7]/60">
                  
                  <span className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider">Chi tiết tài chính</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[14px]">
                  {/* Revenue Summary */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[#7a7a7a]">
                      <span>Cộng tiền hàng:</span>
                      <span className="font-semibold text-[#1d1d1f]">{formatPrice(order.subtotal)}</span>
                    </div>
                    {Number(order.discountAmount) > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Khấu trừ giảm giá:</span>
                        <span className="font-semibold">-{formatPrice(order.discountAmount)}</span>
                      </div>
                    )}
                    {Number(order.taxAmount) > 0 && (
                      <div className="flex justify-between text-[#7a7a7a]">
                        <span>Thuế phát sinh:</span>
                        <span className="font-semibold text-[#1d1d1f]">{formatPrice(order.taxAmount)}</span>
                      </div>
                    )}
                    <div className="border-t border-[#e3e3e7] pt-2 flex justify-between text-[15px] font-extrabold text-[#1d1d1f]">
                      <span>Tổng thanh toán:</span>
                      <span className="text-[#0066cc]">{formatPrice(order.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[13px] text-emerald-600 font-bold">
                      <span>Đã thanh toán:</span>
                      <span>{formatPrice(totalPaid)}</span>
                    </div>
                    {remainingAmount > 0 && (
                      <div className="flex justify-between text-[13px] text-amber-600 font-bold">
                        <span>Còn lại cần thu:</span>
                        <span>{formatPrice(remainingAmount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Cost & Profit (Internal only) */}
                  <div className="space-y-2.5 md:border-l border-[#e3e3e7]/80 md:pl-6 flex flex-col justify-end">
                    <div className="flex justify-between text-[#7a7a7a]">
                      <span>Giá vốn sản phẩm:</span>
                      <span className="font-semibold text-[#1d1d1f]">{formatPrice(order.totalCost)}</span>
                    </div>
                    <div className="flex justify-between text-[13px] font-bold pt-0.5">
                      <span className="text-[#1d1d1f]">Lợi nhuận thực:</span>
                      <span className="text-green-600">{formatPrice(order.profit)}</span>
                    </div>
                    <div className="flex justify-between font-semibold uppercase text-[10px] tracking-wider text-[#7a7a7a]">
                      <span>Tỷ suất lợi nhuận:</span>
                      <span className="text-green-600">{Number(order.profitMargin).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3: Danh sách sản phẩm (Bung hết thông tin) */}
            <div className="bg-white border border-[#e3e3e7] rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#e3e3e7]/60">
                
                <span className="text-[14px] font-bold text-[#1d1d1f] uppercase tracking-wider">Danh sách sản phẩm ({items.length})</span>
              </div>
              <div className="border border-[#e0e0e0] rounded-xl overflow-hidden bg-[#f5f5f7]/30">
                <table className="w-full text-left border-collapse text-[13px] table-fixed">
                  <thead>
                    <tr className="border-b border-[#e0e0e0] bg-[#f5f5f7]/70 text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                      <th className="px-3 py-2.5 text-center w-[42px]">STT</th>
                      <th className="px-3 py-2.5">Sản phẩm</th>
                      <th className="px-3 py-2.5 w-[130px]">Serial</th>
                      <th className="px-3 py-2.5 text-right w-[120px] whitespace-nowrap">Giá bán</th>
                      <th className="px-3 py-2.5 text-right w-[100px] whitespace-nowrap">Giảm giá</th>
                      <th className="px-3 py-2.5 text-center w-[80px] whitespace-nowrap">Bảo hành</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, index: number) => (
                      <tr key={item.id} className="border-b border-[#e0e0e0]/40 last:border-0 hover:bg-[#f5f5f7]/40 transition-colors">
                        <td className="px-3 py-2.5 text-center text-[13px] text-[#7a7a7a]">{index + 1}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#1d1d1f] truncate">{item.productName}</span>
                              {item.status !== "sold" && item.status !== "warranty_repair" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 shrink-0">
                                  Đã trả hàng
                                </span>
                              )}
                            </div>
                            {item.productSpecs && formatSpecs(item.productSpecs) && (
                              <span className="text-[11px] text-[#7a7a7a] font-normal mt-0.5 truncate">
                                {formatSpecs(item.productSpecs)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-[#7a7a7a] truncate">{item.serialNumber}</td>
                        <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{formatPrice(item.sellingPrice)}</td>
                        <td className="px-3 py-2.5 text-right text-red-600 whitespace-nowrap">-{formatPrice(item.discount)}</td>
                        <td className="px-3 py-2.5 text-center font-medium whitespace-nowrap">{item.warrantyMonths} tháng</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROW 4: Lịch sử đổi trả & hoàn tiền (nếu có) */}
            {returnsList && returnsList.length > 0 && (
              <div className="bg-red-50/10 border border-red-200/40 rounded-[20px] p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-red-200/30">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="text-[14px] font-bold text-red-700 uppercase tracking-wider">Lịch sử đổi trả & hoàn tiền ({returnsList.length})</span>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                  {returnsList.map((ret: any) => (
                    <div key={ret.id} className="flex justify-between items-center bg-white border border-red-200/30 p-4 rounded-xl text-[13px] shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[11px] font-bold">{ret.returnNumber}</span>
                          <span className="text-[#7a7a7a]">
                            Loại: <span className="font-bold text-red-600">{ret.type === 'exchange' ? 'Đổi Hàng' : 'Trả Hàng'}</span>
                          </span>
                        </div>
                        <p className="text-[#515154]">Lý do: <span className="text-[#1d1d1f] font-medium">{
                          ({ defective: "Lỗi kỹ thuật", wrong_item: "Giao sai hàng", changed_mind: "Đổi ý", upgrade: "Nâng cấp", downgrade: "Hạ cấp", other: "Khác" } as Record<string, string>)[ret.reason] || ret.reason
                        }</span></p>
                        {Number(ret.refundAmount) > 0 && (
                          <p className="text-red-600 font-bold">
                            Số tiền đã hoàn: {formatPrice(ret.refundAmount)}
                          </p>
                        )}
                      </div>

                      <div className="text-right text-[11px] text-[#7a7a7a] shrink-0 space-y-1 border-l border-red-100 pl-4">
                        <span className="block font-mono">{formatDateTime(ret.createdAt)}</span>
                        <span className="block">Duyệt bởi: <span className="font-semibold text-[#1d1d1f]">{ret.processedByName || "Hệ thống"}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog xác nhận hủy đơn khi giao thất bại */}
      <ConfirmDialog
        isOpen={isConfirmCancelOpen}
        onClose={() => setIsConfirmCancelOpen(false)}
        onConfirm={handleDeliverFailed}
        title="Xác nhận giao hàng thất bại"
        description={`Bạn có chắc chắn muốn báo giao hàng thất bại cho Đơn hàng "${order.orderNumber}"? Đơn hàng sẽ được chuyển sang trạng thái "Đã hủy", toàn bộ sản phẩm sẽ được tự động khôi phục về trạng thái "Sẵn hàng" trong kho và các khoản tiền cọc (nếu có) sẽ chuyển sang hoàn tiền.`}
        confirmText="Giao thất bại"
        cancelText="Quay lại"
        variant="danger"
        isLoading={loadingCancel}
      />

      {/* Dialog xác nhận giao hàng thành công */}
      <ConfirmDialog
        isOpen={isConfirmDeliverOpen}
        onClose={() => setIsConfirmDeliverOpen(false)}
        onConfirm={handleDeliverSuccess}
        title="Xác nhận giao hàng thành công"
        description={`Bạn có chắc chắn muốn xác nhận đơn hàng "${order.orderNumber}" đã được giao thành công và thu hộ số tiền COD là ${formatPrice(remainingAmount)} qua đơn vị vận chuyển?`}
        confirmText="Giao thành công"
        cancelText="Quay lại"
        variant="primary"
        isLoading={loadingDeliverSuccess}
      />

      {/* Dialog sửa thông tin vận chuyển */}
      <EditShippingDialog
        isOpen={isEditShippingOpen}
        onClose={async () => {
          setIsEditShippingOpen(false);
          await loadOrderDetail();
          queryClient.invalidateQueries({ queryKey: ["orders"] });
        }}
        order={order}
      />
    </Dialog>
  );
}
