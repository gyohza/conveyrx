import { Component, computed, inject } from '@angular/core';
import { CONVEYOR_COST, SOURCE_COST, everAffordable } from '@sim/content/economy';
import { MACHINE_DEFS } from '@sim/content/machine-defs';
import { SOURCE_KINDS } from '@sim/content/source-kinds';
import { buildCost } from '@sim/core/editing';
import { findEntityAt } from '@sim/core/grid';
import type { GridPos } from '@sim/core/types';
import { BuildToolService } from '../../core/services/build-tool.service';
import type { ToolId } from '../../core/services/build-tool.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { TileThumbnailService } from '../../core/services/tile-thumbnail.service';
import type { ThumbnailKey } from '../../core/services/tile-thumbnail.service';
import { ToolButtonComponent } from './tool-button.component';

interface ToolButton {
  id: ToolId | null;
  label: string;
  detail: string;
  cost: number | null;
  hotkey: string;
  thumbnailKey?: ThumbnailKey;
  icon?: 'cursor' | 'erase';
  tooltip?: string;
  docsUrl?: string;
}

const SECTION_CLASSES =
  'flex flex-row items-center gap-2 landscape:w-full landscape:flex-col landscape:items-stretch';
const DIVIDER_CLASSES =
  'mx-1 h-8 w-px shrink-0 bg-slate-700 landscape:mx-0 landscape:my-1 landscape:h-px landscape:w-full';
const HEADER_CLASSES =
  'hidden px-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase landscape:block';

