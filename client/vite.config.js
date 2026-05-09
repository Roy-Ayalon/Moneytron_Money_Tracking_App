import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '^/api/': { target: 'http://127.0.0.1:5003', changeOrigin: true },
      '/screenshots': { target: 'http://127.0.0.1:5003', changeOrigin: true },
      '/videos': { target: 'http://127.0.0.1:5003', changeOrigin: true },
    },
  },
})
