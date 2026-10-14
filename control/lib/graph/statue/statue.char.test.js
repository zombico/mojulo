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
 * in the rig), and again for its shoulder girdle (collarbones that rise with a raised arm), and again for its hard limbs
 * (hip, knee and elbow fold bones; each bone's rings rigid out of its joint's zone). And every draped case when the
 * drapery's garment kernel moved (outfit laws v1 rewritten before release: the ease kept in the body's ratios on a dense
 * ring, a hem falling away only where it is cut to, the lift smoothed round the ring only), and again
 * for its slab lift and clearance between rings.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': '791a7daf759e52dd:05b63fb01f9e999e',
  'archaic·female': 'adf18fe7313c28e3:915d11dd10b3c8cb',
  'classical·male': 'a0bd16b586b00e94:0a663ef7441a4a60',
  'classical·female': 'b65e3fe5050012a1:19688ace907c75ca',
  'hellenistic·male': '40237f2b7e10fb22:04f2d836eface569',
  'hellenistic·female': 'f733ad0519398b45:67d41a1e765e1e08',
  'roman·male': '2fe19e47971c9b26:54bccc8d5841f3d2',
  'roman·female': '6df0f8ff61f6f5dd:1ae6be1de9850b99',
  'roman-bust·male': '273be1829882d693:74cd63e1bb800933',
  'roman-bust·female': 'edf35d3832bd83d7:ce8ec8041c9d57d7',
  'egyptian·male': '78c7781df96542b4:4b115d3f8c7513b9',
  'egyptian·female': '29f01f899fcb8772:60de16591d91cb83',
  'sumerian·male': '327beab97b2872ef:d565540a14836045',
  'sumerian·female': '1e5255cfaf373b76:0019a85e5379e11d',
  'renaissance·male': '7557a174d439e1aa:eb4ca4044a4cbfad',
  'renaissance·female': '68c3025d1ce70018:072f24505068c8bb',
  'classical:bust': '577dc080dc8dfbd0:a034cb7a70043ed9',
  'classical:herm': '76015f972d4f091d:2787c16d8cc2ba22',
  'classical:torso': '2cd10a211cb3daf9:b7ea49c992e93a7d',
  'classical:marble': '58cf6e37b51c907a:e22e00199ae18304',
  'classical:limestone': '6b41f5d11a88577a:5c27344a9c64de10',
  'classical:sandstone': '32aa4c1c56521d13:84aa61690b51732e',
  'classical:granite': '0218a6017782ac73:c6dafc3103149f64',
  'classical:basalt': '2b7e509ef15f6100:20c804c823e728c6',
  'classical:gilt': '83e4e1270327875c:9025464e3d382f9d',
  'classical:painted': '5f960cc3ce177d67:75fdca366cfe0c92',
  'classical:worn': '4a0c54bf3db4c519:d95f9477d0bbbe75',
  'roman:broken': 'fc313f6a63c8537b:1c32872179bc0986',
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
