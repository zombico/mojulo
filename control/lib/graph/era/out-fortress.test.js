import { describe, it, expect } from 'vitest';
import { structureStyle, STRUCTURE_KITS } from './out-structures.js';
import { FORT_SETS, FORT_SET_IDS, RAMPART, composeFort, seedFort, fortDial, octagon, build } from './out-fortress.js';
import { designTown, fortFaces, distTo } from './out-town.js';
import { SURFACE_GROUP_IDS } from './out-structures-paint.js';

// the fortified town: a town drawn tighter by one dial, the lord's land in its inmost ward; the fortification designed elements first, the bay its citizen,
// the tower derived from the bay (era/out-fortress.js, laid on the town by era/out-town.js)
const meadow = structureStyle('isekai-meadow', 8);
const tris = (o) => o.filter((f) => !f.tile).reduce((a, f) => a + f.corners.length - 2, 0);

describe('out-fortress', () => {
  it('every authored and seeded fortification holds its rails; the tower is derived from the bay', () => {
    for (const F of [...FORT_SET_IDS.map(composeFort), ...Array.from({ length: 60 }, (_, i) => composeFort({ seed: i + 1 }))]) {
      expect(F.walk.w).toBeLessThanOrEqual(F.curtain.t - 0.4 + 1e-9);
      expect(F.towerDims.w).toBeGreaterThanOrEqual(5);
      expect(F.towerDims.proud).toBeGreaterThan(F.towerDims.w / 2);
      if (F.tower.plan === 'round') expect(['crenel', 'cone']).toContain(F.tower.crown);
    }
    expect(JSON.stringify(seedFort(4))).toBe(JSON.stringify(seedFort(4)));
    expect(() => composeFort({ ...FORT_SETS.crenellated, walk: { w: 2.3 } })).toThrow(/does not fit/);
    expect(() => composeFort({ ...FORT_SETS.crenellated, tower: { plan: 'round', crown: 'tiers' } })).toThrow(/drum is crowned/);
    expect(() => composeFort({ ...FORT_SETS.battered, parapet: { ...FORT_SETS.battered.parapet, form: 'portcullis' } })).toThrow(/crenel \| loophole \| solid/);
  });

  it('the bay, the tower and the gatehouse by depth: each degree adds; values on surface groups', () => {
    for (const id of FORT_SET_IDS) {
      const F = composeFort(id), b = [0, 1, 2, 3].map((depth) => { const o = []; build.bay(o, 12, F, 7, { depth }); return o; }), t = [0, 1, 2].map((depth) => { const o = []; build.tower(o, F, 12, { depth }); return o; });
      for (let d = 1; d < 4; d++) expect(b[d].length, `${id} bay ${d}`).toBeGreaterThanOrEqual(b[d - 1].length);
      for (let d = 1; d < 3; d++) expect(tris(t[d]), `${id} tower ${d}`).toBeGreaterThanOrEqual(tris(t[d - 1]));
      const g = []; build.gatehouse(g, F, 7, 4.4, { depth: 2 });
      for (const f of [...b[3], ...t[2], ...g]) expect(SURFACE_GROUP_IDS, `${id} ${f.part}`).toContain(f.group);
      // a gate leaves its opening clear to the passage's height
      const o = []; build.bay(o, 12, F, 7, { depth: 2, gates: [{ u: 6, w: 4 }] });
      expect(o.filter((f) => !f.tile && f.corners.every((c) => c[0] > 4.1 && c[0] < 7.9))).toEqual([]);
    }
  });

  it('the dial closes in order, the rampart rising and the towers closing in', () => {
    let prev = null;
    for (const f of [0, 0.2, 0.4, 0.6, 0.75, 0.85, 1]) {
      const D = fortDial(f);
      expect(D.H).toBeGreaterThanOrEqual(RAMPART[0]);
      expect(D.H).toBeLessThanOrEqual(RAMPART[1]);
      if (prev) { expect(D.steps.length).toBeGreaterThanOrEqual(prev.steps.length); expect(D.spacing).toBeLessThanOrEqual(prev.spacing); }
      prev = D;
    }
    expect(octagon(0, 0, 10, 10, 2)).toHaveLength(8);
  });

  it('fortified 0 is the open town; a fortified town holds every law, in every kit, with either composition', () => {
    expect(JSON.stringify(designTown(meadow, 8, { fortified: 0 }).lots.map((l) => l.design.sig))).toBe(JSON.stringify(designTown(meadow, 8, {}).lots.map((l) => l.design.sig)));
    expect(designTown(meadow, 8, {}).fort).toBeNull();
    for (const k of STRUCTURE_KITS) for (const fort of [...FORT_SET_IDS, { seed: 3 }]) for (const f of [0.3, 0.65, 1]) {
      const t = designTown(structureStyle(k, 8), 8, { fortified: f, fort });
      expect(t.laws.filter((l) => !l.ok), `${k} ${JSON.stringify(fort)} ${f}`).toEqual([]);
    }
  }, 120000);

  it('the lord\'s land: one gate, the approach bent into it, wards climbed by offset gates, the keep over every tower', () => {
    const t = designTown(meadow, 8, { fortified: 1, fort: 'battered' }), F = t.fort;
    expect(F.gates.filter((g) => !g.ward)).toHaveLength(1);
    expect(F.gates.find((g) => g.main).route).not.toBe('branch');
    const wards = F.curtains.filter((c) => c.ward);
    expect(wards).toHaveLength(2);
    for (const c of wards) expect(c.gates).toHaveLength(1);
    const [g1, g2] = F.gates.filter((g) => g.ward).sort((a, b) => a.ward - b.ward);
    expect(Math.abs(g1.at[0] - g2.at[0])).toBeGreaterThan((g1.w + g2.w) / 2);
    const keep = t.lots[F.keep];
    expect(keep.crown).toBeGreaterThan(Math.max(...F.towers.map((x) => x.top)));
    // the approach runs under the west wall outside the ditch
    const ap = t.routes.find((r) => r.id === 'approach');
    expect(ap.pts.slice(0, 4).every(([x]) => x < F.xW - F.t / 2 - F.ditch.w)).toBe(true);
    // the faces: every curtain, tower and gate built; the ditch on the floor
    const { groups, floor } = fortFaces(t);
    expect(groups.length).toBeGreaterThan(F.curtains.length + F.towers.length);
    expect(floor.length).toBeGreaterThan(8);
    // nothing on the way through a gate: the curtain is open where the route crosses
    for (const g of F.gates) for (const r of t.routes.filter((x) => x.id === g.route)) expect(distTo(r.pts, ...g.at)).toBeLessThan(1);
  }, 120000);
});
