import { describe, it, expect } from 'vitest';
import { FAMILIES, FAMILY_NAMES, familyCue } from './families.js';
import { renderSound } from './measure.js';
import { meetsRegister } from './register.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';

// the sweep: every dial point of every family, a valid cue in the realistic register
describe('every family dial point (deep)', () => {
  for (const name of FAMILY_NAMES) {
    it(name, async () => {
      const F = FAMILIES[name], ks = Object.keys(F.dials);
      const points = ks.reduce((acc, k) => acc.flatMap((a) => F.dials[k].map((v) => ({ ...a, [k]: v }))), [{}]);
      const off = [];
      for (const d of points) {
        const cue = familyCue(name, d), man = { kind: 'beats-sfx', title: name, cues: { c: cue } };
        const v = validateBeatsManifest(man);
        if (!v.ok) { off.push(`${JSON.stringify(d)}: ${v.errors.join('; ')}`); continue; }
        const { wav, ...m } = await renderSound(man, 'c');
        for (const o of meetsRegister(m, { swell: (F.swells || []).some((s) => Object.values(d).includes(s)) })) off.push(`${JSON.stringify(d)}: ${o}`);
      }
      expect(off).toEqual([]);
    }, 120_000);
  }
});
