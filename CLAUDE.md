# Homeward Hound

A dachshund side-scrolling runner by Parody Games (Phaser 3.90 + TypeScript + Vite, tests with Vitest).
Nine levels (L01–L09), each ending in its own boss, a bone-shop upgrade tree and a story opening.

## Commands

- `npm install` once, then `npm run dev` to play locally.
- `npx tsc --noEmit` and `npx vitest run` before every build.
- `npm run build` then `node scripts/browser-check.mjs --quick` (headless Chromium checks; full run without
  `--quick` also fights all nine bosses with an autopilot, about 25 min; `BOSSES=3,5` runs only those bosses).
- Debug URL flags: `?unlock=all` (open every level), `?upgrades=max`, `?god=1`, `?intro=0`, `?realtime=1`.

## Builds for itch.io (owner uploads them by hand)

`node scripts/package-itch.mjs "G:\My Drive\PARODEE GAMES\GAMES\Homeward Hound\HH_BUILDS"`
bumps `build-number.txt`, builds with "Build ###" on the title screen and writes
`HomewardHound_Build_###.zip` (index.html at the root) into HH_BUILDS. Commit `build-number.txt` after each
build so numbering carries on. Also add a line for each build to `Homeward Hound build log.txt` in HH_BUILDS.
Builds 001–005 were made in the earlier cloud session; the next is 006.

## Where things live

- `src/data/` — levels (`chapters.ts`, `chunks.ts`), bosses (`bosses.ts`), bone shop (`upgrades.ts`),
  per-level art roles (`levelArt.ts`), story text, copy/hints.
- `src/systems/` — `PlayerController.ts` (pure movement sim), `Skills.ts` (upgrades -> stats, level gating,
  `upgradePower`), `ProgressStore.ts` (save data), `LevelBuilder.ts`, `LevelScenery.ts`, `AudioManager.ts`.
- `src/entities/` — `PatternBoss.ts` (all nine bosses: armour/daze loop, crits, stagger, barrages, aggression
  scaling by level and upgrades), `Boomerang.ts`, `World.ts` (obstacles; bark-only `Cardboard` boxes).
- `src/scenes/` — Title, Story, ChapterMap (level select + first-visit upgrades tip), Game, Upgrade (bone shop),
  Results (always back to the level select), Settings (Reset All Progress).

## Design rules agreed with the owner

- Start with 4 sausage links; the shop adds up to 5. Upgrades are deliberately expensive (~9,000 bones to max).
- The double jump is built in; Speed Burst is a shop unlock that Level 5+ needs (level card says so).
- Every attempt plays the whole level: no boss checkpoints. Win or lose returns to the level select with
  nothing pre-selected.
- Box stacks are one bark-only box; the Boomerang Bone bounces off them.
- Bosses get more aggressive and sturdier with level and with how much of the shop is owned; Level 1 stays easy.
- Red means danger (hazard beams are red); platforms must never look red.
