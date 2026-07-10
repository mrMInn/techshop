"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getCashBookEntries, 
  getExpenseCategories, 
  getExpenseById, 
  updateExpenseAction, 
  deleteExpenseAction,
  syncHistoricalAccountingDataAction,
  createManualIncome,
  updateManualIncome,
  deleteManualIncome,
  getIncomeCategories,
  createIncomeCategory,
  updateIncomeCategory,
  deleteIncomeCategory,
  getFinancialSummary,
  createExpense,
  createExpenseCategory,
  getWarrantyClaimsForSelect
} from "@/app/actions/accounting";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRealtimeSubscription } from "@/hooks/use-realtime";
import { 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCcw, 
  X, 
  Edit2, 
  Trash2, 
  ArrowRight, 
  AlertCircle, 
  Save,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  Info,
  ShoppingBag,
  Landmark,
  CreditCard,
  Building,
  Zap,
  Truck,
  Wrench,
  HelpCircle,
  Clock,
  CheckCircle2,
  Pencil,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal
} from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";
import { CashBookDonut } from "@/components/accounting/cashbook-donut";
import { SFSymbolArrowUpRight, SFSymbolArrowDownRight } from "@/components/ui/apple-icons";

const categoryLabels: Record<string, string> = {
  sales: "Doanh thu bán lẻ",
  purchase: "Nhập hàng",
  salary: "Lương nhân viên",
  rent: "Chi thuê mặt bằng",
  utility: "Điện nước viễn thông",
  shipping: "Vận chuyển hàng hóa",
  tax: "Nộp thuế nhà nước",
  warranty_repair: "Phí dịch vụ bảo hành",
  other: "Thu chi khác",
};

const categoryOptions = [
  { value: "all", label: "Tất cả danh mục" },
  { value: "sales", label: "Doanh thu bán lẻ" },
  { value: "purchase", label: "Nhập hàng" },
  { value: "salary", label: "Lương nhân viên" },
  { value: "rent", label: "Chi thuê mặt bằng" },
  { value: "utility", label: "Điện nước viễn thông" },
  { value: "shipping", label: "Vận chuyển hàng hóa" },
  { value: "tax", label: "Nộp thuế nhà nước" },
  { value: "warranty_repair", label: "Phí dịch vụ bảo hành" },
  { value: "other", label: "Thu chi khác" },
];

// manualIncomeCategoryOptions has been removed to support dynamic database-driven categories


const categoryMeta: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  sales: { label: "Doanh thu bán lẻ", bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", icon: <ShoppingBag size={14} className="text-emerald-600" /> },
  purchase: { label: "Nhập hàng", bg: "bg-amber-50 border-amber-100", text: "text-amber-700", icon: <Landmark size={14} className="text-amber-600" /> },
  salary: { label: "Lương nhân viên", bg: "bg-violet-50 border-violet-100", text: "text-violet-700", icon: <CreditCard size={14} className="text-violet-600" /> },
  rent: { label: "Chi thuê mặt bằng", bg: "bg-blue-50 border-blue-100", text: "text-blue-700", icon: <Building size={14} className="text-blue-600" /> },
  utility: { label: "Điện nước viễn thông", bg: "bg-orange-50 border-orange-100", text: "text-orange-700", icon: <Zap size={14} className="text-orange-600" /> },
  shipping: { label: "Vận chuyển hàng hóa", bg: "bg-cyan-50 border-cyan-100", text: "text-cyan-700", icon: <Truck size={14} className="text-cyan-600" /> },
  tax: { label: "Nộp thuế nhà nước", bg: "bg-rose-50 border-rose-100", text: "text-rose-700", icon: <Landmark size={14} className="text-rose-600" /> },
  warranty_repair: { label: "Phí dịch vụ bảo hành", bg: "bg-teal-50 border-teal-100", text: "text-teal-700", icon: <Wrench size={14} className="text-teal-600" /> },
  other: { label: "Thu chi khác", bg: "bg-slate-50 border-slate-100", text: "text-slate-700", icon: <HelpCircle size={14} className="text-slate-600" /> },
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

const payMethods: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Thẻ ngân hàng",
};

// Helper function to concatenate classes
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Standard Apple Style clean card container
function KinhPanel({
  children,
  className,
  overflowVisible = false,
}: {
  children: React.ReactNode;
  className?: string;
  overflowVisible?: boolean;
}) {
  return (
    <section
      className={cn(
        "bg-white border border-[#e0e0e0] rounded-[18px] transition-all duration-300 shadow-sm",
        overflowVisible ? "overflow-visible" : "overflow-hidden",
        className
      )}
    >
      <div>{children}</div>
    </section>
  );
}

