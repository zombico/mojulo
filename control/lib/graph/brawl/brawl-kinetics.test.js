import { describe, it, expect } from 'vitest';
import { KINETICS, massOf, holdOf, throwSpeed, shareOf, readKnock, kick, landSlide, slideOn, slabMass, shoveSpeed, slabMeets, slabSlows, floatStep, windForce, windGain } from './brawl-kinetics.js';
import { POWERS, POWER_IDS } from './brawl-powers.js';
import { streetOf, stepStreet } from './brawl-crowd.js';
import { newReader, readButtons } from './brawl-moves.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';
import { buildKnock } from '../worlds/controllable/knock.js';

// RUPA'S KNOCKBACK ON THE STREET: a power's blow carries joules, and a body is thrown by its mass against them. The law is
// rupa's own (worlds/controllable/knock.js), written again because the street's page inlines this module: held to it here.
const rupaLaw = () => {
  const E = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
  buildKnock(E);
  return E.knockLaw;
};
const belt = readBelt({ at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, boss: true }] });
const hero = (power) => ({ recipe: { ...solveFighter({ id: 'h', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder', hp: 99999 }, ...(power ? { power } : {}) });
// (a power of each kind, chosen from the shelf by what its energy is)
const KINETIC = POWER_IDS.find((id) => POWERS[id].knock?.kinetic), IMPACT = POWER_IDS.find((id) => POWERS[id].knock?.impact), NONE = POWER_IDS.find((id) => !POWERS[id].knock);
// (the hero at the first stop, a thug and a heavy set in front of it as `place` says, the power pressed once)
function fire(power, place, frames = 200) {
  let st = streetOf({ belt, players: [hero(power)], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }, { type: 'heavy', n: 1 }] }] });
  st.s.bodies[0].x = 22000;
  let r = newReader();
  const log = [];
  for (let k = 0; k < 152 + frames; k++) {
    const me = st.s.bodies[0];
    if (k === 150) st.s.bodies.filter((b) => b.side === 'crowd').forEach((b, i) => Object.assign(b, { x: me.x + place[i][0], z: me.z + place[i][1], st: 'stand', sf: 0, mv: null, gone: 0 }));
    const [pad, r2] = readButtons(r, k === 152 ? { s: true } : {}, me, st.ctx.fighters[0]);
    r = r2;
    st = stepStreet(st, [pad]);
    log.push(st);
  }
  return log;
}
const events = (log, t) => log.flatMap((st) => st.s.events.filter((e) => e.t === t));

describe('rupa\'s knockback on the street', () => {
  it('is rupa\'s law: the hold, the throw, the shock\'s share and the ground\'s, to the number', () => {
    const L = rupaLaw();
    expect(holdOf({ y: 0, st: 'stand' }, 75)).toBeCloseTo(L.holdOf({ body: { mass: 75 }, transform: { pos: [0, 0, 0] } }, 75), 9);
    expect(holdOf({ y: 400, st: 'fall' }, 75)).toBe(0);
    for (const [m, J] of [[75, 3000], [172, 3000], [75, 40]]) expect(throwSpeed(m, J, holdOf({ y: 0, st: 'stand' }, m))).toBeCloseTo(L.throwSpeed(m, J, L.holdOf({ body: { mass: m }, transform: { pos: [0, 0, 0] } }, m)), 9);
    for (const d of [0, 1, 3]) expect(shareOf(0.5, d)).toBeCloseTo(L.shareOf(0.5, d), 12);
    expect(KINETICS.GROUND).toBe(L.GROUND);
    expect(readKnock({ kinetic: 'heavy' })).toEqual({ kinetic: L.WORDS.heavy });
    expect(() => readKnock({ kinetic: 'huge' })).toThrow(/joules/);
  });

  it('a big frame is heavier than a person\'s: a heavy of the crowd weighs more than a thug', () => {
    const st = streetOf({ belt, players: [hero()], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }, { type: 'heavy', n: 1 }] }] });
    const [thug, heavy] = st.s.bodies.filter((b) => b.side === 'crowd').map((b) => massOf(st.ctx.fighters[b.fi]));
    expect(heavy).toBeGreaterThan(thug * 1.5);
  });

  it('a kinetic power: the light body flies (a knockdown), the heavy one only staggers', () => {
    const st = streetOf({ belt, players: [hero(KINETIC)], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }, { type: 'heavy', n: 1 }] }] });
    const [me, thug, heavy] = st.s.bodies;
    for (const b of [thug, heavy]) Object.assign(b, { gone: 0, st: 'stand', y: 0 });
    st.s.events = [];
    for (const b of [thug, heavy]) kick(st.s, st.ctx, { by: me, hit: b, kin: POWERS[KINETIC].knock, from: null, face: 1 });
    const v = Object.fromEntries(st.s.events.filter((e) => e.t === 'thrown').map((e) => [e.p, e.v]));
    expect(v[thug.id]).toBeGreaterThanOrEqual(KINETICS.TOPPLE);
    expect(thug.st).toBe('fall');
    expect(v[heavy.id]).toBeLessThan(KINETICS.TOPPLE);
    expect(v[heavy.id]).toBeGreaterThan(0);
    expect(heavy.st).toBe('hit');
    // (in the air nothing holds a body: the same blow throws it harder)
    const up = { ...thug, y: 600, st: 'fall' };
    expect(throwSpeed(massOf(st.ctx.fighters[up.fi]), 1000, holdOf(up, 75))).toBeGreaterThan(throwSpeed(75, 1000, holdOf({ y: 0, st: 'stand' }, 75)));
  });

  it('an impact: the ground takes its share, the shock falls off with distance, and what was thrown slides to a stop', () => {
    const log = fire(IMPACT, [[1200, 0], [1200, 1800]]);
    const [near, far] = log[0].s.bodies.filter((b) => b.side === 'crowd');
    const hit = events(log, 'impact')[0];
    expect(hit.ground).toBe(Math.round(KINETICS.GROUND * POWERS[IMPACT].knock.impact));
    const v = Object.fromEntries(events(log, 'thrown').map((e) => [e.p, e.v]));
    expect(v[near.id]).toBeGreaterThan(v[far.id] ?? 0);
    // (a slide on the floor, friction-stopped: it goes on after the landing, then stops)
    const b = { x: 0, sx: 0, ks: 1, vx: 60 };
    landSlide(b);
    let steps = 0;
    while (b.sx && steps < 999) { slideOn(b); steps++; }
    expect(b.x).toBeGreaterThan(0);
    expect(b.sx).toBeUndefined();
  });

  it('a power with no energy throws nobody: the fight\'s own blows, as before', () => {
    const log = fire(NONE, [[1200, 0], [2000, 0]]);
    expect(events(log, 'thrown')).toEqual([]);
    expect(events(log, 'impact')).toEqual([]);
  });
});

