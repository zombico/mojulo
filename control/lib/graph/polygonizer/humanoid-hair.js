/** humanoid-hair.js — HAIR on the landmark head as a LIBRARY OF STYLES over closed constructions, modelled by word.
 *
 * The hairstyle lab established the library (nineteen styles in a male and a female collection, every one wearable by
 * either head) and the contract (relative controls about each style's preset; each style names the controls that apply):
 *   - the ten of its first pass: volume, length, fringe, part, tail, fade, graduation, wave, tie, braid;
 *   - the anime LOCKS (v3): separate flattened locks along quadratic root → control → tip curves, pointed tips, a
 *     deterministic asymmetry — lockWidth, taper, bend, asymmetry;
 *   - the barbering FORM pass (v4): a squarer upper section with temple-corner weight, reduced lower-side bulk, front
 *     weight / top slope, a squared hairline — corners, sideBulk, topSlope, lineup;
 *   - section DEFINITION (v5 / v6): every style's signature geometry exaggerated or relaxed by one control — the crew's
 *     flat top, the taper's recessed part, the undercut's shelf, the quiff's lift, the female part's lobes and open
 *     front, the long falls' separated panels, the gathered styles' crown ridges — definition.
 * Its masses were open shells fitted around scalp landmarks. Here every mass is a CLOSED loft whose perimeter follows
 * the skull BY ADDRESS (the cranium's rows × slots), lifted off the surface by construction, so hair rides every face
 * control, never sinks into the skull, and closes under the layered audit like every other part. Five constructions
 * carry the library: the CAP (hairline per slot, lifted rings, fringe, part groove and lobes, taper, quiff, form,
 * ridges), the FALL (curtains from just inside the cap's border, per-slot fall, separated panels, one hem cap), the
 * TAIL family (ponytail sweep, bun bell, winding braid) and the LOCKS (one closed tapered sweep per lock).
 * `crop`, `swept` and `bob` at all controls 1 are the bytes the head grew before this module (pinned in the test): on
 * those three the form and definition controls are RELATIVE (1 changes nothing), where a new style carries its form
 * and signature at 1. Hair colour is the palette's `Hair`. No dice anywhere: the asymmetry is a sine of the lock index. */
import { frameAt, symmetricFrameAt, loftParts, sweep, vec } from './station-loft-detail.js';
import { ratioControls } from './ratio-controls.js';
import * as dmath from '../../util/dmath.js';

const { add, mul, unit, sub, mean } = vec;

// ─── the controls ─────────────────────────────────────────────────────────
export const HAIR = ratioControls({
  label: 'hair',
  // the group is `tails`, never `tail`: a group word and a control may not share a name (the group would swallow the key)
  groups: {
    cap: ['volume', 'fringe', 'part', 'fade'], fall: ['length', 'graduation', 'wave'], tails: ['tail', 'tie', 'braid'],
    locks: ['lockWidth', 'taper', 'bend', 'asymmetry'], form: ['corners', 'sideBulk', 'topSlope', 'lineup'], definition: ['definition'],
  },
  ranges: { volume: [0.85, 1.35], length: [0.6, 1.5], fringe: [0.6, 1.4], part: [0.6, 1.4], tail: [0.6, 1.5], fade: [0.65, 1.35], graduation: [0.6, 1.5], wave: [0.4, 1.6], tie: [0.65, 1.35], braid: [0.7, 1.4],
    lockWidth: [0.75, 1.25], taper: [0.65, 1.4], bend: [0.6, 1.4], asymmetry: [0, 1.5], corners: [0.6, 1.4], sideBulk: [0.75, 1.2], topSlope: [0.6, 1.4], lineup: [0, 1.4], definition: [0.6, 1.5] },
  zero: ['asymmetry', 'lineup'],
});
export const { KEYS: HAIR_KEYS, GROUPS: HAIR_GROUPS, RANGES: HAIR_RANGES } = HAIR;

