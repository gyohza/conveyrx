import { describe, expect, it } from 'vitest';
import {
  conveyorLanes,
  feederDirection,
  inferConveyorDirection,
  isBasePowered,
  machinePorts,
  poweredConveyors,
  traceSourceChain,
  traceUpstreamSource,
} from './routing';
import { addConveyor, addMachine, addSink, addSource, emptyState } from '../testing/state-builder';

const POS = { x: 3, y: 3 };

describe('machinePorts', () => {
  it('resolves neither side when nothing is there yet', () => {
    const state = emptyState();

    expect(machinePorts(state, POS)).toEqual({
      inSide: null,
      outSide: null,
      inCount: 0,
      outCount: 0,
    });
  });

  it('resolves the incoming side from a conveyor whose own direction points into the position', () => {
    const state = emptyState();
    addConveyor(state, { x: 2, y: 3 }, 'east'); // west of the position, pointing east into it

    expect(machinePorts(state, POS)).toEqual({
      inSide: 'west',
      outSide: null,
      inCount: 1,
      outCount: 0,
    });
  });

  it('resolves the outgoing side from a conveyor that merely touches the position without feeding it', () => {
    const state = emptyState();
    addConveyor(state, { x: 4, y: 3 }, 'east'); // east of the position, pointing further away

    expect(machinePorts(state, POS)).toEqual({
      inSide: null,
      outSide: 'east',
      inCount: 0,
      outCount: 1,
    });
  });

  it('treats a neighbor that points back into the position as incoming regardless of which side it sits on', () => {
    const state = emptyState();
    addConveyor(state, { x: 4, y: 3 }, 'west'); // east of the position, but pointing back into it

    expect(machinePorts(state, POS)).toEqual({
      inSide: 'east',
      outSide: null,
      inCount: 1,
      outCount: 0,
    });
  });

  it('resolves both sides at once when one neighbor feeds in and another receives out', () => {
    const state = emptyState();
    addConveyor(state, { x: 2, y: 3 }, 'east'); // west -> in
    addConveyor(state, { x: 4, y: 3 }, 'east'); // east -> out

    expect(machinePorts(state, POS)).toEqual({
      inSide: 'west',
      outSide: 'east',
      inCount: 1,
      outCount: 1,
    });
  });

  it('ignores non-conveyor neighbors, such as a source sitting directly next to the position', () => {
    const state = emptyState();
    addSource(state, { x: 2, y: 3 });

    expect(machinePorts(state, POS)).toEqual({
      inSide: null,
      outSide: null,
      inCount: 0,
      outCount: 0,
    });
  });

  it('counts more than one incoming or outgoing neighbor instead of just picking one', () => {
    const state = emptyState();
    addConveyor(state, { x: 2, y: 3 }, 'east'); // west -> in
    addConveyor(state, { x: 3, y: 2 }, 'south'); // north -> in
    addConveyor(state, { x: 4, y: 3 }, 'east'); // east -> out
    addConveyor(state, { x: 3, y: 4 }, 'south'); // south -> out

    const ports = machinePorts(state, POS);

    expect(ports.inCount).toBe(2);
    expect(ports.outCount).toBe(2);
  });

  it('works from an existing machine entity by passing its position', () => {
    const state = emptyState();
    const machine = addMachine(state, 'map', POS);
    addConveyor(state, { x: 2, y: 3 }, 'east');

    expect(machinePorts(state, machine.position)).toMatchObject({ inSide: 'west' });
  });
});

describe('inferConveyorDirection', () => {
  it('defaults to east when nothing feeds into the position', () => {
    const state = emptyState();

    expect(inferConveyorDirection(state, POS)).toBe('east');
  });

  it('continues the flow of the single conveyor feeding into the position', () => {
    const state = emptyState();
    addConveyor(state, { x: 3, y: 2 }, 'south'); // north of POS, feeding south into it

    expect(inferConveyorDirection(state, POS)).toBe('south');
  });

  it('falls back to the default next to a bare source, which has no direction of its own', () => {
    const state = emptyState();
    addSource(state, { x: 2, y: 3 }); // west of POS, but a source never hints a direction

    expect(inferConveyorDirection(state, POS)).toBe('east');
  });

  it('ignores a neighbor that merely touches the position without feeding it', () => {
    const state = emptyState();
    addConveyor(state, { x: 4, y: 3 }, 'east'); // east of POS, pointing further away

    expect(inferConveyorDirection(state, POS)).toBe('east'); // falls back to the default
  });

  it('falls back to the default when two neighbors both feed in (ambiguous)', () => {
    const state = emptyState();
    addConveyor(state, { x: 2, y: 3 }, 'east'); // west -> in
    addConveyor(state, { x: 3, y: 2 }, 'south'); // north -> in

    expect(inferConveyorDirection(state, POS)).toBe('east');
  });

  it('ignores sinks, which have no direction of their own', () => {
    const state = emptyState();
    addSink(state, { x: 2, y: 3 });

    expect(inferConveyorDirection(state, POS)).toBe('east');
  });
});

