import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

/**
 * The app always runs at http://localhost:5173, for both `npm run dev` and
 * `npm run preview`. Browser storage (your teams and favourites) belongs to the
 * exact address, so using one fixed port means every way of starting the app
 * sees the same saved data.
 */
const PORT = 5173;

/**
 * The project on GitHub ("Report a problem" opens an issue there) and the
 * commit being built. GitHub's build machines say both; elsewhere the
 * repository falls back to this one.
 */
const REPOSITORY = process.env.GITHUB_REPOSITORY ?? 'Unaisaurus/champions-dex';
const BUILD = (process.env.GITHUB_SHA ?? '').slice(0, 7);

export default defineConfig({
  // Relative paths, so the built app also works from a sub-folder or any static host.
  base: './',
  plugins: [
    react(),
    // Installable app that works offline: the app and its data are saved on
    // the device, artwork is kept as you view it. New versions wait until you
    // choose to reload (see src/app/pwa.ts).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // The files below are already covered by globPatterns.
      includeManifestIcons: false,
      manifest: {
        name: 'Champions Dex',
        short_name: 'Champions Dex',
        description: 'Personal Pokédex and team builder for Pokémon Champions.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#edf0f4',
        theme_color: '#d63a2f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'data/**/*.json'],
        // learnsets.json is about 1 MB.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Artwork and icons, pinned to a fixed revision of the sprite repository.
            urlPattern: ({ url }) =>
              url.origin === 'https://raw.githubusercontent.com' &&
              url.pathname.startsWith('/PokeAPI/sprites/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'artwork',
              expiration: { maxEntries: 6000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __REPOSITORY__: JSON.stringify(REPOSITORY),
    __APP_BUILD__: JSON.stringify(BUILD),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: PORT, strictPort: true, host: 'localhost' },
  preview: { port: PORT, strictPort: true, host: 'localhost' },
  build: {
    // The whole app is a few hundred kB, loaded once from your own computer.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    css: false,
  },
});
