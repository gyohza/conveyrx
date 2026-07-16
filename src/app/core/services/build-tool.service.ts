import { Injectable, computed, signal } from '@angular/core';
import type { BuildRequest } from '@sim/core/editing';
import type { GridPos } from '@sim/core/types';

export type ToolId = 'conveyor' | 'map' | 'filter' | 'take' | 'source' | 'erase';

const MACHINE_TOOLS = new Set<ToolId>(['map', 'filter', 'take']);

@Injectable({ providedIn: 'root' })
export class BuildToolService {
  readonly tool = signal<ToolId | null>(null);
  readonly selectedCell = signal<GridPos | null>(null);

  readonly buildRequest = computed<BuildRequest | null>(() => {
    const tool = this.tool();
    if (tool && MACHINE_TOOLS.has(tool))
      return { type: 'machine', kind: tool as 'map' | 'filter' | 'take' };
    if (tool === 'source') return { type: 'source' };
    return null;
  });

  select(tool: ToolId): void {
    this.tool.update((current) => (current === tool ? null : tool));
    this.selectedCell.set(null);
  }

  deselect(): void {
    this.tool.set(null);
    this.selectedCell.set(null);
  }

  selectCell(pos: GridPos | null): void {
    this.selectedCell.set(pos);
  }
}
