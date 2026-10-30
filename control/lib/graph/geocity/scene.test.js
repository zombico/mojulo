// THE GEOCITY BUILT: a metro's map stood on the cube's land as massing. The smallest metro that still rings: a small
// shore, one built at noon and one at night.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene, GEOCITY_FACES } from './scene.js';
import { designGeocity } from './design.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity };
const P = assembleGeocityScene(M), D = designGeocity(geocity, { seed: 2 });
const law = (id) => P.geocity.laws.find((l) => l.law === id);
const group = (g) => P.faces.filter((f) => f.group === g);

describe('the geocity built: its map stood on the cube\'s land as massing', () => {
  it('draws the metro under its budget, its blocks\' buildings by segment, its towers in its core', () => {
    expect(law('faces').ok).toBe(true);
    expect(P.faces.length).toBeLessThanOrEqual(GEOCITY_FACES);
    const towers = D.regions.flatMap((r) => r.blocks).flatMap((b) => b.towers ?? []);
    expect(P.geocity.counts.towers).toBe(towers.length);
    expect(group('geocity:tower').length).toBe(4 * towers.length);
    expect(group('geocity:house').length).toBeGreaterThan(0);
    expect(group('geocity:water').length).toBe(1);
  });

  it('stands every block\'s terraces over the walk round them, and each tower its storeys over its terrace', () => {
    const S = D.land.S;
    for (const f of [...group('geocity:pad'), ...group('geocity:paving')]) for (const [x, y, z] of f.corners) expect(z).toBeGreaterThanOrEqual(S(x, y) + 0.15 - 1e-3);
    const office = D.grammar.floorH.office, b = D.regions.flatMap((r) => r.blocks).find((x) => x.towers), t = b.towers[0];
    const roof = group('geocity:tower:roof').find((f) => f.corners.every(([x, y]) => x >= t.rect[0] - 1e-3 && x <= t.rect[2] + 1e-3 && y >= t.rect[1] - 1e-3 && y <= t.rect[3] + 1e-3));
    const pad = [...group('geocity:pad'), ...group('geocity:paving')].map((f) => f.corners[0][2]).filter((z) => Math.abs(roof.corners[0][2] - t.storeys * office - z) < 1e-3);
    expect(pad.length).toBeGreaterThan(0);
  });

  it('lights its windows past dusk, and draws none by day', () => {
    expect(group('geocity:night-window')).toHaveLength(0);
    const N = assembleGeocityScene({ ...M, hour: 'night' });
    expect(N.geocity.counts.panes).toBeGreaterThan(0);
    expect(N.faces.filter((f) => f.group === 'geocity:night-window')).toHaveLength(N.geocity.counts.panes);
    // (the rest of the night's metro is the day's, face for face but its light)
    expect(N.faces.length - N.geocity.counts.panes).toBe(P.faces.length);
  });

  it('is the same metro for the same recipe', () => {
    const Q = assembleGeocityScene(M);
    expect(Q.faces.length).toBe(P.faces.length);
    expect(JSON.stringify(Q.faces.slice(-50))).toBe(JSON.stringify(P.faces.slice(-50)));
  });

  it('sees itself from its water, over it, its core and up its spine, and is walked from its seat', () => {
    expect(P.cameras.map((c) => c.name)).toEqual(['skyline', 'over', 'core', 'street']);
    const [x, y, z] = P.walk.spawn;
    expect(z).toBeCloseTo(D.land.S(x, y) + 0.15 + 1.7, 3);
    expect(P.route[0]).toEqual(P.route[P.route.length - 1]);
    expect(P.geocity.graph.edges).toBe(D.graph.edges.length);
  });

  it('is the geocube kind\'s `show: \'geocity\'`, walked by its dummy, and refuses what is off its settings', async () => {
    const p = await WORLD_KINDS.geocube.resolve(M, { title: 'a metro' });
    expect(p.walkers?.length).toBe(1);
    expect(p.geocube.show).toBe('geocity');
    expect(() => assembleGeocityScene({ ...M, domain: 'x' })).toThrow(/'domain' is not a setting of the geocube kind's geocity/);
  });
});

describe('an evocation built', () => {
  const N = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood' } });
  const K = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'skyline' } });

  it('wears facades on its evoked blocks only, from over it and its own street', () => {
    expect(N.geocity.evoked.detail).toBeGreaterThan(0);
    expect(N.geocity.counts.detailed).toBeGreaterThan(0);
    expect(N.faces.filter((f) => f.group === 'geocity:facade').length).toBeGreaterThan(100);
    expect(P.faces.some((f) => f.group === 'geocity:facade')).toBe(false);
    expect(N.cameras.map((c) => c.name)).toEqual(['evoked', 'street', 'crossing', 'skyline', 'over']);
    expect(N.walk.spawn).toEqual(N.cameras[1].worldFraming.cameraPosition);
    expect(N.geocity.play).toBe('game');
  });

  it('draws the skyline as its tall buildings on coarse ground: no pad, no house', () => {
    expect(K.faces.filter((f) => f.group === 'geocity:pad' || f.group === 'geocity:house')).toHaveLength(0);
    expect(K.faces.some((f) => f.group === 'geocity:tower')).toBe(true);
    expect(K.cameras.map((c) => c.name)).toEqual(['skyline', 'over']);
    expect(K.faces.length).toBeLessThan(P.faces.length);
  });
});

