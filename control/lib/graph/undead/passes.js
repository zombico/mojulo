/**
 * THE UNDEAD PASSES: what a card's words do to the creature biped (egocube/plan.js `biped`: its joints, its segments,
 * its finger joints). Each pass changes only what its word names; the joints the rig is built from move with the body,
 * so the rig (dialsAndRig, run after) is the body's own.
 *
 *   fleshPasses(body, card, { k, g, rand })   a zombie's: waste, bloat, longer arms, one heavy arm, a seeded loss
 *   bonePasses(body, card, { k, g, chest, hips, rand })   a skeleton's: the trunk replaced by its frame (a spine, a rib cage
 *                       of curved ribs, a sternum, the collarbones, a pelvis basin), every limb a shaft with knobbed ends
 *   posture(card, rand)  → { lean, crouch, jaw, arms: { R, L }, head }: the rest the body stands in (the rig's READY)
 *
 * Each returns { body, lost? } (lost: { part, side }). Pure: the dice are the caller's (`rand`, a seeded stream).
 */
const r3 = (x) => Math.round(x * 1000) / 1000;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const mirrorX = (p) => [r3(-p[0]) + 0, p[1], p[2]];
const scaleR = (r, s) => (Array.isArray(r) ? r.map((x) => r3(x * s)) : r3(r * s));

const LIMB = /^(thigh|shin|meta|toes|upperArm|foreArm|hand|finger)/;
const ARM = /^(upperArm|foreArm|hand|finger)/;
const ARM_JOINTS = ['elbow', 'wrist', 'knuckles'];
const sideOf = (rand) => (rand() < 0.5 ? 'R' : 'L');

// the arm's joints after `shoulder` pushed out along the arm by `len` (1 is the living arm's), the finger joints with them
function lengthenArms(body, len) {
  if (len === 1) return;
  const { J } = body, S = J.shoulder;
  for (const n of ARM_JOINTS) { J[n] = add(S, mul(sub(J[n], S), len)).map(r3); body.joints[n] = J[n]; }
  body.FINGERS.forEach((X, i) => { const { k, m, e } = body.fingerJoints(i); Object.assign(body.joints, { [`finger${X}k`]: k.map(r3), [`finger${X}m`]: m.map(r3), [`finger${X}e`]: e.map(r3) }); });
}

// the arm parts authored on both sides (each its own radii, one side's parts able to go): the left's joints mirrored
function splitArms(body) {
  const arms = body.segments.filter((s) => ARM.test(s.name) && s.mirror === 'name');
  const L = (n) => n.replace(/R$/, 'L'), jL = (j) => `${j}__L`;
  for (const s of arms) {
    for (const j of [s.from, s.to]) if (!body.joints[jL(j)]) body.joints[jL(j)] = mirrorX(body.joints[j] ?? body.J[j]);
    delete s.mirror;
    const twin = { ...s, name: L(s.name), from: jL(s.from), to: jL(s.to), bind: { bone: L(s.bind.bone), ...(s.bind.prev ? { prev: s.bind.prev === 'torso' ? 'torso' : L(s.bind.prev) } : {}), ...(s.bind.next ? { next: L(s.bind.next) } : {}) } };
    body.segments.push(twin);
  }
}

// a seeded loss: one of `parts` on one side, gone from the skin (its bones stay rigged)
function lose(body, card, rand) {
  const L = card.loss;
  if (!L) return null;
  const roll = rand(), part = L.parts[Math.floor(rand() * L.parts.length)], side = sideOf(rand);
  if (roll >= L.odds) return null;
  const gone = part === 'foreArm' ? /^(foreArm|hand|finger)/ : /^(hand|finger)/;
  body.segments = body.segments.filter((s) => !(gone.test(s.name) && s.name.endsWith(side)));
  return { part, side };
}

export function fleshPasses(body, card, { rand }) {
  const W = card.waste ?? { limbs: 1, trunk: 1 }, B = card.bloat ?? null;
  lengthenArms(body, card.arms?.length ?? 1);
  const lossy = !!card.loss, heavy = card.heavy ?? null;
  if (lossy || heavy) splitArms(body);
  for (const s of body.segments) {
    if (s.kind === 'trunk') {
      const k = W.trunk * (B ? B.trunk : 1);
      s.stations = s.stations.map((st) => ({ ...st, r: scaleR(st.r, k) }));
    } else if (LIMB.test(s.name)) {
      let k = W.limbs * (B ? B.limbs : 1);
      if (heavy && ARM.test(s.name)) k *= s.name.endsWith(heavy.side) ? heavy.k : 1 / heavy.k;
      s.rA = scaleR(s.rA, k); s.rB = scaleR(s.rB, k); if (s.rMid) s.rMid = scaleR(s.rMid, k);
    } else if (s.name === 'neck') {
      const k = (W.limbs + W.trunk) / 2;
      s.rA = scaleR(s.rA, k); s.rB = scaleR(s.rB, k);
    }
  }
  const lost = lossy ? lose(body, card, rand) : null;
  return { body, lost };
}

