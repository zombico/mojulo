/**
 * wreck-channel — a DESTROYED body on the page (a downed body whose `vanish.die` is a destruction, gameworld/vanish.js;
 * the runtime marks it `e.wreck`, worlds/controllable/vanish.js). The body is its bones' rigid meshes (controllable's
 * rig group: one mesh a bone); a dismantle cuts the RELATIONS between them, never a face: the joints are the rig's own
 * (each bone's parent, figures/rig-tpose.js humanoidParents, read off its rest geometry; a rig that is not a humanoid's
 * takes the bone nearest its head), the severed ones are the `sever` word's, and each group still joined falls as one
 * rigid piece where the body stood, tumbling off the blow, landing on its corners and coming to rest (when only some
 * joints go, the trunk stays on the body and falls on its own fall clip). A CLEAVE cuts by
 * part instead: the figure carries its slash (scene/rig-cleave.js, laid at mint: each bone above or below the cut whole,
 * each it crossed as two capped halves), the side above slips off along the cut as a piece and the side below stays on
 * the body, falling on its own fall clip, a streak
 * of light along the cut for a breath. When the body goes its pieces fade (or sink, a `sink` going). A MODE DEFEATED
 * (e.shed) tears off what the figure it was carries and the next lacks (its figure's `shed`, scene/rig-shed.js), each
 * bone's piece thrown off the blow, while the body rises in its next mode.
 *
 *   wreckGroups(bones, parent, { sever, seed, ride, limbs })   → { groups: [[bone index]], cut: [bone id] }
 *     sever  all    every joint, but a bone shorter than `ride` rides its parent (a finger its hand, a toe its foot)
 *            limbs  the joints above the head and the limbs (WRECK_LIMBS: head, upper arms, thighs), the trunk one piece
 *            head   the head's alone
 *            some   two or three of the limbs' and the head's, on the dice (`seed`)
 *   wreckPiece(points, centre, v, w)   → a rigid piece: its corners about its centre, its velocity and spin
 *   wreckStep(B, dt, ground)            → B stepped `dt` (gravity, the floor at `ground` met at its corners: an impulse
 *                                       with restitution and friction, so a bone tips onto a face and settles)
 *   wreckScript()                       → the page's block: `__stepWrecks()`, called each frame by the status step
 *
 * Every function above is import-free: the page runs their source (toString), so the pieces fall the same way in a
 * test and on the page. Seeded (mulberry32 over the body's seed), stepped at a fixed 1/120 s against the world clock, so
 * a replay falls identically. Emitted only into a page whose world has a body destroyed (events.wreck), so every other
 * page keeps every byte.
 */

/** the joints `limbs` cuts: above the head and each limb (the default of wreckGroups's `limbs`, written there: its source runs alone) */
export const WRECK_LIMBS = Object.freeze(['head', 'upperArmL', 'upperArmR', 'thighL', 'thighR']);

export function wreckGroups(bones, parent, { sever = 'all', seed = 1, ride = 0.065, limbs = ['head', 'upperArmL', 'upperArmR', 'thighL', 'thighR'] } = {}) {
  const n = bones.length, ids = bones.map((b) => b.id);
  const len = (b) => Math.hypot(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]);
  // (no parents given: each bone joins the bone whose segment passes nearest its head)
  const segD = (p, a, b) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]; const t = L > 0 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L)) : 0; return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t); };
  const P = Array.isArray(parent) && parent.length === n ? parent : bones.map((b, i) => { let best = -1, bd = Infinity; bones.forEach((o, j) => { if (j !== i && j < i) { const d = segD(b.head, o.head, o.tail); if (d < bd) { bd = d; best = j; } } }); return best; });
  let named = limbs.filter((id) => ids.includes(id));
  if (sever === 'head') named = named.filter((id) => id === 'head');
  if (sever === 'some') {
    let a = seed >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pool = named.slice(), k = Math.min(pool.length, 2 + (rnd() < 0.5 ? 1 : 0)); named = [];
    for (let i = 0; i < k; i++) named.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  const cuts = (i) => (sever === 'all' ? len(bones[i]) >= ride : named.includes(ids[i]));
  const root = bones.map((_, i) => i), find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  const cut = [];
  for (let i = 0; i < n; i++) { if (P[i] < 0) continue; if (cuts(i)) cut.push(ids[i]); else root[find(i)] = find(P[i]); }
  const by = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!by.has(r)) by.set(r, []); by.get(r).push(i); }
  return { groups: [...by.values()], cut };
}

