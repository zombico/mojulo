/**
 * mecha-common — the shared kit of the mecha shelf: the construction shelf's rigid transforms and drawing helpers (its
 * own the cycle shelf's), the veh-* shelf's six colour roles, the shelf's palettes, and the hydraulics every ram is
 * rated by.
 *
 * Mecha space is the construction shelf's axes: +y forward, +z up, +x right, true metres. A frame is authored in ITS
 * OWN frame: the pelvis the root, its origin midway between the hip yaw axes at their bearings' plane; the machine's
 * frame puts the pelvis where its stance holds it (mecha-ik.js), the ground z = 0. A body on a leg is authored in its own
 * frame: its pivot the origin, hanging along −z at its joint's zero, +y forward.
 */

import { VEH_COLOR_ROLES } from '../vehicle-designer/veh-common.js';

export {
  DEG, add, box, clone, cross, dot, len, lerp, mul, panel, pod, rect, round3, roundRect, spin, sub, sweep, tone, tube, unit,
  I3, IDENTITY, about, aimFrame, apply, compose, eulerXYZ, mul3, turn, vec3,
} from '../construction-shelf/con-common.js';
export { extrudeWorld, loftWorld } from '../cycle-shelf/cycle-common.js';

export const MECHA_COLOR_ROLES = VEH_COLOR_ROLES;

/**
 * The palettes, in the six roles: `paint` the covers (the thighs', the shanks', the power pack's), `trim` the structure
 * (the pelvis, the yokes, the clevises, the cage's tube), `chrome` a ram's rod and the bare pins, `rubber` the soles,
 * the hoses, the seat's cushions, `glass` a lamp's glass and a display, `light` the warning marks and a lamp's lens.
 * No maker's colours, no game's: a test rig's white is a colour.
 */
export const MECHA_PALETTES = {
  // a proving ground's: warm white covers over a graphite frame, orange marks
  proving: { paint: '#d8d5cb', trim: '#34373b', glass: '#26323a', rubber: '#1b1c1d', chrome: '#c9ced2', light: '#e8742a' },
  // a field unit's olive drab over a dark frame
  fieldOlive: { paint: '#5c6244', trim: '#2a2d24', glass: '#25302a', rubber: '#1a1b18', chrome: '#8f948a', light: '#d6cf9e' },
  // a mountain rescue team's orange
  rescueOrange: { paint: '#df6327', trim: '#2b2c2e', glass: '#26323a', rubber: '#1b1c1d', chrome: '#c9ced2', light: '#f2ece0' },
  // a desert patrol's sand over a brown frame
  desertSand: { paint: '#bda97f', trim: '#4a3f31', glass: '#2c3338', rubber: '#231f1b', chrome: '#a8a296', light: '#e6dcc2' },
  // a construction site's yellow over a black frame
  siteYellow: { paint: '#e5a91c', trim: '#26282a', glass: '#2b3a44', rubber: '#1a1b1c', chrome: '#c9ced2', light: '#f2ece0' },
  // a winter station's white and its signal red
  arcticWhite: { paint: '#e9ecee', trim: '#40464c', glass: '#26323a', rubber: '#1b1c1d', chrome: '#c9ced2', light: '#c8322c' },
};
export const MECHA_PALETTE_IDS = Object.freeze(Object.keys(MECHA_PALETTES));

/** A palette id plus per-role overrides → { id, colors }. */
export function resolveMechaPalette(palette, colors = {}, fallback = 'proving') {
  const id = palette || fallback;
  const base = MECHA_PALETTES[id];
  if (!base) throw new Error(`Unknown mecha palette '${id}' - expected one of: ${MECHA_PALETTE_IDS.join(', ')}`);
  const out = { ...base };
  for (const [role, value] of Object.entries(colors || {})) {
    if (!MECHA_COLOR_ROLES.includes(role)) throw new Error(`Unknown mecha color role '${role}' - expected one of: ${MECHA_COLOR_ROLES.join(', ')}`);
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`mecha color '${role}' must be a #RRGGBB hex string; received ${JSON.stringify(value)}`);
    out[role] = value.toLowerCase();
  }
  return { id, colors: out };
}

/** The system pressure every ram is rated at: a mobile hydraulic circuit's working pressure (Pa). */
export const SYSTEM_PRESSURE = 21e6;
/** A ram's rated force at the system pressure: pushing on its whole bore, pulling on the annulus round its rod (N). */
export const ramForce = (d) => ({ push: SYSTEM_PRESSURE * Math.PI * (d.bore / 2) ** 2, pull: SYSTEM_PRESSURE * Math.PI * ((d.bore / 2) ** 2 - (d.rod / 2) ** 2) });
export const G = 9.81;
