import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'honest-lands-clean.loca.lt', // Твой текущий хост
    ],
    host: true,
    allowedHosts: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});