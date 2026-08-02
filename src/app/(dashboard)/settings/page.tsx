"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSystemSettings, saveSystemSettings, testTelegramConnectionAction } from "@/app/actions/settings";
import { 
  Bell, Check, RefreshCw, Send, HelpCircle, Info
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab] = useState<"store" | "rules" | "telegram">("telegram");

  // State values (kept to keep saving schema intact)
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeTaxCode, setStoreTaxCode] = useState("");
  const [bankName, setBankName] = useState("VCB");
  const [bankAccount, setBankAccount] = useState("");
  const [bankOwner, setBankOwner] = useState("");
  const [invoiceFooter, setInvoiceFooter] = useState("");
  const [defaultVat, setDefaultVat] = useState<number>(10);
  const [defaultWarranty, setDefaultWarranty] = useState<number>(12);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(2);
  const [stockAgingThreshold, setStockAgingThreshold] = useState<number>(90);

  // Telegram Config States
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [testPending, setTestPending] = useState(false);

  // Event templates
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

  // 1. Tải cấu hình hệ thống từ DB
  const { data: dbData, isLoading } = useQuery({
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

  const handleSave = () => {
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#7a7a7a]">
        <RefreshCw className="animate-spin mb-3 text-[#0066cc]" size={28} />
        <p className="text-[14px]">Đang tải cấu hình Telegram...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Title Header - Matching Apple style in other pages */}
      <div className="pb-6 border-b border-[#e0e0e0]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
          <div>
            <h2 className="text-[20px] font-bold text-[#1d1d1f] tracking-tight">Cấu hình thông báo Telegram</h2>
            <p className="text-[13px] text-[#7a7a7a] mt-1 font-medium">Kết nối Bot Telegram trợ lý ảo để tự động gửi thông báo báo cáo đơn hàng, doanh thu & bảo hành.</p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["system_settings"] })}
              className="flex items-center justify-center w-10 h-10 bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all cursor-pointer active:scale-95 duration-200"
              title="Đồng bộ lại"
            >
              <RefreshCw size={14} />
            </button>
            
            <button 
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-5 h-[40px] bg-[#0066cc] text-white text-[13px] font-semibold rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200 disabled:opacity-50"
            >
              {saveMutation.isPending ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Content - Rebuilt to conform with warranty/orders clean design */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Form & Template Editors */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Bot Credentials */}
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex items-center justify-between border-b border-[#f5f5f7] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#0066cc]">
                  <Bell size={16} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1d1d1f]">Cài đặt kết nối Bot</h3>
                  <p className="text-[11.5px] text-[#7a7a7a] font-medium">Nhập thông tin kết nối Telegram API</p>
                </div>
              </div>
              
              {/* Active Toggle Switch */}
              <div className="flex items-center gap-3.5 bg-[#f5f5f7] px-3.5 py-1.5 rounded-full border border-slate-200/40">
                <span className="text-[11.5px] font-bold text-[#555] uppercase tracking-wider">Trạng thái</span>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`relative w-11 h-5.5 rounded-full transition-colors duration-200 focus:outline-none cursor-pointer shrink-0 ${
                    isActive ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span 
                    className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${
                      isActive ? "translate-x-5.5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11.5px] font-bold text-[#48484a] uppercase tracking-wider block pl-1">Telegram Bot Token</label>
                <input 
                  type="password" 
                  placeholder="Mã Token Bot (ví dụ: 123456:ABC...)"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full px-4 h-[42px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13.5px] font-semibold text-[#1d1d1f] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all font-mono placeholder:text-[#7a7a7a]/45 shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11.5px] font-bold text-[#48484a] uppercase tracking-wider block pl-1">Telegram Chat ID nhóm</label>
                <input 
                  type="text" 
                  placeholder="Mã Chat ID nhóm (ví dụ: -10012345678)"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full px-4 h-[42px] rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13.5px] font-semibold text-[#1d1d1f] focus:bg-white focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all font-mono placeholder:text-[#7a7a7a]/45 shadow-sm"
                />
              </div>
            </div>

            {/* Test Connection Row */}
            <div className="pt-2 border-t border-[#f5f5f7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-[11.5px] text-[#7a7a7a] font-medium leading-relaxed max-w-[420px]">
                * Tạo bot bằng cách chat với <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[#0066cc] hover:underline font-bold">@BotFather</a> trên Telegram, thêm bot vào nhóm báo cáo và cấp quyền admin.
              </p>
              
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testPending}
                className="flex items-center gap-1.5 px-4 h-[36px] bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-full text-[12px] font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-95 duration-200 shrink-0"
              >
                {testPending ? <RefreshCw className="animate-spin" size={13} /> : <Send size={13} />}
                <span>Kiểm tra kết nối</span>
              </button>
            </div>
          </div>

          {/* Card 2: Message Event Templates */}
          <div className="bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-5">
            <div className="border-b border-[#f5f5f7] pb-4">
              <h3 className="text-[15px] font-bold text-[#1d1d1f]">Cấu hình biểu mẫu gửi tin</h3>
              <p className="text-[11.5px] text-[#7a7a7a] font-medium">Bật/tắt các loại thông báo sự kiện và tùy chỉnh nội dung tin nhắn gửi về nhóm</p>
            </div>

            <div className="space-y-4">
              {Object.keys(eventRules).map(key => {
                const rule = eventRules[key];
                const labelMap: Record<string, { title: string; desc: string; place: string }> = {
                  order_created: {
                    title: "1. Đơn hàng mới được tạo",
                    desc: "Gửi báo cáo tức thì khi nhân viên lập hóa đơn thành công tại quầy.",
                    place: "Biến hỗ trợ: {orderNumber}, {customerName}, {totalAmount}, {saleChannel}"
                  },
                  order_completed: {
                    title: "2. Giao dịch đơn hàng hoàn thành",
                    desc: "Gửi báo cáo tài chính chi tiết kèm số tiền lợi nhuận thực tế kiếm được.",
                    place: "Biến hỗ trợ: {orderNumber}, {customerName}, {totalAmount}, {profit}"
                  },
                  order_cancelled: {
                    title: "3. Hủy giao dịch đơn hàng",
                    desc: "Cảnh báo khi hủy đơn hàng giao dịch, trả thiết bị về kho.",
                    place: "Biến hỗ trợ: {orderNumber}, {customerName}, {totalAmount}"
                  },
                  warranty_created: {
                    title: "4. Tiếp nhận bảo hành thiết bị",
                    desc: "Gửi thông báo khi tạo phiếu bảo hành cho máy lỗi của khách hàng.",
                    place: "Biến hỗ trợ: {claimNumber}, {productName}, {serialNumber}, {customerName}, {issueDescription}"
                  },
                  expense_created: {
                    title: "5. Phát sinh chi phí ngoài sổ quỹ",
                    desc: "Báo động khi thủ quỹ xuất phiếu chi lương, mặt bằng, điện nước...",
                    place: "Biến hỗ trợ: {entryNumber}, {amount}, {category}, {description}"
                  },
                  low_stock_alert: {
                    title: "6. Cảnh báo tồn kho dưới hạn an toàn",
                    desc: "Tự động cảnh báo khi một sản phẩm trong kho xả bán chạm ngưỡng tối thiểu.",
                    place: "Biến hỗ trợ: {productName}, {quantity}, {threshold}"
                  }
                };

                const meta = labelMap[key] || { title: key, desc: "", place: "" };

                return (
                  <div key={key} className="p-5 bg-[#f5f5f7]/40 border border-[#e0e0e0] rounded-2xl space-y-4 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <h4 className="text-[13.5px] font-bold text-[#1d1d1f]">{meta.title}</h4>
                        <p className="text-[12px] text-[#7a7a7a] font-medium leading-relaxed">{meta.desc}</p>
                      </div>
                      
                      {/* Active switch */}
                      <button
                        onClick={() => handleToggleEvent(key)}
                        className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none cursor-pointer shrink-0 ${
                          rule.isEnabled ? "bg-[#0066cc]" : "bg-slate-300"
                        }`}
                      >
                        <span 
                          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${
                            rule.isEnabled ? "translate-x-4.5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {rule.isEnabled && (
                      <div className="space-y-2 animate-in slide-in-from-top-1 duration-150">
                        <textarea
                          rows={3}
                          value={rule.template}
                          onChange={(e) => handleTemplateChange(key, e.target.value)}
                          className="w-full p-4 rounded-xl bg-white border border-[#e0e0e0] text-[13px] font-mono text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]"
                        />
                        <div className="flex items-center gap-1.5 text-[11px] text-[#7a7a7a] font-bold pl-1">
                          <Info size={12} className="text-[#0066cc]" />
                          <span>{meta.place}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Guide & Help */}
        <div className="space-y-6">
          <div className="sticky top-6 bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#f5f5f7] pb-3 text-[#1d1d1f] font-bold text-[14px]">
              <HelpCircle size={15} className="text-[#0066cc]" />
              <span>Giải thích biến thay thế</span>
            </div>
            
            <div className="space-y-4 text-[12.5px] text-slate-600 leading-relaxed font-medium">
              <p>
                Sử dụng các biến nằm trong ngoặc nhọn `{` `}` để hệ thống tự điền dữ liệu thực tế khi có thông báo sự kiện phát sinh.
              </p>
              
              <div className="space-y-2 bg-[#f5f5f7] p-4.5 rounded-2xl border border-[#e0e0e0]">
                <span className="text-[10px] font-black uppercase text-[#0066cc] block leading-none mb-2">Các biến hệ thống:</span>
                <ul className="space-y-1.5 font-mono text-[11.5px] text-slate-700 font-bold list-disc pl-4.5">
                  <li><code>{`{orderNumber}`}</code>: Mã số đơn hàng</li>
                  <li><code>{`{customerName}`}</code>: Tên khách hàng</li>
                  <li><code>{`{totalAmount}`}</code>: Tổng tiền thanh toán</li>
                  <li><code>{`{saleChannel}`}</code>: Kênh bán hàng</li>
                  <li><code>{`{claimNumber}`}</code>: Mã phiếu bảo hành</li>
                  <li><code>{`{productName}`}</code>: Tên sản phẩm thiết bị</li>
                  <li><code>{`{serialNumber}`}</code>: Mã Serial thiết bị</li>
                  <li><code>{`{profit}`}</code>: Lợi nhuận đơn hàng</li>
                </ul>
              </div>

              <div className="p-3.5 bg-amber-50/50 border border-amber-200/50 rounded-2xl flex items-start gap-2 text-[11px] text-[#b7791f]">
                <Info size={14} className="shrink-0 mt-0.5" />
                <span className="font-semibold leading-normal">
                  Telegram Bot hỗ trợ định dạng thẻ HTML của Telegram như &lt;b&gt;&lt;/b&gt;, &lt;i&gt;&lt;/i&gt;, và &lt;code&gt;&lt;/code&gt;.
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
