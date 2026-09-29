// construction/joints — where two members meet, what each loses and gains, and which way they go together.
//
// Members are authored on centrelines, as a frame is drawn; a joint decides the cut. Each joint writes exact field
// terms (box and extrude, the shapes field-exact.js composes with Manifold) into the members' LOCAL frames (metres),
// adds any loose pieces (pegs, wedges, keys), and records how the parts assemble: the direction member `a` moves
// relative to member `b` to seat (a sliding fit allows both senses). Sizes follow the members, so a joint has no size of
// its own, as a rock's angles have none:
//   · 'mortise-tenon' — Western: a tenon a third of the timber thick, 0.8 of it deep, into a mortise in b; `through`
//     (default false: blind, two-thirds through) and `pegs` (default 1, a drawbored oak peg across the cheeks). The
//     shoulder is b's face wherever a's centreline enters it, so a brace's shoulder is cut on the skew.
//   · 'hozo' — kigumi: the short tenon a post carries into the beam above (or a beam into a post), no peg; `pin: true`
//     adds a komisen, a square hardwood pin through the cheeks.
//   · 'nuki' — kigumi: a runs straight through b in a slot a wedge-gap taller than itself, locked by a kusabi driven
//     beside it; `drive: 'from' | 'to'` sets which side the wedge is driven from.
//   · 'kanawa-tsugi' — kigumi splice: a (ending) and b (starting) on one line, lapped over three times the depth with a
//     lip at each end and a shachi-sen key across the middle. a drops onto b from above.
//   · 'lap' — a crossing halved: a keeps the half on the far side of the two axes' plane, b the near half.
//   · 'notch' — a takes b's shape where they overlap: a rafter's bird's-mouth on a plate, a joist housed in a beam.
// Steel (any material may use them):
//   · 'welded' — a trimmed to b's face (a timber butt joint, too).
//   · 'bolted' — a trimmed back by an end plate (`plate` mm, default 12) bolted to b's face with four M20s: heads on the
//     plate, nuts behind b's flange (or behind b itself when b is timber or concrete).
//   · 'base-plate' — a column's foot on a plate (`plate` mm, default 20) with four anchor bolts; `b`, a footing, is
//     optional.
import { perpBasisZ } from '../polygonizer/solid-frame.js';
import { toWorld, toLocal, dirWorld } from './members.js';
import { prismPolys, ngon, boxPolys } from './prims.js';

export const JOINT_TYPES = Object.freeze(['mortise-tenon', 'hozo', 'nuki', 'kanawa-tsugi', 'lap', 'notch', 'welded', 'bolted', 'base-plate']);

const EPS = 0.002;                  // cutters overshoot the faces they open, metres
const CLEAR = 0.0008;               // a working clearance in a mortise or slot
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dirLocal = (F, v) => [dot(v, F.ex), dot(v, F.ey), dot(v, F.ez)];
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** A box term in a member's local frame. */
const box = (center, size) => ({ kind: 'box', center, size });
/**
 * An extruded prism from `from` to `to` (local points) whose cross-section corners are `corners` — 3D offsets square
 * to the axis. field-exact reads a profile in perpBasisZ(axis) coordinates, so the corners are projected onto it.
 */
function prism(from, to, corners) {
  const d = unit(sub(to, from));
  const [u, v] = perpBasisZ({ x: d[0], y: d[1], z: d[2] });
  const U = [u.x, u.y, u.z], V = [v.x, v.y, v.z];
  return { kind: 'extrude', axisFrom: from, axisTo: to, profile: { points: corners.map((c) => [r4(dot(c, U)), r4(dot(c, V))]) } };
}
/** A rectangle's corners square to an axis: half-sizes hu, hv along unit vectors eu, ev. */
const rectCorners = (eu, hu, ev, hv) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => add(scl(eu, a * hu), scl(ev, b * hv)));
/** A regular polygon's corners (radius r) square to an axis, spanned by unit vectors eu, ev. */
const ringCorners = (eu, ev, r, n = 12) => Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return add(scl(eu, r * Math.cos(t)), scl(ev, r * Math.sin(t))); });
const AXES = { y: [0, 1, 0], z: [0, 0, 1] };

