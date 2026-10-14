// Trackscape laws: the slots a driver's eye needs, before anything is built. One lap and one stage (chosen in code: the
// first closed preset and the first open one) and the procedures: the plan's slots satisfy the lap's own eye; a focus
// stands where the gaze lands, on the outside; the boards count down to the braking point; no two corners framed
// alike in a row; the sight lines and the road kept clear; a stage's lines and long straight; determinism.
import { describe, it, expect } from 'vitest';
import { planTrack } from './track.js';
import { COURSE_PRESETS } from './course.js';
import { driverEye } from './eye.js';
import { planTrackscape, slotThings, trackscapeLaws, SCAPE } from './trackscape.js';

const isClosed = (k) => { const c = COURSE_PRESETS[k](); return c.alignment?.closed ?? c.closed; };
const LAP = Object.keys(COURSE_PRESETS).find(isClosed), STAGE = Object.keys(COURSE_PRESETS).find((k) => !isClosed(k));
const lap = planTrack({ form: 'circuit', course: LAP });
const scape = planTrackscape(lap), census = driverEye(lap, slotThings(scape.slots), { cls: scape.cls, ground: lap.groundAt });
const signedOff = (plan, x, y) => {
  const a = plan.alignment; let b = null, d = Infinity;
  for (let s = 0; s <= a.length; s += 1) { const c = a.at(s), e = (c.x - x) ** 2 + (c.y - y) ** 2; if (e < d) { d = e; b = c; } }
  return -(x - b.x) * Math.sin(b.heading) + (y - b.y) * Math.cos(b.heading);
};

describe('a lap\'s trackscape', () => {
  it('satisfies the lap\'s own eye: every corner focused, no long blank, the landmark seen from the grid and again', () => {
    expect(scape.corners.length).toBeGreaterThan(0);
    expect(census.corners.every((c) => c.focused)).toBe(true);
    expect(trackscapeLaws(lap, scape, census)).toEqual([]);
    expect(scape.landmark.fromGrid).toBe(true);
  });
  it('a focus stands beyond the outside of its corner, at least the eye spot\'s three spans across', () => {
    for (const f of scape.slots.filter((s) => s.beat === 'focus')) {
      const c = scape.corners[f.corner], off = signedOff(lap, f.at[0], f.at[1]);
      expect(Math.sign(off)).toBe(-c.turn);                        // the outside: right of a left-hander
      expect(Math.abs(off)).toBeGreaterThan(lap.X.outer);
      expect(f.interest).toBe('focus');
    }
  });
  it('the boards count down to the braking point; no two corners in a row framed alike', () => {
    const boards = scape.slots.filter((s) => s.beat === 'braking' && s.corner === 0);
    expect(boards.map((b) => b.count)).toEqual(Array.from({ length: SCAPE.boards }, (_, i) => i + 1));
    const forms = scape.slots.filter((s) => s.beat === 'focus').map((s) => s.form);
    for (let i = 1; i < forms.length; i++) expect(forms[i]).not.toBe(forms[i - 1]);
  });
  it('a sight line hidden by the land loses the landmark', () => {
    const wall = () => 500;
    const hidden = driverEye(lap, slotThings(scape.slots), { cls: scape.cls, ground: wall });
    expect(hidden.landmarkSeen).toBe(false);
  });
  it('is deterministic; the seed turns only the focus forms', () => {
    expect(JSON.stringify(planTrackscape(lap))).toBe(JSON.stringify(scape));
    const other = planTrackscape(lap, { seed: 9 }), strip = (x) => x.slots.map(({ form, ...rest }) => rest);
    expect(JSON.stringify(strip(other))).toBe(JSON.stringify(strip(scape)));
  });
});

describe('a stage\'s trackscape', () => {
  it('gantries at the start and the finish; a long straight\'s pockets keep the blank under its law', () => {
    const plan = planTrack({ form: 'stage', course: STAGE }), sc = planTrackscape(plan);
    const c = driverEye(plan, slotThings(sc.slots), { cls: sc.cls, ground: plan.groundAt });
    expect(sc.slots.filter((s) => s.beat === 'gantry').map((s) => s.line)).toEqual(['start', 'finish']);
    expect(sc.straights.some((s) => s.dur > SCAPE.longStraight)).toBe(true);
    expect(sc.slots.some((s) => s.beat === 'pocket')).toBe(true);
    expect(trackscapeLaws(plan, sc, c)).toEqual([]);
  }, 60000);
});
