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
  round: '−1 … 1 (the hairline\'s front between the middle and the temples: − straight across, + rounded; absent 0)',
  temples: 'mm, −8 … 40 (the temples\' corners receded past the natural; − fuller; absent 0)',
  peak: 'mm, 0 … 10 (a widow\'s peak: the hairline dipping at the middle; absent 0)',
  sideburn: 'mm, −12 … 15 (the sideburn\'s foot lower; − shorter; absent 0)',
  nape: 'mm, −15 … 20 (the nape\'s line lower; − higher; absent 0)',
  marks: 'the skin\'s MARKS on the face: [{ kind: mole | beauty | cafe | wine, at: [X, Y] (mm on the head: X out from the middle, the figure\'s right +, round the head; Y up from the menton), size: mm }] (a mole a raised brown dot, a beauty mark a small dark one, a café-au-lait patch a light brown stain, a port-wine stain a red-violet one; absent, none)',
  shade: '0 … 1, or { amount 0 … 1, colour?: a hex (the shade\'s hue: an art direction\'s shadow), steps?: 0 smooth | 2 … 8 hard bands (a cel look), curve?: \'linear\' | \'deep\' (a near-black, only where the skin is enclosed deepest) } (the broad SHADING painted into the colour, as a game paints its light in: the sockets, under the cheekbone, beside the nose, under the lip and the jaw; absent 0, the colour as it was)',
  bald: '0 … 1 (hair loss by its sex\'s pattern: a man\'s temples, then the crown, then the front, to the horseshoe; a woman\'s front kept, the crown and the part thinned; absent 0)',
  beard: '0 … 1.5 (the beard tract\'s density)',
  stubble: 'mm, 0 … 30 (the beard\'s length: 1 a shadow, 4 stubble, 12 a short beard)',
  beardStyle: `a beard's style (BEARD_STYLES): a word, or { style, lengths?: { moustache, chin, cheek } mm } (its zones over the beard tract, a length a zone, the moustache trimmed at the lip line unless the style lets it over; absent, the tract and \`stubble\` as they were)`,
  body: '0 … 1.5 (the body\'s terminal hair: the limbs, the chest)',
  axilla: '0 … 1',
  lines: '0 … 1 (the face\'s lines: the forehead\'s, the frown, crow\'s feet, the nasolabial fold, under the eyes)',
  dirt: '0 … 1 (grime in the cavities and in blotches: the road\'s)',
  paint: `a war paint: null, or { pattern: eyes | stripes | band | chin | mask, colour: a word (woad, soot, ochre, chalk, blood) or a hex, amount 0 … 1 }`,
  grey: '0 … 1 (the share of the hair gone grey: each strand silver or its own colour, the beard\'s first, the body\'s last; absent 0)',
  hairColour: `an egocube hair colour (${Object.keys(HAIR_COLOURS).join(', ')}) or a hex`,
  seed: 'an integer',
});
/**
 * THE BEARD'S STYLES (a barber's lines over the beard tract): which ZONES grow (the moustache, the corners joining it to
 * the chin, the chin, a soul patch under the lip, the cheeks; or only a `strap` along the jaw), where the cheek line sits
 * (`cheek`, mm lower), how far under the jaw it runs (`neck`, mm below the menton; absent, the tract's own fade down the
 * throat), and each zone's length (mm). Lengths of 6 mm and more grow as locks (dermal-hair.js).
 */
export const BEARD_STYLES = Object.freeze({
  stubble: { zones: { moustache: 1, corners: 1, chin: 1, soul: 1, cheeks: 1 }, lengths: { moustache: 3, chin: 3, cheek: 3 } },
  'short-boxed': { zones: { moustache: 1, corners: 1, chin: 1, soul: 1, cheeks: 1 }, cheek: 6, neck: 14, lengths: { moustache: 8, chin: 10, cheek: 8 } },
  full: { zones: { moustache: 1, corners: 1, chin: 1, soul: 1, cheeks: 1 }, lengths: { moustache: 16, chin: 40, cheek: 24 } },
  goatee: { zones: { moustache: 1, corners: 1, chin: 1, soul: 1 }, neck: 8, lengths: { moustache: 10, chin: 14, cheek: 0 } },
  'van-dyke': { zones: { moustache: 1, chin: 1, soul: 1 }, neck: 4, lengths: { moustache: 14, chin: 22, cheek: 0 } },
  'chin-strap': { zones: { chin: 1, cheeks: 1 }, strap: 12, neck: 10, lengths: { moustache: 0, chin: 6, cheek: 6 } },
  moustache: { zones: { moustache: 1 }, lengths: { moustache: 10, chin: 0, cheek: 0 } },
});
/** a styled beard's density (× the tract's) and lift (its hairs' rise off the skin, its volume) by zone: the moustache
 * thickest and bushiest, the chin and the cheeks full (the operator's eyes, 2026-10-22) */
export const BEARD_ZONES = Object.freeze({ density: { moustache: 2.4, chin: 1.6, cheek: 1.6 }, lift: { moustache: 0.7, chin: 0.5, cheek: 0.5 } });
/**
 * THE BEARD'S GROWTH DIRECTION on the relational head, as a barber reads it (the slant `round` of `flowOf(-1, round)`, +
 * toward the face's front): the sideburn straight down; the cheek down and toward the chin, the more the lower; the chin
 * down, gathering to its middle; the moustache out from the philtrum to the mouth's corners, flatter toward them; under
 * the jaw, back toward the throat.
 */
