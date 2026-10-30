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
import { EAR_OUTLINE, EAR_HINGE } from './head-ear.js';
import { GLOBE, SEAT, eyeRig, resolveEye, lookAngles, browBridge } from './head-relational-eye.js';
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
  fifths: 0.215,        // eye width / zy-zy (the rule of fifths, read against the face's width: ~30 mm of ~137)
  intercanthal: 1.12,   // en-en / one eye's width (the inner canthi a little wider apart than an eye: ~33 mm)
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
  // the orbit's frame, in depth, against the cornea's apex: the eye hangs off the nasion, and the orbit's rims are
  // set behind the eye, not ahead of it (the globe shows in a profile and from ¾; a rim ahead of the cornea walls it in)
  radix: 0.048,         // the nasion ahead of the cornea / v-me (radix projection, ~11 mm; 9–14 by the clinic's canon)
  orbitRim: 0.065,      // the frontozygomatic (the brow's outer end, the lateral rim's top) behind the cornea / v-me
  malarDepth: 0.045,    // the cheekbone's front behind the cornea / v-me
  browProjection: 0.035, // the supraorbital arch's peak ahead of the cornea / v-me (the summed skin lands ~3 mm further)
  fissure: 0.036,       // the palpebral fissure's height between the margins' cores / v-me (with the lash lines' own
                        // thickness the opening reads ~10 mm, MRD1 + MRD2)
  lidSplit: 0.32,       // the share of the fissure above the pupil: the upper lash line ~4.5 mm over it, covering the iris's
                        // top (MRD1), the lower ~5.3 mm under it at the iris's lower edge (MRD2) — a neutral eye, not a stare
  canthalTilt: 0.008,   // the lateral canthus above the medial / v-me
  upperVermilion: 0.035, // the upper lip's red height / v-me
  lowerVermilion: 0.043, // the lower lip's / v-me (the lower lip the fuller)
  chin: 0,              // pg ahead of the nasion vertical / v-me (− a receding chin)
  // ── the harmonic shapes the ratios above do not reach: each an OFFSET from the canon, 0 the canon's own (the head as
  // it was, byte for byte), so a face moves from a natural one and never starts from a carved one
  chinWidth: 0,         // the mental tubercles' spread, added to the canon's 0.35 of the gonions' (− a narrower chin)
  chinRound: 0,         // the chin's mass about the pogonion, its radius × (1 + this) (− a pointier, finer chin; its front kept)
  dorsum: 0,            // the nose's bridge and root, their width × (1 + this) (− a finer bridge; the ridge's front kept)
  noseSize: 0,          // the nose's own parts (the tip's mass, the wings, the columella, the septum, the walls) and their
                        // places about the tip, the wings and the subnasale × (1 + this): a small nose is a smaller nose,
                        // not the canon's parts crowded into less room (− smaller)
  gonionDrop: 0,        // the jaw's corner lower than the canon's (0.03 under the stomion) / v-me (− a higher corner)
  cheeks: 0,            // the cheek's fullness: its balloon's radii × (1 + this) (+ fuller, − hollower)
  lowerCheek: 0,        // the lower cheek over the jaw's body: the balloon's lower arm bowed down and out and filled
                        // (+ a softer, rounder outline from the cheekbone to the chin; − a sharper V)
  masseter: 0,          // the jaw's muscle: the masseter's belly × (1 + this) (− a slimmer jaw's side, + a heavier one)
  forehead: 0,          // the frontal bulb forward of its canon place / v-me (+ a more upright, rounder forehead)
  // ── ASYMMETRY, the left side's own (no face is a mirror; a perfect one reads uncanny), each an offset, 0 the mirror
  asymEye: 0,           // the left eye (its corners and its centre) higher / v-me (+ up; ~1 mm is 0.004)
  asymBrow: 0,          // the left brow's outer end higher / v-me
  asymMouth: 0,         // the left mouth corner higher / v-me
  asymNose: 0,          // the nose's tip and base leaning to the figure's left / v-me (the bridge's root stays)
  asymJaw: 0,           // the left jaw's corner wider, a share (+ wider)
  asymCheek: 0,         // the left cheekbone wider, a share
  // ── the years' deep folds, as shape (the fine lines are the skin's wrinkle map, dermal-texture.js's FOLD page)
  furrows: 0,           // the forehead's furrows cut into the skin, 0 none … 1 an old face's (~0.8 mm deep, ~5 mm wide)
  // ── the jaw's limits: how far it opens at full activation (`jaw: 1`), and how
  jawOpen: 0.17,        // the incisors' opening at full / v-me (~39 mm: a full, comfortable opening; the anatomical
                        // maximum is ~50 mm)
  condyleGlide: 0.045,  // the condyle's glide forward and down the articular eminence at full / v-me (~10 mm)
  overjet: 0.012,       // the lower incisors behind the upper / v-me (~3 mm): the lower arch is the upper's mirror
                        // across the occlusal plane, set back by this
  incisorShow: 0.032,   // the upper incisors' edge below the stomion / v-me (~7.4 mm: the full upper lip hangs below
                        // the stomion, and ~4 mm of central incisor shows under it as the lips part, ~3 of the laterals)
  archWidth: 1,         // the dental arch's width, as a share of the canon's (`DENTITION`)
  // ── the ear (its shape the operator's sketch, head-ear.js EAR_OUTLINE; its place and lean these relations)
  earTop: 0.5,          // the ear's top between the eye line (0) and the glabella (1): at the brow
  earBottom: 0,         // the lobule's bottom above the subnasale / v-me: level with the nose's base
  earWidth: 1,          // the ear's width over its outline's own
  earTilt: 6,           // degrees the ear leans back from vertical (its frame; the long axis, helix top to lobule
                        // bottom, reads ~4° more, ~10°): upright, at the clinic's 10–30 floor (a share of the nose's dorsum
                        // read ~18°, too angled)
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
/**
 * THE EAR RAISED (realistic laws 10, the operator's: the ear sat low, its top 6–8 mm under the brow line, a man's
 * lobule 4 mm under the nose's base, where the canon sets it between the two), by the head's pole: added to `earTop` (a
 * share of the eye line to the glabella) and `earBottom` (V), over the head's own or a face's, so the top meets the brow
 * line and the lobule the nose's base. Laws 1–9 keep the ear where it was.
 */
