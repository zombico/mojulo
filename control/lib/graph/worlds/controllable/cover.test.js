import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// A FIREFIGHT at a person's scale: a weapon's spare rounds and the cast's rearm; a shot traced to where it enters a body
// (a head over a wall is hit, legs behind it are not); a mind that takes cover (`rule.cover`) when hurt or reloading,
// and comes back out after the one it fights; the navmesh stepping a walker out of a blocked cell first.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const rifle = { fireClass: 'sight', auto: false, cooldown: 0.2, magazine: 4, reload: 1, damage: 1, range: 60, coreAngle: 1.5, eye: 1.5 };
const person = (id, pos, heading, extra = {}) => ({ id, rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 99, egg: { ...PERSON } }, transform: { pos, heading, pitch: 0 }, ...extra });
const step = (w, input = {}, n = 1) => { for (let i = 0; i < n; i++) E.stepWorld(w, input, 1 / 30, hooks); };
// pull the trigger n times (a semi weapon fires on the pull)
const pulls = (w, n) => { for (let i = 0; i < n; i++) { step(w, { fire: 1 }); step(w, { fire: 0 }, 8); } };

describe('the reserve and rearm', () => {
  it('a reload draws from the reserve; out of both, the weapon is dry and does not reload', () => {
    const w = E.createWorld({ entities: [{ ...person('p', [0, 0, 0], 0), pilotable: true, weapon: { ...rifle, reserve: 4 } }] });
    const W = w.byId.p.weapon;
    pulls(w, 4);
    expect([W.ammo, W.reserve]).toEqual([0, 4]);
    step(w, {}, 40);
    expect([W.ammo, W.reserve, W.reloading]).toEqual([4, 0, false]);
    pulls(w, 4);
    step(w, {}, 40);
    expect([W.ammo, W.reserve, W.reloading]).toEqual([0, 0, false]);
    // rounds come: the reserve takes them, and the empty weapon reloads from it
    E.castOps(w, [{ op: 'rearm', who: 'p', by: 6 }]);
    step(w, {}, 40);
    expect([W.ammo, W.reserve]).toEqual([4, 2]);
  });

  it('without a reserve the reload is endless, and rearm fills the magazine', () => {
    const w = E.createWorld({ entities: [{ ...person('p', [0, 0, 0], 0), pilotable: true, weapon: { ...rifle } }] });
    const W = w.byId.p.weapon;
    pulls(w, 2);
    expect(W.reserve).toBe(null);
    E.castOps(w, [{ op: 'rearm', who: 'p', by: 6 }]);
    expect(W.ammo).toBe(4);
  });
});

describe('a shot traced to where it lands', () => {
  // a wall 1.2 m high between them, 5 m from the shooter; the target 10 m off
  const wall = [{ min: [4.75, -2, 0], max: [5.25, 2, 1.2] }];
  const duel = (pitchAt) => {
    const w = E.createWorld({ colliders: wall, entities: [{ ...person('p', [0, 0, 0], 0), pilotable: true, weapon: { ...rifle } }, person('t', [10, 0, 0], Math.PI)] });
    w.byId.p.transform.pitch = Math.atan2(pitchAt - 1.5, 10);
    pulls(w, 1);
    return w.byId.t.hits || 0;
  };
  it('a head over a low wall is hit; legs behind it are not', () => {
    expect(duel(1.6)).toBe(1);
    expect(duel(0.4)).toBe(0);
  });
});

describe('cover', () => {
  // the gunner stands in the open beside a wall's end; the shooter is 14 m south
  const wall = [{ min: [-4, 3.5, 0], max: [-0.6, 4, 2] }];
  const gunner = (extra = {}) => ({
    id: 'g', team: 'foes',
    rule: { type: 'ai', mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh' }, navCell: 0.5, cover: { radius: 6, hold: 1.5 }, standoff: 30, speed: 3, turn: 4, dodge: false, eye: 0, collideRadius: 0.3, collideHeight: 1.7, ...extra },
    weapon: { ...rifle, eye: 1.4, cooldown: 0.6 }, body: { type: 'mesh', hittable: true, hp: 99, egg: { ...PERSON } },
    transform: { pos: [0.5, 5, 0], heading: -Math.PI / 2, pitch: 0 },
  });
  const world = (g) => E.createWorld({ colliders: wall, entities: [{ ...person('p', [0.5, -9, 0], Math.PI / 2), pilotable: true }, g] });
  const hidden = (w) => E.sightBlocked([0.5, -9, 1.3], [w.byId.g.transform.pos[0], w.byId.g.transform.pos[1], 1.3], wall);

  it('hurt, it breaks for a spot the wall hides it at, eye, head and flanks, and holds there', () => {
    const w = world(gunner());
    step(w, {}, 3);
    expect(hidden(w)).toBe(false);
    w.byId.g.hits = 1;
    step(w, {}, 45);
    expect(w.byId.g.coverAt).toBeTruthy();
    expect(hidden(w)).toBe(true);
    expect(w.byId.g.aiFire).toBe(0);
  });

  it('the hold over, it comes back out after the one it fights, and sees it again', () => {
    const w = world(gunner());
    step(w, {}, 3);
    w.byId.g.hits = 1;
    step(w, {}, 45);
    expect(hidden(w)).toBe(true);
    let seen = false;
    for (let i = 0; i < 150 && !seen; i++) { step(w); seen = !hidden(w) && w.byId.g.lastSeen && w.byId.g.lastSeen.t > 2; }
    expect(seen).toBe(true);
  });

  it('reloading is a reason too; without `cover` it stands and fights', () => {
    const w = world(gunner());
    step(w, {}, 3);
    w.byId.g.weapon.ammo = 0;
    step(w, {}, 30);
    expect(w.byId.g.coverAt).toBeTruthy();
    const plain = world(gunner({ cover: undefined }));
    step(plain, {}, 3);
    plain.byId.g.hits = 1;
    step(plain, {}, 45);
    expect(plain.byId.g.coverAt).toBeUndefined();
    expect(hidden(plain)).toBe(false);
  });
});

describe('the navmesh from a blocked cell', () => {
  it('a walker pressed into a wall is not clear: its path steps out to the open cell first', () => {
    const w = { colliders: [{ min: [-4, 3.5, 0], max: [-0.6, 4, 2] }] };
    const opts = { radius: 0.3, height: 1.7, cell: 0.5 };
    const from = [-0.7, 4.3, 0];
    expect(E.navClear(w, from, [-0.7, -9, 0], opts)).toBe(false);
    const path = E.navPath(w, from, [-0.7, -9, 0], opts);
    expect(path.length).toBe(2);
    expect(path[0][0]).toBeGreaterThan(-0.6);
    expect(path[1]).toEqual([-0.7, -9]);
  });
});
