import { beforeEach, describe, expect, it } from 'vitest';
import { clearSeenIds, loadSeenIds, saveSeenIds } from './onboarding-save';

describe('onboarding-save', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty set when nothing has been saved', () => {
    expect(loadSeenIds()).toEqual(new Set());
  });

  it('round-trips a saved set of seen ids', () => {
    saveSeenIds(new Set(['welcome', 'first-conveyor']));

    expect(loadSeenIds()).toEqual(new Set(['welcome', 'first-conveyor']));
  });

  it('discards a save written under a different schema version', () => {
    localStorage.setItem(
      'conveyrx.onboarding.v1',
      JSON.stringify({ version: 999, seenIds: ['welcome'] }),
    );

    expect(loadSeenIds()).toEqual(new Set());
  });

  it('returns an empty set for corrupted JSON instead of throwing', () => {
    localStorage.setItem('conveyrx.onboarding.v1', 'not json');

    expect(() => loadSeenIds()).not.toThrow();
    expect(loadSeenIds()).toEqual(new Set());
  });

  it('clearSeenIds removes the save', () => {
    saveSeenIds(new Set(['welcome']));

    clearSeenIds();

    expect(loadSeenIds()).toEqual(new Set());
  });
});