export default function CashBookPage() {
  const queryClient = useQueryClient();

  // Kích hoạt realtime đồng bộ Sổ quỹ
  useRealtimeSubscription("cash_book_entries", [["cashbook_entries"], ["financial_summary"]]);

  const [type, setType] = useState<any>("");
  const [category, setCategory] = useState("all");
  
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





  // Client-side pagination configuration
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination when any query filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [type, category, startDate, endDate]);

  // Sync historical data silently in the background on load
  useEffect(() => {
    const runBackgroundSync = async () => {
      try {
        await syncHistoricalAccountingDataAction();
        queryClient.refetchQueries({ queryKey: ["cashbook_entries"] });
        queryClient.refetchQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.refetchQueries({ queryKey: ["financial_summary"] });
      } catch (err) {
        console.error("Lỗi đồng bộ ngầm lịch sử:", err);
      }
    };
    runBackgroundSync();
  }, []);

  // Selected Entry for Detail Drawer
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Edit form states
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<any>("cash");

  // Create manual income states
  const [isCreateIncomeOpen, setIsCreateIncomeOpen] = useState(false);
  const [incomeCategory, setIncomeCategory] = useState("other");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDescription, setIncomeDescription] = useState("");
  const [incomeDate, setIncomeDate] = useState("2026-05-30");
  const [incomePaymentMethod, setIncomePaymentMethod] = useState<any>("cash");

  // Create manual expense (phiếu chi) states
  const [isCreateExpenseOpen, setIsCreateExpenseOpen] = useState(false);
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState("2026-05-30");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<any>("cash");

  // Expense Category Management Dialog states
  const [isExpenseCategoryDialogOpen, setIsExpenseCategoryDialogOpen] = useState(false);
  const [newExpCatName, setNewExpCatName] = useState("");
  const [newExpCatType, setNewExpCatType] = useState<"fixed" | "variable" | "one_time">("variable");
  const [newExpCatDesc, setNewExpCatDesc] = useState("");

  // Income Category Management Dialog states
  const [isIncomeCategoryDialogOpen, setIsIncomeCategoryDialogOpen] = useState(false);
  const [newIncCatName, setNewIncCatName] = useState("");
  const [newIncCatDesc, setNewIncCatDesc] = useState("");

  const [editingIncCategoryId, setEditingIncCategoryId] = useState<string | null>(null);
  const [editIncCatName, setEditIncCatName] = useState("");
  const [editIncCatDesc, setEditIncCatDesc] = useState("");
  
  const [incCategoryToDelete, setIncCategoryToDelete] = useState<any>(null);

  const { data: entriesData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cashbook_entries", type, category, startDate, endDate, currentPage],
    queryFn: () => getCashBookEntries({ 
      type: type || undefined,
      category: category || undefined, 
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: currentPage,
      limit: itemsPerPage,
    }),
    placeholderData: (prev: any) => prev,
    staleTime: 15_000,
  });

  const entries = entriesData?.list || [];
  const totalCount = entriesData?.totalCount || 0;

  const { data: financialSummary } = useQuery({
    queryKey: ["financial_summary", "global"],
    queryFn: () => getFinancialSummary(),
    placeholderData: (prev: any) => prev,
    staleTime: 15_000,
  });

  const { data: financialSummaryFiltered } = useQuery({
    queryKey: ["financial_summary", "filtered", category, startDate, endDate],
    queryFn: () => getFinancialSummary({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      category: category !== "all" ? category : undefined,
    }),
    placeholderData: (prev: any) => prev,
    staleTime: 15_000,
  });

  const { data: incomeCategoriesData } = useQuery({
    queryKey: ["income_categories"],
    queryFn: getIncomeCategories,
  });

  const manualIncomeOptions = useMemo(() => {
    if (!incomeCategoriesData) return [];
    return incomeCategoriesData.map((c) => ({
      value: c.id,
      label: c.name,
    }));
  }, [incomeCategoriesData]);

  const dynamicCategoryOptions = useMemo(() => {
    const baseOptions = [
      { value: "all", label: "Tất cả danh mục" },
      { value: "sales", label: "Doanh thu bán lẻ" },
      { value: "purchase", label: "Nhập hàng" },
      { value: "salary", label: "Lương nhân viên" },
      { value: "rent", label: "Chi thuê mặt bằng" },
      { value: "utility", label: "Điện nước viễn thông" },
      { value: "shipping", label: "Vận chuyển hàng hóa" },
      { value: "tax", label: "Nộp thuế nhà nước" },
      { value: "warranty_repair", label: "Phí dịch vụ bảo hành" },
      { value: "other", label: "Thu chi khác" },
    ];
    
    if (incomeCategoriesData) {
      incomeCategoriesData.forEach((c) => {
        if (!["sales", "warranty_repair", "other", "Doanh thu bán lẻ", "Phí dịch vụ bảo hành", "Thu nhập khác"].includes(c.name)) {
          if (!baseOptions.some(opt => opt.value === c.id)) {
            baseOptions.push({ value: c.id, label: `Thu: ${c.name}` });
          }
        }
      });
    }
    return baseOptions;
  }, [incomeCategoriesData]);

  useEffect(() => {
    if (incomeCategoriesData && incomeCategoriesData.length > 0) {
      const defaultCat = incomeCategoriesData.find(c => c.name.includes("khác") || c.id === '10000000-0000-0000-0000-000000000003') || incomeCategoriesData[0];
      if (defaultCat && (incomeCategory === "other" || incomeCategory === "")) {
        setIncomeCategory(defaultCat.id);
      }
    }
  }, [incomeCategoriesData, incomeCategory]);

  const filteredEntries = entries;
  const paginatedEntries = entries;
  const totalPages = useMemo(() => {
    return Math.ceil(totalCount / itemsPerPage);
  }, [totalCount, itemsPerPage]);

  const { data: categoriesData } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: getExpenseCategories,
  });

  const manualExpenseOptions = useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.map((c) => ({
      value: c.id,
      label: c.name,
    }));
  }, [categoriesData]);

  const { data: expenseDetails, isLoading: isLoadingExpenseDetails } = useQuery({
    queryKey: ["expense_details", selectedEntry?.referenceId],
    queryFn: () => getExpenseById(selectedEntry.referenceId),
    enabled: !!selectedEntry && selectedEntry.referenceType === "expense",
  });

  // Automatically fill edit form when details are fetched
  useEffect(() => {
    if (expenseDetails && isEditing) {
      setEditCategoryId(expenseDetails.categoryId || "");
      const rawAmt = expenseDetails.amount ? Math.round(Number(expenseDetails.amount)).toString() : "";
      setEditAmount(rawAmt);
      setEditDescription(expenseDetails.description || "");
      setEditExpenseDate(expenseDetails.expenseDate || "");
      setEditPaymentMethod(expenseDetails.paymentMethod || "cash");
    }
  }, [expenseDetails, isEditing]);

  const updateMutation = useMutation({
    mutationFn: updateExpenseAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setIsEditing(false);
        setSelectedEntry(null);
      } else {
        toast.error(res.message);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpenseAction,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setIsConfirmDeleteOpen(false);
        setSelectedEntry(null);
      } else {
        toast.error(res.message);
      }
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        
        // Reset form
        setExpenseCategoryId("");
        setExpenseAmount("");
        setExpenseDescription("");
        setExpenseDate("2026-05-30");
        setExpensePaymentMethod("cash");
        setIsCreateExpenseOpen(false);
      } else {
        toast.error(res.message);
      }
    },
  });

  const createExpenseCategoryMutation = useMutation({
    mutationFn: createExpenseCategory,
    onSuccess: (res) => {
      if (res.success && res.category) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
        setExpenseCategoryId(res.category.id);
        setNewExpCatName("");
        setNewExpCatDesc("");
        setIsExpenseCategoryDialogOpen(false);
      } else {
        toast.error(res.message);
      }
    },
  });

  const handleCreateExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseCategoryId) {
      toast.error("Vui lòng chọn danh mục chi phí");
      return;
    }
    const cleanAmount = parseInt(expenseAmount.replace(/\D/g, ""), 10);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      toast.error("Vui lòng nhập số tiền chi hợp lệ");
      return;
    }
    if (!expenseDate) {
      toast.error("Vui lòng chọn ngày chi");
      return;
    }

    createExpenseMutation.mutate({
      categoryId: expenseCategoryId,
      amount: cleanAmount.toString(),
      description: expenseDescription,
      expenseDate,
      paymentMethod: expensePaymentMethod,
    });
  };

  const handleCreateExpenseCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpCatName.trim()) {
      toast.error("Vui lòng nhập tên danh mục chi phí");
      return;
    }
    createExpenseCategoryMutation.mutate({
      name: newExpCatName.trim(),
      type: newExpCatType,
      description: newExpCatDesc.trim(),
    });
  };

  const createManualIncomeMutation = useMutation({
    mutationFn: createManualIncome,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setIncomeAmount("");
        const defaultCat = incomeCategoriesData?.find(c => c.name.includes("khác") || c.id === '10000000-0000-0000-0000-000000000003') || incomeCategoriesData?.[0];
        setIncomeCategory(defaultCat?.id || "");
        setIncomeDescription("");
        setIncomeDate("2026-05-30");
        setIncomePaymentMethod("cash");
        setIsCreateIncomeOpen(false);
      } else {
        toast.error(res.message);
      }
    },
  });

  const createIncomeCategoryMutation = useMutation({
    mutationFn: createIncomeCategory,
    onSuccess: (res) => {
      if (res.success && res.category) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["income_categories"] });
        setNewIncCatName("");
        setNewIncCatDesc("");
        if (isCreateIncomeOpen) {
          setIncomeCategory(res.category.id);
        } else if (isEditing) {
          setEditCategoryId(res.category.id);
        }
      } else {
        toast.error(res.message);
      }
    },
  });

  const updateIncomeCategoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; description?: string } }) =>
      updateIncomeCategory(id, payload),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["income_categories"] });
        setEditingIncCategoryId(null);
      } else {
        toast.error(res.message);
      }
    },
  });

  const deleteIncomeCategoryMutation = useMutation({
    mutationFn: deleteIncomeCategory,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["income_categories"] });
      } else {
        toast.error(res.message);
      }
    },
  });

  const updateManualIncomeMutation = useMutation({
    mutationFn: updateManualIncome,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setIsEditing(false);
        setSelectedEntry(null);
      } else {
        toast.error(res.message);
      }
    },
  });

  const deleteManualIncomeMutation = useMutation({
    mutationFn: deleteManualIncome,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["cashbook_entries"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_bento_stats"] });
        queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
        setIsConfirmDeleteOpen(false);
        setSelectedEntry(null);
      } else {
        toast.error(res.message);
      }
    },
  });

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEntry.referenceType === null) {
      if (!editCategoryId) {
        toast.error("Vui lòng chọn danh mục thu nhập");
        return;
      }
      if (!editAmount || Number(editAmount) <= 0) {
        toast.error("Vui lòng nhập số tiền thu lớn hơn 0đ");
        return;
      }
      if (!editDescription.trim()) {
        toast.error("Vui lòng nhập nội dung diễn giải");
        return;
      }

      updateManualIncomeMutation.mutate({
        id: selectedEntry.id,
        incomeCategoryId: editCategoryId,
        amount: editAmount,
        description: editDescription,
        entryDate: editExpenseDate,
        paymentMethod: editPaymentMethod,
      });
    } else {
      if (!editCategoryId) {
        toast.error("Vui lòng chọn danh mục chi phí");
        return;
      }
      if (!editAmount || Number(editAmount) <= 0) {
        toast.error("Vui lòng nhập số tiền chi lớn hơn 0đ");
        return;
      }
      if (!editDescription.trim()) {
        toast.error("Vui lòng nhập nội dung diễn giải");
        return;
      }

      updateMutation.mutate({
        id: selectedEntry.referenceId,
        categoryId: editCategoryId,
        amount: editAmount,
        description: editDescription,
        expenseDate: editExpenseDate,
        paymentMethod: editPaymentMethod,
      });
    }
  };

  const handleCreateIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeCategory) {
      toast.error("Vui lòng chọn danh mục thu nhập");
      return;
    }
    if (!incomeAmount || Number(incomeAmount) <= 0) {
      toast.error("Vui lòng nhập số tiền thu lớn hơn 0đ");
      return;
    }
    if (!incomeDescription.trim()) {
      toast.error("Vui lòng nhập nội dung diễn giải");
      return;
    }

    createManualIncomeMutation.mutate({
      incomeCategoryId: incomeCategory,
      amount: incomeAmount,
      description: incomeDescription,
      entryDate: incomeDate,
      paymentMethod: incomePaymentMethod,
    });
  };

  // Ref cache để tránh nhấp nháy 0đ khi data đang refetch
  const lastTotalsRef = useRef({ income: 0, expense: 0 });

  // Real-time KPI Card summary calculations based on fetched list
  const totals = useMemo(() => {
    if (!financialSummaryFiltered) return lastTotalsRef.current;
    const result = {
      income: Number(financialSummaryFiltered.totalIncome || 0),
      expense: Number(financialSummaryFiltered.totalExpense || 0),
    };
    lastTotalsRef.current = result;
    return result;
  }, [financialSummaryFiltered]);

  // Cân đối Dòng tiền percentages for Balance Meter
  const flowPercentages = useMemo(() => {
    const total = totals.income + totals.expense;
    if (total === 0) return { income: 50, expense: 50 };
    return {
      income: (totals.income / total) * 100,
      expense: (totals.expense / total) * 100,
    };
  }, [totals]);

  // Số dư lũy kế thực tế (Toàn thời gian, không bị ảnh hưởng bởi filter khoảng thời gian)
  const lastBalanceRef = useRef(0);
  const cumulativeBalance = useMemo(() => {
    if (!financialSummary) return lastBalanceRef.current;
    const val = Number(financialSummary.totalIncome || 0) - Number(financialSummary.totalExpense || 0);
    lastBalanceRef.current = val;
    return val;
  }, [financialSummary]);



  const handleQuickPeriod = (period: "this_month" | "last_30" | "this_year") => {
    const today = new Date(); // Sử dụng ngày hệ thống thực tế động
    const year = today.getFullYear();
    const month = today.getMonth();

    if (period === "this_month") {
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      setStartDate(first.toISOString().split("T")[0]);
      setEndDate(last.toISOString().split("T")[0]);
    } else if (period === "last_30") {
      const prior = new Date(today);
      prior.setDate(today.getDate() - 30);
      setStartDate(prior.toISOString().split("T")[0]);
      setEndDate(today.toISOString().split("T")[0]);
    } else if (period === "this_year") {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    }
    toast.success("Đã lọc theo khoảng thời gian nhanh");
  };

  const formatPrice = (price: string | number) => {
    return Math.round(Number(price || 0)).toLocaleString("vi-VN") + "đ";
  };

  const formatVNDInput = (value: string) => {
    if (!value) return "";
    const num = parseInt(value.replace(/\D/g, ""), 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("vi-VN");
  };

  return (
    <div 
      className="space-y-6 font-sans relative z-10"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
    >
      {/* 1. Header Section - Apple premium single-row layout */}
      <div className="pb-6 border-b border-[#e0e0e0]">
        <div className="flex flex-wrap items-center gap-3 justify-start">
          
          {/* Status Segmented Control */}
          <div className="relative flex bg-[#f5f5f7] p-[3px] rounded-full border border-[#e0e0e0] h-[40px] w-full sm:w-[680px] shrink-0 select-none overflow-hidden">
            {/* Sliding active indicator */}
            <div 
              className="absolute top-[3px] bottom-[3px] rounded-full bg-[#0066cc] shadow-[0_2px_4px_rgba(0,102,204,0.25)]"
              style={{
                width: "calc(33.333% - 6px)",
                left: `calc(${(type === "" ? 0 : type === "income" ? 1 : 2) * 33.333}% + 3px)`,
                transition: "left 280ms cubic-bezier(0.16, 1, 0.3, 1)"
              }}
            />

            {/* Tab 1: Tất cả */}
            <button
              onClick={() => setType("")}
              className={`w-1/3 h-full relative z-10 flex items-center justify-center gap-1.5 px-2 rounded-full text-[12.5px] transition-colors duration-200 cursor-pointer active:scale-98 ${
                type === "" ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 transition-all duration-200 ${
                type === ""
                  ? "bg-transparent shadow-none"
                  : "bg-gradient-to-br from-[#2ea1ff] to-[#0066cc] shadow-[0_1px_2px_rgba(0,102,204,0.1)]"
              }`}>
                <Wallet size={type === "" ? 12 : 9} className="transition-all duration-200" />
              </div>
              <span className="whitespace-nowrap">Tất cả</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors duration-200 ${type === "" ? "bg-white text-[#0066cc] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "bg-slate-200 text-slate-800 border border-slate-300/20"}`}>
                {formatPrice(cumulativeBalance)}
              </span>
            </button>

            {/* Tab 2: Thu */}
            <button
              onClick={() => setType("income")}
              className={`w-1/3 h-full relative z-10 flex items-center justify-center gap-1.5 px-2 rounded-full text-[12.5px] transition-colors duration-200 cursor-pointer active:scale-98 ${
                type === "income" ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 transition-all duration-200 ${
                type === "income"
                  ? "bg-transparent shadow-none"
                  : "bg-gradient-to-br from-[#34c759] to-[#28a745] shadow-[0_1px_2px_rgba(52,199,89,0.1)]"
              }`}>
                <SFSymbolArrowUpRight size={type === "income" ? 12 : 9} className="transition-all duration-200" />
              </div>
              <span className="whitespace-nowrap">Tổng thu</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors duration-200 ${type === "income" ? "bg-white text-[#0066cc] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "bg-slate-200 text-slate-800 border border-slate-300/20"}`}>
                {formatPrice(totals.income)}
              </span>
            </button>

            {/* Tab 3: Chi */}
            <button
              onClick={() => setType("expense")}
              className={`w-1/3 h-full relative z-10 flex items-center justify-center gap-1.5 px-2 rounded-full text-[12.5px] transition-colors duration-200 cursor-pointer active:scale-98 ${
                type === "expense" ? "text-white font-semibold" : "text-[#7a7a7a] hover:text-[#1d1d1f] font-medium"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 transition-all duration-200 ${
                type === "expense"
                  ? "bg-transparent shadow-none"
                  : "bg-gradient-to-br from-[#ff2d55] to-[#d6001c] shadow-[0_1px_2px_rgba(255,45,85,0.15)]"
              }`}>
                <SFSymbolArrowDownRight size={type === "expense" ? 12 : 9} className="transition-all duration-200" />
              </div>
              <span className="whitespace-nowrap">Tổng chi</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors duration-200 ${type === "expense" ? "bg-white text-[#0066cc] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "bg-slate-200 text-slate-800 border border-slate-300/20"}`}>
                {formatPrice(totals.expense)}
              </span>
            </button>
          </div>

          {/* Cán cân ngân quỹ (Balance Meter) - Compact Apple style */}
          <div className="flex items-center gap-2 bg-[#f5f5f7] px-4 py-2 rounded-full border border-[#e0e0e0] h-[40px] w-full sm:w-[350px] shrink-0 select-none">
            <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Cán cân:</span>
            {/* Glowing HSL percentage bar meter */}
            <div className="flex-1 h-2 rounded-full bg-slate-200/50 overflow-hidden flex border border-white/60 shadow-inner">
              <div 
                style={{ width: `${flowPercentages.income}%` }} 
                className="h-full bg-gradient-to-r from-[#007aff] to-[#0056b3] shadow-[0_0_6px_rgba(0,122,255,0.2)] transition-all duration-500" 
                title={`Thu: ${flowPercentages.income.toFixed(0)}%`}
              />
              <div 
                style={{ width: `${flowPercentages.expense}%` }} 
                className="h-full bg-gradient-to-r from-[#ff9500] to-[#e68100] shadow-[0_0_6px_rgba(255,149,0,0.2)] transition-all duration-500" 
                title={`Chi: ${flowPercentages.expense.toFixed(0)}%`}
              />
            </div>
            {/* Legend-colored percentage numbers */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold select-none whitespace-nowrap leading-none">
              <span className="flex items-center gap-1 text-[#007aff] tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-[#007aff]" />
                Thu: {flowPercentages.income.toFixed(0)}%
              </span>
              <span className="text-slate-400 font-normal">/</span>
              <span className="flex items-center gap-1 text-[#ff9500] tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff9500]" />
                Chi: {flowPercentages.expense.toFixed(0)}%
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Structured Filters & Date Range Controls */}
      <KinhPanel className="p-4 shadow-sm relative z-20" overflowVisible={true}>
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 w-full">


          {/* Category select dropdown styled as a Filter Button */}
          <div className="w-[180px] shrink-0">
            <CustomSelect
              options={dynamicCategoryOptions}
              value={category}
              onChange={setCategory}
              placeholder="Danh mục"
              dropdownWidth="wide"
              size="sm"
              rounded="full"
              triggerIcon={<SlidersHorizontal size={13} className="text-slate-500" />}
            />
          </div>

          {/* Timeframe Selector (Tuần / Tháng / Năm) - Standard sliding Segmented Control */}
          <div className="relative flex bg-[#f5f5f7] border border-[#e0e0e0] p-[3px] rounded-full w-[185px] h-9 select-none z-10 shrink-0 overflow-hidden">
            {/* Sliding Active Capsule Overlay */}
            <div
              className="absolute top-[3px] bottom-[3px] rounded-full bg-[#0066cc] shadow-[0_2px_4px_rgba(0,102,204,0.25)]"
              style={{
                width: "calc(33.333% - 6px)",
                left: `calc(${(activeTimeframe === "weekly" ? 0 : activeTimeframe === "monthly" ? 1 : 2) * 33.333}% + 3px)`,
                opacity: (activeTimeframe === "weekly" || activeTimeframe === "monthly" || activeTimeframe === "yearly") ? 1 : 0,
                transition: "left 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms"
              }}
            />

            <button
              onClick={() => setActiveTimeframe("weekly")}
              className={`relative z-10 flex-1 h-full text-[12px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] ${
                activeTimeframe === "weekly" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
              }`}
            >
              Tuần
            </button>
            <button
              onClick={() => setActiveTimeframe("monthly")}
              className={`relative z-10 flex-1 h-full text-[12px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] ${
                activeTimeframe === "monthly" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
              }`}
            >
              Tháng
            </button>
            <button
              onClick={() => setActiveTimeframe("yearly")}
              className={`relative z-10 flex-1 h-full text-[12px] transition-colors duration-200 cursor-pointer flex items-center justify-center rounded-full focus:outline-none active:scale-[0.98] ${
                activeTimeframe === "yearly" ? "text-white font-bold" : "text-slate-600 font-semibold hover:text-slate-900"
              }`}
            >
              Năm
            </button>
          </div>

          {/* From Date to Date Picker Inline */}
          <div
            onClick={() => setActiveTimeframe("custom")}
            className={cn(
              "h-9 rounded-full px-2 text-[12px] font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer select-none border shrink-0",
              activeTimeframe === "custom"
                ? "bg-white border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-slate-800"
                : "bg-white/60 border-white/80 text-slate-700 hover:bg-white/85"
            )}
          >
            <InlineDatePicker
              label="Từ:"
              value={customStartDate}
              active={activeTimeframe === "custom"}
              onChange={(val) => {
                setCustomStartDate(val);
                setActiveTimeframe("custom");
                if (customEndDate && val > customEndDate) {
                  setCustomEndDate(val);
                }
              }}
            />
            <InlineDatePicker
              label="đến:"
              value={customEndDate}
              active={activeTimeframe === "custom"}
              onChange={(val) => {
                setCustomEndDate(val);
                setActiveTimeframe("custom");
                if (customStartDate && val < customStartDate) {
                  setCustomStartDate(val);
                }
              }}
            />
          </div>

          {/* Specific Month Selector Inline */}
          <div
            onClick={() => setActiveTimeframe("month-select")}
            className={cn(
              "h-9 rounded-full px-2 text-[12px] font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer select-none border shrink-0",
              activeTimeframe === "month-select"
                ? "bg-white border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-slate-800"
                : "bg-white/60 border-white/80 text-slate-700 hover:bg-white/85"
            )}
          >
            <InlineMonthPicker
              label="Chọn tháng:"
              value={selectedSpecificMonth}
              active={activeTimeframe === "month-select"}
              onChange={(val) => {
                setSelectedSpecificMonth(val);
                setActiveTimeframe("month-select");
              }}
            />
          </div>

          {/* Action & Refresh Group */}
          <div className="flex items-center gap-2 sm:ml-auto shrink-0">
            <button
              onClick={() => {
                setIncomeDate(new Date().toISOString().split("T")[0]);
                setIsCreateIncomeOpen(true);
              }}
              className="px-3.5 h-9 bg-[#0066cc] hover:bg-[#0055b3] active:scale-[0.97] text-white text-[12px] font-bold rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none shadow-[0_2px_6px_rgba(0,102,204,0.15)] hover:shadow-[0_4px_12px_rgba(0,102,204,0.25)] border border-[#0066cc]/10"
            >
              <ArrowUpRight size={13} className="stroke-[2.5]" />
              Tạo phiếu thu
            </button>

            <button
              onClick={() => {
                setExpenseDate(new Date().toISOString().split("T")[0]);
                setIsCreateExpenseOpen(true);
              }}
              className="px-3.5 h-9 bg-[#ff2d55] hover:bg-[#d6001c] active:scale-[0.97] text-white text-[12px] font-bold rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none shadow-[0_2px_6px_rgba(255,45,85,0.15)] hover:shadow-[0_4px_12px_rgba(255,45,85,0.25)] border border-[#ff2d55]/10"
            >
              <ArrowDownRight size={13} className="stroke-[2.5]" />
              Tạo phiếu chi
            </button>

            <button
              onClick={() => refetch()}
              className="w-9 h-9 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-slate-600 hover:text-slate-900 rounded-full transition-all border border-[#e0e0e0] cursor-pointer flex items-center justify-center shadow-sm active:scale-[0.95]"
              title="Làm mới sổ quỹ"
            >
              <RefreshCcw size={13} className={isFetching ? "animate-spin text-[#0066cc]" : ""} />
            </button>
          </div>

        </div>
      </KinhPanel>


      {/* 3. Dual-Pane Analysis Workspace (Co-existing feed and Voucher detail panel) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Left Pane (70% - xl:col-span-2) - Grouped Transaction Ledger Feed */}
        <div className="xl:col-span-2 space-y-4">
          
          {isLoading ? (
            <div className="bg-white/45 backdrop-blur-xl rounded-[28px] border border-white/70 flex flex-col items-center justify-center py-28 text-slate-500 shadow-sm">
              <Loader2 className="animate-spin mb-3 text-[#0071e3]" size={28} />
              <p className="text-[14px] font-bold text-slate-800">Đang tải sổ quỹ...</p>
              <p className="text-[12px] text-slate-500 mt-1">Vui lòng chờ trong giây lát</p>
            </div>
          ) : filteredEntries && filteredEntries.length > 0 ? (
            <KinhPanel className="shadow-sm overflow-hidden flex flex-col justify-between">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0 table-fixed min-w-[700px]">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                      <th className="py-3 px-3 w-[7%] text-center border-b border-slate-200 bg-slate-50">STT</th>
                      <th className="py-3 px-3 w-[18%] border-b border-slate-200 bg-slate-50">Số chứng từ</th>
                      <th className="py-3 px-3 w-[15%] border-b border-slate-200 bg-slate-50">Ngày hạch toán</th>
                      <th className="py-3 px-3 w-[12%] text-center border-b border-slate-200 bg-slate-50">Phân loại</th>
                      <th className="py-3 px-3 w-[23%] border-b border-slate-200 bg-slate-50">Diễn giải nội dung</th>
                      <th className="py-3 px-3 w-[18%] text-right border-b border-slate-200 bg-slate-50">Số tiền</th>
                      <th className="py-3 px-3 w-[19%] text-right pr-4 border-b border-slate-200 bg-slate-50">Số dư lũy kế</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] text-slate-800">
                    {paginatedEntries.map((entry, index) => {
                      const amt = Number(entry.amount || 0);
                      const isIncome = entry.type === "income";
                      const isSelected = selectedEntry?.id === entry.id;
                      const stt = (currentPage - 1) * itemsPerPage + index + 1;
 
                      return (
                        <tr
                          key={entry.id}
                          onClick={() => {
                            setSelectedEntry(entry);
                            setIsEditing(false);
                          }}
                          className="group cursor-pointer select-none"
                        >
                          {/* STT */}
                          <td className={`py-3 px-3 text-center font-bold text-[12px] transition-all ${
                            isSelected 
                              ? "text-[#0066cc] bg-[#0066cc]/8 group-hover:bg-[#0066cc]/12 border-y border-l border-[#0066cc]/25 rounded-l-xl" 
                              : "text-slate-400 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`}>
                            {stt}
                          </td>
 
                          {/* Số chứng từ */}
                          <td className={`py-3 px-3 truncate whitespace-nowrap transition-all ${
                            isSelected 
                              ? "bg-[#0066cc]/8 group-hover:bg-[#0066cc]/12 border-y border-[#0066cc]/25 text-[#0066cc]" 
                              : "border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`} title={entry.entryNumber}>
                            <span className={`text-[12px] tracking-tight truncate block max-w-[100px] ${isSelected ? "text-[#0066cc] font-bold" : "font-semibold text-slate-700"}`}>
                              {entry.entryNumber}
                            </span>
                          </td>
 
                          {/* Ngày hạch toán */}
                          <td className={`py-3 px-3 font-medium whitespace-nowrap text-[12px] transition-all ${
                            isSelected 
                              ? "bg-[#0066cc]/8 group-hover:bg-[#0066cc]/12 border-y border-[#0066cc]/25 text-slate-700" 
                              : "text-slate-500 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`}>
                            {formatToDDMMYYYY(entry.entryDate)}
                          </td>
 
                          {/* Phân loại */}
                          <td className={`py-3 px-3 text-center transition-all ${
                            isSelected 
                              ? "bg-[#0066cc]/8 group-hover:bg-[#0066cc]/12 border-y border-[#0066cc]/25" 
                              : "border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`}>
                            <span className={`text-[12px] font-bold ${
                              isIncome 
                                ? "text-emerald-600" 
                                : "text-rose-600"
                            }`}>
                              {isIncome ? "THU" : "CHI"}
                            </span>
                          </td>
 
                          {/* Diễn giải nội dung */}
                          <td className={`py-3 px-3 font-medium truncate transition-all ${
                            isSelected 
                              ? "bg-[#0066cc]/8 group-hover:bg-[#0066cc]/12 border-y border-[#0066cc]/25 text-slate-700" 
                              : "text-slate-700 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`} title={entry.description}>
                            {entry.description}
                          </td>
 
                          {/* Số tiền */}
                          <td className={`py-3 px-3 text-right whitespace-nowrap transition-all ${
                            isSelected 
                              ? "bg-[#0066cc]/8 group-hover:bg-[#0066cc]/12 border-y border-[#0066cc]/25" 
                              : "border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`}>
                            <span className={`text-[13px] font-bold tracking-tight ${
                              isIncome ? "text-emerald-600" : "text-rose-600"
                            }`}>
                              {isIncome ? "+" : "-"}
                              {Math.round(amt).toLocaleString("vi-VN")}đ
                            </span>
                          </td>
 
                          {/* Số dư lũy kế */}
                          <td className={`py-3 px-3 text-right pr-4 whitespace-nowrap transition-all ${
                            isSelected 
                              ? "bg-[#0066cc]/8 group-hover:bg-[#0066cc]/12 border-y border-r border-[#0066cc]/25 rounded-r-xl text-slate-700" 
                              : "text-slate-500 border-b border-slate-100 group-hover:bg-[#0071e3]/4"
                          }`}>
                            <span className={`text-[12px] font-semibold ${isSelected ? "text-slate-700" : "text-slate-500"}`}>
                              {Math.round(Number(entry.runningBalance || 0)).toLocaleString("vi-VN")}đ
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
 
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-white/20 select-none gap-3">
                  <span className="text-[12px] font-medium text-slate-500">
                    Hiển thị dòng {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredEntries.length)} trong tổng số {filteredEntries.length} chứng từ
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      Trang trước
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        const isActive = currentPage === pageNum;
                        return (
                           <button
                             key={pageNum}
                             type="button"
                             onClick={() => setCurrentPage(pageNum)}
                             className={`w-7.5 h-7.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer flex items-center justify-center active:scale-90 ${
                               isActive 
                                 ? "bg-[#0071e3] text-white shadow-md shadow-blue-500/20" 
                                 : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                             }`}
                           >
                             {pageNum}
                           </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </KinhPanel>
          ) : (
            <KinhPanel className="p-12 text-center shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-slate-100/60 flex items-center justify-center text-slate-400 mx-auto mb-3 border border-slate-200 shadow-inner">
                <AlertCircle size={20} className="text-slate-500" />
              </div>
              <h5 className="text-[14px] font-bold text-slate-900">Sổ quỹ chưa ghi nhận giao dịch</h5>
              <p className="text-[12px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Không tìm thấy dòng tiền thu chi nào khớp với bộ lọc tìm kiếm của bạn. Hãy thử thay đổi mốc ngày hoặc chọn danh mục khác.
              </p>
            </KinhPanel>
          )}

        </div>

        {/* Right Pane (30% - xl:col-span-1) - Dynamic Workspace Detail/Donut Panel */}
        <div className="xl:col-span-1 space-y-5 sticky top-6">
          
          {!selectedEntry ? (
            /* Standard Mode: Show Donut Chart and helpful guidelines */
            <div className="space-y-5">
              
              {/* Custom SVG Donut Chart */}
              <KinhPanel className="p-4">
                <CashBookDonut expenseCategoryStats={financialSummaryFiltered?.expenseCategoryStats} />
              </KinhPanel>

            </div>
          ) : (
            /* Selected Mode: Slide-in voucher detail and inline editor slip */
            <KinhPanel className="shadow-sm p-4.5 space-y-4 relative transition-all duration-300" overflowVisible={true}>
              
              {/* Voucher panel header */}
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
                      <span>Chi tiết phiếu</span>
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEntry(null);
                    setIsEditing(false);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                  title="Đóng panel"
                >
                  <X size={15} />
                </button>
              </div>

              {/* View/Edit Voucher Toggle Slots */}
              {isEditing ? (
                /* Edit manual slip view */
                (selectedEntry.referenceType === "expense" && isLoadingExpenseDetails) ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <Loader2 className="animate-spin mb-2.5 text-[#0066cc]" size={24} />
                    <p className="text-[13px] font-bold text-slate-800">Đang tải chi tiết...</p>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateSubmit} className="space-y-3.5">
                    
                    {/* Category */}
                    <div className="space-y-1.5">
                      {selectedEntry.referenceType === null ? (
                        <>
                          <div className="flex items-center justify-between pl-0.5">
                            <label className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wide">
                              Danh mục thu nhập *
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsIncomeCategoryDialogOpen(true)}
                              className="text-[11px] font-semibold text-[#0066cc] hover:underline hover:text-[#0071e3]"
                            >
                              + Quản lý danh mục
                            </button>
                          </div>
                          <CustomSelect
                            options={manualIncomeOptions}
                            value={editCategoryId}
                            onChange={setEditCategoryId}
                            dropdownWidth="full"
                            size="sm"
                          />
                        </>
                      ) : (
                        <>
                          <label className="text-[11.5px] font-semibold text-slate-500 uppercase pl-0.5 tracking-wide">
                            Danh mục chi phí *
                          </label>
                          {categoriesData && categoriesData.length > 0 ? (
                            <CustomSelect
                              options={categoriesData.map((c) => ({ value: c.id, label: c.name }))}
                              value={editCategoryId}
                              onChange={setEditCategoryId}
                              dropdownWidth="full"
                              size="sm"
                            />
                          ) : (
                            <div className="text-[13px] text-slate-400 pl-1 font-semibold">Đang tải danh mục...</div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="space-y-1.5">
                      <label className="text-[11.5px] font-semibold text-slate-500 uppercase pl-0.5 tracking-wide">
                        {selectedEntry.referenceType === null ? "Số tiền thu (VND) *" : "Số tiền chi (VND) *"}
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
                        <label className="text-[11.5px] font-semibold text-slate-500 uppercase pl-0.5 tracking-wide">
                          {selectedEntry.referenceType === null ? "Ngày thu *" : "Ngày chi *"}
                        </label>
                        <CustomDatePicker
                          value={editExpenseDate}
                          onChange={setEditExpenseDate}
                          size="sm"
                          placeholder={selectedEntry.referenceType === null ? "Chọn ngày thu..." : "Chọn ngày chi..."}
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
                          className="px-4 h-[34px] bg-[#fafafc] hover:bg-[#f5f5f7] border border-[#e0e0e0] text-slate-700 rounded-lg text-[12px] font-semibold transition-all cursor-pointer active:scale-[0.97]"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={updateMutation.isPending || updateManualIncomeMutation.isPending}
                          className="flex items-center justify-center gap-1.5 px-4.5 h-[34px] bg-[#0066cc] text-white hover:bg-blue-600 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-[0.97] shadow-sm"
                        >
                          {updateMutation.isPending || updateManualIncomeMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsConfirmDeleteOpen(true)}
                        className="w-full flex items-center justify-center gap-1.5 h-[34px] bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-[12px] font-semibold transition-all border border-rose-200 cursor-pointer active:scale-[0.97]"
                      >
                        <Trash2 size={13} /> Xóa chứng từ
                      </button>
                    </div>

                  </form>
                )
              ) : (
                /* High-fidelity Receipt Voucher Slip layout */
                <div className="space-y-4">
                  
                

                  {/* Coupon layout voucher box */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] relative overflow-hidden">
                    
                    {/* Voucher Header with Stamp Badge */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider">TICKET VOUCHER</span>
                      {selectedEntry.type === "income" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider shadow-sm">
                          Thu quỹ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white uppercase tracking-wider shadow-sm">
                          Chi quỹ
                        </span>
                      )}
                    </div>

                    {/* Big Amount Spot */}
                    <div className="text-center py-4">
                      <p className="text-[10.5px] font-semibold text-[#7a7a7a] uppercase tracking-wide leading-none">Số tiền hạch toán</p>
                      <h2 className={`text-[21px] font-bold mt-1.5 leading-none tracking-tight tabular-nums ${
                        selectedEntry.type === "income" ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {selectedEntry.type === "income" ? "+" : "-"}
                        {Math.round(Number(selectedEntry.amount)).toLocaleString("vi-VN")}đ
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
                        <span className="font-semibold text-slate-800 tracking-tight">{selectedEntry.entryNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Ngày ghi nhận:</span>
                        <span className="font-semibold text-slate-800">
                          {formatToDDMMYYYY(selectedEntry.entryDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Phân loại danh mục:</span>
                        <span className="font-semibold text-slate-800">
                          {selectedEntry.incomeCategoryName || categoryLabels[selectedEntry.category] || selectedEntry.category}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Thanh toán bằng:</span>
                        <span className="font-semibold text-slate-800">
                          {payMethods[selectedEntry.paymentMethod] || selectedEntry.paymentMethod}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Số dư ngân quỹ lũy kế:</span>
                        <span className="font-bold text-[#0066cc] tracking-tight">{formatPrice(selectedEntry.runningBalance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-400">Nguồn gốc dữ liệu:</span>
                        <span className="font-semibold text-slate-500 text-right">
                          {selectedEntry.referenceType === "order" ? (
                            "Đơn hàng (Tự động)"
                          ) : selectedEntry.referenceType === "purchase_order" ? (
                            "Nhập hàng PO (Tự động)"
                          ) : selectedEntry.referenceType === "other" ? (
                            "Đổi trả bảo hành (Tự động)"
                          ) : selectedEntry.referenceType === "expense" ? (
                            "Chi phí thủ công"
                          ) : selectedEntry.type === "expense" ? (
                            "Chi phí thủ công"
                          ) : (
                            "Thu nhập thủ công"
                          )}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Diễn giải card block */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#7a7a7a] uppercase tracking-wide pl-0.5">Nội dung diễn giải</span>
                    <p className="text-[12.5px] text-slate-600 font-medium bg-slate-50 p-3 rounded-xl border border-[#e0e0e0]/70 leading-relaxed select-all">
                      {selectedEntry.description}
                    </p>
                  </div>

                  {/* Edit action block for manual entries */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEntry(null)}
                      className="px-4 h-[34px] bg-[#fafafc] hover:bg-[#f5f5f7] border border-[#e0e0e0] text-slate-700 rounded-lg text-[12px] font-semibold transition-all cursor-pointer active:scale-[0.97]"
                    >
                      Đóng
                    </button>
                    {(selectedEntry.referenceType === "expense" || (selectedEntry.referenceType === null && selectedEntry.type === "income")) && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          setEditCategoryId(selectedEntry.referenceType === null ? (selectedEntry.incomeCategoryId || "") : (selectedEntry.categoryId || ""));
                          setEditAmount(selectedEntry.amount ? Math.round(Number(selectedEntry.amount)).toString() : "");
                          setEditDescription(selectedEntry.description || "");
                          setEditExpenseDate(selectedEntry.entryDate || "");
                          setEditPaymentMethod(selectedEntry.paymentMethod || "cash");
                        }}
                        className="flex items-center gap-1 px-4.5 h-[34px] bg-[#0066cc] text-white hover:bg-[#0071e3] rounded-lg text-[12px] font-semibold transition-all cursor-pointer shadow-sm active:scale-[0.97]"
                      >
                        <Edit2 size={12} /> Hiệu chỉnh
                      </button>
                    )}
                  </div>

                </div>
              )}
            </KinhPanel>
          )}

            </div>
          </div>

      {/* Re-designed Custom Confirm Dialog for Expense/Income Deletion */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={() => {
          if (selectedEntry) {
            if (selectedEntry.referenceType === null) {
              deleteManualIncomeMutation.mutate(selectedEntry.id);
            } else {
              deleteMutation.mutate(selectedEntry.referenceId);
            }
          }
        }}
        title={selectedEntry?.referenceType === null ? "Xác nhận xóa phiếu thu" : "Xác nhận xóa giao dịch chi phí"}
        description={
          selectedEntry?.referenceType === null
            ? `Bạn chắc chắn muốn xóa phiếu thu thủ công "${selectedEntry?.entryNumber}"? Số liệu sổ quỹ liên quan sẽ được tự động tính toán lại.`
            : `Bạn chắc chắn muốn xóa giao dịch chi phí "${selectedEntry?.entryNumber}"? Số liệu sổ quỹ liên quan sẽ được tự động tính toán lại.`
        }
        confirmText="Xóa giao dịch"
        isLoading={selectedEntry?.referenceType === null ? deleteManualIncomeMutation.isPending : deleteMutation.isPending}
      />

      {/* Elegant Add Manual Income Dialog Modal */}
      {isCreateIncomeOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-visible animate-scale-up">
            {/* Dialog Header */}
            <div className="px-6 py-4 bg-[#f5f5f7] border-b border-[#e0e0e0] flex items-center justify-between rounded-t-2xl">
              <h3 className="text-[16px] font-bold text-[#1d1d1f]">Tạo Phiếu Thu Thủ Công</h3>
              <button
                type="button"
                onClick={() => setIsCreateIncomeOpen(false)}
                className="p-1 hover:bg-[#e0e0e0]/40 rounded-lg text-[#7a7a7a] hover:text-[#1d1d1f] transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dialog Form Body */}
            <form onSubmit={handleCreateIncomeSubmit} className="p-6 space-y-4">
              {/* Category Select */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-0.5">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase">Danh mục thu nhập *</label>
                  <button
                    type="button"
                    onClick={() => setIsIncomeCategoryDialogOpen(true)}
                    className="text-[11px] font-semibold text-[#0066cc] hover:underline hover:text-[#0071e3]"
                  >
                    + Quản lý danh mục
                  </button>
                </div>
                <CustomSelect
                  options={manualIncomeOptions}
                  value={incomeCategory}
                  onChange={setIncomeCategory}
                  placeholder="Chọn danh mục thu..."
                  dropdownWidth="full"
                />
              </div>

              {/* Amount input formatted in VND */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Số tiền thu (VND) *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatVNDInput(incomeAmount)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, "");
                      setIncomeAmount(rawValue);
                    }}
                    placeholder="0"
                    className="w-full pl-3 pr-12 py-2 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#7a7a7a]">VNĐ</span>
                </div>
              </div>

              {/* Income Date & Payment Method */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Ngày thu *</label>
                  <CustomDatePicker
                    value={incomeDate}
                    onChange={setIncomeDate}
                    placeholder="Chọn ngày thu..."
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
                    value={incomePaymentMethod}
                    onChange={setIncomePaymentMethod}
                    dropdownWidth="full"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Diễn giải nội dung *</label>
                <textarea
                  value={incomeDescription}
                  onChange={(e) => setIncomeDescription(e.target.value)}
                  placeholder="Diễn giải chi tiết nội dung thu tiền..."
                  className="w-full px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                  rows={3}
                  required
                />
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateIncomeOpen(false)}
                  disabled={createManualIncomeMutation.isPending}
                  className="px-5 h-[40px] bg-gray-50 hover:bg-gray-100 border border-[#e0e0e0] text-[#1d1d1f] rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createManualIncomeMutation.isPending}
                  className="px-6 h-[40px] bg-[#0066cc] text-white hover:bg-[#0055b3] rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200 shadow-sm"
                >
                  {createManualIncomeMutation.isPending ? "Đang ghi..." : "Ghi nhận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Elegant Add Manual Expense Dialog Modal */}
      {isCreateExpenseOpen && (
        <div className="fixed inset-0 bg-[#1d1d1f]/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-2xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-visible animate-scale-up">
            {/* Dialog Header */}
            <div className="px-6 py-4 bg-[#f5f5f7] border-b border-[#e0e0e0] flex items-center justify-between rounded-t-2xl">
              <h3 className="text-[16px] font-bold text-[#1d1d1f]">Tạo Phiếu Chi Thủ Công</h3>
              <button
                type="button"
                onClick={() => setIsCreateExpenseOpen(false)}
                className="p-1 hover:bg-[#e0e0e0]/40 rounded-lg text-[#7a7a7a] hover:text-[#1d1d1f] transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dialog Form Body */}
            <form onSubmit={handleCreateExpenseSubmit} className="p-6 space-y-4">
              {/* Category Select */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-0.5">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase">Danh mục chi phí *</label>
                  <button
                    type="button"
                    onClick={() => setIsExpenseCategoryDialogOpen(true)}
                    className="text-[11px] font-semibold text-[#0066cc] hover:underline hover:text-[#0071e3]"
                  >
                    + Quản lý danh mục
                  </button>
                </div>
                <CustomSelect
                  options={manualExpenseOptions}
                  value={expenseCategoryId}
                  onChange={setExpenseCategoryId}
                  placeholder="Chọn danh mục chi..."
                  dropdownWidth="full"
                />
              </div>

              {/* Amount input formatted in VND */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Số tiền chi (VND) *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatVNDInput(expenseAmount)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, "");
                      setExpenseAmount(rawValue);
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
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Ngày chi *</label>
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
                    value={expensePaymentMethod}
                    onChange={setExpensePaymentMethod}
                    dropdownWidth="full"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Diễn giải nội dung *</label>
                <textarea
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
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
                  onClick={() => setIsCreateExpenseOpen(false)}
                  disabled={createExpenseMutation.isPending}
                  className="px-5 h-[40px] bg-gray-50 hover:bg-gray-100 border border-[#e0e0e0] text-[#1d1d1f] rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="px-6 h-[40px] bg-[#ff2d55] text-white hover:bg-[#d6001c] rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200 shadow-sm"
                >
                  {createExpenseMutation.isPending ? "Đang ghi..." : "Ghi nhận"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Elegant Add Expense Category Dialog Modal */}
      <Dialog
        isOpen={isExpenseCategoryDialogOpen}
        onClose={() => setIsExpenseCategoryDialogOpen(false)}
        title="Thêm Danh Mục Chi Phí"
        description="Tạo danh mục phân loại chi phí vận hành mới."
        size="lg"
      >
        <form onSubmit={handleCreateExpenseCategorySubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Tên danh mục *</label>
            <input
              type="text"
              value={newExpCatName}
              onChange={(e) => setNewExpCatName(e.target.value)}
              placeholder="Ví dụ: Chi phí đóng gói, Điện nước..."
              className="w-full px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Loại chi phí *</label>
            <CustomSelect
              options={[
                { value: "variable", label: "Biến động" },
                { value: "fixed", label: "Cố định" },
                { value: "one_time", label: "Phát sinh một lần" },
              ]}
              value={newExpCatType}
              onChange={(val: any) => setNewExpCatType(val)}
              dropdownWidth="full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Mô tả chi tiết</label>
            <textarea
              value={newExpCatDesc}
              onChange={(e) => setNewExpCatDesc(e.target.value)}
              placeholder="Mô tả chi tiết về mục đích sử dụng danh mục chi phí này..."
              className="w-full px-3 py-2 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
              rows={3}
            />
          </div>
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsExpenseCategoryDialogOpen(false)}
              disabled={createExpenseCategoryMutation.isPending}
              className="px-5 h-[40px] bg-gray-50 hover:bg-gray-100 border border-[#e0e0e0] text-[#1d1d1f] rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createExpenseCategoryMutation.isPending}
              className="px-6 h-[40px] bg-[#ff2d55] text-white hover:bg-[#d6001c] rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer active:scale-95 duration-200 shadow-sm"
            >
              {createExpenseCategoryMutation.isPending ? "Đang tạo..." : "Thêm mới"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Elegant Income Category Management Dialog Modal */}
      <Dialog
        isOpen={isIncomeCategoryDialogOpen}
        onClose={() => {
          setIsIncomeCategoryDialogOpen(false);
          setEditingIncCategoryId(null);
        }}
        title="Quản Lý Danh Mục Thu Nhập"
        size="xl"
      >
        <div className="space-y-6 text-[13px] leading-relaxed">
          
          {/* SECTION 1: FORM (CREATE OR EDIT) */}
          {editingIncCategoryId ? (
            // Edit Category Form
            <div className="p-4 rounded-xl border border-[#0066cc]/20 bg-[#0066cc]/5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-[#1d1d1f] text-[14px]">Chỉnh sửa danh mục thu nhập</h4>
                <button
                  type="button"
                  onClick={() => setEditingIncCategoryId(null)}
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
                    value={editIncCatName}
                    onChange={(e) => setEditIncCatName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Mô tả</label>
                  <textarea
                    value={editIncCatDesc}
                    onChange={(e) => setEditIncCatDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                    rows={2}
                  />
                </div>

                <div className="pt-1 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingIncCategoryId(null)}
                    className="px-4 h-[32px] bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] font-semibold rounded-full text-[12px] transition-all cursor-pointer active:scale-95 duration-200 border border-[#e0e0e0]/40"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editIncCatName.trim()) {
                        toast.error("Vui lòng nhập tên danh mục");
                        return;
                      }
                      updateIncomeCategoryMutation.mutate({
                        id: editingIncCategoryId,
                        payload: {
                          name: editIncCatName,
                          description: editIncCatDesc,
                        }
                      });
                    }}
                    disabled={updateIncomeCategoryMutation.isPending}
                    className="px-4 h-[32px] bg-[#0066cc] hover:bg-[#0055b3] text-white font-semibold rounded-full text-[12px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 duration-200 shadow-sm"
                  >
                    <Check size={14} className="w-3.5 h-3.5" />
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Create Category Form
            <div className="p-4 rounded-xl border border-[#e0e0e0] bg-[#f5f5f7]/55 space-y-4">
              <h4 className="font-bold text-[#1d1d1f] text-[14px]">Thêm danh mục thu nhập mới</h4>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newIncCatName.trim()) {
                    toast.error("Vui lòng nhập tên danh mục");
                    return;
                  }
                  createIncomeCategoryMutation.mutate({
                    name: newIncCatName,
                    description: newIncCatDesc,
                  });
                }} 
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Tên danh mục *</label>
                  <input
                    type="text"
                    value={newIncCatName}
                    onChange={(e) => setNewIncCatName(e.target.value)}
                    placeholder="Ví dụ: Thu thanh lý tài sản, Thu lãi tiền gửi..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#7a7a7a] uppercase pl-0.5">Mô tả (Không bắt buộc)</label>
                  <textarea
                    value={newIncCatDesc}
                    onChange={(e) => setNewIncCatDesc(e.target.value)}
                    placeholder="Mô tả chi tiết về danh mục thu nhập..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40"
                    rows={2}
                  />
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    disabled={createIncomeCategoryMutation.isPending}
                    className="px-5 h-[36px] bg-[#0066cc] hover:bg-[#0055b3] text-white rounded-full font-semibold text-[12px] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 duration-200 shadow-sm"
                  >
                    <Plus size={14} />
                    {createIncomeCategoryMutation.isPending ? "Đang tạo..." : "Thêm mới"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 2: CATEGORIES LIST */}
          <div className="space-y-3">
            <h4 className="font-bold text-[#7a7a7a] uppercase tracking-wider pl-0.5 text-[11px]">
              Danh sách danh mục hiện có ({incomeCategoriesData?.length || 0})
            </h4>

            <div className="border border-[#e0e0e0] rounded-xl overflow-hidden bg-white max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
              {incomeCategoriesData && incomeCategoriesData.length > 0 ? (
                <div className="divide-y divide-[#e0e0e0]/70">
                  {incomeCategoriesData.map((c) => {
                    const isDefault = ["10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000002", "10000000-0000-0000-0000-000000000003"].includes(c.id);
                    return (
                      <div 
                        key={c.id} 
                        className={`p-3.5 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50/50 ${
                          editingIncCategoryId === c.id ? "bg-[#0066cc]/5" : ""
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#1d1d1f] text-[13px] truncate">{c.name}</span>
                            {isDefault && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Mặc định</span>
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
                              setEditingIncCategoryId(c.id);
                              setEditIncCatName(c.name);
                              setEditIncCatDesc(c.description || "");
                            }}
                            className="p-1.5 rounded-lg bg-[#f5f5f7] hover:bg-[#e0e0e0] text-[#7a7a7a] hover:text-[#1d1d1f] transition-all cursor-pointer"
                            title="Chỉnh sửa danh mục"
                          >
                            <Pencil size={12} className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isDefault) {
                                toast.error("Không thể xóa danh mục mặc định của hệ thống");
                                return;
                              }
                              setIncCategoryToDelete(c);
                            }}
                            disabled={deleteIncomeCategoryMutation.isPending}
                            className={`p-1.5 rounded-lg transition-all ${
                              isDefault
                                ? "bg-slate-100/70 text-slate-400 cursor-not-allowed opacity-50"
                                : "bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 cursor-pointer"
                            }`}
                            title={isDefault ? "Không thể xóa danh mục mặc định của hệ thống" : "Xóa danh mục"}
                          >
                            <Trash2 size={12} className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-gray-500 text-center py-6">Chưa có danh mục nào được lập.</p>
              )}
            </div>
          </div>

          {/* Footer Close Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e0e0e0] mt-6">
            <button
              type="button"
              onClick={() => {
                setIsIncomeCategoryDialogOpen(false);
                setEditingIncCategoryId(null);
              }}
              className="px-6 h-[36px] bg-[#0066cc] hover:bg-[#0055b3] text-white font-semibold rounded-full text-[13px] transition-all cursor-pointer active:scale-95 duration-200 shadow-sm"
            >
              Đóng
            </button>
          </div>
        </div>
      </Dialog>

      {/* Sleek Custom Confirm Dialog for Income Category Deletion */}
      <ConfirmDialog
        isOpen={!!incCategoryToDelete}
        onClose={() => setIncCategoryToDelete(null)}
        onConfirm={() => {
          if (incCategoryToDelete) {
            deleteIncomeCategoryMutation.mutate(incCategoryToDelete.id, {
              onSuccess: (res) => {
                if (res.success) {
                  setIncCategoryToDelete(null);
                }
              }
            });
          }
        }}
        title="Xác nhận xóa danh mục thu nhập"
        description={`Bạn chắc chắn muốn xóa danh mục thu nhập "${incCategoryToDelete?.name}"?`}
        confirmText="Xóa danh mục"
        isLoading={deleteIncomeCategoryMutation.isPending}
      />

    </div>
  );
}

// ============================================================
// INLINE CUSTOM PICKERS (DASHBOARD SYNCED)
// ============================================================

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
    <div ref={containerRef} className="relative flex items-center gap-1.5 select-none text-slate-700">
      <span className="opacity-80">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "h-6 rounded-[8px] border px-1.5 text-[11.5px] font-bold focus:outline-none transition-all min-w-[70px] text-center cursor-pointer",
          active
            ? "bg-blue-500/10 border-blue-500/30 text-[#0066cc] hover:bg-blue-500/15"
            : "bg-white/60 border-slate-200/80 text-slate-700 hover:bg-white/80"
        )}
      >
        {displayValue}
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
    <div ref={containerRef} className="relative flex items-center gap-1.5 select-none text-slate-700">
      <span className="opacity-80">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "h-6 rounded-[8px] border px-1.5 text-[11.5px] font-bold focus:outline-none transition-all min-w-[76px] text-center cursor-pointer",
          active
            ? "bg-blue-500/10 border-blue-500/30 text-[#0066cc] hover:bg-blue-500/15"
            : "bg-white/60 border-slate-200/80 text-slate-700 hover:bg-white/80"
        )}
      >
        {displayValue || "Chọn..."}
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
