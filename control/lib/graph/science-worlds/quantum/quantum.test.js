import { describe, it, expect } from 'vitest';
import { solveQuantum } from './solve.js';
import { QUANTUM_LAW } from './laws.js';
import { radial, realY, orbitalName } from './atom.js';
import { assembleQuantumScene } from './world.js';

// One case per procedure: a line's unitary stepper and each closed form it is held to (levels, a beat, Ehrenfest,
// spreading, transmission), the atom's exact orbitals and their sampled clouds, spin through magnets, decay, the
// regime gate, gaps and units, and the page per system. Each picks its own smallest model.

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const law = (id) => QUANTUM_LAW[id].example;

describe('science worlds: quantum', () => {
  it('is deterministic, and the dress never reaches the model', () => {
    expect(JSON.stringify(solveQuantum({ model: law('stern-gerlach') }))).toBe(JSON.stringify(solveQuantum({ model: law('stern-gerlach') })));
    const plain = solveQuantum({ model: law('well') }), dressed = solveQuantum({ model: law('well'), dress: { phase: true } });
    expect(JSON.stringify(dressed.run.series)).toBe(JSON.stringify(plain.run.series));
  });

  it('steps a line unitarily, and a box in two levels holds its levels and beats at h / (E₂ − E₁)', () => {
    const r = solveQuantum({ model: law('well') });
    for (const id of ['norm-held', 'energy-held', 'closed-form:levels', 'closed-form:beat']) expect(gateOf(r, id).ok, id).toBe(true);
    // E₁ = π²ħ²/2ma² for an electron in a 2 nm box is 94.0 meV (Griffiths §2.2)
    expect(Math.abs(r.run.levels[0] - 0.0940) / 0.094).toBeLessThan(0.01);
  });

  it('swings a displaced packet in a harmonic well like a classical mass, and spreads a free one as the formula says', () => {
    const h = solveQuantum({ model: law('harmonic') });
    expect(gateOf(h, 'closed-form:ehrenfest').ok).toBe(true);
    expect(gateOf(h, 'closed-form:levels').ok).toBe(true);
    const free = solveQuantum({ model: { system: 'line', line: { length: '40 nm' }, laws: [], state: { packet: { at: 0, width: '0.5 nm' } }, duration: '20 fs' } });
    expect(gateOf(free, 'closed-form:spreading').ok).toBe(true);
    expect(free.observed.spread.end).toBeGreaterThan(4 * free.observed.spread.start);
  });

  it('tunnels through a barrier below its top by the textbook share, and partly reflects from a step it can climb', () => {
    const b = solveQuantum({ model: law('barrier') });
    expect(gateOf(b, 'closed-form:transmission').ok).toBe(true);
    expect(b.observed.transmitted.value).toBeGreaterThan(0.3);   // 0.15 eV against a 0.2 eV barrier: most of it tunnels
    const s = solveQuantum({ model: law('step') });
    expect(gateOf(s, 'closed-form:transmission').ok).toBe(true);
    expect(s.observed.transmitted.value).toBeLessThan(1);
  });

  it('gives the hydrogen orbitals their nodes, norm and mean radius, and samples clouds that follow |ψ|²', () => {
    const r = solveQuantum({ model: { system: 'atom', laws: [{ law: 'hydrogen' }], state: { orbitals: [{ n: 3, l: 1, m: 1 }] }, samples: 600 } });
    expect(r.gates.filter((g) => !g.ok)).toEqual([]);
    expect(r.observed['3p_x']['radial nodes']).toBe(1);
    expect(r.observed['3p_x'].energy).toBeCloseTo(-13.6057 / 9, 4);
    // the real p_x lobe points along x; ψ is odd under x → −x
    expect(Math.sign(realY(1, 1, Math.PI / 2, 0))).toBe(-Math.sign(realY(1, 1, Math.PI / 2, Math.PI)));
    expect(radial(1, 0, 0)).toBeCloseTo(2, 10);   // R₁₀(0) = 2 a₀^(−3/2)
    expect(orbitalName(3, 2, -2)).toBe('3d_xy');
  });

  it('measures a spin with odds cos²(θ/2), keeps one beam when asked, and a measurement resets what came before', () => {
    const r = solveQuantum({ model: { system: 'spin', state: { along: 'z' }, atoms: 600, laws: [
      { law: 'stern-gerlach', axis: 'z', keep: 'up' }, { law: 'stern-gerlach', axis: 'x', keep: 'up' }, { law: 'stern-gerlach', axis: 'z' }] } });
    expect(r.gates.filter((g) => !g.ok)).toEqual([]);
    expect(r.observed['magnet 1'].down).toBe(0);   // z-up atoms all come out up along z
    const m3 = r.observed['magnet 3'];
    expect(m3.reached).toBe(r.observed['magnet 2'].up);   // only the x-up beam goes on
    expect(Math.abs(m3.down / m3.reached - 0.5)).toBeLessThan(0.15);   // the x measurement undid the z answer
  });

  it('decays nuclei at their half-life', () => {
    const r = solveQuantum({ model: law('decay') });
    expect(gateOf(r, 'closed-form:half-life').ok).toBe(true);
    expect(gateOf(r, 'counts-follow').ok).toBe(true);
  });

  it('advises when the waves are tiny next to the features: a classical world would do', () => {
    const r = solveQuantum({ model: { system: 'line', line: { length: '200 nm', particle: 'proton' }, laws: [{ law: 'barrier', height: '2 eV', width: '50 nm' }], state: { packet: { at: '-60 nm', width: '5 nm', energy: '1 eV' } }, duration: '1 fs' } });
    expect(gateOf(r, 'quantum-regime').ok).toBe(false);
    expect(r.held).toBe(false);
  });

  it('names a missing law as the row that is, the scale that owns it, or why there is none; and reads units', () => {
    const r = solveQuantum({ model: { ...law('well'), laws: [{ law: 'well', width: '2 nm' }, { law: 'tunnelling' }, { law: 'diffusion' }, { law: 'bond' }] } });
    expect(r.gaps.map((g) => g.why).join(' | ')).toMatch(/barrier row.*\|.*microscopic.*\|.*more than one electron/);
    expect(gateOf(r, 'closed-form:levels').ok).toBe(true);
    expect(() => solveQuantum({ model: { ...law('well'), laws: [{ law: 'hydrogen' }] } })).toThrow(/belongs to the atom system/);
    expect(() => solveQuantum({ model: { ...law('barrier'), laws: [{ law: 'barrier', height: '2 nm', width: '1 nm' }] } })).toThrow(/wants (a|an) (work|energy)/);
  });

  it('lays each system out on the page, with its sources and what of it is a picture', () => {
    const line = assembleQuantumScene({ kind: 'quantum-view', model: law('step') });
    expect(line.science.rows.map((r) => r.html)).toEqual(['⟨E⟩', '⟨x⟩', 'spread', 'beyond the step']);
    expect(line.science.honesty.sections.find((s) => /^Sources \(reviewed 2026-10-19\)$/.test(s.head)).items.length).toBeGreaterThan(0);
    const atom = assembleQuantumScene({ kind: 'quantum-view', model: law('hydrogen') });
    expect(atom.science.noClock).toBe(true);
    expect(atom.defaultShoot.cameras[0].id).toBe('orbit');
    expect(atom.science.honesty.sections.find((s) => s.head === 'Drawn, not real').items.some((i) => /sampled position/.test(i.text))).toBe(true);
    const decay = assembleQuantumScene({ kind: 'quantum-view', model: law('decay') });
    expect(decay.movers.every((m) => m.t1 >= m.t0 && m.t1 <= decay.science.period + 1e-9)).toBe(true);
    expect(decay.movers.some((m) => m.vanish)).toBe(true);
    expect(assembleQuantumScene({ kind: 'quantum-view', model: law('decay'), dress: { hud: false } }).science).toBeUndefined();
    expect(() => assembleQuantumScene({ kind: 'quantum-view', model: law('decay'), dress: { trails: true } })).toThrow(/unknown field 'trails'/);
  });
});
