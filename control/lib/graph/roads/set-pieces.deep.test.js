// The set piece library swept: every block builds at its own rails' ends and holds its laws; every set names blocks
// that exist for every beat and focus form.
import { describe, it, expect } from 'vitest';
import { TRACK_BLOCKS, SETS } from './set-pieces.js';
import { buildBlock, blockLaws } from '../era/blocks.js';
import { FOCUS_FORMS } from './trackscape.js';

describe('the set piece library', () => {
  it('every block builds at its rails\' ends and holds its laws at the middle', () => {
    for (const [id, B] of Object.entries(TRACK_BLOCKS)) {
      for (const end of [0, 1]) {
        const params = Object.fromEntries(Object.entries(B.params ?? {}).filter(([, r]) => typeof r[0] === 'number').map(([k, r]) => [k, r[end]]));
        expect(() => buildBlock(B, { params, library: TRACK_BLOCKS }), `${id} at ${end ? 'top' : 'foot'}`).not.toThrow();
      }
      const b = buildBlock(B, { library: TRACK_BLOCKS, seed: 1 });
      expect(blockLaws(B, b).filter((l) => !l.ok), id).toEqual([]);
    }
  });
  it('every set names a block for every beat and focus form', () => {
    for (const [set, S] of Object.entries(SETS)) {
      for (const beat of ['braking', 'rhythm', 'pocket', 'reveal', 'span', 'gantry', 'landmark']) for (const id of [S[beat]].flat()) expect(TRACK_BLOCKS[id], `${set}.${beat}`).toBeTruthy();
      for (const f of FOCUS_FORMS) expect(TRACK_BLOCKS[S.focus[f]], `${set}.focus.${f}`).toBeTruthy();
    }
  });
});
