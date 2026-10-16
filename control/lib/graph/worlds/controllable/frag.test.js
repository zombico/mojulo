import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';
import { simLevel } from '../../game/level-sim.js';
import { composeMechanics } from '../../game/mechanics.js';

// A MATCH PLAYER (`rule.mind.motivation: 'frag'`): it fights whom it sees (never the nearest body behind a wall), the
// one that shot it first; seeing no one it heads for the shot that hit it, a gunshot it heard, a hunch where a rival
// is, and never stands; it strafes as it shoots; a respawn starts its mind clean. The hunter on `target: 'all'` it
// replaces stood still the moment its nearest body went behind a wall (scripts/spikes/shooter/deathmatch.mjs).

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const gun = { fireClass: 'sight', auto: false, cooldown: 0.7, magazine: 6, reload: 2.2, damage: 1, range: 40, coreAngle: 1.5, eye: 1.4 };
const fragger = (id, pos, heading, extra = {}) => ({
  id, rule: { type: 'ai', mind: { motivation: 'frag', aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh' }, sightRange: 40, sightCone: 1.2, navCell: 0.5, standoff: 10, speed: 3, turn: 3, dodge: false, burst: 0.3, pause: 1.2, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(extra.rule || {}) },
  weapon: { ...gun }, body: { type: 'mesh', hittable: true, hp: 4, poise: 2, radius: 0.6, egg: { ...PERSON } }, transform: { pos, heading, pitch: 0 },
});
const dummy = (id, pos) => ({ id, rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 99, egg: { ...PERSON } }, transform: { pos, heading: 0, pitch: 0 } });
const step = (w, n = 1) => { for (let i = 0; i < n; i++) E.stepWorld(w, {}, 1 / 30, hooks); };
const at = (w, id) => w.byId[id].transform.pos;

describe('a match player picks whom it sees', () => {
  it('the one in sight, not the nearest body behind a wall', () => {
    // near: 5 m off behind a wall; far: 15 m off in the open, both inside its cone
    const wall = [{ min: [2, 1, 0], max: [3, 4, 3] }];
    const w = E.createWorld({ colliders: wall, entities: [fragger('a', [0, 0, 0], 0.2), dummy('near', [4, 3, 0]), dummy('far', [15, 0, 0])] });
    step(w, 3);
    expect(w.byId.a.fragTarget).toBe('far');
    // the hunter it replaces takes the nearest, unseen
    const h = E.createWorld({ colliders: wall, entities: [fragger('a', [0, 0, 0], 0.2, { rule: { mind: { motivation: 'hunt', perception: 'memory', pathing: 'navmesh' }, target: 'all' } }), dummy('near', [4, 3, 0]), dummy('far', [15, 0, 0])] });
    expect(E.mindPickTarget(h.byId.a, { byId: h.byId }, 'all').id).toBe('near');
  });

  it('the one that shot it counts closer, even behind it', () => {
    const w = E.createWorld({ entities: [fragger('a', [0, 0, 0], 0), dummy('ahead', [8, 0, 0]), dummy('shooter', [-14, 0, 0])] });
    step(w, 2);
    expect(w.byId.a.fragTarget).toBe('ahead');
    const a = w.byId.a;
    a.hits = (a.hits || 0) + 1; a.lastHitBy = 'shooter';
    step(w, 2);
    expect(a.fragTarget).toBe('shooter');
  });
});

describe('seeing no one, it goes where the fight is', () => {
  it('toward a gunshot it heard', () => {
    // a rival out of sight behind a wall fires; the listener walks toward the shot
    const wall = [{ min: [8, -3, 0], max: [9, 3, 3] }];
    const w = E.createWorld({ colliders: wall, entities: [fragger('a', [0, 0, 0], Math.PI), dummy('b', [14, 0, 0])] });
    const before = Math.hypot(at(w, 'a')[0] - 14, at(w, 'a')[1]);
    for (let k = 0; k < 60; k++) { w.byId.b.lastShot = { mode: 'miss', t: w.time, from: [14, 0, 1.4], to: [30, 0, 1.4] }; step(w); }
    expect(w.byId.a.fragLead).not.toBeNull();
    expect(Math.hypot(at(w, 'a')[0] - 14, at(w, 'a')[1])).toBeLessThan(before - 2);
  });

  it('with nothing heard, a hunch: it never stands', () => {
    const wall = [{ min: [5, -6, 0], max: [6, 6, 3] }];
    const w = E.createWorld({ colliders: wall, entities: [fragger('a', [0, 0, 0], Math.PI), dummy('b', [12, 0, 0])] });
    let still = 0;
    for (let k = 0; k < 30 * 6; k++) { step(w); if (!w.byId.a.moving) still++; }
    expect(still / (30 * 6)).toBeLessThan(0.2);
    expect(at(w, 'a')[0]).toBeGreaterThan(1);
  });
});

describe('a match player in a fight', () => {
  it('strafes as it shoots; strafe 0 stands', () => {
    const run = (strafe) => {
      const w = E.createWorld({ entities: [fragger('a', [0, 0, 0], 0, { rule: { strafe, standoff: 30 } }), dummy('b', [12, 0, 0])] });
      let side = 0;
      for (let k = 0; k < 90; k++) { step(w); side = Math.max(side, Math.abs(at(w, 'a')[1])); }
      return side;
    };
    expect(run(0.6)).toBeGreaterThan(0.5);
    expect(run(0)).toBeLessThan(0.05);
  });

  it('a respawn starts its mind clean', () => {
    const w = E.createWorld({ entities: [fragger('a', [0, 0, 0], 0), dummy('b', [10, 0, 0])] });
    step(w, 10);
    const a = w.byId.a;
    Object.assign(a, { lastSeen: { pos: [1, 1, 0], t: 0, id: 'b' }, coverAt: [2, 2, 0], fragLead: { pos: [3, 3, 0], t: 0 }, mindPhase: 1, hits: 5 });
    E.castOps(w, [{ op: 'kill', who: 'a' }, { op: 'spawn', who: 'a', at: [20, 0, 0] }]);
    expect([a.lastSeen, a.coverAt, a.fragLead, a.mindPhase, a.fragHits, a.coverHits]).toEqual([null, null, null, null, 5, 5]);
  });
});

describe('a match among match players', () => {
  it('on a walled floor, three of them reach the frag limit (the bus credits each kill)', () => {
    // a 40 m floor with four walls across it; the player stands aside, out of it
    const walls = [[10, 8], [-10, 8], [10, -8], [-10, -8]].map(([x, y]) => ({ min: [x - 3, y - 0.3, 0], max: [x + 3, y + 0.3, 2.2] }));
    const spawns = [[-16, 0, 0], [16, 0, 0], [0, 14, 0], [0, -14, 0]];
    const bots = ['bot-1', 'bot-2', 'bot-3'].map((id, k) => fragger(id, spawns[k + 1], [Math.PI, Math.PI / -2, Math.PI / 2][k]));
    const player = { id: 'player', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'none' }, transform: { pos: [60, 60, 0], heading: 0 } };
    const mech = composeMechanics([{ kind: 'frags', rivals: ['bot-1', 'bot-2', 'bot-3'], frags: 3, spawns, respawn: 2 }], { player: 'player' });
    const L = simLevel({ entities: [player, ...bots], events: mech.events, colliders: walls });
    let t = 0;
    for (; t < 120 && !L.bus.vars.__frags_over_0; t += 1 / 30) L.frame(1 / 30);
    const kills = L.bus.log.filter((r) => r.type === 'kill').length;
    expect(L.bus.log.map((r) => r.type)).toContain('frags:lost');
    expect(kills).toBeGreaterThanOrEqual(3);
    expect(t).toBeLessThan(120);
  }, 60_000);
});
