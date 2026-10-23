/**
 * SCREEN: the screen a game is made for, a high-level design decision set once on the gameworld (`screen`, beside
 * `camera`) and carried onto every level it makes and onto the game. It names a FRAME, an aspect and an orientation,
 * never a pixel resolution (the page draws at the device's own pixels).
 *
 * The frame is the least a player sees. A device longer than the frame along its long axis shows more world that way,
 * up to REACH, and bars past it; a device shorter along it gets bars. The field of view across the frame's short side
 * never moves: a phone frame grown taller keeps its horizontal view, a monitor frame grown wider keeps its vertical one.
 *
 *   screen: 'phone' | 'tablet' | 'screen' | { pole?, aspect?: [w, h], orientation?: 'portrait' | 'landscape', fov? }
 *
 * `fov` is the field of view across the frame's short side, in degrees (its width upright, its height on its side).
 * Absent, the camera table says it for an upright frame (gameworld/cameras.js), and a frame on its side keeps the
 * level's own.
 *
 * Absent: no frame, the page exactly as it was. Pure.
 */

export const SCREENS = Object.freeze({
  phone: Object.freeze({ aspect: Object.freeze([9, 16]), says: 'a phone held upright (9:16; a taller phone shows more above and below)' }),
  tablet: Object.freeze({ aspect: Object.freeze([4, 3]), says: 'a tablet on its side, iPad-shaped (4:3; orientation portrait stands it up)' }),
  screen: Object.freeze({ aspect: Object.freeze([16, 9]), says: 'a monitor or a TV (16:9; a wider one shows more at the sides)' }),
});
/** The screen design_game writes into a gameworld it starts when none is named. */
export const NEW_GAME_SCREEN = 'phone';
/** How much longer than the frame a device's long axis may show before the page bars it. */
export const REACH = 4 / 3;
const ORIENTATIONS = ['portrait', 'landscape'];
const KEYS = ['pole', 'aspect', 'orientation', 'fov'];
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const poles = () => Object.entries(SCREENS).map(([k, v]) => `${k} (${v.says})`).join('; ');

/**
 * A screen as written → { pole, aspect: [w, h], orientation }, or null when absent (undefined or null). Throws on a
 * malformed one, naming `where`.
 */
export function readScreen(v, where = 'screen') {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    if (!SCREENS[v]) throw new Error(`${where} is one of ${poles()}, or { aspect: [w, h], orientation? }`);
    return framed(v, SCREENS[v].aspect, null);
  }
  if (!isObj(v)) throw new Error(`${where} is a screen's name or { pole?, aspect?: [w, h], orientation? }`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw new Error(`${where}.${k} is not a screen setting (settings: ${KEYS.join(', ')})`);
  if (v.pole !== undefined && !SCREENS[v.pole]) throw new Error(`${where}.pole is one of ${Object.keys(SCREENS).join(', ')}`);
  if (v.orientation !== undefined && !ORIENTATIONS.includes(v.orientation)) throw new Error(`${where}.orientation is portrait or landscape`);
  if (v.pole !== undefined && v.aspect !== undefined) throw new Error(`${where}: a pole names its own aspect; give the pole or the aspect, not both`);
  if (v.pole === undefined && v.aspect === undefined) throw new Error(`${where} names a pole or an aspect: [w, h]`);
  if (v.aspect !== undefined) {
    const a = v.aspect;
    if (!Array.isArray(a) || a.length !== 2 || !a.every((x) => Number.isFinite(x) && x > 0)) throw new Error(`${where}.aspect is [w, h], two positive numbers (9:16 is [9, 16])`);
    if (a[0] / a[1] > 4 || a[1] / a[0] > 4) throw new Error(`${where}.aspect is at most 4:1 either way`);
  }
  if (v.fov !== undefined && !(Number.isFinite(v.fov) && v.fov >= 20 && v.fov <= 120)) throw new Error(`${where}.fov is the field of view across the frame's short side, 20 to 120 degrees`);
  const S = framed(v.pole ?? 'custom', v.aspect ?? SCREENS[v.pole].aspect, v.orientation ?? null);
  return v.fov !== undefined ? { ...S, fov: v.fov } : S;
}

// the aspect turned to the orientation asked for (a square is landscape)
function framed(pole, [w, h], orientation) {
  const turn = orientation && (orientation === 'portrait') !== (w < h);
  const aspect = turn ? [h, w] : [w, h];
  return { pole, aspect, orientation: aspect[0] < aspect[1] ? 'portrait' : 'landscape' };
}

/** The frame in whole pixels, its long side `long` px: the page's viewBox, the gates' capture size. */
export function screenFrame(S, long) {
  const [w, h] = S.aspect, k = long / Math.max(w, h);
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

/** What the level page reads: the frame's aspect (w/h), whether its long axis is the height, the reach, and the
 * frame's vertical fov (`v0`) when a fov is named (absent: the level's camera's own). */
export function screenPayload(S) {
  const aspect = S.aspect[0] / S.aspect[1], portrait = S.orientation === 'portrait';
  // a fov named: the frame's vertical fov from it (across the width upright, the height itself on its side)
  const v0 = S.fov === undefined ? null : portrait ? 2 * Math.atan(Math.tan(S.fov * Math.PI / 360) / aspect) * 180 / Math.PI : S.fov;
  return { pole: S.pole, aspect: r4(aspect), portrait, reach: r4(REACH), ...(v0 !== null ? { v0: r4(v0) } : {}) };
}

/**
 * The shape a page of the device's aspect `a` (w/h) shows: the frame's aspect, longer along its long axis up to the
 * reach. → { shown: the aspect drawn, fovScale: the factor on tan(vfov/2) that holds the short axis's field of view }.
 * A landscape frame keeps its vertical fov (three.js's own behaviour as the width grows); a portrait frame grown taller
 * keeps its horizontal fov, so its vertical one opens by frame/shown. The page carries the same arithmetic inline.
 */
export function fitScreen(P, a) {
  const lo = P.portrait ? P.aspect / P.reach : P.aspect, hi = P.portrait ? P.aspect : P.aspect * P.reach;
  const shown = Math.min(hi, Math.max(lo, a));
  return { shown, fovScale: P.portrait && shown < P.aspect ? P.aspect / shown : 1 };
}

/** A page payload's frame (screenPayload's) in whole pixels, its long side `long` px: what the gates render. */
export function payloadFrame(P, long) {
  return P.portrait ? { width: Math.round(long * P.aspect), height: long } : { width: long, height: Math.round(long / P.aspect) };
}
