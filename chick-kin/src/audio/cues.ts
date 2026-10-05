// Audio cue manifest: stable semantic event names → sources, bus, variation, priority, limits.
// status: every source is TEMP (synthesized placeholder) until recorded/licensed assets replace it.

export type Bus = 'player' | 'rivals' | 'interactions' | 'hazards' | 'pickups' | 'voice' | 'ui' | 'ambience';
export interface Cue {
  src: string;          // synth source id (TEMP) — later a file path
  variants: number;     // meaningful variants (no immediate repeat)
  bus: Bus;
  priority: number;     // 0 (decorative) .. 10 (critical alert)
  cooldown: number;     // seconds between plays of this cue
  max: number;          // concurrent voices
  pitch: number;        // ± fraction (typically 0.03–0.05)
  gain: number;
  duck?: boolean;       // briefly duck music/ambience (important cue)
  status: 'TEMP' | 'FINAL';
  note?: string;
}
const c = (src: string, bus: Bus, o: Partial<Cue> = {}): Cue => ({ src, variants: 4, bus, priority: 4, cooldown: 0.03, max: 4, pitch: 0.04, gain: 0.8, status: 'TEMP', ...o });

export const CUES: Record<string, Cue> = {
  'move.step.straw': c('step', 'player', { variants: 8, priority: 1, cooldown: 0.07, max: 3, gain: 0.35 }),
  'move.step.wood': c('stepWood', 'player', { variants: 8, priority: 1, cooldown: 0.07, max: 3, gain: 0.3 }),
  'move.step.mud': c('stepMud', 'player', { variants: 6, priority: 1, cooldown: 0.09, max: 2, gain: 0.4 }),
  'move.jump': c('whoosh', 'player', { variants: 5, priority: 4, gain: 0.35 }),
  'move.flap': c('wingbeat', 'player', { variants: 7, priority: 4, gain: 0.55 }),
  'move.land': c('land', 'player', { variants: 5, priority: 3, gain: 0.45 }),
  'act.peck': c('peck', 'interactions', { variants: 6, priority: 4, gain: 0.5 }),
  'act.scratch': c('rustle', 'interactions', { variants: 6, priority: 3, cooldown: 0.1, gain: 0.45 }),
  'act.break': c('straw', 'interactions', { variants: 4, priority: 6, gain: 0.8 }),
  'act.push': c('scrape', 'interactions', { variants: 4, priority: 3, cooldown: 0.25, gain: 0.45 }),
  'act.gate': c('gate', 'interactions', { variants: 3, priority: 5, gain: 0.6 }),
  'act.carry': c('husk', 'interactions', { variants: 5, priority: 4, gain: 0.55 }),
  'act.drop': c('thud', 'interactions', { variants: 4, priority: 5, gain: 0.5 }),
  'act.deliver': c('basket', 'interactions', { variants: 4, priority: 7, gain: 0.8, duck: true }),
  'act.tug': c('squeak', 'interactions', { variants: 5, priority: 4, cooldown: 0.4, gain: 0.5 }),
  'ab.zoomies': c('zoomies', 'player', { variants: 1, priority: 8, gain: 0.7 }),
  'ab.fluffbump': c('fluffbump', 'player', { variants: 1, priority: 8, gain: 0.9 }),
  'ab.fancy': c('fancy', 'player', { variants: 1, priority: 8, gain: 0.6 }),
  'ab.ready': c('ready', 'ui', { variants: 1, priority: 6, gain: 0.6 }),
  'haz.egg.release': c('roll', 'hazards', { variants: 3, priority: 7, cooldown: 0.4, gain: 0.6, note: 'positional, fair-warning distance' }),
  'haz.bump': c('bonk', 'hazards', { variants: 5, priority: 8, gain: 0.7 }),
  'haz.mud': c('squelch', 'hazards', { variants: 5, priority: 3, cooldown: 0.3, gain: 0.5 }),
  'haz.wind.warn': c('windwarn', 'hazards', { variants: 2, priority: 8, cooldown: 1, gain: 0.6 }),
  'haz.spring': c('boing', 'hazards', { variants: 4, priority: 5, gain: 0.55 }),
  'haz.creak': c('creak', 'hazards', { variants: 4, priority: 2, cooldown: 0.6, gain: 0.4 }),
  'pick.crumb': c('crumb', 'pickups', { variants: 1, priority: 5, cooldown: 0.02, max: 3, pitch: 0.01, gain: 0.55, note: 'ascending pitch for rapid sequences (bounded +7 semitones)' }),
  'pick.worm': c('worm', 'pickups', { variants: 4, priority: 6, gain: 0.6 }),
  'pick.feather': c('feather', 'pickups', { variants: 1, priority: 8, gain: 0.7, duck: true }),
  'pick.bundle': c('husk', 'pickups', { variants: 5, priority: 5, gain: 0.6 }),
  'pick.treat': c('crumb', 'pickups', { variants: 1, priority: 4, gain: 0.45 }),
  'pu.get': c('power', 'pickups', { variants: 4, priority: 7, gain: 0.6 }),
  'pu.shield.break': c('shieldbreak', 'pickups', { variants: 1, priority: 8, gain: 0.6 }),
  'pu.expire': c('expire', 'pickups', { variants: 1, priority: 5, gain: 0.5 }),
  'comp.count': c('count', 'ui', { variants: 1, priority: 9, gain: 0.7 }),
  'comp.go': c('bell', 'ui', { variants: 1, priority: 10, gain: 0.8, duck: true }),
  'comp.checkpoint': c('checkpoint', 'ui', { variants: 1, priority: 6, gain: 0.55 }),
  'comp.lead': c('claim', 'ui', { variants: 1, priority: 5, cooldown: 2, gain: 0.4 }),
  'comp.perch.claim': c('claim', 'ui', { variants: 1, priority: 7, gain: 0.55 }),
  'comp.perch.lost': c('lost', 'ui', { variants: 1, priority: 7, gain: 0.55 }),
  'comp.timer': c('tick', 'ui', { variants: 1, priority: 9, gain: 0.7 }),
  'comp.finish': c('bell', 'ui', { variants: 1, priority: 10, gain: 0.8, duck: true }),
  'comp.win': c('fanfare', 'ui', { variants: 1, priority: 10, gain: 0.8, duck: true }),
  'comp.nearmiss': c('nearmiss', 'ui', { variants: 1, priority: 10, gain: 0.7, duck: true }),
  'vo.speedy': c('peep', 'voice', { variants: 6, priority: 5, cooldown: 0.6, max: 2, gain: 0.4 }),
  'vo.mighty': c('chirrup', 'voice', { variants: 6, priority: 5, cooldown: 0.6, max: 2, gain: 0.45 }),
  'vo.nimble': c('trill', 'voice', { variants: 6, priority: 5, cooldown: 0.6, max: 2, gain: 0.4 }),
  'ui.focus': c('uiFocus', 'ui', { variants: 3, priority: 2, cooldown: 0.06, max: 1, gain: 0.5 }),
  'ui.confirm': c('uiConfirm', 'ui', { variants: 1, priority: 6, gain: 0.6 }),
  'ui.back': c('uiBack', 'ui', { variants: 1, priority: 6, gain: 0.6 }),
  'ui.denied': c('uiDenied', 'ui', { variants: 1, priority: 6, gain: 0.6 }),
  'ui.saved': c('saved', 'ui', { variants: 1, priority: 3, cooldown: 1, gain: 0.4 }),
  'story.bloom': c('bloom', 'ui', { variants: 1, priority: 10, gain: 0.8, duck: true }),
  'story.crack': c('crack', 'ui', { variants: 4, priority: 8, gain: 0.7 }),
};
