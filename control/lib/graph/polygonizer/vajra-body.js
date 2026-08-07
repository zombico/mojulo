/**
 * vajra-body — the vajra body + base skeleton.
 *
 * The VAJRA-SPACE layer over the locked MANJI structure
 * ([figure-vajra.js](./figure-vajra.js)). Per the three-space model
 * (manji = structure · vajra = waves + yin/yang · world = skin):
 *
 *   waves         — the central channel (the spine: chakra crossings + lumbar
 *                   lordosis / thoracic kyphosis + the loop over the skull into
 *                   the eyes), the cross-vajra X (shoulder → navel → opposite
 *                   hip, the frame), the lateral girdle vajras (rib / hip maps),
 *                   and the per-segment yin/yang double helix.
 *   chakras       — manifested where ≥2 center-vajras intersect: throat,
 *                   dantien (under the costal margin, on the spine), groin
 *                   (between the hip vajras; volumized when male).
 *   base skeleton — derived anatomically: the rib cage (ovoid egg-cage hung off
 *                   the kyphotic thoracic spine), the pelvis (basket whose floor
 *                   is the hip joints, anteriorly tilted), and the limb-root
 *                   articulations — femoral neck → greater trochanter at the hip
 *                   (the outermost edge), clavicle strut → deltoid cap at the
 *                   shoulder (the mirror; large head, shallow socket).
 *
 * Everything is figure-frame STAND units: positions in → geometry specs out
 * (`{ pts: Point3D[], stroke, width?, opacity? }` lines, or `{ name, c, r }`
 * chakra spheres). The renderer owns scale, projection, and paint. The manji
 * joint positions (passed in via `figureVajraSpecs` / the landmark map) are
 * never mutated here.
 *
 * Provenance: lite-template/integration/0609/figure-readable-envelope.plan.md
 * and the figure-readable-envelope spike.
 */

import { sampleVajra } from './vajra.js';
import { sampleTaiji } from './taiji.js';
import { figureVajraSpecs } from './figure-vajra.js';

// ─── Figure sex ────────────────────────────────────────────────────────
// Rule: a MALE figure volumizes the groin sphere (the genitalia mass at the
// pelvic floor); female leaves it as the bare chakra point.
export const SEX = 'male';
export const MALE = SEX === 'male';

// ─── Palette ─────────────────────────────────────────────────────────────
export const RIB = '#1f5e5a';     // shoulder girdle vajra / rib cage — teal
export const ORB = '#c08a2e';     // chakra spheres — amber
export const PEL = '#6a4a9c';     // hip girdle vajra / pelvis — violet
export const SPN = '#8a8074';     // spine centerline — taupe
export const CROSS_A = '#c0584a'; // left shoulder → node → right hip — warm
export const CROSS_B = '#3f7ba0'; // right shoulder → node → left hip — cool
export const BONE = '#b08a3a';    // canonical vajra bone — gold
export const YIN = '#3aa39b';     // flexor strand — teal
export const YANG = '#e0a92e';    // extensor strand — gold
export const FEMUR = '#a85f2c';   // limb-root articulation (femur / humerus) — rust

// ─── Body data ───────────────────────────────────────────────────────────
// Silhouette-shaping limb bellies (radii from the figure-flesh tuning).
export const SEGMENTS = [
  { a: 'shoulderL', b: 'elbowL', r: 0.0287, tw: 0.8 }, { a: 'elbowL', b: 'wristL', r: 0.0204, tw: 1.4 },
  { a: 'shoulderR', b: 'elbowR', r: 0.0287, tw: -0.8 }, { a: 'elbowR', b: 'wristR', r: 0.0204, tw: -1.4 },
  { a: 'hipL', b: 'kneeL', r: 0.0290, tw: 0.6 }, { a: 'kneeL', b: 'ankleL', r: 0.0396, tw: 0.9 },
  { a: 'hipR', b: 'kneeR', r: 0.0290, tw: -0.6 }, { a: 'kneeR', b: 'ankleR', r: 0.0396, tw: -0.9 },
];
const GIRDLE_TW = { shoulder: 0.5, hip: -0.5 };
const GIRDLES_YY = [
  { a: 'shoulderL', c: 'neckHub', b: 'shoulderR', tw: GIRDLE_TW.shoulder, r: 0.050, profile: 'capsule' },
  { a: 'hipL', c: 'pelvisHub', b: 'hipR', tw: GIRDLE_TW.hip, r: 0.058, profile: 'capsule' },
];

