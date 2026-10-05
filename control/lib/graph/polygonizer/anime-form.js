/** anime-form.js — the Anime Form Studio's head, PORTED: the sibling of Character Studio (the face, body and hair labs
 * the hero was built on) that designs an original anime face and hair as one parametric construction. Its recipe
 * contract (schema `anime-form-studio-v3`: a male / female design base, face, hair and expression values, per-clump
 * lock edits) and its geometry are the studio's; the arithmetic below is its `model.js` in the same operation order, with
 * the transcendentals from util/dmath.js, so the floats are the same on every platform (anime-form.test.js pins per-part
 * hashes).
 *
 * Studio frame: Y up, forward −Z, construction units (the head is ~2.2 tall). Parts are flat triangle soups: `skin`
 * (face and back shells meeting at a side seam, eye and mouth apertures bridged by rings, ears, the neck context),
 * `sclera` (the eye surface inside its aperture), `iris`, `pupil`, `ink` (the upper lash, the lower rim, the brow),
 * `mouth`, `hair` (a cap plus swept solid clumps along root → control → tip curves). A six-degree chin-up rest pose is
 * applied last (`headPitch`), the upper neck following.
 *
 * Additive to the studio, never changing its output: the result also names the neck's range inside `skin`
 * (`neck: { start, end }`, flat indices), and `options.weld` fades the sclera's 1/1000-unit forward lift to zero at its
 * rim so the eye surface closes onto its aperture ring (anime-head.js welds the face into one closed part). The hero
 * wears this through anime-head.js; nothing here knows the hero. Pure; no dice.
 *
 * mojulo's HAIR FIT (`options.fitHair`, hair-passes; off by default, so the studio's hair stays the studio's): the studio
 * grows its cap as a fixed ellipsoid and its clumps from fixed points, so a skull that differs from its own (a fuller
 * occiput, a deeper face, fuller cheeks) shows through or swallows them — from behind, a bald oval at the occiput. With
 * the fit the cap is the head's own surface lifted off it (down to the studio's hairline, closed at the crown), and every
 * clump's centre line is draped outside the head's actual section at its height by its own thickness and the sag of its
 * width, so the hair seats on whatever face the controls made. Two mojulo words ride the same construction: the `hime`
 * family (a blunt fringe at the brow, sidelocks squared at the jaw, a long straight back) and `ahoge` (an amount: one
 * upright curl at the crown; 0 is none). A recipe without them builds exactly as the studio's.
 *
 * mojulo's HAIR FORMS (`options.forms`, on the bob, long and hime families): the studio's female families are many
 * separate clumps, a comb of strands; anime hair is drawn as a few masses. With forms the clumps are CONSOLIDATED into
 * sections — three bang sections, a side section each side, three back sections — each ONE closed thick shell skinned
 * across its member clumps' curves (their authored tips, sweep, part and per-clump lock edits still shape it). A section
 * ends in ONE point: its hem is a V, the full length at the section's centre rising toward its edges (`taper` deepens
 * the V; `hime` is cut straight). Neighbouring sections share an edge clump, so they overlap like layered locks.
 *
 * mojulo's SCULPT (`options.sculpt`, the graphic face; anime-sculpt.js turns the door words into these units): each word
 * gates its own term, an if-block or a ternary whose else is the studio's expression verbatim, and a word at its neutral
 * (SCULPT_NEUTRAL) is dropped before the build, so an absent, empty or all-neutral sculpt runs exactly the studio's
 * statements. The words: the eye level; the nose placed (the tip, pronasale, with its own projection; the dorsum starting
 * below the brow); the lip line (stomion) and the mouth width (the mouth aperture widened on the lattice past the studio's);
 * the palpebral fissure as upper / lower lid curves (one outline shared by the aperture, the sclera dish, the iris clip and
 * the lid band); the lateral canthus set back along the globe; the upper-lid band (`lidWeight`: its weight, a tail past
 * the lateral canthus, a flick; `lidShut`: shutting, it thins and its line sags) replacing the upper lash; the sclera's
 * dish (`scleraShut`: shutting, it flattens and the lid band's lower edge tucks further under the opening, so a shut lid
 * holds no white trough — a lid that sags as it shuts, `lidShut.sag`, can still leave a thin line above the slit); the
 * graphic lenses (`lidCover`: the
 * iris sized so the lid covers that share of it, clipped by the lid, a catchlight; at every expression the same grid,
 * what the lids hide set back behind them); the brow as a block (`shutLift`: relaxing up as the lids shut); a nose line
 * down the shade side; the pupil; the lower rim; the ear raised (`ear { lift }`). A part key (`lid`, `brow`, `catch`,
 * `nose`) exists only while its word is on. `options.budget: 'game'` lowers the lenses' resolution (its own option, never
 * `coarse`).
 *
 * mojulo's HAIR FORM (`options.hairForm`; anime-head.js turns the door's hair words into these units): the hair mass
 * built off the skull instead of hugging it, under the same discipline as the sculpt (each term an if-block or a ternary
 * whose else is the studio's expression verbatim, a neutral word dropped first by `hairFormOf`). The terms: the regional
 * LIFT (`lift { crown, temple, front, back }`, construction units: the fitted cap and the drape stand that far off the
 * skull, blended from the crown to the hairline by region), and while it is on the roots EMERGE from the cap (each
 * clump's centre sunk to 0.15 of its seat at the root and its thickness pinched to 0.3 there, both full a little way out,
 * so no ring of lock ends stands on the cap); the `dome` (a clump arching over the crown kept outside the skull's own top,
 * seen from a centre inside it, plus the crown lift); the `ridge` SECTION (a roof with a spine on the outer side and a
 * flatter underside, in place of the 8-gon ellipse, so a lock shades as two planes); on the consolidated sections a `ridge` (a spine along the section's centre) and
 * `flute` (a spine per member lock); the short family's crown accents (`crown: 'tuck' | 'none'`); and the cut's
 * words: `sweepBack` (the fringe re-aimed to rise off the hairline over the crown and point back), `hairline
 * { front }` (the front hairline raised), `sweepSides` (the temple clumps swept back over the ear), `fringeGroups` (the
 * bang sections by member clump), `backNotch` (the back sections' hem), `fringeNotch` (the bang sections' hem), `flip` (the side
 * and back ends kicked out), `spikes` (the short family's clumps as broad radiating spikes) and `sideTail` (the back gathered to a tie behind one ear, one round tail over the shoulder,
 * its clump `tail`). Nothing here is written into the recipe.
 */
import * as dmath from '../../util/dmath.js';

export const ANIME_SCHEMA = 'anime-form-studio-v3';
export const ANIME_MALE_BASELINE = Object.freeze({ width: 0.99, lower: 1.03, jaw: 1, cheekVolume: 1.14, lowerCheekVolume: 1.17, chin: 1.3, depth: 1.14, backDepth: 1.14, occiput: 1.18, nape: 0.82, jawAngle: 0.79, jawDepth: 1.19, chinProjection: 1.21, chinHeight: 0.77, nose: 1.44, eyeWidth: 0.87, eyeHeight: 0.85, spacing: 0.98 });
export const ANIME_FEMALE_BASELINE = Object.freeze({ width: 0.98, lower: 0.86, jaw: 1.01, cheekVolume: 1.06, lowerCheekVolume: 1.18, chin: 1.05, depth: 1.18, backDepth: 1.1, occiput: 1, nape: 0.6, jawAngle: 1, jawDepth: 1.3, chinProjection: 0.84, chinHeight: 0.8, nose: 1.39, eyeWidth: 0.85, eyeHeight: 1.1, spacing: 0.97 });
export const ANIME_BASELINES = Object.freeze({ male: ANIME_MALE_BASELINE, female: ANIME_FEMALE_BASELINE });
/** [key, label, min, max] — the studio's controls and slider ranges (a recipe value is relative to the design base) */
export const ANIME_FACE_DEFS = Object.freeze([['foreheadDepth', 'Forehead depth', 0.7, 1.3], ['browDepth', 'Brow depth', 0.7, 1.3], ['headPitch', 'Chin-up tilt', 0.5, 1.5], ['width', 'Head width', 0.88, 1.12], ['lower', 'Lower-face length', 0.82, 1.18], ['jaw', 'Jaw breadth', 0.75, 1.22], ['cheekVolume', 'Cheekbone fullness', 0.6, 1.4], ['lowerCheekVolume', 'Cheek volume', 0.6, 1.4], ['chin', 'Chin breadth', 0.65, 1.5], ['depth', 'Face depth', 0.82, 1.18], ['backDepth', 'Back of head depth', 0.82, 1.18], ['occiput', 'Upper rear skull fullness', 0.75, 1.25], ['nape', 'Nape tuck', 0.6, 1.4], ['jawAngle', 'Jaw corner height', 0.75, 1.25], ['jawDepth', 'Jaw depth', 0.7, 1.3], ['chinProjection', 'Chin projection', 0.7, 1.3], ['chinHeight', 'Chin height', 0.75, 1.25], ['nose', 'Nose projection', 0.5, 1.5], ['eyeWidth', 'Eye width', 0.82, 1.1], ['eyeHeight', 'Eye height', 0.78, 1.12], ['spacing', 'Eye spacing', 0.88, 1.08], ['tilt', 'Outer-eye lift', -0.12, 0.12], ['iris', 'Iris size', 0.75, 1.1]].map((d) => Object.freeze(d)));
export const ANIME_HAIR_DEFS = Object.freeze([['volume', 'Crown volume', 0.93, 1.15], ['length', 'Back / side length', 0.8, 1.2], ['fringe', 'Fringe length', 0.75, 1.2], ['sweep', 'Tip sweep', -0.3, 0.3], ['clump', 'Clump width', 0.85, 1.12], ['thickness', 'Clump thickness', 0.65, 1.4], ['taper', 'Tip taper', 0.7, 1.4], ['part', 'Part offset', -0.18, 0.18]].map((d) => Object.freeze(d)));
export const ANIME_EXPRESSION_DEFS = Object.freeze([['blink', 'Close lids', 0, 1], ['smile', 'Smile', 0, 1], ['open', 'Open mouth', 0, 1], ['brow', 'Brow attitude', -1, 1]].map((d) => Object.freeze(d)));
export const ANIME_HAIR_STYLES = Object.freeze(['bob', 'short', 'long']);
/** the studio's lock names: seven fringe clumps, three temple clumps a side, eleven back clumps, six crown accents (short) */
export const ANIME_LOCK_RE = /^(fringe-[1-7]|(left|right)-temple-[0-2]|back-([1-9]|10|11)|crown-(-1|1)-[0-2])$/;
export const ANIME_LOCK_KEYS = Object.freeze(['cx', 'cy', 'cz', 'tx', 'ty', 'tz']);

const FACE = ANIME_FACE_DEFS, HAIR = ANIME_HAIR_DEFS, EXPRESSION = ANIME_EXPRESSION_DEFS, SCHEMA = ANIME_SCHEMA;
const MALE_BASELINE = ANIME_MALE_BASELINE, FEMALE_BASELINE = ANIME_FEMALE_BASELINE;

/** the face slider ranges for a design base, widened by its baseline offset (the studio's `faceDefs`) */
export function animeFaceDefs(kind) {
  return FACE.map(([k, label, min, max]) => { const offset = ((kind === 'female' ? FEMALE_BASELINE : MALE_BASELINE)[k] ?? 1) - 1; return [k, label, Math.min(min, min - offset), Math.max(max, max - offset)]; });
}
/** a v3 recipe's face with the design base's baseline added (the values a builder reads) */
export function animeEffectiveFace(r) {
  const f = { ...r.face };
  if (r.schema === SCHEMA) for (const [k, value] of Object.entries(r.source === 'female' ? FEMALE_BASELINE : MALE_BASELINE)) f[k] += value - 1;
  return f;
}
/** a fresh design at its base (the studio's `fresh`) */
export function animeFresh(kind = 'female') {
  return { schema: SCHEMA, source: kind,
    face: { foreheadDepth: 1, browDepth: 1, headPitch: 1, width: 1, lower: 1, jaw: 1, cheekVolume: 1, lowerCheekVolume: 1, chin: 1, depth: 1, backDepth: 1, occiput: 1, nape: 1, jawAngle: 1, jawDepth: 1, chinProjection: 1, chinHeight: 1, nose: 1, eyeWidth: 1, eyeHeight: 1, spacing: 1, tilt: kind === 'male' ? 0.035 : 0, iris: kind === 'male' ? 0.88 : 1 },
    hair: { style: kind === 'male' ? 'short' : 'bob', volume: 1, length: 1, fringe: 1, sweep: 0, clump: 1, thickness: 1, taper: 1, part: 0 },
    expression: { blink: 0, smile: 0, open: 0, brow: 0 }, locks: {} };
}
/** Validate and migrate a studio recipe (v1 / v2 → v3), as the studio's loader does; throws on anything it refuses. */
export function animeReadRecipe(r) {
  r = structuredClone(r);
  if (r?.face) for (const key of ['foreheadDepth', 'browDepth', 'headPitch', 'lowerCheekVolume', 'cheekVolume', 'backDepth', 'occiput', 'nape', 'jawAngle', 'jawDepth', 'chinProjection', 'chinHeight']) if (r.face[key] === undefined) r.face[key] = 1;
  if (r?.schema === 'anime-form-studio-v1') { if (r.source === 'female') for (const [k, value] of Object.entries(FEMALE_BASELINE)) r.face[k] -= value - 1; r.schema = 'anime-form-studio-v2'; }
  if (r?.schema === 'anime-form-studio-v2') { if (r.source === 'male') for (const [k, value] of Object.entries(MALE_BASELINE)) r.face[k] -= value - 1; r.schema = SCHEMA; }
  if (!r || r.schema !== SCHEMA || !['female', 'male'].includes(r.source) || !['bob', 'short', 'long'].includes(r.hair?.style)) throw Error('Use an Anime Form Studio recipe.');
  for (const [key, defs] of [['face', animeFaceDefs(r.source)], ['hair', HAIR], ['expression', EXPRESSION]]) for (const [k, label, min, max] of defs) if (!Number.isFinite(r[key]?.[k]) || r[key][k] < min || r[key][k] > max) throw Error(label + ' is outside the supported range.');
  if (!r.locks || typeof r.locks !== 'object' || Array.isArray(r.locks) || Object.keys(r.locks).length > 50) throw Error('Invalid lock edits.');
  for (const [name, edit] of Object.entries(r.locks)) {
    if (!ANIME_LOCK_RE.test(name) || !edit || typeof edit !== 'object') throw Error('Invalid lock name.');
    for (const k of ANIME_LOCK_KEYS) if (!Number.isFinite(edit[k]) || Math.abs(edit[k]) > 0.2) throw Error('Lock edits must stay within 0.2 units.');
  }
  return structuredClone(r);
}

