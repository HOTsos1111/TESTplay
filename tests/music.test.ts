import { describe, expect, it } from 'vitest';
import { MUSIC } from '../src/data/music';

describe('music data', () => {
  it('parses every track into equal-length parts', () => {
    for (const [key, t] of Object.entries(MUSIC)) {
      expect(t.length, key).toBeGreaterThan(0);
      for (const p of t.parts) expect(p.notes.length, `${key}.${p.instrument}`).toBe(t.length);
    }
  });
});
