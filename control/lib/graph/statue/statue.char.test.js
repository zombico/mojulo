/**
 * statue characterization net: one hash per seeded card × silhouette, and per format and material over the classical
 * card, at the laws STATUE_LAWS_VERSION. Each hashes the carved RECIPE (parts, palette, surfaces, the ledger) and the
 * World faces the read path builds from it (the figure on its base).
 *
 * A stored statue build regenerates on every read of the hero, so its expansion is a compatibility promise over minted
 * rows (STATUE_PINS=1 prints the current hashes). Re-pin ONLY alongside a change that says a statue's emission changes (the hero form under it moving counts:
 * say which); a change to the laws is a new STATUE_LAWS_VERSION instead.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { STATUE_STYLES } from './styles.js';

const PINS = {
  'archaic·male': '97332eae0dcaf4da:4fa1075e7450f2b5',
  'archaic·female': '7cb3f7d92854c8ec:3ce0dddf2d86befa',
  'classical·male': 'a55fef6cf80acb9e:eb95977d654066c2',
  'classical·female': 'c3b8912181215d75:3e9b487789fd5a16',
  'hellenistic·male': '5ddae5000eaa7d48:34f5f137c8103421',
  'hellenistic·female': 'b5f1abf416d1a70a:62ff7ad21a5d5293',
  'roman·male': 'b9a1d04bacdb3dd7:cc8e6f075b3e73c1',
  'roman·female': 'b83fa5dab6ae46de:8d3d0084f1b6cdee',
  'roman-bust·male': 'b141f8a8b77362cc:ab5281a88355a096',
  'roman-bust·female': 'aef4fac3f8ab6e78:a9cc5cc74e885286',
  'egyptian·male': '74fa0bedf9053d2e:7d832eef78722566',
  'egyptian·female': '1f2a14bf429ea9b9:8de1d1afaaf27469',
  'renaissance·male': '1cb4aa7f6dfdade2:f4f03da16e45fadd',
  'renaissance·female': '612eaa085da05235:4b6d4490fd3c97cd',
  'classical:bust': 'b5cd580c70b513fe:d45dc3a3b024b37a',
  'classical:herm': 'fafd6e4d833041c7:4b11ba59655b64b6',
  'classical:torso': 'b9434b7ba6c069db:e8f46582d1e92f9b',
  'classical:marble': '8030046427e62455:f76146bd02592991',
  'classical:limestone': 'e5966fe45e53ee21:e50f8e9faaac5b1e',
  'classical:sandstone': '4abdf5a6b569e1d8:b43d684e5b10673f',
  'classical:granite': '3eaf9da2b130213d:9b71d6e1be80ab85',
  'classical:basalt': '29631a8585b97a10:cb2e67da02cd1935',
  'classical:gilt': '2978d11c4254b882:2310c8eec14e2f9a',
  'classical:painted': 'b10fa5b4cb2f7903:542d83fc408f606f',
  'classical:worn': '4d36e52f68bd7ec2:de435d6189227866',
  'roman:broken': '7cec559e5004de0c:4620d7c23c14b359',
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
