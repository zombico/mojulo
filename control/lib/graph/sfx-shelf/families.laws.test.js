import { describe, it, expect } from 'vitest';
import { FAMILIES, FAMILY_NAMES, familyCue } from './families.js';
import { renderSound } from './measure.js';
import { meetsRegister, REGISTER } from './register.js';

// the families' laws, rendered as an export renders them: an ordered dial moves its measures the way it says, a
// material is heard as itself, and each family's defaults are in the realistic register. Machine gates: nobody listened.
const measure = async (name, dials) => { const { wav, ...m } = await renderSound({ kind: 'beats-sfx', title: name, cues: { c: familyCue(name, dials) } }, 'c'); return m; };

describe('the families on the yardstick', () => {
  it('the register is the layered set\'s own weakest', () => {
    expect(REGISTER.layers).toBeGreaterThanOrEqual(4);
    expect(REGISTER.heard).toBeGreaterThan(1);
    expect(REGISTER.crestDb).toBeGreaterThan(6);
  });

  for (const name of FAMILY_NAMES) {
    const F = FAMILIES[name];
    it(`${name}: its defaults are in the register`, async () => {
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
