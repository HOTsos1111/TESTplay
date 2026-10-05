# Credits & Licence Inventory

| Item | Source | Licence | Notes |
|---|---|---|---|
| Game design, reference boards, brief | CHICK KIN creative team (supplied by the project owner) | Project-owned | Boards stored in `reference/` are concept art, not shipped assets |
| Game code | Written for this project | Project-owned | |
| three.js 0.186.1 | npm `three` | MIT | Rendering |
| Vite, TypeScript, Vitest | npm (dev only) | MIT / Apache-2.0 / MIT | Not shipped in the build output |
| playwright-core | npm (dev only) | Apache-2.0 | Browser checks only |
| Fredoka | `@fontsource/fredoka` 5.3.0 | SIL Open Font Licence 1.1 | Bundled in `dist/` |
| Nunito | `@fontsource/nunito` 5.3.0 | SIL Open Font Licence 1.1 | Bundled in `dist/` |
| 3D models, textures, UI art | Procedural code in `src/render`, `src/ui` | Project-owned | **TEMP**: placeholder art |
| Sound effects, ambience, music | Synthesized in code (`src/audio`) | Project-owned | **TEMP**: placeholder audio. The motif is original; it imitates no existing score |

No third-party art, audio or other assets are included, and no licences were purchased or assumed. Before release, add the licence texts of the shipped dependencies (MIT for three.js, OFL for both fonts) to the distribution.
