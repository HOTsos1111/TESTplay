import { MUSIC, type TrackDef } from '../data/music';

export type SfxKey =
  | 'bark' | 'jump' | 'land' | 'step' | 'bone' | 'hit' | 'defeat' | 'box_break' | 'boss_hit' | 'boss_clear'
  | 'ui_select' | 'ui_confirm' | 'ui_back' | 'whistle' | 'squirrel' | 'throw' | 'parcel' | 'squeak' | 'retreat'
  | 'burst_stretch' | 'burst_snap' | 'burst_ready' | 'powerup' | 'powerdown' | 'shield_pop' | 'sonic' | 'double_jump' | 'duck' | 'nut_land' | 'squirrel_angry' | 'page';

/** Maximum simultaneous voices per effect. */
const VOICE_CAP: Partial<Record<SfxKey, number>> = { bone: 4, step: 2, bark: 2, land: 2, parcel: 3, box_break: 2 };

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Recorded songs that stand in for a procedural track. */
const SONGS: Partial<Record<keyof typeof MUSIC, string>> = { title: 'audio/theme.mp3' };
/** Seconds of overlap when a song loops back to its start. */
const SONG_XFADE = 1.2;
/** Mastered songs are much louder than the synth band. */
const SONG_LEVEL = 0.55;

interface SongVoice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  /** Context time at which the song's position 0 played. */
  anchor: number;
}

/**
 * Procedural temporary audio (no recorded assets yet), built as a small cartoon
 * band and a box of slapstick sound effects. Graph:
 *   music bus ─┐
 *   sfx bus ───┼─▶ master ─▶ compressor ─▶ out
 *   reverb ────┘   (both buses send a little to a shared room reverb)
 */
