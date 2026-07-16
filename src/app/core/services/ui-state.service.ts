import { Injectable, signal } from '@angular/core';
import type { GridPos } from '@sim/core/types';

@Injectable({ providedIn: 'root' })
export class UiStateService {
  readonly tutorialLogOpen = signal(false);
  readonly hoveredPos = signal<GridPos | null>(null);
  readonly rxSidebarOpen = signal(true);
}