// ─── Math helpers ──────────────────────────────────────────────────────
export const lerp = (a, b, t) => a + (b - a) * t;
export function circleLoop(center, plane, r, n = 36) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
    if (plane === 'xy') out.push({ x: center.x + c, y: center.y + s, z: center.z });
    else if (plane === 'xz') out.push({ x: center.x + c, y: center.y, z: center.z + s });
    else out.push({ x: center.x, y: center.y + c, z: center.z + s });
  }
  return out;
}
export function sphereLoops(c, r) {
  return [circleLoop(c, 'xy', r), circleLoop(c, 'xz', r), circleLoop(c, 'yz', r)];
}
export function cubicBezier(a, b, c, d, n = 30) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t, k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
    out.push({ x: k0 * a.x + k1 * b.x + k2 * c.x + k3 * d.x, y: k0 * a.y + k1 * b.y + k2 * c.y + k3 * d.y, z: k0 * a.z + k1 * b.z + k2 * c.z + k3 * d.z });
  }
  return out;
}
// 2D convex hull (Andrew's monotone chain) over projected {x,y} points.
export function convexHull(pts) {
  const ps = pts.filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y)).slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (ps.length < 3) return ps;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const pt of ps) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop(); lower.push(pt); }
  const upper = [];
  for (let i = ps.length - 1; i >= 0; i--) { const pt = ps[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop(); upper.push(pt); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

// ─── Vajra / taiji builders ────────────────────────────────────────────
// A vajra over [proximal, center, distal], rendered as its wireframe rings.
export function vajraRingLines(proximal, center, distal, radii, stroke, crossSections) {
  const v = sampleVajra({
    proximal, center, distal,
    beads: { proximal: { radius: radii[0] }, center: { radius: radii[1] }, distal: { radius: radii[2] } },
    blend: 0.022, crossSections, samples: 16,
  });
  return v.rings.map((r) => ({ pts: r.polyline, stroke }));
}
// The yin/yang pole-strands of a taiji over [a, center, b] — the canonical
// double helix (flexor + extensor); the handed twist gives the helical lean.
export function yyStrands(a, center, b, twist, r) {
  const t = sampleTaiji({ yin: a, center, yang: b, twist, radius: r, profile: 'spindle', showEnvelope: false, crossSections: 40, samples: 8 });
  return [{ pts: t.strands.yin, stroke: YIN, width: 1.6 }, { pts: t.strands.yang, stroke: YANG, width: 1.6 }];
}

// ─── Cross-vajra frame ──────────────────────────────────────────────────
// The two cross vajras that block in the torso frame: each shoulder to the
// OPPOSITE hip, both crossing at the center node (the navel) — the contralateral
// X that orients the trunk. Each diagonal carries its own yin/yang strands.
export function crossVajraLines(p) {
  const C = p.navel;
  const radii = [0.034, 0.020, 0.030]; // thin center bead → cones to a waist at the node
  return [
    ...vajraRingLines(p.shoulderL, C, p.hipR, radii, CROSS_A, 26),
    ...vajraRingLines(p.shoulderR, C, p.hipL, radii, CROSS_B, 26),
    ...yyStrands(p.shoulderL, C, p.hipR, 1.0, 0.028),
    ...yyStrands(p.shoulderR, C, p.hipL, -1.0, 0.028),
  ];
}

// ─── Central channel — the canonical spine ─────────────────────────────
// Nodes (chakra crossings + curve apices + head loop), anchored to canonical
// joint heights. Anatomical spine bottom→top: sacrum (S1, tilted back) → LUMBAR
// LORDOSIS (forward, apex ≈ L3–L4 below the navel) → thoracolumbar core →
// THORACIC KYPHOSIS (back) → CERVICAL LORDOSIS (forward) → throat. Curve apices
// are the bezier centers between nodes.
export function centralChannelNodes(p) {
  const root = { x: 0, y: -0.028, z: p.pelvisHub.z };                          // sacrum, back
  const core = { x: 0, y: -0.005, z: p.navel.z };                             // thoracolumbar (back of core)
  const heart = { x: 0, y: -0.03, z: lerp(p.navel.z, p.neckHub.z, 0.62) };
  const throat = { x: 0, y: 0.025, z: lerp(p.neckHub.z, p.headTop.z, 0.45) };
  const lumbarC = { x: 0, y: 0.085, z: lerp(p.pelvisHub.z, p.navel.z, 0.42) }; // L3–L4 lordosis apex
  const thoracC = { x: 0, y: -0.05, z: lerp(p.navel.z, heart.z, 0.6) };        // kyphosis
  const cervC = { x: 0, y: 0.015, z: lerp(heart.z, throat.z, 0.5) };           // cervical lordosis
  const occiput = { x: 0, y: -0.05, z: lerp(throat.z, p.headTop.z, 0.7) };
  const crown = { x: 0, y: -0.01, z: p.headTop.z + 0.02 };
  const eyeZ = lerp(p.neckHub.z, p.headTop.z, 0.84);
  const eyeL = { x: -0.028, y: 0.055, z: eyeZ }, eyeR = { x: 0.028, y: 0.055, z: eyeZ };
  return { root, core, heart, throat, lumbarC, thoracC, cervC, occiput, crown, eyeL, eyeR };
}
export function centralChannelLines(p) {
  const out = [];
  const { root, core, heart, throat, lumbarC, thoracC, cervC, occiput, crown, eyeL, eyeR } = centralChannelNodes(p);
  // spine taiji chain — strands cross at each node
  const seg = (a, c, b, tw) => {
    const t = sampleTaiji({ yin: a, center: c, yang: b, twist: tw, radius: 0.024, profile: 'spindle', showEnvelope: false, crossSections: 40, samples: 8 });
    out.push({ pts: t.strands.yin, stroke: YIN, width: 1.8 });
    out.push({ pts: t.strands.yang, stroke: YANG, width: 1.8 });
  };
  seg(root, lumbarC, core, 1.0);
  seg(core, thoracC, heart, -1.0);
  seg(heart, cervC, throat, 1.0);
  // head loop — behind the skull, over the crown, into the eyes (yin → L, yang → R)
  out.push({ pts: cubicBezier(throat, occiput, crown, eyeL), stroke: YIN, width: 1.8 });
  out.push({ pts: cubicBezier(throat, occiput, crown, eyeR), stroke: YANG, width: 1.8 });
  // faint spine centerline through the curve nodes
  out.push({ pts: [root, lumbarC, core, thoracC, heart, cervC, throat, occiput, crown], stroke: SPN, opacity: 0.5 });
  return out;
}

// ─── Per-segment yin/yang double helix ─────────────────────────────────
// Limb bellies + the girdle waves (contralateral: shoulder +, hip −). The core
// is the central channel (above), which supersedes a straight core axis.
export function yinYangLines(p) {
  const out = [];
  const strands = (a, c, b, tw, r, profile) => {
    const t = sampleTaiji({
      yin: p[a], ...(c ? { center: p[c] } : {}), yang: p[b],
      twist: tw, radius: r, profile, showEnvelope: false, crossSections: 48, samples: 8,
    });
    out.push({ pts: t.strands.yin, stroke: YIN });
    out.push({ pts: t.strands.yang, stroke: YANG });
  };
  for (const s of SEGMENTS) strands(s.a, null, s.b, s.tw, s.r, 'spindle');
  for (const g of GIRDLES_YY) strands(g.a, g.c, g.b, g.tw, g.r, g.profile);
  return out;
}

// ─── Chakra spheres ──────────────────────────────────────────────────────
// Manifested where center-vajras intersect along the core.
export function chakras(p) {
  return [
    { name: 'throat', c: { x: 0, y: 0.01, z: lerp(p.neckHub.z, p.headTop.z, 0.28) }, r: 0.046 },
    // lower dantien — below the navel, deep in the lower belly, resting under the
    // costal margin with its back overlapping the spine (Mingmen behind, ~L2–L3).
    { name: 'dantien', c: { x: 0, y: 0.03, z: lerp(p.navel.z, p.pelvisHub.z, 0.40) }, r: 0.075 },
    // groin — nestled BETWEEN the hip vajras in the pelvic-floor space (the pubic
    // arch). Volumized when male.
    { name: 'groin', c: { x: 0, y: MALE ? 0.035 : 0, z: p.pelvisHub.z - 0.02 }, r: MALE ? 0.05 : 0.03 },
  ];
}
export function chakraSphereLines(p) {
  const out = [];
  for (const k of chakras(p)) for (const loop of sphereLoops(k.c, k.r)) out.push({ pts: loop, stroke: ORB });
  return out;
}

// ─── Rib cage — anatomically seated on the thoracic spine ──────────────
//   • ovoid, WIDEST AT THE LOWER THIRD (rib 8–9); narrow at the tilted thoracic
//     inlet (T1), tapering again at the costal margin;
//   • each rib SLOPES DOWN from its vertebral (back) end to its sternal (front)
//     end — the ring plane tilts forward-and-down;
//   • hung off the KYPHOTIC thoracic spine — back anchors ride the curve;
//   • the STERNUM spans only the upper-mid; below the xiphoid the COSTAL ARCH
//     (∧) flares open (the thoracic outlet is open at the front);
//   • the narrow top sits at the neck root, just above the shoulder line.
export function ribCageLines(p) {
  const out = [];
  const costalZ = lerp(p.navel.z, p.neckHub.z, 0.02);   // costal margin, just above the navel
  const T1z = p.neckHub.z + 0.015;                       // thoracic inlet, neck root
  const N = 7, W = 0.085, AP = 0.07;                     // transverse ovoid, narrowed ~15% (leaner chest)
  const tilt = 18 * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
  const back = cubicBezier(
    { x: 0, y: -0.005, z: costalZ }, { x: 0, y: -0.06, z: lerp(costalZ, T1z, 0.5) }, { x: 0, y: -0.06, z: lerp(costalZ, T1z, 0.5) }, { x: 0, y: 0.005, z: T1z }, N - 1,
  );
  const t0 = 0.33;
  const prof = (t) => Math.sin(Math.PI * (t < t0 ? lerp(0.16, 0.5, t / t0) : lerp(0.5, 0.9, (t - t0) / (1 - t0))));
  const fronts = [], lefts = [], rights = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), b = back[i];
    const apH = AP * prof(t), rx = W * prof(t);
    const cy = b.y + apH * ct, cz = b.z - apH * st;     // center forward + a touch lower than the spine
    const ring = [];
    for (let j = 0; j <= 30; j++) { const a = (j / 30) * Math.PI * 2, fwd = Math.sin(a); ring.push({ x: rx * Math.cos(a), y: cy + apH * fwd * ct, z: cz - apH * fwd * st }); }
    out.push({ pts: ring, stroke: RIB });
    fronts.push({ x: 0, y: cy + apH * ct, z: cz - apH * st });
    lefts.push({ x: -rx, y: cy, z: cz });
    rights.push({ x: rx, y: cy, z: cz });
  }
  const xi = 2;                                          // xiphoid — sternum ends ~lower third
  out.push({ pts: fronts.slice(xi), stroke: RIB });      // sternum (upper-mid only)
  out.push({ pts: [fronts[xi], lefts[0]], stroke: RIB }); // costal arch ∧ (open outlet)
  out.push({ pts: [fronts[xi], rights[0]], stroke: RIB });
  out.push({ pts: lefts, stroke: RIB, opacity: 0.7 });   // lateral seams
  out.push({ pts: rights, stroke: RIB, opacity: 0.7 });
  out.push({ pts: back, stroke: RIB, opacity: 0.5 });    // spine attachment line
  out.push({ pts: [p.shoulderL, back[N - 1]], stroke: RIB }); // clavicles to the shoulder line
  out.push({ pts: [p.shoulderR, back[N - 1]], stroke: RIB });
  return out;
}

