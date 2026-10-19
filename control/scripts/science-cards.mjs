#!/usr/bin/env node
// Write the science worlds' generated card blocks back into their view-vocab cards (the law and closed-form tables).
// Run from control/: node scripts/science-cards.mjs. A stale card fails lib/graph/science-worlds/classical/card.test.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { withClassicalBlock } from '../lib/graph/science-worlds/classical/card.js';

const path = 'lib/graph/views/view-vocab/classical.md';
const before = readFileSync(path, 'utf8');
const after = withClassicalBlock(before);
if (after === before) console.log(`${path}: up to date`);
else { writeFileSync(path, after); console.log(`${path}: rewritten`); }
