import { MUSIC, type TrackDef } from '../data/music';

export type SfxKey =
  | 'bark' | 'jump' | 'land' | 'step' | 'bone' | 'hit' | 'defeat' | 'box_break' | 'boss_hit' | 'boss_clear'
  | 'ui_select' | 'ui_confirm' | 'ui_back' | 'whistle' | 'squirrel' | 'throw' | 'parcel' | 'squeak' | 'retreat' | 'burst_stretch' | 'burst_snap' | 'burst_ready';

/** Maximum simultaneous voices per effect. */
const VOICE_CAP: Partial<Record<SfxKey, number>> = { bone: 4, step: 2, bark: 2, land: 2, parcel: 3 };

/**
 * Procedural temporary audio (no recorded assets yet). Uses its own Web Audio
 * graph: master → { music bus, sfx bus }. Unlocks on first user gesture.
 */
class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private voices = new Map<SfxKey, number>();
  private tail: { src: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  private track: TrackDef | null = null;
  private trackKey: string | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private musicPaused = false;
  private barkVariant = 0;

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.master.connect(comp).connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.applyVolumes();
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.trackKey && this.timer === null && !this.musicPaused) this.startScheduler();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
    if (sfx <= 0) this.stopTail(true);
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicPaused ? 0 : this.musicVol * 0.55, t);
    this.sfxBus.gain.cancelScheduledValues(t);
    this.sfxBus.gain.setValueAtTime(this.sfxVol, t);
  }

  /** Suspend everything (tab hidden). */
  suspend(): void {
    this.stopTail(true);
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ------------------------------------------------------------- music

  playMusic(key: keyof typeof MUSIC): void {
    if (this.trackKey === key) return;
    this.stopScheduler();
    this.trackKey = key;
    this.track = MUSIC[key];
    this.step = 0;
    this.musicPaused = false;
    if (this.ctx) {
      this.applyVolumes();
      this.startScheduler();
    }
  }

  stopMusic(): void {
    this.stopScheduler();
    this.trackKey = null;
    this.track = null;
  }

  /** Fade music out and halt scheduling (pause). */
  pauseMusic(): void {
    this.musicPaused = true;
    this.stopScheduler();
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
      this.musicBus.gain.linearRampToValueAtTime(0, t + 0.15);
    }
  }

  resumeMusic(): void {
    this.musicPaused = false;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(0, t);
    this.musicBus.gain.linearRampToValueAtTime(this.musicVol * 0.55, t + 0.25);
    if (this.trackKey) this.startScheduler();
  }

  private startScheduler(): void {
    if (!this.ctx || !this.track || this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private stopScheduler(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    const ctx = this.ctx;
    const tr = this.track;
    if (!ctx || !tr || ctx.state !== 'running') return;
    const stepDur = 60 / tr.bpm / 2; // eighth notes
    while (this.nextTime < ctx.currentTime + 0.12) {
      const i = this.step % tr.length;
      for (const part of tr.parts) {
        const n = part.notes[i];
        if (n === null || n === undefined || n === -1) continue;
        let len = 1;
        while (part.notes[(i + len) % tr.length] === -1 && len < tr.length) len++;
        this.playNote(part.instrument, n, this.nextTime, len * stepDur);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private playNote(inst: string, midi: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.connect(this.musicBus);
    if (inst === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.18);
      return;
    }
    if (inst === 'snare' || inst === 'hat') {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = inst === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = inst === 'hat' ? 7000 : 1800;
      const v = inst === 'hat' ? 0.12 : 0.3;
      const d = inst === 'hat' ? 0.04 : 0.12;
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f).connect(g);
      s.start(t, Math.random() * 0.5);
      s.stop(t + d + 0.02);
      return;
    }
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    if (inst === 'bass') {
      o.type = 'triangle';
      f.type = 'lowpass';
      f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.42, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur, 0.35));
    } else if (inst === 'lead') {
      // Clarinet-ish: square through a low-pass with gentle vibrato.
      o.type = 'square';
      f.type = 'lowpass';
      f.frequency.value = 1800;
      f.Q.value = 2;
      const vib = ctx.createOscillator();
      const vg = ctx.createGain();
      vib.frequency.value = 5.5;
      vg.gain.value = freq * 0.006;
      vib.connect(vg).connect(o.frequency);
      vib.start(t);
      vib.stop(t + dur + 0.05);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.13, t + 0.03);
      g.gain.setValueAtTime(0.11, t + Math.max(0.04, dur - 0.06));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
    } else {
      // 'brass' stabs: muted sawtooth.
      o.type = 'sawtooth';
      f.type = 'lowpass';
      f.frequency.setValueAtTime(600, t);
      f.frequency.linearRampToValueAtTime(1400, t + 0.05);
      f.frequency.linearRampToValueAtTime(700, t + Math.min(dur, 0.25));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur, 0.3));
    }
    o.frequency.setValueAtTime(freq, t);
    o.connect(f).connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // --------------------------------------------------------------- sfx

  play(key: SfxKey): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.sfxVol <= 0) return;
    const cap = VOICE_CAP[key] ?? 3;
    const active = this.voices.get(key) ?? 0;
    if (active >= cap) return;
    this.voices.set(key, active + 1);
    const t = ctx.currentTime;
    const end = this.synth(key, t);
    window.setTimeout(() => this.voices.set(key, Math.max(0, (this.voices.get(key) ?? 1) - 1)), Math.max(30, (end - t) * 1000));
  }

  private out(gain: number, t: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(gain, t);
    g.connect(this.sfxBus);
    return g;
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, dest?: AudioNode): number {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
    return t + dur;
  }

  private noiseBurst(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1): number {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
    return t + dur;
  }

  private synth(key: SfxKey, t: number): number {
    switch (key) {
      case 'bark': {
        // Three yap variants: formant-filtered saw with a falling pitch.
        const v = this.barkVariant++ % 3;
        const base = [820, 960, 740][v];
        const ctx = this.ctx!;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = [1400, 1700, 1250][v];
        f.Q.value = 3;
        const g = this.out(1, t);
        f.connect(g);
        this.tone('sawtooth', base, base * 0.55, t, 0.11 + v * 0.02, 0.8, f);
        this.tone('square', base * 1.5, base * 0.7, t, 0.07, 0.25, f);
        return this.noiseBurst(t, 0.05, 0.15, 'bandpass', 2500, 2);
      }
      case 'jump':
        return this.tone('sine', 320, 760, t, 0.14, 0.35);
      case 'land':
        this.noiseBurst(t, 0.05, 0.12, 'lowpass', 600);
        return this.tone('sine', 150, 60, t, 0.1, 0.4);
      case 'step':
        return this.noiseBurst(t, 0.025, 0.05, 'highpass', 3000);
      case 'bone':
        this.tone('sine', 1320, 1320, t, 0.07, 0.22);
        return this.tone('sine', 1760, 1980, t + 0.06, 0.12, 0.22);
      case 'hit':
        this.tone('square', 260, 110, t, 0.22, 0.3);
        return this.noiseBurst(t, 0.1, 0.25, 'lowpass', 900);
      case 'defeat': {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const g = this.out(0.0001, t);
        o.type = 'triangle';
        o.frequency.setValueAtTime(620, t);
        o.frequency.exponentialRampToValueAtTime(140, t + 0.9);
        lfo.frequency.value = 9;
        lg.gain.value = 25;
        lfo.connect(lg).connect(o.frequency);
        g.gain.linearRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        o.connect(g);
        o.start(t);
        lfo.start(t);
        o.stop(t + 1.05);
        lfo.stop(t + 1.05);
        return t + 1.05;
      }
      case 'box_break':
        this.noiseBurst(t, 0.18, 0.45, 'bandpass', 1800, 0.8);
        this.noiseBurst(t + 0.05, 0.1, 0.3, 'bandpass', 3200, 1.5);
        return this.tone('triangle', 300, 120, t, 0.12, 0.2);
      case 'boss_hit':
        this.tone('square', 190, 120, t, 0.25, 0.25);
        this.tone('square', 283, 170, t, 0.22, 0.18);
        return this.noiseBurst(t, 0.15, 0.3, 'highpass', 2500);
      case 'boss_clear': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => this.tone('square', f, f, t + i * 0.11, 0.18, 0.18));
        return this.tone('triangle', 1047, 1047, t + 0.44, 0.5, 0.25);
      }
      case 'ui_select':
        return this.tone('sine', 900, 900, t, 0.05, 0.2);
      case 'ui_confirm':
        this.tone('sine', 700, 700, t, 0.06, 0.22);
        return this.tone('sine', 1050, 1050, t + 0.06, 0.09, 0.22);
      case 'ui_back':
        return this.tone('sine', 600, 380, t, 0.1, 0.2);
      case 'whistle': {
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const g = this.out(0.0001, t);
        o.frequency.value = 2300;
        lfo.frequency.value = 28;
        lg.gain.value = 120;
        lfo.connect(lg).connect(o.frequency);
        g.gain.linearRampToValueAtTime(0.16, t + 0.03);
        g.gain.setValueAtTime(0.16, t + 0.45);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(g);
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.62);
        lfo.stop(t + 0.62);
        return t + 0.62;
      }
      case 'squirrel':
        for (let i = 0; i < 4; i++) this.tone('square', 1900 - i * 80, 1500, t + i * 0.06, 0.04, 0.1);
        return t + 0.3;
      case 'throw':
        return this.noiseBurst(t, 0.12, 0.2, 'bandpass', 1200, 2);
      case 'parcel':
        return this.tone('triangle', 180, 120, t, 0.08, 0.25);
      case 'squeak':
        this.tone('sine', 1500, 2100, t, 0.08, 0.25);
        return this.tone('sine', 2100, 1300, t + 0.08, 0.08, 0.2);
      case 'burst_stretch': {
        // Rubber-band stretch: a warbling slide up, like pulling a slingshot.
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const g = this.out(0.0001, t);
        o.type = 'triangle';
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(820, t + 0.17);
        lfo.frequency.setValueAtTime(18, t);
        lfo.frequency.linearRampToValueAtTime(40, t + 0.17);
        lg.gain.value = 40;
        lfo.connect(lg).connect(o.frequency);
        g.gain.linearRampToValueAtTime(0.32, t + 0.02);
        g.gain.setValueAtTime(0.32, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g);
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.22);
        lfo.stop(t + 0.22);
        return t + 0.22;
      }
      case 'burst_snap': {
        // The back end snapping forward: a whip-crack, then a cartoon "boi-oi-oing".
        this.noiseBurst(t, 0.04, 0.55, 'highpass', 2500);
        this.tone('square', 1400, 300, t, 0.05, 0.22);
        const ctx = this.ctx!;
        const o = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const g = this.out(0.0001, t + 0.03);
        o.type = 'sine';
        o.frequency.setValueAtTime(260, t + 0.03);
        o.frequency.exponentialRampToValueAtTime(420, t + 0.5);
        lfo.frequency.setValueAtTime(14, t);
        lfo.frequency.linearRampToValueAtTime(6, t + 0.5);
        lg.gain.setValueAtTime(90, t + 0.03);
        lg.gain.exponentialRampToValueAtTime(5, t + 0.5);
        lfo.connect(lg).connect(o.frequency);
        g.gain.linearRampToValueAtTime(0.35, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        o.connect(g);
        o.start(t + 0.03);
        lfo.start(t);
        o.stop(t + 0.58);
        lfo.stop(t + 0.58);
        return t + 0.58;
      }
      case 'burst_ready':
        this.tone('sine', 880, 880, t, 0.06, 0.14);
        return this.tone('sine', 1320, 1320, t + 0.07, 0.1, 0.14);
      case 'retreat':
        return this.tone('sine', 500, 1400, t, 0.18, 0.18);
    }
  }

  // ---------------------------------------------------------- tail loop

  startTail(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.tail || this.sfxVol <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 1.5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 22;
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(am.gain);
    src.connect(f).connect(am).connect(gain).connect(this.sfxBus);
    const t = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(0.22, t + 0.05);
    src.start(t);
    lfo.start(t);
    this.tail = { src, gain, lfo };
  }

  stopTail(immediate = false): void {
    if (!this.tail || !this.ctx) {
      this.tail = null;
      return;
    }
    const { src, gain, lfo } = this.tail;
    this.tail = null;
    const t = this.ctx.currentTime;
    const end = immediate ? t + 0.005 : t + 0.08;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, end);
    src.stop(end + 0.01);
    lfo.stop(end + 0.01);
  }
}

export const Audio = new AudioManagerImpl();
