import { getHandler } from '../handlers';
import type { MachineEntity } from './entities';
import type { SimEvent } from './events';
import type { SimState } from './state';

export function stepMachine(state: SimState, machine: MachineEntity): SimEvent[] {
  return getHandler(machine.kind).step({ state, machine });
}
