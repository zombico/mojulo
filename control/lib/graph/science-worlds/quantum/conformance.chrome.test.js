import { describe, it, expect } from 'vitest';
import { runConformance, conformanceGate } from '../conformance.js';
import { volumeProbes, planeProbes } from './probes.js';
import { QUANTUM_LAW } from './laws.js';

// The quantum pages' shaders against JS, in the real browser (the e2e tier). The atom volume's ψ agrees with
// radial · realY at points of each cloud, out to n = 7, and one whose GLSL decays 2% too slowly disagrees. The plane's
// sheet agrees with the solver's frames and its wall with the model's, and one that plays the frames backward
// between samples and drops the wall disagrees. Without a browser the gate says "not run".
const fudge = (payload, swap) => {
  return { ...payload, effects: payload.effects.map((e) => ({ ...e, frag: swap(e.frag) })), science: { ...payload.science, probe: { ...payload.science.probe, frag: swap(payload.science.probe.frag) } } };
};

describe('science worlds: the quantum shaders\' conformance, in Chrome', () => {
  it('agrees with the exact orbitals, and disagrees with a shader whose ψ decays too slowly', async () => {
    const model = { ...QUANTUM_LAW.hydrogen.example, samples: 300, state: { orbitals: [{ n: 2, l: 1, m: 0 }, { n: 4, l: 2, m: -1 }, { n: 7, l: 3, m: 2 }] } };
    const p = volumeProbes({ kind: 'quantum-view', model, dress: { render: 'volume' } });
    const a = conformanceGate(await runConformance(p.page.payload, p.page.probes, p.size));
    if (!a.ran) { expect(a.ok).toBeNull(); return; }
    expect(a.ok, a.detail).toBe(true);
    const slower = (s) => s.replace(/exp\((-[0-9.]+) \* r\)/g, (_, k) => `exp(${(+k * 0.98).toPrecision(9)} * r)`);
    const bad = conformanceGate(await runConformance(fudge(p.page.payload, slower), p.page.probes, p.size));
    expect(bad.ok).toBe(false);
  }, 300000);

  it('draws the plane\'s sheet from the solver\'s frames and its wall where the model has it', async () => {
    const p = planeProbes({ kind: 'quantum-view', model: QUANTUM_LAW.slits.example });
    const a = conformanceGate(await runConformance(p.page.payload, p.page.probes, p.size));
    if (!a.ran) { expect(a.ok).toBeNull(); return; }
    expect(a.ok, a.detail).toBe(true);
    const wrong = (s) => s.replace('frameAt(f0, uv) * (1.0 - w) + frameAt(f1, uv) * w', 'frameAt(f0, uv) * w + frameAt(f1, uv) * (1.0 - w)').replace(/\) return 1\.0;/g, ') return 0.0;');
    const bad = await runConformance(fudge(p.page.payload, wrong), p.page.probes, p.size);
    expect(conformanceGate(bad).ok).toBe(false);
    expect(bad.rows.some((r) => !r.ok && r.id.startsWith('edge'))).toBe(true);
    expect(bad.rows.some((r) => !r.ok && r.id.startsWith('sheet'))).toBe(true);
  }, 300000);
});
