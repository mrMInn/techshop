-- 1. Tạo Index cho trạng thái thanh toán và kênh bán hàng của đơn hàng
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_sale_channel ON orders (sale_channel);

-- 2. Tạo Index cho tên và SĐT của khách hàng phục vụ tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_customers_full_name ON customers (full_name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
