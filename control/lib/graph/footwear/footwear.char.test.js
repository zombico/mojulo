// footwear.char.test.js — the realistic body's footwear words, pinned byte for byte as the library first carried them
// (moved behind the realistic adapter unchanged). Their parts alone, so a change to the body under them is the body's pin.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const PINS = { boots: [18, 'bba218d019b9d024'], shoes: [12, '329af4f33fe33ad8'], sandals: [12, '427b2b0bf000de7d'] };

describe('the realistic footwear words', () => {
  it('are their pinned parts', () => {
    for (const [w, [n, hash]] of Object.entries(PINS)) {
      const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: [w] }) }).recipe;
      const fw = Object.fromEntries(Object.entries(r.parts).filter(([k]) => k.startsWith(w)).sort(([a], [b]) => (a < b ? -1 : 1)));
      expect(Object.keys(fw).length, w).toBe(n);
      expect(createHash('sha256').update(JSON.stringify(fw)).digest('hex').slice(0, 16), w).toBe(hash);
    }
  }, 300_000);
});
