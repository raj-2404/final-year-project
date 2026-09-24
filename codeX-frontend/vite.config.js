import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  clearScreen: false,
  define: {
    global: 'window',
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:5010',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'http://localhost:5010',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
