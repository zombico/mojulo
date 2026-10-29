// THE SIXTH-GENERATION BEAST BODY, pinned (characterization): a beast-kin lowered through the creature door, the
// creature biped (plan.js `biped`, `dialsAndRig`) with a library head on its neck stub, as a sheet mints it today. The
// beast-kin's next body stands on the tiered body (lib/graph/beast); this one stays readable for every row minted on it,
// so its plan, its recipe and its mesh are held here byte for byte. One sheet per procedure the biped runs (digitigrade
// legs with a tail, plantigrade legs, wings on the arms, a second pair of arms), each found in code from the lineages'
// rolls, dressed as the cube dresses it by default (designed: adorned and drawn for its target, creature-drawn.js), and
// the digitigrade one also in its stock kit. A sheet of a kin the beast cards know is lowered to the tiered body by
// default (plan.js beastOf); `gen: 6` asks for this body. A pin moves only when a step says the sixth-generation body
// changes.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { rollEgocube } from './egocube.js';
import { planFromSheet } from './plan.js';
import { expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from '../polygonizer/station-loft.js';

const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;

// the first seed whose sheet lands on the creature door and shows the procedure
function sheetFor(ancestry, humanity, shows) {
  for (let seed = 1; seed <= 40; seed++) {
    const sheet = rollEgocube({ seed, facets: { ancestry, humanity }, path: 'creature' });
    if (sheet.ancestry.door !== 'creature') continue;
    const plan = planFromSheet(sheet, { gen: 6 }).create.spec.plan;
    if (shows(plan)) return sheet;
  }
  throw new Error(`no ${ancestry} sheet at humanity ${humanity} shows the procedure`);
}
const has = (name) => (plan) => plan.segments.some((s) => s.name === name);
const digitigrade = (plan) => plan.joints.hock[2] > 2 * plan.joints.toeBase[2] + 0.1 && has('tail')(plan);
const plantigrade = (plan) => plan.joints.hock[2] < 0.2;

const PROCEDURES = {
  'digitigrade, a tail': [() => sheetFor('lupine', 0.3, digitigrade), ['designed', 'kit']],
  plantigrade: [() => sheetFor('ursine', 0.3, plantigrade), ['designed']],
  'wings on the arms': [() => sheetFor('avian', 0.3, has('wingPrim1R')), ['designed']],
  'a second pair of arms': [() => sheetFor('insectoid', 0.2, has('upperArm2R')), ['designed']],
};
const PINS = {
  'digitigrade, a tail': { designed: ['20a6f5de4a0d286d', '99e8d5877b8911a6', 'b41701b916dac0bb'], kit: ['bea7c4d8e3855d07', '4e39d328e1b5a977', '34f1e4bb65e779c4'] },
  plantigrade: { designed: ['556cebec30fa232f', '2adc6a51a6c62b3c', 'ea9aac942b8c2ca0'] },
  'wings on the arms': { designed: ['9596941b3963a994', 'f6fb68201d3d5dbf', 'fa4f34c869a0a87d'] },
  'a second pair of arms': { designed: ['6d8a30e5bcfe9620', '47aaa2f33c9533d0', '3acde3244e18ea58'] },
};

describe('the sixth-generation beast body (the creature biped), byte for byte', () => {
  for (const [name, [find, dresses]] of Object.entries(PROCEDURES)) {
    it(`${name}: its plan, its recipe and its mesh`, () => {
      const sheet = find();
      for (const dress of dresses) {
        const plan = planFromSheet(sheet, { gen: 6, ...(dress === 'designed' ? { dress } : {}) }).create.spec.plan;
        const { recipe, dials } = expandLayeredManifest({ kind: 'layered', plan });
        const mesh = compileLayered(recipe, dials);
        const got = [h(plan), h(recipe), h({ v: mesh.vertices.map((p) => p.map(r6)), f: mesh.faces, g: mesh.groups })];
        expect(got, `${name} (${dress}, seed ${sheet.seed})`).toEqual(PINS[name][dress]);
      }
    }, 120_000);
  }
});
