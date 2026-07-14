import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimClockService, TICK_INTERVAL_MS } from './sim-clock.service';
import { SimEngineService } from './sim-engine.service';

describe('SimClockService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not tick the engine before start() is called', () => {
    const engine = TestBed.inject(SimEngineService);
    const tickSpy = vi.spyOn(engine, 'tick');

    vi.advanceTimersByTime(TICK_INTERVAL_MS * 3);

    expect(tickSpy).not.toHaveBeenCalled();
  });

  it('ticks the engine once per interval while running', () => {
    const engine = TestBed.inject(SimEngineService);
    const tickSpy = vi.spyOn(engine, 'tick');
    const clock = TestBed.inject(SimClockService);

    clock.start();
    vi.advanceTimersByTime(TICK_INTERVAL_MS * 3);

    expect(tickSpy).toHaveBeenCalledTimes(3);
  });

  it('stops ticking once stop() is called', () => {
    const engine = TestBed.inject(SimEngineService);
    const tickSpy = vi.spyOn(engine, 'tick');
    const clock = TestBed.inject(SimClockService);

    clock.start();
    vi.advanceTimersByTime(TICK_INTERVAL_MS);
    clock.stop();
    vi.advanceTimersByTime(TICK_INTERVAL_MS * 5);

    expect(tickSpy).toHaveBeenCalledTimes(1);
  });
});
