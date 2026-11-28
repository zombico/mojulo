import { describe, it, expect } from 'vitest';
import { outfitPieces } from './expand.js';
import { OUTFIT_KINDS } from '../polygonizer/outfit-plan.js';

// A BUILD'S PIECE IN PLACE OF ITS CARD'S, AND A VEST WITH NO BACK PANEL
describe('a build\'s pieces over its card\'s', () => {
  it('wears the card\'s and the build\'s both unless a piece says replace: then it stands in for the card\'s of its kind', () => {
    const both = outfitPieces({ type: 'outfit', style: 'security', pieces: [{ kind: 'vest', cut: 'plate' }] });
    expect(both.filter((p) => p.kind === 'vest').map((p) => p.cut)).toEqual(['slick', 'plate']);
    const one = outfitPieces({ type: 'outfit', style: 'security', pieces: [{ kind: 'vest', cut: 'plate', replace: true }] });
    expect(one.filter((p) => p.kind === 'vest')).toEqual([{ kind: 'vest', cut: 'plate' }]);
    // (the card's other pieces kept)
    expect(one.map((p) => p.kind)).toEqual(expect.arrayContaining(['pouches', 'thighPouch']));
  });
});

describe('the vest\'s back panel', () => {
  it('is worn by default, and left off by back: false', () => {
    const vest = OUTFIT_KINDS.vest, B = { k: 1 }, G = () => 'Top';
    // (the default cut's back panel, the only piece it adds beside its front; the plate cut's among its pouches)
    const ids = (p) => { try { return vest.compile(p, B, G, {}).adorn.map((a) => a.id); } catch { return null; } };
    const on = ids({ kind: 'vest', cut: 'plate' }), off = ids({ kind: 'vest', cut: 'plate', back: false });
    expect(on).not.toBeNull();
    expect(on).toContain('vestBack');
    expect(off).not.toContain('vestBack');
  });
});
