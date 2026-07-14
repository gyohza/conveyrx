import { describe, expect, it } from 'vitest';
import type { Renderer, Texture } from 'pixi.js';
import { warmGameTextures } from './game-textures';

function fakeRenderer() {
  let n = 0;
  return {
    renderer: {
      generateTexture: () => ({ id: n++ }) as unknown as Texture,
    } as unknown as Renderer,
    bakeCount: () => n,
  };
}

describe('warmGameTextures', () => {
  it('bakes one shared packet texture, one per machine kind, and the tile shapes', () => {
    const { renderer, bakeCount } = fakeRenderer();

    const textures = warmGameTextures(renderer);

    expect(Object.keys(textures.machine)).toEqual(['map', 'filter', 'take']);
    // 1 packet + 3 machines + conveyor + curve + glow + curve glow + source + sink + mine
    // + spring + highlight + omni ghost
    expect(bakeCount()).toBe(14);
    expect(textures.packet).toBeDefined();
  });

  it('gives every shape a distinct texture', () => {
    const { renderer } = fakeRenderer();

    const textures = warmGameTextures(renderer);
    const all = [
      textures.packet,
      ...Object.values(textures.machine),
      textures.conveyor,
      textures.conveyorCurve,
      textures.conveyorGlow,
      textures.conveyorCurveGlow,
      textures.source,
      textures.sink,
      textures.mine,
      textures.spring,
      textures.highlight,
      textures.omnidirectionalGhost,
    ];

    expect(new Set(all).size).toBe(all.length);
  });
});
