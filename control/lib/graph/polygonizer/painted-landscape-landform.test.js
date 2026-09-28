/**
 * painted-landscape `landform` (landforms.plan.md L3). Claims under test: absent, nothing moves (no scree, no sliced
 * terrain, the grid quads stand); present, every consumer reads the landform surface (the sampler under the still,
 * the World, structures), the World's terrain is the sliced face-aware mesh (triangles with per-corner colour, more
 * of them on the cliff), scree rides `repeats` as pooled rocks, the CSS scene keeps the plain grid and no scree,
 * `extent` scales the scree with the map, the raymarch refuses a baked surface (so the World falls back to the mesh),
 * it is deterministic, and a bad list teaches.
 */
import { describe, expect, it } from 'vitest';

import { buildTerrainWorldMesh, validatePaintedLandscape } from './painted-landscape.js';
import { assemblePaintedLandscapeScene } from '../scene/scene-css3d.js';
import { composeLandscapeRaymarch } from '../landscape/painted-landscape-raymarch.js';

const BASE = { kind: 'painted-landscape', heartbeat: 'gentle-roughness', splatch: 'verdure-trio', seed: 'cliffs' };
const CLIFF = [{ op: 'scarp', path: [[-14, -8], [14, -8]], throw: 3, side: 'right', rough: 0, taper: 0.1 }, { op: 'strata', thickness: 0.5 }, { op: 'talus', retreat: 0.35, scree: 0.3 }];
const M = { ...BASE, landform: CLIFF };
const quads = (faces) => faces.filter((f) => f.corners.length === 4 && !f.water).length;

describe('absent → as before', () => {
  it('no scree, no sliced terrain: the grid quads stand', () => {
    const mesh = buildTerrainWorldMesh(BASE);
    expect(mesh.scree).toBeUndefined();
    expect(mesh.faces.every((f) => f.corners.length === 4)).toBe(true);
    expect(assemblePaintedLandscapeScene(BASE).repeats).toBeUndefined();
  });
});

describe('landform', () => {
  it('every consumer reads it: the terrain carries the cliff', () => {
    const plain = buildTerrainWorldMesh(BASE), cliff = buildTerrainWorldMesh(M);
    expect(cliff.bounds.zRange[1] - cliff.bounds.zRange[0]).toBeGreaterThan(plain.bounds.zRange[1] - plain.bounds.zRange[0] + 2);
  });
  it('the World terrain is the sliced mesh: triangles with per-corner colour, dense on the face', () => {
    const { faces } = buildTerrainWorldMesh(M);
    const tris = faces.filter((f) => f.corners.length === 3);
    expect(quads(faces)).toBe(0);
    expect(tris.length).toBeGreaterThan(10000);
    for (const f of tris.slice(0, 500)) { expect(f.cornerFills).toHaveLength(4); expect(f.fill).toMatch(/^rgb\(/); }
    const onFace = tris.filter((f) => Math.abs(f.outNormal[2]) < 0.5).length;       // near-vertical triangles: the cliff
    expect(onFace).toBeGreaterThan(1000);
  });
  it('scree rides repeats as pooled rocks; the CSS scene keeps the grid and carries none', () => {
    const world = assemblePaintedLandscapeScene(M);
    const scree = world.repeats.filter((r) => r.group === 'scree');
    expect(scree.length).toBeGreaterThan(0); expect(scree.length).toBeLessThanOrEqual(5);
    expect(scree.reduce((n, r) => n + r.transforms.length, 0)).toBe(buildTerrainWorldMesh(M).scree.items.length);
    const css = assemblePaintedLandscapeScene(M, { rocksAsFaces: true, landformMesh: 'grid' });
    expect(css.repeats).toBeUndefined();
    expect(css.faces.filter((f) => f.corners.length === 3).length).toBe(0);
  });
  it('extent scales the scree with the map', () => {
    const one = buildTerrainWorldMesh(M).scree.items, two = buildTerrainWorldMesh({ ...M, extent: 2 }).scree.items;
    expect(two.length).toBe(one.length);
    two.forEach((r, i) => { expect(r.x).toBeCloseTo(one[i].x * 2, 9); expect(r.size).toBeCloseTo(one[i].size * 2, 9); });
  });
  it('is deterministic', () => {
    expect(JSON.stringify(assemblePaintedLandscapeScene(M))).toBe(JSON.stringify(assemblePaintedLandscapeScene(M)));
  });
  it('the raymarch refuses a baked surface, so the World falls back to the mesh', () => {
    expect(() => composeLandscapeRaymarch(M)).toThrow(/landform/);
    expect(() => composeLandscapeRaymarch({ ...BASE, erosion: true })).toThrow(/erosion/);
    expect(() => composeLandscapeRaymarch(BASE)).not.toThrow();
  });
  it('validation teaches', () => {
    expect(validatePaintedLandscape(M)).toEqual([]);
    const errs = validatePaintedLandscape({ ...BASE, landform: [{ op: 'mesa' }] }).join(' ');
    expect(errs).toMatch(/landform\[0\]\.op must be one of peaks, strata, scarp, joints, talus/);
    expect(validatePaintedLandscape({ ...BASE, landform: {} }).join(' ')).toMatch(/non-empty list/);
  });
});
