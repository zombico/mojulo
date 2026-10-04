import { b64, safeJson } from '../emit-util.js';
import { WS_CAP } from '../../materials/shore-moisture.js';
import { buildSandBed, WET_DAMP } from '../../materials/soft-ground.js';
import { wetSandHelpers } from './wet-sand.js';

// In-page script: soft ground you leave footprints in (the touch tier). The bed (materials/soft-ground.js, inlined by
// toString — the page runs the code Node tests) lives in a window around the player that slides by whole cells as they
// walk; the static sand steps aside inside it (a discard hole in its wet-sand patch). The window's surface IS the
// static surface where nothing has been touched: its base is the coarse sand triangulation (each quad fanned from its
// first corner, as the page draws faces) minus the bed depth, and its colour is the quad's own baked shade times the
// relief's — so the seam is invisible until a foot lands.
//
// Moisture comes from the swash (shore-moisture): each row's wetness is the sand's dampness (0 … WET_DAMP), and rows the
// backwash is running over are fluid (255) — their prints relax away. Footprints come from the walk camera: a plant
// every half stride, alternating sides, sink by the wetness underfoot, the rim pushed the way you walk.
export function softGroundScript(sg) {
  const cfg = {
    cols: sg.cols, rows: sg.rows, cell: sg.cell, quantum: sg.quantum, depth: sg.depth, moisture: sg.moisture, viscosity: sg.viscosity || 1,
    sink: sg.sink, stride: sg.stride, foot: sg.foot, color: sg.color, sun: sg.sun, swash: sg.swash,
    surf: { x0: sg.surface.x0, y0: sg.surface.y0, x1: sg.surface.x1, y1: sg.surface.y1, sx: sg.surface.sx, sy: sg.surface.sy, z: b64(new Float32Array(sg.surface.z)) },
  };
  return `${wetSandHelpers({ edgeY: sg.swash.edgeY, swashRange: sg.swash.swashRange, omSwash: sg.swash.omSwash, zen: sg.zen, hor: sg.hor, sun: sg.sun })}
// --- soft ground (a footprint bed in a window around the player) ---
let stepSoftGround = () => {};
{
  const SG = ${safeJson(cfg)}, WET_DAMP = ${WET_DAMP};
  const buildSandBed = ${buildSandBed.toString()};
  const F = SG.surf, Z = decodeF32(F.z), QX = (F.x1 - F.x0) / F.sx, QY = (F.y1 - F.y0) / F.sy;
  const SUN = new THREE.Vector3(SG.sun[0], SG.sun[1], SG.sun[2]).normalize();
  const zc = (i, j) => Z[j * (F.sx + 1) + i];
  function quad(x, y) {
    const fi = Math.min(F.sx - 1e-6, Math.max(0, (x - F.x0) / QX)), fj = Math.min(F.sy - 1e-6, Math.max(0, (y - F.y0) / QY));
    const i = Math.floor(fi), j = Math.floor(fj);
    return { i, j, u: fi - i, v: fj - j };
  }
  // the static surface: each quad (p00, p10, p11, p01) is the fan (p00 p10 p11) + (p00 p11 p01)
  function surfZ(x, y) {
    const { i, j, u, v } = quad(x, y), a = zc(i, j), b = zc(i + 1, j), c = zc(i + 1, j + 1), d = zc(i, j + 1);
    return u >= v ? a + u * (b - a) + v * (c - b) : a + v * (d - a) + u * (c - d);
  }
  // the quad's baked Lambert shade (beach-view buildSand: one normal per quad, cross(p10 − p00, p01 − p00))
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const shadeOf = (nx, ny, nz) => 0.34 + 0.66 * Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z);
  function quadShade(x, y) {
    const { i, j } = quad(x, y), z00 = zc(i, j);
    const ax = QX, az = zc(i + 1, j) - z00, by = QY, bz = zc(i, j + 1) - z00;
    const nx = -az * by, ny = -ax * bz, nz = ax * by, l = Math.hypot(nx, ny, nz) || 1;
    return [shadeOf(nx / l, ny / l, nz / l), nx / l, ny / l, nz / l];
  }
  const C = SG.cols, R = SG.rows, N = C * R, cell = SG.cell, q = SG.quantum;
  let bed = null, geo = null, pos, col, mesh, rowW = new Int16Array(R).fill(-1);
  const baseAt = (x, y) => surfZ(x, y) - SG.depth;
  // slide the window (whole cells) so (x, y) is its centre
  function recentre(x, y) {
    const o = bed.origin, cx = o[0] + (C - 1) * cell / 2, cy = o[1] + (R - 1) * cell / 2;
    bed.shift(Math.round((x - cx) / cell), Math.round((y - cy) / cell), baseAt); rowW.fill(-1); holeFromBed();
  }
  function holeFromBed() {
    const o = bed.origin, m = 2 * cell;
    __wsShared.uWsHole.value.set(o[0] + m, o[1] + m, o[0] + (C - 1) * cell - m, o[1] + (R - 1) * cell - m);
  }
  function make(cx, cy) {
    const origin = [Math.round((cx - (C - 1) * cell / 2) / cell) * cell, Math.round((cy - (R - 1) * cell / 2) / cell) * cell];
    const base = new Float64Array(N);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) base[r * C + c] = baseAt(origin[0] + c * cell, origin[1] + r * cell);
    bed = buildSandBed({ cols: C, rows: R, cell, quantum: q, origin, base, depth: SG.depth, ...SG.moisture.dry, viscosity: SG.viscosity, moisture: SG.moisture, relief: true });
    pos = new Float32Array(N * 3); col = new Float32Array(N * 3);
    const idx = new Uint32Array((C - 1) * (R - 1) * 6);
    let k = 0;
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) { const a = r * C + c; idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + C + 1; idx[k++] = a; idx[k++] = a + C + 1; idx[k++] = a + C; }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    __wsPatch(mat, { baked: false });
    mesh = new THREE.Mesh(geo, mat); mesh.raycast = () => {};   // walkers keep standing on the static sand
    scene.add(mesh);
    rowW.fill(-1); refresh([0, 0, C - 1, R - 1]); holeFromBed();
  }
  // rewrite the rows [r0, r1] (a dirty rect grown by one for the normals): heights, and colour = the quad's baked dry
  // shade × the relief's own (shade of the fine normal over the quad's), a touch darker where a foot churned it
  function refresh(d) {
    const r0 = Math.max(0, d[1] - 1), r1 = Math.min(R - 1, d[3] + 1), c0 = Math.max(0, d[0] - 1), c1 = Math.min(C - 1, d[2] + 1);
    const o = bed.origin, bf = bed.baseF, s = bed.sand, p = bed.packed, dist = bed.disturbed;
    const top = (i) => bf[i] + (s[i] + p[i]) * q;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * C + c, x = o[0] + c * cell, y = o[1] + r * cell, z = top(i);
      pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z;
      const zl = top(c > 0 ? i - 1 : i), zr = top(c < C - 1 ? i + 1 : i), zd = top(r > 0 ? i - C : i), zu = top(r < R - 1 ? i + C : i);
      const gx = (zr - zl) / ((c > 0 && c < C - 1 ? 2 : 1) * cell), gy = (zu - zd) / ((r > 0 && r < R - 1 ? 2 : 1) * cell), l = Math.hypot(gx, gy, 1);
      const [qs, qnx, qny, qnz] = quadShade(x, y);
      // the relief: the fine surface's shade against the quad's own (1 on untouched sand, which lies in the quad)
      const fx = -gx / l, fy = -gy / l, fz = 1 / l;
      const rel = Math.max(0.55, Math.min(1.5, shadeOf(fx, fy, fz) / Math.max(0.2, shadeOf(qnx, qny, qnz))));
      const k = qs * rel * (dist[i] ? 0.94 : 1);
      // sRGB like a face fill, decoded to linear the way the page decodes every face colour (faceColorLinear)
      col[3 * i] = lin(SG.color[0] * k); col[3 * i + 1] = lin(SG.color[1] * k); col[3 * i + 2] = lin(SG.color[2] * k);
    }
    const pa = geo.attributes.position, ca = geo.attributes.color;
    if (pa.addUpdateRange) { pa.clearUpdateRanges(); ca.clearUpdateRanges(); pa.addUpdateRange(r0 * C * 3, (r1 - r0 + 1) * C * 3); ca.addUpdateRange(r0 * C * 3, (r1 - r0 + 1) * C * 3); }
    pa.needsUpdate = true; ca.needsUpdate = true;
  }
  // wetness per row from the swash: 255 where the backwash is running (fluid), else the sand's dampness
  const W = SG.swash, TAU = Math.PI * 2;
  function dryTime(y, t) {
    const a = 1 - (2 * (W.edgeY - y)) / W.swashRange;
    if (a <= -1) return 0; if (a >= 1) return 1e4;
    const ph = W.omSwash * t; if (Math.sin(ph) > a) return 0;
    const d = ph - (Math.PI - Math.asin(a)); return (d - TAU * Math.floor(d / TAU)) / W.omSwash;
  }
  function wetRows(t) {
    const o = bed.origin;
    for (let r = 0; r < R; r++) {
      const y = o[1] + r * cell, dt = dryTime(y, t);
      const cap = y > W.edgeY ? ${WS_CAP} * Math.exp(-(y - W.edgeY) / (W.swashRange * 0.5)) : ${WS_CAP};
      const w = dt < 0.4 ? 255 : Math.round(Math.max(Math.exp(-dt / 40), cap) * WET_DAMP);
      if ((rowW[r] >> 4) !== (w >> 4)) { for (let c = 0; c < C; c++) bed.setMoisture(r * C + c, w); }
      rowW[r] = w;
    }
  }
  let acc = 0, last = null, walked = 0, side = 1, prev = null;
  stepSoftGround = (t) => {
    const dt = last == null ? 0 : Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
    // the bed starts with the first walk; once there it keeps settling and drawing (prints stay when you stop walking)
    const on = typeof walkOn !== 'undefined' && walkOn && walkMode === 'walk';
    if (!on) prev = null;
    if (!bed && !on) return;
    const p = camera.position, feet = [p.x, p.y];
    if (!bed) make(feet[0], feet[1]);
    if (on) walkStep(t, dt, p, feet);
    wetRows(t / 1000);
    acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 4) { acc -= 1 / 60; n++; bed.step(); }
    const d = bed.takeDirty(); if (d) refresh(d);
  };
  function walkStep(t, dt, p, feet) {
    // slide the window when the walker passes a quarter of its span from its centre
    const o = bed.origin, cx = o[0] + (C - 1) * cell / 2, cy = o[1] + (R - 1) * cell / 2;
    if (Math.abs(feet[0] - cx) > C * cell / 4 || Math.abs(feet[1] - cy) > R * cell / 4) recentre(feet[0], feet[1]);
    // plant a foot every half stride: alternate sides of the path, heading = where you walk, rim pushed that way
    if (prev) {
      const dx = feet[0] - prev[0], dy = feet[1] - prev[1], d = Math.hypot(dx, dy);
      walked += d;
      if (walked >= SG.stride && d > 0) {
        walked = 0; side = -side;
        const ux = dx / d, uy = dy / d, h = Math.atan2(uy, ux), x = feet[0] - uy * SG.foot.offset * side, y = feet[1] + ux * SG.foot.offset * side;
        const r = Math.round((y - bed.origin[1]) / cell), w = rowW[Math.max(0, Math.min(R - 1, r))];
        const sink = w > 230 ? SG.sink.fluid : w > WET_DAMP * 0.6 ? SG.sink.damp : SG.sink.dry, spd = dt > 0 ? d / dt : 0;
        if (p.z - walkEye < surfZ(x, y) + SG.foot.length) bed.press({ x, y, heading: h, length: SG.foot.length, width: SG.foot.width, sink, rim: SG.foot.rim, push: [ux * Math.min(2, spd / SG.stride), uy * Math.min(2, spd / SG.stride)] });
      }
    }
    prev = feet;
  }
  // for probes and scripts: the bed (null until the first walk), the static surface, and a way to move the window
  window.__mojGround = { get bed() { return bed; }, surfZ, recentre: (x, y) => (bed ? recentre(x, y) : make(x, y)) };
}`;
}
