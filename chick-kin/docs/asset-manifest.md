# CHICK KIN — Canonical Asset Manifest (generated)

All runtime assets in this build are **TEMP procedural placeholders** generated in code (Three.js geometry + canvas textures). Each row lists the stable ID, the code source that produces it, gameplay effect, collider, animation and audio hooks, licence, status and the intended final export path for production art (glTF 2.0 + KTX2 textures).

Environment IDs are chapter-namespaced (ENV-0C-NNN) per the brief.

## Characters

| ID | Asset | Source | Animation | Audio | Licence | Status | Final export path |
|---|---|---|---|---|---|---|---|
| CHR-SPEEDY-S1 | Speedy — Hatchling | render/ChickModel.ts (procedural) | see animation-list.md | vo.speedy | Project-original code | TEMP | assets/characters/speedy/stage1.glb |
| CHR-SPEEDY-S2 | Speedy — Fluffy Chick | render/ChickModel.ts (procedural) | see animation-list.md | vo.speedy | Project-original code | TEMP | assets/characters/speedy/stage2.glb |
| CHR-SPEEDY-S3 | Speedy — Awkward Adolescent | render/ChickModel.ts (procedural) | see animation-list.md | vo.speedy | Project-original code | TEMP | assets/characters/speedy/stage3.glb |
| CHR-SPEEDY-S4 | Speedy — Young Chicken | render/ChickModel.ts (procedural) | see animation-list.md | vo.speedy | Project-original code | TEMP | assets/characters/speedy/stage4.glb |
| CHR-SPEEDY-S5 | Speedy — Almost Grown | render/ChickModel.ts (procedural) | see animation-list.md | vo.speedy | Project-original code | TEMP | assets/characters/speedy/stage5.glb |
| CHR-SPEEDY-ADULT | Speedy — Adult parent | render/ChickModel.ts (adult proportions) | idle, celebrate | vo.speedy | Project-original code | TEMP | assets/characters/speedy/adult.glb |
| CHR-MIGHTY-S1 | Mighty — Hatchling | render/ChickModel.ts (procedural) | see animation-list.md | vo.mighty | Project-original code | TEMP | assets/characters/mighty/stage1.glb |
| CHR-MIGHTY-S2 | Mighty — Fluffy Chick | render/ChickModel.ts (procedural) | see animation-list.md | vo.mighty | Project-original code | TEMP | assets/characters/mighty/stage2.glb |
| CHR-MIGHTY-S3 | Mighty — Awkward Adolescent | render/ChickModel.ts (procedural) | see animation-list.md | vo.mighty | Project-original code | TEMP | assets/characters/mighty/stage3.glb |
| CHR-MIGHTY-S4 | Mighty — Young Chicken | render/ChickModel.ts (procedural) | see animation-list.md | vo.mighty | Project-original code | TEMP | assets/characters/mighty/stage4.glb |
| CHR-MIGHTY-S5 | Mighty — Almost Grown | render/ChickModel.ts (procedural) | see animation-list.md | vo.mighty | Project-original code | TEMP | assets/characters/mighty/stage5.glb |
| CHR-MIGHTY-ADULT | Mighty — Adult parent | render/ChickModel.ts (adult proportions) | idle, celebrate | vo.mighty | Project-original code | TEMP | assets/characters/mighty/adult.glb |
| CHR-NIMBLE-S1 | Nimble — Hatchling | render/ChickModel.ts (procedural) | see animation-list.md | vo.nimble | Project-original code | TEMP | assets/characters/nimble/stage1.glb |
| CHR-NIMBLE-S2 | Nimble — Fluffy Chick | render/ChickModel.ts (procedural) | see animation-list.md | vo.nimble | Project-original code | TEMP | assets/characters/nimble/stage2.glb |
| CHR-NIMBLE-S3 | Nimble — Awkward Adolescent | render/ChickModel.ts (procedural) | see animation-list.md | vo.nimble | Project-original code | TEMP | assets/characters/nimble/stage3.glb |
| CHR-NIMBLE-S4 | Nimble — Young Chicken | render/ChickModel.ts (procedural) | see animation-list.md | vo.nimble | Project-original code | TEMP | assets/characters/nimble/stage4.glb |
| CHR-NIMBLE-S5 | Nimble — Almost Grown | render/ChickModel.ts (procedural) | see animation-list.md | vo.nimble | Project-original code | TEMP | assets/characters/nimble/stage5.glb |
| CHR-NIMBLE-ADULT | Nimble — Adult parent | render/ChickModel.ts (adult proportions) | idle, celebrate | vo.nimble | Project-original code | TEMP | assets/characters/nimble/adult.glb |

## Environment kits

