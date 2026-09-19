/**
 * figure-head — the protoform's HEAD as a signed-distance field of NAMED anatomical
 * primitives, surfaced into ONE closed ring stack (`headEgg`).
 *
 * Before this the head was two overlapping open tubes: a 3-bead vajra egg and a tapered
 * "face mask" sleeve pushed forward of it. They z-fought where they crossed, the crown and
 * the underside were holes (a ring stack is capped at neither end), male and female were
 * byte-identical, and there was no brow, orbit, nose, cheek, jaw or chin. This module is
 * the head as anatomy:
 *
 *   field   braincase, frontal, occiput, brow, orbits (subtracted), zygomatics, maxilla,
 *           nasal, lips, mandible + ramus + chin + submandibular floor (the JAW group), ears —
 *           smooth-unioned (`smin`), so parts melt into one skin the way the welded animal
 *           skull does. Every primitive is placed off HEAD LANDMARKS in a local frame.
 *   pole    `dim.head` (figure-rig.js DIMORPH): the sex axis of the skull — brow, jaw width,
 *           chin point, forehead slope, cranial roundness, nose, cheek fullness, size, neck.
 *           Male = identity, female = the locked basis; per-region `proto` knobs multiply.
 *   jaw     structured INSIDE the field, not in the armature: `face.jaw` rotates the jaw
 *           group about a hinge through the condyles (ahead of the ears) before the field is
 *           evaluated; `face.mouth` subtracts a lip slot that follows it. The 17-node manji,
 *           LIMITS, the packed rig and the VRM map are untouched.
 *   march   LATITUDE rings from a centre inside the braincase (`marchLatitude`), so both
 *           poles close by construction — no cap fans, no degenerate last ring — and the
 *           ring currency the hair / hat / garment / skin-seam / spine-warp code reads is
 *           kept. The march is star-shaped from the centre: the jaw undercut and the brow
 *           over the orbit survive; the underside of the nose tip and the ear's back flatten
 *           (the surface-net path over the same field has no such limit — the print lane).
 *
 * Local frame (STAND units at headScale 1): origin = the menton (under the chin) on the head
 * axis, +z up the head bone, +y the face, +x the figure's right. `headRings` maps the rings
 * into the posed bone frame (`boneFrame(headBase, headTop)`, the same frame the old egg used)
 * scaled by `headScale` about headBase, so the head still nods and tilts with the head/neck
 * DOF and the child↔adult lever still works.
 *
 * Deterministic: pure loops in a fixed order; no dice, no Date. Dial absent or at its
 * default → the same primitives → the same bytes.
 */
import { smin, smax, sdRoundCone } from './vajra.js';

// Per-region knobs a `proto` may carry (1 = canonical; multipliers on the pole).
export const HEAD_KNOB_DEFAULTS = Object.freeze({
  browRidge: 1,      // brow-ridge projection (the strongest sex cue)
  jawWidth: 1,       // bigonial width — the jaw corners
  chinPoint: 1,      // >1 narrows the chin to a point, <1 squares it
  noseSize: 1,       // nose projection + tip
  noseWidth: 1,      // the alae (nostril wings) — the nose's width at its base
  noseDroop: 1,      // how far the tip hangs below the dorsum line (the hook; 0 = a straight nose)
  cheekbone: 1,      // zygomatic width
  cheek: 1,          // the soft cheek under the cheekbone (the malar pad + the jowl blend)
  foreheadSlope: 1,  // >1 slopes the forehead back, <1 stands it vertical
  earSize: 1,        // the ear, in its OWN plane + its rim thickness (the standoff does not scale)
  eyeSize: 1,        // the eyeball and the palpebral fissure it shows through
  neckGirth: 1,      // neck column girth
});
export const HEAD_KNOB_NAMES = Object.freeze(Object.keys(HEAD_KNOB_DEFAULTS));

// The default pole — a male head. `dim.head` overrides per sex (figure-rig.js).
export const HEAD_POLE_DEFAULT = Object.freeze({
  brow: 1, jawWidth: 1, jawDrop: 1, chinPoint: 1, chinSize: 1, foreheadSlope: 1,
  cranialRound: 1, noseSize: 1, noseWidth: 1, noseDroop: 1, cheekbone: 1, cheek: 1, size: 1, neckGirth: 1,
});

// Head height menton → crown at headScale 1 (STAND). The old egg spanned 0.157; the crown
// sits a touch lower now and the skull is rounder, so hair and hats seat where they did.
export const HEAD_H = 0.152;
// Global size of the field about its landmarks (the first sheet read ~10 % large against the body).
const HEAD_SIZE = 0.90;
// Where the menton sits along the head bone, below headBase (the atlas): the old egg's chin
// ring bottomed out 0.033 under headBase, so the skull keeps its seat on the neck.
const MENTON_DROP = -0.033;
// Latitude-march tessellation and the ray bound (must exceed the head's radius from the centre).
// 44 around, BIASED to the face: the around-samples are spaced by θ = φ − FRONT_BIAS·sin(φ − π/2),
// so the face (θ = 90°, +y) gets 1/(1 − FRONT_BIAS) = 2× the density and the nape half as much.
// At 36 uniform the whole nose base spanned one or two samples, so no nose could have two alae
// and a tip. Rays are kept cheap (24 coarse steps + 14 bisections) to pay for it.
// 52 latitudes: at 40 a ring spanned ~6 mm at the face, so a 4 mm lip line fell between rings.
const N_LAT = 52, M_AROUND = 44, MARCH_BOUND = 0.15, FRONT_BIAS = 0.5;
// Jaw range, degrees. Beyond ~30° a human jaw dislocates; the field would just stretch.
export const JAW_MAX_DEG = 30;
// The jaw's REST rotation about the condyle hinge, degrees (negative = lifted): the mandible sits
// closed-up against the maxilla, the chin brought up and forward under the lower lip; `face.jaw`
// opens from here. At −3° the chin fell away under the lips and the profile read as an overbite.
const JAW_REST_DEG = -8;

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const vlen = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d) => (Number.isFinite(v) ? v : d);

