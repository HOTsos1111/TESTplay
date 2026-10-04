# Asset manifest

The source of truth is `src/data/assetManifest.ts`. **Every asset is currently a procedural placeholder** generated at runtime (Canvas 2D at 2× logical size) by `src/systems/art/*.ts`.

## Replacing an asset

1. Export a transparent PNG at 2× the logical size below to `public/<file>`.
2. Set `placeholder: false` on its manifest entry.
3. Collision is defined in data (`src/data/config.ts`, `OBJECT_SIZE` in `src/data/chunks.ts`), so art can change freely. Keep feet or bottom edges where the notes say.

## Keys

| Key | Logical size | Replacement file | Notes |
|---|---|---|---|
| hero_body | 124×58 | assets/player/hero_body.png | rig part; pivot centre, at (−6, −36) from the feet |
| hero_head | 76×62 | assets/player/hero_head.png | pivot (0.32, 0.62) at the neck |
| hero_ear | 28×42 | assets/player/hero_ear.png | pivot top; spring-animated |
| hero_leg_near / hero_leg_far | 18×28 | assets/player/… | pivot at the hip (0.5, 0.14) |
| hero_tail | 38×16 | assets/player/hero_tail.png | pivot at the base (0.92, 0.5) |
| hero_propeller | 64×64 | assets/player/hero_propeller.png | spinning hover blur |
| hero_collar, hero_mouth | 18×42, 22×18 | assets/player/… | |
| hero_eye_{open,determined,surprised,happy,closed,dizzy} | 26×26 | assets/player/… | expression swaps |
| shadow | 120×20 | assets/fx/shadow.png | separate oval ground shadow |
| squirrel_{idle,taunt,throw,run,startled} | 90×90 | assets/enemies/… | feet at bottom centre, faces left |
| acorn | 22×24 | assets/enemies/acorn.png | |
| dogcatcher_{walk,run,windup,frustrated,tumble} | 170×250 | assets/enemies/… | feet at (90, 246), faces left |
| trolley_body / trolley_door / trolley_wheel | 300×180 / 30×110 / 56×56 | assets/enemies/… | |
| trolley_latch_{intact,damaged,broken} | 44×56 | assets/enemies/… | |
| parcel_small / parcel_big | 46×42 / 58×56 | assets/props/… | |
| crate, cardboard, cardboard_breaking, cardboard_flat, tyre, bone, exit_gate, gate_door, toy | see manifest | assets/props/… | |
| platform_mid / _left / _right / _leg | 64×18 / 16×18 / 16×120 | assets/tiles/… | mid tiles horizontally |
| ground_mid / ground_edge_left / ground_edge_right | 64×120 / 24×120 | assets/tiles/… | mid tiles horizontally |
| depot_far / depot_mid / depot_near | 1280×720 | assets/backgrounds/… | left and right edges must match for looping; near includes the dark pit band below y = 600 |
| story_garden, story_truck_open, story_truck_closed | 1280×720, 520×300 | assets/backgrounds/… | opening sequence |
| fx_puff, fx_star, fx_sparkle, fx_exclaim, cardboard_bit, scent | small | assets/fx/… | |
| heart_{full,empty,lost}, icon_tail, icon_tail_empty, icon_bark, icon_pause, btn_jump, btn_bark, badge_ch1…6 | see manifest | assets/ui/… | no baked text |

## Hero: rig vs. atlas

The handoff's export contract asks for 384×256 hero frames with an atlas JSON (baseline y = 216, pivot x = 192). The slice uses a procedural multi-part rig instead (`src/entities/HeroView.ts`), which gives the squash/stretch, delayed rear end, spring ears and propeller tail without drawn frames. To move to the drawn atlas, replace `HeroView` with a sprite-based view that has the same API (`update`, `setMode`, `bark`, `hit`, `land`, `takeoff`). Collision is in `PlayerController`, so nothing else changes.

## Still needed (from the handoff checklist)

- P0 final art for everything above; the title wordmark (currently styled live text); the Parody Games logo (currently a text credit, as instructed).
- Recorded audio (music_title/depot/chase, barks, SFX). The procedural audio is temporary.
- All P1 environment packs (shopping_street, city_park, back_alleys, neighbourhood, home), P1 enemies (pigeon, goose, raccoon, yard dog), story ending panels and the route-map art.
