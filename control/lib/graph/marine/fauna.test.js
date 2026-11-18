/**
 * The sea's animals (marine/fauna.js): the rows name animals the encyclopedia builds; the search finds what grows and what
 * lives by the words people say; the call keeps its laws (depth, room, habitat, salt, the pyramid) and says what it left
 * out; each called animal swims a closed loop over the bed and under the surface.
 */
import { describe, expect, it } from 'vitest';

import { MARINE_FAUNA, MARINE_FAUNA_IDS, MARINE_HABITS, MARINE_HABIT_IDS, MARINE_CALL, marineAbout, searchMarine, namedBy, checkSeaFauna, castMarine, placeMarineFauna } from './fauna.js';
import { MARINE_KIND_IDS, MARINE_MIX_IDS } from './roster.js';
import { SPECIES } from '../fauna/species.js';
import { BUG_SPECIES } from '../bugs/species.js';
import { readFauna } from '../era/biocube-fauna.js';
import { readBiocube } from '../era/biocube.js';
import { sceneOfWords } from '../gameworld/scene-words.js';

// a length for every animal without building one: its row's place in the roster, a metre or so, but the ones a law is tried on
const LEN = { big: 9, small: 0.2 };
const lengthOf = (id) => LEN[id] ?? 0.5;
const live = MARINE_FAUNA_IDS.filter((id) => !MARINE_FAUNA[id].fresh && !MARINE_FAUNA[id].ancient);
// one animal a habit, picked from the roster
const OF_HABIT = Object.fromEntries(MARINE_HABIT_IDS.map((h) => [h, live.find((id) => MARINE_FAUNA[id].lives === h && MARINE_FAUNA[id].mixes.length)]));
const call = (ask, o = {}) => castMarine(checkSeaFauna(ask), { mix: 'reef', depth: 14, has: { rock: 4, anemone: 4 }, lengthOf, seed: 1, ...o });

