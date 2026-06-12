import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/k-rider/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        en: resolve(import.meta.dirname, 'en.html'), // 英文 OG 入口（國外社群分享用）
      },
    },
  },
});