export const EAR_RAISE = Object.freeze({ male: Object.freeze({ earTop: 0.25, earBottom: 0.01 }), female: Object.freeze({ earTop: 0.5, earBottom: 0 }) });
export const raisedEar = (rel = null, sex = 'male') => { const E = EAR_RAISE[sex] ?? EAR_RAISE.male; return { ...(rel || {}), earTop: (rel?.earTop ?? RELATIONS.earTop) + E.earTop, earBottom: (rel?.earBottom ?? RELATIONS.earBottom) + E.earBottom }; };
export const RELATION_NAMES = Object.freeze(Object.keys(RELATIONS));
/** the sex poles: ratios each pole moves over the canon (the rest are shared) */
export const RELATION_POLES = Object.freeze({
  // the male pole (2026-10-22, the face-harmony study, approved by the operator's eyes): the female's principles at the
  // male's character: the cheeks full and the lower cheek filled (volume, never a hollowed default); a broader, rounder
  // chin that no longer recedes over a wider jaw and a heavier masseter; a shorter nose with a finer bridge and a wider
  // base; fuller lips; the eyes a little more open
  male: Object.freeze({
    cheeks: 0.6, lowerCheek: 0.35, chinWidth: 0.04, chinRound: 0.1, masseter: 0.15, chin: 0.006, jaw: 0.75,
    noseProjection: 0.34, dorsum: -0.1, nasalIndex: 0.7, lipFullness: 1.32, fissure: 0.039,
  }),
  // the female pole (2026-10-21, the face-harmony study, approved by the operator's eyes): beyond the canon's sex cues, a
  // shorter, less projected nose with a finer bridge and a narrower base; larger eyes; fuller, taller, more forward lips
  // over a finer philtrum; a lighter, flatter brow; a narrower jaw and a narrower, pointed chin that no longer recedes;
  // the cheeks fuller and the lower cheek bowed out over the jaw (a soft outline, never a hollowed one)
  female: Object.freeze({
    third: 0.28, eyeLine: 0.49, nasionDrop: 0.06, headLength: 0.84, cephalic: 0.79, faceWidth: 0.87, jaw: 0.64,
    fifths: 0.232, fissure: 0.045, canthalTilt: 0.011, nasalIndex: 0.55, noseProjection: 0.29, noseFat: 0.026, dorsum: -0.35,
    nasionDepth: 0.006, browProjection: 0.019, brow: 0.22, malarDepth: 0.037, forehead: 0.01,
    lipFullness: 1.55, upperVermilion: 0.044, lowerVermilion: 0.054, lipProjection: 0.029, philtrumVolume: 0.02, jowl: 0.008,
    chinWidth: -0.11, chinRound: -0.2, gonionDrop: -0.006, cheeks: 0.5, lowerCheek: 0.5,
    archWidth: 0.96, incisorShow: 0.028, jawOpen: 0.16,
  }),
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
  const enX = (R.intercanthal * eye) / 2, exX = enX + eye, alX = (R.nasalIndex * (zN - zSn)) / 2, chX = R.mouthWidth * alX;
  // the profile, hung off the nasion
  const n = { x: 0, y: g.y - R.nasionDepth, z: zN };
  const sn = { x: 0, y: n.y + 0.01, z: zSn };
  const ns = 1 + R.noseSize;
  const prn = { x: 0, y: sn.y + R.noseProjection * (zN - zSn), z: zSn + 0.03 * ns };
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
  side('go', goX, 0.07, zSto - (0.03 + R.gonionDrop));                        // the jaw's corner
  side('ment', goX * (0.35 + R.chinWidth), pg.y - 0.035, 0.045);              // the mental tubercle: the chin's corners
  side('en', enX, eyeY + 0.025, zEye);
  side('ex', exX, eyeY - 0.02, zEye + R.canthalTilt);
  side('eye', (enX + exX) / 2, eyeY, zEye);
  side('al', alX, sn.y + R.nostrilSet * ns, zSn + R.nostrilRise * ns);
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
  // THE MOUTH'S LINES: the cupid's bow peaks on the philtral columns, the lower lip's fullest either side of centre
  side('bow', 0.2 * chX, sn.y + R.lipProjection - 0.004, zSto + R.upperVermilion);
  side('loMid', 0.45 * chX, sn.y + R.lipProjection - 0.012, zSto - 0.5 * R.lowerVermilion);
  P.porionL = { ...P.porionR, x: -P.porionR.x };
  // ASYMMETRY: the left side's points moved by its own relations (absent, the mirror as it was)
  if (R.asymEye || R.asymBrow || R.asymMouth || R.asymNose || R.asymJaw || R.asymCheek) {
    const up = (k, dz) => { if (dz && P[k]) P[k] = { ...P[k], z: P[k].z + dz }; };
    const wide = (k, f) => { if (f && P[k]) P[k] = { ...P[k], x: P[k].x * (1 + f) }; };
    for (const k of ['eyeL', 'enL', 'exL', 'cheekL']) up(k, R.asymEye);
    up('fzL', R.asymBrow);
    for (const k of ['chL', 'modL', 'loMidL']) up(k, R.asymMouth);
    for (const k of ['goL', 'mentL']) wide(k, R.asymJaw);
    for (const k of ['malarL', 'zyL']) wide(k, R.asymCheek);
    if (R.asymNose) { const lean = (k, f) => { P[k] = { ...P[k], x: P[k].x - R.asymNose * f }; }; lean('prn', 1); lean('sn', 0.7); lean('rhinion', 0.4); lean('alL', 0.7); lean('alR', 0.7); }
  }
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
/** a closed mouth's lip line, cut to one depth (mm): the groove's depth below the less prominent lip's front, its tube's
 * radius (its width), its edge's blend */
const SEAM = Object.freeze({ depth: 1, radius: 1.3, blend: 0.5 });
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
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
      // (the lateral orbital rim, beside the outer canthus: thin skin over the rim, which sits behind the eye)
      [{ x: P[`ex${s}`].x + Math.sign(P[`ex${s}`].x) * 0.03, y: P[`ex${s}`].y - 0.03, z: P[`ex${s}`].z }, 'lateralOrbit'],
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
  // grows on the same side was a neighbour's push, not the channel's own step; no point moves further than LIMIT, nor a
  // channel past its own (`TUNE_LIMITS`)
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
      next[k] = clampTo(c.point || c.probe ? tune[k] - step : tune[k] + step, TUNE_LIMITS[k] ?? LIMIT);
    }
    last = residual;
    tune = next;
  }
  return { tune, steps: n, residual };
}
const clampTo = (v, lim) => Math.max(-lim, Math.min(lim, v));
/**
 * a channel's own reach, where the solve chasing its relation further bends the face more than the miss costs: the
 * subnasale's lift, held to the poles' own range (a short, unprojected nose's skin dips ~2–4 mm under its relation; lifted
 * to the shared limit, the nose's base rose ~18 mm and drew the upper lip into a long swollen snout). The miss is
 * reported (`residual`), the face kept.
 */