// ─── Pelvis — basket whose floor is the hip joints ──────────────────────
//   • ovoid basin comparable to the ribcage; the FLOOR is the hip joints, the
//     iliac rim flares above to cradle the dantien;
//   • ANTERIORLY TILTED; the SACRUM is the back wall (continuous with the spine);
//   • the HIP VAJRA (hipL ↔ pelvisHub ↔ hipR) is the acetabular line — the
//     sockets sit at the floor corners.
export function pelvisLines(p) {
  const out = [];
  const hipHalf = Math.abs(p.hipL.x);
  const floorZ = p.hipL.z;                     // FLOOR of the basket = the hip joints
  const rimZ = p.hipL.z + 0.105;               // iliac rim — the bowl the dantien rests in
  const N = 4;
  const tilt = 26 * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);   // anterior pelvic tilt
  const rxOf = (t) => lerp(hipHalf * 0.88, hipHalf, t);   // iliac stays inside the trochanters
  const apOf = (t) => lerp(0.048, 0.064, t);
  const fronts = [], backs = [], lefts = [], rights = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const z = lerp(floorZ, rimZ, t), yBack = lerp(-0.012, -0.03, t);   // back = sacrum side
    const apH = apOf(t), rx = rxOf(t), cy = yBack + apH * ct, cz = z - apH * st;
    const ring = [];
    for (let j = 0; j <= 28; j++) { const a = (j / 28) * Math.PI * 2, fwd = Math.sin(a); ring.push({ x: rx * Math.cos(a), y: cy + apH * fwd * ct, z: cz - apH * fwd * st }); }
    out.push({ pts: ring, stroke: PEL });
    fronts.push({ x: 0, y: cy + apH * ct, z: cz - apH * st });
    backs.push({ x: 0, y: cy - apH * ct, z: cz + apH * st });
    lefts.push({ x: -rx, y: cy, z: cz });
    rights.push({ x: rx, y: cy, z: cz });
  }
  out.push({ pts: fronts, stroke: PEL, opacity: 0.8 });   // anterior (pubis → ASIS) line
  out.push({ pts: backs, stroke: PEL, opacity: 0.6 });    // sacrum (back wall)
  out.push({ pts: lefts, stroke: PEL, opacity: 0.7 });
  out.push({ pts: rights, stroke: PEL, opacity: 0.7 });
  // hip sockets (acetabula) at the hip vajra — the floor corners the basket holds
  for (const h of [p.hipL, p.hipR]) for (const loop of sphereLoops({ x: h.x, y: 0, z: h.z }, 0.02)) out.push({ pts: loop, stroke: PEL, opacity: 0.85 });
  return out;
}

