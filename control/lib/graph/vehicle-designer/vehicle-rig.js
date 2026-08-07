/**
 * vehicle-rig.js — deriveVehicleRig + bakeVehicleRig (drivable-vehicles.plan.md, D1): the veh-*
 * shelf meets the worlds engine. Mirrors the biped pair (unit-pose.js deriveBipedRig /
 * unit-rig.js bakeUnitRig): DERIVE classifies an assembler build's items into vehicle bones —
 * `root` (chassis + everything welded to it: body, lights, payload, interior) and
 * `wheelFL/FR/RL/RR`, found by matching wheel item placements to the chassis's derived axle
 * sockets BY POSITION (deriveAxleSockets — the ms rule, inherited verbatim; ids are never
 * trusted for meaning). BAKE lowers to the SAME packed rig-figure format bakeRigFigure emits
 * (rig:true + bones + per-bone packed parts + per-clip pose curves), so the browser's existing
 * `figure-rig` body path renders it unchanged.
 *
 * One clip: `roll` — phase ∈ [0,1) rotates each wheel bone a full turn about its hub axis
 * (negative about vehicle +x = rolling forward; the drive rule's distance-true wheelPhase drives
 * it exactly as gaitPhase drives a walker's stride, stride = 2πr). The chassis/root holds still.
 * A flip:'x' (left-side) wheel spins identically — rotation about x commutes with the x-mirror.
 * Steering visual (front-wheel yaw) is DEFERRED per the plan's open decision 2 — the bicycle
 * model's body yaw carries the read of "it turns".
 *
 * Frames + units: the build stays in VEHICLE space (+y forward, +z up, +x right — veh-garage.js)
 * and its own units (the shelf speaks cm); normalization centers x/y and grounds min-z at 0,
 * `targetH` optionally scales to a world height. The packed figure carries `yaw: -π/2` so the
 * renderer maps the authored +y nose onto world heading-forward (+x at heading 0), exactly like
 * the polygomer body's yawOffset. Server-side only — NOT part of the browser closure.
 */

import { faceListToMesh } from '../figures/face-mesh.js';
import { b64f32, b64u8 } from '../figures/rig-bake.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';
import { deriveAxleSockets } from './veh-garage.js';

