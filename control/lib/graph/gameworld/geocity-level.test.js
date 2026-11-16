// A GEOCITY LEVEL: a district of a metro (an evocation) as a game's level, walked from its streets, its shops walked
// into, an errand traded at a till. The smallest metro that still rings, one of its outer neighbourhoods evoked.
import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel } from './world.js';
import { gameStages, stageEnds } from './levels.js';
import { layErrand } from './errand.js';
import { gameworldBibleHtml } from './bible-html.js';
import { gameworldGraph } from './graph.js';
import { runSteps } from './runner.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

const CITY = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2], evoke: 'neighbourhood', at: 'B4', shops: { cards: ['electronics'] } };
const WORLD = { id: 'district-walk', name: 'District walk', seed: 2, levels: { district: { name: 'The district', geocity: CITY } } };
const G = readGameworld(WORLD), stage = gameStages(G)[0], E = stageEnds(stage.manifest);
const within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];

describe('a geocity level', () => {
  it('reads as the district alone, on its cube, an evocation and never the metro', () => {
    expect(resolveLevel(G, 'district').geocity).toMatchObject({ spec: CITY, cube: { from: 'valley-morning', era: 'gen-7' } });
    const { at: _at, evoke: _evoke, ...metro } = CITY;
    expect(() => readGameworld({ ...WORLD, levels: { district: { geocity: metro } } })).toThrow(/a level is a district of the metro/);
    expect(() => readGameworld({ ...WORLD, levels: { district: { geocity: { ...metro, evoke: 'skyline' } } } })).toThrow(/a level is a district of the metro/);
    expect(() => readGameworld({ ...WORLD, levels: { district: { geocity: CITY, walk: { nodes: { a: { trail: true } } } } } })).toThrow(/the district alone/);
    expect(() => readGameworld({ ...WORLD, levels: { district: { geocity: { ...CITY, towers: 9 } } } })).toThrow(/geocity/);
  });
  it('is one stage: the geocube kind\'s geocity, its district\'s own recipe', () => {
    expect(gameStages(G)).toHaveLength(1);
    expect(stage).toMatchObject({ level: 'district', node: 'district', section: 'geocity', manifest: { kind: 'geocube', show: 'geocity', geocity: CITY } });
  });
  it('sets the hero down on its street: its spawn, its beats and its exit on ground, clear of every box', () => {
    const pts = [E.spawn, ...E.beats.map((b) => b.at), E.exit];
    expect(E.beats.length).toBeGreaterThan(2);
    for (const p of pts) {
      const z = E.ground(p[0], p[1]);
      expect(z).not.toBeNull();
      expect(Math.abs(z - p[2])).toBeLessThan(0.05);
      expect(E.colliders.some((c) => within([p[0], p[1], p[2] + 1], c))).toBe(false);
    }
    expect(Math.hypot(E.exit[0] - E.spawn[0], E.exit[1] - E.spawn[1])).toBeGreaterThan(30);
  });
  it('tells the tills of its shops walked into, each on ground the hero stands on, and an errand\'s trade stands at one', () => {
    expect(E.tills.length).toBeGreaterThan(0);
    const t = E.tills[0], z = E.ground(t.at[0], t.at[1]);
    expect(z).not.toBeNull();
    expect(Math.abs(z - t.at[2])).toBeLessThan(0.1);
    expect(E.colliders.some((c) => within([t.at[0], t.at[1], z + 1], c))).toBe(false);
    const laid = layErrand([{ kind: 'trade', item: 'radio', count: 1, shop: 'electronics' }], [[0, 0, 0]], E.tills);
    expect(laid.find((l) => l.item === 'radio').at).toEqual(t.at);
  });
  it('tells its kerb: where a car may stand on its road beside its start, clear of every box', () => {
    expect(E.kerbs.length).toBeGreaterThan(0);
    for (const k of E.kerbs) expect(E.colliders.some((c) => within([k.at[0], k.at[1], k.at[2] + 0.7], c))).toBe(false);
    expect(Math.hypot(E.kerbs[0].at[0] - E.spawn[0], E.kerbs[0].at[1] - E.spawn[1])).toBeLessThan(20);
  });
  it('says what it weighs', () => {
    expect(E.weight.faces).toBeGreaterThan(0);
    expect(E.weight.shops).toBe(E.tills.length);
    expect(Object.keys(E)).not.toContain('weight');
  });
  it('is in the game the run makes, its book and its graph', () => {
    const S = runSteps(WORLD, { ref: 'gw' }), level = S.find((x) => x.key.startsWith('level-'));
    expect(level.order.manifest).toMatchObject({ kind: 'geocube', show: 'geocity' });
    expect(level.order.manifest.geocity.shops).toBeTruthy();
    // (the level's own keys over the district's: the world kind plays it, and no stand-in walks it)
    const page = WORLD_KINDS.geocube.resolve(level.order.manifest, { title: 't' });
    expect(page.faces.length).toBeGreaterThan(0);
    expect(page.walkers).toBeUndefined();
    expect(JSON.stringify(gameworldGraph(G))).toContain('district');
    expect(gameworldBibleHtml(WORLD)).toContain('The district');
  });
});
