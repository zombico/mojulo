// rig-import: a rigged humanoid made elsewhere read into layer 0's pack (docs/foes.md), its bones by name, in the native
// frame whatever the file's, each triangle on the bone that moves it, and every layer-0 shelf taking it as our own
import { describe, it, expect } from 'vitest';
import { importRig, vrmOfName, MODEL_REQUIRED } from './rig-import.js';
import { humanoidParents, tposeFrames } from '../figures/rig-tpose.js';
import { wreckGroups } from './channels/wreck-channel.js';
import { slashPlane, cleaveFigure } from './rig-cleave.js';
import { shedParts } from './rig-shed.js';

// ── a tiny skinned GLB: a box on every joint of a T-posed humanoid, each box weighted wholly to its joint ──────────────
// (glTF's own frame: y up, the figure facing +z, its left on +x; centimetres under an armature scaled to metres)
const T = { Hips: [0, 100, 0], Spine: [0, 112, 0], Spine1: [0, 124, 0], Spine2: [0, 136, 0], Neck: [0, 150, 0], Head: [0, 160, 0],
  LeftShoulder: [5, 145, 0], LeftArm: [18, 145, 0], LeftForeArm: [45, 145, 0], LeftHand: [70, 145, 0], LeftHandIndex1: [78, 145, 0],
  RightShoulder: [-5, 145, 0], RightArm: [-18, 145, 0], RightForeArm: [-45, 145, 0], RightHand: [-70, 145, 0],
  LeftUpLeg: [10, 95, 0], LeftLeg: [10, 52, 0], LeftFoot: [10, 9, 0], LeftToeBase: [10, 2, 12],
  RightUpLeg: [-10, 95, 0], RightLeg: [-10, 52, 0], RightFoot: [-10, 9, 0], RightToeBase: [-10, 2, 12] };
const PARENT = { Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck', LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm', LeftHandIndex1: 'LeftHand',
  RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm', LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot' };
const TOP = 180;   // the head's crown (cm)

function skinnedGlb({ names = Object.keys(T), prefix = 'mixamorig:', rootRotation = null, skin = true, colour = [0.5, 0.2, 0.1, 1] } = {}) {
  const joints = names.filter((n) => T[n]);
  const pos = [], jnt = [], wgt = [], idx = [];
  joints.forEach((n, j) => {
    const c = T[n], h = n === 'Head' ? [5, (TOP - 160) / 2, 5] : [2.5, 2.5, 2.5], o = n === 'Head' ? [0, (TOP - 160) / 2, 0] : [0, 0, 0];
    const base = pos.length / 3;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { pos.push(c[0] + o[0] + sx * h[0], c[1] + o[1] + sy * h[1], c[2] + o[2] + sz * h[2]); jnt.push(j, 0, 0, 0); wgt.push(1, 0, 0, 0); }
    for (const [a, b, d, e] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) idx.push(base + a, base + b, base + d, base + a, base + d, base + e);
  });
  // the feet's boxes stand on the floor (a foot's lowest corner at 0)
  const nodes = [{ name: 'Armature', children: [1], scale: [0.01, 0.01, 0.01], ...(rootRotation ? { rotation: rootRotation } : {}) }];
  const at = {};
  joints.forEach((n, j) => { at[n] = 1 + j; });
  joints.forEach((n) => { const p = PARENT[n], local = p ? T[n].map((v, k) => v - T[p][k]) : T[n]; nodes.push({ name: prefix + n, translation: local, children: joints.filter((c) => PARENT[c] === n).map((c) => at[c]) }); });
  nodes[0].children = [at.Hips];
  nodes.push({ name: 'Body', mesh: 0, ...(skin ? { skin: 0 } : {}) });
  // the inverse bind matrices: each joint's place in the mesh's own space (centimetres) undone, so a vertex is carried
  // into the world by the armature above (its scale, its turn) as an exporter writes it
  const ibm = [];
  for (const n of joints) ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -T[n][0], -T[n][1], -T[n][2], 1);
  const bufs = [new Float32Array(pos), new Uint16Array(jnt), new Float32Array(wgt), new Uint32Array(idx), new Float32Array(ibm)];
  const views = [], accessors = [];
  let off = 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < pos.length; k += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], pos[k + c]); hi[c] = Math.max(hi[c], pos[k + c]); }
  const kinds = [['VEC3', 5126, pos.length / 3, { min: lo, max: hi }], ['VEC4', 5123, jnt.length / 4], ['VEC4', 5126, wgt.length / 4], ['SCALAR', 5125, idx.length], ['MAT4', 5126, ibm.length / 16]];
  bufs.forEach((b, i) => { views.push({ buffer: 0, byteOffset: off, byteLength: b.byteLength }); accessors.push({ bufferView: i, componentType: kinds[i][1], count: kinds[i][2], type: kinds[i][0], ...(kinds[i][3] || {}) }); off += b.byteLength; });
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, nodes.length - 1] }], nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: colour } }],
    ...(skin ? { skins: [{ joints: joints.map((n) => at[n]), inverseBindMatrices: 4 }] } : {}),
    accessors, bufferViews: views, buffers: [{ byteLength: off }],
  };
  const bin = Buffer.concat(bufs.map((b) => Buffer.from(b.buffer)));
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const binP = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binP.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(binP.length, 0x004e4942), binP]);
}
const bone = (pack, id) => pack.bones.find((b) => b.id === id);
const faces = (pack, id) => pack.parts[pack.bones.findIndex((b) => b.id === id)]?.faces ?? 0;

