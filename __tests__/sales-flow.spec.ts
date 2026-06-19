import { test, expect } from '@playwright/test';

// Mày đổi URL này thành localhost của dự án lúc chạy dev
const BASE_URL = 'http://localhost:3000'; 

test.describe('Luồng Nghiệp Vụ Bán Hàng', () => {
  
  test('Nhân viên phải đăng nhập và thấy được danh sách kho hàng', async ({ page }) => {
    // 1. Vào trang đăng nhập
    await page.goto(`${BASE_URL}/login`);

    // 2. Điền form đăng nhập (Giả định mày dùng Supabase Auth với Email/Password)
    await page.fill('input[name="email"]', 'admin@techstore.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 3. Đợi chuyển hướng sang Dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`);
    expect(page.url()).toBe(`${BASE_URL}/dashboard`);

    // 4. Click vào menu Kho hàng (Inventory) ở Sidebar
    await page.click('text="Kho Hàng"'); // Hoặc dùng locator('a[href="/dashboard/inventory"]')
    await page.waitForURL(`${BASE_URL}/dashboard/inventory`);

    // 5. Tìm kiếm một máy theo Serial Number
    const searchInput = page.locator('input[placeholder="Tìm kiếm Serial, Model..."]');
    await searchInput.fill('SN-MACBOOK-001');
    
    // Đợi UI lọc data (có thể thêm thời gian chờ mạng nếu cần)
    await page.waitForTimeout(1000); 

    // 6. Kiểm tra xem màn hình có hiển thị chữ "Sẵn hàng" (in_stock) không
    const statusBadge = page.locator('span:has-text("Sẵn hàng")').first();
    await expect(statusBadge).toBeVisible();
  });

});