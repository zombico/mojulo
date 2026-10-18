/**
 * head-relational-eye — the relational head's EYE as an expressive rig: built the way an animator or a portrait painter
 * thinks of an eye, not as a blink.
 *
 *   the globe     a sclera sphere and a corneal bulge that turn with the GAZE (yaw, pitch); the iris and the pupil are
 *                 painted about the gaze axis (`paint`), the pupil's size a dial.
 *   the margins   each lid's edge is an artist's CURVE between the canthi: its height (the upper's openness, the
 *                 lower's raise), where its PEAK sits (medial … lateral) and its SHAPE (flat and tense … round …
 *                 peaked) — anger is a flat upper lid peaked laterally over a raised lower one, sadness an upper lid
 *                 peaked medially, surprise an upper lid lifted round above the iris. The margins ride the globe (and
 *                 the cornea's bulge, so a lid shows the gaze even shut), thickest at the lash line.
 *   lid follow    the upper lid follows the gaze's pitch (look down and it comes down), the lower a little.
 *   the folds     the upper lid drapes the globe from its margin to the crease (the LID SPACE, cut back out of the
 *                 skin), and the fold above rises to the brow's ARC, hung from a forehead BRIDGE by strings
 *                 (`browBridge`); the crease rises as the lid closes; a HOOD lowers the fold, from deep-set to monolid;
 *                 the lower lid's pretarsal roll swells in a squint.
 *   the opening   the almond between the two curves, carved through the skin to the globe.
 *
 * Channels (`EYE_CHANNELS`, per eye; `EYE_EXPRESSIONS` are words over them) compose: a word, then channels over it,
 * then a gaze TARGET (`look`, aimed from each eye's own centre, so near targets converge), then a side's own; the head's ACTIONS (blink, a smile's squint, a brow's lift) add on top. All V units
 * (head heights), the relational head's frame (+x the figure's right, +y the face, +z up). Pure, deterministic.
 */
import { smin, sdRoundCone } from './vajra.js';
import { SM } from '../../util/math-scope.js';

/** the globe (V): 24 mm across, its sclera's front `back` behind the eye point, the cornea proud of it to the point */
export const GLOBE = Object.freeze({ r: 0.052, back: 0.063, cornea: 0.034, iris: 0.0255, pupil: 0.0085 });

/** the channels, [rest, min, max]; the gaze in degrees (+yaw toward the figure's right, +pitch up) */
export const EYE_CHANNELS = Object.freeze({
  open: [1, 0, 1.7],              // the upper lid's height over its rest (0 shut, > 1 the sclera shows above the iris)
  upperPeak: [0, -1, 1],          // where the upper lid's high point sits: −1 medial … +1 lateral
  upperShape: [0, -1, 1],         // −1 flat and tense … 0 the rest arc … +1 peaked
  lower: [0, 0, 1],               // the lower lid's raise (a squint), 1 most of the way to the upper
  lowerPeak: [0, -1, 1],
  lowerShape: [0, -1, 1],
  crease: [0.5, 0, 1],            // the upper lid's crease, how deep
  hood: [0.25, 0, 1],             // the fold above the crease: 0 deep-set (the crease shows) … 1 hooded (it hides)
  pupil: [1, 0.5, 1.7],           // the pupil's size over its rest
  gazeYaw: [0, -35, 35],          // (or `look`: a target the eyes aim at, each from its own centre)
  gazePitch: [0, -30, 30],
  lidFollow: [0.65, 0, 1],        // the share of the gaze's pitch the upper lid follows
});
export const EYE_CHANNEL_NAMES = Object.freeze(Object.keys(EYE_CHANNELS));

