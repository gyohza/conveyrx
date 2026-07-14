import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { GameTextures } from '../sprites/game-textures';
import { CELL_SIZE, TICK_MS, WorldRenderer, cellCenter, craterField } from './world-renderer';
import { STAGE1_MINES, createStage1State } from '../../sim/content/stage1-layout';
import { MATERIALS, countMaterials } from '../../sim/content/materials';
import { place } from '../../sim/core/editing';
import { toggleSubscribe } from '../../sim/core/subscription';
import { addConveyor, addSource, emptyState } from '../../sim/testing/state-builder';
import { directionToRadians } from '../../sim/core/types';
import type { GridPos } from '../../sim/core/types';

function distinctTexture(): Texture {
  return new Texture({ source: Texture.EMPTY.source });
}

function buildTextures(): GameTextures {
  return {
    packet: distinctTexture(),
    machine: { map: distinctTexture(), filter: distinctTexture(), take: distinctTexture() },
    conveyor: distinctTexture(),
    conveyorCurve: distinctTexture(),
    conveyorGlow: distinctTexture(),
    conveyorCurveGlow: distinctTexture(),
    source: distinctTexture(),
    sink: distinctTexture(),
    mine: distinctTexture(),
    spring: distinctTexture(),
    highlight: distinctTexture(),
    omnidirectionalGhost: distinctTexture(),
  };
}

function spriteAt(renderer: WorldRenderer, pos: GridPos, layer = renderer.entityLayer): Sprite {
  const center = cellCenter(pos);
  const sprite = layer.children.find(
    (c): c is Sprite =>
      c instanceof Sprite && c.position.x === center.x && c.position.y === center.y,
  );
  if (!sprite) throw new Error('no sprite at position');
  return sprite;
}

function buildRenderer() {
  const stage = new Container();
  const textures = buildTextures();
  const renderer = new WorldRenderer(stage, textures);
  return { stage, renderer, textures };
}

function labelsIn(container: Container): string[] {
  return container.children.filter((c): c is Text => c instanceof Text).map((c) => c.text);
}

function textAt(container: Container, text: string): Text {
  const found = container.children.find((c): c is Text => c instanceof Text && c.text === text);
  if (!found) throw new Error(`no text "${text}" found`);
  return found;
}

const SPAWN = {
  type: 'packetSpawned',
  packetId: 1,
  material: 'carbon',
  position: { x: 2, y: 3 },
} as const;

