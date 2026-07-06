"use client";
 
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getExpenses, 
  getExpenseCategories, 
  createExpense, 
  createExpenseCategory, 
  updateExpenseCategory,
  deleteExpenseCategory,
  getWarrantyClaimsForSelect,
  updateExpenseAction,
  deleteExpenseAction
} from "@/app/actions/accounting";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { 
  Loader2, 
  Plus, 
  X, 
  Pencil, 
  Trash2, 
  Check, 
  RefreshCw, 
  Eye, 
  Info,
  ArrowRight,
  AlertCircle,
  Wallet,
  Clock,
  CheckCircle2,
  Edit2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
 
const formatVNDInput = (value: string) => {
  if (!value) return "";
  const num = parseInt(value.replace(/\D/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("vi-VN");
};
 
const formatPrice = (price: string | number | null) => {
  if (price === null || price === undefined) return "0đ";
  return Math.round(Number(price)).toLocaleString("vi-VN") + "đ";
};
 
const formatToDDMMYYYY = (dateString: string | Date | null) => {
  if (!dateString) return "N/A";
  try {
    let d: Date;
    if (typeof dateString === "string") {
      const parts = dateString.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        d = new Date(year, month, day);
      } else {
        d = new Date(dateString);
      }
    } else {
      d = dateString;
    }
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "N/A";
  }
};

// Helper function to concatenate classes
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function KinhPanel({
  children,
  className = "",
  overflowVisible = false,
}: {
  children: React.ReactNode;
  className?: string;
  overflowVisible?: boolean;
}) {
  return (
    <section
      className={`bg-white border border-[#e0e0e0] rounded-[18px] transition-all duration-300 shadow-sm ${
        overflowVisible ? "overflow-visible" : "overflow-hidden"
      } ${className}`}
    >
      <div>{children}</div>
    </section>
  );
}
 
const categoryMeta: Record<string, { color: string; bg: string }> = {
  "Doanh thu lẻ": { color: "bg-emerald-500", bg: "#10b981" },
  "Nhập hàng": { color: "bg-amber-500", bg: "#f59e0b" },
  "Lương nhân viên": { color: "bg-violet-500", bg: "#8b5cf6" },
  "Thuê mặt bằng": { color: "bg-blue-500", bg: "#3b82f6" },
  "Điện nước mạng": { color: "bg-orange-500", bg: "#f97316" },
  "Điện nước viễn thông": { color: "bg-orange-500", bg: "#f97316" },
  "Vận chuyển hàng": { color: "bg-cyan-500", bg: "#06b6d4" },
  "Vận chuyển hàng hóa": { color: "bg-cyan-500", bg: "#06b6d4" },
  "Thuế nhà nước": { color: "bg-rose-500", bg: "#f43f5e" },
  "Dịch vụ sửa chữa": { color: "bg-teal-500", bg: "#14b8a6" },
  "Chi phí khác": { color: "bg-slate-400", bg: "#94a3b8" },
};
 

 
export default function ExpensesPage() {
  const queryClient = useQueryClient();

  // Trạng thái bộ lọc (đồng bộ với sổ quỹ)
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Timeframe and date filter sync (Dashboard match)
  const [activeTimeframe, setActiveTimeframe] = useState<"weekly" | "monthly" | "yearly" | "custom" | "month-select">("custom");
  const [customStartDate, setCustomStartDate] = useState("2026-05-01");
  const [customEndDate, setCustomEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  });
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState("2026-06");

  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const today = new Date(); // Sử dụng ngày hệ thống thực tế động
    const year = today.getFullYear();
    const month = today.getMonth();

    if (activeTimeframe === "weekly") {
      const currentDay = today.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distanceToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      setStartDate(monday.toISOString().split("T")[0]);
      setEndDate(sunday.toISOString().split("T")[0]);
    } else if (activeTimeframe === "monthly") {
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      setStartDate(first.toISOString().split("T")[0]);
      setEndDate(last.toISOString().split("T")[0]);
    } else if (activeTimeframe === "yearly") {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (activeTimeframe === "custom") {
      setStartDate(customStartDate);
      setEndDate(customEndDate);
    } else if (activeTimeframe === "month-select") {
      const [yStr, mStr] = selectedSpecificMonth.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      setStartDate(first.toISOString().split("T")[0]);
      setEndDate(last.toISOString().split("T")[0]);
    }
  }, [activeTimeframe, customStartDate, customEndDate, selectedSpecificMonth]);
  // Trạng thái cho Dialog ghi nhận khoản chi mới (Add)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState("2026-05-30");
  const [paymentMethod, setPaymentMethod] = useState<any>("cash");
  const [selectedClaimId, setSelectedClaimId] = useState("");
 
  // Trạng thái quản lý khoản chi (View / Edit / Delete)
  const [selectedExpenseForDetail, setSelectedExpenseForDetail] = useState<any | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<any | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
 
  // Trạng thái cho Form chỉnh sửa khoản chi (Edit)
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<any>("cash");
 
  useEffect(() => {
    if (expenseToEdit) {
      setEditCategoryId(expenseToEdit.categoryId || "");
      setEditAmount(expenseToEdit.amount ? String(expenseToEdit.amount) : "");
      setEditDescription(expenseToEdit.description || "");
      setEditExpenseDate(expenseToEdit.expenseDate || "");
      setEditPaymentMethod(expenseToEdit.paymentMethod || "cash");
    }
  }, [expenseToEdit]);
 
  // Trạng thái cho Dialog tạo danh mục mới
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"fixed" | "variable" | "one_time">("variable");
  const [newCatDesc, setNewCatDesc] = useState("");
 
  // Queries
  const { data: expensesList, isLoading: isLoadingExpenses, refetch, isFetching } = useQuery({
    queryKey: ["expenses"],
    queryFn: getExpenses,
  });
 
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: getExpenseCategories,
  });
 
  const { data: warrantyClaimsSelect } = useQuery({
    queryKey: ["warranty_claims_select"],
    queryFn: getWarrantyClaimsForSelect,
  });

  // Cấu hình danh mục cho bộ lọc
  const categoryFilterOptions = useMemo(() => {
    const base = [{ value: "all", label: "Tất cả danh mục" }];
    if (categories) {
      categories.forEach((c) => {
        base.push({ value: c.id, label: c.name });
      });
    }
    return base;
  }, [categories]);

  // Bộ lọc Client-side cho danh sách chi phí
  const filteredExpenses = useMemo(() => {
    if (!expensesList) return [];
    return expensesList.filter((exp) => {
      // 1. Lọc theo danh mục
      if (selectedCategory !== "all" && exp.categoryId !== selectedCategory) {
        return false;
      }
      // 2. Lọc từ ngày
      if (startDate && exp.expenseDate < startDate) {
        return false;
      }
      // 3. Lọc đến ngày
      if (endDate && exp.expenseDate > endDate) {
        return false;
      }
      return true;
    });
  }, [expensesList, selectedCategory, startDate, endDate]);

 
  // Mutation tạo chi phí mới
  const expenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        
        // Reset form
        setCategoryId("");
        setAmount("");
        setDescription("");
        setExpenseDate("2026-05-30");
        setPaymentMethod("cash");
        setSelectedClaimId("");
        setIsDialogOpen(false);
      } else {
        toast.error(res.message);
      }
    },
  });
 
  // Mutation cập nhật chi phí
  const updateExpenseMutation = useMutation({
    mutationFn: updateExpenseAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setExpenseToEdit(null);
        setIsEditing(false);
        setSelectedExpenseForDetail(null);
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Lỗi khi cập nhật khoản chi");
    }
  });
 
  // Mutation xóa chi phí
  const deleteExpenseMutation = useMutation({
    mutationFn: deleteExpenseAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setExpenseToDelete(null);
        setSelectedExpenseForDetail(null);
        setIsEditing(false);
      } else {
        toast.error(res.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Lỗi khi xóa khoản chi");
    }
  });
 
  // Mutation tạo danh mục mới
  const categoryMutation = useMutation({
    mutationFn: createExpenseCategory,
    onSuccess: (res) => {
      if (res.success && res.category) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
        setCategoryId(res.category.id);
        setNewCatName("");
        setNewCatDesc("");
        setIsCategoryDialogOpen(false);
      } else {
        toast.error(res.message);
      }
    },
  });
 
  // Trạng thái quản lý danh mục chi phí (Edit/Delete)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatType, setEditCatType] = useState<"fixed" | "variable" | "one_time">("variable");
  const [editCatDesc, setEditCatDesc] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
 
  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateExpenseCategory(id, payload),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
        setEditingCategoryId(null);
      } else {
        toast.error(res.message);
      }
    },
  });
 
  const deleteCategoryMutation = useMutation({
    mutationFn: deleteExpenseCategory,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
      } else {
        toast.error(res.message);
      }
    },
  });
 
  const handleClaimSelect = (claimId: string) => {
    setSelectedClaimId(claimId);
    if (!claimId) return;
    const claim = warrantyClaimsSelect?.find((c) => c.id === claimId);
    if (claim) {
      setDescription(
        `Chi phí linh kiện bảo hành máy SN: ${claim.serialNumber} (${claim.productName}) - Phiếu: ${claim.claimNumber}`
      );
    }
  };
 
  // Submit tạo khoản chi
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      toast.error("Vui lòng chọn danh mục chi phí");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Vui lòng nhập số tiền chi lớn hơn 0đ");
      return;
    }
    if (!description) {
      toast.error("Vui lòng nhập nội dung diễn giải");
      return;
    }
 
    expenseMutation.mutate({
      categoryId,
      amount,
      description,
      expenseDate,
      paymentMethod,
    });
  };
 
  // Submit cập nhật khoản chi
  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategoryId) {
      toast.error("Vui lòng chọn danh mục chi phí");
      return;
    }
    if (!editAmount || Number(editAmount) <= 0) {
      toast.error("Vui lòng nhập số tiền chi lớn hơn 0đ");
      return;
    }
    if (!editDescription) {
      toast.error("Vui lòng nhập nội dung diễn giải");
      return;
    }
 
    updateExpenseMutation.mutate({
      id: selectedExpenseForDetail.id,
      categoryId: editCategoryId,
      amount: editAmount,
      description: editDescription,
      expenseDate: editExpenseDate,
      paymentMethod: editPaymentMethod,
    });
  };
 
  const handleCreateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.error("Vui lòng nhập tên danh mục");
      return;
    }
    categoryMutation.mutate({
      name: newCatName,
      type: newCatType,
      description: newCatDesc,
    });
  };
 
  const handleStartEdit = () => {
    setExpenseToEdit(selectedExpenseForDetail);
    setIsEditing(true);
  };
 
  const payMethods: Record<string, string> = {
    cash: "Tiền mặt",
    bank_transfer: "Chuyển khoản",
    card: "Thẻ ngân hàng",
  };
 
  // Calculate expenses categories statistics breakdown for vertical chart
  const stats = useMemo(() => {
    if (!filteredExpenses) return { totalExpense: 0, list: [] };
    const totalExpense = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
 
    const grouped: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const cat = e.categoryName || "Chi phí khác";
      grouped[cat] = (grouped[cat] || 0) + Number(e.amount || 0);
    });
 
    const rawStats = Object.keys(grouped).map((cat) => {
      const amount = grouped[cat];
      const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      return {
        label: cat,
        amount,
        percentage,
      };
    });
 
    return {
      totalExpense,
      list: rawStats.sort((a, b) => b.amount - a.amount),
    };
  }, [filteredExpenses]);
 
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header - Flat Clean Apple Style */}
    
 
      {/* Header - Apple Premium Single-Row Layout */}
      <div className="pb-6 border-b border-[#e0e0e0] print:hidden">
        <div className="flex flex-wrap items-center gap-3 justify-start">
          
          {/* Timeframe Selector (Tuần / Tháng / Năm / Tùy chọn / Chọn tháng) - Apple Segmented Control Style */}
          <div className="relative flex bg-[#f5f5f7] p-[3px] rounded-full border border-[#e0e0e0] h-[40px] w-full sm:w-[460px] shrink-0 select-none overflow-hidden">
            {/* Sliding Active Capsule Overlay */}
            <div
              className="absolute top-[3px] bottom-[3px] rounded-full bg-[#0066cc] shadow-[0_2px_4px_rgba(0,102,204,0.25)]"
              style={{
                width: "calc(20% - 6px)",
                left: `calc(${
                  (activeTimeframe === "weekly"
                    ? 0
                    : activeTimeframe === "monthly"
                    ? 1
                    : activeTimeframe === "yearly"
                    ? 2
                    : activeTimeframe === "custom"
                    ? 3
                    : 4) * 20
                }% + 3px)`,
                transition: "left 280ms cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            />

            {(["weekly", "monthly", "yearly", "custom", "month-select"] as const).map((type) => {
              const labelMap: Record<string, string> = {
                weekly: "Tuần",
                monthly: "Tháng",
                yearly: "Năm",
                custom: "Tùy chọn",
                "month-select": "Chọn tháng",
              };
              const active = activeTimeframe === type;
              return (
                <button
                  key={type}
                  onClick={() => setActiveTimeframe(type)}
                  className={`w-1/5 h-full relative z-10 flex items-center justify-center text-[12.5px] transition-colors duration-200 cursor-pointer active:scale-98 ${
                    active ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
                  }`}
                >
                  {labelMap[type]}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers Range */}
          {activeTimeframe === "custom" && (
            <>
              <InlineDatePicker
                label="Từ:"
                value={customStartDate}
                active={true}
                onChange={(val) => {
                  setCustomStartDate(val);
                  setActiveTimeframe("custom");
                  if (customEndDate && val > customEndDate) {
                    setCustomEndDate(val);
                  }
                }}
              />
              <span className="text-slate-300 font-semibold select-none">/</span>
              <InlineDatePicker
                label="Đến:"
                value={customEndDate}
                active={true}
                onChange={(val) => {
                  setCustomEndDate(val);
                  setActiveTimeframe("custom");
                  if (customStartDate && val < customStartDate) {
                    setCustomStartDate(val);
                  }
                }}
                align="right"
              />
            </>
          )}

          {/* Specific Month Selector */}
          {activeTimeframe === "month-select" && (
            <InlineMonthPicker
              label="Chọn tháng:"
              value={selectedSpecificMonth}
              active={true}
              onChange={(val) => {
                setSelectedSpecificMonth(val);
                setActiveTimeframe("month-select");
              }}
            />
          )}

          {/* Category select dropdown - Pushed to right */}
          <div className="w-[220px] shrink-0 sm:ml-auto">
            <CustomSelect
              options={categoryFilterOptions}
              value={selectedCategory}
              onChange={setSelectedCategory}
              placeholder="Tất cả danh mục"
              dropdownWidth="full"
              size="sm"
              rounded="full"
            />
          </div>

          {/* Action & Refresh Group */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => refetch()}
              className="w-10 h-10 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#7a7a7a] hover:text-[#1d1d1f] rounded-full transition-all border border-[#e0e0e0] cursor-pointer flex items-center justify-center shadow-sm active:scale-[0.95]"
              title="Làm mới chi phí"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin text-[#0066cc]" : ""} />
            </button>
          </div>

        </div>
      </div>
 
      {/* Dual-Pane Workspace Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Left Pane (70% - xl:col-span-2) - Expenses Ledger List */}
        <div className="xl:col-span-2 space-y-4">
          {isLoadingExpenses ? (
            <div className="bg-white rounded-[18px] border border-[#e0e0e0] flex flex-col items-center justify-center py-24 text-slate-500 shadow-sm">
              <Loader2 className="animate-spin mb-2.5 text-[#0066cc]" size={24} />
              <p className="text-[13px] font-bold text-slate-800">Đang tải danh sách chi phí...</p>
            </div>
          ) : filteredExpenses && filteredExpenses.length > 0 ? (
            <KinhPanel className="shadow-sm overflow-hidden flex flex-col justify-between">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0 table-fixed min-w-[700px]">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                      <th className="py-3 px-3 w-[8%] text-center border-b border-slate-200 bg-slate-50">STT</th>
                      <th className="py-3 px-3 w-[18%] border-b border-slate-200 bg-slate-50">Mã chứng từ</th>
                      <th className="py-3 px-3 w-[16%] border-b border-slate-200 bg-slate-50">Ngày chi</th>
                      <th className="py-3 px-3 w-[24%] border-b border-slate-200 bg-slate-50">Danh mục</th>
                      <th className="py-3 px-3 w-[18%] text-right border-b border-slate-200 bg-slate-50">Số tiền</th>
                      <th className="py-3 px-3 w-[16%] border-b border-slate-200 bg-slate-50">Người lập</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] text-slate-800">
                    {filteredExpenses.map((exp, index) => {
                      const amt = Number(exp.amount || 0);
                      const isSelected = selectedExpenseForDetail?.id === exp.id;
                      const stt = index + 1;
 
                      return (
                        <tr
                          key={exp.id}
                          onClick={() => {
                            setSelectedExpenseForDetail(exp);
                            setIsEditing(false);
                          }}
                          className="group cursor-pointer select-none"
                        >
                          {/* STT (rounded-l-xl) */}
                          <td className={`py-3.5 px-3 text-center font-bold text-[12px] transition-all truncate whitespace-nowrap ${
                            isSelected 
                              ? "text-amber-900 bg-amber-500/20 group-hover:bg-amber-500/25 border-y border-l border-amber-500/35 rounded-l-xl" 
                              : "text-slate-400 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`}>
                            {stt}
                          </td>
 
                          {/* Mã chứng từ */}
                          <td className={`py-3.5 px-3 font-mono text-[12px] transition-all truncate whitespace-nowrap ${
                            isSelected 
                              ? "text-amber-900 bg-amber-500/20 group-hover:bg-amber-500/25 border-y border-amber-500/35" 
                              : "text-slate-500 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`} title={exp.expenseNumber}>
                            <span className={`truncate block max-w-[100px] ${isSelected ? "font-bold text-amber-900" : "font-semibold text-slate-700"}`}>
                              {exp.expenseNumber}
                            </span>
                          </td>
 
                          {/* Ngày chi */}
                          <td className={`py-3.5 px-3 transition-all truncate whitespace-nowrap text-[12px] ${
                            isSelected 
                              ? "bg-amber-500/20 group-hover:bg-amber-500/25 border-y border-amber-500/35 text-slate-700 font-semibold" 
                              : "text-slate-500 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`}>
                            {formatToDDMMYYYY(exp.expenseDate)}
                          </td>
 
                          {/* Danh mục */}
                          <td className={`py-3.5 px-3 transition-all truncate whitespace-nowrap text-[12px] ${
                            isSelected 
                              ? "bg-amber-500/20 group-hover:bg-amber-500/25 border-y border-amber-500/35 text-amber-900 font-bold" 
                              : "text-amber-800 font-semibold border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`} title={exp.categoryName}>
                            {exp.categoryName}
                          </td>
 
                          {/* Số tiền */}
                          <td className={`py-3.5 px-3 text-right font-bold transition-all truncate whitespace-nowrap text-[13px] ${
                            isSelected 
                              ? "bg-amber-500/20 group-hover:bg-amber-500/25 border-y border-amber-500/35 text-rose-600" 
                              : "text-rose-600 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`}>
                            -{Math.round(amt).toLocaleString("vi-VN")}đ
                          </td>
 
                          {/* Người lập (rounded-r-xl) */}
                          <td className={`py-3.5 px-3 pr-4 transition-all whitespace-nowrap truncate text-[12px] ${
                            isSelected 
                              ? "bg-amber-500/20 group-hover:bg-amber-500/25 border-y border-r border-amber-500/35 rounded-r-xl text-slate-700 font-semibold" 
                              : "text-slate-500 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`} title={exp.createdByName || "Hệ thống"}>
                            {exp.createdByName || "Hệ thống"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </KinhPanel>
          ) : (
            <KinhPanel className="p-16 text-center shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-slate-100/60 flex items-center justify-center text-slate-400 mx-auto mb-3 border border-slate-200 shadow-inner">
                <AlertCircle size={22} className="text-slate-500" />
              </div>
              <h5 className="text-[14px] font-bold text-slate-900">
                {expensesList && expensesList.length > 0 
                  ? "Không tìm thấy khoản chi phí nào phù hợp" 
                  : "Chưa ghi nhận chi phí vận hành nào"}
              </h5>
              <p className="text-[12px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                {expensesList && expensesList.length > 0 
                  ? "Vui lòng thử điều chỉnh lại bộ lọc danh mục hoặc khoảng thời gian để tìm kiếm." 
                  : "Nhấp nút \"Ghi nhận khoản chi\" để bắt đầu thiết lập dòng tiền chi phí ngoài mua hàng."}
              </p>
            </KinhPanel>
          )}
        </div>
 
        {/* Right Pane (30% - xl:col-span-1) - Details slip / Summary stats */}
        <div className="xl:col-span-1 space-y-5 sticky top-6">
          {!selectedExpenseForDetail ? (
            /* Standby view: Show breakdown statistics vertical progress list */
            <KinhPanel className="p-4.5">
              <div className="space-y-4 w-full">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu Chi vận hành</h4>
                    <h3 className="text-[20px] font-bold text-slate-800 mt-1 tracking-tight">
                      {formatPrice(stats.totalExpense)}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-wide">
                    Chi quỹ
                  </span>
                </div>
 
                {/* Apple Health-style list for Expenses page categories */}
                <div className="space-y-3.5 pt-1 max-h-[380px] overflow-y-auto pr-3">
                  {stats.list.map((stat) => {
                    const meta = categoryMeta[stat.label] || { color: "bg-slate-400", bg: "#94a3b8" };
                    return (
                      <div key={stat.label} className="space-y-1.5 p-1 rounded-xl">
                        <div className="flex justify-between text-[12px] font-semibold leading-normal">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.color}`} />
                            <span className="text-slate-700 truncate">{stat.label}</span>
                          </div>
                          <div className="flex gap-2 text-right shrink-0">
                            <span className="text-slate-900 tracking-tight">{formatPrice(stat.amount)}</span>
                            <span className="text-slate-400 font-medium">{stat.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            style={{ 
                              width: `${stat.percentage}%`, 
                              backgroundColor: meta.bg 
                            }}
                            className="h-full rounded-full transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </KinhPanel>
          ) : (
            /* Selected view: Show high-fidelity slip ticket and inline editor slip */
            <KinhPanel className="shadow-sm p-4.5 space-y-4 relative transition-all duration-300" overflowVisible={true}>
              
              {/* Voucher header controls */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Edit2 size={13} className="text-[#0066cc]" />
                      <span>Hiệu chỉnh chi phí</span>
                    </>
                  ) : (
                    <>
                      <Wallet size={13} className="text-[#0066cc]" />
                      <span>Chi tiết phiếu chi</span>
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExpenseForDetail(null);
                    setIsEditing(false);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                  title="Đóng chi tiết"
                >
                  <X size={15} />
                </button>
              </div>
 
              {isEditing ? (
                /* Edit manual slip view */
                <form onSubmit={handleUpdateSubmit} className="space-y-3.5">
                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-[11.5px] font-semibold text-slate-500 uppercase pl-0.5 tracking-wide">
                      Danh mục chi phí *
                    </label>
                    {categories && categories.length > 0 ? (
                      <CustomSelect
                        options={categories.map((c) => ({ value: c.id, label: c.name }))}
                        value={editCategoryId}
                        onChange={setEditCategoryId}
                        dropdownWidth="full"
                        size="sm"
                      />
                    ) : (
                      <div className="text-[13px] text-slate-400 pl-1 font-semibold">Đang tải danh mục...</div>
                    )}
                  </div>
 
                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label className="text-[11.5px] font-semibold text-slate-500 uppercase pl-0.5 tracking-wide">
                      Số tiền chi (VND) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formatVNDInput(editAmount)}
                        onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, ""))}
                        placeholder="0"
                        className="w-full pl-3.5 pr-12 h-[40px] rounded-xl bg-white border border-[#e0e0e0] text-[14px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 focus:bg-white transition-all shadow-sm"
                        required
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">VNĐ</span>
                    </div>
                  </div>
 
                  {/* Date and Payment Method */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11.5px] font-semibold text-slate-500 uppercase pl-0.5 tracking-wide">Ngày chi *</label>
                      <CustomDatePicker
                        value={editExpenseDate}
                        onChange={setEditExpenseDate}
                        size="sm"
                        placeholder="Chọn ngày chi..."
                        anchorDate="2026-05-30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11.5px] font-semibold text-slate-500 uppercase pl-0.5 tracking-wide">Thanh toán *</label>
                      <CustomSelect
                        options={[
                          { value: "cash", label: "Tiền mặt" },
                          { value: "bank_transfer", label: "Chuyển khoản" },
                          { value: "card", label: "Thẻ ngân hàng" },
                        ]}
                        value={editPaymentMethod}
                        onChange={setEditPaymentMethod}
                        dropdownWidth="full"
                        size="sm"
                      />
                    </div>
                  </div>
 
                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-[11.5px] font-semibold text-slate-500 uppercase pl-0.5 tracking-wide">Diễn giải nội dung *</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Nội dung diễn giải chi tiết..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 focus:bg-white transition-all resize-none shadow-sm"
                      rows={3}
                      required
                    />
                  </div>
 
                  {/* Submission triggers & Destructive control */}
                  <div className="pt-3.5 border-t border-slate-100 space-y-2">
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 h-[34px] bg-[#fafafc] hover:bg-[#f5f5f7] border border-[#e0e0e0] text-slate-700 rounded-full text-[12px] font-semibold transition-all cursor-pointer active:scale-95 duration-200"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={updateExpenseMutation.isPending}
                        className="flex items-center justify-center gap-1.5 px-4.5 h-[34px] bg-[#0066cc] text-white hover:bg-blue-600 rounded-full text-[12px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200 shadow-sm"
                      >
                        {updateExpenseMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                      </button>
                    </div>
 
                    <button
                      type="button"
                      onClick={() => setExpenseToDelete(selectedExpenseForDetail)}
                      className="w-full flex items-center justify-center gap-1.5 h-[34px] bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-full text-[12px] font-semibold transition-all border border-rose-200 cursor-pointer active:scale-95 duration-200"
                    >
                      <Trash2 size={13} /> Xóa khoản chi
                    </button>
                  </div>
                </form>
              ) : (
                /* High-fidelity Receipt Voucher Slip layout */
                <div className="space-y-4">
                  {/* Coupon layout voucher box */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] relative overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider">TICKET VOUCHER</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white uppercase tracking-wider shadow-sm">
                        Chi quỹ
                      </span>
                    </div>
 
                    {/* Big Amount Spot */}
                    <div className="text-center py-4">
                      <p className="text-[10.5px] font-semibold text-[#7a7a7a] uppercase tracking-wide leading-none">Số tiền hạch toán</p>
                      <h2 className="text-[21px] font-bold mt-1.5 leading-none tracking-tight tabular-nums text-rose-600">
                        -{formatPrice(selectedExpenseForDetail.amount)}
                      </h2>
                    </div>
 
                    {/* Serrated coupon dash lines with cutout circles */}
                    <div className="relative my-2.5">
                      <div className="border-t border-dashed border-slate-300" />
                      <div className="absolute -left-[21.5px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-r border-slate-200 z-10" />
                      <div className="absolute -right-[21.5px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-l border-slate-200 z-10" />
                    </div>
 
                    {/* Attributes Grid */}
                    <div className="space-y-2 text-[12.5px]">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Mã số phiếu:</span>
                        <span className="font-semibold text-slate-800 tracking-tight">{selectedExpenseForDetail.expenseNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Ngày chi:</span>
                        <span className="font-semibold text-slate-800">
                          {formatToDDMMYYYY(selectedExpenseForDetail.expenseDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Danh mục chi:</span>
                        <span className="font-semibold text-slate-800">
                          {selectedExpenseForDetail.categoryName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Thanh toán bằng:</span>
                        <span className="font-semibold text-slate-800">
                          {payMethods[selectedExpenseForDetail.paymentMethod] || selectedExpenseForDetail.paymentMethod}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Nhân viên ghi:</span>
                        <span className="font-semibold text-slate-800">
                          {selectedExpenseForDetail.createdByName || "Hệ thống"}
                        </span>
                      </div>
                    </div>
                  </div>
 
                  {/* Diễn giải chi tiết */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Diễn giải nội dung chi:</span>
                    <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl leading-relaxed text-slate-700 italic text-[13px]">
                      &ldquo;{selectedExpenseForDetail.description}&rdquo;
                    </div>
                  </div>
 
                  {/* Action buttons */}
                  <div className="pt-3 border-t border-slate-100 flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => handleStartEdit()}
                      className="flex items-center gap-1.5 px-4 h-[34px] bg-[#0066cc] text-white hover:bg-blue-600 rounded-full text-[12px] font-semibold transition-all cursor-pointer active:scale-95 duration-200"
                    >
                      <Pencil size={12} /> Hiệu chỉnh
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseToDelete(selectedExpenseForDetail)}
                      className="flex items-center gap-1.5 px-4 h-[34px] bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-full text-[12px] font-semibold transition-all border border-rose-100 cursor-pointer active:scale-95 duration-200"
                    >
                      <Trash2 size={12} /> Xóa phiếu
                    </button>
                  </div>
                </div>
              )}
            </KinhPanel>
          )}
        </div>
      </div>
 
      {/* Elegant Add Expense Dialog Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-visible animate-scale-up">
            {/* Dialog Header */}
            <div className="px-6 py-4 bg-[#f5f5f7] border-b border-[#e0e0e0] flex items-center justify-between rounded-t-2xl">
              <h3 className="text-[16px] font-bold text-[#1d1d1f]">Ghi Nhận Khoản Chi Mới</h3>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="p-1 hover:bg-[#e0e0e0]/40 rounded-lg text-[#7a7a7a] hover:text-[#1d1d1f] transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
 
            {/* Dialog Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Category Select with Add Button */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-0.5">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase">Danh mục chi phí *</label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryDialogOpen(true)}
                    className="text-[11px] font-semibold text-[#0066cc] hover:underline hover:text-[#0071e3]"
                  >
                    + Thêm danh mục mới
                  </button>
                </div>
                {isLoadingCategories ? (
                  <div className="text-[12px] text-gray-500 pl-1">Đang tải danh mục...</div>
                ) : categories && categories.length > 0 ? (
                  <CustomSelect
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    value={categoryId}
                    onChange={setCategoryId}
                    placeholder="Chọn danh mục chi..."
                    dropdownWidth="full"
                  />
                ) : (
                  <div className="text-[12px] font-semibold text-red-600 pl-1 flex flex-col gap-1.5">
                    <span>Chưa cấu hình danh mục chi phí trên DB</span>
                  </div>
                )}
              </div>
 
              {/* Optional Warranty Claim Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Liên kết phiếu bảo hành (Tùy chọn)</label>
                {warrantyClaimsSelect && warrantyClaimsSelect.length > 0 ? (
                  <CustomSelect
                    options={[
                      { value: "", label: "-- Không liên kết --" },
                      ...warrantyClaimsSelect.map((c) => ({
                        value: c.id,
                        label: `SN: ${c.serialNumber} (${c.productName}) - Phiếu: ${c.claimNumber}`,
                      })),
                    ]}
                    value={selectedClaimId}
                    onChange={handleClaimSelect}
                    placeholder="Chọn phiếu để tự động nhập Serial..."
                    dropdownWidth="full"
                    searchable={true}
                  />
                ) : (
                  <div className="text-[12px] text-gray-500 pl-1">Chưa có phiếu bảo hành nào để chọn</div>
                )}
              </div>
 
              {/* Amount input formatted in VND */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Số tiền chi (VND) *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatVNDInput(amount)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, "");
                      setAmount(rawValue);
                    }}
                    placeholder="0"
                    className="w-full pl-3 pr-12 py-2 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#7a7a7a]">VNĐ</span>
                </div>
              </div>
 
              {/* Expense Date & Payment Method */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Ngày chi phí *</label>
                  <CustomDatePicker
                    value={expenseDate}
                    onChange={setExpenseDate}
                    placeholder="Chọn ngày chi..."
                    anchorDate="2026-05-30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Thanh toán bằng *</label>
                  <CustomSelect
                    options={[
                      { value: "cash", label: "Tiền mặt" },
                      { value: "bank_transfer", label: "Chuyển khoản" },
                      { value: "card", label: "Thẻ ngân hàng" },
                    ]}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    dropdownWidth="full"
                  />
                </div>
              </div>
 
              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Diễn giải nội dung *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Diễn giải chi tiết nội dung chi tiền..."
                  className="w-full px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  rows={3}
                  required
                />
              </div>
 
              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={expenseMutation.isPending}
                  className="px-5 h-[40px] bg-gray-50 hover:bg-gray-100 border border-[#e0e0e0] text-[#1d1d1f] rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={expenseMutation.isPending}
                  className="px-6 h-[40px] bg-[#0066cc] text-white hover:bg-[#0071e3] rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200 shadow-sm"
                >
                  {expenseMutation.isPending ? "Đang ghi..." : "Ghi nhận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* Elegant Category Management Dialog Modal */}
      {isCategoryDialogOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/45 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl border border-[#e0e0e0] w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh]">
            {/* Dialog Header */}
            <div className="px-6 py-4 bg-[#f5f5f7] border-b border-[#e0e0e0] flex items-center justify-between shrink-0">
              <h3 className="text-[15px] font-bold text-[#1d1d1f]">Quản Lý Danh Mục Chi Phí</h3>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryDialogOpen(false);
                  setEditingCategoryId(null);
                }}
                className="p-1 hover:bg-[#e0e0e0]/40 rounded-lg text-[#7a7a7a] hover:text-[#1d1d1f] transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
 
            {/* Dialog Body - Scrollable content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-[13px] leading-relaxed">
              
              {/* SECTION 1: FORM (CREATE OR EDIT) */}
              {editingCategoryId ? (
                // Edit Category Form
                <div className="p-4 rounded-xl border border-[#0066cc]/20 bg-[#0066cc]/5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[#1d1d1f] text-[14px]">Chỉnh sửa danh mục chi phí</h4>
                    <button
                      type="button"
                      onClick={() => setEditingCategoryId(null)}
                      className="text-[11px] font-semibold text-[#7a7a7a] hover:underline"
                    >
                      Hủy sửa
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Tên danh mục *</label>
                      <input
                        type="text"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                        required
                      />
                    </div>
 
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Loại chi phí *</label>
                      <CustomSelect
                        options={[
                          { value: "variable", label: "Biến động" },
                          { value: "fixed", label: "Cố định" },
                          { value: "one_time", label: "Phát sinh một lần" },
                        ]}
                        value={editCatType}
                        onChange={(val: any) => setEditCatType(val)}
                        dropdownWidth="full"
                      />
                    </div>
 
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Mô tả</label>
                      <textarea
                        value={editCatDesc}
                        onChange={(e) => setEditCatDesc(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                        rows={2}
                      />
                    </div>
 
                    <div className="pt-1 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCategoryId(null)}
                        className="px-4 py-1.5 bg-white border border-[#e0e0e0] text-[#1d1d1f] font-semibold rounded-lg text-[12px]"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!editCatName.trim()) {
                            toast.error("Vui lòng nhập tên danh mục");
                            return;
                          }
                          updateCategoryMutation.mutate({
                            id: editingCategoryId,
                            payload: {
                              name: editCatName,
                              type: editCatType,
                              description: editCatDesc,
                            }
                          });
                        }}
                        disabled={updateCategoryMutation.isPending}
                        className="px-4 py-1.5 bg-[#0066cc] text-white hover:bg-[#0071e3] font-semibold rounded-lg text-[12px] flex items-center gap-1 cursor-pointer"
                      >
                        <Check size={14} />
                        Lưu thay đổi
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Create Category Form
                <div className="p-4 rounded-xl border border-[#e0e0e0] bg-[#f5f5f7]/55 space-y-4">
                  <h4 className="font-bold text-[#1d1d1f] text-[14px]">Thêm danh mục chi phí mới</h4>
                  <form onSubmit={handleCreateCategorySubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Tên danh mục *</label>
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Ví dụ: Chi phí vận chuyển, Lương nhân viên..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                        required
                      />
                    </div>
 
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Loại chi phí *</label>
                      <CustomSelect
                        options={[
                          { value: "variable", label: "Biến động" },
                          { value: "fixed", label: "Cố định" },
                          { value: "one_time", label: "Phát sinh một lần" },
                        ]}
                        value={newCatType}
                        onChange={(val: any) => setNewCatType(val)}
                        dropdownWidth="full"
                      />
                    </div>
 
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Mô tả (Không bắt buộc)</label>
                      <textarea
                        value={newCatDesc}
                        onChange={(e) => setNewCatDesc(e.target.value)}
                        placeholder="Mô tả chi tiết về danh mục chi phí..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                        rows={2}
                      />
                    </div>
 
                    <div className="pt-1 flex justify-end">
                      <button
                        type="submit"
                        disabled={categoryMutation.isPending}
                        className="px-4 h-[34px] bg-[#0066cc] text-white hover:bg-[#0071e3] rounded-lg font-semibold text-[12px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={14} />
                        {categoryMutation.isPending ? "Đang tạo..." : "Thêm mới"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
 
              {/* SECTION 2: CATEGORIES LIST */}
              <div className="space-y-3">
                <h4 className="font-bold text-[#7a7a7a] uppercase tracking-wider pl-0.5 text-[11px]">
                  Danh sách danh mục hiện có ({categories?.length || 0})
                </h4>
 
                <div className="border border-[#e0e0e0] rounded-xl overflow-hidden bg-white max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
                  {categories && categories.length > 0 ? (
                    <div className="divide-y divide-[#e0e0e0]/70">
                      {categories.map((c) => (
                        <div 
                          key={c.id} 
                          className={`p-3.5 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50/50 ${
                            editingCategoryId === c.id ? "bg-[#0066cc]/5" : ""
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#1d1d1f] text-[13px] truncate">{c.name}</span>
                              {c.type === "fixed" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Cố định</span>
                              )}
                              {c.type === "variable" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Biến động</span>
                              )}
                              {c.type === "one_time" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Một lần</span>
                              )}
                            </div>
                            {c.description && (
                              <p className="text-[11.5px] text-[#7a7a7a] font-normal leading-normal">{c.description}</p>
                            )}
                          </div>
 
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(c.id);
                                setEditCatName(c.name);
                                setEditCatType(c.type as any);
                                setEditCatDesc(c.description || "");
                              }}
                              className="p-1.5 rounded-lg bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] transition-all cursor-pointer"
                              title="Chỉnh sửa danh mục"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategoryToDelete(c)}
                              disabled={deleteCategoryMutation.isPending}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-all cursor-pointer"
                              title="Xóa danh mục"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-gray-500 text-center py-6">Chưa có danh mục nào được lập.</p>
                  )}
                </div>
              </div>
 
            </div>
 
            {/* Dialog Footer */}
            <div className="px-6 py-4 bg-[#f5f5f7] border-t border-[#e0e0e0] flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsCategoryDialogOpen(false);
                  setEditingCategoryId(null);
                }}
                className="px-5 h-[36px] bg-[#0066cc] hover:bg-[#0071e3] text-white font-semibold rounded-xl text-[12px] transition-all cursor-pointer shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Sleek Custom Confirm Dialog for Category Deletion */}
      <ConfirmDialog
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete) {
            deleteCategoryMutation.mutate(categoryToDelete.id, {
              onSuccess: (res) => {
                if (res.success) {
                  setCategoryToDelete(null);
                }
              }
            });
          }
        }}
        title="Xác nhận xóa danh mục"
        description={`Bạn chắc chắn muốn xóa danh mục chi phí "${categoryToDelete?.name}"?`}
        confirmText="Xóa danh mục"
        isLoading={deleteCategoryMutation.isPending}
      />
 
      {/* Sleek Custom Confirm Dialog for Expense Deletion */}
      <ConfirmDialog
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={() => {
          if (expenseToDelete) {
            deleteExpenseMutation.mutate(expenseToDelete.id);
          }
        }}
        title="Xác nhận xóa khoản chi phí vận hành"
        description={`Bạn chắc chắn muốn xóa vĩnh viễn khoản chi phí "${expenseToDelete?.expenseNumber}" với số tiền ${formatPrice(expenseToDelete?.amount)}? Giao dịch đối ứng tương ứng trong Sổ quỹ kế toán cũng sẽ tự động được xóa bỏ và tính toán lại toàn bộ dòng tiền lũy kế.`}
        confirmText="Xóa vĩnh viễn"
        cancelText="Giữ lại khoản chi"
        isLoading={deleteExpenseMutation.isPending}
      />
    </div>
  );
}

