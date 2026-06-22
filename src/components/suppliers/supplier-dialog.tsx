"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog } from "@/components/ui/dialog";
import { createSupplier, updateSupplier } from "@/app/actions/suppliers";
import { toast } from "sonner";
import { CustomSelect } from "@/components/ui/custom-select";
import { getCountriesList } from "@/app/actions/shipping-countries";
import { CountryManagerDialog } from "@/components/inventory/country-manager-dialog";

const supplierSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên nhà cung cấp"),
  contactName: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().optional().or(z.literal("")).refine((val) => {
    if (!val) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, "Email không đúng định dạng"),
  address: z.string().optional().or(z.literal("")),
  country: z.string().min(1, "Vui lòng chọn quốc gia"),
  taxCode: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface SupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (supplierId: string) => void;
  supplier?: {
    id: string;
    name: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    country: string | null;
    taxCode: string | null;
    notes: string | null;
    isActive: boolean;
  } | null;
}

export function SupplierDialog({ isOpen, onClose, onSuccess, supplier }: SupplierDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [countriesList, setCountriesList] = useState<{ id: string; code: string; name: string; isActive: boolean; createdAt?: Date }[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [isCountryManagerOpen, setIsCountryManagerOpen] = useState(false);

  const loadCountries = async () => {
    setLoadingCountries(true);
    try {
      const data = await getCountriesList();
      let activeCountries: { id: string; code: string; name: string; isActive: boolean; createdAt?: Date }[] = data.filter((c) => c.isActive);
      if (!activeCountries.some((c) => c.code === "VN")) {
        activeCountries = [{ id: "vn-default", code: "VN", name: "Việt Nam", isActive: true }, ...activeCountries];
      }
      setCountriesList(activeCountries);
    } catch (error) {
      console.error("Lỗi lấy danh sách quốc gia", error);
    } finally {
      setLoadingCountries(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
      country: "VN",
      taxCode: "",
      notes: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      loadCountries();
      if (supplier) {
        reset({
          name: supplier.name,
          contactName: supplier.contactName || "",
          phone: supplier.phone || "",
          email: supplier.email || "",
          address: supplier.address || "",
          country: supplier.country || "VN",
          taxCode: supplier.taxCode || "",
          notes: supplier.notes || "",
          isActive: supplier.isActive,
        });
      } else {
        reset({
          name: "",
          contactName: "",
          phone: "",
          email: "",
          address: "",
          country: "VN",
          taxCode: "",
          notes: "",
          isActive: true,
        });
      }
    }
  }, [isOpen, supplier, reset]);

  const onSubmitHandler = async (values: SupplierFormValues) => {
    setIsPending(true);
    try {
      let res;
      if (supplier) {
        res = await updateSupplier(supplier.id, values);
      } else {
        res = await createSupplier(values);
      }

      if (res.success && res.data) {
        toast.success(res.message);
        onSuccess?.(res.data.id);
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error(supplier ? "Có lỗi xảy ra khi cập nhật nhà cung cấp" : "Có lỗi xảy ra khi tạo nhà cung cấp");
    } finally {
      setIsPending(false);
    }
  };


  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={supplier ? "Chỉnh sửa Nhà cung cấp" : "Thêm Nhà cung cấp mới"}
        description={supplier ? `Chỉnh sửa thông tin đối tác "${supplier.name}".` : "Tạo nhà cung cấp mới."}
        size="lg"
      >
      <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tên nhà cung cấp */}
          <div className="space-y-1 md:col-span-2">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Tên nhà cung cấp *</label>
            <input
              type="text"
              {...register("name")}
              placeholder="VD: Apple Sing"
              className="w-full h-[40px] px-3.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
            {errors.name && <p className="text-[11px] text-[#b91c1c]">{errors.name.message}</p>}
          </div>

          {/* Người liên hệ */}
          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Người liên hệ</label>
            <input
              type="text"
              {...register("contactName")}
              placeholder="Họ và tên"
              className="w-full h-[40px] px-3.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
          </div>

          {/* Số điện thoại */}
          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Số điện thoại</label>
            <input
              type="text"
              {...register("phone")}
              placeholder="Số điện thoại liên lạc"
              className="w-full h-[40px] px-3.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Email</label>
            <input
              type="text"
              {...register("email")}
              placeholder="Email liên lạc"
              className="w-full h-[40px] px-3.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
            {errors.email && <p className="text-[11px] text-[#b91c1c]">{errors.email.message}</p>}
          </div>

          {/* Mã số thuế */}
          <div className="space-y-1">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Mã số thuế</label>
            <input
              type="text"
              {...register("taxCode")}
              placeholder="Mã số thuế"
              className="w-full h-[40px] px-3.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
          </div>

          {/* Quốc gia */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-[13px] font-semibold text-[#1d1d1f]">Quốc gia</label>
              <button 
                type="button" 
                onClick={() => setIsCountryManagerOpen(true)}
                className="text-[11px] font-semibold text-[#0066cc] hover:underline cursor-pointer"
              >
                Quản lý
              </button>
            </div>
            <Controller
              name="country"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  options={countriesList.map((c) => ({
                    value: c.code,
                    label: c.name,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  size="sm"
                  dropdownWidth="full"
                  disabled={loadingCountries}
                  placeholder="Chọn quốc gia..."
                  searchable={true}
                />
              )}
            />
            {errors.country && <p className="text-[11px] text-[#b91c1c]">{errors.country.message}</p>}
          </div>

          {/* Trạng thái hoạt động (Chỉ hiện khi sửa) */}
          {supplier && (
            <div className="space-y-1 flex items-center gap-3 pt-6.5">
              <input
                type="checkbox"
                id="isActive"
                {...register("isActive")}
                className="w-4.5 h-4.5 accent-[#0066cc] cursor-pointer"
              />
              <label htmlFor="isActive" className="text-[14px] font-semibold text-[#1d1d1f] cursor-pointer">
                Đang hoạt động
              </label>
            </div>
          )}

          {/* Địa chỉ */}
          <div className="space-y-1 md:col-span-2">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Địa chỉ</label>
            <input
              type="text"
              {...register("address")}
              placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
              className="w-full h-[40px] px-3.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all"
            />
          </div>

          {/* Ghi chú */}
          <div className="space-y-1 md:col-span-2">
            <label className="block text-[13px] font-semibold text-[#1d1d1f]">Ghi chú</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Thông tin phụ trợ (Tài khoản ngân hàng, ghi chú chiết khấu...)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f5f7] border border-[#e0e0e0] text-[14px] text-[#1d1d1f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 transition-all resize-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#f5f5f7]">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4.5 h-[38px] rounded-full bg-[#f5f5f7] border border-[#e0e0e0] text-[#1d1d1f] text-[13px] font-medium hover:bg-[#e0e0e0] transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 h-[38px] rounded-full bg-[#0066cc] text-white text-[13px] font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </Dialog>

    <CountryManagerDialog
      isOpen={isCountryManagerOpen}
      onClose={() => setIsCountryManagerOpen(false)}
      onUpdate={loadCountries}
    />
  </>
  );
}
