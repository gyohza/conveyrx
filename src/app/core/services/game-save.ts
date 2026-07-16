import type { SimState } from '@sim/core/state';

const SAVE_KEY = 'conveyrx.save.v1';
const SAVE_VERSION = 2;

interface SavePayload {
  version: number;
  state: SimState;
}

export function saveGame(state: SimState): void {
  try {
    const payload: SavePayload = { version: SAVE_VERSION, state };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    /* quota exceeded or storage disabled; losing the autosave isn't worth crashing over */
  }
}

export function loadGame(): SimState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as SavePayload;
    return payload.version === SAVE_VERSION ? payload.state : null;
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* empty */
  }
}
