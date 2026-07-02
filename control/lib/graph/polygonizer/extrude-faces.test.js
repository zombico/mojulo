import { describe, expect, it } from 'vitest';

import { extrudeToFaces, validateExtrudes, DEFAULT_CORNER_SAMPLES } from './extrude-faces.js';
import { faceListToMesh } from '../figures/face-mesh.js';

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
