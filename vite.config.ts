import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const ads = process.env.HH_ADS === '1';

export default defineConfig({
  base: './',
  // Build number shown on the title screen (set by scripts/package-itch.mjs).
  // HH_ADS=1 turns on the (placeholder) adverts for Play Store builds; see src/systems/Ads.ts.
  define: { __BUILD__: JSON.stringify(process.env.HH_BUILD ?? 'dev'), __ADS__: JSON.stringify(ads) },
  plugins: [
    {
      // The advert videos only ship in builds with ads, keeping itch.io zips small.
      name: 'drop-ad-videos',
      apply: 'build',
      closeBundle() {
        if (!ads) rmSync(resolve(import.meta.dirname, 'dist/ads'), { recursive: true, force: true });
      },
    },
  ],
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as never);