// ─── the library ──────────────────────────────────────────────────────────
// A style is DATA: its collection (who wears it by default; anyone may), its base construction, the controls that apply,
// and its parameters. `low` is the hairline per half-slot (front, bridge, nose, ala, inner, outer, side, rear, back) in
// cranium rows (0 mouth … 4 eye, 5 glabella, 6 forehead, 7 vault, 8 crown); `lifts` the four rings' standoff (lower,
// border, mid, top; the old cap's 6 / 12 / 14 mm); `form` the barbering form ('square' keeps the parietal corners,
// 'triangle' is front-weighted); `quiff` the front-top rise; `flatTop`, `shelf`, `channels`, `ridges` signatures;
// `fall` a curtain (`drop` in head metres at length 1, `frontGap` how many front slots stay near the border, `front`
// their fall, `graded` the angled front, `layers` a scalloped hem, `wave` the swing, `separate` panels); `tail` a
// ponytail / bun / braid; `locks` the anime locks. `legacy` marks the three pinned styles (form and definition relative).
// Do not quote this list's length anywhere; it is the list that defines it.
const CAP = [6.2, 6.2, 6.2, 6.2, 6.25, 6.1, 3.8, 4.2, 3.9];
const BOB = [6.1, 6.1, 6.1, 6.1, 6.15, 5.8, 2.3, 0.7, 0.3];
const HIGH_SIDES = [6.2, 6.2, 6.2, 6.2, 6.25, 6.1, 5.0, 5.4, 5.2];
const LIFTS = [-0.014, 0.006, 0.012, 0.014];
const FORM = ['corners', 'sideBulk', 'topSlope', 'lineup'];
const FALL_SEP = { separate: 0.16 };
export const HAIR_LIBRARY = Object.freeze({
  none: { collection: 'any', base: 'none', controls: [], note: 'no hair' },
  // ── the male collection: caps, the anime locks ──
  animeShort: { collection: 'male', base: 'locks', controls: ['volume', 'fringe', 'lockWidth', 'taper', 'bend', 'asymmetry', 'corners', 'sideBulk', 'topSlope', 'definition'], low: CAP, lifts: [-0.014, 0.005, 0.010, 0.012], form: 'triangle', locks: { kind: 'short' }, note: 'anime tousled: pointed bangs, side locks to the cheek, crown spikes' },
  buzz: { collection: 'male', base: 'cap', controls: ['volume', 'fringe', 'definition'], low: CAP, lifts: [-0.014, 0.002, 0.004, 0.005], dome: 0.002, note: 'skin-tight' },
  crew: { collection: 'male', base: 'cap', controls: ['volume', 'fringe', 'fade', ...FORM, 'definition'], low: CAP, lifts: [-0.014, 0.004, 0.008, 0.010], form: 'square', flatTop: 0.004, note: 'low, a flat top, tapered sides' },
  taper: { collection: 'male', base: 'cap', controls: ['volume', 'fringe', 'part', 'fade', ...FORM, 'definition'], low: CAP, lifts: LIFTS, form: 'square', part: true, note: 'a side part with tapered sides' },
  undercut: { collection: 'male', base: 'cap', controls: ['volume', 'fringe', 'part', 'fade', ...FORM, 'definition'], low: HIGH_SIDES, lifts: [-0.014, 0.008, 0.018, 0.022], form: 'square', part: true, shelf: 0.006, note: 'shaved sides, a full top on a shelf' },
  crop: { collection: 'male', base: 'cap', controls: ['volume', 'fringe', ...FORM, 'definition'], low: CAP, lifts: LIFTS, legacy: true, form: 'triangle', note: 'the short cap' },
  quiff: { collection: 'male', base: 'cap', controls: ['volume', 'fringe', 'part', ...FORM, 'definition'], low: CAP, lifts: LIFTS, form: 'triangle', quiff: 0.030, note: 'the front swept up' },
  swept: { collection: 'male', base: 'cap', controls: ['volume', 'length', ...FORM, 'definition'], low: CAP, lifts: LIFTS, legacy: true, form: 'square', sweptFringe: true, channels: 0.004, note: 'swept back, the fringe to one side' },
  curtains: { collection: 'male', base: 'fall', controls: ['volume', 'length', 'part', 'definition'], low: CAP, lifts: LIFTS, part: true, fall: { drop: 0.06, frontGap: 5, front: 0.15, open: true }, note: 'a short fall parted at the middle' },
  // ── the female collection: caps, falls, tails, the anime bob ──
  animeBob: { collection: 'female', base: 'locks', controls: ['volume', 'length', 'fringe', 'lockWidth', 'taper', 'bend', 'asymmetry', 'part', 'definition'], low: CAP, lifts: [-0.014, 0.005, 0.010, 0.012], parted: true, locks: { kind: 'bob' }, note: 'anime layered bob: pointed bangs, locks falling to the jaw' },
  pixie: { collection: 'female', base: 'cap', controls: ['volume', 'fringe', 'part', 'definition'], low: [5.9, 5.9, 6.0, 6.1, 6.2, 5.6, 3.2, 3.6, 3.4], lifts: [-0.014, 0.007, 0.014, 0.016], parted: true, partOffset: 1, sweptFringe: true, note: 'short, an asymmetric fringe, low sides' },
  bob: { collection: 'female', base: 'cap', controls: ['volume', 'length', 'fringe', 'graduation', 'part', 'definition'], low: BOB, lifts: LIFTS, legacy: true, note: 'the short bob: the cap itself reaches the jaw' },
  // the falls start at the temples (frontGap 5: the front, bridge, nose, ala and inner slots stay near the border), so a
  // long fall frames the face from the side instead of hanging in front of the cheeks and reading as a beard
  angled: { collection: 'female', base: 'fall', controls: ['volume', 'length', 'fringe', 'graduation', 'part', 'definition'], low: BOB, lifts: LIFTS, parted: true, partOffset: 1, fall: { drop: 0.03, frontGap: 5, front: 0.5, graded: 0.08, ...FALL_SEP }, note: 'a bob longer at the front, parted off centre' },
  layers: { collection: 'female', base: 'fall', controls: ['volume', 'length', 'fringe', 'part', 'definition'], low: CAP, lifts: LIFTS, parted: true, fall: { drop: 0.14, frontGap: 5, front: 0.2, layers: 0.02, ...FALL_SEP }, note: 'to the shoulders, a scalloped hem in panels' },
  long: { collection: 'female', base: 'fall', controls: ['volume', 'length', 'fringe', 'part', 'definition'], low: CAP, lifts: LIFTS, parted: true, fall: { drop: 0.22, frontGap: 5, front: 0.2, ...FALL_SEP }, note: 'long and straight, in broad sections' },
  wavy: { collection: 'female', base: 'fall', controls: ['volume', 'length', 'fringe', 'wave', 'part', 'definition'], low: CAP, lifts: [-0.014, 0.007, 0.014, 0.016], parted: true, fall: { drop: 0.22, frontGap: 5, front: 0.2, wave: 0.014, ...FALL_SEP }, note: 'long, the hem swinging in separated waves' },
  ponytail: { collection: 'female', base: 'tail', controls: ['volume', 'length', 'fringe', 'tail', 'tie', 'part', 'definition'], low: CAP, lifts: LIFTS, parted: true, ridges: 0.003, tail: { kind: 'tail', length: 0.20, radius: 0.026 }, note: 'gathered at the occiput, crown ridges leading to the tie' },
  bun: { collection: 'female', base: 'tail', controls: ['volume', 'fringe', 'tail', 'tie', 'part', 'definition'], low: CAP, lifts: LIFTS, parted: true, ridges: 0.003, tail: { kind: 'bun', radius: 0.032 }, note: 'a knot at the occiput' },
  braid: { collection: 'female', base: 'tail', controls: ['volume', 'length', 'fringe', 'tail', 'tie', 'braid', 'part', 'definition'], low: CAP, lifts: LIFTS, parted: true, ridges: 0.003, tail: { kind: 'braid', length: 0.26, radius: 0.017 }, note: 'a winding taper down the back' },
});
export const HAIR_STYLE_NAMES = Object.freeze(Object.keys(HAIR_LIBRARY));
export const HAIR_COLLECTIONS = Object.freeze({
  male: HAIR_STYLE_NAMES.filter((k) => HAIR_LIBRARY[k].collection === 'male'),
  female: HAIR_STYLE_NAMES.filter((k) => HAIR_LIBRARY[k].collection === 'female'),
});

