import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createReturn, 
  deleteReturnAction, 
  getReturnsList, 
  getReturnDetailAction 
} from '@/app/actions/returns';
import { db } from '@/lib/db';

const { mockDb, setMockData, resetMockData } = vi.hoisted(() => {
  let mockDataStore: Record<string, any> = {};

  function getTableName(table: any): string {
    if (!table) return 'unknown';
    const drizzleNameSymbol = Object.getOwnPropertySymbols(table).find(s => s.toString().includes('Name') || s.toString().includes('drizzle'));
    const name = drizzleNameSymbol ? table[drizzleNameSymbol] : (table._?.name || 'unknown');
    return name;
  }

  function extractValues(clause: any): string[] {
    if (!clause) return [];
    const vals: string[] = [];
    if (Array.isArray(clause.queryChunks)) {
      for (const chunk of clause.queryChunks) {
        if (chunk && chunk.value !== undefined && !Array.isArray(chunk.value)) {
          vals.push(String(chunk.value));
        }
      }
    }
    if (Array.isArray(clause.conditions)) {
      for (const cond of clause.conditions) {
        vals.push(...extractValues(cond));
      }
    }
    return vals;
  }

  const mockChain = (tableName: string) => {
    let whereClause: any = null;
    const chain: any = {
      tableName,
      leftJoin: vi.fn().mockImplementation(() => chain),
      innerJoin: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation((clause) => {
        whereClause = clause;
        return chain;
      }),
      orderBy: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockImplementation(() => {
        let val = mockDataStore[tableName] || [];
        if (whereClause) {
          const vals = extractValues(whereClause);
          if (vals.length > 0) {
            val = val.filter((item: any) => {
              return Object.values(item).some(v => vals.includes(String(v)));
            });
          }
        }
        return Promise.resolve(val);
      }),
      returning: vi.fn().mockImplementation(() => {
        const val = mockDataStore[tableName] || [];
        return Promise.resolve(val);
      }),
      then: vi.fn().mockImplementation((cb: any) => {
        let val = mockDataStore[tableName] || [];
        if (whereClause) {
          const vals = extractValues(whereClause);
          if (vals.length > 0) {
            val = val.filter((item: any) => {
              return Object.values(item).some(v => vals.includes(String(v)));
            });
          }
        }
        return Promise.resolve(val).then(cb);
      }),
    };
    return chain;
  };

  const mockDb = {
    select: vi.fn().mockImplementation(() => {
      const selectChain = {
        from: vi.fn().mockImplementation((table: any) => {
          const tableName = getTableName(table);
          return mockChain(tableName);
        })
      };
      return selectChain;
    }),
    insert: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const insertChain = {
        values: vi.fn().mockImplementation(() => {
          return mockChain(tableName);
        })
      };
      return insertChain;
    }),
    update: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const updateChain = {
        set: vi.fn().mockImplementation(() => {
          const setChain = {
            where: vi.fn().mockImplementation(() => {
              return mockChain(tableName);
            })
          };
          return setChain;
        })
      };
      return updateChain;
    }),
    delete: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table);
      const deleteChain = {
        where: vi.fn().mockImplementation(() => {
          return mockChain(tableName);
        })
      };
      return deleteChain;
    }),
  };

  return {
    mockDb,
    setMockData: (data: Record<string, any>) => {
      mockDataStore = { ...mockDataStore, ...data };
    },
    resetMockData: () => {
      mockDataStore = {};
    }
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((cb) => cb(mockDb)),
    select: vi.fn().mockImplementation((...args) => mockDb.select(...args)),
    insert: vi.fn().mockImplementation((...args) => mockDb.insert(...args)),
    update: vi.fn().mockImplementation((...args) => mockDb.update(...args)),
    delete: vi.fn().mockImplementation((...args) => mockDb.delete(...args)),
  },
  recalculateRunningBalances: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/server', () => ({
  after: vi.fn((cb) => cb()),
}));

