import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { tick as tickSim } from '@sim/core/tick';
import { stepBaseEdge } from '@sim/core/base';
import type { BaseEdge } from '@sim/core/base';
import {
  canPlace,
  clearAll,
  erase,
  place,
  reconfigureMachine,
  redirectConveyor,
} from '@sim/core/editing';
import type {
  BuildRequest,
  ConfigUpdate,
  EraseResult,
  PlaceResult,
  ReconfigureResult,
} from '@sim/core/editing';
import { findEntityAt } from '@sim/core/grid';
import type { SimEvent } from '@sim/core/events';
import type { SimState } from '@sim/core/state';
import type { Direction, EntityId, GridPos } from '@sim/core/types';
import { setSourceKind, toggleSubscribe } from '@sim/core/subscription';
import type { SetSourceKindResult } from '@sim/core/subscription';
import type { SourceKind } from '@sim/content/source-kinds';
import { createStage1State } from '@sim/content/stage1-layout';
import { loadGame, saveGame } from './game-save';

export interface SourceSubscriptionChange {
  sourceId: EntityId;
  subscribed: boolean;
}

const HISTORY_LIMIT = 10;

@Injectable({ providedIn: 'root' })
export class SimEngineService {
  private readonly stateSignal = signal<SimState>(loadGame() ?? createStage1State());
  /** tick()/place()/erase() mutate entities in place, so a `SimState` read before one of those calls is stale afterwards — always re-read `state()` rather than holding a reference. */
  readonly state = this.stateSignal.asReadonly();
  readonly events = new Subject<SimEvent[]>();
  readonly layoutChanged = new Subject<void>();
  readonly sourceSubscriptionChanged = new Subject<SourceSubscriptionChange>();
  readonly historyRestored = new Subject<void>();

  private readonly undoStack = signal<SimState[]>([]);
  private readonly redoStack = signal<SimState[]>([]);
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  tick(): void {
    const { state, events } = tickSim(this.stateSignal());
    this.publish(state);
    if (events.length > 0) {
      this.events.next(events);
    }
  }

  place(request: BuildRequest, pos: GridPos): PlaceResult {
    const state = this.stateSignal();
    const before = structuredClone(state);
    const result = place(state, request, pos);
    if (result.ok) {
      this.pushUndo(before);
      if (result.events && result.events.length > 0) this.events.next(result.events);
      this.publish(state);
      this.layoutChanged.next();
    }
    return result;
  }

  reconfigureMachine(pos: GridPos, update: ConfigUpdate): ReconfigureResult {
    const state = this.stateSignal();
    const before = structuredClone(state);
    const result = reconfigureMachine(state, pos, update);
    if (result.ok) {
      this.pushUndo(before);
      this.publish(state);
      this.layoutChanged.next();
    }
    return result;
  }

  redirectConveyor(pos: GridPos, direction: Direction): boolean {
    const state = this.stateSignal();
    const before = structuredClone(state);
    const changed = redirectConveyor(state, pos, direction);
    if (changed) {
      this.pushUndo(before);
      this.publish(state);
      this.layoutChanged.next();
    }
    return changed;
  }

  resizeBaseEdge(edge: BaseEdge, direction: 1 | -1): boolean {
    const state = this.stateSignal();
    const before = structuredClone(state);
    const moved = stepBaseEdge(state, edge, direction);
    if (moved) {
      this.pushUndo(before);
      this.publish(state);
      this.layoutChanged.next();
    }
    return moved;
  }

  erase(pos: GridPos): EraseResult {
    const state = this.stateSignal();
    const before = structuredClone(state);
    const result = erase(state, pos);
    if (result.ok) {
      this.pushUndo(before);
      if (result.events.length > 0) this.events.next(result.events);
      this.publish(state);
      this.layoutChanged.next();
    }
    return result;
  }

  clearAll(): number {
    const state = this.stateSignal();
    const before = structuredClone(state);
    const { refund, events } = clearAll(state);
    if (refund > 0 || events.length > 0) {
      this.pushUndo(before);
      if (events.length > 0) this.events.next(events);
      this.publish(state);
      this.layoutChanged.next();
    }
    return refund;
  }

  resetGame(): void {
    const fresh = createStage1State();
    this.stateSignal.set(fresh);
    this.undoStack.set([]);
    this.redoStack.set([]);
    saveGame(fresh);
    this.layoutChanged.next();
    this.historyRestored.next();
  }

  toggleSubscribe(sourceId: EntityId): void {
    const state = this.stateSignal();
    const before = structuredClone(state);
    toggleSubscribe(state, sourceId);
    this.pushUndo(before);
    this.publish(state);
    this.sourceSubscriptionChanged.next({
      sourceId,
      subscribed: state.sources[sourceId].subscribed,
    });
  }

  undo(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1];
    this.undoStack.set(stack.slice(0, -1));
    this.redoStack.update((redo) => [...redo, structuredClone(this.stateSignal())]);
    this.stateSignal.set(previous);
    saveGame(previous);
    this.layoutChanged.next();
    this.historyRestored.next();
  }

  redo(): void {
    const stack = this.redoStack();
    if (stack.length === 0) return;
    const next = stack[stack.length - 1];
    this.redoStack.set(stack.slice(0, -1));
    this.undoStack.update((undo) =>
      this.capHistory([...undo, structuredClone(this.stateSignal())]),
    );
    this.stateSignal.set(next);
    saveGame(next);
    this.layoutChanged.next();
    this.historyRestored.next();
  }

  private pushUndo(before: SimState): void {
    this.undoStack.update((stack) => this.capHistory([...stack, before]));
    this.redoStack.set([]);
  }

  private capHistory(stack: SimState[]): SimState[] {
    return stack.length > HISTORY_LIMIT ? stack.slice(stack.length - HISTORY_LIMIT) : stack;
  }

  setSourceKind(sourceId: EntityId, kind: SourceKind): SetSourceKindResult {
    const state = this.stateSignal();
    const result = setSourceKind(state, sourceId, kind);
    if (result.ok) this.publish(state);
    return result;
  }

  canPlace(request: BuildRequest, pos: GridPos): boolean {
    return canPlace(this.stateSignal(), request, pos).ok;
  }

  canErase(pos: GridPos): boolean {
    const target = findEntityAt(this.stateSignal(), pos);
    return target !== undefined && target.kind !== 'sink';
  }

  private publish(state: SimState): void {
    state.economy.peakCash = Math.max(state.economy.peakCash, state.economy.cash);
    this.stateSignal.set({ ...state });
    saveGame(state);
  }
}
