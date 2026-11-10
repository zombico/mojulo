import { describe, it, expect } from 'vitest';
import { newBrawl, stepBrawl, enterBody, brawlHash, BRAWL_RULES } from './brawl-core.js';
import { brawlFighter, newReader, readButtons } from './brawl-moves.js';
import { readGun } from './brawl-guns.js';
import { MOUNTS, THINGS } from './brawl-things.js';
import { practiceOf, stepYard } from './brawl-practice.js';
import { readRangeWaves } from './brawl-waves.js';
import { streetOf, stepStreet, readWaves, crowdFighter } from './brawl-crowd.js';
import { brawlPreset } from './brawl-levels.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';

// MOUNTED FOES: a body rides in on a motorcycle (or a scooter) along the street, steering onto its target's line,
// running over a body in its way (knocked down, once a pass), turning past the view for its passes; knocked off by a
// blow or a stream past its poise, it flies on and its mount skids into a wreck (cover); on foot it gets up and fights,
// else the crash knocks it out; its passes done it steps off (on foot) or rides away. A gun fires from the saddle.
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const F = brawlFighter(recipe);
const guns = [readGun('machine-gun'), readGun('rifle')];
const belt = brawlPreset('yard').belt;
const ctx = { fighters: [F], guns, belt };
// (a player at 6 m, a crowd body that rides in from the far side toward it)
function riding(mount = {}, o = {}, crowd = {}) {
  const s = newBrawl(ctx, { bodies: [{ fighter: 0, side: 'player', x: 6000, z: o.pz ?? 0, ...(o.gun !== undefined ? { gun: o.gun } : {}) }, { fighter: 0, side: 'crowd', x: 20000, grabs: false, face: -1, ...crowd }] });
  enterBody(s, ctx, 1, { how: 'ride', x: 20000, z: o.z ?? 0, mount: { dir: -1, ...mount } });
  return s;
}
function run(s, n, pads = () => []) { const ev = []; const log = []; for (let k = 0; k < n; k++) { s = stepBrawl(s, pads(k, s), ctx); ev.push(...s.events.map((e) => ({ ...e, k }))); log.push(s); } return { s, ev, log }; }

describe('brawl mounts: riding', () => {
  it('it rides along the street at its mount\'s speed and steers onto its target\'s line', () => {
    const { log } = run(riding({}, { pz: 600, z: -800 }), 20);
    expect(log[0].bodies[1].x - log[1].bodies[1].x).toBe(MOUNTS.motorcycle.speed);
    expect(log[19].bodies[1].z).toBeGreaterThan(-800);
    expect(log[19].bodies[1].st).toBe('ride');
  });
  it('it runs a body in its way over (knocked down, once a pass); one off its line it passes by', () => {
    const on = run(riding({ passes: 0, onFoot: false }), 120);
    const rams = on.ev.filter((e) => e.t === 'hit' && e.kind === 'ram' && e.d === 0);
    expect(rams.length).toBe(1);
    expect(rams[0].dmg).toBe(MOUNTS.motorcycle.ram);
    expect(on.ev.some((e) => e.t === 'land' && e.p === 0)).toBe(true);
    // (a player across the street, out of its steering's reach by the time it passes)
    const off = run(riding({ passes: 0, onFoot: false }, { pz: 2400, z: -2400 }), 120);
    expect(off.ev.some((e) => e.t === 'hit' && e.kind === 'ram')).toBe(false);
  });
  it('past the view it turns for its passes; none left and not on foot, it rides away', () => {
    const { ev, s } = run(riding({ passes: 1, onFoot: false }, { pz: 2400, z: -2400 }), 600);
    expect(ev.filter((e) => e.t === 'turn' && e.p === 1).length).toBe(1);
    expect(ev.some((e) => e.t === 'rodeOff' && e.p === 1)).toBe(true);
    expect(s.bodies[1].gone).toBe(1);
  });
  it('its passes done, on foot: it brakes in the view and steps off, its mount left standing (cover)', () => {
    const { ev, s } = run(riding({ passes: 0, onFoot: true }, { pz: 2400, z: -2400 }), 300);
    expect(ev.some((e) => e.t === 'dismount' && e.p === 1)).toBe(true);
    expect(s.bodies[1].st).not.toBe('ride');
    expect(s.things.some((t) => t.kind === 'cover' && t.what === 'motorcycle')).toBe(true);
  });
});

