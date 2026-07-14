import { SUBSCRIPTION_UPKEEP_PER_TICK } from '../content/economy';
import { SOURCE_KINDS } from '../content/source-kinds';
import { tryDeliverTo } from './delivery';
import type { SourceEntity } from './entities';
import type { SimEvent } from './events';
import { peekPort, tryPushToPort, tryTakeFromPort } from './port';
import { machinePorts } from './routing';
import type { SimState } from './state';
import { translate } from './types';

export function stepSource(state: SimState, source: SourceEntity): SimEvent[] {
  const events: SimEvent[] = [];

  const waiting = peekPort(source.output);
  if (waiting !== undefined) {
    const { outSide } = machinePorts(state, source.position);
    if (outSide) {
      const target = translate(source.position, outSide);
      if (tryDeliverTo(state, target, waiting, events)) tryTakeFromPort(source.output);
    }
  }

  if (!source.subscribed) return events;

  state.economy.cash -= SUBSCRIPTION_UPKEEP_PER_TICK;

  if (source.cursor >= source.sequence.length) return events;

  source.ticksSinceLastSpawn += 1;
  if (source.ticksSinceLastSpawn < SOURCE_KINDS[source.kind].rateTicks) return events;
  if (source.output.queue.length >= source.output.capacity) return events;

  const material = source.sequence[source.cursor];
  const packetId = state.nextPacketId++;
  state.packets[packetId] = { id: packetId, material, bornTick: state.tick };
  tryPushToPort(source.output, packetId);
  source.ticksSinceLastSpawn = 0;
  source.cursor += 1;
  events.push({
    type: 'packetSpawned',
    packetId,
    material,
    position: source.position,
  });

  return events;
}
