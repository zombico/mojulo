import { describe, it, expect } from 'vitest';
import { FAMILIES, FAMILY_NAMES, familyCue } from './families.js';
import { renderSound, renderHeld } from './measure.js';
import { meetsRegister, meetsHeld, REGISTER } from './register.js';
import { SET_NAMES, FLOOR_SETS } from './sets.js';
import { BASELINE } from './baseline.js';

// the families' laws, rendered as an export renders them: an ordered dial moves its measures the way it says, a
// material is heard as itself, and each family's defaults are in the realistic register. Machine gates: nobody listened.
const measure = async (name, dials) => { const { wav, ...m } = await renderSound({ kind: 'beats-sfx', title: name, cues: { c: familyCue(name, dials) } }, 'c'); return m; };
const holding = async (name, dials) => { const { wav, ...m } = await renderHeld({ kind: 'beats-sfx', title: name, sustains: { h: familyCue(name, dials) } }, 'h'); return m; };

describe('the families on the yardstick', () => {
  it('every set that voices the realistic style is in the register (its stored numbers)', () => {
    const voicing = SET_NAMES.filter((s) => !FLOOR_SETS.includes(s));
    expect(voicing.length).toBeGreaterThan(0);
    const off = voicing.flatMap((s) => Object.entries(BASELINE[s]).flatMap(([c, m]) => meetsRegister(m).map((o) => `${s}:${c}: ${o}`)));
    expect(off).toEqual([]);
    expect(REGISTER).toEqual({ layers: 4, heard: 1.31, crestDb: 8 });
  });

  for (const name of FAMILY_NAMES) {
    const F = FAMILIES[name];
    if (F.sustain) {
      it(`${name}: held at its defaults, it follows its control`, async () => { expect(meetsHeld(await holding(name, {}), F)).toEqual([]); });
      continue;
    }
    if (F.reference) it(`${name}: a reference recreation sounds (held to its description, not yet to the register)`, async () => {
      const m = await measure(name, {});
      expect(m.layers).toBeGreaterThan(0);
      expect(m.ms).toBeGreaterThan(50);
    });
    else it(`${name}: its defaults are in the register`, async () => {
      const swell = (F.swells || []).includes(Object.values(F.defaults)[0]);
      expect(meetsRegister(await measure(name, {}), { swell })).toEqual([]);
    });
    for (const o of F.ordered) {
      const vals = o.values ?? F.dials[o.dial];
      it(`${name}: from ${vals[0]} to ${vals.at(-1)} ${o.dial}, ${[...(o.rises || []).map((k) => `${k} rises`), ...(o.falls || []).map((k) => `${k} falls`)].join(', ')}`, async () => {
        const a = await measure(name, { [o.dial]: vals[0] }), b = await measure(name, { [o.dial]: vals.at(-1) });
        for (const k of o.rises || []) expect(b[k], k).toBeGreaterThan(a[k]);
        for (const k of o.falls || []) expect(b[k], k).toBeLessThan(a[k]);
      });
    }
  }

  it('a material is heard as itself: metal rings brighter and longer than earth', async () => {
    const metal = await measure('impact', { material: 'metal' }), dirt = await measure('impact', { material: 'dirt' });
    expect(metal.centroidHz).toBeGreaterThan(dirt.centroidHz);
    expect(metal.ms).toBeGreaterThan(dirt.ms);
  });
});
