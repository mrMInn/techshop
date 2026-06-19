"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomerDetail } from "@/app/actions/customers";
import { Dialog } from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/glass-card";
import {
  RefreshCw,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShoppingCart,
  Banknote,
  Package,
  Calendar,
  Hash,
  Building2,
} from "lucide-react";

interface CustomerDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string | null;
}

export function CustomerDetailDialog({
  isOpen,
  onClose,
  customerId,
}: CustomerDetailDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", customerId],
    queryFn: () => getCustomerDetail(customerId!),
    enabled: !!customerId && isOpen,
  });

  const formatPrice = (price: string | number | null) => {
    if (price === null || price === undefined) return "0 ₫";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(price));
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "N/A";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "N/A";
    }
  };

  const renderOrderStatus = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: "bg-[#7a8a99]", text: "text-white", label: "Nháp" },
      confirmed: { bg: "bg-[#0066cc]", text: "text-white", label: "Đang xử lý" },
      completed: { bg: "bg-[#009b72]", text: "text-white", label: "Đã hoàn thành" },
      cancelled: { bg: "bg-[#df2935]", text: "text-white", label: "Đã hủy" },
      refunded: { bg: "bg-[#6366f1]", text: "text-white", label: "Hoàn tiền" },
    };
    const c = configs[status] || { bg: "bg-gray-500", text: "text-white", label: status };
    return (
      <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shadow-[0_2px_5px_rgba(0,0,0,0.06)] ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  const renderPaymentStatus = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      unpaid: { bg: "bg-[#df2935]", text: "text-white", label: "Chờ thanh toán" },
      partial: { bg: "bg-[#f4a261]", text: "text-white", label: "Trả một phần" },
      paid: { bg: "bg-[#4f46e5]", text: "text-white", label: "Đã thanh toán" },
      refunded: { bg: "bg-[#7a8a99]", text: "text-white", label: "Đã hoàn tiền" },
    };
    const c = configs[status] || { bg: "bg-gray-500", text: "text-white", label: status };
    return (
      <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shadow-[0_2px_5px_rgba(0,0,0,0.06)] ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  const customer = data?.customer;
  const customerOrders = data?.orders || [];
  const purchasedItems = data?.purchasedItems || [];
  const returnsHistory = data?.returns || [];

  // Tính toán thống kê
  const completedOrders = customerOrders.filter((o) => o.status === "completed");
  const totalRevenue = completedOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const totalProfit = completedOrders.reduce((s, o) => s + Number(o.profit || 0), 0);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Hồ Sơ Khách Hàng"
      description="Chi tiết thông tin cá nhân, lịch sử giao dịch và sản phẩm đã mua."
      size="5xl"
    >
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-[#7a7a7a]">
          <RefreshCw className="animate-spin mb-4 text-[#0066cc]" size={24} />
          <p className="text-[17px]">Đang tải hồ sơ khách hàng...</p>
        </div>
      ) : !customer ? (
        <div className="py-16 text-center text-[#7a7a7a] text-[17px]">
          Không tìm thấy thông tin khách hàng.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Customer Profile Header */}
          <div className="flex items-start gap-5">
            {/* Avatar Circle */}
            <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#0066cc] to-[#5ac8fa] flex items-center justify-center text-white text-[28px] font-bold shrink-0 shadow-md">
              {customer.fullName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-[24px] font-semibold text-[#1d1d1f] tracking-tight">
                  {customer.fullName}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    customer.customerType === "business"
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : "bg-blue-50 border-blue-200 text-blue-700"
                  }`}
                >
                  {customer.customerType === "business" ? (
                    <><Building2 size={10} /> Doanh nghiệp</>
                  ) : (
                    <><User size={10} /> Cá nhân</>
                  )}
                </span>
                {customer.leadSourceName && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f5f5f7] border border-[#e0e0e0] text-[#7a7a7a]">
                    {customer.leadSourceIcon} {customer.leadSourceName}
                  </span>
                )}
              </div>

              {/* Contact Info Row */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[14px] text-[#7a7a7a]">
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-[#0066cc]" />
                  {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} className="text-[#0066cc]" />
                    {customer.email}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-[#0066cc]" />
                    {customer.address}
                  </span>
                )}
                {customer.taxCode && (
                  <span className="flex items-center gap-1.5">
                    <Hash size={13} className="text-[#0066cc]" />
                    MST: {customer.taxCode}
                  </span>
                )}
              </div>

              {/* Customer since */}
              <p className="text-[12px] text-[#aaa] mt-1.5 flex items-center gap-1.5">
                <Calendar size={11} />
                Khách hàng từ {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#f5f5f7] rounded-2xl p-4 border border-[#e0e0e0]">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart size={14} className="text-[#0066cc]" />
                <span className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                  Tổng đơn hàng
                </span>
              </div>
              <p className="text-[24px] font-bold text-[#1d1d1f]">{completedOrders.length}</p>
            </div>
            <div className="bg-[#f5f5f7] rounded-2xl p-4 border border-[#e0e0e0]">
              <div className="flex items-center gap-2 mb-1">
                <Banknote size={14} className="text-[#0066cc]" />
                <span className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                  Tổng chi tiêu
                </span>
              </div>
              <p className="text-[22px] font-bold text-[#0066cc]">{formatPrice(totalRevenue)}</p>
            </div>
            <div className="bg-[#f5f5f7] rounded-2xl p-4 border border-[#e0e0e0]">
              <div className="flex items-center gap-2 mb-1">
                <Package size={14} className="text-green-600" />
                <span className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                  SP đã mua
                </span>
              </div>
              <p className="text-[24px] font-bold text-green-600">{purchasedItems.length}</p>
            </div>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText size={14} className="text-amber-600" />
                <span className="text-[12px] font-semibold text-amber-700 uppercase tracking-wider">
                  Ghi chú
                </span>
              </div>
              <p className="text-[14px] text-[#1d1d1f] leading-relaxed">{customer.notes}</p>
            </div>
          )}

          {/* Order History */}
          <div>
            <h4 className="text-[14px] font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
              <ShoppingCart size={14} className="text-[#0066cc]" />
              Lịch sử đơn hàng ({customerOrders.length})
            </h4>
            {customerOrders.length === 0 ? (
              <div className="bg-[#f5f5f7] rounded-2xl p-8 text-center text-[14px] text-[#7a7a7a] border border-[#e0e0e0]">
                Khách hàng chưa có đơn hàng nào.
              </div>
            ) : (
              <div className="border border-[#e0e0e0] rounded-2xl overflow-x-auto">
                <table className="w-full min-w-[700px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f7]/80 text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider border-b border-[#e0e0e0]">
                      <th className="px-4 py-3">Mã đơn</th>
                      <th className="px-4 py-3">Ngày lập</th>
                      <th className="px-4 py-3">Kênh</th>
                      <th className="px-4 py-3 whitespace-nowrap">Trạng thái</th>
                      <th className="px-4 py-3 whitespace-nowrap">Thanh toán</th>
                      <th className="px-4 py-3 text-right">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody className="text-[14px] text-[#1d1d1f]">
                    {customerOrders.map((order) => (
                      <tr key={order.id} className="border-b border-[#e0e0e0] last:border-0 hover:bg-[#f5f5f7]/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#0066cc]">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-[#7a7a7a]">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3 capitalize">{order.saleChannel}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{renderOrderStatus(order.status)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{renderPaymentStatus(order.paymentStatus)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatPrice(order.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Purchased Products */}
          {purchasedItems.length > 0 && (
            <div>
              <h4 className="text-[14px] font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
                <Package size={14} className="text-green-600" />
                Sản phẩm đã mua ({purchasedItems.length})
              </h4>
              <div className="border border-[#e0e0e0] rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f7]/80 text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider border-b border-[#e0e0e0]">
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-4 py-3">Serial</th>
                      <th className="px-4 py-3">Đơn hàng</th>
                      <th className="px-4 py-3">Ngày mua</th>
                      <th className="px-4 py-3">Bảo hành</th>
                      <th className="px-4 py-3 text-right">Giá bán</th>
                    </tr>
                  </thead>
                  <tbody className="text-[14px] text-[#1d1d1f]">
                    {purchasedItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-[#e0e0e0] last:border-0 hover:bg-[#f5f5f7]/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-[11px] text-[#7a7a7a]">{item.brandName}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-[13px] text-[#7a7a7a]">{item.serialNumber}</td>
                        <td className="px-4 py-3 text-[#0066cc] font-medium">{item.orderNumber}</td>
                        <td className="px-4 py-3 text-[#7a7a7a]">{formatDate(item.orderDate)}</td>
                        <td className="px-4 py-3 text-[#7a7a7a]">{item.warrantyMonths} tháng</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatPrice(item.sellingPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Returns History */}
          {returnsHistory.length > 0 && (
            <div>
              <h4 className="text-[14px] font-semibold text-[#1d1d1f] mb-3 flex items-center gap-2">
                <RefreshCw size={14} className="text-[#0066cc]" />
                Lịch sử đổi/trả hàng ({returnsHistory.length})
              </h4>
              <div className="border border-[#e0e0e0] rounded-2xl overflow-x-auto">
                <table className="w-full min-w-[800px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f7]/80 text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wider border-b border-[#e0e0e0]">
                      <th className="px-4 py-3">Loại</th>
                      <th className="px-4 py-3">Mã phiếu</th>
                      <th className="px-4 py-3">Lý do</th>
                      <th className="px-4 py-3">Máy cũ trả lại</th>
                      <th className="px-4 py-3">Máy mới đổi đi</th>
                      <th className="px-4 py-3 text-right">Cân đối (VND)</th>
                    </tr>
                  </thead>
                  <tbody className="text-[14px] text-[#1d1d1f]">
                    {returnsHistory.map((ret, idx) => (
                      <tr key={idx} className="border-b border-[#e0e0e0] last:border-0 hover:bg-[#f5f5f7]/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {ret.type === "return" ? (
                            <span className="text-rose-600 font-semibold text-[13px] bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Trả hàng</span>
                          ) : (
                            <span className="text-blue-600 font-semibold text-[13px] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Đổi hàng</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#0066cc] text-[13px]">{ret.returnNumber}</td>
                        <td className="px-4 py-3 text-[13px] text-[#7a7a7a]">
                          {ret.reason === 'defective' ? 'Lỗi NSX' : 
                           ret.reason === 'wrong_item' ? 'Sai sản phẩm' : 
                           ret.reason === 'changed_mind' ? 'Đổi ý' : 
                           ret.reason === 'upgrade' ? 'Nâng cấp' : 
                           ret.reason === 'downgrade' ? 'Hạ cấp' : 'Khác'}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[13px] line-clamp-1">{ret.productName}</p>
                          <p className="text-[11px] text-[#7a7a7a] font-mono mt-0.5">SN: {ret.oldSerialNumber}</p>
                        </td>
                        <td className="px-4 py-3">
                          {ret.type === "exchange" && ret.newSerialNumber ? (
                            <p className="text-[11px] text-[#7a7a7a] font-mono mt-0.5">SN: {ret.newSerialNumber}</p>
                          ) : (
                            <span className="text-[13px] text-[#7a7a7a] italic">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {ret.type === "return" ? (
                            <span className="text-rose-600">- {formatPrice(ret.refundAmount)}</span>
                          ) : (
                            Number(ret.exchangeDifference) >= 0 ? (
                              <span className="text-green-600">+ {formatPrice(ret.exchangeDifference)}</span>
                            ) : (
                              <span className="text-rose-600">- {formatPrice(Math.abs(Number(ret.exchangeDifference)))}</span>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
