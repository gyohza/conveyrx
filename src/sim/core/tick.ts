import { stepConveyor } from './conveyor';
import type { SimEvent } from './events';
import { stepMachine } from './machine';
import { stepSink } from './sink';
import { stepSource } from './source';
import type { SimState } from './state';

export function tick(state: SimState): { state: SimState; events: SimEvent[] } {
  const events: SimEvent[] = [];

  for (const step of state.evalOrder) {
    switch (step.kind) {
      case 'sink':
        events.push(...stepSink(state, state.sinks[step.id]));
        break;
      case 'conveyor':
        events.push(...stepConveyor(state, state.conveyors[step.id]));
        break;
      case 'machine':
        events.push(...stepMachine(state, state.machines[step.id]));
        break;
      case 'source':
        events.push(...stepSource(state, state.sources[step.id]));
        break;
    }
  }

  state.tick += 1;
  return { state, events };
}

export function stepN(
  state: SimState,
  n: number,
  opts: { collectEvents?: boolean } = {},
): { state: SimState; events: SimEvent[] } {
  const collectEvents = opts.collectEvents ?? true;
  const events: SimEvent[] = [];

  for (let i = 0; i < n; i++) {
    const result = tick(state);
    if (collectEvents) {
      events.push(...result.events);
    }
  }

  return { state, events };
}
