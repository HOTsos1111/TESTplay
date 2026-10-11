# Happy Nerds

A Flappy Bird knockoff with a twist: **you flap the pipes, not the bird.**

A balloon floats across the screen, puffing up and down at random on its own and carrying a number. Each pipe has **two gaps**, each labelled with a maths question. Work out which question equals the balloon's number, then flap the pipe so that gap lines up with the drifting balloon. Two moving things have to meet, and the gap has to be the right one.

This is the **mechanics prototype**. Everything is drawn with flat placeholder shapes. Real art goes in [`assets/`](assets/) once the design is ready.

Happy Nerds is a standalone project. It shares nothing with the Homeward Hound game in the repo root.

## Run it

```bash
cd happy-nerds
npm install
npm run dev        # http://localhost:5173
npm test           # question + gameplay tests
npm run build      # typecheck + static build into happy-nerds/dist/
```

## How to play

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Flap the active pipe up | Space, ↑ or W | Tap / click anywhere |
| Start / try again | same | same |

- Only the **active pipe** (yellow outline) moves. It falls under gravity, and each tap kicks it up a little. The other pipes wait their turn.
- The balloon shows the answer for the active pipe.
- Right gap: **+1** score. Wrong gap or wall: the balloon pops and you lose one of 3 lives. You get a short blink of safety, and the next pipe becomes active.
- The game shows the right answer when you get one wrong, so it doubles as practice.
- The pipes speed up a little with every correct answer. Your best score is saved in the browser.

## Level 1: adding and taking away

- Answers are 1–12. Numbers in questions are 0–20, and subtraction never goes below zero.
- The wrong gap is always a near miss (±1 to 3), so you have to actually calculate it.
- Levels are data (`MathLevel` in `src/questions.ts`), so new levels can raise the numbers or add operators.

## Code map

| File | What it does |
|---|---|
| `src/config.ts` | All tuning: balloon drift, pipe gravity/flap, gap sizes, speed, lives |
| `src/questions.ts` | Question and near-miss generator, level definitions, seeded RNG |
| `src/game.ts` | Pure game state and fixed-step simulation (no DOM), so it's easy to test |
| `src/render.ts` | Canvas drawing (placeholder shapes) |
| `src/main.ts` | Loop, input, screen fit, best-score storage |
| `tests/` | Question correctness, pipe/balloon rules, and a fairness check: an autopilot that plays like a careful player must keep scoring |

## Tuning notes

The pipe flap was tuned against the autopilot. With big flaps (one tap lifting the pipe ~60–90 px), the pipe overshoots the gap even with perfect timing. At the current setting each tap lifts it about 36 px against roughly ±70 px of leeway in the gap. A careful player can clear nearly every pipe, and sloppy timing costs balloons. To make it harder, shrink `PIPE.gapHeight` or raise `BALLOON.puffStrength` in `src/config.ts`.
