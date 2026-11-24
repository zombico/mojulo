/**
 * THE ASSAULT FRAME'S CLIPS — how a frame (body.js) moves, as the page plays a rig figure: per key, per bone, its turn
 * and its pivot (vehicle-rig.js packVehicleFigure's packing, [qx, qy, qz, qw, hx, hy, hz]), the page placing each bone
 * as M·v = head' + q·(v − restHead). The bones are absolute, so the kinematics are worked here: the pelvis carries the
 * core and the hips, the core the head, the booster, the shoulder weapons and the upper arms; each leg is solved to its
 * foot (two bones, the knee bending forward in the leg's plane); the forearms hold their guns forward and level in every
 * clip (an AC always aims), whatever the body does round them.
 *
 *   frameClips(body)   → { idle, forward, boost, boost_left, boost_right, boost_back, hover, fall, land }, each
 *                        { k, b, once? }: what the game selects by the frame's locomotion
 *     idle         one key: a soldier's stance, the guns up
 *     forward      eight keys, looping: a heavy walk, each foot planted, the pelvis dropping onto it
 *     boost        two: the ground skate, knees bent, braced and leaning into it, a slight bob
 *     boost_left / boost_right / boost_back   two each: leaning into the slide, the legs braced against it
 *     hover        two: airborne, the knees tucked, the feet trailing
 *     fall         two: airborne and coming down, the legs reaching for the ground
 *     land         six, once: a deep crouch that takes the landing and stands back up
 *   posedBones(body, clip, key) → Map bone → { q, head }: one key's pose unpacked (what a review draws)
 *
 * Pure: the same body, the same clips.
 */
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const DEG = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ── quaternions [x, y, z, w] ──────────────────────────────────────────────────────────────────────────────────────
const Q0 = Object.freeze([0, 0, 0, 1]);
const qAxis = (ax, a) => { const s = Math.sin(a / 2), u = unit(ax); return [u[0] * s, u[1] * s, u[2] * s, Math.cos(a / 2)]; };
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qRot = (q, v) => { const u = [q[0], q[1], q[2]], t = mul(cross(u, v), 2); return add(add(v, mul(t, q[3])), cross(u, t)); };
/** The turn a 3×3 (columns ex, ey, ez) makes. */
function qMat(ex, ey, ez) {
  const m00 = ex[0], m01 = ey[0], m02 = ez[0], m10 = ex[1], m11 = ey[1], m12 = ez[1], m20 = ex[2], m21 = ey[2], m22 = ez[2];
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}
/** The turn that carries the frame (d0, n0) onto (d, n): a limb's direction and its bending plane's normal. */
function qFrames(d0, n0, d, n) {
  const a = [d0, n0, cross(d0, n0)], b = [d, n, cross(d, n)];
  // R = B · Aᵀ, built as the columns R·e_k
  const col = (k) => [0, 1, 2].map((i) => b[0][i] * a[0][k] + b[1][i] * a[1][k] + b[2][i] * a[2][k]);
  return qMat(col(0), col(1), col(2));
}
/** Pitch (about x), roll (about y), yaw (about z), applied pitch first. */
const qEuler = (pitch = 0, roll = 0, yaw = 0) => qMul(qAxis([0, 0, 1], yaw), qMul(qAxis([0, 1, 0], roll), qAxis([1, 0, 0], pitch)));

// ── a pose: the pelvis's place and turn, the core's, the head's, the arms', and where each foot is ──────────────────
/**
 * One key's bones: Map id → { q, head }. `P`:
 *   root   { off, pitch, roll, yaw }        the pelvis moved from rest (m) and turned (rad)
 *   core   { pitch, roll, yaw }             the core on the pelvis
 *   head   { pitch, yaw }                   the head on the core, past its counter to keep looking ahead
 *   arms   { R: { up, low }, L }            the upper arm's swing and the forearm's pitch off level (rad)
 *   feet   { R: { at | rel, pitch, air? }, L }   the ankle: `at` from its rest place (on the ground), or `rel` from
 *                                            the hip as it is (in the air); the foot's pitch, toes up positive
 */
