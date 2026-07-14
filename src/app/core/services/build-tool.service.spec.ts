import { describe, expect, it } from 'vitest';
import { BuildToolService } from './build-tool.service';

describe('BuildToolService', () => {
  it('starts with no tool selected', () => {
    const service = new BuildToolService();

    expect(service.tool()).toBeNull();
    expect(service.buildRequest()).toBeNull();
  });

  it('selects a tool, and selecting it again deselects it', () => {
    const service = new BuildToolService();

    service.select('conveyor');
    expect(service.tool()).toBe('conveyor');

    service.select('conveyor');
    expect(service.tool()).toBeNull();
  });

  it.each(['map', 'filter', 'take'] as const)(
    'derives a machine build request with no config for the %s tool — config is set on the placed instance',
    (kind) => {
      const service = new BuildToolService();

      service.select(kind);

      expect(service.buildRequest()).toEqual({ type: 'machine', kind });
    },
  );

  it('produces no build request for the erase or conveyor tools (conveyor placement is handled directly by the caller)', () => {
    const service = new BuildToolService();

    service.select('erase');
    expect(service.buildRequest()).toBeNull();

    service.select('conveyor');
    expect(service.buildRequest()).toBeNull();
  });

  it('derives a source build request from the source tool', () => {
    const service = new BuildToolService();

    service.select('source');

    expect(service.buildRequest()).toEqual({ type: 'source' });
  });

  it('tracks a selected cell, cleared by choosing a tool or deselecting', () => {
    const service = new BuildToolService();
    expect(service.selectedCell()).toBeNull();

    service.selectCell({ x: 2, y: 3 });
    expect(service.selectedCell()).toEqual({ x: 2, y: 3 });

    service.select('conveyor');
    expect(service.selectedCell()).toBeNull();

    service.selectCell({ x: 1, y: 1 });
    service.deselect();
    expect(service.selectedCell()).toBeNull();
  });
});
