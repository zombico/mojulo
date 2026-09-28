/** anime-head.js — the ANIME HEAD: the Anime Form Studio's head (anime-form.js, the studio's own construction, ported
 * bit for bit) worn by the hero beside the landmark head (`head: 'anime'` at the hero door).
 *
 * The words are the studio's: a design base (`preset` female / male), its FACE controls, its HAIR (a family — bob,
 * short, long — its controls, and per-clump LOCK edits by the studio's clump names) and its EXPRESSION (poses or four
 * amounts). Here they are conversational: ratio-controls vocabularies (a move, an object or a list, composed left to
 * right), 1 = the design base, applied as the studio applies a slider (value + the base's offset); `tilt`, `sweep` and
 * `part` are OFFSETS about 0. The studio's slider ranges advise, never refuse.
 *
 * The geometry is the studio's, registered and made wearable:
 *   - registered into the hero head frame (+x right, +y front, +z up, metres about the atlas) by the fitted heads'
 *     REGISTRATION for the pole (crown-to-chin height, chin at the menton, the head's length centred), so every collar
 *     and neck clearance built around the landmark head holds; the studio's frame (Y up, forward −Z) maps by a proper
 *     rotation, so windings keep their sense;
 *   - the studio's neck and shoulder context is not worn (the hero's neck is the body's);
 *   - every part CLOSED under the layered audit: welded, oriented, outward. The face is one mesh (skin, sclera, mouth as
 *     face groups; the sclera's rim welded onto its aperture ring, anime-form `weld`); the ears are closed volumes; the
 *     iris and pupil lenses, the lash, lower-rim and brow ribbons get a back just behind their visible face; the hair cap
 *     a thickness under it; every clump is its own closed part;
 *   - one hidden L1 `cranium` (an ellipsoid core inside the skull) carries the rig binding and the pin; everything
 *     visible is pinned to it and rides the head bone rigidly. The studio opens the mouth as an aperture, so there is no
 *     jaw part, no jaw hinge and no dial.
 * `register`: `lowpoly` is the studio's coarse sampling (its construction lab's cage density), anything else its full
 * sampling. Pure; no dice.
 */
import { compileLayered, pinFrame } from './station-loft.js';
import { address } from './station-loft-detail.js';
import { surfaceLocalOffset } from './surface-pin.js';
import { r6 } from './station-loft-plan.js';
import { ratioControls } from './ratio-controls.js';
import { REGISTRATION } from './humanoid-head-fit.js';
import { buildAnime, animeFresh, animeFaceDefs, ANIME_FACE_DEFS, ANIME_HAIR_DEFS, ANIME_EXPRESSION_DEFS, ANIME_HAIR_STYLES as STUDIO_FAMILIES, ANIME_LOCK_RE as STUDIO_LOCK_RE, ANIME_LOCK_KEYS } from './anime-form.js';
import { rasterDepth, viewCamera } from '../scene/depth-raster.js';

/** the hair FAMILIES: the studio's three and mojulo's `hime` (hair-passes) */
export const ANIME_HAIR_STYLES = Object.freeze([...STUDIO_FAMILIES, 'hime']);
/** the clumps a lock edit may name: the studio's, and the `ahoge` */
export const ANIME_LOCK_RE = new RegExp(`${STUDIO_LOCK_RE.source.slice(0, -2)}|ahoge)$`);

// ─── the vocabulary ───────────────────────────────────────────────────────
const rangesOf = (defs) => Object.fromEntries(defs.map(([k, , lo, hi]) => [k, [lo, hi]]));
/** FACE TRAITS (hero-looks): the designers' words as ratios about the base (`tilt` an offset). A trait composes with any
 * other by product (a trait and then a little more is more). Starting numbers, tuned on the eyes gate. */
export const ANIME_FACE_MOVES = Object.freeze({
  tsurime: { note: 'upturned outer eye corners (the lift up, the opening a little lower)', face: { tilt: 0.05, eyeHeight: 0.94 } },
  tareme: { note: 'drooping outer eye corners (the lift down, the opening a little taller)', face: { tilt: -0.05, eyeHeight: 1.04 } },
  'large-eyes': { note: 'larger eyes and irises', face: { eyeWidth: 1.05, eyeHeight: 1.08, iris: 1.04 } },
  'narrow-eyes': { note: 'a narrower, level opening and a smaller iris', face: { eyeHeight: 0.86, iris: 0.94 } },
  soft: { note: 'a rounder lower face: fuller cheeks, a broader chin set back, the jaw corner higher', face: { cheekVolume: 1.1, lowerCheekVolume: 1.1, chin: 1.1, jawAngle: 1.08, chinProjection: 0.94 } },
  sharp: { note: 'an angular lower face: flatter cheeks, a narrow chin forward, a longer lower face', face: { cheekVolume: 0.92, lowerCheekVolume: 0.9, chin: 0.88, chinProjection: 1.06, jawDepth: 0.95, lower: 1.04 } },
  youthful: { note: 'a shorter lower face, bigger eyes, a smaller nose and chin, a fuller back of the skull', face: { lower: 0.92, eyeHeight: 1.06, eyeWidth: 1.03, nose: 0.85, chinProjection: 0.94, occiput: 1.05 } },
  mature: { note: 'a longer lower face, a calmer opening, more nose and chin', face: { lower: 1.07, eyeHeight: 0.9, nose: 1.1, cheekVolume: 0.95, chinProjection: 1.06, jawDepth: 1.05 } },
  'button-nose': { note: 'a small nose', face: { nose: 0.75 } },
  'strong-chin': { note: 'a broad, forward, longer chin on a squarer jaw corner', face: { chin: 1.12, chinProjection: 1.12, chinHeight: 1.06, jawAngle: 0.9 } },
});
/** the studio's face controls under its own names; 1 = the design base. Multi-key groups are the words that move a
 * region together (never named like a control: `jaw` and `chin` are controls, so their groups are `jawline` and
 * `chinShape`); the single-key groups only name where a control sits. `tilt` (the outer-eye lift) is an offset. */