function pose(body, P) {
  const H = Object.fromEntries(body.bones.map((b) => [b.id, b.head]));
  const has = (id) => id in H;
  const out = new Map();
  const R = P.root ?? {}, Cc = P.core ?? {}, Hd = P.head ?? {};
  const qr = qEuler(R.pitch, R.roll, R.yaw), root = add(H.root, R.off ?? [0, 0, 0]);
  out.set('root', { q: qr, head: root });
  const on = (pid, id, q) => { const p = out.get(pid), h = add(p.head, qRot(p.q, sub(H[id], H[pid]))); out.set(id, { q, head: h }); };
  const qc = qMul(qr, qEuler(Cc.pitch, Cc.roll, Cc.yaw));
  on('root', 'core', qc);
  // (the head looks ahead: it takes back most of the pitch the pelvis and the core lean it by)
  const lean = (R.pitch ?? 0) + (Cc.pitch ?? 0);
  on('core', 'head', qMul(qc, qEuler(-0.75 * lean + (Hd.pitch ?? 0), -0.6 * ((R.roll ?? 0) + (Cc.roll ?? 0)), Hd.yaw ?? 0)));
  for (const id of ['booster', 'backR', 'backL']) if (has(id)) on('core', id, qc);
  // (the arms: the upper arm rides the core; the forearm stays level and forward, turned only with the body's heading)
  const heading = (R.yaw ?? 0) + (Cc.yaw ?? 0);
  for (const s of ['R', 'L']) {
    const A = P.arms?.[s] ?? {};
    if (!has(`armUp${s}`)) continue;
    on('core', `armUp${s}`, qMul(qc, qAxis([1, 0, 0], A.up ?? 0)));
    on(`armUp${s}`, `armLow${s}`, qMul(qAxis([0, 0, 1], heading), qAxis([1, 0, 0], A.low ?? 0)));
  }
  // (the legs: each solved from its hip as the pelvis carries it to its foot, the knee bending forward)
  const L = body.rig.legs, n0 = qRot(qr, [1, 0, 0]);
  for (const s of ['R', 'L']) {
    const sg = s === 'R' ? 1 : -1, mir = (p) => [sg * p[0], p[1], p[2]];
    const hipR = mir(L.hip), kneeR = mir(L.knee), ankleR = mir(L.ankle);
    const F = P.feet?.[s] ?? {};
    const hip = add(root, qRot(qr, sub(hipR, H.root)));
    const ankle = F.rel ? add(hip, mir(F.rel)) : add(ankleR, mir(F.at ?? [0, 0, 0]));
    const u = unit(sub(ankle, hip)), n = unit(sub(n0, mul(u, dot(n0, u)))), w = cross(n, u);
    const D = Math.min(len(sub(ankle, hip)), (L.L1 + L.L2) * 0.9995);
    const ca = Math.max(-1, Math.min(1, (L.L1 ** 2 + D ** 2 - L.L2 ** 2) / (2 * L.L1 * D))), al = Math.acos(ca);
    const knee = add(hip, add(mul(u, L.L1 * Math.cos(al)), mul(w, L.L1 * Math.sin(al))));
    const foot = add(hip, mul(u, D));
    const q1 = qFrames(unit(sub(kneeR, hipR)), [1, 0, 0], unit(sub(knee, hip)), n);
    const q2 = qFrames(unit(sub(ankleR, kneeR)), [1, 0, 0], unit(sub(foot, knee)), n);
    out.set(`thigh${s}`, { q: q1, head: hip });
    out.set(`shin${s}`, { q: q2, head: knee });
    const qf = F.air ? qMul(qAxis(n, F.pitch ?? 0), qEuler(0, R.roll ?? 0, R.yaw ?? 0)) : qMul(qAxis(n, F.pitch ?? 0), qAxis([0, 0, 1], R.yaw ?? 0));
    out.set(`foot${s}`, { q: qf, head: foot });
  }
  return out;
}

const pack = (body, keys) => {
  const b = [];
  for (const P of keys) {
    const m = pose(body, P);
    for (const { id, head } of body.bones) {
      const { q, head: h } = m.get(id) ?? { q: Q0, head };
      b.push(r4(q[0]), r4(q[1]), r4(q[2]), r4(q[3]), r4(h[0]), r4(h[1]), r4(h[2]));
    }
  }
  return { k: keys.length, b };
};

// a leg's reach: what the stride and the tuck are measured in
const reachOf = (body) => body.rig.legs.L1 + body.rig.legs.L2;

