// Generates data-driven docs from the game's canonical data (run: npx vite-node scripts/gen-docs.ts).
import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/data/levels';
import { CHAPTERS } from '../src/data/chapters';
import { OBSTACLES, POWERS, COLLECTIBLES } from '../src/data/items';
import { ABILITIES, CLASS_INFO, CLASSES } from '../src/data/classes';
import { GROWTH, STAGES } from '../src/data/growth';
import { CUES } from '../src/audio/cues';
import { MUSIC } from '../src/audio/music';
import type { ObjectiveDef, ArenaDef } from '../src/sim/types';

const objText = (o: ObjectiveDef) => {
  switch (o.kind) {
    case 'collect': return `Collect ${o.count} crumbs`;
    case 'tug': return `Win ${o.count} tug worms`;
    case 'perch': return `${o.seconds} s of uncontested perch ownership`;
    case 'race': return o.requireFirst ? 'Race — finish first' : 'Race — reach the finish';
    case 'reach': return `Reach the goal perch${o.feathers ? ` with ${o.feathers} golden feathers` : ''}${o.requireFirst ? ' (first)' : ''}`;
    case 'deliver': return `Deliver ${o.count} ${o.cargo === 'bundle' ? 'corn bundles' : 'treats'}${o.requireFirst ? ' — first to finish' : ''}`;
    case 'mostDeliveries': return `Most deliveries in ${o.seconds} s`;
  }
};
const ents = (a: ArenaDef) => {
  const c: Record<string, number> = {};
  for (const e of a.entities) if (e.t !== 'deco') c[e.t] = (c[e.t] ?? 0) + 1;
  return Object.entries(c).map(([k, v]) => `${k}×${v}`).join(', ');
};