describe('conveyorLanes', () => {
  it('returns an empty map for a grid with no conveyors', () => {
    const state = emptyState();

    expect(conveyorLanes(state)).toEqual({});
  });

  it('assigns the same lane to a connected chain of conveyors', () => {
    const state = emptyState();
    const a = addConveyor(state, { x: 1, y: 3 }, 'east');
    const b = addConveyor(state, { x: 2, y: 3 }, 'east');
    const c = addConveyor(state, { x: 3, y: 3 }, 'east');

    const lanes = conveyorLanes(state);

    expect(lanes[a.id]).toBe(lanes[b.id]);
    expect(lanes[b.id]).toBe(lanes[c.id]);
  });

  it('assigns different lanes to two unconnected chains', () => {
    const state = emptyState();
    const a = addConveyor(state, { x: 1, y: 3 }, 'east');
    const b = addConveyor(state, { x: 6, y: 6 }, 'east');

    const lanes = conveyorLanes(state);

    expect(lanes[a.id]).not.toBe(lanes[b.id]);
  });

  it('keeps the same lane through a single-in/single-out machine (not a fork or a merge)', () => {
    const state = emptyState();
    const a = addConveyor(state, { x: 1, y: 3 }, 'east'); // feeds the machine
    addMachine(state, 'map', { x: 2, y: 3 });
    const c = addConveyor(state, { x: 3, y: 3 }, 'east'); // fed by the machine's output

    const lanes = conveyorLanes(state);

    expect(lanes[a.id]).toBe(lanes[c.id]);
  });

  it('keeps the same lane through two machines in a row', () => {
    const state = emptyState();
    const a = addConveyor(state, { x: 1, y: 3 }, 'east'); // feeds the first machine
    addMachine(state, 'map', { x: 2, y: 3 });
    const bridge = addConveyor(state, { x: 3, y: 3 }, 'east'); // between the two machines
    addMachine(state, 'map', { x: 4, y: 3 });
    const c = addConveyor(state, { x: 5, y: 3 }, 'east'); // fed by the second machine's output

    const lanes = conveyorLanes(state);

    expect(lanes[a.id]).toBe(lanes[bridge.id]);
    expect(lanes[bridge.id]).toBe(lanes[c.id]);
  });

  it('assigns one lane to a merge, where two conveyors both feed a third', () => {
    const state = emptyState();
    const west = addConveyor(state, { x: 2, y: 3 }, 'east'); // feeds POS from the west
    const north = addConveyor(state, { x: 3, y: 2 }, 'south'); // feeds POS from the north
    const merged = addConveyor(state, POS, 'east');

    const lanes = conveyorLanes(state);

    expect(lanes[west.id]).toBe(lanes[merged.id]);
    expect(lanes[north.id]).toBe(lanes[merged.id]);
  });
});

describe('feederDirection', () => {
  it('returns null when nothing feeds into the position (no confident inference)', () => {
    const state = emptyState();

    expect(feederDirection(state, POS)).toBeNull();
  });

  it('returns the direction of the single feeding neighbor', () => {
    const state = emptyState();
    addConveyor(state, { x: 3, y: 2 }, 'south'); // north of POS, feeding south into it

    expect(feederDirection(state, POS)).toBe('south');
  });

  it('returns null when two neighbors both feed in (ambiguous) rather than picking one', () => {
    const state = emptyState();
    addConveyor(state, { x: 2, y: 3 }, 'east'); // west -> in
    addConveyor(state, { x: 3, y: 2 }, 'south'); // north -> in

    expect(feederDirection(state, POS)).toBeNull();
  });

  it('returns null for a neighbor that merely touches the position without feeding it', () => {
    const state = emptyState();
    addConveyor(state, { x: 4, y: 3 }, 'east'); // east of POS, pointing further away

    expect(feederDirection(state, POS)).toBeNull();
  });
});

