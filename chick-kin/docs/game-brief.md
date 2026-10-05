# CHICK KIN — Full Game Development Prompt for Claude Code

You are the lead gameplay engineer, technical artist, animation director, UI engineer, audio implementer, and QA lead for CHICK KIN. Build a complete, polished, original game suitable for eventual public distribution. Work incrementally in the repository, implement and test working systems, and maintain honest milestone and release-readiness reports. Do not stop at a design document, static mockup, title screen, or one playable level.

The supplied images are visual reference boards, not finished sprites, rigs, models, animation clips, or modular game assets. Inspect all uploaded references before choosing the rendering and asset-production approach. Maintain the selected Soft 3D aesthetic throughout. If the production art or audio required to reach the target is unavailable, build replaceable asset pipelines and a clearly labelled prototype, identify the missing deliverables, and continue implementing the game. Never claim placeholder art or synthetic test audio meets the final quality bar.

## 1. Product vision and scope

CHICK KIN is a super-cute farm adventure about affectionate sibling rivalry. Choose one of three chick classes, compete against siblings through five growth stages, become an adult chicken, hatch a new brood, and play the next generation at greater difficulty.

The central promise: gameplay structure changes when the character grows. Each stage has five increasingly difficult levels. Complete all five, experience a visible growth transformation, learn the next format, and continue. One generation contains 25 levels. Fully grown adulthood is the completion state after stage five, not a sixth playable chapter. Hatching occurs only after completing the entire generation.

Launch scope: single player with three AI siblings, all three playable classes, all five gameplay formats, 25 authored levels, save/resume, class selection every generation, family tree, bounded difficulty escalation, polished menus, controller and keyboard support, audio controls, accessibility, credits, and a distributable build. Local or online multiplayer, online leaderboards, accounts, stores, advertising, and in-app purchases are outside this scope.

Audience and tone: welcoming, family-friendly, playful, energetic, mischievous. Competition uses nudges, treat stealing, races, and comic reactions. No injury, gore, weapons, cruelty, or death loop. Failure means wobbling, losing time, dropping cargo, or returning to a safe checkpoint.

## 2. Reference hierarchy and image interpretation

Use these uploaded reference groups, identifying files by visible content if their filenames differ:

1. Revised Character Foundation: golden-yellow SPEEDY, warm-red MIGHTY, lavender/teal NIMBLE; turnarounds, growth silhouettes, expressions and ability poses.
2. Revised Level Location Foundation: overall five-stage settings and cameras.
3. Revised Obstacle Foundation: 12 obstacle designs and their broad interactions.
4. Revised Power Ups and Objectives: collectible, power-up and class-ability appearance.
5. Revised UX UI Foundation: wooden panels, egg motifs, chick selection, chapter map, HUD, results and family tree.
6. Five stage-specific level/asset boards: Nest Scramble, Coop Dash, Rafter Rivals, Farmyard Mischief, Barnyard Championship.

Written rules in THIS document override any conflicting generated caption, number, gameplay effect, route annotation, or asset ID in an image. Revised red-Mighty sheets override older cream/apricot-Mighty sheets. Do not use the overview collage as a source for exact character colours or gameplay rules; prefer individual boards. Some generated pictures show chick hands, ambiguous route geometry, incorrect growth ages, or inconsistent collectible IDs: correct these in implementation. Birds have wings and beaks; carrying uses beak or a readable wing-supported carry pose. Personality is independent of class. A depicted bossy or gentle personality does not make every member of that class bossy or gentle.

Create a reference index recording actual uploaded filename, role, extracted art rules, conflicts resolved, and asset-production status. Never invent files or claim you inspected an inaccessible attachment. If references are missing, enumerate them and continue with accessible references and these written rules.

Do not place whole reference boards behind gameplay, use screenshots as functional menus, stretch tiny crops into final textures, or silently replace the aesthetic with basic circles, generic icons, pixel art, or flat emoji. Boards guide creation of isolated assets and reusable environment pieces.

## 3. Engine, platform, and technical approach

First inspect the existing repository and its instructions. Preserve its engine if suitable. For a greenfield project, use Godot 4 stable with typed GDScript and a true 3D world, orthographic or restrained perspective cameras for 2.5D play, and data-driven content. Target desktop distribution first. A browser build is optional after the desktop game works; document export constraints rather than compromising core quality. If the repository is already a browser game, retain that platform and explicitly explain how the selected stack will support the visual target. Do not switch engines repeatedly.

Use installed, supported tools and pin dependencies. Verify engine-specific API details against installed documentation or official documentation when necessary. Keep production-quality renderer features scalable. Create high/medium/low presets, with simplified feather treatment, shadows, particles, and postprocessing on lower tiers. Fluff can use modelled feather clumps and carefully budgeted fur cards; do not require dense simulated fur for every chick.

