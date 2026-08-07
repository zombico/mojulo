/**
 * unit-pose — mark an assembled unit as a BIPED model and pose it with the
 * figure's vajra kinematics.
 *
 * The mobile-suit register stores units as plain `assembler` manifests — 45
 * semantically named stations, zero body semantics. This module supplies the
 * body layer:
 *
 *   deriveBipedRig(manifest)   station ids + resolved placements → a rig:
 *                              station→bone map + a suit-proportioned joint
 *                              skeleton (the vajra node set, at the unit's own
 *                              coordinates). `manifest.rig` overrides win.
 *
 *   compileUnitPose(...)       (manifest, pose spec) → a POSED sibling manifest.
 *                              The pose language is figure-posing's resolvePose
 *                              ({ armR:'forward', elbowR: 90, … } or raw dof);
 *                              kinematics + anatomical limits are figure-vajra's
 *                              articulateTransforms run over the SUIT skeleton.
 *                              Each bone's rigid transform lowers to the
 *                              assembler's own vocabulary — per-item `rotate`
 *                              (about the part's local origin) + absolute `at` —
 *                              so the output is a PLAIN assembler manifest:
 *                              /world, /png, .glb, livery recolor, and the skin
 *                              seam all work on it unchanged. Recipes stay
 *                              sovereign; the pose is provenance.
 *
 * Frame: the vajra engine poses in the canonical figure frame (+y forward). A
 * unit authored facing elsewhere (g-series: '-y') is conjugated through its
 * manifest `facing` — rig derivation rotates placements INTO the rig frame, and
 * the resulting bone transforms rotate back OUT to suit coordinates. Sides are
 * therefore anatomical (dof.shR = the unit's right arm) regardless of what the
 * station suffixes claim.
 *
 * Known limitation (state it, don't hide it): posing rotates rigid armor
 * segments — sealed superposition opens at extreme joint angles (a deep knee
 * bend shows the seam, like a real model kit). No ankle DOF: feet ride shins.
 */

import { articulateTransforms } from '../polygonizer/figure-vajra.js';
import { resolvePose } from '../polygonizer/figure-posing.js';
import { resolveAssemblerPlacements } from './workbench-assembler.js';
import { facingYaw } from './workbench.js';

const DEG = Math.PI / 180;

// ── station → bone classification (ordered; first match wins) ────────────────
// Sided bones resolve L/R from the station's RIG-FRAME x sign (not the id
// suffix — authored _l/_r labels can be screen-relative and anatomically
// swapped; position never lies). `foot` and `hand` alias to the bone they
// rigidly ride (the armature has no ankle/wrist DOF).
const STATION_RULES = [
  [/hand|fist|finger|palm/, 'hand'],
  [/forearm|wrist|elbow|gauntlet/, 'forearm'],
  [/upper_arm|bicep|shoulder|pauldron/, 'upperArm'],
  [/foot|toe|sole|heel/, 'foot'],
  [/ankle|lower_leg|shin|calf|greave/, 'shin'],
  [/thigh|knee/, 'thigh'],
  [/head|helmet|visor|crown|mask|face/, 'head'],
  [/waist|abdomen|belly/, 'torso'],
  [/pelvis|hip|skirt|cod|groin/, 'pelvis'],
  [/torso|chest|neck|back|trunk|core|deck|yoke|collar|vent|pack/, 'torso'],
];
// `hand` is now its own sided bone (handL/handR) so a wrist DOF can aim it
// independently of the forearm; with no wrist dof it tracks the forearm exactly
// (byte-identical). `foot` still aliases to the shin (no ankle DOF).
const BONE_ALIAS = { foot: 'shin' };
const SIDED = new Set(['upperArm', 'forearm', 'hand', 'thigh', 'shin']);

