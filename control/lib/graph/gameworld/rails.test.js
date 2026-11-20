// The rails: a row a game type, naming into the tables that measure it. The guard: every table a handle names is held
// to the roster (a pole, a quick goal and a pixelizer game each belong to a row), and what a row says of itself (its
// sizes, how it is seen) is what the tables say, so the producer's shape cannot drift from what is built.
import { describe, it, expect } from 'vitest';
import {
  RAILS, RAIL_IDS, SIZES, SIZE_IDS, NOT_YET, GENERIC_GOALS, SEEN_WORDS,
  railOf, railOfPole, railOfGenre, railsOfGoal, seenOf, railWords, railLacks, railShape, OWN, sizeCall,
  railShapes, railSheet, nearestRails, notYetFor, laidGenre, TUNINGS, readRail, railReport, railMoves, variantOf,
} from './rails.js';
import { POLES } from './feel/cards.js';
import { GENRES, genreCube } from './intent.js';
import { QUICK_GOALS } from './quick.js';
import { PENDING, HAND_OFFS } from './genre-forms.js';
import { PIXELIZER_REDUCER_IDS } from '../pixelizer/pixelizer-games.js';
import { LABOURS } from './gmn.js';
import { dryRun } from '../cosmos/cosmos.js';
import { railCardById } from './gameworld-cards.js';
import { goalposts, startReadout, producerSteps, producerSays, leadNext, GOALPOSTS } from './goalposts.js';
import { pitchStart } from './pitch-start.js';
import { readGameworld } from './world.js';
import { chaptersOfPath } from './chapters.js';
import { MOTIVATIONS } from './gmn.js';
import { MEADOWMARK } from './examples.js';

