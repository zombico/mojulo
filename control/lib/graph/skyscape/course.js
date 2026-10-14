/**
 * THE COURSE — a flight sim's track: gates in the air, planned the way a trackscape plans a lap (roads/trackscape.js),
 * in seconds at the craft's own speed, and laid on the racing primitives: each gate is a checkpoint of the `laps`
 * mechanic in three dimensions (`planar: false`), so the race's order, laps, time and place all hold unchanged.
 *
 *   the line    a closed loop through the field (an ellipse on its middle, wobbled by seeded noise), turned so the
 *               first gate is the first one ahead of the runway's departure end (the end it takes off toward)
 *   the gates   spaced GATE_S seconds apart at cruise; each faces along the line; its height weaves between a low pass
 *               and a high one, never steeper from gate to gate than the craft can climb, and lifted wherever the ground
 *               between two gates would stand in the way. A craft with no engine cannot climb: its course is flown
 *               once, downhill, each gate no lower under the next than its glide ratio allows, from where it is
 *               launched to the runway
 *   the finish  the runway's touchdown box: after the last gate, land on it (flightLaps: a touchdown off a pad or harder
 *               than the gear takes is a crash, and the craft comes back at the last gate it passed)
 *   the look    a ring gate is a scapeshift block (era/blocks.js `ring`): a hoop and a lit inner band, built at its ring
 *
 *   planCourse(map, field, { gates?, laps?, land?, seed? }) → { gates, finish, line, laps, laws, faces }
 *   courseLaws(course, map, field) → [{ law, ok, note }]
 *   flightLaps(course, map, field, seat) → the laps mechanic's { checkpoints, laps, land, respawn }
 *
 * Pure, deterministic.
 */
import { buildBlock } from '../era/blocks.js';
import { gnoise } from '../polygonizer/landform.js';
import { ROOF_CELL } from './city.js';
import { spaceHeights, spaceGateR } from './space.js';
import * as dmath from '../../util/dmath.js';

/** s of cruise between gates; the least a gate may be apart (s); a light craft's steepest gate-to-gate climb. */
export const GATE_S = 9, GATE_MIN_S = 4, CLIMB = 0.12;
/** The ring gate: its hoop's radius in the craft's top speed (a gate a second-and-a-bit wide at max), on its rails. */
export const RING_GATE = Object.freeze({
  id: 'ring-gate', read: 'a ring gate: a hoop to fly through, a lit band round its inside', tier: 'installation', mounts: ['socket'], functions: ['signal'],
  params: { r: [6, 40], tube: [0.4, 1.6] },
  parts: [
    { id: 'hoop', prim: 'ring', role: 'frame', r: 'r', tube: 'tube', sides: 24, axis: 'x', group: 'tech:frame', value: 0.7 },
    { id: 'band', prim: 'ring', role: 'status', r: 'r - tube * 1.6', tube: 'tube * 0.35', sides: 24, axis: 'x', group: 'tech:light', value: 0.9 },
  ],
  sig: ['hoop'], lead: 'hoop',
});
/** An atmosphere gate's radius rail (m): a space gate (space.js) takes the block's wider one. */
const AIR_R = [6, 30];
/** The colours a gate is painted (frame, its lit band, the next gate's band) and the finish's. */
const PAINT = { frame: [236, 150, 48], band: [255, 236, 140], next: [120, 220, 255] };

const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const shade = (rgb, v) => `rgb(${rgb.map((c) => Math.round(clamp(c * (0.55 + 0.5 * v), 0, 255))).join(',')})`;

/** The loop through the field: n points on a wobbled ellipse, counter-clockwise. */
function loopLine(F, n, seed) {
  const a = 0.62 * F.hx, b = 0.62 * F.hy, out = [];
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n, w = 1 + 0.18 * gnoise(dmath.cos(t) * 1.3, dmath.sin(t) * 1.3, seed + 21);
    out.push([a * w * dmath.cos(t), b * w * dmath.sin(t)]);
  }
  return out;
}

