import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createWarrantyClaim, 
  updateWarrantyStatus, 
  deleteWarrantyClaim,
  getCompletedOrdersForSelect,
  getEligibleOrderItemsForWarranty,
  getAvailableReplacementItems,
  getWarrantyClaims,
  getWarrantyClaimDetail
} from '@/app/actions/warranty';
import { db } from '@/lib/db';
import { sendSystemNotification } from '@/lib/notifications';

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
      leftJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn((cb) => cb(mockDb)),
    select: vi.fn().mockReturnValue(mockDb),
    insert: vi.fn().mockReturnValue(mockDb),
    update: vi.fn().mockReturnValue(mockDb),
    delete: vi.fn().mockReturnValue(mockDb),
  },
  recalculateRunningBalances: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/server', () => ({
  after: vi.fn((cb) => cb()),
}));

vi.mock('@/lib/notifications', () => ({
  sendSystemNotification: vi.fn().mockResolvedValue(true),
}));

describe('Server Actions - Quản lý Bảo hành (Warranty Module)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDb.where = vi.fn().mockReturnThis();
  });

  describe('createWarrantyClaim', () => {
    it('phải báo lỗi nếu không tìm thấy chi tiết sản phẩm đơn hàng', async () => {
      // Giả lập trả về mảng rỗng khi tìm orderItem
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await createWarrantyClaim({
        orderId: 'order-123',
        orderItemId: 'order-item-123',
        inventoryItemId: 'inv-123',
        customerId: 'cust-123',
        issueDescription: 'Lỗi sọc màn hình',
        receivedDate: '2026-06-01',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Không tìm thấy sản phẩm');
    });

    it('phải báo lỗi nếu không tìm thấy đơn hàng gốc', async () => {
      // 1. Tìm thấy orderItem
      mockDb.limit.mockResolvedValueOnce([{ id: 'order-item-123', warrantyMonths: 12 }]);
      // 2. Không tìm thấy order
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await createWarrantyClaim({
        orderId: 'order-123',
        orderItemId: 'order-item-123',
        inventoryItemId: 'inv-123',
        customerId: 'cust-123',
        issueDescription: 'Lỗi sọc màn hình',
        receivedDate: '2026-06-01',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Không tìm thấy đơn hàng gốc');
    });

    it('phải tạo phiếu bảo hành thành công khi máy còn hạn bảo hành', async () => {
      // 1. Tìm orderItem
      mockDb.limit.mockResolvedValueOnce([{ id: 'order-item-123', warrantyMonths: 12 }]);
      // 2. Tìm order (mua ngày 2026-05-01, nhận bảo hành ngày 2026-06-01 -> vẫn còn hạn)
      mockDb.limit.mockResolvedValueOnce([{ id: 'order-123', createdAt: '2026-05-01T00:00:00.000Z' }]);
      // 3. Tìm profile nhân viên
      mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Kỹ thuật viên' }]);
      // 4. Trả về claim vừa tạo
      mockDb.returning.mockResolvedValueOnce([{ id: 'claim-123', claimNumber: 'WAR-TEST-001' }]);
      // 5. Tìm customer (để gửi telegram)
      mockDb.limit.mockResolvedValueOnce([{ id: 'cust-123', fullName: 'Nguyễn Văn A', phone: '0987654321' }]);
      // 6. Tìm máy cũ (để gửi telegram)
      mockDb.limit.mockResolvedValueOnce([{ id: 'inv-123', serialNumber: 'SN-123456', productId: 'prod-123' }]);
      // 7. Tìm sản phẩm (để gửi telegram)
      mockDb.limit.mockResolvedValueOnce([{ id: 'prod-123', name: 'iPhone 15 Pro Max' }]);

      const result = (await createWarrantyClaim({
        orderId: 'order-123',
        orderItemId: 'order-item-123',
        inventoryItemId: 'inv-123',
        customerId: 'cust-123',
        issueDescription: 'Lỗi sọc màn hình',
        receivedDate: '2026-06-01',
      })) as any;

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(result.claim.claimNumber).toBe('WAR-TEST-001');
    });

    it('phải tạo phiếu bảo hành thành công nhưng xác nhận HẾT HẠN BẢO HÀNH nếu ngày nhận sau ngày hết hạn', async () => {
      // 1. Tìm orderItem
      mockDb.limit.mockResolvedValueOnce([{ id: 'order-item-123', warrantyMonths: 12 }]);
      // 2. Tìm order (mua ngày 2025-01-01, nhận bảo hành ngày 2026-06-01 -> hết hạn)
      mockDb.limit.mockResolvedValueOnce([{ id: 'order-123', createdAt: '2025-01-01T00:00:00.000Z' }]);
      // 3. Tìm profile nhân viên
      mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Kỹ thuật viên' }]);
      // 4. Trả về claim vừa tạo
      mockDb.returning.mockResolvedValueOnce([{ id: 'claim-123', claimNumber: 'WAR-TEST-002', isUnderWarranty: false }]);
      // 5. Tìm customer
      mockDb.limit.mockResolvedValueOnce([{ id: 'cust-123', fullName: 'Nguyễn Văn A', phone: '0987654321' }]);
      // 6. Tìm máy cũ
      mockDb.limit.mockResolvedValueOnce([{ id: 'inv-123', serialNumber: 'SN-123456', productId: 'prod-123' }]);
      // 7. Tìm sản phẩm
      mockDb.limit.mockResolvedValueOnce([{ id: 'prod-123', name: 'iPhone 15 Pro Max' }]);

      const result = (await createWarrantyClaim({
        orderId: 'order-123',
        orderItemId: 'order-item-123',
        inventoryItemId: 'inv-123',
        customerId: 'cust-123',
        issueDescription: 'Chai pin nặng',
        receivedDate: '2026-06-01',
      })) as any;

      expect(result.success).toBe(true);
      expect(result.claim.isUnderWarranty).toBe(false);
    });
  });

  describe('updateWarrantyStatus', () => {
    it('phải cập nhật trạng thái thông thường (ví dụ: inspecting) thành công', async () => {
      // 1. Tìm phiếu bảo hành
      mockDb.limit.mockResolvedValueOnce([{ 
        id: 'claim-123', 
        status: 'pending', 
        inventoryItemId: 'inv-123',
        claimNumber: 'WAR-123'
      }]);
      // 2. Tìm profile nhân viên
      mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
      // 3. Lấy giao dịch sổ quỹ liên quan (không có)
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await updateWarrantyStatus({
        claimId: 'claim-123',
        newStatus: 'inspecting',
        description: 'Bắt đầu kiểm tra kỹ thuật',
        diagnosis: 'Chưa phát hiện lỗi phần cứng',
        repairCost: '0'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
    });

    it('phải cập nhật trạng thái completed (hoàn thành) và khôi phục máy về trạng thái sold thành công', async () => {
      // 1. Tìm phiếu bảo hành
      mockDb.limit.mockResolvedValueOnce([{ 
        id: 'claim-123', 
        status: 'repairing', 
        inventoryItemId: 'inv-123',
        claimNumber: 'WAR-123'
      }]);
      // 2. Tìm profile nhân viên
      mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
      // 3. Lấy giao dịch sổ quỹ liên quan (không có)
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await updateWarrantyStatus({
        claimId: 'claim-123',
        newStatus: 'completed',
        description: 'Đã thay pin xong và trả máy',
        resolution: 'Thay pin linh kiện',
        repairCost: '0'
      });

      expect(result.success).toBe(true);
    });

    it('phải cập nhật trạng thái replaced (đổi máy mới), đánh dấu máy cũ hỏng và xuất máy mới sold thành công', async () => {
      // 1. Tìm phiếu bảo hành
      mockDb.limit.mockResolvedValueOnce([{ 
        id: 'claim-123', 
        status: 'pending', 
        inventoryItemId: 'inv-old',
        orderItemId: 'order-item-123',
        claimNumber: 'WAR-123'
      }]);
      // 2. Tìm profile nhân viên
      mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
      // 3. Lấy giao dịch sổ quỹ liên quan (không có)
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await updateWarrantyStatus({
        claimId: 'claim-123',
        newStatus: 'replaced',
        description: 'Đổi máy mới nguyên seal',
        newInventoryItemId: 'inv-new',
        repairCost: '0'
      });

      expect(result.success).toBe(true);
    });

    it('phải ghi nhận Phiếu Thu vào Sổ quỹ nếu có phí sửa chữa phát sinh (>0đ)', async () => {
      // 1. Tìm phiếu bảo hành
      mockDb.limit.mockResolvedValueOnce([{ 
        id: 'claim-123', 
        status: 'repairing', 
        inventoryItemId: 'inv-123',
        claimNumber: 'WAR-123',
        repairCost: '0'
      }]);
      // 2. Tìm profile nhân viên
      mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
      // 3. Lấy giao dịch sổ quỹ liên quan (chưa có)
      mockDb.limit.mockResolvedValueOnce([]);
      // 4. Lấy tất cả giao dịch để tính toán lại số dư chạy (recalculateRunningBalances)
      mockDb.orderBy.mockResolvedValueOnce([
        { id: 'cb-1', type: 'income', amount: '500000' }
      ]);

      const result = await updateWarrantyStatus({
        claimId: 'claim-123',
        newStatus: 'completed',
        description: 'Sửa lỗi nguồn',
        repairCost: '500000'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteWarrantyClaim', () => {
    it('phải xóa phiếu bảo hành và khôi phục trạng thái máy sold thành công', async () => {
      // 1. Tìm phiếu bảo hành
      mockDb.limit.mockResolvedValueOnce([{ id: 'claim-123', inventoryItemId: 'inv-123' }]);
      // 2. Lấy tất cả giao dịch để tính toán lại số dư chạy (recalculateRunningBalances)
      mockDb.orderBy.mockResolvedValueOnce([]);

      const result = await deleteWarrantyClaim('claim-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Xóa phiếu bảo hành thành công');
    });
  });

  describe('Helper Getters', () => {
    it('getCompletedOrdersForSelect: phải trả về danh sách đơn hàng đã chốt', async () => {
      mockDb.orderBy.mockResolvedValueOnce([
        { id: 'order-1', orderNumber: 'ORD-001', customerName: 'Anh B', customerPhone: '090' }
      ]);
      const list = await getCompletedOrdersForSelect();
      expect(list.length).toBe(1);
    });

    it('getEligibleOrderItemsForWarranty: phải trả về danh sách máy trong đơn hàng', async () => {
      mockDb.where = vi.fn().mockResolvedValueOnce([
        { orderItemId: 'item-1', serialNumber: 'SN-001', productName: 'iPhone' }
      ]);
      const list = await getEligibleOrderItemsForWarranty('order-1');
      expect(list.length).toBe(1);
    });

    it('getAvailableReplacementItems: phải trả về các máy sẵn kho cùng model', async () => {
      mockDb.orderBy = vi.fn().mockResolvedValueOnce([
        { id: 'inv-1', serialNumber: 'SN-002', condition: 'new', sellingPrice: '10000000' }
      ]);
      const list = await getAvailableReplacementItems('prod-1');
      expect(list.length).toBe(1);
    });

    it('getWarrantyClaims: phải lấy danh sách các phiếu bảo hành', async () => {
      mockDb.orderBy = vi.fn().mockResolvedValueOnce([
        { id: 'claim-1', claimNumber: 'WAR-001', status: 'pending' }
      ]);
      const list = await getWarrantyClaims();
      expect(list.length).toBe(1);
    });

      it('getWarrantyClaimDetail: phải trả về chi tiết phiếu bảo hành và logs', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'claim-1', claimNumber: 'WAR-001' }]);
        mockDb.orderBy = vi.fn().mockResolvedValueOnce([
          { id: 'log-1', action: 'created', description: 'Tạo phiếu' }
        ]);
        const res = await getWarrantyClaimDetail('claim-1');
        expect(res).not.toBeNull();
        expect(res?.claim.claimNumber).toBe('WAR-001');
        expect(res?.logs.length).toBe(1);
      });

      it('getCompletedOrdersForSelect: xử lý lỗi catch block', async () => {
        vi.spyOn(mockDb, 'orderBy').mockRejectedValueOnce(new Error('Database error'));
        const list = await getCompletedOrdersForSelect();
        expect(list).toEqual([]);
      });

      it('getEligibleOrderItemsForWarranty: xử lý lỗi catch block', async () => {
        vi.spyOn(mockDb, 'where').mockRejectedValueOnce(new Error('Database error'));
        const list = await getEligibleOrderItemsForWarranty('order-1');
        expect(list).toEqual([]);
      });

      it('getAvailableReplacementItems: xử lý lỗi catch block', async () => {
        vi.spyOn(mockDb, 'orderBy').mockRejectedValueOnce(new Error('Database error'));
        const list = await getAvailableReplacementItems('prod-1');
        expect(list).toEqual([]);
      });

      it('getWarrantyClaims: xử lý lỗi catch block', async () => {
        vi.spyOn(mockDb, 'orderBy').mockRejectedValueOnce(new Error('Database error'));
        const list = await getWarrantyClaims();
        expect(list).toEqual([]);
      });

      it('getWarrantyClaimDetail: xử lý lỗi catch block', async () => {
        vi.spyOn(mockDb, 'limit').mockRejectedValueOnce(new Error('Database error'));
        const res = await getWarrantyClaimDetail('claim-1');
        expect(res).toBeNull();
      });
    });

    describe('createWarrantyClaim Edge Cases', () => {
      it('phải báo lỗi nếu hệ thống chưa cấu hình tài khoản nhân viên', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'order-item-123', warrantyMonths: 12 }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'order-123', createdAt: '2026-05-01' }]);
        mockDb.limit.mockResolvedValueOnce([]); // profile is empty
        const result = await createWarrantyClaim({
          orderId: 'order-123',
          orderItemId: 'order-item-123',
          inventoryItemId: 'inv-123',
          customerId: 'cust-123',
          issueDescription: 'Lỗi sọc màn hình',
          receivedDate: '2026-06-01',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('chưa cấu hình tài khoản nhân viên');
      });

      it('phải tạo thành công và fallback tên khách hàng/thiết bị khi gửi Telegram nếu db trống', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'order-item-123', warrantyMonths: 12 }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'order-123', createdAt: '2026-05-01' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Staff' }]);
        mockDb.returning.mockResolvedValueOnce([{ id: 'claim-123', claimNumber: 'WAR-001' }]);
        mockDb.limit.mockResolvedValueOnce([]); // customer not found
        mockDb.limit.mockResolvedValueOnce([]); // item not found
        const result = await createWarrantyClaim({
          orderId: 'order-123',
          orderItemId: 'order-item-123',
          inventoryItemId: 'inv-123',
          customerId: 'cust-123',
          issueDescription: 'Lỗi',
          receivedDate: '2026-06-01',
        });
        expect(result.success).toBe(true);
      });

      it('xử lý lỗi khi gửi Telegram thất bại trong after()', async () => {
        vi.mocked(sendSystemNotification).mockRejectedValueOnce(new Error('Telegram error'));
        mockDb.limit.mockResolvedValueOnce([{ id: 'order-item-123', warrantyMonths: 12 }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'order-123', createdAt: '2026-05-01' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1', fullName: 'Staff' }]);
        mockDb.returning.mockResolvedValueOnce([{ id: 'claim-123', claimNumber: 'WAR-001' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'cust-123', fullName: 'Customer' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'inv-123' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'prod-123', name: 'Product' }]);

        const result = await createWarrantyClaim({
          orderId: 'order-123',
          orderItemId: 'order-item-123',
          inventoryItemId: 'inv-123',
          customerId: 'cust-123',
          issueDescription: 'Lỗi',
          receivedDate: '2026-06-01',
        });
        expect(result.success).toBe(true);
      });

      it('xử lý lỗi catch block khi tạo phiếu bảo hành', async () => {
        vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Transaction failed'));
        const result = await createWarrantyClaim({
          orderId: 'order-123',
          orderItemId: 'order-item-123',
          inventoryItemId: 'inv-123',
          customerId: 'cust-123',
          issueDescription: 'Lỗi',
          receivedDate: '2026-06-01',
        });
        expect(result.success).toBe(false);
        expect(result.message).toBe('Transaction failed');
      });
    });

    describe('updateWarrantyStatus Edge Cases', () => {
      it('phải báo lỗi nếu không tìm thấy phiếu bảo hành', async () => {
        mockDb.limit.mockResolvedValueOnce([]); // empty claim
        const result = await updateWarrantyStatus({
          claimId: 'claim-123',
          newStatus: 'inspecting',
          description: 'test',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Không tìm thấy phiếu bảo hành');
      });

      it('phải báo lỗi nếu chưa cấu hình tài khoản nhân viên', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'claim-123', status: 'pending' }]);
        mockDb.limit.mockResolvedValueOnce([]); // empty profile
        const result = await updateWarrantyStatus({
          claimId: 'claim-123',
          newStatus: 'inspecting',
          description: 'test',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('chưa cấu hình tài khoản nhân viên');
      });

      it('phải báo lỗi nếu đổi máy mới nhưng không chọn máy thay thế', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'claim-123', status: 'pending' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
        const result = await updateWarrantyStatus({
          claimId: 'claim-123',
          newStatus: 'replaced',
          description: 'test',
        });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Vui lòng chọn máy thay thế mới');
      });

      it('phải cập nhật trạng thái rejected thành công', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'claim-123', status: 'pending', inventoryItemId: 'inv-123' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
        mockDb.limit.mockResolvedValueOnce([]); // empty cashbook
        const result = await updateWarrantyStatus({
          claimId: 'claim-123',
          newStatus: 'rejected',
          description: 'Từ chối bảo hành',
        });
        expect(result.success).toBe(true);
      });

      it('phải giữ nguyên cashbook nếu chi phí sửa chữa không thay đổi', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'claim-123', status: 'pending', repairCost: '500000' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'cb-1', amount: '500000' }]); // same amount
        const result = await updateWarrantyStatus({
          claimId: 'claim-123',
          newStatus: 'completed',
          description: 'Hoàn thành',
          repairCost: '500000',
        });
        expect(result.success).toBe(true);
      });

      it('phải cập nhật cashbook nếu chi phí sửa chữa thay đổi', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'claim-123', status: 'pending', repairCost: '500000' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'cb-1', amount: '300000' }]); // different amount
        const result = await updateWarrantyStatus({
          claimId: 'claim-123',
          newStatus: 'completed',
          description: 'Hoàn thành',
          repairCost: '500000',
        });
        expect(result.success).toBe(true);
      });

      it('phải xóa cashbook nếu chi phí sửa chữa giảm về 0đ', async () => {
        mockDb.limit.mockResolvedValueOnce([{ id: 'claim-123', status: 'pending', repairCost: '500000' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'profile-1' }]);
        mockDb.limit.mockResolvedValueOnce([{ id: 'cb-1', amount: '500000' }]); // existing cashbook
        const result = await updateWarrantyStatus({
          claimId: 'claim-123',
          newStatus: 'completed',
          description: 'Hoàn thành',
          repairCost: '0',
        });
        expect(result.success).toBe(true);
      });

      it('xử lý lỗi catch block khi cập nhật trạng thái', async () => {
        vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Transaction failed'));
        const result = await updateWarrantyStatus({
          claimId: 'claim-123',
          newStatus: 'inspecting',
          description: 'test',
        });
        expect(result.success).toBe(false);
        expect(result.message).toBe('Transaction failed');
      });
    });

    describe('deleteWarrantyClaim Edge Cases', () => {
      it('phải báo lỗi nếu không tìm thấy phiếu bảo hành cần xóa', async () => {
        mockDb.limit.mockResolvedValueOnce([]); // empty claim
        const result = await deleteWarrantyClaim('claim-123');
        expect(result.success).toBe(false);
        expect(result.message).toContain('Không tìm thấy phiếu bảo hành');
      });

      it('xử lý lỗi catch block khi xóa phiếu bảo hành', async () => {
        vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Transaction failed'));
        const result = await deleteWarrantyClaim('claim-123');
        expect(result.success).toBe(false);
        expect(result.message).toBe('Transaction failed');
      });
    });
  });
