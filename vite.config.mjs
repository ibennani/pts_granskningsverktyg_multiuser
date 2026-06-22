// vite.config.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { inject_dist_build_metadata } from './scripts/inject_dist_build_metadata.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const IGNORABLE_WS_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNABORTED'
])

const IGNORABLE_WS_ERROR_MESSAGES = [
  'read ECONNRESET',
  'write EPIPE',
  'socket hang up',
  'connect ECONNREFUSED',
  'WebSocket was closed before the connection was established'
]

function is_ignorable_ws_error (err) {
  if (!err) return true
  if (IGNORABLE_WS_ERROR_CODES.has(err.code)) return true
  if (err.message && IGNORABLE_WS_ERROR_MESSAGES.some(
    (msg) => err.message.includes(msg)
  )) return true
  if (err.name === 'AggregateError' && Array.isArray(err.errors)) {
    return err.errors.every((e) => is_ignorable_ws_error(e))
  }
  return false
}

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

/** Måste köras i `closeBundle` före vite-plugin-pwa så att precache av `index.html` matchar filen på disk. */
function inject_dist_metadata_before_pwa () {
  return {
    name: 'inject-dist-build-metadata-before-pwa',
    apply: 'build',
    closeBundle: {
      order: 'pre',
      handler () {
        inject_dist_build_metadata(join(__dirname, 'dist'))
      }
    }
  }
}

export default defineConfig({
  base: '/v2/',
  plugins: [
    redirect_base_without_trailing_slash(),
    inject_dist_metadata_before_pwa(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: false,
      workbox: {
        // `index.html` måste precachas: navigateFallback använder createHandlerBoundToURL (annars non-precached-url).
        // Övrig HTML undviks; byggstämpel injiceras i closeBundle före PWA så revision stämmer.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2,woff}', 'index.html'],
        // build-info används för versionskontroll och ska alltid komma från nätverket (no-store i Nginx).
        globIgnores: ['**/build-info.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/v2\/api\//, /^\/v2\/ws/],
        maximumFileSizeToCacheInBytes: 6000000,
        runtimeCaching: [
          {
            // Navigering: aldrig cache i SW. NetworkFirst + timeout gav gamla index.html (t.ex. gammal
            // "Byggt …") vid långsam anslutning eller tills maxAge (1 h) löpt ut trots Ctrl+Shift+F5.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly'
          },
          {
            // Versionsfingeravtryck: ska aldrig fastna i SW-cache.
            urlPattern: /\/build-info\.js(\?.*)?$/,
            handler: 'NetworkOnly'
          }
        ]
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
            if (!is_ignorable_ws_error(err)) {
              console.warn('[vite] api proxy:', err?.message || err)
            }
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
            if (!is_ignorable_ws_error(err)) {
              console.warn('[vite] ws proxy:', err?.message || err)
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
    preserveSymlinks: true,
    /**
     * TypeScript rekommenderar import med .js-suffix mot .ts-källfiler.
     * Utan extensionAlias försöker dev-servern leverera den fysiska .js-filen → 404 om bara .ts finns.
     * Ordning: prova .ts/.tsx först, sedan riktig .js (så befintliga .js-moduler påverkas inte).
     */
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs']
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
})
