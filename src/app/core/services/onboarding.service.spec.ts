import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingService } from './onboarding.service';
import { BuildToolService } from './build-tool.service';
import { SimEngineService } from './sim-engine.service';
import { STAGE1_MINES, STAGE1_SINK_POS } from '@sim/content/stage1-layout';
import { loadSeenIds } from './onboarding-save';

/** Lays a straight run of pipes connecting the mine to the sink (same row on the stage1 map). */
function connectSourceToSink(engine: SimEngineService): void {
  const sourcePos = STAGE1_MINES[0].position;
  for (let x = sourcePos.x + 1; x < STAGE1_SINK_POS.x; x++) {
    engine.place({ type: 'conveyor', direction: 'east' }, { x, y: sourcePos.y });
  }
}

/** Runs every step of the scripted setup arc up to (not including) subscribing. */
function runUpToSubscribing(): void {
  const onboarding = TestBed.inject(OnboardingService);
  const tools = TestBed.inject(BuildToolService);
  const engine = TestBed.inject(SimEngineService);
  onboarding.dismiss('welcome');
  tools.select('source');
  TestBed.flushEffects();
  engine.place({ type: 'source' }, STAGE1_MINES[0].position);
  TestBed.flushEffects();
  onboarding.dismiss('subscriber-intro');
  tools.select('conveyor');
  TestBed.flushEffects();
  connectSourceToSink(engine);
  TestBed.flushEffects();
}

function subscribeSource(): void {
  const engine = TestBed.inject(SimEngineService);
  const sourceId = Object.values(engine.state().sources)[0].id;
  engine.toggleSubscribe(sourceId);
  TestBed.flushEffects();
}

