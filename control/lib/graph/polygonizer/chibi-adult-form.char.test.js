// THE ADULT-FORM CHIBI, pinned (characterization): the chibi as the hero laws 12 drew it (hero-form.js CHIBI_FORM, the
// mascot read as simple solids on the anime head; hero-dress.js CHIBI_DRESS, its few signature pieces), as the door mints
// it: its record, its plan and the layered recipe it builds, bare, in the ranger kit and in the knight's plate. The child
// form (laws 13, CHILD_FORM) is built on its terms and must leave it alone: under laws 13 the same plan and recipe. A pin
// moves only when a step says the adult-form chibi's emission changes.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { heroRecord, heroPlanOf, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from './motion-stamp.js';
import { HERO_LAWS_VERSION } from './hero-form.js';

const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const PINS = {
  bare: [{ cast: 'chibi' }, 'cb8f519a8618b56c', 'cca8e48f59fc0abc', '62179f95b6207aa2'],
  ranger: [{ cast: 'chibi', adorn: 'ranger' }, 'ecd2544f2f758daf', 'f3368556c1e110f9', '032dcb229344a2fb'],
  knight: [{ cast: 'chibi', adorn: { type: 'armor', style: 'knight' } }, '24ebc6de4e459f08', '406972d2373d7d63', '96827d1f9a97d9c3'],
};

describe('the adult-form chibi (hero laws 12), byte for byte', () => {
  for (const [name, [spec, record, plan, recipe]] of Object.entries(PINS)) {
    it(`${name}: minted on the tiered body with the anime head; its record, plan and recipe; the later laws build the same`, () => {
      const r = { ...heroRecord(withDefaultForm(spec)), laws: 12 };
      expect(r.form).toBe('tiered'); expect(r.head).toBe('anime');
      expect(h(r)).toBe(record); expect(h(heroPlanOf(r))).toBe(plan);
      expect(h(expandLayeredManifest({ kind: 'layered', hero: r }).recipe)).toBe(recipe);
      for (const laws of [13, HERO_LAWS_VERSION]) { const later = { ...r, laws };
        expect(h(heroPlanOf(later)), `laws ${laws}`).toBe(plan); expect(h(expandLayeredManifest({ kind: 'layered', hero: later }).recipe), `laws ${laws}`).toBe(recipe); }
    }, 120_000);
  }
});
