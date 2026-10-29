// The cue lexicon (beast/lexicon.js): a sheet's notes read as the beast's anatomy words. The laws on hand-built notes,
// one per procedure the reading runs: a row sets its word, the first that matches wins and the specific row before the
// general; a negation sets only its own none; the mass rows compose; a coil drops the tail and lays its cover below the
// waist; the nearest skull by the lineage's own reads first; a part the composer lacks named, never dropped.
import { describe, it, expect } from 'vitest';
import { readAnatomy, WORD_ROWS, SKULL_FAMILIES } from './lexicon.js';
import { HEAD_LIBRARY } from '../creature-heads/index.js';
import { BEAST_WORDS } from './tiered.js';

const sheet = (notes, reads = 'a people') => ({ ancestry: { reads }, notes: Object.fromEntries(Object.entries(notes).map(([ch, lines]) => [ch, lines.map((line) => ({ line }))])) });

describe('the cue lexicon', () => {
  it('names only words the beast has and skulls the library holds', () => {
    for (const R of WORD_ROWS) expect(BEAST_WORDS).toContain(R.word);
    for (const F of SKULL_FAMILIES) expect(HEAD_LIBRARY[F.head]).toBeTruthy();
  });

  it('a row sets its word, the specific before the general; a negation only its own none', () => {
    expect(readAnatomy(sheet({ frame: ['a bushy tail'] })).words.tail).toBe('brush');
    expect(readAnatomy(sheet({ frame: ['a tail'] })).words.tail).toBe('thin');
    expect(readAnatomy(sheet({ frame: ['no tail, and no claws'] })).words).toEqual({ tail: 'none' });
    expect(readAnatomy(sheet({ ornament: ['talons'] })).words.claws).toBe('long');
  });

  it('the masses compose, bounded; a coil takes no tail and lays its cover below the waist', () => {
    const W = readAnatomy(sheet({ frame: ['hulking', 'a barrel of a body'] })).words.mass;
    expect(W.trunk).toBeCloseTo(1.15 * 1.1, 3); expect(W.waist).toBe(1.25);
    const coil = readAnatomy(sheet({ frame: ['a snake\'s body in place of legs, a long tail'], cover: ['scales'] })).words;
    expect(coil).toMatchObject({ legs: 'serpent', tail: 'none', cover: 'scales', coat: 'lower' });
  });

  it('the nearest skull by the lineage\'s own reads first, then its notes; none where no family word is known', () => {
    expect(readAnatomy(sheet({ structure: ['a long muzzle'] }, 'owl-kin')).head).toMatchObject({ id: 'beaked', provisional: false });
    expect(readAnatomy(sheet({ structure: ['a blunt muzzle'] }, 'porcupine-kin')).head).toMatchObject({ id: 'wolf', provisional: true });
    expect(readAnatomy(sheet({ structure: ['a round face'] }, 'selkie')).head).toBe(null);
  });

  it('only the lineage\'s own lines: the build\'s and the archetype\'s are the cast\'s', () => {
    const S = { ancestry: { reads: 'a people' }, notes: { stance: [{ line: 'stooped from carrying', from: 'archetype.caregiver' }], frame: [{ line: 'a thick tail', from: 'ancestry.x' }] } };
    expect(readAnatomy(S).words).toEqual({ tail: 'thick' });
  });

  it('a part the composer lacks is named against its line, never dropped', () => {
    const R = readAnatomy(sheet({ frame: ['cloven hooves and a thick tail'] }));
    expect(R.gaps.get('cloven hooves and a thick tail').map((g) => g.part).join()).toMatch(/hooves/);
    expect(R.placed.get('cloven hooves and a thick tail')).toMatch(/spec\.beast\.tail/);
  });
});
