import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { withRelativisticBlock } from './card.js';
import { solveRelativistic } from './solve.js';

const CARD = 'lib/graph/views/view-vocab/relativistic.md';

describe('science worlds: the relativistic card', () => {
  it('prints the law table as it is (run node scripts/science-cards.mjs when this fails)', () => {
    const card = readFileSync(CARD, 'utf8');
    expect(withRelativisticBlock(card)).toBe(card);
  });

  it('has worked examples that solve and hold', () => {
    const card = readFileSync(CARD, 'utf8');
    const examples = [...card.split('## Worked examples')[1].split('<!-- laws:begin')[0].matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
    expect(examples.length).toBeGreaterThan(0);
    for (const params of examples) {
      const r = solveRelativistic({ model: params.model });
      expect(r.gates.filter((g) => !g.ok).map((g) => g.id), params.model.system).toEqual([]);
    }
  });
});
