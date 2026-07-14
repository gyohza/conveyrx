import { describe, expect, it } from 'vitest';
import { stepSource } from './source';
import { addConveyor, addSource, emptyState } from '../testing/state-builder';
import { SOURCE_KINDS } from '../content/source-kinds';
import { SUBSCRIPTION_UPKEEP_PER_TICK } from '../content/economy';

describe('stepSource', () => {
  it('produces nothing while unsubscribed, even past its rate interval', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false });

    for (let i = 0; i < SOURCE_KINDS.of.rateTicks + 5; i++) stepSource(state, source);

    expect(source.output.queue).toEqual([]);
    expect(state.economy.cash).toBe(100);
  });

  it('does not spawn before its rate interval has elapsed', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 });

    const events = stepSource(state, source);

    expect(events.filter((e) => e.type === 'packetSpawned')).toEqual([]);
    expect(source.output.queue).toEqual([]);
  });

  it('spawns a packet of its configured material once the rate interval elapses', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { sequence: ['carbon'] });

    for (let i = 0; i < SOURCE_KINDS.of.rateTicks; i++) stepSource(state, source);

    const packetId = source.output.queue[0];
    expect(state.packets[packetId]).toMatchObject({ material: 'carbon' });
  });

  it("stops emitting once it has produced its kind's full sequence, while remaining subscribed", () => {
    const state = emptyState(20, 4, 1000);
    // Output large enough to hold the whole sequence, so backpressure never masks completion.
    const source = addSource(
      state,
      { x: 0, y: 0 },
      {
        outputCapacity: SOURCE_KINDS.of.sequenceLength,
      },
    );

    const totalTicks = SOURCE_KINDS.of.rateTicks * (SOURCE_KINDS.of.sequenceLength + 3);
    let spawnCount = 0;
    for (let i = 0; i < totalTicks; i++) {
      spawnCount += stepSource(state, source).filter((e) => e.type === 'packetSpawned').length;
    }

    expect(spawnCount).toBe(SOURCE_KINDS.of.sequenceLength);
    expect(source.subscribed).toBe(true); // still subscribed — completion isn't the same as off
  });

  it('charges upkeep every single tick while subscribed, whether or not it is producing', () => {
    const state = emptyState(20, 4, 1000);
    const source = addSource(state, { x: 0, y: 0 });
    const cashBefore = state.economy.cash;

    for (let i = 0; i < 10; i++) stepSource(state, source);

    expect(state.economy.cash).toBeCloseTo(cashBefore - SUBSCRIPTION_UPKEEP_PER_TICK * 10, 10);
  });

  it('charges no upkeep at all while unsubscribed', () => {
    const state = emptyState(20, 4, 1000);
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false });
    const cashBefore = state.economy.cash;

    for (let i = 0; i < 200; i++) stepSource(state, source);

    expect(state.economy.cash).toBe(cashBefore);
  });

  it('holds the spawn (without losing its place) while its output is still occupied', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 });

    for (let i = 0; i < SOURCE_KINDS.of.rateTicks; i++) stepSource(state, source); // spawns; output full
    const events = stepSource(state, source);

    expect(events.filter((e) => e.type === 'packetSpawned')).toEqual([]);
    expect(source.output.queue).toHaveLength(1);
  });

  it('drains its waiting packet onto an adjacent conveyor in its facing direction', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 });
    const conveyor = addConveyor(state, { x: 1, y: 0 }, 'east');

    for (let i = 0; i < SOURCE_KINDS.of.rateTicks; i++) stepSource(state, source); // spawn onto own output
    const events = stepSource(state, source); // drain to conveyor

    const movedEvent = events.find((e) => e.type === 'packetMoved');
    expect(conveyor.slot).not.toBeNull();
    expect(movedEvent).toEqual({
      type: 'packetMoved',
      packetId: conveyor.slot,
      position: { x: 1, y: 0 },
    });
  });
});
