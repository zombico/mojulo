/**
 * THE CRAFT ON THE FLY RULE — a class's envelope (eye.js CRAFT) as the fly rule's numbers
 * (worlds/controllable/rules-fly.js), so a level's aircraft flies like its class without hand tuning:
 *
 *   drag      thrust balances drag at top speed (T = k·v²), so full throttle tops out at the class's max; a glider
 *             has no thrust, so its drag comes from its glide ratio (D = W / (L/D) at best-glide speed, its cruise)
 *   speeds    the stall, rotation at 1.15 × the stall, the top speed
 *   attitude  the class's normal bank limit; a light craft's nose moves gently, a jet's quickly and higher
 *   dials     a throttle lever (the cockpit's, held where it is left), no engine on a glider, the map's reach as the
 *             bound it is turned back at
 *   landing   the sink rate its gear takes at touchdown (`sinkMax`: harder is a crash) and its cruise (where a crash puts
 *             it back aloft); with a city on the map, its roofs (`roofs`), which the page counts as ground; with a
 *             course, the course (`course`: its gates and the landing's approach) the page guides it by. The fly rule
 *             reads none of these: the page's flight block does
 *
 *   flyRule(craft, { map?, lever?, assist? }) → the rule ({ type: 'fly', … }); `assist`: 'arcade' | 'sim' (rules-fly.js)
 *
 * Pure, deterministic.
 */
import { craftOf, G } from './eye.js';
import { approachTo, GLIDE } from './course.js';
import { spaceSeat } from './space.js';

const DEG = Math.PI / 180;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export function flyRule(craftSpec = 'trainer', { map = null, lever = true, assist = null } = {}) {
  const c = craftOf(craftSpec);
  const engine = c.engine !== false && c.thrust > 0;
  const drag = engine ? c.thrust / (c.max * c.max) : (c.mass * G) / (c.glide * c.cruise * c.cruise);
  return {
    type: 'fly', mass: c.mass, ...(engine ? { thrust: c.thrust } : { engine: false }), drag: r3(drag),
    stallSpeed: c.stall, takeoffSpeed: r3(c.stall * 1.15), maxSpeed: c.max,
    // a light craft's nose moves gently and stops short of a steep climb (a trainer climbs at ~10°, its stall ~16°);
    // a fast jet's moves quickly and goes higher
    bankMax: r3(c.bankMax * DEG), pitchMax: c.max > 150 ? 0.9 : 0.4, pitchRate: c.max > 150 ? 0.9 : 0.35,
    ...(lever && engine ? { lever: true } : {}), ...(assist === 'arcade' || assist === 'sim' ? { assist } : {}),
    // a space craft: no lift, no gravity; it turns at its own rate, the rate that gives the coordinated turn's radius
    // at cruise (so the eye's turn circle holds), and its nose goes nearly vertical
    ...(c.space ? { gravity: false, lift: false, turnRate: r3((G * Math.tan(c.bankMax * DEG)) / c.cruise), pitchMax: 1.3, pitchRate: 1.1, space: true } : {}),
    ...(map ? { bound: { hx: map.rings.reach.hx, hy: map.rings.reach.hy, warn: 5, ...(map.rings.reach.hz ? { hz: map.rings.reach.hz } : {}) } } : {}),
    eye: 1.2, sinkMax: c.sink ?? 3, cruise: c.cruise,
  };
}

/**
 * Where a craft is seated on a map: on the first pad's DEPARTURE threshold (the end it takes off away from, ground.js),
 * its nose down the runway; with no pad, the field's south edge looking north. A craft with no engine is launched aloft,
 * flying, high enough to glide to the course's first gate with a fifth in hand (or four low passes up, with no course).
 * → { rule, transform: { pos, heading, pitch }, ground, end } (`end`: the far end of the runway, where the view looks)
 */
