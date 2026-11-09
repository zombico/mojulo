import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { readSketch, sketchLaws, beatTile } from './map-sketch.js';
import { paceOf, paceLaws, PACE } from './pace.js';
import { gridEnds } from './grid-ends.js';
import { guideOf } from './guide.js';
import { zoneOf } from './zones.js';
import { WORLDMAP_SAMPLE, worldmapGame } from '../gameworld/worldmap-bed.js';

// THE SCENARIO: a level beat by beat, each beat whole in one place (its tile, its foes or its find, what it teaches, how
// it feels, whether it opens the page), read into the concept and a mark per beat; its pace measured on the map's paths.
const g = WORLDMAP_SAMPLE.levels.overworld.glyphs, G = readGrid({ tile: g.tile, plan: g.plan, segments: g.segments });
const scenario = {
  pitch: 'Reach the old keep.',
  beats: [
    { id: 'set-out', at: 'A', kind: 'arrival', say: 'The keep on the skyline', teach: 'look', faces: 'warden', pace: 'calm' },
    { id: 'reeve', at: 'A', tile: [1, 0], kind: 'meet', say: 'The reeve: east, then up to the keep', pace: 'calm' },
    { id: 'lone', at: 'A', tile: [1, 2], kind: 'fight', say: 'A lone bandit', foes: { bandit: 1 }, teach: 'strike', pace: 'tension' },
    { id: 'bend', at: 'B', tile: [1, 1], kind: 'fight', say: 'Three bandits hold the bend', foes: { bandit: 3 }, teach: ['lock', 'dodge'], pace: 'peak', opens: true },
    { id: 'barn', at: 'B', tile: [2, 2], kind: 'find', say: 'The barn', item: 'supply cache', pace: 'rest' },
    { id: 'warden', at: 'D', tile: [1, 1], kind: 'climax', say: 'The warden', foes: { warden: 1 }, pace: 'peak' },
  ],
};
const approved = { A: { status: 'approved' }, B: { status: 'approved' } };
const K = readSketch({ scenario, segments: approved }, G.plan);
const law = (L, id) => L.find((l) => l.law === id);

describe('a scenario read', () => {
  it('is the concept and a mark per beat on its tile, each mark its beat\'s, nothing paired by kind or order', () => {
    expect(K.concept.journey.map((b) => [b.id, b.kind, b.pace])).toEqual([['set-out', 'arrival', 'calm'], ['reeve', 'meet', 'calm'], ['lone', 'encounter', 'tension'], ['bend', 'encounter', 'peak'], ['barn', 'find', 'rest'], ['warden', 'climax', 'peak']]);
    expect(K.concept.hold).toBe(true);
    expect(K.segments.B.marks).toEqual([
      { at: [1, 1], kind: 'encounter', say: 'Three bandits hold the bend', beat: 'bend', foes: { kind: 'bandit', count: 3 } },
      { at: [2, 2], kind: 'loot', say: 'The barn', beat: 'barn', item: 'supply cache' },
    ]);
    // (a segment the scenario stands beats on that the sketch has not drawn: a draft holding them)
    expect(K.segments.D).toMatchObject({ status: 'draft', marks: [{ beat: 'warden', foes: { kind: 'warden', count: 1 } }] });
    expect(beatTile(G, K, K.concept.journey.find((b) => b.id === 'barn'))).toEqual([2, 5]);
  });

  it('refuses a beat that is not whole: a fight without foes, a find off a tile, opens without a fight, both a scenario and a concept', () => {
    const bad = (b, re) => expect(() => readSketch({ scenario: { beats: [b] } }, G.plan)).toThrow(re);
    bad({ id: 'a', at: 'A', kind: 'fight', say: 'x', tile: [0, 0] }, /is a fight: its foes/);
    bad({ id: 'a', at: 'A', kind: 'find', say: 'x', item: 'y' }, /a find stands on a tile/);
    bad({ id: 'a', at: 'A', kind: 'traverse', say: 'x', opens: true }, /opens is true on a beat with foes/);
    bad({ id: 'a', at: 'A', kind: 'traverse', say: 'x', pace: 'frantic' }, /pace is calm, tension, peak, rest/);
    bad({ id: 'a', at: 'A', kind: 'dance', say: 'x' }, /kind is arrival, vista, meet, fight/);
    expect(() => readSketch({ scenario, concept: { journey: [] } }, G.plan)).toThrow(/a scenario or as a concept, not both/);
  });
});