const rotZdeg = (deg) => {
  const a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
};
const mmul = (A, B) => A.map((r) => [
  r[0] * B[0][0] + r[1] * B[1][0] + r[2] * B[2][0],
  r[0] * B[0][1] + r[1] * B[1][1] + r[2] * B[2][1],
  r[0] * B[0][2] + r[1] * B[1][2] + r[2] * B[2][2],
]);
const mvec = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];
const transpose = (M) => [[M[0][0], M[1][0], M[2][0]], [M[0][1], M[1][1], M[2][1]], [M[0][2], M[1][2], M[2][2]]];
const IDENT = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const isIdentity = (M) => Math.abs(M[0][0] - 1) < 1e-12 && Math.abs(M[1][1] - 1) < 1e-12 && Math.abs(M[2][2] - 1) < 1e-12
  && Math.abs(M[0][1]) < 1e-12 && Math.abs(M[0][2]) < 1e-12 && Math.abs(M[1][2]) < 1e-12
  && Math.abs(M[1][0]) < 1e-12 && Math.abs(M[2][0]) < 1e-12 && Math.abs(M[2][1]) < 1e-12;

// Euler ↔ matrix in the assembler's own convention: R = Rz(rz)·Ry(ry)·Rx(rx),
// degrees, column vectors — so a compiled `rotate` renders identically there.
export function eulerToMat([rx = 0, ry = 0, rz = 0] = []) {
  const cx = Math.cos(rx * DEG), sx = Math.sin(rx * DEG);
  const cy = Math.cos(ry * DEG), sy = Math.sin(ry * DEG);
  const cz = Math.cos(rz * DEG), sz = Math.sin(rz * DEG);
  return mmul([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]],
    mmul([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]));
}

export function matToEuler(M) {
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  if (Math.abs(M[2][0]) > 1 - 1e-9) {
    // Gimbal: ry = ±90°, split the remaining rotation into rx (rz = 0).
    const ry = M[2][0] < 0 ? 90 : -90;
    const rx = Math.atan2(-M[0][1], M[1][1]) / DEG;
    return [r4(rx), r4(ry), 0];
  }
  const ry = Math.asin(-M[2][0]) / DEG;
  const rx = Math.atan2(M[2][1], M[2][2]) / DEG;
  const rz = Math.atan2(M[1][0], M[0][0]) / DEG;
  return [r4(rx), r4(ry), r4(rz)];
}

const mid = (a, b) => (a + b) / 2;

function unionBounds(list) {
  if (!list.length) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const b of list) for (let i = 0; i < 3; i += 1) {
    if (b.min[i] < min[i]) min[i] = b.min[i];
    if (b.max[i] > max[i]) max[i] = b.max[i];
  }
  return { min, max, cx: mid(min[0], max[0]), cy: mid(min[1], max[1]), cz: mid(min[2], max[2]) };
}

/**
 * Derive the biped rig from an assembler manifest: classify every station into
 * a vajra bone (rig-frame x sign resolves L/R) and locate the joint skeleton
 * from the station geometry. Explicit `manifest.rig.bones` / `manifest.rig.joints`
 * entries override the derivation per key.
 *
 * Returns { model, facing, bones: { stationKey → vajraBone }, joints (RIG frame),
 * stations, warnings }. Throws when a required bone group has no stations.
 */