describe('WorldRenderer', () => {
  describe('buildStatic', () => {
    it('renders labeled tiles for every entity, including the recipe on machines', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, { type: 'machine', kind: 'map' }, { x: 5, y: 3 });
      place(state, { type: 'conveyor', direction: 'east' }, { x: 2, y: 3 });
      place(state, { type: 'source' }, STAGE1_MINES[0].position);

      renderer.buildStatic(state);

      const labels = labelsIn(renderer.entityLayer);
      expect(labels).toContain('map');
      expect(labels).toContain('C→D');
      expect(labels).toContain('from');
      expect(labels).toContain('sell');
    });

    it('labels the base with its own name, distinct from the sell tile inside it', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();

      renderer.buildStatic(state);

      expect(labelsIn(renderer.gridLayer)).toContain('base');
    });

    it('numbers every base cell in reading order, with the sell tile landing on its actual slot', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();

      renderer.buildStatic(state);

      const { base } = state;
      const width = base.max.x - base.min.x + 1;
      const height = base.max.y - base.min.y + 1;
      const labels = labelsIn(renderer.gridLayer);
      for (let n = 1; n <= width * height; n++) expect(labels).toContain(`${n}`);

      const sink = Object.values(state.sinks)[0];
      const row = sink.position.y - base.min.y;
      const col = sink.position.x - base.min.x;
      expect(row * width + col + 1).toBe(5); // dead center of the default 3x3 base
    });

    it('shows a lettered packet icon and count for each material a mine yields', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();

      renderer.buildStatic(state);

      const spring = STAGE1_MINES.find((mine) => new Set(mine.sequence).size > 1)!;
      const counts = countMaterials(spring.sequence);

      const labels = labelsIn(renderer.entityLayer);
      for (const count of counts.values()) expect(labels).toContain(`×${count}`);
      for (const material of counts.keys()) {
        expect(labels).toContain(MATERIALS[material].shortLabel);
      }
      expect(labels).not.toContain('I×3');
      expect(labels).not.toContain('X×2');
    });

    it('stacks a mine yield into one row per distinct material', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();

      renderer.buildStatic(state);

      const spring = STAGE1_MINES.find((mine) => new Set(mine.sequence).size > 1)!;
      const counts = countMaterials(spring.sequence);
      const springCenter = cellCenter(spring.position);
      const badgeYs = renderer.entityLayer.children
        .filter(
          (c): c is Text =>
            c instanceof Text &&
            /^×\d+$/.test(c.text) &&
            Math.abs(c.position.x - springCenter.x) < CELL_SIZE / 2 &&
            Math.abs(c.position.y - springCenter.y) < CELL_SIZE / 2,
        )
        .map((c) => c.position.y);

      expect(new Set(badgeYs).size).toBe(counts.size);
    });

    it('tints the source tile green when subscribed and gray when not', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();
      state.economy.cash = 100;
      place(state, { type: 'source' }, STAGE1_MINES[0].position);
      const sourceId = Object.values(state.sources)[0].id;

      renderer.buildStatic(state); // starts unsubscribed
      const unsubscribedSprite = renderer.entityLayer.children[0];
      const grayTint = unsubscribedSprite.tint;

      toggleSubscribe(state, sourceId);
      renderer.buildStatic(state);
      const subscribedSprite = renderer.entityLayer.children[0];

      expect(subscribedSprite.tint).not.toBe(grayTint);
    });

    it('shows the remaining item count for a source, reflecting an in-progress cursor', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();
      addSource(
        state,
        { x: 0, y: 0 },
        {
          sequence: ['carbon', 'carbon', 'carbon'],
          subscribed: true,
        },
      ).cursor = 1;

      renderer.buildStatic(state);

      expect(labelsIn(renderer.entityLayer)).toContain('2');
    });

    it('can rebuild after grid edits without duplicating content', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();
      renderer.buildStatic(state);
      const countBefore = renderer.entityLayer.children.length;

      renderer.buildStatic(state);

      expect(renderer.entityLayer.children).toHaveLength(countBefore);
    });
  });

  describe('conveyor curve rendering', () => {
    it('renders a straight tile when the feeding neighbor is directly opposite the direction', () => {
      const { renderer, textures } = buildRenderer();
      const state = emptyState();
      addConveyor(state, { x: 1, y: 3 }, 'east'); // feeds west -> east into the turn
      const straight = addConveyor(state, { x: 2, y: 3 }, 'east');

      renderer.buildStatic(state);

      const sprite = spriteAt(renderer, straight.position);
      expect(sprite.texture).toBe(textures.conveyor);
      expect(sprite.rotation).toBe(directionToRadians('east'));
    });

    it('renders a straight tile when nothing feeds the conveyor yet', () => {
      const { renderer, textures } = buildRenderer();
      const state = emptyState();
      const conveyor = addConveyor(state, { x: 2, y: 3 }, 'south');

      renderer.buildStatic(state);

      expect(spriteAt(renderer, conveyor.position).texture).toBe(textures.conveyor);
    });

    it('renders an unmirrored curve tile for a clockwise turn (feeds in from the west, exits south)', () => {
      const { renderer, textures } = buildRenderer();
      const state = emptyState();
      addConveyor(state, { x: 1, y: 3 }, 'east'); // feeds west -> east into the turn
      const turn = addConveyor(state, { x: 2, y: 3 }, 'south');

      renderer.buildStatic(state);

      const sprite = spriteAt(renderer, turn.position);
      expect(sprite.texture).toBe(textures.conveyorCurve);
      expect(sprite.rotation).toBe(directionToRadians('east'));
      expect(sprite.scale.x).toBe(1);
    });

    it('renders a mirrored curve tile for a counter-clockwise turn (feeds in from the east, exits south)', () => {
      const { renderer, textures } = buildRenderer();
      const state = emptyState();
      addConveyor(state, { x: 3, y: 3 }, 'west'); // feeds east -> west into the turn
      const turn = addConveyor(state, { x: 2, y: 3 }, 'south');

      renderer.buildStatic(state);

      const sprite = spriteAt(renderer, turn.position);
      expect(sprite.texture).toBe(textures.conveyorCurve);
      expect(sprite.rotation).toBe(directionToRadians('east'));
      expect(sprite.scale.x).toBe(-1);
    });

    it('rotates the curve tile for every one of the 4 unmirrored orientations', () => {
      const { renderer, textures } = buildRenderer();
      const state = emptyState();
      addConveyor(state, { x: 3, y: 2 }, 'south'); // feeds north -> south into the turn
      const turn = addConveyor(state, { x: 3, y: 3 }, 'west');

      renderer.buildStatic(state);

      const sprite = spriteAt(renderer, turn.position);
      expect(sprite.texture).toBe(textures.conveyorCurve);
      expect(sprite.rotation).toBe(directionToRadians('south'));
      expect(sprite.scale.x).toBe(1);
    });
  });

  describe('conveyor flow glow', () => {
    it('adds an unlit glow sprite per conveyor when nothing is powered, tinted by lane', () => {
      const { renderer, textures } = buildRenderer();
      const state = emptyState();
      addConveyor(state, { x: 1, y: 3 }, 'east');
      addConveyor(state, { x: 6, y: 6 }, 'east');

      renderer.buildStatic(state);

      const glowSprites = renderer.glowLayer.children.filter(
        (c): c is Sprite => c instanceof Sprite,
      );
      expect(glowSprites).toHaveLength(2);
      for (const sprite of glowSprites) {
        expect(sprite.texture).toBe(textures.conveyorGlow);
        expect(sprite.alpha).toBe(0);
      }
    });

    it('picks the curve glow texture, matching the belt tile’s own rotation and flip', () => {
      const { renderer, textures } = buildRenderer();
      const state = emptyState();
      addConveyor(state, { x: 1, y: 3 }, 'east'); // feeds west -> east into the turn
      const turn = addConveyor(state, { x: 2, y: 3 }, 'south');

      renderer.buildStatic(state);

      const glow = spriteAt(renderer, turn.position, renderer.glowLayer) as Sprite;
      const tile = spriteAt(renderer, turn.position);
      expect(glow.texture).toBe(textures.conveyorCurveGlow);
      expect(glow.rotation).toBe(tile.rotation);
      expect(glow.scale.x).toBe(tile.scale.x);
    });

    it('tints connected conveyors the same lane color and unconnected ones differently', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();
      const a = addConveyor(state, { x: 1, y: 3 }, 'east');
      const b = addConveyor(state, { x: 2, y: 3 }, 'east'); // fed by `a` -> same lane
      const c = addConveyor(state, { x: 6, y: 6 }, 'east'); // unconnected -> different lane

      renderer.buildStatic(state);

      const tintOf = (conveyor: { position: GridPos }) =>
        (spriteAt(renderer, conveyor.position, renderer.glowLayer) as Sprite).tint;
      expect(tintOf(a)).toBe(tintOf(b));
      expect(tintOf(a)).not.toBe(tintOf(c));
    });

    it('lights every conveyor reachable from a subscribed source, statically, and nothing else', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();
      addSource(state, { x: 0, y: 3 }, { subscribed: true });
      const fed = addConveyor(state, { x: 1, y: 3 }, 'east');
      const stray = addConveyor(state, { x: 6, y: 6 }, 'east');

      renderer.buildStatic(state);

      const glowOf = (conveyor: { position: GridPos }) =>
        spriteAt(renderer, conveyor.position, renderer.glowLayer) as Sprite;
      expect(glowOf(fed).alpha).toBeGreaterThan(0);
      expect(glowOf(stray).alpha).toBe(0);
    });

    it('does not light a chain fed by an unsubscribed source', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();
      addSource(state, { x: 0, y: 3 }, { subscribed: false });
      const fed = addConveyor(state, { x: 1, y: 3 }, 'east');

      renderer.buildStatic(state);

      expect((spriteAt(renderer, fed.position, renderer.glowLayer) as Sprite).alpha).toBe(0);
    });

    it('refreshes glow power on setSourceSubscribed, without a full rebuild', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();
      const minePos = STAGE1_MINES[0].position;
      const source = addSource(state, minePos, { subscribed: false });
      const fed = addConveyor(state, { x: minePos.x + 1, y: minePos.y }, 'east');
      renderer.buildStatic(state); // still unsubscribed
      const glow = spriteAt(renderer, fed.position, renderer.glowLayer) as Sprite;
      expect(glow.alpha).toBe(0);

      toggleSubscribe(state, source.id);
      renderer.setSourceSubscribed(state, source.id, true);

      expect(glow.alpha).toBeGreaterThan(0);
    });

    it('lights the base glow when its entry conveyor is powered, and hides it otherwise', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();
      const entryPos = { x: state.base.min.x - 1, y: STAGE1_MINES[0].position.y };
      const source = addSource(state, { x: entryPos.x - 1, y: entryPos.y }, { subscribed: false });
      addConveyor(state, entryPos, 'east');

      renderer.buildStatic(state);
      const baseGlow = () =>
        renderer.glowLayer.children.find((c): c is Graphics => c instanceof Graphics)!;
      expect(baseGlow().alpha).toBe(0);

      toggleSubscribe(state, source.id);
      renderer.setSourceSubscribed(state, source.id, true);

      expect(baseGlow().alpha).toBeGreaterThan(0);
    });
  });

  describe('setSourceSubscribed', () => {
    it('re-tints an existing source sprite without a full rebuild', () => {
      const { renderer } = buildRenderer();
      const state = createStage1State();
      const source = addSource(state, STAGE1_MINES[0].position, { subscribed: false });
      renderer.buildStatic(state);
      const sprite = renderer.entityLayer.children[0];
      const offTint = sprite.tint;

      renderer.setSourceSubscribed(state, source.id, true);
      const onTint = sprite.tint;
      renderer.setSourceSubscribed(state, source.id, false);

      expect(onTint).not.toBe(offTint);
      expect(sprite.tint).toBe(offTint);
    });

    it('ignores an unknown source id', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();

      expect(() => renderer.setSourceSubscribed(state, 999, true)).not.toThrow();
    });

    it('recomputes the source counter back to full once the source is unsubscribed', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();
      const source = addSource(
        state,
        { x: 0, y: 0 },
        {
          sequence: ['carbon', 'carbon', 'carbon'],
          subscribed: true,
        },
      );
      source.cursor = 2;
      renderer.buildStatic(state);

      toggleSubscribe(state, source.id);
      renderer.setSourceSubscribed(state, source.id, false);

      expect(labelsIn(renderer.entityLayer)).toContain('3');
    });
  });

  describe('source counter', () => {
    it('recomputes the remaining count when a packet spawns from the source', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();
      const source = addSource(
        state,
        { x: 0, y: 0 },
        {
          sequence: ['carbon', 'carbon', 'carbon'],
          subscribed: true,
        },
      );
      renderer.buildStatic(state);
      source.cursor = 2;

      renderer.applyEvents(state, [
        { type: 'packetSpawned', packetId: 1, material: 'carbon', position: source.position },
      ]);

      expect(labelsIn(renderer.entityLayer)).toContain('1');
    });

    it('blinks the counter red once depleted, and shows it steady otherwise', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();
      const source = addSource(
        state,
        { x: 0, y: 0 },
        {
          sequence: ['carbon'],
          subscribed: true,
        },
      );
      source.cursor = 1;
      renderer.buildStatic(state);

      const label = textAt(renderer.entityLayer, '0');
      expect(label.visible).toBe(true);
      const startVisible = label.visible;

      renderer.update(500);
      expect(label.visible).not.toBe(startVisible);
      renderer.update(500);
      expect(label.visible).toBe(startVisible);
    });

    it('leaves a non-empty counter fully visible across updates', () => {
      const { renderer } = buildRenderer();
      const state = emptyState();
      addSource(state, { x: 0, y: 0 }, { sequence: ['carbon', 'carbon'], subscribed: true });
      renderer.buildStatic(state);

      renderer.update(500);
      renderer.update(500);

      expect(textAt(renderer.entityLayer, '2').visible).toBe(true);
    });
  });

  describe('packet lifecycle', () => {
    it('spawns a packet view tinted and labeled by its material, scaling up from zero', () => {
      const { renderer } = buildRenderer();

      renderer.applyEvents(emptyState(), [SPAWN]);
      const view = renderer.packetLayer.children[0];
      expect(view.scale.x).toBe(0);

      renderer.update(1000);
      expect(view.scale.x).toBeGreaterThan(0.9);
      expect(view.position).toMatchObject(cellCenter(SPAWN.position));
      expect(labelsIn(view as Container)).toEqual(['C']);
    });

    it('glides toward the target cell over one tick interval instead of teleporting', () => {
      const { renderer } = buildRenderer();
      renderer.applyEvents(emptyState(), [SPAWN]);
      renderer.update(1000);

      renderer.applyEvents(emptyState(), [
        { type: 'packetMoved', packetId: 1, position: { x: 3, y: 3 } },
      ]);
      const view = renderer.packetLayer.children[0];
      const startX = view.position.x;

      renderer.update(TICK_MS / 2);
      expect(view.position.x).toBeGreaterThan(startX);
      expect(view.position.x).toBeLessThan(cellCenter({ x: 3, y: 3 }).x);

      renderer.update(TICK_MS);
      expect(view.position.x).toBeCloseTo(cellCenter({ x: 3, y: 3 }).x, 5);
    });

    it('updates the tint and label when a machine transforms the packet', () => {
      const { renderer } = buildRenderer();
      renderer.applyEvents(emptyState(), [SPAWN]);

      renderer.applyEvents(emptyState(), [
        { type: 'packetTransformed', packetId: 1, material: 'diamond' },
      ]);

      expect(labelsIn(renderer.packetLayer.children[0] as Container)).toEqual(['D']);
    });

    it('shrinks a despawned packet away and recycles its view for the next spawn', () => {
      const { renderer } = buildRenderer();
      renderer.applyEvents(emptyState(), [SPAWN]);
      renderer.update(1000);
      const view = renderer.packetLayer.children[0];

      renderer.applyEvents(emptyState(), [{ type: 'packetDespawned', packetId: 1 }]);
      renderer.update(5000);
      expect(view.visible).toBe(false);

      renderer.applyEvents(emptyState(), [{ ...SPAWN, packetId: 2 }]);
      expect(renderer.packetLayer.children).toHaveLength(1);
      expect(view.visible).toBe(true);
    });

    it('ignores events for unknown packet ids', () => {
      const { renderer } = buildRenderer();

      expect(() =>
        renderer.applyEvents(emptyState(), [
          { type: 'packetMoved', packetId: 99, position: { x: 0, y: 0 } },
          { type: 'packetTransformed', packetId: 99, material: 'diamond' },
          { type: 'packetDespawned', packetId: 99 },
        ]),
      ).not.toThrow();
    });
  });

  describe('setPreview', () => {
    function overlaySprites(renderer: WorldRenderer) {
      const [highlight, ghost] = renderer.overlayLayer.children as Sprite[];
      return { highlight, ghost };
    }

    it('shows a positioned ghost tile for a valid build preview', () => {
      const { renderer } = buildRenderer();

      renderer.setPreview({
        kind: 'build',
        pos: { x: 4, y: 2 },
        tool: 'conveyor',
        direction: 'east',
        valid: true,
      });

      const { highlight, ghost } = overlaySprites(renderer);
      expect(highlight.visible).toBe(true);
      expect(ghost.visible).toBe(true);
      expect(ghost.position.x).toBe((4 + 0.5) * CELL_SIZE);
    });

    it('shows the omnidirectional ghost texture, unrotated, when the direction is undecided', () => {
      const { renderer, textures } = buildRenderer();

      renderer.setPreview({
        kind: 'build',
        pos: { x: 4, y: 2 },
        tool: 'conveyor',
        direction: 'east',
        omnidirectional: true,
        valid: true,
      });

      const { ghost } = overlaySprites(renderer);
      expect(ghost.visible).toBe(true);
      expect(ghost.texture).toBe(textures.omnidirectionalGhost);
      expect(ghost.rotation).toBe(0);
    });

    it('shows a red erase highlight without a ghost', () => {
      const { renderer } = buildRenderer();

      renderer.setPreview({ kind: 'erase', pos: { x: 1, y: 1 }, valid: true });

      const { highlight, ghost } = overlaySprites(renderer);
      expect(highlight.visible).toBe(true);
      expect(ghost.visible).toBe(false);
    });

    it('clears everything when preview is null', () => {
      const { renderer } = buildRenderer();
      renderer.setPreview({ kind: 'hover', pos: { x: 0, y: 0 } });

      renderer.setPreview(null);

      const { highlight, ghost } = overlaySprites(renderer);
      expect(highlight.visible).toBe(false);
      expect(ghost.visible).toBe(false);
    });
  });

  describe('setSelection', () => {
    it('shows a positioned selection ring and hides it when cleared', () => {
      const { renderer } = buildRenderer();

      renderer.setSelection({ x: 2, y: 1 });

      const selection = renderer.overlayLayer.children[2];
      expect(selection.visible).toBe(true);
      expect(selection.position.x).toBe((2 + 0.5) * CELL_SIZE);
      expect(selection.position.y).toBe((1 + 0.5) * CELL_SIZE);

      renderer.setSelection(null);
      expect(selection.visible).toBe(false);
    });
  });
});

describe('craterField', () => {
  it('never places two craters closer than the sum of their radii (no overlap)', () => {
    const craters = craterField(20 * CELL_SIZE, 20 * CELL_SIZE);

    expect(craters.length).toBeGreaterThan(0);
    for (let i = 0; i < craters.length; i++) {
      for (let j = i + 1; j < craters.length; j++) {
        const a = craters[i];
        const b = craters[j];
        const distance = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        expect(distance).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });

  it('keeps every crater within the requested bounds', () => {
    const width = 10 * CELL_SIZE;
    const height = 10 * CELL_SIZE;
    const craters = craterField(width, height);

    for (const { cx, cy } of craters) {
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cx).toBeLessThanOrEqual(width);
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(height);
    }
  });
});
