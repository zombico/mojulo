/**
 * painted-landscape `plants`. Claims under test: absent, the World mesh and the assembled payload are exactly as
 * before; present, every tree the scene places becomes one instance of a grown plant pool (and no taiji box), a cone
 * and a canopy can be different species (a palm, a bamboo culm), each instance's level of detail follows the size it
 * projects to from the nearest bookmark within a draw budget (a few dozen trees take the cap), `extent` scales the plants with the map, the CSS scene (which cannot instance)
 * is exactly the landscape without plants, the result is deterministic, and a bad spec teaches.
 */
import { describe, expect, it } from 'vitest';

import { buildTerrainWorldMesh, validatePaintedLandscape, resolveLandscapePlants, resolveScene } from './painted-landscape.js';
import { assemblePaintedLandscapeScene } from '../scene/scene-css3d.js';
import { plantPool, plantRepeats } from '../vegetation/pool.js';

const BASE = { kind: 'painted-landscape', heartbeat: 'chop', splatch: 'verdure-trio', scene: 'pine-forest', seed: 'grove' };
const trees = (m) => resolveScene(m.scene, m.seed).filter((it) => it.kind === 'cone' || it.kind === 'canopy').length;
const count = (items) => Object.values(items).reduce((s, l) => s + l.length, 0);
// the level an item was given: its transform's position picks it out of the repeats
const levelOf = (placed, it) => placed.repeats.find((r) => r.transforms.some((t) => t.pos[0] === it.x && t.pos[1] === it.y))?.group.split('-').at(-1);

describe('absent → as before', () => {
  it('no plants key, no repeats, the taiji trees stand', () => {
    const mesh = buildTerrainWorldMesh(BASE); expect(mesh.plants).toBeUndefined();
    const payload = assemblePaintedLandscapeScene(BASE); expect(payload.repeats).toBeUndefined();
    expect(JSON.stringify(assemblePaintedLandscapeScene({ ...BASE, plants: null }))).toBe(JSON.stringify(payload));
  });
});

