/**
 * head-relational — the head as a SUPERPOSITION of vajras whose points are placed by RELATIONS.
 *
 * `figure-head.js` builds the head from ~40 masses, each at its own hand-set coordinate: the field is relational in
 * how the masses melt together, not in where they are, so every fix stays local. Here the place of every point is a
 * relation to the others, and the masses are vajras strung between those points:
 *
 *   relations   named canons as ratios (`RELATIONS`): the facial thirds, the eye line, head length and breadth (the
 *               cephalic index), face width to head breadth, jaw to face width, the rule of fifths, nasion depth,
 *               nose projection, mouth to nose width, the chin on the nasion vertical. A dial moves its relation and
 *               everything hung off it, and nothing else.
 *   core        the points those relations place (`corePoints`): vertex, glabella, nasion, opisthocranion, euryon,
 *               zygion, gonion, condyle, porion, the canthi, the nose, the mouth, the chin. All in head heights (V).
 *   vajras      three points and three radii each — a round cone from the proximal bead to the centre bead and on to
 *               the distal (the vajra's tangent-line wrap, `sdRoundCone`), radii in V too. The core vajras (vault,
 *               cheek bar, arches, mandible, chin, brow, nose, nostrils, lips) are smooth-min'd: the structure keeps its
 *               distances in the skull. Carves (the orbits) are smooth-subtracted.
 *   skin        the tissue: every bone vajra offset by the forensic soft-tissue depth, the soft masses (muscles at
 *               rest, fat pads, lids) at their own size, SUPERPOSED: the skin is the level set of Σ exp(−dᵢ/k), a
 *               wave per vajra summed (`skinWave` is k). A lone mass keeps its true distance; overlapping masses fill
 *               between them. The nose and the lips join it after. Action vajras, summed, are the next phase.
 *   tuning      the relations are on the SKIN; the wave's INTERNAL points (the beads under zygion, gonion, euryon,
 *               opisthocranion, gnathion, glabella, the nose) are solved so the summed wave meets them
 *               (`solveTune`): a superposition swells where waves overlap, so a bead must sit deeper than its
 *               relation by however much its neighbours' waves add. One channel per measured relation, a damped
 *               Newton step each, measured by the calipers on the skin itself.
 *
 * Frame: the protoform head's (`figure-head.js`): +x the figure's right, +y the face, +z up, STAND units; the origin
 * is the menton's height on the porion's vertical (the ear canal is y = 0, the chin's underside z = 0). V, the head
 * height (vertex to menton), is 230 mm at the canonical stature (1 unit = 1.8 m). Pure, deterministic: no dice.
 */
import { smin, smax, sdRoundCone } from './vajra.js';
import { headMeasures, rayIn } from './head-field-view.js';
import { SM } from '../../util/math-scope.js';

/** the head height v-me in STAND units: 230 mm at 1 unit = 1.8 m */
export const HEAD_V = 0.23 / 1.8;

/** The relations, as ratios (male canon). A pole overrides some; a dial multiplies none — it REPLACES the ratio. */
export const RELATIONS = Object.freeze({
  // ── the vertical: the canon of thirds (tr-g = g-sn = sn-me) and where the eyes and the mouth fall in it
  third: 0.29,          // sn-me / v-me (g-sn and tr-g equal it)
  eyeLine: 0.5,         // the pupils' height / v-me
  nasionDrop: 0.05,     // g-n vertical / v-me
  stomion: 1 / 3,       // (sn - sto) / (sn - me): the mouth a third of the way down the lower face
  // ── the vault
  headLength: 0.85,     // g-op / v-me
  cephalic: 0.78,       // eu-eu / g-op
  faceDepth: 0.45,      // g ahead of the porion / v-me
  // ── the face's widths
  faceWidth: 0.9,       // zy-zy / eu-eu
  jaw: 0.72,            // go-go / zy-zy
  fifths: 0.2,          // eye width / zy-zy (the rule of fifths: en-en one eye, ex-ex three)
  nasalIndex: 0.65,     // al-al / n-sn: the nose's base widens with its length (a bigger nose, a wider base)
  mouthWidth: 1.5,      // ch-ch / al-al
  // ── the profile
  nasionDepth: 0.025,   // g ahead of n / v-me
  noseProjection: 0.37, // sn-prn / n-sn
  lipProjection: 0.02,  // ls ahead of sn / v-me
  // ── the nostrils, each placed from the nose's bottom (the subnasale)
  nostrilRise: 0.012,   // the alare (the wing's lobule at its widest) above sn / v-me
  nostrilSet: 0.035,    // the alare ahead of sn / v-me
  noseFat: 0.035,       // the nose's flesh: the radius of its cone at the base, over the wings / v-me
  philtrumVolume: 0.026, // the philtrum's fullness: the radius of its body down to the bow (the columns grow with it) / v-me
  jowl: 0.012,          // the cheek's fold at its foot, the jowl: its roll's radius / v-me (smaller is flatter)
  foldReach: 0.05,      // how far below the mouth's corner the fold runs / v-me (~11 mm, to the lower lip's edge; ~0.12
                        // carries it on past below the lip toward the jaw's line)
  lipFullness: 1.25,    // the vermilion's volume: its beads' radii about their fixed centres (the corners stay fine), so
                        // fuller lips stand further forward and grow taller and rounder (1 = the bare canon's beads)
  // ── the eye and the mouth
  fissure: 0.045,       // the palpebral fissure's height / v-me (the eye's opening, ~10 mm)
  canthalTilt: 0.008,   // the lateral canthus above the medial / v-me
  upperVermilion: 0.035, // the upper lip's red height / v-me
  lowerVermilion: 0.043, // the lower lip's / v-me (the lower lip the fuller)
  chin: 0,              // pg ahead of the nasion vertical / v-me (− a receding chin)
  // ── the jaw's limits: how far it opens at full activation (`jaw: 1`), and how
  jawOpen: 0.17,        // the incisors' opening at full / v-me (~39 mm: a full, comfortable opening; the anatomical
                        // maximum is ~50 mm)
  condyleGlide: 0.045,  // the condyle's glide forward and down the articular eminence at full / v-me (~10 mm)
  overjet: 0.012,       // the lower incisors behind the upper / v-me (~3 mm): the lower arch is the upper's mirror
                        // across the occlusal plane, set back by this
  incisorShow: 0.032,   // the upper incisors' edge below the stomion / v-me (~7.4 mm: the full upper lip hangs below
                        // the stomion, and ~4 mm of central incisor shows under it as the lips part, ~3 of the laterals)
  archWidth: 1,         // the dental arch's width, as a share of the canon's (`DENTITION`)
  // ── masses (radii as shares of v-me)
  brow: 1,              // brow-ridge radius multiplier (the strongest sex cue)
  // ── the wave: the skin is the level set of the SUM of every mass's wave exp(−d/k); k is its wavelength (in V).
  // A lone mass keeps its distance; overlapping masses fill between them, as skin spans the hollows between bones.
  skinWave: 0.03,
  featureWave: 0.45,    // the wavelength's share near the eyes and the mouth: features smaller than the skin's wave
                        // need a shorter one, or the sum blurs their edges (1 = the same everywhere)
});
export const RELATION_NAMES = Object.freeze(Object.keys(RELATIONS));
/** the sex poles: ratios the female canon moves (the rest are shared) */
export const RELATION_POLES = Object.freeze({
  male: Object.freeze({}),
  female: Object.freeze({ archWidth: 0.96, incisorShow: 0.028, lipFullness: 1.3, jawOpen: 0.16, nasalIndex: 0.62, fissure: 0.048, canthalTilt: 0.011, upperVermilion: 0.037, lowerVermilion: 0.046, headLength: 0.84, cephalic: 0.8, jaw: 0.68, nasionDepth: 0.012, noseProjection: 0.34, chin: -0.012, brow: 0.45, faceWidth: 0.88 }),
});

/**
 * The core points, in head heights (V = 1), placed by the relations. Returns { [name]: {x, y, z} } — right-side
 * points carry R, their mirrors L.
 */
export function corePoints(rel = RELATIONS) {
  const R = { ...RELATIONS, ...rel };
  const T = R.third;
  // the vertical (menton z = 0, vertex z = 1)
  const zSn = T, zG = 2 * T, zTr = 3 * T, zN = zG - R.nasionDrop, zEye = R.eyeLine;
  const zSto = zSn - R.stomion * T;
  // the vault: glabella R.faceDepth ahead of the porion, opisthocranion the head's length behind it
  const g = { x: 0, y: R.faceDepth, z: zG };
  const op = { x: 0, y: g.y - R.headLength, z: zG };
  const euX = (R.cephalic * R.headLength) / 2;
  const zyX = (R.faceWidth * 2 * euX) / 2, goX = (R.jaw * 2 * zyX) / 2;
  const eye = R.fifths * 2 * zyX;                 // one eye's width
  const enX = eye / 2, exX = enX + eye, alX = (R.nasalIndex * (zN - zSn)) / 2, chX = R.mouthWidth * alX;
  // the profile, hung off the nasion
  const n = { x: 0, y: g.y - R.nasionDepth, z: zN };
  const sn = { x: 0, y: n.y + 0.01, z: zSn };
  const prn = { x: 0, y: sn.y + R.noseProjection * (zN - zSn), z: zSn + 0.03 };
  const pg = { x: 0, y: n.y + R.chin, z: 0.06 };
  const P = {
    vertex: { x: 0, y: (g.y + op.y) / 2 - 0.02, z: 1 }, trichion: { x: 0, y: g.y - 0.035, z: zTr },
    g, op, n, sn, prn,
    rhinion: { x: 0, y: n.y + 0.45 * (prn.y - n.y) + 0.008, z: zN - 0.55 * (zN - prn.z) },
    ls: { x: 0, y: sn.y + R.lipProjection, z: zSto + 0.6 * R.upperVermilion },
    sto: { x: 0, y: sn.y + R.lipProjection - 0.012, z: zSto },
    li: { x: 0, y: sn.y + R.lipProjection - 0.006, z: zSto - 0.55 * R.lowerVermilion },
    pg, gn: { x: 0, y: pg.y - 0.03, z: 0.015 }, me: { x: 0, y: pg.y - 0.07, z: 0 },
    porionR: { x: euX * 0.88, y: 0, z: zEye - 0.045 },
  };
  const side = (name, x, y, z) => { P[`${name}R`] = { x, y, z }; P[`${name}L`] = { x: -x, y, z }; };
  side('eu', euX, op.y + R.headLength * 0.42, 0.72);
  side('zy', zyX, 0.13, zEye - 0.06);                         // the arch's widest, ahead of the ear
  side('malar', zyX * 0.78, g.y - 0.09, zEye - 0.09);        // the cheekbone's front (the zygomatic prominence)
  side('fz', exX + 0.01, g.y - 0.07, zG - 0.01);             // frontozygomatic: the brow's outer end
  side('condyle', zyX * 0.87, 0.045, zEye - 0.08);           // ahead of the ear canal, under the arch, inside the zygion
  side('go', goX, 0.07, zSto - 0.03);                        // the jaw's corner
  side('ment', goX * 0.42, pg.y - 0.035, 0.05);              // the mental tubercle: the chin's corners
  side('en', enX, n.y - 0.045, zEye);
  side('ex', exX, n.y - 0.09, zEye + R.canthalTilt);
  side('eye', (enX + exX) / 2, n.y - 0.07, zEye);
  side('al', alX, sn.y + R.nostrilSet, zSn + R.nostrilRise);
  side('ch', chX, sn.y + R.lipProjection - 0.045, zSto);
  // THE MODIOLUS — where the muscles of the cheek meet beside the mouth's corner: authored at the corner, set back by
  // the tune (`mod`) so the summed waves of everything that ends there put the skin ON the corner, not proud of it
  side('mod', chX, sn.y + R.lipProjection - 0.045, zSto);
  // THE INCISAL POINT — where the incisors meet, behind the stomion: the teeth's anchor, and where the jaw's opening is
  // measured (`jawOpen`)
  P.inc = { x: 0, y: sn.y + R.lipProjection - 0.012 - 0.04, z: zSto - R.incisorShow };
  // THE CHEEK CONTROL POINT: straight out from the rhinion (mid-bridge) to under the eye's centre — the cheek's apex,
  // where the malar pad peaks; set on the skin a touch proud of the cornea's plane
  for (const s of ['L', 'R']) P[`cheek${s}`] = { x: P[`eye${s}`].x, y: P[`eye${s}`].y + 0.01, z: P.rhinion.z };
  // THE EYE'S OPENING: the upper lid's apex sits medial of the pupil and 0.6 of the fissure above it (it covers the
  // iris's top), the lower's lateral and 0.4 below; the canthi are en and ex
  side('lidUp', (enX + exX) / 2 - 0.1 * eye, n.y - 0.07, zEye + 0.6 * R.fissure + R.canthalTilt / 2);
  side('lidLo', (enX + exX) / 2 + 0.1 * eye, n.y - 0.07, zEye - 0.4 * R.fissure + R.canthalTilt / 2);
  // THE MOUTH'S LINES: the cupid's bow peaks on the philtral columns, the lower lip's fullest either side of centre
  side('bow', 0.2 * chX, sn.y + R.lipProjection - 0.004, zSto + R.upperVermilion);
  side('loMid', 0.45 * chX, sn.y + R.lipProjection - 0.012, zSto - 0.5 * R.lowerVermilion);
  P.porionL = { ...P.porionR, x: -P.porionR.x };
  return P;
}

