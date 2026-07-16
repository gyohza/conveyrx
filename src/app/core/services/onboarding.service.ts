import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  MILESTONES,
  SETUP_HALLMARK_ID,
  groupContaining,
  hasDrainingExhaustedSource,
  isGroupHallmark,
  isMilestoneComplete,
} from '../../content/milestones';
import type { MilestoneContext, MilestoneDef } from '../../content/milestones';
import { isInsideBase } from '@sim/core/base';
import { isSourceConnectedToBase } from '@sim/core/routing';
import type { EntityId, GridPos } from '@sim/core/types';
import { clearSeenIds, loadSeenIds, saveSeenIds } from './onboarding-save';
import { BuildToolService } from './build-tool.service';
import { SimEngineService } from './sim-engine.service';

export interface LoggedMilestone extends MilestoneDef {
  seen: boolean;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly engine = inject(SimEngineService);
  private readonly tools = inject(BuildToolService);
  private readonly seenSignal = signal<Set<string>>(loadSeenIds());
  private readonly hasLeaked = signal(false);

  readonly context = computed<MilestoneContext>(() => ({
    state: this.engine.state(),
    tool: this.tools.tool(),
    hasLeakedBefore: this.hasLeaked(),
  }));

  private readonly pending = computed<MilestoneDef[]>(() => {
    const ctx = this.context();
    const seen = this.seenSignal();
    return MILESTONES.filter((m) => !seen.has(m.id) && m.isTriggered(ctx));
  });

  readonly active = computed<MilestoneDef | null>(() => this.pending()[0] ?? null);

  /** True once the scripted setup arc (pick tool -> place -> pipe -> connect -> subscribe) is done. */
  readonly isSetupComplete = computed(() => this.seenSignal().has(SETUP_HALLMARK_ID));

  readonly log = computed<LoggedMilestone[]>(() => {
    const ctx = this.context();
    const seen = this.seenSignal();
    return MILESTONES.filter((m) => m.isTriggered(ctx) || seen.has(m.id)).map((m) => ({
      ...m,
      seen: seen.has(m.id),
    }));
  });

  constructor() {
    effect(() => {
      if (hasDrainingExhaustedSource(this.engine.state())) this.hasLeaked.set(true);
    });
    effect(() => {
      const ctx = this.context();
      const seen = this.seenSignal();
      for (const milestone of MILESTONES) {
        if (!seen.has(milestone.id) && isMilestoneComplete(milestone, ctx)) {
          this.dismiss(milestone.id);
        }
      }
    });
  }

  /** The source is fixed in place while the scripted setup arc is still in progress. */
  canEraseSource(): boolean {
    return this.isSetupComplete();
  }

  /** Subscribing is the intended *next* action once wired — not before, even if the engine allows it. */
  canSubscribe(sourceId: EntityId): boolean {
    if (this.isSetupComplete()) return true;
    const state = this.engine.state();
    const source = state.sources[sourceId];
    return source !== undefined && isSourceConnectedToBase(state, source);
  }

  /**
   * A spotlighted milestone darkens everything outside its anchor, so the map must reject
   * hover/click there too — otherwise the game's own cursor highlight visibly reacts to a cell the
   * player can't actually act on. `{ spotlight: false }` milestones (e.g. wiring pipes across the
   * whole grid) opt out entirely and always allow interaction.
   */
  isMapInteractionAllowed(pos: GridPos): boolean {
    const milestone = this.active();
    if (!milestone || milestone.spotlight === false || milestone.anchor.kind === 'none') {
      return true;
    }
    if (milestone.anchor.kind === 'dom') return false;
    if (milestone.anchor.kind === 'gridRect') {
      const rect = milestone.anchor.rect(this.context());
      return rect !== null && isInsideBase(rect, pos);
    }
    const target = milestone.anchor.pos(this.context());
    return target !== null && target.x === pos.x && target.y === pos.y;
  }

  dismiss(id: string): void {
    this.seenSignal.update((prev) => new Set(prev).add(id));
    if (!groupContaining(id) || isGroupHallmark(id)) {
      saveSeenIds(this.seenSignal());
    }
  }

  reset(): void {
    this.seenSignal.set(new Set());
    clearSeenIds();
  }
}
