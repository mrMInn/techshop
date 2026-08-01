"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { getOrderDetail, completeOnlineOrderAction, cancelOrderAction } from "@/app/actions/orders";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar, Tag, ShieldCheck, DollarSign, FileText, User, RefreshCw, ShoppingBag, Pencil, Printer, Download } from "lucide-react";
import { toPng } from "html-to-image";
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
  const [downloadingImage, setDownloadingImage] = useState(false);

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

  // Hàm tải ảnh hóa đơn PNG độ nét cao gửi khách qua điện thoại
  const handleDownloadReceiptImage = async () => {
    const node = document.getElementById(`receipt-image-${order.id}`);
    if (!node) return;
    try {
      setDownloadingImage(true);
      // Kết xuất hình ảnh với pixelRatio: 3 để đạt độ nét Retina cực đại
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '420px',
        }
      });
      const link = document.createElement("a");
      link.download = `HD_${order.orderNumber}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Đã tải xuống ảnh hóa đơn gửi khách thành công!");
    } catch (error) {
      console.error("Lỗi khi tạo ảnh hóa đơn:", error);
      toast.error("Không thể tạo ảnh hóa đơn, vui lòng thử lại!");
    } finally {
      setDownloadingImage(false);
    }
  };

  // Hàm xử lý in hóa đơn bán hàng (K80 nhiệt chuẩn Apple Store)

  // Hàm xử lý in hóa đơn bán hàng (K80 nhiệt chuẩn Apple Store)
  const handlePrintReceipt = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Hóa đơn #${order.orderNumber}</title>
          <style>
            @page { size: auto; margin: 4mm; }
            body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 0; }
            .container { width: 80mm; max-width: 100%; margin: 0 auto; padding: 4px; }
            .header { text-align: center; margin-bottom: 12px; }
            .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
            .subtitle { font-size: 10px; margin-bottom: 4px; color: #333; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .info-table td { padding: 2px 0; font-size: 10px; vertical-align: top; }
            .info-label { color: #555; width: 75px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .items-table th { border-bottom: 1px dashed #000; padding: 4px 2px; font-size: 9px; font-weight: bold; text-align: left; text-transform: uppercase; }
            .items-table td { border-bottom: 1px dashed #eee; padding: 5px 2px; font-size: 10px; vertical-align: top; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals-section { width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 12px; border-top: 1px dashed #000; padding-top: 5px; }
            .totals-section td { padding: 2.5px 0; font-size: 10px; }
            .totals-label { text-align: left; }
            .totals-val { text-align: right; font-weight: bold; }
            .total-bold { font-size: 11px; font-weight: 800; border-top: 1px dashed #000; padding-top: 4px; }
            .footer { text-align: center; font-size: 9px; margin-top: 15px; border-top: 1px dashed #000; padding-top: 8px; color: #444; }
            .specs { font-size: 9px; color: #555; margin-top: 1px; }
            .sn { font-size: 9px; color: #555; margin-top: 1px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">TECH SHOP</div>
              <div class="subtitle">Điện thoại - Laptop - Phụ kiện uy tín</div>
              <div class="subtitle">Hotline: 0987.654.321 • techshop.vn</div>
              <div style="margin-top: 8px; font-weight: bold; font-size: 12px; text-transform: uppercase;">HÓA ĐƠN BÁN HÀNG</div>
              <div style="font-size: 9px; color: #555; margin-top: 1px;">Số HD: #${order.orderNumber}</div>
            </div>
            
            <table class="info-table">
              <tr>
                <td class="info-label">Khách hàng:</td>
                <td style="font-weight: bold;">${order.customerName}</td>
              </tr>
              <tr>
                <td class="info-label">Điện thoại:</td>
                <td>${order.customerPhone}</td>
              </tr>
              ${order.customerAddress ? `
              <tr>
                <td class="info-label">Địa chỉ:</td>
                <td>${order.customerAddress}</td>
              </tr>` : ""}
              <tr>
                <td class="info-label">Ngày bán:</td>
                <td>${formatDateTime(order.createdAt)}</td>
              </tr>
              <tr>
                <td class="info-label">Kênh bán:</td>
                <td style="text-transform: capitalize;">${order.saleChannel}</td>
              </tr>
              <tr>
                <td class="info-label">Hình thức TT:</td>
                <td>${getPaymentMethodName(order.paymentMethod)}</td>
              </tr>
            </table>
            
            <table class="items-table">
              <thead>
                <tr>
                  <th>Sản phẩm / BH</th>
                  <th class="text-right" style="width: 25px;">SL</th>
                  <th class="text-right" style="width: 70px;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item: any) => {
                  const finalPrice = Math.max(0, Number(item.sellingPrice) - Number(item.discount));
                  const specsText = item.productSpecs ? formatSpecs(item.productSpecs) : "";
                  return `
                    <tr>
                      <td>
                        <div style="font-weight: bold;">
                          ${item.productName} 
                          ${item.isGift ? '<span style="font-size: 8px; font-weight: normal; border: 0.5px solid #000; padding: 0 2px; border-radius: 2px; margin-left: 2px;">TẶNG</span>' : ''}
                        </div>
                        ${specsText ? `<div class="specs">${specsText}</div>` : ""}
                        ${item.serialNumber ? `<div class="sn">S/N: ${item.serialNumber}</div>` : ""}
                        <div style="font-size: 8px; color: #666; margin-top: 1.5px;">Bảo hành: ${item.warrantyMonths} tháng ${item.warrantyMonths > 0 ? `(${formatWarrantyRange(order.createdAt, item.warrantyMonths)})` : ""}</div>
                      </td>
                      <td class="text-right" style="vertical-align: middle;">1</td>
                      <td class="text-right" style="vertical-align: middle; font-weight: bold;">
                        ${formatPrice(finalPrice)}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
            
            <table class="totals-section">
              <tr>
                <td class="totals-label">Cộng tiền hàng:</td>
                <td class="totals-val">${formatPrice(order.subtotal)}</td>
              </tr>
              ${Number(order.discountAmount) > 0 ? `
              <tr>
                <td class="totals-label">Giảm giá:</td>
                <td class="totals-val" style="color: red;">-${formatPrice(order.discountAmount)}</td>
              </tr>` : ""}
              ${Number(order.taxAmount) > 0 ? `
              <tr>
                <td class="totals-label">Thuế GTGT:</td>
                <td class="totals-val">${formatPrice(order.taxAmount)}</td>
              </tr>` : ""}
              <tr class="total-bold">
                <td class="totals-label" style="font-size: 11px;">TỔNG CẦN THANH TOÁN:</td>
                <td class="totals-val" style="font-size: 11px; font-weight: 800;">${formatPrice(order.totalAmount)}</td>
              </tr>
              <tr>
                <td class="totals-label">Đã thanh toán:</td>
                <td class="totals-val" style="color: green;">${formatPrice(totalPaid)}</td>
              </tr>
              ${remainingAmount > 0 ? `
              <tr>
                <td class="totals-label" style="font-weight: bold;">Còn lại cần thu (COD):</td>
                <td class="totals-val" style="color: #d97706;">${formatPrice(remainingAmount)}</td>
              </tr>` : ""}
            </table>
            
            ${order.notes ? `
            <div style="font-size: 9px; border: 0.5px solid #000; padding: 5px; border-radius: 4px; margin-bottom: 10px; background: #fafafa; line-height: 1.3;">
              <div style="font-weight: bold; margin-bottom: 2px; text-transform: uppercase; font-size: 8px; color: #555;">Ghi chú đơn hàng:</div>
              <div>${order.notes}</div>
            </div>` : ""}
            
            <div class="footer">
              <div>Cảm ơn Quý khách đã mua sắm tại TECH SHOP!</div>
              <div style="margin-top: 3px;">Vui lòng giữ hóa đơn này để được hỗ trợ bảo hành tốt nhất.</div>
              <div style="margin-top: 4px; font-weight: bold;">Hẹn gặp lại Quý khách!</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };


  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Chi tiết đơn hàng"
      description={
        order ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>Mã đơn: <span className="font-semibold text-[#1d1d1f]">{order.orderNumber}</span></span>
            <span className="text-[#e0e0e0]">•</span>
            <span>Ngày lập: <span className="font-semibold text-[#1d1d1f]">{formatDate(order.createdAt)}</span></span>
            <span className="text-[#e0e0e0]">•</span>
            <span className="flex items-center gap-1.5 ml-1 select-none">
              {renderDetailOrderStatus(order.status)}
              {renderDetailPaymentStatus(order.paymentStatus)}
            </span>
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
          <div className="space-y-6 pt-2">
            {/* Action Bar: In & Tải hóa đơn */}
            <div className="flex justify-end gap-3 pb-1">
              <button
                type="button"
                disabled={downloadingImage}
                onClick={handleDownloadReceiptImage}
                className="h-[36px] px-4 bg-[#0066cc] hover:bg-[#0071e3] disabled:opacity-50 text-white text-[13px] font-semibold rounded-full flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 duration-150 shadow-sm"
              >
                {downloadingImage ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>Tải ảnh gửi khách</span>
              </button>
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="h-[36px] px-4 bg-white border border-[#e0e0e0] hover:bg-[#f5f5f7] text-[#1d1d1f] text-[13px] font-semibold rounded-full flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 duration-150 shadow-sm"
              >
                <Printer size={14} />
                <span>In nhiệt K80</span>
              </button>
            </div>

            {/* Metadata Section: Apple Minimalist 3-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* COLUMN 1: Trạng thái & Khách hàng */}
              <div className="flex flex-col gap-4 h-full">
                

                {/* 1.2 Customer & Transaction Card */}
                <div className="bg-[#f5f5f7] rounded-[24px] p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e0e0e0]/50">
                    <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Khách hàng & Giao dịch</span>
                    <button
                      type="button"
                      onClick={() => setIsEditShippingOpen(true)}
                      className="text-[12px] font-semibold text-[#0066cc] hover:text-[#0071e3] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil size={12} />
                      <span>Cập nhật vận đơn</span>
                    </button>
                  </div>
                  <div className="space-y-4 text-[14px] flex-1 flex flex-col justify-between">
                    {/* Customer Section */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">Khách hàng</span>
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
                          Vận đơn: <span className="bg-white border border-[#e0e0e0] px-1.5 py-0.5 rounded text-[12px] text-[#1d1d1f] font-semibold">{order.trackingNumber}</span>
                        </p>
                      )}
                      {order.packingVideoUrl && (
                        <p className="text-[#515154] text-[13px] mt-1">
                          🎥 Video đóng gói: <a href={order.packingVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#0066cc] hover:underline font-semibold">Xem video</a>
                        </p>
                      )}
                    </div>

                    <div className="border-t border-[#e0e0e0]/50 my-2"></div>

                    {/* Transaction Section */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider block">Giao dịch</span>
                      <p className="text-[#515154] text-[13px]">Nhân viên: <span className="font-semibold text-[#1d1d1f]">{order.soldByName || "Hệ thống"}</span></p>
                      <p className="text-[#515154] text-[13px]">Kênh bán: <span className="capitalize font-semibold text-[#1d1d1f]">{order.saleChannel}</span></p>
                      <p className="text-[#515154] text-[13px]">Thanh toán: <span className="font-semibold text-[#1d1d1f]">{getPaymentMethodName(order.paymentMethod)}</span></p>
                    </div>
                  </div>
                </div>

              </div>

              {/* COLUMN 2: Chi tiết tài chính & Ghi chú */}
              <div className="flex flex-col gap-4 h-full">
                
                {/* 2.1 Chi tiết tài chính */}
                <div className="bg-[#f5f5f7] rounded-[24px] p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#e0e0e0]/50">
                    <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Chi tiết tài chính</span>
                  </div>
                  <div className="space-y-4 text-[14px] flex-1 flex flex-col justify-between">
                    {/* Revenue Summary */}
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[#86868b]">
                        <span>Cộng tiền hàng:</span>
                        <span className="font-semibold text-[#1d1d1f]">{formatPrice(order.subtotal)}</span>
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
                          <span className="font-semibold text-[#1d1d1f]">{formatPrice(order.taxAmount)}</span>
                        </div>
                      )}
                      <div className="border-t border-[#e0e0e0]/50 pt-2 flex justify-between text-[16px] font-black text-[#1d1d1f]">
                        <span>Tổng thanh toán:</span>
                        <span className="text-[#0066cc]">{formatPrice(order.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[13px] text-[#009b72] font-bold">
                        <span>Đã thanh toán:</span>
                        <span>{formatPrice(totalPaid)}</span>
                      </div>
                      {remainingAmount > 0 && (
                        <div className="flex justify-between text-[13px] text-[#d97706] font-bold">
                          <span>Còn lại cần thu:</span>
                          <span>{formatPrice(remainingAmount)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#e0e0e0]/50 my-2"></div>

                    {/* Cost & Profit (Internal only) */}
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-[#86868b]">
                        <span>Giá vốn sản phẩm:</span>
                        <span className="font-semibold text-[#1d1d1f]">{formatPrice(order.totalCost)}</span>
                      </div>
                      <div className="flex justify-between text-[13px] font-bold pt-0.5">
                        <span className="text-[#1d1d1f]">Lợi nhuận thực:</span>
                        <span className="text-[#009b72]">{formatPrice(order.profit)}</span>
                      </div>
                      <div className="flex justify-between font-semibold uppercase text-[10px] tracking-wider text-[#86868b]">
                        <span>Tỷ suất lợi nhuận:</span>
                        <span className="text-[#009b72]">{Number(order.profitMargin).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2.2 Internal Notes Widget */}
                <div className="bg-[#f5f5f7] rounded-[24px] p-6 space-y-3 min-h-[140px] flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-[#e0e0e0]/50">
                    <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Ghi chú đơn hàng</span>
                  </div>
                  <div className="text-[13px] leading-relaxed text-[#1d1d1f] flex-1 italic flex items-center justify-center text-center py-2">
                    {order.notes || "Không có ghi chú thêm."}
                  </div>
                </div>

                {/* 2.3 Delivery Action Card (if processing) */}
                {order.status === "processing" && (
                  <div className="bg-amber-500/5 border border-amber-500/10 p-6 rounded-[24px] flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <span className="text-[14px] font-bold text-amber-800 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
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
                        className="w-full h-[40px] bg-[#0066cc] hover:bg-[#0071e3] text-white text-[14px] font-semibold rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 duration-150"
                      >
                        Giao thành công
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsConfirmCancelOpen(true)}
                        className="w-full h-[40px] bg-[#df2935] hover:bg-[#c2242e] text-white text-[14px] font-semibold rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 duration-150"
                      >
                        Giao thất bại
                      </button>
                    </div>
                  </div>
                )}

              </div>


            </div>

            {/* ROW 3: Danh sách sản phẩm (Bung hết thông tin) */}
            <div className="bg-[#f5f5f7] rounded-[24px] p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#e0e0e0]/50">
                <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Danh sách sản phẩm ({items.length})</span>
              </div>
              <div className="overflow-hidden bg-transparent">
                <table className="w-full text-left border-collapse text-[13px] table-fixed">
                  <thead>
                    <tr className="border-b border-[#e0e0e0]/60 text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">
                      <th className="px-3 py-2.5 text-center w-[50px]">STT</th>
                      <th className="px-3 py-2.5 w-[45%]">Sản phẩm & Thông tin</th>
                      <th className="px-3 py-2.5 text-left w-[20%]">Bảo hành</th>
                      <th className="px-3 py-2.5 text-right w-[12%]">Giá bán</th>
                      <th className="px-3 py-2.5 text-right w-[10%]">Giảm giá</th>
                      <th className="px-3 py-2.5 text-right w-[13%]">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, index: number) => {
                      const finalPrice = Math.max(0, Number(item.sellingPrice) - Number(item.discount));
                      return (
                        <tr key={item.id} className="border-b border-[#e0e0e0]/40 last:border-0 hover:bg-black/[0.015] transition-colors">
                          <td className="px-3 py-3.5 text-center text-[13px] text-[#86868b] align-top">{index + 1}</td>
                          <td className="px-3 py-3.5 align-top">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-[#1d1d1f]">{item.productName}</span>
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
                              {item.serialNumber && (
                                <span className="text-[11px] text-[#86868b] font-normal mt-1.5 leading-none">
                                  S/N: <span className="text-[#515154] font-medium">{item.serialNumber}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-left align-top">
                            <div className="space-y-0.5">
                              <span className="font-semibold text-[#1d1d1f] block">{item.warrantyMonths} tháng</span>
                              {item.warrantyMonths > 0 && (
                                <span className="text-[10px] text-[#86868b] block">
                                  {formatWarrantyRange(order.createdAt, item.warrantyMonths)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right font-medium text-[#1d1d1f] align-top">{formatPrice(item.sellingPrice)}</td>
                          <td className="px-3 py-3.5 text-right text-[#df2935] font-medium align-top">
                            {Number(item.discount) > 0 ? `-${formatPrice(item.discount)}` : "0đ"}
                          </td>
                          <td className="px-3 py-3.5 text-right font-bold text-[#0066cc] align-top">{formatPrice(finalPrice)}</td>
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

            {/* Hidden container for E-Receipt Image Generation */}
            <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
              <div 
                id={`receipt-image-${order.id}`}
                className="w-[420px] bg-white p-6 text-[#1d1d1f] font-sans flex flex-col gap-6"
                style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
              >
                {/* Header */}
                <div className="text-center space-y-1 pb-4 border-b border-dashed border-[#e0e0e0]">
                  <h1 className="text-[20px] font-black tracking-wide uppercase text-[#0066cc]">Tech Shop</h1>
                  <p className="text-[12px] text-[#86868b] font-medium">Điện thoại - Laptop - Phụ kiện uy tín</p>
                  <p className="text-[11px] text-[#86868b]">Hotline: 0987.654.321 • techshop.vn</p>
                  <div className="inline-block mt-3 px-3 py-1 bg-[#0066cc]/8 text-[#0066cc] border border-[#0066cc]/10 rounded-full text-[12px] font-extrabold uppercase">
                    Hóa đơn điện tử
                  </div>
                  <p className="text-[10px] text-[#86868b] mt-1">Mã đơn: #{order.orderNumber}</p>
                </div>

                {/* Info */}
                <div className="space-y-2 text-[12px] bg-[#f5f5f7] p-4 rounded-2xl">
                  <div className="flex justify-between">
                    <span className="text-[#86868b]">Khách hàng:</span>
                    <span className="font-bold text-[#1d1d1f]">{order.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868b]">Điện thoại:</span>
                    <span className="font-semibold text-[#1d1d1f]">{order.customerPhone}</span>
                  </div>
                  {order.customerAddress && (
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-[#86868b]">Địa chỉ:</span>
                      <span className="text-[#1d1d1f] leading-normal">{order.customerAddress}</span>
                    </div>
                  )}
                  <div className="border-t border-[#e0e0e0] my-1.5 opacity-50"></div>
                  <div className="flex justify-between">
                    <span className="text-[#86868b]">Ngày mua:</span>
                    <span className="text-[#1d1d1f]">{formatDateTime(order.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868b]">Kênh bán hàng:</span>
                    <span className="text-[#1d1d1f] capitalize">{order.saleChannel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868b]">Hình thức thanh toán:</span>
                    <span className="text-[#1d1d1f]">{getPaymentMethodName(order.paymentMethod)}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider text-left">Danh sách sản phẩm</h3>
                  <div className="space-y-3.5">
                    {items.map((item: any) => {
                      const finalPrice = Math.max(0, Number(item.sellingPrice) - Number(item.discount));
                      const specsText = item.productSpecs ? formatSpecs(item.productSpecs) : "";
                      return (
                        <div key={item.id} className="flex justify-between items-start gap-4 text-[12px] pb-3 border-b border-[#e0e0e0]/40 last:border-0 last:pb-0">
                          <div className="space-y-1 min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-[#1d1d1f] break-words">{item.productName}</span>
                              {item.isGift && (
                                <span className="inline-flex items-center px-1.5 py-0.2 bg-[#0066cc]/8 text-[#0066cc] border border-[#0066cc]/10 rounded-full text-[9px] font-bold">
                                  Tặng
                                </span>
                              )}
                            </div>
                            {specsText && (
                              <p className="text-[10px] text-[#86868b] leading-normal">{specsText}</p>
                            )}
                            {item.serialNumber && (
                              <p className="text-[10px] text-[#86868b]">S/N: {item.serialNumber}</p>
                            )}
                            <p className="text-[10px] text-[#86868b]">Bảo hành: {item.warrantyMonths} tháng {item.warrantyMonths > 0 && `(${formatWarrantyRange(order.createdAt, item.warrantyMonths)})`}</p>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <span className="font-bold text-[#1d1d1f] block">{formatPrice(finalPrice)}</span>
                            {Number(item.discount) > 0 && (
                              <span className="text-[10px] text-[#df2935] block">Giảm: -{formatPrice(item.discount)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financials */}
                <div className="border-t border-dashed border-[#e0e0e0] pt-4 space-y-2.5 text-[12px]">
                  <div className="flex justify-between text-[#86868b]">
                    <span>Cộng tiền hàng:</span>
                    <span className="font-medium text-[#1d1d1f]">{formatPrice(order.subtotal)}</span>
                  </div>
                  {Number(order.discountAmount) > 0 && (
                    <div className="flex justify-between text-[#df2935]">
                      <span>Khấu trừ giảm giá:</span>
                      <span className="font-semibold">-{formatPrice(order.discountAmount)}</span>
                    </div>
                  )}
                  {Number(order.taxAmount) > 0 && (
                    <div className="flex justify-between text-[#86868b]">
                      <span>Thuế GTGT:</span>
                      <span className="font-medium text-[#1d1d1f]">{formatPrice(order.taxAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-[#e0e0e0] pt-3 flex justify-between text-[15px] font-black text-[#1d1d1f]">
                    <span>TỔNG THANH TOÁN:</span>
                    <span className="text-[#0066cc]">{formatPrice(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[#009b72] font-bold">
                    <span>Khách đã trả:</span>
                    <span>{formatPrice(totalPaid)}</span>
                  </div>
                  {remainingAmount > 0 && (
                    <div className="flex justify-between text-[#d97706] font-bold">
                      <span>Còn lại cần thu (COD):</span>
                      <span>{formatPrice(remainingAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="text-center pt-4 border-t border-dashed border-[#e0e0e0] text-[10px] text-[#86868b] space-y-1">
                  <p className="font-semibold text-[#1d1d1f] text-[11px]">Cảm ơn Quý khách đã ủng hộ Tech Shop!</p>
                  <p>Hóa đơn điện tử có giá trị tra cứu bảo hành.</p>
                  <p>Rất hân hạnh được phục vụ Quý khách lần sau!</p>
                </div>
              </div>
            </div>
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
    </Dialog>
  );
}
