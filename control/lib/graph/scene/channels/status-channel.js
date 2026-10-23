import { safeJson } from '../emit-util.js';
import { FIRE_COLORANTS } from '../../fire/fire.js';
import { wavePoints, sprayPoints, kokusenBolts, BOLT_SHAPE } from '../../playscape/elements/elements.js';
import { GLYPHS_SRC, SPRAY_SRC } from './moment-channel.js';
import { AURA_SRC } from './aura-src.js';
import { NOISE_GLSL } from '../../noise/noise-glsl.js';

/**
 * status-channel — the page's side of the cast's STATUSES: each status a character carries (e.statuses, held by the
 * character world, put on and lifted by the bus) is drawn on its body as it moves, in its LOOK (playscape/elements):
 *
 *   coat     a second draw of each of the body's meshes (the toon ink hull's idiom: the same triangles, a patched basic
 *            material, so the page's log depth holds): a rim pow(1 - |n·v|, p) added in the colour, or laid in black;
 *            its strength follows the coat's shape, fading in over 0.15 s and out over a timed status's last 0.25 s
 *   motes    each wave's lights as additive sprites round the feet (wavePoints: the one source, run here as in node)
 *   drift    each spray's particles (sprayPoints, born again through their lives) as glyph sprites; a cloud over the
 *            head when they fall from one, rings where drops land
 *   bolts    currents: camera-facing ribbons over a glow edge, struck afresh 8 times a second (black: kokusen; bright:
 *            lightning, a white-hot core)
 *   ice      encase (a randomized angular block round the body, riding it) or spikes (crystals from its surface)
 *   water    drops gather on the body, fall to its feet and ring out · steam: puffs rise, swell and thin
 *   (fire is the fire channel's: a body's fire, carried there)
 *
 * The coat, the ice, the drops and the vapour grow from the body's own meshes, so they fit a box, a ball or a figure.
 * Rides the events channel's frame step (__stepStatus after the cast ops land); ph runs on the world clock from the
 * status's start, so a replay draws the same. Emitted only when a world's cues put a status on someone, with only the
 * looks they name and only the layers those use. Status materials opt out of the fire channel's world light (their own
 * light). `?values` on the page shows the canvas in greys (the values check is the eyes' to make).
 */

/** The statuses a world's events put on its characters (their status reactions), in first-named order. */
export function statusElements(events) {
  const out = [];
  for (const r of (events && events.reactions) || []) if (r && r.do === 'ctrl' && r.op === 'status' && typeof r.is === 'string' && !out.includes(r.is)) out.push(r.is);
  return out;
}

