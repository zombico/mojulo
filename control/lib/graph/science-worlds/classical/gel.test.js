import { describe, it, expect } from 'vitest';
import { solveClassical } from './solve.js';
import { CLASSICAL_LAW } from './laws.js';
import { MATTER } from '../../rupa/matter.js';
import { filmFlux, holdCapacity, BERIS_Y, readCurve, curveAt } from './gel.js';

// A liquid that sets: one case per procedure (Stokes's speed in a liquid that does not set, a body held once the yield
// carries it, a layer that flows then holds, the curve between its points), the refusals, the absent-channel rule.

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const C = (n) => n.toPrecision(12);
const sink = (gelling, extra = {}) => ({
  bodies: [{ id: 'ball', matter: 'steel', radius: '2 mm', at: [0, 0, 0] }],
  laws: [{ law: 'gravity-uniform' }, { law: 'buoyancy', medium: gelling.medium, surface: 1 }, { law: 'gelling', ...gelling }], duration: 3, ...extra,
});

describe('science worlds: a liquid that sets', () => {
  it('adds nothing to a model with no gelling law', () => {
    const r = solveClassical({ model: CLASSICAL_LAW['drag-linear'].example });
    expect(r.gel).toBeUndefined();
    expect(r.series.eta).toBeUndefined();
  });

  it('lets a ball sink at Stokes\'s speed through a liquid that does not set', () => {
    const r = solveClassical({ model: sink({ medium: 'honey' }) });
    expect(gateOf(r, 'closed-form:viscometer').ok).toBe(true);
    expect(r.gel.bodies.ball.held).toBeNull();
  });

  it('holds the ball exactly when the yield reaches Beris\'s threshold for it, and never past it', () => {
    const r = solveClassical({ model: CLASSICAL_LAW.gelling.example });
    const ball = r.model.bodies[0], honey = MATTER.honey, g = 9.8;
    const net = (ball.mass - honey.density * (4 / 3) * Math.PI * ball.radius ** 3) * g;
    const tauHold = net / holdCapacity(ball.radius);
    expect(tauHold).toBeCloseTo(BERIS_Y * (MATTER.steel.density - honey.density) * g * 2 * ball.radius, 9);
    // the example's yield climbs linearly from 0 to 100 Pa over 20 s
    expect(r.gel.bodies.ball.held.from).toBeCloseTo((tauHold / 100) * 20, 1);
    expect(gateOf(r, 'yield-holds').ok).toBe(true);
    expect(r.tracks.bodies.ball.v.at(-1)).toEqual([0, 0, 0]);
  });

  it('flows a layer as a Bingham film until its yield passes ρ·g·h·sinθ, then holds it', () => {
    const r = solveClassical({ model: CLASSICAL_LAW.gelling.example });
    expect(gateOf(r, 'closed-form:bingham-film').ok).toBe(true);
    const stress = MATTER.honey.density * 9.8 * 0.005;
    expect(r.gel.layer.holdsAtYield.value).toBeCloseTo(stress, 3);
    expect(r.gel.layer.holds.from).toBeCloseTo((stress / 100) * 20, 1);
    expect(r.gel.layer.travelled.value).toBeGreaterThan(0);
    // a gentler slope holds sooner
    expect(filmFlux(1420, 9.8, Math.PI / 6, 0.005, 50, stress / 2 + 1e-9)).toBe(0);
  });

  it('moves the viscosity by its logarithm and the yield linearly between points, keeping what a point leaves out', () => {
    const c = readCurve([{ at: 10, viscosity: 1000 }, { at: 20, yield: 50 }], MATTER.honey, 'curve');
    expect(C(curveAt(c, 5).eta)).toBe(C(Math.sqrt(10 * 1000)));
    expect(curveAt(c, 15).eta).toBeCloseTo(1000, 9);
    expect(curveAt(c, 15).tau).toBeCloseTo(25, 12);
    expect(() => readCurve([{ at: 5 }, { at: 2 }], MATTER.honey, 'curve')).toThrow(/forward in time/);
  });

  it('refuses a gas, a missing medium, and a second gelling law', () => {
    expect(() => solveClassical({ model: sink({ medium: 'air' }) })).toThrow(/a gas does not set|a liquid sets/);
    expect(() => solveClassical({ model: { bodies: [{ id: 'b', mass: 1, radius: 0.01, at: [0, 0, 0] }], laws: [{ law: 'gelling' }], duration: 1 } })).toThrow(/needs medium/);
    const two = sink({ medium: 'honey' });
    two.laws.push({ law: 'gelling', medium: 'mud' });
    expect(() => solveClassical({ model: two })).toThrow(/one gelling law/);
  });
});
