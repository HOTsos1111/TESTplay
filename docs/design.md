# Homeward Hound — implementation notes

The design source is the developer handoff (v1, 4 Oct 2026). This file records how the vertical slice maps onto it and which decisions were made during the build.

## Architecture

| Handoff system | Where it lives |
|---|---|
| PlayerController | `src/systems/PlayerController.ts`: pure TypeScript, no Phaser. Also used by the fairness validator. |
| InputManager | `src/systems/InputManager.ts`: latched edge presses plus held state, keyboard and multitouch |
| ChunkSpawner | `src/systems/LevelBuilder.ts` (chapter → placed objects) plus lazy spawn/despawn in `GameScene` |
| EnemyController | `src/entities/World.ts` (squirrel, acorn, parcel) and `src/entities/TrolleyBoss.ts` |
| CollectibleManager | `Bone` entity plus `GameContext.addBone` (saves immediately) |
| ProgressStore | `src/systems/ProgressStore.ts` |
| AudioManager | `src/systems/AudioManager.ts` (procedural Web Audio) |
| AssetRegistry | `src/systems/AssetRegistry.ts` plus `src/data/assetManifest.ts` |

Scenes: Boot, Title, Story, ChapterMap, Game, Pause, Results, Upgrade, Settings. The handoff's separate **Encounter** scene is a phase inside `GameScene` so the hero, physics and camera carry straight into the boss. A checkpoint retry starts `GameScene` with `startAt: 'encounter'`.

Gameplay data lives outside scene code: tuning in `src/data/config.ts`, chapters in `chapters.ts`, chunks in `chunks.ts`, the boss script in `encounters.ts`, text in `copy.ts`.

## Movement rules

- Fixed 1/120 s sub-steps and a 0.1 s frame cap.
- Jump fires on a **fresh press** only, buffered for 120 ms. Coyote time is 100 ms. Releasing early clamps upward speed to −300 px/s.
- Hover needs: airborne, jump held, at least 0.18 s since leaving the ground, falling (vy ≥ 0), and wag > 0. It clamps fall speed to 70 px/s. There is no upward boost.
- Wag drains 1 unit/s while hovering and refills 0.6 units/s (× upgrade) only while grounded.
- Collision uses a 92×46 feet-anchored body box. Hazards use a 76×34 inset hurtbox covering the central body only (no head, ears or tail). The rig's cosmetic squash, stretch and tilt never change either box.
- Contact forgiveness: feet within 14 px below a solid top snap up onto it. Ground edges never "bonk"; the hero drops into the pit behind the ground's front face. Side contact with a crate or unbroken cardboard costs a heart and bounces the hero; the 1.2 s invulnerability lets him pass through, so he can never get stuck.

## Fairness

`ChunkValidator` measures jump and hover reach by running the real controller, then checks every chunk:

- gaps are within 85 % of reach at the slowest speed the chunk is played at;
- gaps that need a hover are declared as hover chunks;
- crate columns taller than a jump have a climbable step before them;
- cardboard walls taller than a jump are declared as bark chunks;
- there is enough room between hazards for the bark cooldown;
- declared recovery space exists;
- forced hovers are spaced at least one full recharge apart (the handoff's "never require an uncharged hover after forced hover").

The unit tests run the validator over chapter 1. The browser check adds an empirical test: an in-page bot with no god mode and base stats plays the whole chapter and the boss.

Warnings: static obstacles are on screen at least 2.6 s before contact. Squirrels taunt with a chatter sound and a "!" bubble 1.0 s before throwing; the acorn then needs about 1 s to arrive. The boss whistles and shows a windup pose and bubble for 1.1 s before parcels, and squeals and shakes for 0.6 s before lunging.

Readability without colour: fragile cardboard wobbles idly and has a dashed perforation border and a glass icon. Hazards are dark, outlined silhouettes. The exposed latch pulses in size with a ring. The empty wag meter shows a hatch pattern.

## Progress and anti-farming

Each bone adds to the bank the moment it is collected and is never re-added by the results screen. Retrying is a fresh attempt, so bones respawn, as in any runner. One-time rewards (the first-clear bonus) are recorded by id in `claimedRewards`. The save schema follows the handoff (version, unlockedChapter, completedChapters, checkpoint, boneBalance, upgrades, endlessBestByChapter, settings) plus `bestRunByChapter`, `claimedRewards`, `hintsSeen` and `storySeen`. Every load runs field-by-field validation.

## Open decisions (from the handoff, still open)

Hero, squirrel and dogcatcher names; final character drawings; recorded music; collar cosmetics; final difficulty and prices. The game never names the characters.
