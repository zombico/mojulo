/**
 * rig-bake — pose CURVES + a rigid-part rig instead of frame stacks (renderer-ladder P2 rung 2,
 * concretized in renderer-convergence.plan.md step 2).
 *
 * The flipbook/`figure-frames` path ships N full geometries per clip (~17k faces/frame → the
 * 24-frame/75MB ceiling). This bakes a figure ONCE:
 *
 *   • REST GEOMETRY, split into rigid PARTS — every rest face binds to the nearest bone
 *     segment (centroid → point-to-segment distance over the biped bone table);
 *   • PER-CLIP POSE CURVES — K sparse keys per clip; each key stores, per bone, a world-space
 *     frame `[qx,qy,qz,qw, hx,hy,hz]` (rotation + posed head position) derived from the SOLVED
 *     armature nodes at that phase. The server owns kinematics (articulate/groundBalance/
 *     poseFns); the page only slerps keys and sets one matrix per bone —
 *     `M = T(head) · R(q) · T(-restHead)` — FK on rigid segments, NOT vertex skinning.
 *
 * Bone rotations are shortest-arc (rest bone dir → posed bone dir); bones that twist about
 * their own axis (pelvis, torso — trunk counter-rotation in a walk) carry an `aux` landmark
 * pair (hip line / shoulder line) and get a full two-vector frame alignment instead.
 *
 * Rigid parts APPROXIMATE smooth flesh: the vajra/protoform surfaces are smooth-unioned across
 * joints, so extreme bends open small seams at the joins — accepted at this art style
 * (renderer-ladder's own "deliberately not: vertex skinning"). What it buys: payloads orders
 * of magnitude smaller than frame stacks, continuous (not 8-frame) poses, per-figure clips
 * that any topology can use (the protoform's chip re-ordering gate does not apply — parts are
 * bound once at rest), and runtime joint overrides (head-look-at) the flipbook can never do.
 *
 * Deterministic by construction: pure arithmetic over the pose functions' output.
 */

import { faceListToMesh } from './face-mesh.js';

// ── quaternion + vec helpers (plain arrays) ──────────────────────────────────
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// rotation matrix (3×3, column basis) → quaternion [x,y,z,w]
// (exported for unit-rig.js — the mobile-suit bake shares this packing math)
export function matToQuat(m) {
  const [xx, yx, zx] = m[0], [xy, yy, zy] = m[1], [xz, yz, zz] = m[2];
  const tr = xx + yy + zz;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(zy - yz) / s, (xz - zx) / s, (yx - xy) / s, s / 4];
  } else if (xx > yy && xx > zz) {
    const s = Math.sqrt(1 + xx - yy - zz) * 2;
    q = [s / 4, (xy + yx) / s, (xz + zx) / s, (zy - yz) / s];
  } else if (yy > zz) {
    const s = Math.sqrt(1 + yy - xx - zz) * 2;
    q = [(xy + yx) / s, s / 4, (yz + zy) / s, (xz - zx) / s];
  } else {
    const s = Math.sqrt(1 + zz - xx - yy) * 2;
    q = [(xz + zx) / s, (yz + zy) / s, s / 4, (yx - xy) / s];
  }
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

// shortest-arc quaternion rotating unit u onto unit v
function arcQuat(u, v) {
  const d = vdot(u, v);
  if (d > 1 - 1e-9) return [0, 0, 0, 1];
  if (d < -1 + 1e-9) {
    // opposite: rotate 180° about any axis ⊥ u
    const axis = Math.abs(u[0]) < 0.9 ? vnorm(vcross(u, [1, 0, 0])) : vnorm(vcross(u, [0, 1, 0]));
    return [axis[0], axis[1], axis[2], 0];
  }
  const c = vcross(u, v);
  const w = 1 + d;
  const l = Math.hypot(c[0], c[1], c[2], w);
  return [c[0] / l, c[1] / l, c[2] / l, w / l];
}

