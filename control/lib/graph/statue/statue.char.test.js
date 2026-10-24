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
 * alone moving; a statue stored before keeps its laws and its bytes), and again for the hero laws 16 (hero-form.js
 * CERVICAL_LEAN: the landmark neck leaning forward up into the skull; a statue stored before keeps its laws and its
 * bytes).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': '737414b0eed2dddc:31c3f45809f780b0',
  'archaic·female': 'b61e5a572fc7c1a4:eab6ed5bedeb3cd1',
  'classical·male': 'eaf7ce36b52dba44:4b32d620a22876ce',
  'classical·female': '4d6d4d2bc059a1bc:34e356c60c5edd40',
  'hellenistic·male': '6e804af1abcf4590:e47ab77de49a4db7',
  'hellenistic·female': '0acde1d0060118aa:8593b5883085239b',
  'roman·male': 'd2e31faeb7457c5b:34dfa1658d5ba501',
  'roman·female': '107d25748d5394e3:4756cfce597ef86d',
  'roman-bust·male': '95b2ab2007441d73:296e6e3540c5d087',
  'roman-bust·female': 'fda7257bd28ca42e:f76f88570807c11e',
  'egyptian·male': '8ed5c8d1c71aa161:49c2e0c4ba298657',
  'egyptian·female': '3d63df5a1bd7b757:ab59a2a7d57ad088',
  'sumerian·male': '1e2dbcb26b71cfc9:9bbb465813199b19',
  'sumerian·female': '1f31a4ac300e61cf:cdbc0c3c84eacdeb',
  'renaissance·male': '8ed676067edc2fa8:8ce8d61aaf306a46',
  'renaissance·female': 'e8bede6b3c2fad2f:b9696fe9cbda837e',
  'classical:bust': '271d8299b944e4d4:6fb96aa2f39b5b64',
  'classical:herm': '2855eb4bbe2ac7bb:313ca2c0b3ced8a3',
  'classical:torso': '2abc965fff9e8448:3294d901974fcbd9',
  'classical:marble': '8731d4dc32a0ddf5:a1042161429eb7b2',
  'classical:limestone': '2812588da512f54e:52c629314ad9b828',
  'classical:sandstone': 'f05e328cf7fef8b4:2aabfde09df11149',
  'classical:granite': 'eb59c2161f81b586:171bb1d53b05ace9',
  'classical:basalt': 'b41adc7878438968:26da77a1359ce84d',
  'classical:gilt': 'e88a3a81cd253c40:34a836aa49b885c7',
  'classical:painted': '02181a8cb74df8e0:a09443899bf4fe28',
  'classical:worn': '2b8e6dbd6022dc31:123d2198f69cf4a7',
  'roman:broken': '2dceb00ae122462f:8836a075890f8b39',
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
