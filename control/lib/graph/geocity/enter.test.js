// THE GEOCITY'S SHOPS WALKED INTO: the smallest metro that still rings (scene.test.js's), its rows of shops entered.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene } from './scene.js';
import { readGeocity } from './metro.js';
import { shopBays, frontsOf, frontageTemplates, shopRise, FRONTAGE } from './frontage.js';
import { SLOT } from '../retail/store-slot.js';
import { mulberry32 } from '../city/plan/dice.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity: { ...geocity, enter: { cards: ['electronics'] } } };
const P = assembleGeocityScene(M), E = P.geocity.enter, shops = (P.anchors ?? []).filter((a) => a.kind === 'shop');
const within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];

describe('a metro\'s shops walked into', () => {
  it('reads its setting', () => {
    expect(readGeocity(geocity).enter).toBeUndefined();
    expect(readGeocity({ ...geocity, enter: true }).enter.near).toBe(SLOT.near);
    expect(() => readGeocity({ ...geocity, enter: { cards: [] } })).toThrow(/enter.cards/);
  });
  it('its rows of shops are entered, by its law, on fewer templates than shops', () => {
    expect(shops.length).toBeGreaterThan(0);
    expect(E.shops).toBe(shops.length);
    expect(P.geocity.laws.find((l) => l.law === 'entered').ok).toBe(true);
    // (a metro's bays repeat: its shops share their insides)
    expect(E.templates).toBeLessThan(E.shops);
  });
  it('a body walks from the walk through each door to its till: no box in its way, its row\'s box still round it', () => {
    // (one shop a wall's facing: the concept is the door, not the count)
    const one = [...new Map(shops.map((a) => [a.N.join(','), a])).values()];
    expect(one.length).toBeGreaterThan(1);
    for (const a of one) {
      const { door, till, inside } = a.store, z = door[2] + 1;
      for (const t of [-1.5, -0.5, 0, 0.5, 1.2]) expect(P.colliders.some((c) => within([door[0] - a.N[0] * t, door[1] - a.N[1] * t, z], c))).toBe(false);
      expect(within([till[0], till[1], z], inside)).toBe(true);
      const k = Math.abs(a.N[0]) > 0.5 ? 1 : 0, beside = [door[0], door[1], z]; beside[k] = inside.min[k] - 0.1; beside[1 - k] = (inside.min[1 - k] + inside.max[1 - k]) / 2;
      expect(P.colliders.some((c) => within(beside, c))).toBe(true);
    }
  });
  it('each inside is a repeat drawn near the camera only, stamped at its doors', () => {
    const reps = P.repeats.filter((r) => r.group.startsWith('geocity:store-'));
    expect(reps).toHaveLength(E.templates);
    expect(reps.every((r) => r.near === SLOT.near)).toBe(true);
    expect(reps.reduce((a, r) => a + r.transforms.length, 0)).toBe(shops.length);
    expect(P.geocity.laws.find((l) => l.law === 'faces').ok).toBe(true);
  });
});

describe('a wall\'s shops', () => {
  it('are laid as its front lays them, an open shop\'s bays wider and without a leaf in the door', () => {
    const spec = { storeys: 2, floorH: 3, use: 'residential', ground: 'shops', palette: { frame: ['#444444'], shop: ['#555555'], sign: ['#666666'], awning: ['#777777'], door: ['#888888'], rail: ['#999999'] } };
    const wall = { facing: 's', a: [0, 0], L: 30, z0: 0 };
    const shut = frontsOf(wall, spec, mulberry32(1)), open = frontsOf(wall, { ...spec, open: true }, mulberry32(1));
    const us = (ps, piece) => [...new Set(ps.filter((p) => p.key.startsWith(`${piece}-`)).map((p) => p.pos[0]))];
    expect(us(shut, 'shop')).toHaveLength(shopBays(30).bays.length);
    expect(us(open, 'shopopen')).toHaveLength(shopBays(30, 'shops', FRONTAGE.shop.enter).bays.length);
    expect(us(open, 'shop')).toHaveLength(0);
    expect(shopBays(30, 'shops', FRONTAGE.shop.enter).bays.every((b) => b.w >= FRONTAGE.shop.enter)).toBe(true);
    // (a wall that opens only some: the rest shut, as wide)
    const some = frontsOf(wall, { ...spec, open: [1] }, mulberry32(1));
    expect(us(some, 'shopopen')).toHaveLength(1);
    expect(us(some, 'shop')).toHaveLength(us(open, 'shopopen').length - 1);
  });
});

