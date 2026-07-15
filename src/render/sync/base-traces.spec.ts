import { describe, expect, it } from 'vitest';
import { DIRECTIONS } from '../../sim/core/types';
import type { GridRect } from '../../sim/core/types';
import {
  boundaryPinsForCell,
  generateBaseTraces,
  interiorTraceForCell,
  PINS_PER_SIDE,
  TRACE_SUBDIVISIONS,
} from './base-traces';

const RECT: GridRect = { min: { x: 2, y: 2 }, max: { x: 4, y: 4 } };

function onRectEdge(
  rect: GridRect,
  x: number,
  y: number,
  dir: (typeof DIRECTIONS)[number],
): boolean {
  if (dir === 'north') return y === rect.min.y;
  if (dir === 'south') return y === rect.max.y;
  if (dir === 'west') return x === rect.min.x;
  return x === rect.max.x;
}

describe('boundaryPinsForCell', () => {
  it('is deterministic and always returns the same number of evenly spaced pins', () => {
    const a = boundaryPinsForCell(3, 3, 'north');
    const b = boundaryPinsForCell(3, 3, 'north');
    expect(a).toEqual(b);
    expect(a).toHaveLength(PINS_PER_SIDE);
    for (const pin of a) expect(pin.pokesOut).toBe(true);
  });

  it('spaces pins along the cell edge instead of stacking them on one point', () => {
    const pins = boundaryPinsForCell(3, 3, 'north');
    const startXs = new Set(pins.map((pin) => pin.points[0].x));
    expect(startXs.size).toBe(PINS_PER_SIDE);
  });

  it('keeps every pin within one cell of poke-through', () => {
    for (let x = 0; x < 10; x++) {
      for (const dir of DIRECTIONS) {
        for (const pin of boundaryPinsForCell(x, 5, dir)) {
          for (const p of pin.points) {
            expect(p.x).toBeGreaterThanOrEqual((x - 1) * TRACE_SUBDIVISIONS);
            expect(p.x).toBeLessThanOrEqual((x + 2) * TRACE_SUBDIVISIONS);
          }
        }
      }
    }
  });
});

describe('interiorTraceForCell', () => {
  it('is deterministic and never pokes outward', () => {
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        for (const dir of DIRECTIONS) {
          const a = interiorTraceForCell(x, y, dir);
          const b = interiorTraceForCell(x, y, dir);
          expect(a).toEqual(b);
          if (a) expect(a.pokesOut).toBe(false);
        }
      }
    }
  });
});

describe('generateBaseTraces', () => {
  it('is deterministic — repeated calls on the same rect produce identical output', () => {
    expect(generateBaseTraces(RECT)).toEqual(generateBaseTraces(RECT));
  });

  it('gives every boundary cell a full comb of pins on each side it faces outward — no gaps', () => {
    const traces = generateBaseTraces(RECT);
    for (let y = RECT.min.y; y <= RECT.max.y; y++) {
      for (let x = RECT.min.x; x <= RECT.max.x; x++) {
        for (const dir of DIRECTIONS) {
          const pinsHere = traces.filter(
            (t) => t.cell.x === x && t.cell.y === y && t.pokesOut && t.dir === dir,
          );
          if (onRectEdge(RECT, x, y, dir)) {
            expect(pinsHere).toHaveLength(PINS_PER_SIDE);
          } else {
            expect(pinsHere).toHaveLength(0);
          }
        }
      }
    }
  });

  it('covers a 1x1 footprint entirely in pins, on all four sides', () => {
    const rect: GridRect = { min: { x: 5, y: 5 }, max: { x: 5, y: 5 } };
    const traces = generateBaseTraces(rect);
    const pins = traces.filter((t) => t.pokesOut);
    expect(pins).toHaveLength(DIRECTIONS.length * PINS_PER_SIDE);
    for (const trace of traces) expect(trace.cell).toEqual({ x: 5, y: 5 });
  });

  it('keeps a cell untouched by a resize when neither of its boundary sides moved', () => {
    const before = generateBaseTraces(RECT);
    const grownEast: GridRect = { min: RECT.min, max: { x: RECT.max.x + 1, y: RECT.max.y } };
    const after = generateBaseTraces(grownEast);

    // (3,3) is fully interior in both rects — none of its sides ever touch a boundary.
    const tracesFor = (traces: typeof before, x: number, y: number) =>
      traces.filter((t) => t.cell.x === x && t.cell.y === y);
    expect(tracesFor(before, 3, 3)).toEqual(tracesFor(after, 3, 3));
  });

  it('scales up roughly with footprint size', () => {
    const small = generateBaseTraces({ min: { x: 0, y: 0 }, max: { x: 1, y: 1 } });
    const big = generateBaseTraces({ min: { x: 0, y: 0 }, max: { x: 5, y: 5 } });
    expect(big.length).toBeGreaterThan(small.length);
  });
});