/** `'ponytail'` | `{ style, length: 1.3 }` | `['ponytail', { length: 1.3 }, …]` → `{ style, …every control }` */
export function resolveHair(spec) {
  const list = Array.isArray(spec) ? spec : [spec];
  let style = null; const ratios = [];
  for (const entry of list) {
    if (entry === undefined || entry === null) continue;
    if (typeof entry === 'string') { style = entry; continue; }
    if (typeof entry !== 'object') throw new Error('hair: an entry must be a style word or a control object');
    const { style: s, ...rest } = entry; if (typeof s === 'string') style = s; ratios.push(rest);
  }
  style = style ?? 'swept';
  if (!HAIR_LIBRARY[style]) throw new Error(`hair: unknown style '${style}' (have ${HAIR_STYLE_NAMES.join(', ')})`);
  const { from: _f, ...controls } = HAIR.resolve(ratios);
  return { style, ...controls };
}
/** Error strings (empty = valid): an unknown style, an unknown control, a ratio that is not a positive number. */
export function validateHair(spec, label = 'hair') {
  if (spec === undefined || spec === null) return [];
  const list = Array.isArray(spec) ? spec : [spec], errs = [];
  for (const [i, entry] of list.entries()) {
    const at = list.length > 1 ? `${label}[${i}]` : label;
    if (typeof entry === 'string') { if (!HAIR_LIBRARY[entry]) errs.push(`${at}: unknown style '${entry}' (have ${HAIR_STYLE_NAMES.join(', ')})`); continue; }
    if (!entry || typeof entry !== 'object') { errs.push(`${at}: a style word ('${HAIR_STYLE_NAMES.slice(1, 6).join("', '")}' …), a control object ({ style?, ${HAIR_KEYS.join(', ')} }) or a list`); continue; }
    const { style, ...rest } = entry;
    if (style !== undefined && !HAIR_LIBRARY[style]) errs.push(`${at}.style: unknown style '${style}' (have ${HAIR_STYLE_NAMES.join(', ')})`);
    errs.push(...HAIR.validate(rest, at));
  }
  return errs;
}
/** Advisory: controls outside their comfortable range, and controls the style does not use. Never a refusal. */
export function hairWarnings(resolved) {
  const style = HAIR_LIBRARY[resolved.style]; if (!style) return [];
  const idle = HAIR_KEYS.filter((k) => resolved[k] !== 1 && !style.controls.includes(k));
  return [...HAIR.warnings(resolved), ...(idle.length ? [`hair.${idle.join(', hair.')} ${idle.length === 1 ? 'has' : 'have'} no effect on '${resolved.style}' (it takes ${style.controls.join(', ') || 'no controls'})`] : [])];
}
/** the frame note's clause */
export const describeHair = (resolved) => { const d = HAIR.describe(resolved); return resolved.style + (d ? ` (${d.replace(/^hair /, '')})` : ''); };

