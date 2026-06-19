import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createManualIncome, 
  updateManualIncome, 
  deleteManualIncome,
  getIncomeCategories,
  createIncomeCategory,
  updateIncomeCategory,
  deleteIncomeCategory
} from '@/app/actions/accounting'; 
import { db } from '@/lib/db';
 
vi.mock('@/lib/db', () => {
  const mockDb = {
    transaction: vi.fn(),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([])
        })
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([])
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([])
        })
      })
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(true)
    })
  };
  return { 
    db: mockDb,
    recalculateRunningBalances: vi.fn().mockResolvedValue(true)
  };
});
 
vi.mock('@/lib/telegram/notifier', () => ({
  sendTelegramNotification: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/server', () => ({
  after: vi.fn((cb) => cb()),
}));

describe('Server Action - Phiếu Thu Thủ Công (Manual Income)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('phải chặn tạo phiếu thu nếu kỳ kế toán đã chốt sổ', async () => {
    (db.transaction as any).mockImplementation(async (cb: any) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'period-05', isClosed: true }])
            })
          })
        })
      };
      return cb(mockTx);
    });

    const result = await createManualIncome({
      amount: '5000000',
      incomeCategoryId: '10000000-0000-0000-0000-000000000003',
      description: 'Thu tiền thanh lý tài sản cố định',
      entryDate: '2026-05-24',
      paymentMethod: 'bank_transfer'
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('đã chốt sổ');
  });

  it('phải tạo phiếu thu thành công và ghi nhận vào sổ quỹ với referenceType = null', async () => {
    (db.transaction as any).mockImplementation(async (cb: any) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'admin-profile', fullName: 'Chủ Cửa Hàng' }]),
            orderBy: vi.fn().mockResolvedValue([
              { id: 'cb-1', amount: '1000000', type: 'income' }
            ]),
            where: vi.fn().mockReturnValue({
              limit: vi.fn()
                .mockResolvedValueOnce([]) // Kỳ kế toán chưa chốt sổ
                .mockResolvedValueOnce([{ id: '10000000-0000-0000-0000-000000000003', name: 'Thu nhập khác' }])
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'cb-new', entryNumber: 'CB-INC-20260524-ABCD' }])
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
 
    const result = await createManualIncome({
      amount: '3000000',
      incomeCategoryId: '10000000-0000-0000-0000-000000000003',
      description: 'Lãi tiền gửi ngân hàng',
      entryDate: '2026-05-24',
      paymentMethod: 'bank_transfer'
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('thành công');
  });

  it('phải chặn cập nhật phiếu thu nếu kỳ kế toán mới hoặc cũ đã chốt sổ', async () => {
    (db.transaction as any).mockImplementation(async (cb: any) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'period-05', isClosed: true }]) // Kỳ kế toán đã chốt
            })
          })
        })
      };
      return cb(mockTx);
    });

    const result = await updateManualIncome({
      id: 'cb-new',
      amount: '4000000',
      incomeCategoryId: '10000000-0000-0000-0000-000000000003',
      description: 'Lãi tiền gửi ngân hàng sửa đổi',
      entryDate: '2026-05-24',
      paymentMethod: 'bank_transfer'
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('đã chốt sổ');
  });

  it('phải cập nhật phiếu thu thủ công thành công nếu kỳ kế toán chưa chốt', async () => {
    (db.transaction as any).mockImplementation(async (cb: any) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
            where: vi.fn().mockReturnValue({
              limit: vi.fn()
                .mockResolvedValueOnce([]) // Kỳ kế toán mới chưa chốt
                .mockResolvedValueOnce([
                  {
                    id: 'cb-new',
                    type: 'income',
                    category: 'other',
                    amount: '3000000',
                    referenceType: null,
                    entryDate: '2026-05-24',
                  }
                ]) // Phiếu thu tồn tại và referenceType === null
                .mockResolvedValueOnce([]) // Kỳ kế toán cũ chưa chốt
                .mockResolvedValueOnce([{ id: '10000000-0000-0000-0000-000000000003', name: 'Thu nhập khác' }]) // Danh mục thu nhập
            })
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
 
    const result = await updateManualIncome({
      id: 'cb-new',
      amount: '4000000',
      incomeCategoryId: '10000000-0000-0000-0000-000000000003',
      description: 'Lãi tiền gửi ngân hàng sửa đổi',
      entryDate: '2026-05-24',
      paymentMethod: 'bank_transfer'
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('thành công');
  });

  it('phải chặn xóa phiếu thu nếu kỳ kế toán chứa phiếu đã chốt sổ', async () => {
    (db.transaction as any).mockImplementation(async (cb: any) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn()
                .mockResolvedValueOnce([
                  {
                    id: 'cb-new',
                    type: 'income',
                    category: 'other',
                    amount: '3000000',
                    referenceType: null,
                    entryDate: '2026-05-24',
                  }
                ]) // Phiếu thu tồn tại
                .mockResolvedValueOnce([{ id: 'period-05', isClosed: true }]) // Kỳ kế toán đã chốt sổ
            })
          })
        })
      };
      return cb(mockTx);
    });

    const result = await deleteManualIncome('cb-new');

    expect(result.success).toBe(false);
    expect(result.message).toContain('đã chốt sổ');
  });

  it('phải xóa phiếu thu thủ công thành công nếu kỳ kế toán chưa chốt sổ', async () => {
    (db.transaction as any).mockImplementation(async (cb: any) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
            where: vi.fn().mockReturnValue({
              limit: vi.fn()
                .mockResolvedValueOnce([
                  {
                    id: 'cb-new',
                    type: 'income',
                    category: 'other',
                    amount: '3000000',
                    referenceType: null,
                    entryDate: '2026-05-24',
                  }
                ]) // Phiếu thu tồn tại
                .mockResolvedValueOnce([]) // Kỳ kế toán chưa chốt sổ
            })
          })
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(true)
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(true)
          })
        })
      };
      return cb(mockTx);
    });

    const result = await deleteManualIncome('cb-new');

    expect(result.success).toBe(true);
    expect(result.message).toContain('thành công');
  });

  describe('CRUD Danh Mục Thu Nhập (Income Categories)', () => {
    it('phải lấy danh sách danh mục thu nhập thành công', async () => {
      const mockCategories = [{ id: '1', name: 'Thu lãi' }, { id: '2', name: 'Thu quà tặng' }];
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockCategories)
        })
      });

      const list = await getIncomeCategories();
      expect(list).toEqual(mockCategories);
    });

    it('phải tạo danh mục thu nhập thành công', async () => {
      const mockCategory = { id: 'new-id', name: 'Thu tài trợ' };
      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCategory])
        })
      });

      const result = await createIncomeCategory({ name: 'Thu tài trợ', description: 'Mô tả' });
      expect(result.success).toBe(true);
      expect(result.category).toEqual(mockCategory);
    });

    it('phải cập nhật danh mục thu nhập thành công', async () => {
      const mockCategory = { id: 'new-id', name: 'Thu tài trợ sửa đổi' };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockCategory])
          })
        })
      });

      const result = await updateIncomeCategory('new-id', { name: 'Thu tài trợ sửa đổi' });
      expect(result.success).toBe(true);
      expect(result.category).toEqual(mockCategory);
    });

    it('phải chặn xóa danh mục thu nhập nếu đã có phiếu thu liên kết', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'cb-1' }])
          })
        })
      });

      const result = await deleteIncomeCategory('cat-id');
      expect(result.success).toBe(false);
      expect(result.message).toContain('đã có các phiếu thu phát sinh');
    });

    it('phải xóa danh mục thu nhập thành công nếu chưa có phiếu thu liên kết', async () => {
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

      const result = await deleteIncomeCategory('cat-id');
      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
    });
  });
});
