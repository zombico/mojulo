/**
 * anime-face-rig — the anime hero's FACE AS BLEND SHAPES: its four expression channels (anime-head `expression`: blink,
 * smile, open, brow) as morph targets an engine plays, differenced from constant-topology builds of the same head with
 * only the expression changed.
 *
 *   • THE TARGETS (FACE_TARGETS, on the NEUTRAL head, every channel 0): `blink` (both lids shut), `blinkLeft` and
 *     `blinkRight` (the same, one eye: a smoothstep across the midline over ±4 mm; Left is mesh −x, the figure's left),
 *     `smile`, `mouthOpen`, `browInnerRaise` (brow −1: the inner ends up, the outer down — the channel slants the brow
 *     about its middle, it does not lift it) and `browInnerLower` (brow +1), and the IN-BETWEEN CORRECTIVES
 *     `blinkFix<k><L|R>` for the lid closures k in FIX_KNOTS: the closing lid crops the lenses and drops them behind the
 *     face, so closure k is not k × blink; a corrective is the build at k less the neutral and k × blink, one eye each.
 *   • EYE CLOSURE IS DRAWN, NOT TWEENED: an eye is only ever shown at a knot (EYE_KNOTS, each an exact build), with its
 *     corrective at weight 1 (faceWeights); a word's weights (faceWords) are its drawing. A hero whose own closure sits
 *     between two knots (faceKnots: a 0.35, a 0.6) is drawn at it too: one more build, its corrective pair appended to the
 *     targets, so the default face is the stored one.
 *   • THE BUILDS (FACE_BUILDS: neutral, the unit channels, the knots) are the head's own (humanoid-plan `animeHeadAt`: the
 *     parts an expression moves, bald and unfitted — the same parts as with the hair on) compiled with the stored
 *     cranium alone, which gives those parts' vertices in the whole figure's order; a figure's vertex is mapped to them
 *     by its provenance. Cached per head (a few recent ones): a second export of the same hero builds nothing.
 *   • GUARDS: the build at the hero's own expression must be the head the row stores — the ears, the nose line and every
 *     moving part equal to the recipe's (one more build, kept per expression), the whole figure's cranium bit for bit the
 *     builds' — else the face is skipped with its reason (a row stored by older head code, or a dial or channel that
 *     moves the head).
 *   • 7G (anime-drawings.js; sevenG: `acting: 'full'`, or a take on a target of T3 or higher): every drawing a target
 *     after the channels' (an exact build less the neutral; the brows' and the lids' split per eye, a sided mouth's per
 *     side), and the CORRECTIVES of the pairs that do not add (a lid's shape over a turned gaze: the lids clip the lenses;
 *     a brow's over the shut eye: the brow rides its socket as the lids shut), each the build of both less the neutral
 *     and each alone, per eye; `drawingWeights` weighs a face drawn per layer onto them. None else: the face as before.
 * heroFaceRig hands the rig pack a ROW per figure vertex (station-loft-rig `packLayeredRig` `face`): the rebase (the
 * stored face less the neutral one) and each target, carried through the character light's split as joints and weights
 * are; scene-gltf writes the targets, the neutral POSITION and the authored default weights. Pure and deterministic.
 */
import { compileLayered } from './station-loft.js';
import { animeHeadAt } from './humanoid-plan.js';
import { animeHeroEffective, heroHeadPole, heroHairPole } from './anime-looks.js';
import { ANIME_POSES, resolveAnimeExpression } from './anime-head.js';
import { DRAWINGS } from './anime-drawings.js';
import { socketsOn, withSocket } from './anime-sockets.js';
import { tierOf, DENSE_TIERS } from '../era/cast-spend.js';
import { readTarget, DEFAULT_TARGET } from '../era/target.js';

