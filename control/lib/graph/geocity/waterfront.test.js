// THE METRO'S WATERFRONT: its shores reclaimed, a boulevard along its main one under the lakeshore expressway, its
// segments out past it (quays, piers, dining, parks, a beach, a marina, steps) along a promenade over the water, its kit
// and its boats; drawn and driven.
import { describe, it, expect } from 'vitest';
import { designGeocity } from './design.js';
import { readGeocity, METROS, METRO_IDS } from './metro.js';
import { waterfrontOf, waterfrontLaws, frameOf, waterfrontTemplates, shoreAt, WATERFRONT, WATERFRONT_KINDS } from './waterfront.js';
import { assembleGeocityScene } from './scene.js';
import { DEFAULT_LIGHT } from '../polygonizer/vexar.js';

const d = designGeocity({ evoke: 'neighbourhood' }, { seed: 2 });
const ISLAND = METRO_IDS.find((id) => METROS[id].water.sides.length === 4);

describe('the metro\'s waterfront, planned', () => {
  it('reclaims each shore end to end: its main one a boulevard and a deep strip, its segments more than one kind', () => {
    expect(d.waterfront).toHaveLength(d.water.length);
    const W = d.waterfront.find((x) => x.main);
    expect(W.side).toBe(d.metro.fall.toward);
    expect(W.boulevard).toBeDefined();
    expect(W.segments[0].a0).toBe(W.a0);
    expect(W.segments.at(-1).a1).toBe(W.a1);
    for (let k = 1; k < W.segments.length; k++) { expect(W.segments[k].a0).toBe(W.segments[k - 1].a1); expect(W.segments[k].kind).not.toBe(W.segments[k - 1].kind); }
    for (const g of W.segments) { expect(WATERFRONT_KINDS).toContain(g.kind); expect(g.depth).toBeGreaterThanOrEqual(WATERFRONT.depth.main[0]); expect(g.depth).toBeLessThanOrEqual(WATERFRONT.depth.main[1]); }
    for (const g of W.segments.filter((x) => x.kind === 'pier')) for (const p of g.piers) { expect(p.a).toBeGreaterThan(g.a0); expect(p.a).toBeLessThan(g.a1); }
    expect(d.laws.find((l) => l.law === 'waterfront').ok).toBe(true);
  });

  it('lets its beaches and parks meet the water naturally: a beach a crescent bay, a park a headland or a cove, flush at their ends', () => {
    const all = d.waterfront.flatMap((W) => W.segments);
    const nat = all.filter((g) => g.shore);
    expect(nat.length).toBeGreaterThan(0);
    for (const g of nat) {
      expect(['beach', 'park']).toContain(g.kind);
      expect(shoreAt(g, g.a0)).toBeCloseTo(g.depth, 6);
      expect(shoreAt(g, g.a1)).toBeCloseTo(g.depth, 6);
      const mid = shoreAt(g, (g.a0 + g.a1) / 2);
      if (g.shore.form === 'bay') expect(mid).toBeLessThan(g.depth - g.shore.amp * 0.5);
      if (g.shore.form === 'headland') expect(mid).toBeGreaterThan(g.depth);
      // (never so far in that it leaves the strip less than its least behind it)
      for (let i = 0; i <= 20; i++) expect(shoreAt(g, g.a0 + ((g.a1 - g.a0) * i) / 20)).toBeGreaterThan(WATERFRONT.natural.least);
    }
    for (const g of all.filter((x) => !x.shore)) expect(shoreAt(g, (g.a0 + g.a1) / 2)).toBe(g.depth);
  });

  it('meets an island\'s every shore, its main one alone a boulevard; none where its recipe says `waterfront: false`', () => {
    const I = designGeocity({ metro: ISLAND, evoke: 'neighbourhood' }, { seed: 1 });
    expect(I.waterfront.map((W) => W.side).sort()).toEqual(['e', 'n', 's', 'w']);
    expect(I.waterfront.filter((W) => W.boulevard)).toHaveLength(1);
    expect(designGeocity({ evoke: 'neighbourhood', waterfront: false }, { seed: 2 }).waterfront).toBeUndefined();
    expect(() => readGeocity({ waterfront: 'yes' })).toThrow(/waterfront is true or false/);
  });

  it('lays a strip out into the water, its frame its shore\'s', () => {
    for (const W of d.waterfront) {
      const f = frameOf(W), [x, y] = f.P((W.a0 + W.a1) / 2, 50), [lx0, ly0, lx1, ly1] = d.land.rect;
      expect(x < lx0 || x > lx1 || y < ly0 || y > ly1).toBe(true);
    }
  });

  it('stands the lakeshore expressway over its boulevard, on its median', () => {
    const h = d.highways.find((x) => x.role === 'shore'), W = d.waterfront.find((x) => x.main), tc = (W.boulevard.t0 + W.boulevard.t1) / 2;
    expect(h.boulevard).toBe(true);
    expect(h.water).toBeUndefined();
    expect(Math.abs(h.at - frameOf(W).P(0, tc)[1])).toBeLessThan(0.01);
    for (const p of h.piers) expect(p.cols).toEqual([0]);
  });

  it('builds its kit, each piece lit, a boat each way it lies', () => {
    const T = waterfrontTemplates(DEFAULT_LIGHT);
    for (const k of ['parasol', 'patio', 'lounger', 'bollard', 'pile', 'planter']) expect(T[k].length).toBeGreaterThan(2);
    for (const b of ['sail', 'motor', 'ferry']) for (const a of ['x', 'y']) expect(T.boat[b][a].length).toBeGreaterThan(5);
    expect(waterfrontLaws({ waterfront: [] })).toEqual([]);
  });
});