// ─── Limb-root articulations ────────────────────────────────────────────
// Hip: head in the acetabulum (hip vajra), femoral neck angled out + down to
// the greater trochanter (the OUTERMOST edge of the form at the hip, just inside
// the shoulder width — no barrel hip), shaft converging to the knee.
export function femoralNeckLines(p) {
  const out = [];
  const side = (hip, knee, sgn) => {
    const troch = { x: hip.x + sgn * 0.024, y: 0, z: hip.z - 0.04 };   // greater trochanter
    out.push({ pts: [hip, troch], stroke: FEMUR, width: 2.2 });        // femoral neck (head → trochanter)
    out.push({ pts: [troch, knee], stroke: FEMUR, width: 2.2, opacity: 0.85 }); // shaft → knee (converges in)
    out.push({ pts: circleLoop(troch, 'xy', 0.013), stroke: FEMUR });
  };
  side(p.hipL, p.kneeL, -1);
  side(p.hipR, p.kneeR, 1);
  return out;
}
// Shoulder: the hip's mirror. The clavicle strut (girdle vajra) ALREADY places
// the shoulder at the outermost edge, so — unlike the femoral neck — no lateral
// offset is needed: the deltoid caps that point (the trochanter equivalent), the
// large humeral head sits just medial + below in the shallow socket, and the arm
// hangs ~vertically (vs the femur's converge).
export function deltoidCapLines(p) {
  const out = [];
  const side = (sh, elbow, sgn) => {
    const head = { x: sh.x - sgn * 0.018, y: 0, z: sh.z - 0.03 };   // humeral head, medial + below the cap
    for (const loop of sphereLoops({ x: sh.x, y: 0, z: sh.z }, 0.034)) out.push({ pts: loop, stroke: FEMUR, opacity: 0.7 }); // deltoid cap (outermost edge)
    out.push({ pts: [sh, head], stroke: FEMUR, width: 2.2 });        // acromion → humeral head
    out.push({ pts: [head, elbow], stroke: FEMUR, width: 2.2, opacity: 0.85 }); // humerus hangs to the elbow
  };
  side(p.shoulderL, p.elbowL, -1);
  side(p.shoulderR, p.elbowR, 1);
  return out;
}

