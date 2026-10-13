import { describe, it, expect } from 'vitest';
import { STRUCTURE_KITS, STRUCTURE_USES, structureStyle } from './out-structures.js';
import { TOWN_CARD, HEARTBEAT_IDS, readTownPlan, designTown, placedFaces, distTo, heartbeatBand, boundaryFaces, streetTile } from './out-town.js';
import { ELEMENT_SETS, BOUNDARY_HEIGHTS } from './out-anchor-elements.js';
import { TOWN_DRESS, TOWN_DRESS_IDS, readTownDress, dressTown } from './out-town-dress.js';
import { townMapSvg } from './out-town-html.js';
import { structurePaint, streetPaints } from './out-structures-paint.js';

// the town map: routes first, places where they fork, terraces climbed by stairs, lots cut from every frontage, and
// the dress grown by interceptors (era/out-town.js, era/out-town-dress.js, drawn by era/out-town-html.js)
const meadow = structureStyle('isekai-meadow', 8);
// one kit per anchor (the language a kit's town is built in): the kits under one anchor differ only in rolled numbers
const KITS = STRUCTURE_KITS.filter((k, i) => STRUCTURE_KITS.findIndex((j) => structureStyle(j, 1).anchor === structureStyle(k, 1).anchor) === i);
const corners = (l) => [l.A, [l.A[0] + l.ex[0] * l.w, l.A[1] + l.ex[1] * l.w], [l.A[0] + l.ex[0] * l.w + l.ey[0] * l.d, l.A[1] + l.ex[1] * l.w + l.ey[1] * l.d], [l.A[0] + l.ey[0] * l.d, l.A[1] + l.ey[1] * l.d]];

