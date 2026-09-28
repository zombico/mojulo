/**
 * The terrain world's assembler and page channel. Claims under test: the live payload
 * carries the recipe (kernel source, grids, quadtree root, LOD knobs) and no terrain faces; everything else gets the
 * baked world (sliced triangles with per-corner colour, grouped 'terrain-bake'); the walk stands at eye height on the
 * kernel's ground; the World page carries the channel and drops the bake; a page without `terrain` has none of it;
 * the channel script compiles; places sit at the lowest ground under their footprint less `sink`; scree rides
 * `repeats`; the manifest teaches.
 */
import { describe, expect, it } from 'vitest';

import { assembleTerrainWorld, terrainPlacements, validateTerrainWorld, TERRAIN_LOD_DEFAULTS } from './terrain-world.js';
import { terrainField } from './terrain-field.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { terrainChannelScript } from '../scene/channels/terrain-lod.js';

const FROM = { heartbeat: 'gentle-roughness', splatch: 'verdure-trio', seed: 'tw',
  landform: [{ op: 'scarp', path: [[-16, -6], [16, -9]], throw: 4, side: 'right' }, { op: 'strata', thickness: 0.6 }, { op: 'talus', retreat: 0.35, scree: 0.2 }] };
const M = { kind: 'terrain', from: FROM };

describe('the live payload carries the recipe, not the mesh', () => {
  const live = assembleTerrainWorld(M, { live: true });
  it('channel: kernel source, grids, a power-of-two root of minSize leaves, the LOD knobs', () => {
    expect(live.faces).toEqual([]);
    expect(live.terrain.kernel).toMatch(/^function terrainKernel\(K\)/);
    expect(Object.keys(live.terrain.K.grids)).toEqual(['hq', 'hard', 'apron']);
    const r = live.terrain.root.size / TERRAIN_LOD_DEFAULTS.minSize; expect(Math.log2(r) % 1).toBe(0);
    expect(live.terrain.root.size).toBeGreaterThanOrEqual(3000 * TERRAIN_LOD_DEFAULTS.horizonScale);
    expect(live.terrain.maxChunks).toBe(TERRAIN_LOD_DEFAULTS.maxChunks);
  });
  it('the walk stands at eye height on the ground; three bookmarks; the sky and haze', () => {
    const f = terrainField(M); const [x, y, z] = live.walk.spawn;
    expect(z - f.groundAt(x, y)).toBeCloseTo(1.7, 9);
    expect(live.cameras.map((c) => c.name)).toEqual(['ground', 'aerial', 'world']);
    expect(live.haze.density).toBeGreaterThan(0); expect(live.sky.zenith).toHaveLength(3);
  });
  it('scree rides repeats as pooled boulders', () => {
    expect(live.repeats.length).toBeGreaterThan(0); expect(live.repeats.length).toBeLessThanOrEqual(5);
    for (const r of live.repeats) { expect(r.group).toBe('scree'); for (const t of r.transforms) { expect(t.scale).toBeGreaterThanOrEqual(0.5); expect(t.scale).toBeLessThanOrEqual(6); } }
  });
});

describe('exports get the baked world', () => {
  it('sliced triangles with per-corner colour, grouped terrain-bake, denser on the escarpment', () => {
    const { faces } = assembleTerrainWorld(M);
    expect(faces.length).toBeGreaterThan(8000);
    for (const f of faces.slice(0, 300)) { expect(f.group).toBe('terrain-bake'); expect(f.corners).toHaveLength(3); expect(f.cornerFills).toHaveLength(4); }
    expect(faces.filter((f) => Math.abs(f.outNormal[2]) < 0.5).length).toBeGreaterThan(300);
  });
});

describe('the World page', () => {
  it('carries the channel and drops the bake', () => {
    const p = assembleTerrainWorld(M);
    const html = emitThreeWorld({ ...p, hud: false });
    expect(html).toContain('window.__mojTerrain');
    const without = emitThreeWorld({ ...p, terrain: null, hud: false });
    expect(without).not.toContain('__mojTerrain');
    expect(html.length).toBeLessThan(without.length);               // the bake's faces are not in the live page
  });
  it('the channel script compiles', () => {
    const p = assembleTerrainWorld(M, { live: true });
    expect(() => new Function('THREE', 'scene', 'camera', 'walkColliders', terrainChannelScript(p.terrain))).not.toThrow();   // eslint-disable-line no-new-func
  });
});

