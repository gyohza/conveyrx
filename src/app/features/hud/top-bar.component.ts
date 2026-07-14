import { Component, computed, inject } from '@angular/core';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-top-bar',
  template: `
    <header
      class="flex h-12 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4"
    >
      <div class="flex items-baseline gap-3">
        <h1 class="text-base font-bold tracking-wide text-slate-100">
          Convey<span class="text-sky-400">Rx</span>
        </h1>
        <p class="hidden text-xs text-slate-500 sm:block">an RxJS mining rig</p>
      </div>
      <div class="flex items-center gap-3">
        <output
          class="rounded-md border border-emerald-800/60 bg-emerald-950/60 px-3 py-1 font-mono text-sm font-semibold text-emerald-300"
          aria-live="polite"
          aria-label="Cash"
        >
          Ƶ {{ cash().toFixed(2) }}
        </output>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800"
          [disabled]="!engine.canUndo()"
          [attr.title]="'Undo (Ctrl+Z)'"
          (click)="engine.undo()"
        >
          Undo
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800"
          [disabled]="!engine.canRedo()"
          [attr.title]="'Redo (Ctrl+Shift+Z)'"
          (click)="engine.redo()"
        >
          Redo
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800"
          [disabled]="!hasBuildings()"
          (click)="clear()"
        >
          Clear
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-red-900/60 bg-red-950/40 px-3 py-1 text-sm text-red-300 hover:bg-red-900/50"
          (click)="reset()"
        >
          Reset
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
          [class.border-sky-400]="ui.rxSidebarOpen()"
          (click)="ui.rxSidebarOpen.update((open) => !open)"
        >
          &lt;/&gt; Code
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 hover:bg-slate-700"
          (click)="ui.helpOpen.set(true)"
        >
          How to play
        </button>
      </div>
    </header>
  `,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class TopBarComponent {
  protected readonly engine = inject(SimEngineService);
  protected readonly ui = inject(UiStateService);
  protected readonly cash = computed(() => this.engine.state().economy.cash);

  protected readonly hasBuildings = computed(() => {
    const state = this.engine.state();
    return Object.keys(state.conveyors).length > 0 || Object.keys(state.machines).length > 0;
  });

  protected onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) this.engine.redo();
    else this.engine.undo();
  }

  protected clear(): void {
    if (window.confirm('Clear every pipe and operator on the grid?')) {
      this.engine.clearAll();
    }
  }

  protected reset(): void {
    if (window.confirm('Reset the whole game? This restores your starting cash and layout.')) {
      this.engine.resetGame();
    }
  }
}
