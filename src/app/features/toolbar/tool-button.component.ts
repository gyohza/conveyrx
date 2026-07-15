import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-tool-button',
  host: {
    class: 'landscape:block landscape:w-full',
    '[attr.data-coachmark]': 'id() && "tool-" + id()',
  },
  template: `
    <div
      class="flex min-w-36 shrink-0 flex-col overflow-hidden rounded-lg border transition-colors landscape:w-full"
      [class.border-sky-400]="pressed()"
      [class.bg-sky-950]="pressed()"
      [class.text-sky-100]="pressed()"
      [class.border-slate-700]="!pressed()"
      [class.bg-slate-800]="!pressed()"
      [class.text-slate-200]="!pressed()"
      [class.opacity-40]="!affordable()"
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-sm disabled:cursor-not-allowed"
        [disabled]="!affordable()"
        [attr.aria-pressed]="pressed()"
        [attr.title]="tooltip()"
        (click)="picked.emit()"
      >
        <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-950/60">
          @if (thumbnailUrl(); as url) {
            <img [src]="url" alt="" class="size-8" />
          } @else if (icon() === 'cursor') {
            <svg viewBox="0 0 24 24" class="size-5 text-slate-300" fill="currentColor">
              <path d="M5 3l14 8.5-6.2 1.3L11 19z" />
            </svg>
          } @else if (icon() === 'erase') {
            <svg
              viewBox="0 0 24 24"
              class="size-5 text-slate-300"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 3l4 4-10 10H7l-4-4 10-10z" />
              <path d="M7 21h12" />
            </svg>
          }
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 font-semibold">
            {{ label() }}
            <span
              class="rounded bg-slate-950/70 px-1 text-[9px] font-normal text-slate-400 uppercase"
              aria-hidden="true"
              >{{ hotkey() }}</span
            >
          </span>
          <span class="block truncate text-[11px] text-slate-400">
            {{ detail() }}
            @if (cost() !== null) {
              · <span class="text-emerald-400">Ƶ{{ cost() }}</span>
            }
          </span>
        </span>
      </button>
      @if (docsUrl(); as url) {
        <a
          [href]="url"
          target="_blank"
          rel="noopener"
          class="block border-t border-slate-950/40 bg-slate-950/30 px-2.5 py-1 text-[10px] text-sky-400 hover:text-sky-300 hover:underline"
          (click)="$event.stopPropagation()"
        >
          RxJS docs ↗
        </a>
      }
    </div>
  `,
})
export class ToolButtonComponent {
  readonly id = input<string | null>(null);
  readonly label = input.required<string>();
  readonly detail = input.required<string>();
  readonly tooltip = input<string | undefined>(undefined);
  readonly cost = input<number | null>(null);
  readonly hotkey = input.required<string>();
  readonly thumbnailUrl = input<string | undefined>(undefined);
  readonly icon = input<'cursor' | 'erase' | undefined>(undefined);
  readonly pressed = input(false);
  readonly affordable = input(true);
  readonly docsUrl = input<string | undefined>(undefined);
  readonly picked = output<void>();
}