/** the face tracks' frame rate (a drawing per frame) */
export const FACE_FPS = 30;
/** the eye closures an eye is drawn at, each an exact build */
export const EYE_KNOTS = Object.freeze([0, 0.1, 0.12, 0.18, 0.2, 0.5, 1]);
/** the closures between open and shut that carry a corrective */
export const FIX_KNOTS = Object.freeze([0.1, 0.12, 0.18, 0.2, 0.5]);
/** a closure's name tag: its decimals, two at least (0.1 → 10, 0.12 → 12, 0.35 → 35, 0.125 → 125) */
const knotTag = (k) => String(Math.round(k * 1e4)).padStart(4, '0').replace(/0+$/, '').padEnd(2, '0');
export const fixName = (k, side) => `blinkFix${knotTag(k)}${side}`;
export const FACE_TARGETS = Object.freeze(['blink', 'blinkLeft', 'blinkRight', 'smile', 'mouthOpen', 'browInnerRaise', 'browInnerLower', ...FIX_KNOTS.flatMap((k) => [fixName(k, 'L'), fixName(k, 'R')])]);
/** the head builds the targets are differenced from (expression channels) */
export const FACE_BUILDS = Object.freeze({ neutral: {}, blink: { blink: 1 }, smile: { smile: 1 }, open: { open: 1 }, browRaise: { brow: -1 }, browLower: { brow: 1 }, ...Object.fromEntries(FIX_KNOTS.map((k) => [`blink${k}`, { blink: k }])) });

/** a closure within this of a knot is drawn at it (the name tag's resolution) */
const KNOT_EPS = 5e-5;
const STANDARD = Object.freeze({ own: null, eyeKnots: EYE_KNOTS, fixKnots: FIX_KNOTS, targets: FACE_TARGETS });
/** The knots a hero's eyes are drawn at, from its expression channels: EYE_KNOTS, and its own closure when that sits
 * between two of them inside 0 … 1 (`own`: a 0.35, a 0.6) — an exact build too, its corrective pair appended to the
 * targets (FACE_TARGETS stays their prefix), so the default face is the stored one. A closure past the studio's 0 … 1
 * draws at the nearer end. */
export function faceKnots(authored) {
  const a = authored?.blink ?? 0;
  if (!(a > 0 && a < 1) || EYE_KNOTS.some((k) => Math.abs(k - a) < KNOT_EPS)) return STANDARD;
  return { own: a, eyeKnots: [...EYE_KNOTS, a].sort((x, y) => x - y), fixKnots: [...FIX_KNOTS, a], targets: [...FACE_TARGETS, fixName(a, 'L'), fixName(a, 'R')] };
}

/** the four channels → the face state (the lid closure per eye) */
export const faceState = (c) => ({ eyeL: c.blink ?? 0, eyeR: c.blink ?? 0, smile: c.smile ?? 0, open: c.open ?? 0, brow: c.brow ?? 0 });
const near = (a, b) => Math.abs(a - b) < 1e-9;
/** the drawing an eye value is shown as: the nearest knot (of `knots`, a hero's faceKnots) */
export const drawEye = (e, knots = EYE_KNOTS) => knots.reduce((best, k) => (Math.abs(k - e) < Math.abs(best - e) ? k : best), 0);
/** a face state → its weights in the targets' order (each eye drawn at its nearest knot); `K` a hero's faceKnots, or the
 * painted face's (face-paint-rig.js: its own targets and `weigh`) */
export function faceWeights(F, K = STANDARD) {
  if (K.weigh) return K.weigh(F);   // the painted face's own drawings (face-paint-rig.js)
  const eL = drawEye(F.eyeL, K.eyeKnots), eR = drawEye(F.eyeR, K.eyeKnots), b = Math.min(eL, eR);
  const w = Object.fromEntries(K.targets.map((n) => [n, 0]));
  w.blink = b; w.blinkLeft = eL - b; w.blinkRight = eR - b;
  w.smile = F.smile; w.mouthOpen = F.open; w.browInnerRaise = Math.max(0, -F.brow); w.browInnerLower = Math.max(0, F.brow);
  for (const k of K.fixKnots) { if (near(eL, k)) w[fixName(k, 'L')] = 1; if (near(eR, k)) w[fixName(k, 'R')] = 1; }
  return K.targets.map((n) => +w[n].toFixed(6));
}
/** every expression word's weights (anime-head ANIME_POSES, in its order), then the hero's own (`authored` channels), in
 * the hero's targets */
export function faceWords(authored, K = faceKnots(authored)) {
  return Object.fromEntries([...Object.keys(ANIME_POSES).map((w) => [w, faceWeights(faceState(resolveAnimeExpression(w)), K)]), ['authored', faceWeights(faceState(authored), K)]]);
}

