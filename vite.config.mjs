// vite.config.mjs
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/v2/',
  server: {
    port: 5173,
    strictPort: false,
    open: false,
    proxy: {
      '/v2/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/v2/, ''),
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'Backend ej tillgänglig' }));
            }
          });
        }
      },
      '/v2/ws': {
        target: 'http://localhost:3000',
        ws: true,
        rewrite: (path) => path.replace(/^\/v2/, ''),
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            const isConnectionRefused = (e) =>
              e?.code === 'ECONNREFUSED' || e?.code === 'ECONNRESET' ||
              (e?.message && String(e.message).includes('ECONNREFUSED'));
            const isIgnorable = isConnectionRefused(err) ||
              (err?.name === 'AggregateError' && err?.errors?.every?.(isConnectionRefused));
            if (!isIgnorable) {
              console.warn('[vite] ws proxy:', err?.message || err);
            }
          });
        }
      }
    },
    // build-info.js uppdateras av dev-build-info-watcher; ignorera så Vite inte omladdar hela appen vid varje skrivning.
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/build-info.js']
    },
    hmr: true
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
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
