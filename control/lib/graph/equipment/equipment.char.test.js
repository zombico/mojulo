/**
 * equipment characterization net: one hash per seeded style × item, seed 3, the laws at LAWS_VERSION.
 *
 * A stored equipment build regenerates on every read, so its expansion is a compatibility promise over minted rows.
 * The pins hash the expanded MONOMERS (the lowerers under them have their own pins). They were computed by the
 * kernel as ported from the fantasy-equipment spike. Re-pin ONLY alongside a change that says an item's emission
 * changes; a change to the laws' curves is a new LAWS_VERSION instead, and rows minted under the old one keep it.
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
  'elven/dagger': '621456880afa7a7b',
  'elven/sword': 'dd6b49aa5841560f',
  'elven/greatsword': '72e1aac4357b15d4',
  'elven/staff': 'cc3b3e5c94081aed',
  'elven/bow': 'c2069d4f90e23d96',
  'elven/shield': '7ff48bdfbc862cc9',
  'dwarven/dagger': '4d8f3c423c19d6e5',
  'dwarven/sword': '153945c6d85160e3',
  'dwarven/greatsword': 'd375d7c54be129cd',
  'dwarven/staff': 'fb540a6a2950eb95',
  'dwarven/bow': '6a9b66f897de76ff',
  'dwarven/shield': 'c06877844e99728b',
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
  'anime-hero/dagger': '9578449de9828414',
  'anime-hero/sword': 'e9274b93751b8a26',
  'anime-hero/greatsword': 'a8cfe3cab5915880',
  'anime-hero/staff': 'b8f8fb6ee838de8e',
  'anime-hero/bow': '83d6a2601c95cf44',
  'anime-hero/shield': '6c9ed813352858b2',
  'druid/dagger': '7f18f504897c65fe',
  'druid/sword': '951697c0437c6941',
  'druid/greatsword': '25d15bf4e76cfa69',
  'druid/staff': 'd26abf75ce149939',
  'druid/bow': 'd15a40ca4d36d914',
  'druid/shield': '9cde935e0f7d26ec',
  'celestial/dagger': '9b08b3bfb1537981',
  'celestial/sword': '5bafb4cfcfaf5d87',
  'celestial/greatsword': '246ebe28304e66d7',
  'celestial/staff': '209915e017bbcccc',
  'celestial/bow': 'a1db086df324cdfd',
  'celestial/shield': '817aec33541ad253',
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
