import { describe, expect, it } from 'vitest';
import { createPort, peekPort, tryPushToPort, tryTakeFromPort } from './port';

describe('port', () => {
  describe('tryPushToPort', () => {
    it('accepts a packet when the queue has spare capacity', () => {
      const port = createPort(2);

      expect(tryPushToPort(port, 1)).toBe(true);
      expect(port.queue).toEqual([1]);
    });

    it('rejects a packet once the queue is at capacity, modelling a stalled/backpressured port', () => {
      const port = createPort(1);
      tryPushToPort(port, 1);

      expect(tryPushToPort(port, 2)).toBe(false);
      expect(port.queue).toEqual([1]);
    });
  });

  describe('tryTakeFromPort', () => {
    it('removes and returns the oldest queued packet (FIFO)', () => {
      const port = createPort(2);
      tryPushToPort(port, 1);
      tryPushToPort(port, 2);

      expect(tryTakeFromPort(port)).toBe(1);
      expect(port.queue).toEqual([2]);
    });

    it('returns undefined when the port is empty', () => {
      const port = createPort(1);

      expect(tryTakeFromPort(port)).toBeUndefined();
    });
  });

  describe('peekPort', () => {
    it('returns the oldest queued packet without removing it', () => {
      const port = createPort(2);
      tryPushToPort(port, 1);

      expect(peekPort(port)).toBe(1);
      expect(port.queue).toEqual([1]);
    });

    it('returns undefined when the port is empty', () => {
      const port = createPort(1);

      expect(peekPort(port)).toBeUndefined();
    });
  });
});