/**
 * SOFT-TISSUE DEPTH — the forensic reconstruction's markers: how far the skin stands off the bone at named points, in
 * millimetres (approximate adult means after the published tables, e.g. Rhine & Campbell 1980, De Greef et al. 2006;
 * to be checked against the source before they become a gate). The relations name SKIN points (the anthropometric
 * canon is measured on the skin); the skull is set INSIDE them by these depths, and the skin is the skull offset back
 * out by the depth interpolated between the markers — so the skin lands on the relations again.
 */
export const TISSUE_MM = Object.freeze({
  vertex: 5.5, trichion: 4.5, g: 5.5, n: 6.5, op: 6, eu: 5.5, supraorbital: 6, suborbital: 6.5, malar: 11, zy: 7,
  temporal: 10, condyle: 9, masseter: 18, go: 12, buccal: 15, philtrum: 12, mentolabial: 11, pg: 11, gn: 8, me: 7,
});
const MM_V = 1 / 230;   // a millimetre in head heights
/** the tissue markers on the mandible, and how much of the jaw's motion each rides */
const JAW_TISSUE = Object.freeze({ mentolabial: 1, pg: 1, gn: 1, me: 1, go: 1, masseter: 0.5, buccal: 0.5 });

/** the markers' positions on the skin, from the core points: [{ p, t }] with t in V */
function tissueMarkers(P) {
  const mid = (a, b, t = 0.5) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  const T = (k) => TISSUE_MM[k] * MM_V;
  const m = [
    [P.vertex, 'vertex'], [P.trichion, 'trichion'], [P.g, 'g'], [P.n, 'n'], [P.op, 'op'],
    [{ x: 0, y: (P.sn.y + P.ls.y) / 2 - 0.01, z: (P.sn.z + P.ls.z) / 2 }, 'philtrum'],
    [{ x: 0, y: P.pg.y - 0.01, z: (P.li.z + P.pg.z) / 2 }, 'mentolabial'], [P.pg, 'pg'], [P.gn, 'gn'], [P.me, 'me'],
  ];
  for (const s of ['L', 'R']) {
    m.push([P[`eu${s}`], 'eu'], [P[`zy${s}`], 'zy'], [P[`malar${s}`], 'malar'], [P[`go${s}`], 'go'],
      [{ ...P[`eye${s}`], z: P[`eye${s}`].z + 0.06, y: P[`eye${s}`].y - 0.005 }, 'supraorbital'],
      [{ ...P[`eye${s}`], z: P[`eye${s}`].z - 0.06, y: P[`eye${s}`].y - 0.01 }, 'suborbital'],
      [mid(P[`fz${s}`], P[`eu${s}`], 0.4), 'temporal'], [P[`condyle${s}`], 'condyle'],
      [mid(P[`go${s}`], P[`malar${s}`], 0.45), 'masseter'], [mid(P[`ch${s}`], P[`go${s}`], 0.35), 'buccal']);
  }
  return m.map(([p, k]) => ({ p, t: T(k), k }));
}

/**
 * THE TUNE CHANNELS — one per measured relation: the internal point(s) it moves and what reads it. A `measure`
 * channel reads a caliper distance its step SHRINKS (a paired width by twice the step); a `point` channel reads where
 * the skin put a landmark along an `axis`, and its step moves the point the same way (a distance like n-sn cannot say
 * which of its ends is off).
 */
export const TUNE_CHANNELS = Object.freeze({
  eu: { measure: 'eu-eu', pair: true },        // the euryons inward: the vault's radius
  zy: { measure: 'zy-zy', pair: true },        // the zygions, the cheekbones' fronts and the condyles inward: the face's
                                               // widest is wherever the summed wave puts it — the arch, the malar, the joint
  go: { measure: 'go-go', pair: true },        // the gonions inward: the mandible's corners, the masseter's insertion
  op: { measure: 'g-op' },                     // the opisthocranion forward
  g: { measure: 'nasion depth' },              // the glabella back: the brow, the frontal bulb
  gn: { measure: 'n-gn' },                     // the chin up: pogonion, gnathion, menton, the chin's corners
  n: { point: 'n', axis: 'z' },                // the brow ridge and the nose's root up together: the skin's nasion dip
                                               // forms where the brow's wave gives way, not at the relation's point
  sn: { point: 'sn', axis: 'z' },              // the subnasale up
  prn: { measure: 'sn-prn' },                  // the nose tip back
  al: { measure: 'al-al', pair: true },        // the wings inward: the nasal index
  mod: { probe: 'ch', axis: 'y' },             // the modiolus back: seven masses end beside the mouth's corner, and their
                                               // summed waves swelled it ~12 mm proud of the cheilion — the mouth sat
                                               // in a trough between two mounds instead of standing out on its arc
});
const ZERO_TUNE = Object.freeze(Object.fromEntries(Object.keys(TUNE_CHANNELS).map((k) => [k, 0])));

/** The wave's internal points: the skin points moved by the tune (V). The relations' own points are untouched. */
export function tunedPoints(P, tune = ZERO_TUNE) {
  const t = { ...ZERO_TUNE, ...tune };
  const Q = { ...P };
  const inward = (k, d) => { for (const s of ['L', 'R']) Q[`${k}${s}`] = { ...P[`${k}${s}`], x: P[`${k}${s}`].x - Math.sign(P[`${k}${s}`].x) * d }; };
  inward('eu', t.eu); inward('zy', t.zy); inward('malar', t.zy); inward('condyle', t.zy); inward('go', t.go);
  Q.op = { ...P.op, y: P.op.y + t.op };
  Q.g = { ...P.g, y: P.g.y - t.g, z: P.g.z + t.n };
  for (const k of ['pg', 'gn', 'me', 'mentL', 'mentR']) Q[k] = { ...P[k], z: P[k].z + t.gn };
  Q.n = { ...P.n, z: P.n.z + t.n };
  Q.sn = { ...P.sn, z: P.sn.z + t.sn };
  for (const k of ['alL', 'alR']) Q[k] = { ...P[k], z: P[k].z + t.sn };
  Q.prn = { ...P.prn, y: P.prn.y - t.prn };
  inward('al', t.al);
  for (const s of ['L', 'R']) Q[`mod${s}`] = { ...P[`mod${s}`], y: P[`mod${s}`].y + t.mod };
  return Q;
}

/**
 * Solve the tune for a sex + relations: measure the skin, step each channel by its own error, repeat until every
 * relation is met within `tolerance` mm or `steps` run out. Returns { tune, steps, residual: { channel: mm } }.
 * Deterministic: the same relations solve to the same tune.
 */
export function solveTune({ sex = 'male', relations = {}, steps = 14, tolerance = 0.5, damping = 0.9 } = {}) {
  // a channel that OVERSHOOTS (its error changes sign) halves its gain, and earns it back otherwise — an error that
  // grows on the same side was a neighbour's push, not the channel's own step; no point moves further than LIMIT
  const LIMIT = 0.08;
  let tune = { ...ZERO_TUNE }, residual = null, last = null, n = 0;
  const gain = Object.fromEntries(Object.keys(TUNE_CHANNELS).map((k) => [k, damping]));
  for (; n < steps; n++) {
    const head = relationalHead({ sex, relations, tune });
    const { mm, points } = headMeasures(head);
    const errOf = (c) => (c.measure ? (mm[c.measure] == null ? null : mm[c.measure] - head.targets[c.measure])
      : c.probe ? (() => { const q = probeOf(head, c.probe); return q ? (q[c.axis] - head.landmarks[`${c.probe}R`][c.axis]) / HEAD_V / MM_V : null; })()
        : (points[c.point] ? (points[c.point][c.axis] - head.landmarks[c.point][c.axis]) / HEAD_V / MM_V : null));
    residual = Object.fromEntries(Object.entries(TUNE_CHANNELS).map(([k, c]) => { const e = errOf(c); return [k, e == null ? null : Math.round(e * 10) / 10]; }));
    if (Object.values(residual).every((e) => e == null || Math.abs(e) <= tolerance)) break;
    const next = { ...tune };
    for (const [k, c] of Object.entries(TUNE_CHANNELS)) {
      const e = residual[k];
      if (e == null || Math.abs(e) <= tolerance) continue;
      if (last && last[k] != null) gain[k] = Math.sign(e) !== Math.sign(last[k]) && Math.abs(e) > tolerance ? gain[k] / 2 : Math.min(damping, gain[k] * 1.5);
      const step = (gain[k] * e * MM_V) / (c.pair ? 2 : 1);
      next[k] = clampTo(c.point || c.probe ? tune[k] - step : tune[k] + step, LIMIT);
    }
    last = residual;
    tune = next;
  }
  return { tune, steps: n, residual };
}
const clampTo = (v, lim) => Math.max(-lim, Math.min(lim, v));
/** a skin point the calipers do not read, found for the tune: `ch`, the front of the skin at the mouth's corner (the
 * front-most over a few heights about it, so the lip line's slot is not taken for the corner) */
