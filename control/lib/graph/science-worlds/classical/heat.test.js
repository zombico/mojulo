import { describe, it, expect } from 'vitest';
import { solveClassical } from './solve.js';
import { CLASSICAL_LAW } from './laws.js';
import { MATTER, TRANSPORT } from '../../rupa/matter.js';
import { temperature } from '../contract.js';

// Heat on classical bodies: one case per procedure (convection alone against Newton's closed form, conduction between
// two bodies, a hot plate, the latent heat at a melting point, the lumped check, a hot body struck), the unit reader,
// the refusals, and the absent-channel rule.

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const C0 = 273.15;
const ball = (id, matter, temp, at = [0, 0, 0], r = '2 cm') => ({ id, matter, radius: r, at, fixed: true, temperature: temp });

describe('science worlds: heat on classical bodies', () => {
  it('adds nothing to a model with no heat law', () => {
    const r = solveClassical({ model: CLASSICAL_LAW.collision.example });
    expect(r.heat).toBeUndefined();
    expect(r.series.T).toBeUndefined();
    expect(r.gates.some((g) => g.id.startsWith('heat'))).toBe(false);
  });

  it('reads a temperature in kelvin, Celsius or Fahrenheit, and refuses the coulomb', () => {
    expect(temperature('20 °C', 'x')).toBeCloseTo(293.15, 9);
    expect(temperature([212, '°F'], 'x')).toBeCloseTo(373.15, 9);
    expect(temperature(300, 'x')).toBe(300);
    expect(() => temperature('20 C', 'x')).toThrow(/coulomb/);
    expect(() => temperature(-1, 'x')).toThrow(/absolute zero/);
  });

  it('cools a lone body by convection alone exactly as Newton\'s law says, and closes its books', () => {
    const r = solveClassical({ model: { bodies: [ball('b', 'steel', '200 °C')], laws: [{ law: 'heat', radiation: false }], duration: 2000 } });
    expect(gateOf(r, 'closed-form:cooling').ok).toBe(true);
    expect(gateOf(r, 'heat-conserved').ok).toBe(true);
    expect(r.heat.bodies.b.end.C).toBeLessThan(200);
    expect(r.heat.bodies.b.end.C).toBeGreaterThan(20);
    // radiation on loses more, and the closed form no longer applies
    const lit = solveClassical({ model: { bodies: [ball('b', 'steel', '200 °C')], laws: [{ law: 'heat' }], duration: 2000 } });
    expect(lit.heat.bodies.b.end.K).toBeLessThan(r.heat.bodies.b.end.K);
    expect(gateOf(lit, 'closed-form:cooling')).toBeUndefined();
  });

  it('passes heat between touching bodies until they meet at their capacity-weighted mean, losing none', () => {
    const r = solveClassical({ model: {
      bodies: [ball('hot', 'aluminium', '300 °C'), ball('cold', 'steel', '0 °C', [0.04, 0, 0])],
      laws: [{ law: 'heat', radiation: false, h: 1e-12 }], duration: 4000,
    } });
    const cap = (id) => r.heat.bodies[id].capacity.value;
    const mean = (cap('hot') * (300 + C0) + cap('cold') * C0) / (cap('hot') + cap('cold'));
    expect(r.heat.bodies.hot.end.K).toBeCloseTo(mean, 0);
    expect(r.heat.bodies.cold.end.K).toBeCloseTo(mean, 0);
    expect(gateOf(r, 'heat-conserved').ok).toBe(true);
    expect(r.heat.passed.value).toBeGreaterThan(0);
    // apart, they keep their own
    const apart = solveClassical({ model: {
      bodies: [ball('hot', 'aluminium', '300 °C'), ball('cold', 'steel', '0 °C', [1, 0, 0])],
      laws: [{ law: 'heat', radiation: false, h: 1e-12 }], duration: 4000,
    } });
    expect(apart.heat.bodies.hot.end.C).toBeCloseTo(300, 3);
  });

  it('warms a body resting on a hot plate, and refuses a plate at a temperature with no matter', () => {
    const plate = (extra) => ({ law: 'plane', id: 'plate', ...extra });
    const body = { id: 'b', matter: 'steel', radius: '1 cm', at: [0, 0, 0.01], on_plane: 'plate' };
    const r = solveClassical({ model: { bodies: [body], laws: [{ law: 'gravity-uniform' }, plate({ matter: 'steel', temperature: '250 °C' }), { law: 'heat' }], duration: 300 } });
    expect(r.heat.bodies.b.end.C).toBeGreaterThan(100);
    expect(r.heat.left.planes).toBeLessThan(0);   // heat came in from the plate
    expect(gateOf(r, 'heat-conserved').ok).toBe(true);
    expect(() => solveClassical({ model: { bodies: [body], laws: [{ law: 'gravity-uniform' }, plate({ temperature: '250 °C' }), { law: 'heat' }], duration: 1 } })).toThrow(/through its matter/);
  });

  it('holds a body at its melting point while the latent heat goes in, and advises that it melts', () => {
    const r = solveClassical({ model: {
      bodies: [ball('cube', 'ice', '-5 °C', [0, 0, 0], '1 cm')], laws: [{ law: 'heat', medium: 'water', ambient: '20 °C' }], duration: 120,
    } });
    const T = r.series.T.cube;
    expect(Math.min(...T)).toBeCloseTo(268.15, 6);
    expect(T.filter((x) => Math.abs(x - MATTER.ice.melt - C0) < 1e-9).length).toBeGreaterThan(10);
    expect(r.heat.bodies.cube.molten.end).toBeGreaterThan(0);
    expect(gateOf(r, 'bodies-solid').ok).toBe(false);
    expect(r.heat.h.from).toMatch(/liquid/);
  });

  it('says when one temperature cannot stand for a body: a big body of the worst conductor', () => {
    const worst = Object.keys(TRANSPORT).filter((id) => MATTER[id].family !== 'gas' && MATTER[id].family !== 'liquid' && MATTER[id].heat)
      .sort((a, b) => TRANSPORT[a].k - TRANSPORT[b].k)[0];
    const r = solveClassical({ model: { bodies: [ball('log', worst, '60 °C', [0, 0, 0], '0.5 m')], laws: [{ law: 'heat' }], duration: 60 } });
    expect(gateOf(r, 'lumped-holds').ok).toBe(false);
  });

  it('weakens a hot body when it is struck: the same drop dents cold lead and breaks it near its melting point', () => {
    const drop = (temp) => solveClassical({ model: {
      bodies: [{ id: 'slug', matter: 'lead', radius: 0.02, at: [0, 0, 2], ...(temp ? { temperature: temp } : {}) }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', matter: 'steel' }], duration: 0.8,
    } });
    expect(drop(null).matter.bodies.slug.worst).toBe('dents');
    expect(drop('325 °C').matter.bodies.slug.worst).toBe('breaks');
  });

  it('refuses a heat law on a body with nothing to hold heat', () => {
    expect(() => solveClassical({ model: { bodies: [{ id: 'b', mass: 1, radius: 0.1, at: [0, 0, 0] }], laws: [{ law: 'heat', on: ['b'] }], duration: 1 } })).toThrow(/matter and a radius/);
    expect(() => solveClassical({ model: { bodies: [{ id: 'b', mass: 1, radius: 0.1, at: [0, 0, 0] }], laws: [{ law: 'heat' }], duration: 1 } })).toThrow(/give one a matter/);
  });
});
