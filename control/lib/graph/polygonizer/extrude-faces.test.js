import { describe, expect, it } from 'vitest';

import { extrudeToFaces, validateExtrudes, DEFAULT_CORNER_SAMPLES } from './extrude-faces.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { auditClosure } from './face-closure.js';
import { unionShells, shellsToInstances } from '../scene/manifold-union.js';
import { printableShells, applyTransform } from '../scene/scene-stl.js';

const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);
const finiteVec = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const allWellFormed = (faces) => faces.every((f) => f.corners.length === 4 && f.corners.every(finiteVec) && isHex(f.fill) && f.doubleSided === true);

const vbox = (extra = {}) => ({ profile: { rect: { w: 4, h: 6 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 3 }, ...extra });

describe('extrudeToFaces — solid prism', () => {
  it('a sharp box → 4 walls + 2 end caps (4 corners, hex fills, doubleSided)', () => {
    const faces = extrudeToFaces(vbox());
    expect(faces.length).toBe(4 /* walls */ + 4 + 4 /* two 4-quad fans */);
    expect(allWellFormed(faces)).toBe(true);
  });

  it('a rounded-rect box scales with cornerSamples', () => {
    const M = 4 * DEFAULT_CORNER_SAMPLES;            // points around a rounded rect
    const faces = extrudeToFaces(vbox({ profile: { rect: { w: 4, h: 6, r: 1 } } }));
    expect(faces.length).toBe(M /* walls */ + M + M /* two fans */);
    expect(allWellFormed(faces)).toBe(true);
  });

  it('an arbitrary polygon profile (triangle) extrudes', () => {
    const tri = extrudeToFaces(vbox({ profile: { points: [[-2, -1], [2, -1], [0, 2]] } }));
    expect(tri.length).toBe(3 + 3 + 3);            // 3 walls + two 3-fan caps
    expect(allWellFormed(tri)).toBe(true);
  });

  it('caps:false drops the end caps', () => {
    expect(extrudeToFaces(vbox(), { caps: false }).length).toBe(4);
  });
});

describe('extrudeToFaces — concave profile caps (print-loop demo, 2026-09-08)', () => {
  // The desk-edge headphone hook's clamp: a C whose centroid sits in the open slot. The centroid fan
  // used to spill across the slot (a wedge in the web tier, NotManifold at export).
  const C = [[-6, 0], [25, 0], [25, 4], [0, 4], [0, 23], [25, 23], [25, 27], [-6, 27]];
  const clamp = () => extrudeToFaces({ profile: { points: C }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 30, z: 0 } });

  it('caps a C with n−2 ear triangles per end, closed, and unions as ONE manifold of area × length', async () => {
    const faces = clamp();
    expect(faces.length).toBe(8 /* walls */ + 6 + 6);
    expect(allWellFormed(faces)).toBe(true);
    expect(auditClosure(faces).holes).toEqual([]);
    const r = await unionShells(shellsToInstances(printableShells({ faces }), applyTransform));
    expect(r.stats.non_manifold).toEqual([]);
    expect(r.stats.unioned).toBe(1);
    expect(r.stats.genus).toBe(0);
    expect(r.stats.volume).toBeCloseTo(362 * 30, 3);
  });

  it('a convex profile keeps the centroid fan — first corner of every cap face is the centroid', () => {
    const faces = extrudeToFaces(vbox({ profile: { points: [[-2, -1], [2, -1], [0, 2]] } }));
    const caps = faces.slice(3);
    expect(caps.length).toBe(6);
    for (const f of caps) { expect(f.corners[0][0]).toBeCloseTo(0, 9); expect(f.corners[0][1]).toBeCloseTo(0, 9); }
  });
});

