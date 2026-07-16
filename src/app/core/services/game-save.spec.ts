import { beforeEach, describe, expect, it } from 'vitest';
import { clearSavedGame, loadGame, saveGame } from './game-save';
import { createStage1State } from '@sim/content/stage1-layout';

describe('game-save', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing has been saved', () => {
    expect(loadGame()).toBeNull();
  });

  it('round-trips a saved state', () => {
    const state = createStage1State();
    state.economy.cash = 42;

    saveGame(state);

    expect(loadGame()).toEqual(state);
  });

  it('discards a save written under a different schema version', () => {
    localStorage.setItem(
      'conveyrx.save.v1',
      JSON.stringify({ version: 999, state: createStage1State() }),
    );

    expect(loadGame()).toBeNull();
  });

  it('returns null for corrupted JSON instead of throwing', () => {
    localStorage.setItem('conveyrx.save.v1', 'not json');

    expect(() => loadGame()).not.toThrow();
    expect(loadGame()).toBeNull();
  });

  it('clearSavedGame removes the save', () => {
    saveGame(createStage1State());

    clearSavedGame();

    expect(loadGame()).toBeNull();
  });
});
