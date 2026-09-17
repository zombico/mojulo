import { safeJson } from '../emit-util.js';

// In-page script: TOON INK (opt-in manifest `toon.ink`) — silhouette + crease outlines over the
// baked-unlit fills: the World half of the toon dial (the bands are baked INTO the fills upstream
// by vexar, so they need no channel). Two draws per eligible group, both built from the `ink`
// buffers the emitter packs beside the group (the group's non-studio, opaque faces, with the
// authored per-vertex outward normals):
//   • an INVERTED HULL — the same triangles, BackSide, ink-coloured, every vertex pushed along a
//     WELDED outward normal by `width` IN THE VERTEX SHADER (a uniform, so the width is live).
//     Welding (the packed normals summed per position, keyed on a quantum scaled to the geometry —
//     the emitter's global decollide nudges neighbouring faces apart by ~1e-3, so exact keys never
//     meet) keeps the shell continuous across the soup; each triangle's winding is rewritten to
//     AGREE with that normal, so an open plane (a ground quad) pushes away from the side it is
//     looked at from and never paints over itself, and a closed solid's shell shows only past its
//     silhouette.
//   • CREASE LINES — every edge whose two triangles meet at more than `crease` degrees (a
//     cap-to-wall rim, a box edge), plus open boundaries. Computed HERE over the winding-fixed
//     triangles, not with EdgesGeometry: three's edge test reads each triangle's winding, and the
//     baked lathes do not keep winding consistent, so it inked every quad. Degenerate twins (a cap
//     quad's repeated centre corner) are skipped. The group's fill takes a polygon offset so the
//     lines win the depth test.
// LIVE INK (toon-shading Phase 4): every group owns its own hull + line materials and registers
// under its group name in `window.__mojInk` — `tint(name, '#hex')`, `width(name, k)`,
// `reset(name)`, `set(on)`; hull/line meshes carry `userData.ink = true` so any traversal (the
// fx channel's per-entity tint/flash) finds them. `__inkBuild` / `__inkGeoNormals` /
// `__inkCentroid` are the shared builders the controllable rig builder probes (typeof-guarded) to
// ink a posed figure's parts — rig parts carry no authored normals, so the geometric fallback
// orients each triangle AWAY from the part's centroid, which convex armour plates and limb
// segments satisfy.
// One-shot setup block (glow/specular posture): a world without `toon.ink` emits ZERO bytes.
export function toonInkScript(cfg) {
  return `
// --- toon ink (opt-in 'toon.ink'): inverted-hull silhouettes + crease lines ---
const __INK = ${safeJson(cfg)};
const __inkKey = (pos, i, q) => Math.round(pos[i] / q) + ',' + Math.round(pos[i + 1] / q) + ',' + Math.round(pos[i + 2] / q);
const __inkCentroid = (pos) => { let x = 0, y = 0, z = 0; const n = pos.length / 3 || 1; for (let i = 0; i < pos.length; i += 3) { x += pos[i]; y += pos[i + 1]; z += pos[i + 2]; } return [x / n, y / n, z / n]; };
const __inkGeoNormals = (pos, center) => {   // winding-derived flat normals; with \`center\`, oriented away from it
  const out = new Float32Array(pos.length);
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t + 3] - pos[t], ay = pos[t + 4] - pos[t + 1], az = pos[t + 5] - pos[t + 2];
    const bx = pos[t + 6] - pos[t], by = pos[t + 7] - pos[t + 1], bz = pos[t + 8] - pos[t + 2];
    let gx = ay * bz - az * by, gy = az * bx - ax * bz, gz = ax * by - ay * bx;
    const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
    if (center) {
      const cx = (pos[t] + pos[t + 3] + pos[t + 6]) / 3 - center[0], cy = (pos[t + 1] + pos[t + 4] + pos[t + 7]) / 3 - center[1], cz = (pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3 - center[2];
      if (gx * cx + gy * cy + gz * cz < 0) { gx = -gx; gy = -gy; gz = -gz; }
    }
    for (let k = 0; k < 9; k += 3) { out[t + k] = gx; out[t + k + 1] = gy; out[t + k + 2] = gz; }
  }
  return out;
};
const __inkWeld = (pos, nrm, q) => {   // welded outward normal per vertex (sum over the same quantized position)
  const acc = new Map(), n = pos.length / 3, out = new Float32Array(pos.length);
  const key = (i) => __inkKey(pos, i * 3, q);
  for (let i = 0; i < n; i++) {
    const k = key(i); let a = acc.get(k); if (!a) { a = [0, 0, 0]; acc.set(k, a); }
    a[0] += nrm[i * 3]; a[1] += nrm[i * 3 + 1]; a[2] += nrm[i * 3 + 2];
  }
  for (let i = 0; i < n; i++) {
    const a = acc.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  return out;
};
const __inkHull = (pos, nrm, creaseDeg, q) => {   // → { hull, lines } geometries (hull carries welded normals, unpushed)
  const p = new Float32Array(pos.length), pn = new Float32Array(pos.length), wn = __inkWeld(pos, nrm, q);
  const cosCrease = Math.cos(creaseDeg * Math.PI / 180), edges = new Map(), segs = [];
  const pk = (i) => __inkKey(pos, i, q);
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t + 3] - pos[t], ay = pos[t + 4] - pos[t + 1], az = pos[t + 5] - pos[t + 2];
    const bx = pos[t + 6] - pos[t], by = pos[t + 7] - pos[t + 1], bz = pos[t + 8] - pos[t + 2];
    let gx = ay * bz - az * by, gy = az * bx - ax * bz, gz = ax * by - ay * bx;
    const gl = Math.hypot(gx, gy, gz);
    if (gl < q * q) continue;   // degenerate (a cap quad's repeated centre corner): no hull, no edges
    gx /= gl; gy /= gl; gz /= gl;
    const d = gx * (wn[t] + wn[t + 3] + wn[t + 6]) + gy * (wn[t + 1] + wn[t + 4] + wn[t + 7]) + gz * (wn[t + 2] + wn[t + 5] + wn[t + 8]);
    if (d < 0) { gx = -gx; gy = -gy; gz = -gz; }          // the OUTWARD geometric normal, whatever the winding
    const order = d < 0 ? [0, 6, 3] : [0, 3, 6];           // hull winding made to agree with it
    for (let k = 0; k < 3; k++) { const s = t + order[k], o = t + k * 3; for (let c = 0; c < 3; c++) { p[o + c] = pos[s + c]; pn[o + c] = wn[s + c]; } }
    // crease census: each edge keyed by its two welded positions, normal of the first face kept
    for (let k = 0; k < 3; k++) {
      const a = t + k * 3, b = t + ((k + 1) % 3) * 3, ka = pk(a), kb = pk(b), key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      const seen = edges.get(key);
      if (!seen) { edges.set(key, { a, b, n: [gx, gy, gz], count: 1 }); continue; }
      seen.count++;
      if (seen.count === 2 && seen.n[0] * gx + seen.n[1] * gy + seen.n[2] * gz < cosCrease) segs.push(seen.a, seen.b);
    }
  }
  for (const e of edges.values()) if (e.count === 1) segs.push(e.a, e.b);   // open boundary → contour
  const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.BufferAttribute(p, 3)); hull.setAttribute('normal', new THREE.BufferAttribute(pn, 3)); hull.computeBoundingSphere();
  const lp = new Float32Array(segs.length * 3);
  for (let i = 0; i < segs.length; i++) { lp[i * 3] = pos[segs[i]]; lp[i * 3 + 1] = pos[segs[i] + 1]; lp[i * 3 + 2] = pos[segs[i] + 2]; }
  const lines = new THREE.BufferGeometry(); lines.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  return { hull, lines };
};
// one ink pair for one geometry: its OWN materials (live tint/width per owner), the hull pushed
// along the welded normal by the uInk uniform in the vertex shader. Unattached — the caller parents it.
const __inkBuild = (pos, nrm, width, creaseDeg, q, color) => {
  const built = __inkHull(pos, nrm, creaseDeg, q);
  const hullMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.BackSide });
  hullMat.userData.uInk = { value: width };
  hullMat.onBeforeCompile = (sh) => {
    sh.uniforms.uInk = hullMat.userData.uInk;
    sh.vertexShader = 'uniform float uInk;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\ntransformed += normal * uInk;');
  };
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
  const hull = new THREE.Mesh(built.hull, hullMat); hull.renderOrder = -1;
  const lines = new THREE.LineSegments(built.lines, lineMat); lines.renderOrder = 2;
  for (const o of [hull, lines]) { o.userData.ink = true; o.raycast = function () {}; o.frustumCulled = false; }
  return { hull, lines, hullMat, lineMat, base: new THREE.Color(color), width };
};
const __inkReg = {};   // group name → the entry __inkBuild returned (+ scene-attached)
{
  const inkGeos = [];
  let r = 0;
  for (const grp of GROUPS) {
    if (!grp.ink) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(decodeF32(grp.ink.pos), 3));
    g.computeBoundingSphere();
    r = Math.max(r, g.boundingSphere.radius);
    inkGeos.push([grp, g]);
  }
  const width = __INK.widthAbs != null ? __INK.widthAbs : __INK.width * (r || 1);
  const q = Math.max((r || 1) * 1.5e-3, 1e-6);   // weld quantum: above the decollide nudge, far below any feature
  for (const [grp, g] of inkGeos) {
    const pos = g.getAttribute('position').array;
    const nrm = grp.ink.nrm ? decodeF32(grp.ink.nrm) : __inkGeoNormals(pos, __inkCentroid(pos));
    const e = __inkBuild(pos, nrm, width, __INK.crease, q, __INK.color);
    scene.add(e.hull); scene.add(e.lines); __inkReg[grp.name] = e;
    const m = meshes[grp.name];
    if (m) { m.material.polygonOffset = true; m.material.polygonOffsetFactor = 1; m.material.polygonOffsetUnits = 1; m.material.needsUpdate = true; }
  }
}
window.__mojInk = {
  reg: __inkReg, build: __inkBuild, geoNormals: __inkGeoNormals, centroid: __inkCentroid,
  tint(name, color) { const e = __inkReg[name]; if (!e) return false; e.hullMat.color.set(color); e.lineMat.color.set(color); return true; },
  width(name, k) { const e = __inkReg[name]; if (!e) return false; e.hullMat.userData.uInk.value = e.width * k; return true; },
  reset(name) { const names = name ? [name] : Object.keys(__inkReg); for (const n of names) { const e = __inkReg[n]; if (!e) continue; e.hullMat.color.copy(e.base); e.lineMat.color.copy(e.base); e.hullMat.userData.uInk.value = e.width; } },
  set(on) { for (const n in __inkReg) { __inkReg[n].hull.visible = !!on; __inkReg[n].lines.visible = !!on; } },
};`;
}