export const TUNE_LIMITS = Object.freeze({ sn: 0.03 });
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
  const front = { x: 0, y: P.g.y - 0.035 - rF + R.forehead, z: P.g.z + 0.11 };
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
  // sideways as a width bead's does — a sideways step left the tubercles proud and cleft the chin). The tubercles sit
  // a third of the jaw's half-width out, low, and small (the mandible's front ends follow them in, at their size: made
  // smaller too, they thinned the floor of the mouth to a hole behind the lower incisors), so the chin's front rounds
  // off from the midline (out at 0.42 of it, higher and fuller, they held a flat plate 36 mm wide between two balls)
  // (`chinRound`: the protuberance's radius, its centre moved forward by what it loses, so the pogonion stays put)
  const cr = R.chinRound;
  w('chin', at(P.mentL, { y: -0.005, z: 0.01 }), at(P.pg, { y: -0.05 - 0.05 * cr, z: 0.005 }), at(P.mentR, { y: -0.005, z: 0.01 }), [0.02, 0.05 * (1 + cr), 0.02], [J, J, J], { stepIn: true });
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
    const zy = P[`zy${s}`], go = P[`go${s}`], malar = P[`malar${s}`], ch = P[`ch${s}`], md = P[`mod${s}`], fz = P[`fz${s}`], eu = P[`eu${s}`], eye = P[`eye${s}`];
    // masseter: the arch's underside → the belly over the ramus → the jaw's corner (its insertion IS the gonion)
    const corner = [`corner${s}`];
    // (its belly's radius rides `masseter`, set in by what it gains so its inside stays put)
    const mk = R.masseter;
    soft(`masseter${s}`, inX(at(mid(malar, zy, 0.6), { z: -0.04 }), 0.035), inX(at(mid(zy, go), { y: -0.01 }), 0.05 - 0.05 * mk), inX(at(go, { y: 0.02, z: 0.02 }), 0.035), [0.035, 0.05 * (1 + mk), 0.035], [null, ['jawHalf'], J]);
    // temporalis: the temporal line on the vault → the fossa → under the arch (it fills the temple)
    soft(`temporalis${s}`, inX(at(mid(fz, eu, 0.5), { z: 0.06 }), 0.08), inX(at(mid(fz, zy, 0.55), { y: -0.03 }), 0.06), inX(at(zy, { y: 0.03, z: -0.02 }), 0.06), [0.05, 0.045, 0.025]);
    // THE CHEEK BALLOON — a water balloon of the cheek (the buccal fat and the malar pad as one mass): anchored at the
    // jaw's corner (PINNED to the jaw: as the mandible opens the balloon stretches with it, so the cheek's wall reaches
    // the back of the jaw and does not part from it), bulging at the cheek control point, tapering to the mouth's corner above and below it. Two vajras
    // sharing the bulge. `balloon` keeps its volume: when an action shortens it (a smile draws its ends toward the
    // cheek), its radii grow by √(rest length / length), so the cheek's lift in a smile comes from the relation.
    // (`cheeks`: the balloon's fullness, its anchor's and bulge's radii)
    const anchor = inX(at(go, { y: 0.03, z: 0.04 }), 0.05), bulge = at(P[`cheek${s}`], { y: -0.045 }), bk = 1 + R.cheeks;
    // (the arms overlap end to end — their ends a corner's height apart, their radii wider than half of it — so the
    // balloon is one closed mass, not a loop with a hole through it)
    const endUp = at(md, { x: -Math.sign(ch.x) * 0.005, y: -0.025, z: 0.016 }), endLo = at(md, { x: -Math.sign(ch.x) * 0.005, y: -0.025, z: -0.016 });
    V.push({ name: `cheekUp${s}`, a: anchor, c: at(bulge, { z: 0.01 }), b: endUp, r: [0.04 * bk, 0.055 * bk, 0.024], group: 'soft', muscle: true, balloon: true, drive: [J, [`bulge${s}`], corner] });
    // (`lowerCheek`: the lower arm's middle bowed out and down, and fuller, so the outline under the cheekbone rounds)
    const lc = R.lowerCheek, lk = bk * (1 + 0.25 * lc);
    V.push({ name: `cheekLo${s}`, a: at(anchor, { z: -0.02 }), c: at(bulge, { x: Math.sign(ch.x) * 0.02 * lc, z: -0.035 - 0.025 * lc, y: -0.01 }), b: endLo, r: [0.04 * bk, 0.055 * lk, 0.024], group: 'soft', muscle: true, balloon: true, drive: [J, [`bulge${s}`], [`loMid${s}`]] });
    // the BELLY: the arms bend up through the bulge, so the triangle between the anchor, the bulge and the corner
    // would be empty — a third vajra through its centre fills it, and the balloon is solid
    const belly = { x: (anchor.x + bulge.x + ch.x) / 3, y: (anchor.y + bulge.y + ch.y) / 3 - 0.01, z: (anchor.z + bulge.z + ch.z) / 3 };
    V.push({ name: `cheekBelly${s}`, a: anchor, c: inX(belly, 0.01), b: at(md, { x: -Math.sign(ch.x) * 0.008, y: -0.03 }), r: [0.04 * bk, 0.06 * bk, 0.026], group: 'soft', muscle: true, balloon: true, drive: [J, ['jawHalf'], corner] });
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
  v('philtrumBody', { x: 0, y: P.sn.y - 0.024, z: P.sn.z - 0.016 }, philMid, { x: 0, y: P.ls.y - 0.024, z: P.ls.z + 0.012 }, [0.016, pv, 0.02 * pk], 'lipBody', [null, null, ['lipUpHalf']]);
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
  // (`dorsum`: the bridge's radii, at the root and the rhinion, their centres forward by what they lose: the ridge's
  // front stays, the bridge narrows)
  // (`noseSize`: the parts' radii and their places about the tip, the wings and the subnasale, × k)
  const dd = R.dorsum, D = 1 + dd, k = 1 + R.noseSize;
  v('nose', at(P.n, { y: -0.02 - 0.018 * dd }), at(P.rhinion, { y: -0.018 - 0.02 * dd }), at(P.prn, { y: -0.03 * k }), [0.018 * D, 0.02 * D, 0.03 * k], 'nose');
  // THE NOSTRILS — one vajra each, placed from the nose's bottom (`nostrilRise`, `nostrilSet` put the alare over the
  // subnasale): the wing's base where it inserts into the lip → the alar lobule (its outer side IS the alare) → the
  // soft triangle beside the tip. Mirrored, with the columella between them; the space between a lobule and the
  // columella, roofed by the tip and the walls, is the nostril's opening seen from below. (The root sits just inside
  // the alare, so the lobule alone is the wing's widest: as wide, it stood a second bump behind the lobule.)
  const lobule = {}, soft3 = {};
  for (const s of ['L', 'R']) {
    const al = P[`al${s}`], sg = Math.sign(al.x);
    lobule[s] = at(al, { x: -sg * 0.018 * k, y: -0.006 * k });
    soft3[s] = { x: sg * 0.024 * k, y: P.prn.y - 0.036 * k, z: P.prn.z - 0.008 * k };
    v(`nostril${s}`, at(al, { x: -sg * 0.014 * k, y: -0.03 * k, z: -0.006 * k }), lobule[s], soft3[s], [0.012 * k, 0.018 * k, 0.012 * k], 'nose', [[`nose${s}`], [`nose${s}`], null]);
  }
  // THE ALAR BAR — lobule → under the subnasale → lobule: the nose's base, joining the nostrils. Its ends are the
  // lobules (the same bead and radius), so the wing's outer side stays the alare (ended at the alare itself, the bar
  // stood 5 mm outside each wing)
  v('alae', lobule.L, at(P.sn, { y: -0.02 * k, z: 0.005 * k }), lobule.R, [0.018 * k, 0.018 * k, 0.018 * k], 'nose', [['noseL'], ['noseC'], ['noseR']]);
  // THE SEPTUM — the nose's midline wall, from the columella's base up behind the bridge, inside the nose: it fills the
  // air the walls and the ridge close round (a pocket there showed in the profile, and opened to a line seen through
  // from the side as the cheek moved)
  v('septum', at(P.sn, { y: -0.004 * k, z: 0.012 * k }), at(mid(P.sn, P.rhinion, 0.5), { y: -0.02 * k }), at(P.rhinion, { y: -0.03 * k }), [0.01 * k, 0.012 * k, 0.01 * k], 'nose');
  // THE COLUMELLA — the strip under the tip from the subnasale to the tip's underside, so the nose is closed beneath
  // (without it the air under the tip showed through from the side)
  v('columella', at(P.sn, { y: -0.004 * k, z: 0.006 * k }), at(mid(P.sn, P.prn, 0.55), { y: -0.012 * k, z: -0.008 * k }), at(P.prn, { y: -0.032 * k, z: -0.012 * k }), [0.01 * k, 0.011 * k, 0.014 * k], 'nose');
  // THE SEPTUM — the midline wall filling the triangle between the mid-bridge, the subnasale and the tip, so the nose
  // is solid between its nostrils (without it the air inside the nose showed through from the side)
  { const tri = { x: 0, y: (P.rhinion.y + P.sn.y + P.prn.y) / 3 - 0.012 * k, z: (P.rhinion.z + P.sn.z + P.prn.z) / 3 };
    v('septumUp', at(P.rhinion, { y: -0.024 * k }), tri, at(P.sn, { y: -0.008 * k, z: 0.01 * k }), [0.016 * k, 0.02 * k, 0.012 * k], 'nose');
    v('septumTip', tri, mid(tri, at(P.prn, { y: -0.03 * k })), at(P.prn, { y: -0.034 * k, z: -0.006 * k }), [0.02 * k, 0.018 * k, 0.016 * k], 'nose'); }
  // THE SIDEWALLS — from each wing up to the mid-bridge: angled cones, wide at the flare and narrowing as they rise,
  // so the nose is a pyramid (a ridge with two walls) and the wings read as wings where the walls meet them
  // (rooted in the lobule, a little above its centre and thinner than it, so the lobule is the wing's widest)
  const wallMid = {};
  for (const s of ['L', 'R']) {
    wallMid[s] = at(mid(P[`al${s}`], P.rhinion, 0.5), { x: -Math.sign(P[`al${s}`].x) * 0.016 * k, y: -0.022 * k });
    v(`noseWall${s}`, at(lobule[s], { y: -0.004 * k, z: 0.008 * k }), wallMid[s], at(P.rhinion, { y: -0.022 - 0.012 * dd }), [0.015 * k, 0.014 * k, 0.012 * D], 'nose');
  }
  // THE NOSE'S FLESH — one cone down the middle, narrow at the bridge and widening to the base over the wings: the
  // soft tissue over the cartilages, closing the grooves beside the ridge and the windows between each wing, its wall
  // and the tip. Its radius at the base is `noseFat` (thin and pinched to full and fleshy); the base sits on the
  // lobules' tops (it roofs the nostrils, never fills them) and behind the tip by its own radius, so a fatter nose is
  // wider and fuller but no longer: the tip's projection stays its own relation, and al-al the wings'
  const fat = R.noseFat, wingTop = Math.max(lobule.L.z, lobule.R.z) + 0.018 * k;
  const base = { x: 0, y: P.prn.y - 0.009 - fat, z: wingTop + 0.6 * fat };
  v('noseFlesh', at(mid(P.n, P.rhinion, 0.5), { y: -0.024 - 0.012 * dd }), mid(at(P.rhinion, { y: -0.012 }), base, 0.5), base, [0.012 * D, 0.6 * fat, fat], 'nose');
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
    v(`upperLip${s}`, at(P[`ch${s}`], { y: -0.014 }), at(P[`bow${s}`], { y: -0.016, z: -0.008 }), upC, [0.006, 0.016 * F, 0.022 * F], 'lips', [[`corner${s}`], [`bow${s}`], ['lipUpC']]);
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
  // wing's root (the nostril's first bead), clear of it, its edge blended over ~3 mm, so the root's own round end is the
  // wing's heel: cut across the wing in front of the root, it left the root standing outside the groove as a curled
  // flap, and cut into the root's back, it met the root's flat underside in a point
  for (const s of ['L', 'R']) {
    const sg = Math.sign(P[`al${s}`].x), lb = lobule[s];
    cut(`alarCrease${s}`, at(lb, { x: sg * 0.022, y: -0.026, z: 0.012 }), at(lb, { x: sg * 0.016, y: -0.036, z: -0.004 }), at(lb, { x: sg * 0.004, y: -0.042, z: -0.018 }), [0.003, 0.004, 0.003], null, 0.012);
  }
  // (the line parts the lips as far forward as their fullness carries them, and as deep)
  cut('lipLine', at(P.chL, { y: 0.002 }), { ...P.sto, y: P.ls.y - 0.001 + (F - 1) * 0.022 }, at(P.chR, { y: 0.002 }), [0.003, 0.005 * F, 0.003], [['cornerL'], ['lipLineC'], ['cornerR']]);
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
  browInner: 'the frontalis\'s medial belly: the brows\' inner ends lifted, the outer kept (the worried brow), the upper lids\' peak drawn in',
  browOuter: 'the frontalis\'s lateral belly: the brow\'s outer end lifted, the inner kept (FACS AU2; a side by L / R)',
  wide: 'the levator: the upper lids lifted off the iris, the white showing over it (a side by L / R)',
  squint: 'the orbicularis\'s lower fibres: the lower lids raised and drawn flat, the upper a touch down (a side by L / R)',
  cheekRaise: 'the orbicularis oculi\'s outer ring: the cheek lifted and bunched under the eye, the lower lid pushed up (FACS AU6; a side by L / R)',
  sneer: 'the levator labii superioris alaeque nasi: the nostrils and the wings drawn up, the upper lip with them, the brows\' inner ends down (FACS AU9; a side by L / R)',
  upperLipUp: 'the levator labii superioris: the upper lip raised at its sides, over the canines (FACS AU10; a side by L / R)',
  dimple: 'the buccinator: the mouth\'s corner drawn back into the cheek, the dimple (FACS AU14; a side by L / R)',
  frown: 'the depressor anguli oris: the mouth\'s corner pulled down (FACS AU15; a side by L / R)',
  lowerLipDown: 'the depressor labii inferioris: the lower lip drawn down and out (FACS AU16; a side by L / R)',
  chinRaise: 'the mentalis: the lower lip pushed up and out from under, the chin\'s skin bunched (FACS AU17)',
  stretch: 'the risorius and the platysma: the mouth\'s corners pulled out to the sides, the lips flattened (FACS AU20; a side by L / R)',
  tighten: 'the orbicularis oris: the lips narrowed and drawn in, their red thinned (FACS AU23)',
  press: 'the orbicularis oris: the lips pressed together, rolled in on each other (FACS AU24; a side by L / R)',
  pucker: 'the incisivii: the lips pushed forward and drawn in to a small round, the corners toward the midline (FACS AU18: the oo, the w)',
  funnel: 'the orbicularis oris: the lips pushed forward and turned out, the upper up and the lower down, a round opening between them (FACS AU22: the sh, the ch, the o)',
  rollUpper: 'the orbicularis oris: the upper lip rolled in and back over the upper teeth (FACS AU28, the upper lip)',
  rollLower: 'the orbicularis oris: the lower lip drawn up and back under the upper incisors\' edge (FACS AU28, the lower lip: the f, the v)',
  lipsPart: 'the lips parted at their middle, the teeth still together: the upper lip lifted a little and the lower let down (FACS AU25: the s, the t, the e)',
  blink: 'the upper lids close over the globes (both)', blinkL: 'the left lid only', blinkR: 'the right lid only',
  ...Object.fromEntries(['browLower', 'browOuter', 'wide', 'squint', 'cheekRaise', 'sneer', 'upperLipUp', 'dimple', 'frown', 'lowerLipDown', 'stretch', 'press']
    .flatMap((k) => ['L', 'R'].map((s) => [`${k}${s}`, `the ${k}, the figure's ${s === 'L' ? 'left' : 'right'} side only`]))),
  smileEyes: 'the share of a smile\'s squint the eyes take (the lower lid raised and rounded), 0 … 1; absent, all of it',
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
  // (the lower lip's centre: drawn down by the depressors, pushed up and out by the mentalis)
  const lowerDownC = (side('lowerLipDown', 'L') + side('lowerLipDown', 'R')) / 2, chinUp = a('chinRaise');
  // THE LIPS' MIDDLES IN SPEECH (the upper's centre, `lipUpC`; the lower's, `lipStretch`): pushed forward by the pucker and
  // the funnel (the funnel turning them out, the upper up and the lower down), rolled in by the rolls (the lower up and back
  // under the upper incisors), parted by `lipsPart`; the lip line's middle (`lipLineC`) rides between them
  const pk = a('pucker'), fn = a('funnel'), ru = a('rollUpper'), rl = a('rollLower'), lp = a('lipsPart');
  const upC = [[{ x: 0, y: 0.035, z: -0.004 }, pk], [{ x: 0, y: 0.03, z: 0.016 }, fn], [{ x: 0, y: -0.02, z: -0.012 }, ru], [{ x: 0, y: 0.002, z: 0.016 }, lp]];
  const loC = [[{ x: 0, y: 0.035, z: 0.006 }, pk], [{ x: 0, y: 0.03, z: -0.018 }, fn], [{ x: 0, y: -0.022, z: 0.016 }, rl], [{ x: 0, y: 0.002, z: -0.02 }, lp]];
  const terms = (p, T) => T.reduce((q, [d, t]) => (t ? add(q, d, t) : q), p);
  D.lipStretch = (p) => terms(add(add(add(jawAt(1)(p), { x: 0, y: -1, z: 0 }, 0.025 * a('jaw')), { x: 0, y: 0.004, z: -0.022 }, lowerDownC), { x: 0, y: 0.01, z: 0.014 }, chinUp), loC);
  D.lipUpC = (p) => terms(p, upC);
  D.lipUpHalf = (p) => terms(p, upC.map(([d, t]) => [d, t / 2]));
  D.lipLineC = (p) => terms(jawAt(0.5)(p), [...upC, ...loC].map(([d, t]) => [d, t / 2]));
  // (the nose's base, between its wings, drawn up by both sneers)
  const sneerC = (side('sneer', 'L') + side('sneer', 'R')) / 2;
  D.noseC = (p) => add(p, { x: 0, y: -0.003, z: 0.01 }, sneerC);
  const sum = (p, terms) => terms.reduce((q, [d, t]) => (t ? add(q, d, t) : q), p);
  for (const s of ['L', 'R']) {
    const sm = side('smile', s), ch = P[`ch${s}`], o = P[`zy${s}`];
    // the smile's pull: from the corner toward the muscle's origin, 10 mm at full
    const pull = (() => { const d = { x: o.x - ch.x, y: o.y - ch.y, z: o.z - ch.z }, l = Math.hypot(d.x, d.y, d.z) || 1; return { x: d.x / l, y: d.y / l, z: d.z / l }; })();
    // THE MOUTH'S OTHER MUSCLES, each a displacement of the corner, the upper lip's bow and the lower lip's middle,
    // V units (+x the figure's right, +y forward, +z up); the side's own sign `cx` turns "out" outward
    const cx = Math.sign(ch.x), f15 = side('frown', s), f20 = side('stretch', s), f14 = side('dimple', s), f24 = side('press', s);
    const f10 = side('upperLipUp', s), f9 = side('sneer', s), f16 = side('lowerLipDown', s), f23 = a('tighten');
    D[`corner${s}`] = (p) => sum(add(jawAt(0.45)(p), pull, 0.045 * sm), [
      [{ x: cx * 0.004, y: -0.006, z: -0.026 }, f15], [{ x: cx * 0.03, y: -0.008, z: -0.006 }, f20], [{ x: cx * 0.006, y: -0.016, z: 0.002 }, f14],
      [{ x: 0, y: -0.004, z: 0 }, f24], [{ x: -cx * 0.006, y: -0.002, z: 0 }, f23], [{ x: 0, y: 0, z: 0.006 }, f10], [{ x: 0, y: 0, z: -0.004 }, chinUp],
      [{ x: -cx * 0.045, y: 0.03, z: 0 }, pk], [{ x: -cx * 0.022, y: 0.012, z: 0 }, fn], [{ x: 0, y: -0.003, z: 0 }, ru], [{ x: 0, y: -0.003, z: 0.002 }, rl]]);
    D[`bow${s}`] = (p) => sum(add(jawAt(0.1)(p), pull, 0.02 * sm), [
      [{ x: 0, y: 0, z: -0.006 }, f15], [{ x: cx * 0.008, y: -0.002, z: -0.003 }, f20], [{ x: 0, y: -0.006, z: -0.008 }, f24],
      [{ x: 0, y: -0.003, z: -0.004 }, f23], [{ x: 0, y: 0.002, z: 0.02 }, f10], [{ x: 0, y: 0, z: 0.01 }, f9],
      [{ x: -cx * 0.022, y: 0.032, z: -0.004 }, pk], [{ x: -cx * 0.004, y: 0.026, z: 0.014 }, fn], [{ x: 0, y: -0.014, z: -0.008 }, ru], [{ x: 0, y: 0, z: 0.012 }, lp]]);
    D[`loMid${s}`] = (p) => sum(add(add(jawAt(0.75)(p), pull, 0.02 * sm), { x: 0, y: -1, z: 0 }, 0.02 * a('jaw')), [
      [{ x: 0, y: 0.002, z: -0.006 }, f15], [{ x: cx * 0.008, y: -0.002, z: 0.003 }, f20], [{ x: 0, y: -0.006, z: 0.01 }, f24],
      [{ x: 0, y: -0.002, z: 0.004 }, f23], [{ x: cx * 0.004, y: 0.004, z: -0.024 }, f16], [{ x: 0, y: 0.008, z: 0.012 }, chinUp],
      [{ x: -cx * 0.022, y: 0.032, z: 0.006 }, pk], [{ x: -cx * 0.004, y: 0.026, z: -0.016 }, fn], [{ x: 0, y: -0.016, z: 0.012 }, rl], [{ x: 0, y: 0, z: -0.016 }, lp]]);
    D[`zyg${s}`] = (p) => add(p, pull, 0.02 * sm);
    // the nostril and its wing drawn up and back by the sneer
    D[`nose${s}`] = (p) => add(p, { x: 0, y: -0.005, z: 0.018 }, f9);
    // the balloon's bulge: pushed by the corner into the cheekbone, it bunches UP and FORWARD (not along the pull,
    // which runs back toward the bone); a little of the jaw; its swell is its own volume
    // (and the cheek raiser bunches it up under the eye, as a smile's does)
    D[`bulge${s}`] = (p) => add(add(jawAt(0.25)(p), { x: 0, y: 0.6, z: 0.8 }, 0.022 * sm), { x: 0, y: 0.004, z: 0.014 }, side('cheekRaise', s));
    // the brow: raised straight up; lowered down, forward a touch, and toward the midline
    const sg = Math.sign(P[`fz${s}`].x);
    // (the inner raise leaves the brow's tail, and sinks it a touch: the brow tilts, inner end up; the outer raise lifts
    // the tail alone)
    D[`brow${s}`] = (p) => sum(add(add(add(p, { x: 0, y: 0, z: 0.03 }, a('browRaise')), { x: -sg * 0.012, y: 0.004, z: -0.02 }, side('browLower', s)), { x: 0, y: 0, z: -0.004 }, a('browInner')),
      [[{ x: 0, y: 0, z: 0.03 }, side('browOuter', s)]]);
  }
  // (the brows' middle: each side's lowering, and the sneer's procerus, pull half of it)
  const half = (k) => (side(k, 'L') + side(k, 'R')) / 2;
  D.browC = (p) => sum(add(add(add(p, { x: 0, y: 0, z: 0.022 }, a('browRaise')), { x: 0, y: 0.006, z: -0.016 }, half('browLower')), { x: 0, y: 0.002, z: 0.026 }, a('browInner')),
    [[{ x: 0, y: 0.002, z: -0.008 }, half('sneer')]]);
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