export function wreckPiece(points, centre, v, w) {
  const local = points.map((p) => [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]]);
  const I = Math.max(1e-4, local.reduce((s, r) => s + r[0] * r[0] + r[1] * r[1] + r[2] * r[2], 0) / Math.max(1, local.length) * 0.4);
  return { x: [centre[0], centre[1], centre[2]], v: [v[0], v[1], v[2]], w: [w[0], w[1], w[2]], q: [0, 0, 0, 1], local, I, still: 0, rest: false };
}

export function wreckStep(B, dt, ground, { g = 14, e = 0.22, mu = 0.6 } = {}) {
  if (B.rest) return B;
  const rot = (q, p) => { const [x, y, z, w] = q, ix = w * p[0] + y * p[2] - z * p[1], iy = w * p[1] + z * p[0] - x * p[2], iz = w * p[2] + x * p[1] - y * p[0], iw = -x * p[0] - y * p[1] - z * p[2]; return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  B.v[2] -= g * dt;
  for (let k = 0; k < 3; k++) B.x[k] += B.v[k] * dt;
  // the spin: q' = q + ½ (w, 0) ⊗ q dt
  const [qx, qy, qz, qw] = B.q, [wx, wy, wz] = B.w, h = 0.5 * dt;
  const q = [qx + h * (wx * qw + wy * qz - wz * qy), qy + h * (wy * qw + wz * qx - wx * qz), qz + h * (wz * qw + wx * qy - wy * qx), qw - h * (wx * qx + wy * qy + wz * qz)];
  const ql = Math.hypot(q[0], q[1], q[2], q[3]) || 1; B.q = q.map((c) => c / ql);
  // the floor: the deepest corner under it lifted out, and the impulse there (restitution e, friction mu)
  let deep = null, dz = 0;
  for (const r of B.local) { const p = rot(B.q, r), z = B.x[2] + p[2]; if (z < ground && ground - z > dz) { dz = ground - z; deep = p; } }
  if (!deep) { B.still = 0; return B; }
  B.x[2] += dz;
  const vr = [B.v[0] + (B.w[1] * deep[2] - B.w[2] * deep[1]), B.v[1] + (B.w[2] * deep[0] - B.w[0] * deep[2]), B.v[2] + (B.w[0] * deep[1] - B.w[1] * deep[0])];
  if (vr[2] < 0) {
    const rn = cr(deep, [0, 0, 1]), jn = (-(1 + e) * vr[2]) / (1 + (rn[0] * rn[0] + rn[1] * rn[1] + rn[2] * rn[2]) / B.I);
    B.v[2] += jn; for (let k = 0; k < 3; k++) B.w[k] += (rn[k] * jn) / B.I;
    const vt = Math.hypot(vr[0], vr[1]);
    if (vt > 1e-6) {
      const t = [vr[0] / vt, vr[1] / vt, 0], rt = cr(deep, t), jt = Math.min(mu * jn, vt / (1 + (rt[0] * rt[0] + rt[1] * rt[1] + rt[2] * rt[2]) / B.I));
      B.v[0] -= jt * t[0]; B.v[1] -= jt * t[1]; for (let k = 0; k < 3; k++) B.w[k] -= (rt[k] * jt) / B.I;
    }
  }
  // (on the floor it rolls to a stop: a one-corner contact alone would rock it forever between its corners)
  for (let k = 0; k < 3; k++) B.w[k] *= 0.96;
  B.v[0] *= 0.99; B.v[1] *= 0.99;
  // at rest once it has sat still a moment on the floor
  const still = Math.hypot(B.v[0], B.v[1], B.v[2]) < 0.12 && Math.hypot(B.w[0], B.w[1], B.w[2]) < 1;
  B.still = still ? B.still + dt : 0;
  if (B.still > 0.25) { B.rest = true; B.v = [0, 0, 0]; B.w = [0, 0, 0]; }
  return B;
}

export function wreckScript() {
  return `
// WRECKS: a destroyed body (e.wreck) as its pieces: the rig's bone meshes grouped by the joints left (wreck-channel.js),
// each group a rigid piece falling where the body stood, faded (or sunk) when it goes
const __wkGroups = ${wreckGroups.toString()};
const __wkPiece = ${wreckPiece.toString()};
const __wkStep = ${wreckStep.toString()};
const __wkLive = {}, __WK_DT = 1 / 120;
function __wkMake(e) {
  const body = window.__mojCtrl.bodies && window.__mojCtrl.bodies[e.id], rf = body && body.userData.rigFig;
  if (!rf) return { none: true };
  body.updateMatrixWorld(true);
  const fig = rf.fig, W = e.wreck, box = new THREE.Box3(), V = new THREE.Vector3();
  let a = (W.seed >>> 0) || 1; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // the pieces: a dismantle's groups of bones still joined (wreckGroups); a cleave's two sides of its cut (rig-cleave.js,
  // laid on the figure at mint: each bone above or below the slash whole, each it crossed as its two halves)
  const CL = W.die === 'cleave' && fig.wreck && fig.wreck.cleave;
  const half = (h) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(decodeF32(h.pos), 3)); g.setAttribute('color', new THREE.BufferAttribute(decodeU8(h.col), 3, true)); g.computeBoundingBox(); return g; };
  const sets = CL ? [1, -1].map((sd) => rf.boneMeshes.flatMap((m, i) => (!m ? [] : CL.side[i] === sd ? [{ m, geo: m.geometry }] : CL.side[i] === 0 ? [{ m, geo: half(CL.cut[i][sd > 0 ? 'up' : 'down']), own: true }] : [])))
    : __wkGroups(fig.bones, fig.wreck && fig.wreck.parent, { sever: W.sever, seed: W.seed, ride: 0.065 }).groups.map((ids) => ids.map((i) => rf.boneMeshes[i]).filter(Boolean).map((m) => ({ m, geo: m.geometry })));
  // the floor: where the body's lowest point stood when it went down
  let ground = Infinity;
  for (const m of rf.boneMeshes) if (m) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); ground = Math.min(ground, box.min.z); }
  if (!isFinite(ground)) return { none: true };
  // a cleave's cut in the world: the plane through the trunk's bone as it stands now
  let nW = null, atW = null;
  if (CL) {
    const ti = fig.bones.findIndex((b) => b.id === 'torso'), tm = rf.boneMeshes[ti >= 0 ? ti : 0] || rf.boneMeshes.find(Boolean), n = CL.plane.n;
    nW = new THREE.Vector3(n[0], n[1], n[2]).transformDirection(tm.matrixWorld);
    atW = new THREE.Vector3(n[0] * CL.plane.d, n[1] * CL.plane.d, n[2] * CL.plane.d).applyMatrix4(tm.matrixWorld);
  }
  const pieces = [], hidden = [], swapped = [], big = Math.max(...sets.map((g) => g.length));
  // the LIVE side stays on the body and falls on its own fall clip, a body as it dies: a cleave's below the cut (its
  // crossed bones wearing their lower halves), a dismantle's trunk when only some joints go; every other side a piece
  const live = CL ? 1 : W.sever !== 'all' ? sets.findIndex((g) => g.length === big) : -1;
  const keep = new Set(live >= 0 ? sets[live].map((x) => x.m) : []);
  for (const m of rf.boneMeshes) if (m && !keep.has(m)) { m.visible = false; hidden.push(m); }
  if (live >= 0) for (const { m, geo, own: mine } of sets[live]) if (mine) { swapped.push({ m, geo: m.geometry, half: geo }); m.geometry = geo; }
  sets.forEach((ms, gi) => {
    if (!ms.length || gi === live) return;
    const pts = [], c = [0, 0, 0];
    for (const { m, geo } of ms) {
      if (!geo.boundingBox) geo.computeBoundingBox(); const b = geo.boundingBox;
      for (let j = 0; j < 8; j++) { V.set(j & 1 ? b.max.x : b.min.x, j & 2 ? b.max.y : b.min.y, j & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld); pts.push([V.x, V.y, V.z]); c[0] += V.x; c[1] += V.y; c[2] += V.z; }
    }
    c[0] /= pts.length; c[1] /= pts.length; c[2] /= pts.length;
    const f = W.from || [0, 0];
    let v, w;
    if (CL) {
      // the side above the cut slips off along it, down its slope and out of it, off the blow; the side below gives way
      const up = gi === 0, sl = new THREE.Vector3(0, 0, -1).addScaledVector(nW, nW.z).normalize();
      v = up ? [sl.x * 1.3 + nW.x * 0.9 + f[0] * 0.8, sl.y * 1.3 + nW.y * 0.9 + f[1] * 0.8, sl.z * 1.3 + nW.z * 0.9] : [f[0] * 0.35, f[1] * 0.35, 0];
      w = [(rnd() - 0.5) * (up ? 4 : 2), (rnd() - 0.5) * (up ? 4 : 2), (rnd() - 0.5) * 2];
    } else {
      // thrown off the blow (the trunk, the biggest piece, only nudged), up, and spun; a body in many pieces mostly drops
      // where it stood, a heap, its pieces only kicked off the blow
      // (a kick, a blast's: thrown hard, never a heap)
      const kick = W.kick || 1, share = ms.length === big ? 0.3 : 1, heap = (sets.length > 8 && kick <= 1 ? 0.45 : 1) * kick, s = (0.8 + 1.6 * rnd()) * share * heap;
      v = [f[0] * s + (rnd() - 0.5) * 1.6 * share * heap, f[1] * s + (rnd() - 0.5) * 1.6 * share * heap, (0.6 + 2.2 * rnd()) * share * heap];
      w = [(rnd() - 0.5) * 12 * share, (rnd() - 0.5) * 12 * share, (rnd() - 0.5) * 8 * share];
    }
    const B = __wkPiece(pts, c, v, w), g = new THREE.Group(), mats = [], own = [];
    g.position.set(c[0], c[1], c[2]);
    const toLocal = new THREE.Matrix4().makeTranslation(-c[0], -c[1], -c[2]);
    for (const { m, geo, own: mine } of ms) {
      const mat = m.material.clone(); mat.transparent = true; mats.push(mat); if (mine) own.push(geo);
      const cp = new THREE.Mesh(geo, mat); cp.matrixAutoUpdate = false; cp.matrix.multiplyMatrices(toLocal, m.matrixWorld); cp.raycast = function () {};
      g.add(cp);
    }
    scene.add(g); pieces.push({ B, g, mats, own });
  });
  // the slash: a streak of light along the cut, gone in a breath
  let streak = null;
  if (CL) {
    const fw = new THREE.Vector3(0, 1, 0).transformDirection(rf.boneMeshes.find(Boolean).matrixWorld), u = new THREE.Vector3().crossVectors(nW, fw).normalize();
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    sm.position.copy(atW); sm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, nW.clone().cross(u), nW)); sm.raycast = function () {}; sm.renderOrder = 20; scene.add(sm); streak = sm;
  }
  return { pieces, hidden, swapped, live: live >= 0 ? sets[live].map((x) => x.m) : null, ground, streak, t: 0, t0: W.t0 };
}
function __wkShed(e, X) {
  const body = window.__mojCtrl.bodies && window.__mojCtrl.bodies[e.id], lo = body && body.userData.loadout, was = lo && lo.variants && lo.variants[X.figure];
  const rf = was && was.userData.rigFig, fig = rf && rf.fig, parts = fig && fig.shed && fig.shed[X.into];
  if (!parts || !rf) return { none: true };
  was.updateMatrixWorld(true);
  let a = (e.id.length * 7919 + X.seq * 104729) >>> 0 || 1; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const box = new THREE.Box3(), V = new THREE.Vector3(); let ground = Infinity;
  for (const m of rf.boneMeshes) if (m) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); ground = Math.min(ground, box.min.z); }
  const pieces = [], f = X.from || [0, 0];
  for (const bi in parts) {
    const m = rf.boneMeshes[bi]; if (!m) continue;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(parts[bi].pos), 3)); geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(parts[bi].col), 3, true)); geo.computeBoundingBox();
    const b = geo.boundingBox, pts = [], c = [0, 0, 0];
    for (let j = 0; j < 8; j++) { V.set(j & 1 ? b.max.x : b.min.x, j & 2 ? b.max.y : b.min.y, j & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld); pts.push([V.x, V.y, V.z]); c[0] += V.x / 8; c[1] += V.y / 8; c[2] += V.z / 8; }
    const s = 1.2 + 1.8 * rnd(), v = [f[0] * s + (rnd() - 0.5) * 2, f[1] * s + (rnd() - 0.5) * 2, 1.5 + 2.5 * rnd()], w = [(rnd() - 0.5) * 14, (rnd() - 0.5) * 14, (rnd() - 0.5) * 10];
    const B = __wkPiece(pts, c, v, w), g = new THREE.Group(), mat = m.material.clone(); mat.transparent = true;
    g.position.set(c[0], c[1], c[2]);
    const cp = new THREE.Mesh(geo, mat); cp.matrixAutoUpdate = false; cp.matrix.multiplyMatrices(new THREE.Matrix4().makeTranslation(-c[0], -c[1], -c[2]), m.matrixWorld); cp.raycast = function () {};
    g.add(cp); scene.add(g); pieces.push({ B, g, mats: [mat], own: [geo] });
  }
  return { pieces, hidden: [], swapped: [], live: null, ground: isFinite(ground) ? ground : 0, streak: null, t: 0, t0: X.t0 };
}
function __wkGone(L) { for (const P of L.pieces || []) { scene.remove(P.g); for (const m of P.mats) m.dispose(); for (const g of P.own) g.dispose(); } L.pieces = []; if (L.streak) { scene.remove(L.streak); L.streak.geometry.dispose(); L.streak.material.dispose(); L.streak = null; } }
function __wkDrop(L) { __wkGone(L); for (const m of L.hidden || []) m.visible = true; for (const S of L.swapped || []) { S.m.geometry = S.geo; S.half.dispose(); } }
// the live side, as it lies when the body goes: a still piece of its own, to fade with the rest
function __wkStill(L) {
  const g = new THREE.Group(), mats = [];
  for (const m of L.live) { m.updateMatrixWorld(true); const mat = m.material.clone(); mat.transparent = true; mats.push(mat); const cp = new THREE.Mesh(m.geometry, mat); cp.matrixAutoUpdate = false; cp.matrix.copy(m.matrixWorld); cp.raycast = function () {}; g.add(cp); }
  scene.add(g); L.pieces.push({ B: { x: [0, 0, 0], q: [0, 0, 0, 1], rest: true }, g, mats, own: [] }); L.live = null;
}
function __stepWrecks() {
  const Wd = window.__mojCtrl && window.__mojCtrl.world; if (!Wd) return;
  const now = Wd.time || 0, seen = {};
  for (const e of Wd.entities) {
    const X = e.wreck; if (!X) continue;
    const key = e.id + '|' + X.t0; seen[key] = 1;
    const L = __wkLive[key] || (__wkLive[key] = __wkMake(e));
    if (L.none || L.done) continue;
    // stepped at a fixed rate against the world clock, so a replay falls the same
    while (L.t + __WK_DT <= now - L.t0) { for (const P of L.pieces) __wkStep(P.B, __WK_DT, L.ground); L.t += __WK_DT; }
    if (X.gone != null && L.live) __wkStill(L);
    const u = X.gone != null ? Math.min(1, (now - X.gone) / 0.9) : 0;
    for (const P of L.pieces) {
      P.g.position.set(P.B.x[0], P.B.x[1], P.B.x[2] - (X.is === 'sink' ? 0.35 * u : 0)); P.g.quaternion.set(P.B.q[0], P.B.q[1], P.B.q[2], P.B.q[3]);
      if (u > 0) for (const m of P.mats) m.opacity = 1 - u;
    }
    if (L.streak) { const k = (now - L.t0) / 0.3; if (k >= 1) { scene.remove(L.streak); L.streak.geometry.dispose(); L.streak.material.dispose(); L.streak = null; } else { L.streak.material.opacity = 1 - k; L.streak.scale.set(0.4 + 0.8 * Math.min(1, k * 3), 1 - k, 1); } }
    if (u >= 1) { __wkGone(L); L.done = true; }
  }
  // a mode DEFEATED (e.shed, a body's modes): what the figure it was carries and the next lacks (its figure's \`shed\`, laid
  // at mint: scene/rig-shed.js) torn off where it was worn, each bone's piece thrown off the blow; the body fights on
  for (const e of Wd.entities) {
    const X = e.shed; if (!X) continue;
    const key = e.id + '#' + X.seq; seen[key] = 1;
    const L = __wkLive[key] || (__wkLive[key] = __wkShed(e, X));
    if (L.none || L.done) continue;
    while (L.t + __WK_DT <= now - L.t0) { for (const P of L.pieces) __wkStep(P.B, __WK_DT, L.ground); L.t += __WK_DT; }
    const u = Math.max(0, Math.min(1, (now - L.t0 - 2.4) / 0.9));
    for (const P of L.pieces) { P.g.position.set(P.B.x[0], P.B.x[1], P.B.x[2]); P.g.quaternion.set(P.B.q[0], P.B.q[1], P.B.q[2], P.B.q[3]); if (u > 0) for (const m of P.mats) m.opacity = 1 - u; }
    if (u >= 1) { __wkGone(L); L.done = true; }
  }
  // a body whose wreck was cleared (a respawn): its pieces taken up, its meshes shown again
  for (const key in __wkLive) if (!seen[key]) { __wkDrop(__wkLive[key]); delete __wkLive[key]; }
}
`;
}