function beardFlow(A, lip) {
  const q = headXY(A), M = A.marks.points, x = Math.abs(q.X), a = A.around, chW = Math.abs(M.chR.X), fwd = toward(a, 0);
  if (lip) return toward(a, a < 0.5 ? 0.25 : 0.75) * (0.45 + 0.6 * smooth(0, chW, x));
  const ear = Math.abs(M.porionR.X), under = 1 - smooth(M.me.Y - 4, M.me.Y + 8, q.Y);
  const chin = 1 - smooth(chW + 4, chW + 16, x), side = smooth(ear * 0.55, ear * 0.85, x);
  const cheek = fwd * (0.2 + 0.4 * (1 - smooth(M.goR.Y, M.sto.Y + 20, q.Y))) * (1 - side) * (1 - chin);
  return cheek - fwd * 0.12 * chin * (1 - under) - fwd * 0.2 * under * (1 - chin);
}
/** the beard's style at an address on the relational head: { mask 0 … 1 over the tract, length mm } (null without a style) */
export function beardStyleAt(A, D) {
  if (!D.beardStyle || !A.marks) return null;
  const B = beardStyleOf(D.beardStyle), M = A.marks.points, q = headXY(A), x = Math.abs(q.X), Z = B.zones;
  const chW = Math.abs(M.chR.X) + 2, sto = M.sto.Y, li = M.li.Y, sn = M.sn.Y, me = M.me.Y;
  const inX = (a, b, f = 3) => smooth(a - f, a + f, x) * (1 - smooth(b - f, b + f, x)), inY = (a, b, f = 2) => smooth(a - f, a + f, q.Y) * (1 - smooth(b - f, b + f, q.Y));
  const w = {
    moustache: (Z.moustache ?? 0) * inX(-10, chW + 4) * inY(sto + 1, sn),
    corners: (Z.corners ?? 0) * inX(chW - 2, chW + 10) * inY(li - 8, sto + 1),
    chin: (Z.chin ?? 0) * inX(-10, chW + 10) * (1 - smooth(li - 6, li - 2, q.Y)),
    soul: (Z.soul ?? 0) * inX(-10, 8) * inY(li - 16, li - 1),
    cheeks: (Z.cheeks ?? 0) * smooth(chW + 7, chW + 13, x) * (1 - smooth(sto - 2, sto + 4, q.Y) * (1 - smooth(chW + 14, chW + 22, x))),
  };
  // (a strap: only a band along the jaw; the cheek line lowered; the neckline under the jaw)
  if (B.strap) w.cheeks *= 1 - smooth(me + B.strap - 3, me + B.strap + 3, q.Y);
  let mask = Math.min(1, Math.max(...Object.values(w)));
  if (B.neck !== undefined) mask *= smooth(me - B.neck - 3, me - B.neck + 3, q.Y);
  const L = B.lengths, ws = (w.moustache + w.corners * 0.5) + (w.chin + w.soul + w.corners * 0.5) + w.cheeks || 1;
  const by = (V) => ((w.moustache + w.corners * 0.5) * V.moustache + (w.chin + w.soul + w.corners * 0.5) * V.chin + w.cheeks * V.cheek) / ws;
  return { mask, length: by(L), density: by(BEARD_ZONES.density), lift: by(BEARD_ZONES.lift), cheek: B.cheek ?? 0 };
}
/** a style word or { style, lengths } → the style, its lengths over the word's */
export const beardStyleOf = (s) => (typeof s === 'string' ? BEARD_STYLES[s] : { ...BEARD_STYLES[s.style], lengths: { ...BEARD_STYLES[s.style].lengths, ...(s.lengths || {}) } });
/**
 * THE SKIN'S MARKS: each its colour over the skin's (linear, multiplied), how hard its edge is, how irregular (a stain's
 * outline wanders; a mole is round), how much it lies on top (a mole's, a little lighter at its middle where it rises).
 */
export const MARK_KINDS = Object.freeze({
  mole: { tint: [0.42, 0.3, 0.24], edge: 0.25, wander: 0.08, depth: 0.9 },
  beauty: { tint: [0.28, 0.2, 0.17], edge: 0.2, wander: 0.04, depth: 1 },
  cafe: { tint: [0.86, 0.74, 0.62], edge: 0.6, wander: 0.35, depth: 0.85 },
  wine: { tint: [0.92, 0.55, 0.62], edge: 0.45, wander: 0.3, depth: 0.85 },
});
/** the marks' cover at an address on the head: the tint the skin's colour is multiplied by, 1 where none lies */
function marksAt(A, D) {
  if (!D.marks?.length || A.part !== 'head' || !A.marks) return null;
  const q = headXY(A);
  let out = null;
  D.marks.forEach((m, i) => {
    const K = MARK_KINDS[m.kind], r = m.size / 2, dx = q.X - m.at[0], dy = q.Y - m.at[1], d = Math.hypot(dx, dy);
    if (d > r * (1.6 + K.wander)) return;
    // (a stain's edge wanders by the angle round it, a seeded noise: never a disc)
    const ang = Math.atan2(dy, dx), rr = r * (1 + K.wander * (2 * vnoise(Math.cos(ang) * 1.7 + i * 3.1, Math.sin(ang) * 1.7, D.seed + 97 + i) - 1));
    const w = K.depth * (1 - smooth(rr * (1 - K.edge), rr, d));
    if (w <= 0) return;
    out = (out || [1, 1, 1]).map((v, k) => v * (1 + (K.tint[k] - 1) * w));
  });
  return out;
}
/** the shade's curves: `linear` as deep as the occlusion; `deep` the same until the skin is enclosed deepest, then a near-black */
export const SHADE_CURVES = Object.freeze(['linear', 'deep']);
/** the dials a map may name or not (absent, they add nothing): checked only when given */
const OPTIONAL_RANGES = { round: [-1, 1], temples: [-8, 40], peak: [0, 10], sideburn: [-12, 15], nape: [-15, 20], bald: [0, 1], grey: [0, 1] };
const RANGES = { lines: [0, 1], dirt: [0, 1], age: [0, 1], zones: [0, 1.5], flush: [0, 1.5], freckles: [0, 1], oil: [0, 1], hairline: [0.8, 1.2], beard: [0, 1.5], stubble: [0, 30], body: [0, 1.5], axilla: [0, 1] };