// ─── the constructions ────────────────────────────────────────────────────
const CROWN_ROW = 8, BROW_ROW = 5.3, N = 16, MID = N / 2;
const slotOf = (k) => ({ t: k <= MID ? k : N - k, side: k <= MID ? 'R' : 'L' });
/** the front-ness of slot k (1 at the midline front, 0 at the back) */
const frontOf = (k) => { const { t } = slotOf(k); return Math.max(0, 1 - t / MID); };
const clampRow = (r) => Math.max(0.2, Math.min(7.9, r));
const gauss = (d, w) => dmath.exp(-((d / w) ** 2));
/** the circular slot distance */
const slotDist = (k, j) => { const d = Math.abs(k - j) % N; return Math.min(d, N - d); };
/** a control's strength on a style: absolute on a new style (1 = its form), RELATIVE on a pinned legacy style (1 = nothing) */
const rel = (style, v) => (style.legacy ? v - 1 : v);

/** The CAP. One closed loft: an underside ring inside the skull, the border at the hairline, the crown rings lifted.
 * Returns the mesh and the hairline per slot (the locks read it). */
function buildCap(carrier, style, c) {
  const D = style.legacy ? 1 + (c.definition - 1) : c.definition;   // definition: on a legacy style only its departure from 1 acts (below)
  const dD = c.definition - 1;
  const low = [...style.low];
  // the fringe: the front slots' hairline down (> 1) or up (< 1), never below the brow row, so the eyes always read
  for (let t = 0; t <= 5; t++) { const w = 1 - t / 6; low[t] = Math.max(BROW_ROW, Math.min(7.6, low[t] - (c.fringe - 1) * 1.6 * w)); }
  // the taper: the side, rear and back hairline up
  for (let t = 6; t <= 8; t++) low[t] = Math.max(0.2, Math.min(7.4, low[t] + (c.fade - 1) * 3.0));
  // lineup: the hairline squared at the temple corners — the outer and side slots' hairline drawn up toward the front
  // row, the barber's line-up (a new square form at 1; a legacy style only above 1)
  const square = style.form === 'square' ? (style.legacy ? Math.max(0, c.lineup - 1) / 0.4 : Math.min(1, c.lineup)) : 0;
  if (square > 0) { low[5] += (low[4] - low[5]) * square; low[6] += (low[4] - low[6]) * 0.35 * square; }
  const lowK = Array.from({ length: N }, (_, k) => low[slotOf(k).t]);
  // the part: a groove along a slot line sliding across the front; the fringe falls to the far side; on a female style
  // two lobes rise beside it and the hairline opens over it (the lab's v6). A legacy style parts only when asked to.
  const parted = style.part || (style.parted && (style.legacy ? c.part !== 1 : true)) || (style.collection === 'female' && c.part !== 1);
  const partK = parted ? 1 + Math.round((c.part - 1) * 4) + (style.partOffset ?? 0) : null;
  const female = style.collection === 'female';
  if (partK !== null) for (let k = 0; k < N; k++) {
    const { t, side } = slotOf(k);
    if (t <= 4) lowK[k] = Math.max(BROW_ROW, Math.min(7.6, lowK[k] + (side === 'R' ? 0.35 : -0.45) * (1 - t / 5)));
    if (female && slotDist(k, partK) <= 1 && t <= 3) lowK[k] = Math.min(7.6, lowK[k] + 0.35 * D);   // the open front over the part
  }
  const [lLow, lBorder, lMid, lTop] = style.lifts;
  const V = c.volume;
  const sample = (fraction, lift) => Array.from({ length: N }, (_, k) => {
    const { t, side } = slotOf(k);
    const f = frameAt(carrier, 'cranium', [lowK[k] + (CROWN_ROW - lowK[k]) * fraction, t], side);
    const front = frontOf(k), upper = Math.max(0, (fraction - 0.4) / 0.6);
    let L = lift;
    if (partK !== null && fraction > 0) {
      const d = slotDist(k, partK);
      L -= 0.7 * Math.max(0, lift) * D * gauss(d, 0.8) * fraction;                      // the groove
      if (female) L += 0.5 * Math.max(0, lift) * D * (gauss(d - 1.6, 0.9) + gauss(d + 1.6, 0.9)) * upper;   // the lobes beside it
    }
    if (style.flatTop && fraction >= 0.8) L -= style.flatTop * D * (fraction - 0.8) / 0.2;
    if (style.dome && fraction >= 0.6) L -= style.dome * D * (fraction - 0.6) / 0.4;
    if (style.shelf && fraction >= 0.6) L += style.shelf * D;                            // the undercut's top on a shelf
    if (style.channels && upper > 0) L -= style.channels * dD * (0.5 + 0.5 * dmath.cos(t * 2.6)) * upper;   // swept channels (relative: legacy)
    if (style.ridges && t >= 5 && upper > 0) L += style.ridges * D * (0.5 + 0.5 * dmath.cos(t * 2.1)) * upper;   // crown ridges toward the tie
    // the barbering form: parietal corners, lower-side bulk, front weight / top slope
    if (style.form) {
      const corner = t >= 5 && t <= 6 && fraction >= 0.25 && fraction <= 0.82 ? 1 : 0;
      const lowerSide = t >= 6 && fraction <= 0.3 && fraction > 0 ? 1 : 0;
      if (style.form === 'square') { L += 0.004 * rel(style, c.corners) * corner; L -= 0.003 * (style.legacy ? 0 : 1) * lowerSide; }
      L += 0.012 * (c.sideBulk - 1) * (t >= 6 && fraction <= 0.6 && lift > 0 ? 1 : 0);   // the border ring included: the cap is widest at the temples
      if (style.legacy) L += 0.008 * (c.corners - 1) * corner;
    }
    let p = add(f.origin, mul(f.normal, L));
    if (style.form && fraction > 0) {
      const slope = style.form === 'triangle' ? 0.010 * rel(style, c.topSlope) * front * upper : 0.006 * (c.topSlope - 1) * (front - 0.4) * upper;
      p = add(p, [0, slope * 0.5, slope]);
    }
    if (style.quiff && fraction > 0) { const rise = style.quiff * D * V * front * gauss(fraction - 0.45, 0.35); p = add(p, [0, rise * 0.6, rise]); }
    return p;
  });
  const lower = sample(0, lLow), border = sample(0, lBorder * V), mid = sample(0.60, lMid * V), top = sample(1, lTop * V);
  if (style.sweptFringe) { border[0][2] -= 0.010; border[0][1] += 0.012; border[1][2] -= 0.020; border[1][1] += 0.020; mid[0][2] += 0.008; }
  if (style.sweptFringe && c.length !== 1) { const s = (c.length - 1) * 0.02; border[1][1] += s; border[0][1] += s * 0.6; }
  const rings = [lower, border, sample(0.25, 0.016 * V), mid, sample(0.82, 0.017 * V), top];
  const back = [0, -0.01, 0.10], tip = [-0.018, -0.005, 0.204 + (V - 1) * 0.03];
  return { mesh: loftParts(rings, back, tip), lowK };
}

