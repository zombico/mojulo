// THE BUG BUILDER: one BAUPLAN (a choice of form per part, plus any overrides) → a ring plan (layered-plan-v1). Pure,
// deterministic, no I/O, no dice. There is no family table: a bug is assembled from PARTS (forms.js), each placed at a
// SOCKET the builder computes on the part it hangs from, so any combination of parts assembles the same way.
//
// The body is three sections along +y: a HEAD (or none: `head: 'fused'`), a TRUNK of `segments` repeated metameres each
// carrying `legsPer` leg pairs (an insect's thorax is three of one; a centipede's fifteen of one; a spider's one of
// four), and a TAIL (abdomen, opisthosoma, telson), with an optional waist. Legs are MANJI chains: bars bent at their
// joints in one vertical plane turned at the socket; a grounded leg's tibia is solved so its foot lies on z = 0.
// Wings, elytra, antennae, mouthparts, eyes and extras ride sockets on the sections.
//
// Frame: metres, +z up, +y front, x = 0 the mirror plane; the lowest body point `clearance` × length off the ground,
// the feet on it. Every share is of body LENGTH (`length`, m: head front to tail tip, true scale).
import { piece, chain } from './pieces.js';
import { ringPart, barStations, profile, sub, add, mul, dot, cross, unit, norm, rotate, cosd, sind } from './ring.js';
import { SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';
import { HEAD_FORMS, TRUNK_FORMS, TAIL_FORMS, LEG_FORMS, ANTENNA_FORMS, MOUTH_FORMS, WING_FORMS, WING_POSES, EYE_FORMS } from './forms.js';
import * as dmath from '../../util/dmath.js';

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
/** b over a, objects one level deep */
const merge1 = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = isObj(v) && isObj(o[k]) ? { ...o[k], ...v } : v; return o; };
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const asin = (x) => (dmath.asin(Math.max(-1, Math.min(1, x))) * 180) / Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const scaleR = (r, k) => (Array.isArray(r) ? r.map((x) => x * k) : r * k);

/** a part spec → its full parameters: a form name, `{ form, …overrides }`, or null / false (absent) */
export function pickForm(table, v, kind) {
  if (v === null || v === undefined || v === false) return null;
  if (typeof v === 'string') { if (!(v in table)) throw new Error(`bug builder: ${kind} form '${v}' is not one of ${Object.keys(table).join(', ')}`); return clone(table[v]); }
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`bug builder: ${kind} is a form name or { form, …overrides }`);
  const { form, ...over } = v; if (form !== undefined && !(form in table)) throw new Error(`bug builder: ${kind} form '${form}' is not one of ${Object.keys(table).join(', ')}`);
  const base = form === undefined ? {} : clone(table[form]);
  if (form !== undefined && base === null) return null;
  for (const [k, x] of Object.entries(over)) base[k] = x && typeof x === 'object' && !Array.isArray(x) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? { ...base[k], ...clone(x) } : clone(x);
  return base;
}

/** A SECTION: a profiled loft from `start` along D (front ring toward `up` U), with the sampling that shows its
 * segments (a pinch at every inner boundary). Returns its stations and `at(u)` (centre, half-width, half-height, the
 * local frame), so a socket anywhere on it can be found. */
function section(F, start, D, U, L) {
  const len = F.len * L, n = Math.max(1, F.segments || 1), split = F.split && F.split.length === n ? F.split : Array(n).fill(1 / n);
  const sh = F.fromFront ? [...split].reverse() : split, sum = sh.reduce((s, x) => s + x, 0), bounds = [0]; for (const s of sh) bounds.push(bounds[bounds.length - 1] + s / sum);
  const S = unit(cross(D, U));
  const arch = (u) => (F.arch || 0) * L * dmath.sin(Math.PI * u);
  const shape = (u) => profile(u, F);
  const at = (u) => { const k = shape(u); return { c: add(add(start, mul(D, u * len)), mul(U, arch(u))), w: F.w * L * k, h: F.h * L * k, D, U, S }; };
  const us = [];
  if (n === 1) { const m = F.samples || 8; for (let i = 0; i <= m; i++) us.push([i / m, 1]); }
  else { const sp = Math.max(1, F.samplesPerSeg || 1);   // `samplesPerSeg` (opt-in): more rings inside each segment, for thin bands
    for (let i = 0; i < n; i++) { us.push([bounds[i], i ? 1 - (F.dip || 0) : 1]); for (let q = 1; q < 2 * sp; q++) us.push([bounds[i] + ((bounds[i + 1] - bounds[i]) * q) / (2 * sp), 1]); if (i === n - 1) us.push([1, 1]); } }
  // `belly` (opt-in): the lower half's depth as a share of the upper's (a flat underside)
  const stations = us.map(([u, k]) => { const a = at(u); return { c: a.c, r: F.belly !== undefined ? [a.w * k, a.h * k, a.h * k * F.belly] : [a.w * k, a.h * k], up: U, d: D, u }; });
  // SEGMENTS COUNT FROM THE FRONT when `fromFront` (the trunk: segment 0 is the one behind the head, `split[0]` its
  // share), else from the start; `span(i)` is segment i's [low u, high u], `segAt(i)` its middle
  const idx = (i) => (F.fromFront ? n - 1 - i : i), span = (i) => [bounds[idx(i)], bounds[idx(i) + 1]];
  const per = 2 * Math.max(1, F.samplesPerSeg || 1);
  return { F, n, len, start, D, U, S, at, stations, bounds, span, per, segAt: (i) => (span(i)[0] + span(i)[1]) / 2, station: (i) => per * idx(i) };
}

/** a point on a section's surface at u, `deg` from the side toward the top (− toward the belly), `inset` of the way in,
 * and the surface's outward normal there */
function surfacePoint(sec, u, deg, inset = 0) {
  const { c, w, h, S, U } = sec.at(u), k = 1 - inset;
  return { p: add(c, add(mul(S, w * cosd(deg) * k), mul(U, h * sind(deg) * k))), n: unit(add(mul(S, cosd(deg) / Math.max(w, 1e-9)), mul(U, sind(deg) / Math.max(h, 1e-9)))) };
}

const shiftPart = (g, dz) => { const s = (p) => [p[0], p[1], p[2] + dz];
  for (const st of g.stations) for (const k of Object.keys(st.points)) st.points[k] = s(st.points[k]);
  for (const k of Object.keys(g.caps)) g.caps[k] = s(g.caps[k]); };
const minZ = (g) => Math.min(...g.stations.flatMap((st) => Object.values(st.points).map((p) => p[2])), ...Object.values(g.caps).map((p) => p[2]));

