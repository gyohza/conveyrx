import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { StatusStripComponent } from './status-strip.component';
import { BuildToolService } from '../../core/services/build-tool.service';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { STAGE1_MINES } from '../../../sim/content/stage1-layout';
import { FILTER_COST } from '../../../sim/content/economy';
import type { MineSpec } from '../../../sim/core/entities';

function placeMachine(engine: SimEngineService, kind: 'map' | 'filter' | 'take') {
  engine.state().economy.cash = 500;
  const pos = { x: 5, y: 4 };
  engine.place({ type: 'conveyor', direction: 'east' }, pos);
  engine.place({ type: 'machine', kind }, pos);
  return pos;
}

describe('StatusStripComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows a placeholder when nothing is hovered or selected', () => {
    const fixture = TestBed.createComponent(StatusStripComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hover a mine');
  });

  it('shows a placeholder when hovering a non-mine cell', () => {
    const ui = TestBed.inject(UiStateService);
    ui.hoveredPos.set({ x: 5, y: 5 });
    const fixture = TestBed.createComponent(StatusStripComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hover a mine');
  });

  it('shows the yield and one packet badge per unit for a uniform mine', () => {
    const ui = TestBed.inject(UiStateService);
    const mine = STAGE1_MINES[0];
    ui.hoveredPos.set(mine.position);
    const fixture = TestBed.createComponent(StatusStripComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Mine');
    expect(text).toContain(`${mine.sequence.length}`);
    expect(text).toContain('Carbon');
    expect(fixture.nativeElement.querySelectorAll('span.rounded-full')).toHaveLength(
      mine.sequence.length,
    );
  });

  it('labels a mixed-material slot "Spring" and breaks down every material', () => {
    const ui = TestBed.inject(UiStateService);
    const engine = TestBed.inject(SimEngineService);
    const spring: MineSpec = {
      position: { x: 3, y: 3 },
      sequence: ['ice', 'ice', 'ice', 'slag', 'slag'],
    };
    engine.state().mines.push(spring);
    ui.hoveredPos.set(spring.position);
    const fixture = TestBed.createComponent(StatusStripComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Spring');
    expect(text).toContain('Ice');
    expect(text).toContain('Slag');
    expect(fixture.nativeElement.querySelectorAll('span.rounded-full')).toHaveLength(
      spring.sequence.length,
    );
  });

  it('still shows the mine breakdown once a source is built there', () => {
    const engine = TestBed.inject(SimEngineService);
    const ui = TestBed.inject(UiStateService);
    const mine = STAGE1_MINES[0];
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, mine.position);
    ui.hoveredPos.set(mine.position);
    const fixture = TestBed.createComponent(StatusStripComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(`${mine.sequence.length}`);
  });

  describe('selected machine config', () => {
    it('takes priority over a hovered mine', () => {
      const engine = TestBed.inject(SimEngineService);
      const tools = TestBed.inject(BuildToolService);
      const ui = TestBed.inject(UiStateService);
      const pos = placeMachine(engine, 'map');
      tools.selectCell(pos);
      ui.hoveredPos.set(STAGE1_MINES[0].position);
      const fixture = TestBed.createComponent(StatusStripComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('map');
      expect(fixture.nativeElement.textContent).not.toContain('Hover a mine');
    });

    it("shows the map's recipe selector and reconfigures it on change", () => {
      const engine = TestBed.inject(SimEngineService);
      const tools = TestBed.inject(BuildToolService);
      const pos = placeMachine(engine, 'map');
      tools.selectCell(pos);
      const fixture = TestBed.createComponent(StatusStripComponent);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect([...select.options].map((o) => o.value)).toEqual(['crystallize']);

      select.value = 'crystallize';
      select.dispatchEvent(new Event('change'));

      const machine = Object.values(engine.state().machines)[0];
      expect(machine.kind).toBe('map');
      if (machine.kind === 'map') expect(machine.config.recipeId).toBe('crystallize');
    });

    it("shows the filter's per-material pass/block toggles and reconfigures on click", () => {
      const engine = TestBed.inject(SimEngineService);
      const tools = TestBed.inject(BuildToolService);
      const pos = placeMachine(engine, 'filter');
      tools.selectCell(pos);
      const fixture = TestBed.createComponent(StatusStripComponent);
      fixture.detectChanges();

      const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
      const iceButton = buttons.find((b) => b.textContent?.includes('Ice'))!;
      expect(iceButton.textContent).toContain('block');
      expect(fixture.nativeElement.textContent).toContain(`Ƶ${FILTER_COST}`);

      iceButton.click();
      fixture.detectChanges();

      const machine = Object.values(engine.state().machines)[0];
      expect(machine.kind).toBe('filter');
      if (machine.kind === 'filter') expect(machine.config.allow).toContain('ice');
    });

    it("shows the take machine's count selector and reconfigures it on change", () => {
      const engine = TestBed.inject(SimEngineService);
      const tools = TestBed.inject(BuildToolService);
      const pos = placeMachine(engine, 'take');
      tools.selectCell(pos);
      const fixture = TestBed.createComponent(StatusStripComponent);
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      select.value = '5';
      select.dispatchEvent(new Event('change'));

      const machine = Object.values(engine.state().machines)[0];
      expect(machine.kind).toBe('take');
      if (machine.kind === 'take') expect(machine.config.count).toBe(5);
    });
  });
});
