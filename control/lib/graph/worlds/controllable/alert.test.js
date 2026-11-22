import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// ONCE SEEN, IT KEEPS YOU (alert.js): a watcher that has seen the pilot follows it out of its calm beam, goes to where it
// lost it and looks there, calls the watchers near it, and does not fire before its weapon is up.

const E = composeLive();
const hooks = { ground: () => 0 };
const GUARD = { type: 'ai', mind: { motivation: 'guard', perception: 'sight' }, speed: 1.6, sightRange: 14, sightCone: 0.6, eye: 0, collideHeight: 1.8, guardRadius: 14, standoff: 9, turnRate: 2.2 };
const GUN = { fireClass: 'sight', auto: false, cooldown: 0.28, magazine: 30, reload: 2.2, damage: 8, range: 40, eye: 1.4 };
// a watcher at the origin facing +x, the pilot in front of it at (8, 0); `wall`: a wall the pilot can step behind;
// `mate`: a second watcher of its team, `at` where it stands, facing away
const world = ({ alert = {}, wall = false, mate = null } = {}) => E.createWorld({
  ...(wall ? { colliders: [{ min: [10, 1.5, 0], max: [10.4, 8, 3] }] } : {}),
  camera: { rule: 'follow', target: 'p' },
  entities: [
    { id: 'p', pilotable: true, team: 'hero', rule: { type: 'platform', speed: 4, eye: 0, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 1e6 }, transform: { pos: [8, 0, 0], heading: Math.PI } },
    { id: 'g', team: 'guards', rule: { ...GUARD, ...(alert ? { alert } : {}) }, weapon: GUN, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } },
    ...(mate ? [{ id: 'm', team: 'guards', rule: { ...GUARD, ...(alert ? { alert } : {}) }, weapon: GUN, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: mate, heading: Math.PI } }] : []),
  ],
});
const run = (w, n, f) => { for (let k = 0; k < n; k++) { if (f) f(w, k); E.stepWorld(w, {}, 1 / 60, hooks); } return w.byId.g; };
const put = (w, x, y) => { w.byId.p.transform.pos = [x, y, 0]; };

describe('once seen, it keeps you', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithAlert');
    expect(emissionSource({ alert: true })).toContain('stepWithAlert');
  });
  it('seen, it is in combat; the pilot lost a moment and back well out of the calm beam is seen again', () => {
    // the pilot gone for most of a second, then back 60° off the guard's line: outside a 0.6 rad beam, inside the
    // alerted cone
    const side = (w) => { run(w, 30); put(w, -200, 0); run(w, 40); put(w, 4, 7); run(w, 10); return w.byId.g; };
    const g = side(world());
    expect(g.alert.level).toBe('combat');
    expect(g.sightings).toBe(2);
    // without it the narrow beam does not find the pilot again
    const calm = side(world({ alert: null }));
    expect(calm.sightings).toBe(1);
  });
  it('its sight widens and reaches farther while alerted, and is as written once it lets go', () => {
    const w = world({ alert: { hold: 2, search: 1 } }); run(w, 30);
    expect(w.byId.g.rule.sightCone).toBeGreaterThan(0.6);
    expect(w.byId.g.rule.sightRange).toBeGreaterThan(14);
    expect(w.byId.g.rule.mind.perception).toBe('memory');
    put(w, -200, 0); run(w, 60 * 6);
    expect(w.byId.g.alert.level).toBe('calm');
    expect(w.byId.g.rule).toMatchObject({ sightCone: 0.6, sightRange: 14, speed: 1.6, mind: { perception: 'sight' } });
  });
  it('the line broken, it goes to where it last saw the pilot and searches there', () => {
    const w = world({ wall: true }); run(w, 30);
    // the pilot slips behind the wall: unseen, the guard comes on to the spot and looks round it
    put(w, 12, 4); run(w, 90);
    const g = w.byId.g;
    expect(g.alert.level).toBe('search');
    expect(Math.hypot(g.transform.pos[0], g.transform.pos[1])).toBeGreaterThan(1);
    const calm = world({ alert: null, wall: true }); run(calm, 30); put(calm, 12, 4); run(calm, 90);
    expect(Math.hypot(calm.byId.g.transform.pos[0] - 0, calm.byId.g.transform.pos[1])).toBeLessThan(0.5);
  });
  it('no round goes before the weapon is up', () => {
    const w = world({ alert: { raise: 0.8 } });
    let first = null;
    run(w, 120, (q) => { if (first == null && (q.byId.g.weapon.shots || 0) > 0) first = q.time; });
    expect(first).not.toBeNull();
    expect(first).toBeGreaterThanOrEqual(0.8);
    expect(w.byId.g.alert.up).toBe(1);
  });
  it('a sighting calls the watchers of its team near it, who come to look; one far off is not called', () => {
    const near = world({ mate: [-4, 6, 0] }); run(near, 20);
    expect(near.byId.g.alert.calls).toBe(1);
    expect(near.byId.m.alert.level).not.toBe('calm');
    run(near, 120);
    expect(near.byId.m.sightings || 0).toBeGreaterThan(0);   // it came round and saw the pilot itself
    const far = world({ mate: [-30, 6, 0] }); run(far, 20);
    expect(far.byId.m.alert.level).toBe('calm');
    const deaf = world({ mate: [-4, 6, 0], alert: { call: 0 } }); run(deaf, 20);
    expect(deaf.byId.m.alert.level).toBe('calm');
  });
});

describe('the way to where it lost the pilot', () => {
  it('blocked, it searches from where it stands rather than walking into the wall', () => {
    // a long wall across the guard's way to the spot; no paths
    const w = E.createWorld({
      colliders: [{ min: [3, -20, 0], max: [3.4, 20, 3] }],
      camera: { rule: 'follow', target: 'p' },
      entities: [
        { id: 'p', pilotable: true, team: 'hero', rule: { type: 'platform', speed: 4, eye: 0, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 1e6 }, transform: { pos: [8, 0, 0], heading: Math.PI } },
        { id: 'g', team: 'guards', rule: { ...GUARD, alert: {}, collideRadius: 0.3 }, weapon: GUN, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } },
      ],
    });
    // seen over the wall's end (it remembers the spot), then the pilot gone
    w.byId.g.lastSeen = { pos: [8, 0, 0], t: 0, id: 'p' }; w.byId.p.transform.pos = [-200, 0, 0];
    run(w, 60 * 3);
    expect(w.byId.g.alert.level).toBe('search');
    expect(w.byId.g.searchT).not.toBeNull();
    expect(w.byId.g.locomotion).toBe('search');
  });
});
