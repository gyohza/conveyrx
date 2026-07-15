import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameCanvasComponent } from './game-canvas.component';
import { BuildToolService } from '../../core/services/build-tool.service';
import { GameViewportService } from '../../core/services/game-viewport.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { PixiAppFactory } from '../../core/services/pixi-app-factory.service';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { TileThumbnailService } from '../../core/services/tile-thumbnail.service';
import { UiStateService } from '../../core/services/ui-state.service';
import type { InteractionHandlers } from '../../../render/pixi-app';
import { SETUP_HALLMARK_ID } from '../../content/milestones';
import { SOURCE_COST } from '../../../sim/content/economy';
import { STAGE1_MINES } from '../../../sim/content/stage1-layout';

/** Fast-forwards past the scripted onboarding arc, as if the player had already completed it. */
function completeOnboardingSetup(): void {
  TestBed.inject(OnboardingService).dismiss(SETUP_HALLMARK_ID);
}

function buildFakeApp() {
  const handlers: { current?: InteractionHandlers } = {};
  return {
    handlers,
    app: {
      applyEvents: vi.fn(),
      rebuildStatic: vi.fn(),
      setPreview: vi.fn(),
      setSelection: vi.fn(),
      setSourceSubscribed: vi.fn(),
      refreshCursor: vi.fn(),
      extractThumbnails: vi.fn().mockResolvedValue({
        conveyor: 'data:conveyor',
        map: 'data:map',
        filter: 'data:filter',
        take: 'data:take',
        source: 'data:source',
      }),
      setInteractionHandlers: vi.fn((h: InteractionHandlers) => (handlers.current = h)),
      gridCellRect: vi.fn().mockReturnValue(null),
      destroy: vi.fn(),
    },
  };
}

function configure(create: (...args: unknown[]) => unknown) {
  TestBed.configureTestingModule({
    providers: [{ provide: PixiAppFactory, useValue: { create } }],
  });
}

async function mount() {
  const { handlers, app } = buildFakeApp();
  configure(vi.fn().mockResolvedValue(app));
  const fixture = TestBed.createComponent(GameCanvasComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, app, handlers };
}