// EARTH: a slab of the street wrenched up and shoved, rupa's matter meeting matter.
describe('an earth power\'s slab', () => {
  const EARTHLY = POWER_IDS.find((id) => POWERS[id].wall);
  it('the law: a slab far heavier than a body carries it at nearly its own speed, and pays for it', () => {
    const W = POWERS[EARTHLY].wall, M = slabMass(W.size, W.density), v = shoveSpeed(M, W.push);
    expect(0.5 * M * v * v).toBeCloseTo(W.push, 6);
    const hit = slabMeets(M, v, 75);
    expect(throwSpeed(75, hit.joules, 0)).toBeGreaterThan(v * 0.9);
    expect(hit.v).toBeLessThan(v);
    expect(0.5 * M * hit.v * hit.v + hit.joules).toBeCloseTo(0.5 * M * v * v, 6);
    expect(slabSlows(v)).toBeLessThan(v);
  });

  it('two presses: up as cover (a use spent), then shoved, flooring what it meets until it stops and crumbles', () => {
    let st = streetOf({ belt, players: [hero(EARTHLY)], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 2 }] }] });
    st.s.bodies[0].x = 22000;
    let r = newReader();
    const log = [];
    for (let k = 0; k < 520; k++) {
      const me = st.s.bodies[0];
      if (k === 150) st.s.bodies.filter((b) => b.side === 'crowd').forEach((b, i) => Object.assign(b, { x: me.x + 3200 + i * 900, z: me.z, st: 'stand', sf: 0, mv: null, gone: 0 }));
      const [pad, r2] = readButtons(r, k === 152 || k === 200 ? { s: true } : {}, me, st.ctx.fighters[0]);
      r = r2;
      st = stepStreet(st, [pad]);
      log.push(st);
    }
    expect(events(log, 'power').filter((e) => e.p === 0)).toHaveLength(1);
    expect(events(log, 'wall')).toHaveLength(1);
    const shove = events(log, 'shove')[0];
    expect(shove).toBeDefined();
    expect(events(log, 'thrown').some((e) => e.v >= KINETICS.TOPPLE)).toBe(true);
    expect(events(log, 'crumble')).toHaveLength(1);
    expect(log.at(-1).s.walls).toBeUndefined();
    // (standing, it held the street: no body stood inside it)
    const standing = log.find((x) => x.s.walls?.[0]?.st === 'stand').s, w = standing.walls[0];
    for (const b of standing.bodies) if (!b.gone && Math.abs(b.z - w.z) <= w.wid / 2) expect(Math.abs(b.x - w.x)).toBeGreaterThanOrEqual(w.len / 2);
  });

  it('a street with no earth power carries no slabs', () => {
    const log = fire(KINETIC, [[1200, 0], [2000, 0]]);
    expect(log.some((x) => 'walls' in x.s)).toBe(false);
  });
});

