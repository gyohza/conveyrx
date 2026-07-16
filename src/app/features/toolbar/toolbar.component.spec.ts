import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToolbarComponent } from './toolbar.component';
import { BuildToolService } from '../../core/services/build-tool.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { SETUP_HALLMARK_ID } from '../../content/milestones';
import { SOURCE_COST } from '@sim/content/economy';
import { RECIPES } from '@sim/content/recipes';
import { SOURCE_KINDS } from '@sim/content/source-kinds';
import { STAGE1_MINES } from '@sim/content/stage1-layout';

function pressKey(key: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function findButton(fixture: ComponentFixture<ToolbarComponent>, text: string): HTMLButtonElement {
  const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
  const match = [...buttons].find((b) => b.textContent?.includes(text));
  if (!match) throw new Error(`no button containing "${text}"`);
  return match;
}

function findToolButtonHost(
  fixture: ComponentFixture<ToolbarComponent>,
  text: string,
): HTMLElement {
  const hosts = [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-tool-button')];
  const match = hosts.find((h) => h.textContent?.includes(text));
  if (!match) throw new Error(`no tool button containing "${text}"`);
  return match as HTMLElement;
}

describe('ToolbarComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders every tool, grouped into Tools, Stream, Creation, and Operators sections', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';
    expect(text).toContain('Cursor');
    expect(text).toContain('Erase');
    expect(text).toContain(SOURCE_KINDS.from.label);
    expect(text).toContain(`Ƶ${SOURCE_COST}`);
    expect(text).toContain('pipe');
    expect(text).toContain('map');
    expect(text).toContain(`Ƶ${RECIPES.crystallize.cost}`);

    // Stream comes before Creation — RxJS terminology, ordered so the stream a source feeds
    // into reads first, per Dan's explicit request.
    const headings = [...element.querySelectorAll('h2')].map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Tools', 'Stream', 'Creation', 'Operators']);
  });

  it('explains the "source" RxJS terminology via a tooltip instead of the category name', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    const sourceButton = findButton(fixture, SOURCE_KINDS.from.label);
    expect(sourceButton.title.toLowerCase()).toContain('source');
  });

  it('does not render a rotate control', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('rotate');
  });

  it('selects a tool on click and marks it pressed', () => {
    const tools = TestBed.inject(BuildToolService);
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    const pipeButton = findButton(fixture, 'pipe');
    pipeButton.click();
    fixture.detectChanges();

    expect(tools.tool()).toBe('conveyor');
    expect(pipeButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('the cursor tool is pressed by default and deselects any active tool on click', () => {
    const tools = TestBed.inject(BuildToolService);
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    const cursorButton = findButton(fixture, 'Cursor');
    expect(cursorButton.getAttribute('aria-pressed')).toBe('true');

    tools.select('conveyor');
    fixture.detectChanges();
    expect(cursorButton.getAttribute('aria-pressed')).toBe('false');

    cursorButton.click();
    fixture.detectChanges();

    expect(tools.tool()).toBeNull();
    expect(cursorButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a discoverable letter hotkey badge and a pointer cursor on every tool button', () => {
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    const cursorButton = findButton(fixture, 'Cursor');
    expect(cursorButton.textContent?.toUpperCase()).toContain('C');
    expect(cursorButton.className).toContain('cursor-pointer');

    const pipeButton = findButton(fixture, 'pipe');
    expect(pipeButton.textContent?.toUpperCase()).toContain('S');
  });

  it('disables tools the player cannot afford', () => {
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 0;
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const mapButton = [...buttons].find((b) => b.textContent?.includes('map'))!;
    expect(mapButton.disabled).toBe(true);
  });

  describe('progressive operator unlock', () => {
    it('hides an operator the player has never been able to afford', () => {
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).not.toContain('filter');
      expect(element.textContent).not.toContain('take');
    });

    it('reveals an operator once cash has ever reached its cost, and never hides it again', () => {
      const engine = TestBed.inject(SimEngineService);
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      engine.state().economy.cash = 1000;
      engine.tick();
      fixture.detectChanges();
      expect(findButton(fixture, 'filter').disabled).toBe(false);

      engine.state().economy.cash = 0;
      engine.tick();
      fixture.detectChanges();

      expect(findButton(fixture, 'filter').disabled).toBe(true);
    });

    it('does not select a hidden operator via its hotkey', () => {
      const tools = TestBed.inject(BuildToolService);
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      pressKey('l');

      expect(tools.tool()).toBeNull();
    });
  });

  it('shows a docs link for an operator, opening in a new tab without also selecting the tool', () => {
    const engine = TestBed.inject(SimEngineService);
    const tools = TestBed.inject(BuildToolService);
    engine.state().economy.cash = 1000;
    engine.state().economy.peakCash = 1000;
    const fixture = TestBed.createComponent(ToolbarComponent);
    fixture.detectChanges();

    const filterHost = findToolButtonHost(fixture, 'filter');
    const link = filterHost.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toContain('rxjs.dev');
    expect(link.target).toBe('_blank');

    link.click();
    expect(tools.tool()).toBeNull();
  });

  describe('keyboard shortcuts', () => {
    it('selects tools with their letter mnemonics, case-insensitively', () => {
      const tools = TestBed.inject(BuildToolService);
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 100; // enough to select every tool, including source
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      pressKey('s');
      expect(tools.tool()).toBe('conveyor');
      pressKey('f');
      expect(tools.tool()).toBe('source');
      pressKey('E');
      expect(tools.tool()).toBe('erase');
      pressKey('m');
      expect(tools.tool()).toBe('map');
      pressKey('c');
      expect(tools.tool()).toBeNull();
      pressKey('Escape');
      expect(tools.tool()).toBeNull();
    });

    it('erases the selected cell with Delete or Backspace, and clears the selection', () => {
      const tools = TestBed.inject(BuildToolService);
      const engine = TestBed.inject(SimEngineService);
      engine.place({ type: 'conveyor', direction: 'east' }, { x: 2, y: 2 });
      tools.selectCell({ x: 2, y: 2 });
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      pressKey('Delete');

      expect(Object.values(engine.state().conveyors)).toHaveLength(0);
      expect(tools.selectedCell()).toBeNull();
    });

    it('refuses to erase the source with Delete/Backspace while onboarding setup is still in progress', () => {
      const tools = TestBed.inject(BuildToolService);
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 100;
      engine.place({ type: 'source' }, STAGE1_MINES[0].position);
      tools.selectCell(STAGE1_MINES[0].position);
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      pressKey('Delete');

      expect(Object.values(engine.state().sources)).toHaveLength(1);
      expect(tools.selectedCell()).toEqual(STAGE1_MINES[0].position);
    });

    it('erases the source with Delete/Backspace once onboarding setup has completed', () => {
      const tools = TestBed.inject(BuildToolService);
      const engine = TestBed.inject(SimEngineService);
      engine.state().economy.cash = 100;
      engine.place({ type: 'source' }, STAGE1_MINES[0].position);
      TestBed.inject(OnboardingService).dismiss(SETUP_HALLMARK_ID);
      tools.selectCell(STAGE1_MINES[0].position);
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      pressKey('Delete');

      expect(Object.values(engine.state().sources)).toHaveLength(0);
      expect(tools.selectedCell()).toBeNull();
    });

    it('does nothing on Delete/Backspace when nothing is selected', () => {
      const engine = TestBed.inject(SimEngineService);
      engine.place({ type: 'conveyor', direction: 'east' }, { x: 2, y: 2 });
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      expect(() => pressKey('Backspace')).not.toThrow();
      expect(Object.values(engine.state().conveyors)).toHaveLength(1);
    });

    it('Escape clears an active selection before it would otherwise be a no-op', () => {
      const tools = TestBed.inject(BuildToolService);
      tools.selectCell({ x: 1, y: 1 });
      const fixture = TestBed.createComponent(ToolbarComponent);
      fixture.detectChanges();

      pressKey('Escape');

      expect(tools.selectedCell()).toBeNull();
    });
  });
});
