/**
 * statue characterization net: one hash per seeded card × silhouette, and per format and material over the classical
 * card, at the laws STATUE_LAWS_VERSION. Each hashes the carved RECIPE (parts, palette, surfaces, the ledger) and the
 * World faces the read path builds from it (the figure on its base).
 *
 * A stored statue build regenerates on every read of the hero, so its expansion is a compatibility promise over minted
 * rows (STATUE_PINS=1 prints the current hashes). Re-pin ONLY alongside a change that says a statue's emission changes (the hero form under it moving counts:
 * say which); a change to the laws is a new STATUE_LAWS_VERSION instead.
 *
 * Re-pinned (same branch, before any release): the bronze and gilt cases, when a metal statue's faces moved from the
 * live metal channel to a shelf metal in its patina's colour (the World drew the film as interference colour). And every
 * case when the hero form under them moved: the structured core's pelvis took the hip hinge's tilt (a `pelvisTilt` joint
 * in the rig).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': '25d15652b8ed01e8:4fa1075e7450f2b5',
  'archaic·female': '0b1d1b418139afbe:f361e6898ac07052',
  'classical·male': 'be48bce859aead21:25abb5b83d9ef82c',
  'classical·female': 'f6a846c80aa6b682:a5b7562a9d2f0f01',
  'hellenistic·male': '8ed2f1fcd89998ce:9126742f7e2a0bba',
  'hellenistic·female': '1d1de31f57fc9cc2:b0a28481e1dea107',
  'roman·male': 'fc4271ab937af87f:ef03e2e32e4e4f15',
  'roman·female': '1ecd44a6a395b93d:f3e55abc7d7f0e60',
  'roman-bust·male': '648a5309551e1286:ab5281a88355a096',
  'roman-bust·female': '86bd6d82d23bf3f9:a9cc5cc74e885286',
  'egyptian·male': 'bab73125dc308159:60571cd1ace80363',
  'egyptian·female': 'cc302a2d0ddb4624:9dbfaadedaa5a43e',
  'sumerian·male': 'e80a6c462e759dd5:94d4396a1bb0e341',
  'sumerian·female': '7968e09147acb064:6415a07d5ad98595',
  'renaissance·male': '1f069064fd744378:6bf9c0c881150acc',
  'renaissance·female': '3c5e7418ee2b902d:98e62266cdacdb92',
  'classical:bust': '7dc04cd1e0525200:a034cb7a70043ed9',
  'classical:herm': '5001e3a2d8e42d1c:2787c16d8cc2ba22',
  'classical:torso': 'aef03f7159cdb21d:ed4e79c3318b1851',
  'classical:marble': '32a2ff8e0bccec28:1f6abfd5dcfe59cd',
  'classical:limestone': '9ed6d25609a705e6:0c3f18897a2d7f23',
  'classical:sandstone': '904201b0085738d3:2a230cdfe1794b5d',
  'classical:granite': 'fa250b6346ed4836:6b5e24f2a30fe0ef',
  'classical:basalt': 'cf25c5b2b56cbecf:6c263324379cfe8c',
  'classical:gilt': 'b42a6c5bcf6bab61:a10917b27f6c6dd8',
  'classical:painted': '2d4d7a8defb38d45:de1eb5ac68cc8485',
  'classical:worn': '09d3305902e32f6a:c532d90c8ad39ba6',
  'roman:broken': '0853120fcf54b92c:8d01c7ed9a3e5a8b',
};

const CASES = [
  ...STATUE_STYLES.flatMap((style) => ['male', 'female'].map((cast) => [`${style}·${cast}`, { cast, statue: style }])),
  ...['bust', 'herm', 'torso'].map((crop) => [`classical:${crop}`, { cast: 'male', statue: { type: 'statue', style: 'classical', crop } }]),
  ...['marble', 'limestone', 'sandstone', 'granite', 'basalt', 'gilt', 'painted'].map((material) => [`classical:${material}`, { cast: 'male', statue: { type: 'statue', style: 'classical', material } }]),
  ['classical:worn', { cast: 'male', statue: { type: 'statue', style: 'classical', dials: { wear: 1 } } }],
  ['roman:broken', { cast: 'male', statue: { type: 'statue', style: 'roman', lose: ['forearmR', 'legL', 'head'] } }],
];
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

describe('statue characterization', () => {
  for (const [name, spec] of CASES) {
    it(name, async () => {
      const manifest = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
      const { payload } = await resolveWorldScene({ ref: 'x', title: 't', manifest });
      const got = `${hash(manifest.recipe)}:${hash(payload.faces.filter((f) => !f.studio))}`;
      if (process.env.STATUE_PINS) console.log(`  '${name}': '${got}',`);
      expect(got).toBe(PINS[name]);
    });
  }
});
