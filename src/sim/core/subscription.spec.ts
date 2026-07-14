import { describe, expect, it } from 'vitest';
import { setSourceKind, toggleSubscribe } from './subscription';
import { addSource, emptyState } from '../testing/state-builder';
import { SOURCE_KINDS } from '../content/source-kinds';

describe('toggleSubscribe', () => {
  it('flips subscribed off then on', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false });

    toggleSubscribe(state, source.id);
    expect(source.subscribed).toBe(true);

    toggleSubscribe(state, source.id);
    expect(source.subscribed).toBe(false);
  });

  it('resets cursor and timers when transitioning to unsubscribed, so of/from always replay fresh', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: true });
    source.cursor = 2;
    source.ticksSinceLastSpawn = 15;

    toggleSubscribe(state, source.id);

    expect(source.cursor).toBe(0);
    expect(source.ticksSinceLastSpawn).toBe(0);
  });

  it('leaves in-progress counters untouched when transitioning to subscribed', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false });
    source.cursor = 2;

    toggleSubscribe(state, source.id);

    expect(source.cursor).toBe(2);
  });
});

describe('setSourceKind', () => {
  it("charges the target kind's upgrade cost and switches kind while unsubscribed", () => {
    const state = emptyState(8, 4, 100);
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false, kind: 'of' });

    const result = setSourceKind(state, source.id, 'from');

    expect(result).toEqual({ ok: true });
    expect(source.kind).toBe('from');
    expect(state.economy.cash).toBe(100 - SOURCE_KINDS.from.upgradeCost);
  });

  it('resets the sequence when the kind changes', () => {
    const state = emptyState(8, 4, 100);
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false });
    source.cursor = 2;

    setSourceKind(state, source.id, 'from');

    expect(source.cursor).toBe(0);
  });

  it('refuses to switch while subscribed', () => {
    const state = emptyState(8, 4, 100);
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: true, kind: 'of' });

    const result = setSourceKind(state, source.id, 'from');

    expect(result).toEqual({ ok: false, reason: 'subscribed' });
    expect(source.kind).toBe('of');
  });

  it('refuses when the player cannot afford it, leaving cash and kind untouched', () => {
    const state = emptyState(8, 4, 0);
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false, kind: 'of' });

    const result = setSourceKind(state, source.id, 'from');

    expect(result).toEqual({ ok: false, reason: 'insufficient-cash' });
    expect(source.kind).toBe('of');
    expect(state.economy.cash).toBe(0);
  });

  it('is a no-op reported as unchanged when selecting the current kind', () => {
    const state = emptyState(8, 4, 100);
    const source = addSource(state, { x: 0, y: 0 }, { subscribed: false, kind: 'of' });

    const result = setSourceKind(state, source.id, 'of');

    expect(result).toEqual({ ok: false, reason: 'unchanged' });
    expect(state.economy.cash).toBe(100);
  });
});
