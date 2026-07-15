import { describe, expect, it } from 'vitest';
import { buildCost, canPlace, clearAll, erase, place, redirectConveyor } from './editing';
import { CONVEYOR_COST, SOURCE_COST, START_CASH } from '../content/economy';
import { RECIPES } from '../content/recipes';
import { STAGE1_MINES, STAGE1_SINK_POS, createStage1State } from '../content/stage1-layout';
import { addPacket } from '../testing/state-builder';

const CONVEYOR_EAST = { type: 'conveyor', direction: 'east' } as const;
const CONVEYOR_WEST = { type: 'conveyor', direction: 'west' } as const;
const CONVEYOR_SOUTH = { type: 'conveyor', direction: 'south' } as const;
const MAP = {
  type: 'machine',
  kind: 'map',
  recipeId: 'crystallize',
} as const;
const SOURCE = { type: 'source' } as const;

const CENTER = { x: 3, y: 1 };
const CENTER_WEST = { x: 2, y: 1 };
const CENTER_EAST = { x: 4, y: 1 };
const CENTER_NORTH = { x: 3, y: 0 };
const CENTER_SOUTH = { x: 3, y: 2 };
const SIMPLE = { x: 2, y: 0 };
const FAR = { x: 0, y: 2 };
const EMPTY_CELL = { x: 4, y: 2 };