/** a rod along a polyline with radius per point (antenna, cerci, proboscis): stations at the points */
function rod(name, pts, rs, opt) {
  const st = pts.map((c, i) => ({ c, r: rs[i] }));
  return ringPart(name, st, { slots: 'ring8', cap: [0.4, 0.6], ...opt });
}
/** a polyline from P0 heading d0, `n` steps of `len`, its heading turned by turn(i, d) each step */
function trace(P0, d0, len, n, turn) { const pts = [P0]; let d = unit(d0);
  for (let i = 0; i < n; i++) { d = unit(turn(i, d)); pts.push(add(pts[i], mul(d, len / n))); } return pts; }
/** turn a heading down (toward −z) by deg, about the horizontal axis across it */
const bendDown = (d, deg) => { let k = cross(Z, d); if (norm(k) < 1e-9) k = X; return rotate(d, unit(k), deg); };
/** a heading from +y: `yaw` toward +x (out), `rise` toward +z */
const heading = (yaw, rise) => [sind(yaw) * cosd(rise), cosd(yaw) * cosd(rise), sind(rise)];

/** the knots of a radius shape ([[u, share], …]) at u, linear between */
const knots = (K, u) => { for (let i = 1; i < K.length; i++) if (u <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (u - K[i - 1][0]) / Math.max(1e-9, K[i][0] - K[i - 1][0])); return K[K.length - 1][1]; };

/** ONE LEG as a manji chain of PIECES at `socket` (right side): the coxa, femur and tibia bars, then the tarsus as
 * `tarsi` carrots ending in two chili claws, or a chela (a palm and two banana fingers). Returns its parts and joints. */
function buildLeg(tag, F, socket, L, group) {
  const k = F.reach ?? 1, th = F.thick ?? 1, yaw = F.yawDeg;
  const out = [cosd(yaw), sind(yaw), 0], across = [-sind(yaw), cosd(yaw), 0];
  // `turn` (opt-in, degrees about z, + forward): the leg's plane turned at a joint, from that bar on — a manji bar
  // folding out of the plane (a crab's chela across its face, a pedipalp's elbow). The solved heights are unchanged.
  const T0 = F.turn || {}, turnAt = { coxa: 0, femur: 0, tibia: 0, tarsus: 0 }; let acc = 0;
  for (const b of ['coxa', 'femur', 'tibia', 'tarsus']) { acc += T0[b] || 0; turnAt[b] = acc; }
  const outOf = (b) => (turnAt[b] ? rotate(out, Z, turnAt[b]) : out), acrossOf = (b) => (turnAt[b] ? rotate(across, Z, turnAt[b]) : across);
  const dirB = (a, b) => add(mul(outOf(b), cosd(a)), mul(Z, sind(a))), nrmB = (a, b) => add(mul(outOf(b), -sind(a)), mul(Z, cosd(a)));
  const dir = (a) => dirB(a, 'coxa'), nrm = (a) => nrmB(a, 'coxa');
  const bar = (b) => b && ({ ...b, len: b.len * L * k, r: b.r * L * th });
  const C = bar(F.coxa), Fm = bar(F.femur), T = bar(F.tibia), Ts = bar(F.tarsus);
  const A = { ...F.angles };
  const P1 = add(socket, mul(dir(A.coxa), C.len));
  let af = A.femur, at = A.tarsus ?? 0, b = A.tibia ?? -60;
  if (F.ground !== false && Ts) {
    // the foot's tip one tarsus radius off the ground; the ankle above it by the tarsus' fall
    // a tarsus lying flat (`thin: 'up'`, an oar) rests on its thickness, not its width
    const n = Math.max(1, F.tarsi || 1), zAnkle = Ts.r * (Ts.thin === 'up' ? (Ts.flat ?? 1) : 1) * lerp(1, Ts.end ?? 0.7, (n - 1) / n) * 0.8 - Ts.len * sind(at);
    // a target TIBIA angle (the leg's stance) solves the femur so the knee sits where that tibia reaches the ankle;
    // past the femur's reach (or with none) the femur keeps its angle and the tibia is solved instead
    const want = A.tibia !== undefined ? (zAnkle - T.len * sind(A.tibia) - P1[2]) / Fm.len : NaN;
    if (Math.abs(want) <= 1) { af = asin(want); b = F.knee === 'in' ? 180 - A.tibia : A.tibia; }
    else {
      let zKnee = P1[2] + Fm.len * sind(af);
      if ((zAnkle - zKnee) / T.len < -1) { af = asin((zAnkle + T.len - P1[2]) / Fm.len); zKnee = P1[2] + Fm.len * sind(af); }
      b = asin((zAnkle - zKnee) / T.len); if (F.knee === 'in') b = 180 - b;
    }
  }
  const P2 = add(P1, mul(dirB(af, 'femur'), Fm.len)), P3 = add(P2, mul(dirB(b, 'tibia'), T.len));
  // a bar as a piece: its thin side across the leg's plane ('plane') or top to bottom ('up'); its bow in the plane
  const pc = (nm, P, Q, B, a, bn) => piece(`${tag}${nm}R`, sub(P, mul(unit(sub(Q, P)), (B.sink ?? 0.35) * B.r)), Q, { ...B, group, mirror: 'name', up: B.thin === 'up' ? nrmB(a, bn) : acrossOf(bn), toward: nrmB(a, bn) });
  const parts = [pc('Coxa', socket, P1, C, A.coxa, 'coxa'), pc('Femur', P1, P2, Fm, af, 'femur'), pc('Tibia', P2, P3, T, b, 'tibia')];
  let P4 = P3;
  if (F.chela) {
    // the CHELA: a palm (a bulb) on, then the fixed finger continuing it and the movable finger hinged below, gaping
    const ch = F.chela, d = dirB(at, 'tarsus'), palm = ch.palm * L * k, pr = ch.r * L * th, P5 = add(P3, mul(d, palm));
    parts.push(piece(`${tag}PalmR`, sub(P3, mul(d, 0.3 * pr)), P5, { shape: 'bulb', r: pr, r0: 0.55, peak: 0.55, end: 0.55, flat: ch.flat, up: Z, group, mirror: 'name' }));
    const fl = ch.finger * L * k, fr = ch.fr * L * th, across = acrossOf('tarsus');
    const fix = add(add(P5, mul(Z, 0.25 * pr)), mul(d, -0.25 * pr)), mov = add(add(P5, mul(Z, -0.3 * pr)), mul(d, -0.3 * pr));
    parts.push(piece(`${tag}FingerR`, fix, add(fix, mul(rotate(d, across, ch.gape / 2), fl)), { shape: 'banana', r: fr, flat: 0.7, bend: 0.12, toward: mul(Z, -1), up: across, group: 'Claw', mirror: 'name' }));
    parts.push(piece(`${tag}DactylR`, mov, add(mov, mul(rotate(d, across, -ch.gape / 2), fl * 1.05)), { shape: 'banana', r: fr, flat: 0.7, bend: 0.12, toward: Z, up: across, group: 'Claw', mirror: 'name' }));
    P4 = add(P5, mul(d, fl));
  } else if (Ts) {
    // the TARSUS: `tarsi` carrots, each tapering a little into the next, the radius falling to the foot's `end`
    const n = Math.max(1, F.tarsi || 1), d = dirB(at, 'tarsus'), seg = Ts.len / n, across = acrossOf('tarsus'), nrm = (a) => nrmB(a, 'tarsus');
    for (let i = 0; i < n; i++) { const r = Ts.r * lerp(1, Ts.end ?? 0.7, i / n), root = add(P3, mul(d, i * seg - (i ? 0.3 * r : 0.4 * r)));
      parts.push(piece(`${tag}Tarsus${i}R`, root, add(P3, mul(d, (i + 1) * seg)), { shape: 'carrot', r, end: 0.8, flat: Ts.flat ?? 1, up: Ts.thin === 'up' ? nrm(at) : across, group: 'Foot', mirror: 'name' })); }
    P4 = add(P3, mul(d, Ts.len));
    if (F.claws) { const cl = F.claws.len * L * k, cr = F.claws.r * L * th;
      const rTip = P4[2], drop = asin(Math.min(1, Math.max(0, rTip) / cl));
      for (const [j, s] of [[0, 1], [1, -1]]) { const h = unit(add(sub(d, mul(Z, d[2])), mul(across, 0.35 * s))), cd = F.ground !== false ? add(mul(h, cosd(drop)), mul(Z, -sind(drop))) : unit(add(h, mul(Z, -0.9)));
        parts.push(piece(`${tag}Claw${j}R`, sub(P4, mul(d, 0.5 * cr)), add(P4, mul(cd, cl)), { shape: 'chili', r: cr, bend: 0.3, toward: mul(d, -1), group: 'Claw', mirror: 'name' })); } }
  }
  return { parts, ground: F.ground !== false && !!Ts, foot: P4, joints: { socket, knee: P2, ankle: P3, foot: P4 } };
}

