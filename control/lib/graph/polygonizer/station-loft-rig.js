/**
 * station-loft-rig — a LAYERED solid's rig: declared bindings, a rest skeleton, posing with planted toes,
 * skinning, and the packed rig figure the World runtime plays and the skinned glTF writer exports.
 *
 * Recipe additions (docs/planar-drawing.md, construction contract):
 *   rig: {
 *     joints: { <name>: { at: [x,y,z], rides?: <boneId> } },   // rest, recipe frame; VAJRA_CORE names required, never riding
 *     bones:  [{ id, head: <joint>, tail: <joint>, aux?: [<joint>, <joint>] }],   // aux: a two-vector frame (trunk twist)
 *     chains: { <channel>: { axis: 'x'|'y'|'z', sign?, links: [{ pivot: <joint>, joints: [<names>], weight? }] } },
 *     legs:   { L: { hip, knee, hock, toeBase, toeTip, pole: [x,y,z] }, R: {…} },   // the digitigrade chain
 *     reach?: 'reject' | 'clamp',                                                  // an unreachable planted toe
 *   }
 *   parts.<L1>.bind: '<boneId>' | { bone, blend: { <station|back|tip>: { <boneId>: w, … } } }
 * A pinned (L2/L3) part carries NO bind: it inherits its pin face's vertex weights through the pin's own
 * barycentric weights, so a claw belongs to its toe and a tooth to its jaw by construction. Nearest-bone
 * assignment is never used.
 *
 * Pose: `resolvePose` words / raw dof for the vajra core (LIMITS apply), plus this module's channels:
 *   crouch ∈ [0,1] (pelvis drop, toes planted), lift (metres, airborne), support: 'both'|'L'|'R'|'none',
 *   heelL/heelR (degrees the metatarsus rotates about the toe base, about +x), and every rig chain channel.
 * Planted legs: hip from the posed core; toe base and tip FIXED at rest; the metatarsus places the hock from
 * the toe and `heel`; femur + tibia solve two-link to the hock with the declared pole. Unreachable ⇒ `reach`
 * policy: 'reject' throws with the numbers, 'clamp' moves the hock onto the reach sphere and reports the
 * metatarsal error. Never a silent stretch, never a minimum-vertex grounding.
 *
 * Pure, deterministic. Frames are flat (absolute rotation + posed head per bone), IBM = T(−restHead), the
 * contract scene-gltf's skinned writer already has.
 */
import { articulate } from './figure-vajra.js';
import { resolvePose } from './figure-posing.js';
import { matToQuat, frameQuat, b64f32, b64u8 } from '../figures/rig-bake.js';
import { faceColorLinear } from '../figures/face-mesh.js';

export const VAJRA_CORE = ['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
export const RIG_CHANNELS = ['crouch', 'lift', 'support', 'heelL', 'heelR'];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (v) => Math.hypot(v[0], v[1], v[2]); const unit = (v) => { const l = len(v); if (!(l > 1e-12)) throw new Error('station-loft-rig: degenerate vector'); return mul(v, 1 / l); };
const fin3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const AXIS = { x: 0, y: 1, z: 2 };
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const quatToMat = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
const rotAxis = (p, pivot, ax, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); const [i, j] = [(ax + 1) % 3, (ax + 2) % 3]; const u = p[i] - pivot[i], v = p[j] - pivot[j]; const q = [...p]; q[i] = pivot[i] + u * c - v * s; q[j] = pivot[j] + u * s + v * c; return q; };

