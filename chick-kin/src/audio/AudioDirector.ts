// AudioDirector: bus hierarchy, cue playback (variation, no immediate repeats, cooldowns, concurrency,
// priority voice stealing), play-focus panning, ducking, ambience beds and adaptive music.
import { CUES, type Bus, type Cue } from './cues';
import { SYNTH } from './synth';
import { MusicPlayer, type Stem } from './music';
import type { Settings } from '../core/SaveManager';
import type { SimEvent } from '../sim/events';
import type { Match } from '../sim/match';
import type { Theme } from '../sim/types';

const VOICE_BUDGET = 40;
interface Voice { src: AudioBufferSourceNode; cue: string; priority: number; end: number }

export class AudioDirector {
  ctx: AudioContext | null = null;
  private buses = {} as Record<Bus | 'master' | 'music' | 'sfx' | 'duck', GainNode>;
  private comp!: DynamicsCompressorNode;
  private buffers = new Map<string, AudioBuffer[]>();
  private lastVariant = new Map<string, number>();
  private lastPlay = new Map<string, number>();
  private voices: Voice[] = [];
  music: MusicPlayer | null = null;
  private amb: { src: AudioBufferSourceNode; gain: GainNode; filt: BiquadFilterNode } | null = null;
  private ambTheme: Theme | null = null;
  private ambT = 0;
  private crumbChain = 0;
  private crumbChainT = 0;
  private settings: Settings | null = null;
  /** Captions for essential audio (visual equivalents); UI subscribes. */
  onCaption: ((text: string, kind: 'alert' | 'info') => void) | null = null;
  listenerX = 0;
  stats = { voices: 0, played: 0, stolen: 0, skipped: 0 };

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const g = () => ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -6; this.comp.knee.value = 6; this.comp.ratio.value = 3; this.comp.attack.value = 0.005; this.comp.release.value = 0.2;
    const B = this.buses;
    B.master = g(); B.master.connect(this.comp); this.comp.connect(ctx.destination);
    B.duck = g(); B.duck.connect(B.master);
    B.music = g(); B.music.connect(B.duck);
    B.ambience = g(); B.ambience.connect(B.duck);
    B.sfx = g(); B.sfx.connect(B.master);
    for (const k of ['player', 'rivals', 'interactions', 'hazards', 'pickups'] as Bus[]) { B[k] = g(); B[k].connect(B.sfx); }
    B.voice = g(); B.voice.connect(B.master);
    B.ui = g(); B.ui.connect(B.master);
    this.music = new MusicPlayer(ctx, B.music);
    // Pre-render TEMP buffers (frequent short effects are preloaded).
    for (const [name, cue] of Object.entries(CUES)) {
      if (this.buffers.has(cue.src + ':' + cue.variants)) continue;
      const fn = SYNTH[cue.src];
      if (!fn) continue;
      const list: AudioBuffer[] = [];
      for (let v = 0; v < cue.variants; v++) list.push(fn(ctx, v));
      this.buffers.set(cue.src + ':' + cue.variants, list);
      void name;
    }
    if (this.settings) this.apply(this.settings);
  }

  apply(s: Settings) {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (n: GainNode, v: number) => n.gain.setTargetAtTime(v, t, 0.05);
    set(this.buses.master, s.muted ? 0 : s.master);
    set(this.buses.music, s.music * 0.55);
    set(this.buses.sfx, s.sfx);
    set(this.buses.voice, s.voice);
    set(this.buses.ambience, s.ambience * 0.5);
    set(this.buses.ui, Math.min(1, s.sfx * 1.1));
    // Dynamic range modes: Night compresses harder so alerts stay audible quietly.
    const night = s.dynamics === 'night';
    this.comp.threshold.value = night ? -28 : s.dynamics === 'headphones' ? -10 : -6;
    this.comp.ratio.value = night ? 8 : 3;
  }

  suspend() { void this.ctx?.suspend(); }
  resume() { void this.ctx?.resume(); }

  play(name: string, opts: { x?: number; pitch?: number; gain?: number; actor?: number } = {}) {
    const ctx = this.ctx;
    const cue = CUES[name];
    if (!ctx || !cue) return;
    const now = ctx.currentTime;
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < cue.cooldown) { this.stats.skipped++; return; }
    const active = this.voices.filter((v) => v.cue === name && v.end > now);
    if (active.length >= cue.max) { this.stats.skipped++; return; }
    this.voices = this.voices.filter((v) => v.end > now);
    if (this.voices.length >= VOICE_BUDGET) {
      // steal the lowest-priority voice if this one matters more
      this.voices.sort((a, b) => a.priority - b.priority);
      if (this.voices[0].priority < cue.priority) { try { this.voices[0].src.stop(); } catch { /* already stopped */ } this.voices.shift(); this.stats.stolen++; }
      else { this.stats.skipped++; return; }
    }
    const list = this.buffers.get(cue.src + ':' + cue.variants);
    if (!list) return;
    // random variant without immediate repeat
    let v = Math.floor(Math.random() * list.length);
    if (list.length > 1 && v === this.lastVariant.get(name)) v = (v + 1) % list.length;
    this.lastVariant.set(name, v);
    this.lastPlay.set(name, now);
    const src = ctx.createBufferSource();
    src.buffer = list[v];
    src.playbackRate.value = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * cue.pitch);
    const g = ctx.createGain();
    g.gain.value = cue.gain * (opts.gain ?? 1) * (0.92 + Math.random() * 0.08);
    let node: AudioNode = g;
    if (opts.x !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      const dx = opts.x - this.listenerX;
      p.pan.value = Math.max(-0.8, Math.min(0.8, dx / 10));
      // attenuation from the play focus (not the camera height); hazards stay audible within fair warning range
      const fall = cue.bus === 'hazards' ? 26 : 16;
      g.gain.value *= Math.max(0.15, 1 - Math.abs(dx) / fall);
      g.connect(p); node = p;
    }
    src.connect(g);
    const bus = opts.actor !== undefined && opts.actor > 0 && cue.bus === 'player' ? 'rivals' : cue.bus;
    node.connect(this.buses[bus]);
    src.start();
    this.voices.push({ src, cue: name, priority: cue.priority, end: now + src.buffer.duration / src.playbackRate.value });
    this.stats.played++;
    this.stats.voices = this.voices.length;
    if (cue.duck) this.duck();
  }

  /** Gentle 3 dB duck of music + ambience with smooth attack/release. */
  private duck() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.buses.duck.gain;
    d.cancelScheduledValues(t);
    d.setTargetAtTime(0.7, t, 0.04);
    d.setTargetAtTime(1, t + 0.5, 0.35);
  }

  playMusic(id: string, variation = 0) { this.music?.play(id, variation); }
  stopMusic() { this.music?.stop(); }
  stems(s: Partial<Record<Stem, number>>) { this.music?.setStems(s); }

  /** Ambience bed: layered filtered noise per chapter with occasional positional one-shots. */
  ambience(theme: Theme | null) {
    const ctx = this.ctx;
    if (!ctx || theme === this.ambTheme) return;
    this.ambTheme = theme;
    if (this.amb) { const a = this.amb; a.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { try { a.src.stop(); } catch { /* */ } }, 1500); this.amb = null; }
    if (!theme) return;
    const len = ctx.sampleRate * 4;
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < len; i++) { y += 0.02 * ((Math.random() * 2 - 1) - y); d[i] = y * 4 * (0.7 + 0.3 * Math.sin((i / len) * Math.PI * 2 * 3 + ch)); }
    }
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    const conf: Record<Theme, [number, number]> = { nest: [1800, 0.25], coop: [500, 0.3], rafters: [350, 0.35], farmyard: [1200, 0.3], championship: [900, 0.45] };
    filt.frequency.value = conf[theme][0]; filt.Q.value = 0.6;
    const gain = ctx.createGain(); gain.gain.value = 0;
    gain.gain.setTargetAtTime(conf[theme][1], ctx.currentTime, 0.8);
    src.connect(filt); filt.connect(gain); gain.connect(this.buses.ambience);
    src.start();
    this.amb = { src, gain, filt };
  }

  /** Per-frame: music scheduling, ambience one-shots, rapid-pickup pitch decay. */
  tick(dt: number) {
    if (!this.ctx) return;
    this.music?.tick();
    this.crumbChainT -= dt;
    if (this.crumbChainT <= 0) this.crumbChain = 0;
    this.ambT -= dt;
    if (this.ambT <= 0 && this.ambTheme) {
      this.ambT = 3 + Math.random() * 5;
      const th = this.ambTheme;
      if (th === 'coop' || th === 'rafters') this.play('haz.creak', { x: this.listenerX + (Math.random() - 0.5) * 20, gain: 0.5 });
      else if (th === 'farmyard' || th === 'nest') this.play('vo.nimble', { x: this.listenerX + (Math.random() - 0.5) * 30, gain: 0.25, pitch: 1.3 });
      else if (th === 'championship') this.play('vo.mighty', { x: this.listenerX + (Math.random() - 0.5) * 30, gain: 0.3, pitch: 0.9 });
    }
  }

  /** Map semantic gameplay events to cues. Captions give visual equivalents for essential audio. */
  onSim(evs: SimEvent[], m: Match) {
    if (!this.ctx) return;
    const pid = m.player.id;
    const pAr = m.arenaOf(m.player);
    for (const e of evs) {
      const a = 'a' in e ? m.actors[(e as { a: number }).a] : null;
      if (a && m.arenaOf(a) !== pAr) continue;
      const x = 'x' in e ? (e as { x: number }).x : undefined;
      const mine = a?.id === pid;
      const actor = a?.id;
      switch (e.type) {
        case 'countdown': this.play('comp.count'); break;
        case 'go': this.play('comp.go'); this.onCaption?.('GO!', 'alert'); break;
        case 'jump': this.play('move.jump', { x, actor, gain: mine ? 1 : 0.5 }); break;
        case 'flap': this.play('move.flap', { x, actor, gain: mine ? 1 : 0.5 }); break;
        case 'land': if (Math.abs(e.speed) > 3) this.play('move.land', { x, actor, gain: Math.min(1, Math.abs(e.speed) / 12) * (mine ? 1 : 0.5) }); break;
        case 'peck': this.play('act.peck', { x, actor }); break;
        case 'scratch': this.play('act.scratch', { x, actor, gain: mine ? 1 : 0.5 }); break;
        case 'break': this.play('act.break', { x }); break;
        case 'push': this.play('act.push', { x, actor }); break;
        case 'gate': this.play('act.gate', { x }); break;
        case 'drop': this.play('act.drop', { x, actor }); if (mine) this.onCaption?.('Dropped your cargo!', 'info'); break;
        case 'deliver': this.play('act.deliver', { x, gain: mine ? 1 : 0.5 }); break;
        case 'tugStart': this.play('act.tug', { x }); break;
        case 'tugWin': this.play('pick.worm', { x, gain: mine ? 1 : 0.6 }); break;
        case 'ability': this.play(a?.cls === 'speedy' ? 'ab.zoomies' : a?.cls === 'mighty' ? 'ab.fluffbump' : 'ab.fancy', { x, actor, gain: mine ? 1 : 0.6 }); break;
        case 'abilityReady': if (mine) this.play('ab.ready'); break;
        case 'eggRelease': this.play('haz.egg.release', { x }); break;
        case 'bump': this.play('haz.bump', { x, gain: mine ? 1 : 0.5 }); if (a) this.voice(a.cls, x, mine ? 1 : 0.5); break;
        case 'mud': this.play('haz.mud', { x }); break;
        case 'windWarn': this.play('haz.wind.warn', { x }); this.onCaption?.('Wind gust incoming', 'alert'); break;
        case 'spring': this.play('haz.spring', { x }); break;
        case 'pickup': {
          if (e.item === 'crumb') {
            if (!mine && e.value === 0) break;
            this.crumbChain = Math.min(7, this.crumbChain + 1); this.crumbChainT = 1.2;
            this.play('pick.crumb', { x, pitch: mine ? Math.pow(2, this.crumbChain / 12) : 1, gain: mine ? 1 : 0.35 });
          } else if (e.item === 'feather') { this.play('pick.feather', { x }); if (mine) this.onCaption?.('Golden feather!', 'info'); }
          else if (e.item === 'bundle') this.play('pick.bundle', { x, gain: mine ? 1 : 0.5 });
          else this.play('pick.treat', { x, gain: mine ? 1 : 0.4 });
          break;
        }
        case 'power': this.play('pu.get', { x, gain: mine ? 1 : 0.5 }); break;
        case 'shield': this.play('pu.shield.break', { x }); break;
        case 'powerEnd': if (mine) this.play('pu.expire'); break;
        case 'checkpoint': if (mine) this.play('comp.checkpoint'); break;
        case 'leadChange': this.play('comp.lead'); break;
        case 'perchClaim': this.play(mine ? 'comp.perch.claim' : 'comp.perch.lost', { gain: mine ? 1 : 0.6 }); if (!mine && m.player.st.perchTime > 0) this.onCaption?.('A sibling claimed the perch', 'alert'); break;
        case 'perchLost': if (mine) this.play('comp.perch.lost'); break;
        case 'timerLow': this.play('comp.timer'); break;
        case 'complete': if (mine) this.play('comp.finish'); else this.voice(a!.cls, x, 0.4); break;
        case 'respawn': if (mine) this.onCaption?.('Back to the last lantern', 'info'); break;
        case 'tiebreak': this.play('comp.go'); this.onCaption?.('Tie! Crumb scramble decides it', 'alert'); break;
        default: break;
      }
    }
  }

  voice(cls: string, x?: number, gain = 1) { this.play('vo.' + cls, { x, gain }); }

  /** Debug/audition helpers. */
  cueNames() { return Object.keys(CUES); }
  cueInfo(n: string): Cue | undefined { return CUES[n]; }
}
