import { describe, it, expect } from 'vitest';
import { assembleGeotownScene, GEOTOWN_FACES } from './scene.js';
import { designGeotown } from './design.js';
import { SURFACES, PATTERNS, DEFAULT_PATTERN } from './pattern.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';

// the smallest town that still levels: one block on a little hill, a narrow margin
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 4, geotown: { evoke: 'metro', grid: [1, 1], hills: { height: 6 }, margin: 12 } };
const P = assembleGeotownScene(M), D = designGeotown(M.geotown, { seed: 4 });
const law = (id) => P.geotown.laws.find((l) => l.law === id);
const surfaceAt = (x, y) => D.surfaces.filter((s) => x >= s.rect[0] && x <= s.rect[2] && y >= s.rect[1] && y <= s.rect[3]).map((s) => s.cls);

describe('the geotown built: its map stood on the cube\'s land, levelled', () => {
  it('grows trees only on the surfaces that grow them, and draws under its budget', () => {
    expect(law('bare').ok).toBe(true);
    expect(law('faces').ok).toBe(true);
    expect(P.faces.length).toBeLessThanOrEqual(GEOTOWN_FACES);
    let n = 0;
    for (const r of P.repeats) for (const t of r.transforms) {
      const [x, y] = t.pos, on = surfaceAt(x, y);
      // (the margin is outside the frame: no surface of the map)
      if (!on.length) { expect(x < 0 || y < 0 || x > D.frame.W || y > D.frame.D).toBe(true); continue; }
      expect(on.some((c) => SURFACES[c].grows.some((g) => g === 'tree' || g === 'street-tree'))).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(10);
  });

  it('stands each house on its plot\'s pad, and each front yard from its walk up to that pad', () => {
    const pads = new Map(D.plots.map((pl) => [pl.id, pl.pad]));
    const houses = P.anchors.filter((a) => a.kind === 'house');
    expect(houses.length).toBe(D.plots.length);
    for (const h of houses) expect(h.floor).toBeCloseTo(pads.get(h.id.replace(/^house-/, '')), 4);
    // a front yard's corners: two on the walk's back edge (the streets' ground and a kerb), two on its pad
    const { S } = D.land, kerb = D.row.kerb, padsZ = new Set([...pads.values()].map((z) => z.toFixed(3)));
    for (const f of P.faces.filter((x) => x.group === 'geotown:front')) {
      const onWalk = f.corners.filter((c) => Math.abs(c[2] - (S(c[0], c[1]) + kerb)) < 1e-3).length, onPad = f.corners.filter((c) => padsZ.has(c[2].toFixed(3))).length;
      expect(onWalk + onPad).toBeGreaterThanOrEqual(4);
    }
  });

  it('is its recipe\'s alone: the same recipe draws the same town', () => {
    const again = assembleGeotownScene(M);
    expect(JSON.stringify(again.faces)).toBe(JSON.stringify(P.faces));
    expect(P.geotown.ledger).toEqual(D.ledger);
  });

  it('is the geocube kind\'s show, walked by its dummy round its first block', async () => {
    const p = await WORLD_KINDS.geocube.resolve(M, { title: 'a town' });
    expect(p.walkers?.length).toBe(1);
    expect(p.geotown.counts.houses).toBe(D.plots.length);
    expect(() => assembleGeotownScene({ ...M, domain: 'x' })).toThrow(/'domain' is not a setting of the geocube kind's geotown/);
  });

  it('evokes a block: each house a type its neighbour is not, each yard its own, the fronts and the materials drawn', () => {
    const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 2, geotown: { hills: { height: 6 }, margin: 10 } };
    const p = assembleGeotownScene(E), d = designGeotown(E.geotown, { seed: 2 }), types = PATTERNS[DEFAULT_PATTERN].types;
    expect(p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
    const houses = new Map(p.anchors.filter((a) => a.kind === 'house').map((a) => [a.id.replace(/^house-/, ''), a.type]));
    expect(houses.size).toBe(d.plots.length);
    for (const s of ['w', 'e']) {
      const row = d.plots.filter((pl) => pl.side === s).sort((a, b) => a.k - b.k);
      for (let k = 1; k < row.length; k++) {
        expect(types[houses.get(row[k].id)]).toBeDefined();
        // a semi pair is one building of one type; any two buildings side by side are of two
        if (row[k].pair && row[k].pair === row[k - 1].pair) expect(houses.get(row[k].id)).toBe(houses.get(row[k - 1].id));
        else expect(houses.get(row[k].id)).not.toBe(houses.get(row[k - 1].id));
      }
    }
    // the fronts (bays, porches), the yards' things and the fences are drawn; the houses wear their words' tiles
    const groups = new Set(p.faces.map((f) => f.group));
    for (const g of ['geotown:bay', 'geotown:glass', 'geotown:porch', 'geotown:trim', 'geotown:timber']) expect(groups.has(g)).toBe(true);
    expect(p.faces.some((f) => f.group?.startsWith('town:') && f.texture)).toBe(true);
    // each back yard its own program, never its row neighbour's
    for (const s of ['w', 'e']) {
      const row = d.plots.filter((pl) => pl.side === s).sort((a, b) => a.k - b.k).map((pl) => p.geotown.yards[pl.id]);
      expect(row.every(Boolean)).toBe(true);
      for (let k = 1; k < row.length; k++) expect(row[k]).not.toBe(row[k - 1]);
    }
  });
});
