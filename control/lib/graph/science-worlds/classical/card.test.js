import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { withClassicalBlock } from './card.js';
import { solveClassical } from './solve.js';

const CARD = 'lib/graph/views/view-vocab/classical.md';

describe('science worlds: the classical card', () => {
  it('prints the law and closed-form tables as they are (run node scripts/science-cards.mjs when this fails)', () => {
    const card = readFileSync(CARD, 'utf8');
    expect(withClassicalBlock(card)).toBe(card);
  });

  it('has worked examples that solve and hold', () => {
    const card = readFileSync(CARD, 'utf8');
    const examples = [...card.split('## Worked examples')[1].split('<!-- laws:begin')[0].matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
    expect(examples.length).toBeGreaterThan(0);
    for (const params of examples) {
      const r = solveClassical({ model: params.model });
      expect(r.gates.filter((g) => !g.ok).map((g) => g.id), JSON.stringify(params.model.bodies.map((b) => b.id))).toEqual([]);
    }
  });
});
