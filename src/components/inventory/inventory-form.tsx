"use client";

import { useForm, Controller } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getProductsForDropdown } from "@/app/actions/inventory";
import { getSuppliersList } from "@/app/actions/suppliers";
import { SFSymbolPlus } from "@/components/ui/apple-icons";
import { ProductManagerDialog } from "@/components/products/product-manager-dialog";
import { ProductDialog } from "@/components/products/product-dialog";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
import { SupplierManagerDialog } from "@/components/suppliers/supplier-manager-dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { getCountriesList, getCarriersList } from "@/app/actions/shipping-countries";
import { CountryManagerDialog } from "./country-manager-dialog";
import { CarrierManagerDialog } from "./carrier-manager-dialog";

// Format number to VND display string: "15000000" → "15.000.000"
function formatVND(value: string | number): string {
  if (value === null || value === undefined || value === "") return "";
  const cleanValue = String(value).split(".")[0];
  const num = cleanValue.replace(/\D/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("vi-VN");
}

// Parse VND display string back to raw number string: "15.000.000" → "15000000"
function parseVND(value: string): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

// Define the schema with dynamic refinements for dates and serial entry modes
const inventorySchema = z.object({
  productId: z.string().min(1, "Vui lòng chọn sản phẩm"),
  entryMode: z.enum(["single", "batch"]),
  serialNumber: z.string().optional(),
  serialNumbersText: z.string().optional(),
  batchQuantity: z.string().optional().refine((val) => !val || (!isNaN(Number(val)) && Number(val) > 0), "Số lượng phải là số nguyên dương"),
  condition: z.enum(["new", "used"]),
  status: z.enum(["incoming", "in_stock"]),
  costPrice: z.string().min(1, "Vui lòng nhập giá vốn").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Giá phải là số hợp lệ"),
  sellingPrice: z.string().optional().refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), "Giá phải là số hợp lệ"),
  notes: z.string().optional(),
  stockedDate: z.string().optional().nullable(),
  expectedArrivalDate: z.string().optional().nullable(),
  mediaUrls: z.string().optional(),
  
  // Suppliers & International importing fields
  supplierId: z.string().optional(),
  isInternational: z.boolean(),
  originCountry: z.string().optional(),
  shippingMethod: z.string().optional(),
  trackingNumber: z.string().optional(),
}).superRefine((data, ctx) => {
  // Date validations
  if (data.status === "in_stock" && !data.stockedDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stockedDate"],
      message: "Vui lòng chọn ngày nhập kho thực tế",
    });
  }
  if (data.status === "incoming" && !data.expectedArrivalDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expectedArrivalDate"],
      message: "Vui lòng chọn ngày dự kiến hàng về",
    });
  }

  // International validations
  if (data.isInternational) {
    if (!data.originCountry || data.originCountry === "VN") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originCountry"],
        message: "Vui lòng chọn quốc gia xuất xứ ngoài Việt Nam",
      });
    }
  }

  // Serial Number validations based on mode
  if (data.entryMode === "single") {
    if (data.serialNumber && data.serialNumber.trim().length > 0 && data.serialNumber.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serialNumber"],
        message: "Số Serial phải có ít nhất 3 ký tự nếu nhập thủ công",
      });
    }
  } else {
    const hasSerials = data.serialNumbersText && data.serialNumbersText.trim().length > 0;
    const hasQuantity = data.batchQuantity && data.batchQuantity.trim().length > 0;
    if (!hasSerials && !hasQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serialNumbersText"],
        message: "Vui lòng nhập danh sách Serial hoặc nhập Số lượng máy",
      });
    }
  }
});

type InventoryFormValues = z.infer<typeof inventorySchema>;

interface InventoryFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function InventoryForm({ initialData, onSubmit, onCancel, isLoading }: InventoryFormProps) {
  const [products, setProducts] = useState<{ id: string; name: string; sku: string | null; specs?: any }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [isProductManagerOpen, setIsProductManagerOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isSupplierManagerOpen, setIsSupplierManagerOpen] = useState(false);