// Custom Apple-style Inline Date Picker
function InlineDatePicker({
  value,
  onChange,
  label,
  active,
  align = "left",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  active: boolean;
  align?: "left" | "right";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse date
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-");
    if (parts.length !== 3) return new Date(value);
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }, [value]);

  const [viewYear, setViewYear] = useState(() => selectedDate ? selectedDate.getFullYear() : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate ? selectedDate.getMonth() : new Date().getMonth());

  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayValue = useMemo(() => {
    if (!selectedDate) return "";
    const d = String(selectedDate.getDate()).padStart(2, "0");
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const y = selectedDate.getFullYear().toString().slice(-2);
    return `${d}/${m}/${y}`;
  }, [selectedDate]);

  // Calendar math
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const cells: Date[] = [];
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      cells.push(new Date(viewYear, viewMonth - 1, prevMonthDays - i));
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(new Date(viewYear, viewMonth, i));
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push(new Date(viewYear, viewMonth + 1, i));
    }
    return cells;
  }, [viewYear, viewMonth]);

  const isSelected = (d: Date) => {
    if (!selectedDate) return false;
    return d.getDate() === selectedDate.getDate() &&
           d.getMonth() === selectedDate.getMonth() &&
           d.getFullYear() === selectedDate.getFullYear();
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const handleSelectDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };
  const MONTHS_VN = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", 
    "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", 
    "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  return (
    <div ref={containerRef} className="relative select-none shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "h-[40px] rounded-full border px-4 text-[12.5px] font-bold focus:outline-none transition-all flex items-center gap-2 cursor-pointer bg-[#f5f5f7] border-[#e0e0e0] text-[#1d1d1f] hover:bg-[#e8e8ed] active:scale-98 duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          active
            ? "bg-blue-500/10 border-blue-500/30 text-[#0066cc] hover:bg-blue-500/15"
            : ""
        )}
      >
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="tabular-nums">{displayValue}</span>
      </button>
      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-[calc(100%+6px)] w-[240px] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-[#e0e0e0] p-2.5 z-[99] text-slate-800",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#f5f5f7]">
            <span className="text-[12.5px] font-bold">
              {MONTHS_VN[viewMonth]}, {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear(y => y - 1);
                  } else {
                    setViewMonth(m => m - 1);
                  }
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft size={10} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear(y => y + 1);
                  } else {
                    setViewMonth(m => m + 1);
                  }
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronRight size={10} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mt-1.5 text-center">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => (
              <span key={d} className="text-[10px] font-bold text-slate-400 py-0.5">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 mt-0.5">
            {calendarCells.map((cell, idx) => {
              const selected = isSelected(cell);
              const currentMonth = cell.getMonth() === viewMonth;
              const today = isToday(cell);

              return (
                <button
                  type="button"
                  key={idx}
                  onClick={(e) => {
                     e.stopPropagation();
                     handleSelectDate(cell);
                  }}
                  className={cn(
                    "aspect-square w-full rounded-md flex items-center justify-center text-[11.5px] font-medium transition-all active:scale-90 cursor-pointer",
                    selected
                      ? "bg-[#0066cc] text-white font-bold"
                      : today
                      ? "bg-[#0066cc]/10 text-[#0066cc] font-bold"
                      : currentMonth
                      ? "text-slate-800 hover:bg-slate-100"
                      : "text-slate-300 hover:bg-slate-50"
                  )}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom Apple-style Inline Month Picker
function InlineMonthPicker({
  value,
  onChange,
  label,
  active,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  active: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-");
    if (parts.length !== 2) return null;
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10) - 1,
    };
  }, [value]);

  const [viewYear, setViewYear] = useState(() => parsed ? parsed.year : new Date().getFullYear());

  useEffect(() => {
    if (parsed) setViewYear(parsed.year);
  }, [parsed]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayValue = useMemo(() => {
    if (!parsed) return "";
    return `Tháng ${parsed.month + 1}/${parsed.year}`;
  }, [parsed]);

  const handleSelectMonth = (monthIndex: number) => {
    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`);
    setIsOpen(false);
  };

  const isSelected = (monthIndex: number) => {
    if (!parsed) return false;
    return parsed.year === viewYear && parsed.month === monthIndex;
  };

  const MONTHS_VN = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

  return (
    <div ref={containerRef} className="relative select-none shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "h-[40px] rounded-full border px-4 text-[12.5px] font-bold focus:outline-none transition-all flex items-center gap-2 cursor-pointer bg-[#f5f5f7] border-[#e0e0e0] text-[#1d1d1f] hover:bg-[#e8e8ed] active:scale-98 duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
          active
            ? "bg-blue-500/10 border-blue-500/30 text-[#0066cc] hover:bg-blue-500/15"
            : ""
        )}
      >
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="tabular-nums">{displayValue || "Chọn..."}</span>
      </button>

      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-[calc(100%+6px)] right-0 w-[180px] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-[#e0e0e0] p-2.5 z-[99] text-slate-800"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-[#f5f5f7]">
            <span className="text-[12.5px] font-bold">Năm {viewYear}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewYear(y => y - 1);
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft size={10} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewYear(y => y + 1);
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] transition-all active:scale-95 cursor-pointer"
              >
                <ChevronRight size={10} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-2">
            {MONTHS_VN.map((mName, idx) => {
              const selected = isSelected(idx);
              return (
                <button
                  type="button"
                  key={mName}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectMonth(idx);
                  }}
                  className={cn(
                    "py-1.5 rounded-md text-center text-[11.5px] font-medium transition-all active:scale-95 cursor-pointer",
                    selected
                      ? "bg-[#0066cc] text-white font-bold"
                      : "text-slate-800 hover:bg-slate-100"
                  )}
                >
                  {mName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
