import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center relative overflow-hidden font-sans select-none">
      {/* Decorative Radial Background lights */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#0066cc]/4 blur-[130px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#30d158]/3 blur-[130px] rounded-full pointer-events-none z-0" />
      
      <main className="w-full max-w-md p-5 relative z-10">
        {children}
      </main>
    </div>
  );
}
