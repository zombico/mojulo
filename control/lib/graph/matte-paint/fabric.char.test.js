import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { rockFabric } from './fabric.js';
import { fabricScript } from '../scene/channels/fabric.js';

// CHARACTERIZATION PIN (the operator's baseline, 2026-10-20): the near rock as it was approved, on the island's own
// fabric (granite, blocky, the card's 3.2 m joints at strike 0) under valley-morning's sun. A change to the fabric spec
// or to what the page draws from it is legitimate only when the step says the drawing changes.
const print = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const ISLAND = { joints: { pattern: 'blocky', strike: 0, spacing: 3.2, cell: [1, 0.8], lattice: 'rect', plane: 'snap', dip: 60, steep: 40, band: 12, seed: 1 }, grit: 0.7, sun: [-0.3747, -0.3747, 0.848], seed: 1 };

describe('the rock fabric is pinned', () => {
  it('the island\'s fabric spec', () => {
    expect(print(JSON.stringify(rockFabric(ISLAND)))).toBe('821438d9b2b1');
  });
  it('what the page draws from it', () => {
    expect(print(fabricScript(rockFabric(ISLAND)))).toBe('4303c7d83d92');
  });
});