describe('plants: the scene trees are grown', () => {
  const M = { ...BASE, plants: { cone: 'fir', canopy: 'oak', variants: 2, level: 'L2' } };
  it('one instance per placed tree, and those trees are no longer boxes', () => {
    const plain = buildTerrainWorldMesh(BASE), grown = buildTerrainWorldMesh(M);
    const n = count(grown.plants.items); expect(n).toBeGreaterThan(0); expect(n).toBeLessThanOrEqual(trees(BASE));
    expect(plain.structures.length - grown.structures.length).toBe(n);
    const payload = assemblePaintedLandscapeScene(M);
    expect(payload.repeats.reduce((s, r) => s + r.transforms.length, 0)).toBe(n);
    for (const r of payload.repeats) { expect(r.group).toMatch(/^(fir|oak)-L[0-3]$/); expect(r.template.length).toBeGreaterThan(20); }
    expect(payload.faces.length).toBeLessThan(assemblePaintedLandscapeScene(BASE).faces.length);
  });
  it('a few dozen trees take the cap everywhere (the draw budget spends on the nearest first), never above it', () => {
    const levels = new Set(assemblePaintedLandscapeScene(M).repeats.map((r) => r.group.split('-').at(-1)));
    expect([...levels]).toEqual(['L2']);
    const low = new Set(assemblePaintedLandscapeScene({ ...M, plants: { ...M.plants, level: 'L1' } }).repeats.map((r) => r.group.split('-').at(-1)));
    expect([...low]).toEqual(['L1']);
  });
  it('without a budget each level follows the size it projects to from the nearest bookmark; with a small one, the nearest step up first', () => {
    const items = resolveScene(BASE.scene, BASE.seed).filter((it) => it.kind === 'cone').map((it) => ({ x: it.x, y: it.y, z0: 0, height: it.height }));
    const pool = plantPool({ species: 'fir', variants: 2, seed: 't', maxLevel: 'L2' });
    const eye = [0, 12, 2.5], eyes = [{ pos: eye, focalPx: 740 }];
    const plain = plantRepeats(pool, items, { eyes, level: 'L2' });
    expect(Object.values(plain.stats.byLevel).filter((n) => n > 0).length).toBeGreaterThan(1);
    const far = [{ pos: [0, 400, 50], focalPx: 740 }];
    expect(plantRepeats(pool, items, { eyes: [...far, ...eyes], level: 'L2' }).stats.byLevel).toEqual(plain.stats.byLevel);   // the nearest bookmark decides
    const some = plantRepeats(pool, items, { eyes, level: 'L2', budget: plain.stats.drawnFaces + 3 * (pool.variants[0].levels.L2.length - pool.variants[0].levels.L1.length) });
    expect(some.stats.drawnFaces).toBeLessThanOrEqual(plain.stats.drawnFaces + 3 * (pool.variants[0].levels.L2.length - pool.variants[0].levels.L1.length));
    expect(some.stats.byLevel.L2).toBeGreaterThan(plain.stats.byLevel.L2);
    const px = (it) => (it.height * 740) / Math.hypot(it.x - eye[0], it.y - eye[1], it.height / 2 - eye[2]);
    const biggest = items.reduce((a, b) => (px(b) > px(a) ? b : a));
    expect(levelOf(some, biggest)).toBe('L2');
  });
  it('grows palms and bamboo culms as well, the culm and its foliage as two templates', () => {
    const palms = assemblePaintedLandscapeScene({ ...BASE, plants: { cone: 'date', canopy: 'coconut', variants: 2 } });
    expect(palms.repeats.every((r) => /^(date|coconut)-L[0-3]$/.test(r.group))).toBe(true);
    const bamboo = assemblePaintedLandscapeScene({ ...BASE, plants: { cone: 'moso', canopy: 'moso', variants: 1 } });
    const groups = new Set(bamboo.repeats.map((r) => r.group.replace(/-L[0-3]$/, '')));
    expect(groups).toEqual(new Set(['moso-culm', 'moso-foliage']));
  });
  it('is deterministic, and extent scales the plants with the map', () => {
    expect(JSON.stringify(assemblePaintedLandscapeScene(M).repeats)).toBe(JSON.stringify(assemblePaintedLandscapeScene(M).repeats));
    const one = buildTerrainWorldMesh(M).plants.items.cone, two = buildTerrainWorldMesh({ ...M, extent: 2 }).plants.items.cone;
    two.forEach((r, i) => { expect(r.x).toBeCloseTo(one[i].x * 2, 9); expect(r.height).toBeCloseTo(one[i].height * 2, 9); });
  });
  it('leaves the CSS scene exactly as without plants (it cannot instance)', () => {
    expect(JSON.stringify(assemblePaintedLandscapeScene(M, { rocksAsFaces: true }))).toBe(JSON.stringify(assemblePaintedLandscapeScene(BASE, { rocksAsFaces: true })));
  });
});

describe('validation', () => {
  it('accepts species and specs; teaches on mistakes', () => {
    expect(validatePaintedLandscape({ ...BASE, plants: 'beech' }).filter((e) => /plants/.test(e))).toEqual([]);
    const errs = (plants) => validatePaintedLandscape({ ...BASE, plants }).filter((e) => /plants/.test(e)).join(' ');
    expect(errs('baobab')).toMatch(/must be a species: oak/);
    expect(errs({ canopy: 'palm' })).toMatch(/plants.canopy must be a species/);
    expect(errs({ variants: 9 })).toMatch(/variants must be an integer 1–6/);
    expect(errs({ level: 'L9' })).toMatch(/level must be one of L0/);
    expect(resolveLandscapePlants('fir')).toEqual({ canopy: 'fir', cone: 'fir', tuft: null, variants: 3, level: 'L2' });
    expect(resolveLandscapePlants('spruce')).toEqual({ canopy: 'spruce', cone: 'spruce', tuft: null, variants: 3, level: 'L2' });   // a conifer's name alone names both
    expect(resolveLandscapePlants(true)).toEqual({ canopy: 'oak', cone: 'fir', tuft: null, variants: 3, level: 'L2' });
  });
});
