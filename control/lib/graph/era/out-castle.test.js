import { describe, it, expect } from 'vitest';
import { structureStyle } from './out-structures.js';
import { CASTLE_CARD, CASTLE_LAWS, readCastlePlan, castleMoat, designCastle, castleFaces, castleSurface } from './out-castle.js';
import { composeFort, build } from './out-fortress.js';
import { designTown } from './out-town.js';
import { dressTown } from './out-town-dress.js';
import { SURFACE_GROUP_IDS } from './out-structures-paint.js';

// the castle: the lord's land drawn tight, composed inward from its wall by a budget (era/out-castle.js); the town
// outside it (era/out-town.js `castle`)
const meadow = structureStyle('isekai-meadow', 8);
const tris = (o) => o.filter((f) => !f.tile).reduce((a, f) => a + f.corners.length - 2, 0);

describe('out-castle', () => {
  it('reads its recipe against the card, and refuses what it is not', () => {
    expect(readCastlePlan(true)).toMatchObject({ fort: 'crenellated', size: CASTLE_CARD.size[2], wards: CASTLE_CARD.wards[2] });
    expect(readCastlePlan('battered').fort).toBe('battered');
    expect(() => readCastlePlan({ moat: 'wet' })).toThrow(/not a castle setting/);
    expect(() => readCastlePlan({ size: 30 })).toThrow(/size is a number 40–56/);
    expect(() => readCastlePlan({ wards: 1.5 })).toThrow(/whole number/);
    expect(() => readCastlePlan({ rise: 9 })).toThrow(/rise/);
    expect(() => designTown(meadow, 8, { fortified: 0.5, castle: true })).toThrow(/not both/);
  });

  it('the keep by depth, each crown: each degree adds; values on surface groups', () => {
    for (const F of [composeFort('crenellated'), composeFort('battered'), composeFort({ seed: 2 }), composeFort({ seed: 3 })]) {
      const k = [0, 1, 2].map((depth) => { const o = []; build.keep(o, F, 16, 20, { depth, base: 3 }); return o; });
      for (let d = 1; d < 3; d++) expect(tris(k[d]), `${F.read} keep ${d}`).toBeGreaterThanOrEqual(tris(k[d - 1]));
      for (const f of k[2]) { expect(SURFACE_GROUP_IDS).toContain(f.group); expect(f.value).toBeGreaterThanOrEqual(0); expect(f.value).toBeLessThanOrEqual(1); }
    }
  });

  it('holds every law of its budget and its fortification, in either composition, one ward or two, across sizes and languages', () => {
    const broken = [];
    for (const fort of ['crenellated', 'battered', { seed: 5 }]) for (const anchor of ['timber-hall', 'tiered', 'shell', { seed: 4 }]) for (const wards of [1, 2]) for (const size of [44, 56]) for (const s of [1, 8]) {
      const c = designCastle(structureStyle('isekai-meadow', s), s, { fort, anchor, wards, size });
      for (const l of c.laws) if (!l.ok) broken.push(`${JSON.stringify(fort)} ${JSON.stringify(anchor)} ${wards} ${size} s${s}: ${l.law} ${l.value}`);
    }
    expect(broken).toEqual([]);
  }, 120000);

  it('spends its surface on what it keeps, where the fortified town spent it on its walls', () => {
    const c = designCastle(meadow, 8, { fort: 'crenellated', anchor: 'timber-hall' }), S = castleSurface(c);
    expect(c.budget.inner.built).toBeGreaterThanOrEqual(0.4);
    expect(c.budget.inner.span).toBeLessThanOrEqual(26);
    expect((c.keep.K * c.keep.K) / c.budget.inner.area).toBeGreaterThanOrEqual(0.1);
    expect(S.inside).toBeGreaterThanOrEqual(0.3 * (S.inside + S.walls));
    // the fortified town's lord's ward: a keep on a lot in a ward the breadth of the town
    const t = designTown(meadow, 8, { fortified: 1, fort: 'crenellated', anchor: 'timber-hall' }), top = t.terraces[t.terraces.length - 1], ward = (t.fort.xE - t.fort.xW) * (t.fort.yN - top.y);
    const built = t.lots.filter((l) => !l.farm && l.z >= top.z1 - 1e-6).reduce((s, l) => s + l.design.dims.W0 * l.design.dims.D0, 0);
    expect(built / ward).toBeLessThan(0.15);
    expect(c.budget.inner.built).toBeGreaterThan(3 * (built / ward));
  });

  it('is the same castle every time, laid where it is asked; its ranges backed onto its walls', () => {
    const a = designCastle(meadow, 3, { fort: 'battered' }), b = designCastle(meadow, 3, { fort: 'battered' }), moved = designCastle(meadow, 3, { fort: 'battered' }, { at: [100, 50, 4] });
    expect(JSON.stringify(castleFaces(a))).toBe(JSON.stringify(castleFaces(b)));
    expect(moved.keep.at[0] - a.keep.at[0]).toBeCloseTo(100, 6);
    expect(moved.keep.top - a.keep.top).toBeCloseTo(4, 6);
    expect(a.gates.find((g) => g.main).at).toEqual([0, 0]);
    const M = castleMoat({ fort: 'battered' });
    expect(a.ditch.d1).toBe(M.d1);
    // every range stands in its ward, inside the curtain's faces
    for (const l of a.lots) { const [[x0, y0], [x1], , [, y1]] = a.courts[l.castle]; for (const p of l.foot) { expect(p[0]).toBeGreaterThanOrEqual(x0 - 1e-6); expect(p[0]).toBeLessThanOrEqual(x1 + 1e-6); expect(p[1]).toBeGreaterThanOrEqual(y0 - 1e-6); expect(p[1]).toBeLessThanOrEqual(y1 + 1e-6); } }
    expect(CASTLE_LAWS.map((l) => l.id)).toEqual(a.laws.map((l) => l.law));
  });

  it('a town outside its castle: the castle on the highest ground, the branch brought to its bridge, every law held', () => {
    for (const rec of [{ castle: true }, { castle: { fort: 'battered', wards: 1 }, anchor: 'tiered' }, { castle: { fort: { seed: 5 }, size: 52 }, levels: 2, back: false, branches: 0 }]) for (const kit of ['isekai-meadow', 'isekai-garden']) {
      const st = structureStyle(kit, 8), t = designTown(st, 8, rec), bad = [...t.laws, ...dressTown(t, st).laws].filter((l) => !l.ok);
      expect(bad.map((l) => `${JSON.stringify(rec)} ${kit}: ${l.law} ${l.value}`)).toEqual([]);
      expect(t.castle.z).toBe(Math.max(...t.terraces.map((x) => x.z1)));
      expect(t.lots.filter((l) => l.dare)).toEqual([]);
      expect(t.lots.filter((l) => l.castle).length).toBe(t.castle.lots.length);
      expect(t.laws.map((l) => l.law)).toContain('outside');
    }
  }, 120000);
});
