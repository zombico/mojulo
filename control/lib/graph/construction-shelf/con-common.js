/**
 * con-common — the shared kit of the construction shelf: the cycle shelf's neutral geometry and vectors (themselves the
 * craft shelf's lathe, sweep, extrude and loft authored in world offsets), the veh-* shelf's six colour roles, the
 * shelf's palettes, and the rigid transforms its chain is made of.
 *
 * Construction space is the cycle shelf's axes: +y forward, +z up, +x right, true metres. A machine is authored in ITS
 * OWN frame: the ground is z = 0 and the slew axis (a crawler's centre, the turntable's) the z axis through the origin.
 * A body on the chain (a boom, a stick, a tool) is authored in ITS OWN frame: its pivot the origin, along +y at its
 * joint's zero, +z its back (the side away from the curl).
 */

import { VEH_COLOR_ROLES } from '../vehicle-designer/veh-common.js';

export {
  DEG, add, basis, bend, clone, cross, dot, extrudeWorld, lathe, len, lerp, loftWorld, mul, rect, ring, round3, roundRect,
  sided, sideSign, sub, sweep, tone, unit,
} from '../cycle-shelf/cycle-common.js';
export { box, curve, panel, pod, spin, strip, tube } from '../cycle-shelf/cycle-kit.js';

export const CON_COLOR_ROLES = VEH_COLOR_ROLES;

/**
 * The palettes, in the six roles: `paint` the machine's colour (its house, its boom, its frames), `trim` the dark
 * castings, the undercarriage and the counterweight's black, `chrome` a ram's bright rod and bare pins, `rubber` the
 * tyres, the seals, a hose, `glass` the cab's glazing, `light` a lamp's lens and the warning stripes' pale band.
 * No maker's colours: a site's yellow is a colour, never a brand's.
 */
export const CON_PALETTES = {
  // the site's yellow over a black undercarriage
  siteYellow: { paint: '#e5a91c', trim: '#26282a', glass: '#2b3a44', rubber: '#1a1b1c', chrome: '#c9ced2', light: '#f2ece0' },
  // a municipal fleet's orange
  municipalOrange: { paint: '#e0662a', trim: '#2a2b2d', glass: '#2b3a44', rubber: '#1a1b1c', chrome: '#c9ced2', light: '#f2ece0' },
  // a hire fleet's white and its grey
  rentalWhite: { paint: '#e9eaea', trim: '#3a3e42', glass: '#2b3a44', rubber: '#1a1b1c', chrome: '#c9ced2', light: '#f2ece0' },
  // an engineer regiment's olive
  engineerOlive: { paint: '#4f5538', trim: '#2b2e24', glass: '#2a3028', rubber: '#1a1b18', chrome: '#8a8e84', light: '#d8d2b8' },
  // a machine left out for decades: faded paint, rust's brown in the dark
  rusted: { paint: '#b98a3a', trim: '#5a3a26', glass: '#3a4146', rubber: '#242322', chrome: '#8f8a80', light: '#d8cfbc' },
};

/** A palette id plus per-role overrides → { id, colors }. */
export function resolveConPalette(palette, colors = {}, fallback = 'siteYellow') {
  const id = palette || fallback;
  const base = CON_PALETTES[id];
  if (!base) throw new Error(`Unknown construction palette '${id}' - expected one of: ${Object.keys(CON_PALETTES).join(', ')}`);
  const out = { ...base };
  for (const [role, value] of Object.entries(colors || {})) {
    if (!CON_COLOR_ROLES.includes(role)) throw new Error(`Unknown construction color role '${role}' - expected one of: ${CON_COLOR_ROLES.join(', ')}`);
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`construction color '${role}' must be a #RRGGBB hex string; received ${JSON.stringify(value)}`);
    out[role] = value.toLowerCase();
  }
  return { id, colors: out };
}

// ── rigid transforms: { R (3×3, rows), t } ──────────────────────────────────
export const I3 = Object.freeze([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
export const mul3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
export const vec3 = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
/** A rotation by `a` radians about the unit axis k (Rodrigues). */
export function about(k, a) {
  const d = Math.hypot(k[0], k[1], k[2]) || 1, x = k[0] / d, y = k[1] / d, z = k[2] / d, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}
export const IDENTITY = Object.freeze({ R: I3, t: Object.freeze([0, 0, 0]) });
/** A point in a frame → the frame's parent's. */
export const apply = (T, p) => { const r = vec3(T.R, p); return [r[0] + T.t[0], r[1] + T.t[1], r[2] + T.t[2]]; };
/** A direction in a frame → the parent's. */
export const turn = (T, v) => vec3(T.R, v);
/** A frame set in a frame: T · S. */
export const compose = (T, S) => ({ R: mul3(T.R, S.R), t: apply(T, S.t) });
/** The assembler's Euler angles (degrees, R = Rz·Ry·Rx, `rotate: [rx, ry, rz]`) of a rotation. */
export function eulerXYZ(M) {
  const D = 180 / Math.PI, ry = Math.asin(Math.max(-1, Math.min(1, -M[2][0])));
  if (Math.abs(Math.cos(ry)) < 1e-9) return [Math.atan2(-M[1][2], M[1][1]) * D, ry * D, 0];
  return [Math.atan2(M[2][1], M[2][2]) * D, ry * D, Math.atan2(M[1][0], M[0][0]) * D];
}
/** The frame whose +y runs from `a` toward `b`, its +x as near the given `x` as square to it allows: a strut's. */
export function aimFrame(a, b, x = [1, 0, 0]) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, y = d.map((v) => v / L);
  const xd = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  let xa = [x[0] - xd * y[0], x[1] - xd * y[1], x[2] - xd * y[2]];
  const xl = Math.hypot(...xa);
  xa = xl < 1e-9 ? [0, 0, 1] : xa.map((v) => v / xl);
  const z = [xa[1] * y[2] - xa[2] * y[1], xa[2] * y[0] - xa[0] * y[2], xa[0] * y[1] - xa[1] * y[0]];
  // (columns are the frame's axes in the parent's: R·[1,0,0] = x)
  return { R: [[xa[0], y[0], z[0]], [xa[1], y[1], z[1]], [xa[2], y[2], z[2]]], t: [...a], length: L };
}
