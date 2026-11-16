import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// HURT, IT LOOKS ROUND (startle.js): a watcher struck from where it was not looking turns there and sweeps its gaze; who
// it then sees its mind has, and who has got behind cover it does not.

const E = composeLive();
const hooks = { ground: () => 0 };
// a watcher at the origin facing +x; the striker behind it at (-6, 0); `wall`: a wall between them
const world = ({ startle = {}, wall = false } = {}) => E.createWorld({
  ...(wall ? { colliders: [{ min: [-3.2, -4, 0], max: [-2.8, 4, 3] }] } : {}),
  camera: { rule: 'follow', target: 'p' },
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [-6, 0, 0], heading: 0 } },
    { id: 'g', team: 'guards', rule: { type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, speed: 0, sightRange: 14, sightCone: 0.6, eye: 0, collideHeight: 1.8, guardRadius: 0.1, ...(startle ? { startle } : {}) }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } },
  ],
});
const run = (w, n) => { for (let k = 0; k < n; k++) E.stepWorld(w, {}, 1 / 60, hooks); return w.byId.g; };
const strike = (w) => { const g = w.byId.g; g.body.hp -= 10; g.lastHitBy = 'p'; };

describe('hurt, it looks round', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithStartle');
    expect(emissionSource({ startle: true })).toContain('stepWithStartle');
  });
  it('unhurt, it does not see who stands behind it; struck from there, it turns and sees them', () => {
    const a = world(); run(a, 120);
    expect(a.byId.g.sightings || 0).toBe(0);
    const w = world(); run(w, 10); strike(w); run(w, 6);
    expect(w.byId.g.st).toBeTruthy();
    expect(w.byId.g.sightings || 0).toBe(0);                    // not at once: it has to turn
    run(w, 120);
    expect(w.byId.g.sightings).toBeGreaterThan(0);
    expect(w.byId.g.st).toBeNull();                             // seen: the mind has them
  });
  it('a striker behind a wall is looked for and not seen; it gives up after its seconds', () => {
    const w = world({ wall: true }); run(w, 10); strike(w); run(w, 120);
    expect(w.byId.g.st).toBeTruthy();
    expect(w.byId.g.sightings || 0).toBe(0);
    expect(Math.abs(Math.cos(w.byId.g.transform.heading) + 1)).toBeLessThan(0.7);   // looking back there, sweeping
    run(w, 150);
    expect(w.byId.g.st).toBeNull();
    expect(w.byId.g.startled).toBe(1);
  });
  it('a watcher without it stays as it was when struck', () => {
    const w = world({ startle: null }); run(w, 10); strike(w); run(w, 200);
    expect(w.byId.g.sightings || 0).toBe(0);
  });
});
