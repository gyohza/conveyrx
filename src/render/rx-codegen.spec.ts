import { describe, expect, it } from 'vitest';
import {
  declareAllSources,
  declareSource,
  sourceVarName,
  subVarName,
  subscribeStatement,
  unsubscribeStatement,
} from './rx-codegen';
import {
  addConveyor,
  addMachine,
  addSink,
  addSource,
  emptyState,
} from '@sim/testing/state-builder';
import type { MaterialId } from '@sim/content/materials';

function carbons(n: number): MaterialId[] {
  return Array.from({ length: n }, () => 'carbon');
}

describe('declareAllSources', () => {
  it('invites building a source when the board is empty', () => {
    expect(declareAllSources(emptyState())).toContain('from');
  });

  it('shows just the from() declaration for a source with nothing built downstream', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { sequence: carbons(3) });

    expect(declareAllSources(state)).toBe('const carbon$ = from([⚫, ⚫, ⚫]);');
  });

  it('adds a .pipe(map(...)) stage for a machine encountered along the way', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { sequence: carbons(2) });
    addConveyor(state, { x: 1, y: 0 }, 'east');
    addMachine(state, 'map', { x: 2, y: 0 });

    const code = declareAllSources(state);

    expect(code).toContain('.pipe(');
    expect(code).toContain('map(carbon => new Diamond(carbon))');
  });

  it('represents a filter machine as a filter() predicate', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { sequence: ['carbon', 'slag'] });
    addConveyor(state, { x: 1, y: 0 }, 'east');
    addMachine(state, 'filter', { x: 2, y: 0 }, ['carbon']);

    expect(declareAllSources(state)).toContain('filter(value => value instanceof Carbon)');
  });

  it('represents a filter allowing several materials as an "any of" predicate', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { sequence: ['carbon', 'ice'] });
    addConveyor(state, { x: 1, y: 0 }, 'east');
    addMachine(state, 'filter', { x: 2, y: 0 }, ['carbon', 'ice']);

    expect(declareAllSources(state)).toContain(
      'filter(value => [Carbon, Ice].some(T => value instanceof T))',
    );
  });

  it('names a mixed-material source generically ("ore") instead of after one material', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { sequence: ['carbon', 'slag', 'carbon'] });

    expect(declareAllSources(state)).toContain('const ore$ = from([⚫, 🟤, ⚫]);');
  });

  it('wraps a long emission array onto multiple lines', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { sequence: carbons(20) });

    const code = declareAllSources(state);

    expect(code).toContain('[\n');
    expect(code.split('\n').every((line) => line.length <= 60)).toBe(true);
  });

  it('numbers variable names once more than one source exists', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { sequence: carbons(1) });
    addSource(state, { x: 0, y: 1 }, { sequence: carbons(1) });

    const code = declareAllSources(state);

    expect(code).toContain('carbon1$');
    expect(code).toContain('carbon2$');
  });
});

describe('sourceVarName / subVarName', () => {
  it('stay unnumbered with a single source', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { sequence: carbons(1) });

    expect(sourceVarName(state, source)).toBe('carbon$');
    expect(subVarName(state, source)).toBe('sub');
  });

  it('number both names in step, once more than one source exists', () => {
    const state = emptyState();
    addSource(state, { x: 0, y: 0 }, { sequence: carbons(1) });
    const second = addSource(state, { x: 0, y: 1 }, { sequence: carbons(1) });

    expect(sourceVarName(state, second)).toBe('carbon2$');
    expect(subVarName(state, second)).toBe('sub2');
  });
});

describe('subscribeStatement / unsubscribeStatement', () => {
  it('declares with `let` the first time, and consumes into the sink it reaches', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { sequence: carbons(1) });
    addConveyor(state, { x: 1, y: 0 }, 'east');
    addSink(state, { x: 2, y: 0 });

    const line = subscribeStatement(state, source, 'carbon$', 'sub', true);

    expect(line).toBe('let sub = carbon$.subscribe(value => subscriber.sell(value));');
  });

  it('reassigns without `let` on subsequent subscriptions', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { sequence: carbons(1) });

    const line = subscribeStatement(state, source, 'carbon$', 'sub', false);

    expect(line).toBe('sub = carbon$.subscribe();');
  });

  it('subscribes with an empty callback when no sink is reachable yet', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { sequence: carbons(1) });

    const line = subscribeStatement(state, source, 'carbon$', 'sub', true);

    expect(line).toBe('let sub = carbon$.subscribe();');
  });

  it('renders the unsubscribe call against the given subscription variable', () => {
    expect(unsubscribeStatement('sub')).toBe('sub.unsubscribe();');
  });
});

describe('declareSource', () => {
  it('names a single-machine chain and a multi-machine chain identically to declareAllSources', () => {
    const state = emptyState();
    const source = addSource(state, { x: 0, y: 0 }, { sequence: carbons(2) });

    expect(declareSource(state, source, 'carbon$')).toBe('const carbon$ = from([⚫, ⚫]);');
  });
});