// two-vector frame alignment: the rotation mapping (dir0, aux0) onto (dir1, aux1) — dir is
// exact, aux fixes the twist about it. Frames are built Gram-Schmidt: z' = dir, x' = aux ⊥ dir.
function frameQuat(dir0, aux0, dir1, aux1) {
  if (!aux0 || !aux1) return arcQuat(vnorm(dir0), vnorm(dir1));
  const basis = (dir, aux) => {
    const z = vnorm(dir);
    let x = vsub(aux, z.map((c) => c * vdot(aux, z)));
    if (vlen(x) < 1e-9) return null;
    x = vnorm(x);
    const y = vcross(z, x);
    return [x, y, z];
  };
  const B0 = basis(dir0, aux0), B1 = basis(dir1, aux1);
  if (!B0 || !B1) return arcQuat(vnorm(dir0), vnorm(dir1));
  // M = B1 · B0ᵀ  (columns are images of world axes)
  const col = (i) => [0, 1, 2].map((r) => B1[0][r] * B0[0][i] + B1[1][r] * B0[1][i] + B1[2][r] * B0[2][i]);
  return matToQuat([col(0), col(1), col(2)]);
}

// squared point-to-segment distance
function distSqPointSeg(p, a, b) {
  const ab = vsub(b, a), ap = vsub(p, a);
  const t = Math.max(0, Math.min(1, vdot(ap, ab) / (vdot(ab, ab) || 1)));
  const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
  const d = vsub(p, q);
  return vdot(d, d);
}

export const b64f32 = (arr) => Buffer.from(new Float32Array(arr).buffer).toString('base64');
// per-vertex COLOUR packed as normalized uint8 instead of float32 (4× smaller). Baked colours are
// [0,1] and read back as a normalized THREE attribute (÷255 on the GPU), so the quantization error
// is ≤1/255 — imperceptible on Gouraud-interpolated rig meshes, and the suit roster is the bulk of a
// World's page weight. Decoded by scene-three's `decodeU8` + a normalized BufferAttribute.
export const b64u8 = (arr) => {
  const u = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i++) { const v = arr[i] * 255; u[i] = v <= 0 ? 0 : v >= 255 ? 255 : (v + 0.5) | 0; }
  return Buffer.from(u.buffer).toString('base64');
};
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// ── the biped bone table (armature node names from figure-vajra) ─────────────
// aux = a landmark PAIR whose line fixes the bone's twist (trunk counter-rotation).
// `bindExtend` stretches a bone's BINDING segment past its tail (fraction of its length) so
// end-effector flesh — hands beyond the wrist, feet beyond the ankle — binds to the limb that
// carries it instead of whatever other bone happens to pass nearby. Motion frames are
// unaffected (rotation/head come from the node pair, not the binding segment).
export const BIPED_BONES = [
  { id: 'pelvis', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] },
  { id: 'torso', head: 'navel', tail: 'neckHub', aux: ['shoulderL', 'shoulderR'] },
  { id: 'head', head: 'neckHub', tail: 'headTop' },
  { id: 'uArmL', head: 'shoulderL', tail: 'elbowL' },
  { id: 'fArmL', head: 'elbowL', tail: 'wristL', bindExtend: 0.6 },
  { id: 'uArmR', head: 'shoulderR', tail: 'elbowR' },
  { id: 'fArmR', head: 'elbowR', tail: 'wristR', bindExtend: 0.6 },
  { id: 'thighL', head: 'hipL', tail: 'kneeL' },
  { id: 'calfL', head: 'kneeL', tail: 'ankleL', bindExtend: 0.6 },
  { id: 'thighR', head: 'hipR', tail: 'kneeR' },
  { id: 'calfR', head: 'kneeR', tail: 'ankleR', bindExtend: 0.6 },
];

const toArr = (n) => [n.x, n.y, n.z];