/**
 * THE EAR — a plate in the shape of the operator's sketch (head-ear.js `EAR_OUTLINE`: unit height, `u` forward, `v` up,
 * about the bowl), in three pieces: the concha on the head, the outer ear folded off it at the antihelix
 * (`earProtrusion`), the lobule free or attached (`earlobe`);
 * its relief on the front face as vajras: the helix rim chained along the outline (the lobule fuller), the antihelix's
 * Y (its stem from the antitragus, its two crura), the tragus and the antitragus; the concha carved into it, and the
 * canal a blind dimple at its floor. Its place is relational: the top at the brow (`earTop`), the lobule level with the
 * nose's base (`earBottom`), the long axis leaning back from vertical by `earTilt` degrees, the hinge on the
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
  const t = (R.earTilt * Math.PI) / 180, ct = Math.cos(t), st = Math.sin(t);
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
const BLEND = { bone: 0.04, soft: 0.03, nose: 0.012, lipBody: 0.05, lips: 0.01, teeth: 0.0006, tongue: 0.012 };
/** how each soft feature joins the skin */
const JOIN = { soft: 0.04, nose: 0.02, lipBody: 0.016, lips: 0.012, ear: 0.01 };
/** the head's layers: the skull alone, or the skin over it */
export const HEAD_LAYERS = Object.freeze(['skin', 'skull']);

