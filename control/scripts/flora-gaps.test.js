import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { floraGapsMd, PAGE } from './flora-gaps.mjs';

// The flora gap report is generated from the tree. A change to the substrate rules or the flora library that is not
// regenerated fails here: `npm run flora-gaps`, then commit the page with the change.
describe('the flora gap report is current', () => {
  it('docs/flora-gaps.md', async () => {
    expect(readFileSync(PAGE, 'utf8') === await floraGapsMd(), 'stale: npm run flora-gaps').toBe(true);
  });
});
