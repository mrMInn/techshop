-- 1. Kích hoạt tiện ích mở rộng pg_trgm hỗ trợ tìm kiếm text nhanh hơn LIKE/ILIKE thông thường
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tạo GIN Index cho trường Tên Sản Phẩm (Hỗ trợ tìm kiếm nhanh gần đúng và không phân biệt hoa thường)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- 3. Tạo Index cho trường SKU sản phẩm (Tìm chính xác SKU)
CREATE INDEX IF NOT EXISTS idx_products_sku_lower ON products (LOWER(sku));

-- 4. Tạo Index cho trường tên Thương hiệu
CREATE INDEX IF NOT EXISTS idx_brands_name_lower ON brands (LOWER(name));

-- 5. Tạo Index cho trường Số Serial của máy lẻ (Trường quan trọng nhất khi nhân viên kho quét mã vạch)
CREATE INDEX IF NOT EXISTS idx_inventory_items_serial_lower ON inventory_items (LOWER(serial_number));
