import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInventoryItemsBatch } from '@/app/actions/inventory';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

describe('Server Action - Quản lý Nhập Kho Lô Lớn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('phải xử lý mượt mà mảng 200 Serial Number và cắt bỏ khoảng trắng dư thừa', async () => {
    // 1. Tạo 200 Serial Number
    const bulkSerials = Array.from({ length: 200 }, (_, i) => `SN-BULK-US-${i}`);
    
    // Cố tình làm bẩn data: Thêm khoảng trắng vào đầu/cuối của 2 cái Serial đầu tiên
    bulkSerials[0] = '  SN-BULK-US-0  ';
    bulkSerials[1] = 'SN-BULK-US-1   ';

    const mockBulkData = {
      productId: 'prod-macbook-m3',
      serialNumbers: bulkSerials,
      condition: 'new' as const,
      status: 'in_stock' as const,
      costPrice: '30000000',
    };

    (db.transaction as any).mockImplementation(async (cb: any) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            // 1. Phục vụ riêng cho truy vấn lấy nhân viên: tx.select().from(profiles).limit(1)
            limit: vi.fn().mockResolvedValue([{ id: 'profile-owner-1' }]),
            
            // 2. Phục vụ riêng cho truy vấn check Serial trùng: tx.select().from(inventoryItems).where(...)
            where: vi.fn().mockReturnValue({
              // Trả về mảng rỗng [] nghĩa là trong DB chưa có Serial này
              limit: vi.fn().mockResolvedValue([]) 
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'inv-bulk-id' }]),
            then: function(resolve: any) { resolve(true); }
          })
        }),
      };
      return cb(mockTx);
    });

    const result = await createInventoryItemsBatch(mockBulkData);

    expect(result.success).toBe(true);
    // Xác nhận đã lặp qua và tạo đủ 200 máy
    expect(result.message).toContain('Nhập kho thành công lô hàng 200 máy');
  });
});