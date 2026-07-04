"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQuotationsList, createQuotation, convertQuotationToOrder } from "@/app/actions/quotations";
import { GlassCard } from "@/components/ui/glass-card";
import { 
  Search, Plus, Copy, ShoppingCart, Landmark, Eye, Loader2
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { QUOTATION_STATUS } from "@/lib/constants";

export default function QuotationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Modals
  const [isQuotationOpen, setIsQuotationOpen] = useState(false);
  const [selectedConvertQuote, setSelectedConvertQuote] = useState<any>(null);
  
  // Conversion state
  const [initialPayment, setInitialPayment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "card">("cash");

  // Queries
  const { data: quotationsData, isLoading: isLoadingQuotations } = useQuery({
    queryKey: ["quotations"],
    queryFn: getQuotationsList,
  });

  // Mutations
  const createQuotationMutation = useMutation({
    mutationFn: createQuotation,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["quotations"] });
        setIsQuotationOpen(false);
      } else {
        toast.error(res.message);
      }
    }
  });

  const convertQuotationMutation = useMutation({
    mutationFn: (payload: { quotationId: string; data: any }) => 
      convertQuotationToOrder(payload.quotationId, payload.data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["quotations"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        setSelectedConvertQuote(null);
        setInitialPayment("");
      } else {
        toast.error(res.message);
      }
    }
  });

  const handleQuotationSubmit = (data: any) => {
    createQuotationMutation.mutate(data);
  };

  const handleConvertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvertQuote) return;

    convertQuotationMutation.mutate({
      quotationId: selectedConvertQuote.id,
      data: {
        initialPaymentAmount: initialPayment || "0",
        paymentMethod,
      }
    });
  };

  // Copy shareable link to clipboard
  const handleCopyLink = (shareToken: string) => {
    const origin = window.location.origin;
    const shareUrl = `${origin}/quotations/share/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Đã sao chép link báo giá gửi khách!");
  };

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(price) || 0);
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

  // Filtering Logic
  const filteredQuotations = quotationsData?.filter(q => {
    const matchesSearch = 
      q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
      (q.customerName && q.customerName.toLowerCase().includes(search.toLowerCase())) ||
      (q.customerPhone && q.customerPhone.includes(search));
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "draft" ? (q.status === "draft" || q.status === "sent") : q.status === statusFilter);
    return matchesSearch && matchesStatus;
  });



  return (
    <div className="space-y-8 pb-10">
      
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-start pb-6 border-b border-[#e0e0e0]">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]" size={14} />
            <input 
              type="text" 
              placeholder="Tìm số báo giá, khách hàng..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-[40px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-medium text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all placeholder:text-[#7a7a7a]/60"
            />
          </div>

          <button 
            onClick={() => setIsQuotationOpen(true)}
            className="flex items-center gap-1.5 px-5 h-[40px] bg-[#0066cc] text-white text-[13px] font-medium rounded-full hover:bg-[#0071e3] transition-all cursor-pointer shadow-sm active:scale-95 duration-200"
          >
            <Plus size={14} />
            <span>Tạo Báo Giá</span>
          </button>
        </div>


      {/* Filter Tabs & Table Workspace */}
      <div className="space-y-4">
        {/* Apple Segmented Control Filter Tabs */}
        <div className="flex overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none relative z-10">
          <div className="flex bg-[#f5f5f7] p-[3px] rounded-full text-[12.5px] border border-[#e0e0e0] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.03)] gap-1 min-w-max select-none">
            {["all", "draft", "viewed", "accepted", "rejected", "converted"].map((st) => {
              const labelMap: Record<string, string> = {
                all: "Tất cả",
                draft: "Nháp / Chưa xem",
                viewed: "Khách đã xem",
                accepted: "Khách đồng ý",
                rejected: "Khách từ chối",
                converted: "Đã chuyển thành đơn hàng",
              };
              const isActive = statusFilter === st;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-4.5 py-1.5 rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center active:scale-[0.98] ${
                    isActive 
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]" 
                      : "text-slate-600 hover:text-slate-900 font-semibold"
                  }`}
                >
                  {labelMap[st]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main List Table */}
        <GlassCard className="p-0 overflow-hidden shadow-sm">
          {isLoadingQuotations ? (
            <div className="p-20 text-center flex flex-col items-center justify-center text-[#7a7a7a]">
              <Loader2 className="animate-spin mb-3 text-[#0066cc]" size={26} />
              <p className="text-[14px]">Đang kết nối cơ sở dữ liệu báo giá...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e0e0e0] bg-[#f5f5f7]/50 text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                    <th className="px-6 py-4 w-12 text-center whitespace-nowrap">STT</th>
                    <th className="px-6 py-4 w-40 whitespace-nowrap">Mã Báo Giá</th>
                    <th className="px-6 py-4 whitespace-nowrap">Khách Hàng</th>
                    <th className="px-6 py-4 w-32 text-right whitespace-nowrap">Tổng Tiền</th>
                    <th className="px-6 py-4 w-36 text-center whitespace-nowrap">Trạng Thái</th>
                    <th className="px-6 py-4 w-28 text-center whitespace-nowrap">Lượt Xem</th>
                    <th className="px-6 py-4 w-40 text-right whitespace-nowrap">Tác Vụ</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-[#1d1d1f]">
                  {filteredQuotations?.map((q, index) => {
                    const badge = QUOTATION_STATUS[q.status as keyof typeof QUOTATION_STATUS] || { label: q.status, color: "bg-slate-100 text-slate-700" };
                    return (
                      <tr key={q.id} className="border-b border-[#e0e0e0] last:border-0 hover:bg-[#f5f5f7]/40 transition-colors">
                        <td className="px-6 py-5 text-center font-semibold text-[#7a7a7a] whitespace-nowrap">{index + 1}</td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <p className="font-semibold text-slate-800 tracking-tight leading-none mb-1">{q.quoteNumber}</p>
                          <span className="text-[11px] font-bold text-slate-400 tracking-tight">{formatToDDMMYYYY(q.createdAt)}</span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <p className="font-semibold">{q.customerName || "Khách lẻ vãng lai"}</p>
                          <p className="text-[12px] text-[#7a7a7a] font-semibold mt-0.5">{q.customerPhone || "N/A"}</p>
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-[#0066cc] whitespace-nowrap">
                          {formatPrice(q.totalAmount)}
                        </td>
                        <td className="px-6 py-5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center font-semibold text-[#515154] whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Eye size={12} className="text-slate-400" />
                            <span>{q.viewCount}</span>
                          </div>
                          {q.lastViewedAt && (
                            <span className="text-[9px] block text-[#7a7a7a] mt-0.5 font-bold">
                              {new Date(q.lastViewedAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Copy Shareable Link */}
                            <button
                              type="button"
                              onClick={() => handleCopyLink(q.shareToken)}
                              className="w-8 h-8 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#4b5563] hover:text-slate-900 flex items-center justify-center cursor-pointer border border-[#e0e0e0] transition-all active:scale-95 duration-150"
                              title="Sao chép link gửi khách"
                            >
                              <Copy size={14} />
                            </button>

                            {/* Public Link Preview */}
                            <a
                              href={`/quotations/share/${q.shareToken}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-8 h-8 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#0066cc] hover:text-[#0071e3] flex items-center justify-center cursor-pointer border border-[#e0e0e0] transition-all active:scale-95 duration-150"
                              title="Xem trang báo giá điện tử"
                            >
                              <Eye size={14} />
                            </a>

                            {/* Convert to Order trigger */}
                            {q.status !== "converted" ? (
                              <button
                                type="button"
                                onClick={() => setSelectedConvertQuote(q)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border transition-all active:scale-95 duration-150 ${
                                  q.status === "accepted" 
                                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 border-emerald-200/50" 
                                    : "bg-blue-50 hover:bg-blue-100 text-[#0066cc] hover:text-[#0071e3] border-blue-200/30"
                                }`}
                                title="Tạo đơn hàng từ báo giá"
                              >
                                <ShoppingCart size={14} />
                              </button>
                            ) : (
                              <a
                                href={`/orders?search=${q.convertedOrderNumber || ""}`}
                                className="px-2 h-8 rounded-lg text-[11px] font-bold text-slate-500 bg-[#f5f5f7] hover:bg-[#e8e8ed] hover:text-slate-800 border border-[#e0e0e0] transition-all duration-150 active:scale-95 flex items-center justify-center gap-1"
                                title={`Xem đơn hàng ${q.convertedOrderNumber || ""}`}
                              >
                                <ShoppingCart size={11} className="text-slate-400" />
                                <span>#{q.convertedOrderNumber?.split('-').pop() || ""}</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredQuotations?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-[#7a7a7a]">Không tìm thấy dữ liệu báo giá nào phù hợp.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {/* MODAL 1: Quotation Creation Form */}
      <Dialog
        isOpen={isQuotationOpen}
        onClose={() => setIsQuotationOpen(false)}
        title="Tạo báo giá mới"
        
        size="7xl"
      >
        <QuotationForm
          onSubmit={handleQuotationSubmit}
          onCancel={() => setIsQuotationOpen(false)}
          isLoading={createQuotationMutation.isPending}
        />
      </Dialog>

      {/* MODAL 2: 1-Click Convert to Retail Order */}
      <Dialog
        isOpen={!!selectedConvertQuote}
        onClose={() => setSelectedConvertQuote(null)}
        title="Chuyển đổi báo giá thành đơn hàng"
        description={`Đơn hàng sẽ tự động được tạo ${selectedConvertQuote?.quoteNumber || ""}.`}
        size="md"
      >
        {selectedConvertQuote && (
          <form onSubmit={handleConvertSubmit} className="space-y-4 font-sans">
            <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-[#1d1d1f]">{selectedConvertQuote.customerName || "Khách lẻ"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-bold text-[#1d1d1f]">{selectedConvertQuote.customerPhone || "N/A"}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-[15px] font-bold">
                <span>Tổng giá trị đơn báo:</span>
                <span className="text-[#0066cc]">{formatPrice(selectedConvertQuote.totalAmount)}</span>
              </div>
            </div>

            {/* Khách đã trả trước */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider pl-1 flex items-center gap-1">
                <Landmark size={12} /> Số tiền đã cọc
              </label>
              <input
                type="text"
                value={initialPayment ? new Intl.NumberFormat("vi-VN").format(Number(initialPayment)) : ""}
                onChange={(e) => setInitialPayment(e.target.value.replace(/\D/g, ""))}
                placeholder="Để trống nếu chưa trả trước"
                className="w-full h-[44px] px-3.5 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0066cc]"
              />
            </div>

            {/* Phương thức thanh toán */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider pl-1">
                Phương thức thanh toán cọc
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "cash", label: "Tiền mặt" },
                  { value: "bank_transfer", label: "Chuyển khoản" },
                  { value: "card", label: "Cà thẻ" },
                ].map((pm) => (
                  <button
                    key={pm.value}
                    type="button"
                    onClick={() => setPaymentMethod(pm.value as any)}
                    className={`h-[40px] rounded-lg text-[13px] font-bold border transition-all cursor-pointer ${
                      paymentMethod === pm.value 
                        ? "bg-[#0066cc] text-white border-[#0066cc]" 
                        : "bg-[#f5f5f7] hover:bg-[#e8e8ed] text-slate-800 border-slate-200"
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSelectedConvertQuote(null)}
                className="px-4 h-[40px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] rounded-lg text-[13px] font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={convertQuotationMutation.isPending}
                className="px-5 h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-bold cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {convertQuotationMutation.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Đang tạo đơn...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={13} /> Tạo đơn bán hàng
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Dialog>

    </div>
  );
}
