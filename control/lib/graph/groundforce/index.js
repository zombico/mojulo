/**
 * THE GROUND FORCE — a sci-fi army's ground units, as an arcade flight stage meets them from the air: a gun emplacement
 * dug into the ground, a hover tank, a small personnel walker. Their own register: not a modern army's (the vehicle
 * registry's tanks are tracked armour of now) and not a toy's (workbots/); a military future's, read at a glance from a
 * fighter going past at speed.
 *
 *   THE LANGUAGE   a few big shapes, chamfered (workbots/'s primitives): armour in composite greys (`hull`, `hull2`), its
 *                  running gear and its guns graphite (`dark`), one foe-red stripe (`accent`), and what is lit: a red
 *                  sensor slit where it looks from (`sensor`), its drive's glow (`drive`) where it burns or hovers. Twin
 *                  barrels, long; nothing smaller than a hand at its size
 *   A CARD         a unit as data (GROUND_UNITS): its parts, each a primitive by role, in metres, +y its front, +z up, +x
 *                  its right (the vehicle frame the page's rig figures share), standing on z = 0, in life's metres
 *                  (drawn GROUNDFORCE_SCALE times larger); its `size` (its hit radius, m, at life), `hp`, its gun (`rof`
 *                  shots a second, `range` m) and its `points` on a stage
 *
 *   GROUND_UNITS, GROUND_UNIT_IDS   the cards (a new unit is a card; `flies`: it is stood in the air, not on the ground)
 *   unitFaces(kind)                 → faces { corners, fill } lit (baked under one key, the lit parts their own colour),
 *                                     drawn GROUNDFORCE_SCALE times life
 *   unitRadius(kind)                → its hit radius as drawn (m)
 *   unitFigure(kind)                → the rig figure a level stands it as (vehicle-rig.js packVehicleFigure, one bone)
 *   GROUNDFORCE_PALETTE             the roles' colours
 *
 * Pure and deterministic: the same card, the same unit.
 */
import { WORKBOT_PRIMITIVES as P } from '../workbots/index.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';

/** How much larger than life a unit is drawn (and hit): an arcade fighter goes past at speed, 45 m up, and must read
 *  each one at a glance (its card is in life's metres). */
export const GROUNDFORCE_SCALE = 2.5;
export const GROUNDFORCE_PALETTE = Object.freeze({
  hull: '#7d8590', hull2: '#5d646e', dark: '#2c3036', accent: '#b8323a', sensor: '#ff3a2e', drive: '#ffb24a',
});
// (what is lit is drawn its own colour, unshaded)
const LIT = new Set(['sensor', 'drive']);
const KEY = Object.freeze({ dir: [-0.42, -0.36, 0.83], ambient: 0.46, gain: 0.62 });

const twin = (y0, y1, z, apart, r) => [-1, 1].flatMap((s) => P.pipe([s * apart / 2, y0, z], [s * apart / 2, y1, z], r, 'dark', 8));

// (a part's faces turned about an axis through `at`, parallel to x: a rack raised, a barrel laid)
const tiltX = (faces, at, a) => faces.map((f) => ({ ...f, corners: f.corners.map((c) => { const y = c[1] - at[1], z = c[2] - at[2]; return [c[0], at[1] + y * Math.cos(a) - z * Math.sin(a), at[2] + y * Math.sin(a) + z * Math.cos(a)]; }) }));