describe('poweredConveyors', () => {
  it('powers nothing on an empty board', () => {
    const state = emptyState();

    expect(poweredConveyors(state)).toEqual(new Set());
  });

  it('powers every conveyor in a chain fed by a subscribed source', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 3 }, { subscribed: true });
    const a = addConveyor(state, { x: 1, y: 3 }, 'east');
    const b = addConveyor(state, { x: 2, y: 3 }, 'east');
    const c = addConveyor(state, { x: 3, y: 3 }, 'east');

    const powered = poweredConveyors(state);

    expect(powered).toEqual(new Set([a.id, b.id, c.id]));
  });

  it('powers nothing when the feeding source is unsubscribed', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 3 }, { subscribed: false });
    addConveyor(state, { x: 1, y: 3 }, 'east');

    expect(poweredConveyors(state)).toEqual(new Set());
  });

  it('leaves an unrelated, disconnected chain unpowered', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 3 }, { subscribed: true });
    addConveyor(state, { x: 1, y: 3 }, 'east');
    const stray = addConveyor(state, { x: 6, y: 6 }, 'east');

    expect(poweredConveyors(state).has(stray.id)).toBe(false);
  });

  it('powers both sides of a chain split by a machine, following through its output', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 3 }, { subscribed: true });
    const before = addConveyor(state, { x: 1, y: 3 }, 'east'); // feeds the machine
    addMachine(state, 'map', { x: 2, y: 3 });
    const after = addConveyor(state, { x: 3, y: 3 }, 'east'); // fed by the machine's output

    const powered = poweredConveyors(state);

    expect(powered.has(before.id)).toBe(true);
    expect(powered.has(after.id)).toBe(true);
  });

  it('does not power a chain feeding into a machine with no further output', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 3 }, { subscribed: true });
    const before = addConveyor(state, { x: 1, y: 3 }, 'east'); // feeds the machine, dead-ends there
    addMachine(state, 'map', { x: 2, y: 3 });

    expect(poweredConveyors(state)).toEqual(new Set([before.id]));
  });

  it('stops cleanly at a sink without erroring', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 3 }, { subscribed: true });
    const a = addConveyor(state, { x: 1, y: 3 }, 'east');
    addSink(state, { x: 2, y: 3 });

    expect(() => poweredConveyors(state)).not.toThrow();
    expect(poweredConveyors(state)).toEqual(new Set([a.id]));
  });
});

describe('isBasePowered', () => {
  it('is false when nothing feeds the base', () => {
    const state = emptyState();
    state.base = { min: { x: 4, y: 4 }, max: { x: 6, y: 6 } };

    expect(isBasePowered(state)).toBe(false);
  });

  it('is true when the entry conveyor is reachable from a subscribed source', () => {
    const state = emptyState();
    state.base = { min: { x: 4, y: 4 }, max: { x: 6, y: 6 } };
    addSource(state, { x: 0, y: 4 }, { subscribed: true });
    addConveyor(state, { x: 1, y: 4 }, 'east');
    addConveyor(state, { x: 2, y: 4 }, 'east');
    addConveyor(state, { x: 3, y: 4 }, 'east'); // points into the base at (4,4)

    expect(isBasePowered(state)).toBe(true);
  });

  it('is false when an entry conveyor exists but is not powered', () => {
    const state = emptyState();
    state.base = { min: { x: 4, y: 4 }, max: { x: 6, y: 6 } };
    addConveyor(state, { x: 3, y: 4 }, 'east');

    expect(isBasePowered(state)).toBe(false);
  });
});

describe('traceSourceChain', () => {
  it('reports no machines and no sink for a source with nothing built yet', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 3 });

    expect(traceSourceChain(state, source)).toEqual({ machines: [], sink: null });
  });

  it('finds the sink directly, with no machines, over a plain conveyor run', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 3 });
    addConveyor(state, { x: 1, y: 3 }, 'east');
    const sink = addSink(state, { x: 2, y: 3 });

    expect(traceSourceChain(state, source)).toEqual({ machines: [], sink });
  });

  it('collects a machine encountered along the way, then the sink', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 3 });
    addConveyor(state, { x: 1, y: 3 }, 'east');
    const machine = addMachine(state, 'map', { x: 2, y: 3 });
    addConveyor(state, { x: 3, y: 3 }, 'east');
    const sink = addSink(state, { x: 4, y: 3 });

    expect(traceSourceChain(state, source)).toEqual({ machines: [machine], sink });
  });

  it('reports the machine but no sink when the chain dead-ends after it', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 3 });
    addConveyor(state, { x: 1, y: 3 }, 'east');
    const machine = addMachine(state, 'map', { x: 2, y: 3 });

    expect(traceSourceChain(state, source)).toEqual({ machines: [machine], sink: null });
  });
});

describe('traceUpstreamSource', () => {
  it('returns undefined when nothing feeds the position', () => {
    const state = emptyState();

    expect(traceUpstreamSource(state, { x: 3, y: 3 })).toBeUndefined();
  });

  it('finds the source directly feeding a position over a plain conveyor run', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 3 });
    addConveyor(state, { x: 1, y: 3 }, 'east');

    expect(traceUpstreamSource(state, { x: 2, y: 3 })).toBe(source);
  });

  it('hops backward over an interposed machine to reach the source', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 3 });
    addConveyor(state, { x: 1, y: 3 }, 'east');
    addMachine(state, 'map', { x: 2, y: 3 });
    addConveyor(state, { x: 3, y: 3 }, 'east');

    expect(traceUpstreamSource(state, { x: 4, y: 3 })).toBe(source);
  });

  it('returns undefined when the chain dead-ends without a source', () => {
    const state = emptyState();
    addConveyor(state, { x: 1, y: 3 }, 'east');

    expect(traceUpstreamSource(state, { x: 2, y: 3 })).toBeUndefined();
  });
});
