#!/usr/bin/env node
// Write the science worlds' generated card blocks back into their view-vocab cards (the law and closed-form tables).
// Run from control/: node scripts/science-cards.mjs. A stale card fails lib/graph/science-worlds/classical/card.test.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { withClassicalBlock } from '../lib/graph/science-worlds/classical/card.js';
import { withMicroscopicBlock } from '../lib/graph/science-worlds/microscopic/card.js';
import { withQuantumBlock } from '../lib/graph/science-worlds/quantum/card.js';
import { withRelativisticBlock } from '../lib/graph/science-worlds/relativistic/card.js';

for (const [path, write] of [['lib/graph/views/view-vocab/classical.md', withClassicalBlock], ['lib/graph/views/view-vocab/microscopic.md', withMicroscopicBlock], ['lib/graph/views/view-vocab/quantum.md', withQuantumBlock], ['lib/graph/views/view-vocab/relativistic.md', withRelativisticBlock]]) {
  const before = readFileSync(path, 'utf8');
  const after = write(before);
  if (after === before) console.log(`${path}: up to date`);
  else { writeFileSync(path, after); console.log(`${path}: rewritten`); }
}