/** Validate a rig block; returns { joints: { name: at }, rides: { name: boneId }, bones, boneIndex, chains, legs, reach }. */
export function validateRig(rig) {
  if (!rig || typeof rig !== 'object' || !rig.joints || !Array.isArray(rig.bones)) throw new Error('station-loft-rig: rig needs joints and a bones list');
  const joints = {}, rides = {};
  for (const [name, j] of Object.entries(rig.joints)) { const at = Array.isArray(j) ? j : j?.at; if (!fin3(at)) throw new Error(`station-loft-rig: joint ${name} needs a finite at`); joints[name] = [...at]; if (j?.rides) rides[name] = j.rides; }
  for (const c of VAJRA_CORE) { if (!joints[c]) throw new Error(`station-loft-rig: the vajra core joint ${c} is missing`); if (rides[c]) throw new Error(`station-loft-rig: core joint ${c} cannot ride a bone`); }
  const boneIndex = {}; const bones = rig.bones.map((b, i) => {
    if (!b || typeof b.id !== 'string' || boneIndex[b.id] !== undefined) throw new Error(`station-loft-rig: bones[${i}] needs a unique id`);
    for (const k of ['head', 'tail']) if (!joints[b[k]]) throw new Error(`station-loft-rig: bone ${b.id}.${k} names unknown joint ${b[k]}`);
    if (b.head === b.tail) throw new Error(`station-loft-rig: bone ${b.id} has zero length`);
    if (b.aux && !(Array.isArray(b.aux) && b.aux.length === 2 && b.aux.every((j) => joints[j]))) throw new Error(`station-loft-rig: bone ${b.id}.aux must name two joints`);
    boneIndex[b.id] = i; return { id: b.id, head: b.head, tail: b.tail, ...(b.aux ? { aux: [...b.aux] } : {}) };
  });
  for (const [name, bid] of Object.entries(rides)) if (boneIndex[bid] === undefined) throw new Error(`station-loft-rig: joint ${name} rides unknown bone ${bid}`);
  // riding must resolve: a joint rides a bone whose head and tail are core or ride bones that resolve first
  const placed = new Set(Object.keys(joints).filter((n) => !rides[n])); let progress = true;
  while (progress) { progress = false; for (const [name, bid] of Object.entries(rides)) { if (placed.has(name)) continue; const b = bones[boneIndex[bid]]; if (placed.has(b.head) && placed.has(b.tail)) { placed.add(name); progress = true; } } }
  const unresolved = Object.keys(rides).filter((n) => !placed.has(n)); if (unresolved.length) throw new Error(`station-loft-rig: cyclic or dangling rides: ${unresolved.join(', ')}`);
  const chains = {};
  for (const [ch, c] of Object.entries(rig.chains || {})) {
    if (AXIS[c?.axis] === undefined) throw new Error(`station-loft-rig: chain ${ch} axis must be x|y|z`);
    if (!Array.isArray(c.links) || !c.links.length) throw new Error(`station-loft-rig: chain ${ch} needs links`);
    for (const l of c.links) { if (!joints[l.pivot]) throw new Error(`station-loft-rig: chain ${ch} pivot ${l.pivot} is not a joint`); for (const j of l.joints || []) if (!joints[j]) throw new Error(`station-loft-rig: chain ${ch} names unknown joint ${j}`); }
    if (RIG_CHANNELS.includes(ch)) throw new Error(`station-loft-rig: chain ${ch} shadows a built-in channel`);
    chains[ch] = { axis: AXIS[c.axis], sign: c.sign ?? 1, links: c.links.map((l) => ({ pivot: l.pivot, joints: [...(l.joints || [])], weight: l.weight ?? 1 })) };
  }
  const legs = {};
  for (const [S, l] of Object.entries(rig.legs || {})) { for (const k of ['hip', 'knee', 'hock', 'toeBase', 'toeTip']) if (!joints[l?.[k]]) throw new Error(`station-loft-rig: legs.${S}.${k} is not a joint`); if (!fin3(l.pole)) throw new Error(`station-loft-rig: legs.${S}.pole must be a direction`); legs[S] = { ...l, pole: [...l.pole] }; }
  const reach = rig.reach ?? 'reject'; if (reach !== 'reject' && reach !== 'clamp') throw new Error("station-loft-rig: reach must be 'reject' or 'clamp'");
  return { joints, rides, bones, boneIndex, chains, legs, reach };
}

/** A bone's rigid frame from rest to posed: q + rotation matrix; `aux` gives a full two-vector alignment. */
function boneFrame(bone, rest, nodes) {
  const d0 = sub(rest[bone.tail], rest[bone.head]), d1 = sub(nodes[bone.tail], nodes[bone.head]);
  const a0 = bone.aux ? sub(rest[bone.aux[1]], rest[bone.aux[0]]) : null, a1 = bone.aux ? sub(nodes[bone.aux[1]], nodes[bone.aux[0]]) : null;
  const q = frameQuat(d0, a0, d1, a1);
  return { id: bone.id, q, m: quatToMat(q), head: nodes[bone.head], restHead: rest[bone.head], lengthError: Math.abs(len(d1) - len(d0)) };
}
/** Every bone's frame for a posed node map. */
export function boneFrames(R, rest, nodes) { return R.bones.map((b) => boneFrame(b, rest, nodes)); }
const ride = (frame, restPoint) => add(frame.head, mv(frame.m, sub(restPoint, frame.restHead)));

