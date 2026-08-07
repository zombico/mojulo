import { safeJson } from '../emit-util.js';

// The WALKERS channel (city/walkers.plan.md P0): ambient human rig figures that walk a LOOPED path
// forever. Deliberately NOT the entity/AI `controllable` stack (that is the mobile-suit combat actor:
// targeting, collision, chase-cams, hunt-the-pilot). Ambient walkers want only deterministic seeded
// loops — no AI, no collision, no physics — so this is a small self-contained channel.
//
// It REUSES the rig-bake data format (bones + rigid parts + a `forward` pose-curve clip, from
// bakeProtoformRig) and the page-level b64 decoders, but carries its OWN compact bone poser so it
// never depends on the controllable channel being emitted (that block owns the rig runtime AND its
// globals — __world, __bodies — which an ambient world has no reason to pay for). The poser math is
// the exact frame-pair quaternion nlerp the controllable runtime uses (__rigBone), inlined verbatim.
//
// Per frame, per walker, three things are coupled (the gait cycle itself plays IN PLACE; the path
// supplies the travel):
//   1. POSITION — walked along the path by ARC LENGTH, so ground speed is constant regardless of how
//      unevenly the path is sampled (constant-parameter-rate would speed up through long segments).
//   2. HEADING — the figure yaws to the path tangent (a walker baked facing +y would otherwise
//      crab-walk sideways along the route).
//   3. CLIP PHASE — driven by GROUND DISTANCE / strideDistance (one gait cycle = 2 steps), so the
//      planted foot tracks the ground it passes over instead of skating.
//
// Two loop styles, ONE driver — only the path geometry differs:
//   • bumble — a CLOSED circuit (path start ≈ end): rounds it seamlessly, no visible seam.
//   • pacman — an OPEN edge-to-edge corridor: streams across and, at the wrap, relands at the far
//     edge. The pop reads correctly because it lands exactly on the map boundary.
//
// Emitted only when the caller passes a non-empty `walkers`; a walker-free world is byte-identical.
// `cast` (the world runs the cast-shadow channel): walker bone meshes flag themselves as casters
// at construction so ambient figures throw real silhouettes; false ⇒ byte-identical template.
export function walkersChannelScript(walkers, bank, { cast = false } = {}) {
  return `
// ---- walkers channel (ambient rig figures on looped paths) ----
let stepWalkers = () => {};
{
const WALKERS = ${safeJson(walkers)};
const WBANK = ${safeJson(bank)};
const __wONE = new THREE.Vector3(1, 1, 1);
// build one rig group per walker from its referenced bake — a compact __makeRigGroup (bone meshes
// only; no muzzle / thruster / weapon locators, since ambient walkers never fight).
function __buildWalkerRig(fig) {
  const group = new THREE.Group();
  const boneMeshes = fig.bones.map((bn, bi) => {
    const part = fig.parts[bi];
    if (!part) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${cast ? '\n    mesh.castShadow = true;' : ''}
    mesh.matrixAutoUpdate = false;   // one composed matrix per bone per frame
    mesh.frustumCulled = false;      // matrices mutate every frame
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
  return { fig, group, boneMeshes };
}
// arc-length table: cumulative length at each path vertex + total. Lets us place the body by DISTANCE
// (constant ground speed) rather than by raw parameter. For a closed loop the path repeats its first
// point at the end, so the closing segment is included and s % total wraps seamlessly.
function __arcTable(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { cum, total: cum[cum.length - 1] || 1e-6 };
}
// position + segment tangent at arc-length s (caller wraps/clamps s for loop vs corridor).
const __wout = { pos: [0, 0, 0], tan: [1, 0, 0] };
function __atArc(path, cum, s) {
  const total = cum[cum.length - 1];
  s = Math.max(0, Math.min(total, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1e-6, t = (s - cum[i - 1]) / seg;
  const a = path[i - 1], b = path[i];
  __wout.pos[0] = a[0] + (b[0] - a[0]) * t; __wout.pos[1] = a[1] + (b[1] - a[1]) * t; __wout.pos[2] = a[2] + (b[2] - a[2]) * t;
  __wout.tan[0] = b[0] - a[0]; __wout.tan[1] = b[1] - a[1]; __wout.tan[2] = b[2] - a[2];
  return __wout;
}
// one bone's [q, head'] from the walk clip at phase p — the frame-pair quaternion nlerp over the
// clip's sparse keys (wrapping), byte-for-byte the controllable runtime's __rigBone math.
const __wq = new THREE.Quaternion(), __wh = new THREE.Vector3(), __wv = new THREE.Vector3();
const __wheadP = [0, 0, 0];
function __walkerBone(fig, clip, p, bi, outQ, outP) {
  const nb = fig.bones.length, K = clip.k, B = clip.b;
  const kf = (((p % 1) + 1) % 1) * K;
  const i0 = Math.floor(kf) % K, i1 = (i0 + 1) % K, t = kf - Math.floor(kf);
  const o0 = (i0 * nb + bi) * 7, o1 = (i1 * nb + bi) * 7;
  const sgn = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (sgn * B[o1] - B[o0]) * t, B[o0 + 1] + (sgn * B[o1 + 1] - B[o0 + 1]) * t,
           B[o0 + 2] + (sgn * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (sgn * B[o1 + 3] - B[o0 + 3]) * t).normalize();
  outP[0] = B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t;
  outP[1] = B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t;
  outP[2] = B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t;
}
const __walkerRigs = WALKERS.map((w) => {
  const fig = WBANK[w.figure];
  const rig = __buildWalkerRig(fig);
  const at = __arcTable(w.path);
  const clip = fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]];
  // scale the whole rig group (a world-scaled bake dropped into a differently-scaled world — e.g. a
  // ~1.8-unit human sized down to the ~0.6-unit people of a fractal city). Applied once (constant).
  const scale = w.scale > 0 ? w.scale : 1;
  rig.group.scale.setScalar(scale);
  return { w, rig, cum: at.cum, total: at.total, clip, scale,
    // constant ground speed: prefer an explicit period, else derive it from speed × loop length so
    // loops of different sizes all walk at the same pace; else a sane default.
    period: w.period > 0 ? w.period : (w.speed > 0 ? Math.max(0.5, at.total / w.speed) : 8),
    yaw: w.yaw != null ? w.yaw : -Math.PI / 2,   // rig faces +y → subtract 90° so heading 0 aims +x
    // world units advanced per full gait cycle (2 steps). Defaults off the baked figure height (times
    // the group scale, so the scaled foot swing matches the ground it passes over); overridable (P3 tune).
    stride: w.stride > 0 ? w.stride : Math.max(0.05, (fig.figH || 1.8) * 0.72 * scale) };
});
// probe/debug seam (a traversal audit surface, like __mojCtrl entities): the live pose of every walker.
window.__mojWalkers = __walkerRigs.map((r) => ({ figure: r.w.figure, style: r.w.style || null, pos: [0, 0, 0], heading: 0, phase: 0 }));
stepWalkers = (t) => {
  const sec = t / 1000;
  for (let wi = 0; wi < __walkerRigs.length; wi++) {
    const r = __walkerRigs[wi], w = r.w, fig = r.rig.fig, g = r.rig.group;
    // ground distance travelled. loop (bumble) wraps the arc length; open (pacman) clamps at the end
    // until it laps, at which point the wrap relands it at the far edge.
    const s = w.loop === false
      ? Math.min(r.total, (sec / r.period) * r.total)
      : ((sec / r.period) % 1) * r.total;
    const at = __atArc(w.path, r.cum, s), p = at.pos, tan = at.tan;
    const heading = Math.atan2(tan[1], tan[0]);
    g.position.set(p[0], p[1], p[2]);
    g.rotation.set(0, 0, heading + r.yaw);
    const phase = s / r.stride;                 // clip phase from ground distance (no skate)
    for (let bi = 0; bi < fig.bones.length; bi++) {
      const mesh = r.rig.boneMeshes[bi];
      if (!mesh) continue;
      __walkerBone(fig, r.clip, phase, bi, __wq, __wheadP);
      // M·v = head' + q·(v − restHead)  →  compose(position = head' − q·restHead, q, 1)
      const rh = fig.bones[bi].head;
      __wh.set(rh[0], rh[1], rh[2]).applyQuaternion(__wq);
      __wv.set(__wheadP[0] - __wh.x, __wheadP[1] - __wh.y, __wheadP[2] - __wh.z);
      mesh.matrix.compose(__wv, __wq, __wONE);
    }
    const wo = window.__mojWalkers[wi];
    wo.pos[0] = p[0]; wo.pos[1] = p[1]; wo.pos[2] = p[2]; wo.heading = heading; wo.phase = phase;
  }
};
}`;
}
