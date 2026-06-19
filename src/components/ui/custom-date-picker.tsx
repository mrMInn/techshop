"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface CustomDatePickerProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  rounded?: "full" | "default";
  anchorDate?: string;
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS_VN = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", 
  "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", 
  "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày...",
  disabled = false,
  error,
  className = "",
  size = "md",
  align = "left",
  rounded = "default",
  anchorDate,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value into a Date object or default to today
  const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length !== 3) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  };

  const todayDateObj = useMemo(() => {
    if (anchorDate) {
      const parsed = parseLocalDate(anchorDate);
      if (parsed) return parsed;
    }
    return new Date();
  }, [anchorDate]);

  const selectedDate = useMemo(() => {
    return parseLocalDate(value);
  }, [value]);

  // Calendar viewport state (month and year we are viewing)
  const [viewYear, setViewYear] = useState(() => {
    return selectedDate ? selectedDate.getFullYear() : todayDateObj.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    return selectedDate ? selectedDate.getMonth() : todayDateObj.getMonth();
  });

  // Keep view in sync when value changes externally
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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

  // ESC key to close
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

  // Format date for the input trigger: DD/MM/YYYY
  const displayValue = useMemo(() => {
    if (!selectedDate) return "";
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const year = selectedDate.getFullYear();
    return `${day}/${month}/${year}`;
  }, [selectedDate]);

  // Calendar dates computation
  const calendarCells = useMemo(() => {
    // First day of the current viewing month
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    // Number of days in the current viewing month
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    
    // Day of the week for the first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    let startDayOfWeek = firstDayOfMonth.getDay();
    // Adjust startDayOfWeek to start on Monday: 0 (Monday) to 6 (Sunday)
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const cells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // 1. Previous month trailing days
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      // Previous month is viewMonth - 1
      const d = new Date(viewYear, viewMonth - 1, day);
      cells.push({
        date: d,
        isCurrentMonth: false,
        key: `prev-${day}`,
      });
    }

    // 2. Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      cells.push({
        date: d,
        isCurrentMonth: true,
        key: `curr-${day}`,
      });
    }

    // 3. Next month leading days (to fill 42 cells or complete the week grid)
    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(viewYear, viewMonth + 1, day);
      cells.push({
        date: d,
        isCurrentMonth: false,
        key: `next-${day}`,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDate = (date: Date) => {
    // Format to YYYY-MM-DD
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelectDate(todayDateObj);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const isToday = (date: Date) => {
    return (
      date.getDate() === todayDateObj.getDate() &&
      date.getMonth() === todayDateObj.getMonth() &&
      date.getFullYear() === todayDateObj.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isSm = size === "sm";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Date Trigger Input */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between transition-all select-none cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed bg-[#f5f5f7] border text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:hover:bg-[#f5f5f7] ${
          rounded === "full"
            ? isSm ? "h-[40px] px-2.5 rounded-full text-[12px]" : "h-[44px] px-5 rounded-full text-[17px]"
            : isSm ? "h-[40px] px-2.5 rounded-xl text-[12px]" : "h-[44px] px-4 rounded-lg text-[17px]"
        } ${
          isOpen
            ? "bg-white border-[#0066cc] ring-2 ring-[#0066cc]/20 shadow-[0_0_0_1px_#0066cc]"
            : error
            ? "border-[#b91c1c] ring-2 ring-[#b91c1c]/10"
            : "border-[#e0e0e0]"
        }`}
      >
        <span className={`truncate flex-1 pr-2 text-left ${!displayValue ? "text-[#7a7a7a]/60 font-normal" : "font-semibold"}`}>
          {displayValue || placeholder}
        </span>
        <CalendarIcon size={isSm ? 15 : 18} className="text-[#7a7a7a] shrink-0" />
      </button>

      {/* Popover Custom Calendar */}
      {isOpen && (
        <div className={`absolute top-[calc(100%+6px)] ${
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
        } w-full min-w-[230px] max-w-[285px] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-[#e0e0e0] p-2.5 z-[99] animate-in fade-in zoom-in-95 duration-200 ease-out pointer-events-auto`}>
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#f5f5f7]">
            <span className="text-[13px] font-bold text-[#1d1d1f]">
              {MONTHS_VN[viewMonth]}, {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-6 h-6 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] transition-all active:scale-95"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-6 h-6 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] transition-all active:scale-95"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Weekday Labels Grid */}
          <div className="grid grid-cols-7 gap-0.5 mt-2 text-center">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-[9px] font-bold text-[#7a7a7a] uppercase tracking-wider py-0.5">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-0.5 mt-0.5">
            {calendarCells.map((cell) => {
              const selected = isSelected(cell.date);
              const today = isToday(cell.date);
              
              return (
                <button
                  type="button"
                  key={cell.key}
                  onClick={() => handleSelectDate(cell.date)}
                  className={`aspect-square w-full rounded-lg flex flex-col items-center justify-center text-[11px] font-medium transition-all cursor-pointer active:scale-90 ${
                    selected
                      ? "bg-[#0066cc] text-white font-bold shadow-sm"
                      : today
                      ? "bg-[#0066cc]/10 text-[#0066cc] font-bold border border-[#0066cc]/20"
                      : cell.isCurrentMonth
                      ? "text-[#1d1d1f] hover:bg-[#f5f5f7]"
                      : "text-[#7a7a7a]/40 hover:bg-[#f5f5f7]/60"
                  }`}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Quick Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-[#f5f5f7] mt-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-md transition-all"
            >
              Xóa ngày
            </button>
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-[11px] font-semibold text-[#0066cc] hover:bg-[#0066cc]/10 px-2 py-1 rounded-md transition-all"
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
