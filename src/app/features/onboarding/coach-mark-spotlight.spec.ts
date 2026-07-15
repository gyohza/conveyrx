import { describe, expect, it } from 'vitest';
import { computeSpotlightLayout } from './coach-mark-spotlight';

const VIEWPORT = { width: 1024, height: 768 };

describe('computeSpotlightLayout', () => {
  it('produces no hole and no bands when there is no anchor', () => {
    const layout = computeSpotlightLayout(null, VIEWPORT);

    expect(layout.hole).toBeNull();
    expect(layout.bands).toHaveLength(0);
  });

  it('carves a padded hole around the anchor', () => {
    const anchor = new DOMRect(100, 100, 40, 40);

    const layout = computeSpotlightLayout(anchor, VIEWPORT);

    expect(layout.hole).toEqual({ top: 92, left: 92, width: 56, height: 56 });
  });

  it('produces 4 bands that, together with the hole, tile the entire viewport', () => {
    const anchor = new DOMRect(100, 100, 40, 40);

    const { hole, bands } = computeSpotlightLayout(anchor, VIEWPORT);
    expect(hole).not.toBeNull();

    const totalBandArea = bands.reduce((sum, b) => sum + b.width * b.height, 0);
    const holeArea = hole!.width * hole!.height;

    expect(totalBandArea + holeArea).toBeCloseTo(VIEWPORT.width * VIEWPORT.height, 0);
  });

  it('clamps the hole to the viewport edges when the anchor sits at a corner', () => {
    const anchor = new DOMRect(0, 0, 20, 20);

    const layout = computeSpotlightLayout(anchor, VIEWPORT);

    expect(layout.hole!.top).toBe(0);
    expect(layout.hole!.left).toBe(0);
    expect(layout.bands.every((b) => b.width >= 0 && b.height >= 0)).toBe(true);
  });
});
