/**
 * versus figure — the fighter in 3D: the vajra's skeleton posed from the fight (inlined into the arena's block,
 * versus-arena.client.js).
 *
 * The sim fights a stick figure in its plane (versus-rig.js rigJoints: x forward, y up, mm). The page draws a body in
 * the round. Its skeleton is the vajra's (figure-vajra.js FIGURE_NODES: pelvisHub, navel, neckHub, headBase, headTop,
 * and per side shoulder, elbow, wrist, hip, knee, ankle, with a toe), in the vajra's frame: metres, z up, facing +y,
 * its right side +x, its feet on z = 0. The skeleton is a character's own (its rig, `characterBase`) or one built to
 * the stick figure's lengths (`figureBase`).
 *
 * The SIDE VIEW IS THE SIM'S FIGURE: the trunk and the head lie along the sim's lines, and the hands and the feet are
 * placed by a two-bone solve on the sim's own points (the wrist on its hand, the heel on its ankle), so what hits and
 * what is hit is where the boxes are. Around that the body is in the round, as the genre stands it (the fighter's
 * STANCE, versus-compile.js STANCE_DIALS):
 *   - BLADED: the hips and, more, the chest turned toward the camera (`open`, `hips`), the lead shoulder forward; the
 *     LEAD side (the sim's F) is the far one, the figure's left when it faces +x and its right when it faces -x, so
 *     the chest reads
 *   - the SIDE TILT (`tilt`): the trunk bent toward the camera, the shoulder line on a diagonal, the torso in the
 *     silhouette (fighters rarely stand square, staring at each other)
 *   - the elbows bent down and out, the knees forward, the lead hand before its shoulder, the rear one by the chin
 *     (a pose's `hands` and `feet` move them across: a hook swings to the centre line, a hikite pulls to the hip)
 *   - the feet under the hips, each foot rigid (its own bones) and turned to point at the sim's toe, standing on the
 *     floor as the rest does
 * `blade` (0 … 1) is how far the body turns: a standing fighter all the way, one falling or down not at all. A strike
 * turns it back as far as the limb needs (the KINETIC CHAIN): the chest turns until both hands reach their points,
 * the hips until both feet do, so a rear straight squares the shoulders and a roundhouse turns the hips over.
 *
 * A character's mesh is posed by FRAMES: each segment (pelvis, torso, neck, head, upper arm, forearm, thigh, shin,
 * foot) has a frame at rest and posed (its line, and a pole: the hip line, the shoulder line, the chest's forward, up),
 * and each of the character's bones rides the segment it belongs to (a finger its forearm, a fold its lower limb, a
 * tail the pelvis), turned by the segment's turn about its start: the chain closes at every joint.
 *
 *   figureBase(body)                     a skeleton from the sim's body (mm lengths → metres)
 *   characterBase(bones)                 a skeleton from a packed rig's bones ([{ id, head, tail }], metres)
 *   figurePose(base, J, { face, air, blade })   → posed nodes (metres, the figure's frame)
 *   figureSegments(base, posed)          → { <segment>: { R, from, at } }: v' = R (v - from) + at
 *   segmentOf(boneId, bones)             the segment a character's bone rides
 *
 * Pure, no dice; nothing here is kept by the sim.
 */
/* (inlined after versus-rig.js: ROUND_REST, each hand's and foot's depth at rest) */
import { ROUND_REST } from './versus-rig.js';

const FIG_SIDES = ['L', 'R'];
const fv = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  unit: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
// turns: about +x (forward toward up) and about +z (forward toward the figure's left)
const figRotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
const figRotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
const FIG_DEG = Math.PI / 180;
// how a fighter stands when its recipe says nothing (versus-compile.js DEFAULT_STANCE): the chest open to the camera,
// the hips following, the side tilt (degrees)
const FIG_STANCE = { open: 45, hips: 28, tilt: 8 };
// how far past square a strike may turn them (the far side's range: a roundhouse turns the hips over)
const FIG_TURN = { hips: 70, chest: 45 };

