// vite.config.mjs
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

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

/**
 * I dev: servera rotens gitignorerade `build-info.js` (från build-info-watchern) före statiska `public/`,
 * så att byggtid i sidfoten följer filändringar. Produktion använder fryst `public/build-info.js`.
 */
function dev_serve_root_build_info_first () {
  return {
    name: 'dev-serve-root-build-info-first',
    apply: 'serve',
    enforce: 'pre',
    configureServer (server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET') return next()
        const path_only = (req.url || '').split('?')[0]
        if (path_only !== '/v2/build-info.js' && path_only !== '/build-info.js') return next()
        const root_file = join(__dirname, 'build-info.js')
        if (existsSync(root_file)) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.end(readFileSync(root_file, 'utf8'))
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
    dev_serve_root_build_info_first(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: false,
      workbox: {
        // `index.html` måste precachas: navigateFallback använder createHandlerBoundToURL (annars non-precached-url).
        // Byggstämpel i produktion: fryst `public/build-info.js` (uppdateras med `npm run uppdatera:byggstämpel`).
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