| ID | Asset | Gameplay use / collider | Source | Licence | Status | Final export path |
|---|---|---|---|---|---|---|
| ENV-01-001 | Straw nest rim | nestrim solids | props.nestRim | Project-original code | TEMP | assets/env/nest/straw-nest-rim.glb |
| ENV-01-002 | Low straw divider (hop) | straw solids h≤0.35 | props.nestRim | Project-original code | TEMP | assets/env/nest/low-straw-divider-hop-.glb |
| ENV-01-003 | Loose straw plug | straw entity (peck) | props.strawBarrier | Project-original code | TEMP | assets/env/nest/loose-straw-plug.glb |
| ENV-01-004 | Egg ramp / tiny wood ramp | deco | ArenaView.deco ramp | Project-original code | TEMP | assets/env/nest/egg-ramp-tiny-wood-ramp.glb |
| ENV-01-005 | Small mound perch | mound + perch | props.moundPerch | Project-original code | TEMP | assets/env/nest/small-mound-perch.glb |
| ENV-02-001 | Wooden floor slab | ground solids | props.slab | Project-original code | TEMP | assets/env/coop/wooden-floor-slab.glb |
| ENV-02-002 | Plank platform (one-way) | oneWay solids | props.plankPlatform | Project-original code | TEMP | assets/env/coop/plank-platform-one-way-.glb |
| ENV-02-003 | Crate block | crate solids | props.crate | Project-original code | TEMP | assets/env/coop/crate-block.glb |
| ENV-02-004 | Low fence gap | lowFence solids | props.lowFenceGap | Project-original code | TEMP | assets/env/coop/low-fence-gap.glb |
| ENV-02-005 | Coop wall backdrop | backdrop | themes.buildBackdrop | Project-original code | TEMP | assets/env/coop/coop-wall-backdrop.glb |
| ENV-02-006 | Start / finish ribbon | finish + deco | props.ribbonArch | Project-original code | TEMP | assets/env/coop/start-finish-ribbon.glb |
| ENV-02-007 | Checkpoint lantern | checkpoint | props.lantern | Project-original code | TEMP | assets/env/coop/checkpoint-lantern.glb |
| ENV-03-001 | Rafter beam (one-way) | beam solids | props.plankPlatform/beam | Project-original code | TEMP | assets/env/rafters/rafter-beam-one-way-.glb |
| ENV-03-002 | Hay catch bed | catchbed solids | props.hayBale | Project-original code | TEMP | assets/env/rafters/hay-catch-bed.glb |
| ENV-03-003 | Hanging rope | bucket rope / backdrop | ArenaView bucket | Project-original code | TEMP | assets/env/rafters/hanging-rope.glb |
| ENV-03-004 | Crown perch (goal) | perch/finish | props.crownPerch | Project-original code | TEMP | assets/env/rafters/crown-perch-goal-.glb |
| ENV-03-005 | Barn interior backdrop | backdrop | themes.buildBackdrop | Project-original code | TEMP | assets/env/rafters/barn-interior-backdrop.glb |
| ENV-04-001 | Dirt / grass ground | arena floor | ArenaView floor | Project-original code | TEMP | assets/env/farmyard/dirt-grass-ground.glb |
| ENV-04-002 | Fence (tall) | fence solids h 1.3 | props.fence | Project-original code | TEMP | assets/env/farmyard/fence-tall-.glb |
| ENV-04-003 | Low vault fence | fence solids h 0.5 | props.fence | Project-original code | TEMP | assets/env/farmyard/low-vault-fence.glb |
| ENV-04-004 | Gate | gate entity | props.gate | Project-original code | TEMP | assets/env/farmyard/gate.glb |
| ENV-04-005 | Scratch patch | scratch entity | props.scratchPatch | Project-original code | TEMP | assets/env/farmyard/scratch-patch.glb |
| ENV-04-006 | Basket (owner ribbon) | basket entity | props.basket | Project-original code | TEMP | assets/env/farmyard/basket-owner-ribbon-.glb |
| ENV-04-007 | Corn pile | cornpile entity | props.cornPile | Project-original code | TEMP | assets/env/farmyard/corn-pile.glb |
| ENV-04-008 | Coop wall / barn | coop solids / backdrop | ArenaView coop, props.barn | Project-original code | TEMP | assets/env/farmyard/coop-wall-barn.glb |
| ENV-04-009 | Pond | water solids | ArenaView water | Project-original code | TEMP | assets/env/farmyard/pond.glb |
| ENV-05-001 | Race lane floor | ground solids | props.slab | Project-original code | TEMP | assets/env/championship/race-lane-floor.glb |
| ENV-05-002 | Starting gate / finish ribbon | finish + deco | props.ribbonArch | Project-original code | TEMP | assets/env/championship/starting-gate-finish-ribbon.glb |
| ENV-05-003 | Tiered perch beams | beam solids | props.plankPlatform | Project-original code | TEMP | assets/env/championship/tiered-perch-beams.glb |
| ENV-05-004 | Scoreboard | deco | ArenaView.deco scoreboard | Project-original code | TEMP | assets/env/championship/scoreboard.glb |
| ENV-05-005 | Podium / trophy | deco | props.trophy | Project-original code | TEMP | assets/env/championship/podium-trophy.glb |
| ENV-05-006 | Bunting / spectator stands | backdrop | props.bunting, themes | Project-original code | TEMP | assets/env/championship/bunting-spectator-stands.glb |

## Obstacles

