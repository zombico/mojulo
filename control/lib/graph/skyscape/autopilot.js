/**
 * THE AUTOPILOT — a course flown by its own craft, on the fly rule the page runs (worlds/controllable/rules-fly.js), to
 * show it can be flown: a machine gate, the flight's counterpart of the walkability audit. A simple pilot, as a student
 * flies: the throttle to cruise, the nose for the next gate's height (and up, whatever the gate asks, when the ground
 * or a roof a few seconds ahead comes within a low pass), a bank toward it (or straight on, out and back round, when it
 * sits inside the turn circle), and the gates taken in order (each when the craft passes within its radius).
 *
 * Then it lands, as the game judges a landing (the laps mechanic's `land`: a touchdown in the runway's box no harder
 * than the gear takes). It lands AGAINST the departure, so the approach comes in over the climb-out the runway was sited
 * for (ground.js DEPARTURE, city.js CLIMB_OUT): out to an intercept and a final approach fix on the extended
 * centreline (course.js approachTo), then down its glide slope at the approach speed (the throttle, or the brakes when fast; a glider has only
 * the brakes), the nose raised to the FLARE over the last metres, and the brakes on the runway to a stop. A touchdown
 * anywhere else, or harder, is a crash and the flight's end.
 *
 *   flyCourse(map, field, course, { rule?, seconds?, dt? }) → { flown, passed, of, landed, time, reason, track, landing }
 *
 * It proves a course CAN be flown and landed by the craft's rule; whether it is fun is the operator's to judge. The
 * craft starts where a level seats it (the first pad's threshold; a craft with no engine aloft). Pure, deterministic:
 * a fixed dt, the world's own rules.
 */
import { composeLive } from '../worlds/controllable/compose.js';
import { seatCraft } from './craft.js';
import { approachTo, FLARE, GLIDE } from './course.js';

let E = null;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => { const T = 2 * Math.PI; return ((a % T) + T + Math.PI) % T - Math.PI; };
const r1 = (v) => Math.round(v * 10) / 10;


const inPad = (p, x, y) => x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1;