/**
 * The relational head: { field, landmarks, bounds, points, vajras, targets } in STAND units, the same shape
 * `head-field-view.js` reads (`headFieldOf`). `sex` picks the pole; `relations` replaces ratios over it; `layer` is
 * `skin` (the default) or `skull`. `targets` are the relations' own measurements, in mm, for the calipers to meet.
 * `tune` places the wave's internal points: `true` solves them (`solveTune`, cached), an object gives them.
 * `actions` are the activations of the face's action relationships (`ACTIONS`), applied over the tuned rest; `eyes`
 * is the eyes' spec (head-relational-eye.js: a word, channels, a side's own), the actions adding to it. `paint(p)`
 * names a surface point's part (the globe's 'sclera' | 'iris' | 'pupil'; null the skin). `ears: false` leaves the ears out
 * of the field (a surface sampled by rays from inside cannot carry a plate standing off the head: the hero's head,
 * hero-relational-head.js); the landmarks keep the ear canal where the ears would hang it. `globes: false` leaves the
 * eyes' globes out of the field (the lids, their opening and the socket behind it kept): a skin netted whole would
 * otherwise join each lid's margin to the globe it rests on in one surface, and pinch there; `globes` hands each
 * globe's own field and paint, to be built as its own part (hero-relational-head.js's one skin). `seat: true` rests
 * the lids on the globes (head-relational-eye.js `SEAT`): the skin about each opening cut back to the lid shell, so no
 * tunnel stands between the lids' margins and the eye (realistic laws 11); `seat: 2` also runs the space under the brow as
 * one section (`SEAT.section`, realistic laws 13).
 */