Separate simulation from presentation. Use a stable physics timestep, interpolate visuals, centralise input actions, and drive UI/audio through semantic gameplay events. Store chapter and level definitions, obstacles, class tuning, objectives, variants and audio events in inspectable resources/data. Version save data. Use seeded variants for reproducibility. Avoid one giant gameplay script and duplicated chapter implementations.

Suggested system boundaries: GameFlow, SaveManager, InputRouter, CharacterController, ClassAbility, GrowthProfile, RivalAI, LevelManager, ObjectiveTracker, ObstacleBehaviour, PickupSystem, GenerationDirector, CameraDirector, AnimationDirector, AudioDirector, UIFlow, AccessibilitySettings, and AssetRegistry.

Use explicit states: Boot → Title → ChickSelect/Continue → ChapterMap → LevelIntro → Playing → Results → NextLevel or Growth → next ChapterMap; after 5-5 → AdultCelebration → NewBrood → ChickSelect for next generation. Pause, restart, and settings must resume correctly. Show an ending/credits option after the first completed generation as well as continuing the family.

## 4. Art, character, and animation direction

Premium Soft 3D: extremely appealing rounded silhouettes, soft feather detail, large expressive eyes, tiny orange feet and beaks, warm farm light, tactile wood, straw and painted props. Environmental colour supports legibility; hazards and goals remain readable against warm backgrounds. Keep character contrast during mud, dusk, interior shadows, and visual effects.

SPEEDY: golden-yellow plumage, swept-back coral tuft, slim oval body. MIGHTY: rich warm brick/coral-red dominant plumage, crimson wings and tuft, salmon facial/chest accents, broad round body. NIMBLE: pale lavender plumage, teal tuft, petite light body. Class identity uses colour AND silhouette AND icon. Match the approved reference proportions closely, especially face shape and eye spacing.

Five immature growth stages: hatchling, fluffy chick, awkward adolescent, young chicken, almost grown. Adult parent follows completion. Growth changes proportion, feather coverage, wing development, posture, movement and available mechanics, while retaining class identity. Adolescents have slightly gangly proportions and funny imperfect flapping. Do not merely uniformly scale the same chick five times.

Animation catalogue: idle variants; blink; look-at; walk/wobble; accelerating run; braking; turning; hop/jump takeoff; airborne flap; glide; landing soft/hard; duck; peck; scratch; shove; brace; carry and drop; tug; bumped stagger; safe respawn; ability activation/recovery; pickup delight; frustration; celebration; growth transition; parent cheering; egg hatch. Define class-specific timing and poses. Synchronise foot contact, peck impacts, feather motion and audio with animation events. Keep gameplay responsiveness above elaborate anticipation. Use blend transitions, squash/stretch within appealing limits, IK where helpful, contact shadows and restrained hit-stop. Gameplay hazards telegraph before activation.

Create modular environment kits for all chapters, colliders separate from decorative meshes, stable pivots, consistent scale, reusable material palette, texture atlases where practical, and performance-aware LODs. Keep decorative clutter outside critical sightlines.

## 5. Controls and game feel

One stable input vocabulary across all stages; contextual interpretation changes with growth. Default keyboard: WASD/arrows move; Space jump/flap; E interact/peck/carry; Shift signature ability; Ctrl/C duck/brace; Escape pause. Controller: left stick move, south button jump/flap, west interact, east ability, left shoulder duck/brace, Start pause. All gameplay actions remappable; tutorial prompts use the active binding and device.

Top-down stages use planar movement; side-scrolling/vertical stages constrain movement to the appropriate play plane. Provide acceleration, friction, predictable braking, jump buffering, coyote time, variable jump height, clear ledge/collision rules, and safe camera bounds. Initial prototype values: 100 ms jump buffer and 100 ms coyote time, then tune through playtesting. Normalize diagonal speed. Introduce unfamiliar chapter mechanics through a short playable opening rather than an unavoidable long tutorial.

Contextual interactions must select nearby targets predictably. Show an icon when carrying, tugging or pushing is available. Prevent accidental cargo drops from unrelated input. Provide hold/toggle options for repeated interactions. No mandatory rapid button mashing.

No lives counter. Restart level and exit to map are always available. Hazards create short setbacks with brief recovery protection, avoiding chain-stun. Camera shake and flash intensity are adjustable, and critical indicators are not colour-only. HUD stays outside traversal sightlines.

## 6. Three balanced chick classes

Initial relative tuning is a hypothesis, not a final balance claim:

| Class | Run speed | Push force | Jump height | Flap endurance | Bump resistance |
|---|---:|---:|---:|---:|---:|
| Speedy | 1.20 | 0.75 | 0.95 | 0.90 | 0.85 |
| Mighty | 0.85 | 1.30 | 0.85 | 0.85 | 1.30 |
| Nimble | 1.00 | 0.75 | 1.20 | 1.25 | 0.75 |

Baseline changes with stage. Lower Mighty jumping must never make the common route impossible. Nimble's stronger airtime is short assisted gliding, not unrestricted flight.

