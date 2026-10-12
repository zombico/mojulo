import { describe, it, expect } from 'vitest';
import { outTrailOf } from './out-trail-board.js';
import { outTrailLaws, outTrailSpan, OUT_TRAIL } from './out-trail.js';
import { readGround, groundOf, editField, BEAT_SHAPES } from './out-ground.js';

// A trail's ground as dials and edits (out-ground.js): absent, the card's own to the byte; tuned, the heartbeat climbs
// by its amplitude and falls by its depth; edited, the ground moves where the edit stands and the walk goes with it
// unless it keeps its height.
const site = (trail, seed = 5) => outTrailOf({ kit: 'isekai-meadow', seed, trail }).site;
const range = (a) => { let lo = Infinity, hi = -Infinity; for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
// a place off the walk on the open side, well clear of the far cliff
const openSpot = (S, y) => [Math.min(S.W - 4, S.trailX(y) + 12), y];

describe('the ground dials', () => {
  it('an empty ground builds the card\'s trail, cell for cell', () => {
    const a = site({ run: 14, heartbeat: 0.6 }), b = site({ run: 14, heartbeat: 0.6, ground: {} });
    expect(Buffer.from(b.grid.z.buffer).equals(Buffer.from(a.grid.z.buffer))).toBe(true);
    expect(b.out.plan.profile.smoothed).toEqual(a.out.plan.profile.smoothed);
  });

  it('the dials left out are the card\'s; amplitude and depth stand in for the heartbeat up and down', () => {
    const C = OUT_TRAIL, T = { heartbeat: 0.5, bumpiness: 0.4 };
    const g = groundOf(T, C);
    expect(g).toMatchObject({ A: 3.5, Dp: 3.5, grade: C.grade, drift: 0.3, B: 0.4 * C.bump.m, bumpScale: 1, bumpWalk: C.bump.walk, edits: [] });
    expect(g.shapes.pinch).toEqual(BEAT_SHAPES.pinch);
    expect(groundOf({ ...T, ground: { amplitude: 10 } }, C)).toMatchObject({ A: 10, Dp: 10 });
    expect(groundOf({ ...T, ground: { amplitude: 10, depth: 2, shapes: { pinch: { share: 1 } } } }, C)).toMatchObject({ A: 10, Dp: 2, shapes: { pinch: { share: 1, reach: 6 } } });
  });

  it('a bigger amplitude climbs higher; a shallower depth dips less', () => {
    const beats = ['landmark', 'pinch', 'reveal', 'crossing', 'pocket'];
    const [lo0, hi0] = range(site({ run: 16, beats }).out.plan.profile.rough);
    const [lo1, hi1] = range(site({ run: 16, beats, ground: { amplitude: 14 } }).out.plan.profile.rough);
    const [lo2] = range(site({ run: 16, beats, ground: { amplitude: 14, depth: 0 } }).out.plan.profile.rough);
    expect(hi1 - lo1).toBeGreaterThan(1.5 * (hi0 - lo0));
    expect(lo2).toBeGreaterThan(lo1);
  });

  it('a grade is the stairs\' threshold, and the grade law reads the trail\'s own', () => {
    const steep = { run: 16, heartbeat: 1 }, a = site(steep), b = site({ ...steep, ground: { grade: 0.6 } });
    expect(b.out.plan.stairs.length).toBeLessThanOrEqual(a.out.plan.stairs.length);
    expect(outTrailLaws(b).find((l) => l.law === 'grade').want).toMatch(/0\.6/);
  });

  it('teaches what is wrong', () => {
    expect(() => readGround({ amplitud: 3 })).toThrow(/amplitud is not a ground dial/);
    expect(() => readGround({ depth: 90 })).toThrow(/depth is metres/);
    expect(() => readGround({ shapes: { pit: {} } })).toThrow(/shapes.pit is not a shapes setting/);
    expect(() => readGround({ edits: [{ op: 'raise', at: [1, 2] }] })).toThrow(/height is metres/);
    expect(() => readGround({ edits: [{ op: 'cliff', path: [[0, 0], [1, 1]], height: 3 }] })).toThrow(/side is the high side/);
    expect(() => readGround({ edits: [{ op: 'carve', at: [0, 0] }] })).toThrow(/op one of raise, lower, flatten, cliff, gorge, ridge/);
  });
});

describe('the ground edits', () => {
  it('a raise lifts the ground where it stands by its height, and nothing far off', () => {
    const base = site({ run: 14 }), [x, y] = openSpot(base, 50);
    const S = site({ run: 14, ground: { edits: [{ op: 'raise', at: [x, y], size: [4, 4], height: 5, walk: 'keep' }] } });
    expect(S.ground(x, y) - base.ground(x, y)).toBeCloseTo(5, 1);
    expect(S.ground(x, y + 30)).toBeCloseTo(base.ground(x, y + 30), 6);
  });

  it('a cliff lifts its high side and not its low one; a gorge cuts its floor by its depth', () => {
    const base = site({ run: 14 }), y = 60, x = openSpot(base, y)[0];
    const cliff = editField({ op: 'cliff', path: [[x - 6, y], [x + 6, y]], height: 6, side: 'left', face: 70, reach: 14 });
    expect(cliff(x, y + 5)).toBeCloseTo(6, 1);    // walking +x, left is +y
    expect(cliff(x, y - 5)).toBeCloseTo(0, 6);
    expect(cliff(x, y + 40)).toBeCloseTo(0, 6);   // the high side eases down past its reach
    const gorge = editField({ op: 'gorge', path: [[x - 6, y], [x + 6, y]], depth: 4, width: 4, wall: 65 });
    expect(gorge(x, y)).toBeCloseTo(-4, 6);
    expect(gorge(x, y + 10)).toBeCloseTo(0, 6);
  });

  it('a gorge across the walk takes the walk down with it (stairs follow); kept, the walk holds its height', () => {
    const base = site({ run: 16, beats: ['landmark', 'pocket', 'reveal'] }), y = 40, L = base.trailX(y);
    const cut = (walk) => ({ run: 16, beats: ['landmark', 'pocket', 'reveal'], ground: { edits: [{ op: 'gorge', path: [[L - 20, y], [L + 20, y]], depth: 5, width: 6, walk }] } });
    const follow = site(cut('follow')), keep = site(cut('keep'));
    const at = (S) => S.out.plan.smoothAt(S.out.plan.sOf(y));
    expect(at(follow)).toBeLessThan(at(base) - 2);
    expect(at(keep)).toBeCloseTo(at(base), 6);
    expect(follow.ground(L, y)).toBeLessThan(base.ground(L, y) - 2);
    expect(keep.ground(L, y)).toBeCloseTo(base.ground(L, y), 1);
    expect(follow.out.plan.stairs.length).toBeGreaterThan(base.out.plan.stairs.length);
    // off the walk, both cut the same
    expect(keep.ground(L + 14, y)).toBeCloseTo(follow.ground(L + 14, y), 6);
  });

  it('a flatten lays its place at the walk\'s height', () => {
    const base = site({ run: 14, bumpiness: 1 }), [x, y] = openSpot(base, 50);
    const S = site({ run: 14, bumpiness: 1, ground: { edits: [{ op: 'flatten', at: [x, y], size: [6, 6] }] } });
    const walk = S.out.plan.smoothAt(S.out.plan.sOf(y));
    for (const [dx, dy] of [[0, 0], [2, 2], [-2, 1]]) expect(S.ground(x + dx, y + dy)).toBeCloseTo(walk, 1);
  });

  it('the ground never moves the spine: a span is its built site\'s', () => {
    const recipe = { run: 18, heartbeat: 0.9, ground: { amplitude: 12, edits: [{ op: 'ridge', path: [[10, 10], [10, 80]], height: 4 }] } };
    const S = site(recipe, 9), { st } = outTrailOf({ kit: 'isekai-meadow', seed: 9, trail: recipe }), sp = outTrailSpan(st, recipe, 9);
    expect(sp.D).toBe(S.D);
    expect(sp.x).toBeCloseTo(S.trailX(S.D), 9);
  });
});
