import { kelvinField } from '../../../craft-shelf/kelvin.js';
import { aquaPatchScript } from '../aqua-glsl.js';

// In-page script: THE WATER UNDER A DRIVEN BOAT (the controllable channel emits it only when its world has a boat rule:
// worlds/controllable/rules-boat.js; its numbers the pilot's turret range's `sea`, gameworld/combat/boats.js). The
// seaway channel's water (channels/seaway.js) for a boat that is driven rather than run round a course:
//   the sheet    one grid about the boat, its cells fine near it and widening to the horizon (so the sea runs out to
//                the shore and the range's edges on one sheet), lit and shaded as water (channels/aqua-glsl.js); under the
//                land past the shore it sinks out of sight
//   the swell    the rule's own trains (the boat rides the same water: rules-boat.js reads them on its clock, sailT)
//   the wake     the boat's Kelvin field at its speed now (its wake's numbers at the rung of its speeds under it:
//                craft-shelf/boat-drive.js), laid behind its bow along its heading
//   its foam     near the hull, the bow wave, the edges and the stern's white water as the seaway draws them; down its
//                track, a trail of white water dropped where its stern has been, spreading and thinning as it ages, so
//                a turn leaves its curve
//   its spray    off its chines and its rooster tails on the plane, off its bow wave displacing
// Its own frame loop, a frame behind the world's at most; seeded dice for the spray.
export function boatWaterScript() {
  return `${aquaPatchScript()}
// --- the water under a driven boat ---
{
  const __bwG = 9.81, kelvinField = ${kelvinField.toString()};
  let BW = null;
  function __bwBuild(g) {
    const SEA = g.turret.range.sea, N = SEA.sheet.n, H0 = SEA.sheet.size / 2, E = 4500, du = 2 / (N - 1), d0 = SEA.sheet.size / (N - 1);
    // (the grid's offsets from its centre along each axis: d0 apart near it, widening as u⁵ to E at its edge)
    const off = new Float32Array(N); for (let i = 0; i < N; i++) { const u = -1 + i * du; off[i] = H0 * u + (E - H0) * Math.pow(u, 5); }
    const NN = N * N, pos = new Float32Array(NN * 3), nor = new Float32Array(NN * 3), col = new Float32Array(NN * 3), fa = new Float32Array(NN), Hh = new Float32Array(NN);
    const tint = new THREE.Color(SEA.color);
    for (let q = 0; q < NN; q++) { nor[3 * q + 2] = 1; col[3 * q] = tint.r; col[3 * q + 1] = tint.g; col[3 * q + 2] = tint.b; }
    const idx = []; for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const q = j * N + i; idx.push(q, q + 1, q + N, q + 1, q + N + 1, q + N); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aAqFoam', new THREE.BufferAttribute(fa, 1)); geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const UQ = __aqPatch(mat, SEA.look, { sun: [0.4, 0.3, 0.8], foamCol: [0.94, 0.97, 0.98], refract: 0.04 });
    const sheet = new THREE.Mesh(geo, mat); sheet.renderOrder = 1; sheet.raycast = () => {}; sheet.frustumCulled = false; __aqShared.meshes.push(sheet); scene.add(sheet);
    const SW = SEA.swell.map((w) => ({ ...w, k: 2 * Math.PI / w.length, om: Math.sqrt(__bwG * 2 * Math.PI / w.length), dx: Math.cos(w.dir), dy: Math.sin(w.dir) }));
    const WL = SEA.waterline, LW = WL.length, BEAM = WL.beam;
    // spray: a fixed pool, seeded
    const NP = 700, sp = new Float32Array(NP * 3), sv = new Float32Array(NP * 3), sl = new Float32Array(NP);
    for (let i = 0; i < NP; i++) sp[3 * i + 2] = -1e4;
    const spray = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xf2f6f7, size: Math.max(0.05, 0.012 * LW), transparent: true, opacity: 0.85, depthWrite: false }));
    spray.frustumCulled = false; scene.add(spray);
    // (a round's splash: a pool of its own, its droplets seen at a gun's range)
    const NQ = 900, qp = new Float32Array(NQ * 3), qv = new Float32Array(NQ * 3), ql = new Float32Array(NQ);
    for (let i = 0; i < NQ; i++) qp[3 * i + 2] = -1e4;
    const column = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(qp, 3)), new THREE.PointsMaterial({ color: 0xeef3f4, size: 0.45, transparent: true, opacity: 0.9, depthWrite: false }));
    column.frustumCulled = false; scene.add(column);
    BW = { SEA, N, NN, off, d0, pos, nor, fa, Hh, geo, UQ, SW, LW, BEAM, sp, sv, sl, NP, spray, qp, qv, ql, NQ, column, qspawn: 0, spawn: 0, seed: 0x5eb0a7, trail: [], drop: 0, last: null, KP: { k0: 1, a0: 0, reach: 1, lw: LW, lifted: false, app: 0.34, cell: d0 } };
  }
  const swellAt = (x, y, t) => { let h = 0; for (const w of BW.SW) h += w.amp * Math.sin(w.k * (w.dx * x + w.dy * y) - w.om * t + (w.ph || 0)); return h; };
  const rnd = () => { let s = BW.seed = (BW.seed + 0x6d2b79f5) | 0, t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // the foam near the hull at a rung of its wake, ξ behind the bow and η across (the seaway's, its stern's run short)
  function foamNear(W, xiB, eta) {
    const LW = BW.LW, half = BW.BEAM / 2, lifted = W.regime !== 'displacement', xs = xiB - LW, ae = Math.abs(eta), APP = W.angle * Math.PI / 180;
    let f = 0;
    if (xs > -0.2 * LW && xs < 1.5 * LW) f = Math.max(f, Math.exp(-((ae / (W.sternWake.width / 2)) ** 2)) * 1.1 * Math.min(1, W.speed / 3));
    const xe = lifted ? xs : xiB - 0.08 * LW, ee = ae - half;
    if (xe > 0) { const o = ee - xe * Math.tan(APP), cap = LW * (lifted ? 2.5 : 0.8 + 2 * Math.min(W.froude, 0.6)); if (xe < cap) f = Math.max(f, 0.9 * Math.exp(-((o / (0.12 * BW.BEAM + 0.05 * xe)) ** 2)) * (1 - xe / cap)); }
    if (W.bowWave > 0.05 && xiB > 0 && xiB < 0.3 * LW && ee > -0.05 && ee < 0.15 * BW.BEAM + W.bowWave) f = Math.max(f, 1.1 * (1 - xiB / (0.3 * LW)));
    return f;
  }
  function emit(x, y, z, vx, vy, vz) { const i = BW.spawn++ % BW.NP; BW.sp[3 * i] = x; BW.sp[3 * i + 1] = y; BW.sp[3 * i + 2] = z; BW.sv[3 * i] = vx; BW.sv[3 * i + 1] = vy; BW.sv[3 * i + 2] = vz; BW.sl[i] = 1.2 + rnd(); }
  function frame(tm) {
    requestAnimationFrame(frame);
    const g = __world.pilotId && __world.byId[__world.pilotId];
    if (!g || !g.rule || g.rule.type !== 'boat' || !g.turret || !g.turret.range || !g.turret.range.sea) return;
    if (!BW) __bwBuild(g);
    const B = BW, SEA = B.SEA, t = g.sailT || 0, tr = g.transform, px = tr.pos[0], py = tr.pos[1], fx = Math.cos(tr.heading), fy = Math.sin(tr.heading);
    let dt = B.last == null ? 0 : (tm - B.last) / 1000; B.last = tm; if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
    const U = Math.max(0, g.speed || 0);
    // (its wake at the rung of its speeds under its speed now)
    let W = SEA.wakes[0]; for (const w of SEA.wakes) if (w.speed <= U + 1e-6) W = w;
    const lifted = W.regime !== 'displacement', K = B.KP;
    K.k0 = __bwG / Math.max(U, 0.5) ** 2; K.a0 = W.crest * Math.min(1, U / Math.max(W.speed, 0.1)); K.reach = W.reach; K.lifted = lifted; K.app = W.angle * Math.PI / 180;
    const fore = SEA.waterline.fore, waking = U > 0.4;
    // the trail: the stern's white water dropped where it has been, aging
    for (const p of B.trail) p.age += dt;
    while (B.trail.length && B.trail[0].age > 25) B.trail.shift();
    B.drop -= dt;
    if (waking && B.drop <= 0) { B.drop = 0.25; const sx = px + fx * SEA.waterline.aft, sy = py + fy * SEA.waterline.aft; B.trail.push({ x: sx, y: sy, age: 0, w: Math.max(0.5, W.sternWake.width / 2), s: Math.min(1, U / 4) }); }
    // the sheet's centre on its finest cells' grid, so the water under the boat never swims
    const cx = Math.round(px / B.d0) * B.d0, cy = Math.round(py / B.d0) * B.d0, N = B.N, off = B.off, shore = SEA.shore;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const q = j * N + i, x = cx + off[i], y = cy + off[j];
      B.pos[3 * q] = x; B.pos[3 * q + 1] = y;
      // (past the shore: down under the land)
      if (x > shore - 1) { B.Hh[q] = -2; B.fa[q] = 0; continue; }
      let h = swellAt(x, y, t), f = 0;
      if (waking) {
        const rx = x - px, ry = y - py, a = rx * fx + ry * fy, c = rx * fy - ry * fx, xi = fore - a;
        if (xi > -B.LW && xi < W.reach + B.LW && Math.abs(c) < 0.5 * xi + B.BEAM) {
          K.cell = Math.max(B.d0, (i > 0 ? off[i] - off[i - 1] : B.d0));
          h += kelvinField(xi, c, K) - 0.35 * kelvinField(xi - B.LW, c, K);
          f = foamNear(W, xi, c);
        }
      }
      B.Hh[q] = h; B.fa[q] = f;
    }
    // (the trail's white water on the cells near each of its drops: the cells' range by a search on the grid's offsets)
    const at = (v) => { let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (off[m] < v) lo = m + 1; else hi = m; } return lo; };
    for (const p of B.trail) {
      const w = p.w * (1 + 0.12 * p.age), amt = 0.9 * p.s * Math.exp(-p.age / 7), R = 2 * w;
      if (amt < 0.03) continue;
      const i0 = Math.max(0, at(p.x - R - cx) - 1), i1 = Math.min(N - 1, at(p.x + R - cx)), j0 = Math.max(0, at(p.y - R - cy) - 1), j1 = Math.min(N - 1, at(p.y + R - cy));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const q = j * N + i, dx = B.pos[3 * q] - p.x, dy = B.pos[3 * q + 1] - p.y, d2 = (dx * dx + dy * dy) / (w * w);
        if (d2 < 4) B.fa[q] = Math.max(B.fa[q], amt * Math.exp(-d2));
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const q = j * N + i, o = 3 * q; B.pos[o + 2] = B.Hh[q]; B.fa[q] = Math.min(1, B.fa[q]);
      const il = i > 0 ? q - 1 : q, ir = i < N - 1 ? q + 1 : q, jd = j > 0 ? q - N : q, ju = j < N - 1 ? q + N : q;
      const gx = (B.Hh[ir] - B.Hh[il]) / Math.max(1e-3, B.pos[3 * ir] - B.pos[3 * il]), gy = (B.Hh[ju] - B.Hh[jd]) / Math.max(1e-3, B.pos[3 * ju + 1] - B.pos[3 * jd + 1]);
      const inv = 1 / Math.hypot(gx, gy, 1); B.nor[o] = -gx * inv; B.nor[o + 1] = -gy * inv; B.nor[o + 2] = inv;
    }
    const A = B.geo.attributes; A.position.needsUpdate = true; A.normal.needsUpdate = true; A.aAqFoam.needsUpdate = true; B.UQ.uAqTime.value = t;
    // spray: off its chines and its rooster tails on the plane, off its bow wave displacing
    if (dt > 0 && waking) {
      const half = B.BEAM / 2, toW = (bx, by, bz) => [px + bx * fy + by * fx, py - bx * fx + by * fy, bz], rate = Math.min(300, 40 + 10 * U) * dt * Math.min(1, U / 4);
      for (let r = 0; r < rate; r++) {
        if (lifted) {
          const sx = rnd() < 0.5 ? 1 : -1, p = toW(sx * (half + 0.05), fore - (0.4 + 0.4 * rnd()) * B.LW, 0.02), out = (0.25 + 0.35 * rnd()) * U * 0.25;
          emit(p[0], p[1], p[2], fy * sx * out - fx * U * 0.15 + fx * U, -fx * sx * out - fy * U * 0.15 + fy * U, (0.4 + 0.6 * rnd()) * Math.sqrt(U) * 0.9);
          for (const R0 of W.rooster || []) if (rnd() < 0.5) { const q = toW(R0.at[0], R0.at[1], 0); emit(q[0], q[1], 0.05, fx * U * 0.6 + (rnd() - 0.5), fy * U * 0.6 + (rnd() - 0.5), Math.sqrt(2 * __bwG * R0.height) * (0.8 + 0.3 * rnd())); }
        } else if (W.bowWave > 0.05) {
          const sx = rnd() < 0.5 ? 1 : -1, p = toW(sx * (0.2 * half + 0.1), fore - 0.05 * B.LW * rnd(), W.bowWave * 0.6);
          emit(p[0], p[1], p[2], fy * sx * U * 0.12 + fx * U, -fx * sx * U * 0.12 + fy * U, Math.sqrt(2 * __bwG * W.bowWave) * (0.4 + 0.5 * rnd()));
        }
      }
    }
    if (dt > 0) {
      for (let i = 0; i < B.NP; i++) { if (B.sl[i] <= 0) continue; B.sl[i] -= dt; B.sv[3 * i + 2] -= __bwG * dt; B.sp[3 * i] += B.sv[3 * i] * dt; B.sp[3 * i + 1] += B.sv[3 * i + 1] * dt; B.sp[3 * i + 2] += B.sv[3 * i + 2] * dt; if (B.sp[3 * i + 2] < -0.05 || B.sl[i] <= 0) { B.sl[i] = 0; B.sp[3 * i + 2] = -1e4; } }
      B.spray.geometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < B.NQ; i++) { if (B.ql[i] <= 0) continue; B.ql[i] -= dt; B.qv[3 * i + 2] -= __bwG * dt; B.qp[3 * i] += B.qv[3 * i] * dt; B.qp[3 * i + 1] += B.qv[3 * i + 1] * dt; B.qp[3 * i + 2] += B.qv[3 * i + 2] * dt; if (B.qp[3 * i + 2] < -0.05 || B.ql[i] <= 0) { B.ql[i] = 0; B.qp[3 * i + 2] = -1e4; } }
      B.column.geometry.attributes.position.needsUpdate = true;
    }
    window.__mojBoatWater = { speed: U, rung: W.speed, regime: W.regime, trail: B.trail.length, splashes: B.splashes || 0, foam: B.fa.reduce((a, b) => a + (b > 0.3 ? 1 : 0), 0) };
  }
  // a round's splash where it came down on the water: a column of droplets thrown by its calibre and its charge
  window.__mojSplash = (x, y, cal, filler) => {
    if (!BW) return;
    const n = Math.min(160, 12 + Math.round(cal * 600 + filler * 120)), up = Math.sqrt(2 * __bwG * Math.min(60, 1.5 + cal * 60 + 25 * Math.cbrt(filler)));
    for (let k = 0; k < n; k++) {
      const a = rnd() * 2 * Math.PI, r = (0.2 + rnd()) * (1 + 6 * Math.cbrt(filler)), i = BW.qspawn++ % BW.NQ;
      BW.qp[3 * i] = x; BW.qp[3 * i + 1] = y; BW.qp[3 * i + 2] = 0.05; BW.qv[3 * i] = Math.cos(a) * r; BW.qv[3 * i + 1] = Math.sin(a) * r; BW.qv[3 * i + 2] = up * (0.5 + 0.5 * rnd()); BW.ql[i] = 4;
    }
    BW.splashes = (BW.splashes || 0) + 1;
  };
  requestAnimationFrame(frame);
}`;
}
