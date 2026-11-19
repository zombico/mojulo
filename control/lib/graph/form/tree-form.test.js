/**
 * A tree read as form (form/tree-form.js): the same tree twice; its wood tubes with smooth normals and the bark's
 * coordinates in tiles; its sites one a cell of the leafy shoots, carrying the crown's leaf area, in rank order.
 * The smallest tree the catalogue grows quickly is enough: the concept, not the catalogue.
 */
import { describe, expect, it } from 'vitest';

import { treeForm, massCrown, tipBlobs, anchorBlobs, majorBalls, TREE_FORM, SLEEVE, MASSES, TIP_BLOBS, BLOB_HOLD, CANOPY, BALLS, EVOKE, limbTree } from './tree-form.js';
import { BARK_TILE_M } from '../vegetation/tiles.js';
import { leafHolds, needleHabit } from '../vegetation/sprays.js';
import { SPECIES } from '../vegetation/species.js';

const SP = 'cherry', T = treeForm(SP, { seed: 7 });

describe('treeForm', () => {
  it('reads the same tree the same way', () => {
    expect(treeForm(SP, { seed: 7 })).toEqual(T);
  }, 60_000);

  it('draws the wood as tubes whose normals point out of their axis, smooth round it, the bark in tiles', () => {
    const { pos, nrm, uv, idx } = T.wood;
    expect(pos.length).toBe(nrm.length);
    expect(uv.length / 2).toBe(pos.length / 3);
    expect(idx.length % 3).toBe(0);
    for (let i = 0; i < nrm.length; i += 3) expect(Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2])).toBeCloseTo(1, 3);
    // (up an axis, the bark's v is its arc length in tiles: the trunk's first ring at 0, rising)
    expect(uv[1]).toBe(0);
    expect(Math.max(...uv.filter((_, i) => i % 2))).toBeGreaterThan(T.height / BARK_TILE_M * 0.3);
  });

  it('gathers the leafy shoots into sites a spray long, each scaled within its bounds, in rank order, lit by the crown\'s own shade only as occlusion', () => {
    expect(T.sites.length).toBeGreaterThan(10);
    for (const s of T.sites) {
      expect(s.s).toBeGreaterThanOrEqual(TREE_FORM.scale[0]);
      expect(Math.hypot(...s.d)).toBeCloseTo(1, 3);
      expect(s.e).toBeGreaterThanOrEqual(0); expect(s.e).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < T.sites.length; i++) expect(T.sites[i].r).toBeGreaterThanOrEqual(T.sites[i - 1].r);
    // (a cell takes more sites past its cap rather than a bigger one: none past it, and most cells keep one)
    for (const x of T.sites) expect(x.s).toBeLessThanOrEqual(TREE_FORM.cap.spray + 1e-3);
    const cells = new Set(T.sites.map((x) => x.p.map((v) => Math.floor(v / TREE_FORM.cell)).join(',')));
    expect(cells.size).toBeGreaterThan(T.sites.length * 0.5);
  });

  it('cuts the wood by diameter: a thicker cut draws less', () => {
    expect(treeForm(SP, { seed: 7, minDiameter: 0.08 }).wood.idx.length).toBeLessThan(T.wood.idx.length);
  }, 60_000);

  it('its clumps and its sprays hold the same leaf area: the crown is clumps everywhere and the sprays come in inside them', () => {
    const H = leafHolds(SP), area = (list, holds) => list.reduce((a, s) => a + s.s * s.s * holds, 0), shoots = T.clumps.filter((c) => !c.f);
    expect(shoots.length).toBeLessThan(T.sites.length);
    const a = area(shoots, H.clump), b = area(T.sites, H.spray);
    expect(Math.abs(a - b) / b).toBeLessThan(0.3);
    // (each faces out of the crown)
    for (const c of T.clumps) expect(Math.hypot(...c.o)).toBeCloseTo(1, 3);
  });

  it('grows young and stands mature, its crown filled to its envelope where the shoots leave it open', () => {
    const young = treeForm(SP, { seed: 7, mature: null });
    // (toward the top of its species' height range, within the re-standing's bounds)
    expect(T.height).toBeGreaterThan(young.height);
    expect(T.height).toBeLessThanOrEqual(young.height * TREE_FORM.mature.range[1] * 1.02);
    // (the envelope's clumps stand off every clump of a shoot: they fill gaps, never stack on the real ones)
    const fill = T.clumps.filter((c) => c.f), shoots = T.clumps.filter((c) => !c.f);
    expect(fill.length).toBeGreaterThan(0);
    const gap = TREE_FORM.clumpCell * (T.height / young.height) * TREE_FORM.envelope.spacing * 0.75 * 0.98;
    for (const c of fill) for (const q of shoots) expect(Math.hypot(c.p[0] - q.p[0], c.p[1] - q.p[1], c.p[2] - q.p[2])).toBeGreaterThan(gap - 1e-3);
  }, 60_000);

  it('grows a conifer by its own rules at its age: slender limbs drawn, its foliage needles, its fir\'s or spruce\'s clumps pads', () => {
    const sp = Object.keys(SPECIES).find((k) => SPECIES[k].kind === 'conifer'), C = treeForm(sp, { seed: 3 });
    expect(C.needles).toBe(SPECIES[sp].conifer);
    expect(C.pad).toBe(C.needles !== 'pine');
    expect(C.height).toBeGreaterThan(8);
    expect(C.wood.idx.length).toBeGreaterThan(0);
    expect(C.clumps.length).toBeGreaterThan(20);
  }, 60_000);

  it('weeps where its species does: curtains hanging from the crown\'s rim, never to the ground; aimed at a level\'s height', () => {
    const sp = Object.keys(SPECIES).find((k) => SPECIES[k].weep), W = treeForm(sp, { seed: 1, far: true });
    const hanging = W.clumps.filter((c) => c.d[2] === -1);
    expect(hanging.length).toBeGreaterThan(20);
    for (const c of hanging) expect(c.p[2]).toBeGreaterThan(W.height * 0.1);
    // (its far wood the thick axes, its trunk a line up it)
    expect(W.woodFar.idx.length).toBeLessThanOrEqual(W.wood.idx.length);
    expect(W.trunk.length % 4).toBe(0);
    expect(W.trunk[W.trunk.length - 2]).toBeGreaterThan(W.trunk[2]);
  }, 60_000);

  it('wraps a needled crown\'s leafy runs in sleeves round their axes, each vertex knowing its axis; a broadleaf has none', () => {
    // (one needled species, picked from the catalogue: the needles are drawn in the sleeve by the page, no needle a polygon)
    const sp = Object.keys(SPECIES).find((s) => needleHabit(s)), C = treeForm(sp, { seed: 7 }), W = C.sleeve;
    expect(T.sleeve).toBeUndefined();
    expect(W.idx.length).toBeGreaterThan(0);
    expect(W.idx.length % 3).toBe(0);
    const n = W.pos.length / 3;
    expect(W.out.length / 3).toBe(n); expect(W.ax.length / 3).toBe(n); expect(W.uv.length / 2).toBe(n);
    expect(Math.max(...W.idx)).toBeLessThan(n);
    for (let i = 0; i < W.out.length; i += 3) {
      const r = Math.hypot(W.out[i], W.out[i + 1], W.out[i + 2]);
      // (out of its axis no further than the needles' reach, narrowing at a run's tip; its normal that way; its axis a unit, across it)
      expect(r).toBeLessThanOrEqual(W.radius + 1e-3); expect(r).toBeGreaterThanOrEqual(W.radius * SLEEVE.tip - 1e-3);
      expect(W.nrm[i] * W.out[i] + W.nrm[i + 1] * W.out[i + 1] + W.nrm[i + 2] * W.out[i + 2]).toBeCloseTo(r, 2);
      expect(Math.hypot(W.ax[i], W.ax[i + 1], W.ax[i + 2])).toBeCloseTo(1, 2);
      expect(Math.abs(W.ax[i] * W.out[i] + W.ax[i + 1] * W.out[i + 1] + W.ax[i + 2] * W.out[i + 2])).toBeLessThan(r * 0.05 + 1e-3);
    }
  }, 60_000);
});

