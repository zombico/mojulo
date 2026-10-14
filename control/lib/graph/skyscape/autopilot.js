/**
 * THE AUTOPILOT — a course flown by its own craft, on the fly rule the page runs (worlds/controllable/rules-fly.js), to
 * show it can be flown: a machine gate, the flight's counterpart of the walkability audit. A simple pilot, as a student
 * flies: the throttle to cruise, the nose for the next gate's height (and up, whatever the gate asks, when the ground
 * a few seconds ahead comes within a low pass), a bank toward it (or straight on, out and back round, when it sits
 * inside the turn circle), and the gates taken in order
 * (each when the craft passes within its radius); then the finish (the runway's touchdown zone), reached on the way
 * down. It proves a course CAN be flown by the craft's rule; whether it is fun is the operator's to judge.
 *
 *   flyCourse(map, field, course, { rule?, seconds?, dt? }) → { flown, passed, of, time, reason, track }
 *
 * The craft starts where a level seats it (the first pad's threshold; a craft with no engine aloft). Pure,
 * deterministic: a fixed dt, the world's own rules.
 */
import { composeLive } from '../worlds/controllable/compose.js';
import { seatCraft } from './craft.js';

let E = null;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => { const T = 2 * Math.PI; return ((a % T) + T + Math.PI) % T - Math.PI; };

export function flyCourse(map, field, course, { rule: given = null, seconds = 900, dt = 1 / 30 } = {}) {
  E ??= composeLive();
  const c = map.craft, seat = seatCraft(map, field, course), rule = given ?? seat.rule;
  const world = E.createWorld({ entities: [{ id: 'craft', pilotable: true, rule, transform: { ...seat.transform, pos: [...seat.transform.pos] } }] });
  const p = world.byId.craft, hooks = { ground: (q) => field.groundAt(q[0], q[1]) };
  const targets = [...course.gates.map((g) => ({ at: g.at, r: g.radius, gate: true })), ...(course.finish ? [{ at: course.finish.at, r: course.finish.radius, gate: false }] : [])];
  const laps = course.laps ?? 1, order = [];
  for (let l = 0; l < laps; l++) order.push(...targets.filter((t) => t.gate || l === laps - 1));
  // a target inside the turn circle and off to one side is never reached by turning at it (the pursuit orbit): the
  // pilot extends, straight on, out to a few turn circles, then comes back round to it
  const rTurn = map.eye.turn.cruise;
  let k = 0, t = 0, reason = null, best = Infinity, extend = false, hPrev = p.transform.heading;
  const track = [];
  while (t < seconds && k < order.length) {
    const T = order[k], q = p.transform.pos;
    const dx = T.at[0] - q[0], dy = T.at[1] - q[1], dz = T.at[2] - q[2], dh = Math.hypot(dx, dy), d = Math.hypot(dh, dz);
    // the pilot: a bank toward the target (left grows the heading), the nose for its height, the throttle to cruise
    const err = wrap(Math.atan2(dy, dx) - p.transform.heading);
    // the heading's own rate damps the bank (a fast craft rolls slowly for its speed: on the error alone it weaves)
    const hRate = wrap(p.transform.heading - hPrev) / dt; hPrev = p.transform.heading;
    if (!extend && p.airborne && dh < 2.2 * rTurn && Math.abs(err) > 0.9) extend = true;
    if (extend && dh > 3.5 * rTurn) extend = false;
    let want = clamp(Math.atan2(dz, Math.max(dh, 1)), -0.25, 0.3);
    // terrain ahead (a ground-proximity warning): where the craft will be in a few seconds, the ground within a low
    // pass of the path pulls the nose up, whatever the target asks
    if (p.airborne) {
      const v = p.airspeed ?? c.cruise, cosP = Math.cos(p.transform.pitch || 0);
      for (const s of [2, 4, 6]) {
        const ax = q[0] + Math.cos(p.transform.heading) * cosP * v * s, ay = q[1] + Math.sin(p.transform.heading) * cosP * v * s;
        if (field.groundAt(ax, ay) + c.lowPass > q[2] + Math.sin(p.transform.pitch || 0) * v * s) { want = 0.3; break; }
      }
    }
    const input = {
      turn: p.airborne && !extend ? clamp(-2.2 * err + 1.2 * hRate, -1, 1) : 0,
      lift: p.airborne || (p.airspeed ?? 0) > c.stall * 1.15 ? clamp(4 * (want - (p.transform.pitch || 0)), -1, 1) : 0,
      forward: (p.airspeed ?? 0) < c.cruise ? 1 : -1,
      lookDY: 0,
    };
    E.stepWorld(world, input, dt, hooks);
    t += dt;
    // passed: inside the target's radius, or the closest approach (getting farther again) within it
    if (d <= T.r) { k++; best = Infinity; continue; }
    if (d < best) best = d;
    // down where it should not be: the ground met away from the finish
    if (p.touchdown && T.gate) { reason = `came down on the ground before ${k < course.gates.length ? `gate ${k + 1}` : 'the finish'}`; break; }
    if (Math.round(t / dt) % 30 === 0) track.push([Math.round(q[0]), Math.round(q[1]), Math.round(q[2])]);
  }
  const flown = k >= order.length;
  return { flown, passed: k, of: order.length, time: Math.round(t * 10) / 10, reason: flown ? null : (reason ?? `ran out of time at target ${k + 1} of ${order.length}`), track };
}