/** The highest surface at a point: the ground, or a city's roof (city.js). */
const topAt = (field) => field.topAt ?? field.groundAt;
/** The step a leg is read at: the ground's cell, or a roof's when the map has a city (a tower is a few roof cells). */
const readStep = (field) => (field.cityFaces && field.cityFaces.length ? Math.min(field.bounds.cell, ROOF_CELL) : field.bounds.cell);
/** The highest surface along a leg (sampled every ~step). */
function legTop(field, p, q, step) {
  const L = dmath.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(2, Math.ceil(L / step));
  let top = -Infinity; for (let i = 0; i <= n; i++) { const t = i / n; top = Math.max(top, topAt(field)(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)); }
  return top;
}

export function planCourse(map, field, { gates: nAsk, laps = 1, land = true, seed = 1 } = {}) {
  const c = map.craft, F = map.rings.field;
  // the loop's length at cruise sets how many gates fit at GATE_S apart (or the count asked, at least GATE_MIN_S apart)
  const probe = loopLine(F, 96, seed); let len = 0; for (let k = 0; k < probe.length; k++) { const p = probe[k], q = probe[(k + 1) % probe.length]; len += dmath.hypot(q[0] - p[0], q[1] - p[1]); }
  const fit = Math.max(3, Math.floor(len / (c.cruise * GATE_S)));
  const n = Number.isInteger(nAsk) ? clamp(nAsk, 3, Math.max(3, Math.floor(len / (c.cruise * GATE_MIN_S)))) : fit;
  // resample the loop at equal arc lengths
  const pts = [], step = len / n; let acc = 0, k = 0, want = 0;
  while (pts.length < n) {
    const p = probe[k % probe.length], q = probe[(k + 1) % probe.length], seg = dmath.hypot(q[0] - p[0], q[1] - p[1]);
    if (acc + seg >= want) { const t = (want - acc) / seg; pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); want += step; continue; }
    acc += seg; k++;
  }
  // the first gate: the first ahead of the runway's departure end (the loop is flown counter-clockwise)
  const pad = field.pads[0] || null;
  // the departure end and its direction (ground.js: the end whose ground ahead rises least)
  const dir = pad?.depart ?? 1, depDir = pad ? (pad.along === 'y' ? [0, dir] : [dir, 0]) : [0, 1];
  const dep = pad ? (pad.along === 'y' ? [pad.center[0], dir > 0 ? pad.y1 : pad.y0] : [dir > 0 ? pad.x1 : pad.x0, pad.center[1]]) : [0, -F.hy];
  let first = 0, best = -Infinity;
  pts.forEach((p, i) => { const dx = p[0] - dep[0], dy = p[1] - dep[1], d = dmath.hypot(dx, dy) || 1, ahead = (dx * depDir[0] + dy * depDir[1]) / d; const score = ahead - d / (4 * F.hx); if (score > best) { best = score; first = i; } });
  const ring = [...pts.slice(first), ...pts.slice(0, first)];
  // in space (space.js): nothing to clear, nothing to land on; the loop weaves up and down through the field
  if (map.form === 'void') return finishCourse(map, field, ring, spaceHeights(map, ring, seed), { laps, land: false, seed, open: false });
  const low = c.lowPass, clear = 1.5 * low, cell = readStep(field), glides = c.engine === false;
  if (glides) {
    // downhill: from the last gate back, each gate the higher of its own clearance and the next one's plus the height
    // the glide between them spends (with a fifth in hand)
    const z = ring.map(() => 0), n2 = ring.length;
    // the last gate high enough to glide on to the landing's approach fix and turn onto it (half a turn circle round)
    const app = land && pad ? approachTo(map, pad) : null, last = ring[n2 - 1];
    const toFix = app ? app.faf[2] + 1.25 * (dmath.hypot(app.faf[0] - last[0], app.faf[1] - last[1]) + Math.PI * map.eye.turn.cruise) / c.glide : -Infinity;
    for (let i = n2 - 1; i >= 0; i--) {
      const need = topAt(field)(ring[i][0], ring[i][1]) + 2 * low;
      if (i === n2 - 1) { z[i] = Math.max(need, toFix); continue; }
      const d = dmath.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]), top = legTop(field, ring[i], ring[i + 1], cell) + clear;
      z[i + 1] = Math.max(z[i + 1], top);   // both ends over the leg's highest ground (a later gate higher only gives more height to spend)
      z[i] = Math.max(need, top, z[i + 1] + 1.2 * d / c.glide);
    }
    return finishCourse(map, field, ring, z, { laps: 1, land, seed, open: true });
  }
  // heights: a weave between the low pass and four, clamped to the climb a gate-to-gate leg allows, lifted over the ground
  const z = ring.map((p, i) => topAt(field)(p[0], p[1]) + low * (2 + 1.5 * (0.5 + 0.5 * gnoise(i * 0.7, 3.3, seed + 31))));
  const top = map.ceiling - (Math.min(AIR_R[1], Math.max(AIR_R[0], c.max * 0.3)));   // a gate's top under the ceiling
  // lifting a gate to ease one leg steepens the leg before it, round the loop: repeat until nothing moves (only ever
  // raising, under the ceiling, so it settles)
  const tops = ring.map((p, i) => Math.min(top, legTop(field, p, ring[(i + 1) % ring.length], cell) + clear));
  for (let pass = 0, moved = true; moved && pass < 4 * ring.length; pass++) {
    moved = false;
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      if (z[i] < tops[i]) { z[i] = tops[i]; moved = true; }
      if (z[j] < tops[i]) { z[j] = tops[i]; moved = true; }
      const d = dmath.hypot(ring[j][0] - ring[i][0], ring[j][1] - ring[i][1]), dz = z[j] - z[i], cap = CLIMB * d;
      // never steeper than the craft climbs: lift the lower end (to the cap, or as high as the ceiling lets it)
      if (dz > cap + 1e-6) { const nz = Math.min(top, z[j] - cap); if (nz > z[i] + 1e-6) { z[i] = nz; moved = true; } }
      else if (-dz > cap + 1e-6) { const nz = Math.min(top, z[i] - cap); if (nz > z[j] + 1e-6) { z[j] = nz; moved = true; } }
    }
  }
  return finishCourse(map, field, ring, z, { laps, land, seed, open: false });
}