describe('the mass crown', () => {
  // (two crowns of bundles round two branches: a seeded spread round each)
  const rnd = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const at = (c, i) => [c[0] + (rnd(i) - 0.5) * 2, c[1] + (rnd(i + 99) - 0.5) * 2, c[2] + (rnd(i + 199) - 0.5) * 1.4];
  const clumps = Array.from({ length: 28 }, (_, i) => ({ p: at(i < 14 ? [-2.5, 0, 6] : [2.5, 0, 7], i), o: [0, 0, 1], d: [1, 0, 0], s: 0.8, e: 0.6, r: i / 28 }));

  it('gathers the bundles into a few big blobs round their branches, and stands each bundle on its blob, facing out', () => {
    const M = massCrown(clumps);
    expect(M.blobs.length).toBeGreaterThanOrEqual(MASSES.least);
    expect(M.blobs.length).toBeLessThanOrEqual(MASSES.most);
    expect(M.clumps.length).toBe(clumps.length);
    for (const c of M.clumps) {
      const B = M.blobs.reduce((a, b) => (Math.hypot(...b.p.map((v, k) => v - c.p[k])) < Math.hypot(...a.p.map((v, k) => v - c.p[k])) ? b : a));
      const v = c.p.map((x, k) => x - B.p[k]), dist = Math.hypot(...v);
      // (on its blob's surface, sunk by its share, its face the way out from the blob's middle)
      expect(dist).toBeCloseTo(Math.max(0.05, B.s - c.s * MASSES.drop), 2);
      expect(c.o.reduce((a, x, k) => a + x * v[k] / dist, 0)).toBeGreaterThan(0.99);
    }
    // (each blob as wide as the bundles it gathers spread)
    for (const b of M.blobs) expect(b.s).toBeGreaterThan(0.3);
    // (the same bundles, the same crown)
    expect(JSON.stringify(massCrown(clumps))).toBe(JSON.stringify(M));
  });

  it('blobs at the branch ends: one at each end just past its tip, about a third gathered into masses solved outward', () => {
    const { blobs } = tipBlobs(clumps);
    // (about a third gathered: fewer blobs than ends, the masses each standing for two or three)
    expect(blobs.length).toBeLessThan(clumps.length);
    expect(blobs.length).toBeGreaterThanOrEqual(Math.round(clumps.length * (1 - TIP_BLOBS.merge.share)) - Math.round(clumps.length * TIP_BLOBS.merge.share * 0.5) - 1);
    // (every blob within the crown's own sizes, a mass at most its cap over the largest end's)
    const mid = 0.8;
    for (const b of blobs) { expect(b.s).toBeLessThanOrEqual(TIP_BLOBS.merge.cap * TIP_BLOBS.most * mid + 1e-9); expect(b.s).toBeGreaterThanOrEqual(TIP_BLOBS.least * mid * (1 - TIP_BLOBS.taper) - 1e-9); }
    // (the same ends, the same blobs)
    expect(JSON.stringify(tipBlobs(clumps))).toBe(JSON.stringify({ blobs }));
  });

  it('the major balls: the crown as its 3 or 4 great masses, each holding most of its ends, reaching its outermost', () => {
    const all = majorBalls(clumps).blobs, blobs = all.slice(0, BALLS.k[0]), lobes = all.slice(BALLS.k[0]);
    // (the balls first, then the lobes that join them: a core, a bridge of at most `links` to each ball, the joins)
    expect(lobes.length).toBeGreaterThanOrEqual(1 + BALLS.k[0]);
    expect(lobes.length).toBeLessThanOrEqual(1 + BALLS.links * BALLS.k[0] + BALLS.k[0]);
    const big = majorBalls([...clumps, ...clumps.map((c) => ({ ...c, p: [c.p[0], c.p[1] + 4, c.p[2]] }))]).blobs;
    expect(big.filter((b) => b.s > 0.4 && big.indexOf(b) < BALLS.k[1]).length).toBe(BALLS.k[1]);
    // (each ball a real mass: within its crown, no ball a speck)
    for (const b of blobs) expect(b.s).toBeGreaterThan(0.4);
    // (gaps between them: no two balls' surfaces meet, sky between the masses)
    for (let i = 0; i < blobs.length; i++) for (let j = 0; j < i; j++) expect(blobs[i].s + blobs[j].s).toBeLessThanOrEqual(BALLS.sep * Math.hypot(...blobs[i].p.map((v, k) => v - blobs[j].p[k])) + 1e-3);
    // (joined to its tree: the core below the balls' middle, and the crown one mass through its lobes, each ball
    // reached from the core by lobes that overlap, though no two balls touch)
    const mid = blobs.reduce((a, x) => a + x.p[2], 0) / blobs.length, core = lobes[0];
    expect(core.p[2]).toBeLessThan(mid);
    const d = (u, v) => Math.hypot(...u.p.map((x, k) => x - v.p[k])), seen = new Set([blobs.length]), todo = [blobs.length];
    while (todo.length) { const i = todo.pop(); all.forEach((x, j) => { if (!seen.has(j) && d(all[i], x) < all[i].s + x.s) { seen.add(j); todo.push(j); } }); }
    expect(seen.size).toBe(all.length);
    expect(JSON.stringify(majorBalls(clumps))).toBe(JSON.stringify({ blobs: all }));
  });

  it('holds each blob to the wood that is drawn: one floating past it drawn in until it touches', () => {
    const wood = [0, 0, 0, 0, 0, 4];
    const [near, far] = anchorBlobs([{ p: [0.3, 0, 4], s: 0.5 }, { p: [3, 0, 4], s: 0.5 }], wood);
    expect(near.p).toEqual([0.3, 0, 4]);
    expect(Math.hypot(far.p[0], far.p[1], far.p[2] - 4)).toBeCloseTo(0.5 * BLOB_HOLD, 3);
  });
});

