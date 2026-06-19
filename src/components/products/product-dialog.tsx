"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { ProductForm } from "@/components/products/product-form";
import { createProduct, updateProduct } from "@/app/actions/products";
import { toast } from "sonner";

interface ProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (productId: string) => void;
  product?: {
    id: string;
    name: string;
    sku: string | null;
    categoryId: string;
    brandId: string;
    specs: any;
  } | null;
}

export function ProductDialog({ isOpen, onClose, onSuccess, product }: ProductDialogProps) {
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (data: any) => {
    setIsPending(true);
    try {
      // transform specs
      const specs = {
        cpu: data.cpu,
        ram: data.ram,
        ssd: data.ssd,
        screen: data.screen,
      };

      let res;
      if (product) {
        res = await updateProduct(product.id, {
          name: data.name,
          sku: data.sku,
          categoryId: data.categoryId,
          brandId: data.brandId,
          specs,
        });
      } else {
        res = await createProduct({
          name: data.name,
          sku: data.sku,
          categoryId: data.categoryId,
          brandId: data.brandId,
          specs,
        });
      }

      if (res.success && res.data) {
        toast.success(res.message);
        onSuccess?.(res.data.id);
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error(product ? "Có lỗi xảy ra khi cập nhật Model" : "Có lỗi xảy ra khi tạo Model Sản Phẩm");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose}
      title={product ? "Sửa mã sản phẩm" : "Thêm mã sản phẩm mới"}
      description={product ? `Chỉnh sửa thông tin mẫu sản phẩm "${product.name}".` : ""}
      size="xl"
    >
      <ProductForm 
        initialData={product || undefined}
        onSubmit={handleSubmit}
        onCancel={onClose}
        isLoading={isPending}
      />
    </Dialog>
  );
}