// ── the skeleton's frame ──
// (template metres at 2 m tall, × k for the body's height and × the card's bone weights; the frame's shapes are a
// skeleton's read at play distance, not an anatomy plate)
const BONE = { femur: [0.05, 0.026, 0.044], tibia: [0.044, 0.022, 0.034], meta: [0.03, 0.018], toes: [0.024, 0.012], humerus: [0.04, 0.02, 0.032], radius: [0.032, 0.016, 0.026], hand: [0.03, 0.016], finger: [0.011, 0.009] };
const RIBS = [{ z: 1.47, w: 0.72 }, { z: 1.415, w: 0.86 }, { z: 1.36, w: 0.93 }, { z: 1.305, w: 0.95 }, { z: 1.25, w: 0.9 }, { z: 1.2, w: 0.78 }];

export function bonePasses(body, card, { k, g, chest, hips, rand }) {
  const Bw = card.bones ?? { shaft: 1, ends: 1, ribs: 1 };
  lengthenArms(body, card.arms?.length ?? 1);
  const lossy = !!card.loss;
  if (lossy) splitArms(body);
  const P = (p) => p.map((x) => r3(x * k)), R = (r) => r3(r * k * g);
  const end = (x) => R(x * Bw.ends), shaft = (x) => R(x * Bw.shaft);
  const J = body.J;
  // the spine: three joints up the back from the pelvis to the neck
  Object.assign(body.joints, { spine0: P([0, -0.05, 0.98]), spine1: P([0, -0.085, 1.2]), spine2: P([0, -0.075, 1.42]), sternumTop: P([0, 0.125, 1.47]), sternumLow: P([0, 0.115, 1.27]) });
  const knee = (s, [a, m, b]) => ({ ...s, rA: end(a), rB: end(b ?? a), rMid: shaft(m), mid: 0.5, over: [0.35, 0.35] });
  const keep = [];
  for (const s of body.segments) {
    if (s.kind === 'trunk' && s.name === 'torso') continue;
    if (s.kind === 'trunk' && s.name === 'pelvis') {
      // the sacrum: a small wedge at the back the spine rises from (the hip blades and the arch are the frame's)
      keep.push({ ...s, stations: [{ z: r3(0.84 * k), r: [R(0.03), R(0.025)], yc: r3(-0.06 * k) }, { z: r3(0.92 * k), r: [R(0.055), R(0.035)], yc: r3(-0.065 * k) }, { z: r3(0.99 * k), r: [R(0.05), R(0.03)], yc: r3(-0.06 * k) }],
        caps: { back: P([0, -0.06, 0.82]), tip: P([0, -0.06, 1.01]) } });
      continue;
    }
    if (s.name === 'neck') { keep.push({ ...s, rA: R(0.028 * Bw.shaft), rB: R(0.024 * Bw.shaft) }); continue; }
    if (/^thigh/.test(s.name)) { keep.push(knee(s, BONE.femur)); continue; }
    if (/^shin/.test(s.name)) { keep.push(knee(s, BONE.tibia)); continue; }
    if (/^upperArm/.test(s.name)) { keep.push(knee(s, BONE.humerus)); continue; }
    if (/^foreArm/.test(s.name)) { keep.push(knee(s, BONE.radius)); continue; }
    if (/^meta/.test(s.name)) { keep.push({ ...s, rA: end(BONE.meta[0]), rB: [end(BONE.meta[0] * 1.3), end(BONE.meta[1])], rMid: undefined }); continue; }
    if (/^toes/.test(s.name)) { keep.push({ ...s, rA: [end(BONE.toes[0] * 1.4), end(BONE.toes[1])], rB: [end(BONE.toes[0]), end(BONE.toes[1] * 0.8)], rMid: undefined }); continue; }
    if (/^hand/.test(s.name)) { keep.push({ ...s, rA: [end(BONE.hand[0]), end(BONE.hand[1])], rB: [end(BONE.hand[0] * 1.3), end(BONE.hand[1] * 0.8)], rMid: undefined }); continue; }
    if (/^finger/.test(s.name)) { keep.push({ ...s, rA: end(BONE.finger[0]), rB: end(BONE.finger[1]), rMid: undefined }); continue; }
    keep.push(s);
  }
  for (const s of keep) if (s.rMid === undefined) delete s.rMid;
  const ribR = R(0.011 * Bw.ribs), cw = chest * g;
  const frame = [
    { name: 'spineLow', kind: 'segment', from: 'spine0', to: 'spine1', rA: R(0.034 * Bw.shaft), rB: R(0.03 * Bw.shaft), group: 'Torso', tint: '#cccccc', mirror: 'plane', bind: { bone: 'pelvis', blend: { st2: { pelvis: 0.5, torso: 0.5 }, tip: { torso: 1 } } } },
    // (named `torso`: the dials and the rig's lean hinge the body by its torso part)
    { name: 'torso', kind: 'segment', from: 'spine1', to: 'spine2', rA: R(0.03 * Bw.shaft), rB: R(0.028 * Bw.shaft), group: 'Torso', tint: '#cccccc', mirror: 'plane', bind: { bone: 'torso' } },
    { name: 'spineHigh', kind: 'segment', from: 'spine2', to: 'neckBase', rA: R(0.028 * Bw.shaft), rB: R(0.026 * Bw.shaft), group: 'Torso', tint: '#cccccc', mirror: 'plane', bind: { bone: 'torso', blend: { tip: { neck: 1 } } } },
    { name: 'sternum', kind: 'segment', from: 'sternumTop', to: 'sternumLow', rA: R(0.022 * Bw.ribs), rB: R(0.016 * Bw.ribs), group: 'Torso', tint: '#cccccc', mirror: 'plane', bind: { bone: 'torso' } },
    // the hip blades: each a flared rim from the sacrum up over the hip and round to the front, and the arch below it
    // from the hip socket in to the midline (the femur's head seats between them)
    ...(() => { const h = (hips * g) / 0.22, x = (v) => r3(v * h * k), at = (p) => [x(p[0]), r3(p[1] * k), r3(p[2] * k)], rim = R(0.024 * Bw.ribs), arch = R(0.018 * Bw.ribs);
      return [
        { name: 'iliumR', kind: 'loft', stations: [[0.04, -0.07, 0.96], [0.11, -0.085, 1.01], [0.17, -0.03, 1.02], [0.18, 0.04, 0.97], [0.14, 0.075, 0.9]].map((p) => ({ at: at(p), r: rim })), group: 'Pelvis', tint: '#cccccc', mirror: 'name', bind: { bone: 'pelvis' } },
        { name: 'pubisR', kind: 'loft', stations: [[0.14, 0.075, 0.9], [0.12, 0.06, 0.84], [0.07, 0.08, 0.81], [0.015, 0.095, 0.79]].map((p) => ({ at: at(p), r: arch })), group: 'Pelvis', tint: '#cccccc', mirror: 'name', bind: { bone: 'pelvis' } },
        { name: 'ischiumR', kind: 'loft', stations: [[0.12, 0.06, 0.84], [0.11, -0.02, 0.8], [0.06, -0.05, 0.83], [0.035, -0.06, 0.86]].map((p) => ({ at: at(p), r: arch })), group: 'Pelvis', tint: '#cccccc', mirror: 'name', bind: { bone: 'pelvis' } },
      ]; })(),
    // the collarbones: from the top of the breastbone out to the shoulder
    { name: 'clavR', kind: 'loft', stations: [{ at: P([0.03, 0.12, 1.49]), r: R(0.013 * Bw.ribs) }, { at: add(mul(add(P([0.03, 0.12, 1.49]), J.shoulder), 0.5), P([0, 0.01, 0.02])).map(r3), r: R(0.012 * Bw.ribs) }, { at: J.shoulder.map(r3), r: R(0.015 * Bw.ribs) }], group: 'Torso', tint: '#cccccc', mirror: 'name', bind: { bone: 'torso' } },
    // the ribs: each a curve from the spine round the side to the breastbone (the low ones stop short: they float)
    ...RIBS.map(({ z, w }, i) => {
      const x = cw * w * k, front = i < 4, zz = (dz) => r3((z + dz) * k);
      const at = [[0.03 * k, -0.075 * k, zz(0)], [x * 0.62, -0.1 * k, zz(-0.012)], [x * 0.97, -0.02 * k, zz(-0.035)], [x * 0.9, 0.065 * k, zz(-0.06)], [x * (front ? 0.5 : 0.62), 0.11 * k, zz(-0.08)], ...(front ? [[0.028 * k, 0.12 * k, zz(-0.09)]] : [])];
      return { name: `rib${i}R`, kind: 'loft', stations: at.map((p) => ({ at: p.map(r3), r: ribR })), group: 'Torso', tint: '#cccccc', mirror: 'name', bind: { bone: 'torso' } };
    }),
  ];
  body.segments = [...keep.filter((s) => s.name === 'pelvis'), ...frame, ...keep.filter((s) => s.name !== 'pelvis')];
  const lost = lossy ? lose(body, card, rand) : null;
  // (the frame's parts the lean hinges with the torso: not the pelvis's, which stay planted with the legs)
  return { body, lost, frameParts: frame.filter((s) => s.group !== 'Pelvis').flatMap((s) => (s.mirror === 'name' ? [s.name, s.name.replace(/R$/, 'L')] : [s.name])) };
}