/** a right-side ring part mirrored to the left, by hand: x negated, R → L, each ring's slots swapped across its
 * front (k ↔ n − k), the compiler's own mirror-by-name, so the faces stay wound outward */
function mirrorRings(g) {
  const fam = SLOT_FAMILIES[g.slots], n = fam.length, mx = (q) => [-q[0] + 0, q[1], q[2]];
  return { ...g, name: g.name.replace(/R$/, 'L'), mirror: null,
    stations: g.stations.map((st) => ({ ...st, points: Object.fromEntries(fam.map((sl, k) => [fam[(n - k) % n], mx(st.points[sl])])) })),
    caps: Object.fromEntries(Object.entries(g.caps).map(([k, q]) => [k, mx(q)])) };
}

/** the bug's ring plan */
export function buildBug(B) { return assembleBug(B).plan; }

/** the ring plan and its READOUT: the body length asked, the leg pairs (role, form, grounded), the wings */
export function assembleBug(B) {
  if (!(B.length > 0)) throw new Error('bug builder: `length` (metres, head front to tail tip) is required');
  // SIZE BY CONSTRUCTION: the shares are of a NOMINAL length; one pass measures the body it makes (head front, or the
  // trunk's when fused, to the tail tip) and the second builds at the scale that makes that exactly `length`
  const first = assembleAt(B, B.length), got = bodyLength(first.plan);
  const out = assembleAt(B, (B.length * B.length) / got);
  out.readout.length = B.length; return out;
}

/** head front (or trunk front) to tail tip, metres, over the plan's ring points and caps */
export function bodyLength(plan) {
  const ys = (n) => { const g = plan.segments.find((x) => x.name === n); return g ? [...g.stations.flatMap((st) => Object.values(st.points)), ...Object.values(g.caps)].map((p) => p[1]) : null; };
  return Math.max(...(ys('head') || ys('trunk'))) - Math.min(...ys('tail'));
}