const MIDLINE = 0.004;   // the one-eye targets' blend half-width across the midline (m)
const wRight = (x) => { const t = Math.min(1, Math.max(0, (x + MIDLINE) / (2 * MIDLINE))); return t * t * (3 - 2 * t); };
const CHECK_RE = /^(cranium|ear[LR]|noseLine|hair)/;
const STALE = 'the stored head is not the head this hero builds now: regenerate the row (any /hero edit)';
const MOVED = 'an expression moves the head\'s pin or its layout: the face cannot be differenced';
/** the targets per head, kept by their inputs (a few recent ones): { V0, D, check, at, own } */
const FACE_RIGS = new Map(), FACE_RIGS_MAX = 8;
const keep = (map, key, v) => { if (map.size >= FACE_RIGS_MAX) map.delete(map.keys().next().value); map.set(key, v); return v; };

/** one head build at expression E: the moving and checked parts, and what the guards compare (the checked parts whole,
 * the moving parts' faces) */
const headBuild = (opts, E, X, C, drawing = null) => { const parts = animeHeadAt(opts, E, [...X, ...C], drawing); return { parts, C: C.map((n) => JSON.stringify(parts[n] ?? null)), X: X.map((n) => JSON.stringify(parts[n]?.faces ?? null)) }; };
const sameLayout = (a, b) => a.C.every((s, i) => s === b.C[i]) && a.X.every((s, i) => s === b.X[i]);
/** a build's vertices: its moving parts compiled with the stored cranium (the figure's order) */
const subVertices = (recipe, X, parts) => compileLayered({ ...recipe, parts: { cranium: recipe.parts.cranium, ...Object.fromEntries(X.map((n) => [n, parts[n]])) }, dials: {}, creases: {} }, {}, {}).vertices;
const diffOf = (B, V0) => { const n = V0.length, d = new Float64Array(n * 3); for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) d[i * 3 + c] = B[i][c] - V0[i][c]; return d; };
const sideOf = (d, V0, s) => { const n = V0.length, o = new Float64Array(n * 3); for (let i = 0; i < n; i++) { const w = s === 'R' ? wRight(V0[i][0]) : 1 - wRight(V0[i][0]); for (let c = 0; c < 3; c++) o[i * 3 + c] = d[i * 3 + c] * w; } return o; };
/** closure k's corrective pair: the build at k less the neutral and k × blink, one eye each */
const fixPair = (V, k, V0, blink) => { const d = diffOf(V, V0); for (let i = 0; i < d.length; i++) d[i] -= k * blink[i]; return { L: sideOf(d, V0, 'L'), R: sideOf(d, V0, 'R') }; };

/** The head's builds, compiled and differenced: the neutral vertices V0 and each target D[name] (Float64Array, 3 per
 * vertex) over the cranium and the moving parts in the figure's order, and the neutral layout the other builds keep. */
function buildTargets(recipe, opts, X, C) {
  const V = {}; let check = null;
  for (const [name, E] of Object.entries(FACE_BUILDS)) {
    const b = headBuild(opts, E, X, C);
    if (!check) check = { C: b.C, X: b.X };
    else if (!sameLayout(b, check)) return null;   // an expression that moves the pin or the layout
    V[name] = subVertices(recipe, X, b.parts);
  }
  const V0 = V.neutral, D = {}, diff = (B) => diffOf(B, V0);
  D.blink = diff(V.blink); D.smile = diff(V.smile); D.mouthOpen = diff(V.open); D.browInnerRaise = diff(V.browRaise); D.browInnerLower = diff(V.browLower);
  D.blinkLeft = sideOf(D.blink, V0, 'L'); D.blinkRight = sideOf(D.blink, V0, 'R');
  for (const k of FIX_KNOTS) { const p = fixPair(V[`blink${k}`], k, V0, D.blink); D[fixName(k, 'L')] = p.L; D[fixName(k, 'R')] = p.R; }
  return { V0, D, check, at: new Map(), own: new Map() };
}

/** The build at the hero's own expression (kept per expression): what the row must store — its checked and moving parts
 * whole — or null when it moves the layout; and a hero drawn at its own knot gets that knot's corrective pair (kept per
 * closure). */