describe('the sea\'s animals', () => {
  it('every row names an animal the encyclopedia builds, a habit, a depth and the mixes it belongs in', () => {
    for (const id of MARINE_FAUNA_IDS) {
      const R = MARINE_FAUNA[id];
      expect((R.roster === 'bugs' ? BUG_SPECIES : SPECIES)[id], id).toBeTruthy();
      expect(MARINE_HABIT_IDS, id).toContain(R.lives);
      expect(R.depth[0], id).toBeLessThan(R.depth[1]);
      expect(R.group[0], id).toBeLessThanOrEqual(R.group[1]);
      for (const m of R.mixes) expect(MARINE_MIX_IDS, id).toContain(m);
      expect(marineAbout(id).common, id).toBeTruthy();
    }
    // (every habit has an animal, and every mix someone to call)
    for (const h of MARINE_HABIT_IDS) expect(OF_HABIT[h], h).toBeTruthy();
    for (const m of MARINE_MIX_IDS) expect(live.some((id) => MARINE_FAUNA[id].mixes.includes(m)), m).toBe(true);
  });

  it('is found by the words people say: a name, a family, a habit; flora and fauna alike, each saying if it fits', () => {
    const id = OF_HABIT.cruise, A = marineAbout(id);
    // (best first: the fits before the rest among equals)
    expect(searchMarine(A.common)[0].id).toBe(id);
    expect(searchMarine('').length).toBe(MARINE_FAUNA_IDS.length + MARINE_KIND_IDS.length);
    expect(searchMarine('kelp')[0]).toMatchObject({ id: 'kelp', what: 'flora' });
    expect(searchMarine('kelp', { what: 'fauna' }).every((r) => r.what === 'fauna')).toBe(true);
    const sharks = searchMarine('sharks');
    expect(sharks.length).toBeGreaterThan(1);
    expect(sharks.every((r) => r.what === 'fauna')).toBe(true);
    // (the depth is said, not hidden: a row that does not live there is listed with its reason)
    const R = MARINE_FAUNA[id], deep = searchMarine(A.common, { depth: R.depth[1] + 50 }).find((r) => r.id === id);
    expect(deep).toMatchObject({ id, fits: false });
    expect(deep.why).toMatch(/lives under/);
    const fresh = MARINE_FAUNA_IDS.find((x) => MARINE_FAUNA[x].fresh);
    expect(searchMarine(marineAbout(fresh).common).find((r) => r.id === fresh)).toMatchObject({ fits: false, why: expect.stringMatching(/fresh water/) });
    expect(searchMarine('zeppelin')).toEqual([]);
  });

  it('a longer name takes its words: "a whale shark" is not also "a shark"', () => {
    expect(namedBy('a whale shark')).toEqual(['whaleShark']);
    expect(namedBy('a shark and a sea turtle').sort()).toEqual(['greatWhiteShark', 'seaTurtle']);
    expect(namedBy('some sharks')).toEqual(['greatWhiteShark']);
    expect(namedBy('nothing here')).toEqual([]);
  });

  it('reads true, words, or its settings; and refuses what it is not', () => {
    expect(checkSeaFauna(undefined)).toBeNull();
    expect(checkSeaFauna(true)).toEqual({ cast: {}, find: null, density: 1 });
    expect(checkSeaFauna('sharks').find).toBe('sharks');
    expect(() => checkSeaFauna({ herd: 1 })).toThrow(/fauna.sea.herd is not a setting/);
    expect(() => checkSeaFauna({ cast: { sheep: true } })).toThrow(/not one of the sea's animals/);
    expect(() => checkSeaFauna({ cast: { [live[0]]: 0 } })).toThrow(/a count/);
    expect(() => checkSeaFauna({ density: 9 })).toThrow(/fauna.sea.density/);
    expect(() => checkSeaFauna(4)).toThrow(/fauna.sea is true/);
    // (a biocube's fauna carries it as its third tier, beside the swarms and the herds; a herd of a swimmer points here)
    expect(readFauna({ sea: true })).toMatchObject({ swarms: {}, herds: {}, sea: { density: 1 } });
    expect(() => readFauna({ herds: { [OF_HABIT.school]: true } })).toThrow(/fauna\.sea/);
    expect(() => readFauna({ sea: { cast: { sheep: true } } })).toThrow(/biocube: fauna.sea.cast.sheep/);
  });
});

describe('the call', () => {
  it('calls who belongs in the mix, one kind a habit (two round the rocks), under the page\'s budget', () => {
    const C = call(true);
    expect(C.cast.length).toBeGreaterThan(2);
    expect(C.cast.length).toBeLessThanOrEqual(MARINE_CALL.most.kinds);
    for (const c of C.cast) { expect(MARINE_FAUNA[c.species].mixes).toContain('reef'); expect(c.count).toBeGreaterThanOrEqual(1); }
    for (const h of MARINE_HABIT_IDS) expect(C.cast.filter((c) => c.lives === h).length, h).toBeLessThanOrEqual(MARINE_HABITS[h].slots);
    expect(C.cast.reduce((a, c) => a + c.count, 0)).toBeLessThanOrEqual(MARINE_CALL.most.bodies);
    // (who else lives here is offered, never called twice)
    for (const id of C.offered) expect(C.cast.some((c) => c.species === id)).toBe(false);
    expect(call(true)).toEqual(C);
    expect(call(true, { mix: 'vents', depth: 1000 }).cast.every((c) => MARINE_FAUNA[c.species].mixes.includes('vents'))).toBe(true);
  });

  it('depth: an animal lives under its own water, and is named where it does not', () => {
    const id = OF_HABIT.cruise, R = MARINE_FAUNA[id], C = call({ cast: { [id]: true } }, { depth: R.depth[1] + 100 });
    expect(C.cast.some((c) => c.species === id)).toBe(false);
    expect(C.left.find((l) => l.species === id).why).toMatch(/lives under/);
  });

  it('room: the water holds it, an open-water animal needing more', () => {
    const id = OF_HABIT.cruise, need = LEN.big * MARINE_CALL.room * MARINE_CALL.open, len = (x) => (x === id ? LEN.big : 0.5);
    const tight = call({ cast: { [id]: true } }, { lengthOf: len, depth: Math.min(MARINE_FAUNA[id].depth[1], need - 1) });
    expect(tight.left.find((l) => l.species === id).why).toMatch(/it needs/);
    const bed = OF_HABIT.bed, lenB = (x) => (x === bed ? 4 : 0.5), d = 4 * MARINE_CALL.room + 0.5;
    if (d >= MARINE_FAUNA[bed].depth[0] && d <= MARINE_FAUNA[bed].depth[1]) expect(call({ cast: { [bed]: true } }, { lengthOf: lenB, depth: d }).cast.some((c) => c.species === bed)).toBe(true);
  });

  it('habitat: an anemone fish needs anemones, a reef fish a rock', () => {
    const a = OF_HABIT.anemone, r = OF_HABIT.reef, d = Math.max(MARINE_FAUNA[a].depth[0], MARINE_FAUNA[r].depth[0]) + 1;
    const bare = call({ cast: { [a]: true, [r]: true } }, { has: { rock: 0, anemone: 0 }, depth: d });
    expect(bare.cast.some((c) => c.species === a || c.species === r)).toBe(false);
    expect(bare.left.map((l) => l.species).sort()).toEqual(expect.arrayContaining([a, r].sort()));
    expect(bare.left.find((l) => l.species === a).why).toMatch(/no anemone/);
    expect(call({ cast: { [a]: true } }, { depth: d }).cast.some((c) => c.species === a)).toBe(true);
  });

  it('salt: a fresh-water animal is never the sea\'s, an extinct one only when named', () => {
    const fresh = MARINE_FAUNA_IDS.find((x) => MARINE_FAUNA[x].fresh), old = MARINE_FAUNA_IDS.find((x) => MARINE_FAUNA[x].ancient);
    expect(call({ cast: { [fresh]: true } }).left.find((l) => l.species === fresh).why).toMatch(/fresh water/);
    for (const m of MARINE_MIX_IDS) expect(call(true, { mix: m, depth: 30 }).cast.some((c) => c.species === old || c.species === fresh), m).toBe(false);
    expect(call({ cast: { [old]: true } }, { depth: 150 }).cast.some((c) => c.species === old)).toBe(true);
  });

  it('what is asked for is called first, a count kept, a null never; words name or prefer', () => {
    const want = live.filter((id) => MARINE_FAUNA[id].lives === 'cruise' && !MARINE_FAUNA[id].mixes.includes('reef') && MARINE_FAUNA[id].depth[0] <= 14 && MARINE_FAUNA[id].depth[1] >= 14)[0];
    const C = call({ cast: { [want]: 2 } });
    expect(C.cast.find((c) => c.species === want)).toMatchObject({ count: 2, asked: true });
    const first = call(true).cast[0].species;
    expect(call({ cast: { [first]: null } }).cast.some((c) => c.species === first)).toBe(false);
    const named = call({ find: marineAbout(want).common });
    expect(named.cast.find((c) => c.species === want)?.asked).toBe(true);
    // (a crowd asked for is thinned to the page's bodies, the largest group first)
    const crowd = call({ cast: Object.fromEntries(live.filter((id) => MARINE_FAUNA[id].depth[0] <= 14 && MARINE_FAUNA[id].depth[1] >= 14).slice(0, 5).map((id) => [id, 40])) });
    expect(crowd.cast.reduce((a, c) => a + c.count, 0)).toBeLessThanOrEqual(MARINE_CALL.most.bodies);
  });
});

describe('the animals\' loops', () => {
  const trail = Array.from({ length: 20 }, (_, i) => [20, i * 2, 0]), z = () => 0, surface = 14;
  const at = { z, rocks: [{ x: 26, y: 10, z: 0, R: 1.5, H: 1 }], anemones: [[27, 12, 0.3]], trail, surface, seed: 2 };
  const cast = MARINE_HABIT_IDS.map((h) => ({ species: OF_HABIT[h], roster: MARINE_FAUNA[OF_HABIT[h]].roster, gait: MARINE_FAUNA[OF_HABIT[h]].gait, lives: h, count: h === 'school' ? 6 : 2, length: h === 'cruise' ? 2 : 0.4 }));
  const P = placeMarineFauna(cast, at);

  it('each body swims a closed loop of its own, over the bed and under the surface', () => {
    expect(P.walkers.length).toBe(cast.reduce((a, c) => a + c.count, 0));
    for (const w of P.walkers) {
      expect(w.path.length).toBeGreaterThan(8);
      expect(w.path[0]).toEqual(w.path.at(-1));
      for (const p of w.path) { expect(p[2]).toBeGreaterThan(0); expect(p[2]).toBeLessThan(surface); }
      expect(w.speed).toBeGreaterThan(0);
      expect(P.figures[w.figure]).toBeTruthy();
    }
    // (a group's members start apart: no two bodies of a kind on one point)
    const starts = P.walkers.filter((w) => w.style === 'sea:school').map((w) => w.path[0].join());
    expect(new Set(starts).size).toBe(starts.length);
  });

  it('a habit keeps its seat: over its anemone, round its rock, on the bed, wide over the place', () => {
    const of = (h) => P.walkers.filter((w) => w.style === `sea:${h}`), far = (w, c) => Math.max(...w.path.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])));
    for (const w of of('anemone')) expect(far(w, at.anemones[0])).toBeLessThan(1.5);
    for (const w of of('reef')) expect(far(w, [26, 10])).toBeLessThan(at.rocks[0].R * 3);
    for (const w of of('bed')) expect(Math.max(...w.path.map((p) => p[2]))).toBeLessThan(0.5);
    expect(Math.min(...of('cruise').map((w) => far(w, [20, 19])))).toBeGreaterThan(far(of('reef')[0], [26, 10]));
  });

  it('is the same from the same seed, and stops at the page\'s bones', () => {
    expect(placeMarineFauna(cast, at)).toEqual(P);
    expect(placeMarineFauna(cast, { ...at, seed: 9 }).walkers).not.toEqual(P.walkers);
    const few = placeMarineFauna(cast, { ...at, bonesOf: () => MARINE_CALL.most.bones / 3 });
    expect(few.walkers.length).toBe(3);
    expect(Object.keys(few.figures).length).toBeLessThan(cast.length);
    expect(placeMarineFauna([], at).walkers).toEqual([]);
  });
});

describe('called from a scene', () => {
  it('the seabed biome calls who lives there; a preset alone calls none', () => {
    const S = sceneOfWords('an underwater reef');
    expect(S.cube.biocube).toMatchObject({ from: 'seabed', fauna: { sea: true } });
    expect(readBiocube(S.cube.biocube).fauna.sea).toMatchObject({ density: 1 });
    expect(readBiocube('seabed').fauna).toBeNull();
  });
});