function assembleAt(B, L) {
  const C = { body: '#5a4a32', ...(B.colors || {}) }, col = (k, d = C.body) => C[k] ?? d;
  const parts = []; const keep = (...g) => { for (const x of g.flat()) if (x) parts.push(x); return g[0]; };

  // ── the SECTIONS: trunk along +y from y = 0, the tail behind it (past a waist), the head in front ──
  const TR = pickForm(TRUNK_FORMS, B.trunk ?? 'compact', 'trunk');
  const TL = pickForm(TAIL_FORMS, B.tail ?? 'oval', 'tail');
  const HD = B.head === 'fused' ? null : pickForm(HEAD_FORMS, B.head ?? 'hypognathous', 'head');
  // `pitch` (opt-in, degrees, + raises the front): a slanted trunk (a dragonfly's thorax, a mantis's raised front)
  const TDir = TR.pitch ? [0, cosd(TR.pitch), sind(TR.pitch)] : Y, TUp = TR.pitch ? [0, -sind(TR.pitch), cosd(TR.pitch)] : Z;
  const trunk = section({ ...TR, fromFront: true }, [0, 0, 0], TDir, TUp, L);
  keep(ringPart('trunk', trunk.stations, { group: 'Trunk', slots: TR.slots || 'ring12' }));   // `slots` (opt-in): finer rings around (ring20: thin stripes)
  const waist = B.waist === null ? null : (B.waist ?? TL.waist ?? null);
  const tp = TL.pitch || 0, TD = [0, -cosd(tp), sind(tp)], TU = [0, sind(tp), cosd(tp)];
  const rear = trunk.at(0).c, wl = waist ? waist.len * L : 0;
  // `overhang` (opt-in, share of length): the tail's start pushed forward over the trunk; `lift` raises it
  const tailStart = add(add(rear, mul(TD, wl - (waist ? 0.15 : 0.12) * TL.len * L * (waist ? 0.3 : 1) - (TL.overhang || 0) * L)), mul(Z, (TL.lift || 0) * L));
  const tail = section(TL, tailStart, TD, TU, L);
  keep(ringPart('tail', tail.stations, { group: 'Tail', slots: TL.slots || 'ring12' }));
  if (waist) {
    const wr = waist.r * L, node = (waist.node || 0) * L, m = 6, st = [];
    for (let i = 0; i <= m; i++) { const u = i / m, c = add(add(rear, mul(Y, 0.2 * wr)), mul(sub(add(tailStart, mul(TD, -0.4 * wr)), add(rear, mul(Y, 0.2 * wr))), u));
      st.push({ c: add(c, mul(Z, node * 0.5 * dmath.sin(Math.PI * u))), r: wr + node * dmath.sin(Math.PI * u) * 0.8, up: Z }); }
    keep(ringPart('waist', st, { group: 'Waist', slots: 'ring8' }));
  }
  // the NECK (opt-in, `neck: { len, w, h, pitch, … }` a section's fields): a section between the trunk and the head (a
  // mantis's long prothorax raised, a camel-necked weevil); forelegs may socket on it (`legs.fore.on: 'neck'`)
  let neck = null;
  if (B.neck) {
    const NK = { len: 0.2, w: 0.04, h: 0.04, pitch: 30, r0: 0.9, peak: 0.5, r1: 0.9, p: 1, q: 1, overlap: 0.1, ...B.neck };
    const nf = trunk.at(1), ND = [0, cosd(NK.pitch), sind(NK.pitch)], NU = [0, -sind(NK.pitch), cosd(NK.pitch)];
    neck = section(NK, add(nf.c, mul(nf.D, -(NK.overlap ?? 0.1) * NK.len * L)), ND, NU, L);
    keep(ringPart('neck', neck.stations, { group: 'Neck', slots: 'ring12' }));
  }
  // the head: its back ring overlapping the trunk's (or the neck's) front, its axis pitched (face down: hypognathous)
  let head = null;
  if (HD) {
    const front = (neck || trunk).at(1), HDir = [0, cosd(HD.pitch), sind(HD.pitch)], HU = [0, -sind(HD.pitch), cosd(HD.pitch)];
    const start = add(add(front.c, mul(neck || TR.pitch ? front.D : Y, -(HD.overlap ?? 0.15) * HD.len * L)), mul(Z, (HD.lift || 0) * L));
    head = section(HD, start, HDir, HU, L);
    keep(ringPart('head', head.stations, { group: 'Head', slots: 'ring12' }));
  }
  // a fused head is the trunk's front quarter: head sockets read the trunk from u = 0.7
  const H = head || { ...trunk, at: (u) => trunk.at(0.7 + 0.3 * u), fused: true };
  const pron = B.pronotum ? { from: 0, to: 0.45, w: 1.15, h: 1.12, drop: 0, ...B.pronotum } : null;
  if (pron) {
    const m = 6, st = [];
    for (let i = 0; i <= m; i++) { const u = 1 - lerp(pron.to, pron.from, i / m), a = trunk.at(u), k = i === 0 || i === m ? 0.92 : 1;
      st.push({ c: add(a.c, mul(Z, -pron.drop * a.h)), r: [a.w * pron.w * k, a.h * pron.h * k], up: Z }); }
    keep(ringPart('pronotum', st, { group: 'Pronotum', slots: 'ring12' }));
  }

  // the SCUTELLUM (opt-in, `scutellum: { len, w, h }` shares): a flat triangular plate from the trunk's back over the
  // tail, narrowing to a point (a shield bug's)
  if (B.scutellum) {
    const sc = { len: 0.35, w: 0.12, h: 0.012, lift: 1, ...B.scutellum }, a0 = trunk.at(0), m = 6, st = [];
    const top = (u) => { const y = a0.c[1] - u * sc.len * L, ut = Math.max(0, Math.min(1, (tailStart[1] - y) / tail.len)), a = y > tailStart[1] ? trunk.at(Math.max(0, y / trunk.len)) : tail.at(ut); return [0, y, a.c[2] + a.h * sc.lift]; };
    for (let i = 0; i <= m; i++) { const u = (i / m) * 0.96; st.push({ c: top(u), r: [Math.max(1e-6, sc.w * L * (1 - u)), sc.h * L], up: Z, d: [0, -1, 0] }); }
    keep(ringPart('scutellum', st, { group: 'Scutellum', slots: 'ring8', cap: [0.3, 0.5] }));
  }

  // ── HEAD PARTS: eyes, antennae, mouth ──
  const EY = pickForm(EYE_FORMS, B.eyes ?? 'compound', 'eyes');
  const hl = (head ? HD.len : TR.len * 0.3) * L;
  if (EY && EY.count) {
    // simple eyes: a cluster over the front, right half (the left mirrors)
    const half = Math.ceil(EY.count / 2), r = EY.size * hl * 0.5;
    for (let i = 0; i < half; i++) { const { p, n } = surfacePoint(H, i % 2 ? EY.at - 0.05 : EY.at, EY.elev + 18 * Math.floor(i / 2) + 12 * (i % 2), 0);
      const c = add(p, mul(n, r * (2 * EY.bulge - 1)));
      keep(ringPart(`eye${i}R`, [-0.9, 0, 0.9].map((v) => ({ c: add(c, mul(H.D, v * r)), r: r * Math.sqrt(1 - v * v * 0.8), up: n })), { group: 'Eye', slots: 'ring8', mirror: 'name', cap: [0.5, 0.5] })); }
  } else if (EY && EY.stalk) {
    // a STALKED eye (crabs, stalk-eyed flies): a carrot stalk off the front, a bulb on its end
    const { p } = surfacePoint(H, EY.at, EY.elev, 0.1), d = heading(EY.yaw ?? 25, EY.rise ?? 55), sl = EY.stalk * hl, r = (EY.size * hl) / 2, e = add(p, mul(d, sl));
    keep(piece('eyeStalkR', p, e, { shape: 'carrot', r: r * 0.55, end: 0.8, group: 'Head', mirror: 'name' }));
    keep(piece('eyeR', sub(e, mul(d, 0.6 * r)), add(e, mul(d, 1.4 * r)), { shape: 'bulb', r, r0: 0.6, peak: 0.5, end: 0.3, group: 'Eye', mirror: 'name', n: 6 }));
  } else if (EY) {
    const { p, n } = surfacePoint(H, EY.at, EY.elev, 0), a = (EY.size * hl) / 2, b = a * EY.flat, dR = a * EY.depth;
    const c = add(p, mul(n, dR * (2 * EY.bulge - 1))), D = unit(sub(H.D, mul(n, dot(H.D, n))));
    keep(ringPart('eyeR', [-0.92, -0.6, 0, 0.6, 0.92].map((v) => ({ c: add(c, mul(D, v * a)), r: [b * Math.sqrt(1 - v * v), dR * Math.sqrt(1 - v * v)], up: n, d: D })), { group: 'Eye', slots: 'ring12', mirror: 'name', cap: [0.3, 0.3] }));
  }
  const AN = pickForm(ANTENNA_FORMS, B.antennae, 'antennae');
  if (AN) {
    // a CHAIN of carrots (bulbs when beaded), the scape first; bent down along its length, turned at the elbow
    let { p } = surfacePoint(H, AN.at ?? 0.82, AN.socket ?? 55, 0.15);
    // `on: 'snout'` (opt-in): the antennae rise from the rostrum, `onAt` of its length out (a weevil's)
    if (AN.on === 'snout') { const M0 = pickForm(MOUTH_FORMS, B.mouth, 'mouth'), t0 = H.at(1), m0 = add(t0.c, mul(t0.U, -0.35 * t0.h)), d0 = [0, cosd(M0.pitch ?? 0), sind(M0.pitch ?? 0)];
      // on the rostrum's own (bowed) curve, as the piece draws it
      const e0 = add(m0, mul(d0, M0.len * L)), tw = M0.toward || [0, 0, -1], o = sub(tw, mul(d0, dot(tw, d0))), ct = add(mul(add(m0, e0), 0.5), mul(norm(o) > 1e-9 ? unit(o) : [0, 0, 0], (M0.bend || 0) * M0.len * L)), t = AN.onAt ?? 0.5;
      p = add(add(add(mul(m0, (1 - t) ** 2), mul(ct, 2 * (1 - t) * t)), mul(e0, t * t)), mul(Z, M0.r * L * 0.6)); }
    const sock = [Math.max(p[0], (AN.gap ?? 0.012) * L), p[1], p[2]];
    const n = AN.segs || 10, len = AN.len * L, sc = AN.scape ?? 1 / n, lens = Array.from({ length: n }, (_, i) => (i === 0 ? sc : (1 - sc) / (n - 1)) * len);
    let u0 = 0; const segs = lens.map((l, i) => { const ua = u0, ub = u0 + l / len; u0 = ub; const ra = AN.r * L * knots(AN.shape, ua), rb = AN.r * L * knots(AN.shape, Math.min(1, ub));
      return AN.bead ? { len: l, r: Math.max(ra, rb), shape: 'bulb', r0: 0.55, peak: 0.5, end: 0.55 } : { len: l, r: Math.max(ra, 1e-6), shape: 'carrot', end: Math.min(1.6, rb / Math.max(ra, 1e-9)) * 0.92, taper: 0.8 }; });
    const ch = chain('antenna', sock, heading(AN.yaw, AN.rise), segs, (i, d) => { let q = bendDown(d, (AN.curve || 0) / n); q = rotate(q, Z, -(AN.flare || 0) / n);
      if (AN.elbow && i === AN.elbow.at) q = rotate(bendDown(q, AN.elbow.deg), Z, -(AN.elbow.flare || 0)); return q; }, { mirror: 'name', group: 'Antenna', sink: 0.2 });
    keep(ch.parts); const pts = ch.joints;
    if (AN.comb) { const cb = AN.comb, m = cb.count;
      for (let j = 0; j < m * (cb.both ? 2 : 1); j++) { const u = lerp(cb.from, 0.95, (j % m) / Math.max(1, m - 1)), i = Math.min(n - 1, Math.round(u * n)), base = pts[i], d = unit(sub(pts[i + 1], pts[i]));
        const side = unit(cross(d, j < m ? Z : X)), dd = unit(add(mul(side, j < m ? 1 : -1), mul(d, 0.5))), l = cb.len * L * (1 - 0.6 * u);
        keep(piece(`antennaComb${j}R`, base, add(base, mul(dd, l)), { shape: 'chili', r: cb.r * L, group: 'Antenna', mirror: 'name' })); } }
    if (AN.plates) { const tip = pts[n], d = unit(sub(pts[n], pts[n - 1])), acr = unit(cross(d, Z));
      for (let j = 0; j < AN.plates.count; j++) { const off = (j - (AN.plates.count - 1) / 2) * AN.plates.w * L * 0.35, base = add(add(tip, mul(d, -0.3 * AN.plates.len * L)), mul(Z, off * 0.3)), dd = unit(add(d, mul(acr, (j - 1) * 0.35)));
        keep(piece(`antennaPlate${j}R`, base, add(base, mul(dd, AN.plates.len * L)), { shape: 'banana', r: AN.plates.w * L * 0.5, flat: 0.15, up: Z, group: 'Antenna', mirror: 'name' })); } }
    if (AN.bristle) { const tip = pts[n], d = unit(sub(pts[n], pts[n - 1])), dd = unit(add(bendDown(d, -50), mul(X, 0.3)));
      keep(piece('antennaBristleR', tip, add(tip, mul(dd, AN.bristle.len * L)), { shape: 'chili', r: AN.bristle.r * L, bend: 0.1, toward: Z, group: 'Antenna', mirror: 'name' })); }
  }
  const MO = pickForm(MOUTH_FORMS, B.mouth ?? 'mandibles', 'mouth');
  if (MO) {
    const tip = H.at(1), mouth = add(tip.c, mul(tip.U, -0.35 * tip.h)), r = MO.r * L, len = MO.len * L;
    if (MO.kind === 'mandibles') {
      // BANANAS (or chilis): flat crescents from the mouth's sides, opening by `spread`, bowing in toward the midline
      // `pitch` (opt-in, degrees, − down): the jaw tipped about the head's side axis (forcipules curving under, antlers
      // rising); `toward` (opt-in) the side the jaw bows to (default in, −x)
      const base = add(mouth, mul(tip.S, Math.max(0.45 * tip.w, 1.2 * r))), d = rotate(rotate(tip.D, tip.U, -(MO.spread || 0)), tip.S, MO.pitch || 0), end = add(base, mul(d, len));
      const bow = MO.toward || [-1, 0, 0], mj = { shape: MO.shape || 'banana', r, flat: MO.flat ?? 0.5, bend: MO.bend ?? 0.25, toward: bow, up: tip.U, group: 'Mouth', mirror: 'name', n: 8 };
      keep(piece('mandibleR', base, end, mj));
      // TEETH: `tooth` (one, at that share) or `teeth: [{ at, len, dir? }]`, each rooted ON the bowed curve
      const ctrl = add(mul(add(base, end), 0.5), mul((() => { const k = unit(sub(end, base)); const o = sub(bow, mul(k, dot(bow, k))); return norm(o) > 1e-9 ? unit(o) : [0, 0, 0]; })(), mj.bend * len));
      const onCurve = (t) => add(add(mul(base, (1 - t) ** 2), mul(ctrl, 2 * (1 - t) * t)), mul(end, t * t));
      const teeth = MO.teeth || (MO.tooth ? [{ at: MO.tooth, len: 2.6 }] : []);
      teeth.forEach((T, i) => { const b = onCurve(T.at), dd = unit(T.dir || add(mul(X, -1), mul(Z, 0.4)));
        keep(piece(`mandibleTooth${i ? i : ''}R`, b, add(b, mul(dd, r * (T.len ?? 2.6))), { shape: 'carrot', r: r * (T.r ?? 0.55), end: 0, group: 'Mouth', mirror: 'name' })); });
    } else if (MO.kind === 'coil') {
      const n = 28, total = (MO.turns ?? 2) * 360, w = Array.from({ length: n }, (_, i) => dmath.pow(i + 1, 1.3)), ws = w.reduce((s2, x) => s2 + x, 0);
      const pts = trace(add(mouth, mul(tip.D, -0.2 * tip.h)), mul(Z, -1), len, n, (i, d) => rotate(d, X, (total * w[i]) / ws));
      keep(rod('proboscis', pts, pts.map((_, i) => r * lerp(1, 0.5, i / n)), { group: 'Mouth', up: X }));
    } else if (MO.kind === 'needle') {
      const d = [0, cosd(MO.pitch), sind(MO.pitch)], end = add(mouth, mul(d, len));
      // `bend` / `toward` (opt-in): a curved rostrum (an acorn weevil's), bowed toward `toward` (default down)
      keep(piece('proboscis', mouth, end, { shape: 'carrot', r, end: MO.end ?? 0.3, up: X, group: 'Mouth', ...(MO.bend ? { bend: MO.bend, toward: MO.toward || [0, 0, -1], n: 8 } : {}) }));
      if (MO.pad) { const pr = MO.pad * L; keep(ringPart('labellum', [-0.8, 0, 0.8].map((v) => ({ c: add(end, mul(d, v * pr * 0.6)), r: [pr, pr * 0.6], up: Y })), { group: 'Mouth', slots: 'ring8', cap: [0.5, 0.5] })); }
    } else if (MO.kind === 'fangs') {
      const base = add(mouth, mul(tip.S, 0.3 * tip.w));
      keep(piece('fangBaseR', base, add(base, mul(unit([0.05, 0.6, -0.8]), len * 0.6)), { shape: 'carrot', r, end: 0.7, group: 'Mouth', mirror: 'name' }));
      const fb = add(base, mul(unit([0.05, 0.6, -0.8]), len * 0.55));
      keep(piece('fangR', fb, add(fb, mul(unit([-0.4, -0.2, -0.9]), len * 0.6)), { shape: 'chili', r: r * 0.5, bend: 0.3, toward: [0, -1, 0], group: 'Claw', mirror: 'name' }));
    }
  }
  (B.horns || []).forEach((hn, i) => {
    // a horn is a CARROT to a point, bowed back; `x` (opt-in, share of length) sets a mirrored pair off the midline,
    // `yaw` turns it outward (a fork's arms, a Chalcosoma's side horns)
    const on = hn.on === 'pronotum' && pron ? trunk : H, u = hn.at ?? 0.85, a = on.at(u), side = hn.x ? [hn.x * L, 0, 0] : [0, 0, 0];
    const base = add(add(a.c, mul(a.U, a.h * 0.6)), side), d = heading(hn.yaw ?? 0, hn.rise ?? 50), name = `horn${i || ''}${hn.x ? 'R' : ''}`;
    keep(piece(name, base, add(base, mul(d, hn.len * L)), { shape: 'carrot', r: hn.r * L, end: 0, taper: 1.2, bend: hn.bend ?? 0.2, toward: hn.toward ?? [0, -0.6, 1], up: X, group: 'Horn', n: 8, ...(hn.x ? { mirror: 'name' } : {}) }));
  });

  // ── WINGS (blades) and ELYTRA (covers), on the trunk's back ──
  const wingSegs = TR.segments >= 3 ? [1, 2] : [0, 0];
  const wings = B.wings ? (Array.isArray(B.wings) ? { pairs: B.wings } : B.wings) : null;
  (wings?.pairs || []).forEach((w, i) => {
    const W = pickForm(WING_FORMS, w, 'wing'); if (!W) return;
    const pose = { ...(WING_POSES[w.pose ?? wings.pose ?? 'flat'] || {}), ...(wings.poseOver || {}), ...(w.poseOver || {}) };
    if (W.kind === 'elytra') {
      const from = trunk.at(trunk.span(Math.min(1, trunk.n - 1))[1]), m = W.stations ?? 10, st = [], len = W.len * L;
      const ref = (u) => { const y = from.c[1] - u * len; const ut = Math.max(0, Math.min(1, (tailStart[1] - y) / tail.len)); return y > tailStart[1] ? trunk.at(Math.max(0, y / trunk.len)) : tail.at(ut); };
      for (let j = 0; j <= m; j++) { const u = j / m, k = profile(u, W), a = ref(u), we = Math.max(a.w, tail.at(0.3).w) * W.w * k, he = Math.max(a.h, tail.at(0.3).h) * W.h * k;
        st.push({ c: [we / 2, from.c[1] - u * len, a.c[2] + (W.lift ?? 0) * he], r: [we / 2 * 1.02, he], up: Z }); }
      // `seam` (opt-in, share): each case widened across the midline by that share, so the two meet flush (no valley)
      if (W.seam) for (const q of st) { const we = q.c[0] * 2; q.c = [we / 2 * (1 - W.seam), q.c[1], q.c[2]]; q.r = [we / 2 * (1 + W.seam) * 1.02, q.r[1]]; }
      keep(ringPart(`elytron${i ? i : ''}R`, st, { group: W.group, slots: W.slots || 'ring12', mirror: 'name', cap: [0.5, 0.4] }));
      return;
    }
    const seg = trunk.segAt(w.seg ?? wingSegs[Math.min(i, 1)]), { p } = surfacePoint(trunk, seg, w.socket ?? 62, 0.25);
    const roll = (v) => rotate(v, X, pose.roll || 0), dih = (v) => rotate(v, Y, -(pose.dihedral || 0)), sw = (v) => rotate(v, Z, -(pose.sweep || 0));
    const S = sw(dih(roll(X))), Cc = sw(dih(roll(Y)));
    const span = W.len * L, ch = W.chord * L, m = W.stations ?? 9, st = [];   // `stations` / `slots` (opt-in): finer wing rings, for veins
    for (let j = 0; j <= m; j++) { const u = j / m, c = profile(u, W) * ch, spar = add(p, mul(S, u * span * 0.98));
      st.push({ c: add(spar, mul(Cc, (W.lead - 0.5) * c)), r: [Math.max(W.thick * L * 0.5, 1e-6), c / 2], up: Cc, d: S }); }
    keep(ringPart(`wing${i ? (i === 1 ? 'Hind' : i) : 'Fore'}R`, st, { group: W.group, slots: W.slots || 'ring8', mirror: 'name', cap: [0.3, 0.3] }));
  });

  // ── EXTRAS at the tail tip: cerci (chilis; earwig forceps as bananas), a median filament, an ovipositor, a sting,
  // a METASOMA (a scorpion's tail: a chain of carrots curling up over the back, a chili sting), a tail FAN ──
  const tt = tail.at(1);
  for (const x of B.extras || []) {
    const base = add(tt.c, mul(tt.D, -0.05 * tt.h)), r = (x.r ?? 0.008) * L, len = (x.len ?? 0.2) * L;
    if (x.kind === 'cerci') { const b = add(base, mul(X, tt.w * 0.5)), d = heading(180 - (x.spread ?? 25), x.rise ?? 5);
      keep(piece('cercusR', b, add(b, mul(d, len)), { shape: x.shape || 'chili', r, flat: x.flat ?? 1, bend: x.bend ?? 0.08, toward: x.toward ?? (x.shape === 'banana' ? mul(X, -1) : Z), up: Z, group: 'Cerci', mirror: 'name', n: 8 })); }
    else if (x.kind === 'metasoma') {
      const n = x.segs ?? 5, segs = Array.from({ length: n }, (_, i) => ({ len: (len / n) * (1 + 0.15 * i / n), r: r * lerp(1, 0.75, i / n), shape: 'bulb', r0: 0.7, peak: 0.55, end: 0.75 }));
      // the curl: each joint lifts the heading up and over (about x)
      const curled = chain('metasoma', add(tt.c, mul(tt.D, -0.2 * tt.h)), heading(180, x.rise ?? 25), segs, (_, d) => rotate(d, X, -(x.curl ?? 32)), { group: 'Tail', up: X });
      keep(curled.parts);
      const e = curled.joints[n], d = rotate(curled.heading, X, -(x.curl ?? 32)), sl = (x.sting ?? 0.08) * L;
      // `vesicle` (opt-in): the bulb's radius as a share of the tail's; `stingCurl` (degrees) the sting's hook
      keep(piece('telson', sub(e, mul(d, 0.3 * r)), add(e, mul(d, sl * 0.55)), { shape: 'bulb', r: r * (x.vesicle ?? 0.95), r0: 0.6, peak: 0.6, end: 0.5, up: X, group: 'Tail' }));
      const s0 = add(e, mul(d, sl * 0.5)), sd = rotate(d, X, -(x.stingCurl ?? 55));
      keep(piece('sting', s0, add(s0, mul(sd, sl * 0.6)), { shape: 'chili', r: r * 0.4, bend: 0.3, toward: rotate(sd, X, -90), up: X, group: 'Sting' }));
    } else if (x.kind === 'fan') {
      // a crustacean's tail fan: a central telson plate and two uropods a side, flat bananas splayed
      const plate = (nm, yawd, l, w, side) => { const d = heading(180 - yawd, -4), b = add(base, mul(X, side));
        keep(piece(nm, b, add(b, mul(d, l)), { shape: 'bulb', r: w, r0: 0.5, peak: 0.6, end: 0.45, flat: 0.15, up: Z, group: 'Tail', ...(nm.endsWith('R') ? { mirror: 'name' } : {}) })); };
      plate('fanTelson', 0, len, r * 1.6, 0); plate('fanInnerR', 18, len * 0.95, r * 1.5, 0.3 * tt.w); plate('fanOuterR', 38, len, r * 1.6, 0.5 * tt.w);
    } else { const d = heading(180, x.rise ?? (x.kind === 'sting' ? -20 : 0));
      keep(piece(x.kind === 'ovipositor' ? 'ovipositor' : x.kind === 'filament' ? 'filament' : 'sting', base, add(base, mul(d, len)), { shape: x.kind === 'ovipositor' ? 'banana' : 'chili', r, flat: x.kind === 'ovipositor' ? 0.4 : 1, bend: x.bend ?? 0.08, toward: x.kind === 'ovipositor' ? Z : mul(Z, -1), up: X, group: x.kind === 'sting' ? 'Sting' : 'Cerci', n: 8 })); }
  }

  // ── CLEARANCE: the lowest body point `clearance` × length off the ground ──
  // the lowest BODY point (the sections, the pronotum, the elytra) `clearance` off the ground — an antenna or a hanging
  // mouthpart never holds the body up — but no part below the ground
  const body = /^(head|neck|trunk|tail|waist|pronotum|scutellum|elytron\d*R)$/;
  const dz = Math.max((B.clearance ?? 0.05) * L - Math.min(...parts.filter((g) => body.test(g.name)).map(minZ)), -Math.min(...parts.map(minZ)));
  for (const g of parts) shiftPart(g, dz);
  const lift = (sec) => ({ ...sec, at: (u) => { const a = sec.at(u); return { ...a, c: [a.c[0], a.c[1], a.c[2] + dz] }; } });
  const trunkZ = lift(trunk), HZ = lift(H), neckZ = neck ? lift(neck) : null;

  // ── LEGS: a socket per pair on its segment's flank, a manji chain each; grounded feet on z = 0 ──
  const LG = B.legs ?? {}, base = LG.form ?? 'walker', socketDeg = LG.socket ?? -38, legs = [];
  const { form: _f, socket: _s, fore: _a, mid: _b, hind: _c, each: _e, ...shared } = LG;
  const segs = TR.segments, per = TR.legsPer || 1, from = TR.legFrom ?? 0, to = TR.legTo ?? segs - 1, pairs = [];
  for (let s = 0; s <= segs - 1; s++) { const n = s < from || s > to ? (TR.legPairs?.[s] ?? 0) : per;
    for (let j = 0; j < n; j++) { const [lo, hi] = trunk.span(s), half = (hi - lo) / 2; pairs.push(n === 1 ? trunk.segAt(s) : lerp(hi - 0.4 * half, lo + 0.4 * half, j / (n - 1))); } }
  const P = pairs.length;
  pairs.forEach((u, j) => {
    const role = P === 3 ? ['fore', 'mid', 'hind'][j] : j === 0 ? 'fore' : j === P - 1 ? 'hind' : 'mid';
    // every top-level `legs` key but the routing ones is a DEFAULT for every pair, the role's and the pair's own over it
    // (objects one level deep: a role's `angles: { tibia }` keeps the shared `angles.coxa`)
    const over = merge1(merge1(shared, LG[role] || {}), LG.each?.[j] || {});
    const F = pickForm(LEG_FORMS, { form: over.form ?? base, ...over }, `legs[${j}]`);
    if (!F) return;
    const yw = F.yaw; F.yawDeg = F.yawOver ?? (Array.isArray(yw) ? (yw.length === 1 ? yw[0] : (() => { const t = (P === 1 ? 0 : j / (P - 1)) * (yw.length - 1), i = Math.min(yw.length - 2, Math.floor(t)); return lerp(yw[i], yw[i + 1], t - i); })()) : yw);
    // `at` (opt-in): the pair's socket as a share of the trunk from its front (0) to its rear (1)
    const { p } = over.on === 'neck' && neckZ ? surfacePoint(neckZ, over.at ?? 0.85, over.socket ?? socketDeg, 0.2) : surfacePoint(trunkZ, over.at !== undefined ? 1 - over.at : u, over.socket ?? socketDeg, 0.2);
    let leg = buildLeg(`leg${j}`, F, p, L, 'Leg');
    if (over.left) {
      // UNEQUAL SIDES (opt-in, `left: { …overrides }` on a pair): the right leg as built, the left built from the merged
      // overrides as a right leg and mirrored here (a lobster's crusher and cutter, a fiddler crab's one big claw)
      const FL = pickForm(LEG_FORMS, { form: over.form ?? base, ...merge1(over, over.left) }, `legs[${j}].left`); FL.yawDeg = F.yawDeg;
      const lft = buildLeg(`leg${j}`, FL, p, L, 'Leg');
      for (const g of leg.parts) g.mirror = null;
      leg = { ...leg, parts: [...leg.parts, ...lft.parts.map(mirrorRings)], ground: leg.ground && lft.ground };
    }
    keep(leg.parts); legs.push({ pair: j, role, form: over.form ?? base, ground: leg.ground });
  });
  // palps (spiders) and other raised appendages at the head's front
  for (const [i, pp] of (B.palps ? [B.palps] : []).entries()) {
    const F = pickForm(LEG_FORMS, { form: 'palp', ...pp }, 'palps'); F.yawDeg = F.yaw; const { p } = surfacePoint(HZ, 0.85, -20, 0.2);
    keep(buildLeg(`palp${i || ''}`, F, p, L, 'Leg').parts);
  }

  // ── MARKINGS: paint on the parts' own faces (body-paint.js) ──
  const paint = [], palette = {};
  // `on: 'legs'` paints every leg's femur and tibia (a ring at `run` of each); any part name works (`leg2Tibia`: both sides)
  const legParts = legs.flatMap((g) => [`leg${g.pair}Femur`, `leg${g.pair}Tibia`]);
  const secOf = { trunk, tail, head };
  for (const M of B.markings || []) {
    const on = M.on, grp = M.group; if (M.color) palette[grp] = M.color;
    const sec = typeof on === 'string' ? secOf[on] : null;
    if (M.kind === 'segments') {   // whole segments of a section: `which` (0 = its first segment), or every `every` from `offset`
      const n = sec.F.segments || 1, which = M.which ?? Array.from({ length: n }, (_, i) => i).filter((i) => i >= (M.offset ?? 0) && (i - (M.offset ?? 0)) % (M.every ?? 2) === 0);
      for (const i of which) paint.push({ part: on, u: [sec.station(i) + (M.from ?? 0) * sec.per / 2, sec.station(i) + sec.per - (M.trim ?? 0) * sec.per / 2], ...(M.t ? { t: M.t } : {}), group: grp });
    } else if (M.kind === 'veins') {   // `count` thin lines along the part (a wing's veins), each `width` of the ring half
      const n = M.count ?? 5, w = M.width ?? 0.06;
      for (let k = 1; k <= n; k++) { const t = k / (n + 1); paint.push({ part: on, run: M.run ?? [0.05, 1], t: [Math.max(0, t - w / 2), Math.min(1, t + w / 2)], group: grp }); }
    } else if (M.kind === 'spots') for (const [a, t, sa = 0.12, st = 0.18] of M.spots) paint.push({ part: on, run: [Math.max(0, a - sa / 2), Math.min(1, a + sa / 2)], t: [Math.max(0, t - st / 2), Math.min(1, t + st / 2)], group: grp });
    else paint.push({ part: on === 'legs' ? legParts : on, ...(M.run ? { run: M.run } : {}), ...(M.t ? { t: M.t } : {}), ...(M.u ? { u: M.u } : {}), group: grp });
  }

  const plan = {
    schema: 'layered-plan-v1',
    frame: { up: '+z', front: '+y', note: `1 unit = 1 m; ${B.name || 'a bug'}, feet on z = 0, facing +y` },
    joints: {}, segments: parts, dials: {},
    palette: {
      Head: col('head'), ...(neck ? { Neck: col('neck', col('trunk')) } : {}), ...(B.scutellum ? { Scutellum: col('scutellum', col('trunk')) } : {}), Trunk: col('trunk'), Tail: col('tail'), Waist: col('waist', col('tail')), Pronotum: col('pronotum', col('trunk')),
      Leg: col('legs'), Foot: col('feet', col('legs')), Eye: col('eyes', '#20201c'), Antenna: col('antennae', col('legs')), Mouth: col('mouth', col('head')),
      Wing: col('wing', '#c9d3d6'), HindWing: col('hindWing', col('wing', '#c9d3d6')), Tegmen: col('tegmen', col('trunk')), Haltere: col('haltere', col('trunk')),
      Elytra: col('elytra'), Claw: col('claws', col('feet', col('legs'))), Horn: col('horn', col('head')), Cerci: col('cerci', col('tail')), Sting: col('sting', '#2a2420'), ...palette,
    },
  };
  if (paint.length) plan.paint = paint;
  return { plan, readout: { name: B.name || null, length: L, legPairs: legs.length, legs, grounded: legs.filter((g) => g.ground).length * 2, wings: (wings?.pairs || []).length } };
}

/** the readout alone (see assembleBug) */
export const bugReadout = (B) => assembleBug(B).readout;