describe('out-town', () => {
  it('holds its laws in every anchor\'s kit, at every shape the card allows', () => {
    // each shape once, the kits and seeds taken in turn under it
    const recs = [{}, { branches: 0, levels: 0, back: false }, { branches: 1, levels: 1, sway: 1, heartbeat: 'burgh' }, { heartbeat: 'hamlet' }];
    for (const [i, rec] of recs.entries()) {
      const k = KITS[i % KITS.length], seed = [1, 8, 13][i % 3];
      const t = designTown(structureStyle(k, seed), seed, rec);
      expect(t.laws.filter((l) => !l.ok), `${k} ${seed} ${JSON.stringify(rec)}`).toEqual([]);
      expect(dressTown(t, structureStyle(k, seed), undefined, seed).laws.filter((l) => !l.ok)).toEqual([]);
    }
  });

  it('routes come first: every lot stands clear of every route and fronts one', () => {
    const t = designTown(meadow, 8);
    expect(t.routes.map((r) => r.id)).toEqual(['lane', 'branch', 'upper', 'back', 'pocket-way']);
    for (const l of t.lots) {
      for (const r of t.routes) for (const [x, y] of corners(l)) expect(distTo(r.pts, x, y), `${l.route} ${l.use}`).toBeGreaterThan(r.w / 2 + r.foot - 1e-6);
      expect(l.d).toBeGreaterThanOrEqual(STRUCTURE_USES[l.use].lot.d - 1e-9);
    }
    // the hall faces the square, the landmark stands on the highest ground
    expect(t.lots.filter((l) => l.focus)).toHaveLength(1);
    expect(t.lots.find((l) => l.dare).z).toBe(Math.max(...t.lots.map((l) => l.z)));
  });

  it('levels are terraces held by walls, and the walk climbs every one by a flight that holds the steps laws', () => {
    const t = designTown(meadow, 8, { levels: 2 });
    expect(t.terraces).toHaveLength(2);
    expect(t.stairs).toHaveLength(2);
    for (const s of t.stairs) {
      expect(s.laws.every((l) => l.ok !== false)).toBe(true);
      expect(Math.abs(s.R * s.risers - s.rise)).toBeLessThanOrEqual(0.0005 * s.risers + 1e-9);   // risers to the millimetre
    }
    // a lot never straddles a wall: its whole footprint is on one level
    for (const l of t.lots) for (const [, y] of corners(l)) expect(t.terraces.every((w) => (y > w.y) === (l.A[1] + l.ey[1] * 0.5 > w.y) || Math.abs(y - w.y) < 1e-6)).toBe(true);
    expect(designTown(meadow, 8, { levels: 0 }).stairs).toHaveLength(0);
  });

  it('a lot\'s building is placed in town frame the right way round: its door faces its route', () => {
    const t = designTown(meadow, 8);
    for (const l of t.lots.filter((x) => !x.farm)) {
      const door = placedFaces(l).find((f) => f.part === 'door' || f.part === 'accent');
      if (!door) continue;
      const c = door.corners.reduce((s, p) => [s[0] + p[0] / door.corners.length, s[1] + p[1] / door.corners.length], [0, 0]);
      // the door's outward normal points back toward the frontage it was cut from
      expect(door.normal[0] * l.ey[0] + door.normal[1] * l.ey[1]).toBeCloseTo(-1, 2);
      expect(Math.hypot(c[0] - l.front[0], c[1] - l.front[1])).toBeLessThan(l.w / 2 + l.design.dims.front + 1);
    }
  });

  it('the plan is read against the card, and refused with what is allowed', () => {
    expect(readTownPlan({})).toMatchObject({ length: TOWN_CARD.length[2], branches: 2, levels: 2, back: true });
    expect(() => readTownPlan({ levels: 3 })).toThrow(/levels is a whole number 0–2/);
    expect(() => readTownPlan({ length: 40 })).toThrow(/length is a number 90–160/);
    expect(() => readTownPlan({ walls: true })).toThrow(/not a town setting/);
    expect(() => readTownPlan({ back: 'yes' })).toThrow(/back is true or false/);
    expect(readTownPlan({}).heartbeat).toBe('village');
    expect(() => readTownPlan({ heartbeat: 'metropolis' })).toThrow(/heartbeat is hamlet, village, market, burgh/);
    expect(readTownPlan({}).secondary).toBe(0.5);
    expect(() => readTownPlan({ secondary: 2 })).toThrow(/secondary is a number from 0/);
  });

  it('the dress grows by aggressiveness, under its caps, and never on the walk but for lamps and signs', () => {
    const t = designTown(meadow, 8);
    expect(dressTown(t, meadow, 0, 8).items).toHaveLength(0);
    const half = dressTown(t, meadow, 0.5, 8).items.length, full = dressTown(t, meadow, 1, 8);
    expect(full.items.length).toBeGreaterThan(half);
    for (const k of TOWN_DRESS_IDS) expect(full.counts[k].taken).toBeLessThanOrEqual(TOWN_DRESS[k].cap);
    expect(full.items.some((i) => i.kind === 'well')).toBe(true);
    expect(readTownDress({ lamps: 0.2 }).lamps).toBe(0.2);
    expect(() => readTownDress({ dragons: 1 })).toThrow(/not a kind/);
    expect(() => readTownDress(2)).toThrow(/0 \(none\) to 1/);
  });

  it('every route is laid in the anchor\'s section, stepped down the ranks', () => {
    const t = designTown(meadow, 8), S = t.language.street, by = (id) => t.routes.find((r) => r.id === id);
    expect(by('lane').foot).toBe(S.footway.w);
    expect(by('lane').paving).toBe(S.road.paving);
    expect(by('branch').foot).toBeLessThan(by('lane').foot);
    expect(by('back').foot).toBe(0);
    // the street's furniture is the anchor's: its lamps at its stride, its posts by the square
    const d = dressTown(t, meadow, 1, 8);
    expect(d.items.some((i) => i.kind === 'posts')).toBe(true);
    expect(d.counts.lamps.sites).toBeGreaterThan(0);
  });

  it('the heartbeat is the town\'s height: a hamlet keeps to one storey, a burgh climbs at the heart', () => {
    expect(heartbeatBand('burgh', 0)).toEqual([3, 4]);
    expect(heartbeatBand('burgh', 1, true)).toEqual([1, 2]);
    const n = (hb) => designTown(meadow, 8, { heartbeat: hb }).lots.filter((l) => (l.use === 'dwelling' || l.use === 'shop') && !l.corner && !l.secondary).map((l) => l.design.dims.n);
    expect(Math.max(...n('hamlet'))).toBe(1);
    expect(Math.max(...n('burgh'))).toBeGreaterThanOrEqual(3);
    const medians = HEARTBEAT_IDS.map((hb) => designTown(meadow, 8, { heartbeat: hb }).median);
    expect(medians).toEqual([...medians].sort((a, b) => a - b));
  });

  it('households are painted by the street\'s rules: roofs hold, walls vary, neighbours differ', () => {
    for (const k of KITS) {
      const t = designTown(structureStyle(k, 8), 8), P = structurePaint(k), S = streetPaints(P, t);
      expect(S.laws.filter((l) => !l.ok), k).toEqual([]);
      expect(S.paints).toHaveLength(t.lots.length);
      expect(S.paints[t.lots.findIndex((l) => l.focus)]).toBe(P);
    }
  });

  it('the secondary punctuates: never two together, over both neighbours, under the hall; none when asked for none', () => {
    const t = designTown(meadow, 8, { secondary: 1 }), secs = t.lots.filter((l) => l.secondary);
    expect(secs.length).toBeGreaterThan(3);
    expect(t.laws.find((l) => l.law === 'secondary').ok).toBe(true);
    for (const l of secs) expect(l.design.language).toBe(t.secondary.id);
    expect(designTown(meadow, 8, { secondary: 0 }).lots.some((l) => l.secondary)).toBe(false);
    expect(designTown(meadow, 8, { secondary: 0.2 }).lots.filter((l) => l.secondary).length).toBeLessThan(secs.length);
  });

  it('the town is a pure function of its style, seed and recipe, and its map the same picture every time', () => {
    const a = designTown(meadow, 5, { sway: 0.8 }), b = designTown(structureStyle('isekai-meadow', 8), 5, { sway: 0.8 });
    expect(JSON.stringify(a.lots.map((l) => [l.A, l.use, l.design.sig]))).toBe(JSON.stringify(b.lots.map((l) => [l.A, l.use, l.design.sig])));
    const d = dressTown(a, meadow, undefined, 5);
    const ids = (h) => h.replace(/tm\d+/g, 'tm');
    const P = structurePaint('isekai-meadow');
    expect(ids(townMapSvg(a, P, d))).toBe(ids(townMapSvg(b, P, dressTown(b, meadow, undefined, 5))));
    // as built, without a paint, the map is greys only
    expect(ids(townMapSvg(a, null, d)).match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/g).every((h) => h.slice(1, 3) === h.slice(3, 5) && h.slice(3, 5) === h.slice(5, 7))).toBe(true);
  });

  it('the plan makes room for its boundaries: fronts on lived lots, gated; yards closed; terraces held and guarded', () => {
    for (const anchor of [...Object.keys(ELEMENT_SETS), { seed: 4 }]) {
      const t = designTown(meadow, 8, { anchor, levels: 2 }), B = t.boundaries, id = JSON.stringify(anchor);
      expect(t.laws.filter((l) => !l.ok), id).toEqual([]);
      // a front closes only where people live, and stands under a metre
      for (const b of B.filter((x) => x.role === 'front')) { expect(t.lots[b.lot].use, id).toBe('dwelling'); expect(b.h).toBeLessThanOrEqual(BOUNDARY_HEIGHTS.low.h[1] + 1e-9); }
      // each terrace: one retaining run as high as its rise, one guard on its top, open where the branch climbs it
      for (const tr of t.terraces) {
        const ret = B.find((b) => b.role === 'retain' && b.pts[0][1] === tr.y), g = B.find((b) => b.role === 'guard' && b.z === tr.z1);
        expect(ret.h).toBe(tr.rise);
        expect(g.gates).toHaveLength(1);
        expect(g.h).toBeGreaterThanOrEqual(0.9);
      }
      // the lines are structures: each built as faces in town coordinates, inside the map's frame
      for (const b of B.filter((x) => x.ring === 'near').slice(0, 30)) for (const f of boundaryFaces(t, b).flat()) for (const [x, y] of f.corners) { expect(x).toBeGreaterThanOrEqual(t.bounds.x0 - 1); expect(x).toBeLessThanOrEqual(t.bounds.x1 + 1); expect(y).toBeGreaterThanOrEqual(t.bounds.y0 - 1); }
    }
    // the dress no longer grows fences: the plan owns them
    expect(TOWN_DRESS_IDS).not.toContain('fences');
  });

  it('a flush walk is posted along its line; a verge narrows down the ranks but keeps its clear path', () => {
    const flush = { ...ELEMENT_SETS['timber-hall'], elements: { ...ELEMENT_SETS['timber-hall'].elements, footway: { kind: 'footway', w: 1.6, paving: 'flags', form: 'flush' } } };
    const t = designTown(meadow, 8, { anchor: flush }), lane = t.routes.find((r) => r.id === 'lane');
    expect(lane.walkForm).toBe('flush');
    expect(lane.kerbH).toBe(0);
    expect(t.laws.filter((l) => !l.ok)).toEqual([]);
    const d = dressTown(t, meadow, { posts: 1 }, 8), lined = d.items.filter((it) => it.kind === 'posts' && Math.abs(distTo(lane.pts, it.at[0], it.at[1]) - (lane.w / 2 + 0.2)) < 0.05);
    expect(lined.length).toBeGreaterThan(10);
    expect(d.laws.filter((l) => !l.ok)).toEqual([]);
    const ts = designTown(meadow, 8, { anchor: 'shell' });
    for (const r of ts.routes.filter((x) => x.foot)) { expect(r.walkForm).toBe('verge'); expect(r.foot - r.verge).toBeGreaterThanOrEqual(0.9 - 1e-9); }
  });

  it('street tiles: every rank at every ring tiles seamlessly, in whole units, inside its budget', () => {
    // every rank in every anchor's section, the rings and the kinds taken in turn across them
    const RINGS = ['near', 'mid', 'far'], KINDS = ['run', 'drop', 'end'];
    for (const [a, anchor] of Object.keys(ELEMENT_SETS).entries()) for (const [r, rank] of ['lane', 'branch', 'upper', 'back'].entries()) {
      const ring = RINGS[(a + r) % 3], kind = KINDS[(a + 2 * r) % 3];
      const T = streetTile(anchor, rank, { ring, kind });
      expect(T.laws.filter((l) => !l.ok), `${anchor} ${rank} ${ring} ${kind}`).toEqual([]);
      // nothing leaves the tile's length
      for (const f of T.faces) for (const c of f.corners) { expect(c[0]).toBeGreaterThanOrEqual(-0.02); expect(c[0]).toBeLessThanOrEqual(T.len + 0.02); }
    }
    // the degrees of detail cost more as the ring nears
    const tri = (ring) => streetTile('timber-hall', 'lane', { ring }).tris;
    expect(tri('far')).toBeLessThan(tri('mid'));
    expect(streetTile('timber-hall', 'lane', { ring: 'near' }).faces.some((f) => f.tile)).toBe(true);
    expect(streetTile('timber-hall', 'lane', { ring: 'mid' }).faces.some((f) => f.tile)).toBe(false);
  });
});