/**
 * Where a line (local points P0 → P1, parametrised P0 + t·(P1 − P0)) meets member M's box → { tIn, tOut, nIn } (nIn
 * the outward normal of the entry face, local), or null when it misses.
 */
function lineBox(M, P0, P1) {
  const d = sub(P1, P0);
  const lo = [M.xMin, -M.W / 2, -M.D / 2], hi = [M.xMax, M.W / 2, M.D / 2];
  let tIn = -Infinity, tOut = Infinity, nIn = null;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) { if (P0[i] < lo[i] || P0[i] > hi[i]) return null; continue; }
    let t0 = (lo[i] - P0[i]) / d[i], t1 = (hi[i] - P0[i]) / d[i]; let n0 = -1;
    if (t0 > t1) { [t0, t1] = [t1, t0]; n0 = 1; }
    if (t0 > tIn) { tIn = t0; nIn = [0, 0, 0]; nIn[i] = n0; }
    tOut = Math.min(tOut, t1);
  }
  return tIn <= tOut ? { tIn, tOut, nIn } : null;
}

/** The end of member a nearer member b's centreline → { end: 'from' | 'to', s: +1 | −1 (the axis sense into b) }. */
function nearEnd(A, B) {
  const dist = (p) => { const q = toLocal(B.F, p); const x = Math.max(B.xMin, Math.min(B.xMax, q[0])); return Math.hypot(q[0] - x, q[1], q[2]); };
  const pFrom = toWorld(A.F, [0, 0, 0]), pTo = toWorld(A.F, [A.L, 0, 0]);
  return dist(pTo) <= dist(pFrom) ? { end: 'to', s: 1 } : { end: 'from', s: -1 };
}

/** The a-local axis (y or z) nearest a world direction → 'y' | 'z'. */
const nearestAxis = (F, w) => (Math.abs(dot(w, F.ey)) >= Math.abs(dot(w, F.ez)) ? 'y' : 'z');

// ─── the joints ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Where a's end meets b's side: the shoulder plane (b's entry face) in both frames. → { s, axisW, nW, cosI, entryA,
 * nA, xp, through, hitN } — s the sense of a's axis into b, xp where the plane crosses a's axis (a-local x), through
 * b's thickness along a's axis.
 */