function probeOf(head, name) {
  const L = head.landmarks, p = L[`${name}R`], H = L.H;
  let best = null;
  for (const dz of [-0.008, -0.004, 0, 0.004, 0.008]) {
    const q = rayIn(head.field, { x: p.x, y: 0, z: p.z + dz * H }, [0, 1, 0]);
    if (q && (!best || q.y > best.y)) best = q;
  }
  return best;
}
const TUNE_CACHE = new Map();

/**
 * THE DENTITION — the upper permanent teeth, one side, from the midline (mm, adult means after the dental canon): `x`
 * out from the midline and `d` back from the central incisors' labial faces to the crown's labial face, the crown's
 * half-thickness `r`, its height `h`, its edge's radius as a share of `r` (thin incisal edges, a pointed canine, broad
 * occlusal tables) and how far its edge leans forward of its cervix.
 */
export const DENTITION = Object.freeze({
  Central: { x: 4.3, d: 0, r: 3.4, h: 10.5, edge: 0.7, lean: 1.2 },
  Lateral: { x: 11.2, d: 3, r: 3.1, h: 9, edge: 0.7, lean: 1 },
  Canine: { x: 16.8, d: 7.5, r: 3.9, h: 10, edge: 0.6, lean: 0.6 },
  Premolar1: { x: 20.3, d: 13.5, r: 4.3, h: 8, edge: 0.95, lean: 0 },
  Premolar2: { x: 22.3, d: 20, r: 4.4, h: 7.5, edge: 0.95, lean: 0 },
  Molar1: { x: 24.8, d: 27.5, r: 5.2, h: 7, edge: 0.95, lean: 0 },
  Molar2: { x: 25.8, d: 37.5, r: 5, h: 6.5, edge: 0.95, lean: 0 },
});

/**
 * The core vajras over the points: three points (proximal, centre, distal) and three radii in V, and a blend group.
 * Every bead whose SURFACE a relation names is set inside its skin point by its radius plus the tissue there: the
 * relation is on the skin, the bone under it, the bead's centre inside the bone. Returns [{ name, a, c, b, r, group }].
 */
