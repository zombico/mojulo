import { describe, expect, it } from 'vitest';

import { sweepToFaces, validateSweeps, DEFAULT_SIDES } from './sweep-faces.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { unionShells, shellsToInstances } from '../scene/manifold-union.js';
import { printableShells, applyTransform } from '../scene/scene-stl.js';

const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);
const finiteVec = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const wellFormed = (faces) => faces.every((f) => f.corners.length === 4 && f.corners.every(finiteVec) && isHex(f.fill) && f.doubleSided === true);

// a straight 2-point path → a cylinder
const straight = { path: [[0, 0, 0], [0, 0, 5]], radius: 0.5, sides: 8 };
// a helix → the twist stress-test
const helix = (() => { const p = []; for (let i = 0; i <= 60; i += 1) { const a = (i / 60) * 6 * Math.PI; p.push([2 * Math.cos(a), 2 * Math.sin(a), i / 6]); } return { path: p, radius: 0.4, sides: 10 }; })();

describe('sweepToFaces', () => {
  it('a straight path → (segments × sides) wall quads + two end-cap fans', () => {
    const faces = sweepToFaces(straight);
    expect(faces.length).toBe(1 * 8 /* walls */ + 8 + 8 /* two fans */);
    expect(wellFormed(faces)).toBe(true);
  });

  it('caps:false drops the end caps', () => {
    expect(sweepToFaces({ ...straight, caps: false }).length).toBe(8);
  });

  it('a multi-segment path scales with segments × sides', () => {
    const path = [[0, 0, 0], [1, 0, 1], [2, 0, 0], [3, 0, 1]]; // 3 segments
    const faces = sweepToFaces({ path, radius: 0.3, sides: 6, caps: false });
    expect(faces.length).toBe(3 * 6);
  });

  it('a 6-turn helix stays finite (rotation-minimizing frames, no NaN/flip)', () => {
    const faces = sweepToFaces(helix);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) for (const c of f.corners) expect(finiteVec(c)).toBe(true);
  });

  it('respects an explicit tint and is deterministic', () => {
    const faces = sweepToFaces(straight, { tint: '#00ff00' });
    for (const f of faces) {
      const r = parseInt(f.fill.slice(1, 3), 16), g = parseInt(f.fill.slice(3, 5), 16), b = parseInt(f.fill.slice(5, 7), 16);
      expect(g).toBeGreaterThanOrEqual(r); expect(g).toBeGreaterThanOrEqual(b);
    }
    expect(sweepToFaces(helix)).toEqual(sweepToFaces(helix));
  });

  it('uses DEFAULT_SIDES when sides is omitted', () => {
    const faces = sweepToFaces({ path: [[0, 0, 0], [0, 0, 4]], radius: 0.5, caps: false });
    expect(faces.length).toBe(1 * DEFAULT_SIDES);
  });

  it('the faces survive face-mesh triangulation', () => {
    const mesh = faceListToMesh(sweepToFaces(helix));
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.radius).toBeGreaterThan(0);
  });
});

describe('sweepToFaces — a consistently outward-wound shell (print-loop demo, 2026-09-08)', () => {
  // Both end caps used to share one winding, so the start lid was inside-out: every edge had two
  // triangles but one ring's worth ran the same way twice. Invisible unlit and double-sided;
  // NotManifold to Manifold; culled by an engine.
  it('a straight sweep unions as ONE manifold with the volume of a 24-gon prism', async () => {
    const faces = sweepToFaces({ path: [[3, 15, 8], [46, 15, 8]], radius: 5, sides: 24 });
    const r = await unionShells(shellsToInstances(printableShells({ faces }), applyTransform));
    expect(r.stats.non_manifold).toEqual([]);
    expect(r.stats.unioned).toBe(1);
    expect(r.stats.genus).toBe(0);
    const polygonArea = 0.5 * 24 * 5 * 5 * Math.sin((2 * Math.PI) / 24);
    expect(r.stats.volume).toBeCloseTo(polygonArea * 43, 3);
  });

  it('a bent sweep (the headphone hook arm) is one manifold too', async () => {
    const faces = sweepToFaces({ path: [[3, 15, 8], [46, 15, 8], [48.5, 15, 8.7], [50.3, 15, 10.6], [51, 15, 13], [51, 15, 22]], radius: 5, sides: 24 });
    const r = await unionShells(shellsToInstances(printableShells({ faces }), applyTransform));
    expect(r.stats.non_manifold).toEqual([]);
    expect(r.stats.unioned).toBe(1);
    expect(r.stats.volume).toBeGreaterThan(0);
  });
});

describe('validateSweeps', () => {
  it('accepts valid sweeps', () => {
    expect(validateSweeps([straight, helix])).toEqual([]);
  });
  it('rejects a too-short path, a degenerate (coincident) path, and a non-positive radius', () => {
    expect(validateSweeps([{ path: [[0, 0, 0]], radius: 0.5 }]).length).toBeGreaterThan(0);
    expect(validateSweeps([{ path: [[1, 1, 1], [1, 1, 1]], radius: 0.5 }]).some((e) => /zero length/.test(e))).toBe(true);
    expect(validateSweeps([{ path: [[0, 0, 0], [0, 0, 1]], radius: 0 }]).some((e) => /radius/.test(e))).toBe(true);
  });
});
