export interface BubblePlacement {
  top: number;
  left: number;
  arrowLeft: number;
  arrowSide: 'top' | 'bottom';
}

export interface Viewport {
  width: number;
  height: number;
}

const BUBBLE_WIDTH = 320;
const ESTIMATED_BUBBLE_HEIGHT = 140;
const GAP = 10;
const MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function computeBubblePlacement(
  anchorRect: DOMRect | null,
  viewport: Viewport,
): BubblePlacement {
  if (!anchorRect) {
    return {
      top: viewport.height - ESTIMATED_BUBBLE_HEIGHT - MARGIN * 2,
      left: clamp((viewport.width - BUBBLE_WIDTH) / 2, MARGIN, viewport.width - MARGIN),
      arrowLeft: BUBBLE_WIDTH / 2 - 5,
      arrowSide: 'bottom',
    };
  }

  const spaceBelow = viewport.height - anchorRect.bottom;
  const below = spaceBelow >= ESTIMATED_BUBBLE_HEIGHT + GAP || anchorRect.top < spaceBelow;
  const top = below ? anchorRect.bottom + GAP : anchorRect.top - GAP - ESTIMATED_BUBBLE_HEIGHT;

  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const left = clamp(
    anchorCenterX - BUBBLE_WIDTH / 2,
    MARGIN,
    Math.max(MARGIN, viewport.width - BUBBLE_WIDTH - MARGIN),
  );
  const arrowLeft = clamp(anchorCenterX - left - 5, 10, BUBBLE_WIDTH - 20);

  return { top, left, arrowLeft, arrowSide: below ? 'top' : 'bottom' };
}
