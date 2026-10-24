import { safeJson } from '../emit-util.js';
import { buildSandBed } from '../../materials/soft-ground.js';

// In-page script: SNOW you leave footprints in (era/snow.js, a stage's `snowPrints`). The bed is the beach's
// (materials/soft-ground.js, inlined by toString — the page runs the code Node tests) on its fresh-snow ground, in a
// window round the walker that slides by whole cells as they go; each foot packs the powder under it and pushes a rim.
// Only what a foot has touched is drawn: the untouched bed lies on the static snow and is left out, so no window shows;
// a touched column is drawn a few centimetres nearer the eye along its own ray (the same pixel, a nearer depth), so a
// print's floor shows through the static snow it was pressed below. Its colour: the snow's lit or shaded colour where
// the sun reaches the ground or not, turned toward the shaded one as the print's own slope turns from the sun, a touch
// darker where packed. Prints only on the stage's snow (its mask), never on the walked trail.
export function snowPrintsScript(sp) {
  const cfg = {
    cols: sp.cols, rows: sp.rows, cell: sp.cell, quantum: sp.quantum, depth: sp.depth, ground: sp.ground, sink: sp.sink, stride: sp.stride,
    foot: sp.foot, lit: sp.lit, shade: sp.shade, sun: sp.sun, pull: sp.pull, grid: sp.grid,
  };
  return `
// --- snow prints (a footprint bed in a window round the walker, on the stage's snow) ---
let stepSnowPrints = () => {};
{
  const SP = ${safeJson(cfg)};
  const buildSandBed = ${buildSandBed.toString()};
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  const G = SP.grid, GZ = dec(G.z), GM = dec(G.m), GX = G.nx, GY = G.ny, GC = G.cell;
  // the static ground (the landform grid's nodes, read between them bilinearly) and its cell's mask: bit 0 snow, bit 1 sun
  function zAt(x, y) {
    const u = Math.max(0, Math.min(GX - 1.001, (x - G.x0) / GC)), v = Math.max(0, Math.min(GY - 1.001, (y - G.y0) / GC)), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const a = GZ[j * GX + i] + (GZ[j * GX + i + 1] - GZ[j * GX + i]) * fu, b = GZ[(j + 1) * GX + i] + (GZ[(j + 1) * GX + i + 1] - GZ[(j + 1) * GX + i]) * fu;
    return a + (b - a) * fv;
  }
  function maskAt(x, y) {
    const i = Math.floor((x - G.x0) / GC), j = Math.floor((y - G.y0) / GC);
    return i < 0 || j < 0 || i >= GX - 1 || j >= GY - 1 ? 0 : GM[j * (GX - 1) + i];
  }
  const SUN = new THREE.Vector3(SP.sun[0], SP.sun[1], SP.sun[2]).normalize(), FLAT = Math.max(0.2, SUN.z);
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const C = SP.cols, R = SP.rows, N = C * R, cell = SP.cell, q = SP.quantum, Gd = SP.ground, baseAt = (x, y) => zAt(x, y) - SP.depth;
  let bed = null, geo = null, pos, col, mesh, idx;
  function make(cx, cy) {
    const origin = [Math.round((cx - (C - 1) * cell / 2) / cell) * cell, Math.round((cy - (R - 1) * cell / 2) / cell) * cell];
    // (its loose snow, its depth, over the ground sunk by as much, so its top is the static snow's; a foot lands only on snow)
    const base = new Float64Array(N);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) base[r * C + c] = baseAt(origin[0] + c * cell, origin[1] + r * cell);
    bed = buildSandBed({ cols: C, rows: R, cell, quantum: q, origin, base, depth: SP.depth, friction: Gd.friction, staticFriction: Gd.staticFriction, cohesion: Gd.cohesion, compaction: Gd.compaction, spill: Gd.spill, viscosity: Gd.viscosity, relief: true });
    pos = new Float32Array(N * 3); col = new Float32Array(N * 3); idx = new Uint32Array((C - 1) * (R - 1) * 6);
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    // (nearer the eye along its own ray by SP.pull: the same pixel, a nearer depth)
    mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\nmvPosition.xyz *= max(0.0, 1.0 - ' + SP.pull.toFixed(4) + ' / max(length(mvPosition.xyz), 0.001));\\ngl_Position = projectionMatrix * mvPosition;'); };
    mat.customProgramCacheKey = () => 'snowPrints';
    mesh = new THREE.Mesh(geo, mat); mesh.raycast = () => {}; mesh.frustumCulled = false;
    scene.add(mesh);
    refresh([0, 0, C - 1, R - 1]);
  }
  function recentre(x, y) {
    const o = bed.origin, cx = o[0] + (C - 1) * cell / 2, cy = o[1] + (R - 1) * cell / 2;
    bed.shift(Math.round((x - cx) / cell), Math.round((y - cy) / cell), baseAt);
    refresh([0, 0, C - 1, R - 1]);
  }
  // rewrite the rect's heights and colours, then the quads drawn: those with a touched corner
  function refresh(d) {
    const r0 = Math.max(0, d[1] - 1), r1 = Math.min(R - 1, d[3] + 1), c0 = Math.max(0, d[0] - 1), c1 = Math.min(C - 1, d[2] + 1);
    const o = bed.origin, bf = bed.baseF, s = bed.sand, p = bed.packed, dist = bed.disturbed;
    const top = (i) => bf[i] + (s[i] + p[i]) * q;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * C + c, x = o[0] + c * cell, y = o[1] + r * cell;
      pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = top(i);
      const zl = top(c > 0 ? i - 1 : i), zr = top(c < C - 1 ? i + 1 : i), zd = top(r > 0 ? i - C : i), zu = top(r < R - 1 ? i + C : i);
      const gx = (zr - zl) / ((c > 0 && c < C - 1 ? 2 : 1) * cell), gy = (zu - zd) / ((r > 0 && r < R - 1 ? 2 : 1) * cell), l = Math.hypot(gx, gy, 1);
      const k = Math.max(0, Math.min(1, (-gx * SUN.x - gy * SUN.y + SUN.z) / l / FLAT)), sunny = maskAt(x, y) & 2 ? k : 0, packed = p[i] ? 0.93 : 1;
      for (let j = 0; j < 3; j++) col[3 * i + j] = lin((SP.shade[j] + (SP.lit[j] - SP.shade[j]) * sunny) * packed);
    }
    let n = 0;
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const a = r * C + c;
      if (dist[a] || dist[a + 1] || dist[a + C] || dist[a + C + 1]) { idx[n++] = a; idx[n++] = a + 1; idx[n++] = a + C + 1; idx[n++] = a; idx[n++] = a + C + 1; idx[n++] = a + C; }
    }
    geo.setDrawRange(0, n); geo.index.needsUpdate = true;
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  let acc = 0, last = null, walked = 0, side = 1, prev = null;
  stepSnowPrints = (t) => {
    const dt = last == null ? 0 : Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
    // the bed starts with the first walk; once there it keeps settling and drawing (prints stay when you stop)
    const on = typeof walkOn !== 'undefined' && walkOn && walkMode === 'walk';
    if (!on) prev = null;
    if (!bed && !on) return;
    const p = camera.position, feet = [p.x, p.y];
    if (!bed) make(feet[0], feet[1]);
    if (on) walkStep(dt, p, feet);
    acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 4) { acc -= 1 / 60; n++; bed.step(); }
    const d = bed.takeDirty(); if (d) refresh(d);
  };
  function walkStep(dt, p, feet) {
    const o = bed.origin, cx = o[0] + (C - 1) * cell / 2, cy = o[1] + (R - 1) * cell / 2;
    if (Math.abs(feet[0] - cx) > C * cell / 4 || Math.abs(feet[1] - cy) > R * cell / 4) recentre(feet[0], feet[1]);
    // a foot every half stride: alternate sides of the path, heading where you walk, the rim pushed that way
    if (prev) {
      const dx = feet[0] - prev[0], dy = feet[1] - prev[1], d = Math.hypot(dx, dy);
      walked += d;
      if (walked >= SP.stride && d > 0) {
        walked = 0; side = -side;
        const ux = dx / d, uy = dy / d, h = Math.atan2(uy, ux), x = feet[0] - uy * SP.foot.offset * side, y = feet[1] + ux * SP.foot.offset * side, spd = dt > 0 ? d / dt : 0;
        if (maskAt(x, y) & 1) bed.press({ x, y, heading: h, length: SP.foot.length, width: SP.foot.width, sink: SP.sink, rim: SP.foot.rim, push: [ux * Math.min(2, spd / SP.stride), uy * Math.min(2, spd / SP.stride)] });
      }
    }
    prev = feet;
  }
  // for probes and scripts: the bed (null until the first walk), the ground, a way to place it and press a foot (only
  // on the snow, as a walker's)
  window.__mojSnow = { get bed() { return bed; }, zAt, maskAt, place: (x, y) => { if (bed) recentre(x, y); else make(x, y); }, press: (f) => { if (!(maskAt(f.x, f.y) & 1)) return false; bed.press(f); const d = bed.takeDirty(); if (d) refresh(d); return true; } };
}`;
}
