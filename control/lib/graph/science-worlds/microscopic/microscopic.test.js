import { describe, it, expect } from 'vitest';
import { solveMicroscopic } from './solve.js';
import { buildMicroscopic, microscopic } from './kernel.js';
import { MICROSCOPIC_LAW, BOLTZMANN } from './laws.js';
import { assembleMicroscopicScene } from './world.js';

// One case per procedure: free diffusion, drift (a flow and a force), a membrane, reversible and enzymatic reactions,
// the regime gates, the drawn subset, gaps and units. Small boxes and short runs; each picks its own smallest model.

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const law = (id) => MICROSCOPIC_LAW[id].example;

describe('science worlds: microscopic', () => {
  it('is deterministic for a seed, and the kernel is one self-contained closure a page can run', () => {
    expect(JSON.stringify(solveMicroscopic({ model: law('brownian') }))).toBe(JSON.stringify(solveMicroscopic({ model: law('brownian') })));
    const page = new Function(`return (${buildMicroscopic.toString()})()`)();
    const sys = {
      box: { lo: [-1e-6, -1e-6, -1e-6], hi: [1e-6, 1e-6, 1e-6], periodic: false },
      species: [{ id: 'a', D: 1e-12, r: 1e-8, v: [0, 0, 0] }, { id: 'b', D: 1e-12, r: 1e-8, v: [0, 0, 0] }],
      particles: Array.from({ length: 20 }, (_, i) => ({ s: 0, x: [0, 0, (i - 10) * 1e-8] })),
      membranes: [{ axis: 0, at: 0, pass: [0.3, 0] }], reactions: [{ from: [0], to: [1], c: 5 }], display: [0, 1, 2], near: true,
    };
    const opts = { dt: 0.002, substeps: 5, samples: 20, interval: 0.01, seed: 3 };
    expect(JSON.stringify(page.run(sys, opts))).toBe(JSON.stringify(microscopic.run(sys, opts)));
  });

  it('spreads as Einstein says for any seed, and Stokes–Einstein gives glucose its measured diffusion coefficient', () => {
    for (const seed of [1, 7]) expect(gateOf(solveMicroscopic({ model: { ...law('brownian'), seed } }), 'closed-form:diffusion').ok).toBe(true);
    const glucose = solveMicroscopic({ model: {
      temperature: '298.15 K', viscosity: '0.89 mPa·s', box: { size: ['1 µm', '1 µm', '1 µm'] },
      species: [{ id: 'glucose', radius: '0.38 nm', count: 1 }], laws: [{ law: 'brownian' }], duration: '1 ms',
    } });
    // measured in water at 25 °C: 6.7 × 10⁻¹⁰ m²/s (Longsworth 1953); Stokes–Einstein from glucose's hydrodynamic radius
    expect(Math.abs(glucose.D[0] - 6.7e-10) / 6.7e-10).toBeLessThan(0.1);
  });

  it('carries a cloud with a flow, and a force sets a speed by Einstein\'s relation (v = F·D / kT)', () => {
    expect(gateOf(solveMicroscopic({ model: law('drift') }), 'closed-form:drift').ok).toBe(true);
    const F = 2e-15;
    const r = solveMicroscopic({ model: { ...law('drift'), laws: [{ law: 'brownian' }, { law: 'drift', force: [F, 0, 0] }] } });
    const v = (F * r.D[0]) / (BOLTZMANN * 310.15);
    expect(Math.abs(r.drift[0][0] - v) / v).toBeLessThan(1e-3);   // the reported speed carries four figures
    expect(gateOf(r, 'closed-form:drift').ok).toBe(true);
  });

  it('lets a permeable species even out across a membrane and holds back one that cannot cross', () => {
    const r = solveMicroscopic({ model: law('membrane') });
    expect(gateOf(r, 'closed-form:membrane:water').ok).toBe(true);
    expect(gateOf(r, 'membrane-holds:sugar').value.crossed).toBe(0);
  });

  it('settles a reversible reaction at its equilibrium constant, and keeps what no reaction can change', () => {
    const r = solveMicroscopic({ model: law('reaction') });
    expect(gateOf(r, 'closed-form:equilibrium').ok).toBe(true);
    expect(gateOf(r, 'moieties-conserved').ok).toBe(true);
    // an enzyme: two conserved combinations (the enzyme's total; substrate, complex and product together)
    const e = solveMicroscopic({ model: {
      box: { size: ['1 µm', '1 µm', '1 µm'] },
      species: [{ id: 'E', radius: '3 nm', count: 10 }, { id: 'S', radius: '1 nm', count: 60 }, { id: 'ES', radius: '3.2 nm', count: 0 }, { id: 'P', radius: '1 nm', count: 0 }],
      laws: [{ law: 'reaction', from: ['E', 'S'], to: ['ES'], rate: '1e8 /M/s', reverse: '100 /s' }, { law: 'reaction', from: ['ES'], to: ['E', 'P'], rate: '50 /s' }],
      duration: '0.5 s',
    } });
    expect(gateOf(e, 'moieties-conserved').value.combinations).toBe(2);
    expect(gateOf(e, 'moieties-conserved').ok).toBe(true);
    expect(gateOf(e, 'closed-form:equilibrium')).toBeUndefined();   // one step runs one way only: no equilibrium to check
    const last = e.series.counts.E.length - 1;
    expect(e.series.counts.E[last] + e.series.counts.ES[last]).toBe(10);
  });

  it('advises when reactions outpace mixing, and when a model leaves the microscopic scale', () => {
    const slow = solveMicroscopic({ model: {
      box: { size: ['50 µm', '50 µm', '50 µm'] }, species: [{ id: 'A', radius: '1 µm', count: 40 }, { id: 'B', radius: '1 µm', count: 0 }],
      laws: [{ law: 'brownian' }, { law: 'reaction', from: ['A'], to: ['B'], rate: '20 /s' }], duration: '0.2 s',
    } });
    expect(gateOf(slow, 'well-mixed').ok).toBe(false);
    expect(slow.held).toBe(false);
    const big = solveMicroscopic({ model: { box: { size: ['1 m', '1 m', '1 m'] }, species: [{ id: 'ball', radius: '1 cm', count: 2 }], laws: [{ law: 'brownian' }], duration: '1 s' } });
    expect(gateOf(big, 'overdamped-regime').ok).toBe(false);
    const tiny = solveMicroscopic({ model: { box: { size: ['10 nm', '10 nm', '10 nm'] }, species: [{ id: 'quark', radius: '0.001 nm', count: 2 }], laws: [{ law: 'brownian' }], duration: '1 ns' } });
    expect(gateOf(tiny, 'molecular-regime').ok).toBe(false);
  });

  it('stands spheres for many molecules when asked, and draws a share of them when there are many', () => {
    const r = solveMicroscopic({ model: { box: { size: ['1 µm', '1 µm', '1 µm'] }, represents: 1000, species: [{ id: 'glucose', radius: '0.38 nm', concentration: '1 mM' }], laws: [{ law: 'brownian' }], duration: '1 ms' } });
    expect(r.stats.spheres).toBe(602);   // 1 mM in a cubic micrometre is about 602,000 molecules
    expect(r.stats.molecules).toBe(602000);
    expect(r.assumptions.some((a) => /stands for 1000 molecules/.test(a))).toBe(true);
    expect(r.shownLiberties[0].what).toMatch(/300 of the 602 spheres are drawn/);
    expect(r.tracks.particles.length).toBe(300);
    expect(() => solveMicroscopic({ model: { box: { size: ['1 µm', '1 µm', '1 µm'] }, species: [{ id: 'g', radius: '0.38 nm', concentration: '1 mM' }], laws: [], duration: '1 ms' } })).toThrow(/raise `represents`/);
  });

  it('names a missing law as a gap with its scale or what to compose instead, and reads units with their dimension', () => {
    const r = solveMicroscopic({ model: { ...law('brownian'), laws: [{ law: 'brownian' }, { law: 'gravity-uniform' }, { law: 'orbital' }, { law: 'enzyme' }] } });
    expect(r.gaps.map((g) => g.why).join(' | ')).toMatch(/classical.*\|.*quantum.*\|.*reaction rows/);
    expect(gateOf(r, 'closed-form:diffusion').ok).toBe(true);
    expect(() => solveMicroscopic({ model: { ...law('reaction'), laws: [{ law: 'reaction', from: ['A'], to: ['B'], rate: '2 /M/s' }] } })).toThrow(/wants a frequency/);
    expect(() => solveMicroscopic({ model: { ...law('brownian'), box: { size: ['20 s', 1, 1] } } })).toThrow(/wants a length/);
  });

  it('never lets the dress reach the model, and lays the run out as lifetimes on the page clock', () => {
    const plain = solveMicroscopic({ model: law('reaction') });
    const dressed = solveMicroscopic({ model: law('reaction'), dress: { species: { A: { color: '#ff0000' } } } });
    expect(JSON.stringify(dressed.tracks)).toBe(JSON.stringify(plain.tracks));
    const payload = assembleMicroscopicScene({ kind: 'microscopic-view', model: law('reaction') });
    const lifetimes = payload.movers;
    expect(lifetimes.every((m) => m.t1 >= m.t0 && m.t1 <= payload.science.period + 1e-9)).toBe(true);
    expect(lifetimes.some((m) => m.vanish)).toBe(true);   // a molecule that reacts ends its track
    expect(payload.science.honesty.sections.find((s) => s.head === 'Drawn, not real').items.some((i) => /drawn .*× its size/.test(i.text))).toBe(true);
  });
});
