import { UPGRADE_MAX_LEVEL } from '../data/config';

export type UpgradeKey = 'tail' | 'recharge' | 'bark';

export interface Checkpoint {
  chapter: number;
  at: 'encounter';
}

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  showHitboxes: boolean;
}

export interface Progress {
  /** 2 = the nine-level campaign. Version 1 saves keep bones, upgrades and settings only. */
  version: 2;
  unlockedChapter: number;
  completedChapters: number[];
  checkpoint: Checkpoint | null;
  boneBalance: number;
  upgrades: Record<UpgradeKey, number>;
  endlessBestByChapter: Record<string, number>;
  /** Furthest campaign distance (metres) per chapter, for the results screen. */
  bestRunByChapter: Record<string, number>;
  /** One-time reward ids already granted (cannot be farmed by restarting). */
  claimedRewards: string[];
  hintsSeen: string[];
  storySeen: boolean;
  settings: Settings;
}

export const STORAGE_KEY = 'homeward-hound.progress';
export const CHAPTER_COUNT = 9;

export function defaultProgress(): Progress {
  return {
    version: 2,
    unlockedChapter: 1,
    completedChapters: [],
    checkpoint: null,
    boneBalance: 0,
    upgrades: { tail: 0, recharge: 0, bark: 0 },
    endlessBestByChapter: {},
    bestRunByChapter: {},
    claimedRewards: [],
    hintsSeen: [],
    storySeen: false,
    settings: { musicVolume: 0.6, sfxVolume: 0.8, showHitboxes: false },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const int = (v: unknown, lo: number, hi: number, d: number): number => Math.round(num(v, lo, hi, d));

function numberRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) out[k] = val;
  }
  return out;
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string'))] : [];
}

/** Validate untrusted saved data, falling back to safe defaults field by field. */
export function sanitizeProgress(input: unknown): Progress {
  const d = defaultProgress();
  if (!isObj(input)) return d;
  let raw: Record<string, unknown> = input;
  // The old six-chapter route is gone: its completions do not map onto the new
  // nine districts, so a version 1 save starts the campaign over at Level 1
  // while keeping its bones, upgrades, settings and story/hint flags.
  const legacy = raw.version !== 2;
  if (legacy) raw = { ...raw, completedChapters: [], unlockedChapter: 1, checkpoint: null, bestRunByChapter: {}, endlessBestByChapter: {} };
  const completed = Array.isArray(raw.completedChapters)
    ? [...new Set(raw.completedChapters.filter((c): c is number => Number.isInteger(c) && c >= 1 && c <= CHAPTER_COUNT))].sort()
    : [];
  const up = isObj(raw.upgrades) ? raw.upgrades : {};
  const s = isObj(raw.settings) ? raw.settings : {};
  let checkpoint: Checkpoint | null = null;
  if (isObj(raw.checkpoint) && raw.checkpoint.at === 'encounter') {
    const ch = int(raw.checkpoint.chapter, 1, CHAPTER_COUNT, 0);
    if (ch >= 1) checkpoint = { chapter: ch, at: 'encounter' };
  }
  const unlocked = Math.max(int(raw.unlockedChapter, 1, CHAPTER_COUNT, 1), ...completed.map((c) => Math.min(CHAPTER_COUNT, c + 1)), 1);
  return {
    version: 2,
    unlockedChapter: unlocked,
    completedChapters: completed,
    checkpoint,
    boneBalance: int(raw.boneBalance, 0, 1_000_000, 0),
    upgrades: {
      tail: int(up.tail, 0, UPGRADE_MAX_LEVEL, 0),
      recharge: int(up.recharge, 0, UPGRADE_MAX_LEVEL, 0),
      bark: int(up.bark, 0, UPGRADE_MAX_LEVEL, 0),
    },
    endlessBestByChapter: numberRecord(raw.endlessBestByChapter),
    bestRunByChapter: numberRecord(raw.bestRunByChapter),
    claimedRewards: stringList(raw.claimedRewards),
    hintsSeen: stringList(raw.hintsSeen),
    storySeen: raw.storySeen === true,
    settings: {
      musicVolume: num(s.musicVolume, 0, 1, d.settings.musicVolume),
      sfxVolume: num(s.sfxVolume, 0, 1, d.settings.sfxVolume),
      showHitboxes: s.showHitboxes === true,
    },
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__hh_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/**
 * Persistent progress. Writes through to localStorage immediately; if storage
 * is unavailable the game keeps working with in-memory progress.
 */
export class ProgressStore {
  private data: Progress;
  private storage: StorageLike | null;
  private listeners = new Set<(p: Readonly<Progress>) => void>();

  constructor(storage: StorageLike | null = browserStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  get available(): boolean {
    return this.storage !== null;
  }

  get state(): Readonly<Progress> {
    return this.data;
  }

  private load(): Progress {
    if (!this.storage) return defaultProgress();
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      return raw ? sanitizeProgress(JSON.parse(raw)) : defaultProgress();
    } catch {
      return defaultProgress();
    }
  }

  private save(): void {
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch {
        // Quota or privacy mode: keep playing with in-memory progress.
      }
    }
    for (const l of this.listeners) l(this.data);
  }

  onChange(fn: (p: Readonly<Progress>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(mutator: (p: Progress) => void): void {
    mutator(this.data);
    this.data = sanitizeProgress(this.data);
    this.save();
  }

  addBones(n: number): void {
    if (n > 0) this.update((p) => (p.boneBalance += n));
  }

  /** Grants a one-time reward. Returns false if it was already claimed. */
  claimReward(id: string, bones: number): boolean {
    if (this.data.claimedRewards.includes(id)) return false;
    this.update((p) => {
      p.claimedRewards.push(id);
      p.boneBalance += bones;
    });
    return true;
  }

  buyUpgrade(key: UpgradeKey, price: number): boolean {
    const lvl = this.data.upgrades[key];
    if (lvl >= UPGRADE_MAX_LEVEL || this.data.boneBalance < price) return false;
    this.update((p) => {
      p.boneBalance -= price;
      p.upgrades[key] = lvl + 1;
    });
    return true;
  }

  setCheckpoint(cp: Checkpoint | null): void {
    this.update((p) => (p.checkpoint = cp));
  }

  completeChapter(chapter: number): void {
    this.update((p) => {
      if (!p.completedChapters.includes(chapter)) p.completedChapters.push(chapter);
      p.unlockedChapter = Math.max(p.unlockedChapter, Math.min(CHAPTER_COUNT, chapter + 1));
      if (p.checkpoint?.chapter === chapter) p.checkpoint = null;
    });
  }

  recordRun(chapter: number, metres: number): boolean {
    const prev = this.data.bestRunByChapter[chapter] ?? 0;
    if (metres <= prev) return false;
    this.update((p) => (p.bestRunByChapter[chapter] = metres));
    return true;
  }

  markHint(id: string): void {
    if (!this.data.hintsSeen.includes(id)) this.update((p) => p.hintsSeen.push(id));
  }

  setSettings(patch: Partial<Settings>): void {
    this.update((p) => Object.assign(p.settings, patch));
  }

  /** Explicit reset from the settings screen; keeps audio settings. */
  reset(): void {
    const settings = { ...this.data.settings };
    this.data = defaultProgress();
    this.data.settings = settings;
    this.save();
  }
}

export const progress = new ProgressStore();
