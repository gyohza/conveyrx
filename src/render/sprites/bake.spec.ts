import { describe, expect, it } from 'vitest';
import { bakeTexture } from './bake';

describe('bakeTexture', () => {
  it('draws the shape, converts it to a texture via the renderer, then frees the CPU-side geometry', () => {
    const calls: string[] = [];
    const fakeGraphics = { destroy: () => calls.push('destroy') };
    const fakeTexture = { id: 'baked-texture' };
    const fakeRenderer = {
      generateTexture: (options: { target: typeof fakeGraphics; resolution: number }) => {
        calls.push('generateTexture');
        expect(options.target).toBe(fakeGraphics);
        expect(options.resolution).toBe(3);
        return fakeTexture;
      },
    };

    const result = bakeTexture(fakeRenderer, () => fakeGraphics, 3);

    expect(result).toBe(fakeTexture);
    expect(calls).toEqual(['generateTexture', 'destroy']);
  });
});
