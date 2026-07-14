import { findEntityAt } from './grid';
import type { EntityRef } from './grid';
import { machinePorts } from './routing';
import type { EvalStep, SimState } from './state';
import { translate } from './types';
import type { Direction, GridPos } from './types';

function outputHeading(state: SimState, ref: EntityRef): { pos: GridPos; dir: Direction } | null {
  switch (ref.kind) {
    case 'source': {
      const e = state.sources[ref.id];
      const { outSide } = machinePorts(state, e.position);
      return outSide ? { pos: e.position, dir: outSide } : null;
    }
    case 'conveyor': {
      const e = state.conveyors[ref.id];
      return { pos: e.position, dir: e.direction };
    }
    case 'machine': {
      const e = state.machines[ref.id];
      const { outSide } = machinePorts(state, e.position);
      return outSide ? { pos: e.position, dir: outSide } : null;
    }
    case 'sink':
      return null;
  }
}

function downstreamOf(state: SimState, ref: EntityRef): EntityRef | undefined {
  const heading = outputHeading(state, ref);
  if (!heading) return undefined;
  const target = findEntityAt(state, translate(heading.pos, heading.dir));
  return target && target.kind !== 'source' ? target : undefined;
}

function allRefs(state: SimState): EntityRef[] {
  const byId = (a: EntityRef, b: EntityRef) => a.id - b.id;
  return [
    ...Object.values(state.sinks).map((e): EntityRef => ({ kind: 'sink', id: e.id })),
    ...Object.values(state.machines).map((e): EntityRef => ({ kind: 'machine', id: e.id })),
    ...Object.values(state.conveyors).map((e): EntityRef => ({ kind: 'conveyor', id: e.id })),
    ...Object.values(state.sources).map((e): EntityRef => ({ kind: 'source', id: e.id })),
  ].sort(byId);
}

/**
 * Downstream-first evaluation order (sinks before the entities feeding them), so capacity
 * freed by a consumer this tick is immediately visible upstream. Depth-first post-order
 * along each entity's output edge; cycles are broken at the revisit point, which simply
 * costs the cycle one tick of latency instead of special handling.
 */
export function computeEvalOrder(state: SimState): EvalStep[] {
  const order: EvalStep[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const keyOf = (ref: EntityRef) => `${ref.kind}:${ref.id}`;

  function visit(ref: EntityRef): void {
    const key = keyOf(ref);
    if (visited.has(key) || inStack.has(key)) return;
    inStack.add(key);
    const downstream = downstreamOf(state, ref);
    if (downstream) visit(downstream);
    inStack.delete(key);
    visited.add(key);
    order.push({ kind: ref.kind, id: ref.id });
  }

  for (const ref of allRefs(state)) visit(ref);
  return order;
}