/** Two-link solve: the middle joint for root → target with lengths l1, l2, bent toward `pole`. */
export function solveTwoBone(root, target, l1, l2, pole) {
  const d = len(sub(target, root)); const reach = l1 + l2; const minD = Math.abs(l1 - l2);
  if (d > reach + 1e-9 || d < minD - 1e-9) return { ok: false, excess: d > reach ? d - reach : minD - d, d };
  const axis = unit(sub(target, root)); const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let side = sub(pole, mul(axis, dot(pole, axis))); if (len(side) < 1e-9) throw new Error('station-loft-rig: pole is parallel to the limb'); side = unit(side);
  return { ok: true, mid: add(add(root, mul(axis, a)), mul(side, h)), d };
}

/**
 * Pose the rig: the vajra core through resolvePose/articulate, planted digitigrade legs, riding extension
 * joints, then the chains. Returns { nodes, report: { legs: { S: { planted, reach, metaError } } } }.
 */
export function rigNodesAt(R, pose = {}) {
  const rest = R.joints; const nodes = {};
  const vajraSpec = Object.fromEntries(Object.entries(pose).filter(([k]) => !RIG_CHANNELS.includes(k) && !(k in R.chains)));
  const core = Object.fromEntries(VAJRA_CORE.map((k) => [k, { x: rest[k][0], y: rest[k][1], z: rest[k][2] }]));
  const posed = articulate(resolvePose(vajraSpec, core), core);
  for (const k of VAJRA_CORE) nodes[k] = [posed[k].x, posed[k].y, posed[k].z];
  // crouch: the pelvis (and everything the core carries) drops toward planted toes; lift raises the root
  const support = pose.support ?? 'both'; const lift = Number.isFinite(pose.lift) ? pose.lift : 0; const crouch = Math.max(0, Math.min(1, pose.crouch || 0));
  const legKeys = Object.keys(R.legs); const hipZ = legKeys.length ? Math.min(...legKeys.map((S) => rest[R.legs[S].hip][2])) : 0; const toeZ = legKeys.length ? Math.min(...legKeys.map((S) => rest[R.legs[S].toeBase][2])) : 0;
  const drop = crouch * 0.45 * (hipZ - toeZ);
  for (const k of VAJRA_CORE) nodes[k] = [nodes[k][0], nodes[k][1], nodes[k][2] - drop + lift];
  const report = { legs: {} };
  for (const S of legKeys) {
    const L = R.legs[S]; const planted = lift === 0 && (support === 'both' || support === S);
    const femur = len(sub(rest[L.knee], rest[L.hip])), tibia = len(sub(rest[L.hock], rest[L.knee])), meta = len(sub(rest[L.toeBase], rest[L.hock]));
    if (planted) {
      nodes[L.toeBase] = [...rest[L.toeBase]]; nodes[L.toeTip] = [...rest[L.toeTip]];
      const metaDir = rotAxis(unit(sub(rest[L.hock], rest[L.toeBase])), [0, 0, 0], 0, pose[`heel${S}`] || 0);
      let hock = add(nodes[L.toeBase], mul(metaDir, meta)); let metaError = 0;
      let sol = solveTwoBone(nodes[L.hip], hock, femur, tibia, L.pole);
      if (!sol.ok) {
        if (R.reach === 'reject') throw new Error(`station-loft-rig: leg ${S} cannot reach its planted toe (hip→hock ${sol.d.toFixed(4)} m, femur+tibia ${(femur + tibia).toFixed(4)} m, excess ${sol.excess.toFixed(4)} m) — lower the crouch, change heel${S}, or set rig.reach: 'clamp'`);
        const axis = unit(sub(hock, nodes[L.hip])); const clamped = add(nodes[L.hip], mul(axis, sol.d > femur + tibia ? femur + tibia - 1e-9 : Math.abs(femur - tibia) + 1e-9));
        metaError = Math.abs(len(sub(nodes[L.toeBase], clamped)) - meta); hock = clamped; sol = solveTwoBone(nodes[L.hip], hock, femur, tibia, L.pole);
      }
      nodes[L.hock] = hock; nodes[L.knee] = sol.mid;
      report.legs[S] = { planted: true, reach: metaError > 0 ? 'clamped' : 'ok', metaError: r4(metaError) };
    } else {
      // airborne: the core's own leg pose stands; the toes ride the shin
      const shin = boneFrame({ id: 'shin', head: L.knee, tail: L.hock }, rest, nodes);
      nodes[L.toeBase] = ride(shin, rest[L.toeBase]); nodes[L.toeTip] = ride(shin, rest[L.toeTip]);
      report.legs[S] = { planted: false, reach: 'free', metaError: 0 };
    }
  }
  // extension joints ride their bones, in dependency order
  let pending = Object.keys(R.rides).filter((n) => !nodes[n]); let progress = true;
  while (pending.length && progress) {
    progress = false;
    for (const name of [...pending]) { const b = R.bones[R.boneIndex[R.rides[name]]]; if (!nodes[b.head] || !nodes[b.tail]) continue; nodes[name] = ride(boneFrame(b, rest, nodes), rest[name]); pending = pending.filter((n) => n !== name); progress = true; }
  }
  if (pending.length) throw new Error(`station-loft-rig: could not place ${pending.join(', ')}`);
  for (const [ch, c] of Object.entries(R.chains)) {
    const v = pose[ch]; if (!Number.isFinite(v) || v === 0) continue;
    for (const link of c.links) { const p = [...nodes[link.pivot]]; for (const j of link.joints) nodes[j] = rotAxis(nodes[j], p, c.axis, c.sign * v * link.weight); }
  }
  return { nodes, report };
}