export function coreVajras(P, rel = RELATIONS) {
  const R = { ...RELATIONS, ...rel };
  const mid = (a, b, t = 0.5) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  const at = (p, d) => ({ x: p.x + (d.x || 0), y: p.y + (d.y || 0), z: p.z + (d.z || 0) });
  const inX = (p, r) => ({ ...p, x: p.x - Math.sign(p.x) * r });
  const T = (k) => TISSUE_MM[k] * MM_V;
  const euX = P.euR.x, V = [];
  const v = (name, a, c, b, r, group = 'bone', drive) => V.push({ name, a, c, b, r, group, ...(drive ? { drive } : {}) });
  // THE VAULT — frontal, parietal and occipital bulbs along the sagittal line: the parietal's radius is the euryon's
  // bone, its top the vertex's; the frontal sits behind the brow; the occipital's back is the opisthocranion's bone
  const rP = euX - T('eu'), rF = rP * 0.82, rO = rP * 0.8;
  const front = { x: 0, y: P.g.y - 0.035 - rF, z: P.g.z + 0.11 };
  const crown = { x: 0, y: P.euR.y, z: 1 - T('vertex') - rP };
  const back = { x: 0, y: P.op.y + T('op') + rO, z: P.op.z + 0.02 };
  v('vault', front, crown, back, [rF, rP, rO]);
  // The rest of the bone is authored at its SKIN size (`skin: true`): a bead's bone radius is its radius less the
  // tissue at its centre (relationalHead), so the skin over it — the bone plus the same depth — is the bead again.
  const w = (name, a, c, b, r, drive, opts = {}) => V.push({ name, a, c, b, r, group: 'bone', skin: true, ...(drive ? { drive } : {}), ...opts });
  // the temporal walls: the vault narrows to the arch ahead of the ears (the temporal fossa)
  for (const s of ['L', 'R']) w(`temporal${s}`, at(inX(P[`eu${s}`], 0.16), { y: 0.06, z: -0.05 }), inX(mid(P[`fz${s}`], P[`zy${s}`], 0.6), 0.04), inX(P[`zy${s}`], 0.03), [0.11, 0.04, 0.03]);
  // THE CHEEK BAR — cheekbone to cheekbone through the maxilla, behind the nose
  const maxilla = { x: 0, y: P.sn.y - 0.11, z: (P.sn.z + P.n.z) / 2 - 0.02 };
  w('cheekBar', at(P.malarL, { y: -0.05 }), maxilla, at(P.malarR, { y: -0.05 }), [0.05, 0.12, 0.05]);
  // the zygomatic arches: cheekbone → zygion → in front of the ear
  for (const s of ['L', 'R']) w(`arch${s}`, at(P[`malar${s}`], { y: -0.05 }), inX(P[`zy${s}`], 0.03), at(P[`condyle${s}`], { z: 0.035 }), [0.05, 0.03, 0.03]);
  // the alveolar mass: the upper jaw under the lips, the mouth's bed (the teeth). The dental arch curves back: its ends
  // lie behind the mouth's corners and inside them (on the corners, their skin stood ~7 mm proud of the cheilion and
  // the mouth sat flat between them)
  w('alveolar', at(inX(P.chL, 0.012), { y: -0.08 }), at(P.sto, { y: -0.075, z: 0.02 }), at(inX(P.chR, 0.012), { y: -0.08 }), [0.05, 0.075, 0.05]);
  // THE MANDIBLE — each side condyle → gonion → the chin's corner (the vajra's centre IS the jaw's corner), the
  // chin bar across, and the floor of the mouth between the corners
  // (`drive` names, per bead, the ACTIONS that move it — `jaw` rides the hinge; absent, the bead is still)
  const J = ['jaw'];
  // (the body of the jaw tapers into the chin: its front bead is small and set back, so the chin is one mass)
  for (const s of ['L', 'R']) w(`mandible${s}`, P[`condyle${s}`], inX(P[`go${s}`], 0.045), at(inX(P[`ment${s}`], 0.02), { y: -0.03 }), [0.035, 0.045, 0.03], [null, J, J]);
  // the chin: one rounded mass on the midline (the mental protuberance) with its tubercles small either side
  // (the chin and the floor face forward and down: their bone steps toward the head's centre, `stepIn`, never
  // sideways as a width bead's does — a sideways step left the tubercles proud and cleft the chin)
  w('chin', at(P.mentL, { y: -0.005, z: 0.01 }), at(P.pg, { y: -0.05, z: 0.005 }), at(P.mentR, { y: -0.005, z: 0.01 }), [0.025, 0.05, 0.025], [J, J, J], { stepIn: true });
  w('floor', at(P.goL, { x: 0.05 }), at(P.me, { y: -0.08, z: 0.06 }), at(P.goR, { x: -0.05 }), [0.05, 0.075, 0.05], [J, J, J], { stepIn: true });
  // THE BROW — frontozygomatic to frontozygomatic through the glabella, its radius the sex's ridge
  const rb = 0.03 + 0.02 * R.brow;
  w('brow', P.fzL, at(P.g, { y: -rb }), P.fzR, [0.035, rb, 0.035]);
  // THE SOFT MASSES — muscles at rest and fat pads, origin → belly → insertion, authored at their skin size (no bone
  // under them, no tissue over them). They fill what an offset of the bone cannot: the hollows between the bones.
  // A muscle here is its REST volume; its action (phase 2) drives the same vajra. Lateral beads are set inside the
  // widths their relations name (zy, go), so the skin still meets them.
  const soft = (name, a, c, b, r, drive) => V.push({ name, a, c, b, r, group: 'soft', muscle: true, ...(drive ? { drive } : {}) });
  for (const s of ['L', 'R']) {
    const zy = P[`zy${s}`], go = P[`go${s}`], malar = P[`malar${s}`], ch = P[`ch${s}`], md = P[`mod${s}`], fz = P[`fz${s}`], eu = P[`eu${s}`], eye = P[`eye${s}`];
    // masseter: the arch's underside → the belly over the ramus → the jaw's corner (its insertion IS the gonion)
    const corner = [`corner${s}`];
    soft(`masseter${s}`, inX(at(mid(malar, zy, 0.6), { z: -0.04 }), 0.035), inX(at(mid(zy, go), { y: -0.01 }), 0.05), inX(at(go, { y: 0.02, z: 0.02 }), 0.035), [0.035, 0.05, 0.035], [null, ['jawHalf'], J]);
    // temporalis: the temporal line on the vault → the fossa → under the arch (it fills the temple)
    soft(`temporalis${s}`, inX(at(mid(fz, eu, 0.5), { z: 0.06 }), 0.08), inX(at(mid(fz, zy, 0.55), { y: -0.03 }), 0.06), inX(at(zy, { y: 0.03, z: -0.02 }), 0.06), [0.05, 0.045, 0.025]);
    // THE CHEEK BALLOON — a water balloon of the cheek (the buccal fat and the malar pad as one mass): anchored at the
    // jaw's corner (PINNED to the jaw: as the mandible opens the balloon stretches with it, so the cheek's wall reaches
    // the back of the jaw and does not part from it), bulging at the cheek control point, tapering to the mouth's corner above and below it. Two vajras
    // sharing the bulge. `balloon` keeps its volume: when an action shortens it (a smile draws its ends toward the
    // cheek), its radii grow by √(rest length / length), so the cheek's lift in a smile comes from the relation.
    const anchor = inX(at(go, { y: 0.03, z: 0.04 }), 0.05), bulge = at(P[`cheek${s}`], { y: -0.045 });
    // (the arms overlap end to end — their ends a corner's height apart, their radii wider than half of it — so the
    // balloon is one closed mass, not a loop with a hole through it)
    const endUp = at(md, { x: -Math.sign(ch.x) * 0.005, y: -0.025, z: 0.016 }), endLo = at(md, { x: -Math.sign(ch.x) * 0.005, y: -0.025, z: -0.016 });
    V.push({ name: `cheekUp${s}`, a: anchor, c: at(bulge, { z: 0.01 }), b: endUp, r: [0.04, 0.055, 0.024], group: 'soft', muscle: true, balloon: true, drive: [J, [`bulge${s}`], corner] });
    V.push({ name: `cheekLo${s}`, a: at(anchor, { z: -0.02 }), c: at(bulge, { z: -0.035, y: -0.01 }), b: endLo, r: [0.04, 0.055, 0.024], group: 'soft', muscle: true, balloon: true, drive: [J, [`bulge${s}`], [`loMid${s}`]] });
    // the BELLY: the arms bend up through the bulge, so the triangle between the anchor, the bulge and the corner
    // would be empty — a third vajra through its centre fills it, and the balloon is solid
    const belly = { x: (anchor.x + bulge.x + ch.x) / 3, y: (anchor.y + bulge.y + ch.y) / 3 - 0.01, z: (anchor.z + bulge.z + ch.z) / 3 };
    V.push({ name: `cheekBelly${s}`, a: anchor, c: inX(belly, 0.01), b: at(md, { x: -Math.sign(ch.x) * 0.008, y: -0.03 }), r: [0.04, 0.06, 0.026], group: 'soft', muscle: true, balloon: true, drive: [J, ['jawHalf'], corner] });
    // ZYGOMATICUS MAJOR — the smile's muscle: the cheekbone's side → the belly across the cheek → the mouth's corner
    // (the modiolus). At rest a thin strap under the balloon; `smile` pulls its insertion toward its origin, and as a
    // balloon it keeps its volume, so it thickens as it shortens.
    // THE CHEEK'S WALL — the buccinator: from the upper molars (fixed to the face) and the lower molars (riding the
    // jaw) to the mouth's corner, closed at the back by the raphe between them. A frame that stretches with the jaw,
    // so the side of the mouth stays covered however far it opens (the balloon covers the cheek's face, not its side).
    const mUp = inX(at(go, { y: 0.12, z: P.sto.z - go.z + 0.045 }), 0.03), mLo = inX(at(go, { y: 0.12, z: P.sto.z - go.z - 0.05 }), 0.03);
    soft(`buccUp${s}`, mUp, inX(at(mid(mUp, ch), { y: 0.0 }), 0.012), at(md, { x: -Math.sign(ch.x) * 0.006, y: -0.035 }), [0.035, 0.032, 0.022], [null, null, corner]);
    soft(`buccLo${s}`, mLo, inX(at(mid(mLo, ch), { y: 0.0 }), 0.012), at(md, { x: -Math.sign(ch.x) * 0.006, y: -0.035 }), [0.035, 0.032, 0.022], [J, [`loMid${s}`], corner]);
    soft(`raphe${s}`, mUp, mid(mUp, mLo), mLo, [0.035, 0.032, 0.035], [null, ['jawHalf'], J]);
    // the depressor anguli oris: the mandible's front → the corner — seals the lower cheek to the chin however far
    // the jaw drops
    soft(`depressor${s}`, at(inX(P[`ment${s}`], 0.03), { y: -0.01, z: 0.01 }), at(mid(P[`ment${s}`], ch), { y: -0.025 }), at(md, { x: -Math.sign(ch.x) * 0.006, y: -0.03, z: -0.01 }), [0.03, 0.032, 0.022], [J, [`loMid${s}`], corner]);
    // in front of the ear: the joint's cover, between the jaw's joint and the vault (the ear will sit on it)
    soft(`preauricular${s}`, at(P[`condyle${s}`], { y: -0.01 }), inX(at(P[`porion${s}`], { y: -0.045, z: 0.02 }), 0.04), inX(at(P[`eu${s}`], { y: -0.06, z: -0.2 }), 0.1), [0.045, 0.06, 0.06]);
    // behind the ramus, under the ear: the parotid's fill, from under the ear down behind the jaw's angle, so the
    // ramus gliding forward as the mouth opens leaves no gap behind it
    soft(`parotid${s}`, inX(at(P[`condyle${s}`], { y: -0.05, z: -0.02 }), 0.02), inX(at(mid(P[`condyle${s}`], go), { y: -0.07 }), 0.03), inX(at(go, { y: -0.05, z: 0.03 }), 0.04), [0.045, 0.05, 0.04]);
    // THE CHEEK'S FOLD — the nasolabial fold's cheek side, on into the jowl: a thin roll from the cheek behind the
    // wing, level with the alar crease (anchored back there, the fold has a broad base and sits back from the lip), past the mouth's corner (outside it, clear of the
    // modiolus), down to the jowl over the jaw's line. Summed with the cheek, it is the edge where the cheek's fat stops
    // against the lip; its middle rides the zygomaticus up and back while the cheek bunches forward over it (so a smile
    // deepens the fold; riding the bulge, it stood forward as a knob), its foot the jaw. Its foot is the
    // jowl (`jowl`, its radius) and runs `foldReach` below the corner
    soft(`fold${s}`, at(P[`al${s}`], { x: Math.sign(ch.x) * 0.03, y: -0.095, z: -0.006 }), { x: ch.x + Math.sign(ch.x) * 0.04, y: ch.y - 0.03, z: ch.z + 0.006 }, { x: ch.x + Math.sign(ch.x) * 0.012, y: ch.y - 0.03, z: ch.z - R.foldReach }, [0.006, 0.012, R.jowl], [null, [`zyg${s}`], J]);
    V.push({ name: `zygomaticus${s}`, a: inX(at(mid(malar, zy, 0.35), { y: -0.03, z: -0.01 }), 0.03), c: at(mid(malar, ch, 0.5), { y: -0.025 }), b: at(md, { y: -0.02 }), r: [0.018, 0.016, 0.014], group: 'soft', muscle: true, balloon: true, drive: [null, [`zyg${s}`], corner] });
    // the lids: corner → over the globe → corner, upper and lower
    // the lid margins: rolls along the opening's arcs, lying on the globe (canthus → apex → canthus); their centre
    // beads ARE the opening's apexes (the carve reads them back, so a lid that moves moves the opening)
    const onGlobe = (q, lift) => { const dx = q.x - eye.x, dz = q.z - eye.z, gy = eye.y - GLOBE.back; return { ...q, y: gy + Math.sqrt(Math.max(0, GLOBE.r ** 2 - dx * dx - dz * dz)) + lift }; };
    soft(`upperLid${s}`, onGlobe(P[`en${s}`], 0.004), onGlobe(at(P[`lidUp${s}`], { z: LID.up }), LID.y), onGlobe(P[`ex${s}`], 0.004), [0.005, 0.009, 0.005], [null, [`lid${s}`], null]);
    soft(`lowerLid${s}`, onGlobe(P[`en${s}`], 0.004), onGlobe(at(P[`lidLo${s}`], { z: -LID.lo }), LID.y), onGlobe(P[`ex${s}`], 0.004), [0.005, 0.008, 0.005], [null, [`lowLid${s}`], null]);
  }
  // the BROW PAD — the soft brow over the ridge (the eyebrow's bed): frontalis lifts it, the corrugator draws it
  // down and in. It rides on the bone and does not move the bone.
  soft('browPad', at(P.fzL, { y: -0.012 }), at(P.g, { y: -0.03, z: -0.004 }), at(P.fzR, { y: -0.012 }), [0.022, 0.02, 0.022], [['browL'], ['browC'], ['browR']]);
  // the SOFT features: no bone under them to stand off — the external nose and the lips are their own tissue
  // THE UPPER LIP'S BODY — orbicularis oris above the mouth, in front of the teeth: the philtrum's body under the nose
  // down to just above the cupid's bow, set behind the philtral columns so they stand proud of it, and a thin plate
  // each side from it out to just above the mouth's corner (following the corner when it moves), so the lip is one
  // plate from corner to corner between the cheeks' folds. Its top stops under the alar bar, so the nose sits ON the
  // lip. (One span from wing base to wing base rose over the subnasale and melted the nose's base into a bulb; two
  // cones run in to the bow made a narrow muzzle; thick sides from the wings to the corners read as ropes — the line
  // they marked is the cheek's fold, below; without a body the skin under the nose fell ~2 cm behind the subnasale.)
  // (its top sits back under the nose, so the nostrils' base stands off the lip in an angle; the lip slopes forward
  // from there to its peak at the vermilion. The plates start beside the philtrum's body, not inside it: two masses on
  // the same spot swell by the blend, and the white lip had peaked ahead of the vermilion, a snout)
  const philMid = { x: 0, y: (P.sn.y + P.ls.y) / 2 - 0.03, z: (P.sn.z + P.ls.z) / 2 - 0.006 };
  // (its fullness is `philtrumVolume`: the lower two beads' radii about their fixed centres, so a fuller philtrum stands
  // further forward, most toward the bow, where the columns are most prominent)
  const pv = R.philtrumVolume, pk = pv / 0.022;
  // a lip body that TAPERS: its centre bead at the midpoint of its ends, its radius between theirs — a round cone with
  // no waist and no hump, so the lip falls off evenly from the philtrum to the corner (a centre bead off the line, or
  // fuller than the line, stood a terrace on the lip that the light read as a lump)
  const taper = (name, a, b, ra, rb, drive) => v(name, a, mid(a, b), b, [ra, (ra + rb) / 2, rb], 'lipBody', drive);
  v('philtrumBody', { x: 0, y: P.sn.y - 0.024, z: P.sn.z - 0.016 }, philMid, { x: 0, y: P.ls.y - 0.024, z: P.ls.z + 0.012 }, [0.016, pv, 0.02 * pk], 'lipBody');
  // THE SILLS — under each wing the lip's top edge: from the philtrum's top, under the lobule, out to the wing's base
  // where the fold begins. Its top tucks under the nostril, so the wing sits ON the lip in a crease (without it the
  // lip's top fell 8 mm back under each wing, a slot you could see into from the side). Its outer end sinks into the
  // cheek under the wing's outer edge (ended outside the wing and level with the lip, it stood a round knob 7 mm proud
  // of the cheek beside each wing)
  for (const s of ['L', 'R']) {
    const al = P[`al${s}`], sg = Math.sign(al.x);
    taper(`sill${s}`, { x: sg * 0.006, y: P.sn.y - 0.026, z: P.sn.z - 0.016 }, { x: al.x, y: al.y - 0.07, z: al.z - 0.026 }, 0.013, 0.01);
  }
  for (const s of ['L', 'R']) {
    const sg = Math.sign(P[`ch${s}`].x), ch = P[`ch${s}`];
    taper(`upperLipPlate${s}`, { ...philMid, x: sg * 0.014, y: philMid.y - 0.004 }, { x: ch.x - sg * 0.022, y: ch.y - 0.022, z: ch.z + 0.012 }, 0.02, 0.011, [null, [`bow${s}`], [`corner${s}`]]);
  }
  // THE LOWER LIP'S BODY — orbicularis oris below the mouth, behind and below the lower vermilion: corner → under the
  // lip's fullest → the centre above the mentolabial fold, each side; it rides the jaw as the lower lip does, so the
  // lower lip is a box standing forward from the corners down to the fold
  const lowC = { x: 0, y: P.li.y - 0.034, z: P.li.z - 0.008 };
  for (const s of ['L', 'R']) {
    const sg = Math.sign(P[`ch${s}`].x), lm = P[`loMid${s}`];
    v(`lowerLipBody${s}`, at(P[`ch${s}`], { x: -sg * 0.012, y: -0.028, z: -0.01 }), { x: lm.x, y: lm.y - 0.026, z: lm.z - 0.012 }, lowC, [0.01, 0.015, 0.018], 'lipBody', [[`corner${s}`], [`loMid${s}`], ['lipStretch']]);
  }
  // THE NOSE — nasion → rhinion → tip
  v('nose', at(P.n, { y: -0.02 }), at(P.rhinion, { y: -0.018 }), at(P.prn, { y: -0.03 }), [0.018, 0.02, 0.03], 'nose');
  // THE NOSTRILS — one vajra each, placed from the nose's bottom (`nostrilRise`, `nostrilSet` put the alare over the
  // subnasale): the wing's base where it inserts into the lip → the alar lobule (its outer side IS the alare) → the
  // soft triangle beside the tip. Mirrored, with the columella between them; the space between a lobule and the
  // columella, roofed by the tip and the walls, is the nostril's opening seen from below.
  const lobule = {}, soft3 = {};
  for (const s of ['L', 'R']) {
    const al = P[`al${s}`], sg = Math.sign(al.x);
    lobule[s] = at(al, { x: -sg * 0.018, y: -0.006 });
    soft3[s] = { x: sg * 0.024, y: P.prn.y - 0.036, z: P.prn.z - 0.008 };
    v(`nostril${s}`, at(al, { x: -sg * 0.008, y: -0.03, z: -0.006 }), lobule[s], soft3[s], [0.012, 0.018, 0.012], 'nose');
  }
  // THE ALAR BAR — lobule → under the subnasale → lobule: the nose's base, joining the nostrils. Its ends are the
  // lobules (the same bead and radius), so the wing's outer side stays the alare (ended at the alare itself, the bar
  // stood 5 mm outside each wing)
  v('alae', lobule.L, at(P.sn, { y: -0.02, z: 0.005 }), lobule.R, [0.018, 0.018, 0.018], 'nose');
  // THE SEPTUM — the nose's midline wall, from the columella's base up behind the bridge, inside the nose: it fills the
  // air the walls and the ridge close round (a pocket there showed in the profile, and opened to a line seen through
  // from the side as the cheek moved)
  v('septum', at(P.sn, { y: -0.004, z: 0.012 }), at(mid(P.sn, P.rhinion, 0.5), { y: -0.02 }), at(P.rhinion, { y: -0.03 }), [0.01, 0.012, 0.01], 'nose');
  // THE COLUMELLA — the strip under the tip from the subnasale to the tip's underside, so the nose is closed beneath
  // (without it the air under the tip showed through from the side)
  v('columella', at(P.sn, { y: -0.004, z: 0.006 }), at(mid(P.sn, P.prn, 0.55), { y: -0.012, z: -0.008 }), at(P.prn, { y: -0.032, z: -0.012 }), [0.01, 0.011, 0.014], 'nose');
  // THE SIDEWALLS — from each wing up to the mid-bridge: angled cones, wide at the flare and narrowing as they rise,
  // so the nose is a pyramid (a ridge with two walls) and the wings read as wings where the walls meet them
  // (rooted in the lobule, a little above its centre and thinner than it, so the lobule is the wing's widest)
  const wallMid = {};
  for (const s of ['L', 'R']) {
    wallMid[s] = at(mid(P[`al${s}`], P.rhinion, 0.5), { x: -Math.sign(P[`al${s}`].x) * 0.016, y: -0.022 });
    v(`noseWall${s}`, at(lobule[s], { y: -0.004, z: 0.008 }), wallMid[s], at(P.rhinion, { y: -0.022 }), [0.015, 0.014, 0.012], 'nose');
  }
  // THE NOSE'S FLESH — one cone down the middle, narrow at the bridge and widening to the base over the wings: the
  // soft tissue over the cartilages, closing the grooves beside the ridge and the windows between each wing, its wall
  // and the tip. Its radius at the base is `noseFat` (thin and pinched to full and fleshy); the base sits on the
  // lobules' tops (it roofs the nostrils, never fills them) and behind the tip by its own radius, so a fatter nose is
  // wider and fuller but no longer: the tip's projection stays its own relation, and al-al the wings'
  const fat = R.noseFat, wingTop = Math.max(lobule.L.z, lobule.R.z) + 0.018;
  const base = { x: 0, y: P.prn.y - 0.009 - fat, z: wingTop + 0.6 * fat };
  v('noseFlesh', at(mid(P.n, P.rhinion, 0.5), { y: -0.024 }), mid(at(P.rhinion, { y: -0.012 }), base, 0.5), base, [0.012, 0.6 * fat, fat], 'nose');
  // and across it, low and forward beside the tip where the cone (set back by its radius) does not reach: a cone from
  // the window in one side (the triangle between the wing, its wall and the tip) to the other's, its ends at each
  // triangle's centre, its radius the same flesh
  const pane = (s) => ({ x: (lobule[s].x + wallMid[s].x + soft3[s].x) / 3, y: (lobule[s].y + wallMid[s].y + soft3[s].y) / 3, z: (lobule[s].z + wallMid[s].z + soft3[s].z) / 3 });
  const paneL = pane('L'), paneR = pane('R'), rf = 0.63 * fat;
  v('noseSides', paneL, { x: 0, y: (paneL.y + P.prn.y) / 2 - 0.02, z: paneL.z }, paneR, [rf, rf, rf], 'nose');
  // THE LIPS — corner → the lip's centre → corner, upper and lower
  // (each lip is two vajras, corner → its lateral bead → the centre: the upper through the cupid's bow peak to the
  // tubercle, the lower through its fullest to its centre; the centre beads are shared, so the halves meet there)
  const upC = at(P.ls, { y: -0.024, z: -0.002 }), loC = at(P.li, { y: -0.028 }), F = R.lipFullness;
  for (const s of ['L', 'R']) {
    v(`upperLip${s}`, at(P[`ch${s}`], { y: -0.014 }), at(P[`bow${s}`], { y: -0.016, z: -0.008 }), upC, [0.006, 0.016 * F, 0.022 * F], 'lips', [[`corner${s}`], [`bow${s}`], null]);
    v(`lowerLip${s}`, at(P[`ch${s}`], { y: -0.014, z: -0.002 }), at(P[`loMid${s}`], { y: -0.02 }), loC, [0.006, 0.02 * F, 0.026 * F], 'lips', [[`corner${s}`], [`loMid${s}`], ['lipStretch']]);
    // the philtral columns: two ridges from the nose's base down to the bow's peaks
    v(`philtrum${s}`, at(P.sn, { x: (s === 'L' ? -1 : 1) * 0.012, y: -0.006, z: -0.012 }), at(mid(P.sn, P[`bow${s}`]), { x: (s === 'L' ? -1 : 1) * 0.004, y: -0.006 }), at(P[`bow${s}`], { y: -0.008 }), [0.005, 0.005 * pk, 0.006 * pk], 'lips', [null, null, [`bow${s}`]]);
  }
  // THE CARVES — grooves cut from the skin at the end (`carve`), riding what they part: the lip line between the
  // lips (the corners and half the jaw) and the mentolabial sulcus over the chin. (The philtrum is its columns alone:
  // a carved groove between them read as a line, and cut through the lip under the nose.)
  const cut = (name, a, c, b, r, drive, blend) => V.push({ name, a, c, b, r, group: 'carve', ...(drive ? { drive } : {}), ...(blend ? { blend } : {}) });
  // the ALAR CREASES — round the back and the bottom of each wing, where it meets the cheek and the lip: the wing stands
  // off the face in a groove (the summed wave fills between near masses; it never parts them). It runs behind the
  // wing's root (the nostril's first bead), its edge blended over ~1.5 mm: cut across the wing in front of the root, it
  // left the root standing outside the groove as a curled flap
  for (const s of ['L', 'R']) {
    const sg = Math.sign(P[`al${s}`].x), lb = lobule[s];
    cut(`alarCrease${s}`, at(lb, { x: sg * 0.022, y: -0.018, z: 0.012 }), at(lb, { x: sg * 0.016, y: -0.028, z: -0.004 }), at(lb, { x: sg * 0.004, y: -0.034, z: -0.018 }), [0.003, 0.004, 0.003], null, 0.006);
  }
  // (the line parts the lips as far forward as their fullness carries them, and as deep)
  cut('lipLine', at(P.chL, { y: 0.002 }), { ...P.sto, y: P.ls.y - 0.001 + (F - 1) * 0.022 }, at(P.chR, { y: 0.002 }), [0.003, 0.005 * F, 0.003], [['cornerL'], ['jawHalf'], ['cornerR']]);
  // the mentolabial fold: a soft hollow curving with the lower lip (each side its end under the lip's fullest, a bead
  // out from the centre, the centre lowest: a shallow U). A broad tube set forward, so only a shallow sliver of it cuts,
  // its edge blended over ~3 mm, its ends thinning away into the face (a thin tube cut as sharp as the lip line read as
  // a chevron scored into the skin)
  const mlC = { x: 0, y: P.pg.y + 0.008, z: (P.li.z + P.pg.z) / 2 + 0.006 };
  for (const s of ['L', 'R']) {
    const sg = Math.sign(P[`loMid${s}`].x), end = at(P[`loMid${s}`], { x: sg * 0.026, y: -0.036, z: -0.032 });
    const FO = ['foldOpen'];
    cut(`mentolabial${s}`, end, { x: sg * 0.03, y: (end.y + mlC.y) / 2 + 0.004, z: mlC.z + 0.25 * (end.z - mlC.z) }, mlC, [0.005, 0.014, 0.019], [FO, FO, FO], 0.014);
  }
  // THE TEETH — the upper dental arch, anchored at the incisal point: each side seven crowns on a curved arch (the
  // central and lateral incisors, the canine, two premolars, two molars: `DENTITION`, placed out from the midline and
  // back from the incisors' faces, the arch narrowing into its curve at the front and running nearly straight back
  // along the molars; `archWidth` scales it). Each crown is its own vajra, upright: the cervix at the gum → the crown →
  // the edge or the cusps on the occlusal plane (from the incisal point back to the molars, rising a little: the curve
  // of Spee); the incisors lean their edges forward and thin to them. The lower arch is the upper's MIRROR across that
  // plane, a touch narrower so it sits inside the upper and `overjet` behind it, riding the jaw. They join the skin after
  // the mouth is carved, so they show only as the lips part.
  const inc = P.inc, occ = (y) => inc.z + ((inc.y - y) * 0.01) / 0.18, labial = inc.y + 0.006, mmv = (v) => v * MM_V;
  const lower = (q) => ({ x: q.x * 0.94, y: q.y - R.overjet, z: 2 * occ(q.y) - q.z });
  for (const s of ['L', 'R']) {
    const sg = Math.sign(P[`ch${s}`].x);
    for (const [name, t] of Object.entries(DENTITION)) {
      const r = mmv(t.r), yc = labial - mmv(t.d) - r, x = sg * mmv(t.x) * R.archWidth, lean = mmv(t.lean), z0 = occ(yc);
      const rr = [0.8 * r, r, t.edge * r];
      const up = [{ x, y: yc - lean, z: z0 + mmv(t.h) - rr[0] }, { x, y: yc, z: z0 + mmv(t.h) * 0.5 }, { x, y: yc + lean, z: z0 + rr[2] }];
      V.push({ name: `upper${name}${s}`, a: up[0], c: up[1], b: up[2], r: rr, group: 'teeth' });
      const lo = up.map(lower);
      V.push({ name: `lower${name}${s}`, a: lo[0], c: lo[1], b: lo[2], r: rr, group: 'teeth', drive: [J, J, J] });
    }
  }
  // THE PALATE — the roof of the mouth: a midline mass from behind the upper incisors back toward the pharynx, above the
  // upper teeth (smooth-joined, so it swells no skin). The open mouth's cavity carves its underside; without it the
  // carve opened into a hollow on the midline behind the alveolar arch, a slot in the back wall that read as a ridge
  v('palate', { x: 0, y: inc.y - 0.03, z: inc.z + 0.035 }, { x: 0, y: inc.y - 0.12, z: inc.z + 0.04 }, { x: 0, y: inc.y - 0.22, z: inc.z + 0.045 }, [0.035, 0.05, 0.05], 'lipBody');
  // THE TONGUE — on the floor of the mouth inside the lower arch, riding the jaw, its own mass apart from the teeth: two
  // halves (blended into one tongue) from just behind the lower incisors back between the molars, each station placed
  // from the lower crowns themselves — the tip a gap behind the incisors' inner faces, each half's side a gap inside the
  // premolars' and the first molar's — its dorsum a hair under the lower teeth's edges at the front, level at the back.
  // (Wider, and blended with the crowns, it merged with them into one mass.)
  const occL = (y) => occ(y + R.overjet), GAP = mmv(1.5);
  const lowerTooth = (t) => { const r = mmv(DENTITION[t].r); return { x: mmv(DENTITION[t].x) * R.archWidth * 0.94, y: labial - mmv(DENTITION[t].d) - r - R.overjet, r }; };
  const ct = lowerTooth('Central'), pm = lowerTooth('Premolar1'), m1 = lowerTooth('Molar1');
  const tongue = [
    { y: ct.y - ct.r - GAP - 0.012, half: 0.006, r: 0.012, top: -0.004 },
    { y: pm.y, half: Math.max(0, pm.x - pm.r - GAP - 0.022), r: 0.022, top: 0 },
    { y: m1.y, half: Math.max(0, m1.x - m1.r - GAP - 0.03), r: 0.03, top: 0.003 },
  ];
  for (const s of ['L', 'R']) {
    const sg = Math.sign(P[`ch${s}`].x), [a, c, b] = tongue.map((t) => ({ x: sg * t.half, y: t.y, z: occL(t.y) + t.top - t.r }));
    V.push({ name: `tongue${s}`, a, c, b, r: tongue.map((t) => t.r), group: 'tongue', drive: [J, J, J] });
  }
  return V;
}

