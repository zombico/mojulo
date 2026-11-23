/**
 * THE LESSON PILOT — a flight level's tasks flown by a student on the fly rule the page runs, and judged on the bus by
 * the level's own mechanics: the machine gate of a lesson (or any flight task list with nothing to fight). Where the
 * course autopilot proves a course can be flown (autopilot.js), this proves a lesson can be passed, and says the medal
 * the level's grade gives it.
 *
 * The student flies as a careful one does, one task at a time, reading only the task in hand off the bus:
 *   on the ground   full throttle, the nose up once it is past rotation speed
 *   a band          the middle of each gauge: its height (an altitude, or a height over the ground under it), its
 *                   heading, its speed; the bank commanded toward the heading and taken out as it comes round (the
 *                   sim assist holds a bank where it is put), the nose for the height, the lever for the speed
 *   gates           the next one due, its height and its bearing
 *   a nav point     its height and its bearing
 *   a landing       the runway it is lined up nearest (the end it comes at): onto its extended centreline first (an
 *                   intercept that narrows as the line comes up, the height held no lower than LANDING.hold m over the
 *                   runway while it is off it), then down a 3° glide path at LANDING.approach times the stall to a
 *                   touchdown zone LANDING.zone m past the threshold, the flare under LANDING.flare m (the sink eased
 *                   with the height to a few decimetres a second, the power holding it over the stall), the lever to
 *                   idle in the last metre and a half, and on the ground the brakes
 * and the ground ahead (a few seconds out) pulls the nose up whatever the task asks, as the autopilot's does (not on
 * a landing's final, which means to meet it). A fight is not flown by this student (a lesson with one is said not
 * proved).
 *
 * The bus hears what the page would: the level's zones and gauges (worlds/event-bus.js deriveZoneEvents, the pilot's
 * facts its gauges' facts), its timers, its watches, and a touchdown after flying (hard when it sank faster than the
 * gear takes), as the page's flight block tells it.
 *
 * A `wobble` (0 to 1) makes the student a sloppy one: its height drifts by up to 45 m and its heading by up to 18° on slow
 * swings, so a grade is seen to tell a clean flight from a careless one.
 *
 *   flyTasks(manifest, { seconds?, dt?, wobble? }) → { won, result: 'success' | 'fail' | null, reason, time, met, of, medal,
 *                                             grade?: 'gold' | 'silver' | 'bronze' | 'no medal', kept: { <label>: n },
 *                                             track }
 *
 * Deterministic: the same level, the same flight.
 */
import { composeLive } from '../worlds/controllable/compose.js';
import { composeMechanics } from '../game/mechanics.js';
import { buildBus } from '../worlds/event-bus.js';
import { objectivesOf, objectiveNames } from '../game/objectives.js';
import { GRADE_VAR, GRADE_NAMES } from '../game/grade.js';
import { airspaceOf } from './airspace.js';

let E = null, B = null;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => { const T = 2 * Math.PI; return ((a % T) + T + Math.PI) % T - Math.PI; };
const r1 = (v) => Math.round(v * 10) / 10;
const KT = 1 / 1.94384;
// a heading in compass degrees as the fly rule's (radians from +x, counter-clockwise)
const fromCompass = (deg) => ((90 - deg) * Math.PI) / 180;
// the middle of a band [lo, hi] (either open: a margin inside the closed end); a heading's wraps through north
const middle = ([lo, hi], margin) => (lo === null ? hi - margin : hi === null ? lo + margin : (lo + hi) / 2);
const headingMiddle = ([lo, hi]) => (lo === null || hi === null ? (lo ?? hi) : lo > hi ? ((lo + hi + 360) / 2) % 360 : (lo + hi) / 2);
// a touchdown counts once the craft has flown this high (the page's ARM: not the first frames' settling on the pad)
const ARM = 10;
/** A landing as the student flies it: the glide path's slope (3°), the approach speed as a share over the stall, the
 *  touchdown zone past the threshold (m), the height the flare begins at (m), the sink it is eased to (m/s), the least
 *  height over the runway held while the craft is off the centreline (m). */
export const LANDING = Object.freeze({ slope: 0.0524, approach: 1.35, zone: 150, flare: 7, sink: 0.45, hold: 150 });
/** The runway a landing is flown to: the one whose axis the craft's heading is nearest, at the end it comes at. */
function landingOf(field, heading) {
  const rws = (field.pads ?? []).filter((q) => q.kind === 'runway'), all = rws.length ? rws : field.pads ?? [];
  let best = null;
  for (const R of all) for (const sg of [1, -1]) {
    const d = R.along === 'x' ? [sg, 0] : [0, sg], hd = Math.atan2(d[1], d[0]), off = Math.abs(wrap(hd - heading));
    if (!best || off < best.off) best = { off, d, hd, R };
  }
  const { d, hd, R } = best, half = (R.length ?? 60) / 2, thr = [R.center[0] - d[0] * half, R.center[1] - d[1] * half];
  return { dir: d, hdg: hd, datum: R.datum, tdz: [thr[0] + d[0] * Math.min(LANDING.zone, half), thr[1] + d[1] * Math.min(LANDING.zone, half)] };
}

