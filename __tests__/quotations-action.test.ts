import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getQuotationsList, 
  createQuotation, 
  getQuotationByToken, 
  incrementQuotationViewCount, 
  updateQuotationStatus, 
  convertQuotationToOrder 
} from '@/app/actions/quotations';
import { db } from '@/lib/db';
import { quotations, quotationItems, profiles, inventoryItems, customers } from '@/lib/db/schema';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  },
  recalculateRunningBalances: vi.fn().mockResolvedValue(true),
}));

describe('Server Actions - Quotations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getQuotationsList', () => {
    it('should retrieve quotations list with left joins', async () => {
      const mockResult = [{ id: 'q-1', quoteNumber: 'QT-1', customerName: 'John', dbCustomerName: null }];
      const mockOrderBy = vi.fn().mockResolvedValue(mockResult);
      const mockLeftJoin3 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockLeftJoin2 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin3 });
      const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getQuotationsList();
      expect(res[0].quoteNumber).toBe('QT-1');
    });

    it('should return empty list on quotations fetch database error', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Database select error');
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getQuotationsList();
      expect(res).toEqual([]);
    });
  });

  describe('createQuotation', () => {
    it('should insert quotation and its items in transaction successfully', async () => {
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'profile-1', fullName: 'Staff' }])
            })
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'q-new', quoteNumber: 'QT-1' }])
            })
          })
        };
        return cb(mockTx);
      });

      const res = await createQuotation({
        discountAmount: '100000',
        items: [
          { productId: 'prod-1', quotedPrice: '5000000' }
        ]
      });

      expect(res.success).toBe(true);
      expect((res as any).quotation.id).toBe('q-new');
    });

    it('should return error when quotation insertion transaction fails', async () => {
      (db.transaction as any).mockImplementation(async () => {
        throw new Error('Transaction failed');
      });

      const res = await createQuotation({
        discountAmount: '100000',
        items: []
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('Transaction failed');
    });
  });

  describe('getQuotationByToken', () => {
    it('should retrieve quotation details by share token', async () => {
      const mockQuote = { id: 'q-1', quoteNumber: 'QT-1', customerId: null, customerName: 'Anna' };
      
      const mockLimitQuote = vi.fn().mockResolvedValue([mockQuote]);
      const mockWhereQuote = vi.fn().mockReturnValue({ limit: mockLimitQuote });
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhereQuote });
      const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFromQuote = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
      
      const mockItems = [{ id: 'qi-1', productId: 'p-1', quotedPrice: '5000' }];
      const mockWhereItems = vi.fn().mockResolvedValue(mockItems);
      const mockLeftJoinItems = vi.fn().mockReturnValue({ where: mockWhereItems });
      const mockInnerJoinItems = vi.fn().mockReturnValue({ leftJoin: mockLeftJoinItems });
      const mockFromItems = vi.fn().mockReturnValue({ innerJoin: mockInnerJoinItems });

      const mockLimitStore = vi.fn().mockResolvedValue([{ storeName: 'Store A' }]);
      const mockFromStore = vi.fn().mockReturnValue({ limit: mockLimitStore });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFromQuote }) // quotation fetch
        .mockReturnValueOnce({ from: mockFromItems }) // items fetch
        .mockReturnValueOnce({ from: mockFromStore }); // storeSettings fetch

      const res = await getQuotationByToken('some-token');
      expect(res.success).toBe(true);
      expect((res as any).quotation.quoteNumber).toBe('QT-1');
      expect(res.items).toEqual(mockItems);
    });

    it('should return error response if share token is empty', async () => {
      const res = await getQuotationByToken('   ');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Mã token không hợp lệ');
    });

    it('should return error response when quotation query returns empty array', async () => {
      const mockLimitQuote = vi.fn().mockResolvedValue([]);
      const mockWhereQuote = vi.fn().mockReturnValue({ limit: mockLimitQuote });
      const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhereQuote });
      const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
      const mockFromQuote = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin1 });
      (db.select as any).mockReturnValue({ from: mockFromQuote });

      const res = await getQuotationByToken('not-found-token');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy báo giá');
    });

    it('should return error response on database failure during token lookup', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Database timeout');
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getQuotationByToken('some-token');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Lỗi tải dữ liệu báo giá');
    });
  });

  describe('incrementQuotationViewCount & updateQuotationStatus', () => {
    it('should increment view count', async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ id: 'q-1', viewCount: 5, status: 'draft' }]);
      const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const mockWhereUpdate = vi.fn().mockResolvedValue(true);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await incrementQuotationViewCount('q-1');
      expect(res.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it('should return success false if quotation does not exist for view increment', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await incrementQuotationViewCount('missing-q');
      expect(res.success).toBe(false);
    });

    it('should return success false on database failure for view increment', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Database update error');
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await incrementQuotationViewCount('q-1');
      expect(res.success).toBe(false);
    });

    it('should update quotation status successfully', async () => {
      const mockWhere = vi.fn().mockResolvedValue(true);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateQuotationStatus('q-1', 'accepted');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Duyệt');
    });

    it('should return error response on database failure for status update', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Update failed'))
      });
      (db.update as any).mockReturnValue({ set: mockSet });

      const res = await updateQuotationStatus('q-1', 'accepted');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể ghi nhận phản hồi');
    });
  });

  describe('convertQuotationToOrder', () => {
    it('should convert quotation to order successfully in transaction', async () => {
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const mockChain = (resolved: any) => {
          const obj: any = {
            where: vi.fn().mockImplementation(() => obj),
            limit: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
            then: vi.fn().mockImplementation((cbFn: any) => Promise.resolve(resolved).then(cbFn)),
          };
          return obj;
        };

        const mockTx = {
          select: vi.fn().mockImplementation(() => {
            return {
              from: vi.fn().mockImplementation((table) => {
                if (table === quotations) {
                  return mockChain([{ id: 'q-1', subtotal: '1000', discountAmount: '0', totalAmount: '1000', customerId: 'cust-1' }]);
                }
                if (table === quotationItems) {
                  return mockChain([{ id: 'qi-1', productId: 'p-1', inventoryItemId: 'inv-item-1', quotedPrice: '1000' }]);
                }
                if (table === profiles) {
                  return mockChain([{ id: 'profile-1' }]);
                }
                if (table === inventoryItems) {
                  return mockChain([{ id: 'inv-item-1', costPrice: '500', serialNumber: 'SN123', status: 'in_stock' }]);
                }
                if (table === customers) {
                  return mockChain([{ id: 'cust-1' }]);
                }
                return mockChain([]);
              })
            };
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'order-1', orderNumber: 'ORD-1' }]),
              then: function(resolve: any) { resolve(true); }
            })
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(true)
            })
          })
        };

        return cb(mockTx);
      });

      const res = await convertQuotationToOrder('q-1', {
        initialPaymentAmount: '1000',
        paymentMethod: 'cash'
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('thành công');
    });

    it('should convert successfully when quotation item only specifies productId (model lookup)', async () => {
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const mockChain = (resolved: any) => {
          const obj: any = {
            where: vi.fn().mockImplementation(() => obj),
            limit: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
            then: vi.fn().mockImplementation((cbFn: any) => Promise.resolve(resolved).then(cbFn)),
          };
          return obj;
        };

        const mockTx = {
          select: vi.fn().mockImplementation(() => {
            return {
              from: vi.fn().mockImplementation((table) => {
                if (table === quotations) {
                  return mockChain([{ id: 'q-1', subtotal: '1000', discountAmount: '0', totalAmount: '1000', customerId: 'cust-1' }]);
                }
                if (table === quotationItems) {
                  return mockChain([{ id: 'qi-1', productId: 'p-1', inventoryItemId: null, quotedPrice: '1000' }]);
                }
                if (table === profiles) {
                  return mockChain([{ id: 'profile-1' }]);
                }
                if (table === inventoryItems) {
                  return mockChain([{ id: 'inv-item-from-model', costPrice: '500', serialNumber: 'SN-MODEL-123', status: 'in_stock' }]);
                }
                if (table === customers) {
                  return mockChain([{ id: 'cust-1' }]);
                }
                return mockChain([]);
              })
            };
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'order-1', orderNumber: 'ORD-1' }]),
              then: function(resolve: any) { resolve(true); }
            })
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(true)
            })
          })
        };

        return cb(mockTx);
      });

      const res = await convertQuotationToOrder('q-1', {
        initialPaymentAmount: '1000',
        paymentMethod: 'cash'
      });

      expect(res.success).toBe(true);
    });

    it('should throw error when quotation item specifies model but it is out of stock', async () => {
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const mockChain = (resolved: any) => {
          const obj: any = {
            where: vi.fn().mockImplementation(() => obj),
            limit: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
            then: vi.fn().mockImplementation((cbFn: any) => Promise.resolve(resolved).then(cbFn)),
          };
          return obj;
        };

        const mockTx = {
          select: vi.fn().mockImplementation(() => {
            return {
              from: vi.fn().mockImplementation((table) => {
                if (table === quotations) {
                  return mockChain([{ id: 'q-1', subtotal: '1000', discountAmount: '0', totalAmount: '1000', customerId: 'cust-1' }]);
                }
                if (table === quotationItems) {
                  return mockChain([{ id: 'qi-1', productId: 'p-1', inventoryItemId: null, quotedPrice: '1000' }]);
                }
                if (table === profiles) {
                  return mockChain([{ id: 'profile-1' }]);
                }
                // When selecting inventoryItems by model, return empty [] (out of stock)
                // When selecting products to print name, return a valid product details
                return mockChain([]);
              })
            };
          }),
        };

        return cb(mockTx);
      });

      const res = await convertQuotationToOrder('q-1', {
        initialPaymentAmount: '1000',
        paymentMethod: 'cash'
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('hết sạch hàng sẵn trong kho');
    });

    it('should throw error when quotation specifies a serial but that item is not in stock', async () => {
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const mockChain = (resolved: any) => {
          const obj: any = {
            where: vi.fn().mockImplementation(() => obj),
            limit: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
            then: vi.fn().mockImplementation((cbFn: any) => Promise.resolve(resolved).then(cbFn)),
          };
          return obj;
        };

        const mockTx = {
          select: vi.fn().mockImplementation(() => {
            return {
              from: vi.fn().mockImplementation((table) => {
                if (table === quotations) {
                  return mockChain([{ id: 'q-1', subtotal: '1000', discountAmount: '0', totalAmount: '1000', customerId: 'cust-1' }]);
                }
                if (table === quotationItems) {
                  return mockChain([{ id: 'qi-1', productId: 'p-1', inventoryItemId: 'inv-item-1', quotedPrice: '1000' }]);
                }
                if (table === profiles) {
                  return mockChain([{ id: 'profile-1' }]);
                }
                if (table === inventoryItems) {
                  // First lookup on inventoryItemId in_stock returns empty []
                  // Second lookup on inventoryItemId (to get serialNumber for message) returns details
                  const callCount = mockTx.select.mock.calls.length;
                  if (callCount === 4) {
                    return mockChain([]); // Not in stock
                  }
                  return mockChain([{ id: 'inv-item-1', serialNumber: 'SN-OUT-OF-STOCK' }]);
                }
                return mockChain([]);
              })
            };
          }),
        };

        return cb(mockTx);
      });

      const res = await convertQuotationToOrder('q-1', {
        initialPaymentAmount: '1000',
        paymentMethod: 'cash'
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('đã không còn trong kho');
    });

    it('should create a new customer if quotation has no customerId during conversion', async () => {
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const mockChain = (resolved: any) => {
          const obj: any = {
            where: vi.fn().mockImplementation(() => obj),
            limit: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
            then: vi.fn().mockImplementation((cbFn: any) => Promise.resolve(resolved).then(cbFn)),
          };
          return obj;
        };

        const mockTx = {
          select: vi.fn().mockImplementation(() => {
            return {
              from: vi.fn().mockImplementation((table) => {
                if (table === quotations) {
                  return mockChain([{ id: 'q-1', subtotal: '1000', discountAmount: '0', totalAmount: '1000', customerId: null, customerName: 'New Guest' }]);
                }
                if (table === quotationItems) {
                  return mockChain([{ id: 'qi-1', productId: 'p-1', inventoryItemId: 'inv-item-1', quotedPrice: '1000' }]);
                }
                if (table === profiles) {
                  return mockChain([{ id: 'profile-1' }]);
                }
                if (table === inventoryItems) {
                  return mockChain([{ id: 'inv-item-1', costPrice: '500', serialNumber: 'SN123', status: 'in_stock' }]);
                }
                return mockChain([]);
              })
            };
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'cust-inserted' }]),
              then: function(resolve: any) { resolve(true); }
            })
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(true)
            })
          })
        };

        return cb(mockTx);
      });

      const res = await convertQuotationToOrder('q-1', {
        initialPaymentAmount: '1000',
        paymentMethod: 'cash'
      });

      expect(res.success).toBe(true);
    });

    it('should return error response when transaction throws exception', async () => {
      (db.transaction as any).mockImplementation(async () => {
        throw new Error('Converting failed due to out of stock');
      });

      const res = await convertQuotationToOrder('q-1', {
        initialPaymentAmount: '1000',
        paymentMethod: 'cash'
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('Converting failed');
    });
  });
});
