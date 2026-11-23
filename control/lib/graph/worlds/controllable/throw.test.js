import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { kitSlot, THROWN } from '../../gameworld/arms-kit.js';

// A GRENADE THROWN (throw.js; gameworld/arms-kit.js `frag`, `stun`, `chaff`): the press starts the throw and the round
// leaves the hand at its release, never at the press; a switch before the release throws nothing. Where it goes off: a
// frag hurts (a world that knocks out keeps it a hurt), a stun knocks out whoever sees it and hurts no one, a chaff
// jams round it for its seconds. One case of each burst.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const dt = 1 / 60;
const world = (word, bodies = [], { colliders, knockout } = {}) => {
  const slot = kitSlot(word, { damage: 25 }, { eye: 1.5, hand: 'right' });
  return E.createWorld({
    ...(colliders ? { colliders } : {}),
    entities: [
      { id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7, loadout: [slot], ...(knockout ? { knockout: true } : {}) }, weapon: slot.weapon, body: { type: 'mesh', hittable: true, hp: 100, egg: { ...PERSON } }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
      ...bodies.map(([id, pos]) => ({ id, team: 'guards', rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 100, egg: { ...PERSON } }, transform: { pos, heading: Math.PI, pitch: 0 } })),
    ],
  });
};
// the throw pressed now (the edge), stepped `s` seconds
const run = (w, s, first = { fire: 1 }) => { E.stepWorld(w, first, dt, hooks); for (let k = 1; k < Math.round(s / dt); k++) E.stepWorld(w, {}, dt, hooks); };
// pressed, and stepped until the round has gone off
const goneOff = (w) => { run(w, THROWN.dur); for (let k = 0; k < 600 && !(w.bursts || []).length; k++) E.stepWorld(w, {}, dt, hooks); return w.bursts[0]; };

describe('a grenade thrown', () => {
  it('is emitted only into a page that carries one', () => {
    expect(emissionSource({})).not.toContain('stepWithThrow');
    expect(emissionSource({ throwing: true })).toContain('stepWithThrow');
  });
  it('leaves the hand at the throw\'s release, not at the press, and the throw ends at its seconds', () => {
    const w = world('frag'), P = w.byId.p;
    run(w, THROWN.release * THROWN.dur - 0.05);
    expect(P.throwT).toBeGreaterThan(0);
    expect(w.projectiles.length).toBe(0);                     // (nothing yet: the arm is still coming over)
    run(w, 0.1, {});
    expect(w.projectiles.length).toBe(1);
    expect(P.weapon.ammo).toBe(0);
    run(w, THROWN.dur, {});
    expect(P.throwT).toBe(null);
  });
  it('a switch before the release throws nothing', () => {
    const w = world('frag'), P = w.byId.p;
    run(w, 0.2);
    P.weapon = null;                                          // (what is in hand put away mid-throw)
    run(w, THROWN.dur, {});
    expect(w.projectiles.length).toBe(0);
    expect(P.throwT).toBe(null);
  });
  it('a frag hurts all round it, and a world that knocks out keeps it a hurt', () => {
    const w = world('frag', [['g', [6, 0, 0]]], { knockout: true });
    w.byId.p.transform.heading = 0;
    goneOff(w);
    const g = w.byId.g;
    expect(g.body.hp).toBe(0);
    expect(g.ko || null).toBe(null);
  });
  it('a stun knocks out whoever sees it go off, hurts no one, and not one behind a wall', () => {
    // (thrown flat from the hip, it comes down about 9 m out; the wall runs between there and the hidden one)
    const wall = [{ min: [6.5, 1.6, 0], max: [11.5, 2.1, 3] }];
    const w = world('stun', [['seen', [9, -2, 0]], ['hid', [9, 3.6, 0]]], { colliders: wall, knockout: true });
    const b = goneOff(w);
    expect(b.effect).toBe('stun');
    expect(w.byId.seen.ko && w.byId.seen.ko.how).toBe('stun');
    expect(w.byId.hid.ko || null).toBe(null);
    expect(w.byId.seen.body.hp).toBe(100);
  });
  it('a chaff jams round it for its seconds and hurts no one', () => {
    const w = world('chaff', [['g', [12, 0, 0]]]);
    const b = goneOff(w), J = w.byId.p.weapon.jam;
    expect(b.effect).toBe('chaff');
    expect(E.jammedAt(w, [b.pos[0] + J.r * 0.9, b.pos[1], 0])).toBe(true);
    expect(E.jammedAt(w, [b.pos[0] + J.r * 1.1, b.pos[1], 0])).toBe(false);
    expect(w.byId.g.body.hp).toBe(100);
    for (let k = 0; k < Math.round((J.for + 0.5) / dt); k++) E.stepWorld(w, {}, dt, hooks);
    expect(E.jammedAt(w, b.pos)).toBe(false);                 // (its seconds over)
  });
});