describe('extrudeToFaces — endProfile taper', () => {
  it('lerps the ring along the axis: a shrunk triangle → 3 walls + both caps', () => {
    const faces = extrudeToFaces(vbox({
      profile: { points: [[-2, -1], [2, -1], [0, 2]] },
      endProfile: { points: [[-1, -0.5], [1, -0.5], [0, 1]] },
    }));
    expect(faces.length).toBe(3 /* walls */ + 3 + 3 /* two 3-fan caps */);
    expect(allWellFormed(faces)).toBe(true);
  });

  it('a collapsed end ring pinches walls into triangles and drops the zero-area end cap', () => {
    const wedge = extrudeToFaces(vbox({
      profile: { points: [[-2, -1], [2, -1], [2, 1], [-2, 1]] },
      endProfile: { points: [[-2, -1], [2, -1], [2, -1], [-2, -1]] },   // roof ridge: top edge folds onto the bottom
    }));
    expect(wedge.length).toBe(4 /* walls (two pinched to triangles) */ + 4 /* start cap fan only */);
    expect(allWellFormed(wedge)).toBe(true);
  });

  it('is byte-identical to the plain prism when endProfile is absent', () => {
    expect(extrudeToFaces(vbox())).toEqual(extrudeToFaces(vbox()));
  });

  it('validateExtrudes gates count mismatch, rect profiles, and shells', () => {
    const axis = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 } };
    const tri = { points: [[0, 0], [1, 0], [0, 1]] };
    expect(validateExtrudes([{ ...axis, profile: tri, endProfile: { points: [[0, 0], [1, 0]] } }]).length).toBeGreaterThan(0);
    expect(validateExtrudes([{ ...axis, profile: { rect: { w: 2, h: 2 } }, endProfile: tri }]).length).toBeGreaterThan(0);
    expect(validateExtrudes([{ ...axis, profile: tri, endProfile: tri, wallThickness: 0.2 }]).length).toBeGreaterThan(0);
    expect(validateExtrudes([{ ...axis, profile: tri, endProfile: { points: [[0, 0], [0.5, 0], [0, 0.5]] } }]).length).toBe(0);
  });
});

describe('extrudeToFaces — recessed shell', () => {
  const shell = vbox({ profile: { rect: { w: 8, h: 15, r: 1.3 } }, axisTo: { x: 0, y: 0, z: 1.2 }, wallThickness: 0.5 });

  it('a rect tray → outer + inner + rim walls, inner floor, closed back', () => {
    const M = 4 * DEFAULT_CORNER_SAMPLES;
    const faces = extrudeToFaces(shell);
    expect(faces.length).toBe(3 * M /* outer+inner+rim per edge */ + M /* floor fan */ + M /* back fan */);
    expect(allWellFormed(faces)).toBe(true);
  });

  it('respects an explicit tint and is deterministic', () => {
    const faces = extrudeToFaces(shell, { tint: '#ff0000' });
    for (const f of faces.slice(0, 4 * DEFAULT_CORNER_SAMPLES)) {
      const r = parseInt(f.fill.slice(1, 3), 16), g = parseInt(f.fill.slice(3, 5), 16), b = parseInt(f.fill.slice(5, 7), 16);
      expect(r).toBeGreaterThanOrEqual(g); expect(r).toBeGreaterThanOrEqual(b);
    }
    expect(extrudeToFaces(shell)).toEqual(extrudeToFaces(shell));
  });

  it('the faces survive face-mesh triangulation', () => {
    const mesh = faceListToMesh(extrudeToFaces(shell));
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.radius).toBeGreaterThan(0);
  });
});

describe('validateExtrudes', () => {
  it('accepts a valid solid + shell', () => {
    expect(validateExtrudes([vbox(), vbox({ profile: { rect: { w: 8, h: 15, r: 1 } }, wallThickness: 0.5 })])).toEqual([]);
  });
  it('rejects a missing/blank profile, zero-length axis, and a shell on a polygon', () => {
    expect(validateExtrudes([{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 } }]).length).toBeGreaterThan(0);
    expect(validateExtrudes([vbox({ axisTo: { x: 0, y: 0, z: 0 } })]).length).toBeGreaterThan(0);
    expect(validateExtrudes([vbox({ profile: { points: [[0, 0], [1, 0], [0, 1]] }, wallThickness: 0.2 })]).some((e) => /only for a rect/.test(e))).toBe(true);
  });
});

