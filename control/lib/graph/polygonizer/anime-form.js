/** anime-form.js — the Anime Form Studio's head, PORTED: the sibling of Character Studio (the face, body and hair labs
 * the hero was built on) that designs an original anime face and hair as one parametric construction. Its recipe
 * contract (schema `anime-form-studio-v3`: a male / female design base, face, hair and expression values, per-clump
 * lock edits) and its geometry are the studio's; the arithmetic below is its `model.js` in the same operation order, so
 * the floats match (anime-form.test.js checks per-part hashes frozen from the studio itself).
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
 */

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
const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, s) => a.map((v) => v * s), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
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
 * @param {{ coarse?: boolean, weld?: boolean }} [options] `coarse`: the studio's coarse sampling (the construction lab's
 *   cage); `weld`: the sclera's rim lies exactly on its aperture ring (see the header)
 * @returns {{ headPolygons, parts: { skin, hair, sclera, iris, pupil, ink, mouth }, cage, guides, locks, recipe, neck }}
 */
export function buildAnime(r, options = {}) {
  const headPolygons = []; let capture = true;
  const f = animeEffectiveFace(r), h = r.hair, e = r.expression, parts = { skin: [], hair: [], sclera: [], iris: [], pupil: [], ink: [], mouth: [] }, cage = [], guides = [], locks = [];
  function tri(part, a, b, c) { if (Math.hypot(...cross(sub(b, a), sub(c, a))) < 1e-10) return; parts[part].push(...a, ...b, ...c); }
  function quad(part, a, b, c, d, edge = false) { if (options.coarse && capture && part === 'skin') headPolygons.push([a, b, c, d]); tri(part, a, b, c); tri(part, a, c, d); if (edge) cage.push(...a, ...b, ...b, ...c, ...c, ...d, ...d, ...a); }
  function width(y) { return profile(y, [[-1.02, 0.10 * f.chin], [-0.90, 0.27 * f.chin], [-0.64, 0.51 * f.jaw], [-0.30, 0.69 * (1 + 0.25 * (f.jaw - 1))], [0.12, 0.78], [0.45, 0.79], [0.78, 0.69], [1.04, 0.41], [1.16, 0.18], [1.19, 0.009]]) * f.width; }
  function fy(y) { return y < -0.2 ? -0.2 + (y + 0.2) * f.lower : y; }
  // Separate vault/occiput/nape and jaw-to-chin profiles, informed by the fitted head landmarks.
  function surface(u, y, back = false) {
    let x = u * width(y); const g = (v, c, w) => Math.exp(-(((v - c) / w) ** 2)), arc = Math.pow(Math.max(0, 1 - u * u), 0.45);
    const seam = profile(y, [[-1.02, -0.43], [-0.90, -0.36], [-0.74, -0.17], [-0.60, -0.035], [-0.30, 0.06], [1.19, 0.06]]);
    const front = profile(y, [[-1.02, 0.025], [-0.90, 0.12], [-0.74, 0.30], [-0.60, 0.45], [-0.30, 0.57], [0.22, 0.59], [0.62, 0.57], [0.92, 0.45], [1.16, 0.18], [1.19, 0.009]]);
    const rear = profile(y, [[-1.02, 0.55], [-0.98, 0.59], [-0.90, 0.58], [-0.74, 0.43], [-0.60, 0.30], [-0.40, 0.30], [-0.20, 0.48], [0.10, 0.68], [0.45, 0.73], [0.65, 0.70], [0.78, 0.64], [0.92, 0.53], [1.04, 0.40], [1.10, 0.30], [1.16, 0.17], [1.19, 0.009]]);
    let z = seam + (back ? rear * (f.backDepth ?? 1) : -front * f.depth) * arc;
    if (back) { z += arc * (0.28 * ((f.occiput ?? 1) - 1) * g(y, 0.78, 0.32) - 0.16 * ((f.nape ?? 1) - 1) * g(y, -0.45, 0.24)); }
    else { z -= f.nose * (0.135 * g(x, 0, 0.092) * g(y, -0.18, 0.085) + 0.072 * g(x, 0, 0.075) * g(y, 0.02, 0.20)); z -= 0.025 * g(x, 0, 0.18) * g(y, -0.50, 0.12); }
    // Independent forehead and supraorbital depth; blend to the temple seam.
    if (!back) { const sideFade = Math.max(0, 1 - u * u); z -= 0.28 * ((f.foreheadDepth ?? 1) - 1) * g(y, 0.70, 0.28) * sideFade; z -= 0.22 * ((f.browDepth ?? 1) - 1) * g(y, 0.34, 0.14) * sideFade; }
    // Cheek fullness is local to the front malar region; fades to zero at the side seam.
    if (!back) { const cheekWeight = g(Math.abs(u), 0.57, 0.24) * g(y, -0.29, 0.22) * (1 - Math.pow(Math.abs(u), 8)); const amount = (f.cheekVolume ?? 1) - 1; x += Math.sign(u) * 0.18 * amount * cheekWeight; z -= 0.25 * amount * cheekWeight; }
    // Soft cheek below the malar area, lateral to the mouth; leaves the centerline and seam fixed.
    if (!back) { const weight = g(Math.abs(u), 0.64, 0.23) * g(y, -0.56, 0.17) * (1 - Math.pow(Math.abs(u), 8)); const amount = (f.lowerCheekVolume ?? 1) - 1; x += Math.sign(u) * 0.20 * amount * weight; z -= 0.28 * amount * weight; }
    // Chin projection blends through the whole lower ring; the rear rises into the jaw corner.
    z -= 0.18 * ((f.chinProjection ?? 1) - 1) * g(y, -0.91, 0.18);
    const lower = clamp((-0.30 - y) / 0.72), rearWeight = back ? 0.65 + 0.35 * arc : 0.65 * Math.pow(Math.abs(u), 1.5);
    const lift = 0.20 * Math.sin(Math.PI * lower) * rearWeight * (f.jawAngle ?? 1);
    // Local jaw-corner depth, with no displacement at the chin or upper skull.
    const jawWeight = y > -0.90 && y < -0.30 ? Math.sin(Math.PI * (y + 0.90) / 0.60) ** 2 : 0;
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
  const holes = [{ kind: 'eye', side: -1, x0: -0.8, x1: -0.12, y0: -0.22, y1: 0.32 }, { kind: 'eye', side: 1, x0: 0.12, x1: 0.8, y0: -0.22, y1: 0.32 }, { kind: 'mouth', side: 0, x0: -0.26, x1: 0.26, y0: -0.66, y1: -0.40 }];
  for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const u = (xs[i] + xs[i + 1]) / 2, y = (ys[j] + ys[j + 1]) / 2; if (holes.some((q) => u > q.x0 && u < q.x1 && y > q.y0 && y < q.y1)) continue; quad('skin', surface(xs[i], ys[j]), surface(xs[i + 1], ys[j]), surface(xs[i + 1], ys[j + 1]), surface(xs[i], ys[j + 1]), true); }
  // Rear shares the face's side seam. Caps close the top and bottom loops.
  for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) quad('skin', surface(xs[i], ys[j], true), surface(xs[i], ys[j + 1], true), surface(xs[i + 1], ys[j + 1], true), surface(xs[i + 1], ys[j], true), j % 3 === 0 && i % 2 === 0);
  for (const y of [ys[0], ys.at(-1)]) for (let i = 0; i < xs.length - 1; i++) quad('skin', surface(xs[i], y), surface(xs[i], y, true), surface(xs[i + 1], y, true), surface(xs[i + 1], y));
  function eyeUV(side, t, scale = 1) { const center = side * 0.455 * f.spacing, co = Math.cos(t), si = Math.sin(t), u = center + 0.285 * f.eyeWidth * co * scale, blink = Math.max(0.015, 1 - e.blink), yy = 0.055 + (si >= 0 ? 0.155 : 0.108) * f.eyeHeight * si * scale * blink + f.tilt * (Math.abs(u) - Math.abs(center)); return [u, yy]; }
  function mouthUV(t, scale = 1) { const co = Math.cos(t), si = Math.sin(t), u = 0.175 * (1 + 0.12 * e.smile) * co * scale, y = -0.535 + 0.035 * e.smile * co * co * scale + (si > 0 ? 0.055 : 0.11) * e.open * si * scale + 0.007 * si * scale; return [u, y]; }
  for (const hole of holes) {
    const { x0, x1, y0, y1, side } = hole;
    const outer = [...xs.filter((x) => x >= x0 && x < x1).map((x) => [x, y0]), ...ys.filter((y) => y >= y0 && y < y1).map((y) => [x1, y]), ...xs.filter((x) => x > x0 && x <= x1).reverse().map((x) => [x, y1]), ...ys.filter((y) => y > y0 && y <= y1).reverse().map((y) => [x0, y])];
    const ts = outer.map(([u, y]) => Math.atan2((y - (y0 + y1) / 2) / ((y1 - y0) / 2), (u - (x0 + x1) / 2) / ((x1 - x0) / 2))), uv = (t) => (hole.kind === 'eye' ? eyeUV(side, t) : mouthUV(t)), inner = ts.map(uv), rings = [];
    for (let k = 0; k <= 3; k++) { const t = k / 3; rings.push(outer.map((p, i) => { const u = mix(inner[i][0], p[0], t), y = mix(inner[i][1], p[1], t), v = surface(u, y); v[2] -= 0.009 * Math.sin(Math.PI * t); return v; })); }
    for (let k = 0; k < 3; k++) for (let i = 0; i < outer.length; i++) quad('skin', rings[k][i], rings[k + 1][i], rings[k + 1][(i + 1) % outer.length], rings[k][(i + 1) % outer.length], true);
    const centerUV = hole.kind === 'eye' ? eyeUV(side, 0, 0) : mouthUV(0, 0), center = surface(...centerUV); center[2] += hole.kind === 'eye' ? -0.025 : 0.035;
    for (let i = 0; i < outer.length; i++) {
      const n = (i + 1) % outer.length;
      if (hole.kind === 'mouth') { tri('mouth', rings[0][i], rings[0][n], center); continue; }
      const steps = 4;
      for (let j = 0; j < steps; j++) {
        // weld (additive): the rim's 0.001 lift fades to zero so the sclera's rim is its aperture ring
        const point = (idx, rad) => { const a = inner[idx], u = mix(centerUV[0], a[0], rad), y = mix(centerUV[1], a[1], rad), p = surface(u, y); p[2] -= options.weld ? 0.024 * (1 - rad * rad) + 0.001 * (1 - rad) : 0.024 * (1 - rad * rad) + 0.001; return p; };
        quad('sclera', point(i, j / steps), point(i, (j + 1) / steps), point(n, (j + 1) / steps), point(n, j / steps));
      }
    }
    if (hole.kind === 'eye') {
      const centerU = side * 0.455 * f.spacing, cy = 0.055, blink = Math.max(0.015, 1 - e.blink);
      function eyePoint(u, y) { const p = surface(u, y), rad = Math.sqrt(((u - centerU) / (0.285 * f.eyeWidth)) ** 2 + ((y - cy - f.tilt * (Math.abs(u) - Math.abs(centerU))) / ((y >= cy ? 0.155 : 0.108) * f.eyeHeight * blink)) ** 2); p[2] -= 0.024 * Math.max(0, 1 - rad * rad) + 0.004; return p; }
      function irisPatch(part, size) {
        const rings = [];
        for (let k = 0; k <= 3; k++) { const rad = k / 3; rings.push(Array.from({ length: 40 }, (_, i) => { const t = i / 40 * 2 * Math.PI; let dx = Math.cos(t) * 0.13 * f.iris * size, dy = Math.sin(t) * 0.138 * f.iris * size; const lim = Math.sqrt((dx / (0.285 * f.eyeWidth)) ** 2 + (dy / ((dy >= 0 ? 0.155 : 0.108) * f.eyeHeight * blink)) ** 2), fit = Math.min(1, 0.97 / (lim || 1)); dx *= fit * rad; dy *= fit * rad; const p = eyePoint(centerU + dx, cy + dy + f.tilt * (Math.abs(centerU + dx) - Math.abs(centerU))); p[2] -= part === 'pupil' ? 0.002 : 0; return p; })); }
        for (let j = 0; j < 3; j++) for (let i = 0; i < 40; i++) quad(part, rings[j][i], rings[j + 1][i], rings[j + 1][(i + 1) % 40], rings[j][(i + 1) % 40]);
      }
      if (e.blink < 0.985) { irisPatch('iris', 1); irisPatch('pupil', 0.31); }
      // Upper lash is modeled thickness; lower rim stays lighter and narrower.
      for (const upper of [true, false]) { const N = 32; for (let i = 0; i < N; i++) { const t0 = (upper ? 0 : Math.PI) + i * Math.PI / N, t1 = (upper ? 0 : Math.PI) + (i + 1) * Math.PI / N; const rim = (t) => { const [u, y] = eyeUV(side, t), p = surface(u, y); p[2] -= 0.01; const thick = (upper ? 0.020 : 0.006) * Math.pow(Math.max(0.05, Math.sin(t) * (upper ? 1 : -1)), 0.4); return [p, add(p, [0, thick * (upper ? 1 : -1), -0.002])]; }; quad('ink', ...rim(t0), ...rim(t1).reverse()); } }
      // Brow ribbon follows the face and can tilt independently from eyelids.
      for (let i = 0; i < 16; i++) { const point = (t, top) => { const u = centerU + (t - 0.5) * 0.46 * f.eyeWidth, y = 0.37 + 0.035 * Math.sin(t * Math.PI) + e.brow * side * (t - 0.5) * 0.12; const p = surface(u, y + (top ? 0.018 : 0)); p[2] -= 0.014; return p; }; quad('ink', point(i / 16, 0), point((i + 1) / 16, 0), point((i + 1) / 16, 1), point(i / 16, 1)); }
    }
  }
  capture = false;
  // Small ear volumes and an unrigged neck/shoulder context.
  function ellipsoid(part, c, rad) { const N = 24, M = 16, pt = (i, j) => { const t = 2 * Math.PI * i / N, a = Math.PI * j / M; return [c[0] + rad[0] * Math.sin(a) * Math.cos(t), c[1] + rad[1] * Math.cos(a), c[2] + rad[2] * Math.sin(a) * Math.sin(t)]; }; for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) quad(part, pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)); }
  const earsStart = parts.skin.length;
  for (const side of [-1, 1]) { ellipsoid('skin', [side * 0.77 * f.width, fy(-0.24), 0.045], [0.10, 0.205, 0.14]); }
  // Upper neck overlaps inside the jaw/skull instead of ending below the head.
  // Separate front/back extent gives the throat and nape a continuous supporting volume.
  const neckStart = parts.skin.length;
  const neckSections = [[-1.67, 1.05, -0.30, 0.46], [-1.49, 0.69, -0.22, 0.38], [-1.36, 0.30, -0.18, 0.32], [-1.15, 0.25, -0.20, 0.32], [-0.94, 0.26, -0.25, 0.34], [-0.76, 0.30, -0.31, 0.36], [-0.57, 0.34, -0.32, 0.37], [-0.38, 0.35, -0.27, 0.40], [-0.18, 0.34, -0.22, 0.43]];
  const neckRings = neckSections.map(([y, rx, front, rear]) => Array.from({ length: 40 }, (_, i) => { const a = i / 40 * 2 * Math.PI, t = Math.cos(a), center = (front + rear) / 2, radius = (rear - front) / 2; return [Math.sin(a) * rx * f.width, fy(y), center + t * radius]; }));
  for (let j = 0; j < neckRings.length - 1; j++) for (let i = 0; i < 40; i++) quad('skin', neckRings[j][i], neckRings[j][(i + 1) % 40], neckRings[j + 1][(i + 1) % 40], neckRings[j + 1][i]);

  const neckEnd = parts.skin.length;
  // Hair cap + individually directed swept solid clumps.
  const vx = h.volume * f.width, vy = h.volume, depth = h.volume, short = h.style === 'short', hime = h.style === 'hime';
  const FIT = options.fitHair ? hairFit(surface, f, h) : null;
  const FORMS = options.forms && ['bob', 'long', 'hime'].includes(h.style) ? formGroupsOf(h.style, h) : null;
  function capPoint(a, t) {
    if (FIT) return FIT.cap(a, t); const bottom = 0.10 + 0.43 * Math.max(0, Math.cos(a)) - 0.48 * Math.max(0, -Math.cos(a)), end = Math.acos(clamp((bottom - 0.2) / 0.99, -1, 1)), q = 0.015 + (end - 0.015) * t; return [Math.sin(q) * Math.sin(a) * 0.87 * vx, 0.2 + Math.cos(q) * 1.01 * vy, 0.07 - Math.sin(q) * Math.cos(a) * 0.83 * depth]; }
  const capStart = parts.hair.length;
  for (let j = 0; j < 14; j++) for (let i = 0; i < 48; i++) quad('hair', capPoint(i / 48 * 2 * Math.PI, j / 14), capPoint((i + 1) / 48 * 2 * Math.PI, j / 14), capPoint((i + 1) / 48 * 2 * Math.PI, (j + 1) / 14), capPoint(i / 48 * 2 * Math.PI, (j + 1) / 14));
  if (FIT) for (let i = 0; i < 48; i++) tri('hair', FIT.crown, capPoint((i + 1) / 48 * 2 * Math.PI, 0), capPoint(i / 48 * 2 * Math.PI, 0));   // the fitted cap closes at the crown
  const capEnd = parts.hair.length;
  function lock(name, root, control, tip, width, normal, taperK = h.taper) {
    const edit = r.locks?.[name]; if (edit) { control = add(control, [edit.cx, edit.cy, edit.cz]); tip = add(tip, [edit.tx, edit.ty, edit.tz]); }
    if (FIT) tip = FIT.drape(tip, 0.006);
    if (FORMS?.members.has(name)) { FORMS.curves[name] = { root, control, tip, width, normal, taperK }; return; }   // a section's member: skinned below
    const start = parts.hair.length; const rings = [], N = 14, S = 8;
    for (let j = 0; j < N; j++) { const t = j / N; let center = add(add(mul(root, (1 - t) ** 2), mul(control, 2 * (1 - t) * t)), mul(tip, t * t)); const tangent = unit(add(mul(sub(control, root), 1 - t), mul(sub(tip, control), t))), across = unit(cross(tangent, normal)), thickDir = unit(cross(across, tangent)), taper = Math.pow(Math.max(0.001, 1 - t), 0.60 * taperK) * (1 + 0.25 * Math.sin(t * Math.PI)), w = width * h.clump * taper, th = 0.040 * h.thickness * taper; if (FIT) center = FIT.drape(center, th + 0.012 + w * w / 1.6); rings.push(Array.from({ length: S }, (_, i) => { const a = i / S * 2 * Math.PI, q = add(center, add(mul(across, Math.cos(a) * w), mul(thickDir, Math.sin(a) * th))); return FIT && j > 0 ? FIT.drape(q, 0.004) : q; })); }
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < S; i++) quad('hair', rings[j][i], rings[j + 1][i], rings[j + 1][(i + 1) % S], rings[j][(i + 1) % S]);
    for (let i = 0; i < S; i++) { tri('hair', root, rings[0][(i + 1) % S], rings[0][i]); tri('hair', rings.at(-1)[i], tip, rings.at(-1)[(i + 1) % S]); }
    guides.push(...root, ...control, ...control, ...tip); locks.push({ name, root, control, tip, width, start, count: parts.hair.length - start });
  }
  // Unequal tip heights and part-directed curves are authored, not random noise.
  const fringe = [[-0.64, 0.25, 0.17], [-0.44, 0.30, 0.19], [-0.24, 0.12, 0.19], [-0.04, 0.28, 0.16], [0.18, 0.17, 0.20], [0.39, 0.32, 0.19], [0.62, 0.23, 0.17]];
  for (let i = 0; i < fringe.length; i++) { const [x, y0, w] = fringe[i], y = hime ? 0.34 : y0, root = [(x * 0.52 + h.part) * vx, 0.94 * vy, -0.40 * depth], control = [(x * 0.94 + h.part * 0.5) * vx, 0.62 * vy, -0.86 * depth], tip = [(x + h.sweep * 0.22 + (short ? Math.sign(x) * 0.045 : 0)) * vx, 0.62 - (0.62 - y) * h.fringe + (short ? 0.08 : 0), -0.71 * depth]; if (hime) lock('fringe-' + (i + 1), root, control, tip, w, [0, 0, -1], 0.15); else lock('fringe-' + (i + 1), root, control, tip, w, [0, 0, -1]); }
  for (const side of [-1, 1]) for (let j = 0; j < 3; j++) { const z = -0.34 + j * 0.22, x = (0.80 + j * 0.025) * vx, baseY = short ? -0.25 - j * 0.07 : h.style === 'long' ? -1.30 - j * 0.09 : hime ? (j === 0 ? -0.66 : -1.30 - j * 0.09) : -0.80 - j * 0.08; const args = [(side < 0 ? 'left' : 'right') + '-temple-' + j, [side * 0.66 * vx, 0.76 * vy, z], [side * 0.94 * vx, 0.10, z - 0.07], [side * (x + 0.04 * j + h.sweep * 0.15), 0.3 + (baseY - 0.3) * h.length, z + 0.08], 0.14, [side, 0, 0]]; if (hime && j === 0) lock(...args, 0.15); else lock(...args); }
  for (let i = 0; i < 11; i++) { const a = Math.PI * 0.58 + i / 10 * Math.PI * 0.84, root = capPoint(a, 0.30), c = capPoint(a, 0.85), rear = [Math.sin(a) * 0.86 * vx, 0.12, 0.07 - Math.cos(a) * 0.81 * depth], len = short ? 0.38 : h.style === 'long' || hime ? 1.55 : 1.03, tip = [rear[0] * (short ? 1.12 : 0.93) + h.sweep * 0.18 * Math.sin(a), rear[1] - len * h.length + (i % 3) * 0.055, rear[2] + (short ? 0.07 : 0.025)]; lock('back-' + (i + 1), root, [c[0] * 1.08, 0.35, c[2] * 1.1], tip, 0.18, [Math.sin(a), 0, -Math.cos(a)]); }
  if (short) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) lock('crown-' + side + '-' + i, [side * 0.13, 0.97, -0.04 + i * 0.13], [side * (0.45 + i * 0.08), 1.27, -0.01 + i * 0.12], [side * (0.74 + i * 0.07), 0.96 + i * 0.07, 0.02 + i * 0.14], 0.12, [0, 1, 0]);
  // mojulo: an ahoge — one upright curl at the crown, rising forward and curling back (an amount; the studio has none)
  if (h.ahoge > 0) { const A = h.ahoge; lock('ahoge', [0.02, 1.15, -0.10], [0.03, 1.15 + 0.55 * A, -0.36 - 0.1 * A], [0.07, 1.15 + 0.30 * A, 0.04], 0.075, [1, 0, 0]); }
  // mojulo: the consolidated sections, skinned across their members' curves
  if (FORMS) for (const g of FORMS.groups) {
    const members = g.members.map((n) => FORMS.curves[n]).filter(Boolean); if (members.length < 2) continue;
    const curveAt = (m, t) => {
      const c0 = add(add(mul(m.root, (1 - t) ** 2), mul(m.control, 2 * (1 - t) * t)), mul(m.tip, t * t)), tangent = unit(add(mul(sub(m.control, m.root), 1 - t), mul(sub(m.tip, m.control), t)));
      const across = unit(cross(tangent, m.normal)), thickDir = unit(cross(across, tangent)), taper = Math.pow(Math.max(0.001, 1 - t), 0.60 * m.taperK) * (1 + 0.25 * Math.sin(t * Math.PI));
      const w = m.width * h.clump * taper, th = 0.040 * h.thickness * taper;
      return { center: FIT ? FIT.drape(c0, th + 0.012 + w * w / 1.6) : c0, across, thickDir, w, th };
    };
    const k = members.length, half = (i, j) => curveAt(members[i], 0.5), side = (i, j) => (dot(half(i).across, sub(half(j).center, half(i).center)) > 0 ? -1 : 1);
    const cols = [{ edge: 0, dir: side(0, 1), x: -0.5 }, ...members.flatMap((_, i) => (i < k - 1 ? [{ m: i, x: i }, { mid: i, x: i + 0.5 }] : [{ m: i, x: i }])), { edge: k - 1, dir: side(k - 1, k - 2), x: k - 0.5 }];
    // the V hem: a column reaches the full length at the section's centre, `notch` of it at the section's edges
    const p = (k - 1) / 2, reach = (x) => 1 - (1 - g.notch) * Math.min(1, Math.abs(x - p) / (p + 0.5));
    const at = (col, s) => {
      const t = s * reach(col.x);
      if (col.m !== undefined) { const c = curveAt(members[col.m], t); return { center: c.center, T: c.thickDir, th: c.th }; }
      if (col.mid !== undefined) { const a = curveAt(members[col.mid], t), b = curveAt(members[col.mid + 1], t), th = (a.th + b.th) / 2; const c = mul(add(a.center, b.center), 0.5); return { center: FIT ? FIT.drape(c, th + 0.012) : c, T: unit(add(a.thickDir, b.thickDir)), th }; }
      const c = curveAt(members[col.edge], t); return { center: add(c.center, mul(c.across, c.w * col.dir)), T: c.thickDir, th: c.th * 0.6 };
    };
    const R = 14, O = [], I = [];
    for (let r = 0; r <= R; r++) { O.push([]); I.push([]); for (const col of cols) { const p = at(col, r / R), th = Math.max(0.004, p.th); O[r].push(add(p.center, mul(p.T, th))); I[r].push(sub(p.center, mul(p.T, th))); } }
    const start = parts.hair.length, C = cols.length;
    for (let r = 0; r < R; r++) for (let c = 0; c < C - 1; c++) { quad('hair', O[r][c], O[r][c + 1], O[r + 1][c + 1], O[r + 1][c]); quad('hair', I[r][c], I[r + 1][c], I[r + 1][c + 1], I[r][c + 1]); }
    for (let r = 0; r < R; r++) { quad('hair', O[r][0], O[r + 1][0], I[r + 1][0], I[r][0]); quad('hair', O[r][C - 1], I[r][C - 1], I[r + 1][C - 1], O[r + 1][C - 1]); }
    for (let c = 0; c < C - 1; c++) { quad('hair', O[0][c], I[0][c], I[0][c + 1], O[0][c + 1]); quad('hair', O[R][c], O[R][c + 1], I[R][c + 1], I[R][c]); }
    const first = members[0]; locks.push({ name: g.name, root: first.root, control: first.control, tip: first.tip, width: first.width, start, count: parts.hair.length - start, members: g.members });
  }
  // Six-degree chin-up resting pose; upper neck follows while shoulders remain anchored.
  const pitch = (6 + 12 * ((f.headPitch ?? 1) - 1)) * Math.PI / 180, pivot = [0, fy(-0.38), 0.14];
  function pitched(p, weight = 1) { const a = pitch * weight, c = Math.cos(a), s = Math.sin(a), y = p[1] - pivot[1], z = p[2] - pivot[2]; return [p[0], pivot[1] + c * y - s * z, pivot[2] + s * y + c * z]; }
  for (const [name, array] of Object.entries(parts)) for (let i = 0; i < array.length; i += 3) { const p = array.slice(i, i + 3), neck = name === 'skin' && i >= neckStart && i < neckEnd; let weight = 1; if (neck) { const t = clamp((p[1] - fy(-1.25)) / (fy(-0.38) - fy(-1.25))); weight = t * t * (3 - 2 * t); } array.splice(i, 3, ...pitched(p, weight)); }
  for (const array of [cage, guides]) for (let i = 0; i < array.length; i += 3) array.splice(i, 3, ...pitched(array.slice(i, i + 3)));
  for (let i = 0; i < headPolygons.length; i++) headPolygons[i] = headPolygons[i].map((p) => pitched(p));
  for (const lk of locks) for (const key of ['root', 'control', 'tip']) lk[key] = pitched(lk[key]);
  return { headPolygons, parts, cage, guides, locks, recipe: structuredClone(r), neck: { start: neckStart, end: neckEnd }, ears: { start: earsStart, end: neckStart }, cap: { start: capStart, end: capEnd }, pitch, pivot };
}

