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
      '/api/TaipeiSportsCenter': {
        target: 'https://booking-tpsc.sporetrofit.com/Home/loadLocationPeopleNum',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/TaipeiSportsCenter/, '')
      },
      '/api/NanGangSportsCenter': {
        target: 'https://ngsc.cyc.org.tw/api/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/NanGangSportsCenter/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