Signature abilities, starting tuning:
- Speedy / AB-01 Zoomies: approximately 0.65-second ground dash, 6-second cooldown. Advanced stages permit timing-based chaining and passing an opponent to snatch a loose treat. Solid walls remain solid; no arbitrary teleportation.
- Mighty / AB-02 Fluff Bump: brief forward nudge that moves eligible props or staggers a sibling, 7-second cooldown. Brace resists displacement while reducing movement. Heavy shortcuts open without permanently trapping competitors.
- Nimble / AB-03 Fancy Feathers: quick evasive hop/flap, 6-second cooldown. Evolves into controlled dodge/glide. Short avoidance window applies to sibling bumping, not all world hazards, and has clear feedback.

Growth evolution: stage 1 quick scuttle/sturdy nudge/springy hop; stage 2 dash/shove/double hop; stage 3 running flap launch/perch brace/controlled glide; stage 4 dash-and-snatch/heavy object movement/vault and dodge; stage 5 fully developed versions usable across the championship.

Counterplay: Speedy can intercept Nimble on the ground; Nimble can dodge Mighty and use elevated routes; Mighty can brace against Speedy and occupy direct lanes. Implement soft situational advantages and visible counters, not automatic win multipliers. All classes can win every level. Optional gold speed, red strength, and teal agility routes provide advantages, not exclusive completion paths.

## 7. Sibling AI and narrative

Three rivals have distinct personality profiles independent of class: bossy/confident, scrappy/competitive, snack-loving/distractible. Pick class compositions deterministically from the generation seed, ensuring useful class variety. Give each sibling a name, stable appearance, short visual reactions, and relationship history. Rivalries are funny and affectionate. Occasional playful parent reactions and milestone vignettes supply story without interrupting action repeatedly.

Use legitimate navigation and the same movement/ability rules as the player. Behaviour states include seek target, choose route, traverse, avoid hazard, contest resource, use ability, recover, deliver cargo, claim perch, celebrate. Use bounded decision delays and mistakes. Later generations improve anticipation and route choices. Do not teleport rivals to catch up, grant invisible speed advantages, or take resources through walls. If any assist/rubber-banding is included, make it bounded, disclosed, and separate from competitive record settings.

Show AI intent through glances, chirps and anticipation. Resolve ties deterministically using displayed criteria. Prevent camping softlocks, infinite tugging, inaccessible stolen objects, or unfair offscreen attacks. Limited symmetric resource replenishment keeps collection contests winnable.

## 8. Authored level programme: 25 levels

All times and counts below are initial design targets stored in level data and adjustable after testing. Typical levels should take about 2–4 minutes, with early tutorials shorter and final events longer. Race levels require first place by default; optional assist completion can allow finishing with clearly identified medals. Collection and traversal levels use their stated objective, not an unrelated finish-first rule. Each level has a start, objective, success condition, fail/retry condition if relevant, checkpoints, hazards, pickups, common route, class advantages and optional mastery medals.

### Stage 1 — Nest Scramble / hatchlings
Close-up overhead nest arenas. Wobble, hop, nudge, collect and tug. Introduce one mechanic at a time. No full glide or adolescent stamina system yet.

| ID | Level | Layout and objective |
|---|---|---|
| 1-1 | First Crumbs | Open oval nest; collect 10 crumbs; safe hops and a short shared route. |
| 1-2 | Egg Dodge | Winding nest lanes; rolling eggs telegraphed by ramp motion; collect 15 crumbs. |
| 1-3 | Worm Tug | Three linked mini-arenas; win three tug worms through positioning and sustained interaction, no mashing. |
| 1-4 | Nest Neighbours | Straw partitions, small gaps and shoveable plugs; collect 20 crumbs using interconnected routes. |
| 1-5 | Nest Champion | Central mound perch with ramp/hop approaches; accumulate 15 seconds of ownership. |

Asset kit: nest rims, low straw dividers, loose plugs, egg ramps, small mound perch, tiny wood ramps, rolling eggs, tug worms, crumbs, Speed Seed, Shell Shield. Ownership requires contact with a defined perch zone; contested occupancy pauses accumulation. Progress persists within the attempt. All classes can contest through common ramps.

### Stage 2 — Coop Dash / fluffy chicks
Side-scrolling platform races. Run, jump, duck, peck, push. Use clear fork/rejoin routes and moving-platform collision.

| ID | Level | Layout and objective |
|---|---|---|
| 2-1 | Coop Sprint | Gentle horizontal ramps and jump gaps; reach finish; introduce race timing without requiring first place. |
| 2-2 | Under and Over | Alternating low fence gaps and safe jump gaps; reach finish. |
| 2-3 | Straw Shortcut | Branching lanes and peckable barriers; finish first. |
| 2-4 | Mud Run | Moving crates above mud, longer sprint lane and shove shortcut; finish first. |
| 2-5 | Coop Cup | Full side-scrolling course combining duck, peck, jump, shove; finish first. |

