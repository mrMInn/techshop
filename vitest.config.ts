import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node', // Môi trường node vì test Server Actions
    globals: true,       // Cho phép dùng describe, it, expect mà không cần import
    include: ['__tests__/**/*.test.ts'], // Chỉ chạy file .test.ts trong thư mục __tests__
    exclude: ['e2e/**', 'tests/**', 'node_modules/**'], // Bỏ qua nhà của Playwright
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});