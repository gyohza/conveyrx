import type { MachineEntity, MachineKind } from '../core/entities';
import type { SimEvent } from '../core/events';
import type { SimState } from '../core/state';

export interface HandlerCtx {
  state: SimState;
  machine: MachineEntity;
}

export interface MachineHandler {
  kind: MachineKind;
  step(ctx: HandlerCtx): SimEvent[];
}

const handlers = new Map<MachineKind, MachineHandler>();

export function registerHandler(handler: MachineHandler): void {
  handlers.set(handler.kind, handler);
}

export function getHandler(kind: MachineKind): MachineHandler {
  const handler = handlers.get(kind);
  if (!handler) {
    throw new Error(`No machine handler registered for kind "${kind}"`);
  }
  return handler;
}
