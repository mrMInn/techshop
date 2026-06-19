import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getIncomeStatementReport, 
  getCashFlowStatementReport 
} from '@/app/actions/reports';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('Server Actions - Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getIncomeStatementReport', () => {
    it('should calculate P&L correctly based on mock database sums', async () => {
      const mockSalesStats = [{ revenue: '1000000', cogs: '600000' }];
      const mockWarrantyStats = [{ warrantyRevenue: '150000' }];
      const mockReturnsStats = [{ refunds: '50000' }];
      const mockExpenses = [{ categoryId: 'cat-1', categoryName: 'Fixed', total: '200000' }];

      const mockWhereSales = vi.fn().mockResolvedValue(mockSalesStats);
      const mockFromSales = vi.fn().mockReturnValue({ where: mockWhereSales });

      const mockWhereWarranty = vi.fn().mockResolvedValue(mockWarrantyStats);
      const mockFromWarranty = vi.fn().mockReturnValue({ where: mockWhereWarranty });

      const mockWhereReturns = vi.fn().mockResolvedValue(mockReturnsStats);
      const mockFromReturns = vi.fn().mockReturnValue({ where: mockWhereReturns });

      const mockGroupByExpenses = vi.fn().mockResolvedValue(mockExpenses);
      const mockWhereExpenses = vi.fn().mockReturnValue({ groupBy: mockGroupByExpenses });
      const mockInnerJoinExpenses = vi.fn().mockReturnValue({ where: mockWhereExpenses });
      const mockFromExpenses = vi.fn().mockReturnValue({ innerJoin: mockInnerJoinExpenses });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFromSales })
        .mockReturnValueOnce({ from: mockFromWarranty })
        .mockReturnValueOnce({ from: mockFromReturns })
        .mockReturnValueOnce({ from: mockFromExpenses });

      const res = await getIncomeStatementReport('2026-01-01', '2026-06-01');

      expect(res.salesRevenue).toBe(1000000);
      expect(res.costOfGoodsSold).toBe(600000);
      expect(res.salesGrossMargin).toBe(400000);
      expect(res.warrantyIncome).toBe(150000);
      expect(res.salesRefunds).toBe(50000);
      expect(res.netRevenue).toBe(1100000); // 1000000 + 150000 - 50000
      expect(res.totalOperatingExpenses).toBe(200000);
      expect(res.netProfit).toBe(300000); // 1100000 - 600000 - 200000
    });

    it('should return default empty statement on database error', async () => {
      (db.select as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const res = await getIncomeStatementReport('2026-01-01', '2026-06-01');
      expect(res.salesRevenue).toBe(0);
      expect(res.netProfit).toBe(0);
      expect(res.expenseBreakdown).toEqual([]);
    });
  });

  describe('getCashFlowStatementReport', () => {
    it('should calculate Cash Flow correctly separating operating and investing cashflows', async () => {
      const mockEntries = [
        { amount: '500000', type: 'income', category: 'sales', description: 'Bán lẻ' },
        { amount: '100000', type: 'expense', category: 'other', description: 'Mua thiết bị bàn làm việc' },
        { amount: '50000', type: 'expense', category: 'utilities', description: 'Tiền điện nước' }
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockEntries);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getCashFlowStatementReport('2026-01-01', '2026-06-01');

      expect(res.operatingInflow).toBe(500000);
      expect(res.operatingOutflow).toBe(50000);
      expect(res.investingOutflow).toBe(100000);
      expect(res.netOperatingCashFlow).toBe(450000);
      expect(res.netInvestingCashFlow).toBe(-100000);
      expect(res.netCashFlow).toBe(350000);
    });

    it('should return default cashflow statement on database error', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Query error');
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getCashFlowStatementReport('2026-01-01', '2026-06-01');
      expect(res.operatingInflow).toBe(0);
      expect(res.netCashFlow).toBe(0);
      expect(res.categoryBreakdown).toEqual([]);
    });
  });
});
