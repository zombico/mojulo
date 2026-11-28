/**
 * A car's chase with its aim eased (rules-basic.js follow `lookEase`, a car's camera: gameworld/cars.js CAB.camera): a
 * steering key's taps swing the aim no faster than the chase swings the eye, so the view does not jerk; and absent, the
 * aim along the car's own heading, as it was.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import { createWorld, stepWorld } from './controllable-world.js';
import { CAB } from '../gameworld/cars.js';

const DT = 1 / 60, flat = { ground: () => 0 };
const drive = (camera) => {
  const w = createWorld({
    entities: [{ id: 'car', rule: { type: 'drive', horsepower: 150, mass: 1400, wheelbase: 2.8, wheelRadius: 0.33 }, transform: { pos: [0, 0, 0], heading: 0 } }],
    camera: { rule: 'follow', target: 'car', lead: 3, dist: 8.5, height: 3.2, ...camera },
  });
  // (up to speed, then the steering tapped on and off, a key's way: a quarter of a second on, a quarter off)
  const yaw = [];
  for (let i = 0; i < 300; i++) {
    stepWorld(w, { forward: 1, turn: i > 120 && Math.floor(i / 15) % 2 ? -1 : 0 }, DT, flat);
    const c = w.camera, l = c.lookAt, p = c.transform.pos;
    yaw.push(Math.atan2(l[1] - p[1], l[0] - p[0]));
  }
  // (the view's turning rate, frame to frame, and how sharply that rate changes: the jerk felt)
  const wrap = (a) => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const rate = yaw.slice(1).map((y, i) => wrap(y - yaw[i]) / DT), jerk = rate.slice(1).map((r, i) => Math.abs(r - rate[i]) / DT).slice(120);
  return { worst: Math.max(...jerk), mean: jerk.reduce((a, b) => a + b, 0) / jerk.length, w };
};

describe('a car\'s chase', () => {
  it('eases its aim after the car\'s heading: the view turns no more sharply than a fraction of the raw aim\'s', () => {
    const raw = drive({}), eased = drive({ lookEase: CAB.camera.lookEase });
    expect(CAB.camera.lookEase).toBeGreaterThan(0);
    expect(eased.worst).toBeLessThan(raw.worst);
    expect(eased.mean).toBeLessThan(raw.mean);
    // (and it still follows the car: both end looking the same way within a little)
    const end = (w) => { const c = w.camera, l = c.lookAt, p = c.transform.pos; return Math.atan2(l[1] - p[1], l[0] - p[0]); };
    expect(Math.abs(end(eased.w) - end(raw.w))).toBeLessThan(0.25);
    require('node:fs').writeFileSync(process.env.EASE_OUT || '/dev/null', JSON.stringify({ raw: [raw.worst, raw.mean], eased: [eased.worst, eased.mean] }));
  });
});