const mix = (a, b, t) => a + (b - a) * t, clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, s) => a.map((v) => v * s), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = (a) => mul(a, 1 / (dmath.hypot(...a) || 1));
/** a Catmull-Rom-slope Hermite through (y, value) knots, held flat past the last */
function profile(y, points) {
  for (let i = 1; i < points.length; i++) if (y <= points[i][0]) {
    const [x0, a] = points[i - 1], [x1, b] = points[i], t = clamp((y - x0) / (x1 - x0)), prev = points[Math.max(0, i - 2)], next = points[Math.min(points.length - 1, i + 1)], m0 = (b - prev[1]) / (x1 - prev[0]), m1 = (next[1] - a) / (next[0] - x0), h = x1 - x0;
    return (2 * t * t * t - 3 * t * t + 1) * a + (t * t * t - 2 * t * t + t) * h * m0 + (-2 * t * t * t + 3 * t * t) * b + (t * t * t - t * t) * h * m1;
  }
  return points.at(-1)[1];
}

/**
 * Build the studio's head from a v3 recipe.
 * @param {object} r a recipe (`animeFresh()` / `animeReadRecipe()` shape)
 * @param {{ coarse?: boolean, weld?: boolean, fitHair?: boolean, forms?: boolean, sculpt?: object, budget?: 'game', hairForm?: object }} [options]
 *   `coarse`: the studio's coarse sampling (the construction lab's cage); `weld`: the sclera's rim lies exactly on its
 *   aperture ring; `sculpt`: the graphic face's words in these units; `budget: 'game'`: the lighter lenses; `hairForm`:
 *   the hair form's terms in these units (see the header; the lift and the dome read the hair fit)
 * @returns {{ headPolygons, parts: { skin, hair, sclera, iris, pupil, ink, mouth, lid?, brow?, catch?, nose? }, cage, guides, locks, recipe, neck }}
 */
