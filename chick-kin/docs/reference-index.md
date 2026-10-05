# Reference Index

Concept boards are **visual references only**; they are not used as textures, sprites or UI backgrounds. Written rules in `game-brief.md` override any conflicting caption, number or route annotation on a board.

## Files received and stored (`chick-kin/reference/`)

| File (stored name) | As uploaded | Role | Key rules extracted | Conflicts / corrections applied | Production status |
|---|---|---|---|---|---|
| `foundations-overview-sheet.webp` | upload 4 (first wave) | 2×2 composite of: 01 Character Foundation, 02 Level Location Foundation, 05 UX/UI Foundation, 04 Power-ups & Objectives | Overall palette and silhouettes; six screen layouts; chapter settings | Brief says do **not** take exact colours/rules from the overview collage; individual boards (shown in chat) take precedence | Used for direction only |
| `ux-ui-foundation.webp` | upload 5 | UX/UI Foundation: title, chick select, level map, HUD, results & growth, family tree; button states | Wood frames + ivory cards, egg level nodes, 5 chapter tabs, crumb/position/power chips, ability badge, "Stage Complete!" banner, "You're Growing!" panel, "Choose Your Chick" | Text is real HTML (not baked); every button has normal/hover/pressed/focus/disabled states | Recreated as responsive DOM UI (TEMP styling) |
| `ch01-nest-scramble.webp` | upload 6 | Stage 1 boards 1-1…1-5 + asset catalogue | Close top-down arenas; 10/15/20 crumbs; 3 tug worms; 15 s perch; straw rim, dividers, plugs, egg ramp, mound perch; Speed Seed, Shell Shield | Route arrows treated as intent, not exact geometry | Levels 1-1…1-5 implemented |
| `ch02-coop-dash.webp` | upload 3 | Stage 2 boards + asset catalogue | Side-view race; low fence gap (duck), straw barrier (peck), heavy hay bale (push), moving crate platform, mud, ribbons, lantern checkpoints; Speed Seed, Worm Magnet, Power Corn | Board marks straw as "peck" — kept (not push-only). PU-03 shown as race item; implemented as loose-treat magnet per brief | Levels 2-1…2-5 implemented |
| `ch03-rafter-rivals.webp` | upload 7 | Stage 3 boards + asset catalogue | Vertical climb; flap stamina, glide; wobbly perch, swinging bucket, wind gust, springy branch; 3 golden feathers (3-3); crown perch (3-5); Super Flap, Sticky Toes, Cool Breeze | Board says Super Flap "refills stamina" — brief overrides (reduces drain, no refill). Cool Breeze is a stamina restore, not a wind buff | Levels 3-1…3-5 implemented |
| `ch04-farmyard-mischief.webp` | upload 2 | Stage 4 boards + asset catalogue | Three-quarter delivery; scratch patches, baskets, gates, low vault fences, movable crates/bales, mud, seed spill; 10/15 treats, 3 bundles, 20 treats, most deliveries in 120 s | Board shows 3 baskets for Yard Boss; brief requires valid ownership for 4 competitors → **4 marked baskets**. Board ID "PU-05 Power Corn temporary speed boost" — brief overrides: pushing strength only | Levels 4-1…4-5 implemented |
| `ch05-barnyard-championship.webp` | upload 1 | Stage 5 boards + asset catalogue | Sprint final, perch final (20 s), harvest haul (5 bundles), farmyard relay, sibling showdown (race→perch→haul), scoreboard, podium, trophy | Showdown scoring 5/3/2/1 + crumb-scramble tie-break from the brief | Levels 5-1…5-5 implemented |
| `game-brief.md` (in `docs/`) | `CHICK_KIN_Claude_Code_Full_Game_Prompt.md` | Authoritative gameplay/design spec | All rules | — | Implemented; see implementation-plan.md |

## Boards seen in chat but not received as files

These were viewed in the conversation (and used for direction) but did not arrive as files on disk, so they are not stored in the repository: **01 Character Foundation** (full size), **02 Level Location Foundation** (full size), **03 Obstacle Foundation** (OBS-01…12 + speed/strength/agility route strips), **04 Power Ups and Objectives** (full size). Their content matches the composite sheet and the brief; the Obstacle Foundation's 12 obstacles are implemented per the brief's canonical table. Re-uploading them as files would let them be archived alongside the others.

## Art rules extracted (applied to the procedural models)

- **Speedy:** golden-yellow plumage, swept-back coral tuft, slim oval body. **Mighty:** rich warm red, crimson wings/tuft, salmon face/chest, broad round body (revised red Mighty overrides cream/apricot). **Nimble:** pale lavender, teal tuft, petite light body.
- Big, wide-set glossy eyes with highlights; tiny orange beak and feet; rosy cheeks; velvety fluff. Class identity = colour **and** silhouette **and** icon.
- Growth: hatchling → fluffy chick → awkward adolescent (longer legs/neck) → young chicken → almost grown → adult parent (comb, wattle, tail). Proportions change, not a uniform scale.
- Wings, not hands: carried items sit at the beak.
- Personality is independent of class (the boards' "bold/gentle/clever" taglines are not applied as class rules).