// the surface marks (spikes, drips, vapour) and the ice block, as page source
const SURF = `// SURFACE MARKS (the primal elements): points on a body's own triangles, area-weighted and seeded, each in its mesh's
// frame so it rides the body; a normal flipped outward from the mesh's middle when the winding says otherwise
function __elSurf(meshes, n, seed, up) {
  const tris = []; let total = 0;
  for (const o of meshes) {
    const g = o.geometry, P = g.attributes.position, I = g.index, cnt = I ? I.count : P.count;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const mid = g.boundingSphere.center;
    for (let t = 0; t + 2 < cnt; t += 3) {
      const v = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(P, I ? I.getX(t + j) : t + j));
      const nr = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0])), ar = nr.length() / 2;
      if (ar < 1e-9) continue;
      nr.normalize();
      if (nr.dot(new THREE.Vector3().subVectors(v[0], mid)) < 0) nr.negate();
      if (up && nr.z < up) continue;
      total += ar; tris.push({ o, v, n: nr, acc: total });
    }
  }
  const h = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233 + seed * 37.719) * 43758.5453; return x - Math.floor(x); };
  const out = [];
  for (let i = 0; i < n && tris.length; i++) {
    const r = h(i, 1) * total; let j = 0; while (j < tris.length - 1 && tris[j].acc < r) j++;
    const T = tris[j]; let u = h(i, 2), w = h(i, 3); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const p = T.v[0].clone().addScaledVector(new THREE.Vector3().subVectors(T.v[1], T.v[0]), u).addScaledVector(new THREE.Vector3().subVectors(T.v[2], T.v[0]), w);
    out.push({ o: T.o, p, n: T.n.clone(), h: h(i, 4), k: h(i, 5) });
  }
  return out;
}
const __elSoft = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.45, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
const __elSpr = (tex, rgb, blend) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(rgb[0], rgb[1], rgb[2]), blending: blend, depthWrite: false, transparent: true })); s.visible = false; s.raycast = function () {}; scene.add(s); return s; };
const __elW = new THREE.Vector3();
function __elSurfMake(F, meshes, color) {
  const U = { F, sprs: [], kids: [], rings: [] };
  if (F.kind === 'shards') {
    // ICE (effects/form-effect.js iceGenerator, in 3D): two faceted shards from each point, aimed out along its normal
    // with a spread, four facets each, frost-shaded per facet from a fixed light, the apex palest; a glint at each tip
    U.pts = __elSurf(meshes, F.count, 3.1, null);
    const lt = new THREE.Vector3(0.35, 0.45, 0.82).normalize(), byMesh = new Map();
    U.pts.forEach((s, i) => {
      for (let q = 0; q < 2; q++) {
        const hq = (k) => { const x = Math.sin(i * 7.31 + q * 19.17 + k * 3.7) * 43758.5453; return x - Math.floor(x); };
        const ref = Math.abs(s.n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), bu = new THREE.Vector3().crossVectors(s.n, ref).normalize(), bv = new THREE.Vector3().crossVectors(s.n, bu);
        const dir = s.n.clone().addScaledVector(bu, (hq(1) - 0.5) * 0.9).addScaledVector(bv, (hq(2) - 0.5) * 0.9).normalize();
        const su = new THREE.Vector3().crossVectors(dir, ref).normalize(), sv = new THREE.Vector3().crossVectors(dir, su);
        const shard = { base: s.p.clone().addScaledVector(s.n, -0.02), dir, len: F.length * (0.5 + 0.9 * hq(3)) * (q ? 0.6 : 1), w: F.width * (0.7 + 0.6 * hq(4)), su, sv };
        if (!byMesh.has(s.o)) byMesh.set(s.o, []);
        byMesh.get(s.o).push(shard);
      }
    });
    for (const [o, list] of byMesh) {
      const g = new THREE.BufferGeometry(), pos = new Float32Array(list.length * 36), col = new Float32Array(list.length * 36);
      list.forEach((sh, k) => {
        for (let f = 0; f < 4; f++) {
          const a = [1, -1, -1, 1][f], b = [1, 1, -1, -1][f], a2 = [1, -1, -1, 1][(f + 1) % 4], b2 = [1, 1, -1, -1][(f + 1) % 4];
          const c0 = sh.su.clone().multiplyScalar(a).addScaledVector(sh.sv, b), c1 = sh.su.clone().multiplyScalar(a2).addScaledVector(sh.sv, b2);
          const fn = new THREE.Vector3().addVectors(c0, c1).normalize().multiplyScalar(0.8).addScaledVector(sh.dir, 0.35).normalize(), lit = 0.45 + 0.55 * Math.max(0, fn.dot(lt));
          const base = [0.55 * lit, 0.76 * lit, 0.95 * lit], o9 = k * 36 + f * 9;
          col.set([...base, ...base, 0.95, 0.98, 1], o9);
          (sh.facets || (sh.facets = [])).push([c0, c1]);
        }
      });
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false }));
      m.material.userData.__fire = true;
      m.userData.coat = true; m.raycast = function () {}; m.frustumCulled = false; m.renderOrder = 3; o.add(m);
      U.kids.push({ m, list });
    }
    for (let i = 0; i < Math.min(10, U.pts.length); i++) U.sprs.push(__elSpr(__elTex, [0.9, 0.97, 1], THREE.AdditiveBlending));
  } else if (F.kind === 'drips') {
    // WATER: drops gather on the body's upper surface, let go, fall to its feet and ring out
    U.pts = __elSurf(meshes, F.count, 5.7, 0.15);
    for (const s of U.pts) {
      U.sprs.push(__elSpr(__elTex, color, THREE.AdditiveBlending));
      const r = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.85, 1), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      r.material.userData.__fire = true; r.visible = false; r.raycast = function () {}; scene.add(r); U.rings.push(r);
    }
  } else if (F.kind === 'vapor') {
    // STEAM: puffs leave the body's upper surface, rise, swell and thin away
    U.pts = __elSurf(meshes, F.count, 8.3, 0.2);
    for (const s of U.pts) U.sprs.push(__elSpr(__elSoft, [0.97, 0.98, 1], THREE.NormalBlending));
  }
  return U;
}
function __elSurfStep(U, age, fade, show, footZ) {
  const F = U.F;
  if (F.kind === 'shards') {
    // grown out over 0.7 s, shrunk away as the status runs out
    const gr = Math.min(1, age / 0.7), g = (gr * gr * (3 - 2 * gr)) * Math.min(1, fade * 1.5);
    for (const K of U.kids) {
      K.m.visible = show; K.m.material.opacity = 0.82 * Math.min(1, fade * 1.5);
      if (K.g === g) continue; K.g = g;
      const a = K.m.geometry.attributes.position.array;
      K.list.forEach((sh, k) => {
        const apex = sh.base.clone().addScaledVector(sh.dir, sh.len * g), w = sh.w * (0.4 + 0.6 * g);
        sh.apex = apex;
        sh.facets.forEach(([c0, c1], f) => { const o9 = k * 36 + f * 9, p0 = sh.base.clone().addScaledVector(c0, w), p1 = sh.base.clone().addScaledVector(c1, w); a.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, apex.x, apex.y, apex.z], o9); });
      });
      K.m.geometry.attributes.position.needsUpdate = true;
    }
    U.sprs.forEach((s, i) => {
      const sh = U.kids.length ? U.kids[i % U.kids.length].list[Math.floor(i / U.kids.length) * 2] : null;
      if (!show || !sh || !sh.apex) { s.visible = false; return; }
      const tw = Math.pow(Math.max(0, Math.sin(Math.PI * ((age * 0.45 + i * 0.37) % 1))), 14) * fade * g;
      s.visible = tw > 0.04; sh.apex && s.position.copy(U.kids[i % U.kids.length].m.localToWorld(__elW.copy(sh.apex)));
      s.scale.setScalar(0.08 + 0.22 * tw); s.material.opacity = tw;
    });
  } else if (F.kind === 'drips') {
    U.pts.forEach((s, i) => {
      const spr = U.sprs[i], ring = U.rings[i], T = 0.8 + 0.9 * s.h, tt = (age + s.k * T) % T, hang = 0.35 * T;
      const w = s.o.localToWorld(__elW.copy(s.p).addScaledVector(s.n, 0.03)), drop = Math.max(0.01, w.z - footZ), tf = Math.sqrt(2 * drop / 9.81), t2 = tt - hang;
      spr.visible = ring.visible = false;
      if (!show) return;
      if (tt < hang) { spr.visible = true; spr.position.copy(w); spr.scale.setScalar(0.06 + 0.1 * (tt / hang)); spr.material.opacity = 0.85 * fade; }
      else if (t2 < tf) { spr.visible = true; spr.position.set(w.x, w.y, w.z - 4.905 * t2 * t2); spr.scale.setScalar(0.13); spr.material.opacity = 0.9 * fade; }
      else if (t2 - tf < 0.5) { const ra = (t2 - tf) / 0.5; ring.visible = true; ring.position.set(w.x, w.y, footZ + 0.01); ring.scale.setScalar(0.05 + 0.38 * ra); ring.material.opacity = 0.7 * (1 - ra) * fade; }
    });
  } else if (F.kind === 'vapor') {
    U.pts.forEach((s, i) => {
      const spr = U.sprs[i], T = 1.8 + 1.4 * s.h, u = ((age + s.k * T) % T) / T;
      if (!show) { spr.visible = false; return; }
      const w = s.o.localToWorld(__elW.copy(s.p));
      spr.visible = true; spr.position.set(w.x + Math.sin(s.h * 6.283 + u * 2) * 0.28 * u, w.y + Math.cos(s.k * 9 + u * 2) * 0.28 * u, w.z + 1.4 * u);
      spr.scale.setScalar(0.2 + 0.85 * u); spr.material.opacity = 0.62 * Math.pow(Math.sin(Math.PI * u), 1.1) * fade * Math.min(1, age / 0.6);
    });
  }
}
function __elSurfDrop(U) {
  for (const K of U.kids) { if (K.m.parent) K.m.parent.remove(K.m); K.m.geometry.dispose(); K.m.material.dispose(); }
  for (const s of U.sprs) { scene.remove(s); s.material.dispose(); }
  for (const r of U.rings) { scene.remove(r); r.geometry.dispose(); r.material.dispose(); }
}
`;
const ENCASE = `// ICE ENCASED: a block of ice round the whole body: a faceted shell (an icosahedron cut once more) stretched over the
// body's bounds and pulled about at every corner (a corner shared by facets moves as one), seeded by the body so no two
// blocks are alike, its foot cut flat on the ground; frost-shaded per facet, its edges drawn white, glints at corners
function __elEncase(body, seed, color) {
  body.updateMatrixWorld(true);
  const box = new THREE.Box3();
  body.traverse((o) => { if (o.isMesh && o.geometry && !(o.userData && (o.userData.coat || o.userData.ink))) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  if (box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3()), hs = box.getSize(new THREE.Vector3()).multiplyScalar(0.5), foot = box.min.z;
  const h = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233 + seed * 37.719) * 43758.5453; return x - Math.floor(x); };
  const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position, pull = new Map();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), key = Math.round(x * 997) + ',' + Math.round(y * 997) + ',' + Math.round(z * 997);
    let j = pull.get(key); if (!j) { const n = pull.size; j = [0.8 + 0.42 * h(n, 1), (h(n, 2) - 0.5) * 0.35, (h(n, 3) - 0.5) * 0.35]; pull.set(key, j); }
    const px = c.x + (x * j[0] + j[1] * 0.4) * (hs.x * 1.22 + 0.14), py = c.y + (y * j[0] + j[2] * 0.4) * (hs.y * 1.22 + 0.14);
    P.setXYZ(i, px, py, Math.max(foot, c.z + z * j[0] * (hs.z * 1.14 + 0.14)));
  }
  g.computeVertexNormals();
  // frost per facet: lit from a fixed sky, paler toward the top, the body's tint through it
  const N = g.attributes.normal, col = new Float32Array(P.count * 3), lt = new THREE.Vector3(0.35, 0.45, 0.82).normalize(), top = c.z + hs.z * 1.3 - foot || 1;
  for (let i = 0; i < P.count; i += 3) {
    const lit = 0.45 + 0.55 * Math.max(0, N.getX(i) * lt.x + N.getY(i) * lt.y + N.getZ(i) * lt.z);
    for (let k = 0; k < 3; k++) { const up = Math.min(1, (P.getZ(i + k) - foot) / top) * 0.18; col.set([(color[0] * 0.55 + up) * lit, (color[1] * 0.75 + up) * lit, Math.min(1, color[2] * 0.95 + up) * lit], (i + k) * 3); }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // into the body's own frame, round the block's middle (so it grows from there), riding the body
  const inv = new THREE.Matrix4().copy(body.matrixWorld).invert(), mid = body.worldToLocal(c.clone());
  g.applyMatrix4(inv); g.translate(-mid.x, -mid.y, -mid.z);
  g.computeBoundingBox(); const minZ = g.boundingBox.min.z;
  const grp = new THREE.Group(); grp.position.copy(mid); grp.userData.coat = true;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }); mat.userData.__fire = true;
  const shell = new THREE.Mesh(g, mat); shell.raycast = function () {}; shell.renderOrder = 6;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 12), new THREE.LineBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.7, depthWrite: false })); edges.raycast = function () {}; edges.renderOrder = 7;
  grp.add(shell, edges); body.add(grp);
  const corners = []; for (const [key] of pull) { const [x, y, z] = key.split(',').map(Number); if (z > 0) corners.push(new THREE.Vector3(x, y, z)); }
  const glints = []; for (let i = 0; i < 8; i++) { const v = new THREE.Vector3().fromBufferAttribute(P, Math.floor(h(i, 9) * P.count)); glints.push({ v, s: __elSpr(__elTex, [0.9, 0.97, 1], THREE.AdditiveBlending) }); }
  return { grp, shell, edges, glints, mid, minZ };
}
function __elEncaseStep(E, age, fade, show, melt) {
  // FREEZE: the block rises from the ground; THAW (melt 0 → 1): it sinks back into it, spreading a little, clearing
  const gr = Math.min(1, age / 0.6), up = 1 - Math.pow(1 - gr, 3), sz = (0.05 + 0.95 * up) * (1 - 0.95 * Math.pow(melt, 1.4)), sx = (0.85 + 0.15 * up) * (1 + 0.12 * melt);
  E.grp.visible = show; E.grp.scale.set(sx, sx, sz); E.grp.position.z = E.mid.z + E.minZ * (1 - sz);
  E.shell.material.opacity = 0.42 * Math.min(1, fade * 1.4); E.edges.material.opacity = 0.7 * Math.min(1, fade * 1.4);
  E.glints.forEach((q, i) => { const tw = Math.pow(Math.max(0, Math.sin(Math.PI * ((age * 0.4 + i * 0.29) % 1))), 14) * fade * gr; q.s.visible = show && tw > 0.04; if (q.s.visible) { q.s.position.copy(E.shell.localToWorld(__elW.copy(q.v))); q.s.scale.setScalar(0.1 + 0.3 * tw); q.s.material.opacity = tw; } });
}
function __elEncaseDrop(E) {
  if (E.grp.parent) E.grp.parent.remove(E.grp);
  E.shell.geometry.dispose(); E.shell.material.dispose(); E.edges.geometry.dispose(); E.edges.material.dispose();
  for (const q of E.glints) { scene.remove(q.s); q.s.material.dispose(); }
}
`;
const TRANSIT = `// TRANSITS: how a character comes or goes (spawn / vanish \`with\`, transfigure). Coming, the real
// body plays it (its materials faded, clipped, wired); going, a GHOST does: a copy of its meshes where it stood, since
// the body itself is hidden the moment it is gone. Each runs once on the world clock from the op's own time.
const __TR_DUR = { smoke: 1.1, hologram: 1.4, scan: 1.3, transporter: 1.6, galvatron: 2.0 };
const __TR_COL = { hologram: [0.4, 0.9, 1], scan: [1, 0.45, 0.15], transporter: [0.6, 0.85, 1], galvatron: [0.72, 0.45, 1] };
const __trLive = {};
const __trTex = (stops) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); for (const [o, a] of stops) g.addColorStop(o, 'rgba(255,255,255,' + a + ')'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); };
const __trSoft = __trTex([[0, 0.95], [0.5, 0.45], [1, 0]]), __trDot = __trTex([[0, 1], [0.3, 0.5], [1, 0]]);
const __trH = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
const __trSm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const __trV = new THREE.Vector3();
function __trSpr(tex, rgb, blend) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(rgb[0], rgb[1], rgb[2]), blending: blend, depthWrite: false, transparent: true })); s.visible = false; s.raycast = function () {}; scene.add(s); return s; }
function __trMeshes(root) { const out = []; if (root) root.traverse((o) => { if (o.isMesh && o.geometry && !(o.userData && (o.userData.coat || o.userData.ink))) out.push(o); }); return out; }
// a ghost: each mesh copied where it stands now (its world matrix), materials cloned so they fade alone
function __trGhost(root) {
  const g = new THREE.Group(), mats = [];
  root.updateMatrixWorld(true);
  for (const o of __trMeshes(root)) {
    const ms = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => { const c = m.clone(); c.transparent = true; c.userData.__fire = true; mats.push(c); return c; });
    const c = new THREE.Mesh(o.geometry, Array.isArray(o.material) ? ms : ms[0]); c.matrixAutoUpdate = false; c.matrix.copy(o.matrixWorld); c.raycast = function () {}; g.add(c);
  }
  scene.add(g); return { g, mats, meshes: g.children };
}
// the real body's skin, faded / clipped, and put back as it was
function __trSkin(meshes) {
  const keep = [];
  for (const o of meshes) for (const m of Array.isArray(o.material) ? o.material : [o.material]) keep.push({ m, t: m.transparent, op: m.opacity, cl: m.clippingPlanes });
  return { keep, set(op) { for (const k of keep) { k.m.transparent = true; k.m.opacity = k.op * op; k.m.depthWrite = op > 0.98; } }, clip(planes) { for (const k of keep) { k.m.clippingPlanes = planes; k.m.needsUpdate = true; } }, restore() { for (const k of keep) { k.m.transparent = k.t; k.m.opacity = k.op; k.m.depthWrite = true; k.m.clippingPlanes = k.cl; k.m.needsUpdate = true; } } };
}
// every edge of the body (a curved body's seams are shallow, so all of them: the wire reads as its mesh)
function __trWire(meshes, rgb) {
  return meshes.map((o) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 1), new THREE.LineBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); l.raycast = function () {}; l.renderOrder = 8; o.add(l); return l; });
}
// points on a set of meshes, in the world, picked by the dice from their vertices
function __trPts(meshes, n, seed) {
  const all = [];
  for (const o of meshes) { o.updateMatrixWorld(true); const P = o.geometry.attributes.position; all.push({ o, P }); }
  const out = [], tot = all.reduce((s, a) => s + a.P.count, 0);
  for (let i = 0; i < n && tot; i++) {
    let k = Math.floor(__trH(i, seed) * tot), j = 0; while (k >= all[j].P.count) { k -= all[j].P.count; j++; }
    out.push(new THREE.Vector3().fromBufferAttribute(all[j].P, k).applyMatrix4(all[j].o.matrixWorld));
  }
  return out;
}
function __trBounds(meshes) { const b = new THREE.Box3(); for (const o of meshes) { o.updateMatrixWorld(true); if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } return b; }
function __trMake(e, T, now) {
  const is = T.is, dir = T.dir, I = { is, dir, t0: T.t0, dur: __TR_DUR[is] || 1.2, sprs: [], wires: [], extra: [] };
  const body = window.__mojCtrl.bodies && window.__mojCtrl.bodies[e.id];
  if (!body) return I;
  if (dir === 'out') { I.ghost = __trGhost(body); I.meshes = I.ghost.meshes; } else { I.meshes = __trMeshes(body); I.skin = __trSkin(I.meshes); I.skin.set(0); }
  I.box = __trBounds(I.meshes); I.c = I.box.getCenter(new THREE.Vector3());
  const col = __TR_COL[is] || [1, 1, 1];
  if (is === 'smoke') for (let i = 0; i < 18; i++) I.sprs.push(__trSpr(__trSoft, [0.86, 0.86, 0.88], THREE.NormalBlending));
  if (is === 'hologram' || is === 'galvatron') I.wires = __trWire(I.meshes, col);
  if (is === 'scan') {
    renderer.localClippingEnabled = true;
    I.plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    if (dir === 'out') { for (const m of I.ghost.mats) { m.clippingPlanes = [I.plane]; m.needsUpdate = true; } } else I.skin.clip([I.plane]);
    const r = Math.max(I.box.max.x - I.box.min.x, I.box.max.y - I.box.min.y) * 0.6 + 0.08;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0], col[1], col[2]), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r * 1.04, 48), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    for (const m of [disc, ring]) { m.material.userData.__fire = true; m.raycast = function () {}; m.renderOrder = 9; m.position.set(I.c.x, I.c.y, 0); scene.add(m); I.extra.push(m); }
  }
  if (is === 'transporter') { I.to = __trPts(I.meshes, 48, 3.3); for (let i = 0; i < 48; i++) I.sprs.push(__trSpr(__trDot, col, THREE.AdditiveBlending)); }
  if (is === 'galvatron' && dir === 'out') { I.from = __trPts(I.meshes, 72, 7.7); I.to = null; I.into = T.to; for (let i = 0; i < 72; i++) I.sprs.push(__trSpr(__trDot, col, THREE.AdditiveBlending)); }
  return I;
}
function __trStep(I, u, W) {
  const out = I.dir === 'out', h = I.box.max.z - I.box.min.z, C = I.c, skin = (op) => { if (out) for (const m of I.ghost.mats) m.opacity = op; else I.skin.set(op); };
  const wire = (op) => { for (const l of I.wires) l.material.opacity = op * (0.75 + 0.25 * Math.sin(u * 90)); };
  if (I.is === 'smoke') {
    skin(out ? (u < 0.22 ? 1 : 0) : (u < 0.3 ? 0 : 1));
    I.sprs.forEach((s, i) => {
      const a = __trH(i, 1) * 6.283, up = __trH(i, 2), ex = 1 - Math.pow(1 - u, 2.2), d = 0.25 + 1.05 * ex * (0.6 + 0.6 * __trH(i, 3));
      s.visible = true; s.position.set(C.x + Math.cos(a) * d, C.y + Math.sin(a) * d, I.box.min.z + h * (0.15 + 0.7 * up) + 0.6 * ex);
      s.scale.setScalar((0.35 + 1.1 * ex) * (0.7 + 0.6 * __trH(i, 4))); s.material.opacity = 0.85 * Math.pow(1 - u, 1.3);
    });
  } else if (I.is === 'hologram') {
    const v = out ? 1 - u : u;
    wire(v < 0.45 ? __trSm(v / 0.45) * (__trH(Math.floor(u * 30), 5) > 0.2 ? 1 : 0.3) : 1 - __trSm((v - 0.8) / 0.2));
    skin(__trSm((v - 0.45) / 0.45));
  } else if (I.is === 'scan') {
    const v = out ? 1 - u : u, lv = I.box.min.z + (h + 0.1) * v;
    I.plane.constant = lv; skin(1);
    for (const m of I.extra) { m.position.z = lv; m.material.opacity = (m === I.extra[0] ? 0.35 : 0.9) * Math.sin(Math.PI * Math.min(1, u * 1.05)); }
  } else if (I.is === 'transporter') {
    const v = out ? 1 - u : u;
    skin(__trSm((v - 0.55) / 0.4));
    I.sprs.forEach((s, i) => {
      const p = I.to[i], a = __trH(i, 6) * 6.283, k = __trSm(v / 0.7), far = 1.4 * (1 - k);
      s.visible = true; s.position.set(p.x + Math.cos(a) * far, p.y + Math.sin(a) * far, p.z + (__trH(i, 7) - 0.3) * 1.6 * (1 - k) + (out ? 1.2 * u : 0));
      s.scale.setScalar(0.12 + 0.1 * Math.sin(u * 40 + i)); s.material.opacity = Math.min(1, 1.6 * Math.sin(Math.PI * Math.min(1, u)));
    });
  } else if (I.is === 'galvatron') {
    if (out) {
      // the old form: skin to wire, then the wire goes, then its points flow into the new form
      skin(1 - __trSm(u / 0.25)); wire(__trSm(u / 0.2) * (1 - __trSm((u - 0.3) / 0.15)));
      if (!I.to && u > 0.25) { const B = window.__mojCtrl.bodies && window.__mojCtrl.bodies[I.into]; const ms = __trMeshes(B); I.to = ms.length ? __trPts(ms, 72, 9.1) : I.from; const zs = (a) => a.map((p, i) => [p.z, i]).sort((x, y) => x[0] - y[0]).map((x) => x[1]); I.pa = zs(I.from); I.pb = zs(I.to); }
      I.sprs.forEach((s, i) => {
        const k = I.to ? __trSm((u - 0.25) / 0.45) : 0, a = I.from[I.pa ? I.pa[i] : i], b = I.to ? I.to[I.pb[i]] : a;
        s.visible = u > 0.15 && u < 0.85; s.position.lerpVectors(a, b, k); s.position.z += 0.25 * Math.sin(Math.PI * k);
        s.scale.setScalar(0.09); s.material.opacity = Math.sin(Math.PI * Math.min(1, (u - 0.15) / 0.7));
      });
    } else { skin(__trSm((u - 0.7) / 0.25)); wire(__trSm((u - 0.5) / 0.2) * (1 - __trSm((u - 0.85) / 0.15))); }
  }
}
function __trDrop(I) {
  for (const s of I.sprs) { scene.remove(s); s.material.dispose(); }
  for (const l of I.wires) { if (l.parent) l.parent.remove(l); l.geometry.dispose(); l.material.dispose(); }
  for (const m of I.extra) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  if (I.ghost) { scene.remove(I.ghost.g); for (const m of I.ghost.mats) m.dispose(); }
  if (I.skin) I.skin.restore();
}
function __stepTransits() {
  const W = window.__mojCtrl && window.__mojCtrl.world; if (!W) return;
  const now = W.time || 0;
  for (const e of W.entities) {
    const T = e.transit; if (!T) continue;
    const key = e.id + '|' + T.t0;
    if (!__trLive[key] && now - T.t0 < (__TR_DUR[T.is] || 1.2)) __trLive[key] = __trMake(e, T, now);
  }
  for (const key in __trLive) {
    const I = __trLive[key], u = (now - I.t0) / I.dur;
    if (u >= 1) { __trDrop(I); delete __trLive[key]; continue; }
    if (I.meshes) __trStep(I, Math.max(0, u), W);
  }
}
`;