describe('GameCanvasComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mounts a PixiGameApp against its host element once the view has rendered', async () => {
    const create = vi.fn().mockResolvedValue(buildFakeApp().app);
    configure(create);

    const fixture = TestBed.createComponent(GameCanvasComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
  });

  it('registers the mounted app with GameViewportService, and clears it on destroy', async () => {
    const { fixture, app } = await mount();
    const viewport = TestBed.inject(GameViewportService);
    const rect = new DOMRect(1, 2, 3, 4);
    app.gridCellRect.mockReturnValue(rect);

    expect(viewport.gridCellRect({ x: 0, y: 0 })).toBe(rect);

    fixture.destroy();

    expect(viewport.gridCellRect({ x: 0, y: 0 })).toBeNull();
  });

  it('publishes extracted tile thumbnails once mounted', async () => {
    await mount();
    const thumbnails = TestBed.inject(TileThumbnailService);

    expect(thumbnails.thumbnails()).toEqual({
      conveyor: 'data:conveyor',
      map: 'data:map',
      filter: 'data:filter',
      take: 'data:take',
      source: 'data:source',
    });
  });

  it('forwards simulation events to the mounted PixiGameApp', async () => {
    const { app } = await mount();
    const engine = TestBed.inject(SimEngineService);

    const events = [{ type: 'packetDespawned' as const, packetId: 1 }];
    engine.events.next(events);

    expect(app.applyEvents).toHaveBeenCalledWith(engine.state(), events);
  });

  it('rebuilds the static world and refreshes the cursor when the layout changes', async () => {
    const { app } = await mount();
    const engine = TestBed.inject(SimEngineService);

    engine.place({ type: 'conveyor', direction: 'east' }, { x: 3, y: 3 });

    expect(app.rebuildStatic).toHaveBeenCalledWith(engine.state());
    expect(app.refreshCursor).toHaveBeenCalled();
  });

  it('places the selected building when the player paints a cell', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    tools.select('conveyor');

    handlers.current!.onPaint({ x: 4, y: 4 }, null, null);

    expect(Object.values(engine.state().conveyors)).toHaveLength(1);
  });

  it('erases on paint when the erase tool is active', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 4, y: 4 });
    tools.select('erase');

    handlers.current!.onPaint({ x: 4, y: 4 }, null, null);

    expect(Object.values(engine.state().conveyors)).toHaveLength(0);
  });

  it('selects an erasable cell when clicked in cursor mode, and clears selection on an empty cell', async () => {
    const { app, handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 2, y: 2 });

    handlers.current!.onPaint({ x: 2, y: 2 }, null, null);
    expect(tools.selectedCell()).toEqual({ x: 2, y: 2 });
    expect(app.setSelection).toHaveBeenCalledWith({ x: 2, y: 2 });

    handlers.current!.onPaint({ x: 5, y: 5 }, null, null);
    expect(tools.selectedCell()).toBeNull();
  });

  it('toggles a source subscription when clicked with no tool selected', async () => {
    const { handlers } = await mount();
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    completeOnboardingSetup();
    const sourceId = Number(Object.keys(engine.state().sources)[0]);

    handlers.current!.onSourceClick(sourceId);

    expect(engine.state().sources[sourceId].subscribed).toBe(true);
  });

  it('refuses to subscribe a source clicked before it is actually wired to the Subscriber, during onboarding', async () => {
    const { handlers } = await mount();
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const sourceId = Number(Object.keys(engine.state().sources)[0]);

    handlers.current!.onSourceClick(sourceId);

    expect(engine.state().sources[sourceId].subscribed).toBe(false);
  });

  it('erases the source instead of toggling it, when clicked with the erase tool active', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    completeOnboardingSetup();
    const sourceId = Number(Object.keys(engine.state().sources)[0]);
    const cashAfterBuilding = engine.state().economy.cash;
    tools.select('erase');

    handlers.current!.onSourceClick(sourceId);

    expect(Object.keys(engine.state().sources)).toHaveLength(0);
    expect(engine.state().economy.cash).toBe(cashAfterBuilding + SOURCE_COST);
  });

  it('refuses to erase the source (via click or paint) while onboarding setup is still in progress', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    const sourceId = Number(Object.keys(engine.state().sources)[0]);
    const sourcePos = engine.state().sources[sourceId].position;
    tools.select('erase');

    handlers.current!.onSourceClick(sourceId);
    expect(Object.keys(engine.state().sources)).toHaveLength(1);

    handlers.current!.onPaint(sourcePos, null, null);
    expect(Object.keys(engine.state().sources)).toHaveLength(1);
  });

  it('erases the source once onboarding setup has completed', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    engine.state().economy.cash = 100;
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    completeOnboardingSetup();
    const sourceId = Number(Object.keys(engine.state().sources)[0]);
    const sourcePos = engine.state().sources[sourceId].position;
    tools.select('erase');

    handlers.current!.onPaint(sourcePos, null, null);

    expect(Object.keys(engine.state().sources)).toHaveLength(0);
  });

  it('places a conveyor facing the drag direction when one is given, ignoring adjacency', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    tools.select('conveyor');

    handlers.current!.onPaint({ x: 4, y: 4 }, 'south', null);

    const placed = Object.values(engine.state().conveyors)[0];
    expect(placed.direction).toBe('south');
  });

  it('retroactively re-aims the previous cell when the drag turns a corner', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    tools.select('conveyor');

    // Drag east then turn south: the corner tile is entered heading east, so it's placed
    // facing east — only once the drag continues south should it be re-aimed.
    handlers.current!.onPaint({ x: 3, y: 3 }, null, null);
    handlers.current!.onPaint({ x: 4, y: 3 }, 'east', { x: 3, y: 3 });
    handlers.current!.onPaint({ x: 4, y: 4 }, 'south', { x: 4, y: 3 });

    const corner = Object.values(engine.state().conveyors).find(
      (c) => c.position.x === 4 && c.position.y === 3,
    );
    expect(corner?.direction).toBe('south');
  });

  it('falls back to continuing a single feeding neighbor for a plain click with no drag direction', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    engine.place({ type: 'conveyor', direction: 'south' }, { x: 4, y: 3 }); // feeds (4,4) from the north
    tools.select('conveyor');

    handlers.current!.onPaint({ x: 4, y: 4 }, null, null);

    const placed = Object.values(engine.state().conveyors).find(
      (c) => c.position.x === 4 && c.position.y === 4,
    );
    expect(placed?.direction).toBe('south');
  });

  it('keeps the renderer selection in sync when it changes outside this component (e.g. the toolbar Delete-key path)', async () => {
    const { fixture, app } = await mount();
    const tools = TestBed.inject(BuildToolService);

    tools.selectCell({ x: 3, y: 3 });
    await fixture.whenStable();
    expect(app.setSelection).toHaveBeenCalledWith({ x: 3, y: 3 });

    tools.selectCell(null);
    await fixture.whenStable();
    expect(app.setSelection).toHaveBeenLastCalledWith(null);
  });

  it('reports empty cells as unclickable in cursor mode, and any cell as clickable with a tool active', async () => {
    const { handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 2, y: 2 });

    expect(handlers.current!.isClickable({ x: 5, y: 5 })).toBe(false);
    expect(handlers.current!.isClickable({ x: 2, y: 2 })).toBe(true);

    tools.select('conveyor');
    expect(handlers.current!.isClickable({ x: 5, y: 5 })).toBe(true);
  });

  it('shows a build ghost when hovering with a tool selected', async () => {
    const { app, handlers } = await mount();
    TestBed.inject(SimEngineService).state().economy.cash = 100;
    TestBed.inject(BuildToolService).select('map');

    handlers.current!.onHover({ x: 4, y: 4 });

    expect(app.setPreview).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'build', tool: 'map', valid: true }),
    );
  });

  it('shows the omnidirectional ghost with no feeding neighbor, and a specific direction once one exists', async () => {
    const { app, handlers } = await mount();
    const engine = TestBed.inject(SimEngineService);
    const tools = TestBed.inject(BuildToolService);
    tools.select('conveyor');

    handlers.current!.onHover({ x: 4, y: 4 });
    expect(app.setPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'build', tool: 'conveyor', omnidirectional: true }),
    );

    engine.place({ type: 'conveyor', direction: 'south' }, { x: 4, y: 3 });
    handlers.current!.onHover({ x: 4, y: 4 });
    expect(app.setPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'build',
        tool: 'conveyor',
        direction: 'south',
        omnidirectional: false,
      }),
    );
  });

  it('shows the live drag direction while painting, then reverts once the drag ends', async () => {
    const { app, handlers } = await mount();
    const tools = TestBed.inject(BuildToolService);
    tools.select('conveyor');

    handlers.current!.onPaint({ x: 4, y: 4 }, 'south', null);
    handlers.current!.onHover({ x: 4, y: 4 });
    expect(app.setPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'build', direction: 'south', omnidirectional: false }),
    );

    handlers.current!.onPaintEnd();
    handlers.current!.onHover({ x: 4, y: 4 });
    expect(app.setPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'build', omnidirectional: true }),
    );
  });

  it('publishes the hovered cell to UiStateService, for DOM UI (e.g. the mine status strip) to react to', async () => {
    const { handlers } = await mount();
    const ui = TestBed.inject(UiStateService);

    handlers.current!.onHover({ x: 4, y: 4 });
    expect(ui.hoveredPos()).toEqual({ x: 4, y: 4 });

    handlers.current!.onHover(null);
    expect(ui.hoveredPos()).toBeNull();
  });

  it('clears the preview when the pointer leaves the grid', async () => {
    const { app, handlers } = await mount();

    handlers.current!.onHover(null);

    expect(app.setPreview).toHaveBeenCalledWith(null);
  });

  it('destroys the mounted PixiGameApp when the component is destroyed', async () => {
    const { fixture, app } = await mount();

    fixture.destroy();

    expect(app.destroy).toHaveBeenCalledTimes(1);
  });

  it('delegates isInteractionAllowed to OnboardingService, so a spotlighted coach-mark can lock out the rest of the map', async () => {
    const { handlers } = await mount();
    const onboarding = TestBed.inject(OnboardingService);

    expect(handlers.current!.isInteractionAllowed(STAGE1_MINES[0].position)).toBe(
      onboarding.isMapInteractionAllowed(STAGE1_MINES[0].position),
    );
    expect(handlers.current!.isInteractionAllowed({ x: 9, y: 9 })).toBe(
      onboarding.isMapInteractionAllowed({ x: 9, y: 9 }),
    );
  });

  it('destroys a PixiGameApp that resolves only after the component was already destroyed', async () => {
    const { app } = buildFakeApp();
    let resolveCreate!: (value: unknown) => void;
    configure(vi.fn().mockReturnValue(new Promise((resolve) => (resolveCreate = resolve))));

    const fixture = TestBed.createComponent(GameCanvasComponent);
    fixture.detectChanges();
    fixture.destroy();
    resolveCreate(app);
    await Promise.resolve();
    await Promise.resolve();

    expect(app.destroy).toHaveBeenCalledTimes(1);
  });
});
