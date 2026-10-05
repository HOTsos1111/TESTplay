# Canonical Design — Classes, Growth, Rules, Balance

Values here are mirrored from code (`src/data/*.ts`, `src/sim/*.ts`). They are **initial tuning hypotheses**, not final balance claims.

## Classes (brief §6)

| Class | Run speed | Push force | Jump height | Flap endurance | Bump resistance | Signature ability | Optional route |
|---|---:|---:|---:|---:|---:|---|---|
| Speedy | 1.20 | 0.75 | 0.95 | 0.90 | 0.85 | AB-01 Zoomies — 0.65 s ground dash ×1.9, 6 s cooldown | Gold sprint |
| Mighty | 0.85 | 1.30 | 0.85 | 0.85 | 1.30 | AB-02 Fluff Bump — forward nudge: staggers a sibling, shoves props, breaks straw; 7 s cooldown | Red shove |
| Nimble | 1.00 | 0.75 | 1.20 | 1.25 | 0.75 | AB-03 Fancy Feathers — evasive hop / air hop + 0.45 s sibling-dodge window; 6 s cooldown | Teal aerial |

Ability evolution by stage: Zoomies (quick scuttle → dash → running flap launch → dash-and-snatch → full), Fluff Bump (sturdy nudge → shove → perch brace → heavy shove → full), Fancy Feathers (springy hop → double hop → controlled glide → vault & dodge → full).

Every class also has a **peck-nudge** (interact next to a sibling): gentle shove, no stun, 0.9 s cooldown, scaled by the target's bump resistance and bracing.

## Growth stages (brief §4, §10)

| Stage | Name | Side run / jump h | Top run / hop h | Collider (side w×h) | Mechanics unlocked |
|---|---|---|---|---|---|
| 1 | Hatchling | 4.0 / 1.0 m | 3.4 / 0.45 m | 0.50×0.55 | move, hop, collect, nudge, tug |
| 2 | Fluffy Chick | 5.0 / 1.75 m | 4.0 / 0.55 m | 0.62×0.72 | + duck, peck straw, push |
| 3 | Awkward Adolescent | 5.3 / 1.9 m | 4.4 / 0.7 m | 0.66×0.86 | + flap (stamina 3), glide, brace, carry |
| 4 | Young Chicken | 5.7 / 2.0 m | 4.7 / 0.85 m | 0.70×0.92 | + vault low fences |
| 5 | Almost Grown | 6.0 / 2.1 m | 5.0 / 0.9 m | 0.72×0.96 | everything; stamina 3.4 |

Class multipliers apply on top (jump multiplier scales **height**). Weakest-class reach that common routes are authored within: stage-2 Mighty ≈ 1.49 m up / ≈ 2.5 m across; stage-3 Mighty ≈ 1.6 m up plus two flaps.

## Movement feel

Fixed 120 Hz simulation, interpolated rendering. Jump buffer 100 ms, coyote time 100 ms, variable jump (release clamps rise to 3.5 m/s), diagonal input normalised, acceleration/braking per stage; mud ×0.55 speed; seed spill cuts acceleration/braking to 22–30%; Sticky Toes restores most grip. Duck + Jump drops through planks. Stunned chicks keep momentum; recovery protection (1.2 s) prevents chain-stuns.

## Power-ups (brief §9)

| ID | Name | Effect | Duration |
|---|---|---|---|
| PU-01 | Speed Seed | +25% move speed (final speed capped) | 6 s |
| PU-02 | Super Flap | flap/glide stamina drain ×0.45, flap lift ×1.2; no refill | 6 s |
| PU-03 | Worm Magnet | loose crumbs/treats within 3.2 m with line of sight; never from walls or others' cargo | 8 s |
| PU-04 | Shell Shield | absorbs one bump | 10 s |
| PU-05 | Power Corn | +35% pushing strength (not speed) | 8 s |
| PU-06 | Sticky Toes | perch tilt slide ×0.25, slippery ground mostly cancelled, mud less slow | 8 s |
| PU-07 | Double Crumb | loose crumbs count twice; never worms, bundles or banked score | 8 s |
| PU-08 | Cool Breeze | instantly restores 40% max flap stamina | instant |

Same power refreshes duration (no stacking). Max two timed powers; a third replaces the one nearest expiry, with on-screen feedback.

## Objectives and success

| Objective | Pass condition (standard) | Relaxed difficulty |
|---|---|---|
| collect / tug / perch / deliver / reach | complete the objective; finish order only affects medals | same |
| race with `requireFirst`, deliver/reach with `requireFirst`, relay, most-deliveries | first place | finishing counts |
| showdown | most points (5/3/2/1 per round); top tie → crumb scramble | finishing counts |

Medals: Complete, First, plus Time (≤ target) or Golden Feathers where defined. Up to 3 stars per level.

## Siblings & AI (brief §7)

Personalities (independent of class): **bossy & confident**, **scrappy & competitive**, **snack-loving & distractible**. Line-up per generation is deterministic from the family seed: the two classes you didn't pick plus one seeded pick. Skill curve (bounded): relaxed → standard → expert, sharpened gently by generation; changes only reaction time (0.32→0.12 s), hesitation rate and route/ability choices. No teleporting, no hidden speed advantages, no rubber-banding.

## Generations & difficulty (brief §10)

- Hazard tempo +6% per generation, capped at +20%.
- Variants: gen 1 none, gen 2 one, gen 3+ two seeded variants per level from that level's authored pool (extra telegraphed eggs, gusts, mud, seed). Variants never shrink platforms or widen gaps; tests confirm every gen-3 variant is completable by the weakest jumper.
- Family perk: one modest perk chosen at the new brood (≤5%: Quick Feet +4% run, Strong Shoulders +5% push, Light Wings +5% flap, Springy Legs +4% jump, Sturdy Fluff +5% bump resistance). Never cumulative; any class may be chosen.

## Known balance questions (need human playtests)

1. **Mighty in finish-first races** is the hardest matchup against Speedy rivals (base run 0.85 vs 1.20). Red shortcuts, Fluff Bump and straw smashing help, but the gap may still be too large at standard difficulty.
2. **Perch levels with four contenders** (1-5, 3-5, 5-2) resolve in roughly 1.5–4 min of AI-vs-AI time; human players who nudge and brace should finish faster.
3. Speedy rivals sometimes beat the no-ability autopilot in 2-x races; human use of abilities and class routes is expected to win.
