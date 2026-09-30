/** anime-sculpt.js — the GRAPHIC FACE's words: `hero.sculpt` on the anime head (anime-head.js), turned into the
 * sculpt anime-form.js builds (`buildAnime(r, { sculpt })`, its own construction units).
 *
 * The words are ratio-controls (ratio-controls.js): ratios about 1 = the design base's GRAPHIC BASE, composed by
 * product; OFFSETS about 0 (positions in fractions of the head height H, crown to chin; angles in degrees), composed by
 * sum; two shape words beside them (`fissureShape` round | almond | rect | tri, `browShape` block | taper; last wins).
 * Every word is a standard anatomy or art term: the eye level, the nose tip (pronasale) and the start of the nasal dorsum,
 * the lip line (stomion) and the mouth width, the ear's level, the palpebral fissure's height and shape, the lateral canthus set back along
 * the globe, the upper-lid band's weight, tail, angle and flick and how far it covers the iris, the iris size and oval,
 * the pupil, a catchlight, the brow's thickness, gap, length, angle and arch, a nose line down the shade side.
 *
 * The anime head wears the graphic base by default (a read-time default, like the character light: nothing is stored);
 * `false` is the studio's own face. The base per design base is two layers: a FACE layer under the face words (the
 * studio's controls: a smaller, lower opening, a smaller nose, a shorter lower face) and the SCULPT (this file's units).
 * The stored field is SPARSE: only the words that differ from the base (`sparseSculpt`).
 *
 * `sculptFeatures` measures the FEATURE SPACING on the built head (ratios of H, crown to the front chin tip, and W, the
 * face width at the cheek outline) and advises against each base's bands, read at the studio's own carriage (6° chin up,
 * the carriage the bands were set at), so the head's carriage — a base's rest carriage or a `headPitch` word, its own
 * control — never moves the table. Pure; no dice.
 */
import { ratioControls } from './ratio-controls.js';
import { r6 } from './station-loft-plan.js';

const H_STUDIO = 2.2;   // the studio head's height in construction units (crown 1.19 to chin −1.02 at lower 1)
/** the palpebral fissure's outline as upper / lower lid curves: Y = (1 − |x'|^m)^p, the peak moved to lat k */
export const FISSURE_SHAPES = Object.freeze({
  round: Object.freeze({ upper: { m: 2, p: 0.5, k: 0 }, lower: { m: 2, p: 0.5, k: 0 } }),          // the studio's ellipse
  almond: Object.freeze({ upper: { m: 2, p: 0.55, k: 0.1 }, lower: { m: 2, p: 0.6, k: 0 } }),      // a soft peak toward the lateral canthus
  rect: Object.freeze({ upper: { m: 2.6, p: 0.8, k: 0.25 }, lower: { m: 2, p: 0.7, k: -0.1 } }),   // a flat, angular upper lid
  tri: Object.freeze({ upper: { m: 1.4, p: 1, k: 0.35 }, lower: { m: 2.2, p: 0.8, k: -0.2 } }),    // a straight upper lid rising to the lateral peak
});
/** the brow's profile: `block` blunt at the inner end and thinning outward, `taper` pointed at both ends */
export const BROW_SHAPES = Object.freeze(['block', 'taper']);

/** The GRAPHIC BASE per design base: the face layer (the studio's controls, under the face words) and the sculpt
 * (buildAnime units). Both raise the studio's ear so it spans the eye level to the nose tip. The male: a lower,
 * flat-lidded opening under a thick block brow, the inner end down, a heavy lid with an outer wing that shuts to one
 * thinner, sagging lash line (the brow relaxing up), one small catchlight, a small nose read by a line on its shade
 * side. The female: an almond opening with a lid flick past the lateral canthus, a large oval iris, a thin tapered brow
 * set high, a small nose read by a short hooked line. On both the sclera's dish flattens to a tenth as the lids shut and
 * the lid band tucks further under the opening (`scleraShut`, a build field like `lidShut`, not a door word), so the
 * female's shut eye shows no white under its lid; the male's band sags below the slit as it shuts and still leaves a
 * thin line above it. */
