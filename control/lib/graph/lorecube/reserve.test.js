// A pool of power, and which of the runtime's gauges carries it: a map over what exists, and what no gauge does.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPENDS, REFILLS, EMPTIES, CARRIERS, CARRIER_IDS, RESERVE, newReserve, intensifyReserve, readReserve, carriersOf, reserveLaws } from './reserve.js';
import { depthOf, openOf, rawNewCeiling, checkPass } from './passes.js';

const CONTROL = new URL('../../../', import.meta.url);
const by = (laws) => Object.fromEntries(laws.map((l) => [l.law, l]));
// a gauge by what it does, picked from the table (a row is an input; the procedure is the match)
const gaugeFor = (spend) => CARRIER_IDS.find((id) => CARRIERS[id].spends.includes(spend));

describe('the gauges are the runtime\'s own', () => {
  it('each names modules that exist, and speaks only the reserve\'s words', () => {
    for (const [id, C] of Object.entries(CARRIERS)) {
      for (const m of [C.lowers, C.runs]) expect(existsSync(fileURLToPath(new URL(m, CONTROL))), `${id} ${m}`).toBe(true);
      for (const s of C.spends) expect(SPENDS, `${id} spends ${s}`).toHaveProperty(s);
      for (const r of C.refills) expect(REFILLS, `${id} refills ${r}`).toHaveProperty(r);
      for (const e of C.empty) expect(EMPTIES, `${id} empty ${e}`).toHaveProperty(e);
      expect(['world', 'hero', 'member']).toContain(C.scope);
    }
  });
});

describe('a reserve, made in passes', () => {
  const premise = { name: 'inner fire', spent: ['special'] };

  it('raw-new makes a name and what empties it, and stops there', () => {
    const R = newReserve(premise);
    expect(R).toEqual(premise);
    expect(depthOf(RESERVE, R)).toBe(1);
    expect(rawNewCeiling(RESERVE)).toBe(1);
    for (const l of checkPass(RESERVE, 'raw-new', null, R)) expect(l.ok, l.law).toBe(true);
    expect(openOf(RESERVE, R)).toEqual({ rung: 'flow', missing: ['refill', 'empty'] });
    expect(() => newReserve({ ...premise, refill: ['time'], numbers: { cap: 100 } })).toThrow(/refill is not a raw-new pass's.*refill, numbers are the next passes'/);
  });

  it('intensify adds the rungs in order and never touches what was there', () => {
    const R = newReserve(premise);
    const flow = intensifyReserve(R, { refill: ['time', 'hit'], empty: ['refused'] });
    expect(flow.open).toEqual(['numbers']);
    const measured = intensifyReserve(flow.reserve, { numbers: { cap: 100, regen: 4, costs: { special: 25 } } });
    expect(measured.open).toEqual(['carriers']);
    const carried = intensifyReserve(measured.reserve, { carriers: [gaugeFor('special')] });
    expect(carried.open).toEqual([]);
    expect(depthOf(RESERVE, carried.reserve)).toBe(4);
    for (const l of checkPass(RESERVE, 'intensify', R, carried.reserve)) expect(l.ok, l.law).toBe(true);
    // several rungs in one pass is one intensification; a rung out of order stands on nothing
    expect(depthOf(RESERVE, intensifyReserve(R, { refill: ['never'], empty: ['refused'], numbers: { cap: 3 } }).reserve)).toBe(3);
    expect(() => intensifyReserve(R, { numbers: { cap: 100 } })).toThrow(/measured is said before its flow \(refill, empty\)/);
    expect(() => intensifyReserve(R, { spent: ['guard'] })).toThrow(/is its premise/);
    expect(() => intensifyReserve(flow.reserve, { refill: ['rest'] })).toThrow(/already said/);
  });

  it('half a rung is not the rung: a flow with no empty is still open', () => {
    const half = intensifyReserve(newReserve(premise), { refill: ['time'] });
    expect(half.open).toEqual(['empty']);
    expect(depthOf(RESERVE, half.reserve)).toBe(1);
  });

  it('says what is wrong', () => {
    expect(() => readReserve({ name: '', spent: ['special'] })).toThrow(/name is what the lore calls it/);
    expect(() => readReserve({ name: 'ki', spent: ['prayer'] })).toThrow(/'prayer' is not what empties it/);
    expect(() => readReserve({ name: 'ki', spent: [] })).toThrow(/list of what empties it/);
    expect(() => readReserve({ name: 'ki', spent: ['special'], refill: ['never', 'time'] })).toThrow(/never, or the ways it comes back/);
    expect(() => readReserve({ name: 'ki', spent: ['special'], numbers: { cap: 0 } })).toThrow(/cap is how much it holds/);
    expect(() => readReserve({ name: 'ki', spent: ['special'], numbers: { cap: 10, start: 11 } })).toThrow(/from 0 to its cap/);
    expect(() => readReserve({ name: 'ki', spent: ['special'], numbers: { cap: 10, costs: { guard: 1 } } })).toThrow(/no spend of this reserve/);
    expect(() => readReserve({ name: 'ki', spent: ['special'], carriers: ['soul-gauge'] })).toThrow(/not a gauge of the runtime/);
    expect(() => readReserve({ name: 'ki', spent: ['special'], colour: 'blue' })).toThrow(/colour is not part of a reserve/);
  });
});

