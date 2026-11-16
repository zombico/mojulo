// The rails: a row a game type, naming into the tables that measure it. The guard: every table a handle names is held
// to the roster (a pole, a quick goal and a pixelizer game each belong to a row), and what a row says of itself (its
// sizes, how it is seen) is what the tables say, so the producer's shape cannot drift from what is built.
import { describe, it, expect } from 'vitest';
import {
  RAILS, RAIL_IDS, SIZES, SIZE_IDS, NOT_YET, GENERIC_GOALS, SEEN_WORDS,
  railOf, railOfPole, railOfGenre, railsOfGoal, seenOf, railWords, railLacks, railShape,
} from './rails.js';
import { POLES } from './feel/cards.js';
import { GENRES, genreCube } from './intent.js';
import { QUICK_GOALS } from './quick.js';
import { PENDING, HAND_OFFS } from './genre-forms.js';
import { PIXELIZER_REDUCER_IDS } from '../pixelizer/pixelizer-games.js';
import { dryRun } from '../cosmos/cosmos.js';

const FROZEN = 'a new game type is a row first (gameworld/rails.js)';
// a genre the book lays as a designed game today: its cube makeable, and not waiting on its form or handed to another door
const laid = (g) => !!GENRES[g] && !PENDING[g] && !HAND_OFFS[g] && dryRun(genreCube(g)).verdict === 'makeable';
const claims = (key) => RAIL_IDS.flatMap((id) => [RAILS[id].handles[key] ?? []].flat().map((h) => [h, id]));

describe('the rail roster names into the tables that measure', () => {
  it('every handle is a key of its table', () => {
    for (const id of RAIL_IDS) {
      const H = RAILS[id].handles;
      if (H.pole) expect(POLES[H.pole], `${id}: pole ${H.pole}`).toBeTruthy();
      for (const g of H.genres) expect(GENRES[g], `${id}: genre ${g}`).toBeTruthy();
      for (const q of H.quick ?? []) expect(QUICK_GOALS[q], `${id}: quick goal ${q}`).toBeTruthy();
      for (const p of H.pixel ?? []) expect(PIXELIZER_REDUCER_IDS, `${id}: pixelizer game ${p}`).toContain(p);
      if (H.table) expect(['tabletop', 'table-rpg']).toContain(H.table);
      for (const k of Object.keys(H)) expect(['pole', 'genres', 'quick', 'pixel', 'table'], `${id}: handle ${k}`).toContain(k);
    }
  });

  it('holds every feel template, quick goal and pixelizer game to a row', () => {
    const poles = claims('pole').map(([h]) => h), goals = new Set(claims('quick').map(([h]) => h)), pixels = claims('pixel').map(([h]) => h);
    expect(Object.keys(POLES).filter((p) => !poles.includes(p)), FROZEN).toEqual([]);
    expect(Object.keys(QUICK_GOALS).filter((q) => !goals.has(q) && !GENERIC_GOALS.includes(q)), FROZEN).toEqual([]);
    expect(GENERIC_GOALS.filter((q) => !QUICK_GOALS[q] || goals.has(q))).toEqual([]);
    expect(PIXELIZER_REDUCER_IDS.filter((p) => !pixels.includes(p)), FROZEN).toEqual([]);
  });

  it('claims a pole, a genre and a pixelizer game once each', () => {
    for (const key of ['pole', 'genres', 'pixel']) {
      const seen = claims(key).map(([h]) => h);
      expect(seen.filter((h, i) => seen.indexOf(h) !== i), `${key} claimed twice`).toEqual([]);
    }
    for (const [g, id] of claims('genres')) expect(railOfGenre(g).id).toBe(id);
    for (const [p, id] of claims('pole')) expect(railOfPole(p).id).toBe(id);
  });

  it('says of its sizes what the tables say, least first', () => {
    for (const id of RAIL_IDS) {
      const R = RAILS[id], H = R.handles;
      expect(R.sizes.length, id).toBeGreaterThan(0);
      expect([...R.sizes].sort((a, b) => SIZE_IDS.indexOf(a) - SIZE_IDS.indexOf(b)), `${id}: least first`).toEqual([...R.sizes]);
      expect(R.sizes.includes('pixel'), `${id}: pixel`).toBe(!!H.pixel?.length);
      expect(R.sizes.includes('quick'), `${id}: quick`).toBe(!!H.quick?.length);
      expect(R.sizes.includes('table'), `${id}: table`).toBe(!!H.table);
      // designed: a genre of its the book lays; or a feel alone (no cube of its own), which its `lacks` says
      const byGenre = H.genres.some(laid), byFeel = !!H.pole && !H.genres.length;
      expect(R.sizes.includes('designed'), `${id}: designed`).toBe(byGenre || byFeel);
      if (byFeel) expect((R.lacks ?? []).join(' '), `${id}: says it has no cube`).toMatch(/no genre cube of its own/);
    }
  });

  it('lists only what reaches a first level today, and says the rest is not yet', () => {
    for (const id of RAIL_IDS) expect(RAILS[id].level1, id).toMatch(/\S/);
    for (const [id, N] of Object.entries(NOT_YET)) {
      expect(RAILS[id], `${id} is not yet: never also a rail`).toBeUndefined();
      expect(N.waits, id).toMatch(/\S/);
      // (the day one of its genres is laid by the book, it is a rail: this fails, and the row moves)
      for (const g of N.genres) { expect(GENRES[g], `${id}: genre ${g}`).toBeTruthy(); expect(laid(g), `${id}: ${g} is laid now: make it a rail`).toBe(false); expect(railOfGenre(g), `${id}: ${g}`).toBeNull(); }
    }
  });
});

