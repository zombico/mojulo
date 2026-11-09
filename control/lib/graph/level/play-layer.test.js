import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { readPlay, playBuild, playLaws, authorityLaws, OBSTACLES } from './play-layer.js';
import { gridEnds } from './grid-ends.js';
import { levelHeight } from '../era/out-tile.js';
import { assembleGridScene } from './grid-scene.js';
import { WORLDMAP_SAMPLE, worldmapGame } from '../gameworld/worldmap-bed.js';
import { readGameworld } from '../gameworld/world.js';

// THE PLAY LAYER: level design's pieces on a block, saved in world metres and a yaw; built in the world's own colours,
// solid where they should be; held to the land under them, a drifted piece flagged with where it fits.
const g = WORLDMAP_SAMPLE.levels.overworld.glyphs, G = readGrid({ tile: g.tile, plan: g.plan, segments: g.segments });
const L = { seed: 5, ...(G.rise ? { rise: G.rise } : {}) }, ground = (x, y) => levelHeight(x, y, L);
const on = (x, y) => [x, y, Math.round(ground(x, y) * 1000) / 1000];
// (the fields, B: its square x 72–144, y −72–0; the bend at its middle, (108, −36))
const play = {
  B: {
    pieces: [
      { id: 'bandit-1', kind: 'foe', of: 'bandit', at: on(104, -32), yaw: 180 },
      { id: 'bandit-2', kind: 'foe', of: 'bandit', at: on(112, -40), yaw: 180 },
      { id: 'wagon', kind: 'obstacle', of: 'barricade', at: on(100, -44), yaw: 90, why: 'the ambush\'s cover, across the road' },
      { id: 'crates', kind: 'cover', of: 'crate', at: on(116, -30) },
      { id: 'cache', kind: 'pickup', of: 'supply cache', at: on(132, -60) },
    ],
    suggestions: [{ from: 'concept', say: 'the ambush comes from the rocks to the north', authority: 'should' }],
  },
};

describe('a play layer read', () => {
  it('reads each block\'s pieces in world metres and a yaw, and its suggestions with their authority', () => {
    const Y = readPlay(play, G.plan);
    expect(Y.B.pieces.map((p) => [p.id, p.kind, p.segment])).toEqual([['bandit-1', 'foe', 'B'], ['bandit-2', 'foe', 'B'], ['wagon', 'obstacle', 'B'], ['crates', 'cover', 'B'], ['cache', 'pickup', 'B']]);
    expect(Y.B.suggestions[0]).toMatchObject({ authority: 'should' });
  });
  it('refuses a piece that is not whole, with words', () => {
    const bad = (p, re) => expect(() => readPlay({ B: { pieces: [p] } }, G.plan)).toThrow(re);
    bad({ id: 'x', kind: 'tree', at: [0, 0, 0] }, /kind is foe, obstacle/);
    bad({ id: 'x', kind: 'obstacle', of: 'boulder', at: [0, 0, 0] }, /of is a shape: crate/);
    bad({ id: 'x', kind: 'foe', at: [0, 0, 0] }, /a foe names its bestiary id/);
    bad({ id: 'X', kind: 'marker', of: 'cairn', at: [0, 0, 0] }, /id is a name/);
    bad({ id: 'x', kind: 'marker', of: 'cairn', at: [0, 0] }, /at is \[x, y, z\]/);
    expect(() => readPlay({ Q: { pieces: [] } }, G.plan)).toThrow(/no such block/);
    expect(() => readPlay({ B: { suggestions: [{ from: 'a', say: 'b', authority: 'maybe' }] } }, G.plan)).toThrow(/authority is must/);
    // (a foe the level does not stand)
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, foes: { bandit: { class: 'charger' } }, levels: { overworld: { glyphs: { ...g, play }, foes: { from: ['wolf'].length ? ['bandit'] : [] } } } })).not.toThrow();
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, foes: { wolf: { class: 'charger' } }, levels: { overworld: { glyphs: { ...g, play }, foes: { from: ['wolf'] } } } })).toThrow(/the foe 'bandit-1' is a 'bandit', not one the level stands/);
  });
});

