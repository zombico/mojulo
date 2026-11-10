import { describe, it, expect } from 'vitest';
import { practiceOf, stepYard, resetYard, yardRead, brawlMoveList, PRACTICE_MODE_IDS, BACK, CHAINS } from './brawl-practice.js';
import { brawlPreset } from './brawl-levels.js';
import { brawlHash, BRAWL_RULES } from './brawl-core.js';
import { CROWD_RULES } from './brawl-crowd.js';
import { THINGS } from './brawl-things.js';
import { solveFighter } from '../versus/versus-solver.js';

// THE PRACTICE ROOM: the street's blocks under a practice mind. Dummies stand, walk across the street, swing on a beat,
// crowd as the street's crowd does, or walk in to grab; a player never dies; a felled dummy is back on its spot; a reset
// puts everything back; every press has its verdict, and the room shows the line, the chain, the clinch, the combo.
const { belt } = brawlPreset('yard');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const room = (dummies, o = {}) => practiceOf({ belt, players: [{ recipe }], dummies, ...o });
// (a dummy a step in front of the player, on its line)
const near = (o = {}) => { const r = room([{ mode: 'stand', ...o }]); r.s.bodies[1].x = r.s.bodies[0].x + 700; r.s.bodies[1].z = r.s.bodies[0].z; r.yard.homes[1] = [r.s.bodies[1].x, r.s.bodies[1].z]; return r; };
function run(r, n, fn = () => ({})) {
  const log = [];
  for (let k = 0; k < n; k++) { r = stepYard(r, [fn(k, r)]); log.push(r); }
  return { r, log, ev: log.flatMap((x) => x.s.events) };
}

describe('brawl practice: its words', () => {
  it('a dummy\'s mode, a health and the room\'s size are refused when they are not', () => {
    expect(() => room([{ mode: 'dance' }])).toThrow(/mode/);
    expect(() => room([{ type: 'ninja' }])).toThrow(/type/);
    expect(() => room([], { health: 'forever' })).toThrow(/health/);
    expect(() => practiceOf({ belt, players: [] })).toThrow(/players/);
  });
  it('a dummy\'s health is a few of the player\'s chains', () => {
    const r = room([{ mode: 'stand' }]), F = r.ctx.fighters[0];
    const chain = Array.from({ length: F.brawl.chain }, (_, k) => F.moves[`chain.${k + 1}`].damage * (F.moves[`chain.${k + 1}`].hits || 1)).reduce((a, b) => a + b, 0);
    expect(r.s.bodies[1].hp).toBe(Math.round(chain * CHAINS));
  });
});

describe('brawl practice: the dummies', () => {
  it('stand: where it is put', () => {
    const { r } = run(room([{ mode: 'stand', at: 9, n: 1 }]), 120);
    expect([r.s.bodies[1].x, r.s.bodies[1].z]).toEqual([9000, 1000]);
  });
  it('walk: back and forth across the street where it stands', () => {
    const { log } = run(room([{ mode: 'walk', at: 9, n: 0 }]), 600);
    const zs = log.map((x) => x.s.bodies[1].z);
    expect(Math.max(...zs)).toBeGreaterThan(belt.depth[1] * 1000 - 400);
    expect(Math.min(...zs)).toBeLessThan(belt.depth[0] * 1000 + 400);
    expect(log.every((x) => Math.abs(x.s.bodies[1].x - 9000) < 400)).toBe(true);
  });
  it('swing: onto the player\'s line, then its blow on a slow beat', () => {
    const { ev } = run(room([{ mode: 'swing', at: 9, n: 2 }]), 600);
    const hits = ev.filter((e) => e.t === 'hit' && e.p === 1 && e.d === 0);
    expect(hits.length).toBeGreaterThan(1);
  });
  it('crowd: the street\'s crowd, never more closing in than its tokens', () => {
    const { log, ev } = run(room([0, 1, 2, 3].map((k) => ({ mode: 'crowd', at: 9 + k, n: (k % 3) - 1 }))), 900);
    expect(log.every((x) => (x.mind.tok[0] ?? []).length <= CROWD_RULES.tokens)).toBe(true);
    expect(ev.some((e) => e.t === 'hit' && e.d === 0)).toBe(true);
  });
  it('grab: walks into the player, takes hold, knees and throws', () => {
    const { ev } = run(room([{ mode: 'grab', type: 'heavy', at: 9, n: 0 }]), 600);
    expect(ev.some((e) => e.t === 'grab' && e.clinch && e.d === 0)).toBe(true);
    expect(ev.some((e) => e.t === 'throw' && e.d === 0)).toBe(true);
  });
});

