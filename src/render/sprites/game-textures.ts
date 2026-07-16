import type { Graphics, Renderer, Texture } from 'pixi.js';
import type { MachineKind } from '@sim/core/entities';
import { bakeTexture } from './bake';
import {
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

export interface GameTextures {
  packet: Texture;
  machine: Record<MachineKind, Texture>;
  conveyor: Texture;
  conveyorCurve: Texture;
  conveyorGlow: Texture;
  conveyorCurveGlow: Texture;
  source: Texture;
  sink: Texture;
  mine: Texture;
  spring: Texture;
  highlight: Texture;
  omnidirectionalGhost: Texture;
}

/** Rasterized past the world container's 2.4x max zoom (see `layout()` in pixi-app.ts) to stay crisp. */
const TILE_TEXTURE_RESOLUTION = 3;

export function warmGameTextures(renderer: Renderer): GameTextures {
  const bake = (draw: () => Graphics) =>
    bakeTexture<Graphics, Texture>(renderer, draw, TILE_TEXTURE_RESOLUTION);
  return {
    packet: bake(drawPacketShape),
    machine: {
      map: bake(() => drawMachineTile('map')),
      filter: bake(() => drawMachineTile('filter')),
      take: bake(() => drawMachineTile('take')),
    },
    conveyor: bake(drawConveyorTile),
    conveyorCurve: bake(drawConveyorCurveTile),
    conveyorGlow: bake(drawConveyorGlow),
    conveyorCurveGlow: bake(drawConveyorCurveGlow),
    source: bake(drawSourceTile),
    sink: bake(drawSinkTile),
    mine: bake(drawMineTile),
    spring: bake(drawSpringTile),
    highlight: bake(drawCellHighlight),
    omnidirectionalGhost: bake(drawOmnidirectionalGhost),
  };
}