describe('a play layer built', () => {
  it('builds the solid pieces in the world\'s colours, turned by their yaw, each a collider; a hazard and a marker no wall', () => {
    const pieces = readPlay(play, G.plan).B.pieces;
    const B = playBuild(pieces, { rock: '#808080', wood: '#806040' });
    expect(B.colliders.map((c) => c.of)).toEqual(['play:B/wagon', 'play:B/crates']);
    // (the barricade turned 90°: its length across y, not x)
    const w = B.colliders[0];
    expect(w.max[1] - w.min[1]).toBeCloseTo(OBSTACLES.barricade.size[0], 2);
    expect(w.max[0] - w.min[0]).toBeCloseTo(OBSTACLES.barricade.size[1], 2);
    // (the cover low: its share of the crate's height)
    expect(B.colliders[1].max[2] - pieces[3].at[2]).toBeCloseTo(OBSTACLES.crate.size[2] * 0.6, 2);
    expect(B.faces.filter((f) => f.group === 'play:obstacle').length).toBe(6);
    expect(new Set(B.faces.map((f) => f.fill.slice(0, 3))).size).toBeGreaterThan(0);
  });

  it('builds them on the map\'s page, its laws holding; and flags a piece the land moved from, with where it fits', async () => {
    const stage = async (m) => ({ faces: [{ corners: [[0, 0, 0], [24, 0, 0], [24, 24, 0], [0, 24, 0]], normal: [0, 0, 1], group: 'isekai:ground', fill: '#7aa04a' }, { corners: [[1, 1, 0], [2, 1, 0], [2, 2, 0]], normal: [0, 0, 1], group: 'isekai:rock', fill: '#9a958a' }], walk: { speed: 6, minEye: 1.7 }, sky: { day: 1 } });
    const level = (pl) => ({ kit: 'isekai-meadow', seed: 5, grid: { tile: g.tile, plan: g.plan, segments: g.segments }, zone: 'B', play: pl });
    const P = await assembleGridScene({ level: level(play) }, {}, { buildStage: stage });
    expect(P.faces.some((f) => f.group === 'play:obstacle' && f.fill.startsWith('#'))).toBe(true);
    expect(P.colliders.filter((c) => /^play:/.test(c.of))).toHaveLength(2);
    expect(P.map.laws.find((l) => l.law === 'pieces-fit')).toMatchObject({ ok: true });
    expect(P.map.play.pieces).toHaveLength(5);
    // (the land raised under the crates: a piece 3 m under it now, flagged, never lost, a spot that fits named)
    const sunk = { B: { pieces: play.B.pieces.map((p) => (p.id === 'crates' ? { ...p, at: [p.at[0], p.at[1], p.at[2] - 3] } : p)) } };
    const F = (await assembleGridScene({ level: level(sunk) }, {}, { buildStage: stage })).map.laws.find((l) => l.law === 'pieces-fit');
    expect(F.ok).toBe(false);
    expect(F.drift).toEqual([expect.objectContaining({ id: 'crates', why: expect.stringMatching(/m off the land/), to: expect.any(Array) })]);
    expect(F.drift[0].to[2]).toBeCloseTo(play.B.pieces[3].at[2], 1);
    // (outside its block: flagged too)
    expect(playLaws([{ id: 'far', kind: 'marker', at: on(10, -10) }], { ground, box: [72, -72, 144, 0] })[0].value).toMatch(/far \(outside its block/);
  });
});

describe('a play layer played', () => {
  it('stands the block\'s foes where they were placed (its encounter marks stood down), and finds its pickup', () => {
    const lv = { seed: 5, grid: { tile: g.tile, plan: g.plan, segments: g.segments }, sketch: { ...g.sketch, segments: { ...g.sketch.segments, B: { ...g.sketch.segments.B, status: 'approved' } } }, play };
    const E = gridEnds({ ...lv, zone: 'B' });
    expect(E.placed.map((p) => p.id)).toEqual(['bandit-1', 'bandit-2']);
    expect(E.encounters ?? []).toEqual([]);
    expect(E.finds.some((f) => f.item === 'supply cache' && f.play)).toBe(true);
    const W = { ...WORLDMAP_SAMPLE, foes: { bandit: { class: 'charger', skin: { people: 'human' } } }, levels: { overworld: { glyphs: { ...g, sketch: lv.sketch, play }, foes: { from: ['bandit'] } } } };
    const M = worldmapGame(W, { ref: 'wm' }), page = M.levels.find((l) => l.zone === 'B').manifest;
    const foes = page.entities.filter((e) => /^foe-bandit/.test(e.id));
    expect(foes).toHaveLength(2);
    expect(foes[0].transform.pos.slice(0, 2)).toEqual(play.B.pieces[0].at.slice(0, 2));
  });
});

describe('a play layer\'s authority', () => {
  it('keeps every must, overrides a should only with its reason, and says when it recasts the scenario\'s foes', () => {
    const block = (sugg, over = [], pieces = play.B.pieces) => readPlay({ B: { pieces, suggestions: sugg, overrides: over } }, G.plan).B;
    const law = (L, id) => L.find((l) => l.law === id);
    // (a must about a kind of piece the block lays: kept)
    expect(law(authorityLaws(block([{ from: 'concept', say: 'cover at the bend', authority: 'must', about: { kind: 'cover' } }])), 'suggestions-kept').ok).toBe(true);
    // (a must it does not keep: refused as a law; overriding a must is refused at the read)
    const noHazard = [{ from: 'concept', say: 'a drop at the barn', authority: 'must', about: { kind: 'hazard' } }];
    expect(law(authorityLaws(block(noHazard)), 'suggestions-kept')).toMatchObject({ ok: false, value: expect.stringMatching(/a must from concept is not kept/) });
    expect(() => block(noHazard, [{ suggestion: 0, why: 'no' }])).toThrow(/is a must .* it is not overridden/);
    // (a should: kept, or overridden with its reason)
    const wolves = [{ from: 'casting', say: 'wolves here', authority: 'should', about: { kind: 'foe', of: 'wolf' } }];
    expect(law(authorityLaws(block(wolves)), 'suggestions-kept').ok).toBe(false);
    expect(law(authorityLaws(block(wolves, [{ suggestion: 0, why: 'bandits fit the road' }])), 'suggestions-kept')).toMatchObject({ ok: true, value: expect.stringMatching(/overridden: bandits fit the road/) });
    // (the casting: two bandits where the scenario named three)
    const C = law(authorityLaws(block([]), { beats: [{ id: 'bend', at: 'B', foes: { bandit: 3 } }], segment: 'B' }), 'casting');
    expect(C).toMatchObject({ ok: true, value: 'level design recast the block: 2 bandit where the scenario named 3 bandit' });
  });
});

// A BLOCK'S BRIEF: everything level design is handed for one block, and what it writes back
import { playBrief } from './play-brief.js';
import { readSketch } from './map-sketch.js';
describe('a block\'s brief', () => {
  it('hands the block\'s square, path, solid things, beats, the hero\'s kit, the roster and the suggestions', () => {
    const K = readSketch(g.sketch, G.plan), page = { colliders: [{ min: [100, -40, 0], max: [101, -39, 3.5], of: 'flora:trunk' }, { min: [10, -10, 0], max: [11, -9, 3], of: 'flora:trunk' }] };
    const B = playBrief({ segment: 'B', G, sketch: K, page, seed: 5, kit: { run: 7, sprint: 9.5, moves: ['strike', 'dodge'] }, roster: { bandit: 'charger' }, block: readPlay(play, G.plan).B });
    expect(B.box).toEqual([72, -72, 144, 0]);
    expect(B.solid).toEqual([{ of: 'flora:trunk', at: [100.5, -39.5], size: [1, 1, 3.5] }]);
    expect(B.beats.map((b) => b.id)).toEqual(K.concept.journey.filter((b) => b.at === 'B').map((b) => b.id));
    for (const want of ['# Level design brief: block B, the fields', 'make this block\'s walk INTERESTING', 'Runs 7 m/s, sprints 9.5 m/s', 'bandit (charger)', '[0] SHOULD from concept', 'What you write back']) expect(B.text).toContain(want);
  });
});
