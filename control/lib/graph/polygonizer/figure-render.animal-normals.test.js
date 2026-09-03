/**
 * Authored outward normals on the animal World/export form
 * (blenderish-animals.plan.md quick win).
 *
 * animalWorldFaces carries litFaces' centre-oriented normal as `outNormal` on
 * every body face, so facesToGlb writes a NORMAL attribute and the Blender
 * worker bakes against authored normals instead of rebuilding from winding
 * (local-blender-worker.md Principle 1). Flat per-face for now — phase 2
 * replaces it with field-gradient vertex normals.
 */
import { describe, expect, it } from 'vitest';

import { animalWorldFaces } from './figure-render.js';
import { facesToGlb } from '../scene/scene-gltf.js';

describe('animalWorldFaces — authored outward normals', () => {
  it('every untextured body face carries a unit-ish outNormal', () => {
    const { faces } = animalWorldFaces({ archetype: 'canine', opts: { skin: true } });
    expect(faces.length).toBeGreaterThan(0);
    const untextured = faces.filter((f) => typeof f.texture !== 'string');
    for (const f of untextured) {
      expect(Array.isArray(f.outNormal)).toBe(true);
      const [x, y, z] = f.outNormal;
      expect(Math.hypot(x, y, z)).toBeGreaterThan(0.5);
      expect(Math.hypot(x, y, z)).toBeLessThan(1.5);
    }
  });

  it('outNormal points outward from the face centroid ring centre (dorsal faces look up)', () => {
    const { faces } = animalWorldFaces({ archetype: 'canine', opts: { skin: true } });
    // topmost decile of faces by centroid z should mostly have +z normals (the
    // decile also catches ear/skull side walls, so this is a direction sanity
    // check, not a precision gate)
    const withZ = faces
      .filter((f) => Array.isArray(f.outNormal))
      .map((f) => ({ cz: f.corners.reduce((s, p) => s + p[2], 0) / f.corners.length, nz: f.outNormal[2] }))
      .sort((a, b) => b.cz - a.cz);
    const top = withZ.slice(0, Math.floor(withZ.length / 10));
    const up = top.filter((f) => f.nz > 0).length;
    expect(up / top.length).toBeGreaterThan(0.7);
  });

  it('the exported GLB carries a NORMAL attribute', () => {
    const { faces } = animalWorldFaces({ archetype: 'canine', opts: { skin: true } });
    const out = facesToGlb({ faces }, { generator: 'test' });
    const json = Buffer.from(out.bytes).toString('latin1');
    expect(json.includes('"NORMAL"')).toBe(true);
  });
});