describe('brawl practice: the room\'s rules', () => {
  it('a player never dies: knocked out, it is back on its feet, whole', () => {
    const r = room([{ mode: 'swing', at: 9, n: 2 }]); r.s.bodies[0].hp = 1;
    const { r: after, ev } = run(r, 600);
    expect(ev.some((e) => e.t === 'ko' && e.p === 0)).toBe(true);
    expect(after.s.bodies[0].ko).toBe(0);
    expect(after.s.bodies[0].hp).toBeGreaterThan(1);
  });
  it('a felled dummy is back on its spot, whole, after a while; under refill it never falls', () => {
    const r = near(); r.s.bodies[1].hp = 5;
    const { r: after, ev, log } = run(r, BACK + 80, (k) => ({ a: k === 0 }));
    const fell = log.findIndex((x) => x.s.bodies[1].ko);
    expect(fell).toBeGreaterThanOrEqual(0);
    expect(ev.some((e) => e.t === 'back' && e.p === 1)).toBe(true);
    expect([after.s.bodies[1].ko, after.s.bodies[1].x, after.s.bodies[1].hp]).toEqual([0, after.yard.homes[1][0], after.yard.hp[1]]);
    const refill = near({}); refill.yard.health = 'refill'; refill.s.bodies[1].hp = 5;
    // (a chain, then let alone: whole again, never having fallen)
    const hit = run(refill, 200, (k) => ({ a: k < 40 && k % 6 === 0 }));
    expect(hit.ev.some((e) => e.t === 'ko')).toBe(false);
    expect(hit.r.s.bodies[1].hp).toBe(hit.r.yard.hp[1]);
  });
  it('a reset puts everyone on their spots, whole, the things back, the logs cleared', () => {
    const r = room([{ mode: 'stand', at: 9, n: 0 }], { things: [{ kind: 'food', what: 'apple', at: 3 }] });
    const moved = run(r, 120, (k) => ({ x: 1, a: k % 9 === 0 })).r;
    const back = resetYard(moved);
    expect(back.s.bodies.map((b) => [b.x, b.z])).toEqual(r.s.bodies.map((b) => [b.x, b.z]));
    expect(back.s.things.map((t) => t.what)).toEqual(['apple']);
    expect(back.yard.log[0]).toEqual([]);
  });
});

describe('brawl practice: every press has its verdict', () => {
  it('a press taken says so; a press after a whiff starts a new chain, and says why', () => {
    const r = room([{ mode: 'stand', at: 20, n: 0 }]);
    // (pressed in the whiff's recovery, running out as it ends: dropped, the why the miss; pressed near its end: kept
    // until the body is free, a new chain)
    const early = run(r, 30, (k) => ({ a: k === 0 || k === 6 })).r.yard.log[0];
    expect(early[0]).toMatchObject({ words: 'attack', verdict: 'taken', what: 'chain.1', late: 0 });
    expect(early[1]).toMatchObject({ verdict: 'dropped' });
    expect(early[1].why).toMatch(/missed/);
    const late = run(r, 30, (k) => ({ a: k === 0 || k === 8 })).r.yard.log[0];
    expect(late[1]).toMatchObject({ verdict: 'taken', what: 'chain.1' });
    expect(late[1].note).toMatch(/missed/);
  });
  it('a press while reeling is dropped as reeling', () => {
    const r = near({ mode: 'swing' });
    // (one press as the first blow lands, then none: the reeling outlasts the press's buffer)
    let pressed = false;
    const { log } = run(r, 400, (k, x) => { const now = !pressed && x.s.bodies[0].st === 'hit' && !x.s.bodies[0].hs; if (now) pressed = true; return { a: now }; });
    expect(log.at(-1).yard.log[0].some((e) => e.verdict === 'dropped' && /reeling/.test(e.why))).toBe(true);
  });
  it('a chain to its end reads as the finisher; one cut short as dropped, with the why', () => {
    const full = run(near(), 120, (k) => ({ a: k % 6 === 0 })).r;
    expect(yardRead(full).chain.last).toMatchObject({ end: 'finisher' });
    // (two presses, then nothing more)
    const cut = run(near(), 120, (k) => ({ a: k === 0 || k === 6 })).r;
    expect(yardRead(cut).chain.last).toMatchObject({ end: 'dropped' });
    expect(yardRead(cut).chain.last.steps).toEqual([1, 2]);
  });
  it('a strong on its cooldown is dropped, saying how long is left', () => {
    const r = room([{ mode: 'stand', at: 20, n: 0 }]), F = r.ctx.fighters[0];
    const log = run(r, F.moves.strong.total + 20, (k) => ({ h: k === 0 || k === F.moves.strong.total + 4 })).r.yard.log[0];
    expect(log[0]).toMatchObject({ words: 'strong', verdict: 'taken', what: 'strong' });
    expect(log[1]).toMatchObject({ words: 'strong', verdict: 'dropped' });
    expect(log[1].why).toMatch(/cooldown/);
  });
  it('a chain ended by the strong reads as the breaker, by the blowout as the blowout; opened by it, says so', () => {
    const on = (x) => x.s.bodies[0].mv === 'chain.1' && x.s.bodies[0].conn > 0;
    const broke = run(near(), 120, (k, x) => ({ a: k === 0, h: on(x) })).r;
    expect(yardRead(broke).chain.last).toMatchObject({ end: 'breaker', steps: [1] });
    const out = run(near(), 120, (k, x) => ({ a: k === 0, h: on(x), x: on(x) ? 1 : 0 })).r;
    expect(yardRead(out).chain.last).toMatchObject({ end: 'blowout' });
    const opened = run(near(), 160, (k, x) => ({ h: k === 0, a: k > 0 && k % 6 === 0 })).r;
    expect(yardRead(opened).chain.last).toMatchObject({ end: 'finisher', open: 'strong' });
  });
});