describe('the evoked wood', () => {
  it('draws the trunk and the limbs that carry each mass, ending at its underside, and nothing over the crown', () => {
    const at = (evoke) => treeForm('beech', { seed: 3, mature: { toHeight: 0.95, range: [1, 2], cambium: 2.2, aim: 12 }, canopy: true, evoke });
    const whole = at(null), tris = (F) => F.wood.idx.length / 3;
    const balls = majorBalls(whole.clumps, { joined: false }).blobs, evoked = at({ balls }), P = evoked.wood.pos;
    expect(tris(evoked)).toBeGreaterThan(0);
    for (const b of balls) {
      const end = [b.p[0], b.p[1], b.p[2] - b.s * (1 - EVOKE.reach)];
      let best = Infinity; for (let i = 0; i < P.length; i += 3) best = Math.min(best, Math.hypot(P[i] - end[0], P[i + 1] - end[1], P[i + 2] - end[2]));
      expect(best).toBeLessThan(b.s * 0.25);
    }
    const top = Math.max(...balls.map((b) => b.p[2] + b.s)); for (let i = 2; i < P.length; i += 3) expect(P[i]).toBeLessThan(top);
  }, 120000);

  it('grows its limbs from the masses back to the trunk: forks by the pipe model, each length climbing, main limbs staggered', () => {
    // (a plain upright trunk and eight masses round a crown)
    const trunk = { pts: Array.from({ length: 11 }, (_, i) => [0, 0, i]), rs: Array.from({ length: 11 }, (_, i) => 0.4 - 0.025 * i) };
    const pads = Array.from({ length: 8 }, (_, i) => { const a = (i * 2 * Math.PI) / 8; return { p: [3 * Math.cos(a), 3 * Math.sin(a), 7 + (i % 3) * 0.8], s: 1.2 }; });
    const L = limbTree(trunk, pads, 0.03), E = L.edges;
    // (each mass the end of one length, entered from below; fewer main limbs than masses)
    for (let i = 0; i < pads.length; i++) expect(E.filter((g) => g.end === i).length).toBe(1);
    const mains = E.filter((g) => g.main);
    expect(mains.length).toBeLessThan(pads.length);
    expect(mains.length).toBeGreaterThanOrEqual(2);
    // (every length climbs: no limb drawn down or level)
    for (const g of E) expect(g.to[2]).toBeGreaterThan(g.from[2]);
    // (the pipe model: at a fork, the section coming in is the sections going out)
    const key = (q) => q.map((v) => v.toFixed(4)).join(',');
    for (const g of E.filter((x) => x.end < 0)) {
      const out = E.filter((x) => key(x.from) === key(g.to));
      expect(out.length).toBe(2);
      if (!g.main) expect(out.reduce((a, x) => a + x.r0 * x.r0, 0)).toBeCloseTo((g.r1 / 0.92) ** 2, 4);
    }
    expect(E.some((g) => g.end < 0 && !g.main)).toBe(true);
    // (the main limbs leave the trunk at heights apart, none under its low share)
    const zs = mains.map((g) => g.from[2]).sort((a, b) => a - b);
    for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeGreaterThanOrEqual(EVOKE.stagger - 1e-9);
    expect(zs[0]).toBeGreaterThanOrEqual(EVOKE.low * 10 - 1e-9);
    // (deterministic)
    expect(JSON.stringify(limbTree(trunk, pads, 0.03))).toBe(JSON.stringify(L));
  });
});

describe('the canopy form', () => {
  it('stands a broadleaf on a bare stem with a wider crown: no leaf below its lift, its spread over the plain tree\'s', () => {
    const at = (canopy) => treeForm('beech', { seed: 3, mature: { toHeight: 0.95, range: [1, 2], cambium: 2.2, aim: 12 }, canopy });
    const plain = at(false), canopy = at(true);
    const lowest = (F) => Math.min(...F.clumps.map((c) => c.p[2])), spread = (F) => Math.max(...F.clumps.map((c) => Math.hypot(c.p[0], c.p[1])));
    expect(lowest(canopy)).toBeGreaterThanOrEqual(CANOPY.lift * canopy.height - 1e-6);
    expect(lowest(canopy)).toBeGreaterThan(lowest(plain));
    expect(spread(canopy)).toBeGreaterThan(spread(plain));
  }, 120000);
});
