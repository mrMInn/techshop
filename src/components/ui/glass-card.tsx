import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white border border-[#e0e0e0] rounded-[18px] p-6 transition-all duration-300",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
