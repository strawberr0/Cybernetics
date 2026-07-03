import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@arqon/global-ux'],
  },
  server: {
    port: parseInt(process.env.PORT || '4000', 10),
    host: true,
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
})
