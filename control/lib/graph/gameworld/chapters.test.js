import { describe, it, expect } from 'vitest';
import { CHAPTERS, DEPARTMENTS, chapterById, chaptersOfPath, chapterOfPart, chapterOfStep, chapterOfCard, chapterBook, chapterSteps, chapterWaves, unitOf, levelStep } from './chapters.js';
import { gameworldCards } from './gameworld-cards.js';
import { runSteps, readMade, reviewParts, reviewState, characterState, foeParts, foeState, castable, MEADOWMARK, MEADOWMARK_HERO, CHARACTER_PART_IDS, CAST_PART, FOE_CAST_PART } from './index.js';
import { GAMEWORLD_KEYS } from './world.js';
import { CHARACTER_BOOK_KEYS, CHARACTER_HERO_KEYS } from './characters.js';
import { GAMEWORLD_CARD_IDS } from './gameworld-cards.js';
import { GENRES } from './intent.js';
import { quickWorld } from './quick.js';
import { composeGameworld } from './compose.js';
import { FOE_CLASSES } from '../foes/index.js';
import { GAMEWORLD_OUTCOMES, partOutcome } from '../rail/gameworld.js';
import { POLE_IDS } from './feel/cards.js';

// The chapter registry: every page, part, step and card of the game book belongs to exactly one chapter, each chapter
// to one of the studio's departments, and every chapter after the ones it reads. A new one that belongs to none fails
// here: a capability joins a department (CLAUDE.md).

// one world per procedure that lays its own steps and parts (not a catalog): the world before its people, the book with
// a hero, a town's folk, a bestiary on a level, party battles with minigames, a world from words, and the quick paths
// that roll their own figures (a sneak's guards, a defence's foes and towers, a farm's hands)
const first = Object.keys(MEADOWMARK_HERO.levels)[0];
const FOE = Object.values(FOE_CLASSES)[0].id;
const CORPUS = {
  ground: MEADOWMARK,
  hero: MEADOWMARK_HERO,
  folk: { ...MEADOWMARK_HERO, characters: { ...MEADOWMARK_HERO.characters, folk: true }, levels: { ...MEADOWMARK_HERO.levels, [first]: { ...MEADOWMARK_HERO.levels[first], places: { town: true, street: { houses: 6, enter: 2 } } } } },
  foes: { ...MEADOWMARK_HERO, foes: { grunt: { class: FOE } }, levels: { ...MEADOWMARK_HERO.levels, [first]: { ...MEADOWMARK_HERO.levels[first], foes: { from: ['grunt'] } } } },
  battles: { ...MEADOWMARK_HERO, battles: {}, minigames: true },
  words: composeGameworld({ prompt: 'a sunny island coast', levels: 1, seed: 3 }),
  ...Object.fromEntries(['reach', 'sneak', 'defend', 'farm'].map((goal) => [`quick-${goal}`, quickWorld({ id: 'q', quick: { goal } })])),
};
const steps = Object.fromEntries(Object.entries(CORPUS).map(([k, w]) => [k, runSteps(w, { ref: 'gw' })]));
const stampsOf = (w) => [...reviewState(w), ...(w.characters ? characterState(w) : []), ...(castable(w) ? foeState(w) : [])];