/**
 * THE ACTIONS — the face's action relationships. Each is one activation (0 … 1) that drives named beads of the vajra
 * graph: a hinge, a muscle pulling its insertion toward its origin, a pad lifted. Their displacements are SUMMED on
 * each bead (the jaw's rotation first, then every translation added), so actions compose: a smile on an open jaw is
 * the jaw's corner and the smile's pull together. The skin is still the summed wave over the moved beads, so it
 * follows by construction. A side may be driven alone (`smileL`), or both by the bare name.
 */
export const ACTIONS = Object.freeze({
  jaw: 'the mandible rotates about the condyles, then glides forward and down the eminence as it opens wide; at 1 the incisors are `jawOpen` apart; the lips part and the mouth opens',
  smile: 'zygomaticus major: the mouth corners drawn up and back toward the cheekbones; the cheek balloons, shortened, bulge (both sides)',
  smileL: 'the smile, the figure\'s left side only', smileR: 'the smile, the figure\'s right side only',
  browRaise: 'frontalis: the brows lifted', browLower: 'the corrugator: the brows drawn down and together',
  blink: 'the upper lids close over the globes (both)', blinkL: 'the left lid only', blinkR: 'the right lid only',
});
export const ACTION_NAMES = Object.freeze(Object.keys(ACTIONS));