export function seatCraft(map, field, course = null, { assist = null } = {}) {
  const c = map.craft, base = flyRule(c.key === 'custom' ? c : c.key, { map, assist }), aloft = base.engine === false;
  if (map.form === 'void') {
    // in space (space.js): behind the first gate, flying at cruise, the lever where cruise holds it; the rocks its
    // obstacles (spheres the page counts as a crash), the course its guidance
    const t = course ? spaceSeat(map, course) : { pos: [0, -map.rings.field.hy, 0], heading: Math.PI / 2, pitch: 0 };
    const guide = course ? { gates: course.gates.map((g) => [...g.at, g.radius, g.heading]) } : null;
    const rule = { ...base, launchSpeed: c.cruise, leverStart: r2((c.cruise / c.max) ** 2), ...(field.asteroids?.length ? { obstacles: field.asteroids.flat() } : {}), ...(guide ? { course: guide } : {}) };
    return { rule, transform: t, ground: t.pos[2], end: course ? course.gates[0].at : [0, 0, 0] };
  }
  const pad = field.pads[0] ?? null, F = map.rings.field;
  let sx, sy, heading, end;
  if (pad) {
    const dir = pad.depart ?? 1;
    if (pad.along === 'y') { heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; sx = pad.center[0]; sy = dir > 0 ? pad.y0 + 20 : pad.y1 - 20; end = [pad.center[0], dir > 0 ? pad.y1 : pad.y0]; }
    else { heading = dir > 0 ? 0 : Math.PI; sy = pad.center[1]; sx = dir > 0 ? pad.x0 + 20 : pad.x1 - 20; end = [dir > 0 ? pad.x1 : pad.x0, pad.center[1]]; }
  } else { sx = 0; sy = -F.hy; heading = Math.PI / 2; end = [0, F.hy]; }
  const gz = field.groundAt(sx, sy);
  let z = gz + base.eye;
  if (aloft) {
    const g0 = course?.gates?.[0]?.at;
    z = Math.max(gz + 4 * c.lowPass, g0 ? g0[2] + 1.2 * Math.hypot(g0[0] - sx, g0[1] - sy) / c.glide : -Infinity);
  }
  // the course as the page's guidance reads it: each gate [x, y, z, radius, heading], and the landing's approach (the aim
  // point, the landing heading and the slope) for the glide-slope lights
  const fin = course?.finish ? field.pads.find((q) => q.id === course.finish.pad) ?? pad : null, app = fin ? approachTo(map, fin) : null;
  const guide = course ? { gates: course.gates.map((g) => [...g.at, g.radius, g.heading]), ...(app ? { land: { aim: app.aim.map(r2), heading: r2(app.heading), glide: GLIDE } } : {}) } : null;
  const rule = { ...base, ...(aloft ? { launchSpeed: c.cruise } : {}), ...(field.roofs && field.roofs.length ? { roofs: field.roofs } : {}), ...(guide ? { course: guide } : {}) };
  return { rule, transform: { pos: [sx, sy, Math.round(z * 100) / 100], heading, pitch: 0 }, ground: gz, end: [end[0], end[1], pad ? pad.datum : field.groundAt(end[0], end[1])] };
}

/** The craft as a level's pilot: its entity (seated, on its rule; a slab for a body until the aircraft roster) and the
 *  chase camera that banks with it. `seat` is seatCraft's. → { entities, camera } */
export function craftPilot(map, seat) {
  const c = map.craft;
  return {
    // `player`, as every level's pilotable is: the level's zones (its gates, its pads) watch that id
    entities: [{ id: 'player', pilotable: true, rule: seat.rule, ambient: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [r2(c.max / 10), r2(c.max / 7), 0.8], color: '#e9eef4' }, transform: seat.transform }],
    camera: { rule: 'follow', target: 'player', dist: r2(c.max / 4), height: r2(c.max / 16), lead: 8, lookH: 1.5, rollFollow: 1 },
  };
}