export const ANIME_FACE = ratioControls({
  label: 'face',
  groups: { skull: ['width', 'depth', 'backDepth', 'occiput', 'nape'], brow: ['foreheadDepth', 'browDepth'], cheeks: ['cheekVolume', 'lowerCheekVolume'],
    jawline: ['jaw', 'jawAngle', 'jawDepth'], chinShape: ['chin', 'chinProjection', 'chinHeight'], eyes: ['eyeWidth', 'eyeHeight'],
    length: ['lower'], profile: ['nose'], placement: ['spacing'], irises: ['iris'], lift: ['tilt'], carriage: ['headPitch'] },
  ranges: rangesOf(ANIME_FACE_DEFS),
  moves: ANIME_FACE_MOVES,
  offsets: ['tilt'],
});
/** the studio's hair controls (1 = its default; `sweep` and `part` offsets) — the family word and the locks ride beside */
export const ANIME_HAIR = ratioControls({
  label: 'hair',
  groups: { mass: ['volume', 'length', 'fringe'], clumps: ['clump', 'thickness', 'taper'], sweep: ['sweep'], part: ['part'], accent: ['ahoge'], build: ['strands'] },
  ranges: { ...rangesOf(ANIME_HAIR_DEFS), ahoge: [0, 1.5], strands: [0, 1] },
  offsets: ['sweep', 'part', 'ahoge', 'strands'],
});
/** HAIR TRAITS (hero-looks): controls and, where the word is a direction, clump LOCK edits (studio construction units).
 * Words disjoint from the family names. `messy` is authored, not dice: five clumps, fixed offsets. */
export const ANIME_HAIR_MOVES = Object.freeze({
  spiky: { note: 'thinner clumps drawn to sharper tips, a little more crown', hair: { taper: 1.25, thickness: 0.85, volume: 1.06 } },
  sleek: { note: 'a closer mass, softer tips, flatter narrower clumps', hair: { volume: 0.95, taper: 0.85, thickness: 0.8, clump: 0.95 } },
  messy: { note: 'fuller, wider clumps with a sweep and five tips pushed off the fall', hair: { volume: 1.08, clump: 1.06, sweep: 0.08,
    locks: { 'fringe-2': { tx: 0.05, ty: 0.03 }, 'fringe-5': { tx: -0.04, ty: 0.05 }, 'fringe-7': { ty: -0.04 }, 'back-3': { tx: -0.06 }, 'back-8': { tx: 0.05, tz: 0.04 } } } },
  'heavy-bangs': { note: 'a longer, fuller fringe', hair: { fringe: 1.15, clump: 1.06 } },
  'short-bangs': { note: 'a shorter fringe that opens the brow', hair: { fringe: 0.8 } },
  'swept-bangs': { note: 'the fringe swept to one side off a side part', hair: { sweep: 0.2, part: 0.1 } },
  voluminous: { note: 'a bigger crown and thicker clumps', hair: { volume: 1.12, thickness: 1.15 } },
  peekaboo: { note: 'one bang dropped over the right eye', hair: { locks: { 'fringe-3': { ty: -0.16, tx: 0.03, tz: -0.02 } } } },
  ahoge: { note: 'one upright curl at the crown', hair: { ahoge: 1 } },
});
/** the studio's expression poses (its buttons) as words, and hero-looks' more; an object of amounts after a word
 * adjusts it. The studio's brow: > 0 lowers the inner ends (a set, angry V), < 0 raises them (worried). */
export const ANIME_POSES = Object.freeze({ neutral: {}, blink: { blink: 1 }, smile: { smile: 1, blink: 0.12, brow: 0.3 }, open: { open: 0.8, brow: 0.2 },
  happy: { blink: 1, smile: 1, brow: -0.2 }, determined: { brow: 0.55, blink: 0.18 }, deadpan: { blink: 0.5 },
  angry: { brow: 0.9, blink: 0.2, open: 0.15 }, worried: { brow: -0.8, blink: 0.1 }, surprised: { open: 0.55, brow: -0.5 } });
const EXPRESSION_KEYS = ANIME_EXPRESSION_DEFS.map(([k]) => k);
export const ANIME_FACE_KEYS = ANIME_FACE.KEYS, ANIME_HAIR_KEYS = ANIME_HAIR.KEYS;
/** mojulo's anime BASES: the studio's design bases with these slider offsets (the operator's call, 2026-09-28: the chin
 * set back on everyone — the studio's male base carried its chin flush with the mouth). `1` in the face words is THIS
 * base; the port itself stays the studio's. */
export const ANIME_BASE_ADJUST = Object.freeze({ female: Object.freeze({ chinProjection: -0.2 }), male: Object.freeze({ chinProjection: -0.2 }) });
export const ANIME_PRESETS = Object.freeze(['female', 'male']);
/** the studio's default family per design base */
export const animeDefaultStyle = (preset) => animeFresh(preset).hair.style;

export const resolveAnimeFace = ANIME_FACE.resolve;
export const validateAnimeFace = (spec, label = 'face') => ANIME_FACE.validate(spec, label);
/** Advisory: each control against the studio's slider range for this design base (its `faceDefs`, widened by the base's
 * offset), the lift as the base's own plus the offset. */
export function animeFaceWarnings(resolved, preset = 'female') {
  if (!resolved) return [];
  const base = animeFresh(preset).face, adjust = ANIME_BASE_ADJUST[preset] ?? {}, out = [];
  for (const [k, , lo, hi] of animeFaceDefs(preset)) {
    const v = resolved[k]; if (v === undefined) continue;
    const slider = (k === 'tilt' ? base.tilt + v : base[k] + (v - 1)) + (adjust[k] ?? 0);
    if (slider < lo - 1e-9 || slider > hi + 1e-9) out.push(`face.${k} ${v} puts the studio's slider at ${r6(slider)}, outside its range [${r6(lo)}, ${r6(hi)}] for the ${preset} base: the head still builds, but the read past this is the operator's call`);
  }
  return out;
}

