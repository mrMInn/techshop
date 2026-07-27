-- Dashboard Performance Composite Indexes
-- These indexes optimize the most common dashboard queries that filter by (status + date range)

-- 1. Cash book entries: filter by date + group by type (getFinancialSummary chart data)
CREATE INDEX IF NOT EXISTS idx_cashbook_date_type
  ON cash_book_entries (entry_date, type);

-- 2. Orders: filter by status + created_at range (getDashboardBentoData monthly/today counts)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders (status, created_at);

-- 3. Inventory items: filter by status + stocked_date (getAgedInventoryItems)
CREATE INDEX IF NOT EXISTS idx_inventory_status_stocked
  ON inventory_items (status, stocked_date);

-- 4. Returns: filter by status + created_at (getDashboardBentoData returns stats)
CREATE INDEX IF NOT EXISTS idx_returns_status_created
  ON returns (status, created_at);

-- 5. Warranty claims: filter by status + created_at (getDashboardBentoData warranty stats)
CREATE INDEX IF NOT EXISTS idx_warranty_status_created
  ON warranty_claims (status, created_at);