/**
 * bakeRigFigure — the generic baker.
 *
 * @param {object} spec
 * @param {(dof:object) => object} spec.nodesAt  dof → armature nodes ({name:{x,y,z}}), in the
 *   SAME coordinate space as facesAt output.
 * @param {(dof:object) => Array}  spec.facesAt  dof → faces [{corners,fill}] (rest build only).
 * @param {object} spec.clips  clipName → poseFn(phase∈[0,1)) → dof, OR
 *   { nodeFrames: [nodes...] } — pre-solved armature nodes per key (a caller whose kinematic
 *   solve lives elsewhere, e.g. the protoform's balance pipeline, hands frames in directly).
 * @param {number} [spec.keys=8]     pose-curve keys per clip.
 * @param {number} [spec.targetH]    normalize the figure to this height (world units).
 * @param {Array}  [spec.bones=BIPED_BONES]
 * @returns packed rig figure — the shape emitThreeWorld's `figures` packing passes through:
 *   { rig:true, bones:[{id, head:[x,y,z]}], parts:[{pos,col}|null], clips:{name:{k,b:[flat]}}, figH }
 */
export function bakeRigFigure({ nodesAt, facesAt, clips = {}, keys = 8, targetH = null, bones = BIPED_BONES }) {
  const restNodesRaw = nodesAt({});
  const restFacesRaw = facesAt({});
  if (!restFacesRaw.length) throw new Error('rig-bake: rest build produced no faces');

  // normalization from the REST FACE bounds: feet → z=0, x/y centred, optional height scale.
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (const f of restFacesRaw) for (const c of f.corners) {
    if (c[0] < mnx) mnx = c[0]; if (c[0] > mxx) mxx = c[0];
    if (c[1] < mny) mny = c[1]; if (c[1] > mxy) mxy = c[1];
    if (c[2] < mnz) mnz = c[2]; if (c[2] > mxz) mxz = c[2];
  }
  const s = targetH ? targetH / ((mxz - mnz) || 1) : 1;
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
  const N = (v) => [(v[0] - cx) * s, (v[1] - cy) * s, (v[2] - mnz) * s];
  const nNodes = (raw) => {
    const out = {};
    for (const [k, v] of Object.entries(raw)) out[k] = N(toArr(v));
    return out;
  };

  const restNodes = nNodes(restNodesRaw);
  const usable = bones.filter((b) => restNodes[b.head] && restNodes[b.tail]);
  if (!usable.length) throw new Error('rig-bake: no bone endpoints found in nodesAt output');

  // bind every rest face to its nearest bone segment (centroid → segment distance);
  // end-effector bones bind against a segment extended past the tail (bindExtend).
  const bindSegs = usable.map((b) => {
    const h = restNodes[b.head], t = restNodes[b.tail];
    const ext = b.bindExtend || 0;
    return [h, ext ? [t[0] + (t[0] - h[0]) * ext, t[1] + (t[1] - h[1]) * ext, t[2] + (t[2] - h[2]) * ext] : t];
  });
  const partFaces = usable.map(() => []);
  for (const f of restFacesRaw) {
    const corners = f.corners.map(N);
    const cen = [0, 1, 2].map((k) => corners.reduce((a, c) => a + c[k], 0) / corners.length);
    let best = 0, bestD = Infinity;
    for (let bi = 0; bi < usable.length; bi++) {
      const d = distSqPointSeg(cen, bindSegs[bi][0], bindSegs[bi][1]);
      if (d < bestD) { bestD = d; best = bi; }
    }
    partFaces[best].push({ ...f, corners });
  }

  // pack each part once (positions + colours, same face-mesh path as everything else)
  const parts = partFaces.map((fs) => {
    if (!fs.length) return null;
    const gm = faceListToMesh(fs);
    if (!gm.positions.length) return null;
    // per-vertex specular [strength, power] — packed only when a face carried a material
    // `spec` tag (gm.specs null otherwise → byte-identical). Consumed by channels.js
    // __makeRigGroup, same as the unit-rig path.
    return { pos: b64f32(gm.positions), col: b64u8(gm.colors), faces: fs.length, ...(gm.specs ? { spec: b64f32(gm.specs) } : {}) };
  });

  // pose curves: per clip, K keys; per key, per bone, [qx,qy,qz,qw, hx,hy,hz]
  const auxVec = (nodes, aux) => (aux && nodes[aux[0]] && nodes[aux[1]] ? vsub(nodes[aux[1]], nodes[aux[0]]) : null);
  const boneFrame = (bone, nodes) => {
    const dir0 = vsub(restNodes[bone.tail], restNodes[bone.head]);
    const dir1 = vsub(nodes[bone.tail], nodes[bone.head]);
    const q = frameQuat(dir0, auxVec(restNodes, bone.aux), dir1, auxVec(nodes, bone.aux));
    return [...q.map(r4), ...nodes[bone.head].map(r4)];
  };
  const packedClips = {};
  for (const [name, clip] of Object.entries(clips)) {
    const nodeFrames = typeof clip === 'function'
      ? Array.from({ length: keys }, (_, k) => nodesAt(clip(k / keys)))
      : (clip && Array.isArray(clip.nodeFrames) ? clip.nodeFrames : null);
    if (!nodeFrames || !nodeFrames.length) continue;
    const flat = [];
    for (const raw of nodeFrames) {
      const nodes = nNodes(raw);
      for (const bone of usable) flat.push(...boneFrame(bone, nodes));
    }
    packedClips[name] = { k: nodeFrames.length, b: flat };
  }

  return {
    rig: true,
    bones: usable.map((b) => ({ id: b.id, head: restNodes[b.head].map(r4) })),
    parts,
    clips: packedClips,
    figH: r4((mxz - mnz) * s),
  };
}