/** A skeleton to the stick figure's own lengths (its body, versus-rig.js versusBody, mm), arms hanging. */
export function figureBase(body) {
  const m = (v) => v / 1000;
  const pz = m(body.pelvis), sh = m(body.bodyR) * 1.2, hip = m(body.bodyR) * 0.6;
  const B = { pelvisHub: [0, 0, pz], navel: [0, 0, pz + m(body.torso) * 0.45], neckHub: [0, 0, pz + m(body.torso)] };
  B.headBase = [0, 0, B.neckHub[2] + m(body.neck)];
  B.headTop = [0, 0, B.headBase[2] + m(body.head) * 2];
  for (const S of FIG_SIDES) {
    const x = S === 'R' ? 1 : -1;
    B[`shoulder${S}`] = [x * sh, 0, pz + m(body.torso) * 0.86];
    B[`elbow${S}`] = fv.sub(B[`shoulder${S}`], [0, 0, m(body.upper)]);
    B[`wrist${S}`] = fv.sub(B[`elbow${S}`], [0, 0, m(body.fore)]);
    B[`hip${S}`] = [x * hip, 0, pz];
    B[`knee${S}`] = [x * hip, 0, pz - m(body.thigh)];
    // the sim's leg runs to its heel: the stick's ankle is that point, its foot along the floor from it
    B[`ankle${S}`] = [x * hip, 0, 0];
    B[`toe${S}`] = [x * hip, m(body.foot), 0];
  }
  B.hand = m(body.hand);
  return B;
}

/** A skeleton from a packed rig's bones (the layered hero's, or a creature's): its own joints, at rest. */
export function characterBase(bones) {
  const by = Object.fromEntries(bones.map((b) => [b.id, b]));
  const pick = (...ids) => ids.map((id) => by[id]).find(Boolean);
  const B = {};
  const put = (name, bone, end) => { if (bone) B[name] = [...bone[end]]; };
  put('pelvisHub', pick('pelvis', 'lumbar'), 'head');
  put('navel', pick('torso'), 'head');
  put('neckHub', pick('neck'), 'head');
  if (!B.neckHub && by.torso) B.neckHub = [...by.torso.tail];
  put('headBase', pick('head'), 'head');
  put('headTop', pick('head'), 'tail');
  for (const S of FIG_SIDES) {
    put(`shoulder${S}`, pick(`upperArm${S}`), 'head');
    put(`elbow${S}`, pick(`foreArm${S}`), 'head');
    put(`wrist${S}`, pick(`hand${S}`), 'head');
    if (!B[`wrist${S}`] && by[`foreArm${S}`]) B[`wrist${S}`] = [...by[`foreArm${S}`].tail];
    put(`hip${S}`, pick(`thigh${S}`), 'head');
    put(`knee${S}`, pick(`shank${S}`, `shin${S}`), 'head');
    put(`ankle${S}`, pick(`shank${S}`, `shin${S}`), 'tail');
    put(`toe${S}`, pick(`toes${S}`, `foot${S}`, `meta${S}`), 'tail');
  }
  const hand = by.handR ?? by.handL;
  B.hand = hand ? fv.len(fv.sub(hand.tail, hand.head)) : 0.09;
  for (const k of ['pelvisHub', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'toeL', 'toeR']) {
    if (!B[k]) throw new Error(`versus: the character's rig has no ${k} to fight with`);
  }
  if (!B.navel) B.navel = fv.mul(fv.add(B.pelvisHub, B.neckHub), 0.5);
  return B;
}

/** The middle joint of a two-bone limb from its root to a target, bent toward `pole`; an out-of-reach target is met
 * as far as the limb goes, along its line. → { mid, end } */
function figReach(root, target, l1, l2, pole) {
  let d = fv.sub(target, root), dl = fv.len(d);
  const reach = (l1 + l2) * 0.999, least = Math.abs(l1 - l2) * 1.001 + 1e-6;
  if (dl > reach) { d = fv.mul(d, reach / dl); dl = reach; }
  if (dl < least) { d = fv.mul(fv.unit(d), least); dl = least; }
  const end = fv.add(root, d), axis = fv.unit(d);
  const a = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let side = fv.sub(pole, fv.mul(axis, fv.dot(pole, axis)));
  if (fv.len(side) < 1e-9) side = Math.abs(axis[2]) < 0.9 ? [0, 0, -1] : [0, 1, 0];
  return { mid: fv.add(fv.add(root, fv.mul(axis, a)), fv.mul(fv.unit(side), h)), end };
}

/**
 * The skeleton posed by the sim's joints J (versus-rig.js rigJoints, mm), facing `face` (+1 toward +x), airborne or
 * not, standing in its `stance` ({ open, hips, tilt }, degrees) as far as `blade` (0 … 1) has it, and turned by the
 * pose's own round-body channels (degrees): `twist` the chest further toward the camera, `sway` the hips, `tilt` the
 * trunk further to the camera's side, `spin` the whole body about the vertical through the pelvis (toward the camera first),
 * `bank` the whole body about its forward line (its top toward the camera); a body that `lie`s rests on its lowest
 * point. → { <node>: [x, y, z] } in metres, the figure's frame, plus `fistL/R`, `heelL/R`.
 */
