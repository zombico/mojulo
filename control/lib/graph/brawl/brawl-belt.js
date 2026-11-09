/**
 * brawl belt — where a brawl is fought on a level: a street with depth, the fight's lane opened up (versus-lane.js).
 *
 * A side-view fight runs along a line; a brawl runs along a BELT: a straight run of street with a depth band across it,
 * cut into SCREENS the camera scrolls through, some of them held by a GATE until their wave is beaten, the last perhaps
 * the boss's. The level says where the belt is, the brawl does the rest:
 *
 *   { at: [x, y], heading, floor?, depth?: [near, far], screens: [{ length, gate?, boss? }], angle? }
 *     at       m, where the belt starts on the level's ground plan (world x, y; z up)
 *     heading  degrees, the way the belt runs (0 along +x); the brawl's s (its sim's x) is this way, from 0 at `at`
 *     floor    m, the height the bodies stand on (0)
 *     depth    m, the band the bodies walk in across the belt, [near, far] of its line (n, toward the far side; the
 *              camera stands on the near side, −n); [-2.5, 2.5] by default
 *     screens  the run, in order, each `length` m along it; `gate` holds the camera at its end until its wave is beaten;
 *              `boss` (the last screen only) is the boss's, and held
 *     angle    the camera's locked angle (BELT_ANGLES), one a stage, chosen when the game is made; it never orbits
 *
 * A belt is straight: a street that turns is two belts (a stage's next street), never a bent one, so a body's s and n are
 * metres along and across wherever it stands.
 *
 *   readBelt(belt, where)          → the settled belt: its words and `length`, each screen's `from` and `to` (throws
 *                                    naming the fault)
 *   beltPoint(belt, s, n, z)       → [x, y, z] world metres of a belt-local point
 *   screenAt(belt, s)              → the index of the screen s is in
 *   heldAt(belt, cleared)          → the s the camera may not show past: the end of the first held screen whose wave is
 *                                    not in `cleared` (a set or a list of screen indices), else the belt's end
 *   viewHalf(belt)                 → m, half the run the camera shows at the band's middle
 *   beltScroll(belt, cam, lead, cleared) → the camera's s after the bodies at `lead` (their s) push it: on, never back,
 *                                    never past what is held
 *   beltBounds(belt, cam)          → { s: [lo, hi], n: [near, far] }: where a body may stand with the camera at `cam`
 *   beltCamera(belt, cam)          → { cameraPosition, lookAt, horizontalFov }: the locked angle at `cam`
 *
 * Pure: no clock, no dice.
 */

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const no = (msg) => { throw new Error(`brawl: ${msg}`); };

/** the belt's bounds: room for a crowd across it, a screen the camera can scroll through, a street a stage could hold */
export const BELT_LIMITS = Object.freeze({ depth: [2, 10], screen: [8, 48], screens: [1, 16], at: 2000, floor: [-50, 200] });
export const BELT_DEPTH = Object.freeze([-2.5, 2.5]);

/**
 * THE LOCKED ANGLES, a stage's camera (chosen by the model when it makes the game, a recipe word): each square to the
 * belt, or yawed a little down the way it runs, pitched down onto the band, at a distance and a lens. The camera only
 * travels along the belt; its angle never changes within a stage.
 *   pitch     degrees down from level
 *   yaw       degrees turned from square toward the way the belt runs (the street opening ahead)
 *   distance  m from the band's middle at a body's chest
 *   fov       degrees, horizontal
 */
