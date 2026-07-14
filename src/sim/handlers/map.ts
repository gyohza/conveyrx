import { RECIPES } from '../content/recipes';
import { tryDeliverTo } from '../core/delivery';
import type { SimEvent } from '../core/events';
import { peekPort, tryPushToPort, tryTakeFromPort } from '../core/port';
import { machinePorts } from '../core/routing';
import { translate } from '../core/types';
import type { MachineHandler } from './registry';

export const mapHandler: MachineHandler = {
  kind: 'map',
  step({ state, machine }) {
    if (machine.kind !== 'map') return [];
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
      const recipe = RECIPES[machine.config.recipeId];
      const outputHasRoom = outputPort.queue.length < outputPort.capacity;
      if (packet.material === recipe.from && outputHasRoom) {
        tryTakeFromPort(inputPort);
        packet.material = recipe.to;
        events.push({ type: 'packetTransformed', packetId: waitingId, material: recipe.to });
        tryPushToPort(outputPort, waitingId);
      }
    }

    return events;
  },
};
