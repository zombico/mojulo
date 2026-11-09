import { describe, it, expect } from 'vitest';
import { WORLDMAP_SAMPLE, worldmapGame, crossings, approveSegment } from './worldmap-bed.js';
import { readGameworld } from './world.js';
import { gameStages } from './levels.js';

// A ZONED MAP AS A GAME (level/zones.js): a stage a segment, each its own page, its ways the plan's gates on its border,
// arrival keyed by the zone come from. The world before its people (no hero): each zone walked first person.
describe('a zoned map made into a game', () => {
  it('is a stage a segment, the walk\'s first, then on along it, the segments off it last', () => {
    const S = gameStages(WORLDMAP_SAMPLE);
    expect(S.map((s) => [s.node, s.zone, s.manifest.kind, s.manifest.level.zone])).toEqual([['A', 'A', 'map', 'A'], ['B', 'B', 'map', 'B'], ['D', 'D', 'map', 'D'], ['C', 'C', 'map', 'C']]);
    expect(S[0].manifest.level.zoned).toBeUndefined();
  });

  it('leaves each zone by its gates, named by side, toward the zone across; arrives by the zone come from', () => {
    const M = worldmapGame(WORLDMAP_SAMPLE, { ref: 'wm' }), ref = (S) => M.levels.find((l) => l.zone === S).ref;
    const exits = Object.fromEntries(M.game.levels.map((l) => [M.levels.find((x) => x.ref === l.ref).zone, (l.exits ?? []).map((e) => `${e.id}>${M.levels.find((x) => x.ref === e.to).zone}`)]));
    expect(exits).toEqual({ A: ['gate-e>B', 'gate-s>C'], B: ['gate-w>A', 'gate-s>D'], D: ['gate-n>B', 'gate-w>C'], C: ['gate-n>A', 'gate-e>D'] });
    // (B: its reach-exits on its gates' exits, its arrivals on its gates' arrivals, a metre up)
    const B = M.levels.find((l) => l.zone === 'B').manifest, Z = M.zones[ref('B')];
    const gates = B.game.mechanics.filter((m) => m.kind === 'reach-exit');
    expect(gates.map((m) => [m.exit, m.at]).sort()).toEqual([['gate-s', Z.ways[0].exit], ['gate-w', Z.ways[1].exit]]);
    expect(B.game.arrive.sort()).toEqual([ref('A'), ref('D')].sort());
    const fromA = B.events.reactions.find((r) => r.on === `arrive:${ref('A')}`);
    expect(fromA.to.slice(0, 2)).toEqual(Z.ways.find((w) => w.to === 'A').arrive.slice(0, 2));
    // (set out at its way in from the town, facing in)
    expect(B.entities[0].transform.heading).toBeCloseTo(0);
    // (the keep holds the walk's goal: it keeps its own exit, the game's win, beside its gates)
    const D = M.levels.find((l) => l.zone === 'D').manifest;
    expect(D.game.mechanics.filter((m) => m.kind === 'reach-exit' && m.exit === undefined)).toHaveLength(1);
    // (no gate exit in A: it holds no goal)
    expect(M.levels.find((l) => l.zone === 'A').manifest.game.mechanics.filter((m) => m.kind === 'reach-exit' && m.exit === undefined)).toHaveLength(0);
  });

  it('walks every gate of the world once, each crossing from where the last set down', () => {
    const M = worldmapGame(WORLDMAP_SAMPLE, { ref: 'wm' }), C = crossings(M);
    const zone = (r) => M.levels.find((l) => l.ref === r).zone;
    expect(new Set(C.map((c) => `${zone(c.from)}>${c.exit}`)).size).toBe(8);
    C.slice(1).forEach((c, i) => expect(c.from).toBe(C[i].to));
  });

  it('refuses a zoned map with no plan, or in a world not travelled', () => {
    const lv = WORLDMAP_SAMPLE.levels.overworld.glyphs;
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, topology: undefined })).toThrow(/zoned is a world map.*interconnected/);
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, levels: { overworld: { glyphs: { tile: 24, zoned: true, rows: ['# #'] } } } })).toThrow(/write its plan/);
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, levels: { overworld: { glyphs: { ...lv, zoned: false } } } })).toThrow(/zoned is true/);
    const { zoned: _z, ...plain } = lv;
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, levels: { overworld: { glyphs: { ...plain, apron: 1 } } } })).toThrow(/apron is a zoned map's/);
  });
});

// SEAMLESS: segments walked as one page (`zoned: [['A', 'B']]`): the gate between them road on it, its ways out the gates
// of its outline, each named by its segment and side (lower-case).
describe('a page of several segments', () => {
  const W = { ...WORLDMAP_SAMPLE, levels: { overworld: { glyphs: { ...WORLDMAP_SAMPLE.levels.overworld.glyphs, zoned: [['A', 'B']] } } } };
  it('is one stage, the town and the fields, its ways the outline\'s gates; the rest a page each', () => {
    const S = gameStages(W);
    expect(S.map((s) => [s.node, s.zone])).toEqual([['A+B', ['A', 'B']], ['D', 'D'], ['C', 'C']]);
    const M = worldmapGame(W, { ref: 'wm' }), page = (z) => M.levels.find((l) => JSON.stringify(l.zone) === JSON.stringify(z));
    const AB = M.game.levels.find((l) => l.ref === page(['A', 'B']).ref);
    // (no way between the town and the fields; the town's south join to the woods and the fields' south to the keep)
    expect(AB.exits.map((e) => e.id).sort()).toEqual(['gate-a-s', 'gate-b-s']);
    // (the woods and the keep come back into it, each by its own gate)
    const D = page('D').manifest, fromD = D.game.mechanics.find((m) => m.exit === 'gate-n');
    expect(fromD).toBeTruthy();
    expect(page(['A', 'B']).manifest.game.arrive.sort()).toEqual([page('C').ref, page('D').ref].sort());
    // (its page sets out where the walk does, in the town)
    expect(M.zones[page(['A', 'B']).ref]).toMatchObject({ id: 'A+B' });
  });

  it('refuses a page of segments no gate joins, or a segment on two pages', () => {
    const bad = (zoned) => () => readGameworld({ ...W, levels: { overworld: { glyphs: { ...W.levels.overworld.glyphs, zoned } } } });
    expect(bad([['A', 'D']])).toThrow(/joined to the rest by no gate/);
    expect(bad([['A', 'B'], ['B', 'D']])).toThrow(/on two pages/);
    expect(bad([['A', 'Q']])).toThrow(/'Q' is no segment/);
  });
});