export const GRAPHIC_BASE = Object.freeze({
  male: Object.freeze({
    face: Object.freeze({ eyeWidth: 0.82, eyeHeight: 0.78, nose: 0.5, lower: 0.85 }),
    sculpt: Object.freeze({
      eyeLevel: 0.04, stomion: -0.555, mouthWidth: 2.2,
      nose: { pronasale: -0.345, tip: 0.6, tipWidth: [0.08, 0.07], dorsumStart: 0.10, dorsum: 0.5, dorsumWidth: 0.055 },
      noseLine: { side: -1, top: 0.075, bottom: -0.03, inner: 0.045, outer: 0.075, width: 0.009, curve: 1.6 },
      fissureShape: 'rect', fissure: { h: 0.85, hDn: 0.8 },
      lidWeight: 0.3, lidRamp: [0.45, 0.6], lidTail: 0.25, lidTailAngle: -12, lidFlick: 0, lidPush: 0.014,
      lidCover: 0.25, irisSpan: 1.1, irisOval: 1.0, pupil: 0.4, catchlight: { r: 0.14, at: [0.35, 0.2] },
      canthusSetback: 0.04,
      brow: { shape: 'block', thick: 0.5, gap: 0.12, angle: 18, inner: 1.0, outer: 1.15, arch: 0.01, tip: 0.35, shutLift: 0.3 },
      lidShut: { weight: 0.55, sag: 0.1 }, scleraShut: 0.1,
      ear: { lift: 0.14 },
    }),
  }),
  female: Object.freeze({
    face: Object.freeze({ eyeWidth: 0.95, eyeHeight: 0.92, nose: 0.6, lower: 0.92 }),
    sculpt: Object.freeze({
      eyeLevel: 0.045, stomion: -0.49, mouthWidth: 1.6,
      nose: { pronasale: -0.28, tip: 0.33, tipWidth: [0.07, 0.065], dorsumStart: 0.05, dorsum: 0.25, dorsumWidth: 0.05 },
      noseLine: { side: -1, top: 0.06, bottom: -0.035, inner: 0.025, outer: 0.05, width: 0.009, curve: 1.6 },
      fissureShape: 'almond', fissure: { h: 1.0 },
      lidWeight: 0.3, lidRamp: [0.2, 1.3], lidTail: 0.35, lidTailAngle: 18, lidFlick: 20, lidPush: 0.014, lidLean: 0.7,
      lidCover: 0.2, irisSpan: 1.0, irisOval: 0.85, pupil: 0.45, catchlight: { r: 0.22, at: [0.35, 0.25] },
      canthusSetback: 0.035,
      brow: { shape: 'taper', thick: 0.28, gap: 0.6, angle: -4, inner: 0.85, outer: 1.1, arch: 0.03 },
      scleraShut: 0.1,
      ear: { lift: 0.225 },
    }),
  }),
});

/** FACE TRAITS on the sculpt (ratios about the base; angles and positions offsets) */
export const ANIME_SCULPT_MOVES = Object.freeze({
  'heavy-lid': { note: 'a heavier upper-lid band covering more of the iris', ratios: { lidWeight: 1.25, lidCover: 1.3 } },
  'brow-block': { note: 'a thick, low brow block, the inner end down', ratios: { browThick: 1.3, browGap: 0.6, browAngle: 6 } },
  'sharp-eyes': { note: 'a lower opening, the tail lifted', ratios: { fissureHeight: 0.88, lidAngle: 8, lidTail: 1.2 } },
  'low-nose': { note: 'the nose tip lower and its projection smaller', ratios: { pronasale: -0.01, tipProjection: 0.85 } },
});
/** the door words (1 = the graphic base; offsets 0 = the base). Multi-key groups move a region together. */
export const ANIME_SCULPT = ratioControls({
  label: 'sculpt',
  groups: {
    placement: ['eyeLevel', 'pronasale', 'dorsumStart', 'stomion'], mouth: ['mouthWidth'],
    nose: ['tipProjection', 'dorsumProjection', 'noseLine'],
    ear: ['earLevel'], fissure: ['fissureHeight', 'canthusSetback'], lid: ['lidWeight', 'lidTail', 'lidCover'], lidAngle: ['lidAngle'], lidFlick: ['lidFlick'],
    iris: ['irisSize', 'irisOval', 'pupil', 'catchlight'],
    brow: ['browThick', 'browGap', 'browLength'], browAngle: ['browAngle'], browArch: ['browArch'],
  },
  ranges: { eyeLevel: [-0.03, 0.03], earLevel: [-0.04, 0.04], pronasale: [-0.04, 0.04], dorsumStart: [-0.05, 0.05], stomion: [-0.03, 0.03], lidAngle: [-20, 20], lidFlick: [-30, 60], browAngle: [-25, 25], browArch: [-0.03, 0.05],
    lidWeight: [0.6, 1.5], lidCover: [0, 1.6], browGap: [0, 2.5], browThick: [0.5, 1.6], catchlight: [0, 1.6], noseLine: [0, 1.5], canthusSetback: [0, 2] },
  offsets: ['eyeLevel', 'earLevel', 'pronasale', 'dorsumStart', 'stomion', 'lidAngle', 'lidFlick', 'browAngle', 'browArch'],
  zero: ['lidCover', 'browGap', 'catchlight', 'noseLine', 'canthusSetback', 'lidTail'],
  moves: ANIME_SCULPT_MOVES,
});
export const ANIME_SCULPT_KEYS = ANIME_SCULPT.KEYS;
/** the shape words ride beside the ratios (last wins) */
export const SCULPT_SHAPE_KEYS = Object.freeze({ fissureShape: Object.freeze(Object.keys(FISSURE_SHAPES)), browShape: BROW_SHAPES });

