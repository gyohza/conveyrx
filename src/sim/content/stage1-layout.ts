import { computeEvalOrder } from '../core/eval-order';
import { createPort } from '../core/port';
import type { GridSize, SimState } from '../core/state';
import type { GridPos, GridRect } from '../core/types';
import { START_CASH } from './economy';
import { parseStageMap } from './map-format';

function seedBaseRect(sinkPos: GridPos, grid: GridSize): GridRect {
  const radius = 1;
  return {
    min: { x: Math.max(0, sinkPos.x - radius), y: Math.max(0, sinkPos.y - radius) },
    max: {
      x: Math.min(grid.width - 1, sinkPos.x + radius),
      y: Math.min(grid.height - 1, sinkPos.y + radius),
    },
  };
}

const STAGE1_MAP = `
  .  .       .  .  .  .  .  .  .  .  .  .
  .  .       .  .  .  .  .  .  .  .  .  .
  .  .       .  .  .  .  .  .  .  .  .  .
  .  MCCCCC  .  .  .  .  .  .  .  .  S  .
  .  .       .  .  .  .  .  .  .  .  .  .
  .  .       .  .  .  .  .  .  .  .  .  .
  .  .       .  .  .  .  .  .  .  .  .  .
  .  .       .  .  .  .  .  .  .  .  .  .
`;

const parsed = parseStageMap(STAGE1_MAP);

export const STAGE1_GRID = parsed.grid;
export const STAGE1_SINK_POS = parsed.sinkPos;
export const STAGE1_MINES = parsed.mines;

export function createStage1State(): SimState {
  const state: SimState = {
    tick: 0,
    nextPacketId: 1,
    nextEntityId: 2,
    grid: { ...STAGE1_GRID },
    sources: {},
    sinks: {
      1: {
        id: 1,
        position: { ...STAGE1_SINK_POS },
        sinkType: 'cash',
        input: createPort(4),
      },
    },
    machines: {},
    conveyors: {},
    packets: {},
    mines: STAGE1_MINES.map((mine) => ({
      position: { ...mine.position },
      sequence: [...mine.sequence],
    })),
    economy: { cash: START_CASH, research: 0, peakCash: START_CASH, saleCount: 0 },
    evalOrder: [],
    base: seedBaseRect(STAGE1_SINK_POS, STAGE1_GRID),
  };
  state.evalOrder = computeEvalOrder(state);
  return state;
}
