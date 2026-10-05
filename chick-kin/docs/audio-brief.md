# Audio Production Brief & Integration Notes

This build contains a complete **audio system** and **TEMP synthesized placeholders** for every cue and music stem. None of it is final recorded, composed or mastered content. Final assets plug into the same cue names (`docs/audio-manifest.md`).

## What is implemented (code)

- **Bus hierarchy:** Master → Music, Ambience (both through a duck stage), SFX → Player / Rivals / Interactions / Hazards / Pickups, Voice, UI. Saved sliders: master, music, SFX, voice, ambience, master mute.
- **Dynamic range modes:** Standard, Night (heavier compression so alerts stay clear at low volume), Headphones.
- **Cue playback:** random variant without immediate repeats, ±3–5% pitch and slight gain variation, per-cue cooldowns and concurrency limits, a 40-voice budget with priority-based stealing (alerts and player actions outrank decoration), positional panning and attenuation from the **play focus** (not the camera height), longer warning range for hazards.
- **Ducking:** important cues (go, finish, deliveries, feathers, results, growth) duck music and ambience by ~3 dB with smooth attack/release; routine crumbs do not pump the mix.
- **Rapid pickups:** crumbs climb in pitch over a short chain, capped at +7 semitones.
- **Adaptive music:** an original 4-bar CHICK KIN motif arranged per cue (title, select, nest, coop, rafters, farmyard, championship, results, family) with five stems (base, melody, perc, rival, final). Stem changes are quantised to the next bar with 1.5 s hysteresis. Inputs: rival nearby, final stretch or last-timer window, pause (melody and perc attenuated). Later generations use an alternate arrangement (transposition), never faster playback.
- **Ambience beds** per chapter (filtered noise layers plus occasional positional one-shots: creaks in the coop and rafters, birds in the farmyard, crowd clucks at the championship).
- **Footsteps** fire from actual ground travel (stride length by stage), with surface variants (wood, straw, mud) and a class signature (Mighty heavier and lower, Nimble lighter).
- **Captions:** visual equivalents for essential audio (go, wind warning, perch claimed by a sibling, dropped cargo, tie-break, respawn). They can be toggled.
- **Browser policy:** audio unlocks on the first gesture; it suspends when the tab is hidden or the window loses focus, and resumes on return.
- **Audition tools:** the Debug panel (`?debug`) plays every cue and music cue, toggles stems and shows voices played, stolen and skipped.

## What production must supply (per the brief)

| Deliverable | Spec |
|---|---|
| Music | ~18–25 min of original music on the CHICK KIN theme: title (60–90 s intro + 2–3 min loop), select/map, nest, coop, rafters, farmyard, championship (race, perch, haul variants plus final-round stem), growth transition (8–12 s), adult/new brood (20–35 s plus soft loop), results stingers (1–4 s) and loop. 2–4 stems per chapter cue, sharing duration, tempo, sample rate and bar grid, with clean loop points or separate tails. |
| SFX | Recorded material + cartoon sweeteners. Variant counts per `audio-manifest.md`: 6–10 per footstep surface with light/mid/heavy layers, 6–8 wingbeats, 5–8 pecks and scratches, plus obstacles, collectibles, powers, competition, UI, growth and hatch. No glassy egg smashes. |
| Voices | Non-verbal peeps, chirrups and clucks: 8–12 reactions per class and stage family; growth lowers the register via distinct recordings rather than pitch-shifting. |
| Ambience | Stereo beds per chapter and positional mono emitters. |
| Masters | 48 kHz / 24-bit WAV, trimmed and labelled, no clipping. Runtime: Ogg/Opus or AAC at measured quality with loop accuracy verified. |
| Mix targets | About −18 to −16 LUFS integrated gameplay, ≤ −1 dBTP final peaks. Test on headphones, speakers and mono downmix. |

## Integration path for final assets

1. Add files under `public/audio/…`.
2. In `src/audio/cues.ts`, point each cue's `src` at file paths, set `variants`, and set `status: 'FINAL'`.
3. Extend `AudioDirector.unlock()` to decode files (preload short SFX, stream music) in place of `SYNTH`.
4. Music: replace the synth sequencer with stem `AudioBufferSourceNode`s started on a shared clock. Bar-quantised state changes keep using `MusicPlayer.setStems`.
