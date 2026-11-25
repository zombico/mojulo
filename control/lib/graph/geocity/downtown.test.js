// A DOWNTOWN'S DETAIL (geocity/scene.js): its streets' MOUTHS open (where a neighbourhood's own street meets an arterial
// the arterial's walk is opened and the road carried across, nothing stood in it), its roofs dressed (a tower's
// penthouse, a flat roof's bulkhead and air handlers: rooftop.js lotRoofPlan), its shops' blade signs (frontage.js). One
// small evoked city at its core; the concepts on it.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene, mouthsOf } from './scene.js';
import { designGeocity } from './design.js';
import { lotRoofPlan } from './rooftop.js';
import { frontsOf, frontageTemplates } from './frontage.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 160, frame: 330 } }, extent: [900, 800], water: { sides: ['s'], depth: 100 }, core: [0.5, 0.45], evoke: 'neighbourhood', at: 'core' };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity };

describe('a downtown\'s detail', () => {
  it('opens each street\'s mouth: no walk across it, the road carried to the arterial\'s, nothing stood in it', () => {
    const P = assembleGeocityScene(M), d = designGeocity(geocity, { seed: 2 }), mouths = mouthsOf(d);
    expect(mouths.size).toBeGreaterThan(0);
    const mid = (f) => [f.corners.reduce((a, c) => a + c[0], 0) / f.corners.length, f.corners.reduce((a, c) => a + c[1], 0) / f.corners.length];
    const boxes = [];
    for (const [id, ms] of mouths) {
      const l = d.lines.find((x) => x.id === id), R2 = l.road / 2;
      for (const m of ms) { const [o0, o1] = m.side > 0 ? [R2 + 0.1, l.half - 0.1] : [-l.half + 0.1, -R2 - 0.1], a = m.lo + 0.2, b = m.hi - 0.2; boxes.push(l.axis === 'ns' ? [l.at + o0, a, l.at + o1, b] : [a, l.at + o0, b, l.at + o1]); }
    }
    const inside = ([x, y]) => boxes.some((q) => x > q[0] && x < q[2] && y > q[1] && y < q[3]);
    expect(P.faces.filter((f) => f.group === 'geocity:walk' && inside(mid(f)))).toEqual([]);
    expect(P.faces.some((f) => f.group === 'geocity:road' && inside(mid(f)))).toBe(true);
    const stood = (P.repeats ?? []).filter((r) => /^geocity:(bench|lamp|bin|hydrant|papers|ring|pit|signal|sign|meter)/.test(r.group)).flatMap((r) => r.transforms.filter((t) => inside(t.pos)));
    expect(stood).toEqual([]);
  }, 120_000);

  it('dresses a tower\'s roof with its penthouse and a flat roof with its bulkhead and air handlers, by its own dice', () => {
    const lots = [{ id: 't', x0: 0, y0: 0, x1: 40, y1: 40, z0: 0, h: 120, tower: true, shape: 'box' }, { id: 'f', x0: 100, y0: 0, x1: 160, y1: 40, z0: 0, h: 30, shape: 'box' }, { id: 's', x0: 200, y0: 0, x1: 230, y1: 30, z0: 0, h: 60, tower: true, shape: 'setback' }];
    const plan = lotRoofPlan(lots, 2), at = (id) => plan.filter((p) => (id === 't' ? p.at[0] < 50 : id === 'f' ? p.at[0] >= 100 && p.at[0] < 170 : p.at[0] >= 200));
    const pt = at('t').find((p) => p.key === 'penthouse');
    expect(pt.at[2]).toBe(120);
    expect(at('t').filter((p) => p.key === 'cooling')).toHaveLength(2);
    // (a narrowing tower's penthouse smaller, and no cooling towers on its narrow top)
    expect(at('s').find((p) => p.key === 'penthouse').scale[0] / 30).toBeLessThan(pt.scale[0] / 40);
    expect(at('s').some((p) => p.key === 'cooling')).toBe(false);
    expect(at('f').filter((p) => p.key === 'hvac').length).toBeGreaterThan(2);
    expect(JSON.stringify(lotRoofPlan(lots, 2))).toBe(JSON.stringify(plan));
  });

  it('hangs blade signs over some of a downtown\'s shops, and none where it is not asked', () => {
    const wall = { facing: 's', a: [0, 0], L: 120, z0: 0 }, spec = { storeys: 4, floorH: 3.2, use: 'mixed', ground: 'shops', palette: { frame: ['#333333'], shop: ['#444444'], sign: ['#aa3322'], awning: ['#225533'], door: ['#222222'], rail: ['#111111'] } };
    const R = () => 0.5, with_ = frontsOf(wall, { ...spec, blades: true }, R), without = frontsOf(wall, spec, R);
    expect(with_.some((p) => p.key.startsWith('blade-board'))).toBe(true);
    expect(without.some((p) => p.key.startsWith('blade-'))).toBe(false);
    // (the rest of the wall as it was)
    expect(with_.filter((p) => !p.key.startsWith('blade-'))).toEqual(without);
  });

  it('lives in a wall where asked: blinds, curtains and air conditioners in its windows, a shop shut on some, what its shops put out; its own dice', () => {
    const wall = { facing: 's', a: [0, 0], L: 160, z0: 0 }, spec = { storeys: 6, floorH: 3.2, use: 'mixed', ground: 'shops', frames: ['#333333'], palette: { frame: ['#333333'], shop: ['#444444'], sign: ['#aa3322'], awning: ['#225533'], door: ['#222222'], rail: ['#111111'] } };
    const R = () => 0.5, lived = frontsOf(wall, { ...spec, lived: true }, R), plain = frontsOf(wall, spec, R);
    const kinds = new Set(lived.map((p) => p.key.split(/[-:]/)[0]));
    for (const k of ['blind', 'curtain', 'life']) expect(kinds.has(k), k).toBe(true);
    // (none where it is not asked, and the rest of the wall as it was: nothing else moved)
    expect(plain.some((p) => /^(blind|curtain|ac|shutter|interior|life)[-:]/.test(p.key))).toBe(false);
    expect(lived.filter((p) => !/^(blind|curtain|ac|shutter|interior|life)[-:]/.test(p.key))).toEqual(plain);
    // (what a shop puts out stands out from its wall, on the walk's side of it)
    expect(lived.filter((p) => p.key.startsWith('life:')).every((p) => p.pos[1] < 0)).toBe(true);
    expect(JSON.stringify(frontsOf(wall, { ...spec, lived: true }, R))).toBe(JSON.stringify(lived));
  });

  it('lights some shops\' interiors by their own lamps: a lit room\'s glow never shaded by the day', () => {
    const wall = { facing: 's', a: [0, 0], L: 200, z0: 0 }, spec = { storeys: 2, floorH: 3.2, use: 'mixed', ground: 'shops', lived: true, palette: { frame: ['#333333'], shop: ['#444444'], sign: ['#aa3322'], awning: ['#225533'], door: ['#222222'], rail: ['#111111'] } };
    expect(frontsOf(wall, spec, () => 0.5).some((p) => p.key.startsWith('interior-lit'))).toBe(true);
    const dim = { ambient: 0.1, diffuse: 0.1, toLight: [0, 0, 1] }, bright = { ambient: 0.9, diffuse: 0.6, toLight: [0, -1, 0] };
    expect(frontageTemplates(dim)['interior-lit:s'].map((f) => f.fill)).toEqual(frontageTemplates(bright)['interior-lit:s'].map((f) => f.fill));
  });
});

