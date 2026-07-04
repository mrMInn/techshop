import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { sendTelegramNotification } from '@/lib/telegram/notifier';
import {
  syncHistoricalAccountingDataAction,
  getFinancialSummary,
  getCashBookEntries,
  getExpenses,
  getExpenseById,
  getExpenseCategories,
  createExpense,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  getIncomeCategories,
  createIncomeCategory,
  updateIncomeCategory,
  deleteIncomeCategory,
  getWarrantyClaimsForSelect,
  updateExpenseAction,
  deleteExpenseAction,
  getDashboardBentoData,
  createManualIncome,
  updateManualIncome,
  deleteManualIncome,
} from '@/app/actions/accounting';

vi.mock('next/server', () => ({
  after: vi.fn((cb) => cb()),
}));

vi.mock('@/lib/telegram/notifier', () => ({
  sendTelegramNotification: vi.fn().mockResolvedValue(true),
}));

const { mockDb } = vi.hoisted(() => {
  const mockDbObj: any = {
    select: vi.fn().mockImplementation(() => mockDbObj),
    from: vi.fn().mockImplementation(() => mockDbObj),
    insert: vi.fn().mockImplementation(() => mockDbObj),
    values: vi.fn().mockImplementation(() => mockDbObj),
    update: vi.fn().mockImplementation(() => mockDbObj),
    set: vi.fn().mockImplementation(() => mockDbObj),
    delete: vi.fn().mockImplementation(() => mockDbObj),
    innerJoin: vi.fn().mockImplementation(() => mockDbObj),
    leftJoin: vi.fn().mockImplementation(() => mockDbObj),
    where: vi.fn().mockImplementation(() => mockDbObj),
    orderBy: vi.fn().mockImplementation(() => mockDbObj),
    groupBy: vi.fn().mockImplementation(() => mockDbObj),
    offset: vi.fn().mockImplementation(() => mockDbObj),
    limit: vi.fn().mockImplementation(() => mockDbObj),
    returning: vi.fn().mockImplementation(() => Promise.resolve([])),
    then: vi.fn().mockImplementation((cb: any) => Promise.resolve([]).then(cb)),
  };
  return { mockDb: mockDbObj };
});

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((cb) => cb(mockDb)),
    select: vi.fn().mockReturnValue(mockDb),
    insert: vi.fn().mockReturnValue(mockDb),
    update: vi.fn().mockReturnValue(mockDb),
    delete: vi.fn().mockReturnValue(mockDb),
    execute: vi.fn().mockResolvedValue(true),
  },
  recalculateRunningBalances: vi.fn().mockResolvedValue(true),
}));

const createTxMock = (selectResponses: any[], insertResponses: any[] = [], updateResponses: any[] = []) => {
  let selectCount = 0;
  let insertCount = 0;
  let updateCount = 0;

  const chainObj: any = {
    from: vi.fn().mockImplementation(() => chainObj),
    innerJoin: vi.fn().mockImplementation(() => chainObj),
    leftJoin: vi.fn().mockImplementation(() => chainObj),
    where: vi.fn().mockImplementation(() => chainObj),
    orderBy: vi.fn().mockImplementation(() => chainObj),
    groupBy: vi.fn().mockImplementation(() => chainObj),
    limit: vi.fn().mockImplementation(() => Promise.resolve(chainObj.currentVal)),
    returning: vi.fn().mockImplementation(() => Promise.resolve(chainObj.currentVal)),
    set: vi.fn().mockImplementation(() => chainObj),
    values: vi.fn().mockImplementation(() => chainObj),
    then: vi.fn().mockImplementation((cb: any) => Promise.resolve(chainObj.currentVal).then(cb)),
  };

  const tx: any = {
    select: vi.fn().mockImplementation(() => {
      const val = selectResponses[selectCount] || [];
      selectCount++;
      chainObj.currentVal = val;
      return chainObj;
    }),
    insert: vi.fn().mockImplementation(() => {
      const val = insertResponses[insertCount] || [];
      insertCount++;
      chainObj.currentVal = val;
      return chainObj;
    }),
    update: vi.fn().mockImplementation(() => {
      const val = updateResponses[updateCount] || [];
      updateCount++;
      chainObj.currentVal = val;
      return chainObj;
    }),
    delete: vi.fn().mockImplementation(() => {
      chainObj.currentVal = [];
      return chainObj;
    }),
  };
  return tx;
};

