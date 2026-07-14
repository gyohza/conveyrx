import { isInsideBase } from './base';
import { findEntityAt } from './grid';
import type { SimEvent } from './events';
import { tryPushToPort } from './port';
import type { SimState } from './state';
import type { GridPos, PacketId } from './types';

/** Returning false is the whole backpressure model: the packet simply stays put until the target can accept it. */
export function tryDeliverTo(
  state: SimState,
  targetPos: GridPos,
  packetId: PacketId,
  events: SimEvent[],
): boolean {
  if (isInsideBase(state.base, targetPos)) {
    const sink = Object.values(state.sinks)[0];
    if (!sink || !tryPushToPort(sink.input, packetId)) return false;
    events.push({ type: 'packetMoved', packetId, position: sink.position });
    return true;
  }

  const target = findEntityAt(state, targetPos);
  if (!target) return false;

  switch (target.kind) {
    case 'conveyor': {
      const conveyor = state.conveyors[target.id];
      if (conveyor.slot !== null) return false;
      conveyor.slot = packetId;
      events.push({ type: 'packetMoved', packetId, position: conveyor.position });
      return true;
    }
    case 'machine': {
      const machine = state.machines[target.id];
      if (!tryPushToPort(machine.inputs[0], packetId)) return false;
      events.push({ type: 'packetMoved', packetId, position: machine.position });
      return true;
    }
    case 'sink': {
      const sink = state.sinks[target.id];
      if (!tryPushToPort(sink.input, packetId)) return false;
      events.push({ type: 'packetMoved', packetId, position: sink.position });
      return true;
    }
    case 'source':
      return false;
  }
}
