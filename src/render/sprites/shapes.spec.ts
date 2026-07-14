import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import {
  curveRailPath,
  drawCellHighlight,
  drawConveyorCurveGlow,
  drawConveyorCurveTile,
  drawConveyorGlow,
  drawConveyorTile,
  drawMachineTile,
  drawMineTile,
  drawOmnidirectionalGhost,
  drawPacketShape,
  drawSinkTile,
  drawSourceTile,
  drawSpringTile,
} from './shapes';

describe('procedural shapes', () => {
  it.each([
    ['packet', drawPacketShape],
    ['conveyor', drawConveyorTile],
    ['conveyor curve', drawConveyorCurveTile],
    ['map machine', () => drawMachineTile('map')],
    ['filter machine', () => drawMachineTile('filter')],
    ['take machine', () => drawMachineTile('take')],
    ['source', drawSourceTile],
    ['sink', drawSinkTile],
    ['mine', drawMineTile],
    ['spring', drawSpringTile],
    ['highlight', drawCellHighlight],
    ['omnidirectional ghost', drawOmnidirectionalGhost],
  ])('draws a non-empty %s shape', (_name, draw) => {
    const g = draw();
    expect(g).toBeInstanceOf(Graphics);
    expect(g.width).toBeGreaterThan(0);
    expect(g.height).toBeGreaterThan(0);
  });
});

describe('conveyor tile and glow bake to identical crop bounds', () => {
  it('straight tile and glow share the same bounds', () => {
    expect(drawConveyorTile().bounds).toEqual(drawConveyorGlow().bounds);
  });

  it('curve tile and glow share the same bounds', () => {
    expect(drawConveyorCurveTile().bounds).toEqual(drawConveyorCurveGlow().bounds);
  });

  it('straight and curve tiles share the same bounds as each other (consistent crop size)', () => {
    expect(drawConveyorTile().bounds).toEqual(drawConveyorCurveTile().bounds);
  });
});

describe('curveRailPath', () => {
  function railShape(): Graphics {
    return curveRailPath(new Graphics()).stroke({ color: 0x8a8a9a, width: 3 });
  }

  it('passes exactly through the tile center', () => {
    expect(railShape().containsPoint({ x: 0, y: 0 })).toBe(true);
  });

  it('runs from the center to the west (incoming) and south (outgoing) edges', () => {
    const g = railShape();
    expect(g.containsPoint({ x: -12, y: 0 })).toBe(true);
    expect(g.containsPoint({ x: 0, y: 12 })).toBe(true);
  });

  it('does not extend toward the two closed sides (north, east)', () => {
    const g = railShape();
    expect(g.containsPoint({ x: 12, y: 0 })).toBe(false);
    expect(g.containsPoint({ x: 0, y: -12 })).toBe(false);
  });
});
