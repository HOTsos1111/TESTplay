# Implementation Plan & Milestone Status

## Platform decision

The repository already hosts a browser game (Homeward Hound: Phaser + TypeScript + Vite). Following the brief's guidance and the owner's choice, CHICK KIN keeps the **browser platform** and the same toolchain, but renders a **true 3D world with Three.js** to reach the Soft-3D target: PBR materials with velvet sheen for plumage, ACES tone mapping, warm key lights with shadow-casting, rounded geometry and procedural textures, with high/medium/low quality presets. A desktop build can later wrap `dist/` in a native shell (Tauri or Electron); that is documented, not yet built or verified (see outstanding-production.md).

CHICK KIN lives in `chick-kin/` as a self-contained package; Homeward Hound is untouched.

## Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Audit references & repo; plan; canonical design; asset/audio manifests; engine/export target | **Done** — this folder's docs; manifests generated from data |
| 2 | Vertical slice 1-1 + 2-1 with all classes, AI, menu→play→result flow, save, effects, adaptive music hooks | **Done** |
| 3 | All five chapter controllers, all 25 data-defined levels, growth and next-generation loop | **Done** — every class completes every level in headless tests; full loop verified in Chromium |
| 4 | AI, route balance, generation variants, progression, family tree, accessibility, controller UX | **Largely done** — see QA report for balance items still needing human playtests |
| 5 | Replace TEMP art/audio with production assets, animate, light, mix, optimise | **Blocked on external production** — pipeline and slots are in place; nothing final yet |
| 6 | Release-candidate verification, export, licence audit, readiness report | **Partial** — web build + checks done; desktop export, real-hardware perf captures and final assets outstanding |

## Key implementation decisions

- **One simulation, two plane modes.** Side arenas (x/y, feet on surfaces, one-way planks, moving/bucket/wobbly/spring platforms) and top-down arenas (x/plane-y + hop height, circle-vs-box, pushables, gates). Relay legs and showdown rounds switch arenas, with a camera reorientation at each marked transition.
- **2.5D lanes in side view.** Siblings run on separate depth lanes and pass each other; they interact through peck-nudges and abilities rather than body-blocking a single lane (which made races feel like traffic jams).
- **Generic peck-nudge** (interact next to a sibling) for every class so perch contests aren't Mighty-only; Fluff Bump is the strong version.
- **Perch anti-stall:** contested occupancy pauses accumulation (per brief); after 3 s of stand-off the perch wobbles everyone off fairly; less pushy siblings back off and circle.
- **Golden feathers are personal** (each sibling collects their own set) so a level requiring three feathers is always winnable.
- **Fall recovery** in climbs: a long fall from a foothold returns you to the last lantern with brief protection.
- **AI**: side levels follow authored routes (common + class routes) with reactive jump/duck/peck/push/flap/glide and timed waits for swinging buckets; top-down levels use an A* nav grid aware of hop-able fences, gates, peckable straw and pushables the class can move.
- **Determinism**: seeded RNG everywhere in the sim; generation variants are deterministic from the family seed and recorded with the generation.