/** expression words: channels over the rest (artists' readings of the lid shapes; tuned on the eyes gate) */
export const EYE_EXPRESSIONS = Object.freeze({
  neutral: {},
  wide: { open: 1.5, upperShape: 0.45, lower: 0, crease: 0.8, pupil: 1.25 },
  angry: { open: 0.72, upperPeak: 0.55, upperShape: -0.85, lower: 0.45, lowerShape: -0.6, crease: 0.3, pupil: 0.8 },
  sad: { open: 0.78, upperPeak: -0.65, upperShape: 0.35, lower: 0.1, lowerPeak: -0.3, hood: 0.45 },
  sleepy: { open: 0.42, upperShape: 0.3, lower: 0.1, hood: 0.7, crease: 0.2, lidFollow: 0.8 },
  happy: { open: 0.82, lower: 0.65, lowerShape: 0.55, lowerPeak: 0.2, crease: 0.6 },
  suspicious: { open: 0.55, upperShape: -0.6, lower: 0.4, lowerShape: -0.5, upperPeak: 0.2 },
  focused: { open: 0.85, upperShape: -0.4, lower: 0.25, lowerShape: -0.3, pupil: 0.85 },
  closed: { open: 0 },
});
export const EYE_EXPRESSION_NAMES = Object.freeze(Object.keys(EYE_EXPRESSIONS));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rest = Object.fromEntries(EYE_CHANNEL_NAMES.map((k) => [k, EYE_CHANNELS[k][0]]));

/**
 * One eye's channels: a spec is a word, or { word?, …channels, L?: {…}, R?: {…} } (a side's own over the rest), or
 * absent (neutral). `adds` are the actions' additions (summed after the spec). Returns the clamped channel values.
 */
export function resolveEye(spec, side, adds = {}) {
  const s = typeof spec === 'string' ? { word: spec } : spec || {};
  const { word = 'neutral', L, R, look, ...ch } = s;   // (`look` is the head's: it arrives as each side's gaze)
  const v = { ...rest, ...(EYE_EXPRESSIONS[word] || {}), ...ch, ...((side === 'L' ? L : R) || {}) };
  for (const [k, d] of Object.entries(adds)) v[k] = (v[k] ?? rest[k]) + d;
  return Object.fromEntries(EYE_CHANNEL_NAMES.map((k) => [k, clamp(Number(v[k]) || 0, EYE_CHANNELS[k][1], EYE_CHANNELS[k][2])]));
}

/** Error lines for an `eyes` spec. */
export function eyeSpecErrors(spec, at = 'eyes') {
  if (spec === undefined || spec === null) return [];
  if (typeof spec === 'string') return EYE_EXPRESSIONS[spec] ? [] : [`${at}: one of ${EYE_EXPRESSION_NAMES.join(', ')}, or { word?, …channels, L?, R? }`];
  if (typeof spec !== 'object' || Array.isArray(spec)) return [`${at}: a word or an object of channels`];
  const errs = [];
  for (const [k, v] of Object.entries(spec)) {
    if (k === 'word') { if (!EYE_EXPRESSIONS[v]) errs.push(`${at}.word: one of ${EYE_EXPRESSION_NAMES.join(', ')}`); continue; }
    if (k === 'look') {
      if (!v || typeof v !== 'object' || !['x', 'y', 'z'].every((a) => Number.isFinite(v[a]))) errs.push(`${at}.look: { x, y, z } in metres from between the eyes (+x the figure's right, +y ahead, +z up)`);
      continue;
    }
    if (k === 'L' || k === 'R') { errs.push(...eyeSpecErrors({ ...v }, `${at}.${k}`).filter((e) => !e.includes('.word'))); continue; }
    if (!EYE_CHANNELS[k]) { errs.push(`${at}.${k}: not a channel (${EYE_CHANNEL_NAMES.join(', ')})`); continue; }
    if (!Number.isFinite(v)) errs.push(`${at}.${k}: a number in ${EYE_CHANNELS[k][1]} … ${EYE_CHANNELS[k][2]}`);
  }
  return errs;
}

/**
 * THE GAZE TARGET — the yaw and pitch (degrees) that turn an eye whose globe is centred at `from` toward `to` (both
 * in the head's frame): each eye aims from its own centre, so a near target converges the pair and a far one leaves
 * them parallel. Unclamped; `resolveEye` clamps to the eye's range.
 */
export function lookAngles(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  return { gazeYaw: (Math.atan2(dx, dy) * 180) / Math.PI, gazePitch: (Math.atan2(dz, Math.hypot(dx, dy)) * 180) / Math.PI };
}

/**
 * The bump an eyelid's margin makes over its chord, t ∈ [0, 1] medial → lateral: 0 at the canthi, 1 at the peak `a`,
 * its shape the exponent (`shape` −1 flat-topped … +1 peaked).
 */
