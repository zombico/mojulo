/**
 * equipment/compose — laws 2's characterization pins: one per composition procedure (a sword hilt with a blade, with a
 * head; a haft with a blade, with a head), seed 3, the expanded monomers hashed. Re-pin only with a change that says
 * an item's emission under laws 2 changes (and a new LAWS_VERSION once laws 2 is released).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { expandEquipment } from './expand.js';

const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const BUILDS = {
  'sword hilt + blade': { item: 'sword', style: 'historical' },
  'sword hilt + head': { item: 'sword', style: 'dwarven', parts: { end: 'mace' } },
  'haft + blade': { item: 'staff', style: 'historical', parts: { hilt: 'pole', end: 'blade', blade: 'sabre' } },
  'haft + head (a grown shaft, a stone)': { item: 'staff', style: 'druid' },
};
const PINS = {
  'sword hilt + blade': '28abf2dc0899bfa2',
  'sword hilt + head': '8e67e8f75811d03e',
  'haft + blade': '6e5bb2b813de71b5',   // a blade on a haft at least 3.4 shaft radii wide (4 cm): a glaive reads at its camera
  'haft + head (a grown shaft, a stone)': '30ff38b316177930',
};

describe('laws 2 characterization', () => {
  it('pins each composition', () => {
    expect(Object.fromEntries(Object.entries(BUILDS).map(([k, b]) => [k, hash(expandEquipment({ type: 'equipment', seed: 3, laws: 2, ...b }).monomers)]))).toEqual(PINS);
  });
});