/** The units, by kind. */
export const GROUND_UNITS = Object.freeze({
  // dug in, a ring of armour round a domed turret, its twin guns long: it turns to the craft and fires up at it
  turret: Object.freeze({
    label: 'gun emplacement', reads: 'an armoured dome on a dug-in ring, twin long barrels, a red sensor slit',
    size: 4, hp: 6, rof: 1.4, range: 1400, points: 150,
    parts: () => [
      ...P.prism([0, 0, 0], 3.4, 3.4, 0, 1.1, 'dark', 8),
      ...P.prism([0, 0, 0], 2.8, 2.8, 1.1, 1.5, 'hull2', 8),
      ...P.prism([0, 0, 0], 2.85, 2.85, 1.18, 1.3, 'accent', 8),
      ...P.dome([0, 0, 1.5], 2.3, 2.3, 1.5, 1.9, 'hull', 10, 3),
      ...P.box([0, 1.0, 2.5], [2.0, 2.2, 1.1], 'hull2', { ch: 0.45 }),
      ...P.box([0, 2.12, 2.85], [1.1, 0.06, 0.22], 'sensor'),
      ...twin(2.0, 6.6, 2.45, 1.0, 0.2),
    ],
  }),
  // a wedge on four glowing hover pads, its side skirts low, a flat turret aft of the middle with twin barrels forward
  tank: Object.freeze({
    label: 'hover tank', reads: 'a sloped wedge hull on four glowing hover pads, skirts low, a flat turret with twin barrels',
    size: 5, hp: 8, rof: 1.1, range: 1500, points: 200,
    parts: () => [
      ...P.box([0, 0, 1.0], [4.6, 8.2, 1.0], 'hull2', { ch: 0.7 }),
      ...P.box([0, -0.4, 1.78], [4.0, 6.4, 0.62], 'hull', { ch: 0.9 }),
      ...P.box([0, 3.9, 1.15], [3.0, 1.4, 0.7], 'hull', { ch: 1.0 }),
      ...[-1, 1].flatMap((s) => P.box([s * 2.45, 0, 0.85], [0.34, 7.4, 0.95], 'dark', { ch: 0.12 })),
      ...[-1, 1].flatMap((s) => P.box([s * 2.65, 0.6, 1.0], [0.06, 3.2, 0.18], 'accent')),
      ...[[-1.5, 2.6], [1.5, 2.6], [-1.5, -2.8], [1.5, -2.8]].flatMap(([x, y]) => P.prism([x, y, 0], 0.75, 0.75, 0.22, 0.48, 'drive', 8)),
      ...P.box([0, -0.7, 2.52], [2.7, 3.3, 0.86], 'hull2', { ch: 0.75 }),
      ...P.box([0, 0.98, 2.62], [0.9, 0.08, 0.22], 'sensor'),
      ...twin(0.6, 5.4, 2.55, 0.7, 0.15),
      ...[-1, 1].flatMap((s) => P.box([s * 1.25, -4.16, 1.3], [1.0, 0.08, 0.5], 'drive')),
    ],
  }),
  // a flier, one of a swarm: a flat armoured pod slung between two ducted fans burning under it, a red eye forward, one
  // chin gun; it orbits and strafes, a small thing hard to hold in a lock
  gnat: Object.freeze({
    label: 'gnat drone', reads: 'a flat pod between two glowing ducted fans, a red eye, a chin gun: one of a swarm',
    size: 0.85, hp: 2, rof: 2.4, range: 900, points: 60, flies: true,
    // (half a walker's metres: some 5 m across as drawn, a thing a frame swats, not one it duels)
    parts: () => { const k = 0.5, S = (v) => v.map((x) => x * k); return [
      ...P.box(S([0, 0.1, 0.55]), S([1.2, 2.0, 0.55]), 'hull', { ch: 0.3 * k }),
      ...P.box(S([0, -0.25, 0.95]), S([0.8, 1.1, 0.3]), 'hull2', { ch: 0.22 * k }),
      ...P.box(S([0, 1.12, 0.6]), S([0.62, 0.08, 0.2]), 'sensor'),
      ...P.box(S([0.62, 0.2, 0.62]), S([0.05, 1.2, 0.12]), 'accent'),
      ...[-1, 1].flatMap((sd) => [
        ...P.box(S([sd * 0.85, 0, 0.55]), S([0.6, 0.35, 0.22]), 'dark', { ch: 0.06 * k }),
        ...P.prism(S([sd * 1.45, 0, 0]), 0.72 * k, 0.72 * k, 0.38 * k, 0.78 * k, 'hull2', 12),
        // (the fan's face in the duct's mouth, burning: seen from above and in front, and its wash under it)
        ...P.prism(S([sd * 1.45, 0, 0]), 0.56 * k, 0.56 * k, 0.78 * k, 0.81 * k, 'drive', 12),
        ...P.prism(S([sd * 1.45, 0, 0]), 0.5 * k, 0.5 * k, 0.33 * k, 0.4 * k, 'drive', 12),
        ...P.prism(S([sd * 1.45, 0, 0]), 0.16 * k, 0.16 * k, 0.4 * k, 0.86 * k, 'dark', 6),
        ...[0, 1, 2].flatMap((i) => P.box(S([sd * 1.45, 0, 0.84]), [0.08 * k, 1.05 * k, 0.03 * k], 'dark').map((f) => ({ ...f, corners: f.corners.map((c) => { const a = (i * Math.PI) / 3, x = c[0] - sd * 1.45 * k, y = c[1]; return [sd * 1.45 * k + x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), c[2]]; }) }))),
      ]),
      ...P.pipe(S([0, 0.7, 0.22]), S([0, 1.75, 0.22]), 0.08 * k, 'dark', 6),
      ...P.box(S([0, 0.55, 0.28]), S([0.3, 0.5, 0.2]), 'dark', { ch: 0.05 * k }),
    ]; },
  }),
  // an artillery truck: six wheels under a long bed, a cab forward, outriggers braced on the ground, and on the bed a
  // launcher rack raised toward the sky, eight tubes with their missiles' noses showing; it hangs back and lobs homing salvos
  hammer: Object.freeze({
    label: 'hammer carrier', reads: 'a six-wheeled truck, outriggers braced, a raised rack of eight missile tubes over the bed',
    size: 4.2, hp: 7, rof: 0.8, range: 1600, points: 220,
    parts: () => {
      const rackAt = [0, -1.6, 2.2], rack = [
        ...P.box([0, -1.6, 2.9], [2.9, 3.6, 1.5], 'hull', { ch: 0.25 }),
        ...P.box([1.47, -1.6, 2.9], [0.05, 3.0, 0.22], 'accent'),
        ...[-1, 1].flatMap((sx) => [-0.55, 0.55].flatMap((dz) => [-0.62, -0.2, 0.2, 0.62].slice(0, 2).flatMap((xi, i) => {
          const x = sx * (0.42 + i * 0.68), z = 2.9 + dz;
          return [...P.prism([x, 0.2, z], 0.26, 0.26, 0, 0, 'dark', 8).slice(0, 0), ...P.box([x, 0.25, z], [0.5, 0.08, 0.5], 'dark'), ...P.box([x, 0.27, z], [0.22, 0.06, 0.22], 'drive')];
        }))),
      ];
      return [
        ...P.box([0, 0, 1.15], [3.2, 8.4, 0.7], 'dark', { ch: 0.2 }),
        ...P.box([0, 3.05, 2.0], [3.0, 2.3, 1.9], 'hull2', { ch: 0.55 }),
        ...P.box([0, 4.22, 2.35], [2.1, 0.08, 0.32], 'sensor'),
        ...P.box([0, 2.9, 3.05], [2.3, 1.5, 0.22], 'hull', { ch: 0.3 }),
        ...[-1, 1].flatMap((s2) => [2.7, 0.2, -2.6].flatMap((y) => P.wheel([s2 * 1.55, y, 0.62], 0.62, 0.55, 'dark', 12))),
        ...[-1, 1].flatMap((s2) => [1.0, -3.4].flatMap((y) => [...P.pipe([s2 * 1.6, y, 1.2], [s2 * 2.6, y, 0.15], 0.11, 'hull2', 6), ...P.box([s2 * 2.7, y, 0.07], [0.6, 0.6, 0.14], 'dark')])),
        ...P.box([0, -1.6, 1.75], [1.4, 1.6, 0.5], 'hull2', { ch: 0.15 }),
        ...tiltX(rack, rackAt, 0.62),
      ];
    },
  }),
  // a shield-bearer: a stocky walker behind a tall slab of armour, its vision slit lit, a cannon reaching round the slab's
  // edge; it advances behind it, and its front is shut until the slab is broken, it is flanked or kicked aside
  bastion: Object.freeze({
    label: 'bastion walker', reads: 'a stocky walker behind a tall slab shield with a lit slit, a cannon round its edge',
    size: 3.4, hp: 9, rof: 1.2, range: 1100, points: 260,
    parts: () => [
      // (the legs: thick, short, plated feet)
      ...[-1, 1].flatMap((s2) => [
        ...P.box([s2 * 1.05, -0.2, 0.2], [1.1, 1.8, 0.4], 'dark', { ch: 0.3 }),
        ...P.pipe([s2 * 1.05, -0.3, 0.35], [s2 * 1.0, -0.6, 1.7], 0.32, 'hull2', 8),
        ...P.ball([s2 * 1.0, -0.6, 1.75], 0.4, 'dark', 8, 3),
        ...P.pipe([s2 * 1.0, -0.6, 1.75], [s2 * 0.8, -0.3, 2.7], 0.36, 'hull2', 8),
      ]),
      // (the body: a squat hull behind the slab)
      ...P.box([0, -0.5, 3.2], [2.5, 1.9, 1.5], 'hull', { ch: 0.45 }),
      ...P.box([0, -0.9, 4.1], [1.6, 1.2, 0.4], 'hull2', { ch: 0.3 }),
      // (the slab: tall and broad ahead of it, its edges red, a lit slit to see over)
      ...P.box([0, 1.15, 2.75], [3.4, 0.45, 4.6], 'hull2', { ch: 0.35 }),
      ...P.box([0, 1.4, 2.75], [3.0, 0.08, 4.1], 'hull', { ch: 0.2 }),
      ...[-1, 1].flatMap((s2) => P.box([s2 * 1.66, 1.2, 2.75], [0.08, 0.5, 4.4], 'accent')),
      ...P.box([0, 1.46, 4.3], [1.6, 0.06, 0.18], 'sensor'),
      ...[-0.7, 0.7].flatMap((x) => P.box([x, 1.46, 2.3], [0.5, 0.04, 2.0], 'dark', { ch: 0.05 })),
      // (the cannon: from the body's right, past the slab's edge)
      ...P.box([1.75, 0.1, 3.4], [0.6, 1.4, 0.6], 'dark', { ch: 0.15 }),
      ...P.pipe([1.95, 0.6, 3.45], [1.95, 3.3, 3.45], 0.17, 'dark', 8),
      ...P.pipe([1.95, 3.0, 3.45], [1.95, 3.35, 3.45], 0.24, 'hull2', 8),
    ],
  }),
  // two backward-kneed legs under an enclosed cab, a red visor, twin chin guns, an antenna: it stands its ground
  walker: Object.freeze({
    label: 'personnel walker', reads: 'an enclosed cab on two backward-kneed legs, a red visor, twin chin guns',
    size: 3, hp: 5, rof: 1.6, range: 1200, points: 150,
    parts: () => [
      ...[-1, 1].flatMap((s) => [
        ...P.box([s * 0.95, 0.35, 0.16], [0.95, 1.7, 0.32], 'dark', { ch: 0.25 }),
        ...P.pipe([s * 0.95, 0.15, 0.3], [s * 0.95, -0.45, 1.85], 0.19, 'dark', 8),
        ...P.ball([s * 0.95, -0.45, 1.85], 0.3, 'hull2', 8, 3),
        ...P.pipe([s * 0.95, -0.45, 1.85], [s * 0.72, 0.15, 3.05], 0.24, 'hull2', 8),
      ]),
      ...P.box([0, 0, 3.12], [2.0, 0.95, 0.5], 'dark', { ch: 0.2 }),
      ...P.box([0, 0.25, 3.95], [1.9, 2.3, 1.3], 'hull', { ch: 0.5 }),
      ...P.box([0, -0.2, 4.68], [1.4, 1.6, 0.2], 'hull2', { ch: 0.4 }),
      ...P.box([0, 1.42, 4.0], [1.25, 0.08, 0.34], 'sensor'),
      ...P.box([0.97, 0.3, 3.95], [0.06, 1.6, 0.16], 'accent'),
      ...twin(1.0, 2.45, 3.42, 1.1, 0.09),
      ...P.pipe([0.62, -0.6, 4.75], [0.62, -0.6, 5.7], 0.04, 'dark', 6),
    ],
  }),
});
export const GROUND_UNIT_IDS = Object.freeze(Object.keys(GROUND_UNITS));

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const normalOf = (C) => {
  // (Newell's normal: robust for any planar polygon the primitives make)
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < C.length; i++) { const a = C[i], b = C[(i + 1) % C.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l];
};