/** The FALL: curtains hanging from just inside the cap's border. Every slot falls by its own fraction (the front slots
 * stay near the border, the sides and back fall fully), so the curtain frames the face and is still ONE closed loft.
 * Panels of two slots draw toward their centre as they fall (`separate` × definition): the lab's separated sections. */
function buildFall(carrier, style, c, lowK) {
  const F = style.fall, D = c.definition, drop = F.drop * c.length, steps = 5;
  const inner = Array.from({ length: N }, (_, k) => { const { t, side } = slotOf(k); const f = frameAt(carrier, 'cranium', [clampRow(style.low[t]), t], side); return { origin: f.origin, normal: f.normal }; });
  const fallOf = (k) => { const { t } = slotOf(k); if (t < F.frontGap) return F.front * (t / Math.max(1, F.frontGap)) / (F.open ? D : 1); return 1; };
  const raw = [];
  for (let j = 0; j <= steps; j++) {
    const f = j / steps;
    raw.push(Array.from({ length: N }, (_, k) => {
      const front = frontOf(k), fall = fallOf(k);
      let length = drop * fall;
      if (F.graded) length += F.graded * c.graduation * front * fall;   // the angled bob: the falling strands beside the face longer
      if (F.layers) length *= 0.85 + 0.15 * dmath.cos(k * 1.9) ** 2;
      const wave = F.wave ? F.wave * c.wave * dmath.sin(f * Math.PI * 2.5 + k * 0.4) * f : 0;
      const base = add(inner[k].origin, mul(inner[k].normal, 0.003 + 0.008 * f * (0.7 + 0.3 * c.volume)));
      const swing = wave ? [Math.sign(base[0] || 1) * wave, 0, 0] : [0, 0, 0];
      return add(add(base, swing), [0, 0.012 * f * (1 - front), -length * f]);
    }));
  }
  // separated panels: each pair of slots draws toward its centre as it falls
  const rings = raw.map((ring, j) => { const f = j / steps, s = F.separate ? F.separate * D * f * f : 0;
    return ring.map((p, k) => { if (!s) return p; const pair = k % 2 === 0 ? (k + 1) % N : k - 1; const centre = mean([p, ring[pair]]); return [p[0] + (centre[0] - p[0]) * s, p[1] + (centre[1] - p[1]) * s, p[2]]; }); });
  const top = mean(rings[0]), hem = mean(rings[steps]);
  return loftParts(rings, add(top, [0, 0, 0.02]), add(hem, [0, 0, -0.012]));
}

