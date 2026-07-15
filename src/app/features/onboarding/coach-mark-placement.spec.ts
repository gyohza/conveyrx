import { describe, expect, it } from 'vitest';
import { computeBubblePlacement } from './coach-mark-placement';

const VIEWPORT = { width: 1024, height: 768 };

describe('computeBubblePlacement', () => {
  it('centers near the bottom of the screen when there is no anchor', () => {
    const placement = computeBubblePlacement(null, VIEWPORT);

    expect(placement.arrowSide).toBe('bottom');
    expect(placement.left).toBeGreaterThan(0);
    expect(placement.top).toBeLessThan(VIEWPORT.height);
  });

  it('places the bubble below an anchor with plenty of room underneath, pointing up', () => {
    const anchor = new DOMRect(100, 100, 40, 40);

    const placement = computeBubblePlacement(anchor, VIEWPORT);

    expect(placement.arrowSide).toBe('top');
    expect(placement.top).toBeGreaterThan(anchor.bottom);
  });

  it('places the bubble above an anchor pinned to the bottom of the screen, pointing down', () => {
    const anchor = new DOMRect(100, VIEWPORT.height - 60, 40, 40);

    const placement = computeBubblePlacement(anchor, VIEWPORT);

    expect(placement.arrowSide).toBe('bottom');
    expect(placement.top).toBeLessThan(anchor.top);
  });

  it('clamps horizontally so the bubble never spills past the left edge', () => {
    const anchor = new DOMRect(0, 100, 20, 20);

    const placement = computeBubblePlacement(anchor, VIEWPORT);

    expect(placement.left).toBeGreaterThanOrEqual(0);
  });

  it('clamps horizontally so the bubble never spills past the right edge', () => {
    const anchor = new DOMRect(VIEWPORT.width - 10, 100, 20, 20);

    const placement = computeBubblePlacement(anchor, VIEWPORT);

    expect(placement.left + 320).toBeLessThanOrEqual(VIEWPORT.width + 1);
  });

  it('points the arrow at the anchor center when the bubble is not pinned to an edge', () => {
    const anchor = new DOMRect(400, 100, 40, 40);

    const placement = computeBubblePlacement(anchor, VIEWPORT);
    const arrowCenterX = placement.left + placement.arrowLeft + 5;

    expect(arrowCenterX).toBeCloseTo(anchor.left + anchor.width / 2, 0);
  });
});