export function buildAnime(r, options = {}) {
  const headPolygons = []; let capture = true;
  const f = animeEffectiveFace(r), h = r.hair, e = r.expression, parts = { skin: [], hair: [], sclera: [], iris: [], pupil: [], ink: [], mouth: [] }, cage = [], guides = [], locks = [];
  // the SCULPT: each word gates its own term; a word at its neutral is dropped first, so an absent, empty or all-neutral
  // sculpt runs the studio's statements. A part key exists only while its word is on.
  const S = sculptOf(options.sculpt);
  if (S?.lidWeight !== undefined) parts.lid = [];
  if (S?.brow) parts.brow = [];
  if (S?.catchlight) parts.catch = [];
  if (S?.noseLine) parts.nose = [];
  const EYE = S && (S.fissure || S.lidWeight !== undefined || S.brow || S.lidCover !== undefined) ? eyeShapeOf(S, f) : null;
  const EYE_Y = S?.eyeLevel !== undefined ? S.eyeLevel : 0.055;
  const LENS = options.budget === 'game' ? { seg: 24, rings: 2 } : { seg: 40, rings: 3 };   // the lens resolution (a budget, never `coarse`)
  function tri(part, a, b, c) { if (dmath.hypot(...cross(sub(b, a), sub(c, a))) < 1e-10) return; parts[part].push(...a, ...b, ...c); }
  function quad(part, a, b, c, d, edge = false) { if (options.coarse && capture && part === 'skin') headPolygons.push([a, b, c, d]); tri(part, a, b, c); tri(part, a, c, d); if (edge) cage.push(...a, ...b, ...b, ...c, ...c, ...d, ...d, ...a); }
  function width(y) { return profile(y, [[-1.02, 0.10 * f.chin], [-0.90, 0.27 * f.chin], [-0.64, 0.51 * f.jaw], [-0.30, 0.69 * (1 + 0.25 * (f.jaw - 1))], [0.12, 0.78], [0.45, 0.79], [0.78, 0.69], [1.04, 0.41], [1.16, 0.18], [1.19, 0.009]]) * f.width; }
  function fy(y) { return y < -0.2 ? -0.2 + (y + 0.2) * f.lower : y; }
  // Separate vault/occiput/nape and jaw-to-chin profiles, informed by the fitted head landmarks.
  function surface(u, y, back = false) {
    let x = u * width(y); const g = (v, c, w) => dmath.exp(-(((v - c) / w) ** 2)), arc = dmath.pow(Math.max(0, 1 - u * u), 0.45);
    const seam = profile(y, [[-1.02, -0.43], [-0.90, -0.36], [-0.74, -0.17], [-0.60, -0.035], [-0.30, 0.06], [1.19, 0.06]]);
    const front = profile(y, [[-1.02, 0.025], [-0.90, 0.12], [-0.74, 0.30], [-0.60, 0.45], [-0.30, 0.57], [0.22, 0.59], [0.62, 0.57], [0.92, 0.45], [1.16, 0.18], [1.19, 0.009]]);
    const rear = profile(y, [[-1.02, 0.55], [-0.98, 0.59], [-0.90, 0.58], [-0.74, 0.43], [-0.60, 0.30], [-0.40, 0.30], [-0.20, 0.48], [0.10, 0.68], [0.45, 0.73], [0.65, 0.70], [0.78, 0.64], [0.92, 0.53], [1.04, 0.40], [1.10, 0.30], [1.16, 0.17], [1.19, 0.009]]);
    let z = seam + (back ? rear * (f.backDepth ?? 1) : -front * f.depth) * arc;
    if (back) { z += arc * (0.28 * ((f.occiput ?? 1) - 1) * g(y, 0.78, 0.32) - 0.16 * ((f.nape ?? 1) - 1) * g(y, -0.45, 0.24)); }
    else if (S?.nose) {
      // the nose placed: the tip (pronasale) at its height with its own projection and width, the dorsum a ridge that
      // starts below the brow (dorsumStart) and ramps down to the tip; the muzzle bump follows the lip line
      const N = S.nose, ramp = y > N.dorsumStart ? 0 : y > N.pronasale ? dmath.pow((N.dorsumStart - y) / (N.dorsumStart - N.pronasale), 1.3) : dmath.exp(-(((y - N.pronasale) / 0.05) ** 2));
      z -= f.nose * (N.tip * 0.135 * g(x, 0, N.tipWidth[0]) * g(y, N.pronasale, N.tipWidth[1]) + N.dorsum * 0.072 * g(x, 0, N.dorsumWidth) * ramp);
      z -= 0.025 * g(x, 0, 0.18) * g(y, S.stomion !== undefined ? S.stomion + 0.035 : -0.50, 0.12);
    }
    else { z -= f.nose * (0.135 * g(x, 0, 0.092) * g(y, -0.18, 0.085) + 0.072 * g(x, 0, 0.075) * g(y, 0.02, 0.20)); z -= 0.025 * g(x, 0, 0.18) * g(y, S?.stomion !== undefined ? S.stomion + 0.035 : -0.50, 0.12); }
    // canthusSetback: the lateral canthus set back along the globe (eye-local; faded to zero at the side seam)
    if (!back && S?.canthusSetback) { const cl = 0.455 * f.spacing + 0.285 * f.eyeWidth * 0.95; z += S.canthusSetback * g(Math.abs(u), cl, 0.13) * g(y, EYE_Y, 0.14) * (1 - dmath.pow(Math.abs(u), 8)); }
    // Independent forehead and supraorbital depth; blend to the temple seam.
    if (!back) { const sideFade = Math.max(0, 1 - u * u); z -= 0.28 * ((f.foreheadDepth ?? 1) - 1) * g(y, 0.70, 0.28) * sideFade; z -= 0.22 * ((f.browDepth ?? 1) - 1) * g(y, 0.34, 0.14) * sideFade; }
    // Cheek fullness is local to the front malar region; fades to zero at the side seam.
    if (!back) { const cheekWeight = g(Math.abs(u), 0.57, 0.24) * g(y, -0.29, 0.22) * (1 - dmath.pow(Math.abs(u), 8)); const amount = (f.cheekVolume ?? 1) - 1; x += Math.sign(u) * 0.18 * amount * cheekWeight; z -= 0.25 * amount * cheekWeight; }
    // Soft cheek below the malar area, lateral to the mouth; leaves the centerline and seam fixed.
    if (!back) { const weight = g(Math.abs(u), 0.64, 0.23) * g(y, -0.56, 0.17) * (1 - dmath.pow(Math.abs(u), 8)); const amount = (f.lowerCheekVolume ?? 1) - 1; x += Math.sign(u) * 0.20 * amount * weight; z -= 0.28 * amount * weight; }
    // Chin projection blends through the whole lower ring; the rear rises into the jaw corner.
    z -= 0.18 * ((f.chinProjection ?? 1) - 1) * g(y, -0.91, 0.18);
    const lower = clamp((-0.30 - y) / 0.72), rearWeight = back ? 0.65 + 0.35 * arc : 0.65 * dmath.pow(Math.abs(u), 1.5);
    const lift = 0.20 * dmath.sin(Math.PI * lower) * rearWeight * (f.jawAngle ?? 1);
    // Local jaw-corner depth, with no displacement at the chin or upper skull.
    const jawWeight = y > -0.90 && y < -0.30 ? dmath.sin(Math.PI * (y + 0.90) / 0.60) ** 2 : 0;
    const jawAmount = (f.jawDepth ?? 1) - 1;
    // Broaden and deepen the rear jaw together rather than merely translating its corner.
    z += 0.70 * jawAmount * jawWeight * rearWeight;
    x *= 1 + 0.45 * jawAmount * jawWeight * rearWeight;
    // Positive chin height lengthens the lower chin, fading out before the mouth.
    const chinWeight = clamp((-0.66 - y) / 0.36);
    const chinLift = -0.40 * ((f.chinHeight ?? 1) - 1) * chinWeight * chinWeight;
    return [x, fy(y) + lift + chinLift, z];
  }

  const xs = options.coarse ? [-1, -0.8, -0.63, -0.46, -0.29, -0.26, -0.12, -0.06, 0, 0.06, 0.12, 0.26, 0.29, 0.46, 0.63, 0.8, 1] : [-1, -0.95, -0.9, -0.85, -0.8, -0.715, -0.63, -0.545, -0.46, -0.375, -0.29, -0.26, -0.205, -0.16, -0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12, 0.16, 0.205, 0.26, 0.29, 0.375, 0.46, 0.545, 0.63, 0.715, 0.8, 0.85, 0.9, 0.95, 1];
  const ys = options.coarse ? [-1.02, -0.98, -0.90, -0.74, -0.66, -0.53, -0.40, -0.30, -0.22, -0.085, 0.05, 0.185, 0.32, 0.50, 0.65, 0.78, 0.92, 1.04, 1.10, 1.16, 1.19] : [-1.02, -0.98, -0.94, -0.90, -0.86, -0.82, -0.78, -0.74, -0.70, -0.66, -0.6275, -0.595, -0.5625, -0.53, -0.4975, -0.465, -0.4325, -0.40, -0.35, -0.30, -0.26, -0.22, -0.1525, -0.085, -0.0175, 0.05, 0.1175, 0.185, 0.2525, 0.32, 0.38, 0.44, 0.50, 0.56, 0.62, 0.68, 0.74, 0.80, 0.86, 0.92, 0.98, 1.04, 1.10, 1.13, 1.16, 1.18, 1.19];
  // mouthWidth past the studio's aperture: the mouth box widens to the first lattice column that clears the smiling line
  const MB = S?.mouthWidth > 1 ? xs.find((x) => x >= 0.175 * S.mouthWidth * 1.12 + 0.04) ?? 0.8 : null;
  const holes = [{ kind: 'eye', side: -1, x0: -0.8, x1: -0.12, y0: -0.22, y1: 0.32 }, { kind: 'eye', side: 1, x0: 0.12, x1: 0.8, y0: -0.22, y1: 0.32 }, { kind: 'mouth', side: 0, x0: MB ? -MB : -0.26, x1: MB ? MB : 0.26, y0: -0.66, y1: -0.40 }];
  for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const u = (xs[i] + xs[i + 1]) / 2, y = (ys[j] + ys[j + 1]) / 2; if (holes.some((q) => u > q.x0 && u < q.x1 && y > q.y0 && y < q.y1)) continue; quad('skin', surface(xs[i], ys[j]), surface(xs[i + 1], ys[j]), surface(xs[i + 1], ys[j + 1]), surface(xs[i], ys[j + 1]), true); }
  // Rear shares the face's side seam. Caps close the top and bottom loops.
  for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) quad('skin', surface(xs[i], ys[j], true), surface(xs[i], ys[j + 1], true), surface(xs[i + 1], ys[j + 1], true), surface(xs[i + 1], ys[j], true), j % 3 === 0 && i % 2 === 0);
  for (const y of [ys[0], ys.at(-1)]) for (let i = 0; i < xs.length - 1; i++) quad('skin', surface(xs[i], y), surface(xs[i], y, true), surface(xs[i + 1], y, true), surface(xs[i + 1], y));
  function eyeUV(side, t, scale = 1) {
    // fissureShape: the outline as the upper / lower lid curves (eyeShapeOf), one outline for the aperture, the dish,
    // the iris clip and the lid band
    if (S?.fissure) { const center = side * 0.455 * f.spacing, co = dmath.cos(t), si = dmath.sin(t), lat = co * side, u = center + EYE.a * co * scale, blink = Math.max(0.015, 1 - e.blink), yy = EYE_Y + (si >= 0 ? EYE.bUp * EYE.Yup(lat) : -EYE.bDn * EYE.Ydn(lat)) * scale * blink + f.tilt * (Math.abs(u) - Math.abs(center)); return [u, yy]; }
    const center = side * 0.455 * f.spacing, co = dmath.cos(t), si = dmath.sin(t), u = center + 0.285 * f.eyeWidth * co * scale, blink = Math.max(0.015, 1 - e.blink), yy = EYE_Y + (si >= 0 ? 0.155 : 0.108) * f.eyeHeight * si * scale * blink + f.tilt * (Math.abs(u) - Math.abs(center)); return [u, yy];
  }
  function mouthUV(t, scale = 1) {
    // stomion (the lip line) and mouthWidth (a ratio of the studio's)
    if (S?.stomion !== undefined || S?.mouthWidth !== undefined) { const co = dmath.cos(t), si = dmath.sin(t), u = 0.175 * (S.mouthWidth ?? 1) * (1 + 0.12 * e.smile) * co * scale, y = (S.stomion ?? -0.535) + 0.035 * e.smile * co * co * scale + (si > 0 ? 0.055 : 0.11) * e.open * si * scale + 0.007 * si * scale; return [u, y]; }
    const co = dmath.cos(t), si = dmath.sin(t), u = 0.175 * (1 + 0.12 * e.smile) * co * scale, y = -0.535 + 0.035 * e.smile * co * co * scale + (si > 0 ? 0.055 : 0.11) * e.open * si * scale + 0.007 * si * scale; return [u, y];
  }
  for (const hole of holes) {
    const { x0, x1, y0, y1, side } = hole;
    const outer = [...xs.filter((x) => x >= x0 && x < x1).map((x) => [x, y0]), ...ys.filter((y) => y >= y0 && y < y1).map((y) => [x1, y]), ...xs.filter((x) => x > x0 && x <= x1).reverse().map((x) => [x, y1]), ...ys.filter((y) => y > y0 && y <= y1).reverse().map((y) => [x0, y])];
    const ts = outer.map(([u, y]) => dmath.atan2((y - (y0 + y1) / 2) / ((y1 - y0) / 2), (u - (x0 + x1) / 2) / ((x1 - x0) / 2))), uv = (t) => (hole.kind === 'eye' ? eyeUV(side, t) : mouthUV(t)), inner = ts.map(uv), rings = [];
    for (let k = 0; k <= 3; k++) { const t = k / 3; rings.push(outer.map((p, i) => { const u = mix(inner[i][0], p[0], t), y = mix(inner[i][1], p[1], t), v = surface(u, y); v[2] -= 0.009 * dmath.sin(Math.PI * t); return v; })); }
    for (let k = 0; k < 3; k++) for (let i = 0; i < outer.length; i++) quad('skin', rings[k][i], rings[k + 1][i], rings[k + 1][(i + 1) % outer.length], rings[k][(i + 1) % outer.length], true);
    const centerUV = hole.kind === 'eye' ? eyeUV(side, 0, 0) : mouthUV(0, 0), center = surface(...centerUV); center[2] += hole.kind === 'eye' ? -0.025 : 0.035;
    for (let i = 0; i < outer.length; i++) {
      const n = (i + 1) % outer.length;
      if (hole.kind === 'mouth') { tri('mouth', rings[0][i], rings[0][n], center); continue; }
      const steps = 4;
      for (let j = 0; j < steps; j++) {
        // weld (additive): the rim's 0.001 lift fades to zero so the sclera's rim is its aperture ring
        // scleraShut: shutting (the blink past 0.7, full at 1, as the lid band's lidShut) the sclera's dish flattens to that
        // share of its depth, so a shut lid holds no white trough (the lenses already drop behind the lid)
        const point = (idx, rad) => { const a = inner[idx], u = mix(centerUV[0], a[0], rad), y = mix(centerUV[1], a[1], rad), p = surface(u, y); if (S?.scleraShut !== undefined) { const q = clamp((e.blink - 0.7) / 0.3), k = q * q * (3 - 2 * q), dish = 1 - (1 - S.scleraShut) * k; p[2] -= options.weld ? 0.024 * (1 - rad * rad) * dish + 0.001 * (1 - rad) : 0.024 * (1 - rad * rad) * dish + 0.001; } else p[2] -= options.weld ? 0.024 * (1 - rad * rad) + 0.001 * (1 - rad) : 0.024 * (1 - rad * rad) + 0.001; return p; };
        quad('sclera', point(i, j / steps), point(i, (j + 1) / steps), point(n, (j + 1) / steps), point(n, j / steps));
      }
    }
    if (hole.kind === 'eye') {
      const centerU = side * 0.455 * f.spacing, cy = EYE_Y, blink = Math.max(0.015, 1 - e.blink);
      function eyePoint(u, y) { const p = surface(u, y), rad = S?.fissure ? EYE.norm(side, u - centerU, y - cy - f.tilt * (Math.abs(u) - Math.abs(centerU)), blink) : Math.sqrt(((u - centerU) / (0.285 * f.eyeWidth)) ** 2 + ((y - cy - f.tilt * (Math.abs(u) - Math.abs(centerU))) / ((y >= cy ? 0.155 : 0.108) * f.eyeHeight * blink)) ** 2); p[2] -= 0.024 * Math.max(0, 1 - rad * rad) + 0.004; return p; }
      function irisPatch(part, size) {
        const rings = [], R = LENS.rings, N = LENS.seg;
        for (let k = 0; k <= R; k++) { const rad = k / R; rings.push(Array.from({ length: N }, (_, i) => { const t = i / N * 2 * Math.PI; let dx = dmath.cos(t) * 0.13 * f.iris * size, dy = dmath.sin(t) * 0.138 * f.iris * size; const lim = Math.sqrt((dx / (0.285 * f.eyeWidth)) ** 2 + (dy / ((dy >= 0 ? 0.155 : 0.108) * f.eyeHeight * blink)) ** 2), fit = Math.min(1, 0.97 / (lim || 1)); dx *= fit * rad; dy *= fit * rad; const p = eyePoint(centerU + dx, cy + dy + f.tilt * (Math.abs(centerU + dx) - Math.abs(centerU))); p[2] -= part === 'pupil' ? 0.002 : 0; return p; })); }
        for (let j = 0; j < R; j++) for (let i = 0; i < N; i++) quad(part, rings[j][i], rings[j + 1][i], rings[j + 1][(i + 1) % N], rings[j][(i + 1) % N]);
      }
      if (S?.lidCover !== undefined) graphicLenses(side, centerU, cy, blink, eyePoint);
      else if (e.blink < 0.985) { irisPatch('iris', 1); irisPatch('pupil', S?.pupil !== undefined ? S.pupil : 0.31); }
      // Upper lash is modeled thickness; lower rim stays lighter and narrower. (lidWeight: the lid band replaces the lash)
      for (const upper of S?.lidWeight !== undefined ? [false] : [true, false]) { const N = 32; for (let i = 0; i < N; i++) { const t0 = (upper ? 0 : Math.PI) + i * Math.PI / N, t1 = (upper ? 0 : Math.PI) + (i + 1) * Math.PI / N; const rim = (t) => { const [u, y] = eyeUV(side, t), p = surface(u, y); p[2] -= 0.01; const thick = (upper ? 0.020 : S?.lowerRim !== undefined ? 0.006 * S.lowerRim : 0.006) * dmath.pow(Math.max(0.05, dmath.sin(t) * (upper ? 1 : -1)), 0.4); return [p, add(p, [0, thick * (upper ? 1 : -1), -0.002])]; }; quad('ink', ...rim(t0), ...rim(t1).reverse()); } }
      if (S?.lidWeight !== undefined) lidBand(side, centerU, cy, blink);
      // Brow ribbon follows the face and can tilt independently from eyelids. (brow: the brow block replaces it)
      if (S?.brow) browBlock(side, centerU, cy);
      else for (let i = 0; i < 16; i++) { const point = (t, top) => { const u = centerU + (t - 0.5) * 0.46 * f.eyeWidth, y = 0.37 + 0.035 * dmath.sin(t * Math.PI) + e.brow * side * (t - 0.5) * 0.12; const p = surface(u, y + (top ? 0.018 : 0)); p[2] -= 0.014; return p; }; quad('ink', point(i / 16, 0), point((i + 1) / 16, 0), point((i + 1) / 16, 1), point(i / 16, 1)); }
    }
  }
  // noseLine: a short inner line down the nose's shade side (the side away from the character key), so the nose reads at
  // three-quarter and front at a small projection; sampled on surface(), a thin tapered ribbon
  if (S?.noseLine) {
    const L = S.noseLine, n = 12, tip = S.nose ? S.nose.pronasale : -0.18, pts = [];
    for (let i = 0; i <= n; i++) { const s = i / n, y = tip + L.top + (L.bottom - L.top) * s, u = L.side * (L.inner + (L.outer - L.inner) * dmath.pow(s, L.curve ?? 1.6)); pts.push([u, y]); }
    const X = pts.map(([u, y]) => [u * 0.78, y]);
    for (let i = 0; i < n; i++) {
      const w = (k) => L.width * dmath.pow(dmath.sin(Math.PI * (0.08 + 0.84 * k / n)), 0.6);
      const nrm = (k) => { const A = X[Math.max(0, k - 1)], B = X[Math.min(n, k + 1)], tx = B[0] - A[0], ty = B[1] - A[1], l = dmath.hypot(tx, ty) || 1; return [-ty / l, tx / l]; };
      const edge = (k, sgn) => { const [u, y] = pts[k], d = nrm(k), p = surface(u + sgn * d[0] * w(k) / 0.78 / 2, y + sgn * d[1] * w(k) / 2); p[2] -= L.push ?? 0.006; return p; };
      quad('nose', edge(i, -1), edge(i + 1, -1), edge(i + 1, 1), edge(i, 1));
    }
  }
  // the graphic lenses (lidCover): the iris sized so the upper lid covers `lidCover` of it, clipped not squashed: its
  // boundary is clamped onto the lid outline (radially about the eye centre) and its rings run from the iris centre to
  // that boundary, so the lid cut is exact at any ring count and the grid is the same at every expression (a point
  // outside the opening, and every point once the lids shut, is set back behind the lid: constant topology)
  function graphicLenses(side, centerU, cy, blink, eyePoint) {
    const up = EYE.bUp * EYE.Yup(0), dn = EYE.bDn * EYE.Ydn(0), shut = e.blink >= 0.985;
    const Ry = (S.irisSpan ?? 1) * (up + dn) / (2 * (1 - S.lidCover)), Rx = Ry * (0.13 / 0.138) * (S.irisOval ?? 1), cI = up - Ry * (1 - 2 * S.lidCover);
    const at = (dx, dy) => eyePoint(centerU + dx, cy + dy + f.tilt * (Math.abs(centerU + dx) - Math.abs(centerU)));
    function disc(part, rx, ry, ox, oy, fwd, seg, rings) {
      const G = [];
      for (let k = 0; k <= rings; k++) G.push(Array.from({ length: seg }, (_, i) => {
        const t = i / seg * 2 * Math.PI; let bx = ox + dmath.cos(t) * rx, by = oy + dmath.sin(t) * ry;
        const nb = EYE.norm(side, bx, by, shut ? 1 : blink); if (nb > 0.97) { bx *= 0.97 / nb; by *= 0.97 / nb; }   // shut: the open shape, all of it behind the lid
        const s = k / rings, dx = ox + (bx - ox) * s, dy = oy + (by - oy) * s, p = at(dx, dy); p[2] -= fwd;
        if (shut || EYE.norm(side, dx, dy, blink) > 0.975) p[2] += 0.05;   // behind the lid (+z is back in the studio frame)
        return p;
      }));
      for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) quad(part, G[j][i], G[j + 1][i], G[j + 1][(i + 1) % seg], G[j][(i + 1) % seg]);
    }
    disc('iris', Rx, Ry, 0, cI, 0, LENS.seg, LENS.rings);
    disc('pupil', Rx * (S.pupil ?? 0.31), Ry * (S.pupil ?? 0.31), 0, cI, 0.002, LENS.seg, LENS.rings);
    if (S.catchlight) { const C = S.catchlight; disc('catch', C.r * Rx, C.r * Rx * 1.1, C.at[0] * Rx, cI + C.at[1] * Ry, 0.0035, 16, 1); }   // the same offset in both eyes (not mirrored)
  }
  // lidWeight: the upper-lid band, `lidWeight` of the opening thick, thin at the medial canthus (lidRamp), running past
  // the lateral canthus as a tail (lidTail × the eye half-width at lidTailAngle; lidFlick bends it up)
  function lidBand(side, centerU, cy, blink) {
    const a = EYE.a, WK = 0.76, openP = EYE.bUp + EYE.bDn;
    const outline = (lat) => { const u = centerU + a * lat * side; return [u, cy + EYE.bUp * EYE.Yup(lat) * blink + f.tilt * (Math.abs(u) - Math.abs(centerU))]; };
    const Lp = [], Tk = [], NB = 40, NT = 12, [r0, rSpan] = S.lidRamp ?? [0.3, 0.45];
    // lidShut { weight, sag }: shutting (the blink past 0.7, full at 1) the closed band thins to `weight` of the open one and
    // its line sags `sag` of the eye's width at the middle, so a shut eye reads as one lash line, not a squint
    const SH = S.lidShut ? (() => { const q = clamp((e.blink - 0.7) / 0.3), k = q * q * (3 - 2 * q); return { weight: 1 - (1 - (S.lidShut.weight ?? 1)) * k, sag: (S.lidShut.sag ?? 0) * 2 * a * WK * k }; })() : null;
    for (let i = 0; i <= NB; i++) { const lat = -1 + 2 * i / NB, m = Math.min(1, (lat + 1) / rSpan), L = outline(lat); if (SH) L[1] -= SH.sag * (1 - lat * lat); Lp.push(L); Tk.push(SH ? S.lidWeight * openP * (r0 + (1 - r0) * m * m * (3 - 2 * m)) * SH.weight : S.lidWeight * openP * (r0 + (1 - r0) * m * m * (3 - 2 * m))); }
    { const Tc = Tk.at(-1), step = (S.lidTail ?? 0) * a * WK / NT; let P = Lp.at(-1);
      if (step > 0) for (let i = 1; i <= NT; i++) { const s = i / NT, ang = ((S.lidTailAngle ?? 0) + (S.lidFlick ?? 0) * s * s) * Math.PI / 180; P = [P[0] + side * step * dmath.cos(ang) / WK, P[1] + step * dmath.sin(ang)]; Lp.push(P); Tk.push(Tc * dmath.pow(1 - s, S.lidTailTaper ?? 0.8)); } }
    // the thickness is ONE direction for the whole band (a fixed nib: up, leaning `lidLean` toward the lateral canthus),
    // not the line's normal: where the lid line turns steep at the lateral canthus the band thins by itself and the tail
    // takes it up again, with no rotating offset to fold the corner. The lower edge tucks 8 % under the opening's edge.
    // scleraShut (the sclera's own word, see the dish): shutting, the lower edge tucks (8 + 17 × the shut) % under it, so
    // the slit left between the lids is covered by the band, not shown as a white line (a band that sags below the slit,
    // lidShut.sag, can still leave a thin one above it)
    const lean = S.lidLean ?? 0.15, dl = dmath.hypot(lean, 1), D = [side * lean / dl, 1 / dl];
    const TUCK = S.scleraShut !== undefined ? (() => { const q = clamp((e.blink - 0.7) / 0.3); return 0.08 + 0.17 * q * q * (3 - 2 * q); })() : null;
    const rows = 1, G = Lp.map((L, i) => Array.from({ length: rows + 1 }, (_, r) => { const k = TUCK !== null ? (r / rows * (1 + TUCK) - TUCK) * Tk[i] : (r / rows * 1.08 - 0.08) * Tk[i], p = surface(L[0] + D[0] * k / WK, L[1] + D[1] * k); p[2] -= S.lidPush ?? 0.014; return p; }));
    for (let i = 0; i < Lp.length - 1; i++) for (let r = 0; r < rows; r++) quad('lid', G[i][r], G[i + 1][r], G[i + 1][r + 1], G[i][r + 1]);
  }
  // the brow as a block: its bottom `gap` of the opening above the lid's top, the inner end down `angle`°, `thick` of the
  // opening at its widest; 'block' blunt at the inner end and thinning outward, 'taper' pointed at both ends; an arch.
  // The thickness is vertical (a band normal would lean it on the angle)
  function browBlock(side, centerU, cy) {
    // shutLift: shutting (as the lid band's lidShut) the brow relaxes up by `shutLift` of the opening
    const B = S.brow, shutQ = B.shutLift ? clamp((e.blink - 0.7) / 0.3) : 0, shutK = shutQ * shutQ * (3 - 2 * shutQ), a = EYE.a, WK = 0.76, openP = EYE.bUp + EYE.bDn, NW = 24, bot = [], bt = [], yb = B.shutLift ? cy + EYE.bUp + (B.gap + B.shutLift * shutK) * openP : cy + EYE.bUp + B.gap * openP, tan = dmath.tan(B.angle * Math.PI / 180);
    const prof = (s) => (B.shape === 'block' ? (s < 0.2 ? 0.75 + 1.25 * s : 1 - (1 - (B.tip ?? 0.35)) * dmath.pow((s - 0.2) / 0.8, 1.4)) : dmath.pow(dmath.sin(Math.PI * (0.06 + 0.88 * s)), 0.7) * (1 - 0.35 * s));
    for (let i = 0; i <= NW; i++) { const s = i / NW, lu = -B.inner + s * (B.inner + B.outer), u = centerU + side * lu * a; bot.push([u, yb + lu * a * WK * tan + (B.arch ?? 0) * dmath.sin(Math.PI * s) + e.brow * (s - 0.5) * 0.12]); bt.push(B.thick * openP * prof(s)); }
    const G = bot.map(([u, y], i) => [0, 1].map((r) => { const p = surface(u, y + r * bt[i]); p[2] -= B.push ?? 0.016; return p; }));
    for (let i = 0; i < NW; i++) quad('brow', G[i][0], G[i + 1][0], G[i + 1][1], G[i][1]);
  }
  capture = false;
  // Small ear volumes and an unrigged neck/shoulder context.
  function ellipsoid(part, c, rad) { const N = 24, M = 16, pt = (i, j) => { const t = 2 * Math.PI * i / N, a = Math.PI * j / M; return [c[0] + rad[0] * dmath.sin(a) * dmath.cos(t), c[1] + rad[1] * dmath.cos(a), c[2] + rad[2] * dmath.sin(a) * dmath.sin(t)]; }; for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) quad(part, pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)); }
  const earsStart = parts.skin.length;
  // ear { lift }: the ear raised `lift` (construction units), so it spans the eye level to the nose tip
  for (const side of [-1, 1]) { ellipsoid('skin', [side * 0.77 * f.width, S?.ear ? fy(-0.24) + S.ear.lift : fy(-0.24), 0.045], [0.10, 0.205, 0.14]); }
  // Upper neck overlaps inside the jaw/skull instead of ending below the head.
  // Separate front/back extent gives the throat and nape a continuous supporting volume.
  const neckStart = parts.skin.length;
  const neckSections = [[-1.67, 1.05, -0.30, 0.46], [-1.49, 0.69, -0.22, 0.38], [-1.36, 0.30, -0.18, 0.32], [-1.15, 0.25, -0.20, 0.32], [-0.94, 0.26, -0.25, 0.34], [-0.76, 0.30, -0.31, 0.36], [-0.57, 0.34, -0.32, 0.37], [-0.38, 0.35, -0.27, 0.40], [-0.18, 0.34, -0.22, 0.43]];
  const neckRings = neckSections.map(([y, rx, front, rear]) => Array.from({ length: 40 }, (_, i) => { const a = i / 40 * 2 * Math.PI, t = dmath.cos(a), center = (front + rear) / 2, radius = (rear - front) / 2; return [dmath.sin(a) * rx * f.width, fy(y), center + t * radius]; }));
  for (let j = 0; j < neckRings.length - 1; j++) for (let i = 0; i < 40; i++) quad('skin', neckRings[j][i], neckRings[j][(i + 1) % 40], neckRings[j + 1][(i + 1) % 40], neckRings[j + 1][i]);

  const neckEnd = parts.skin.length;
  // mojulo: the SIDEBURN PATCH (`options.sideburnPatch`, every anime head wears it; the studio has none): a thin closed
  // sheet lying on the skin in FRONT of each ear, from under the hair's edge at the temple down to the ear's lower third,
  // its front edge drawing back as it falls (a sideburn's taper), its back edge at the ear's front, so no bare gap shows
  // between the hair and the ear.
  // Its own part (`burn`, one run per side); the head wears it in the hair's colour, and a bald head not at all (its
  // own skin is the face's colour, with no edge for the ink to outline)
  const burns = [];
  if (options.sideburnPatch) {
    parts.burn = [];
    const earY = S?.ear ? fy(-0.24) + S.ear.lift : fy(-0.24), yTop = 0.22, yBot = earY - 0.06, I = 6, J = 10;
    for (const side of [-1, 1]) {
      const start = parts.burn.length, at = (i, j, off) => { const y = yTop + (yBot - yTop) * j / J, u0 = 0.84 + 0.1 * (j / J) ** 2, u = side * (u0 + (0.955 - u0) * i / I), p = surface(u, y);
        const n = unit([p[0], 0, p[2] - 0.07]); return add(p, mul(n, off)); };
      const lo = 0.004, hi = 0.018, Q = (a, b, c, d) => (side > 0 ? quad('burn', a, b, c, d) : quad('burn', d, c, b, a));
      for (let j = 0; j < J; j++) for (let i = 0; i < I; i++) { Q(at(i, j, hi), at(i, j + 1, hi), at(i + 1, j + 1, hi), at(i + 1, j, hi)); Q(at(i + 1, j, lo), at(i + 1, j + 1, lo), at(i, j + 1, lo), at(i, j, lo)); }
      for (let j = 0; j < J; j++) { Q(at(0, j, lo), at(0, j + 1, lo), at(0, j + 1, hi), at(0, j, hi)); Q(at(I, j, hi), at(I, j + 1, hi), at(I, j + 1, lo), at(I, j, lo)); }
      for (let i = 0; i < I; i++) { Q(at(i, 0, lo), at(i, 0, hi), at(i + 1, 0, hi), at(i + 1, 0, lo)); Q(at(i + 1, J, lo), at(i + 1, J, hi), at(i, J, hi), at(i, J, lo)); }
      burns.push({ side, start, count: parts.burn.length - start });
    }
  }
  // Hair cap + individually directed swept solid clumps.
  const vx = h.volume * f.width, vy = h.volume, depth = h.volume, short = h.style === 'short', hime = h.style === 'hime';
  // the HAIR FORM (see the header): a neutral word dropped first, so an absent, empty or all-neutral form runs the studio's
  const HF = hairFormOf(options.hairForm);
  const FIT = options.fitHair ? hairFit(surface, f, h, HF) : null;
  // lift on: a clump's root sinks into the lifted cap (its centre at ROOT_SINK of its seat, rising to the full seat by t
  // 0.35) and its thickness is pinched to ROOT_PINCH there (full by t 0.25), so the division lines emerge from the mass
  const SINK = HF?.lift ? (t) => { const q = clamp(t / 0.35); return ROOT_SINK + (1 - ROOT_SINK) * q * q * (3 - 2 * q); } : null;
  const PINCH = HF?.lift ? (t) => { const q = clamp(t / 0.25); return ROOT_PINCH + (1 - ROOT_PINCH) * q * q * (3 - 2 * q); } : null;
  // section 'ridge': a roof with a spine on its outer side over a flatter underside (the two roof planes meet past the
  // shading crease), not the 8-gon ellipse
  const SEC = HF?.section === 'ridge' ? RIDGE_SECTION : null;
  const FORMS = options.forms && ['bob', 'long', 'hime'].includes(h.style) ? (HF ? formGroupsOf(h.style, h, HF) : formGroupsOf(h.style, h)) : null;
  function capPoint(a, t) {
    if (FIT) return FIT.cap(a, t); const bottom = 0.10 + 0.43 * Math.max(0, dmath.cos(a)) - 0.48 * Math.max(0, -dmath.cos(a)), end = dmath.acos(clamp((bottom - 0.2) / 0.99, -1, 1)), q = 0.015 + (end - 0.015) * t; return [dmath.sin(q) * dmath.sin(a) * 0.87 * vx, 0.2 + dmath.cos(q) * 1.01 * vy, 0.07 - dmath.sin(q) * dmath.cos(a) * 0.83 * depth]; }
  // the SHAPES (see shapePieces below): which studio clump groups a recipe takes over
  const SH = HF?.shapes ?? null, SH_GROUPS = { fringe: /^fringe-/, temple: /-temple-/, back: /^back-/, crown: /^crown-/ };
  const SH_REPLACED = (name) => !!SH?.replace && SH.replace.some((g) => SH_GROUPS[g]?.test(name));
  const capStart = parts.hair.length;
  for (let j = 0; j < 14; j++) for (let i = 0; i < 48; i++) quad('hair', capPoint(i / 48 * 2 * Math.PI, j / 14), capPoint((i + 1) / 48 * 2 * Math.PI, j / 14), capPoint((i + 1) / 48 * 2 * Math.PI, (j + 1) / 14), capPoint(i / 48 * 2 * Math.PI, (j + 1) / 14));
  if (FIT) for (let i = 0; i < 48; i++) tri('hair', FIT.crown, capPoint((i + 1) / 48 * 2 * Math.PI, 0), capPoint(i / 48 * 2 * Math.PI, 0));   // the fitted cap closes at the crown
  const capEnd = parts.hair.length;
  function lock(name, root, control, tip, width, normal, taperK = h.taper, thick = 1, cut = false) {
    if (SH_REPLACED(name)) return;   // the shapes took this clump group over
    const edit = r.locks?.[name]; if (edit) { control = add(control, [edit.cx, edit.cy, edit.cz]); tip = add(tip, [edit.tx, edit.ty, edit.tz]); }
    if (FIT && !cut) tip = FIT.drape(tip, 0.006);
    if (FORMS?.members.has(name)) { FORMS.curves[name] = { root, control, tip, width, normal, taperK }; return; }   // (a member is never a thick clump)   // a section's member: skinned below
    const start = parts.hair.length; const rings = [], N = 14, S = 8;
    for (let j = 0; j < N; j++) { const t = j / N; let center = add(add(mul(root, (1 - t) ** 2), mul(control, 2 * (1 - t) * t)), mul(tip, t * t)); const tangent = unit(add(mul(sub(control, root), 1 - t), mul(sub(tip, control), t))), across = unit(cross(tangent, normal)), thickDir = unit(cross(across, tangent)), taper = dmath.pow(Math.max(0.001, 1 - t), 0.60 * taperK) * (1 + 0.25 * dmath.sin(t * Math.PI)), w = width * h.clump * taper, th = (PINCH && !cut ? 0.040 * h.thickness * taper * PINCH(t) : 0.040 * h.thickness * taper) * thick; if (FIT && !cut) center = FIT.drape(center, SINK ? (th + 0.012 + w * w / 1.6) * SINK(t) : th + 0.012 + w * w / 1.6); rings.push(Array.from({ length: S }, (_, i) => { const a = i / S * 2 * Math.PI, q = SEC && !cut ? add(center, add(mul(across, SEC[i][0] * w), mul(thickDir, SEC[i][1] * th))) : add(center, add(mul(across, dmath.cos(a) * w), mul(thickDir, dmath.sin(a) * th))); return FIT && j > 0 && !cut ? FIT.drape(q, 0.004) : q; })); }
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < S; i++) quad('hair', rings[j][i], rings[j + 1][i], rings[j + 1][(i + 1) % S], rings[j][(i + 1) % S]);
    for (let i = 0; i < S; i++) { tri('hair', root, rings[0][(i + 1) % S], rings[0][i]); tri('hair', rings.at(-1)[i], tip, rings.at(-1)[(i + 1) % S]); }
    guides.push(...root, ...control, ...control, ...tip); locks.push({ name, root, control, tip, width, start, count: parts.hair.length - start });
  }
  // Unequal tip heights and part-directed curves are authored, not random noise.
  const fringe = [[-0.64, 0.25, 0.17], [-0.44, 0.30, 0.19], [-0.24, 0.12, 0.19], [-0.04, 0.28, 0.16], [0.18, 0.17, 0.20], [0.39, 0.32, 0.19], [0.62, 0.23, 0.17]];
  // sweepBack { amount, keep, rise, riseFall, controlX, controlZ, spread, tipY, tipZ, stagger, rootY, rootZ }: the fringe
  // re-aimed from falling over the brow to rising off the hairline, arching over the crown and pointing back past it (the
  // swept-back cut's word); `keep` names clumps that still fall; past half the sweep a clump's outward normal turns up
  // so its section never flips over the arc
  const SB = HF?.sweepBack ?? null, SS = HF?.sweepSides ?? null;
  const mix3 = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  // spikes { amount, reach, width, up } (the short family): the crown accents, the temple and the back clumps re-aimed as
  // SPIKES radiating from the head's centre — each tip pushed out along its own direction from the centre (tilted `up`) by
  // `reach`, the clump `width` times wider at its root and thicker, so the spikes read as broad wedges, not needles. Only
  // the six crown accents become spikes (so the silhouette is a few big spikes, not a fringe of points; SPIKE_FAN); the
  // temple clumps close a rounded, blunt mass over the ears and the back falls in one convex curve to a single point at
  // the nape; the fringe becomes heavy bangs (BANGS: a long one hanging over the centre, shorter ones beside it angled
  // out), authored, never dice
  const SP = short ? HF?.spikes ?? null : null, SPO = [0, 0.2, 0.07];
  const spiked = (root, control, tip, width, reach = 1, dir = null, up = SP?.up ?? 0.35) => { if (!SP) return [control, tip, width]; const A = SP.amount, d = dir ? unit(dir) : unit(add(unit(sub(tip, SPO)), [0, up, 0])), t2 = add(tip, mul(d, (SP.reach ?? 0.85) * reach * A)); return [mix3(control, mix3(root, t2, 0.42), 0.6 * A), t2, width * (1 + ((SP.width ?? 2.2) - 1) * A)]; };
  // the six crown spikes as the operator's sketch draws them (front: a tall one just off the centre, one long one level
  // out to the left, smaller ones between and below; side: one leaning back, one sweeping forward over the face):
  // [degrees off the vertical, reach, width, lean, base, sink] per side (the hero's left, then right), from the top down.
  // CUT CONICAL CARROTS (the operator's word for this style): every spike is a cone cut square at its base and sunk into
  // the mass, round in section (as thick as it is wide), tapering to its point. `base` widens the cut base (across and
  // in depth) while the taper quickens by as much, so the spike's angle, lean and tip — its front and side profile — hold;
  // `sink` lowers the whole carrot into the mass. A carrot is never pinched at its root (the lift's pinch is for clumps
  // emerging from the cap), never draped (its base belongs inside the mass) and round in section, seated deep in the mass,
  // so its full base meets the hair and it never floats.
  const SPIKE_FAN = [[[34, 0.8, 1.0, -0.45, 1, 0], [80, 1.55, 1.35, 0.15, 1, 0], [124, 0.6, 0.85, 0.35, 1, 0]], [[8, 1.65, 1.5, 0.38, 1, 0], [60, 1.05, 1.2, -0.3, 1, 0], [110, 0.85, 1.0, 0.25, 1, 0]]];
  const BANGS = [[-0.3, 0.12, 0.02], [-0.24, -0.04, -0.02], [-0.1, -0.18, -0.06], [0.03, -0.3, -0.07], [0.12, -0.14, -0.06], [0.28, 0, -0.02], [0.3, 0.12, 0.02]];
  for (let i = 0; i < fringe.length; i++) { const [x, y0, w] = fringe[i], y = hime ? 0.34 : y0, root = [(x * 0.52 + h.part) * vx, 0.94 * vy, -0.40 * depth], control = [(x * 0.94 + h.part * 0.5) * vx, 0.62 * vy, -0.86 * depth], tip = [(x + h.sweep * 0.22 + (short ? Math.sign(x) * 0.045 : 0)) * vx, 0.62 - (0.62 - y) * h.fringe + (short ? 0.08 : 0), -0.71 * depth];
    if (SB && !(SB.keep || []).includes('fringe-' + (i + 1))) {
      const A = SB.amount, sp = SB.spread ?? 1.05, dy = (y - 0.25) * (SB.stagger ?? 1.2), nrm = A >= 0.5 ? [0, 1, 0] : [0, 0, -1];
      const sRoot = mix3(root, [(x * 0.60 + h.part) * vx, SB.rootY ?? 0.86, SB.rootZ ?? -0.40], A), sControl = mix3(control, [(x * (SB.controlX ?? 0.80) + h.part * 0.5) * vx, (SB.rise ?? 1.80) - (SB.riseFall ?? 0) * x * x, SB.controlZ ?? 0.02], A), sTip = mix3(tip, [(x * sp + h.sweep * 0.22) * vx, (SB.tipY ?? 1.02) - dy * 0.5, (SB.tipZ ?? 0.88) + dy], A);
      if (hime) lock('fringe-' + (i + 1), sRoot, sControl, sTip, w, nrm, 0.15); else lock('fringe-' + (i + 1), sRoot, sControl, sTip, w, nrm);
    } else if (SP) { const A = SP.amount, b = BANGS[i], up = b[1] > 0.5, t2 = add(tip, mul(b, A)); lock('fringe-' + (i + 1), root, up ? mix3(control, [t2[0] * 0.7, 0.95, -0.7 * depth], A) : control, t2, w * (1 + (up ? 0.6 : 0.35) * A), [0, 0, -1], h.taper, 1 + 0.7 * A); }
    else if (hime) lock('fringe-' + (i + 1), root, control, tip, w, [0, 0, -1], 0.15); else lock('fringe-' + (i + 1), root, control, tip, w, [0, 0, -1]); }
  // flip { amount, out, rise, hold }: the side and back clumps hang straight longer (the control drawn `hold` of the way
  // down to the tip's height) and their tips kick OUT from the head's axis by `out` and up by `rise` (the flipped-out ends)
  const FP = HF?.flip ?? null;
  const flipped = (control, tip) => { if (!FP) return [control, tip]; const A = FP.amount, d = unit([tip[0], 0, tip[2] - 0.07]); return [[control[0], mix(control[1], tip[1], (FP.hold ?? 0.7) * A), control[2]], add(tip, add(mul(d, (FP.out ?? 0.34) * A), [0, (FP.rise ?? 0.2) * A, 0]))]; };
  // sideTail { amount, side, length, width, height }: the back clumps and the tail side's two rear temple clumps GATHERED to
  // a tie low behind one ear (`side` the hero's left or right, `height` its rise), and one round TAIL hanging from the tie
  // forward over the shoulder; the far side's temple clumps still frame the face
  const ST = HF?.sideTail ?? null, tailS = ST ? (ST.side === 'right' ? 1 : -1) : 0;
  const tie = ST ? [tailS * 0.66 * vx, -0.42 + (ST.height ?? 0), 0.42 * depth] : null;
  const gathered = (control, tip, k) => { if (!ST) return [control, tip]; const A = ST.amount, at = add(tie, [0, 0.05 * Math.sin(k * 1.7), -0.05 * Math.cos(k * 1.3)]); return [mix3(control, mul(add(control, at), 0.5), 0.55 * A), mix3(tip, at, A)]; };
  // sweepSides { amount, from, controlY, tipX, tipY, tipZ }: the temple clumps from index `from` swept back over the ear
  // (the swept-back cut's sides); the ones before it still fall as temple locks
  for (const side of [-1, 1]) for (let j = 0; j < 3; j++) { const z = -0.34 + j * 0.22, x = (0.80 + j * 0.025) * vx, baseY = short ? -0.25 - j * 0.07 : h.style === 'long' ? -1.30 - j * 0.09 : hime ? (j === 0 ? -0.66 : -1.30 - j * 0.09) : -0.80 - j * 0.08; const args = [(side < 0 ? 'left' : 'right') + '-temple-' + j, [side * 0.66 * vx, 0.76 * vy, z], [side * 0.94 * vx, 0.10, z - 0.07], [side * (x + 0.04 * j + h.sweep * 0.15), 0.3 + (baseY - 0.3) * h.length, z + 0.08], 0.14, [side, 0, 0]];
    if (SS && j >= (SS.from ?? 1)) { const A = SS.amount; args[2] = mix3(args[2], [side * 0.98 * vx, SS.controlY ?? 0.62, z + 0.25], A); args[3] = mix3(args[3], [side * (SS.tipX ?? 0.80) * vx, (SS.tipY ?? 0.45) - 0.06 * j, (SS.tipZ ?? 0.80) + 0.08 * j], A); }
    if (ST && side === tailS && j >= 1) [args[2], args[3]] = gathered(args[2], args[3], j); else if (FP) [args[2], args[3]] = flipped(args[2], args[3]); else if (SP) { const A = SP.amount; args[3] = mix3(args[3], add(args[3], [side * 0.12, 0.12, 0.04]), A); args[4] *= 1 + 0.6 * A; args.push(0.12, 1 + 0.9 * A); }   // the sides a rounded mass over the ear
    if (hime && j === 0) lock(...args, 0.15); else lock(...args); }
  for (let i = 0; i < 11; i++) { let a = Math.PI * 0.58 + i / 10 * Math.PI * 0.84, root = capPoint(a, 0.30), c = capPoint(a, 0.85), rear = [dmath.sin(a) * 0.86 * vx, 0.12, 0.07 - dmath.cos(a) * 0.81 * depth], len = short ? 0.38 : h.style === 'long' || hime ? 1.55 : 1.03, tip = [rear[0] * (short ? 1.12 : 0.93) + h.sweep * 0.18 * dmath.sin(a), rear[1] - len * h.length + (i % 3) * 0.055, rear[2] + (short ? 0.07 : 0.025)]; let control = [c[0] * 1.08, 0.35, c[2] * 1.1]; let width = 0.18; if (ST) [control, tip] = gathered(control, tip, i + 3); else if (FP) [control, tip] = flipped(control, tip); else if (SP) { const A = SP.amount, mid = 1 - Math.abs(i - 5) / 5, out = [dmath.sin(a), 0, -dmath.cos(a)]; tip = mix3(tip, [rear[0] * (0.25 + 0.7 * (1 - mid)), rear[1] - len * h.length - 0.06 - 0.6 * dmath.pow(mid, 1.3), rear[2] - 0.06], A); control = mix3(control, add(add(control, mul(out, 0.3)), [0, -0.3, 0]), A); width *= 1 + 0.7 * A; }   // the back FALLS in one convex curve, its hem drawn to a single point at the nape
    if (SP) lock('back-' + (i + 1), root, control, tip, width, [dmath.sin(a), 0, -dmath.cos(a)], 0.12 + 0.8 * (1 - Math.abs(i - 5) / 5), 1 + 0.9 * SP.amount); else lock('back-' + (i + 1), root, control, tip, width, [dmath.sin(a), 0, -dmath.cos(a)]); }
  // the side tail: one round clump from the tie, forward over the shoulder and down (`length` and `width` ratios)
  if (ST) { const A = ST.amount, L = (ST.length ?? 1) * h.length, W = (ST.width ?? 1) * 0.32;
    lock('tail', add(tie, [-tailS * 0.06, 0.10, -0.04]), add(tie, [tailS * 0.30, -0.55 * L, -0.30 * A]), add(tie, [tailS * 0.16, -1.45 * L, -0.62 * A]), W, [0, 0, -1], h.taper, 5); }
  // crown 'tuck': the short family's six crown accents laid into the flow (the control down, the tip onto the mass);
  // 'none': not grown
  if (short && HF?.crown === 'tuck') for (const side of [-1, 1]) for (let i = 0; i < 3; i++) lock('crown-' + side + '-' + i, [side * 0.13, 0.97, -0.04 + i * 0.13], [side * (0.45 + i * 0.08), 1.27 - 0.17, -0.01 + i * 0.12], [side * (0.74 + i * 0.07) * 0.92, 0.96 + i * 0.07 - 0.1, 0.02 + i * 0.14], 0.12, [0, 1, 0]);
  else if (short && HF?.crown !== 'none') for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const root0 = [side * 0.13, 0.97, -0.04 + i * 0.13], control0 = [side * (0.45 + i * 0.08), 1.27, -0.01 + i * 0.12], tip0 = [side * (0.74 + i * 0.07), 0.96 + i * 0.07, 0.02 + i * 0.14];
    if (!SP) { lock('crown-' + side + '-' + i, root0, control0, tip0, 0.12, [0, 1, 0]); continue; }
    // the spike from the table: its angle off the vertical in the face's plane, its reach, its width, its lean (+ back, − forward)
    const A = SP.amount, [deg, reach, wide, lean, base, sink] = SPIKE_FAN[side > 0 ? 1 : 0][i], fan = deg * Math.PI / 180, d = unit([side * dmath.sin(fan), dmath.cos(fan), lean]);
    const root = add(add(SPO, mul(d, 0.56 * vy)), [0, -sink * A, 0]), tip = mix3(tip0, add(root, mul(d, 0.25 + (SP.reach ?? 0.85) * reach * A)), A), control = mix3(control0, add(mix3(root, tip, 0.45), [0, 0.1, 0]), A);
    const B = 1 + (base - 1) * A, W = 0.12 * (1 + ((SP.width ?? 2.2) * wide - 1) * A) * B; lock('crown-' + side + '-' + i, root, control, tip, W, [0, 0, -1], h.taper * (1 + 1.4 * (B - 1)), mix(1, W * h.clump / (0.040 * h.thickness), A), true);   // round: as deep as it is wide
  }
  // mojulo: an ahoge — one upright curl at the crown, rising forward and curling back (an amount; the studio has none)
  if (h.ahoge > 0) { const A = h.ahoge; lock('ahoge', [0.02, 1.15, -0.10], [0.03, 1.15 + 0.55 * A, -0.36 - 0.1 * A], [0.07, 1.15 + 0.30 * A, 0.04], 0.075, [1, 0, 0]); }
  // mojulo: the SHAPES — a hairstyle composed from ONE family of primitives (a design picks its family), each piece placed
  // on the cap by `at: [azimuth°, elevation°]` (azimuth 0 the front, 90 the hero's right, 180 the back; elevation 0 the
  // hairline, 90 the crown) and aimed by `dir` (construction units: x the hero's right, y up, z back). Every piece is ONE
  // closed tube along a C-curve (`bend`, never an S) with its family's width profile:
  //   CARROT  a CUT CONICAL CARROT: round, its square-cut base sunk into the mass, never pinched or draped; `curve` draws
  //           its sides in (0 a cone, toward 1 a thorn). Short and wide it is mass; long it is a spike.
  //   BANANA  a flat crescent widest a third of the way out, laid along the mass (`flat` its depth to width).
  //   PEPPER  a CHILI: thin and long, a small shoulder at the stem, a slender taper to its point; one is a strand group,
  //           the weight comes from how many are layered and how thin and long they are.
  // `layers` lays rows of one family over an azimuth and elevation range (deterministic length variation, never dice);
  // `scale` grows the whole style against the head; `sideburns` (a hair word of its own, any style) are two pieces in the
  // style's family (a banana on a studio style).
  const BURNS = HF?.sideburns ?? null;
  if (SH || BURNS) {
    const C = [0, 0.25, 0.07], S = 12, N = 16, G = SH?.scale ?? 1;
    const anchorOf = (at) => capPoint(at[0] * Math.PI / 180, clamp(1 - at[1] / 90, 0, 1));
    // BODY: hair never cuts through the body. With `options.body` (anime-head: the hero's own neck and torso rings in the
    // head's frame, metres about the atlas before the head's scale, and the pole's registration) a point is carried into
    // that frame the way anime-head registers the head (the pitch, then the registration's scale and offsets) and, inside
    // a ring short of the clearance, pushed straight out across it (a superellipse, as the body's rings are); without it,
    // the studio's own neck sections stand in for the body. `pad` is the piece's half-thickness there
    const headPitch = (6 + 12 * ((f.headPitch ?? 1) - 1)) * Math.PI / 180, nPivot = [0, fy(-0.38), 0.14];
    const turn = (p, a) => { const c = dmath.cos(a), sn = dmath.sin(a), y = p[1] - nPivot[1], z = p[2] - nPivot[2]; return [p[0], nPivot[1] + c * y - sn * z, nPivot[2] + sn * y + c * z]; };
    const neckAt = (y) => { const ys = neckSections.map((q) => fy(q[0])), k = y <= ys[0] ? 0 : y >= ys.at(-1) ? ys.length - 2 : ys.findIndex((v, i) => v <= y && y <= ys[i + 1]), t = clamp((y - ys[k]) / (ys[k + 1] - ys[k] || 1)), a = neckSections[k], b = neckSections[k + 1];
      const rx = mix(a[1], b[1], t) * f.width, front = mix(a[2], b[2], t), rear = mix(a[3], b[3], t), tt = clamp((y - fy(-1.25)) / (fy(-0.38) - fy(-1.25))), lag = headPitch * (1 - tt * tt * (3 - 2 * tt));
      return { rx, rz: (rear - front) / 2, cz: (front + rear) / 2 - lag * (y - nPivot[1]) }; };
    let BODY = (p, pad) => { if (p[1] > fy(-0.30)) return p; const e = neckAt(p[1]), m = 0.03 + pad, u = p[0] / (e.rx + m), v = (p[2] - e.cz) / (e.rz + m), r = dmath.hypot(u, v); if (r >= 1) return p; const k = r < 1e-6 ? [0, 1] : [u / r, v / r]; return [k[0] * (e.rx + m), p[1], e.cz + k[1] * (e.rz + m)]; };
    if (options.body) {
      // the registration anime-head will apply: the pitched face's extent → the pole's height, menton and depth centre
      let yLo = Infinity, yHi = -Infinity, zLo = Infinity, zHi = -Infinity;
      for (let i = 0; i < earsStart; i += 3) { const q = turn(parts.skin.slice(i, i + 3), headPitch); yLo = Math.min(yLo, q[1]); yHi = Math.max(yHi, q[1]); zLo = Math.min(zLo, q[2]); zHi = Math.max(zHi, q[2]); }
      const { registration: RG, rings } = options.body, Sc = RG.height / (yHi - yLo), TZ = RG.menton - Sc * yLo, TY = RG.midY - Sc * (-zLo + -zHi) / 2;
      const toM = (p) => { const q = turn(p, headPitch); return [q[0] * Sc, -q[2] * Sc + TY, q[1] * Sc + TZ]; }, fromM = (m) => turn([m[0] / Sc, (m[2] - TZ) / Sc, -(m[1] - TY) / Sc], -headPitch);
      // each body part a stack of rings bottom → top: { z, cy, rx, ry, e } (its `clear` the clearance, metres), read between
      // its rings at a height
      const ringAt = (stack, z) => { if (z < stack[0].z || z > stack.at(-1).z) return null; const k = Math.max(0, stack.findIndex((q, i) => i < stack.length - 1 && q.z <= z && z <= stack[i + 1].z)), a = stack[k], b = stack[k + 1] ?? a, t = clamp((z - a.z) / (b.z - a.z || 1));
        return { cy: mix(a.cy, b.cy, t), rx: mix(a.rx, b.rx, t), ry: mix(a.ry, b.ry, t), e: mix(a.e ?? 2, b.e ?? 2, t) }; };
      BODY = (p, pad) => { let q = toM(p), moved = false;
        for (const stack of rings) { const m = (stack.clear ?? 0.004) + pad * Sc; const R = ringAt(stack, q[2]); if (!R) continue; const u = q[0] / (R.rx + m), v = (q[1] - R.cy) / (R.ry + m), r = (Math.abs(u) ** R.e + Math.abs(v) ** R.e) ** (1 / R.e);
          if (r >= 1) continue; const k = r < 1e-6 ? [0, -1] : [u / r, v / r]; q = [k[0] * (R.rx + m), R.cy + k[1] * (R.ry + m), q[2]]; moved = true; }
        return moved ? fromM(q) : p; };
    }
    // `path` (a CAP lock: its centre line walked over the dome) replaces the C-curve: resampled evenly along its length,
    // its flat side facing out from the head at each ring
    const piece = (name, root, control, tip, width, depthRatio, normal, profile, path = null, thick = null, cup = 0) => {
      const start = parts.hair.length, rings = [];
      let along = null;
      if (path) { const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + dmath.hypot(...sub(path[i], path[i - 1])));
        along = Array.from({ length: N + 1 }, (_, j) => { const want = cum.at(-1) * j / N; let i = 1; while (i < path.length - 1 && cum[i] < want) i++; const t = clamp((want - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)); return mix3(path[i - 1], path[i], t); });
        root = along[0]; tip = along[N]; control = along[N >> 1]; }
      const normalAt = (c) => (path ? unit(sub(c, C)) : normal);
      // a stable frame along the curve: the across direction from the piece's normal, falling back when the tangent runs
      // along it, and never flipping between rings (a flip twists the tube into a kink)
      let prev = null;
      const frame = (tangent, nrm) => { let across = cross(tangent, nrm); if (dmath.hypot(...across) < 0.25) across = cross(tangent, Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]); across = unit(across); if (prev && dot(across, prev) < 0) across = mul(across, -1); prev = across; return [across, unit(cross(across, tangent))]; };
      const ring = (center, tangent, w, t = 0) => { const nrm = normalAt(center), [across, thickDir] = frame(tangent, nrm), th = w * depthRatio * (thick ? thick(t) : 1), inward = dot(thickDir, nrm) >= 0 ? -1 : 1; return Array.from({ length: S }, (_, i) => { const a = i / S * 2 * Math.PI; return add(center, add(mul(across, dmath.cos(a) * w), mul(thickDir, dmath.sin(a) * th + inward * cup * w * dmath.cos(a) ** 2))); }); };   // `cup`: the edges curled in toward the scalp (a peel), whichever way the frame's thickness runs
      // the curve's centres, each kept OUT of the body (BODY: never through the neck or over into the shoulders), the
      // tangents then read off the kept centres
      // a lock that meets the body DRAPES over it: the push it takes there carries on down the rest of its length (it
      // never springs back inside, which would kink it); the clearance is its THICKNESS (a flat lock lies face-down on
      // the body)
      let drape = [0, 0, 0];
      const centers = Array.from({ length: N + 1 }, (_, j) => { const t = j / N, c = add(along ? along[j] : add(add(mul(root, (1 - t) ** 2), mul(control, 2 * (1 - t) * t)), mul(tip, t * t)), drape); if (!j) return c; const k = BODY(c, width * profile(t) * depthRatio * (thick ? thick(t) : 1)); drape = add(drape, sub(k, c)); return k; });
      tip = centers[N];
      const tangentAt = (j) => { const d = sub(centers[Math.min(N, j + 1)], centers[Math.max(0, j - 1)]); return dmath.hypot(...d) < 1e-9 ? unit(sub(control, root)) : unit(d); };
      rings.push(ring(root, path ? unit(sub(centers[1], root)) : unit(sub(control, root)), width * profile(0), 0));   // the cut base at t 0
      for (let j = 1; j < N; j++) rings.push(ring(centers[j], tangentAt(j), Math.max(0.004, width * profile(j / N)), j / N));
      for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < S; i++) quad('hair', rings[j][i], rings[j + 1][i], rings[j + 1][(i + 1) % S], rings[j][(i + 1) % S]);
      const base = mul(rings[0].reduce((acc, q) => add(acc, q), [0, 0, 0]), 1 / S);
      for (let i = 0; i < S; i++) { tri('hair', base, rings[0][(i + 1) % S], rings[0][i]); tri('hair', rings.at(-1)[i], tip, rings.at(-1)[(i + 1) % S]); }
      guides.push(...root, ...control, ...control, ...tip); locks.push({ name, root, control, tip, width, start, count: parts.hair.length - start });
    };
    // a C-curve: the control off the chord's middle toward `toward`, by `bend` of the length
    const bent = (root, tip, bend, toward) => { const mid = mul(add(root, tip), 0.5), chord = sub(tip, root), L = dmath.hypot(...chord), k = unit(chord), off = sub(toward, mul(k, dot(toward, k))); return add(mid, mul(dmath.hypot(...off) > 1e-9 ? unit(off) : [0, 0, 0], bend * L)); };
    const counts = { carrot: 0, banana: 0, pepper: 0, peel: 0 };
    // SPROUT: a piece leaves its root ALONG the head, flowing away from the whorl, and only then arcs out to its tip — the
    // control drawn toward a point half the length down the surface flow (by `sprout`, 0 … 1), so a lock grows out of the
    // mass like a sprout instead of being pushed straight out of the skull (which reads as a spike through the face)
    const WHORL = anchorOf(SH?.whorl ?? [180, 80]);
    // the whorl's frame, and the cap's [azimuth°, elevation°] address of a direction from the head's centre (the elevation
    // found along the cap by bisection, since the cap is addressed by its own fraction from the crown)
    const Wn = unit(sub(WHORL, C)), Wu = unit(cross(Wn, Math.abs(Wn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), Wv = unit(cross(Wn, Wu));
    const onCap = (d) => { const az = dmath.atan2(d[0], -d[2]) * 180 / Math.PI, up = dmath.atan2(d[1], dmath.hypot(d[0], d[2])); let lo = 0, hi = 90;
      for (let it = 0; it < 24; it++) { const mid = (lo + hi) / 2, q = sub(anchorOf([az, mid]), C); if (dmath.atan2(q[1], dmath.hypot(q[0], q[2])) < up) lo = mid; else hi = mid; } return [az, (lo + hi) / 2]; };
    const flowAt = (P, n) => { let f = sub(P, WHORL); f = sub(f, mul(n, dot(f, n))); return dmath.hypot(...f) < 1e-6 ? [0, 0, -1] : unit(f); };
    const sprouted = (X, anchor, n, L, control) => { const k = X.sprout ?? 0; return k > 0 ? mix3(control, add(add(anchor, mul(flowAt(anchor, n), 0.5 * L)), mul(n, 0.05 * L)), k) : control; };
    // CAP: a lock that treats the dome as a cap — walked from its root ALONG the scalp (flowing from the whorl, gravity
    // bending it down a little more each step), lying at a height over the scalp set by where it grew (a lock from higher
    // up lies OVER the ones below it, a shingle), until it passes the hairline or the head's widest (below it the skull turns
    // in toward the nape, and a lock that kept to it would bunch there); only then it falls free for `length`,
    // bowing out by `bend` and turning its end back in under itself when `bend` passes `lift` (`fringe` its length when it
    // leaves over the face). So `length` is how far the
    // lock falls PAST THE HAIRLINE, and a lock from the crown comes out longer than one from the side by the dome it
    // crosses: the way long hair grows
    // GATHER (`gather: [az°, el°]`, a ponytail's or a twin tail's TIE): the lock walks the scalp TOWARD the tie instead of
    // away from the whorl, lying sleek all the way, and ends there — no free fall (the tail is its own pieces, rooted at
    // the tie); it swells as it arrives, the hair bunched into the tie
    const capPath = (P, flow, el0, L, Ly, vary = 1) => {
      const step = 0.03, g = 0.06 * (Ly.droop ?? 0.6), off = (0.008 + 0.018 * el0 / 90) * G, path = [], GP = Ly.gather ? anchorOf(Ly.gather) : null;
      let p = P, d = flow, last = P, ln = unit(sub(P, C));
      if (GP) { for (let it = 0; it < 240; it++) { const [az, el] = onCap(unit(sub(p, C))), sp = anchorOf([az, el]), ns = unit(sub(sp, C)); path.push(add(sp, mul(ns, off)));
          let to = sub(GP, sp); if (dmath.hypot(...to) < 2 * step) break; to = sub(to, mul(ns, dot(to, ns))); if (dmath.hypot(...to) < 1e-6) break; p = add(sp, mul(unit(to), step)); }
        path.push(add(GP, mul(unit(sub(GP, C)), off))); path.depart = 1; return path; }
      for (let it = 0; it < 240; it++) { const [az, el] = onCap(unit(sub(p, C))); const sp = anchorOf([az, el]), ns = unit(sub(sp, C)); last = sp; ln = ns; path.push(add(sp, mul(ns, off)));
        if ((el <= 0.5 || ns[1] < -0.05) && it > 0) break; d = add(d, [0, -g, 0]); d = sub(d, mul(ns, dot(d, ns))); if (dmath.hypot(...d) < 1e-6) d = [0, -1, 0]; d = unit(d); p = add(sp, mul(d, step)); }
      // a lock leaving the dome over the FACE (the front hairline, within 60° of the front) falls only the layer's
      // `fringe` past it: the fringe is cut shorter than the hair it grows with
      const s0 = path.at(-1), out = unit([ln[0], 0, ln[2]]), lift = Ly.lift ?? 0.1, bend = Ly.bend ?? 0.3, exitAz = onCap(unit(sub(last, C)))[0];
      if (Ly.fringe != null && Math.abs(exitAz) < 60 && dmath.hypot(ln[0], ln[2]) > 0 && ln[2] < 0) L = Ly.fringe * vary * G;
      // FLICK (a PETAL's end, −1 … 1): the last of the fall hooks OUT away from the head (> 0) or curls UNDER toward it
      // (< 0), rising a little as it turns — the one place a lock may leave its C; the main fall is shortened by the hook's
      // share so the hem stays where `length` put it
      const fk = Ly.flick ?? 0, Lf = 0.32 * Math.abs(fk) * L, Lm = L - 0.15 * Lf;
      const tip = add(s0, mul(unit(add(add(d, [0, -(Ly.droop ?? 0.6), 0]), mul(out, lift))), Lm)), control = add(add(s0, mul(d, 0.5 * Lm)), mul(out, bend * Lm));
      let dome = 0; for (let i = 1; i < path.length; i++) dome += dmath.hypot(...sub(path[i], path[i - 1]));
      for (let j = 1; j <= 10; j++) { const t = j / 10; path.push(add(add(mul(s0, (1 - t) ** 2), mul(control, 2 * (1 - t) * t)), mul(tip, t * t))); }
      if (fk) { const along = unit(sub(tip, control)), c2 = add(tip, mul(along, 0.35 * Lf)), end = add(add(tip, mul(out, Math.sign(fk) * 1.3 * Lf)), [0, 0.3 * Lf, 0]);
        for (let j = 1; j <= 6; j++) { const t = j / 6; path.push(add(add(mul(tip, (1 - t) ** 2), mul(c2, 2 * (1 - t) * t)), mul(end, t * t))); } }
      let all = 0; for (let i = 1; i < path.length; i++) all += dmath.hypot(...sub(path[i], path[i - 1]));
      path.depart = all > 0 ? dome / all : 0;
      return path; };
    // a cap lock's VOLUME sits where it leaves the head (its widest, the most voluminous hair): on the dome it lies thin
    // and flat, sleek to the scalp; at the departure it swells to its full width and thickness, then tapers to its end
    const capWidth = (dp) => (t) => { const bump = Math.exp(-(((t - dp) / 0.2) ** 2)); return (t <= dp ? 0.65 + 0.5 * bump : bump * 0.55 + 0.6 * dmath.pow(Math.max(0, 1 - (t - dp) / (1 - dp || 1)), 0.85)) * (t <= dp ? 1 : dmath.pow(Math.max(0, 1 - (t - dp) / (1 - dp || 1)), 0.35)); };
    const capThick = (dp) => (t) => 0.3 + 1.6 * Math.exp(-(((t - dp) / 0.18) ** 2));
    // a PEEL (a layered banana peel): a LEAF — a narrow stem at its root, widest where it leaves the head (or 40 % out
    // when it is not a cap lock), a pointed tip — thin as a peel, its edges cupped in toward the scalp (`cup`), so a few
    // layered peels read as shells lying one over another
    const peelWidth = (dp) => (t) => (t <= dp ? 0.3 + 0.7 * dmath.pow(dmath.sin(Math.PI / 2 * t / (dp || 1)), 0.8) : dmath.pow(Math.max(0, 1 - (t - dp) / (1 - dp || 1)), 0.9));
    const BUILD = {
      peel: (Q) => { const anchor = anchorOf(Q.at), n = unit(sub(anchor, C)), d = unit(Q.dir ?? add(n, [0, -1, 0])), L = (Q.length ?? 0.6) * G, root = sub(anchor, mul(n, 0.04)), tip = add(anchor, mul(d, L)), dp = Q.path ? Q.path.depart : 0.4;
        piece('peel-' + counts.peel++, root, sprouted(Q, anchor, n, L, bent(root, tip, Q.bend ?? 0.15, n)), tip, (Q.width ?? 0.3) * G, Q.flat ?? 0.16, n, peelWidth(dp), Q.path, Q.path ? (t) => 0.6 + 0.6 * Math.exp(-(((t - dp) / 0.2) ** 2)) : null, Q.cup ?? 0.35); },
      carrot: (K) => { const anchor = anchorOf(K.at), n = unit(sub(anchor, C)), d = unit(K.dir ?? n), L = (K.length ?? 1) * G, base = (K.base ?? 0.2) * G, root = sub(anchor, mul(n, (K.sink ?? 0.5) * base * 2)), tip = add(anchor, mul(d, L)), curveK = 1 + 1.4 * (K.curve ?? 0.3);
        piece('carrot-' + counts.carrot++, root, sprouted(K, anchor, n, L, bent(root, tip, K.bend ?? 0.1, [0, -0.5, 1])), tip, base, 1, Math.abs(d[1]) > 0.9 ? [0, 0, -1] : [0, 1, 0], (t) => dmath.pow(Math.max(0, 1 - t), curveK)); },
      banana: (B) => { const anchor = anchorOf(B.at), n = unit(sub(anchor, C)), d = unit(B.dir ?? add(n, [0, -1, 0])), L = (B.length ?? 0.5) * G, root = sub(anchor, mul(n, 0.06)), tip = add(anchor, mul(d, L));
        piece('banana-' + counts.banana++, root, sprouted(B, anchor, n, L, bent(root, tip, B.bend ?? 0.15, n)), tip, (B.width ?? 0.16) * G, B.flat ?? 0.45, n, B.path ? capWidth(B.path.depart) : (t) => dmath.pow(Math.max(0, 1 - t), 0.85) * (0.7 + 0.3 * dmath.sin(Math.PI * Math.min(1, t * 1.5))), B.path, B.path ? capThick(B.path.depart) : null); },
      pepper: (P) => { const anchor = anchorOf(P.at), n = unit(sub(anchor, C)), d = unit(P.dir ?? add(n, [0, -1, 0])), L = (P.length ?? 0.8) * G, w = (P.width ?? 0.07) * G, root = sub(anchor, mul(n, 2.2 * w)), tip = add(anchor, mul(d, L));
        piece('pepper-' + counts.pepper++, root, sprouted(P, anchor, n, L, bent(root, tip, P.bend ?? 0.12, add(n, [0, 0.3, 0]))), tip, w, 1, Math.abs(d[1]) > 0.9 ? [0, 0, -1] : [0, 1, 0], P.path ? capWidth(P.path.depart) : (t) => Math.min(1, 0.72 + 3.5 * t) * dmath.pow(Math.max(0, 1 - t), 0.8), P.path, P.path ? capThick(P.path.depart) : null); },
    };
    const SIZE = { carrot: 'base', banana: 'width', pepper: 'width', peel: 'width' };
    // the layers: `rows` rows from el[0] to el[1], `count` pieces over the azimuth range (each row offset half a step),
    // lengths varied by `vary` on a sine of the index; each FLOWS from the whorl (`whorl: [az°, el°]`, the crown set back by
    // default) along the head's surface — lifted off it by `lift`, drooped by `droop` — so a layer lies like hair, it
    // never stands out like a sea urchin. `cover` (on by default for bananas and peppers: the locks TILE) widens each piece at its root to overlap its
    // row neighbours by that much, so a layer TILES the head and never leaves a bald gap; the pieces part only toward
    // their points
    for (const Ly of SH?.layers ?? []) {
      const rows = Ly.rows ?? 2, per = Math.max(1, Math.round((Ly.count ?? 12) / rows)), [a0, a1] = Ly.az ?? [0, 360], [e0, e1] = Ly.el ?? [0, 60], full = Math.abs(a1 - a0) >= 360;
      // `around: [from°, to°]` places the rows in rings about the WHORL itself (angular distance from it) instead of by
      // elevation: a ROSETTE, its pieces fanning out from the whorl flat over the crown so the whorl is never bald
      const ring = Ly.around ? (az, el) => onCap(add(mul(Wn, dmath.cos(el * Math.PI / 180)), mul(add(mul(Wu, dmath.cos(az * Math.PI / 180)), mul(Wv, dmath.sin(az * Math.PI / 180))), dmath.sin(el * Math.PI / 180)))) : null;
      const [r0, r1] = Ly.around ?? [e0, e1], place = (az, el) => (ring ? ring(az, el) : [az, el]);
      for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) {
        const u = (i + (r % 2 ? 0.5 : 0) + (full ? 0 : 0.5)) / (full ? per : per + 0.5), az = a0 + (a1 - a0) * Math.min(1, u), el = rows === 1 ? r0 : r0 + (r1 - r0) * r / (rows - 1), k = r * per + i;
        const at = place(az, el), P = anchorOf(at), n = unit(sub(P, C)), vary = 1 + (Ly.vary ?? 0.25) * dmath.sin(k * 2.39996 + r * 1.3);
        const spacing = dmath.hypot(...sub(anchorOf(place(az + (a1 - a0) / (full ? per : per + 0.5), el)), P)), cover = Ly.cover ?? (Ly.shape === 'carrot' ? 0 : 1);
        const width0 = (Ly.width ?? (Ly.shape === 'carrot' ? 0.24 : Ly.shape === 'banana' ? 0.14 : Ly.shape === 'peel' ? 0.3 : 0.06)) * (0.85 + 0.15 * vary), width = Math.max(width0, (cover * 0.62 * spacing) / G);
        let flow = sub(P, WHORL); flow = sub(flow, mul(n, dot(flow, n))); if (dmath.hypot(...flow) < 1e-6) flow = [0, 0, -1];
        // `swirl` (degrees) turns the flow about the scalp's normal, clockwise seen from outside the head: the whole layer
        // turns ONE way (a fringe swept off its part, a crown that spirals) — never a twin pair
        flow = unit(flow); if (Ly.swirl) { const sw = Ly.swirl * Math.PI / 180; flow = sub(mul(flow, dmath.cos(sw)), mul(cross(n, flow), dmath.sin(sw))); }
        const dir = add(add(flow, mul(n, Ly.lift ?? 0.25)), [0, -(Ly.droop ?? 0.6), 0]);
        const capped = Ly.cap && Ly.shape !== 'carrot' ? capPath(P, flow, at[1], (Ly.length ?? 0.6) * vary * G, Ly, vary) : null;
        BUILD[Ly.shape]({ at, dir, length: (Ly.length ?? 0.6) * vary, [SIZE[Ly.shape]]: width, bend: Ly.bend, curve: Ly.curve, sink: Ly.sink, flat: Ly.flat, cup: Ly.cup, sprout: Ly.sprout ?? 0.8, ...(capped ? { path: capped } : {}) });
      }
    }
    for (const K of SH?.carrots ?? []) BUILD.carrot(K);
    for (const B of SH?.bananas ?? []) BUILD.banana(B);
    for (const P of SH?.peppers ?? []) BUILD.pepper(P);
    for (const Q of SH?.peels ?? []) BUILD.peel(Q);
    // the sideburns: two pieces before the ears, in the style's own family; `length`, `width`, `forward` (the tip toward the
    // cheek), `at` (the elevation, below the hairline by default), `az` (degrees in front of the ear's azimuth)
    if (BURNS) {
      const family = BURNS.shape ?? (SH ? (SH.carrots?.length ? 'carrot' : SH.bananas?.length ? 'banana' : SH.peppers?.length ? 'pepper' : SH.peels?.length ? 'peel' : SH.layers?.[0]?.shape) : null) ?? 'banana';
      const A = BURNS.amount ?? 1, L = (BURNS.length ?? 0.4) * A;
      if (L > 0) for (const side of [1, -1]) BUILD[family]({ at: [side > 0 ? 90 - (BURNS.az ?? 10) : 270 + (BURNS.az ?? 10), BURNS.at ?? -10], dir: [side * 0.12, -1, 0.1 - (BURNS.forward ?? 0)], length: L / G, [SIZE[family]]: (BURNS.width ?? (family === 'pepper' ? 0.07 : 0.14)) / G, cup: 0.2, bend: 0.08, curve: 0.2, sink: 0.3, flat: 0.5 });
    }
  }
  // mojulo: the consolidated sections, skinned across their members' curves
  if (FORMS) for (const g of FORMS.groups) {
    const members = g.members.map((n) => FORMS.curves[n]).filter(Boolean); if (members.length < 2) continue;
    const curveAt = (m, t) => {
      const c0 = add(add(mul(m.root, (1 - t) ** 2), mul(m.control, 2 * (1 - t) * t)), mul(m.tip, t * t)), tangent = unit(add(mul(sub(m.control, m.root), 1 - t), mul(sub(m.tip, m.control), t)));
      const across = unit(cross(tangent, m.normal)), thickDir = unit(cross(across, tangent)), taper = dmath.pow(Math.max(0.001, 1 - t), 0.60 * m.taperK) * (1 + 0.25 * dmath.sin(t * Math.PI));
      const w = m.width * h.clump * taper, th = PINCH ? 0.040 * h.thickness * taper * PINCH(t) : 0.040 * h.thickness * taper;
      return { center: FIT ? FIT.drape(c0, SINK ? (th + 0.012 + w * w / 1.6) * SINK(t) : th + 0.012 + w * w / 1.6) : c0, across, thickDir, w, th };
    };
    const k = members.length, half = (i, j) => curveAt(members[i], 0.5), side = (i, j) => (dot(half(i).across, sub(half(j).center, half(i).center)) > 0 ? -1 : 1);
    const cols = [{ edge: 0, dir: side(0, 1), x: -0.5 }, ...members.flatMap((_, i) => (i < k - 1 ? [{ m: i, x: i }, { mid: i, x: i + 0.5 }] : [{ m: i, x: i }])), { edge: k - 1, dir: side(k - 1, k - 2), x: k - 0.5 }];
    // the V hem: a column reaches the full length at the section's centre, `notch` of it at the section's edges
    const p = (k - 1) / 2, reach = (x) => 1 - (1 - g.notch) * Math.min(1, Math.abs(x - p) / (p + 0.5));
    const at = (col, s) => {
      const t = s * reach(col.x);
      if (col.m !== undefined) { const c = curveAt(members[col.m], t); return { center: c.center, T: c.thickDir, th: c.th }; }
      if (col.mid !== undefined) { const a = curveAt(members[col.mid], t), b = curveAt(members[col.mid + 1], t), th = (a.th + b.th) / 2; const c = mul(add(a.center, b.center), 0.5); return { center: FIT ? FIT.drape(c, SINK ? (th + 0.012) * SINK(t) : th + 0.012) : c, T: unit(add(a.thickDir, b.thickDir)), th }; }
      const c = curveAt(members[col.edge], t); return { center: add(c.center, mul(c.across, c.w * col.dir)), T: c.thickDir, th: c.th * 0.6 };
    };
    const R = 14, O = [], I = [];
    // ridge: the section's outer face rises to a spine along its centre column (a tent across the columns), a roof of two
    // planes; flute: each member column raised and each mid column lowered by `flute` of the thickness (a spine per lock)
    const RG = HF?.ridge ?? 0, FL = HF?.flute ?? 0, tent = (x) => Math.max(0, 1 - Math.abs(x - p) / (p + 0.5));
    const rise = RG || FL ? (col) => 1 + RG * tent(col.x) + (col.m !== undefined ? FL : col.mid !== undefined ? -FL : 0) : null;
    for (let r = 0; r <= R; r++) { O.push([]); I.push([]); for (const col of cols) { const p = at(col, r / R), th = Math.max(0.004, p.th); O[r].push(rise ? add(p.center, mul(p.T, th * rise(col))) : add(p.center, mul(p.T, th))); I[r].push(sub(p.center, mul(p.T, th))); } }
    const start = parts.hair.length, C = cols.length;
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) { quad('hair', O[r][c], O[r][c + 1], O[r + 1][c + 1], O[r + 1][c]); quad('hair', I[r][c], I[r + 1][c], I[r + 1][c + 1], I[r][c + 1]); }
    for (let r = 0; r < R; r++) { quad('hair', O[r][0], O[r + 1][0], I[r + 1][0], I[r][0]); quad('hair', O[r][C - 1], I[r][C - 1], I[r + 1][C - 1], O[r + 1][C - 1]); }
    for (let c = 0; c < C - 1; c++) { quad('hair', O[0][c], I[0][c], I[0][c + 1], O[0][c + 1]); quad('hair', O[R][c], O[R][c + 1], I[R][c + 1], I[R][c]); }
    const first = members[0]; locks.push({ name: g.name, root: first.root, control: first.control, tip: first.tip, width: first.width, start, count: parts.hair.length - start, members: g.members });
  }
  // Six-degree chin-up resting pose; upper neck follows while shoulders remain anchored.
  const pitch = (6 + 12 * ((f.headPitch ?? 1) - 1)) * Math.PI / 180, pivot = [0, fy(-0.38), 0.14];
  function pitched(p, weight = 1) { const a = pitch * weight, c = dmath.cos(a), s = dmath.sin(a), y = p[1] - pivot[1], z = p[2] - pivot[2]; return [p[0], pivot[1] + c * y - s * z, pivot[2] + s * y + c * z]; }
  for (const [name, array] of Object.entries(parts)) for (let i = 0; i < array.length; i += 3) { const p = array.slice(i, i + 3), neck = name === 'skin' && i >= neckStart && i < neckEnd; let weight = 1; if (neck) { const t = clamp((p[1] - fy(-1.25)) / (fy(-0.38) - fy(-1.25))); weight = t * t * (3 - 2 * t); } array.splice(i, 3, ...pitched(p, weight)); }
  for (const array of [cage, guides]) for (let i = 0; i < array.length; i += 3) array.splice(i, 3, ...pitched(array.slice(i, i + 3)));
  for (let i = 0; i < headPolygons.length; i++) headPolygons[i] = headPolygons[i].map((p) => pitched(p));
  for (const lk of locks) for (const key of ['root', 'control', 'tip']) lk[key] = pitched(lk[key]);
  return { headPolygons, parts, cage, guides, locks, ...(options.sideburnPatch ? { burns } : {}), recipe: structuredClone(r), neck: { start: neckStart, end: neckEnd }, ears: { start: earsStart, end: neckStart }, cap: { start: capStart, end: capEnd }, pitch, pivot };
}

