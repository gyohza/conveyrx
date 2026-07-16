import { Graphics } from 'pixi.js';
import type { MachineKind } from '@sim/core/entities';

export const CELL_SIZE = 48;

export function drawPacketShape(): Graphics {
  const g = new Graphics();
  g.circle(0, 0, 12).fill({ color: 0x0b0b14, alpha: 0.9 });
  g.circle(0, 0, 11).fill({ color: 0xffffff });
  g.circle(-4, -4, 4).fill({ color: 0xffffff, alpha: 0.55 });
  return g;
}

function rotatePoint(x: number, y: number, angle: number): [number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos];
}

function drawArrow(g: Graphics, x: number, y: number, angle: number, color: number): Graphics {
  const base: [number, number][] = [
    [-5, -5],
    [5, 0],
    [-5, 5],
  ];
  const points = base.flatMap(([px, py]) => {
    const [rx, ry] = rotatePoint(px, py, angle);
    return [x + rx, y + ry];
  });
  return g.poly(points).fill({ color });
}

const RAIL = { color: 0xb8860b, width: 4 };
const ARROW_COLOR = 0x3f2d05;

/**
 * Pixi's `generateTexture` crops to each Graphics object's own bounds, then `anchor(0.5)` centers
 * on that crop — so a rail and its glow only align if both crop to identical bounds. This
 * invisible square pins every rail/glow shape to the same fixed box regardless of which sides it
 * touches.
 */
const BOUNDS_PIN = 40;
function pinBounds(g: Graphics): Graphics {
  return g
    .rect(-BOUNDS_PIN, -BOUNDS_PIN, BOUNDS_PIN * 2, BOUNDS_PIN * 2)
    .fill({ color: 0x15151f, alpha: 0 });
}

export function drawConveyorTile(): Graphics {
  const g = new Graphics();
  pinBounds(g);
  g.moveTo(-24, 0).lineTo(24, 0).stroke(RAIL);
  drawArrow(g, 19, 0, 0, ARROW_COLOR);
  return g;
}

/**
 * Exported so the path can be asserted directly via `containsPoint` — testing through
 * {@link drawConveyorCurveTile} itself would just hit its invisible full-tile hit-area rect.
 */
export function curveRailPath(g: Graphics): Graphics {
  return g.moveTo(-24, 0).lineTo(0, 0).lineTo(0, 24);
}

/**
 * Baked for the single case "enters from the west edge, exits the south edge". Every other turn
 * is this same texture rotated in 90° steps and, for the opposite chirality, mirrored on x — see
 * world-renderer.ts's curve-orientation lookup.
 */
export function drawConveyorCurveTile(): Graphics {
  const g = new Graphics();
  pinBounds(g);
  curveRailPath(g).stroke(RAIL);
  drawArrow(g, 0, 19, Math.PI / 2, ARROW_COLOR);
  return g;
}

function drawBaseTile(g: Graphics, fill: number, edge: number): Graphics {
  g.roundRect(-23, -23, 46, 46, 8).fill({ color: edge });
  g.roundRect(-21, -21, 42, 42, 7).fill({ color: fill });
  return g;
}

function drawOutputNotch(g: Graphics, color: number): Graphics {
  g.poly([16, -7, 25, 0, 16, 7]).fill({ color });
  return g;
}

function drawFilterTile(): Graphics {
  const g = new Graphics();
  drawBaseTile(g, 0x0d9488, 0x115e59);
  drawOutputNotch(g, 0x5eead4);
  g.poly([-9, -8, 9, -8, 2, 3, 2, 9, -2, 9, -2, 3]).fill({ color: 0xccfbf1 });
  return g;
}

function drawTakeTile(): Graphics {
  const g = new Graphics();
  drawBaseTile(g, 0xbe123c, 0x7f1d1d);
  drawOutputNotch(g, 0xfda4af);
  g.poly([-7, -8, 7, -8, 0, 0]).fill({ color: 0xfda4af });
  g.poly([-7, 8, 7, 8, 0, 0]).fill({ color: 0xfda4af });
  return g;
}

export function drawMachineTile(kind: MachineKind): Graphics {
  if (kind === 'filter') return drawFilterTile();
  if (kind === 'take') return drawTakeTile();
  const g = new Graphics();
  drawBaseTile(g, 0x4f46e5, 0x3730a3);
  drawOutputNotch(g, 0xa5b4fc);
  return g;
}

export function drawSourceTile(): Graphics {
  const g = new Graphics();
  drawBaseTile(g, 0x334155, 0x1e293b);
  drawOutputNotch(g, 0xcbd5f5);
  g.circle(-3, 0, 8).stroke({ color: 0xffffff, width: 2.5 });
  g.rect(-4.5, -11, 3, 8).fill({ color: 0x334155 });
  g.rect(-4.5, -10, 3, 7).fill({ color: 0xffffff });
  return g;
}

