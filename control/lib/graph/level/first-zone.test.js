import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { readSketch, sketchLaws, TEACH } from './map-sketch.js';
import { firstZone } from './first-zone.js';
import { gridEnds } from './grid-ends.js';
import { guideOf } from './guide.js';
import { zoneOf } from './zones.js';
import { lowerMechanic } from '../game/mechanics.js';
import { WORLDMAP_SAMPLE } from '../gameworld/worldmap-bed.js';

// AN ACTION QUEST'S FIRST ZONE: the journey in teaching order (the first look, the lone foe, the traverse, the pack, the
// climb, the climax), the controls taught where first needed, the first page left by winning it.
const g = WORLDMAP_SAMPLE.levels.overworld.glyphs, G = readGrid({ tile: g.tile, plan: g.plan, segments: g.segments });
const Z = firstZone(g.plan, { foe: 'bandit', pitch: 'Reach the old keep.' });
// (each fight's mark where its segment's way runs: the town's east arm, the fields' middle)
const marked = (counts = [1, 3], heights = {}) => ({
  concept: Z.concept,
  segments: {
    A: { status: 'approved', marks: [{ at: [1, 2], kind: 'encounter', say: 'a lone bandit', foes: { kind: 'bandit', count: counts[0] } }], ...(heights.A ? { height: heights.A } : {}) },
    B: { status: 'approved', marks: [{ at: [1, 1], kind: 'encounter', say: 'the pack', foes: { kind: 'bandit', count: counts[1] } }], ...(heights.B ? { height: heights.B } : {}) },
    ...(heights.C ? { C: { status: 'draft', height: heights.C } } : {}),
  },
});
const law = (L, id) => L.find((l) => l.law === id);

