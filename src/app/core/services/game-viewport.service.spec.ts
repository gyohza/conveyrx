import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { GameViewportService } from './game-viewport.service';
import type { PixiGameApp } from '@render/pixi-app';

describe('GameViewportService', () => {
  it('returns null when no game app is registered', () => {
    const viewport = TestBed.inject(GameViewportService);

    expect(viewport.gridCellRect({ x: 0, y: 0 })).toBeNull();
  });

  it('delegates to the registered app', () => {
    const rect = new DOMRect(10, 20, 30, 40);
    const app = { gridCellRect: vi.fn().mockReturnValue(rect) } as unknown as PixiGameApp;
    const viewport = TestBed.inject(GameViewportService);

    viewport.register(app);

    expect(viewport.gridCellRect({ x: 2, y: 3 })).toBe(rect);
    expect(app.gridCellRect).toHaveBeenCalledWith({ x: 2, y: 3 });
  });

  it('returns null again once cleared', () => {
    const app = { gridCellRect: vi.fn().mockReturnValue(new DOMRect()) } as unknown as PixiGameApp;
    const viewport = TestBed.inject(GameViewportService);
    viewport.register(app);

    viewport.clear();

    expect(viewport.gridCellRect({ x: 0, y: 0 })).toBeNull();
  });
});
