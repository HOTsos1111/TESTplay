# Outstanding Production & Release Readiness

**Release-ready: NO.** The core game is complete and tested: all five formats, all 25 levels, growth, generations, save, UI, accessibility and the audio system. It is not release-ready because **all art and audio are TEMP placeholders**, the desktop export is not built, and performance has not been captured on real GPU hardware.

## Final / temporary / missing

| Area | Status | What exists | What is needed |
|---|---|---|---|
| Gameplay systems (25 levels, five formats, AI, objectives, powers, abilities) | **Implemented** | Data-driven and covered by headless tests | Human playtests for balance (see design-canonical.md §Known balance questions) |
| Characters (3 classes × 5 stages + adults) | **TEMP** | Procedural Soft-3D models built from primitives with velvet sheen and a feather bump map | Modelled and rigged glTF characters per the boards (feather clumps / fur cards, LODs, blend shapes for expressions) |
| Animation | **TEMP** | Procedural squash/stretch, legs, wings, head and expressions | Authored clips per `animation-list.md`, with animation events for foot contact and peck impacts |
| Environment kits (5 chapters) | **TEMP** | Procedural prop kit with canvas textures | Modular glTF kits with separate colliders, atlased textures and LODs |
| VFX | **TEMP** | Sprite particles (dust, sparkles, feathers, straw, mud) | Designed particle systems |
| UI art | **TEMP** | CSS wood/ivory styling; portraits rendered from the TEMP models | Final painted frames, icons, egg motifs and character portraits |
| Fonts | **Final** | Fredoka + Nunito (OFL), bundled | — |
| Music | **TEMP** | Synth arrangement of an original motif, adaptive stems | ~18–25 min of composed, performed and mixed music (see audio-brief.md) |
| SFX / voices / ambience | **TEMP** | Code-synthesized cues with full manifest and routing | Recorded and licensed assets, mastering |
| Desktop build | **Missing** | Static web build (`dist/`) runs offline | Wrap in Tauri or Electron, sign, and test installers on Windows/macOS/Linux |
| Performance on target hardware | **Missing** | Draw-call and triangle counts plus sim cost (performance-report.md) | 1080p frame-time captures on a documented reference PC for each preset |
| Controller rebinding UI | **Partial** | Keyboard rebinding in UI; gamepad uses standard mapping (prompts adapt) | In-UI gamepad button remapping |
| Localisation | **Missing** | English only | String table + translations (no text is baked into images) |
| Licence texts in the distribution | **Missing** | Inventory in credits-licences.md | Ship MIT/OFL licence files with the build |

## Recommended next steps

1. **Playtests:** standard-difficulty races as Mighty, four-way perch contests, and haul levels. Tune class tuning and AI hesitation from the data tables.
2. **Art pipeline:** replace `ChickModel` / `props` builders with a glTF loader behind the same interfaces (`AssetRegistry` slot per asset ID in `asset-manifest.md`).
3. **Audio pipeline:** swap synth sources for decoded files per `audio-brief.md` §Integration.
4. **Desktop wrapper and real-GPU performance captures.**
