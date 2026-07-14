import type { MaterialId } from '../content/materials';
import type { RecipeId } from '../content/recipes';
import type { SourceKind } from '../content/source-kinds';
import type { Direction, EntityId, GridPos, PacketId } from './types';
import type { Port } from './port';

export type MachineKind = 'map' | 'filter' | 'take';

export interface MineSpec {
  position: GridPos;
  sequence: MaterialId[];
}

export interface MapConfig {
  recipeId: RecipeId;
}

export interface FilterConfig {
  allow: MaterialId[];
}

export interface TakeConfig {
  count: number;
}

export interface TakeInternal {
  passed: number;
  sourceWasSubscribed: boolean;
}

interface MachineEntityBase {
  id: EntityId;
  position: GridPos;
  inputs: Port[];
  outputs: Port[];
  internal: unknown;
}

/** No `direction` field: a machine's input/output sides are derived from adjacent conveyor topology (see routing.ts's machinePorts), not player-chosen. */
export interface MapMachineEntity extends MachineEntityBase {
  kind: 'map';
  config: MapConfig;
}

export interface FilterMachineEntity extends MachineEntityBase {
  kind: 'filter';
  config: FilterConfig;
}

export interface TakeMachineEntity extends Omit<MachineEntityBase, 'internal'> {
  kind: 'take';
  config: TakeConfig;
  internal: TakeInternal;
}

export type MachineEntity = MapMachineEntity | FilterMachineEntity | TakeMachineEntity;

/** No `direction` field: like machines, a source's output side is derived from adjacent conveyor topology (see routing.ts's machinePorts), not player-chosen. */
export interface SourceEntity {
  id: EntityId;
  position: GridPos;
  kind: SourceKind;
  sequence: MaterialId[];
  /** Toggling this on resets cursor/ticksSinceLastSpawn, so of/from always replay from scratch. */
  subscribed: boolean;
  cursor: number;
  ticksSinceLastSpawn: number;
  output: Port;
}

export type SinkType = 'cash' | 'research';

export interface SinkEntity {
  id: EntityId;
  position: GridPos;
  sinkType: SinkType;
  input: Port;
}

export interface ConveyorEntity {
  id: EntityId;
  position: GridPos;
  direction: Direction;
  slot: PacketId | null;
}