Asset kit: wood floor segments, ramps, supports, coop panels, hay platforms, low gaps, straw barriers, heavy hay bales, moving crate platforms, mud, start/finish ribbons and checkpoint lanterns. Relevant powers: Speed Seed, Worm Magnet, Power Corn. Respawn returns to last safe checkpoint with brief protection and a time penalty, not a level reset. Platforms carry standing characters consistently.

### Stage 3 — Rafter Rivals / adolescents
Vertical platform climbing. Short flaps, controlled glides, balance, stamina, resting perches. Camera tracks the player; rival status is represented in HUD when offscreen.

| ID | Level | Layout and objective |
|---|---|---|
| 3-1 | First Flap | Stable staggered beams; reach upper goal perch. |
| 3-2 | Sway Away | Wobbly perches and safe recovery landings; reach upper perch. |
| 3-3 | Wind Wings | Gusts, spring branches and three golden feathers; collect all three and reach upper perch. |
| 3-4 | Bucket Crossing | Timed swinging buckets and stable landing beams; reach upper perch. |
| 3-5 | King of the Rafters | Branching ramps, brace interactions and aerial gaps; accumulate 15 seconds on crown perch. |

Asset kit: beams, landing platforms, support braces, wobbly perches, swinging buckets, gust volumes, spring branches, resting perches, hanging ropes, straw catch beds, golden feathers, crown perch. Powers: Super Flap, Sticky Toes, Cool Breeze. Land/rest regenerates flap stamina. Exhaustion permits a safe limited descent but no infinite hover. Add lower catch beds and checkpoints; ordinary falls should not erase minutes of progress. Nimble-only optional areas cannot hold mandatory objectives.

### Stage 4 — Farmyard Mischief / young chickens
Top-down three-quarter exploration and delivery competition. Scratch resources, carry bundles, move props, vault, steal loose treats and choose routes. No combat.

| ID | Level | Layout and objective |
|---|---|---|
| 4-1 | Scratch and Seek | Four scratch patches and central basket; deliver 10 treats. |
| 4-2 | Fence Favour | Gates, branching fences and low vault shortcuts; deliver 15 treats to barn basket. |
| 4-3 | Heavy Harvest | Movable crates/hay bales opening alternate routes; deliver three corn bundles to cart. |
| 4-4 | Slippery Business | Mud, seed spills and rival crossings; deliver 20 treats to coop basket. |
| 4-5 | Yard Boss | Three clearly marked scoring baskets and contested replenishing garden; most deliveries in 120 seconds. |

For Yard Boss, player and rivals are assigned destinations; ensure four competitors have valid scoring ownership even if a reference shows only three baskets. Use four baskets or clearly implement a shared neutral scoring basket. Do not leave a rival without a valid objective. Cargo slows movement modestly and drops visibly when bumped; dropped cargo remains recoverable. Cap carry load, distinguish loose treats from delivery cargo, and avoid stealing already banked score.

Asset kit: dirt/grass/path tiles, scratch patches, baskets, corn bundles, fences, low vault fences, gates, crates, hay bales, mud, seed spills and waypoint flags. Powers: Worm Magnet, Power Corn, Double Crumb. Automatically deliver valid cargo when inside the destination zone and interacting; avoid repeated manual inventory menus.

### Stage 5 — Barnyard Championship / almost grown
Five scored event levels drawing on learned mechanics. Race/relay sequences can change camera at marked transitions with brief reorientation and consistent controls. Avoid awkward three-dimensional movement in a visually side-on section. Distinct courses and arena events replace a single repetitive race template.

| ID | Level | Layout and objective |
|---|---|---|
| 5-1 | Sprint Final | Timed obstacle lanes, common route plus class shortcuts; first to finish. |
| 5-2 | Perch Final | Tiered beams, ramps and aerial approaches; accumulate 20 seconds of perch ownership. |
| 5-3 | Harvest Haul | Branching delivery lanes and heavier cargo; first to deliver five bundles. |
| 5-4 | Farmyard Relay | Ordered race, climb, collect and delivery checkpoints; first to complete all checkpoints. |
| 5-5 | Sibling Showdown | Three rounds: race, perch, haul. Award 5/3/2/1 points for placement per round; highest total wins. |

Tie-break for 5-5: one short, class-neutral crumb scramble; announce it visibly. Save completed championship levels, and permit retries of a failed event without replaying the whole chapter. 5-5's three rounds are within one level. Its result gates generation completion; no hidden requirement to win every optional mastery medal.

Asset kit: race lane floor, starting gates, finish ribbons, tiered perches, scoreboard, cargo baskets, corn bundles, checkpoints, hay bales, buckets, mud, wobbly perches, straw barriers, podium and trophy. Powers: Speed Seed, Super Flap, Shell Shield. After victory: adult transformation, family celebration, hatching vignette, optional credits, choose a new chick.

## 9. Canonical assets and effects

