import { describe, it, expect } from 'vitest';
import { readMegaworld, megaworldLinks, megaworldLaws, stampMegaworld, atlasOf, coreOf, ATLAS_SLICE } from './megaworld.js';
import { gameStages, gameStore, gameLevels, mapPlan, stageLevelOrder, storyCarried } from './levels.js';
import { readGameworld } from './world.js';
import { validateGameManifest } from '../game/game-manifest.js';

// THE MEGAWORLD: a game's maps as a topology, written once in rings and lowered into the links a map world already walks.

const zone = (goal) => ({ glyphs: { tile: 24, plan: { size: 3, rows: ['A B'], route: ['A', 'B'], key: { A: { name: 'near' }, B: { name: 'far', ...(goal ? { goal: { use: 'temple' } } : {}) } } } } });
const levels = { town: zone(), woods: zone(), meadows: zone(), citadel: zone(true) };
const M = { shape: 'mandala', rings: [['town'], ['woods', 'meadows'], ['citadel']], gates: { citadel: { key: 'seal', keyAt: 'meadows' } } };
const world = stampMegaworld({ id: 'w', levels, megaworld: M });

describe('the megaworld', () => {
  it('lowers each shape into links, its gates on the ways in', () => {
    expect(megaworldLinks(M)).toEqual([
      { from: 'town', to: 'woods', kind: 'road' }, { from: 'town', to: 'meadows', kind: 'road' },
      { from: 'woods', to: 'citadel', kind: 'gate', key: 'seal', keyAt: 'meadows' },
    ]);
    expect(megaworldLinks({ shape: 'chain', rings: [['a'], ['b'], ['c']] }).map((l) => `${l.from}-${l.to}`)).toEqual(['a-b', 'b-c']);
    expect(megaworldLinks({ shape: 'hub', rings: [['h'], ['a', 'b']] }).map((l) => `${l.from}-${l.to}`)).toEqual(['h-a', 'h-b']);
    expect(megaworldLinks({ shape: 'open', rings: [['a', 'b', 'c']] }).map((l) => `${l.from}-${l.to}`)).toEqual(['a-b', 'b-c', 'c-a']);
    expect(megaworldLinks({ shape: 'open', rings: [['a', 'b']] }).map((l) => `${l.from}-${l.to}`)).toEqual(['a-b']);
  });

  it('holds WCD\'s laws at the world\'s scale: they advise', () => {
    const law = (m, n) => megaworldLaws(m).find((l) => l.law === n);
    for (const l of megaworldLaws(M)) expect(l.ok, l.says).toBe(true);
    const { gates: _, ...open } = M;
    expect(law(open, 'gated').ok).toBe(false);
    // (a key behind the gate it opens is never reached)
    const behind = { shape: 'mandala', rings: [['t'], ['c']], gates: { c: { key: 'k', keyAt: 'c' } } };
    expect(law(behind, 'reached').ok).toBe(false);
    expect(law(behind, 'keys-inside').ok).toBe(false);
  });

  it('refuses what it cannot read, by name', () => {
    const bad = (m, re) => expect(() => readMegaworld(m, levels)).toThrow(re);
    bad({ shape: 'spiral', rings: [['town'], ['woods']] }, /\.shape is/);
    bad({ shape: 'chain', rings: [['town'], ['nowhere']] }, /'nowhere' is no level/);
    bad({ shape: 'chain', rings: [['town'], ['town']] }, /stands in two places/);
    bad({ shape: 'mandala', rings: [['town'], ['woods', 'citadel']] }, /last ring is its core/);
    bad({ shape: 'hub', rings: [['town', 'woods'], ['citadel']] }, /home alone/);
    bad({ shape: 'chain', rings: [['town'], ['woods']], gates: { town: { needs: 'x' } } }, /never shut/);
    bad({ shape: 'chain', rings: [['town'], ['woods']], gates: { woods: { needs: 'x', key: 'y', keyAt: 'town' } } }, /one or the other/);
    expect(() => readGameworld({ id: 'w', levels, megaworld: { shape: 'chain', rings: [['x'], ['y']] } })).toThrow(/'x' is no level/);
  });

  it('is laid into the recipe at authoring; a world without one is handed back as it came', () => {
    const none = { id: 'w' };
    expect(stampMegaworld(none)).toBe(none);
    expect(world).toMatchObject({ topology: 'interconnected', start: 'town' });
    expect(world.links).toEqual(megaworldLinks(M));
    expect(stampMegaworld({ id: 'w', levels, megaworld: { shape: 'hub', rings: [['town'], ['woods', 'meadows']] } }).hub).toBe('town');
  });

  it('makes glyph maps zones: each with its ways out, keeping where the player is in the store, carrying what was won', () => {
    const G = readGameworld(world), stages = gameStages(world), refs = stages.map((s) => `ref-${s.level}`);
    expect(stages.map((s) => s.section)).toEqual(['map', 'map', 'map', 'map']);
    const plan = mapPlan(G, stages, refs), L = gameLevels(stages, refs, plan);
    expect(L.find((l) => l.ref === 'ref-town').exits.map((x) => x.to)).toEqual(['ref-woods', 'ref-meadows']);
    expect(L.find((l) => l.ref === 'ref-woods').exits.find((x) => x.to === 'ref-citadel').gate).toEqual({ has: 'seal', slice: 'bag' });
    // (each stage lays its ways: a reach-exit on the map's own ground, the way back arrived at)
    const at = stages.findIndex((s) => s.level === 'woods'), O = stageLevelOrder(G, stages[at], { ref: refs[at], heroRef: null, map: plan[at] });
    const exits = O.args.manifest.game.mechanics.filter((x) => x.kind === 'reach-exit');
    expect(exits.map((x) => x.exit).sort()).toEqual(['back', 'on']);
    expect(O.args.manifest.game.arrive).toContain('ref-citadel');
    // (the core has no way on: reaching its goal is the level's win, no exit taken, and the game's end)
    const c = stages.findIndex((s) => s.level === 'citadel'), core = stageLevelOrder(G, stages[c], { ref: refs[c], heroRef: null, map: plan[c] }).args.manifest.game.mechanics.filter((x) => x.kind === 'reach-exit');
    expect(core.map((x) => x.exit ?? null).sort()).toEqual(['back', null]);
    expect(coreOf(G.megaworld, stages, refs)).toBe('ref-citadel');
    expect(coreOf({ shape: 'chain', rings: [['town'], ['woods']] }, stages, refs)).toBeNull();
    // (the store: the atlas slice, and the story flags a won pack is kept in)
    const store = gameStore(world, null);
    expect(store.slices.find((s) => s.name === ATLAS_SLICE)).toEqual({ name: ATLAS_SLICE, kind: 'flags' });
    expect(storyCarried(G)).toBe(true);
    const atlas = atlasOf(G.megaworld, stages, refs);
    expect(atlas).toEqual({ slice: ATLAS_SLICE, shape: 'mandala', rings: [['ref-town'], ['ref-woods', 'ref-meadows'], ['ref-citadel']] });
    const game = { kind: 'game', title: 'w', shell: 'play', store, levels: L, atlas, allow_unaudited: true };
    expect(validateGameManifest(game).errors.filter((e) => /atlas/.test(e))).toEqual([]);
    expect(validateGameManifest({ ...game, atlas: { ...atlas, slice: 'hero' } }).errors.join(' ')).toMatch(/atlas\.slice is a flags slice/);
  });
});
