"use client";

import { Dialog } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: "danger" | "primary";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  isLoading = false,
  variant = "primary",
}: ConfirmDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="space-y-6">
        <p className="text-[15px] text-[#7a7a7a] leading-relaxed">
          {description}
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full h-[40px] rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#1d1d1f] text-[14px] font-medium transition-all cursor-pointer active:scale-95 duration-150 flex items-center justify-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full h-[40px] rounded-full text-white text-[14px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-150 flex items-center justify-center shadow-sm ${
              variant === "danger"
                ? "bg-[#df2935] hover:bg-[#c2242e] shadow-[0_2px_8px_rgba(223,41,53,0.12)]"
                : "bg-[#0066cc] hover:bg-[#0071e3] shadow-[0_2px_8px_rgba(0,102,204,0.12)]"
            }`}
          >
            {isLoading ? "Đang xử lý..." : confirmText}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