function bump(t, a, shape) {
  if (t <= 0 || t >= 1) return 0;
  const s = t < a ? 0.5 * (t / a) : 0.5 + 0.5 * ((t - a) / (1 - a));
  return Math.pow(SM.sin(Math.PI * s), 0.75 * Math.pow(2, 1.3 * shape));
}

/**
 * THE BRIDGE AND ITS STRINGS: the brow's fold hung from the forehead, as a puppet hangs. An invisible BRIDGE runs
 * across the forehead, and from it hang four STRINGS: two medial, down either side of the nose's root to just above the
 * inner canthi, and two lateral, down the temples to just past the outer canthi. Each eye's ARC (the fold's edge under
 * the brow) hangs between its two strings' feet, its peak over the iris's outer edge, so the fold closes onto the lid
 * at the corners. The BROW is tied on the same strings: its head on the medial string over the inner canthus, its tail
 * on the lateral, which runs on the line from the nose's wing through the outer canthus (the tail's classic line); its
 * peak rides the arc's (the epidermis's `browLine` hangs it). Pulling a string moves all that hangs from it: `pull`
 * is the brow pad's action ({ med, L, R }, each a { x, z } shift in V from rest to moved); the medial strings take the
 * medial pull, each lateral string its side's. Returns { bridge: [{x, z}…], strings: [[top, tie, foot]…], arcs,
 * sides }: each arc { Fm, Fl, K, z(x) } (z null past the feet), each side { arc, head, tail } (the brow's ties). V
 * units, the head's frame.
 */
export function browBridge(P, pull = {}) {
  const zero = { x: 0, z: 0 }, med = pull.med || zero, sides = ['L', 'R'].filter((s) => P[`en${s}`]);
  const bz = sides.reduce((m, s) => m + P[`en${s}`].z, 0) / sides.length + 0.16;
  const arcs = {}, strings = [], tops = {}, out = {};
  for (const s of sides) {
    const en = P[`en${s}`], ex = P[`ex${s}`], e = P[`eye${s}`], al = P[`al${s}`], sg = Math.sign(ex.x - en.x), lat = pull[s] || zero;
    const Fm = { x: en.x - sg * 0.012 + med.x, z: en.z + 0.004 + med.z };
    const Fl = { x: ex.x + sg * 0.022 + lat.x, z: ex.z + 0.004 + lat.z };
    // the brow's ties: its head a touch medial of the inner canthus, its tail on the wing-to-canthus line (straight up
    // past the canthus when there is no wing), both carried by their strings' pulls
    const head = { x: en.x - sg * 0.008 + med.x, z: en.z + 0.075 + med.z }, tz = en.z + 0.079;
    const tail = al ? { x: ex.x + (ex.x - al.x) * ((tz - ex.z) / (ex.z - al.z)) + lat.x, z: tz + lat.z } : { x: ex.x + sg * 0.03 + lat.x, z: tz + lat.z };
    // each string a line from its foot through its tie, up to the bridge
    const along = (foot, tie, z) => ({ x: foot.x + ((tie.x - foot.x) * (z - foot.z)) / (tie.z - foot.z), z });
    const K = { x: e.x + sg * GLOBE.iris + (med.x + lat.x) / 2, z: en.z + 0.08 + (med.z + lat.z) / 2 };
    const W = Fl.x - Fm.x, uK = (K.x - Fm.x) / W;
    const chord = (u) => Fm.z + (Fl.z - Fm.z) * u;
    const z = (x) => { const u = (x - Fm.x) / W; return u <= 0 || u >= 1 ? null : chord(u) + (K.z - chord(uK)) * bump(u, uK, -0.35); };
    arcs[s] = { Fm, Fl, K, z };
    out[s] = { arc: arcs[s], head, tail };
    tops[s] = { med: along(Fm, head, bz), lat: along(Fl, tail, bz - 0.03) };
    strings.push([tops[s].med, head, Fm], [tops[s].lat, tail, Fl]);
  }
  // (one side given: the bridge mirrors it)
  const tL = tops.L ? tops.L.lat : { ...tops.R.lat, x: -tops.R.lat.x }, tR = tops.R ? tops.R.lat : { ...tL, x: -tL.x };
  const bridge = [tL, { x: tL.x * 0.7, z: bz }, { x: tR.x * 0.7, z: bz }, tR];
  return { bridge, strings, arcs, sides: out };
}

