/**
 * ridden — what riding asks of the mount and of whoever rides it, as data and arithmetic (no character needed: the
 * rider is a function, any character the studio makes can be put on the horse by it, rider.js): the seats (RIDER_MODES)
 * and which one each moment of each clip asks for, the rising trot's arch from the horse's own footfalls, and the
 * ridden head carriage the horse takes under a rider.
 *
 *   RIDER_MODES, riderModeAt(name, clip, t), riderClipModes(name, clip, frames, keyTime)
 *   CARRIAGE, carriageOf(stand), riddenFrame(frame, turns, w)
 *   ridingGeometry(anchors, frames, rest) → where a rider meets the horse in a pose (the seat, its axes, the bars, the
 *     bits, the crest)
 *   rideTargets(geo, mode, cal, { rise, seatHold }) → what the moment asks of any rider: the sit bones' point, the
 *     pelvis's pitch and roll, the trunk's lean, the irons' treads, the arms' setting (the character solves its own rig to
 *     these: rider.js; an engine's IK to the export's sockets)
 *   reinCurve(bit, hand, length, n) → a rein of fixed length from the bit to the fist, taut or sagging
 */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const DEG = 180 / Math.PI;
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));

/** the iron's tread under the leather's end (tack.js: the ring's centre 5.5 cm under it, its radius 6 cm squashed to 0.85) */
export const IRON_DROP = 0.055 + 0.06 * 0.85;

/** a world point carried from the stand into a pose by a bone (rest and pose frames: skin.js boneFrames) */
const carry = (rest, pose, bone, p) => { const r = rest[bone], q = pose[bone], d = sub(p, r.h), l = [dot(d, r.R[0]), dot(d, r.R[1]), dot(d, r.R[2])]; return add(add(add(mul(q.R[0], l[0]), mul(q.R[1], l[1])), mul(q.R[2], l[2])), q.h); };
const carryDir = (rest, pose, bone, v) => { const r = rest[bone], q = pose[bone], l = [dot(v, r.R[0]), dot(v, r.R[1]), dot(v, r.R[2])]; return add(add(mul(q.R[0], l[0]), mul(q.R[1], l[1])), mul(q.R[2], l[2])); };

/** where the rider meets the horse in a pose: the seat (on the saddle's bone), its axes, the bars, the bits, the crest */
export function ridingGeometry(anchors, frames, rest) {
  const fwd = unit(carryDir(rest, frames, 'saddle', [0, 1, 0])), side = unit(carryDir(rest, frames, 'saddle', [1, 0, 0]));
  return {
    seat: carry(rest, frames, 'saddle', anchors.seat), fwd, side, up: unit([side[1] * fwd[2] - side[2] * fwd[1], side[2] * fwd[0] - side[0] * fwd[2], side[0] * fwd[1] - side[1] * fwd[0]]),
    bars: { R: carry(rest, frames, 'saddle', anchors.bars.R), L: carry(rest, frames, 'saddle', anchors.bars.L) },
    bits: { R: carry(rest, frames, 'head', anchors.bits.R), L: carry(rest, frames, 'head', anchors.bits.L) },
    crest: carry(rest, frames, 'neck0', anchors.crest),
  };
}


/**
 * What the moment asks of a rider, whoever it is: the sit bones' point (on the seat, or out of it by the seat's lift and
 * the rising trot's rise, a share of the saddle's motion taken: the rest held by the legs), the pelvis's pitch and roll
 * (following the saddle's), the trunk's lean (the world's), the irons' treads (the leathers `cal.leather` long from the
 * bars, the irons `cal.out` round the barrel), the arms' setting (`elbow`: the shoulder's flexion), the bits.
 */
export function rideTargets(geo, mode, cal, { rise = 0, seatHold = null } = {}) {
  const pitchS = Math.atan2(geo.fwd[2], Math.hypot(geo.fwd[0], geo.fwd[1])) * DEG, rollS = Math.atan2(geo.side[2], Math.hypot(geo.side[0], geo.side[1])) * DEG;
  const seatAt = seatHold ? lerp(seatHold, geo.seat, mode.follow) : geo.seat;
  const fwdFlat = unit([geo.fwd[0], geo.fwd[1], 0]), lift = mode.lift + rise;
  const seat = add(add(seatAt, [0, 0, lift]), mul(fwdFlat, 0.4 * lift));
  const L = cal.leather + mode.stirrup, irons = {};
  for (const S of ['R', 'L']) irons[S] = add(add(geo.bars[S], mul(geo.side, (S === 'R' ? 1 : -1) * (cal.out ?? 0))), [0, 0, -(L + IRON_DROP)]);
  return { seat, pitch: -pitchS * mode.follow + mode.pelvis, roll: rollS * mode.follow, lean: mode.lean, irons, elbow: mode.elbow, bits: geo.bits, fwdFlat, side: geo.side };
}

