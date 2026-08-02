"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/ui/dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { getOrderDetail, completeOnlineOrderAction, cancelOrderAction } from "@/app/actions/orders";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar, Tag, ShieldCheck, DollarSign, FileText, User, RefreshCw, ShoppingBag, Pencil, Printer, Download } from "lucide-react";
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
    } else if (!isOpen) {
      // Giải phóng bộ nhớ, xóa dữ liệu cũ để tránh nhấp nháy dữ liệu khi mở đơn mới
      setData(null);
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



  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!order) return;
    const element = document.getElementById("print-invoice-area");
    if (!element) {
      toast.error("Không tìm thấy mẫu hóa đơn để xuất PDF.");
      return;
    }

    setDownloadingPdf(true);
    const toastId = toast.loading("Đang tạo hóa đơn PDF...");

    try {
      // 1. Wait a tiny bit to ensure DOM is fully ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      // 2. Generate high-quality image from element
      const dataUrl = await toPng(element, {
        pixelRatio: 2, // Double resolution for crystal-clear prints
        backgroundColor: "#ffffff",
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        }
      });

      // 3. Create PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210; // A4 width in mm
      const imgHeight = 297; // A4 height in mm

      pdf.addImage(dataUrl, "PNG", 0, 0, imgWidth, imgHeight, undefined, "FAST");
      pdf.save(`HoaDon_${order.orderNumber}.pdf`);

      toast.success("Đã tải hóa đơn PDF thành công!", { id: toastId });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Gặp lỗi khi tạo file PDF hóa đơn.", { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!isOpen || !orderId) return null;

  const { order, items, payments: paymentList, returns: returnsList } = data || {
    order: null,
    items: [],
    payments: [],
    returns: [],
  };

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

  const formatWarrantyRange = (createdAtStr: string | null, warrantyMonths: number) => {
    if (!createdAtStr) return "N/A";
    if (warrantyMonths <= 0) return "Không bảo hành";
    try {
      const start = new Date(createdAtStr);
      if (isNaN(start.getTime())) return "N/A";
      const end = new Date(start);
      end.setMonth(end.getMonth() + warrantyMonths);
      
      const formatDateStr = (d: Date) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };
      
      return `${formatDateStr(start)} - ${formatDateStr(end)}`;
    } catch {
      return "N/A";
    }
  };

  const totalPaid = paymentList.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remainingAmount = order ? Math.max(0, Number(order.totalAmount) - totalPaid) : 0;

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
      title={<span className="text-[#0066cc]">Chi tiết đơn hàng</span>}
      description={
        order ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>Mã đơn: <span className="font-semibold text-[#0066cc]">{order.orderNumber}</span></span>
            <span className="text-[#e0e0e0]">•</span>
            <span>Ngày lập: <span className="font-semibold text-[#0066cc]">{formatDate(order.createdAt)}</span></span>
            <span className="text-[#e0e0e0]">•</span>
            <span>Trạng thái đơn: <span className="font-semibold text-[#0066cc]">{getOrderStatusName(order.status)}</span></span>
            <span className="text-[#e0e0e0]">•</span>
            <span>Trạng thái thanh toán: <span className="font-semibold text-[#0066cc]">{getPaymentStatusName(order.paymentStatus)}</span></span>
            <span className="text-[#e0e0e0]">•</span>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#0066cc] text-[#0066cc] text-[12px] font-semibold hover:bg-[#0066cc] hover:text-white transition-all cursor-pointer active:scale-95 duration-100 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingPdf ? (
                <RefreshCw size={13} className="animate-spin shrink-0" />
              ) : (
                <Download size={13} className="shrink-0" />
              )}
              <span>Tải hóa đơn</span>
            </button>
          </div>
        ) : (
          "Đang truy xuất thông tin..."
        )
      }
      size="6xl"
    >
      <div className="space-y-5">
        {loading || !data ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#7a7a7a]">
            <RefreshCw className="animate-spin mb-4 text-[#0066cc]" size={24} />
            <p className="text-[16px]">Đang truy xuất thông tin giao dịch...</p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Metadata Section: Apple Minimalist Unified 3-Column Card */}
            <div className="bg-[#f5f5f7] rounded-[20px] p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 divide-y lg:divide-y-0 lg:divide-x divide-[#e0e0e0]/60">
                
                {/* Column 1: Customer & Transaction */}
                <div className="space-y-2 lg:pr-4">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#e0e0e0]/50">
                    <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Khách hàng & Giao dịch</span>
                  </div>
                  
                  <div className="space-y-2 text-[13px]">
                    {/* Customer Details */}
                    <div className="space-y-1">
                      <p className="font-bold text-[#0066cc] text-[14px]">
                        {order.customerName}
                        {order.customerPhone && (
                          <span className="text-[#86868b] font-normal text-[12px] ml-1.5">
                            ({order.customerPhone})
                          </span>
                        )}
                      </p>
                      {order.customerAddress && (
                        <p className="text-[#515154] leading-tight text-[12px]">Địa chỉ: <span className="text-[#0066cc]">{order.customerAddress}</span></p>
                      )}
                      {order.shippingAddress && (
                        <p className="text-[#515154] leading-tight text-[12px]">Giao tới: <span className="text-[#0066cc]">{order.shippingAddress}</span></p>
                      )}
                      {order.leadSourceName && !order.customerPhone && (
                        <p className="text-[#515154] text-[12px]">Nguồn khách: <span className="text-[#0066cc]">{order.leadSourceName}</span></p>
                      )}
                      {(order.shippingCarrier || order.trackingNumber || order.packingVideoUrl) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#86868b] pt-0.5">
                          {order.shippingCarrier && (
                            <span>Vận chuyển: <span className="text-[#0066cc] font-medium">{order.shippingCarrier}</span></span>
                          )}
                          {order.shippingCarrier && order.trackingNumber && <span>•</span>}
                          {order.trackingNumber && (
                            <span>Mã vận đơn: <span className="text-[#0066cc] font-medium">{order.trackingNumber}</span></span>
                          )}
                          {order.packingVideoUrl && (
                            <>
                              <span>•</span>
                              <a href={order.packingVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#0066cc] hover:underline font-medium">🎥 Video đóng gói</a>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#e0e0e0]/40 my-1.5"></div>

                    {/* Transaction Details */}
                    <div className="space-y-1">
                      <p className="text-[#515154] text-[12px] leading-relaxed">
                        Nhân viên: <span className="text-[#0066cc] font-semibold">{order.soldByName || "Hệ thống"}</span>
                      </p>
                      <p className="text-[#515154] text-[12px] leading-relaxed">
                        Kênh: <span className="text-[#0066cc] font-semibold capitalize">{order.saleChannel}</span>
                        <span className="text-[#e0e0e0] mx-1.5">•</span>
                        Thanh toán: <span className="text-[#0066cc] font-semibold">{getPaymentMethodName(order.paymentMethod)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsEditShippingOpen(true)}
                        className="text-[11px] font-semibold text-[#0066cc] hover:text-[#0071e3] transition-colors flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        <Pencil size={11} />
                        <span>Cập nhật vận đơn</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Column 2: Financial details */}
                <div className="space-y-2 lg:px-4 pt-3 lg:pt-0">
                  <div className="pb-1.5 border-b border-[#e0e0e0]/50">
                    <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Chi tiết tài chính</span>
                  </div>

                  <div className="space-y-2 text-[13px]">
                    {/* Revenue Summary */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[#86868b]">
                        <span>Cộng tiền hàng:</span>
                        <span className="font-semibold text-[#0066cc]">{formatPrice(order.subtotal)}</span>
                      </div>
                      {Number(order.discountAmount) > 0 && (
                        <div className="flex justify-between text-[#df2935] font-medium">
                          <span>Khấu trừ giảm giá:</span>
                          <span className="font-semibold">-{formatPrice(order.discountAmount)}</span>
                        </div>
                      )}
                      {Number(order.taxAmount) > 0 && (
                        <div className="flex justify-between text-[#86868b]">
                          <span>Thuế phát sinh:</span>
                          <span className="font-semibold text-[#0066cc]">{formatPrice(order.taxAmount)}</span>
                        </div>
                      )}
                      <div className="border-t border-[#e0e0e0]/50 pt-1 flex justify-between text-[14px] font-black text-[#0066cc]">
                        <span>Tổng thanh toán:</span>
                        <span>{formatPrice(order.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[#009b72] font-bold">
                        <span>Đã thanh toán:</span>
                        <span>{formatPrice(totalPaid)}</span>
                      </div>
                      {remainingAmount > 0 && (
                        <div className="flex justify-between text-[#d97706] font-bold">
                          <span>Còn lại cần thu:</span>
                          <span>{formatPrice(remainingAmount)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#e0e0e0]/40 my-1.5"></div>

                    {/* Cost & Profit (Internal only) inline row */}
                    <div className="flex items-center gap-x-2 text-[11px] text-[#86868b] whitespace-nowrap">
                      <span>Giá vốn: <span className="text-[#0066cc] font-medium">{formatPrice(order.totalCost)}</span></span>
                      <span>•</span>
                      <span>Lợi nhuận: <span className="text-[#009b72] font-semibold">{formatPrice(order.profit)}</span></span>
                      <span>•</span>
                      <span>Tỷ suất: <span className="text-[#009b72] font-semibold">{Number(order.profitMargin).toFixed(1)}%</span></span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Notes & Giao vận */}
                <div className="space-y-2 lg:pl-4 pt-3 lg:pt-0">
                  <div className="pb-1.5 border-b border-[#e0e0e0]/50">
                    <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Ghi chú & Giao vận</span>
                  </div>

                  <div className="space-y-2 text-[13px]">
                    <div>
                      <p className="text-[#0066cc] italic leading-relaxed">
                        {order.notes || "Không có ghi chú thêm."}
                      </p>
                    </div>

                    {order.status === "processing" && (
                      <>
                        <div className="border-t border-[#e0e0e0]/40 my-1.5"></div>
                        <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-[12px] space-y-1.5">
                          <span className="text-[12px] font-bold text-amber-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Đang giao hàng
                          </span>
                          <div className="text-[11px] text-amber-700/80 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Đã cọc trước:</span>
                              <span className="font-semibold text-[#0066cc]">{formatPrice(totalPaid)}</span>
                            </div>
                            <div className="flex justify-between border-t border-amber-500/10 pt-0.5 mt-0.5 font-bold text-amber-900">
                              <span>COD cần thu:</span>
                              <span>{formatPrice(remainingAmount)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => setIsConfirmDeliverOpen(true)}
                              className="w-full h-[26px] bg-[#0066cc] hover:bg-[#0071e3] text-white text-[11px] font-semibold rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 duration-150"
                            >
                              Thành công
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsConfirmCancelOpen(true)}
                              className="w-full h-[26px] bg-[#df2935] hover:bg-[#c2242e] text-white text-[11px] font-semibold rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 duration-150"
                            >
                              Thất bại
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* ROW 3: Danh sách sản phẩm (Bung hết thông tin) */}
            <div className="bg-[#f5f5f7] rounded-[20px] p-4 space-y-3">
              <div className="flex items-center gap-2 pb-1.5 border-b border-[#e0e0e0]/50">
                <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Danh sách sản phẩm ({items.length})</span>
              </div>
              <div className="overflow-hidden bg-transparent">
                <table className="w-full text-left border-collapse text-[13px] table-fixed">
                  <thead>
                    <tr className="border-b border-[#e0e0e0]/60 text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">
                      <th className="px-3 py-1.5 text-center w-[50px]">STT</th>
                      <th className="px-3 py-1.5 w-[32%]">Sản phẩm & Thông tin</th>
                      <th className="px-3 py-1.5 text-left w-[18%]">Số Serial (S/N)</th>
                      <th className="px-3 py-1.5 text-left w-[15%]">Bảo hành</th>
                      <th className="px-3 py-1.5 text-right w-[12%]">Giá bán</th>
                      <th className="px-3 py-1.5 text-right w-[10%]">Giảm giá</th>
                      <th className="px-3 py-1.5 text-right w-[13%]">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, index: number) => {
                      const finalPrice = Math.max(0, Number(item.sellingPrice) - Number(item.discount));
                      return (
                        <tr key={item.id} className="border-b border-[#e0e0e0]/40 last:border-0 hover:bg-black/[0.015] transition-colors">
                          <td className="px-3 py-2 text-center text-[13px] text-[#86868b] align-top">{index + 1}</td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-[#0066cc]">{item.productName}</span>
                                {item.isGift && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0066cc]/8 text-[#0066cc] border border-[#0066cc]/10 shrink-0">
                                    Tặng kèm
                                  </span>
                                )}
                                {item.status !== "sold" && item.status !== "warranty_repair" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#df2935]/8 text-[#df2935] border border-[#df2935]/10 shrink-0">
                                    Đã trả hàng
                                  </span>
                                )}
                              </div>
                              {item.productSpecs && formatSpecs(item.productSpecs) && (
                                <span className="text-[11px] text-[#86868b] font-normal mt-1 leading-normal">
                                  {formatSpecs(item.productSpecs)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-left">
                            {item.serialNumber ? (
                              <span className="text-[11px] font-bold text-[#5856d6] tracking-wider">
                                {item.serialNumber}
                              </span>
                            ) : (
                              <span className="text-[#86868b]">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-left align-top">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-[#0066cc] block">{item.warrantyMonths} tháng</span>
                              {item.warrantyMonths > 0 && (
                                <span className="text-[10px] text-[#86868b] block">
                                  {formatWarrantyRange(order.createdAt, item.warrantyMonths)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-[#0066cc] align-top">{formatPrice(item.sellingPrice)}</td>
                          <td className="px-3 py-2 text-right text-[#df2935] font-medium align-top">
                            {Number(item.discount) > 0 ? `-${formatPrice(item.discount)}` : "0đ"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-[#0066cc] align-top">{formatPrice(finalPrice)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROW 4: Lịch sử đổi trả & hoàn tiền (nếu có) */}
            {returnsList && returnsList.length > 0 && (
              <div className="bg-[#df2935]/5 rounded-[24px] p-6 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#df2935]/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#df2935] animate-pulse"></span>
                  <span className="text-[11px] font-bold text-[#df2935] uppercase tracking-wider">Lịch sử đổi trả & hoàn tiền ({returnsList.length})</span>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                  {returnsList.map((ret: any) => (
                    <div key={ret.id} className="flex justify-between items-center bg-white p-4 rounded-xl text-[13px] border border-[#e0e0e0]/40 shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#df2935]/8 text-[#df2935] px-1.5 py-0.5 rounded text-[11px] font-bold">{ret.returnNumber}</span>
                          <span className="text-[#86868b] text-[12px]">
                            Loại: <span className="font-bold text-[#df2935]">{ret.type === 'exchange' ? 'Đổi Hàng' : 'Trả Hàng'}</span>
                          </span>
                        </div>
                        <p className="text-[#515154]">Lý do: <span className="text-[#1d1d1f] font-medium">{
                          ({ defective: "Lỗi kỹ thuật", wrong_item: "Giao sai hàng", changed_mind: "Đổi ý", upgrade: "Nâng cấp", downgrade: "Hạ cấp", other: "Khác" } as Record<string, string>)[ret.reason] || ret.reason
                        }</span></p>
                        {Number(ret.refundAmount) > 0 && (
                          <p className="text-[#df2935] font-bold">
                            Số tiền đã hoàn: {formatPrice(ret.refundAmount)}
                          </p>
                        )}
                      </div>

                      <div className="text-right text-[11px] text-[#86868b] shrink-0 space-y-1 border-l border-[#e0e0e0]/40 pl-4">
                        <span className="block">{formatDateTime(ret.createdAt)}</span>
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
        description={order ? `Bạn có chắc chắn muốn báo giao hàng thất bại cho Đơn hàng "${order.orderNumber}"? Đơn hàng sẽ được chuyển sang trạng thái "Đã hủy", toàn bộ sản phẩm sẽ được tự động khôi phục về trạng thái "Sẵn hàng" trong kho và các khoản tiền cọc (nếu có) sẽ chuyển sang hoàn tiền.` : ""}
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
        description={order ? `Bạn có chắc chắn muốn xác nhận đơn hàng "${order.orderNumber}" đã được giao thành công và thu hộ số tiền COD là ${formatPrice(remainingAmount)} qua đơn vị vận chuyển?` : ""}
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

      {/* Invoice + Warranty PDF Print Template */}
      {typeof document !== "undefined" && createPortal(
        <div id="print-invoice-wrapper" style={{ position: "fixed", left: 0, top: 0, width: 0, height: 0, overflow: "hidden", zIndex: -50 }}>
          <div id="print-invoice-area" className="w-[210mm] min-h-[297mm] p-[15mm] bg-white text-black font-sans leading-normal text-[11px] box-border">
          {/* Brand header */}
          <div className="flex justify-between items-start border-b border-[#e0e0e0] pb-4 mb-4">
            <div>
              <h1 className="text-[20px] font-black tracking-tight text-[#0066cc]">TECHSHOP</h1>
              <p className="text-[9px] text-[#7a7a7a] mt-0.5 font-medium uppercase tracking-wider">Hệ thống thiết bị số cao cấp</p>
              <div className="text-[10px] text-[#515154] mt-2.5 space-y-0.5">
                <p>Địa chỉ: 123 Đường ABC, Quận 1, TP. Hồ Chí Minh</p>
                <p>Hotline: 1900 xxxx | Website: techshop.vn</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-[14px] font-bold text-[#1d1d1f] uppercase tracking-wide">HÓA ĐƠN BÁN HÀNG & BẢO HÀNH</h2>
              <p className="text-[10px] text-[#515154] mt-1.5">Mã đơn: <span className="font-semibold text-[#0066cc]">{order?.orderNumber}</span></p>
              <p className="text-[10px] text-[#515154] mt-0.5">Ngày lập: <span>{order ? formatDate(order.createdAt) : ""}</span></p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-[#f5f5f7] rounded-[12px] p-4 mb-4 grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider mb-1">Thông tin khách hàng</h3>
              <p className="font-bold text-[#1d1d1f] text-[12px]">{order?.customerName}</p>
              {order?.customerPhone && <p className="text-[#515154] mt-0.5">SĐT: <span className="font-semibold">{order.customerPhone}</span></p>}
              {order?.customerAddress && <p className="text-[#515154] mt-0.5">Địa chỉ: <span>{order.customerAddress}</span></p>}
            </div>
            <div>
              <h3 className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider mb-1">Thông tin giao nhận</h3>
              {order?.shippingAddress ? (
                <p className="text-[#515154]">Giao tới: <span>{order.shippingAddress}</span></p>
              ) : (
                <p className="text-[#515154]">Nhận tại cửa hàng</p>
              )}
              <p className="text-[#515154] mt-0.5">Hình thức: <span className="capitalize">{order?.saleChannel}</span></p>
              <p className="text-[#515154] mt-0.5">Thanh toán: <span>{order ? getPaymentMethodName(order.paymentMethod) : ""}</span></p>
            </div>
          </div>

          {/* Product List Table */}
          <div className="mb-4">
            <table className="w-full text-left border-collapse text-[11px] table-fixed">
              <thead>
                <tr className="border-b border-[#e0e0e0] text-[9px] font-bold text-[#86868b] uppercase tracking-wider">
                  <th className="py-2 text-center w-[40px]">STT</th>
                  <th className="py-2 w-[40%]">Sản phẩm & Thông số</th>
                  <th className="py-2 text-left w-[20%]">Số Serial (S/N)</th>
                  <th className="py-2 text-left w-[12%]">Bảo hành</th>
                  <th className="py-2 text-right w-[13%]">Đơn giá</th>
                  <th className="py-2 text-right w-[15%]">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]/60">
                {items.map((item: any, index: number) => {
                  const finalPrice = Math.max(0, Number(item.sellingPrice) - Number(item.discount));
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="py-2 text-center text-[#86868b]">{index + 1}</td>
                      <td className="py-2 pr-4">
                        <p className="font-bold text-[#1d1d1f]">{item.productName}</p>
                        {item.productSpecs && formatSpecs(item.productSpecs) && (
                          <p className="text-[10px] text-[#7a7a7a] mt-0.5 leading-normal">{formatSpecs(item.productSpecs)}</p>
                        )}
                      </td>
                      <td className="py-2">
                        {item.serialNumber ? (
                          <span className="font-semibold text-[#5856d6] tracking-wider">{item.serialNumber}</span>
                        ) : (
                          <span className="text-[#86868b]">-</span>
                        )}
                      </td>
                      <td className="py-2 font-semibold text-[#1d1d1f]">
                        {item.warrantyMonths} tháng
                      </td>
                      <td className="py-2 text-right text-[#515154]">
                        {formatPrice(item.sellingPrice)}
                        {Number(item.discount) > 0 && (
                          <span className="block text-[9px] text-[#df2935]">- {formatPrice(item.discount)}</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-bold text-[#1d1d1f]">
                        {formatPrice(finalPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-[#e0e0e0] pt-3 mb-6 flex justify-end">
            <div className="w-[280px] space-y-1.5 text-[11px]">
              <div className="flex justify-between text-[#7a7a7a]">
                <span>Cộng tiền hàng:</span>
                <span className="font-semibold text-[#1d1d1f]">{formatPrice(order?.subtotal || 0)}</span>
              </div>
              {Number(order?.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-[#df2935]">
                  <span>Khấu trừ giảm giá:</span>
                  <span className="font-semibold">-{formatPrice(order?.discountAmount || 0)}</span>
                </div>
              )}
              {Number(order?.taxAmount || 0) > 0 && (
                <div className="flex justify-between text-[#7a7a7a]">
                  <span>Thuế GTGT (VAT):</span>
                  <span className="font-semibold text-[#1d1d1f]">{formatPrice(order?.taxAmount || 0)}</span>
                </div>
              )}
              <div className="border-t border-[#e0e0e0] pt-1.5 flex justify-between text-[13px] font-black text-[#0066cc]">
                <span>Tổng thanh toán:</span>
                <span>{formatPrice(order?.totalAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-[#009b72] font-semibold">
                <span>Đã thanh toán:</span>
                <span>{formatPrice(totalPaid)}</span>
              </div>
            </div>
          </div>

          {/* Warranty Terms & Conditions */}
          <div className="bg-[#f5f5f7] rounded-[12px] p-4 mb-6">
            <h3 className="text-[9px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-2">ĐIỀU KHOẢN BẢO HÀNH & HẬU MÃI</h3>
            <ul className="list-decimal pl-4 space-y-1 text-[10px] text-[#515154]">
              <li>Sản phẩm được bảo hành miễn phí theo thời gian quy định tại cột "Bảo hành" đối với lỗi phần cứng từ NSX.</li>
              <li>TechShop từ chối bảo hành các lỗi do tác động bên ngoài: Rơi vỡ, cấn móp, ngập nước, ẩm mốc, cháy nổ chip/linh kiện, rách hoặc mất tem bảo hành/tem niêm phong.</li>
              <li>Hỗ trợ đổi mới thiết bị tương đương cùng model trong vòng 7 ngày đầu sử dụng nếu phát sinh lỗi phần cứng được xác định từ nhà sản xuất.</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 text-center pt-4">
            <div>
              <p className="font-bold text-[#1d1d1f]">KHÁCH HÀNG</p>
              <p className="text-[9px] text-[#7a7a7a] mt-0.5 italic">(Ký và ghi rõ họ tên)</p>
              <div className="h-16"></div>
              <p className="font-bold text-[#515154] text-[12px]">{order?.customerName}</p>
            </div>
            <div>
              <p className="font-bold text-[#1d1d1f]">NGƯỜI LẬP PHIẾU</p>
              <p className="text-[9px] text-[#7a7a7a] mt-0.5 italic">(Ký và ghi rõ họ tên)</p>
              <div className="h-16"></div>
              <p className="font-bold text-[#515154] text-[12px]">TechShop Administrator</p>
            </div>
          </div>

          {/* Custom Styles for Printing */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body {
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              /* Show wrapper on print */
              #print-invoice-wrapper {
                position: static !important;
                width: auto !important;
                height: auto !important;
                overflow: visible !important;
                z-index: 9999 !important;
              }
              /* Hide dialog and everything else */
              body > *:not(#print-invoice-wrapper) {
                display: none !important;
              }
              #print-invoice-area {
                display: block !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 210mm;
                min-height: 297mm;
                padding: 15mm !important;
                margin: 0 !important;
                background: #ffffff !important;
                box-sizing: border-box;
              }
              @page {
                size: A4 portrait;
                margin: 0;
              }
            }
          `}} />
        </div></div>,
        document.body
      )}
    </Dialog>
  );
}
