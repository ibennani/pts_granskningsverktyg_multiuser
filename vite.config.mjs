// vite.config.mjs
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Redirect /v2 → /v2/ så att index.html alltid laddas (annars 404 och tom sida utan fel i appens konsol). */
function redirect_base_without_trailing_slash() {
  return {
    name: 'redirect-base-without-trailing-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (url === '/v2' || url.startsWith('/v2?')) {
          const q = url.startsWith('/v2?') ? url.slice(3) : '/'
          res.statusCode = 302
          res.setHeader('Location', `/v2/${q === '/' ? '' : q}`)
          res.end()
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  base: '/v2/',
  plugins: [
    redirect_base_without_trailing_slash(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/v2\/api\//, /^\/v2\/ws/],
        maximumFileSizeToCacheInBytes: 6000000
      },
      devOptions: {
        enabled: false
      }
    })
  ],
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