/** mojulo's hair fit (see the header): the cap as the head's surface lifted off it, and a drape that keeps a clump's
 * centre outside the head's section at its height. `surface` is buildAnime's own (unpitched frame). */
function hairFit(surface, f, h) {
  const bottom = (a) => 0.10 + 0.43 * Math.max(0, Math.cos(a)) - 0.48 * Math.max(0, -Math.cos(a));   // the studio's hairline
  const TOP = 1.185, lift0 = Math.max(0.014, 0.028 + 0.25 * (h.volume - 1));   // a floor: the cap's flat faces sag between samples
  const at = (a, y) => { const back = Math.cos(a) < 0; return { p: surface(Math.sin(a), y, back), back }; };
  // the outward normal: the cross of the surface's two tangents, turned away from the section's centre
  const normalAt = (a, y) => {
    const e = 1e-3, p = at(a, y).p, pa = at(a + e, y).p, py = at(a, Math.min(TOP, y + e)).p, qy = at(a, y - e).p;
    let n = unit(cross(sub(pa, p), sub(py, qy)));
    const c = [0, p[1], (surface(0, y)[2] + surface(0, y, true)[2]) / 2];
    if (n[0] * (p[0] - c[0]) + n[2] * (p[2] - c[2]) < 0) n = mul(n, -1);
    return n;
  };
  const cap = (a, t) => { const y = TOP + (bottom(a) - TOP) * t, p = at(a, y).p, n = normalAt(a, y), L = lift0 * (0.35 + 0.65 * Math.sqrt(1 - t)); return add(p, mul(n, L)); };
  const crownPoint = surface(0, 1.19); const crown = [crownPoint[0], crownPoint[1] + lift0, crownPoint[2]];
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
    const polar = pts.map((p) => [Math.atan2(p[0], p[2] - zc), Math.hypot(p[0], p[2] - zc)]).sort((A, B) => A[0] - B[0]);
    const S = { zc, polar }; cache.set(key, S); return S;
  };
  const radiusAt = ({ polar }, phi) => {
    const n = polar.length; let hi = polar.findIndex(([a]) => a >= phi); if (hi < 0) hi = n;
    const A = polar[(hi - 1 + n) % n], B = polar[hi % n], a0 = A[0] - (hi === 0 ? 2 * Math.PI : 0), a1 = B[0] + (hi === n ? 2 * Math.PI : 0);
    const t = a1 === a0 ? 0 : (phi - a0) / (a1 - a0); return A[1] + (B[1] - A[1]) * t;
  };
  // a point inside the head (or within `margin` of it) is pushed out along its section's radius
  const drape = (p, margin) => {
    const Y = p[1]; if (Y > TOP || Y < -1.0) return p;
    const y = Y >= -0.2 ? Y : Math.max(-1.0, -0.2 + (Y + 0.2) / f.lower);
    const k0 = Math.floor(y * 200), u = y * 200 - k0, A = sectionAtKey(k0), B = sectionAtKey(k0 + 1), zc = A.zc + (B.zc - A.zc) * u;
    const dz = p[2] - zc, r = Math.hypot(p[0], dz), phi = Math.atan2(p[0], dz), need = radiusAt(A, phi) + (radiusAt(B, phi) - radiusAt(A, phi)) * u + margin;
    if (r >= need) return p;
    const k = need / Math.max(r, 1e-9); return [p[0] * k, Y, zc + dz * k];
  };
  return { cap, crown, drape };
}

