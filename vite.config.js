import { defineConfig } from 'vite';
export default defineConfig({
  root: '.',
  publicDir: 'lib',
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
});
