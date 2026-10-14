// The driver's eye: laws of the measure. One small course (the first closed preset, chosen in code) and the procedures:
// the speed plan bound by the vehicle's envelope; the eye spot at distance; filler never holding the gaze; a prop where
// the gaze lands at turn-in focusing that corner; determinism.
import { describe, it, expect } from 'vitest';
import { planTrack } from './track.js';
import { COURSE_PRESETS } from './course.js';
import { envelope } from './vehicles.js';
import { speedPlan, driverEye, trackThings, eyeSpotAt, DRIVER, TRACK_VEHICLE } from './eye.js';

const LAP = Object.keys(COURSE_PRESETS).find((k) => COURSE_PRESETS[k]().alignment?.closed ?? COURSE_PRESETS[k]().closed);
const plan = planTrack({ form: 'circuit', course: LAP, dress: true });
const cls = TRACK_VEHICLE[plan.course.class];

describe('the driver\'s eye', () => {
  it('drives the line on its vehicle\'s envelope: never over top speed or the corner\'s grip, never braking harder than it can', () => {
    const env = envelope(cls), line = speedPlan(plan, cls);
    for (let i = 0; i < line.length; i++) {
      const p = line[i];
      expect(p.v).toBeLessThanOrEqual(env.top + 1e-9);
      expect(p.v).toBeLessThanOrEqual(Math.sqrt(env.corner / Math.max(Math.abs(p.k), 1e-6)) + 1e-9);
      const q = line[i + 1];
      if (q) expect((p.v * p.v - q.v * q.v) / (2 * (q.s - p.s))).toBeLessThanOrEqual(env.brake + 1e-6);
    }
  });
  it('reads by the eye spot: the least span grows with distance', () => {
    expect(eyeSpotAt(6)).toBeLessThan(0.25);
    expect(eyeSpotAt(140)).toBeGreaterThan(4);
    expect(eyeSpotAt(24) / eyeSpotAt(12)).toBeCloseTo(2, 6);
  });
  it('filler never holds the gaze: the plan\'s scattered wood leaves every second blank and every corner unfocused', () => {
    const c = driverEye(plan, trackThings(plan), { cls });
    expect(trackThings(plan).length).toBeGreaterThan(0);
    expect(c.blank).toBe(c.seconds.length);
    expect(c.corners.length).toBeGreaterThan(0);
    expect(c.corners.every((x) => !x.focused)).toBe(true);
    expect(c.rhythm.perSecond).toBeGreaterThan(0);
  });
  it('a prop where the gaze lands before turn-in focuses that corner and fills those seconds; a speck does not', () => {
    const line = speedPlan(plan, cls), c0 = driverEye(plan, [], { cls }), corner = c0.corners[0];
    const near = (t) => line.reduce((b, p) => (Math.abs(p.t - t) < Math.abs(b.t - t) ? p : b));
    const p = near(corner.t - 0.5), g = near(corner.t - 0.5 + DRIVER.gazeAhead);
    const at = [p.x + (g.x - p.x) * 1.6, p.y + (g.y - p.y) * 1.6, g.z + 2];
    const stand = driverEye(plan, [{ kind: 'stand', interest: 'prop', at, span: 6 }], { cls });
    expect(stand.corners[0].focused).toBe(true);
    expect(stand.blank).toBeLessThan(c0.blank);
    const speck = driverEye(plan, [{ kind: 'stand', interest: 'prop', at, span: 0.05 }], { cls });
    expect(speck.corners[0].focused).toBe(false);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(driverEye(plan, trackThings(plan), { cls }))).toBe(JSON.stringify(driverEye(plan, trackThings(plan), { cls })));
  });
});
