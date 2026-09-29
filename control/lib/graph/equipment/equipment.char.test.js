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
 *   - The samples wear metal surfaces (materials/metal-surface.js) in their metal roles: every item re-pinned.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { expandEquipment, EQUIPMENT_ITEMS } from './expand.js';
import { SEEDED_STYLES } from './styles.js';

const PINS = {
  'historical/dagger': '6d287d4ec4681e2e',
  'historical/sword': '500c877fb035ccfb',
  'historical/greatsword': '272dc97b667f3729',
  'historical/staff': '63e6d4fe903699a0',
  'historical/bow': 'de93d773027f8a56',
  'historical/shield': '4d86d0bbb20c6f5c',
  'elven/dagger': '236b10241e9cc1b2',
  'elven/sword': 'efdd7e384ef35ff7',
  'elven/greatsword': '7bc645b549cdbb9d',
  'elven/staff': '4f2d459ab795cdf6',
  'elven/bow': '19a126476d1e7c51',
  'elven/shield': '315e12479ce43d93',
  'dwarven/dagger': '296045a4bb0b41fa',
  'dwarven/sword': 'a9ba82cbaa1dd855',
  'dwarven/greatsword': '90090bceb6f629e2',
  'dwarven/staff': 'c05aa00d36de2e37',
  'dwarven/bow': '4071aa2885463de5',
  'dwarven/shield': '0f1e041555a666dd',
  'brutal/dagger': 'c216a679f5656b88',
  'brutal/sword': 'f04d3f8d758bbe1d',
  'brutal/greatsword': 'a32ab57bf828a55d',
  'brutal/staff': '651c107f14c8a143',
  'brutal/bow': '48f0e084267110a0',
  'brutal/shield': 'f8dcabd14014031a',
  'eastern/dagger': 'c4860f04e43a6524',
  'eastern/sword': '77424d1060bfd649',
  'eastern/greatsword': '5dc3889cdb84995a',
  'eastern/staff': '19dcd69b475e18f0',
  'eastern/bow': '31934d965a8b2475',
  'eastern/shield': 'fe26116c25236619',
  'anime-hero/dagger': 'd2542c3b2aed06ff',
  'anime-hero/sword': 'e44545d063046501',
  'anime-hero/greatsword': '546f591c5dfa5d14',
  'anime-hero/staff': '573e2394c10f94f6',
  'anime-hero/bow': 'b5455770fc4099cd',
  'anime-hero/shield': 'c7b591d118f242b6',
  'druid/dagger': '3377fd5071adaa48',
  'druid/sword': '3c585abe578cb8e6',
  'druid/greatsword': '2803a90a600d008c',
  'druid/staff': 'a96ca7b90a69e2af',
  'druid/bow': 'e21ecd9f4aaa449f',
  'druid/shield': 'c4d13ac48ea7210f',
  'celestial/dagger': 'f3e6dee96ea892ba',
  'celestial/sword': '59222f4704034ffa',
  'celestial/greatsword': '3dc3f0219c00ec14',
  'celestial/staff': 'c48a08a3d27f8568',
  'celestial/bow': '0a5355b7ccd08c32',
  'celestial/shield': '22d5fcfe6a75f3a4',
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
