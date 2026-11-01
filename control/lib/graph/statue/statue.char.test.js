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
 * bytes). And the draped and belted cases when the game body's dress moved (1029, unreleased): a waistband with no ease
 * (outfit law 2, body-garment.js `waistband`), and a belt made as one mass with a frame buckle in place of the
 * adornment's band (authored-kit.js); and again (1029, unreleased) when a sleeve starting on the arm's first ring took its
 * cap out past the skin's at the shoulder (authored-jacket.js sleeveSeams: the draped cases' sleeves). And every case
 * again for the hero laws 21 (hero-form.js FORM_BODY: a statue minted now is a landmark adult on the one body every
 * tiered hero wears, rounded, its chest narrowed and the male's pectorals off; a statue stored before keeps its laws and
 * its bytes).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': 'ee3da2bca3dd3b88:53a4da8d05e536ab',
  'archaic·female': 'a1b436ffad0ed65b:63460b0139f40e0e',
  'classical·male': 'c32fb625e28b5cb2:6b75703cfa3a3c19',
  'classical·female': '35e698c915d8af56:f1a5b91b614f0f40',
  'hellenistic·male': 'fd50a739e5038a88:45af7a50974c0c3a',
  'hellenistic·female': 'f562ed6ff43851a6:c1d257ddf60afc07',
  'roman·male': 'ddffbcb468b0dc5b:349360ab1d312260',
  'roman·female': '190b6e0cdcfa25af:2194f6ae4c0aca8b',
  'roman-bust·male': 'a2c261519cf75992:ebcc515c1c2d534f',
  'roman-bust·female': '35e00df03469383e:9f6aae466055a7aa',
  'egyptian·male': 'bb8217c4abc9b743:77cf83ac96d7daa1',
  'egyptian·female': 'c407f29ea87bc38c:49d880dc2b555ea4',
  'sumerian·male': '9d77ce0989d4b3b7:f911a3f61200f371',
  'sumerian·female': '7bcd1d0a15d918f3:7aad4448f61e3d8a',
  'renaissance·male': 'ad1c1b04a207a58c:ce04cd4a06ba1053',
  'renaissance·female': '24fba5f07d1c7a6e:fe3b7411cf4fea1e',
  'classical:bust': 'ad847ab96a1f9418:1320480ebf6fab4c',
  'classical:herm': '89a3ab8a4be8fbc5:9ce7b28706db774d',
  'classical:torso': '693048b5761f3b16:a00549ba9b16cfcd',
  'classical:marble': '1b64aba84fe7e0b6:0cadb5bc3e2ca918',
  'classical:limestone': 'bdb533d569711ec9:ece2ec9454bc4a25',
  'classical:sandstone': 'e1c7bd63c3e9bf4c:314a3dc5b70fc204',
  'classical:granite': 'ea7df20c2a38f5c5:4a36436114342234',
  'classical:basalt': '97ec713342b4a620:7c9a5392b9b18de0',
  'classical:gilt': '4a49907a7b3e1004:19ac0bebf0d9ebbb',
  'classical:painted': '8fe8a12ededd33f0:a76d620ea6a8c70a',
  'classical:worn': '3a444cc2cb0a056e:5e29285354b42ec6',
  'roman:broken': 'e42400a05b080ca3:fdab4720b2cf9f3f',
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
