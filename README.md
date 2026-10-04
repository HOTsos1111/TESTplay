# Homeward Hound

A tiny dachshund with enormous confidence chases a squirrel into a delivery truck and has to run home across town. A 2D auto-running side-scroller by Parody Games, built with Phaser 3, TypeScript and Vite.

This is the **first playable vertical slice**: a complete chapter 1 ("Special Delivery") with its dogcatcher trolley encounter, plus the structure for the full six-chapter adventure. Chapters 2–6 and endless mode are marked "coming soon" in the game.

## Run it

Requires Node 20+ (developed on Node 22).

```bash
npm install        # uses the committed package-lock.json
npm run dev        # dev server at http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm test           # unit tests (movement, saves, level fairness, music data)
npm run check:browser   # end-to-end browser checks (needs a build + Chromium, see below)
```

`dist/` is a static site with no server or network dependency after load. `vite.config.ts` uses `base: './'`, so it can be served from any sub-path.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Jump (tap = hop, hold = big leap) | Space, ↑ or W | Left half of screen / JUMP button |
| Hover (hold jump while falling) | hold Space / ↑ | hold JUMP |
| Bark | X or K | Right half of screen / BARK button |
| Speed burst (when the meter is full) | Shift, C or L | BURST button above BARK |
| Pause | Esc or P | Pause icon (top right) |
| Menus | Arrows / Tab, Enter, Esc | Tap |

Holding jump across a landing never re-jumps; you must release and press again. Touch supports holding jump and tapping bark at the same time. The game also pauses itself when the tab is hidden or the window loses focus.

## What is implemented

- **Movement** — automatic running, variable jump height (release clamps upward speed), 100 ms coyote time, 120 ms jump buffer, propeller-tail hover with a wag meter that drains in the air and recharges only on the ground, no upward boost or double jump. Fixed 1/120 s simulation sub-steps; frame time is capped.
- **Speed burst** — a meter refills over 6 s. Bursting stretches the dog's front out like an elastic band, then snaps the back end forward (with sound), for +65 % speed for 0.9 s. A jump started during a burst keeps the speed until landing, so burst → jump → hold clears gaps too wide for a hover. Painted floor arrows mark the two gaps in chapter 1 that need it.
- **Pest squirrels** — once you get close, a squirrel scampers along just ahead of you, pelting you with rolling and bouncing acorns. Between volleys it hops in close to blow a raspberry: bark then to send it tumbling away. It stays until you bark it off (or gets bored after about 18 s).
- **Power-ups** (bubbles along the route, never required): **Golden Bone** pulls nearby bones to you (9 s); **Spiked Collar** blocks the next hit (15 s); **Dog Whistle** blasts every squirrel and acorn off the screen, then gives super-range rapid barks (7 s); **Bacon Zoomies** gives unlimited tail spin and bursts (6 s). Active ones show with a countdown ring under the distance.
- **Bark** — forward pulse with cooldown and visible rings; each pulse affects each target at most once. Opens fragile cardboard (the whole stack bursts), spooks squirrels, knocks acorns out of the air and damages the boss latch only while it is exposed.
- **Health** — three hearts, 1.2 s blinking invulnerability after a hit, pits end the attempt, comic defeat flop.
- **Chapter 1** — 19 authored chunks introducing jump, bones, bark, squirrel and hover one at a time, then combining them; speed ramps from 340 to 400 px/s (raised after the first playtest felt easy). Optional higher routes (some on moving scissor lifts) carry extra bones, and long empty stretches get automatic bone trails. Scent wisps mark hover routes.
- **Trolley encounter** — whistle and windup warnings, rolling parcels to jump, a lunge that exposes a glowing latch, three latch barks to win, slapstick collapse. Checkpoint at the encounter start; failure retries from there, even after a refresh.
- **Progress** — localStorage with validation and safe defaults (works in memory if storage is blocked). Bones save the moment they are collected; the first-clear bonus is granted once. Best distance per chapter. Reset is only available from Settings, and needs a second tap to confirm.
- **Upgrades** — "Good Dog, Great Gear": tail stamina (+0.2 s), recharge (+10 %), bark reach (+20 px); three levels each at 50/100/175 bones. Nothing requires them.
- **Screens** — title, skippable ~20 s opening story, route map with six nodes (completed/current/locked/coming soon), pause, results, upgrades, settings (separate music and SFX volume, hitbox debug, replay opening, reset). All menu text is live and keyboard-navigable.
- **Art and audio** — everything is an original procedural placeholder: a rubber-hose rig for the hero (separately animated legs, ears on springs, squash/stretch, propeller tail, expressions), three-layer depot parallax, props, squirrel, dogcatcher and trolley, plus Web Audio SFX and a small-band score with a recurring "home" motif.

