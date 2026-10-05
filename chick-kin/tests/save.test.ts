import { describe, it, expect } from 'vitest';
import { SaveManager, newSave, SAVE_VERSION, type Store } from '../src/core/SaveManager';

class Mem implements Store {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('SaveManager', () => {
  it('round-trips progress', () => {
    const st = new Mem();
    const a = new SaveManager(st);
    a.data.current = { cls: 'mighty', name: 'Peep', perk: null, generation: 1, seed: 5, chapter: 2, unlocked: ['1-1', '2-1'], levels: {}, phase: 'playing' };
    expect(a.save()).toBe(true);
    const b = new SaveManager(st);
    expect(b.lastStatus).toBe('ok');
    expect(b.data.current?.cls).toBe('mighty');
    expect(b.data.current?.chapter).toBe(2);
  });

  it('recovers from a corrupted main save using the backup', () => {
    const st = new Mem();
    const a = new SaveManager(st);
    a.data.family.generation = 3;
    a.save();
    a.data.family.generation = 4;
    a.save(); // backup now holds generation 3
    st.setItem('chickkin.save', '{ this is not json');
    const b = new SaveManager(st);
    expect(b.lastStatus).toBe('recovered');
    expect(b.data.family.generation).toBe(3);
  });

  it('never overwrites a good save with malformed data', () => {
    const st = new Mem();
    const a = new SaveManager(st);
    a.data.family.generation = 2;
    a.save();
    (a.data as unknown as { settings: unknown }).settings = null;
    expect(a.save()).toBe(false);
    expect(new SaveManager(st).data.family.generation).toBe(2);
  });

  it('migrates a v1 save', () => {
    const st = new Mem();
    const v1 = { ...newSave(9), version: 1 } as Record<string, unknown>;
    delete (v1.settings as Record<string, unknown>).captions;
    st.setItem('chickkin.save', JSON.stringify(v1));
    const b = new SaveManager(st);
    expect(b.data.version).toBe(SAVE_VERSION);
    expect(b.data.settings.captions).toBe(true);
  });

  it('reset keeps settings but clears progress', () => {
    const st = new Mem();
    const a = new SaveManager(st);
    a.data.settings.music = 0.1;
    a.data.family.generation = 5;
    a.reset();
    expect(a.data.family.generation).toBe(1);
    expect(a.data.settings.music).toBe(0.1);
  });
});