/** Error strings (empty = valid): `false` (the studio's face), `true` (the graphic base), a move, an object of words and
 * shape words, or a list of moves and objects. */
export function validateAnimeSculpt(spec, label = 'sculpt') {
  if (spec === undefined || spec === null || spec === false || spec === true) return [];
  const list = Array.isArray(spec) ? spec : [spec], errs = [];
  list.forEach((entry, i) => {
    const at = Array.isArray(spec) ? `${label}[${i}]` : label;
    if (entry === undefined || entry === null) return;
    if (typeof entry === 'string') { if (!ANIME_SCULPT_MOVES[entry]) errs.push(`${at}: unknown sculpt move '${entry}' (have ${ANIME_SCULPT.MOVE_NAMES.join(', ')})`); return; }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errs.push(`${at}: false (the studio's face), a move (${ANIME_SCULPT.MOVE_NAMES.join(', ')}), an object of words ({ ${[...ANIME_SCULPT_KEYS, ...Object.keys(SCULPT_SHAPE_KEYS)].join(', ')} }) or a list`); return; }
    const { fissureShape, browShape, ...rest } = entry;
    for (const [k, v] of [['fissureShape', fissureShape], ['browShape', browShape]]) if (v !== undefined && v !== null && !SCULPT_SHAPE_KEYS[k].includes(v)) errs.push(`${at}.${k}: one of ${SCULPT_SHAPE_KEYS[k].join(', ')}`);
    errs.push(...ANIME_SCULPT.validate(rest, at));
  });
  return errs;
}
/** `'heavy-lid'` | `{ lidWeight: 1.2, browShape: 'taper' }` | a list | `true` | `false` → `false` or every word at its
 * value `{ …ratios, fissureShape?, browShape? }` (ratios by product, offsets by sum, shapes last-wins) */
export function resolveAnimeSculpt(spec) {
  if (spec === false) return false;
  const list = spec === true ? [] : Array.isArray(spec) ? spec : [spec], shapes = {}, entries = [];
  for (const e of list) {
    if (e === undefined || e === null || e === true) continue;
    if (typeof e === 'string') { entries.push(e); continue; }
    const { fissureShape, browShape, ...rest } = e; if (fissureShape) shapes.fissureShape = fissureShape; if (browShape) shapes.browShape = browShape; entries.push(rest);
  }
  const { from: _f, ...R } = ANIME_SCULPT.resolve(entries);
  return { ...R, ...shapes };
}
/** the SPARSE stored layer: the words that differ from the graphic base (shape words as given); null when none (the
 * field is then absent); `false` stays `false` */
export function sparseSculpt(resolved) {
  if (resolved === false) return false;
  const out = Object.fromEntries(Object.entries(resolved || {}).filter(([k, v]) => !(k in ANIME_SCULPT.DEFAULT && v === ANIME_SCULPT.DEFAULT[k])));
  return Object.keys(out).length ? out : null;
}
/** Advisory: the words outside their comfortable range. A sculpt word moves the face's own construction (a lip line far
 * past its range leaves the lattice's mouth opening), so the advice promises no closure: the door's closure check says. */