describe('extrudeToFaces — print wrap (soda-product-shot, 2026-09-08)', () => {
  const wrapped = (extra = {}) => vbox({ wrap: { texture: 'xwrap_0', ...extra } });
  const walls = (faces) => faces.filter((f) => typeof f.texture === 'string');

  it('absent a wrap, no face carries uv / texture (byte-identical)', () => {
    const faces = extrudeToFaces(vbox());
    expect(faces.some((f) => f.uv || f.texture || f.island)).toBe(false);
    expect(JSON.stringify(extrudeToFaces(vbox({ wrap: null })))).toBe(JSON.stringify(faces));
  });

  it('a 4 × 6 box: the four walls carry uv spans proportional to their edge lengths; caps stay bare', () => {
    const faces = extrudeToFaces(wrapped());
    const w = walls(faces);
    expect(w.length).toBe(4);
    expect(faces.length - w.length).toBe(8);               // two 4-quad fans, untextured
    // perimeter 20: edges 6, 4, 6, 4 from the (+2, −3) corner → u breaks 0, .3, .5, .8, 1
    const spans = w.map((f) => [f.uv[0][0], f.uv[1][0]]);
    expect(spans.map((s) => s.map((x) => Number(x.toFixed(3))))).toEqual([[0, 0.3], [0.3, 0.5], [0.5, 0.8], [0.8, 1]]);
    for (const f of w) {
      expect(f.texture).toBe('xwrap_0');
      expect(f.island).toBe('wall');
      expect(f.uv.map((p) => p[1])).toEqual([0, 0, 1, 1]);   // v runs axisFrom → axisTo
      expect(f.textureLit).toBeUndefined();
    }
  });

  it('seam rotates u, repeat tiles it, lit marks the multiply-lit path', () => {
    const w = walls(extrudeToFaces(wrapped({ seam: 0.25, repeat: { u: 2, v: 3 }, lit: true })));
    expect(w[0].uv[0][0]).toBeCloseTo(0.5);                 // (0 + 0.25) × 2
    expect(w[0].uv[2][1]).toBe(3);
    expect(w[0].textureLit).toBe(true);
  });

  it('a rounded rect anchors u = 0 on the +x wall like a sharp one (panel order does not depend on r)', () => {
    const faces = extrudeToFaces(vbox({ profile: { rect: { w: 4, h: 6, r: 0.5 } }, wrap: { texture: 'xwrap_0' } }));
    const w = walls(faces);
    // the print starts (u = 0) on the +x FLAT wall — the profile's closing edge (last arc point →
    // point 0): every corner on the +x side, spanning the rect's straight run in y.
    const first = w.find((f) => Math.abs(f.uv[0][0]) < 1e-9);
    expect(first).toBeDefined();
    expect(first.corners.every((c) => c[0] > 1.9)).toBe(true);
    const ys = first.corners.map((c) => c[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(4.5);
    // every wall's u span is monotonic and the spans tile [0, 1] once
    const spans = w.map((f) => [f.uv[0][0], f.uv[1][0]]).sort((a, b) => a[0] - b[0]);
    for (const [a, b] of spans) expect(b).toBeGreaterThan(a);
    expect(spans[0][0]).toBeCloseTo(0, 9);
    expect(spans[spans.length - 1][1]).toBeCloseTo(1, 9);
    for (let i = 1; i < spans.length; i += 1) expect(spans[i][0]).toBeCloseTo(spans[i - 1][1], 9);
  });

  it('a shell wraps its OUTER walls only', () => {
    const w = walls(extrudeToFaces(wrapped({ wallThickness: 0.5 })));
    expect(w.length).toBe(4);
    const u = w.map((f) => f.uv[0][0]);
    expect(u).toEqual([...u].sort((a, b) => a - b));       // monotonic around the perimeter
  });
});