/** `'short'` | `{ style, length: 1.1, locks: { 'fringe-3': { ty: -0.05 } } }` | a list → `{ style|null, …controls, locks }`.
 * The family word is last-wins, the controls compose (ratios by product, offsets by sum), lock edits sum per key. */
export function resolveAnimeHair(spec) {
  const list = Array.isArray(spec) ? spec : [spec]; let style = null; const controls = []; const locks = {};
  for (const entry of list) {
    if (entry === undefined || entry === null) continue;
    let e = entry;
    if (typeof e === 'string') { if (!ANIME_HAIR_MOVES[e]) { style = e; continue; } e = ANIME_HAIR_MOVES[e].hair; }
    if (typeof e !== 'object') throw new Error('hair: an entry must be a family word, a hair trait or a control object');
    const { style: s, locks: L, ...rest } = e; if (typeof s === 'string') style = s; controls.push(rest);
    for (const [name, edit] of Object.entries(L || {})) { const cur = { ...(locks[name] ?? {}) }; for (const k of ANIME_LOCK_KEYS) if (edit?.[k] !== undefined) cur[k] = r6((cur[k] ?? 0) + edit[k]); locks[name] = cur; }
  }
  if (style !== null && !ANIME_HAIR_STYLES.includes(style)) throw new Error(`hair: unknown anime family '${style}' (have ${ANIME_HAIR_STYLES.join(', ')}; traits ${Object.keys(ANIME_HAIR_MOVES).join(', ')})`);
  const { from: _f, ...resolved } = ANIME_HAIR.resolve(controls);
  return { style, ...resolved, locks: Object.fromEntries(Object.entries(locks).sort(([a], [b]) => (a < b ? -1 : 1))) };
}
export function validateAnimeHair(spec, label = 'hair') {
  if (spec === undefined || spec === null) return [];
  const list = Array.isArray(spec) ? spec : [spec], errs = [];
  for (const [i, entry] of list.entries()) {
    const at = list.length > 1 ? `${label}[${i}]` : label;
    if (typeof entry === 'string') { if (!ANIME_HAIR_STYLES.includes(entry) && !ANIME_HAIR_MOVES[entry]) errs.push(`${at}: unknown anime family '${entry}' (have ${ANIME_HAIR_STYLES.join(', ')}; traits ${Object.keys(ANIME_HAIR_MOVES).join(', ')})`); continue; }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errs.push(`${at}: a family word (${ANIME_HAIR_STYLES.join(', ')}), a control object ({ style?, ${ANIME_HAIR_KEYS.join(', ')}, locks? }) or a list`); continue; }
    const { style, locks, ...rest } = entry;
    // a null family is the stored own layer's "none of its own" (a look's or the base's family stands)
    if (style !== undefined && style !== null && !ANIME_HAIR_STYLES.includes(style)) errs.push(`${at}.style: unknown anime family '${style}' (have ${ANIME_HAIR_STYLES.join(', ')})`);
    errs.push(...ANIME_HAIR.validate(rest, at));
    if (locks !== undefined) {
      if (!locks || typeof locks !== 'object' || Array.isArray(locks)) errs.push(`${at}.locks: an object of clump name → { ${ANIME_LOCK_KEYS.join(', ')} } (construction units)`);
      else for (const [name, edit] of Object.entries(locks)) {
        if (!ANIME_LOCK_RE.test(name)) { errs.push(`${at}.locks.${name}: not a clump (fringe-1…7, left-temple-0…2, right-temple-0…2, back-1…11, crown-1-0…2 / crown--1-0…2 on short)`); continue; }
        if (!edit || typeof edit !== 'object' || Array.isArray(edit)) { errs.push(`${at}.locks.${name}: { ${ANIME_LOCK_KEYS.join(', ')} } (control point and tip moves, construction units)`); continue; }
        for (const [k, v] of Object.entries(edit)) if (!ANIME_LOCK_KEYS.includes(k)) errs.push(`${at}.locks.${name}.${k}: not a lock edit (have ${ANIME_LOCK_KEYS.join(', ')})`); else if (typeof v !== 'number' || !Number.isFinite(v)) errs.push(`${at}.locks.${name}.${k}: must be a finite number`);
      }
    }
  }
  return errs;
}
/** Advisory: the controls outside the studio's ranges, lock edits past its ±0.2, and clumps the family does not grow. */
export function animeHairWarnings(resolved) {
  if (!resolved) return [];
  const out = ANIME_HAIR.warnings(resolved);
  for (const [name, edit] of Object.entries(resolved.locks || {})) {
    if (/^crown-/.test(name) && resolved.style !== 'short') out.push(`hair.locks.${name}: only the short family grows crown clumps; the edit has no effect on '${resolved.style}'`);
    for (const [k, v] of Object.entries(edit)) if (Math.abs(v) > 0.2) out.push(`hair.locks.${name}.${k} ${v} is past the studio's ±0.2: the clump still builds, but its root may no longer lead it`);
  }
  return out;
}
export const describeAnimeHair = (resolved) => { const d = ANIME_HAIR.describe(resolved), n = Object.keys(resolved.locks || {}).length; return `${resolved.style}${d ? ` (${d.replace(/^hair /, '')})` : ''}${n ? `, ${n} clump${n === 1 ? '' : 's'} directed` : ''}`; };

