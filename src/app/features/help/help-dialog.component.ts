import { Component, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import {
  CONVEYOR_COST,
  SOURCE_COST,
  SUBSCRIPTION_UPKEEP_PER_TICK,
} from '../../../sim/content/economy';
import { MACHINE_DEFS } from '../../../sim/content/machine-defs';
import { MATERIALS } from '../../../sim/content/materials';
import { RECIPES } from '../../../sim/content/recipes';
import { SOURCE_KINDS } from '../../../sim/content/source-kinds';
import { TICK_MS } from '../../../sim/content/timing';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-help-dialog',
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div
        class="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
      >
        <h2 id="help-title" class="text-xl font-bold text-slate-100">
          Welcome to Convey<span class="text-sky-400">Rx</span>
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-300">
          You're running an automated extraction rig on a carbon-rich asteroid. Packets of raw
          material flow through it exactly the way values flow through an
          <span class="font-semibold text-sky-300">RxJS</span> stream — including the part where
          <span class="font-semibold text-slate-100">nothing happens until you subscribe</span>.
        </p>

        <h3 class="mt-5 text-sm font-semibold tracking-wide text-slate-400 uppercase">
          The blocks
        </h3>
        <ul class="mt-2 space-y-2 text-sm text-slate-300">
          <li class="flex items-start gap-3">
            <span
              class="mt-0.5 inline-block size-4 shrink-0 rounded bg-emerald-600"
              aria-hidden="true"
            ></span>
            <span>
              <span class="font-semibold text-emerald-300">{{ sourceKindLabel }}</span> — build it
              onto a marked mine or spring (shown with a ×N yield badge; hover to preview its
              contents), then press its power button to
              <code class="text-emerald-300">.subscribe()</code>; nothing is extracted while it's
              off. It emits that slot's fixed batch, then <span class="italic">completes</span> and
              just sits there — still subscribed, still costing upkeep, producing nothing. Turn it
              off, then on again, to run a fresh batch. A spring yields
              <span class="font-semibold text-sky-200">Ice</span>, mixed with
              <span class="font-semibold text-stone-300">Slag</span> that sells at a loss, so filter
              the Slag out before it reaches Sell.
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span
              class="mt-0.5 inline-block size-4 shrink-0 rounded bg-slate-600"
              aria-hidden="true"
            ></span>
            <span>
              <span class="font-semibold text-slate-200">pipe</span> — carries packets one cell at a
              time (Ƶ{{ conveyorCost }} each)
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span
              class="mt-0.5 inline-block size-4 shrink-0 rounded bg-indigo-600"
              aria-hidden="true"
            ></span>
            <span>
              <span class="font-semibold text-indigo-300">map</span> — the first RxJS operator: it
              can only work with what it's given, using a chosen recipe ({{ recipeFromLabel }} →
              {{ recipeToLabel }}, Ƶ{{ mapCost }})
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span
              class="mt-0.5 inline-block size-4 shrink-0 rounded bg-teal-600"
              aria-hidden="true"
            ></span>
            <span>
              <span class="font-semibold text-teal-300">filter</span> — keeps only the chosen
              material ({{ filterKeepLabel }}); anything else is discarded, not passed on (Ƶ{{
                filterCost
              }})
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span
              class="mt-0.5 inline-block size-4 shrink-0 rounded bg-amber-600"
              aria-hidden="true"
            ></span>
            <span>
              <span class="font-semibold text-amber-300">Sell</span> — consumes packets and pays you
              their material's value (a subscriber): {{ recipeFromLabel }} Ƶ{{ fromPrice }},
              {{ recipeToLabel }} Ƶ{{ toPrice }}, {{ iceLabel }} Ƶ{{ icePrice }},
              {{ slagLabel }} Ƶ{{ slagPrice }}
            </span>
          </li>
        </ul>

        <h3 class="mt-5 text-sm font-semibold tracking-wide text-slate-400 uppercase">Controls</h3>
        <ul class="mt-2 space-y-1 text-sm text-slate-300">
          <li>
            Pick a tool below (each has its own letter shortcut, shown on its button), then click or
            drag on the grid to build.
          </li>
          <li>
            Pipes follow the direction you drag; a plain click continues whatever line is already
            feeding that cell.
          </li>
          <li>Click the {{ sourceKindLabel }} block itself to subscribe/unsubscribe it.</li>
          <li>
            Need more throughput? Build a {{ sourceKindLabel }} onto another mine (Ƶ{{ sourceCost }}
            each) — hover a mine to preview its yield.
          </li>
          <li>
            <span class="font-semibold text-slate-200">Cursor</span> (<kbd
              class="rounded bg-slate-700 px-1"
              >C</kbd
            >
            or <kbd class="rounded bg-slate-700 px-1">Esc</kbd>) gets you back to the plain pointer
            — click a block to select it, then press
            <kbd class="rounded bg-slate-700 px-1">Delete</kbd>
            to erase it.
          </li>
          <li>
            Erase refunds the full price. Blocked pipes jam all the way back — that's backpressure.
            A subscription drains Ƶ{{ upkeepPerMinute.toFixed(2) }}/min continuously the entire time
            it's on, producing or not — that's a memory leak.
          </li>
        </ul>

        <button
          #startButton
          type="button"
          class="mt-6 w-full cursor-pointer rounded-lg bg-sky-500 py-2.5 font-semibold text-sky-950 transition-colors hover:bg-sky-400"
          (click)="ui.helpOpen.set(false)"
        >
          Start building
        </button>
      </div>
    </div>
  `,
  host: {
    '(document:keydown.escape)': 'ui.helpOpen.set(false)',
  },
})
export class HelpDialogComponent {
  protected readonly ui = inject(UiStateService);
  protected readonly conveyorCost = CONVEYOR_COST;
  protected readonly sourceCost = SOURCE_COST;
  protected readonly filterCost = MACHINE_DEFS.filter.cost;
  protected readonly filterKeepLabel = MATERIALS[MACHINE_DEFS.filter.filterableMaterials![0]].label;
  protected readonly sourceKindLabel = SOURCE_KINDS.from.label;
  protected readonly upkeepPerMinute = (SUBSCRIPTION_UPKEEP_PER_TICK * 60000) / TICK_MS;

  private readonly recipe = RECIPES.crystallize;
  protected readonly mapCost = this.recipe.cost;
  protected readonly recipeFromLabel = MATERIALS[this.recipe.from].label;
  protected readonly recipeToLabel = MATERIALS[this.recipe.to].label;
  protected readonly fromPrice = MATERIALS[this.recipe.from].sellPrice;
  protected readonly toPrice = MATERIALS[this.recipe.to].sellPrice;
  protected readonly slagLabel = MATERIALS.slag.label;
  protected readonly slagPrice = MATERIALS.slag.sellPrice;
  protected readonly iceLabel = MATERIALS.ice.label;
  protected readonly icePrice = MATERIALS.ice.sellPrice;

  private readonly startButton = viewChild.required<ElementRef<HTMLButtonElement>>('startButton');

  constructor() {
    afterNextRender(() => this.startButton().nativeElement.focus());
  }
}
