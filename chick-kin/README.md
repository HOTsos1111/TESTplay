# CHICK KIN

**Three siblings · one big farm · a bright tomorrow.** A Soft-3D farmyard adventure about affectionate sibling rivalry. Pick Speedy, Mighty or Nimble, compete with three AI siblings through five growth stages — each a different gameplay format — grow up, hatch a new brood and play the next generation.

Built with **TypeScript + Three.js + Vite** (browser, true 3D world). See `docs/` for the full design, manifests and reports.

> **Production status:** a complete, playable build of all systems and all 25 levels. All 3D art, textures, sound effects and music are **TEMP procedural placeholders generated in code** and are clearly labelled as such. See [`docs/outstanding-production.md`](docs/outstanding-production.md).

## Run it

Requires Node 20+ (developed on Node 22).

```bash
cd chick-kin
npm install          # pinned dependencies (package-lock.json)
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build → dist/ (static, offline, no server needed)
npm run preview      # serve dist/
npm test             # unit + simulation tests (≈3 min: every class plays every level headless)
npm run check:browser  # end-to-end check in Chromium (uses the dev server; set CHROMIUM_PATH if needed)
```

`dist/` uses relative paths (`base: './'`) so it can be served from any folder or sub-path. Fonts are bundled (no network needed for offline play).

### Debug paths

- `?debug` — adds a **Debug** button on the title: jump to any level / class / generation, autopilot, growth and adult vignettes, audio audition of every cue, music cue and stem toggles, voice counters.
- `?play=3-4&cls=mighty&gen=2&auto=1` — start any level directly (autopilot optional).
- `?view=models` — model sheet of all classes × growth stages + adult parents.
- `?quality=low|medium|high` — override the graphics preset.

## Controls

| Action | Keyboard (default) | Controller |
|---|---|---|
| Move | WASD / arrows | Left stick / D-pad |
| Jump · flap (mid-air) · hop · glide (hold while falling) | Space | Ⓐ (south) |
| Peck · interact · scratch/tug (hold) · carry · deliver · peck-nudge a sibling | E | Ⓧ (west) |
| Signature ability (Zoomies / Fluff Bump / Fancy Feathers) | Shift | Ⓑ (east) / RB |
| Duck · brace | Ctrl / C | LB / LT |
| Drop through a plank | Duck + Jump | LB + Ⓐ |
| Pause | Esc / P | Start |

On phones and tablets, play in landscape: drag anywhere on the left half for the joystick; the right-hand buttons are Jump, Peck, your Power and Duck.

All keyboard actions are remappable (Settings → Controls); prompts show the active binding and device. Hold-or-toggle for scratch/tug is in Settings → Accessibility. Menus are fully navigable by keyboard and controller.

## The game loop

Boot → Title → Chick select (or Continue) → Chapter map → Level briefing → Play → Results → next level, or **Grow Up!** after the fifth level → next chapter … → after 5-5 **All grown up!** → hatch the new brood (choose one modest family perk) → choose any class for the next generation (harder seeded variants). Credits are offered after the first completed generation.

| Stage | Chapter | Format | Camera |
|---|---|---|---|
| 1 Hatchling | Nest Scramble | Top-down nest arenas: collect, dodge, tug, perch | Close overhead |
| 2 Fluffy Chick | Coop Dash | Side-scrolling platform races | Side follow |
| 3 Awkward Adolescent | Rafter Rivals | Vertical climbing with flaps, glides, stamina | Dynamic vertical |
| 4 Young Chicken | Farmyard Mischief | Three-quarter delivery: scratch, carry, gates, vaults, props | Three-quarter follow |
| 5 Almost Grown | Barnyard Championship | Sprint, perch, haul, relay (camera changes per leg), 3-round Showdown | Event cameras |

## Architecture

```
src/
  sim/        deterministic simulation (no rendering): Match, ArenaRuntime, side & top-down physics,
              rules (bumps, powers, abilities), objectives, SiblingAI (route following + nav-grid A*), harness
  data/       canonical data: classes, growth profiles, items (OBS/PU/COL), chapters, 25 level definitions
  core/       GameFlow (state machine + screens), Session (fixed-step loop), SaveManager (versioned, backup,
              migrations), InputRouter (keyboard/gamepad, rebinding), Generation (siblings, variants, perks)
  render/     Three.js presentation: Renderer (quality presets), ChickModel (procedural Soft-3D chicks),
              props (prop kit), ArenaView, CameraDirector, GameView, Fx, MenuScene (vignettes), themes
  audio/      AudioDirector (buses, cue playback, ducking, ambience), cues (manifest), synth (TEMP sources),
              music (adaptive stems on an original motif)
  ui/         DOM UI: wood/ivory styling, HUD, spatial focus navigation, rendered portraits
tests/        Vitest: level completion for every class, variant solvability, rules, save, generation, content validation
scripts/      browser-check, screenshots, perf, docs generator, trace/debug tools
```

- **Simulation ⟂ presentation.** The sim runs at a fixed 120 Hz; visuals interpolate. UI, audio, FX and animation react only to semantic sim events.
- **Same rules for everyone.** Player and siblings share one `Actor` type and one input vocabulary; AI skill only changes reaction time, bounded hesitation and route choice. No teleports, no hidden speed boosts, no rubber-banding.
- **Data-driven content.** Levels, routes, variants, obstacles, powers, class tuning and cue definitions are plain data, validated by tests.

## Documents

| Document | Contents |
|---|---|
| [docs/game-brief.md](docs/game-brief.md) | The full development brief (source of truth for rules) |
| [docs/implementation-plan.md](docs/implementation-plan.md) | Milestones, status, decisions |
| [docs/reference-index.md](docs/reference-index.md) | Every reference board, its role, extracted rules, conflicts resolved |
| [docs/design-canonical.md](docs/design-canonical.md) | Classes, growth, balance tables, abilities, rules, difficulty and generations |
| [docs/level-definitions.md](docs/level-definitions.md) | All 25 levels (generated from data) |
| [docs/asset-manifest.md](docs/asset-manifest.md) | Canonical asset IDs and status (generated) |
| [docs/animation-list.md](docs/animation-list.md) | Animation catalogue and implementation status |
| [docs/audio-manifest.md](docs/audio-manifest.md) | Cue + stem manifest (generated) |
| [docs/audio-brief.md](docs/audio-brief.md) | Audio production brief and integration notes |
| [docs/save-schema.md](docs/save-schema.md) | Save data schema, migrations, recovery |
| [docs/qa-report.md](docs/qa-report.md) | Tests, browser checks, known issues |
| [docs/performance-report.md](docs/performance-report.md) | Measured numbers and limits of what was measured |
| [docs/credits-licences.md](docs/credits-licences.md) | Credits and licence inventory |
| [docs/outstanding-production.md](docs/outstanding-production.md) | What is TEMP, missing, or awaiting external production; release readiness |