const angle = (reads, pitch, yaw, distance, fov) => Object.freeze({ reads, pitch, yaw, distance, fov });
export const BELT_ANGLES = Object.freeze({
  classic: angle('square to the street, a little above it: the arcade brawler\'s, the band foreshortened', 14, 0, 10, 50),
  high: angle('square and high, looking down onto the band: the crowd\'s lines read, the street a floor', 34, 0, 11, 50),
  low: angle('square and low, near the kerb: the bodies tall against the walls, the band shallow', 5, 0, 9, 54),
  ahead: angle('turned down the street the way it runs, a little above: the way on opening ahead', 18, 22, 10, 50),
});
export const BELT_ANGLE_IDS = Object.freeze(Object.keys(BELT_ANGLES));
/** the height the camera looks at above the floor: a body's chest */
const CHEST = 1.1;
/** how far into the screen's leading third a body walks before it pushes the camera on (of the view's half) */
const PUSH = 1 / 3;
/** how near a screen's edge a body may stand (m): the edge is a wall it cannot walk through, a body's width in */
const EDGE = 0.5;

const KEYS = ['at', 'heading', 'floor', 'depth', 'screens', 'angle'];
const SCREEN_KEYS = ['length', 'gate', 'boss'];

/** Read a belt; → { at, heading, floor, depth, screens: [{ length, from, to, gate, boss }], angle, length }. */
export function readBelt(belt, where = 'belt') {
  if (!belt || typeof belt !== 'object' || Array.isArray(belt)) no(`${where} is { at: [x, y], heading, floor?, depth?: [near, far], screens: [{ length, gate?, boss? }], angle? }`);
  for (const k of Object.keys(belt)) if (!KEYS.includes(k)) no(`${where}.${k} is not a belt's word (${KEYS.join(', ')})`);
  const { at = [0, 0], heading = 0, floor = 0, depth = BELT_DEPTH, screens, angle: angleId = 'classic' } = belt;
  if (!Array.isArray(at) || at.length !== 2 || !at.every(isNum) || at.some((v) => Math.abs(v) > BELT_LIMITS.at)) no(`${where}.at is [x, y], metres on the level's plan (within ${BELT_LIMITS.at} m)`);
  if (!isNum(heading)) no(`${where}.heading is degrees, the way the belt runs (0 along +x)`);
  const [fLo, fHi] = BELT_LIMITS.floor;
  if (!isNum(floor) || floor < fLo || floor > fHi) no(`${where}.floor is the height the bodies stand on, ${fLo} to ${fHi} m`);
  const [dLo, dHi] = BELT_LIMITS.depth;
  if (!Array.isArray(depth) || depth.length !== 2 || !depth.every(isNum) || !(depth[1] - depth[0] >= dLo && depth[1] - depth[0] <= dHi)) no(`${where}.depth is [near, far] across the belt's line, the band ${dLo} to ${dHi} m deep`);
  if (!BELT_ANGLES[angleId]) no(`${where}.angle is one of ${BELT_ANGLE_IDS.join(', ')} (the camera's locked angle)`);
  const [nLo, nHi] = BELT_LIMITS.screens, [sLo, sHi] = BELT_LIMITS.screen;
  if (!Array.isArray(screens) || screens.length < nLo || screens.length > nHi) no(`${where}.screens is a list of ${nLo} to ${nHi} screens { length, gate?, boss? }`);
  let s = 0;
  const out = screens.map((sc, i) => {
    const w = `${where}.screens[${i}]`;
    if (!sc || typeof sc !== 'object' || Array.isArray(sc)) no(`${w} is { length, gate?, boss? }`);
    for (const k of Object.keys(sc)) if (!SCREEN_KEYS.includes(k)) no(`${w}.${k} is not a screen's word (${SCREEN_KEYS.join(', ')})`);
    if (!isNum(sc.length) || sc.length < sLo || sc.length > sHi) no(`${w}.length is ${sLo} to ${sHi} m along the belt`);
    for (const k of ['gate', 'boss']) if (sc[k] !== undefined && typeof sc[k] !== 'boolean') no(`${w}.${k} is true or false`);
    if (sc.boss && i !== screens.length - 1) no(`${w}.boss: the boss's screen is the belt's last`);
    const from = s; s += sc.length;
    // (a boss's screen is held: the street goes on only when the boss falls)
    return { length: r4(sc.length), from: r4(from), to: r4(s), gate: !!(sc.gate || sc.boss), boss: !!sc.boss };
  });
  const B = { at: [r4(at[0]), r4(at[1])], heading: r4(((heading % 360) + 360) % 360), floor: r4(floor), depth: [r4(depth[0]), r4(depth[1])], screens: out, angle: angleId, length: r4(s) };
  // (the camera, held at a screen's end, stands its view's half before it: a screen held before the camera's first view
  // is filled would hold it behind its start)
  const half = viewHalf(B);
  for (const [i, sc] of out.entries()) if (sc.gate && sc.to < 2 * half) no(`${where}.screens[${i}]: a held screen ends at least the camera's view (${r4(2 * half)} m) along the belt`);
  if (B.length < 2 * half) no(`${where}: the belt runs at least the camera's view (${r4(2 * half)} m)`);
  return B;
}