describe('a row\'s front, where it is dressed', () => {
  it('lays an open shop at each door that falls within a person\'s eye of a camera, and no shut one there', () => {
    const open = P.repeats.filter((r) => r.group.startsWith('geocity:front-shopopen')), doors = shops.map((a) => a.store.door);
    const nearDoor = (t) => doors.some((d) => Math.hypot(t.pos[0] - d[0], t.pos[1] - d[1]) < 4 && Math.abs(t.pos[2] - d[2]) < 0.5);
    // (every open front stands at a door; no shut shop's front stands on an entered row)
    for (const r of open) for (const t of r.transforms) expect(nearDoor(t)).toBe(true);
    const shut = P.repeats.filter((r) => /^geocity:front-shop-/.test(r.group)).flatMap((r) => r.transforms).filter(nearDoor);
    expect(shut).toHaveLength(0);
  });
});

describe('a shop\'s door, walked through', () => {
  it('an open shop\'s door clears a body at a three-metre storey, where a shut shop\'s is a picture', () => {
    const T = frontageTemplates(null, { flat: true }), D = FRONTAGE.shop.door;
    // (the lowest edge of anything across the door's middle, in the template; stretched to a 3 m storey)
    const head = (piece) => Math.min(...Object.entries(T).filter(([k]) => k.startsWith(`${piece}-`) && k.endsWith(':s')).flatMap(([, fs]) => fs)
      .filter((f) => Math.min(...f.corners.map((c) => c[0])) < D.u && Math.max(...f.corners.map((c) => c[0])) > D.u && Math.max(...f.corners.map((c) => c[2])) > 1).map((f) => Math.min(...f.corners.map((c) => c[2]))));
    expect(head('shopopen') * shopRise(3)).toBeGreaterThanOrEqual(2.05);
    expect(head('shop')).toBeLessThan(0.1);   // (its leaf's glass, from its foot)
  });
  it('is stepped up to from its walk: treads a riser each from the walk to its pad, none where the pad meets the walk', () => {
    const stoops = P.colliders.filter((c) => c.of.endsWith(':stoop'));
    const raised = shops.filter((a) => a.store.rise > 0.19), level = shops.filter((a) => a.store.rise <= 0.18);
    expect(raised.length + level.length).toBeGreaterThan(0);
    const at = (a) => stoops.filter((c) => Math.abs((c.min[0] + c.max[0]) / 2 - a.at[0]) < 2.2 && Math.abs((c.min[1] + c.max[1]) / 2 - a.at[1]) < 2.2 && c.max[2] < a.floor + 1e-6 && c.max[2] > a.floor - 1).map((c) => c.max[2]).sort((x, y) => y - x);
    // (one shop a kind: the concept is the stoop)
    for (const a of raised.slice(0, 1)) {
      const tops = [a.floor, ...at(a)];
      expect(tops.length).toBeGreaterThan(1);
      for (let i = 1; i < tops.length; i++) expect(tops[i - 1] - tops[i]).toBeLessThanOrEqual(0.181);
      expect(tops[tops.length - 1] - (a.floor - a.store.rise)).toBeLessThanOrEqual(0.181);
    }
    for (const a of level.slice(0, 1)) expect(at(a)).toHaveLength(0);
    expect(Math.max(...shops.map((a) => a.store.rise))).toBeLessThanOrEqual(0.9);
  });
});