/** `'smile'` | `{ open: 0.4 }` | `['smile', { brow: -0.2 }]` → the four amounts; a pose word resets, an object adjusts */
export function resolveAnimeExpression(spec) {
  const out = Object.fromEntries(EXPRESSION_KEYS.map((k) => [k, 0]));
  for (const entry of (Array.isArray(spec) ? spec : [spec])) {
    if (entry === undefined || entry === null) continue;
    if (typeof entry === 'string') { if (!ANIME_POSES[entry]) throw new Error(`expression: unknown anime pose '${entry}' (have ${Object.keys(ANIME_POSES).join(', ')})`); for (const k of EXPRESSION_KEYS) out[k] = ANIME_POSES[entry][k] ?? 0; continue; }
    for (const k of EXPRESSION_KEYS) if (entry[k] !== undefined) out[k] = entry[k];
  }
  return out;
}
export function validateAnimeExpression(spec, label = 'expression') {
  if (spec === undefined || spec === null) return [];
  const errs = [];
  for (const [i, entry] of (Array.isArray(spec) ? spec : [spec]).entries()) {
    const at = Array.isArray(spec) ? `${label}[${i}]` : label;
    if (typeof entry === 'string') { if (!ANIME_POSES[entry]) errs.push(`${at}: unknown anime pose '${entry}' (have ${Object.keys(ANIME_POSES).join(', ')})`); continue; }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errs.push(`${at}: a pose (${Object.keys(ANIME_POSES).join(', ')}), amounts { ${EXPRESSION_KEYS.join(', ')} } or a list`); continue; }
    for (const [k, v] of Object.entries(entry)) if (!EXPRESSION_KEYS.includes(k)) errs.push(`${at}.${k}: not an expression amount (have ${EXPRESSION_KEYS.join(', ')})`); else if (typeof v !== 'number' || !Number.isFinite(v)) errs.push(`${at}.${k}: must be a finite number`);
  }
  return errs;
}
export function animeExpressionWarnings(resolved) {
  const out = [];
  for (const [k, , lo, hi] of ANIME_EXPRESSION_DEFS) if (resolved?.[k] !== undefined && (resolved[k] < lo || resolved[k] > hi)) out.push(`expression.${k} ${resolved[k]} is outside the studio's [${lo}, ${hi}]`);
  return out;
}

/** The studio recipe these words make: the design base (with mojulo's base adjustments), each face value as the studio's
 * slider (base + (v − 1); the lift as base + offset), the hair family and controls, the four amounts and the lock edits
 * (missing axes 0). The result is a recipe the studio itself loads. */
export function animeRecipe({ preset = 'female', face = {}, hair = {}, expression = {} } = {}) {
  if (!ANIME_PRESETS.includes(preset)) throw new Error(`anime head: unknown design base '${preset}' (have ${ANIME_PRESETS.join(', ')})`);
  const r = animeFresh(preset), F = resolveAnimeFace(face), H = hair && typeof hair === 'object' && !Array.isArray(hair) && 'locks' in hair && 'volume' in hair ? hair : resolveAnimeHair(hair), E = expression && typeof expression === 'object' && !Array.isArray(expression) && EXPRESSION_KEYS.every((k) => k in expression) ? expression : resolveAnimeExpression(expression);
  const adjust = ANIME_BASE_ADJUST[preset] ?? {};
  for (const k of ANIME_FACE_KEYS) r.face[k] = (k === 'tilt' ? r.face.tilt + F.tilt : r.face[k] + (F[k] - 1)) + (adjust[k] ?? 0);
  r.hair.style = H.style ?? r.hair.style;
  for (const k of ANIME_HAIR_KEYS) if (k !== 'strands' && (k !== 'ahoge' || H.ahoge)) r.hair[k] = H[k];   // the studio's recipe shape unless an ahoge grows; `strands` is how it is built, not what
  for (const k of EXPRESSION_KEYS) r.expression[k] = E[k];
  r.locks = Object.fromEntries(Object.entries(H.locks || {}).map(([name, e]) => [name, Object.fromEntries(ANIME_LOCK_KEYS.map((k) => [k, e[k] ?? 0]))]));
  return r;
}

// ─── the geometry ─────────────────────────────────────────────────────────
const TOL = 1e-7;   // weld tolerance, studio units
/** flat triangle soup [x,y,z × 3 …] (a range of it) → triangles */
const trisOf = (flat, start = 0, end = flat.length) => { const out = []; for (let i = start; i < end; i += 9) out.push([flat.slice(i, i + 3), flat.slice(i + 3, i + 6), flat.slice(i + 6, i + 9)]); return out; };
/** weld coincident corners (within TOL) and drop triangles that collapse; `labels` ride per triangle */
function weld(tris, labels) {
  const points = [], grid = new Map(), faces = [], groups = [];
  const cell = (v) => v.map((x) => Math.round(x / TOL / 10));
  const idOf = (p) => {
    const c = cell(p);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const i of grid.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) || []) { const q = points[i]; if (Math.abs(q[0] - p[0]) <= TOL && Math.abs(q[1] - p[1]) <= TOL && Math.abs(q[2] - p[2]) <= TOL) return i; }
    }
    const key = c.join(','); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(points.length); points.push(p); return points.length - 1;
  };
  tris.forEach((t, n) => { const f = t.map(idOf); if (f[0] !== f[1] && f[1] !== f[2] && f[0] !== f[2]) { faces.push(f); groups.push(labels?.[n]); } });
  return { points, faces, groups };
}
/** Zip hairline cracks: boundary corners within `tol` of another boundary corner (that is not its edge neighbour) merge at
 * their midpoint. The studio's front and back shells miss each other along the lower jaw seam by up to ~0.0015 units (a
 * front-only term — the dip around the mouth — does not vanish at the seam where the face is narrow); its renderer is
 * double-sided and never shows it. Moves nothing else. */
