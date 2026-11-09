import { describe, it, expect } from 'vitest';
import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus, versusHash } from './versus-core.js';
import { solveFighter } from './versus-solver.js';
import { BTN } from './versus-input.js';
import { STATES, STATE_IDS, SUPERS, SPECIALS, METER_MAX } from './versus-library.js';

// TIMED STATES and THE PRICE, in the fight: an install super grants a state (harder, faster, unflinching) for a while;
// the desperation spin strikes all round and costs its thrower health when it lands. A fighter that takes none fights
// to the byte as before.
const Z = { x: 0, y: 0, b: 0 };
const base = solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe;
const K = compileFighter(base);
const install = Object.keys(SUPERS).find((id) => SUPERS[id].install);
const desperation = Object.keys(SPECIALS).find((id) => SPECIALS[id].price);
function fight(fighters, d = 700) {
  const ctx = { fighters };
  let s = newVersus(ctx, { schemes: ['modern', 'modern'], rules: { intro: 1 } });
  s = stepVersus(s, [Z, Z], ctx);
  s.p[0].x = -Math.round(d / 2); s.p[1].x = Math.round(d / 2);
  return { s, ctx };
}
function run(s, ctx, n, fn) {
  const ev = [];
  for (let k = 0; k < n; k++) { s = stepVersus(s, fn(k, s), ctx); for (const e of s.events) ev.push([k, e]); }
  return { s, ev };
}
const jabDamage = (ev) => ev.filter(([, e]) => e.t === 'hit' && e.p === 0).map(([, e]) => e.dmg)[0];

describe('states: the shelf', () => {
  it('each state is a while long and touches something; an install super grants one and strikes nothing', () => {
    for (const id of STATE_IDS) {
      const S = STATES[id];
      expect(Number.isInteger(S.frames) && S.frames > 0, id).toBe(true);
      expect(S.damage !== undefined || S.speed !== undefined || S.armor, id).toBe(true);
    }
    const F = compileFighter({ ...base, super: { id: install } });
    expect(F.moves.super.install).toBe(SUPERS[install].install);
    expect(F.moves.super.frames.some((fr) => fr && fr.hit)).toBe(false);
    expect(() => compileFighter({ ...base, library: { supers: { mine: { from: install, install: 'moonlight' } } }, super: { id: 'mine' } })).toThrow(/state/);
  });
});

describe('states: in the fight', () => {
  const F = compileFighter({ ...base, super: { id: install } });
  const installed = () => {
    const { s, ctx } = fight([F, K]);
    s.p[0].meter = METER_MAX;
    // (modern: S + H the super)
    return run(s, ctx, 80, (k) => [k === 1 ? { x: 0, y: 0, b: BTN.S | BTN.H } : Z, Z]);
  };
  it('the install grants its state as it starts, and it runs out', () => {
    const { s, ev } = installed();
    expect(ev.some(([, e]) => e.t === 'state' && e.id === SUPERS[install].install)).toBe(true);
    expect(s.p[0].ist[0]).toBe(SUPERS[install].install);
    const left = s.p[0].ist[1];
    const { s: after } = run(s, { fighters: [F, K] }, left + 2, () => [Z, Z]);
    expect(after.p[0].ist).toBeUndefined();
  });
  it('under power, a jab deals its state\'s share more; under iron, a jab lands no stun', () => {
    const plain = fight([K, K]);
    const d0 = jabDamage(run(plain.s, plain.ctx, 20, (k) => [k === 1 ? { x: 0, y: 0, b: BTN.L } : Z, Z]).ev);
    const p = fight([K, K]); p.s.p[0].ist = ['power', 300];
    const d1 = jabDamage(run(p.s, p.ctx, 20, (k) => [k === 1 ? { x: 0, y: 0, b: BTN.L } : Z, Z]).ev);
    expect(d1).toBe(Math.floor((d0 * STATES.power.damage) / 100));
    const i = fight([K, K]); i.s.p[1].ist = ['iron', 300];
    const hit = run(i.s, i.ctx, 20, (k) => [k === 1 ? { x: 0, y: 0, b: BTN.L } : Z, Z]);
    expect(hit.ev.some(([, e]) => e.t === 'armor' && e.state === 'iron')).toBe(true);
    expect(hit.s.p[1].hp).toBeLessThan(K.hp);
    expect(hit.ev.some(([, e]) => e.t === 'hit')).toBe(false);
  });
  it('under haste, the walk covers its state\'s share more', () => {
    const walk = (ist) => { const f = fight([K, K], 3000); if (ist) f.s.p[0].ist = ist; return run(f.s, f.ctx, 30, () => [{ x: 1, y: 0, b: 0 }, Z]).s.p[0].x - f.s.p[0].x; };
    expect(walk(['haste', 300])).toBe(Math.round(walk(null) * STATES.haste.speed / 100));
  });
});

describe('the desperation: all round, paid for when it lands', () => {
  const F = compileFighter({ ...base, specials: { ...base.specials, down: { id: desperation } } });
  const m = F.moves['special.down.M'];
  it('its box reaches behind as far as in front, it is invincible through its blows', () => {
    const box = m.frames[m.startup].hit;
    expect(box[0]).toBe(-box[2]);
    expect(m.invuln.some(([a, b, k]) => a === 1 && b >= m.startup + m.active - 1 && k === 'strike')).toBe(true);
    expect(m.price).toBe(SPECIALS[desperation].price);
  });
  // (modern: S + down the special at down)
  const spin = (k) => (k === 1 ? { x: 0, y: -1, b: BTN.S } : Z);
  it('it costs its price when it lands, once; whiffed, nothing', () => {
    const near = fight([F, K], 600);
    const hit = run(near.s, near.ctx, 40, (k) => [spin(k), Z]);
    expect(hit.ev.some(([, e]) => e.t === 'hit' && e.p === 0)).toBe(true);
    expect(hit.s.p[0].hp).toBe(F.hp - m.price);
    const far = fight([F, K], 3000);
    expect(run(far.s, far.ctx, 40, (k) => [spin(k), Z]).s.p[0].hp).toBe(F.hp);
  });
  it('never the last of the health', () => {
    const near = fight([F, K], 600); near.s.p[0].hp = 10;
    expect(run(near.s, near.ctx, 40, (k) => [spin(k), Z]).s.p[0].hp).toBe(1);
  });
});

describe('states: absent, nothing', () => {
  it('a fighter that takes none carries no state and plays as it did', () => {
    const play = () => { const { s, ctx } = fight([K, K], 1600); return run(s, ctx, 200, (k) => [{ x: 1, y: 0, b: k % 30 === 5 ? BTN.M : 0 }, { x: -1, y: 0, b: k % 40 === 9 ? BTN.H : 0 }]).s; };
    const s = play();
    expect(s.p.every((p) => !('ist' in p))).toBe(true);
    expect(versusHash(s)).toBe(versusHash(play()));
  });
});