const FROZEN = 'a new game type is a row first (gameworld/rails.js)';
const laid = laidGenre;
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
  // one rail a way of being seen first, picked from the roster, not by hand
  const bySeen = Object.fromEntries(RAIL_IDS.map((id) => [seenOf(id)[0], id]).filter(([s]) => s));

  it('is seen as its template\'s camera says first, then as its cubes\' say: more than one is a choice', () => {
    expect(Object.keys(bySeen)).toEqual(expect.arrayContaining(['side', 'free', 'above']));
    for (const id of RAIL_IDS) {
      const H = RAILS[id].handles, seen = seenOf(id);
      for (const w of seen) expect(SEEN_WORDS[w], `${id}: ${w}`).toBeTruthy();
      expect(new Set(seen).size).toBe(seen.length);
      if (H.pole || H.genres.length) expect(seen.length, `${id}: a camera with no word`).toBeGreaterThan(0);
      else expect(seen).toEqual([]);
    }
    // a template and its own cube never disagree unsaid: both ways are there, the template's first
    const two = RAIL_IDS.find((id) => seenOf(id).length > 1 && RAILS[id].handles.pole);
    expect(railShape(two)).toContain(`${SEEN_WORDS[seenOf(two)[0]]}, or ${SEEN_WORDS[seenOf(two)[1]]}`);
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

describe('the size call', () => {
  // one rail a concept, picked from the roster: least size each, one that grows, one the book does not reach
  const least = (size) => RAIL_IDS.find((id) => RAILS[id].sizes[0] === size);
  const grows = RAIL_IDS.find((id) => RAILS[id].sizes[0] === 'quick' && RAILS[id].sizes.includes('designed'));
  const stops = RAIL_IDS.find((id) => !RAILS[id].sizes.includes('designed') && PENDING[RAILS[id].handles.genres[0]]);
  const own = Object.keys(OWN)[0];

  it('calls the least a rail is made with when nothing more is asked, with that door\'s keys', () => {
    for (const size of SIZE_IDS) {
      const id = least(size);
      if (!id) continue;
      const C = sizeCall(id);
      expect(C).toMatchObject({ rail: id, size, door: SIZES[size].door, brief: size === 'designed' });
      expect(Object.values(C.with).flat().length, `${id}: the door's keys`).toBeGreaterThan(0);
    }
    expect(SIZE_IDS.filter(least).length).toBeGreaterThan(2);
    expect(sizeCall(least('quick')).with.goal).toEqual(RAILS[least('quick')].handles.quick);
  });

  it('grows to the designed game when more levels or something of their own is asked, and asks the brief', () => {
    expect(sizeCall(grows, { simple: true })).toMatchObject({ size: 'quick', brief: false, next: { size: 'designed' } });
    for (const wants of [{ levels: 3 }, { levels: 'many' }, { own: [own] }]) {
      const C = sizeCall(grows, wants);
      expect(C).toMatchObject({ size: 'designed', brief: true });
      expect(C.next).toBeUndefined(); expect(C.short).toBeUndefined();
      expect(C.with.from).toEqual(RAILS[grows].handles.genres);
    }
    expect(sizeCall(grows, { own: [own] }).why).toContain(OWN[own]);
  });

  it('never refuses: an ask past what a rail reaches is called at its largest, and what it waits on is said', () => {
    const C = sizeCall(stops, { levels: 'many' }), top = RAILS[stops].sizes[RAILS[stops].sizes.length - 1];
    expect(C).toMatchObject({ size: top, brief: false, short: { wanted: 'designed' } });
    expect(C.short.waits).toMatch(/\S/); expect(C.why).toContain('does not reach yet');
  });

  it('with no rail, calls it by the wants alone', () => {
    expect(sizeCall(null)).toMatchObject({ rail: null, size: 'quick', next: { size: 'designed' }, brief: false });
    expect(sizeCall(null, { own: [own] })).toMatchObject({ rail: null, size: 'designed', brief: true });
  });

  it('teaches its wants', () => {
    expect(() => sizeCall(grows, { levels: 0 })).toThrow(/levels is how many/);
    expect(() => sizeCall(grows, { own: ['a-thing'] })).toThrow(/own is what is theirs/);
    expect(() => sizeCall(grows, { big: true })).toThrow(/big is not one/);
    expect(() => sizeCall('no-such-rail')).toThrow(/is not one: /);
  });
});

describe('the two depths: the shape, then the sheet', () => {
  const designed = RAIL_IDS.find((id) => RAILS[id].handles.pole && RAILS[id].handles.genres.some(laid) && RAILS[id].handles.quick?.length);
  const bare = RAIL_IDS.find((id) => !RAILS[id].handles.pole && !RAILS[id].handles.genres.length);

  it('the shape is a line a rail and a line a type not made yet', () => {
    const S = railShapes();
    expect(S.rails.length).toBe(RAIL_IDS.length); expect(S.notYet.length).toBe(Object.keys(NOT_YET).length);
    expect(S.rails.every((l) => !/\n/.test(l))).toBe(true);
    expect(S.rails[0].startsWith(`${RAIL_IDS[0]}: `)).toBe(true);
    // (none waiting today, the shared kitchen having joined the Work Sim rail: no line said)
    if (S.notYet.length) expect(S.notYet[0]).toContain('Not a game yet');
  });

  it('a sheet reads the four tunings from the rail\'s own cube, copying none', () => {
    const S = railSheet(designed), H = RAILS[designed].handles, cube = genreCube(S.from);
    expect(S.from).toBe(H.genres[0]); expect(laid(S.starts)).toBe(true); expect(H.genres).toContain(S.starts);
    expect(S.tunings.level).toEqual(cube.space); expect(S.tunings.character).toEqual(cube.soul); expect(S.tunings.world).toEqual(cube.reality);
    expect(S.tunings.action).toMatchObject({ feel: H.pole, says: POLES[H.pole].says, ...cube.power });
    expect(S.sizes.map((z) => z.size)).toEqual([...RAILS[designed].sizes]);
    expect(S.lacks).toEqual(railLacks(designed));
    for (const l of S.labours) expect(LABOURS[l].genres.some((g) => H.genres.includes(g))).toBe(true);
    // a sheet is a fresh read: changing it changes no table
    S.tunings.level.camera = 'x'; expect(genreCube(S.from).space.camera).not.toBe('x');
  });

  it('a rail whose own cube is not built yet says what is missing and the cube a game starts from today', () => {
    // (its gaps are its own cube's dry run, and nothing else: every rail's sheet holds to that)
    const unbuilt = (k) => { const g = RAILS[k].handles.genres[0]; return !!g && dryRun(genreCube(g)).verdict !== 'makeable'; };
    for (const k of [RAIL_IDS.find(unbuilt), RAIL_IDS.find((x) => RAILS[x].handles.genres[0] && !unbuilt(x))].filter(Boolean)) expect(!!railSheet(k).gaps, k).toBe(unbuilt(k));
    const id = RAIL_IDS.find((k) => unbuilt(k) && RAILS[k].handles.genres.some(laid));
    if (!id) return;   // (no rail stands on an unbuilt cube with a laid neighbour today)
    const S = railSheet(id), H = RAILS[id].handles;
    expect(S.from).toBe(H.genres[0]); expect(S.starts).toBe(H.genres.find(laid)); expect(S.starts).not.toBe(S.from);
    expect(S.gaps.every((g) => g.status !== 'built')).toBe(true);
    const body = railCardById(`gameworld-rail-${id}`).body;
    expect(body).toContain('not built yet in its own cube'); expect(body).toContain(`starts from '${S.starts}' today`);
  });

  it('its chain is the tools that build it at each size, in order, a card a step', () => {
    const S = railSheet(designed), by = Object.fromEntries(S.chain.map((c) => [c.size, c.steps]));
    expect(Object.keys(by)).toEqual([...RAILS[designed].sizes]);
    expect(by.quick[0].card).toBe(`gameworld-quick-${RAILS[designed].handles.quick[0]}`);
    const steps = by.designed.map((s) => s.step);
    expect(steps[0]).toBe('intake'); expect(steps[steps.length - 1]).toBe('play');
    expect(steps.indexOf('brief')).toBeLessThan(steps.indexOf('intent')); expect(steps.indexOf('feel')).toBeLessThan(steps.indexOf('first-level'));
    expect(by.designed.find((s) => s.step === 'intent').card).toBe(`gameworld-intent-${S.starts}`);
    // a rail with no cube and no template still has a sheet: its tunings are the ask's
    const B = railSheet(bare);
    expect(B.from).toBeNull(); expect(Object.values(B.tunings).every((v) => v === null)).toBe(true); expect(B.chain.length).toBe(RAILS[bare].sizes.length);
  });

  it('the nearest rails are those whose words a brief uses, most first, and it refuses nothing', () => {
    const id = designed, words = railWords(id).slice(0, 2);
    const N = nearestRails(`a game with ${words.join(' and ')} in it`);
    expect(N[0]).toMatchObject({ id, name: RAILS[id].name }); expect(N[0].matched).toEqual(expect.arrayContaining(words));
    expect(N.length).toBeLessThanOrEqual(3); expect(nearestRails(`${words[0]}`, 1).length).toBe(1);
    expect(nearestRails('nothing any rail says zzz')).toEqual([]); expect(nearestRails(undefined)).toEqual([]);
    // matched whole: a word inside another is not a match
    expect(nearestRails(`x${words[0]}x`).find((r) => r.id === id && r.matched.includes(words[0]))).toBeUndefined();
  });

  it('a type not made yet is said by its own words', () => {
    expect(notYetFor('a quiet walk')).toEqual([]);
    if (!Object.keys(NOT_YET).length) return;   // (none waiting today: nothing is said of one)
    const [id, N] = Object.entries(NOT_YET)[0];
    expect(notYetFor(`I want a ${N.words[0]} game`)[0]).toMatchObject({ id, waits: N.waits });
    // (a word may also be a rail's: the producer then says both, the type not made yet and the nearest rail)
    for (const v of Object.values(NOT_YET)) expect(v.words.length).toBeGreaterThan(0);
  });

  it('is served as two cards by id: the shape, and a rail\'s sheet', () => {
    const all = railCardById('gameworld-rails');
    for (const id of [RAIL_IDS[0], RAIL_IDS[RAIL_IDS.length - 1]]) expect(all.body).toContain(RAILS[id].name);
    expect(all.body).toMatch(/TEMPLATE/);
    if (Object.keys(NOT_YET).length) expect(all.body).toContain(Object.values(NOT_YET)[0].name);
    const one = railCardById(`gameworld-rail-${designed}`);
    expect(one.body).toContain(RAILS[designed].name); expect(one.body).toMatch(/TEMPLATE/); expect(one.body).toContain('THE CHAIN');
    expect(one.body).toContain(railLacks(designed)[0]);
    expect(railCardById(`gameworld-rail-${bare}`).body).toContain('no cube of its own');
    expect(railCardById('gameworld-rail-no-such')).toBeNull(); expect(railCardById('gameworld-intent')).toBeNull();
  });
});

describe('the pitch: a gameworld\'s rail', () => {
  const id = RAIL_IDS.find((k) => RAILS[k].handles.pole && RAILS[k].handles.genres.some(laid) && RAILS[k].sizes.length > 1);
  const other = RAIL_IDS.find((k) => k !== id && RAILS[k].handles.genres.some(laid));
  const small = RAIL_IDS.find((k) => !RAILS[k].sizes.includes('designed'));
  const tuning = Object.keys(TUNINGS)[0];

  it('is read: the template, the size called, where the game departs, whether it is locked', () => {
    expect(readRail({ from: id })).toEqual({ from: id, departs: {}, locked: false });
    expect(readRail({ from: id, size: 'designed', departs: { [tuning]: ' theirs ' }, locked: true })).toEqual({ from: id, size: 'designed', departs: { [tuning]: 'theirs' }, locked: true });
    expect(() => readRail({ from: 'no-such' })).toThrow(/from is the rail it starts from/);
    expect(() => readRail({ from: id, size: 'huge' })).toThrow(/size is the size called/);
    expect(() => readRail({ from: id, departs: { story: 'x' } })).toThrow(/is not a tuning/);
    expect(() => readRail({ from: id, departs: { [tuning]: '' } })).toThrow(/is a line/);
    expect(() => readRail({ from: id, name: 'x' })).toThrow(/name is not part of a pitch/);
    expect(() => readRail('x')).toThrow(/is \{ from/);
  });

  it('is said back as a template the game departs from, never the game', () => {
    const R = railReport({ rail: { from: id, departs: { [tuning]: 'theirs' } } });
    expect(R).toMatchObject({ from: id, name: RAILS[id].name, locked: false, departs: { [tuning]: 'theirs' }, card: `gameworld-rail-${id}`, starts: railSheet(id).starts });
    expect(R.template).toMatch(/a template: the game is theirs/);
    expect(R.keeps).toEqual(Object.keys(TUNINGS).filter((k) => k !== tuning));
    expect(R.short).toBeUndefined(); expect(R.replanned).toBeUndefined();
    expect(railReport({})).toBeNull(); expect(railReport({ rail: null })).toBeNull();
  });

  it('never refuses a size the rail does not reach, or a locked pitch that moves: both are said', () => {
    const S = railReport({ rail: { from: small, size: 'designed' } });
    expect(S.short).toMatchObject({ wanted: 'designed', reaches: [...RAILS[small].sizes] }); expect(S.short.waits).toMatch(/\S/);
    expect(railReport({ rail: { from: other, locked: true } }, { rail: { from: id, locked: true } }).replanned).toEqual({ was: id });
    // a pitch not yet locked moves freely; the same rail is no re-plan
    expect(railReport({ rail: { from: other } }, { rail: { from: id } }).replanned).toBeUndefined();
    expect(railReport({ rail: { from: id, locked: true } }, { rail: { from: id, locked: true } }).replanned).toBeUndefined();
  });

  it('is a key of the gameworld, the intent chapter\'s: a record that lays nothing', () => {
    expect(chaptersOfPath('/rail').map((c) => c.id)).toEqual(['intent']);
    const plain = readGameworld(MEADOWMARK), pitched = readGameworld({ ...MEADOWMARK, rail: { from: id, locked: true } });
    expect(JSON.stringify(pitched.levels)).toBe(JSON.stringify(plain.levels));
    expect(() => readGameworld({ ...MEADOWMARK, rail: { from: 'no-such' } })).toThrow(/rail\.from/);
  });

  it('pre-answers the goalposts: the cube the game starts from, the feel it plays', () => {
    const M = railMoves({ rail: { from: id } }), S = railSheet(id);
    expect(M.game).toContain(`from: '${S.starts}'`); expect(M.play).toContain(`feel: '${RAILS[id].handles.pole}'`);
    expect(railMoves({})).toEqual({}); expect(railMoves({ rail: { from: 'no-such' } })).toEqual({});
    const bare = goalposts({ world: {} }), picked = goalposts({ world: { rail: { from: id } } });
    const of = (G, g) => G.posts.find((p) => p.id === g);
    expect(of(bare, 'game').status).toBe('open'); expect(of(picked, 'game').status).toBe('partial');
    expect(of(picked, 'game').ask).not.toBe(GOALPOSTS[0].ask); expect(of(picked, 'game').ask).toMatch(/leave the template/);
    expect(picked.next).toMatchObject({ goalpost: 'game', move: M.game });
    // once the intent is written the rail has no more to say of it, and the play goalpost's move is the rail's feel
    const written = goalposts({ world: { rail: { from: id }, intent: { from: S.starts } } });
    expect(of(written, 'game').status).toBe('met');
    expect(goalposts({ world: { rail: { from: id }, intent: { from: S.starts }, mainQuest: { length: 'short', acts: [{ id: 'a', beats: [{ id: 'b' }] }] } }, chapters: ['world', 'direction', 'hero'].map((c) => ({ id: c, state: 'settled' })) }).next).toMatchObject({ goalpost: 'play', move: M.play });
    // a world with no rail is asked as it always was
    expect(of(bare, 'game').ask).toBe(GOALPOSTS[0].ask);
  });

  it('a written brief is not asked its shape again: the question left is its length and its spine', () => {
    const m = Object.keys(MOTIVATIONS)[0], l = Object.keys(LABOURS)[0];
    const G = goalposts({ world: { gameBrief: { gmn: { motivations: { [m]: 1 }, labours: { [l]: 1 } } } } }), shape = G.posts.find((p) => p.id === 'shape');
    expect(shape.status).toBe('partial'); expect(shape.says).toContain(MOTIVATIONS[m].name); expect(shape.says).toContain(LABOURS[l].name);
    expect(shape.ask).toMatch(/spine/); expect(shape.ask).not.toBe(GOALPOSTS[1].ask);
    const none = goalposts({ world: {} }).posts.find((p) => p.id === 'shape');
    expect(none).toMatchObject({ status: 'open', ask: GOALPOSTS[1].ask });
  });

  it('the start readout says the pitch back, with the rail\'s sheet to pull', () => {
    const S = startReadout({ rail: { from: id, size: 'designed' } });
    expect(S.rail).toMatchObject({ from: id, size: 'designed' }); expect(S.cards).toContain(`gameworld-rail-${id}`);
    expect(S.stored).toBe(false);
    const plain = startReadout({});
    expect(plain.rail).toBeUndefined(); expect(plain.cards).toEqual(['gameworld-guide', 'gameworld-studio', 'gameworld-producer', 'gameworld-rails']);
  });

  it('a rail says how it is seen outright where its tables\' cameras are not the game\'s', () => {
    const said = RAIL_IDS.find((k) => RAILS[k].seen);
    expect(seenOf(said)).toEqual([...RAILS[said].seen]); expect(railShape(said)).toContain(SEEN_WORDS[RAILS[said].seen[0]]);
  });
});

describe('the producer leads: one question a turn, before the goalposts', () => {
  const id = RAIL_IDS.find((k) => RAILS[k].handles.genres.some(laid) && !RAILS[k].handles.quick);
  const steps = (w, o) => producerSteps(w, o).map((s) => s.step);

  it('asks what was brought, then places the game on a rail, then locks the pitch, then the brief', () => {
    expect(steps({})).toEqual(['intake', 'rail']);
    expect(steps({ intake: 'none' })).toEqual(['rail']);
    expect(steps({ intake: 'none', rail: { from: id } })).toEqual(['lock', 'brief']);
    expect(steps({ intake: 'none', rail: { from: id, locked: true } })).toEqual(['brief']);
    expect(steps({ intake: 'none', rail: { from: id, locked: true }, gameBrief: { gmn: {} } })).toEqual([]);
    // a smaller game is asked no brief
    expect(steps({ intake: 'none', rail: { from: id, size: 'quick', locked: true } })).toEqual([]);
    for (const s of producerSteps({})) { expect(s.ask).toMatch(/\?$/); expect(s.card).toMatch(/^gameworld-/); }
  });

  it('the rail step carries the templates the book\'s words point at, and a type not made yet', () => {
    const w = railWords(id)[0], N = Object.values(NOT_YET)[0];
    const R = producerSteps({ intake: 'none', brief: `a ${w} game` }).find((s) => s.step === 'rail');
    expect(R.nearest.map((r) => r.id)).toContain(id);
    if (N) expect(producerSteps({ intake: 'none', name: N.words[0] }).find((s) => s.step === 'rail').notYet[0].waits).toBe(N.waits);
    // (the words of a type that joined a rail point at the rail: a co-op kitchen at the Work Sim)
    expect(producerSteps({ intake: 'none', brief: 'a co-op kitchen game' }).find((s) => s.step === 'rail').nearest.map((r) => r.id)).toContain('work-sim');
    expect(producerSteps({ intake: 'none' }).find((s) => s.step === 'rail').nearest).toBeUndefined();
  });

  it('the start readout leads with them and says the one question this turn asks', () => {
    const S = startReadout({});
    expect(S.next.map((s) => s.step)).toEqual(['intake', 'rail', 'goalpost']);
    expect(S.producer).toMatchObject({ seat: 'producer', step: 'intake', ask: S.next[0].ask });
    const L = startReadout({ intake: 'none', rail: { from: id } });
    expect(L.next.map((s) => s.step)).toEqual(['lock', 'brief', 'goalpost']); expect(L.producer.step).toBe('lock');
    expect(L.next[0].ask).toContain(RAILS[id].name);
    expect(producerSays([{ step: 'run' }])).toBeNull();
  });

  it('a stored book with no pitch has no producer steps; with one, they keep their lead over a goalpost', () => {
    expect(producerSteps({}, { stored: true })).toEqual([]);
    expect(steps({ rail: { from: id } }, { stored: true })).toEqual(['lock', 'brief']);
    const posts = goalposts({ world: { rail: { from: id } } });
    const next = leadNext([...producerSteps({ rail: { from: id } }, { stored: true }), { step: 'run' }], posts, {});
    expect(next.map((s) => s.step)).toEqual(['lock', 'brief', 'goalpost', 'run']);
  });
});

describe('the pitch kept: a locked pitch with no level is given the rail\'s starter', () => {
  const composed = RAIL_IDS.find((k) => RAILS[k].sizes.includes('designed') && RAILS[k].handles.genres.some(laid) && !RAILS[k].starter && !['platformer'].includes(POLES[RAILS[k].handles.pole]?.base));
  // (a rail with its own starter words: laid from them, its levels theirs)
  const started = RAIL_IDS.find((k) => RAILS[k].starter && RAILS[k].sizes.includes('designed'));
  const platformer = RAIL_IDS.find((k) => POLES[RAILS[k].handles.pole]?.base === 'platformer' && RAILS[k].sizes.includes('designed'));
  const small = RAIL_IDS.find((k) => !RAILS[k].sizes.includes('designed'));
  const base = { id: 'their-game', name: 'Their Game' };

  it('only a locked pitch with no level asks for it', () => {
    expect(pitchStart({ ...base, rail: { from: composed } })).toBeNull();
    expect(pitchStart({ ...base })).toBeNull();
    expect(pitchStart({ ...base, levels: {}, rail: { from: composed, locked: true } })).toBeNull();
  });

  it('lays a first reading of the cube the rail starts from: one level, the game\'s own keys winning, a world that reads', () => {
    const P = pitchStart({ ...base, rail: { from: composed, locked: true }, intake: 'none' }), S = railSheet(composed);
    expect(P.laid).toMatchObject({ by: 'compose', from: S.starts }); expect(P.laid.levels.length).toBe(1); expect(P.laid.says).toMatch(/starter/);
    expect(P.world).toMatchObject({ id: 'their-game', name: 'Their Game', intake: 'none', rail: { from: composed, locked: true }, intent: { from: S.starts } });
    expect(P.world.feel).toBe(RAILS[composed].handles.pole);
    // the starter brings its ground, never the composer's review, mode or brief
    for (const k of ['mode', 'review', 'brief', 'made']) expect(P.world[k]).toBeUndefined();
    expect(() => readGameworld(P.world)).not.toThrow();
    // what the creator wrote wins, and the same pitch lays the same starter
    expect(pitchStart({ ...base, feel: 'ebon-spirits', intent: { from: S.starts, why: 'theirs' }, rail: { from: composed, locked: true } }).world).toMatchObject({ feel: 'ebon-spirits', intent: { why: 'theirs' } });
    expect(JSON.stringify(pitchStart({ ...base, rail: { from: composed, locked: true }, intake: 'none' }))).toBe(JSON.stringify(P));
  });

  it('a rail with its own starter lays it: the party RPG\'s round, its town, its wilds, its castle and its core, its steps in its chain', () => {
    const P = pitchStart({ ...base, rail: { from: started, locked: true } });
    expect(P.laid).toMatchObject({ by: 'compose' });
    expect(P.laid.levels).toHaveLength(RAILS[started].starter.levels);
    expect(P.world.megaworld).toMatchObject({ shape: 'mandala' });
    expect(P.world.battles).toMatchObject({ boss: expect.any(Array) });
    expect(() => readGameworld(P.world)).not.toThrow();
    const chain = railSheet(started).chain.find((c) => c.size === 'designed').steps.map((x) => x.step);
    expect(chain.slice(chain.indexOf('chapters'), chain.indexOf('first-level') + 1)).toEqual(['chapters', ...RAILS[started].steps.map((x) => x.step), 'first-level']);
  });

  it('a platformer\'s rail lays its own first level and the flow that plays it', () => {
    const P = pitchStart({ ...base, rail: { from: platformer, locked: true } });
    expect(P.laid.by).toBe('platformer'); expect(P.world.flow).toBeTruthy(); expect(P.world.feel).toBe(RAILS[platformer].handles.pole);
    expect(() => readGameworld(P.world)).not.toThrow();
  });

  it('a rail with no starter, or a smaller size, is said and not laid', () => {
    expect(pitchStart({ ...base, rail: { from: small, locked: true } }).unlaid).toMatch(/not laid as a designed game yet/);
    expect(pitchStart({ ...base, rail: { from: composed, size: 'quick', locked: true } })?.unlaid ?? pitchStart({ ...base, rail: { from: RAIL_IDS.find((k) => RAILS[k].sizes.includes('quick')), size: 'quick', locked: true } }).unlaid).toMatch(/its own call/);
  });
});

// A RAIL'S VARIANTS: a variant a door's words make (the beat-em-up's heroes) is named by its own words, has its own sheet
// whose chain asks its own question before anything is made, and lays its street's words on a designed game's starter
describe('a rail\'s variants', () => {
  const withV = RAIL_IDS.filter((id) => RAILS[id].variants);
  const [rid] = withV, [vid] = Object.keys(RAILS[rid].variants), V = variantOf(rid, vid);
  it('every variant has its name, its words, its first level and the question it asks with its card', () => {
    for (const id of withV) for (const k of Object.keys(RAILS[id].variants)) {
      const v = variantOf(id, k);
      expect(v.name && v.like && v.level1 && v.words.length && v.ask.card, `${id}.${k}`).toBeTruthy();
    }
    expect(() => variantOf(rid, 'nope')).toThrow(/variants/);
  });
  it('is named by its own words, the rail\'s own words still the rail', () => {
    const [hit] = nearestRails(`a ${V.words[0]} with my friends`);
    expect(hit).toMatchObject({ id: rid, variant: vid, name: V.name });
    const plain = RAILS[rid].words?.[0];
    if (plain) expect(nearestRails(`like ${plain}`)[0].variant).toBeUndefined();
  });
  it('its sheet\'s chain asks its question first at every size, its quick door carries its words, its first level its street', () => {
    const S = railSheet(rid, vid);
    expect(S).toMatchObject({ id: rid, variant: vid, name: V.name, level1: V.level1 });
    const quick = S.chain.find((c) => c.size === 'quick'), designed = S.chain.find((c) => c.size === 'designed');
    expect(quick.steps[0]).toMatchObject({ step: V.ask.step, card: V.ask.card });
    expect(quick.steps[1].does).toContain(V.quick);
    expect(designed.steps.findIndex((st) => st.step === V.ask.step)).toBeLessThan(designed.steps.findIndex((st) => st.step === 'chapters'));
    expect(designed.steps.find((st) => st.step === 'first-level').does).toContain(Object.values(V.street)[0]);
    // (the rail's own sheet names its variants and asks no variant's question)
    expect(railSheet(rid).variants.map((v) => v.id)).toContain(vid);
    expect(railSheet(rid).chain.flatMap((c) => c.steps).some((st) => st.step === V.ask.step)).toBe(false);
  });
  it('a pitch names it, its report and card are its own, and a designed game\'s starter streets carry its words', () => {
    expect(() => readRail({ from: rid, variant: 'nope' })).toThrow(/variants/);
    const R = railReport({ rail: { from: rid, variant: vid, locked: true } });
    expect(R).toMatchObject({ variant: vid, name: V.name, card: `gameworld-rail-${rid}-${vid}` });
    const card = railCardById(R.card);
    expect(card.body).toContain(V.ask.does.slice(0, 20));
    expect(railCardById(`gameworld-rail-${rid}`).body).toContain(`gameworld-rail-${rid}-${vid}`);
    const P = pitchStart({ id: 'g', name: 'Theirs', rail: { from: rid, variant: vid, locked: true } });
    expect(P.laid.variant).toBe(vid);
    const streets = Object.values(P.world.levels).filter((L) => L.street);
    expect(streets.length).toBeGreaterThan(0);
    for (const L of streets) expect(L.street).toMatchObject(V.street);
    expect(() => readGameworld(P.world)).not.toThrow();
  });
});