describe('grid editing', () => {
  describe('place', () => {
    it('places a conveyor, charges its cost, and includes it in the eval order', () => {
      const state = createStage1State();

      const result = place(state, CONVEYOR_EAST, SIMPLE);

      expect(result.ok).toBe(true);
      expect(state.economy.cash).toBe(START_CASH - CONVEYOR_COST);
      const placed = Object.values(state.conveyors)[0];
      expect(placed).toMatchObject({ position: SIMPLE, direction: 'east', slot: null });
      expect(state.evalOrder).toContainEqual({ kind: 'conveyor', id: placed.id });
    });

    it('places a machine with the requested recipe and charges the machine cost', () => {
      const state = createStage1State();
      place(state, CONVEYOR_EAST, CENTER);
      state.economy.cash = 100;

      const result = place(state, MAP, CENTER);

      expect(result.ok).toBe(true);
      expect(state.economy.cash).toBe(100 - RECIPES.crystallize.cost);
      expect(Object.values(state.machines)[0]).toMatchObject({
        kind: 'map',
        config: { recipeId: 'crystallize' },
      });
    });

    it('rejects placement outside the grid', () => {
      const state = createStage1State();

      expect(place(state, CONVEYOR_EAST, { x: -1, y: 0 })).toEqual({
        ok: false,
        reason: 'out-of-bounds',
      });
      expect(place(state, CONVEYOR_EAST, { x: 0, y: state.grid.height })).toEqual({
        ok: false,
        reason: 'out-of-bounds',
      });
    });

    it('rejects placement on an occupied cell', () => {
      const state = createStage1State();
      place(state, CONVEYOR_EAST, SIMPLE);

      expect(place(state, CONVEYOR_WEST, SIMPLE)).toEqual({
        ok: false,
        reason: 'occupied',
      });
    });

    it('rejects placing a source anywhere that is not a mine', () => {
      const state = createStage1State();
      state.economy.cash = 100;

      expect(place(state, SOURCE, SIMPLE)).toEqual({
        ok: false,
        reason: 'not-a-mine',
      });
    });

    it('rejects placement the player cannot afford, leaving cash untouched', () => {
      const state = createStage1State();
      place(state, CONVEYOR_EAST, CENTER);
      state.economy.cash = buildCost(MAP) - 1;

      expect(place(state, MAP, CENTER)).toEqual({
        ok: false,
        reason: 'insufficient-cash',
      });
      expect(state.economy.cash).toBe(buildCost(MAP) - 1);
    });

    it('places a source onto a mine, taking its material and yield, with no direction of its own', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      const mine = STAGE1_MINES[0];

      const result = place(state, SOURCE, mine.position);

      expect(result.ok).toBe(true);
      expect(state.economy.cash).toBe(100 - SOURCE_COST);
      const placed = Object.values(state.sources)[0];
      expect(placed).toMatchObject({
        kind: 'from',
        sequence: mine.sequence,
        subscribed: false,
      });
      expect(placed).not.toHaveProperty('direction');
    });

    it('canPlace validates without mutating', () => {
      const state = createStage1State();

      expect(canPlace(state, CONVEYOR_EAST, SIMPLE)).toEqual({ ok: true });
      expect(state.economy.cash).toBe(START_CASH);
      expect(Object.keys(state.conveyors)).toHaveLength(0);
    });

    it('rejects building anywhere inside the base — the subscribe body has one entry, not interior piping', () => {
      const state = createStage1State();

      const interiorCell = { x: state.base.min.x, y: state.base.min.y };
      expect(place(state, CONVEYOR_EAST, interiorCell)).toEqual({
        ok: false,
        reason: 'inside-base',
      });
    });

    it('allows a conveyor just outside the base to feed it, as the single entry point', () => {
      const state = createStage1State();
      const entryPos = { x: state.base.min.x - 1, y: STAGE1_SINK_POS.y };

      const result = place(state, CONVEYOR_EAST, entryPos);

      expect(result.ok).toBe(true);
    });

    it('rejects a second conveyor entry once the base already has one', () => {
      const state = createStage1State();
      const firstEntry = { x: state.base.min.x - 1, y: STAGE1_SINK_POS.y };
      place(state, CONVEYOR_EAST, firstEntry);
      const secondEntry = { x: STAGE1_SINK_POS.x, y: state.base.max.y + 1 };

      const result = place(state, { type: 'conveyor', direction: 'north' }, secondEntry);

      expect(result).toEqual({ ok: false, reason: 'base-entry-taken' });
    });

    it('allows a conveyor next to the base that does not point into it', () => {
      const state = createStage1State();
      const besideBase = { x: state.base.min.x - 1, y: STAGE1_SINK_POS.y };

      const result = place(state, CONVEYOR_SOUTH, besideBase);

      expect(result.ok).toBe(true);
    });

    it('rejects a machine or source in the one-cell buffer ring around the base — pipes only', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      const ringPos = { x: state.base.min.x, y: state.base.max.y + 1 };

      expect(canPlace(state, MAP, ringPos)).toEqual({
        ok: false,
        reason: 'base-buffer-restricted',
      });
    });

    it('still allows a conveyor to occupy the buffer ring', () => {
      const state = createStage1State();
      const ringPos = { x: state.base.min.x, y: state.base.max.y + 1 };

      expect(canPlace(state, CONVEYOR_EAST, ringPos)).toEqual({ ok: true });
    });

    it('does not restrict placement two or more cells from the base', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      const farPos = { x: state.base.min.x - 2, y: state.base.min.y };
      place(state, CONVEYOR_EAST, farPos);

      expect(canPlace(state, MAP, farPos)).toEqual({ ok: true });
    });
  });

  describe('placing an operator onto an existing conveyor', () => {
    it('requires an existing pipe — an operator can never be dropped onto an empty cell', () => {
      const state = createStage1State();
      state.economy.cash = 100;

      expect(canPlace(state, MAP, CENTER)).toEqual({ ok: false, reason: 'requires-pipe' });
      expect(place(state, MAP, CENTER)).toEqual({ ok: false, reason: 'requires-pipe' });
    });

    it('slots onto the pipe for exactly its own cost — no conveyor refund, unlike before', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      const cashAfterConveyor = state.economy.cash;

      const result = place(state, MAP, CENTER);

      expect(result.ok).toBe(true);
      expect(Object.keys(state.conveyors)).toHaveLength(0);
      expect(Object.values(state.machines)[0]).toMatchObject({ position: CENTER });
      expect(state.economy.cash).toBe(cashAfterConveyor - RECIPES.crystallize.cost);
    });

    it('replaces a conveyor that renders as a curve too — curve-vs-straight is a render detail, not a sim one', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER_WEST); // feeds CENTER from the west
      place(state, CONVEYOR_SOUTH, CENTER); // turns south here: renders as a curve tile
      const cashAfterConveyors = state.economy.cash;

      const result = place(state, MAP, CENTER);

      expect(result.ok).toBe(true);
      expect(Object.values(state.conveyors)[0].position).toEqual(CENTER_WEST);
      expect(Object.values(state.machines)[0]).toMatchObject({ position: CENTER });
      expect(state.economy.cash).toBe(cashAfterConveyors - RECIPES.crystallize.cost);
    });

    it('despawns a packet riding the replaced conveyor and reports it as an event', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      const conveyor = Object.values(state.conveyors)[0];
      const packet = addPacket(state);
      conveyor.slot = packet.id;

      const result = place(state, MAP, CENTER);

      expect(result.ok && result.events).toEqual([
        { type: 'packetDespawned', packetId: packet.id },
      ]);
      expect(state.packets[packet.id]).toBeUndefined();
    });

    it('still blocks placement on a machine, source, or sink (an operator can only ever slot onto a conveyor)', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      place(state, MAP, CENTER);
      place(state, SOURCE, STAGE1_MINES[0].position);

      expect(place(state, MAP, CENTER)).toEqual({ ok: false, reason: 'occupied' });
      expect(place(state, MAP, STAGE1_MINES[0].position)).toEqual({
        ok: false,
        reason: 'occupied',
      });
    });

    it('does not replace a conveyor when placing a conveyor or a source', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, STAGE1_MINES[0].position);

      expect(place(state, CONVEYOR_WEST, STAGE1_MINES[0].position)).toEqual({
        ok: false,
        reason: 'occupied',
      });
      expect(place(state, SOURCE, STAGE1_MINES[0].position)).toEqual({
        ok: false,
        reason: 'occupied',
      });
    });
  });

  describe('machine port limits (one incoming, one outgoing)', () => {
    it('allows a machine with exactly one incoming and one outgoing neighbor', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      place(state, CONVEYOR_EAST, CENTER_WEST); // feeds into CENTER
      place(state, CONVEYOR_EAST, CENTER_EAST); // merely touches CENTER, receives its output

      expect(place(state, MAP, CENTER)).toEqual({ ok: true });
    });

    it('rejects a conveyor that would give an existing machine a second incoming neighbor', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      place(state, MAP, CENTER);
      place(state, CONVEYOR_EAST, CENTER_WEST); // first incoming neighbor, from the west

      expect(place(state, CONVEYOR_SOUTH, CENTER_NORTH)).toEqual({
        ok: false,
        reason: 'machine-port-taken',
      });
    });

    it('rejects a conveyor that would give an existing machine a second outgoing neighbor', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      place(state, MAP, CENTER);
      place(state, CONVEYOR_EAST, CENTER_EAST); // first outgoing neighbor, to the east

      expect(place(state, CONVEYOR_SOUTH, CENTER_SOUTH)).toEqual({
        ok: false,
        reason: 'machine-port-taken',
      });
    });

    it('rejects placing a machine into a spot already surrounded by two feeding neighbors', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      place(state, CONVEYOR_EAST, CENTER_WEST); // would feed CENTER from the west
      place(state, CONVEYOR_SOUTH, CENTER_NORTH); // would feed CENTER from the north

      expect(place(state, MAP, CENTER)).toEqual({
        ok: false,
        reason: 'machine-port-taken',
      });
    });

    it('rejects placing a machine into a spot already surrounded by two non-feeding neighbors', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      place(state, CONVEYOR_EAST, CENTER_EAST); // touches CENTER from the east, doesn't feed it
      place(state, CONVEYOR_SOUTH, CENTER_SOUTH); // touches CENTER from the south, doesn't feed it

      expect(place(state, MAP, CENTER)).toEqual({
        ok: false,
        reason: 'machine-port-taken',
      });
    });

    it('rejects a conveyor that would give an existing source a second outgoing neighbor', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      const { x, y } = STAGE1_MINES[0].position;
      place(state, SOURCE, { x, y });
      place(state, CONVEYOR_EAST, { x: x + 1, y }); // first outgoing neighbor, to the east

      expect(place(state, CONVEYOR_SOUTH, { x, y: y + 1 })).toEqual({
        ok: false,
        reason: 'machine-port-taken',
      });
    });

    it('rejects placing a source into a spot already surrounded by two non-feeding neighbors', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      const { x, y } = STAGE1_MINES[0].position;
      place(state, CONVEYOR_EAST, { x: x + 1, y }); // touches the mine from the east, doesn't feed it
      place(state, CONVEYOR_SOUTH, { x, y: y + 1 }); // touches the mine from the south, doesn't feed it

      expect(place(state, SOURCE, { x, y })).toEqual({
        ok: false,
        reason: 'machine-port-taken',
      });
    });

    it('lets an unrelated conveyor placement elsewhere succeed even with a fully-connected machine nearby', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      place(state, CONVEYOR_EAST, CENTER_WEST);
      place(state, CONVEYOR_EAST, CENTER_EAST);
      place(state, MAP, CENTER);

      expect(place(state, CONVEYOR_WEST, FAR)).toEqual({ ok: true });
    });
  });

  describe('erase', () => {
    it('removes a placed conveyor and refunds its full cost', () => {
      const state = createStage1State();
      place(state, CONVEYOR_EAST, SIMPLE);

      const result = erase(state, SIMPLE);

      expect(result).toMatchObject({ ok: true, refund: CONVEYOR_COST });
      expect(Object.keys(state.conveyors)).toHaveLength(0);
      expect(state.economy.cash).toBe(START_CASH);
    });

    it('despawns any packet riding the erased conveyor', () => {
      const state = createStage1State();
      place(state, CONVEYOR_EAST, SIMPLE);
      const conveyor = Object.values(state.conveyors)[0];
      const packet = addPacket(state);
      conveyor.slot = packet.id;

      const result = erase(state, SIMPLE);

      expect(result.ok && result.events).toEqual([
        { type: 'packetDespawned', packetId: packet.id },
      ]);
      expect(state.packets[packet.id]).toBeUndefined();
    });

    it('refuses to erase the sink, the one remaining map anchor', () => {
      const state = createStage1State();

      expect(erase(state, STAGE1_SINK_POS)).toEqual({ ok: false, reason: 'protected' });
    });

    it('erases a player-built source for a full refund, unlike the protected sink', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      const minePos = STAGE1_MINES[0].position;
      place(state, SOURCE, minePos);
      const cashAfterBuilding = state.economy.cash;

      const result = erase(state, minePos);

      expect(result).toMatchObject({ ok: true, refund: SOURCE_COST });
      expect(Object.keys(state.sources)).toHaveLength(0);
      expect(state.economy.cash).toBe(cashAfterBuilding + SOURCE_COST);
    });

    it('reports empty cells as nothing to erase', () => {
      const state = createStage1State();

      expect(erase(state, EMPTY_CELL)).toEqual({ ok: false, reason: 'empty' });
    });

    it('restores the underlying pipe, in its original direction, once the operator sitting on it is erased', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_SOUTH, CENTER);
      place(state, MAP, CENTER);
      const cashAfterMap = state.economy.cash;

      const result = erase(state, CENTER);

      expect(result).toMatchObject({ ok: true, refund: RECIPES.crystallize.cost });
      expect(state.economy.cash).toBe(cashAfterMap + RECIPES.crystallize.cost);
      expect(Object.keys(state.machines)).toHaveLength(0);
      expect(Object.values(state.conveyors)[0]).toMatchObject({
        position: CENTER,
        direction: 'south',
        slot: null,
      });
    });
  });

  describe('clearAll', () => {
    it('erases every conveyor and machine, refunding each — including the pipe an operator was slotted onto', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER_WEST);
      place(state, CONVEYOR_EAST, CENTER);
      place(state, MAP, CENTER);
      const cashAfterBuilding = state.economy.cash;

      const result = clearAll(state);

      expect(result.refund).toBe(CONVEYOR_COST * 2 + RECIPES.crystallize.cost);
      expect(state.economy.cash).toBe(cashAfterBuilding + result.refund);
      expect(Object.keys(state.conveyors)).toHaveLength(0);
      expect(Object.keys(state.machines)).toHaveLength(0);
      expect(Object.keys(state.sources)).toHaveLength(0);
      expect(Object.keys(state.sinks)).toHaveLength(1);
    });

    it('despawns packets riding cleared conveyors', () => {
      const state = createStage1State();
      place(state, CONVEYOR_EAST, SIMPLE);
      const conveyor = Object.values(state.conveyors)[0];
      const packet = addPacket(state);
      conveyor.slot = packet.id;

      const result = clearAll(state);

      expect(result.events).toContainEqual({ type: 'packetDespawned', packetId: packet.id });
    });

    it('is a no-op on an already-empty board', () => {
      const state = createStage1State();

      expect(clearAll(state)).toEqual({ refund: 0, events: [] });
    });
  });

  describe('redirectConveyor', () => {
    it("changes an existing conveyor's direction in place, at no cost", () => {
      const state = createStage1State();
      place(state, CONVEYOR_EAST, SIMPLE);
      const cashBefore = state.economy.cash;

      const changed = redirectConveyor(state, SIMPLE, 'south');

      expect(changed).toBe(true);
      expect(Object.values(state.conveyors)[0].direction).toBe('south');
      expect(state.economy.cash).toBe(cashBefore);
    });

    it('updates the eval order to reflect the new direction', () => {
      const state = createStage1State();
      place(state, CONVEYOR_EAST, CENTER_NORTH);
      place(state, CONVEYOR_SOUTH, CENTER);
      const conveyor = Object.values(state.conveyors)[0];

      redirectConveyor(state, CENTER_NORTH, 'south'); // now feeds CENTER instead

      const southConveyor = Object.values(state.conveyors)[1];
      const conveyorIndex = state.evalOrder.findIndex(
        (e) => e.kind === 'conveyor' && e.id === conveyor.id,
      );
      const southIndex = state.evalOrder.findIndex(
        (e) => e.kind === 'conveyor' && e.id === southConveyor.id,
      );
      expect(conveyorIndex).toBeGreaterThan(southIndex); // downstream-first order
    });

    it('does nothing to an empty cell or a non-conveyor entity', () => {
      const state = createStage1State();

      expect(redirectConveyor(state, EMPTY_CELL, 'south')).toBe(false);
      expect(redirectConveyor(state, STAGE1_SINK_POS, 'south')).toBe(false);
    });

    it('refuses a redirect that would give an existing machine a second outgoing neighbor', () => {
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, CONVEYOR_EAST, CENTER);
      place(state, MAP, CENTER);
      place(state, CONVEYOR_EAST, CENTER_EAST); // first outgoing neighbor, to the east
      const feeder = { type: 'conveyor', direction: 'north' } as const;
      place(state, feeder, CENTER_SOUTH); // legal: points at the machine, feeding it

      // Redirecting it away turns it from "feeding" into a second, merely-touching receiver.
      const changed = redirectConveyor(state, CENTER_SOUTH, 'south');

      expect(changed).toBe(false);
      expect(Object.values(state.conveyors)[1].direction).toBe('north');
    });

    it('refuses a redirect that would create a second base entry', () => {
      const state = createStage1State();
      const firstEntry = { x: state.base.min.x - 1, y: STAGE1_SINK_POS.y };
      place(state, CONVEYOR_EAST, firstEntry); // the base's one entry
      const other = { x: STAGE1_SINK_POS.x, y: state.base.max.y + 1 };
      place(state, { type: 'conveyor', direction: 'south' }, other); // pointed away from the base

      const changed = redirectConveyor(state, other, 'north'); // now points at the base

      expect(changed).toBe(false);
      expect(Object.values(state.conveyors)[1].direction).toBe('south'); // unchanged
    });
  });
});