const r4 = (n) => Math.round(n * 1e4) / 1e4 + 0;   // + 0 folds -0 → +0 (sin(-0) artifacts)
const BONE_ORDER = ['root', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'];
const SOCKET_BONE = { 'front-left': 'wheelFL', 'front-right': 'wheelFR', 'rear-left': 'wheelRL', 'rear-right': 'wheelRR' };

/**
 * deriveVehicleRig(manifest) — classify an assembler build (kind:'assembler', items with veh-*
 * `source` recipes) into vehicle bones. Returns { model:'vehicle', facing:'+y', bones,
 * wheels:[{ bone, side, axle, itemIndex, hubCenter, radius, spinAxis }], wheelbase, track,
 * warnings }. hubCenter/wheelbase/track are in BUILD units and build space.
 */
export function deriveVehicleRig(manifest = {}) {
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const warnings = [];
  const chassisIdx = items.findIndex((it) => it && it.source && it.source.garage && it.source.garage.kind === 'veh-chassis');
  if (chassisIdx === -1) throw new Error('deriveVehicleRig: the build carries no veh-chassis item (garage.kind)');
  const chassisItem = items[chassisIdx];
  const chassisAt = Array.isArray(chassisItem.at) ? chassisItem.at : [0, 0, 0];
  // sockets in WORLD (build) space: chassis-local anchors + the chassis item's placement.
  const sockets = deriveAxleSockets(chassisItem.source).map((s) => ({
    ...s,
    anchor: [s.anchor[0] + chassisAt[0], s.anchor[1] + chassisAt[1], s.anchor[2] + (chassisAt[2] || 0)],
  }));

  const wheels = [];
  const claimed = new Set();
  items.forEach((it, itemIndex) => {
    const g = it && it.source && it.source.garage;
    if (!g || g.kind !== 'veh-wheel') return;
    if (it.rotate) warnings.push(`wheel item ${itemIndex} carries a rotate — off-axis hubs are unsupported in v1, classifying by placement anyway`);
    const at = Array.isArray(it.at) ? it.at : [0, 0, 0];
    const hub = (g.hardpoints && g.hardpoints.hubCenter) || [0, 0, 0];
    // flip:'x' (left side) mirrors x; the wheel's hubCenter sits on its own axis (x=0), so the
    // world hub is placement + hub either way.
    const hubCenter = [at[0] + hub[0], at[1] + hub[1], (at[2] || 0) + hub[2]];
    let best = null, bestD = Infinity;
    for (const s of sockets) {
      const d = (s.anchor[0] - hubCenter[0]) ** 2 + (s.anchor[1] - hubCenter[1]) ** 2 + (s.anchor[2] - hubCenter[2]) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    const key = `${best.axle}-${best.side}`;
    if (claimed.has(key)) warnings.push(`two wheels claim the ${key} socket — check the build's placements`);
    claimed.add(key);
    wheels.push({
      bone: SOCKET_BONE[key],
      side: best.side,
      axle: best.axle,
      itemIndex,
      hubCenter: hubCenter.map(r4),
      radius: g.dims && Number.isFinite(g.dims.radius) ? g.dims.radius : null,
      spinAxis: [1, 0, 0],   // the axle runs in vehicle x (veh-wheel localFrame.axle:'x')
    });
  });
  if (wheels.length !== 4) warnings.push(`expected 4 wheels, found ${wheels.length}`);
  wheels.sort((a, b) => BONE_ORDER.indexOf(a.bone) - BONE_ORDER.indexOf(b.bone));

  const frontY = sockets.find((s) => s.axle === 'front').anchor[1];
  const rearY = sockets.find((s) => s.axle === 'rear').anchor[1];
  const left = sockets.find((s) => s.axle === 'front' && s.side === 'left');
  const right = sockets.find((s) => s.axle === 'front' && s.side === 'right');
  const bones = [{ id: 'root', head: [0, 0, 0] }, ...wheels.map((w) => ({ id: w.bone, head: w.hubCenter }))];
  return {
    model: 'vehicle',
    facing: '+y',
    bones,
    wheels,
    wheelbase: r4(Math.abs(frontY - rearY)),
    track: r4(Math.abs(right.anchor[0] - left.anchor[0])),
    warnings,
  };
}

/**
 * bakeVehicleRig(manifest, { keys, targetH }) — lower the build once, partition faces BY ITEM
 * (wheel items → their wheel bone, everything else → root; proximity binding would spin the
 * fenders), and pack the browser's rig-figure format with the single `roll` clip.
 */
export function bakeVehicleRig(manifest = {}, { keys = 12, targetH = null } = {}) {
  const rig = deriveVehicleRig(manifest);
  const { faces, placements } = lowerAssemblerBuild(manifest);
  if (!faces.length) throw new Error('bakeVehicleRig: the build lowered to no faces');

  // normalization from the face bounds: contact patches → z=0, x/y centred, optional height scale.
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (const f of faces) for (const c of f.corners) {
    if (c[0] < mnx) mnx = c[0]; if (c[0] > mxx) mxx = c[0];
    if (c[1] < mny) mny = c[1]; if (c[1] > mxy) mxy = c[1];
    if (c[2] < mnz) mnz = c[2]; if (c[2] > mxz) mxz = c[2];
  }
  const s = targetH ? targetH / ((mxz - mnz) || 1) : 1;
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
  const N = (v) => [(v[0] - cx) * s, (v[1] - cy) * s, (v[2] - mnz) * s];

  // by-ITEM face partition through each placement's contiguous slice of the merged face list.
  const wheelByItem = new Map(rig.wheels.map((w) => [w.itemIndex, w.bone]));
  const buckets = new Map(BONE_ORDER.map((id) => [id, []]));
  placements.forEach((p) => {
    const bone = wheelByItem.get(p.index) || 'root';
    const bucket = buckets.get(bone);
    for (let i = p.faceStart; i < p.faceStart + p.faceCount; i++) {
      bucket.push({ ...faces[i], corners: faces[i].corners.map(N) });
    }
  });

  const bones = rig.bones.map((b) => ({ id: b.id, head: N(b.head).map(r4) }));
  const parts = bones.map((b) => {
    const fs = buckets.get(b.id) || [];
    if (!fs.length) return null;
    const gm = faceListToMesh(fs);
    if (!gm.positions.length) return null;
    return { pos: b64f32(gm.positions), col: b64u8(gm.colors), faces: fs.length, ...(gm.specs ? { spec: b64f32(gm.specs) } : {}) };
  });

  // the `roll` clip: per key, per bone, [qx,qy,qz,qw, hx,hy,hz]. Wheels rotate −2π·phase about
  // vehicle +x (rolling forward); the root (and its head) holds the rest pose.
  const flat = [];
  for (let k = 0; k < keys; k++) {
    const th = -2 * Math.PI * (k / keys);
    const qx = r4(Math.sin(th / 2)), qw = r4(Math.cos(th / 2));
    for (const b of bones) {
      if (b.id === 'root') flat.push(0, 0, 0, 1, ...b.head);
      else flat.push(qx, 0, 0, qw, ...b.head);
    }
  }

  return {
    rig: true,
    model: 'vehicle',
    facing: '+y',
    yaw: -Math.PI / 2,   // authored nose +y → world heading-forward (+x at heading 0)
    bones,
    parts,
    clips: { roll: { k: keys, b: flat } },
    figH: r4((mxz - mnz) * s),
    // drivetrain-facing geometry, in the BAKE's (post-scale) units — deriveDrivetrain (D3)
    // reads these for the drive rule's wheelbase/wheelRadius.
    wheelbase: r4(rig.wheelbase * s),
    wheelRadius: rig.wheels.length && Number.isFinite(rig.wheels[0].radius) ? r4(rig.wheels[0].radius * s) : null,
    warnings: rig.warnings,
  };
}
