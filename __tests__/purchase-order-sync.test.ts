import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePurchaseOrderAction } from '@/app/actions/purchase-orders';
import { db, recalculateRunningBalances } from '@/lib/db';
import { purchaseOrders, purchaseOrderItems, inventoryItems, cashBookEntries, profiles } from '@/lib/db/schema';

vi.mock('next/server', () => ({
  after: vi.fn((cb) => cb()),
}));

vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn(),
  },
  recalculateRunningBalances: vi.fn().mockResolvedValue(true),
}));

const createTxMock = (
  selectResponses: any[], 
  insertResponses: any[] = [], 
  updateResponses: any[] = []
) => {
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

describe('updatePurchaseOrderAction - Cash Book Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sync and create a cash book entry when PO status becomes received and totalCost > 0', async () => {
    const mockPO = {
      id: 'po-1',
      poNumber: 'PO-20260624-XXXX',
      status: 'in_transit',
      totalCost: '1500.00',
      shippingCost: '100.00',
      createdBy: 'user-1',
    };

    const mockPOItems = [
      { id: 'poi-1', purchaseOrderId: 'po-1', totalCost: '1350.00' }
    ];

    // Queries inside transaction:
    // 1. tx.select().from(purchaseOrders) -> returns mockPO
    // 2. tx.select().from(purchaseOrderItems) -> returns mockPOItems
    // 3. tx.select().from(cashBookEntries) -> returns empty [] (no existing cash entry)
    const txMock = createTxMock(
      [
        [mockPO],       // existing PO
        mockPOItems,    // po items
        []              // existingCashEntry
      ],
      [
        []              // insert cashBookEntries response
      ],
      [
        [{ ...mockPO, status: 'received', totalCost: '1500.00' }], // update purchaseOrders returning
        [] // update inventoryItems returning
      ]
    );

    vi.mocked(db.transaction).mockImplementation((cb: any) => cb(txMock));

    const res = await updatePurchaseOrderAction('po-1', {
      status: 'received',
      shippingCost: '100.00',
    });

    expect(res.success).toBe(true);
    expect(txMock.update).toHaveBeenCalledWith(purchaseOrders);
    expect(txMock.insert).toHaveBeenCalledWith(cashBookEntries);
    expect(recalculateRunningBalances).toHaveBeenCalledWith(txMock);
  });

  it('should update existing cash book entry if PO cost is updated while received', async () => {
    const mockPO = {
      id: 'po-1',
      poNumber: 'PO-20260624-XXXX',
      status: 'received',
      totalCost: '1500.00',
      shippingCost: '100.00',
      createdBy: 'user-1',
    };

    const mockPOItems = [
      { id: 'poi-1', purchaseOrderId: 'po-1', totalCost: '1350.00' }
    ];

    const mockCashEntry = {
      id: 'cb-1',
      entryNumber: 'CB20260624-RAND',
      amount: '1500.00',
    };

    // Queries inside transaction:
    // 1. tx.select().from(purchaseOrders) -> returns mockPO
    // 2. tx.select().from(purchaseOrderItems) -> returns mockPOItems
    // 3. tx.select().from(cashBookEntries) -> returns existing cash entry [mockCashEntry]
    const txMock = createTxMock(
      [
        [mockPO],       // existing PO
        mockPOItems,    // po items
        [mockCashEntry] // existingCashEntry
      ],
      [],
      [
        [{ ...mockPO, totalCost: '1600.00' }], // update purchaseOrders returning
        [], // update cashBookEntries returning
      ]
    );

    vi.mocked(db.transaction).mockImplementation((cb: any) => cb(txMock));

    const res = await updatePurchaseOrderAction('po-1', {
      shippingCost: '200.00',
    });

    expect(res.success).toBe(true);
    expect(txMock.update).toHaveBeenCalledWith(purchaseOrders);
    expect(txMock.update).toHaveBeenCalledWith(cashBookEntries);
    expect(recalculateRunningBalances).toHaveBeenCalledWith(txMock);
  });

  it('should delete cash book entry if PO status transitions from received to cancelled', async () => {
    const mockPO = {
      id: 'po-1',
      poNumber: 'PO-20260624-XXXX',
      status: 'received',
      totalCost: '1500.00',
      shippingCost: '100.00',
      createdBy: 'user-1',
    };

    const mockPOItems = [
      { id: 'poi-1', purchaseOrderId: 'po-1', totalCost: '1350.00' }
    ];

    const mockCashEntry = {
      id: 'cb-1',
      entryNumber: 'CB20260624-RAND',
      amount: '1500.00',
    };

    // Queries inside transaction:
    // 1. tx.select().from(purchaseOrders) -> returns mockPO
    // 2. tx.select().from(purchaseOrderItems) -> returns mockPOItems
    // 3. tx.select().from(cashBookEntries) -> returns existing cash entry [mockCashEntry]
    const txMock = createTxMock(
      [
        [mockPO],       // existing PO
        mockPOItems,    // po items
        [mockCashEntry] // existingCashEntry
      ],
      [],
      [
        [{ ...mockPO, status: 'cancelled' }], // update purchaseOrders returning
        [], // update inventoryItems status returning
      ]
    );

    vi.mocked(db.transaction).mockImplementation((cb: any) => cb(txMock));

    const res = await updatePurchaseOrderAction('po-1', {
      status: 'cancelled',
    });

    expect(res.success).toBe(true);
    expect(txMock.delete).toHaveBeenCalledWith(cashBookEntries);
    expect(recalculateRunningBalances).toHaveBeenCalledWith(txMock);
  });
});
