import { findBaseEntryConveyor } from './base';
import { findEntityAt } from './grid';
import type { ConveyorEntity, MachineEntity, SinkEntity, SourceEntity } from './entities';
import type { SimState } from './state';
import { DIRECTIONS, translate } from './types';
import type { Direction, EntityId, GridPos } from './types';

export interface MachinePorts {
  inSide: Direction | null;
  outSide: Direction | null;
  inCount: number;
  outCount: number;
}

function samePos(a: GridPos, b: GridPos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function machinePorts(state: SimState, position: GridPos): MachinePorts {
  let inSide: Direction | null = null;
  let outSide: Direction | null = null;
  let inCount = 0;
  let outCount = 0;

  for (const dir of DIRECTIONS) {
    const neighborPos = translate(position, dir);
    const neighbor = findEntityAt(state, neighborPos);
    if (!neighbor || neighbor.kind !== 'conveyor') continue;

    const conveyor = state.conveyors[neighbor.id];
    const feedsIn = samePos(translate(conveyor.position, conveyor.direction), position);
    if (feedsIn) {
      inSide = dir;
      inCount++;
    } else {
      outSide = dir;
      outCount++;
    }
  }

  return { inSide, outSide, inCount, outCount };
}

const DEFAULT_DIRECTION: Direction = 'east';

export function feederDirection(state: SimState, pos: GridPos): Direction | null {
  let direction: Direction | null = null;
  let count = 0;

  for (const dir of DIRECTIONS) {
    const neighborPos = translate(pos, dir);
    const neighbor = findEntityAt(state, neighborPos);
    if (!neighbor || neighbor.kind !== 'conveyor') continue;

    const conveyor = state.conveyors[neighbor.id];
    if (samePos(translate(conveyor.position, conveyor.direction), pos)) {
      direction = conveyor.direction;
      count++;
    }
  }

  return count === 1 ? direction : null;
}

export function inferConveyorDirection(state: SimState, pos: GridPos): Direction {
  return feederDirection(state, pos) ?? DEFAULT_DIRECTION;
}

function nextConveyorInFlow(
  state: SimState,
  pos: GridPos,
  dir: Direction,
): ConveyorEntity | undefined {
  const targetPos = translate(pos, dir);
  const target = findEntityAt(state, targetPos);
  if (!target) return undefined;
  if (target.kind === 'conveyor') return state.conveyors[target.id];
  if (target.kind === 'machine') {
    const { outSide } = machinePorts(state, targetPos);
    return outSide ? nextConveyorInFlow(state, targetPos, outSide) : undefined;
  }
  return undefined;
}

export function conveyorLanes(state: SimState): Record<EntityId, number> {
  const byId = state.conveyors;
  const nextOf = new Map<EntityId, EntityId>();
  const feedersOf = new Map<EntityId, EntityId[]>();
  for (const conveyor of Object.values(byId)) {
    const next = nextConveyorInFlow(state, conveyor.position, conveyor.direction);
    if (!next) continue;
    nextOf.set(conveyor.id, next.id);
    feedersOf.set(next.id, [...(feedersOf.get(next.id) ?? []), conveyor.id]);
  }

  const lanes: Record<EntityId, number> = {};
  const visited = new Set<EntityId>();
  let nextLane = 0;

  for (const start of Object.values(byId)) {
    if (visited.has(start.id)) continue;
    const lane = nextLane++;
    const queue: EntityId[] = [start.id];
    visited.add(start.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      lanes[id] = lane;
      const forward = nextOf.get(id);
      if (forward !== undefined && !visited.has(forward)) {
        visited.add(forward);
        queue.push(forward);
      }
      for (const backward of feedersOf.get(id) ?? []) {
        if (!visited.has(backward)) {
          visited.add(backward);
          queue.push(backward);
        }
      }
    }
  }

  return lanes;
}

export function poweredConveyors(state: SimState): Set<EntityId> {
  const powered = new Set<EntityId>();
  const visited = new Set<string>();

  function follow(pos: GridPos, dir: Direction): void {
    const nextPos = translate(pos, dir);
    const target = findEntityAt(state, nextPos);
    if (!target) return;

    const key = `${target.kind}:${target.id}`;
    if (visited.has(key)) return;
    visited.add(key);

    if (target.kind === 'conveyor') {
      powered.add(target.id);
      const conveyor = state.conveyors[target.id];
      follow(conveyor.position, conveyor.direction);
    } else if (target.kind === 'machine') {
      const machine = state.machines[target.id];
      const { outSide } = machinePorts(state, machine.position);
      if (outSide) follow(machine.position, outSide);
    }
  }

  for (const source of Object.values(state.sources)) {
    if (!source.subscribed) continue;
    const { outSide } = machinePorts(state, source.position);
    if (outSide) follow(source.position, outSide);
  }

  return powered;
}

export function isBasePowered(state: SimState): boolean {
  const entry = findBaseEntryConveyor(state);
  return entry !== undefined && poweredConveyors(state).has(entry.id);
}

export interface SourceChain {
  machines: MachineEntity[];
  sink: SinkEntity | null;
}

function followChain(
  state: SimState,
  pos: GridPos,
  dir: Direction,
  machines: MachineEntity[],
  visited: Set<string>,
): SinkEntity | null {
  const nextPos = translate(pos, dir);
  const target = findEntityAt(state, nextPos);
  if (!target) return null;

  const key = `${target.kind}:${target.id}`;
  if (visited.has(key)) return null;
  visited.add(key);

  if (target.kind === 'sink') return state.sinks[target.id];
  if (target.kind === 'conveyor') {
    const conveyor = state.conveyors[target.id];
    return followChain(state, conveyor.position, conveyor.direction, machines, visited);
  }
  if (target.kind === 'machine') {
    const machine = state.machines[target.id];
    machines.push(machine);
    const { outSide } = machinePorts(state, machine.position);
    return outSide ? followChain(state, machine.position, outSide, machines, visited) : null;
  }
  return null;
}

export function traceSourceChain(state: SimState, source: SourceEntity): SourceChain {
  const machines: MachineEntity[] = [];
  const { outSide } = machinePorts(state, source.position);
  const sink = outSide ? followChain(state, source.position, outSide, machines, new Set()) : null;
  return { machines, sink };
}

function feedsInto(
  state: SimState,
  neighborPos: GridPos,
  pos: GridPos,
  neighborKind: string,
  neighborId: EntityId,
): boolean {
  if (neighborKind === 'conveyor') {
    const conveyor = state.conveyors[neighborId];
    return samePos(translate(conveyor.position, conveyor.direction), pos);
  }
  if (neighborKind === 'source' || neighborKind === 'machine') {
    const { outSide } = machinePorts(state, neighborPos);
    return outSide !== null && samePos(translate(neighborPos, outSide), pos);
  }
  return false;
}

function findUpstreamSource(
  state: SimState,
  pos: GridPos,
  visited: Set<string>,
): SourceEntity | undefined {
  for (const dir of DIRECTIONS) {
    const neighborPos = translate(pos, dir);
    const neighbor = findEntityAt(state, neighborPos);
    if (!neighbor || !feedsInto(state, neighborPos, pos, neighbor.kind, neighbor.id)) continue;

    const key = `${neighbor.kind}:${neighbor.id}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (neighbor.kind === 'source') return state.sources[neighbor.id];
    if (neighbor.kind === 'conveyor' || neighbor.kind === 'machine') {
      return findUpstreamSource(state, neighborPos, visited);
    }
  }
  return undefined;
}

export function traceUpstreamSource(state: SimState, pos: GridPos): SourceEntity | undefined {
  return findUpstreamSource(state, pos, new Set());
}
