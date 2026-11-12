// The halls: an exhibit is `<hall>/<id>`, its hall its family's unless an override moves it, and an id resolves both ways.
import { describe, it, expect } from 'vitest';
import { HALLS, HALL_IDS, FAMILY_HALL, HALL_OVERRIDES, hallOf, exhibitId, splitExhibitId, exhibitCatalog, resolveExhibit } from './halls.js';
import { readFileSync } from 'node:fs';
import { getViewVocabCatalog } from '../views/view-vocab/loader.js';

const cards = [
  { id: 'fission', family: 'science' },
  { id: 'galaxy', family: 'science' },
  { id: 'dna', family: 'bio' },
  { id: 'conics', family: 'math' },
  { id: 'giza', family: 'entry' },
  { id: 'giza/record', family: 'entry', index: false },
  { id: 'city', family: 'world' },
  { id: 'black-hole', family: 'science', index: false },
  { id: 'kept-saturn', family: 'science', recipe: { kind: 'saturn' } },
];

describe('a card\'s hall', () => {
  it('is its family\'s, an override moves it, and a world card is no exhibit', () => {
    expect(hallOf(cards[0])).toBe('science');
    expect(hallOf(cards[1])).toBe('space');
    expect(hallOf(cards[2])).toBe('life');
    expect(hallOf(cards[3])).toBe('math');
    expect(hallOf(cards[4])).toBe('history');
    expect(hallOf(cards[6])).toBe(null);
  });

  it('a kept recipe stands in the hall of the kind it keeps', () => {
    expect(exhibitId(cards[8])).toBe('space/kept-saturn');
  });

  it('every family and override names a hall', () => {
    for (const h of [...Object.values(FAMILY_HALL), ...Object.values(HALL_OVERRIDES)]) expect(HALL_IDS).toContain(h);
    expect(new Set(HALLS.map((h) => h.id)).size).toBe(HALLS.length);
  });
});

describe('an exhibit id', () => {
  it('splits off a known hall only, so a history id keeps its own slash', () => {
    expect(splitExhibitId('history/giza/record')).toEqual({ hall: 'history', id: 'giza/record' });
    expect(splitExhibitId('giza/record')).toEqual({ hall: null, id: 'giza/record' });
    expect(splitExhibitId('fission')).toEqual({ hall: null, id: 'fission' });
  });

  it('resolves by hall or bare, leaves out what is left out, and teaches a misfiled hall', () => {
    const cat = exhibitCatalog(cards, { leave: ['black-hole'] });
    expect([...cat.keys()]).not.toContain('science/black-hole');
    expect([...cat.keys()]).not.toContain('city');
    expect(resolveExhibit('science/fission', cat).id).toBe('science/fission');
    expect(resolveExhibit('fission', cat)).toMatchObject({ id: 'science/fission', hall: 'science' });
    expect(resolveExhibit('history/giza/record', cat).card.id).toBe('giza/record');
    expect(() => resolveExhibit('science/galaxy', cat)).toThrow(/space hall.*'space\/galaxy'/);
    expect(() => resolveExhibit('math/nope', cat)).toThrow(/no exhibit 'nope' in the math hall.*math\/conics/);
    expect(() => resolveExhibit('nope', cat)).toThrow(/halls: science, space/);
  });
});

describe('the shipped catalog', () => {
  it('every override names a card that exists, and every exhibit id is unique and resolves to its card', () => {
    const catalog = getViewVocabCatalog();
    // the suite runs with the bundled book off (vitest.setup.js), so a book chapter is read from its manifest
    const book = new Set(JSON.parse(readFileSync(new URL('../../../book/manifest.json', import.meta.url), 'utf8')).entries.map((e) => e.id));
    for (const id of Object.keys(HALL_OVERRIDES)) expect(catalog.has(id) || book.has(id), `override '${id}' names no card`).toBe(true);
    const cat = exhibitCatalog(catalog);
    for (const [xid, card] of cat) expect(resolveExhibit(card.id, cat).id).toBe(xid);
    // a world manual is not an exhibit
    expect([...cat.values()].some((c) => c.family === 'world')).toBe(false);
  });
});
