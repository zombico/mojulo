// THE WEAPON SHELF, every row: each joins the stylish kit and reads as a weapon (combos.js readArsenal), held in the hand.
import { describe, it, expect } from 'vitest';
import { WEAPON_SHELF, SHELF_IDS } from './weapon-shelf.js';
import { readGameArsenal } from './arsenal.js';

describe('every row of the weapon shelf', () => {
  it('reads as a weapon of the stylish kit, held in the hand, with a string that opens on the light', () => {
    for (const id of SHELF_IDS) {
      expect(() => readGameArsenal({ from: 'fallen-angel', weapons: [{ shelf: id }] }), id).not.toThrow();
      expect(WEAPON_SHELF[id].held?.item, id).toBeTruthy();
      expect(WEAPON_SHELF[id].combos.some((c) => c.beats[0] === 'L'), id).toBe(true);
    }
  });
});
