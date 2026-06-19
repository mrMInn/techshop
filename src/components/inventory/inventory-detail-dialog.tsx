import { Dialog } from "@/components/ui/dialog";
import { 
  SFSymbolCPU, 
  SFSymbolMemoryChip, 
  SFSymbolInternalDrive, 
  SFSymbolDisplay,
} from "@/components/ui/apple-icons";

interface InventoryDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
}

export function InventoryDetailDialog({ isOpen, onClose, item }: InventoryDetailDialogProps) {
  if (!item) return null;

  const formatPrice = (price: number | string | null) => {
    if (price === null || price === undefined || price === "") return "N/A";
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

  const getStatusLabel = (status: string) => {
    const statusConfig: Record<string, string> = {
      in_stock: "Sẵn hàng",
      incoming: "Đang về",
      sold: "Đã bán",
      warranty_repair: "Bảo hành",
      returned: "Đã trả NCC",
      defective: "Lỗi",
      deleted: "Đã xóa",
    };
    return statusConfig[status] || status;
  };

  const specs = item.productSpecs as { cpu?: string; ram?: string; ssd?: string; screen?: string } | null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Thông tin chi tiết"
      description={`Mã máy: ${item.serialNumber} • ${item.productName}`}
      size="2xl"
    >
      <div className="space-y-6">
        {/* Tab 1: Details */}
        <div className="space-y-5 pt-1">

          {/* Section: Sản phẩm */}
          <div className="bg-white border border-[#e0e0e0] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-[#f5f5f7] border-b border-[#e0e0e0]">
              <span className="text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider">Sản phẩm</span>
            </div>
            <div className="divide-y divide-[#e8e8ed]">
              <div className="px-5 py-3.5 flex justify-between items-center">
                <span className="text-[13px] text-[#7a7a7a]">Tên sản phẩm</span>
                <span className="text-[14px] font-semibold text-[#1d1d1f] text-right max-w-[60%]">{item.productName}</span>
              </div>
              <div className="px-5 py-3.5 flex justify-between items-center">
                <span className="text-[13px] text-[#7a7a7a]">Thương hiệu</span>
                <span className="text-[14px] font-medium text-[#1d1d1f]">{item.brandName} • {item.categoryName}</span>
              </div>
              <div className="px-5 py-3.5 flex justify-between items-center">
                <span className="text-[13px] text-[#7a7a7a]">Số Serial</span>
                <span className="text-[14px] font-semibold text-[#1d1d1f] select-all">{item.serialNumber}</span>
              </div>
              {item.productSku && (
                <div className="px-5 py-3.5 flex justify-between items-center">
                  <span className="text-[13px] text-[#7a7a7a]">SKU</span>
                  <span className="text-[14px] font-medium text-[#7a7a7a]">{item.productSku}</span>
                </div>
              )}
              <div className="px-5 py-3.5 flex justify-between items-center">
                <span className="text-[13px] text-[#7a7a7a]">Tình trạng</span>
                <span className="text-[14px] font-medium text-[#1d1d1f]">{item.condition === "new" ? "Mới 100%" : "Đã dùng (99%)"}</span>
              </div>
              <div className="px-5 py-3.5 flex justify-between items-center">
                <span className="text-[13px] text-[#7a7a7a]">Trạng thái kho</span>
                <span className={`text-[13px] font-semibold px-2.5 py-1 rounded-lg ${
                  item.status === 'in_stock' ? 'text-emerald-600 bg-emerald-50' :
                  item.status === 'sold' ? 'text-red-600 bg-red-50' :
                  item.status === 'incoming' ? 'text-blue-600 bg-blue-50' :
                  item.status === 'warranty_repair' ? 'text-amber-600 bg-amber-50' :
                  item.status === 'defective' ? 'text-red-600 bg-red-50' :
                  'text-[#7a7a7a] bg-[#f5f5f7]'
                }`}>{getStatusLabel(item.status)}</span>
              </div>
            </div>
          </div>

          {/* Section: Cấu hình */}
          {specs && (specs.cpu || specs.ram || specs.ssd || specs.screen) && (
            <div className="bg-white border border-[#e0e0e0] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-[#f5f5f7] border-b border-[#e0e0e0]">
                <span className="text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider">Cấu hình</span>
              </div>
              <div className="divide-y divide-[#e8e8ed]">
                {specs.cpu && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a] flex items-center gap-2">
                      <SFSymbolCPU size={14} className="text-[#0066cc]" /> CPU
                    </span>
                    <span className="text-[14px] font-medium text-[#1d1d1f]">{specs.cpu}</span>
                  </div>
                )}
                {specs.ram && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a] flex items-center gap-2">
                      <SFSymbolMemoryChip size={14} className="text-[#0066cc]" /> RAM
                    </span>
                    <span className="text-[14px] font-medium text-[#1d1d1f]">{specs.ram}</span>
                  </div>
                )}
                {specs.ssd && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a] flex items-center gap-2">
                      <SFSymbolInternalDrive size={14} className="text-[#0066cc]" /> Ổ cứng
                    </span>
                    <span className="text-[14px] font-medium text-[#1d1d1f]">{specs.ssd}</span>
                  </div>
                )}
                {specs.screen && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a] flex items-center gap-2">
                      <SFSymbolDisplay size={14} className="text-[#0066cc]" /> Màn hình
                    </span>
                    <span className="text-[14px] font-medium text-[#1d1d1f]">{specs.screen}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: Giá & Thời gian */}
          <div className="bg-white border border-[#e0e0e0] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-[#f5f5f7] border-b border-[#e0e0e0]">
              <span className="text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider">Giá & Thời gian</span>
            </div>
            <div className="divide-y divide-[#e8e8ed]">
              <div className="px-5 py-3.5 flex justify-between items-center">
                <span className="text-[13px] text-[#7a7a7a]">Giá nhập kho</span>
                <span className="text-[14px] font-semibold text-[#1d1d1f]">{formatPrice(item.costPrice)}</span>
              </div>
              <div className="px-5 py-3.5 flex justify-between items-center">
                <span className="text-[13px] text-[#7a7a7a]">Giá đề xuất bán</span>
                <span className="text-[15px] font-bold text-emerald-600">{formatPrice(item.sellingPrice)}</span>
              </div>
              <div className="px-5 py-3.5 flex justify-between items-center">
                <span className="text-[13px] text-[#7a7a7a]">{item.status === "incoming" ? "Dự kiến về" : "Ngày nhập kho"}</span>
                <span className="text-[14px] font-medium text-[#1d1d1f]">
                  {item.status === "incoming" ? formatDate(item.expectedArrivalDate) : formatDate(item.stockedDate)}
                </span>
              </div>
              {item.expectedArrivalDate && item.stockedDate && (
                <div className="px-5 py-3.5 flex justify-between items-center">
                  <span className="text-[13px] text-[#7a7a7a]">So với dự kiến</span>
                  <span className="text-[13px] font-semibold">
                    {(() => {
                      const diffDays = Math.round((new Date(item.stockedDate).getTime() - new Date(item.expectedArrivalDate).getTime()) / (1000 * 60 * 60 * 24));
                      if (diffDays === 0) return <span className="text-emerald-600">Đúng hẹn</span>;
                      if (diffDays < 0) return <span className="text-emerald-600">Sớm {Math.abs(diffDays)} ngày</span>;
                      return <span className="text-amber-600">Trễ {diffDays} ngày</span>;
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Nhà cung cấp & Vận chuyển (conditional) */}
          {(item.supplierName || item.poNumber || item.trackingNumber || item.shippingMethod) && (
            <div className="bg-white border border-[#e0e0e0] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-[#f5f5f7] border-b border-[#e0e0e0]">
                <span className="text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider">Nhà cung cấp & Vận chuyển</span>
              </div>
              <div className="divide-y divide-[#e8e8ed]">
                {item.supplierName && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a]">Nhà cung cấp</span>
                    <span className="text-[14px] font-semibold text-[#1d1d1f]">{item.supplierName}</span>
                  </div>
                )}
                {item.poNumber && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a]">Đơn nhập hàng</span>
                    <span className="text-[13px] font-semibold text-[#0066cc]">{item.poNumber}</span>
                  </div>
                )}
                {item.originCountry && item.originCountry !== "VN" && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a]">Xuất xứ</span>
                    <span className="text-[14px] font-medium text-[#1d1d1f]">
                      {({ US: "Mỹ", JP: "Nhật Bản", CN: "Trung Quốc", KR: "Hàn Quốc", TW: "Đài Loan" } as Record<string, string>)[item.originCountry] || item.originCountry}
                    </span>
                  </div>
                )}
                {item.shippingMethod && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a]">Đơn vị vận chuyển</span>
                    <span className="text-[14px] font-medium text-[#1d1d1f]">{item.shippingMethod}</span>
                  </div>
                )}
                {item.trackingNumber && (
                  <div className="px-5 py-3.5 flex justify-between items-center">
                    <span className="text-[13px] text-[#7a7a7a]">Mã vận đơn</span>
                    {item.trackingUrl ? (
                      <a href={item.trackingUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[13px] font-semibold text-[#0066cc] hover:text-[#0071e3] transition-colors">
                        {item.trackingNumber} ↗
                      </a>
                    ) : (
                      <span className="text-[13px] font-medium text-[#1d1d1f]">{item.trackingNumber}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: Ghi chú */}
          <div className="bg-white border border-[#e0e0e0] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-[#f5f5f7] border-b border-[#e0e0e0]">
              <span className="text-[11px] font-bold text-[#7a7a7a] uppercase tracking-wider">Ghi chú</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] text-[#1d1d1f] leading-relaxed">
                {item.notes || "Không có ghi chú."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