// ─── Aggregates ────────────────────────────────────────────────────────
// Lateral girdle vajras as the rib/hip maps + the cross frame + chakra spheres.
export function torsoWire(p) {
  const bones = figureVajraSpecs(p);
  const lines = [];
  for (const r of vajraRingLines(bones[2].proximal, bones[2].center, bones[2].distal, [0.034, 0.022, 0.034], RIB, 16)) lines.push(r);
  for (const r of vajraRingLines(bones[3].proximal, bones[3].center, bones[3].distal, [0.030, 0.024, 0.030], PEL, 12)) lines.push(r);
  lines.push(...crossVajraLines(p));
  lines.push(...chakraSphereLines(p));
  return { lines };
}
// The canonical elaborated vajra body: every bone edge as wireframe rings + the
// cross frame + chakra spheres + the central channel.
export function vajraBodyLines(p) {
  const lines = [];
  for (const spec of figureVajraSpecs(p)) {
    for (const r of vajraRingLines(spec.proximal, spec.center, spec.distal, [spec.rProximal, spec.rCenter, spec.rDistal], BONE, 18)) lines.push(r);
  }
  lines.push(...crossVajraLines(p));
  lines.push(...chakraSphereLines(p));
  lines.push(...centralChannelLines(p));
  return lines;
}
// Pre-filled vajra body: the body radials + the per-segment yin/yang strands.
export function preFilledLines(p) {
  return [...vajraBodyLines(p), ...yinYangLines(p)];
}
// The base skeleton: rib cage + pelvis + the limb-root articulations.
export function baseSkeletonLines(p) {
  return [...ribCageLines(p), ...pelvisLines(p), ...femoralNeckLines(p), ...deltoidCapLines(p)];
}
