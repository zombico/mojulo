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