Use globally stable IDs. Environment IDs are chapter-namespaced, e.g. ENV-03-001, not reused ENV-01 labels across unrelated chapters. Build an asset manifest containing source, type, chapter usage, gameplay effect, collider, animation, audio event, licence, status and final export path.

| ID | Obstacle | Canonical interaction |
|---|---|---|
| OBS-01 | Rolling Egg | Telegraph, dodge or hop; gentle bump/setback. |
| OBS-02 | Mud Puddle | Slows movement; visual mud splashes. |
| OBS-03 | Swinging Bucket | Time crossing; eligible buckets can be ridden where explicitly marked. |
| OBS-04 | Wobbly Perch | Tilts/sways; balance or brace. |
| OBS-05 | Straw Barrier | Peck to break; do not change universally into a push-only barrier. |
| OBS-06 | Low Fence Gap | Duck underneath. |
| OBS-07 | Heavy Hay Bale | Push to open optional route. |
| OBS-08 | Moving Crate Platform | Ride and jump; not ordinary carryable inventory. |
| OBS-09 | Wind Gust | Modifies airborne trajectory with visible telegraph. |
| OBS-10 | Seed Spill | Reduces ground friction/braking. |
| OBS-11 | Springy Branch | Timed bounce. |
| OBS-12 | Tug Worm | Position and hold interaction to compete; no repeated button mashing. |

| ID | Power-up | Initial effect |
|---|---|---|
| PU-01 | Speed Seed | +25% movement speed for 6 seconds; bounded final speed. |
| PU-02 | Super Flap | Reduced airborne stamina drain and increased controlled airtime for 6 seconds; does not refill stamina by itself. |
| PU-03 | Worm Magnet | Attract loose nearby treats for 8 seconds; no extraction through walls or from opponents' cargo. |
| PU-04 | Shell Shield | Absorbs one bump, expires after 10 seconds; no invulnerability to all terrain. |
| PU-05 | Power Corn | +35% eligible pushing strength for 8 seconds, NOT a running-speed effect. |
| PU-06 | Sticky Toes | Better perch grip and reduced slippery-ground effect for 8 seconds. |
| PU-07 | Double Crumb | Each loose crumb collected counts twice for 8 seconds; no doubling worms, bundles, or already banked score. |
| PU-08 | Cool Breeze | Instantly restores 40% maximum flap stamina; NOT a wind trajectory buff. |

Same power refreshes duration without stacking multipliers. Limit simultaneous timed powers to two, with transparent replace/refresh feedback. Score effects do not exceed objective requirements or corrupt delivery accounting. Place powers intentionally, fairly for AI and player; avoid unrestricted random rolls deciding races.

Canonical collectibles: COL-01 Crumb, COL-02 Worm, COL-03 Golden Feather, COL-04 Corn Bundle. Scratch patches are environment interactables, not COL-01. Golden feathers award mastery/cosmetics; a specified level may require them. No collectible permanently raises class stats. Signature abilities AB-01/02/03 are separate from temporary powers.

## 10. Growth, generations, difficulty and progression

Level completion unlocks the next level. Completing the fifth level triggers growth; preserve identity while changing proportions and mechanics. Save before and after transitions. Per-level medals can reward objective completion, efficiency and optional exploration with chapter-appropriate criteria. Do not force an arbitrary timer onto exploratory introductory levels.

New brood always offers Speedy, Mighty and Nimble. A parent never locks the child into its class. Preserve family name, lineage, generation count, parent appearance, achievements, cosmetics and records. The new chick inherits one modest, explicitly described family perk; cap its mechanical effect around 5%, allow balanced choice, and never accumulate exponential stat bonuses. Cosmetics and story lineage can grow without that cap.

Difficulty rises through authored, seeded variants: additional telegraphed hazards, altered safe routes, better rival decisions, and tighter optional mastery targets. Reuse chapter mechanics while remixing terrain and resource placement. Begin with standard authored generation 1; generation 2 adds one approved variant per level; generation 3 adds two; generation 4+ uses a capped expert pool with seed variety. Suggested cap: hazard speed no more than +20% versus baseline, with reaction windows tested on target input devices. Required resource counts must remain feasible given spawn rules. Do not shrink platforms or widen gaps beyond the weakest class's validated reach.

Keep difficulty selectable separately from generation, including a relaxed mode. Give the new hatchling a brief reorientation even in late generations. Store variant seed and generation in records; compare times only under equivalent rules. Include a debug path to each stage, class, level and generation for testing.

## 11. UX/UI and accessibility

Recreate the reference design with actual responsive interactive UI: warm wooden frames, ivory cards, rounded legible text, generous targets, restrained egg motifs and colourful portraits. Use licensed fonts. Do not bake text into backgrounds. Define button normal/hover/pressed/focus/disabled states and use visible keyboard/controller focus.

