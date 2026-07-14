import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { MACHINE_DEFS } from '../../sim/content/machine-defs';
import { MATERIALS, countMaterials } from '../../sim/content/materials';
import type { MaterialId } from '../../sim/content/materials';
import { RECIPES } from '../../sim/content/recipes';
import { TICK_MS } from '../../sim/content/timing';
import type { MachineEntity, MachineKind, SourceEntity } from '../../sim/core/entities';
import type { SimEvent } from '../../sim/core/events';
import { findEntityAt } from '../../sim/core/grid';
import {
  conveyorLanes,
  isBasePowered,
  machinePorts,
  poweredConveyors,
} from '../../sim/core/routing';
import type { SimState } from '../../sim/core/state';
import { directionToRadians } from '../../sim/core/types';
import type { Direction, EntityId, GridPos, GridRect, PacketId } from '../../sim/core/types';
import type { GameTextures } from '../sprites/game-textures';
import { CELL_SIZE } from '../sprites/shapes';

export { CELL_SIZE, TICK_MS };

export type Preview =
  | {
      kind: 'build';
      pos: GridPos;
      tool: 'conveyor' | 'source' | MachineKind;
      direction: Direction;
      omnidirectional?: boolean;
      valid: boolean;
    }
  | { kind: 'erase'; pos: GridPos; valid: boolean }
  | { kind: 'hover'; pos: GridPos };

interface PacketView {
  root: Container;
  body: Sprite;
  label: Text;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  progress: number;
  scale: number;
  scaleTarget: number;
  pulse: number;
  despawning: boolean;
}

const SUBSCRIBED_TINT = 0x4ade80;
const UNSUBSCRIBED_TINT = 0x64748b;

const COUNTER_COLOR = 0xbfdbfe;
const COUNTER_EMPTY_COLOR = 0xef4444;
const COUNTER_BLINK_MS = 400;

const BASE_FILL = 0xd97706;
const BASE_WALL = 0xfef3c7;

const LANE_COLORS = [
  0x22d3ee, 0xf472b6, 0x60a5fa, 0x4ade80, 0xa78bfa, 0xfb923c, 0x2dd4bf, 0xf87171,
];
const GLOW_ALPHA = 0.9;

/** Baked for one clockwise turn (west→south); the other 7 are that same texture rotated and/or mirrored (scale.x = -1). */
interface CurveOrientation {
  inSide: Direction;
  outSide: Direction;
  rotation: Direction;
  flip: boolean;
}

const CURVE_ORIENTATIONS: CurveOrientation[] = [
  { inSide: 'west', outSide: 'south', rotation: 'east', flip: false },
  { inSide: 'north', outSide: 'west', rotation: 'south', flip: false },
  { inSide: 'east', outSide: 'north', rotation: 'west', flip: false },
  { inSide: 'south', outSide: 'east', rotation: 'north', flip: false },
  { inSide: 'east', outSide: 'south', rotation: 'east', flip: true },
  { inSide: 'south', outSide: 'west', rotation: 'south', flip: true },
  { inSide: 'west', outSide: 'north', rotation: 'west', flip: true },
  { inSide: 'north', outSide: 'east', rotation: 'north', flip: true },
];

function pickConveyorCurve(
  inSide: Direction | null,
  outSide: Direction,
): CurveOrientation | undefined {
  return inSide
    ? CURVE_ORIENTATIONS.find((o) => o.inSide === inSide && o.outSide === outSide)
    : undefined;
}

export function cellCenter(pos: GridPos): { x: number; y: number } {
  return { x: (pos.x + 0.5) * CELL_SIZE, y: (pos.y + 0.5) * CELL_SIZE };
}

function machineSubLabel(machine: MachineEntity): string {
  if (machine.kind === 'map') {
    const recipe = RECIPES[machine.config.recipeId];
    return `${MATERIALS[recipe.from].shortLabel}→${MATERIALS[recipe.to].shortLabel}`;
  }
  if (machine.kind === 'filter') {
    return `pass ${machine.config.allow.map((m) => MATERIALS[m].shortLabel).join('')}`;
  }
  return `take ${machine.config.count}`;
}

/** Rasterized past the world container's 2.4x max zoom (see TILE_TEXTURE_RESOLUTION in game-textures.ts) to stay crisp. */
const LABEL_RESOLUTION = 3;

