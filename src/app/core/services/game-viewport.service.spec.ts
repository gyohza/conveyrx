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

  it('is not ready until an app registers, then not ready again once cleared', () => {
    const app = { gridCellRect: vi.fn() } as unknown as PixiGameApp;
    const viewport = TestBed.inject(GameViewportService);
    expect(viewport.ready()).toBe(false);

    viewport.register(app);
    expect(viewport.ready()).toBe(true);

    viewport.clear();
    expect(viewport.ready()).toBe(false);
  });

  it('computes a bounding rect spanning the corner cells of a grid rect', () => {
    const app = {
      gridCellRect: vi.fn((pos: { x: number; y: number }) =>
        pos.x === 1 && pos.y === 1 ? new DOMRect(10, 10, 20, 20) : new DOMRect(50, 50, 20, 20),
      ),
    } as unknown as PixiGameApp;
    const viewport = TestBed.inject(GameViewportService);
    viewport.register(app);

    const rect = viewport.gridRect({ min: { x: 1, y: 1 }, max: { x: 2, y: 2 } });

    expect(rect).toEqual(new DOMRect(10, 10, 60, 60));
  });

  it('returns null for gridRect when no app is registered', () => {
    const viewport = TestBed.inject(GameViewportService);

    expect(viewport.gridRect({ min: { x: 0, y: 0 }, max: { x: 1, y: 1 } })).toBeNull();
  });
});
