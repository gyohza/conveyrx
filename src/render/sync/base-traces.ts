import { DIRECTIONS } from '@sim/core/types';
import type { Direction, GridPos, GridRect } from '@sim/core/types';

/** Cell-local resolution the trace routing snaps to; 4 sub-units per grid cell. */
export const TRACE_SUBDIVISIONS = 4;

/** Parallel pins drawn along each cell's outward-facing boundary edge, comb-style. */
export const PINS_PER_SIDE = 3;

export interface SubPoint {
  x: number;
  y: number;
}

export interface BaseTrace {
  cell: GridPos;
  dir: Direction;
  /** Absolute sub-grid points (already cell-offset — multiply by CELL_SIZE / TRACE_SUBDIVISIONS to get pixels). */
  points: SubPoint[];
  /** True for a boundary pin whose tip lands one cell past the hull, in the buffer ring. */
  pokesOut: boolean;
}

function hashCell(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(x: number, y: number, dir: Direction): number {
  return hashCell(x * 4 + DIRECTIONS.indexOf(dir), y);
}

function toGlobal(x: number, y: number, p: SubPoint): SubPoint {
  return { x: x * TRACE_SUBDIVISIONS + p.x, y: y * TRACE_SUBDIVISIONS + p.y };
}

const OUTWARD: Record<Direction, SubPoint> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
};

const PIN_FRACTIONS = Array.from(
  { length: PINS_PER_SIDE },
  (_, i) => (i + 1) / (PINS_PER_SIDE + 1),
);
const PIN_LENGTH = TRACE_SUBDIVISIONS * 0.55;

/**
 * A fixed, evenly spaced comb of short pins on one cell's outward-facing side — no randomness,
 * so every boundary cell reads the same way on every side it faces the buffer ring. This is what
 * gives the hull its "IC chip" silhouette instead of the sparse, occasional pokes of a jumble.
 */
export function boundaryPinsForCell(x: number, y: number, dir: Direction): BaseTrace[] {
  const edgeCoord = dir === 'north' || dir === 'west' ? 0 : TRACE_SUBDIVISIONS;
  const outward = OUTWARD[dir];
  return PIN_FRACTIONS.map((frac) => {
    const along = frac * TRACE_SUBDIVISIONS;
    const start: SubPoint =
      dir === 'north' || dir === 'south' ? { x: along, y: edgeCoord } : { x: edgeCoord, y: along };
    const end: SubPoint = {
      x: start.x + outward.x * PIN_LENGTH,
      y: start.y + outward.y * PIN_LENGTH,
    };
    return {
      cell: { x, y },
      dir,
      points: [toGlobal(x, y, start), toGlobal(x, y, end)],
      pokesOut: true,
    };
  });
}

const EDGE_MID: Record<Direction, SubPoint> = {
  north: { x: TRACE_SUBDIVISIONS / 2, y: 0 },
  south: { x: TRACE_SUBDIVISIONS / 2, y: TRACE_SUBDIVISIONS },
  west: { x: 0, y: TRACE_SUBDIVISIONS / 2 },
  east: { x: TRACE_SUBDIVISIONS, y: TRACE_SUBDIVISIONS / 2 },
};

const STUB_CHANCE = 0.4;

/**
 * A short, seeded L-shaped stub wandering from a random interior point toward one side of the
 * cell — the "die" jumble that fills the hull's interior. Only called for a cell's non-boundary
 * sides; boundary sides get {@link boundaryPinsForCell} instead.
 */
export function interiorTraceForCell(x: number, y: number, dir: Direction): BaseTrace | null {
  const rng = mulberry32(seedFor(x, y, dir));
  if (rng() > STUB_CHANCE) return null;

  const anchor: SubPoint = {
    x: 1 + Math.floor(rng() * (TRACE_SUBDIVISIONS - 1)),
    y: 1 + Math.floor(rng() * (TRACE_SUBDIVISIONS - 1)),
  };
  const edgeMid = EDGE_MID[dir];
  const bend: SubPoint =
    dir === 'north' || dir === 'south'
      ? { x: anchor.x, y: edgeMid.y }
      : { x: edgeMid.x, y: anchor.y };

  return {
    cell: { x, y },
    dir,
    points: [toGlobal(x, y, anchor), toGlobal(x, y, bend), toGlobal(x, y, edgeMid)],
    pokesOut: false,
  };
}

function onRectEdge(rect: GridRect, x: number, y: number, dir: Direction): boolean {
  if (dir === 'north') return y === rect.min.y;
  if (dir === 'south') return y === rect.max.y;
  if (dir === 'west') return x === rect.min.x;
  return x === rect.max.x;
}

/**
 * Deterministic bus-trace layout for the Subscriber hull: every boundary-facing side of every
 * boundary cell gets a full comb of pins (so the perimeter is never sparse), and every other side
 * gets a chance at a seeded interior stub for die-like texture. Purely a function of the rect, so
 * resizing the base only changes traces for cells whose boundary status actually changed.
 */
export function generateBaseTraces(rect: GridRect): BaseTrace[] {
  const traces: BaseTrace[] = [];
  for (let y = rect.min.y; y <= rect.max.y; y++) {
    for (let x = rect.min.x; x <= rect.max.x; x++) {
      for (const dir of DIRECTIONS) {
        if (onRectEdge(rect, x, y, dir)) {
          traces.push(...boundaryPinsForCell(x, y, dir));
        } else {
          const trace = interiorTraceForCell(x, y, dir);
          if (trace) traces.push(trace);
        }
      }
    }
  }
  return traces;
}
