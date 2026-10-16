import { describe, it, expect } from 'vitest';
import { assembleAirspace, validateAirspace } from './airspace.js';
import { planMap } from './map.js';
import { solvePalette, PALETTE_PRESETS } from '../color-theorist/solve.js';
import { terrainRamps, atlasGround } from '../color-theorist/ground.js';
import { rgbToOklab } from '../color-theorist/oklab.js';

// the smallest airspace with every ring and a pad
const M = { kind: 'airspace', map: { form: 'island', field: 1200, craft: 'glider' }, ground: { pads: [{ at: [0.5, 0.4] }] } };

describe('the airspace world kind', () => {
  it('carries the map\'s haze and LOD to the page, so the edge stays hidden', () => {
    const p = assembleAirspace(M, { live: true }), map = planMap(M.map);
    expect(p.haze.density).toBe(map.haze.density);
    expect(p.terrain.hazeHeight).toBe(map.haze.hazeHeight);
    expect(p.terrain.split).toBe(map.lod.split);
    expect(p.terrain.minSize).toBe(map.lod.minSize);
    expect(p.terrain.root.size / 2).toBeGreaterThanOrEqual(map.rings.root.hx);
    expect(p.meta.laws.filter((l) => !l.ok)).toEqual([]);
  });

  it('meshes the ground on the live page and bakes it for exports', () => {
    expect(assembleAirspace(M, { live: true }).faces).toEqual([]);
    expect(assembleAirspace(M, { live: false }).faces.length).toBeGreaterThan(0);
  });

  it('spawns on the first pad\'s threshold, looking down it', () => {
    const p = assembleAirspace(M, { live: true }), pad = p.meta.pads[0];
    expect(p.walk.spawn[2]).toBeCloseTo(pad.datum + 2, 6);
    const cam = p.cameras.find((c) => c.name === 'threshold').worldFraming;
    expect(cam.lookAt[pad.along === 'y' ? 1 : 0]).toBeGreaterThan(cam.cameraPosition[pad.along === 'y' ? 1 : 0]);
  });

  it('teaches on a bad manifest', () => {
    expect(validateAirspace({ kind: 'airspace', fly: 'yes' })[0]).toMatch(/airspace.fly must be/);
    expect(validateAirspace({ kind: 'airspace', map: { form: 'globe' } })[0]).toMatch(/map.form/);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(assembleAirspace(M, { live: true }))).toBe(JSON.stringify(assembleAirspace(M, { live: true })));
  });
});

describe('a palette colours the airspace', () => {
  // an earth preset, chosen from the table (a preset with air)
  const preset = Object.keys(PALETTE_PRESETS).find((p) => (PALETTE_PRESETS[p].spec.air ?? 'full') === 'full');
  const P = { ...M, palette: { preset, seed: 3 } }, K = solvePalette(P.palette);
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const Lof = (c) => rgbToOklab(c)[0];

  it('absent or false, it adds nothing', () => {
    const plain = JSON.stringify(assembleAirspace(M, { live: true }));
    expect(JSON.stringify(assembleAirspace({ ...M, palette: false }, { live: true }))).toBe(plain);
    expect(assembleAirspace(M, { live: true }).meta.ground).toMatchObject({ geocube: expect.any(String) });
  });

  it('paints the ground, the sky, the haze and the sea from the palette; the land itself is the same', () => {
    const plain = assembleAirspace(M, { live: true }), p = assembleAirspace(P, { live: true }), A = atlasGround(K);
    const R = terrainRamps(K, 1);
    expect(p.terrain.K.ramps).toEqual({ ...R, beds: [R.stone] });
    expect([p.sky.zenith, p.sky.horizon]).toEqual([A.sky.zenith, A.sky.horizon]);
    // the haze is the horizon: it hides the map's edge in the palette's air
    expect(p.bg).toBe(hex(A.sky.horizon));
    expect(p.haze.color).toBe(p.bg);
    expect(p.terrain.water.color).toBe(hex(A.ramps.water.stops[2]));
    expect(p.meta.ground).toMatchObject({ palette: K.id });
    // relief, pads and course the same: the palette colours, it does not move ground
    expect(p.meta.pads).toEqual(plain.meta.pads);
    expect(p.meta.ground.relief).toEqual(plain.meta.ground.relief);
    expect(p.terrain.K.grids).toEqual(plain.terrain.K.grids);
  });

  it('under air, the zenith is deeper than the horizon', () => {
    const p = assembleAirspace(P, { live: true });
    expect(Lof(p.sky.zenith)).toBeLessThan(Lof(p.sky.horizon));
  });

  it('a space map keeps its void', () => {
    const S = { kind: 'airspace', seed: 2, map: { form: 'void' } };
    expect(JSON.stringify(assembleAirspace({ ...S, palette: { preset, seed: 3 } }))).toBe(JSON.stringify(assembleAirspace(S)));
  });

  it('teaches on a bad palette, and is deterministic', () => {
    expect(validateAirspace({ ...M, palette: { preset: 'pluto' } })[0]).toMatch(/airspace.palette.preset is one of/);
    expect(JSON.stringify(assembleAirspace(P, { live: true }))).toBe(JSON.stringify(assembleAirspace(P, { live: true })));
  });
});
