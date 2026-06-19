import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getCustomersList,
  getCustomerDetail,
  createCustomerFullAction, 
  updateCustomerAction,
  deleteCustomerAction,
  getLeadSourcesList
} from '@/app/actions/customers'; 
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/constants', () => ({
  DEFAULT_LEAD_SOURCES: [
    { name: 'VOZ Forum', icon: '💬', color: '#0066cc' }
  ]
}));

describe('Server Action - Quản lý Khách Hàng', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {}); 
  });

  describe('getCustomersList', () => {
    it('should return list of customers with lead sources', async () => {
      const mockList = [{ id: 'cust-1', fullName: 'John Doe', leadSourceName: 'VOZ Forum' }];
      const mockOrderBy = vi.fn().mockResolvedValue(mockList);
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: vi.fn().mockReturnValue({ orderBy: mockOrderBy }) });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getCustomersList();
      expect(res).toEqual(mockList);
    });

    it('should return empty array on fetch customers failure', async () => {
      (db.select as any).mockImplementation(() => {
        throw new Error('Database disconnected');
      });

      const res = await getCustomersList();
      expect(res).toEqual([]);
    });
  });

  describe('getCustomerDetail', () => {
    it('should return null if customer not found', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: vi.fn().mockReturnValue({ where: mockWhere }) });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getCustomerDetail('missing-id');
      expect(res).toBeNull();
    });

    it('should return detailed profile, orders, returns, and items', async () => {
      const mockCustomer = [{ id: 'cust-1', fullName: 'John' }];
      const mockOrders = [{ id: 'ord-1', orderNumber: 'ORD-1' }];
      const mockItems = [{ serialNumber: 'SN-1', productName: 'iPhone' }];
      const mockReturns = [{ id: 'ret-1', returnNumber: 'RET-1' }];

      // We have multiple db.select calls
      const mockLimit = vi.fn().mockResolvedValue(mockCustomer);
      const mockWhereCustomer = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFromCustomer = vi.fn().mockReturnValue({ leftJoin: vi.fn().mockReturnValue({ where: mockWhereCustomer }) });

      const mockOrderByOrders = vi.fn().mockResolvedValue(mockOrders);
      const mockWhereOrders = vi.fn().mockReturnValue({ orderBy: mockOrderByOrders });
      const mockFromOrders = vi.fn().mockReturnValue({ where: mockWhereOrders });

      const mockOrderByItems = vi.fn().mockResolvedValue(mockItems);
      const mockWhereItems = vi.fn().mockReturnValue({ orderBy: mockOrderByItems });
      const mockInner3 = vi.fn().mockReturnValue({ innerJoin: vi.fn().mockReturnValue({ where: mockWhereItems }) });
      const mockInner2 = vi.fn().mockReturnValue({ innerJoin: mockInner3 });
      const mockInner1 = vi.fn().mockReturnValue({ innerJoin: mockInner2 });
      const mockFromItems = vi.fn().mockReturnValue({ innerJoin: mockInner1 });

      const mockOrderByReturns = vi.fn().mockResolvedValue(mockReturns);
      const mockWhereReturns = vi.fn().mockReturnValue({ orderBy: mockOrderByReturns });
      const mockInnerReturn2 = vi.fn().mockReturnValue({ innerJoin: vi.fn().mockReturnValue({ where: mockWhereReturns }) });
      const mockInnerReturn1 = vi.fn().mockReturnValue({ innerJoin: mockInnerReturn2 });
      const mockFromReturns = vi.fn().mockReturnValue({ innerJoin: mockInnerReturn1 });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFromCustomer })
        .mockReturnValueOnce({ from: mockFromOrders })
        .mockReturnValueOnce({ from: mockFromItems })
        .mockReturnValueOnce({ from: mockFromReturns });

      const res = await getCustomerDetail('cust-1');
      expect(res).not.toBeNull();
      expect(res?.customer).toEqual(mockCustomer[0]);
      expect(res?.orders).toEqual(mockOrders);
      expect(res?.purchasedItems).toEqual(mockItems);
      expect(res?.returns).toEqual(mockReturns);
    });

    it('should return null on details database query error', async () => {
      (db.select as any).mockImplementation(() => {
        throw new Error('Details failed');
      });

      const res = await getCustomerDetail('cust-1');
      expect(res).toBeNull();
    });
  });

  describe('createCustomerFullAction', () => {
    it('phải báo lỗi và chặn lại nếu tạo khách hàng để trống số điện thoại hoặc tên', async () => {
      const result = await createCustomerFullAction({
        fullName: '   ', 
        phone: '',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('không được để trống');
    });

    it('phải tạo khách hàng thành công khi data hợp lệ', async () => {
      const mockCustomer = { id: 'cust-1', fullName: 'Nguyễn Văn A' };
      const mockReturning = vi.fn().mockResolvedValue([mockCustomer]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as any).mockReturnValue({ values: mockValues });

      const result = await createCustomerFullAction({
        fullName: 'Nguyễn Văn A',
        phone: '0901234567',
        email: 'a@a.com',
      });

      expect(result.success).toBe(true);
      expect(result.customer).toEqual(mockCustomer);
    });

    it('phải chặn và báo lỗi nếu database quăng lỗi trùng lặp (Duplicate Email/Phone)', async () => {
      const mockError = new Error('duplicate key');
      (mockError as any).code = '23505';

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(mockError)
        })
      });

      const result = await createCustomerFullAction({
        fullName: 'Nguyễn Văn A',
        phone: '0901234567',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('đã tồn tại trong hệ thống');
    });

    it('phải báo lỗi hệ thống khi insert gặp lỗi DB chung', async () => {
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Insert error'))
        })
      });

      const result = await createCustomerFullAction({
        fullName: 'Nguyễn Văn A',
        phone: '0901234567',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Không thể thêm khách hàng');
    });
  });

  describe('updateCustomerAction', () => {
    it('should return error if customer to update does not exist', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await updateCustomerAction('missing-id', { fullName: 'Updated' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy khách hàng');
    });

    it('should update customer successfully', async () => {
      const mockCustomer = { id: 'cust-1', fullName: 'Updated' };
      
      const mockLimit = vi.fn().mockResolvedValue([mockCustomer]);
      const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const mockReturning = vi.fn().mockResolvedValue([mockCustomer]);
      const mockWhereUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateCustomerAction('cust-1', {
        fullName: 'Updated',
        phone: '090',
        email: 'updated@com.com',
        address: 'Hanoi',
        taxCode: '123',
        notes: 'Updated note'
      });

      expect(res.success).toBe(true);
      expect(res.customer).toEqual(mockCustomer);
    });

    it('should handle unique violation 23505 on update', async () => {
      const mockCustomer = { id: 'cust-1' };
      const mockLimit = vi.fn().mockResolvedValue([mockCustomer]);
      const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const error = new Error('duplicate');
      (error as any).code = '23505';
      const mockReturning = vi.fn().mockRejectedValue(error);
      const mockWhereUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateCustomerAction('cust-1', { fullName: 'Conflict' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại');
    });

    it('should handle generic database error on update', async () => {
      const mockCustomer = { id: 'cust-1' };
      const mockLimit = vi.fn().mockResolvedValue([mockCustomer]);
      const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const mockReturning = vi.fn().mockRejectedValue(new Error('Update failed'));
      const mockWhereUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateCustomerAction('cust-1', { fullName: 'Error' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể cập nhật khách hàng');
    });
  });

  describe('deleteCustomerAction', () => {
    it('phải CHẶN ĐỨNG việc xóa khách hàng nếu khách hàng ĐÃ TỪNG CÓ ĐƠN HÀNG', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'order-123' }]) 
          })
        })
      });

      const result = await deleteCustomerAction('customer-vip-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Không thể xóa khách hàng đã có đơn hàng');
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('phải xóa khách hàng thành công nếu chưa có đơn hàng', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]) 
          })
        })
      });
      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(true)
      });

      const result = await deleteCustomerAction('customer-vip-1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(db.delete).toHaveBeenCalled();
    });

    it('should handle database exception on delete', async () => {
      (db.select as any).mockImplementation(() => {
        throw new Error('Delete query blocked');
      });

      const result = await deleteCustomerAction('customer-vip-1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Không thể xóa khách hàng');
    });
  });

  describe('getLeadSourcesList', () => {
    it('should upsert sources and delete outdated ones', async () => {
      // 1. select from leadSources returns existing sources
      const mockSources = [{ id: 'src-old-1', name: 'Zalo' }];
      const mockFromSelect = vi.fn().mockResolvedValue(mockSources);
      
      // 2. update call for customers, orders, quotations
      const mockWhereUpdate = vi.fn().mockResolvedValue(true);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
      
      // 3. delete call for leadSources
      const mockWhereDelete = vi.fn().mockResolvedValue(true);

      // 4. insert call (onConflictDoUpdate)
      const mockOnConflict = vi.fn().mockResolvedValue(true);
      const mockValuesInsert = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict });

      // 5. final select list
      const mockList = [{ id: 'src-new-1', name: 'VOZ Forum', icon: '💬', color: '#0066cc', isActive: true }];
      const mockOrderBy = vi.fn().mockResolvedValue(mockList);
      const mockWhereFinal = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFromFinal = vi.fn().mockReturnValue({ where: mockWhereFinal });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFromSelect }) // existing sources
        .mockReturnValueOnce({ from: mockFromFinal }); // final list

      (db.update as any).mockReturnValue({ set: mockSet });
      (db.delete as any).mockReturnValue({ where: mockWhereDelete });
      (db.insert as any).mockReturnValue({ values: mockValuesInsert });

      const res = await getLeadSourcesList();
      expect(res).toEqual(mockList);
    });

    it('should return empty list on lead sources fetch database exception', async () => {
      (db.select as any).mockImplementation(() => {
        throw new Error('Upsert error');
      });

      const res = await getLeadSourcesList();
      expect(res).toEqual([]);
    });
  });
});