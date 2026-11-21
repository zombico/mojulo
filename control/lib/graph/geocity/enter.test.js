// THE GEOCITY'S SHOPS WALKED INTO: the smallest metro that still rings (scene.test.js's), its rows of shops entered.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene } from './scene.js';
import { readGeocity } from './metro.js';
import { shopBays, frontsOf, frontageTemplates, shopRise, FRONTAGE } from './frontage.js';
import { SLOT } from '../retail/store-slot.js';
import { mulberry32 } from '../city/plan/dice.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity: { ...geocity, shops: { cards: ['electronics'] } } };
const P = assembleGeocityScene(M), E = P.geocity.stores, shops = (P.anchors ?? []).filter((a) => a.kind === 'shop');
const within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];

describe('a metro\'s shops walked into', () => {
  it('reads its setting', () => {
    expect(readGeocity(geocity).shops).toBeUndefined();
    expect(readGeocity({ ...geocity, shops: true }).shops.near).toBe(SLOT.near);
    expect(() => readGeocity({ ...geocity, shops: { cards: [] } })).toThrow(/shops.cards/);
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
    const T = frontageTemplates(null, { flat: true });
    // (the lowest edge of anything across the door's middle, in the template; stretched to a 3 m storey)
    const head = (piece, D) => Math.min(...Object.entries(T).filter(([k]) => k.startsWith(`${piece}-`) && k.endsWith(':s')).flatMap(([, fs]) => fs)
      .filter((f) => Math.min(...f.corners.map((c) => c[0])) < D.u && Math.max(...f.corners.map((c) => c[0])) > D.u && Math.max(...f.corners.map((c) => c[2])) > 1).map((f) => Math.min(...f.corners.map((c) => c[2]))));
    expect(head('shopopen', { ...FRONTAGE.shop.door, ...FRONTAGE.shop.open }) * shopRise(3)).toBeGreaterThanOrEqual(2.05);
    expect(head('shop', FRONTAGE.shop.door)).toBeLessThan(0.1);   // (its leaf's glass, from its foot)
  });
  it('is stepped up to from its walk: treads a riser each from the walk to its pad, none where the pad meets the walk', () => {
    const stoops = P.colliders.filter((c) => c.of.endsWith(':stoop'));
    const raised = shops.filter((a) => a.store.rise > 0.19 && !a.store.sink), level = shops.filter((a) => a.store.rise <= 0.18);
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
    expect(Math.max(...shops.map((a) => a.store.rise))).toBeLessThanOrEqual(0.541);
  });
  it('a row on a pad high over its walk stands on a forecourt: the walk raised to its floor along its front, railed where it drops', () => {
    // (the ground a door opens on, a stride out from it, is its floor's; three strides out, the walk well below it)
    const top = (x, y) => Math.max(-Infinity, ...P.faces.filter((f) => /^geocity:(stoop|walk|road|pad|paving|floor)$/.test(f.group) && (f.normal?.[2] ?? 0) > 0.5 && Math.min(...f.corners.map((c) => c[0])) <= x && Math.max(...f.corners.map((c) => c[0])) >= x && Math.min(...f.corners.map((c) => c[1])) <= y && Math.max(...f.corners.map((c) => c[1])) >= y).map((f) => Math.max(...f.corners.map((c) => c[2]))));
    const raised = shops.filter((a) => Math.abs(top(a.at[0] + a.N[0] * 1, a.at[1] + a.N[1] * 1) - a.store.door[2]) < 0.05 && top(a.at[0] + a.N[0] * 3.6, a.at[1] + a.N[1] * 3.6) < a.store.door[2] - 0.5);
    expect(E.forecourts).toBeGreaterThan(0);
    expect(raised.length).toBeGreaterThan(0);
    for (const a of raised) { expect(a.store.rise).toBeLessThan(0.02); expect(a.store.sink ?? 0).toBe(0); }
    expect(P.faces.some((f) => f.group === 'geocity:handrail')).toBe(true);
    expect(P.colliders.some((c) => String(c.of).endsWith(':forecourt'))).toBe(true);
  });
  it('a shop on a pad too high for a forecourt is sunk under it: its floor under the pad, the pad and its face cut round it', () => {
    const low = shops.filter((a) => a.store.sink > 0);
    expect(E.sunk ?? 0).toBe(low.length);
    for (const a of low.slice(0, 1)) {
      const { inside, door, sink } = a.store, mid = [(inside.min[0] + inside.max[0]) / 2, (inside.min[1] + inside.max[1]) / 2];
      // (no ground of the metro's over its floor and under its ceiling at its middle; its pad still stands beside it)
      const over = (x, y) => P.faces.filter((f) => (f.normal?.[2] ?? 0) > 0.5 && Math.min(...f.corners.map((c) => c[0])) < x && Math.max(...f.corners.map((c) => c[0])) > x && Math.min(...f.corners.map((c) => c[1])) < y && Math.max(...f.corners.map((c) => c[1])) > y).map((f) => Math.max(...f.corners.map((c) => c[2])));
      // (its own floor is the metro's ground there, a hair over its floor's level)
      expect(over(mid[0], mid[1]).filter((z) => z > inside.min[2] + 0.05 && z < inside.max[2] - 0.05)).toHaveLength(0);
      expect(over(mid[0], mid[1]).some((z) => Math.abs(z - inside.min[2]) < 0.03)).toBe(true);
      const k = Math.abs(a.N[0]) > 0.5 ? 1 : 0, beside = [...mid]; beside[k] = inside.min[k] - 0.2;
      expect(over(beside[0], beside[1]).some((z) => Math.abs(z - (door[2] + sink)) < 0.01)).toBe(true);
      // (the face holding its pad over its walk is open at its door)
      const j = 1 - k, plane = door[j] + a.N[j] * 0.15;
      const across = P.faces.filter((f) => f.group === 'geocity:retain' && f.corners.every((c) => Math.abs(c[j] - plane) < 0.02) && Math.min(...f.corners.map((c) => c[k])) < door[k] && Math.max(...f.corners.map((c) => c[k])) > door[k]);
      expect(across).toHaveLength(0);
      // (and no pad lies across its doorway between its wall and its inside: its threshold its own, at its floor)
      const sill = [door[0] + a.N[0] * 0.08, door[1] + a.N[1] * 0.08];
      expect(over(sill[0], sill[1]).filter((z) => z > door[2] + 0.05 && z < door[2] + 2)).toHaveLength(0);
      expect(over(sill[0], sill[1]).some((z) => Math.abs(z - door[2]) < 0.03)).toBe(true);
    }
  });
});