  const [countries, setCountries] = useState<{ id: string; code: string; name: string }[]>([]);
  const [carriers, setCarriers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  const [isCountryManagerOpen, setIsCountryManagerOpen] = useState(false);
  const [isCarrierManagerOpen, setIsCarrierManagerOpen] = useState(false);

  // Display states for formatted VND prices
  const [costPriceDisplay, setCostPriceDisplay] = useState(
    initialData?.costPrice ? formatVND(initialData.costPrice) : ""
  );
  const [sellingPriceDisplay, setSellingPriceDisplay] = useState(
    initialData?.sellingPrice ? formatVND(initialData.sellingPrice) : ""
  );

  const [priceInputMode, setPriceInputMode] = useState<"unit" | "total">("unit");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
    watch,
  } = useForm<InventoryFormValues>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      productId: initialData?.productId || "",
      entryMode: "single",
      serialNumber: initialData?.serialNumber && !initialData.serialNumber.startsWith("SN-PENDING-") ? initialData.serialNumber : "",
      serialNumbersText: "",
      batchQuantity: "",
      condition: initialData?.condition || "new",
      status: initialData?.status || "in_stock",
      costPrice: initialData?.costPrice ? initialData.costPrice.split(".")[0] : "",
      sellingPrice: initialData?.sellingPrice ? initialData.sellingPrice.split(".")[0] : "",
      notes: initialData?.notes || "",
      stockedDate: initialData?.stockedDate || (initialData?.status === "incoming" ? "" : new Date().toISOString().split('T')[0]),
      expectedArrivalDate: initialData?.expectedArrivalDate || (initialData?.status === "incoming" ? new Date().toISOString().split('T')[0] : ""),
      mediaUrls: initialData?.images ? initialData.images.join(", ") : "",
      
