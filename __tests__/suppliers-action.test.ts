import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getSuppliersList,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '@/app/actions/suppliers';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Server Actions - Suppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSuppliersList', () => {
    it('should list all suppliers sorted by name', async () => {
      const mockResult = [{ id: 'sup-1', name: 'Supplier A' }];
      const mockOrderBy = vi.fn().mockResolvedValue(mockResult);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getSuppliersList();
      expect(res).toEqual(mockResult);
    });

    it('should return empty array on failure', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        orderBy: vi.fn().mockRejectedValue(new Error('Fetch error'))
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getSuppliersList();
      expect(res).toEqual([]);
    });
  });

  describe('createSupplier', () => {
    it('should insert new supplier successfully', async () => {
      const mockSupplier = { id: 'sup-1', name: 'Supplier A', country: 'VN' };
      const mockReturning = vi.fn().mockResolvedValue([mockSupplier]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createSupplier({
        name: 'Supplier A',
        contactName: 'John',
        phone: '123',
        email: 'john@sup.com',
        address: 'Hanoi',
      });
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockSupplier);
    });

    it('should handle unique violation error code 23505', async () => {
      const error = new Error('duplicate key');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createSupplier({ name: 'Supplier A' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic error on create', async () => {
      const mockReturning = vi.fn().mockRejectedValue(new Error('DB connection failed'));
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const res = await createSupplier({ name: 'Supplier A' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể thêm nhà cung cấp');
    });
  });

  describe('updateSupplier', () => {
    it('should update supplier data successfully', async () => {
      const mockSupplier = { id: 'sup-1', name: 'Supplier Updated' };
      const mockReturning = vi.fn().mockResolvedValue([mockSupplier]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateSupplier('sup-1', {
        name: 'Supplier Updated',
        phone: '987',
      });
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockSupplier);
    });

    it('should handle unique violation error code 23505 on update', async () => {
      const error = new Error('duplicate key');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateSupplier('sup-1', { name: 'Supplier A' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic error on update', async () => {
      const mockReturning = vi.fn().mockRejectedValue(new Error('DB failure'));
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateSupplier('sup-1', { name: 'Supplier A' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể cập nhật nhà cung cấp');
    });
  });

  describe('deleteSupplier', () => {
    it('should block deletion if supplier has purchase orders', async () => {
      // Mock db.select().from(purchaseOrders).where().limit(1) to return a record
      const mockLimit = vi.fn().mockResolvedValue([{ id: 'po-1' }]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await deleteSupplier('sup-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã có đơn nhập hàng liên kết');
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('should delete supplier if no purchase orders exist', async () => {
      // Mock db.select().from(purchaseOrders).where().limit(1) to return empty array
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
      
      // Mock db.delete(suppliers).where()
      const mockWhereDelete = vi.fn().mockResolvedValue(true);
      
      (db.select as any).mockReturnValue({ from: mockFrom });
      (db.delete as any).mockReturnValue({ where: mockWhereDelete });

      const res = await deleteSupplier('sup-1');
      expect(res.success).toBe(true);
      expect(res.message).toContain('thành công');
      expect(db.delete).toHaveBeenCalled();
    });

    it('should handle generic error on delete', async () => {
      // Mock db.select() to throw database exception
      const mockLimit = vi.fn().mockRejectedValue(new Error('Query error'));
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await deleteSupplier('sup-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể xóa nhà cung cấp');
    });
  });
});
