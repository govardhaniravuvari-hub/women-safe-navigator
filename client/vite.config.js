import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const extraHosts = (process.env.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 3000),
    strictPort: false,
    allowedHosts: extraHosts.length ? extraHosts : undefined,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000' },
      '/uploads': { target: 'http://127.0.0.1:4000' },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