/** THE JAW'S JOINT: the articular eminence's slope (the condyle glides forward and down it), the glide's onset (the
 * jaw opens by rotation alone at first; the condyle leaves its socket as the mouth opens wide), and the hinge's stop */
const JOINT = Object.freeze({ eminenceDeg: 35, glideFrom: 0.3, maxDeg: 35 });
const rotX = (p, o, deg) => {
  if (!deg) return p;
  const th = (deg * Math.PI) / 180, c = SM.cos(th), s = SM.sin(th), y = p.y - o.y, z = p.z - o.z;
  return { x: p.x, y: o.y + y * c + z * s, z: o.z - y * s + z * c };
};

/**
 * The jaw's pose at an activation (0 … 1), over the (tuned) points: { deg, glide, hinge, at(t) } — the hinge's angle,
 * the condyle's glide (V, along the eminence), and the transform of a bead that follows the mandible by a share t.
 * The angle at full is SOLVED so the lower incisors' edge (behind the stomion) has moved `jawOpen` from the upper's:
 * the limit is a distance, and the angle is whatever the joint needs to reach it with its glide.
 */
export function jawPose(P, rel = RELATIONS, act = 1) {
  const R = { ...RELATIONS, ...rel };
  const a = Math.max(0, Math.min(1, Number(act) || 0));
  const hinge = { x: 0, y: (P.condyleL.y + P.condyleR.y) / 2, z: (P.condyleL.z + P.condyleR.z) / 2 };
  const e = (JOINT.eminenceDeg * Math.PI) / 180, dir = { x: 0, y: SM.cos(e), z: -SM.sin(e) };
  const glideAt = (x) => { const u = Math.max(0, Math.min(1, (x - JOINT.glideFrom) / (1 - JOINT.glideFrom))); return R.condyleGlide * u * u * (3 - 2 * u); };
  const move = (deg, g) => (p) => { const q = rotX(p, hinge, deg); return { x: q.x, y: q.y + dir.y * g, z: q.z + dir.z * g }; };
  const incisor = P.inc;
  const openAt = (deg) => { const q = move(deg, glideAt(1))(incisor); return Math.hypot(q.y - incisor.y, q.z - incisor.z); };
  let lo = 0, hi = JOINT.maxDeg;
  if (openAt(hi) > R.jawOpen) for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (openAt(m) < R.jawOpen) lo = m; else hi = m; }
  const full = (lo + hi) / 2, deg = full * a, glide = glideAt(a);
  const q = move(deg, glide)(incisor);
  return { deg, glide, fullDeg: full, opening: Math.hypot(q.y - incisor.y, q.z - incisor.z), hinge, at: (t) => move(t * deg, t * glide) };
}

/**
 * The drivers' transforms for a set of activations, over the (tuned) points `P`: { driver: (point) => point }. Every
 * driver is the rest bead's displacement, rotation first, translations summed.
 */
export function actionDrivers(P, acts = {}, rel = RELATIONS) {
  const a = (k) => Math.max(0, Math.min(1, Number(acts[k]) || 0));
  const side = (k, s) => Math.max(0, Math.min(1, a(k) + a(`${k}${s}`)));
  const add = (p, d, t = 1) => ({ x: p.x + d.x * t, y: p.y + d.y * t, z: p.z + d.z * t });
  // THE HINGE: the axis through the condyles; opening rotates the chin down and back, and past the first third the
  // condyle glides forward and down the eminence (`jawPose`: the angle is solved so full opens to `jawOpen`)
  const pose = jawPose(P, rel, a('jaw'));
  const jawAt = (t) => pose.at(t);
  const D = { jaw: jawAt(1), jawHalf: jawAt(0.5) };
  // the mentolabial fold flattens as the jaw opens (the lower lip stretched down over the chin): its carve rides the
  // jaw and lifts out of the skin, forward and a little down, so less of it cuts
  D.foldOpen = (p) => add(jawAt(1)(p), { x: 0, y: 0.92, z: -0.39 }, 0.05 * a('jaw'));
  // and the lower lip stretches down over the lower incisors and flattens against them: its centre rides the jaw and
  // settles back (its fullest beads, `loMid`, by less), so it does not roll out over the chin as the mouth opens
  D.lipStretch = (p) => add(jawAt(1)(p), { x: 0, y: -1, z: 0 }, 0.025 * a('jaw'));
  for (const s of ['L', 'R']) {
    const sm = side('smile', s), ch = P[`ch${s}`], o = P[`zy${s}`];
    // the smile's pull: from the corner toward the muscle's origin, 10 mm at full
    const pull = (() => { const d = { x: o.x - ch.x, y: o.y - ch.y, z: o.z - ch.z }, l = Math.hypot(d.x, d.y, d.z) || 1; return { x: d.x / l, y: d.y / l, z: d.z / l }; })();
    D[`corner${s}`] = (p) => add(jawAt(0.45)(p), pull, 0.045 * sm);
    D[`bow${s}`] = (p) => add(jawAt(0.1)(p), pull, 0.02 * sm);
    D[`loMid${s}`] = (p) => add(add(jawAt(0.75)(p), pull, 0.02 * sm), { x: 0, y: -1, z: 0 }, 0.02 * a('jaw'));
    D[`zyg${s}`] = (p) => add(p, pull, 0.02 * sm);
    // the balloon's bulge: pushed by the corner into the cheekbone, it bunches UP and FORWARD (not along the pull,
    // which runs back toward the bone); a little of the jaw; its swell is its own volume
    D[`bulge${s}`] = (p) => add(jawAt(0.25)(p), { x: 0, y: 0.6, z: 0.8 }, 0.022 * sm);
    // the brow: raised straight up; lowered down, forward a touch, and toward the midline
    const sg = Math.sign(P[`fz${s}`].x);
    D[`brow${s}`] = (p) => add(add(p, { x: 0, y: 0, z: 0.03 }, a('browRaise')), { x: -sg * 0.012, y: 0.004, z: -0.02 }, a('browLower'));
    // the lids: the upper comes down over the globe to the lower (a blink closes the opening — the carve reads the
    // lid back) and lifts a little with the brow; the lower rises with the cheek (a real smile narrows the eye)
    const shut = P[`lidUp${s}`].z - P[`lidLo${s}`].z + LID.up;
    D[`lid${s}`] = (p) => add(add(p, { x: 0, y: 0.006, z: -shut }, side('blink', s)), { x: 0, y: 0, z: 0.005 }, a('browRaise') * (1 - side('blink', s)));
    D[`lowLid${s}`] = (p) => add(p, { x: 0, y: 0.002, z: 0.01 }, sm);
  }
  D.browC = (p) => add(add(p, { x: 0, y: 0, z: 0.022 }, a('browRaise')), { x: 0, y: 0.006, z: -0.016 }, a('browLower'));
  return D;
}

/**
 * The vajras moved by the actions: each driven bead through its drivers in order. A `balloon` keeps its volume: its
 * radii scale by √(rest length / length) (a tube's volume goes as r²L), clamped to a plausible swell.
 */
