import { describe, it, expect } from 'vitest';
import { assembleGeotownScene, GEOTOWN_FACES, fitFront, shopfrontOf, TREE_CLEAR, TREE_RAISE, FORM_GROUND } from './scene.js';
import { mulberry32 } from '../city/plan/dice.js';
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
    expect(P.faces.length).toBeLessThanOrEqual(GEOTOWN_FACES);   // (the town to scale's one budget)
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
    expect(p.geotown.counts.buildings).toBe(D.plots.length);
    expect(() => assembleGeotownScene({ ...M, domain: 'x' })).toThrow(/'domain' is not a setting of the geocube kind's geotown/);
  });

  it('evokes a block: each house a type its neighbour is not, each yard its own, the fronts and the materials drawn', () => {
    const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 2, geotown: { hills: { height: 6 }, margin: 10 } };
    const p = assembleGeotownScene(E), d = designGeotown(E.geotown, { seed: 2 }), types = PATTERNS[DEFAULT_PATTERN].types;
    expect(p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
    const houses = new Map(p.anchors.filter((a) => a.kind === 'house').map((a) => [a.id.replace(/^house-/, ''), a.type]));
    expect(houses.size).toBe(d.plots.length);
    expect(p.geotown.counts.houses).toBe(d.plots.length);
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

  it('builds a main street: shopfronts under their signs and awnings, its walk and paving finished, trees only in the town', () => {
    const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { segment: 'main-street', hills: { height: 6 } } };
    const p = assembleGeotownScene(E), d = designGeotown(E.geotown, { seed: 3 });
    expect(p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
    expect(p.geotown.counts.shops).toBe(d.plots.filter((pl) => pl.kind === 'shops').length);
    const groups = new Set(p.faces.map((f) => f.group));
    for (const g of ['geotown:sign', 'geotown:canvas', 'geotown:furnish', 'geotown:pit', 'geotown:service']) expect(groups.has(g)).toBe(true);
    // the ground wears its finishes' tiles: the walk, the road, the main street's paving
    for (const g of ['geotown:walk', 'geotown:road', 'geotown:furnish']) expect(p.faces.some((f) => f.group === g && f.texture)).toBe(true);
    // no tree stands outside the town's frame: its border is bare
    for (const r of p.repeats) for (const t of r.transforms) expect(t.pos[0] >= 0 && t.pos[1] >= 0 && t.pos[0] <= d.frame.W && t.pos[1] <= d.frame.D).toBe(true);
    expect(p.geotown.ports.length).toBe(4);
    // each tree held to its room: its crown raised twice a person's height up, short of every building
    expect(p.geotown.laws.find((l) => l.law === 'room').ok).toBe(true);
    const boxes = p.colliders.filter((c) => c.of.endsWith(':house'));
    for (const r of p.repeats) for (const t of r.transforms) {
      expect(t.scale * TREE_RAISE).toBeGreaterThanOrEqual(TREE_CLEAR - 1e-6);
      for (const b of boxes) expect(t.pos[0] > b.min[0] && t.pos[0] < b.max[0] && t.pos[1] > b.min[1] && t.pos[1] < b.max[1]).toBe(false);
    }
  });

  it('builds a midtown mansion as its own revival, set back on its lawn, its drive and garage, its pool', () => {
    const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 } } };
    const p = assembleGeotownScene(E);
    expect(p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
    const M = p.anchors.filter((a) => a.mansion);
    expect(M.length).toBe(2);
    for (const a of M) expect(a.type).toMatch(/^mansion-/);
    expect(new Set(M.map((a) => a.type)).size).toBe(2);
    const groups = new Set(p.faces.map((f) => f.group));
    for (const g of ['geotown:drive', 'geotown:garage']) expect(groups.has(g)).toBe(true);
    expect(p.cameras.some((c) => c.name === 'mansion')).toBe(true);
  });

  it('designs each back yard of its own: near the door, its middle, by its back fence, and a balcony over some', () => {
    const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 } } };
    const p = assembleGeotownScene(E), F = p.geotown.features;
    for (const x of ['trampoline', 'shed', 'patio', 'balcony', 'pool']) expect(F[x]).toBeGreaterThan(0);
    const groups = new Set(p.faces.map((f) => f.group));
    for (const g of ['geotown:mat', 'geotown:pad', 'geotown:rail', 'geotown:paving', 'geotown:shed']) expect(groups.has(g)).toBe(true);
    // a balcony's reach is its house's: no tree's crown takes it
    expect(p.geotown.laws.find((l) => l.law === 'room').ok).toBe(true);
    expect(p.cameras.some((c) => c.name === 'yard')).toBe(true);
  });

  it('reads its streetscape on the street: a tree here and there or none, each twice a person\'s height; gates; parked cars', () => {
    const at = (sc, extra = {}) => { const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 }, streetscape: sc, ...extra } }; return { p: assembleGeotownScene(E), d: designGeotown(E.geotown, { seed: 3 }) }; };
    const [L, S, U] = ['leafy', 'snug', 'urban'].map((sc) => at(sc));
    // the street's trees: those standing off the blocks, a metre of the streets' frontage
    const street = ({ p, d }) => p.repeats.flatMap((r) => r.transforms).filter((t) => !d.blocks.some((b) => t.pos[0] > b.rect[0] && t.pos[0] < b.rect[2] && t.pos[1] > b.rect[1] && t.pos[1] < b.rect[3]));
    const perM = (x) => street(x).length / x.d.blocks.reduce((a, b) => a + 2 * (b.rect[2] - b.rect[0] + b.rect[3] - b.rect[1]), 0);
    expect(perM(S)).toBeLessThan(perM(L) * 0.6);
    expect(street(U).length).toBe(0);
    for (const x of [L, S, U]) {
      expect(x.p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
      for (const t of x.p.repeats.flatMap((r) => r.transforms)) expect(t.scale * TREE_RAISE).toBeGreaterThanOrEqual(TREE_CLEAR - 1e-6);
      expect(x.p.geotown.counts.parked).toBeGreaterThan(0);
    }
    // every urban front behind its railing; none where the streetscape asks none
    const groups = (p) => new Set(p.faces.map((f) => f.group));
    expect(U.p.geotown.counts.gated).toBe(U.d.plots.filter((pl) => pl.kind === 'houses').length);
    expect(groups(U.p).has('geotown:iron')).toBe(true);
    const none = assembleGeotownScene({ kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 }, streetscape: { from: 'urban', gates: 'none' } } });
    expect(none.geotown.counts.gated).toBe(0);
    expect([...groups(none)].some((g) => ['geotown:iron', 'geotown:pier', 'geotown:brick'].includes(g))).toBe(false);
    expect(U.p.geotown.streetscape).toBe('urban');
  });

  it('fits a front to its setback: a porch where the yard holds it, else a stoop; a bay raised over the door', () => {
    const f = { bay: 'square', bayStoreys: 1, porch: 'full' };
    expect(fitFront(f, 6)).toEqual(f);
    expect(fitFront(f, 2.5).porch).toBe('door');
    expect(fitFront(f, 1.2)).toEqual({ bay: 'square', bayStoreys: 'upper' });
  });

  it('builds a school and a sports field on their level ground: a track, a pitch, goals and lines, a diamond; trees on their lawns only', () => {
    for (const segment of ['school', 'sports']) {
      const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 }, segment } }, p = assembleGeotownScene(E), d = designGeotown(E.geotown, { seed: 3 });
      expect(p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
      const groups = new Set(p.faces.map((f) => f.group));
      for (const g of ['geotown:line', 'geotown:goal', 'geotown:stripe', ...(segment === 'school' ? ['geotown:track'] : ['geotown:dirt', 'geotown:court', 'geotown:net', 'geotown:lamp'])]) expect(groups.has(g)).toBe(true);
      expect(p.cameras.some((c) => c.name === 'field')).toBe(true);
      if (segment === 'school') { expect(p.anchors.some((a) => a.row === 'school')).toBe(true); expect(p.cameras.some((c) => c.name === 'school')).toBe(true); }
      // no tree on a field, a court, a track or a diamond's dirt; each twice a person's height
      const hard = d.surfaces.filter((s) => ['field', 'court', 'track', 'infield', 'service'].includes(s.cls) && s.area === undefined);
      for (const t of p.repeats.flatMap((r) => r.transforms)) {
        expect(t.scale * TREE_RAISE).toBeGreaterThanOrEqual(TREE_CLEAR - 1e-6);
        expect(hard.some((s) => t.pos[0] > s.rect[0] && t.pos[0] < s.rect[2] && t.pos[1] > s.rect[1] && t.pos[1] < s.rect[3])).toBe(false);
      }
    }
  });

  it('builds an edge: its avenue\'s buildings each its type, its lane and the garages opening onto it, an avenue view', () => {
    const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 }, segment: 'edge' } }, p = assembleGeotownScene(E), d = designGeotown(E.geotown, { seed: 3 });
    expect(p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
    const av = p.anchors.filter((a) => a.row === 'avenue');
    expect(av.length).toBe(d.plots.filter((pl) => pl.kind === 'avenue').length);
    expect(new Set(av.map((a) => a.type)).size).toBeGreaterThan(2);
    const groups = new Set(p.faces.map((f) => f.group));
    for (const g of ['geotown:lane', 'geotown:garage', 'geotown:sign', 'geotown:canvas']) expect(groups.has(g)).toBe(true);
    expect(p.cameras.some((c) => c.name === 'avenue')).toBe(true);
  });

  it('furnishes its streets: lights, signals with their three lamps, stop signs, low-rises of four storeys with balconies', () => {
    const at = (geotown) => assembleGeotownScene({ kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 }, ...geotown } });
    const M = at({ segment: 'main-street' }), Lr = at({ segment: 'lowrise' }), groups = (p) => new Set(p.faces.map((f) => f.group));
    for (const p of [M, Lr]) expect(p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
    for (const g of ['geotown:pole', 'geotown:lamp', 'geotown:signal', 'geotown:red', 'geotown:amber', 'geotown:green', 'geotown:line', 'geotown:lane']) expect(groups(M).has(g)).toBe(true);
    expect(M.geotown.counts.signals).toBeGreaterThan(0);
    expect(groups(at({ streetscape: { from: 'leafy', stops: 1 } })).has('geotown:stop')).toBe(true);
    expect(M.cameras.some((c) => c.name === 'crossing')).toBe(true);
    // no street tree crowds a light
    const L = designGeotown({ segment: 'main-street' }, { seed: 3 }).traffic.lights;
    for (const t of M.repeats.flatMap((r) => r.transforms)) expect(L.every((Lt) => Math.hypot(Lt.at[0] - t.pos[0], Lt.at[1] - t.pos[1]) >= 2.5 - 1e-6)).toBe(true);
    // a low-rise: four storeys, a balcony's door (glass) on each upper storey of its bays
    for (const a of Lr.anchors.filter((q) => q.row === 'lowrise')) expect(a.box.max[2] - a.box.min[2]).toBeGreaterThan(4 * 2.7);
    expect(Lr.faces.filter((f) => f.group === 'geotown:glass').length).toBeGreaterThan(Lr.anchors.length * 3);
  });

  it('splits its duplexes: two doors at the porch, a porch over it, a steel stair at the back; each shop its own front', () => {
    const at = (geotown) => assembleGeotownScene({ kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 }, ...geotown } });
    const H = at({}), groups = (p, g) => p.faces.filter((f) => f.group === g).length;
    expect(H.geotown.laws.filter((l) => !l.ok)).toEqual([]);
    expect(H.geotown.counts.duplexes).toBeGreaterThan(0);
    // (each split half: its second door, its upper flat's door onto its porch, its stair's door)
    expect(groups(H, 'geotown:door')).toBeGreaterThanOrEqual(3 * H.geotown.counts.duplexes);
    expect(groups(H, 'geotown:steel')).toBeGreaterThan(0);
    expect(Object.values(H.geotown.yards).filter((y) => y.includes('stair')).length).toBe(H.geotown.counts.duplexes);
    // a main street's shops: never a neighbour's sign and awning both, more than one sign and awning along the row
    const M = at({ segment: 'main-street' }), d = designGeotown({ segment: 'main-street', hills: { height: 6 } }, { seed: 3 }), S = M.geotown.shopfronts;
    const row = d.plots.filter((pl) => pl.kind === 'shops').sort((p, q) => p.k - q.k).map((pl) => S[pl.id]);
    for (let k = 1; k < row.length; k++) expect(row[k].sign === row[k - 1].sign && row[k].awning === row[k - 1].awning).toBe(false);
    expect(new Set(row.map((f) => f.sign)).size).toBeGreaterThan(1);
    expect(new Set(row.map((f) => f.awning)).size).toBeGreaterThan(1);
    const F = shopfrontOf(PATTERNS[DEFAULT_PATTERN].shopfronts, mulberry32(9), null);
    expect(shopfrontOf(PATTERNS[DEFAULT_PATTERN].shopfronts, mulberry32(9), { sign: F.sign, awning: F.awning }).awning).not.toBe(F.awning);
  });

  it('hands its flora to the seventh generation: its lawns the form\'s ground, its trees the form\'s, each held to its room', () => {
    const E = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { hills: { height: 6 } } }, p = assembleGeotownScene(E, { form: true });
    expect(p.geotown.laws.filter((l) => !l.ok)).toEqual([]);
    const groups = new Set(p.faces.map((f) => f.group));
    expect(groups.has('isekai:ground')).toBe(true);
    for (const g of FORM_GROUND) expect(groups.has(g)).toBe(false);
    // its trees grown by the form (no repeats), each its pattern's species, its ground and its yard's things claimed
    expect(p.repeats.length).toBe(0);
    expect(p.plants.trees.length).toBeGreaterThan(0);
    expect(new Set(p.plants.trees.map((t) => t.species)).size).toBeGreaterThan(1);
    for (const t of p.plants.trees) expect(PATTERNS[DEFAULT_PATTERN].grow.trees.concat(PATTERNS[DEFAULT_PATTERN].grow.street, PATTERNS[DEFAULT_PATTERN].grow.parkTrees, [PATTERNS[DEFAULT_PATTERN].grow.shade])).toContain(t.species);
    expect(p.plants.clear.length).toBeGreaterThan(p.plants.trees.length);
    // its houseplants the plant library's: its hedges, beds and planters bushes of the pattern's kinds, no painted leaves
    expect(p.plants.bushes.length).toBeGreaterThan(0);
    expect(p.plants.bushKinds.map((k) => k.form)).toEqual(Object.values(PATTERNS[DEFAULT_PATTERN].houseplants.kinds).map((k) => k.form));
    for (const b of p.plants.bushes) expect(b.kind).toBeGreaterThanOrEqual(0);
    expect(p.faces.some((f) => f.group === 'geotown:leaf' || f.group === 'geotown:hedge')).toBe(false);
    // (each one's ground claimed from the grass)
    for (const b of p.plants.bushes.slice(0, 20)) expect(p.plants.clear.some(([x, y]) => x === b.x && y === b.y)).toBe(true);
    // read by any other generation: its own painted lawns and its trees as repeats, as before
    const g6 = assembleGeotownScene(E);
    expect(g6.plants).toBeUndefined();
    expect(new Set(g6.faces.map((f) => f.group)).has('geotown:front')).toBe(true);
  });
});