describe('places stand on the ground', () => {
  it('at the lowest ground under the footprint, less sink', () => {
    const f = terrainField(M);
    const [rec] = terrainPlacements(f, [{ ref: 'sk_x', at: [100, -300], size: [40, 20], sink: 1.5, facing: 'E', name: 'tower' }]);
    let lo = Infinity; for (const [u, v] of [[0, 0], [-20, -10], [20, -10], [-20, 10], [20, 10]]) lo = Math.min(lo, f.groundAt(100 + u, -300 + v));
    expect(rec).toEqual({ ref: 'sk_x', name: 'tower', center: [100, -300], z: lo - 1.5, size: [40, 20], facing: 'E' });
    expect(assembleTerrainWorld({ ...M, place: [{ ref: 'sk_x', at: [0, 0] }] }, { live: true }).itemRefs).toHaveLength(1);
  });
});

describe('validation teaches', () => {
  it('names the mistake', () => {
    expect(validateTerrainWorld(M)).toEqual([]);
    expect(validateTerrainWorld({ kind: 'terrain', from: { ref: 'sk_a' } })).toEqual([]);
    const e = (m) => validateTerrainWorld({ ...M, ...m }).join(' ');
    expect(e({ spawn: [1] })).toMatch(/spawn must be \[x, y\]/);
    expect(e({ lod: { minSize: 1 } })).toMatch(/minSize must be 4–4096/);
    expect(e({ place: [{ at: [0, 0] }] })).toMatch(/place\[0\]\.ref must name a stored sketch/);
    expect(e({ place: [{ ref: 'a', at: [0, 0], facing: 'up' }] })).toMatch(/facing must be N, E, S or W/);
  });
});

describe('planet', () => {
  const P = { ...M, planet: true };
  const f = terrainField(P); const PL = f.K.planet; const dirAt = (th, ph) => [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
  it('the painting sits at the pole, undistorted: inside the cap the planet is the flat world at polar coordinates', () => {
    expect(f.kernel.planetAt(0, 0, 1)[0]).toBe(f.heightAt(0, 0));
    for (const [th, ph] of [[0.02, 0.3], [0.05, 2.1], [0.9 * PL.inner, -1.2]]) {
      const [h, X, Y] = f.kernel.planetAt(...dirAt(th, ph));
      expect(h).toBe(f.heightAt(X, Y)); expect(Math.hypot(X, Y)).toBeCloseTo(PL.R * th, 6);
    }
  });
  it('the seam into the continents is continuous: no jump between neighbours 10 m apart', () => {
    const step = 10 / PL.R; let worst = 0;
    for (const ph of [0.4, 1.9, 3.3, 5.0]) { let prev = f.kernel.planetAt(...dirAt(PL.inner * 0.9, ph))[0]; for (let th = PL.inner * 0.9 + step; th < PL.outer * 1.1; th += step) { const h = f.kernel.planetAt(...dirAt(th, ph))[0]; worst = Math.max(worst, Math.abs(h - prev)); prev = h; } }
    expect(worst).toBeLessThan(f.K.detail.rock + 10);
  });
  it('the payload: a planet channel, a planet bookmark, and a walk that stands on the sphere', () => {
    const p = assembleTerrainWorld(P, { live: true });
    expect(p.terrain.planet.R).toBe(PL.R); expect(p.cameras.map((c) => c.name)).toContain('planet');
    const [x, y, z] = p.walk.spawn; const cz = z + PL.R, D = Math.hypot(x, y, cz);
    // the eye stands 1.7 m straight up (walk's gravity is −z); measured along the radius, 1.2 km from the pole, within a centimetre
    expect(Math.abs(D - PL.R - f.kernel.planetAt(x / D, y / D, cz / D)[0] - 1.7)).toBeLessThan(0.01);
    expect(validateTerrainWorld({ ...M, planet: { radius: 10 } }).join(' ')).toMatch(/planet must be true or \{ radius \}/);
  });
});
