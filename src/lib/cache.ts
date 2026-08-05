interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry>();

  get<T = any>(key: string): T | null {
    if (process.env.NODE_ENV === 'test') return null;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  del(key: string): void {
    this.cache.delete(key);
  }

  clearPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance across dev server hot reloads
declare global {
  // eslint-disable-next-line no-var
  var globalMemoryCache: MemoryCache | undefined;
}

export const serverCache = globalThis.globalMemoryCache || new MemoryCache();

if (process.env.NODE_ENV !== "production") {
  globalThis.globalMemoryCache = serverCache;
}

export function invalidateDashboardCache() {
  console.log("INVALIDATE CACHE: clearing dashboard, accounting, and reports cache");
  serverCache.clearPattern("dashboard_bento_stats");
  serverCache.clearPattern("financial_summary");
  serverCache.clearPattern("expenses_list");
  serverCache.clearPattern("income_statement");
  serverCache.clearPattern("cashflow_statement");
  serverCache.clearPattern("expense_categories");
  serverCache.clearPattern("warranty_claims_select");
  serverCache.clearPattern("aged_inventory_items");
  serverCache.clearPattern("inventory_capital_summary");
  serverCache.clearPattern("orders_overall_stats");
}
