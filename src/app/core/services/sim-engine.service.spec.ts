import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimEngineService } from './sim-engine.service';
import { CONVEYOR_COST, START_CASH } from '@sim/content/economy';
import { RECIPES } from '@sim/content/recipes';
import { STAGE1_MINES } from '@sim/content/stage1-layout';

const CONVEYOR_EAST = { type: 'conveyor', direction: 'east' } as const;
const MAP = { type: 'machine', kind: 'map', recipeId: 'crystallize' } as const;

describe('SimEngineService', () => {
  // A fresh SimEngineService loads any autosaved game from localStorage — clear it first so
  // every test actually starts from the stage 1 default, not a previous test's leftover save.
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts from the stage 1 layout with the starting cash and no player buildings', () => {
    const engine = TestBed.inject(SimEngineService);

    expect(engine.state().economy.cash).toBe(START_CASH);
    expect(Object.keys(engine.state().conveyors)).toHaveLength(0);
  });

  it('advances the simulation by one tick and publishes a fresh state reference', () => {
    const engine = TestBed.inject(SimEngineService);
    const stateBeforeTick = engine.state();
    const tickCountBefore = stateBeforeTick.tick;

    engine.tick();

    // tick() mutates entities in place, so the tick count must be captured as a primitive
    // above — the stateBeforeTick object reference itself is now stale.
    expect(engine.state().tick).toBe(tickCountBefore + 1);
    expect(engine.state()).not.toBe(stateBeforeTick);
  });

  it('emits on the events stream only when the tick actually produced events', () => {
    const engine = TestBed.inject(SimEngineService);
    const emitted: unknown[] = [];
    engine.events.subscribe((events) => emitted.push(events));

    engine.tick(); // stage 1's source has a long spawn interval, so tick 1 is silent

    expect(emitted).toEqual([]);
  });

  describe('grid editing', () => {
    it('places a building, charges for it, and announces the layout change', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);

      const result = engine.place(CONVEYOR_EAST, { x: 3, y: 1 });

      expect(result.ok).toBe(true);
      expect(engine.state().economy.cash).toBe(START_CASH - CONVEYOR_COST);
      expect(layoutSpy).toHaveBeenCalledTimes(1);
    });

    it('does not announce a layout change for a rejected placement', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);

      const result = engine.place(CONVEYOR_EAST, { x: -1, y: 0 });

      expect(result.ok).toBe(false);
      expect(layoutSpy).not.toHaveBeenCalled();
    });

    it('erases a building, refunds it, and announces the layout change', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });

      const result = engine.erase({ x: 3, y: 1 });

      expect(result.ok).toBe(true);
      expect(engine.state().economy.cash).toBe(START_CASH);
    });

    it('reports erasability: player buildings yes, the sink anchor and empty cells no', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      const sinkPos = Object.values(engine.state().sinks)[0].position;

      expect(engine.canErase({ x: 3, y: 1 })).toBe(true);
      expect(engine.canErase(sinkPos)).toBe(false);
      expect(engine.canErase({ x: 4, y: 1 })).toBe(false);
    });

    it('reports placement validity without mutating', () => {
      const engine = TestBed.inject(SimEngineService);

      expect(engine.canPlace(CONVEYOR_EAST, { x: 3, y: 1 })).toBe(true);
      expect(engine.state().economy.cash).toBe(START_CASH);
    });

    it('redirects an existing conveyor at no cost and announces the layout change', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      engine.layoutChanged.subscribe(layoutSpy);
      const cashBefore = engine.state().economy.cash;

      const changed = engine.redirectConveyor({ x: 3, y: 1 }, 'south');

      expect(changed).toBe(true);
      expect(Object.values(engine.state().conveyors)[0].direction).toBe('south');
      expect(engine.state().economy.cash).toBe(cashBefore);
      expect(layoutSpy).toHaveBeenCalledTimes(1);
    });

    it('does not announce a layout change when there is nothing to redirect', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);

      expect(engine.redirectConveyor({ x: 3, y: 1 }, 'south')).toBe(false);
      expect(layoutSpy).not.toHaveBeenCalled();
    });

    it('clears every conveyor and machine, refunds them, and announces the layout change', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      const cashAfterBuilding = engine.state().economy.cash;
      engine.layoutChanged.subscribe(layoutSpy);

      const refund = engine.clearAll();

      expect(refund).toBe(CONVEYOR_COST);
      expect(engine.state().economy.cash).toBe(cashAfterBuilding + CONVEYOR_COST);
      expect(Object.keys(engine.state().conveyors)).toHaveLength(0);
      expect(layoutSpy).toHaveBeenCalledTimes(1);
    });

    it('does not announce a layout change when the board is already empty', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);

      expect(engine.clearAll()).toBe(0);
      expect(layoutSpy).not.toHaveBeenCalled();
    });

    it('placing an operator onto a conveyor replaces it and emits its despawn events', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 100;
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      const cashAfterConveyor = engine.state().economy.cash;
      const emitted: unknown[] = [];
      engine.events.subscribe((events) => emitted.push(events));

      const result = engine.place(MAP, { x: 3, y: 1 });

      expect(result.ok).toBe(true);
      expect(Object.keys(engine.state().conveyors)).toHaveLength(0);
      expect(Object.values(engine.state().machines)[0]).toMatchObject({ position: { x: 3, y: 1 } });
      expect(engine.state().economy.cash).toBe(cashAfterConveyor - RECIPES.crystallize.cost);
      expect(emitted).toEqual([]); // no packet was riding it, so nothing to despawn
    });
  });

  describe('reconfigureMachine', () => {
    it("updates a placed machine's config, charges the cost delta, and announces a layout change so the rendered tile refreshes", () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 200;
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      engine.place({ type: 'machine', kind: 'filter' }, { x: 3, y: 1 });
      const cashAfterPlacing = engine.state().economy.cash;
      const layoutSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);

      const result = engine.reconfigureMachine(
        { x: 3, y: 1 },
        { kind: 'filter', allow: ['carbon', 'ice'] },
      );

      expect(result).toEqual({ ok: true, costDelta: 0 }); // filter's cost is flat regardless of config
      expect(engine.state().economy.cash).toBe(cashAfterPlacing);
      const machine = Object.values(engine.state().machines)[0];
      expect(machine.kind).toBe('filter');
      if (machine.kind === 'filter') expect(machine.config.allow).toEqual(['carbon', 'ice']);
      expect(layoutSpy).toHaveBeenCalledTimes(1);
    });

    it('does not announce a layout change when reconfiguring fails', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);

      const result = engine.reconfigureMachine({ x: 5, y: 1 }, { kind: 'take', count: 3 });

      expect(result).toEqual({ ok: false, reason: 'not-a-machine' });
      expect(layoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('resizeBaseEdge', () => {
    it('expands the base by one cell and announces a layout change', () => {
      const engine = TestBed.inject(SimEngineService);
      const startMinY = engine.state().base.min.y;
      const layoutSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);

      const moved = engine.resizeBaseEdge('north', -1);

      expect(moved).toBe(true);
      expect(engine.state().base.min.y).toBe(startMinY - 1);
      expect(layoutSpy).toHaveBeenCalledTimes(1);
    });

    it('does not announce a layout change when the resize is refused', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);

      // Shrinking east repeatedly eventually tries to remove the strip containing the sink.
      let moved = true;
      while (moved) moved = engine.resizeBaseEdge('east', -1);

      layoutSpy.mockClear();
      expect(engine.resizeBaseEdge('east', -1)).toBe(false);
      expect(layoutSpy).not.toHaveBeenCalled();
    });

    it('is undoable, like every other grid edit', () => {
      const engine = TestBed.inject(SimEngineService);
      const startMinY = engine.state().base.min.y;

      engine.resizeBaseEdge('north', -1);
      expect(engine.state().base.min.y).toBe(startMinY - 1);

      engine.undo();
      expect(engine.state().base.min.y).toBe(startMinY);
    });
  });

  describe('undo/redo', () => {
    it('starts with nothing to undo or redo', () => {
      const engine = TestBed.inject(SimEngineService);

      expect(engine.canUndo()).toBe(false);
      expect(engine.canRedo()).toBe(false);
    });

    it('undoes a placement, restoring the grid and the refunded cash', () => {
      const engine = TestBed.inject(SimEngineService);
      const cashBefore = engine.state().economy.cash;

      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      expect(engine.canUndo()).toBe(true);

      engine.undo();

      expect(Object.keys(engine.state().conveyors)).toHaveLength(0);
      expect(engine.state().economy.cash).toBe(cashBefore);
      expect(engine.canUndo()).toBe(false);
      expect(engine.canRedo()).toBe(true);
    });

    it('redoes an undone placement', () => {
      const engine = TestBed.inject(SimEngineService);

      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      engine.undo();
      engine.redo();

      expect(Object.keys(engine.state().conveyors)).toHaveLength(1);
      expect(engine.canRedo()).toBe(false);
      expect(engine.canUndo()).toBe(true);
    });

    it('drops the redo stack once a fresh action is taken after an undo', () => {
      const engine = TestBed.inject(SimEngineService);

      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      engine.undo();
      engine.place(CONVEYOR_EAST, { x: 5, y: 1 });

      expect(engine.canRedo()).toBe(false);
      engine.redo(); // no-op: the redo stack was cleared by the fresh placement above
      const [conveyor] = Object.values(engine.state().conveyors);
      expect(conveyor.position).toEqual({ x: 5, y: 1 });
    });

    it('does not push undo history for a failed action', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 0;

      const result = engine.place(CONVEYOR_EAST, { x: 3, y: 1 });

      expect(result.ok).toBe(false);
      expect(engine.canUndo()).toBe(false);
    });

    it('caps history at 10 actions, so undoing past the cap is a no-op', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 1000;
      const positions = [
        ...Array.from({ length: 9 }, (_, x) => ({ x, y: 0 })),
        { x: 0, y: 4 },
        { x: 1, y: 4 },
      ];

      for (const pos of positions) engine.place(CONVEYOR_EAST, pos);

      for (let i = 0; i < 10; i++) engine.undo();

      // The very first placement (x: 0) falls outside the 10-deep history and survives.
      const [conveyor] = Object.values(engine.state().conveyors);
      expect(conveyor.position).toEqual({ x: 0, y: 0 });
      expect(engine.canUndo()).toBe(false);
    });

    it('fires historyRestored (not the packet events stream) on undo/redo', () => {
      const engine = TestBed.inject(SimEngineService);
      const restored = vi.fn();
      engine.historyRestored.subscribe(restored);

      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });
      engine.undo();
      expect(restored).toHaveBeenCalledTimes(1);

      engine.redo();
      expect(restored).toHaveBeenCalledTimes(2);
    });

    it('undoing a subscribe toggle restores the previous subscription state', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 100;
      engine.place({ type: 'source' }, STAGE1_MINES[0].position);
      const sourceId = Number(Object.keys(engine.state().sources)[0]);

      engine.toggleSubscribe(sourceId);
      expect(engine.state().sources[sourceId].subscribed).toBe(true);

      engine.undo();

      expect(engine.state().sources[sourceId].subscribed).toBe(false);
    });
  });

  describe('resetGame', () => {
    it('restores the starting cash and clears every player building', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 100;
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });

      engine.resetGame();

      expect(engine.state().economy.cash).toBe(START_CASH);
      expect(Object.keys(engine.state().conveyors)).toHaveLength(0);
    });

    it('clears the undo/redo history', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });

      engine.resetGame();

      expect(engine.canUndo()).toBe(false);
      expect(engine.canRedo()).toBe(false);
    });

    it('announces the reset as both a layout change and a history restore', () => {
      const engine = TestBed.inject(SimEngineService);
      const layoutSpy = vi.fn();
      const restoredSpy = vi.fn();
      engine.layoutChanged.subscribe(layoutSpy);
      engine.historyRestored.subscribe(restoredSpy);

      engine.resetGame();

      expect(layoutSpy).toHaveBeenCalledTimes(1);
      expect(restoredSpy).toHaveBeenCalledTimes(1);
    });

    it('persists the reset so a reload does not resurrect the previous game', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place(CONVEYOR_EAST, { x: 3, y: 1 });

      engine.resetGame();

      const raw = localStorage.getItem('conveyrx.save.v1');
      expect(raw).not.toBeNull();
      const saved = JSON.parse(raw as string);
      expect(Object.keys(saved.state.conveyors)).toHaveLength(0);
    });
  });

  describe('peakCash', () => {
    it('rises to match cash as it grows', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 500;

      engine.tick();

      expect(engine.state().economy.peakCash).toBe(500);
    });

    it('stays at its high point after cash drops back down', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 500;
      engine.tick();

      engine.state().economy.cash = 10;
      engine.tick();

      expect(engine.state().economy.peakCash).toBe(500);
    });

    it('goes back to the starting cash on resetGame', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 500;
      engine.tick();

      engine.resetGame();

      expect(engine.state().economy.peakCash).toBe(START_CASH);
    });
  });
});