describe('carriersOf', () => {
  it('finds the gauge that carries a reserve whole, first', () => {
    const C = carriersOf({ name: 'mana', spent: ['special'], refill: ['time'], empty: ['refused'] });
    expect(C.carriers[0]).toMatchObject({ id: gaugeFor('special'), carries: ['special'], lacks: [], fits: true });
    expect(C.uncarried).toEqual([]);
    expect(C).not.toHaveProperty('split');
  });

  it('says what a gauge cannot do of the reserve\'s flow', () => {
    // a reserve that comes back only by resting, spent on a special: the gauge that spends on specials refills otherwise
    const C = carriersOf({ name: 'vow', spent: ['special'], refill: ['rest'], empty: ['refused'] });
    expect(C.carriers[0].fits).toBe(false);
    expect(C.carriers[0].lacks).toEqual(['refill rest']);
  });

  it('a reserve whose spends land on two gauges is split: one in the lore, two bars on the runtime', () => {
    const C = carriersOf({ name: 'breath', spent: ['special', 'guard'] });
    expect(C.carriers.map((c) => c.id).sort()).toEqual([gaugeFor('special'), gaugeFor('guard')].sort());
    expect(C.carriers.every((c) => !c.fits)).toBe(true);
    expect(C.split).toMatch(/one reserve in the lore, 2 gauges/);
    // two spends one gauge carries are one meter
    const one = CARRIER_IDS.find((id) => CARRIERS[id].spends.length > 1);
    expect(carriersOf({ name: 'air', spent: [...CARRIERS[one].spends] })).not.toHaveProperty('split');
  });

  it('names the spend no gauge carries, and the smallest change that would', () => {
    const uncarried = Object.keys(SPENDS).filter((s) => !gaugeFor(s));
    expect(uncarried).toEqual(['imbue']);
    const C = carriersOf({ name: 'cursed energy', spent: ['special', 'imbue'] });
    expect(C.uncarried).toHaveLength(1);
    expect(C.uncarried[0].spend).toBe('imbue');
    expect(C.uncarried[0].says).toMatch(/modifier only picks another move.*smallest change/);
  });
});

describe('reserveLaws', () => {
  it('a reserve one gauge carries whole holds every law', () => {
    for (const l of reserveLaws({ name: 'mana', spent: ['special'], refill: ['time', 'hit'], empty: ['refused'] })) expect(l.ok, l.law).toBe(true);
  });

  it('says a spend with no gauge, and a reserve split across meters', () => {
    const L = by(reserveLaws({ name: 'cursed energy', spent: ['imbue', 'special', 'move'] }));
    expect(L['every-spend-carried']).toMatchObject({ ok: false, value: 'imbue' });
    expect(L['one-meter'].ok).toBe(false);
    expect(L.returns.value).toBe('not said yet');
  });

  it('is deterministic', () => {
    const R = { name: 'ki', spent: ['special', 'sustain'], refill: ['time'], empty: ['refused'] };
    expect(carriersOf(R)).toEqual(carriersOf(R));
    expect(reserveLaws(R)).toEqual(reserveLaws(R));
  });
});
