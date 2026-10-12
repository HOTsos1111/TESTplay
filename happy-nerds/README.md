# Happy Nerds

Flappy Bird with a maths twist. You flap a **winged brain** (a wing on each side, big nerdy glasses) through gates. Each gate shows **one question and two answers**, one beside each opening. Read the question, pick the right answer, and fly through that answer's opening.

This is the **mechanics prototype**. Everything is drawn with flat placeholder shapes in code. Real art goes in [`assets/`](assets/) once the design is ready.

Happy Nerds is a standalone project. It shares nothing with the Homeward Hound game in the repo root.

![Gameplay](docs/previews/gameplay.png)

More previews: [tutorial](docs/previews/tutorial.png), [flap](docs/previews/flap.png), [wrong answer](docs/previews/wrong-answer.png), [phone](docs/previews/phone-tutorial.png), [strike](docs/previews/strike.png), [brain dead](docs/previews/brain-dead.png).

## Play the latest build

Scan with your phone, or open https://claude.ai/artifact/FfBkJVJsA8hKCKUGRKwZtN. The link always shows the newest build. It's private, so sign in to claude.ai on the phone with the owner's account, or share the page from its Share menu.

<img src="docs/play-qr.png" alt="QR code for the playable build" width="200" />

## Run it

```bash
cd happy-nerds
npm install
npm run dev        # http://localhost:5173
npm test           # question + gameplay tests
npm run build      # typecheck + static build into happy-nerds/dist/
```

## How to play

| Action | Keyboard | Mouse | Touch |
|---|---|---|---|
| Flap up | Space, ↑ or W | Click anywhere | Tap anywhere |
| Start / try again | same | same | same |

- The brain keeps the same spot across the screen. Each flap pushes it up, and gravity pulls it down between flaps. Touching the top of the screen just stops the climb, and the bottom is a free bounce.
- Gates move toward you and never move up or down. Each gate has:
  - an **upper gap** with its answer floating inside it,
  - the **question**, in large type, on the solid section between the gaps,
  - a **lower gap** with its answer floating inside it.

  All three sit together, so you can compare both answers without looking back at the brain. Each answer floats right in its own gap, so it's clear which gap it belongs to. The brain flies through the answer bubble; the bubble doesn't collide.
- **Right opening:** +1 point. **Wrong opening:** a strike, and the game shows the right answer. **Bumping a solid part:** a strike. Each gate is judged only once and can give at most one strike.
- **Three strikes and you're out.** After a strike the brain blinks for 2 seconds and can't be hit, which is long enough to fly clear of the gate it bumped. The HUD shows three strike slots, and each strike pops up "Strike 1 of 3" and so on. The third shows **Brain dead**.
- Gates start slow so players can find the rhythm, then speed up slightly with every correct answer. Your best score is saved in the browser.
- The start screen is the tutorial. The first real gate waits on screen with its question and answers labelled, and the brain hovers until your first flap.

## Level 1: adding and taking away

- Answers are 1–12. Numbers in questions are 0–20, and subtraction never goes below zero.
- The wrong answer is always a near miss (±1 to 3), so you have to actually work it out.
- The right answer is randomly placed in the upper or lower opening.
- Levels are data (`MathLevel` in `src/questions.ts`). Longer questions wrap onto several lines on the gate.

## Collision and timing

| Setting | Value | Why |
|---|---|---|
| Brain hit circle | radius 23 px | Well inside the 35 px body drawing. Wings and wing tips never collide. |
| Opening height | 170 px | More than 3× the hit circle, so there's room to be a bit off. |
| Question section | 150 px | Fits a wrapped question of up to 3 lines. |
| Gate speed | 115 px/s at the start, +4 per correct answer, up to 240 px/s | The slow start gives about 8 s from a gate appearing to reaching it. Even at top speed it takes over 3.5 s. |
| Gate spacing | 640 px | Enough time to cross from one opening to the other between gates. |
| Flap / gravity | 320 px/s up, 1250 px/s² | Each tap lifts the brain about 40 px, small enough to steer precisely into a gap. |

All tuning is in `src/config.ts`.

## Code map

| File | What it does |
|---|---|
| `src/config.ts` | All tuning: brain flight, gate layout, speed, strikes |
| `src/questions.ts` | Question and near-miss answer generator, level definitions, seeded RNG |
| `src/game.ts` | Pure game state and fixed-step simulation (no DOM), so it's easy to test |
| `src/render.ts` | Canvas drawing: winged brain (two wings, glasses, flap animation, idle flutter, slight tilt), gates, tutorial, HUD with strikes |
| `src/main.ts` | Loop, keyboard/mouse/touch input, screen fit, best-score storage |
| `tests/` | Question correctness, flight and gate rules, judged-once checks, and a fairness check: an autopilot that flies like a careful player must keep scoring without losing a brain |

## Not built yet

The design brief mentions combo/XP rewards, categories, level progression, an IQ Meter, achievements and category completion bonuses. None of these exist in this prototype yet. Score and strikes are the only progress so far.
