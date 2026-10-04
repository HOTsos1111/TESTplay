import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { chunkById } from '../src/data/chunks';
import { reachAt, validateSequence } from '../src/systems/ChunkValidator';
import { buildLevel } from '../src/systems/LevelBuilder';

describe('chapter content', () => {
  it('reports reach figures', () => {
    const r = reachAt(320);
    console.log('reach @320', r, 'reach @370', reachAt(370));
    expect(r.hoverGap).toBeGreaterThan(r.jumpGap);
  });

  for (const ch of CHAPTERS.filter((c) => c.implemented)) {
    it(`chapter ${ch.id} chunks are fair at base stats`, () => {
      const issues = validateSequence(ch.chunks.map(chunkById), ch.speedStart, ch.speedEnd);
      expect(issues).toEqual([]);
    });

    it(`chapter ${ch.id} builds a level with an encounter`, () => {
      const level = buildLevel(ch);
      expect(level.encounterX).toBeGreaterThan(0);
      expect(level.items.some((i) => i.type === 'gate')).toBe(true);
      const ids = level.items.filter((i) => i.type === 'bone').map((b) => (b as { id: string }).id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }
});
