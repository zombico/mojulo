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
import { composeLive } from '../worlds/controllable/compose.js';

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
  it('tells the cars it parks: where each stands, its model and its paint', () => {
    expect(E.parked.length).toBeGreaterThan(0);
    for (const c of E.parked.slice(0, 5)) { expect(typeof c.model).toBe('string'); expect(c.paint).toMatch(/^#[0-9a-f]{6}$/i); expect(E.ground(c.at[0], c.at[1])).not.toBeNull(); }
    expect(Object.keys(E)).not.toContain('parked');
  });
  it('its pads hold a body at their foot: a terrace over its walk is a wall from below, stood on from its level side', () => {
    const pads = E.colliders.filter((c) => c.of.endsWith(':pad'));
    expect(pads.length).toBeGreaterThan(0);
    // (one that stands a step and more over the ground at one of its corners: a body at that corner's foot is in its box,
    // a body on its top is over it)
    const tall = pads.find((c) => { const g = E.ground(c.min[0] - 0.6, c.min[1] - 0.6); return g !== null && c.max[2] - g > 0.6; });
    expect(tall).toBeTruthy();
    const g = E.ground(tall.min[0] - 0.6, tall.min[1] - 0.6);
    expect(g + 0.3).toBeGreaterThan(tall.min[2]); expect(g + 0.3).toBeLessThan(tall.max[2]);
    // (and no sunk shop's inside or till stands in a pad's box)
    for (const t of E.tills) expect(pads.some((c) => within([t.at[0], t.at[1], t.at[2] + 0.2], c))).toBe(false);
  });
  it('says what it weighs', () => {
    expect(E.weight.faces).toBeGreaterThan(0);
    expect(E.weight.shops).toBe(E.tills.length);
    expect(Object.keys(E)).not.toContain('weight');
  });
  it('is in the game the run makes, its book and its graph', async () => {
    const S = runSteps(WORLD, { ref: 'gw' }), level = S.find((x) => x.key.startsWith('level-'));
    expect(level.order.manifest).toMatchObject({ kind: 'geocube', show: 'geocity' });
    expect(level.order.manifest.geocity.shops).toBeTruthy();
    // (the level's own keys over the district's: the world kind plays it; no stand-in walks it for the camera, and its
    // people walk its blocks: clothed figures on closed rings at a person's pace, each on its walk's ground)
    const page = await WORLD_KINDS.geocube.resolve(level.order.manifest, { title: 't' });
    expect(page.faces.length).toBeGreaterThan(0);
    expect(page.walkers.length).toBeGreaterThan(0);
    expect(page.walkers.some((w) => w.follow)).toBe(false);
    for (const w of page.walkers.slice(0, 3)) {
      expect(page.figures[w.figure]).toBeTruthy();
      expect(w.path[0]).toEqual(w.path[w.path.length - 1]);
      expect(w.speed).toBeGreaterThan(1); expect(w.speed).toBeLessThan(1.7);
      const q = w.path[2], g = E.ground(q[0], q[1]);
      expect(g).not.toBeNull(); expect(Math.abs(q[2] - g)).toBeLessThan(0.5);
    }
    expect(page.walkerLoops).toBeUndefined(); expect(page.cityCues).toBeUndefined();
    expect(JSON.stringify(gameworldGraph(G))).toContain('district');
    expect(gameworldBibleHtml(WORLD)).toContain('The district');
  });
});

