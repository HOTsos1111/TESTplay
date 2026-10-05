// Adaptive music (TEMP synthesized arrangement of an ORIGINAL motif). Stems per cue share tempo,
// key and bar grid; state changes are quantized to bar lines with hysteresis.

export type Stem = 'base' | 'melody' | 'perc' | 'rival' | 'final';
export interface MusicCue { id: string; bpm: number; root: number; mode: 'major' | 'minor'; bars: number; palette: { lead: Inst; chord: Inst; bass: Inst; perc: PercKit }; feel: 'gentle' | 'drive' | 'airy' | 'sly' | 'festive' }
type Inst = 'celesta' | 'pizz' | 'marimba' | 'flute' | 'guitar' | 'harp' | 'brass' | 'pad' | 'bass' | 'pluck';
type PercKit = 'none' | 'shaker' | 'brush' | 'hand' | 'festive';

/** CHICK KIN motif: 4 bars, scale degrees (0 = root), null = rest; eighth-note grid. Original material. */
export const MOTIF: (number | null)[][] = [
  [0, null, 2, 4, 5, null, 4, 2],
  [1, null, 2, 4, 7, null, 6, 4],
  [3, 5, 7, 8, 7, 5, 4, 2],
  [1, 2, 3, 2, 1, null, 0, null],
];
const CHORDS = [[0, 2, 4], [4, 6, 8], [3, 5, 7], [4, 6, 8]]; // I V IV V (degree stacks)

export const MUSIC: Record<string, MusicCue> = {
  title: { id: 'title', bpm: 102, root: 65, mode: 'major', bars: 16, palette: { lead: 'flute', chord: 'guitar', bass: 'pizz', perc: 'shaker' }, feel: 'gentle' },
  select: { id: 'select', bpm: 92, root: 67, mode: 'major', bars: 8, palette: { lead: 'celesta', chord: 'pluck', bass: 'bass', perc: 'none' }, feel: 'gentle' },
  nest: { id: 'nest', bpm: 98, root: 72, mode: 'major', bars: 16, palette: { lead: 'celesta', chord: 'marimba', bass: 'pizz', perc: 'shaker' }, feel: 'gentle' },
  coop: { id: 'coop', bpm: 124, root: 62, mode: 'major', bars: 16, palette: { lead: 'flute', chord: 'guitar', bass: 'pizz', perc: 'brush' }, feel: 'drive' },
  rafters: { id: 'rafters', bpm: 112, root: 64, mode: 'major', bars: 16, palette: { lead: 'flute', chord: 'harp', bass: 'pad', perc: 'shaker' }, feel: 'airy' },
  farmyard: { id: 'farmyard', bpm: 108, root: 57, mode: 'minor', bars: 16, palette: { lead: 'pluck', chord: 'marimba', bass: 'pizz', perc: 'hand' }, feel: 'sly' },
  championship: { id: 'championship', bpm: 138, root: 60, mode: 'major', bars: 16, palette: { lead: 'brass', chord: 'guitar', bass: 'pizz', perc: 'festive' }, feel: 'festive' },
  results: { id: 'results', bpm: 96, root: 65, mode: 'major', bars: 8, palette: { lead: 'celesta', chord: 'pluck', bass: 'bass', perc: 'none' }, feel: 'gentle' },
  family: { id: 'family', bpm: 80, root: 60, mode: 'major', bars: 8, palette: { lead: 'celesta', chord: 'harp', bass: 'pad', perc: 'none' }, feel: 'gentle' },
};

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
function degree(root: number, mode: 'major' | 'minor', d: number) {
  const s = SCALES[mode];
  const oct = Math.floor(d / 7);
  return root + s[((d % 7) + 7) % 7] + 12 * oct;
}