function zip(m, tol) {
  const count = new Map(); for (const f of m.faces) for (let k = 0; k < 3; k++) { const e = edgeKey(f[k], f[(k + 1) % 3]); count.set(e, (count.get(e) || 0) + 1); }
  const bEdges = [...count].filter(([, n]) => n === 1).map(([e]) => e.split('|').map(Number));
  if (!bEdges.length) return m;
  const nbr = new Map(); for (const [a, b] of bEdges) { for (const [x, y] of [[a, b], [b, a]]) { if (!nbr.has(x)) nbr.set(x, new Set()); nbr.get(x).add(y); } }
  const verts = [...nbr.keys()], parent = new Map(verts.map((v) => [v, v])), find = (v) => { while (parent.get(v) !== v) v = parent.get(v); return v; };
  for (const a of verts) {
    let best = null, bd = tol;
    for (const b of verts) { if (b === a || nbr.get(a).has(b)) continue; const d = Math.hypot(...vsub(m.points[a], m.points[b])); if (d <= bd) { bd = d; best = b; } }
    if (best !== null) { const ra = find(a), rb = find(best); if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb)); }
  }
  const groupsOfRoot = new Map(); for (const v of verts) { const r = find(v); if (!groupsOfRoot.has(r)) groupsOfRoot.set(r, []); groupsOfRoot.get(r).push(v); }
  for (const [r, members] of groupsOfRoot) if (members.length > 1) m.points[r] = vmul(members.reduce((s, v) => vadd(s, m.points[v]), [0, 0, 0]), 1 / members.length);
  const faces = [], groups = [];
  m.faces.forEach((f, i) => { const g = f.map((v) => (parent.has(v) ? find(v) : v)); if (g[0] !== g[1] && g[1] !== g[2] && g[0] !== g[2]) { faces.push(g); groups.push(m.groups[i]); } });
  return { points: m.points, faces, groups };
}
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vunit = (a) => { const l = Math.hypot(...a) || 1; return vmul(a, 1 / l); };
const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** edge-connected components, each re-indexed onto its own points */
function components(mesh) {
  const byEdge = new Map(); mesh.faces.forEach((f, i) => { for (let k = 0; k < 3; k++) { const e = edgeKey(f[k], f[(k + 1) % 3]); if (!byEdge.has(e)) byEdge.set(e, []); byEdge.get(e).push(i); } });
  const seen = new Array(mesh.faces.length).fill(false), out = [];
  for (let s = 0; s < mesh.faces.length; s++) {
    if (seen[s]) continue; const stack = [s], members = []; seen[s] = true;
    while (stack.length) { const i = stack.pop(); members.push(i); const f = mesh.faces[i]; for (let k = 0; k < 3; k++) for (const j of byEdge.get(edgeKey(f[k], f[(k + 1) % 3]))) if (!seen[j]) { seen[j] = true; stack.push(j); } }
    members.sort((a, b) => a - b);
    const remap = new Map(), points = [], faces = [], groups = [];
    for (const i of members) { faces.push(mesh.faces[i].map((v) => { if (!remap.has(v)) { remap.set(v, points.length); points.push(mesh.points[v]); } return remap.get(v); })); groups.push(mesh.groups[i]); }
    out.push({ points, faces, groups });
  }
  return out;
}
/** propagate one winding across shared edges (a flipped neighbour is turned) — the studio drew double-sided */
function orientConsistently(mesh) {
  const byEdge = new Map(); mesh.faces.forEach((f, i) => { for (let k = 0; k < 3; k++) { const e = edgeKey(f[k], f[(k + 1) % 3]); if (!byEdge.has(e)) byEdge.set(e, []); byEdge.get(e).push(i); } });
  const done = new Array(mesh.faces.length).fill(false);
  const has = (f, a, b) => { for (let k = 0; k < 3; k++) if (f[k] === a && f[(k + 1) % 3] === b) return true; return false; };
  for (let s = 0; s < mesh.faces.length; s++) {
    if (done[s]) continue; done[s] = true; const stack = [s];
    while (stack.length) {
      const i = stack.pop(), f = mesh.faces[i];
      for (let k = 0; k < 3; k++) { const a = f[k], b = f[(k + 1) % 3];
        for (const j of byEdge.get(edgeKey(a, b))) { if (done[j]) continue; const g = mesh.faces[j]; if (has(g, a, b)) mesh.faces[j] = [g[0], g[2], g[1]]; done[j] = true; stack.push(j); } }
    }
  }
  return mesh;
}
const signedVolume = (m) => m.faces.reduce((s, [a, b, c]) => s + vdot(m.points[a], vcross(m.points[b], m.points[c])), 0) / 6;
const faceNormal = (m, [a, b, c]) => vcross(vsub(m.points[b], m.points[a]), vsub(m.points[c], m.points[a]));
const boundaryEdges = (m) => { const count = new Map(); for (const f of m.faces) for (let k = 0; k < 3; k++) { const e = edgeKey(f[k], f[(k + 1) % 3]); count.set(e, (count.get(e) || 0) + 1); } return [...count].filter(([, n]) => n === 1).map(([e]) => e); };
const flipAll = (m) => { m.faces = m.faces.map(([a, b, c]) => [a, c, b]); return m; };
/** a closed mesh turned outward (positive volume); an open one turned so its area-weighted normal faces `outward` */
function outward(m, dir) {
  if (!boundaryEdges(m).length) { if (signedVolume(m) < 0) flipAll(m); return m; }
  const n = m.faces.reduce((s, f) => vadd(s, faceNormal(m, f)), [0, 0, 0]);
  if (vdot(n, dir) < 0) flipAll(m); return m;
}
/** An open, oriented, outward patch closed as a slab: a back sheet `depth` behind it (along −its vertex normals, or −`along`
 * when given: one direction for a lens or ribbon), reversed, and a side band along every boundary edge. */
function solidify(m, depth, along) {
  const n = m.points.length, normals = m.points.map(() => [0, 0, 0]);
  for (const f of m.faces) { const fn = faceNormal(m, f); for (const v of f) normals[v] = vadd(normals[v], fn); }
  const back = m.points.map((p, i) => vsub(p, vmul(along ? along : vunit(normals[i]), depth)));
  const faces = [...m.faces], groups = [...m.groups];
  for (const [a, b, c] of m.faces) { faces.push([c + n, b + n, a + n]); groups.push(m.groups[0]); }
  const has = (f, a, b) => { for (let k = 0; k < 3; k++) if (f[k] === a && f[(k + 1) % 3] === b) return true; return false; };
  const bset = new Set(boundaryEdges(m));
  for (const f of m.faces) for (let k = 0; k < 3; k++) {
    const a = f[k], b = f[(k + 1) % 3]; if (!bset.has(edgeKey(a, b)) || !has(f, a, b)) continue;
    faces.push([b, a, a + n], [b, a + n, b + n]); groups.push(m.groups[0], m.groups[0]);
  }
  return { points: [...m.points, ...back], faces, groups };
}
const centroid = (m) => vmul(m.points.reduce(vadd, [0, 0, 0]), 1 / m.points.length);