/**
 * The eye for side `s` of the relational points `P` (V units; `en`, `ex`, `eye` the inner and outer canthi and the
 * pupil's point at rest) under its channels `c` (`resolveEye`) and the head's `fissure` relation, the fold hung from
 * `arc` (`browBridge`'s, for this side; at rest when absent). Returns
 * { opening, lidSpace, lids, rims, crease, globe, paint, margins } — signed fields in V (negative inside): the lid space
 * to cut back out of the skin, the lids' mass to add to it, the opening to carve through it, the margins and folds to lay on, the crease to cut, the globe to set in; `paint(p)` names the globe's part
 * at a surface point ('pupil' | 'iris' | 'sclera') or null; `margins` are the lash lines (upper, lower) as functions of t.
 */
export function eyeRig(P, s, c, fissure, arc = browBridge(P).arcs[s]) {
  const en = P[`en${s}`], ex = P[`ex${s}`], e = P[`eye${s}`];
  const gc = { x: e.x, y: e.y - GLOBE.back, z: e.z };
  // THE GAZE: the axis the cornea, iris and pupil turn to (+yaw toward the figure's right, +pitch up)
  const yaw = (c.gazeYaw * Math.PI) / 180, pitch = (c.gazePitch * Math.PI) / 180;
  const d = { x: SM.sin(yaw) * SM.cos(pitch), y: SM.cos(yaw) * SM.cos(pitch), z: SM.sin(pitch) };
  const cc = { x: gc.x + d.x * (GLOBE.back - GLOBE.cornea), y: gc.y + d.y * (GLOBE.back - GLOBE.cornea), z: gc.z + d.z * (GLOBE.back - GLOBE.cornea) };
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  const globe = (p) => smin(dist(p, gc) - GLOBE.r, dist(p, cc) - GLOBE.cornea, 0.006);
  // the surface the lids ride: the sclera, or the cornea where it bulges further
  const rideY = (x, z) => {
    const sy = gc.y + Math.sqrt(Math.max(0, GLOBE.r ** 2 - (x - gc.x) ** 2 - (z - gc.z) ** 2));
    const r2 = GLOBE.cornea ** 2 - (x - cc.x) ** 2 - (z - cc.z) ** 2;
    return r2 > 0 ? Math.max(sy, cc.y + Math.sqrt(r2)) : sy;
  };
  // THE MARGINS: heights over the chord between the canthi. The upper's rest height is 0.6 of the fissure over the
  // pupil, the lower's 0.4 under it; the upper closes onto the lower; the lids follow the gaze's pitch.
  const follow = SM.sin(pitch) * GLOBE.r;
  const huRest = 0.6 * fissure, hlRest = 0.4 * fissure;
  const hl = hlRest * (1 - 0.85 * c.lower) - 0.3 * follow;
  const huOpen = c.open <= 1 ? -0.92 * hl + (huRest + 0.92 * hl) * c.open : huRest * c.open;
  const hu = huOpen + c.lidFollow * follow * Math.min(1, c.open);
  const aU = clamp(0.42 + 0.22 * c.upperPeak, 0.15, 0.85), aL = clamp(0.6 + 0.2 * c.lowerPeak, 0.15, 0.85);
  const chordZ = (t) => en.z + (ex.z - en.z) * t, xAt = (t) => en.x + (ex.x - en.x) * t;
  const upZ = (t) => chordZ(t) + hu * bump(t, aU, c.upperShape), loZ = (t) => chordZ(t) - hl * bump(t, aL, c.lowerShape);
  const shut = hu + hl < 0.003;
  // THE OPENING: between the curves, the canthi its corners, in front of the globe's centre
  const span = ex.x - en.x;
  const opening = shut ? null : (p) => {
    const t = (p.x - en.x) / span, tc = clamp(t, 0, 1);
    // between the canthi: negative inside (the nearer canthus's distance), positive past them
    const across = t === tc ? -Math.min(t, 1 - t) * Math.abs(span) : Math.abs(t - tc) * Math.abs(span);
    return Math.max(p.z - upZ(tc), loZ(tc) - p.z, across, gc.y - p.y);
  };
  // the curves as bead chains (ONE min each, so they do not bead): the margins on the ride, the upper thickest at
  // the lash line's middle; the pretarsal roll under the lower
  const N = 12, ts = Array.from({ length: N + 1 }, (_, i) => i / N);
  const taper = (t) => SM.sin(Math.PI * t) ** 0.6;
  const pt = (t, z, lift, fwd) => ({ x: xAt(t), y: rideY(xAt(t), z) + fwd, z: z + lift });
  const chainF = (beads) => (p) => {
    let m = Infinity;
    for (let i = 0; i + 1 < beads.length; i++) m = SM.min(m, sdRoundCone(p, beads[i].c, beads[i + 1].c, beads[i].r, beads[i + 1].r));
    return m;
  };
  const upperRim = ts.map((t) => ({ c: pt(t, upZ(t), 0.004 * taper(t), 0.004), r: 0.0035 + 0.006 * taper(t) }));
  const lowerRim = ts.map((t) => ({ c: pt(t, loZ(t), -0.003 * taper(t), 0.003), r: 0.003 + 0.004 * taper(t) }));
  // the crease's height over the margin, more as the lid closes (the lid's skin unfolds)
  const gap = 0.034 * (1 + 0.6 * (1 - Math.min(1, c.open)));
  // THE LID SPACE, hung from the bridge: the upper lid drapes the globe from its margin up to the KNEE (the crease, no
  // higher than where the globe turns away over its top, nor than halfway to the arc), and the FOLD rolls out of the
  // knee forward to the brow's front at the ARC (the bridge's, hung on its strings); the skin in front of that is cut back,
  // so the lid shows between the margin and the crease. Where the arc's feet meet the margin at the canthi the space
  // closes. The HOOD lowers the knee and draws the fold down toward the knee, toward a monolid's overhang.
  const LID_T = 0.012, lidR = GLOBE.r + LID_T, LIDC = GLOBE.cornea + LID_T;
  const shellY = (x, z) => {
    const sy = gc.y + Math.sqrt(Math.max(0, lidR ** 2 - (x - gc.x) ** 2 - (z - gc.z) ** 2));
    const r2 = LIDC ** 2 - (x - cc.x) ** 2 - (z - cc.z) ** 2;
    return r2 > 0 ? Math.max(sy, cc.y + Math.sqrt(r2)) : sy;
  };
  const upMax = Math.max(...ts.map(upZ)), room = clamp(gc.z + 0.75 * lidR - upMax, 0.004, gap);
  const kneeZ = (t) => upZ(t) + Math.max(0, room - 0.012 * c.hood) * (0.35 + 0.65 * taper(t));
  const yArc = e.y + 0.12;   // the fold reaches the brow's front by the arc: ahead of any skin, so the cut ends unseen
  const foldAt = (x, t) => {
    const za0 = arc.z(x);
    if (za0 === null) return null;
    const zm = upZ(t), zk = Math.min(kneeZ(t), zm + 0.5 * Math.max(0, za0 - zm));
    const za = zk + Math.max(0, za0 - zk) * (1 - 0.5 * c.hood), yk = shellY(x, zk);
    return { zm, zk, za, yk, h: Math.max(za - zk, 0.002) };
  };
  const lidSpace = (p) => {
    const t = (p.x - en.x) / span, F = foldAt(p.x, clamp(t, 0, 1));
    if (!F) return Infinity;
    if (p.z <= F.zk) return Math.max(F.zm - p.z, shellY(p.x, p.z) - p.y);
    // the fold rolls out of the knee and rises into the arc (a square's ease: gentle at the crease, steep at the brow)
    const u = Math.min(1, (p.z - F.zk) / F.h), rise = yArc - F.yk, slope = (2 * rise * u) / F.h;
    return Math.max(p.z - F.za, (F.yk + rise * u * u - p.y) / Math.hypot(1, slope));
  };
  // the crease: a groove along the knee
  const crease = c.crease > 0.02 ? chainF(ts.map((t) => {
    const x = xAt(t), F = foldAt(x, t);
    const z = F ? F.zk : kneeZ(t);
    return { c: { x, y: (F ? F.yk : shellY(x, z)) + 0.001, z }, r: (0.002 + 0.004 * c.crease) * (0.3 + 0.7 * taper(t)) };
  })) : null;
  const roll = chainF(ts.map((t) => ({ c: pt(t, loZ(t) - 0.012 - 0.004 * c.lower, 0, 0.002 + 0.006 * c.lower), r: (0.003 + 0.007 * c.lower) * taper(t) })));
  const rims = (p) => SM.min(chainF(upperRim)(p), chainF(lowerRim)(p), roll(p));
  // THE LIDS' MASS: a skin shell over the globe — and over the cornea's bulge, so a shut lid shows the gaze — across
  // the eye's region (an ellipse about it, the canthi's span and a fissure and a crease high), in front of the globe's
  // centre. The opening is carved through it; where the opening closes, the lid stays.
  const ax = Math.abs(span) / 2 + 0.012, az = fissure * 0.9 + 0.03, cx = (en.x + ex.x) / 2, cz = (en.z + ex.z) / 2 + 0.006;
  const lids = (p) => {
    const reg = (Math.hypot((p.x - cx) / ax, (p.z - cz) / az) - 1) * Math.min(ax, az);
    const shell = SM.min(dist(p, gc) - lidR, dist(p, cc) - LIDC);
    return Math.max(shell, reg, gc.y + 0.01 - p.y);
  };
  // THE PAINT: about the gaze axis, on the globe's surface
  const irisR = GLOBE.iris, pupilR = GLOBE.pupil * c.pupil;
  const paint = (p) => {
    if (Math.abs(globe(p)) > 0.004) return null;
    const q = { x: p.x - gc.x, y: p.y - gc.y, z: p.z - gc.z }, along = q.x * d.x + q.y * d.y + q.z * d.z;
    if (along <= 0) return 'sclera';
    const rad = Math.hypot(q.x - d.x * along, q.y - d.y * along, q.z - d.z * along);
    return rad < pupilR ? 'pupil' : rad < irisR ? 'iris' : 'sclera';
  };
  // THE LASH LINES: each margin's front edge, for what grows there (the epidermis's lashes). At t ∈ [0, 1] medial →
  // lateral: the rim's centre `c` and radius `r`, the globe's outward normal `n` there, the margin's tangent `T`
  // (toward the lateral canthus), and `away` (along the globe, away from the opening: up for the upper lid, down for the
  // lower). They ride whatever moved the margins: the openness, a squint, a blink, the gaze and the lid's follow.
  const gradG = (q) => {
    const h = 1e-4, g = { x: globe({ ...q, x: q.x + h }) - globe({ ...q, x: q.x - h }), y: globe({ ...q, y: q.y + h }) - globe({ ...q, y: q.y - h }), z: globe({ ...q, z: q.z + h }) - globe({ ...q, z: q.z - h }) };
    const l = Math.hypot(g.x, g.y, g.z) || 1;
    return { x: g.x / l, y: g.y / l, z: g.z / l };
  };
  const lashLine = (upper) => (t) => {
    const rim = (u) => (upper ? { c: pt(u, upZ(u), 0.004 * taper(u), 0.004), r: 0.0035 + 0.006 * taper(u) } : { c: pt(u, loZ(u), -0.003 * taper(u), 0.003), r: 0.003 + 0.004 * taper(u) });
    const { c: q, r } = rim(t), a = rim(Math.max(0, t - 0.01)).c, b = rim(Math.min(1, t + 0.01)).c;
    const n = gradG(q);
    let T = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const tn = T.x * n.x + T.y * n.y + T.z * n.z;
    T = { x: T.x - n.x * tn, y: T.y - n.y * tn, z: T.z - n.z * tn };
    const tl = Math.hypot(T.x, T.y, T.z) || 1; T = { x: T.x / tl, y: T.y / tl, z: T.z / tl };
    let w = { x: n.y * T.z - n.z * T.y, y: n.z * T.x - n.x * T.z, z: n.x * T.y - n.y * T.x };
    if ((w.z > 0) !== upper) w = { x: -w.x, y: -w.y, z: -w.z };
    return { c: q, r, n, T, away: w };
  };
  const margins = { upper: lashLine(true), lower: lashLine(false), shut };
  const bound = { c: { x: e.x, y: e.y, z: e.z }, r: 0.16 };
  return { opening, lidSpace, lids, rims, crease, globe, paint, bound, gaze: d, margins };
}
