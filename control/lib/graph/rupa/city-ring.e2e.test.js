// THE GEOCITY'S PHYSICAL RING IN A WORLD (the e2e tier: it resolves a whole physical geocity, its metro and its ring's
// blocks, pieces and load audit, which takes minutes; the ring's own laws are city-ring.test.js's, in milliseconds).
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene } from '../geocity/scene.js';

// the smallest metro that still rings (city-ring.test.js's)
const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity };

describe('the physical ring in a world', () => {
  it('a physical geocity with someone in it breaks its near ring by blocks and stamps the load', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const eye = assembleGeocityScene({ ...M, destruction: 'physical' }).walk.spawn;
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [eye[0], eye[1], eye[2] - 1.7] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const P = (await resolveWorldScene({ manifest: { ...M, entities: [hero], destruction: 'physical' }, title: 'city' })).payload;
    const ring = P.breakables.filter((b) => /^geocity-b\d+:/.test(b.id));
    expect(ring.length).toBeGreaterThan(10);
    expect(P.rupaAudit).toMatchObject({ loose: [], crush: [], span: [] });
    expect(P.rupaAudit.shells.length).toBeGreaterThan(0);
    expect(P.physicalRing).toBeUndefined();
  }, 900000);
});
