import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/telegram/webhook/route';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Helper tạo mock chain cho Drizzle ORM
const createMockChain = (resolvedValue: any) => {
  const chain: any = {
    where: vi.fn().mockImplementation(() => chain),
    orderBy: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
    innerJoin: vi.fn().mockImplementation(() => chain),
    returning: vi.fn().mockImplementation(() => Promise.resolve(resolvedValue)),
    values: vi.fn().mockImplementation(() => chain),
    set: vi.fn().mockImplementation(() => chain),
    groupBy: vi.fn().mockImplementation(() => chain),
    then: (resolve: any) => Promise.resolve(resolvedValue).then(resolve),
  };
  return chain;
};

describe('Telegram Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';
  });

  it('should return 200 and help text for /help command', async () => {
    const mockRequest = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 123 },
          message_id: 456,
          text: '/help',
        },
      }),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Handled help command');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('TechStore ERP Bot'),
      })
    );
  });

  it('should ignore message if no triggers or tags are present', async () => {
    const mockRequest = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 123 },
          message_id: 456,
          text: 'Hello world',
        },
      }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Ignored: No serial/quote tags or bot keywords');
  });

  it('should handle local keyword analysis for inventory stats', async () => {
    const mockStats = [{ status: 'in_stock', count: 10 }, { status: 'sold', count: 5 }];

    (db.select as any).mockImplementation(() => {
      return {
        from: vi.fn().mockImplementation(() => createMockChain(mockStats)),
        groupBy: vi.fn().mockImplementation(() => createMockChain(mockStats)),
      };
    });

    const mockRequest = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 123 },
          message_id: 456,
          text: 'bot ơi thống kê kho hàng giúp tôi',
        },
      }),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processed).toBe(true);
    expect(data.mode).toBe('local');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Thống kê Kho hàng (Cục bộ)')
      })
    );
  });

  it('should handle local financial analysis', async () => {
    const mockOrdersResult = [{ count: 2, totalAmount: 20000000, totalProfit: 5000000 }];
    const mockExpensesResult = [{ totalAmount: 1000000 }];

    let selectCallCount = 0;
    (db.select as any).mockImplementation(() => {
      selectCallCount++;
      return {
        from: vi.fn().mockImplementation(() => {
          if (selectCallCount === 1 || selectCallCount === 3) {
            return createMockChain(mockOrdersResult);
          } else {
            return createMockChain(mockExpensesResult);
          }
        }),
      };
    });

    const mockRequest = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 123 },
          message_id: 456,
          text: 'bot ơi doanh thu hôm nay thế nào',
        },
      }),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processed).toBe(true);
    expect(data.mode).toBe('local');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Báo cáo Tài chính Cửa hàng (Cục bộ)')
      })
    );
  });

  it('should handle local search analysis', async () => {
    const mockSearchItems = [
      {
        serialNumber: "SN-MACBOOK-001",
        productName: "MacBook Pro 16",
        status: "in_stock"
      }
    ];

    (db.select as any).mockImplementation(() => {
      return {
        from: vi.fn().mockImplementation(() => createMockChain(mockSearchItems)),
        innerJoin: vi.fn().mockImplementation(() => createMockChain(mockSearchItems)),
      };
    });

    const mockRequest = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 123 },
          message_id: 456,
          text: 'bot ơi tìm MacBook',
        },
      }),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processed).toBe(true);
    expect(data.mode).toBe('local');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('MacBook')
      })
    );
  });

  it('should handle local warranty lookup with serial', async () => {
    const mockInventoryItem = {
      id: 999,
      serialNumber: "SN-MACBOOK-001",
      productName: "MacBook Pro 16",
      warrantyStart: "2025-01-01T00:00:00.000Z",
      warrantyEnd: "2026-01-01T00:00:00.000Z",
      status: "in_stock"
    };
    const mockClaims = [
      {
        claimNumber: "CLAIM-001",
        status: "completed",
        issueDescription: "Màn hình sọc",
        receivedDate: "2025-06-01T00:00:00.000Z",
        actualReturnDate: "2025-06-05T00:00:00.000Z"
      }
    ];

    let selectCallCount = 0;
    (db.select as any).mockImplementation(() => {
      selectCallCount++;
      return {
        from: vi.fn().mockImplementation(() => {
          if (selectCallCount === 1) {
            return createMockChain([mockInventoryItem]);
          } else {
            return createMockChain(mockClaims);
          }
        })
      };
    });

    const mockRequest = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 123 },
          message_id: 456,
          text: 'bot ơi bảo hành SN-MACBOOK-001',
        },
      }),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processed).toBe(true);
    expect(data.mode).toBe('local');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Thông tin Bảo hành Thiết bị')
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Mã số: <code>CLAIM-001</code>')
      })
    );
  });

  it('should prompt user for serial number if warranty text lacks serial', async () => {
    const mockRequest = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 123 },
          message_id: 456,
          text: 'bot ơi kiểm tra bảo hành giúp',
        },
      }),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processed).toBe(true);
    expect(data.mode).toBe('local');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Vui lòng cung cấp mã Serial của máy')
      })
    );
  });

  it('should return default help text for unknown bot triggers', async () => {
    const mockRequest = new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 123 },
          message_id: 456,
          text: 'bot ơi cứu tôi',
        },
      }),
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processed).toBe(true);
    expect(data.mode).toBe('local');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Hỗ trợ TechStore ERP Bot')
      })
    );
  });
});