/** The gates from the line and its heights, the finish on the runway, the look, the laws. */
function finishCourse(map, field, ring, z, { laps, land, seed, open }) {
  const c = map.craft, pad = field.pads[0] || null;
  const radius = c.space ? spaceGateR(c) : r2(clamp(c.max * 0.3, AIR_R[0], AIR_R[1]));
  const gates = ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length], o = ring[(i - 1 + ring.length) % ring.length];
    const heading = dmath.atan2(q[1] - o[1], q[0] - o[0]);
    return { id: `gate-${i + 1}`, at: [r2(p[0]), r2(p[1]), r2(z[i])], heading: r2(heading), radius };
  });
  // the finish: the runway's own rectangle, a touchdown box TOUCHDOWN_H high over its datum (the craft is in it only on
  // the way down or on the wheels); `radius` is the box's reach in plan, for a reader that wants one number
  const finish = land && pad ? { at: [pad.center[0], pad.center[1], r2(pad.datum + TOUCHDOWN_H / 2)], half: padHalf(pad), radius: r2(Math.max(pad.x1 - pad.x0, pad.y1 - pad.y0) / 2), pad: pad.id } : null;
  // the look: each gate a ring-gate block, its hoop facing along the line
  const faces = [];
  gates.forEach((g, i) => {
    const B = buildBlock(RING_GATE, { params: { r: g.radius, tube: r2(clamp(g.radius * 0.05, 0.4, 1.6)) }, seed: seed + i, at: [g.at[0], g.at[1], g.at[2]], yaw: g.heading });
    for (const f of B.faces) faces.push({ corners: f.corners, fill: shade(f.group === 'tech:light' ? (i === 0 ? PAINT.next : PAINT.band) : PAINT.frame, f.value ?? 0.6), group: `course:${g.id}` });
  });
  const course = { gates, finish, laps, open, line: ring.map((p) => [r2(p[0]), r2(p[1])]), faces };
  course.laws = courseLaws(course, map, field);
  return course;
}

/** A landing's approach (flown by the autopilot, budgeted by a glider's course): its slope (rise over run, ~4°), its
 *  speed over the stall, the final's length in seconds at that
 *  speed (at least FINAL_TURNS turn circles), the aim point (m in from the end it crosses), and the flare: its height
 *  (m) and the sink it settles to there, as a share of what the gear takes. */
