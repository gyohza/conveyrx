import { describe, expect, it } from 'vitest';
import { stepConveyor } from './conveyor';
import { addConveyor, addMachine, addPacket, addSink, emptyState } from '../testing/state-builder';

describe('stepConveyor', () => {
  it('moves its packet onto the next conveyor cell it points at', () => {
    const state = emptyState();
    const from = addConveyor(state, { x: 0, y: 0 }, 'east');
    const to = addConveyor(state, { x: 1, y: 0 }, 'east');
    const packet = addPacket(state);
    from.slot = packet.id;

    const events = stepConveyor(state, from);

    expect(from.slot).toBeNull();
    expect(to.slot).toBe(packet.id);
    expect(events).toEqual([
      { type: 'packetMoved', packetId: packet.id, position: { x: 1, y: 0 } },
    ]);
  });

  it('keeps its packet in place when the target conveyor is occupied (clogged belt)', () => {
    const state = emptyState();
    const from = addConveyor(state, { x: 0, y: 0 }, 'east');
    const to = addConveyor(state, { x: 1, y: 0 }, 'east');
    from.slot = addPacket(state).id;
    to.slot = addPacket(state).id;

    const events = stepConveyor(state, from);

    expect(events).toEqual([]);
    expect(from.slot).not.toBeNull();
  });

  it('keeps its packet in place when pointing at an empty cell (disconnected belt end)', () => {
    const state = emptyState();
    const conveyor = addConveyor(state, { x: 0, y: 0 }, 'east');
    conveyor.slot = addPacket(state).id;

    expect(stepConveyor(state, conveyor)).toEqual([]);
    expect(conveyor.slot).not.toBeNull();
  });

  it('delivers its packet into an adjacent machine input port', () => {
    const state = emptyState();
    const conveyor = addConveyor(state, { x: 0, y: 0 }, 'east');
    const machine = addMachine(state, 'map', { x: 1, y: 0 });
    const packet = addPacket(state);
    conveyor.slot = packet.id;

    stepConveyor(state, conveyor);

    expect(conveyor.slot).toBeNull();
    expect(machine.inputs[0].queue).toEqual([packet.id]);
  });

  it('stalls when the machine input port is already full', () => {
    const state = emptyState();
    const conveyor = addConveyor(state, { x: 0, y: 0 }, 'east');
    const machine = addMachine(state, 'map', { x: 1, y: 0 });
    machine.inputs[0].queue.push(addPacket(state).id);
    conveyor.slot = addPacket(state).id;

    stepConveyor(state, conveyor);

    expect(conveyor.slot).not.toBeNull();
  });

  it('delivers its packet into an adjacent sink', () => {
    const state = emptyState();
    const conveyor = addConveyor(state, { x: 0, y: 0 }, 'south');
    const sink = addSink(state, { x: 0, y: 1 });
    const packet = addPacket(state);
    conveyor.slot = packet.id;

    stepConveyor(state, conveyor);

    expect(conveyor.slot).toBeNull();
    expect(sink.input.queue).toEqual([packet.id]);
  });

  it('does nothing when empty', () => {
    const state = emptyState();
    const conveyor = addConveyor(state, { x: 0, y: 0 }, 'east');

    expect(stepConveyor(state, conveyor)).toEqual([]);
  });
});