describe('a model\'s bones, by name', () => {
  it('reads each convention\'s names as the humanoid bone they are', () => {
    // (one name per convention: Mixamo, Unreal, Rigify, VRM, 3ds Max Biped; a finger, an end and a twist ride)
    expect(['mixamorig:LeftArm', 'upperarm_l', 'DEF-upper_arm.L', 'leftUpperArm', 'Bip01 L UpperArm'].map(vrmOfName)).toEqual(Array(5).fill('leftUpperArm'));
    expect(['mixamorig:RightLeg', 'calf_r', 'DEF-shin.R', 'rightLowerLeg'].map(vrmOfName)).toEqual(Array(4).fill('rightLowerLeg'));
    expect(['mixamorig:LeftHandIndex1', 'mixamorig:HeadTop_End', 'upperarm_twist_01_l', 'mixamorig:LeftEye'].map(vrmOfName)).toEqual([null, null, null, null]);
  });

  it('stands on the hero\'s bone ids, so the T-pose mold, the cuts and the library read it unchanged', () => {
    const { pack, ledger } = importRig(skinnedGlb());
    expect(pack.bones.map((b) => b.id)).toEqual(['pelvis', 'lumbar', 'torso', 'neck', 'head', 'clavicleL', 'upperArmL', 'foreArmL', 'handL', 'thighL', 'shankL', 'footL', 'toesL', 'clavicleR', 'upperArmR', 'foreArmR', 'handR', 'thighR', 'shankR', 'footR', 'toesR']);
    expect(tposeFrames(pack.bones)).toHaveLength(pack.bones.length);
    expect(humanoidParents(pack.bones)[pack.bones.findIndex((b) => b.id === 'handL')]).toBe(pack.bones.findIndex((b) => b.id === 'foreArmL'));
    expect(ledger.bones.upperArmL).toBe('mixamorig:LeftArm');
  });

  it('refuses a model with no skeleton, and one missing a humanoid bone, naming what is missing', () => {
    expect(() => importRig(skinnedGlb({ skin: false }))).toThrow(/no skin/);
    expect(() => importRig(skinnedGlb({ names: Object.keys(T).filter((n) => n !== 'LeftHand' && n !== 'LeftHandIndex1') }))).toThrow(new RegExp(`no ${MODEL_REQUIRED.find((v) => v === 'leftHand')}`));
  });
});

describe('a model\'s rest, in the native frame', () => {
  it('stands it up, its right on +x and its face to +y, on the floor over its hips, at its own height', () => {
    const { pack } = importRig(skinnedGlb());
    expect(bone(pack, 'thighR').head[0]).toBeGreaterThan(0);
    expect(bone(pack, 'toesL').tail[1]).toBeGreaterThan(bone(pack, 'footL').head[1]);
    expect(bone(pack, 'pelvis').head.slice(0, 2)).toEqual([0, 0]);
    expect(pack.figH).toBeCloseTo((TOP - (9 - 2.5)) / 100 + 0.04, 1);
  });

  it('reads the same body from a file turned another way (the frame is the body\'s, not the file\'s)', () => {
    const a = importRig(skinnedGlb()).pack, b = importRig(skinnedGlb({ rootRotation: [0, 1, 0, 0] })).pack;   // turned half about up
    for (const id of ['head', 'handR', 'toesL']) for (const k of ['head', 'tail']) bone(b, id)[k].forEach((v, i) => expect(v).toBeCloseTo(bone(a, id)[k][i], 3));
  });

  it('scales to the height it is stood at', () => {
    const a = importRig(skinnedGlb()).pack, b = importRig(skinnedGlb(), { height: 2 * a.figH }).pack;
    expect(b.figH).toBeCloseTo(2 * a.figH, 3);
    expect(bone(b, 'head').head[2]).toBeCloseTo(2 * bone(a, 'head').head[2], 3);
  });
});

describe('a model\'s parts', () => {
  it('lays each triangle on the bone that moves it, a finger\'s on its hand', () => {
    const { pack, ledger } = importRig(skinnedGlb());
    expect(faces(pack, 'upperArmR')).toBe(12);
    expect(faces(pack, 'handL')).toBe(24);
    expect(ledger.triangles).toBe(12 * Object.keys(T).length);
  });

  it('is the same bytes from the same file', () => {
    expect(JSON.stringify(importRig(skinnedGlb()).pack)).toBe(JSON.stringify(importRig(skinnedGlb()).pack));
  });

  it('takes every layer-0 cut: a dismantle at its joints, a cleave through its parts, nothing to shed into itself', () => {
    const { pack } = importRig(skinnedGlb());
    const parent = humanoidParents(pack.bones);
    // (every joint lets go, a bone shorter than the ride riding its parent's piece)
    const long = pack.bones.filter((b) => Math.hypot(...b.tail.map((v, i) => v - b.head[i])) >= 0.065).length;
    expect(wreckGroups(pack.bones, parent, { sever: 'all', ride: 0.065 }).groups.length).toBeGreaterThanOrEqual(long);
    expect(wreckGroups(pack.bones, parent, { sever: 'head' }).groups).toHaveLength(2);
    expect(Object.keys(cleaveFigure(pack, { plane: slashPlane(pack.figH, { seed: 3 }) }).cut).length).toBeGreaterThan(0);
    expect(shedParts(pack, pack)).toEqual({});
  });
});