// The core carrier: an ellipsoid inside the skull, 16 slots mirrored by name, the rig binds it to the head bone.
const CORE_SLOTS = ['front', 'f1R', 'f2R', 'f3R', 'sideR', 'b3R', 'b2R', 'b1R', 'back', 'b1L', 'b2L', 'b3L', 'sideL', 'f3L', 'f2L', 'f1L'];
function coreCarrier(c, r) {
  const Z = [-0.8, -0.5, -0.15, 0.2, 0.55, 0.82];
  const stations = Z.map((z, i) => {
    const k = Math.sqrt(1 - z * z), points = {};
    CORE_SLOTS.forEach((slot, j) => { const a = j / CORE_SLOTS.length * 2 * Math.PI; points[slot] = [r6(c[0] + Math.sin(a) * r[0] * k), r6(c[1] + Math.cos(a) * r[1] * k), r6(c[2] + z * r[2])]; });
    points.front[0] = 0; points.back[0] = 0;
    return { id: `st${i}`, points };
  });
  return { layer: 1, closure: 'closed', slots: CORE_SLOTS, stations, group: 'Skin', caps: { back: [0, r6(c[1]), r6(c[2] - 0.97 * r[2])], tip: [0, r6(c[1]), r6(c[2] + 0.97 * r[2])] } };
}

/** The COVERAGE ledger (hair-passes): how much of the scalp — the skin above the studio's hairline — still shows through
 * the hair, per view (back, lateral, the rear three-quarter, top): the scalp's pixels with the hair on over its pixels
 * bald, through one camera per view. 0 is covered. Advice, never a refusal. `parts` the head's parts, `scalp` the face
 * part's scalp face ids. */
export const COVERAGE_VIEWS = Object.freeze({ back: [0, 8], lateral: [90, 8], 'rear-three-quarter': [45, 12], top: [0, 70] });
export function animeHairCoverage(parts, scalp, { res = 160 } = {}) {
  const withHair = compileLayered({ parts, dials: {}, creases: {} });
  const baldParts = Object.fromEntries(Object.entries(parts).filter(([k]) => !k.startsWith('hair')));
  const bald = compileLayered({ parts: baldParts, dials: {}, creases: {} });
  const scalpSet = (m) => { const want = new Set(scalp.map((f) => `face/${f}`)); return new Set(m.faceIds.flatMap((id, i) => (want.has(id) ? [i] : []))); };
  const A = scalpSet(withHair), B = scalpSet(bald), views = {};
  for (const [view, [az, el]] of Object.entries(COVERAGE_VIEWS)) {
    const cam = viewCamera(withHair, az, { elevationDegrees: el, size: res });
    const count = (m, set) => { const f = rasterDepth(m, cam, res).face; let n = 0; for (let i = 0; i < f.length; i++) if (f[i] >= 0 && set.has(f[i])) n++; return n; };
    const shown = count(withHair, A), total = count(bald, B);
    views[view] = total ? Math.round(shown / total * 1000) / 1000 : 0;
  }
  const worst = Object.entries(views).sort((a, b) => b[1] - a[1])[0];
  return { views, worst: { view: worst[0], share: worst[1] } };
}
/** the ledger's advice: a view where more than `threshold` of the scalp shows */
export const animeCoverageWarnings = (cov, threshold = 0.05) => (cov ? Object.entries(cov.views).filter(([, v]) => v > threshold).map(([view, v]) => `hair: the scalp shows from the ${view} (${Math.round(v * 100)} % of it): raise hair.volume, lengthen the family, or direct a clump over it`) : []);

/** the studio's colours (its inspection palette), the operator's skin and hair over them */
export function animePalette(skin = '#dbd1bd', hair = '#424f59', overrides = {}) {
  return { Skin: skin, Sclera: '#faf7eb', Iris: '#4d6b6e', Pupil: '#12171a', Ink: '#292e33', Mouth: '#3d2124', Hair: hair, ...overrides };
}
const LOCK_PART = (name) => {
  let m = name.match(/^fringe-(\d+)$/); if (m) return `hairFringe${m[1]}`;
  m = name.match(/^(left|right)-temple-(\d)$/); if (m) return `hairTemple${m[1] === 'left' ? 'L' : 'R'}${m[2]}`;
  m = name.match(/^back-(\d+)$/); if (m) return `hairBack${m[1]}`;
  m = name.match(/^crown-(-?1)-(\d)$/); if (m) return `hairCrown${m[1] === '-1' ? 'L' : 'R'}${m[2]}`;
  if (name === 'ahoge') return 'hairAhoge';
  if (/^form[A-Z]/.test(name)) return `hair${name[0].toUpperCase()}${name.slice(1)}`;   // a consolidated section: formBackC → hairFormBackC
  throw new Error(`anime head: unknown clump '${name}'`);
};
/** the part a studio clump becomes (`fringe-3` → `hairFringe3`, `left-temple-0` → `hairTempleL0`, `crown--1-2` → `hairCrownL2`) */
export const animeLockPart = LOCK_PART;

/**
 * The anime head, ready to wear.
 * @param {object} o
 *   preset      'female' | 'male' — the studio's design base
 *   face        the FACE words (a move, a ratio object over the studio's controls, a list); 1 = the base
 *   hair        a family word, `{ style, …controls, locks }` or a list; `'none'` wears no hair
 *   expression  a pose word, amounts `{ blink, smile, open, brow }` or a list
 *   register    'lowpoly' (the studio's coarse sampling) | anything else (its full sampling)
 *   scale       the head's uniform scale (its core, pin-local offsets and anchors together)
 *   skin, hairColor, palette  colours (`Skin`, `Hair` and the studio's groups)
 * @returns the landmark head's include shape: { name, parts, dials, creases, palette, bind, joints, chinZ, hair,
 *   hairMeasures, face, expression, preset, register, scale, landmarks, recipe, measures }
 */