// THE SKETCH'S FIGHTS ARE THE LEVEL'S: an approved segment's encounter marks stand the bestiary's foes round them, as many
// as each says, of the entry its kind names; a mark of a kind the bestiary has not is left a mark.
import { foePlacements } from './foes.js';
import { stageEnds } from './levels.js';
describe('a sketched map\'s fights', () => {
  it('stands each approved encounter\'s foes round its mark, of the kind it names', () => {
    const W0 = approveSegment(approveSegment(WORLDMAP_SAMPLE, 'B'), 'D');
    const W = { ...W0, foes: { bandit: { class: 'charger', skin: { people: 'human' } } }, levels: { overworld: { ...W0.levels.overworld, foes: { from: ['bandit'] } } } };
    const G = readGameworld(W), S = gameStages(W), at = (z) => S.find((s) => s.zone === z);
    // (the fields: 'Bandits from the rocks at the bend', four of them, round the bend's tile)
    const E = stageEnds(at('B').manifest), P = foePlacements(G, 'overworld', E);
    expect(E.encounters).toEqual([expect.objectContaining({ count: 4, kind: 'bandit', tile: [1, 4] })]);
    expect(P.map((p) => p.eid)).toEqual(['bandit', 'bandit', 'bandit', 'bandit']);
    for (const p of P) expect(Math.hypot(p.at[0] - E.encounters[0].at[0], p.at[1] - E.encounters[0].at[1])).toBeLessThanOrEqual(2.51);
    // (the keep's warden and guards are of a kind the bestiary has not: left a mark, no foe stands)
    const D = stageEnds(at('D').manifest);
    expect(D.encounters[0]).toMatchObject({ kind: 'guard', count: 3 });
    expect(foePlacements(G, 'overworld', D)).toEqual([]);
    // (a draft is no plan: the woods are unsketched, the walk's beats stand its foes as they did)
    expect(stageEnds(at('C').manifest).encounters).toBeUndefined();
  });
});

// A FIRST ZONE'S GRADUATION (level/first-zone.js, its concept's `hold`): the first page's ways out wait on the downs of the
// foes standing on it (game/mechanics.js reach-exit `holds`); a page with no fight, or a concept without `hold`, as before.
import { firstZone } from '../level/first-zone.js';
describe('a first zone\'s page, held until it is won', () => {
  const Z = firstZone(WORLDMAP_SAMPLE.levels.overworld.glyphs.plan, { foe: 'bandit' });
  const world = (concept) => {
    const g = WORLDMAP_SAMPLE.levels.overworld.glyphs;
    const sketch = { concept, segments: {
      A: { status: 'approved', marks: [{ at: [1, 2], kind: 'encounter', say: 'a lone bandit', foes: { kind: 'bandit', count: 1 } }] },
      B: { status: 'approved', marks: [{ at: [1, 1], kind: 'encounter', say: 'the pack', foes: { kind: 'bandit', count: 3 } }] },
    } };
    return { ...WORLDMAP_SAMPLE, foes: { bandit: { class: 'charger', skin: { people: 'human' } } }, levels: { overworld: { glyphs: { ...g, zoned: [['A', 'B']], sketch }, foes: { from: ['bandit'] } } } };
  };
  const exits = (W) => {
    const M = worldmapGame(W, { ref: 'wm' }), page = (z) => M.levels.find((l) => JSON.stringify(l.zone) === JSON.stringify(z)).manifest;
    return (z) => page(z).game.mechanics.filter((m) => m.kind === 'reach-exit' && m.exit).map((m) => [m.exit, m.holds?.count ?? null]).sort();
  };
  it('holds the town and the fields\' ways out on their four bandits; never the way a page is come in by', () => {
    const E = exits(world(Z.concept));
    expect(E(['A', 'B'])).toEqual([['gate-a-s', 4], ['gate-b-s', 4]]);
    // (the keep, a draft whose walk stands its foes as before: its way back to the fields, come in by, open; its way to the
    // woods held on them; the woods, no foe standing, nothing held)
    const D = E('D');
    expect(D.find(([id]) => id === 'gate-n')[1]).toBeNull();
    expect(D.find(([id]) => id === 'gate-w')[1]).toBeGreaterThan(0);
    expect(E('C').every(([, n]) => n === null)).toBe(true);
    // (no hold in the concept: nothing held)
    const { hold: _h, ...free } = Z.concept;
    expect(exits(world(free))(['A', 'B']).every(([, n]) => n === null)).toBe(true);
  });
});
