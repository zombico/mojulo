// The interior's laws over seeds and section orders (scroll-stage/interior.js): every plan holds passage, continuity,
// climb, on-screen and mounts, whichever section follows which, on a straight track and one climbing across.
import { describe, it, expect } from 'vitest';
import { SECTION_IDS, planInterior, interiorLaws } from './interior.js';
import { scrollCamera } from './frame.js';

const cam = scrollCamera(13.28), A = cam.screen.along, C = cam.screen.across, ship = { length: 13.28, breadth: 6.08 };
const tracks = [[{ by: [60 * A, 0], pace: 0.1 * A }], [{ by: [60 * A, 3 * C], pace: 0.1 * A }]];

describe('the interior\'s laws, swept', () => {
  it('hold for every seed, order and track', () => {
    const broken = [];
    for (let seed = 1; seed <= 24; seed++) for (const track of tracks) {
      const order = SECTION_IDS.map((k, i) => SECTION_IDS[(i + seed) % SECTION_IDS.length]);
      const P = planInterior({ at: 1, sections: [{ kind: 'mouth' }, ...order.map((kind) => ({ kind }))], seed }, { cam, track });
      for (const l of interiorLaws(P, { cam, ship, pace: 0.1 * A })) if (!l.holds) broken.push(`${seed}: ${l.says}`);
    }
    expect(broken).toEqual([]);
  });
});
