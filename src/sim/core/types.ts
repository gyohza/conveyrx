export type EntityId = number;
export type PacketId = number;

export interface GridPos {
  x: number;
  y: number;
}

export interface GridRect {
  min: GridPos;
  max: GridPos;
}

export type Direction = 'north' | 'east' | 'south' | 'west';

export const DIRECTIONS: readonly Direction[] = ['north', 'east', 'south', 'west'];

const OFFSETS: Record<Direction, GridPos> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export function translate(pos: GridPos, direction: Direction): GridPos {
  const offset = OFFSETS[direction];
  return { x: pos.x + offset.x, y: pos.y + offset.y };
}

const RADIANS: Record<Direction, number> = {
  east: 0,
  south: Math.PI / 2,
  west: Math.PI,
  north: -Math.PI / 2,
};

export function directionToRadians(direction: Direction): number {
  return RADIANS[direction];
}
