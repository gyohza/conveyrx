import { CONVEYOR_COST, SOURCE_COST, takeCost } from '../content/economy';
import { MACHINE_DEFS } from '../content/machine-defs';
import type { MaterialId } from '../content/materials';
import { RECIPES } from '../content/recipes';
import type { RecipeId } from '../content/recipes';
import { findBaseEntryConveyor, isBaseEntryPoint, isInBaseBuffer, isInsideBase } from './base';
import type { MachineEntity, MachineKind, MineSpec } from './entities';
import { computeEvalOrder } from './eval-order';
import type { SimEvent } from './events';
import { findEntityAt, inBounds } from './grid';
import { createPort } from './port';
import { machinePorts } from './routing';
import type { SimState } from './state';
import { DIRECTIONS, translate } from './types';
import type { Direction, GridPos, PacketId } from './types';

export type BuildRequest =
  | { type: 'conveyor'; direction: Direction }
  | { type: 'machine'; kind: MachineKind }
  | { type: 'source' };

export type PlaceResult =
  | { ok: true; events?: SimEvent[] }
  | {
      ok: false;
      reason:
        | 'out-of-bounds'
        | 'occupied'
        | 'not-a-mine'
        | 'insufficient-cash'
        | 'machine-port-taken'
        | 'inside-base'
        | 'base-buffer-restricted'
        | 'base-entry-taken';
    };

export type ConfigUpdate =
  | { kind: 'map'; recipeId: RecipeId }
  | { kind: 'filter'; allow: MaterialId[] }
  | { kind: 'take'; count: number };

export type ReconfigureResult =
  | { ok: true; costDelta: number }
  | { ok: false; reason: 'not-a-machine' | 'kind-mismatch' | 'insufficient-cash' };

function findMine(state: SimState, pos: GridPos): MineSpec | undefined {
  return state.mines.find((mine) => mine.position.x === pos.x && mine.position.y === pos.y);
}

export type EraseResult =
  { ok: true; refund: number; events: SimEvent[] } | { ok: false; reason: 'empty' | 'protected' };

function defaultMachineCost(kind: MachineKind): number {
  if (kind === 'map') return RECIPES[MACHINE_DEFS.map.availableRecipes![0]].cost;
  if (kind === 'take') return takeCost(MACHINE_DEFS.take.availableCounts![0]);
  return MACHINE_DEFS[kind].cost!;
}

export function buildCost(request: BuildRequest): number {
  if (request.type === 'conveyor') return CONVEYOR_COST;
  if (request.type === 'source') return SOURCE_COST;
  return defaultMachineCost(request.kind);
}

export function machineCost(machine: MachineEntity): number {
  if (machine.kind === 'map') return RECIPES[machine.config.recipeId].cost;
  if (machine.kind === 'take') return takeCost(machine.config.count);
  return MACHINE_DEFS[machine.kind].cost!;
}

function configCost(update: ConfigUpdate): number {
  if (update.kind === 'map') return RECIPES[update.recipeId].cost;
  if (update.kind === 'take') return takeCost(update.count);
  return MACHINE_DEFS[update.kind].cost!;
}

export function reconfigureMachine(
  state: SimState,
  pos: GridPos,
  update: ConfigUpdate,
): ReconfigureResult {
  const target = findEntityAt(state, pos);
  if (!target || target.kind !== 'machine') return { ok: false, reason: 'not-a-machine' };
  const machine = state.machines[target.id];
  if (machine.kind !== update.kind) return { ok: false, reason: 'kind-mismatch' };

  const costDelta = configCost(update) - machineCost(machine);
  if (state.economy.cash < costDelta) return { ok: false, reason: 'insufficient-cash' };

  if (update.kind === 'map') machine.config = { recipeId: update.recipeId };
  else if (update.kind === 'filter') machine.config = { allow: update.allow };
  else machine.config = { count: update.count };

  state.economy.cash -= costDelta;
  return { ok: true, costDelta };
}

function conveyorConflictsWithMachinePorts(
  state: SimState,
  pos: GridPos,
  direction: Direction,
): boolean {
  for (const dir of DIRECTIONS) {
    const neighborPos = translate(pos, dir);
    const neighbor = findEntityAt(state, neighborPos);
    if (!neighbor || (neighbor.kind !== 'machine' && neighbor.kind !== 'source')) continue;

    const pointsAtMachine = dir === direction;
    const ports = machinePorts(state, neighborPos);
    if (pointsAtMachine ? ports.inCount > 0 : ports.outCount > 0) return true;
  }
  return false;
}

function entityPortConflict(state: SimState, pos: GridPos): boolean {
  const { inCount, outCount } = machinePorts(state, pos);
  return inCount > 1 || outCount > 1;
}

function replacesConveyor(state: SimState, request: BuildRequest, pos: GridPos): boolean {
  return request.type === 'machine' && findEntityAt(state, pos)?.kind === 'conveyor';
}

export function canPlace(state: SimState, request: BuildRequest, pos: GridPos): PlaceResult {
  if (!inBounds(state, pos)) return { ok: false, reason: 'out-of-bounds' };
  if (isInsideBase(state.base, pos)) return { ok: false, reason: 'inside-base' };
  if (request.type !== 'conveyor' && isInBaseBuffer(state.base, pos)) {
    return { ok: false, reason: 'base-buffer-restricted' };
  }
  const occupant = findEntityAt(state, pos);
  const replacing = replacesConveyor(state, request, pos);
  if (occupant && !replacing) return { ok: false, reason: 'occupied' };
  if (request.type === 'source' && !findMine(state, pos)) {
    return { ok: false, reason: 'not-a-mine' };
  }
  const availableCash = state.economy.cash + (replacing ? CONVEYOR_COST : 0);
  if (availableCash < buildCost(request)) return { ok: false, reason: 'insufficient-cash' };
  if (
    request.type === 'conveyor'
      ? conveyorConflictsWithMachinePorts(state, pos, request.direction)
      : entityPortConflict(state, pos)
  ) {
    return { ok: false, reason: 'machine-port-taken' };
  }
  if (
    request.type === 'conveyor' &&
    isBaseEntryPoint(state, pos, request.direction) &&
    findBaseEntryConveyor(state) !== undefined
  ) {
    return { ok: false, reason: 'base-entry-taken' };
  }
  return { ok: true };
}

