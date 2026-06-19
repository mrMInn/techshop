import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getCategories, 
  getBrands, 
  createCategory, 
  createBrand, 
  createProduct, 
  updateCategory, 
  deleteCategory, 
  updateBrand, 
  deleteBrand, 
  deleteProduct, 
  getProductsList, 
  updateProduct 
} from '@/app/actions/products';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Server Actions - Products, Categories & Brands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCategories & getBrands', () => {
    it('getCategories should query database and sort by name', async () => {
      const mockResult = [{ id: '1', name: 'Laptops' }];
      const mockOrderBy = vi.fn().mockResolvedValue(mockResult);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getCategories();
      expect(res).toEqual(mockResult);
      expect(db.select).toHaveBeenCalled();
    });

    it('getBrands should query database and sort by name', async () => {
      const mockResult = [{ id: '1', name: 'Apple' }];
      const mockOrderBy = vi.fn().mockResolvedValue(mockResult);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getBrands();
      expect(res).toEqual(mockResult);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('createCategory', () => {
    it('should create category successfully', async () => {
      const mockCategory = { id: 'cat-1', name: 'Laptop', slug: 'laptop' };
      const mockReturning = vi.fn().mockResolvedValue([mockCategory]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createCategory('Laptop');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockCategory);
    });

    it('should handle unique constraint violation for category', async () => {
      const error = new Error('duplicate key');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createCategory('Laptop');
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic error for category creation', async () => {
      const mockReturning = vi.fn().mockRejectedValue(new Error('DB Error'));
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createCategory('Laptop');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể thêm danh mục');
    });
  });

  describe('createBrand', () => {
    it('should create brand successfully', async () => {
      const mockBrand = { id: 'brand-1', name: 'Apple' };
      const mockReturning = vi.fn().mockResolvedValue([mockBrand]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createBrand('Apple');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBrand);
    });

    it('should handle unique constraint violation for brand', async () => {
      const error = new Error('duplicate key');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createBrand('Apple');
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic error for brand creation', async () => {
      const mockReturning = vi.fn().mockRejectedValue(new Error('DB Error'));
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createBrand('Apple');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể thêm thương hiệu');
    });
  });

  describe('createProduct', () => {
    it('should create product successfully', async () => {
      const mockProduct = { id: 'prod-1', name: 'MacBook Pro', sku: 'MBP14', categoryId: 'cat-1', brandId: 'brand-1' };
      const mockReturning = vi.fn().mockResolvedValue([mockProduct]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createProduct({
        name: 'MacBook Pro',
        sku: 'MBP14',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        specs: { cpu: 'M3 Pro' }
      });
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockProduct);
    });

    it('should handle unique constraint violation for product', async () => {
      const error = new Error('duplicate key');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createProduct({
        name: 'MacBook Pro',
        sku: 'MBP14',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        specs: {}
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic error for product creation', async () => {
      const mockReturning = vi.fn().mockRejectedValue(new Error('DB Error'));
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createProduct({
        name: 'MacBook Pro',
        sku: 'MBP14',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        specs: {}
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể thêm sản phẩm');
    });
  });

  describe('updateCategory & deleteCategory', () => {
    it('should update category successfully', async () => {
      const mockCategory = { id: 'cat-1', name: 'New Name' };
      const mockReturning = vi.fn().mockResolvedValue([mockCategory]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateCategory('cat-1', 'New Name');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockCategory);
    });

    it('should handle unique violation when updating category', async () => {
      const error = new Error('duplicate key');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateCategory('cat-1', 'New Name');
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic error when updating category', async () => {
      const mockReturning = vi.fn().mockRejectedValue(new Error('DB Error'));
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateCategory('cat-1', 'New Name');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể cập nhật danh mục');
    });

    it('should delete category successfully', async () => {
      const mockWhere = vi.fn().mockResolvedValue(true);
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteCategory('cat-1');
      expect(res.success).toBe(true);
      expect(res.message).toContain('thành công');
    });

    it('should handle foreign key error when deleting category', async () => {
      const error = new Error('foreign key constraint');
      (error as any).code = '23503';
      const mockWhere = vi.fn().mockRejectedValue(error);
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteCategory('cat-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể xóa danh mục vì đang có sản phẩm');
    });

    it('should handle generic error when deleting category', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('DB Error'));
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteCategory('cat-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể xóa danh mục');
    });
  });

  describe('updateBrand & deleteBrand & deleteProduct', () => {
    it('should update brand successfully', async () => {
      const mockBrand = { id: 'brand-1', name: 'New Sony' };
      const mockReturning = vi.fn().mockResolvedValue([mockBrand]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateBrand('brand-1', 'New Sony');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBrand);
    });

    it('should handle unique violation when updating brand', async () => {
      const error = new Error('duplicate key');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateBrand('brand-1', 'New Sony');
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic error when updating brand', async () => {
      const mockReturning = vi.fn().mockRejectedValue(new Error('DB Error'));
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateBrand('brand-1', 'New Sony');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể cập nhật thương hiệu');
    });

    it('should delete brand successfully', async () => {
      const mockWhere = vi.fn().mockResolvedValue(true);
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteBrand('brand-1');
      expect(res.success).toBe(true);
      expect(res.message).toContain('thành công');
    });

    it('should handle foreign key error when deleting brand', async () => {
      const error = new Error('fk error');
      (error as any).code = '23503';
      const mockWhere = vi.fn().mockRejectedValue(error);
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteBrand('brand-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể xóa thương hiệu vì đang có sản phẩm');
    });

    it('should handle generic error when deleting brand', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('DB Error'));
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteBrand('brand-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể xóa thương hiệu');
    });

    it('should delete product successfully', async () => {
      const mockWhere = vi.fn().mockResolvedValue(true);
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteProduct('prod-1');
      expect(res.success).toBe(true);
      expect(res.message).toContain('thành công');
    });

    it('should handle foreign key error when deleting product', async () => {
      const error = new Error('fk error');
      (error as any).code = '23503';
      const mockWhere = vi.fn().mockRejectedValue(error);
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteProduct('prod-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể xóa model này vì đang có máy');
    });

    it('should handle generic error when deleting product', async () => {
      const mockWhere = vi.fn().mockRejectedValue(new Error('DB Error'));
      (db.delete as any).mockReturnValue({ where: mockWhere });

      const res = await deleteProduct('prod-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể xóa model sản phẩm');
    });
  });

  describe('getProductsList & updateProduct', () => {
    it('should retrieve products list with inner joins', async () => {
      const mockList = [{ id: 'prod-1', name: 'MacBook', categoryName: 'Laptops', brandName: 'Apple' }];
      const mockOrderBy = vi.fn().mockResolvedValue(mockList);
      const mockInnerJoin2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getProductsList();
      expect(res).toEqual(mockList);
    });

    it('should return empty list on products fetch error', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Database disconnected');
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getProductsList();
      expect(res).toEqual([]);
    });

    it('should update product details successfully', async () => {
      const mockProduct = { id: 'prod-1', name: 'MacBook M3' };
      const mockReturning = vi.fn().mockResolvedValue([mockProduct]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateProduct('prod-1', {
        name: 'MacBook M3',
        sku: 'MBPM3',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        specs: {}
      });
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockProduct);
    });

    it('should handle unique violation when updating product', async () => {
      const error = new Error('duplicate key');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateProduct('prod-1', {
        name: 'MacBook M3',
        sku: 'MBPM3',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        specs: {}
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic error when updating product', async () => {
      const mockReturning = vi.fn().mockRejectedValue(new Error('DB Error'));
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateProduct('prod-1', {
        name: 'MacBook M3',
        sku: 'MBPM3',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        specs: {}
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể cập nhật Model sản phẩm');
    });
  });
});
