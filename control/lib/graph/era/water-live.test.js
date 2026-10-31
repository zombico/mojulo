// A trail's water drawn as it moves (water-live.js): out-water.js's plan lowered onto the page's own live water, the
// landscape views' (a river on the surface channel, a sheet jet into a shallows pond), by a gen-7 read on the page
// alone (worlds/world-scene.js); every other read keeps the painted water, to the byte.
import { describe, expect, it } from 'vitest';
import { lowerWaterworks, LIVE } from './water-live.js';
import { outTrailOf } from './out-trail-board.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const planOf = (water) => outTrailOf({ kit: 'isekai-meadow', seed: 5, trail: { run: 14, ground: { water } } }).site.water.plan;

describe('the water lowered live', () => {
  it('a river: the surface channel\'s river along its line, its current as fast as its bed falls, in the river look', () => {
    const [P] = planOf({ river: true }), W = lowerWaterworks([P]), [S] = W.surfaces;
    expect(W.drawn).toEqual(['river-1']);
    expect(S.river.pts).toEqual(P.line);
    expect(S.river.half).toBe(P.half);
    expect(S.river.bank).toBeGreaterThan(S.river.half);
    expect(S.aqua.kind).toBe('river');
    expect(S.noLights).toBe(true);
    // (the current from the fall per metre: the slowest on the level, faster on a steeper bed, never past the fastest)
    const flow = (fall) => lowerWaterworks([{ ...P, fall }]).surfaces[0].river.flow;
    expect(flow(0)).toBeCloseTo(LIVE.flow.min, 4);
    expect(flow(P.length * LIVE.flow.steep / 2)).toBeGreaterThan(flow(0));
    expect(flow(P.length)).toBeCloseTo(LIVE.flow.max, 4);
    // (its grid covers its line and its banks)
    const xs = P.line.map((p) => p[0]);
    expect(S.grid.cx - S.grid.w / 2).toBeLessThan(Math.min(...xs) - P.half);
    expect(S.grid.cx + S.grid.w / 2).toBeGreaterThan(Math.max(...xs) + P.half);
  });

  it('the falls: a sheet off its lip into its pool, a pond in the pool\'s own bed; the brook a river', () => {
    const [P] = planOf({ falls: true }), W = lowerWaterworks([P]), [J] = W.jets, [pond] = W.shallows.bodies;
    expect(W.drawn).toEqual(['falls-1']);
    expect(J).toMatchObject({ shape: 'sheet', width: P.width, into: pond.id, dir: P.dir });
    expect(J.at[0]).toBeCloseTo(P.lip[0], 3);
    expect(J.at[2]).toBeGreaterThan(P.lip[2]);
    expect(pond.level).toBeCloseTo(P.pool.at[2], 4);
    expect(pond.bed.depth.length).toBe(P.pool.bed.depth.length);
    pond.bed.depth.forEach((d, i) => expect(d).toBeCloseTo(P.pool.bed.depth[i], 3));
    expect(W.surfaces.map((s) => s.river.pts)).toEqual([P.brook.line]);
  });

  it('a lake: still water, a pond in its own bed as dark with depth as the river, its leaves on it; no surface', () => {
    const [P] = planOf({ lake: true }), W = lowerWaterworks([P]), [pond] = W.shallows.bodies;
    expect(W.drawn).toEqual(['lake-1']);
    expect(W.surfaces).toBeUndefined();
    expect(pond).toMatchObject({ id: 'lake-1', kind: 'pond' });
    expect(pond.level).toBeCloseTo(P.pool.at[2], 4);
    expect(pond.look.sigma).toEqual(LIVE.absorb.map((v) => expect.closeTo(v, 4)));
    expect(W.shallows.floaters).toEqual(P.pool.floaters);
  });

  it('nothing to draw: nothing', () => {
    expect(lowerWaterworks([])).toBeNull();
    expect(lowerWaterworks([{ id: 'x', form: 'lake' }])).toBeNull();
  });
});

describe('the gate: a gen-7 read on the page draws it, every other read keeps the painted water', () => {
  const manifest = { kind: 'stage', geocube: 'valley-morning', trail: { run: 14, ground: { water: { river: true, falls: true, lake: true } } } };
  const read = async (opts) => (await resolveWorldScene({ ref: 'water-live', title: 'water live', manifest }, opts)).payload;

  it('gen-7: the river, the falls and the lake live, their painted faces gone; the plan and its tags never on a page', async () => {
    const P = await read({ era: 'gen-7' }), six = await read({ era: 'gen-6' }), paint = await read({ era: 'gen-7', paint: true });
    expect(P.surfaces.length).toBe(2);
    expect(P.jets.length).toBe(1);
    expect(P.shallows.bodies.map((b) => b.id).sort()).toEqual(['falls-1:pool', 'lake-1']);
    // (what it drew live is out of the faces; the crossing's stream, not in the plan, stays painted)
    expect(P.faces.filter((f) => f.water).length).toBeLessThan(six.faces.filter((f) => f.water).length);
    for (const Q of [P, six, paint]) {
      expect(Q.waterworks).toBeUndefined();
      expect(Q.faces.some((f) => f.waterBody)).toBe(false);
    }
    // (gen-6 and an export: the painted water, no live water at all)
    for (const Q of [six, paint]) { expect(Q.surfaces).toBeUndefined(); expect(Q.jets).toBeUndefined(); expect(Q.shallows).toBeUndefined(); }
    expect(paint.faces.filter((f) => f.water).length).toBe(six.faces.filter((f) => f.water).length);
  }, 60000);
});
