import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Build number shown on the title screen (set by scripts/package-itch.mjs).
  define: { __BUILD__: JSON.stringify(process.env.HH_BUILD ?? 'dev') },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as never);
