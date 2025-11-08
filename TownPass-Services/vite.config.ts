import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // 讓伺服器監聽所有網路介面
    port: 5173,
    proxy: {
      // 當前端請求 /api 時，將請求代理到目標 API 伺服器
      // 假設目標 API 是 https://booking-tpsc.sporetrofit.com/
      '/api': {
        target: 'https://booking-tpsc.sporetrofit.com',
        changeOrigin: true, // 必須設置為 true
        rewrite: (path) => path.replace(/^\/api/, '') // 將 /api 從路徑中移除
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
