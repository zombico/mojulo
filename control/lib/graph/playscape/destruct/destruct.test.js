/**
 * Destruction without knowing the shape: an item is its blocks (recorded as its skin builds them); cleave cuts the
 * blocks by cells (a grid dices, a Voronoi shatters), dismantle severs the joints read off the geometry, and collapse
 * moves what comes loose, seeded and stepped.
 */
import { describe, expect, it } from 'vitest';

import { obox, blockSink } from '../../era/props.js';
import { resolveObject } from '../objects/index.js';
import { boxPolytope, clip, volume, V } from './polytope.js';
import { cleave, INSIDE_STEP } from './cleave.js';
import { dismantle, joints } from './dismantle.js';
import { collapse, rotate } from './collapse.js';

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const surf = (v) => ({ key: null, scale: 1, tint: [v, v, v], group: 'obj:body' });
const door = () => resolveObject({ entry: 'door', variant: 'single', skin: 'plank', fit: { width: 1.4, height: 2.6 } });

// a table: a top on four legs, standing on the floor
function table() {
  const out = blockSink();
  const put = (part, c, h, v = 0.5) => { obox(out, c, X, Y, Z, h, surf(v), 8); out.boxes[out.boxes.length - 1].part = part; };
  put('top', [0, 0, 0.75], [0.6, 0.4, 0.03], 0.7);
  for (const [i, [x, y]] of [[0.55, 0.35], [-0.55, 0.35], [0.55, -0.35], [-0.55, -0.35]].entries()) put(`leg${i}`, [x, y, 0.36], [0.03, 0.03, 0.36]);
  return { faces: out, frame: { at: [0, 0, 0], N: [0, -1, 0], U: [1, 0, 0] } };
}

// a closed solid's outward face areas sum to zero
const closure = (poly) => V.len(poly.faces.reduce((a, f) => {
  let s = [0, 0, 0];
  for (let i = 1; i < f.pts.length - 1; i++) s = V.add(s, V.cross(V.sub(f.pts[i], f.pts[0]), V.sub(f.pts[i + 1], f.pts[0])));
  return V.add(a, V.mul(s, 0.5));
}, [0, 0, 0]));

describe('items keep their blocks', () => {
  it('obox into a blockSink records the box and draws the same faces as before', () => {
    const plain = [], sink = blockSink();
    obox(plain, [1, 2, 3], X, Y, Z, [0.5, 0.2, 0.1], surf(0.4), 0.25);
    obox(sink, [1, 2, 3], X, Y, Z, [0.5, 0.2, 0.1], surf(0.4), 0.25);
    expect(JSON.stringify(sink)).toBe(JSON.stringify(plain));
    expect(sink.boxes).toEqual([expect.objectContaining({ c: [1, 2, 3], h: [0.5, 0.2, 0.1], value: 0.4, from: 0, to: plain.length })]);
  });

  it('every playscape entry resolves with its blocks, the door\'s posed with its leaf', () => {
    for (const spec of [{ entry: 'platform', skin: 'island' }, { entry: 'lift' }, { entry: 'catapult', variant: 'bounce' }]) expect(resolveObject(spec).faces.boxes.length).toBeGreaterThan(0);
    const shut = door(), open = resolveObject({ entry: 'door', variant: 'single', skin: 'plank', fit: { width: 1.4, height: 2.6 }, state: 'open' });
    expect(open.faces.boxes.length).toBe(shut.faces.boxes.length);
    expect(V.len(V.sub(open.faces.boxes[0].c, shut.faces.boxes[0].c))).toBeGreaterThan(0.3);   // the slab swung with the leaf
    expect(V.len(open.faces.boxes[0].A)).toBeCloseTo(1, 6);                                      // its axes turned, still unit
  });
});

describe('the polytope', () => {
  it('a plane cuts a box into two closed convex halves whose volumes add up', () => {
    const b = { c: [0, 0, 0], A: X, B: Y, C: Z, h: [1, 1, 1], value: 0.5 };
    const n = V.unit([1, 1, 0.3]), lo = clip(boxPolytope(b), n, 0.2, { value: 0.3, cut: true }), hi = clip(boxPolytope(b), V.mul(n, -1), -0.2, { value: 0.3, cut: true });
    expect(volume(lo) + volume(hi)).toBeCloseTo(8, 6);
    expect(closure(lo)).toBeLessThan(1e-9);
    expect(lo.faces.filter((f) => f.src.cut)).toHaveLength(1);
  });
});

