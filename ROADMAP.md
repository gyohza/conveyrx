# ConveyRx roadmap

The committed, durable record of where the game is headed — operators and sources, and every other
planned feature, not just RxJS content. This replaces the README's old dangling "see the project
plan" reference (no such plan ever existed in this repo). `BACKLOG.md` is a separate, git-ignored,
local-only file reserved for internal process notes, not feature planning — once an idea is real
enough to plan, it lives here instead.

## Shipped

- **Sources**: `of` (fixed 3-item sequence), `from` (6-item mine-yield sequence). Both are
  subscribe-gated and drain a flat upkeep while subscribed-but-idle (the "memory leak" lesson).
- **Machines**: `map` (recipe-based transform, currently one recipe: Carbon → Diamond), `filter`
  (material allow-list, genuinely drops non-matching packets), `take` (count-based, genuinely
  auto-unsubscribes the upstream source after N items, resets per fresh subscription).
- **Milestone-driven onboarding**: contextual coach-marks triggered by actual play progress, plus a
  Tutorials log of everything triggered so far, replacing a single upfront modal.
- **Subscriber base**: the sell block is a walled, player-resizable region
  (`src/sim/core/base.ts`) rather than a bare tile — framed as the `.subscribe()` side-effect's
  home, not a pipeline stage.

## Operator & source progression

Sequenced by engine architecture cost, not RxJS popularity — each tier introduces exactly one new
kind of engine capability over the last. Every machine today is a fixed 1×1 grid tile with exactly
one inferred input side and one output side (`src/sim/core/routing.ts`'s `machinePorts`), and
`src/sim/core/editing.ts`'s `entityPortConflict` actively rejects any placement where
`inCount > 1 || outCount > 1` — multi-input and multi-cell machines aren't just unbuilt, they're
currently disallowed by a placement check.

**Tier 2 — next up, no architecture changes needed** (single-cell, single-in, single-out):

- **`scan`** — a new machine kind whose defining, teachable trait is _statefulness_: unlike
  `map`/`filter` (pure per-item), `scan` carries an accumulator forward across emissions. Fits the
  same shape as `take`'s `internal` state field already does. Open design question: packets carry a
  discrete `MaterialId`, not an arbitrary number, so the accumulator needs a game-native framing
  rather than literal `(acc, val) => acc + val` — e.g. a small selectable set of "accumulator
  recipes" (mirroring `map`'s `RECIPES` pattern), such as a streak counter that upgrades every Nth
  matching item. Not resolved here — resolve it in that stage's own plan-mode session.
- **`interval` source** — third source kind, never completes on its own. Low engineering risk: the
  `SourceKind` union and `SOURCE_KINDS` map already have the extension point (see the
  deferred-until doc comment at `src/sim/content/source-kinds.ts:1`). Pairs naturally with `take`
  (the only way to stop it) and sets up Tier 3.

**Tier 3 — time-windowed, still single-cell**. Builds on Tier 2 — don't start before `interval`
ships, since it's what makes this tier compelling:

- **`debounceTime`** — new machine kind holding one pending packet plus a per-tick countdown that
  resets on every new arrival; emits only after N ticks of silence. Demonstrable even against
  `of`/`from`'s fixed cadence, but much more compelling against `interval`'s continuous emission.
- **`throttleTime`** (likely companion, not a firm commitment) — a natural contrast: leading-edge
  pass-then-suppress vs. debounce's trailing-edge collapse. Worth adding in the same tier once
  `debounceTime` ships.

**Tier 4 — multi-input single-cell** (requires a scoped architecture change):

- **`combineLatest`** — needs `machinePorts`/`entityPortConflict` reworked to allow 2+ distinct
  inbound conveyors into one machine tile (today `inSide`/`outSide` are singular, and
  `inCount > 1` is rejected outright). A contained "N inputs, still 1 cell, still 1 output"
  problem — the first target for solving multi-port routing generically, since it's strictly
  simpler than Tier 5's multi-cell problem. Worth its own dedicated plan-mode session focused on
  `routing.ts`/`editing.ts`/rendering (multiple pipe stubs into one tile).

**Tier 5 — higher-order flattening** (deliberately not scoped here):

- **`switchMap`/`mergeMap`/`concatMap`/`exhaustMap`** — these don't just transform a passing
  packet, they _originate a new inner Observable_ per input value. Open questions, no decisions
  made:
  - Does the inner machine occupy one of the outer machine's own cells, or dock alongside it?
  - How does this interact with the existing `machinePorts` 1-in/1-out validation, which currently
    assumes a machine is a single point in the grid graph?
  - Visually: does this need multi-cell sprite/thumbnail handling (the current sprite pipeline
    bakes one texture per machine kind at a fixed `CELL_SIZE`)?
  - Does `switchMap`'s "cancel the in-progress inner work" semantic interact with the inner
    machine's own state when the outer one cancels it? Needs a new `PacketDiscarded` event —
    confirmed via grep that no `PacketDiscarded`/`packetDiscarded` exists in `src/` yet.

  Needs a dedicated design pass before it's scheduled for real, rather than guessing at a shape
  here. It shares its core unknown — does the engine support entities larger than 1×1 cell — with
  the Subscriber base expansion below; solve that generically once, for both, when this tier's
  design pass happens.

## Other planned features

**Subscriber redesign — the endpoint as a placed, configurable `.subscribe()`** — supersedes the
older "base expansion" idea below with a much more concrete shape. Today the base is a pre-seeded,
fixed-position walled rect that every source's `subscribed` flag independently pays into; the new
idea reframes the whole Subscriber as something the player _builds_, more literally mirroring
`observable.subscribe({ next, error, complete })`. Deliberately staged — build the foundation before
any of the later shape decisions, per Dan's own call:

- **Phase 1 — placed endpoint + single power toggle (base still fixed in position).**
  - Stop pre-seeding `state.base`; instead the Subscriber becomes an entity the player drops onto an
    existing pipe, the same way `map`/`filter`/`take` are placed today (`canPlace`'s `machine`
    branch in `src/sim/core/editing.ts`, including the `pipeDirection`-stub-on-erase behavior).
  - Move the subscribe/unsubscribe toggle _off_ each individual source and onto the endpoint
    itself — one shared switch standing in for a single downstream `.subscribe()` call, replacing
    today's per-source `subscribed` flag (`src/sim/core/subscription.ts`, `toggleSubscribe`, every
    upkeep-drain check keyed on `source.subscribed`). This is the single biggest semantic change in
    the whole redesign and touches the most call sites.
  - Visual: swap the walled-room look for a "plugged in / unplugged" power-outlet motif at the
    endpoint.
  - Reopens the "no entity is bigger than 1×1" limitation already flagged for Tier 5
    (`machinePorts`/`entityPortConflict`/sprite baking all assume single-cell) — solve it once, here,
    rather than guessing a second time later.
  - Needs a save-migration path: `game-save.ts` currently assumes `state.base` always exists;
    existing saves have entities already routed into a base that no longer auto-exists on load.
  - Ripples through essentially every onboarding milestone that currently references "the
    Subscriber" or "click your source to subscribe" (`subscriber-intro`, `source-subscribed`,
    `force-unsubscribe`, and their copy/anchors in `src/app/content/milestones.ts`), since the thing
    they point at and the action they describe both move.
