/**
 * THE COURSE'S SCENERY — the two outer layers of a rolled course's dress (course-dress.js): the WALLS beside the way
 * and the BACKDROP behind its far end. With the way and its asks they are one design, laid by the same roles and held
 * to one gate, because on a course's screen (course-view.js) they share the frame: the backdrop is the top third
 * (where stuff comes from), the walls are the sides of the middle third (where it comes to view, and where a thing is
 * made interesting), and neither may cost an ask its read.
 *
 *   A SLICE       one segment of a flank, as DATA: { name?, says?, parts: [{ box: [u0, d0, z0, u1, d1, z1], role }] }
 *                   u   along the slice, 0 at its near end to 1 at its far end (a slice is one segment of the course
 *                       long: the size a designed piece is seen at in the middle third)
 *                   d   metres off the kerb's outer edge, outward (0 or more: a slice never stands on the way)
 *                   z   metres up from the ground
 *                   role  one of the dress's wall roles: flank, flank2, trim, iron, lamp
 *                 Two kinds a course: A, the complex slice, and B, the plain one that lets A be seen.
 *   THE ORDER     along each side, by the walls' rule (era/wall-rhythm.js: never three alike, never a pair repeated);
 *                 the two sides are ordered differently, so the frame is never a mirror. `order` writes one side's
 *                 own ('ABBA…', repeated along the course).
 *   THE BACKDROP  { bands?: 3…12, skyline?: [{ at, wide, tall }] }: the sky in `bands` steps from the horizon's colour
 *                 to the zenith's; a skyline of silhouettes in the `far` role (`at` −1…1 across the view, `wide` and
 *                 `tall` in metres); the land beyond the way in the `land` role. It stands FAR metres past the
 *                 course's end, so it is in the top third from the first step to the last.
 *
 *   THE OVERHEAD  a theme's `overhead: 'line'`: a portal over the way at every slice's end and a wire over each outer lane,
 *                 running to the vanishing point. It is what stands in the top third near at hand.
 *
 *   SLICES, BACKDROPS            the cards (a new look is a row)
 *   readWalls(v, theme), readBackdrop(v, theme)   a dress's `walls` / `backdrop` as written → resolved (they teach)
 *   sceneryOf(dress, { length, gap, seed? }) → { left, right, cells: [{ side, k, y0, y1, kind }], faces, far, laws }
 *   sceneryLaws(dress, scenery, { camera?, reactAt? }) → [{ law, holds, says }]: receding, interest, rhythm, banded
 *
 * Faces only: scenery is seen, never met (no collider, no nav, no sight). Pure and deterministic.
 */
import { hexToRgb, rgbToHex, lchOf, oklch, mixHue, deltaE } from '../color-theorist/oklab.js';
import { wallOrder, wallRhythms, rhythmFaults } from '../era/wall-rhythm.js';
import { project, cameraAt, VFOV } from './course-view.js';

export const WALL_ROLES = Object.freeze(['flank', 'flank2', 'trim', 'iron', 'lamp']);
export const BACKDROP_ROLES = Object.freeze(['land', 'far', 'horizon']);
/** How far past the course's end the backdrop stands, and how far to each side it and the land reach (metres). */
export const FAR = 400, REACH = 700;
// (the wires run over the outer tracks: one over the middle track would pass a hand over the camera and fill the frame)
const WIRES = [-2, 2];
const KERB = 4.8;   // the kerb's outer edge off the centre line (roll-course.js: HALF + 1 + 0.5)