describe('a car driven in the district (the level\'s own bodies on the runtime, its ground and its boxes)', () => {
  // the district's game with a hero of its own and the cars the district parks (cars.js)
  const DRIVEN = { ...WORLD, screen: 'screen', style: { kit: 'trail-valley' },
    characters: { direction: { tradition: 'western' }, hero: { looks: { body: { cast: 'male' }, underlayer: { type: 'outfit', style: 'streetwear' } }, motion: { vibe: ['bold'] }, actions: { idiom: 'city-stalker-like' } } } };
  const level = runSteps(DRIVEN, { ref: 'gw' }).find((x) => x.key.startsWith('level-')).order.manifest;
  const R = composeLive(), DT = 1 / 30, ground = (p) => E.ground(p[0], p[1]);
  const st = R.createWorld({ entities: level.entities, colliders: E.colliders, camera: level.camera });
  const run = (s, input = {}, each = null) => { for (let i = 0; i < Math.max(1, Math.round(s / DT)); i++) { R.stepWorld(st, input, DT, { ground }); if (each) each(); } };
  it('its people are the hero door\'s: a few rolled by the world\'s keys, at the crowd grade, each walker one of them at a height of its own', async () => {
    const people = Object.keys(level.figures).filter((k) => /^person-\d+$/.test(k));
    expect(people.length).toBeGreaterThanOrEqual(4);
    for (const k of people) { expect(level.figures[k]).toMatchObject({ grade: 'play', crowd: true }); expect(level.figures[k].hero).toBeTruthy(); }
    // (not one person six times: their rolls differ)
    expect(new Set(people.map((k) => JSON.stringify(level.figures[k].hero))).size).toBeGreaterThan(1);
    const page = await WORLD_KINDS.geocube.resolve(level, { title: 't' });
    expect(page.walkers.length).toBeGreaterThan(people.length);
    for (const w of page.walkers) { expect(people).toContain(w.figure); expect(w.scale).toBeGreaterThan(0.9); expect(w.scale).toBeLessThan(1.1); }
    expect(new Set(page.walkers.map((w) => w.figure)).size).toBe(people.length);
    expect(new Set(page.walkers.map((w) => w.scale)).size).toBeGreaterThan(3);
    // (and the same world rolls the same people)
    expect(JSON.stringify(runSteps(DRIVEN, { ref: 'gw' }).find((x) => x.key.startsWith('level-')).order.manifest.figures)).toBe(JSON.stringify(level.figures));
  });
  it('the hero gets into a car the district parked and drives off: on the ground\'s grade all the way, up no pad, into no box', () => {
    // (the front car of the row at the kerb: the one behind it would stop against it, as a car does)
    const row = st.entities.filter((e) => e.mount?.cab && !e.mount.spare && Math.hypot(e.transform.pos[0] - E.spawn[0], e.transform.pos[1] - E.spawn[1]) < 30), h0 = row[0].transform.heading, car = row.reduce((m, e) => ((e.transform.pos[0] - m.transform.pos[0]) * Math.cos(h0) + (e.transform.pos[1] - m.transform.pos[1]) * Math.sin(h0) > 0 ? e : m), row[0]);
    const hero = st.byId.hero, K = { at: car.transform.pos.slice(), heading: car.transform.heading }, f = [Math.cos(K.heading), Math.sin(K.heading)], left = [-f[1], f[0]];
    expect(car).toBeTruthy();
    // (the district's lots lie blocks from its start: the car by it is its own fleet's, on the road that is the ground)
    expect(Math.hypot(K.at[0] - E.spawn[0], K.at[1] - E.spawn[1])).toBeLessThan(25);
    expect(Math.abs(E.ground(K.at[0], K.at[1]) - K.at[2])).toBeLessThan(0.1);
    hero.transform.pos = [K.at[0] + left[0] * 2.4, K.at[1] + left[1] * 2.4, E.ground(K.at[0] + left[0] * 2.4, K.at[1] + left[1] * 2.4) ?? K.at[2]];
    run(DT, { interact: 1 }); run(5);
    expect(st.pilotId).toBe(car.id);
    // (driven on, then steered hard at whatever stands beside the street: its grade never a wall's)
    let steepest = 0, went = 0, last = car.transform.pos.slice();
    const watch = () => { const p = car.transform.pos, dxy = Math.hypot(p[0] - last[0], p[1] - last[1]); if (dxy > 0.05) { went += dxy; steepest = Math.max(steepest, Math.abs(p[2] - last[2]) / dxy); last = p.slice(); } };
    run(5, { forward: 1 }, watch); run(4, { forward: 1, turn: 1 }, watch); run(4, { forward: 1, turn: -1 }, watch);
    expect(went).toBeGreaterThan(20);
    expect(steepest).toBeLessThan(0.45);
    expect(E.colliders.some((c) => within([car.transform.pos[0], car.transform.pos[1], car.transform.pos[2] + 0.7], c))).toBe(false);
  });
});
