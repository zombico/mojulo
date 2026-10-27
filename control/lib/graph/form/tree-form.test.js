/**
 * A tree read as form (form/tree-form.js): the same tree twice; its wood tubes with smooth normals and the bark's
 * coordinates in tiles; its sites one a cell of the leafy shoots, carrying the crown's leaf area, in rank order.
 * The smallest tree the catalogue grows quickly is enough: the concept, not the catalogue.
 */
import { describe, expect, it } from 'vitest';

import { treeForm, TREE_FORM } from './tree-form.js';
import { BARK_TILE_M } from '../vegetation/tiles.js';
import { leafHolds } from '../vegetation/sprays.js';
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
});
