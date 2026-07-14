import { describe, expect, it } from 'vitest';
import { filterHandler } from './filter';
import { addConveyor, addMachine, addPacket, emptyState } from '../testing/state-builder';

describe('filterHandler', () => {
  it('passes a packet matching the kept material straight through, unchanged', () => {
    const state = emptyState();
    const machine = addMachine(state, 'filter', { x: 1, y: 0 }, ['carbon']);
    const packet = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(packet.id);

    const events = filterHandler.step({ state, machine });

    expect(events).toEqual([]);
    expect(machine.inputs[0].queue).toEqual([]);
    expect(machine.outputs[0].queue).toEqual([packet.id]);
    expect(state.packets[packet.id].material).toBe('carbon');
  });

  it('passes a packet matching any of several allowed materials', () => {
    const state = emptyState();
    const machine = addMachine(state, 'filter', { x: 1, y: 0 }, ['carbon', 'ice']);
    const packet = addPacket(state, 'ice');
    machine.inputs[0].queue.push(packet.id);

    const events = filterHandler.step({ state, machine });

    expect(events).toEqual([]);
    expect(machine.outputs[0].queue).toEqual([packet.id]);
  });

  it('discards a packet that does not match, reporting it as despawned', () => {
    const state = emptyState();
    const machine = addMachine(state, 'filter', { x: 1, y: 0 }, ['carbon']);
    const packet = addPacket(state, 'slag');
    machine.inputs[0].queue.push(packet.id);

    const events = filterHandler.step({ state, machine });

    expect(events).toEqual([{ type: 'packetDespawned', packetId: packet.id }]);
    expect(machine.inputs[0].queue).toEqual([]);
    expect(machine.outputs[0].queue).toEqual([]);
    expect(state.packets[packet.id]).toBeUndefined();
  });

  it('drains a kept packet onto the conveyor it faces', () => {
    const state = emptyState();
    const machine = addMachine(state, 'filter', { x: 1, y: 0 }, ['carbon']);
    const conveyor = addConveyor(state, { x: 2, y: 0 }, 'east');
    const packet = addPacket(state, 'carbon');
    machine.outputs[0].queue.push(packet.id);

    const events = filterHandler.step({ state, machine });

    expect(machine.outputs[0].queue).toEqual([]);
    expect(conveyor.slot).toBe(packet.id);
    expect(events).toEqual([
      { type: 'packetMoved', packetId: packet.id, position: { x: 2, y: 0 } },
    ]);
  });

  it('holds a kept packet at the input while the output port is full', () => {
    const state = emptyState();
    const machine = addMachine(state, 'filter', { x: 1, y: 0 }, ['carbon']);
    machine.outputs[0].queue.push(addPacket(state, 'carbon').id);
    const waiting = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(waiting.id);

    filterHandler.step({ state, machine });

    expect(machine.inputs[0].queue).toEqual([waiting.id]);
  });

  it('does nothing when idle', () => {
    const state = emptyState();
    const machine = addMachine(state, 'filter', { x: 1, y: 0 }, ['carbon']);

    expect(filterHandler.step({ state, machine })).toEqual([]);
  });
});