// ---------------------------------------------------------------- level definitions
let L = `# CHICK KIN — Level Definitions (generated)\n\nGenerated from \`src/data/levels/*.ts\` by \`scripts/gen-docs.ts\`. Times/counts are initial design targets stored in level data.\n\n`;
for (const s of STAGES) {
  const ch = CHAPTERS[s];
  L += `## Stage ${s} — ${ch.name} (${GROWTH[s].name})\n\nFormat: ${ch.format}. Camera: ${ch.camera}. Learn: ${ch.learn.join(', ')}.\n\n| ID | Title | Format | Objective | Mode / arena | Mechanics | Routes | Medals | Variants |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const l of LEVELS.filter((x) => x.chapter === s)) {
    const phases = l.phases.map((p) => `${p.name}: ${p.arena.mode} ${p.arena.w}×${p.arena.h} m`).join('<br>');
    const objs = l.phases.map((p) => (l.phases.length > 1 ? `${p.name}: ` : '') + objText(p.objective)).join('<br>') + (l.tiebreak ? `<br>Tie-break: ${objText(l.tiebreak.objective)}` : '');
    const mech = l.phases.map((p) => ents(p.arena)).join('<br>');
    const routes = l.phases.map((p) => (p.arena.routes ?? []).map((r) => r.color).join('/') || 'nav-grid AI').join('<br>');
    const medals = [l.medals?.time ? `time ≤ ${l.medals.time}s` : '', l.medals?.feathers ? `${l.medals.feathers} feathers` : '', 'first place'].filter(Boolean).join(', ');
    L += `| ${l.id} | ${l.title} | ${l.format} | ${objs} | ${phases} | ${mech} | ${routes} | ${medals} | ${(l.variants ?? []).map((v) => v.name).join(', ')} |\n`;
  }
  L += '\n';
}
writeFileSync('docs/level-definitions.md', L);

// ---------------------------------------------------------------- asset manifest
const themeKit: Record<string, [string, string, string][]> = {
  nest: [['Straw nest rim', 'nestrim solids', 'props.nestRim'], ['Low straw divider (hop)', 'straw solids h≤0.35', 'props.nestRim'], ['Loose straw plug', 'straw entity (peck)', 'props.strawBarrier'], ['Egg ramp / tiny wood ramp', 'deco', 'ArenaView.deco ramp'], ['Small mound perch', 'mound + perch', 'props.moundPerch']],
  coop: [['Wooden floor slab', 'ground solids', 'props.slab'], ['Plank platform (one-way)', 'oneWay solids', 'props.plankPlatform'], ['Crate block', 'crate solids', 'props.crate'], ['Low fence gap', 'lowFence solids', 'props.lowFenceGap'], ['Coop wall backdrop', 'backdrop', 'themes.buildBackdrop'], ['Start / finish ribbon', 'finish + deco', 'props.ribbonArch'], ['Checkpoint lantern', 'checkpoint', 'props.lantern']],
  rafters: [['Rafter beam (one-way)', 'beam solids', 'props.plankPlatform/beam'], ['Hay catch bed', 'catchbed solids', 'props.hayBale'], ['Hanging rope', 'bucket rope / backdrop', 'ArenaView bucket'], ['Crown perch (goal)', 'perch/finish', 'props.crownPerch'], ['Barn interior backdrop', 'backdrop', 'themes.buildBackdrop']],
  farmyard: [['Dirt / grass ground', 'arena floor', 'ArenaView floor'], ['Fence (tall)', 'fence solids h 1.3', 'props.fence'], ['Low vault fence', 'fence solids h 0.5', 'props.fence'], ['Gate', 'gate entity', 'props.gate'], ['Scratch patch', 'scratch entity', 'props.scratchPatch'], ['Basket (owner ribbon)', 'basket entity', 'props.basket'], ['Corn pile', 'cornpile entity', 'props.cornPile'], ['Coop wall / barn', 'coop solids / backdrop', 'ArenaView coop, props.barn'], ['Pond', 'water solids', 'ArenaView water']],
  championship: [['Race lane floor', 'ground solids', 'props.slab'], ['Starting gate / finish ribbon', 'finish + deco', 'props.ribbonArch'], ['Tiered perch beams', 'beam solids', 'props.plankPlatform'], ['Scoreboard', 'deco', 'ArenaView.deco scoreboard'], ['Podium / trophy', 'deco', 'props.trophy'], ['Bunting / spectator stands', 'backdrop', 'props.bunting, themes']],
};
let A = `# CHICK KIN — Canonical Asset Manifest (generated)\n\nAll runtime assets in this build are **TEMP procedural placeholders** generated in code (Three.js geometry + canvas textures). Each row lists the stable ID, the code source that produces it, gameplay effect, collider, animation and audio hooks, licence, status and the intended final export path for production art (glTF 2.0 + KTX2 textures).\n\nEnvironment IDs are chapter-namespaced (ENV-0C-NNN) per the brief.\n\n## Characters\n\n| ID | Asset | Source | Animation | Audio | Licence | Status | Final export path |\n|---|---|---|---|---|---|---|---|\n`;
for (const c of CLASSES) {
  for (const s of STAGES) A += `| CHR-${c.toUpperCase()}-S${s} | ${CLASS_INFO[c].name} — ${GROWTH[s].name} | render/ChickModel.ts (procedural) | see animation-list.md | vo.${c} | Project-original code | TEMP | assets/characters/${c}/stage${s}.glb |\n`;
  A += `| CHR-${c.toUpperCase()}-ADULT | ${CLASS_INFO[c].name} — Adult parent | render/ChickModel.ts (adult proportions) | idle, celebrate | vo.${c} | Project-original code | TEMP | assets/characters/${c}/adult.glb |\n`;
}
A += `\n## Environment kits\n\n| ID | Asset | Gameplay use / collider | Source | Licence | Status | Final export path |\n|---|---|---|---|---|---|---|\n`;
STAGES.forEach((s) => {
  const ch = CHAPTERS[s];
  themeKit[ch.theme].forEach(([name, col, src], i) => {
    A += `| ENV-0${s}-${String(i + 1).padStart(3, '0')} | ${name} | ${col} | ${src} | Project-original code | TEMP | assets/env/${ch.id}/${name.toLowerCase().replace(/[^a-z]+/g, '-')}.glb |\n`;
  });
});
A += `\n## Obstacles\n\n| ID | Name | Canonical interaction | Collider | Animation | Audio events | Status |\n|---|---|---|---|---|---|---|\n`;
const obsAudio: Record<string, string> = { 'OBS-01': 'haz.egg.release, haz.bump', 'OBS-02': 'haz.mud, move.step.mud', 'OBS-03': 'haz.creak, haz.bump', 'OBS-04': 'haz.creak', 'OBS-05': 'act.peck, act.break', 'OBS-06': '—', 'OBS-07': 'act.push', 'OBS-08': 'act.push (rail)', 'OBS-09': 'haz.wind.warn', 'OBS-10': 'move.step.straw (slide)', 'OBS-11': 'haz.spring', 'OBS-12': 'act.tug, pick.worm' };
const obsCol: Record<string, string> = { 'OBS-01': 'circle r 0.35–0.42, telegraph 0.8 s', 'OBS-02': 'zone (speed ×0.55)', 'OBS-03': 'pendulum box 0.9×0.55, bumps when |v|>1.2', 'OBS-04': 'one-way tilt platform', 'OBS-05': 'solid box, hp 3', 'OBS-06': 'solid above duck height', 'OBS-07': 'pushable box, mass 1.0', 'OBS-08': 'one-way moving platform (carries riders)', 'OBS-09': 'force zone with warning phase', 'OBS-10': 'zone (accel ×0.22–0.3)', 'OBS-11': 'one-way bounce pad', 'OBS-12': 'hold-to-tug point, tether 0.95 m' };
for (const [id, o] of Object.entries(OBSTACLES)) A += `| ${id} | ${o.name} | ${o.interaction} | ${obsCol[id]} | procedural (ArenaView.update) | ${obsAudio[id]} | TEMP |\n`;
A += `\n## Power-ups\n\n| ID | Name | Duration | Effect | Audio | Status |\n|---|---|---|---|---|---|\n`;
for (const p of Object.values(POWERS)) A += `| ${p.id} | ${p.name} | ${p.duration ? p.duration + ' s' : 'instant'} | ${p.summary} | pu.get / pu.expire | TEMP |\n`;
A += `\n## Collectibles\n\n| ID | Name | Notes | Audio | Status |\n|---|---|---|---|---|\n`;
for (const [id, c] of Object.entries(COLLECTIBLES)) A += `| ${id} | ${c.name} | ${c.summary} | ${id === 'COL-01' ? 'pick.crumb' : id === 'COL-02' ? 'pick.worm' : id === 'COL-03' ? 'pick.feather' : 'pick.bundle'} | TEMP |\n`;
A += `\n## Class abilities\n\n| ID | Name | Class | Cooldown | Duration | Stage evolution | Audio |\n|---|---|---|---|---|---|---|\n`;
for (const c of CLASSES) { const ab = ABILITIES[c]; A += `| ${ab.id} | ${ab.name} | ${CLASS_INFO[c].name} | ${ab.cooldown} s | ${ab.duration} s | ${ab.byStage.join(' → ')} | ab.${ab.id === 'AB-01' ? 'zoomies' : ab.id === 'AB-02' ? 'fluffbump' : 'fancy'} |\n`; }
A += `\n## UI\n\n| ID | Asset | Source | Licence | Status |\n|---|---|---|---|---|\n| UI-001 | Wood panels, ivory cards, buttons (normal/hover/pressed/focus/disabled) | src/ui/ui.css | Project-original | TEMP-styled CSS (final art pass pending) |\n| UI-002 | Fonts: Fredoka, Nunito | @fontsource (bundled woff2) | SIL OFL 1.1 | FINAL (licensed) |\n| UI-003 | Chick portraits | src/ui/Portraits.ts (rendered from models) | Project-original | TEMP |\n| UI-004 | Icons (class, objective, power glyphs) | Unicode glyphs + CSS | n/a | TEMP |\n`;
writeFileSync('docs/asset-manifest.md', A);

// ---------------------------------------------------------------- audio manifest
let M = `# CHICK KIN — Audio Cue & Stem Manifest (generated)\n\nEvery sound in this build is **TEMP**: synthesized in code (\`src/audio/synth.ts\`) as an audition placeholder. Cue names are stable; final recorded/licensed WAV assets replace the \`src\` per cue without code changes.\n\n## Sound-effect cues\n\n| Event | Source (TEMP) | Variants | Bus | Priority | Cooldown | Max voices | Pitch ± | Gain | Ducks music | Status | Notes |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const [n, c] of Object.entries(CUES)) M += `| ${n} | ${c.src} | ${c.variants} | ${c.bus} | ${c.priority} | ${c.cooldown}s | ${c.max} | ${(c.pitch * 100).toFixed(0)}% | ${c.gain} | ${c.duck ? 'yes' : ''} | ${c.status} | ${c.note ?? ''} |\n`;
M += `\n## Music cues (adaptive)\n\nAll cues arrange the same original 4-bar CHICK KIN motif (\`src/audio/music.ts\`). Stems share tempo, key and bar grid; state changes are quantized to bar lines with 1.5 s hysteresis.\n\n| Cue | BPM | Root | Mode | Bars (loop) | Lead | Chords | Bass | Percussion | Feel | Stems | Status |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const c of Object.values(MUSIC)) M += `| ${c.id} | ${c.bpm} | MIDI ${c.root} | ${c.mode} | ${c.bars} | ${c.palette.lead} | ${c.palette.chord} | ${c.palette.bass} | ${c.palette.perc} | ${c.feel} | base, melody, perc, rival, final | TEMP |\n`;
M += `\nAdaptive inputs: rivalry nearby (rival stem), final stretch / timer window (final stem), pause (melody/perc attenuated). Later generations use an alternate arrangement (transposition), never faster playback.\n`;
writeFileSync('docs/audio-manifest.md', M);
console.log('docs generated');
