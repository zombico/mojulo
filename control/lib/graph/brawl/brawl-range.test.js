import { describe, it, expect } from 'vitest';
import { practiceOf, stepYard, resetYard, yardRead, rangeMoveList, RANGE_GUNS } from './brawl-practice.js';
import { newGunReader, readGunButtons } from './brawl-gunner.js';
import { brawlPreset } from './brawl-levels.js';
import { brawlHash } from './brawl-core.js';
import { GUNS, readGun } from './brawl-guns.js';
import { DASH_WAIT } from './brawl-moves.js';
import { solveFighter } from '../versus/versus-solver.js';

// THE RANGE (the run & gun's practice room): guns passed in to be tried, the gunner's buttons, dummies that stand,
// walk or shoot back, and the readouts the feel is approved by: rounds fired and landed, their damage, rounds taken,
// each press's verdict. The range never runs dry.
const { belt } = brawlPreset('yard');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const range = (dummies, rangeOpts = {}) => practiceOf({ belt, players: [{ recipe }], dummies, range: rangeOpts });
// (a dummy on the player's line, `dx` mm ahead)
const ahead = (r, dx = 3000, dz = 0) => { r.s.bodies[1].x = r.s.bodies[0].x + dx; r.s.bodies[1].z = r.s.bodies[0].z + dz; r.yard.homes[1] = [r.s.bodies[1].x, r.s.bodies[1].z]; return r; };
function run(r, n, fn = () => ({})) {
  const log = [];
  for (let k = 0; k < n; k++) { r = stepYard(r, [fn(k, r)]); log.push(r); }
  return { r, log, ev: log.flatMap((x) => x.s.events) };
}

describe('brawl range: the guns passed in', () => {
  it('the player holds the first, its sidearm under it; a gun passed as dials is what fires', () => {
    const r = range([{ mode: 'stand' }], { guns: [{ from: 'machine-gun', rate: 3, id: 'hose' }, 'spread'] });
    expect(r.ctx.guns[0].id).toBe('sidearm');
    expect(r.ctx.guns[r.s.bodies[0].gn].id).toBe('hose');
    const { ev } = run(r, 30, () => ({ a: true }));
    const fires = ev.filter((e) => e.t === 'fire' && e.p === 0);
    expect(fires.every((e) => e.gun === 'hose')).toBe(true);
    expect(fires.length).toBe(10);
    expect(() => range([], { guns: [{ from: 'laser' }] })).toThrow(/from/);
  });
  it('unless it says, the machine gun, the spread, the flame and the rocket; the move list reads each gun\'s numbers', () => {
    const r = range([]);
    expect(r.ctx.guns.slice(1, 1 + RANGE_GUNS.length).map((g) => g.id)).toEqual([...RANGE_GUNS]);
    const L = rangeMoveList(r);
    expect(L[0].label).toBe('Guns');
    expect(L[0].moves.map((m) => m.name)).toEqual(['Machine Gun', 'Spread', 'Flame', 'Rocket']);
    expect(L[0].moves[0].data.find((d) => d.what === 'round speed (m/s)').value).toBe(String(Math.round((GUNS['machine-gun'].speed * 60) / 100) / 10));
    expect(L[1].moves.map((m) => m.name)).toEqual(['Fire', 'Aim', 'Plant', 'Roll', 'Jump', 'Grenade']);
  });
});

describe('brawl range: what it reads', () => {
  it('rounds fired and landed, their damage', () => {
    const { r } = run(ahead(range([{ mode: 'stand' }], { guns: ['machine-gun'] }), 2500), 90, () => ({ a: true }));
    const g = yardRead(r).gun;
    expect(g.id).toBe('machine-gun');
    expect(g.fired).toBeGreaterThan(10);
    expect(g.landed).toBeGreaterThan(5);
    expect(g.landed).toBeLessThanOrEqual(g.fired);
    expect(g.damage).toBe(g.landed * GUNS['machine-gun'].damage);
  });
  it('never runs dry: a spent gun loaded again, the grenades back', () => {
    const r0 = range([{ mode: 'stand' }], { guns: [{ from: 'rocket', ammo: 2 }], grenades: 1 });
    const { r, ev } = run(r0, 200, (k) => ({ a: true, s: k % 40 === 0 }));
    expect(ev.some((e) => e.t === 'empty')).toBe(true);
    expect(ev.some((e) => e.t === 'reload')).toBe(true);
    expect(r.ctx.guns[r.s.bodies[0].gn].id).toBe('rocket-tuned');
    expect(ev.filter((e) => e.t === 'fire' && e.gun === 'grenade').length).toBeGreaterThan(1);
  });
  it('each press its verdict: a shot taken (its gun), a press while rolling dropped as rolling', () => {
    const { r } = run(range([{ mode: 'stand' }], { guns: ['spread'] }), 40, (k) => ({ a: k === 0 || k === 20, x: k === 14 || k === 17 ? 1 : 0 }));
    const log = yardRead(r).log;
    expect(log[0]).toMatchObject({ words: 'fire', verdict: 'taken', what: 'spread' });
    expect(log.some((e) => e.verdict === 'dropped' && /rolling/.test(e.why))).toBe(true);
  });
});

