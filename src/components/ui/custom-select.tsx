"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  extraBadge?: string;
  price?: string;
  listedPrice?: string;
  /** Hidden searchable text (e.g. serial numbers) – not rendered in UI */
  searchKeywords?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  searchable?: boolean;
  className?: string;
  align?: "left" | "right";
  size?: "sm" | "md";
  dropdownWidth?: "full" | "wide";
  rounded?: "full" | "default";
  triggerIcon?: React.ReactNode;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Chọn...",
  disabled = false,
  error,
  searchable = false,
  className = "",
  align = "left",
  size = "md",
  dropdownWidth = "wide",
  rounded = "default",
  triggerIcon,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find the currently selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Handle clicking outside to close the dropdown
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

  // Handle ESC key to close
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

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen, searchable]);

  // Filter options based on search query (includes hidden searchKeywords like serial numbers)
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(query) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(query)) ||
      (opt.extraBadge && opt.extraBadge.toLowerCase().includes(query)) ||
      (opt.searchKeywords && opt.searchKeywords.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const isSm = size === "sm";

  return (
    <div
      ref={containerRef}
      className={`relative w-full min-w-0 ${className}`}
    >
      {/* Select Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-w-0 flex items-center justify-between transition-all select-none cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed bg-[#f5f5f7] border text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:hover:bg-[#f5f5f7] ${
          isSm
            ? `min-h-[36px] py-1 px-4 ${rounded === "full" ? "rounded-full" : "rounded-xl"} text-[13px] font-medium`
            : `min-h-[44px] py-1.5 px-4 ${rounded === "full" ? "rounded-full" : "rounded-lg"} text-[17px]`
        } ${
          isOpen
            ? "bg-white border-[#0066cc] ring-2 ring-[#0066cc]/20 shadow-[0_0_0_1px_#0066cc]"
            : error
            ? "border-[#b91c1c] ring-2 ring-[#b91c1c]/10"
            : "border-[#e0e0e0]"
        }`}
      >
        <span className={`truncate flex-1 pr-2 flex items-center gap-1.5 ${!selectedOption ? "text-[#7a7a7a] font-normal" : "font-normal"}`}>
          {triggerIcon && <span className="shrink-0 text-slate-500 flex items-center justify-center">{triggerIcon}</span>}
          <span className="truncate flex-1 text-left flex justify-between items-center">
            {selectedOption ? (
              selectedOption.extraBadge ? (
                <div className="flex items-center justify-between w-full min-w-0">
                  <span className={`truncate pr-2 font-medium ${isSm ? "text-[14px]" : "text-[15px]"}`}>
                    {selectedOption.label} {selectedOption.subLabel ? `(${selectedOption.subLabel})` : ""}
                  </span>
                  <span className="font-mono text-[12px] text-[#7a7a7a] bg-[#e8e8ed] px-1.5 py-0.5 rounded border border-[#d1d1d6] shrink-0">
                    {selectedOption.extraBadge}
                  </span>
                </div>
              ) : (() => {
                const match = selectedOption.label.match(/^(.*)\s\(([^)]+)\)$/);
                if (match) {
                  const [, name, phone] = match;
                  return (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{name}</span>
                      <span className="text-[11px] font-semibold text-[#7a7a7a] bg-[#f5f5f7] px-2 py-0.5 rounded-md border border-[#e0e0e0] shrink-0">
                        {phone.replace(/\D/g, "").length === 10
                          ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
                          : phone}
                      </span>
                    </span>
                  );
                }
                if (selectedOption.subLabel) {
                  return (
                    <span className="flex flex-col text-left min-w-0 py-0.5">
                      <span className="truncate font-semibold text-[14px] leading-tight text-[#1d1d1f]">
                        {selectedOption.label}
                      </span>
                      <span className="truncate text-[11px] text-[#7a7a7a] font-normal leading-normal mt-0.5">
                        {selectedOption.subLabel}
                      </span>
                    </span>
                  );
                }
                return selectedOption.label;
              })()
            ) : (
              placeholder
            )}
          </span>
        </span>
        <ChevronDown
          size={isSm ? 16 : 18}
          className={`text-[#7a7a7a] shrink-0 transition-transform duration-200 ${
            isOpen ? "transform rotate-180 text-[#0066cc]" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute z-50 mt-1.5 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-[#e0e0e0] overflow-hidden py-1 flex flex-col max-h-[300px] w-full ${
          dropdownWidth === "full" ? "" : "md:w-[480px] max-w-[92vw]"
        } ${
          align === "right" ? "right-0 left-auto" : "left-0 right-auto"
        }`}>
          {/* Search Box */}
          {searchable && (
            <div className="relative shrink-0 px-2 py-1.5 border-b border-[#f5f5f7]">
              <Search
                size={14}
                className="absolute left-4.5 top-1/2 -translate-y-1/2 text-[#7a7a7a]"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm..."
                className="w-full h-[34px] pl-8 pr-3 rounded-lg bg-[#f5f5f7] border border-transparent text-[14px] focus:bg-white focus:border-[#e0e0e0] focus:outline-none transition-all"
              />
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto py-1 flex-1 min-h-[50px]">
            {filteredOptions.length === 0 ? (
              <div className={`px-4 py-3 ${isSm ? "text-[13px]" : "text-[14px]"} text-[#7a7a7a] text-center`}>
                Không tìm thấy kết quả
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-[calc(100%-8px)] text-left px-3 py-2 my-0.5 mx-1 rounded-lg ${
                      isSm ? "text-[13px] font-medium" : "text-[15px]"
                    } flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#0066cc]/5 text-[#0066cc] font-medium"
                        : "text-[#1d1d1f] hover:bg-[#f5f5f7] active:bg-[#e8e8ed]"
                    }`}
                  >
                    <span className="pr-2 flex items-center flex-1 min-w-0">
                      {opt.subLabel || opt.price || opt.listedPrice ? (
                        <div className="flex flex-col w-full min-w-0 py-0.5">
                          <div className="flex items-start justify-between w-full min-w-0 gap-2">
                            <span className={`font-semibold text-[#1d1d1f] ${isSm ? "text-[13px]" : "text-[14px]"} leading-snug whitespace-normal break-words flex-1`}>
                              {opt.label}
                            </span>
                            {opt.price && (
                              <span className="text-[13px] font-semibold text-[#7a7a7a] shrink-0 ml-2">
                                {opt.price}
                              </span>
                            )}
                          </div>
                          <div className="flex items-start justify-between w-full min-w-0 mt-1 gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap pr-2">
                              {opt.extraBadge && (
                                <span className="font-mono text-[11px] font-semibold text-[#0066cc] bg-[#0066cc]/10 px-2 py-0.5 rounded-md border border-[#0066cc]/20 shrink-0">
                                  {opt.extraBadge}
                                </span>
                              )}
                              {opt.subLabel && (
                                <span className="text-[11px] font-medium text-[#7a7a7a] leading-snug whitespace-normal break-words w-full mt-0.5">
                                  {opt.subLabel}
                                </span>
                              )}
                            </div>
                            {opt.listedPrice && (
                              <span className="text-[13px] font-bold text-[#0066cc] shrink-0 ml-2">
                                {opt.listedPrice}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : opt.extraBadge ? (
                        <div className="flex items-center justify-between w-full min-w-0">
                          <span className="truncate">{opt.label}</span>
                          <span className="font-mono text-[11px] text-[#7a7a7a] bg-[#e8e8ed] px-1.5 py-0.5 rounded border border-[#d1d1d6] shrink-0 ml-2">
                            {opt.extraBadge}
                          </span>
                        </div>
                      ) : (() => {
                        const match = opt.label.match(/^(.*)\s\(([^)]+)\)$/);
                        if (match) {
                          const [, name, phone] = match;
                          return (
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="truncate font-medium">{name}</span>
                              <span className="text-[11px] font-semibold text-[#7a7a7a] bg-[#f5f5f7] px-2 py-0.5 rounded-md border border-[#e0e0e0] shrink-0">
                                {phone.replace(/\D/g, "").length === 10
                                  ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`
                                  : phone}
                              </span>
                            </span>
                          );
                        }
                        return <span className="truncate">{opt.label}</span>;
                      })()}
                    </span>
                    {isSelected && (
                      <Check size={16} className="text-[#0066cc] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
