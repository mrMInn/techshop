import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getCountriesList,
  createCountry,
  updateCountry,
  deleteCountry,
  getCarriersList,
  createCarrier,
  updateCarrier,
  deleteCarrier
} from '@/app/actions/shipping-countries';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Server Actions - Shipping & Countries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Countries', () => {
    describe('getCountriesList', () => {
      it('should list all countries sorted by name', async () => {
        const mockResult = [{ id: 'c-1', code: 'US', name: 'Mỹ', isActive: true }];
        const mockOrderBy = vi.fn().mockResolvedValue(mockResult);
        const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        (db.select as any).mockReturnValue({ from: mockFrom });

        const res = await getCountriesList();
        expect(res).toEqual(mockResult);
      });

      it('should return empty array on failure', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error('Fetch error'))
        });
        (db.select as any).mockReturnValue({ from: mockFrom });

        const res = await getCountriesList();
        expect(res).toEqual([]);
      });
    });

    describe('createCountry', () => {
      it('should insert new country successfully', async () => {
        const mockCountry = { id: 'c-1', code: 'US', name: 'Mỹ', isActive: true };
        const mockReturning = vi.fn().mockResolvedValue([mockCountry]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        (db.insert as any).mockReturnValue({ values: mockValues });

        const res = await createCountry({ code: 'us', name: 'Mỹ' });
        expect(res.success).toBe(true);
        expect(res.data).toEqual(mockCountry);
      });

      it('should handle unique violation error code 23505', async () => {
        const error = new Error('duplicate key');
        (error as any).code = '23505';
        const mockReturning = vi.fn().mockRejectedValue(error);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        (db.insert as any).mockReturnValue({ values: mockValues });

        const res = await createCountry({ code: 'us', name: 'Mỹ' });
        expect(res.success).toBe(false);
        expect(res.message).toContain('đã tồn tại');
      });
    });

    describe('updateCountry', () => {
      it('should update country successfully', async () => {
        const mockCountry = { id: 'c-1', code: 'US', name: 'Mỹ Tho' };
        const mockReturning = vi.fn().mockResolvedValue([mockCountry]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        (db.update as any).mockReturnValue({ set: mockSet });

        const res = await updateCountry('c-1', { code: 'US', name: 'Mỹ Tho' });
        expect(res.success).toBe(true);
        expect(res.data).toEqual(mockCountry);
      });
    });

    describe('deleteCountry', () => {
      it('should block deletion if country is used in inventory items', async () => {
        // Mock finding the country
        const mockLimit1 = vi.fn().mockResolvedValue([{ id: 'c-1', code: 'US' }]);
        const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
        const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
        
        // Mock checking inventory items
        const mockLimit2 = vi.fn().mockResolvedValue([{ id: 'inv-1' }]);
        const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

        (db.select as any)
          .mockReturnValueOnce({ from: mockFrom1 }) // first select to find country
          .mockReturnValueOnce({ from: mockFrom2 }); // second select to check inventory

        const res = await deleteCountry('c-1');
        expect(res.success).toBe(false);
        expect(res.message).toContain('đang liên kết');
      });

      it('should delete country if not used', async () => {
        // Mock finding the country
        const mockLimit1 = vi.fn().mockResolvedValue([{ id: 'c-1', code: 'US' }]);
        const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
        const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
        
        // Mock checking inventory items
        const mockLimit2 = vi.fn().mockResolvedValue([]);
        const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

        // Mock checking POs
        const mockLimit3 = vi.fn().mockResolvedValue([]);
        const mockWhere3 = vi.fn().mockReturnValue({ limit: mockLimit3 });
        const mockFrom3 = vi.fn().mockReturnValue({ where: mockWhere3 });

        // Mock delete
        const mockWhereDelete = vi.fn().mockResolvedValue(true);

        (db.select as any)
          .mockReturnValueOnce({ from: mockFrom1 })
          .mockReturnValueOnce({ from: mockFrom2 })
          .mockReturnValueOnce({ from: mockFrom3 });
        (db.delete as any).mockReturnValue({ where: mockWhereDelete });

        const res = await deleteCountry('c-1');
        expect(res.success).toBe(true);
        expect(db.delete).toHaveBeenCalled();
      });
    });
  });

  describe('Carriers', () => {
    describe('getCarriersList', () => {
      it('should list all carriers sorted by name', async () => {
        const mockResult = [{ id: 'ca-1', code: 'UPS', name: 'UPS', isActive: true }];
        const mockOrderBy = vi.fn().mockResolvedValue(mockResult);
        const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        (db.select as any).mockReturnValue({ from: mockFrom });

        const res = await getCarriersList();
        expect(res).toEqual(mockResult);
      });
    });

    describe('createCarrier', () => {
      it('should insert carrier successfully', async () => {
        const mockCarrier = { id: 'ca-1', code: 'UPS', name: 'UPS', isActive: true };
        const mockReturning = vi.fn().mockResolvedValue([mockCarrier]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        (db.insert as any).mockReturnValue({ values: mockValues });

        const res = await createCarrier({ code: 'UPS', name: 'UPS' });
        expect(res.success).toBe(true);
        expect(res.data).toEqual(mockCarrier);
      });
    });
  });
});
