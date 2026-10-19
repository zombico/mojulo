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
 *               cheek bar, arches, mandible, chin, brow, nose, alae, lips) are smooth-min'd: the structure keeps its
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
import { EAR_OUTLINE, EAR_HINGE } from './head-ear.js';
import { GLOBE, eyeRig, resolveEye, lookAngles, browBridge } from './head-relational-eye.js';
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
  // ── the eye and the mouth
  // the orbit's frame, in depth, against the cornea's apex: the eye hangs off the nasion, and the orbit's rims are
  // set behind the eye, not ahead of it (the globe shows in a profile and from ¾; a rim ahead of the cornea walls it in)
  radix: 0.048,         // the nasion ahead of the cornea / v-me (radix projection, ~11 mm; 9–14 by the clinic's canon)
  orbitRim: 0.065,      // the frontozygomatic (the brow's outer end, the lateral rim's top) behind the cornea / v-me
  malarDepth: 0.045,    // the cheekbone's front behind the cornea / v-me
  browProjection: 0.035, // the supraorbital arch's peak ahead of the cornea / v-me (the summed skin lands ~3 mm further)
  fissure: 0.045,       // the palpebral fissure's height / v-me (the eye's opening, ~10 mm)
  canthalTilt: 0.008,   // the lateral canthus above the medial / v-me
  upperVermilion: 0.035, // the upper lip's red height / v-me
  lowerVermilion: 0.043, // the lower lip's / v-me (the lower lip the fuller)
  chin: 0,              // pg ahead of the nasion vertical / v-me (− a receding chin)
  // ── the ear (its shape the operator's sketch, head-ear.js EAR_OUTLINE; its place and lean these relations)
  earTop: 0.5,          // the ear's top between the eye line (0) and the glabella (1): at the brow
  earBottom: 0,         // the lobule's bottom above the subnasale / v-me: level with the nose's base
  earWidth: 1,          // the ear's width over its outline's own
  earTilt: 0.65,        // the ear's long axis leans back by this share of the nose's dorsum (the ear parallels the bridge)
  earProtrusion: 35,    // degrees the outer ear folds off the concha at the antihelix (the concha itself stands 15° off the head)
  earlobe: 0,           // 0 a free lobule (tilted off the head, a gap behind it) … 1 attached (tilted into the cheek, fused)
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
  female: Object.freeze({ browProjection: 0.028, nasalIndex: 0.62, fissure: 0.048, canthalTilt: 0.011, upperVermilion: 0.037, lowerVermilion: 0.046, headLength: 0.84, cephalic: 0.8, jaw: 0.68, nasionDepth: 0.012, noseProjection: 0.34, chin: -0.012, brow: 0.45, faceWidth: 0.88 }),
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
  const eyeY = n.y - R.radix;   // the cornea's apex (the eye point), hung off the nasion
  side('eu', euX, op.y + R.headLength * 0.42, 0.72);
  side('zy', zyX, 0.13, zEye - 0.06);                         // the arch's widest, ahead of the ear
  side('malar', zyX * 0.78, eyeY - R.malarDepth, zEye - 0.09); // the cheekbone's front (the zygomatic prominence)
  side('fz', exX + 0.01, eyeY - R.orbitRim, zG - 0.01);      // frontozygomatic: the brow's outer end
  side('condyle', zyX * 0.87, 0.045, zEye - 0.08);           // ahead of the ear canal, under the arch, inside the zygion
  side('go', goX, 0.07, zSto - 0.03);                        // the jaw's corner
  side('ment', goX * 0.42, pg.y - 0.035, 0.05);              // the mental tubercle: the chin's corners
  side('en', enX, eyeY + 0.025, zEye);
  side('ex', exX, eyeY - 0.02, zEye + R.canthalTilt);
  side('eye', (enX + exX) / 2, eyeY, zEye);
  side('al', alX, sn.y + 0.035, zSn + 0.012);
  side('ch', chX, sn.y + R.lipProjection - 0.045, zSto);
  // THE CHEEK CONTROL POINT: straight out from the rhinion (mid-bridge) to under the eye's centre — the cheek's apex,
  // where the malar pad peaks; set on the skin a touch proud of the cornea's plane
  for (const s of ['L', 'R']) P[`cheek${s}`] = { x: P[`eye${s}`].x, y: P[`eye${s}`].y + 0.01, z: P.rhinion.z };
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
  vertex: 5.5, trichion: 4.5, g: 5.5, n: 6.5, op: 6, eu: 5.5, supraorbital: 6, suborbital: 6.5, lateralOrbit: 6, malar: 11, zy: 7,
  temporal: 10, condyle: 9, masseter: 18, go: 12, buccal: 15, philtrum: 12, mentolabial: 11, pg: 11, gn: 8, me: 7,
});
const MM_V = 1 / 230;   // a millimetre in head heights

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
      // (the lateral orbital rim, beside the outer canthus: thin skin over the rim, which sits behind the eye)
      [{ x: P[`ex${s}`].x + Math.sign(P[`ex${s}`].x) * 0.03, y: P[`ex${s}`].y - 0.03, z: P[`ex${s}`].z }, 'lateralOrbit'],
      [mid(P[`fz${s}`], P[`eu${s}`], 0.4), 'temporal'], [P[`condyle${s}`], 'condyle'],
      [mid(P[`go${s}`], P[`malar${s}`], 0.45), 'masseter'], [mid(P[`ch${s}`], P[`go${s}`], 0.35), 'buccal']);
  }
  return m.map(([p, k]) => ({ p, t: T(k) }));
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
      : (points[c.point] ? (points[c.point][c.axis] - head.landmarks[c.point][c.axis]) / HEAD_V / MM_V : null));
    residual = Object.fromEntries(Object.entries(TUNE_CHANNELS).map(([k, c]) => { const e = errOf(c); return [k, e == null ? null : Math.round(e * 10) / 10]; }));
    if (Object.values(residual).every((e) => e == null || Math.abs(e) <= tolerance)) break;
    const next = { ...tune };
    for (const [k, c] of Object.entries(TUNE_CHANNELS)) {
      const e = residual[k];
      if (e == null || Math.abs(e) <= tolerance) continue;
      if (last && last[k] != null) gain[k] = Math.sign(e) !== Math.sign(last[k]) && Math.abs(e) > tolerance ? gain[k] / 2 : Math.min(damping, gain[k] * 1.5);
      const step = (gain[k] * e * MM_V) / (c.pair ? 2 : 1);
      next[k] = clampTo(c.point ? tune[k] - step : tune[k] + step, LIMIT);
    }
    last = residual;
    tune = next;
  }
  return { tune, steps: n, residual };
}
const clampTo = (v, lim) => Math.max(-lim, Math.min(lim, v));
const TUNE_CACHE = new Map();

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
  // the alveolar mass: the upper jaw under the lips, the mouth's bed (the teeth)
  w('alveolar', at(P.chL, { y: -0.03 }), at(P.sto, { y: -0.075, z: 0.02 }), at(P.chR, { y: -0.03 }), [0.05, 0.075, 0.05]);
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
  // THE BROW — an arch each side, the glabella → the supraorbital peak over the iris's outer edge → the
  // frontozygomatic: forward over the eye (`browProjection`), sweeping back to its outer end behind the eye
  // (`orbitRim`), so it hoods the globe without walling it in; its radius the sex's ridge
  // (the peak's radius outgrows the tissue over it, so its bone stays a ridge and never shrinks to a floating bead)
  const rb = 0.03 + 0.02 * R.brow, rS = 0.036 + 0.008 * R.brow;
  for (const s of ['L', 'R']) {
    const e = P[`eye${s}`], sg = Math.sign(e.x);
    const peak = { x: e.x + sg * 0.012, y: e.y + R.browProjection - rS, z: e.z + 0.065 };
    w(`brow${s}`, at(P.g, { y: -rb }), peak, P[`fz${s}`], [rb, rS, 0.035]);
    // THE LATERAL ORBITAL RIM — the zygoma's frontal process: the brow's outer end → beside the outer canthus, its
    // deepest (Hertel's rim, ~16 mm behind the cornea) → the cheekbone; it closes the orbit's side behind the eye.
    // Authored at its BONE size and in the SKULL only: the skin over it is already the wave of the brow, the cheek and
    // their pads, landing its ~6 mm of tissue over this bar; summed into the skin's wave too, the bar would count
    // twice and wall the eye in again
    const ex = P[`ex${s}`];
    V.push({ name: `orbitRim${s}`, a: at(P[`fz${s}`], { y: -0.02 }), c: { x: ex.x + sg * 0.024, y: e.y - R.orbitRim - 0.017, z: ex.z - 0.004 }, b: at(P[`malar${s}`], { y: -0.035 }), r: [0.014, 0.012, 0.016], group: 'bone', skullOnly: true });
  }
  // THE SOFT MASSES — muscles at rest and fat pads, origin → belly → insertion, authored at their skin size (no bone
  // under them, no tissue over them). They fill what an offset of the bone cannot: the hollows between the bones.
  // A muscle here is its REST volume; its action (phase 2) drives the same vajra. Lateral beads are set inside the
  // widths their relations name (zy, go), so the skin still meets them.
  const soft = (name, a, c, b, r, drive) => V.push({ name, a, c, b, r, group: 'soft', muscle: true, ...(drive ? { drive } : {}) });
  for (const s of ['L', 'R']) {
    const zy = P[`zy${s}`], go = P[`go${s}`], malar = P[`malar${s}`], ch = P[`ch${s}`], fz = P[`fz${s}`], eu = P[`eu${s}`], eye = P[`eye${s}`];
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
    const endUp = at(ch, { x: -Math.sign(ch.x) * 0.005, y: -0.025, z: 0.016 }), endLo = at(ch, { x: -Math.sign(ch.x) * 0.005, y: -0.025, z: -0.016 });
    V.push({ name: `cheekUp${s}`, a: anchor, c: at(bulge, { z: 0.01 }), b: endUp, r: [0.04, 0.055, 0.024], group: 'soft', muscle: true, balloon: true, drive: [J, [`bulge${s}`], corner] });
    V.push({ name: `cheekLo${s}`, a: at(anchor, { z: -0.02 }), c: at(bulge, { z: -0.035, y: -0.01 }), b: endLo, r: [0.04, 0.055, 0.024], group: 'soft', muscle: true, balloon: true, drive: [J, [`bulge${s}`], [`loMid${s}`]] });
    // the BELLY: the arms bend up through the bulge, so the triangle between the anchor, the bulge and the corner
    // would be empty — a third vajra through its centre fills it, and the balloon is solid
    const belly = { x: (anchor.x + bulge.x + ch.x) / 3, y: (anchor.y + bulge.y + ch.y) / 3 - 0.01, z: (anchor.z + bulge.z + ch.z) / 3 };
    V.push({ name: `cheekBelly${s}`, a: anchor, c: inX(belly, 0.01), b: at(ch, { x: -Math.sign(ch.x) * 0.008, y: -0.03 }), r: [0.04, 0.06, 0.026], group: 'soft', muscle: true, balloon: true, drive: [J, ['jawHalf'], corner] });
    // ZYGOMATICUS MAJOR — the smile's muscle: the cheekbone's side → the belly across the cheek → the mouth's corner
    // (the modiolus). At rest a thin strap under the balloon; `smile` pulls its insertion toward its origin, and as a
    // balloon it keeps its volume, so it thickens as it shortens.
    // THE CHEEK'S WALL — the buccinator: from the upper molars (fixed to the face) and the lower molars (riding the
    // jaw) to the mouth's corner, closed at the back by the raphe between them. A frame that stretches with the jaw,
    // so the side of the mouth stays covered however far it opens (the balloon covers the cheek's face, not its side).
    const mUp = inX(at(go, { y: 0.12, z: P.sto.z - go.z + 0.045 }), 0.03), mLo = inX(at(go, { y: 0.12, z: P.sto.z - go.z - 0.05 }), 0.03);
    soft(`buccUp${s}`, mUp, inX(at(mid(mUp, ch), { y: 0.0 }), 0.012), at(ch, { x: -Math.sign(ch.x) * 0.006, y: -0.035 }), [0.035, 0.032, 0.022], [null, null, corner]);
    soft(`buccLo${s}`, mLo, inX(at(mid(mLo, ch), { y: 0.0 }), 0.012), at(ch, { x: -Math.sign(ch.x) * 0.006, y: -0.035 }), [0.035, 0.032, 0.022], [J, [`loMid${s}`], corner]);
    soft(`raphe${s}`, mUp, mid(mUp, mLo), mLo, [0.035, 0.032, 0.035], [null, ['jawHalf'], J]);
    // the depressor anguli oris: the mandible's front → the corner — seals the lower cheek to the chin however far
    // the jaw drops
    soft(`depressor${s}`, at(inX(P[`ment${s}`], 0.03), { y: -0.01, z: 0.01 }), at(mid(P[`ment${s}`], ch), { y: -0.025 }), at(ch, { x: -Math.sign(ch.x) * 0.006, y: -0.03, z: -0.01 }), [0.03, 0.032, 0.022], [J, [`loMid${s}`], corner]);
    // in front of the ear: the joint's cover, between the jaw's joint and the vault (the ear will sit on it)
    soft(`preauricular${s}`, at(P[`condyle${s}`], { y: -0.01 }), inX(at(P[`porion${s}`], { y: -0.045, z: 0.02 }), 0.04), inX(at(P[`eu${s}`], { y: -0.06, z: -0.2 }), 0.1), [0.045, 0.06, 0.06]);
    // behind the ramus, under the ear: the parotid's fill, from under the ear down behind the jaw's angle, so the
    // ramus gliding forward as the mouth opens leaves no gap behind it
    soft(`parotid${s}`, inX(at(P[`condyle${s}`], { y: -0.05, z: -0.02 }), 0.02), inX(at(mid(P[`condyle${s}`], go), { y: -0.07 }), 0.03), inX(at(go, { y: -0.05, z: 0.03 }), 0.04), [0.045, 0.05, 0.04]);
    V.push({ name: `zygomaticus${s}`, a: inX(at(mid(malar, zy, 0.35), { y: -0.03, z: -0.01 }), 0.03), c: at(mid(malar, ch, 0.5), { y: -0.025 }), b: at(ch, { y: -0.02 }), r: [0.018, 0.016, 0.014], group: 'soft', muscle: true, balloon: true, drive: [null, [`zyg${s}`], corner] });
    // the lids: corner → over the globe → corner, upper and lower
  }
  // the BROW PAD — the soft brow over the ridge (the eyebrow's bed): frontalis lifts it, the corrugator draws it
  // down and in. It rides on the bone and does not move the bone.
  soft('browPad', at(P.fzL, { y: -0.012 }), at(P.g, { y: -0.03, z: -0.004 }), at(P.fzR, { y: -0.012 }), [0.022, 0.02, 0.022], [['browL'], ['browC'], ['browR']]);
  // the SOFT features: no bone under them to stand off — the external nose and the lips are their own tissue
  // THE UPPER LIP'S BODY — orbicularis oris above the mouth: wing base → under the subnasale → wing base, in front of
  // the teeth, so the lip rises to meet the nose's base (without it the skin under the nose fell ~2 cm behind the
  // subnasale, a notch you could see through from the side once the cheeks drew back)
  soft('upperLipBody', at(P.alL, { y: -0.03, z: -0.03 }), { x: 0, y: P.sn.y - 0.022, z: (P.sn.z + P.ls.z) / 2 + 0.01 }, at(P.alR, { y: -0.03, z: -0.03 }), [0.022, 0.03, 0.022], [['bowL'], null, ['bowR']]);
  // THE NOSE — nasion → rhinion → tip, the alae across the base through the subnasale
  v('nose', at(P.n, { y: -0.02 }), at(P.rhinion, { y: -0.018 }), at(P.prn, { y: -0.03 }), [0.018, 0.02, 0.03], 'nose');
  v('alae', at(P.alL, { y: -0.02 }), at(P.sn, { y: -0.02, z: 0.005 }), at(P.alR, { y: -0.02 }), [0.022, 0.018, 0.022], 'nose');
  // THE COLUMELLA — the strip under the tip from the subnasale to the tip's underside, so the nose is closed beneath
  // (without it the air under the tip showed through from the side)
  v('columella', at(P.sn, { y: -0.004, z: 0.006 }), at(mid(P.sn, P.prn, 0.55), { y: -0.012, z: -0.008 }), at(P.prn, { y: -0.032, z: -0.012 }), [0.01, 0.011, 0.014], 'nose');
  // THE SEPTUM — the midline wall filling the triangle between the mid-bridge, the subnasale and the tip, so the nose
  // is solid between its nostrils (without it the air inside the nose showed through from the side)
  { const tri = { x: 0, y: (P.rhinion.y + P.sn.y + P.prn.y) / 3 - 0.012, z: (P.rhinion.z + P.sn.z + P.prn.z) / 3 };
    v('septumUp', at(P.rhinion, { y: -0.024 }), tri, at(P.sn, { y: -0.008, z: 0.01 }), [0.016, 0.02, 0.012], 'nose');
    v('septumTip', tri, mid(tri, at(P.prn, { y: -0.03 })), at(P.prn, { y: -0.034, z: -0.006 }), [0.02, 0.018, 0.016], 'nose'); }
  // THE SIDEWALLS — from each wing up to the mid-bridge: angled cones, wide at the flare and narrowing as they rise,
  // so the nose is a pyramid (a ridge with two walls) and the wings read as wings where the walls meet them
  for (const s of ['L', 'R']) v(`noseWall${s}`, at(P[`al${s}`], { y: -0.024, z: 0.008 }), at(mid(P[`al${s}`], P.rhinion, 0.5), { x: -Math.sign(P[`al${s}`].x) * 0.012, y: -0.022 }), at(P.rhinion, { y: -0.022 }), [0.02, 0.015, 0.012], 'nose');
  // THE LIPS — corner → the lip's centre → corner, upper and lower
  // (each lip is two vajras, corner → its lateral bead → the centre: the upper through the cupid's bow peak to the
  // tubercle, the lower through its fullest to its centre; the centre beads are shared, so the halves meet there)
  const upC = at(P.ls, { y: -0.024, z: -0.002 }), loC = at(P.li, { y: -0.028 });
  for (const s of ['L', 'R']) {
    v(`upperLip${s}`, at(P[`ch${s}`], { y: -0.004 }), at(P[`bow${s}`], { y: -0.016, z: -0.008 }), upC, [0.006, 0.016, 0.022], 'lips', [[`corner${s}`], [`bow${s}`], null]);
    v(`lowerLip${s}`, at(P[`ch${s}`], { y: -0.004, z: -0.002 }), at(P[`loMid${s}`], { y: -0.02 }), loC, [0.006, 0.02, 0.026], 'lips', [[`corner${s}`], [`loMid${s}`], J]);
    // the philtral columns: two ridges from the nose's base down to the bow's peaks
    v(`philtrum${s}`, at(P.sn, { x: (s === 'L' ? -1 : 1) * 0.012, y: -0.006, z: -0.012 }), at(mid(P.sn, P[`bow${s}`]), { x: (s === 'L' ? -1 : 1) * 0.004, y: -0.006 }), at(P[`bow${s}`], { y: -0.008 }), [0.005, 0.005, 0.006], 'lips', [null, null, [`bow${s}`]]);
  }
  // THE CARVES — grooves cut from the skin at the end (`carve`), riding what they part: the lip line between the
  // lips (the corners and half the jaw) and the mentolabial sulcus over the chin. (The philtrum is its columns alone:
  // a carved groove between them read as a line, and cut through the lip under the nose.)
  const cut = (name, a, c, b, r, drive) => V.push({ name, a, c, b, r, group: 'carve', ...(drive ? { drive } : {}) });
  cut('lipLine', at(P.chL, { y: 0.002 }), { ...P.sto, y: P.ls.y - 0.001 }, at(P.chR, { y: 0.002 }), [0.003, 0.005, 0.003], [['cornerL'], ['jawHalf'], ['cornerR']]);
  cut('mentolabial', at(P.loMidL, { x: -0.02, y: -0.03, z: -0.035 }), { x: 0, y: P.pg.y - 0.008, z: (P.li.z + P.pg.z) / 2 + 0.006 }, at(P.loMidR, { x: 0.02, y: -0.03, z: -0.035 }), [0.006, 0.01, 0.006], [J, J, J]);
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
  jaw: 'the mandible rotates about the condyles (25° at 1) and glides forward; the lips part and the mouth opens',
  smile: 'zygomaticus major: the mouth corners drawn up and back toward the cheekbones; the cheek balloons, shortened, bulge (both sides)',
  smileL: 'the smile, the figure\'s left side only', smileR: 'the smile, the figure\'s right side only',
  browRaise: 'frontalis: the brows lifted', browLower: 'the corrugator: the brows drawn down and together',
  blink: 'the upper lids close over the globes (both)', blinkL: 'the left lid only', blinkR: 'the right lid only',
});
export const ACTION_NAMES = Object.freeze(Object.keys(ACTIONS));
const JAW_OPEN_DEG = 25;

