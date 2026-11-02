import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

/**
 * The app always runs at http://localhost:5173, for both `npm run dev` and
 * `npm run preview`. Browser storage (your teams and favourites) belongs to the
 * exact address, so using one fixed port means every way of starting the app
 * sees the same saved data.
 */
const PORT = 5173;

export default defineConfig({
  // Relative paths, so the built app also works from a sub-folder or any static host.
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