describe('what a rail says', () => {
  // one rail a way of being seen, picked from the roster, not by hand
  const bySeen = Object.fromEntries(RAIL_IDS.map((id) => [seenOf(id), id]).filter(([s]) => s));

  it('is seen as its pole\'s camera says, else its first genre\'s', () => {
    expect(Object.keys(bySeen).sort()).toEqual(Object.keys(SEEN_WORDS).filter((s) => bySeen[s]).sort());
    expect(Object.keys(bySeen)).toEqual(expect.arrayContaining(['side', 'free', 'above']));
    for (const id of RAIL_IDS) if (RAILS[id].handles.pole || RAILS[id].handles.genres.length) expect(seenOf(id), `${id}: a camera with no word`).not.toBeNull();
    expect(seenOf(RAIL_IDS.find((id) => !RAILS[id].handles.pole && !RAILS[id].handles.genres.length))).toBeNull();
  });

  it('gathers its words from its own, its pole\'s and its genres\'', () => {
    const withAll = RAIL_IDS.find((id) => RAILS[id].words && RAILS[id].handles.genres.some((g) => GENRES[g].words.length));
    const W = railWords(withAll);
    expect(W).toEqual(expect.arrayContaining([...RAILS[withAll].words, ...GENRES[RAILS[withAll].handles.genres[0]].words]));
    expect(new Set(W).size).toBe(W.length);
    // every rail can be found by a word
    for (const id of RAIL_IDS) expect(railWords(id).length, `${id}: no word reaches it`).toBeGreaterThan(0);
  });

  it('says what it lacks: its own, then its template\'s needs', () => {
    const id = RAIL_IDS.find((k) => RAILS[k].lacks && RAILS[k].handles.pole && POLES[RAILS[k].handles.pole].needs.length);
    expect(railLacks(id)).toEqual([...RAILS[id].lacks, ...POLES[RAILS[id].handles.pole].needs]);
  });

  it('gives the producer one line a rail: a template, its sizes, how it is seen, its first level', () => {
    const id = bySeen.side, R = RAILS[id], line = railShape(id);
    expect(line).toContain(R.name); expect(line).toContain(R.like); expect(line).toContain(SEEN_WORDS.side); expect(line).toContain(R.level1);
    for (const s of R.sizes) expect(line).toContain(SIZES[s].name);
    expect(line).not.toMatch(/\n/);
  });

  it('is read by its id, by a goal, or refused naming the rails', () => {
    const goal = Object.keys(QUICK_GOALS).find((q) => railsOfGoal(q).length);
    expect(railsOfGoal(goal).every((r) => r.handles.quick.includes(goal))).toBe(true);
    expect(railsOfGoal(GENERIC_GOALS[0])).toEqual([]);
    expect(railOf(RAIL_IDS[0]).id).toBe(RAIL_IDS[0]);
    expect(() => railOf('no-such-rail')).toThrow(/is not one: /);
    expect(railOfGenre('no-such-genre')).toBeNull();
  });
});