export function flyCourse(map, field, course, { rule: given = null, seconds = 900, dt = 1 / 30 } = {}) {
  E ??= composeLive();
  const c = map.craft, seat = seatCraft(map, field, course), rule = given ?? seat.rule, sinkMax = rule.sinkMax ?? 3;
  const world = E.createWorld({ entities: [{ id: 'craft', pilotable: true, rule, transform: { ...seat.transform, pos: [...seat.transform.pos] } }] });
  const p = world.byId.craft, top = field.topAt ?? field.groundAt, hooks = { ground: (q) => top(q[0], q[1]) };
  const pad = course.finish ? field.pads.find((q) => q.id === course.finish.pad) ?? field.pads[0] : null;
  const app = pad ? approachTo(map, pad) : null, rTurn = map.eye.turn.cruise, flarePitch = app ? -Math.asin(FLARE.sink * sinkMax / app.vApp) : 0;
  // the targets: each gate, and at each lap's end the intercept, the fix and the final (the pilot's own, not gates)
  const laps = course.laps ?? 1, order = [];
  for (let l = 0; l < laps; l++) {
    order.push(...course.gates.map((g) => ({ at: g.at, r: g.radius, gate: true })));
    // (a craft with no engine has no height to spend on the intercept: from its last gate, straight for the fix)
    if (app) order.push(...(c.engine === false ? [] : [{ at: app.intercept, r: 0.6 * rTurn, approach: true }]), { at: app.faf, r: 0.6 * rTurn, approach: true }, { final: true });
  }
  let k = 0, t = 0, reason = null, extend = false, hPrev = p.transform.heading, landed = 0, landing = null, wasAir = !!p.airborne, lastVs = 0, rolling = false;
  const track = [], passed = () => order.slice(0, k).filter((o) => o.gate).length;
  while (t < seconds && k < order.length) {
    const T = order[k], q = p.transform.pos, v = p.airspeed ?? 0;
    // the heading's own rate damps the bank (a fast craft rolls slowly for its speed: on the error alone it weaves)
    const hRate = wrap(p.transform.heading - hPrev) / dt; hPrev = p.transform.heading;
    // the throttle to cruise (the approach speed on the approach's legs); a craft with no engine brakes on the final only
    let turn = 0, want = 0, forward = c.engine === false ? 0 : v < (T.approach ? app.vApp * 1.2 : c.cruise) ? 1 : -1;
    if (!T.final) {
      const dx = T.at[0] - q[0], dy = T.at[1] - q[1], dz = T.at[2] - q[2], dh = Math.hypot(dx, dy);
      if (Math.hypot(dh, dz) <= T.r) { k++; extend = false; continue; }
      const err = wrap(Math.atan2(dy, dx) - p.transform.heading);
      if (!extend && p.airborne && dh < 2.2 * rTurn && Math.abs(err) > 0.9) extend = true;
      if (extend && dh > 3.5 * rTurn) extend = false;
      const nose = c.space ? 1.0 : 0.3;   // in space the nose goes where the gate is
      want = clamp(Math.atan2(dz, Math.max(dh, 1)), -Math.max(0.25, nose), nose);
      // terrain ahead (a ground-proximity warning): where the craft will be in a few seconds, the ground (or a city's
      // roof) within a low pass of the path pulls the nose up, whatever the target asks
      if (p.airborne) {
        const cosP = Math.cos(p.transform.pitch || 0), vv = v || c.cruise;
        for (const s of [2, 4, 6]) {
          const ax = q[0] + Math.cos(p.transform.heading) * cosP * vv * s, ay = q[1] + Math.sin(p.transform.heading) * cosP * vv * s;
          if (top(ax, ay) + c.lowPass > q[2] + Math.sin(p.transform.pitch || 0) * vv * s) { want = 0.3; break; }
        }
      }
      turn = p.airborne && !extend ? clamp(-2.2 * err + 1.2 * hRate, -1, 1) : 0;
    } else if (!rolling) {
      // the final: the centreline (the cross-track pulled out), the glide slope, the approach speed, the flare
      const along = (q[0] - app.aim[0]) * app.axis[0] + (q[1] - app.aim[1]) * app.axis[1];   // + past the aim point
      const xte = (q[0] - app.aim[0]) * -app.axis[1] + (q[1] - app.aim[1]) * app.axis[0];   // + left of the line
      turn = p.airborne ? clamp(-2.2 * wrap(app.heading - clamp(xte / 150, -0.5, 0.5) - p.transform.heading) + 1.2 * hRate, -1, 1) : 0;
      const agl = q[2] - field.groundAt(q[0], q[1]);
      want = agl < FLARE.agl ? flarePitch : clamp(-GLIDE + 0.02 * (app.aim[2] + Math.max(0, -along) * GLIDE - q[2]), -0.2, 0.08);
      forward = v > app.vApp ? -1 : agl < FLARE.agl ? 0 : 1;
    } else forward = -1;   // on the runway: the brakes to a stop
    const lift = rolling ? 0 : p.airborne || v > c.stall * 1.15 ? clamp(4 * (want - (p.transform.pitch || 0)), -1, 1) : 0;
    E.stepWorld(world, { turn, lift, forward, lookDY: 0 }, dt, hooks);
    t += dt;
    // a rock hit (space.js): a crash, as the page judges it
    if (field.hitAt && field.hitAt(p.transform.pos[0], p.transform.pos[1], p.transform.pos[2], 2)) { reason = `crashed: hit an asteroid before gate ${passed() + 1}`; break; }
    // a touchdown, judged as the game judges it: in a pad's box and no harder than the gear takes, else a crash
    if (p.airborne) lastVs = p.climbRate || 0;
    else if (wasAir) {
      const sink = Math.max(0, -lastVs), at = p.transform.pos;
      if (sink > sinkMax) { reason = `crashed: touched down at ${r1(sink)} m/s, harder than the gear's ${sinkMax}`; break; }
      if (!field.pads.some((pp) => inPad(pp, at[0], at[1]))) { reason = `crashed: came down off the runway ${T.final ? 'on the approach' : T.approach ? 'joining the approach' : `before gate ${passed() + 1}`}`; break; }
      if (T.final) { rolling = true; landing = { sink: r1(sink), speed: r1(v), at: [Math.round(at[0]), Math.round(at[1])] }; }
    }
    wasAir = !!p.airborne;
    if (rolling && (p.airspeed ?? 0) < 0.5) { landed++; k++; rolling = false; }
    if (Math.round(t / dt) % 30 === 0) track.push([Math.round(q[0]), Math.round(q[1]), Math.round(q[2])]);
  }
  const flown = k >= order.length;
  return { flown, passed: passed(), of: course.gates.length * laps, landed, time: r1(t), reason: flown ? null : (reason ?? `ran out of time at target ${k + 1} of ${order.length}`), track, landing };
}
