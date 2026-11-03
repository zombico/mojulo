/** equipment/armory, swept: every arm in the roster validates and expands, and every kit rolls on a run of seeds. */
import { describe, expect, it } from 'vitest';

import { expandEquipment, validateBuild } from './expand.js';
import { ARMORY_ARMS, ARMORY_KIT_NAMES, armFrom } from './armory.js';

describe('the armory, every arm and every kit', () => {
  it('every arm validates and expands', () => {
    for (const [name, b] of Object.entries(ARMORY_ARMS)) { const B = { type: 'equipment', laws: 2, ...b }; expect(validateBuild(B), name).toEqual([]); expect(expandEquipment(B).trace.length, name).toBeGreaterThan(0); }
  });
  it('every kit rolls a valid gear on 40 seeds', () => {
    for (const kit of ARMORY_KIT_NAMES) for (let s = 1; s <= 40; s++) for (const b of Object.values(armFrom(kit, s))) expect(validateBuild(b), `${kit} ${s}`).toEqual([]);
  });
});
