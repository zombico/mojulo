import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { roleLoadout } from '../../gameworld/weapon-roles.js';

// A MIND THAT MAKES ITS GUN'S RANGE (`rule.keepRange`): carrying a gun that wants distance, closer than it wants it backs
// off, still fighting with the gun for the range, until the long gun's sweet spot is nearer and it takes over; that gun
// `plant`s (it stands to shoot it); seeing no one it holds a perch where the long lines meet.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const loadout = roleLoadout(0.5, ['close', 'long']).map((c) => ({ ...c, weapon: { ...c.weapon, eye: 1.4 } }));
const bot = (id, pos, heading, extra = {}) => ({
  id, rule: { type: 'ai', mind: { motivation: 'frag', perception: 'memory', pathing: 'navmesh' }, sightRange: 60, sightCone: 1.4, navCell: 0.5, standoff: 10, speed: 3.4, turn: 3, strafe: 0.6, burst: 0.3, pause: 1.2, eye: 0, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, loadout, ...extra },
  body: { type: 'mesh', hittable: true, hp: 1e6, poise: 1e6, radius: 0.6, egg: { ...PERSON } }, transform: { pos, heading, pitch: 0 },
});
const target = (pos) => ({ id: 'b', rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 1e6, egg: { ...PERSON } }, transform: { pos, heading: Math.PI, pitch: 0 } });
const duel = (extra) => {
  const w = E.createWorld({ entities: [bot('a', [0, 0, 0], 0, extra), target([8, 0, 0])] });
  E.castOps(w, [{ op: 'arm', who: 'a', slot: 'long', draw: false }]);
  for (let k = 0; k < 30 * 9; k++) E.stepWorld(w, {}, 1 / 30, hooks);
  const a = w.byId.a;
  return { a, d: Math.hypot(a.transform.pos[0] - 8, a.transform.pos[1]), gun: loadout[a.loadoutIdx || 0].name, long: a.loadoutWeapons[2], hits: w.byId.b.hits || 0 };
};

describe('a mind that makes its gun\'s range', () => {
  it('keepRange: from 8 m it backs off past the long gun\'s near edge, draws it, plants and lands it', () => {
    const r = duel({ keepRange: true });
    expect(r.d).toBeGreaterThan(19);
    expect(r.gun).toBe('long');
    expect(r.long.shots).toBeGreaterThan(0);
    expect(r.a.lastShot.mode).toBe('core');
  });
  it('without it, it fights where it stands and never draws the long gun', () => {
    const r = duel({});
    expect(r.d).toBeLessThan(12);
    expect(r.long.shots).toBe(0);
  });
  it('a gun for the range by its sweet spot: past the long gun\'s near edge the rifle keeps it until the long gun is nearer its own', () => {
    const at = (d) => {
      const w = E.createWorld({ entities: [bot('a', [0, 0, 0], 0, { speed: 0, strafe: 0 }), target([d, 0, 0])] });
      E.castOps(w, [{ op: 'arm', who: 'a', slot: 'long', draw: false }]);
      for (let k = 0; k < 20; k++) E.stepWorld(w, {}, 1 / 30, hooks);
      return loadout[w.byId.a.loadoutIdx || 0].name;
    };
    expect([at(19), at(23), at(45)]).toEqual(['mid', 'long', 'long']);
  });
  it('a perch: carrying the long gun and seeing no one, it holds the nearest perch and watches; without the gun it hunts', () => {
    const w = E.createWorld({ entities: [bot('a', [0, 0, 0], 0, { keepRange: true, perches: [[12, 8, 0], [-30, 0, 0]] })] });
    E.castOps(w, [{ op: 'arm', who: 'a', slot: 'long', draw: false }]);
    for (let k = 0; k < 30 * 8; k++) E.stepWorld(w, {}, 1 / 30, hooks);
    const p = w.byId.a.transform.pos;
    expect(Math.hypot(p[0] - 12, p[1] - 8)).toBeLessThanOrEqual(1);
    expect(w.byId.a.perched).toBe(true);
    const v = E.createWorld({ entities: [bot('a', [0, 0, 0], 0, { keepRange: true, perches: [[12, 8, 0]] })] });
    for (let k = 0; k < 30 * 8; k++) E.stepWorld(v, {}, 1 / 30, hooks);
    expect(v.byId.a.perched).toBeFalsy();
  });
});