describe('brawl range: a dummy that shoots back', () => {
  const shooter = (o = {}) => ahead(range([{ mode: 'shoot', ...o }], { guns: ['machine-gun'] }), 3500);
  it('on its beat it aims (its gun\'s warning), then fires; a player standing on its line is struck', () => {
    const { log, r } = run(shooter(), 400);
    const k = log.findIndex((x) => x.s.events.some((e) => e.t === 'fire' && e.p === 1));
    expect(k).toBeGreaterThan(0);
    expect(log[k - 1].s.bodies[1].tl).toBeGreaterThanOrEqual(GUNS.rifle.telegraph);
    expect(yardRead(r).gun.struck).toBeGreaterThan(0);
  });
  it('stepping off the round\'s line as its warning shows, the round passes where it was aimed', () => {
    // (the player walks across the street while the warning shows, then stands; standing still, it is struck)
    // (one volley: its warning, its round's flight, before the next beat's lands)
    const stepped = run(shooter(), 130, (k, x) => ({ z: x.s.bodies[1].tl > 0 ? 1 : 0 }));
    const stood = run(shooter(), 130);
    expect(stepped.ev.some((e) => e.t === 'fire' && e.p === 1)).toBe(true);
    expect(yardRead(stepped.r).gun.struck).toBe(0);
    expect(yardRead(stood.r).gun.struck).toBeGreaterThan(0);
  });
  it('a flinch during its warning cuts its shot short: no round comes', () => {
    // (the player fires on the shooter through its first warning: a low-poise rifleman, the rifle's round never fired)
    const r = ahead(range([{ mode: 'shoot', type: 'rifleman' }], { guns: ['machine-gun'] }), 2500);
    const { ev } = run(r, 60, () => ({ a: true }));
    expect(ev.some((e) => e.t === 'hit' && e.d === 1 && e.flinch)).toBe(true);
    expect(ev.some((e) => e.t === 'fire' && e.p === 1)).toBe(false);
  });
  it('a gun of its own passed in: a burst dummy', () => {
    const { ev } = run(shooter({ gun: { from: 'burst', telegraph: 10 } }), 200);
    expect(ev.some((e) => e.t === 'fire' && e.p === 1 && e.gun === 'burst-tuned')).toBe(true);
  });
});

describe('brawl range: the gunner\'s buttons', () => {
  const body = { face: 1 };
  it('the stick walks and aims; planted, it only aims; fire held fires the way it points', () => {
    let [pad] = readGunButtons(newGunReader(), { x: 1, z: 1, a: true }, body);
    expect(pad).toMatchObject({ x: 1, z: 1, fire: [1, 1] });
    [pad] = readGunButtons(newGunReader(), { x: -1, h: true, a: true }, body);
    expect(pad).toMatchObject({ x: 0, z: 0, fire: [-1, 0] });
    [pad] = readGunButtons(newGunReader(), { a: true }, body);
    expect(pad.fire).toEqual([1, 0]);
  });
  it('tapped twice the same way, along or across, a roll; too slow, a walk', () => {
    const taps = (dir, gap) => { let r = newGunReader(), out = null; for (let k = 0; k <= gap + 1; k++) { const b = k === 0 || k === gap + 1 ? dir : {}; const [pad, r2] = readGunButtons(r, b, body); r = r2; if (pad.dash) out = pad; } return out; };
    expect(taps({ z: 1 }, 3)).toMatchObject({ dash: 'roll', z: 1 });
    expect(taps({ x: -1 }, 3)).toMatchObject({ dash: 'roll', x: -1 });
    expect(taps({ x: 1 }, DASH_WAIT + 2)).toBeNull();
  });
});

describe('brawl range: a reset and determinism', () => {
  it('a reset: everyone home, armed as they came, the counts cleared', () => {
    const { r } = run(range([{ mode: 'shoot' }], { guns: ['spread', 'rocket'] }), 120, () => ({ a: true, x: 1 }));
    const back = resetYard(r);
    expect(back.ctx.guns[back.s.bodies[0].gn].id).toBe('spread');
    expect(back.s.bodies[1].gn).toBe(r.s.bodies[1].gn);
    expect(yardRead(back).gun.fired).toBe(0);
  });
  it('the same range and buttons, the same yard', () => {
    const go = () => brawlHash(run(range([{ mode: 'shoot' }, { mode: 'walk' }, { mode: 'crowd', type: 'gunner' }], { guns: ['spread', readGun('flame').id] }), 400, (k) => ({ x: k % 80 < 40 ? 1 : -1, z: k % 50 < 8 ? 1 : 0, a: k % 3 !== 0, s: k % 97 === 3 })).r.s);
    expect(go()).toBe(go());
  });
});