Screens: title/new game/continue; chick select with abilities, strengths and weaknesses; chapter map with five chapter tabs and five levels per chapter; short level briefing; gameplay HUD; pause/restart/settings; level results; growth preview; championship standings; adult celebration/credits; family tree/new brood; credits/licences; save reset confirmation.

HUD shows only relevant information: collection count or delivery score, race position/time, perch ownership, stamina in chapter 3+, contextual interaction and ability cooldown. Power icons have duration/count indicators. Objective updates are concise. Offscreen sibling indicators must not clutter the playfield.

Support keyboard/controller navigation throughout, rebinding, subtitles for narrative vocalisations or meaningful dialogue, visual equivalents for essential audio cues, colour-independent markers, reduced motion, camera shake off, flash reduction, hold/toggle interactions, separate music/SFX/voice/ambience sliders, master mute and dynamic range modes. Avoid mandatory timed menus. Pause when focus is lost according to configurable policy. Provide clear save/autosave feedback.

## 12. Audio direction — premium game production brief

Audio should have the detail, musical responsiveness and mixing discipline associated with high-end game production, scaled to this project's actual budget. It must make interactions tactile, distinguish classes and spaces, communicate gameplay fairly, and sustain repeated generations without fatigue. A code agent can implement the system and audition mock cues; original recordings, performed music and final mastering may require licensed assets or specialist production. Track those dependencies honestly.

### Sonic identity

Warm, playful, tactile, expressive farm soundscape. Combine authentic material recordings with tasteful cartoon sweeteners. Chicks use charming nonverbal peeps, chirrups and clucks, not continuous speech or irritating squeaks. No imitation of a recognisable copyrighted score or performer. No generic stock loop repeated unchanged across 25 levels. No constant loud effects masking important cues.

Class signatures: Speedy bright, quick chirps plus feather whoosh; Mighty rounded lower chirrups, soft body thumps and firm footfalls; Nimble light fluttering trill and airy feather textures. Growth gently lowers register and broadens resonance through distinct recordings/layers rather than extreme pitch shifting. Each sibling's personality also influences timing and phrase choice. Limit idle vocal frequency and prioritise meaningful reactions.

### Music programme

Compose an original recognisable 4–8 bar CHICK KIN motif, transform it across all five stages, and return to a gentle version for new brood. Instrument palette: pizzicato strings, woodwinds, celesta, marimba/xylophone, acoustic guitar/banjo colours, light hand percussion, restrained brass for championship. Avoid endless novelty banjo or comedic honking.

| Cue family | Mood, palette and tempo target | Required material |
|---|---|---|
| Title | Welcoming, memorable; pizzicato, woodwind melody, warm guitar; 95–110 BPM | 60–90-second intro into 2–3-minute loop. |
| Chick select/map | Curious and relaxed; celesta, soft plucks; 85–100 BPM | Low-density loop and confirmation flourish. |
| Nest | Intimate playful discovery; music-box/celesta, soft marimba, light pizzicato; 90–105 BPM | 2–3-minute base loop plus activity and rivalry stems. |
| Coop | Forward momentum; acoustic rhythmic plucks, brushed percussion, woodwind; 115–135 BPM | 3–4-minute base, percussion, rivalry and final-stretch stems. |
| Rafters | Height, anticipation and lift; airy woodwinds, harp, light strings; 105–120 BPM | Base exploration, glide/lift, tension, and upper-perch layers. |
| Farmyard | Clever mischief; bass pizzicato, muted plucks, hand percussion; 100–115 BPM | Exploration, cargo/delivery, contest and timer-ending layers. |
| Championship | Celebratory athletic energy; full playful ensemble, restrained brass; 130–145 BPM | Race, perch and haul variants sharing harmonic language; final-round stem. |
| Growth | Wonder then confident reveal | 8–12-second transition with seamless entry/exit. |
| Adult/new brood | Warm family payoff; gentle theme reprise | 20–35-second celebration/hatching sequence, then soft selection loop. |
| Results | Rewarding but brief | Win/near-miss/medal stingers, 1–4 seconds, plus low-density results loop. |

Request approximately 18–25 minutes of original core music plus stems and variants, adjusted to the approved production budget. Each adaptive cue's stems share exact duration, tempo, sample rate, bar grid, and loop boundaries. Supply clean loop tails or separately identified transition tails. Use 2–4 musically meaningful stems per chapter rather than switching unrelated tracks.

Adaptive state inputs: exploration/traversal, nearby rivalry, carrying/delivery, perched ownership, final stretch or final timer window, result and pause. Smooth state changes with hysteresis. Quantise musical changes to bar/beat boundaries where appropriate; urgent gameplay cues play immediately. Crossfade without phase pops; prevent every pickup from restarting music. Pause attenuates or switches to a sparse layer. Growing moves naturally between chapter themes. Later generations use alternate arrangements/percussion, not faster playback of every recording. Avoid musical intensity spikes for routine harmless events.

### Sound-effect production catalogue