function shoulder(J, A, B, kind) {
  const { s } = nearEnd(A, B);
  // a's centreline, from its far end through the joint end, in b's frame
  const farW = toWorld(A.F, [s > 0 ? 0 : A.L, 0, 0]), endW = toWorld(A.F, [s > 0 ? A.L : 0, 0, 0]);
  const hit = lineBox(B, toLocal(B.F, farW), toLocal(B.F, endW));
  if (!hit || hit.tIn > 1.02 || hit.tIn < 0) throw new Error(`joint ${J.label}: ${A.id}'s centreline never reaches ${B.id} — run it into ${B.id} (to its centreline or face)`);
  if (hit.nIn[0] !== 0) throw new Error(`joint ${J.label}: ${A.id} meets ${B.id}'s end, not its side — a ${kind} goes into a side face; for end to end use ${A.material === 'steel' ? 'a bolted splice plate' : 'kanawa-tsugi'}`);
  const lineLen = len(sub(endW, farW));
  const entryW = add(farW, scl(sub(endW, farW), hit.tIn));
  const nW = unit(dirWorld(B.F, hit.nIn));                                  // b's entry face normal, outward (toward a)
  const axisW = scl(A.F.ex, s);                                             // into b
  const cosI = Math.max(0.2, -dot(nW, axisW));                              // obliquity of the entry
  const entryA = toLocal(A.F, entryW); const nA = dirLocal(A.F, nW);
  return { s, axisW, nW, cosI, entryA, nA, xp: entryA[0], through: (hit.tOut - hit.tIn) * lineLen, hitN: hit.nIn };
}
/** Trim a at the shoulder, the plane moved `back` metres toward a (a plate's thickness): a half-space as a big prism. */
function trimShoulder(A, sh, back = 0) {
  const big = 4 * Math.max(A.W, A.D) / sh.cosI;
  const [e1, e2] = (() => { const t = Math.abs(sh.nA[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const a1 = unit(cross(sh.nA, t)); return [a1, cross(sh.nA, a1)]; })();
  const p0 = add(sh.entryA, scl(sh.nA, back));
  A.trims.push(prism(p0, add(p0, scl(sh.nA, -(sh.through + big + back))), rectCorners(e1, big, e2, big)));
}

/** A tenon on a's end into b (mortise-tenon and hozo). */
function tenon(J, A, B, out, { kind }) {
  const sh = shoulder(J, A, B, kind);
  const { s, axisW, cosI, entryA, nA, xp, through } = sh;
  const thick = nearestAxis(A.F, unit(cross(A.F.ex, B.F.ex)));
  const other = thick === 'y' ? 'z' : 'y';
  const dimOf = (ax) => (ax === 'y' ? A.W : A.D);
  const tT = Math.max(0.012, dimOf(thick) / 3);
  const hT = dimOf(other) * 0.8;
  const depth = kind === 'hozo' ? Math.min(0.09, 0.6 * through) : (J.through ? through : 0.66 * through);
  const lead = (hT / 2) * Math.sqrt(Math.max(0, 1 - cosI * cosI)) / cosI + 0.001;  // the tenon starts inside a's body
  const x0 = xp - s * lead, x1 = xp + s * depth;
  trimShoulder(A, sh);
  // the tenon (a-local, axis-aligned)
  const size = [Math.abs(x1 - x0), thick === 'y' ? tT : hT, thick === 'z' ? tT : hT];
  A.adds.push(box([(x0 + x1) / 2, 0, 0], size));
  if (s > 0) A.xMax = Math.max(A.xMax, x1); else A.xMin = Math.min(A.xMin, x1);
  // the mortise in b: the tenon's volume with a clearance, a little deeper when blind
  const toB = (p) => toLocal(B.F, toWorld(A.F, p));
  const eT = dirLocal(B.F, dirWorld(A.F, AXES[thick])), eO = dirLocal(B.F, dirWorld(A.F, AXES[other]));
  const xEnd = x1 + s * (J.through || kind === 'hozo' && depth >= through ? EPS : 0.003);
  B.subs.push(prism(toB([x0 - s * EPS, 0, 0]), toB([xEnd, 0, 0]), rectCorners(eT, tT / 2 + CLEAR, eO, hT / 2 + CLEAR)));
  // a peg (Western) or a komisen (hozo pin) across the cheeks
  const pins = kind === 'hozo' ? (J.pin ? 1 : 0) : (Number.isInteger(J.pegs) ? J.pegs : 1);
  const tAxisW = dirWorld(A.F, AXES[thick]);
  const halfB = Math.abs(dot(tAxisW, B.F.ey)) * B.W / 2 + Math.abs(dot(tAxisW, B.F.ez)) * B.D / 2;
  const pegD = kind === 'hozo' ? 0.013 : Math.max(0.012, Math.min(0.025, tT * 0.7));
  let relish = null;
  for (let k = 0; k < pins; k++) {
    const along = Math.min(depth * 0.45, Math.max(pegD * 1.8, 0.035)) + k * pegD * 2.5;
    const xc = xp + s * along;
    relish = depth - along;
    const c = [xc, 0, 0]; const ax = AXES[thick]; const oth = AXES[other];
    const stick = kind === 'hozo' ? 0.015 : 0.004;
    const corners = kind === 'hozo' ? rectCorners([1, 0, 0], pegD / 2, oth, pegD / 2) : ringCorners([1, 0, 0], oth, pegD / 2, 12);
    out.pieces.push({ id: `${J.label}:${kind === 'hozo' ? 'komisen' : 'peg'}${pins > 1 ? k + 1 : ''}`, kind: kind === 'hozo' ? 'komisen' : 'peg', host: A, species: J.pinSpecies || 'oak',
      terms: [{ op: 'add', shape: prism(add(c, scl(ax, -(halfB + stick))), add(c, scl(ax, halfB + stick)), corners) }] });
    out.edges.push({ a: out.pieces[out.pieces.length - 1].id, b: A.id, dirs: [tAxisW, scl(tAxisW, -1)], piece: true, needs: [A.id, B.id] });
  }
  out.edges.push({ a: A.id, b: B.id, dirs: [axisW] });
  out.report.push({ joint: J.label, type: J.type, a: A.id, b: B.id,
    tenon: { thickMm: Math.round(tT * 1000), heightMm: Math.round(hT * 1000), depthMm: Math.round(depth * 1000), through: !!(J.through || (kind === 'hozo' && depth >= through)) },
    ...(pins ? { pins, pinMm: Math.round(pegD * 1000), relishMm: Math.round(relish * 1000), relishOk: relish >= 2 * pegD } : {}),
    skewDeg: Math.round((Math.acos(Math.min(1, cosI)) * 180) / Math.PI) });
}

/** a runs through b, wedged. */
function nuki(J, A, B, out) {
  const P0 = toLocal(B.F, toWorld(A.F, [A.xMin, 0, 0])), P1 = toLocal(B.F, toWorld(A.F, [A.xMax, 0, 0]));
  const hit = lineBox(B, P0, P1);
  if (!hit || hit.tIn <= 0 || hit.tOut >= 1) throw new Error(`joint ${J.label}: a nuki must run right through ${B.id} — extend ${A.id} past both of its faces`);
  const span = A.xMax - A.xMin;
  const xIn = A.xMin + hit.tIn * span, xOut = A.xMin + hit.tOut * span;
  const g = Math.max(0.012, A.D * 0.16);                                     // the wedge gap above the nuki
  const toB = (p) => toLocal(B.F, toWorld(A.F, p));
  const eY = dirLocal(B.F, A.F.ey), eZ = dirLocal(B.F, A.F.ez);
  // the slot: a's section plus the gap, centred up by g/2
  const zc = g / 2;
  B.subs.push(prism(toB([xIn - EPS, 0, zc]), toB([xOut + EPS, 0, zc]), rectCorners(eY, A.W / 2 + CLEAR, eZ, A.D / 2 + g / 2 + CLEAR)));
  // the kusabi: driven from one side, proud of the face it enters, its tip just out of the far face
  const fromSide = J.drive === 'to' ? 1 : -1;                                // −1: driven toward +x from the xIn side
  const xDrive = fromSide < 0 ? xIn - 0.035 : xOut + 0.035, xTip = fromSide < 0 ? xOut + 0.006 : xIn - 0.006;
  const z0 = A.D / 2;
  const pts = [[xDrive, z0], [xDrive, z0 + g + 0.004], [xTip, z0 + g - 0.005], [xTip, z0]];
  // an extrude along +y reads its profile as (−x, z)
  out.pieces.push({ id: `${J.label}:kusabi`, kind: 'kusabi', host: A, species: J.pinSpecies || A.species,
    terms: [{ op: 'add', shape: { kind: 'extrude', axisFrom: [0, -A.W / 2 + 0.0005, 0], axisTo: [0, A.W / 2 - 0.0005, 0], profile: { points: pts.map(([x, z]) => [r4(-x), r4(z)]) } } }] });
  const along = scl(A.F.ex, fromSide < 0 ? 1 : -1);
  out.edges.push({ a: A.id, b: B.id, dirs: [A.F.ex, scl(A.F.ex, -1)] });
  out.edges.push({ a: `${J.label}:kusabi`, b: A.id, dirs: [along], piece: true, needs: [A.id, B.id] });
  out.report.push({ joint: J.label, type: 'nuki', a: A.id, b: B.id, slotMm: [Math.round((A.W + 2 * CLEAR) * 1000), Math.round((A.D + g + 2 * CLEAR) * 1000)], wedgeGapMm: Math.round(g * 1000), drive: fromSide < 0 ? 'from' : 'to' });
}

/** The kanawa-tsugi splice: a ends where b starts, on one line. */
function kanawa(J, A, B, out) {
  const aTo = toWorld(A.F, [A.L, 0, 0]), bFrom = toWorld(B.F, [0, 0, 0]);
  const tol = 0.002 + 0.02 * Math.min(A.D, B.D);
  if (len(sub(aTo, bFrom)) > tol) throw new Error(`joint ${J.label}: kanawa-tsugi splices ${A.id}'s 'to' end onto ${B.id}'s 'from' end — author them end to start on one line`);
  if (dot(A.F.ex, B.F.ex) < 0.999 || dot(A.F.ez, B.F.ez) < 0.99) throw new Error(`joint ${J.label}: ${A.id} and ${B.id} must run on one line with the same 'up' to be spliced`);
  if (Math.abs(A.W - B.W) > 1e-4 || Math.abs(A.D - B.D) > 1e-4) throw new Error(`joint ${J.label}: a kanawa-tsugi joins two members of the same section`);
  const D = A.D, W = A.W; const H = 1.5 * D; const lam = 0.12 * 2 * H; const sl = 0.06 * D;
  const kw = Math.max(0.012, 0.15 * D), kh = 0.5 * D;
  const m1 = -sl, m2 = sl, top = D / 2 + EPS, bot = -D / 2 - EPS;
  // b's share of the overlap (cut from a), and a's share (cut from b), in (l, d) about the node
  const Pb = [[-H, bot], [-H, top], [-H + lam, top], [-H + lam, m1], [H - lam, m2], [H - lam, bot]];
  const Pa = [[-H + lam, m1], [-H + lam, top], [H + EPS, top], [H + EPS, bot], [H - lam, bot], [H - lam, m2]];
  const across = (x0, poly) => ({ kind: 'extrude', axisFrom: [0, -W / 2 - EPS, 0], axisTo: [0, W / 2 + EPS, 0], profile: { points: poly.map(([l, d]) => [r4(-(x0 + l)), r4(d)]) } });
  A.xMax = Math.max(A.xMax, A.L + H); B.xMin = Math.min(B.xMin, -H);
  A.subs.push(across(A.L, Pb)); B.subs.push(across(0, Pa));
  A.subs.push(box([A.L, 0, 0], [kw, W + 2 * EPS, kh])); B.subs.push(box([0, 0, 0], [kw, W + 2 * EPS, kh]));
  out.pieces.push({ id: `${J.label}:shachi`, kind: 'shachi', host: A, species: J.pinSpecies || 'oak', terms: [{ op: 'add', shape: box([A.L, 0, 0], [kw - 0.0006, W + 0.03, kh - 0.0006]) }] });
  out.edges.push({ a: A.id, b: B.id, dirs: [scl(A.F.ez, -1)] });
  out.edges.push({ a: `${J.label}:shachi`, b: A.id, dirs: [A.F.ey, scl(A.F.ey, -1)], piece: true, needs: [A.id, B.id] });
  out.report.push({ joint: J.label, type: 'kanawa-tsugi', a: A.id, b: B.id, lapMm: Math.round(2 * H * 1000), keyMm: [Math.round(kw * 1000), Math.round(kh * 1000)] });
}

// ─── steel ───────────────────────────────────────────────────────────────────────────────────────────────────────

const BOLT = { d: 0.02, head: 0.03, h: 0.013 };            // M20: 30 mm across flats, 13 mm head
/** A bolt head (or nut) as a hex prism at local point c, its axis along unit vector ax, height h. */
const hexAt = (c, ax, h) => prismPolys(c, add(c, scl(ax, h)), ngon(ax, BOLT.head / Math.sqrt(3), 6));
/** How thick b is where a's bolts pass: a steel I or channel's flange, a plate-like member's depth, else b through. */
function grip(B, hitN, through) {
  if (B.material === 'steel' && B.sec && (B.sec.shape === 'I' || B.sec.shape === 'C')) return hitN[2] !== 0 ? B.sec.tf / 1000 : B.sec.tw / 1000;
  if (B.material === 'steel' && B.sec && (B.sec.shape === 'SHS' || B.sec.shape === 'CHS')) return B.sec.t / 1000;
  return through;
}

/** a trimmed to b's face and welded (or, for timber, butted): no loose parts. */
function welded(J, A, B, out) {
  const sh = shoulder(J, A, B, 'welded joint');
  trimShoulder(A, sh);
  out.edges.push({ a: A.id, b: B.id, dirs: [sh.axisW] });
  out.report.push({ joint: J.label, type: 'welded', a: A.id, b: B.id, skewDeg: Math.round((Math.acos(Math.min(1, sh.cosI)) * 180) / Math.PI) });
}

/** a ends in a plate bolted to b's face: four bolts, heads on the plate, nuts behind b's flange. */
function bolted(J, A, B, out) {
  const sh = shoulder(J, A, B, 'bolted joint');
  const tp = (Number.isFinite(J.plate) ? J.plate : 12) / 1000;
  trimShoulder(A, sh, tp);
  const { s, xp } = sh;
  const pw = Math.max(0.1, A.W + 0.02), pd = A.D + 0.04;
  const plate = boxPolys([xp - (s * tp) / 2, 0, 0], [tp, pw, pd]);
  const by = Math.max(0.03, pw / 2 - 0.03), bz = pd / 2 - 0.035;
  const heads = [], g = grip(B, sh.hitN, sh.through);
  const ax = [s, 0, 0];
  for (const y of [-by, by]) for (const z of [-bz, bz]) {
    heads.push(...hexAt([xp - s * tp, y, z], scl(ax, -1), BOLT.h));                   // the head, on the plate
    heads.push(...hexAt([xp + s * g, y, z], ax, BOLT.h * 1.2));                       // the nut, behind b's flange
    heads.push(...prismPolys([xp + s * (g + BOLT.h * 1.2), y, z], [xp + s * (g + BOLT.h * 1.2 + 0.008), y, z], ngon(ax, BOLT.d / 2, 8)));   // the thread past the nut
  }
  const id = `${J.label}:plate`;
  out.pieces.push({ id, kind: 'end-plate', host: A, material: 'steel', finish: J.finish || A.finish, polys: [...plate, ...heads] });
  out.edges.push({ a: A.id, b: B.id, dirs: [sh.axisW] });
  out.report.push({ joint: J.label, type: 'bolted', a: A.id, b: B.id, plateMm: [Math.round(tp * 1000), Math.round(pw * 1000), Math.round(pd * 1000)], bolts: 4, boltMm: BOLT.d * 1000, gripMm: Math.round(g * 1000) });
}

/** a column's foot on a base plate with four anchor bolts; b (a footing) optional. */
function basePlate(J, A, B, out) {
  // the foot is a's lower end
  const low = A.F.ex[2] >= 0 ? 0 : A.L; const down = A.F.ex[2] >= 0 ? -1 : 1;
  const tp = (Number.isFinite(J.plate) ? J.plate : 20) / 1000;
  const pw = Math.max(A.W, A.D) + 0.1;
  const polys = [...boxPolys([low + (down * tp) / 2, 0, 0], [tp, pw, pw])];
  const o = pw / 2 - 0.035;
  for (const y of [-o, o]) for (const z of [-o, o]) {
    polys.push(...hexAt([low, y, z], [-down, 0, 0], BOLT.h * 1.2));
    polys.push(...prismPolys([low + -down * BOLT.h * 1.2, y, z], [low + -down * (BOLT.h * 1.2 + 0.02), y, z], ngon([1, 0, 0], BOLT.d / 2, 8)));
  }
  // the column stands on the plate: its foot moves up by the plate
  if (down < 0) A.xMin = Math.max(A.xMin, low + tp); else A.xMax = Math.min(A.xMax, low - tp);
  const id = `${J.label}:base`;
  out.pieces.push({ id, kind: 'base-plate', host: A, material: 'steel', finish: J.finish || A.finish, polys });
  if (B) out.edges.push({ a: A.id, b: B.id, dirs: [scl(A.F.ex, A.F.ex[2] >= 0 ? -1 : 1)] });   // the column comes down onto it
  out.report.push({ joint: J.label, type: 'base-plate', a: A.id, ...(B ? { b: B.id } : {}), plateMm: [Math.round(pw * 1000), Math.round(tp * 1000)], anchors: 4 });
}

/** Closest points of two members' axes (world) → { pa, pb, n (unit, a → b; the axes' common normal when they meet) }. */
function axesMeet(A, B) {
  const p = toWorld(A.F, [0, 0, 0]), q = toWorld(B.F, [0, 0, 0]); const u = A.F.ex, v = B.F.ex;
  const w = sub(p, q); const b = dot(u, v), d = dot(u, w), e = dot(v, w); const den = 1 - b * b;
  if (den < 1e-9) return null;
  const sc = (b * e - d) / den, tc = (e - b * d) / den;
  const pa = add(p, scl(u, sc)), pb = add(q, scl(v, tc)); const gap = sub(pb, pa);
  const nrm = unit(cross(u, v));
  return { pa, pb, n: len(gap) > 1e-6 ? unit(gap) : scl(nrm, dot(nrm, A.F.ez) > 0 ? -1 : 1), meet: len(gap) < 1e-6 };
}

/** a crossing b, halved. */
function lap(J, A, B, out) {
  const m = axesMeet(A, B);
  if (!m) throw new Error(`joint ${J.label}: ${A.id} and ${B.id} run parallel — a lap joins crossing members`);
  const nc = unit(cross(A.F.ex, B.F.ex)); const sgn = dot(nc, m.n) > 0 ? 1 : -1; const n = scl(nc, sgn);   // a → b across the plane
  // the part of Other's box on one side (`side` · n) of Other's centre plane, along Other's length: a loses the half of b
  // that lies toward b (b's near half is where a sits), b loses the half of a that lies toward a
  const half = (M, side, Other) => {
    const axis = nearestAxis(Other.F, n); const e = AXES[axis]; const nO = dirLocal(Other.F, n);
    const s = Math.sign(nO[axis === 'y' ? 1 : 2]) * side;
    const hA = axis === 'y' ? Other.W / 2 : Other.D / 2, hB = axis === 'y' ? Other.D / 2 : Other.W / 2;
    const eB = axis === 'y' ? AXES.z : AXES.y;
    const toM = (p) => toLocal(M.F, toWorld(Other.F, p));
    const cM = (p) => dirLocal(M.F, dirWorld(Other.F, p));
    const mid = scl(e, s * (hA + EPS) / 2);
    return prism(toM([Other.xMin - EPS, ...mid.slice(1)]), toM([Other.xMax + EPS, ...mid.slice(1)]), rectCorners(cM(e), (hA + EPS) / 2, cM(eB), hB + EPS));
  };
  A.subs.push(half(A, 1, B));
  B.subs.push(half(B, -1, A));
  out.edges.push({ a: A.id, b: B.id, dirs: [n] });
  out.report.push({ joint: J.label, type: 'lap', a: A.id, b: B.id });
}

/** a takes b's shape where they overlap. */
function notch(J, A, B, out) {
  const m = axesMeet(A, B);
  const toA = (p) => toLocal(A.F, toWorld(B.F, p));
  const cA = (p) => dirLocal(A.F, dirWorld(B.F, p));
  A.subs.push(prism(toA([B.xMin - EPS, 0, 0]), toA([B.xMax + EPS, 0, 0]), rectCorners(cA(AXES.y), B.W / 2 + CLEAR, cA(AXES.z), B.D / 2 + CLEAR)));
  const n = m ? m.n : scl(A.F.ez, -1);
  out.edges.push({ a: A.id, b: B.id, dirs: [n] });
  out.report.push({ joint: J.label, type: 'notch', a: A.id, b: B.id });
}

/**
 * Apply every joint to the members (id → member record with F, W, D, L, xMin, xMax, trims, adds, subs). Mutates the
 * records; returns { pieces, edges, report }.
 */
export function applyJoints(joints, byId) {
  const out = { pieces: [], edges: [], report: [] };
  joints.forEach((J0, i) => {
    const J = { ...J0, label: J0.id || `${J0.type}:${J0.a}-${J0.b}` };
    const A = byId.get(J.a), B = J.b === undefined ? null : byId.get(J.b);
    switch (J.type) {
      case 'mortise-tenon': tenon(J, A, B, out, { kind: 'mortise-tenon' }); break;
      case 'hozo': tenon(J, A, B, out, { kind: 'hozo' }); break;
      case 'nuki': nuki(J, A, B, out); break;
      case 'kanawa-tsugi': kanawa(J, A, B, out); break;
      case 'lap': lap(J, A, B, out); break;
      case 'notch': notch(J, A, B, out); break;
      case 'welded': welded(J, A, B, out); break;
      case 'bolted': bolted(J, A, B, out); break;
      case 'base-plate': basePlate(J, A, B, out); break;
      default: throw new Error(`joints[${i}]: unknown type '${J.type}'`);
    }
  });
  return out;
}