export const animeSculptWarnings = (resolved) => (resolved ? ANIME_SCULPT.warnings(resolved).map((w) => w.replace(": the figure still closes, but the read past this is the operator's call", ": the read past this is the operator's call, and far past it the face may open (the closure check says)")) : []);
/** the words that moved off the base, as percentages and offsets (the readout's clause) */
export const describeAnimeSculpt = (resolved) => (resolved ? [ANIME_SCULPT.describe(resolved), ...['fissureShape', 'browShape'].filter((k) => resolved[k]).map((k) => `${k} ${resolved[k]}`)].filter(Boolean).join(', ') : '');

/** The door words → buildAnime's sculpt (studio construction units) for a design base; `false` → null (the studio's face). */
export function sculptBuild(pole, resolved) {
  if (resolved === false) return null;
  const R = { ...ANIME_SCULPT.DEFAULT, ...(resolved || {}) }, B = structuredClone(GRAPHIC_BASE[pole].sculpt), h = (x) => x * H_STUDIO;
  const out = { ...B };
  out.eyeLevel = r6(B.eyeLevel + h(R.eyeLevel)); out.stomion = r6(B.stomion + h(R.stomion)); out.mouthWidth = r6(B.mouthWidth * R.mouthWidth);
  out.nose = { ...B.nose, pronasale: r6(B.nose.pronasale + h(R.pronasale)), dorsumStart: r6(B.nose.dorsumStart + h(R.dorsumStart)), tip: r6(B.nose.tip * R.tipProjection), dorsum: r6(B.nose.dorsum * R.dorsumProjection) };
  if (R.noseLine > 0) out.noseLine = { ...B.noseLine, top: r6(B.noseLine.top * R.noseLine) }; else delete out.noseLine;
  const shape = FISSURE_SHAPES[R.fissureShape ?? B.fissureShape]; delete out.fissureShape;
  out.fissure = { ...B.fissure, ...structuredClone(shape), h: r6((B.fissure.h ?? 1) * R.fissureHeight) };
  out.lidWeight = r6(B.lidWeight * R.lidWeight); out.lidTail = r6(B.lidTail * R.lidTail); out.lidTailAngle = r6(B.lidTailAngle + R.lidAngle); out.lidFlick = r6(B.lidFlick + R.lidFlick);
  out.lidCover = r6(Math.min(0.6, B.lidCover * R.lidCover)); out.irisSpan = r6(B.irisSpan * R.irisSize); out.irisOval = r6(B.irisOval * R.irisOval); out.pupil = r6(B.pupil * R.pupil);
  if (R.catchlight > 0) out.catchlight = { ...B.catchlight, r: r6(B.catchlight.r * R.catchlight) }; else delete out.catchlight;
  out.canthusSetback = r6(B.canthusSetback * R.canthusSetback);
  if (B.ear) out.ear = { ...B.ear, lift: r6(B.ear.lift + h(R.earLevel)) };
  out.brow = { ...B.brow, ...(R.browShape ? { shape: R.browShape } : {}), thick: r6(B.brow.thick * R.browThick), gap: r6(B.brow.gap * R.browGap), angle: r6(B.brow.angle + R.browAngle), inner: r6(B.brow.inner * R.browLength), outer: r6(B.brow.outer * R.browLength), arch: r6(B.brow.arch + R.browArch) };
  return out;
}

// ─── the feature spacing ──────────────────────────────────────────────────
/** The bands the readout advises against, per design base (ratios of H and W; `fissure` the opening's height over its
 * width; `browThick`, `browGap` and `lid` of the opening's height; `noseProjection` of H; `ear` the ear centre's offset
 * from midway between the eye level and the nose tip, of H — the ear spans the one to the other). The female lid band is what
 * her base's lid measures at the eye's centre column: the fixed-nib band leans toward the lateral canthus, so its height
 * over the opening's centre is thin while the band reads heavy. */
