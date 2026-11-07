import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { readSketch, sketchRise, sketchLaws, sketchStatus, segmentBriefs, briefText, SKETCH } from './map-sketch.js';
import { WORLDMAP_SAMPLE, approveSegment } from '../gameworld/worldmap-bed.js';
import { readGameworld } from '../gameworld/world.js';

// THE MAP SKETCH: a planned map decided in miniature before it is built: the concept and its journey, each segment's
// ground, heights and marks, each planned from its brief and approved on its own.
const g = WORLDMAP_SAMPLE.levels.overworld.glyphs, G = readGrid({ tile: g.tile, plan: g.plan, segments: g.segments }), S = readSketch(g.sketch, G.plan);

describe('a map sketched in miniature', () => {
  it('reads the concept and each segment\'s ground, heights and marks, and says where each segment stands', () => {
    expect(S.concept.journey.map((b) => b.at)).toEqual(['A', 'B', 'B', 'B', 'C', 'D', 'D']);
    expect(S.segments.B).toMatchObject({ status: 'draft', ground: ['mmr', '..r', 'm.c'], marks: [{ kind: 'encounter' }, { kind: 'loot' }] });
    expect(sketchStatus(S, G.plan)).toEqual({ A: 'approved', B: 'draft', C: 'unplanned', D: 'draft' });
    // (a tile's height: its region's rise and its steps; the keep's gate tile 4 m up, its temple a step over it)
    const R = sketchRise(G, S), z = (r, c) => R.z[r * G.cols + c];
    expect(z(3, 4)).toBe(4); expect(z(4, 4)).toBe(4 + SKETCH.step);
    // (no sketch: the grid's own rise)
    expect(sketchRise(G, null)).toBe(G.rise);
  });

  it('refuses a malformed sketch with words', () => {
    const bad = (sk, re) => expect(() => readSketch(sk, G.plan)).toThrow(re);
    bad({ concept: { journey: [{ id: 'a', say: 'x', kind: 'dance', at: 'A' }] } }, /kind is arrival/);
    bad({ concept: { journey: [{ id: 'a', say: 'x', kind: 'arrival', at: 'Q' }] } }, /at is a segment/);
    bad({ segments: { B: { ground: ['m m', 'm m'] } } }, /3 rows of 3/);
    bad({ segments: { B: { ground: ['m m z', '. . .', '. . .'] } } }, /'z' is not a ground/);
    bad({ segments: { B: { height: ['0 0 x', '0 0 0', '0 0 0'] } } }, /a digit 0 to 9/);
    bad({ segments: { B: { marks: [{ at: [5, 0], kind: 'loot', say: 'x' }] } } }, /a tile of the segment/);
    bad({ segments: { B: { marks: [{ at: [0, 0], kind: 'treasure', say: 'x' }] } } }, /kind is encounter/);
    bad({ segments: { Q: {} } }, /no such segment/);
    // (a gameworld's own read)
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, levels: { overworld: { glyphs: { ...g, sketch: { segments: { B: { status: 'done' } } } } } } })).toThrow(/status is draft or approved/);
  });

  it('advises: the journey covered and in order, a climb a step at a time, each gate\'s sides within a step, no path on water', () => {
    const law = (L, id) => L.find((l) => l.law === id);
    const L = sketchLaws(G, S);
    expect(law(L, 'journey-covers').ok).toBe(true);
    expect(law(L, 'journey-follows').ok).toBe(true);
    // (the woods are not yet planned: their east gate at the land's 0 m, the keep's across it 4 m up)
    expect(law(L, 'gate-heights')).toMatchObject({ ok: false, value: expect.stringMatching(/C–D/) });
    expect(law(L, 'ground-walkable').ok).toBe(true);
    // (water on the fields' road)
    const wet = readSketch({ ...g.sketch, segments: { ...g.sketch.segments, B: { ...g.sketch.segments.B, ground: ['m m r', 'w . r', 'm . c'] } } }, G.plan);
    expect(law(sketchLaws(G, wet), 'ground-walkable')).toMatchObject({ ok: false, value: expect.stringMatching(/B row 2 column 1/) });
    // (the beats staged: the sample's sketched segments each mark what its beats need)
    expect(law(L, 'beats-marked')).toMatchObject({ ok: true, value: expect.stringMatching(/3 sketched segments/) });
    const unmarked = readSketch({ ...g.sketch, segments: { ...g.sketch.segments, B: { ...g.sketch.segments.B, marks: g.sketch.segments.B.marks.filter((m) => m.kind !== 'encounter') } } }, G.plan);
    expect(law(sketchLaws(G, unmarked), 'beats-marked')).toMatchObject({ ok: false, value: expect.stringMatching(/B: 'Bandits spring an ambush.*wants an encounter mark/) });
    // (a beat back along the walk)
    const back = readSketch({ concept: { journey: [{ id: 'a', say: 'x', kind: 'arrival', at: 'B' }, { id: 'b', say: 'y', kind: 'traverse', at: 'A' }] } }, G.plan);
    expect(law(sketchLaws(G, back), 'journey-follows').ok).toBe(false);
  });

  it('chops the map into a subtask a segment: its beats, its paths, its gates and the ground across each', () => {
    const B = segmentBriefs(G, S, { title: 'Four' });
    expect(Object.keys(B)).toEqual(['A', 'B', 'C', 'D']);
    expect(B.C).toMatchObject({ role: 'pocket', beats: [{ id: 'shrine' }], rows: ['. # .', '. # #', '. . .'], current: null });
    expect(B.C.gates.map((x) => [x.side, x.to, x.neighbourHeight])).toEqual([['north', 'A', 0], ['east', 'D', 4]]);
    expect(B.B).toMatchObject({ before: 'A', after: 'D', current: { status: 'draft' } });
    expect(briefText(B.C)).toMatch(/to the keep \(a join\); the neighbour's ground across it stands 4 m up/);
  });

  it('is approved a segment at a time', () => {
    const W = approveSegment(WORLDMAP_SAMPLE, 'B');
    expect(readSketch(W.levels.overworld.glyphs.sketch, G.plan).segments.B.status).toBe('approved');
    expect(WORLDMAP_SAMPLE.levels.overworld.glyphs.sketch.segments.B.status).toBe('draft');
    expect(() => approveSegment(WORLDMAP_SAMPLE, 'C')).toThrow(/no sketch to approve/);
  });
});

// THE GEOCUBE OF A SEGMENT: only an approved segment's sketch is lowered into the build: its heights into the land, its
// ground into the tiles' flora, its marks onto the page; a draft builds as the plan alone.
import { levelGrid, SKETCH_BIOCUBE } from './map-sketch.js';
import { assembleGridScene } from './grid-scene.js';
describe('a sketched segment built', () => {
  const level = (sketch) => ({ kit: 'isekai-meadow', seed: 5, grid: { tile: g.tile, plan: g.plan, segments: g.segments }, sketch, zone: 'A' });
  const T = g.tile, seen = [];
  const tileStage = async (m) => { seen.push(m); return { faces: [{ corners: [[0, 0, 0], [T, 0, 0], [T, T, 0], [0, T, 0]], normal: [0, 0, 1], group: 'isekai:ground', fill: '#7aa04a' }], walk: { speed: 6, minEye: 1.7 }, sky: { day: 1 } }; };

  it('lowers the approved segments only: their heights, their ground, their marks', async () => {
    // (the sample: the town approved, the fields and the keep drafts)
    const L = levelGrid(level(g.sketch));
    expect(L.sketch.approved).toEqual(['A']);
    expect(L.sketch.laid).toEqual({ height: 9, ground: 5, boulders: 0, marks: 2 });
    // (the town's corner tile a step up; the fields, a draft, at its region's rise alone)
    expect(L.rise.z[2 * G.cols + 0]).toBe(SKETCH.step);
    expect(L.rise.z[0 * G.cols + 4]).toBe(G.rise.z[0 * G.cols + 4]);
    seen.length = 0;
    const P = await assembleGridScene({ level: level(g.sketch) }, {}, { buildStage: tileStage });
    // (the town's meadow tile built with the meadow's flora; a draft's tile with none of the sketch's)
    const tileAt = (r, c) => seen.find((m) => m.tile.origin[0] === c * T && m.tile.origin[1] === -(r + 1) * T);
    expect(tileAt(0, 0).biocube).toBe(SKETCH_BIOCUBE.m);
    expect(tileAt(0, 2).biocube).toBe(SKETCH_BIOCUBE.g);
    expect(tileAt(0, 3).biocube).toBeUndefined();
    expect(tileAt(0, 2).tile.level.rise.z[2 * G.cols]).toBe(SKETCH.step);
    // (its marks on the page, each a post and a tooltip)
    expect(P.map.sketch.marks.map((m) => m.kind)).toEqual(['npc', 'rest']);
    expect(P.signs.map((s) => s.text)).toEqual(['npc: The captain sends you out', 'rest: Home: save here']);
    expect(P.faces.filter((f) => f.group === 'map:mark')).toHaveLength(2 * 10);
    for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
  });

  it('builds a level with no approved segment as the plan alone, byte for byte', async () => {
    const drafts = { ...g.sketch, segments: { ...g.sketch.segments, A: { ...g.sketch.segments.A, status: 'draft' } } };
    expect(levelGrid(level(drafts)).sketch).toBeUndefined();
    const { sketch: _s, ...bare } = level(drafts);
    const [a, b] = await Promise.all([assembleGridScene({ level: level(drafts) }, {}, { buildStage: tileStage }), assembleGridScene({ level: bare }, {}, { buildStage: tileStage })]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('says what it could not lay: a cliff, water, rocks off the path', () => {
    const wet = { ...g.sketch, segments: { ...g.sketch.segments, B: { ...g.sketch.segments.B, status: 'approved' } } };
    expect(levelGrid(level(wet)).sketch.unlaid.map((u) => u.says)).toEqual(['B row 1 column 3: rocks off the path (boulders are laid along a path)', 'B row 2 column 3: rocks off the path (boulders are laid along a path)', 'B row 3 column 3: cliff']);
  });
});
