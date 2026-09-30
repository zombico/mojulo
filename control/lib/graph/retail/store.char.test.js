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
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildStandaloneStore } from './store-concept.js';
import { SEEDED_CARDS } from './store-cards.js';

const SIZE = { department: { width: 40, depth: 60 }, 'wine-bar': { width: 26, depth: 44 } };
const PINS = {
  apparel: '1181582a2c4697ec',
  bookstore: 'c1f3d5610807cb39',
  cafe: '5a2286b3b786d211',
  department: '2e64afaa21fea7a5',
  electronics: '749f508c439f5f42',
  food: '0a8631086de2356d',
  homewares: '4800ae13da2c804e',
  'wine-bar': '50db283660598df9',
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
