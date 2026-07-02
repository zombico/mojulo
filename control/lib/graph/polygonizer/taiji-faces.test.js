import { describe, expect, it } from 'vitest';

import { taijiToFaces, FACE_SAMPLES, FACE_CROSS_SECTIONS } from './taiji-faces.js';
import { plantToFaces } from './plant-faces.js';
import { faceListToMesh } from '../figures/face-mesh.js';

const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);
const finiteVec = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

describe('taijiToFaces', () => {
  const capsule = { yin: { x: 0, y: 0, z: 0 }, yang: { x: 0, y: 0, z: 4 }, radius: 0.4, profile: 'capsule', twist: 0 };

  it('meshes a capsule tube into 4-corner quads with hex fills', () => {
    const faces = taijiToFaces(capsule);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) {
      expect(f.corners).toHaveLength(4);
      expect(f.corners.every(finiteVec)).toBe(true);
      expect(isHex(f.fill)).toBe(true);
      expect(f.doubleSided).toBe(true);
    }
  });

  it('emits ~crossSections × samples wall quads for a capsule', () => {
    const faces = taijiToFaces(capsule);
    // walls only (no caps): cs rings of (samples) quads each
    expect(faces.length).toBe(FACE_CROSS_SECTIONS * FACE_SAMPLES);
  });

  it('honours an explicit mesh-density override', () => {
    const faces = taijiToFaces(capsule, { crossSections: 5, samples: 12 });
    expect(faces.length).toBe(5 * 12);
  });

  it('is deterministic (same spec → identical faces)', () => {
    expect(taijiToFaces(capsule)).toEqual(taijiToFaces(capsule));
  });

  it('a spindle (R→0 tips) emits no degenerate-NaN faces', () => {
    const spindle = { yin: { x: 0, y: 0, z: 0 }, yang: { x: 0, y: 0, z: 2 }, radius: 0.5, profile: 'spindle', twist: 0.4 };
    const faces = taijiToFaces(spindle);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) for (const c of f.corners) expect(finiteVec(c)).toBe(true);
  });

  it('the faces survive face-mesh triangulation into the WebGL buffer', () => {
    const mesh = faceListToMesh(taijiToFaces(capsule));
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.positions.length % 3).toBe(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.radius).toBeGreaterThan(0);
  });
});

describe('plantToFaces', () => {
  const tree = {
    form: 'tree', base: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 0, z: 6 },
    depth: 1, branches: 4, foliage: 'cluster',
  };

  it('a "trunk + 1 branch pass + leaf hat" tree compiles to a bounded baked mesh', () => {
    const faces = plantToFaces(tree);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) {
      expect(f.corners).toHaveLength(4);
      expect(isHex(f.fill)).toBe(true);
    }
    // budget sanity: the light spec should stay well under a few hundred faces.
    expect(faces.length).toBeLessThan(600);
  });

  it('is deterministic', () => {
    expect(plantToFaces(tree)).toEqual(plantToFaces(tree));
  });

  it('renders every foliage mode without error', () => {
    for (const foliage of ['cluster', 'leaves', 'conifer', false]) {
      const faces = plantToFaces({ ...tree, foliage });
      expect(faces.length).toBeGreaterThan(0);
      expect(faces.every((f) => f.corners.length === 4)).toBe(true);
    }
  });

  const greens = (faces) => new Set(faces.map((f) => f.fill).filter((h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return g > r + 8 && g > b + 8;
  }));

  it('cycles a green palette across canopy blobs (more than one green) by default', () => {
    // many distinct green shades = palette applied + per-face Lambert; with the
    // palette OFF the canopy collapses toward a single base green's shades.
    const withPalette = greens(plantToFaces(tree)).size;
    const noPalette = greens(plantToFaces(tree, { foliagePalette: null })).size;
    expect(withPalette).toBeGreaterThan(noPalette);
  });

  it('leaves the brown trunk untouched by the foliage palette', () => {
    const faces = plantToFaces(tree);
    const browns = faces.filter((f) => {
      const r = parseInt(f.fill.slice(1, 3), 16), g = parseInt(f.fill.slice(3, 5), 16), b = parseInt(f.fill.slice(5, 7), 16);
      return r > g && g > b; // brown: r>g>b
    });
    expect(browns.length).toBeGreaterThan(0);
  });

  const browns = (faces) => new Set(faces.map((f) => f.fill).filter((h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return r >= g && g >= b && r - b > 14;
  }));

  it('barkTint forces a different trunk colour, leaving the canopy greens intact', () => {
    const a = plantToFaces(tree, { barkTint: '#5e4626' });
    const b = plantToFaces(tree, { barkTint: '#7a5a33' });
    // trunk shades differ between the two bark choices…
    expect(browns(a)).not.toEqual(browns(b));
    // …but the canopy greens are identical (bark doesn't touch foliage)
    expect(greens(a)).toEqual(greens(b));
  });

  it('auto-picks bark per anchor position, so trees at different spots differ', () => {
    const here = plantToFaces({ ...tree, base: { x: 0, y: 0, z: 0 }, tip: { x: 0, y: 0, z: 6 } });
    const there = plantToFaces({ ...tree, base: { x: 20, y: 7, z: 0 }, tip: { x: 20, y: 7, z: 6 } });
    expect(browns(here)).not.toEqual(browns(there));
  });

  it('barkPalette:null keeps the original uniform trunk brown', () => {
    const def = plantToFaces({ ...tree, base: { x: 20, y: 7, z: 0 }, tip: { x: 20, y: 7, z: 6 } });
    const off = plantToFaces({ ...tree, base: { x: 20, y: 7, z: 0 }, tip: { x: 20, y: 7, z: 6 } }, { barkPalette: null });
    expect(browns(def)).not.toEqual(browns(off)); // auto-pick changed it; null restores base brown
  });
});