/**
 * A rein of fixed `length` from the bit to the fist: taut (straight) where they are that far apart, else hanging in a
 * loop (a parabola in the vertical through them, its sag found so its length is the rein's), `n` equal lengths along it.
 */
export function reinCurve(bit, hand, length, n = 4) {
  const d = Math.hypot(...sub(hand, bit)), at = (sag) => (u) => add(lerp(bit, hand, u), [0, 0, -4 * sag * u * (1 - u)]);
  const arc = (f, m = 32) => { let L = 0, p = f(0); const out = [[0, 0]]; for (let i = 1; i <= m; i++) { const q = f(i / m); L += Math.hypot(...sub(q, p)); out.push([i / m, L]); p = q; } return out; };
  let f = at(0);
  if (length > d * 1.0005) { let lo = 0, hi = length; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (arc(at(m)).at(-1)[1] < length) lo = m; else hi = m; } f = at((lo + hi) / 2); }
  // (equal lengths along it: the arc's table inverted)
  const tab = arc(f, 64), total = tab.at(-1)[1], pts = [];
  for (let k = 0; k <= n; k++) {
    const want = total * k / n; let i = 1; while (i < tab.length - 1 && tab[i][1] < want) i++;
    const [u0, l0] = tab[i - 1], [u1, l1] = tab[i], u = u0 + (u1 - u0) * ((want - l0) / ((l1 - l0) || 1));
    pts.push(f(u));
  }
  return pts;
}

/** the modes' parameters: `lift` the seat above the saddle (m), `rise` the rising trot's height at its top (m: its arch
 * from the footfalls), `follow` the share of the saddle's motion the pelvis
 * takes, `lean` the trunk forward of upright (deg), `pelvis` its own forward tilt (deg), `stirrup` the leathers'
 * change (m: shorter is negative), `elbow` the shoulder's flexion: the upper arm forward of the TRUNK's own down (deg:
 * by the sides when sitting, reaching forward in two-point, the jump's release further: within the shoulder's 90°; the
 * hands go where the elbow and the bit put them), `carriage` the share of the ridden head carriage the horse takes
 * (CARRIAGE: in hand at the walk, the trot and the canter, half stretched at the gallop, free over the fence and grazing) */
export const RIDER_MODES = Object.freeze({
  sit: { lift: 0, rise: 0, follow: 1, lean: 2, pelvis: 0, stirrup: 0, elbow: 5, carriage: 1 },
  rise: { lift: 0, rise: 0.085, follow: 1, lean: 12, pelvis: 4, stirrup: 0, elbow: 10, carriage: 1 },
  two: { lift: 0.11, rise: 0, follow: 0.35, lean: 34, pelvis: 12, stirrup: -0.05, elbow: 50, carriage: 0.5 },
  fold: { lift: 0.12, rise: 0, follow: 0.35, lean: 58, pelvis: 18, stirrup: -0.05, elbow: 70, carriage: 0 },
  graze: { lift: 0, rise: 0, follow: 1, lean: 4, pelvis: 0, stirrup: 0, elbow: 30, carriage: 0 },
});
const KEYS = Object.keys(RIDER_MODES.sit);
const blend = (a, b, w) => Object.fromEntries(KEYS.map((k2) => [k2, a[k2] + (b[k2] - a[k2]) * w]));

/** a clip's seat at time t: the gait's, a transition's blended over its middle, the jump's keyed to its flight */
export function riderModeAt(name, clip, t) {
  const gaitMode = (g) => (g === 'trot' ? 'rise' : g === 'gallop' ? 'two' : 'sit');
  const M = RIDER_MODES, tr = /^([a-zA-Z]+)-([a-zA-Z]+)$/.exec(name);
  if (name === 'graze') { const u = t / clip.s; return blend(M.sit, M.graze, sm(u / 0.25) * sm((1 - u) / 0.25)); }
  if (name === 'jump') {
    const f = clip.flight, w = sm((t - (f.launch - 0.35)) / 0.3) * sm((f.touchdown + 0.4 - t) / 0.35), app = sm((t - 0.2) / 0.6) * sm((clip.s - 0.3 - t) / 0.6);
    return blend(blend(M.sit, M.two, app), M.fold, w);
  }
  if (tr && !/^idle/.test(name)) { const a = M[gaitMode(tr[1])], b = M[gaitMode(tr[2])], w = sm((t / clip.s - 0.3) / 0.4); return blend(a, b, w); }
  return M[gaitMode(name)];
}