describe('OnboardingService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows welcome as the active milestone on a fresh game', () => {
    const onboarding = TestBed.inject(OnboardingService);

    expect(onboarding.active()?.id).toBe('welcome');
  });

  it('does not skip "pick your source" just because the player tried the pipe tool first', () => {
    const onboarding = TestBed.inject(OnboardingService);
    const tools = TestBed.inject(BuildToolService);
    onboarding.dismiss('welcome');

    tools.select('conveyor');
    TestBed.flushEffects();

    expect(onboarding.active()?.id).toBe('select-source-tool');
  });

  it('walks the full scripted setup arc in order, with no manual dismiss for action steps', () => {
    const onboarding = TestBed.inject(OnboardingService);
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);

    onboarding.dismiss('welcome');
    expect(onboarding.active()?.id).toBe('select-source-tool');

    tools.select('source');
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('place-source');

    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('subscriber-intro');

    onboarding.dismiss('subscriber-intro');
    expect(onboarding.active()?.id).toBe('select-conveyor-tool');

    tools.select('conveyor');
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('connect-source-to-subscriber');

    connectSourceToSink(engine);
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('source-subscribed');

    expect(onboarding.isSetupComplete()).toBe(false);
    subscribeSource();
    expect(onboarding.active()?.id).toBe('flowing');
    expect(onboarding.isSetupComplete()).toBe(true);
  });

  it('shows first-cash once a sale happens, then source-exhausted once the batch runs dry', () => {
    runUpToSubscribing();
    subscribeSource();
    const onboarding = TestBed.inject(OnboardingService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('flowing');

    engine.state().economy.saleCount += 1;
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 0, y: 0 });
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('first-cash');

    onboarding.dismiss('first-cash');
    const sourceId = Object.values(engine.state().sources)[0].id;
    engine.state().sources[sourceId].cursor = engine.state().sources[sourceId].sequence.length;
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 0, y: 1 });
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('source-exhausted');

    onboarding.dismiss('source-exhausted');
    expect(onboarding.active()?.id).toBe('force-unsubscribe');

    engine.toggleSubscribe(sourceId);
    TestBed.flushEffects();
    expect(onboarding.active()?.id).not.toBe('force-unsubscribe');
  });

  it('shows "unsubscribe it" only once, even if the same drained source leaks again later', () => {
    runUpToSubscribing();
    subscribeSource();
    const onboarding = TestBed.inject(OnboardingService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('flowing');
    const sourceId = Object.values(engine.state().sources)[0].id;
    engine.state().sources[sourceId].cursor = engine.state().sources[sourceId].sequence.length;
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 0, y: 2 });
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('source-exhausted');
    onboarding.dismiss('source-exhausted');
    expect(onboarding.active()?.id).toBe('force-unsubscribe');

    engine.toggleSubscribe(sourceId);
    TestBed.flushEffects();
    expect(loadSeenIds().has('force-unsubscribe')).toBe(true);

    engine.toggleSubscribe(sourceId);
    TestBed.flushEffects();

    expect(onboarding.active()?.id).not.toBe('force-unsubscribe');
  });

  it('proactively suggests map once it is affordable and nothing is subscribed, then forces it onto a pipe', () => {
    runUpToSubscribing();
    subscribeSource();
    const onboarding = TestBed.inject(OnboardingService);
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('flowing');
    const sourceId = Object.values(engine.state().sources)[0].id;
    const sourcePos = STAGE1_MINES[0].position;

    engine.toggleSubscribe(sourceId);
    engine.state().economy.cash = 500;
    engine.state().economy.peakCash = 500;
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 0, y: 2 });
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('map-unlocked');

    tools.select('map');
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('map-placed-on-pipe');

    engine.place({ type: 'machine', kind: 'map' }, { x: sourcePos.x + 1, y: sourcePos.y });
    TestBed.flushEffects();

    expect(onboarding.active()?.id).not.toBe('map-placed-on-pipe');
    expect(loadSeenIds().has('map-placed-on-pipe')).toBe(true);
  });

  it('does not let "drop it on a pipe" jump ahead of "try an operator" when a source gets resubscribed', () => {
    runUpToSubscribing();
    subscribeSource();
    const onboarding = TestBed.inject(OnboardingService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('flowing');
    const sourceId = Object.values(engine.state().sources)[0].id;

    engine.toggleSubscribe(sourceId);
    engine.state().economy.cash = 500;
    engine.state().economy.peakCash = 500;
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 0, y: 2 });
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('map-unlocked');

    engine.toggleSubscribe(sourceId);
    TestBed.flushEffects();

    expect(onboarding.active()?.id).not.toBe('map-placed-on-pipe');
  });

  it('does not suggest map while a source is still actively subscribed', () => {
    runUpToSubscribing();
    subscribeSource();
    const onboarding = TestBed.inject(OnboardingService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('flowing');

    engine.state().economy.cash = 500;
    engine.state().economy.peakCash = 500;
    engine.place({ type: 'conveyor', direction: 'east' }, { x: 0, y: 2 });
    TestBed.flushEffects();

    expect(onboarding.active()?.id).not.toBe('map-unlocked');
  });

  it("omits milestones that haven't triggered yet from the log", () => {
    const onboarding = TestBed.inject(OnboardingService);

    const ids = onboarding.log().map((m) => m.id);

    expect(ids).toContain('welcome');
    expect(ids).not.toContain('source-exhausted');
  });

  it('keeps a milestone in the log once seen, even if it stops being triggered', () => {
    runUpToSubscribing();
    subscribeSource();
    const onboarding = TestBed.inject(OnboardingService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('flowing');
    const sourceId = Object.values(engine.state().sources)[0].id;

    engine.toggleSubscribe(sourceId);
    engine.toggleSubscribe(sourceId);

    const entry = onboarding.log().find((m) => m.id === 'flowing');
    expect(entry).toBeDefined();
    expect(entry?.seen).toBe(true);
  });

  it('does not persist a mid-group step, so a reload restarts the whole group from its first step', () => {
    const onboarding = TestBed.inject(OnboardingService);
    const tools = TestBed.inject(BuildToolService);
    onboarding.dismiss('welcome');
    tools.select('source');
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('place-source');
    expect(loadSeenIds().has('select-source-tool')).toBe(false);

    TestBed.resetTestingModule();
    const onboardingAfterReload = TestBed.inject(OnboardingService);

    expect(onboardingAfterReload.active()?.id).toBe('select-source-tool');
  });

  it("persists the whole group once its hallmark completes, so a later reload doesn't repeat it", () => {
    runUpToSubscribing();
    subscribeSource();
    const onboarding = TestBed.inject(OnboardingService);
    expect(onboarding.active()?.id).toBe('flowing');

    TestBed.resetTestingModule();
    const onboardingAfterReload = TestBed.inject(OnboardingService);

    expect(onboardingAfterReload.active()?.id).toBe('flowing');
    expect(onboardingAfterReload.isSetupComplete()).toBe(true);
    for (const id of [
      'select-source-tool',
      'place-source',
      'select-conveyor-tool',
      'connect-source-to-subscriber',
      'source-subscribed',
    ]) {
      expect(loadSeenIds().has(id)).toBe(true);
    }
  });

  it('does not skip "wire it up" just because the player subscribed before actually connecting a pipe', () => {
    const onboarding = TestBed.inject(OnboardingService);
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('welcome');
    tools.select('source');
    TestBed.flushEffects();
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    TestBed.flushEffects();
    onboarding.dismiss('subscriber-intro');
    tools.select('conveyor');
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('connect-source-to-subscriber');

    // Subscribe early, with no pipe laid at all yet — the engine allows this even though nothing
    // can flow. "Wire it up" must still block; it is not an ephemeral step, so a later step's
    // condition being true must never supersede it.
    subscribeSource();
    expect(onboarding.active()?.id).toBe('connect-source-to-subscriber');

    connectSourceToSink(engine);
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('flowing');
  });

  it('skips re-requiring earlier scripted steps once later ones are already satisfied by saved game state', () => {
    runUpToSubscribing();
    // Reload happens after the pipe is connected but before subscribing: the group's hallmark
    // (source-subscribed) hasn't completed, so nothing persisted — yet both tool selections
    // (source, then conveyor) are already implied by the saved game state (source placed, pipe
    // connected) and must not be re-requested.
    const onboarding = TestBed.inject(OnboardingService);
    expect(onboarding.active()?.id).toBe('source-subscribed');

    TestBed.resetTestingModule();
    const onboardingAfterReload = TestBed.inject(OnboardingService);
    TestBed.flushEffects();

    expect(onboardingAfterReload.active()?.id).toBe('source-subscribed');
  });

  it('refuses to let the source be erased before onboarding setup completes', () => {
    const onboarding = TestBed.inject(OnboardingService);

    expect(onboarding.canEraseSource()).toBe(false);

    runUpToSubscribing();
    subscribeSource();
    expect(onboarding.canEraseSource()).toBe(true);
  });

  it('refuses to let the source be subscribed until it is actually wired to the Subscriber', () => {
    const onboarding = TestBed.inject(OnboardingService);
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('welcome');
    tools.select('source');
    TestBed.flushEffects();
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    TestBed.flushEffects();
    const sourceId = Object.values(engine.state().sources)[0].id;

    expect(onboarding.canSubscribe(sourceId)).toBe(false);

    connectSourceToSink(engine);
    TestBed.flushEffects();
    expect(onboarding.canSubscribe(sourceId)).toBe(true);
  });

  it('lets subscribing happen freely once onboarding setup has completed', () => {
    runUpToSubscribing();
    subscribeSource();
    const onboarding = TestBed.inject(OnboardingService);
    const engine = TestBed.inject(SimEngineService);
    const sourceId = Object.values(engine.state().sources)[0].id;

    expect(onboarding.canSubscribe(sourceId)).toBe(true);
  });

  it("locks map interaction to the active milestone's grid anchor", () => {
    const onboarding = TestBed.inject(OnboardingService);
    onboarding.dismiss('welcome');
    const tools = TestBed.inject(BuildToolService);
    tools.select('source');
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('place-source');

    expect(onboarding.isMapInteractionAllowed(STAGE1_MINES[0].position)).toBe(true);
    expect(onboarding.isMapInteractionAllowed({ x: 9, y: 9 })).toBe(false);
  });

  it('locks out the whole map for a milestone anchored to a DOM element instead of a grid cell', () => {
    const onboarding = TestBed.inject(OnboardingService);
    expect(onboarding.active()?.id).toBe('welcome');
    onboarding.dismiss('welcome');
    expect(onboarding.active()?.id).toBe('select-source-tool');

    expect(onboarding.isMapInteractionAllowed({ x: 0, y: 0 })).toBe(false);
    expect(onboarding.isMapInteractionAllowed(STAGE1_MINES[0].position)).toBe(false);
  });

  it('allows interaction everywhere for a milestone that opts out of spotlighting', () => {
    const onboarding = TestBed.inject(OnboardingService);
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    onboarding.dismiss('welcome');
    tools.select('source');
    TestBed.flushEffects();
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    TestBed.flushEffects();
    onboarding.dismiss('subscriber-intro');
    tools.select('conveyor');
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('connect-source-to-subscriber');

    expect(onboarding.isMapInteractionAllowed({ x: 0, y: 0 })).toBe(true);
    expect(onboarding.isMapInteractionAllowed({ x: 9, y: 9 })).toBe(true);
  });

  it('allows interaction everywhere once no milestone is active', () => {
    const onboarding = TestBed.inject(OnboardingService);
    for (const m of onboarding.log()) onboarding.dismiss(m.id);

    expect(onboarding.isMapInteractionAllowed({ x: 0, y: 0 })).toBe(true);
  });

  it('persists dismissal to storage', () => {
    const onboarding = TestBed.inject(OnboardingService);

    onboarding.dismiss('welcome');

    expect(loadSeenIds().has('welcome')).toBe(true);
  });

  it('reset clears seen milestones so welcome becomes active again', () => {
    const onboarding = TestBed.inject(OnboardingService);
    onboarding.dismiss('welcome');

    onboarding.reset();

    expect(onboarding.active()?.id).toBe('welcome');
    expect(loadSeenIds()).toEqual(new Set());
  });
});
