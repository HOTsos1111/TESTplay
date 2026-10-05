# CHICK KIN — Audio Cue & Stem Manifest (generated)

Every sound in this build is **TEMP**: synthesized in code (`src/audio/synth.ts`) as an audition placeholder. Cue names are stable; final recorded/licensed WAV assets replace the `src` per cue without code changes.

## Sound-effect cues

| Event | Source (TEMP) | Variants | Bus | Priority | Cooldown | Max voices | Pitch ± | Gain | Ducks music | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| move.step.straw | step | 8 | player | 1 | 0.07s | 3 | 4% | 0.35 |  | TEMP |  |
| move.step.wood | stepWood | 8 | player | 1 | 0.07s | 3 | 4% | 0.3 |  | TEMP |  |
| move.step.mud | stepMud | 6 | player | 1 | 0.09s | 2 | 4% | 0.4 |  | TEMP |  |
| move.jump | whoosh | 5 | player | 4 | 0.03s | 4 | 4% | 0.35 |  | TEMP |  |
| move.flap | wingbeat | 7 | player | 4 | 0.03s | 4 | 4% | 0.55 |  | TEMP |  |
| move.land | land | 5 | player | 3 | 0.03s | 4 | 4% | 0.45 |  | TEMP |  |
| act.peck | peck | 6 | interactions | 4 | 0.03s | 4 | 4% | 0.5 |  | TEMP |  |
| act.scratch | rustle | 6 | interactions | 3 | 0.1s | 4 | 4% | 0.45 |  | TEMP |  |
| act.break | straw | 4 | interactions | 6 | 0.03s | 4 | 4% | 0.8 |  | TEMP |  |
| act.push | scrape | 4 | interactions | 3 | 0.25s | 4 | 4% | 0.45 |  | TEMP |  |
| act.gate | gate | 3 | interactions | 5 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| act.carry | husk | 5 | interactions | 4 | 0.03s | 4 | 4% | 0.55 |  | TEMP |  |
| act.drop | thud | 4 | interactions | 5 | 0.03s | 4 | 4% | 0.5 |  | TEMP |  |
| act.deliver | basket | 4 | interactions | 7 | 0.03s | 4 | 4% | 0.8 | yes | TEMP |  |
| act.tug | squeak | 5 | interactions | 4 | 0.4s | 4 | 4% | 0.5 |  | TEMP |  |
| ab.zoomies | zoomies | 1 | player | 8 | 0.03s | 4 | 4% | 0.7 |  | TEMP |  |
| ab.fluffbump | fluffbump | 1 | player | 8 | 0.03s | 4 | 4% | 0.9 |  | TEMP |  |
| ab.fancy | fancy | 1 | player | 8 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| ab.ready | ready | 1 | ui | 6 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| haz.egg.release | roll | 3 | hazards | 7 | 0.4s | 4 | 4% | 0.6 |  | TEMP | positional, fair-warning distance |
| haz.bump | bonk | 5 | hazards | 8 | 0.03s | 4 | 4% | 0.7 |  | TEMP |  |
| haz.mud | squelch | 5 | hazards | 3 | 0.3s | 4 | 4% | 0.5 |  | TEMP |  |
| haz.wind.warn | windwarn | 2 | hazards | 8 | 1s | 4 | 4% | 0.6 |  | TEMP |  |
| haz.spring | boing | 4 | hazards | 5 | 0.03s | 4 | 4% | 0.55 |  | TEMP |  |
| haz.creak | creak | 4 | hazards | 2 | 0.6s | 4 | 4% | 0.4 |  | TEMP |  |
| pick.crumb | crumb | 1 | pickups | 5 | 0.02s | 3 | 1% | 0.55 |  | TEMP | ascending pitch for rapid sequences (bounded +7 semitones) |
| pick.worm | worm | 4 | pickups | 6 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| pick.feather | feather | 1 | pickups | 8 | 0.03s | 4 | 4% | 0.7 | yes | TEMP |  |
| pick.bundle | husk | 5 | pickups | 5 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| pick.treat | crumb | 1 | pickups | 4 | 0.03s | 4 | 4% | 0.45 |  | TEMP |  |
| pu.get | power | 4 | pickups | 7 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| pu.shield.break | shieldbreak | 1 | pickups | 8 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| pu.expire | expire | 1 | pickups | 5 | 0.03s | 4 | 4% | 0.5 |  | TEMP |  |
| comp.count | count | 1 | ui | 9 | 0.03s | 4 | 4% | 0.7 |  | TEMP |  |
| comp.go | bell | 1 | ui | 10 | 0.03s | 4 | 4% | 0.8 | yes | TEMP |  |
| comp.checkpoint | checkpoint | 1 | ui | 6 | 0.03s | 4 | 4% | 0.55 |  | TEMP |  |
| comp.lead | claim | 1 | ui | 5 | 2s | 4 | 4% | 0.4 |  | TEMP |  |
| comp.perch.claim | claim | 1 | ui | 7 | 0.03s | 4 | 4% | 0.55 |  | TEMP |  |
| comp.perch.lost | lost | 1 | ui | 7 | 0.03s | 4 | 4% | 0.55 |  | TEMP |  |
| comp.timer | tick | 1 | ui | 9 | 0.03s | 4 | 4% | 0.7 |  | TEMP |  |
| comp.finish | bell | 1 | ui | 10 | 0.03s | 4 | 4% | 0.8 | yes | TEMP |  |
| comp.win | fanfare | 1 | ui | 10 | 0.03s | 4 | 4% | 0.8 | yes | TEMP |  |
| comp.nearmiss | nearmiss | 1 | ui | 10 | 0.03s | 4 | 4% | 0.7 | yes | TEMP |  |
| vo.speedy | peep | 6 | voice | 5 | 0.6s | 2 | 4% | 0.4 |  | TEMP |  |
| vo.mighty | chirrup | 6 | voice | 5 | 0.6s | 2 | 4% | 0.45 |  | TEMP |  |
| vo.nimble | trill | 6 | voice | 5 | 0.6s | 2 | 4% | 0.4 |  | TEMP |  |
| ui.focus | uiFocus | 3 | ui | 2 | 0.06s | 1 | 4% | 0.5 |  | TEMP |  |
| ui.confirm | uiConfirm | 1 | ui | 6 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| ui.back | uiBack | 1 | ui | 6 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| ui.denied | uiDenied | 1 | ui | 6 | 0.03s | 4 | 4% | 0.6 |  | TEMP |  |
| ui.saved | saved | 1 | ui | 3 | 1s | 4 | 4% | 0.4 |  | TEMP |  |
| story.bloom | bloom | 1 | ui | 10 | 0.03s | 4 | 4% | 0.8 | yes | TEMP |  |
| story.crack | crack | 4 | ui | 8 | 0.03s | 4 | 4% | 0.7 |  | TEMP |  |