describe('the chapters', () => {
  it('each in one of the seven departments, each after the chapters it reads; the build reads every other', () => {
    expect(DEPARTMENTS.map((d) => d.id)).toEqual(['worlds', 'characters', 'play', 'foes', 'cinematics', 'production', 'interface']);
    for (const d of DEPARTMENTS) expect(CHAPTERS.some((c) => c.department === d.id), d.id).toBe(true);
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    CHAPTERS.forEach((c, i) => {
      expect(DEPARTMENTS.some((d) => d.id === c.department), c.id).toBe(true);
      for (const r of c.reads) expect(CHAPTERS.findIndex((x) => x.id === r), `${c.id} reads ${r}`).toBeGreaterThanOrEqual(0);
      for (const r of c.reads) expect(CHAPTERS.findIndex((x) => x.id === r), `${c.id} reads ${r}, written before it`).toBeLessThan(i);
      if (c.outcome) expect(GAMEWORLD_OUTCOMES.map((o) => o.id), c.id).toContain(c.outcome);
    });
    const build = chapterById('build');
    expect(build).toBe(CHAPTERS.at(-1));
    expect([...build.reads].sort()).toEqual(CHAPTERS.filter((c) => c !== build).map((c) => c.id).sort());
  });

  it('every key of the recipe has its chapter; the character book\'s and the hero\'s keys exactly one each', () => {
    for (const k of GAMEWORLD_KEYS) expect(chaptersOfPath(`/${k}`).length, k).toBeGreaterThan(0);
    for (const k of CHARACTER_BOOK_KEYS) if (k !== 'hero') expect(chaptersOfPath(`/characters/${k}`).map((c) => c.id), k).toHaveLength(1);
    for (const k of CHARACTER_HERO_KEYS) expect(chaptersOfPath(`/characters/hero/${k}`), k).toHaveLength(1);
    // the deepest path owns: the hero's motion is the motion's, a level's goal the levels', a hero's looks the hero's
    expect(chaptersOfPath('/characters/hero/motion/jog')[0].id).toBe('motion');
    expect(chaptersOfPath('/levels/one/goal')[0].id).toBe('levels');
    expect(chaptersOfPath('/characters/hero/looks/hair')[0].id).toBe('hero');
    // a write above every path touches every chapter under it
    expect(chaptersOfPath('/characters').map((c) => c.id)).toEqual(['direction', 'hero', 'motion', 'actions', 'adornment', 'cast']);
    expect(chaptersOfPath('')).toHaveLength(CHAPTERS.length);
  });

  it('every review part has exactly one chapter, and its rail outcome is its chapter\'s', () => {
    const ids = new Set([...CHARACTER_PART_IDS, CAST_PART, FOE_CAST_PART]);
    for (const w of Object.values(CORPUS)) {
      for (const p of reviewParts(w)) ids.add(p.id);
      if (castable(w)) for (const p of foeParts(w)) ids.add(p.id);
    }
    expect(ids.has('foes:grunt')).toBe(true);
    for (const id of ids) {
      expect(CHAPTERS.filter((c) => c.parts.some((p) => (p.endsWith(':*') ? id.startsWith(p.slice(0, -1)) : p === id))).map((c) => c.id), id).toHaveLength(1);
      expect(partOutcome(id), id).toBe(chapterOfPart(id).outcome);
    }
  });

  it('every step a run makes has exactly one chapter, and the record reads its key', () => {
    const keys = new Set(Object.values(steps).flat().map((s) => s.key));
    // the procedures above lay these families (a town's folk among them: their record was once refused)
    for (const k of ['hero', 'hero-equipped', 'systems', 'game', 'keeper', 'guard', 'tower', 'farmhand']) expect(keys.has(k), k).toBe(true);
    for (const pre of ['level-', 'audit-level-', 'gear-', 'foes-', 'folk-']) expect([...keys].some((k) => k.startsWith(pre)), pre).toBe(true);
    for (const k of keys) {
      expect(chapterOfStep(k), k).not.toBeNull();
      expect(() => readMade({ [k]: { ref: 'r', order: '0123abcd', stored: '0123abcd', ...(k.startsWith('audit-') ? { verdict: { completable: null, note: '' } } : {}) } }), k).not.toThrow();
    }
    // a figure's pool is its figure's
    expect(chapterOfStep('guard-2')).toBe(chapterOfStep('guard'));
    expect(chapterOfStep('audit-level-a-0').id).toBe('build');
    expect(chapterOfStep('level-a-0').id).toBe('levels');
  });

  it('every card of the book is one chapter\'s manual', () => {
    for (const id of [...GAMEWORLD_CARD_IDS, `gameworld-intent-${Object.keys(GENRES)[0]}`]) expect(chapterOfCard(id), id).not.toBeNull();
  });
});

