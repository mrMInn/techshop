"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
    <div className="w-full bg-white/90 backdrop-blur-2xl border border-[#e0e0e0]/50 rounded-[22px] p-10 shadow-[0_2px_40px_rgba(0,0,0,0.06)] transition-all duration-300">
      
      {/* Header — Apple minimal */}
      <div className="text-center mb-9">
        <h1 className="text-[28px] font-semibold text-[#1d1d1f] tracking-tight leading-tight">
          Đăng nhập
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Email Input */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider pl-0.5">
            Email
          </label>
          <input
            type="email"
            disabled={isLoading}
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full px-4 h-[48px] rounded-[14px] bg-[#f5f5f7] border border-[#d2d2d7] text-[15px] font-medium text-[#1d1d1f] placeholder-[#86868b]/60 focus:outline-none focus:border-[#0071e3] focus:bg-white focus:ring-[3px] focus:ring-[#0071e3]/12 transition-all duration-200 disabled:opacity-50"
          />
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider pl-0.5">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              disabled={isLoading}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-4 pr-11 h-[48px] rounded-[14px] bg-[#f5f5f7] border border-[#d2d2d7] text-[15px] font-medium text-[#1d1d1f] placeholder-[#86868b]/60 focus:outline-none focus:border-[#0071e3] focus:bg-white focus:ring-[3px] focus:ring-[#0071e3]/12 transition-all duration-200 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#86868b] hover:text-[#1d1d1f] transition-colors disabled:opacity-50"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-[48px] mt-3 rounded-[14px] bg-[#0071e3] hover:bg-[#0077ED] text-white text-[15px] font-semibold active:scale-[0.985] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={17} />
              <span>Đang kết nối...</span>
            </>
          ) : (
            <span>Đăng nhập</span>
          )}
        </button>

      </form>

    </div>
  );
}
