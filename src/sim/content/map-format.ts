import type { MineSpec } from '../core/entities';
import type { GridSize } from '../core/state';
import type { GridPos } from '../core/types';
import { MATERIALS } from './materials';
import type { MaterialId } from './materials';

export interface ParsedStageMap {
  grid: GridSize;
  sinkPos: GridPos;
  mines: MineSpec[];
}

const SHORT_LABEL_TO_MATERIAL: Record<string, MaterialId> = Object.fromEntries(
  Object.values(MATERIALS).map((def) => [def.shortLabel, def.id]),
);

const MINE_TOKEN = /^M([A-Z]+)$/;

/**
 * Parses a whitespace-separated token grid, one row per line: `.` empty, `S` the cash sink
 * (exactly one), `M<letters>` a mine, one packet per letter, each letter a material's
 * shortLabel — e.g. `MCCCCC` yields 5 carbon, `MIIXIX` a mixed ice/slag spring.
 */
export function parseStageMap(text: string): ParsedStageMap {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/));

  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error('Stage map is empty');
  if (rows.some((row) => row.length !== width)) {
    throw new Error('Stage map rows must all have the same number of columns');
  }

  const mines: MineSpec[] = [];
  let sinkPos: GridPos | undefined;

  rows.forEach((row, y) => {
    row.forEach((token, x) => {
      if (token === '.') return;
      if (token === 'S') {
        if (sinkPos) throw new Error('Stage map has more than one sink ("S") tile');
        sinkPos = { x, y };
        return;
      }
      const mineMatch = MINE_TOKEN.exec(token);
      if (mineMatch) {
        const sequence = [...mineMatch[1]].map((letter) => {
          const material = SHORT_LABEL_TO_MATERIAL[letter];
          if (!material) {
            throw new Error(
              `Unknown material letter "${letter}" in token "${token}" at (${x}, ${y})`,
            );
          }
          return material;
        });
        mines.push({ position: { x, y }, sequence });
        return;
      }
      throw new Error(`Unknown stage map token "${token}" at (${x}, ${y})`);
    });
  });

  if (!sinkPos) throw new Error('Stage map is missing a sink ("S") tile');
  return { grid: { width, height }, sinkPos, mines };
}