function makeLabel(text: string, size: number, color: number, bold = false): Text {
  const label = new Text({
    text,
    resolution: LABEL_RESOLUTION,
    style: {
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: size,
      fill: color,
      fontWeight: bold ? '700' : '600',
      padding: 4,
    },
  });
  label.anchor.set(0.5);
  return label;
}

/** Module-scoped so the crater field stays stable across every buildStatic rebuild within a session, but still varies between sessions. */
const SURFACE_SEED = Math.random() * 1000;

function hash2(x: number, y: number): number {
  const h = Math.sin((x + SURFACE_SEED) * 127.1 + (y + SURFACE_SEED * 1.37) * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export interface CraterSpec {
  cx: number;
  cy: number;
  r: number;
}

const CRATER_GAP = 4;

export function craterField(width: number, height: number): CraterSpec[] {
  const lattice = 80;
  const accepted: CraterSpec[] = [];
  for (let gy = 0; gy < height / lattice + 1; gy++) {
    for (let gx = 0; gx < width / lattice + 1; gx++) {
      if (hash2(gx, gy) > 0.4) continue;
      const cx = (gx + 0.1 + hash2(gx + 0.5, gy) * 0.8) * lattice;
      const cy = (gy + 0.1 + hash2(gx, gy + 0.5) * 0.8) * lattice;
      if (cx > width || cy > height) continue;
      const r = 5 + hash2(gx + 0.3, gy + 0.7) ** 1.7 * 38;
      const collides = accepted.some(
        (other) => Math.hypot(other.cx - cx, other.cy - cy) < other.r + r + CRATER_GAP,
      );
      if (collides) continue;
      accepted.push({ cx, cy, r });
    }
  }
  return accepted;
}

function drawCraters(g: Graphics, width: number, height: number): void {
  for (const { cx, cy, r } of craterField(width, height)) {
    g.circle(cx, cy, r).fill({ color: 0x323234, alpha: 0.3 });
    g.circle(cx + r * 0.2, cy + r * 0.2, r * 0.72).fill({ color: 0x282829, alpha: 0.26 });
    // Without this moveTo, arc() continues from the Graphics cursor's last position (unlike
    // circle()), drawing a stray line back to the previous crater's rim.
    const rimStart = Math.PI * 1.05;
    const rimEnd = Math.PI * 1.85;
    const rimR = r * 0.94;
    g.moveTo(cx + rimR * Math.cos(rimStart), cy + rimR * Math.sin(rimStart))
      .arc(cx, cy, rimR, rimStart, rimEnd)
      .stroke({ color: 0x6c6c72, width: Math.max(1.5, r * 0.16), alpha: 0.32 });
  }
}

function drawGrain(g: Graphics, width: number, height: number): void {
  const lattice = 9;
  for (let gy = 0; gy < height / lattice + 1; gy++) {
    for (let gx = 0; gx < width / lattice + 1; gx++) {
      const roll = hash2(gx + 0.11, gy + 0.37);
      if (roll > 0.22) continue;
      const cx = (gx + hash2(gx + 0.6, gy + 0.2)) * lattice;
      const cy = (gy + hash2(gx + 0.2, gy + 0.6)) * lattice;
      if (cx > width || cy > height) continue;
      const light = roll < 0.11;
      g.circle(cx, cy, 0.6 + hash2(gx + 0.8, gy + 0.4) * 0.7).fill({
        color: light ? 0x68686c : 0x323234,
        alpha: light ? 0.28 : 0.2,
      });
    }
  }
}

// Built from many low-alpha concentric circles rather than Pixi's canvas-backed FillGradient,
// which needs a real 2D context and can't run headlessly in the jsdom test environment.
function drawSurfaceShading(g: Graphics, width: number, height: number): void {
  const focusX = width * 0.12;
  const focusY = height * 0.15;
  const maxRadius = Math.hypot(width, height) * 0.62 * 2;
  const rings = 48;
  for (let ring = rings; ring >= 1; ring--) {
    g.circle(focusX, focusY, maxRadius * (ring / rings)).fill({ color: 0xffffff, alpha: 0.02 });
  }
}

export class WorldRenderer {
  readonly gridLayer = new Container();
  readonly entityLayer = new Container();
  readonly glowLayer = new Container();
  readonly packetLayer = new Container();
  readonly overlayLayer = new Container();

  private readonly packetViews = new Map<PacketId, PacketView>();
  private readonly viewPool: PacketView[] = [];
  private readonly highlight: Sprite;
  private readonly ghost: Sprite;
  private readonly selection: Sprite;
  private readonly sourceSprites = new Map<number, Sprite>();
  private readonly sourceCounters = new Map<EntityId, { label: Text; remaining: number }>();
  private readonly conveyorGlowSprites = new Map<EntityId, Sprite>();
  private baseGlow: Graphics | null = null;
  private blinkClock = 0;

  constructor(
    stage: Container,
    private readonly textures: GameTextures,
  ) {
    stage.addChild(
      this.gridLayer,
      this.entityLayer,
      this.glowLayer,
      this.packetLayer,
      this.overlayLayer,
    );
    this.highlight = new Sprite(textures.highlight);
    this.highlight.anchor.set(0.5);
    this.highlight.visible = false;
    this.ghost = new Sprite();
    this.ghost.anchor.set(0.5);
    this.ghost.visible = false;
    this.ghost.alpha = 0.55;
    this.selection = new Sprite(textures.highlight);
    this.selection.anchor.set(0.5);
    this.selection.visible = false;
    this.selection.tint = 0x38bdf8;
    this.selection.alpha = 0.5;
    this.overlayLayer.addChild(this.highlight, this.ghost, this.selection);
  }

  buildStatic(state: SimState): void {
    this.gridLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.entityLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.glowLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.sourceSprites.clear();
    this.sourceCounters.clear();
    this.conveyorGlowSprites.clear();

    this.gridLayer.addChild(this.drawGridBackground(state));
    this.drawBaseLayer(state.base);
    this.drawBaseSlotNumbers(state.base);

    const lanes = conveyorLanes(state);
    for (const conveyor of Object.values(state.conveyors)) {
      const { inSide } = machinePorts(state, conveyor.position);
      const curve = pickConveyorCurve(inSide, conveyor.direction);
      if (curve) {
        const sprite = this.addTile(this.textures.conveyorCurve, conveyor.position, curve.rotation);
        sprite.scale.x = curve.flip ? -1 : 1;
      } else {
        this.addTile(this.textures.conveyor, conveyor.position, conveyor.direction);
      }

      const glow = new Sprite(curve ? this.textures.conveyorCurveGlow : this.textures.conveyorGlow);
      glow.anchor.set(0.5);
      const center = cellCenter(conveyor.position);
      glow.position.set(center.x, center.y);
      glow.rotation = directionToRadians(curve ? curve.rotation : conveyor.direction);
      if (curve) glow.scale.x = curve.flip ? -1 : 1;
      glow.tint = LANE_COLORS[lanes[conveyor.id] % LANE_COLORS.length];
      glow.alpha = 0;
      this.glowLayer.addChild(glow);
      this.conveyorGlowSprites.set(conveyor.id, glow);
    }
    for (const source of Object.values(state.sources)) {
      const { outSide } = machinePorts(state, source.position);
      const sprite = this.addTile(this.textures.source, source.position, outSide ?? 'east');
      sprite.tint = source.subscribed ? SUBSCRIBED_TINT : UNSUBSCRIBED_TINT;
      this.sourceSprites.set(source.id, sprite);
      this.addCaption(source.kind, source.position, 0xbfdbfe);
      this.addSourceCounter(source);
    }
    for (const mine of state.mines) {
      if (findEntityAt(state, mine.position)) continue;
      const isSpring = new Set(mine.sequence).size > 1;
      this.addTile(isSpring ? this.textures.spring : this.textures.mine, mine.position);
      this.addMineYieldBadge(mine.position, mine.sequence);
    }
    for (const sink of Object.values(state.sinks)) {
      this.addTile(this.textures.sink, sink.position);
      this.addCaption(sink.sinkType === 'cash' ? 'sell' : 'research', sink.position, 0xfff7ed, 20);
    }
    for (const machine of Object.values(state.machines)) {
      const { outSide } = machinePorts(state, machine.position);
      this.addTile(this.textures.machine[machine.kind], machine.position, outSide ?? 'east');
      const def = MACHINE_DEFS[machine.kind];
      const center = cellCenter(machine.position);
      const name = makeLabel(def.label, 13, 0xe0e7ff, true);
      name.position.set(center.x, center.y - 5);
      const sub = makeLabel(machineSubLabel(machine), 10, 0xc7d2fe);
      sub.position.set(center.x, center.y + 9);
      this.entityLayer.addChild(name, sub);
    }

    this.updateGlowPower(state);
  }

  setSourceSubscribed(state: SimState, sourceId: number, subscribed: boolean): void {
    const sprite = this.sourceSprites.get(sourceId);
    if (sprite) sprite.tint = subscribed ? SUBSCRIBED_TINT : UNSUBSCRIBED_TINT;
    const source = state.sources[sourceId];
    if (source) this.updateSourceCounter(sourceId, source.sequence.length - source.cursor);
    this.updateGlowPower(state);
  }

  private updateGlowPower(state: SimState): void {
    const powered = poweredConveyors(state);
    for (const [conveyorId, sprite] of this.conveyorGlowSprites) {
      sprite.alpha = powered.has(conveyorId) ? GLOW_ALPHA : 0;
    }
    if (this.baseGlow) this.baseGlow.alpha = isBasePowered(state) ? 1 : 0;
  }

  applyEvents(state: SimState, events: SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'packetSpawned': {
          this.spawn(event.packetId, event.material, event.position);
          const ref = findEntityAt(state, event.position);
          if (ref?.kind === 'source') {
            const source = state.sources[ref.id];
            this.updateSourceCounter(ref.id, source.sequence.length - source.cursor);
          }
          break;
        }
        case 'packetMoved':
          this.move(event.packetId, event.position);
          break;
        case 'packetTransformed':
          this.transform(event.packetId, event.material);
          break;
        case 'packetDespawned':
          this.despawn(event.packetId);
          break;
        case 'sourceUnsubscribed':
          this.setSourceSubscribed(state, event.sourceId, false);
          break;
      }
    }
  }

  update(deltaMS: number): void {
    for (const [packetId, view] of this.packetViews) {
      if (view.progress < 1) {
        view.progress = Math.min(1, view.progress + deltaMS / TICK_MS);
      }
      const eased = 1 - (1 - view.progress) * (1 - view.progress);
      view.root.position.set(
        view.fx + (view.tx - view.fx) * eased,
        view.fy + (view.ty - view.fy) * eased,
      );

      view.scale += (view.scaleTarget - view.scale) * Math.min(1, deltaMS / 60);
      view.pulse = Math.max(0, view.pulse - deltaMS / 250);
      view.root.scale.set(view.scale * (1 + view.pulse * 0.4));

      if (view.despawning && view.scale < 0.05) {
        this.release(packetId, view);
      }
    }

    this.blinkClock += deltaMS;
    const blinkOn = Math.floor(this.blinkClock / COUNTER_BLINK_MS) % 2 === 0;
    for (const counter of this.sourceCounters.values()) {
      const depleted = counter.remaining <= 0;
      counter.label.tint = depleted ? COUNTER_EMPTY_COLOR : COUNTER_COLOR;
      counter.label.visible = !depleted || blinkOn;
    }
  }

  setPreview(preview: Preview | null): void {
    if (!preview) {
      this.highlight.visible = false;
      this.ghost.visible = false;
      return;
    }
    const center = cellCenter(preview.pos);
    this.highlight.visible = true;
    this.highlight.position.set(center.x, center.y);

    if (preview.kind === 'hover') {
      this.highlight.tint = 0xffffff;
      this.highlight.alpha = 0.08;
      this.ghost.visible = false;
      return;
    }
    if (preview.kind === 'erase') {
      this.highlight.tint = preview.valid ? 0xef4444 : 0xffffff;
      this.highlight.alpha = preview.valid ? 0.35 : 0.08;
      this.ghost.visible = false;
      return;
    }
    this.highlight.tint = preview.valid ? 0x22c55e : 0xef4444;
    this.highlight.alpha = 0.25;
    this.ghost.visible = true;
    if (preview.omnidirectional) {
      this.ghost.texture = this.textures.omnidirectionalGhost;
      this.ghost.rotation = 0;
    } else {
      this.ghost.texture = this.ghostTexture(preview.tool);
      this.ghost.rotation = directionToRadians(preview.direction);
    }
    this.ghost.position.set(center.x, center.y);
    this.ghost.tint = preview.valid ? 0xffffff : 0xfca5a5;
  }

  setSelection(pos: GridPos | null): void {
    if (!pos) {
      this.selection.visible = false;
      return;
    }
    const center = cellCenter(pos);
    this.selection.visible = true;
    this.selection.position.set(center.x, center.y);
  }

  private drawGridBackground(state: SimState): Graphics {
    const g = new Graphics();
    const { width, height } = state.grid;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const even = (x + y) % 2 === 0;
        g.rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE).fill({
          color: even ? 0x74747a : 0x78787e,
        });
      }
    }
    drawCraters(g, width * CELL_SIZE, height * CELL_SIZE);
    drawGrain(g, width * CELL_SIZE, height * CELL_SIZE);
    drawSurfaceShading(g, width * CELL_SIZE, height * CELL_SIZE);
    for (let x = 0; x <= width; x++) {
      g.moveTo(x * CELL_SIZE, 0)
        .lineTo(x * CELL_SIZE, height * CELL_SIZE)
        .stroke({ color: 0x444448, width: 1 });
    }
    for (let y = 0; y <= height; y++) {
      g.moveTo(0, y * CELL_SIZE)
        .lineTo(width * CELL_SIZE, y * CELL_SIZE)
        .stroke({ color: 0x444448, width: 1 });
    }
    g.rect(0, 0, width * CELL_SIZE, height * CELL_SIZE).stroke({ color: 0x6c6c72, width: 2 });

    // Craters/shading are drawn as plain unclipped shapes and can extend past a cell near the
    // grid's edge (or, for the shading, well past it by design) — mask them to the play field's
    // exact bounds so nothing bleeds into the surrounding void. The mask must actually be in the
    // scene graph (not just referenced via .mask) to get a correct transform; added ahead of `g`
    // in the same layer, it stays fully hidden under g's own opaque fill either way.
    const mask = new Graphics().rect(0, 0, width * CELL_SIZE, height * CELL_SIZE).fill(0xffffff);
    this.gridLayer.addChild(mask);
    g.mask = mask;
    return g;
  }

  private drawBaseLayer(rect: GridRect): void {
    const x0 = rect.min.x * CELL_SIZE;
    const y0 = rect.min.y * CELL_SIZE;
    const width = (rect.max.x - rect.min.x + 1) * CELL_SIZE;
    const height = (rect.max.y - rect.min.y + 1) * CELL_SIZE;

    const g = new Graphics();
    g.rect(x0, y0, width, height).fill({ color: BASE_FILL, alpha: 0.16 });
    g.rect(x0, y0, width, height).stroke({ color: BASE_WALL, width: 4, alpha: 0.9 });
    this.gridLayer.addChild(g);

    const glow = new Graphics();
    glow.rect(x0, y0, width, height).stroke({ color: BASE_WALL, width: 12, alpha: 0.35 });
    glow.rect(x0, y0, width, height).stroke({ color: 0xfffbea, width: 5, alpha: 0.95 });
    glow.alpha = 0;
    this.glowLayer.addChild(glow);
    this.baseGlow = glow;

    const label = makeLabel('base', 11, BASE_WALL, true);
    label.position.set(x0 + width / 2, y0 - 9);
    this.gridLayer.addChild(label);
  }

  private ghostTexture(tool: 'conveyor' | 'source' | MachineKind): GameTextures['conveyor'] {
    if (tool === 'conveyor') return this.textures.conveyor;
    if (tool === 'source') return this.textures.source;
    return this.textures.machine[tool];
  }

  private addTile(texture: GameTextures['conveyor'], pos: GridPos, direction?: Direction): Sprite {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    const center = cellCenter(pos);
    sprite.position.set(center.x, center.y);
    if (direction) sprite.rotation = directionToRadians(direction);
    this.entityLayer.addChild(sprite);
    return sprite;
  }

  private addCaption(text: string, pos: GridPos, color: number, yOffset = 13): void {
    const caption = makeLabel(text, 9, color);
    const center = cellCenter(pos);
    caption.position.set(center.x, center.y + yOffset);
    this.entityLayer.addChild(caption);
  }

  private addSourceCounter(source: SourceEntity): void {
    const remaining = source.sequence.length - source.cursor;
    const label = makeLabel(String(remaining), 10, COUNTER_COLOR, true);
    const center = cellCenter(source.position);
    label.position.set(center.x, center.y - 13);
    this.entityLayer.addChild(label);
    this.sourceCounters.set(source.id, { label, remaining });
  }

  private updateSourceCounter(sourceId: EntityId, remaining: number): void {
    const counter = this.sourceCounters.get(sourceId);
    if (!counter) return;
    counter.remaining = remaining;
    counter.label.text = String(remaining);
  }

  private drawBaseSlotNumbers(rect: GridRect): void {
    let n = 1;
    for (let y = rect.min.y; y <= rect.max.y; y++) {
      for (let x = rect.min.x; x <= rect.max.x; x++) {
        this.addSlotNumber(n, { x, y });
        n++;
      }
    }
  }

  private addSlotNumber(n: number, pos: GridPos): void {
    const center = cellCenter(pos);
    const label = makeLabel(`${n}`, 12, 0xfef3c7, true);
    label.position.set(center.x, center.y);
    this.gridLayer.addChild(label);
  }

  private addMineYieldBadge(pos: GridPos, sequence: MaterialId[]): void {
    const center = cellCenter(pos);
    const rows = [...countMaterials(sequence).entries()];
    const rowHeight = 12;
    const baseY = center.y + 13 - ((rows.length - 1) * rowHeight) / 2;
    rows.forEach(([material, count], i) => {
      const y = baseY + i * rowHeight;
      const iconX = center.x - 9;
      const r = 5;
      const ball = new Graphics();
      ball.circle(iconX, y, r).fill({ color: 0x0b0b14, alpha: 0.9 });
      ball.circle(iconX, y, r * 0.92).fill({ color: MATERIALS[material].color });
      ball.circle(iconX - r * 0.35, y - r * 0.35, r * 0.35).fill({ color: 0xffffff, alpha: 0.55 });
      this.entityLayer.addChild(ball);

      const letter = makeLabel(MATERIALS[material].shortLabel, 7, 0x08131f, true);
      letter.position.set(iconX, y);
      this.entityLayer.addChild(letter);

      const countLabel = makeLabel(`×${count}`, 10, 0xecfeff, true);
      countLabel.anchor.set(0, 0.5);
      countLabel.position.set(center.x, y);
      this.entityLayer.addChild(countLabel);
    });
  }

  private spawn(packetId: PacketId, material: MaterialId, pos: GridPos): void {
    const view = this.viewPool.pop() ?? this.createView();
    const center = cellCenter(pos);
    view.body.texture = this.textures.packet;
    view.body.tint = MATERIALS[material].color;
    view.label.text = MATERIALS[material].shortLabel;
    view.fx = view.tx = center.x;
    view.fy = view.ty = center.y;
    view.progress = 1;
    view.scale = 0;
    view.scaleTarget = 1;
    view.pulse = 0;
    view.despawning = false;
    view.root.position.set(center.x, center.y);
    view.root.scale.set(0);
    view.root.visible = true;
    this.packetViews.set(packetId, view);
  }

  private move(packetId: PacketId, pos: GridPos): void {
    const view = this.packetViews.get(packetId);
    if (!view) return;
    const center = cellCenter(pos);
    view.fx = view.root.position.x;
    view.fy = view.root.position.y;
    view.tx = center.x;
    view.ty = center.y;
    view.progress = 0;
  }

  private transform(packetId: PacketId, material: MaterialId): void {
    const view = this.packetViews.get(packetId);
    if (!view) return;
    view.body.tint = MATERIALS[material].color;
    view.label.text = MATERIALS[material].shortLabel;
    view.pulse = 1;
  }

  private despawn(packetId: PacketId): void {
    const view = this.packetViews.get(packetId);
    if (!view) return;
    view.despawning = true;
    view.scaleTarget = 0;
  }

  private release(packetId: PacketId, view: PacketView): void {
    view.root.visible = false;
    this.packetViews.delete(packetId);
    this.viewPool.push(view);
  }

  clearPackets(): void {
    for (const [packetId, view] of this.packetViews) this.release(packetId, view);
  }

  private createView(): PacketView {
    const root = new Container();
    const body = new Sprite();
    body.anchor.set(0.5);
    const label = makeLabel('', 11, 0x08131f, true);
    root.addChild(body, label);
    this.packetLayer.addChild(root);
    return {
      root,
      body,
      label,
      fx: 0,
      fy: 0,
      tx: 0,
      ty: 0,
      progress: 1,
      scale: 1,
      scaleTarget: 1,
      pulse: 0,
      despawning: false,
    };
  }
}
