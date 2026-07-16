import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import type { Subscription } from 'rxjs';
import { BuildToolService } from '../../core/services/build-tool.service';
import { GameViewportService } from '../../core/services/game-viewport.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { PixiAppFactory } from '../../core/services/pixi-app-factory.service';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { TileThumbnailService } from '../../core/services/tile-thumbnail.service';
import { UiStateService } from '../../core/services/ui-state.service';
import type { PixiGameApp } from '@render/pixi-app';
import type { Preview } from '@render/sync/world-renderer';
import { findEntityAt } from '@sim/core/grid';
import { feederDirection, inferConveyorDirection } from '@sim/core/routing';
import type { Direction, GridPos } from '@sim/core/types';

@Component({
  selector: 'app-game-canvas',
  template: `<div
    #host
    class="h-full w-full"
    role="img"
    aria-label="Factory simulation view"
  ></div>`,
})
export class GameCanvasComponent {
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly engine = inject(SimEngineService);
  private readonly tools = inject(BuildToolService);
  private readonly onboarding = inject(OnboardingService);
  private readonly pixiAppFactory = inject(PixiAppFactory);
  private readonly viewport = inject(GameViewportService);
  private readonly thumbnails = inject(TileThumbnailService);
  private readonly ui = inject(UiStateService);
  private pixiApp?: PixiGameApp;
  private readonly subscriptions: Subscription[] = [];
  private hoveredCell: GridPos | null = null;
  private activeDragDirection: Direction | null = null;
  private destroyed = false;

  constructor() {
    afterNextRender(() => void this.mount());
    inject(DestroyRef).onDestroy(() => this.teardown());
    effect(() => {
      this.tools.tool();
      this.engine.state();
      this.refreshPreview();
    });
    // Read `selectedCell()` unconditionally before the `pixiApp?.` check: gating it behind the
    // optional chain would let the very first run (pixiApp still undefined pre-mount)
    // short-circuit past the signal read entirely, so the effect would never re-fire on change.
    effect(() => {
      const pos = this.tools.selectedCell();
      this.pixiApp?.setSelection(pos);
    });
  }

  private async mount(): Promise<void> {
    const app = await this.pixiAppFactory.create(this.host().nativeElement, this.engine.state());
    if (this.destroyed) {
      app.destroy();
      return;
    }
    this.pixiApp = app;
    this.viewport.register(app);
    app.setInteractionHandlers({
      onHover: (pos) => {
        this.hoveredCell = pos;
        this.ui.hoveredPos.set(pos);
        this.refreshPreview();
      },
      onPaint: (pos, dragDirection, previousCell) => {
        if (dragDirection) this.activeDragDirection = dragDirection;
        this.applyTool(pos, dragDirection, previousCell);
      },
      onPaintEnd: () => {
        this.activeDragDirection = null;
        this.refreshPreview();
      },
      onSourceClick: (sourceId) => {
        if (this.tools.tool() === 'erase') {
          const position = this.engine.state().sources[sourceId]?.position;
          if (position && this.canEraseAt(position)) this.engine.erase(position);
          return;
        }
        if (this.onboarding.canSubscribe(sourceId)) this.engine.toggleSubscribe(sourceId);
      },
      onBaseEdgeDrag: (edge, direction) => this.engine.resizeBaseEdge(edge, direction),
      isClickable: (pos) => this.isClickable(pos),
      isInteractionAllowed: (pos) => this.onboarding.isMapInteractionAllowed(pos),
    });
    this.subscriptions.push(
      this.engine.events.subscribe((events) => app.applyEvents(this.engine.state(), events)),
      this.engine.layoutChanged.subscribe(() => {
        app.rebuildStatic(this.engine.state());
        app.refreshCursor();
      }),
      this.engine.sourceSubscriptionChanged.subscribe(({ sourceId, subscribed }) =>
        app.setSourceSubscribed(this.engine.state(), sourceId, subscribed),
      ),
      this.engine.historyRestored.subscribe(() => app.clearPackets()),
    );
    const tileThumbnails = await app.extractThumbnails();
    this.thumbnails.set('conveyor', tileThumbnails.conveyor);
    this.thumbnails.set('map', tileThumbnails.map);
    this.thumbnails.set('filter', tileThumbnails.filter);
    this.thumbnails.set('take', tileThumbnails.take);
    this.thumbnails.set('source', tileThumbnails.source);
  }

  private applyTool(
    pos: GridPos,
    dragDirection: Direction | null,
    previousCell: GridPos | null,
  ): void {
    const tool = this.tools.tool();
    if (tool === null) {
      const selected = this.canEraseAt(pos) ? pos : null;
      this.tools.selectCell(selected);
      this.pixiApp?.setSelection(selected);
      return;
    }
    if (tool === 'erase') {
      if (this.canEraseAt(pos)) this.engine.erase(pos);
      return;
    }
    if (tool === 'conveyor') {
      // previousCell was placed pointing straight on when entered; a turn now reveals it's a
      // corner, so re-aim it toward the cell we're entering.
      if (dragDirection && previousCell) this.engine.redirectConveyor(previousCell, dragDirection);
      const direction = dragDirection ?? inferConveyorDirection(this.engine.state(), pos);
      this.engine.place({ type: 'conveyor', direction }, pos);
      return;
    }
    const request = this.tools.buildRequest();
    if (request) this.engine.place(request, pos);
  }

  private isClickable(pos: GridPos): boolean {
    return this.tools.tool() === null ? this.canEraseAt(pos) : true;
  }

  /**
   * The player must not delete the source out from under themselves mid-way through the scripted
   * onboarding arc — several coach-marks anchor to it and its pipe connection by grid position.
   */
  private canEraseAt(pos: GridPos): boolean {
    if (!this.engine.canErase(pos)) return false;
    const kind = findEntityAt(this.engine.state(), pos)?.kind;
    return kind !== 'source' || this.onboarding.canEraseSource();
  }

  private refreshPreview(): void {
    if (!this.pixiApp) return;
    this.pixiApp.setPreview(this.buildPreview());
  }

  private buildPreview(): Preview | null {
    const pos = this.hoveredCell;
    if (!pos) return null;
    const tool = this.tools.tool();
    if (tool === null) return { kind: 'hover', pos };
    if (tool === 'erase') return { kind: 'erase', pos, valid: this.canEraseAt(pos) };
    if (tool === 'conveyor') {
      const state = this.engine.state();
      const feeder = this.activeDragDirection ?? feederDirection(state, pos);
      const direction = feeder ?? inferConveyorDirection(state, pos);
      return {
        kind: 'build',
        pos,
        tool: 'conveyor',
        direction,
        omnidirectional: feeder === null,
        valid: this.engine.canPlace({ type: 'conveyor', direction }, pos),
      };
    }
    const request = this.tools.buildRequest();
    if (!request) return { kind: 'hover', pos };
    return {
      kind: 'build',
      pos,
      tool,
      direction: 'east',
      valid: this.engine.canPlace(request, pos),
    };
  }

  private teardown(): void {
    this.destroyed = true;
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.viewport.clear();
    this.pixiApp?.destroy();
  }
}