// ── the rest the body stands in ──
const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => r3(x / n)); };
const HANG = [0.2, 0.28, -0.94], OUT = [0.12, 0.99, 0.06];
const armAt = (reach, sx) => { const v = HANG.map((h, i) => h + (OUT[i] - h) * reach); return { x: r3(v[0] * sx), y: r3(v[1]), z: r3(v[2]) }; };

// rotate v by the rotation that takes unit a to unit b (Rodrigues)
function rotator(a, b) {
  const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], ax = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], s = Math.hypot(...ax);
  if (s < 1e-9) return (v) => v;
  const k = ax.map((x) => x / s), th = Math.atan2(s, c), cs = Math.cos(th), sn = Math.sin(th);
  return (v) => { const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2], kx = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]; return v.map((x, i) => x * cs + kx[i] * sn + k[i] * kv * (1 - cs)); };
}
const rotX = (v, deg) => { const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };

/**
 * The arms BUILT in their posture: each arm's joints turned about its shoulder so the arm already points where the rest
 * pose holds it (a reaching zombie's arms are sculpted out before it), and the rest asks for the arm where it is, turned
 * with the body's lean (the lean hinges the arms with the torso). A rest pose that swung the arm far from its build
 * stretched the shoulder's skin into spikes. An arm authored on both sides takes its own side's reach; a mirrored one the
 * leading arm's.
 */
