// The surrounds: the land beyond a venue shaped and stood on. One lap (the first closed preset, chosen in code) in one
// banded kit, dressed with and without them: what must stay flat stays as it was (the road's footprint, the zones, the
// ring road) and the land rises past it; formations and the settlement stand outside the venue; a lake's water lies on
// its basin; the laws still hold; deterministic; `surrounds: false` draws the plan's own ground.
import { describe, it, expect } from 'vitest';
import { planScapedTrack } from './trackscape-dress.js';
import { planTrack } from './track.js';
import { planSurrounds, LANDS } from './surrounds.js';
import { inPoly } from './arena-plan.js';
import { COURSE_PRESETS } from './course.js';
import { SWATCH_KITS } from '../era/style/swatches.js';
import { poleOf } from '../era/style/pole.js';
import { trackKit } from './track-kit.js';

const LAP = Object.keys(COURSE_PRESETS).find((k) => { const c = COURSE_PRESETS[k](); return c.alignment?.closed ?? c.closed; });
const KIT = SWATCH_KITS.find((k) => poleOf(k) === 'banded');
const m = { form: 'circuit', course: LAP, kit: KIT, scape: true };
const p = planScapedTrack(m), flat = planScapedTrack({ ...m, scape: { surrounds: false } });
const ring = p.scape.arena.roads.find((r) => r.id === 'ring').pts;

describe('the surrounds', () => {
  it('keep the venue as it was: the road\'s edges, the zones and the ring road on the same ground', () => {
    const at = [];
    for (const s of p.sections) at.push(s.left, s.right);
    for (const z of p.scape.arena.zones) at.push(...z.poly);
    at.push(...ring);
    for (const q of at) expect(p.groundAt(q[0], q[1]), q.join(',')).toBeCloseTo(flat.groundAt(q[0], q[1]), 6);
  });
  it('raise the land past the ring, never steeper than the land\'s slope near it', () => {
    const c = ring.reduce((s, q) => [s[0] + q[0] / ring.length, s[1] + q[1] / ring.length], [0, 0]), L = LANDS[p.scape.surrounds.land];
    let top = -Infinity;
    for (let k = 0; k < 24; k++) for (let d = 60; d <= 900; d += 60) {
      const t = (k * Math.PI) / 12, x = c[0] + Math.cos(t) * 400 + Math.cos(t) * d, y = c[1] + Math.sin(t) * 400 + Math.sin(t) * d;
      if (!inPoly([x, y], ring)) top = Math.max(top, p.groundAt(x, y) - p.terrain.zFar);
    }
    expect(top).toBeGreaterThan(L.near * 0.5);
    // the rise off the ring road: within a few metres of it, the land is within its slope of the road's ground
    for (let i = 0; i + 1 < ring.length; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[i + 1], l = Math.hypot(x1 - x0, y1 - y0) || 1, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      for (const s of [-1, 1]) { const x = mx + (s * (y1 - y0) / l) * 30, y = my - (s * (x1 - x0) / l) * 30; expect(Math.abs(p.groundAt(x, y) - flat.groundAt(x, y))).toBeLessThanOrEqual(L.slope * 30 + 1e-6); }
    }
  });
  it('stand formations and the settlement outside the venue, where the lap looks, and hold the laws', () => {
    const S = p.scape.surrounds;
    expect(S.formations.length).toBeGreaterThan(0);
    for (const f of [...S.formations, ...S.sites]) expect(inPoly(f.at, ring), f.kind).toBe(false);
    expect(S.sites.some((s) => s.kind === 'village')).toBe(true);
    expect(p.scape.laws).toEqual([]);
    expect(p.scape.census.landmarkSeen).toBe(true);
  });
  it('lay a lake\'s water over its basin, under the plain', () => {
    const { lake } = p.scape.surrounds;
    if (!lake) return;   // (an infield too narrow for one)
    const water = p.faces.find((f) => f.corners.length === 3 && Math.abs(f.corners[0][0] - lake.at[0]) < 1e-6 && Math.abs(f.corners[0][1] - lake.at[1]) < 1e-6);
    expect(water.corners[0][2]).toBeLessThan(p.terrain.zFar);
    expect(p.groundAt(lake.at[0], lake.at[1])).toBeLessThan(water.corners[0][2]);
  });
  it('are deterministic; `surrounds: false` draws the plan\'s own ground; a land not known is said', () => {
    expect(planScapedTrack(m).faces).toEqual(p.faces);
    const own = planTrack(m);
    expect(flat.faces.slice(flat.ground[0], flat.ground[1])).toEqual(own.faces.slice(own.ground[0], own.ground[1]));
    expect(p.faces.length).toBeGreaterThan(flat.faces.length);
    expect(() => planSurrounds(own, { K: trackKit(KIT), land: 'moon' })).toThrow(/no land 'moon'/);
  });
});