| ID | Name | Canonical interaction | Collider | Animation | Audio events | Status |
|---|---|---|---|---|---|---|
| OBS-01 | Rolling Egg | Telegraphed; dodge or hop. Gentle bump setback. | circle r 0.35–0.42, telegraph 0.8 s | procedural (ArenaView.update) | haz.egg.release, haz.bump | TEMP |
| OBS-02 | Mud Puddle | Slows movement. | zone (speed ×0.55) | procedural (ArenaView.update) | haz.mud, move.step.mud | TEMP |
| OBS-03 | Swinging Bucket | Time your crossing; marked buckets can be ridden. | pendulum box 0.9×0.55, bumps when |v|>1.2 | procedural (ArenaView.update) | haz.creak, haz.bump | TEMP |
| OBS-04 | Wobbly Perch | Tilts and sways; balance or brace. | one-way tilt platform | procedural (ArenaView.update) | haz.creak | TEMP |
| OBS-05 | Straw Barrier | Peck to break. | solid box, hp 3 | procedural (ArenaView.update) | act.peck, act.break | TEMP |
| OBS-06 | Low Fence Gap | Duck underneath. | solid above duck height | procedural (ArenaView.update) | — | TEMP |
| OBS-07 | Heavy Hay Bale | Push to open an optional route. | pushable box, mass 1.0 | procedural (ArenaView.update) | act.push | TEMP |
| OBS-08 | Moving Crate Platform | Ride and jump. | one-way moving platform (carries riders) | procedural (ArenaView.update) | act.push (rail) | TEMP |
| OBS-09 | Wind Gust | Telegraphed; changes airborne trajectory. | force zone with warning phase | procedural (ArenaView.update) | haz.wind.warn | TEMP |
| OBS-10 | Seed Spill | Slippery: less grip and braking. | zone (accel ×0.22–0.3) | procedural (ArenaView.update) | move.step.straw (slide) | TEMP |
| OBS-11 | Springy Branch | Timed bounce. | one-way bounce pad | procedural (ArenaView.update) | haz.spring | TEMP |
| OBS-12 | Tug Worm | Get in position and hold interact to pull. No mashing. | hold-to-tug point, tether 0.95 m | procedural (ArenaView.update) | act.tug, pick.worm | TEMP |

## Power-ups

| ID | Name | Duration | Effect | Audio | Status |
|---|---|---|---|---|---|
| PU-01 | Speed Seed | 6 s | +25% move speed | pu.get / pu.expire | TEMP |
| PU-02 | Super Flap | 6 s | Less flap drain, more airtime | pu.get / pu.expire | TEMP |
| PU-03 | Worm Magnet | 8 s | Pulls nearby loose treats | pu.get / pu.expire | TEMP |
| PU-04 | Shell Shield | 10 s | Blocks one bump | pu.get / pu.expire | TEMP |
| PU-05 | Power Corn | 8 s | +35% pushing strength | pu.get / pu.expire | TEMP |
| PU-06 | Sticky Toes | 8 s | Better grip on perches and slippery ground | pu.get / pu.expire | TEMP |
| PU-07 | Double Crumb | 8 s | Loose crumbs count twice | pu.get / pu.expire | TEMP |
| PU-08 | Cool Breeze | instant | Restores 40% flap stamina | pu.get / pu.expire | TEMP |

## Collectibles

| ID | Name | Notes | Audio | Status |
|---|---|---|---|---|
| COL-01 | Crumb | Standard collectible. | pick.crumb | TEMP |
| COL-02 | Worm | Higher value; won by tugging. | pick.worm | TEMP |
| COL-03 | Golden Feather | Rare; mastery and cosmetics. | pick.feather | TEMP |
| COL-04 | Corn Bundle | Heavy delivery cargo. | pick.bundle | TEMP |

## Class abilities

| ID | Name | Class | Cooldown | Duration | Stage evolution | Audio |
|---|---|---|---|---|---|---|
| AB-01 | Zoomies | Speedy | 6 s | 0.65 s | Quick scuttle → Dash → Running flap launch → Dash and snatch → Full Zoomies | ab.zoomies |
| AB-02 | Fluff Bump | Mighty | 7 s | 0.3 s | Sturdy nudge → Shove → Perch brace → Heavy shove → Full Fluff Bump | ab.fluffbump |
| AB-03 | Fancy Feathers | Nimble | 6 s | 0.4 s | Springy hop → Double hop → Controlled glide → Vault and dodge → Full Fancy Feathers | ab.fancy |

## UI

| ID | Asset | Source | Licence | Status |
|---|---|---|---|---|
| UI-001 | Wood panels, ivory cards, buttons (normal/hover/pressed/focus/disabled) | src/ui/ui.css | Project-original | TEMP-styled CSS (final art pass pending) |
| UI-002 | Fonts: Fredoka, Nunito | @fontsource (bundled woff2) | SIL OFL 1.1 | FINAL (licensed) |
| UI-003 | Chick portraits | src/ui/Portraits.ts (rendered from models) | Project-original | TEMP |
| UI-004 | Icons (class, objective, power glyphs) | Unicode glyphs + CSS | n/a | TEMP |
