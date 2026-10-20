import { describe, it, expect } from 'vitest';
import { runConformance, conformanceGate } from '../conformance.js';
import { fieldProbes } from './probes.js';
import { CLASSICAL_LAW } from './laws.js';

// A classical world's field drawn by a shader, against field.js, in the real browser (the e2e tier): E and V at
// points and moments through the run, the charge moving, agree; a shader whose field falls off as 1/r instead of
// 1/r² disagrees. Without a browser the gate says "not run".
const fudge = (payload) => {
  const swap = (s) => s.replace('C[i].w * d / (r * r * r)', 'C[i].w * d / (r * r)');
  return { ...payload, effects: payload.effects.map((e) => ({ ...e, frag: swap(e.frag) })), science: { ...payload.science, probe: { ...payload.science.probe, frag: swap(payload.science.probe.frag) } } };
};

describe('science worlds: the classical field\'s shader conformance, in Chrome', () => {
  it('agrees with field.js as the charges move, and disagrees with a field that falls off as 1/r', async () => {
    const p = fieldProbes({ kind: 'classical-view', model: CLASSICAL_LAW.coulomb.example, dress: { field: 'volume' } });
    const a = conformanceGate(await runConformance(p.page.payload, p.page.probes, p.size));
    if (!a.ran) { expect(a.ok).toBeNull(); return; }
    expect(a.ok, a.detail).toBe(true);
    const bad = conformanceGate(await runConformance(fudge(p.page.payload), p.page.probes, p.size));
    expect(bad.ok).toBe(false);
  }, 300000);
});