/**
 * The drivers' transforms for a set of activations, over the (tuned) points `P`: { driver: (point) => point }. Every
 * driver is the rest bead's displacement, rotation first, translations summed.
 */
export function actionDrivers(P, acts = {}) {
  const a = (k) => Math.max(0, Math.min(1, Number(acts[k]) || 0));
  const side = (k, s) => Math.max(0, Math.min(1, a(k) + a(`${k}${s}`)));
  const add = (p, d, t = 1) => ({ x: p.x + d.x * t, y: p.y + d.y * t, z: p.z + d.z * t });
  const rotX = (p, o, deg) => {
    if (!deg) return p;
    const th = (deg * Math.PI) / 180, c = SM.cos(th), s = SM.sin(th), y = p.y - o.y, z = p.z - o.z;
    return { x: p.x, y: o.y + y * c + z * s, z: o.z - y * s + z * c };
  };
  // THE HINGE: the axis through the condyles; opening rotates the chin down and back and glides the joint forward
  const hinge = { x: 0, y: (P.condyleL.y + P.condyleR.y) / 2, z: (P.condyleL.z + P.condyleR.z) / 2 };
  const jawAt = (t) => (p) => add(rotX(p, hinge, t * a('jaw') * JAW_OPEN_DEG), { x: 0, y: 0.02, z: 0 }, t * a('jaw'));
  const D = { jaw: jawAt(1), jawHalf: jawAt(0.5) };
  for (const s of ['L', 'R']) {
    const sm = side('smile', s), ch = P[`ch${s}`], o = P[`zy${s}`];
    // the smile's pull: from the corner toward the muscle's origin, 10 mm at full
    const pull = (() => { const d = { x: o.x - ch.x, y: o.y - ch.y, z: o.z - ch.z }, l = Math.hypot(d.x, d.y, d.z) || 1; return { x: d.x / l, y: d.y / l, z: d.z / l }; })();
    D[`corner${s}`] = (p) => add(jawAt(0.45)(p), pull, 0.045 * sm);
    D[`bow${s}`] = (p) => add(jawAt(0.1)(p), pull, 0.02 * sm);
    D[`loMid${s}`] = (p) => add(jawAt(0.75)(p), pull, 0.02 * sm);
    D[`zyg${s}`] = (p) => add(p, pull, 0.02 * sm);
    // the balloon's bulge: pushed by the corner into the cheekbone, it bunches UP and FORWARD (not along the pull,
    // which runs back toward the bone); a little of the jaw; its swell is its own volume
    D[`bulge${s}`] = (p) => add(jawAt(0.25)(p), { x: 0, y: 0.6, z: 0.8 }, 0.022 * sm);
    // the brow: raised straight up; lowered down, forward a touch, and toward the midline
    const sg = Math.sign(P[`fz${s}`].x);
    D[`brow${s}`] = (p) => add(add(p, { x: 0, y: 0, z: 0.03 }, a('browRaise')), { x: -sg * 0.012, y: 0.004, z: -0.02 }, a('browLower'));
  }
  D.browC = (p) => add(add(p, { x: 0, y: 0, z: 0.022 }, a('browRaise')), { x: 0, y: 0.006, z: -0.016 }, a('browLower'));
  return D;
}