/** The frame's clips (see the head of this file). */
export function frameClips(body) {
  const reach = reachOf(body), S = 0.17 * reach;
  const arms = (up = 0, low = 0) => ({ R: { up, low }, L: { up, low } });
  const clips = {};
  clips.idle = pack(body, [{ root: { off: [0, 0, -0.08], pitch: -2 * DEG }, core: { pitch: -1 * DEG }, arms: arms(), feet: { R: { at: [0.04, 0.1, 0] }, L: { at: [0.04, -0.12, 0] } } }]);

  // the walk: each foot on the ground half the cycle (sliding back under the pelvis) and swung through the other half;
  // the pelvis drops onto the foot that lands and sways over the one it stands on
  clips.forward = pack(body, Array.from({ length: 8 }, (_, k) => {
    const p = k / 8, foot = (ph) => {
      const q = ((ph % 1) + 1) % 1;
      if (q < 0.5) return { at: [0, S * (1 - 4 * q), 0], pitch: 0 };
      const t = (q - 0.5) / 0.5, e = t * t * (3 - 2 * t);
      return { at: [0, -S + 2 * S * e, 0.16 * reach * Math.sin(Math.PI * t)], pitch: -16 * DEG * Math.sin(2 * Math.PI * t) };
    };
    return {
      root: { off: [0.1 * Math.sin(2 * Math.PI * p), 0, -0.22 - 0.09 * Math.cos(4 * Math.PI * p)], pitch: -4 * DEG, roll: 2.2 * DEG * Math.sin(2 * Math.PI * p), yaw: 3 * DEG * Math.cos(2 * Math.PI * p) },
      core: { yaw: -5 * DEG * Math.cos(2 * Math.PI * p), pitch: -1.5 * DEG },
      arms: arms(2 * DEG * Math.sin(4 * Math.PI * p), 0),
      feet: { R: foot(p), L: foot(p + 0.5) },
    };
  }));

  // the skate: crouched and leaning into the boost, one foot ahead and the other trailing, a little bob
  const skate = (lean, roll, feet, dz = 0) => ({ root: { off: [0, 0, -0.5 + dz], pitch: lean, roll }, core: { pitch: lean * 0.5, roll: roll * 0.3 }, arms: arms(-lean * 0.4, 0), feet });
  clips.boost = pack(body, [
    skate(-13 * DEG, 0, { R: { at: [0.05, 0.45, 0] }, L: { at: [-0.05, -0.75, 0.1], pitch: -12 * DEG } }),
    skate(-12 * DEG, 0, { R: { at: [0.05, 0.42, 0] }, L: { at: [-0.05, -0.72, 0.12], pitch: -14 * DEG } }, 0.06),
  ]);
  // (sliding sideways: leaning into the slide, the legs braced out against it on the far side)
  const slide = (sg) => [0, 1].map((k) => ({
    root: { off: [sg * 0.25, 0, -0.48 + 0.05 * k], pitch: -4 * DEG, roll: sg * 11 * DEG },
    core: { roll: sg * 3 * DEG, yaw: -sg * 4 * DEG },
    arms: arms(),
    feet: { R: { at: [-sg * 0.45 + 0.1, 0.2, sg > 0 ? 0.12 : 0], pitch: 0 }, L: { at: [sg * 0.45 + 0.1, -0.2, sg < 0 ? 0.12 : 0], pitch: 0 } },
  }));
  // (a foot's `at` is in its own side's terms, mirrored for the left: out is +x for both)
  clips.boost_right = pack(body, slide(1).map((P) => ({ ...P, feet: { R: { at: [-0.4, 0.2, 0] }, L: { at: [0.5, -0.2, 0.14] } } })));
  clips.boost_left = pack(body, slide(-1).map((P) => ({ ...P, feet: { R: { at: [0.5, -0.2, 0.14] }, L: { at: [-0.4, 0.2, 0] } } })));
  clips.boost_back = pack(body, [0, 1].map((k) => ({
    root: { off: [0, 0, -0.45 + 0.05 * k], pitch: 9 * DEG }, core: { pitch: 3 * DEG }, arms: arms(-0.1, 0),
    feet: { R: { at: [0.05, 0.65, 0], pitch: 10 * DEG }, L: { at: [0.05, 0.25, 0], pitch: 8 * DEG } },
  })));

  // airborne: the legs tucked under, the feet trailing toes down; coming down, the legs reaching for the ground
  clips.hover = pack(body, [0, 1].map((k) => ({
    root: { off: [0, 0, 0.04 * k], pitch: -7 * DEG }, core: { pitch: -2 * DEG }, arms: arms(),
    feet: { R: { rel: [0.02, -0.45 - 0.05 * k, -0.74 * reach], pitch: -42 * DEG, air: true }, L: { rel: [0.02, -0.95 + 0.05 * k, -0.68 * reach], pitch: -48 * DEG, air: true } },
  })));
  clips.fall = pack(body, [0, 1].map((k) => ({
    root: { off: [0, 0, 0.03 * k], pitch: 4 * DEG }, core: { pitch: 2 * DEG }, arms: arms(-0.06, 0),
    feet: { R: { rel: [0.04, 0.3, -0.955 * reach], pitch: -14 * DEG, air: true }, L: { rel: [0.04, -0.15 + 0.04 * k, -0.93 * reach], pitch: -18 * DEG, air: true } },
  })));

  // the landing: down into a deep crouch, the core pitching over the knees, and back up
  const crouch = [0.1, 0.75, 1.05, 0.8, 0.4, 0.08];
  clips.land = { ...pack(body, crouch.map((c) => ({
    root: { off: [0, -0.08 * c, -c], pitch: -10 * DEG * c }, core: { pitch: -8 * DEG * c }, arms: arms(-0.15 * c, 0),
    feet: { R: { at: [0.06, 0.1, 0] }, L: { at: [0.06, -0.05, 0] } },
  }))), once: true };
  return clips;
}

/** One key of a clip unpacked: Map bone → { q, head }. */
export function posedBones(body, clip, key = 0) {
  const n = body.bones.length, out = new Map();
  body.bones.forEach((b, i) => { const o = (key * n + i) * 7, v = clip.b.slice(o, o + 7); out.set(b.id, { q: v.slice(0, 4), head: v.slice(4, 7) }); });
  return out;
}

/** A point of a bone's rest mesh where a key puts it: head' + q·(v − restHead). */
export function placeOn(rest, pose, v) { return add(pose.head, qRot(pose.q, sub(v, rest))); }
