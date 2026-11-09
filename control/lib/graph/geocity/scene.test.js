// THE GEOCITY BUILT: a metro's map stood on the cube's land as massing. The smallest metro that still rings: a small
// shore, one built at noon and one at night.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene, GEOCITY_FACES, FORM_GROUND } from './scene.js';
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

  it('holds every mass it draws in a box, the walk clear of them', () => {
    // (the metro to scale draws every block at block scale: a box for each mass, none more)
    expect(P.colliders.length).toBe(P.geocity.counts.buildings);
    expect(P.geocity.counts.colliders).toBe(P.colliders.length);
    for (const c of P.colliders) for (let k = 0; k < 3; k++) expect(c.max[k]).toBeGreaterThan(c.min[k]);
    // each tower in its own box, from its terrace to its roof
    const office = D.grammar.floorH.office, b = D.regions.flatMap((r) => r.blocks).find((x) => x.towers), t = b.towers[0];
    const T = P.colliders.find((c) => c.of === `${b.id}:tower` && c.min[0] === t.rect[0] && c.min[1] === t.rect[1]);
    expect(T.max.slice(0, 2)).toEqual([t.rect[2], t.rect[3]]);
    expect(T.max[2] - T.min[2]).toBeCloseTo(t.storeys * office, 3);
    expect(law('walk-clear').ok).toBe(true);
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
    // (its view cone, asked: the screen's reach, or metres in range)
    expect(() => assembleGeocityScene({ ...M, cone: 'far' })).toThrow(/cone is the view cone/);
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

  it('holds its evoked lots and the neighbourhoods round them in boxes; the skyline, never walked, none', () => {
    const DN = designGeocity({ ...geocity, evoke: 'neighbourhood' }, { seed: 2 }), massed = DN.regions.filter((r) => DN.evoked.regions.includes(r.id));
    const inside = (c, q) => (c.min[0] + c.max[0]) / 2 >= q[0] && (c.min[0] + c.max[0]) / 2 <= q[2] && (c.min[1] + c.max[1]) / 2 >= q[1] && (c.min[1] + c.max[1]) / 2 <= q[3];
    expect(N.colliders.length).toBeGreaterThan(0);
    // (a crane's jib reaches out over the street, high over it: its mast stands in its block)
    expect(N.colliders.filter((c) => !c.of.endsWith(':crane')).every((c) => massed.some((r) => inside(c, r.rect)))).toBe(true);
    // an evoked tower's lot its own box
    expect(N.colliders.some((c) => /^[^:]+:t0$/.test(c.of) && DN.evoked.blocks.includes(c.of.split(':')[0]))).toBe(true);
    expect(N.geocity.laws.find((l) => l.law === 'walk-clear').ok).toBe(true);
    expect(K.colliders).toBeUndefined();
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
  });  it('on a live page whose world asks for the view cone, grows every street tree twice and marks its kit: an export none', () => {
    const C = assembleGeocityScene({ ...M, cone: true }, { live: true });
    const trees = (side) => C.repeats.filter((r) => String(r.group).startsWith('geocity:tree-') && r.cone === side);
    const count = (rs) => rs.reduce((n, r) => n + r.transforms.length, 0);
    // (each placement once at its near level and once at L0, the page choosing by the live eye)
    expect(count(trees('in'))).toBe(count(trees('out')));
    expect(trees('out').every((r) => r.group.endsWith('-L0'))).toBe(true);
    expect(C.repeats.filter((r) => !String(r.group).startsWith('geocity:tree-')).every((r) => r.cone === 'kit')).toBe(true);
    // (an export reads it not live; a page without the cone keeps the ring and the scene's levels)
    for (const X of [assembleGeocityScene({ ...M, cone: true }), assembleGeocityScene(M, { live: true })]) expect(X.repeats.some((r) => r.cone)).toBe(false);
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

describe('the city changing', () => {
  const lots = D.regions.flatMap((r) => r.blocks);
  it('gives a share of its blocks to a building going up, a parking lot and a vacant lot, each on its own dice', () => {
    const going = lots.filter((b) => b.kind === 'construction');
    for (const b of going) { expect(b.progress).toBeGreaterThan(0); expect(b.progress).toBeLessThan(1); expect(typeof b.becomes).toBe('string'); }
    expect(lots.some((b) => ['construction', 'parking', 'vacant'].includes(b.kind))).toBe(true);
  });
  it('raises a site\'s frame and crane, scaffolds and hoards it near the camera, parks its lots\' cars in their paints', () => {
    const going = lots.some((b) => b.kind === 'construction'), parked = lots.some((b) => b.kind === 'parking');
    if (going) {
      expect(group('geocity:crane').length).toBeGreaterThan(0);
      expect(P.repeats.some((r) => r.group === 'geocity:scaffold')).toBe(true);
      expect(P.repeats.some((r) => r.group === 'geocity:hoarding' || r.group === 'geocity:fence')).toBe(true);
    }
    if (parked) { const cars = P.repeats.find((r) => r.group === 'geocity:car'); expect(cars.transforms.every((t) => Array.isArray(t.tint))).toBe(true); }
    expect(going || parked).toBe(true);
  });
  it('stocks a site drawn in detail from the construction shelf: its tower crane over its core, an excavator and a tipper in its hoarding', () => {
    const cranes = P.repeats.filter((r) => r.group === 'geocity:tower-crane'), site = (k) => P.repeats.find((r) => r.group === `geocity:site-${k}`);
    if (!P.geocity.counts.cranes) return;
    expect(cranes.reduce((n, r) => n + r.transforms.length, 0)).toBe(P.geocity.counts.cranes);
    // (a crane is seen across its district, the machines near the camera as the kit is)
    expect(cranes.every((r) => r.near > 1000 && r.template.length > 1000)).toBe(true);
    for (const k of ['digger', 'truck']) if (site(k)) expect(site(k).near).toBeLessThan(1000);
    expect(site('digger') || site('truck')).toBeTruthy();
  });
});

describe('the geotown composed in, built', () => {
  it('builds a composed neighbourhood and block by the geotown, in their places; as the skyline, boxes', () => {
    const r = D.regions.find((x) => x.builds !== 'outskirts' && !x.park && x.blocks.length > 2), b = D.regions.find((x) => x !== r && !x.park && x.blocks.length > 2).blocks.find((x) => x.kind !== 'park');
    const C = assembleGeocityScene({ ...M, geocity: { ...geocity, geotowns: { [r.id]: true, [b.id]: true } } });
    expect(Object.keys(C.geocity.geotowns).sort()).toEqual([r.id, b.id].sort());
    const town = C.faces.filter((f) => String(f.group).startsWith('geotown:'));
    expect(town.length).toBeGreaterThan(100);
    const inR = (f) => f.corners.every(([x, y]) => x >= r.rect[0] - 0.5 && x <= r.rect[2] + 0.5 && y >= r.rect[1] - 0.5 && y <= r.rect[3] + 0.5);
    const inB = (f) => f.corners.every(([x, y]) => x >= b.rect[0] - 1 && x <= b.rect[2] + 1 && y >= b.rect[1] - 1 && y <= b.rect[3] + 1);
    expect(town.every((f) => inR(f) || inB(f))).toBe(true);
    // its houses' boxes come with it, in the metro's frame, inside the neighbourhood or the block they stand in
    const held = (id, q, e) => C.colliders.filter((c) => c.of.startsWith(`${id}:`) && c.of.endsWith(':house')).every((c) => c.min[0] >= q[0] - e && c.max[0] <= q[2] + e && c.min[1] >= q[1] - e && c.max[1] <= q[3] + e);
    expect(C.colliders.filter((c) => c.of.startsWith(`${r.id}:`) && c.of.endsWith(':house')).length).toBeGreaterThan(0);
    expect(C.colliders.filter((c) => c.of.startsWith(`${b.id}:`) && c.of.endsWith(':house')).length).toBeGreaterThan(0);
    expect(held(r.id, r.rect, 0.5) && held(b.id, b.rect, 0)).toBe(true);
    const K = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'skyline', geotowns: { [r.id]: true } } });
    expect(K.faces.some((f) => String(f.group).startsWith('geotown:'))).toBe(false);
  });

  it('stands its composed towns on the metro\'s ground, its town-seams law held on the page as built', () => {
    const r = D.regions.find((x) => x.builds !== 'outskirts' && !x.park && x.blocks.length > 2);
    const C = assembleGeocityScene({ ...M, geocity: { ...geocity, geotowns: { [r.id]: true } } }), L = C.geocity.laws.find((l) => l.law === 'town-seams');
    expect(L).toBeDefined();
    expect(L.ok, L.value).toBe(true);
  });
});

// READ BY THE SEVENTH GENERATION (ctx.form): the metro's soft ground the form's land, its street trees and its towns' the
// form's plants; a painted read none of it
describe('the geocity read in the form render', () => {
  it('hands its soft ground to the form as land and its trees as plants, its towns\' with them', () => {
    const r = D.regions.find((x) => x.builds !== 'outskirts' && !x.park && x.blocks.length > 2);
    const m = { ...M, geocity: { ...geocity, evoke: 'neighbourhood', geotowns: { [r.id]: true } } };
    const F = assembleGeocityScene(m, { form: true }), P = assembleGeocityScene(m);
    expect(F.faces.some((f) => f.group === 'isekai:ground')).toBe(true);
    expect(F.faces.some((f) => FORM_GROUND.includes(f.group))).toBe(false);
    expect(F.plants.trees.length).toBeGreaterThan(0);
    expect(F.plants.clear.length).toBeGreaterThanOrEqual(F.plants.trees.length);
    // (no street tree drawn as paint where the form grows it)
    expect((F.repeats ?? []).some((rp) => String(rp.group).startsWith('geocity:tree-'))).toBe(false);
    expect(P.plants).toBeUndefined();
    expect(P.faces.some((f) => f.group === 'isekai:ground')).toBe(false);
  });
});


describe('the metro at a person\'s height: its frontage', () => {
  it('dresses the walls near its street-level eyes (storefronts, entries, windows), the skyline none', async () => {
    const { assembleGeocityScene: A } = await import('./scene.js');
    const { designGeocity: Dg } = await import('./design.js');
    const at = Dg({}, { seed: 2 }).regions.find((r) => r.ring === 'outskirts' && !r.park).id;
    const p = A({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: { evoke: 'neighbourhood', at } });
    const fr = p.repeats.filter((r) => r.group.startsWith('geocity:front-'));
    expect(p.geocity.counts.fronts).toBeGreaterThan(20);
    for (const g of ['geocity:front-shop-sign', 'geocity:front-entry-door', 'geocity:front-band-band']) expect(fr.some((r) => r.group === g)).toBe(true);
    expect(fr.some((r) => r.group.startsWith('geocity:front-win-unit'))).toBe(true);
    expect(fr.reduce((a, r) => a + r.transforms.length, 0)).toBe(p.geocity.counts.frontPieces);
    // (every piece near an eye, drawn near the camera)
    expect(fr.every((r) => r.near > 0)).toBe(true);
    const sky = A({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: { evoke: 'skyline' } });
    expect((sky.repeats ?? []).some((r) => r.group.startsWith('geocity:front-'))).toBe(false);
  });
});