const B = (u0, d0, z0, u1, d1, z1, role) => ({ box: [u0, d0, z0, u1, d1, z1], role });
export const SLICES = Object.freeze({
  shed: Object.freeze({ name: 'Goods shed', says: 'a shed\'s bay: a tall wall on a plinth, pilasters, a door recess, an eave and a lamp (a complex slice)',
    parts: [B(0, 1.5, 0, 1, 8, 5.4, 'flank'), B(0, 1.3, 0, 1, 1.5, 0.8, 'flank2'), B(0, 0.9, 5.4, 1, 8.2, 5.8, 'flank2'),
      B(0, 1.25, 0.8, 0.045, 1.5, 5.4, 'trim'), B(0.3, 1.25, 0.8, 0.345, 1.5, 5.4, 'trim'), B(0.655, 1.25, 0.8, 0.7, 1.5, 5.4, 'trim'),
      B(0.38, 1.42, 0.8, 0.62, 1.5, 4, 'flank2'), B(0.36, 1.36, 4, 0.64, 1.5, 4.25, 'trim'),
      B(0.08, 1.44, 3.3, 0.26, 1.5, 4.5, 'flank2'), B(0.74, 1.44, 3.3, 0.92, 1.5, 4.5, 'flank2'),
      B(0.49, 0.7, 4.5, 0.51, 1.5, 4.62, 'trim'), B(0.48, 0.6, 4.2, 0.52, 0.8, 4.5, 'trim')] }),
  stacks: Object.freeze({ name: 'Container stacks', says: 'containers stacked two and three high, stepped back, a mast beside them (a complex slice)',
    parts: [B(0.04, 1.2, 0, 0.46, 3.8, 2.6, 'flank'), B(0.04, 1.2, 2.6, 0.46, 3.8, 5.2, 'flank2'), B(0.1, 1.6, 5.2, 0.4, 3.8, 7.8, 'flank'),
      B(0.54, 2.2, 0, 0.96, 4.8, 2.6, 'flank2'), B(0.54, 2.2, 2.6, 0.96, 4.8, 5.2, 'flank'),
      B(0.04, 1.15, 2.5, 0.46, 1.2, 2.7, 'trim'), B(0.54, 2.15, 2.5, 0.96, 2.2, 2.7, 'trim'),
      B(0.49, 0.8, 0, 0.51, 1, 9, 'trim'), B(0.47, 0.6, 8.2, 0.53, 1.2, 8.5, 'trim')] }),
  fence: Object.freeze({ name: 'Fence and embankment', says: 'a low fence on posts before a long embankment (a plain slice)',
    parts: [B(0, 3.5, 0, 1, 10, 1.4, 'flank'), B(0, 0.8, 0.5, 1, 0.9, 1.7, 'flank2'), B(0, 0.75, 0, 0.03, 0.95, 2.3, 'trim'), B(0.5, 0.75, 0, 0.53, 0.95, 2.3, 'trim')] }),
  platform: Object.freeze({ name: 'Station platform', says: 'a platform under an iron canopy: its brick face and stone edge, columns, a back wall, a name board, a bench, hanging lamps (a complex slice)',
    parts: [B(0, 0.5, 0, 1, 6.4, 1.1, 'flank2'), B(0, 0.42, 0.98, 1, 0.9, 1.14, 'trim'), B(0, 5.8, 1.1, 1, 6.4, 4.6, 'flank'),
      B(0, 0.7, 4.3, 1, 6.2, 4.6, 'iron'), B(0, 0.55, 4.02, 1, 0.75, 4.3, 'iron'),
      B(0.1, 1.5, 1.1, 0.118, 1.7, 4.3, 'iron'), B(0.49, 1.5, 1.1, 0.508, 1.7, 4.3, 'iron'), B(0.88, 1.5, 1.1, 0.898, 1.7, 4.3, 'iron'),
      B(0.36, 5.7, 2.5, 0.64, 5.8, 3.1, 'trim'), B(0.2, 4.6, 1.1, 0.34, 5.2, 1.6, 'iron'), B(0.68, 5.7, 1.3, 0.8, 5.8, 3.3, 'flank2'),
      B(0.29, 1.4, 3.7, 0.31, 1.8, 4.0, 'lamp'), B(0.69, 1.4, 3.7, 0.71, 1.8, 4.0, 'lamp')] }),
  cutting: Object.freeze({ name: 'The cutting', says: 'the brick retaining wall between stations: piers, a stone coping, one lamp on its bracket (a plain slice)',
    parts: [B(0, 1.4, 0, 1, 2.4, 3.8, 'flank'), B(0, 1.25, 0, 0.06, 1.4, 3.8, 'flank2'), B(0.5, 1.25, 0, 0.56, 1.4, 3.8, 'flank2'),
      B(0, 1.2, 3.8, 1, 2.5, 4.05, 'trim'), B(0.27, 0.9, 3.0, 0.285, 1.4, 3.1, 'iron'), B(0.265, 0.85, 2.72, 0.29, 1.05, 3.0, 'lamp')] }),
  bank: Object.freeze({ name: 'Open bank', says: 'a low bank and nothing on it (the plainest slice)',
    parts: [B(0, 1.5, 0, 1, 10, 0.9, 'flank'), B(0, 1.2, 0, 1, 1.5, 0.35, 'flank2')] }),
});

