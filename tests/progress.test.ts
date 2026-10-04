import { describe, expect, it } from 'vitest';
import { ProgressStore, sanitizeProgress, STORAGE_KEY, type StorageLike } from '../src/systems/ProgressStore';

function memory(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('ProgressStore', () => {
  it('falls back to defaults for corrupt or hostile data', () => {
    expect(new ProgressStore(memory('{not json')).state.unlockedChapter).toBe(1);
    const p = sanitizeProgress({ boneBalance: -5, upgrades: { tail: 99, bark: 'x' }, unlockedChapter: 42, completedChapters: [1, 1, 9, 'a'], settings: { musicVolume: 7 } });
    expect(p.boneBalance).toBe(0);
    expect(p.upgrades).toEqual({ tail: 3, recharge: 0, bark: 0 });
    expect(p.unlockedChapter).toBe(6);
    expect(p.completedChapters).toEqual([1]);
    expect(p.settings.musicVolume).toBe(1);
  });

  it('works without storage', () => {
    const s = new ProgressStore(null);
    s.addBones(5);
    expect(s.state.boneBalance).toBe(5);
    expect(s.available).toBe(false);
  });

  it('persists immediately and survives reload', () => {
    const mem = memory();
    const a = new ProgressStore(mem);
    a.addBones(3);
    a.completeChapter(1);
    const b = new ProgressStore(mem);
    expect(b.state.boneBalance).toBe(3);
    expect(b.state.completedChapters).toEqual([1]);
    expect(b.state.unlockedChapter).toBe(2);
  });

  it('one-time rewards cannot be farmed', () => {
    const s = new ProgressStore(memory());
    expect(s.claimReward('chapter1_clear', 50)).toBe(true);
    expect(s.claimReward('chapter1_clear', 50)).toBe(false);
    expect(s.state.boneBalance).toBe(50);
  });

  it('upgrades cost bones and cap at level 3', () => {
    const s = new ProgressStore(memory());
    s.addBones(1000);
    expect(s.buyUpgrade('tail', 50)).toBe(true);
    expect(s.buyUpgrade('tail', 100)).toBe(true);
    expect(s.buyUpgrade('tail', 175)).toBe(true);
    expect(s.buyUpgrade('tail', 1)).toBe(false);
    expect(s.state.boneBalance).toBe(1000 - 325);
  });

  it('completing a chapter clears its checkpoint; reset keeps settings only', () => {
    const s = new ProgressStore(memory());
    s.setCheckpoint({ chapter: 1, at: 'encounter' });
    s.setSettings({ musicVolume: 0.2 });
    s.completeChapter(1);
    expect(s.state.checkpoint).toBeNull();
    s.reset();
    expect(s.state.completedChapters).toEqual([]);
    expect(s.state.settings.musicVolume).toBe(0.2);
  });
});
