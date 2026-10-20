/**
 * DERMAL MAP — the skin's LAYOUT over a body, read from an address alone (dermal-chart.js), so any body shape with a
 * chart wears it: what kind of skin lies where, its colour, its sheen, how thin it is, which way it is stretched, and
 * the hair it grows. A few dials and a seed in (`readDermis`); a reading at any address out (`dermisAt`). Conveyed, not
 * simulated: the TRICKS a realistic game skin is painted with, laid by anatomy rather than by hand.
 *
 *   regions       the skin's kinds: the scalp (under a hairline that recedes at the temples, drops to the sideburn and
 *                 the nape), the face in its thirds (forehead, the middle third with the nose and the cheeks, the lower
 *                 with the lips and the jaw), the ear, the eyelid; the neck; the chest, the abdomen, the back and the
 *                 axilla; the elbow's and the knee's extensor skin, the shin; the inner arm; the palm and the sole
 *                 (glabrous: no hair, no pores, friction ridges), the dorsum, the knuckles, the nails, the heel
 *   colour zones  the portrait painter's: the forehead golden, the middle third ruddy (the nose, the cheeks, the ears),
 *                 the lower third cool where a beard's shadow lies; blood at the knuckles, the elbows, the knees, the
 *                 fingertips and the toes; the bony prominences yellowed; the palms and soles lighter (much lighter on
 *                 a deep skin, whose redness shows less); the inner arm paler, a little blue over its veins; a low
 *                 MOTTLE everywhere (no real skin is one flat colour) and freckles where the sun falls, by dial
 *   roughness     the T-zone oily (the forehead's middle, the nose, the chin), the lips and the nails glossy, the palms,
 *                 the soles, the elbows and the knees matte
 *   translucency  how thin the skin is (the subsurface cheat: light through the ears, the nostrils, the lips, the
 *                 eyelids and the fingers' edges; the trunk thick)
 *   tension       Langer's lines: the direction the skin is stretched, as an angle in the chart (0 down the part, π/2
 *                 round it): round the limbs and the neck, across the trunk with an oblique fall on the flanks
 *   hair tracts   per address: `kind` terminal | vellus | none, `density` (follicles per cm²), `length` (mm), `flow`
 *                 (the angle the hair lies along, in the chart), `lift` (its rise off the skin, radians), the `tract`'s
 *                 name. The scalp's crown whorl, the beard (cheeks down, the upper lip down and out), the forearm's
 *                 drift to the ulnar side, the shin's down and out, the chest's toward the midline and down; vellus
 *                 (peach fuzz: no strands, a sheen, `fuzz`) wherever no terminal hair grows; none on glabrous skin
 *
 *   readDermis(spec)           a preset id, a document, or { from, …changes } → the dermis (every dial resolved)
 *   dermisAt(address, dermis, { detail })  → { regions, kind, albedo (linear RGB 0 … 1), freckleMask, roughness,
 *                                  translucency, fuzz, tension, relief, hair } (`detail: false` leaves the freckles to
 *                                  the caller: a texture paints them per texel)
 *
 * An address is { key, part, side, along, around, length (m), girth (m) } (a chart sample, or a texel's). Colours are
 * the egocube's (egocube/ancestry.js: the Monk Skin Tone swatches, the undertones, the hair colours), never this
 * module's own. Pure and deterministic: lattice noise and seeds, no clock.
 */
import { vnoise, hash3 } from '../era/dirt.js';
import { strHash } from '../city/plan/dice.js';
import { MST, UNDERTONES, HAIR_COLOURS } from '../egocube/ancestry.js';
import { SKIN_REGIONS } from './skin-relief.js';

/** The dials and their ranges (a value outside is an error: the map is laid by them). */
export const DERMIS_DIALS = Object.freeze({
  tone: 'an MST swatch 1 … 10 (egocube/ancestry.js) or a hex',
  undertone: UNDERTONES.join(' | '),
  sex: "'male' | 'female' (which tracts grow terminal hair by default)",
  age: '0 … 1 (mottle, sallowness, roughness)',
  zones: '0 … 1.5 (the colour zones\' strength)',
  flush: '0 … 1.5 (the blood\'s redness)',
  freckles: '0 … 1',
  oil: '0 … 1 (the T-zone\'s sheen)',
  hairline: '0.8 … 1.2 (the scalp\'s front edge; 1 the natural)',
  beard: '0 … 1.5 (the beard tract\'s density)',
  stubble: 'mm, 0 … 30 (the beard\'s length: 1 a shadow, 4 stubble, 12 a short beard)',
  body: '0 … 1.5 (the body\'s terminal hair: the limbs, the chest)',
  axilla: '0 … 1',
  hairColour: `an egocube hair colour (${Object.keys(HAIR_COLOURS).join(', ')}) or a hex`,
  seed: 'an integer',
});
const RANGES = { age: [0, 1], zones: [0, 1.5], flush: [0, 1.5], freckles: [0, 1], oil: [0, 1], hairline: [0.8, 1.2], beard: [0, 1.5], stubble: [0, 30], body: [0, 1.5], axilla: [0, 1] };

