import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// App is served from https://unizova.com/cafebilling/
export default defineConfig({
  base: '/cafebilling/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/cafebilling/api': { target: 'http://localhost:5000', rewrite: (p) => p.replace(/^\/cafebilling/, '') },
    },
  },
});
