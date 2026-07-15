import { Component, inject, signal } from '@angular/core';
import { OnboardingService } from '../../core/services/onboarding.service';
import { UiStateService } from '../../core/services/ui-state.service';

@Component({
  selector: 'app-tutorial-log',
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-log-title"
    >
      <div
        class="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
      >
        <div class="flex items-center justify-between">
          <h2 id="tutorial-log-title" class="text-xl font-bold text-slate-100">Tutorials</h2>
          <button
            type="button"
            aria-label="Close"
            class="cursor-pointer rounded-md px-2 py-1 text-slate-400 hover:text-slate-200"
            (click)="ui.tutorialLogOpen.set(false)"
          >
            ✕
          </button>
        </div>

        <ul class="mt-4 space-y-2">
          @for (milestone of onboarding.log(); track milestone.id) {
            <li class="rounded-lg border border-slate-700 bg-slate-800/60">
              <button
                type="button"
                [attr.data-milestone-id]="milestone.id"
                class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-100"
                (click)="toggle(milestone.id)"
              >
                {{ milestone.title }}
                @if (!milestone.seen) {
                  <span class="rounded-full bg-sky-500 px-2 py-0.5 text-xs text-sky-950">new</span>
                }
              </button>
              @if (expandedId() === milestone.id) {
                <p class="px-3 pb-3 text-sm leading-relaxed text-slate-300">
                  {{ milestone.body }}
                </p>
              }
            </li>
          }
        </ul>
      </div>
    </div>
  `,
  host: {
    '(document:keydown.escape)': 'ui.tutorialLogOpen.set(false)',
  },
})
export class TutorialLogComponent {
  protected readonly ui = inject(UiStateService);
  protected readonly onboarding = inject(OnboardingService);
  protected readonly expandedId = signal<string | null>(null);

  protected toggle(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
    this.onboarding.dismiss(id);
  }
}