const stationOf = (id) => id.match(/\/(st[^.]+)\.[^.]+$/)?.[1] ?? id.match(/\/(back|tip)$/)?.[1] ?? null;
const topFour = (acc) => { const e = Object.entries(acc).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 4); const s = e.reduce((t, [, w]) => t + w, 0); return e.map(([bi, w]) => [Number(bi), w / s]); };

/**
 * Bind a compiled layered mesh by declaration. Returns { joints: number[4][] , weights: number[4][], dominant: number[] }
 * (bone indices in rig order, per vertex), refusing unknown bones, invalid weights, and a bind on a pinned part.
 */
export function bindLayered(mesh, recipe, R = validateRig(recipe.rig)) {
  const n = mesh.vertices.length; const per = new Array(n); const idx = Object.fromEntries(mesh.pointIds.map((id, i) => [id, i]));
  const boneOf = (id, where) => { const bi = R.boneIndex[id]; if (bi === undefined) throw new Error(`station-loft-rig: ${where} binds unknown bone '${id}'`); return bi; };
  for (let i = 0; i < n; i++) {
    const prov = mesh.provenance[i]; const part = recipe.parts[prov.part];
    if (prov.layer !== 1) continue;
    const bind = part.bind; if (bind === undefined || bind === null) throw new Error(`station-loft-rig: part ${prov.part} has no bind`);
    if (typeof bind === 'string') { per[i] = [[boneOf(bind, prov.part), 1]]; continue; }
    if (!bind || typeof bind !== 'object' || typeof bind.bone !== 'string') throw new Error(`station-loft-rig: part ${prov.part}.bind must be a bone id or { bone, blend }`);
    const st = stationOf(prov.id); const blend = bind.blend?.[st];
    if (!blend) { per[i] = [[boneOf(bind.bone, prov.part), 1]]; continue; }
    const entries = Object.entries(blend); const sum = entries.reduce((t, [, w]) => t + w, 0);
    if (!entries.length || entries.length > 4 || entries.some(([, w]) => !Number.isFinite(w) || w < 0) || Math.abs(sum - 1) > 1e-9) throw new Error(`station-loft-rig: part ${prov.part} blend at ${st} must be ≤ 4 finite non-negative weights summing to 1`);
    per[i] = entries.map(([b, w]) => [boneOf(b, `${prov.part}.${st}`), w]);
  }
  for (const [name, part] of Object.entries(recipe.parts)) if (part.layer !== 1 && part.bind !== undefined) throw new Error(`station-loft-rig: pinned part ${name} cannot bind — it inherits its pin face`);
  const order = Object.entries(mesh.parts).filter(([, p]) => p.layer !== 1).sort(([a, x], [b, y]) => x.layer - y.layer || (a < b ? -1 : 1));
  for (const [name, part] of order) {
    const parent = mesh.parts[part.pin.parent]; const tri = parent.faces[part.pin.face]; if (!tri) throw new Error(`station-loft-rig: ${name} pin face ${part.pin.face} is gone`);
    const acc = {}; tri.forEach((pid, k) => { const w = part.pin.weights[k]; const src = per[idx[pid]]; if (!src) throw new Error(`station-loft-rig: ${name} inherits from unbound ${pid}`); for (const [bi, ww] of src) acc[bi] = (acc[bi] || 0) + w * ww; });
    const inherited = topFour(acc);
    for (let i = 0; i < n; i++) if (mesh.provenance[i].part === name) per[i] = inherited;
  }
  const joints = [], weights = [], dominant = [];
  for (let i = 0; i < n; i++) { const e = per[i]; if (!e) throw new Error(`station-loft-rig: vertex ${mesh.pointIds[i]} unbound`); const j = [0, 0, 0, 0], w = [0, 0, 0, 0]; e.forEach(([bi, ww], k) => { j[k] = bi; w[k] = ww; }); joints.push(j); weights.push(w); dominant.push(e.reduce((b, x) => (x[1] > b[1] ? x : b), e[0])[0]); }
  return { joints, weights, dominant };
}

