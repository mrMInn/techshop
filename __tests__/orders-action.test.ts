import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getOrdersList,
  getInStockItemsForSelect,
  getCustomersForSelect,
  getLeadSourcesAction,
  createCustomerAction,
  createOrderAction,
  cancelOrderAction,
  recordPaymentAction,
  completeOnlineOrderAction,
  updateOrderShippingAction,
  getOrderDetail
} from '@/app/actions/orders';
import { db } from '@/lib/db';
import { sendTelegramNotification } from '@/lib/telegram/notifier';

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
    offset: vi.fn().mockImplementation(() => mockDbObj),
    limit: vi.fn().mockImplementation(() => mockDbObj),
    groupBy: vi.fn().mockImplementation(() => mockDbObj),
    as: vi.fn().mockImplementation(() => mockDbObj),
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

vi.mock('@/lib/telegram/notifier', () => ({
  sendTelegramNotification: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/server', () => ({
  after: vi.fn((cb) => cb()),
}));

const mockChain = (resolved: any) => {
  const obj: any = {
    from: vi.fn().mockImplementation(() => obj),
    innerJoin: vi.fn().mockImplementation(() => obj),
    leftJoin: vi.fn().mockImplementation(() => obj),
    where: vi.fn().mockImplementation(() => obj),
    orderBy: vi.fn().mockImplementation(() => obj),
    offset: vi.fn().mockImplementation(() => obj),
    groupBy: vi.fn().mockImplementation(() => obj),
    as: vi.fn().mockImplementation(() => obj),
    limit: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
    returning: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
    then: vi.fn().mockImplementation((cb: any) => Promise.resolve(resolved).then(cb)),
  };
  return obj;
};

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
    offset: vi.fn().mockImplementation(() => chainObj),
    groupBy: vi.fn().mockImplementation(() => chainObj),
    as: vi.fn().mockImplementation(() => chainObj),
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