describe('the metro\'s waterfront, built', () => {
  const p = assembleGeocityScene({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: { evoke: 'neighbourhood' } });
  it('draws each segment its way, its kit and boats near the camera, its boulevard driven', () => {
    const W = d.waterfront.find((x) => x.main), C = p.geocity.counts.waterfront;
    for (const k of new Set(W.segments.map((g) => g.kind))) expect(C[k]).toBeGreaterThan(0);
    const groups = new Set(p.repeats.map((r) => r.group));
    for (const g of ['geocity:waterfront-bollard', 'geocity:waterfront-parasol']) expect(groups.has(g)).toBe(true);
    expect([...groups].some((g) => g.startsWith('geocity:waterfront-boat-'))).toBe(true);
    for (const g of ['geocity:quay-wall', 'geocity:promenade']) expect(p.faces.some((f) => f.group === g)).toBe(true);
    // (its promenade a little over the water, never under it)
    const zw = d.land.range[0] - 1.2;
    for (const f of p.faces.filter((x) => x.group === 'geocity:promenade')) for (const c of f.corners) expect(c[2]).toBeGreaterThan(zw + 1);
    expect(p.flow.lanes.filter((L) => L.line === `wf-${W.side}`)).toHaveLength(2 * W.boulevard.lanes);
    expect(p.geocity.waterfront.find((x) => x.main).segments).toEqual(W.segments.map((g) => g.kind));
    // (its materials: granite quays, timber decking, armour stone, sand, a marina's and a pier's steel sheet piling)
    const tex = (g) => p.faces.some((f) => f.group === g && f.texture);
    for (const g of ['geocity:quay', 'geocity:deck', 'geocity:promenade']) expect(tex(g), g).toBe(true);
    if (W.segments.some((g) => g.kind === 'marina' || g.kind === 'pier')) expect(tex('geocity:quay-wall-steel')).toBe(true);
    if (W.segments.some((g) => g.kind === 'beach')) expect(tex('geocity:sand')).toBe(true);
    // (a crescent's sand: its water's line not straight, its corners out from the land's edge at more than one depth)
    const bay = W.segments.find((g) => g.shore?.form === 'bay');
    if (bay) {
      const f = frameOf(W), outs = p.faces.filter((x) => x.group === 'geocity:sand').flatMap((x) => x.corners).map(([x, y]) => (f.along === 'x' ? Math.abs(y - W.edge) : Math.abs(x - W.edge))).map(Math.round);
      expect(new Set(outs).size).toBeGreaterThan(8);
    }
    if (W.segments.some((g) => g.kind === 'park')) expect(tex('geocity:riprap')).toBe(true);
    for (const id of ['waterfront', 'faces', 'highway-clear']) expect(p.geocity.laws.find((l) => l.law === id).ok).toBe(true);
  });
});
