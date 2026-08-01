import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// package.json is the single source of truth for the app version; it's compiled
// into the bundle so the UI can display it (and users can quote it in bug reports).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' (not autoUpdate): a new build never swaps in silently. The app
      // shows an "Update available" badge and the user taps to apply it — which
      // is both the native-app expectation and our guard against the stale-bundle
      // confusion we hit earlier (you can always SEE which version you're on).
      // Registration is handled by useRegisterSW in UpdatePrompt.jsx, so no
      // script is injected here (injectRegister: null) — that would double-register.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: 'Inventory Tracker',
        short_name: 'Inventory',
        description: 'Scan barcodes to check and update stock, even offline.',
        theme_color: '#0b0e1a',
        background_color: '#0b0e1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        id: '/',
        scope: '/',
        categories: ['business', 'productivity', 'utilities'],
        // Long-press the installed icon → jump straight to a task (native feel).
        shortcuts: [
          { name: 'Scan a barcode', short_name: 'Scan', url: '/?view=scan' },
          { name: 'Stock list', short_name: 'Stock', url: '/?view=stock' },
        ],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell so the UI loads with no network. We deliberately
        // do NOT cache Supabase API/auth responses — data must be live, and the
        // offline queue (IndexedDB outbox) handles writes made while offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/realtime\//],
        // Drop precaches from previous versions instead of letting them pile up.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Product photos are immutable (filename is content-stamped), so serve
            // them from cache first — instant thumbnails, and they work offline.
            urlPattern: /\/storage\/v1\/object\/public\/product-images\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW OFF in dev — it caches aggressively and serves stale
        // bundles during iteration. The PWA still builds/works in production;
        // the offline write-queue (IndexedDB) works without the SW anyway.
        enabled: false,
      },
    }),
  ],
  server: {
    host: true, // expose on LAN so a phone can hit the dev server
    allowedHosts: true, // allow tunnel domains (e.g. *.trycloudflare.com) in dev
  },
})
