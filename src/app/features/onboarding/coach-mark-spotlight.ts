import type { Viewport } from './coach-mark-placement';

export interface SpotlightHole {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SpotlightBand {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SpotlightLayout {
  hole: SpotlightHole | null;
  bands: readonly SpotlightBand[];
}

const PADDING = 8;

export function computeSpotlightLayout(
  anchorRect: DOMRect | null,
  viewport: Viewport,
): SpotlightLayout {
  if (!anchorRect) return { hole: null, bands: [] };

  const left = Math.max(0, anchorRect.left - PADDING);
  const top = Math.max(0, anchorRect.top - PADDING);
  const right = Math.min(viewport.width, anchorRect.right + PADDING);
  const bottom = Math.min(viewport.height, anchorRect.bottom + PADDING);
  const hole: SpotlightHole = { top, left, width: right - left, height: bottom - top };

  const bands: SpotlightBand[] = [
    { top: 0, left: 0, width: viewport.width, height: hole.top },
    { top: hole.top, left: 0, width: hole.left, height: hole.height },
    { top: hole.top, left: right, width: Math.max(0, viewport.width - right), height: hole.height },
    { top: bottom, left: 0, width: viewport.width, height: Math.max(0, viewport.height - bottom) },
  ];

  return { hole, bands };
}
