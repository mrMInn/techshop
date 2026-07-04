"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSystemSettings, saveSystemSettings, testTelegramConnectionAction } from "@/app/actions/settings";
import { GlassCard } from "@/components/ui/glass-card";
import { 
  Building2, CreditCard, Bell, Sliders, Sparkles, 
  Check, RefreshCw, Send, HelpCircle, AlertTriangle,
  Info, ShieldCheck, Mail, Phone, MapPin, BadgePercent,
  CalendarDays, Database, FileText
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"store" | "rules" | "telegram">("store");

  // Tab 1: Cửa hàng & VietQR
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeTaxCode, setStoreTaxCode] = useState("");
  
  const [bankName, setBankName] = useState("VCB");
  const [bankAccount, setBankAccount] = useState("");
  const [bankOwner, setBankOwner] = useState("");
  
  const [invoiceFooter, setInvoiceFooter] = useState("");

  // Tab 2: Quy tắc vận hành
  const [defaultVat, setDefaultVat] = useState<number>(10);
  const [defaultWarranty, setDefaultWarranty] = useState<number>(12);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(2);
  const [stockAgingThreshold, setStockAgingThreshold] = useState<number>(90);

  // Tab 3: Telegram Config
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [testPending, setTestPending] = useState(false);

  // Danh sách các sự kiện thông báo Telegram
  const [eventRules, setEventRules] = useState<Record<string, { isEnabled: boolean; template: string }>>({
    order_created: { 
      isEnabled: true, 
      template: "🔔 <b>ĐƠN HÀNG MỚI!</b>\n\n• Mã đơn: <code>{orderNumber}</code>\n• Khách hàng: <b>{customerName}</b>\n• Tổng tiền: <b>{totalAmount}</b>\n• Kênh bán: <b>{saleChannel}</b>" 
    },
    order_completed: { 
      isEnabled: true, 
      template: "✅ <b>ĐƠN HÀNG HOÀN TẤT!</b>\n\n• Mã đơn: <code>{orderNumber}</code>\n• Khách hàng: <b>{customerName}</b>\n• Tổng doanh thu: <b>{totalAmount}</b>\n• Lợi nhuận: <b>{profit}</b>" 
    },
    order_cancelled: { 
      isEnabled: true, 
      template: "❌ <b>HỦY ĐƠN GIAO DỊCH!</b>\n\n• Mã đơn: <code>{orderNumber}</code>\n• Khách hàng: <b>{customerName}</b>\n• Hoàn lại quỹ: <b>{totalAmount}</b>\n• Trạng thái kho: Toàn bộ máy đã trả về sẵn kho" 
    },
    warranty_created: { 
      isEnabled: true, 
      template: "🔧 <b>TIẾP NHẬN BẢO HÀNH!</b>\n\n• Phiếu biên nhận: <code>{claimNumber}</code>\n• Thiết bị: <b>{productName}</b>\n• Serial máy: <code>{serialNumber}</code>\n• Khách hàng: <b>{customerName}</b>\n• Mô tả lỗi: <i>{issueDescription}</i>" 
    },
    expense_created: { 
      isEnabled: false, 
      template: "💸 <b>PHÁT SINH CHI PHÍ SỔ QUỸ!</b>\n\n• Mã giao dịch: <code>{entryNumber}</code>\n• Số tiền: <b>{amount}</b>\n• Danh mục chi: <b>{category}</b>\n• Mô tả: {description}" 
    },
    low_stock_alert: { 
      isEnabled: true, 
      template: "⚠️ <b>CẢNH BÁO TỒN KHO THẤP!</b>\n\n• Sản phẩm: <b>{productName}</b>\n• Số lượng sẵn hàng: <b>{quantity} máy</b>\n• Ngưỡng cảnh báo: {threshold} máy" 
    }
  });

  const popularBanks = [
    { code: "ICB", name: "VietinBank" },
    { code: "VCB", name: "Vietcombank" },
    { code: "BIDV", name: "BIDV" },
    { code: "MB", name: "MB Bank" },
    { code: "TCB", name: "Techcombank" },
    { code: "ACB", name: "ACB" },
    { code: "VPB", name: "VPBank" },
    { code: "TPB", name: "TPBank" },
    { code: "VBA", name: "Agribank" },
    { code: "HDB", name: "HDBank" },
    { code: "VIB", name: "VIB" },
    { code: "SHB", name: "SHB" },
  ];

  // 1. Tải cấu hình hệ thống từ DB
  const { data: dbData, isLoading, error } = useQuery({
    queryKey: ["system_settings"],
    queryFn: getSystemSettings,
  });

  // Đồng bộ hóa dữ liệu từ DB vào React state khi load xong
  useEffect(() => {
    if (dbData?.settings) {
      const s = dbData.settings;
      setStoreName(s.storeName || "");
      setStoreAddress(s.storeAddress || "");
      setStorePhone(s.storePhone || "");
      setStoreEmail(s.storeEmail || "");
      setStoreTaxCode(s.storeTaxCode || "");
      
      setBankName(s.bankName || "VCB");
      setBankAccount(s.bankAccount || "");
      setBankOwner(s.bankOwner || "");
      
      setInvoiceFooter(s.invoiceFooter || "");
      
      setDefaultVat(Number(s.defaultVat !== null && s.defaultVat !== undefined ? s.defaultVat : 10));
      setDefaultWarranty(Number(s.defaultWarranty !== null && s.defaultWarranty !== undefined ? s.defaultWarranty : 12));
      setLowStockThreshold(Number(s.lowStockThreshold !== null && s.lowStockThreshold !== undefined ? s.lowStockThreshold : 2));
      setStockAgingThreshold(Number(s.stockAgingThreshold !== null && s.stockAgingThreshold !== undefined ? s.stockAgingThreshold : 90));
      
      setBotToken(s.botToken || "");
      setChatId(s.chatId || "");
      setIsActive(s.isActive);
    }

    if (dbData?.events && dbData.events.length > 0) {
      const updatedRules = { ...eventRules };
      dbData.events.forEach((ev: any) => {
        if (updatedRules[ev.eventType]) {
          updatedRules[ev.eventType] = {
            isEnabled: ev.isEnabled,
            template: ev.template || updatedRules[ev.eventType].template,
          };
        }
      });
      setEventRules(updatedRules);
    }
  }, [dbData]);

  // 2. Mutation lưu cấu hình
  const saveMutation = useMutation({
    mutationFn: saveSystemSettings,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["system_settings"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Lỗi khi lưu cấu hình");
    }
  });

  // Xử lý gửi biểu mẫu lưu cấu hình
  const handleSave = () => {
    // Validate
    if (botToken && !chatId) {
      toast.error("Vui lòng điền Chat ID nếu bạn nhập Bot Token");
      return;
    }
    if (chatId && !botToken) {
      toast.error("Vui lòng điền Bot Token nếu bạn nhập Chat ID");
      return;
    }

    const payload = {
      botToken,
      chatId,
      isActive,
      
      storeName,
      storeAddress,
      storePhone,
      storeEmail,
      storeTaxCode,
      
      bankName,
      bankAccount,
      bankOwner,
      
      invoiceFooter,
      
      defaultVat,
      defaultWarranty,
      lowStockThreshold,
      stockAgingThreshold,
      
      events: Object.keys(eventRules).map(key => ({
        eventType: key as any,
        isEnabled: eventRules[key].isEnabled,
        template: eventRules[key].template,
      }))
    };

    saveMutation.mutate(payload);
  };

  // 3. Xử lý Test kết nối Telegram Bot
  const handleTestConnection = async () => {
    if (!botToken || !chatId) {
      toast.error("Vui lòng nhập Bot Token và Chat ID trước khi kiểm thử");
      return;
    }

    setTestPending(true);
    try {
      const res = await testTelegramConnectionAction(botToken, chatId);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi đường truyền kết nối");
    } finally {
      setTestPending(false);
    }
  };

  const handleToggleEvent = (key: string) => {
    setEventRules(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        isEnabled: !prev[key].isEnabled
      }
    }));
  };

  const handleTemplateChange = (key: string, value: string) => {
    setEventRules(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        template: value
      }
    }));
  };

  // Tạo QR Code động demo
  const getDemoQrUrl = () => {
    if (!bankName || !bankAccount) return null;
    const cleanOwner = encodeURIComponent(bankOwner || "KHACH HANG DEMO");
    return `https://img.vietqr.io/image/${bankName}-${bankAccount}-compact2.png?amount=15000000&addInfo=DEMO123&accountName=${cleanOwner}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#7a7a7a]">
        <RefreshCw className="animate-spin mb-3 text-[#0066cc]" size={28} />
        <p className="text-[14px]">Đang tải cấu hình hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Header Section - Apple Premium Photography-first */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-end pb-6 border-b border-[#e0e0e0]">
        
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["system_settings"] })}
            className="flex items-center justify-center w-10 h-10 bg-white hover:bg-[#f5f5f7] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-xl transition-all cursor-pointer active:scale-95 duration-200"
            title="Đồng bộ lại"
          >
            <RefreshCw size={15} />
          </button>
          
          <button 
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-6 h-[40px] bg-[#0066cc] text-white text-[13px] font-medium rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 disabled:opacity-50"
          >
            {saveMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
            <span>Lưu tất cả cấu hình</span>
          </button>
        </div>
      </div>

      {/* 2. Slide Tab Switcher - Apple Premium style */}
      <div className="flex bg-[#f5f5f7] p-1 rounded-2xl w-full max-w-md border border-[#e0e0e0] shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)] select-none">
        <button
          onClick={() => setActiveTab("store")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
            activeTab === "store" 
              ? "bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]" 
              : "text-[#7a7a7a] hover:text-[#1d1d1f]"
          }`}
        >
          <Building2 size={14} />
          <span>Cửa hàng & VietQR</span>
        </button>
        
        <button
          onClick={() => setActiveTab("rules")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
            activeTab === "rules" 
              ? "bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]" 
              : "text-[#7a7a7a] hover:text-[#1d1d1f]"
          }`}
        >
          <Sliders size={14} />
          <span>Quy tắc vận hành</span>
        </button>
        
        <button
          onClick={() => setActiveTab("telegram")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold tracking-tight transition-all duration-200 cursor-pointer ${
            activeTab === "telegram" 
              ? "bg-white text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]" 
              : "text-[#7a7a7a] hover:text-[#1d1d1f]"
          }`}
        >
          <Bell size={14} />
          <span>Thông báo Telegram</span>
        </button>
      </div>

      {/* 3. Main Form Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: Main Form inputs based on active tab */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB 1: STORE & VIETQR CONFIGURATION */}
          {activeTab === "store" && (
            <div className="space-y-6 animate-in slide-in-from-left duration-250">
              
              {/* Store Details Box */}
              <GlassCard className="p-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-3">
                  <Building2 size={16} className="text-[#0066cc]" />
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Thông tin liên hệ cửa hàng</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Tên cửa hàng</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: TechStore Laptop & Linh Kiện"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Số điện thoại hotline</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: 0987654321"
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Địa chỉ giao dịch</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: 123 Đường Ba Đình, Quận 1, TP. Hồ Chí Minh"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Email liên hệ</label>
                    <input 
                      type="email" 
                      placeholder="Ví dụ: support@techstore.vn"
                      value={storeEmail}
                      onChange={(e) => setStoreEmail(e.target.value)}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Mã số thuế (nếu có)</label>
                    <input 
                      type="text" 
                      placeholder="Mã số thuế doanh nghiệp"
                      value={storeTaxCode}
                      onChange={(e) => setStoreTaxCode(e.target.value)}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    />
                  </div>
                </div>
              </GlassCard>

              {/* Bank accounts & VietQR Config Box */}
              <GlassCard className="p-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-3">
                  <CreditCard size={16} className="text-[#0066cc]" />
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Cấu hình ngân hàng & VietQR</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Ngân hàng</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    >
                      {popularBanks.map(b => (
                        <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Số tài khoản</label>
                    <input 
                      type="text" 
                      placeholder="Số tài khoản ngân hàng"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Họ & Tên chủ tài khoản</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: NGUYEN VAN A"
                      value={bankOwner}
                      onChange={(e) => setBankOwner(e.target.value.toUpperCase())}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all uppercase placeholder:normal-case"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 bg-blue-50/50 p-4 border border-blue-200/50 rounded-2xl flex items-start gap-3">
                  <Info size={16} className="text-[#0066cc] mt-0.5 shrink-0" />
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    <b>Tự động tạo VietQR:</b> Hệ thống sẽ tự động ghép Ngân hàng, Số tài khoản và Tên chủ tài khoản này kèm số tiền và nội dung mã hóa đơn cụ thể để sinh ra mã QR Code thanh toán chuyển khoản trên link báo giá điện tử gửi khách hàng.
                  </p>
                </div>
              </GlassCard>

              {/* Invoice footer text */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-3">
                  <FileText size={16} className="text-[#0066cc]" />
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Điều khoản in ấn & Chân trang (Invoice Footer)</h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Chính sách & Lời chúc mặc định</label>
                  <textarea
                    rows={4}
                    placeholder="Ví dụ: 
- Quý khách vui lòng kiểm tra máy kỹ trước khi ra khỏi quầy.
- Máy bán ra được bảo hành phần cứng 1 đổi 1 trong 30 ngày đầu tiên nếu phát sinh lỗi phần cứng từ nhà sản xuất.
- Xin chân thành cảm ơn sự tin yêu của quý khách dành cho TechStore!"
                    value={invoiceFooter}
                    onChange={(e) => setInvoiceFooter(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-slate-400"
                  />
                  <span className="text-[11px] text-[#7a7a7a] block mt-1">Dòng chữ này sẽ tự động xuất hiện ở phần chân trang (footer) của báo giá trực tuyến và hóa đơn khi in PDF.</span>
                </div>
              </GlassCard>

            </div>
          )}

          {/* TAB 2: OPERATIONAL RULES CONFIGURATION */}
          {activeTab === "rules" && (
            <div className="space-y-6 animate-in slide-in-from-left duration-250">
              <GlassCard className="p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-3">
                  <Sliders size={16} className="text-[#0066cc]" />
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Thiết lập quy tắc & Định mức vận hành</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Default VAT Rate */}
                  <div className="space-y-2.5 p-5 bg-[#f5f5f7]/50 rounded-2xl border border-slate-200/50 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <BadgePercent size={16} className="text-slate-600" />
                        <h4 className="text-[13.5px] font-bold text-[#1d1d1f]">Tỷ suất thuế VAT mặc định</h4>
                      </div>
                      <p className="text-[11px] text-[#7a7a7a] leading-relaxed">Áp dụng tính thuế tự động khi tạo hóa đơn đơn hàng bán lẻ mới.</p>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <input 
                        type="number" 
                        min={0}
                        max={100}
                        value={defaultVat}
                        onChange={(e) => setDefaultVat(Math.max(0, Number(e.target.value)))}
                        className="w-24 px-3 h-[38px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-center font-bold text-[#1d1d1f] focus:outline-none"
                      />
                      <span className="text-[14px] font-bold text-slate-500">% VAT</span>
                    </div>
                  </div>

                  {/* Default Warranty Period */}
                  <div className="space-y-2.5 p-5 bg-[#f5f5f7]/50 rounded-2xl border border-slate-200/50 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-slate-600" />
                        <h4 className="text-[13.5px] font-bold text-[#1d1d1f]">Thời hạn bảo hành mặc định</h4>
                      </div>
                      <p className="text-[11px] text-[#7a7a7a] leading-relaxed">Thời hạn bảo hành tự động được gán khi xuất bán các sản phẩm máy laptop.</p>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <input 
                        type="number" 
                        min={0}
                        value={defaultWarranty}
                        onChange={(e) => setDefaultWarranty(Math.max(0, Number(e.target.value)))}
                        className="w-24 px-3 h-[38px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-center font-bold text-[#1d1d1f] focus:outline-none"
                      />
                      <span className="text-[14px] font-bold text-slate-500">Tháng</span>
                    </div>
                  </div>

                  {/* Low Stock Warning */}
                  <div className="space-y-2.5 p-5 bg-[#f5f5f7]/50 rounded-2xl border border-slate-200/50 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-600" />
                        <h4 className="text-[13.5px] font-bold text-[#1d1d1f]">Định mức cảnh báo tồn kho thấp</h4>
                      </div>
                      <p className="text-[11px] text-[#7a7a7a] leading-relaxed">Hệ thống gắn tag đỏ và gửi cảnh báo khi số lượng máy trong kho của sản phẩm dưới định mức này.</p>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <input 
                        type="number" 
                        min={0}
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(Math.max(0, Number(e.target.value)))}
                        className="w-24 px-3 h-[38px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-center font-bold text-[#1d1d1f] focus:outline-none"
                      />
                      <span className="text-[14px] font-bold text-slate-500">Chiếc máy</span>
                    </div>
                  </div>

                  {/* Stock Aging Alert */}
                  <div className="space-y-2.5 p-5 bg-[#f5f5f7]/50 rounded-2xl border border-slate-200/50 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={16} className="text-rose-600" />
                        <h4 className="text-[13.5px] font-bold text-[#1d1d1f]">Cảnh báo tồn kho quá hạn</h4>
                      </div>
                      <p className="text-[11px] text-[#7a7a7a] leading-relaxed">Cảnh báo máy đọng vốn khi số ngày kể từ lúc nhập kho đạt ngưỡng để cửa hàng thanh lý.</p>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <input 
                        type="number" 
                        min={0}
                        value={stockAgingThreshold}
                        onChange={(e) => setStockAgingThreshold(Math.max(0, Number(e.target.value)))}
                        className="w-24 px-3 h-[38px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-center font-bold text-[#1d1d1f] focus:outline-none"
                      />
                      <span className="text-[14px] font-bold text-slate-500">Ngày nằm kho</span>
                    </div>
                  </div>

                </div>
              </GlassCard>
            </div>
          )}

          {/* TAB 3: TELEGRAM CONNECTION & NOTIFICATIONS */}
          {activeTab === "telegram" && (
            <div className="space-y-6 animate-in slide-in-from-left duration-250">
              
              {/* Telegram bot Connection setup */}
              <GlassCard className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-[#e0e0e0] pb-3">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-[#0066cc]" />
                    <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Cài đặt kết nối Telegram Bot</h3>
                  </div>
                  
                  {/* Active Toggle switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</span>
                    <button
                      onClick={() => setIsActive(!isActive)}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none cursor-pointer ${
                        isActive ? "bg-[#009b72]" : "bg-slate-300"
                      }`}
                    >
                      <span 
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${
                          isActive ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Telegram Bot Token</label>
                    <input 
                      type="password" 
                      placeholder="Mã token bot (ví dụ: 123456:ABC...)"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Telegram Chat ID nhóm</label>
                    <input 
                      type="text" 
                      placeholder="Mã chat ID nhóm (ví dụ: -100234567)"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      className="w-full px-4 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Connection check footer buttons */}
                <div className="pt-2 flex items-center justify-between gap-4">
                  <p className="text-[11px] text-[#7a7a7a] leading-relaxed max-w-md">
                    * Tạo bot bằng cách nhắn tin với <b>@BotFather</b> trên Telegram, sau đó thêm Bot vào nhóm chat báo cáo của cửa hàng và cấp quyền quản trị để bắt đầu.
                  </p>
                  
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testPending}
                    className="flex items-center gap-1.5 px-4 h-[36px] bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-[12px] font-semibold transition-all cursor-pointer disabled:opacity-50 active:scale-95 duration-200 shrink-0"
                  >
                    {testPending ? <RefreshCw className="animate-spin" size={13} /> : <Send size={13} />}
                    <span>Kiểm tra kết nối</span>
                  </button>
                </div>
              </GlassCard>

              {/* Event Notification template preferences */}
              <GlassCard className="p-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-[#e0e0e0] pb-3">
                  <Sparkles size={16} className="text-[#0066cc]" />
                  <h3 className="text-[16px] font-semibold text-[#1d1d1f]">Quy tắc & Biểu mẫu mẫu thông báo (Message Templates)</h3>
                </div>

                <div className="space-y-6">
                  {Object.keys(eventRules).map(key => {
                    const rule = eventRules[key];
                    const labelMap: Record<string, { title: string; desc: string; place: string }> = {
                      order_created: {
                        title: "1. Đơn bán hàng mới được tạo",
                        desc: "Gửi tin khi nhân viên lập hóa đơn thành công tại quầy.",
                        place: "Biến hỗ trợ: {orderNumber}, {customerName}, {totalAmount}, {saleChannel}"
                      },
                      order_completed: {
                        title: "2. Giao dịch đơn hàng hoàn thành",
                        desc: "Gửi tin báo cáo kèm hạch toán lợi nhuận đơn hàng bán ra.",
                        place: "Biến hỗ trợ: {orderNumber}, {customerName}, {totalAmount}, {profit}"
                      },
                      order_cancelled: {
                        title: "3. Hủy đơn hàng - Hoàn trả kho",
                        desc: "Báo động khi hủy giao dịch, tự động trả kho thiết bị.",
                        place: "Biến hỗ trợ: {orderNumber}, {customerName}, {totalAmount}"
                      },
                      warranty_created: {
                        title: "4. Tiếp nhận máy bảo hành mới",
                        desc: "Gửi tin khi lập phiếu tiếp nhận thiết bị sửa chữa bảo hành.",
                        place: "Biến hỗ trợ: {claimNumber}, {productName}, {serialNumber}, {customerName}, {issueDescription}"
                      },
                      expense_created: {
                        title: "5. Phát sinh dòng chi ngoài sổ quỹ",
                        desc: "Nhắc nhở tự động khi phát sinh phiếu chi tiền lương, thuê mặt bằng, điện nước...",
                        place: "Biến hỗ trợ: {entryNumber}, {amount}, {category}, {description}"
                      },
                      low_stock_alert: {
                        title: "6. Cảnh báo tồn kho dưới ngưỡng an toàn",
                        desc: "Gửi thông báo động khi máy trong kho bị xả bán dưới hạn định.",
                        place: "Biến hỗ trợ: {productName}, {quantity}, {threshold}"
                      }
                    };

                    const meta = labelMap[key] || { title: key, desc: "", place: "" };

                    return (
                      <div key={key} className="p-5 bg-slate-50/60 border border-slate-200/50 rounded-2xl space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-[14px] font-bold text-[#1d1d1f]">{meta.title}</h4>
                            <p className="text-[12px] text-[#7a7a7a] mt-0.5">{meta.desc}</p>
                          </div>
                          
                          {/* Toggle switch for single event rule */}
                          <button
                            onClick={() => handleToggleEvent(key)}
                            className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none cursor-pointer shrink-0 ${
                              rule.isEnabled ? "bg-[#0071e3]" : "bg-slate-300"
                            }`}
                          >
                            <span 
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${
                                rule.isEnabled ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {rule.isEnabled && (
                          <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                            <textarea
                              rows={3}
                              value={rule.template}
                              onChange={(e) => handleTemplateChange(key, e.target.value)}
                              className="w-full p-3 rounded-xl bg-white border border-[#e0e0e0] text-[13px] font-mono text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                            />
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold pl-1">
                              <Info size={12} className="text-[#0066cc]" />
                              <span>{meta.place}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Interactive Live mockups based on active tab */}
        <div className="space-y-6">
          
          {/* TAB 1 PREMIUM MOCKUP: Live VietQR Payment Card Preview */}
          {activeTab === "store" && (
            <div className="sticky top-6 space-y-6 animate-in fade-in duration-300">
              
              <div className="text-[11px] font-black uppercase tracking-widest text-[#7a7a7a] pl-1">Xem trước thanh toán VietQR động</div>
              
              {/* VietQR Mockup Card */}
              <GlassCard className="p-6 bg-gradient-to-br from-[#0c0c0e] via-[#1c1c21] to-[#09090b] text-white border-white/5 shadow-2xl relative overflow-hidden flex flex-col justify-between aspect-[3/4] max-w-sm mx-auto rounded-[32px] group">
                <div className="absolute top-0 right-0 w-44 h-44 bg-[#0066cc]/10 blur-[50px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-36 h-36 bg-[#34c759]/5 blur-[40px] rounded-full pointer-events-none" />
                
                {/* Header card info */}
                <div className="flex justify-between items-center z-10">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">VietQR Transfer Card</span>
                    <h4 className="text-[14px] font-black tracking-tight uppercase">{storeName || "TECHSTORE LAPTOP"}</h4>
                  </div>
                  <div className="w-12 h-6 bg-white/10 rounded-lg border border-white/10 flex items-center justify-center font-extrabold text-[10px] text-slate-300 font-sans tracking-tight">
                    {bankName}
                  </div>
                </div>

                {/* QR Code central container */}
                <div className="my-6 flex flex-col items-center justify-center bg-white p-4.5 rounded-[24px] shadow-lg border border-white/5 relative z-10 w-fit mx-auto animate-scale-up">
                  {getDemoQrUrl() ? (
                    <img 
                      src={getDemoQrUrl()!} 
                      alt="VietQR Demo Preview" 
                      className="w-48 h-48 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-48 h-48 bg-slate-100 flex flex-col items-center justify-center text-center p-4 rounded-xl text-slate-400">
                      <CreditCard size={28} className="mb-2 text-slate-300" />
                      <p className="text-[11px] leading-normal font-semibold">Nhập Số tài khoản để tự sinh mã QR Code thanh toán</p>
                    </div>
                  )}
                  {bankAccount && (
                    <span className="text-[10px] text-slate-500 font-extrabold font-mono mt-2 select-all leading-none">{bankAccount}</span>
                  )}
                </div>

                {/* Footer bank credentials */}
                <div className="border-t border-white/5 pt-4 space-y-2 z-10">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Chủ tài khoản:</span>
                    <strong className="text-white tracking-wider font-extrabold">{bankOwner || "NGUYEN VAN A"}</strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Số tiền demo:</span>
                    <strong className="text-[#007aff] font-extrabold">15,000,000 ₫</strong>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 italic text-center pt-1 leading-none w-full justify-center">
                    * Khách chuyển tiền, app tự đồng bộ quỹ lập tức
                  </div>
                </div>

              </GlassCard>

              {/* PDF Preview metadata header */}
              <div className="p-5 bg-white border border-[#e0e0e0] rounded-2xl space-y-3.5 shadow-sm text-[12px] text-slate-600">
                <div className="flex items-center gap-2 border-b pb-2 text-[#1d1d1f] font-bold">
                  <ShieldCheck size={14} className="text-[#009b72]" />
                  <span>Ứng dụng thông tin liên hệ</span>
                </div>
                <div className="space-y-2 leading-relaxed font-medium">
                  <div className="flex gap-2">
                    <MapPin size={13} className="text-[#7a7a7a] mt-0.5 shrink-0" />
                    <span><b>Địa chỉ in PDF:</b> {storeAddress || "N/A"}</span>
                  </div>
                  <div className="flex gap-2">
                    <Phone size={13} className="text-[#7a7a7a] mt-0.5 shrink-0" />
                    <span><b>Hotline chân trang:</b> {storePhone || "N/A"}</span>
                  </div>
                  {invoiceFooter && (
                    <div className="bg-[#f5f5f7]/60 p-3 rounded-xl border border-slate-200/50 mt-1 italic">
                      &ldquo;{invoiceFooter.length > 80 ? `${invoiceFooter.substring(0, 80)}...` : invoiceFooter}&rdquo;
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2 OPERATIONAL PREVIEWS */}
          {activeTab === "rules" && (
            <div className="sticky top-6 space-y-6 animate-in fade-in duration-300">
              <div className="text-[11px] font-black uppercase tracking-widest text-[#7a7a7a] pl-1">Hướng dẫn tham số vận hành</div>
              
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 text-[#1d1d1f] font-bold text-[14px]">
                  <Database size={15} className="text-[#0066cc]" />
                  <span>Tác động của Định mức</span>
                </div>
                
                <div className="space-y-4.5 text-[12.5px] text-slate-600 leading-relaxed font-medium">
                  <div className="space-y-1">
                    <h5 className="font-bold text-[#1d1d1f]">1. Mức thuế VAT mặc định:</h5>
                    <p className="pl-3.5 border-l-2 border-[#0066cc]">
                      Khi nhân viên chọn máy để lập hóa đơn bán lẻ, hệ thống tự cộng thêm **{defaultVat}% VAT** vào giá bán của máy (cho phép nhân viên chỉnh sửa tùy ý theo thỏa thuận khách hàng).
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h5 className="font-bold text-[#1d1d1f]">2. Số tháng bảo hành mẫu:</h5>
                    <p className="pl-3.5 border-l-2 border-[#0066cc]">
                      Laptop xuất kho tự động gán thời gian bảo hành **{defaultWarranty} tháng**. Ngày hết hạn bảo hành tự tính cộng từ ngày bán ra trên hệ thống.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h5 className="font-bold text-[#1d1d1f]">3. Định mức báo động tồn kho:</h5>
                    <p className="pl-3.5 border-l-2 border-amber-500">
                      Khi số lượng chiếc máy sẵn kho của dòng máy MacBook hay ThinkPad bất kỳ giảm còn dưới **{lowStockThreshold} máy**, hệ thống sẽ tự phát ra cảnh báo đỏ và gửi báo động Telegram để kế toán nhanh chóng lập đơn nhập hàng.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h5 className="font-bold text-[#1d1d1f]">4. Ngưỡng tồn kho quá hạn:</h5>
                    <p className="pl-3.5 border-l-2 border-rose-500">
                      Thiết bị nằm im trong kho quá **{stockAgingThreshold} ngày** kể từ lúc bấm nhập kho (không bán được) sẽ tự đánh dấu cảnh báo quá thời hạn đọng vốn trên giao diện Quản lý Kho.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* TAB 3 OPERATIONAL PREVIEWS */}
          {activeTab === "telegram" && (
            <div className="sticky top-6 space-y-6 animate-in fade-in duration-300">
              <div className="text-[11px] font-black uppercase tracking-widest text-[#7a7a7a] pl-1">Hướng dẫn biến thế thế (Placeholders)</div>
              
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 text-[#1d1d1f] font-bold text-[14px]">
                  <HelpCircle size={15} className="text-[#0066cc]" />
                  <span>Giải thích cấu trúc mẫu</span>
                </div>
                
                <div className="space-y-4 text-[12.5px] text-slate-600 leading-relaxed font-medium">
                  <p>
                    Bạn có thể sử dụng các biến trong ngoặc nhọn `{` `}` để hệ thống tự động điền dữ liệu thực tế của giao dịch khi gửi tin.
                  </p>
                  
                  <div className="space-y-2 bg-[#f5f5f7] p-4.5 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-black uppercase text-[#0066cc] block leading-none mb-2">Từ khóa chính hỗ trợ:</span>
                    <ul className="space-y-1.5 font-mono text-[11.5px] text-slate-700 font-bold list-disc pl-4">
                      <li><code>{`{orderNumber}`}</code>: Mã số đơn hàng</li>
                      <li><code>{`{customerName}`}</code>: Tên khách hàng</li>
                      <li><code>{`{totalAmount}`}</code>: Tổng tiền thanh toán</li>
                      <li><code>{`{saleChannel}`}</code>: Kênh trực tiếp/online</li>
                      <li><code>{`{claimNumber}`}</code>: Mã phiếu bảo hành</li>
                      <li><code>{`{productName}`}</code>: Tên máy laptop</li>
                      <li><code>{`{serialNumber}`}</code>: Mã Serial máy</li>
                    </ul>
                  </div>

                  <p className="text-[11px] text-[#7a7a7a] leading-normal font-bold">
                    * Hỗ trợ đầy đủ các định dạng thẻ HTML của Telegram như <code>&lt;b&gt;Chữ in đậm&lt;/b&gt;</code>, <code>&lt;i&gt;Chữ in nghiêng&lt;/i&gt;</code> và <code>&lt;code&gt;Chữ dạng code copy&lt;/code&gt;</code> để tin nhắn báo cáo hiển thị đẹp mắt.
                  </p>
                </div>
              </GlassCard>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