export function place(state: SimState, request: BuildRequest, pos: GridPos): PlaceResult {
  const check = canPlace(state, request, pos);
  if (!check.ok) return check;

  const events: SimEvent[] = [];
  if (replacesConveyor(state, request, pos)) {
    const replaced = erase(state, pos);
    if (replaced.ok) events.push(...replaced.events);
  }

  const id = state.nextEntityId++;
  if (request.type === 'conveyor') {
    state.conveyors[id] = { id, position: pos, direction: request.direction, slot: null };
  } else if (request.type === 'source') {
    const mine = findMine(state, pos)!;
    state.sources[id] = {
      id,
      position: pos,
      kind: 'from',
      sequence: mine.sequence,
      subscribed: false,
      cursor: 0,
      ticksSinceLastSpawn: 0,
      output: createPort(1),
    };
  } else {
    const base = { id, position: pos, inputs: [createPort(1)], outputs: [createPort(1)] };
    if (request.kind === 'map') {
      state.machines[id] = {
        ...base,
        internal: undefined,
        kind: 'map',
        config: { recipeId: MACHINE_DEFS.map.availableRecipes![0] },
      };
    } else if (request.kind === 'filter') {
      state.machines[id] = {
        ...base,
        internal: undefined,
        kind: 'filter',
        config: { allow: [MACHINE_DEFS.filter.filterableMaterials![0]] },
      };
    } else {
      state.machines[id] = {
        ...base,
        kind: 'take',
        config: { count: MACHINE_DEFS.take.availableCounts![0] },
        internal: { passed: 0, sourceWasSubscribed: false },
      };
    }
  }
  state.economy.cash -= buildCost(request);
  state.evalOrder = computeEvalOrder(state);
  return events.length > 0 ? { ok: true, events } : { ok: true };
}

/**
 * Checked after the redirect is tentatively applied, not before (unlike
 * {@link conveyorConflictsWithMachinePorts}), since the conveyor at `pos` already exists and
 * would otherwise be double-counted against its own stale, pre-redirect direction.
 */
function conveyorConflictsAfterRedirect(state: SimState, pos: GridPos): boolean {
  for (const dir of DIRECTIONS) {
    const neighborPos = translate(pos, dir);
    const neighbor = findEntityAt(state, neighborPos);
    if (!neighbor || (neighbor.kind !== 'machine' && neighbor.kind !== 'source')) continue;
    if (entityPortConflict(state, neighborPos)) return true;
  }
  return false;
}

export function redirectConveyor(state: SimState, pos: GridPos, direction: Direction): boolean {
  const target = findEntityAt(state, pos);
  if (!target || target.kind !== 'conveyor') return false;

  const conveyor = state.conveyors[target.id];
  const previousDirection = conveyor.direction;
  if (previousDirection === direction) return true;

  conveyor.direction = direction;
  const otherEntry = findBaseEntryConveyor(state);
  const createsSecondEntry =
    isBaseEntryPoint(state, pos, direction) &&
    otherEntry !== undefined &&
    otherEntry.id !== conveyor.id;
  if (conveyorConflictsAfterRedirect(state, pos) || createsSecondEntry) {
    conveyor.direction = previousDirection;
    return false;
  }
  state.evalOrder = computeEvalOrder(state);
  return true;
}

export function erase(state: SimState, pos: GridPos): EraseResult {
  const target = findEntityAt(state, pos);
  if (!target) return { ok: false, reason: 'empty' };
  if (target.kind === 'sink') return { ok: false, reason: 'protected' };

  const events: SimEvent[] = [];
  const despawn = (packetId: PacketId) => {
    delete state.packets[packetId];
    events.push({ type: 'packetDespawned', packetId });
  };

  let refund: number;
  if (target.kind === 'conveyor') {
    const conveyor = state.conveyors[target.id];
    if (conveyor.slot !== null) despawn(conveyor.slot);
    delete state.conveyors[target.id];
    refund = CONVEYOR_COST;
  } else if (target.kind === 'source') {
    const source = state.sources[target.id];
    source.output.queue.forEach(despawn);
    delete state.sources[target.id];
    refund = SOURCE_COST;
  } else {
    const machine = state.machines[target.id];
    [...machine.inputs, ...machine.outputs].forEach((port) => port.queue.forEach(despawn));
    delete state.machines[target.id];
    refund = machineCost(machine);
  }

  state.economy.cash += refund;
  state.evalOrder = computeEvalOrder(state);
  return { ok: true, refund, events };
}

export function clearAll(state: SimState): { refund: number; events: SimEvent[] } {
  const positions = [
    ...Object.values(state.conveyors).map((c) => c.position),
    ...Object.values(state.machines).map((m) => m.position),
  ];

  let refund = 0;
  const events: SimEvent[] = [];
  for (const pos of positions) {
    const result = erase(state, pos);
    if (result.ok) {
      refund += result.refund;
      events.push(...result.events);
    }
  }
  return { refund, events };
}
