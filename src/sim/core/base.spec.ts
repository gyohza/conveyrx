import { describe, expect, it } from 'vitest';
import { isInBaseBuffer, isInsideBase, stepBaseEdge } from './base';
import { createPort } from './port';
import { addConveyor, emptyState } from '../testing/state-builder';

function withBase(
  width: number,
  height: number,
  base: { min: [number, number]; max: [number, number] },
) {
  const state = emptyState(width, height);
  state.base = {
    min: { x: base.min[0], y: base.min[1] },
    max: { x: base.max[0], y: base.max[1] },
  };
  return state;
}

describe('stepBaseEdge', () => {
  it('expands the east edge outward by one cell into empty space', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 4] });

    const moved = stepBaseEdge(state, 'east', 1);

    expect(moved).toBe(true);
    expect(state.base).toEqual({ min: { x: 2, y: 2 }, max: { x: 5, y: 4 } });
  });

  it('expands the west edge outward by moving min, not max', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 4] });

    const moved = stepBaseEdge(state, 'west', -1);

    expect(moved).toBe(true);
    expect(state.base).toEqual({ min: { x: 1, y: 2 }, max: { x: 4, y: 4 } });
  });

  it('expands the north edge outward by moving min.y', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 4] });

    const moved = stepBaseEdge(state, 'north', -1);

    expect(moved).toBe(true);
    expect(state.base).toEqual({ min: { x: 2, y: 1 }, max: { x: 4, y: 4 } });
  });

  it('expands the south edge outward by moving max.y', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 4] });

    const moved = stepBaseEdge(state, 'south', 1);

    expect(moved).toBe(true);
    expect(state.base).toEqual({ min: { x: 2, y: 2 }, max: { x: 4, y: 5 } });
  });

  it('refuses to expand past the grid boundary', () => {
    const state = withBase(6, 6, { min: [2, 2], max: [5, 4] }); // max.x already at width-1

    const moved = stepBaseEdge(state, 'east', 1);

    expect(moved).toBe(false);
    expect(state.base.max.x).toBe(5);
  });

  it('refuses to expand into a cell occupied by a placed entity', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 4] });
    addConveyor(state, { x: 5, y: 3 }, 'east'); // sits in the strip east expansion would claim

    const moved = stepBaseEdge(state, 'east', 1);

    expect(moved).toBe(false);
    expect(state.base.max.x).toBe(4);
  });

  it('refuses to expand into a cell marked as a mine', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 4] });
    state.mines.push({ position: { x: 5, y: 3 }, sequence: ['carbon'] });

    const moved = stepBaseEdge(state, 'east', 1);

    expect(moved).toBe(false);
  });

  it('checks every cell along a multi-cell strip, not just one', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 5] }); // 4 rows tall (y: 2..5)
    addConveyor(state, { x: 5, y: 5 }, 'east'); // occupies the bottom-most cell of the new strip

    const moved = stepBaseEdge(state, 'east', 1);

    expect(moved).toBe(false);
  });

  it('shrinks the east edge inward by one cell when the sink is not in the removed strip', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 4] });
    state.sinks[1] = {
      id: 1,
      position: { x: 2, y: 2 },
      sinkType: 'cash',
      input: createPort(4),
    };

    const moved = stepBaseEdge(state, 'east', -1);

    expect(moved).toBe(true);
    expect(state.base.max.x).toBe(3);
  });

  it('refuses to shrink an edge whose removed strip contains the sink', () => {
    const state = withBase(8, 8, { min: [2, 2], max: [4, 4] });
    state.sinks[1] = {
      id: 1,
      position: { x: 4, y: 3 }, // sits on the east edge, in the strip that would be removed
      sinkType: 'cash',
      input: createPort(4),
    };

    const moved = stepBaseEdge(state, 'east', -1);

    expect(moved).toBe(false);
    expect(state.base.max.x).toBe(4);
  });

  it('refuses to shrink past the opposite edge (would invert the rect)', () => {
    const state = withBase(8, 8, { min: [4, 4], max: [4, 4] }); // 1x1 box

    const moved = stepBaseEdge(state, 'east', -1);

    expect(moved).toBe(false);
  });
});

describe('isInsideBase', () => {
  const rect = { min: { x: 2, y: 2 }, max: { x: 4, y: 4 } };

  it('is true for every cell within the rect, inclusive of its edges', () => {
    expect(isInsideBase(rect, { x: 2, y: 2 })).toBe(true);
    expect(isInsideBase(rect, { x: 4, y: 4 })).toBe(true);
    expect(isInsideBase(rect, { x: 3, y: 3 })).toBe(true);
  });

  it('is false for any cell outside the rect', () => {
    expect(isInsideBase(rect, { x: 1, y: 3 })).toBe(false);
    expect(isInsideBase(rect, { x: 5, y: 3 })).toBe(false);
    expect(isInsideBase(rect, { x: 3, y: 1 })).toBe(false);
    expect(isInsideBase(rect, { x: 3, y: 5 })).toBe(false);
  });
});

describe('isInBaseBuffer', () => {
  const rect = { min: { x: 2, y: 2 }, max: { x: 4, y: 4 } };

  it('is true for the ring of cells exactly one cell outside the rect', () => {
    expect(isInBaseBuffer(rect, { x: 1, y: 3 })).toBe(true); // west edge
    expect(isInBaseBuffer(rect, { x: 5, y: 3 })).toBe(true); // east edge
    expect(isInBaseBuffer(rect, { x: 3, y: 1 })).toBe(true); // north edge
    expect(isInBaseBuffer(rect, { x: 3, y: 5 })).toBe(true); // south edge
    expect(isInBaseBuffer(rect, { x: 1, y: 1 })).toBe(true); // corner
  });

  it('is false for cells inside the rect', () => {
    expect(isInBaseBuffer(rect, { x: 2, y: 2 })).toBe(false);
    expect(isInBaseBuffer(rect, { x: 3, y: 3 })).toBe(false);
  });

  it('is false for cells two or more cells away from the rect', () => {
    expect(isInBaseBuffer(rect, { x: 0, y: 3 })).toBe(false);
    expect(isInBaseBuffer(rect, { x: 6, y: 3 })).toBe(false);
    expect(isInBaseBuffer(rect, { x: 3, y: 0 })).toBe(false);
    expect(isInBaseBuffer(rect, { x: 3, y: 6 })).toBe(false);
  });
});
