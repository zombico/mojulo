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

describe('it hears', () => {
  const HEARS = { hears: {} };
  const shot = (w, quiet = false) => { const p = w.byId.p; if (quiet) p.weapon = { quiet: true }; p.lastShot = { t: w.time, from: [p.transform.pos[0], p.transform.pos[1], 1.4], mode: 'miss' }; };
  it('a gunshot behind it turns it round and it sees who fired; a suppressed one that far off it does not hear', () => {
    const w = world({ startle: HEARS }); run(w, 10); shot(w); run(w, 4);
    expect(w.byId.g.st).toBeTruthy();
    expect(w.byId.g.heard).toBe(1);
    run(w, 120);
    expect(w.byId.g.sightings).toBeGreaterThan(0);
    const q = world({ startle: HEARS }); run(q, 10); q.byId.p.transform.pos = [-9, 0, 0]; shot(q, true); run(q, 120);
    expect(q.byId.g.heard || 0).toBe(0);
    expect(q.byId.g.sightings || 0).toBe(0);
  });
  it('running close behind it is heard; walking slowly, crouched, or running far off is not; a deaf one hears nothing', () => {
    const walkBy = (opts, speed, y, more = {}) => { const w = world(opts); const p = w.byId.p; Object.assign(p, more); p.rule = { ...p.rule, speed }; p.transform.pos = [-5, y, 0]; p.transform.heading = Math.PI / 2; for (let k = 0; k < 40; k++) E.stepWorld(w, { forward: 1 }, 1 / 60, hooks); return w.byId.g.heard || 0; };
    expect(walkBy({ startle: HEARS }, 5.8, -3)).toBe(1);
    expect(walkBy({ startle: HEARS }, 1.6, -3)).toBe(0);
    expect(walkBy({ startle: HEARS }, 5.8, -3, { crouched: true })).toBe(0);
    expect(walkBy({ startle: HEARS }, 5.8, -30)).toBe(0);
    expect(walkBy({ startle: {} }, 5.8, -3)).toBe(0);
  });
});
