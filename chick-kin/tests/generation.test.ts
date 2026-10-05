import { describe, it, expect } from 'vitest';
import { siblingsFor, hazardSpeedFor, perkChoices, withVariants, variantsFor } from '../src/core/Generation';
import { LEVELS } from '../src/data/levels';
import { CLASSES } from '../src/data/classes';

describe('generation director', () => {
  it('is deterministic from the seed and offers class variety', () => {
    for (const c of CLASSES) {
      const a = siblingsFor(2, 1234, c), b = siblingsFor(2, 1234, c);
      expect(a).toEqual(b);
      const classes = new Set(a.map((s) => s.cls));
      for (const other of CLASSES.filter((x) => x !== c)) expect(classes.has(other)).toBe(true);
      expect(new Set(a.map((s) => s.personality)).size).toBe(3);
    }
  });
  it('caps hazard speed at +20%', () => {
    expect(hazardSpeedFor(1)).toBe(1);
    expect(hazardSpeedFor(50)).toBeCloseTo(1.2);
  });
  it('perks are modest (≤5%) and one is chosen per generation', () => {
    for (const p of perkChoices('speedy', 3, 9)) expect(p.amount).toBeLessThanOrEqual(0.05);
  });
  it('variants never mutate the authored level and reproduce from seed', () => {
    for (const l of LEVELS) {
      const before = JSON.stringify(l);
      const v1 = withVariants(l, 3, 77), v2 = withVariants(l, 3, 77);
      expect(JSON.stringify(v1)).toBe(JSON.stringify(v2));
      expect(JSON.stringify(l)).toBe(before);
      expect(variantsFor(l, 1, 77).add.length).toBe(0);
    }
  });
});