export function deriveBipedRig(manifest = {}) {
  const placements = resolveAssemblerPlacements(manifest);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const yaw = facingYaw(manifest.facing);
  const A = rotZdeg(-yaw);   // suit → rig frame
  const overrides = manifest.rig && typeof manifest.rig === 'object' ? manifest.rig : {};
  const warnings = [];

  // Rig-frame station records: key, id, base bone, side, bounds, center.
  const stations = placements.map((pl, i) => {
    const id = pl.id || String(i);
    const lower = id.toLowerCase();
    let bone = null;
    let unmatched = false;
    for (const [re, b] of STATION_RULES) { if (re.test(lower)) { bone = b; break; } }
    if (!bone) { bone = 'torso'; unmatched = true; }
    // Rotate the AABB into the rig frame (exact for the cardinal facings).
    let bounds = null;
    if (pl.bounds) {
      const pts = [];
      for (const x of [pl.bounds.min[0], pl.bounds.max[0]]) {
        for (const y of [pl.bounds.min[1], pl.bounds.max[1]]) {
          for (const z of [pl.bounds.min[2], pl.bounds.max[2]]) pts.push(mvec(A, [x, y, z]));
        }
      }
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const p of pts) for (let k = 0; k < 3; k += 1) {
        if (p[k] < min[k]) min[k] = p[k];
        if (p[k] > max[k]) max[k] = p[k];
      }
      bounds = { min, max, cx: mid(min[0], max[0]), cy: mid(min[1], max[1]), cz: mid(min[2], max[2]) };
    }
    return { key: id, id, index: i, item: items[i], base: bone, bounds, unmatched };
  });

  // Resolve sides + aliases → final vajra bone names, honoring overrides.
  const bones = {};
  for (const st of stations) {
    const explicit = overrides.bones && overrides.bones[st.key];
    if (typeof explicit === 'string') { bones[st.key] = explicit; st.bone = explicit; continue; }
    if (st.unmatched) warnings.push(`station '${st.id}' matched no rule — assigned to torso`);
    let bone = BONE_ALIAS[st.base] || st.base;
    if (SIDED.has(bone)) {
      const side = st.bounds && st.bounds.cx < 0 ? 'L' : 'R';   // rig frame: −x = figure's LEFT
      bone = bone + side;
    }
    bones[st.key] = bone;
    st.bone = bone;
  }

  // ── joints, in the rig frame, from grouped station geometry ────────────────
  // Explicit `manifest.rig.joints` entries (suit frame) are applied FIRST — a
  // side whose six joints are all declared (a FROZEN rig, freezeUnitRig) skips
  // geometric derivation entirely, so a declared unit needs no per-segment
  // limb stations. Partially declared sides still derive and the declared
  // entries win per key.
  const group = (re, side) => unionBounds(stations
    .filter((s) => re.test(s.key.toLowerCase()) && (side == null || (side === 'L' ? (s.bounds?.cx ?? 0) < 0 : (s.bounds?.cx ?? 0) >= 0)))
    .map((s) => s.bounds).filter(Boolean));
  const boneGroup = (bone) => unionBounds(stations.filter((s) => s.bone === bone).map((s) => s.bounds).filter(Boolean));

  const joints = {};
  const oj = overrides.joints && typeof overrides.joints === 'object' ? overrides.joints : {};
  for (const [name, p] of Object.entries(oj)) {
    if (!p || typeof p !== 'object') continue;
    const [x, y, z] = mvec(A, [p.x || 0, p.y || 0, p.z || 0]);
    joints[name] = { x, y, z };
  }

  for (const side of ['L', 'R']) {
    const sideNames = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'].map((n) => n + side);
    if (sideNames.every((n) => joints[n])) continue;   // fully declared side — nothing to derive
    const armCore = group(/upper_arm|bicep/, side) || boneGroup(`upperArm${side}`);
    const forearmCore = group(/forearm/, side) || boneGroup(`forearm${side}`);
    const thighCore = group(/thigh/, side) || boneGroup(`thigh${side}`);
    const shinCore = group(/lower_leg|shin|calf|greave/, side) || boneGroup(`shin${side}`);
    if (!armCore || !forearmCore || !thighCore || !shinCore) {
      throw new Error(`deriveBipedRig: missing ${side === 'L' ? 'left' : 'right'}-side limb stations — a biped needs upper-arm, forearm, thigh, and lower-leg groups (or an explicit manifest.rig.joints).`);
    }
    const kneeSt = group(/knee/, side);
    const elbowSt = group(/elbow/, side);
    const ankleSt = group(/ankle/, side);
    joints[`shoulder${side}`] ||= { x: armCore.cx, y: armCore.cy, z: armCore.max[2] };
    joints[`elbow${side}`] ||= elbowSt
      ? { x: elbowSt.cx, y: elbowSt.cy, z: elbowSt.cz }
      : { x: mid(armCore.cx, forearmCore.cx), y: mid(armCore.cy, forearmCore.cy), z: mid(armCore.min[2], forearmCore.max[2]) };
    joints[`wrist${side}`] ||= { x: forearmCore.cx, y: forearmCore.cy, z: forearmCore.min[2] };
    joints[`hip${side}`] ||= { x: thighCore.cx, y: thighCore.cy, z: thighCore.max[2] };
    joints[`knee${side}`] ||= kneeSt
      ? { x: kneeSt.cx, y: kneeSt.cy, z: kneeSt.cz }
      : { x: mid(thighCore.cx, shinCore.cx), y: mid(thighCore.cy, shinCore.cy), z: mid(thighCore.min[2], shinCore.max[2]) };
    joints[`ankle${side}`] ||= ankleSt
      ? { x: ankleSt.cx, y: ankleSt.cy, z: ankleSt.cz }
      : { x: shinCore.cx, y: shinCore.cy, z: shinCore.min[2] };
  }
  joints.pelvisHub ||= {
    x: mid(joints.hipL.x, joints.hipR.x), y: mid(joints.hipL.y, joints.hipR.y), z: mid(joints.hipL.z, joints.hipR.z),
  };
  joints.neckHub ||= {
    x: mid(joints.shoulderL.x, joints.shoulderR.x), y: mid(joints.shoulderL.y, joints.shoulderR.y), z: mid(joints.shoulderL.z, joints.shoulderR.z),
  };
  if (!joints.navel) {
    const waist = group(/waist|abdomen|belly/, null);
    joints.navel = waist
      ? { x: waist.cx, y: waist.cy, z: waist.cz }
      : { x: mid(joints.pelvisHub.x, joints.neckHub.x), y: mid(joints.pelvisHub.y, joints.neckHub.y), z: joints.pelvisHub.z + (joints.neckHub.z - joints.pelvisHub.z) * 0.45 };
  }
  if (!joints.headBase || !joints.headTop) {
    const headGroup = boneGroup('head');
    if (!headGroup) throw new Error('deriveBipedRig: no head stations — a biped needs a head group (or explicit manifest.rig.joints).');
    joints.headBase ||= { x: headGroup.cx, y: headGroup.cy, z: headGroup.min[2] };
    joints.headTop ||= { x: headGroup.cx, y: headGroup.cy, z: headGroup.max[2] };
  }

  return {
    model: 'biped',
    facing: manifest.facing ?? '+y',
    bones,
    joints,
    stations: stations.map((s) => ({ key: s.key, bone: s.bone })),
    ...(warnings.length ? { warnings } : {}),
  };
}