export function figurePose(base, J, { face = 1, air = false, blade = 1, stance = FIG_STANCE, twist = 0, sway = 0, tilt = 0, spin = 0, bank = 0, lie = false, hands = ROUND_REST.hands, feet = ROUND_REST.feet } = {}) {
  const sg = face > 0 ? 1 : -1, lead = sg > 0 ? 'L' : 'R';
  const at = (p) => [0, p[0] / 1000, p[1] / 1000];
  const sideOf = (S) => (S === lead ? 'F' : 'B');
  const P = at(J.pelvis), O = base.pelvisHub;
  const N = {};
  // the trunk along the sim's pelvis → neck, the chest turned toward the camera about it (the camera is the figure's
  // right when it faces +x: a turn toward it brings the far, lead shoulder forward)
  const t = fv.sub(at(J.neck), P), lean = Math.atan2(t[1], t[2]);
  // the side tilt: the trunk bent toward the camera about its forward line through the pelvis (the head stays on the
  // sim's line, so it rights itself on the neck)
  const side = sg * (blade * stance.tilt + tilt) * FIG_DEG;
  let cs = Math.cos(side), sn = Math.sin(side);
  const tiltBy = (share) => { cs = Math.cos(side * share); sn = Math.sin(side * share); };
  const tilted = (v) => [v[0] * cs + v[2] * sn, v[1], -v[0] * sn + v[2] * cs];
  const trunkAt = (k, chest) => fv.add(P, figRotX(tilted(figRotZ(fv.sub(base[k], O), chest)), -lean));
  const hipAt = (S, hips) => fv.add(P, figRotZ(fv.sub(base[`hip${S}`], O), hips));
  const len = (a, b) => fv.len(fv.sub(base[b], base[a]));
  // the targets: each wrist on the sim's hand (its depth a share of its shoulder's); each ankle joint up the sim's shin
  // from its heel point by the rest ankle's height (the sim's leg runs hip, knee, heel), the toe on from the heel
  // (a hand at full stretch keeps only the depth its arm still reaches)
  const armLen = (S) => len(`shoulder${S}`, `elbow${S}`) + len(`elbow${S}`, `wrist${S}`);
  const wristAt = (S, sh) => {
    const w = at(J[`hand${sideOf(S)}`]), want = sh[0] * hands[S === lead ? 0 : 1];
    const dd = (w[1] - sh[1]) ** 2 + (w[2] - sh[2]) ** 2;
    const room = Math.sqrt(Math.max(0, (armLen(S) * 0.999) ** 2 - dd));
    // (and a hand folded in closer than the arm folds takes the depth it needs: the forearm and the upper arm differ)
    const least = Math.abs(len(`shoulder${S}`, `elbow${S}`) - len(`elbow${S}`, `wrist${S}`)) * 1.01;
    const need = Math.sqrt(Math.max(0, least ** 2 - dd));
    let dx = Math.max(-room, Math.min(room, want - sh[0]));
    if (Math.abs(dx) < need) dx = (dx < 0 || (dx === 0 && sh[0] > 0) ? -1 : 1) * need;
    w[0] = sh[0] + dx;
    return w;
  };
  const foot = Object.fromEntries(FIG_SIDES.map((S) => {
    const X = sideOf(S), shin = fv.unit(fv.sub(at(J[`ankle${X}`]), at(J[`knee${X}`]))), h = base[`ankle${S}`][2];
    return [S, { heel: at(J[`ankle${X}`]), lift: fv.mul(shin, -h), h }];
  }));
  const ankleAt = (S, hip) => { const h = [hip[0] * feet[S === lead ? 0 : 1], foot[S].heel[1], foot[S].heel[2]]; return fv.add(h, foot[S].lift); };
  // the turns: as far toward the camera as the blade asks, back as far as the limbs need (1° at a time, at most past
  // square by the far side's own range); a move that keys a turn past what its limbs can follow (a side kick's hips
  // turned right over) is met by the nearest turn that reaches, either way; the turn with the least reach missing if
  // none reaches
  const turnFor = (want, least, misses, home = want) => {
    const hi = Math.max(want, home), lo = least, span = hi - Math.min(lo, want);
    let best = null;
    for (let k = 0; k <= span + 1; k++) {
      for (const deg of k ? [want - k, want + k] : [want]) {
        if (deg < lo - 1e-9 || deg > hi + 1e-9) continue;
        const miss = misses(-sg * deg * FIG_DEG);
        if (miss <= 1e-9) return -sg * deg * FIG_DEG;
        if (!best || miss < best.miss) best = { miss, deg };
      }
    }
    return -sg * best.deg * FIG_DEG;
  };
  const over = (root, target, l) => Math.max(0, fv.len(fv.sub(target, root)) - l * 0.999);
  // the chest turns back, and the trunk straightens out of its tilt, as far as the arms need (an arm up overhead)
  const armsMiss = (c) => FIG_SIDES.reduce((m, S) => {
    const sh = trunkAt(`shoulder${S}`, c);
    return m + over(sh, wristAt(S, sh), armLen(S));
  }, 0);
  let chest;
  for (const share of [1, 0.5, 0]) {
    tiltBy(share);
    chest = turnFor(blade * stance.open + twist, -FIG_TURN.chest, armsMiss, blade * stance.open);
    if (armsMiss(chest) <= 1e-9) break;
  }
  const hips = turnFor(blade * stance.hips + sway, -FIG_TURN.hips, (h) => FIG_SIDES.reduce((m, S) => {
    const hp = hipAt(S, h);
    return m + over(hp, ankleAt(S, hp), len(`hip${S}`, `knee${S}`) + len(`knee${S}`, `ankle${S}`));
  }, 0), blade * stance.hips);
  N.pelvisHub = P;
  for (const k of ['navel', 'neckHub', 'shoulderL', 'shoulderR']) N[k] = trunkAt(k, chest);
  // the head along the sim's neck → head line
  const hd = fv.unit(fv.sub(at(J.head), at(J.neck)));
  N.headBase = fv.add(N.neckHub, fv.mul(hd, len('neckHub', 'headBase')));
  N.headTop = fv.add(N.headBase, fv.mul(hd, len('headBase', 'headTop')));
  const chestFwd = figRotX(tilted(figRotZ([0, 1, 0], chest)), -lean);
  for (const S of FIG_SIDES) {
    const out = S === 'R' ? 1 : -1;
    N[`hip${S}`] = hipAt(S, hips);
    // the arm: the elbow down and out
    const sh = N[`shoulder${S}`];
    const arm = figReach(sh, wristAt(S, sh), len(`shoulder${S}`, `elbow${S}`), len(`elbow${S}`, `wrist${S}`), fv.add([out * 0.6, 0, -1], fv.mul(chestFwd, -0.3)));
    N[`elbow${S}`] = arm.mid; N[`wrist${S}`] = arm.end;
    N[`fist${S}`] = fv.add(arm.end, fv.mul(fv.unit(fv.sub(arm.end, arm.mid)), base.hand));
    // the leg: the knee forward, the foot turned by the sim's foot angle
    const leg = figReach(N[`hip${S}`], ankleAt(S, N[`hip${S}`]), len(`hip${S}`, `knee${S}`), len(`knee${S}`, `ankle${S}`), [out * 0.15, 1, 0]);
    N[`knee${S}`] = leg.mid; N[`ankle${S}`] = leg.end;
    // the foot is rigid (its own bones): turned about the ankle to point at the sim's toe, the heel under the ankle
    const rf = fv.sub(base[`toe${S}`], base[`ankle${S}`]), toe2 = at(J[`toe${sideOf(S)}`]), d = fv.sub(toe2, leg.end);
    const ft = Math.atan2(d[2], d[1]) - Math.atan2(rf[2], rf[1]);
    N[`toe${S}`] = fv.add(leg.end, figRotX(rf, ft));
    N[`heel${S}`] = fv.add(leg.end, figRotX([0, 0, -foot[S].h], ft));
  }
  // a leg too short for the sim's spot (a character shorter in the leg than the sim's figure) leaves its foot in the
  // air: grounded, the body sinks by the least such gap so the nearer foot stands
  const gaps = FIG_SIDES.map((S) => N[`ankle${S}`][2] - ankleAt(S, N[`hip${S}`])[2]);
  const dz = air || lie ? 0 : -Math.max(0, Math.min(...gaps));
  if (dz) for (const k of Object.keys(N)) N[k] = [N[k][0], N[k][1], N[k][2] + dz];
  // the whole body turned: about the vertical (a spin), about its forward line (a roll onto a side)
  if (spin || bank) {
    const piv = N.pelvisHub;
    for (const k of Object.keys(N)) {
      let v = fv.sub(N[k], piv);
      if (spin) v = figRotZ(v, -sg * spin * FIG_DEG);
      if (bank) { const a = sg * bank * FIG_DEG, c = Math.cos(a), si = Math.sin(a); v = [v[0] * c + v[2] * si, v[1], -v[0] * si + v[2] * c]; }
      N[k] = fv.add(piv, v);
    }
  }
  if (lie && bank) {
    // rolled, a lying body rests on its new lowest point
    const low = Math.min(...Object.values(N).map((q) => q[2])) - 0.04;
    for (const k of Object.keys(N)) N[k] = [N[k][0], N[k][1], N[k][2] - low];
  }
  return N;
}

