import { tryDeliverTo } from './delivery';
import type { ConveyorEntity } from './entities';
import type { SimEvent } from './events';
import type { SimState } from './state';
import { translate } from './types';

export function stepConveyor(state: SimState, conveyor: ConveyorEntity): SimEvent[] {
  if (conveyor.slot === null) return [];
  const events: SimEvent[] = [];
  const target = translate(conveyor.position, conveyor.direction);
  if (tryDeliverTo(state, target, conveyor.slot, events)) {
    conveyor.slot = null;
  }
  return events;
}