export function applyActions(vajras, P, acts, rel = RELATIONS) {
  if (!acts || !Object.values(acts).some((v) => Number(v))) return vajras;
  const D = actionDrivers(P, acts, rel);
  return vajras.map((w) => {
    if (!w.drive) return w;
    const beads = [w.a, w.c, w.b].map((q, i) => (w.drive[i] || []).reduce((p, k) => (D[k] ? D[k](p) : p), q));
    const len = (a, c, b) => Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z) + Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z);
    const k = w.balloon ? Math.max(0.75, Math.min(1.6, Math.sqrt(len(w.a, w.c, w.b) / len(beads[0], beads[1], beads[2])))) : 1;
    return { ...w, a: beads[0], c: beads[1], b: beads[2], r: w.r.map((r) => r * k) };
  });
}

/** the globe (V): 24 mm across, its sclera's front 2.5 mm behind the eye point, the cornea proud of it to the point */
const GLOBE = Object.freeze({ r: 0.052, back: 0.063, cornea: 0.034 });
/** the lid margins' rolls (V): how far above / below the opening's apexes they lie, and how proud of the globe */
const LID = Object.freeze({ up: 0.006, lo: 0.004, y: 0.006 });

/** the blend width per group, in V (the bone melts broadly; the nose and the lips keep their lobes) */
const BLEND = { bone: 0.04, soft: 0.03, nose: 0.012, lipBody: 0.05, lips: 0.01, teeth: 0.0006, tongue: 0.012 };
/** how each soft feature joins the skin */
const JOIN = { soft: 0.04, nose: 0.02, lipBody: 0.016, lips: 0.012 };
/** the head's layers: the skull alone, or the skin over it */
export const HEAD_LAYERS = Object.freeze(['skin', 'skull']);

/**
 * The relational head: { field, landmarks, bounds, points, vajras, targets } in STAND units, the same shape
 * `head-field-view.js` reads (`headFieldOf`). `sex` picks the pole; `relations` replaces ratios over it; `layer` is
 * `skin` (the default) or `skull`. `targets` are the relations' own measurements, in mm, for the calipers to meet.
 * `tune` places the wave's internal points: `true` solves them (`solveTune`, cached), an object gives them.
 * `actions` are the activations of the face's action relationships (`ACTIONS`), applied over the tuned rest.
 */
