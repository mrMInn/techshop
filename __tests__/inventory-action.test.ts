import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getInventoryItems,
  getProductsForDropdown,
  createInventoryItem,
  createInventoryItemsBatch,
  updateInventoryItem,
  softDeleteInventoryItem,
  restoreInventoryItem,
  deleteInventoryItem,
  getInventoryItemMovements,
  clearAllSystemData,
  bulkConfirmArrival,
  bulkDeleteInventoryItems,
  getInventoryItemLifecycle,
  reportItemDefectiveAction,
  sendToRepairAction,
  completeRepairAction,
  supplierRefundAction,
  supplierReturnWriteOffAction,
  getInventoryCapitalSummary
} from '@/app/actions/inventory';
import { db } from '@/lib/db';

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
    as: vi.fn().mockImplementation(() => mockDbObj),
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

const mockChain = (resolved: any) => {
  const obj: any = {
    from: vi.fn().mockImplementation(() => obj),
    innerJoin: vi.fn().mockImplementation(() => obj),
    leftJoin: vi.fn().mockImplementation(() => obj),
    where: vi.fn().mockImplementation(() => obj),
    orderBy: vi.fn().mockImplementation(() => obj),
    groupBy: vi.fn().mockImplementation(() => obj),
    as: vi.fn().mockImplementation(() => obj),
    offset: vi.fn().mockImplementation(() => obj),
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
    groupBy: vi.fn().mockImplementation(() => chainObj),
    as: vi.fn().mockImplementation(() => chainObj),
    offset: vi.fn().mockImplementation(() => chainObj),
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

describe('Server Actions - Quản lý Kho hàng (Inventory Actions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

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
    mockDb.as.mockImplementation(() => mockDb);
    mockDb.offset.mockImplementation(() => mockDb);
    mockDb.limit.mockImplementation(() => mockDb);
    mockDb.returning.mockImplementation(() => Promise.resolve([]));
    mockDb.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));
  });

  describe('getInventoryItems', () => {
    it('lấy danh sách thành công', async () => {
      mockDb.then.mockImplementationOnce((cb) => Promise.resolve([{ id: '1', serialNumber: 'SN-1' }]).then(cb));
      const res = await getInventoryItems();
      expect(res.length).toBe(1);
    });
  });

  describe('getProductsForDropdown', () => {
    it('lấy danh sách models thành công', async () => {
      mockDb.then.mockImplementationOnce((cb) => Promise.resolve([{ id: 'p-1', name: 'Product 1' }]).then(cb));
      const res = await getProductsForDropdown();
      expect(res.length).toBe(1);
    });
  });

  describe('createInventoryItem', () => {
    it('thành công không nhà cung cấp', async () => {
      const txMock = createTxMock(
        [[{ id: 'profile-1' }]], // ownerProfiles
        [
          [{ id: 'sup-1', name: 'Nhà cung cấp lẻ' }], // default supplier insert
          [{ id: 'po-1' }], // PO insert
          [{ id: 'poi-1' }], // PO item insert
          [{ id: 'inv-1' }] // newItem returning
        ]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createInventoryItem({
        productId: 'prod-1',
        serialNumber: 'SN-001',
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(true);
      expect((res as any).item?.id).toBe('inv-1');
    });

    it('thành công có nhà cung cấp mới tự tạo', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'profile-1' }], // ownerProfiles
          [] // defaultSuppliers empty -> creates new supplier
        ],
        [
          [{ id: 'sup-1', name: 'Nhập khẩu quốc tế' }], // supplier insert
          [{ id: 'po-1' }], // po insert
          [{ id: 'poi-1' }], // poitem insert
          [{ id: 'inv-1' }] // item insert
        ]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createInventoryItem({
        productId: 'prod-1',
        serialNumber: 'SN-001',
        condition: 'new',
        status: 'incoming',
        costPrice: '10000000',
        originCountry: 'US', // triggers default supplier
        shippingMethod: 'air',
      });
      expect(res.success).toBe(true);
    });

    it('thành công có nhà cung cấp có sẵn', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'profile-1' }],
          [{ id: 'sup-1', name: 'Nhập khẩu quốc tế' }] // defaultSuppliers exist
        ],
        [
          [{ id: 'po-1' }], // po insert
          [{ id: 'poi-1' }], // poitem insert
          [{ id: 'inv-1' }] // item insert
        ]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createInventoryItem({
        productId: 'prod-1',
        serialNumber: 'SN-001',
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
        originCountry: 'US',
        shippingMethod: 'air',
      });
      expect(res.success).toBe(true);
    });

    it('báo lỗi unique constraint 23505', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce({ code: '23505', message: 'duplicate key' });
      const res = await createInventoryItem({
        productId: 'prod-1',
        serialNumber: 'SN-001',
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Serial Number đã tồn tại');
    });

    it('báo lỗi generic catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Transaction failed'));
      const res = await createInventoryItem({
        productId: 'prod-1',
        serialNumber: 'SN-001',
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(false);
      expect(res.message).toBe('Transaction failed');
    });
  });

  describe('createInventoryItemsBatch', () => {
    it('báo lỗi serialNumbers trống', async () => {
      const res = await createInventoryItemsBatch({
        productId: 'prod-1',
        serialNumbers: [],
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('không được để trống');
    });

    it('báo lỗi serialNumbers bẩn rỗng', async () => {
      const res = await createInventoryItemsBatch({
        productId: 'prod-1',
        serialNumbers: [' ', ''],
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('không hợp lệ');
    });

    it('báo lỗi duplicate serials trong input', async () => {
      const res = await createInventoryItemsBatch({
        productId: 'prod-1',
        serialNumbers: ['SN-1', 'SN-2', 'SN-1'],
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('trùng lặp trong lô nhập');
    });

    it('báo lỗi profile nhân viên trống', async () => {
      const txMock = createTxMock([[]]); // empty profiles
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createInventoryItemsBatch({
        productId: 'prod-1',
        serialNumbers: ['SN-1'],
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('chưa có tài khoản nhân viên');
    });

    it('báo lỗi serial đã tồn tại trên db', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'profile-1' }], // profiles
          [{ id: 'sup-1', name: 'Nhà cung cấp lẻ' }], // defaultSuppliers
          [{ id: 'inv-existing', serialNumber: 'SN-1' }] // existing serial check
        ],
        [
          [{ id: 'po-1' }], // PO insert
          [{ id: 'poi-1' }] // PO item insert
        ]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createInventoryItemsBatch({
        productId: 'prod-1',
        serialNumbers: ['SN-1'],
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã tồn tại trên hệ thống');
    });

    it('thành công tạo lô hàng', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'profile-1' }], // profiles
          [], // defaultSuppliers empty
          [], // serial check empty
        ],
        [
          [{ id: 'sup-1' }], // supplier
          [{ id: 'po-1' }], // po
          [{ id: 'poi-1' }], // poitem
          [{ id: 'inv-1' }], // item
        ]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createInventoryItemsBatch({
        productId: 'prod-1',
        serialNumbers: ['SN-1'],
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
        originCountry: 'US',
        shippingMethod: 'air',
      });
    });

    it('thành công tạo lô hàng với nhà cung cấp mặc định đã tồn tại', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'profile-1' }], // profiles
          [{ id: 'sup-existing' }], // defaultSuppliers exist
          [], // serial check empty
        ],
        [
          [{ id: 'po-1' }], // po
          [{ id: 'poi-1' }], // poitem
          [{ id: 'inv-1' }], // item
        ]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await createInventoryItemsBatch({
        productId: 'prod-1',
        serialNumbers: ['SN-1'],
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
        originCountry: 'US',
        shippingMethod: 'air',
      });
      expect(res.success).toBe(true);
    });

    it('xử lý lỗi generic catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Batch failed'));
      const res = await createInventoryItemsBatch({
        productId: 'prod-1',
        serialNumbers: ['SN-1'],
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
      });
      expect(res.success).toBe(false);
      expect(res.message).toBe('Batch failed');
    });
  });

  describe('updateInventoryItem', () => {
    it('báo lỗi không tìm thấy sản phẩm', async () => {
      const txMock = createTxMock([[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateInventoryItem('inv-1', { serialNumber: 'SN-new' });
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy sản phẩm');
    });

    it('thành công cập nhật có liên kết PO cũ và đổi status/chi phí', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'inv-1', purchaseOrderItemId: 'poi-1', costPrice: '10000000', status: 'incoming' }], // existing
          [{ id: 'profile-1' }], // profile
          [{ id: 'poi-1', purchaseOrderId: 'po-1', quantity: 1 }], // poItems
          [{ id: 'po-1', shippingCost: '100000' }] // existingPo
        ],
        [],
        [[{ id: 'inv-1', serialNumber: 'SN-new', status: 'in_stock' }]] // update returning
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateInventoryItem('inv-1', {
        serialNumber: 'SN-new',
        status: 'in_stock',
        costPrice: '12000000',
        sellingPrice: '15000000',
        condition: 'new',
        supplierId: 'sup-1',
        shippingCost: '200000',
      });
      expect(res.success).toBe(true);
    });

    it('thành công tạo PO mới khi chưa có liên kết', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'inv-1', purchaseOrderItemId: null, costPrice: '10000000', status: 'incoming' }],
          [{ id: 'profile-1' }]
        ],
        [
          [{ id: 'po-1' }], // po insert
          [{ id: 'poi-1' }] // poitem insert
        ],
        [[{ id: 'inv-1' }]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateInventoryItem('inv-1', {
        supplierId: 'sup-1',
        shippingCost: '100000',
      });
      expect(res.success).toBe(true);
    });

    it('thành công hủy liên kết PO khi supplierId rỗng', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'inv-1', purchaseOrderItemId: 'poi-1', costPrice: '10000000', status: 'in_stock' }],
          [{ id: 'profile-1' }]
        ],
        [],
        [[{ id: 'inv-1', purchaseOrderItemId: null }]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateInventoryItem('inv-1', {
        supplierId: '',
      });
      expect(res.success).toBe(true);
    });

    it('thành công cập nhật tự động gán nhà cung cấp mặc định đã tồn tại khi không truyền supplierId', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'inv-1', purchaseOrderItemId: null, costPrice: '10000000', status: 'incoming' }],
          [{ id: 'profile-1' }],
          [{ id: 'sup-existing' }] // defaultSuppliers exist
        ],
        [
          [{ id: 'po-1' }],
          [{ id: 'poi-1' }]
        ],
        [[{ id: 'inv-1' }]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateInventoryItem('inv-1', {
        trackingNumber: 'TRACK-1',
        shippingMethod: 'sea'
      });
      expect(res.success).toBe(true);
    });

    it('thành công cập nhật tự động tạo mới nhà cung cấp mặc định khi không truyền supplierId', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'inv-1', purchaseOrderItemId: null, costPrice: '10000000', status: 'incoming' }],
          [{ id: 'profile-1' }],
          [] // defaultSuppliers empty
        ],
        [
          [{ id: 'sup-new' }], // supplier insert
          [{ id: 'po-1' }],
          [{ id: 'poi-1' }]
        ],
        [[{ id: 'inv-1' }]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));

      const res = await updateInventoryItem('inv-1', {
        trackingNumber: 'TRACK-1',
        shippingMethod: 'sea'
      });
      expect(res.success).toBe(true);
    });

    it('xử lý lỗi catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Update failed'));
      const res = await updateInventoryItem('inv-1', {});
      expect(res.success).toBe(false);
    });
  });

  describe('softDelete / restore / delete / movements', () => {
    it('softDeleteInventoryItem thành công', async () => {
      const txMock = createTxMock(
        [[{ id: 'inv-1', status: 'in_stock' }], [{ id: 'profile-1' }]],
        [],
        [[{ id: 'inv-1', status: 'deleted' }]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await softDeleteInventoryItem('inv-1');
      expect(res.success).toBe(true);
    });



    it('restoreInventoryItem thành công', async () => {
      const txMock = createTxMock(
        [[{ id: 'inv-1', status: 'deleted' }], [{ id: 'profile-1' }]],
        [],
        [[{ id: 'inv-1', status: 'in_stock' }]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await restoreInventoryItem('inv-1');
      expect(res.success).toBe(true);
    });



    it('deleteInventoryItem thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([])); // delete movements
      mockDb.then.mockImplementationOnce((resolve) => resolve([])); // delete item
      const res = await deleteInventoryItem('inv-1');
      expect(res.success).toBe(true);
    });

    it('delete catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Delete failed')));
      const res = await deleteInventoryItem('inv-1');
      expect(res.success).toBe(false);
    });

    it('getInventoryItemMovements thành công', async () => {
      mockDb.then.mockImplementationOnce((resolve) => resolve([{ id: 'm-1' }]));
      const res = await getInventoryItemMovements('inv-1');
      expect(res.length).toBe(1);
    });

    it('getInventoryItemMovements catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve, reject) => reject(new Error('Movements failed')));
      const res = await getInventoryItemMovements('inv-1');
      expect(res).toEqual([]);
    });
  });

  describe('clearAllSystemData', () => {
    it('thành công xóa sạch', async () => {
      const txMock = createTxMock([], [], [[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await clearAllSystemData();
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Clear failed'));
      const res = await clearAllSystemData();
      expect(res.success).toBe(false);
    });
  });

  describe('bulkConfirmArrival', () => {
    it('trả về lỗi nếu ids rỗng', async () => {
      const res = await bulkConfirmArrival([]);
      expect(res.success).toBe(false);
    });

    it('trả về lỗi nếu profile rỗng', async () => {
      const txMock = createTxMock([[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await bulkConfirmArrival(['inv-1']);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Hệ thống chưa có tài khoản nhân viên');
    });

    it('thành công confirm hàng về', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'profile-1' }],
          [{ id: 'inv-1', status: 'incoming' }] // existing check
        ],
        [],
        [[]] // update return
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await bulkConfirmArrival(['inv-1']);
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Bulk confirm failed'));
      const res = await bulkConfirmArrival(['inv-1']);
      expect(res.success).toBe(false);
    });
  });

  describe('bulkDeleteInventoryItems', () => {
    it('trả về lỗi nếu ids rỗng', async () => {
      const res = await bulkDeleteInventoryItems([]);
      expect(res.success).toBe(false);
    });

    it('trả về lỗi nếu profile rỗng', async () => {
      const txMock = createTxMock([[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await bulkDeleteInventoryItems(['inv-1'], false);
      expect(res.success).toBe(false);
    });

    it('thành công soft delete hàng loạt', async () => {
      const txMock = createTxMock(
        [
          [{ id: 'profile-1' }],
          [{ id: 'inv-1', status: 'in_stock' }]
        ],
        [],
        [[]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await bulkDeleteInventoryItems(['inv-1'], false);
      expect(res.success).toBe(true);
    });

    it('thành công hard delete hàng loạt', async () => {
      const txMock = createTxMock([[{ id: 'profile-1' }]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await bulkDeleteInventoryItems(['inv-1'], true);
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Bulk delete failed'));
      const res = await bulkDeleteInventoryItems(['inv-1']);
      expect(res.success).toBe(false);
    });
  });

  describe('getInventoryItemLifecycle', () => {
    it('lỗi serial rỗng', async () => {
      const res = await getInventoryItemLifecycle('');
      expect(res.success).toBe(false);
    });

    it('lỗi không tìm thấy máy', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const res = await getInventoryItemLifecycle('SN-none');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không tìm thấy thiết bị nào');
    });

    it('thành công dựng timeline milestones', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: 'inv-1',
        serialNumber: 'SN-1',
        condition: 'new',
        status: 'in_stock',
        costPrice: '10000000',
        stockedDate: '2026-06-01',
        createdAt: new Date('2026-06-01T00:00:00Z'),
      }]);

      let thenCallCount = 0;
      mockDb.then.mockImplementation((onfulfilled) => {
        thenCallCount++;
        if (thenCallCount === 1) {
          // movements
          return Promise.resolve([
            { id: 'm-1', movementType: 'adjusted', performedAt: '2026-06-02', performedByName: 'Staff', notes: 'test notes' },
            { id: 'm-2', movementType: 'warranty_in', performedAt: '2026-06-03', notes: null }
          ]).then(onfulfilled);
        } else if (thenCallCount === 2) {
          // sales
          return Promise.resolve([{ orderItemId: 'oi-1', orderNumber: 'ORD-001', sellingPrice: '12000000', createdAt: '2026-06-04', customerName: 'A' }]).then(onfulfilled);
        } else if (thenCallCount === 3) {
          // warranties
          return Promise.resolve([{ id: 'w-1', claimNumber: 'WAR-01', receivedDate: '2026-06-05', customerName: 'A', repairCost: '200000' }]).then(onfulfilled);
        } else if (thenCallCount === 4) {
          // returnsList
          return Promise.resolve([{ returnItemId: 'ri-1', returnNumber: 'RET-01', type: 'return', conditionOnReturn: 'like_new', createdAt: '2026-06-06', customerName: 'A' }]).then(onfulfilled);
        } else {
          // replacementForList
          return Promise.resolve([{ returnItemId: 'ri-2', returnNumber: 'RET-02', type: 'exchange', oldItemSerial: 'SN-old', createdAt: '2026-06-07', customerName: 'A' }]).then(onfulfilled);
        }
      });

      const res = await getInventoryItemLifecycle('SN-1');
      expect(res.success).toBe(true);
      expect(res.milestones?.length).toBe(7);
    });

    it('catch block', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('Lifecycle failed'));
      const res = await getInventoryItemLifecycle('SN-1');
      expect(res.success).toBe(false);
    });
  });

  describe('reportItemDefectiveAction', () => {
    it('báo lỗi không tìm thấy máy', async () => {
      const txMock = createTxMock([[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await reportItemDefectiveAction('inv-1', 'loi');
      expect(res.success).toBe(false);
    });

    it('báo lỗi máy đã xóa', async () => {
      const txMock = createTxMock([[{ id: 'inv-1', status: 'deleted' }]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await reportItemDefectiveAction('inv-1', 'loi');
      expect(res.success).toBe(false);
      expect(res.message).toContain('đã bị xóa');
    });

    it('thành công', async () => {
      const txMock = createTxMock(
        [[{ id: 'inv-1', status: 'in_stock' }], [{ id: 'profile-1' }]],
        [],
        [[]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await reportItemDefectiveAction('inv-1', 'loi');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Defective failed'));
      const res = await reportItemDefectiveAction('inv-1', 'loi');
      expect(res.success).toBe(false);
    });
  });

  describe('sendToRepairAction', () => {
    it('báo lỗi không tìm thấy máy', async () => {
      const txMock = createTxMock([[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await sendToRepairAction('inv-1', 'internal');
      expect(res.success).toBe(false);
    });

    it('báo lỗi máy không ở trạng thái defective', async () => {
      const txMock = createTxMock([[{ id: 'inv-1', status: 'in_stock' }]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await sendToRepairAction('inv-1', 'internal');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Chỉ được gửi đi sửa');
    });

    it('thành công', async () => {
      const txMock = createTxMock(
        [[{ id: 'inv-1', status: 'defective' }], [{ id: 'profile-1' }]],
        [],
        [[]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await sendToRepairAction('inv-1', 'internal', undefined, 'loi');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Repair failed'));
      const res = await sendToRepairAction('inv-1', 'internal');
      expect(res.success).toBe(false);
    });
  });

  describe('completeRepairAction', () => {
    it('báo lỗi không tìm thấy máy', async () => {
      const txMock = createTxMock([[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await completeRepairAction('inv-1', '0');
      expect(res.success).toBe(false);
    });

    it('báo lỗi máy không ở trạng thái warranty_repair', async () => {
      const txMock = createTxMock([[{ id: 'inv-1', status: 'in_stock' }]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await completeRepairAction('inv-1', '0');
      expect(res.success).toBe(false);
    });

    it('thành công có chi phí sửa chữa', async () => {
      const txMock = createTxMock(
        [[{ id: 'inv-1', status: 'warranty_repair', serialNumber: 'SN-1' }], [{ id: 'profile-1' }]],
        [[]], // cashbook insert
        [[]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await completeRepairAction('inv-1', '200000', 'cash');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Complete failed'));
      const res = await completeRepairAction('inv-1', '0');
      expect(res.success).toBe(false);
    });
  });

  describe('supplierRefundAction', () => {
    it('báo lỗi không tìm thấy máy', async () => {
      const txMock = createTxMock([[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await supplierRefundAction('inv-1', '0');
      expect(res.success).toBe(false);
    });

    it('báo lỗi máy không ở trạng thái lỗi/sửa chữa', async () => {
      const txMock = createTxMock([[{ id: 'inv-1', status: 'in_stock' }]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await supplierRefundAction('inv-1', '0');
      expect(res.success).toBe(false);
    });

    it('thành công có hoàn tiền NCC', async () => {
      const txMock = createTxMock(
        [[{ id: 'inv-1', status: 'defective', serialNumber: 'SN-1' }], [{ id: 'profile-1' }]],
        [[]], // cashbook insert
        [[]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await supplierRefundAction('inv-1', '10000000', 'bank_transfer', 'refund');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Refund failed'));
      const res = await supplierRefundAction('inv-1', '0');
      expect(res.success).toBe(false);
    });
  });

  describe('supplierReturnWriteOffAction', () => {
    it('báo lỗi không tìm thấy máy', async () => {
      const txMock = createTxMock([[]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await supplierReturnWriteOffAction('inv-1');
      expect(res.success).toBe(false);
    });

    it('báo lỗi máy không ở trạng thái lỗi/sửa chữa', async () => {
      const txMock = createTxMock([[{ id: 'inv-1', status: 'in_stock' }]]);
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await supplierReturnWriteOffAction('inv-1');
      expect(res.success).toBe(false);
    });

    it('thành công', async () => {
      const txMock = createTxMock(
        [[{ id: 'inv-1', status: 'defective' }], [{ id: 'profile-1' }]],
        [],
        [[]]
      );
      vi.mocked(db.transaction).mockImplementationOnce((cb) => cb(txMock));
      const res = await supplierReturnWriteOffAction('inv-1');
      expect(res.success).toBe(true);
    });

    it('catch block', async () => {
      vi.mocked(db.transaction).mockRejectedValueOnce(new Error('Writeoff failed'));
      const res = await supplierReturnWriteOffAction('inv-1');
      expect(res.success).toBe(false);
    });
  });

  describe('getInventoryCapitalSummary', () => {
    it('thành công tính toán vốn tồn kho và cơ cấu', async () => {
      let queryIndex = 0;
      mockDb.then.mockImplementation((onfulfilled) => {
        queryIndex++;
        if (queryIndex === 1) {
          // Machine Stats
          return Promise.resolve([{ count: 10, totalCost: 150000000 }]).then(onfulfilled);
        } else if (queryIndex === 2) {
          // Accessory Stats
          return Promise.resolve([{ count: 5, totalCost: 10000000 }]).then(onfulfilled);
        } else if (queryIndex === 3) {
          // Category Stats
          return Promise.resolve([
            { categoryId: 'cat-1', categoryName: 'Laptop', count: 8, totalCost: 120000000 },
            { categoryId: 'cat-2', categoryName: 'PC', count: 2, totalCost: 30000000 }
          ]).then(onfulfilled);
        } else {
          // Accessory Catalog Stats
          return Promise.resolve([
            { catalogId: 'acc-1', catalogName: 'RAM', count: 5, totalCost: 10000000 }
          ]).then(onfulfilled);
        }
      });

      const res = await getInventoryCapitalSummary();
      expect(res.totalCapital).toBe(160000000);
      expect(res.machineCapital.totalCost).toBe(150000000);
      expect(res.machineCapital.count).toBe(10);
      expect(res.accessoryCapital.totalCost).toBe(10000000);
      expect(res.accessoryCapital.count).toBe(5);
      expect(res.machineCategoryStats.length).toBe(2);
      expect(res.accessoryCatalogStats.length).toBe(1);
    });

    it('catch block', async () => {
      mockDb.then.mockImplementationOnce((resolve: any, reject: any) => {
        return Promise.reject(new Error('DB Query failed')).catch(reject);
      });
      const res = await getInventoryCapitalSummary();
      expect(res.totalCapital).toBe(0);
      expect(res.machineCapital.totalCost).toBe(0);
    });
  });
});