class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverbIn!: GainNode;
  private noise!: AudioBuffer;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private voices = new Map<SfxKey, number>();
  private tail: { nodes: AudioScheduledSourceNode[]; gain: GainNode } | null = null;
  private track: TrackDef | null = null;
  private trackKey: string | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private musicPaused = false;
  private barkVariant = 0;
  private boneCombo = 0;
  /** Squirrel-threat overlay: frantic xylophone runs in the current track's key. */
  private overlayBus: GainNode | null = null;
  private overlayOn = false;
  private overlayNote = 4;
  private lastBone = 0;
  private songBytes = new Map<string, Promise<ArrayBuffer | null>>();
  private songBufs = new Map<string, AudioBuffer>();
  private songDecoding = new Set<string>();
  private songBus: GainNode | null = null;
  private songVoices: SongVoice[] = [];
  private songNext = 0;
  /** Where a paused song picks up again. */
  private songPos = 0;

  constructor() {
    // Fetch the recorded songs early so they are ready once audio unlocks.
    for (const url of Object.values(SONGS)) this.fetchSong(url);
  }

  private fetchSong(url: string): Promise<ArrayBuffer | null> {
    let p = this.songBytes.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
      this.songBytes.set(url, p);
    }
    return p;
  }

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        this.master.connect(comp).connect(ctx.destination);

        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        // Small warm room: generated decaying-noise impulse.
        const rev = ctx.createConvolver();
        const irLen = Math.floor(ctx.sampleRate * 1.3);
        const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const ch = ir.getChannelData(c);
          for (let i = 0; i < irLen; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
        }
        rev.buffer = ir;
        this.reverbIn = ctx.createGain();
        this.reverbIn.gain.value = 0.35;
        const revLp = ctx.createBiquadFilter();
        revLp.type = 'lowpass';
        revLp.frequency.value = 3500;
        this.reverbIn.connect(rev).connect(revLp).connect(this.master);

        this.overlayBus = ctx.createGain();
        this.overlayBus.gain.value = 0;
        this.musicBus = ctx.createGain();
        this.sfxBus = ctx.createGain();
        this.musicBus.connect(this.master);
        this.overlayBus.connect(this.musicBus);
        this.sfxBus.connect(this.master);
        // Songs skip the room reverb: they are already mixed.
        this.songBus = ctx.createGain();
        this.songBus.connect(this.master);
        const musicSend = ctx.createGain();
        musicSend.gain.value = 0.28;
        this.musicBus.connect(musicSend).connect(this.reverbIn);
        const sfxSend = ctx.createGain();
        sfxSend.gain.value = 0.16;
        this.sfxBus.connect(sfxSend).connect(this.reverbIn);
        this.applyVolumes();
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
    this.musicBus.gain.setValueAtTime(this.musicPaused ? 0 : this.musicVol * 0.5, t);
    this.sfxBus.gain.cancelScheduledValues(t);
    this.sfxBus.gain.setValueAtTime(this.sfxVol, t);
    this.songBus?.gain.cancelScheduledValues(t);
    this.songBus?.gain.setValueAtTime(this.musicPaused ? 0 : this.musicVol * SONG_LEVEL, t);
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
    this.songPos = 0;
    this.musicPaused = false;
    if (this.ctx) {
      this.applyVolumes();
      this.startScheduler();
    }
  }

  /** Turn the squirrel stress riff on/off (fades over half a second). */
  setThreat(on: boolean): void {
    if (on === this.overlayOn) return;
    this.overlayOn = on;
    if (!this.ctx || !this.overlayBus) return;
    const t = this.ctx.currentTime;
    this.overlayBus.gain.cancelScheduledValues(t);
    this.overlayBus.gain.setValueAtTime(this.overlayBus.gain.value, t);
    this.overlayBus.gain.linearRampToValueAtTime(on ? 1 : 0, t + 0.5);
  }

  /** Scale (MIDI notes) of the current track, so the riff stays in key. */
  private get threatScale(): number[] {
    return this.trackKey === 'chase'
      ? [69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88]
      : [72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89, 91];
  }

  private playThreat(t: number, eighth: number): void {
    const ctx = this.ctx!;
    const scale = this.threatScale;
    for (let k = 0; k < 2; k++) {
      if (Math.random() < 0.18) continue;
      // Jittery random walk with sudden leaps and stuttered repeats.
      const r = Math.random();
      if (r < 0.15) this.overlayNote += Math.random() < 0.5 ? 4 : -4;
      else if (r < 0.8) this.overlayNote += Math.random() < 0.5 ? 1 : -1;
      this.overlayNote = Math.max(0, Math.min(scale.length - 1, this.overlayNote));
      const f = midiHz(scale[this.overlayNote]);
      const tt = t + (k * eighth) / 2;
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o2.type = 'sine';
      o.frequency.value = f;
      o2.frequency.value = f * 4;
      this.env(g, tt, 0.002, 0.09, 0.09);
      o.connect(g);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2).connect(g);
      g.connect(this.overlayBus!);
      o.start(tt);
      o2.start(tt);
      o.stop(tt + 0.12);
      o2.stop(tt + 0.12);
    }
  }

  stopMusic(): void {
    this.stopScheduler();
    this.trackKey = null;
    this.track = null;
    this.songPos = 0;
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
    this.musicBus.gain.linearRampToValueAtTime(this.musicVol * 0.5, t + 0.25);
    this.songBus?.gain.cancelScheduledValues(t);
    this.songBus?.gain.setValueAtTime(this.musicVol * SONG_LEVEL, t);
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
    this.stopSong();
  }

  // ------------------------------------------------------------- songs

  private get songUrl(): string | undefined {
    return this.trackKey ? SONGS[this.trackKey as keyof typeof MUSIC] : undefined;
  }

  /** Keeps a recorded song looping, cross-fading its end into its start. */
  private scheduleSong(url: string): void {
    const ctx = this.ctx!;
    const buf = this.songBufs.get(url);
    if (!buf) {
      if (!this.songDecoding.has(url)) {
        this.songDecoding.add(url);
        void this.fetchSong(url)
          .then((bytes) => (bytes ? ctx.decodeAudioData(bytes.slice(0)) : null))
          .then((b) => b && this.songBufs.set(url, b))
          .catch(() => undefined)
          .finally(() => this.songDecoding.delete(url));
      }
      return;
    }
    const now = ctx.currentTime;
    if (!this.songVoices.length) {
      const pos = this.songPos < buf.duration - SONG_XFADE * 2 ? this.songPos : 0;
      this.startSongVoice(buf, now + 0.05, pos, pos > 0 ? 0.3 : 0.05);
    } else if (now >= this.songNext - 0.3) {
      this.startSongVoice(buf, this.songNext, 0, SONG_XFADE);
    }
  }

  private startSongVoice(buf: AudioBuffer, at: number, offset: number, fadeIn: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const end = at + buf.duration - offset;
    const fadeOut = end - SONG_XFADE;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + fadeIn);
    gain.gain.setValueAtTime(1, Math.max(at + fadeIn, fadeOut));
    gain.gain.linearRampToValueAtTime(0, end);
    src.connect(gain).connect(this.songBus!);
    src.start(at, offset);
    src.stop(end + 0.05);
    const voice: SongVoice = { src, gain, anchor: at - offset };
    src.onended = () => {
      this.songVoices = this.songVoices.filter((v) => v !== voice);
      gain.disconnect();
    };
    this.songVoices.push(voice);
    this.songNext = fadeOut;
  }

  /** Fades out any playing song, remembering where it was. */
  private stopSong(): void {
    const ctx = this.ctx;
    if (!ctx || !this.songVoices.length) return;
    const now = ctx.currentTime;
    const playing = this.songVoices.filter((v) => v.anchor <= now).pop();
    if (playing) this.songPos = now - playing.anchor;
    for (const v of this.songVoices) {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + 0.25);
      v.src.onended = () => v.gain.disconnect();
      try {
        v.src.stop(now + 0.3);
      } catch {
        // Already stopped.
      }
    }
    this.songVoices = [];
  }

  private schedule(): void {
    const ctx = this.ctx;
    const tr = this.track;
    if (!ctx || !tr || ctx.state !== 'running') return;
    const song = this.songUrl;
    if (song && this.songBus) {
      this.scheduleSong(song);
      return;
    }
    const eighth = 60 / tr.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const i = this.step % tr.length;
      // Swing: off-beat eighths land a little late for a bouncy cartoon feel.
      const swing = i % 2 === 1 ? eighth * (tr.swing ?? 0) : 0;
      for (const part of tr.parts) {
        const n = part.notes[i];
        if (n === null || n === undefined || n === -1) continue;
        let len = 1;
        while (part.notes[(i + len) % tr.length] === -1 && len < tr.length) len++;
        this.playNote(part.instrument, n, this.nextTime + swing, len * eighth);
      }
      if (this.overlayOn || (this.overlayBus && this.overlayBus.gain.value > 0.01)) this.playThreat(this.nextTime + swing, eighth);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number, sustain = 0.0008): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0008, sustain), t + a + d);
  }

  private playNote(inst: string, midi: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const bus = this.musicBus;
    const freq = midiHz(midi);
    switch (inst) {
      case 'kick': {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
        this.env(g, t, 0.003, 0.75, 0.18);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + 0.22);
        this.noiseHit(t, 0.012, 0.15, 'highpass', 3000, bus);
        return;
      }
      case 'snare':
        this.noiseHit(t, 0.13, 0.28, 'bandpass', 2200, bus, 0.8);
        this.oneShot('triangle', 190, 150, t, 0.07, 0.18, bus);
        return;
      case 'hat':
        this.noiseHit(t, 0.035, 0.09, 'highpass', 8000, bus);
        return;
      case 'block':
        // Comic woodblock.
        this.oneShot('sine', 1100, 1050, t, 0.05, 0.22, bus);
        this.oneShot('square', 2200, 2100, t, 0.015, 0.04, bus);
        return;
      case 'bass': {
        // Plucked upright bass: triangle body with a thumpy sine underneath.
        const o = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'triangle';
        sub.type = 'sine';
        o.frequency.value = freq;
        sub.frequency.value = freq;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(1400, t);
        f.frequency.exponentialRampToValueAtTime(380, t + 0.18);
        this.env(g, t, 0.006, 0.5, Math.min(dur, 0.45));
        o.connect(f);
        sub.connect(f);
        f.connect(g).connect(bus);
        o.start(t);
        sub.start(t);
        o.stop(t + dur + 0.05);
        sub.stop(t + dur + 0.05);
        return;
      }
      case 'pluck': {
        // Banjo/ukulele chord tone: bright saw with a fast filter snap.
        const o = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        f.type = 'lowpass';
        f.Q.value = 3;
        f.frequency.setValueAtTime(4200, t);
        f.frequency.exponentialRampToValueAtTime(600, t + 0.12);
        this.env(g, t, 0.003, 0.07, Math.min(0.32, dur));
        o.connect(f).connect(g).connect(bus);
        o.start(t);
        o.stop(t + 0.4);
        return;
      }
      case 'lead': {
        // Clarinet-ish: two slightly detuned squares, low-passed, with delayed vibrato.
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = Math.min(4000, freq * 4);
        f.Q.value = 1.5;
        const vib = ctx.createOscillator();
        const vg = ctx.createGain();
        vib.frequency.value = 5.2;
        vg.gain.setValueAtTime(0, t);
        vg.gain.linearRampToValueAtTime(freq * 0.008, t + Math.min(0.25, dur));
        vib.connect(vg);
        for (const det of [-4, 4]) {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = freq;
          o.detune.value = det;
          vg.connect(o.frequency);
          o.connect(f);
          o.start(t);
          o.stop(t + dur + 0.08);
        }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.075, t + 0.03);
        g.gain.setValueAtTime(0.065, t + Math.max(0.04, dur - 0.06));
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
        f.connect(g).connect(bus);
        vib.start(t);
        vib.stop(t + dur + 0.08);
        return;
      }
      default: {
        // 'brass' stabs: detuned saws through a "wah" filter.
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 2.5;
        f.frequency.setValueAtTime(500, t);
        f.frequency.linearRampToValueAtTime(1600, t + 0.06);
        f.frequency.linearRampToValueAtTime(800, t + Math.min(dur, 0.3));
        for (const det of [-7, 7]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = freq;
          o.detune.value = det;
          o.connect(f);
          o.start(t);
          o.stop(t + Math.min(dur, 0.35) + 0.05);
        }
        this.env(g, t, 0.02, 0.14, Math.min(dur, 0.32));
        f.connect(g).connect(bus);
      }
    }
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

  /** Gain node into the sfx bus starting silent. */
  private out(t: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.connect(this.sfxBus);
    return g;
  }

  private oneShot(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, dest?: AudioNode): number {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.006, vol, dur);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
    return t + dur;
  }

  private noiseHit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, dest?: AudioNode, q = 1): number {
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
    s.connect(f).connect(g).connect(dest ?? this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
    return t + dur;
  }

  /** Oscillator with an LFO wobbling its pitch (springs, rubber bands, whistles). */
  private wobble(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, lfoHz: number, depth0: number, depth1: number, dest?: AudioNode): number {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    lfo.frequency.value = lfoHz;
    lg.gain.setValueAtTime(depth0, t);
    lg.gain.exponentialRampToValueAtTime(Math.max(0.1, depth1), t + dur);
    lfo.connect(lg).connect(o.frequency);
    this.env(g, t, 0.01, vol, dur);
    o.connect(g).connect(dest ?? this.sfxBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.03);
    lfo.stop(t + dur + 0.03);
    return t + dur;
  }

  private synth(key: SfxKey, t: number): number {
    const ctx = this.ctx!;
    switch (key) {
      case 'bark': {
        // "wuh-RUF": a short throat note into a sharp yap, through two voice formants.
        const v = this.barkVariant++ % 3;
        const base = [560, 660, 500][v];
        const g = this.out(t);
        g.gain.linearRampToValueAtTime(1, t + 0.005);
        g.gain.setValueAtTime(1, t + 0.16);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        for (const [fq, q, amt] of [[900 + v * 80, 4, 1], [2200 + v * 150, 6, 0.6]] as const) {
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = fq;
          f.Q.value = q;
          const fg = ctx.createGain();
          fg.gain.value = amt;
          f.connect(fg).connect(g);
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(base * 0.7, t);
          o.frequency.linearRampToValueAtTime(base * 1.25, t + 0.035);
          o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.2);
          const og = ctx.createGain();
          og.gain.setValueAtTime(0.5, t);
          og.gain.linearRampToValueAtTime(1.6, t + 0.04);
          og.gain.exponentialRampToValueAtTime(0.05, t + 0.22);
          o.connect(og).connect(f);
          o.start(t);
          o.stop(t + 0.25);
        }
        return this.noiseHit(t + 0.02, 0.06, 0.18, 'bandpass', 3000, undefined, 1.5);
      }
      case 'jump':
        // Cartoon spring: rising pitch with a fast wobble.
        return this.wobble('sine', 260, 640, t, 0.2, 0.35, 32, 60, 10);
      case 'land':
        this.noiseHit(t, 0.09, 0.22, 'lowpass', 700);
        return this.oneShot('sine', 120, 55, t, 0.12, 0.45);
      case 'step':
        return this.noiseHit(t, 0.02, 0.06, 'bandpass', 2400 + Math.random() * 800, undefined, 3);
      case 'bone': {
        // Climbing chime: each bone in a quick run plays a step higher.
        const now = performance.now();
        this.boneCombo = now - this.lastBone < 700 ? Math.min(12, this.boneCombo + 1) : 0;
        this.lastBone = now;
        const steps = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21];
        const f = midiHz(84 + steps[this.boneCombo]);
        this.oneShot('triangle', f, f, t, 0.18, 0.2);
        this.oneShot('sine', f * 2, f * 2, t, 0.1, 0.08);
        return this.oneShot('sine', f * 1.5, f * 1.5, t + 0.05, 0.16, 0.08);
      }
      case 'hit':
        // Woodblock BONK plus a slide whistle down.
        this.oneShot('sine', 700, 640, t, 0.07, 0.45);
        this.oneShot('square', 350, 300, t, 0.04, 0.15);
        return this.wobble('sine', 1200, 300, t + 0.04, 0.35, 0.22, 7, 30, 10);
      case 'defeat': {
        // Sad trombone: "wah wah wah waaaah".
        const notes = [[58, 0.32], [57, 0.32], [56, 0.32], [55, 1.0]] as const;
        let tt = t;
        for (const [m, d] of notes) {
          const g = this.out(tt);
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.Q.value = 3;
          f.frequency.setValueAtTime(400, tt);
          f.frequency.linearRampToValueAtTime(1300, tt + 0.12);
          f.frequency.linearRampToValueAtTime(500, tt + d);
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midiHz(m);
          if (d > 0.5) {
            const lfo = ctx.createOscillator();
            const lg = ctx.createGain();
            lfo.frequency.value = 6;
            lg.gain.value = 6;
            lfo.connect(lg).connect(o.frequency);
            lfo.start(tt);
            lfo.stop(tt + d);
          }
          g.gain.linearRampToValueAtTime(0.4, tt + 0.04);
          g.gain.setValueAtTime(0.4, tt + d - 0.08);
          g.gain.linearRampToValueAtTime(0.0001, tt + d);
          o.connect(f).connect(g);
          o.start(tt);
          o.stop(tt + d + 0.02);
          tt += d + 0.04;
        }
        return tt;
      }
      case 'box_break':
        for (let i = 0; i < 5; i++) {
          this.noiseHit(t + i * 0.025 + Math.random() * 0.02, 0.07, 0.3, 'bandpass', 900 + Math.random() * 2500, undefined, 1.2);
        }
        return this.oneShot('triangle', 220, 90, t, 0.14, 0.25);
      case 'boss_hit':
        // Metal CLANG: inharmonic partials ringing out, then a "doink".
        for (const [f, v] of [[340, 0.2], [523, 0.14], [871, 0.1], [1290, 0.07]] as const) this.oneShot('sine', f, f * 0.98, t, 0.6, v);
        this.noiseHit(t, 0.06, 0.3, 'highpass', 3000);
        return this.wobble('sine', 500, 900, t + 0.12, 0.25, 0.2, 18, 50, 5);
      case 'boss_clear': {
        const seq = [60, 64, 67, 72, 67, 72, 76];
        seq.forEach((m, i) => this.playBrassSfx(m, t + i * 0.1, i === seq.length - 1 ? 0.6 : 0.12));
        return t + 1.3;
      }
      case 'ui_select':
        return this.oneShot('sine', 880, 760, t, 0.05, 0.16);
      case 'page': {
        // Paper page flip: a rising swish, then the page settling.
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 0.9;
        f.frequency.setValueAtTime(900, t);
        f.frequency.exponentialRampToValueAtTime(4200, t + 0.22);
        f.frequency.exponentialRampToValueAtTime(1800, t + 0.34);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.34, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        src.connect(f).connect(g).connect(this.sfxBus);
        src.start(t, Math.random() * 0.5);
        src.stop(t + 0.4);
        this.noiseHit(t + 0.3, 0.06, 0.14, 'lowpass', 700);
        return t + 0.4;
      }
      case 'ui_confirm':
        this.oneShot('sine', 660, 640, t, 0.05, 0.18);
        return this.oneShot('sine', 990, 980, t + 0.06, 0.09, 0.18);
      case 'ui_back':
        return this.oneShot('sine', 620, 380, t, 0.1, 0.16);
      case 'whistle': {
        // Referee whistle: pea rattle trill.
        const o = ctx.createOscillator();
        const am = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const g = this.out(t);
        o.frequency.setValueAtTime(2700, t);
        o.frequency.linearRampToValueAtTime(2900, t + 0.5);
        lfo.type = 'square';
        lfo.frequency.value = 32;
        lg.gain.value = 0.45;
        am.gain.value = 0.55;
        lfo.connect(lg).connect(am.gain);
        g.gain.linearRampToValueAtTime(0.16, t + 0.03);
        g.gain.setValueAtTime(0.16, t + 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
        o.connect(am).connect(g);
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.64);
        lfo.stop(t + 0.64);
        return t + 0.64;
      }
      case 'squirrel':
        for (let i = 0; i < 7; i++) {
          const f = 2200 + Math.random() * 900;
          this.oneShot('square', f, f * 0.7, t + i * 0.045, 0.03, 0.06);
        }
        return t + 0.35;
      case 'throw':
        return this.whoosh(t, 0.16, 600, 2400, 0.25);
      case 'parcel':
        this.noiseHit(t, 0.05, 0.25, 'lowpass', 900);
        return this.oneShot('triangle', 160, 110, t, 0.08, 0.3);
      case 'squeak':
        this.oneShot('sine', 1300, 2200, t, 0.07, 0.22);
        return this.oneShot('sine', 2200, 1200, t + 0.07, 0.09, 0.18);
      case 'retreat':
        return this.wobble('sine', 500, 1600, t, 0.25, 0.18, 10, 40, 20);
      case 'burst_stretch': {
        // Rubber band creaking as it's pulled: gritty rising saw with a fast "creak"
        // flutter, plus a rising slide whistle on top.
        const g = this.out(t);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(500, t);
        f.frequency.exponentialRampToValueAtTime(2600, t + 0.24);
        f.Q.value = 6;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(70, t);
        o.frequency.exponentialRampToValueAtTime(420, t + 0.25);
        const am = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.type = 'square';
        lfo.frequency.setValueAtTime(28, t);
        lfo.frequency.linearRampToValueAtTime(70, t + 0.25);
        lg.gain.value = 0.5;
        am.gain.value = 0.5;
        lfo.connect(lg).connect(am.gain);
        g.gain.linearRampToValueAtTime(0.5, t + 0.03);
        g.gain.setValueAtTime(0.5, t + 0.22);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
        o.connect(am).connect(f).connect(g);
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.28);
        lfo.stop(t + 0.28);
        this.wobble('sine', 500, 1900, t, 0.25, 0.16, 9, 30, 50);
        return t + 0.28;
      }
      case 'burst_snap': {
        // THWANG: a low twanging string with a closing filter, a whip crack,
        // a long cartoon spring "boi-oi-oi-oing" and a whoosh as he takes off.
        this.noiseHit(t, 0.03, 0.7, 'highpass', 3000);
        const g = this.out(t);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 8;
        f.frequency.setValueAtTime(5000, t);
        f.frequency.exponentialRampToValueAtTime(220, t + 0.5);
        for (const [m, det] of [[1, 0], [2.01, 0], [1, 9]] as const) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(98 * m, t);
          o.frequency.exponentialRampToValueAtTime(92 * m, t + 0.5);
          o.detune.value = det;
          o.connect(f);
          o.start(t);
          o.stop(t + 0.55);
        }
        g.gain.linearRampToValueAtTime(0.5, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        f.connect(g);
        this.wobble('sine', 240, 520, t + 0.04, 0.75, 0.32, 13, 120, 4);
        return this.whoosh(t + 0.03, 0.45, 2500, 300, 0.3);
      }
      case 'double_jump':
        // Higher, springier "bwoing" plus a little whoosh for the somersault.
        this.wobble('sine', 420, 1100, t, 0.22, 0.32, 38, 90, 10);
        return this.whoosh(t, 0.3, 800, 3000, 0.18);
      case 'duck':
        // Squishy "flump".
        this.oneShot('sine', 300, 120, t, 0.1, 0.3);
        return this.noiseHit(t, 0.06, 0.15, 'lowpass', 600);
      case 'nut_land':
        return this.oneShot('triangle', 900, 600, t, 0.05, 0.16);
      case 'squirrel_angry':
        // Furious chitter-chatter.
        for (let i = 0; i < 10; i++) {
          const f = 1800 + Math.random() * 1500;
          this.oneShot('sawtooth', f, f * 0.6, t + i * 0.035 + Math.random() * 0.01, 0.028, 0.07);
        }
        return t + 0.4;
      case 'powerup': {
        [72, 76, 79, 84, 88].forEach((m, i) => this.oneShot('triangle', midiHz(m), midiHz(m), t + i * 0.06, 0.16, 0.2));
        return this.wobble('sine', 1600, 2400, t + 0.3, 0.25, 0.08, 20, 60, 10);
      }
      case 'powerdown':
        [79, 74, 70, 67].forEach((m, i) => this.oneShot('triangle', midiHz(m), midiHz(m), t + i * 0.07, 0.12, 0.14));
        return t + 0.4;
      case 'shield_pop':
        this.noiseHit(t, 0.05, 0.5, 'highpass', 4000);
        for (const f of [1800, 2700, 3900]) this.oneShot('sine', f, f * 1.02, t, 0.35, 0.08);
        return this.oneShot('sine', 600, 150, t, 0.12, 0.3);
      case 'sonic':
        // Dog whistle: piercing sweep plus a big whoosh.
        this.wobble('sine', 2400, 4200, t, 0.6, 0.12, 25, 80, 40);
        return this.whoosh(t, 0.6, 400, 4000, 0.35);
      case 'burst_ready':
        this.oneShot('triangle', 1320, 1320, t, 0.08, 0.14);
        this.oneShot('triangle', 1760, 1760, t + 0.07, 0.08, 0.14);
        return this.oneShot('triangle', 2640, 2640, t + 0.14, 0.14, 0.12);
    }
  }

  private whoosh(t: number, dur: number, f0: number, f1: number, vol: number): number {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t, Math.random() * 0.4);
    s.stop(t + dur + 0.02);
    return t + dur;
  }

  private playBrassSfx(midi: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const g = this.out(t);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(2000, t + 0.05);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiHz(midi);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.setValueAtTime(0.2, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.04);
    f.connect(g);
  }

  // ---------------------------------------------------------- tail loop

  /** Propeller whirr: a buzzy low saw chopped by the blades, plus air noise. */
  startTail(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.tail || this.sfxVol <= 0) return;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.06);
    gain.connect(this.sfxBus);
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const blades = ctx.createOscillator();
    const bg = ctx.createGain();
    blades.frequency.value = 26;
    bg.gain.value = 0.5;
    blades.connect(bg).connect(chop.gain);
    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(70, t);
    motor.frequency.linearRampToValueAtTime(95, t + 0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.2;
    const airG = ctx.createGain();
    airG.gain.value = 0.6;
    motor.connect(lp).connect(chop);
    air.connect(bp).connect(airG).connect(chop);
    chop.connect(gain);
    motor.start(t);
    blades.start(t);
    air.start(t);
    this.tail = { nodes: [motor, blades, air], gain };
  }

  stopTail(immediate = false): void {
    if (!this.tail || !this.ctx) {
      this.tail = null;
      return;
    }
    const { nodes, gain } = this.tail;
    this.tail = null;
    const t = this.ctx.currentTime;
    const end = immediate ? t + 0.005 : t + 0.1;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, end);
    for (const n of nodes) n.stop(end + 0.01);
  }
}

export const Audio = new AudioManagerImpl();