Build a cue manifest with stable event names, variations, emitter/position, attenuation, priority, cooldown, concurrency, pitch/volume range, animation marker and asset/licence status. Minimum targets below are meaningful variants, not arbitrary resamples of one file.

| Family | Detail and requested variation |
|---|---|
| Movement | 6–10 variants per surface: straw, wood, dirt, stone, mud; light/mid/heavy layers by growth/class. Accelerating footsteps follow actual contact, not a constant loop. |
| Jump/flap/glide | 4–6 takeoffs/landings; 6–8 wingbeats; gentle glide air loop; strained stamina flutter; landing intensity scales with fall speed. |
| Interactions | 5–8 peck/scratch variants; straw tearing; crate friction loop with start/stop; hay scrape; gate hinge/latch; cargo pickup/drop; delivery basket rustle; rope tension and worm tug squeak. |
| Abilities | Zoomies feather rush with short tail; Fluff Bump soft low thud/body flutter; Fancy Feathers quick airy sweep/trill; activation, success and cooldown-ready cues. Distinct from generic hit sounds. |
| Obstacles | Egg roll material loop and soft collision; mud squelch/splash; bucket chain/rope creak and wood/metal swing; perch creak; seed skitter; spring branch flex/release; wind warning and gust loop. No glassy egg-smash injury sound. |
| Collectibles | Crumb crisp tiny pluck; worm playful chirrup; golden feather warm shimmering chime; corn bundle dry husk rustle. Controlled ascending musical variation for rapid pickup sequences with bounded pitch. |
| Powers | Distinct pickup, active indicator when needed, expiration warning and end: seed sparkle rush, flap airy chime, magnet whimsical pull, shell gentle crystalline enclosure/break, corn firm pluck, sticky toe tack, double crumb twin notes, breeze soft exhale. |
| Competition | Start countdown, start bell, checkpoint, lead change, rival approach warning where gameplay-relevant, perch claim/loss, delivery score, last timer seconds, finish, placement, tie-break and championship trophy. |
| Character reactions | 8–12 brief reactions per class/stage family: curious, effort, startled, frustrated, pleased, competitive, victorious. Rare longer celebration; parent cheers use strict cooldowns. |
| UI | Soft wooden/plucked focus, confirm, back, disabled, tab, egg node unlock, settings, save complete; focus cues subtle and throttled during fast navigation. |
| Growth/hatch | Layered feather bloom, gentle ascending motif, character delighted chirp; egg tap/crack and new hatchling peep used for story hatching only. |

Use random selection without immediate repeats, restrained pitch variation (typically ±3–5%) and slight gain variation. Preserve recognisable class signatures. Continuous loops crossfade and stop cleanly. Treat repeated rapid events with aggregation and concurrency limits. High-frequency or sharp transient fatigue should be addressed in the source mix, not by muting all detail.

### Environmental beds and spatial audio

Nest: close straw rustle, quiet distant coop, soft breeze; intimate minimal bed. Coop: timber creaks, outdoor birds heard through openings, occasional roof settling. Rafters: airy upper-barn draft, subtle hanging rope movement, distant floor activity. Farmyard: leaves, distant birds, restrained farm ambience and pond textures only near water. Championship: light spectator chicken chatter, occasional cheers, festive ambience without constant crowd roar.

Use layered stereo ambience for the overall space and positional mono emitters for interactive objects. Camera-aware attenuation: overhead and orthographic cameras must not make everything quiet because the camera is far above the world. Listener should represent play focus. Offscreen hazards remain audible within fair warning distances; distant clutter is quieter. Use tasteful enclosure filters/reverb with smooth transitions and limited cost. Essential alerts are audible but also visual. Test headphones, stereo speakers and mono downmix.

### Implementation and mixing

Audio bus hierarchy: Master → Music, SFX, Voice, Ambience, UI; SFX subgroups Player, Rivals, Interactions, Hazards, Pickups. Saved user sliders govern their groups. Route cinematic sounds consistently. Dialogue/important character cues and critical alerts gently duck music/ambience (initial target 2–4 dB with smooth attack/release); do not pump the mix on every crumb. Priority-based voice stealing protects alerts/player actions over decorative ambience. Start with an adjustable 32–48 SFX voice budget plus dedicated music streams and ambient loops; profile actual target hardware.

Source delivery: 48 kHz, 24-bit WAV masters, clean start/end trims, no clipping, labels and metadata. Music stereo; point effects usually mono; ambience stereo. Keep WAV masters outside the runtime build when size matters. Export platform-supported runtime formats using measured codec quality and loop accuracy, not arbitrary extension changes. Stream longer music, preload frequently used short effects, and avoid large decode stalls. If a browser build exists, unlock audio after a user gesture and test suspension/resume and memory use.