/** The TAIL family: a ponytail sweep from the tie point down the nape, a bun (a bell at the tie), a braid (a winding taper). */
function buildTail(carrier, style, c) {
  const T = style.tail, tieRow = Math.max(5.6, Math.min(7.6, 6.4 + (c.tie - 1) * 3.0));
  const f = symmetricFrameAt(carrier, 'cranium', [tieRow, MID]);   // the back slot
  const o = add(f.origin, mul(f.normal, 0.012)), n = unit([0, f.normal[1], f.normal[2] * 0.4]);
  const R = T.radius * c.tail;
  if (T.kind === 'bun') {
    const spine = [add(o, mul(n, 0.004)), add(o, mul(n, 0.02)), add(o, mul(n, 0.038)), add(o, mul(n, 0.056)), add(o, mul(n, 0.07))];
    return sweep(spine, [R * 0.55, R * 0.95, R, R * 0.85, R * 0.4], 10, { squash: [1, 0.85] });
  }
  const len = T.length * c.length, steps = T.kind === 'braid' ? 12 : 6, spine = [];
  for (let j = 0; j <= steps; j++) {
    const s = j / steps;
    const out = 0.03 + 0.05 * dmath.sin(Math.min(1, s * 1.6) * Math.PI / 2) - 0.01 * s;   // back, then down the nape
    let p = add(add(o, mul(n, out)), [0, 0, -len * s + 0.012 * dmath.sin(s * Math.PI)]);
    if (T.kind === 'braid') p = add(p, [dmath.sin(s * Math.PI * 4.5 * c.braid) * R * 0.75, dmath.cos(s * Math.PI * 4.5 * c.braid) * R * 0.35, 0]);
    spine.push(p);
  }
  const radii = spine.slice(0, -1).map((_, j) => { const s = j / steps; return T.kind === 'braid' ? R * (1 - 0.6 * s) : R * (0.5 + 0.6 * dmath.sin(Math.min(1, s * 1.3) * Math.PI)) + R * 0.2 * (1 - s); });
  return sweep(spine, radii, T.kind === 'braid' ? 7 : 9);
}

