// vite.config.mjs
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 300
    },
    hmr: true
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  },
  resolve: {
    preserveSymlinks: true
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
})
