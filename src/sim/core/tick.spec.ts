import { describe, expect, it } from 'vitest';
import { stepN, tick } from './tick';
import { place } from './editing';
import { toggleSubscribe } from './subscription';
import { SUBSCRIPTION_UPKEEP_PER_TICK } from '../content/economy';
import { MATERIALS } from '../content/materials';
import { SOURCE_KINDS } from '../content/source-kinds';
import { STAGE1_MINES, createStage1State } from '../content/stage1-layout';
import type { SimState } from './state';

// Wires the stage 1 anchors together: a source built on the first mine → conveyors → map
// machine → conveyor feeding the base's one entry, then subscribes the source (nothing runs
// until that happens).
function buildWorkingLine(): SimState {
  const state = createStage1State();
  state.economy.cash = 1000;
  const minePos = STAGE1_MINES[0].position;
  place(state, { type: 'source' }, minePos);
  const sourceId = Object.values(state.sources)[0].id;
  const y = minePos.y;
  const machineX = 5;
  for (let x = minePos.x + 1; x < state.base.min.x; x++) {
    place(state, { type: 'conveyor', direction: 'east' }, { x, y });
    if (x === machineX) {
      place(state, { type: 'machine', kind: 'map' }, { x, y });
    }
  }
  toggleSubscribe(state, sourceId);
  return state;
}

describe('tick / stepN — full player-built pipeline', () => {
  it('does nothing at all while the source is unsubscribed', () => {
    const state = createStage1State(); // starts unsubscribed
    const cashBefore = state.economy.cash;

    stepN(state, SOURCE_KINDS.from.rateTicks * 2, { collectEvents: false });

    expect(state.economy.cash).toBe(cashBefore);
    expect(Object.keys(state.packets)).toHaveLength(0);
  });

  it('carries packets from source through the map machine to the sink, converting carbon to diamond', () => {
    const state = buildWorkingLine();
    const cashBefore = state.economy.cash;

    // The full sequence (the first mine's yield) plus enough ticks for the last one to transit.
    stepN(state, SOURCE_KINDS.from.rateTicks * STAGE1_MINES[0].sequence.length + 40, {
      collectEvents: false,
    });

    // Each sale is worth the diamond price; the tiny upkeep drain is far smaller than the
    // income from even one sale, so cash must have grown substantially.
    expect(state.economy.cash).toBeGreaterThan(cashBefore + MATERIALS.diamond.sellPrice * 2);
    expect(Object.keys(state.packets)).toHaveLength(0);
    expect(Object.values(state.conveyors).every((c) => c.slot === null)).toBe(true);
  });

  it('emits a packetSpawned event exactly when the source produces its first packet', () => {
    const state = buildWorkingLine();

    const { events } = stepN(state, SOURCE_KINDS.from.rateTicks);

    expect(events.filter((e) => e.type === 'packetSpawned')).toHaveLength(1);
  });

  it('stalls all the way back to the source when the line is disconnected mid-way, and still leaks upkeep', () => {
    const state = createStage1State();
    state.economy.cash = 1000;
    const minePos = STAGE1_MINES[0].position;
    place(state, { type: 'source' }, minePos);
    const sourceId = Object.values(state.sources)[0].id;
    // A dead-end conveyor: source drains onto it, then everything jams.
    place(state, { type: 'conveyor', direction: 'east' }, { x: minePos.x + 1, y: minePos.y });
    toggleSubscribe(state, sourceId);
    const cashAfterBuilding = state.economy.cash;

    // Past the second spawn (which jams in the source's own output, since the dead-end
    // conveyor is already occupied by the first), well before a third would be attempted.
    const ticks = SOURCE_KINDS.from.rateTicks * 2 + 5;
    stepN(state, ticks, { collectEvents: false });

    // One packet stuck on the belt, one waiting in the source output — no more spawns fit.
    expect(Object.keys(state.packets)).toHaveLength(2);
    // A disconnected line earns nothing, so the only change is `ticks` worth of upkeep.
    expect(state.economy.cash).toBeCloseTo(
      cashAfterBuilding - SUBSCRIPTION_UPKEEP_PER_TICK * ticks,
      10,
    );
  });

  it('produces identical results stepped one tick at a time or via a single stepN call (determinism)', () => {
    const singleStepped = buildWorkingLine();
    for (let i = 0; i < 100; i++) tick(singleStepped);

    const batched = buildWorkingLine();
    stepN(batched, 100, { collectEvents: false });

    expect(batched).toEqual(singleStepped);
  });
});
