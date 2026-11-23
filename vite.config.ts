import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: mode === 'cloud' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') } : {},
  server: {
    port: Number(process.env.WEB_PORT ?? 5173), strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.PORT ?? process.env.API_PORT ?? 3000}`, changeOrigin: true } },
  },
}));
