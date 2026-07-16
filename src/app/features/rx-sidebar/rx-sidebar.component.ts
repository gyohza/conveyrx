import { Component, computed, inject, signal } from '@angular/core';
import { tokenizeCode } from '@render/ts-highlight';
import type { CodeTokenKind } from '@render/ts-highlight';
import { RxLogService } from '../../core/services/rx-log.service';
import { UiStateService } from '../../core/services/ui-state.service';

const TOKEN_CLASSES: Record<CodeTokenKind, string> = {
  keyword: 'text-purple-400',
  fn: 'text-sky-400',
  type: 'text-emerald-300',
  number: 'text-amber-300',
  comment: 'text-slate-500 italic',
  punct: 'text-slate-400',
  plain: 'text-slate-200',
};

const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const RESERVED_FOR_TOOLBAR_AND_GRID = 500;

@Component({
  selector: 'app-rx-sidebar',
  template: `
    <aside
      class="relative flex h-full max-w-full shrink-0 flex-col border-l border-slate-800 bg-slate-950/95"
      [style.width.px]="width()"
    >
      <div
        class="absolute top-0 bottom-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none hover:bg-sky-500/50"
        [class.bg-sky-500]="resizing()"
        (pointerdown)="onHandleDown($event)"
      ></div>
      <header
        class="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4"
      >
        <h2 class="text-sm font-semibold tracking-wide text-slate-200">RxJS view</h2>
        <button
          type="button"
          class="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          (click)="ui.rxSidebarOpen.set(false)"
        >
          Close
        </button>
      </header>
      <pre
        class="min-h-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed whitespace-pre text-slate-300"
      >@for (token of tokens(); track $index) {<span [class]="classFor(token.kind)">{{ token.text }}</span>}</pre>
    </aside>
  `,
  host: {
    '(document:pointermove)': 'onDocPointerMove($event)',
    '(document:pointerup)': 'onDocPointerUp()',
  },
})
export class RxSidebarComponent {
  protected readonly ui = inject(UiStateService);
  private readonly log = inject(RxLogService);

  protected readonly width = signal(DEFAULT_WIDTH);
  protected readonly resizing = signal(false);
  private dragStartX = 0;
  private dragStartWidth = 0;

  protected readonly tokens = computed(() => tokenizeCode(this.log.code()));

  protected classFor(kind: CodeTokenKind): string {
    return TOKEN_CLASSES[kind];
  }

  protected onHandleDown(event: PointerEvent): void {
    this.resizing.set(true);
    this.dragStartX = event.clientX;
    this.dragStartWidth = this.width();
    event.preventDefault();
  }

  protected onDocPointerMove(event: PointerEvent): void {
    if (!this.resizing()) return;
    const grown = this.dragStartX - event.clientX; // handle sits on the sidebar's left edge
    const dynamicMax = Math.max(
      MIN_WIDTH,
      Math.min(MAX_WIDTH, window.innerWidth - RESERVED_FOR_TOOLBAR_AND_GRID),
    );
    this.width.set(Math.min(dynamicMax, Math.max(MIN_WIDTH, this.dragStartWidth + grown)));
  }

  protected onDocPointerUp(): void {
    this.resizing.set(false);
  }
}
