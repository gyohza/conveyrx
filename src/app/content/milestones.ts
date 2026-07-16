import { buildCost } from '@sim/core/editing';
import { isSourceConnectedToBase } from '@sim/core/routing';
import type { SimState } from '@sim/core/state';
import type { GridPos, GridRect } from '@sim/core/types';
import { everAffordable } from '@sim/content/economy';
import type { ToolId } from '../core/services/build-tool.service';

export interface MilestoneContext {
  state: SimState;
  tool: ToolId | null;
  hasLeakedBefore: boolean;
}

export type MilestoneAnchor =
  | { kind: 'dom'; selector: string }
  | { kind: 'grid'; pos: (ctx: MilestoneContext) => GridPos | null }
  | { kind: 'gridRect'; rect: (ctx: MilestoneContext) => GridRect | null }
  | { kind: 'none' };

export interface MilestoneDef {
  id: string;
  title: string;
  body: string;
  isTriggered: (ctx: MilestoneContext) => boolean;
  anchor: MilestoneAnchor;
  /**
   * When set, this milestone auto-dismisses itself once true, instead of waiting for the player to
   * click "Got it" — used to chain scripted steps (e.g. "pick this tool" -> "now place it").
   */
  autoCompleteWhen?: (ctx: MilestoneContext) => boolean;
  /**
   * Only set this when `autoCompleteWhen` depends on ephemeral, non-persisted state (e.g. the
   * currently selected tool) that resets on reload — it lets `isMilestoneComplete` treat the step
   * as done once a *later* step in its group is already satisfied, since that later step could only
   * have been reached by passing through this one. Steps gated on saved game state (a source
   * exists, a pipe connects, a subscription is on) must NOT set this: their own condition being
   * false always means genuinely not done, even if some later, unrelated condition is already true
   * (e.g. subscribing before the pipe is actually wired up).
   */
  ephemeral?: boolean;
  /**
   * Set to `false` for a step whose whole point is unrestricted map access (e.g. dragging pipes
   * across many cells) — the coach-mark still points at `anchor` for the tooltip, but skips the
   * darkened backdrop and its click/hover lockout, which would otherwise cover everything outside
   * the anchor's single cell. Defaults to `true`.
   */
  spotlight?: boolean;
}

function domAnchor(selector: string): MilestoneAnchor {
  return { kind: 'dom', selector };
}

function mineAnchor(): MilestoneAnchor {
  return { kind: 'grid', pos: ({ state }) => state.mines[0]?.position ?? null };
}

function sourceAnchor(): MilestoneAnchor {
  return { kind: 'grid', pos: ({ state }) => Object.values(state.sources)[0]?.position ?? null };
}

function subscriberAnchor(): MilestoneAnchor {
  return { kind: 'gridRect', rect: ({ state }) => state.base };
}

const cashReadoutAnchor = domAnchor('[data-coachmark="cash-readout"]');

export function isSourceConnectedToSubscriber(state: SimState): boolean {
  const source = Object.values(state.sources)[0];
  if (!source) return false;
  return isSourceConnectedToBase(state, source);
}

export function hasDrainingExhaustedSource(state: SimState): boolean {
  return Object.values(state.sources).some(
    (source) => source.subscribed && source.cursor >= source.sequence.length,
  );
}

function anySourceSubscribed(state: SimState): boolean {
  return Object.values(state.sources).some((source) => source.subscribed);
}

