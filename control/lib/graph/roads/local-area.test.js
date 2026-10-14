// Local area laws: each zone of the arena built on its own, in passes. One lap (the first closed preset, chosen in
// code) in one banded kit, and the procedures: every zone built through its passes, its laws held; a strip zone's pad
// level with the track it serves; a zone re-rolled, held or stopped at a pass without moving any other; what the eye
// meets; four corners at most; determinism.
import { describe, it, expect } from 'vitest';
import { planTrack } from './track.js';
import { COURSE_PRESETS } from './course.js';
import { planTrackscape } from './trackscape.js';
import { planArena } from './arena-plan.js';
import { buildLocalAreas, localCamera, PASSES } from './local-area.js';
import { trackKit } from './track-kit.js';
import { SWATCH_KITS } from '../era/style/swatches.js';
import { poleOf } from '../era/style/pole.js';

const LAP = Object.keys(COURSE_PRESETS).find((k) => { const c = COURSE_PRESETS[k](); return c.alignment?.closed ?? c.closed; });
const plan = planTrack({ form: 'circuit', course: LAP }), scape = planTrackscape(plan), arena = planArena(plan, { scape });
const K = trackKit(SWATCH_KITS.find((k) => poleOf(k) === 'banded'));
const L = buildLocalAreas(plan, arena, { K, seed: 4 });
const area = (id) => L.areas.find((a) => a.zone === id);

describe('local areas', () => {
  it('build every zone through its passes, their laws held: a pit building and a stand to their elements, bays painted', () => {
    for (const z of arena.zones) expect(area(z.id), z.id).toBeTruthy();
    for (const a of L.areas) expect(a.laws ?? [], a.zone).toEqual([]);
    expect(area('pit-building').passes.elements).toBeGreaterThan(0);
    expect(area('pit-building').passes.massing).toBeGreaterThan(0);
    const stand = L.areas.find((a) => a.use === 'grandstand');
    expect(stand.passes.elements).toBeGreaterThan(0);
    expect(area('car-park').passes.ground).toBeGreaterThan(1);
    expect(L.colliders.some((c) => c.of === 'local:pit-building')).toBe(true);
    expect(L.things.some((t) => t.interest === 'focus')).toBe(true);
    for (const f of L.faces) expect(f.corners.length).toBeLessThanOrEqual(4);
  });
  it('a strip zone\'s pad is level with the track it serves, never under its land', () => {
    const a = plan.alignment, lane = arena.zones.find((z) => z.use === 'pit lane' || z.use === 'pit building');
    for (const [x, y] of lane.poly.slice(0, lane.poly.length / 2)) {
      let st = a.at(0), d = Infinity; for (let s = 0; s <= a.length; s += 1) { const q = a.at(s), e = Math.hypot(q.x - x, q.y - y); if (e < d) { d = e; st = q; } }
      const near = L.byZone[lane.id].flatMap((f) => f.corners).filter((c) => Math.hypot(c[0] - x, c[1] - y) < 0.01);
      // (the pad's top there: a retaining wall's foot goes into the land by design)
      const topZ = Math.max(...near.map((c) => c[2]));
      expect(near.length).toBeGreaterThan(0);
      expect(topZ).toBeGreaterThanOrEqual(st.z);
      expect(topZ).toBeGreaterThanOrEqual(plan.groundAt(x, y));
    }
  });
  it('a zone re-rolled, held or stopped at a pass moves no other; the build is deterministic', () => {
    const rolled = buildLocalAreas(plan, arena, { K, seed: 4, local: { 'car-park': { seed: 99 }, paddock: { skip: true }, 'pit-building': { upTo: 'massing' } } });
    expect(JSON.stringify(rolled.byZone['car-park'])).not.toBe(JSON.stringify(L.byZone['car-park']));
    expect(rolled.byZone.paddock).toBeUndefined();
    expect(rolled.areas.find((a) => a.zone === 'pit-building').upTo).toBe('massing');
    expect(rolled.byZone['pit-building'].length).toBe(area('pit-building').passes.ground + area('pit-building').passes.massing);
    for (const z of arena.zones) if (!['car-park', 'paddock', 'pit-building'].includes(z.id)) expect(JSON.stringify(rolled.byZone[z.id]), z.id).toBe(JSON.stringify(L.byZone[z.id]));
    expect(JSON.stringify(buildLocalAreas(plan, arena, { K, seed: 4 }).faces)).toBe(JSON.stringify(L.faces));
    expect(PASSES).toEqual(['ground', 'massing', 'elements', 'dressing']);
    expect(localCamera(plan, arena, 'pit-building').lookAt).toHaveLength(3);
  }, 60000);
});
