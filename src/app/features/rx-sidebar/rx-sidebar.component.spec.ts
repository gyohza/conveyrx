import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RxSidebarComponent } from './rx-sidebar.component';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { STAGE1_MINES } from '../../../sim/content/stage1-layout';

describe('RxSidebarComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders generated code reflecting the current sim state', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const fixture = TestBed.createComponent(RxSidebarComponent);
    fixture.detectChanges();

    const pre = fixture.nativeElement.querySelector('pre') as HTMLElement;
    expect(pre.textContent).toContain('from(');
  });

  it('updates when the sim state changes', () => {
    const engine = TestBed.inject(SimEngineService);
    const fixture = TestBed.createComponent(RxSidebarComponent);
    fixture.detectChanges();
    const pre = () => fixture.nativeElement.querySelector('pre') as HTMLElement;

    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    fixture.detectChanges();

    expect(pre().textContent).toContain('from(');
  });

  it('renders the code with syntax-highlighting spans, not one flat text node', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const fixture = TestBed.createComponent(RxSidebarComponent);
    fixture.detectChanges();

    const spans = fixture.nativeElement.querySelectorAll('pre span');
    expect(spans.length).toBeGreaterThan(0);
    const keywordSpan = [...spans].find((s: Element) => s.textContent === 'const');
    expect(keywordSpan?.className).toContain('text-purple-400');
  });

  it('logs a subscribe statement live when the source is switched on, without a page reload', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    const placed = engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const sourceId = Object.keys(engine.state().sources).map(Number)[0];
    expect(placed.ok).toBe(true);
    const fixture = TestBed.createComponent(RxSidebarComponent);
    fixture.detectChanges();

    engine.toggleSubscribe(sourceId);
    fixture.detectChanges();

    const text = (fixture.nativeElement.querySelector('pre') as HTMLElement).textContent ?? '';
    expect(text).toContain('let sub = carbon$.subscribe(');
  });

  it('logs an unsubscribe statement when a subscribed source is switched off', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const sourceId = Object.keys(engine.state().sources).map(Number)[0];
    const fixture = TestBed.createComponent(RxSidebarComponent);
    fixture.detectChanges();

    engine.toggleSubscribe(sourceId); // on
    engine.toggleSubscribe(sourceId); // off
    fixture.detectChanges();

    const text = (fixture.nativeElement.querySelector('pre') as HTMLElement).textContent ?? '';
    expect(text).toContain('let sub = carbon$.subscribe(');
    expect(text).toContain('sub.unsubscribe();');
  });

  it('clears the subscribe/unsubscribe log once the stream topology changes', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const sourceId = Object.keys(engine.state().sources).map(Number)[0];
    const fixture = TestBed.createComponent(RxSidebarComponent);
    fixture.detectChanges();

    engine.toggleSubscribe(sourceId);
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 5, y: 1 });
    fixture.detectChanges();

    const text = (fixture.nativeElement.querySelector('pre') as HTMLElement).textContent ?? '';
    expect(text).not.toContain('.subscribe(');
  });

  describe('resizing', () => {
    function handle(fixture: ReturnType<typeof TestBed.createComponent<RxSidebarComponent>>) {
      return fixture.nativeElement.querySelector('[class*="cursor-col-resize"]') as HTMLElement;
    }

    function drag(
      fixture: ReturnType<typeof TestBed.createComponent<RxSidebarComponent>>,
      fromX: number,
      toX: number,
    ) {
      handle(fixture).dispatchEvent(new PointerEvent('pointerdown', { clientX: fromX }));
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: toX }));
    }

    it('starts at a wider default width than the old fixed sidebar', () => {
      const fixture = TestBed.createComponent(RxSidebarComponent);
      fixture.detectChanges();

      const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;
      expect(parseInt(aside.style.width, 10)).toBeGreaterThanOrEqual(384);
    });

    it('grows the sidebar as the handle is dragged left, and shrinks it dragged right', () => {
      const fixture = TestBed.createComponent(RxSidebarComponent);
      fixture.detectChanges();
      const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;
      const startWidth = parseInt(aside.style.width, 10);

      drag(fixture, 500, 400); // dragged left by 100 -> grows by 100
      fixture.detectChanges();
      expect(parseInt(aside.style.width, 10)).toBe(startWidth + 100);

      document.dispatchEvent(new PointerEvent('pointerup'));
      drag(fixture, 400, 480); // dragged right by 80 -> shrinks by 80
      fixture.detectChanges();
      expect(parseInt(aside.style.width, 10)).toBe(startWidth + 100 - 80);
    });

    it('clamps the width so the sidebar can neither vanish nor swallow the whole screen', () => {
      const fixture = TestBed.createComponent(RxSidebarComponent);
      fixture.detectChanges();
      const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;

      drag(fixture, 500, 5000); // drag far right, trying to shrink past the minimum
      fixture.detectChanges();
      expect(parseInt(aside.style.width, 10)).toBeGreaterThanOrEqual(280);

      document.dispatchEvent(new PointerEvent('pointerup'));
      drag(fixture, 500, -5000); // drag far left, trying to grow past the maximum
      fixture.detectChanges();
      expect(parseInt(aside.style.width, 10)).toBeLessThanOrEqual(800);
    });

    it('caps the max width to leave room for the toolbar and grid on a narrow window, not a fixed 800px ceiling', () => {
      const originalWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 });
      const fixture = TestBed.createComponent(RxSidebarComponent);
      fixture.detectChanges();
      const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;

      drag(fixture, 500, -5000);
      fixture.detectChanges();

      expect(parseInt(aside.style.width, 10)).toBeLessThan(800);
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    });

    it('stops resizing once the pointer is released', () => {
      const fixture = TestBed.createComponent(RxSidebarComponent);
      fixture.detectChanges();
      const aside = fixture.nativeElement.querySelector('aside') as HTMLElement;

      drag(fixture, 500, 400);
      document.dispatchEvent(new PointerEvent('pointerup'));
      fixture.detectChanges();
      const widthAfterDrag = parseInt(aside.style.width, 10);

      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 200 }));
      fixture.detectChanges();

      expect(parseInt(aside.style.width, 10)).toBe(widthAfterDrag);
    });
  });

  it('closes via UiStateService when the close button is clicked', () => {
    const ui = TestBed.inject(UiStateService);
    ui.rxSidebarOpen.set(true);
    const fixture = TestBed.createComponent(RxSidebarComponent);
    fixture.detectChanges();

    const closeButton = [...fixture.nativeElement.querySelectorAll('button')].find((b: Element) =>
      b.textContent?.includes('Close'),
    ) as HTMLButtonElement;
    closeButton.click();

    expect(ui.rxSidebarOpen()).toBe(false);
  });
});
