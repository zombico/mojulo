import { describe, it, expect } from 'vitest';
import { CLASSICAL_LAW } from './laws.js';
import { solveClassical } from './solve.js';
import { fieldSources, positionsAt, fluxThrough } from './field.js';
import { planClassicalWorld, assembleClassicalScene } from './world.js';
import { chargesAt } from './field-shader.js';
import { readScienceSetting } from '../setting.js';

// The field a world's coulomb and lorentz rows make, drawn (dress.field): one case per procedure. Gauss's law on the
// field itself; lines traced from the charges, ending on the other sign or leaving the frame; a uniform field's even
// lines; the volume as a shader layer fed the charges' paths; and the dress never reaching the model.
const law = (id) => CLASSICAL_LAW[id].example;
const gateOf = (gates, id) => gates.find((g) => g.id === id);
const DIPOLE = {
  bodies: [{ id: 'p', mass: 1, radius: 0.02, charge: '2 µC', at: [-0.5, 0, 0], fixed: true }, { id: 'n', mass: 1, radius: 0.02, charge: '-1 µC', at: [0.5, 0, 0], fixed: true }],
  laws: [{ law: 'coulomb' }], duration: 1,
};

describe('science worlds: the classical field, drawn', () => {
  it('holds Gauss\'s law: q/ε₀ through a sphere round a charge, the sum round two, none round neither', () => {
    const r = solveClassical({ model: DIPOLE }), src = fieldSources(r.model), xs = positionsAt(src, r.tracks, 0);
    const q = (i) => 4 * Math.PI * src.charges[i].k * src.charges[i].q;
    expect(Math.abs(fluxThrough(src, xs, xs[0], 0.3) - q(0)) / q(0)).toBeLessThan(1e-9);
    expect(Math.abs(fluxThrough(src, xs, [0, 0, 0], 0.8) - (q(0) + q(1))) / q(0)).toBeLessThan(1e-6);
    expect(Math.abs(fluxThrough(src, xs, [0, 0.6, 0], 0.3)) / q(0)).toBeLessThan(1e-9);
  });

  it('traces lines from the charges, in proportion, ending on the other sign or leaving the frame', () => {
    const plan = planClassicalWorld({ kind: 'classical-view', model: DIPOLE, dress: { field: 'lines', lines: 8 } });
    expect(gateOf(plan.fieldGates, 'gauss').ok).toBe(true);
    const lines = gateOf(plan.fieldGates, 'field-lines');
    expect(lines.ok, lines.detail).toBe(true);
    expect(lines.value.per).toMatch(/^p \d+\/8, n \d+\/4$/);
    expect(plan.faces.some((f) => f.group === 'field')).toBe(true);
    expect(plan.shader).toBeUndefined();
    // the dress never reaches the model: the solver's gates are the same either way
    expect(JSON.stringify(plan.solved.gates)).toBe(JSON.stringify(planClassicalWorld({ kind: 'classical-view', model: DIPOLE }).solved.gates));
    const page = assembleClassicalScene({ kind: 'classical-view', model: DIPOLE, dress: { field: 'lines' } });
    expect(page.science.honesty.sections.find((s) => s.head === 'Checked by the solver').items.some((i) => /Gauss/.test(i.text))).toBe(true);
  });

  it('draws a uniform field as even lines along it, with nothing to trace from', () => {
    const plan = planClassicalWorld({ kind: 'classical-view', model: law('lorentz'), dress: { field: 'lines' } });
    expect(plan.fieldGates).toEqual([]);   // no charge makes this field: there is no flux to check
    expect(plan.faces.filter((f) => f.group === 'field').length).toBe(25 * 6);
    expect(plan.drawn.some((d) => /magnetic field is drawn as blue lines/.test(d.what))).toBe(true);
  });

  it('draws the field as a volume over the meshes, moving with the charges as the movers do', () => {
    const m = law('coulomb'), page = assembleClassicalScene({ kind: 'classical-view', model: m, dress: { field: 'volume' } });
    expect(page.effects).toHaveLength(1);
    expect(page.effects[0].depthClip).toBe(true);
    const tex = page.effects[0].dataTextures.uTrack, u = page.effects[0].customUniforms;
    expect(tex.height).toBe(2);
    // at the start of the run the charges are where the bodies start; at the end of the hold, where they end
    const plan = planClassicalWorld({ kind: 'classical-view', model: m, dress: { field: 'volume' } }), last = plan.solved.tracks.t.length - 1;
    expect(chargesAt(tex, 0, u.uPeriod, u.uHold)[1].x).toEqual(plan.solved.tracks.bodies.q.x[0].map((c) => c * u.uS));
    expect(chargesAt(tex, u.uPeriod + 0.5, u.uPeriod, u.uHold)[1].x).toEqual(plan.solved.tracks.bodies.q.x[last].map((c) => c * u.uS));
    expect(page.science.probe.dataTextures.uTrack).toBe(tex);
    expect(assembleClassicalScene({ kind: 'classical-view', model: m }).effects).toBeUndefined();
    expect(() => planClassicalWorld({ kind: 'classical-view', model: law('spring'), dress: { field: 'volume' } })).toThrow(/has neither/);
    expect(() => planClassicalWorld({ kind: 'classical-view', model: m, dress: { lines: 6 } })).toThrow(/goes with field: 'lines'/);
    expect(() => readScienceSetting({ kind: 'classical', model: m, dress: { field: 'shells' }, at: [0, 0, 0] })).toThrow(/cannot stand in a world/);
  });
});
