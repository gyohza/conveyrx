import { MATERIALS } from '../content/materials';
import type { SinkEntity } from './entities';
import type { SimEvent } from './events';
import { tryTakeFromPort } from './port';
import type { SimState } from './state';

export function stepSink(state: SimState, sink: SinkEntity): SimEvent[] {
  const events: SimEvent[] = [];
  let packetId: number | undefined;

  while ((packetId = tryTakeFromPort(sink.input)) !== undefined) {
    const packet = state.packets[packetId];
    const amount = MATERIALS[packet.material].sellPrice;
    if (sink.sinkType === 'cash') {
      state.economy.cash += amount;
    } else {
      state.economy.research += amount;
    }
    delete state.packets[packetId];
    events.push({ type: 'packetDespawned', packetId });
  }

  return events;
}
