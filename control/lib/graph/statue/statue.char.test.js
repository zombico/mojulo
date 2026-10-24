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
 * trapezius climbs the neck; a statue stored before reads laws 1 and keeps its bytes), and again for the hero laws 3
 * (hero-form.js LEG_SET: the leg turned back about the ankle, the hip's joint set into the pelvis), and again for the
 * hero laws 4 (hero-form.js LEG_LENGTH: the adult leg lengthened by the lumbar's run) with the figure seated on its base's
 * top exactly (base.js: the lift to the base's rounded top, which had left the lowest point a micrometre off), and again
 * for the hero laws 5 (hero-form.js ARM_LENGTH: the adult humerus and forearm shortened), and again for the hero laws 15
 * (the cervical chain, figure-vajra.js CERVICAL_CAP: a statue minted now is stamped laws 15 and its rig carries the chain;
 * its pose's raw head angles are each joint's own, so every carved figure is the one before, byte for byte, the recipe
 * alone moving; a statue stored before keeps its laws and its bytes).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': 'b428317db541dfc3:5fde6d4292bee84b',
  'archaic·female': '32c832ceac36f271:12658ecf3a7e2050',
  'classical·male': 'fc75eec8acc47636:eac710a0157bc989',
  'classical·female': 'a310e5542107dc2b:a3fd92901944ff7b',
  'hellenistic·male': '66a54b020549ac8a:7108c09e2fd1e1d7',
  'hellenistic·female': '98b2f5d668f989e7:d77c95ec27b3004f',
  'roman·male': 'cb83f8e78667d1f4:f07e2285b48d8bdb',
  'roman·female': '441af2390a204293:727b8f431e4c210e',
  'roman-bust·male': 'c416e71009c1846a:a05426c50c2113b9',
  'roman-bust·female': '86c272252c873b3c:8740a661dec5af23',
  'egyptian·male': '1dafdde4be55f6c8:cc2e48334f0d546c',
  'egyptian·female': '45dbbcaac7a50a74:28528f42243bf760',
  'sumerian·male': 'ee4d1f605c3dfeb2:8bd3486fd262c2a8',
  'sumerian·female': 'e475718086b194e9:dca32df6051b7c07',
  'renaissance·male': '5c869bf94dc811ca:b0e178e98804fd27',
  'renaissance·female': 'a00725b583f60c4a:52a34a9b2b85cc84',
  'classical:bust': '645cdab5c27d2d14:ea20db46c1fc341c',
  'classical:herm': '05ba8d32331f2e1a:131d2d009219eb93',
  'classical:torso': 'd528efe4011c8d65:393750c20f4b517b',
  'classical:marble': '69f36ccff61cdb21:db47b0dc4f227150',
  'classical:limestone': 'c7b813636f3df310:aa45679d4b890afe',
  'classical:sandstone': 'aa437b19c31719c3:4010f37f0265ad36',
  'classical:granite': 'bee7fcf93ad2fd10:bd8dd246a0b028aa',
  'classical:basalt': 'a17f932de0578141:2555c2b48507df08',
  'classical:gilt': '2077d9c9a4a0f79b:bf5a0bed5ce2251a',
  'classical:painted': 'e0f530a21003ddf5:975c3e381ee5b6e8',
  'classical:worn': 'ec47a2b86adb99ec:c3d6407a7b90e18e',
  'roman:broken': '056c3d59f01f5722:652639340af36b58',
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