describe('Accounting Server Actions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset completely all mock states to clear any implementation queues (like mockRejectedValueOnce)
    vi.mocked(db.transaction).mockReset();
    vi.mocked(db.select).mockReset();
    vi.mocked(db.insert).mockReset();
    vi.mocked(db.update).mockReset();
    vi.mocked(db.delete).mockReset();

    mockDb.select.mockReset();
    mockDb.from.mockReset();
    mockDb.insert.mockReset();
    mockDb.values.mockReset();
    mockDb.update.mockReset();
    mockDb.set.mockReset();
    mockDb.delete.mockReset();
    mockDb.innerJoin.mockReset();
    mockDb.leftJoin.mockReset();
    mockDb.where.mockReset();
    mockDb.orderBy.mockReset();
    mockDb.groupBy.mockReset();
    mockDb.offset.mockReset();
    mockDb.limit.mockReset();
    mockDb.returning.mockReset();
    mockDb.then.mockReset();

    // Re-assign default mock implementations
    vi.mocked(db.transaction).mockImplementation((cb) => cb(mockDb));
    vi.mocked(db.select).mockReturnValue(mockDb);
    vi.mocked(db.insert).mockReturnValue(mockDb);
    vi.mocked(db.update).mockReturnValue(mockDb);
    vi.mocked(db.delete).mockReturnValue(mockDb);

    mockDb.select.mockImplementation(() => mockDb);
    mockDb.from.mockImplementation(() => mockDb);
    mockDb.insert.mockImplementation(() => mockDb);
    mockDb.values.mockImplementation(() => mockDb);
    mockDb.update.mockImplementation(() => mockDb);
    mockDb.set.mockImplementation(() => mockDb);
    mockDb.delete.mockImplementation(() => mockDb);
    mockDb.innerJoin.mockImplementation(() => mockDb);
    mockDb.leftJoin.mockImplementation(() => mockDb);
    mockDb.where.mockImplementation(() => mockDb);
    mockDb.orderBy.mockImplementation(() => mockDb);
    mockDb.groupBy.mockImplementation(() => mockDb);
    mockDb.offset.mockImplementation(() => mockDb);
    mockDb.limit.mockImplementation(() => mockDb);
    mockDb.returning.mockImplementation(() => Promise.resolve([]));
    mockDb.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));
  });

  describe('syncHistoricalAccountingDataAction', () => {
    it('thành công đồng bộ dữ liệu lịch sử tài chính', async () => {
      let selectCount = 0;
      mockDb.then.mockImplementation((onfulfilled) => {
        selectCount++;
        if (selectCount === 1) {
          // dbPayments
          return Promise.resolve([
            { id: 'pay-1', orderId: 'ord-1', amount: '1000000', paymentMethod: 'bank_transfer', paymentDate: '2026-06-01', notes: 'thanh toan', createdBy: 'u-1', orderNumber: 'ORD-01' },
            { id: 'pay-2', orderId: 'ord-2', amount: '2000000', paymentMethod: 'cash', paymentDate: '2026-06-02', notes: null, createdBy: 'u-1', orderNumber: 'ORD-02' }
          ]).then(onfulfilled);
        }
        if (selectCount === 2) {
          // existingOrderEntries
          return Promise.resolve([]).then(onfulfilled);
        }
        if (selectCount === 3) {
          // dbClaims
          return Promise.resolve([
            { id: 'claim-1', repairCost: '500000', receivedDate: '2026-06-01', claimNumber: 'CLM-01', createdBy: 'u-1', actualReturnDate: '2026-06-03' }
          ]).then(onfulfilled);
        }
        if (selectCount === 4) {
          // existingOtherEntries
          return Promise.resolve([]).then(onfulfilled);
        }
        if (selectCount === 5) {
          // dbReturns
          return Promise.resolve([
            { id: 'ret-1', status: 'completed', refundAmount: '15000000', feeAmount: '500000', hasFee: true, orderId: 'ord-1', createdAt: '2026-06-01', processedBy: 'u-1', returnNumber: 'RET-01' }
          ]).then(onfulfilled);
        }
        if (selectCount === 6) {
          // dbOrders
          return Promise.resolve([
            { id: 'ord-1', paymentMethod: 'bank_transfer' }
          ]).then(onfulfilled);
        }
        return Promise.resolve([]).then(onfulfilled);
      });

      const res = await syncHistoricalAccountingDataAction();
      expect(res.success).toBe(true);
    });
  });

  describe('getFinancialSummary', () => {
    it('thành công lấy tóm tắt tài chính', async () => {
      let selectCount = 0;
      mockDb.then.mockImplementation((onfulfilled) => {
        selectCount++;
        if (selectCount === 1) {
          // totals
          return Promise.resolve([
            { type: 'income', sum: '10000000' },
            { type: 'expense', sum: '2000000' }
          ]).then(onfulfilled);
        }
        if (selectCount === 2) {
          // catStats
          return Promise.resolve([
            { category: 'sales', type: 'income', sum: '10000000' },
            { category: 'salary', type: 'expense', sum: '2000000' }
          ]).then(onfulfilled);
        }
        if (selectCount === 3) {
          // ordersStats
          return Promise.resolve([{ totalProfit: '5000000' }]).then(onfulfilled);
        }
        if (selectCount === 4) {
          // warrantyStats
          return Promise.resolve([{ totalWarrantyCost: '1000000' }]).then(onfulfilled);
        }
        if (selectCount === 5) {
          // expensesStats
          return Promise.resolve([{ totalExpense: '2000000' }]).then(onfulfilled);
        }
        if (selectCount === 6) {
          // returnsStats
          return Promise.resolve([{ totalRefund: '1500000', totalFee: '200000' }]).then(onfulfilled);
        }
        if (selectCount === 7) {
          // daysData
          return Promise.resolve([
            { date: '2026-06-01', type: 'income', totalAmount: '10000000' },
            { date: '2026-06-02', type: 'expense', totalAmount: '2000000' }
          ]).then(onfulfilled);
        }
        if (selectCount === 8) {
          // monthlyData
          return Promise.resolve([
            { month: '2026-06', type: 'income', sum: '10000000' },
            { month: '2026-06', type: 'expense', sum: '2000000' }
          ]).then(onfulfilled);
        }
        return Promise.resolve([]).then(onfulfilled);
      });

      const res = await getFinancialSummary();
      expect(res.totalIncome).toBe(10000000);
      expect(res.totalExpense).toBe(2000000);
      expect(res.netProfit).toBe(2700000); // 5m + 1m + 0.2m - 2m - 1.5m = 2.7m
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Summary error')));
      const res = await getFinancialSummary();
      expect(res.totalIncome).toBe(0);
    });
  });

  describe('getCashBookEntries', () => {
    it('thành công không có filter', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'cb-1' }]));
      const res = await getCashBookEntries();
      expect(res.length).toBe(1);
    });

    it('thành công có filter đầy đủ', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'cb-1' }]));
      const res = await getCashBookEntries({
        type: 'income',
        category: 'sales',
        search: 'CB01',
        startDate: '2026-06-01',
        endDate: '2026-06-30'
      });
      expect(res.length).toBe(1);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('CashBook error')));
      const res = await getCashBookEntries();
      expect(res).toEqual([]);
    });
  });

  describe('getExpenses', () => {
    it('thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'exp-1' }]));
      const res = await getExpenses();
      expect(res.length).toBe(1);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Expenses error')));
      const res = await getExpenses();
      expect(res).toEqual([]);
    });
  });

  describe('getExpenseById', () => {
    it('thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'exp-1' }]));
      const res = await getExpenseById('exp-1');
      expect(res?.id).toBe('exp-1');
    });

    it('không tìm thấy', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([]));
      const res = await getExpenseById('exp-1');
      expect(res).toBeNull();
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Expense by id error')));
      const res = await getExpenseById('exp-1');
      expect(res).toBeNull();
    });
  });

  describe('getExpenseCategories', () => {
    it('thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'cat-1' }]));
      const res = await getExpenseCategories();
      expect(res.length).toBe(1);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('ExpenseCategories error')));
      const res = await getExpenseCategories();
      expect(res).toEqual([]);
    });
  });

  describe('createExpense', () => {
    it('lỗi chốt sổ kỳ kế toán', async () => {
      const txMock = createTxMock([
        [{ id: 'period-1', isClosed: true }] // closedPeriod
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createExpense({
        categoryId: 'cat-1',
        amount: '100000',
        description: 'test',
        expenseDate: '2026-06-01',
        paymentMethod: 'cash'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã chốt sổ');
    });

    it('lỗi chưa cấu hình tài khoản nhân viên', async () => {
      const txMock = createTxMock([
        [], // closedPeriod empty
        [] // ownerProfiles empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createExpense({
        categoryId: 'cat-1',
        amount: '100000',
        description: 'test',
        expenseDate: '2026-06-01',
        paymentMethod: 'cash'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Chưa cấu hình tài khoản nhân viên');
    });

    it('lỗi danh mục chi phí không hợp lệ', async () => {
      const txMock = createTxMock([
        [], // closedPeriod empty
        [{ id: 'profile-1' }], // ownerProfiles
        [] // category empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createExpense({
        categoryId: 'cat-1',
        amount: '100000',
        description: 'test',
        expenseDate: '2026-06-01',
        paymentMethod: 'cash'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Danh mục chi phí không hợp lệ');
    });

    it('thành công các loại danh mục khác nhau và định dạng ngày khác nhau', async () => {
      const dateFormats = [
        undefined,
        new Date('2026-06-15'),
        '15/06/2026',
        '15-06-2026',
        '15062026',
        'June 15, 2026',
        'invalid-date-format' // Triggers final cleanStr return branch
      ];

      const categories = [
        'Lương nhân viên',
        'Mặt bằng cửa hàng',
        'Tiền điện nước',
        'Phí vận chuyển',
        'Thuế doanh nghiệp',
        'Chi phí khác',
        'Chi phí khác'
      ];

      for (let i = 0; i < dateFormats.length; i++) {
        const txMock = createTxMock(
          [
            [], // closedPeriod
            [{ id: 'profile-1' }], // ownerProfiles
            [{ id: 'cat-1', name: categories[i] }] // category
          ],
          [
            [{ id: 'exp-1' }], // newExpense insert
            [] // cashBookEntries insert
          ]
        );
        vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

        const res = await createExpense({
          categoryId: 'cat-1',
          amount: '100000',
          description: 'test description',
          expenseDate: dateFormats[i] as any,
          paymentMethod: 'bank_transfer'
        });
        expect(res.success).toBe(true);
      }
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Tx error'));
      const res = await createExpense({
        categoryId: 'cat-1',
        amount: '100000',
        description: 'test',
        expenseDate: '2026-06-01',
        paymentMethod: 'cash'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('createExpenseCategory', () => {
    it('thành công', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'cat-1' }]);
      const res = await createExpenseCategory({
        name: 'cat-new',
        type: 'fixed',
        description: 'desc'
      });
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.insert).mockImplementationOnce(() => { throw new Error('Create error'); });
      const res = await createExpenseCategory({
        name: 'cat-new',
        type: 'fixed'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('updateExpenseCategory', () => {
    it('thành công', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'cat-1' }]);
      const res = await updateExpenseCategory('cat-1', {
        name: 'cat-updated',
        type: 'variable'
      });
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.update).mockImplementationOnce(() => { throw new Error('Update error'); });
      const res = await updateExpenseCategory('cat-1', {
        name: 'cat-updated',
        type: 'variable'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('deleteExpenseCategory', () => {
    it('lỗi danh mục đang được sử dụng', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'exp-1' }])); // countUse
      const res = await deleteExpenseCategory('cat-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã có các khoản chi phí phát sinh');
    });

    it('thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([])); // countUse empty
      mockDb.then.mockImplementationOnce((resolve) => resolve([])); // delete
      const res = await deleteExpenseCategory('cat-1');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Delete error')));
      const res = await deleteExpenseCategory('cat-1');
      expect(res.success).toBe(false);
    });
  });

  describe('getIncomeCategories', () => {
    it('thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'cat-1' }]));
      const res = await getIncomeCategories();
      expect(res.length).toBe(1);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('IncomeCategories error')));
      const res = await getIncomeCategories();
      expect(res).toEqual([]);
    });
  });

  describe('createIncomeCategory', () => {
    it('thành công', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'cat-1' }]);
      const res = await createIncomeCategory({
        name: 'cat-new',
        description: 'desc'
      });
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.insert).mockImplementationOnce(() => { throw new Error('Create error'); });
      const res = await createIncomeCategory({
        name: 'cat-new'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('updateIncomeCategory', () => {
    it('thành công', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'cat-1' }]);
      const res = await updateIncomeCategory('cat-1', {
        name: 'cat-updated'
      });
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.update).mockImplementationOnce(() => { throw new Error('Update error'); });
      const res = await updateIncomeCategory('cat-1', {
        name: 'cat-updated'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('deleteIncomeCategory', () => {
    it('lỗi danh mục đang được sử dụng', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'cb-1' }])); // countUse
      const res = await deleteIncomeCategory('cat-1');
      expect(res.success).toBe(false);
    });

    it('thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([])); // countUse empty
      mockDb.then.mockImplementationOnce((resolve) => resolve([])); // delete
      const res = await deleteIncomeCategory('cat-1');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Delete error')));
      const res = await deleteIncomeCategory('cat-1');
      expect(res.success).toBe(false);
    });
  });

  describe('getWarrantyClaimsForSelect', () => {
    it('thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'claim-1' }]));
      const res = await getWarrantyClaimsForSelect();
      expect(res.length).toBe(1);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Warranty select error')));
      const res = await getWarrantyClaimsForSelect();
      expect(res).toEqual([]);
    });
  });

  describe('updateExpenseAction', () => {
    it('lỗi chốt sổ kỳ kế toán mới', async () => {
      const txMock = createTxMock([
        [{ id: 'period-1', isClosed: true }] // closedPeriodNew
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateExpenseAction({
        id: 'exp-1',
        categoryId: 'cat-1',
        amount: '150000',
        description: 'updated',
        expenseDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
    });

    it('lỗi không tìm thấy khoản chi phí', async () => {
      const txMock = createTxMock([
        [], // closedPeriodNew empty
        [] // existing empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateExpenseAction({
        id: 'exp-1',
        categoryId: 'cat-1',
        amount: '150000',
        description: 'updated',
        expenseDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy khoản chi phí');
    });

    it('lỗi danh mục chi phí không hợp lệ', async () => {
      const txMock = createTxMock([
        [], // closedPeriodNew empty
        [{ id: 'exp-1' }], // existing
        [] // category empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateExpenseAction({
        id: 'exp-1',
        categoryId: 'cat-1',
        amount: '150000',
        description: 'updated',
        expenseDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Danh mục chi phí không hợp lệ');
    });

    it('thành công với các loại danh mục chi phí khác nhau', async () => {
      const categoryNames = ['lương', 'mặt bằng', 'điện nước', 'vận chuyển', 'thuế', 'khác'];
      for (const name of categoryNames) {
        const txMock = createTxMock(
          [
            [], // closedPeriodNew
            [{ id: 'exp-1', expenseNumber: 'EXP-1' }], // existing
            [{ id: 'cat-1', name }] // category
          ],
          [],
          [
            [], // expenses update
            [] // cashBookEntries update
          ]
        );
        vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

        const res = await updateExpenseAction({
          id: 'exp-1',
          categoryId: 'cat-1',
          amount: '150000',
          description: 'updated',
          expenseDate: '2026-06-01',
          paymentMethod: 'card'
        });
        expect(res.success).toBe(true);
      }
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Update failed'));
      const res = await updateExpenseAction({
        id: 'exp-1',
        categoryId: 'cat-1',
        amount: '150000',
        description: 'updated',
        expenseDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('deleteExpenseAction', () => {
    it('lỗi không tìm thấy khoản chi phí', async () => {
      const txMock = createTxMock([
        [] // existing empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await deleteExpenseAction('exp-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy khoản chi phí');
    });

    it('lỗi chốt sổ kỳ kế toán', async () => {
      const txMock = createTxMock([
        [{ id: 'exp-1', expenseDate: '2026-06-01' }], // existing
        [{ id: 'period-1', isClosed: true }] // closedPeriod
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await deleteExpenseAction('exp-1');
      expect(res.success).toBe(false);
    });

    it('thành công', async () => {
      const txMock = createTxMock([
        [{ id: 'exp-1', expenseDate: '2026-06-01' }], // existing
        [] // closedPeriod empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await deleteExpenseAction('exp-1');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Delete failed'));
      const res = await deleteExpenseAction('exp-1');
      expect(res.success).toBe(false);
    });
  });

  describe('getDashboardBentoData', () => {
    it('thành công', async () => {
      let selectCount = 0;
      mockDb.then.mockImplementation((onfulfilled) => {
        selectCount++;
        if (selectCount === 1) return Promise.resolve([{ count: 2 }]).then(onfulfilled); // todayOrdersCount
        if (selectCount === 2) return Promise.resolve([{ count: 10 }]).then(onfulfilled); // monthOrdersCount
        if (selectCount === 3) return Promise.resolve([{ count: 5 }]).then(onfulfilled); // activeQuotes
        if (selectCount === 4) return Promise.resolve([{ status: 'in_stock', count: 100 }, { status: 'incoming', count: 20 }, { status: 'defective', count: 5 }]).then(onfulfilled); // inventoryStatusStats
        if (selectCount === 5) return Promise.resolve([{ status: 'pending', count: 3 }, { status: 'completed', count: 15 }]).then(onfulfilled); // warrantyStatusStats
        if (selectCount === 6) return Promise.resolve([{ revenue: '150000000', cogs: '100000000' }]).then(onfulfilled); // monthSales
        if (selectCount === 7) return Promise.resolve([{ total: '20000000' }]).then(onfulfilled); // monthExpenses
        if (selectCount === 8) return Promise.resolve([{ refund: '10000000', fee: '1000000' }]).then(onfulfilled); // monthReturns
        if (selectCount === 9) return Promise.resolve([{ total: '5000000' }]).then(onfulfilled); // monthWarrantyIncome
        if (selectCount === 10) return Promise.resolve([{ revenue: '15000000', cogs: '10000000' }]).then(onfulfilled); // todaySales
        if (selectCount === 11) return Promise.resolve([{ total: '2000000' }]).then(onfulfilled); // todayExpenses
        if (selectCount === 12) return Promise.resolve([{ refund: '1000000', fee: '100000' }]).then(onfulfilled); // todayReturns
        if (selectCount === 13) return Promise.resolve([{ id: 'ord-1', orderNumber: 'ORD-1', customerName: 'A', totalAmount: '5000000', status: 'completed' }]).then(onfulfilled); // recentOrdersList
        if (selectCount === 14) return Promise.resolve([{ count: 2 }]).then(onfulfilled); // monthReturnCount
        return Promise.resolve([]).then(onfulfilled);
      });

      const res = await getDashboardBentoData('2026-06');
      expect(res.success).toBe(true);
      expect(res.todayCount).toBe(2);
      expect(res.thisMonthNetProfit).toBe(26000000);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Dashboard error')));
      await expect(getDashboardBentoData('2026-06')).rejects.toThrow('Dashboard error');
    });
  });

  describe('createManualIncome', () => {
    it('lỗi chốt sổ kỳ kế toán', async () => {
      const txMock = createTxMock([
        [{ id: 'period-1', isClosed: true }] // closedPeriod
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createManualIncome({
        amount: '100000',
        incomeCategoryId: 'cat-1',
        description: 'test',
        entryDate: '2026-06-01',
        paymentMethod: 'cash'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã chốt sổ');
    });

    it('lỗi chưa cấu hình tài khoản nhân viên', async () => {
      const txMock = createTxMock([
        [], // closedPeriod empty
        [] // ownerProfiles empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createManualIncome({
        amount: '100000',
        incomeCategoryId: 'cat-1',
        description: 'test',
        entryDate: '2026-06-01',
        paymentMethod: 'cash'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Chưa cấu hình tài khoản nhân viên');
    });

    it('lỗi danh mục thu nhập không hợp lệ', async () => {
      const txMock = createTxMock([
        [], // closedPeriod empty
        [{ id: 'profile-1' }], // ownerProfiles
        [] // category empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createManualIncome({
        amount: '100000',
        incomeCategoryId: 'cat-1',
        description: 'test',
        entryDate: '2026-06-01',
        paymentMethod: 'cash'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Danh mục thu nhập không hợp lệ');
    });

    it('thành công các loại danh mục khác nhau', async () => {
      const categories = [
        'Doanh thu bán lẻ',
        'Phí dịch vụ bảo hành',
        'Thu nhập khác'
      ];

      for (let i = 0; i < categories.length; i++) {
        const txMock = createTxMock(
          [
            [], // closedPeriod
            [{ id: 'profile-1' }], // ownerProfiles
            [{ id: 'cat-1', name: categories[i] }] // categoryObj
          ],
          [
            [{ id: 'cb-1' }] // cashBookEntries insert returning
          ]
        );
        vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

        const res = await createManualIncome({
          amount: '500000',
          incomeCategoryId: 'cat-1',
          description: 'test manual income',
          entryDate: '2026-06-01',
          paymentMethod: 'bank_transfer'
        });
        expect(res.success).toBe(true);
      }
    });

    it('thành công với Telegram send rejected', async () => {
      vi.mocked(sendTelegramNotification).mockRejectedValueOnce(new Error('Telegram send error'));

      const txMock = createTxMock(
        [
          [], // closedPeriod
          [{ id: 'profile-1' }], // ownerProfiles
          [{ id: 'cat-1', name: 'Thu nhập khác' }] // categoryObj
        ],
        [
          [{ id: 'cb-1' }] // cashBookEntries insert returning
        ]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createManualIncome({
        amount: '500000',
        incomeCategoryId: 'cat-1',
        description: 'test telegram reject',
        entryDate: '2026-06-01',
        paymentMethod: 'bank_transfer'
      });
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Tx error'));
      const res = await createManualIncome({
        amount: '100000',
        incomeCategoryId: 'cat-1',
        description: 'test',
        entryDate: '2026-06-01',
        paymentMethod: 'cash'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('updateManualIncome', () => {
    it('lỗi chốt sổ kỳ kế toán mới', async () => {
      const txMock = createTxMock([
        [{ id: 'period-1', isClosed: true }] // closedPeriodNew
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateManualIncome({
        id: 'cb-1',
        amount: '200000',
        incomeCategoryId: 'cat-1',
        description: 'updated',
        entryDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
    });

    it('lỗi không tìm thấy phiếu thu', async () => {
      const txMock = createTxMock([
        [], // closedPeriodNew empty
        [] // existing empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateManualIncome({
        id: 'cb-1',
        amount: '200000',
        incomeCategoryId: 'cat-1',
        description: 'updated',
        entryDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy phiếu thu cần cập nhật');
    });

    it('lỗi phiếu thu tự động', async () => {
      const txMock = createTxMock([
        [], // closedPeriodNew empty
        [{ id: 'cb-1', referenceType: 'order', type: 'income' }] // existing automatic
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateManualIncome({
        id: 'cb-1',
        amount: '200000',
        incomeCategoryId: 'cat-1',
        description: 'updated',
        entryDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể chỉnh sửa phiếu thu tự động từ hệ thống');
    });

    it('lỗi chốt sổ kỳ kế toán cũ', async () => {
      const txMock = createTxMock([
        [], // closedPeriodNew empty
        [{ id: 'cb-1', referenceType: null, type: 'income', entryDate: '2026-05-01' }], // existing manual
        [{ id: 'period-old', isClosed: true }] // closedPeriodOld
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateManualIncome({
        id: 'cb-1',
        amount: '200000',
        incomeCategoryId: 'cat-1',
        description: 'updated',
        entryDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
    });

    it('lỗi danh mục thu nhập không hợp lệ', async () => {
      const txMock = createTxMock([
        [], // closedPeriodNew empty
        [{ id: 'cb-1', referenceType: null, type: 'income', entryDate: '2026-05-01' }], // existing
        [], // closedPeriodOld empty
        [] // categoryObj empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateManualIncome({
        id: 'cb-1',
        amount: '200000',
        incomeCategoryId: 'cat-1',
        description: 'updated',
        entryDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Danh mục thu nhập không hợp lệ');
    });

    it('thành công với các danh mục khác nhau', async () => {
      const categoryNames = ['bán lẻ', 'bảo hành', 'khác'];
      for (const name of categoryNames) {
        const txMock = createTxMock(
          [
            [], // closedPeriodNew
            [{ id: 'cb-1', referenceType: null, type: 'income', entryDate: '2026-05-01' }], // existing
            [], // closedPeriodOld
            [{ id: 'cat-1', name }] // categoryObj
          ],
          [],
          [
            [] // cashBookEntries update
          ]
        );
        vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

        const res = await updateManualIncome({
          id: 'cb-1',
          amount: '200000',
          incomeCategoryId: 'cat-1',
          description: 'updated',
          entryDate: '2026-06-01',
          paymentMethod: 'card'
        });
        expect(res.success).toBe(true);
      }
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Update failed'));
      const res = await updateManualIncome({
        id: 'cb-1',
        amount: '200000',
        incomeCategoryId: 'cat-1',
        description: 'updated',
        entryDate: '2026-06-01',
        paymentMethod: 'card'
      });
      expect(res.success).toBe(false);
    });
  });

  describe('deleteManualIncome', () => {
    it('lỗi không tìm thấy phiếu thu', async () => {
      const txMock = createTxMock([
        [] // existing empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await deleteManualIncome('cb-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy phiếu thu cần xóa');
    });

    it('lỗi phiếu thu tự động', async () => {
      const txMock = createTxMock([
        [{ id: 'cb-1', referenceType: 'order', type: 'income' }] // existing automatic
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await deleteManualIncome('cb-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không thể xóa phiếu thu tự động từ hệ thống');
    });

    it('lỗi chốt sổ kỳ kế toán', async () => {
      const txMock = createTxMock([
        [{ id: 'cb-1', referenceType: null, type: 'income', entryDate: '2026-06-01' }], // existing
        [{ id: 'period-1', isClosed: true }] // closedPeriod
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await deleteManualIncome('cb-1');
      expect(res.success).toBe(false);
    });

    it('thành công', async () => {
      const txMock = createTxMock([
        [{ id: 'cb-1', referenceType: null, type: 'income', entryDate: '2026-06-01' }], // existing
        [] // closedPeriod empty
      ]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await deleteManualIncome('cb-1');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Delete failed'));
      const res = await deleteManualIncome('cb-1');
      expect(res.success).toBe(false);
    });
  });
});