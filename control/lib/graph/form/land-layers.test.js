/**
 * The land's layers (form/land-layers.js): the overlay's laws on the smallest ground that has each — a field of soil
 * with a block of rock in it and a strip of sand, and a trail across it.
 */
import { describe, expect, it } from 'vitest';

import { landLayers, LAYER_OF, FOOT, SAND_REACH, SMOOTH, PATH_EDGE } from './land-layers.js';

// a grid of 1.5 m quads over x, y in 0..45: rock where x < 6, sand where y < 3, soil elsewhere
const CELL = 1.5, N = 30;
function field({ trail = false } = {}) {
  const faces = [], cls = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i * CELL, y = j * CELL;
    faces.push({ corners: [[x, y, 0], [x + CELL, y, 0], [x + CELL, y + CELL, 0], [x, y + CELL, 0]] });
    cls.push(x < 6 ? 'cliff' : y < 3 ? 'sand' : 'soil');
  }
  // the trail: a ribbon 1.6 m wide along y = 18, a hand above the ground, in half-metre rows
  if (trail) for (let x = 8; x < 28; x += 0.5) { faces.push({ corners: [[x, 17.2, 0.04], [x + 0.5, 17.2, 0.04], [x + 0.5, 18.8, 0.04], [x, 18.8, 0.04]] }); cls.push('trail'); }
  return { faces, form: { faces: cls.map((c) => ({ cls: c })) } };
}
const sum = (w) => w.reduce((s, x) => s + x, 0);
// (off the grid the path is nowhere)
const maskAt = (M, x, y) => { const i = Math.round((x - M.origin[0]) / M.cell), j = Math.round((y - M.origin[1]) / M.cell); return i < 0 || j < 0 || i >= M.size[0] || j >= M.size[1] ? 0 : M.weight[j * M.size[0] + i]; };

describe('the land\'s layers', () => {
  it('a corner weighs its layers to one: rock where the geometry has it, scree fanning from its foot, soil between', () => {
    const { faces, form } = field(), L = landLayers(faces, form);
    for (const f of faces) for (const c of f.corners) expect(sum(L.weightAt(c))).toBeCloseTo(1, 9);
    expect(L.weightAt([1.5, 15, 0])[LAYER_OF.rock]).toBe(1);
    // the rock's edge a cell wide (x 6 is shared by rock and soil); past it scree, wearing out within FOOT metres (and
    // the smoothing's SMOOTH)
    const at = (x, y) => L.weightAt([x, y, 0]);
    expect(at(6, 22.5)[LAYER_OF.rock]).toBeGreaterThan(0);
    expect(at(6, 22.5)[LAYER_OF.rock]).toBeLessThan(1);
    expect(at(7.5, 22.5)[LAYER_OF.rock]).toBe(0);
    const scree = (x) => Array.from({ length: 16 }, (_, k) => at(x, 9 + k * CELL)[LAYER_OF.scree]);
    expect(Math.min(...scree(7.5))).toBeGreaterThan(0.3);
    expect(sum(scree(7.5))).toBeGreaterThan(sum(scree(10.5)));
    // past FOOT and SMOOTH metres the foot adds nothing: the scree there is the patches', as on the same field with no rock in it
    const bare = field(); bare.form.faces.forEach((f) => { if (f.cls === 'cliff') f.cls = 'soil'; });
    const B = landLayers(bare.faces, bare.form), far = 6 + Math.ceil((FOOT + SMOOTH) / CELL + 1) * CELL;
    expect(scree(far)).toEqual(Array.from({ length: 16 }, (_, k) => B.weightAt([far, 9 + k * CELL, 0])[LAYER_OF.scree]));
    expect(sum(scree(7.5))).toBeGreaterThan(sum(Array.from({ length: 16 }, (_, k) => B.weightAt([7.5, 9 + k * CELL, 0])[LAYER_OF.scree])));
  });

  it('sand blows up onto the soil and the soil creeps onto the beach, over metres and in tongues, not along an edge', () => {
    const { faces, form } = field(), L = landLayers(faces, form), sand = (x, y) => L.weightAt([x, y, 0])[LAYER_OF.sand];
    const xs = Array.from({ length: 14 }, (_, k) => 18 + k * CELL);
    // a cell up from the beach the soil is sandy along most of the border (where the reach wanders short it is not);
    // past SAND_REACH and SMOOTH none is
    expect(xs.filter((x) => sand(x, 4.5) > 0).length).toBeGreaterThan(xs.length / 2);
    for (const x of xs) expect(sand(x, 3 + Math.ceil((SAND_REACH + SMOOTH) / CELL + 1) * CELL)).toBe(0);
    // the beach's own top keeps some soil
    expect(Math.max(...xs.map((x) => L.weightAt([x, 1.5, 0])[LAYER_OF.soil]))).toBeGreaterThan(0);
    // how far up the sand reaches wanders along the beach
    const reach = xs.map((x) => { let y = 4.5; while (sand(x, y) > 0.02) y += CELL; return y; });
    expect(Math.max(...reach) - Math.min(...reach)).toBeGreaterThanOrEqual(CELL);
  });

  it('no trail, no mask: the bare island\'s path is absent', () => {
    const { faces, form } = field();
    expect(landLayers(faces, form).path).toBeNull();
  });

  it('the path is a mask at its own resolution: whole on the trail, worn out within PATH_EDGE of it, its edge ragged', () => {
    const { faces, form } = field({ trail: true }), M = landLayers(faces, form, { seed: 3 }).path;
    expect(M.cell).toBeLessThan(CELL / 4);
    for (let x = 9; x < 27; x += 0.25) {
      expect(maskAt(M, x, 18)).toBe(1);
      expect(maskAt(M, x, 18.8 + PATH_EDGE + M.cell)).toBe(0);
    }
    // how far past the trail's edge the path still shows, along it: it wanders (worn, not ruled)
    const reach = [];
    for (let x = 9; x < 27; x += 0.25) { let d = 0; while (maskAt(M, x, 18.8 + d + M.cell) > 0.02) d += M.cell; reach.push(d); }
    expect(Math.max(...reach) - Math.min(...reach)).toBeGreaterThan(0.25);
    expect(M.z[Math.round((18 - M.origin[1]) / M.cell) * M.size[0] + Math.round((15 - M.origin[0]) / M.cell)]).toBeCloseTo(0.04, 6);
  });

  it('seeded: the same faces give the same weights and mask, byte for byte', () => {
    const a = field({ trail: true }), b = field({ trail: true });
    const A = landLayers(a.faces, a.form, { seed: 3 }), B = landLayers(b.faces, b.form, { seed: 3 });
    expect(Buffer.from(A.path.weight.buffer).equals(Buffer.from(B.path.weight.buffer))).toBe(true);
    expect(a.faces.map((f) => A.weightAt(f.corners[0]))).toEqual(b.faces.map((f) => B.weightAt(f.corners[0])));
  });
});
