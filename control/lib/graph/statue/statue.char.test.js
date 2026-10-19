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
 * top exactly (base.js: the lift to the base's rounded top, which had left the lowest point a micrometre off).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': '0ac7dd657596917c:396b20d5e8ba380d',
  'archaic·female': 'a334dde703290ade:193228ef60c4c80b',
  'classical·male': '12ba5d0e850b0c0f:baabeb3f45238afe',
  'classical·female': 'e01a3c89679b248d:9d7815fd30145433',
  'hellenistic·male': '51d305fa7915c852:a57d3bf9ba215e15',
  'hellenistic·female': '7e2edefaa58d0733:a54aca55a3820f18',
  'roman·male': '5ac2cede2b949529:9aa85ff223652268',
  'roman·female': '040225b3e6ab7a48:aab3536da1effe51',
  'roman-bust·male': '3cb3e2a5d6f250fe:2d46463537eca5a6',
  'roman-bust·female': 'adeccd25694fc644:eb366597245163f5',
  'egyptian·male': 'b0957ab91da00d6f:9601959973483725',
  'egyptian·female': '69a92958fe5cd6ce:4f8f6527310adfa4',
  'sumerian·male': 'e90ab7ff39033e1f:a22eb555d91e04dc',
  'sumerian·female': 'c8a4d86abf07f3ed:4233a1fb9a6e0367',
  'renaissance·male': 'f91baca30b847083:e4687efb1219d9c6',
  'renaissance·female': 'a853686d8f3bf5cc:023992d94053befc',
  'classical:bust': 'd75772987e720f95:5921b66eeba8d7da',
  'classical:herm': 'a0779fb920233011:131d2d009219eb93',
  'classical:torso': '9e07194d939c47d9:4744eb79c965bcfb',
  'classical:marble': '9c64c8050fcc7e6a:92791ec1821f9ebe',
  'classical:limestone': '5a36cfc5b3ac435a:baac04d8f30acf98',
  'classical:sandstone': '6c80ec59a9d05f81:82b46c6239d57607',
  'classical:granite': '80eb8ab035d3c73a:4fec6c28de71d3c6',
  'classical:basalt': '31171a2abd8d7954:192a08c08e0beedc',
  'classical:gilt': '6a035cfe1f6b203a:318fb19ea46823b6',
  'classical:painted': '5ac27853453c2951:c150d4e90ca64c51',
  'classical:worn': '570af0e30587da61:64dd72c392e3a430',
  'roman:broken': '42bbfcc3e0e3a877:d2a5366ee3fde927',
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
