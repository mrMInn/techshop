import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const statusConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
    in_stock: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200/50", label: "Sẵn hàng" },
    incoming: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200/50", label: "Đang về" },
    sold: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200/50", label: "Đã bán" },
    warranty_repair: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/50", label: "Bảo hành" },
    returned: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200/50", label: "Đã trả NCC" },
    defective: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200/50", label: "Lỗi" },
    deleted: { bg: "bg-red-50", text: "text-red-500", border: "border-red-200/50", label: "Đã xóa" },
  };

  const config = statusConfig[status] || { bg: "bg-slate-50", text: "text-[#1d1d1f]", border: "border-slate-200/50", label: status };

  if (status === "in_stock") {
    return (
      <span className={cn("inline-flex items-center text-[13px] font-semibold text-emerald-600", className)}>
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-semibold border",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {config.label}
    </span>
  );
}
