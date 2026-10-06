import { describe, it, expect } from 'vitest';
import { ROSTERS, animalEntryCards, animalNameIndex, resolveAnimalName, normalizeName, ENTRY_BODY_CEILING, HUB_BODY_CEILING, INDEX_BODY_CEILING } from './entries.js';
import { getSolidVocabCatalog } from '../solid-vocab/loader.js';

// The roster contract: what a species (or an asked-for animal) must carry so its entry card is honest and findable.
// A new species is not done until its family's `about` has its row; building a `wanted` animal moves its row.
describe('animal entries: the roster contract', () => {
  for (const R of ROSTERS) {
    it(`${R.id}: every species has an about row with a common name, a size and a source`, () => {
      const missing = Object.keys(R.species).filter((id) => !R.about[id]);
      expect(missing, 'species with no `about` row').toEqual([]);
      for (const [id, a] of Object.entries(R.about)) {
        expect(R.species[id], `about row '${id}' names no species`).toBeDefined();
        for (const f of ['common', 'sci', 'size', 'source']) expect(typeof a[f] === 'string' && a[f].length > 0, `${id}.${f}`).toBe(true);
        expect(Array.isArray(a.aliases), `${id}.aliases`).toBe(true);
        for (const w of [a.common, ...a.aliases]) expect(w, `${id}: '${w}' is not lower case`).toBe(w.toLowerCase());
      }
    });

    it(`${R.id}: every wanted row names a built species to stand in, and is not built itself`, () => {
      for (const [id, w] of Object.entries(R.wanted || {})) {
        expect(R.species[w.near], `wanted '${id}': near '${w.near}' is not a species`).toBeDefined();
        expect(R.species[id], `wanted '${id}' is built: move its row to species + about`).toBeUndefined();
        expect(typeof w.note === 'string' && w.note.length > 0, `wanted '${id}'.note`).toBe(true);
        for (const a of w.aliases || []) expect(a).toBe(a.toLowerCase());
      }
    });
  }

  it('one word, one animal: no name is claimed twice across every roster', () => {
    expect(() => animalNameIndex()).not.toThrow();
  });
});

describe('animal entries: the cards', () => {
  const cards = animalEntryCards();
  const byId = new Map(cards.map((c) => [c.id, c]));

  it('one entry per species, one hub per family, one index; each inside its byte ceiling', () => {
    for (const R of ROSTERS) for (const id of Object.keys(R.species)) {
      const c = byId.get(`animal/${id}`); expect(c, id).toBeDefined();
      expect(c.body.length, `animal/${id}`).toBeLessThanOrEqual(ENTRY_BODY_CEILING);
      expect(c.body).toContain(`"species":"${id}"`);   // the starter mints exactly this species
      const hub = byId.get(`animal/${R.familyOf(id)}`); expect(hub, R.familyOf(id)).toBeDefined();
      expect(hub.body.length).toBeLessThanOrEqual(HUB_BODY_CEILING);
    }
    expect(byId.get('animals').body.length).toBeLessThanOrEqual(INDEX_BODY_CEILING);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it('cards are generated, deterministic and carry the solid-vocab fields', () => {
    expect(JSON.stringify(animalEntryCards())).toBe(JSON.stringify(cards));
    for (const c of cards) {
      expect(c.generated).toBe(true);
      expect(c.family).toBe('creature');
      expect(c.entry).toBe('mint_solid');
      for (const f of ['id', 'name', 'summary', 'when', 'body']) expect(typeof c[f] === 'string' && c[f].length > 0, `${c.id}.${f}`).toBe(true);
    }
  });

  it('a wanted animal is findable through its family hub, with its stand-in named', () => {
    const hub = byId.get('animal/ursine');
    expect(hub.when).toContain('"koala"');
    expect(hub.body).toMatch(/koala.*nearest wombat/);
  });

  it('the catalog carries them; the bare listing shows only the index', () => {
    const cat = getSolidVocabCatalog();
    expect(cat.get('animal/houseCat')).toBeDefined();
    expect(cat.get('animals')).toBeDefined();
    expect(cat.get('animal')).toBeDefined();   // the hand-written kind manual is untouched
  });
});

describe('animal entries: names', () => {
  it('resolves the names people say', () => {
    for (const [w, id] of [['cat', 'houseCat'], ['Kitty', 'houseCat'], ['cats', 'houseCat'], ['a penguin', 'emperorPenguin'], ['house-cat', 'houseCat'],
      ['grizzly', 'brownBear'], ['buffalo', 'bison'], ['cow', 'dairyCow'], ['shark', 'greatWhiteShark'], ['wolves', 'wolf'], ['foxes', 'fox']]) {
      expect(resolveAnimalName(w)?.id ?? null, w).toBe(id);
    }
  });

  it('an asked-for animal not built yet resolves to its stand-in; an unknown word to nothing', () => {
    expect(resolveAnimalName('koala')).toMatchObject({ wanted: 'koala', near: 'wombat' });
    expect(resolveAnimalName('monkey')).toMatchObject({ wanted: 'capuchin', near: 'chimpanzee' });
    expect(resolveAnimalName('unicorn')).toBeNull();
    expect(normalizeName('  The Great_White ')).toBe('great white');
  });
});
