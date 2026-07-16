import { Injectable, computed, inject, signal } from '@angular/core';
import {
  declareAllSources,
  sourceVarName,
  subVarName,
  subscribeStatement,
  unsubscribeStatement,
} from '@render/rx-codegen';
import type { EntityId } from '@sim/core/types';
import { SimEngineService } from './sim-engine.service';

@Injectable({ providedIn: 'root' })
export class RxLogService {
  private readonly engine = inject(SimEngineService);
  private readonly declarationsSignal = signal('');
  private readonly activitySignal = signal<string[]>([]);
  private readonly everSubscribed = new Set<EntityId>();

  readonly code = computed(() => {
    const activity = this.activitySignal();
    const declarations = this.declarationsSignal();
    return activity.length === 0 ? declarations : `${declarations}\n\n${activity.join('\n')}`;
  });

  constructor() {
    this.reset();
    this.engine.layoutChanged.subscribe(() => this.reset());
    this.engine.sourceSubscriptionChanged.subscribe(({ sourceId, subscribed }) =>
      this.logToggle(sourceId, subscribed),
    );
  }

  private reset(): void {
    this.declarationsSignal.set(declareAllSources(this.engine.state()));
    this.activitySignal.set([]);
    this.everSubscribed.clear();
  }

  private logToggle(sourceId: EntityId, subscribed: boolean): void {
    const state = this.engine.state();
    const source = state.sources[sourceId];
    if (!source) return;

    let line: string;
    if (subscribed) {
      line = subscribeStatement(
        state,
        source,
        sourceVarName(state, source),
        subVarName(state, source),
        !this.everSubscribed.has(sourceId),
      );
      this.everSubscribed.add(sourceId);
    } else {
      line = unsubscribeStatement(subVarName(state, source));
    }

    this.activitySignal.update((lines) => [...lines, line]);
  }
}