## Music cues (adaptive)

All cues arrange the same original 4-bar CHICK KIN motif (`src/audio/music.ts`). Stems share tempo, key and bar grid; state changes are quantized to bar lines with 1.5 s hysteresis.

| Cue | BPM | Root | Mode | Bars (loop) | Lead | Chords | Bass | Percussion | Feel | Stems | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| title | 102 | MIDI 65 | major | 16 | flute | guitar | pizz | shaker | gentle | base, melody, perc, rival, final | TEMP |
| select | 92 | MIDI 67 | major | 8 | celesta | pluck | bass | none | gentle | base, melody, perc, rival, final | TEMP |
| nest | 98 | MIDI 72 | major | 16 | celesta | marimba | pizz | shaker | gentle | base, melody, perc, rival, final | TEMP |
| coop | 124 | MIDI 62 | major | 16 | flute | guitar | pizz | brush | drive | base, melody, perc, rival, final | TEMP |
| rafters | 112 | MIDI 64 | major | 16 | flute | harp | pad | shaker | airy | base, melody, perc, rival, final | TEMP |
| farmyard | 108 | MIDI 57 | minor | 16 | pluck | marimba | pizz | hand | sly | base, melody, perc, rival, final | TEMP |
| championship | 138 | MIDI 60 | major | 16 | brass | guitar | pizz | festive | festive | base, melody, perc, rival, final | TEMP |
| results | 96 | MIDI 65 | major | 8 | celesta | pluck | bass | none | gentle | base, melody, perc, rival, final | TEMP |
| family | 80 | MIDI 60 | major | 8 | celesta | harp | pad | none | gentle | base, melody, perc, rival, final | TEMP |

Adaptive inputs: rivalry nearby (rival stem), final stretch / timer window (final stem), pause (melody/perc attenuated). Later generations use an alternate arrangement (transposition), never faster playback.
