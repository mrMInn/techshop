"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Phone, User, Mail, MapPin, ShoppingBag, CreditCard, RefreshCw, FileText, ExternalLink } from "lucide-react";
import { 
  SFSymbolMagnifyingGlass,
  SFSymbolCalendar,
  SFSymbolShoppingBag,
  SFSymbolTruck,
  SFSymbolWrench,
  SFSymbolArrowClockwise,
  SFSymbolLandmark,
  SFSymbolActivity,
  SFSymbolQRCode,
  SFSymbolFileSpreadsheet
} from "@/components/ui/apple-icons";
import { searchCustomersByPhone, getCustomerDetail } from "@/app/actions/customers";
import { getInventoryItemLifecycle } from "@/app/actions/inventory";
import Link from "next/link";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/glass-card";

// Status mappings for machines and orders
const statusMapping: Record<string, { label: string; bg: string; text: string; border: string }> = {
  incoming: { label: "Đang về", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200/50" },
  in_stock: { label: "Sẵn hàng", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/50" },
  sold: { label: "Đã bán", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200/50" },
  warranty_repair: { label: "Bảo hành", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200/50" },
  returned: { label: "Đã trả NCC", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200/50" },
  defective: { label: "Hàng lỗi", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200/50" },
  deleted: { label: "Đã ẩn", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

const orderStatusMapping: Record<string, { label: string; bg: string }> = {
  draft: { label: "Nháp", bg: "bg-slate-100 text-slate-700" },
  confirmed: { label: "Đã xác nhận", bg: "bg-blue-100 text-blue-700" },
  processing: { label: "Đang xử lý", bg: "bg-amber-100 text-amber-700" },
  completed: { label: "Hoàn thành", bg: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Đã hủy", bg: "bg-rose-100 text-rose-700" },
  refunded: { label: "Đã hoàn tiền", bg: "bg-violet-100 text-violet-700" },
};

const milestoneColors: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  purchase: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/60", icon: <SFSymbolLandmark size={14} className="text-amber-600" /> },
  sale: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/60", icon: <SFSymbolShoppingBag size={14} className="text-emerald-600" /> },
  warranty: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200/60", icon: <SFSymbolWrench size={14} className="text-teal-600" /> },
  return: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200/60", icon: <SFSymbolArrowClockwise size={14} className="text-rose-600" /> },
  movement: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", icon: <SFSymbolActivity size={14} className="text-slate-500" /> },
};

const formatToDDMMYYYY = (dateString: string | Date | null) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "N/A";
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatPrice = (price: string | number | null) => {
  if (price === null || price === undefined) return "0đ";
  return Math.round(Number(price || 0)).toLocaleString("vi-VN") + "đ";
};

const formatSpecs = (specs: any): string => {
  if (!specs) return "";
  if (typeof specs === "string") return specs;
  if (typeof specs === "object") {
    const s = specs as { cpu?: string; ram?: string; ssd?: string; gpu?: string; screen?: string; color?: string };
    const parts = [];
    if (s.cpu) parts.push(`CPU: ${s.cpu}`);
    if (s.ram) parts.push(`RAM: ${s.ram}`);
    if (s.ssd) parts.push(`SSD: ${s.ssd}`);
    if (s.gpu) parts.push(`GPU: ${s.gpu}`);
    if (s.screen) parts.push(`Màn hình: ${s.screen}`);
    if (s.color) parts.push(`Màu: ${s.color}`);
    return parts.join(" | ");
  }
  return String(specs);
};

export default function LookupPage() {
  // Smart Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"customer" | "serial" | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Phone Lookup States
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Serial Lookup States
  const [serialLoading, setSerialLoading] = useState(false);
  const [lifecycleData, setLifecycleData] = useState<any>(null);

  // Update URL parameters
  const updateURL = (value: string, forceType?: "customer" | "serial") => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (forceType === "serial") {
        url.searchParams.set("serial", value);
        url.searchParams.delete("q");
        url.searchParams.delete("phone");
      } else if (forceType === "customer") {
        url.searchParams.set("phone", value);
        url.searchParams.delete("q");
        url.searchParams.delete("serial");
      } else {
        url.searchParams.set("q", value);
        url.searchParams.delete("phone");
        url.searchParams.delete("serial");
      }
      url.searchParams.delete("tab");
      window.history.pushState({}, "", url.toString());
    }
  };

  // Switch to Serial Tab & lookup Serial Number
  const triggerSerialLookup = (serialToSearch: string) => {
    setSearchQuery(serialToSearch);
    handleSearch(serialToSearch, "serial");
  };

  // Switch to Customer Tab & lookup Phone Number
  const triggerPhoneLookup = (phoneToSearch: string) => {
    setSearchQuery(phoneToSearch);
    handleSearch(phoneToSearch, "customer");
  };

  // Search by Phone Number
  const handleSearchPhone = async (phoneToSearch: string): Promise<boolean> => {
    const target = phoneToSearch.trim();
    if (!target) {
      toast.error("Vui lòng nhập số điện thoại");
      return false;
    }

    setPhoneLoading(true);
    setSearchResults([]);
    setSelectedCustomerId(null);
    setCustomerDetail(null);

    try {
      const res = await searchCustomersByPhone(target);
      if (res.success && res.customers && res.customers.length > 0) {
        setSearchResults(res.customers);
        if (res.customers.length === 1) {
          const customerId = res.customers[0].id;
          setSelectedCustomerId(customerId);
          fetchCustomerDetail(customerId);
        } else if (res.customers.length > 1) {
          toast.info(`Tìm thấy ${res.customers.length} khách hàng trùng khớp`);
        }
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err.message || "Lỗi kết nối máy chủ");
      return false;
    } finally {
      setPhoneLoading(false);
    }
  };

  // Fetch Details of a Selected Customer
  const fetchCustomerDetail = async (customerId: string) => {
    setDetailLoading(true);
    setCustomerDetail(null);
    try {
      const detail = await getCustomerDetail(customerId);
      if (detail) {
        setCustomerDetail(detail);
      } else {
        toast.error("Không thể tải chi tiết lịch sử khách hàng");
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi truy xuất chi tiết");
    } finally {
      setDetailLoading(false);
    }
  };

  // Search by Serial Number
  const handleSearchSerial = async (serialToSearch: string): Promise<boolean> => {
    const target = serialToSearch.trim();
    if (!target) {
      toast.error("Vui lòng nhập số Serial");
      return false;
    }

    setSerialLoading(true);
    setLifecycleData(null);

    try {
      const res = await getInventoryItemLifecycle(target);
      if (res.success) {
        setLifecycleData(res);
        toast.success("Đã tìm thấy lịch sử vòng đời thiết bị");
        return true;
      }
      return false;
    } catch (err: any) {
      toast.error(err.message || "Lỗi truy xuất lịch sử vòng đời");
      return false;
    } finally {
      setSerialLoading(false);
    }
  };

  // Unified Search Handler
  const handleSearch = async (queryToSearch: string, forceType?: "customer" | "serial") => {
    const target = queryToSearch.trim();
    if (!target) {
      toast.error("Vui lòng nhập số điện thoại hoặc mã Serial");
      return;
    }

    updateURL(target, forceType);

    if (forceType === "serial") {
      setSearchType("serial");
      const found = await handleSearchSerial(target);
      if (!found) {
        toast.error("Không tìm thấy thông tin thiết bị với Serial này");
      }
      return;
    }

    if (forceType === "customer") {
      setSearchType("customer");
      const found = await handleSearchPhone(target);
      if (!found) {
        toast.error("Không tìm thấy khách hàng nào với SĐT này");
      }
      return;
    }

    // Strip common non-alphanumeric phone characters: spaces, dashes, dots, parentheses
    const cleanNum = target.replace(/[\s\-\.\(\)]/g, "");
    
    // Check if the cleaned query is a phone number (numeric and has 8-15 digits, optional leading +)
    const isPhonePattern = /^\+?[0-9]{8,15}$/.test(cleanNum);

    if (isPhonePattern) {
      setSearchType("customer");
      const foundCustomer = await handleSearchPhone(target);
      
      // Fallback to Serial Search if no customer is found
      if (!foundCustomer) {
        setSearchType("serial");
        const foundSerial = await handleSearchSerial(target);
        if (!foundSerial) {
          toast.error("Không tìm thấy khách hàng hoặc thiết bị nào khớp");
        }
      }
    } else {
      setSearchType("serial");
      const foundSerial = await handleSearchSerial(target);
      if (!foundSerial) {
        toast.error("Không tìm thấy thiết bị nào với Serial này");
      }
    }
  };

  // Read URL params and auto-search on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qParam = params.get("q");
      const phoneParam = params.get("phone");
      const serialParam = params.get("serial");

      if (serialParam) {
        setSearchQuery(serialParam);
        handleSearch(serialParam, "serial");
      } else if (phoneParam) {
        setSearchQuery(phoneParam);
        handleSearch(phoneParam, "customer");
      } else if (qParam) {
        setSearchQuery(qParam);
        handleSearch(qParam);
      }
    }
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // === RENDER METHODS TO AVOID JSX TERNARY NESTING ===

  const renderCustomerTab = () => {
    if (phoneLoading) {
      return (
        <GlassCard className="flex flex-col items-center justify-center py-24 text-[#7a7a7a]">
          <Loader2 className="animate-spin mb-3 text-[#0066cc]" size={24} />
          <p className="text-[14px] font-bold text-[#1d1d1f]">Đang tra cứu dữ liệu khách hàng...</p>
        </GlassCard>
      );
    }

    if (searchResults.length > 1 && !selectedCustomerId) {
      return (
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold text-[#7a7a7a] uppercase tracking-wider pl-1">Kết quả tìm kiếm trùng khớp ({searchResults.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((cust) => (
              <GlassCard 
                key={cust.id}
                onClick={() => {
                  setSelectedCustomerId(cust.id);
                  fetchCustomerDetail(cust.id);
                }}
                className="p-5 hover:border-[#0066cc] hover:shadow-md cursor-pointer transition-all duration-200 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0066cc] flex items-center justify-center font-bold">
                    {cust.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 group-hover:text-[#0066cc] transition-colors">{cust.fullName}</h4>
                    <p className="text-[12px] text-[#7a7a7a]">{cust.phone}</p>
                  </div>
                </div>
                <div className="space-y-1 text-[12px] text-[#515154] border-t border-slate-100 pt-2 mt-2">
                  {cust.email && <p className="truncate">📧 {cust.email}</p>}
                  {cust.address && <p className="truncate">📍 {cust.address}</p>}
                  <div className="flex justify-between font-bold text-slate-700 mt-1">
                    <span>Đơn hàng: {cust.orderCount}</span>
                    <span>Đã tiêu: {formatPrice(cust.totalSpent)}</span>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      );
    }

    if (selectedCustomerId) {
      if (detailLoading) {
        return (
          <GlassCard className="flex flex-col items-center justify-center py-24 text-[#7a7a7a]">
            <Loader2 className="animate-spin mb-3 text-[#0066cc]" size={24} />
            <p className="text-[14px] font-bold text-[#1d1d1f]">Đang tải hồ sơ khách hàng...</p>
          </GlassCard>
        );
      }

      if (customerDetail) {
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Customer Profile */}
            <div className="lg:col-span-4 space-y-6">
              <GlassCard className="p-6 space-y-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50/50 blur-3xl rounded-full" />
                
                {/* Top Avatar Box */}
                <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-slate-100 z-10 relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-blue-600 text-white flex items-center justify-center text-[22px] font-extrabold shadow-md">
                    {customerDetail.customer.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-[18px] font-extrabold text-[#1d1d1f] tracking-tight leading-tight">
                      {customerDetail.customer.fullName}
                    </h3>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider leading-none mt-2 bg-slate-100 border-slate-200 text-slate-700">
                      {customerDetail.customer.customerType === "business" ? "Doanh nghiệp" : "Cá nhân"}
                    </span>
                  </div>
                </div>

                {/* Profile Specs */}
                <div className="space-y-3 text-[13px] font-semibold text-slate-800">
                  <div className="flex items-start gap-2.5">
                    <Phone className="text-slate-400 shrink-0 mt-0.5" size={14} />
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Số điện thoại</span>
                      <span className="text-[13px]">{customerDetail.customer.phone}</span>
                    </div>
                  </div>
                  {customerDetail.customer.email && (
                    <div className="flex items-start gap-2.5">
                      <Mail className="text-slate-400 shrink-0 mt-0.5" size={14} />
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Email</span>
                        <span>{customerDetail.customer.email}</span>
                      </div>
                    </div>
                  )}
                  {customerDetail.customer.address && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="text-slate-400 shrink-0 mt-0.5" size={14} />
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Địa chỉ giao dịch</span>
                        <span className="font-medium text-[#515154] leading-relaxed">{customerDetail.customer.address}</span>
                      </div>
                    </div>
                  )}
                  {customerDetail.customer.leadSourceName && (
                    <div className="flex items-start gap-2.5">
                      <User className="text-slate-400 shrink-0 mt-0.5" size={14} />
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Nguồn thu hút</span>
                        <span>
                          {customerDetail.customer.leadSourceIcon || ""} {customerDetail.customer.leadSourceName}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Financial Stats */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-1">
                    <span className="text-slate-400 font-bold text-[10px] uppercase block">Tổng chi tiêu</span>
                    <p className="text-[15px] font-black text-[#0066cc] leading-none">
                      {formatPrice(customerDetail.customer.totalSpent)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-1">
                    <span className="text-slate-400 font-bold text-[10px] uppercase block">Tổng đơn mua</span>
                    <p className="text-[15px] font-black text-slate-800 leading-none">
                      {customerDetail.customer.orderCount}
                    </p>
                  </div>
                </div>

                {/* Back button when multiple matches exist */}
                {searchResults.length > 1 && (
                  <button
                    onClick={() => setSelectedCustomerId(null)}
                    className="w-full h-9 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[12px] font-bold rounded-full border border-slate-200/60 transition-all cursor-pointer active:scale-95 duration-200"
                  >
                    Quay lại danh sách kết quả
                  </button>
                )}
              </GlassCard>
            </div>

            {/* Right Column: Order & Machine purchase history */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Purchased Machines list */}
              <GlassCard className="p-5 space-y-4">
                <h4 className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                  <ShoppingBag size={14} className="text-[#0066cc]" />
                  Thiết bị đã mua ({customerDetail.purchasedItems.length})
                </h4>

                {customerDetail.purchasedItems.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-[13px]">Khách hàng chưa sở hữu thiết bị nào thành công.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#e0e0e0] text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider">
                          <th className="pb-3 pr-4">Tên máy & Cấu hình</th>
                          <th className="pb-3 px-3">Số Serial</th>
                          <th className="pb-3 px-3">Hóa đơn mua</th>
                          <th className="pb-3 px-3 text-right">Giá bán</th>
                          <th className="pb-3 px-3">Trạng thái kho</th>
                        </tr>
                      </thead>
                      <tbody className="text-[13px] text-slate-800 font-semibold">
                        {customerDetail.purchasedItems.map((item: any, idx: number) => {
                          const badge = statusMapping[item.status] || {
                            label: item.status,
                            bg: "bg-slate-50",
                            text: "text-slate-700",
                            border: "border-slate-200",
                          };
                          return (
                            <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="py-3.5 pr-4 align-top max-w-[220px]">
                                <p className="font-bold text-[#1d1d1f] leading-tight">{item.productName}</p>
                                <span className="text-[11px] text-[#7a7a7a] block mt-1 font-medium truncate max-w-[210px]">{formatSpecs(item.productSpecs)}</span>
                              </td>
                              <td className="py-3.5 px-3 align-top">
                                <button
                                  onClick={() => triggerSerialLookup(item.serialNumber)}
                                  className="text-[11px] font-bold text-[#0066cc] hover:scale-105 active:scale-95 duration-200 bg-[#0066cc]/5 border border-[#0066cc]/10 px-2.5 py-0.5 rounded-full cursor-pointer uppercase tracking-wider flex items-center gap-1 leading-none transition-all"
                                  title="Nhấn để xem dòng vòng đời máy"
                                >
                                  {item.serialNumber}
                                  <ExternalLink size={10} />
                                </button>
                              </td>
                              <td className="py-3.5 px-3 align-top">
                                <p className="text-slate-800">{item.orderNumber}</p>
                                <span className="text-[11px] text-[#7a7a7a] block mt-0.5 font-medium">{formatToDDMMYYYY(item.orderDate)}</span>
                              </td>
                              <td className="py-3.5 px-3 align-top text-right text-[#0066cc] font-extrabold">
                                {formatPrice(item.sellingPrice)}
                              </td>
                              <td className="py-3.5 px-3 align-top">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide leading-none ${badge.bg} ${badge.text} ${badge.border}`}>
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>

              {/* Order History */}
              <GlassCard className="p-5 space-y-4">
                <h4 className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                  <FileText size={14} className="text-[#0066cc]" />
                  Lịch sử toàn bộ Đơn hàng ({customerDetail.orders.length})
                </h4>

                {customerDetail.orders.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-[13px]">Không ghi nhận hóa đơn nào.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#e0e0e0] text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider">
                          <th className="pb-3 pr-4">Mã Đơn hàng</th>
                          <th className="pb-3 px-3">Ngày lên đơn</th>
                          <th className="pb-3 px-3">Kênh bán</th>
                          <th className="pb-3 px-3 text-right">Tổng thanh toán</th>
                          <th className="pb-3 px-3 text-center">Thanh toán</th>
                          <th className="pb-3 px-3 text-center">Trạng thái đơn</th>
                        </tr>
                      </thead>
                      <tbody className="text-[13px] text-slate-800 font-semibold">
                        {customerDetail.orders.map((ord: any) => {
                          const stBadge = orderStatusMapping[ord.status] || { label: ord.status, bg: "bg-slate-100 text-slate-700" };
                          return (
                            <tr key={ord.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="py-3 px-4 pl-0 align-middle font-bold text-slate-900">{ord.orderNumber}</td>
                              <td className="py-3 px-3 align-middle text-[12px]">{formatToDDMMYYYY(ord.createdAt)}</td>
                              <td className="py-3 px-3 align-middle text-[12px] text-slate-600 capitalize">{ord.saleChannel}</td>
                              <td className="py-3 px-3 align-middle text-right font-bold text-slate-900">{formatPrice(ord.totalAmount)}</td>
                              <td className="py-3 px-3 align-middle text-center">
                                {ord.paymentStatus === 'paid' ? (
                                  <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60 leading-none inline-block">Đã trả đủ</span>
                                ) : ord.paymentStatus === 'partial' ? (
                                  <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-200/60 leading-none inline-block">Trả 1 phần</span>
                                ) : (
                                  <span className="bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-rose-200/60 leading-none inline-block">Chưa trả</span>
                                )}
                              </td>
                              <td className="py-3 px-3 align-middle text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider leading-none inline-block ${stBadge.bg}`}>
                                  {stBadge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>

              {/* Return History */}
              {customerDetail.returns && customerDetail.returns.length > 0 && (
                <GlassCard className="p-5 space-y-4">
                  <h4 className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                    <RefreshCw size={14} className="text-rose-600" />
                    Lịch sử yêu cầu Đổi / Trả hàng ({customerDetail.returns.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#e0e0e0] text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider">
                          <th className="pb-3 pr-4">Mã Phiếu đổi trả</th>
                          <th className="pb-3 px-3">Loại</th>
                          <th className="pb-3 px-3">Sản phẩm đổi/trả</th>
                          <th className="pb-3 px-3">Serial cũ ➔ mới</th>
                          <th className="pb-3 px-3 text-right">Giá hoàn trả</th>
                        </tr>
                      </thead>
                      <tbody className="text-[13px] text-slate-800 font-semibold">
                        {customerDetail.returns.map((ret: any) => (
                          <tr key={ret.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="py-3 px-4 pl-0 align-middle">
                              <p className="font-bold text-slate-900">{ret.returnNumber}</p>
                              <span className="text-[11px] text-[#7a7a7a] block mt-0.5 font-medium">{formatToDDMMYYYY(ret.createdAt)}</span>
                            </td>
                            <td className="py-3 px-3 align-middle">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                ret.type === "return" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-teal-50 text-teal-700 border border-teal-200"
                              }`}>
                                {ret.type === "return" ? "Trả hàng" : "Đổi hàng"}
                              </span>
                            </td>
                            <td className="py-3 px-3 align-middle max-w-[200px] truncate">{ret.productName}</td>
                            <td className="py-3 px-3 align-middle text-[12px] whitespace-nowrap">
                              <span className="text-rose-600 line-through bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full uppercase text-[11px] font-semibold">{ret.oldSerialNumber}</span>
                              {ret.newSerialNumber && (
                                <>
                                  <span className="mx-1 text-[#7a7a7a]">➔</span>
                                  <button 
                                    onClick={() => triggerSerialLookup(ret.newSerialNumber)}
                                    className="text-emerald-700 font-bold hover:scale-105 active:scale-95 duration-200 transition-all bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full cursor-pointer uppercase text-[11px]"
                                  >
                                    {ret.newSerialNumber}
                                  </button>
                                </>
                              )}
                            </td>
                            <td className="py-3 px-3 align-middle text-right text-rose-600 font-bold">
                              {formatPrice(ret.refundAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              )}

            </div>
          </div>
        );
      }

      return (
        <GlassCard className="py-20 text-center text-slate-400 text-[14px]">
          Không có dữ liệu chi tiết khách hàng để hiển thị.
        </GlassCard>
      );
    }

    // No results Empty State
    return (
      <GlassCard className="py-28 text-center flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
          <Phone size={24} />
        </div>
        <h4 className="text-[14px] font-bold text-[#1d1d1f]">Không tìm thấy Khách hàng</h4>
        <p className="text-[12px] text-[#7a7a7a] mt-2 max-w-sm mx-auto leading-relaxed">
          Không tìm thấy khách hàng nào khớp với số điện thoại này trong cơ sở dữ liệu.
        </p>
      </GlassCard>
    );
  };

  const renderSerialTab = () => {
    if (serialLoading) {
      return (
        <GlassCard className="flex flex-col items-center justify-center py-32 text-[#7a7a7a]">
          <Loader2 className="animate-spin mb-3 text-[#0066cc]" size={26} />
          <p className="text-[14px] font-bold text-[#1d1d1f]">Đang kết nối liên phân hệ...</p>
          <p className="text-[12px] text-[#7a7a7a] mt-0.5">Truy quét lịch sử chứng từ PO, bán hàng, sửa chữa và đổi trả</p>
        </GlassCard>
      );
    }

    if (lifecycleData) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-scale-up">
          
          {/* Left Panel: Hardware configuration overview & stats */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Configuration Card */}
            <GlassCard className="p-5 space-y-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-[#0066cc]/5 blur-3xl rounded-full" />
              
              <div className="flex justify-between items-start z-10 relative">
                <span className="text-[10px] font-extrabold text-[#7a7a7a] uppercase tracking-widest bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {lifecycleData.item.condition === 'new' ? "Mới 100%" : "Đã qua sử dụng"}
                </span>
                
                {/* Dynamic status badge */}
                {(() => {
                  const badge = statusMapping[lifecycleData.item.status] || {
                    label: lifecycleData.item.status,
                    bg: "bg-slate-50",
                    text: "text-slate-700",
                    border: "border-slate-200",
                  };
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wide leading-none ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>

              <div className="space-y-1.5 z-10 relative">
                <h3 className="text-[16px] font-extrabold text-[#1d1d1f] tracking-tight leading-tight">
                  {lifecycleData.item.productName}
                </h3>
                <p className="text-[11px] font-bold text-slate-400">SKU: {lifecycleData.item.productSku}</p>
                <p className="text-[12px] text-[#7a7a7a] font-semibold font-sans">Thương hiệu: {lifecycleData.item.brandName} - {lifecycleData.item.categoryName}</p>
              </div>

              {/* Hardware specifications list */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="font-bold text-[#7a7a7a]">Serial thiết bị:</span>
                  <span className="font-extrabold text-[#1d1d1f] tracking-wider uppercase bg-[#f5f5f7] px-2.5 py-0.5 rounded-full border border-slate-200/50">
                    {lifecycleData.item.serialNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-[#7a7a7a]">Thời hạn bảo hành:</span>
                  <span className="font-bold text-[#1d1d1f] flex items-center gap-1">
                    <SFSymbolCalendar size={11} className="text-emerald-600" />
                    {lifecycleData.item.warrantyStart 
                      ? `${formatToDDMMYYYY(lifecycleData.item.warrantyStart)} - ${formatToDDMMYYYY(lifecycleData.item.warrantyEnd)}`
                      : "Chưa kích hoạt bán hàng"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-[#7a7a7a]">Nguyên giá bán lẻ:</span>
                  <span className="font-extrabold text-[#0066cc]">
                    {formatPrice(lifecycleData.item.sellingPrice || 0)}
                  </span>
                </div>

                {/* Owner Customer Cross-link field */}
                {(() => {
                  const saleMilestone = lifecycleData.milestones.find((m: any) => m.type === "sale");
                  if (saleMilestone && saleMilestone.meta) {
                    return (
                      <div className="flex justify-between items-center pt-1">
                        <span className="font-bold text-[#7a7a7a]">Khách hàng sở hữu:</span>
                        <button
                          onClick={() => triggerPhoneLookup(saleMilestone.meta.customerPhone || saleMilestone.meta.customerName)}
                          className="font-bold text-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px] cursor-pointer hover:scale-105 active:scale-95 duration-200 transition-all"
                          title="Bấm để tra cứu thông tin khách hàng này"
                        >
                          👤 {saleMilestone.meta.customerName}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}

                {lifecycleData.item.supplierName && (
                  <div className="flex justify-between">
                    <span className="font-bold text-[#7a7a7a]">Nhà cung cấp:</span>
                    <span className="font-bold text-[#1d1d1f]">
                      {lifecycleData.item.supplierName}
                    </span>
                  </div>
                )}
                {(lifecycleData.item.trackingNumber || lifecycleData.item.shippingMethod) && (
                  <div className="space-y-1.5 pt-1">
                    {lifecycleData.item.shippingMethod && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#7a7a7a]">Đơn vị vận chuyển:</span>
                        <span className="font-bold text-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc]/10 px-2.5 py-0.5 rounded-full text-[11px]">
                          🚚 {lifecycleData.item.shippingMethod}
                        </span>
                      </div>
                    )}
                    {lifecycleData.item.trackingNumber && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#7a7a7a]">Mã vận đơn:</span>
                        {lifecycleData.item.trackingUrl ? (
                          <a 
                            href={lifecycleData.item.trackingUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-bold text-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px] hover:scale-105 active:scale-95 duration-200 transition-all"
                          >
                            📦 {lifecycleData.item.trackingNumber} ↗
                          </a>
                        ) : (
                          <span className="font-bold text-[#1d1d1f] bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full text-[11px]">
                            📦 {lifecycleData.item.trackingNumber}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Specs overrides detailed notes */}
              {lifecycleData.item.productSpecs && (
                <div className="pt-3 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-[#7a7a7a] uppercase tracking-wider block font-sans">Cấu hình chi tiết</span>
                  <p className="text-[12px] text-[#515154] leading-relaxed bg-[#f5f5f7] p-2.5 rounded-xl border border-slate-200/60 font-semibold select-all font-sans">
                    {formatSpecs(lifecycleData.item.productSpecs)}
                  </p>
                </div>
              )}
            </GlassCard>

            {/* Quick summary metrics */}
            <GlassCard className="p-5 space-y-3">
              <h4 className="text-[12px] font-bold text-[#1d1d1f] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <SFSymbolActivity size={13} className="text-[#0066cc]" /> Tóm tắt giao dịch
              </h4>
              <div className="grid grid-cols-2 gap-2 text-center text-[12px] font-sans">
                <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-1">
                  <span className="text-[#7a7a7a] font-semibold text-[10px] uppercase">Thẻ kho phát sinh</span>
                  <p className="text-[18px] font-extrabold text-slate-800 leading-none">
                    {lifecycleData.milestones.length}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-1">
                  <span className="text-[#7a7a7a] font-semibold text-[10px] uppercase">Lần bảo hành</span>
                  <p className="text-[18px] font-extrabold text-teal-600 leading-none">
                    {lifecycleData.milestones.filter((m: any) => m.type === "warranty").length}
                  </p>
                </div>
              </div>
            </GlassCard>

          </div>

          {/* Right Panel: Chronological Timeline Milestones */}
          <GlassCard className="lg:col-span-8 p-6 space-y-6">
            <h4 className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5 font-sans">
              <SFSymbolFileSpreadsheet size={14} className="text-[#0066cc]" />
              Dòng thời gian Vòng đời Thiết bị (Milestones)
            </h4>

            {/* Chronological Vertical Timeline path */}
            <div className="relative border-l border-slate-200 ml-4.5 md:ml-6 pl-6 space-y-8 py-2">
              
              {lifecycleData.milestones.map((m: any, idx: number) => {
                const colors = milestoneColors[m.type] || milestoneColors.movement;

                return (
                  <div key={idx} className="relative group animate-fade-in font-sans">
                    
                    {/* Absolute timeline circular node indicator with matching color icons */}
                    <div className={`absolute -left-[37.5px] top-0 w-8.5 h-8.5 rounded-full flex items-center justify-center shrink-0 border shadow-sm transition-all duration-300 origin-center bg-white group-hover:scale-110 z-10 ${colors.border}`}>
                      {colors.icon}
                    </div>

                    {/* Milestone body card */}
                    <div className="bg-slate-50 hover:bg-slate-100/55 border border-slate-200/70 rounded-2xl p-4 transition-all duration-200 space-y-2 relative shadow-inner">
                      
                      {/* Ribbon Header with exact event date */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/50">
                        <h5 className="text-[13px] font-extrabold text-[#1d1d1f] leading-none">
                          {m.title}
                        </h5>
                        <div className="flex items-center gap-1 text-[#7a7a7a]">
                          <SFSymbolCalendar size={11} className="text-slate-400" />
                          <span className="text-[11px] font-bold tracking-tight">
                            {formatToDDMMYYYY(m.date)}
                          </span>
                        </div>
                      </div>

                      {/* Event description details text */}
                      <p className="text-[12.5px] text-[#515154] leading-relaxed font-semibold">
                        {m.description}
                      </p>

                      {/* Dynamic metadata badges tailored per event type */}
                      {m.meta && (
                        <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                          {m.type === "purchase" && (
                            <>
                              <span className="bg-amber-100/50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                Giá gốc nhập: {formatPrice(m.meta.costPrice)}
                              </span>
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                Vị trí lưu: {m.meta.location}
                              </span>
                              {m.meta.shippingMethod && (
                                <span className="bg-indigo-100/50 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-sans">
                                  🚚 Đơn vị VC: {m.meta.shippingMethod}
                                </span>
                              )}
                              {m.meta.trackingNumber && (
                                <span className="bg-blue-100/50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  {m.meta.trackingUrl ? (
                                    <a href={m.meta.trackingUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                      📦 Vận đơn: {m.meta.trackingNumber} ↗
                                    </a>
                                  ) : (
                                    <span>📦 Vận đơn: {m.meta.trackingNumber}</span>
                                  )}
                                </span>
                              )}
                            </>
                          )}
                          {m.type === "sale" && (
                            <>
                              <span className="bg-emerald-100/50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                Doanh thu: {formatPrice(m.meta.sellingPrice)}
                              </span>
                              <button
                                onClick={() => triggerPhoneLookup(m.meta.customerPhone || m.meta.customerName)}
                                className="bg-blue-100/50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full hover:scale-105 active:scale-95 duration-200 transition-all cursor-pointer"
                                title="Nhấn để xem lịch sử mua hàng của khách này"
                              >
                                👤 Khách: {m.meta.customerName}
                              </button>
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                Đơn: {m.meta.orderNumber}
                              </span>
                            </>
                          )}
                          {m.type === "return" && (
                            <>
                              <span className="bg-rose-100/50 text-rose-800 border border-rose-200 px-2.5 py-0.5 rounded-full">
                                Khấu trừ hoàn trả: {formatPrice(m.meta.refundPrice)}
                              </span>
                              {m.meta.isDefective && (
                                <span className="bg-red-100/50 text-red-800 border border-red-200 px-2.5 py-0.5 rounded-full">
                                  Xác nhận lỗi phần cứng
                                </span>
                              )}
                            </>
                          )}
                          {m.type === "warranty" && (
                            <>
                              <span className="bg-teal-100/50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded-full">
                                Phí sửa bảo hành: {formatPrice(m.meta.repairCost)}
                              </span>
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full">
                                Phiếu bảo hành: {m.meta.claimNumber}
                              </span>
                              {m.meta.actualReturnDate && (
                                <span className="bg-emerald-100/50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                  Đã trả khách: {formatToDDMMYYYY(m.meta.actualReturnDate)}
                                </span>
                              )}
                            </>
                          )}
                          {m.type === "movement" && (
                            <>
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-mono text-[10px]">
                                Trạng thái: {m.meta.fromStatus || "N/A"} ➔ {m.meta.toStatus}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}

              {/* Initializing activity start node */}
              <div className="relative">
                <div className="absolute -left-[30px] top-1.5 w-5 h-5 rounded-full bg-slate-200 border-4 border-white shrink-0 z-10" />
                <div className="pl-4.5 pt-1 text-[11px] font-extrabold text-[#7a7a7a] uppercase tracking-wider font-sans">
                  Bắt đầu hoạt động kinh doanh vòng đời máy
                </div>
              </div>

            </div>
          </GlassCard>

        </div>
      );
    }

    // No results Empty State
    return (
      <GlassCard className="py-28 text-center flex flex-col items-center justify-center font-sans">
        <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
          <SFSymbolQRCode size={26} />
        </div>
        <h4 className="text-[14px] font-bold text-[#1d1d1f]">Không tìm thấy thiết bị</h4>
        <p className="text-[12px] text-[#7a7a7a] mt-2 max-w-sm mx-auto leading-relaxed">
          Không tìm thấy thiết bị nào khớp với số Serial này trong cơ sở dữ liệu.
        </p>
      </GlassCard>
    );
  };

  const renderInitialState = () => {
    return (
      <GlassCard className="py-28 text-center flex flex-col items-center justify-center font-sans">
        <div className="w-14 h-14 rounded-full bg-[#0066cc]/5 border border-[#0066cc]/10 flex items-center justify-center text-[#0066cc] mb-4">
          <SFSymbolMagnifyingGlass size={26} />
        </div>
        <h4 className="text-[14px] font-bold text-[#1d1d1f]">Sẵn sàng Tra cứu thông tin</h4>
        <p className="text-[12px] text-[#7a7a7a] mt-2 max-w-sm mx-auto leading-relaxed">
          Nhập **số điện thoại khách hàng** hoặc **mã Serial sản phẩm** để truy xuất hồ sơ mua bán hoặc sơ đồ vòng đời thiết bị.
        </p>
      </GlassCard>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* 1. Header with inline Search Console */}
      <div className="pb-6 border-b border-[#e0e0e0] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[40px] font-semibold tracking-tight leading-[1.10] bg-clip-text text-transparent select-none animate-fade-in" style={{ backgroundImage: "linear-gradient(90deg, #2997ff, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Tra cứu thông tin
          </h1>
        
        </div>

        {/* Search Console */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="w-full md:max-w-md font-sans">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SFSymbolMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Nhập số điện thoại hoặc mã serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-slate-200 text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:bg-white focus:ring-2 focus:ring-[#0066cc]/10 transition-all font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={phoneLoading || serialLoading}
              className="h-[40px] px-6 bg-[#0066cc] hover:bg-[#0071e3] text-white rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-sm active:scale-95 duration-200"
            >
              {phoneLoading || serialLoading ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <SFSymbolMagnifyingGlass size={14} />
              )}
              <span>Tìm kiếm</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Results Container */}
      <div>
        {searchType === "customer" ? renderCustomerTab() : searchType === "serial" ? renderSerialTab() : renderInitialState()}
      </div>

    </div>
  );
}