export function animeHead({ preset = 'female', face = {}, hair, expression = 'neutral', register = 'round', scale = 1, skin, hairColor, palette = {}, hairFit = true } = {}) {
  if (!ANIME_PRESETS.includes(preset)) throw new Error(`anime head: unknown design base '${preset}' (have ${ANIME_PRESETS.join(', ')})`);
  if (!(Number.isFinite(scale) && scale > 0)) throw new Error('anime head: scale must be positive');
  const bald = hair === 'none';
  for (const [spec, errs] of [[face, validateAnimeFace(face)], [bald ? null : hair, validateAnimeHair(bald ? null : hair)], [expression, validateAnimeExpression(expression)]]) if (errs.length) throw new Error(`anime head: ${errs.join('; ')}`);
  const F = resolveAnimeFace(face), H = resolveAnimeHair(bald ? null : hair ?? null), E = resolveAnimeExpression(expression);
  if (H.style === null) H.style = animeDefaultStyle(preset);
  const recipe = animeRecipe({ preset, face: F, hair: H, expression: E });
  // the hair seats on the head it grows on (anime-form `fitHair`); `hairFit: false` is the studio's own cap and clumps
  // the bob, long and hime families consolidate their clumps into sections (anime-form `forms`); `strands: 1` keeps the
  // studio's separate clumps
  const model = buildAnime(recipe, { coarse: register === 'lowpoly', weld: true, fitHair: hairFit, forms: !(H.strands > 0) });

  // registration: the studio's pitched head → hero metres, by the fitted heads' numbers for this pole
  const skinFlat = model.parts.skin, faceEnd = model.ears.start;
  let yLo = Infinity, yHi = -Infinity, zLo = Infinity, zHi = -Infinity;
  for (let i = 0; i < faceEnd; i += 3) { const y = skinFlat[i + 1], z = skinFlat[i + 2]; if (y < yLo) yLo = y; if (y > yHi) yHi = y; if (z < zLo) zLo = z; if (z > zHi) zHi = z; }
  const R = REGISTRATION[preset], S = R.height / (yHi - yLo), TZ = R.menton - S * yLo, TY = R.midY - S * (-zLo + -zHi) / 2;
  const toM = (p) => [p[0] * S, -p[2] * S + TY, p[1] * S + TZ];
  const meshOf = (tris, labels) => { const m = weld(tris, labels); m.points = m.points.map(toM); return m; };

  // the parts, each closed and outward, in hero metres (before the head's scale)
  const meshes = {}, H0 = [0, R.midY, R.menton + R.height * 0.55];   // a point inside the skull, for "outward" on open patches
  const faceTris = [...trisOf(skinFlat, 0, faceEnd), ...trisOf(model.parts.sclera), ...trisOf(model.parts.mouth)];
  const faceLabels = [...trisOf(skinFlat, 0, faceEnd).map(() => 'Skin'), ...trisOf(model.parts.sclera).map(() => 'Sclera'), ...trisOf(model.parts.mouth).map(() => 'Mouth')];
  const welded = weld(faceTris, faceLabels);
  meshes.face = zip(welded, 0.003);
  // the SCALP: skin faces above the studio's hairline (measured unpitched), for the coverage ledger
  const unpitch = (p) => { const c = Math.cos(-model.pitch), sn = Math.sin(-model.pitch), y = p[1] - model.pivot[1], z = p[2] - model.pivot[2]; return [p[0], model.pivot[1] + c * y - sn * z, model.pivot[2] + sn * y + c * z]; };
  const hairlineY = (a) => 0.10 + 0.43 * Math.max(0, Math.cos(a)) - 0.48 * Math.max(0, -Math.cos(a));
  const scalp = meshes.face.faces.flatMap((f, i) => { if (meshes.face.groups[i] !== 'Skin') return []; const c = unpitch(vmul(f.reduce((acc, v) => vadd(acc, meshes.face.points[v]), [0, 0, 0]), 1 / 3)); return c[1] > hairlineY(Math.atan2(c[0], -(c[2] - 0.07))) + 0.02 ? [`f${i}`] : []; });
  meshes.face.points = meshes.face.points.map(toM);
  meshes.face = outward(orientConsistently(meshes.face), [0, 1, 0]);
  for (const ear of components(meshOf(trisOf(skinFlat, model.ears.start, model.ears.end), null))) { const m = outward(orientConsistently(ear)); m.groups = m.groups.map(() => 'Skin'); meshes[centroid(m)[0] > 0 ? 'earR' : 'earL'] = m; }
  const lens = (part, group, depth) => {
    for (const c of components(meshOf(trisOf(model.parts[part]), null))) {
      const o = orientConsistently(c); o.groups = o.groups.map(() => group);
      const out = vunit(vsub(centroid(o), H0)); outward(o, out);
      const n = vunit(o.faces.reduce((s, f) => vadd(s, faceNormal(o, f)), [0, 0, 0]));
      meshes[`${part}${centroid(o)[0] > 0 ? 'R' : 'L'}`] = solidify(o, depth, n);
    }
  };
  lens('iris', 'Iris', 0.0015 * S); lens('pupil', 'Pupil', 0.0012 * S);
  // the ink: per side the brow (highest), the upper lash and the lower rim (lowest), each a slab behind its ribbon
  const ink = components(meshOf(trisOf(model.parts.ink), null)).map((c) => { const o = orientConsistently(c); o.groups = o.groups.map(() => 'Ink'); outward(o, vunit(vsub(centroid(o), H0))); return o; });
  for (const side of ['R', 'L']) {
    const mine = ink.filter((m) => (centroid(m)[0] > 0) === (side === 'R')).sort((a, b) => centroid(b)[2] - centroid(a)[2]);
    mine.forEach((m, i) => { const n = vunit(m.faces.reduce((s, f) => vadd(s, faceNormal(m, f)), [0, 0, 0])); meshes[`${['brow', 'lash', 'lashLow'][i] ?? `ink${i}`}${side}`] = solidify(m, 0.004 * S, n); });
  }
  if (!bald) {
    const cap = orientConsistently(meshOf(trisOf(model.parts.hair, model.cap.start, model.cap.end), null)); cap.groups = cap.groups.map(() => 'Hair');
    outward(cap, [0, 0, 1]); meshes.hairCap = solidify(cap, 0.03 * S);
    for (const lk of model.locks) { if (!lk.count) continue; const m = outward(orientConsistently(meshOf(trisOf(model.parts.hair, lk.start, lk.start + lk.count), null))); m.groups = m.groups.map(() => 'Hair'); meshes[LOCK_PART(lk.name)] = m; }
  }

  // the core carrier: inside the skull (the face's box, shrunk well inside the cranium), bound to the head bone
  const fp = meshes.face.points, lo = [0, 1, 2].map((k) => Math.min(...fp.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...fp.map((p) => p[k])));
  const core = coreCarrier([0, (lo[1] + hi[1]) / 2 - 0.08 * (hi[1] - lo[1]), lo[2] + 0.62 * (hi[2] - lo[2])], [0.26 * (hi[0] - lo[0]), 0.22 * (hi[1] - lo[1]), 0.2 * (hi[2] - lo[2])]);
  const parts = { cranium: core };
  const carrier = compileLayered({ parts: { cranium: core }, dials: {}, creases: {} }).parts;
  const pin = address(carrier, 'cranium', 3.5, 4, 'R'), frame = pinFrame(carrier.cranium, pin);
  const groupsOf = (m) => { const g = m.groups.map((x) => x ?? 'Skin'); return g.every((x) => x === g[0]) ? { group: g[0] } : { group: g[0], groups: Object.fromEntries(g.map((x, i) => [`f${i}`, x])) }; };
  for (const [name, m] of Object.entries(meshes)) {
    const { group, groups } = groupsOf(m);
    parts[name] = { layer: 2, closure: 'closed', pin, group,
      offsets: Object.fromEntries(m.points.map((p, i) => [`v${i}`, surfaceLocalOffset(frame, p).map(r6)])),
      faces: Object.fromEntries(m.faces.map((f, i) => [`f${i}`, f.map((v) => `v${v}`)])), ...(groups ? { groups } : {}) };
  }

  // anchors and measures, off the built parts (hero metres, before the scale)
  const all = (m) => m.points, bboxOf = (pts) => ({ lo: [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), hi: [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k]))) });
  const skinPts = meshes.face.points, crown = skinPts.reduce((b, p) => (p[2] > b[2] ? p : b)), menton = skinPts.reduce((b, p) => (p[2] < b[2] ? p : b));
  const noseTip = skinPts.filter((p) => Math.abs(p[0]) < 0.004).reduce((b, p) => (p[1] > b[1] ? p : b)), occiput = skinPts.reduce((b, p) => (p[1] < b[1] ? p : b));
  const groupPts = (g) => meshes.face.faces.flatMap((f, i) => (meshes.face.groups[i] === g ? f.map((v) => skinPts[v]) : []));
  const scleraR = groupPts('Sclera').filter((p) => p[0] > 0), mouthPts = groupPts('Mouth');
  const eyeR = meshes.irisR ? centroid(meshes.irisR) : centroid({ points: scleraR }), eyeL = [-eyeR[0], eyeR[1], eyeR[2]];
  const eyeBox = bboxOf(scleraR), faceBox = bboxOf(skinPts);
  const landmarks = { crown, menton, noseTip, occiput, stomion: centroid({ points: mouthPts }), eyeR, eyeL, ...(meshes.browR ? { browR: centroid(meshes.browR), browL: centroid(meshes.browL) } : {}), ...(meshes.earR ? { earR: centroid(meshes.earR), earL: centroid(meshes.earL) } : {}) };
  let hairMeasures = null;
  if (!bald) {
    const hp = Object.entries(meshes).filter(([k]) => k.startsWith('hair')).flatMap(([, m]) => all(m)), r3 = (x) => Math.round(x * scale * 1000) / 1000;
    hairMeasures = { top_m: r3(Math.max(...hp.map((p) => p[2])) - crown[2]), hem_m: r3(Math.min(...hp.map((p) => p[2])) - menton[2]), back_m: r3(occiput[1] - Math.min(...hp.map((p) => p[1]))), parts: Object.keys(meshes).filter((k) => k.startsWith('hair')).length };
  }
  const hairCoverage = bald ? null : animeHairCoverage(parts, scalp);
  const r3 = (x) => Math.round(x * scale * 1000) / 1000;
  const measures = { head_m: r3(crown[2] - menton[2]), crown_z: r3(crown[2]), face_m: r3(faceBox.hi[0] - faceBox.lo[0]), depth_m: r3(faceBox.hi[1] - faceBox.lo[1]), pupils_m: r3(2 * eyeR[0]), eye_m: r3(eyeBox.hi[2] - eyeBox.lo[2]), eyeWidth_m: r3(eyeBox.hi[0] - eyeBox.lo[0]) };

  // the head's scale, once: the core, the pin-local offsets and the anchors together
  if (scale !== 1) for (const p of Object.values(parts)) {
    if (p.layer === 1) { for (const st of p.stations) for (const [k, v] of Object.entries(st.points)) st.points[k] = v.map((x) => r6(x * scale)); for (const [k, v] of Object.entries(p.caps)) p.caps[k] = v.map((x) => r6(x * scale)); }
    else for (const [k, v] of Object.entries(p.offsets)) p.offsets[k] = v.map((x) => r6(x * scale));
  }
  const sc = (p) => p.map((x) => r6(x * scale));
  return { name: 'head', parts, dials: {}, creases: {}, palette: animePalette(skin, hairColor, palette), bind: { cranium: 'head' }, joints: {},
    chinZ: r6(menton[2] * scale), preset, register, scale, face: F, hair: bald ? { style: 'none' } : H, hairMeasures, hairCoverage, scalp, expression: E, recipe,
    landmarks: Object.fromEntries(Object.entries(landmarks).map(([k, p]) => [k, sc(p)])), measures };
}
