// The lorecube's drawings under docs/lorecube/ are made from its data: a stale one fails here.
//   node scripts/lorecube-diagrams.mjs
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drawings } from './lorecube-diagrams.mjs';

describe('the lorecube drawings are current', () => {
  it('docs/lorecube/*.svg', async () => {
    const all = await drawings();
    expect(all.length).toBeGreaterThan(0);
    for (const [name, svg] of all) {
      const path = fileURLToPath(new URL(`../../docs/lorecube/${name}`, import.meta.url));
      expect(existsSync(path), `${name}: run node scripts/lorecube-diagrams.mjs`).toBe(true);
      expect(readFileSync(path, 'utf8') === svg, `${name} is stale: run node scripts/lorecube-diagrams.mjs`).toBe(true);
    }
  });
});
