// get_sketch_vocab names an argument it does not take instead of listing every card (cold agents asked for a card as
// `paradigm` and got the whole shelf back).
import { describe, it, expect } from 'vitest';
import { getSketchVocabHandler } from './sketch-vocab.js';

describe('get_sketch_vocab arguments', () => {
  it('refuses a stray argument, pointing at the call it meant', async () => {
    await expect(getSketchVocabHandler({ paradigm: 'house-layout' })).rejects.toThrow(/does not take `paradigm`.*get_sketch_vocab\(\{ id: 'house-layout' \}\)/);
  });
  it('still lists with no arguments or with detail, and reads a card by id', async () => {
    expect((await getSketchVocabHandler({})).cards.length).toBeGreaterThan(0);
    expect((await getSketchVocabHandler({ detail: true })).cards.length).toBeGreaterThan(0);
    expect((await getSketchVocabHandler({ id: 'house-concept' })).card.id).toBe('house-concept');
  });
});