@Component({
  selector: 'app-toolbar',
  imports: [ToolButtonComponent],
  template: `
    <nav
      class="pointer-events-auto flex flex-row items-center gap-2 overflow-x-auto border-t border-slate-800 bg-slate-900 px-2 py-2 landscape:h-full landscape:w-60 landscape:flex-col landscape:items-stretch landscape:overflow-x-hidden landscape:overflow-y-auto landscape:border-t-0 landscape:border-r landscape:py-3"
      aria-label="Build tools"
    >
      <h2 [class]="HEADER_CLASSES">Tools</h2>
      <section [class]="SECTION_CLASSES">
        @for (button of toolButtons(); track button.id) {
          <app-tool-button
            [id]="button.id"
            [label]="button.label"
            [detail]="button.detail"
            [cost]="button.cost"
            [hotkey]="button.hotkey"
            [icon]="button.icon"
            [pressed]="tools.tool() === button.id"
            [affordable]="isAffordable(button)"
            (picked)="onSelectButton(button.id)"
          />
        }
      </section>

      <div [class]="DIVIDER_CLASSES" aria-hidden="true"></div>

      <h2 [class]="HEADER_CLASSES">Stream</h2>
      <section [class]="SECTION_CLASSES">
        @for (button of streamButtons(); track button.id) {
          <app-tool-button
            [id]="button.id"
            [label]="button.label"
            [detail]="button.detail"
            [cost]="button.cost"
            [hotkey]="button.hotkey"
            [thumbnailUrl]="thumbnailUrl(button.thumbnailKey)"
            [tooltip]="button.tooltip"
            [pressed]="tools.tool() === button.id"
            [affordable]="isAffordable(button)"
            (picked)="onSelectButton(button.id)"
          />
        }
      </section>

      <div [class]="DIVIDER_CLASSES" aria-hidden="true"></div>

      <h2 [class]="HEADER_CLASSES">Creation</h2>
      <section [class]="SECTION_CLASSES">
        @for (button of creationButtons(); track button.id) {
          <app-tool-button
            [id]="button.id"
            [label]="button.label"
            [detail]="button.detail"
            [cost]="button.cost"
            [hotkey]="button.hotkey"
            [thumbnailUrl]="thumbnailUrl(button.thumbnailKey)"
            [tooltip]="button.tooltip"
            [docsUrl]="button.docsUrl"
            [pressed]="tools.tool() === button.id"
            [affordable]="isAffordable(button)"
            (picked)="onSelectButton(button.id)"
          />
        }
      </section>

      <div [class]="DIVIDER_CLASSES" aria-hidden="true"></div>

      <h2 [class]="HEADER_CLASSES">Operators</h2>
      <section [class]="SECTION_CLASSES">
        @for (button of operatorButtons(); track button.id) {
          <app-tool-button
            [id]="button.id"
            [label]="button.label"
            [detail]="button.detail"
            [cost]="button.cost"
            [hotkey]="button.hotkey"
            [thumbnailUrl]="thumbnailUrl(button.thumbnailKey)"
            [tooltip]="button.tooltip"
            [docsUrl]="button.docsUrl"
            [pressed]="tools.tool() === button.id"
            [affordable]="isAffordable(button)"
            (picked)="onSelectButton(button.id)"
          />
        }
      </section>
    </nav>
  `,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class ToolbarComponent {
  protected readonly tools = inject(BuildToolService);
  private readonly thumbnails = inject(TileThumbnailService);
  private readonly engine = inject(SimEngineService);
  private readonly onboarding = inject(OnboardingService);
  protected readonly SECTION_CLASSES = SECTION_CLASSES;
  protected readonly DIVIDER_CLASSES = DIVIDER_CLASSES;
  protected readonly HEADER_CLASSES = HEADER_CLASSES;

  protected readonly toolButtons = computed<ToolButton[]>(() => [
    {
      id: null,
      label: 'Cursor',
      detail: 'select / inspect',
      cost: null,
      hotkey: 'c',
      icon: 'cursor',
    },
    { id: 'erase', label: 'Erase', detail: 'full refund', cost: null, hotkey: 'e', icon: 'erase' },
  ]);

  protected readonly creationButtons = computed<ToolButton[]>(() => [
    {
      id: 'source',
      label: SOURCE_KINDS.from.label,
      detail: SOURCE_KINDS.from.description,
      cost: SOURCE_COST,
      hotkey: 'f',
      thumbnailKey: 'source',
      tooltip: SOURCE_KINDS.from.expandedDescription,
      docsUrl: SOURCE_KINDS.from.docsUrl,
    },
  ]);

  protected readonly streamButtons = computed<ToolButton[]>(() => [
    {
      id: 'conveyor',
      label: 'pipe',
      detail: 'carries packets',
      cost: CONVEYOR_COST,
      hotkey: 's',
      thumbnailKey: 'conveyor',
    },
  ]);

  protected readonly operatorButtons = computed<ToolButton[]>(() => {
    const peakCash = this.engine.state().economy.peakCash;
    return (['map', 'filter', 'take'] as const)
      .map((kind) => {
        const def = MACHINE_DEFS[kind];
        return {
          id: kind,
          label: def.label,
          detail: def.description,
          cost: buildCost({ type: 'machine', kind }),
          hotkey: kind === 'map' ? 'm' : kind === 'filter' ? 'l' : 't',
          thumbnailKey: kind,
          tooltip: def.expandedDescription,
          docsUrl: def.docsUrl,
        };
      })
      .filter((button) => everAffordable(peakCash, button.cost));
  });

  private readonly buttons = computed<ToolButton[]>(() => [
    ...this.toolButtons(),
    ...this.streamButtons(),
    ...this.creationButtons(),
    ...this.operatorButtons(),
  ]);

  protected thumbnailUrl(key: ThumbnailKey | undefined): string | undefined {
    return key ? this.thumbnails.thumbnails()[key] : undefined;
  }

  protected isAffordable(button: ToolButton): boolean {
    return button.cost === null || this.engine.state().economy.cash >= button.cost;
  }

  protected onSelectButton(id: ToolId | null): void {
    if (id === null) this.tools.deselect();
    else this.tools.select(id);
  }

  /** The source is fixed in place while the scripted onboarding setup arc is still in progress. */
  private canErase(pos: GridPos): boolean {
    const kind = findEntityAt(this.engine.state(), pos)?.kind;
    return kind !== 'source' || this.onboarding.canEraseSource();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    const key = event.key.toLowerCase();
    switch (key) {
      case 'escape':
        if (this.tools.selectedCell()) this.tools.selectCell(null);
        else this.tools.deselect();
        break;
      case 'delete':
      case 'backspace': {
        const pos = this.tools.selectedCell();
        if (pos && this.canErase(pos)) {
          event.preventDefault();
          this.engine.erase(pos);
          this.tools.selectCell(null);
        }
        break;
      }
      default: {
        const match = this.buttons().find((b) => b.hotkey === key);
        if (match && this.isAffordable(match)) this.onSelectButton(match.id);
      }
    }
  }
}