describe('the chapter book', () => {
  it('a gated book unreviewed: its chapters open, each saying what upstream it waits on', () => {
    const book = chapterBook(MEADOWMARK_HERO, { stamps: stampsOf(MEADOWMARK_HERO) });
    const at = Object.fromEntries(book.map((c) => [c.id, c]));
    expect(book.map((c) => c.id)).toEqual(CHAPTERS.map((c) => c.id).filter((id) => at[id]));
    expect(at.hero).toMatchObject({ department: 'characters', state: 'open' });
    expect(at.adornment.waits).toEqual(expect.arrayContaining(['hero', 'actions']));
    // none settled: how many it has, not each by name (they are all of them)
    expect(at.hero.parts).toMatch(/^0\/\d+$/);
    expect(at.hero.open).toBeUndefined();
    // some settled: the rest named, and the chapters downstream of an open one still wait on it
    const review = { 'hero:body': { status: 'approved', print: 'x' } };
    const some = chapterBook(MEADOWMARK_HERO, { stamps: stampsOf(MEADOWMARK_HERO).map((s) => (review[s.id] ? { ...s, status: 'approved' } : s)) });
    const hero = some.find((c) => c.id === 'hero');
    expect(hero.parts).toMatch(/^1\/\d+$/);
    expect(hero.open).toEqual(expect.arrayContaining(['hero:base']));
    expect(hero.open).not.toContain('hero:body');
    expect(some.find((c) => c.id === 'motion').waits).toContain('hero');
  });

  it('an autonomous book is settled by its machine gate; a page with no review of its own is written; an unwritten one is left out', () => {
    const W = { ...MEADOWMARK_HERO, mode: 'autonomous', review: undefined, feel: POLE_IDS[0] };
    const book = chapterBook(W, { stamps: stampsOf(W) });
    const at = Object.fromEntries(book.map((c) => [c.id, c]));
    for (const c of book.filter((x) => x.parts)) expect(c.state, c.id).not.toBe('open');
    expect(at.feel).toEqual({ id: 'feel', department: 'play', state: 'written' });
    expect(at.story).toBeUndefined();
    expect(at.hero.waits).toBeUndefined();
  });

  it('pure: the same world, the same book', () => {
    const s = stampsOf(MEADOWMARK_HERO);
    expect(chapterBook(MEADOWMARK_HERO, { stamps: s })).toEqual(chapterBook(structuredClone(MEADOWMARK_HERO), { stamps: structuredClone(s) }));
  });
});