const S = (at, wide, tall, role) => ({ at, wide, tall, ...(role ? { role } : {}) });
export const BACKDROPS = Object.freeze({
  yard: Object.freeze({ name: 'The yard at dusk', says: 'sheds, a water tower, chimneys and a gantry crane against the last light', bands: 7,
    skyline: [S(-0.92, 150, 21), S(-0.7, 60, 32), S(-0.62, 14, 60), S(-0.45, 120, 25), S(-0.28, 26, 43), S(-0.24, 70, 19), S(0.2, 90, 22), S(0.3, 12, 55), S(0.34, 12, 64),
      S(0.5, 130, 27), S(0.72, 40, 38), S(0.74, 110, 14), S(0.92, 120, 30)] }),
  terminus: Object.freeze({ name: 'The terminus', says: 'the city the line runs into: the terminus\'s great roof and its clock tower where the tracks meet the horizon, the clock lit', bands: 8,
    skyline: [S(-0.95, 140, 30), S(-0.78, 70, 46), S(-0.6, 110, 26), S(-0.5, 16, 58), S(-0.36, 90, 38), S(-0.2, 60, 24),
      S(0, 150, 20), S(0, 96, 28), S(0, 44, 34), S(0.085, 15, 62), S(0.085, 7, 5, 'lamp'),
      S(0.26, 80, 30), S(0.4, 22, 54), S(0.47, 100, 36), S(0.66, 60, 22), S(0.8, 90, 44), S(0.95, 130, 28)] }),
  open: Object.freeze({ name: 'Open sky', says: 'the sky and the land, nothing on the horizon', bands: 7, skyline: [] }),
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v), num = (v) => Number.isFinite(v);
const names = (o) => Object.keys(o).join(', ');

function readSlice(v, at) {
  if (typeof v === 'string') { if (!SLICES[v]) throw new Error(`course: ${at} is a slice's name (${names(SLICES)}) or { parts: [{ box: [u0, d0, z0, u1, d1, z1], role }] }`); return { id: v, ...SLICES[v] }; }
  if (!isObj(v) || !Array.isArray(v.parts) || !v.parts.length) throw new Error(`course: ${at} is a slice's name (${names(SLICES)}) or { parts: [{ box: [u0, d0, z0, u1, d1, z1], role }] }`);
  if (v.parts.length > 40) throw new Error(`course: ${at} has ${v.parts.length} parts; a slice is 40 at most (it is seen for a second)`);
  v.parts.forEach((p, i) => {
    const b = p?.box, w = `${at}.parts[${i}]`;
    if (!Array.isArray(b) || b.length !== 6 || !b.every(num)) throw new Error(`course: ${w}.box is [u0, d0, z0, u1, d1, z1]: along the slice 0 to 1, metres off the kerb, metres up`);
    if (!(b[0] >= 0 && b[3] <= 1 && b[0] < b[3])) throw new Error(`course: ${w}.box runs along the slice from u0 to u1, 0 to 1`);
    if (!(b[1] >= 0 && b[1] < b[4] && b[4] <= 30)) throw new Error(`course: ${w}.box stands off the kerb, d0 to d1, 0 to 30 m outward (a slice never stands on the way)`);
    if (!(b[2] >= 0 && b[2] < b[5] && b[5] <= 30)) throw new Error(`course: ${w}.box rises from z0 to z1, 0 to 30 m`);
    if (!WALL_ROLES.includes(p.role)) throw new Error(`course: ${w}.role is one of ${WALL_ROLES.join(', ')} (a wall is coloured by role, as the way is)`);
  });
  return { id: 'own', name: typeof v.name === 'string' ? v.name : 'Its own', says: typeof v.says === 'string' ? v.says : 'a slice written for this course', parts: v.parts.map((p) => ({ box: p.box.slice(), role: p.role })) };
}

/** A dress's `walls` as written → { a, b, order }. Absent parts are the theme's. */
export function readWalls(v, theme = { a: 'platform', b: 'cutting' }) {
  if (v === undefined || v === null) v = {};
  if (!isObj(v)) throw new Error('course: dress.walls is { a?, b?, order? }: the complex slice, the plain one, and their order along a side');
  for (const k of Object.keys(v)) if (!['a', 'b', 'order'].includes(k)) throw new Error(`course: dress.walls.${k} is not a wall's word (a, b, order)`);
  if (v.order !== undefined && !(typeof v.order === 'string' && /^[ABab]{2,40}$/.test(v.order))) throw new Error('course: dress.walls.order is one side\'s order in A and B (\'ABBA\'), repeated along the course');
  return { a: readSlice(v.a ?? theme.a, 'dress.walls.a'), b: readSlice(v.b ?? theme.b, 'dress.walls.b'), ...(v.order ? { order: v.order.toUpperCase() } : {}) };
}

/** A dress's `backdrop` as written → { id, name, bands, skyline }. */
export function readBackdrop(v, theme = 'terminus') {
  if (v === undefined || v === null) v = theme;
  const teach = `course: dress.backdrop is a backdrop's name (${names(BACKDROPS)}) or { bands?: 3…12, skyline?: [{ at: −1…1, wide, tall }] }`;
  if (typeof v === 'string') { if (!BACKDROPS[v]) throw new Error(teach); return { id: v, ...BACKDROPS[v] }; }
  if (!isObj(v)) throw new Error(teach);
  for (const k of Object.keys(v)) if (!['bands', 'skyline', 'name'].includes(k)) throw new Error(`course: dress.backdrop.${k} is not a backdrop's word (bands, skyline)`);
  if (v.bands !== undefined && !(Number.isInteger(v.bands) && v.bands >= 3 && v.bands <= 12)) throw new Error('course: dress.backdrop.bands is the sky\'s steps from horizon to zenith, 3 to 12');
  const sky = v.skyline ?? BACKDROPS[theme].skyline;
  if (!Array.isArray(sky) || sky.length > 40) throw new Error('course: dress.backdrop.skyline is a list of silhouettes, 40 at most');
  sky.forEach((s, i) => { if (!isObj(s) || !(num(s.at) && s.at >= -1 && s.at <= 1) || !(num(s.wide) && s.wide > 0 && s.wide <= 400) || !(num(s.tall) && s.tall > 0 && s.tall <= 200) || (s.role !== undefined && s.role !== 'far' && s.role !== 'lamp')) throw new Error(`course: dress.backdrop.skyline[${i}] is { at: −1…1 across the view, wide: metres to 400, tall: metres to 200, role?: 'lamp' (a light on it: a clock, a window, set at the top of the silhouette under it) }`); });
  return { id: 'own', name: typeof v.name === 'string' ? v.name : 'Its own', says: 'a backdrop written for this course', bands: v.bands ?? BACKDROPS[theme].bands, skyline: sky.map((s) => ({ at: s.at, wide: s.wide, tall: s.tall, ...(s.role === 'lamp' ? { role: 'lamp' } : {}) })) };
}

const r2 = (v) => Math.round(v * 100) / 100;
const dice = (seed) => { let a = (Math.imul(seed | 0, 0x9e3779b1) ^ 0xc2b2ae35) >>> 0; return (n) => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) % n; }; };
/** The sky's colour a share of the way from the horizon (0) to the zenith (1), mixed in OKLCH. */
export function skyAt(palette, t) {
  const a = lchOf(hexToRgb(palette.horizon)), b = lchOf(hexToRgb(palette.sky));
  return rgbToHex(oklch(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[1] < 0.01 ? b[2] : b[1] < 0.01 ? a[2] : mixHue(a[2], b[2], t)));
}