/** The LOCKS (the anime styles): a reduced cap fills the gaps, then separate flattened locks, each ONE closed tapered
 * sweep along a quadratic root → control → tip curve pinned by address: seven bangs across the front (their tips never
 * below the brow, so the eyes read), thirteen side and rear locks (to the jaw on the bob, to the cheek on the short), and
 * on the short five crown spikes. The asymmetry is a sine of the lock index: deterministic, never dice. */
function buildLocks(carrier, style, c, anchors) {
  const K = style.locks, D = c.definition, bob = K.kind === 'bob', meshes = {};
  const at = (row, t, side, lift) => { const f = frameAt(carrier, 'cranium', [clampRow(row), Math.max(0, Math.min(MID, t))], side); return { p: add(f.origin, mul(f.normal, lift)), n: f.normal }; };
  const asym = (i, amp) => dmath.sin(i * 2.4) * amp * c.asymmetry;
  // every lock is built in the RIGHT half-space and mirrored back for the left, so a left lock is the exact mirror of its
  // right twin whenever their spines are (the sweep's ring orientation alone is not mirror-symmetric)
  const mirrorX = (p) => [-p[0], p[1], p[2]];
  const lock = (name, root, control, tip, width, thick, side) => {
    const flip = side === 'L', R = (p) => (flip ? mirrorX(p) : p);
    const steps = 8, spine = [];
    for (let j = 0; j <= steps; j++) { const t = j / steps, u = 1 - t; spine.push(R(root.map((x, k) => u * u * x + 2 * u * t * control[k] + t * t * tip[k]))); }
    const radii = spine.slice(0, -1).map((_, j) => { const t = j / steps; return Math.max(0.0015, width * c.lockWidth * (1 + 0.25 * (D - 1)) * (0.9 + 0.1 * dmath.sin(Math.PI * t)) * dmath.pow(1 - t * t * t, 0.75 * c.taper)); });
    const m = sweep(spine, radii, 6, { squash: [1, Math.max(0.2, thick / width)] });
    meshes[name] = flip ? { ...m, points: Object.fromEntries(Object.entries(m.points).map(([k, p]) => [k, mirrorX(p)])), faces: m.faces.map((f) => [...f].reverse()) } : m;
  };
  const browZ = anchors.glabella[2] + 0.003, chinZ = anchors.menton[2], eyeZ = anchors.eyeR[2];
  // the bangs: seven, fanned across the front, tips down toward the brow and forward of the forehead
  for (let i = 0; i < 7; i++) {
    const o = i - 3, t = Math.abs(o) * 1.1, side = o < 0 ? 'L' : 'R', sign = side === 'R' ? 1 : -1;
    const root = at(6.35 + Math.abs(o) * 0.1, t, side, 0.006).p, mid = at(6.0, t + 0.3 * c.bend, side, 0.02).p;
    const tipZ = Math.max(browZ, browZ + 0.022 - (c.fringe - 1) * 0.02 + (i % 2 ? 0.006 : -0.003) + asym(i, 0.004));
    const tip = [mid[0] + sign * 0.008 * c.bend + asym(i, 0.008), mid[1] + 0.008 + 0.006 * c.bend, tipZ];   // bend: the tips sweep out and forward
    lock(`hairLock${i}`, root, mid, tip, 0.012, 0.004, side);
  }
  // the side and rear locks: thirteen around the skull from temple to temple, a shared crown flow, individual tips
  for (let i = 0; i < 13; i++) {
    const theta = 0.92 + i * (2 * Math.PI - 1.84) / 12, side = theta <= Math.PI ? 'R' : 'L', t = (theta <= Math.PI ? theta : 2 * Math.PI - theta) / Math.PI * MID;
    const noise = asym(i, 0.5);
    const root = at(6.3, t, side, 0.006).p, midF = at(4.6, Math.min(MID, t + noise), side, 0.022);
    const tipZ = bob ? chinZ + 0.012 - (c.length - 1) * 0.06 + dmath.cos(i * 1.7) * 0.008 + asym(i, 0.006) : eyeZ - 0.02 + asym(i, 0.006);
    const outward = bob ? 1.06 : 1.12;
    const tip = [midF.p[0] * outward + midF.n[0] * 0.01 * c.bend, midF.p[1] * (bob ? 1.0 : 1.04) + midF.n[1] * 0.01 * c.bend, tipZ];
    lock(`hairLock${7 + i}`, root, midF.p, tip, bob ? 0.014 : 0.013, 0.005, side);
  }
  // the crown spikes (the short only): five, up and out
  if (!bob) for (let i = 0; i < 5; i++) {
    const theta = 1.1 + i * 0.78, side = theta <= Math.PI ? 'R' : 'L', t = (theta <= Math.PI ? theta : 2 * Math.PI - theta) / Math.PI * MID;
    const root = at(7.3, t, side, 0.008), mid = at(7.7, t, side, 0.022);
    const tip = add(mid.p, add(mul(mid.n, 0.03 * c.bend), [0, 0, 0.016 + (i % 2) * 0.006]));
    lock(`hairLock${20 + i}`, root.p, mid.p, tip, 0.010, 0.004, side);
  }
  return meshes;
}