export const FEATURE_BANDS = Object.freeze({
  male: Object.freeze({ ear: [-0.03, 0.03], eyeLevel: [0.44, 0.47], pronasale: [0.26, 0.30], noseToMouth: [0.08, 0.12], stomion: [0.16, 0.19], eyeWidth: [0.19, 0.22], fissure: [0.35, 0.50], browThick: [0.35, 0.60], browGap: [0, 0.30], lid: [0.25, 0.35], noseProjection: [0.04, 0.06], mouthWidth: [0.30, 0.38] }),
  female: Object.freeze({ ear: [-0.03, 0.03], eyeLevel: [0.42, 0.46], pronasale: [0.28, 0.31], noseToMouth: [0.08, 0.12], stomion: [0.17, 0.20], eyeWidth: [0.22, 0.26], fissure: [0.55, 0.80], browThick: [0.15, 0.25], browGap: [0.4, 0.8], lid: [0.15, 0.22], noseProjection: [0.025, 0.04], mouthWidth: [0.22, 0.28] }),
});
const FEATURE_WORDS = Object.freeze({ ear: 'the ear centre from midway between the eye level and the nose tip (of H)', eyeLevel: 'the eye level (of H)', pronasale: 'the nose tip height (of H)', noseToMouth: 'the nose tip to the lip line (of H)', stomion: 'the lip line height (of H)',
  eyeWidth: 'the eye width (of W)', fissure: "the opening's height over its width", browThick: "the brow's thickness (of the opening)", browGap: "the brow's gap above the opening (of the opening)",
  lid: "the lid band's height (of the opening)", noseProjection: 'the nose projection (of H)', mouthWidth: 'the mouth width (of W)' });
const FEATURE_WORD_OF = Object.freeze({ ear: 'earLevel', eyeLevel: 'eyeLevel', pronasale: 'pronasale', noseToMouth: 'pronasale or stomion', stomion: 'stomion', eyeWidth: '/hero/face/eyeWidth', fissure: 'fissureHeight', browThick: 'browThick', browGap: 'browGap', lid: 'lidWeight', noseProjection: 'tipProjection', mouthWidth: 'mouthWidth' });
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

/** The carriage the feature table reads the face at: the studio's rest pitch (radians, chin up). */
const FEATURE_CARRIAGE = (6 * Math.PI) / 180;
/** The FEATURE-SPACING table on a built anime head: `meshes` its parts in the hero head frame (+x right, +y front, +z up;
 * `face` with its Skin / Sclera / Mouth groups, `browR`, `lidR`, `irisR`, `pupilR` when present), `pole` the design base.
 * Ratios, so the head's scale never changes them; `advice` names each one outside its band and the word that moves it.
 * `carriage`: the pitch the head was built at (radians, chin up; buildAnime's `pitch`): a head carried otherwise is turned
 * about x to FEATURE_CARRIAGE before it is read (a rigid turn, so the ratios are the face's own); absent or equal, as built. */