function authoredBuild(T, recipe, opts, X, C, authored, K) {
  const key = JSON.stringify(authored);
  let A = T.at.get(key);
  if (A === undefined) { const b = headBuild(opts, authored, X, C); A = keep(T.at, key, sameLayout(b, T.check) ? { C: b.C, X: X.map((n) => JSON.stringify(b.parts[n] ?? null)) } : null); }
  if (A && K.own !== null && !T.own.has(K.own)) {
    const k = headBuild(opts, { blink: K.own }, X, C);
    if (!sameLayout(k, T.check)) return null;
    keep(T.own, K.own, fixPair(subVertices(recipe, X, k.parts), K.own, T.V0, T.D.blink));
  }
  return A;
}

/** The head-shaping words an anime hero's plan wears its head with (layered heroFormPlan's anime branch, as humanoid-plan
 * `animeHeadAt` takes them) and its expression channels (`authored`) — read from the record, never stored. */
export function faceRigOptions(hero) {
  const eff = animeHeroEffective(hero);
  const opts = { preset: hero.cast, register: hero.register, tune: eff.tune, headScale: hero.headScale, face: eff.face, sculpt: eff.sculpt, ...(hero.headPreset || heroHairPole(hero) !== heroHeadPole(hero) ? { headPreset: heroHeadPole(hero) } : {}), ...(hero.proportions ? { proportions: hero.proportions } : {}) };
  return { opts, authored: resolveAnimeExpression(eff.expression) };
}

// ─── 7G: the drawings as targets ─────────────────────────────────────────────
/** Does this hero draw its face in 7G (anime-drawings.js): the anime head (drawn, not painted) with `acting: 'full'`, or
 * a take (`perform`) on a target of T3 or higher (era/cast-spend.js DENSE_TIERS) unless `acting: 'basic'`. Else its face
 * is the four channels, and a take is lowered to them. */
export const sevenG = (hero) => hero?.head === 'anime' && !hero.painterly && (hero.acting === 'full' || (hero.acting !== 'basic' && !!hero.perform && DENSE_TIERS.includes(tierOf(readTarget(hero.target ?? DEFAULT_TARGET).figurePx).id)));
/** a drawing's target name: `brows.angry` → `drawBrowsAngry`, a side's `drawBrowsAngryL` */
export const drawTarget = (name, side = '') => `draw${name.split('.').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}${side}`;
/** a corrective's: two drawings' (`fixLidsAngryGazeLeftL`), or a drawing's over the shut eye (`fixBrowsAngryShutL`) */
export const fixTarget = (a, b, side) => `fix${drawTarget(a).slice(4)}${b === 'shut' ? 'Shut' : drawTarget(b).slice(4)}${side}`;
/** the layers drawn per eye (their targets split across the midline), and the drawings each corrective pairs: a lid's shape
 * over a turned gaze (the lids clip the lenses), a brow's over the shut eye (the brow rides its socket as the lids shut) */
const PER_SIDE = new Set(['brows', 'lids']);
const drawn = (layer, pick = () => true) => Object.entries(DRAWINGS).filter(([, D]) => D.layer === layer && D.words && pick(D)).map(([n]) => n);
export const SEVEN_G = Object.freeze({
  drawings: Object.freeze(Object.entries(DRAWINGS).filter(([, D]) => D.words).map(([n]) => n)),
  lids: Object.freeze(drawn('lids')), gazes: Object.freeze(drawn('gaze', (D) => !!D.words.gaze)), brows: Object.freeze(drawn('brows')),
});
const splits = (name) => PER_SIDE.has(DRAWINGS[name].layer) || !!DRAWINGS[name].sided;
const MOVED7 = 'a 7G drawing moves the head\'s pin or its layout: the face is drawn in its four channels';
/** the 7G targets of a head (kept on its rig, T.g7, one set per `sockets`): each drawing's (split per side where it is
 * drawn per side), each pair's corrective (the build of both less the neutral and each alone, per side) → { names, D,
 * bytes } or { skipped }. `sockets` (anime-sockets.js, hero laws 20): each brow drawing built with its socket, so its
 * target and its correctives carry it */
