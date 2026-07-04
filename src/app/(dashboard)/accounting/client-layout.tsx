"use client";

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div 
      className="space-y-6"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
    >
      <div className="animate-fade-in">{children}</div>
    </div>
  );
}
