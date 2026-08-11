import { describe, it, expect } from 'vitest';

import { bakeUnitRig, UNIT_BONES } from './unit-rig.js';
import { compileUnitPose, deriveBipedRig } from './unit-pose.js';
import { lowerAssemblerBuild } from './workbench-assembler.js';
import { facingYaw } from './workbench.js';
import { partPositions } from '../materials/procedural-material.js';

// The same minimal biped fixture unit-pose.test.js poses: g-series authoring
// convention (facing '-y', screen-relative _l/_r suffixes — suit −x is the
// ANATOMICAL RIGHT), one gravity-seated item.
const strut = (len, r = 0.3) => ({
  lathes: [{
    axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: -len },
    profile: [{ t: 0.5, radius: r }], crossSections: 4, samples: 6, tint: '#888888',
  }],
});
const footStrut = () => ({
  lathes: [{
    axisFrom: { x: 0, y: 0.1, z: 0.2 }, axisTo: { x: 0, y: -0.8, z: 0.2 },
    profile: [{ t: 0.5, radius: 0.2 }], crossSections: 4, samples: 6, tint: '#888888',
  }],
});

function miniBiped() {
  return {
    kind: 'assembler',
    facing: '-y',
    items: [
      { id: 'head', source: strut(1, 0.5), at: [0, 0, 9] },
      { id: 'torso', source: strut(3, 1), at: [0, 0, 8] },
      { id: 'pelvis', source: strut(1, 0.9), at: [0, 0, 5] },
      { id: 'upper_arm_l', source: strut(1.5), at: [-2, 0, 8] },
      { id: 'upper_arm_r', source: strut(1.5), at: [2, 0, 8] },
      { id: 'forearm_l', source: strut(1.5), at: [-2, 0, 6.5] },
      { id: 'forearm_r', source: strut(1.5), at: [2, 0, 6.5] },
      { id: 'thigh_l', source: strut(2, 0.4), at: [-1, 0, 4] },
      { id: 'thigh_r', source: strut(2, 0.4), at: [1, 0, 4] },
      { id: 'lower_leg_l', source: strut(2, 0.35), at: [-1, 0, 2] },
      { id: 'lower_leg_r', source: strut(2, 0.35), at: [1, 0, 2] },
      { id: 'foot_l', source: footStrut(), on: 'ground', at: [-1, 0, 0] },
      { id: 'foot_r', source: footStrut(), on: 'ground', at: [1, 0, 0] },
    ],
  };
}

const boneIndex = (id) => UNIT_BONES.findIndex((b) => b.id === id);
const decodeF32 = (b64) => {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
};
const boundsOfFlat = (arr) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k += 1) {
    if (arr[i + k] < min[k]) min[k] = arr[i + k];
    if (arr[i + k] > max[k]) max[k] = arr[i + k];
  }
  return { min, max };
};
// rotate v by quaternion [x,y,z,w]: v + 2·q×(q×v + w·v)
const qrot = (q, v) => {
  const [x, y, z, w] = q;
  const cx = y * v[2] - z * v[1] + w * v[0];
  const cy = z * v[0] - x * v[2] + w * v[1];
  const cz = x * v[1] - y * v[0] + w * v[2];
  return [
    v[0] + 2 * (y * cz - z * cy),
    v[1] + 2 * (z * cx - x * cz),
    v[2] + 2 * (x * cy - y * cx),
  ];
};

// The bake's rig-frame normalization, reproduced from the rest build — so the
// parity test can carry compileUnitPose's suit-frame output into bake space.
function restNormalizer(manifest) {
  const yaw = facingYaw(manifest.facing) * Math.PI / 180;
  const c = Math.cos(-yaw), s = Math.sin(-yaw);
  const toRig = ([x, y, z]) => [c * x - s * y, s * x + c * y, z];
  const { faces } = lowerAssemblerBuild(manifest);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const corner of f.corners) {
    const v = toRig(corner);
    for (let k = 0; k < 3; k += 1) { if (v[k] < min[k]) min[k] = v[k]; if (v[k] > max[k]) max[k] = v[k]; }
  }
  const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
  return (corner) => { const v = toRig(corner); return [v[0] - cx, v[1] - cy, v[2] - min[2]]; };
}