/**
 * THE RIDDEN HEAD CARRIAGE: a horse under a rider carries its neck up from the withers (the poll the highest point) and
 * its face nearer the vertical (flexed at the poll, the nose in: the bit comes back toward the rider's hands, a little
 * lower) than it does loose. Laid on any solved frame: the neck and everything on it turned up at the neck's base by `raise`, then the head
 * flexed at the poll until its face line stands `face` in front of the vertical at the stand (the same turns every
 * frame, so the gait's own nod rides on top), by `w` (the seat's share: CARRIAGE per mode).
 */
export const CARRIAGE = Object.freeze({ raise: 8, face: 18 });
const NECK_TREE = ['neck0', 'neck1', 'neck2', 'neck3', 'neck4', 'head', 'jaw', 'earR', 'earL', 'bit'], HEAD_TREE = ['head', 'jaw', 'earR', 'earL', 'bit'];
const turnAbout = (p, c, ax, a) => { const v = sub(p, c), cs = Math.cos(a), sn = Math.sin(a), k = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]]; return add(c, add(add(mul(v, cs), mul(k, sn)), mul(ax, dot(ax, v) * (1 - cs)))); };
/** the carriage's two turns (radians) for a horse, from its stand: the neck's raise, then the poll's flexion */
export function carriageOf(stand) {
  const raise = CARRIAGE.raise / DEG, h = stand.bones.head, v = sub(h.tail, h.head);
  // (the head's line from straight down, after the raise: its forward share turned up by the raise)
  const y = v[1] * Math.cos(raise) - v[2] * Math.sin(raise), z = v[1] * Math.sin(raise) + v[2] * Math.cos(raise), fromDown = Math.atan2(y, -z);
  return { raise, flex: -(fromDown - CARRIAGE.face / DEG) };
}
export function riddenFrame(frame, turns, w = 1) {
  if (!(w > 0)) return frame;
  const b = frame.bones, side = unit(sub(b.scapulaR.head, b.scapulaL.head)), base = b.neck0.head, poll0 = b.head.head, out = { ...b };
  for (const id of NECK_TREE) out[id] = { head: turnAbout(b[id].head, base, side, turns.raise * w), tail: turnAbout(b[id].tail, base, side, turns.raise * w) };
  const poll = out.head.head;
  for (const id of HEAD_TREE) out[id] = { head: turnAbout(out[id].head, poll, side, turns.flex * w), tail: turnAbout(out[id].tail, poll, side, turns.flex * w) };
    return { ...frame, bones: out };
}

/**
 * Each key's mode for a clip: the gait's seat, a transition's blended from the one it leaves to the one it reaches over
 * its middle, the jump's fold keyed to its flight; and the rising trot's rise from the footfalls (out of the saddle while
 * the left fore stands, a smooth arch over its stance). `frames` the clip's solved poses at its keys, `keyTime(k)`.
 */
export function riderClipModes(name, clip, frames, keyTime) {
  const K = frames.length, modeAt = (t) => riderModeAt(name, clip, t);
  // the left fore's stances over the keys (wrapping round a loop) → the rise's arch, sin² over each stance
  const on = frames.map((f) => !!f.contact?.LF), loop = !clip.once, arch = new Array(K).fill(0);
  for (let k = 0; k < K; k++) {
    if (!on[k]) continue;
    let a = k, b = k;
    for (let i = 1; i < K && on[(k - i + K) % K] && (loop || k - i >= 0); i++) a = k - i;
    for (let i = 1; i < K && on[(k + i) % K] && (loop || k + i < K); i++) b = k + i;
    arch[k] = Math.sin(Math.PI * (k - a + 0.5) / (b - a + 1)) ** 2;
  }
  return frames.map((f, k) => { const m = modeAt(keyTime(k)); return { mode: m, rise: m.rise * arch[k] }; });
}

// ─── the export's riding interface ──────────────────────────────────────────────────────────────────────────────
/** a bone's rotation from the stand into a pose, row-major (a rest vector v → Σ_k (R_k·v) P_k) */
const turnOf = (r, p) => [0, 1, 2].map((a) => [0, 1, 2].map((b) => p.R[0][a] * r.R[0][b] + p.R[1][a] * r.R[1][b] + p.R[2][a] * r.R[2][b]));
const mv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const mm = (A, B2) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[i][0] * B2[0][j] + A[i][1] * B2[1][j] + A[i][2] * B2[2][j]));
/** the shortest rotation carrying unit a onto unit b (row-major) */
function between(a, b) {
  const v = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], c = dot(a, b);
  if (dot(v, v) < 1e-18) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const K = [[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]], f = 1 / (1 + c);
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + K[i][j] + f * (K[i][0] * K[0][j] + K[i][1] * K[1][j] + K[i][2] * K[2][j])));
}

