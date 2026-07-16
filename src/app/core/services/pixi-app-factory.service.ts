import { Injectable } from '@angular/core';
import { PixiGameApp } from '@render/pixi-app';
import type { SimState } from '@sim/core/state';

@Injectable({ providedIn: 'root' })
export class PixiAppFactory {
  create(host: HTMLElement, initialState: SimState): Promise<PixiGameApp> {
    return PixiGameApp.create(host, initialState);
  }
}
