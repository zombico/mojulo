/**
 * cycle-common — the shared kit of the cycle shelf: the craft shelf's neutral geometry (lathe, sweep, the straight
 * extrude and loft authored in world offsets), the military hull kit's bend, the veh-* shelf's six colour roles, and the
 * vector helpers every builder uses. Nothing here is the craft shelf's flight: no span, no thrust, no nav lights.
 *
 * Cycle space is the craft shelf's: +y forward, +z up, +x right, true metres. A machine is authored in ITS OWN frame:
 * the ground is z = 0, the rear tyre meets it at the origin and the front at y = wheelbase, so the line the machine
 * leans about is the y axis.
 */

import { VEH_COLOR_ROLES } from '../vehicle-designer/veh-common.js';

export { DEG, clone, extrudeWorld, lathe, loftWorld, round3, sweep, tone } from '../craft-shelf/craft-common.js';
export { bend } from '../car-designer/mil-hull.js';

export const CYCLE_COLOR_ROLES = VEH_COLOR_ROLES;

/**
 * The palettes, in the six roles: `paint` the plastics or the tank, `trim` the dark castings and cases, `chrome` bare
 * metal (the frame, the spokes, the bars), `rubber` the tyres, the grips and the seat, `glass` a lens, `light` a number
 * board's field (a lamp, when one is drawn, is made to glow by its own material).
 * No maker's colours: a plastic is a colour, never a brand's.
 */
export const CYCLE_PALETTES = {
  // a motocross machine's red plastics on a bare aluminium frame
  mxRed: { paint: '#c4362c', trim: '#2a2c2f', glass: '#20262c', rubber: '#18191b', chrome: '#b8bdc2', light: '#f3efe2' },
  // white plastics, blue seat-side graphics' trim
  mxWhite: { paint: '#e9eaeb', trim: '#2b3a66', glass: '#20262c', rubber: '#18191b', chrome: '#b8bdc2', light: '#f3efe2' },
  // a road machine's red tank and tail over dark castings
  roadRed: { paint: '#a8231d', trim: '#26282b', glass: '#2a3640', rubber: '#17181a', chrome: '#a9aeb3', light: '#f4f0e4' },
  // a sport bike's deep blue bodywork, dark wheels
  sportBlue: { paint: '#1f4f9c', trim: '#1e2023', glass: '#3a4a5a', rubber: '#161719', chrome: '#a3a8ad', light: '#f4f0e4' },
  // a grand prix machine's white bodywork, its number boards cream
  raceWhite: { paint: '#eceeef', trim: '#23252a', glass: '#3c4b58', rubber: '#141516', chrome: '#9ea3a8', light: '#f1e7c8' },
  // a cruiser's gloss black and its chrome
  cruiserBlack: { paint: '#141518', trim: '#2c2e31', glass: '#2a3640', rubber: '#161719', chrome: '#c9ced3', light: '#f4f0e4' },
  // a scooter's pale mint body and its cream trim
  scooterMint: { paint: '#9fd1bf', trim: '#3a3d40', glass: '#2a3640', rubber: '#18191b', chrome: '#b8bdc2', light: '#f4f0e4' },
  // an underbone's blue plastics on a dark frame
  mopedBlue: { paint: '#2d64a8', trim: '#2a2c2f', glass: '#2a3640', rubber: '#18191b', chrome: '#b8bdc2', light: '#f4f0e4' },
  // a bicycle's green frame
  bikeGreen: { paint: '#2f6b4a', trim: '#232527', glass: '#2a3640', rubber: '#1c1d1f', chrome: '#b6bbc0', light: '#f4f0e4' },
  // a pedelec's graphite frame and its black battery
  ebikeGrey: { paint: '#5a6068', trim: '#2a2d31', glass: '#2a3640', rubber: '#1c1d1f', chrome: '#b6bbc0', light: '#f4f0e4' },
  // an auto rickshaw's green body and yellow roof are its paint (one colour a machine: the roof its trim's dark)
  tuktukGreen: { paint: '#2f8a45', trim: '#1f2224', glass: '#2a3640', rubber: '#18191b', chrome: '#b8bdc2', light: '#f4f0e4' },
  // a pedicab's blue frame and its hood
  rickshawBlue: { paint: '#2b5aa0', trim: '#232527', glass: '#2a3640', rubber: '#1c1d1f', chrome: '#b6bbc0', light: '#f4f0e4' },
  // the looks' palettes (cycle-looks.js)
  policeWhite: { paint: '#f1f2f3', trim: '#1d3f86', glass: '#2a3640', rubber: '#17181a', chrome: '#b2b7bc', light: '#f4f0e4' },
  fieldOlive: { paint: '#4f5538', trim: '#2b2e24', glass: '#2a3028', rubber: '#1a1b18', chrome: '#6c7066', light: '#d8d2b8' },
  blackout: { paint: '#1a1b1d', trim: '#121314', glass: '#1e252b', rubber: '#141516', chrome: '#3a3c3f', light: '#d8d8d4' },
  classicCream: { paint: '#e8dcbc', trim: '#5b1f24', glass: '#2a3640', rubber: '#1c1d1f', chrome: '#d4d8dc', light: '#f4f0e4' },
};