/** The SCULPT's neutral values (buildAnime's own units): a word equal to its neutral is dropped before the build, so an
 * explicit neutral sculpt runs exactly the studio's statements. A word with no neutral (it replaces a construction: the
 * lid band, the brow block, the graphic lenses, the nose line, the placed nose) is off when absent, null or false. */
export const SCULPT_NEUTRAL = Object.freeze({ eyeLevel: 0.055, stomion: -0.535, mouthWidth: 1, pupil: 0.31, lowerRim: 1, canthusSetback: 0 });
const ROUND = { h: 1, hDn: 1, upper: { m: 2, p: 0.5, k: 0 }, lower: { m: 2, p: 0.5, k: 0 } };
const sameDeep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** the sculpt a build reads: neutral, null and false words dropped (a fissure equal to the round default is neutral);
 * null when nothing is left */
export function sculptOf(sculpt) {
  if (!sculpt || typeof sculpt !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(sculpt)) {
    if (v === undefined || v === null || v === false) continue;
    if (k in SCULPT_NEUTRAL && v === SCULPT_NEUTRAL[k]) continue;
    if (k === 'fissure' && sameDeep({ ...ROUND, ...v, upper: { ...ROUND.upper, ...v.upper }, lower: { ...ROUND.lower, ...v.lower } }, ROUND)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** sculpt: the palpebral fissure as upper / lower lid curves over the eye's lateral coordinate (lat −1 medial canthus …
 * +1 lateral canthus), Y = (1 − |x'|^m)^p with the peak moved to lat k (m 2, p 0.5, k 0 is the studio's ellipse), and the
 * normalised radius of any eye-local point (1 on the outline) from a polar table — ONE outline shared by the aperture,
 * the sclera dish, the iris clip and the lid band. `h` scales the opening's height, `hDn` the lower lid's share. */
function eyeShapeOf(S, f) {
  const F = S.fissure || {}, a = 0.285 * f.eyeWidth, bUp = 0.155 * f.eyeHeight * (F.h ?? 1), bDn = 0.108 * f.eyeHeight * (F.h ?? 1) * (F.hDn ?? 1);
  const shape = ({ m = 2, p = 0.5, k = 0 } = {}) => (lat) => { const x = lat >= k ? (lat - k) / (1 - k) : (lat - k) / (1 + k); return dmath.pow(Math.max(0, 1 - dmath.pow(Math.min(1, Math.abs(x)), m)), p); };
  const Yup = shape(F.upper), Ydn = shape(F.lower);
  const N = 720, tab = [];
  for (let i = 0; i <= N; i++) { const lat = 1 - 2 * i / N, Y = Yup(lat); tab.push([dmath.atan2(Y, lat), dmath.hypot(lat, Y)]); }
  for (let i = 1; i < N; i++) { const lat = -1 + 2 * i / N, Y = Ydn(lat); tab.push([dmath.atan2(-Y, lat), dmath.hypot(lat, Y)]); }
  tab.sort((A, B) => A[0] - B[0]);
  const rho = (th) => {
    let lo = 0, hi = tab.length - 1;
    if (th <= tab[0][0] || th >= tab[hi][0]) { const A = tab[hi], B = tab[0], a0 = A[0], a1 = B[0] + 2 * Math.PI, x = th < 0 ? th + 2 * Math.PI : th; return A[1] + (B[1] - A[1]) * (x - a0) / (a1 - a0); }
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tab[mid][0] <= th) lo = mid; else hi = mid; }
    const A = tab[lo], B = tab[hi]; return A[1] + (B[1] - A[1]) * (th - A[0]) / ((B[0] - A[0]) || 1);
  };
  const norm = (side, du, dy, blink = 1) => { const xn = du / a, yn = dy / ((dy >= 0 ? bUp : bDn) * blink); if (xn === 0 && yn === 0) return 0; return dmath.hypot(xn, yn) / rho(dmath.atan2(yn, xn * side)); };
  return { a, bUp, bDn, Yup, Ydn, norm };
}

