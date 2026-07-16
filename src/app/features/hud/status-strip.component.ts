import { Component, computed, inject } from '@angular/core';
import { MACHINE_DEFS } from '@sim/content/machine-defs';
import { MATERIALS, countMaterials } from '@sim/content/materials';
import type { MaterialId } from '@sim/content/materials';
import { RECIPES } from '@sim/content/recipes';
import type { RecipeId } from '@sim/content/recipes';
import { takeCost } from '@sim/content/economy';
import type { MachineEntity, MineSpec } from '@sim/core/entities';
import { findEntityAt } from '@sim/core/grid';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { BuildToolService } from '../../core/services/build-tool.service';
import { UiStateService } from '../../core/services/ui-state.service';

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

@Component({
  selector: 'app-status-strip',
  template: `
    <div
      class="flex min-h-9 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-800 bg-slate-900 px-4 py-1.5 text-xs text-slate-400"
    >
      @if (selectedMachine(); as machine) {
        <span class="font-semibold text-sky-300">{{ MACHINE_DEFS[machine.kind].label }}</span>
        <span>{{ MACHINE_DEFS[machine.kind].description }}</span>
        @switch (machine.kind) {
          @case ('map') {
            <label class="flex items-center gap-1.5">
              <span class="sr-only">Recipe</span>
              <select
                class="cursor-pointer rounded bg-slate-950/60 px-1.5 py-1 text-slate-200 focus:outline-2 focus:outline-sky-400"
                (change)="onRecipeChange($event)"
              >
                @for (id of MACHINE_DEFS.map.availableRecipes; track id) {
                  <option [value]="id" [selected]="id === machine.config.recipeId">
                    {{ MATERIALS[RECIPES[id].from].label }} →
                    {{ MATERIALS[RECIPES[id].to].label }} (Ƶ{{ RECIPES[id].cost }})
                  </option>
                }
              </select>
            </label>
          }
          @case ('filter') {
            <span class="flex flex-wrap items-center gap-1">
              @for (material of MACHINE_DEFS.filter.filterableMaterials; track material) {
                <button
                  type="button"
                  class="cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors"
                  [class.border-emerald-500]="machine.config.allow.includes(material)"
                  [class.bg-emerald-950]="machine.config.allow.includes(material)"
                  [class.text-emerald-300]="machine.config.allow.includes(material)"
                  [class.border-slate-700]="!machine.config.allow.includes(material)"
                  [class.text-slate-500]="!machine.config.allow.includes(material)"
                  [attr.aria-pressed]="machine.config.allow.includes(material)"
                  (click)="onToggleFilterMaterial(machine, material)"
                >
                  {{ MATERIALS[material].label }}
                  {{ machine.config.allow.includes(material) ? '· pass' : '· block' }}
                </button>
              }
              <span class="text-emerald-400">Ƶ{{ MACHINE_DEFS.filter.cost }}</span>
            </span>
          }
          @case ('take') {
            <label class="flex items-center gap-1.5">
              <span class="sr-only">Count</span>
              <select
                class="cursor-pointer rounded bg-slate-950/60 px-1.5 py-1 text-slate-200 focus:outline-2 focus:outline-sky-400"
                (change)="onCountChange($event)"
              >
                @for (n of MACHINE_DEFS.take.availableCounts; track n) {
                  <option [value]="n" [selected]="n === machine.config.count">
                    {{ n }} (Ƶ{{ takeCost(n) }})
                  </option>
                }
              </select>
            </label>
          }
        }
      } @else if (hoveredMine(); as mine) {
        <span
          class="font-semibold"
          [class.text-teal-300]="!isSpring(mine)"
          [class.text-purple-300]="isSpring(mine)"
        >
          {{ isSpring(mine) ? 'Spring' : 'Mine' }}
        </span>
        <span>{{ summary(mine) }}</span>
        <span class="flex gap-1">
          @for (material of mine.sequence; track $index) {
            <span
              class="flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-slate-950"
              [style.background-color]="colorHex(MATERIALS[material].color)"
            >
              {{ MATERIALS[material].shortLabel }}
            </span>
          }
        </span>
      } @else {
        <span>Hover a mine to preview its yield, or select a built operator to configure it</span>
      }
    </div>
  `,
})
export class StatusStripComponent {
  private readonly ui = inject(UiStateService);
  private readonly engine = inject(SimEngineService);
  private readonly tools = inject(BuildToolService);
  protected readonly colorHex = colorHex;
  protected readonly MATERIALS = MATERIALS;
  protected readonly MACHINE_DEFS = MACHINE_DEFS;
  protected readonly RECIPES = RECIPES;
  protected readonly takeCost = takeCost;

  protected readonly selectedMachine = computed<MachineEntity | null>(() => {
    const pos = this.tools.selectedCell();
    if (!pos) return null;
    const entity = findEntityAt(this.engine.state(), pos);
    if (!entity || entity.kind !== 'machine') return null;
    return this.engine.state().machines[entity.id];
  });

  protected readonly hoveredMine = computed(() => {
    const pos = this.ui.hoveredPos();
    if (!pos) return null;
    return (
      this.engine
        .state()
        .mines.find((mine) => mine.position.x === pos.x && mine.position.y === pos.y) ?? null
    );
  });

  protected isSpring(mine: MineSpec): boolean {
    return new Set(mine.sequence).size > 1;
  }

  protected summary(mine: MineSpec): string {
    return [...countMaterials(mine.sequence).entries()]
      .map(([material, count]) => `${count}×${MATERIALS[material].label}`)
      .join(', ');
  }

  protected onRecipeChange(event: Event): void {
    const pos = this.tools.selectedCell();
    if (!pos) return;
    const recipeId = (event.target as HTMLSelectElement).value as RecipeId;
    this.engine.reconfigureMachine(pos, { kind: 'map', recipeId });
  }

  protected onCountChange(event: Event): void {
    const pos = this.tools.selectedCell();
    if (!pos) return;
    const count = Number((event.target as HTMLSelectElement).value);
    this.engine.reconfigureMachine(pos, { kind: 'take', count });
  }

  protected onToggleFilterMaterial(machine: MachineEntity, material: MaterialId): void {
    const pos = this.tools.selectedCell();
    if (!pos || machine.kind !== 'filter') return;
    const allow = machine.config.allow.includes(material)
      ? machine.config.allow.filter((m) => m !== material)
      : [...machine.config.allow, material];
    this.engine.reconfigureMachine(pos, { kind: 'filter', allow });
  }
}
