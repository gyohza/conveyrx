import type { MaterialId } from '../content/materials';
import type { EntityId, GridPos, PacketId } from './types';

export type SimEvent =
  | { type: 'packetSpawned'; packetId: PacketId; material: MaterialId; position: GridPos }
  | { type: 'packetMoved'; packetId: PacketId; position: GridPos }
  | { type: 'packetTransformed'; packetId: PacketId; material: MaterialId }
  | { type: 'packetDespawned'; packetId: PacketId }
  | { type: 'sourceUnsubscribed'; sourceId: EntityId };
