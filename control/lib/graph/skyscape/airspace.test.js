import { describe, it, expect } from 'vitest';
import { assembleAirspace, validateAirspace } from './airspace.js';
import { planMap } from './map.js';

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
