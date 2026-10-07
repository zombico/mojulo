/**
 * store characterization net: one hash per seeded card, standalone, seed 7.
 *
 * A stored `store` recipe regenerates on every read, so these faces are a compatibility promise
 * over minted rows. The pins were computed by the pre-promotion build of this interpreter and
 * reproduced unchanged after the move into core. Re-pin ONLY alongside a change that says the
 * store emission changes, and log it here.
 *
 * Re-pinned: department and wine-bar, when the store came to build on dmath (util/dmath.js; its shared lathe, sweep and
 * figure helpers under withMath). Their pins were macOS arm64's; department's new pin is what x64 always printed, and
 * wine-bar's moves with the mannequin's pow. The other cards did not move.
 * Re-pinned: every card, when the shared floor finish went quiet (floorplan-structure.js floorFinishFaces): plank seams a
 * hairline at 0.9 of the plank on 0.6 ft boards (were 0.62 on 0.5 ft), marble seams at 0.93 (were 0.88). A card's own
 * floor tint is unchanged.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildStandaloneStore } from './store-concept.js';
import { SEEDED_CARDS } from './store-cards.js';

const SIZE = { department: { width: 40, depth: 60 }, 'wine-bar': { width: 26, depth: 44 } };
const PINS = {
  apparel: 'aeab8aec118061fa',
  bookstore: '189eb7d3765a06d4',
  cafe: '39111f3e624146ae',
  department: '54d40e1743b4bd58',
  electronics: '421dc3a0193a78c0',
  food: '4b70deeb1d2b32a0',
  homewares: '23ef74a50512e3af',
  'wine-bar': 'b3d67bcd73205937',
};
const hash = (faces) => createHash('sha256').update(JSON.stringify(faces)).digest('hex').slice(0, 16);

describe('store characterization (byte pins per seeded card)', () => {
  for (const [id, pin] of Object.entries(PINS)) {
    it(id, () => {
      const s = buildStandaloneStore(SEEDED_CARDS[id], { ...(SIZE[id] || { width: 24, depth: 40 }), seed: 7 });
      expect(hash(s.faces)).toBe(pin);
    });
  }
  it('pins every seeded card', () => expect(Object.keys(PINS).sort()).toEqual(Object.keys(SEEDED_CARDS).sort()));
});
