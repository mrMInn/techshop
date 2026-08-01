"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  headerActions?: React.ReactNode;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-[90vw] lg:max-w-7xl",
};

export function Dialog({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  children,
  size = "lg",
  headerActions
}: DialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog content - Apple utility card style */}
      <div 
        className={`relative z-10 w-full ${sizeMap[size]} bg-white rounded-[18px] shadow-[0_3px_30px_rgba(0,0,0,0.22)] border border-[#e0e0e0] overflow-hidden transform transition-all flex flex-col max-h-[90vh]`}
        role="dialog"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e0e0e0]">
          <div>
            <h2 className="text-[21px] font-semibold text-[#1d1d1f] tracking-tight leading-tight">{title}</h2>
            {description && (
              <div className="text-[14px] text-[#7a7a7a] mt-1.5 font-normal leading-none flex items-center gap-2 flex-wrap">
                {description}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {headerActions}
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e0e0e0] transition-colors text-[#7a7a7a]"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="px-6 py-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
