/**
 * The streetcars (geocity/roads.js `most`, geocity/flow.js, geocity/streetcar.js streetcarPool): a district may say how
 * many lines of track it keeps, the spines first; and on each track a lane of its own the metro's streetcar runs, at its
 * pace, through the signals the traffic stops at.
 */
import { describe, expect, it } from 'vitest';

import { designGeocity } from './design.js';
import { flowOf, flowLaws, FLOW } from './flow.js';
import { STREETCAR, STREETCAR_MODEL, streetcarPool } from './streetcar.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const lines = (D) => D.lines.filter((l) => l.kind.streetcar);

describe('the streetcars', () => {
  const D = designGeocity(geocity, { seed: 2 }), one = designGeocity({ ...geocity, roads: { streetcar: { most: 1 } } }, { seed: 2 });
  it('a district keeps at most so many lines of track, the spines first; the metro\'s own as they were', () => {
    expect(lines(D).length).toBeGreaterThan(1);
    expect(lines(one)).toHaveLength(1);
    expect(lines(one)[0].rank).toBe('spine');
    expect(lines(designGeocity({ ...geocity, roads: { streetcar: { most: 0 } } }, { seed: 2 }))).toHaveLength(0);
    expect(() => designGeocity({ ...geocity, roads: { streetcar: { most: 1.5 } } }, { seed: 2 })).toThrow(/most\?: 0–12 lines/);
  });
  it('each track a lane the metro\'s streetcar runs, at its own pace, through the signals; its laws hold', () => {
    const F = flowOf(one, { seed: 2 }), k = F.kinds.findIndex((x) => x.model === STREETCAR_MODEL);
    expect(k).toBeGreaterThanOrEqual(0);
    const tramLanes = [...new Set(F.cars.filter((c) => c[1] === k).map((c) => c[0]))];
    expect(tramLanes).toHaveLength(lines(one)[0].tracks.length);
    for (const li of tramLanes) {
      expect(F.lanes[li].speed).toBe(FLOW.streetcar.speed);
      expect(F.lanes[li].crossings.length).toBeGreaterThan(0);
      expect(F.cars.filter((c) => c[0] === li).every((c) => c[1] === k)).toBe(true);
    }
    // (the boxes sized to clear it, the longest thing through a crossing)
    expect(F.T.CAR_LEN).toBe(STREETCAR.length);
    expect(flowLaws(F).every((l) => l.ok)).toBe(true);
    // (no track, no streetcar)
    const none = flowOf(designGeocity({ ...geocity, roads: { streetcar: { most: 0 } } }, { seed: 2 }), { seed: 2 });
    expect(none.kinds.some((x) => x.model === STREETCAR_MODEL)).toBe(false);
  });
  it('pooled for the traffic: its body facing +y about the origin, its paint and its trim', () => {
    const [paint, trim] = streetcarPool();
    expect([paint.pool, trim.pool]).toEqual([`${STREETCAR_MODEL}|paint`, `${STREETCAR_MODEL}|trim`]);
    const ys = paint.template.flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.max(...ys)).toBeCloseTo(STREETCAR.length / 2, 1);
    expect(Math.min(...ys)).toBeCloseTo(-STREETCAR.length / 2, 1);
  });
});
