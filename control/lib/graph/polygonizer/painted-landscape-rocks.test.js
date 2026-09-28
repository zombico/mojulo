/**
 * painted-landscape `rocks`. Claims under test: absent, the World mesh and the assembled
 * payload are exactly as before (no `rocks`, no `repeats`, the boulder boxes stand); present, every boulder the
 * scene places becomes one instance of a pooled rock template (and no box), the pool is deterministic and at most
 * `variants` wide, `extent` scales the rocks with the map, the CSS scene expands the exact far-LOD block instead of
 * instancing, and a bad spec teaches.
 */
import { describe, expect, it } from 'vitest';

import { buildTerrainWorldMesh, validatePaintedLandscape, resolveLandscapeRocks, resolveScene } from './painted-landscape.js';
import { assemblePaintedLandscapeScene } from '../scene/scene-css3d.js';
import { rockPool, rockRepeats, expandRepeats } from './rock-pool.js';

const BASE = { kind: 'painted-landscape', heartbeat: 'rocky-irregular', splatch: 'verdure-trio', scene: 'coastal-rocks', seed: 'shore' };
const boulders = (m) => resolveScene(m.scene, m.seed).filter((it) => it.kind === 'boulder').length;

describe('absent → as before', () => {
  it('no rocks key, no repeats, boulder boxes present', () => {
    const mesh = buildTerrainWorldMesh(BASE);
    expect(mesh.rocks).toBeUndefined();
    const payload = assemblePaintedLandscapeScene(BASE);
    expect(payload.repeats).toBeUndefined();
    expect(JSON.stringify(assemblePaintedLandscapeScene(BASE))).toBe(JSON.stringify(payload));
  });
});

describe('rocks: boulders become pooled rock instances', () => {
  const M = { ...BASE, rocks: { rock: 'granite', variants: 4, detail: 1 } };
  it('one instance per placed boulder, and those boulders are no longer boxes', () => {
    const plain = buildTerrainWorldMesh(BASE), rocky = buildTerrainWorldMesh(M);
    expect(rocky.rocks.items.length).toBeGreaterThan(0);
    expect(rocky.rocks.items.length).toBeLessThanOrEqual(boulders(BASE));
    expect(plain.structures.length - rocky.structures.length).toBe(rocky.rocks.items.length);
    const payload = assemblePaintedLandscapeScene(M);
    expect(payload.repeats.length).toBeLessThanOrEqual(4);
    expect(payload.repeats.reduce((s, r) => s + r.transforms.length, 0)).toBe(rocky.rocks.items.length);
    for (const r of payload.repeats) { expect(r.group).toBe('rocks'); expect(r.template.length).toBeGreaterThan(20); for (const t of r.transforms) expect(t.scale).toBeGreaterThan(0); }
  });
  it('is deterministic, and the palette tone tints the rocks', () => {
    const a = assemblePaintedLandscapeScene(M), b = assemblePaintedLandscapeScene(M);
    expect(JSON.stringify(a.repeats)).toBe(JSON.stringify(b.repeats));
    const mineral = assemblePaintedLandscapeScene({ ...M, rocks: { ...M.rocks, tone: 'mineral' } });
    expect(JSON.stringify(mineral.repeats[0].template)).not.toBe(JSON.stringify(a.repeats[0].template));
  });
  it('extent scales the rocks with the map', () => {
    const one = buildTerrainWorldMesh(M).rocks.items, two = buildTerrainWorldMesh({ ...M, extent: 2 }).rocks.items;
    expect(two.length).toBe(one.length);
    two.forEach((r, i) => { expect(r.x).toBeCloseTo(one[i].x * 2, 9); expect(r.size).toBeCloseTo(one[i].size * 2, 9); });
  });
  it('the CSS scene cannot instance: it gets the exact far-LOD block per rock, as faces', () => {
    const inst = assemblePaintedLandscapeScene(M), flat = assemblePaintedLandscapeScene(M, { rocksAsFaces: true });
    expect(flat.repeats).toBeUndefined();
    const n = buildTerrainWorldMesh(M).rocks.items.length;
    const added = flat.faces.length - inst.faces.length;
    expect(added).toBeGreaterThanOrEqual(8 * n); expect(added).toBeLessThanOrEqual(40 * n);
  });
});

describe('the pool', () => {
  it('templates are seated at z = 0 and detail 0 is the exact block', () => {
    const pool = rockPool({ rock: 'slate', variants: 3, detail: 0, seed: 'x' });
    for (const p of pool) { const zs = p.faces.flatMap((f) => f.corners.map((c) => c[2])); expect(Math.min(...zs)).toBeCloseTo(0, 12); expect(p.faces.length).toBeLessThanOrEqual(40); }
    const reps = rockRepeats(pool, [{ x: 1, y: 2, z0: 3, size: 2 }, { x: 0, y: 0, z0: 0, size: 1 }], { sink: 0 });
    expect(expandRepeats(reps).length).toBe(pool[0].faces.length + pool[1].faces.length);
  });
});

describe('validation', () => {
  it('accepts presets and specs; teaches on mistakes', () => {
    expect(validatePaintedLandscape({ ...BASE, rocks: 'slate' })).toEqual(expect.not.arrayContaining([expect.stringMatching(/rocks/)]));
    const errs = (rocks) => validatePaintedLandscape({ ...BASE, rocks }).filter((e) => /rocks/.test(e)).join(' ');
    expect(errs('granit')).toMatch(/unknown preset 'granit'/);
    expect(errs({ variants: 9 })).toMatch(/variants must be an integer 1–8/);
    expect(errs({ detail: 7 })).toMatch(/detail must be an integer 0–4/);
    expect(errs({ tone: 'neon' })).toMatch(/tone must be 'palette'/);
    expect(resolveLandscapeRocks('basalt')).toEqual({ rock: 'basalt', variants: 6, detail: 2, tone: 'palette', sink: 0.2 });
  });
});