// each segment: its start and end joints, and its pole (the second direction that fixes its roll)
const FIG_SEGMENTS = {
  pelvis: ['pelvisHub', 'navel', 'hips'], torso: ['navel', 'neckHub', 'shoulders'], neck: ['neckHub', 'headBase', 'shoulders'], head: ['headBase', 'headTop', 'shoulders'],
  ...Object.fromEntries(FIG_SIDES.flatMap((S) => [
    [`upperArm${S}`, [`shoulder${S}`, `elbow${S}`, 'chest']], [`foreArm${S}`, [`elbow${S}`, `wrist${S}`, 'chest']],
    [`thigh${S}`, [`hip${S}`, `knee${S}`, 'front']], [`shin${S}`, [`knee${S}`, `ankle${S}`, 'front']], [`foot${S}`, [`ankle${S}`, `toe${S}`, 'up']],
  ])),
};
function figPoles(N) {
  const hips = fv.unit(fv.sub(N.hipR, N.hipL)), shoulders = fv.unit(fv.sub(N.shoulderR, N.shoulderL));
  const up = fv.unit(fv.sub(N.neckHub, N.pelvisHub));
  return { hips, shoulders, chest: fv.unit(fv.cross(up, shoulders)), front: fv.unit(fv.cross([0, 0, 1], hips)), up: [0, 0, 1] };
}
// a frame (columns: the line, the pole's part across it, their cross)
function figFrame(a, b, pole) {
  const d = fv.unit(fv.sub(b, a));
  let s = fv.sub(pole, fv.mul(d, fv.dot(pole, d)));
  if (fv.len(s) < 1e-6) { const alt = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]; s = fv.sub(alt, fv.mul(d, fv.dot(alt, d))); }
  s = fv.unit(s);
  return [d, s, fv.cross(d, s)];
}