export class MusicPlayer {
  private cue: MusicCue | null = null;
  private next = 0;            // next eighth-note time
  private step = 0;
  private stems: Record<Stem, GainNode>;
  private target: Record<Stem, number> = { base: 1, melody: 1, perc: 1, rival: 0, final: 0 };
  private pending: Partial<Record<Stem, number>> | null = null;
  private variation = 0;        // later generations: alternate arrangement (transposition / pattern), never faster playback
  readonly out: GainNode;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.connect(dest);
    const mk = () => { const g = ctx.createGain(); g.connect(this.out); return g; };
    this.stems = { base: mk(), melody: mk(), perc: mk(), rival: mk(), final: mk() };
  }

  play(id: string, variation = 0) {
    const cue = MUSIC[id];
    if (!cue || (this.cue?.id === id && this.variation === variation)) return;
    const fresh = !this.cue;
    this.cue = cue;
    this.variation = variation;
    this.step = 0;
    this.next = this.ctx.currentTime + (fresh ? 0.1 : 0.25);
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.8);
    this.setStems({ base: 1, melody: 1, perc: 1, rival: 0, final: 0 }, true);
  }

  stop() { this.cue = null; this.out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3); }

  /** Adaptive state: applied at the next bar line (immediate when `now`). */
  setStems(s: Partial<Record<Stem, number>>, now = false) {
    if (now) { for (const k in s) this.applyStem(k as Stem, s[k as Stem]!); return; }
    this.pending = { ...(this.pending ?? {}), ...s };
  }
  private applyStem(k: Stem, v: number) {
    this.target[k] = v;
    this.stems[k].gain.setTargetAtTime(v, this.ctx.currentTime, 0.25);
  }

  /** Schedule ahead (call every frame). */
  tick() {
    const cue = this.cue;
    if (!cue) return;
    const ahead = this.ctx.currentTime + 0.2;
    const e8 = 60 / cue.bpm / 2;
    while (this.next < ahead) {
      const bar = Math.floor(this.step / 8) % cue.bars;
      const pos = this.step % 8;
      if (pos === 0 && this.pending) { for (const k in this.pending) this.applyStem(k as Stem, this.pending[k as Stem]!); this.pending = null; }
      this.scheduleStep(cue, bar, pos, this.next, e8);
      this.next += e8;
      this.step++;
    }
  }

  private scheduleStep(cue: MusicCue, bar: number, pos: number, t: number, e8: number) {
    const root = cue.root + (this.variation % 2 ? 2 : 0);
    const phrase = bar % 4;
    const section = Math.floor(bar / 4) % 4;
    // melody: motif, answered/varied in later sections
    const mot = MOTIF[phrase];
    let d = mot[pos];
    if (section === 1 && d !== null) d = d + (pos % 2 ? 2 : 0);
    if (section === 3 && pos >= 6) d = null;
    const restSection = cue.feel === 'gentle' && section === 2 && pos % 2 === 1;
    if (d !== null && !restSection) this.note(cue.palette.lead, midi(degree(root + 12, cue.mode, d)), t, e8 * (mot[pos + 1] === null ? 2 : 1.1), 0.16, this.stems.melody);
    // chords on beats
    const ch = CHORDS[phrase];
    if (pos === 0 || (cue.feel !== 'gentle' && pos === 4) || (cue.feel === 'drive' && pos % 2 === 0)) {
      for (const k of ch) this.note(cue.palette.chord, midi(degree(root, cue.mode, k)), t + (cue.palette.chord === 'harp' ? (k - ch[0]) * 0.04 : 0), e8 * (cue.feel === 'gentle' ? 4 : 2), 0.07, this.stems.base);
    }
    // bass
    if (pos === 0 || pos === 4 || (cue.feel === 'sly' && pos % 2 === 0)) {
      const b = degree(root - 24, cue.mode, ch[0] + (cue.feel === 'sly' && pos === 6 ? 4 : 0));
      this.note(cue.palette.bass, midi(b), t, e8 * 1.6, 0.2, this.stems.base);
    }
    // percussion
    this.perc(cue.palette.perc, pos, t, cue.feel);
    // rivalry stem: off-beat plucks; final stretch: driving octave pulse + brass hits
    if (pos % 2 === 1) this.note('pluck', midi(degree(root + 12, cue.mode, ch[1])), t, e8 * 0.6, 0.06, this.stems.rival);
    if (pos % 2 === 0) this.note(cue.palette.lead === 'brass' ? 'brass' : 'pizz', midi(degree(root, cue.mode, ch[0]) + (pos % 4 ? 12 : 0)), t, e8 * 0.8, 0.09, this.stems.final);
  }

  private note(inst: Inst, f: number, t: number, dur: number, vel: number, dest: AudioNode) {
    const c = this.ctx;
    const g = c.createGain();
    g.connect(dest);
    const o = c.createOscillator();
    let o2: OscillatorNode | null = null;
    let atk = 0.005, dec = dur, sus = 0;
    switch (inst) {
      case 'celesta': o.type = 'sine'; o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4.01; dec = 0.9; break;
      case 'marimba': o.type = 'sine'; o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.9; dec = 0.35; break;
      case 'pizz': case 'pluck': case 'guitar': case 'harp': o.type = 'triangle'; dec = inst === 'harp' ? 0.8 : inst === 'guitar' ? 0.5 : 0.22; break;
      case 'flute': o.type = 'sine'; atk = 0.04; sus = 0.8; break;
      case 'brass': o.type = 'sawtooth'; atk = 0.03; sus = 0.7; break;
      case 'pad': o.type = 'triangle'; atk = 0.15; sus = 0.6; break;
      case 'bass': o.type = 'triangle'; dec = 0.4; break;
    }
    o.frequency.value = f;
    if (inst === 'flute') { const lfo = c.createOscillator(); const lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.3); }
    let src: AudioNode = o;
    if (inst === 'brass' || inst === 'guitar' || inst === 'pizz') {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(inst === 'brass' ? 900 : 3200, t);
      lp.frequency.exponentialRampToValueAtTime(inst === 'brass' ? 2200 : 700, t + Math.min(0.3, dur));
      o.connect(lp); src = lp;
    }
    src.connect(g);
    if (o2) { const g2 = c.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t + dur + 1); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + atk);
    if (sus > 0) { g.gain.setValueAtTime(vel * sus, t + Math.max(atk, dur * 0.8)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
    o.start(t);
    o.stop(t + dur + Math.max(dec, 0.2) + 0.2);
  }

  private noiseBuf: AudioBuffer | null = null;
  private perc(kit: PercKit, pos: number, t: number, feel: MusicCue['feel']) {
    if (kit === 'none') return;
    const c = this.ctx;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const hit = (freq: number, q: number, len: number, vel: number, type: BiquadFilterType = 'bandpass') => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f); f.connect(g); g.connect(this.stems.perc);
      s.start(t); s.stop(t + len + 0.02);
    };
    const kick = (vel: number) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(this.stems.perc); o.start(t); o.stop(t + 0.2);
    };
    if (kit === 'shaker') hit(7000, 1, 0.05, pos % 2 ? 0.05 : 0.08, 'highpass');
    if (kit === 'brush') { hit(5000, 0.7, 0.09, pos % 2 ? 0.05 : 0.09, 'highpass'); if (pos === 0 || pos === 4) kick(0.25); if (pos === 2 || pos === 6) hit(1800, 0.8, 0.12, 0.12); }
    if (kit === 'hand') { if (pos % 4 === 0) hit(400, 4, 0.12, 0.25); if (pos % 4 === 3) hit(900, 6, 0.06, 0.14); if (pos === 6) hit(1800, 8, 0.04, 0.1); }
    if (kit === 'festive') { if (pos % 2 === 0) kick(pos % 4 === 0 ? 0.32 : 0.15); hit(6000, 1, 0.05, 0.06, 'highpass'); if (pos === 2 || pos === 6) hit(1600, 0.7, 0.14, 0.16); }
    void feel;
  }
}
