import { SOURCE_KINDS } from '../content/source-kinds';
import type { SourceKind } from '../content/source-kinds';
import type { SimState } from './state';
import type { EntityId } from './types';

export function resetSequence(source: { cursor: number; ticksSinceLastSpawn: number }): void {
  source.cursor = 0;
  source.ticksSinceLastSpawn = 0;
}

export function toggleSubscribe(state: SimState, sourceId: EntityId): void {
  const source = state.sources[sourceId];
  if (!source) return;
  source.subscribed = !source.subscribed;
  if (!source.subscribed) resetSequence(source);
}

export type SetSourceKindResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'subscribed' | 'insufficient-cash' | 'unchanged' };

export function setSourceKind(
  state: SimState,
  sourceId: EntityId,
  kind: SourceKind,
): SetSourceKindResult {
  const source = state.sources[sourceId];
  if (!source) return { ok: false, reason: 'not-found' };
  if (source.subscribed) return { ok: false, reason: 'subscribed' };
  if (source.kind === kind) return { ok: false, reason: 'unchanged' };

  const cost = SOURCE_KINDS[kind].upgradeCost;
  if (state.economy.cash < cost) return { ok: false, reason: 'insufficient-cash' };

  state.economy.cash -= cost;
  source.kind = kind;
  resetSequence(source);
  return { ok: true };
}