/**
 * The vajras moved by the actions: each driven bead through its drivers in order. A `balloon` keeps its volume: its
 * radii scale by √(rest length / length) (a tube's volume goes as r²L), clamped to a plausible swell.
 */
export function applyActions(vajras, P, acts) {
  if (!acts || !Object.values(acts).some((v) => Number(v))) return vajras;
  const D = actionDrivers(P, acts);
  return vajras.map((w) => {
    if (!w.drive) return w;
    const beads = [w.a, w.c, w.b].map((q, i) => (w.drive[i] || []).reduce((p, k) => (D[k] ? D[k](p) : p), q));
    const len = (a, c, b) => Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z) + Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z);
    const k = w.balloon ? Math.max(0.75, Math.min(1.6, Math.sqrt(len(w.a, w.c, w.b) / len(beads[0], beads[1], beads[2])))) : 1;
    return { ...w, a: beads[0], c: beads[1], b: beads[2], r: w.r.map((r) => r * k) };
  });
}

/**
 * THE EAR — a plate in the shape of the operator's sketch (head-ear.js `EAR_OUTLINE`: unit height, `u` forward, `v` up,
 * about the bowl), in three pieces: the concha on the head, the outer ear folded off it at the antihelix
 * (`earProtrusion`), the lobule free or attached (`earlobe`);
 * its relief on the front face as vajras: the helix rim chained along the outline (the lobule fuller), the antihelix's
 * Y (its stem from the antitragus, its two crura), the tragus and the antitragus; the concha carved into it, and the
 * canal a blind dimple at its floor. Its place is relational: the top at the brow (`earTop`), the lobule level with the
 * nose's base (`earBottom`), the long axis leaning back by a share of the nose's dorsum (`earTilt`), the hinge on the
 * head's own skin, found by probing the field (`baseX`). Returns { f, carve, top, tragion } in V (`f` the ear's mass,
 * `carve` its hollows) for side `s` ('L' | 'R').
 */