/** Build every hair mass for a resolved hair spec on a compiled carrier (the head's L1 parts, world coordinates).
 * @returns {{ meshes: { hairCap?, hairFall?, hairTail?, hairLock0… }, measures }} meshes in world space (the head pins
 *   them), and the measures in head metres: the hair's top above the crown, the hem below the chin (negative = below), the
 *   reach behind the occiput. */
export function buildHair(carrier, resolved, { crown, menton, occiput, anchors } = {}) {
  const style = HAIR_LIBRARY[resolved.style];
  if (!style) throw new Error(`hair: unknown style '${resolved.style}' (have ${HAIR_STYLE_NAMES.join(', ')})`);
  const meshes = {};
  if (style.base === 'none') return { meshes, measures: null };
  // the anime styles wear a reduced cap under their locks: the fringe high, the volume capped, the locks carry the read
  const capControls = style.locks ? { ...resolved, fringe: 0.6, volume: Math.min(resolved.volume, 1) } : resolved;
  const cap = buildCap(carrier, style, capControls); meshes.hairCap = cap.mesh;
  if (style.fall) meshes.hairFall = buildFall(carrier, style, resolved, cap.lowK);
  if (style.tail) meshes.hairTail = buildTail(carrier, style, resolved);
  if (style.locks) Object.assign(meshes, buildLocks(carrier, style, resolved, anchors ?? { glabella: [0, 0, 0.09], menton: menton ?? [0, 0, -0.04], eyeR: [0, 0, 0.07] }));
  const pts = Object.values(meshes).flatMap((m) => Object.values(m.points));
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const measures = {
    top_m: crown ? r3(Math.max(...pts.map((p) => p[2])) - crown[2]) : null,
    hem_m: menton ? r3(Math.min(...pts.map((p) => p[2])) - menton[2]) : null,
    back_m: occiput ? r3(occiput[1] - Math.min(...pts.map((p) => p[1]))) : null,
    parts: Object.keys(meshes).length,
  };
  return { meshes, measures };
}
