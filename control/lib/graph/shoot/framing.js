/**
 * Shoot plan — FRAMING BY WORDS: a camera placed from what a director says of a shot, the frame read's inverse
 * (frame.js). The dials are kept apart so any combination holds: "a low medium close-up from the left three-quarter,
 * on the left third, a little dutch" is `{ size: 'mcu', angle: 'low', side: 'three-quarter-left', place: 'left',
 * dutch: 8 }`.
 *
 *   size   a SIZES word (frame.js): ecu | cu | mcu | ms | mls | fs | ws | ews, or the words they are said by
 *   angle  an ANGLES word: eye | high | low | overhead | worm, or degrees the lens looks down (+) or up (−)
 *   side   a SIDES word: which side of the subject the camera stands on, from its facing: front, three-quarter-left,
 *          profile-left (the subject's left), three-quarter-back-left, back and their rights, or degrees turned
 *          counter-clockwise from its front
 *   place  where the subject sits across the frame: centre | left | right (the thirds) | lead (room ahead of the way
 *          it faces on the frame, the default)
 *   lens   a focal length ('35mm', a number of mm); absent, the size's own (SIZES `lens`)
 *   dutch  degrees of roll (+ banks clockwise); `true` is DUTCH
 *
 *   readFraming(words) → { framing, warnings }   the words as rows, a word it cannot read warned and its default kept
 *   solveFraming(words, subject, { aspect }) → { pos, poi, focal_mm, roll, framing, read }   `subject` { pos, heading,
 *     height } in the world's units (its ground point, radians from +x); the camera a two-node key takes, refined
 *     against the frame read until the crown and the size's edge land where the size puts them; `read` is that read
 *   frameKey(words, subject, { t, follow, aspect }) → a shoot-plan key: fixed points, or with `follow` (a subject id)
 *     both ends riding the subject in its own frame (subjects.js `frame: 'subject'`), so the framing holds as it moves
 *
 * Pure and deterministic.
 */
import { SIZES, ASPECT, STEEP, readFigure, projectPoint, sizeOf, fillEquivalent } from './frame.js';
import { hfovForFocal, parseLens } from './lens.js';

/** the angles: degrees the lens looks down onto the subject (+) or up at it (−) */
export const ANGLES = Object.freeze([
  { id: 'eye', says: 'level with the eyes: neutral', deg: 0 },
  { id: 'high', says: 'from above, looking down: the subject made smaller', deg: 22 },
  { id: 'low', says: 'from below, looking up: the subject made larger', deg: -16 },
  { id: 'overhead', says: "from straight above: the bird's eye, a map of the place", deg: 80 },
  { id: 'worm', says: "from the ground, looking up: the worm's eye", deg: -42 },
]);
const ANGLE_WORDS = { 'eye-level': 'eye', level: 'eye', neutral: 'eye', 'high-angle': 'high', down: 'high', 'low-angle': 'low', up: 'low', 'birds-eye': 'overhead', 'bird-eye': 'overhead', 'top-down': 'overhead', top: 'overhead', aerial: 'overhead', 'worms-eye': 'worm', 'worm-eye': 'worm', ground: 'worm' };

/** the sides: where the camera stands round the subject, degrees counter-clockwise from its front (its left is +90) */
export const SIDES = Object.freeze([
  { id: 'front', deg: 0 },
  { id: 'three-quarter-left', deg: 40 },
  { id: 'three-quarter-right', deg: -40 },
  { id: 'profile-left', deg: 90 },
  { id: 'profile-right', deg: -90 },
  { id: 'three-quarter-back-left', deg: 140 },
  { id: 'three-quarter-back-right', deg: -140 },
  { id: 'back', deg: 180 },
]);
const SIDE_WORDS = { frontal: 'front', face: 'front', 'head-on': 'front', 'three-quarter': 'three-quarter-left', '3/4': 'three-quarter-left', '3/4-left': 'three-quarter-left', '3/4-right': 'three-quarter-right', profile: 'profile-left', side: 'profile-left', left: 'profile-left', right: 'profile-right', behind: 'back', rear: 'back', 'from-behind': 'back' };

