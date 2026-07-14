import { Application, Container, Graphics } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import type { BaseEdge } from '../sim/core/base';
import type { MachineKind } from '../sim/core/entities';
import type { Direction, EntityId, GridRect } from '../sim/core/types';
import type { SimEvent } from '../sim/core/events';
import type { SimState } from '../sim/core/state';
import type { GridPos } from '../sim/core/types';
import { warmGameTextures } from './sprites/game-textures';
import { drawConveyorTile, drawMachineTile, drawSourceTile } from './sprites/shapes';
import { CELL_SIZE, WorldRenderer } from './sync/world-renderer';
import type { Preview } from './sync/world-renderer';

export interface InteractionHandlers {
  onHover(pos: GridPos | null): void;
  /**
   * `previousCell` is the cell painted immediately before this one during the same drag (null on
   * the first cell of a gesture), used to retroactively re-aim that cell once a turn reveals it
   * was a corner (see game-canvas.component.ts's `applyTool`).
   */
  onPaint(pos: GridPos, dragDirection: Direction | null, previousCell: GridPos | null): void;
  onPaintEnd(): void;
  /** Fires instead of `onPaint` when the press lands on a source tile, so dragging across it can't toggle it. */
  onSourceClick(sourceId: EntityId): void;
  /** Fires once per grid-line the pointer crosses while dragging a base wall, instead of `onPaint`. */
  onBaseEdgeDrag(edge: BaseEdge, direction: 1 | -1): void;
  isClickable(pos: GridPos): boolean;
}

const WALL_HIT_TOLERANCE = 8;

function edgeAxis(edge: BaseEdge): 'x' | 'y' {
  return edge === 'east' || edge === 'west' ? 'x' : 'y';
}

function directionBetween(from: GridPos, to: GridPos): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
}

export class PixiGameApp {
  private handlers?: InteractionHandlers;
  private gridSize = { width: 0, height: 0 };
  private sourcePositions = new Map<string, EntityId>();
  private baseRect: GridRect = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  private painting = false;
  private lastPaintedCell: GridPos | null = null;
  private lastHoveredCell: GridPos | null = null;
  private resizingEdge: BaseEdge | null = null;
  private readonly backdrop = new Graphics();

  private constructor(
    private readonly app: Application,
    private readonly world: Container,
    private readonly renderer: WorldRenderer,
  ) {}

