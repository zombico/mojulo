/**
 * western-face-rig — the landmark (western) hero's FACE AS BLEND SHAPES: its expression channels (humanoid-head
 * WESTERN_CHANNELS: blink, aperture, mouthCorner, browRaise, browTilt) as morph targets an engine plays, differenced from
 * constant-topology builds of the same head with only the expression changed. The anime head's rig (anime-face-rig.js)
 * is the pattern; the western head differs in two ways:
 *   • ITS EXPRESSIONS MOVE THE SKIN: mouthCorner lifts the cheeks and browRaise the brow's skin (humanoid-head's cranium
 *     weights), and every feature rides that skin by its pin. So the cranium is differenced too, and each build is the
 *     whole bald head placed as the plan places it (its L1 at the include's shift, its pins riding).
 *   • ITS CHANNELS ARE LINEAR in the head's points (an oval's height, a strip's offset, a weighted skin lift), so a target
 *     is one build at a channel's range end and a channel's value is its weight; no in-between correctives. Each signed
 *     channel is two targets (a mouth corner's lift and drop differ: the lift also brings the cheek forward). The blink
 *     and the aperture compose exactly: the eye's height is aperture·(1 − blink) + 0.05·blink, so with `blink` at s the
 *     aperture's target weighs (a − 1)(1 − s) over its range end.
 *
 *   THE TARGETS (WESTERN_FACE_TARGETS, on the NEUTRAL head): blink, blinkLeft, blinkRight (one eye: a smoothstep across
 *   the midline, Left the figure's left, mesh −x), eyeWide (aperture 1.4), eyeSquint (0.5), smile (mouthCorner +0.01),
 *   frown (−0.006), browRaise (+0.015), browLower (−0.01), browAngry (browTilt +0.012: the inner ends down), browWorried
 *   (−0.012). jawOpen is the jaw BONE (the clip key's `jaw`), never a target.
 *   THE EYES ARE DRAWN as the anime face's are (the tracks hold drawings at 30 fps): an eye shows at a knot
 *   (WESTERN_EYE_KNOTS, and the hero's own closure), so the ambient blink and a key's eyes read as the anime hero's do.
 *   GUARDS: the build at the hero's own expression, placed, must be the parts the row stores (every head part but the
 *   hair), and every build keeps the neutral one's faces; else the face is skipped with its reason.
 * westernFaceRig hands the rig pack the same ROW per figure vertex as heroFaceRig (the rebase, then each target).
 * Pure and deterministic; cached per head.
 */
import { compileLayered } from './station-loft.js';
import { landmarkHeadAt } from './humanoid-plan.js';
import { EXPRESSIONS, CHANNEL_RANGES, resolveWesternExpression } from './humanoid-head.js';
import { tieredFace, tieredPole } from './tiered-form.js';
import { FACE_FPS, drawEye } from './anime-face-rig.js';
import { r6 } from './station-loft-plan.js';

export const WESTERN_FACE_TARGETS = Object.freeze(['blink', 'blinkLeft', 'blinkRight', 'eyeWide', 'eyeSquint', 'smile', 'frown', 'browRaise', 'browLower', 'browAngry', 'browWorried']);
/** the knots an eye is drawn at (the tracks' in-betweens, 0.5 and 0.2, among them) */
export const WESTERN_EYE_KNOTS = Object.freeze([0, 0.2, 0.5, 1]);
const R = CHANNEL_RANGES;
/** the builds the targets are differenced from: each one channel at its range end over neutral */
const BUILDS = Object.freeze({ neutral: {}, blink: { blink: 1 }, eyeWide: { aperture: R.aperture[1] }, eyeSquint: { aperture: R.aperture[0] },
  smile: { mouthCorner: R.mouthCorner[1] }, frown: { mouthCorner: R.mouthCorner[0] }, browRaise: { browRaise: R.browRaise[1] }, browLower: { browRaise: R.browRaise[0] },
  browAngry: { browTilt: R.browTilt[1] }, browWorried: { browTilt: R.browTilt[0] } });
const at = (ch) => resolveWesternExpression({ ...ch });