/** mojulo's hair fit (see the header): the cap as the head's surface lifted off it, and a drape that keeps a clump's
 * centre outside the head's section at its height. `surface` is buildAnime's own (unpitched frame). */
function hairFit(surface, f, h, HF = null) {
  // the studio's hairline; the hair form's `hairline { front }` raises its front edge (a swept-back cut shows the forehead)
  const bottom = HF?.hairline ? (a) => 0.10 + (HF.hairline.front - 0.10) * Math.max(0, dmath.cos(a)) - 0.48 * Math.max(0, -dmath.cos(a)) : (a) => 0.10 + 0.43 * Math.max(0, dmath.cos(a)) - 0.48 * Math.max(0, -dmath.cos(a));   // the studio's hairline
  const TOP = 1.185, lift0 = Math.max(0.014, 0.028 + 0.25 * (h.volume - 1));   // a floor: the cap's flat faces sag between samples
  const at = (a, y) => { const back = dmath.cos(a) < 0; return { p: surface(dmath.sin(a), y, back), back }; };
  // the outward normal: the cross of the surface's two tangents, turned away from the section's centre
  const normalAt = (a, y) => {
    const e = 1e-3, p = at(a, y).p, pa = at(a + e, y).p, py = at(a, Math.min(TOP, y + e)).p, qy = at(a, y - e).p;
    let n = unit(cross(sub(pa, p), sub(py, qy)));
    const c = [0, p[1], (surface(0, y)[2] + surface(0, y, true)[2]) / 2];
    if (n[0] * (p[0] - c[0]) + n[2] * (p[2] - c[2]) < 0) n = mul(n, -1);
    return n;
  };
  // the hair form's LIFT: the hull off the skull by region, the crown's at the top blending to the rim's (the temples,
  // eased to the fringe in front and the nape behind) at the hairline; the drape below keeps the same lift
  const HL = HF?.lift ?? null;
  const liftAt = (a, t) => { const c = dmath.cos(a), rim = c >= 0 ? HL.temple + (HL.front - HL.temple) * c * c : HL.temple + (HL.back - HL.temple) * c * c, s = clamp(t), w = s * s * (3 - 2 * s); return HL.crown + (rim - HL.crown) * w; };
  const cap = (a, t) => { const y = TOP + (bottom(a) - TOP) * t, p = at(a, y).p, n = normalAt(a, y), L = HL ? liftAt(a, t) : lift0 * (0.35 + 0.65 * Math.sqrt(1 - t)); return add(p, mul(n, L)); };
  const crownPoint = surface(0, 1.19); const crown = HL ? [crownPoint[0], crownPoint[1] + HL.crown, crownPoint[2]] : [crownPoint[0], crownPoint[1] + lift0, crownPoint[2]];
  // the head's horizontal section at a height, as a polar radius about its centre (both shells sampled). Sections are
  // taken at fixed heights (every 0.005) and a point reads the two either side of it, so the drape never depends on the
  // order points are asked in (one clump's edit never moves another)
  const cache = new Map();
  const sectionAtKey = (key) => {
    if (cache.has(key)) return cache.get(key);
    const y = key / 200, pts = [], M = 40;
    for (let i = 0; i <= M; i++) pts.push(surface(-1 + 2 * i / M, y));
    for (let i = 0; i <= M; i++) pts.push(surface(1 - 2 * i / M, y, true));
    const zc = (surface(0, y)[2] + surface(0, y, true)[2]) / 2;
    const polar = pts.map((p) => [dmath.atan2(p[0], p[2] - zc), dmath.hypot(p[0], p[2] - zc)]).sort((A, B) => A[0] - B[0]);
    const S = { zc, polar }; cache.set(key, S); return S;
  };
  const radiusAt = ({ polar }, phi) => {
    const n = polar.length; let hi = polar.findIndex(([a]) => a >= phi); if (hi < 0) hi = n;
    const A = polar[(hi - 1 + n) % n], B = polar[hi % n], a0 = A[0] - (hi === 0 ? 2 * Math.PI : 0), a1 = B[0] + (hi === n ? 2 * Math.PI : 0);
    const t = a1 === a0 ? 0 : (phi - a0) / (a1 - a0); return A[1] + (B[1] - A[1]) * t;
  };
  // the hair form's DOME: above the skull's top section the lifted crown is the skull's own top seen from a centre inside
  // it — its farthest sample per direction (a table over azimuth and elevation about the centre, read bilinearly, so it
  // hugs the crown where a sphere through the forehead would stand off it) plus the crown lift — and a clump arching over
  // the crown is kept outside it, pushed out along its ray from the centre
  const DOME = HF?.dome ? (() => {
    const c = [0, 0.35, 0.17], NA = 32, NE = 8, tab = new Float64Array(NA * NE).fill(-1);
    const bin = (d) => { const a = (dmath.atan2(d[0], d[2]) + Math.PI) / (2 * Math.PI) * NA, e = dmath.atan2(d[1], dmath.hypot(d[0], d[2])) / (Math.PI / 2) * NE; return [a, e]; };
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 12; j++) for (const back of [false, true]) {
      const q = surface(-1 + 2 * i / 40, 0.95 + (TOP - 0.95) * j / 12, back), d = sub(q, c), r = dmath.hypot(...d), [a, e] = bin(d);
      const k = Math.min(NA - 1, Math.floor(a)) * NE + Math.max(0, Math.min(NE - 1, Math.floor(e))); if (r > tab[k]) tab[k] = r;
    }
    // an empty bin takes its column's nearest filled one (toward the pole first), then its row's neighbours
    for (let ai = 0; ai < NA; ai++) for (let ei = 0; ei < NE; ei++) if (tab[ai * NE + ei] < 0) { for (let s = 1; s < NE; s++) { const up = ei + s < NE ? tab[ai * NE + ei + s] : -1, dn = ei - s >= 0 ? tab[ai * NE + ei - s] : -1; if (up >= 0 || dn >= 0) { tab[ai * NE + ei] = Math.max(up, dn); break; } } }
    for (let pass = 0; pass < NA; pass++) for (let ai = 0; ai < NA; ai++) for (let ei = 0; ei < NE; ei++) if (tab[ai * NE + ei] < 0) { const l = tab[((ai + NA - 1) % NA) * NE + ei], rr = tab[((ai + 1) % NA) * NE + ei]; if (l >= 0 || rr >= 0) tab[ai * NE + ei] = Math.max(l, rr); }
    const radius = (d) => {
      const [a, e] = bin(d), a0 = Math.floor(a - 0.5), ta = a - 0.5 - a0, e0 = Math.max(0, Math.min(NE - 2, Math.floor(e - 0.5))), te = clamp(e - 0.5 - e0);
      const at = (ai, ei) => tab[(((ai % NA) + NA) % NA) * NE + ei];
      return (at(a0, e0) * (1 - ta) + at(a0 + 1, e0) * ta) * (1 - te) + (at(a0, e0 + 1) * (1 - ta) + at(a0 + 1, e0 + 1) * ta) * te;
    };
    return { c, radius };
  })() : null;
  const domed = (p, margin) => {
    if (p[1] < 0.95) return p; const d = sub(p, DOME.c), r = dmath.hypot(...d), need = DOME.radius(d) + (HL ? HL.crown : 0) + margin;
    return r >= need ? p : add(DOME.c, mul(d, need / Math.max(r, 1e-9)));
  };
  // a point inside the head (or within `margin` of it) is pushed out along its section's radius (by the lift too, when on)
  const drape = (p, margin) => {
    if (DOME) p = domed(p, margin);
    const Y = p[1]; if (Y > TOP || Y < -1.0) return p;
    const y = Y >= -0.2 ? Y : Math.max(-1.0, -0.2 + (Y + 0.2) / f.lower);
    const k0 = Math.floor(y * 200), u = y * 200 - k0, A = sectionAtKey(k0), B = sectionAtKey(k0 + 1), zc = A.zc + (B.zc - A.zc) * u;
    const dz = p[2] - zc, r = dmath.hypot(p[0], dz), phi = dmath.atan2(p[0], dz), need = HL ? radiusAt(A, phi) + (radiusAt(B, phi) - radiusAt(A, phi)) * u + margin + liftAt(dmath.atan2(p[0], -dz), (TOP - Y) / (TOP - bottom(dmath.atan2(p[0], -dz)))) : radiusAt(A, phi) + (radiusAt(B, phi) - radiusAt(A, phi)) * u + margin;
    if (r >= need) return p;
    const k = need / Math.max(r, 1e-9); return [p[0] * k, Y, zc + dz * k];
  };
  return { cap, crown, drape };
}

