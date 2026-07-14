import { describe, expect, it } from 'vitest';
import { countMaterials } from './materials';

describe('countMaterials', () => {
  it('counts occurrences of each material, preserving first-seen order', () => {
    const counts = countMaterials(['ice', 'slag', 'ice', 'slag', 'ice']);

    expect([...counts.entries()]).toEqual([
      ['ice', 3],
      ['slag', 2],
    ]);
  });

  it('returns an empty map for an empty sequence', () => {
    expect(countMaterials([]).size).toBe(0);
  });
});