describe('brawl mounts: knocked off', () => {
  // (the genre's answer to a rider: a flying kick as it comes, the body in the air clearing its mount)
  const jab = (mount, crowd) => {
    let s = riding({ passes: 0, ...mount }, { pz: 200, z: 200 }, crowd), r = newReader();
    const ev = [], log = [];
    for (let k = 0; k < 400; k++) {
      const me = s.bodies[0], o = s.bodies[1], dx = o.x - me.x;
      const b = o.st !== 'ride' ? {} : me.st === 'air' ? { a: Math.abs(dx) < 1400 } : Math.abs(dx) < 3400 && Math.abs(dx) > 2800 ? { j: true, x: Math.sign(dx) } : {};
      const [pad, r2] = readButtons(r, b, me, F); r = r2;
      s = stepBrawl(s, [pad], ctx); ev.push(...s.events); log.push(s);
    }
    return { s, ev, log };
  };
  it('a blow (a flying kick) knocks it off: it flies on, its mount skids into a wreck (cover) and stops', () => {
    const { ev, log, s } = jab({ onFoot: true });
    const crash = ev.find((e) => e.t === 'crash');
    expect(crash).toMatchObject({ p: 1, mount: 'motorcycle', onFoot: true });
    const k = log.findIndex((x) => x.events.some((e) => e.t === 'crash'));
    const wreck = (x) => x.things.find((t) => t.what === 'motorcycle');
    expect(wreck(log[k]).sl).toBeTruthy();
    expect(wreck(s).sl).toBeUndefined();
    expect(wreck(s).x).not.toBe(wreck(log[k]).x);
    expect(THINGS.cover.motorcycle.hp).toBeGreaterThan(0);
  });
  it('on foot, it gets up and fights on; not on foot, the crash knocks it out', () => {
    const foot = jab({ onFoot: true }), out = jab({ onFoot: false });
    expect(foot.s.bodies[1].ko).toBe(0);
    expect(foot.log.some((x) => x.bodies[1].st === 'rise')).toBe(true);
    expect(out.s.bodies[1].ko).toBe(1);
  });
  it('a stream under its poise it rides on through; past it, it comes off', () => {
    const shoot = (poise) => run(riding({ passes: 0, onFoot: true }, { gun: 0 }, { poise }), 90, () => [{ fire: [1, 0] }]).ev;
    expect(shoot(30).some((e) => e.t === 'crash')).toBe(true);
    const tough = shoot(5000);
    expect(tough.some((e) => e.t === 'hit' && e.d === 1)).toBe(true);
    expect(tough.some((e) => e.t === 'crash')).toBe(false);
  });
  it('nobody takes hold of a rider; a rider with a gun fires from the saddle', () => {
    const s0 = riding({ passes: 0 }, { pz: 2000, z: 2000 });
    expect(run(s0, 40, () => [{ x: 1 }]).ev.some((e) => e.t === 'grab')).toBe(false);
    const ctx2 = { ...ctx };
    let st = streetOf({ belt: readBelt({ at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }] }), players: [{ recipe: { ...recipe, hp: 99999 } }], waves: [{ screen: 1, crowd: [{ type: 'rifleman', n: 1, entrance: 'ride', mount: { passes: 2, onFoot: false } }] }] });
    st.s.bodies[0].x = 18000;
    const ev = [];
    for (let k = 0; k < 400; k++) { st = stepStreet(st, [{}]); ev.push(...st.s.events); }
    expect(ev.some((e) => e.t === 'enter' && e.how === 'ride')).toBe(true);
    expect(ev.some((e) => e.t === 'fire' && e.p === 1)).toBe(true);
    expect(ctx2.guns.length).toBe(2);
  });
});

describe('brawl mounts: in the waves', () => {
  it('a range wave rides in from the view\'s edge toward the player; a mount it does not know refused', () => {
    let r = practiceOf({ belt, players: [{ recipe }], dummies: [], range: { guns: ['machine-gun'], waves: [{ crowd: [{ type: 'thug', n: 2 }], entrance: 'ride', mount: { kind: 'scooter', passes: 1 }, after: 20 }] } });
    const ev = [];
    for (let k = 0; k < 40; k++) { r = stepYard(r, [{}]); ev.push(...r.s.events); }
    expect(ev.filter((e) => e.t === 'enter' && e.how === 'ride' && e.mount === 'scooter').length).toBe(2);
    expect(r.s.bodies.slice(1).every((b) => b.st === 'ride' || b.st === 'fall' || b.st === 'down')).toBe(true);
    expect(() => readRangeWaves([{ crowd: [{ type: 'thug', n: 1 }], entrance: 'ride', mount: { kind: 'horse' } }])).toThrow(/kind/);
    expect(() => readWaves([{ screen: 1, crowd: [{ type: 'thug', n: 1, entrance: 'ride', mount: { passes: 9 } }] }], readBelt({ at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }] }))).toThrow(/passes/);
  });
  it('the same ride and pads, the same brawl', () => {
    const go = () => brawlHash(run(riding({ passes: 2, onFoot: true }, { gun: 0 }), 400, (k) => [{ fire: [1, 0], z: k % 90 < 20 ? 1 : 0 }]).s);
    expect(go()).toBe(go());
    expect(BRAWL_RULES.half).toBeGreaterThan(0);
    expect(crowdFighter('thug')).toBeTruthy();
  });
});