describe('Server Actions - Quản lý Đơn hàng (Orders Module)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset mockDb methods to default chain behavior
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
    mockDb.offset.mockImplementation(() => mockDb);
    mockDb.limit.mockImplementation(() => mockDb);
    mockDb.groupBy.mockImplementation(() => mockDb);
    mockDb.as.mockImplementation(() => mockDb);
    mockDb.returning.mockImplementation(() => Promise.resolve([]));
    mockDb.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));
  });

  describe('getOrdersList', () => {
    it('phải trả về danh sách đơn hàng và thông số phân trang mặc định', async () => {
      let thenCallCount = 0;
      mockDb.then.mockImplementation((onfulfilled) => {
        thenCallCount++;
        if (thenCallCount === 1) {
          return Promise.resolve([{ id: 'order-1', orderNumber: 'ORD-001' }]).then(onfulfilled);
        } else if (thenCallCount === 2) {
          return Promise.resolve([{ count: 5 }]).then(onfulfilled);
        } else {
          return Promise.resolve([{ completedCount: 3, processingCount: 1, cancelledCount: 1, onlineCount: 1 }]).then(onfulfilled);
        }
      });

      const res = await getOrdersList();
      expect(res.orders.length).toBe(1);
      expect(res.pagination.totalItems).toBe(5);
      expect(res.stats.completedCount).toBe(3);
    });

    it('phải áp dụng bộ lọc status, paymentStatus, saleChannel và search', async () => {
      let thenCallCount = 0;
      mockDb.then.mockImplementation((onfulfilled) => {
        thenCallCount++;
        if (thenCallCount === 1) {
          return Promise.resolve([{ id: 'order-1' }]).then(onfulfilled);
        } else if (thenCallCount === 2) {
          return Promise.resolve([{ count: 1 }]).then(onfulfilled);
        } else {
          return Promise.resolve([{ completedCount: 1, processingCount: 0, cancelledCount: 0, onlineCount: 0 }]).then(onfulfilled);
        }
      });

      const res = await getOrdersList({
        status: 'completed',
        paymentStatus: 'paid',
        saleChannel: 'online',
        search: 'ORD-001',
      });
      expect(res.orders.length).toBe(1);
    });

    it('xử lý lỗi catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Query failed')));
      const res = await getOrdersList();
      expect(res.orders).toEqual([]);
      expect(res.pagination.totalItems).toBe(0);
    });
  });

  describe('getInStockItemsForSelect', () => {
    it('phải lấy danh sách máy sẵn kho thành công', async () => {
      mockDb.then.mockImplementationOnce((cb) => Promise.resolve([{ id: 'inv-1', serialNumber: 'SN-001' }]).then(cb));
      const res = await getInStockItemsForSelect();
      expect(res.length).toBe(1);
    });

    it('xử lý lỗi catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Database error')));
      const res = await getInStockItemsForSelect();
      expect(res).toEqual([]);
    });
  });

  describe('getCustomersForSelect', () => {
    it('phải lấy danh sách khách hàng thành công', async () => {
      mockDb.then.mockImplementationOnce((cb) => Promise.resolve([{ id: 'cust-1', fullName: 'Customer A' }]).then(cb));
      const res = await getCustomersForSelect();
      expect(res.length).toBe(1);
    });

    it('xử lý lỗi catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Database error')));
      const res = await getCustomersForSelect();
      expect(res).toEqual([]);
    });
  });

  describe('getLeadSourcesAction', () => {
    it('phải lấy danh sách nguồn khách hàng thành công', async () => {
      mockDb.then.mockImplementationOnce((cb) => Promise.resolve([{ id: 'lead-1', name: 'Facebook' }]).then(cb));
      const res = await getLeadSourcesAction();
      expect(res.length).toBe(1);
    });

    it('xử lý lỗi catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Database error')));
      const res = await getLeadSourcesAction();
      expect(res).toEqual([]);
    });
  });

  describe('createCustomerAction', () => {
    it('phải thêm mới khách hàng thành công', async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: 'cust-1', fullName: 'Nguyen Van A' }]);
      const res = await createCustomerAction({ fullName: 'Nguyen Van A', phone: '0987654321' });
      expect(res.success).toBe(true);
      expect(res.customer?.fullName).toBe('Nguyen Van A');
    });

    it('xử lý lỗi catch block', async () => {
      mockDb.returning.mockRejectedValueOnce(new Error('Insert failed'));
      const res = await createCustomerAction({ fullName: 'Nguyen Van A', phone: '0987654321' });
      expect(res.success).toBe(false);
    });
  });

  describe('createOrderAction', () => {
    it('báo lỗi nếu items trống', async () => {
      const res = await createOrderAction({ saleChannel: 'offline', items: [] });
      expect(res.success).toBe(false);
      expect(res.message).toContain('ít nhất 1 sản phẩm');
    });

    it('phải tạo đơn hàng offline thành công với Khách vãng lai và thanh toán đủ', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'guest-1', fullName: 'Khách vãng lai' }],
          [{ id: 'inv-1', status: 'in_stock', costPrice: '10000000', serialNumber: 'SN-001' }],
          [{ id: 'acc-prod-1', name: 'Phụ kiện chung' }],
          [], // attached accessories
          [{ id: 'profile-1', fullName: 'Staff' }],
          [{ id: 'guest-1', totalSpent: '0', orderCount: 0 }],
          [{ serialNumber: 'SN-001', productName: 'iPhone', sellingPrice: '12000000' }]
        ],
        [[{ id: 'order-1', orderNumber: 'ORD-001' }]]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await createOrderAction({
        saleChannel: 'offline',
        paymentMethod: 'bank_transfer',
        items: [{ inventoryItemId: 'inv-1', productId: 'prod-1', sellingPrice: '12000000', warrantyMonths: 12 }],
      });
      expect(res.success).toBe(true);
    });

    it('phải tạo đơn hàng online thành công và tạo khách vãng lai mới nếu chưa có', async () => {
      const txMock = createTxMock(
        [
          [],
          [{ id: 'inv-1', status: 'in_stock', costPrice: '10000000', serialNumber: 'SN-001' }],
          [{ id: 'acc-prod-1', name: 'Phụ kiện chung' }],
          [], // attached accessories
          [{ id: 'profile-1', fullName: 'Staff' }],
          [{ id: 'guest-new', totalSpent: '0', orderCount: 0 }],
          [{ serialNumber: 'SN-001', productName: 'iPhone', sellingPrice: '12000000' }]
        ],
        [
          [{ id: 'guest-new', fullName: 'Khách vãng lai' }],
          [{ id: 'order-1', orderNumber: 'ORD-001' }]
        ]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await createOrderAction({
        saleChannel: 'online',
        customerId: '',
        paymentMethod: 'card',
        initialPaymentAmount: '5000000',
        items: [{ inventoryItemId: 'inv-1', productId: 'prod-1', sellingPrice: '12000000', warrantyMonths: 12 }],
      });
      expect(res.success).toBe(true);
    });

    it('phải tạo đơn hàng online thành công nhưng gặp lỗi gửi Telegram', async () => {
      vi.mocked(sendTelegramNotification).mockRejectedValueOnce(new Error('Telegram failed'));
      
      const txMock = createTxMock(
        [
          [],
          [{ id: 'inv-1', status: 'in_stock', costPrice: '10000000', serialNumber: 'SN-001' }],
          [{ id: 'acc-prod-1', name: 'Phụ kiện chung' }],
          [], // attached accessories
          [{ id: 'profile-1', fullName: 'Staff' }],
          [{ id: 'guest-new', totalSpent: '0', orderCount: 0 }],
          [{ serialNumber: 'SN-001', productName: 'iPhone', sellingPrice: '12000000' }]
        ],
        [
          [{ id: 'guest-new', fullName: 'Khách vãng lai' }],
          [{ id: 'order-1', orderNumber: 'ORD-001' }]
        ]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await createOrderAction({
        saleChannel: 'online',
        customerId: '',
        paymentMethod: 'card',
        initialPaymentAmount: '12000000',
        items: [{ inventoryItemId: 'inv-1', productId: 'prod-1', sellingPrice: '12000000', warrantyMonths: 12 }],
      });
      expect(res.success).toBe(true);
    });

    it('báo lỗi nếu một số máy không tồn tại', async () => {
      const txMock = createTxMock([[], []]);

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await createOrderAction({
        customerId: 'cust-1',
        saleChannel: 'offline',
        items: [{ inventoryItemId: 'inv-1', productId: 'prod-1', sellingPrice: '12000000', warrantyMonths: 12 }],
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('không tồn tại trong kho');
    });

    it('báo lỗi nếu máy đã bán', async () => {
      const txMock = createTxMock([
        [{ id: 'inv-1', status: 'sold', costPrice: '10000000' }]
      ]);

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await createOrderAction({
        customerId: 'cust-1',
        saleChannel: 'offline',
        items: [{ inventoryItemId: 'inv-1', productId: 'prod-1', sellingPrice: '12000000', warrantyMonths: 12 }],
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã bán hoặc không sẵn sàng');
    });

    it('báo lỗi nếu chưa cấu hình tài khoản nhân viên', async () => {
      const txMock = createTxMock([
        [{ id: 'inv-1', status: 'in_stock', costPrice: '10000000', serialNumber: 'SN-001' }],
        [{ id: 'acc-prod-1', name: 'Phụ kiện chung' }],
        [], // attachedAccs
        [] // profile
      ]);

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await createOrderAction({
        customerId: 'cust-1',
        saleChannel: 'offline',
        items: [{ inventoryItemId: 'inv-1', productId: 'prod-1', sellingPrice: '12000000', warrantyMonths: 12 }],
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('chưa cấu hình tài khoản nhân viên');
    });

    it('xử lý lỗi catch block khi giao dịch thất bại', async () => {
      vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Transaction failed'));
      const res = await createOrderAction({
        customerId: 'cust-1',
        saleChannel: 'offline',
        items: [{ inventoryItemId: 'inv-1', productId: 'prod-1', sellingPrice: '12000000', warrantyMonths: 12 }],
      });
      expect(res.success).toBe(false);
      expect(res.message).toBe('Transaction failed');
    });
  });

  describe('cancelOrderAction', () => {
    it('báo lỗi nếu không tìm thấy đơn hàng', async () => {
      const txMock = createTxMock([[]]);

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await cancelOrderAction('order-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy đơn hàng');
    });

    it('báo lỗi nếu đơn hàng đã được hủy trước đó', async () => {
      const txMock = createTxMock([
        [{ id: 'order-1', status: 'cancelled' }]
      ]);

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await cancelOrderAction('order-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã được hủy trước đó');
    });

    it('báo lỗi nếu chưa cấu hình tài khoản nhân viên', async () => {
      const txMock = createTxMock([
        [{ id: 'order-1', status: 'completed' }],
        []
      ]);

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await cancelOrderAction('order-1');
      expect(res.success).toBe(false);
      expect(res.message).toContain('chưa cấu hình tài khoản nhân viên');
    });

    it('phải hủy đơn hàng thành công, restock máy và cập nhật chi tiêu khách hàng', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'order-1', orderNumber: 'ORD-001', customerId: 'cust-1', totalAmount: '12000000', status: 'completed' }],
          [{ id: 'profile-1' }],
          [{ id: 'oi-1', inventoryItemId: 'inv-1' }],
          [{ id: 'cust-1', totalSpent: '12000000', orderCount: 1 }]
        ],
        [],
        [
          [], // call 1: inventory item update in loop
          [], // call 2: customer stats update
          [{ id: 'order-1', status: 'cancelled' }] // call 3: order cancel update
        ]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await cancelOrderAction('order-1');
      expect(res.success).toBe(true);
      expect((res as any).order?.status).toBe('cancelled');
    });

    it('phải hủy đơn hàng thành công nhưng gặp lỗi gửi Telegram', async () => {
      vi.mocked(sendTelegramNotification).mockRejectedValueOnce(new Error('Telegram failed'));

      const txMock = createTxMock(
        [
          [{ id: 'order-1', orderNumber: 'ORD-001', customerId: 'cust-1', totalAmount: '12000000', status: 'completed' }],
          [{ id: 'profile-1' }],
          [{ id: 'oi-1', inventoryItemId: 'inv-1' }],
          [{ id: 'cust-1', totalSpent: '12000000', orderCount: 1 }]
        ],
        [],
        [
          [], // call 1: inventory item update in loop
          [], // call 2: customer stats update
          [{ id: 'order-1', status: 'cancelled' }] // call 3: order cancel update
        ]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await cancelOrderAction('order-1');
      expect(res.success).toBe(true);
    });

    it('xử lý lỗi catch block', async () => {
      vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Cancel failed'));
      const res = await cancelOrderAction('order-1');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Cancel failed');
    });
  });

  describe('recordPaymentAction', () => {
    it('báo lỗi nếu số tiền thanh toán <= 0', async () => {
      const res = await recordPaymentAction({ orderId: 'order-1', amount: '-1000', paymentMethod: 'cash' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('phải lớn hơn 0');
    });

    it('báo lỗi nếu không tìm thấy đơn hàng', async () => {
      const txMock = createTxMock([[]]);

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await recordPaymentAction({ orderId: 'order-1', amount: '5000000', paymentMethod: 'cash' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy đơn hàng');
    });

    it('phải ghi nhận thanh toán bổ sung thành công (partial & paid)', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'order-1', totalAmount: '10000000', orderNumber: 'ORD-001' }],
          [{ amount: '2000000' }],
          [{ id: 'profile-1' }]
        ],
        [[{ id: 'p-1', amount: '3000000' }]]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await recordPaymentAction({
        orderId: 'order-1',
        amount: '3000000',
        paymentMethod: 'momo',
        notes: 'Pay part 2',
      });
      expect(res.success).toBe(true);
      expect((res as any).payment?.amount).toBe('3000000');
    });

    it('phải ghi nhận thanh toán bổ sung thành công và đổi status sang paid', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'order-1', totalAmount: '10000000', orderNumber: 'ORD-001' }],
          [{ amount: '2000000' }],
          [{ id: 'profile-1' }]
        ],
        [[{ id: 'p-1', amount: '8000000' }]]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await recordPaymentAction({
        orderId: 'order-1',
        amount: '8000000',
        paymentMethod: 'momo',
      });
      expect(res.success).toBe(true);
    });

    it('xử lý lỗi catch block', async () => {
      vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Payment failed'));
      const res = await recordPaymentAction({ orderId: 'order-1', amount: '5000000', paymentMethod: 'cash' });
      expect(res.success).toBe(false);
      expect(res.message).toBe('Payment failed');
    });
  });

  describe('completeOnlineOrderAction', () => {
    it('báo lỗi nếu số tiền COD < 0', async () => {
      const res = await completeOnlineOrderAction({ orderId: 'order-1', amount: '-500', paymentMethod: 'cash' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('COD không hợp lệ');
    });

    it('báo lỗi nếu đơn hàng không ở trạng thái processing', async () => {
      const txMock = createTxMock([
        [{ id: 'order-1', status: 'completed' }]
      ]);

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await completeOnlineOrderAction({ orderId: 'order-1', amount: '5000000', paymentMethod: 'cash' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Chỉ đơn hàng đang xử lý/đang giao mới có thể xác nhận');
    });

    it('phải hoàn tất đơn hàng online thành công (COD > 0)', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'order-1', status: 'processing', totalAmount: '12000000', orderNumber: 'ORD-001', customerId: 'cust-1' }],
          [{ amount: '2000000' }],
          [{ id: 'profile-1' }],
          [{ serialNumber: 'SN-001', productName: 'iPhone', sellingPrice: '12000000' }],
          [{ id: 'cust-1', fullName: 'Nguyen Van A', phone: '0987654321' }]
        ],
        [],
        [[{ id: 'order-1', status: 'completed' }]]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await completeOnlineOrderAction({
        orderId: 'order-1',
        amount: '10000000',
        paymentMethod: 'bank_transfer',
      });
      expect(res.success).toBe(true);
    });

    it('phải hoàn tất đơn hàng online thành công nhưng gặp lỗi gửi Telegram', async () => {
      vi.mocked(sendTelegramNotification).mockRejectedValueOnce(new Error('Telegram failed'));

      const txMock = createTxMock(
        [
          [{ id: 'order-1', status: 'processing', totalAmount: '12000000', orderNumber: 'ORD-001', customerId: 'cust-1' }],
          [{ amount: '2000000' }],
          [{ id: 'profile-1' }],
          [{ serialNumber: 'SN-001', productName: 'iPhone', sellingPrice: '12000000' }],
          [{ id: 'cust-1', fullName: 'Nguyen Van A', phone: '0987654321' }]
        ],
        [],
        [[{ id: 'order-1', status: 'completed' }]]
      );

      vi.mocked(db.transaction).mockImplementationOnce(async (cb: any) => {
        return cb(txMock);
      });

      const res = await completeOnlineOrderAction({
        orderId: 'order-1',
        amount: '10000000',
        paymentMethod: 'bank_transfer',
      });
      expect(res.success).toBe(true);
    });

    it('xử lý lỗi catch block', async () => {
      vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('Complete failed'));
      const res = await completeOnlineOrderAction({ orderId: 'order-1', amount: '5000000', paymentMethod: 'cash' });
      expect(res.success).toBe(false);
      expect(res.message).toBe('Complete failed');
    });
  });

  describe('updateOrderShippingAction', () => {
    it('phải cập nhật thông tin vận chuyển thành công', async () => {
      const res = await updateOrderShippingAction({
        orderId: 'order-1',
        trackingNumber: 'TRACK123',
        shippingCarrier: 'GHN',
        packingVideoUrl: 'http://video',
        notes: 'ship nhanh',
      });
      expect(res.success).toBe(true);
    });

    it('xử lý lỗi catch block', async () => {
      mockDb.where.mockImplementationOnce(() => { throw new Error('Update failed'); });
      const res = await updateOrderShippingAction({ orderId: 'order-1' });
      expect(res.success).toBe(false);
    });
  });

  describe('getOrderDetail', () => {
    it('trả về null nếu không tìm thấy đơn hàng', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const res = await getOrderDetail('order-1');
      expect(res).toBeNull();
    });

    it('phải trả về chi tiết đơn hàng, items, payments, returns thành công', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 'order-1', orderNumber: 'ORD-001' }]);
      
      let thenCallCount = 0;
      mockDb.then.mockImplementation((onfulfilled: any) => {
        thenCallCount++;
        if (thenCallCount === 1) {
          return Promise.resolve([{ id: 'oi-1', productName: 'iPhone', serialNumber: 'SN-001' }]).then(onfulfilled);
        } else if (thenCallCount === 2) {
          return Promise.resolve([{ id: 'p-1', amount: '12000000', paymentMethod: 'cash' }]).then(onfulfilled);
        } else {
          return Promise.resolve([{ id: 'ret-1', returnNumber: 'RET-001', refundAmount: '0' }]).then(onfulfilled);
        }
      });

      const res = await getOrderDetail('order-1');
      expect(res).not.toBeNull();
      expect(res?.order.orderNumber).toBe('ORD-001');
      expect(res?.items.length).toBe(1);
      expect(res?.payments.length).toBe(1);
      expect(res?.returns.length).toBe(1);
    });

    it('xử lý lỗi catch block', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('Detail failed'));
      const res = await getOrderDetail('order-1');
      expect(res).toBeNull();
    });
  });
});