import type { MaterialId } from '../content/materials';
import type { PacketId } from './types';

export interface Packet {
  id: PacketId;
  material: MaterialId;
  bornTick: number;
}
