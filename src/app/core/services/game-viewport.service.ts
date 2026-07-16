import { Injectable, signal } from '@angular/core';
import type { PixiGameApp } from '@render/pixi-app';
import type { GridPos, GridRect } from '@sim/core/types';

@Injectable({ providedIn: 'root' })
export class GameViewportService {
  private app: PixiGameApp | null = null;
  /** True once the Pixi canvas has mounted and registered — grid-anchored UI can't position before this. */
  readonly ready = signal(false);

  register(app: PixiGameApp): void {
    this.app = app;
    this.ready.set(true);
  }

  clear(): void {
    this.app = null;
    this.ready.set(false);
  }

  gridCellRect(pos: GridPos): DOMRect | null {
    return this.app?.gridCellRect(pos) ?? null;
  }

  gridRect(rect: GridRect): DOMRect | null {
    const topLeft = this.gridCellRect(rect.min);
    const bottomRight = this.gridCellRect(rect.max);
    if (!topLeft || !bottomRight) return null;
    return new DOMRect(
      topLeft.left,
      topLeft.top,
      bottomRight.right - topLeft.left,
      bottomRight.bottom - topLeft.top,
    );
  }
}