/** The transits a world's events play (spawn / vanish with, transfigure), in first-named order. */
export function transitKinds(events) {
  const out = [];
  for (const r of (events && events.reactions) || []) {
    if (!r || r.do !== 'ctrl') continue;
    const k = r.op === 'transfigure' ? r.with || 'galvatron' : (r.op === 'spawn' || r.op === 'vanish') && r.with ? r.with : null;
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

export function statusScript(looks, transits = []) {
  const L = looks || {}, all = Object.values(L);
  const shield = all.some((x) => x.shield), aura = all.some((x) => x.aura), band = all.some((x) => x.coat && x.coat.band);
  const has = (f) => all.some(f), drift = has((x) => x.drift && x.drift.length), surf = has((x) => (x.ice && x.ice.mode === 'spikes') || x.water || x.steam), encase = has((x) => x.ice && x.ice.mode === 'encase'), bolts = has((x) => x.bolts);
  return `
// STATUS: what the cast carries, drawn on their bodies in its look (coat, motes, bolts, ice, water, steam; fire is the fire channel's)
const __LOOK = ${safeJson(L)};
const __FCOL = ${safeJson(FIRE_COLORANTS)};
const __rgb = (c) => (Array.isArray(c) ? c : typeof c === 'string' && __FCOL[c] ? __FCOL[c] : typeof c === 'string' && c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) : [1, 1, 1]);
const __wave = ${wavePoints.toString()};${aura ? `
// an AURA: spirit onions and rings of spikes round the body (playscape/elements/aura.js)
const __elAU = ${AURA_SRC};` : ''}${drift ? `
const __elGlyph = ${GLYPHS_SRC};
const __spray = ${sprayPoints.toString()};
${SPRAY_SRC}` : ''}${bolts ? `
const __BOLT = ${safeJson(BOLT_SHAPE)};
const kokusenBolts = (() => { const TAU = 6.283185307179586, frac = (x) => x - Math.floor(x), h3 = (a, b, c) => frac(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453); return ${kokusenBolts.toString()}; })();` : ''}
const __elTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(0.6, 'rgba(255,255,255,0.13)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill(); return new THREE.CanvasTexture(cv); })();
${transits.length ? `${TRANSIT}
` : ''}const __elLive = {}, __elDying = {};   // '<who>|<is>' → what draws it; and what is fading out
${surf || encase ? `${SURF}` : ''}${encase ? `
${ENCASE}` : ''}
${shield ? `// a SHIELD: a half-sphere of hex cells (top-down on its cap, round its wall below), a fresnel rim, the shader noise
// shimmering across it, and a ripple running out from where a beam lands on it, the struck cells flaring white
const __elShFS = '#include <logdepthbuf_pars_fragment>\\nuniform float uT; uniform float uK; uniform float uCells; uniform vec3 uCol; uniform vec4 uRip[4]; varying vec3 vP; varying vec3 vN; varying vec3 vV;\\n' + ${JSON.stringify(NOISE_GLSL)} + \`
float hexD(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
vec4 hexCell(vec2 uv) { vec2 s = vec2(1.0, 1.7320508), h = s * 0.5; vec2 a = mod(uv, s) - h, b = mod(uv - h, s) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b; return vec4(g, uv - g); }
void main() {
#include <logdepthbuf_fragment>
  vec3 p = normalize(vP); float wt = smoothstep(0.5, 0.82, p.z);
  vec4 hT = hexCell(p.xy * uCells), hS = hexCell(vec2(atan(p.y, p.x) * uCells * 0.5, p.z * uCells));
  float e = mix(0.5 - hexD(hS.xy), 0.5 - hexD(hT.xy), wt); vec2 id = mix(hS.zw, hT.zw, wt);
  float edge = 1.0 - smoothstep(0.0, 0.07, e);
  float shim = 0.5 + 0.5 * nzN(p.xy * 3.5 + vec2(uT * 0.7, -uT * 0.4), 9), cell = max(nzN(id * 0.9 + vec2(uT * 0.8, 0.0), 5), 0.0);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
  float rip = 0.0, hot = 0.0;
  for (int i = 0; i < 4; i++) { if (uRip[i].w < 0.0) continue; float ang = acos(clamp(dot(p, normalize(uRip[i].xyz)), -1.0, 1.0)), t = uRip[i].w;
    rip += exp(-pow((ang - t * 2.4) * 6.0, 2.0)) * exp(-t * 2.0); hot += exp(-ang * 5.0) * exp(-t * 4.0); }
  float a = (edge * (0.3 + 0.6 * shim) + cell * 0.12 + fres * 0.7 + (rip + hot) * (0.5 + 1.2 * edge)) * uK;
  gl_FragColor = vec4(mix(uCol, vec3(1.0), clamp((rip + hot) * 0.7 + edge * 0.2, 0.0, 1.0)), clamp(a, 0.0, 1.0));
}\`;
function __elShield(S, base) {
  const g = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI / 2);
  const col = S.color != null ? __rgb(S.color) : base;
  const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uK: { value: 0 }, uCells: { value: S.cells }, uCol: { value: new THREE.Color(col[0], col[1], col[2]) }, uRip: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 1, -1)) } },
    // the page's logarithmic depth buffer: three's log-depth chunks, or the depth test puts the dome behind everything
    vertexShader: '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec3 vP; varying vec3 vN; varying vec3 vV; void main() { vP = position; vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv;\\n#include <logdepthbuf_vertex>\\n}',
    fragmentShader: __elShFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const d = new THREE.Mesh(g, m); d.scale.setScalar(S.r); d.raycast = function () {}; d.renderOrder = 15; d.frustumCulled = false; scene.add(d); return d;
}
function __elShieldStep(d, e, age, fade, show) {
  const W = window.__mojCtrl.world, now = W.time || 0, f = __elFoot(e), R = d.scale.x; d.visible = show && fade > 0.01; d.position.set(f[0], f[1], f[2] + 0.02);
  // the look opens with an overshoot (a spell snapping up), then holds
  const u = Math.min(1, age / 0.45), back = 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2; d.scale.setScalar(d.userData.r * Math.max(0.01, back));
  const U = d.material.uniforms; U.uT.value = age; U.uK.value = fade;
  let n = 0;
  for (const M of W.moments || []) {
    if (M.is !== 'beam' || M.hit == null || n >= 4) continue; const t = now - M.hit; if (t < 0 || t > 1.2) continue;
    if (Math.hypot(M.to[0] - f[0], M.to[1] - f[1]) > R + 1) continue;
    const v = U.uRip.value[n++]; v.set(M.from[0] - f[0], M.from[1] - f[1], Math.max(0.15, M.from[2] - f[2]), t);
  }
  for (let i = n; i < 4; i++) U.uRip.value[i].w = -1;
}
` : ''}function __elCoatMat(color, dark, p${band ? ', band' : ''}) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0], color[1], color[2]), transparent: true, depthWrite: false, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending });
  m.userData.uK = { value: 0 }; m.userData.__fire = true;   // its own light: the fire channel leaves it unlit
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimK = m.userData.uK; sh.uniforms.uRimP = { value: p }; sh.uniforms.uRimDark = { value: dark ? 1 : 0 };${band ? `
    sh.uniforms.uRimBand = { value: band || 0 };` : ''}
    sh.vertexShader = 'varying vec3 vRimN;\\nvarying vec3 vRimV;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\ntransformed += normal * 0.015;').replace('#include <project_vertex>', '#include <project_vertex>\\nvRimN = normalize(normalMatrix * normal);\\nvRimV = normalize(-mvPosition.xyz);');
    sh.fragmentShader = 'uniform float uRimK;\\nuniform float uRimP;\\nuniform float uRimDark;\\n${band ? 'uniform float uRimBand;\\n' : ''}varying vec3 vRimN;\\nvarying vec3 vRimV;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\\n${band ? `float rimF = pow(1.0 - abs(dot(normalize(vRimN), normalize(vRimV))), uRimP);\\nfloat rim = clamp((uRimBand > 0.0 ? step(uRimBand, rimF) : rimF) * uRimK, 0.0, 1.0);` : 'float rim = clamp(pow(1.0 - abs(dot(normalize(vRimN), normalize(vRimV))), uRimP) * uRimK, 0.0, 1.0);'}\\ngl_FragColor = uRimDark > 0.5 ? vec4(0.0, 0.0, 0.0, rim) : vec4(gl_FragColor.rgb * rim, 1.0);');
  };
  return m;
}
const __elSeed = (id) => { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973; return h / 97; };
function __elMake(e, is, st) {
  const K = __LOOK[is], base = st.color != null ? __rgb(st.color) : __rgb(K.color), body = window.__mojCtrl.bodies && window.__mojCtrl.bodies[e.id];
  const D = { coats: [], mat: null, waves: [], drifts: [], cloud: [], ribbon: null, glow: null, surf: [], encase: null, who: e.id, K, t0: st.t0, meshes: [] };
  const meshes = [];
  if (body) body.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.normal && !(o.userData && (o.userData.ink || o.userData.coat))) meshes.push(o); });
  D.meshes = meshes;
  if (K.coat) {
    D.mat = __elCoatMat(K.coat.color != null && st.color == null ? __rgb(K.coat.color) : base, !!K.coat.dark, K.coat.p${band ? ', K.coat.band' : ''});
    for (const o of meshes) { const c = new THREE.Mesh(o.geometry, D.mat); c.userData.coat = true; c.raycast = function () {}; c.renderOrder = 4; o.add(c); D.coats.push(c); }
  }
  // each wave's lights: a pool of sprites as large as its count × trail
  for (const W of K.motes) {
    const col = W.color != null && st.color == null ? __rgb(W.color) : base, n = __wave(W, [0, 0, 0], 0).length, sprs = [];
    for (let i = 0; i < n; i++) { const m = new THREE.SpriteMaterial({ map: __elTex, color: new THREE.Color(col[0], col[1], col[2]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); const s = new THREE.Sprite(m); s.visible = false; s.raycast = function () {}; scene.add(s); sprs.push(s); }
    D.waves.push({ W, sprs });
  }${drift ? `
  for (const S of K.drift) {
    D.drifts.push(__sprMake(S, S.color != null && st.color == null ? __rgb(S.color) : base, __elGlyph));
    // a spray that falls from a cloud: the cloud, a few soft greys over the head
    if (S.from === 'cloud') for (let i = 0; i < 8; i++) { const m = new THREE.SpriteMaterial({ map: __elGlyph.soft.tex, color: new THREE.Color(0.36 + 0.05 * (i % 3), 0.39 + 0.05 * (i % 3), 0.46 + 0.05 * (i % 3)), depthWrite: false, transparent: true }); m.userData.__fire = true; const c = new THREE.Sprite(m); c.visible = false; c.raycast = function () {}; scene.add(c); D.cloud.push({ c, S, i }); }
  }` : ''}${bolts ? `
  if (K.bolts) {
    // the bolts: a black stroke over a wider glow edge in the look's colour, quads per segment
    let segs = 0; for (const b of kokusenBolts([0, 0, 0], 0, __BOLT)) segs += b.nodes.length - 1;
    const gc = K.bolts.color != null && st.color == null ? __rgb(K.bolts.color) : base;
    const rib = (mat, order) => { mat.userData.__fire = true; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 18), 3)); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.raycast = function () {}; m.renderOrder = order; scene.add(m); return m; };
    D.glow = rib(new THREE.MeshBasicMaterial({ color: new THREE.Color(gc[0], gc[1], gc[2]), side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }), 4);
    // the stroke: black (kokusen's flash), or white-hot over the glow (lightning)
    D.ribbon = rib(K.bolts.bright ? new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }) : new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, transparent: true, depthWrite: false }), 5);
  }` : ''}${surf ? `
  if (meshes.length) {
    if (K.ice && K.ice.mode === 'spikes') D.surf.push(__elSurfMake({ kind: 'shards', count: K.ice.count, length: K.ice.length, width: K.ice.width }, meshes, base));
    if (K.water) D.surf.push(__elSurfMake({ kind: 'drips', count: K.water.count }, meshes, base));
    if (K.steam) D.surf.push(__elSurfMake({ kind: 'vapor', count: K.steam.count }, meshes, base));
  }` : ''}${encase ? `
  if (body && K.ice && K.ice.mode === 'encase') D.encase = __elEncase(body, __elSeed(e.id + is), base);` : ''}${shield ? `
  if (K.shield) { D.shield = __elShield(K.shield, base); D.shield.userData.r = K.shield.r; }` : ''}${aura ? `
  if (K.aura) D.aura = __elAU.make(K.aura, base);` : ''}
  return D;
}
function __elDrop(D) {
  for (const c of D.coats) if (c.parent) c.parent.remove(c);
  for (const w of D.waves) for (const s of w.sprs) { scene.remove(s); s.material.dispose(); }
  for (const r of [D.ribbon, D.glow]) if (r) { scene.remove(r); r.geometry.dispose(); r.material.dispose(); }${drift ? `
  D.drifts.forEach(__sprDrop); for (const q of D.cloud) { scene.remove(q.c); q.c.material.dispose(); }` : ''}${surf ? `
  for (const U of D.surf) __elSurfDrop(U);` : ''}${encase ? `
  if (D.encase) __elEncaseDrop(D.encase);` : ''}
  if (D.mat) D.mat.dispose();${aura ? `
  if (D.aura) __elAU.drop(D.aura);` : ''}${shield ? `
  if (D.shield) { scene.remove(D.shield); D.shield.geometry.dispose(); D.shield.material.dispose(); }` : ''}${surf ? `
  if (D.boil) __elSurfDrop(D.boil);` : ''}
}${bolts ? `
const __elA = new THREE.Vector3(), __elB = new THREE.Vector3(), __elD = new THREE.Vector3(), __elV = new THREE.Vector3(), __elS = new THREE.Vector3();
// one ribbon of strokes: each segment a quad facing the camera, as wide at each end as its node's thickness
function __elStroke(mesh, bolts, width) {
  const pos = mesh.geometry.attributes.position, a = pos.array; let i = 0;
  for (const b of bolts) for (let k = 1; k < b.nodes.length; k++) {
    __elA.fromArray(b.nodes[k - 1]); __elB.fromArray(b.nodes[k]);
    const wa = b.w > 0 ? width * b.t[k - 1] : 0, wb = b.w > 0 ? width * b.t[k] : 0;
    __elD.subVectors(__elB, __elA); __elV.subVectors(camera.position, __elA); __elS.crossVectors(__elD, __elV).normalize();
    const sa = [__elS.x * wa, __elS.y * wa, __elS.z * wa], sb = [__elS.x * wb, __elS.y * wb, __elS.z * wb];
    const q = [__elA.x - sa[0], __elA.y - sa[1], __elA.z - sa[2], __elA.x + sa[0], __elA.y + sa[1], __elA.z + sa[2], __elB.x + sb[0], __elB.y + sb[1], __elB.z + sb[2], __elB.x - sb[0], __elB.y - sb[1], __elB.z - sb[2]];
    for (const j of [0, 1, 2, 0, 2, 3]) { a[i++] = q[j * 3]; a[i++] = q[j * 3 + 1]; a[i++] = q[j * 3 + 2]; }
  }
  pos.needsUpdate = true;
}` : ''}
// the feet of a character: its eye above them, or half its height, else where it stands
function __elFoot(e) { const p = e.transform.pos, r = e.rule || {}, b = e.body || {}; return [p[0], p[1], p[2] - (Number.isFinite(r.eye) ? r.eye : Array.isArray(b.size) ? b.size[2] / 2 : Number.isFinite(b.radius) ? b.radius : 0)]; }
function __stepStatus() {
  const W = window.__mojCtrl && window.__mojCtrl.world; if (!W) return;
  const now = W.time || 0, seen = {};
  for (const e of W.entities) {
    if (!e.statuses) continue;
    for (const is in e.statuses) {
      const K = __LOOK[is]; if (!K) continue;
      const key = e.id + '|' + is, st = e.statuses[is]; seen[key] = 1;
      const D = __elLive[key] || (__elLive[key] = __elMake(e, is, st));
      const age = now - st.t0, show = !e.gone;
      const fade = Math.min(1, age / 0.15) * (st.until != null ? Math.min(1, Math.max(0, (st.until - now) / 0.25)) : 1);
      __elDraw(D, e, K, age, fade, show, 0);
    }
  }
  // a look that comes off fades out over 1.2 s: its layers dim, ice thaws into the ground, water boils off as steam
  for (const key in __elLive) if (!seen[key]) { const D = __elLive[key]; delete __elLive[key]; __elDying[key] = { D, t: now }; }
  for (const key in __elDying) {
    const X = __elDying[key], D = X.D, u = (now - X.t) / 1.2, e = W.byId[D.who];
    if (u >= 1 || !e) { __elDrop(D); delete __elDying[key]; continue; }
    __elDraw(D, e, D.K, now - D.t0, 1 - u, !e.gone, u);${surf ? `
    if (D.K.water && D.meshes.length) { if (!D.boil) D.boil = __elSurfMake({ kind: 'vapor', count: 22 }, D.meshes, [1, 1, 1]); __elSurfStep(D.boil, now - X.t + 0.6, Math.sin(Math.PI * Math.min(1, u * 1.1)), !e.gone, __elFoot(e)[2]); }` : ''}
  }${transits.length ? '\n  __stepTransits();' : ''}
}
function __elDraw(D, e, K, age, fade, show, melt) {${shield ? `
  if (D.shield) __elShieldStep(D.shield, e, age, fade, show);` : ''}
  const C = K.coat;
  if (C) {
    D.mat.userData.uK.value = C.k * fade * (C.shape === 'grow' ? Math.min(1, 0.25 + age / 2) * (C.hz ? 0.8 + 0.2 * Math.sin(age * C.hz * 6.283) : 1)
      : C.shape === 'flash' ? Math.exp(-age / 0.25)
      : C.shape === 'flicker' ? 0.65 + 0.35 * (((Math.floor(age * 8) * 7919) % 13) / 12)
      : C.shape === 'hold' ? 1
      : 0.7 + 0.3 * Math.sin(age * C.hz * 6.283));
    for (const c of D.coats) c.visible = show;
  }
  const cc = __elFoot(e);${aura ? `
  // the aura grows in over its first third of a second and goes with the look
  if (D.aura) __elAU.step(D.aura, cc, age, Math.min(1, Math.sqrt(age / 0.35)), show, fade);` : ''}
  for (const { W: wv, sprs } of D.waves) {
    const bs = __wave(wv, cc, age);
    for (let i = 0; i < sprs.length; i++) {
      const b = bs[i], s = sprs[i];
      if (!show || !b || b.w * fade < 0.04) { s.visible = false; continue; }
      s.visible = true; s.position.set(b.p[0], b.p[1], b.p[2]);
      // lights differ in size by their place in the wave
      const vary = 0.7 + 0.6 * (((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);
      const sz = wv.size * (wv.count * wv.trail > 1 ? vary : 1) * (0.35 + 0.65 * Math.min(1, b.w));
      s.scale.set(sz, sz, 1); s.material.opacity = Math.min(1, 0.3 + 0.7 * b.w) * fade;
    }
  }${drift ? `
  D.drifts.forEach((P) => __sprStep(P, __spray(P.S, cc, age, true), fade, show));
  for (const q of D.cloud) {
    // the cloud drifts a little about its place, its puffs breathing
    const a = q.i * 2.4, r = q.S.r * (0.25 + 0.6 * ((q.i * 0.37) % 1)), b = Math.sin(age * 0.8 + q.i);
    q.c.visible = show; q.c.position.set(cc[0] + r * Math.cos(a) + 0.05 * b, cc[1] + r * Math.sin(a), cc[2] + q.S.z[0] + 0.12 + 0.08 * Math.sin(q.i * 1.7));
    q.c.scale.setScalar(0.55 + 0.25 * ((q.i * 0.61) % 1) + 0.04 * b); q.c.material.opacity = 0.92 * fade;
  }` : ''}${bolts ? `
  if (D.ribbon) {
    // lightning: a thin white-hot core in a wide glow; kokusen: the black stroke over a narrow one
    const hot = !!K.bolts.bright;
    D.ribbon.visible = D.glow.visible = show; D.ribbon.material.opacity = fade; D.glow.material.opacity = (hot ? 0.4 : 0.55) * fade;
    if (show) { const bolts = kokusenBolts(cc, age, __BOLT); __elStroke(D.ribbon, bolts, K.bolts.width * (hot ? 0.5 : 1)); __elStroke(D.glow, bolts, K.bolts.width * (hot ? 2.2 : 2.6)); }
  }` : ''}${surf ? `
  for (const U of D.surf) __elSurfStep(U, age, fade, show, cc[2]);` : ''}${encase ? `
  if (D.encase) __elEncaseStep(D.encase, age, fade, show, melt);` : ''}
}
if (/[?&]values\\b/.test(location.search)) renderer.domElement.style.filter = 'grayscale(1)';
window.__mojStatus = { live: () => Object.keys(__elLive) };`;
}