/**
 * Compile a POSE over an assembled biped unit → a posed sibling manifest.
 *
 * `pose` is a figure-posing spec ({ armR:'forward', elbowR:90, spine:{…} }) or
 * raw dof — resolvePose passes raw channels through. Every station is frozen to
 * an absolute placement (gravity seating resolved first), transformed by its
 * bone's rigid motion, then the whole unit is re-grounded so the lowest point
 * sits back on z=0.
 *
 * Returns { manifest, rig, dof, report }.
 */
/**
 * Freeze the DERIVED rig into the manifest — the "declared inner frame" as
 * data. The returned sibling carries `model:'biped'` + a full `rig` (station→
 * bone map + every joint, in SUIT-frame coordinates), so downstream derivation
 * is a pure read: it can never drift from what was proven at mint time, warns
 * about nothing, and no longer needs per-segment limb stations at all. Mint
 * units through this (the segmenter and future assembly scripts do) the same
 * way gravity seats freeze to absolutes.
 */
export function freezeUnitRig(manifest = {}, { rig: rigOverride } = {}) {
  const rig = rigOverride || deriveBipedRig(manifest);
  const At = transpose(rotZdeg(-facingYaw(manifest.facing)));   // rig → suit
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const joints = {};
  for (const [name, p] of Object.entries(rig.joints)) {
    const [x, y, z] = mvec(At, [p.x, p.y, p.z]);
    joints[name] = { x: r4(x), y: r4(y), z: r4(z) };
  }
  return { ...manifest, model: 'biped', rig: { bones: { ...rig.bones }, joints } };
}

// A mobile suit's waist bearing turns the whole upper body far past a human's
// ~30° scapular range; 80° covers a full "torso wound past the legs" swing wind.
export const SUIT_WAIST_SWIVEL = 80;

