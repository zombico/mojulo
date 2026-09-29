/**
 * equipment characterization net: one hash per seeded style × item, seed 3, the laws at LAWS_VERSION.
 *
 * A stored equipment build regenerates on every read, so its expansion is a compatibility promise over minted rows.
 * The pins hash the expanded MONOMERS (the lowerers under them have their own pins). They were computed by the
 * kernel as ported from the fantasy-equipment spike. Re-pin ONLY alongside a change that says an item's emission
 * changes; a change to the laws' curves is a new LAWS_VERSION instead, and rows minted under the old one keep it.
 *
 * Log:
 *   - Settings grip the girdle (crystal-optics crystalGirdle): every item carrying a stone re-pinned. Laws 1 is
 *     unreleased, so the refinement folds into it rather than opening laws 2.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { expandEquipment, EQUIPMENT_ITEMS } from './expand.js';
import { SEEDED_STYLES } from './styles.js';

const PINS = {
  'historical/dagger': 'a54e0832441b70dc',
  'historical/sword': '5ba772adcf9a80a0',
  'historical/greatsword': '7fb2b5f9961105ee',
  'historical/staff': 'cc5a26eb8ae654c0',
  'historical/bow': 'ae938350173f8203',
  'historical/shield': '362977d0185cbcef',
  'elven/dagger': '50abba2d925791e2',
  'elven/sword': '8c5f33adce9f84d6',
  'elven/greatsword': '31f65dda79650ad1',
  'elven/staff': 'e8a04de2f71fc600',
  'elven/bow': '7634f5506db92a9a',
  'elven/shield': '2f741e04b8305b76',
  'dwarven/dagger': 'fd5ce3614f929314',
  'dwarven/sword': '302ef3a59dd46b37',
  'dwarven/greatsword': '7c42cfe23d0d1ec4',
  'dwarven/staff': '376816afd110156f',
  'dwarven/bow': '89560433b225af98',
  'dwarven/shield': '101ba12106b944bc',
  'brutal/dagger': '1af6d753e54162c2',
  'brutal/sword': 'eade995115e5f11a',
  'brutal/greatsword': '6f20a940505555a5',
  'brutal/staff': '62d40f2f1c0cea5d',
  'brutal/bow': '0fb063270f2d57d3',
  'brutal/shield': '59ffd88b0e10f9b0',
  'eastern/dagger': 'f05b1a21ce340fef',
  'eastern/sword': 'e7be12137cafcba6',
  'eastern/greatsword': 'c737d21dbee6eccf',
  'eastern/staff': '5114887d178d1296',
  'eastern/bow': 'de352b663fe54ad5',
  'eastern/shield': 'b38570fa132993ae',
  'anime-hero/dagger': '52243631864d9af1',
  'anime-hero/sword': '722acba6ec7a4576',
  'anime-hero/greatsword': 'a445aa78e9d3b57d',
  'anime-hero/staff': '6111cc8f8a891617',
  'anime-hero/bow': 'b7879cb7d9e6d2db',
  'anime-hero/shield': '8a392c862c052000',
  'druid/dagger': '316ad78ba3ac7c7f',
  'druid/sword': '520c2fd1ec9e3a50',
  'druid/greatsword': 'b6b13c4402cd90b3',
  'druid/staff': '7f9e2181e8e43c07',
  'druid/bow': '70872b0559214ab6',
  'druid/shield': 'd145134bc1ae85a0',
  'celestial/dagger': 'b06e32a76eb96db0',
  'celestial/sword': '30c40377c3301f3e',
  'celestial/greatsword': 'ae8f48ab6930ba23',
  'celestial/staff': 'ef97ed625819c44b',
  'celestial/bow': '99fb04ff32c21544',
  'celestial/shield': '0cb52b4232b80ac4',
};
const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);

describe('equipment characterization (byte pins per seeded style × item)', () => {
  for (const [key, pin] of Object.entries(PINS)) {
    it(key, () => {
      const [style, item] = key.split('/');
      expect(hash(expandEquipment({ type: 'equipment', item, style, seed: 3 }).monomers)).toBe(pin);
    });
  }
  it('pins every seeded style × item', () => {
    expect(Object.keys(PINS).sort()).toEqual(Object.keys(SEEDED_STYLES).flatMap((s) => EQUIPMENT_ITEMS.map((i) => `${s}/${i}`)).sort());
  });
});