/** mojulo's hair FORMS: which clumps consolidate into which section, per family; the notch is how far up the hem cuts
 * between two members' points (`taper` deepens it; the hime cut is straight). Neighbouring sections share an edge clump. */
function formGroupsOf(style, h) {
  // the bangs cut deeper than the back (three distinct points over the brow), the hime straight
  const notch = style === 'hime' ? 1 : Math.max(0.5, Math.min(0.95, 1 - 0.28 * h.taper)), fringeNotch = style === 'hime' ? 1 : Math.max(0.4, Math.min(0.95, 1 - 0.45 * h.taper));
  const F = (i) => `fringe-${i}`, B = (i) => `back-${i}`;
  const groups = [
    { name: 'formFringeL', members: [1, 2, 3].map(F), notch: fringeNotch }, { name: 'formFringeC', members: [3, 4, 5].map(F), notch: fringeNotch }, { name: 'formFringeR', members: [5, 6, 7].map(F), notch: fringeNotch },
    { name: 'formBackR', members: [1, 2, 3, 4].map(B), notch }, { name: 'formBackC', members: [4, 5, 6, 7, 8].map(B), notch }, { name: 'formBackL', members: [8, 9, 10, 11].map(B), notch },
  ];
  // the side sections frame the face; the hime keeps its front sidelock a separate squared clump
  for (const [s, S] of [['left', 'L'], ['right', 'R']]) groups.push({ name: `formSide${S}`, members: (style === 'hime' ? [1, 2] : [0, 1, 2]).map((j) => `${s}-temple-${j}`), notch });
  return { groups, members: new Set(groups.flatMap((g) => g.members)), curves: {} };
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