      // Suppliers & Tracking fields
      supplierId: initialData?.supplierId || "",
      isInternational: !!initialData?.originCountry && initialData?.originCountry !== "VN",
      originCountry: initialData?.originCountry || "US",
      shippingMethod: initialData?.shippingMethod || "",
      trackingNumber: initialData?.trackingNumber || "",
    },
  });

  const entryMode = watch("entryMode");
  const serialNumbersText = watch("serialNumbersText") || "";
  const batchQuantity = watch("batchQuantity");
  const isInternational = watch("isInternational");

  // Tính số serial thực tế phát hiện được trong khung text hoặc số lượng nhập
  const detectedCount = useMemo(() => {
    const hasSerials = serialNumbersText && serialNumbersText.trim().length > 0;
    if (hasSerials) {
      return serialNumbersText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean).length;
    }
    return Number(batchQuantity) || 0;
  }, [serialNumbersText, batchQuantity]);

  const selectedStatus = watch("status");
  const rawCostPrice = watch("costPrice");

  const calculatedUnitPrice = useMemo(() => {
    const count = detectedCount || 1;
    const total = Number(rawCostPrice) || 0;
    return Math.round(total / count);
  }, [detectedCount, rawCostPrice]);

  const calculatedTotalPrice = useMemo(() => {
    const count = detectedCount || 1;
    const unitPrice = Number(rawCostPrice) || 0;
    return Math.round(unitPrice * count);
  }, [detectedCount, rawCostPrice]);

  useEffect(() => {
    if (selectedStatus === "in_stock" && !watch("stockedDate")) {
      setValue("stockedDate", new Date().toISOString().split('T')[0]);
    } else if (selectedStatus === "incoming" && !watch("expectedArrivalDate")) {
      setValue("expectedArrivalDate", new Date().toISOString().split('T')[0]);
    }
  }, [selectedStatus, setValue, watch]);

  // Tự động chuyển trạng thái sang "Đang về" (incoming) khi tick "Nhập từ quốc tế"
  useEffect(() => {
    if (isInternational) {
      setValue("status", "incoming");
    }
  }, [isInternational, setValue]);

  const handlePriceChange = useCallback(
    (field: "costPrice" | "sellingPrice", rawValue: string) => {
      const digits = parseVND(rawValue);
      setValue(field, digits, { shouldValidate: true });
      if (field === "costPrice") {
        setCostPriceDisplay(formatVND(digits));
      } else if (field === "sellingPrice") {
        setSellingPriceDisplay(formatVND(digits));
      }
    },
    [setValue]
  );

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await getProductsForDropdown();
      setProducts(data);
    } catch (error) {
      console.error("Lỗi lấy danh sách sản phẩm", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const data = await getSuppliersList();
      setSuppliers(data);
    } catch (error) {
      console.error("Lỗi lấy danh sách nhà cung cấp", error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const loadCountries = async () => {
    setLoadingCountries(true);
    try {
      const data = await getCountriesList();
      setCountries(data.filter((c) => c.isActive));
    } catch (error) {
      console.error("Lỗi lấy danh sách quốc gia", error);
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadCarriers = async () => {
    setLoadingCarriers(true);
    try {
      const data = await getCarriersList();
      setCarriers(data.filter((c) => c.isActive));
    } catch (error) {
      console.error("Lỗi lấy danh sách đơn vị vận chuyển", error);
    } finally {
      setLoadingCarriers(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadSuppliers();
    loadCountries();
    loadCarriers();
  }, []);

  const handleProductCreated = async (newProductId: string) => {
    await loadProducts();
    setValue("productId", newProductId);
  };

  const handleSupplierCreated = async (newSupplierId: string) => {
    await loadSuppliers();
    setValue("supplierId", newSupplierId);
  };

  // Tự động sinh mã Serial tạm thời khi để trống
  const generatePendingSerial = () => {
    const timestamp = Date.now().toString().slice(-4);
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SN-PENDING-${timestamp}${randomChars}`;
  };

  const onSubmitHandler = (values: InventoryFormValues) => {
    const imagesArray = values.mediaUrls?.trim()
      ? values.mediaUrls.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const commonPayload = {
      productId: values.productId,
      condition: values.condition,
      status: values.status,
      sellingPrice: values.sellingPrice || undefined,
      notes: values.notes || undefined,
      stockedDate: values.stockedDate || undefined,
      expectedArrivalDate: values.expectedArrivalDate || undefined,
      images: imagesArray,
      // Suppliers & Tracking fields
      supplierId: values.supplierId || undefined,
      originCountry: values.isInternational ? values.originCountry : "VN",
      shippingMethod: values.isInternational ? values.shippingMethod : undefined,
      trackingNumber: values.isInternational ? values.trackingNumber : undefined,
    };

    if (values.entryMode === "batch") {
      let serials: string[] = [];
      const hasSerials = values.serialNumbersText && values.serialNumbersText.trim().length > 0;
      
      if (hasSerials) {
        serials = values.serialNumbersText!
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        const qty = Number(values.batchQuantity) || 1;
        for (let i = 0; i < qty; i++) {
          serials.push(generatePendingSerial());
        }
      }
      
      const count = serials.length || 1;
      let costPriceUnit = values.costPrice;
      
      if (priceInputMode === "total") {
        const totalCost = Number(values.costPrice) || 0;
        costPriceUnit = (totalCost / count).toFixed(2);
      }
      
      onSubmit({
        ...commonPayload,
        serialNumbers: serials,
        costPrice: costPriceUnit,
      });
    } else {
      const serial = values.serialNumber && values.serialNumber.trim().length > 0
        ? values.serialNumber.trim()
        : generatePendingSerial();
        
      onSubmit({
        ...commonPayload,
        serialNumber: serial,
        costPrice: values.costPrice,
      });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-6">
      <div className="space-y-6">
        {/* Card 1: Thông tin sản phẩm & Định giá */}
        <div className="border border-[#e0e0e0] bg-white rounded-2xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="border-b border-[#f5f5f7] pb-3 mb-2">
            <h3 className="text-[15px] font-bold text-[#1d1d1f]">1. Thông tin sản phẩm</h3>
          </div>

          {/* Product Selection */}
          <div className="space-y-1 min-w-0">
            <div className="flex justify-between items-center">
              <label className="block text-[14px] font-semibold text-[#1d1d1f]">Sản phẩm *</label>
              {!initialData?.productId && (
                <button 
                  type="button" 
                  onClick={() => setIsProductManagerOpen(true)}
                  className="text-[12px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
                >
                  Quản lý sản phẩm
                </button>
              )}
            </div>
            <div className="flex gap-2 min-w-0 items-center">
              <Controller
                name="productId"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    options={products.map((p) => {
                      const specs = p.specs as { cpu?: string; ram?: string; ssd?: string; screen?: string } | null;
                      const specParts = [];
                      if (specs?.cpu) specParts.push(specs.cpu);
                      if (specs?.ram) specParts.push(`RAM ${specs.ram}`);
                      if (specs?.ssd) specParts.push(`SSD ${specs.ssd}`);
                      if (specs?.screen) specParts.push(specs.screen);
                      const specsText = specParts.join(" • ") || "Chưa cấu hình";
                      return {
                        value: p.id,
                        label: p.name,
                        subLabel: specsText,
                      };
                    })}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Chọn sản phẩm..."
                    disabled={!!initialData?.productId || loadingProducts}
                    error={errors.productId?.message}
                    searchable={true}
                    className="flex-1 min-w-0"
                    dropdownWidth="full"
                  />
                )}
              />
              {!initialData?.productId && (
                <button 
                  type="button" 
                  onClick={() => setIsProductDialogOpen(true)}
                  className="w-[44px] h-[44px] shrink-0 rounded-lg bg-[#f5f5f7] flex items-center justify-center border border-[#e0e0e0] text-[#0066cc] hover:bg-[#e0e0e0] transition-colors"
                  title="Thêm mã sản phẩm mới"
                >
                  <SFSymbolPlus size={18} />
                </button>
              )}
            </div>
            {errors.productId && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.productId.message}</p>}
          </div>

          {/* Supplier Selection */}
          <div className="space-y-1 min-w-0">
            <div className="flex justify-between items-center">
              <label className="block text-[14px] font-semibold text-[#1d1d1f]">Nhà cung cấp</label>
              <button 
                type="button" 
                onClick={() => setIsSupplierManagerOpen(true)}
                className="text-[12px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
              >
                Quản lý nhà cung cấp
              </button>
            </div>
            <div className="flex gap-2 min-w-0 items-center">
              <Controller
                name="supplierId"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    options={[
                      { value: "", label: "Không liên kết nhà cung cấp" },
                      ...suppliers.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))
                    ]}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Chọn nhà cung cấp..."
                    disabled={loadingSuppliers}
                    error={errors.supplierId?.message}
                    searchable={true}
                    className="flex-1 min-w-0"
                    dropdownWidth="full"
                  />
                )}
              />
              <button 
                type="button" 
                onClick={() => setIsSupplierDialogOpen(true)}
                className="w-[44px] h-[44px] shrink-0 rounded-lg bg-[#f5f5f7] flex items-center justify-center border border-[#e0e0e0] text-[#0066cc] hover:bg-[#e0e0e0] transition-colors"
                title="Thêm nhanh Nhà Cung Cấp mới"
              >
                <SFSymbolPlus size={18} />
              </button>
            </div>
            {errors.supplierId && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.supplierId.message}</p>}
          </div>

          {/* Condition & Status */}
          <div className="grid grid-cols-2 gap-4 min-w-0">
            <div className="space-y-1 min-w-0">
              <label className="block text-[14px] font-semibold text-[#1d1d1f]">Tình trạng</label>
              <Controller
                name="condition"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    options={[
                      { value: "new", label: "Mới" },
                      { value: "used", label: "Đã sử dụng" },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.condition?.message}
                    className="w-full"
                    dropdownWidth="full"
                  />
                )}
              />
              {errors.condition && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.condition.message}</p>}
            </div>

            <div className="space-y-1 min-w-0">
              <label className="block text-[14px] font-semibold text-[#1d1d1f]">Trạng thái kho</label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    options={[
                      { value: "incoming", label: "Đang về" },
                      { value: "in_stock", label: "Sẵn hàng" },
                    ]}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.status?.message}
                    className="w-full"
                    dropdownWidth="full"
                  />
                )}
              />
              {errors.status && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.status.message}</p>}
            </div>
          </div>

          {/* Price Input Mode Toggle (Only when entryMode is batch) */}
          {entryMode === "batch" && (
            <div className="space-y-1 animate-fade-in">
              <span className="block text-[14px] font-semibold text-[#1d1d1f]">Phương thức nhập giá lô</span>
              <div className="flex bg-[#f5f5f7] p-[3px] rounded-full border border-[#e0e0e0] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.03)] gap-1 select-none w-full max-w-[320px] shrink-0">
                <button
                  type="button"
                  onClick={() => setPriceInputMode("unit")}
                  className={`flex-1 py-1.5 text-[13px] rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
                    priceInputMode === "unit"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]"
                      : "text-slate-600 hover:text-slate-900 font-semibold"
                  }`}
                >
                  Đơn giá máy
                </button>
                <button
                  type="button"
                  onClick={() => setPriceInputMode("total")}
                  className={`flex-1 py-1.5 text-[13px] rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
                    priceInputMode === "total"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]"
                      : "text-slate-600 hover:text-slate-900 font-semibold"
                  }`}
                >
                  Tổng giá lô
                </button>
              </div>
            </div>
          )}

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[14px] font-semibold text-[#1d1d1f]">
                {entryMode === "batch" && priceInputMode === "total" ? (
                  <>Tổng giá trị lô nhập <span className="text-[12px] text-[#7a7a7a] font-normal">(Cả lô)</span></>
                ) : (
                  <>Giá nhập *</>
                )}
              </label>
              <div className="relative">
                <input
                  value={costPriceDisplay}
                  onChange={(e) => handlePriceChange("costPrice", e.target.value)}
                  placeholder={entryMode === "batch" && priceInputMode === "total" ? "Giá nhập cả lô" : "Giá nhập mỗi máy"}
                  inputMode="numeric"
                  className="w-full h-[44px] px-4 pr-10 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[17px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#7a7a7a] font-medium pointer-events-none">₫</span>
              </div>
              {entryMode === "batch" && priceInputMode === "total" && rawCostPrice && (
                <p className="text-[12px] text-[#0066cc] font-medium mt-1">
                  Tự động chia đều: <span className="font-bold">{formatVND(calculatedUnitPrice)} ₫</span> / máy (Lô {detectedCount || 1} máy)
                </p>
              )}
              {entryMode === "batch" && priceInputMode === "unit" && rawCostPrice && (
                <p className="text-[12px] text-[#7a7a7a] font-medium mt-1">
                  Tổng trị giá cả lô: <span className="font-bold text-[#1d1d1f]">{formatVND(calculatedTotalPrice)} ₫</span> (Lô {detectedCount || 1} máy)
                </p>
              )}
              {errors.costPrice && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.costPrice.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-[14px] font-semibold text-[#1d1d1f]">Giá bán</label>
              <div className="relative">
                <input
                  value={sellingPriceDisplay}
                  onChange={(e) => handlePriceChange("sellingPrice", e.target.value)}
                  placeholder="Giá bán dự kiến"
                  inputMode="numeric"
                  className="w-full h-[44px] px-4 pr-10 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[17px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#7a7a7a] font-medium pointer-events-none">₫</span>
              </div>
              {errors.sellingPrice && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.sellingPrice.message}</p>}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-[14px] font-semibold text-[#1d1d1f]">Ghi chú</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Thông tin thêm (nếu có)..."
              className="w-full px-4 py-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[17px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none h-[64px]"
            />
          </div>

          {/* Images & Videos URLs */}
          <div className="space-y-1">
            <label className="block text-[14px] font-semibold text-[#1d1d1f]">Link hình và video thực tế</label>
            <input
              type="text"
              {...register("mediaUrls")}
              placeholder="Dán link ảnh/video"
              className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
            <p className="text-[11px] text-[#7a7a7a] mt-0.5 pl-0.5">
              Lưu tại đây để khi tạo báo giá, hình ảnh/video thực tế của máy tự động hiển thị để gửi khách.
            </p>
          </div>
        </div>

        {/* Card 2: Chi tiết định danh & Thời gian */}
        <div className="border border-[#e0e0e0] bg-white rounded-2xl p-5 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="border-b border-[#f5f5f7] pb-3 mb-2">
            <h3 className="text-[15px] font-bold text-[#1d1d1f]">2. Chi tiết định danh & Thời gian</h3>
          </div>

          {/* Entry Mode Toggle (Only when creating new) */}
          {!initialData && (
            <div className="space-y-1">
              <span className="block text-[14px] font-semibold text-[#1d1d1f]">Chế độ nhập kho</span>
              <div className="flex bg-[#f5f5f7] p-[3px] rounded-full border border-[#e0e0e0] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.03)] gap-1 select-none w-full max-w-[320px] shrink-0">
                <button
                  type="button"
                  onClick={() => setValue("entryMode", "single")}
                  className={`flex-1 py-1.5 text-[13px] rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
                    entryMode === "single"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]"
                      : "text-slate-600 hover:text-slate-900 font-semibold"
                  }`}
                >
                  Nhập từng máy
                </button>
                <button
                  type="button"
                  onClick={() => setValue("entryMode", "batch")}
                  className={`flex-1 py-1.5 text-[13px] rounded-full transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
                    entryMode === "batch"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-[0_3px_8px_rgba(0,102,204,0.15)] border border-white/10 font-bold scale-[1.01]"
                      : "text-slate-600 hover:text-slate-900 font-semibold"
                  }`}
                >
                  Nhập theo lô
                </button>
              </div>
            </div>
          )}

          {/* Serial Number & Ngày nhập kho */}
          {entryMode === "single" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[14px] font-semibold text-[#1d1d1f]">Số Serial</label>
                <input
                  {...register("serialNumber")}
                  placeholder="Nhập serial"
                  className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[17px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                />
                {errors.serialNumber && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.serialNumber.message}</p>}
              </div>

              {selectedStatus === "in_stock" ? (
                <div className="space-y-1">
                  <label className="block text-[14px] font-semibold text-[#1d1d1f]">Ngày nhập kho thực tế</label>
                  <Controller
                    name="stockedDate"
                    control={control}
                    render={({ field }) => (
                      <CustomDatePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Chọn ngày nhập..."
                        error={errors.stockedDate?.message}
                        align="right"
                      />
                    )}
                  />
                  {errors.stockedDate && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.stockedDate.message}</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[14px] font-semibold text-[#1d1d1f]">Ngày dự kiến hàng về</label>
                  <Controller
                    name="expectedArrivalDate"
                    control={control}
                    render={({ field }) => (
                      <CustomDatePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Chọn ngày dự kiến..."
                        error={errors.expectedArrivalDate?.message}
                        align="right"
                      />
                    )}
                  />
                  {errors.expectedArrivalDate && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.expectedArrivalDate.message}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cột trái: Textarea nhập serial */}
              <div className="space-y-1">
                <label className="block text-[14px] font-semibold text-[#1d1d1f] mb-1">Serial Numbers</label>
                <textarea
                  {...register("serialNumbersText")}
                  rows={4}
                  placeholder="Mỗi Serial cách nhau một dòng."
                  className="w-full px-4 py-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none h-[120px]"
                />
                {errors.serialNumbersText && <p className="text-[12px] text-[#b91c1c] mt-0.5">{errors.serialNumbersText.message}</p>}
              </div>

              {/* Cột phải: Thống kê số máy & Chọn ngày tương ứng */}
              <div className="flex flex-col justify-between space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="block text-[14px] font-semibold text-[#1d1d1f]">Số lượng</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="SL"
                      {...register("batchQuantity")}
                      disabled={serialNumbersText.trim().length > 0}
                      className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[17px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all disabled:opacity-50"
                    />
                    {errors.batchQuantity && <p className="text-[12px] text-[#b91c1c] mt-0.5">{errors.batchQuantity.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[14px] font-semibold text-[#1d1d1f] whitespace-nowrap">Tổng sản phẩm</span>
                    <div className="flex items-center justify-center h-[44px] rounded-lg bg-[#0066cc]/5 border border-[#0066cc]/15 px-2">
                      <span className="text-[15px] font-bold text-[#0066cc]">
                        {detectedCount} máy
                      </span>
                    </div>
                  </div>
                </div>

                {selectedStatus === "in_stock" ? (
                  <div className="space-y-1">
                    <label className="block text-[14px] font-semibold text-[#1d1d1f]">Ngày nhập kho</label>
                    <Controller
                      name="stockedDate"
                      control={control}
                      render={({ field }) => (
                        <CustomDatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Chọn ngày nhập..."
                          error={errors.stockedDate?.message}
                          align="right"
                        />
                      )}
                    />
                    {errors.stockedDate && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.stockedDate.message}</p>}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-[14px] font-semibold text-[#1d1d1f]">Ngày dự kiến về</label>
                    <Controller
                      name="expectedArrivalDate"
                      control={control}
                      render={({ field }) => (
                        <CustomDatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Chọn ngày dự kiến"
                          error={errors.expectedArrivalDate?.message}
                          align="right"
                        />
                      )}
                    />
                    {errors.expectedArrivalDate && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.expectedArrivalDate.message}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nhập hàng quốc tế và Tracking */}
          <div className="border-t border-[#f5f5f7] pt-4 mt-3 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isInternational"
                {...register("isInternational")}
                className="w-4.5 h-4.5 accent-[#0066cc] cursor-pointer"
              />
              <label htmlFor="isInternational" className="text-[14px] font-bold text-[#1d1d1f] cursor-pointer flex items-center gap-1.5">
                Nhập từ quốc tế
              </label>
            </div>

            {isInternational && (
              <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-[#f5f5f7] border border-[#e0e0e0] animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Quốc gia xuất xứ */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[13px] font-semibold text-[#1d1d1f] whitespace-nowrap">Quốc gia xuất xứ *</label>
                    <button 
                      type="button" 
                      onClick={() => setIsCountryManagerOpen(true)}
                      className="text-[11px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
                    >
                      Quản lý
                    </button>
                  </div>
                  <Controller
                    name="originCountry"
                    control={control}
                    render={({ field }) => (
                      <CustomSelect
                        options={countries.map((c) => ({
                          value: c.code,
                          label: c.name,
                          extraBadge: c.code,
                        }))}
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Chọn quốc gia..."
                        disabled={loadingCountries}
                        error={errors.originCountry?.message}
                        dropdownWidth="full"
                      />
                    )}
                  />
                  {errors.originCountry && <p className="text-[11px] text-[#b91c1c]">{errors.originCountry.message}</p>}
                </div>

                {/* Đơn vị vận chuyển */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[13px] font-semibold text-[#1d1d1f] whitespace-nowrap">Đơn vị vận chuyển</label>
                    <button 
                      type="button" 
                      onClick={() => setIsCarrierManagerOpen(true)}
                      className="text-[11px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
                    >
                      Quản lý
                    </button>
                  </div>
                  <Controller
                    name="shippingMethod"
                    control={control}
                    render={({ field }) => (
                      <CustomSelect
                        options={carriers.map((c) => ({
                          value: c.code,
                          label: c.name,
                          extraBadge: c.code,
                        }))}
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Chọn đơn vị"
                        disabled={loadingCarriers}
                        dropdownWidth="full"
                      />
                    )}
                  />
                </div>

                {/* Mã vận đơn (Tracking Number) */}
                <div className="col-span-2 space-y-1">
                  <label className="block text-[13px] font-semibold text-[#1d1d1f] whitespace-nowrap">Mã vận đơn</label>
                  <input
                    type="text"
                    {...register("trackingNumber")}
                    placeholder="Nhập mã vận đơn"
                    className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[17px] text-[#1d1d1f] hover:bg-[#e8e8ed] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e0e0e0] mt-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-5 h-[44px] rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] border border-[#e0e0e0] text-[#1d1d1f] text-[14px] font-medium transition-all"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 h-[44px] rounded-full bg-[#0066cc] text-white text-[14px] font-semibold hover:bg-[#0071e3] transition-all disabled:opacity-50"
        >
          {isLoading ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </form>

    <ProductManagerDialog 
      isOpen={isProductManagerOpen} 
      onClose={() => setIsProductManagerOpen(false)} 
      onUpdate={loadProducts} 
    />

    <ProductDialog
      isOpen={isProductDialogOpen}
      onClose={() => setIsProductDialogOpen(false)}
      onSuccess={handleProductCreated}
    />

    <SupplierDialog
      isOpen={isSupplierDialogOpen}
      onClose={() => setIsSupplierDialogOpen(false)}
      onSuccess={handleSupplierCreated}
    />

    <SupplierManagerDialog
      isOpen={isSupplierManagerOpen}
      onClose={() => setIsSupplierManagerOpen(false)}
      onUpdate={loadSuppliers}
    />

    <CountryManagerDialog
      isOpen={isCountryManagerOpen}
      onClose={() => setIsCountryManagerOpen(false)}
      onUpdate={loadCountries}
    />

    <CarrierManagerDialog
      isOpen={isCarrierManagerOpen}
      onClose={() => setIsCarrierManagerOpen(false)}
      onUpdate={loadCarriers}
    />
    </>
  );
}
