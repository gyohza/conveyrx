import { tryDeliverTo } from '../core/delivery';
import type { SimEvent } from '../core/events';
import { peekPort, tryPushToPort, tryTakeFromPort } from '../core/port';
import { machinePorts, traceUpstreamSource } from '../core/routing';
import { resetSequence } from '../core/subscription';
import { translate } from '../core/types';
import type { MachineHandler } from './registry';

export const takeHandler: MachineHandler = {
  kind: 'take',
  step({ state, machine }) {
    if (machine.kind !== 'take') return [];
    const events: SimEvent[] = [];
    const source = traceUpstreamSource(state, machine.position);

    /** A fresh subscribe (false -> true) restarts the take(n) count, matching RxJS's per-subscription semantics. */
    const sourceSubscribed = source?.subscribed ?? false;
    if (sourceSubscribed && !machine.internal.sourceWasSubscribed) {
      machine.internal.passed = 0;
    }
    machine.internal.sourceWasSubscribed = sourceSubscribed;

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
    if (waitingId !== undefined && machine.internal.passed < machine.config.count) {
      const outputHasRoom = outputPort.queue.length < outputPort.capacity;
      if (outputHasRoom) {
        tryTakeFromPort(inputPort);
        tryPushToPort(outputPort, waitingId);
        machine.internal.passed += 1;

        if (machine.internal.passed >= machine.config.count && source && source.subscribed) {
          source.subscribed = false;
          resetSequence(source);
          events.push({ type: 'sourceUnsubscribed', sourceId: source.id });
        }
      }
    }

    return events;
  },
};
