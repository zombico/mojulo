import { describe, it, expect } from 'vitest';
import { runConformance, conformanceGate } from '../conformance.js';
import { lightProbes } from './probes.js';
import { RELATIVISTIC_LAW } from './laws.js';

// The light world's shader against JS, in the real browser (the e2e tier). The faithful shader agrees at every
// probe (where rays go, where they meet the disk and with what shift, and the shadow's size on a frame); one whose
// GLSL bends light 3% too little disagrees. Without a browser the gate says "not run".
const fudge = (payload) => {
  const swap = (s) => s.replace(/-1\.5 \* h2/g, '-1.455 * h2');
  return { ...payload, effects: payload.effects.map((e) => ({ ...e, frag: swap(e.frag) })), science: { ...payload.science, probe: { ...payload.science.probe, frag: swap(payload.science.probe.frag) } } };
};

describe('science worlds: the light world\'s shader conformance, in Chrome', () => {
  it('agrees with the faithful shader, and disagrees with one that bends light 3% too little', async () => {
    const p = lightProbes({ model: RELATIVISTIC_LAW.disk.example });
    const a = conformanceGate(await runConformance(p.page.payload, p.page.probes, p.size));
    if (!a.ran) { expect(a.ok).toBeNull(); return; }
    expect(a.ok, a.detail).toBe(true);
    const shadow = conformanceGate(await runConformance(p.shadow.payload, p.shadow.probes, p.size));
    expect(shadow.ok, shadow.detail).toBe(true);
    const bad = conformanceGate(await runConformance(fudge(p.page.payload), p.page.probes, p.size));
    expect(bad.ok).toBe(false);
  }, 300000);
});