describe('a scenario\'s pace', () => {
  it('walks each beat from the last on the map\'s paths, at the run: each segment\'s beats a minute, the longest gap', () => {
    const P = paceOf(G, K, beatTile);
    expect(P.beats[0]).toMatchObject({ id: 'set-out', metres: 0 });
    // (the reeve at the town square's house: its path tile the square's, a tile from the start; the bandit a tile east of it)
    expect(P.beats.map((b) => b.metres)).toEqual(P.beats.map((b) => expect.any(Number)));
    expect(P.beats.find((b) => b.id === 'lone').seconds).toBeCloseTo(P.beats.find((b) => b.id === 'lone').metres / PACE.run, 1);
    expect(P.segments.A.beats).toBe(3);
    expect(P.longest.seconds).toBe(Math.max(...P.beats.map((b) => b.seconds)));
    const L = paceLaws(P);
    expect(law(L, 'pace-shape')).toMatchObject({ ok: true, value: 'calm · calm · tension · peak · rest · peak' });
    expect(law(L, 'dead-air').ok).toBe(law(L, 'dead-air').value.includes(`${P.longest.seconds} s`) && P.longest.seconds <= PACE.deadAir);
    // (the sketch's laws carry them)
    expect(sketchLaws(G, K).map((l) => l.law)).toEqual(expect.arrayContaining(['dead-air', 'pace-shape', 'segment-interest']));
  });

  it('says when a peak has no breath after it, nothing builds to it, the walk ends flat, or a segment is empty', () => {
    const shaped = (paces) => paceLaws({ ...paceOf(G, K, beatTile), beats: paces.map((pace, i) => ({ id: `b${i}`, pace, seconds: 5 })) });
    expect(law(shaped(['calm', 'peak', 'peak']), 'pace-shape').value).toMatch(/no tension before it.*'b1' \(a peak\) is followed by peak/);
    expect(law(shaped(['calm', 'tension', 'peak', 'calm']), 'pace-shape').value).toMatch(/ends on calm, not its peak/);
    // (the fields with one beat over a long walk: too little happens there)
    const P = paceOf(G, K, beatTile);
    expect(law(paceLaws({ ...P, segments: { ...P.segments, B: { beats: 1, seconds: 90, perMinute: 0.7 } } }), 'segment-interest')).toMatchObject({ ok: false, value: expect.stringMatching(/too little happens in B \(1 beat over 90 s\)/) });
  });
});

describe('a scenario played', () => {
  it('says each beat\'s line on reaching it and finds into the bag where its beat stands', () => {
    const lv = { seed: 5, grid: { tile: g.tile, plan: g.plan, segments: g.segments }, sketch: { scenario, segments: approved } };
    const D = guideOf(lv, G, zoneOf(G, ['A', 'B'], { seed: 5 }), { seed: 5 });
    expect(D.steps.find((s) => s.id === 'reeve').says).toBe('The reeve: east, then up to the keep');
    expect(D.steps.find((s) => s.id === 'barn').says).toBe('Found: supply cache');
    expect(D.steps.find((s) => s.id === 'lone').at.slice(0, 2)).toEqual([60, -36]);
    expect(gridEnds({ ...lv, zone: ['A', 'B'] }).finds).toEqual([expect.objectContaining({ item: 'supply cache', beat: 'barn', tile: [2, 5] })]);
    // (a game of it: the page's pickup, its bag, its foes of both fights)
    const W = { ...WORLDMAP_SAMPLE, foes: { bandit: { class: 'charger', skin: { people: 'human' } } }, levels: { overworld: { glyphs: { ...g, zoned: [['A', 'B']], sketch: { scenario, segments: approved } }, foes: { from: ['bandit'] } } } };
    const M = worldmapGame(W, { ref: 'wm' }), AB = M.levels.find((l) => Array.isArray(l.zone)).manifest;
    expect(AB.game.mechanics.find((m) => m.kind === 'collect')).toMatchObject({ into: 'bag', pickups: [{ item: 'supply cache' }] });
    expect(AB.game.mechanics.filter((m) => m.kind === 'reach-exit' && m.exit).map((m) => m.holds?.count ?? null)).toEqual([4, 4]);
  });
});