// ── primitives (signed, negative inside) ──
const sdSphere = (p, c, r) => vlen(sub(p, c)) - r;
// ellipsoid bound (right sign + zero set; the same form field-terms.js uses)
function sdEllip(p, c, r) {
  const q = { x: (p.x - c.x) / r.x, y: (p.y - c.y) / r.y, z: (p.z - c.z) / r.z };
  const k0 = vlen(q), k1 = vlen({ x: q.x / r.x, y: q.y / r.y, z: q.z / r.z });
  return k0 * (k0 - 1) / (k1 || 1);
}
const sdCapsule = (p, a, b, r) => sdRoundCone(p, a, b, r, r);

/**
 * Resolve a `face` dial set: { jaw (deg, 0..JAW_MAX_DEG), mouth (0..1, default follows the
 * jaw), brow (−1..1, lowers/raises the brow ridge) }. Absent → all zero.
 */
export function resolveFace(face) {
  const f = face && typeof face === 'object' ? face : {};
  const jaw = clamp(num(f.jaw, 0), 0, JAW_MAX_DEG);
  const mouth = clamp(num(f.mouth, jaw / 25), 0, 1);
  const brow = clamp(num(f.brow, 0), -1, 1);
  return { jaw, mouth, brow };
}

/**
 * The head's landmarks in the local frame, for a pole + knobs — the points every primitive
 * is placed off, and what the head chart measures. Fractions of HEAD_H along the bone.
 */
export function headLandmarks(pole = HEAD_POLE_DEFAULT, knobs = HEAD_KNOB_DEFAULTS) {
  const k = { ...HEAD_POLE_DEFAULT, ...pole }, K = { ...HEAD_KNOB_DEFAULTS, ...knobs };
  const s = k.size * HEAD_SIZE, H = HEAD_H * s;
  const fs = k.foreheadSlope * K.foreheadSlope;
  const jw = k.jawWidth * K.jawWidth;
  const ns = k.noseSize * K.noseSize;
  const nw = k.noseWidth * K.noseWidth, nd = k.noseDroop * K.noseDroop;
  const cb = K.cheekbone;
  const es = K.earSize;
  // THE FACE PLANE is at y ≈ 0.070 (the maxilla's front, the brow's front, the lips). The nose
  // starts AT it and projects past it — a nose seated behind the plane is a lump, not a nose.
  const noseTip = { x: 0, y: (0.072 + 0.009 * ns) * s, z: (0.35 - 0.02 * nd) * H };
  // the ear's centre — what `earSize` scales the ear about (see earRootR below)
  const earC = { x: 0.0555 * s, y: -0.016 * s, z: 0.462 * H };
  const earPt = (x, y, z) => ({ x: x * s, y: earC.y + (y * s - earC.y) * es, z: earC.z + (z * H - earC.z) * es });
  return {
    H, s,
    menton:    { x: 0, y: 0.044 * s, z: 0.075 * H },
    stomion:   { x: 0, y: 0.068 * s, z: 0.225 * H },
    subnasale: { x: 0, y: 0.070 * s, z: 0.325 * H },
    noseTip,
    // the nose's structure: the bony bridge (a touch proud of the nasion→tip line), a SUPRATIP
    // break where the dorsum ends above and behind the tip ball (the hook), the alae (nostril
    // wings, lower and wider than the tip), the columella back to the subnasale — flat, so the
    // nose has an UNDERSIDE — and the nostril bar between the alae
    noseBridge: { x: 0, y: (0.068 + 0.003 * ns) * s, z: 0.47 * H },
    supratip:  { x: 0, y: noseTip.y - 0.004 * s, z: noseTip.z + 0.012 * s },
    alaL:      { x: -0.0090 * nw * s, y: noseTip.y - 0.009 * s, z: noseTip.z - 0.003 * s },
    alaR:      { x:  0.0090 * nw * s, y: noseTip.y - 0.009 * s, z: noseTip.z - 0.003 * s },
    nasion:    { x: 0, y: 0.064 * s, z: 0.585 * H },
    glabella:  { x: 0, y: 0.056 * s, z: 0.62 * H },
    eyeL:      { x: -0.028 * s, y: 0.070 * s, z: 0.545 * H },
    eyeR:      { x:  0.028 * s, y: 0.070 * s, z: 0.545 * H },
    zygionL:   { x: -0.038 * cb * s, y: 0.026 * s, z: 0.50 * H },
    zygionR:   { x:  0.038 * cb * s, y: 0.026 * s, z: 0.50 * H },
    gonionL:   { x: -0.033 * jw * s, y: -0.006 * s, z: (0.30 - 0.05 * k.jawDrop) * H },
    gonionR:   { x:  0.033 * jw * s, y: -0.006 * s, z: (0.30 - 0.05 * k.jawDrop) * H },
    // the condyle sits UNDER the zygomatic arch — the back of the jaw is never wider than the cheek
    condyleL:  { x: -0.038 * s, y: -0.012 * s, z: 0.47 * H },
    condyleR:  { x:  0.038 * s, y: -0.012 * s, z: 0.47 * H },
    // the soft cheek: below + in front of the cheekbone, level with the nose base, toward the mouth corner
    cheekL:    { x: -0.027 * s, y: 0.052 * s, z: 0.38 * H },
    cheekR:    { x:  0.027 * s, y: 0.052 * s, z: 0.38 * H },
    // the buccal plane: a flat mass lateral to the mouth, so the corners merge into the face
    buccalL:   { x: -0.031 * s, y: 0.046 * s, z: 0.238 * H },
    buccalR:   { x:  0.031 * s, y: 0.046 * s, z: 0.238 * H },
    jowlL:     { x: -0.034 * s, y: 0.008 * s, z: 0.30 * H },
    jowlR:     { x:  0.034 * s, y: 0.008 * s, z: 0.30 * H },
    tragionL:  { x: -0.050 * s, y: -0.010 * s, z: 0.47 * H },
    tragionR:  { x:  0.050 * s, y: -0.010 * s, z: 0.47 * H },
    // the forehead: fs = 1 (male) is an upright brow with a modest slope, fs → 0 (female) vertical
    // THE EAR (right; the group is built once and evaluated at |x|). The helix ROOT is the
    // anterior anchor at the tragion; the rim arcs up-and-BACK to the superior helix, bows
    // widest posteriorly at mid-height, and drops to the lobule under the tragus. Canon: the
    // rim's outer edge spans the glabella line (top) to the subnasale (bottom).
    // `earSize` scales the ear about EAR_C in its OWN plane (y, z) only — x, the standoff, is
    // left alone on purpose: the head's WIDTH is ear-driven (the skull is narrower than the ear
    // at this height), so growing the standoff spends the width band that guards the skull.
    earC,
    earRootR:  earPt(0.054, -0.006, 0.455),
    earTopR:   earPt(0.057, -0.018, 0.570),
    earBackR:  earPt(0.057, -0.032, 0.450),
    earLobeR:  earPt(0.054, -0.010, 0.374),
    frontal:   { x: 0, y: (0.015 + 0.012 * (1 - fs)) * s, z: (0.705 - 0.025 * fs) * H },
    cranium:   { x: 0, y: -0.010 * s, z: 0.665 * H },
    occiput:   { x: 0, y: -0.034 * s, z: 0.62 * H },
    crown:     { x: 0, y: -0.010 * s, z: H },
    centre:    { x: 0, y: 0.006 * s, z: 0.52 * H },
  };
}