export function relationalHead({ sex = 'male', relations = {}, layer = 'skin', tune = null, actions = null, eyes = null, ears: withEars = true, globes: withGlobes = true, seat = false } = {}) {
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
    return { name: w.name, group: w.group, blend: w.blend, skullOnly: !!w.skullOnly, f: (p) => SM.min(sdRoundCone(p, a, c, ra, rc), sdRoundCone(p, c, b, rc, rb)), lo: { x: Math.min(a.x, c.x, b.x) - Math.max(ra, rc, rb), y: Math.min(a.y, c.y, b.y) - Math.max(ra, rc, rb), z: Math.min(a.z, c.z, b.z) - Math.max(ra, rc, rb) }, hi: { x: Math.max(a.x, c.x, b.x) + Math.max(ra, rc, rb), y: Math.max(a.y, c.y, b.y) + Math.max(ra, rc, rb), z: Math.max(a.z, c.z, b.z) + Math.max(ra, rc, rb) } };
  });
  // the teeth are many small crowns: a box about them all, so the field skips them away from the mouth
  const teethBonds = bonds.filter((b) => b.group === 'teeth' || b.group === 'tongue'), tm = 0.02 * sc;
  const teethBox = teethBonds.length ? { lo: { x: Math.min(...teethBonds.map((b) => b.lo.x)) - tm, y: Math.min(...teethBonds.map((b) => b.lo.y)) - tm, z: Math.min(...teethBonds.map((b) => b.lo.z)) - tm }, hi: { x: Math.max(...teethBonds.map((b) => b.hi.x)) + tm, y: Math.max(...teethBonds.map((b) => b.hi.y)) + tm, z: Math.max(...teethBonds.map((b) => b.hi.z)) + tm } } : null;
  // the orbits: cones opening forward round each globe, deep enough to hold it with room for the fat behind it
  const orbits = ['L', 'R'].map((s) => ({ a: S({ ...P[`eye${s}`], y: P[`eye${s}`].y - 0.005 }), b: S({ ...P[`eye${s}`], y: P[`eye${s}`].y - 0.15 }), ra: 0.068 * sc, rb: 0.04 * sc }));
  // (a closed mouth's lip line is cut even, after the skin: `seam` below; the carve's own tube, its depth swinging with the
  // lips' curve back to the corners, is the open mouth's)
  const carves = bonds.filter((b) => b.group === 'carve' && !(b.name === 'lipLine' && !mouth));
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
  const skinField = (p, bare = false) => {
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
    const nearTeeth = teethBox && p.x >= teethBox.lo.x && p.x <= teethBox.hi.x && p.y >= teethBox.lo.y && p.y <= teethBox.hi.y && p.z >= teethBox.lo.z && p.z <= teethBox.hi.z;
    for (const b of bonds) {
      if (b.group === 'carve' || b.skullOnly || ((b.group === 'teeth' || b.group === 'tongue') && !nearTeeth)) continue;
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
    // (BARE: the skin wave alone, no feature joined and nothing cut: what the face's parts lie over)
    if (bare) return d;
    for (const k of ['nose', 'lipBody', 'lips']) if (g[k] !== undefined) d = smin(d, g[k], JOIN[k] * sc);
    // the grooves and the mouth cut from the skin (the eyes are their own rig, set in after)
    for (const c of carves) d = smax(d, -c.f(p), (c.blend ?? 0.003) * sc);
    if (mouthF) d = smax(d, -mouthF(p), 0.006 * sc);
    // the teeth and the tongue, seen only through the mouth: clipped to the carved cavity's neighbourhood, so another carve
    // (the mentolabial fold over the lower incisors' roots) never bares them; with the mouth closed they are not joined
    // (each crown joins the next with an all but hard edge, so the teeth read as teeth, not a band; the tongue is its own
    // mass beside them)
    if (mouthF) for (const k of ['teeth', 'tongue']) if (g[k] !== undefined) d = SM.min(d, smax(g[k], mouthF(p) - 0.002 * sc, 0.001 * sc));
    return d;
  };
  // THE EARS — hinged on the skin: probe the head's own surface along the hinge's line, then hang each ear on it
  const hung = skin ? ['L', 'R'].map((s) => {
    const sg = s === 'L' ? -1 : 1, probe = rayIn(skinField, { x: 0, y: (Pt.porionR.y + 0.03) * sc, z: Pt.porionR.z * sc }, [sg, 0, 0]);
    const baseX = (probe ? Math.abs(probe.x) / sc : Pt.porionR.x) - 0.004;   // sunk a touch into the skin, so it welds
    const e = earPart(Pt, rel, s, baseX);
    return { side: s, f: (p) => e.f({ x: p.x / sc, y: p.y / sc, z: p.z / sc }) * sc, carve: (p) => e.carve({ x: p.x / sc, y: p.y / sc, z: p.z / sc }) * sc, top: S(e.top), tragion: S(e.tragion) };
  }) : [];
  const ears = withEars ? hung : [];
  // THE EYES — their own rig (head-relational-eye.js): the `eyes` spec (a word, channels, a side's own), and the
  // head's actions on top — a blink shuts the lid, a smile raises and rounds the lower lid (the squint of a real
  // smile), a raised brow lifts the upper lid, a lowered one drops it and flattens it
  const act = (k) => Math.max(0, Math.min(1, Number(actions?.[k]) || 0));
  // the brow's fold hangs from the forehead's bridge by strings; the brow pad's action pulls them (its medial bead the
  // medial strings, each lateral bead its side's)
  const shift = (k) => ({ x: Vn.browPad[k].x - Rn.browPad[k].x, z: Vn.browPad[k].z - Rn.browPad[k].z });
  // (seated, the eyes come `SEAT.forward` of the way from the cornea to the nose's tip, their corneas kept behind the
  // glabella: their globes, lids and lashes, not the socket or the skin about it, which the seat cuts back to the lids)
  const Pe = seat ? { ...Pt, ...Object.fromEntries(['L', 'R'].flatMap((s) => {
    const [share, behind] = seat === 2 ? SEAT.forwardOut : SEAT.forward, y = Pt[`eye${s}`].y, dy = Math.max(0, Math.min(share * (Pt.prn.y - y), Pt.g.y - behind - y));
    return ['eye', 'en', 'ex'].map((k) => [`${k}${s}`, { ...Pt[`${k}${s}`], y: Pt[`${k}${s}`].y + dy }]);
  })) } : Pt;
  const bridge = skin ? browBridge(Pe, { med: shift('c'), L: shift('a'), R: shift('b') }, { seat }) : null;
  const eyeRigs = skin ? ['L', 'R'].map((s) => {
    const sm = Math.min(1, act('smile') + act(`smile${s}`)) * (actions && 'smileEyes' in actions ? act('smileEyes') : 1), bl = Math.min(1, act('blink') + act(`blink${s}`));
    // a gaze target (`look`, metres from between the eyes) becomes this eye's yaw and pitch, aimed from its own centre;
    // a side's own gaze still wins over it
    let spec = eyes;
    if (eyes && typeof eyes === 'object' && eyes.look) {
      const mid = { x: (Pe.eyeL.x + Pe.eyeR.x) / 2, y: (Pe.eyeL.y + Pe.eyeR.y) / 2, z: (Pe.eyeL.z + Pe.eyeR.z) / 2 };
      const M = 1 / (HEAD_V * 1.8);   // metres → head heights
      const to = { x: mid.x + eyes.look.x * M, y: mid.y + eyes.look.y * M, z: mid.z + eyes.look.z * M };
      spec = { ...eyes, ...lookAngles({ ...Pe[`eye${s}`], y: Pe[`eye${s}`].y - GLOBE.back }, to) };
    }
    // (and the eyes' own: `wide` lifts the upper lid off the iris, `squint` raises the lower and draws it flat, the inner
    // brow draws the upper lid's peak in, the worried lid)
    // (a side's own: `wideL` the left alone; the cheek raiser pushes the lower lid up from below, rounded)
    const per = (k) => Math.min(1, act(k) + act(`${k}${s}`)), wd = per('wide'), sq = per('squint'), bi = act('browInner'), bl0 = per('browLower'), cr = per('cheekRaise'), bo = per('browOuter');
    // (a blink lifts the lower lid a little, `0.12`: the lids meet a touch below the eye's middle, the lower travelling a
    // millimetre or so of the upper's ten, so the upper has that much less to roll)
    const c = resolveEye(spec, s, { lower: 0.6 * sm + 0.35 * sq + 0.3 * cr + 0.12 * bl, lowerShape: 0.3 * sm - 0.4 * sq + 0.2 * cr, open: 0.25 * act('browRaise') - 0.12 * bl0 + 0.5 * wd - 0.06 * sq + 0.08 * bi + 0.1 * bo - 0.05 * cr,
      upperShape: -0.3 * bl0 - 0.2 * sq, upperPeak: -0.45 * bi + 0.25 * bo, crease: 0.3 * wd });
    c.open *= 1 - bl;
    const r = eyeRig(Pe, s, c, rel.fissure, bridge.arcs[s], rel.lidSplit, { seat });
    const V = (p) => ({ x: p.x / sc, y: p.y / sc, z: p.z / sc });
    const near = (p) => Math.hypot(p.x / sc - r.bound.c.x, p.y / sc - r.bound.c.y, p.z / sc - r.bound.c.z) < r.bound.r;
    return { side: s, near, channels: c, gaze: r.gaze, margins: r.margins, globeV: r.globe, lids: (p) => r.lids(V(p)) * sc,
      lidSpace: (p) => r.lidSpace(V(p)) * sc, seat: r.seat && ((p) => r.seat(V(p)) * sc), opening: r.opening && ((p) => r.opening(V(p)) * sc), rims: (p) => r.rims(V(p)) * sc,
      crease: r.crease && ((p) => r.crease(V(p)) * sc), globe: (p) => r.globe(V(p)) * sc, paint: (p) => r.paint(V(p)), irisTone: (p) => r.irisTone(V(p)) };
  }) : [];
  // THE FURROWS (`furrows`, an old forehead's deep folds as shape, so an engine's light casts them and the profile shows
  // them): three across the forehead where the skin's lines run (dermal-map.js dermalDetail), each a tube laid along the
  // skin, probed from inside the head, sunk so a shallow sliver cuts, deepest at its middle and thinning to nothing at its
  // ends, its edge blended soft. Absent, nothing.
  // (placed by the landmarks, `P`: where the skin's own glabella and brow lie, as the skin's paint reads them; the tuned
  // points are the masses' moved to put it there)
  const furrows = skin && rel.furrows > 0 ? (() => {
    const mm = MM_V * sc, half = Math.abs(P.fzR.x) * sc - 4 * mm, R = 2.6 * mm, tubes = [];
    for (let k = 0; k < 3; k++) {
      const z0 = P.g.z * sc + (13 + 8 * k) * mm, depth = rel.furrows * (k === 1 ? 0.8 : 0.6) * mm, pts = [];
      for (let i = 0; i <= 10; i++) {
        const x = -half + (2 * half * i) / 10, z = z0 + 1.4 * mm * Math.sin(Math.abs(x) / (9 * mm) + k * 1.7), hit = rayIn(skinField, { x, y: P.g.y * sc - 0.08 * sc, z }, [0, 1, 0]);
        if (!hit) continue;
        const t = Math.sin(Math.PI * (i / 10)) ** 0.7;
        // (sunk along the skin's own normal there: a forehead slopes back, and a tube set straight forward cut above its line)
        const e = 0.2 * mm, gn = ['x', 'y', 'z'].map((k) => skinField({ ...hit, [k]: hit[k] + e }) - skinField({ ...hit, [k]: hit[k] - e })), gl = Math.hypot(...gn) || 1, o = R - depth * t;
        pts.push({ x: hit.x + (gn[0] / gl) * o, y: hit.y + (gn[1] / gl) * o, z: hit.z + (gn[2] / gl) * o });
      }
      if (pts.length > 2) tubes.push(pts);
    }
    const seg = (p, a, b) => { const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, l2 = bx * bx + by * by + bz * bz || 1e-12, u = Math.max(0, Math.min(1, ((p.x - a.x) * bx + (p.y - a.y) * by + (p.z - a.z) * bz) / l2)); return Math.hypot(p.x - a.x - bx * u, p.y - a.y - by * u, p.z - a.z - bz * u); };
    const box = { lo: P.g.z * sc + 5 * mm, hi: P.g.z * sc + 40 * mm };
    return { blend: 1.6 * mm, f: (p) => { if (p.z < box.lo || p.z > box.hi || p.y < P.g.y * sc - 0.08 * sc) return Infinity; let d = Infinity; for (const T of tubes) for (let i = 0; i + 1 < T.length; i++) d = Math.min(d, seg(p, T[i], T[i + 1])); return d - R; } };
  })() : null;
  // THE SEAM of a closed mouth: the line between the lips cut to ONE depth all along it (`SEAM`), so it is drawn evenly:
  // the lips' fronts probed across the mouth (the line's place the valley where they meet, its depth from the less
  // prominent lip's front), a thin tube laid along it, sunk by the same depth everywhere, fading out at the corners. The
  // lip line's own carve (deep at the middle, shallow toward the corners, nothing where thin lips part from it) left a
  // groove under a surface net's cell in places, drawn as a row of dark notches. An open mouth keeps its carve.
  const seam = skin && !mouth ? (() => {
    const mm = MM_V * sc, ch = Math.abs(Pt.chR.x) * sc, tube = [], R = SEAM.radius * mm;
    const front = (x, z) => { let y = Pt.sto.y * sc + 20 * mm; while (skinField({ x, y, z }) > 0 && y > Pt.sto.y * sc - 25 * mm) y -= 0.25 * mm; let lo = y, hi = y + 0.25 * mm; for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (skinField({ x, y: m, z }) > 0) hi = m; else lo = m; } return (lo + hi) / 2; };
    for (let i = 0; i <= 16; i++) {
      const u = -1 + (2 * i) / 16, x = u * (ch - 1.5 * mm), zc = (Pt.sto.z + (Pt.chR.z - Pt.sto.z) * u * u) * sc;
      const rows = Array.from({ length: 13 }, (_, k) => { const z = zc + (k - 6) * 0.4 * mm; return { z, y: front(x, z) }; });
      const valley = rows.slice(3, 10).reduce((a, r) => (r.y < a.y ? r : a)), lips = Math.min(Math.max(...rows.slice(0, 4).map((r) => r.y)), Math.max(...rows.slice(9).map((r) => r.y)));
      const depth = SEAM.depth * mm * (1 - smoothstep(0.75, 1, Math.abs(u)) * 0.7);
      tube.push({ x, y: lips + R - depth, z: valley.z });
    }
    const seg = (p, a, b) => { const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, l2 = bx * bx + by * by + bz * bz || 1e-12, u = Math.max(0, Math.min(1, ((p.x - a.x) * bx + (p.y - a.y) * by + (p.z - a.z) * bz) / l2)); return Math.hypot(p.x - a.x - bx * u, p.y - a.y - by * u, p.z - a.z - bz * u); };
    const lim = { x: ch + 4 * mm, z: [Math.min(...tube.map((q) => q.z)) - 6 * mm, Math.max(...tube.map((q) => q.z)) + 6 * mm] };
    return { blend: SEAM.blend * mm, f: (p) => { if (Math.abs(p.x) > lim.x || p.z < lim.z[0] || p.z > lim.z[1]) return Infinity; let d = Infinity; for (let i = 0; i + 1 < tube.length; i++) d = Math.min(d, seg(p, tube[i], tube[i + 1])); return d - R; } };
  })() : null;
  const field = ears.length || eyeRigs.length ? (p) => {
    let d = skinField(p);
    if (seam) { const c = seam.f(p); if (c < seam.blend * 4) d = smax(d, -c, seam.blend); }
    if (furrows) { const c = furrows.f(p); if (c < furrows.blend * 4) d = smax(d, -c, furrows.blend); }
    for (const e of ears) { const ef = e.f(p); if (ef !== Infinity) d = smin(d, ef, JOIN.ear * sc); }
    for (const e of ears) { const c = e.carve(p); if (c !== Infinity) d = smax(d, -c, 0.004 * sc); }
    for (const e of eyeRigs) {
      if (!e.near(p)) continue;
      // the lid space cut back out of the skin, the lids' mass on it, the opening carved through it to the globe, the
      // margins and the roll laid on, the crease cut, the globe set in
      d = smax(d, -e.lidSpace(p), 0.005 * sc);
      if (e.seat) d = smax(d, -e.seat(p), SEAT.blend * sc);
      d = smin(d, e.lids(p), 0.008 * sc);
      if (e.opening) d = smax(d, -e.opening(p), 0.0025 * sc);
      d = smin(d, e.rims(p), 0.004 * sc);
      if (e.crease) d = smax(d, -e.crease(p), 0.002 * sc);
      if (withGlobes) d = smin(d, e.globe(p), 0.0015 * sc);
    }
    return d;
  } : skinField;
  // what a surface point is painted: the globe's parts, or the skin (null)
  const paint = (p) => { for (const e of eyeRigs) if (e.near(p)) { const t = e.paint(p); if (t) return t; } return null; };
  // the paint's tone there (×, about 1): the iris's pattern; 1 elsewhere
  const paintTone = (p) => { for (const e of eyeRigs) if (e.near(p)) { const t = e.irisTone(p); if (t !== 1) return t; } return 1; };
  // the names head-field-view's calipers read (figure-head.js's landmark names), from the core points
  const s = 0.9 * (sc / 0.1265);
  const W = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, S(p)]));
  const landmarks = {
    ...W, H: sc, s,
    glabella: W.g, nasion: W.n, noseBridge: W.rhinion, subnasale: W.sn, noseTip: W.prn, stomion: W.sto, menton: W.me,
    zygionR: W.zyR, gonionR: W.goR, alaR: W.alR,
    tragionR: hung.length ? hung[1].tragion : { ...W.porionR, y: W.porionR.y - 0.01 * sc },
    earTopR: hung.length ? hung[1].top : { ...W.porionR, z: W.g.z }, eyeL: W.eyeL, eyeR: W.eyeR,
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
  // the eyes' gaze, and their vergence (the angle between the two lines of sight; 0 parallel, larger the nearer)
  const vergence = eyeRigs.length === 2 ? Math.round((Math.acos(Math.max(-1, Math.min(1, eyeRigs[0].gaze.x * eyeRigs[1].gaze.x + eyeRigs[0].gaze.y * eyeRigs[1].gaze.y + eyeRigs[0].gaze.z * eyeRigs[1].gaze.z))) * 1800) / Math.PI) / 10 : null;
  // (`relational` hands what grows on the head its relations in head heights: the tuned points, the vajras at rest and
  // as the actions moved them, and the eyes' lash lines — the epidermis lays its hair by them)
  const relational = {
    V: sc, points: Pt, rest: byName(rest), moved: byName(vajras), eyes: eyeRigs.map((e) => e.channels),
    // the brow's bridge, strings and arcs (V), and the eye rigs' lash lines and globes, for the lashes
    bridge,
    // (the seat's level: 2 the brow of one section, realistic laws 13, whose brow's arch is the rounder, epidermis.js browLine)
    ...(seat ? { seat } : {}),
    eyeRigs: eyeRigs.map((e) => ({ side: e.side, channels: e.channels, margins: e.margins, globe: e.globeV, ...(e.seat ? { seated: true } : {}) })),
  };
  // the skin wave alone (no nose, lips, lip line, eyes or ears: what a head sampled feature by feature lies over), and
  // each ear's own field, its bowl and canal cut (the ear alone, not joined to the head)
  const bare = skin ? (p) => skinField(p, true) : null;
  const earFields = hung.map((e) => ({ side: e.side, field: (p) => { const d = e.f(p); if (d === Infinity) return d; const c = e.carve(p); return c === Infinity ? d : smax(d, -c, 0.004 * sc); }, top: e.top, tragion: e.tragion }));
  // each eye's globe as its own field (STAND units), its paint and its tone, and its centre and look
  const globes = eyeRigs.map((e) => ({ side: e.side, field: e.globe, paint: e.paint, tone: e.irisTone, near: e.near, gaze: e.gaze, centre: S({ ...Pe[`eye${e.side}`], y: Pe[`eye${e.side}`].y - GLOBE.back }) }));
  return { field, bare, earFields, paint, paintTone, landmarks, bounds, points: W, vajras, relations: rel, targets, tuning, actions: actions || {}, jaw, mouth, eyes: eyeRigs.map((e) => e.channels), vergence, relational, globes };
}