export const GLIDE = 0.07, APPROACH = 1.3, FINAL_S = 25, FINAL_TURNS = 2.5, AIM = 150, FLARE = Object.freeze({ agl: 6, sink: 0.4 });

/** The landing on a pad: its heading (against the departure), the aim point AIM in from the end it crosses, the
 *  final approach fix and the intercept out along the extended centreline, their heights on the glide slope. */
export function approachTo(map, pad) {
  const c = map.craft, vApp = APPROACH * c.stall, rTurn = map.eye.turn.cruise;
  const ax = pad.along === 'x' ? [1, 0] : [0, 1], dir = -(pad.depart ?? 1);
  const half = pad.length / 2, heading = Math.atan2(ax[1] * dir, ax[0] * dir);
  const at = (s) => [pad.center[0] - ax[0] * dir * s, pad.center[1] - ax[1] * dir * s];   // s metres short of the centre
  const a = half - Math.min(AIM, half / 2), final = Math.max(FINAL_S * vApp, FINAL_TURNS * rTurn), fafS = a + final, ifS = fafS + 2 * rTurn;
  const z = (s) => pad.datum + (s - a) * GLIDE;
  return { heading, vApp, aim: [...at(a), pad.datum], faf: [...at(fafS), z(fafS)], intercept: [...at(ifS), z(ifS)], axis: [ax[0] * dir, ax[1] * dir] };
}

/** A touchdown box's height (m): from the datum to well over the wheels, so the craft is in it from the flare. */
export const TOUCHDOWN_H = 30;
/** A pad's touchdown box's half-extents [hx, hy, hz]. */
const padHalf = (p) => [r2((p.x1 - p.x0) / 2), r2((p.y1 - p.y0) / 2), TOUCHDOWN_H / 2];

/** The checkpoints the `laps` mechanic takes: each gate (in three dimensions), then the finish on the runway, landed on. */
export function courseCheckpoints(course) {
  return [...course.gates.map((g) => ({ at: g.at, radius: g.radius, planar: false })), ...(course.finish ? [{ at: course.finish.at, half: course.finish.half, planar: false, land: true }] : [])];
}

/**
 * The `laps` mechanic's parameters for a flight: the checkpoints, the laps, and two things a flight adds to a race —
 *   land     every pad's touchdown box: a touchdown inside one with a sink rate the craft's gear takes is a landing (the
 *            finish needs one); a touchdown anywhere else (a field, a hillside, a roof) or a harder one is a crash
 *   respawn  where a crash puts the craft back: before the first gate, its seat on the runway; after a gate, that gate,
 *            at cruise, heading for the next one
 */
export function flightLaps(course, map, field, seat) {
  const G = course.gates, cps = courseCheckpoints(course);
  const toward = (a, b) => r2(dmath.atan2(b[1] - a[1], b[0] - a[0]));
  // the start: on the runway, or aloft for a craft with no engine and in space (nothing to stand on)
  const respawn = [{ spot: seat.transform.pos.map(r2), heading: r2(seat.transform.heading), aloft: seat.rule.engine === false || map.form === 'void' ? 1 : 0 }];
  for (let j = 0; j + 1 < cps.length; j++) respawn.push({ spot: G[j % G.length].at, heading: toward(cps[j].at, cps[j + 1].at), aloft: 1 });
  return { kind: 'laps', checkpoints: cps, laps: course.laps ?? 1, ...(field.pads.length ? { land: { pads: field.pads.map((p) => ({ at: [p.center[0], p.center[1], r2(p.datum + TOUCHDOWN_H / 2)], half: padHalf(p) })) } } : {}), respawn };
}

/**
 * The course's laws, advising:
 *   spacing    every gate at least GATE_MIN_S apart at cruise
 *   turns      no turn between gates tighter than the craft's turn circle at cruise
 *   clear      every leg clears the ground under it by the low pass's share
 *   climb      no leg steeper than the climb a light craft holds
 *   in-reach   every gate inside the field and under the ceiling
 */