export function drawSinkTile(): Graphics {
  const g = new Graphics();
  drawBaseTile(g, 0xb45309, 0x92400e);

  g.circle(0, 0, 15).fill({ color: 0xfbbf24 });
  g.circle(0, 0, 15).stroke({ color: 0xfef3c7, width: 2 });
  g.circle(0, 0, 10).stroke({ color: 0xfef3c7, width: 1.2, alpha: 0.55 });

  const glyphStroke = { color: 0x78350f, width: 2.2 };
  const S = 6;
  g.moveTo(-S, -S).lineTo(S, -S).stroke(glyphStroke);
  g.moveTo(S, -S).lineTo(-S, S).stroke(glyphStroke);
  g.moveTo(-S, S).lineTo(S, S).stroke(glyphStroke);
  g.moveTo(-S - 1.5, 0)
    .lineTo(S + 1.5, 0)
    .stroke(glyphStroke);

  return g;
}

function drawWashedGround(g: Graphics, wash: number): Graphics {
  drawBaseTile(g, 0x6f6f76, 0x57575d);
  g.roundRect(-21, -21, 42, 42, 7).fill({ color: wash, alpha: 0.22 });
  return g;
}

export function drawMineTile(): Graphics {
  const g = new Graphics();
  drawWashedGround(g, 0x0d9488);

  g.poly([-19, 16, -19, 3, -12, -9, -3, -13, 3, -13, 12, -9, 19, 3, 19, 16]).fill({
    color: 0x4b4b42,
  });
  g.circle(-13, 8, 2).fill({ color: 0x3a3a34 });
  g.circle(11, 12, 1.6).fill({ color: 0x3a3a34 });

  g.roundRect(-12, -7, 4, 23, 1).fill({ color: 0x5c3f24 });
  g.roundRect(8, -7, 4, 23, 1).fill({ color: 0x5c3f24 });
  g.roundRect(-13, -10, 26, 5, 1).fill({ color: 0x7a5530 });
  g.roundRect(-13, -10, 26, 1.5).fill({ color: 0x9c7040, alpha: 0.7 });

  g.roundRect(-7, -4, 14, 20, 2).fill({ color: 0x12100b });
  g.roundRect(-5, -1, 10, 17, 2).fill({ color: 0x030302 });

  return g;
}

function drawDrop(g: Graphics, r: number, color: number): Graphics {
  const cy = 5;
  const topY = cy - r * 1.9;
  g.moveTo(0, topY)
    .quadraticCurveTo(r, topY, r, cy)
    .arc(0, cy, r, 0, Math.PI)
    .quadraticCurveTo(-r, topY, 0, topY)
    .closePath()
    .fill({ color });
  return g;
}

export function drawSpringTile(): Graphics {
  const g = new Graphics();
  drawWashedGround(g, 0x06b6d4);

  drawDrop(g, 13, 0x0e7490);
  drawDrop(g, 10, 0x22d3ee);
  g.circle(-3, 1, 2.5).fill({ color: 0xa5f3fc, alpha: 0.75 });

  return g;
}

const GLOW_HALO = { color: 0xffffff, width: 10, alpha: 0.3 };
const GLOW_CORE = { color: 0xffffff, width: 4, alpha: 0.9 };

export function drawConveyorGlow(): Graphics {
  const g = new Graphics();
  pinBounds(g);
  g.moveTo(-24, 0).lineTo(24, 0).stroke(GLOW_HALO);
  g.moveTo(-24, 0).lineTo(24, 0).stroke(GLOW_CORE);
  return g;
}

export function drawConveyorCurveGlow(): Graphics {
  const g = new Graphics();
  pinBounds(g);
  curveRailPath(g).stroke(GLOW_HALO);
  curveRailPath(g).stroke(GLOW_CORE);
  return g;
}

export function drawCellHighlight(): Graphics {
  return new Graphics().roundRect(-23, -23, 46, 46, 6).fill({ color: 0xffffff });
}

export function drawOmnidirectionalGhost(): Graphics {
  const g = new Graphics();
  g.roundRect(-20, -20, 40, 40, 6).fill({ color: 0xffffff, alpha: 0.12 });
  g.poly([-6, -10, 6, -10, 0, -18]).fill({ color: 0xffffff, alpha: 0.85 });
  g.poly([-6, 10, 6, 10, 0, 18]).fill({ color: 0xffffff, alpha: 0.85 });
  g.poly([10, -6, 10, 6, 18, 0]).fill({ color: 0xffffff, alpha: 0.85 });
  g.poly([-10, -6, -10, 6, -18, 0]).fill({ color: 0xffffff, alpha: 0.85 });
  return g;
}