export function compileUnitPose(manifest = {}, pose = {}, { rig: rigOverride } = {}) {
  const rig = rigOverride || deriveBipedRig(manifest);
  const dof = resolvePose(pose);
  // rigidUpperBody: this is a rigid SUIT, so the chest plate turns as one piece
  // with its shoulder sockets (figure-vajra flag) — the arms root at the torso's
  // sides, never at its front corner or the back. shouldersLimit: a suit's waist
  // bearing swivels far past a human's scapular range, so the girdle turn (which
  // with rigidUpper is a clean waist swivel) gets a mecha-sized cap.
  const { bones: T } = articulateTransforms(dof, rig.joints, { rigidUpperBody: true, shouldersLimit: SUIT_WAIST_SWIVEL });
  const yaw = facingYaw(manifest.facing);
  const A = rotZdeg(-yaw);           // suit → rig
  const At = transpose(A);           // rig → suit

  const placements = resolveAssemblerPlacements(manifest);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const posedItems = [];
  const movedBones = new Set();

  items.forEach((item, i) => {
    const pl = placements[i];
    const key = pl.id || String(i);
    const bone = rig.bones[key];
    const Trig = bone && T[bone] ? T[bone] : null;
    const moved = Trig && !isIdentity(Trig.m);
    if (moved) movedBones.add(bone);

    // Conjugate the bone motion into the suit frame.
    const Rm = moved ? mmul(At, mmul(Trig.m, A)) : IDENT;
    const Rt = moved ? mvec(At, [Trig.t.x, Trig.t.y, Trig.t.z]) : [0, 0, 0];

    const rotOld = Array.isArray(item.rotate) && (item.rotate[0] || item.rotate[1] || item.rotate[2]) ? item.rotate : null;
    const Rnew = moved ? mmul(Rm, rotOld ? eulerToMat(rotOld) : IDENT) : null;
    const rotate = moved ? matToEuler(Rnew) : rotOld;

    const emit = (translate) => {
      const at = moved
        ? mvec(Rm, translate).map((v, k) => Math.round((v + Rt[k]) * 1e4) / 1e4)
        : translate.map((v) => Math.round(v * 1e4) / 1e4);
      posedItems.push({
        source: item.source,
        ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
        at,
        ...(rotate && (rotate[0] || rotate[1] || rotate[2]) ? { rotate } : {}),
        ...(typeof item.flip === 'string' ? { flip: item.flip } : {}),
        ...(Number.isFinite(item.scale) ? { scale: item.scale } : {}),
      });
    };

    // Freeze gravity seating + expand repeats: each copy is posed independently
    // (a repeated part on a rotated bone can't stay a linear array).
    const rep = item.repeat && typeof item.repeat === 'object' ? item.repeat : null;
    const count = rep && Number.isFinite(rep.count) ? Math.max(1, Math.floor(rep.count)) : 1;
    const step = rep && Array.isArray(rep.step) ? rep.step : [0, 0, 0];
    if (!moved && rep) {
      // Unposed bone: keep the repeat, just freeze the seat.
      const { on: _on, gap: _gap, ...rest } = item;
      posedItems.push({ ...rest, at: pl.translate });
    } else {
      for (let k = 0; k < count; k += 1) {
        emit([pl.translate[0] + step[0] * k, pl.translate[1] + step[1] * k, pl.translate[2] + step[2] * k]);
      }
    }
  });

  const posed = {
    kind: 'assembler',
    items: posedItems,
    ...(typeof manifest.units === 'string' ? { units: manifest.units } : {}),
    ...(manifest.viewBox && typeof manifest.viewBox === 'object' ? { viewBox: manifest.viewBox } : {}),
    ...(manifest.facing != null ? { facing: manifest.facing } : {}),
    model: manifest.model || 'biped',
    ...(manifest.rig ? { rig: manifest.rig } : {}),
  };

  // Re-ground exactly: lower the posed unit so its lowest point returns to z=0
  // (posing about a pelvis root lifts planted feet; the grid is the contract).
  const posedPlacements = resolveAssemblerPlacements(posed);
  let minZ = Infinity;
  for (const pl of posedPlacements) if (pl.bounds && pl.bounds.min[2] < minZ) minZ = pl.bounds.min[2];
  if (Number.isFinite(minZ) && Math.abs(minZ) > 1e-6) {
    for (const it of posed.items) it.at = [it.at[0], it.at[1], Math.round((it.at[2] - minZ) * 1e4) / 1e4];
  }

  return {
    manifest: posed,
    rig,
    dof,
    report: {
      movedBones: [...movedBones].sort(),
      stations: items.length,
      groundShift: Number.isFinite(minZ) ? Math.round(-minZ * 1e4) / 1e4 : 0,
      ...(rig.warnings ? { warnings: rig.warnings } : {}),
    },
  };
}