/** Linear-blend skin: every vertex through its bones' frames. At rest every frame is identity. */
export function skinLayered(mesh, skin, frames) {
  return mesh.vertices.map((v, i) => { const out = [0, 0, 0]; for (let k = 0; k < 4; k++) { const w = skin.weights[i][k]; if (!w) continue; const f = frames[skin.joints[i][k]]; const p = add(f.head, mv(f.m, sub(v, f.restHead))); out[0] += w * p[0]; out[1] += w * p[1]; out[2] += w * p[2]; } return out; });
}

/** Keyposes → phase → pose: vajra words resolved per key, every numeric channel smoothstep-blended, strings held. */
export function layeredClip(keyposes, R, { loop = true } = {}) {
  if (!Array.isArray(keyposes) || !keyposes.length) throw new Error('station-loft-rig: a clip needs keyposes');
  const core = Object.fromEntries(VAJRA_CORE.map((k) => [k, { x: R.joints[k][0], y: R.joints[k][1], z: R.joints[k][2] }]));
  const keys = keyposes.map((k) => { const own = {}; const vajra = {}; for (const [n, v] of Object.entries(k)) if (RIG_CHANNELS.includes(n) || n in R.chains) own[n] = v; else vajra[n] = v; return { ...resolvePose(vajra, core), ...own }; });
  const seq = loop ? [...keys, keys[0]] : keys; const N = seq.length - 1;
  const blend = (a, b, t) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k], y = b[k]; if (typeof x === 'string' || typeof y === 'string') o[k] = t < 0.5 ? (x ?? y) : (y ?? x); else if ((x && typeof x === 'object') || (y && typeof y === 'object')) o[k] = blend(x || {}, y || {}, t); else o[k] = (x || 0) * (1 - t) + (y || 0) * t; } return o; };
  return (phase) => { if (N === 0) return { ...seq[0] }; const p = Math.max(0, Math.min(0.999999, phase)) * N; const i = Math.floor(p); let t = p - i; t = t * t * (3 - 2 * t); return blend(seq[i], seq[i + 1], t); };
}

/**
 * Pack the packed rig figure: parts per DOMINANT bone with explicit per-vertex joints/weights, bones with rest
 * head/tail, clips as [q, head] per bone per key. `dz` seats the figure (the lowering's seat shift).
 */
