import { Injectable } from '@angular/core';
import type { PixiGameApp } from '../../../render/pixi-app';
import type { GridPos } from '../../../sim/core/types';

@Injectable({ providedIn: 'root' })
export class GameViewportService {
  private app: PixiGameApp | null = null;

  register(app: PixiGameApp): void {
    this.app = app;
  }

  clear(): void {
    this.app = null;
  }

  gridCellRect(pos: GridPos): DOMRect | null {
    return this.app?.gridCellRect(pos) ?? null;
  }
}
