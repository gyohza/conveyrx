import { describe, expect, it } from 'vitest';
import { takeHandler } from './take';
import {
  addConveyor,
  addMachine,
  addPacket,
  addSource,
  emptyState,
} from '../testing/state-builder';

describe('takeHandler', () => {
  it('passes a packet through unchanged while under the count', () => {
    const state = emptyState();
    const machine = addMachine(state, 'take', { x: 1, y: 0 }, 3);
    const packet = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(packet.id);

    const events = takeHandler.step({ state, machine });

    expect(events).toEqual([]);
    expect(machine.inputs[0].queue).toEqual([]);
    expect(machine.outputs[0].queue).toEqual([packet.id]);
    expect(state.packets[packet.id].material).toBe('carbon');
    if (machine.kind === 'take') expect(machine.internal.passed).toBe(1);
  });

  it('drains a passed packet onto the conveyor it faces', () => {
    const state = emptyState();
    const machine = addMachine(state, 'take', { x: 1, y: 0 }, 3);
    const conveyor = addConveyor(state, { x: 2, y: 0 }, 'east');
    const packet = addPacket(state, 'carbon');
    machine.outputs[0].queue.push(packet.id);

    const events = takeHandler.step({ state, machine });

    expect(machine.outputs[0].queue).toEqual([]);
    expect(conveyor.slot).toBe(packet.id);
    expect(events).toEqual([
      { type: 'packetMoved', packetId: packet.id, position: { x: 2, y: 0 } },
    ]);
  });

  it('holds a packet at the input while the output port is full', () => {
    const state = emptyState();
    const machine = addMachine(state, 'take', { x: 1, y: 0 }, 3);
    machine.outputs[0].queue.push(addPacket(state, 'carbon').id);
    const waiting = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(waiting.id);

    takeHandler.step({ state, machine });

    expect(machine.inputs[0].queue).toEqual([waiting.id]);
  });

  it('does nothing when idle', () => {
    const state = emptyState();
    const machine = addMachine(state, 'take', { x: 1, y: 0 }, 3);

    expect(takeHandler.step({ state, machine })).toEqual([]);
  });

  it('unsubscribes the upstream source and reports it, exactly on the packet that reaches the count', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: true });
    addConveyor(state, { x: 1, y: 0 }, 'east');
    const machine = addMachine(state, 'take', { x: 2, y: 0 }, 1);
    const packet = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(packet.id);

    const events = takeHandler.step({ state, machine });

    expect(machine.outputs[0].queue).toEqual([packet.id]);
    expect(source.subscribed).toBe(false);
    expect(events).toEqual([{ type: 'sourceUnsubscribed', sourceId: source.id }]);
  });

  it('resets the source cursor when take completes and auto-unsubscribes it', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: true });
    source.cursor = 2;
    addConveyor(state, { x: 1, y: 0 }, 'east');
    const machine = addMachine(state, 'take', { x: 2, y: 0 }, 1);
    const packet = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(packet.id);

    takeHandler.step({ state, machine });

    expect(source.cursor).toBe(0);
  });

  it('blocks further packets once the count has already been reached', () => {
    const state = emptyState();
    const machine = addMachine(state, 'take', { x: 1, y: 0 }, 1);
    if (machine.kind === 'take') machine.internal.passed = 1;
    const packet = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(packet.id);

    const events = takeHandler.step({ state, machine });

    expect(events).toEqual([]);
    expect(machine.inputs[0].queue).toEqual([packet.id]);
    expect(machine.outputs[0].queue).toEqual([]);
  });

  it('resets its counter when the upstream source starts a fresh subscription', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { subscribed: true });
    addConveyor(state, { x: 1, y: 0 }, 'east');
    const machine = addMachine(state, 'take', { x: 2, y: 0 }, 5);
    if (machine.kind === 'take') {
      machine.internal.passed = 5;
      machine.internal.sourceWasSubscribed = false;
    }

    takeHandler.step({ state, machine });

    if (machine.kind === 'take') {
      expect(machine.internal.passed).toBe(0);
      expect(machine.internal.sourceWasSubscribed).toBe(true);
    }
  });

  it('does not reset the counter while the source stays subscribed across ticks', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { subscribed: true });
    addConveyor(state, { x: 1, y: 0 }, 'east');
    const machine = addMachine(state, 'take', { x: 2, y: 0 }, 5);
    if (machine.kind === 'take') {
      machine.internal.passed = 2;
      machine.internal.sourceWasSubscribed = true;
    }

    takeHandler.step({ state, machine });

    if (machine.kind === 'take') expect(machine.internal.passed).toBe(2);
  });

  it('still enforces the count when no upstream source can be found, without emitting an event', () => {
    const state = emptyState();
    const machine = addMachine(state, 'take', { x: 1, y: 0 }, 1);
    const packet = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(packet.id);

    const events = takeHandler.step({ state, machine });

    expect(events).toEqual([]);
    expect(machine.outputs[0].queue).toEqual([packet.id]);
    if (machine.kind === 'take') expect(machine.internal.passed).toBe(1);
  });

  it('does not re-emit sourceUnsubscribed when the source is already unsubscribed', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false });
    addConveyor(state, { x: 1, y: 0 }, 'east');
    const machine = addMachine(state, 'take', { x: 2, y: 0 }, 1);
    if (machine.kind === 'take') machine.internal.sourceWasSubscribed = false;
    const packet = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(packet.id);

    const events = takeHandler.step({ state, machine });

    expect(events).toEqual([]);
    expect(source.subscribed).toBe(false);
  });
});