/**
 * THE SOCKETS a ridden export carries for whoever rides it (an engine's own characters, by its IK): `socket:saddle` the
 * seat's middle on the saddle, `socket:seat` where the sit bones go in the moment (the seat's lift, the rising trot,
 * the two-point's steadier seat), `socket:bar*` the stirrup bars, `socket:iron*` the irons' treads (`cal`: the
 * leathers and how far round the barrel), `socket:bit*` the bit's rings. Each turns as the bone it rides (the saddle's,
 * the head's). → { joints, keys(targets, geo, frames, rest) }
 */
export function rideSockets(anchors, rest, cal) {
  const geo0 = ridingGeometry(anchors, rest, rest), t0 = rideTargets(geo0, RIDER_MODES.sit, cal);
  const spec = [
    ['socket:saddle', 'saddle', geo0.seat, (g) => g.seat],
    ['socket:seat', 'saddle', t0.seat, (g, T) => T.seat],
    ['socket:barR', 'saddle', geo0.bars.R, (g) => g.bars.R], ['socket:barL', 'saddle', geo0.bars.L, (g) => g.bars.L],
    ['socket:ironR', 'saddle', t0.irons.R, (g, T) => T.irons.R], ['socket:ironL', 'saddle', t0.irons.L, (g, T) => T.irons.L],
    ['socket:bitR', 'head', geo0.bits.R, (g) => g.bits.R], ['socket:bitL', 'head', geo0.bits.L, (g) => g.bits.L],
  ];
  return {
    joints: spec.map(([id, , h]) => ({ id, head: h, tail: add(h, [0, 0.05, 0]) })),
    keys: (T, geo, frames) => spec.map(([, bone, , at]) => ({ R: turnOf(rest[bone], frames[bone]), h: at(geo, T) })),
  };
}

/**
 * THE REINS on chains: from each bit ring to its fist, `length` long, `n` joints along it; the ribbon laid along the
 * rest's curve and skinned to them (a vertex wholly on its stretch's joint). A key: the curve at that moment (taut or
 * looping), each joint at its point turned from its rest stretch onto its posed one. → { joints, mesh, keys(bits, fists) }
 */
export function reinRig(restBits, restFists, length, { n = 4, width = 0.018, thick = 0.005, colour = '#5a3a24' } = {}) {
  const joints = [], vertices = [], quads = [], colors = [], skin = [], rest = {};
  for (const S of ['R', 'L']) {
    const pts = reinCurve(restBits[S], restFists[S], length, n); rest[S] = pts;
    for (let j = 0; j < n; j++) joints.push({ id: `rein:${S}:${j}`, head: pts[j], tail: pts[j + 1] });
    // (a flat strap: four rails along the curve, its width across, its thickness up)
    const base = vertices.length, sub2 = 3;
    for (let j = 0; j < n; j++) for (let s2 = 0; s2 <= (j === n - 1 ? sub2 : sub2 - 1); s2++) {
      const p = lerp(pts[j], pts[j + 1], s2 / sub2), t = unit(sub(pts[j + 1], pts[j])), w = unit([-t[1], t[0], 0]);
      for (const [a, b] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { vertices.push(add(add(p, mul(w, a * width / 2)), [0, 0, b * thick])); skin.push([[`rein:${S}:${j}`, 1]]); }
    }
    const rings = (vertices.length - base) / 4;
    for (let r = 0; r + 1 < rings; r++) for (let s3 = 0; s3 < 4; s3++) { const a = base + 4 * r, b = a + 4; quads.push([a + s3, b + s3, b + ((s3 + 1) % 4), a + ((s3 + 1) % 4)]); colors.push(colour); }
  }
  return {
    joints, mesh: { vertices, quads, colors, skin },
    keys: (bits, fists) => ['R', 'L'].flatMap((S) => {
      const pts = reinCurve(bits[S], fists[S], length, n);
      return Array.from({ length: n }, (_, j) => ({ R: between(unit(sub(rest[S][j + 1], rest[S][j])), unit(sub(pts[j + 1], pts[j]))), h: pts[j] }));
    }),
  };
}
void mv; void mm;
