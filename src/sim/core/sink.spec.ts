import { describe, expect, it } from 'vitest';
import { stepSink } from './sink';
import { addPacket, addSink, emptyState } from '../testing/state-builder';
import { MATERIALS } from '../content/materials';

describe('stepSink', () => {
  it("converts every queued packet into cash at its material's sell price and removes it from the world", () => {
    const state = emptyState();
    const sink = addSink(state, { x: 0, y: 0 });
    const carbon = addPacket(state, 'carbon');
    const diamond = addPacket(state, 'diamond');
    sink.input.queue.push(carbon.id, diamond.id);

    const events = stepSink(state, sink);

    expect(state.economy.cash).toBe(100 + MATERIALS.carbon.sellPrice + MATERIALS.diamond.sellPrice);
    expect(state.packets[carbon.id]).toBeUndefined();
    expect(sink.input.queue).toEqual([]);
    expect(events).toEqual([
      { type: 'packetDespawned', packetId: carbon.id },
      { type: 'packetDespawned', packetId: diamond.id },
    ]);
    expect(state.economy.saleCount).toBe(2);
  });

  it('routes packets to research instead of cash for a research sink, without counting it as a sale', () => {
    const state = emptyState();
    const sink = addSink(state, { x: 0, y: 0 }, { sinkType: 'research' });
    sink.input.queue.push(addPacket(state, 'diamond').id);

    stepSink(state, sink);

    expect(state.economy.research).toBe(MATERIALS.diamond.sellPrice);
    expect(state.economy.cash).toBe(100);
    expect(state.economy.saleCount).toBe(0);
  });

  it('does nothing when the input port is empty', () => {
    const state = emptyState();
    const sink = addSink(state, { x: 0, y: 0 });

    expect(stepSink(state, sink)).toEqual([]);
  });
});