/** a western expression's channels → the face state the tracks draw (the closure per eye; jawOpen is the bone's) */
export const westernState = (c) => ({ eyeL: c.blink ?? 0, eyeR: c.blink ?? 0, aperture: c.aperture ?? 1, mouthCorner: c.mouthCorner ?? 0, browRaise: c.browRaise ?? 0, browTilt: c.browTilt ?? 0 });
const pos = (x, end) => Math.max(0, x / end);
/** a face state → its weights in WESTERN_FACE_TARGETS' order (`knots`: each eye drawn at its nearest) */
export function westernWeights(F, knots = WESTERN_EYE_KNOTS) {
  const eL = drawEye(F.eyeL, knots), eR = drawEye(F.eyeR, knots), b = Math.min(eL, eR), a = F.aperture, open = 1 - b;
  const w = { blink: b, blinkLeft: eL - b, blinkRight: eR - b,
    eyeWide: pos((a - 1) * open, R.aperture[1] - 1), eyeSquint: pos((1 - a) * open, 1 - R.aperture[0]),
    smile: pos(F.mouthCorner, R.mouthCorner[1]), frown: pos(-F.mouthCorner, -R.mouthCorner[0]),
    browRaise: pos(F.browRaise, R.browRaise[1]), browLower: pos(-F.browRaise, -R.browRaise[0]),
    browAngry: pos(F.browTilt, R.browTilt[1]), browWorried: pos(-F.browTilt, -R.browTilt[0]) };
  return WESTERN_FACE_TARGETS.map((n) => +w[n].toFixed(6));
}
/** The knots and the weighing the tracks use for a western hero (anime-face-tracks K): its own closure is a knot too */
export function westernKnots(authored) {
  const a = authored?.blink ?? 0, eyeKnots = a > 0 && a < 1 && !WESTERN_EYE_KNOTS.includes(a) ? [...WESTERN_EYE_KNOTS, a].sort((x, y) => x - y) : [...WESTERN_EYE_KNOTS];
  return { own: null, eyeKnots, fixKnots: [], targets: [...WESTERN_FACE_TARGETS], state: westernState, resolve: resolveWesternExpression, weigh: (F) => westernWeights(F, eyeKnots) };
}
/** every expression word's weights (EXPRESSIONS, in its order), then the hero's own */
export function westernWords(authored) {
  const K = westernKnots(authored);
  return Object.fromEntries([...Object.keys(EXPRESSIONS).map((w) => [w, K.weigh(westernState(EXPRESSIONS[w]))]), ['authored', K.weigh(westernState(authored))]]);
}

/** The head words a landmark hero's plan wears its head with (layered heroFormPlan's landmark branch; the tiered form's
 * face words and features) and its expression channels — read from the record, never stored. */
export function westernRigOptions(hero) {
  const h = hero.form === 'tiered' ? tieredFace(hero, tieredPole(hero)) : hero;
  const opts = { preset: hero.cast, register: hero.register, tune: hero.tune, headScale: hero.headScale, face: h.face ?? {}, ...(h.faceFeatures ? { features: h.faceFeatures } : {}), ...(hero.headPreset ? { headPreset: hero.headPreset } : {}), ...(hero.proportions ? { proportions: hero.proportions } : {}) };
  return { opts, authored: resolveWesternExpression(hero.expression ?? 'neutral') };
}

const MIDLINE = 0.004;
const wRight = (x) => { const t = Math.min(1, Math.max(0, (x + MIDLINE) / (2 * MIDLINE))); return t * t * (3 - 2 * t); };
const STALE = 'the stored head is not the head this hero builds now: regenerate the row (any /hero edit)';
const MOVED = 'an expression moves the head\'s layout: the face cannot be differenced';
const RIGS = new Map(), RIGS_MAX = 8;
const keep = (map, key, v) => { if (map.size >= RIGS_MAX) map.delete(map.keys().next().value); map.set(key, v); return v; };
/** the head's parts placed as the plan places its include: L1 at the shift, L2 offsets rounded (station-loft-plan) */
const placed = (parts, shift) => Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, p.layer === 1
  ? { ...p, stations: p.stations.map((s) => ({ ...s, points: Object.fromEntries(Object.entries(s.points).map(([k, v]) => [k, v.map((x, i) => r6(x + shift[i]))])) })), caps: { back: p.caps.back.map((x, i) => r6(x + shift[i])), tip: p.caps.tip.map((x, i) => r6(x + shift[i])) } }
  : { ...p, offsets: Object.fromEntries(Object.entries(p.offsets).map(([k, o]) => [k, o.map(r6)])) }]));
const geometry = (p) => { const { bind: _b, ...rest } = p; return JSON.stringify(rest); };
const faces = (p) => JSON.stringify(p.faces ?? p.stations?.map((s) => Object.keys(s.points)) ?? null);
const diffOf = (B, V0) => { const n = V0.length, d = new Float64Array(n * 3); for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) d[i * 3 + c] = B[i][c] - V0[i][c]; return d; };
const sideOf = (d, V0, s) => { const n = V0.length, o = new Float64Array(n * 3); for (let i = 0; i < n; i++) { const w = s === 'R' ? wRight(V0[i][0]) : 1 - wRight(V0[i][0]); for (let c = 0; c < 3; c++) o[i * 3 + c] = d[i * 3 + c] * w; } return o; };

