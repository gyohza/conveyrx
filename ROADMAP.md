# ConveyRx operator roadmap

The committed, durable version of "what RxJS operator lands next" — referenced from the README so
that sentence never dangles again. This is the _decided sequencing_: a tier belongs here once it
has a clear place in the order, even when its implementation details are still open questions.
Ideas that don't have a sequencing decision yet at all belong in `BACKLOG.md` instead (git-ignored,
transient) — when a backlog idea graduates to "has a place in the sequence," move it here and
delete it from there.

Sequencing is driven by **engine architecture cost**, not RxJS popularity: every machine today is a
fixed 1×1 grid tile with exactly one inferred input side and one output side
(`src/sim/core/routing.ts`'s `machinePorts`), and `src/sim/core/editing.ts`'s `entityPortConflict`
actively rejects any placement where `inCount > 1 || outCount > 1`. Multi-input and multi-cell
machines aren't just unbuilt — they're currently disallowed by a placement check. Each tier below
introduces exactly one new kind of engine capability over the previous one.

## Tier 1 — shipped

- **Sources**: `of` (fixed 3-item sequence), `from` (6-item mine-yield sequence). Both are
  subscribe-gated and drain a flat upkeep while subscribed-but-idle (the "memory leak" lesson).
- **Machines**: `map` (recipe-based transform, currently one recipe: Carbon → Diamond), `filter`
  (material allow-list, genuinely drops non-matching packets), `take` (count-based, genuinely
  auto-unsubscribes the upstream source after N items, resets per fresh subscription).

## Tier 2 — next up, no architecture changes needed

Single-cell, single-in, single-out — fits the engine exactly as it is today.

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

## Tier 3 — time-windowed, still single-cell

Builds on Tier 2 — don't start before `interval` ships, since it's what makes this tier compelling.

- **`debounceTime`** — new machine kind holding one pending packet plus a per-tick countdown that
  resets on every new arrival; emits only after N ticks of silence. Demonstrable even against
  `of`/`from`'s fixed cadence, but much more compelling against `interval`'s continuous emission.
- **`throttleTime`** (likely companion, not a firm commitment) — a natural contrast: leading-edge
  pass-then-suppress vs. debounce's trailing-edge collapse. Worth adding in the same tier once
  `debounceTime` ships.

## Tier 4 — multi-input single-cell (requires a scoped architecture change)

- **`combineLatest`** — needs `machinePorts`/`entityPortConflict` reworked to allow 2+ distinct
  inbound conveyors into one machine tile (today `inSide`/`outSide` are singular, and
  `inCount > 1` is rejected outright). A contained "N inputs, still 1 cell, still 1 output"
  problem — the first target for solving multi-port routing generically, since it's strictly
  simpler than Tier 5's multi-cell problem. Worth its own dedicated plan-mode session focused on
  `routing.ts`/`editing.ts`/rendering (multiple pipe stubs into one tile).

## Tier 5 — higher-order flattening (deliberately not scoped here)

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

  This needs a dedicated design pass before it's scheduled for real, rather than guessing at a
  shape here. It shares its core unknown — does the engine support entities larger than 1×1 cell —
  with the Subscriber-base expansion idea in `BACKLOG.md`; solve that generically once, for both,
  when this tier's design pass happens.

## Documentation conventions

- **`ROADMAP.md`** (this file, committed): the decided operator/source sequencing. Update it when a
  tier ships (move it to Tier 1) or when a new tier's shape becomes clear enough to sequence.
- **`BACKLOG.md`** (git-ignored, transient): ideas with no sequencing decision yet — mechanics,
  content, or systems Dan has floated but that don't have a tier or an order relative to other work.
- The README's "how the game works" section links here for the full operator progression instead of
  describing tiers inline, so this is the single source of truth.
