"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, BarChart2, Eye, EyeOff, Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!email || !password) {
      toast.error("Vui lòng nhập đầy đủ thông tin đăng nhập.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginAction({ email, password });
      if (result.success) {
        toast.success("Đăng nhập thành công!");
        // Redirect to dashboard home
        router.push("/");
        router.refresh();
      } else {
        toast.error(result.message || "Email hoặc mật khẩu không chính xác.");
      }
    } catch (err: any) {
      toast.error(err.message || "Có lỗi kết nối xảy ra. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 shadow-xl shadow-slate-200/30 transition-all duration-300">
      
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0066cc] to-[#0088ff] flex items-center justify-center shadow-[0_4px_12px_rgba(0,102,204,0.22)] mb-4">
          <BarChart2 className="text-white" size={22} />
        </div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">
          Đăng nhập TechStore ERP
        </h1>
        <p className="text-[12px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
          Hệ thống quản trị nội bộ
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Email Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail size={16} />
            </div>
            <input
              type="email"
              disabled={isLoading}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10.5 pr-4 h-[44px] rounded-xl bg-[#f5f5f7] border border-slate-200 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0066cc] focus:bg-white focus:ring-2 focus:ring-[#0066cc]/10 transition-all duration-200 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">
            Mật khẩu
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock size={16} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              disabled={isLoading}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10.5 pr-10 h-[44px] rounded-xl bg-[#f5f5f7] border border-slate-200 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0066cc] focus:bg-white focus:ring-2 focus:ring-[#0066cc]/10 transition-all duration-200 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-60"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-[44px] mt-6 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-[14px] font-bold shadow-md shadow-[0_4px_12px_rgba(0,102,204,0.18)] hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:pointer-events-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Đang kết nối...</span>
            </>
          ) : (
            <span>Đăng nhập</span>
          )}
        </button>

      </form>

      {/* Footer info */}
      <div className="text-center mt-8 pt-4 border-t border-slate-100">
        <p className="text-[11px] font-medium text-slate-400">
          TechStore ERP &copy; 2026. Thiết kế bảo mật.
        </p>
      </div>

    </div>
  );
}
