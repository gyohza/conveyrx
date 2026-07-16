import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RxLogService } from './rx-log.service';
import { SimEngineService } from './sim-engine.service';
import { STAGE1_MINES } from '@sim/content/stage1-layout';

function firstSourceId(engine: SimEngineService): number {
  return Object.keys(engine.state().sources).map(Number)[0];
}

describe('RxLogService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('invites building a source when the board is empty', () => {
    const log = TestBed.inject(RxLogService);

    expect(log.code()).toContain('from');
  });

  it('shows the fresh declaration for a placed source, with no activity yet', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const log = TestBed.inject(RxLogService);

    expect(log.code()).toContain('const carbon$ = from(');
    expect(log.code()).not.toContain('.subscribe(');
  });

  it('appends a `let sub = ...subscribe(...)` line the first time a source is switched on', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const log = TestBed.inject(RxLogService);

    engine.toggleSubscribe(firstSourceId(engine));

    expect(log.code()).toContain('let sub = carbon$.subscribe(');
  });

  it('appends an unsubscribe() line when the source is switched back off', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const log = TestBed.inject(RxLogService);
    const sourceId = firstSourceId(engine);

    engine.toggleSubscribe(sourceId); // on
    engine.toggleSubscribe(sourceId); // off

    expect(log.code()).toContain('sub.unsubscribe();');
  });

  it('reassigns without `let` on a second subscription, keeping the first line intact too', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const log = TestBed.inject(RxLogService);
    const sourceId = firstSourceId(engine);

    engine.toggleSubscribe(sourceId); // on (let)
    engine.toggleSubscribe(sourceId); // off
    engine.toggleSubscribe(sourceId); // on again (reassign)

    const lines = log.code().split('\n');
    expect(lines).toContain('let sub = carbon$.subscribe();');
    expect(lines).toContain('sub = carbon$.subscribe();');
  });

  it('clears the activity log — but keeps the fresh declaration — once the layout changes', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const log = TestBed.inject(RxLogService);
    engine.toggleSubscribe(firstSourceId(engine));
    expect(log.code()).toContain('.subscribe(');

    engine.place({ type: 'conveyor', direction: 'east' }, { x: 5, y: 1 });

    expect(log.code()).not.toContain('.subscribe(');
    expect(log.code()).toContain('const carbon$ = from(');
  });

  it('resets the first-subscribe `let` behavior for a source built again after a layout change', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    const minePos = STAGE1_MINES[0].position;
    engine.place({ type: 'source' }, minePos);
    const log = TestBed.inject(RxLogService);
    engine.toggleSubscribe(firstSourceId(engine));

    engine.erase(minePos);
    engine.place({ type: 'source' }, minePos);
    engine.toggleSubscribe(firstSourceId(engine));

    expect(log.code()).toContain('let sub = carbon$.subscribe(');
  });
});