// BRAWL_AIR: a hero carried on it (rupa's vayo law), and a gale's drag on a body against its footing.
describe('the air: floating, and a gale', () => {
  const GALE = POWER_IDS.find((id) => POWERS[id].gale), FLOATS = POWER_IDS.find((id) => POWERS[id].float);
  it('a floating body eases up to its walk\'s speed and glides on after the stick is let go; no footing holds it', () => {
    const p = { wx: 1, wz: 0 }, xs = [];
    let x = 0;
    for (let k = 0; k < 240; k++) { if (k === 60) p.wx = 0; x += floatStep(p, 52)[0]; xs.push(x); }
    expect(xs[9]).toBeLessThan(52 * 10);           // (easing up: short of a walk's ten steps)
    expect(xs[59] - xs[49]).toBeGreaterThan(470);   // (at speed by then)
    expect(xs[89]).toBeGreaterThan(xs[59] + 300);   // (gliding on after the stick is let go)
    expect(xs[239]).toBe(xs[238]);                  // (and come to rest)
    expect(holdOf({ y: 0, st: 'stand', fy: 1 }, 75)).toBe(0);
  });

  it('a gale\'s drag passes a grunt\'s footing, a big body braces, a floating one is swept hardest', () => {
    const thug = { y: 0, st: 'stand' }, floater = { y: 0, st: 'stand', fy: 1 }, v = POWERS[GALE].gale.speed;
    expect(windForce(0.5, v)).toBeGreaterThan(KINETICS.MU * 75 * KINETICS.G);
    expect(windGain(thug, 75, 0.5, v)).toBeGreaterThan(windGain(thug, 172, 0.75, v));
    expect(windGain(floater, 75, 0.5, v)).toBeGreaterThan(windGain(thug, 75, 0.5, v));
    expect(windGain(thug, 172, 0.75, v * 0.6)).toBe(0);   // (a lesser wind: the big body does not move at all)
  });

  it('on the street: the gust blows the grunt off its feet, the heavy holds, rounds are blown away, and no stop is cleared by it', () => {
    let st = streetOf({ belt, players: [hero(GALE)], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }, { type: 'heavy', n: 1 }] }, { screen: 2, crowd: [{ type: 'rifleman', n: 1 }] }] });
    expect(st.s.bodies[0].fy).toBe(1);
    st.s.bodies[0].x = 22000;
    let r = newReader();
    const log = [];
    for (let k = 0; k < 260; k++) {
      const me = st.s.bodies[0];
      if (k === 150) st.s.bodies.filter((b) => b.side === 'crowd' && b.wv === 0).forEach((b, i) => Object.assign(b, { x: me.x + [1500, 2500][i], z: me.z + [-300, 300][i], st: 'stand', sf: 0, mv: null, gone: 0 }));
      // (a round of the crowd flying at the hero through the gale)
      if (k === 175) st.s.shots.push({ id: 999, o: 3, side: 'crowd', gun: 0, x: me.x + 3000, z: me.z, y: 1200, vx: -60, vz: 0, w: 60, h: 60, life: 90, hits: 1, rehit: 0, hitAt: -999, dmg: 10, hitstun: 10, hitstop: 2, push: 40, sup: 0, meter: 0, hl: [] });
      const [pad, r2] = readButtons(r, k === 152 ? { s: true } : {}, me, st.ctx.fighters[0]);
      r = r2;
      st = stepStreet(st, [pad]);
      log.push(st);
    }
    const [thug, heavy] = log[0].s.bodies.filter((b) => b.side === 'crowd' && b.wv === 0);
    const thrown = events(log, 'thrown');
    expect(thrown.find((e) => e.p === thug.id)?.v).toBeGreaterThanOrEqual(KINETICS.TOPPLE);
    expect(thrown.some((e) => e.p === heavy.id)).toBe(false);
    expect(events(log, 'blown').length).toBeGreaterThan(0);
    expect(events(log, 'cleared')).toEqual([]);
    // (the gust is gone after its frames: no state left behind)
    expect(log.at(-1).s.gusts).toBeUndefined();
    expect(log.at(-1).s.bodies.every((b) => b.wn === undefined)).toBe(true);
  });

  it('a power that does not float leaves its hero walking, and a street with no gale carries no gusts', () => {
    const st = streetOf({ belt, players: [hero(KINETIC)], waves: [] });
    expect(st.s.bodies[0].fy).toBeUndefined();
    expect(POWERS[KINETIC].float).toBeUndefined();
    expect(FLOATS).toBeDefined();
    expect(fire(KINETIC, [[1200, 0], [2000, 0]]).some((x) => 'gusts' in x.s)).toBe(false);
  });
});
