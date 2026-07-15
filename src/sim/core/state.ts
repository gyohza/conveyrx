import type { ConveyorEntity, MachineEntity, MineSpec, SinkEntity, SourceEntity } from './entities';
import type { EntityId, GridRect, PacketId } from './types';
import type { Packet } from './packet';

export interface Economy {
  cash: number;
  research: number;
  peakCash: number;
  /** Count of packets ever sold to a cash sink — distinct from `peakCash`, which only rises once
   * cumulative earnings outpace spending and so can't detect an early individual sale on its own. */
  saleCount: number;
}

export interface GridSize {
  width: number;
  height: number;
}

/** Sinks-to-sources tick order, so capacity freed by a consumer is visible upstream same-tick. Recomputed on every grid edit (see editing.ts / eval-order.ts). */
export type EvalStep =
  | { kind: 'source'; id: EntityId }
  | { kind: 'machine'; id: EntityId }
  | { kind: 'sink'; id: EntityId }
  | { kind: 'conveyor'; id: EntityId };

export interface SimState {
  tick: number;
  nextPacketId: PacketId;
  nextEntityId: EntityId;
  grid: GridSize;
  machines: Record<EntityId, MachineEntity>;
  conveyors: Record<EntityId, ConveyorEntity>;
  sources: Record<EntityId, SourceEntity>;
  sinks: Record<EntityId, SinkEntity>;
  packets: Record<PacketId, Packet>;
  mines: MineSpec[];
  economy: Economy;
  evalOrder: EvalStep[];
  base: GridRect;
}
