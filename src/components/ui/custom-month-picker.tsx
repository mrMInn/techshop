"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CustomMonthPickerProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
}

const MONTHS = [
  "Thg 1", "Thg 2", "Thg 3", "Thg 4",
  "Thg 5", "Thg 6", "Thg 7", "Thg 8",
  "Thg 9", "Thg 10", "Thg 11", "Thg 12"
];

export function CustomMonthPicker({
  value,
  onChange,
  placeholder = "Chọn tháng...",
  disabled = false,
  className = "",
  size = "md",
  align = "left",
}: CustomMonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse YYYY-MM
  const parsed = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-");
    if (parts.length !== 2) return null;
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10) - 1, // 0-indexed
    };
  }, [value]);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(() => {
    return parsed ? parsed.year : today.getFullYear();
  });

  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
    }
  }, [parsed]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const displayValue = useMemo(() => {
    if (!parsed) return "";
    return `Tháng ${parsed.month + 1}/${parsed.year}`;
  }, [parsed]);

  const handlePrevYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear((prev) => prev - 1);
  };

  const handleNextYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear((prev) => prev + 1);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const y = viewYear;
    const m = String(monthIndex + 1).padStart(2, "0");
    onChange(`${y}-${m}`);
    setIsOpen(false);
  };

  const isSelected = (monthIndex: number) => {
    if (!parsed) return false;
    return parsed.year === viewYear && parsed.month === monthIndex;
  };

  const isCurrentMonth = (monthIndex: number) => {
    return today.getFullYear() === viewYear && today.getMonth() === monthIndex;
  };

  const isSm = size === "sm";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between transition-all select-none cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed bg-[#f5f5f7] border text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:hover:bg-[#f5f5f7] ${
          isSm ? "h-[30px] px-2.5 rounded-lg text-[11px] font-semibold" : "h-[44px] px-4 rounded-lg text-[15px] font-semibold"
        } ${
          isOpen
            ? "bg-white border-[#0066cc] ring-2 ring-[#0066cc]/20 shadow-[0_0_0_1px_#0066cc]"
            : "border-[#e0e0e0]"
        }`}
      >
        <span className={`truncate flex-1 text-left ${!displayValue ? "text-[#7a7a7a]/60 font-normal" : "font-semibold"}`}>
          {displayValue || placeholder}
        </span>
        <svg
          width={isSm ? 12 : 14}
          height={isSm ? 12 : 14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#7a7a7a] shrink-0 ml-1.5"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute top-[calc(100%+6px)] ${
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
        } w-[220px] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-[#e0e0e0] p-2.5 z-[99] animate-in fade-in zoom-in-95 duration-200 ease-out pointer-events-auto`}>
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#f5f5f7]">
            <span className="text-[13px] font-bold text-[#1d1d1f]">
              Năm {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevYear}
                className="w-6 h-6 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] transition-all active:scale-95"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                onClick={handleNextYear}
                className="w-6 h-6 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] transition-all active:scale-95"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-1.5 mt-2.5">
            {MONTHS.map((monthName, idx) => {
              const selected = isSelected(idx);
              const current = isCurrentMonth(idx);
              return (
                <button
                  type="button"
                  key={monthName}
                  onClick={() => handleSelectMonth(idx)}
                  className={`py-2 rounded-lg text-center text-[11px] font-medium transition-all cursor-pointer active:scale-95 ${
                    selected
                      ? "bg-[#0066cc] text-white font-bold shadow-sm"
                      : current
                      ? "bg-[#0066cc]/10 text-[#0066cc] font-bold border border-[#0066cc]/20"
                      : "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  }`}
                >
                  {monthName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