describe('cleave: the shaped cut', () => {
  it('a grid dices evenly over the item and never cuts its thin axis', () => {
    const r = cleave(door(), { pattern: 'grid', cell: 0.45 });
    expect(r.split).toEqual([3, 1, 6]);                     // across, through the thickness (uncut), up
    expect(r.chunks).toHaveLength(18);
  });

  for (const pattern of ['grid', 'voronoi']) {
    it(`${pattern}: the chunks hold the item's whole volume, every piece closed, every cut face the inside`, () => {
      const o = door(), whole = o.faces.boxes.reduce((a, b) => a + volume(boxPolytope(b)), 0);
      const r = cleave(o, { pattern, count: 12, seed: 7 });
      expect(r.chunks.reduce((a, c) => a + c.volume, 0)).toBeCloseTo(whole, 4);
      for (const c of r.chunks) for (const p of c.pieces) expect(closure(p.poly)).toBeLessThan(1e-8);
      const slab = o.faces.boxes.find((b) => b.part === 'body').value;
      const cuts = r.chunks.flatMap((c) => c.faces).filter((f) => f.cut && f.part === 'body');
      expect(cuts.length).toBeGreaterThan(0);
      for (const f of cuts) expect(f.value).toBeCloseTo(slab - INSIDE_STEP, 5);
    });
  }

  it('a chunk keeps what is fixed to it: a handle goes with the slab around it', () => {
    const r = cleave(door(), { pattern: 'grid', cell: 0.45 });
    expect(r.chunks.some((c) => c.parts.includes('handle') && c.parts.includes('body'))).toBe(true);
  });

  it('a shatter is seeded: the same seed the same chunks, another seed others', () => {
    const a = cleave(door(), { pattern: 'voronoi', count: 10, seed: 3 }), b = cleave(door(), { pattern: 'voronoi', count: 10, seed: 3 }), c = cleave(door(), { pattern: 'voronoi', count: 10, seed: 4 });
    expect(JSON.stringify(a.chunks.map((k) => k.faces))).toBe(JSON.stringify(b.chunks.map((k) => k.faces)));
    expect(JSON.stringify(a.chunks.map((k) => k.centroid))).not.toBe(JSON.stringify(c.chunks.map((k) => k.centroid)));
  });
});

describe('dismantle: the concept cut', () => {
  it('reads the joints off the geometry: a table\'s top on four legs, the legs on the floor', () => {
    const G = joints(table().faces.boxes);
    expect(G.joints).toHaveLength(4);
    expect(G.anchored).toEqual([false, true, true, true, true]);
  });

  it('severing a leg drops the leg; the top stands on the other three', () => {
    const r = dismantle(table(), { sever: ['leg0'] });
    expect(r.bodies.map((b) => b.parts)).toEqual([['leg0']]);
    expect(r.statics.flatMap((s) => s.parts).sort()).toEqual(['leg1', 'leg2', 'leg3', 'top']);
  });

  it('severing the top drops it whole; sever all and every block goes its own way', () => {
    expect(dismantle(table(), { sever: ['top'] }).bodies.map((b) => b.parts)).toEqual([['top']]);
    expect(dismantle(table()).bodies).toHaveLength(5);
  });

  it('relief rides its host: a plank door\'s seams never fall on their own', () => {
    const o = door(), r = dismantle(o), thin = (i) => Math.min(...o.faces.boxes[i].h) * 2 < 0.024;
    expect(o.faces.boxes.some((_, i) => thin(i))).toBe(true);
    for (const body of r.bodies) expect(body.blocks.some((i) => !thin(i))).toBe(true);   // no body is relief alone
  });
});

describe('collapse: what comes loose', () => {
  const lowest = (body, f) => Math.min(...body.pieces.flatMap((p) => p.poly.faces.flatMap((x) => x.pts)).map((v) => f.pos[2] + rotate(f.quat, V.sub(v, body.centroid))[2]));

  it('the spread opens the lattice evenly: each chunk out from the centre by its own offset', () => {
    const r = cleave(door(), { pattern: 'grid', cell: 0.45 });
    const c = collapse(r.chunks, { mode: 'none', spread: { scale: 0.2, jitter: 0, twist: 0 } });
    r.chunks.forEach((k, i) => {
      const end = c.tracks[i].frames.at(-1).pos, want = V.add(k.centroid, V.mul(V.sub(k.centroid, c.centre), 0.2));
      expect(V.len(V.sub(end, want))).toBeLessThan(1e-4);
    });
  });

  for (const mode of ['passive', 'explode']) {
    it(`${mode}: every chunk of a diced door comes to rest on the ground, not in it`, () => {
      const r = cleave(door(), { pattern: 'grid', cell: 0.45 }), c = collapse(r.chunks, { mode });
      expect(c.tracks.every((t) => t.rest != null)).toBe(true);
      c.tracks.forEach((t, i) => expect(lowest(r.chunks[i], t.frames.at(-1))).toBeGreaterThan(-0.02));
    });
  }

  it('an explosion throws further than a passive collapse', () => {
    const r = cleave(door(), { pattern: 'voronoi', count: 12, seed: 7 });
    const reach = (mode) => { const c = collapse(r.chunks, { mode, power: 10 }); return c.tracks.reduce((a, t) => a + Math.hypot(t.frames.at(-1).pos[0] - c.centre[0], t.frames.at(-1).pos[1] - c.centre[1]), 0) / c.tracks.length; };
    expect(reach('explode')).toBeGreaterThan(reach('passive') * 2);
  });

  it('a dropped leg lands on the floor; a dropped top lands on its legs', () => {
    const t = table(), leg = dismantle(t, { sever: ['top'] });
    const c = collapse(leg.bodies, { statics: leg.statics, spread: false, mode: 'passive' });
    expect(c.tracks[0].frames.at(-1).pos[2]).toBeGreaterThan(0.7);   // caught on the legs' tops (0.72), not the floor
  });

  it('is seeded and stepped: the same in, the same timeline out', () => {
    const r = cleave(door(), { pattern: 'voronoi', count: 8, seed: 2 });
    expect(JSON.stringify(collapse(r.chunks, { mode: 'explode', seed: 5 }))).toBe(JSON.stringify(collapse(r.chunks, { mode: 'explode', seed: 5 })));
  });
});
