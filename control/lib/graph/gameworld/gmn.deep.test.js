import { describe, it, expect } from 'vitest';
import { MOTIVATIONS, LABOURS, WORLD_SHAPES, ORDER_KINDS, resolveGmn, layOrders, readGameBrief } from './gmn.js';
import { GENRES } from './intent.js';

// THE ROWS: every motivation and labour names what exists (a script, a light, a genre, a shape), and any one of them
// alone reads and lays.
describe('every row of the Game Brief', () => {
  it('names what exists and resolves alone', () => {
    for (const id of Object.keys(MOTIVATIONS)) {
      const R = resolveGmn({ motivations: { [id]: 1 } });
      expect(R.spine.acts, id).toHaveLength(3);
      expect(MOTIVATIONS[id].light, id).toHaveLength(3);
    }
    for (const [id, L] of Object.entries(LABOURS)) {
      expect(WORLD_SHAPES[L.shape], id).toBeTruthy();
      expect(ORDER_KINDS[L.climax.kind], id).toBeTruthy();
      for (const g of L.genres) expect(GENRES[g], `${id}: ${g}`).toBeTruthy();
      const gmn = { motivations: { [Object.keys(MOTIVATIONS)[0]]: 1 }, labours: { [id]: 1 } };
      expect(() => readGameBrief({ gmn, orders: layOrders(resolveGmn(gmn)) }), id).not.toThrow();
    }
  });
});