describe('Server Actions - Quản lý Đổi/Trả (Return/Exchange Module)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    resetMockData();
  });

  describe('createReturn', () => {
    it('phải báo lỗi nếu hệ thống chưa cấu hình tài khoản nhân viên (profile)', async () => {
      setMockData({
        profiles: [],
      });

      const result = await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'return',
        reason: 'changed_mind',
        reasonDetail: 'Khách không thích màu này nữa',
        hasFee: false,
        feeAmount: '0',
        refundAmount: '15000000',
        exchangeDifference: '0',
        items: [
          {
            inventoryItemId: 'inv-123',
            productId: 'prod-123',
            returnReason: 'customer_request',
            conditionOnReturn: 'like_new',
            isDefective: false,
            originalPrice: '15000000',
            refundPrice: '15000000',
          }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('chưa cấu hình tài khoản nhân viên');
    });

    it('phải tạo phiếu Trả hàng và hoàn tiền (hoàn đầy đủ, không phí) thành công', async () => {
      setMockData({
        profiles: [{ id: 'profile-1', fullName: 'Nhân viên' }],
        inventory_items: [{ id: 'inv-123', status: 'sold', serialNumber: 'SN-123' }],
        returns: [{ id: 'ret-123', returnNumber: 'RET-001' }],
        orders: [{ id: 'order-123', paymentMethod: 'bank_transfer', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: [{ sellingPrice: '15000000', costPrice: '10000000', discount: '0', status: 'sold' }]
      });

      const result = (await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'return',
        reason: 'changed_mind',
        reasonDetail: 'Đổi ý',
        hasFee: false,
        feeAmount: '0',
        refundAmount: '15000000',
        exchangeDifference: '0',
        items: [
          {
            inventoryItemId: 'inv-123',
            productId: 'prod-123',
            returnReason: 'customer_request',
            conditionOnReturn: 'like_new',
            isDefective: false,
            originalPrice: '15000000',
            refundPrice: '15000000',
          }
        ]
      })) as any;

      expect(result.success).toBe(true);
      expect(result.return.returnNumber).toBe('RET-001');
    });

    it('phải tạo phiếu Trả hàng và ghi nhận THU PHÍ đổi trả khi khách trả máy không lỗi', async () => {
      setMockData({
        profiles: [{ id: 'profile-1', fullName: 'Nhân viên' }],
        inventory_items: [{ id: 'inv-123', status: 'sold', serialNumber: 'SN-123' }],
        returns: [{ id: 'ret-123', returnNumber: 'RET-002' }],
        orders: [{ id: 'order-123', paymentMethod: 'cash', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: [{ sellingPrice: '15000000', costPrice: '10000000', discount: '0', status: 'sold' }]
      });

      const result = (await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'return',
        reason: 'changed_mind',
        reasonDetail: 'Đổi ý',
        hasFee: true,
        feeAmount: '500000',
        refundAmount: '14500000',
        exchangeDifference: '0',
        items: [
          {
            inventoryItemId: 'inv-123',
            productId: 'prod-123',
            returnReason: 'customer_request',
            conditionOnReturn: 'good',
            isDefective: false,
            originalPrice: '15000000',
            refundPrice: '14500000',
          }
        ]
      })) as any;

      expect(result.success).toBe(true);
    });

    it('phải tạo phiếu Trả hàng lỗi và đưa máy về trạng thái defective (Kho lỗi) thành công', async () => {
      setMockData({
        profiles: [{ id: 'profile-1', fullName: 'Nhân viên' }],
        inventory_items: [{ id: 'inv-123', status: 'sold', serialNumber: 'SN-123' }],
        returns: [{ id: 'ret-123', returnNumber: 'RET-003' }],
        orders: [{ id: 'order-123', paymentMethod: 'cash', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: [{ sellingPrice: '15000000', costPrice: '10000000', discount: '0', status: 'sold' }]
      });

      const result = (await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'return',
        reason: 'defective',
        reasonDetail: 'Lỗi vặt phát sinh liên tục',
        hasFee: false,
        feeAmount: '0',
        refundAmount: '15000000',
        exchangeDifference: '0',
        items: [
          {
            inventoryItemId: 'inv-123',
            productId: 'prod-123',
            returnReason: 'defective',
            conditionOnReturn: 'defective',
            isDefective: true,
            defectDescription: 'Lỗi wifi chập chờn',
            originalPrice: '15000000',
            refundPrice: '15000000',
          }
        ]
      })) as any;

      expect(result.success).toBe(true);
    });
  });

  describe('deleteReturnAction', () => {
    it('phải thực thi xóa phiếu đổi trả, khôi phục máy cũ về trạng thái sold và xóa sổ quỹ', async () => {
      setMockData({
        returns: [{ id: 'ret-123', returnNumber: 'RET-001', orderId: 'order-123', type: 'return', customerId: 'cust-123' }],
        return_items: [{ id: 'ret-item-1', inventoryItemId: 'inv-123', productId: 'prod-123', newInventoryItemId: null }],
        inventory_items: [{ id: 'inv-123', status: 'in_stock', serialNumber: 'SN-123' }],
        orders: [{ id: 'order-123', paymentMethod: 'bank_transfer', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: [{ sellingPrice: '15000000', costPrice: '10000000', discount: '0', status: 'sold' }]
      });

      const result = await deleteReturnAction('ret-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Đã xóa thành công');
    });
  });

  describe('Helper Getters', () => {
    it('getReturnsList: phải trả về danh sách phiếu đổi trả', async () => {
      setMockData({
        returns: [{ id: 'ret-1', returnNumber: 'RET-001', customerName: 'Khách A' }]
      });
      const list = await getReturnsList();
      expect(list.length).toBe(1);
    });

    it('getReturnDetailAction: phải trả về chi tiết phiếu đổi trả và danh sách sản phẩm', async () => {
      setMockData({
        returns: [{ id: 'ret-1', returnNumber: 'RET-001' }],
        return_items: [{ id: 'ret-item-1', returnId: 'ret-1', productName: 'Laptop Asus', refundPrice: '10000000' }]
      });

      const res = await getReturnDetailAction('ret-1');
      expect(res.success).toBe(true);
      expect(res.returnData?.returnNumber).toBe('RET-001');
      expect(res.items?.length).toBe(1);
    });

    it('getReturnsList: xử lý lỗi catch block', async () => {
      vi.spyOn(db, 'select').mockImplementationOnce(() => {
        throw new Error('DB error');
      });
      const list = await getReturnsList();
      expect(list).toEqual([]);
    });

    it('getReturnDetailAction: xử lý lỗi catch block', async () => {
      vi.spyOn(db, 'select').mockImplementationOnce(() => {
        throw new Error('DB error');
      });
      const res = await getReturnDetailAction('ret-1');
      expect(res.success).toBe(false);
      expect(res.message).toBe('DB error');
    });

    it('getReturnDetailAction: trả về thất bại nếu không tìm thấy phiếu đổi trả', async () => {
      setMockData({
        returns: []
      });
      const res = await getReturnDetailAction('ret-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy phiếu đổi trả');
    });
  });

  describe('createReturn Edge Cases', () => {
    it('phải báo lỗi khi giao dịch thất bại', async () => {
      vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Transaction failed'));
      const result = await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'return',
        reason: 'changed_mind',
        reasonDetail: 'test',
        hasFee: false,
        feeAmount: '0',
        refundAmount: '0',
        exchangeDifference: '0',
        items: [],
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Transaction failed');
    });

    it('phải tạo phiếu Đổi hàng thành công với chênh lệch dương (thu tiền)', async () => {
      setMockData({
        profiles: [{ id: 'profile-1', fullName: 'Staff' }],
        inventory_items: [],
        returns: [{ id: 'ret-123', returnNumber: 'RET-001' }],
        orders: [{ id: 'order-123', paymentMethod: 'card', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: []
      });

      const result = await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'exchange',
        reason: 'upgrade',
        reasonDetail: 'Nâng cấp lên Pro Max',
        hasFee: false,
        feeAmount: '0',
        refundAmount: '0',
        exchangeDifference: '2000000',
        items: []
      });
      expect(result.success).toBe(true);
    });

    it('phải tạo phiếu Đổi hàng thành công với chênh lệch âm (chi hoàn tiền)', async () => {
      setMockData({
        profiles: [{ id: 'profile-1', fullName: 'Staff' }],
        inventory_items: [],
        returns: [{ id: 'ret-123', returnNumber: 'RET-001' }],
        orders: [{ id: 'order-123', paymentMethod: 'bank_transfer', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: []
      });

      const result = await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'exchange',
        reason: 'downgrade',
        reasonDetail: 'Hạ cấp',
        hasFee: false,
        feeAmount: '0',
        refundAmount: '0',
        exchangeDifference: '-1000000',
        items: []
      });
      expect(result.success).toBe(true);
    });

    it('phải báo lỗi khi đổi hàng nhưng không tìm thấy máy mới trong kho', async () => {
      setMockData({
        profiles: [{ id: 'profile-1', fullName: 'Staff' }],
        inventory_items: [
          { id: 'inv-old', status: 'sold', serialNumber: 'SN-OLD' },
          // inv-new is missing
        ],
        returns: [{ id: 'ret-123', returnNumber: 'RET-001' }],
        orders: [{ id: 'order-123', paymentMethod: 'cash', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: [{ warrantyMonths: 12, discount: '0', inventoryItemId: 'inv-old' }]
      });

      const result = await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'exchange',
        reason: 'upgrade',
        reasonDetail: 'upgrade',
        hasFee: false,
        feeAmount: '0',
        refundAmount: '0',
        exchangeDifference: '0',
        items: [
          {
            inventoryItemId: 'inv-old',
            productId: 'prod-123',
            returnReason: 'defective',
            conditionOnReturn: 'defective',
            isDefective: true,
            originalPrice: '10000000',
            refundPrice: '10000000',
            newInventoryItemId: 'inv-new',
            newSellingPrice: '12000000',
          }
        ]
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Không tìm thấy máy mới');
    });

    it('phải tạo phiếu Đổi hàng và cập nhật đơn hàng gốc thành công khi có máy mới hợp lệ', async () => {
      setMockData({
        profiles: [{ id: 'profile-1', fullName: 'Staff' }],
        inventory_items: [
          { id: 'inv-old', status: 'sold', serialNumber: 'SN-OLD' },
          { id: 'inv-new', status: 'in_stock', serialNumber: 'SN-NEW', costPrice: '8000000' }
        ],
        returns: [{ id: 'ret-123', returnNumber: 'RET-001' }],
        orders: [{ id: 'order-123', paymentMethod: 'cash', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: [
          { warrantyMonths: 12, discount: '0', inventoryItemId: 'inv-old', sellingPrice: '10000000' },
          { warrantyMonths: 12, discount: '0', inventoryItemId: 'inv-new', sellingPrice: '12000000', costPrice: '8000000', status: 'sold' }
        ]
      });

      const result = await createReturn({
        orderId: 'order-123',
        customerId: 'cust-123',
        type: 'exchange',
        reason: 'upgrade',
        reasonDetail: 'upgrade',
        hasFee: false,
        feeAmount: '0',
        refundAmount: '0',
        exchangeDifference: '2000000',
        items: [
          {
            inventoryItemId: 'inv-old',
            productId: 'prod-123',
            returnReason: 'defective',
            conditionOnReturn: 'defective',
            isDefective: true,
            originalPrice: '10000000',
            refundPrice: '10000000',
            newInventoryItemId: 'inv-new',
            newSellingPrice: '12000000',
          }
        ]
      });
      expect(result.success).toBe(true);
    });
  });

  describe('deleteReturnAction Edge Cases', () => {
    it('phải báo lỗi khi giao dịch xóa thất bại', async () => {
      vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Transaction failed'));
      const result = await deleteReturnAction('ret-123');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Transaction failed');
    });

    it('phải báo lỗi nếu không tìm thấy phiếu đổi trả cần xóa', async () => {
      setMockData({
        returns: []
      });

      const result = await deleteReturnAction('ret-123');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Không tìm thấy phiếu đổi trả');
    });

    it('phải xóa phiếu Đổi hàng thành công, hoàn tác máy mới và tính toán lại đơn hàng', async () => {
      setMockData({
        returns: [{ id: 'ret-123', returnNumber: 'RET-001', orderId: 'order-123', type: 'exchange', customerId: 'cust-123' }],
        return_items: [{ id: 'ret-item-1', inventoryItemId: 'inv-old', newInventoryItemId: 'inv-new', originalPrice: '10000000' }],
        inventory_items: [
          { id: 'inv-old', status: 'in_stock', serialNumber: 'SN-OLD' },
          { id: 'inv-new', status: 'sold', serialNumber: 'SN-NEW' }
        ],
        orders: [{ id: 'order-123', paymentMethod: 'cash', customerId: 'cust-123', totalAmount: '15000000' }],
        order_items: [
          { warrantyMonths: 12, discount: '0', inventoryItemId: 'inv-old', sellingPrice: '10000000', costPrice: '8000000', status: 'sold' }
        ]
      });

      const result = await deleteReturnAction('ret-123');
      expect(result.success).toBe(true);
    });
  });
});
