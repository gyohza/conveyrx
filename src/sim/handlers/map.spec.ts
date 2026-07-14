import { describe, expect, it } from 'vitest';
import { mapHandler } from './map';
import { addConveyor, addMachine, addPacket, emptyState } from '../testing/state-builder';
import { RECIPES } from '../content/recipes';

describe('mapHandler', () => {
  it("transforms a packet matching the recipe's input material and reports the transformation", () => {
    const state = emptyState();
    const machine = addMachine(state, 'map', { x: 1, y: 0 }, 'crystallize');
    const packet = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(packet.id);

    const events = mapHandler.step({ state, machine });

    expect(state.packets[packet.id].material).toBe(RECIPES.crystallize.to);
    expect(machine.inputs[0].queue).toEqual([]);
    expect(machine.outputs[0].queue).toEqual([packet.id]);
    expect(events).toEqual([
      { type: 'packetTransformed', packetId: packet.id, material: RECIPES.crystallize.to },
    ]);
  });

  it("leaves a packet whose material doesn't match the recipe's input untouched (stall, not loss)", () => {
    const state = emptyState();
    const machine = addMachine(state, 'map', { x: 1, y: 0 }, 'crystallize');
    const packet = addPacket(state, 'diamond'); // already the recipe's output, not its input
    machine.inputs[0].queue.push(packet.id);

    const events = mapHandler.step({ state, machine });

    expect(events).toEqual([]);
    expect(machine.inputs[0].queue).toEqual([packet.id]);
    expect(state.packets[packet.id].material).toBe('diamond');
  });

  it('drains a finished packet onto the conveyor it faces', () => {
    const state = emptyState();
    const machine = addMachine(state, 'map', { x: 1, y: 0 }, 'crystallize');
    const conveyor = addConveyor(state, { x: 2, y: 0 }, 'east');
    const packet = addPacket(state, 'diamond');
    machine.outputs[0].queue.push(packet.id);

    const events = mapHandler.step({ state, machine });

    expect(machine.outputs[0].queue).toEqual([]);
    expect(conveyor.slot).toBe(packet.id);
    expect(events).toEqual([
      { type: 'packetMoved', packetId: packet.id, position: { x: 2, y: 0 } },
    ]);
  });

  it('holds the finished packet when nothing downstream can accept it (stall, not loss)', () => {
    const state = emptyState();
    const machine = addMachine(state, 'map', { x: 1, y: 0 }, 'crystallize');
    const packet = addPacket(state, 'diamond');
    machine.outputs[0].queue.push(packet.id);

    const events = mapHandler.step({ state, machine });

    expect(events).toEqual([]);
    expect(machine.outputs[0].queue).toEqual([packet.id]);
  });

  it('leaves the input packet untouched while the output port is occupied', () => {
    const state = emptyState();
    const machine = addMachine(state, 'map', { x: 1, y: 0 }, 'crystallize');
    machine.outputs[0].queue.push(addPacket(state, 'diamond').id);
    const waiting = addPacket(state, 'carbon');
    machine.inputs[0].queue.push(waiting.id);

    mapHandler.step({ state, machine });

    expect(machine.inputs[0].queue).toEqual([waiting.id]);
    expect(state.packets[waiting.id].material).toBe('carbon');
  });

  it('does nothing when idle', () => {
    const state = emptyState();
    const machine = addMachine(state, 'map', { x: 1, y: 0 }, 'crystallize');

    expect(mapHandler.step({ state, machine })).toEqual([]);
  });
});
