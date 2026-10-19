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
 * for its slab lift and clearance between rings. And every case when the hero form under them moved for the hero laws 2
 * (hero-form.js SHOULDER_LINE: a statue minted now is a structured hero stamped laws 2, its neck's root lifted so the
 * trapezius climbs the neck; a statue stored before reads laws 1 and keeps its bytes).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': '77f2689f757e02ee:23e2b3af359a0137',
  'archaic·female': '23a55af25450f00a:59e5b51d1947f5e3',
  'classical·male': '19286d4c0e86d71f:fd6babca5ef5a6d7',
  'classical·female': 'f4d8bfd5014ffa36:1f79121c0066fef5',
  'hellenistic·male': '7cde0723636e9a7c:643e0632927fdd1e',
  'hellenistic·female': '285038dfaa03e30f:1b29b58cfe905b5f',
  'roman·male': 'c396451f6f6fc80f:5fd90e2dee8b5ce5',
  'roman·female': 'f5d063ea4d79b5d4:b62255ba68f0c712',
  'roman-bust·male': 'ea70e4dad000461d:eff4ba7b21ec2391',
  'roman-bust·female': '0479af4fff26a5a0:57fe35d3f2213235',
  'egyptian·male': '7456d6649676255d:0f534ee50319d0a7',
  'egyptian·female': '11091e235f062df6:6be59ae65ed85155',
  'sumerian·male': '17bc79418c053aa1:93bfa1cd3ff3c3f6',
  'sumerian·female': '8ca54c8cf9f4e4fd:380787bf48580a49',
  'renaissance·male': '884d6347847d01a2:fa62c1b945c03b1d',
  'renaissance·female': 'fc07186f40990f74:3178e46ca1007c52',
  'classical:bust': 'd26d0be2af73b03f:8680426447614e05',
  'classical:herm': 'aa0c63e7a7a2f512:b97d0f4837400b6b',
  'classical:torso': '1053647a0bfd2427:b2cc4700ee834751',
  'classical:marble': '5448e0072ddeb67a:398089793c0490da',
  'classical:limestone': '6bd4dc498c43adae:eaadfa25ae05feb2',
  'classical:sandstone': '30b25596fbb63050:f172ba907354c7ee',
  'classical:granite': '59f2b766cf002e02:7746b14b11630765',
  'classical:basalt': 'de721e6ba3e3b8ea:c7d64adb098aaac6',
  'classical:gilt': '129f8b656845cd71:a576cf657a1afdb8',
  'classical:painted': 'f903321e84d2f49b:bbc418de6de2dd40',
  'classical:worn': '3aae40015b96918d:c24457022dca67e6',
  'roman:broken': '5f711e2465223b4e:fc92c2990ed6c7d2',
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