/** where the subject sits across the frame (u: 0 left, 1 right); `lead` reads its facing */
export const PLACES = Object.freeze({ centre: 0.5, center: 0.5, left: 1 / 3, right: 2 / 3, lead: null });
/** a dutch said as `true` (degrees) */
export const DUTCH = 12;

const squash = (s) => String(s).trim().toLowerCase().replace(/[\s_']+/g, '-');
const rowOf = (rows, words, v) => { const s = squash(v); return rows.find((r) => r.id === s) || rows.find((r) => r.id === words[s]) || null; };
const DEG = Math.PI / 180;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** The words as rows (see the header) */
export function readFraming(words = {}) {
  const warnings = [];
  const size = words.size == null ? SIZES.find((z) => z.id === 'ms') : sizeOf(words.size);
  if (!size) warnings.push(`unknown size '${words.size}' (${SIZES.map((z) => z.id).join(' | ')}); a medium shot kept`);
  let angle = ANGLES[0];
  if (typeof words.angle === 'number' && Number.isFinite(words.angle)) angle = { id: `${words.angle}°`, deg: Math.max(-85, Math.min(85, words.angle)) };
  else if (words.angle != null) { const a = rowOf(ANGLES, ANGLE_WORDS, words.angle); if (a) angle = a; else warnings.push(`unknown angle '${words.angle}' (${ANGLES.map((x) => x.id).join(' | ')}); eye level kept`); }
  let side = SIDES[0];
  if (typeof words.side === 'number' && Number.isFinite(words.side)) side = { id: `${words.side}°`, deg: words.side };
  else if (words.side != null) { const s = rowOf(SIDES, SIDE_WORDS, words.side); if (s) side = s; else warnings.push(`unknown side '${words.side}' (${SIDES.map((x) => x.id).join(' | ')}); the front kept`); }
  let place = 'lead';
  if (words.place != null) { const p = squash(words.place).replace(/-third$/, ''); if (p in PLACES) place = p === 'center' ? 'centre' : p; else warnings.push(`unknown place '${words.place}' (centre | left | right | lead); lead kept`); }
  let focal = (size || SIZES[3]).lens;
  if (words.lens != null) { const mm = parseLens(words.lens); if (mm) focal = mm; else warnings.push(`unreadable lens '${words.lens}' (say '35mm'); the size's ${focal}mm kept`); }
  const dutch = words.dutch === true ? DUTCH : (typeof words.dutch === 'number' && Number.isFinite(words.dutch) ? Math.max(-45, Math.min(45, words.dutch)) : 0);
  const framing = { size: (size || SIZES[3]).id, angle: angle.id, side: side.id, place, focal_mm: focal, ...(dutch ? { dutch } : {}) };
  return { framing, rows: { size: size || SIZES[3], angle, side }, warnings };
}

// the vertical targets on the frame: the crown's v and the size's lower edge (the share of the figure it lands on, and
// that point's v)
function targetsOf(size) {
  if (size.cut != null) return { topV: size.headroom, edgeH: size.aim, edgeV: 1 };
  return { topV: size.headroom, edgeH: 0, edgeV: Math.min(0.98, size.headroom + size.aim) };
}

/** The camera for the words on a subject (see the header) */
export function solveFraming(words, subject, { aspect = ASPECT } = {}) {
  const { framing, rows, warnings } = readFraming(words);
  const P = subject.pos, H = subject.height, heading = subject.heading || 0;
  const hfov = hfovForFocal(framing.focal_mm), tanV = Math.tan((hfov * DEG) / 2) / aspect;
  const { topV, edgeH, edgeV } = targetsOf(rows.size);
  const az = heading + rows.side.deg * DEG, el = rows.angle.deg * DEG;
  // first guess: a level lens, the frame's height spanning what the size shows
  const steep = Math.abs(rows.angle.deg) > STEEP;
  // a steep lens frames the figure's length (frame.js STEEP): the frame's height spans it by its fill
  let S = steep ? H / fillEquivalent(rows.size) : (H - edgeH * H) / Math.max(0.05, edgeV - topV);
  let D = S / (2 * tanV), yc = steep ? 0.5 * H : H + topV * S - S / 2, xs = 0;
  const floor = P[2] + 0.06 * H;
  const build = () => {
    // the camera's own elevation, kept off the floor (a worm's eye on a wide shot would stand underground)
    const e = Math.max(el, Math.asin(Math.max(-1, Math.min(1, (floor - (P[2] + yc)) / D))));
    const c = [Math.cos(e) * Math.cos(az), Math.cos(e) * Math.sin(az), Math.sin(e)];
    const rt = [-Math.sin(az), Math.cos(az), 0];   // the frame's right, looking back along −c
    const L = [P[0] + rt[0] * xs, P[1] + rt[1] * xs, P[2] + yc];
    return { pos: [L[0] + D * c[0], L[1] + D * c[1], L[2] + D * c[2]], look: L, hfov, roll: 0 };
  };
  const vAt = (cam, h) => projectPoint(cam, [P[0], P[1], P[2] + h * H], { aspect })?.v ?? 1;
  let cam = build(), read = null, wantU = PLACES[framing.place];
  for (let i = 0; i < 16; i++) {
    cam = build();
    read = readFigure(cam, { pos: P, heading, height: H }, { aspect });
    if (read.behind || !Number.isFinite(read.u)) break;
    const Sw = 2 * D * tanV;
    if (wantU == null) wantU = read.facing === 'right' ? 1 / 3 : read.facing === 'left' ? 2 / 3 : 0.5;
    xs += (read.u - wantU) * Sw * aspect;
    if (steep) continue;
    const vt = read.top, ve = edgeH > 0 ? vAt(cam, edgeH) : read.bottom;
    const span = ve - vt, want = edgeV - topV;
    if (!(span > 1e-6)) break;
    D = Math.max(0.12 * H, D * Math.max(0.6, Math.min(1.6, span / want)));   // a step bounded, never onto the subject
    yc -= ((vt + ve) / 2 - (topV + edgeV) / 2) * Sw;
  }
  cam = build();
  read = readFigure({ ...cam, roll: framing.dutch || 0 }, { pos: P, heading, height: H }, { aspect });
  // a tilt the size cannot hold (a worm's eye on an extreme close-up puts the face behind the lens): eased toward level
  if ((read.behind || !read.in_frame || read.size !== rows.size.id) && Math.abs(rows.angle.deg) > 8 && !steep) {
    const eased = Math.round(rows.angle.deg * 0.6);
    const again = solveFraming({ ...words, angle: eased }, subject, { aspect });
    return { ...again, framing: { ...again.framing, angle: rows.angle.id }, warnings: [...warnings, ...(again.warnings || []), `a ${rows.angle.id} angle cannot hold a ${rows.size.name} here: tilted ${eased}° instead`] };
  }
  return { pos: cam.pos.map(r4), poi: cam.look.map(r4), focal_mm: framing.focal_mm, roll: framing.dutch || 0, framing: { ...framing, ...(framing.place === 'lead' ? { placed: wantU === 0.5 ? 'centre' : wantU < 0.5 ? 'left' : 'right' } : {}) }, read, ...(warnings.length ? { warnings } : {}) };
}

// a world point in a subject's own frame (x forward, y left, z up), the inverse of subjects.js followPoint
function intoSubject(p, P, heading) {
  const d = [p[0] - P[0], p[1] - P[1], p[2] - P[2]], c = Math.cos(heading), n = Math.sin(heading);
  return [r4(d[0] * c + d[1] * n), r4(-d[0] * n + d[1] * c), r4(d[2])];
}

/** A shoot-plan key for the words on a subject (see the header) */
export function frameKey(words, subject, { t = 0, follow = null, aspect = ASPECT, ease } = {}) {
  const solved = solveFraming(words, subject, { aspect });
  const pos = follow ? { follow, offset: intoSubject(solved.pos, subject.pos, subject.heading || 0), frame: 'subject' } : solved.pos;
  const poi = follow ? { follow, offset: intoSubject(solved.poi, subject.pos, subject.heading || 0), frame: 'subject' } : solved.poi;
  const { placed, ...said } = solved.framing;
  return {
    key: { t, pos, poi, focal_mm: solved.focal_mm, roll: solved.roll, ...(ease ? { ease } : {}), ...(follow ? { about: follow } : {}), framing: said },
    read: solved.read, ...(solved.warnings ? { warnings: solved.warnings } : {}),
  };
}