- **Phase 2 — success / error / complete columns + a draggable function palette.**
  - Extend the endpoint from one sell-everything block into up to 3 independently colored columns
    (next/error/complete), each able to host one dragged-in operator-like function via a new
    cog/ellipsis-triggered floating palette.
  - No drag-and-drop-a-widget interaction exists anywhere in the app yet (the closest precedent,
    painting a line of pipes in `pixi-app.ts`'s `bindPointerEvents`, is a drag-to-paint gesture, not
    drag-a-thing-and-drop-it) — this is new interaction plumbing, not a reuse of an existing pattern.
  - Needs real packet classification: today nothing distinguishes "success" from "error" from
    "complete" once a packet reaches the base — everything just sells. What actually routes a packet
    to each column (upstream `filter` conditions? a thrown/failed recipe? `take`'s auto-unsubscribe
    for "complete"?) is unresolved and needs its own design pass before Phase 2 starts.
- **Phase 3 — movable / multiple subscriber instances.** Deliberately deferred (Dan's own call) until
  1 and 2 are solid. Likely reuses the existing "reconfigure something already placed" pattern
  (`redirectConveyor`, `resizeBaseEdge`) rather than needing new mechanics of its own.

**Effort**: this is the largest single item on the roadmap so far — bigger than any operator tier —
because Phase 1 alone changes where subscribe/unsubscribe _lives_ (a cross-cutting semantic change,
not additive), requires a save migration, and touches roughly a dozen non-test files
(`sim/core/{base,subscription,editing,routing,delivery}.ts`, `onboarding.service.ts`,
`milestones.ts`, `toolbar.component.ts`, `game-canvas.component.ts`, `sim-engine.service.ts`,
`pixi-app.ts`, `world-renderer.ts`) plus their specs. Phase 2 adds a genuinely new UI interaction
(nothing to extend, has to be built from scratch) on top of that. Recommend treating each phase as
its own multi-stage build (matching the existing staged-delivery convention: one stage at a time,
tests first, a go-ahead before the next stage) rather than one continuous push — Phase 1 by itself
is comparable in size to the entire milestone-onboarding system that already shipped.

**Onboarding opt-out flag** — a user-facing setting to disable coach-marks entirely for players who
don't want them. Blocked on confirming the milestone-onboarding coach-mark UI and Tutorials log are
both fully shipped first. Open questions: does it live in a settings panel (none exists yet), is it
a single global toggle, does dismissing every current coach-mark implicitly count as opting out,
does it also hide the Tutorials log entry point or just the passive toasts?

**Drag-and-drop tool placement** — let a player drag a tool button directly from the toolbar and
drop it onto a grid cell to build, as an alternative to the current click-to-select-tool then
click-to-place flow. No drag-and-drop of any kind exists between the toolbar and the Pixi canvas
today (the only existing drag is painting a line of pipes across the grid itself, handled by
`pixi-app.ts`'s `bindPointerEvents`). Would need draggable toolbar buttons (`ToolButtonComponent`)
plus a drop handler wired into `GameCanvasComponent`/`PixiGameApp`'s pointer-event handling.
Deliberately low priority — revisit when there's room for it, nothing currently blocks it.

**Terraforming / ecological system** — a more hopeful, positive counterweight to the
mining-and-selling loop, ecology- or terraforming-flavored. Not yet shaped at all: unclear whether
it's a new material, a new sink type, a passive meter tied to how the player plays (e.g. filtering
out Slag instead of dumping it feeds into it), a separate minigame, or something else entirely.
Needs a dedicated brainstorm before it can be scoped into a tier — don't guess at a design from this
entry alone.

## Documentation conventions

`ROADMAP.md` (this file, committed) is the single source of truth for planned game work, whether
that's an operator tier or any other feature — update it when something ships (move it to
"Shipped") or when a new idea gets enough shape to plan. `BACKLOG.md` (git-ignored, local-only) is
reserved for internal process notes that aren't themselves feature planning; it's often empty.