describe('brawl practice: what the room shows', () => {
  it('the line to each dummy: how far across, lined or not, in reach or not', () => {
    const r = room([{ mode: 'stand', at: 6, n: 1 }, { mode: 'stand', at: 7, n: 0.1 }]);
    r.s.bodies[0].z = 0;
    const L = yardRead(r).line;
    expect(L.map((d) => d.dz)).toEqual([1000, 100]);
    expect(L.map((d) => d.lined)).toEqual([false, true]);
  });
  it('the clinch: knees left, the hold\'s time, from behind or not', () => {
    const r = near();
    const held = run(r, 40, () => ({ x: 1 })).r;
    const c = yardRead(held).clinch;
    expect(c).toMatchObject({ knees: BRAWL_RULES.knees, of: BRAWL_RULES.hold, back: false });
    expect(c.left).toBeLessThan(BRAWL_RULES.hold);
  });
  it('the combo: its hits and their damage, kept once it is over', () => {
    const { r, ev } = run(near(), 160, (k) => ({ a: k % 6 === 0 }));
    const mine = ev.filter((e) => e.t === 'hit' && e.p === 0);
    const last = yardRead(r).combo.last;
    expect(last.hits).toBeGreaterThan(1);
    expect(last.damage).toBe(mine.slice(0, last.hits).reduce((a, e) => a + e.dmg, 0));
  });
});

describe('brawl practice: the move list', () => {
  it('the chain by its style, the strong, the air, the dashes, the clinch, the desperation and its price, the street', () => {
    const F = room([]).ctx.fighters[0], L = brawlMoveList(F);
    expect(L.map((k) => k.label)).toEqual(expect.arrayContaining(['Chain', 'Strong', 'Air', 'Dash', 'Clinch', 'Desperation', 'Street']));
    // (the air: a punch and a kick on attack, the stomp and the dive kick on strong)
    expect(L.find((k) => k.label === 'Air').moves.map((m) => m.input)).toEqual(['J, A', '→ J, A', 'J, St', '→ J, St']);
    // (the strong blows each say their cooldown)
    expect(L.find((k) => k.label === 'Strong').moves.every((m) => m.data.some((d) => d.what === 'cooldown'))).toBe(true);
    expect(L[0].moves.length).toBe(F.brawl.chain + 1);
    expect(L.find((k) => k.label === 'Desperation').moves[0].data.find((d) => d.what === 'price').value).toBe(String(F.moves.desperate.price));
  });
});

describe('brawl practice: determinism', () => {
  it('the same room and buttons, the same yard', () => {
    const go = () => brawlHash(run(room(PRACTICE_MODE_IDS.map((mode, k) => ({ mode, type: mode === 'grab' ? 'heavy' : 'thug', at: 8 + k * 1.5, n: (k % 3) - 1 })), { things: [{ kind: 'weapon', what: 'pipe', at: 4 }] }), 400, (k) => ({ x: k % 80 < 40 ? 1 : -1, z: k % 50 < 8 ? 1 : 0, a: k % 7 === 0, j: k % 97 === 3 })).r.s);
    expect(go()).toBe(go());
  });
});