/** mojulo's hair FORMS: which clumps consolidate into which section, per family; the notch is how far up the hem cuts
 * between two members' points (`taper` deepens it; the hime cut is straight). Neighbouring sections share an edge clump. */
function formGroupsOf(style, h, HF = null) {
  // the bangs cut deeper than the back (three distinct points over the brow), the hime straight
  const notch = style === 'hime' ? 1 : Math.max(0.5, Math.min(0.95, 1 - 0.28 * h.taper)), fringeNotch = style === 'hime' ? 1 : Math.max(0.4, Math.min(0.95, 1 - 0.45 * h.taper));
  const F = (i) => `fringe-${i}`, B = (i) => `back-${i}`;
  // the hair form's `fringeGroups` (the bang sections by member clump, e.g. one dominant bang [[1, 2, 3, 4, 5], [5, 6, 7]],
  // named formFringeA, B, …) and `backNotch` (the back sections' hem)
  const fringeSections = HF?.fringeGroups ? HF.fringeGroups.map((m, i) => ({ name: `formFringe${'ABCDEFG'[i]}`, members: m.map(F), notch: fringeNotch }))
    : [{ name: 'formFringeL', members: [1, 2, 3].map(F), notch: fringeNotch }, { name: 'formFringeC', members: [3, 4, 5].map(F), notch: fringeNotch }, { name: 'formFringeR', members: [5, 6, 7].map(F), notch: fringeNotch }];
  const backNotch = HF?.backNotch !== undefined ? HF.backNotch : notch;
  if (HF?.fringeNotch !== undefined) for (const g of fringeSections) g.notch = HF.fringeNotch;
  const groups = [
    ...fringeSections,
    { name: 'formBackR', members: [1, 2, 3, 4].map(B), notch: backNotch }, { name: 'formBackC', members: [4, 5, 6, 7, 8].map(B), notch: backNotch }, { name: 'formBackL', members: [8, 9, 10, 11].map(B), notch: backNotch },
  ];
  // the side sections frame the face; the hime keeps its front sidelock a separate squared clump
  for (const [s, S] of [['left', 'L'], ['right', 'R']]) groups.push({ name: `formSide${S}`, members: (style === 'hime' ? [1, 2] : [0, 1, 2]).map((j) => `${s}-temple-${j}`), notch });
  return { groups, members: new Set(groups.flatMap((g) => g.members)), curves: {} };
}