export function sculptFeatures(meshes, pole, { carriage } = {}) {
  const turn = Number.isFinite(carriage) ? FEATURE_CARRIAGE - carriage : 0, c = Math.cos(turn), sn = Math.sin(turn);
  const carried = turn ? (p) => [p[0], c * p[1] - sn * p[2], sn * p[1] + c * p[2]] : (p) => p;
  const pts = (m) => m.faces.flatMap((f) => f.map((v) => carried(m.points[v])));
  const face = meshes.face, groupPts = (g) => face.faces.flatMap((f, i) => (face.groups[i] === g ? f.map((v) => carried(face.points[v])) : []));
  const skin = groupPts('Skin'), sclera = groupPts('Sclera').filter((p) => p[0] > 0), mouth = groupPts('Mouth');
  const min = (P, k) => P.reduce((s, p) => Math.min(s, p[k]), Infinity), max = (P, k) => P.reduce((s, p) => Math.max(s, p[k]), -Infinity);
  const mean = (P, k) => P.reduce((s, p) => s + p[k], 0) / P.length, ext = (P, k) => max(P, k) - min(P, k);
  const midY = (min(skin, 1) + max(skin, 1)) / 2, crown = max(skin, 2);
  const eyeZ = mean(sclera, 2), mouthZ = mean(mouth, 2), mouthY = mean(mouth, 1), depth = ext(skin, 1);
  // the midline in front; the FRONT chin tip is the lowest midline point no deeper than a fifth of the head behind the lips
  const mid = skin.filter((p) => Math.abs(p[0]) < 0.004 && p[1] > midY);
  const chin = min(mid.filter((p) => p[1] > mouthY - 0.2 * depth), 2), H = crown - chin;
  const W = 2 * skin.filter((p) => p[1] > midY && p[2] > mouthZ && p[2] < eyeZ).reduce((s, p) => Math.max(s, Math.abs(p[0])), 0);
  // the nose tip: the most projecting midline point between the lip line and the eye level — none there (a lip line
  // moved up past the nose) leaves the nose's ratios unmeasured (null), never a thrown error
  const tip = mid.filter((p) => p[2] > mouthZ + 0.004 && p[2] < eyeZ).reduce((b, p) => (!b || p[1] > b[1] ? p : b), null);
  // the facial plane at the tip's height: the midline skin between the eye level and the lip line, linear
  const at = (z) => { const near = mid.filter((p) => Math.abs(p[2] - z) < 0.003); return near.length ? max(near, 1) : NaN; };
  const yEye = at(eyeZ), yMouth = at(mouthZ + 0.006), plane = tip ? yEye + (yMouth - yEye) * (tip[2] - eyeZ) / (mouthZ + 0.006 - eyeZ) : NaN;
  const openW = ext(sclera, 0), openH = ext(sclera, 2), ex = (min(sclera, 0) + max(sclera, 0)) / 2;
  const col = (P, x0, w) => P.filter((p) => Math.abs(p[0] - x0) < w);
  const scTop = max(col(sclera, ex, 0.003), 2);
  const out = { eyeLevel: r3((eyeZ - chin) / H), pronasale: tip ? r3((tip[2] - chin) / H) : null, stomion: r3((mouthZ - chin) / H), noseToMouth: tip ? r3((tip[2] - mouthZ) / H) : null,
    eyeWidth: r3(openW / W), fissure: r3(openH / openW), noseProjection: tip ? r3((tip[1] - plane) / H) : null, mouthWidth: r3(ext(mouth, 0) / W) };
  if (meshes.browR) {
    const brow = pts(meshes.browR), bins = new Map();
    for (const p of brow) { const b = Math.round(p[0] / 0.002); const e = bins.get(b) ?? [Infinity, -Infinity]; e[0] = Math.min(e[0], p[2]); e[1] = Math.max(e[1], p[2]); bins.set(b, e); }
    const th = [...bins.values()].map(([a, b]) => b - a).sort((a, b) => a - b);
    out.browThick = r3(th[Math.floor(th.length / 2)] / openH);
    out.browGap = r3((min(col(brow, ex, 0.003), 2) - scTop) / openH);
    const x0 = min(brow, 0), x1 = max(brow, 0), low = (xc) => min(col(brow, xc, 0.002), 2);
    const xa = x0 + 0.2 * (x1 - x0), xb = x0 + 0.6 * (x1 - x0); out.browAngle = r3(Math.atan2(low(xb) - low(xa), xb - xa) * 180 / Math.PI);
  }
  if (meshes.lidR) { const lid = pts(meshes.lidR); out.lid = r3(ext(col(lid, ex, 0.0015), 2) / openH); out.lidPast = r3((max(lid, 0) - max(sclera, 0)) / openW); }
  // the ear's centre (its height of H) and its offset from midway between the eye level and the nose tip (the ear spans
  // the eye level to the nose tip)
  if (meshes.earR) { const ear = pts(meshes.earR); out.earLevel = r3((mean(ear, 2) - chin) / H); if (tip) out.ear = r3((mean(ear, 2) - (eyeZ + tip[2]) / 2) / H); }
  if (meshes.irisR) { const iris = pts(meshes.irisR); out.irisOfEye = r3(ext(iris, 0) / openW); if (meshes.pupilR) out.pupilOfIris = r3(ext(pts(meshes.pupilR), 0) / ext(iris, 0)); }
  const B = FEATURE_BANDS[pole] || {};
  // the pointer names the word the way the door takes it: the stored sculpt is sparse (absent on a default hero), so a
  // sculpt word is set as `/hero/sculpt` { word: … } first, then `/hero/sculpt/<word>`
  const pointer = (w) => (w.startsWith('/') ? `${w} moves it` : `/hero/sculpt { ${w.split(' or ').map((k) => `${k}: …`).join(' } or { ')} } moves it (then /hero/sculpt/<word>)`);
  out.advice = Object.entries(B).filter(([k, [lo, hi]]) => out[k] !== null && out[k] !== undefined && (out[k] < lo - 1e-9 || out[k] > hi + 1e-9))
    .map(([k, [lo, hi]]) => `face: ${FEATURE_WORDS[k]} is ${out[k]}, outside the ${pole} band [${lo}, ${hi}]: ${pointer(FEATURE_WORD_OF[k])}`);
  if (!tip) out.advice.push(`face: the nose tip could not be measured (no midline point between the lip line and the eye level): /hero/sculpt { stomion: … } or { pronasale: … } moves it (then /hero/sculpt/<word>)`);
  return out;
}
