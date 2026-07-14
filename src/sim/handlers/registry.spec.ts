import { describe, expect, it } from 'vitest';
import { getHandler, registerHandler } from './registry';
import type { MachineHandler } from './registry';

describe('handler registry', () => {
  it('returns a handler that was previously registered for its kind', () => {
    const handler: MachineHandler = { kind: 'map', step: () => [] };
    registerHandler(handler);

    expect(getHandler('map')).toBe(handler);
  });

  it('throws a clear error when no handler is registered for a machine kind', () => {
    // @ts-expect-error - deliberately an unregistered kind to exercise the error path
    expect(() => getHandler('unregistered-kind')).toThrow(/unregistered-kind/);
  });
});
