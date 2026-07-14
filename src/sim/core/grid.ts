import type { SimState } from './state';
import type { EntityId, GridPos } from './types';

export interface EntityRef {
  kind: 'source' | 'sink' | 'machine' | 'conveyor';
  id: EntityId;
}

export function inBounds(state: SimState, pos: GridPos): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < state.grid.width && pos.y < state.grid.height;
}

export function findEntityAt(state: SimState, pos: GridPos): EntityRef | undefined {
  const matches = (p: GridPos) => p.x === pos.x && p.y === pos.y;
  for (const source of Object.values(state.sources)) {
    if (matches(source.position)) return { kind: 'source', id: source.id };
  }
  for (const sink of Object.values(state.sinks)) {
    if (matches(sink.position)) return { kind: 'sink', id: sink.id };
  }
  for (const machine of Object.values(state.machines)) {
    if (matches(machine.position)) return { kind: 'machine', id: machine.id };
  }
  for (const conveyor of Object.values(state.conveyors)) {
    if (matches(conveyor.position)) return { kind: 'conveyor', id: conveyor.id };
  }
  return undefined;
}