describe('a chapter\'s run', () => {
  const S = steps.hero;   // the gated book, nothing reviewed: every step after the hero waits
  const keys = (xs) => xs.map((x) => x.key);

  it('is its own steps and every step their orders name, made ahead of the approvals they wait on', () => {
    // the hero's page: the hero alone (it waits on nothing)
    expect(keys(chapterSteps(S, 'hero'))).toEqual(['hero']);
    for (const id of ['levels', 'systems', 'equipment']) {
      const X = chapterSteps(S, id);
      // its own steps, all of them
      expect(keys(X.filter((x) => chapterOfStep(x.key).id === id)), id).toEqual(keys(S.filter((x) => chapterOfStep(x.key).id === id)));
      // and every step whose ref one of its orders names (a level's pilot, the systems' hero), none other
      const named = (x) => X.some((y) => y.key !== x.key && JSON.stringify(y.order).includes(JSON.stringify(x.ref)));
      for (const x of X.filter((y) => chapterOfStep(y.key).id !== id)) expect(named(x), `${id}: ${x.key}`).toBe(true);
      for (const x of S.filter((y) => !X.some((z) => z.key === y.key) && chapterOfStep(y.key).id !== 'build')) expect(named(x), `${id} leaves ${x.key}`).toBe(false);
      // never the build's (the game, its walks), every step ready, a waiting one saying what it did not wait for
      expect(X.some((x) => chapterOfStep(x.key).id === 'build'), id).toBe(false);
      for (const x of X) {
        expect(x.ready, x.key).toBe(true);
        expect(x.waiting, x.key).toBeUndefined();
        const was = S.find((y) => y.key === x.key);
        if (!was.ready) expect(x.ahead, x.key).toEqual(was.waiting.map((w) => `${w.id} (${w.status})`));
        // its own order and print: the build keeps it when its approvals come and the book has not moved
        expect(x.print, x.key).toBe(was.print);
      }
    }
    // the levels are piloted by the equipped hero: it is made with them
    expect(keys(chapterSteps(S, 'levels'))).toContain('hero-equipped');
  });

  it('one level is a unit: its own stages and what their orders name, never a sibling level\'s', () => {
    const levelKeys = keys(S.filter((x) => x.key.startsWith('level-')));
    const ids = Object.keys(MEADOWMARK_HERO.levels);
    const seen = [];
    for (const lv of ids) {
      const X = chapterSteps(S, `level:${lv}`);
      const own = keys(X.filter((x) => levelStep(lv).test(x.key)));
      expect(own.length, lv).toBeGreaterThan(0);
      expect(own, lv).toEqual(keys(S.filter((x) => levelStep(lv).test(x.key))));
      seen.push(...own);
      // nothing of another level's, every step ready, and the rest named by its orders (the level's pilot)
      for (const other of ids.filter((o) => o !== lv)) expect(X.some((x) => levelStep(other).test(x.key)), `${lv} takes ${other}`).toBe(false);
      for (const x of X) expect(x.ready, x.key).toBe(true);
      expect(keys(X)).toContain('hero-equipped');
    }
    // the levels' units cover the chapter's stages, once each
    expect(seen.sort()).toEqual(levelKeys.sort());
  });

  it('a unit is a chapter by its id or one level as level:<id>', () => {
    expect(unitOf('hero')).toMatchObject({ id: 'hero', level: null, chapter: chapterById('hero') });
    expect(unitOf('level:crypt-2')).toMatchObject({ id: 'level:crypt-2', level: 'crypt-2', chapter: chapterById('levels') });
    for (const no of ['level:', 'lighting', '', null, 3]) expect(unitOf(no), String(no)).toBeNull();
    // a level's id is matched whole: crypt is not crypt-2, a dot is a dot
    expect(levelStep('crypt').test('level-crypt-0')).toBe(true);
    expect(levelStep('crypt').test('level-crypt-2-0')).toBe(false);
    expect(levelStep('crypt').test('level-crypt-skirmish')).toBe(true);
    expect(levelStep('a.b').test('level-axb-0')).toBe(false);
  });

  it('the build\'s run is the whole run; a chapter the book does not have is refused', () => {
    expect(chapterSteps(S, 'build')).toBe(S);
    expect(() => chapterSteps(S, 'lighting')).toThrow(/chapter is one of/);
    // a chapter with no steps in this book runs nothing
    expect(chapterSteps(S, 'story')).toEqual([]);
  });
});

describe('the studio\'s waves', () => {
  it('every chapter in one wave, each after every chapter it reads; the first reads none, the build is alone and last', () => {
    const W = chapterWaves(), at = new Map(W.flatMap((ids, i) => ids.map((id) => [id, i])));
    expect([...at.keys()].sort()).toEqual(CHAPTERS.map((c) => c.id).sort());
    expect(W.flat()).toHaveLength(CHAPTERS.length);
    for (const c of CHAPTERS) for (const r of c.reads) expect(at.get(r), `${c.id} reads ${r}`).toBeLessThan(at.get(c.id));
    // as early as it can be: a chapter's wave is one past the latest it reads
    for (const c of CHAPTERS) expect(at.get(c.id), c.id).toBe(c.reads.length ? 1 + Math.max(...c.reads.map((r) => at.get(r))) : 0);
    expect(W[0].every((id) => chapterById(id).reads.length === 0)).toBe(true);
    expect(W.at(-1)).toEqual(['build']);
  });

  it('the studio card is the registry\'s: each wave a line, each chapter with its department, in the waves\' order', () => {
    const body = gameworldCards().get('gameworld-studio').body;
    const lines = body.split('\n').filter((l) => /^ +\d+  /.test(l));
    expect(lines).toHaveLength(chapterWaves().length);
    chapterWaves().forEach((ids, i) => expect(lines[i], `wave ${i + 1}`).toBe(`  ${String(i + 1).padStart(2)}  ${ids.map((id) => `${id} (${chapterById(id).department})`).join(' · ')}`));
    // it says the doors a chapter's session uses, and that the eyes gate is the creator's
    for (const word of ['{ ref, chapter }', 'run: true', 'check: true', 'pending', 'ahead', 'never say it passed']) expect(body, word).toContain(word);
    expect(Buffer.byteLength(body)).toBeLessThan(4096);
  });
});
