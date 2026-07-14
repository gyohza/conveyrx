import type { PacketId } from './types';

export interface Port {
  capacity: number;
  queue: PacketId[];
}

export function createPort(capacity: number): Port {
  return { capacity, queue: [] };
}

export function tryPushToPort(port: Port, packetId: PacketId): boolean {
  if (port.queue.length >= port.capacity) {
    return false;
  }
  port.queue.push(packetId);
  return true;
}

export function tryTakeFromPort(port: Port): PacketId | undefined {
  return port.queue.shift();
}

export function peekPort(port: Port): PacketId | undefined {
  return port.queue[0];
}