export function flyTasks(manifest, { seconds = 600, dt = 1 / 30, wobble = 0 } = {}) {
  E ??= composeLive(); B ??= buildBus();
  const P0 = (manifest.entities ?? []).find((e) => e.pilotable);
  const mechanics = manifest.game?.mechanics ?? [], O = objectivesOf(mechanics);
  if (!P0 || P0.rule?.type !== 'fly') return { won: false, result: null, reason: 'no craft to fly', time: 0, met: 0, of: 0, medal: null, kept: {}, track: [] };
  if (!O) return { won: false, result: null, reason: 'no tasks to fly (a course is the autopilot\'s, a fight the dogfight\'s)', time: 0, met: 0, of: 0, medal: null, kept: {}, track: [] };
  const unflown = O.tasks.find((t) => !['band', 'gates', 'reach', 'land'].includes(t.kind));
  if (unflown) return { won: false, result: null, reason: `not flown by the student: a ${unflown.kind} task (${unflown.text})`, time: 0, met: 0, of: O.tasks.length, medal: null, kept: {}, track: [] };
  const { field } = airspaceOf(manifest), top = field.topAt ?? field.groundAt;
  const rule = P0.rule, c = { stall: rule.stallSpeed ?? 25, cruise: rule.cruise ?? 60, lowPass: 40 }, sinkMax = rule.sinkMax ?? 3;
  const world = E.createWorld({ entities: [{ id: 'player', pilotable: true, rule, transform: { ...P0.transform, pos: [...P0.transform.pos] } }] });
  const p = world.byId.player, hooks = { ground: (q) => top(q[0], q[1]) };
  const C = composeMechanics(mechanics, { player: 'player', spawn: p.transform.pos.slice(), fall: 'none' }), ev = C.events;
  const S = B.createBusState(ev, ev.entities ?? []), names = objectiveNames(O.id ?? 'obj');
  const pump = (evs) => { if (evs.length) B.processEvents(S, evs); let w = B.watchEvents(S), g = 0; while (w.length && g++ < 16) { B.processEvents(S, w); w = B.watchEvents(S); } };
  const ends = Object.entries(C.on ?? {});
  const ended = () => { for (const r of S.log) for (const [type, o] of ends) if (r.type === type) return o.end; return null; };
  let prevZ, t = 0, hPrev = p.transform.heading, wasAir = !!p.airborne, armed = false, lastVs = 0, result = null, reason = null, landing = null;
  const track = [];
  pump(ev.initial ?? []);
  while (t < seconds) {
    const k = S.vars[names.task] ?? 0, task = O.tasks[Math.min(k, O.tasks.length - 1)], q = p.transform.pos, v = p.airspeed ?? 0;
    const hRate = wrap(p.transform.heading - hPrev) / dt; hPrev = p.transform.heading;
    // ── what the task in hand asks: a height, a heading (or a point to fly at), a speed ──
    let alt = null, hdg = null, speed = c.cruise;
    const g0 = top(q[0], q[1]);
    if (task.kind === 'band') {
      const Bd = task.band;
      if (Bd.alt) alt = middle(Bd.alt, 20);
      else if (Bd.agl) alt = g0 + middle(Bd.agl, 20);
      if (Bd.heading) hdg = fromCompass(headingMiddle(Bd.heading));
      if (Bd.speed) speed = middle(Bd.speed, 8) * KT;
    } else if (task.kind === 'land') {
      // the runway it comes at, chosen once; onto its centreline and down its glide path to the touchdown zone
      landing ??= landingOf(field, p.transform.heading);
      const L = landing, rx = q[0] - L.tdz[0], ry = q[1] - L.tdz[1], along = rx * L.dir[0] + ry * L.dir[1], across = L.dir[0] * ry - L.dir[1] * rx;
      hdg = L.hdg - clamp(0.004 * across, -0.8, 0.8) * (along < 0 ? 1 : 0.3);
      speed = c.stall * LANDING.approach;
      // the centreline first: off it, the height held (no lower than LANDING.hold over the runway); on it, the glide path
      const agl = q[2] - top(q[0], q[1]) - (rule.eye ?? 0), over = q[2] - (rule.eye ?? 0) - L.datum, lined = Math.abs(across) < 90 + 0.04 * Math.max(0, -along);
      const want = lined ? Math.max(0, -along) * LANDING.slope : Math.max(Math.min(over, LANDING.hold * 1.6), LANDING.hold);
      // (the flare begins higher the faster it sinks; the path never steeper than about six degrees, so it can be flared)
      landing.flare = lined && (agl < Math.max(LANDING.flare, 2.2 * Math.max(0, -(p.climbRate || 0))) || along > 0);
      landing.agl = agl; landing.vz = landing.flare ? -LANDING.sink - 0.15 * Math.max(0, agl) : clamp((lined ? -v * LANDING.slope : 0) + 0.12 * (Math.min(want, over + 40) - over), -v * 0.1, 3);
    } else {
      const at = task.kind === 'gates' ? task.gates[clamp(S.vars[`__${O.id ?? 'obj'}_g${k}`] ?? 0, 0, task.gates.length - 1)].at : task.at;
      alt = at[2]; hdg = Math.atan2(at[1] - q[1], at[0] - q[0]);
    }
    // (a sloppy student's drift: slow swings off the height and the heading)
    if (wobble > 0) { if (alt !== null) alt += wobble * 45 * Math.sin(t / 7); if (hdg !== null && task.kind === 'band') hdg += wobble * 0.32 * Math.sin(t / 9 + 1); }
    // ── the stick: the bank commanded toward the heading (taken out as it comes round), the nose for the height ──
    let turn = 0, lift = 0;
    if (p.airborne) {
      const err = hdg === null ? 0 : wrap(hdg - p.transform.heading), want = clamp(-1.4 * err + 0.6 * hRate, -0.6, 0.6);
      turn = clamp(4 * (want - (p.bank || 0)), -1, 1);
      let pitch = alt === null ? 0 : clamp(0.015 * (alt - q[2]) - 0.15 * (p.climbRate || 0) * 0.1, -0.2, 0.25);
      // (a landing: the nose for the glide path's sink, or the flare's)
      if (task.kind === 'land') pitch = Math.asin(clamp(landing.vz / Math.max(v, 1), -0.18, 0.15));
      // the ground ahead, a few seconds out, pulls the nose up whatever the task asks (but on a landing, which meets it)
      const cosP = Math.cos(p.transform.pitch || 0);
      if (task.kind !== 'land') for (const s of [2, 4, 6]) { const ax = q[0] + Math.cos(p.transform.heading) * cosP * v * s, ay = q[1] + Math.sin(p.transform.heading) * cosP * v * s; if (top(ax, ay) + c.lowPass > q[2] + Math.sin(p.transform.pitch || 0) * v * s) { pitch = 0.25; break; } }
      lift = clamp(4 * (pitch - (p.transform.pitch || 0)), -1, 1);
    } else lift = v > c.stall * 1.15 ? 1 : 0;
    // ── the throttle: full on the ground and in a climb; else the lever toward the speed ──
    // (in the flare the power holds it a little over the stall until the last of it, then the lever to idle; down, the brakes)
    const flaring = task.kind === 'land' && landing && landing.flare && p.airborne;
    if (flaring) speed = c.stall * 1.15;
    const forward = task.kind === 'land' && (!p.airborne || (flaring && landing.agl < 1.5)) ? (p.airborne ? -1 : (armed ? -1 : 1)) : !p.airborne ? 1 : clamp((speed - v) / 4, -1, 1);
    E.stepWorld(world, { turn, lift, forward, lookDY: 0 }, dt, hooks);
    t += dt;
    // ── the bus hears what the page would: zones and gauges, a touchdown after flying, the clocks ──
    const z = B.deriveZoneEvents([p], prevZ, ev.sources ?? []); prevZ = z.prev;
    const incoming = [...z.events];
    if (p.airborne) { lastVs = p.climbRate || 0; if (q[2] - top(q[0], q[1]) > ARM) armed = true; }
    else if (wasAir && armed) { const sink = Math.max(0, -lastVs); incoming.push({ type: 'touchdown', entity: 'player', hard: sink > sinkMax ? 1 : 0, sink: r1(sink) }); }
    wasAir = !!p.airborne;
    pump(incoming);
    pump(B.tickTimers(S, dt));
    pump(B.stepTime(S, dt));
    if (Math.round(t / dt) % 30 === 0) track.push([Math.round(q[0]), Math.round(q[1]), Math.round(q[2])]);
    result = ended();
    if (result) break;
  }
  const met = Math.min(S.vars[names.task] ?? 0, O.tasks.length), medal = Number.isInteger(S.vars[GRADE_VAR]) && result === 'success' ? S.vars[GRADE_VAR] : null;
  if (!result) reason = `ran out of time on task ${met + 1} of ${O.tasks.length} (${O.tasks[Math.min(met, O.tasks.length - 1)].text})`;
  else if (result === 'fail') reason = S.log.some((r) => r.type === 'crash') ? `crashed on task ${met + 1} (${O.tasks[Math.min(met, O.tasks.length - 1)].text})` : `failed on task ${met + 1}`;
  const kept = Object.fromEntries((C.keep ?? []).filter((k) => !k.names).map((k) => [k.label, r1((Number(S.vars[k.var]) || 0) * (k.scale || 1))]));
  return { won: result === 'success', result, reason, time: r1(t), met, of: O.tasks.length, medal, ...(medal !== null ? { grade: GRADE_NAMES[medal] } : {}), kept, track };
}