export const MILESTONES: readonly MilestoneDef[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    body: "You're running an automated extraction rig — packets of raw material will flow through it exactly the way values flow through an RxJS stream.",
    isTriggered: () => true,
    anchor: mineAnchor(),
  },
  {
    id: 'select-source-tool',
    title: 'Pick your source',
    body: 'Select from — it starts a stream from a mine.',
    isTriggered: () => true,
    anchor: domAnchor('[data-coachmark="tool-source"]'),
    autoCompleteWhen: ({ tool }) => tool === 'source',
    ephemeral: true,
  },
  {
    id: 'place-source',
    title: 'Land it on the mine',
    body: 'Click the marked mine to build your source there.',
    isTriggered: () => true,
    anchor: mineAnchor(),
    autoCompleteWhen: ({ state }) => Object.keys(state.sources).length > 0,
  },
  {
    id: 'subscriber-intro',
    title: 'Meet the Subscriber',
    body: 'This is the Subscriber — the body of .subscribe(). Whatever reaches it gets sold; nothing else in the pipeline has side effects.',
    isTriggered: () => true,
    anchor: subscriberAnchor(),
  },
  {
    id: 'select-conveyor-tool',
    title: 'Pick the pipe tool',
    body: 'Select pipe — it carries packets one cell per tick.',
    isTriggered: () => true,
    anchor: domAnchor('[data-coachmark="tool-conveyor"]'),
    autoCompleteWhen: ({ tool }) => tool === 'conveyor',
    ephemeral: true,
  },
  {
    id: 'connect-source-to-subscriber',
    title: 'Wire it up',
    body: 'Drag pipes from your source to the Subscriber — a full path has to exist before anything can flow.',
    isTriggered: () => true,
    anchor: sourceAnchor(),
    autoCompleteWhen: ({ state }) => isSourceConnectedToSubscriber(state),
    spotlight: false,
  },
  {
    id: 'source-subscribed',
    title: 'Subscribe it',
    body: 'Click it again to .subscribe() — nothing flows until you do.',
    isTriggered: () => true,
    anchor: sourceAnchor(),
    autoCompleteWhen: ({ state }) => anySourceSubscribed(state),
  },
  {
    id: 'flowing',
    title: "It's working!",
    body: 'Packets are moving now — watch a few make the trip from source to Subscriber.',
    isTriggered: () => true,
    anchor: sourceAnchor(),
  },
  {
    id: 'first-cash',
    title: 'First sale',
    body: 'Sold! Every payout from the Subscriber lands in your balance up top.',
    isTriggered: ({ state }) => state.economy.saleCount > 0,
    anchor: cashReadoutAnchor,
  },
  {
    id: 'source-exhausted',
    title: 'Batch complete',
    body: "Your source just emitted its last item — but it's still subscribed, and upkeep never stops. Watch the balance.",
    isTriggered: ({ state }) => hasDrainingExhaustedSource(state),
    anchor: cashReadoutAnchor,
  },
  {
    id: 'force-unsubscribe',
    title: 'Unsubscribe it',
    body: 'Click your source again to unsubscribe and stop the drain.',
    isTriggered: ({ state }) => hasDrainingExhaustedSource(state),
    anchor: sourceAnchor(),
    autoCompleteWhen: ({ state, hasLeakedBefore }) =>
      hasLeakedBefore && !hasDrainingExhaustedSource(state),
  },
  {
    id: 'map-unlocked',
    title: 'Try an operator',
    body: 'You can afford map now — select it to transform packets mid-flight.',
    isTriggered: ({ state }) =>
      !anySourceSubscribed(state) &&
      everAffordable(state.economy.peakCash, buildCost({ type: 'machine', kind: 'map' })),
    anchor: domAnchor('[data-coachmark="tool-map"]'),
    autoCompleteWhen: ({ tool }) => tool === 'map',
    ephemeral: true,
  },
  {
    id: 'map-placed-on-pipe',
    title: 'Drop it on a pipe',
    body: 'Place map directly onto an existing pipe — it slots in without breaking the connection.',
    isTriggered: ({ tool }) => tool === 'map',
    anchor: { kind: 'none' },
    autoCompleteWhen: ({ state }) => Object.values(state.machines).some((m) => m.kind === 'map'),
  },
  {
    id: 'filter-placed',
    title: 'Filter it out',
    body: "filter drops anything that doesn't match — useful for Slag, which sells at a loss.",
    isTriggered: ({ state }) => Object.values(state.machines).some((m) => m.kind === 'filter'),
    anchor: domAnchor('[data-coachmark="tool-filter"]'),
  },
  {
    id: 'take-unlocked',
    title: 'Auto-complete',
    body: 'take unsubscribes itself after N items — cleanup with no manual .unsubscribe().',
    isTriggered: ({ state }) =>
      everAffordable(state.economy.peakCash, buildCost({ type: 'machine', kind: 'take' })),
    anchor: domAnchor('[data-coachmark="tool-take"]'),
  },
];

/**
 * Scripted steps whose instructions only make sense in order (e.g. "land it on the mine" is
 * meaningless if the source tool was never picked). None of a group's steps are persisted as seen
 * until its last id — the hallmark — completes, so a mid-group reload restarts the whole group
 * from its first step rather than stranding the player on a later step whose precondition (often
 * transient UI state, not saved game state) no longer holds.
 */
export const SETUP_GROUP = [
  'select-source-tool',
  'place-source',
  'select-conveyor-tool',
  'connect-source-to-subscriber',
  'source-subscribed',
] as const;

/** The sim clock stays frozen (see `SimClockService`) until this milestone is fully complete. */
export const SETUP_HALLMARK_ID = SETUP_GROUP[SETUP_GROUP.length - 1];

export const MAP_INTRO_GROUP = ['map-unlocked', 'map-placed-on-pipe'] as const;

export const MILESTONE_GROUPS: readonly (readonly string[])[] = [SETUP_GROUP, MAP_INTRO_GROUP];

export function groupContaining(id: string): readonly string[] | null {
  return MILESTONE_GROUPS.find((group) => group.includes(id)) ?? null;
}

export function isGroupHallmark(id: string): boolean {
  const group = groupContaining(id);
  return group !== null && group[group.length - 1] === id;
}

/**
 * True once a milestone's own `autoCompleteWhen` is satisfied, OR — for an `ephemeral` grouped
 * step only — once any *later* step in the same group is satisfied (see `ephemeral`'s doc comment
 * for why non-ephemeral steps must never be skipped this way).
 */
export function isMilestoneComplete(milestone: MilestoneDef, ctx: MilestoneContext): boolean {
  if (milestone.autoCompleteWhen?.(ctx)) return true;
  if (!milestone.ephemeral) return false;
  const group = groupContaining(milestone.id);
  if (!group) return false;
  return group.slice(group.indexOf(milestone.id) + 1).some((laterId) => {
    const later = MILESTONES.find((m) => m.id === laterId);
    return later?.autoCompleteWhen?.(ctx) ?? false;
  });
}
