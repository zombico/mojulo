import { describe, it, expect } from 'vitest';
import { FAMILIES, FAMILY_NAMES, familyCue } from './families.js';
import { renderSound, renderHeld } from './measure.js';
import { meetsRegister, meetsHeld } from './register.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';

// the sweep: every dial point of every family, a valid cue in the realistic register
describe('every family dial point (deep)', () => {
  for (const name of FAMILY_NAMES) {
    it(name, async () => {
      const F = FAMILIES[name], ks = Object.keys(F.dials);
      const points = ks.reduce((acc, k) => acc.flatMap((a) => F.dials[k].map((v) => ({ ...a, [k]: v }))), [{}]);
      const off = [];
      for (const d of points) {
        const built = familyCue(name, d), man = { kind: 'beats-sfx', title: name, ...(F.sustain ? { sustains: { h: built } } : { cues: { c: built } }) };
        const v = validateBeatsManifest(man);
        if (!v.ok) { off.push(`${JSON.stringify(d)}: ${v.errors.join('; ')}`); continue; }
        if (F.sustain) { const { wav, ...m } = await renderHeld(man, 'h'); for (const o of meetsHeld(m, F)) off.push(`${JSON.stringify(d)}: ${o}`); continue; }
        const { wav, ...m } = await renderSound(man, 'c');
        if (!m.ms) off.push(`${JSON.stringify(d)}: silent`);
        if (F.reference) continue;   // held to its description, not yet to the register
        for (const o of meetsRegister(m, { swell: (F.swells || []).some((s) => Object.values(d).includes(s)) })) off.push(`${JSON.stringify(d)}: ${o}`);
      }
      expect(off).toEqual([]);
    }, 120_000);
  }
});