// (the male's hairline lower than the natural and a widow's peak at its middle: the male pole's, 2026-10-22, the operator's eyes)
export const DERMIS_PRESETS = Object.freeze({
  male: { lines: 0, dirt: 0, paint: null, sex: 'male', tone: 3, undertone: 'neutral', age: 0.35, zones: 1, flush: 1, freckles: 0, oil: 0.5, hairline: 0.88, peak: 5, beard: 1, stubble: 1, body: 1, axilla: 1, hairColour: 'dark-brown', seed: 1 },
  female: { lines: 0, dirt: 0, paint: null, sex: 'female', tone: 3, undertone: 'neutral', age: 0.3, zones: 1, flush: 1, freckles: 0, oil: 0.45, hairline: 1, beard: 0, stubble: 0, body: 0.12, axilla: 0, hairColour: 'dark-brown', seed: 1 },
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
  for (const [k, [lo, hi]] of Object.entries(OPTIONAL_RANGES)) if (D[k] !== undefined && !(Number.isFinite(D[k]) && D[k] >= lo && D[k] <= hi)) throw new Error(`dermis: ${k} ${D[k]} (${DERMIS_DIALS[k]})`);
  if (D.marks !== undefined) {
    if (!Array.isArray(D.marks) || D.marks.length > 24 || D.marks.some((m) => !m || !MARK_KINDS[m.kind] || !Array.isArray(m.at) || m.at.length !== 2 || !m.at.every(Number.isFinite) || !(m.size > 0 && m.size <= 60)))
      throw new Error(`dermis: marks ${JSON.stringify(D.marks).slice(0, 120)} (${DERMIS_DIALS.marks})`);
  }
  if (D.beardStyle !== undefined) {
    const s = D.beardStyle, word = typeof s === 'string' ? s : s?.style;
    if (!BEARD_STYLES[word] || (typeof s === 'object' && (Object.keys(s).some((k) => !['style', 'lengths'].includes(k)) || (s.lengths && Object.entries(s.lengths).some(([k, v]) => !['moustache', 'chin', 'cheek'].includes(k) || !(v >= 0 && v <= 120))))))
      throw new Error(`dermis: beardStyle ${JSON.stringify(s)} (a word: ${Object.keys(BEARD_STYLES).join(', ')}; or { style, lengths?: { moustache, chin, cheek } mm 0 … 120 })`);
  }
  if (D.shade !== undefined) {
    const Sh = typeof D.shade === 'number' ? { amount: D.shade } : D.shade, in01 = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
    if (!Sh || typeof Sh !== 'object' || !in01(Sh.amount) || Object.keys(Sh).some((k) => !['amount', 'colour', 'steps', 'curve'].includes(k)) || (Sh.curve !== undefined && !SHADE_CURVES.includes(Sh.curve))
      || (Sh.colour !== undefined && !/^#[0-9a-f]{6}$/i.test(Sh.colour)) || (Sh.steps !== undefined && !(Sh.steps === 0 || (Number.isInteger(Sh.steps) && Sh.steps >= 2 && Sh.steps <= 8)))) throw new Error(`dermis: shade ${JSON.stringify(D.shade)} (${DERMIS_DIALS.shade})`);
  }
  if (!(typeof D.tone === 'string' ? /^#[0-9a-f]{6}$/i.test(D.tone) : Number.isInteger(D.tone) && D.tone >= 1 && D.tone <= 10)) throw new Error(`dermis: tone ${D.tone} (${DERMIS_DIALS.tone})`);
  if (!UNDERTONES.includes(D.undertone)) throw new Error(`dermis: undertone '${D.undertone}' (have ${UNDERTONES.join(', ')})`);
  if (D.sex !== 'male' && D.sex !== 'female') throw new Error(`dermis: sex '${D.sex}' (male | female)`);
  if (!(HAIR_COLOURS[D.hairColour] || /^#[0-9a-f]{6}$/i.test(D.hairColour))) throw new Error(`dermis: hairColour '${D.hairColour}' (${DERMIS_DIALS.hairColour})`);
  if (!Number.isInteger(D.seed)) throw new Error('dermis: seed is an integer');
  if (D.paint !== null) {
    const P = D.paint;
    if (!P || typeof P !== 'object' || !PAINT_PATTERNS.includes(P.pattern)) throw new Error(`dermis: paint { pattern: ${PAINT_PATTERNS.join(' | ')}, colour, amount }`);
    if (P.colour !== undefined && !(PAINT_COLOURS[P.colour] || /^#[0-9a-f]{6}$/i.test(P.colour))) throw new Error(`dermis: paint.colour (${Object.keys(PAINT_COLOURS).join(', ')} or a hex)`);
    if (P.amount !== undefined && !(P.amount >= 0 && P.amount <= 1)) throw new Error('dermis: paint.amount 0 … 1');
  }
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
const UNDERTONE_TINT = { cool: [0.99, 0.985, 1.03], neutral: [1, 1, 1], warm: [1.03, 1, 0.94], olive: [0.99, 1.008, 0.955] };
// the zones' tints (multiplicative, linear): blood, the bony yellow, the beard's cool shadow, a vein's blue, a freckle
const BLOOD = [1.0, 0.72, 0.7], YELLOW = [1.03, 0.99, 0.84], COOL = [0.84, 0.9, 0.97], VEIN = [0.93, 0.95, 1.04], FRECKLE = [0.8, 0.68, 0.56];
const PALM = hexLin('#e3ad98'), NAIL = hexLin('#efc4b8');
/** The tone as an ALBEDO (linear). A swatch is skin as a camera saw it, and the deepest swatches photograph near-black and
 * grey (MST 9 and 10 have less red over blue than MST 6), where measured deep skin stays a strongly red-sloped ~5 % (its
 * melanin takes the blue first). Below the deep knee (MST 8's luminance) the swatch keeps its order but is lifted
 * (luminance by a square root under the knee) and holds the knee's warmth. A tone at or above the knee is its swatch. */
const DEEP = hexLin(MST[7]), DEEP_L = lum(DEEP), DEEP_Q = DEEP.map((x) => x / DEEP_L);
export const toneAlbedo = (tone) => {
  const c = typeof tone === 'string' ? hexLin(tone) : hexLin(MST[tone - 1]), L = lum(c);
  if (!(L < DEEP_L) || L <= 0) return c;
  const L2 = DEEP_L * Math.sqrt(L / DEEP_L), s = smooth(0, 0.5, 1 - L / DEEP_L);
  return c.map((x, k) => L2 * (x / L + (DEEP_Q[k] - x / L) * s));
};

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
  if (part === 'head' && A.marks) relationalHeadRegions(A, D, put, R);
  else if (part === 'head') {
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
    // (at the neck's top the beard wraps on round, under the ears and behind the jaw's angle, as the head's does)
    put('beard', near(front, 0.28 + 0.14 * smooth(0.72, 0.95, u)) * smooth(0.5, 0.75, u));
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
    // (the inner arm's pale skin anteromedial, turning to the forearm's anterior flexor side across the elbow)
    put('innerArm', near(ad(a, 0.85), 0.22));
    put('elbow', blob(A, 0.5, 1, 45));
    put('axilla', near(ad(a, 0.75), 0.15) * smooth(0.14, 0.04, u));
    put('shoulder', near(ad(a, 0.25), 0.25) * smooth(0.25, 0.05, u));
  } else if (part === 'forearm') {
    put('arm', 1);
    put('innerArm', near(ad(a, 0.95), 0.22));
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

/** a point's place on the relational head's chart (mm): X the arc at the face's radius (+ the head's right), Y up */
export const headXY = (A) => ({ X: (A.around > 0.5 ? A.around - 1 : A.around) * 2 * Math.PI * A.marks.r0, Y: A.along * A.marks.length * 1000 });
const segD = (q, a, b) => { const bx = b.X - a.X, by = b.Y - a.Y, l2 = bx * bx + by * by || 1e-9, t = Math.max(0, Math.min(1, ((q.X - a.X) * bx + (q.Y - a.Y) * by) / l2)); return Math.hypot(q.X - a.X - bx * t, q.Y - a.Y - by * t); };
/** piecewise linear through [x, y] points (x increasing) */
const pwl = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 0; i + 1 < pts.length; i++) if (x <= pts[i + 1][0]) { const [a, ha] = pts[i], [b, hb] = pts[i + 1]; return ha + ((x - a) / (b - a || 1)) * (hb - ha); } return pts[pts.length - 1][1]; };

/**
 * The relational head's regions, every one laid from its relations (dermal-head.js `headMarks`), in mm on its chart:
 * the hairline from the trichion (the `hairline` dial moves it), round the temple's corner over the brow's outer end,
 * down the sideburn before the ear to the porion's height (a woman's higher), over the ear and down behind it to the
 * nape; the nose down its dorsum from the nasion to the pronasale and the subnasale, as wide as its wings; the lids
 * about each eye, the hollow under it; the cheek on its apex; the lips about the stomion, out to the mouth's corners;
 * the chin on pogonion; the ear about the porion; the beard under the line from the sideburn's foot to the mouth's
 * corner, the moustache under the nose's base.
 */
function relationalHeadRegions(A, D, put, R) {
  const M = A.marks.points, q = headXY(A), x = Math.abs(q.X), male = D.sex === 'male';
  const side = q.X >= 0 ? 'R' : 'L', P = (k) => M[k + side] || M[k];
  const back = Math.PI * A.marks.r0, por = P('porion'), fz = P('fz'), tr = M.trichion;
  // the hairline over |X|: the trichion's height at the middle (the dial lifts or lowers its front), the temple's
  // corner, the sideburn's foot, over the ear, behind it, the nape
  const Ht = M.g.Y + (tr.Y - M.g.Y) * D.hairline, sideX = Math.abs(por.X) - 16;
  // (the hairline's own dials, each absent 0, the line as it was: `round` its front's fall toward the temples, `temples`
  // the corners' recession, `sideburn` its foot, `nape` the line behind; `bald` a man's loss recedes the temples and then
  // the front, below)
  const bald = D.bald ?? 0, mBald = male ? bald : 0, front = mBald ? 50 * smooth(0.45, 1, mBald) : 0;
  const rnd = D.round ?? 0, tmp = (D.temples ?? 0) + (mBald ? 38 * smooth(0, 0.6, mBald) : 0), sb = D.sideburn ?? 0, nape = D.nape ?? 0;
  const Hf = Ht + front;
  const hl0 = pwl([[0, Hf], [Math.abs(fz.X) * 0.7, Hf - 3 - 6 * rnd + 0.3 * tmp], [Math.abs(fz.X) + 6, Ht - (male ? 18 : 10) + tmp], [sideX - 6, M.g.Y - 8], [sideX, por.Y + (male ? -4 : 14) - sb],
    [sideX + 2, por.Y + 34], [Math.abs(por.X) + 30, por.Y + 34], [Math.abs(por.X) + 42, por.Y - 6 - nape], [back * 0.85, por.Y - 38 - nape], [back, por.Y - 42 - nape]], x);
  // (a widow's peak: the line dips at the middle, over ~12 mm either side)
  // (a front receded by a man's loss takes its peak with it: no island of hair left on the crown)
  const pk = D.peak ? D.peak * (1 - smooth(0.25, 0.55, mBald)) : 0, hl = pk ? hl0 - pk * Math.max(0, 1 - x / 12) ** 2 : hl0;
  // the edge broken as a hairline is (no hairline is a drawn line): a few millimetres of wander along it, soft over 5 mm
  const wander = 4 * (vnoise(q.X / 7, 0.5, D.seed + 41) - 0.5) + 2 * (vnoise(q.X / 2.2, 3.5, D.seed + 43) - 0.5);
  let scalp = smooth(hl + wander - 5, hl + wander + 3, q.Y);
  // HAIR LOSS on the crown, as an angle on the head's sphere from a centre (the chart's X loses its meaning up there):
  // a man's from the back of the crown, growing and riding up toward the vertex until it meets the receding front (the
  // horseshoe); a woman's about the vertex and the part, thinned rather than cleared (the front line kept)
  if (bald > 0) {
    const el = A.along * Math.PI - Math.PI / 2, az = A.around * 2 * Math.PI;
    const crown = (el0, az0) => Math.acos(Math.max(-1, Math.min(1, Math.sin(el) * Math.sin(el0) + Math.cos(el) * Math.cos(el0) * Math.cos(az - az0))));
    if (male) {
      const r = 1.2 * smooth(0.2, 1.1, bald), d = crown((55 + 25 * bald) * Math.PI / 180, Math.PI);
      scalp *= smooth(r - 0.12, r + 0.04, d);
      // (the HORSESHOE: as the front's recession meets the crown's, what is left is a band round the sides and the back
      // with a level top about the parietal ridge, dipping toward the sideburn in front; no wedge left at the temple)
      const hs = smooth(0.35, 0.85, bald), top = por.Y + 60 + 220 * (1 - hs) - 58 * (1 - smooth(0.15, 0.35, ad(A.around, 0))) * hs;
      scalp *= 1 - smooth(top - 4, top + 6, q.Y);
    } else {
      const r = 0.6 * bald, d = crown(80 * Math.PI / 180, 0), n = vnoise(q.X / 3, q.Y / 3, D.seed + 47);
      scalp *= 1 - bald * (1 - smooth(r - 0.1, r + 0.1, d)) * (0.55 + 0.6 * n);
    }
  }
  put('scalp', scalp);
  const faceW = Math.abs(P('zy').X) + 4, face = (1 - scalp) * (1 - smooth(faceW - 8, faceW + 4, x)) * smooth(-12, 0, q.Y);
  const blobQ = (c, r, sy = 1) => Math.exp(-(((q.X - c.X) ** 2) + ((q.Y - c.Y) / sy) ** 2) / (r * r));
  put('ear', (1 - scalp) * blobQ({ X: por.X + Math.sign(por.X) * 4, Y: por.Y + 8 }, 26, 1.3));
  put('forehead', face * smooth(M.g.Y + 2, M.g.Y + 12, q.Y) * (1 - smooth(Math.abs(fz.X) - 6, Math.abs(fz.X) + 6, x)));
  const alW = Math.abs(P('al').X);
  put('nose', face * Math.max(near(segD(q, M.n, M.prn), alW * 0.85), near(segD(q, M.prn, M.sn), alW * 1.15)));
  const eye = P('eye'), eyeW = Math.abs(P('ex').X - P('en').X);
  const lid = Math.exp(-(((q.X - eye.X) / (eyeW * 0.65)) ** 2) - ((q.Y - eye.Y - 3) / 8) ** 2);
  put('eyelid', face * lid);
  put('underEye', face * Math.exp(-(((q.X - eye.X) / (eyeW * 0.6)) ** 2) - ((q.Y - eye.Y + 11) / 6) ** 2) * (1 - lid));
  put('cheek', face * blobQ(P('cheek'), 22, 1.2) * (1 - (R.nose || 0)));
  const ch = P('ch'), chW = Math.abs(ch.X) + 2;
  const lipTop = M.ls.Y + 1.5, lipBot = M.li.Y - 3, lipMid = M.sto.Y;
  const lipY = q.Y >= lipMid ? (q.Y - lipMid) / Math.max(1, lipTop - lipMid) : (lipMid - q.Y) / Math.max(1, lipMid - lipBot);
  put('lip', face * near(Math.hypot(x / chW, lipY), 1));
  put('chin', face * blobQ(M.pg, 16, 1.2));
  // the beard: under the cheek line (the sideburn's foot → the mouth's corner), the moustache under the nose's base,
  // round the jaw and under the chin to the neck; never the lips
  const foot = { X: sideX, Y: por.Y + (male ? -4 : 14) }, cor = { X: Math.abs(ch.X) + 6, Y: ch.Y + 6 };
  const cheekLine0 = x > cor.X ? cor.Y + ((x - cor.X) / Math.max(1, foot.X - cor.X)) * (foot.Y - cor.Y) : Math.min(M.sn.Y - 2, cor.Y + (cor.X - x) * 2);
  // (a style's lines over the tract: its cheek line lowered on the cheeks, its zones, its neckline; absent, as it was)
  const BS = D.beardStyle ? beardStyleAt(A, D) : null, cheekLine = BS && BS.cheek && x > cor.X ? cheekLine0 - BS.cheek * smooth(cor.X, cor.X + 20, x) : cheekLine0;
  // (the nose clears the beard only on itself, above its base: its region's reach round the columella would otherwise bare
  // the whole upper lip, the moustache's middle)
  // (the ear is its own: no beard grows on it, nor in front of it past the sideburn's foot)
  // (behind the jaw's angle, under the ear's lobe, the beard WRAPS the jaw: its back edge reaches back past the
  // sideburn's line to under the ear, and onto the neck's side)
  const lobe = M.sn.Y, backX = foot.X + (Math.abs(por.X) + 10 - foot.X) * (1 - smooth(lobe - 8, lobe + 2, q.Y));
  put('beard', (1 - scalp) * (1 - smooth(backX + 2, backX + 10, x)) * smooth(cheekLine + 6, cheekLine - 6, q.Y) * (1 - (R.lip || 0)) * (1 - (R.nose || 0) * smooth(M.sn.Y - 3, M.sn.Y + 1, q.Y)) * (1 - Math.min(1, 1.6 * (R.ear || 0))) * (BS ? BS.mask : 1));
  if (A.feature === 'ear') { put('ear', 1); delete R.beard; delete R.scalp; }
  put('face', face);
  put('headSide', (1 - scalp) * (1 - face) * 0.6);
}

/** the dominant region's name (what kind of skin this is) */
export const dominant = (R) => {
  const best = (ok) => Object.entries(R).filter(([k]) => ok(k)).reduce((m, [k, w]) => (w > m[1] ? [k, w] : m), ['skin', 0]);
  const own = best((k) => !UMBRELLA.has(k));
  return own[1] >= 0.35 ? own[0] : best(() => true)[0];
};
/** the broad regions a specific one lies within: named only where nothing specific is */
const UMBRELLA = new Set(['face', 'headSide', 'arm', 'leg', 'neck']);

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
  const base0 = toneAlbedo(D.tone), swatch = typeof D.tone === 'string' ? hexLin(D.tone) : hexLin(MST[D.tone - 1]);
  const mel = Math.max(0, Math.min(1, 1 - lum(swatch) / lum(hexLin(MST[0]))));   // 0 the lightest swatch … ~1 the deepest
  let c = mulc(base0, UNDERTONE_TINT[D.undertone]);
  const Z = D.zones, show = 1 - 0.6 * mel;   // a deep skin shows its blood less
  const blood = Math.max(w('cheek') * 0.55, w('nose') * 0.6, w('ear') * 0.7, w('knuckles') * 0.6, w('elbow') * 0.5, w('knee') * 0.5, w('fingertip') * 0.55, w('palm') * 0.25, w('sole') * 0.3, w('heel') * 0.4, w('underEye') * 0.15, w('lip') * 0.3, w('axilla') * 0.1);
  const middle = A.part === 'head' ? (A.marks ? band(headXY(A).Y, A.marks.points.sn.Y, A.marks.points.g.Y, 16) : band(A.along, HEAD_LEVELS.noseBase, HEAD_LEVELS.brow, 0.03)) * w('face') * 0.3 : 0;
  c = tint(c, BLOOD, (blood + middle) * D.flush * Z * show);
  c = tint(c, YELLOW, Math.max(w('forehead') * 0.5, w('shin') * 0.4, w('knee') * 0.25, w('elbow') * 0.25, w('heel') * 0.3, w('chin') * 0.2) * Z * (0.4 + 0.6 * D.age));
  const shadow = D.sex === 'male' ? w('beard') * Math.min(1, D.beard) * (D.stubble > 0 ? 0.45 : 0.25) : 0;
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
  // the marks: a mole, a beauty mark, a birthmark's stain (the dermis's `marks`; absent, none)
  const mk = D.marks ? marksAt(A, D) : null;
  if (mk) c = c.map((v, k) => v * mk[k]);
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
      const lip = A.marks ? (() => { const q = headXY(A), M = A.marks.points; return q.Y > M.sto.Y && q.Y < M.sn.Y && Math.abs(q.X) < Math.abs(M.chR.X); })() : u > HEAD_LEVELS.mouth && u < HEAD_LEVELS.noseBase && ad(a, 0) < 0.07;
      const out = A.marks ? beardFlow(A, lip) : lip ? toward(a, a < 0.5 ? 0.25 : 0.75) * 0.6 : toward(a, 0) * 0.25;
      const BS = D.beardStyle ? beardStyleAt(A, D) : null;
      // (the moustache trimmed at the lip line, as it usually is: a hair above the upper lip as long as its way down to
      // the lip's border, so none hangs over the lip; a style may let it, `overLip`; the painted shadow as it was)
      let len = BS ? BS.length : D.stubble;
      if (lip && A.marks && len >= 1.5 && !(D.beardStyle && beardStyleOf(D.beardStyle).overLip)) len = Math.max(1.5, Math.min(len, (headXY(A).Y - A.marks.points.ls.Y) * 1.15));
      return T('beard', 55 * D.beard * w('beard') * (BS ? BS.density : 1), len, flowOf(-1, out), BS ? BS.lift : 0.3);
    }
    return vellus;
  }
  // (the throat's beard thins out under the jaw rather than stopping at a line)
  // (a style with a neckline trims the throat; one without lets its chin's length fade down it)
  // (the neck's: down toward the throat's middle, turning about a WHORL either side where the jaw's stream meets the
  // throat's, as most men's do)
  if (A.part === 'neck') {
    const whorl = 1.1 * Math.exp(-((ad(a, 0) - 0.09) ** 2 / 0.0025 + (u - 0.72) ** 2 / 0.02)) * (a < 0.5 ? 1 : -1);
    return w('beard') > 0.05 && D.beard > 0 && !(D.beardStyle && beardStyleOf(D.beardStyle).neck !== undefined) ? T('beard', 40 * D.beard * w('beard') * smooth(0.05, 0.5, w('beard')), D.beardStyle ? beardStyleOf(D.beardStyle).lengths.chin * 0.6 : D.stubble, flowOf(-1, toward(a, 0) * 0.3) + whorl, 0.3) : vellus;
  }
  if (A.part === 'trunk') {
    if (w('axilla') > 0.4 && D.axilla > 0) return T('axilla', 35 * D.axilla, 14, flowOf(-1), 0.5);
    const chest = male ? w('chest') * near(Math.min(ad(a, 0), Math.abs(ad(a, 0) - 0.1)), 0.14) : 0;
    // (each fading in with its region rather than starting at a threshold's line)
    if (chest > 0.02) return T('chest', 14 * B * chest * smooth(0.02, 0.4, chest), 16, flowOf(-0.8, toward(a, 0) * 0.6), 0.3);
    if (male && w('abdomen') > 0.05 && ad(a, 0) < 0.05) return T('trail', 10 * B * near(ad(a, 0), 0.05) * smooth(0.05, 0.8, w('abdomen')), 12, flowOf(-1), 0.3);
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

/** the skin's BASE colour (sRGB hex): its tone under its undertone, before the zones, the blood and the detail (the flat
 * colour of skin no texture covers, the palette's Skin) */
export const skinBase = (D) => linHex(mulc(toneAlbedo(D.tone), UNDERTONE_TINT[D.undertone]));

/** the hair's colour (linear RGB) from the dermis's word */
export const hairColourOf = (D) => hexLin(HAIR_COLOURS[D.hairColour] || D.hairColour);
/** a grey hair's colour (linear RGB): the pigment gone, a warm silver */
export const GREY_HAIR = Object.freeze(hexLin('#cdc8bf'));
/** the hair's colour as the eye averages it at a distance (linear): its own, toward silver by the share gone grey (the
 * texture's painted hair, an engine's cards); the colour itself without `grey` */
export const hairMeanOf = (D) => { const c = hairColourOf(D); return D.grey ? c.map((v, k) => v + (GREY_HAIR[k] - v) * D.grey) : c; };

// ─── the creator's sliders: the face's lines, war paint ───
export const PAINT_PATTERNS = Object.freeze(['eyes', 'stripes', 'band', 'chin', 'mask']);
export const PAINT_COLOURS = Object.freeze({ woad: '#2c4a86', soot: '#1c1a19', ochre: '#8c3a1e', chalk: '#e6e1d6', blood: '#6e1414' });
export const DIRT_COLOUR = hexLin('#4a3b2c');

/** a fold's profile across it, in its half-widths: the thin core's spread and the smooth shade's (gaussian variances) */
export const FOLD = Object.freeze({ core: 0.12, soft: 3 });
/** a point against a polyline (mm): its distance `d`, `s` signed (+ on the left of the way it runs), `t` its share of the
 * way along at the nearest point, `L` the polyline's length */
const nearPoly = (q, pts) => {
  let best = { d: Infinity, s: 0, t: 0 }, run = 0, L = 0;
  for (let i = 0; i + 1 < pts.length; i++) L += Math.hypot(pts[i + 1].X - pts[i].X, pts[i + 1].Y - pts[i].Y);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], bx = b.X - a.X, by = b.Y - a.Y, l = Math.hypot(bx, by) || 1e-9, u = Math.max(0, Math.min(1, ((q.X - a.X) * bx + (q.Y - a.Y) * by) / (l * l)));
    const px = q.X - a.X - bx * u, py = q.Y - a.Y - by * u, d = Math.hypot(px, py);
    if (d < best.d) best = { d, s: Math.sign(bx * (q.Y - a.Y) - by * (q.X - a.X)) * d, t: (run + u * l) / (L || 1) };
    run += l;
  }
  return { ...best, L };
};
/** distance from a point to a polyline (mm) */
const polyD = (q, pts) => { let d = Infinity; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segD(q, pts[i], pts[i + 1])); return d; };

/**
 * The FINE DETAIL at an address, too fine for the map's stride (a texture paints it per texel): the face's LINES (a
 * darkening 0 … 1: three wavering forehead lines, the frown's two, crow's feet fanned from the outer canthus, the
 * nasolabial fold from the nose's wing to the mouth's corner, the arc under each eye; deeper with age) and its WAR PAINT
 * (`[r, g, b, alpha]`, linear, the brush's edge ragged). On the relational head (its marks); elsewhere nothing.
 */
export function dermalDetail(A, D) {
  if (A.part !== 'head' || !A.marks) return { crease: 0, soft: 0, lift: 0, paint: null };
  const M = A.marks.points, q = headXY(A), sg = q.X >= 0 ? 1 : -1, P = (k) => M[k + (sg > 0 ? 'R' : 'L')], X = Math.abs(q.X);
  const line = (d, w) => Math.exp(-((d / w) ** 2));
  // THE LINES, as FOLDS: each a polyline in mm on the head, painted as the skin creased there (not a pencil stroke on
  // it), at two scales: a thin dark CORE where the fold closes (`crease`) inside a broad SMOOTH shade that falls off
  // softly either side (`soft`, leaning to the side the fold closes under), and a faint lift on the roll's lit lip
  // (`lift`); tapered to nothing at both ends, broken along its length by a slow noise, wider as it deepens.
  let crease = 0, soft = 0, lift = 0;
  if (D.lines > 0) {
    const deep = D.lines * (0.55 + 0.45 * D.age), Q = { X, Y: q.Y };
    // (`side` +1: the shadow on the left of the way the line runs, the lift on its right; `w` its half-width at full
    // depth, mm; `k` its own share of the depth)
    const fold = (pts, w, k, side, key) => {
      const r = nearPoly(Q, pts); if (r.d > w * 6) return;
      const dep = k * deep, ww = w * (0.6 + 0.6 * dep), taper = Math.sin(Math.PI * Math.min(1, Math.max(0, r.t))) ** 0.8;
      const broken = 0.45 + 0.55 * smooth(0.25, 0.7, vnoise(r.t * r.L / 3.5 + key * 7.3, key * 3.1, D.seed + 91));
      const a = dep * taper * broken, u = (r.s * side) / ww;
      crease = Math.max(crease, a * Math.exp(-((u - 0.2) ** 2) / FOLD.core));
      soft = Math.max(soft, a * Math.exp(-((u - 0.6) ** 2) / FOLD.soft));
      lift = Math.max(lift, a * 0.4 * Math.exp(-((u + 1.8) ** 2) / 1.2));
    };
    // the forehead's three, running across (the brow's skin folds down onto them: the shadow under, the lift above)
    const fz = Math.abs(P('fz').X);
    for (let k = 0; k < 3; k++) {
      const y0 = M.g.Y + 13 + 8 * k, pts = Array.from({ length: 9 }, (_, i) => { const x = (fz - 4) * (i / 8); return { X: x, Y: y0 + 1.4 * Math.sin(x / 9 + k * 1.7) + 0.02 * x * x / 10 }; });
      fold(pts, 0.9, k === 1 ? 1 : 0.7, -1, k + 1);
    }
    // the frown's, up from the brow's inner end
    fold([{ X: 4.5, Y: M.g.Y - 4 }, { X: 5.4, Y: M.g.Y + 4 }, { X: 6.6, Y: M.g.Y + 12 }], 0.7, 0.9, 1, 5);
    // crow's feet, fanned from beyond the outer canthus and curving down at their ends, more of them as they deepen
    const ex = P('ex'), c = { X: Math.abs(ex.X) + 4, Y: ex.Y }, n = deep > 0.5 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const a = -0.55 + (1.05 * i) / (n - 1), L = 11 + 3 * Math.cos(a * 2);
      fold(Array.from({ length: 6 }, (_, m) => { const f = m / 5, b = a - 0.18 * f * f; return { X: c.X + L * f * Math.cos(b), Y: c.Y + L * f * Math.sin(b) }; }), 0.6, 0.85, 1, 6 + i);
    }
    // the nasolabial fold, the cheek's lip over it: from beside the nose's wing round toward the mouth's corner
    const al = P('al'), ch = P('ch');
    fold([{ X: Math.abs(al.X) + 3, Y: al.Y + 4 }, { X: Math.abs(al.X) + 7, Y: (al.Y + ch.Y) / 2 + 2 }, { X: Math.abs(ch.X) + 5, Y: ch.Y - 1 }, { X: Math.abs(ch.X) + 6, Y: ch.Y - 6 }], 1.5, 0.85, -1, 12);
    // under the eye, the lid's arc (its bag above, the shadow below)
    const eye = P('eye'), ew = Math.abs(P('ex').X - P('en').X);
    fold(Array.from({ length: 7 }, (_, m) => { const a = Math.PI * (0.15 + 0.7 * (m / 6)); return { X: Math.abs(eye.X) - 0.62 * ew * Math.cos(a), Y: eye.Y - 4 - 7 * Math.sin(a) }; }), 0.8, 0.6, 1, 13);
  }
  let paint = null;
  if (D.paint) {
    const W = D.paint, brush = vnoise(q.X / 2.6 + 3, q.Y / 2.6, D.seed + 71) - 0.5, edge = (d) => smooth(1.2, -1.2, d + 2.2 * brush);   // d: mm outside the shape
    const eye = P('eye'), ex = P('ex');
    let d = Infinity;
    if (W.pattern === 'eyes') d = Math.max(Math.abs(q.Y - eye.Y) - 9, X - (Math.abs(ex.X) + 22));
    else if (W.pattern === 'band') d = Math.max(Math.abs(q.Y - (M.g.Y + 18)) - 7, X - (Math.abs(P('fz').X) + 10));
    else if (W.pattern === 'chin') d = Math.max(X - 5, Math.max(q.Y - (M.li.Y - 2), -q.Y));
    else if (W.pattern === 'stripes') { if (q.X > 0) for (let k = 0; k < 3; k++) { const top = eye.Y - 8, bot = M.goR.Y + 12 + 6 * k, x0 = 18 + 9 * k; d = Math.min(d, Math.max(polyD({ X: q.X, Y: q.Y }, [{ X: x0, Y: top }, { X: x0 + 0.15 * (top - bot), Y: bot }]) - 2.2, 0)); } }
    else if (W.pattern === 'mask') d = Math.min(Math.hypot((X - Math.abs(eye.X)) / 18, (q.Y - eye.Y - 1) / 12) * 12 - 12, Math.max(X - 4, Math.max(q.Y - M.n.Y, M.prn.Y - q.Y)));
    const a = edge(d) * (W.amount ?? 0.85);
    if (a > 0.003) paint = [...hexLin(PAINT_COLOURS[W.colour] || W.colour || PAINT_COLOURS.woad), a];
  }
  return { crease, soft, lift, paint };
}