/** Each segment's turn from rest to posed: { R (3×3, rows), from (its rest start), at (its posed start) }. */
export function figureSegments(base, N) {
  const PR = figPoles(base), PP = figPoles(N), out = {};
  for (const [k, [a, b, pole]] of Object.entries(FIG_SEGMENTS)) {
    const Fr = figFrame(base[a], base[b], PR[pole]), Fp = figFrame(N[a], N[b], PP[pole]);
    // R = Fp · Frᵀ (the frames as columns)
    const R = [0, 1, 2].map((i) => [0, 1, 2].map((j) => Fp[0][i] * Fr[0][j] + Fp[1][i] * Fr[1][j] + Fp[2][i] * Fr[2][j]));
    out[k] = { R, from: base[a], at: N[a] };
  }
  return out;
}

// the segment a character's bone rides, by its name (a side's bone on that side's segment)
const FIG_RIDES = [
  [/^(pelvis|lumbar|tail\d*)$/, 'pelvis'], [/^(torso|clavicle|bust|upperArm2|foreArm2|hand2)$/, 'torso'], [/^neck$/, 'neck'], [/^(head|jaw)$/, 'head'],
  [/^upperArm$/, 'upperArm'], [/^(foreArm|hand|elbowFold|thumb\d|index\d|middle\d|ring\d|little\d|finger[A-Z]\d|wing.*)$/, 'foreArm'],
  [/^(thigh|hipFold)$/, 'thigh'], [/^(shank|shin|kneeFold|meta)$/, 'shin'], [/^(foot|toes)$/, 'foot'],
];
/** The segment a packed rig's bone rides: `torso`, `head`, `foreArmR` …; a bone with no word rides the torso. */
export function segmentOf(id) {
  const m = /^(.*?)([LR])$/.exec(id), base = m ? m[1] : id, S = m ? m[2] : '';
  for (const [re, seg] of FIG_RIDES) if (re.test(base)) return FIG_SEGMENTS[seg] ? seg : `${seg}${S || 'R'}`;
  return 'torso';
}