describe('bakeUnitRig', () => {
  it('packs the rig shape the renderer passes through: bones, parts, clips', () => {
    const fig = bakeUnitRig(miniBiped(), { keys: 4 });
    expect(fig.rig).toBe(true);
    expect(fig.bones).toHaveLength(UNIT_BONES.length);
    expect(fig.bones.map((b) => b.id)).toEqual(UNIT_BONES.map((b) => b.id));
    // every bone has stations in the fixture → no null parts. Unit rigs pack the
    // indexed+quantized form (rig-bake packRigMesh): q grid + index, never legacy pos soup.
    expect(fig.parts.every((p) => p && p.q && p.idx && p.col && Number.isFinite(p.n))).toBe(true);
    expect(Object.keys(fig.clips).sort()).toEqual(['boost', 'boost_back', 'boost_left', 'boost_right', 'boost_side', 'forward', 'getup', 'idle', 'kneel', 'leap', 'squat', 'stagger', 'strafe', 'topple', 'turn']);
    expect(fig.clips.forward.k).toBe(4);
    expect(fig.clips.forward.b).toHaveLength(4 * UNIT_BONES.length * 7);
    // ONE-SHOT reaction clips (2026-07-28): baked 0..1 INCLUSIVE + flagged, so the renderer
    // clamps at the true final pose instead of wrapping the tail back toward key 0 — the
    // getup "sits down again" fix. Loops carry no flag (their wrap closes the cycle).
    for (const nm of ['stagger', 'topple', 'getup']) expect(fig.clips[nm].once).toBe(1);
    expect(fig.clips.forward.once).toBeUndefined();
    // the getup's LAST key is the phase-1 STAND — nothing like its FIRST key (flat on the
    // ground): compare the packed pelvis-bone rows of key 0 vs key K-1.
    const gu = fig.clips.getup, nb = UNIT_BONES.length;
    const row = (k, bi) => Array.from(gu.b.slice((k * nb + bi) * 7, (k * nb + bi) * 7 + 7));
    const d = row(0, 0).reduce((s, v, i) => s + Math.abs(v - row(gu.k - 1, 0)[i]), 0);
    expect(d).toBeGreaterThan(0.5);
    expect(fig.figH).toBeGreaterThan(8.5);
    expect(fig.figH).toBeLessThan(9.5);
  });

  it('binds faces to bones by STATION, not proximity — counts match the item slices', () => {
    const m = miniBiped();
    const fig = bakeUnitRig(m, { keys: 2 });
    const { placements } = lowerAssemblerBuild(m);
    const byKey = Object.fromEntries(placements.map((pl) => [pl.id, pl]));
    // suit thigh_l (−x) is the anatomical RIGHT thigh; only that station binds there
    expect(fig.parts[boneIndex('thighR')].faces).toBe(byKey.thigh_l.faceCount);
    // the shin bones carry lower leg AND the foot riding them (no ankle DOF)
    expect(fig.parts[boneIndex('shinR')].faces)
      .toBe(byKey.lower_leg_l.faceCount + byKey.foot_l.faceCount);
  });

  it('rest geometry is rig-framed: feet on z=0, centered on x', () => {
    const fig = bakeUnitRig(miniBiped(), { keys: 2 });
    let mnz = Infinity, mnx = Infinity, mxx = -Infinity;
    for (const p of fig.parts) {
      const b = boundsOfFlat(partPositions(p));
      if (b.min[2] < mnz) mnz = b.min[2];
      if (b.min[0] < mnx) mnx = b.min[0];
      if (b.max[0] > mxx) mxx = b.max[0];
    }
    expect(mnz).toBeGreaterThan(-0.01);
    expect(mnz).toBeLessThan(0.05);
    expect(mnx + mxx).toBeCloseTo(0, 1);   // x-centered
  });

  it('targetH rescales the whole body', () => {
    const fig = bakeUnitRig(miniBiped(), { keys: 2, targetH: 1.8 });
    expect(fig.figH).toBeCloseTo(1.8, 3);
  });

  it('an all-rest clip holds identity rotations at the rest heads', () => {
    const fig = bakeUnitRig(miniBiped(), { keys: 1, clips: { idle: () => ({}) } });
    const nb = UNIT_BONES.length;
    for (let bi = 0; bi < nb; bi += 1) {
      const o = bi * 7;
      const B = fig.clips.idle.b;
      expect([B[o], B[o + 1], B[o + 2], B[o + 3]]).toEqual([0, 0, 0, 1]);
      expect([B[o + 4], B[o + 5], B[o + 6]]).toEqual(fig.bones[bi].head);
    }
  });

  it('PARITY: the runtime formula over a baked key reproduces compileUnitPose', () => {
    const m = miniBiped();
    const dof = { elbowR: 90 };
    const fig = bakeUnitRig(m, { keys: 1, clips: { pose: () => dof } });
    const bi = boneIndex('forearmR');
    const o = bi * 7;
    const B = fig.clips.pose.b;
    const q = [B[o], B[o + 1], B[o + 2], B[o + 3]];
    const h = [B[o + 4], B[o + 5], B[o + 6]];
    const rh = fig.bones[bi].head;

    // apply M·v = head' + q·(v − restHead) to the bone's rest part
    const rest = partPositions(fig.parts[bi]);
    const posed = [];
    for (let i = 0; i < rest.length; i += 3) {
      const r = qrot(q, [rest[i] - rh[0], rest[i + 1] - rh[1], rest[i + 2] - rh[2]]);
      posed.push(r[0] + h[0], r[1] + h[1], r[2] + h[2]);
    }
    const got = boundsOfFlat(posed);

    // ground truth: the static pose compiler, carried into the bake's frame
    const { manifest: posedManifest, report } = compileUnitPose(m, dof);
    expect(report.groundShift).toBeCloseTo(0, 4);   // no re-ground → frames comparable
    const N = restNormalizer(m);
    const { faces, placements } = lowerAssemblerBuild(posedManifest);
    const pl = placements.find((p) => p.id === 'forearm_l');   // suit −x = anatomical right
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = pl.faceStart; i < pl.faceStart + pl.faceCount; i += 1) {
      for (const corner of faces[i].corners) {
        const v = N(corner);
        for (let k = 0; k < 3; k += 1) { if (v[k] < min[k]) min[k] = v[k]; if (v[k] > max[k]) max[k] = v[k]; }
      }
    }
    for (let k = 0; k < 3; k += 1) {
      expect(got.min[k]).toBeCloseTo(min[k], 1);
      expect(got.max[k]).toBeCloseTo(max[k], 1);
    }
  });

  it('the default walk works the TRUNK: torso and head move at the footstrike key', () => {
    // keys=4 samples p=0,.25,.5,.75 — p=.25 is a footstrike (heave peak): the
    // chest must pitch (spine flex) and the head counter-pitch, not ride rigid.
    const fig = bakeUnitRig(miniBiped(), { keys: 4 });
    const B = fig.clips.forward.b;
    const nb = UNIT_BONES.length;
    const quatAt = (key, bi) => {
      const o = (key * nb + bi) * 7;
      return [B[o], B[o + 1], B[o + 2], B[o + 3]];
    };
    for (const bone of ['torso', 'head']) {
      const q = quatAt(1, boneIndex(bone));
      expect(Math.abs(q[3])).toBeLessThan(0.99999);   // non-identity at footstrike
    }
    // and the neck COUNTER works: the head inherits the chest pitch and the
    // counter-nod cancels most of it, so the head ends far more level than
    // the chest (near-identity about the pitch axis).
    const qt = quatAt(1, boneIndex('torso')), qh = quatAt(1, boneIndex('head'));
    expect(Math.abs(qt[0])).toBeGreaterThan(0.005);            // the chest genuinely pitches
    expect(Math.abs(qh[0])).toBeLessThan(Math.abs(qt[0]) * 0.5);   // the head stays near level
  });

  it('sole grounding: squat drops the body, leap hovers, the walk bobs', () => {
    const fig = bakeUnitRig(miniBiped(), { keys: 4 });
    const nb = UNIT_BONES.length;
    const pelvisZ = (clip, key) => clip.b[(key * nb + boneIndex('pelvis')) * 7 + 6];
    const restZ = fig.bones[boneIndex('pelvis')].head[2];
    // squat (grounded): no dof moves the pelvis bone, so its drop IS the sole
    // shift — and the clip is a CHARGE RAMP: the last key coils far deeper
    // than the first
    expect(pelvisZ(fig.clips.squat, 3)).toBeLessThan(restZ - 0.3);
    expect(pelvisZ(fig.clips.squat, 3)).toBeLessThan(pelvisZ(fig.clips.squat, 0) - 0.15);
    // leap (ungrounded): the tuck lifts the feet, the pelvis stays at rest
    expect(pelvisZ(fig.clips.leap, 0)).toBeCloseTo(restZ, 4);
    // walk (grounded): the stance leg's pitch arc raises its sole → cyclic bob
    expect(pelvisZ(fig.clips.forward, 1)).toBeLessThan(restZ - 0.01);
  });

  it('skirt stations become synthetic hinge bones that ride the pelvis and tilt in boost', () => {
    const m = miniBiped();
    m.items.push(
      { id: 'skirt_front', source: strut(0.8, 0.2), at: [0, -0.9, 4.6] },   // suit −y = front, centered → skirtFC
      { id: 'skirt_rear', source: strut(0.8, 0.2), at: [0, 0.9, 4.6] },
    );
    const fig = bakeUnitRig(m, { keys: 2 });
    const ids = fig.bones.map((b) => b.id);
    expect(ids).toContain('skirtFC');   // a centered front plate → the pelvis-bound center bone
    expect(ids).toContain('skirtR');
    expect(fig.parts[ids.indexOf('skirtFC')].faces).toBeGreaterThan(0);
    const q = (clip, bi) => [clip.b[bi * 7], clip.b[bi * 7 + 1], clip.b[bi * 7 + 2], clip.b[bi * 7 + 3]];
    // boost: front plate hinges forward (+x rotation), rear flares back (−x) —
    // equal and opposite IN THE PELVIS FRAME (the armor opens symmetrically).
    // boost is now a whole-body ROOT TILT (tilt: −BOOST_TILT pre-composes into
    // every bone), so the WORLD quats read asymmetric; the hinge doctrine lives
    // in the plate-vs-pelvis relative rotation, which is exactly the baked tiltM.
    const qconj = (a) => [-a[0], -a[1], -a[2], a[3]];
    const qmul = (a, b) => [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
    const qp0 = q(fig.clips.boost, ids.indexOf('pelvis'));
    const rel = (bone) => {
      const r = qmul(qconj(qp0), q(fig.clips.boost, ids.indexOf(bone)));
      return r[3] < 0 ? r.map((v) => -v) : r;   // double-cover: pin w ≥ 0
    };
    const qf = rel('skirtFC');
    const qr = rel('skirtR');
    expect(qf[0]).toBeGreaterThan(0.15);
    expect(qr[0]).toBeLessThan(-0.15);
    // precision 3, not 4: the stored quats are Float32, and the conjugate-multiply
    // stacks their quantization (~5e-5) — the doctrine break this guards against
    // reads as ~0.3 of asymmetry, three orders larger
    expect(Math.abs(qf[0])).toBeCloseTo(Math.abs(qr[0]), 3);
    // walk: no skirt spec — the CENTER plate simply RIDES the pelvis (same rotation)
    const qp = q(fig.clips.forward, ids.indexOf('pelvis'));
    const qfw = q(fig.clips.forward, ids.indexOf('skirtFC'));
    for (let i = 0; i < 4; i += 1) expect(qfw[i]).toBeCloseTo(qp[i], 3);
    // a unit WITHOUT skirt stations grows no synthetic bones
    expect(bakeUnitRig(miniBiped(), { keys: 1, clips: { idle: () => ({}) } }).bones).toHaveLength(UNIT_BONES.length);
  });

  it('front SIDE skirts are PUSHED clear by their own thigh (walk stride), not left to clip', () => {
    const m = miniBiped();
    // side front plates over each thigh (suit ±0.9 → rig ∓0.9, outside the ±0.45 center band) + a
    // rear plate. The forward walk swings each thigh; the side plate on the FORWARD leg must open.
    m.items.push(
      { id: 'skirt_front_l', source: strut(0.8, 0.2), at: [-0.9, -0.9, 4.6] },
      { id: 'skirt_front_r', source: strut(0.8, 0.2), at: [0.9, -0.9, 4.6] },
      { id: 'skirt_rear', source: strut(0.8, 0.2), at: [0, 0.9, 4.6] },
    );
    const KEYS = 8;
    const fig = bakeUnitRig(m, { keys: KEYS });
    const ids = fig.bones.map((b) => b.id);
    const nB = ids.length;
    expect(ids).toContain('skirtFL');
    expect(ids).toContain('skirtFR');
    // x-quat of a bone at key k (clip.b is laid out key-major: [k*nB + boneIdx]*7).
    const xAt = (bone, k) => fig.clips.forward.b[(k * nB + ids.indexOf(bone)) * 7];
    const maxOpen = (bone) => Math.max(...Array.from({ length: KEYS }, (_, k) => xAt(bone, k)));
    // each side plate visibly swings forward (x-quat > 0) on the phase its thigh strides forward…
    expect(maxOpen('skirtFL')).toBeGreaterThan(0.1);
    expect(maxOpen('skirtFR')).toBeGreaterThan(0.1);
    // …and they are driven by DIFFERENT legs: at L's most-open key, R is not open (anti-phase),
    // exactly like the contralateral leg swing — the plate rides the leg, not the leg spearing it.
    let kLmax = 0, best = -Infinity;
    for (let k = 0; k < KEYS; k += 1) { const v = xAt('skirtFL', k); if (v > best) { best = v; kLmax = k; } }
    expect(xAt('skirtFL', kLmax)).toBeGreaterThan(xAt('skirtFR', kLmax) + 0.05);
  });

  it('the kneel clip sits the body onto the folded knee: deep grounded drop, legs asymmetric', () => {
    const fig = bakeUnitRig(miniBiped(), { keys: 2 });
    const B = fig.clips.kneel.b;
    const q = (bi) => [B[bi * 7], B[bi * 7 + 1], B[bi * 7 + 2], B[bi * 7 + 3]];
    const restZ = fig.bones[boneIndex('pelvis')].head[2];
    expect(B[boneIndex('pelvis') * 7 + 6]).toBeLessThan(restZ - 0.8);   // seated well below stance
    expect(q(boneIndex('thighL'))[0] * q(boneIndex('thighR'))[0]).toBeLessThan(0);   // planted-forward vs folded-under
    expect(Math.abs(q(boneIndex('shinR'))[3])).toBeLessThan(0.9);       // the rear knee is folded hard
  });

  it('the boost clip holds the flight pose: hard torso pitch, legs split, knee tucked', () => {
    const fig = bakeUnitRig(miniBiped(), { keys: 2 });
    expect(fig.clips.boost).toBeTruthy();
    const B = fig.clips.boost.b;
    const q = (bi) => [B[bi * 7], B[bi * 7 + 1], B[bi * 7 + 2], B[bi * 7 + 3]];
    const qt = q(boneIndex('torso')), ql = q(boneIndex('thighL')), qr = q(boneIndex('thighR'));
    expect(Math.abs(qt[0])).toBeGreaterThan(0.1);    // strong forward lean (hinge + spine)
    expect(ql[0] * qr[0]).toBeLessThan(0);           // knee-up leg vs trailing leg — opposite pitch
    expect(Math.abs(q(boneIndex('shinL'))[3])).toBeLessThan(0.9999);   // the tucked knee is flexed
  });

  it('frame:true adds graphite inner-frame geometry bound per bone', () => {
    const opts = { keys: 1, clips: { idle: () => ({}) } };
    const plain = bakeUnitRig(miniBiped(), opts);
    const framed = bakeUnitRig(miniBiped(), { ...opts, frame: true });
    const total = (fig) => fig.parts.reduce((n, p) => n + (p ? p.faces : 0), 0);
    expect(total(framed)).toBeGreaterThan(total(plain));
    // the thigh gains its hip sphere + bone link; the head its neck link
    expect(framed.parts[boneIndex('thighL')].faces).toBeGreaterThan(plain.parts[boneIndex('thighL')].faces);
    expect(framed.parts[boneIndex('head')].faces).toBeGreaterThan(plain.parts[boneIndex('head')].faces);
    // frame color is the dark graphite family
    const col = decodeF32(framed.parts[boneIndex('thighL')].col);
    let dark = 0;
    for (let i = 0; i < col.length; i += 3) if (col[i] < 0.25 && col[i + 1] < 0.25 && col[i + 2] < 0.25) dark += 1;
    expect(dark).toBeGreaterThan(0);
    // frame is opt-in: the plain bake is untouched (byte-identical parts)
    expect(plain.parts[boneIndex('thighL')].q)
      .toBe(bakeUnitRig(miniBiped(), opts).parts[boneIndex('thighL')].q);
  });

  it('a pure axial TWIST reaches the bone — where a node-pair bake would emit identity', () => {
    // core twist counter-rotates the legs about z: a vertical thigh's DIRECTION is
    // unchanged (shortest-arc from node pairs = identity), but the exact affine
    // carries the rotation — asymmetric armor shows the difference.
    const fig = bakeUnitRig(miniBiped(), { keys: 1, clips: {
      twist: () => ({ twist: 30 }),
    } });
    const o = boneIndex('thighL') * 7;
    const B = fig.clips.twist.b;
    const q = [B[o], B[o + 1], B[o + 2], B[o + 3]];
    // non-identity rotation about the (vertical) twist axis
    expect(Math.abs(q[3])).toBeLessThan(0.9999);
    expect(Math.abs(q[2])).toBeGreaterThan(Math.abs(q[0]));
    expect(Math.abs(q[2])).toBeGreaterThan(Math.abs(q[1]));
  });

  describe('aim lock (opts.aim → aimLockClips)', () => {
    const AIM = { shR: { pitch: 68 }, elbowR: 35, shL: { pitch: 52, yaw: 32 }, elbowL: 85 };
    // forearm direction pitch (deg above horizontal) from a packed clip key
    const forearmPitch = (fig, rig, clip, side, k) => {
      const bones = fig.bones.map((b) => b.id);
      const fi = bones.indexOf('forearm' + side);
      const e = rig.joints['elbow' + side], w = rig.joints['wrist' + side];
      const u = [w.x - e.x, w.y - e.y, w.z - e.z];
      const off = (k * bones.length + fi) * 7;
      const q = [clip.b[off], clip.b[off + 1], clip.b[off + 2], clip.b[off + 3]];
      const d = qrot(q, u);
      return Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI;
    };

    it('holds the gun line rigid WITHIN every clip; root-tilted clips carry the airframe lean', () => {
      const m = miniBiped();
      const fig = bakeUnitRig(m, { keys: 6, aim: AIM });
      const rig = deriveBipedRig(m);
      // topple (the KNOCKDOWN fall) and getup (the rise off the floor) are the
      // reaction collapse/recovery — a floored unit hauling itself up is not
      // expected to hold its gun trained. forward and boost are ROOT-TILTED
      // clips (tilt: −LEAN_TILT / −BOOST_TILT — the WHOLE machine pitches about
      // a low pivot, composed after the aim solve): the stabilizer counters
      // trunk channels, not the airframe — the gun line rides the lean, and the
      // runtime reticle owns world aim. So the invariant splits: rigid within
      // EVERY clip; ONE shared line across all untilted clips; the tilted clips
      // sit lower by exactly their authored root tilt.
      const pitches = {};
      for (const [name, clip] of Object.entries(fig.clips)) {
        if (name === 'topple' || name === 'getup') continue;
        const ps = [];
        for (let k = 0; k < clip.k; k += 1) ps.push(forearmPitch(fig, rig, clip, 'R', k));
        expect(Math.max(...ps) - Math.min(...ps)).toBeLessThan(0.5);   // rigid within the clip
        pitches[name] = ps[0];
      }
      const untilted = Object.entries(pitches)
        .filter(([n]) => n !== 'forward' && n !== 'boost')
        .map(([, p]) => p);
      expect(Math.max(...untilted) - Math.min(...untilted)).toBeLessThan(0.5);   // one shared line
      expect(pitches.idle - pitches.forward).toBeCloseTo(14, 0);   // LEAN_TILT — the run lean
      expect(pitches.idle - pitches.boost).toBeCloseTo(20, 0);     // BOOST_TILT — the flight lean
    });

    it('legs keep the gait while arms are locked; no aim = byte-identical bake', () => {
      const m = miniBiped();
      const aimed = bakeUnitRig(m, { keys: 6, aim: AIM });
      const plain = bakeUnitRig(m, { keys: 6 });
      const qAt = (fig, clip, bone, k) => {
        const bones = fig.bones.map((b) => b.id);
        const off = (k * bones.length + bones.indexOf(bone)) * 7;
        return fig.clips[clip].b.slice(off, off + 4);
      };
      // both bakes carry the READY idle clip (the shared stance); the aim bake
      // additionally locks its idle arms to the weapon, so the idle forearm
      // rotation differs from the plain (ready-guard) idle
      expect(aimed.clips.idle).toBeTruthy();
      expect(plain.clips.idle).toBeTruthy();
      expect(qAt(aimed, 'idle', 'forearmR', 0)).not.toEqual(qAt(plain, 'idle', 'forearmR', 0));
      // idle legs are the SAME ready stance either way (aim owns only the arms)
      expect(qAt(aimed, 'idle', 'thighR', 0)).toEqual(qAt(plain, 'idle', 'thighR', 0));
      // thighs still stride (rotation varies across keys)
      expect(qAt(aimed, 'forward', 'thighR', 0)).not.toEqual(qAt(aimed, 'forward', 'thighR', 3));
      // arms differ from the un-aimed walk (the swing is gone)
      expect(qAt(aimed, 'forward', 'forearmR', 0)).not.toEqual(qAt(plain, 'forward', 'forearmR', 0));
      // opt-in: omitting aim reproduces the exact existing bake
      expect(bakeUnitRig(miniBiped(), { keys: 6 })).toEqual(plain);
    });
  });

  describe('free-hand REST pose (REST_ARM: __rest overlay + restOffHand)', () => {
    const AIM = { shR: { pitch: 68 }, elbowR: 35, shL: { pitch: 52, yaw: 32 }, elbowL: 85 };
    // forearm world-pitch (deg above horizontal) for `side` from a flat clip buffer whose bones are
    // laid out in `boneOrder` (the full bone list for base clips, or the overlay's own subset).
    const forearmPitchFlat = (b, boneOrder, rig, side, k) => {
      const fi = boneOrder.indexOf('forearm' + side);
      const e = rig.joints['elbow' + side], w = rig.joints['wrist' + side];
      const u = [w.x - e.x, w.y - e.y, w.z - e.z];
      const off = (k * boneOrder.length + fi) * 7;
      const d = qrot([b[off], b[off + 1], b[off + 2], b[off + 3]], u);
      return Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI;
    };

    it('bakes a __rest overlay (right arm) on any armed unit; its forearm rests, not aims', () => {
      const m = miniBiped();
      const rig = deriveBipedRig(m);
      const fig = bakeUnitRig(m, { keys: 6, aim: AIM });
      expect(fig.armOverlays).toBeTruthy();
      expect(fig.armOverlays.__rest).toBeTruthy();
      const ovBones = fig.armOverlays.__rest.bones.map((i) => fig.bones[i].id);
      expect(ovBones).toEqual(['upperArmR', 'forearmR']);   // right arm only (weapon is hidden)
      // the rest arm holds a DIFFERENT forearm line than the aim-locked gun (it isn't aiming),
      // and its overlay quat differs from the base idle forearm.
      const allBones = fig.bones.map((b) => b.id);
      const aimPitch = forearmPitchFlat(fig.clips.idle.b, allBones, rig, 'R', 0);
      const restPitch = forearmPitchFlat(fig.armOverlays.__rest.clips.idle.b, ovBones, rig, 'R', 0);
      expect(Math.abs(aimPitch - restPitch)).toBeGreaterThan(5);
      const baseFR = fig.clips.idle.b.slice(allBones.indexOf('forearmR') * 7, allBones.indexOf('forearmR') * 7 + 4);
      const restFR = fig.armOverlays.__rest.clips.idle.b.slice(ovBones.indexOf('forearmR') * 7, ovBones.indexOf('forearmR') * 7 + 4);
      expect(restFR).not.toEqual(baseFR);
      // no aim (unarmed) → no overlays at all
      expect(bakeUnitRig(m, { keys: 4 }).armOverlays).toBeUndefined();
    });

    it('restOffHand rests the shieldless LEFT off-hand; a shield arm ignores it', () => {
      const m = miniBiped();
      const rig = deriveBipedRig(m);
      const base = bakeUnitRig(m, { keys: 4, aim: AIM });
      const rest = bakeUnitRig({ ...m, restOffHand: true }, { keys: 4, aim: AIM });
      const bones = base.bones.map((b) => b.id);
      const lp = (fig) => forearmPitchFlat(fig.clips.idle.b, bones, rig, 'L', 0);
      expect(lp(rest)).not.toBeCloseTo(lp(base), 1);   // the off-hand moved off the aim guard
      // the RIGHT (weapon) arm is untouched by restOffHand
      const rq = (fig) => { const off = bones.indexOf('forearmR') * 7; return fig.clips.idle.b.slice(off, off + 4); };
      expect(rq(rest)).toEqual(rq(base));
      // a unit WITH a shield station ignores restOffHand (never un-seats the shield arm)
      const shielded = { ...m, items: [...m.items, { id: 'shield_l', source: strut(1, 0.4), at: [-2, -0.5, 6.5] }] };
      const sBase = bakeUnitRig(shielded, { keys: 4, aim: AIM });
      const sRest = bakeUnitRig({ ...shielded, restOffHand: true }, { keys: 4, aim: AIM });
      const soff = sBase.bones.map((b) => b.id).indexOf('forearmL') * 7;
      expect(sRest.clips.idle.b.slice(soff, soff + 4)).toEqual(sBase.clips.idle.b.slice(soff, soff + 4));
    });
  });
});