Initial mix targets are audition guidelines, not a universal platform standard: integrated normal gameplay roughly -18 to -16 LUFS, occasional louder moments with controlled headroom, final master true peaks no higher than -1 dBTP. Measure representative captures rather than normalize every sound independently. Provide Standard, Night/Reduced Dynamics and Headphones options; reduced dynamics keeps alerts understandable at quiet playback. Limiters should catch rare overs, not squash the whole mix. Keep silence and low-density moments.

Create an audio debug/audition scene exposing every semantic event, stem toggles, volume meters, active voice counts, loop checks and bus routing. Document exact engine audio integration and asset slots. Temporary synthesized cues must be labelled TEMP in the manifest and release checklist; do not pretend they are recorded, composed or licensed final content.

## 13. Save data, content tools and resilience

Save selected class, current chapter/level, completed objectives, medals, generation/seed, family tree, inherited perk, cosmetics, settings and input bindings. Autosave at level results, unlocks, growth and new brood selection, with atomic writes, backup recovery and schema migrations. Resume from stable checkpoints rather than partially completed animation states. Avoid overwriting a good save with a malformed load. Reset progress requires confirmation.

Build editor/debug tools for level selection, route overlays, objective reset, AI diagnostics, collision views, audio audition and generation variants. Validate asset IDs and data references automatically. A missing nonessential asset has an explicit fallback and logged warning; missing mandatory level/collision data fails visibly during validation, not in a user's gameplay session.

## 14. Production milestones and working method

Proceed without repeatedly asking about routine decisions. Ask only when a decision materially changes authorised scope, platform, rights, costs or irreversible publication. Do not upload publicly or purchase third-party assets without explicit authorisation.

1. Audit references/repository; write implementation plan, canonical design and asset/audio manifests; select concrete engine/export targets.
2. Build a complete polished vertical slice of 1-1 and 2-1 with all classes, AI, representative final-style art, menu→play→result flow, save, meaningful effects and adaptive music hooks. Use it to validate rendering and responsiveness.
3. Implement all five mechanically distinct chapter controllers and all 25 data-defined levels; complete growth and next-generation loop.
4. Improve AI, route balance, generation variants, progression, family tree, accessibility and controller UX.
5. Replace temporary art/audio where production assets are available, animate, light, mix, optimise and fix issues.
6. Complete release-candidate verification, export, documentation, licence audit and truthful readiness report.

Milestones are checkpoints, not permission to stop permanently after the slice. After each, report what works, tests run, unresolved issues and next actions, then continue when dependencies permit. If a tool/asset is genuinely blocking final quality, report precisely what is needed while completing independent work.

## 15. Testing and acceptance criteria

Test the actual game, not only data or screenshots. Automate important invariants and perform representative interactive playtests. Include:
- Every class can complete each of 25 base levels; validate common routes and weakest-class jump/strength thresholds.
- All five growth transitions, adult completion, new brood choice and generation 2 progression work.
- Cooldowns, stacking/refresh rules, shield consumption, magnet wall restrictions and Double Crumb accounting behave correctly.
- Perch contest ownership, cargo delivery, tie-breaks and round scoring cannot softlock.
- AI respects movement rules, finds objectives, recovers from hazards and does not teleport or steal banked points.
- Seeded variants remain solvable and reproduce from saved seed.
- Save/load, corrupted-save recovery, reset confirmation and schema migrations preserve progress.
- All screens usable with keyboard and controller, remapping updates prompts, reduced motion works, muted audio does not conceal required information.
- Audio loops/stems transition without clicks, no immediate repeat spam, cooldown/priority/voice stealing works, no clipping, sliders persist, focus loss restores cleanly.
- Performance captures on documented hardware: target 60 FPS at 1080p on the chosen reference PC, identify worst frame time, memory and loading behaviour. Do not promise unmeasured compatibility. Use quality settings rather than reducing character appeal indiscriminately.
- Fresh install/export works without editor tools, credentials, developer file paths or internet dependency for offline play.

Before release, run long-session tests across multiple generations and reset/retry cycles, check licences for all art/audio/fonts/libraries, and enumerate any placeholders. The label release-ready requires complete core content, no critical bugs/softlocks, tested exports and valid distribution rights. AAA-level audio is a creative quality target, not a certification or substitute for production assets.

## 16. Required deliverables

Deliver working repository/source, reproducible desktop export instructions and a distributable tested build when the environment supports it. Include README with installation/play controls, architecture notes, all 25 level definitions, balance tables, canonical asset manifest, reference index, animation list, audio cue/stem manifest, audio production brief, save schema, QA results, performance report, credits/licence inventory and a clear outstanding-production list.

Use filenames and IDs that are easy for another developer to understand. Keep generated or sourced production assets separate from concept reference boards. Never invent licence permission, artist recordings, compositions or testing results. Report which assets are final, temporary, missing or awaiting external production.

Start by inspecting the supplied files and repository, then implement the game in the milestone order above. Preserve the cute Soft 3D visual identity, the red Mighty class, five genuine gameplay transformations, affectionate sibling competition, and the replayable family-generation cycle throughout.
