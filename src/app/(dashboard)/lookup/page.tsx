"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, Phone, User, Mail, MapPin, ShoppingBag, CreditCard, RefreshCw, FileText, ExternalLink, Cpu, History } from "lucide-react";
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
import { searchCustomersByPhone, getCustomerDetail, getCustomersList } from "@/app/actions/customers";
import { getInventoryItemLifecycle, getInventoryItems } from "@/app/actions/inventory";
import Link from "next/link";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

// Status mappings for machines and orders (Apple style colors - text-only)
const statusMapping: Record<string, { label: string; color: string }> = {
  incoming: { label: "Đang về", color: "text-[#0066cc]" },
  in_stock: { label: "Sẵn hàng", color: "text-emerald-600" },
  sold: { label: "Đã bán", color: "text-slate-500" },
  warranty_repair: { label: "Bảo hành", color: "text-amber-600" },
  returned: { label: "Đã trả NCC", color: "text-orange-600" },
  defective: { label: "Hàng lỗi", color: "text-red-600" },
  deleted: { label: "Đã ẩn", color: "text-slate-400" },
};

const orderStatusMapping: Record<string, { label: string; color: string }> = {
  draft: { label: "Nháp", color: "text-slate-500" },
  confirmed: { label: "Đã xác nhận", color: "text-[#0066cc]" },
  processing: { label: "Đang xử lý", color: "text-amber-600" },
  completed: { label: "Hoàn thành", color: "text-emerald-600" },
  cancelled: { label: "Đã hủy", color: "text-red-600" },
  refunded: { label: "Đã hoàn tiền", color: "text-purple-600" },
};

const milestoneColors: Record<string, { icon: React.ReactNode }> = {
  purchase: { icon: <SFSymbolLandmark size={14} className="text-slate-600" /> },
  sale: { icon: <SFSymbolShoppingBag size={14} className="text-slate-600" /> },
  warranty: { icon: <SFSymbolWrench size={14} className="text-slate-600" /> },
  return: { icon: <SFSymbolArrowClockwise size={14} className="text-slate-600" /> },
  movement: { icon: <SFSymbolActivity size={14} className="text-slate-500" /> },
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

const formatDateTime = (dateString: string | Date | null) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "N/A";
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) {
    return `${day}/${month}/${year}`;
  }
  return `${hours}:${minutes} - ${day}/${month}/${year}`;
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

function LookupPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Smart Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"customer" | "serial" | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Phone Lookup States
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerIdState] = useState<string | null>(null);
  const setSelectedCustomerId = (id: string | null) => {
    setSelectedCustomerIdState(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("customerId", id);
    } else {
      params.delete("customerId");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Serial Lookup States
  const [serialLoading, setSerialLoading] = useState(false);
  const [lifecycleData, setLifecycleData] = useState<any>(null);

  // Search suggestions & history states
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [recentSerials, setRecentSerials] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<{ query: string; type: "customer" | "serial"; label: string }[]>([]);

  // Load search history from localStorage on mount
  useEffect(() => {
    const history = localStorage.getItem("techshop_lookup_history");
    if (history) {
      try {
        setRecentSearches(JSON.parse(history));
      } catch (e) {
        console.error("Error parsing search history:", e);
      }
    }
  }, []);

  // Save query to search history
  const saveToHistory = (query: string, type: "customer" | "serial", label: string) => {
    const current = localStorage.getItem("techshop_lookup_history");
    let list = [];
    if (current) {
      try {
        list = JSON.parse(current);
      } catch (e) {}
    }
    // Remove if exists
    list = list.filter((item: any) => item.query !== query);
    // Add to front
    list.unshift({ query, type, label });
    // Limit to 5
    list = list.slice(0, 5);
    localStorage.setItem("techshop_lookup_history", JSON.stringify(list));
    setRecentSearches(list);
  };

  // Load suggestions on mount
  useEffect(() => {
    async function loadSuggestions() {
      try {
        setSuggestionsLoading(true);
        const [custRes, invRes] = await Promise.all([
          getCustomersList(),
          getInventoryItems()
        ]);
        if (Array.isArray(custRes)) {
          const filtered = custRes
            .filter((c: any) => c.phone && c.fullName !== "Khách vãng lai")
            .slice(0, 4);
          setRecentCustomers(filtered);
        }
        if (Array.isArray(invRes)) {
          const filtered = invRes
            .filter((i: any) => i.serialNumber)
            .slice(0, 4);
          setRecentSerials(filtered);
        }
      } catch (error) {
        console.error("Lỗi tải gợi ý tra cứu:", error);
      } finally {
        setSuggestionsLoading(false);
      }
    }
    loadSuggestions();
  }, []);

  // Update URL parameters
  const updateURL = (value: string, forceType?: "customer" | "serial") => {
    const params = new URLSearchParams(searchParams.toString());
    if (forceType === "serial") {
      params.set("serial", value);
      params.delete("q");
      params.delete("phone");
    } else if (forceType === "customer") {
      params.set("phone", value);
      params.delete("q");
      params.delete("serial");
    } else {
      params.set("q", value);
      params.delete("phone");
      params.delete("serial");
    }
    params.delete("tab");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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
        saveToHistory(target, "customer", res.customers[0].fullName);
        
        const urlParams = new URLSearchParams(window.location.search);
        const customerIdParam = urlParams.get("customerId");
        const hasMatchingCustomer = customerIdParam && res.customers.some((c: any) => c.id === customerIdParam);
        
        if (hasMatchingCustomer) {
          setSelectedCustomerId(customerIdParam);
          fetchCustomerDetail(customerIdParam);
        } else if (res.customers.length === 1) {
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
        const itemLabel = res.item ? `${res.item.brandName || ""} ${res.item.productName || ""}`.trim() : target;
        saveToHistory(target, "serial", itemLabel);
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
        <GlassCard className="flex flex-col items-center justify-center py-28 text-[#86868b] border border-[#e5e5e7]">
          <Loader2 className="animate-spin mb-3.5 text-[#0066cc]" size={26} />
          <p className="text-[15px] font-semibold text-[#1d1d1f]">Đang tra cứu dữ liệu khách hàng...</p>
        </GlassCard>
      );
    }

    if (searchResults.length > 1 && !selectedCustomerId) {
      return (
        <div className="space-y-5">
          <h3 className="text-[13px] font-bold text-[#86868b] uppercase tracking-wider pl-1">Kết quả tìm kiếm trùng khớp ({searchResults.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {searchResults.map((cust) => (
              <GlassCard 
                key={cust.id}
                onClick={() => {
                  setSelectedCustomerId(cust.id);
                  fetchCustomerDetail(cust.id);
                }}
                className="p-6 hover:border-[#0066cc] hover:shadow-md cursor-pointer transition-all duration-200 group bg-white border border-[#e5e5e7] rounded-2xl"
              >
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-11 h-11 rounded-full bg-[#f5f5f7] text-[#1d1d1f] flex items-center justify-center font-bold text-[16px] border border-[#e5e5e7]">
                    {cust.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold text-[#1d1d1f] group-hover:text-[#0066cc] transition-colors">{cust.fullName}</h4>
                    <p className="text-[13px] text-[#86868b] font-medium mt-0.5">{cust.phone}</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-[13px] text-[#515154] border-t border-slate-100 pt-3 mt-3 font-medium">
                  {cust.email && <p className="truncate">📧 {cust.email}</p>}
                  {cust.address && <p className="truncate">📍 {cust.address}</p>}
                  <div className="flex justify-between font-bold text-[#1d1d1f] pt-1.5 mt-1 border-t border-slate-50">
                    <span className="text-[12.5px]">Đơn hàng: <span className="text-[#0066cc]">{cust.orderCount}</span></span>
                    <span className="text-[12.5px]">Đã tiêu: <span>{formatPrice(cust.totalSpent)}</span></span>
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
          <GlassCard className="flex flex-col items-center justify-center py-28 text-[#86868b] border border-[#e5e5e7]">
            <Loader2 className="animate-spin mb-3.5 text-[#0066cc]" size={26} />
            <p className="text-[15px] font-semibold text-[#1d1d1f]">Đang tải hồ sơ khách hàng...</p>
          </GlassCard>
        );
      }

      if (customerDetail) {
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Customer Profile */}
            <div className="lg:col-span-4 space-y-6">
              <GlassCard className="p-6 space-y-6 relative overflow-hidden bg-white border border-[#e5e5e7] rounded-2xl">
                
                {/* Top Avatar Box */}
                <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-slate-100 relative">
                  <div className="w-16 h-16 rounded-full bg-[#f5f5f7] text-[#1d1d1f] flex items-center justify-center text-[22px] font-bold border border-[#e5e5e7] shadow-sm">
                    {customerDetail.customer.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-[18px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
                      {customerDetail.customer.fullName}
                    </h3>
                    <span className="text-[12px] font-semibold text-[#86868b] block mt-1.5">
                      {customerDetail.customer.customerType === "business" ? "Doanh nghiệp" : "Cá nhân"}
                    </span>
                  </div>
                </div>

                {/* Profile Specs */}
                <div className="space-y-4 text-[13.5px] text-[#1d1d1f]">
                  <div className="flex items-start gap-3">
                    <Phone className="text-[#86868b] shrink-0 mt-0.5" size={14.5} />
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider block">Số điện thoại</span>
                      <span className="font-semibold">{customerDetail.customer.phone}</span>
                    </div>
                  </div>
                  {customerDetail.customer.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="text-[#86868b] shrink-0 mt-0.5" size={14.5} />
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider block">Email</span>
                        <span className="font-semibold">{customerDetail.customer.email}</span>
                      </div>
                    </div>
                  )}
                  {customerDetail.customer.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="text-[#86868b] shrink-0 mt-0.5" size={14.5} />
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider block">Địa chỉ giao dịch</span>
                        <span className="font-medium text-[#515154] leading-relaxed">{customerDetail.customer.address}</span>
                      </div>
                    </div>
                  )}
                  {customerDetail.customer.leadSourceName && (
                    <div className="flex items-start gap-3">
                      <User className="text-[#86868b] shrink-0 mt-0.5" size={14.5} />
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider block">Nguồn thu hút</span>
                        <span className="font-semibold">
                          {customerDetail.customer.leadSourceIcon || ""} {customerDetail.customer.leadSourceName}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Financial Stats */}
                <div className="pt-5 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-[#f5f5f7] border border-slate-200/30 rounded-xl space-y-1">
                    <span className="text-[#86868b] font-bold text-[10px] uppercase block">Tổng chi tiêu</span>
                    <p className="text-[15px] font-bold text-[#0066cc] leading-none">
                      {formatPrice(customerDetail.customer.totalSpent)}
                    </p>
                  </div>
                  <div className="p-3 bg-[#f5f5f7] border border-slate-200/30 rounded-xl space-y-1">
                    <span className="text-[#86868b] font-bold text-[10px] uppercase block">Tổng đơn mua</span>
                    <p className="text-[15px] font-bold text-[#1d1d1f] leading-none">
                      {customerDetail.customer.orderCount}
                    </p>
                  </div>
                </div>

                {/* Back button when multiple matches exist */}
                {searchResults.length > 1 && (
                  <button
                    onClick={() => setSelectedCustomerId(null)}
                    className="w-full h-[36px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] text-[13px] font-semibold rounded-full border border-slate-200/50 transition-all cursor-pointer active:scale-95 duration-200"
                  >
                    Quay lại danh sách kết quả
                  </button>
                )}
              </GlassCard>
            </div>

            {/* Right Column: Order & Machine purchase history */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Purchased Machines list */}
              <GlassCard className="p-6 space-y-4 bg-white border border-[#e5e5e7] rounded-2xl">
                <h4 className="text-[14px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2.5 border-b border-slate-100 flex items-center gap-2">
                  <ShoppingBag size={15} className="text-[#0066cc]" />
                  Thiết bị đã mua ({customerDetail.purchasedItems.length})
                </h4>

                {customerDetail.purchasedItems.length === 0 ? (
                  <div className="text-center py-10 text-[#86868b] text-[13.5px]">Khách hàng chưa sở hữu thiết bị nào thành công.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[550px]">
                      <thead>
                        <tr className="border-b border-[#e5e5e7] text-[12px] font-bold text-[#86868b] uppercase tracking-wider">
                          <th className="pb-3.5 pr-2 text-center w-[45px]">STT</th>
                          <th className="pb-3.5 pr-4">Tên máy & Cấu hình</th>
                          <th className="pb-3.5 px-3">Số Serial</th>
                          <th className="pb-3.5 px-3">Hóa đơn mua</th>
                          <th className="pb-3.5 px-3 text-right">Giá bán</th>
                          <th className="pb-3.5 px-3 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="text-[13.5px] text-[#1d1d1f] font-medium">
                        {customerDetail.purchasedItems.map((item: any, idx: number) => {
                          let label = statusMapping[item.status]?.label || item.status;
                          let color = statusMapping[item.status]?.color || "text-[#1d1d1f]";
                          if (item.status === 'warranty_repair') {
                            if (item.location === 'internal_repair') {
                              label = "Đang sửa";
                              color = "text-orange-600";
                            } else {
                              label = "Đang BH";
                              color = "text-amber-600";
                            }
                          }
                          const badge = { label, color };
                          return (
                            <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-[#f5f5f7]/30 transition-colors">
                              <td className="py-3.5 pr-2 align-top text-center text-[13px] font-semibold text-[#86868b] w-[45px]">{idx + 1}</td>
                              <td className="py-3.5 pr-4 align-top max-w-[220px]">
                                <p className="font-semibold text-[#1d1d1f] leading-tight">{item.productName}</p>
                                <span className="text-[11.5px] text-[#86868b] block mt-1 font-medium leading-relaxed">{formatSpecs(item.productSpecs)}</span>
                              </td>
                              <td className="py-3.5 px-3 align-top">
                                <button
                                  onClick={() => triggerSerialLookup(item.serialNumber)}
                                  className="text-[13px] font-semibold text-[#0066cc] hover:underline flex items-center gap-1.5 leading-none transition-all cursor-pointer uppercase"
                                  title="Nhấn để xem dòng vòng đời máy"
                                >
                                  {item.serialNumber}
                                  <ExternalLink size={11} />
                                </button>
                              </td>
                              <td className="py-3.5 px-3 align-top">
                                <p className="font-semibold text-[#1d1d1f]">{item.orderNumber}</p>
                                <span className="text-[11.5px] text-[#86868b] block mt-0.5">{formatToDDMMYYYY(item.orderDate)}</span>
                              </td>
                              <td className="py-3.5 px-3 align-top text-right text-[#0066cc] font-bold">
                                {formatPrice(item.sellingPrice)}
                              </td>
                              <td className="py-3.5 px-3 align-top text-center">
                                <span className={`text-[13px] font-semibold ${badge.color}`}>
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
              <GlassCard className="p-6 space-y-4 bg-white border border-[#e5e5e7] rounded-2xl">
                <h4 className="text-[14px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2.5 border-b border-slate-100 flex items-center gap-2">
                  <FileText size={15} className="text-[#0066cc]" />
                  Lịch sử toàn bộ Đơn hàng ({customerDetail.orders.length})
                </h4>

                {customerDetail.orders.length === 0 ? (
                  <div className="text-center py-8 text-[#86868b] text-[13.5px]">Không ghi nhận hóa đơn nào.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[550px]">
                      <thead>
                        <tr className="border-b border-[#e5e5e7] text-[12px] font-bold text-[#86868b] uppercase tracking-wider">
                          <th className="pb-3.5 pr-2 text-center w-[45px]">STT</th>
                          <th className="pb-3.5 pr-4">Mã Đơn hàng</th>
                          <th className="pb-3.5 px-3">Ngày lên đơn</th>
                          <th className="pb-3.5 px-3">Kênh bán</th>
                          <th className="pb-3.5 px-3 text-right">Tổng thanh toán</th>
                          <th className="pb-3.5 px-3 text-center">Thanh toán</th>
                          <th className="pb-3.5 px-3 text-center">Trạng thái đơn</th>
                        </tr>
                      </thead>
                      <tbody className="text-[13.5px] text-[#1d1d1f] font-medium">
                        {customerDetail.orders.map((ord: any, ordIdx: number) => {
                          const stBadge = orderStatusMapping[ord.status] || { label: ord.status, color: "text-slate-500" };
                          return (
                            <tr key={ord.id} className="border-b border-slate-100 last:border-0 hover:bg-[#f5f5f7]/30 transition-colors">
                              <td className="py-3.5 pr-2 align-middle text-center text-[13px] font-semibold text-[#86868b] w-[45px]">{ordIdx + 1}</td>
                              <td className="py-3.5 pr-4 align-middle font-bold text-[#1d1d1f]">{ord.orderNumber}</td>
                              <td className="py-3.5 px-3 align-middle text-[#86868b]">{formatToDDMMYYYY(ord.createdAt)}</td>
                              <td className="py-3.5 px-3 align-middle text-slate-600 capitalize">{ord.saleChannel}</td>
                              <td className="py-3.5 px-3 align-middle text-right font-bold text-[#1d1d1f]">{formatPrice(ord.totalAmount)}</td>
                              <td className="py-3.5 px-3 align-middle text-center">
                                {ord.paymentStatus === 'paid' ? (
                                  <span className="text-emerald-600 text-[13px] font-semibold">Đã trả đủ</span>
                                ) : ord.paymentStatus === 'partial' ? (
                                  <span className="text-amber-600 text-[13px] font-semibold">Trả 1 phần</span>
                                ) : (
                                  <span className="text-red-600 text-[13px] font-semibold">Chưa trả</span>
                                )}
                              </td>
                              <td className="py-3.5 px-3 align-middle text-center">
                                <span className={`text-[13px] font-semibold ${stBadge.color}`}>
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
                <GlassCard className="p-6 space-y-4 bg-white border border-[#e5e5e7] rounded-2xl">
                  <h4 className="text-[14px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2.5 border-b border-slate-100 flex items-center gap-2">
                    <RefreshCw size={15} className="text-red-600" />
                    Lịch sử yêu cầu Đổi / Trả hàng ({customerDetail.returns.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[550px]">
                      <thead>
                        <tr className="border-b border-[#e5e5e7] text-[12px] font-bold text-[#86868b] uppercase tracking-wider">
                          <th className="pb-3.5 pr-2 text-center w-[45px]">STT</th>
                          <th className="pb-3.5 pr-4">Mã Phiếu đổi trả</th>
                          <th className="pb-3.5 px-3">Loại</th>
                          <th className="pb-3.5 px-3">Sản phẩm đổi/trả</th>
                          <th className="pb-3.5 px-3">Serial cũ ➔ mới</th>
                          <th className="pb-3.5 px-3 text-right">Giá hoàn trả</th>
                        </tr>
                      </thead>
                      <tbody className="text-[13.5px] text-[#1d1d1f] font-medium">
                        {customerDetail.returns.map((ret: any, retIdx: number) => (
                          <tr key={ret.id} className="border-b border-slate-100 last:border-0 hover:bg-[#f5f5f7]/30 transition-colors">
                            <td className="py-3.5 pr-2 align-middle text-center text-[13px] font-semibold text-[#86868b] w-[45px]">{retIdx + 1}</td>
                            <td className="py-3.5 pr-4 align-middle">
                              <p className="font-bold text-[#1d1d1f]">{ret.returnNumber}</p>
                              <span className="text-[11.5px] text-[#86868b] block mt-0.5 font-medium">{formatToDDMMYYYY(ret.createdAt)}</span>
                            </td>
                            <td className="py-3.5 px-3 align-middle">
                              <span className={`text-[13px] font-semibold ${
                                ret.type === "return" ? "text-red-600" : "text-teal-600"
                              }`}>
                                {ret.type === "return" ? "Trả hàng" : "Đổi hàng"}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 align-middle max-w-[200px] truncate">{ret.productName}</td>
                            <td className="py-3.5 px-3 align-middle text-[13px] whitespace-nowrap">
                              <span className="text-[13px] font-semibold text-red-500 line-through">{ret.oldSerialNumber}</span>
                              {ret.newSerialNumber && (
                                <>
                                  <span className="mx-1.5 text-[#86868b]">➔</span>
                                  <button 
                                    onClick={() => triggerSerialLookup(ret.newSerialNumber)}
                                    className="text-[13px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                                  >
                                    {ret.newSerialNumber}
                                  </button>
                                </>
                              )}
                            </td>
                            <td className="py-3.5 px-3 align-middle text-right text-red-600 font-bold">
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
        <GlassCard className="py-20 text-center text-[#86868b] text-[14px] border border-[#e5e5e7]">
          Không có dữ liệu chi tiết khách hàng để hiển thị.
        </GlassCard>
      );
    }

    // No results Empty State
    return (
      <GlassCard className="py-28 text-center flex flex-col items-center justify-center bg-white border border-[#e5e5e7] rounded-2xl shadow-sm">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-4">
          <Phone size={24} />
        </div>
        <h4 className="text-[15px] font-bold text-[#1d1d1f]">Không tìm thấy Khách hàng</h4>
        <p className="text-[13px] text-[#86868b] mt-2 max-w-sm mx-auto leading-relaxed font-medium">
          Không tìm thấy khách hàng nào khớp với số điện thoại này trong cơ sở dữ liệu.
        </p>
      </GlassCard>
    );
  };

  const renderSerialTab = () => {
    if (serialLoading) {
      return (
        <GlassCard className="flex flex-col items-center justify-center py-28 text-[#86868b] border border-[#e5e5e7]">
          <Loader2 className="animate-spin mb-3.5 text-[#0066cc]" size={26} />
          <p className="text-[15px] font-semibold text-[#1d1d1f]">Đang kết nối liên phân hệ...</p>
          <p className="text-[13px] text-[#86868b] mt-1 font-medium">Truy quét lịch sử chứng từ PO, bán hàng, sửa chữa và đổi trả</p>
        </GlassCard>
      );
    }

    if (lifecycleData) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Panel: Hardware configuration overview & stats */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Configuration Card */}
            <GlassCard className="p-6 space-y-5 relative overflow-hidden bg-white border border-[#e5e5e7] rounded-2xl shadow-sm">
              <div className="absolute right-0 top-0 w-24 h-24 bg-[#0066cc]/5 blur-3xl rounded-full" />
              
              <div className="flex justify-between items-center relative z-10">
                <span className="text-[13px] font-semibold text-[#515154]">
                  {lifecycleData.item.condition === 'new' ? "Mới 100%" : "Đã qua sử dụng"}
                </span>
                
                {/* Dynamic status badge */}
                {(() => {
                  let label = statusMapping[lifecycleData.item.status]?.label || lifecycleData.item.status;
                  let color = statusMapping[lifecycleData.item.status]?.color || "text-slate-700";
                  if (lifecycleData.item.status === 'warranty_repair') {
                    if (lifecycleData.item.location === 'internal_repair') {
                      label = "Đang sửa";
                      color = "text-orange-600";
                    } else {
                      label = "Đang BH";
                      color = "text-amber-600";
                    }
                  }
                  return (
                    <span className={`text-[13px] font-semibold ${color}`}>
                      {label}
                    </span>
                  );
                })()}
              </div>

              <div className="space-y-1.5 relative z-10">
                <h3 className="text-[18px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
                  {lifecycleData.item.productName}
                </h3>
                <p className="text-[12px] font-bold text-[#86868b]">SKU: {lifecycleData.item.productSku}</p>
                <p className="text-[13px] text-[#515154] font-semibold">Thương hiệu: {lifecycleData.item.brandName} - {lifecycleData.item.categoryName}</p>
              </div>

              {/* Hardware specifications list */}
              <div className="pt-4 border-t border-slate-100 space-y-3.5 text-[13.5px]">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#86868b]">Serial thiết bị:</span>
                  <span className="text-[13.5px] font-semibold text-[#1d1d1f]">
                    {lifecycleData.item.serialNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#86868b]">Thời hạn bảo hành:</span>
                  <span className="font-bold text-[#1d1d1f] text-[13px]">
                    {lifecycleData.item.warrantyStart 
                      ? `${formatToDDMMYYYY(lifecycleData.item.warrantyStart)} - ${formatToDDMMYYYY(lifecycleData.item.warrantyEnd)}`
                      : "Chưa kích hoạt bán hàng"
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#86868b]">Nguyên giá bán lẻ:</span>
                  <span className="font-bold text-[#0066cc]">
                    {formatPrice(lifecycleData.item.sellingPrice || 0)}
                  </span>
                </div>

                {/* Owner Customer Cross-link field */}
                {(() => {
                  const saleMilestone = lifecycleData.milestones.find((m: any) => m.type === "sale");
                  if (saleMilestone && saleMilestone.meta) {
                    return (
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-[#86868b]">Khách hàng sở hữu:</span>
                        <button
                          onClick={() => triggerPhoneLookup(saleMilestone.meta.customerPhone || saleMilestone.meta.customerName)}
                          className="font-semibold text-[#0066cc] hover:underline flex items-center gap-1 text-[13px] cursor-pointer transition-all"
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
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[#86868b]">Nhà cung cấp:</span>
                    <span className="font-bold text-[#1d1d1f]">
                      {lifecycleData.item.supplierName}
                    </span>
                  </div>
                )}
                {(lifecycleData.item.trackingNumber || lifecycleData.item.shippingMethod) && (
                  <div className="space-y-2 pt-1 border-t border-slate-50 mt-1">
                    {lifecycleData.item.shippingMethod && (
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-[#86868b]">Đơn vị vận chuyển:</span>
                        <span className="font-semibold text-[#1d1d1f]">
                          🚚 {lifecycleData.item.shippingMethod}
                        </span>
                      </div>
                    )}
                    {lifecycleData.item.trackingNumber && (
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-[#86868b]">Mã vận đơn:</span>
                        {lifecycleData.item.trackingUrl ? (
                          <a 
                            href={lifecycleData.item.trackingUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-semibold text-[#0066cc] hover:underline flex items-center gap-1"
                          >
                            📦 {lifecycleData.item.trackingNumber} ↗
                          </a>
                        ) : (
                          <span className="font-semibold text-[#1d1d1f]">
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
                <div className="pt-4 border-t border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider block">Cấu hình chi tiết</span>
                  <p className="text-[13px] text-[#515154] leading-relaxed font-medium select-all">
                    {formatSpecs(lifecycleData.item.productSpecs)}
                  </p>
                </div>
              )}
            </GlassCard>

            {/* Quick summary metrics */}
            <GlassCard className="p-6 space-y-4 bg-white border border-[#e5e5e7] rounded-2xl shadow-sm">
              <h4 className="text-[13px] font-bold text-[#1d1d1f] uppercase tracking-wider flex items-center gap-1.5">
                <SFSymbolActivity size={14} className="text-[#0066cc]" /> Tóm tắt giao dịch
              </h4>
              <div className="grid grid-cols-2 gap-3 text-center text-[13px]">
                <div className="p-3 bg-[#f5f5f7] border border-slate-200/30 rounded-xl space-y-1">
                  <span className="text-[#86868b] font-bold text-[10px] uppercase block">Thẻ kho phát sinh</span>
                  <p className="text-[18px] font-bold text-slate-800 leading-none">
                    {lifecycleData.milestones.length}
                  </p>
                </div>
                <div className="p-3 bg-[#f5f5f7] border border-slate-200/30 rounded-xl space-y-1">
                  <span className="text-[#86868b] font-bold text-[10px] uppercase block">Lần bảo hành</span>
                  <p className="text-[18px] font-bold text-teal-600 leading-none">
                    {lifecycleData.milestones.filter((m: any) => m.type === "warranty").length}
                  </p>
                </div>
              </div>
            </GlassCard>

          </div>

          {/* Right Panel: Chronological Timeline Milestones */}
          <GlassCard className="lg:col-span-8 p-6 space-y-6 bg-white border border-[#e5e5e7] rounded-2xl shadow-sm">
            <h4 className="text-[14px] font-bold text-[#1d1d1f] uppercase tracking-wider pb-2.5 border-b border-slate-100 flex items-center gap-1.5">
              <SFSymbolFileSpreadsheet size={15} className="text-[#0066cc]" />
              Vòng đời thiết bị
            </h4>

            {/* Chronological Vertical Timeline path */}
            <div className="relative border-l border-[#e5e5e7] ml-4.5 md:ml-6 pl-6 space-y-8 py-2">
              
              {lifecycleData.milestones.map((m: any, idx: number) => {
                const colors = milestoneColors[m.type] || milestoneColors.movement;

                return (
                  <div key={idx} className="relative group">
                    
                    {/* Absolute timeline circular node indicator with matching color icons */}
                    <div className="absolute -left-[38px] top-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[#e5e5e7] bg-[#f5f5f7] shadow-sm transition-all duration-300 origin-center bg-white group-hover:scale-110 z-10">
                      {colors.icon}
                    </div>

                    {/* Milestone body - Apple text-only style */}
                    <div className="transition-all duration-200 space-y-1.5 relative pl-1">
                      
                      {/* Ribbon Header with exact event date */}
                      <div className="flex items-center justify-between">
                        <h5 className="text-[15px] font-bold text-[#1d1d1f] leading-none">
                          {m.title}
                        </h5>
                        <div className="flex items-center gap-1 text-[#86868b]">
                          <SFSymbolCalendar size={12} className="text-slate-400" />
                          <span className="text-[12px] font-semibold tracking-tight">
                            {formatDateTime(m.date)}
                          </span>
                        </div>
                      </div>

                      {/* Event description details text */}
                      <p className="text-[13.5px] text-[#515154] leading-relaxed font-medium">
                        {m.description}
                      </p>

                      {/* Dynamic metadata badges tailored per event type */}
                      {m.meta && (
                        <div className="pt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-medium text-[#86868b]">
                          {m.type === "purchase" && (
                            <>
                              <span className="font-semibold text-slate-700">
                                Giá nhập: {formatPrice(m.meta.costPrice)}
                              </span>
                              {m.meta.shippingMethod && (
                                <>
                                  <span>•</span>
                                  <span>🚚 VC: {m.meta.shippingMethod}</span>
                                </>
                              )}
                              {m.meta.trackingNumber && (
                                <>
                                  <span>•</span>
                                  {m.meta.trackingUrl ? (
                                    <a href={m.meta.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[#0066cc] hover:underline font-semibold">
                                      📦 Vận đơn: {m.meta.trackingNumber} ↗
                                    </a>
                                  ) : (
                                    <span className="font-semibold text-slate-700">📦 Vận đơn: {m.meta.trackingNumber}</span>
                                  )}
                                </>
                              )}
                            </>
                          )}
                          {m.type === "sale" && (
                            <>
                              <span className="font-semibold text-slate-700">
                                Doanh thu: {formatPrice(m.meta.sellingPrice)}
                              </span>
                              <span>•</span>
                              <button
                                onClick={() => triggerPhoneLookup(m.meta.customerPhone || m.meta.customerName)}
                                className="text-[#0066cc] hover:underline cursor-pointer font-semibold"
                                title="Nhấn để xem lịch sử mua hàng của khách này"
                              >
                                👤 Khách: {m.meta.customerName}
                              </button>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">Đơn: {m.meta.orderNumber}</span>
                            </>
                          )}
                          {m.type === "return" && m.meta.refundPrice !== undefined && (
                            <>
                              <span className="font-semibold text-slate-700">
                                Khấu trừ hoàn trả: {formatPrice(m.meta.refundPrice)}
                              </span>
                              {m.meta.isDefective && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-red-600">Lỗi phần cứng</span>
                                </>
                              )}
                            </>
                          )}
                          {m.type === "warranty" && (
                            <>
                              <span className="font-semibold text-slate-700">
                                Phí sửa bảo hành: {formatPrice(m.meta.repairCost)}
                              </span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">Phiếu bảo hành: {m.meta.claimNumber}</span>
                              {m.meta.actualReturnDate && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-700">Đã trả khách: {formatToDDMMYYYY(m.meta.actualReturnDate)}</span>
                                </>
                              )}
                            </>
                          )}
                          {(m.type === "movement" || (m.type === "return" && m.meta.fromStatus)) && (
                            <>
                              <span className="font-medium text-[12.5px]">
                                Trạng thái: <span className="font-semibold text-slate-500">{statusMapping[m.meta.fromStatus]?.label || m.meta.fromStatus || "N/A"}</span> ➔ <span className="font-semibold text-slate-800">{statusMapping[m.meta.toStatus]?.label || m.meta.toStatus || "N/A"}</span>
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
                <div className="absolute -left-[30px] top-1.5 w-5 h-5 rounded-full bg-[#e5e5e7] border-4 border-white shrink-0 z-10" />
                <div className="pl-4.5 pt-1.5 text-[11.5px] font-bold text-[#86868b] uppercase tracking-wider">
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
      <GlassCard className="py-28 text-center flex flex-col items-center justify-center bg-white border border-[#e5e5e7] rounded-2xl shadow-sm">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-4">
          <SFSymbolQRCode size={26} />
        </div>
        <h4 className="text-[15px] font-bold text-[#1d1d1f]">Không tìm thấy thiết bị</h4>
        <p className="text-[13px] text-[#86868b] mt-2 max-w-sm mx-auto leading-relaxed font-medium">
          Không tìm thấy thiết bị nào khớp với số Serial này trong cơ sở dữ liệu.
        </p>
      </GlassCard>
    );
  };

  const renderInitialState = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Welcome Header Card */}
        <GlassCard className="py-8 px-6 text-center flex flex-col items-center justify-center bg-white border border-[#e5e5e7] rounded-2xl shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#0066cc]/5 border border-[#0066cc]/10 flex items-center justify-center text-[#0066cc] mb-3">
            <SFSymbolMagnifyingGlass size={20} />
          </div>
          <h4 className="text-[15px] font-bold text-[#1d1d1f]">Tra cứu thông tin thông minh</h4>
          <p className="text-[12.5px] text-[#86868b] mt-1.5 max-w-lg mx-auto leading-relaxed font-medium">
            Nhập số điện thoại khách hàng hoặc mã Serial sản phẩm để truy xuất hồ sơ giao dịch, lịch sử sửa chữa hoặc sơ đồ vòng đời thiết bị.
          </p>
        </GlassCard>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Column Left: Search History & Customers */}
          <div className="space-y-6">
            
            {/* Search History */}
            <div className="bg-white rounded-2xl border border-[#e5e5e7] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-[#1d1d1f] pb-2 border-b border-[#f5f5f7]">
                <History size={16} className="text-[#86868b]" />
                <h5 className="text-[13.5px] font-bold">Lịch sử tra cứu gần đây</h5>
              </div>
              
              {recentSearches.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-none">
                  {recentSearches.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSearchQuery(item.query);
                        handleSearch(item.query, item.type);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-left transition-all active:scale-[0.98] group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[11px]",
                          item.type === "customer" ? "bg-[#0066cc]" : "bg-emerald-600"
                        )}>
                          {item.type === "customer" ? <User size={12} /> : <Cpu size={12} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">{item.label}</p>
                          <p className="text-[11px] text-[#86868b] font-medium font-mono">{item.query}</p>
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-[12px] font-medium">
                  Chưa có lịch sử tìm kiếm nào gần đây
                </div>
              )}
            </div>

            {/* Recent Active Customers */}
            <div className="bg-white rounded-2xl border border-[#e5e5e7] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-[#1d1d1f] pb-2 border-b border-[#f5f5f7]">
                <User size={16} className="text-[#86868b]" />
                <h5 className="text-[13.5px] font-bold">Khách hàng giao dịch gần đây</h5>
              </div>
              
              {suggestionsLoading ? (
                <div className="py-8 flex justify-center items-center text-slate-400 text-[12px]">
                  <Loader2 size={16} className="animate-spin mr-2 text-[#0066cc]" />
                  Đang tải danh sách...
                </div>
              ) : recentCustomers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recentCustomers.map((cust) => (
                    <button
                      key={cust.id}
                      onClick={() => {
                        setSearchQuery(cust.phone);
                        handleSearch(cust.phone, "customer");
                      }}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-left transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        <User size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold text-[#1d1d1f] truncate leading-snug">{cust.fullName}</p>
                        <p className="text-[11px] text-[#86868b] font-medium font-mono leading-none mt-1">{cust.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-[12px] font-medium">
                  Không tìm thấy khách hàng gợi ý
                </div>
              )}
            </div>

          </div>

          {/* Column Right: Recent Machines (Serial Numbers) */}
          <div className="space-y-6">
            
            <div className="bg-white rounded-2xl border border-[#e5e5e7] p-5 shadow-sm space-y-4 h-full flex flex-col justify-start">
              <div className="flex items-center gap-2 text-[#1d1d1f] pb-2 border-b border-[#f5f5f7] shrink-0">
                <Cpu size={16} className="text-[#86868b]" />
                <h5 className="text-[13.5px] font-bold">Thiết bị mới nhập kho</h5>
              </div>
              
              {suggestionsLoading ? (
                <div className="py-12 flex justify-center items-center text-slate-400 text-[12px] flex-1">
                  <Loader2 size={16} className="animate-spin mr-2 text-[#0066cc]" />
                  Đang tải danh sách...
                </div>
              ) : recentSerials.length > 0 ? (
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {recentSerials.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSearchQuery(item.serialNumber);
                        handleSearch(item.serialNumber, "serial");
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#e8e8ed] text-left transition-all active:scale-[0.98] group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                          <Cpu size={13} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-bold text-[#1d1d1f] truncate leading-snug">
                            {item.brandName} {item.productName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-[#86868b] font-medium font-mono bg-white border border-[#e5e5e7] px-1.5 py-0.5 rounded">
                              {item.serialNumber}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold uppercase",
                              statusMapping[item.status]?.color || "text-slate-500"
                            )}>
                              {statusMapping[item.status]?.label || item.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-[12px] font-medium flex-1 flex items-center justify-center">
                  Không tìm thấy thiết bị gợi ý nào gần đây
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* 1. Header with inline Search Console */}
      <div className="pb-6 border-b border-[#e5e5e7] flex flex-col md:flex-row md:items-center justify-start gap-4">
        {/* Search Console */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="w-full md:max-w-md">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SFSymbolMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" size={15} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Nhập số điện thoại hoặc mã serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-[42px] rounded-full bg-[#f5f5f7] border border-[#e5e5e7] text-[13.5px] font-medium text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:bg-white focus:ring-4 focus:ring-[#0066cc]/10 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={phoneLoading || serialLoading}
              className="h-[42px] px-6 bg-[#0066cc] hover:bg-[#0071e3] text-white rounded-full text-[13.5px] font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-sm active:scale-95 duration-200"
            >
              {phoneLoading || serialLoading ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <SFSymbolMagnifyingGlass size={14.5} />
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

export default function LookupPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-32 text-[#86868b]">
        <Loader2 className="animate-spin mb-4 text-[#0066cc]" size={28} />
        <p className="text-[16px] font-semibold text-[#1d1d1f]">Đang tải dữ liệu tra cứu...</p>
      </div>
    }>
      <LookupPageContent />
    </Suspense>
  );
}
