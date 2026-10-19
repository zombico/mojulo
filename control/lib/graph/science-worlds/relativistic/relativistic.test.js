import { describe, it, expect } from 'vitest';
import { solveRelativistic } from './solve.js';
import { RELATIVISTIC_LAW } from './laws.js';
import { traceRay, shadowAngle, B_CRIT, LIGHT_SCHEME, eyeToCoordinate } from './geodesic.js';
import { lightShader } from './light-shader.js';
import { assembleRelativisticScene } from './world.js';

// One case per procedure: light (the shadow, the bending, the eye's correction, the drawn scheme), matter (a bound
// orbit's advance, a plunge, an escape), clocks (still and falling), gaps and units, and the page per system. Each
// picks its own smallest model; two are textbook signposts (Mercury's 43″ a century, GPS's 45.7 µs a day).

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const law = (id) => RELATIVISTIC_LAW[id].example;
const SUN = { law: 'schwarzschild', mass: '1 M☉' };

describe('science worlds: relativistic', () => {
  it('is deterministic, and the dress never reaches the model', () => {
    expect(JSON.stringify(solveRelativistic({ model: law('body') }))).toBe(JSON.stringify(solveRelativistic({ model: law('body') })));
    const plain = solveRelativistic({ model: law('disk') }), dressed = solveRelativistic({ model: law('disk'), dress: { sky: 'stars', hottest: 12000 } });
    expect(dressed.gates).toEqual(plain.gates);
    expect(dressed.observed).toEqual(plain.observed);
  });

  it('captures light below 3√3/2 Rs, bends the rest by the exact angle, and the drawn scheme resolves both', () => {
    const r = solveRelativistic({ model: law('observer') });
    for (const id of ['closed-form:shadow', 'closed-form:deflection', 'scheme-resolves']) expect(gateOf(r, id).ok, id).toBe(true);
    expect(traceRay([30, 0, 0], [-1, 0, 0]).fate).toBe('captured');
    expect(traceRay([30, 0, 0], [-0.8, 0.6, 0]).fate).toBe('escaped');
    // a still observer at 30 Rs sees the shadow by Synge's formula, larger than the bare impact parameter suggests
    expect(shadowAngle(30)).toBeCloseTo(Math.asin((B_CRIT * Math.sqrt(1 - 1 / 30)) / 30), 12);
    const d = eyeToCoordinate([30, 0, 0], [-Math.cos(0.1), Math.sin(0.1), 0]);
    expect(d[1] / Math.hypot(d[0], d[1])).toBeCloseTo(Math.sin(0.1) / Math.sqrt(1 - 1 / 30), 12);
  });

  it('turns Mercury\'s orbit by 43″ a century, and a star near a black hole by its exact advance each lap', () => {
    const merc = solveRelativistic({ model: { system: 'orbit', laws: [SUN, { law: 'body', id: 'mercury', at: ['46001200 km', 0, 0], v: [0, '58.98 km/s', 0] }], duration: '1 yr' } });
    expect(gateOf(merc, 'closed-form:advance:mercury').ok).toBe(true);
    expect(Math.abs(merc.observed.mercury['advance per century'].value - 42.98) / 42.98).toBeLessThan(0.005);   // Le Verrier's anomaly, Einstein 1915
    const star = solveRelativistic({ model: { system: 'orbit', laws: [SUN, { law: 'body', id: 'star', at: ['20 Rs', 0, 0], v: [0, '0.12 c', 0] }], duration: '200 ms' } });
    expect(gateOf(star, 'closed-form:advance:star').ok).toBe(true);
    expect(gateOf(star, 'energy-held:star').ok).toBe(true);
    expect(gateOf(star, 'closed-form:isco').value.measured.radius).toBe(3);
  });

  it('plunges a body with too little angular momentum, and lets a fast one escape, as their effective potentials say', () => {
    const r = solveRelativistic({ model: { system: 'orbit', duration: '5 ms', laws: [SUN,
      { law: 'body', id: 'plunger', at: ['8 Rs', 0, 0], v: [0, '0.05 c', 0] }, { law: 'body', id: 'runner', at: ['8 Rs', 0, 0], v: ['0.3 c', '0.4 c', 0] }] } });
    expect(r.observed.plunger.fate).toBe('plunge');
    expect(r.observed.runner.fate).toBe('escape');
    expect(gateOf(r, 'closed-form:fate:plunger').ok).toBe(true);
    expect(gateOf(r, 'closed-form:fate:runner').ok).toBe(true);
  });

  it('slows still clocks by √(1 − Rs/r) (GPS: 45.7 µs a day), and a falling clock runs out of time at the horizon', () => {
    const gps = solveRelativistic({ model: law('clock') });
    expect(gps.observed['between the first and last still clocks, per day'].value * 1e6).toBeCloseTo(45.7, 1);   // Ashby 2003
    const fall = solveRelativistic({ model: law('schwarzschild') });
    expect(gateOf(fall, 'closed-form:fall:clock-3').ok).toBe(true);
    const tau = fall.run.clocks[2].tau;
    expect(tau[tau.length - 1]).toBe(tau[tau.length - 2]);   // frozen, to the far clock, just outside the horizon
  });

  it('names a missing law as the row that is, the scale that owns it, or why there is none; and reads units', () => {
    const r = solveRelativistic({ model: { ...law('observer'), laws: [...law('observer').laws, { law: 'kerr' }, { law: 'lensing' }, { law: 'gravity-uniform' }] } });
    expect(r.gaps.map((g) => g.why).join(' | ')).toMatch(/spinning hole.*\|.*light world.*\|.*classical/);
    const base = law('body');
    expect(() => solveRelativistic({ model: { ...base, laws: [SUN, { law: 'body', id: 'x', at: ['20 Rs', 0, 0], v: [0, '1.2 c', 0] }] } })).toThrow(/below the speed of light/);
    expect(() => solveRelativistic({ model: { ...law('disk'), laws: [...law('disk').laws.slice(0, 2), { law: 'disk', inner: '2 Rs', outer: '10 Rs' }] } })).toThrow(/innermost stable orbit/);
    expect(() => solveRelativistic({ model: { ...base, laws: base.laws.slice(1) } })).toThrow(/exactly one/);
    expect(() => solveRelativistic({ model: { ...base, laws: [...base.laws, { law: 'clock', at: '10 Rs' }] } })).toThrow(/belongs to the clocks system/);
    expect(() => solveRelativistic({ model: { ...base, laws: [{ law: 'schwarzschild', mass: '3 km' }, base.laws[1]] } })).toThrow(/wants a mass/);
  });

  it('draws light with a shader made from the drawn scheme\'s own numbers, and orbits and clocks with meshes', () => {
    const { layer } = lightShader({ inner: 3, outer: 12 });
    expect(layer.frag).toContain(`const float K_STEP = ${LIGHT_SCHEME.k};`);
    expect(layer.frag).toContain(`const int MAX_STEPS = ${LIGHT_SCHEME.maxSteps};`);
    expect(layer.customUniforms).toMatchObject({ uInner: 3, uOuter: 12 });
    const light = assembleRelativisticScene({ kind: 'relativistic-view', model: law('disk') });
    expect(light.effects).toHaveLength(1);
    expect(light.science.probe.frag).toContain('sciValue(a, b)');
    expect(light.science.noClock).toBe(true);
    expect(light.cameras[0].name).toBe('observer');
    expect(light.science.honesty.sections.map((s) => s.head)).toEqual(expect.arrayContaining(['Drawn by a shader', 'Sources (reviewed 2026-10-19)']));
    const orbit = assembleRelativisticScene({ kind: 'relativistic-view', model: law('body') });
    expect(orbit.effects).toBeUndefined();
    expect(orbit.movers.every((m) => m.track)).toBe(true);
    const clocks = assembleRelativisticScene({ kind: 'relativistic-view', model: law('schwarzschild') });
    expect(clocks.science.rows.map((r) => r.html)).toContain('falls from 300 km: own time');
    expect(() => assembleRelativisticScene({ kind: 'relativistic-view', model: law('body'), dress: { sky: 'clouds' } })).toThrow(/'grid' or 'stars'/);
  });
});
