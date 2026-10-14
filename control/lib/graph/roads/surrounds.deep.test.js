// The surrounds swept: every land and every settlement on one small lap (the first closed preset, chosen in code) in
// one banded kit: each builds, keeps the venue's ground, stands its formations and sites outside the ring, and leaves
// the lap's laws held.
import { describe, it, expect } from 'vitest';
import { planScapedTrack } from './trackscape-dress.js';
import { LANDS, SETTLEMENTS } from './surrounds.js';
import { inPoly } from './arena-plan.js';
import { COURSE_PRESETS } from './course.js';
import { SWATCH_KITS } from '../era/style/swatches.js';
import { poleOf } from '../era/style/pole.js';

const LAP = Object.keys(COURSE_PRESETS).find((k) => { const c = COURSE_PRESETS[k](); return c.alignment?.closed ?? c.closed; });
const KIT = SWATCH_KITS.find((k) => poleOf(k) === 'banded');
const flat = planScapedTrack({ form: 'circuit', course: LAP, kit: KIT, scape: { surrounds: false } });

describe('the surrounds, swept', () => {
  const cases = [...Object.keys(LANDS).map((land) => ({ land })), ...SETTLEMENTS.map((settlement) => ({ land: 'hills', settlement }))];
  for (const sur of cases) it(`${sur.land}${sur.settlement ? `, ${sur.settlement}` : ''}`, () => {
    const p = planScapedTrack({ form: 'circuit', course: LAP, kit: KIT, scape: { surrounds: sur } });
    const ring = p.scape.arena.roads.find((r) => r.id === 'ring').pts;
    for (const q of [...ring, ...p.scape.arena.zones.flatMap((z) => z.poly), ...p.sections.flatMap((s) => [s.left, s.right])]) expect(p.groundAt(q[0], q[1])).toBeCloseTo(flat.groundAt(q[0], q[1]), 6);
    for (const f of [...p.scape.surrounds.formations, ...p.scape.surrounds.sites]) expect(inPoly(f.at, ring)).toBe(false);
    if (sur.settlement === 'none') expect(p.scape.surrounds.sites).toEqual([]);
    expect(p.scape.laws).toEqual([]);
  });
});
