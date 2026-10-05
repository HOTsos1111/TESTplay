// Versioned save data with atomic-ish writes, backup recovery and schema migrations.
import type { ChickClass } from '../data/classes';
import type { KeyMap, PadMap } from './InputRouter';

export const SAVE_VERSION = 2;
const KEY = 'chickkin.save';
const BACKUP = 'chickkin.save.bak';
const TEMP = 'chickkin.save.tmp';

export type DifficultyPref = 'relaxed' | 'standard' | 'expert';
export interface Settings {
  master: number; music: number; sfx: number; voice: number; ambience: number; muted: boolean;
  dynamics: 'standard' | 'night' | 'headphones';
  reducedMotion: boolean; shake: number; reduceFlash: boolean; captions: boolean;
  quality: 'high' | 'medium' | 'low';
  difficulty: DifficultyPref;
  interactToggle: boolean;
  pauseOnBlur: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, music: 0.7, sfx: 0.85, voice: 0.8, ambience: 0.6, muted: false, dynamics: 'standard',
  reducedMotion: false, shake: 1, reduceFlash: false, captions: true, quality: 'high', difficulty: 'standard',
  interactToggle: false, pauseOnBlur: true,
};

export interface LevelRecord { done: boolean; bestTime: number | null; placement: number; medals: string[]; feathers: number; variantSeed: number }
export interface GenerationRecord {
  generation: number; cls: ChickClass; name: string; perk: string | null; seed: number;
  siblings: { name: string; cls: ChickClass; personality: string }[];
  medals: number; feathers: number; finishedAt: string;
}
export interface SaveData {
  version: number;
  family: { name: string; seed: number; generation: number; lineage: GenerationRecord[]; completedGenerations: number };
  current: null | {
    cls: ChickClass; name: string; perk: string | null; generation: number; seed: number;
    chapter: number;                       // current growth stage / chapter 1..5
    unlocked: string[];                    // level ids
    levels: Record<string, LevelRecord>;
    phase: 'playing' | 'adult';            // 'adult' after 5-5, before choosing the new brood
  };
  settings: Settings;
  bindings: { keys: KeyMap | null; pad: PadMap | null };
  records: Record<string, number>;         // `${level}:g${gen}:s${seed}` → best seconds
  cosmetics: string[];
  achievements: string[];
  savedAt: string;
}

export function newSave(seed = Math.floor(Math.random() * 1e9)): SaveData {
  return {
    version: SAVE_VERSION,
    family: { name: 'The Kin Family', seed, generation: 1, lineage: [], completedGenerations: 0 },
    current: null,
    settings: { ...DEFAULT_SETTINGS },
    bindings: { keys: null, pad: null },
    records: {}, cosmetics: [], achievements: [],
    savedAt: new Date(0).toISOString(),
  };
}

/** Minimal storage interface so tests can supply an in-memory store. */
export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

type Migration = (d: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: settings gained captions/pauseOnBlur; records keyed by seed.
  1: (d) => {
    const s = (d.settings ?? {}) as Record<string, unknown>;
    d.settings = { ...DEFAULT_SETTINGS, ...s };
    d.records = d.records ?? {};
    d.version = 2;
    return d;
  },
};

export function migrate(raw: Record<string, unknown>): SaveData {
  let d = raw;
  let v = Number(d.version ?? 1);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`no migration from v${v}`);
    d = m(d);
    v = Number(d.version);
  }
  return d as unknown as SaveData;
}

export function validate(d: SaveData): boolean {
  if (!d || typeof d !== 'object') return false;
  if (typeof d.version !== 'number' || !d.family || typeof d.family.generation !== 'number') return false;
  if (!d.settings || typeof d.settings.master !== 'number') return false;
  if (d.current) {
    if (!['speedy', 'mighty', 'nimble'].includes(d.current.cls)) return false;
    if (!Array.isArray(d.current.unlocked) || typeof d.current.levels !== 'object') return false;
    if (d.current.chapter < 1 || d.current.chapter > 5) return false;
  }
  return true;
}

export class SaveManager {
  data: SaveData;
  lastStatus: 'ok' | 'recovered' | 'fresh' | 'reset' = 'fresh';
  onSaved: (() => void) | null = null;

  constructor(private store: Store | null = safeLocalStorage()) {
    this.data = this.load();
  }

  private parse(text: string | null): SaveData | null {
    if (!text) return null;
    try {
      const d = migrate(JSON.parse(text));
      d.settings = { ...DEFAULT_SETTINGS, ...d.settings };
      return validate(d) ? d : null;
    } catch {
      return null;
    }
  }

  load(): SaveData {
    if (!this.store) return newSave();
    const main = this.parse(this.store.getItem(KEY));
    if (main) { this.lastStatus = 'ok'; return main; }
    const bak = this.parse(this.store.getItem(BACKUP));
    if (bak) { this.lastStatus = 'recovered'; return bak; }
    const hadSomething = this.store.getItem(KEY) !== null;
    this.lastStatus = hadSomething ? 'recovered' : 'fresh';
    return newSave();
  }

  /** Write temp → verify → rotate current to backup → write main. A malformed state is never saved. */
  save() {
    if (!this.store) return false;
    if (!validate(this.data)) return false;
    this.data.savedAt = new Date().toISOString();
    const text = JSON.stringify(this.data);
    try {
      this.store.setItem(TEMP, text);
      if (!this.parse(this.store.getItem(TEMP))) return false;
      const prev = this.store.getItem(KEY);
      if (prev && this.parse(prev)) this.store.setItem(BACKUP, prev);
      this.store.setItem(KEY, text);
      this.store.removeItem(TEMP);
      this.onSaved?.();
      return true;
    } catch {
      return false;
    }
  }

  reset() {
    const settings = this.data.settings;
    const bindings = this.data.bindings;
    this.data = newSave();
    this.data.settings = settings;
    this.data.bindings = bindings;
    this.store?.removeItem(BACKUP);
    this.save();
    this.lastStatus = 'reset';
  }
}

function safeLocalStorage(): Store | null {
  try {
    const s = window.localStorage;
    s.setItem('chickkin.probe', '1');
    s.removeItem('chickkin.probe');
    return s;
  } catch {
    return null;
  }
}
