import { describe, expect, it } from 'vitest';
import { tryDeliverTo } from './delivery';
import type { SimEvent } from './events';
import { addPacket, addSink, emptyState } from '../testing/state-builder';

describe('tryDeliverTo', () => {
  it('delivers directly to the sink when the target cell is inside the base, even if empty', () => {
    const state = emptyState();
    const sink = addSink(state, { x: 5, y: 5 });
    state.base = { min: { x: 4, y: 4 }, max: { x: 6, y: 6 } };
    const packet = addPacket(state);
    const events: SimEvent[] = [];

    const delivered = tryDeliverTo(state, { x: 4, y: 4 }, packet.id, events);

    expect(delivered).toBe(true);
    expect(sink.input.queue).toContain(packet.id);
    expect(events).toEqual([{ type: 'packetMoved', packetId: packet.id, position: sink.position }]);
  });

  it('respects sink backpressure even via base auto-delivery', () => {
    const state = emptyState();
    const sink = addSink(state, { x: 5, y: 5 }, { capacity: 1 });
    state.base = { min: { x: 4, y: 4 }, max: { x: 6, y: 6 } };
    sink.input.queue.push(999);
    const packet = addPacket(state);

    const delivered = tryDeliverTo(state, { x: 4, y: 4 }, packet.id, []);

    expect(delivered).toBe(false);
  });

  it('falls back to normal cell lookup outside the base', () => {
    const state = emptyState();
    addSink(state, { x: 5, y: 5 });
    state.base = { min: { x: 4, y: 4 }, max: { x: 6, y: 6 } };

    const delivered = tryDeliverTo(state, { x: 0, y: 0 }, 1, []);

    expect(delivered).toBe(false);
  });
});
