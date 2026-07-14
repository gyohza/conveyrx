import { describe, expect, it } from 'vitest';
import { parseStageMap } from './map-format';

describe('parseStageMap', () => {
  it('parses grid dimensions from the row/column count', () => {
    const map = `
      .  .  .
      .  .  S
    `;

    expect(parseStageMap(map).grid).toEqual({ width: 3, height: 2 });
  });

  it('finds the sink position', () => {
    const map = `
      .  .  .
      .  S  .
    `;

    expect(parseStageMap(map).sinkPos).toEqual({ x: 1, y: 1 });
  });

  it('finds mine specs, one packet per letter of their token', () => {
    const map = `
      MCCCCC .    .
      .      MCCX S
    `;

    expect(parseStageMap(map).mines).toEqual([
      { position: { x: 0, y: 0 }, sequence: ['carbon', 'carbon', 'carbon', 'carbon', 'carbon'] },
      { position: { x: 1, y: 1 }, sequence: ['carbon', 'carbon', 'slag'] },
    ]);
  });

  it('resolves every material letter registered in MATERIALS, including ice', () => {
    const map = `
      MI .
      .  S
    `;

    expect(parseStageMap(map).mines).toEqual([{ position: { x: 0, y: 0 }, sequence: ['ice'] }]);
  });

  it('throws on an unknown material letter inside a mine token', () => {
    expect(() => parseStageMap('MQ .\n.  S')).toThrow(/"Q"/);
  });

  it('ignores blank lines and leading/trailing whitespace', () => {
    const map = `

      .  S

    `;

    expect(parseStageMap(map).grid).toEqual({ width: 2, height: 1 });
  });

  it('throws when there is no sink', () => {
    expect(() => parseStageMap('. .\n. .')).toThrow(/sink/i);
  });

  it('throws when there is more than one sink', () => {
    expect(() => parseStageMap('S .\n. S')).toThrow(/one sink/i);
  });

  it('throws on an unrecognized token', () => {
    expect(() => parseStageMap('. X\n. S')).toThrow(/"X"/);
  });

  it('throws when rows have inconsistent column counts', () => {
    expect(() => parseStageMap('. . .\n. S')).toThrow(/same number of columns/i);
  });
});