function g7Targets(T, recipe, opts, X, C, sockets = false) {
  T.g7 ??= {};
  const at = sockets ? 'sockets' : 'plain';
  if (T.g7[at] !== undefined) return T.g7[at];
  const W = (name) => withSocket(name, DRAWINGS[name].words, sockets);
  const V0 = T.V0, D = {}, names = [], whole = {};
  const vOf = (E, words) => { const b = headBuild(opts, E, X, C, words); if (!sameLayout(b, T.check)) throw new Error(MOVED7); return subVertices(recipe, X, b.parts); };
  const put = (n, d) => { D[n] = d; names.push(n); };
  try {
    for (const name of SEVEN_G.drawings) {
      const d = diffOf(vOf({}, W(name)), V0); whole[name] = d;
      if (splits(name)) for (const s of ['L', 'R']) put(drawTarget(name, s), sideOf(d, V0, s)); else put(drawTarget(name), d);
    }
    const fix = (a, b, d) => { for (const s of ['L', 'R']) put(fixTarget(a, b, s), sideOf(d, V0, s)); };
    for (const lid of SEVEN_G.lids) for (const gz of SEVEN_G.gazes) {
      const d = diffOf(vOf({}, { ...W(lid), ...W(gz) }), V0);
      for (let i = 0; i < d.length; i++) d[i] -= whole[lid][i] + whole[gz][i];
      fix(lid, gz, d);
    }
    // (a brow over a lid: the socket's rim warps with the brow over the rings the lid moves, anime-form.js BROW_RIM)
    for (const brow of SEVEN_G.brows) for (const lid of SEVEN_G.lids) {
      const d = diffOf(vOf({}, { ...W(brow), ...W(lid) }), V0);
      for (let i = 0; i < d.length; i++) d[i] -= whole[brow][i] + whole[lid][i];
      fix(brow, lid, d);
    }
    for (const brow of SEVEN_G.brows) {
      const d = diffOf(vOf({ blink: 1 }, W(brow)), V0);
      for (let i = 0; i < d.length; i++) d[i] -= whole[brow][i] + T.D.blink[i];
      fix(brow, 'shut', d);
    }
  } catch (e) { if (e.message !== MOVED7) throw e; return (T.g7[at] = { skipped: MOVED7 }); }
  // (the export's cost: a sparse target, 16 bytes a moved vertex)
  const bytes = names.reduce((t, n) => { let k = 0; const d = D[n]; for (let i = 0; i < d.length; i += 3) if (d[i] || d[i + 1] || d[i + 2]) k++; return t + 16 * k; }, 0);
  return (T.g7[at] = { names, D, bytes });
}
/**
 * A 7G face → its weights in the targets' order (`K` the rig's knots, its targets with the 7G names appended). The face:
 * the four channels' state (faceState: each eye's closure, drawn at its knot; the smile; the open mouth; the brow) and a
 * drawing per layer: `brows` and `lids` per eye ({ L, R }, a name or null), `gaze`, `mouth` (a name or null) and
 * `mouthSide` (a sided mouth's side, 'L' | 'R', else both). A lid's shape is drawn on an open eye only; a pair's
 * corrective rides with both of its drawings (a lid's over a turned gaze, a brow's over its lid's shape or its shut eye).
 */
export function drawingWeights(F, K) {
  const base = faceWeights(F, K), at = new Map(K.targets.map((n, i) => [n, i])), set = (n) => { const i = at.get(n); if (i !== undefined) base[i] = 1; };
  const eye = { L: drawEye(F.eyeL ?? 0, K.eyeKnots), R: drawEye(F.eyeR ?? 0, K.eyeKnots) };
  for (const s of ['L', 'R']) {
    const brow = F.brows?.[s], lid = eye[s] === 0 ? F.lids?.[s] : null;
    if (brow && DRAWINGS[brow]?.words) { set(drawTarget(brow, s)); if (eye[s] === 1) set(fixTarget(brow, 'shut', s)); }
    if (lid && DRAWINGS[lid]?.words) { set(drawTarget(lid, s)); if (F.gaze && SEVEN_G.gazes.includes(F.gaze)) set(fixTarget(lid, F.gaze, s)); if (brow && DRAWINGS[brow]?.words) set(fixTarget(brow, lid, s)); }
  }
  if (F.gaze && DRAWINGS[F.gaze]?.words) set(drawTarget(F.gaze));
  if (F.mouth && DRAWINGS[F.mouth]?.words) { if (DRAWINGS[F.mouth].sided) for (const s of F.mouthSide ? [F.mouthSide] : ['L', 'R']) set(drawTarget(F.mouth, s)); else set(drawTarget(F.mouth)); }
  return base;
}

