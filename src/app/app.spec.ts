import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { SimClockService } from './core/services/sim-clock.service';
import { PixiAppFactory } from './core/services/pixi-app-factory.service';
import { UiStateService } from './core/services/ui-state.service';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PixiAppFactory,
          useValue: {
            create: vi.fn().mockResolvedValue({
              applyEvents: vi.fn(),
              rebuildStatic: vi.fn(),
              refreshCursor: vi.fn(),
              setPreview: vi.fn(),
              setSelection: vi.fn(),
              setSourceSubscribed: vi.fn(),
              extractThumbnails: vi
                .fn()
                .mockResolvedValue({ conveyor: 'data:conveyor', map: 'data:map' }),
              setInteractionHandlers: vi.fn(),
              destroy: vi.fn(),
            }),
          },
        },
      ],
    });
  });

  it('creates the app and starts the simulation clock', () => {
    const clock = TestBed.inject(SimClockService);
    const startSpy = vi.spyOn(clock, 'start');

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the full game shell: top bar, canvas, toolbar, and the welcome dialog', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-top-bar')).toBeTruthy();
    expect(compiled.querySelector('app-game-canvas')).toBeTruthy();
    expect(compiled.querySelector('app-toolbar')).toBeTruthy();
    expect(compiled.querySelector('app-help-dialog')).toBeTruthy();
  });

  it('hides the welcome dialog once dismissed', () => {
    const ui = TestBed.inject(UiStateService);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    ui.helpOpen.set(false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-help-dialog')).toBeNull();
  });
});