/** the ear's fold line (the antihelix, in the outline's `u`), the lobule's seam (in `v`), a free lobe's tilt (deg) */
// a free lobule tilts off the head about its seam (+); an attached one tilts INTO it (−), so its front sinks into the
// cheek and fuses there — no web, the tilt is the attachment
// the attachment's weld (× height): how deep the concha's back and the lobule's front strip reach toward the head, so
// they meet the skin where the head's side curves in below the ear canal
const EAR_FOLD = -0.22, EAR_LOBE = -0.26, EAR_LOBE_FREE = 14, EAR_LOBE_ATTACHED = -16, EAR_CONCHA_TILT = 15, EAR_WELD = 0.14;
export function earPart(P, rel, s, baseX) {
  const R = { ...RELATIONS, ...rel };
  const sg = s === 'L' ? -1 : 1;
  const zEye = P[`eye${s}`].z, zSa = zEye + R.earTop * (P.g.z - zEye), zSba = P.sn.z + R.earBottom;
  const lean = Math.atan2(P.prn.y - P.n.y, P.n.z - P.prn.z), t = R.earTilt * lean, ct = Math.cos(t), st = Math.sin(t);
  const Hear = (zSa - zSba) / ct;                                   // the outline's unit height, along the leaning axis
  // THE EAR'S THREE PIECES, each a flat frame, meeting along shared lines: the CONCHA lies on the head (the bowl's
  // back is on the skin); the OUTER ear — the helix and the scapha behind the antihelix — folds off the head at the
  // antihelix's line (`EAR_FOLD`) by `earProtrusion` (the fold is what sets how far an ear stands out); the LOBULE,
  // below the bowl (`EAR_LOBE`), hangs tilted about its seam — off the head when free (`earlobe` 0), into the cheek
  // when attached (`earlobe` 1), where it fuses.
  const al = (R.earProtrusion * Math.PI) / 180, be = ((EAR_LOBE_FREE + (EAR_LOBE_ATTACHED - EAR_LOBE_FREE) * R.earlobe) * Math.PI) / 180;
  const U = { x: 0, y: -st, z: ct };                                // up the ear, leaning back
  const Bk = { x: 0, y: -ct, z: -st };                              // back along the head
  const Xs = { x: sg, y: 0, z: 0 };                                 // off the head
  const add3 = (p, q, k = 1) => ({ x: p.x + q.x * k, y: p.y + q.y * k, z: p.z + q.z * k });
  const comb = (a, ka, b, kb) => ({ x: a.x * ka + b.x * kb, y: a.y * ka + b.y * kb, z: a.z * ka + b.z * kb });
  const outward = (a, b) => { const n = { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }, l = Math.hypot(n.x, n.y, n.z) || 1, k = Math.sign(n.x) === sg ? 1 / l : -1 / l; return { x: n.x * k, y: n.y * k, z: n.z * k }; };
  const H0 = { x: sg * baseX, y: P.porionR.y + 0.03, z: zSba + 0.481 * Hear * ct };  // the hinge at the bowl's height
  const W = R.earWidth;
  // a frame: its origin, the directions of +v and of +b (back, b = (EAR_HINGE − u)·W), its normal, and where (u, v)
  // sit at the origin; points map linearly, so each piece inverts exactly
  const frame = (O, Ev, Eb, u0, v0) => ({ O, Ev, Eb, N: outward(Ev, Eb), u0, v0 });
  // the concha stands up off the head about the hinge (the cephaloconchal angle); the outer ear folds further at the
  // antihelix; the lobule hangs from the concha's seam, tilted off it when free and into the head when attached
  const ga = (EAR_CONCHA_TILT * Math.PI) / 180;
  const Bcon = comb(Bk, Math.cos(ga), Xs, Math.sin(ga)), Bout = comb(Bk, Math.cos(ga + al), Xs, Math.sin(ga + al));
  const Dlobe = comb(U, -Math.cos(be), outward(U, Bcon), Math.sin(be));
  const conchaF = frame(H0, U, Bcon, EAR_HINGE, 0);
  const FR = {
    concha: conchaF,
    outer: frame(add3(H0, Bcon, (EAR_HINGE - EAR_FOLD) * W * Hear), U, Bout, EAR_FOLD, 0),
    lobule: frame(add3(H0, U, EAR_LOBE * Hear), { x: -Dlobe.x, y: -Dlobe.y, z: -Dlobe.z }, Bcon, EAR_HINGE, EAR_LOBE),
  };
  const pieceOf = (u, v) => (u < EAR_FOLD ? FR.outer : v < EAR_LOBE ? FR.lobule : FR.concha);
  const mapIn = (F, u, v, n) => {
    const b = (F.u0 - u) * W * Hear, a = (v - F.v0) * Hear, c = n * Hear;
    return { x: F.O.x + F.Ev.x * a + F.Eb.x * b + F.N.x * c, y: F.O.y + F.Ev.y * a + F.Eb.y * b + F.N.y * c, z: F.O.z + F.Ev.z * a + F.Eb.z * b + F.N.z * c };
  };
  const map = (u, v, n = 0) => mapIn(pieceOf(u, v), u, v, n);
  const localIn = (F, p) => {
    const q = { x: p.x - F.O.x, y: p.y - F.O.y, z: p.z - F.O.z };
    const a = q.x * F.Ev.x + q.y * F.Ev.y + q.z * F.Ev.z, b = q.x * F.Eb.x + q.y * F.Eb.y + q.z * F.Eb.z, c = q.x * F.N.x + q.y * F.N.y + q.z * F.N.z;
    return { u: F.u0 - b / (W * Hear), v: F.v0 + a / Hear, n: c / Hear };
  };
  // the relief, as vajras in the ear's own units: [u, v, relief, radius] beads
  // (each chain is ONE ridge: its segments meet by a plain min — a smooth union at every joint added material and
  // beaded the rim; only whole ridges blend with the plate and with each other)
  const chains = [];
  const chain = (pts) => {
    const bonds = [];
    for (let i = 0; i + 2 < pts.length; i += 2) bonds.push(pts.slice(i, i + 3));
    if ((pts.length - 1) % 2) bonds.push([pts[pts.length - 2], pts[pts.length - 2], pts[pts.length - 1]]);
    chains.push(bonds);
  };
  // the helix rim along the outline (its closed run; the front where the bowl opens has none): the sketch's points
  // smoothed (two rounds of corner cutting) so the rim is a curve and not a run of beads, rolled broad (~8 mm), and
  // swelling smoothly into the lobule
  let run = EAR_OUTLINE.filter((q) => q[2] !== 'open').map(([u, v]) => [u, v]);
  for (let k = 0; k < 2; k++) {
    const out = [run[0]];
    for (let i = 0; i + 1 < run.length; i++) { const [a, b] = [run[i], run[i + 1]]; out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); }
    out.push(run[run.length - 1]); run = out;
  }
  const lobe = (v) => { const t = Math.max(0, Math.min(1, (-0.12 - v) / 0.26)); return t * t * (3 - 2 * t); };   // 0 above, 1 in the lobule
  chain(run.map(([u, v]) => [u, v, 0.035 * (1 - lobe(v)), 0.06 + 0.045 * lobe(v) * (1 - 0.35 * R.earlobe)]));
  // the helix's root (crus helicis): the rim's front end curling down and back into the bowl
  chain([[run[0][0], run[0][1], 0.035, 0.06], [0.15, 0.12, 0.03, 0.05], [0.04, 0.06, 0.012, 0.035]]);
  // the antihelix: the stem from the antitragus up to the fork, the superior crus up and back, the inferior forward
  chain([[-0.12, -0.24, 0.02, 0.05], [-0.25, -0.04, 0.025, 0.05], [-0.2, 0.17, 0.025, 0.046]]);
  chain([[-0.2, 0.17, 0.025, 0.042], [-0.27, 0.32, 0.02, 0.036], [-0.21, 0.42, 0.012, 0.03]]);
  chain([[-0.2, 0.17, 0.025, 0.04], [-0.05, 0.25, 0.018, 0.034], [0.08, 0.3, 0.01, 0.028]]);
  // the tragus before the bowl — RAISED, and carried down into the notch over the lobe, so the flap fills the gap where
  // the ear meets the cheek; its root runs behind it into the head — and the antitragus below it
  chain([[0.2, -0.26, 0.01, 0.06], [0.17, -0.11, 0.06, 0.07], [0.17, 0.04, 0.035, 0.045]]);
  chain([[0.21, -0.24, -0.1, 0.06], [0.2, -0.11, -0.1, 0.06], [0.2, 0.02, -0.08, 0.045]]);
  chain([[-0.02, -0.25, 0.02, 0.035], [-0.1, -0.22, 0.03, 0.045], [-0.15, -0.16, 0.02, 0.03]]);
  const ridgesOf = () => chains.map((bonds) => bonds.map(([a, c, b]) => { const A = map(a[0], a[1], a[2]), C = map(c[0], c[1], c[2]), B = map(b[0], b[1], b[2]); return [A, C, B, a[3] * Hear, c[3] * Hear, b[3] * Hear]; }));
  const ridges = ridgesOf();
  // the plate: the outline's polygon, thick `PLATE` (× height) about its own plane
  const poly = EAR_OUTLINE.map(([u, v]) => [u, v]), PLATE = 0.04;
  const polyD = (u, v) => {   // signed distance to the outline in its plane (negative inside)
    let d = Infinity, inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [x1, y1] = poly[j], [x2, y2] = poly[i], ex = x2 - x1, ey = y2 - y1, l2 = ex * ex + ey * ey;
      const tt = Math.max(0, Math.min(1, ((u - x1) * ex + (v - y1) * ey) / l2));
      d = Math.min(d, Math.hypot(u - x1 - ex * tt, v - y1 - ey * tt));
      if ((y1 > v) !== (y2 > v) && u < x1 + ((v - y1) * ex) / ey) inside = !inside;
    }
    return inside ? -d : d;
  };
  const centre = map(-0.11, 0.02, 0), reach = 0.75 * Hear, k = 0.03 * Hear, SEAM = 0.015;
  // (the concha's piece is filled behind down to the skin — the conchal eminence: the bowl's back is on the head, so
  // its slab reaches back as far as the tilt has lifted it, plus a weld)
  const PIECES = [
    [FR.concha, (u, v, n) => Math.max(EAR_FOLD - SEAM - u, EAR_LOBE - SEAM - v, -n - ((EAR_HINGE - u) * W * Math.sin(ga) + EAR_WELD))],
    [FR.outer, (u) => u - EAR_FOLD - SEAM],
    [FR.lobule, (u, v) => Math.max(EAR_FOLD - SEAM - u, v - EAR_LOBE - SEAM)],
  ];
  const f = (p) => {
    if (Math.hypot(p.x - centre.x, p.y - centre.y, p.z - centre.z) > reach) return Infinity;
    // the plate, piece by piece: each the outline's polygon in its own frame, clipped to its region (a touch past
    // its seams, so the pieces overlap and close)
    let d = Infinity;
    for (const [F, clip] of PIECES) {
      const L = localIn(F, p);
      // the concha's back is its clip's; the lobule's front strip is welded deep too (every lobe hangs from its top
      // front, free or not), fading to the plate's own back by the middle of the lobe
      // (down the lobe it fades too: a free lobe hangs from its top, and a weld behind its tilted body was a blade)
      const weld = F === FR.lobule ? EAR_WELD * Math.max(0, Math.min(1, (L.u - 0.03) / 0.14)) * Math.max(0, Math.min(1, (L.v - EAR_LOBE + 0.1) / 0.1)) : 0;
      const back = F === FR.concha ? -Infinity : -L.n * Hear - (PLATE + weld) * Hear;
      const piece = Math.max(polyD(L.u, L.v) * Hear * Math.min(1, W), L.n * Hear - PLATE * Hear, back, clip(L.u, L.v, L.n) * Hear);
      d = d === Infinity ? piece : smin(d, piece, 0.05 * Hear);
    }
    for (const segs of ridges) {
      let r = Infinity;
      for (const [A, C, B, ra, rc, rb] of segs) r = SM.min(r, sdRoundCone(p, A, C, ra, rc), sdRoundCone(p, C, B, rc, rb));
      d = smin(d, r, k);
    }
    return d;
  };
  // the hollows: the concha (a bowl scooped from the front face down to the head) and the canal (a blind dimple)
  // (the bowl's floor stays: the sphere stops short of the plate's back face — a concha is a bowl, not a hole)
  const bowl = map(-0.03, -0.04, 0.22), bowlR = 0.2 * Hear, canal = map(0.1, -0.04, -0.12), canalR = 0.05 * Hear;
  const carve = (p) => {
    if (Math.hypot(p.x - centre.x, p.y - centre.y, p.z - centre.z) > reach) return Infinity;
    return SM.min(Math.hypot(p.x - bowl.x, p.y - bowl.y, p.z - bowl.z) - bowlR, Math.hypot(p.x - canal.x, p.y - canal.y, p.z - canal.z) - canalR);
  };
  const top = map(-0.106, 0.519, 0.03), tragion = map(0.16, -0.06, 0);
  return { f, carve, top: { ...top, z: top.z + 0.042 * Hear }, tragion, height: Hear };
}


