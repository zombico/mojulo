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
 * in the rig), and again for its shoulder girdle (collarbones that rise with a raised arm).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': '401258105169ecce:dab453fda8e7ce1d',
  'archaic·female': '267d75cbfbfbe94c:ee974ddd01f7dbef',
  'classical·male': 'a0297ea8f2517df3:8ba55943537cfdca',
  'classical·female': 'c914ee71dfca2f21:427ae4f143c6305e',
  'hellenistic·male': '517223fdbf9e7794:fe2d8eca26ca14f8',
  'hellenistic·female': '08204882ee7fa602:ca41de045e1fb1b8',
  'roman·male': 'a1d8627a3fe9dfe8:1debf16d05b2175f',
  'roman·female': 'ce2956b7794b91f6:bb17082ac3bfb55c',
  'roman-bust·male': 'd48639f4ee6e126b:ab5281a88355a096',
  'roman-bust·female': '624f6b43b1e3baf1:a9cc5cc74e885286',
  'egyptian·male': '42ea710fcb09c007:4cc75ea4022a7885',
  'egyptian·female': '4d8413ba6b1355d8:b8c90cddfb1995c4',
  'sumerian·male': 'b0de6bc902c1a0bd:9fb01b008e5b0f0c',
  'sumerian·female': 'af38117cc873643a:a2a4f35900149534',
  'renaissance·male': '2ffe78503eadbef2:cffe1b91b3c6f2f5',
  'renaissance·female': '02c03382158ebc39:039d36c1c0705360',
  'classical:bust': '8febd1d581d64eb1:a034cb7a70043ed9',
  'classical:herm': '5f0f9fccd3801c8b:2787c16d8cc2ba22',
  'classical:torso': '8ac4f3b32c9f45e0:3bd56721630722c8',
  'classical:marble': 'a58f0fc3eba9ea23:ff6314e353ac4aa4',
  'classical:limestone': '2820f5c9458e9590:a6942b5159f6a47c',
  'classical:sandstone': '9dbe35d5480dd959:40ef4300c44f7540',
  'classical:granite': 'c7bf3b758c85134a:0179cc93600d7069',
  'classical:basalt': '4e45f56fd7aa215d:c533637adc262863',
  'classical:gilt': '8eb4f4332493d3d2:e73f644e97de26bb',
  'classical:painted': 'eeace31ccbc70413:4b5015b1e077091f',
  'classical:worn': 'b835de47b2fc94d5:c4cf09aa4464201c',
  'roman:broken': 'cb526ba46a181d64:ce490fda67653c8e',
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