describe('a first zone laid', () => {
  it('lays the journey in teaching order, each fight\'s marks wanted, its pages held', () => {
    expect(Z.concept.journey.map((b) => [b.id, b.kind, b.at, (b.teach ?? []).join('+')])).toEqual([
      ['set-out', 'arrival', 'A', 'look'], ['lone-foe', 'encounter', 'A', 'strike'], ['cross', 'traverse', 'B', 'sprint'],
      ['pack', 'encounter', 'B', 'lock+dodge'], ['climb', 'climb', 'D', ''], ['climax', 'climax', 'D', ''], ['secret-c', 'secret', 'C', ''],
    ]);
    expect(Z.concept).toMatchObject({ hold: true, pitch: 'Reach the old keep.' });
    expect(Z.concept.journey[0]).toMatchObject({ faces: 'climax', say: 'Set out from the town: the keep stands on the skyline' });
    expect(Z.concept.journey[3].say).toBe('3 bandits hold the fields');
    expect(Z.wants).toEqual({ A: [{ kind: 'encounter', foes: { count: 1, kind: 'bandit' }, for: 'lone-foe' }], B: [{ kind: 'encounter', foes: { count: 3, kind: 'bandit' }, for: 'pack' }] });
    expect(() => firstZone({ ...g.plan, route: ['A'] })).toThrow(/two segments at least/);
  });

  it('holds its laws as laid: what a fight asks is taught before it, one foe first, the goal seen from the start', () => {
    const L = sketchLaws(G, readSketch(marked(), G.plan));
    for (const id of ['teaches-before-tests', 'foes-ramp', 'first-look', 'beats-marked']) expect(law(L, id).ok, `${id}: ${law(L, id).value}`).toBe(true);
    expect(law(L, 'first-look').value).toMatch(/facing 'the keep: what the journey is for'/);
  });

  it('says when the pack comes first, a fight comes before its lesson, or the goal is hidden from the start', () => {
    const ramp = law(sketchLaws(G, readSketch(marked([3, 1]), G.plan)), 'foes-ramp');
    expect(ramp).toMatchObject({ ok: false, value: expect.stringMatching(/is 3 foes: one first, alone/) });
    // (the lock taught after the pack it is needed for)
    const late = { ...marked(), concept: { ...Z.concept, journey: Z.concept.journey.map((b) => (b.id === 'pack' ? { ...b, teach: ['dodge'] } : b)) } };
    expect(law(sketchLaws(G, readSketch(late, G.plan)), 'teaches-before-tests')).toMatchObject({ ok: false, value: expect.stringMatching(/3 bandits hold the fields' \(3 foes\) comes before the lock-on/) });
    // (a ridge in the woods, the line from the town's start to the keep crossing it)
    const hid = law(sketchLaws(G, readSketch(marked([1, 3], { C: ['9 9 9', '9 9 9', '9 9 9'] }), G.plan)), 'first-look');
    expect(hid).toMatchObject({ ok: false, value: expect.stringMatching(/hidden from the start behind row \d column \d/) });
    // (no teaching, no arrival facing: none of these laws)
    const plain = readSketch({ concept: { journey: [{ id: 'a', say: 'x', kind: 'arrival', at: 'A' }] } }, G.plan);
    expect(sketchLaws(G, plain).map((l) => l.law)).not.toContain('first-look');
  });

  it('refuses a teach that is no verb, a face that is no beat, a hold that is not true', () => {
    const bad = (j, re, more = {}) => expect(() => readSketch({ concept: { journey: j, ...more } }, G.plan)).toThrow(re);
    bad([{ id: 'a', say: 'x', kind: 'arrival', at: 'A', teach: 'parry' }], /teach is a verb the hero learns here \(look, strike/);
    bad([{ id: 'a', say: 'x', kind: 'arrival', at: 'A', faces: 'nowhere' }], /faces 'nowhere' is no other beat/);
    bad([{ id: 'a', say: 'x', kind: 'traverse', at: 'A', faces: 'a' }], /faces is an arrival's/);
    bad([{ id: 'a', say: 'x', kind: 'arrival', at: 'A' }], /hold is true/, { hold: 'yes' });
  });
});

describe('a first zone played', () => {
  const lv = (sk = marked()) => ({ seed: 5, grid: { tile: g.tile, plan: g.plan, segments: g.segments }, sketch: sk });
  it('sets out facing the goal: the first look', () => {
    const E = gridEnds(lv()), plain = gridEnds({ ...lv(), sketch: { ...marked(), concept: { ...Z.concept, journey: Z.concept.journey.map(({ faces: _f, ...b }) => b) } } });
    // (the keep's temple, the walk's goal: south-east of the town's start)
    const [gr, gc] = [4, 4], want = Math.atan2(-(gr + 0.5) * g.tile - E.spawn[1], (gc + 0.5) * g.tile - E.spawn[0]);
    expect(E.heading).toBeCloseTo(want, 2);
    expect(plain.heading).not.toBeCloseTo(want, 2);
  });

  it('shows each beat\'s keys while it is the way on, and the page\'s ways held while it fights', () => {
    const Gs = readGrid({ tile: g.tile, plan: g.plan, segments: g.segments }), page = zoneOf(Gs, ['A', 'B'], { seed: 5 });
    const D = guideOf(lv(), Gs, page, { seed: 5 });
    expect(D.steps.map((s) => [s.id, s.keys ?? null])).toEqual([['lone-foe', [TEACH.strike.keys]], ['cross', [TEACH.sprint.keys]], ['pack', [TEACH.lock.keys, TEACH.dodge.keys]]]);
    expect(D.held).toEqual(page.ways.map((w) => w.exit.map((v) => Math.round(v * 1000) / 1000 + 0)));
    // (the woods hold no fight: nothing held there)
    expect(guideOf(lv(), Gs, zoneOf(Gs, 'C', { seed: 5 }), { seed: 5 }).held).toBeUndefined();
  });

  it('holds a way until its foes are down: the downs counted, the way open at the count', () => {
    const M = lowerMechanic('reach-exit', { at: [1, 2, 0], exit: 'gate-s', holds: { count: 4 } }, { i: 3 });
    expect(M.world.vars).toEqual({ __held_3: 0 });
    expect(M.world.reactions[0]).toEqual({ on: 'down', match: { entity: 'foe-*' }, do: 'inc', var: '__held_3', by: 1 });
    expect(M.world.reactions[1]).toMatchObject({ on: 'enter', type: 'goal:reached:gate-s', if: { var: '__held_3', gte: 4 } });
    // (absent: the way as it was)
    expect(lowerMechanic('reach-exit', { at: [1, 2, 0], exit: 'gate-s' }, { i: 3 }).world.vars).toBeUndefined();
  });
});