  static async create(host: HTMLElement, initialState: SimState): Promise<PixiGameApp> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: 0x0a0a12,
      antialias: true,
      resolution: Math.min(2, globalThis.devicePixelRatio || 1),
      autoDensity: true,
    });
    host.appendChild(app.canvas);

    const world = new Container();
    const renderer = new WorldRenderer(world, warmGameTextures(app.renderer));

    const game = new PixiGameApp(app, world, renderer);
    app.stage.addChild(game.backdrop, world);
    game.rebuildStatic(initialState);
    game.bindPointerEvents();
    app.ticker.add((ticker) => renderer.update(ticker.deltaMS));
    app.renderer.on('resize', () => game.layout());
    game.layout();
    return game;
  }

  setInteractionHandlers(handlers: InteractionHandlers): void {
    this.handlers = handlers;
  }

  rebuildStatic(state: SimState): void {
    this.gridSize = { ...state.grid };
    this.sourcePositions = new Map(
      Object.values(state.sources).map((s) => [cellKey(s.position), s.id]),
    );
    this.baseRect = state.base;
    this.renderer.buildStatic(state);
    this.layout();
  }

  applyEvents(state: SimState, events: SimEvent[]): void {
    this.renderer.applyEvents(state, events);
  }

  clearPackets(): void {
    this.renderer.clearPackets();
  }

  setPreview(preview: Preview | null): void {
    this.renderer.setPreview(preview);
  }

  setSourceSubscribed(state: SimState, sourceId: EntityId, subscribed: boolean): void {
    this.renderer.setSourceSubscribed(state, sourceId, subscribed);
  }

  setSelection(pos: GridPos | null): void {
    this.renderer.setSelection(pos);
  }

  /**
   * A grid edit (e.g. a Delete-key erase, which fires with no pointer event of its own) can
   * change what's clickable under an unmoved cursor — recompute against the last hovered cell.
   */
  refreshCursor(): void {
    this.updateCursor(this.lastHoveredCell, null);
  }

  async extractThumbnails(): Promise<Record<MachineKind | 'conveyor' | 'source', string>> {
    const extract = async (draw: () => Graphics, clearColor?: string) => {
      const g = draw();
      const dataUrl = await this.app.renderer.extract.base64(
        clearColor ? { target: g, clearColor } : g,
      );
      g.destroy();
      return dataUrl;
    };
    const [conveyor, map, filter, take, source] = await Promise.all([
      extract(drawConveyorTile, '#76767c'),
      extract(() => drawMachineTile('map')),
      extract(() => drawMachineTile('filter')),
      extract(() => drawMachineTile('take')),
      extract(drawSourceTile),
    ]);
    return { conveyor, map, filter, take, source };
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }

  private layout(): void {
    const { width, height } = this.app.screen;
    this.drawBackdrop(width, height);

    const gridW = this.gridSize.width * CELL_SIZE;
    const gridH = this.gridSize.height * CELL_SIZE;
    if (gridW === 0 || gridH === 0) return;
    const scale = Math.min(
      2.4,
      Math.max(0.4, Math.min((width - 24) / gridW, (height - 24) / gridH)),
    );
    this.world.scale.set(scale);
    this.world.position.set((width - gridW * scale) / 2, (height - gridH * scale) / 2);
    this.app.stage.hitArea = this.app.screen;
  }

  private drawBackdrop(width: number, height: number): void {
    const g = this.backdrop;
    g.clear();
    const spacing = 28;
    for (let y = spacing / 2; y < height; y += spacing) {
      for (let x = spacing / 2; x < width; x += spacing) {
        g.circle(x, y, 1.1).fill({ color: 0x2a2a3f, alpha: 0.6 });
      }
    }
  }

  private toLocalPoint(event: FederatedPointerEvent): { x: number; y: number } {
    return this.world.toLocal(event.global);
  }

  private toGrid(event: FederatedPointerEvent): GridPos | null {
    const local = this.toLocalPoint(event);
    const pos = { x: Math.floor(local.x / CELL_SIZE), y: Math.floor(local.y / CELL_SIZE) };
    const inside =
      pos.x >= 0 && pos.y >= 0 && pos.x < this.gridSize.width && pos.y < this.gridSize.height;
    return inside ? pos : null;
  }

  /** Hit-tests a raw pixel point against the base's four wall lines (not cells), with a small tolerance for grabbing. */
  private hitWall(point: { x: number; y: number }): BaseEdge | null {
    const rect = this.baseRect;
    const westX = rect.min.x * CELL_SIZE;
    const eastX = (rect.max.x + 1) * CELL_SIZE;
    const northY = rect.min.y * CELL_SIZE;
    const southY = (rect.max.y + 1) * CELL_SIZE;
    const withinVerticalSpan =
      point.y >= northY - WALL_HIT_TOLERANCE && point.y <= southY + WALL_HIT_TOLERANCE;
    const withinHorizontalSpan =
      point.x >= westX - WALL_HIT_TOLERANCE && point.x <= eastX + WALL_HIT_TOLERANCE;
    if (withinVerticalSpan && Math.abs(point.x - westX) <= WALL_HIT_TOLERANCE) return 'west';
    if (withinVerticalSpan && Math.abs(point.x - eastX) <= WALL_HIT_TOLERANCE) return 'east';
    if (withinHorizontalSpan && Math.abs(point.y - northY) <= WALL_HIT_TOLERANCE) return 'north';
    if (withinHorizontalSpan && Math.abs(point.y - southY) <= WALL_HIT_TOLERANCE) return 'south';
    return null;
  }

  /**
   * Steps the dragged edge, one grid-line at a time, from its current (live-updated by
   * `rebuildStatic` after each successful step) position toward the pointer — creeping to a stop
   * at the first refused step rather than jumping straight to the target.
   */
  private updateBaseDrag(point: { x: number; y: number }): void {
    const edge = this.resizingEdge;
    if (!edge) return;
    const axis = edgeAxis(edge);
    const isMax = edge === 'east' || edge === 'south';
    const target = Math.floor((axis === 'x' ? point.x : point.y) / CELL_SIZE);
    for (let guard = 0; guard < 64; guard++) {
      const current = isMax ? this.baseRect.max[axis] : this.baseRect.min[axis];
      if (current === target) return;
      this.handlers?.onBaseEdgeDrag(edge, target > current ? 1 : -1);
      const after = isMax ? this.baseRect.max[axis] : this.baseRect.min[axis];
      if (after === current) return; // the step was refused; stop retrying this move
    }
  }

  private bindPointerEvents(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';

    stage.on('pointermove', (event) => {
      const point = this.toLocalPoint(event);
      if (this.resizingEdge) {
        this.updateBaseDrag(point);
        return;
      }
      const pos = this.toGrid(event);
      this.lastHoveredCell = pos;
      this.handlers?.onHover(pos);
      this.updateCursor(pos, this.hitWall(point));
      if (this.painting && pos && !this.isSameAsLastPainted(pos)) {
        const previousCell = this.lastPaintedCell;
        const dragDirection = previousCell ? directionBetween(previousCell, pos) : null;
        this.lastPaintedCell = pos;
        this.handlers?.onPaint(pos, dragDirection, previousCell);
      }
    });
    stage.on('pointerdown', (event) => {
      const point = this.toLocalPoint(event);
      const pos = this.toGrid(event);
      if (pos) {
        const sourceId = this.sourcePositions.get(cellKey(pos));
        if (sourceId !== undefined) {
          this.handlers?.onSourceClick(sourceId);
          return; // never enters the paint-drag flow, so dragging over it can't toggle it
        }
      }
      const wall = this.hitWall(point);
      if (wall) {
        this.resizingEdge = wall;
        this.app.canvas.style.cursor = edgeAxis(wall) === 'x' ? 'ew-resize' : 'ns-resize';
        return; // never enters the paint-drag flow either
      }
      if (!pos) return;
      this.painting = true;
      this.lastPaintedCell = pos;
      this.handlers?.onPaint(pos, null, null);
      this.updateCursor(pos, null);
    });
    const stopPainting = () => {
      this.painting = false;
      this.lastPaintedCell = null;
      this.resizingEdge = null;
      this.updateCursor(this.lastHoveredCell, null);
      this.handlers?.onPaintEnd();
    };
    stage.on('pointerup', stopPainting);
    stage.on('pointerupoutside', stopPainting);
    stage.on('pointerleave', () => {
      stopPainting();
      this.lastHoveredCell = null;
      this.handlers?.onHover(null);
      this.updateCursor(null, null);
    });
  }

  private isSameAsLastPainted(pos: GridPos): boolean {
    return this.lastPaintedCell?.x === pos.x && this.lastPaintedCell?.y === pos.y;
  }

  private updateCursor(pos: GridPos | null, hoveredWall: BaseEdge | null): void {
    if (this.painting) {
      this.app.canvas.style.cursor = 'grabbing';
      return;
    }
    if (this.resizingEdge) return; // set directly at drag-start and left alone until release
    if (hoveredWall) {
      this.app.canvas.style.cursor = edgeAxis(hoveredWall) === 'x' ? 'ew-resize' : 'ns-resize';
      return;
    }
    const clickable =
      pos !== null &&
      (this.sourcePositions.has(cellKey(pos)) || (this.handlers?.isClickable(pos) ?? false));
    this.app.canvas.style.cursor = clickable ? 'pointer' : 'default';
  }
}

function cellKey(pos: GridPos): string {
  return `${pos.x},${pos.y}`;
}
