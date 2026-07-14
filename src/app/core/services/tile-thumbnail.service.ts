import { Injectable, signal } from '@angular/core';
import type { MachineKind } from '../../../sim/core/entities';

export type ThumbnailKey = MachineKind | 'conveyor' | 'source';

@Injectable({ providedIn: 'root' })
export class TileThumbnailService {
  private readonly thumbnailsSignal = signal<Partial<Record<ThumbnailKey, string>>>({});
  readonly thumbnails = this.thumbnailsSignal.asReadonly();

  set(key: ThumbnailKey, dataUrl: string): void {
    this.thumbnailsSignal.update((current) => ({ ...current, [key]: dataUrl }));
  }
}