## Screen fit

The game is always 720 logical pixels tall and between 1280 and 1720 wide, chosen from the screen's shape, so wide phones are filled edge to edge with no letterbox bars. Menus are laid out at 1280 and centred. A **Full screen** button on the title and pause screens (also tried automatically when you start playing on a phone) hides the browser bars where the browser allows it. iPhone Safari and some in-app viewers do not allow it, and the game says so.

## Replacing placeholder art

Every texture has a stable key in `src/data/assetManifest.ts`, all currently marked `placeholder: true`. To swap one in:

1. Export a PNG at **2× logical size** (the manifest lists the logical size) to the `file` path shown, under `public/`, e.g. `public/assets/props/crate.png`.
2. Set `placeholder: false` for that entry.

The Boot scene loads files for non-placeholder entries and generates art only for keys that are still missing, so gameplay code does not change. Collision sizes live in `src/data/config.ts` and `src/data/chunks.ts` (`OBJECT_SIZE`), not in the art. The hero is a multi-part rig rather than a frame atlas; see `docs/asset_manifest.md` for the pivots and for how to move to the atlas in the handoff's export contract.

Audio is procedural (`src/systems/AudioManager.ts`, `src/data/music.ts`). Recorded files are not wired in yet.

## Project layout

```
src/
  main.ts                Phaser config, audio unlock, page-level input guards
  data/                  tuning (config.ts), chapters, chunks, encounter, copy, music, asset manifest
  systems/               PlayerController (pure physics), InputManager, LevelBuilder, ChunkValidator,
                         ProgressStore, AudioManager, AssetRegistry + art/ generators, Fx, debug
  entities/              HeroView (rig), World (props/enemies), TrolleyBoss
  scenes/                Boot, Title, Story, ChapterMap, Game, Pause, Results, Upgrade, Settings
  ui/                    Button/MenuNav, Hud, TouchControls, Backdrop, theme
tests/                   Vitest unit tests
scripts/browser-check.mjs  Playwright end-to-end checks
docs/                    design notes and asset manifest
```

## Testing

- `npm test` runs the unit tests: jump/hover/coyote/buffer/bark/bonk rules on the real `PlayerController`, save validation and anti-farming, music data, and a fairness validator that simulates the controller to confirm every gap, wall and climb in chapter 1 is possible at base stats at the chapter's slowest and fastest speeds, and that forced hovers are spaced for a full recharge.
- `npm run check:browser` builds nothing by itself: run `npm run build` first. It serves `dist/` and drives Chromium (`CHROMIUM_PATH` overrides the default path) through: title → story skip → game; held-jump/hover/recharge rules; pause freezing; bark cooldown; damage, invulnerability and failure; bones saved after failure; a god-mode run to the results screen; a **base-stat, no-god-mode bot** that plays the whole chapter and the boss; checkpoint retry; and ten retries without listener or object growth. Add `--quick` to skip the two full-chapter runs.

Debug URL flags: `?debug=1` draws hitboxes (also in Settings), `?god=1` ignores damage and bounces out of pits (testing only).

## Known limitations

- Only chapter 1 is playable. Chapters 2–6, the reunion ending, endless mode, cosmetic collars and the P1/P2 assets are not built yet.
- Art and audio are procedural placeholders, not final assets. Fonts are system fonts (no web-font download).
- The hero is a procedural rig, not the 384×256 frame atlas in the export contract.
- Tuning is the handoff's starting values. The game has not been playtested with people; it has only been checked by the automated bot and by screenshots.