describe('the street, near', () => {
  const N = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'corridor' } });
  it('stamps the metro\'s kit and the paint as repeats drawn only near the camera; the skyline none', () => {
    const groups = new Set(P.repeats.map((r) => r.group));
    for (const g of ['geocity:lamp', 'geocity:signal', 'geocity:sign', 'geocity:bar', 'geocity:dash']) expect(groups.has(g)).toBe(true);
    expect(P.repeats.every((r) => r.near > 0)).toBe(true);
    expect(N.repeats.some((r) => r.group === 'geocity:rail' || r.group === 'geocity:pole')).toBe(true);
    const K = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'skyline' } });
    expect(K.repeats).toBeUndefined();
  });
  it('the page draws a near repeat only near the camera, and a world without one gains not a byte', async () => {
    const { emitThreeWorld } = await import('../scene/scene-three.js');
    const tpl = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], normal: [0, 0, 1], fill: '#888888' }];
    const base = { faces: tpl, inline: true }, plain = emitThreeWorld({ ...base, repeats: [{ group: 'g', template: tpl, transforms: [{ pos: [0, 0, 0] }] }] });
    const near = emitThreeWorld({ ...base, repeats: [{ group: 'g', template: tpl, transforms: [{ pos: [0, 0, 0] }], near: 50 }] });
    expect(plain).not.toContain('__nearTiles');
    expect(near).toContain('__nearTiles');
  });
});

describe('the ground, near', () => {
  it('lays its ground and its masses in their material words, as tiles', () => {
    const road = group('geocity:road').find((f) => f.texture), walk = group('geocity:walk').find((f) => f.texture), house = group('geocity:house').find((f) => f.texture);
    for (const f of [road, walk, house]) { expect(f).toBeTruthy(); expect(f.uv).toHaveLength(f.corners.length); }
    expect(road.texture).not.toBe(walk.texture);
  });
  it('gives a glass tower\'s walls the sun\'s sheen', () => {
    expect(group('geocity:tower').some((f) => Array.isArray(f.spec))).toBe(true);
  });
  it('grows its street trees near the camera only, and takes the live sun when a page asks', () => {
    expect(P.geocity.counts.trees).toBeGreaterThan(0);
    const trees = P.repeats.filter((r) => String(r.group).startsWith('geocity:tree-'));
    expect(trees.length).toBeGreaterThan(0);
    expect(trees.every((r) => r.near > 0)).toBe(true);
    expect(P.faces.some((f) => f.sunShare !== undefined)).toBe(false);
    const L = assembleGeocityScene(M, { liveSun: true });
    const up = L.faces.find((f) => f.group === 'geocity:road'), wall = L.faces.find((f) => f.group === 'geocity:house' && Math.abs(f.normal[2]) < 0.1);
    expect(up.sunShare).toBeGreaterThan(0);
    expect(wall.sunShare).toBeGreaterThanOrEqual(0);
  });
});
