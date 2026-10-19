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
 * for the hero laws 5 (hero-form.js ARM_LENGTH: the adult humerus and forearm shortened).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': '66841ad6ec39aaa0:5fde6d4292bee84b',
  'archaic·female': '2da94919899b4d34:12658ecf3a7e2050',
  'classical·male': '6a16c7dcb6b983e1:eac710a0157bc989',
  'classical·female': '3074bddc7c3b0921:a3fd92901944ff7b',
  'hellenistic·male': '9f899fcb8a778954:7108c09e2fd1e1d7',
  'hellenistic·female': 'd0f4593bbb2ce7d5:d77c95ec27b3004f',
  'roman·male': '35fb2272f9028adc:f07e2285b48d8bdb',
  'roman·female': 'b59727985fd1cdb1:727b8f431e4c210e',
  'roman-bust·male': 'b60db6920862b66a:a05426c50c2113b9',
  'roman-bust·female': 'de018f9152800f52:8740a661dec5af23',
  'egyptian·male': 'f29c9619a5775f56:cc2e48334f0d546c',
  'egyptian·female': 'a9c23e0f5c239d37:28528f42243bf760',
  'sumerian·male': '7d8a779e4747c6af:8bd3486fd262c2a8',
  'sumerian·female': '4c3df9d8e20f963a:dca32df6051b7c07',
  'renaissance·male': '49e0a57f1c458a77:b0e178e98804fd27',
  'renaissance·female': '73eed84fb35cdf0a:52a34a9b2b85cc84',
  'classical:bust': 'ded56af95f6e8e9c:ea20db46c1fc341c',
  'classical:herm': '3d1f331383721631:131d2d009219eb93',
  'classical:torso': 'ad4124735486292e:393750c20f4b517b',
  'classical:marble': '3d51294ddf1d3f4e:db47b0dc4f227150',
  'classical:limestone': '8fe5ee27e7025f59:aa45679d4b890afe',
  'classical:sandstone': 'c83d7159749c1e82:4010f37f0265ad36',
  'classical:granite': '602bd12de6af5bf5:bd8dd246a0b028aa',
  'classical:basalt': '4c5a9363a088a7c5:2555c2b48507df08',
  'classical:gilt': '63920c4f3118c271:bf5a0bed5ce2251a',
  'classical:painted': '0b9e8a4565ae383a:975c3e381ee5b6e8',
  'classical:worn': '519674ac2268fbcb:c3d6407a7b90e18e',
  'roman:broken': 'cfb52e77b18c6eba:652639340af36b58',
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
