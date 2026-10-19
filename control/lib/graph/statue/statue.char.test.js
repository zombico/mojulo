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
 * (hero-form.js LEG_SET: the leg turned back about the ankle, the hip's joint set into the pelvis).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': 'e2806c464b8dc982:10d84588b61dfd61',
  'archaic·female': '8de559ff344f42cc:6601300ccdd66b17',
  'classical·male': '606962756a5aee05:7d22cd4f4d8f7584',
  'classical·female': '6cd2d9742336d69a:82a299c8d973935b',
  'hellenistic·male': 'f36b23544cee1c29:6861f2ab65d0acd2',
  'hellenistic·female': 'd364a1769ce23d75:97cc3acf8cbe4ba0',
  'roman·male': 'f57ed8b34b45f131:69dba9647943625d',
  'roman·female': '480955991e47999c:a606b3d986542667',
  'roman-bust·male': '87cf16bc3028f7be:eff4ba7b21ec2391',
  'roman-bust·female': '4e07403b17921370:57fe35d3f2213235',
  'egyptian·male': 'bbfd0c9b9de8d702:c860f3118802dff2',
  'egyptian·female': '494ce0c09d1d5359:b96d7521c754ede0',
  'sumerian·male': '91adcebf44037f2f:490899c31f0519bb',
  'sumerian·female': '7d67710d85085399:6350dd39996560e1',
  'renaissance·male': '50c791b3b7f774b0:ad204cdb45401024',
  'renaissance·female': 'd697f30e514fee2f:4375b2dfbdb3c6e2',
  'classical:bust': '455496fa4a7e510a:8680426447614e05',
  'classical:herm': 'a17b1e34d4714915:b97d0f4837400b6b',
  'classical:torso': 'c8c989e1fa724d1a:7cb24d64c25138ca',
  'classical:marble': 'a9d2ece3f9330868:27f6e6dabe61cf5e',
  'classical:limestone': 'ea955b66e9242ead:1cdd1d1f1339b276',
  'classical:sandstone': '19495dd3b104ec48:75f73d03b7df185e',
  'classical:granite': 'e113049371770b5c:6528ae001a5d0e56',
  'classical:basalt': '845fcf0e5a7d2726:50be94e5baf65d1a',
  'classical:gilt': '3da465ac695aadae:317a8ae410a66d15',
  'classical:painted': '4f90c382faca820a:977caf7b165b5f15',
  'classical:worn': '77e91dc34bf59c47:195e8520baaa9b6f',
  'roman:broken': 'db0e6aecfb70d3ce:4afe6a14293cf10f',
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
