import { tryDeliverTo } from '../core/delivery';
import type { SimEvent } from '../core/events';
import { peekPort, tryPushToPort, tryTakeFromPort } from '../core/port';
import { machinePorts } from '../core/routing';
import { translate } from '../core/types';
import type { MachineHandler } from './registry';

export const filterHandler: MachineHandler = {
  kind: 'filter',
  step({ state, machine }) {
    if (machine.kind !== 'filter') return [];
    const events: SimEvent[] = [];
    const inputPort = machine.inputs[0];
    const outputPort = machine.outputs[0];

    const finished = peekPort(outputPort);
    if (finished !== undefined) {
      const { outSide } = machinePorts(state, machine.position);
      const target = outSide ? translate(machine.position, outSide) : null;
      if (target && tryDeliverTo(state, target, finished, events)) {
        tryTakeFromPort(outputPort);
      }
    }

    const waitingId = peekPort(inputPort);
    if (waitingId !== undefined) {
      const packet = state.packets[waitingId];
      if (machine.config.allow.includes(packet.material)) {
        const outputHasRoom = outputPort.queue.length < outputPort.capacity;
        if (outputHasRoom) {
          tryTakeFromPort(inputPort);
          tryPushToPort(outputPort, waitingId);
        }
      } else {
        tryTakeFromPort(inputPort);
        delete state.packets[waitingId];
        events.push({ type: 'packetDespawned', packetId: waitingId });
      }
    }

    return events;
  },
};