/**
 * The face rig of an anime hero's row: `m` the manifest (its `hero`, `plan` and `recipe`), `mesh` its compiled figure at
 * rest (the one the rig pack skins). Returns null when the row wears no anime head include, `{ skipped: reason }` when the
 * guards refuse, else `{ targets, sub, rows, authored, meta }`: `sub` an Int32Array over the figure's vertices (the row
 * index, −1 where nothing moves), `rows` a Float64Array of (1 + targets) × 3 per row (the rebase — the stored face less
 * the neutral one — then each target), `authored` the hero's expression channels, `meta` what the GLB carries (the
 * targets, the authored weights, every word's weights, the frame rate and the knots).
 */
export function heroFaceRig(m, mesh) {
  const hero = m?.hero, head = m?.plan?.include?.find((i) => i.name === 'head');
  if (!hero || hero.head !== 'anime' || !head?.parts || !m.recipe?.parts?.cranium) return null;
  const X = Object.keys(head.parts).filter((n) => !CHECK_RE.test(n) && m.recipe.parts[n]), C = ['earL', 'earR', 'noseLine'].filter((n) => m.recipe.parts[n]);
  const { opts, authored } = faceRigOptions(hero);
  const key = JSON.stringify([opts, X, m.recipe.parts.cranium]);
  let T = FACE_RIGS.get(key);
  if (T === undefined) T = keep(FACE_RIGS, key, buildTargets(m.recipe, opts, X, C));
  if (!T) return { skipped: MOVED };
  // the row stores the head this hero builds now: the build at its own expression, its ears, nose line and moving parts
  const K = faceKnots(authored), A = authoredBuild(T, m.recipe, opts, X, C, authored, K);
  if (!A) return { skipped: MOVED };
  if (C.some((n, i) => JSON.stringify(m.recipe.parts[n]) !== A.C[i]) || X.some((n, i) => JSON.stringify(m.recipe.parts[n]) !== A.X[i])) return { skipped: STALE };
  // the figure's vertices on the cranium and the moving parts, in order, are the builds' vertices
  const want = new Set(['cranium', ...X]), idx = [];
  for (let i = 0; i < mesh.vertices.length; i++) if (want.has(mesh.provenance[i].part)) idx.push(i);
  // 7G (sevenG): the drawings' targets and their correctives after the channels' (none else: the face as before)
  const G7 = sevenG(hero) ? g7Targets(T, m.recipe, opts, X, C, socketsOn(hero)) : null, g7 = G7 && !G7.skipped ? G7 : null;
  const KK = g7 ? { ...K, targets: [...K.targets, ...g7.names] } : K;
  const { V0 } = T, own = K.own === null ? null : T.own.get(K.own);
  const D0 = own ? { ...T.D, [fixName(K.own, 'L')]: own.L, [fixName(K.own, 'R')]: own.R } : T.D, D = g7 ? { ...D0, ...g7.D } : D0, W = (1 + KK.targets.length) * 3;
  if (idx.length !== V0.length) return { skipped: STALE };
  for (let k = 0; k < idx.length; k++) { const i = idx[k]; if (mesh.provenance[i].part !== 'cranium') continue; const a = mesh.vertices[i], b = V0[k]; if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) return { skipped: 'a dial or channel moves the head: the face is differenced at rest — rest it and export again for the face' }; }
  const sub = new Int32Array(mesh.vertices.length).fill(-1), rows = new Float64Array(idx.length * W);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k], o = k * W, a = mesh.vertices[i], b = V0[k]; let any = false;
    for (let c = 0; c < 3; c++) { const r = a[c] - b[c]; rows[o + c] = r; if (r) any = true; }
    KK.targets.forEach((t, ti) => { const d = D[t]; for (let c = 0; c < 3; c++) { const x = d[k * 3 + c]; rows[o + 3 + ti * 3 + c] = x; if (x) any = true; } });
    if (any) sub[i] = k;
  }
  const meta = { targets: [...KK.targets], weights: faceWeights(faceState(authored), KK), words: faceWords(authored, KK), fps: FACE_FPS, eyeKnots: [...K.eyeKnots], fixKnots: [...K.fixKnots], ...(g7 ? { sevenG: { drawings: SEVEN_G.drawings.length, targets: g7.names.length, bytes: g7.bytes } } : G7 ? { sevenG: { skipped: G7.skipped } } : {}) };
  return { targets: [...KK.targets], sub, rows, authored, meta, ...(g7 ? { K: KK, sevenG: true } : {}) };
}