export const DERMIS_PRESETS = Object.freeze({
  male: { sex: 'male', tone: 3, undertone: 'neutral', age: 0.35, zones: 1, flush: 1, freckles: 0, oil: 0.5, hairline: 1, beard: 1, stubble: 1, body: 1, axilla: 1, hairColour: 'dark-brown', seed: 1 },
  female: { sex: 'female', tone: 3, undertone: 'neutral', age: 0.3, zones: 1, flush: 1, freckles: 0, oil: 0.45, hairline: 1, beard: 0, stubble: 0, body: 0.12, axilla: 0, hairColour: 'dark-brown', seed: 1 },
});

/** The dermis: a preset id, a document, or { from, …changes }. Throws on an unknown dial or a value out of range. */
export function readDermis(spec = 'male') {
  const doc = typeof spec === 'string' ? { from: spec } : spec || {};
  const from = doc.from || (doc.sex === 'female' ? 'female' : 'male');
  const base = DERMIS_PRESETS[from];
  if (!base) throw new Error(`dermis: unknown preset '${from}' (have ${Object.keys(DERMIS_PRESETS).join(', ')})`);
  const { from: _f, ...rest } = doc;
  for (const k of Object.keys(rest)) if (!(k in DERMIS_DIALS)) throw new Error(`dermis: unknown dial '${k}' (have ${Object.keys(DERMIS_DIALS).join(', ')})`);
  const D = { ...base, ...rest };
  for (const [k, [lo, hi]] of Object.entries(RANGES)) if (!(Number.isFinite(D[k]) && D[k] >= lo && D[k] <= hi)) throw new Error(`dermis: ${k} ${D[k]} (${DERMIS_DIALS[k]})`);
  if (!(typeof D.tone === 'string' ? /^#[0-9a-f]{6}$/i.test(D.tone) : Number.isInteger(D.tone) && D.tone >= 1 && D.tone <= 10)) throw new Error(`dermis: tone ${D.tone} (${DERMIS_DIALS.tone})`);
  if (!UNDERTONES.includes(D.undertone)) throw new Error(`dermis: undertone '${D.undertone}' (have ${UNDERTONES.join(', ')})`);
  if (D.sex !== 'male' && D.sex !== 'female') throw new Error(`dermis: sex '${D.sex}' (male | female)`);
  if (!(HAIR_COLOURS[D.hairColour] || /^#[0-9a-f]{6}$/i.test(D.hairColour))) throw new Error(`dermis: hairColour '${D.hairColour}' (${DERMIS_DIALS.hairColour})`);
  if (!Number.isInteger(D.seed)) throw new Error('dermis: seed is an integer');
  return Object.freeze(D);
}

// ─── colour ───
export const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export const hexLin = (hex) => [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));
export const linHex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(1, toSrgb(x))) * 255).toString(16).padStart(2, '0')).join('')}`;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulc = (a, m) => [a[0] * m[0], a[1] * m[1], a[2] * m[2]];
/** a multiplicative tint eased in by t: 1 + (m − 1)·t per channel */
const tint = (c, m, t) => [c[0] * (1 + (m[0] - 1) * t), c[1] * (1 + (m[1] - 1) * t), c[2] * (1 + (m[2] - 1) * t)];
const UNDERTONE_TINT = { cool: [0.99, 0.985, 1.03], neutral: [1, 1, 1], warm: [1.03, 1, 0.94], olive: [0.985, 1.01, 0.92] };
// the zones' tints (multiplicative, linear): blood, the bony yellow, the beard's cool shadow, a vein's blue, a freckle
const BLOOD = [1.0, 0.72, 0.7], YELLOW = [1.03, 0.99, 0.84], COOL = [0.84, 0.9, 0.97], VEIN = [0.93, 0.95, 1.04], FRECKLE = [0.8, 0.68, 0.56];
const PALM = hexLin('#e3ad98'), NAIL = hexLin('#efc4b8');

// ─── the masks ───
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 1 inside [a, b], easing out over `s` either side */
const band = (x, a, b, s) => smooth(a - s, a + s, x) * (1 - smooth(b - s, b + s, x));
/** the angular distance between two `around`s (turns, 0 … 0.5) */
const ad = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
/** within r of a centre: 1 at it, 0 past r */
const near = (d, r) => 1 - smooth(r * 0.5, r, d);
/** a soft blob on the skin, `r` mm across: the address's distance (mm, round and down the part) from a centre */
const blob = (A, around, along, r) => { const dx = ad(A.around, around) * A.girth * 1000, dy = (A.along - along) * A.length * 1000; return Math.exp(-((dx * dx + dy * dy) / (r * r))); };
/** which way round from a toward b is shorter: +1 (around increasing) or −1 */
const toward = (a, b) => { const d = ((b - a) % 1 + 1) % 1; return d <= 0.5 ? 1 : -1; };
/** a direction in the chart as an angle (0 down the part, π/2 round it, increasing): `down` ±1 along, a slant `round` */
const flowOf = (down, round = 0) => Math.atan2(round, down);

/** The head's proportions as `along` (menton 0 → vertex 1): the face's thirds and its features. */
export const HEAD_LEVELS = Object.freeze({ mouth: 0.18, noseBase: 0.27, eye: 0.46, brow: 0.52, hairline: 0.78 });

/** the scalp's front edge at an angle round the head (0 the face's middle, 0.5 the nape): the hairline recedes at the
 * temples' corners, comes down the sideburn in front of the ear, rises over it and falls behind it to the nape */
function hairlineAt(d, H, male) {
  const pts = [[0, H], [0.1, H - 0.015], [0.16, H - (male ? 0.07 : 0.04)], [0.2, male ? 0.42 : 0.52], [0.24, 0.62], [0.37, 0.62], [0.42, 0.42], [0.47, 0.28], [0.5, 0.22]];
  for (let i = 0; i + 1 < pts.length; i++) if (d <= pts[i + 1][0]) { const [a, ha] = pts[i], [b, hb] = pts[i + 1]; return ha + ((d - a) / (b - a)) * (hb - ha); }
  return 0.2;
}

/** The regions at an address: { name: weight } (weights in 0 … 1, several may overlap; the dominant names the kind). */
export function dermalRegions(A, D) {
  const { part, along: u, around: a } = A, R = {};
  const front = ad(a, 0), back = ad(a, 0.5);
  const put = (k, w) => { if (w > 0.002) R[k] = Math.max(R[k] || 0, Math.min(1, w)); };
  if (part === 'head') {
    const L = HEAD_LEVELS, male = D.sex === 'male', H = L.hairline * D.hairline;
    const hl = hairlineAt(front, H, male), scalp = smooth(hl - 0.02, hl + 0.02, u);
    put('scalp', scalp);
    const face = (1 - scalp) * near(front, 0.24);
    put('ear', (1 - scalp) * near(Math.abs(front - 0.31), 0.07) * band(u, L.noseBase, L.brow + 0.05, 0.03));
    put('forehead', face * smooth(L.brow - 0.02, L.brow + 0.03, u));
    put('nose', face * near(front, 0.045) * band(u, L.noseBase, L.eye + 0.03, 0.02));
    put('cheek', face * near(Math.abs(front - 0.11), 0.07) * band(u, L.noseBase - 0.04, L.eye - 0.04, 0.03));
    put('eyelid', face * near(Math.abs(front - 0.085), 0.05) * band(u, L.eye - 0.02, L.brow - 0.015, 0.012));
    put('underEye', face * near(Math.abs(front - 0.085), 0.06) * band(u, L.eye - 0.08, L.eye - 0.025, 0.015));
    put('lip', face * near(front, 0.065) * band(u, L.mouth - 0.035, L.mouth + 0.04, 0.012));
    put('chin', face * near(front, 0.09) * smooth(L.mouth - 0.03, L.mouth - 0.08, u));
    // the beard: the lower face, up the cheek to the cheekbone's line, the sideburn to the ear's top, not the lips
    // (the moustache up to the nose's base at the middle, dipping to the mouth's corner, rising to the sideburn)
    const cheekLine = front < 0.05 ? L.noseBase : front < 0.085 ? L.noseBase - (L.noseBase - L.mouth - 0.02) * smooth(0.05, 0.085, front) : L.mouth + 0.02 + (L.brow - 0.14 - L.mouth - 0.02) * smooth(0.085, 0.2, front);
    put('beard', (1 - scalp) * near(front, 0.22) * smooth(cheekLine + 0.02, cheekLine - 0.03, u) * (1 - (R.lip || 0)) + (1 - scalp) * band(front, 0.17, 0.225, 0.015) * smooth(L.brow + 0.02, L.brow - 0.04, u));
    put('face', face);
    put('headSide', (1 - scalp) * (1 - face) * 0.6);
    // a pinned feature (the chart's: an ear, a nostril, a lip, a lid) is that region whatever its address says
    if (A.feature) put(A.feature === 'ear' ? 'ear' : A.feature === 'nose' ? 'nose' : A.feature === 'lip' ? 'lip' : 'eyelid', 1);
  } else if (part === 'neck') {
    put('neck', 1);
    put('beard', near(front, 0.28) * smooth(0.5, 0.75, u));
  } else if (part === 'trunk') {
    put('chest', near(front, 0.25) * smooth(0.5, 0.62, u));
    put('abdomen', near(front, 0.25) * smooth(0.6, 0.5, u));
    put('back', near(back, 0.3));
    put('flank', near(Math.min(ad(a, 0.25), ad(a, 0.75)), 0.12));
    put('axilla', near(Math.min(ad(a, 0.25), ad(a, 0.75)), 0.07) * smooth(0.78, 0.9, u));
    put('shoulder', smooth(0.86, 0.97, u));
  } else if (part === 'pelvis') {
    put(back < 0.25 ? 'seat' : 'hip', 1);
  } else if (part === 'upperArm') {
    put('arm', 1);
    put('innerArm', near(ad(a, 0.75), 0.2));
    put('elbow', blob(A, 0.5, 1, 45));
    put('axilla', near(ad(a, 0.75), 0.15) * smooth(0.14, 0.04, u));
    put('shoulder', near(ad(a, 0.25), 0.25) * smooth(0.25, 0.05, u));
  } else if (part === 'forearm') {
    put('arm', 1);
    put('innerArm', near(front, 0.22));
    put('elbow', blob(A, 0.5, 0, 45));
    put('wrist', near(front, 0.2) * smooth(0.82, 0.95, u));
  } else if (part === 'hand' || part === 'finger') {
    const palm = near(front, 0.24);
    put('palm', palm);
    put('dorsum', 1 - palm);
    if (part === 'hand') put('knuckles', (1 - palm) * smooth(0.75, 0.95, u));
    else {
      put('knuckles', (1 - palm) * (near(Math.abs(u - 0.38), 0.07) + near(Math.abs(u - 0.68), 0.06)));
      put('nail', near(back, 0.13) * smooth(0.74, 0.8, u));
      put('fingertip', smooth(0.82, 0.97, u));
    }
  } else if (part === 'thigh') {
    put('leg', 1);
    put('innerArm', near(ad(a, 0.75), 0.18) * 0.6);   // the inner thigh: pale, thin, out of the sun, as the inner arm
    put('knee', blob(A, 0, 1, 60));
  } else if (part === 'shank') {
    put('leg', 1);
    put('knee', blob(A, 0, 0, 60));
    put('shin', near(ad(a, 0.06), 0.09) * band(u, 0.15, 0.85, 0.05));
  } else if (part === 'foot' || part === 'toe') {
    const sole = near(front, 0.22);
    put('sole', sole);
    put('dorsum', 1 - sole);
    if (part === 'foot') put('heel', smooth(0.25, 0.08, u) * (1 - near(back, 0.15)));
    else { put('nail', near(back, 0.14) * smooth(0.72, 0.8, u)); put('fingertip', smooth(0.8, 0.95, u)); }
  }
  return R;
}

/** the dominant region's name (what kind of skin this is) */
export const dominant = (R) => Object.entries(R).reduce((m, [k, w]) => (w > m[1] ? [k, w] : m), ['skin', 0])[0];

const GLABROUS = (R) => Math.max(R.palm || 0, R.sole || 0);

/** a seam-free low noise round a part: the two ends of the ring blended (periodic in `around`) */
function ringNoise(A, cellMm, seed) {
  const G = A.girth * 1000, x = A.around * G / cellMm, y = A.along * A.length * 1000 / cellMm, g = G / cellMm;
  return vnoise(x, y, seed) * (1 - A.around) + vnoise(x - g, y, seed) * A.around;
}

/** a part's own seed (the two sides' patterns differ) */
export const seedOf = (A, D) => (D.seed * 7919 + strHash(A.key || A.part)) | 0;

/** The skin at an address. */
export function dermisAt(A, D, { detail = true } = {}) {
  const R = dermalRegions(A, D), w = (k) => R[k] || 0;
  const seed = seedOf(A, D);
  // ── colour: the swatch, its undertone, then the zones ──
  const base0 = typeof D.tone === 'string' ? hexLin(D.tone) : hexLin(MST[D.tone - 1]);
  const mel = Math.max(0, Math.min(1, 1 - lum(base0) / lum(hexLin(MST[0]))));   // 0 the lightest swatch … ~1 the deepest
  let c = mulc(base0, UNDERTONE_TINT[D.undertone]);
  const Z = D.zones, show = 1 - 0.6 * mel;   // a deep skin shows its blood less
  const blood = Math.max(w('cheek') * 0.55, w('nose') * 0.6, w('ear') * 0.7, w('knuckles') * 0.6, w('elbow') * 0.5, w('knee') * 0.5, w('fingertip') * 0.55, w('palm') * 0.25, w('sole') * 0.3, w('heel') * 0.4, w('underEye') * 0.15, w('lip') * 0.3, w('axilla') * 0.1);
  const middle = A.part === 'head' ? band(A.along, HEAD_LEVELS.noseBase, HEAD_LEVELS.brow, 0.03) * w('face') * 0.3 : 0;
  c = tint(c, BLOOD, (blood + middle) * D.flush * Z * show);
  c = tint(c, YELLOW, Math.max(w('forehead') * 0.5, w('shin') * 0.4, w('knee') * 0.25, w('elbow') * 0.25, w('heel') * 0.3, w('chin') * 0.2) * Z * (0.4 + 0.6 * D.age));
  const shadow = D.sex === 'male' ? w('beard') * Math.min(1, D.beard) * (D.stubble > 0 ? 0.6 : 0.3) : 0;
  c = tint(c, COOL, Math.max(shadow, w('underEye') * 0.3) * Z);
  c = tint(c, VEIN, w('innerArm') * 0.6 * Z * (1 - mel) + w('wrist') * 0.4 * Z * (1 - mel));
  c = mixc(c, mulc(c, [1.08, 1.06, 1.05]), w('innerArm') * 0.5);   // the inner arm: paler, out of the sun
  // glabrous skin: less melanin, so lighter and pinker, the more so the deeper the skin
  c = mixc(c, mixc(PALM, mulc(base0, [1.25, 1.1, 1.05]), 0.35), GLABROUS(R) * (0.15 + 0.65 * mel));
  // the extensor skin darker on a deeper skin (its folds)
  c = tint(c, [0.82, 0.8, 0.8], Math.max(w('knee'), w('elbow'), w('knuckles') * 0.8) * (0.15 + 0.6 * mel) * Z);
  if (w('lip')) c = mixc(c, mulc(base0, [0.8 - 0.1 * mel, 0.48 + 0.05 * mel, 0.5 + 0.05 * mel]), w('lip') * 0.75);
  if (w('nail')) c = mixc(c, mixc(NAIL, base0, 0.3), w('nail') * 0.8);
  // the mottle: a low wash of luminance and a finer one of blood (no skin is one colour), more with age
  const m1 = ringNoise(A, 60, seed) - 0.5, m2 = ringNoise(A, 14, seed + 11) - 0.5;
  c = scale3(c, 1 + m1 * (0.06 + 0.06 * D.age));
  c = tint(c, BLOOD, Math.max(0, m2) * 0.25 * D.flush * show);
  // freckles where the sun falls: the nose and the cheeks, the shoulders, the forearm's back
  const sun = Math.max(w('nose'), w('cheek'), w('shoulder') * 0.8, A.part === 'forearm' ? near(ad(A.around, 0.5), 0.3) * 0.6 : 0, w('forehead') * 0.3);
  const freckleMask = D.freckles > 0 ? sun * D.freckles * (1 - 0.7 * mel) : 0;
  if (detail && freckleMask > 0) c = tint(c, FRECKLE, freckle(A, seed) * freckleMask);
  // ── sheen ──
  let rough = 0.52 + 0.06 * D.age;
  const tzone = Math.max(w('nose'), w('forehead') * near(ad(A.around, 0), 0.08), w('chin') * 0.8);
  rough -= tzone * 0.18 * D.oil;
  rough = mix1(rough, 0.34, w('lip')); rough = mix1(rough, 0.22, w('nail'));
  rough = mix1(rough, 0.66, Math.max(GLABROUS(R), w('elbow') * 0.8, w('knee') * 0.8, w('heel')));
  // ── thinness (the subsurface's reach) ──
  let tr = A.part === 'trunk' || A.part === 'pelvis' ? 0.1 : 0.15;
  tr = Math.max(tr, w('ear') * 0.9, w('nose') * 0.45, w('lip') * 0.55, w('eyelid') * 0.6, w('cheek') * 0.28, A.part === 'finger' ? 0.45 + 0.25 * w('fingertip') : 0, A.part === 'toe' ? 0.4 : 0, A.part === 'hand' ? 0.25 : 0, A.part === 'neck' ? 0.2 : 0);
  // ── Langer's lines ──
  let tension = Math.PI / 2;
  if (A.part === 'trunk') tension += 0.35 * Math.sin(2 * Math.PI * A.around) * (A.along - 0.4);
  if (A.part === 'head') tension = w('cheek') > 0.4 ? Math.PI / 2 - (35 * Math.PI / 180) * Math.sign(0.5 - A.around) : Math.PI / 2;
  // ── relief: the swatch's numbers by kind (skin-relief.js) ──
  const kind = dominant(R);
  const relief = GLABROUS(R) > 0.5 || w('fingertip') > 0.6 ? { class: 'glabrous', cell: 0.5, ridges: 0.48, pore: 0, poreShare: 0, furrow: 40, aniso: 3 }
    : w('lip') > 0.5 ? { class: 'lip', cell: 0.35, aniso: 2.5, furrow: 30, pore: 0, poreShare: 0 }
      : w('nail') > 0.5 ? { class: 'nail', cell: 0.6, aniso: 4, furrow: 6, pore: 0, poreShare: 0 }
        : A.part === 'head' && SKIN_REGIONS[kind] ? { class: kind, ...SKIN_REGIONS[kind] }
          : A.part === 'head' ? { class: 'face', ...SKIN_REGIONS.cheek }
            : { class: w('back') > 0.5 ? 'back' : 'body', cell: w('back') > 0.5 ? 0.9 : 0.75, aniso: 1.5, furrow: 30 + 15 * D.age, pore: w('back') > 0.5 ? 0.07 : 0.045, poreShare: 0.35 };
  const hair = hairTract(A, R, D);
  const fuzz = hair.kind === 'vellus' ? Math.min(1, hair.density * hair.length / 160) : 0;
  return { regions: R, kind, albedo: c.map((x) => Math.max(0, Math.min(1, x))), freckleMask, roughness: Math.max(0.1, Math.min(0.95, rough)), translucency: Math.min(1, tr), fuzz, tension, relief, hair };
}
const scale3 = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mix1 = (a, b, t) => a + (b - a) * t;
/** freckles: seeded dots 1–3 mm on a 4 mm lattice, a share of the cells (0 … 1 at a point) */
export function freckle(A, seed) {
  const G = A.girth * 1000, x = A.around * G / 4, y = A.along * A.length * 1000 / 4;
  let v = 0;
  for (let j = Math.floor(y) - 1; j <= Math.floor(y) + 1; j++) for (let i = Math.floor(x) - 1; i <= Math.floor(x) + 1; i++) {
    const h = hash3(i, j, seed + 3); if (h > 0.35) continue;
    const cx = i + hash3(j, i, seed + 5), cy = j + hash3(i + 7, j, seed + 9), r = 0.15 + 0.25 * hash3(i, j + 3, seed + 13);
    v = Math.max(v, 1 - smooth(r * 0.6, r, Math.hypot(x - cx, y - cy)));
  }
  return v;
}

/**
 * The hair tract at an address: { kind, tract, density (/cm²), length (mm), flow (rad, in the chart), lift (rad) }.
 * Terminal hair by the dials (`body`, `beard`, `axilla`; the scalp always, its length the scalp groom's: dermal-hair.js);
 * vellus elsewhere; none on glabrous skin, the lips, the nails, the eyelids and the ears.
 */
export function hairTract(A, R, D) {
  const w = (k) => R[k] || 0, a = A.around, u = A.along, male = D.sex === 'male';
  const none = { kind: 'none', tract: 'none', density: 0, length: 0, flow: 0, lift: 0 };
  if (GLABROUS(R) > 0.5 || w('lip') > 0.5 || w('nail') > 0.5 || w('eyelid') > 0.5 || w('ear') > 0.5) return none;
  const vellus = { kind: 'vellus', tract: 'vellus', density: 60, length: A.part === 'head' ? 1.2 : 2, flow: flowOf(1), lift: 0.35 };
  const T = (tract, density, length, flow, lift = 0.35) => (density >= 0.5 ? { kind: 'terminal', tract, density, length, flow, lift } : vellus);
  const B = D.body * (male ? 1 : 0.35);
  if (A.part === 'head') {
    if (w('scalp') > 0.5) {
      // the crown's whorl: hair falls from the vertex, turning round it the nearer it grows (clockwise from above)
      const twist = 0.9 * Math.exp(-(1 - u) / 0.12);
      return { kind: 'terminal', tract: 'scalp', density: 200, length: 0, flow: flowOf(-Math.cos(twist), Math.sin(twist)), lift: 0.6 };
    }
    if (w('beard') > 0.3 && D.beard > 0) {
      // the cheeks down and a little forward; the upper lip down and out from the middle
      const out = u > HEAD_LEVELS.mouth && u < HEAD_LEVELS.noseBase && ad(a, 0) < 0.07 ? toward(a, a < 0.5 ? 0.25 : 0.75) * 0.6 : toward(a, 0) * 0.25;
      return T('beard', 55 * D.beard * w('beard'), D.stubble, flowOf(-1, out), 0.3);
    }
    return vellus;
  }
  if (A.part === 'neck') return w('beard') > 0.3 && D.beard > 0 ? T('beard', 40 * D.beard * w('beard'), D.stubble, flowOf(-1), 0.3) : vellus;
  if (A.part === 'trunk') {
    if (w('axilla') > 0.4 && D.axilla > 0) return T('axilla', 35 * D.axilla, 14, flowOf(-1), 0.5);
    const chest = male ? w('chest') * near(Math.min(ad(a, 0), Math.abs(ad(a, 0) - 0.1)), 0.14) : 0;
    if (chest > 0.15) return T('chest', 14 * B * chest, 16, flowOf(-0.8, toward(a, 0) * 0.6), 0.3);
    if (male && w('abdomen') > 0.5 && ad(a, 0) < 0.04) return T('trail', 10 * B, 12, flowOf(-1), 0.3);
    return vellus;
  }
  if (A.part === 'upperArm') return w('axilla') > 0.4 && D.axilla > 0 ? T('axilla', 30 * D.axilla, 12, flowOf(1), 0.5) : T('upperArm', 7 * B * (1 - 0.5 * w('innerArm')), 9, flowOf(1, 0.15));
  if (A.part === 'forearm') return T('forearm', (28 - 16 * w('innerArm')) * B, 10, flowOf(1, toward(a, 0.75) * 0.65), 0.3);
  if (A.part === 'hand') return T('hand', 6 * B * (1 - w('palm')), 6, flowOf(1, toward(a, 0.75) * 0.4));
  if (A.part === 'finger') return u < 0.42 && w('dorsum') > 0.5 ? T('finger', 5 * B, 5, flowOf(1)) : none;
  if (A.part === 'thigh') return T('thigh', (18 - 9 * w('innerArm')) * B, 12, flowOf(1, toward(a, 0.25) * 0.3));
  if (A.part === 'shank') return T('shank', (24 - 10 * near(ad(a, 0.75), 0.2)) * B, 14, flowOf(1, toward(a, 0.25) * 0.4));
  if (A.part === 'foot') return T('foot', 4 * B * w('dorsum') * smooth(0.3, 0.6, u), 7, flowOf(1));
  if (A.part === 'toe') return u < 0.45 && w('dorsum') > 0.5 ? T('toe', 4 * B, 5, flowOf(1)) : none;
  return vellus;
}

/** the hair's colour (linear RGB) from the dermis's word */
export const hairColourOf = (D) => hexLin(HAIR_COLOURS[D.hairColour] || D.hairColour);