/**
 * The head field for a pole + knobs + face dials. Returns { field, centre, landmarks }.
 * `field(p)` is negative inside, in the LOCAL frame.
 */
export function buildHeadField({ pole = HEAD_POLE_DEFAULT, knobs = HEAD_KNOB_DEFAULTS, face = null } = {}) {
  const k = { ...HEAD_POLE_DEFAULT, ...pole }, K = { ...HEAD_KNOB_DEFAULTS, ...knobs };
  const F = resolveFace(face);
  const L = headLandmarks(k, K);
  const s = L.s, H = L.H;
  const brow = k.brow * K.browRidge;
  const ns = k.noseSize * K.noseSize, nw = k.noseWidth * K.noseWidth;
  const cp = k.chinPoint * K.chinPoint, cs = k.chinSize;

  // THE JAW HINGE — rotate a local point about the condyle axis (parallel to x, through the
  // condyles) by −jaw degrees: the chin swings DOWN and BACK, as a mandible does.
  const hinge = L.condyleL;   // any point on the axis; x is irrelevant
  const rotJaw = (p, deg) => {
    if (!deg) return p;
    const th = (deg * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
    const y = p.y - hinge.y, z = p.z - hinge.z;
    return { x: p.x, y: hinge.y + y * ct + z * st, z: hinge.z - y * st + z * ct };
  };
  // BONE rides the rest rotation + the open dial; SOFT tissue (the lower lip, the mouth slot) is
  // placed at rest where it belongs and rides the open dial only — the rest rotation lifts the
  // front of the mandible ~8 mm, which put the lower lip ABOVE the upper lip when it rode too.
  const jawed = (p) => rotJaw(p, F.jaw + JAW_REST_DEG);
  const jawedSoft = (p) => rotJaw(p, F.jaw);

  const adds = [], subs = [], noseAdds = [], lipAdds = [], fineSubs = [];
  let keelOf = null, keelK = 0;   // the dorsal ridge joins the nose TIGHTER than the nose blends internally
  const sphere = (c, r) => adds.push((p) => sdSphere(p, c, r));
  const ellip = (c, r) => adds.push((p) => sdEllip(p, c, r));
  const cone = (a, b, ra, rb) => adds.push((p) => sdRoundCone(p, a, b, ra, rb));
  const capsule = (a, b, r) => adds.push((p) => sdCapsule(p, a, b, r));
  // the NOSE GROUP blends within itself at a much tighter radius than the face, so the alae, the
  // tip and the columella stay three lobes instead of one bell; the group joins the face softly
  const nSphere = (c, r) => noseAdds.push((p) => sdSphere(p, c, r));
  const nEllip = (c, r) => noseAdds.push((p) => sdEllip(p, c, r));
  const nCone = (a, b, ra, rb) => noseAdds.push((p) => sdRoundCone(p, a, b, ra, rb));
  const nCapsule = (a, b, r) => noseAdds.push((p) => sdCapsule(p, a, b, r));

  // braincase — rounder on the female pole
  ellip(L.cranium, { x: 0.050 * s * k.cranialRound, y: 0.060 * s, z: 0.058 * s * k.cranialRound });
  // frontal — the forehead (slope from the pole × knob)
  sphere(L.frontal, 0.042 * s);
  // occiput
  sphere(L.occiput, 0.036 * s);
  // brow ridge — a capsule across the glabella; `face.brow` lifts/lowers it a little
  const browZ = L.glabella.z + 0.006 * s * F.brow;
  capsule({ x: -0.032 * s, y: L.glabella.y, z: browZ }, { x: 0.032 * s, y: L.glabella.y, z: browZ }, (0.006 + 0.008 * brow) * s);
  // orbits — SUBTRACTED sockets at the eyes
  // the orbit cut is smaller now that a GLOBE fills the socket: at 0.017*s it left a moat of
  // bare cut around the eye that read as shadow rather than as an eye socket.
  for (const e of [L.eyeL, L.eyeR]) subs.push((p) => sdSphere(p, e, 0.0145 * s));
  // zygomatics — cheekbones
  for (const z of [L.zygionL, L.zygionR]) sphere(z, (0.012 + 0.004 * k.cheekbone) * s);
  // THE ZYGOMATIC ARCH — the bony bridge from the cheekbone back to just in front of the ear
  // canal. Without it the side of the face falls into a trough between the zygomatic and the
  // ear: 3.7 mm real on the bare male pole, which the ear DEEPENED to 4.5 mm (its rim rises to
  // 0.060*s right behind a floor at 0.050*s). Face bulk, so it joins at the face blend — a
  // smooth union in a concave junction only ADDS material, which is what filling a trough wants.
  for (const sg of [-1, 1]) {
    const Z = sg < 0 ? L.zygionL : L.zygionR, T = sg < 0 ? L.tragionL : L.tragionR;
    cone({ x: sg * 0.04 * s, y: Z.y - 0.002 * s, z: 0.5 * H },
         { x: sg * 0.044 * s, y: T.y + 0.004 * s, z: 0.474 * H },
         0.0095 * s, 0.01 * s);
  }
  // THE MASSETER — the chewing muscle over the ramus, from under the arch down to the jaw
  // angle, rounding the LOWER back cheek so the side of the jaw is a plane and not a hollow.
  // Static, not on the jaw group: it spans skull to mandible, and the jowl already rides the jaw.
  for (const sg of [-1, 1]) ellip({ x: sg * 0.0415 * s, y: 0.012 * s, z: 0.375 * H }, { x: 0.0065 * s, y: 0.013 * s, z: 0.0175 * s });
  // THE SOFT CHEEK — the malar pad under the cheekbone (rounds the ¾ silhouette, softens the
  // nasolabial line) and a jowl blend just above the jaw corner so the cheek flows into the jaw.
  // The pad is the APPLE of the cheek: under the cheekbone, forward of the maxilla so it stands
  // proud (a pad seated at the maxilla's depth was buried in the blend and showed nowhere), one
  // CONVEX mass whose inner, lower edge runs in to the outer base of the nose (~8 mm from the
  // midline) with no concave section between the two — the cheek's curve and the nose's curve
  // meet, they are not separated by a cut. Every row of the depth map from the cheek to the nose
  // is monotone. (History: a pad reaching the mouth put a bulge beside it that the lip wings
  // dipped behind; no pad read as sullen; a subtracted nasolabial band between pad and nose read
  // as a cavity and every latitude ring through it zigzagged.)
  // The jowl rides the jaw group so an open mouth does not tear the cheek. `cheek` = pole × knob.
  const ck = k.cheek * K.cheek;
  for (const c of [L.cheekL, L.cheekR]) ellip(c, { x: 0.019 * ck * s, y: 0.018 * ck * s, z: 0.024 * ck * s });
  // THE BUCCAL PLANE — a flat, soft mass either side of the mouth (the lower inner cheek) that
  // the lip corners end inside, so the mouth reads as part of the face and not a feature sitting
  // in a hollow between the cheek pads. Thin and lateral, like the pad: it seats the corners, it
  // does not stand beside them.
  for (const b of [L.buccalL, L.buccalR]) ellip(b, { x: 0.011 * s, y: 0.007 * s, z: 0.016 * s });
  for (const j of [L.jowlL, L.jowlR]) sphere(jawed(j), 0.013 * ck * s);
  // maxilla — the face plane, below the eyes to the upper lip
  cone({ x: 0, y: 0.030 * s, z: 0.56 * H }, { x: 0, y: 0.040 * s, z: 0.22 * H }, 0.040 * s, 0.032 * s);
  // THE NOSE — articulated, not one cone: a narrow bony bridge from the nasion (a dip under the
  // brow) to a slightly proud mid-dorsum, a fuller cartilage dorsum to the tip, a tip ball, two
  // alae flanking it lower and wider (`noseWidth`), and a columella back to the subnasale so the
  // base has an edge in profile. All convex additions — the star-shaped march keeps them; only
  // the nostril underside (an overhang) is beyond the display path.
  cone(L.nasion, L.noseBridge, 0.0075 * s, 0.0085 * s);                                      // the bony bridge joins the face softly
  nCone(L.noseBridge, L.supratip, 0.0085 * s, 0.0085 * ns * s);
  // the nasal bones' sides: two lobes flanking the mid-dorsum widen the bridge LATERALLY without
  // pushing it forward (a wider cone would), so the dorsum is more than one ring sample wide
  for (const sg of [-1, 1]) nSphere({ x: sg * 0.0055 * s, y: L.noseBridge.y - 0.0035 * s, z: L.noseBridge.z }, 0.0065 * s);
  // THE TIP LOBE — an ELLIPSOID, not a ball: narrower in x than the sphere it replaces
  // (0.0080 vs 0.0088) and fuller in y and z, so the tip gains projection and vertical body
  // WITHOUT widening the nose. A bigger ball would have done both, and at kNose the fatter
  // ball swallows the alae — the group is three lobes (tip, two alae) precisely so it does
  // not read as one bell. Same trick as the ear rim pads: volume on the axes you can spend.
  nEllip(L.noseTip, { x: 0.0052 * ns * s, y: 0.012 * ns * s, z: 0.007 * ns * s });
  for (const a of [L.alaL, L.alaR]) nSphere(a, 0.0060 * nw * s);                             // the two alae
  // THE INFRATIP LOBULE — a small lobe under and behind the tip, so the tip has a BODY
  // between its apex and the columella instead of a facet dropping straight to the base.
  // The march cannot show a true overhang (a ray from the braincase centre never sees the
  // nostril underside), so this is volume the display path CAN reach, not a real undercut.
  nSphere({ x: 0, y: L.noseTip.y + -0.0012 * ns * s, z: L.noseTip.z + -0.0082 * ns * s }, 0.0058 * ns * s);
  nCone(L.noseTip, L.subnasale, 0.0055 * s, 0.0045 * s);                                     // the columella: the underside's edge
  nCapsule({ x: -0.006 * nw * s, y: L.alaL.y - 0.002 * s, z: L.alaL.z - 0.004 * s }, { x: 0.006 * nw * s, y: L.alaR.y - 0.002 * s, z: L.alaR.z - 0.004 * s }, 0.0036 * s);   // the nostril bar
  // THE DORSAL KEEL — the pyramid's EDGE. The nose reads flat-fronted because its cross-
  // section is flat-topped (peakedness 0.10 against ~0.5 for a true pyramid): the profile
  // barely falls from the midline out to x = 0.006*s. A thin ridge on the midline peaks it
  // and gives the dorsum one continuous line from the bridge to the tip. It costs no width
  // (its radius is a fifth of the nose's half-width), and j=11 of every ring lands exactly
  // on θ = 90°, so the ridge is carried by a real vertex rather than falling between samples.
  { const a = { x: 0, y: L.noseBridge.y + 0.0026 * s, z: L.noseBridge.z }, b = { x: 0, y: L.noseTip.y + 0.0044 * ns * s, z: L.noseTip.z + 0.007 * ns * s };
    const ra = 0.0034 * s, rb = 0.004 * ns * s, kk = 0.0015 * s;
    keelOf = (p) => sdRoundCone(p, a, b, ra, rb); keelK = kk; }
  // the ALAR CREASES — a shallow groove either side of the tip, from the supratip down to the
  // nostril, so the alae read as wings and not as part of the tip
  for (const sg of [-1, 1]) fineSubs.push({ k: 0.0035 * s, f: (p) => sdCapsule(p, { x: sg * 0.0045 * s, y: L.noseTip.y - 0.004 * s, z: L.noseTip.z + 0.001 * s }, { x: sg * 0.0055 * s, y: L.noseTip.y - 0.009 * s, z: L.noseTip.z - 0.006 * s }, 0.0010 * s) });
  // THE PHILTRUM — a shallow groove in the SKIN between the nose and the upper lip, so the nose's
  // underside stands over a dip and reads as an overhang (its shadow), not as a fillet into the
  // lip. Its back face sits AT the skin (the nose–lip column is at y ≈ 0.088 here, the lips having
  // moved forward since it was placed at the maxilla's 0.072): a recess buried inside the head is
  // a pocket the latitude rays exit into early, and every ring through it zigzags.
  {
    const top = L.subnasale.z - 0.003 * s, bot = 0.282 * H, mid = (top + bot) / 2;   // ends above the upper lip
    const b = { x: 0.0045 * s, y: 0.0018 * s, z: (top - bot) / 2 }, c = { x: 0, y: 0.087 * s + b.y, z: mid }, rr = 0.0015 * s;
    fineSubs.push({ k: 0.006 * s, f: (p) => {
      const q = { x: Math.abs(p.x - c.x) - b.x, y: Math.abs(p.y - c.y) - b.y, z: Math.abs(p.z - c.z) - b.z };
      const o = { x: Math.max(q.x, 0), y: Math.max(q.y, 0), z: Math.max(q.z, 0) };
      return vlen(o) + Math.min(Math.max(q.x, q.y, q.z), 0) - rr;
    } });
  }
  // THE LIPS — built on ONE path: the MOUTH LINE, a wide upside-down W (an M) traced from inner
  // cheek to inner cheek — corners low and tucked back where the face curves away, rising to the
  // two peaks of the cupid's bow under the philtrum columns, dipping at the centre. The upper lip
  // is a curved sweep wrapped along that path (its bottom edge IS the line), the lower lip a
  // sweep hung under it, and the lip-line groove is cut along the same path, so all three agree.
  // Soft tissue rests in place and rides the open dial only (`jawedSoft`).
  const lipC = { x: 0, y: 0.070 * s, z: 0.232 * H };
  const M_PATH = [
    { x: -0.027 * s, y: 0.050 * s, z: 0.220 * H },   // left corner (inner cheek, inside the buccal plane)
    { x: -0.014 * s, y: 0.066 * s, z: 0.232 * H },
    { x: -0.006 * s, y: 0.072 * s, z: 0.240 * H },   // left peak of the bow
    { x:  0,         y: 0.0715 * s, z: 0.231 * H },  // the centre dip
    { x:  0.006 * s, y: 0.072 * s, z: 0.240 * H },   // right peak
    { x:  0.014 * s, y: 0.066 * s, z: 0.232 * H },
    { x:  0.027 * s, y: 0.050 * s, z: 0.220 * H },   // right corner
  ];
  const along = (pts, dz, dy, radii, push) => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; push({ x: a.x, y: a.y + dy, z: a.z + dz }, { x: b.x, y: b.y + dy, z: b.z + dz }, radii[i], radii[i + 1]); } };
  // the upper lip: centred above the line by its own radius so its bottom edge sits on the M;
  // full at the peaks and the tubercle, thinner at the corners — but not thin: the corners run
  // out to ±0.027 and keep some radius so the lip's side is a run-out into the cheek, not a
  // wall (the wall showed as a 7 mm step in every ring through the mouth)
  const upR = [0.0046, 0.0060, 0.0066, 0.0064, 0.0066, 0.0060, 0.0046].map((r) => r * s);
  along(M_PATH, 0.0058 * s, 0.0040 * s, upR, (a, b, ra, rb) => lipAdds.push((p) => sdRoundCone(p, a, b, ra, rb)));
  // the lower lip: hung under the line, fuller in the middle, following the M lightly, and
  // brought FORWARD to sit under the upper lip's overhang (a lower lip 6 mm behind the upper
  // read as an overbite; the line stays a ~2 mm shadow step)
  const loR = [0.0046, 0.0062, 0.0070, 0.0072, 0.0070, 0.0062, 0.0046].map((r) => r * s);
  const lowPath = M_PATH.map((q, i) => jawedSoft({ x: q.x, y: q.y + 0.006 * s, z: q.z - 0.0066 * s - (i === 3 ? 0.003 * H : 0) }));
  for (let i = 0; i < lowPath.length - 1; i++) lipAdds.push((p) => sdRoundCone(p, lowPath[i], lowPath[i + 1], loR[i], loR[i + 1]));
  // NO groove for the lip line: a cut along a rising-and-falling path crosses the latitude rings
  // obliquely and renders as a staircase of shards. The line is a SHADOW STEP instead — the
  // upper lip overhangs the lower by ~2.5 mm, so its underside darkens along the M.
  // the MENTOLABIAL SULCUS — the groove under the lower lip, so the lip is a band over the chin
  // and not one mass with it (rides the open dial with the lip)
  const sulL = jawedSoft({ x: -0.014 * s, y: 0.079 * s, z: 0.15 * H }), sulR = jawedSoft({ x: 0.014 * s, y: 0.079 * s, z: 0.15 * H });
  fineSubs.push({ k: 0.004 * s, f: (p) => sdCapsule(p, sulL, sulR, 0.0030 * s) });
  // THE JAW GROUP — mandible (gonion → menton), ramus (gonion → condyle), chin, floor.
  // The condyle end of the ramus stays on the hinge; everything else rotates with the jaw.
  for (const side of ['L', 'R']) {
    const G = jawed(L['gonion' + side]), C = L['condyle' + side];
    const M = jawed({ x: (side === 'L' ? -1 : 1) * 0.012 * s, y: 0.040 * s, z: 0.05 * H });
    cone(G, M, 0.014 * s, 0.014 * s);
    cone(G, C, 0.013 * s, 0.012 * s);
  }
  const chinC = jawed(L.menton);
  ellip(chinC, { x: 0.018 * cs / Math.sqrt(cp) * s, y: 0.014 * cs * s, z: 0.014 * cs * s });
  cone(jawed({ x: 0, y: 0.006 * s, z: 0.14 * H }), jawed({ x: 0, y: 0.030 * s, z: 0.05 * H }), 0.030 * s, 0.018 * s);
  // THE THROAT — the upper neck as part of the head field, so the underside is one smooth dome
  // (chin floor → throat → nape) instead of a step from the jaw floor to an empty nape. Without
  // it the last latitudes twist into sliver quads that read as spikes from above. The stub stays
  // inside the neck column's top ring (figure-proto's neckRings), which enters it.
  // A blob, not a stub: its bottom sits level with the closed chin, so an open jaw's chin drops
  // BELOW it and reads; the neck column (figure-proto's neckRings) enters it from below.
  cone({ x: 0, y: 0.000, z: 0.30 * H }, { x: 0, y: -0.002 * s, z: 0.10 * H }, 0.028 * s, 0.030 * s);
  // THE EAR — its own blend group, like the nose: at the face's 0.019*s blend an ear of any
  // shape melts into the temple, which is what the old single tragion lobe did (7 mm of width
  // and no feature). Organised VERTICALLY: the 52 latitudes give the ear ~13 rings top-to-
  // bottom, the 44 around-samples (biased to the face) only ~2.3 front-to-back, so the read
  // lives on the up-down axis and in the standoff. NO concha is subtracted: the un-filled
  // interior of the C already reads as the bowl, and a dish cut there punches inside the
  // temple line (measured −3 mm standoff, a 9.7 mm ring step — the philtrum pocket rule).
  // The rim is heaviest over the TOP and down the BACK, where a real helix curls thickest, and
  // thins to the root. The two pads that thicken it are FLATTENED in x and full in the ear's
  // plane: at the resolution above, volume spent on the lateral axis buys nothing but width,
  // and the head's width band is the guard on the whole skull.
  const es = K.earSize, EC = L.earC;
  const earPt = (x, y, z) => ({ x: x * s, y: EC.y + (y * s - EC.y) * es, z: EC.z + (z * H - EC.z) * es });
  const earAdds = [];
  const eCone = (a, b, ra, rb) => earAdds.push((p) => sdRoundCone(p, a, b, ra, rb));
  eCone(L.earRootR, L.earTopR, 0.0048 * es * s, 0.0062 * es * s);
  eCone(L.earTopR, L.earBackR, 0.0062 * es * s, 0.0065 * es * s);
  eCone(L.earBackR, L.earLobeR, 0.0065 * es * s, 0.0075 * es * s);
  // the SUPERIOR helix pad — flattened in x, full in the ear's plane: the rim reads thick over
  // the top without pushing the head's width out
  earAdds.push((p) => sdEllip(p, earPt(0.0555, -0.019, 0.556), { x: 0.005 * es * s, y: 0.011 * es * s, z: 0.009 * es * s }));
  // the POSTERIOR helix pad — the same trick down the back of the rim
  earAdds.push((p) => sdEllip(p, earPt(0.0555, -0.030, 0.487), { x: 0.005 * es * s, y: 0.008 * es * s, z: 0.015 * es * s }));
  // the pinna body — a thin plate inside the rim, so the C is a shell and not a loose hoop
  earAdds.push((p) => sdEllip(p, earPt(0.0495, -0.014, 0.458), { x: 0.0042 * es * s, y: 0.0105 * es * s, z: 0.014 * es * s }));
  // THE EYE — a globe in the orbit plus TWO C-WAVE LIDS, in its own group. The face blend is
  // 0.019*s (~17 mm real) and an eyeball is 24 mm, so at the face blend an eye of any shape is
  // a smooth lump; the nose and the ear needed the same treatment. Built on the RIGHT and
  // evaluated at |x|, and unioned AFTER the orbit subtraction — before it, the socket cut
  // erases the globe.
  //
  // Resolution governs the shape. At the eye a latitude ring is 5.9 mm real and an around-
  // sample 10.6 mm, so the globe spans 4.1 rings x 2.3 samples but the 10 mm palpebral fissure
  // spans 1.7 RINGS. An opening cannot be modelled: a gap that thin flickers between one and
  // two vertices along its length. So the fissure is a SHADOW STEP, exactly as the lip line is
  // (a cut along a curved near-horizontal path renders as a staircase of shards). The eye
  // reads as ridge / bulge / ridge down the rings that DO exist: lid, proud globe, lid.
  const eyeAdds = [];
  {
    // `eyeSize` grows the globe and the fissure together: a bigger eyeball behind the same lid
    // aperture only buries itself, and a wider aperture over the same globe shows the socket.
    const ez = K.eyeSize;
    const EC = { x: L.eyeR.x, y: 0.0485 * s, z: L.eyeR.z };
    const gR = 0.0092 * ez * s, shell = gR + 0.0015 * s, halfW = 0.0105 * ez * s, tilt = 0.0007 * ez * s;
    eyeAdds.push((p) => sdSphere(p, EC, gR));
    // a lid point: ride the ellipse across the fissure, then ride OUT onto the globe shell, so
    // the lid wraps the eyeball instead of sitting on a flat plate. Past the globe the sqrt
    // clamps to 0 and the canthi settle at the shell's equator, which is where they belong.
    const lidPt = (uDeg, h) => {
      const u = (uDeg * Math.PI) / 180, cx = Math.cos(u), sx = Math.sin(u);
      const x = EC.x + halfW * cx, z = EC.z + h * sx + tilt * cx;
      const d2 = (x - EC.x) * (x - EC.x) + (z - EC.z) * (z - EC.z);
      return { x, y: EC.y + Math.sqrt(Math.max(0, shell * shell - d2)), z };
    };
    // NOTE the sign: the lower lid's u runs 180..360 where sin(u) is already negative, so h
    // is POSITIVE for both lids. Negating it here puts the lower lid on top of the upper one.
    const sweep = (us, h, radii) => {
      const pts = us.map((u) => lidPt(u, h));
      for (let i = 0; i < pts.length - 1; i++) eyeAdds.push((p) => sdRoundCone(p, pts[i], pts[i + 1], radii[i], radii[i + 1]));
    };
    // the two C-WAVES. The upper lid's apex sits at 100° — NASAL of centre — and the lower's
    // nadir at 285° — LATERAL of it; that offset, with the canthal tilt above, is what parts an
    // eye from a symmetric almond, and it costs nothing but where the path points go.
    sweep([178.0, 140.0, 100.0, 55.0, 2.0], 0.005 * ez * s, [0.0012, 0.0022, 0.0026, 0.0022, 0.0012].map((r) => r * ez * s));
    sweep([182.0, 225.0, 285.0, 330.0, 358.0], 0.0042 * ez * s, [0.0012, 0.002, 0.0023, 0.0019, 0.0012].map((r) => r * ez * s));
  }
  const eyeC = { x: L.eyeR.x, y: 0.0485 * s, z: L.eyeR.z }, eyeR2 = (0.024 * s) ** 2;
  const nearEye = (p) => { const dx = Math.abs(p.x) - eyeC.x, dy = p.y - eyeC.y, dz = p.z - eyeC.z; return dx * dx + dy * dy + dz * dz < eyeR2; };
  const kEye = 0.0015 * s, kEyeJoin = 0.004 * s;
  // THE MOUTH — a lip slot between the upper lip and the (jawed) lower lip. Only when open:
  // `mouth` 0 subtracts nothing, so the bytes of a closed face never move.
  if (F.mouth > 0) {
    const upper = { x: 0, y: 0.080 * s, z: 0.236 * H }, lower = jawedSoft({ x: 0, y: 0.080 * s, z: 0.226 * H });
    const mid = mul(add(upper, lower), 0.5), gap = vlen(sub(upper, lower));
    // half-extents: across the mouth, a SHALLOW depth (a groove — the ring march orients normals as
    // if the surface were star-shaped, so a real cavity would render inside-out; a cavity belongs to
    // the surface-net lane), the lip gap tall.
    const b = { x: 0.022 * s, y: 0.0035 * s, z: gap * 0.5 + (0.001 + 0.003 * F.mouth) * s }, rr = 0.0015 * s;
    subs.push((p) => {
      const q = { x: Math.abs(p.x - mid.x) - b.x, y: Math.abs(p.y - mid.y) - b.y, z: Math.abs(p.z - mid.z) - b.z };
      const o = { x: Math.max(q.x, 0), y: Math.max(q.y, 0), z: Math.max(q.z, 0) };
      return vlen(o) + Math.min(Math.max(q.x, q.y, q.z), 0) - rr;
    });
  }

  // kJoin: the nose joins the face tighter than the face blends with itself, so the nasolabial
  // angle stays an angle (a wide join filled the space under the nose with a fillet).
  // kLipJoin: the LIPS join the face SOFTER than the nose does — at the nose's join width the
  // upper lip stood as a ridge with a steep flank either side (a trench between the mouth and
  // the cheek, from the ala down past the corner); a wider fillet lets the lip's wings run out
  // into the inner cheek. The lip line is a shadow step between the two lips, not a join, so it keeps.
  const kEar = 0.004 * s, kEarJoin = 0.01 * s;
  // the ear only matters near the ear: a mirrored bounding sphere skips its primitives elsewhere
  const earC = { x: 0.0555 * s, y: -0.016 * s, z: 0.462 * H }, earR2 = (0.055 * s) ** 2;
  const nearEar = (p) => { const dx = Math.abs(p.x) - earC.x, dy = p.y - earC.y, dz = p.z - earC.z; return dx * dx + dy * dy + dz * dz < earR2; };
  const kBlend = 0.019 * s, kNose = 0.004 * s, kLip = 0.006 * s, kJoin = 0.008 * s, kLipJoin = 0.018 * s, kCut = 0.010 * s;
  // the nose group + its creases only matter near the nose: a bounding sphere skips them for the
  // other ~90 % of ray samples (the group is a dozen small primitives — the march pays per sample)
  const noseC = { x: 0, y: L.noseTip.y - 0.012 * s, z: L.noseTip.z + 0.006 * s }, noseR2 = (0.045 * s) ** 2;
  const nearNose = (p) => { const dx = p.x - noseC.x, dy = p.y - noseC.y, dz = p.z - noseC.z; return dx * dx + dy * dy + dz * dz < noseR2; };
  const lipR2 = (0.045 * s) ** 2;
  const nearLips = (p) => { const dx = p.x - lipC.x, dy = p.y - lipC.y, dz = p.z - lipC.z; return dx * dx + dy * dy + dz * dz < lipR2; };
  const field = (p) => {
    let d = Infinity;
    for (const f of adds) { const dd = f(p); d = d === Infinity ? dd : smin(d, dd, kBlend); }
    const near = nearNose(p) || nearLips(p);
    if (near) {
      let dn = Infinity;
      for (const f of noseAdds) { const dd = f(p); dn = dn === Infinity ? dd : smin(dn, dd, kNose); }
      if (keelOf) dn = smin(dn, keelOf(p), keelK);   // the ridge, at its own width
      d = smin(d, dn, kJoin);
      let dl = Infinity;
      for (const f of lipAdds) { const dd = f(p); dl = dl === Infinity ? dd : smin(dl, dd, kLip); }
      d = smin(d, dl, kLipJoin);
    }
    if (nearEar(p)) {
      const q = { x: Math.abs(p.x), y: p.y, z: p.z };
      let de = Infinity;
      for (const f of earAdds) { const dd = f(q); de = de === Infinity ? dd : smin(de, dd, kEar); }
      d = smin(d, de, kEarJoin);
    }
    for (const f of subs) d = smax(d, -f(p), kCut);
    if (near) for (const c of fineSubs) d = smax(d, -c.f(p), c.k);   // the alar creases + the philtrum, each with its own softness
    // the eye goes in LAST: the orbit sphere above is a subtraction, and a globe unioned before
    // it would simply be cut away again.
    if (nearEye(p)) {
      const q = { x: Math.abs(p.x), y: p.y, z: p.z };
      let de = Infinity;
      for (const f of eyeAdds) { const dd = f(q); de = de === Infinity ? dd : smin(de, dd, kEye); }
      d = smin(d, de, kEyeJoin);
    }
    return d;
  };
  return { field, centre: L.centre, landmarks: L };
}

