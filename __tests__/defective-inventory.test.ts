import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  reportItemDefectiveAction, 
  sendToRepairAction, 
  completeRepairAction, 
  supplierRefundAction, 
  supplierReturnWriteOffAction 
} from '@/app/actions/inventory';
import { db } from '@/lib/db';

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    }
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((cb) => cb(mockDb)),
    select: vi.fn().mockReturnValue(mockDb),
    insert: vi.fn().mockReturnValue(mockDb),
    update: vi.fn().mockReturnValue(mockDb),
  },
  recalculateRunningBalances: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/server', () => ({
  after: vi.fn((cb) => cb()),
}));

describe('Server Actions - Quản lý Kho lỗi (Defective Inventory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reportItemDefectiveAction: phải báo lỗi máy từ kho sang kho lỗi thành công', async () => {
    // 1. Giả lập tìm kiếm máy in_stock
    mockDb.limit.mockResolvedValueOnce([{ id: 'item-123', status: 'in_stock', serialNumber: 'SN-123' }]);
    // 2. Giả lập lấy profiles
    mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Admin' }]);
    // 3. Giả lập update returning
    mockDb.returning.mockResolvedValueOnce([{ id: 'item-123', status: 'defective' }]);

    const result = await reportItemDefectiveAction('item-123', 'Màn hình bị sọc');

    expect(result.success).toBe(true);
    expect(result.message).toContain('thành công');
  });

  it('sendToRepairAction: phải chuyển trạng thái sang warranty_repair thành công', async () => {
    // 1. Giả lập tìm kiếm máy đang lỗi (defective)
    mockDb.limit.mockResolvedValueOnce([{ id: 'item-123', status: 'defective', serialNumber: 'SN-123' }]);
    // 2. Giả lập lấy profiles
    mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Admin' }]);

    const result = await sendToRepairAction('item-123', 'supplier', undefined, 'Gửi bảo hành Asus');

    expect(result.success).toBe(true);
    expect(result.message).toContain('thành công');
  });

  it('completeRepairAction: phải chuyển máy về in_stock và ghi nhận phiếu chi nếu có phí sửa', async () => {
    // 1. Giả lập tìm kiếm máy đang sửa (warranty_repair)
    mockDb.limit.mockResolvedValueOnce([{ id: 'item-123', status: 'warranty_repair', serialNumber: 'SN-123' }]);
    // 2. Giả lập lấy profiles
    mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Admin' }]);

    const result = await completeRepairAction('item-123', '200000', 'cash');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Hoàn tất');
  });

  it('supplierRefundAction: phải xuất máy sang returned và ghi nhận phiếu thu', async () => {
    // 1. Giả lập tìm kiếm máy đang lỗi (defective)
    mockDb.limit.mockResolvedValueOnce([{ id: 'item-123', status: 'defective', serialNumber: 'SN-123' }]);
    // 2. Giả lập lấy profiles
    mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Admin' }]);

    const result = await supplierRefundAction('item-123', '15000000', 'bank_transfer', 'NCC hoàn tiền mặt');

    expect(result.success).toBe(true);
    expect(result.message).toContain('thành công');
  });

  it('supplierReturnWriteOffAction: phải xuất máy sang returned không hoàn tiền', async () => {
    // 1. Giả lập tìm kiếm máy đang lỗi (defective)
    mockDb.limit.mockResolvedValueOnce([{ id: 'item-123', status: 'defective', serialNumber: 'SN-123' }]);
    // 2. Giả lập lấy profiles
    mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Admin' }]);

    const result = await supplierReturnWriteOffAction('item-123');

    expect(result.success).toBe(true);
    expect(result.message).toContain('thành công');
  });
});
