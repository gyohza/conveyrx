import { Injectable, inject, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { TICK_MS } from '../../../sim/content/timing';
import { SimEngineService } from './sim-engine.service';

export const TICK_INTERVAL_MS = TICK_MS;

@Injectable({ providedIn: 'root' })
export class SimClockService {
  private readonly engine = inject(SimEngineService);
  private subscription?: Subscription;
  readonly paused = signal(false);

  start(): void {
    if (this.subscription) {
      return;
    }
    this.subscription = interval(TICK_INTERVAL_MS).subscribe(() => {
      if (!this.paused()) this.engine.tick();
    });
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
  }
}
