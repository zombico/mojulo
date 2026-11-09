import { describe, it, expect } from 'vitest';
import { readThings, THINGS, BRAWL_WEAPONS } from './brawl-things.js';
import { newBrawl, stepBrawl, brawlHash } from './brawl-core.js';
import { brawlFighter, newReader, readButtons } from './brawl-moves.js';
import { streetOf } from './brawl-crowd.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';
import { STATES, WEAPONS } from '../versus/versus-library.js';

// THE STREET'S THINGS: food and power-ups taken by standing over them and pressing attack, weapons held (the chain
// swings the blade), thrown (special) and dropped when knocked down, boxes broken by a player's blows leaving what they
// hold. Absent, the brawl carries nothing of them.
const belt = readBelt({ at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }] });
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const P = brawlFighter(recipe);
const fighters = [P, ...BRAWL_WEAPONS.map((w) => brawlFighter({ ...recipe, weapon: w }))];
const armed = Object.fromEntries(BRAWL_WEAPONS.map((w, i) => [`0:${w}`, i + 1]));
const ctx = { fighters, armed };
const thing = (kind, what, x, z = 0, o = {}) => ({ id: x + z, kind, what, x, z, ...(kind === 'box' ? { hp: THINGS.box[what].hp } : {}), ...o });
const world = (things, crowd = []) => newBrawl(ctx, { bodies: [{ fighter: 0, side: 'player', x: 0 }, ...crowd.map(([x, z = 0]) => ({ fighter: 0, side: 'crowd', x, z, grabs: false }))], things });
function play(s, n, fn, crowd = () => []) {
  let r = newReader();
  const ev = [];
  for (let k = 0; k < n; k++) {
    const [pad, r2] = readButtons(r, fn(k, s) ?? {}, s.bodies[0], ctx.fighters[s.bodies[0].fi]);
    r = r2;
    s = stepBrawl(s, [pad, ...crowd(k, s)], ctx);
    for (const e of s.events) ev.push([k, e]);
  }
  return { s, ev };
}

describe('brawl things: the shelf', () => {
  it('weapons are the fight\'s; power-ups its states', () => {
    for (const w of BRAWL_WEAPONS) expect(WEAPONS[w], w).toBeTruthy();
    expect(Object.keys(THINGS.power)).toEqual(Object.keys(STATES));
  });
  it('reads a level\'s things in the belt\'s metres, refusing what is not one', () => {
    const [t] = readThings([{ kind: 'box', what: 'barrel', at: 3, n: 1, holds: { kind: 'food', what: 'meat' } }], belt);
    expect(t).toMatchObject({ kind: 'box', what: 'barrel', x: 3000, z: 1000, hp: THINGS.box.barrel.hp, holds: { kind: 'food', what: 'meat' } });
    expect(() => readThings([{ kind: 'gem', what: 'ruby', at: 1 }], belt)).toThrow(/kind/);
    expect(() => readThings([{ kind: 'food', what: 'cake', at: 1 }], belt)).toThrow(/what/);
    expect(() => readThings([{ kind: 'box', what: 'crate', at: 1, holds: { kind: 'box', what: 'barrel' } }], belt)).toThrow(/another box/);
    expect(() => readThings([{ kind: 'food', what: 'apple', at: 1, holds: { kind: 'food', what: 'apple' } }], belt)).toThrow(/only a box/);
    expect(() => readThings([{ kind: 'food', what: 'apple', at: 99 }], belt)).toThrow(/along/);
    expect(() => readThings([{ kind: 'food', what: 'apple', at: 1, n: 9 }], belt)).toThrow(/across/);
  });
});

describe('brawl things: taken where they lie', () => {
  it('food: attack over it, its health back, never past the body\'s own', () => {
    const s = world([thing('food', 'chicken', 200)]); s.bodies[0].hp = 500;
    const out = play(s, 20, (k) => ({ a: k === 0 }));
    expect(out.s.bodies[0].hp).toBe(500 + THINGS.food.chicken.hp);
    expect(out.s.things).toEqual([]);
    expect(out.ev.some(([, e]) => e.t === 'pick' && e.kind === 'food')).toBe(true);
    const full = world([thing('food', 'meat', 200)]); full.bodies[0].hp = P.hp - 10;
    expect(play(full, 20, (k) => ({ a: k === 0 })).s.bodies[0].hp).toBe(P.hp);
  });
  it('a power-up: its state held', () => {
    const out = play(world([thing('power', 'haste', 200)]), 5, (k) => ({ a: k === 0 }));
    expect(out.s.bodies[0].ist[0]).toBe('haste');
  });
  it('nothing underfoot (or off the line): attack is the chain', () => {
    const out = play(world([thing('food', 'apple', 200, 900)]), 5, (k) => ({ a: k === 0 }));
    expect(out.s.bodies[0].mv).toBe('chain.1');
    expect(out.s.things.length).toBe(1);
  });
});

