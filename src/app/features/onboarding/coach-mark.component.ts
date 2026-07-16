import { Component, computed, inject, signal } from '@angular/core';
import { computeBubblePlacement } from './coach-mark-placement';
import { computeSpotlightLayout } from './coach-mark-spotlight';
import { renderMiniMarkdown } from './mini-markdown';
import type { MilestoneAnchor } from '../../content/milestones';
import { GameViewportService } from '../../core/services/game-viewport.service';
import { OnboardingService } from '../../core/services/onboarding.service';

@Component({
  selector: 'app-coach-mark',
  template: `
    @if (visibleMilestone(); as milestone) {
      @if (milestone.anchor.kind === 'none') {
        <div
          class="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
          role="status"
          aria-live="polite"
        >
          <div
            class="w-full max-w-sm rounded-xl border border-sky-800/60 bg-slate-900/95 p-5 shadow-xl"
          >
            <p
              class="text-base font-semibold text-sky-300"
              [innerHTML]="renderMarkdown(milestone.title)"
            ></p>
            <p
              class="mt-2 text-sm leading-relaxed text-slate-300"
              [innerHTML]="renderMarkdown(milestone.body)"
            ></p>
            @if (milestone.link; as link) {
              <a
                [href]="link.url"
                target="_blank"
                rel="noopener"
                class="mt-2 inline-block text-xs text-sky-400 hover:text-sky-300 hover:underline"
              >
                {{ link.label }} ↗
              </a>
            }
            @if (!milestone.autoCompleteWhen) {
              <div class="mt-3 flex justify-end">
                <button
                  type="button"
                  class="cursor-pointer rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-sky-950 hover:bg-sky-400"
                  (click)="onboarding.dismiss(milestone.id)"
                >
                  Got it
                </button>
              </div>
            }
          </div>
        </div>
      } @else {
        @if (milestone.spotlight !== false && spotlight().hole; as hole) {
          @for (band of spotlight().bands; track $index) {
            <div
              class="pointer-events-auto fixed z-30 bg-black/70"
              [style.top.px]="band.top"
              [style.left.px]="band.left"
              [style.width.px]="band.width"
              [style.height.px]="band.height"
            ></div>
          }
          <div
            class="pointer-events-none fixed z-30 rounded-md ring-2 ring-sky-400"
            [style.top.px]="hole.top"
            [style.left.px]="hole.left"
            [style.width.px]="hole.width"
            [style.height.px]="hole.height"
          ></div>
        }
        <div
          class="pointer-events-auto fixed z-40 w-80 max-w-[calc(100vw-16px)] rounded-xl border border-sky-800/60 bg-slate-900/95 p-3 shadow-xl backdrop-blur-sm"
          role="status"
          aria-live="polite"
          [style.top.px]="placement().top"
          [style.left.px]="placement().left"
        >
          <div
            class="absolute size-2.5 rotate-45 bg-slate-900"
            [class]="arrowBorderClasses()"
            [style.left.px]="placement().arrowLeft"
            [style.top.px]="placement().arrowSide === 'top' ? -6 : null"
            [style.bottom.px]="placement().arrowSide === 'bottom' ? -6 : null"
          ></div>
          <p
            class="text-sm font-semibold text-sky-300"
            [innerHTML]="renderMarkdown(milestone.title)"
          ></p>
          <p
            class="mt-1 text-sm leading-snug text-slate-300"
            [innerHTML]="renderMarkdown(milestone.body)"
          ></p>
          @if (!milestone.autoCompleteWhen) {
            <div class="mt-2 flex justify-end">
              <button
                type="button"
                class="cursor-pointer rounded-md bg-sky-500 px-2.5 py-1 text-xs font-semibold text-sky-950 hover:bg-sky-400"
                (click)="onboarding.dismiss(milestone.id)"
              >
                Got it
              </button>
            </div>
          }
        </div>
      }
    }
  `,
  host: {
    '(window:resize)': 'viewportTick.update(n => n + 1)',
  },
})
export class CoachMarkComponent {
  protected readonly onboarding = inject(OnboardingService);
  private readonly viewport = inject(GameViewportService);
  protected readonly viewportTick = signal(0);
  protected readonly renderMarkdown = renderMiniMarkdown;

  /**
   * Grid/gridRect anchors need the Pixi canvas mounted to resolve a real position — showing them
   * any earlier (e.g. right after a page load/reload) would fall back to a bubble pointing
   * nowhere. DOM and splash anchors don't depend on Pixi, so they're never held back.
   */
  protected readonly visibleMilestone = computed(() => {
    const milestone = this.onboarding.active();
    if (!milestone) return null;
    const kind = milestone.anchor.kind;
    if ((kind === 'grid' || kind === 'gridRect') && !this.viewport.ready()) return null;
    return milestone;
  });

  private readonly anchorRect = computed(() => {
    this.viewportTick();
    const milestone = this.visibleMilestone();
    return milestone ? this.resolveAnchor(milestone.anchor) : null;
  });

  private readonly viewportSize = computed(() => {
    this.viewportTick();
    return { width: window.innerWidth, height: window.innerHeight };
  });

  protected readonly placement = computed(() =>
    computeBubblePlacement(this.anchorRect(), this.viewportSize()),
  );

  protected readonly spotlight = computed(() =>
    computeSpotlightLayout(this.anchorRect(), this.viewportSize()),
  );

  protected readonly arrowBorderClasses = computed(() =>
    this.placement().arrowSide === 'top'
      ? 'border-t border-l border-sky-800/60'
      : 'border-b border-r border-sky-800/60',
  );

  private resolveAnchor(anchor: MilestoneAnchor): DOMRect | null {
    if (anchor.kind === 'none') return null;
    if (anchor.kind === 'dom') {
      return document.querySelector(anchor.selector)?.getBoundingClientRect() ?? null;
    }
    if (anchor.kind === 'gridRect') {
      const rect = anchor.rect(this.onboarding.context());
      return rect ? this.viewport.gridRect(rect) : null;
    }
    const pos = anchor.pos(this.onboarding.context());
    return pos ? this.viewport.gridCellRect(pos) : null;
  }
}