export function courseLaws(course, map, field) {
  const c = map.craft, G = course.gates, F = map.rings.field, out = [];
  const legs = (course.open ? G.slice(0, -1) : G).map((g, i) => [g, G[(i + 1) % G.length]]);
  const dist = (a, b) => dmath.hypot(b.at[0] - a.at[0], b.at[1] - a.at[1]);
  const minS = Math.min(...legs.map(([a, b]) => dist(a, b) / c.cruise));
  out.push({ law: 'spacing', ok: minS >= GATE_MIN_S - 1e-6, note: `the closest gates are ${r2(minS)} s apart at cruise (at least ${GATE_MIN_S})` });
  // a turn's radius from three gates in a row: the circle through them
  const rTurn = (a, b, q) => { const ax = a.at[0], ay = a.at[1], bx = b.at[0], by = b.at[1], cx = q.at[0], cy = q.at[1]; const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)); if (Math.abs(d) < 1e-9) return Infinity; const A = dmath.hypot(bx - ax, by - ay), B = dmath.hypot(cx - bx, cy - by), C = dmath.hypot(cx - ax, cy - ay); return (A * B * C) / Math.abs(d); };
  const inner = course.open ? G.slice(1, -1).map((g, k) => k + 1) : G.map((g, i) => i);   // an open course turns only between its ends
  const tight = Math.min(Infinity, ...inner.map((i) => rTurn(G[(i - 1 + G.length) % G.length], G[i], G[(i + 1) % G.length])));
  out.push({ law: 'turns', ok: tight >= map.eye.turn.cruise - 1e-6, note: `the tightest turn is ${r2(tight)} m; the craft turns in ${map.eye.turn.cruise} m at cruise` });
  if (map.form === 'void') {
    // in space: no ground to clear (space.js keeps the rocks off the legs) and no climb, only how steep the nose goes
    const steep = Math.max(...legs.map(([a, b]) => Math.atan2(Math.abs(b.at[2] - a.at[2]), Math.max(1, dist(a, b)))));
    out.push({ law: 'pitch', ok: steep <= 0.6 + 1e-6, note: `the steepest leg is ${r2(steep * 180 / Math.PI)}° (at most ${r2(0.6 * 180 / Math.PI)}°)` });
    const inZ = G.every((g) => Math.abs(g.at[0]) <= F.hx && Math.abs(g.at[1]) <= F.hy && Math.abs(g.at[2]) <= F.hz);
    out.push({ law: 'in-reach', ok: inZ, note: inZ ? 'every gate is in the field' : 'a gate stands outside the field' });
    return out;
  }
  const cell = readStep(field), clear = Math.min(...legs.map(([a, b]) => { const L = dist(a, b), n = Math.max(2, Math.ceil(L / cell)); let m = Infinity; for (let i = 0; i <= n; i++) { const t = i / n, x = a.at[0] + (b.at[0] - a.at[0]) * t, y = a.at[1] + (b.at[1] - a.at[1]) * t, zz = a.at[2] + (b.at[2] - a.at[2]) * t; m = Math.min(m, zz - topAt(field)(x, y)); } return m; }));
  out.push({ law: 'clear', ok: clear >= c.lowPass - 1e-6, note: `the lowest leg passes ${r2(clear)} m over the ground or a roof (at least the low pass, ${c.lowPass} m)` });
  // (gates are kept to the centimetre, so a leg at the limit may read a hair over it)
  if (c.engine === false) {
    const up = Math.max(...legs.map(([a, b]) => b.at[2] - a.at[2]));
    out.push({ law: 'climb', ok: up <= 0.05, note: up <= 0.05 ? 'every leg glides down: a craft with no engine never has to climb' : `a leg climbs ${r2(up)} m, and the craft has no engine` });
  } else {
    const steep = Math.max(...legs.map(([a, b]) => Math.abs(b.at[2] - a.at[2]) / Math.max(1, dist(a, b))));
    out.push({ law: 'climb', ok: steep <= CLIMB + 1e-3, note: `the steepest leg climbs ${r2(100 * steep)}% (at most ${100 * CLIMB}%)` });
  }
  const inside = G.every((g) => Math.abs(g.at[0]) <= F.hx && Math.abs(g.at[1]) <= F.hy && g.at[2] <= map.ceiling);
  out.push({ law: 'in-reach', ok: inside, note: inside ? 'every gate is in the field and under the ceiling' : 'a gate stands outside the field or over the ceiling' });
  return out;
}
