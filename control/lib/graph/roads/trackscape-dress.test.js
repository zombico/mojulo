// A track dressed by its trackscape: laws on what was built. One lap (the first closed preset, chosen in code) in one
// banded kit: the lap's own eye satisfied by the pieces as they stand; every slot filled; nothing on the road but what
// spans it; a span's legs and anything a car can reach a collider; every piece on its land; absent, the plan unchanged;
// the roadway kind and a gameworld level draw it when asked.
import { describe, it, expect } from 'vitest';
import { planScapedTrack } from './trackscape-dress.js';
import { planTrack } from './track.js';
import { COURSE_PRESETS } from './course.js';
import { assembleRoadwayScene } from './roadway.js';
import { SWATCH_KITS } from '../era/style/swatches.js';
import { poleOf } from '../era/style/pole.js';
import { gameStages, roadwayEnds } from '../gameworld/levels.js';
import { MEADOWMARK } from '../gameworld/index.js';

const LAP = Object.keys(COURSE_PRESETS).find((k) => { const c = COURSE_PRESETS[k](); return c.alignment?.closed ?? c.closed; });
const KIT = SWATCH_KITS.find((k) => poleOf(k) === 'banded');
const m = { form: 'circuit', course: LAP, kit: KIT, scape: true };
const p = planScapedTrack(m);
const offOf = (plan, x, y) => {
  const a = plan.alignment; let b = null, d = Infinity;
  for (let s = 0; s <= a.length; s += 0.5) { const c = a.at(s), e = (c.x - x) ** 2 + (c.y - y) ** 2; if (e < d) { d = e; b = c; } }
  return Math.abs(-(x - b.x) * Math.sin(b.heading) + (y - b.y) * Math.cos(b.heading));
};

describe('a dressed track', () => {
  it('satisfies the lap\'s own eye with the pieces as built; every slot filled (by a piece, or by its zone)', () => {
    expect(p.scape.laws).toEqual([]);
    expect(p.scape.census.corners.every((c) => c.focused)).toBe(true);
    expect(p.scape.census.landmarkSeen).toBe(true);
    expect(p.scape.pieces.length + p.scape.absorbed.length).toBe(p.scape.slots.length);
  });
  it('stands off the road (a span across it), on its land; a span\'s legs and what a car can reach are colliders', () => {
    for (const q of p.scape.pieces) {
      const cx = (q.box.lo[0] + q.box.hi[0]) / 2, cy = (q.box.lo[1] + q.box.hi[1]) / 2;
      expect(q.box.lo[2]).toBeLessThanOrEqual(p.groundAt(cx, cy) + 0.05);
      if (q.beat === 'span' || q.beat === 'gantry') continue;
      const corners = [[q.box.lo[0], q.box.lo[1]], [q.box.hi[0], q.box.lo[1]], [q.box.hi[0], q.box.hi[1]], [q.box.lo[0], q.box.hi[1]]];
      expect(Math.min(...corners.map(([x, y]) => offOf(p, x, y))), q.block).toBeGreaterThan(p.X.outer);
    }
    const own = planTrack({ form: 'circuit', course: LAP, kit: KIT });
    const added = p.colliders.slice(own.colliders.length);
    expect(added.filter((c) => c.of === 'trackscape:gantry').length).toBe(2);
    expect(added.some((c) => c.of === 'trackscape:rhythm')).toBe(true);
  }, 60000);
  it('absent, the plan is planTrack\'s; the roadway kind and a gameworld level draw it when asked', () => {
    const plain = { form: 'circuit', course: LAP };
    expect(JSON.stringify(planScapedTrack(plain).faces)).toBe(JSON.stringify(planTrack(plain).faces));
    const scene = assembleRoadwayScene(m);
    expect(scene.faces.length).toBe(p.faces.length);
    const W = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, track: { roadway: { course: LAP, kit: true, scape: true } } } };
    const st = gameStages(W).find((x) => x.section === 'roadway');
    expect(st.manifest.scape).toBe(true);
    expect(roadwayEnds(st.manifest).colliders.some((c) => c.of.startsWith('trackscape:'))).toBe(true);
  }, 60000);
});
