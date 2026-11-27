import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const description = 'GBoy, the Giant Book of Yum: recipes collected by Lisa Jensen from many sources and shared with her children, with love.'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // Installable app shell. Recipe data for offline use lives in IndexedDB
    // (src/offline.js); the service worker only caches the built site.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      // The glob below already precaches the icons.
      includeManifestIcons: false,
      manifest: {
        id: './',
        name: 'GBoy · Giant Book of Yum',
        short_name: 'GBoy',
        description,
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#f8f7f1',
        background_color: '#f8f7f1',
        categories: ['food', 'lifestyle'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Activate new versions right away. The plugin only sets these itself
        // when it injects the registration; src/main.jsx registers instead.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
})
