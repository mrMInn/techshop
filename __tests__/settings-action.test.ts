import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getSystemSettings, 
  saveSystemSettings, 
  testTelegramConnectionAction 
} from '@/app/actions/settings';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

describe('Server Actions - Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('getSystemSettings', () => {
    it('should return null settings if telegram settings table is empty', async () => {
      (db.execute as any).mockResolvedValue(true);
      
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getSystemSettings();
      expect(res.settings).toBeNull();
      expect(res.events).toEqual([]);
    });

    it('should return settings and matched events if present', async () => {
      (db.execute as any).mockResolvedValue(true);
      
      const mockSettings = { id: 'setting-1', botToken: 'abc', chatId: '123' };
      const mockEvents = [{ id: 'ev-1', eventType: 'order_created', isEnabled: true }];
      
      const mockLimit = vi.fn().mockResolvedValue([mockSettings]);
      const mockWhere = vi.fn().mockResolvedValue(mockEvents);
      
      const mockFromSettings = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFromEvents = vi.fn().mockReturnValue({ where: mockWhere });
      
      (db.select as any)
        .mockReturnValueOnce({ from: mockFromSettings })
        .mockReturnValueOnce({ from: mockFromEvents });

      const res = await getSystemSettings();
      expect(res.settings).toEqual(mockSettings);
      expect(res.events).toEqual(mockEvents);
    });

    it('should return empty settings on database select failure', async () => {
      (db.execute as any).mockResolvedValue(true);
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Database select error');
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getSystemSettings();
      expect(res.settings).toBeNull();
      expect(res.events).toEqual([]);
    });

    it('should catch error when ensureDbSchema execution fails', async () => {
      (db.execute as any).mockRejectedValue(new Error('Alter blocked'));
      
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const res = await getSystemSettings();
      expect(res.settings).toBeNull();
    });
  });

  describe('saveSystemSettings', () => {
    it('should save/update settings successfully in transaction', async () => {
      (db.execute as any).mockResolvedValue(true);
      
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const mockChain = (resolved: any) => {
          const obj: any = {
            where: vi.fn().mockImplementation(() => obj),
            limit: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
            then: vi.fn().mockImplementation((cbFn: any) => Promise.resolve(resolved).then(cbFn)),
          };
          return obj;
        };

        const mockTx = {
          select: vi.fn().mockImplementation(() => {
            return {
              from: vi.fn().mockImplementation(() => {
                const callCount = mockTx.select.mock.calls.length;
                const resolved = callCount === 1 
                  ? [{ id: 'profile-1' }]
                  : callCount === 2
                    ? [{ id: 'setting-1' }]
                    : [{ id: 'event-rule-1' }];
                return mockChain(resolved);
              })
            };
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(true)
            })
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'setting-1' }])
            })
          })
        };
        return cb(mockTx);
      });

      const res = await saveSystemSettings({
        botToken: 'abc',
        chatId: '123',
        isActive: true,
        events: [
          { eventType: 'order_created', isEnabled: true }
        ]
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('thành công');
    });

    it('should insert settings and events when they do not exist', async () => {
      (db.execute as any).mockResolvedValue(true);
      
      (db.transaction as any).mockImplementation(async (cb: any) => {
        const mockChain = (resolved: any) => {
          const obj: any = {
            where: vi.fn().mockImplementation(() => obj),
            limit: vi.fn().mockImplementation(() => Promise.resolve(resolved)),
            then: vi.fn().mockImplementation((cbFn: any) => Promise.resolve(resolved).then(cbFn)),
          };
          return obj;
        };

        const mockTx = {
          select: vi.fn().mockImplementation(() => {
            return {
              from: vi.fn().mockImplementation(() => {
                const callCount = mockTx.select.mock.calls.length;
                const resolved = callCount === 1 ? [{ id: 'profile-1' }] : [];
                return mockChain(resolved);
              })
            };
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(true)
            })
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'setting-new' }])
            })
          })
        };
        return cb(mockTx);
      });

      const res = await saveSystemSettings({
        botToken: 'abc',
        chatId: '123',
        isActive: true,
        events: [
          { eventType: 'order_created', isEnabled: true }
        ]
      });

      expect(res.success).toBe(true);
    });

    it('should return error response when transaction fails', async () => {
      (db.execute as any).mockResolvedValue(true);
      (db.transaction as any).mockImplementation(async () => {
        throw new Error('Transaction aborted');
      });

      const res = await saveSystemSettings({
        botToken: 'abc',
        chatId: '123',
        isActive: true,
        events: []
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('Transaction aborted');
    });
  });

  describe('testTelegramConnectionAction', () => {
    it('should return error if botToken or chatId is empty', async () => {
      const res = await testTelegramConnectionAction('', '  ');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Bot Token và Chat ID');
    });

    it('should report success if Telegram response is ok', async () => {
      const mockFetchResponse = {
        ok: true,
        json: async () => ({ ok: true })
      };
      (global.fetch as any).mockResolvedValue(mockFetchResponse);

      const res = await testTelegramConnectionAction('token123', 'chat123');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Kết nối thành công');
    });

    it('should report failure if Telegram response is not ok', async () => {
      const mockFetchResponse = {
        ok: false,
        json: async () => ({ ok: false, description: 'Unauthorized' })
      };
      (global.fetch as any).mockResolvedValue(mockFetchResponse);

      const res = await testTelegramConnectionAction('token123', 'chat123');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Unauthorized');
    });

    it('should report failure on network fetch exception', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network disconnected'));

      const res = await testTelegramConnectionAction('token123', 'chat123');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Network disconnected');
    });
  });
});
