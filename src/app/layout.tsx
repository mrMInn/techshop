import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nơi Bán Phụ Kiện - ERP",
  description: "Quản lý kho hàng & Bán hàng",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          {/* Liquid Bg Layer */}
          <div className="liquid-bg-layer" />
          
          {children}
          <Toaster 
            position="top-right"
            gap={8}
            toastOptions={{
              unstyled: true,
              classNames: {
                toast: "flex items-start gap-3 w-full max-w-[360px] px-4 py-3.5 rounded-[14px] bg-white/95 backdrop-blur-xl border border-[#e0e0e0]/60 shadow-[0_4px_24px_rgba(0,0,0,0.08)] font-[var(--font-geist-sans)]",
                title: "text-[13px] font-semibold text-[#1d1d1f] leading-snug",
                description: "text-[12px] text-[#86868b] leading-snug mt-0.5",
                actionButton: "text-[12px] font-semibold text-[#0071e3] hover:text-[#0077ED] transition-colors cursor-pointer",
                cancelButton: "text-[12px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer",
                closeButton: "text-[#86868b] hover:text-[#1d1d1f] transition-colors",
                success: "!border-[#34c759]/25",
                error: "!border-[#ff3b30]/25",
                warning: "!border-[#ff9f0a]/25",
                info: "!border-[#0071e3]/25",
                icon: "mt-0.5",
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