export function poseArms(body, P) {
  const split = !!body.joints['shoulder__L'], S = body.J.shoulder, out = {};
  const armJoints = (side) => Object.keys(body.joints).filter((n) => (side === 'L' ? n.endsWith('__L') : !n.endsWith('__L')) && /^(elbow|wrist|knuckles|finger)/.test(n.replace(/__L$/, '')));
  for (const side of split ? ['R', 'L'] : ['R']) {
    const sh = side === 'L' ? body.joints['shoulder__L'] : S, kn = side === 'L' ? body.joints['knuckles__L'] : body.joints.knuckles;
    const d0 = norm(sub(kn, sh)), a = P.arms[side], t = norm([a.x, a.y, a.z]);
    const turn = rotator(d0, t);
    for (const n of armJoints(side)) body.joints[n] = add(sh, turn(sub(body.joints[n], sh))).map(r3);
    if (side === 'R') {
      for (const n of ['elbow', 'wrist', 'knuckles']) body.J[n] = body.joints[n];
      // (the rig's finger bones from the posed joints, so the fingers ride the bones they were built on)
      body.fingerJoints = (i) => { const X = body.FINGERS[i]; return { k: body.joints[`finger${X}k`], m: body.joints[`finger${X}m`], e: body.joints[`finger${X}e`] }; };
    }
    // the rest: the built arm's direction, turned forward with the lean
    const lean = rotX(t, -P.lean);
    out[side] = { x: r3(lean[0]), y: r3(lean[1]), z: r3(lean[2]) };
  }
  if (!split) out.L = { x: -out.R.x, y: out.R.y, z: out.R.z };
  return { ...P, arms: out };
}

export function posture(card, rand) {
  const reach = card.arms?.reach ?? 0, lead = sideOf(rand);
  // (a reaching zombie leads with one arm: the other comes up only part way)
  const R = armAt(lead === 'R' ? reach : reach * 0.6, 1), L = armAt(lead === 'L' ? reach : reach * 0.6, -1);
  const h = card.head ?? { drop: 0, tilt: 0 }, tilt = h.tilt * (rand() < 0.5 ? 1 : -1);
  const head = norm([tilt * 0.35, 0.95, -h.drop * 0.9]);
  return { lean: card.lean ?? 0, crouch: card.crouch ?? 0, jaw: card.jaw ?? 0, arms: { R, L }, head: { x: head[0], y: head[1], z: head[2] } };
}