// ── front doors ───────────────────────────────────────────────────────────────

/**
 * Mega-boy as a rig figure (the FK-posed vajra builder — nodes and faces share one space).
 * Clips: forward walk + lateral strafe, the same pose functions the flipbook bake samples.
 */
export async function bakeMegaBoyRig({ keys = 8, targetH = 1.8 } = {}) {
  const [{ articulate }, { buildMegaBoyVajraFaces }] = await Promise.all([
    import('../polygonizer/figure-vajra.js'),
    import('./character-megaboy-vajra.js'),
  ]);
  const nodesAt = (dof) => {
    const P = articulate(dof);
    for (const S of ['L', 'R']) {   // the builder's lengthened forearm — keep nodes on the flesh
      const el = P['elbow' + S], wr = P['wrist' + S];
      P['wrist' + S] = { x: el.x + (wr.x - el.x) * 1.22, y: el.y + (wr.y - el.y) * 1.22, z: el.z + (wr.z - el.z) * 1.22 };
    }
    return P;
  };
  // the same walk/strafe DOFs megaboy-spike bakes to flipbook frames
  const walkPose = (p) => {
    const sn = Math.sin(p * Math.PI * 2);
    return {
      hipL: { pitch: 28 * sn }, hipR: { pitch: -28 * sn },
      kneeL: Math.max(0, -46 * sn), kneeR: Math.max(0, 46 * sn),
      shL: { pitch: -20 * sn }, shR: { pitch: 20 * sn },
      shoulders: -12 * sn, pelvis: 7.2 * sn,
    };
  };
  const strafePose = (p) => {
    const sn = Math.sin(p * Math.PI * 2);
    return {
      hipL: { yaw: 16 * sn }, hipR: { yaw: -16 * sn },
      kneeL: Math.max(0, 40 * sn), kneeR: Math.max(0, -40 * sn),
      shL: { pitch: 8 }, shR: { pitch: 8 },
    };
  };
  return bakeRigFigure({ nodesAt, facesAt: buildMegaBoyVajraFaces, clips: { forward: walkPose, strafe: strafePose }, keys, targetH });
}

/**
 * Protoform human as a rig figure. Rest faces come from the full figure pipeline
 * (figure-render's world mesher); bone frames from the SAME balanced armature solve the flesh
 * follows, mapped through figure-render's world transform (figureRigSamples owns both, so the
 * spaces agree by construction).
 */
export async function bakeProtoformRig({ proto = {}, garment = null, keys = 8, motion = 'walk' } = {}) {
  const { figureRigSamples } = await import('../polygonizer/figure-render.js');
  const { restFaces, restNodes, nodeFrames } = figureRigSamples({ proto, garment, motion }, keys);
  return bakeRigFigure({
    nodesAt: () => restNodes,          // rest solve — clip frames arrive pre-solved below
    facesAt: () => restFaces,
    clips: { forward: { nodeFrames } },
    targetH: null,                     // figure-render output is already world-scaled
  });
}
