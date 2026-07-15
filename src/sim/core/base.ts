import { findEntityAt, inBounds } from './grid';
import type { ConveyorEntity } from './entities';
import type { SimState } from './state';
import { translate } from './types';
import type { Direction, GridPos, GridRect } from './types';

export type BaseEdge = 'north' | 'south' | 'east' | 'west';

export function isInsideBase(rect: GridRect, pos: GridPos): boolean {
  return pos.x >= rect.min.x && pos.x <= rect.max.x && pos.y >= rect.min.y && pos.y <= rect.max.y;
}

/** The ring of cells exactly one cell outside the base rect — pipes only, no machines or sources. */
export function isInBaseBuffer(rect: GridRect, pos: GridPos): boolean {
  if (isInsideBase(rect, pos)) return false;
  return (
    pos.x >= rect.min.x - 1 &&
    pos.x <= rect.max.x + 1 &&
    pos.y >= rect.min.y - 1 &&
    pos.y <= rect.max.y + 1
  );
}

export function isBaseEntryPoint(state: SimState, pos: GridPos, direction: Direction): boolean {
  return isInsideBase(state.base, translate(pos, direction));
}

export function findBaseEntryConveyor(state: SimState): ConveyorEntity | undefined {
  return Object.values(state.conveyors).find((c) =>
    isBaseEntryPoint(state, c.position, c.direction),
  );
}

const EDGE_AXIS: Record<BaseEdge, 'x' | 'y'> = {
  north: 'y',
  south: 'y',
  east: 'x',
  west: 'x',
};

const EDGE_IS_MAX: Record<BaseEdge, boolean> = {
  north: false,
  west: false,
  south: true,
  east: true,
};

function otherAxisRange(rect: GridRect, edge: BaseEdge): [number, number] {
  return EDGE_AXIS[edge] === 'x' ? [rect.min.y, rect.max.y] : [rect.min.x, rect.max.x];
}

function stripCells(rect: GridRect, edge: BaseEdge, coord: number): GridPos[] {
  const axis = EDGE_AXIS[edge];
  const [lo, hi] = otherAxisRange(rect, edge);
  const cells: GridPos[] = [];
  for (let i = lo; i <= hi; i++) {
    cells.push(axis === 'x' ? { x: coord, y: i } : { x: i, y: coord });
  }
  return cells;
}

function isMineAt(state: SimState, pos: GridPos): boolean {
  return state.mines.some((mine) => mine.position.x === pos.x && mine.position.y === pos.y);
}

function stripIsClear(state: SimState, rect: GridRect, edge: BaseEdge, coord: number): boolean {
  return stripCells(rect, edge, coord).every(
    (pos) => inBounds(state, pos) && !findEntityAt(state, pos) && !isMineAt(state, pos),
  );
}

function stripContainsSink(
  state: SimState,
  rect: GridRect,
  edge: BaseEdge,
  coord: number,
): boolean {
  const cells = stripCells(rect, edge, coord);
  return Object.values(state.sinks).some((sink) =>
    cells.some((pos) => pos.x === sink.position.x && pos.y === sink.position.y),
  );
}

/**
 * Moves one edge of the base by exactly one cell. Expansion is blocked by the grid boundary, an
 * occupied cell, or a marked mine along the new strip; shrinking is blocked if the strip being
 * removed contains the sink, or if it would invert the rect. Single-step so a drag gesture can
 * call it once per grid-line crossed and get a natural, obstacle-respecting creep.
 */
export function stepBaseEdge(state: SimState, edge: BaseEdge, direction: 1 | -1): boolean {
  const rect = state.base;
  const axis = EDGE_AXIS[edge];
  const isMax = EDGE_IS_MAX[edge];
  const current = isMax ? rect.max[axis] : rect.min[axis];
  const next = current + direction;
  const expanding = isMax ? direction > 0 : direction < 0;

  if (expanding) {
    const candidate: GridRect = isMax
      ? { min: rect.min, max: { ...rect.max, [axis]: next } }
      : { min: { ...rect.min, [axis]: next }, max: rect.max };
    if (!inBounds(state, candidate.min) || !inBounds(state, candidate.max)) return false;
    if (!stripIsClear(state, rect, edge, next)) return false;
  } else {
    const opposite = isMax ? rect.min[axis] : rect.max[axis];
    if (isMax ? next < opposite : next > opposite) return false;
    if (stripContainsSink(state, rect, edge, current)) return false;
  }

  if (isMax) rect.max[axis] = next;
  else rect.min[axis] = next;
  return true;
}