/** A palette id plus per-role overrides → { id, colors }. */
export function resolveCyclePalette(palette, colors = {}, fallback = 'mxRed') {
  const id = palette || fallback;
  const base = CYCLE_PALETTES[id];
  if (!base) throw new Error(`Unknown cycle palette '${id}' - expected one of: ${Object.keys(CYCLE_PALETTES).join(', ')}`);
  const out = { ...base };
  for (const [role, value] of Object.entries(colors || {})) {
    if (!CYCLE_COLOR_ROLES.includes(role)) throw new Error(`Unknown cycle color role '${role}' - expected one of: ${CYCLE_COLOR_ROLES.join(', ')}`);
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`cycle color '${role}' must be a #RRGGBB hex string; received ${JSON.stringify(value)}`);
    out[role] = value.toLowerCase();
  }
  return { id, colors: out };
}

// ── vectors ─────────────────────────────────────────────────────────────────
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => { const d = len(a) || 1; return [a[0] / d, a[1] / d, a[2] / d]; };
export const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
/** A point on the right (side 'r', +x) or the left ('l', −x): the same point mirrored. */
export const sided = (p, side) => (side === 'l' ? [-p[0], p[1], p[2]] : [...p]);
export const sideSign = (side) => (side === 'l' ? -1 : 1);

/** Two unit directions square to an axis, (u, v) with u × v along the axis: a section's frame. */
export function basis(axis) {
  const a = unit(axis);
  const u = unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 0, 1]));
  return [u, cross(a, u)];
}

/** A closed loop of k points round `c` in the plane square to `axis` (the first point repeated last: a sweep's ring). */
export function ring(c, axis, R, k = 24, phase = 0) {
  const [u, v] = basis(axis);
  return Array.from({ length: k + 1 }, (_, i) => { const t = phase + (2 * Math.PI * (i % k)) / k; return add(c, add(mul(u, R * Math.cos(t)), mul(v, R * Math.sin(t)))); });
}

/** A rectangle's corners as world offsets square to an extrude axis, CCW about it: `w` across `u`, `h` across `v`. */
export function rect(axis, w, h, up = [0, 0, 1]) {
  const a = unit(axis);
  let v = sub(up, mul(a, dot(up, a)));
  if (len(v) < 1e-6) v = sub([0, 1, 0], mul(a, a[1]));
  v = unit(v);
  const u = cross(v, a);
  return [add(mul(u, w / 2), mul(v, -h / 2)), add(mul(u, w / 2), mul(v, h / 2)), add(mul(u, -w / 2), mul(v, h / 2)), add(mul(u, -w / 2), mul(v, -h / 2))];
}

/** A rounded rectangle's corners (`r` the corner's radius, `k` points a corner), CCW about the axis. */
export function roundRect(axis, w, h, r, k = 3, up = [0, 0, 1]) {
  const a = unit(axis);
  let v = sub(up, mul(a, dot(up, a)));
  if (len(v) < 1e-6) v = sub([0, 1, 0], mul(a, a[1]));
  v = unit(v);
  const u = cross(v, a);
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const corners = [[w / 2 - rr, -h / 2 + rr, -Math.PI / 2], [w / 2 - rr, h / 2 - rr, 0], [-w / 2 + rr, h / 2 - rr, Math.PI / 2], [-w / 2 + rr, -h / 2 + rr, Math.PI]];
  const out = [];
  for (const [cu, cv, a0] of corners) for (let i = 0; i <= k; i++) {
    const t = a0 + ((Math.PI / 2) * i) / k;
    out.push(add(mul(u, cu + rr * Math.cos(t)), mul(v, cv + rr * Math.sin(t))));
  }
  return out;
}
