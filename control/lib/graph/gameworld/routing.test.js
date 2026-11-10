import { describe, it, expect } from 'vitest';
import { needsAsk, askAdvice, unaskedStamp, runAdvice, refusalCards, withCards, ASK_SAYS } from './routing.js';
import { CHAPTERS, LEVEL_PAGE_CARDS } from './chapters.js';
import { readMade } from './made.js';

// The routing (routing.js): what the door says so a game of several departments starts from an intent, its pages are
// written from their cards and its run is read whole. Advice, a next move and a stamp: never a refusal.

const LEVELS = { yard: { walk: { nodes: { a: { trail: true } } } } };

describe('a book that stands on an intent', () => {
  it('is one with a hero, a main quest or a bestiary a hand wrote', () => {
    expect(needsAsk({ id: 'w', levels: LEVELS })).toBe(false);
    expect(needsAsk({ id: 'w', levels: LEVELS, characters: { direction: { tradition: 'anime' } } })).toBe(false);
    expect(needsAsk({ id: 'w', levels: LEVELS, characters: { hero: {} } })).toBe(true);
    expect(needsAsk({ id: 'w', levels: LEVELS, mainQuest: { acts: [] } })).toBe(true);
    expect(needsAsk({ id: 'w', levels: LEVELS, foes: { grunt: { class: 'walker' } } })).toBe(true);
    expect(needsAsk({ id: 'w', levels: LEVELS, foes: {} })).toBe(false);
  });

  it('is never a quick game, and a composed world only once a hand gives it a hero or a quest', () => {
    expect(needsAsk({ id: 'w', levels: LEVELS, quick: { goal: 'reach' }, characters: { hero: {} } })).toBe(false);
    const composed = { id: 'w', levels: LEVELS, brief: { prompt: 'a castle at night', read: [], unread: [] }, foes: { grunt: { class: 'walker' } } };
    expect(needsAsk(composed)).toBe(false);
    expect(needsAsk({ ...composed, characters: { hero: {} } })).toBe(true);
  });

  it('is advised while the ledger holds no ask, the ask leading the next moves', () => {
    const W = { id: 'w', levels: LEVELS, characters: { hero: {} } };
    expect(askAdvice(W, { asked: false })).toEqual({ says: ASK_SAYS, next: { step: 'ask', card: 'gameworld-ledger' } });
    expect(askAdvice(W, { asked: true })).toBeNull();
    expect(askAdvice({ id: 'w', levels: LEVELS }, { asked: false })).toBeNull();
  });
});

describe('the unasked stamp', () => {
  const made = { hero: { ref: 'h' }, game: { ref: 'g', order: 'p1' } };

  it('marks a game built with no ask on record, in the build ledger alone', () => {
    const out = unaskedStamp(made, { asked: false, built: true });
    expect(out.game).toEqual({ ref: 'g', order: 'p1', unasked: true });
    expect(out.hero).toBe(made.hero);
    expect(made.game.unasked).toBeUndefined();
  });

  it('is lifted once an ask stands, and moves nothing otherwise', () => {
    const stamped = unaskedStamp(made, { asked: false, built: true });
    expect(unaskedStamp(stamped, { asked: true, built: false }).game).toEqual(made.game);
    expect(unaskedStamp(stamped, { asked: false, built: true })).toBe(stamped);
    expect(unaskedStamp(made, { asked: true, built: true })).toBe(made);
    expect(unaskedStamp(made, { asked: false, built: false })).toBe(made);
    expect(unaskedStamp({ hero: { ref: 'h' } }, { asked: false, built: true })).toEqual({ hero: { ref: 'h' } });
    expect(unaskedStamp(undefined, { asked: false, built: true })).toBeUndefined();
    // a book that stands on no intent (a composed world, a quick game) is never stamped
    expect(unaskedStamp(made, { asked: false, built: true, needs: false })).toBe(made);
  });
});

describe('the build ledger', () => {
  const rec = { ref: 'g', order: '0123abcd', stored: '89abcdef' };

  it("keeps the stamp on the game's record alone, and only as true", () => {
    expect(() => readMade({ game: { ...rec, unasked: true } })).not.toThrow();
    expect(() => readMade({ game: rec })).not.toThrow();
    expect(() => readMade({ hero: { ...rec, unasked: true } })).toThrow(/hero\.unasked is not part of the record/);
    expect(() => readMade({ game: { ...rec, unasked: false } })).toThrow(/game\.unasked is true, or left out/);
  });
});

describe("a run's advice, read whole", () => {
  it('is each distinct line its steps gave, with how many gave it', () => {
    const ran = [
      { key: 'level-a-0', action: 'make', advises: ['hour: not on a geocube'] },
      { key: 'level-a-1', action: 'make', advises: ['hour: not on a geocube', 'cover: none laid'] },
      { key: 'game', action: 'make' },
    ];
    expect(runAdvice(ran)).toEqual([{ says: 'hour: not on a geocube', steps: 2 }, { says: 'cover: none laid', steps: 1 }]);
    expect(runAdvice([{ key: 'game', action: 'keep' }])).toEqual([]);
    expect(runAdvice(undefined)).toEqual([]);
  });
});

describe('a refusal names its card', () => {
  it('by the chapter its path belongs to', () => {
    expect(refusalCards('characters: hero.actions.idiom is a convention read as "x-like"')).toEqual(['gameworld-actions']);
    expect(refusalCards("characters: hero.adornment.items[0].build.item is dagger, sword")).toEqual(['gameworld-adornment']);
    expect(refusalCards('gameworld: foes.warlord: .skin has no key')).toEqual(['gameworld-foes']);
    expect(refusalCards('gameworld: mainQuest.acts is a list')).toEqual(['gameworld-main-quest']);
  });

  it('by the one card named for the page, where a chapter has several', () => {
    expect(refusalCards('gameworld: intent.from is a genre: dungeon-crawler')).toEqual(['gameworld-intent']);
  });

  it("by a level's own page cards, for a path inside a level", () => {
    expect(refusalCards('gameworld: levels.keep.foes.from names no foe')).toEqual([...LEVEL_PAGE_CARDS]);
  });

  it('holds for every chapter that owns a path and a card: a refusal at its path ends with one of its cards', () => {
    // (one refusal per chapter, from the registry: the procedure is the lookup, not the list)
    const scoped = (p) => (p.startsWith('/characters/') ? `characters: ${p.slice('/characters/'.length).replace(/\//g, '.')}` : `gameworld: ${p.slice(1).replace(/\//g, '.')}`);
    for (const c of CHAPTERS) {
      const path = c.paths.find((p) => !p.includes('*') && p !== '/characters' && !p.startsWith('/levels'));
      const cards = c.cards.filter((x) => !x.includes('*'));
      if (!path || !cards.length) continue;
      const got = refusalCards(`${scoped(path)} is refused`);
      expect(got.length, c.id).toBeGreaterThan(0);
      for (const g of got) expect(cards, c.id).toContain(g);
    }
  });

  it('ends the message with it, and leaves alone a message that names a manual or no path', () => {
    expect(withCards('characters: hero.actions.idiom is a convention')).toBe("characters: hero.actions.idiom is a convention — read first: get_game_vocab({ id: 'gameworld-actions' })");
    const door = 'the hero is refused by the hero door: get_solid_vocab({ id: \'layered\' })';
    expect(withCards(door)).toBe(door);
    expect(withCards("characters: 'foes' is not part of the character book")).toBe("characters: 'foes' is not part of the character book");
    expect(withCards('something else')).toBe('something else');
  });
});
