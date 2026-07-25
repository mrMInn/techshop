-- 1. Tạo Index cho ngày tạo đơn hàng để tối ưu hóa truy vấn doanh thu/lợi nhuận theo ngày/tháng
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);

-- 2. Tạo Index cho ngày phát sinh chi phí vận hành
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses (expense_date);

-- 3. Tạo Index cho ngày hoàn thành phiếu trả hàng
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns (created_at);

-- 4. Tạo Index cho ngày tiếp nhận phiếu bảo hành
CREATE INDEX IF NOT EXISTS idx_warranty_claims_created_at ON warranty_claims (created_at);
