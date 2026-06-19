"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { getCategories, getBrands } from "@/app/actions/products";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/ui/custom-select";
import { CategoryManagerDialog } from "@/components/products/category-manager-dialog";
import { BrandManagerDialog } from "@/components/products/brand-manager-dialog";

const productSchema = z.object({
  name: z.string().min(3, "Tên sản phẩm tối thiểu 3 ký tự"),
  sku: z.string().min(2, "SKU tối thiểu 2 ký tự"),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
  brandId: z.string().min(1, "Vui lòng chọn thương hiệu"),
  cpu: z.string().optional(),
  ram: z.string().optional(),
  ssd: z.string().optional(),
  screen: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialData?: {
    id: string;
    name: string;
    sku: string | null;
    categoryId: string;
    brandId: string;
    specs: any;
  };
  onSubmit: (data: ProductFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function ProductForm({ initialData, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  
  const [loadingData, setLoadingData] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isBrandManagerOpen, setIsBrandManagerOpen] = useState(false);

  const specs = initialData?.specs as { cpu?: string; ram?: string; ssd?: string; screen?: string } | null;

  const { register, handleSubmit, formState: { errors }, setValue, control } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { 
      name: initialData?.name || "", 
      sku: initialData?.sku || "", 
      categoryId: initialData?.categoryId || "", 
      brandId: initialData?.brandId || "", 
      cpu: specs?.cpu || "", 
      ram: specs?.ram || "", 
      ssd: specs?.ssd || "",
      screen: specs?.screen || ""
    },
  });

  useEffect(() => {
    if (initialData) {
      const specs = initialData.specs as { cpu?: string; ram?: string; ssd?: string; screen?: string } | null;
      setValue("name", initialData.name);
      setValue("sku", initialData.sku || "");
      setValue("categoryId", initialData.categoryId);
      setValue("brandId", initialData.brandId);
      setValue("cpu", specs?.cpu || "");
      setValue("ram", specs?.ram || "");
      setValue("ssd", specs?.ssd || "");
      setValue("screen", specs?.screen || "");
    }
  }, [initialData, setValue]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [cats, brds] = await Promise.all([getCategories(), getBrands()]);
      setCategories(cats);
      setBrands(brds);
    } catch (error) {
      toast.error("Lỗi lấy dữ liệu danh mục/thương hiệu");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickAddCategory = () => {
    setIsCategoryManagerOpen(true);
  };

  const handleQuickAddBrand = () => {
    setIsBrandManagerOpen(true);
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-4">
        {/* Name & SKU */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1">
            <label className="block text-[14px] font-semibold text-[#1d1d1f]">Tên sản phẩm</label>
            <input
              {...register("name")}
              placeholder="VD: MacBook Pro 14 M3 2023"
              className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[17px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
            {errors.name && <p className="text-[12px] text-[#b91c1c]">{errors.name.message}</p>}
          </div>
          <div className="col-span-1 space-y-1">
            <label className="block text-[14px] font-semibold text-[#1d1d1f]">Mã SKU</label>
            <input
              {...register("sku")}
              placeholder="Nhập mã SKU"
              className="w-full h-[44px] px-4 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[17px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
            {errors.sku && <p className="text-[12px] text-[#b91c1c]">{errors.sku.message}</p>}
          </div>
        </div>

        {/* Category & Brand */}
        <div className="grid grid-cols-2 gap-4 min-w-0">
          <div className="space-y-1 min-w-0">
            <label className="block text-[14px] font-semibold text-[#1d1d1f]">Danh mục</label>
            <div className="flex gap-2 min-w-0 items-center">
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Chọn danh mục..."
                    disabled={loadingData}
                    error={errors.categoryId?.message}
                    searchable={true}
                    className="flex-1 min-w-0"
                    dropdownWidth="full"
                  />
                )}
              />
              <button 
                type="button" 
                onClick={handleQuickAddCategory} 
                className="w-[44px] h-[44px] shrink-0 rounded-lg bg-[#f5f5f7] flex items-center justify-center border border-[#e0e0e0] text-[#0066cc] hover:bg-[#e0e0e0] transition-colors" 
                title="Thêm danh mục mới"
              >
                <Plus size={18} />
              </button>
            </div>
            {errors.categoryId && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.categoryId.message}</p>}
          </div>

          <div className="space-y-1 min-w-0">
            <label className="block text-[14px] font-semibold text-[#1d1d1f]">Thương hiệu</label>
            <div className="flex gap-2 min-w-0 items-center">
              <Controller
                name="brandId"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    options={brands.map((b) => ({ value: b.id, label: b.name }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Chọn thương hiệu..."
                    disabled={loadingData}
                    error={errors.brandId?.message}
                    searchable={true}
                    className="flex-1 min-w-0"
                    align="right"
                    dropdownWidth="full"
                  />
                )}
              />
              <button 
                type="button" 
                onClick={handleQuickAddBrand} 
                className="w-[44px] h-[44px] shrink-0 rounded-lg bg-[#f5f5f7] flex items-center justify-center border border-[#e0e0e0] text-[#0066cc] hover:bg-[#e0e0e0] transition-colors" 
                title="Thêm thương hiệu mới"
              >
                <Plus size={18} />
              </button>
            </div>
            {errors.brandId && <p className="text-[12px] text-[#b91c1c] mt-1">{errors.brandId.message}</p>}
          </div>
        </div>

        {/* Specs */}
        <div className="pt-2 border-t border-[#e0e0e0]">
          <h3 className="text-[14px] font-semibold text-[#1d1d1f] mb-3">Cấu hình</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="block text-[12px] text-[#7a7a7a]">CPU</label>
              <input {...register("cpu")} placeholder="VD: M1 Pro" className="w-full h-[44px] px-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all" />
            </div>
            <div className="space-y-1">
              <label className="block text-[12px] text-[#7a7a7a]">RAM</label>
              <input {...register("ram")} placeholder="VD: 16GB" className="w-full h-[44px] px-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all" />
            </div>
            <div className="space-y-1">
              <label className="block text-[12px] text-[#7a7a7a]">SSD</label>
              <input {...register("ssd")} placeholder="VD: 512GB" className="w-full h-[44px] px-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all" />
            </div>
            <div className="space-y-1">
              <label className="block text-[12px] text-[#7a7a7a]">Màn hình</label>
              <input {...register("screen")} placeholder='VD: 2K, FHD' className="w-full h-[44px] px-3 rounded-lg bg-[#f5f5f7] border border-[#e0e0e0] text-[15px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all" />
            </div>
          </div>
        </div>
      </div>

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
          {isLoading ? (initialData ? "Đang lưu..." : "Đang tạo...") : (initialData ? "Lưu thay đổi" : "Tạo Model")}
        </button>
      </div>
      </form>

      <CategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        onUpdate={loadData}
      />

      <BrandManagerDialog
        isOpen={isBrandManagerOpen}
        onClose={() => setIsBrandManagerOpen(false)}
        onUpdate={loadData}
      />
    </>
  );
}