export function packLayeredRig(mesh, skin, R, { clips = {}, keys = 12, dz = 0, light = [0.35, -0.55, 0.75] } = {}) {
  const rest = Object.fromEntries(Object.entries(R.joints).map(([k, v]) => [k, [v[0], v[1], v[2] + dz]]));
  const L = unit(light); const parts = R.bones.map(() => ({ pos: [], col: [], jnt: [], wgt: [], faces: 0 }));
  mesh.faces.forEach((tri, fi) => {
    const votes = {}; for (const vi of tri) votes[skin.dominant[vi]] = (votes[skin.dominant[vi]] || 0) + 1;
    const bi = Number(Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
    const part = mesh.parts[mesh.provenance[tri[0]].part]; const base = faceColorLinear({ fill: part.tint || '#8a8f96' });
    const p = tri.map((vi) => { const v = mesh.vertices[vi]; return [v[0], v[1], v[2] + dz]; }); const nrm = cross(sub(p[1], p[0]), sub(p[2], p[0])); const nl = len(nrm); const shade = 0.55 + 0.45 * Math.max(0, nl > 1e-12 ? dot(mul(nrm, 1 / nl), L) : 0);
    const P = parts[bi]; P.faces++;
    tri.forEach((vi, k) => { P.pos.push(...p[k]); P.col.push(base[0] * shade, base[1] * shade, base[2] * shade); P.jnt.push(...skin.joints[vi]); P.wgt.push(...skin.weights[vi]); });
  });
  const packedClips = {};
  for (const [name, clip] of Object.entries(clips)) {
    const fn = typeof clip === 'function' ? clip : layeredClip(clip, R); const flat = [];
    for (let k = 0; k < keys; k++) { const { nodes } = rigNodesAt(R, fn(k / keys)); const shifted = Object.fromEntries(Object.entries(nodes).map(([n, v]) => [n, [v[0], v[1], v[2] + dz]])); for (const f of boneFrames(R, rest, shifted)) flat.push(...f.q.map(r4), ...f.head.map(r4)); }
    packedClips[name] = { k: keys, b: flat };
  }
  let mnz = Infinity, mxz = -Infinity; for (const v of mesh.vertices) { if (v[2] + dz < mnz) mnz = v[2] + dz; if (v[2] + dz > mxz) mxz = v[2] + dz; }
  return {
    rig: true, layered: true,
    bones: R.bones.map((b) => ({ id: b.id, head: rest[b.head].map(r4), tail: rest[b.tail].map(r4) })),
    parts: parts.map((P) => (P.faces ? { pos: b64f32(P.pos), col: b64u8(P.col), faces: P.faces, jnt: Buffer.from(Uint8Array.from(P.jnt).buffer).toString('base64'), wgt: b64f32(P.wgt) } : null)),
    clips: packedClips, figH: r4(mxz - mnz),
  };
}

/** The doc's machine gates on a bound, posed rig: weights valid, rest identity, bone lengths, orthonormal frames, planted toes. */
export function auditRig(mesh, skin, R, poses = [{}]) {
  const out = { vertices: mesh.vertices.length, badWeights: 0, blended: 0, restIdentity: 0, maxLengthError: 0, maxOrthoError: 0, maxPlantedDrift: 0, poses: [] };
  for (let i = 0; i < mesh.vertices.length; i++) { const w = skin.weights[i]; const s = w.reduce((a, b) => a + b, 0); if (Math.abs(s - 1) > 1e-9 || w.some((x) => x < 0 || !Number.isFinite(x)) || skin.joints[i].some((j) => j >= R.bones.length)) out.badWeights++; if (w.filter((x) => x > 1e-9).length > 1) out.blended++; }
  const rest = R.joints; const restFrames = boneFrames(R, rest, rest); const atRest = skinLayered(mesh, skin, restFrames);
  atRest.forEach((v, i) => { out.restIdentity = Math.max(out.restIdentity, len(sub(v, mesh.vertices[i]))); });
  for (const pose of poses) {
    const { nodes, report } = rigNodesAt(R, pose); const frames = boneFrames(R, rest, nodes);
    for (const f of frames) { out.maxLengthError = Math.max(out.maxLengthError, f.lengthError); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) out.maxOrthoError = Math.max(out.maxOrthoError, Math.abs(dot(f.m[a], f.m[b]) - (a === b ? 1 : 0))); }
    for (const [S, l] of Object.entries(R.legs)) if (report.legs[S]?.planted) out.maxPlantedDrift = Math.max(out.maxPlantedDrift, len(sub(nodes[l.toeBase], rest[l.toeBase])), len(sub(nodes[l.toeTip], rest[l.toeTip])));
    out.poses.push({ pose, legs: report.legs });
  }
  return out;
}

export { matToQuat };
