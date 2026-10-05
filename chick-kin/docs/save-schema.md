# Save Schema (v2)

Stored in `localStorage` under `chickkin.save`, with `chickkin.save.bak` (previous good save) and a temporary `chickkin.save.tmp` used during writes. Code: `src/core/SaveManager.ts`.

```ts
SaveData {
  version: 2
  family: { name, seed, generation, completedGenerations,
            lineage: GenerationRecord[] }            // grown-up generations: class, name, perk, seed, siblings, medals, feathers
  current: null | {
    cls, name, perk | null, generation, seed,        // seed drives siblings + variants (reproducible)
    chapter: 1..5,                                   // growth stage = current chapter
    unlocked: string[],                              // level ids
    levels: Record<id, { done, bestTime, placement, medals[], feathers, variantSeed }>,
    phase: 'playing' | 'adult'                       // 'adult' = championship won, brood not yet chosen
  }
  settings: { master, music, sfx, voice, ambience, muted, dynamics, reducedMotion, shake, reduceFlash,
              captions, quality, difficulty, interactToggle, pauseOnBlur }
  bindings: { keys: KeyMap | null, pad: PadMap | null }
  records: Record<"<level>:g<gen>:s<seed>", seconds>   // times compared only under equivalent rules
  cosmetics: string[]; achievements: string[]; savedAt: ISO string
}
```

**Autosave points:** level results (success), growth (before the vignette), adult celebration, new generation start, settings and binding changes.

**Write procedure:** validate → write temp → re-parse temp → rotate previous good main to backup → write main → remove temp. A malformed in-memory state is never written.

**Load procedure:** parse + migrate main → validate; on failure fall back to the backup (and tell the player); otherwise start fresh. Resuming always happens from stable points (map / brood), never mid-animation.

**Migrations:** `v1 → v2` adds `captions`, `pauseOnBlur` and `records`. Migrations run in sequence and are unit-tested.

**Reset:** "New Family" / "Reset all progress" require confirmation and keep settings and bindings.