/** A unit's faces, lit: each its role's colour under the key (the lit parts their own). */
export function unitFaces(kind) {
  const U = GROUND_UNITS[kind];
  if (!U) throw new Error(`groundforce: '${kind}' is not a unit (${GROUND_UNIT_IDS.join(', ')})`);
  const L = KEY.dir, ll = Math.hypot(...L);
  const k = GROUNDFORCE_SCALE;
  return U.parts().map((f) => {
    const corners = f.corners.map((c) => [c[0] * k, c[1] * k, c[2] * k]), base = hexRgb(GROUNDFORCE_PALETTE[f.role]);
    if (LIT.has(f.role)) return { corners, fill: GROUNDFORCE_PALETTE[f.role], role: f.role };
    const n = normalOf(corners), lam = KEY.ambient + KEY.gain * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ll);
    return { corners, fill: rgbHex(base.map((v) => v * lam)), role: f.role };
  });
}

/** A unit's hit radius as drawn. */
export const unitRadius = (kind) => Math.round(GROUND_UNITS[kind].size * GROUNDFORCE_SCALE * 100) / 100;

/** The rig figure a level stands the unit as: one bone, its faces packed (vehicle-rig.js). */
export function unitFigure(kind) {
  const faces = unitFaces(kind);
  const fig = packVehicleFigure([{ id: 'root', head: [0, 0, 0] }], new Map([['root', faces]]), { keys: 2, rolls: [] });
  return { ...fig, groundforce: { kind, label: GROUND_UNITS[kind].label, faces: faces.length } };
}