export function sceneryOf(dress, { length, gap, seed = 1 } = {}) {
  const col = dress.palette, W = dress.walls, faces = [], cells = [];
  const add = (corners, role, group) => faces.push({ corners: corners.map((c) => c.map(r2)), fill: role.startsWith('#') ? role : col[role], group, doubleSided: true });
  // THE WALLS: a slice a segment, from behind the start to past the exit, each side in its own order
  const from = -4, n = Math.max(2, Math.ceil((length + 8) / gap)), all = wallRhythms(n, 2), below = dice(seed);
  const orderOf = (pick) => (W.order ? wallOrder(n, { order: W.order.repeat(Math.ceil(n / W.order.length)).slice(0, n) }).order : all.length ? all[pick % all.length] : wallOrder(n).order);
  const li = below(Math.max(1, all.length)), left = orderOf(li);
  // (the other side: another order where there is one; a written order is read from its other end)
  const right = W.order ? [...left].reverse().join('') === left ? [...left].map((c) => (c === 'A' ? 'B' : 'A')).join('') : [...left].reverse().join('') : orderOf(li + 1 + below(Math.max(1, all.length - 1)));
  for (const [side, order] of [[-1, left], [1, right]]) for (let k = 0; k < n; k++) {
    const y0 = from + k * gap, y1 = y0 + gap, kind = order[k], slice = kind === 'A' ? W.a : W.b;
    cells.push({ side: side < 0 ? 'left' : 'right', k, y0: r2(y0), y1: r2(y1), kind });
    for (const p of slice.parts) {
      const [u0, d0, z0, u1, d1, z1] = p.box, ya = y0 + u0 * gap, yb = y0 + u1 * gap, xa = side * (KERB + d0), xb = side * (KERB + d1);
      // the face toward the way, the two ends, the top (its back is never seen)
      add([[xa, ya, z0], [xa, yb, z0], [xa, yb, z1], [xa, ya, z1]], p.role, 'scenery:walls');
      add([[xa, ya, z0], [xb, ya, z0], [xb, ya, z1], [xa, ya, z1]], p.role, 'scenery:walls');
      add([[xa, yb, z0], [xb, yb, z0], [xb, yb, z1], [xa, yb, z1]], p.role, 'scenery:walls');
      add([[xa, ya, z1], [xa, yb, z1], [xb, yb, z1], [xb, ya, z1]], p.role, 'scenery:walls');
    }
  }
  // THE OVERHEAD (a theme's `overhead`): what crosses the top of the screen near at hand, so the top third is not the
  // far sky alone on a tall frame. `line`: a portal at every slice's end and a wire over each outer track, running to the
  // vanishing point (seen, never met: its beam is over any jump)
  if (dress.overhead === 'line') {
    const px = KERB + 0.45;
    for (let k = 0; k <= n; k++) {
      const y = from + k * gap;
      for (const side of [-1, 1]) { const x = side * px; add([[x - 0.13, y, 1], [x + 0.13, y, 1], [x + 0.13, y, 7.3], [x - 0.13, y, 7.3]], 'iron', 'scenery:overhead'); add([[x - side * 0.13, y, 1], [x - side * 0.13, y + 0.26, 1], [x - side * 0.13, y + 0.26, 7.3], [x - side * 0.13, y, 7.3]], 'iron', 'scenery:overhead'); }
      add([[-px, y, 7], [px, y, 7], [px, y, 7.3], [-px, y, 7.3]], 'iron', 'scenery:overhead');
      add([[-px, y, 7], [px, y, 7], [px, y + 0.26, 7], [-px, y + 0.26, 7]], 'iron', 'scenery:overhead');
      for (const lane of WIRES) add([[lane - 0.04, y, 6.5], [lane + 0.04, y, 6.5], [lane + 0.04, y, 7], [lane - 0.04, y, 7]], 'iron', 'scenery:overhead');
    }
    for (const lane of WIRES) add([[lane - 0.04, from, 6.5], [lane + 0.04, from, 6.5], [lane + 0.04, from + n * gap, 6.5], [lane - 0.04, from + n * gap, 6.5]], 'iron', 'scenery:overhead');
  }
  // THE BACKDROP: the land beyond the way, the sky in bands from the horizon up, the skyline before it
  const Bk = dress.backdrop, far = r2(length + FAR);
  for (const side of [-1, 1]) add([[side * KERB, from, -0.02], [side * REACH, from, -0.02], [side * REACH, far, -0.02], [side * KERB, far, -0.02]], 'land', 'scenery:backdrop');
  add([[-KERB, length + 4, -0.02], [KERB, length + 4, -0.02], [KERB, far, -0.02], [-KERB, far, -0.02]], 'land', 'scenery:backdrop');
  // (the bands grow as they rise: the sky changes fastest at the horizon, where the eye is)
  let z = 0;
  for (let i = 0; i < Bk.bands; i++) {
    const h = 14 * 1.7 ** i, top = i === Bk.bands - 1 ? 1200 : z + h;
    add([[-REACH, far + 2, z], [REACH, far + 2, z], [REACH, far + 2, top], [-REACH, far + 2, top]], skyAt(col, Bk.bands === 1 ? 0 : i / (Bk.bands - 1)), 'scenery:backdrop');
    z = top;
  }
  // (a light is set near the top of the silhouette it is on, a little before it: a clock's face, a lit window)
  for (const s of Bk.skyline) {
    const x = s.at * REACH * 0.62, lit = s.role === 'lamp', host = lit ? Math.max(0, ...Bk.skyline.filter((q) => q.role !== 'lamp' && Math.abs(q.at - s.at) < 1e-6).map((q) => q.tall)) : 0, z0 = lit ? Math.max(0, host - s.tall - 6) : 0;
    add([[x - s.wide / 2, far - (lit ? 0.5 : 0), z0], [x + s.wide / 2, far - (lit ? 0.5 : 0), z0], [x + s.wide / 2, far - (lit ? 0.5 : 0), z0 + s.tall], [x - s.wide / 2, far - (lit ? 0.5 : 0), z0 + s.tall]], lit ? 'lamp' : 'far', 'scenery:backdrop');
  }
  return { left, right, n, from, gap, cells, faces, far };
}