export function relationalHead({ sex = 'male', relations = {}, layer = 'skin', tune = null, actions = null } = {}) {
  const rel = { ...RELATIONS, ...RELATION_POLES[sex], ...relations };
  const P = corePoints(rel);
  // `tune: true` solves (once per sex + relations, then cached); an object is a tune given; absent, none
  let tuning = null;
  if (tune === true) {
    const key = JSON.stringify([sex, relations]);
    if (!TUNE_CACHE.has(key)) TUNE_CACHE.set(key, solveTune({ sex, relations }));
    tuning = TUNE_CACHE.get(key);
  } else if (tune) tuning = { tune };
  const Pt = tunedPoints(P, tuning?.tune);
  const rest = coreVajras(Pt, rel);
  const vajras = applyActions(rest, Pt, actions, rel);
  const byName = (list) => Object.fromEntries(list.map((w) => [w.name, w]));
  const Vn = byName(vajras), Rn = byName(rest);
  // THE MOUTH — as the jaw opens the lips part, and the summed wave would bridge them: a cavity carved between the
  // upper lip's centre and the lower's (as moved), corner to corner, its depth how far they have parted from rest. A
  // chain like the lips' (corner → a bead 0.6 of the way out → the centre), so the opening is an oval that rounds into
  // its corners, not a diamond of two straight cones
  const gapOf = (n) => Math.hypot(n.upperLipL.b.y - n.lowerLipL.b.y, n.upperLipL.b.z - n.lowerLipL.b.z);
  const gap = gapOf(Vn) - gapOf(Rn);
  const mouth = gap > 0.004 ? (() => {
    const upC = Vn.upperLipL.b, loC = Vn.lowerLipL.b;
    const c = { x: 0, y: (upC.y + loC.y) / 2 - 0.012, z: (upC.z + loC.z) / 2 };
    const inC = (q) => ({ x: q.x * 0.88, y: q.y - 0.01, z: (q.z + c.z) / 2 });
    const rc = Math.min(0.5 * gap + 0.004, 0.06);
    const out = (q) => ({ x: 0.6 * q.x, y: c.y + 0.6 * (q.y - c.y), z: c.z + 0.6 * (q.z - c.z) });
    const L = inC(Vn.upperLipL.a), Rr = inC(Vn.upperLipR.a);
    // THE ORAL CAVITY behind the lips: each side a chain from between them along the arch, through the central and
    // lateral incisors, the canine and the first premolar; at each tooth it sits between the upper crown's edge and the
    // lower's (as the jaw has moved them) and reaches both, so the teeth, joined after it, line its top and its bottom
    // as a row seen through the opening. It narrows toward the back, inside the cheeks. (A lens between the lips alone
    // left the teeth buried in the lip; a tube down the midline showed only the central pair.)
    // (`half` +1 / -1: the station as two beads half its radius, up and down the line between the edges, reaching the
    // same crowns: one round bead reaches as far across that line as along it, and tilted forward-down by an open jaw
    // it broke through the skin below the lower lip's ends)
    const station = (tooth, s, k, cap = Infinity, half = 0) => {
      const u = Vn[`upper${tooth}${s}`], l = Vn[`lower${tooth}${s}`];
      const ue = { x: u.b.x, y: u.b.y, z: u.b.z - u.r[2] }, le = { x: l.b.x, y: l.b.y, z: l.b.z + l.r[2] };
      const r = Math.max(0.004, Math.min(cap, k * (0.5 * Math.hypot(ue.y - le.y, ue.z - le.z) + 0.003)));
      const q = { x: (ue.x + le.x) / 2, y: (ue.y + le.y) / 2 - 0.004, z: (ue.z + le.z) / 2 };
      if (!half) return [q, r];
      const n = Math.hypot(ue.y - le.y, ue.z - le.z) || 1, o = (half * r) / 2;
      return [{ ...q, y: q.y + (o * (ue.y - le.y)) / n, z: q.z + (o * (ue.z - le.z)) / n }, r / 2];
    };
    // (both sides pass through a shared midline station between the central incisors: chains parting from the lips
    // straight to each side's incisor left a tent of tissue standing between them)
    const [cl, rl] = station('Central', 'L', 1), [cr] = station('Central', 'R', 1), midSt = { x: 0, y: (cl.y + cr.y) / 2, z: (cl.z + cr.z) / 2 };
    const oral = ['L', 'R'].flatMap((s) => [1, -1].map((half) => {
      // (the side stations are capped: tall at full opening, they reached the side of the lower face and opened it)
      const [ct, cr0] = station('Central', s, 1);
      const st = [['Lateral', 1, 0.05], ['Canine', 0.9, 0.042], ['Premolar1', 0.7, 0.036]].map(([t, k, cap]) => station(t, s, k, cap, half));
      return { beads: [c, midSt, ct, ...st.map(([q]) => q)], r: [rc, rl, cr0, ...st.map(([, r]) => r)] };
    }));
    // and down the middle, back to between the premolars: the side chains diverge along the arch, and a pillar of tissue
    // stood between them from the palate to the floor
    const [pl, pr] = ['L', 'R'].map((s) => station('Premolar1', s, 0.7, 0.036)), back = { x: 0, y: (pl[0].y + pr[0].y) / 2, z: (pl[0].z + pr[0].z) / 2 };
    // (the back station rounded to between the incisors' radius and the premolars', capped: tapered to the premolars' it
    // left a tall narrow slot in the back wall that read as a ridge down the middle of the mouth)
    const rBack = Math.min(0.05, (rl + pl[1]) / 2);
    oral.push({ beads: [c, midSt, back], r: [rc, rl, rBack] }, { beads: [pl[0], back, pr[0]], r: [pl[1], rBack, pr[1]] });
    return { beads: [L, out(L), c, out(Rr), Rr], r: [0.004, 0.75 * rc, rc, 0.75 * rc, 0.004], oral };
  })() : null;
  // THE EYES' OPENINGS — an almond in the face's plane, the intersection of two discs: the upper lid's arc (a circle
  // through the canthi and the upper lid's apex, as moved) and the lower's. Read back from the lid rolls, so a blink
  // that brings the upper lid down to the lower closes it. Carved through the skin in front of the globe's centre.
  const circle3 = (a, b, c) => {   // the circle through three (x, z) points: [cx, cz, r], or null when they are in line
    const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
    if (Math.abs(d) < 1e-9) return null;
    const A = a.x * a.x + a.z * a.z, B = b.x * b.x + b.z * b.z, C = c.x * c.x + c.z * c.z;
    const cx = (A * (b.z - c.z) + B * (c.z - a.z) + C * (a.z - b.z)) / d, cz = (A * (c.x - b.x) + B * (a.x - c.x) + C * (b.x - a.x)) / d;
    return [cx, cz, Math.hypot(a.x - cx, a.z - cz)];
  };
  const openings = ['L', 'R'].map((s) => {
    const en = Pt[`en${s}`], ex = Pt[`ex${s}`];
    const up = { ...Vn[`upperLid${s}`].c, z: Vn[`upperLid${s}`].c.z - LID.up }, lo = { ...Vn[`lowerLid${s}`].c, z: Vn[`lowerLid${s}`].c.z + LID.lo };
    const chordZ = (q) => en.z + ((q.x - en.x) / (ex.x - en.x)) * (ex.z - en.z);
    if (up.z - lo.z < 0.004 || up.z - chordZ(up) < 0.002 || chordZ(lo) - lo.z < 0.002) return null;   // shut
    const U = circle3(en, up, ex), L = circle3(en, lo, ex);
    return U && L ? { U, L, gy: Pt[`eye${s}`].y - GLOBE.back, x0: Math.min(en.x, ex.x) - 0.01, x1: Math.max(en.x, ex.x) + 0.01 } : null;
  });
  const sc = HEAD_V;
  const S = (p) => ({ x: p.x * sc, y: p.y * sc, z: p.z * sc });
  // the tissue depth at p: inverse-square weights over the markers, softened so it varies slowly between them
  const depthOf = (markers, eps2) => (p) => {
    let sw = 0, st = 0;
    for (const m of markers) { const w = 1 / ((p.x - m.p.x) ** 2 + (p.y - m.p.y) ** 2 + (p.z - m.p.z) ** 2 + eps2); sw += w; st += w * m.t; }
    return st / sw;
  };
  // the tissue over the mandible rides it: the jaw's markers move with the jaw (the chin's, the angle's fully, the
  // masseter's and the buccal's, half on the ramus, by half), so the skin over a swung chin keeps the chin's tissue
  // (left at rest, the chin's bone landed where the map read thinner tissue, and a pocket opened under the lip)
  const jawMarkers = actions?.jaw ? jawPose(Pt, rel, actions.jaw) : null;
  const markersV = tissueMarkers(P).map((m) => (jawMarkers && JAW_TISSUE[m.k] ? { ...m, p: jawMarkers.at(JAW_TISSUE[m.k])(m.p) } : m)), depthV = depthOf(markersV, 0.04 ** 2);
  // A skin-authored bead's bone is its radius less the tissue at its centre. Where the tissue is thicker than the
  // mass (the jaw's corner under the masseter, the arch), the bone keeps a floor radius and its centre steps INWARD
  // by the shortfall, so the skin still lands where the bead's surface was: sideways for a lateral bead (the widths
  // are what its relations name), toward the head's centre for the rest and for a vajra that faces forward (`stepIn`).
  const RMIN = 0.012, C = { x: 0, y: (P.g.y + P.op.y) / 2, z: 0.45 };
  const boneBead = (q, r, stepIn = false) => {
    const t = depthV(q);
    if (r - t >= RMIN) return [q, r - t];
    const d = !stepIn && Math.abs(q.x) > 0.08 ? { x: Math.sign(q.x), y: 0, z: 0 } : (() => { const v = { x: q.x - C.x, y: q.y - C.y, z: q.z - C.z }, l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; })();
    const k = t + RMIN - r;
    return [{ x: q.x - d.x * k, y: q.y - d.y * k, z: q.z - d.z * k }, RMIN];
  };
  const bonds = vajras.map((w) => {
    const beads = w.skin ? [w.a, w.c, w.b].map((q, i) => boneBead(q, w.r[i], w.stepIn)) : [[w.a, w.r[0]], [w.c, w.r[1]], [w.b, w.r[2]]];
    const [a, c, b] = beads.map(([q]) => S(q)), [ra, rc, rb] = beads.map(([, r]) => r * sc);
    return { group: w.group, blend: w.blend, f: (p) => SM.min(sdRoundCone(p, a, c, ra, rc), sdRoundCone(p, c, b, rc, rb)), lo: { x: Math.min(a.x, c.x, b.x) - Math.max(ra, rc, rb), y: Math.min(a.y, c.y, b.y) - Math.max(ra, rc, rb), z: Math.min(a.z, c.z, b.z) - Math.max(ra, rc, rb) }, hi: { x: Math.max(a.x, c.x, b.x) + Math.max(ra, rc, rb), y: Math.max(a.y, c.y, b.y) + Math.max(ra, rc, rb), z: Math.max(a.z, c.z, b.z) + Math.max(ra, rc, rb) } };
  });
  // the teeth are many small crowns: a box about them all, so the field skips them away from the mouth
  const teethBonds = bonds.filter((b) => b.group === 'teeth' || b.group === 'tongue'), tm = 0.02 * sc;
  const teethBox = teethBonds.length ? { lo: { x: Math.min(...teethBonds.map((b) => b.lo.x)) - tm, y: Math.min(...teethBonds.map((b) => b.lo.y)) - tm, z: Math.min(...teethBonds.map((b) => b.lo.z)) - tm }, hi: { x: Math.max(...teethBonds.map((b) => b.hi.x)) + tm, y: Math.max(...teethBonds.map((b) => b.hi.y)) + tm, z: Math.max(...teethBonds.map((b) => b.hi.z)) + tm } } : null;
  const orbits = ['L', 'R'].map((s) => ({ c: S({ ...P[`eye${s}`], y: P[`eye${s}`].y - 0.01 }), r: 0.075 * sc }));
  // the globe and its cornea: the sclera's sphere, and the cornea's smaller sphere proud of it to the eye point
  const globes = ['L', 'R'].map((s) => {
    const e = Pt[`eye${s}`];
    return { c: S({ ...e, y: e.y - GLOBE.back }), r: GLOBE.r * sc, cc: S({ ...e, y: e.y - GLOBE.cornea }), cr: GLOBE.cornea * sc };
  });
  const openingF = openings.map((o) => o && ((p) => {
    const x = p.x / sc, z = p.z / sc;
    const dU = Math.hypot(x - o.U[0], z - o.U[1]) - o.U[2], dL = Math.hypot(x - o.L[0], z - o.L[1]) - o.L[2];
    return Math.max(dU, dL, o.gy - p.y / sc, o.x0 - x, x - o.x1) * sc;   // inside both discs, in front of the globe's centre
  }));
  const carves = bonds.filter((b) => b.group === 'carve');
  // where the wavelength shortens: the mouth (about the stomion, the mouth's width) and each eye
  const featureFoci = [
    { c: S({ ...Pt.sto, y: Pt.sto.y - 0.02 }), s2: ((Pt.chR.x + 0.02) * sc) ** 2 },
    ...['L', 'R'].map((s) => ({ c: S(Pt[`eye${s}`]), s2: (0.07 * sc) ** 2 })),
  ];
  const depth = depthOf(markersV.map((m) => ({ p: S(m.p), t: m.t * sc })), (0.04 * sc) ** 2);
  const skin = layer !== 'skull';
  const kw = rel.skinWave * sc;
  const mouthF = mouth ? (() => {
    const chain = (ch) => { const q = ch.beads.map(S), r = ch.r.map((v) => v * sc); return (p) => { let d = Infinity; for (let i = 0; i < q.length - 1; i++) d = SM.min(d, sdRoundCone(p, q[i], q[i + 1], r[i], r[i + 1])); return d; }; };
    const lens = chain(mouth), oral = mouth.oral.map(chain);
    return (p) => { let d = lens(p); for (const o of oral) d = SM.min(d, o(p)); return d; };
  })() : null;
  const field = (p) => {
    if (!skin) {
      let d = Infinity;
      for (const b of bonds) if (b.group === 'bone') { const e = b.f(p); d = d === Infinity ? e : smin(d, e, BLEND.bone * sc); }
      for (const o of orbits) d = smax(d, -(SM.hypot(p.x - o.c.x, p.y - o.c.y, p.z - o.c.z) - o.r), 0.02 * sc);
      return d;
    }
    // THE SKIN WAVE: each bone vajra less the tissue at p, each soft mass as it is, summed as waves exp(−e/k)
    // (log-sum-exp about the nearest, so the sum never overflows)
    const t = depth(p), es = [], g = {};
    let lo = Infinity;
    const nearTeeth = teethBox && p.x >= teethBox.lo.x && p.x <= teethBox.hi.x && p.y >= teethBox.lo.y && p.y <= teethBox.hi.y && p.z >= teethBox.lo.z && p.z <= teethBox.hi.z;
    for (const b of bonds) {
      if (b.group === 'carve' || ((b.group === 'teeth' || b.group === 'tongue') && !nearTeeth)) continue;
      const e = b.f(p);
      if (b.group === 'bone' || b.group === 'soft') { const v = b.group === 'bone' ? e - t : e; es.push(v); if (v < lo) lo = v; }
      else g[b.group] = g[b.group] === undefined ? e : smin(g[b.group], e, BLEND[b.group] * sc);
    }
    // the wavelength at p: the skin's, shortened toward the features (Gaussian falloffs about the mouth and the eyes)
    let fall = 0;
    for (const f of featureFoci) { const q = ((p.x - f.c.x) ** 2 + (p.y - f.c.y) ** 2 + (p.z - f.c.z) ** 2) / f.s2; if (q < 9) fall = Math.max(fall, SM.exp(-q)); }
    const k = kw * (1 - (1 - rel.featureWave) * fall);
    let sum = 0;
    for (const v of es) sum += SM.exp(-(v - lo) / k);
    let d = lo - k * SM.log(sum);
    for (const k of ['nose', 'lipBody', 'lips']) if (g[k] !== undefined) d = smin(d, g[k], JOIN[k] * sc);
    // the grooves, the mouth, and the eyes' openings cut through to the globes, which sit in them
    for (const c of carves) d = smax(d, -c.f(p), (c.blend ?? 0.003) * sc);
    if (mouthF) d = smax(d, -mouthF(p), 0.006 * sc);
    for (const f of openingF) if (f) d = smax(d, -f(p), 0.0025 * sc);
    // the teeth and the tongue, seen only through the mouth: clipped to the carved cavity's neighbourhood, so another carve
    // (the mentolabial fold over the lower incisors' roots) never bares them; with the mouth closed they are not joined
    // (each crown joins the next with an all but hard edge, so the teeth read as teeth, not a band; the tongue is its own
    // mass beside them)
    if (mouthF) for (const k of ['teeth', 'tongue']) if (g[k] !== undefined) d = SM.min(d, smax(g[k], mouthF(p) - 0.002 * sc, 0.001 * sc));
    for (const o of globes) {
      const gd = smin(SM.hypot(p.x - o.c.x, p.y - o.c.y, p.z - o.c.z) - o.r, SM.hypot(p.x - o.cc.x, p.y - o.cc.y, p.z - o.cc.z) - o.cr, 0.006 * sc);
      d = smin(d, gd, 0.0015 * sc);
    }
    return d;
  };
  // the names head-field-view's calipers read (figure-head.js's landmark names), from the core points
  const s = 0.9 * (sc / 0.1265);
  const W = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, S(p)]));
  const landmarks = {
    ...W, H: sc, s,
    glabella: W.g, nasion: W.n, noseBridge: W.rhinion, subnasale: W.sn, noseTip: W.prn, stomion: W.sto, menton: W.me,
    zygionR: W.zyR, gonionR: W.goR, alaR: W.alR, tragionR: { ...W.porionR, y: W.porionR.y - 0.01 * sc },
    earTopR: { ...W.porionR, z: W.g.z }, eyeL: W.eyeL, eyeR: W.eyeR,
  };
  const pad = 0.06 * sc;
  const bounds = {
    min: { x: -(P.euR.x + 0.08) * sc, y: (P.op.y - 0.05) * sc, z: -0.1 * sc - pad },
    max: { x: (P.euR.x + 0.08) * sc, y: (P.prn.y + 0.06) * sc, z: 1 * sc + pad },
  };
  // the relations' own measurements (mm): what the skin's calipers should read
  const mm = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 230 * 10) / 10;
  const targets = skin ? {
    'g-op': mm(P.g, P.op), 'eu-eu': mm(P.euL, P.euR), 'zy-zy': mm(P.zyL, P.zyR), 'go-go': mm(P.goL, P.goR),
    'n-gn': mm(P.n, P.gn), 'n-sn': mm(P.n, P.sn), 'sn-prn': mm(P.sn, P.prn), 'al-al': mm(P.alL, P.alR), 'nasion depth': Math.round((P.g.y - P.n.y) * 2300) / 10,
  } : null;
  // the jaw as opened (when it is): the hinge's angle, the condyle's glide and the incisors' opening, in ° and mm
  const jp = actions?.jaw ? jawPose(Pt, rel, actions.jaw) : null;
  const jaw = jp ? { deg: Math.round(jp.deg * 10) / 10, glide: Math.round(jp.glide * 2300) / 10, opening: Math.round(jp.opening * 2300) / 10, limit: Math.round(rel.jawOpen * 2300) / 10 } : null;
  return { field, landmarks, bounds, points: W, vajras, relations: rel, targets, tuning, actions: actions || {}, jaw, mouth };
}
