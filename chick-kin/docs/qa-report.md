# QA Report

Date: 2026-10-05. Environment: Linux container, Node 22, Chromium 1194 with SwiftShader (software WebGL, no GPU).

## Automated tests: `npm test`, 198 passed / 0 failed

| Suite | What it proves |
|---|---|
| `tests/levels.test.ts` (100 tests) | **Every class completes every one of the 25 base levels** headless, using the same movement rules as the player (75 tests). **Every level's generation-3 seeded variant** stays completable by Mighty, the weakest jumper (25 tests). |
| `tests/validate.test.ts` | 25 unique level ids, five per chapter. Starts and items are clear of solids. Objective entities exist. Side arenas have a common AI route. In top-down arenas, every objective item is reachable from every start (A*). |
| `tests/rules.test.ts` | Power refresh without stacking. Two-power cap with replacement feedback. Shell Shield absorbs one bump and expires after 10 s. Cool Breeze is an instant +40%. Power Corn affects pushing only. Recovery protection prevents chain-stun. Fancy Feathers dodges siblings but not hazards. Double Crumb doubles loose crumbs only, never deliveries. Worm Magnet doesn't pull through walls. Bumped cargo drops as recoverable items. Contested perch pauses accumulation. Ability cooldown is respected. Showdown awards 5/3/2/1 and gates success on total points. |
| `tests/save.test.ts` | Round trip. Corrupted main save recovers from the backup. A malformed state never overwrites a good save. v1→v2 migration. Reset keeps settings. |
| `tests/generation.test.ts` | Deterministic sibling line-ups with class variety and all three personalities. Hazard tempo capped at +20%. Perks ≤5%. Variants reproduce from the seed and never mutate the authored level. |

## End-to-end browser check: `npm run check:browser`, 29/29 passed, no page errors

Drives the real game in Chromium:
- **First session:** title, then keyboard navigation (Enter on Play), class selection with arrow keys, the map, the briefing, and playing 1-1 by autopilot. Esc pauses and Resume works. Results are a success, autosave runs and 1-2 unlocks.
- **Growth:** finishing 1-5 offers Grow Up!; the growth vignette plays, the save records chapter 2 and the map opens on the next chapter.
- **Formats:** 2-1 (side race), 3-1 (vertical climb), 4-1 (delivery), 5-4 (relay across three camera formats) and 5-5 (three-round Showdown) all play through to results.
- **Generation loop:** adult celebration, hatching the new brood, choosing a perk, chick select, and generation 2 starting with a perk and a lineage record.
- **Persistence and recovery:** settings survive a reload, and a corrupted main save recovers from the backup.
- **Audio:** every audio cue, music cue and the ambience play without errors.

## Visual review (screenshots in `screenshots/`, not committed)

Reviewed:
- The title, chick select, map, briefing, HUD, pause, results, growth, adult and brood screens.
- In-play views of 1-1, 1-3, 2-1, 2-4, 3-4, 4-2, 4-3, 5-1 and 5-5, plus the `dist/` production build.

Issues found and fixed during review:
- Nest camera too top-down (faces hidden).
- Chicks started facing away from the camera.
- Title logo covered the chicks.
- Egg shape.
- Dark buckets and lanterns.
- Mud rendered under the floor.
- Start arch occluding the chicks.
- "Victory" eyes read as sunglasses.
- Basket ownership shown by colour only (now name-tagged).

## Known issues / not verified

- **Balance** has not been playtested by humans (see design-canonical.md §Known balance questions). The biggest risks are Mighty in finish-first races and four-way perch stand-offs.
- **Frame rate on real hardware is unmeasured** (no GPU here). Workload numbers are in performance-report.md.
- **Gamepads** are supported through the standard-mapping Gamepad API but were **not tested with physical controllers** in this environment. Button remapping for gamepads isn't in the UI yet.
- **Touch/mobile:** on-screen joystick + Jump/Peck/Power/Duck buttons, phone-landscape layouts and a rotate prompt were added for the shareable web link. Verified in Chromium phone emulation (844×390), not yet on physical phones.
- Audio has been auditioned only for errors and routing; **mix loudness has not been measured** (all audio is TEMP).
