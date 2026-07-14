export const CONVEYOR_COST = 1;
export const SOURCE_COST = 25;
export const FILTER_COST = 55;
export const START_CASH = 50;

/** Charged every tick a source is subscribed, regardless of whether it's actively delivering. */
export const SUBSCRIPTION_UPKEEP_PER_TICK = 0.01;

export const TAKE_BASE_COST = 75;
export const TAKE_COST_PER_UNIT = 5;

export function takeCost(count: number): number {
  return TAKE_BASE_COST + count * TAKE_COST_PER_UNIT;
}

export function everAffordable(peakCash: number, cost: number): boolean {
  return peakCash >= cost;
}
