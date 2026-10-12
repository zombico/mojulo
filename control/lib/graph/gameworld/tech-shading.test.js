import { describe, it, expect } from 'vitest';
import { smoothCorners, bakeCorners, isSmooth } from './tech-shading.js';
import { techReadout } from './tech-readout.js';
import { fitter, section } from './tech-chassis.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { faceListToMesh } from '../figures/face-mesh.js';

const drum = (sides, id = 'd', z = 0) => lowerObjectFaces({ kind: 'workbench', lathes: [{ id, axisFrom: { x: 0, y: 0, z }, axisTo: { x: 0, y: 0, z: z + 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], crossSections: 2, samples: sides, tint: '#808080' }] }).map((f) => ({ ...f, monomer: id }));
const k = (p) => p.map((v) => Math.round(v * 1e4)).join(',');
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('smoothing groups: the pixels do what polygons would', () => {
  it('a round shares its normals across soft edges; a cap\'s edge, a chamfer and another piece stay hard', () => {
    const S = smoothCorners(drum(16)), side = S.filter((f) => Math.abs(f.outNormal[2]) < 0.1), cap = S.find((f) => f.outNormal[2] > 0.9);
    // where two side faces meet, both give the corner the same normal, and it points straight out from the axis
    const at = new Map();
    for (const f of side) f.corners.forEach((p, i) => (at.get(k(p)) ?? at.set(k(p), []).get(k(p))).push(f.cornerNormals[i]));
    for (const ns of at.values()) { expect(ns.length).toBeGreaterThanOrEqual(2); for (const n of ns) expect(n).toEqual(ns[0]); expect(Math.abs(ns[0][2])).toBeLessThan(1e-3); }
    // the cap is flat: every corner its own face normal (90° to the side is past the crease)
    for (const n of cap.cornerNormals) expect(dot(n, cap.outNormal)).toBeGreaterThan(0.999);
    // a chamfered section's 45° corners are hard
    const box = lowerObjectFaces({ kind: 'workbench', lofts: [{ id: 'b', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, stations: [{ t: 0, profile: { points: section('faceted', 2, 2) } }, { t: 1, profile: { points: section('faceted', 2, 2) } }] }] }).map((f) => ({ ...f, monomer: 'b' }));
    for (const f of smoothCorners(box)) for (const n of f.cornerNormals) expect(dot(n, f.outNormal)).toBeGreaterThan(0.999);
    // two pieces touching do not smooth into each other
    const two = smoothCorners([...drum(16, 'a'), ...drum(16, 'b', 2)]).filter((f) => f.monomer === 'a' && f.outNormal[2] > 0.9);
    for (const f of two) for (const n of f.cornerNormals) expect(n[2]).toBeGreaterThan(0.999);
    expect(JSON.stringify(smoothCorners(drum(16)))).toBe(JSON.stringify(smoothCorners(drum(16))));
  });

  it('the export writes each corner\'s normal; a face list without them exports as it did', () => {
    const flat = drum(12), smooth = smoothCorners(flat);
    const a = faceListToMesh(flat, { decollide: false, withNormals: true }), b = faceListToMesh(smooth, { decollide: false, withNormals: true });
    expect(b.positions).toEqual(a.positions);
    expect(b.normals).not.toEqual(a.normals);
    // the vertices of one side triangle no longer share one normal
    const tri = (N, i) => [0, 1, 2].map((j) => [...N.slice((i * 3 + j) * 3, (i * 3 + j) * 3 + 3)].map((v) => Math.round(v * 1e3)).join());
    const sideTri = [...Array(a.positions.length / 9).keys()].find((i) => Math.abs(a.normals[i * 9 + 2]) < 0.1);
    expect(new Set(tri(a.normals, sideTri)).size).toBe(1);
    expect(new Set(tri(b.normals, sideTri)).size).toBeGreaterThan(1);
    expect(faceListToMesh(flat, { decollide: false })).toEqual(faceListToMesh(flat, { decollide: false }));
    expect(faceListToMesh(flat, { decollide: false }).normals).toBeFalsy();
  });

  it('light baked per corner runs across a round', () => {
    const B = bakeCorners(smoothCorners(drum(16)), { base: () => '#808080' });
    const side = B.find((f) => Math.abs(f.outNormal[2]) < 0.1 && f.outNormal[1] < -0.5);
    expect(new Set(side.cornerFills).size).toBeGreaterThan(1);
    expect(isSmooth(B)).toBe(true);
    expect(isSmooth(drum(16))).toBe(false);
  });

  it('shaded smooth, a round is held to its outline; it spends its points where its curve is tight', () => {
    const at = (faces) => techReadout(faces, { tier: 'machine', rank: 'prop' }).facetLaw;
    expect(at(drum(16))).toMatchObject({ measure: 'width' });
    const s16 = at(smoothCorners(drum(16))), s32 = at(smoothCorners(drum(32)));
    expect(s16.measure).toBe('outline');
    // the outline's error falls as the square of the sides
    expect(s16.value / s32.value).toBeGreaterThan(3.5);
    // a big gentle round needs fewer points for its outline than for its facets' width; a tight one needs some
    const outline = fitter(553, 40, 1, 1.5), width = fitter(553, 40);
    expect(outline.fit(1.2)).toBeLessThan(width.fit(1.2));
    expect(outline.fit(1.2) / 1.2).toBeLessThan(outline.fit(0.2) / 0.2);
  });
});