/** the blend width per group, in V (the bone melts broadly; the nose and the lips keep their lobes) */
const BLEND = { bone: 0.04, soft: 0.03, nose: 0.012, lips: 0.01 };
/** how each soft feature joins the skin */
const JOIN = { soft: 0.04, nose: 0.02, lips: 0.012, ear: 0.01 };
/** the head's layers: the skull alone, or the skin over it */
export const HEAD_LAYERS = Object.freeze(['skin', 'skull']);

/**
 * The relational head: { field, landmarks, bounds, points, vajras, targets } in STAND units, the same shape
 * `head-field-view.js` reads (`headFieldOf`). `sex` picks the pole; `relations` replaces ratios over it; `layer` is
 * `skin` (the default) or `skull`. `targets` are the relations' own measurements, in mm, for the calipers to meet.
 * `tune` places the wave's internal points: `true` solves them (`solveTune`, cached), an object gives them.
 * `actions` are the activations of the face's action relationships (`ACTIONS`), applied over the tuned rest; `eyes`
 * is the eyes' spec (head-relational-eye.js: a word, channels, a side's own), the actions adding to it. `paint(p)`
 * names a surface point's part (the globe's 'sclera' | 'iris' | 'pupil'; null the skin).
 */
export function relationalHead({ sex = 'male', relations = {}, layer = 'skin', tune = null, actions = null, eyes = null } = {}) {
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
  const vajras = applyActions(rest, Pt, actions);
  const byName = (list) => Object.fromEntries(list.map((w) => [w.name, w]));
  const Vn = byName(vajras), Rn = byName(rest);
  // THE MOUTH — as the jaw opens the lips part, and the summed wave would bridge them: a cavity carved between the
  // upper lip's centre and the lower's (as moved), corner to corner, its depth how far they have parted from rest
  const gapOf = (n) => Math.hypot(n.upperLipL.b.y - n.lowerLipL.b.y, n.upperLipL.b.z - n.lowerLipL.b.z);
  const gap = gapOf(Vn) - gapOf(Rn);
  const mouth = gap > 0.004 ? (() => {
    const upC = Vn.upperLipL.b, loC = Vn.lowerLipL.b;
    const c = { x: 0, y: (upC.y + loC.y) / 2 - 0.012, z: (upC.z + loC.z) / 2 };
    const inC = (q) => ({ x: q.x * 0.88, y: q.y - 0.01, z: (q.z + c.z) / 2 });
    return { a: inC(Vn.upperLipL.a), c, b: inC(Vn.upperLipR.a), r: [0.004, Math.min(0.5 * gap + 0.004, 0.06), 0.004] };
  })() : null;
  const sc = HEAD_V;
  const S = (p) => ({ x: p.x * sc, y: p.y * sc, z: p.z * sc });
  // the tissue depth at p: inverse-square weights over the markers, softened so it varies slowly between them
  const depthOf = (markers, eps2) => (p) => {
    let sw = 0, st = 0;
    for (const m of markers) { const w = 1 / ((p.x - m.p.x) ** 2 + (p.y - m.p.y) ** 2 + (p.z - m.p.z) ** 2 + eps2); sw += w; st += w * m.t; }
    return st / sw;
  };
  const markersV = tissueMarkers(P), depthV = depthOf(markersV, 0.04 ** 2);
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
    return { group: w.group, skullOnly: !!w.skullOnly, f: (p) => SM.min(sdRoundCone(p, a, c, ra, rc), sdRoundCone(p, c, b, rc, rb)) };
  });
  // the orbits: cones opening forward round each globe, deep enough to hold it with room for the fat behind it
  const orbits = ['L', 'R'].map((s) => ({ a: S({ ...P[`eye${s}`], y: P[`eye${s}`].y - 0.005 }), b: S({ ...P[`eye${s}`], y: P[`eye${s}`].y - 0.15 }), ra: 0.068 * sc, rb: 0.04 * sc }));
  const carves = bonds.filter((b) => b.group === 'carve');
  // where the wavelength shortens: the mouth (about the stomion, the mouth's width) and each eye
  const featureFoci = [
    { c: S({ ...Pt.sto, y: Pt.sto.y - 0.02 }), s2: ((Pt.chR.x + 0.02) * sc) ** 2 },
    ...['L', 'R'].map((s) => ({ c: S(Pt[`eye${s}`]), s2: (0.07 * sc) ** 2 })),
  ];
  const depth = depthOf(markersV.map((m) => ({ p: S(m.p), t: m.t * sc })), (0.04 * sc) ** 2);
  const skin = layer !== 'skull';
  const kw = rel.skinWave * sc;
  const mouthF = mouth ? (() => { const a = S(mouth.a), c = S(mouth.c), b = S(mouth.b), [ra, rc, rb] = mouth.r.map((r) => r * sc); return (p) => SM.min(sdRoundCone(p, a, c, ra, rc), sdRoundCone(p, c, b, rc, rb)); })() : null;
  const skinField = (p) => {
    if (!skin) {
      let d = Infinity;
      for (const b of bonds) if (b.group === 'bone') { const e = b.f(p); d = d === Infinity ? e : smin(d, e, BLEND.bone * sc); }
      for (const o of orbits) d = smax(d, -sdRoundCone(p, o.a, o.b, o.ra, o.rb), 0.02 * sc);
      return d;
    }
    // THE SKIN WAVE: each bone vajra less the tissue at p, each soft mass as it is, summed as waves exp(−e/k)
    // (log-sum-exp about the nearest, so the sum never overflows)
    const t = depth(p), es = [], g = {};
    let lo = Infinity;
    for (const b of bonds) {
      if (b.group === 'carve' || b.skullOnly) continue;
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
    for (const k of ['nose', 'lips']) d = smin(d, g[k], JOIN[k] * sc);
    // the grooves and the mouth cut from the skin (the eyes are their own rig, set in after)
    for (const c of carves) d = smax(d, -c.f(p), 0.003 * sc);
    if (mouthF) d = smax(d, -mouthF(p), 0.006 * sc);
    return d;
  };
  // THE EARS — hinged on the skin: probe the head's own surface along the hinge's line, then hang each ear on it
  const ears = skin ? ['L', 'R'].map((s) => {
    const sg = s === 'L' ? -1 : 1, probe = rayIn(skinField, { x: 0, y: (Pt.porionR.y + 0.03) * sc, z: Pt.porionR.z * sc }, [sg, 0, 0]);
    const baseX = (probe ? Math.abs(probe.x) / sc : Pt.porionR.x) - 0.004;   // sunk a touch into the skin, so it welds
    const e = earPart(Pt, rel, s, baseX);
    return { f: (p) => e.f({ x: p.x / sc, y: p.y / sc, z: p.z / sc }) * sc, carve: (p) => e.carve({ x: p.x / sc, y: p.y / sc, z: p.z / sc }) * sc, top: S(e.top), tragion: S(e.tragion) };
  }) : [];
  // THE EYES — their own rig (head-relational-eye.js): the `eyes` spec (a word, channels, a side's own), and the
  // head's actions on top — a blink shuts the lid, a smile raises and rounds the lower lid (the squint of a real
  // smile), a raised brow lifts the upper lid, a lowered one drops it and flattens it
  const act = (k) => Math.max(0, Math.min(1, Number(actions?.[k]) || 0));
  // the brow's fold hangs from the forehead's bridge by strings; the brow pad's action pulls them (its medial bead the
  // medial strings, each lateral bead its side's)
  const shift = (k) => ({ x: Vn.browPad[k].x - Rn.browPad[k].x, z: Vn.browPad[k].z - Rn.browPad[k].z });
  const bridge = skin ? browBridge(Pt, { med: shift('c'), L: shift('a'), R: shift('b') }) : null;
  const eyeRigs = skin ? ['L', 'R'].map((s) => {
    const sm = Math.min(1, act('smile') + act(`smile${s}`)), bl = Math.min(1, act('blink') + act(`blink${s}`));
    // a gaze target (`look`, metres from between the eyes) becomes this eye's yaw and pitch, aimed from its own centre;
    // a side's own gaze still wins over it
    let spec = eyes;
    if (eyes && typeof eyes === 'object' && eyes.look) {
      const mid = { x: (Pt.eyeL.x + Pt.eyeR.x) / 2, y: (Pt.eyeL.y + Pt.eyeR.y) / 2, z: (Pt.eyeL.z + Pt.eyeR.z) / 2 };
      const M = 1 / (HEAD_V * 1.8);   // metres → head heights
      const to = { x: mid.x + eyes.look.x * M, y: mid.y + eyes.look.y * M, z: mid.z + eyes.look.z * M };
      spec = { ...eyes, ...lookAngles({ ...Pt[`eye${s}`], y: Pt[`eye${s}`].y - GLOBE.back }, to) };
    }
    const c = resolveEye(spec, s, { lower: 0.6 * sm, lowerShape: 0.3 * sm, open: 0.25 * act('browRaise') - 0.12 * act('browLower'), upperShape: -0.3 * act('browLower') });
    c.open *= 1 - bl;
    const r = eyeRig(Pt, s, c, rel.fissure, bridge.arcs[s]);
    const V = (p) => ({ x: p.x / sc, y: p.y / sc, z: p.z / sc });
    const near = (p) => Math.hypot(p.x / sc - r.bound.c.x, p.y / sc - r.bound.c.y, p.z / sc - r.bound.c.z) < r.bound.r;
    return { side: s, near, channels: c, gaze: r.gaze, margins: r.margins, globeV: r.globe, lids: (p) => r.lids(V(p)) * sc,
      lidSpace: (p) => r.lidSpace(V(p)) * sc, opening: r.opening && ((p) => r.opening(V(p)) * sc), rims: (p) => r.rims(V(p)) * sc,
      crease: r.crease && ((p) => r.crease(V(p)) * sc), globe: (p) => r.globe(V(p)) * sc, paint: (p) => r.paint(V(p)) };
  }) : [];
  const field = ears.length || eyeRigs.length ? (p) => {
    let d = skinField(p);
    for (const e of ears) { const ef = e.f(p); if (ef !== Infinity) d = smin(d, ef, JOIN.ear * sc); }
    for (const e of ears) { const c = e.carve(p); if (c !== Infinity) d = smax(d, -c, 0.004 * sc); }
    for (const e of eyeRigs) {
      if (!e.near(p)) continue;
      // the lid space cut back out of the skin, the lids' mass on it, the opening carved through it to the globe, the
      // margins and the roll laid on, the crease cut, the globe set in
      d = smax(d, -e.lidSpace(p), 0.003 * sc);
      d = smin(d, e.lids(p), 0.008 * sc);
      if (e.opening) d = smax(d, -e.opening(p), 0.0025 * sc);
      d = smin(d, e.rims(p), 0.004 * sc);
      if (e.crease) d = smax(d, -e.crease(p), 0.002 * sc);
      d = smin(d, e.globe(p), 0.0015 * sc);
    }
    return d;
  } : skinField;
  // what a surface point is painted: the globe's parts, or the skin (null)
  const paint = (p) => { for (const e of eyeRigs) if (e.near(p)) { const t = e.paint(p); if (t) return t; } return null; };
  // the names head-field-view's calipers read (figure-head.js's landmark names), from the core points
  const s = 0.9 * (sc / 0.1265);
  const W = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, S(p)]));
  const landmarks = {
    ...W, H: sc, s,
    glabella: W.g, nasion: W.n, noseBridge: W.rhinion, subnasale: W.sn, noseTip: W.prn, stomion: W.sto, menton: W.me,
    zygionR: W.zyR, gonionR: W.goR, alaR: W.alR,
    tragionR: ears.length ? ears[1].tragion : { ...W.porionR, y: W.porionR.y - 0.01 * sc },
    earTopR: ears.length ? ears[1].top : { ...W.porionR, z: W.g.z }, eyeL: W.eyeL, eyeR: W.eyeR,
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
  // the eyes' gaze, and their vergence (the angle between the two lines of sight; 0 parallel, larger the nearer)
  const vergence = eyeRigs.length === 2 ? Math.round((Math.acos(Math.max(-1, Math.min(1, eyeRigs[0].gaze.x * eyeRigs[1].gaze.x + eyeRigs[0].gaze.y * eyeRigs[1].gaze.y + eyeRigs[0].gaze.z * eyeRigs[1].gaze.z))) * 1800) / Math.PI) / 10 : null;
  // (`relational` hands what grows on the head its relations in head heights: the tuned points, the vajras at rest and
  // as the actions moved them, and the eyes' lash lines — the epidermis lays its hair by them)
  const relational = {
    V: sc, points: Pt, rest: byName(rest), moved: byName(vajras), eyes: eyeRigs.map((e) => e.channels),
    // the brow's bridge, strings and arcs (V), and the eye rigs' lash lines and globes, for the lashes
    bridge,
    eyeRigs: eyeRigs.map((e) => ({ side: e.side, channels: e.channels, margins: e.margins, globe: e.globeV })),
  };
  return { field, paint, landmarks, bounds, points: W, vajras, relations: rel, targets, tuning, actions: actions || {}, eyes: eyeRigs.map((e) => e.channels), vergence, relational };
}