/** The HAIR FORM's fixed constants and neutral words (buildAnime's own units): the roots' sink and pinch while the lift is
 * on; the ridge section's outline (across, thickness) per ring point, the 8-gon's order; a word equal to its neutral, or
 * null or false, is dropped before the build (`hairFormOf`), so an explicit neutral form runs exactly the studio's
 * statements. A sweep of amount 0 and a front hairline at the studio's 0.53 are neutral too. */
const ROOT_SINK = 0.15, ROOT_PINCH = 0.3;
const RIDGE_SECTION = Object.freeze([[1, 0], [0.5, 0.62], [0, 1], [-0.5, 0.62], [-1, 0], [-0.55, -0.42], [0, -0.5], [0.55, -0.42]].map((q) => Object.freeze(q)));
export const HAIR_FORM_NEUTRAL = Object.freeze({ section: 'round', ridge: 0, flute: 0, crown: 'grow' });
/** the hair form a build reads: neutral, null and false words dropped (a sweep given as its amount becomes `{ amount }`);
 * null when nothing is left */
export function hairFormOf(hairForm) {
  if (!hairForm || typeof hairForm !== 'object') return null;
  const out = {};
  for (const [k, v0] of Object.entries(hairForm)) {
    let v = v0;
    if (v === undefined || v === null || v === false) continue;
    if (k in HAIR_FORM_NEUTRAL && v === HAIR_FORM_NEUTRAL[k]) continue;
    if (k === 'sweepBack' || k === 'sweepSides' || k === 'flip' || k === 'sideTail' || k === 'spikes' || k === 'sideburns') { v = typeof v === 'number' ? { amount: v } : v; if (!v.amount && k !== 'sideburns') continue; if (k === 'sideburns' && (v.amount === 0 || v.length === 0)) continue; }
    if (k === 'hairline' && (v.front === undefined || v.front === 0.53)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** The studio's OBJ: one object per part, welded by 8-decimal position. */
export function animeToOBJ(model) {
  const rows = ['# Anime Form Studio: original construction study, Y-up, forward -Z', '# Separate named parts; arbitrary construction units; no rig or UVs']; let offset = 1;
  for (const [part, p] of Object.entries(model.parts)) {
    rows.push('o ' + part); const vertices = [], indices = [], map = new Map();
    for (let i = 0; i < p.length; i += 3) { const v = p.slice(i, i + 3), key = v.map((x) => x.toFixed(8)).join(' '); if (!map.has(key)) { map.set(key, vertices.length); vertices.push(key); } indices.push(map.get(key) + offset); }
    rows.push(...vertices.map((v) => 'v ' + v)); for (let i = 0; i < indices.length; i += 3) rows.push('f ' + indices.slice(i, i + 3).join(' ')); offset += vertices.length;
  }
  return rows.join('\n') + '\n';
}
