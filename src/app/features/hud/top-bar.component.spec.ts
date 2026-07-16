import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBarComponent } from './top-bar.component';
import { OnboardingService } from '../../core/services/onboarding.service';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { START_CASH } from '@sim/content/economy';

function findButton(fixture: { nativeElement: HTMLElement }, text: string): HTMLButtonElement {
  const button = [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(text),
  );
  if (!button) throw new Error(`No button found containing "${text}"`);
  return button;
}

describe('TopBarComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the starting cash with cents, so a fractional upkeep drain reads as visible movement', () => {
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(`Ƶ ${START_CASH.toFixed(2)}`);
  });

  it('reflects cash changes from the engine', () => {
    const engine = TestBed.inject(SimEngineService);
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.detectChanges();

    engine.place({ type: 'conveyor', direction: 'east' }, { x: 3, y: 3 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      `Ƶ ${engine.state().economy.cash.toFixed(2)}`,
    );
  });

  it('opens the tutorial log on demand', () => {
    const ui = TestBed.inject(UiStateService);
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.detectChanges();

    findButton(fixture, 'Tutorials').click();

    expect(ui.tutorialLogOpen()).toBe(true);
  });

  it('shows a pointer cursor on its buttons', () => {
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.detectChanges();

    expect(findButton(fixture, 'Tutorials').className).toContain('cursor-pointer');
  });

  describe('clear button', () => {
    it('is disabled when there is nothing built yet', () => {
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();

      expect(findButton(fixture, 'Clear').disabled).toBe(true);
    });

    it('clears every building once confirmed', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place({ type: 'conveyor', direction: 'east' }, { x: 3, y: 3 });
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      findButton(fixture, 'Clear').click();

      expect(Object.keys(engine.state().conveyors)).toHaveLength(0);
    });

    it('does nothing when the confirmation is declined', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place({ type: 'conveyor', direction: 'east' }, { x: 3, y: 3 });
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      findButton(fixture, 'Clear').click();

      expect(Object.keys(engine.state().conveyors)).toHaveLength(1);
    });
  });

  describe('undo/redo', () => {
    it('disables Undo and Redo when there is nothing to undo or redo', () => {
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();

      expect(findButton(fixture, 'Undo').disabled).toBe(true);
      expect(findButton(fixture, 'Redo').disabled).toBe(true);
    });

    it('undoes and redoes via their buttons', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place({ type: 'conveyor', direction: 'east' }, { x: 3, y: 3 });
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();

      findButton(fixture, 'Undo').click();
      expect(Object.keys(engine.state().conveyors)).toHaveLength(0);

      fixture.detectChanges();
      findButton(fixture, 'Redo').click();
      expect(Object.keys(engine.state().conveyors)).toHaveLength(1);
    });

    it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place({ type: 'conveyor', direction: 'east' }, { x: 3, y: 3 });
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
      expect(Object.keys(engine.state().conveyors)).toHaveLength(0);

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }),
      );
      expect(Object.keys(engine.state().conveyors)).toHaveLength(1);
    });
  });

  describe('reset button', () => {
    it('resets the game once confirmed', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place({ type: 'conveyor', direction: 'east' }, { x: 3, y: 3 });
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      findButton(fixture, 'Reset').click();

      expect(Object.keys(engine.state().conveyors)).toHaveLength(0);
      expect(engine.state().economy.cash).toBe(START_CASH);
    });

    it('also resets onboarding progress once confirmed', () => {
      const onboarding = TestBed.inject(OnboardingService);
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();
      onboarding.dismiss('welcome');
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      findButton(fixture, 'Reset').click();

      expect(onboarding.active()?.id).toBe('welcome');
    });

    it('does nothing when the confirmation is declined', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place({ type: 'conveyor', direction: 'east' }, { x: 3, y: 3 });
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      findButton(fixture, 'Reset').click();

      expect(Object.keys(engine.state().conveyors)).toHaveLength(1);
    });
  });

  describe('RxJS sidebar toggle', () => {
    it('toggles UiStateService.rxSidebarOpen on click (open by default)', () => {
      const ui = TestBed.inject(UiStateService);
      const fixture = TestBed.createComponent(TopBarComponent);
      fixture.detectChanges();

      expect(ui.rxSidebarOpen()).toBe(true);

      findButton(fixture, 'Code').click();
      expect(ui.rxSidebarOpen()).toBe(false);

      findButton(fixture, 'Code').click();
      expect(ui.rxSidebarOpen()).toBe(true);
    });
  });
});