describe('a city\'s walls and its works', () => {
  it('varies its buildings\' walls each by its own place, and lays work zones: a crew\'s vehicle in a kerb lane, cones round it', () => {
    const P = assembleGeocityScene(M);
    expect(P.geocity.counts.works ?? 0).toBeGreaterThan(0);
    expect((P.repeats ?? []).some((r) => r.group === 'geocity:cone')).toBe(true);
    // (the massing's walls: not one paint a group any more)
    const walls = P.faces.filter((f) => /^geocity:(tower|podium|midrise|slab|lowrise)$/.test(f.group) && Math.abs(f.normal[2]) < 0.3).map((f) => f.fill);
    expect(new Set(walls).size).toBeGreaterThan(3);
  }, 120_000);
});

describe('a city\'s alleys', () => {
  it('cuts some of its inner city\'s blocks down the middle, street to street: two halves of the block it was, an alley between, its own dice', () => {
    const on = designGeocity(geocity, { seed: 2 }), off = designGeocity({ ...geocity, alleys: false }, { seed: 2 });
    const alleys = on.regions.flatMap((r) => r.alleys ?? []);
    expect(alleys.length).toBeGreaterThan(0);
    expect(off.regions.some((r) => (r.alleys ?? []).length)).toBe(false);
    for (const r of on.regions) for (const b of (r.blocks ?? []).filter((x) => x.id.endsWith('.b'))) {
      const a = r.blocks.find((x) => x.id === b.id.slice(0, -2));
      // (each half its alley side, the block it was its whole; the two and the alley the whole's area)
      expect(Object.values(a.sides).filter((v) => v.kind === 'alley')).toHaveLength(1);
      expect(Object.values(b.sides).filter((v) => v.kind === 'alley')).toHaveLength(1);
      expect(a.kind).toBe(b.kind);
      const W = a.whole, al = r.alleys.find((x) => x.id.startsWith(a.id));
      expect(a.area + b.area + al.w * (al.hi - al.lo)).toBeCloseTo((W[2] - W[0]) * (W[3] - W[1]), 0);
    }
    // (the blocks it leaves whole the blocks they were)
    const kinds = (d) => new Map(d.regions.flatMap((r) => (r.blocks ?? []).map((b) => [b.id, b.kind])));
    const K0 = kinds(off);
    for (const [id, k] of kinds(on)) if (!id.endsWith('.b') && K0.has(id)) expect(k, id).toBe(K0.get(id));
    expect(on.laws.filter((l) => !l.ok).map((l) => l.law)).toEqual(off.laws.filter((l) => !l.ok).map((l) => l.law));
  }, 60_000);
});
