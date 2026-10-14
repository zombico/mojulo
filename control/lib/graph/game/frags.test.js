import { describe, it, expect } from 'vitest';
import { simLevel } from './level-sim.js';
import { composeMechanics } from './mechanics.js';
import { SHOOT } from '../gameworld/quick.js';

// A DEATHMATCH, stepped as the page steps it: the player and two gunners on open flat ground, the frags mechanic on
// the bus crediting each fall to its last hitter, bringing the fallen back at the spawns and ending at the limit. The
// player aims at the nearest standing gunner and works the trigger. The gunners hunt the player (a gunner on `target:
// 'all'` picks the nearest body even unseen: bots that play a free-for-all are the next step); a fall between two
// others is credited the same way (mechanics.test.js, frags on the bus).

const PERSON = { a: 0.35, c: 0.9 };
const gunner = (k, at) => ({
  id: `bot-${k}`,
  rule: { type: 'ai', mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'sight' }, sightRange: 40, sightCone: 1.4, standoff: 10, speed: 3, turn: 3, dodge: false, burst: 0.3, pause: 1.2, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 },
  weapon: { ...SHOOT.gun },
  body: { type: 'mesh', hittable: true, hp: SHOOT.foeHp, poise: 2, radius: 0.6, egg: { ...PERSON, cz: PERSON.c } },
  transform: { pos: at, heading: Math.PI },
});
const SPAWNS = [[24, 0, 0], [12, 16, 0], [12, -16, 0], [30, 10, 0]];

function match({ frags = 3, seconds } = {}) {
  const mech = composeMechanics([{ kind: 'frags', rivals: ['bot-1', 'bot-2'], frags, spawns: SPAWNS, respawn: 2, hits: SHOOT.hit, ...(seconds ? { seconds } : {}) }], { player: 'player' });
  const player = { id: 'player', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, weapon: { ...SHOOT.rifle, eye: 1.5 }, body: { type: 'none', hittable: true, radius: 0.5, egg: { ...PERSON, cz: PERSON.c } }, transform: { pos: [0, 0, 0], heading: 0 } };
  return simLevel({ entities: [player, gunner(1, [24, 4, 0]), gunner(2, [24, -4, 0])], events: mech.events });
}
// the player's aim: the nearest gunner standing, at its chest
function aimAndFire(L, n) {
  const W = L.world, P = W.byId[W.pilotId];
  const live = ['bot-1', 'bot-2'].map((id) => W.byId[id]).filter((b) => !b.downed);
  if (!live.length || P.downed) { L.input.fire = 0; return; }
  const p = P.transform.pos, b = live.sort((u, v) => Math.hypot(u.transform.pos[0] - p[0], u.transform.pos[1] - p[1]) - Math.hypot(v.transform.pos[0] - p[0], v.transform.pos[1] - p[1]))[0].transform.pos;
  const d = Math.hypot(b[0] - p[0], b[1] - p[1]);
  P.transform.heading = Math.atan2(b[1] - p[1], b[0] - p[0]);
  P.transform.pitch = Math.atan2(b[2] + 1.2 - (p[2] + 1.5), d);
  L.input.fire = n % 2;
}
const kills = (L) => L.bus.log.filter((r) => r.type === 'kill').length;

describe('frags in a played world', () => {
  it('the player\'s kills are credited on the bus, the fallen come back at a spawn, and the limit wins it', () => {
    const L = match({ frags: 3 });
    const back = new Set();
    let wasDown = {};
    for (let n = 0; n < 30 * 60 && !L.bus.vars.__frags_over_0; n++) {
      aimAndFire(L, n);
      L.frame(1 / 30);
      for (const id of ['bot-1', 'bot-2']) { const b = L.world.byId[id]; if (wasDown[id] && !b.downed) back.add(id); wasDown[id] = b.downed; }
    }
    expect(L.bus.vars.__frag_0_player).toBe(3);
    expect(kills(L)).toBeGreaterThanOrEqual(3);
    expect(L.bus.log.map((r) => r.type)).toContain('frags:won');
    // a gunner that fell stood again, whole, at one of the spawns
    expect(back.size).toBeGreaterThan(0);
    const b = L.world.byId[[...back][0]];
    expect(b.body.hp).toBeGreaterThan(0);
  }, 60_000);

  it('a player who never fires is fragged, held down, and comes back whole at a spawn', () => {
    const L = match({ frags: 9 });
    let fell = null;
    for (let n = 0; n < 30 * 60 && !fell; n++) { L.frame(1 / 30); if (L.bus.vars.__deaths_0 > 0) fell = n; }
    expect(fell).not.toBeNull();
    const W = L.world, P = W.byId[W.pilotId];
    expect(P.downed).toBe(true);
    expect(L.bus.vars['__frag_0_bot-1'] + L.bus.vars['__frag_0_bot-2']).toBe(1);
    L.run(2.5);
    expect(P.downed).toBe(false);
    expect(L.bus.vars.hp).toBe(100);
    expect(SPAWNS.some((s) => Math.hypot(s[0] - P.transform.pos[0], s[1] - P.transform.pos[1]) < 0.5)).toBe(true);
  }, 60_000);
});