export function sceneryLaws(dress, scenery, { camera = null, length = null } = {}) {
  const col = dress.palette, c = (role) => hexToRgb(col[role]), W = dress.walls, laws = [];
  // receding: the further a layer, the nearer the sky's colour
  const near = Math.min(deltaE(c('flank'), c('horizon')), deltaE(c('flank2'), c('horizon'))), off = deltaE(c('far'), c('horizon')), skyline = dress.backdrop.skyline.some((s) => s.role !== 'lamp');
  const recedes = off < near && (!skyline || off >= 0.03);
  laws.push({ law: 'receding', holds: recedes, says: recedes ? `the skyline is nearer the horizon's colour (${r2(off)}) than the walls are (${r2(near)}): the far end is the quietest thing on the screen${skyline ? '' : ' (no skyline stands on it)'}`
    : off >= near ? `the skyline stands out from the horizon (${r2(off)}) as much as the walls do (${r2(near)}): the far end, where what is coming is read, is as busy as the sides` : `the skyline is lost in the horizon (${r2(off)}, wants 0.03): it is not seen` });
  // interest: A the complex slice, B the plain one
  const na = W.a.parts.length, nb = W.b.parts.length;
  laws.push({ law: 'interest', holds: na > nb, says: na > nb ? `A (${W.a.name}, ${na} parts) is the slice the eye is given; B (${W.b.name}, ${nb}) lets it be seen` : `A (${W.a.name}, ${na} parts) is no more complex than B (${W.b.name}, ${nb}): a side of equals reads as noise, or as nothing` });
  // rhythm: each side keeps the walls' rule, and the sides differ
  const fl = rhythmFaults(scenery.left), fr = rhythmFaults(scenery.right), same = scenery.left === scenery.right;
  laws.push({ law: 'rhythm', holds: !fl.length && !fr.length && !same, says: fl.length || fr.length ? `${fl.length ? `the left (${scenery.left})` : `the right (${scenery.right})`} runs three alike or repeats a pair` : same ? `both sides are ${scenery.left}: the frame is a mirror` : `left ${scenery.left}, right ${scenery.right}: neither runs three alike nor repeats a pair, and they differ` });
  // banded: the skyline in the top third from the first step to the last
  if (camera && length != null && skyline) {
    const cam = cameraAt(camera, camera.vfov ?? VFOV), tall = Math.max(...dress.backdrop.skyline.filter((s) => s.role !== 'lamp').map((s) => s.tall));
    const vAt = (heroY) => project(cam, [0, scenery.far - heroY, tall])?.[1] ?? 0, horizon = project(cam, [0, 1e7, 0])[1];
    const first = vAt(0), last = vAt(length), seen = horizon - first >= 0.02, inside = last >= 0.02;
    laws.push({ law: 'banded', holds: seen && inside, says: !seen ? `the skyline rises ${Math.round((horizon - first) * 100)} % of the screen at the start: it is not seen` : !inside ? `at the course's end the skyline's top is ${Math.round(last * 100)} % down the screen: it has left the top of the frame` : `the skyline's top is ${Math.round(first * 100)} % down the screen at the start and ${Math.round(last * 100)} % at the end (the upper line is at ${Math.round(horizon * 100)} %): in the top third throughout` });
  }
  return laws;
}