describe('brawl things: weapons', () => {
  it('held, the chain swings the blade, harder; knocked down, it is dropped; picked up again', () => {
    const s = world([thing('weapon', 'pipe', 200)], [[1400]]);
    const got = play(s, 20, (k) => ({ a: k === 0 }));
    const me = got.s.bodies[0];
    expect(me.wpn).toBe('pipe');
    expect(ctx.fighters[me.fi].moves['chain.1'].armed).toBe(true);
    expect(ctx.fighters[me.fi].moves['chain.1'].damage).toBeGreaterThan(P.moves['chain.1'].damage);
    // (in to the thug, the chain: a blade's blow)
    const swung = play(got.s, 40, (k, w) => (Math.abs(w.bodies[1].x - w.bodies[0].x) > 800 ? { x: 1 } : { a: k % 6 === 0 }));
    expect(swung.ev.some(([, e]) => e.t === 'hit' && e.p === 0 && e.limb === 'blade')).toBe(true);
    // (the thug sweeps it down: the pipe lies on the street, the player its own self)
    const sweep = Object.keys(P.moves).find((k) => P.moves[k].knock === 'down' && P.moves[k].kind === 'normal' && k.startsWith('crouch'));
    const near = got.s; near.bodies[1].x = near.bodies[0].x + 700;
    const down = play(near, 60, () => ({}), (k) => [k === 2 ? { mv: sweep } : {}]);
    expect(down.ev.some(([, e]) => e.t === 'drop' && e.what === 'pipe')).toBe(true);
    expect(down.s.bodies[0].wpn).toBeUndefined();
    expect(down.s.bodies[0].fi).toBe(0);
    const lying = down.s.things.find((t) => t.what === 'pipe');
    expect(lying).toBeTruthy();
  });
  it('special throws it: it strikes the first foe lined up ahead and lies where it stopped', () => {
    const hold = (crowd) => { const s = world([thing('weapon', 'knife', 200)], crowd); return play(s, 20, (k) => ({ a: k === 0 })).s; };
    const lined = play(hold([[2500]]), 40, (k) => ({ s: k === 0 }));
    expect(lined.ev.some(([, e]) => e.t === 'toss')).toBe(true);
    const hit = lined.ev.find(([, e]) => e.t === 'hit' && e.p === 0 && e.d === 1);
    expect(hit?.[1].dmg).toBe(THINGS.weapon.knife.throw);
    expect(lined.s.bodies[0].wpn).toBeUndefined();
    const knife = lined.s.things.find((t) => t.what === 'knife');
    expect(knife.fly).toBeUndefined();
    expect(knife.x).toBeGreaterThan(1500);
    const off = play(hold([[2500, 1500]]), 40, (k) => ({ s: k === 0 }));
    expect(off.ev.some(([, e]) => e.t === 'hit')).toBe(false);
  });
});

describe('brawl things: boxes', () => {
  it('a player\'s blows break a box, which leaves what it held; off the line, untouched', () => {
    const s = world([thing('box', 'barrel', 800, 0, { holds: { kind: 'food', what: 'meat' } })]);
    const out = play(s, 60, (k) => ({ a: k % 6 === 0 }));
    expect(out.ev.some(([, e]) => e.t === 'break' && e.what === 'barrel')).toBe(true);
    expect(out.s.things).toEqual([expect.objectContaining({ kind: 'food', what: 'meat', x: 800 })]);
    const off = play(world([thing('box', 'barrel', 800, 1200)]), 60, (k) => ({ a: k % 6 === 0 }));
    expect(off.s.things[0].hp).toBe(THINGS.box.barrel.hp);
  });
  it('the crowd\'s blows do not', () => {
    const s = newBrawl(ctx, { bodies: [{ fighter: 0, side: 'player', x: -5000 }, { fighter: 0, side: 'crowd', x: 0, face: 1 }], things: [thing('box', 'barrel', 800)] });
    let w = s;
    for (let k = 0; k < 40; k++) w = stepBrawl(w, [{}, { mv: k % 8 === 0 ? 'chain.1' : undefined }], ctx);
    expect(w.things[0].hp).toBe(THINGS.box.barrel.hp);
  });
});

describe('brawl things: absent, nothing', () => {
  it('a brawl without things carries none', () => {
    const s = world(undefined);
    expect('things' in s).toBe(false);
    expect('things' in play(s, 30, (k) => ({ a: k % 5 === 0 })).s).toBe(false);
  });
});

describe('brawl things: on a street', () => {
  it('each player\'s armed self is compiled for every weapon on the street, a box\'s too', () => {
    const st = streetOf({ belt, players: [{ recipe }], things: [{ kind: 'weapon', what: 'pipe', at: 3 }, { kind: 'box', what: 'crate', at: 6, holds: { kind: 'weapon', what: 'katana' } }] });
    expect(Object.keys(st.ctx.armed).sort()).toEqual(['0:katana', '0:pipe']);
    expect(st.ctx.fighters[st.ctx.armed['0:katana']].weapon.kind).toBe('katana');
    expect(st.s.things.map((t) => t.what)).toEqual(['pipe', 'crate']);
  });
  it('determinism: the same street and buttons, the same brawl', () => {
    const run = () => brawlHash(play(world([thing('weapon', 'pipe', 300), thing('box', 'crate', 1600, 0, { holds: { kind: 'food', what: 'apple' } })], [[2600]]), 200, (k) => ({ a: k % 5 === 0, x: k % 40 < 20 ? 1 : 0, s: k === 90 })).s);
    expect(run()).toBe(run());
  });
});