// ── the march ──
// march outward from `o` along `dir` to the first outside crossing (≤ bound)
function marchRadius(field, o, dir, bound) {
  const at = (t) => field(add(o, mul(dir, t)));
  const coarse = 24, step = bound / coarse;
  let lo = 0, hi = bound, found = false;
  for (let i = 1; i <= coarse; i++) { const t = i * step; if (at(t) > 0) { lo = (i - 1) * step; hi = t; found = true; break; } }
  if (!found) return bound;
  for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (at(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

/**
 * Latitude rings of the field's iso-surface about `centre`: ring i is the latitude
 * v_i = −π/2 + π (i + ½) / N (crown first), M+1 points around (the last repeats the first —
 * the ring-stack convention). Each ring's `center` sits on the vertical through `centre` at
 * the ring's mean height, so hair / hat readers get a radius-by-height profile and the
 * mesher's outward test agrees with the star-shaped march.
 */
export function marchLatitude(field, centre, { N = N_LAT, M = M_AROUND, bound = MARCH_BOUND, frontBias = FRONT_BIAS } = {}) {
  const rings = [];
  for (let i = 0; i < N; i++) {
    const v = Math.PI / 2 - Math.PI * (i + 0.5) / N, cv = Math.cos(v), sv = Math.sin(v);
    const poly = [];
    let zsum = 0;
    for (let j = 0; j <= M; j++) {
      const phi = (j / M) * Math.PI * 2;
      const a = phi - frontBias * Math.sin(phi - Math.PI / 2);   // denser at the face (+y), sparser at the nape
      const dir = { x: cv * Math.cos(a), y: cv * Math.sin(a), z: sv };
      const q = add(centre, mul(dir, marchRadius(field, centre, dir, bound)));
      poly.push(q); zsum += q.z;
    }
    rings.push({ center: { x: centre.x, y: centre.y, z: zsum / (M + 1) }, polyline: poly });
  }
  return rings;
}

// ── the bone frame (byte-equal to figure-proto's boneFrame / onBone) ──
function boneFrame(P, Q) {
  const up = norm(sub(Q, P)), yd = up.y;
  let fwd = norm({ x: -up.x * yd, y: 1 - up.y * yd, z: -up.z * yd });
  if (Math.hypot(fwd.x, fwd.y, fwd.z) < 1e-6) fwd = { x: 0, y: 1, z: 0 };
  const side = norm(cross(fwd, up));
  return { up, fwd, side };
}
const onBone = (anchor, f, a, fw, sd = 0) => ({
  x: anchor.x + f.up.x * a + f.fwd.x * fw + f.side.x * sd,
  y: anchor.y + f.up.y * a + f.fwd.y * fw + f.side.y * sd,
  z: anchor.z + f.up.z * a + f.fwd.z * fw + f.side.z * sd,
});

/**
 * The head as rings in STAND space on the posed armature `p` (needs headBase + headTop).
 * @param {object} p        posed landmark map
 * @param {object} [opts]   { hs = headScale, dim (DIMORPH pole; `dim.head` is the head pole),
 *                            knobs (proto), face (dials) }
 * @returns {{center:{x,y,z}, polyline:{x,y,z}[]}[]}  crown → chin, closed at both ends
 */
export function headRings(p, { hs = 1, dim = null, knobs = HEAD_KNOB_DEFAULTS, face = null } = {}) {
  const pole = dim && dim.head ? dim.head : HEAD_POLE_DEFAULT;
  const { field, centre } = buildHeadField({ pole, knobs, face });
  const local = marchLatitude(field, centre);
  const f = boneFrame(p.headBase, p.headTop);
  const place = (q) => onBone(p.headBase, f, (MENTON_DROP + q.z) * hs, q.y * hs, q.x * hs);
  return local.map((r) => ({ center: place(r.center), polyline: r.polyline.map(place) }));
}

/** The neck girth factor for a pole + knobs (the neck column reads it). */
export function neckGirthFactor(dim, knobs = HEAD_KNOB_DEFAULTS) {
  const pole = dim && dim.head ? dim.head : HEAD_POLE_DEFAULT;
  return (pole.neckGirth ?? 1) * num(knobs.neckGirth, 1);
}

/**
 * Tailor's measures of a built head stack (world units of the rings): height (crown → chin,
 * the lowest point of the FRONT quarter — the throat stub under the skull is not the head),
 * width, depth and the girth of the widest ring (the hat size). Null-safe: no stack → null.
 */
export function headMeasures(stack) {
  if (!stack || !stack.rings || !stack.rings.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = -Infinity, girth = 0;
  for (const r of stack.rings) {
    let per = 0;
    for (let j = 0; j < r.polyline.length; j++) {
      const q = r.polyline[j];
      if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
      if (q.z > maxZ) maxZ = q.z;
      if (j) per += vlen(sub(q, r.polyline[j - 1]));
    }
    if (per > girth) girth = per;
  }
  const chinZ = chinZOf(stack, 0.75, minY, maxY);
  return { height: maxZ - chinZ, width: maxX - minX, depth: maxY - minY, girth };
}
/** The chin: the lowest point in the front `frac` of the head's depth (¼ by default). */
export function chinZOf(stack, frac = 0.75, minY = null, maxY = null) {
  if (minY == null || maxY == null) { minY = Infinity; maxY = -Infinity; for (const r of stack.rings) for (const q of r.polyline) { if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y; } }
  const front = minY + frac * (maxY - minY);
  let z = Infinity;
  for (const r of stack.rings) for (const q of r.polyline) if (q.y >= front && q.z < z) z = q.z;
  return z;
}
