# Animation Catalogue

All animation is **procedural (TEMP)** in `src/render/ChickModel.ts`: squash/stretch on a body pivot, leg swing, wing rotation, head dip, beak open, blink, expressions. Sim state (`Actor.anim`) drives it; semantic events trigger expressions and FX. Final production would replace this with skinned glTF clips using the same state names.

| State / clip | Trigger | Implemented (procedural) | Notes for final animation |
|---|---|---|---|
| idle (+ breathing, blink) | grounded, no input | ✔ | add idle variants & look-around |
| look-at | — | partial (intent exposed by AI) | head IK toward intent / nearby sibling |
| walk / run (speed-scaled cycle) | moving | ✔ | foot-contact events drive footsteps (currently distance-based) |
| braking / turning | direction change | smooth turn only | add skid pose |
| jump takeoff / airborne | jump | ✔ (stretch, wings up) | anticipation frames kept minimal |
| flap | mid-air jump | ✔ (fast wing beat) | adolescent "funny imperfect flapping" |
| glide | hold jump falling | ✔ (wings out) | |
| land soft / hard | land event | ✔ (squash; dust on hard) | |
| duck | duck held | ✔ | |
| brace | duck held, stage ≥3 | ✔ (wide, puffed) | |
| peck | interact | ✔ (head dip) | |
| scratch | hold on patch | ✔ (head dip + foot scratch) | |
| shove / push | pushing a prop | ✔ (strong lean) | |
| carry | carrying cargo | ✔ (item at beak, wings up) | |
| tug | holding a worm | ✔ (lean back) | |
| bumped stagger | bump | ✔ (wobble spin, startled) | |
| safe respawn | respawn | ✔ (blink-in protection flicker) | |
| ability: Zoomies / Fluff Bump / Fancy Feathers | ability | ✔ (lean dash / puff / spin) | |
| pickup delight | pickup | ✔ (happy expression + sparkle) | |
| frustration (sulking) | lost results | ✔ expression | |
| celebration | finished / win | ✔ (hops, wings up) | |
| growth transition | Grow Up! | ✔ (MenuScene spin-swap with bloom) | |
| parent cheering | adult celebration | ✔ (celebrate) | dedicated parent clips |
| egg hatch | new brood | ✔ (egg wobble, pop, chick grows in) | crack decals |

Expressions: happy, determined (brows), startled, sulking, victory.
