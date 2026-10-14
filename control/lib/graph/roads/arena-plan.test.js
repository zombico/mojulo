// Arena plan laws: the venue planned before it is built. One lap and one stage (chosen in code from the presets) and
// the procedures: the pits on the main straight on the side with room; the stands where a spectator sees the most; the
// zones off the road, apart and out of the sight lines; a ring that never crosses the track, a spur to every zone and a
// tunnel exactly where a spur must cross; the sheet; a slot in a zone absorbed by it; determinism.
import { describe, it, expect } from 'vitest';
import { planTrack } from './track.js';
import { COURSE_PRESETS } from './course.js';
import { planTrackscape } from './trackscape.js';
import { planArena, arenaSheetSvg, zoneOf, ARENA } from './arena-plan.js';
import { planScapedTrack } from './trackscape-dress.js';

const isClosed = (k) => { const c = COURSE_PRESETS[k](); return c.alignment?.closed ?? c.closed; };
const LAP = Object.keys(COURSE_PRESETS).find(isClosed), STAGE = Object.keys(COURSE_PRESETS).find((k) => !isClosed(k));
const lap = planTrack({ form: 'circuit', course: LAP }), scape = planTrackscape(lap), arena = planArena(lap, { scape });
const cross = (p1, p2, p3, p4) => { const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return d(p3, p4, p1) * d(p3, p4, p2) < 0 && d(p1, p2, p3) * d(p1, p2, p4) < 0; };
const centre = (plan) => Array.from({ length: Math.round(plan.alignment.length / 2) + 1 }, (_, i) => plan.alignment.at(Math.min(plan.alignment.length, i * 2))).map((c) => [c.x, c.y]);

describe('the arena plan', () => {
  it('lays the pits along the main straight, the stands where a spectator sees the most, its laws held', () => {
    expect(arena.laws).toEqual([]);
    const pb = arena.zones.find((z) => z.id === 'pit-building');
    expect(pb).toBeTruthy();
    const A = ARENA[lap.course.class], stands = arena.zones.filter((z) => z.use === 'grandstand');
    expect(stands.length).toBe(A.stands);
    for (let i = 1; i < stands.length; i++) expect(stands[i].sees).toBeLessThanOrEqual(stands[i - 1].sees);
    expect(arena.zones.some((z) => z.use === 'car park')).toBe(true);
  });
  it('a ring that never crosses the track; a spur to every zone; a tunnel exactly where a spur crosses', () => {
    for (const plan of [lap, planTrack({ form: 'stage', course: STAGE })]) {
      const A = plan === lap ? arena : planArena(plan, { scape: planTrackscape(plan) }), C = centre(plan);
      const ring = A.roads.find((r) => r.use === 'service road').pts;
      for (let i = 0; i < ring.length - 1; i++) for (let j = 0; j < C.length - 1; j++) expect(cross(ring[i], ring[i + 1], C[j], C[j + 1])).toBe(false);
      for (const z of A.zones) {
        const r = A.roads.find((x) => x.zone === z.id);
        expect(r, z.id).toBeTruthy();
        const crosses = C.slice(0, -1).some((c, j) => cross(r.pts[0], r.pts[1], c, C[j + 1]));
        expect(r.use === 'tunnel road').toBe(crosses);
        expect(A.tunnels.some((t) => t.zone === z.id)).toBe(crosses);
      }
    }
  }, 60000);
  it('draws its sheet; a slot inside a zone is that zone\'s to fill; deterministic', () => {
    const svg = arenaSheetSvg(lap, arena, { scape });
    for (const z of arena.zones) expect(svg).toContain(z.id);
    const z = arena.zones[0], c = z.poly.reduce((s, p) => [s[0] + p[0] / z.poly.length, s[1] + p[1] / z.poly.length], [0, 0]);
    expect(zoneOf(arena, c).id).toBe(z.id);
    const dressed = planScapedTrack({ form: 'circuit', course: LAP, scape: true });
    for (const a of dressed.scape.absorbed) expect(dressed.scape.arena.zones.some((x) => x.id === a.zone)).toBe(true);
    expect(dressed.scape.pieces.length + dressed.scape.absorbed.length).toBe(dressed.scape.slots.length);
    expect(JSON.stringify(planArena(lap, { scape }))).toBe(JSON.stringify(arena));
  }, 60000);
});