/** A belt-local point in world metres: s along the belt from its start, n across it toward the far side (the camera
 * stands at −n), z above its floor. */
export function beltPoint(belt, s, n = 0, z = 0) {
  const t = (belt.heading * Math.PI) / 180, c = Math.cos(t), si = Math.sin(t);
  return [r4(belt.at[0] + s * c - n * si), r4(belt.at[1] + s * si + n * c), r4(belt.floor + z)];
}

/** The index of the screen s is in (the first at its start, the last past the belt's end). */
export function screenAt(belt, s) {
  const i = belt.screens.findIndex((sc) => s < sc.to);
  return i < 0 ? belt.screens.length - 1 : i;
}

/** The s the camera may not show past: the end of the first held screen whose wave is not yet beaten. */
export function heldAt(belt, cleared = []) {
  const done = cleared instanceof Set ? cleared : new Set(cleared);
  const i = belt.screens.findIndex((sc, k) => sc.gate && !done.has(k));
  return i < 0 ? belt.length : belt.screens[i].to;
}

/** Half the run the camera shows across the band's middle (m): its distance through its lens. */
export function viewHalf(belt) {
  const A = BELT_ANGLES[belt.angle];
  return r4(A.distance * Math.tan((A.fov * Math.PI) / 360));
}

/** The camera's s after the bodies push it: it follows the one furthest on once past the leading third of the view,
 * never goes back (the street behind is beaten) and never shows past what is held. `lead` is the bodies' s (a list or
 * one). */
export function beltScroll(belt, cam, lead, cleared = []) {
  const half = viewHalf(belt), far = Math.max(...[].concat(lead));
  const want = far - half * PUSH;
  const limit = heldAt(belt, cleared) - half;
  return r4(Math.max(half, Math.min(Math.max(cam, want), Math.max(cam, limit))));
}

/** Where a body may stand with the camera at `cam`: the view less a body's width each side (the screen's edges are
 * walls), within the belt, and the band across it. */
export function beltBounds(belt, cam) {
  const half = viewHalf(belt);
  return { s: [r4(Math.max(EDGE, cam - half + EDGE)), r4(Math.min(belt.length - EDGE, cam + half - EDGE))], n: [...belt.depth] };
}

/** The locked angle at `cam`: looking at the band's middle at a body's chest, from the near side, pitched down and
 * yawed toward the way the belt runs as the angle says (a camera's framing, as a world's cameras carry it). */
export function beltCamera(belt, cam) {
  const A = BELT_ANGLES[belt.angle], mid = (belt.depth[0] + belt.depth[1]) / 2;
  const p = (A.pitch * Math.PI) / 180, y = (A.yaw * Math.PI) / 180;
  // (in the belt's frame: the camera stands back toward −n, turned by the yaw so it looks a little along +s)
  const back = A.distance * Math.cos(p), up = A.distance * Math.sin(p);
  const ds = -back * Math.sin(y), dn = -back * Math.cos(y);
  return { cameraPosition: beltPoint(belt, cam + ds, mid + dn, CHEST + up), lookAt: beltPoint(belt, cam, mid, CHEST), horizontalFov: A.fov };
}
