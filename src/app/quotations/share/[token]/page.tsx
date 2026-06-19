"use client";

import { use, useState, useEffect } from "react";
import { getQuotationByToken, incrementQuotationViewCount, updateQuotationStatus } from "@/app/actions/quotations";
import { 
  FileText, Calendar, User, Phone, MapPin, CheckCircle, XCircle, ChevronRight, Eye, RefreshCw
} from "lucide-react";
import { toast, Toaster } from "sonner";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default function PublicQuotationSharePage({ params }: SharePageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<string>("draft");
  
  // Confetti / Celebration trigger
  const [showCelebration, setShowCelebration] = useState(false);

  const fetchQuotationData = async () => {
    try {
      const res = await getQuotationByToken(token);
      if (res.success && res.quotation) {
        setData(res);
        setStatus(res.quotation.status);
        
        // Tăng viewCount tự động ngầm
        await incrementQuotationViewCount(res.quotation.id);
      } else {
        toast.error(res.message || "Không thể tải báo giá");
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi tải báo giá");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotationData();
  }, [token]);

  const handleResponse = async (newStatus: "accepted" | "rejected") => {
    if (!data?.quotation?.id) return;
    
    setLoading(true);
    try {
      const res = await updateQuotationStatus(data.quotation.id, newStatus);
      if (res.success) {
        setStatus(newStatus);
        toast.success(res.message);
        if (newStatus === "accepted") {
          setShowCelebration(true);
        }
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: string | number) => {
    return Math.round(Number(price || 0)).toLocaleString("vi-VN") + " ₫";
  };

  const formatToDDMMYYYY = (dateString: string | Date | null) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center text-[#7a7a7a]">
        <RefreshCw className="animate-spin mb-3 text-[#0066cc]" size={28} />
        <p className="text-[14px] font-bold text-[#1d1d1f]">Đang kết xuất báo giá điện tử...</p>
        <p className="text-[12px] text-[#7a7a7a] mt-0.5">Vui lòng đợi giây lát</p>
      </div>
    );
  }

  if (!data?.quotation) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center text-center p-6">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 border border-red-200 flex items-center justify-center mb-4">
          <XCircle size={26} />
        </div>
        <h3 className="text-[16px] font-bold text-[#1d1d1f]">Không tìm thấy báo giá</h3>
        <p className="text-[13px] text-[#7a7a7a] max-w-xs mt-1.5 leading-relaxed">
          Đường liên kết đã hết hiệu lực, hoặc báo giá đã bị thu hồi khỏi hệ thống. Vui lòng liên hệ nhân viên cửa hàng.
        </p>
      </div>
    );
  }

  const { quotation, items, storeSettings } = data;

  const getVietQrUrl = () => {
    if (!storeSettings?.bankName || !storeSettings?.bankAccount) return null;
    const bank = encodeURIComponent(storeSettings.bankName.trim());
    const account = encodeURIComponent(storeSettings.bankAccount.trim());
    const amount = Math.round(Number(quotation.totalAmount));
    const info = encodeURIComponent(`Thanh toan ${quotation.quoteNumber}`);
    const name = encodeURIComponent(storeSettings.bankOwner || "");
    return `https://img.vietqr.io/image/${bank}-${account}-compact2.png?amount=${amount}&addInfo=${info}&accountName=${name}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#f4f7fb] via-[#f5f5f7] to-[#eef2f7] font-sans antialiased text-[#1d1d1f] flex flex-col items-center py-10 px-4 md:py-16 selection:bg-[#0066cc]/10 relative overflow-x-hidden">
      <Toaster position="top-center" richColors />
      
      {/* Premium colorful background glow spheres */}
      <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] rounded-full bg-[#0066cc]/4 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-20%] w-[500px] h-[500px] rounded-full bg-[#34c759]/4 blur-[120px] pointer-events-none" />
      
      {/* Background celebration styling */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
          <div className="absolute w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-ping" />
          <div className="absolute w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none animate-pulse" />
        </div>
      )}

      {/* Main voucher slip container */}
      <div className="w-full max-w-[640px] space-y-6 relative z-10">
        
        {/* Apple Premium Invoice Voucher Card */}
        <div className="bg-white rounded-[32px] border border-[#e2e8f0]/80 shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative overflow-hidden flex flex-col">
          
          {/* Header Accent Gradient */}
          <div className="h-2 w-full bg-gradient-to-r from-[#0066cc] via-[#5ac8fa] to-[#34c759]" />

          <div className="p-6 md:p-8 space-y-6 flex-1">
            
            {/* Voucher Header Block */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#0066cc] to-[#0088ff] flex items-center justify-center shadow-md">
                    <FileText className="text-white" size={13} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#0066cc] leading-none">
                    {storeSettings?.storeName || "TechStore ERP"}
                  </span>
                </div>
                <h2 className="text-[24px] font-black tracking-tight leading-none text-[#1d1d1f]">
                  BÁO GIÁ ĐIỆN TỬ
                </h2>
                <p className="text-[12px] font-bold text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded-md inline-block">
                  Số: {quotation.quoteNumber}
                </p>
              </div>

              {/* Status Indicator */}
              {(() => {
                let badge = { label: "Báo giá nháp", bg: "bg-slate-50 border-slate-200", text: "text-slate-600" };
                if (status === "viewed" || status === "sent") {
                  badge = { label: "Đang chờ duyệt", bg: "bg-blue-50 border-blue-200/50", text: "text-blue-700" };
                } else if (status === "accepted") {
                  badge = { label: "Đã duyệt mua", bg: "bg-emerald-50 border-emerald-200/50", text: "text-emerald-700" };
                } else if (status === "rejected") {
                  badge = { label: "Đã từ chối", bg: "bg-rose-50 border-rose-200/50", text: "text-rose-700" };
                } else if (status === "converted") {
                  badge = { label: "Đã lên hóa đơn", bg: "bg-violet-50 border-violet-200/50", text: "text-violet-700" };
                }

                return (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold border shadow-sm ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                );
              })()}
            </div>

            {/* Customer Details Block */}
            <div className="p-5 bg-gradient-to-br from-slate-50 to-[#f8fafc] border border-slate-100 rounded-3xl grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] text-[#515154] shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white border border-slate-200/60 flex items-center justify-center shadow-sm">
                    <User size={13} className="text-[#0066cc]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[#9f9f9f] font-bold whitespace-nowrap">Khách hàng</span>
                    <strong className="text-[#1d1d1f] font-extrabold text-[13.5px] whitespace-nowrap">{quotation.customerName || "Khách mua lẻ"}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white border border-slate-200/60 flex items-center justify-center shadow-sm">
                    <Phone size={13} className="text-[#0066cc]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[#9f9f9f] font-bold whitespace-nowrap">Số điện thoại</span>
                    <strong className="text-[#1d1d1f] font-bold whitespace-nowrap">{quotation.customerPhone || "N/A"}</strong>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white border border-slate-200/60 flex items-center justify-center shadow-sm">
                    <Calendar size={13} className="text-slate-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[#9f9f9f] font-bold whitespace-nowrap">Ngày lập báo giá</span>
                    <strong className="text-[#1d1d1f] whitespace-nowrap">{formatToDDMMYYYY(quotation.createdAt)}</strong>
                  </div>
                </div>
                {quotation.validUntil && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shadow-sm">
                      <Calendar size={13} className="text-rose-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-[#9f9f9f] font-bold whitespace-nowrap">Hạn chấp nhận</span>
                      <strong className="text-rose-600 font-extrabold whitespace-nowrap">{formatToDDMMYYYY(quotation.validUntil)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dotted tearing line simulation (Khía răng cưa) */}
            <div className="relative h-px border-b-2 border-dashed border-[#e2e8f0] my-4">
              <div className="absolute -left-[41px] -top-2.5 w-5 h-5 bg-[#f4f7fb] border border-[#e2e8f0] rounded-full z-10 shadow-[inset_-3px_0_5px_rgba(0,0,0,0.03)]" />
              <div className="absolute -right-[41px] -top-2.5 w-5 h-5 bg-[#eef2f7] border border-[#e2e8f0] rounded-full z-10 shadow-[inset_3px_0_5px_rgba(0,0,0,0.03)]" />
            </div>

            {/* Quotation items table */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-black text-[#86868b] uppercase tracking-widest pl-1">
                Danh mục thiết bị đề xuất ({items.length})
              </h4>

              <div className="space-y-4">
                {items.map((item: any, idx: number) => {
                  // 1. Split text notes from media suffix
                  let displayNotes = item.notes || "";
                  let customMediaList: string[] = [];
                  
                  if (item.notes && item.notes.includes(" ||media: ")) {
                    const parts = item.notes.split(" ||media: ");
                    displayNotes = parts[0];
                    if (parts[1]) {
                      customMediaList = parts[1]
                        .split(",")
                        .map((u: string) => u.trim())
                        .filter(Boolean);
                    }
                  }

                  // 2. Consolidate all images & videos (item images, product images, and quote-specific custom links)
                  const allMedia = Array.from(
                    new Set([
                      ...(item.itemImages || []),
                      ...(item.productImages || []),
                      ...customMediaList,
                    ])
                  ).filter(Boolean);

                  // 3. Classify url type (photo or video)
                  const isVideoUrl = (url: string) => {
                    const cleanUrl = url.toLowerCase().split("?")[0];
                    return (
                      cleanUrl.endsWith(".mp4") ||
                      cleanUrl.endsWith(".mov") ||
                      cleanUrl.endsWith(".avi") ||
                      cleanUrl.endsWith(".webm") ||
                      cleanUrl.includes("youtube.com") ||
                      cleanUrl.includes("youtu.be") ||
                      cleanUrl.includes("/video/") ||
                      cleanUrl.includes("telegram.org/file/") ||
                      (url.includes("t.me/") && !url.match(/\.(jpg|jpeg|png|gif|webp)$/i))
                    );
                  };

                  const getEmbedUrl = (url: string) => {
                    if (url.includes("youtube.com") || url.includes("youtu.be")) {
                      let videoId = "";
                      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                      const match = url.match(regExp);
                      if (match && match[2].length === 11) {
                        videoId = match[2];
                      }
                      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
                    }
                    return url;
                  };

                  // Parse specifications into individual pills
                  const specList = item.productSpecs
                    ? (typeof item.productSpecs === "string" 
                        ? item.productSpecs.split(/[\/\•]/).map((s: string) => s.trim())
                        : [
                            item.productSpecs.cpu,
                            item.productSpecs.ram ? `RAM ${item.productSpecs.ram}` : null,
                            item.productSpecs.ssd ? `SSD ${item.productSpecs.ssd}` : null,
                            item.productSpecs.gpu,
                            item.productSpecs.screen,
                          ].filter(Boolean)
                      )
                    : [];

                  return (
                    <div 
                      key={item.id} 
                      className="p-5 bg-white hover:bg-[#fafafc] border border-slate-200/60 rounded-3xl flex flex-col gap-4 transition-all duration-300 hover:shadow-md group relative"
                    >
                      {/* Product details and price card */}
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] font-black text-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc]/10 px-2 py-0.5 rounded-md mt-0.5 shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <h5 className="text-[15px] font-black text-[#1d1d1f] tracking-tight leading-snug">
                              {item.productName}
                            </h5>
                          </div>

                          {/* Specifications Tag Pills */}
                          {specList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pl-8 pt-0.5">
                              {specList.map((spec: string, specIdx: number) => (
                                <span 
                                  key={specIdx}
                                  className="text-[10.5px] font-bold text-slate-600 bg-slate-100 border border-slate-200/40 px-2.5 py-0.5 rounded-full select-all"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          )}

                          {displayNotes && (
                            <p className="text-[11px] text-slate-500 pl-8 italic">
                              * Ghi chú: {displayNotes}
                            </p>
                          )}
                        </div>
                        
                        <div className="sm:text-right shrink-0 pl-8 sm:pl-0 w-full sm:w-auto flex sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1">
                          <span className="text-[9.5px] font-black text-[#86868b] uppercase tracking-wider sm:hidden">Đơn giá</span>
                          <div className="bg-[#0066cc]/5 border border-[#0066cc]/10 rounded-2xl px-3.5 py-1.5 flex items-center justify-center shadow-inner">
                            <span className="font-sans font-black text-[#0066cc] text-[17px] tracking-tight">
                              {formatPrice(item.quotedPrice)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Render snap media carousel if images or videos are available */}
                      {allMedia.length > 0 && (
                        <div className="pl-8 pt-1">
                          <div className="flex gap-3 overflow-x-auto snap-x scrollbar-none pb-1">
                            {allMedia.map((url: any, mediaIdx: number) => {
                              const isVideo = isVideoUrl(url);
                              const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");

                              return (
                                <div 
                                  key={mediaIdx} 
                                  className="snap-center shrink-0 w-[240px] sm:w-[280px] aspect-video bg-black rounded-2xl overflow-hidden shadow-sm relative group border border-slate-200/60"
                                >
                                  {isVideo ? (
                                    isYoutube ? (
                                      <iframe
                                        src={getEmbedUrl(url)}
                                        className="w-full h-full border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    ) : (
                                      <video
                                        src={url}
                                        controls
                                        className="w-full h-full object-cover"
                                        preload="metadata"
                                      />
                                    )
                                  ) : (
                                    <img
                                      src={url}
                                      alt={`${item.productName} preview ${mediaIdx + 1}`}
                                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                                      onClick={() => window.open(url, '_blank')}
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <span className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md text-white text-[8.5px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider leading-none">
                                    {isVideo ? "▶ Video" : "📷 Ảnh"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Premium receipt summary box */}
            <div className="p-5 bg-gradient-to-br from-[#f8fafc] to-slate-100 border border-slate-200/60 rounded-3xl space-y-3.5 shadow-inner">
              <div className="flex justify-between items-center text-[13px] text-slate-500 font-semibold pl-1">
                <span>Tổng tiền thiết bị niêm yết:</span>
                <span className="font-bold text-[#1d1d1f] text-[14px]">{formatPrice(quotation.subtotal)}</span>
              </div>
              {Number(quotation.discountAmount) > 0 && (
                <div className="flex justify-between items-center text-[13px] text-rose-500 font-bold pl-1 border-t border-slate-200/40 pt-2.5">
                  <span>Chiết khấu giảm giá thương lượng:</span>
                  <span className="text-[14px] bg-rose-50 border border-rose-100/50 px-2 py-0.5 rounded-lg">-{formatPrice(quotation.discountAmount)}</span>
                </div>
              )}
              
              <div className="pt-3.5 border-t-2 border-slate-300/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 pl-1">
                <span className="text-[11px] font-black text-[#1d1d1f] uppercase tracking-widest">TỔNG THANH TOÁN THỰC TẾ:</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[28px] sm:text-[34px] font-black text-[#0066cc] tracking-tight leading-none">
                    {formatPrice(quotation.totalAmount).replace(" ₫", "")}
                  </span>
                  <span className="text-[17px] font-black text-[#0066cc]">₫</span>
                </div>
              </div>
            </div>

            {/* Quote public terms notes */}
            {quotation.notes && (
              <div className="p-5 bg-gradient-to-br from-blue-50/20 to-indigo-50/10 border border-[#0066cc]/10 rounded-3xl space-y-2 text-[13px] font-semibold text-[#515154] shadow-sm">
                <span className="text-[10px] font-black text-[#0066cc] uppercase tracking-widest block">Điều khoản đi kèm</span>
                <p className="leading-relaxed whitespace-pre-line text-[12.5px]">
                  {quotation.notes}
                </p>
              </div>
            )}

            {/* Interactive Feedback buttons block (Only active when in pending states) */}
            {(status === "draft" || status === "viewed" || status === "sent") ? (
              <div className="pt-6 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => handleResponse("accepted")}
                    className="flex-1 h-[52px] bg-gradient-to-r from-[#34c759] to-[#2eb14f] hover:from-[#2eb14f] hover:to-[#289a44] text-white rounded-full text-[14px] font-black transition-all cursor-pointer shadow-[0_8px_20px_rgba(52,199,89,0.25)] hover:shadow-[0_12px_24px_rgba(52,199,89,0.35)] hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle size={16} /> Duyệt & Đồng ý mua
                  </button>
                  <button
                    onClick={() => handleResponse("rejected")}
                    className="flex-1 h-[52px] bg-rose-600 hover:bg-rose-700 text-white rounded-full text-[14px] font-black transition-all cursor-pointer shadow-[0_8px_20px_rgba(225,29,72,0.15)] hover:shadow-[0_12px_24px_rgba(225,29,72,0.25)] hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={16} /> Từ chối / Yêu cầu sửa
                  </button>
                </div>
                <p className="text-[10.5px] text-[#7a7a7a] text-center font-bold max-w-sm mx-auto leading-relaxed mt-2">
                  Bằng cách nhấn **Duyệt**, hệ thống ERP sẽ tự động thông báo và giữ hàng chiếc máy này cho bạn trong thời gian chờ lập hóa đơn chính thức.
                </p>
              </div>
            ) : (
              /* Success / Failure visual banner when already responded */
              <div className="pt-6 border-t border-slate-100 text-center animate-scale-up">
                {status === "accepted" && (
                  <div className="space-y-4 w-full">
                    <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-3xl flex flex-col items-center gap-2.5 shadow-sm">
                      <CheckCircle className="text-[#34c759]" size={26} />
                      <h5 className="text-[15px] font-black text-emerald-800">ĐÃ CHẤP NHẬN BÁO GIÁ THÀNH CÔNG</h5>
                      <p className="text-[13px] text-emerald-700 leading-relaxed max-w-xs font-semibold">
                        Cảm ơn bạn đã phê duyệt báo giá này. Nhân viên cửa hàng sẽ liên hệ lập tức để hoàn tất giao dịch.
                      </p>
                    </div>

                    {/* Hộp thanh toán VietQR động */}
                    {storeSettings?.bankAccount && storeSettings?.bankName && (
                      <div className="p-6 bg-[#f8fafc] border border-slate-200/80 rounded-3xl flex flex-col items-center gap-4 text-center animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm w-full">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-[#0066cc] uppercase tracking-widest block">Thanh toán chuyển khoản nhanh</span>
                          <h6 className="text-[14px] font-black text-[#1d1d1f]">Quét Mã QR Để Thanh Toán Đơn Hàng</h6>
                        </div>
                        
                        {/* VietQR dynamic image wrapper with Apple card aesthetics */}
                        <div className="w-[200px] h-[200px] bg-white p-2 rounded-2xl border border-slate-200 shadow-md flex items-center justify-center relative overflow-hidden group">
                          <img 
                            src={getVietQrUrl() || ""} 
                            alt="VietQR Payment Code" 
                            className="w-full h-full object-contain"
                          />
                        </div>

                        {/* Bank account credentials details */}
                        <div className="w-full space-y-2 text-[12.5px] font-semibold text-slate-600 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <div className="flex justify-between border-b pb-1.5 border-slate-100 gap-4">
                            <span className="whitespace-nowrap">Ngân hàng:</span>
                            <strong className="text-[#1d1d1f] uppercase whitespace-nowrap">{storeSettings.bankName}</strong>
                          </div>
                          <div className="flex justify-between border-b pb-1.5 border-slate-100 gap-4">
                            <span className="whitespace-nowrap">Số tài khoản:</span>
                            <strong className="text-[#1d1d1f] font-mono select-all whitespace-nowrap">{storeSettings.bankAccount}</strong>
                          </div>
                          <div className="flex justify-between border-b pb-1.5 border-slate-100 gap-4">
                            <span className="whitespace-nowrap">Chủ tài khoản:</span>
                            <strong className="text-[#1d1d1f] uppercase whitespace-nowrap">{storeSettings.bankOwner || "N/A"}</strong>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="whitespace-nowrap">Nội dung chuyển khoản:</span>
                            <strong className="text-[#0066cc] font-mono select-all whitespace-nowrap">Thanh toan {quotation.quoteNumber}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {status === "rejected" && (
                  <div className="p-5 bg-rose-50 border border-rose-200 rounded-3xl flex flex-col items-center gap-2.5 shadow-sm">
                    <XCircle className="text-rose-600" size={26} />
                    <h5 className="text-[15px] font-black text-rose-800 font-sans">BÁO GIÁ ĐÃ BỊ TỪ CHỐI</h5>
                    <p className="text-[13px] text-rose-700 leading-relaxed max-w-xs font-semibold">
                      Bạn đã từ chối bản báo giá này. Chúng tôi rất tiếc và sẽ liên hệ để đưa ra đề xuất tốt hơn.
                    </p>
                  </div>
                )}
                {status === "converted" && (
                  <div className="p-5 bg-violet-50 border border-violet-200 rounded-3xl flex flex-col items-center gap-2.5 shadow-sm">
                    <CheckCircle className="text-violet-600" size={26} />
                    <h5 className="text-[15px] font-black text-violet-800">ĐÃ CHUYỂN THÀNH ĐƠN HÀNG BÁN LẺ</h5>
                    <p className="text-[13px] text-violet-700 leading-relaxed max-w-xs font-semibold">
                      Bản báo giá này đã được cất thành Hóa đơn bán lẻ chính thức và bàn giao máy thành công.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Custom thank you invoice footer */}
        {storeSettings?.invoiceFooter && (
          <p className="text-[12px] text-slate-500 font-medium text-center leading-relaxed max-w-md mx-auto whitespace-pre-line italic mt-2">
            &ldquo;{storeSettings.invoiceFooter}&rdquo;
          </p>
        )}

        {/* Footer info text */}
        <p className="text-[11px] text-[#7a7a7a] font-bold text-center leading-normal mt-4">
          Bản báo giá điện tử bảo mật được khởi tạo bởi nhân viên {quotation.creatorName || "Cửa hàng"}.<br />
          {storeSettings?.storePhone && `Hotline: ${storeSettings.storePhone}`}
          {storeSettings?.storeEmail && ` • Email: ${storeSettings.storeEmail}`}
          {!storeSettings?.storePhone && "Mọi thắc mắc vui lòng liên hệ hotline hỗ trợ."} TechStore ERP v1.0
        </p>

      </div>
    </div>
  );
}
