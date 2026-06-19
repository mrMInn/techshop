import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    in_stock: { color: "text-emerald-600", label: "Sẵn hàng" },
    incoming: { color: "text-[#0066cc]", label: "Đang về" },
    sold: { color: "text-[#7a7a7a]", label: "Đã bán" },
    warranty_repair: { color: "text-amber-600", label: "Bảo hành" },
    returned: { color: "text-[#7a7a7a]", label: "Đã trả NCC" },
    defective: { color: "text-red-600", label: "Lỗi" },
    deleted: { color: "text-red-500", label: "Đã xóa" },
  };

  const config = statusConfig[status] || { color: "text-[#1d1d1f]", label: status };

  return (
    <span
      className={cn(
        "text-[13px] font-semibold",
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
