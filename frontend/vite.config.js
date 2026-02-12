import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // БАЗОВЫЙ ПУТЬ: Это самое важное.
  // Указывает Vite, что все ссылки в index.html должны начинаться с /app/
  base: '/app/',
  build: {
    outDir: 'dist',
    // Очищать папку перед каждой сборкой
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
