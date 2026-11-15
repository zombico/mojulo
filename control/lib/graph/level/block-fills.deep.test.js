// THE TRAIL LIBRARY, swept: every template at every size a segment takes, on every set of gates a block can have. Each
// lays ways a segment's law holds (plan.js readSegment) and a map that is one network.
import { describe, it, expect } from 'vitest';
import { BLOCK_FILL_IDS } from './block-fills.js';
import { readPlan, fillSegment, readSegment, SEGMENT_SIZE } from './plan.js';

// the block E in the middle of a cross: its walk in and out and its joins chosen from its four neighbours
const LAYOUT = ['. N .', 'W E X', '. S .'];
const CASES = [
  { route: ['W', 'E', 'X'] }, { route: ['W', 'E', 'N'] }, { route: ['N', 'E', 'S'] },
  { route: ['W', 'E', 'X'], joins: [['E', 'N']] }, { route: ['W', 'E', 'X'], joins: [['E', 'N'], ['E', 'S']] },
  { route: ['W', 'E'] }, { route: ['E', 'X'] },
];

describe('the trail library, swept', () => {
  it('every template, size and set of gates lays a segment that holds its law', () => {
    for (let size = SEGMENT_SIZE.lo; size <= SEGMENT_SIZE.hi; size++) for (const fill of BLOCK_FILL_IDS) for (const c of CASES) {
      const used = new Set([...c.route, ...(c.joins ?? []).flat()]);
      const rows = LAYOUT.map((r) => r.split(' ').map((g) => (used.has(g) ? g : '.')).join(' '));
      for (const goal of [false, true]) {
        if (goal && c.route.at(-1) !== 'E') continue;
        const P = readPlan({ size, rows, ...c, key: { E: { fill, ...(goal ? { goal: { use: 'keep' } } : {}) } } });
        expect(() => readSegment(P, 'E', fillSegment(P, 'E')), `${fill} at ${size}, ${c.route.join('>')}${c.joins ? ' joined' : ''}${goal ? ', a goal' : ''}`).not.toThrow();
      }
    }
  });
});