/**
 * The face rig of a landmark hero's row: `m` the manifest (`hero`, `plan`, `recipe`), `mesh` its compiled figure at rest.
 * Null when the row wears no landmark head include; `{ skipped: reason }` when a guard refuses; else `{ targets, sub,
 * rows, authored, K, meta }` as heroFaceRig's (K: the tracks' knots and weighing, westernKnots).
 */
export function westernFaceRig(m, mesh) {
  const hero = m?.hero, inc = m?.plan?.include?.find((i) => i.name === 'head');
  if (!hero || (hero.head ?? 'landmark') !== 'landmark' || !inc?.parts?.cranium || !m.recipe?.parts?.cranium) return null;
  // every head part but the hair, in the recipe's order (the figure's vertex order)
  const X = Object.keys(m.recipe.parts).filter((n) => inc.parts[n] && inc.parts[n].group !== 'Hair');
  const { opts, authored } = westernRigOptions(hero);
  const build = (E) => placed(landmarkHeadAt(opts, E, X), inc.shift);
  const key = JSON.stringify([opts, X, inc.shift]);
  let T = RIGS.get(key);
  if (T === undefined) {
    const V = {}; let layout = null; T = null;
    for (const [name, ch] of Object.entries(BUILDS)) {
      const parts = build(at(ch));
      const L = X.map((n) => faces(parts[n] ?? {}));
      if (!layout) layout = L; else if (L.some((f, i) => f !== layout[i])) { T = { moved: true }; break; }
      V[name] = compileLayered({ ...m.recipe, parts, dials: {}, creases: {} }, {}, {}).vertices;
    }
    if (!T) {
      const V0 = V.neutral, D = {};
      for (const n of Object.keys(BUILDS)) if (n !== 'neutral') D[n] = diffOf(V[n], V0);
      D.blinkLeft = sideOf(D.blink, V0, 'L'); D.blinkRight = sideOf(D.blink, V0, 'R');
      T = { V0, D, layout, at: new Map() };
    }
    keep(RIGS, key, T);
  }
  if (T.moved) return { skipped: MOVED };
  // the row stores the head this hero builds now: its own expression's build, placed, part for part
  const ak = JSON.stringify(authored);
  let A = T.at.get(ak);
  if (A === undefined) { const parts = build(authored); A = keep(T.at, ak, X.every((n, i) => faces(parts[n] ?? {}) === T.layout[i]) ? Object.fromEntries(X.map((n) => [n, geometry(parts[n])])) : null); }
  if (!A) return { skipped: MOVED };
  if (X.some((n) => geometry(m.recipe.parts[n]) !== A[n])) return { skipped: STALE };
  const want = new Set(X), idx = [];
  for (let i = 0; i < mesh.vertices.length; i++) if (want.has(mesh.provenance[i].part)) idx.push(i);
  const { V0, D } = T, K = westernKnots(authored), W = (1 + K.targets.length) * 3;
  if (idx.length !== V0.length) return { skipped: STALE };
  const sub = new Int32Array(mesh.vertices.length).fill(-1), rows = new Float64Array(idx.length * W);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k], o = k * W, a = mesh.vertices[i], b = V0[k]; let any = false;
    for (let c = 0; c < 3; c++) { const r = a[c] - b[c]; rows[o + c] = r; if (r) any = true; }
    K.targets.forEach((t, ti) => { const d = D[t]; for (let c = 0; c < 3; c++) { const x = d[k * 3 + c]; rows[o + 3 + ti * 3 + c] = x; if (x) any = true; } });
    if (any) sub[i] = k;
  }
  const meta = { targets: [...K.targets], weights: K.weigh(westernState(authored)), words: westernWords(authored), fps: FACE_FPS, eyeKnots: [...K.eyeKnots], fixKnots: [],
    about: 'morph targets on the neutral western head (every expression channel 0), differences of head builds, each one channel at its range end; the channels are linear, so a channel\'s weight is its value over that end (aperture with the blink: (a - 1)(1 - blink)); the default weights are the authored expression; eye closure is drawn at the knots (eyeKnots); the jaw opens by the jaw bone, not a target',
    brow: 'browRaise / browLower lift and drop the brow and its skin; browAngry = browTilt + (the inner ends down), browWorried = browTilt - (the inner ends up)' };
  return { targets: [...K.targets], sub, rows, authored, K, meta };
}
