# Performance Report

## What was measured (this environment)

Measured on the development container: an Intel Xeon @ 2.80 GHz with 4 cores, **no GPU**. Chromium rendered WebGL through **SwiftShader** (CPU software rendering). Frame rates measured here therefore say nothing about real hardware and are **not** reported as performance claims.

### Render workload per frame (1920×1080, quality = high, includes the shadow pass)

| Level | Draw calls | Triangles | Geometries | Textures | JS heap |
|---|---:|---:|---:|---:|---:|
| 1-4 Nest Neighbours | 456 | 207,826 | 208 | 12 | 36.7 MB |
| 2-5 Coop Cup | 312 | 138,002 | 149 | 18 | 56.0 MB |
| 3-4 Bucket Crossing | 330 | 145,648 | 159 | 16 | 62.5 MB |
| 4-4 Slippery Business | 452 | 140,356 | 432 | 15 | 64.0 MB |
| 5-1 Sprint Final | 343 | 139,334 | 184 | 18 | 56.8 MB |
| 5-5 Sibling Showdown | 297 | 107,028 | 168 | 18 | 35.5 MB |

Tooling: `node scripts/perf.mjs`.

### Simulation cost

Headless runs of all 25 levels: 110,057 fixed steps (four competitors plus AI) in 5.1 s, about **46 µs per step**. At 120 Hz that is roughly 5.6 ms of CPU per second of play (under 1% of a core). Tooling: `npx vite-node scripts/sim-perf.ts`.

### Build size

`dist/` is 1.4 MB: about 225 kB of gzipped JS (Three.js about 155 kB), CSS, and bundled WOFF/WOFF2 fonts. There are no runtime network dependencies.

## Not yet measured (required before any release claim)

- Frame time, the worst frame and memory **on a reference PC with a GPU** at 1080p, for each quality preset (target: 60 FPS at 1080p on the documented reference PC).
- Loading time on a cold cache; GPU memory.
- Long-session soak across several generations.

## Scalability levers already in place

- Quality presets. High: 2048 shadow map, device pixel ratio up to 2. Medium: 1024, DPR 1.5. Low: no shadows, DPR 1.
- FX intensity halves with Reduce Flashes or Reduced Motion.
- Shared materials and textures through the prop kit's caches.
- Fixed-step simulation decoupled from rendering, with frame time capped at 100 ms.

Next optimisations if needed:
- Instancing for repeated props (fence posts, nest-rim segments, spectators).
- Merging static arena geometry.
- Simplified chick materials on low (no sheen or bump).
