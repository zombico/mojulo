/**
 * hydro-view — a MULTI-ARC science explainer for hydroelectric power, built from the principles the
 * other science views established. The story runs in five arcs, each a scenario of this one kind, all
 * quoting the SAME numbers from one pure energy chain (physics/hydro.js):
 *
 *   1. 'dam'       — the reservoir stores HEAD. Hydrostatic pressure grows with depth on the dam face
 *                    (P = ρgh, fluid-view's water-pressure principle scaled up to a gravity dam), and
 *                    the deep outlet jets at v = √(2gh) — Torricelli through the dam's slit.
 *   2. 'penstock'  — the fall converts PE → KE. Water accelerates down the pipe; Bernoulli holds
 *                    (z + P/ρg + v²/2g = H), pressure builds with the drop, the nozzle trades it for speed.
 *   3. 'turbine'   — the MACHINE principle: the jet's momentum turned by Pelton buckets is a force,
 *                    the force at radius R is a torque, the runner SPINS (the windmill's spin mover).
 *   4. 'generator' — spin → electricity: magnet poles sweep past stator coils, the flux through each
 *                    coil changes, Faraday's ε = −dΦ/dt makes the EMF wave; f = p·n/60 lands on the grid.
 *   5. 'plant'     — the whole chain in one world: reservoir → penstock → runner → generator → wires,
 *                    water tracers riding the water path and power pulses riding the line.
 *
 * Visual scale is COMPRESSED for a watchable world; every readout/pick quotes the real SI numbers
 * from the chain. Stored manifest IS the recipe (regenerated on render):
 *   { kind:'hydro-view', scenario?, head?, flow?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

import { planHydroChain } from '../../physics/hydro.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── vec + baked shading (the world meshes are flat-coloured, so we bake form into the fills). ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const SUN = norm([0.45, -0.5, 0.8]);
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbToHex = (r) => '#' + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function shade(hex, n) { const f = 0.55 + 0.45 * Math.max(0, dot(norm(n), SUN)); return rgbToHex(hexToRgb(hex).map((c) => c * f)); }
const faceNormal = (c) => norm(cross(sub(c[1], c[0]), sub(c[2], c[0])));
const solid = (corners, hex, group) => ({ corners, fill: shade(hex, faceNormal(corners)), group });
// translucent face — flat fill, no shading (water, glass walls, pipes you can see into).
const tquad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });

// an axis-aligned shaded box, six faces.
function boxFaces(center, half, hex, group) {
  const [cx, cy, cz] = center, [hx, hy, hz] = half;
  const v = (sx, sy, sz) => [cx + hx * sx, cy + hy * sy, cz + hz * sz];
  const f = (a, b, c, d) => solid([a, b, c, d], hex, group);
  return [
    f(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)),
    f(v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)),
    f(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)),
    f(v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)),
    f(v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)),
    f(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)),
  ];
}

// a translucent box (water bodies, cutaway walls) — flat fill + alpha, six faces.
function waterBox(center, half, fill, group, alpha) {
  const [cx, cy, cz] = center, [hx, hy, hz] = half;
  const v = (sx, sy, sz) => [cx + hx * sx, cy + hy * sy, cz + hz * sz];
  const f = (a, b, c, d) => tquad([a, b, c, d], fill, group, alpha);
  return [
    f(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)),
    f(v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)),
    f(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)),
    f(v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)),
    f(v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)),
    f(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)),
  ];
}

// extrude an x–z outline along ±yHalf into a shaded prism (the dam's gravity cross-section).
function prismFaces(outline, yHalf, hex, group) {
  const faces = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const [ax, az] = outline[i], [bx, bz] = outline[(i + 1) % n];
    faces.push(solid([[ax, -yHalf, az], [bx, -yHalf, bz], [bx, yHalf, bz], [ax, yHalf, az]], hex, group));
  }
  faces.push(solid(outline.map(([x, z]) => [x, -yHalf, z]), hex, group));
  faces.push(solid(outline.slice().reverse().map(([x, z]) => [x, yHalf, z]), hex, group));
  return faces;
}

// a translucent square tube along a segment in the x–z plane (the penstock you can see into).
function tubeFaces(a, b, r, fill, group, alpha) {
  const d = norm(sub(b, a));
  const nn = norm([-d[2], 0, d[0]]);                      // wall normal, ⟂ the run in x–z
  const off = (p, sn, sy) => [p[0] + nn[0] * r * sn, p[1] + sy * r, p[2] + nn[2] * r * sn];
  return [
    tquad([off(a, 1, -1), off(b, 1, -1), off(b, 1, 1), off(a, 1, 1)], fill, group, alpha),
    tquad([off(a, -1, -1), off(b, -1, -1), off(b, -1, 1), off(a, -1, 1)], fill, group, alpha),
    tquad([off(a, -1, 1), off(b, -1, 1), off(b, 1, 1), off(a, 1, 1)], fill, group, alpha),
    tquad([off(a, -1, -1), off(b, -1, -1), off(b, 1, -1), off(a, 1, -1)], fill, group, alpha),
  ];
}

// The face mesh triangulates QUADS only, so an n-gon cap must be fanned into quads (n even).
const capQuads = (ring) => {
  const out = [];
  for (let k = 1; k + 2 < ring.length; k += 2) out.push([ring[0], ring[k], ring[k + 1], ring[k + 2]]);
  return out;
};

// n-gon drum about the Y axis (a turbine disc): rim quads + two fanned caps. Authored around `center`.
function drumY(center, r, yHalf, n, sideHex, capHex, group) {
  const [cx, cy, cz] = center;
  const ring = Array.from({ length: n }, (_, i) => { const a = TAU * i / n; return [cx + r * Math.cos(a), cz + r * Math.sin(a)]; });
  const faces = [];
  for (let i = 0; i < n; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % n];
    faces.push(solid([[ax, cy - yHalf, az], [bx, cy - yHalf, bz], [bx, cy + yHalf, bz], [ax, cy + yHalf, az]], sideHex, group));
  }
  for (const q of capQuads(ring)) faces.push(solid(q.map(([x, z]) => [x, cy - yHalf, z]), capHex, group));
  for (const q of capQuads(ring)) faces.push(solid(q.map(([x, z]) => [x, cy + yHalf, z]), capHex, group));
  return faces;
}

// n-gon drum about the Z axis (the generator rotor) — side fills alternate (N/S pole faces).
function drumZ(center, r, zHalf, n, sideFills, capHex, group) {
  const [cx, cy, cz] = center;
  const ring = Array.from({ length: n }, (_, i) => { const a = TAU * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const faces = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % n];
    faces.push(tquad([[ax, ay, cz - zHalf], [bx, by, cz - zHalf], [bx, by, cz + zHalf], [ax, ay, cz + zHalf]], sideFills[i % sideFills.length], group, undefined));
  }
  for (const q of capQuads(ring)) faces.push(solid(q.map(([x, y]) => [x, y, cz - zHalf]), capHex, group));
  for (const q of capQuads(ring)) faces.push(solid(q.map(([x, y]) => [x, y, cz + zHalf]), capHex, group));
  return faces;
}

// a Pelton bucket: a small box seated tangentially on the wheel rim at `ang`, authored around the
// wheel origin in the x–z plane (the runner group spins about Y through that origin).
function bucketFaces(ang, rPitch, half, hex, group) {
  const er = [Math.cos(ang), 0, Math.sin(ang)];           // radial
  const et = [-Math.sin(ang), 0, Math.cos(ang)];          // tangential
  const [ht, hy, hr] = half;                              // tangential, axial, radial half-extents
  const v = (st, sy, sr) => [
    er[0] * (rPitch + sr * hr) + et[0] * st * ht,
    sy * hy,
    er[2] * (rPitch + sr * hr) + et[2] * st * ht,
  ];
  const f = (a, b, c, d) => solid([a, b, c, d], hex, group);
  return [
    f(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)),
    f(v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)),
    f(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)),
    f(v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)),
    f(v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)),
    f(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)),
  ];
}

// a stator coil: a copper block seated tangentially on a ring about the Z axis at `ang`.
function coilFaces(ang, rPitch, cz, half, hex, group) {
  const er = [Math.cos(ang), Math.sin(ang), 0];
  const et = [-Math.sin(ang), Math.cos(ang), 0];
  const [ht, hr, hz] = half;                              // tangential, radial, vertical half-extents
  const v = (st, sr, sz) => [
    er[0] * (rPitch + sr * hr) + et[0] * st * ht,
    er[1] * (rPitch + sr * hr) + et[1] * st * ht,
    cz + sz * hz,
  ];
  const f = (a, b, c, d) => solid([a, b, c, d], hex, group);
  return [
    f(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)),
    f(v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)),
    f(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)),
    f(v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)),
    f(v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)),
    f(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)),
  ];
}

// resample a 3-D polyline to EQUAL TIME using per-vertex speeds — a tracer riding it then visibly
// speeds up where the water is fast (the fluid-view principle, lifted to 3-D).
function resampleEqualTime(pts, speeds, dt) {
  const tCum = [0];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(...sub(pts[i + 1], pts[i]));
    const sp = Math.max(0.12, (speeds[i] + speeds[i + 1]) / 2);
    tCum.push(tCum[i] + seg / sp);
  }
  const T = tCum[tCum.length - 1]; if (!(T > 0)) return null;
  const n = Math.max(8, Math.round(T / dt)), out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * T;
    while (j < tCum.length - 2 && tCum[j + 1] < t) j++;
    const span = tCum[j + 1] - tCum[j] || 1e-6, f = clamp((t - tCum[j]) / span, 0, 1);
    out.push([0, 1, 2].map((ax) => pts[j][ax] + (pts[j + 1][ax] - pts[j][ax]) * f));
  }
  return { path: out, T };
}

const compactFields = (pairs) => pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));

// hydrostatic depth colour (shallow → pale cyan, deep → deep blue) — fluid-view's pressure read.
const lerpColor = (lo, hi, t) => {
  const u = clamp(t, 0, 1);
  return (Math.round(lo[0] + (hi[0] - lo[0]) * u) << 16) | (Math.round(lo[1] + (hi[1] - lo[1]) * u) << 8) | Math.round(lo[2] + (hi[2] - lo[2]) * u);
};
const pressureColor = (depthFrac) => lerpColor([150, 205, 235], [22, 62, 165], depthFrac);

const WATER = '#2d6fb0';
const WATER_DOT = [185, 218, 255];
const PULSE_DOT = [255, 224, 120];
const MW = (w) => `${(w / 1e6).toFixed(1)} MW`;
const F1 = (v) => (+v).toFixed(1);

// water tracers offset across ±y so the flow reads as a stream, not a single dot.
function strandTracers(pts, speeds, dt, offsets, { size = 0.42, slow = 5 } = {}) {
  const out = [];
  for (const dy of offsets) {
    const rs = resampleEqualTime(pts.map((p) => [p[0], p[1] + dy, p[2]]), speeds, dt);
    if (!rs) continue;
    out.push({ path: rs.path, color: WATER_DOT, size, period: Math.max(2, rs.T * slow), trail: 6, trailLag: 0.005 });
  }
  return out;
}

const SCENARIOS = {
  // ARC 1 — the DAM: stored head. Hydrostatic pressure on the wall + the Torricelli outlet jet.
  dam(P, chain) {
    const H = 16, W = 9, T = 12;                      // visual: wall height, half-width, base thickness
    const wl = H * 0.94;                              // waterline (a little freeboard)
    const faces = [];
    faces.push(solid([[-26, -W - 6, 0], [T + 26, -W - 6, 0], [T + 26, W + 6, 0], [-26, W + 6, 0]], '#6b6f66', 'ground'));
    faces.push(...prismFaces([[0, 0], [0, H], [2.2, H], [T, 0]], W, '#a2a8b0', 'dam'));
    faces.push(...waterBox([-13, 0, wl / 2], [13, W, wl / 2], WATER, 'reservoir', 0.22));
    faces.push(...waterBox([T + 9, 0, 0.55], [9, W, 0.55], WATER, 'tailwater', 0.25));
    faces.push(...boxFaces([T - 0.9, 0, 1.2], [1.1, 1.1, 1.1], '#3d434b', 'outlet'));

    // pressure on the upstream face — P = ρgh, arrows grow + darken with depth.
    const press = [];
    for (const z of [wl * 0.85, wl * 0.65, wl * 0.45, wl * 0.25, wl * 0.08]) {
      const depth = (wl - z) / wl;
      const amp = 1.0 + 3.4 * depth;
      // base sits back in the water so the arrow TIP lands on the dam face (not inside the wall).
      press.push({ pos: [-amp - 0.2, 0, z], dir: [1, 0, 0], amp, color: pressureColor(depth) });
    }

    // the outlet jet — Torricelli from near-full depth, arcing into the tailrace.
    const vJet = chain.jet.v;
    const jetPts = [], jetLine = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      jetPts.push([T + 0.4 + 13 * t, 0, Math.max(0.35, 1.2 - 2.1 * t * t)]);
    }
    jetLine.push({ pts: jetPts, color: pressureColor(0.85), opacity: 0.55 });
    const tracers = [-0.55, 0, 0.55].map((dy) => ({
      path: jetPts.map((p) => [p[0], p[1] + dy, p[2]]),
      color: WATER_DOT, size: 0.4, period: clamp(52 / vJet, 0.8, 3), trail: 6, trailLag: 0.006,
    }));

    const head = chain.spec.head;
    const picks = [
      { name: 'dam', kind: 'dam', label: 'Gravity dam', fields: compactFields([
        ['holds back', `${head} m of head`], ['toe pressure', `P = ρgH = ${Math.round(chain.pressure.base / 1000)} kPa`], ['why the fat base', 'pressure grows with depth'],
      ]) },
      { name: 'reservoir', kind: 'reservoir', label: 'Reservoir', fields: compactFields([
        ['stores', 'potential energy — HEAD'], ['available power', `P = ρgQH = ${MW(chain.power.hydraulic)}`], ['flow Q', `${chain.spec.flow} m³/s`],
      ]) },
      { name: 'outlet', kind: 'outlet', label: 'Deep outlet', fields: compactFields([
        ['jet speed', `v = √(2gh) = ${F1(vJet)} m/s`], ['why', 'depth → pressure → speed (Torricelli)'],
      ]) },
    ];
    return {
      faces, picks, tracers, movers: [],
      field: {
        animate: false,
        sets: [{ color: 0x9fb2c8, curve: false, samples: press }],
        lines: [...jetLine, { pts: [[-20, 0, 0], [-20, 0, wl]], color: 0xc8d2e1, opacity: 0.8 }],
        readout: ['Hydroelectric, arc 1 — the dam stores HEAD',
          `hydrostatic pressure grows with depth: P = ρgh (toe: ${Math.round(chain.pressure.base / 1000)} kPa)`,
          `the deep outlet jets at v = √(2gh) = ${F1(vJet)} m/s (Torricelli)`,
          `head ${head} m × flow ${chain.spec.flow} m³/s → P = ρgQH = ${MW(chain.power.hydraulic)} available`],
      },
      span: 60,
    };
  },

  // ARC 2 — the PENSTOCK: falling water converts PE → KE, Bernoulli holding the books.
  penstock(P, chain) {
    const faces = [];
    faces.push(...boxFaces([-14, 0, 6], [10, 10, 6], '#5c665a', 'ground'));          // the high bench
    faces.push(...boxFaces([10, 0, 0.45], [14, 10, 0.45], '#6b6f66', 'ground'));     // the valley floor
    faces.push(...waterBox([-13.5, 0, 14.2], [8.5, 9, 2.2], WATER, 'reservoir', 0.22));
    faces.push(...boxFaces([-4.4, 0, 13], [1.0, 1.3, 1.3], '#3d434b', 'intake'));

    const A = [-4, 0, 13], B = [6, 0, 3], C = [12, 0, 2.2], D = [14.6, 0, 2.2];
    faces.push(...tubeFaces(A, B, 1.25, '#88909c', 'penstock', 0.32));
    faces.push(...tubeFaces(B, C, 1.05, '#88909c', 'penstock', 0.32));
    // the nozzle — the pipe necks down and pressure becomes speed.
    faces.push(...tubeFaces(C, D, 0.55, '#6d7683', 'nozzle', 0.55));

    // water strands: slow approach → accelerating down the pipe → the fast free jet.
    const vJet = chain.jet.v;
    const pts = [[-12, 0, 14.4], [-4.6, 0, 13.2], A, B, C, D, [22, 0, 1.7], [26, 0, 1.1]];
    const speeds = [0.5, 0.7, 1.0, 2.2, 2.8, vJet / 3, vJet / 3, vJet / 3.4];
    const tracers = strandTracers(pts, speeds, 0.05, [-0.5, 0, 0.5], { slow: 3 });

    // pressure on the pipe wall — grows with the drop as height becomes pressure head.
    const press = [];
    for (const t of [0.15, 0.45, 0.75, 0.95]) {
      const p = [A[0] + (C[0] - A[0]) * t, 0, A[2] + (C[2] - A[2]) * t];
      const drop = (A[2] - p[2]) / (A[2] - C[2]);       // 0 at intake → 1 at the nozzle
      const d = norm(sub(C, A));
      const nn = norm([-d[2], 0, d[0]]);
      press.push({ pos: [p[0] + nn[0] * 1.5, 0, p[2] + nn[2] * 1.5], dir: [nn[0], 0, nn[2]], amp: 0.5 + 1.9 * drop, color: pressureColor(drop) });
    }

    const picks = [
      { name: 'intake', kind: 'intake', label: 'Intake', fields: compactFields([
        ['draws from', 'the reservoir, below the surface'], ['energy here', 'all HEAD (potential)'],
      ]) },
      { name: 'penstock', kind: 'penstock', label: 'Penstock', fields: compactFields([
        ['Bernoulli', 'z + P/ρg + v²/2g = H'], ['down the pipe', 'height ↓ → pressure ↑'], ['friction toll', `η ≈ ${chain.eta.penstock}`],
      ]) },
      { name: 'nozzle', kind: 'nozzle', label: 'Nozzle', fields: compactFields([
        ['trades', 'pressure for SPEED'], ['jet', `v = √(2g·H_eff) = ${F1(vJet)} m/s`],
      ]) },
    ];
    return {
      faces, picks, tracers, movers: [],
      field: {
        animate: false,
        sets: [{ color: 0x9fb2c8, curve: false, samples: press }],
        lines: [],
        readout: ['Hydroelectric, arc 2 — the penstock: PE → KE',
          'Bernoulli along the pipe: z + P/ρg + v²/2g = H (constant)',
          'as the water falls, height becomes PRESSURE (arrows grow down the pipe)',
          `at the nozzle, pressure becomes SPEED: v = √(2g·H_eff) = ${F1(vJet)} m/s`],
      },
      span: 56,
    };
  },

  // ARC 3 — the TURBINE (the machine principle): the jet's turned momentum is a force, the force at
  // radius R is a torque, the runner spins. Pelton, at maximum power transfer u = v/2.
  turbine(P, chain) {
    const CZ = 7.2, R_DISC = 4.2, R_PITCH = 4.9, N_BUCKETS = 14, JZ = CZ - R_PITCH;
    const faces = [];
    faces.push(...boxFaces([0, 0, -0.3], [17, 10, 0.3], '#4a505a', 'floor'));
    faces.push(...boxFaces([0, 2.7, CZ / 2], [0.7, 0.6, CZ / 2], '#565c66', 'pedestal'));
    faces.push(...boxFaces([0, -2.7, CZ / 2], [0.7, 0.6, CZ / 2], '#565c66', 'pedestal'));

    // the runner — authored centred on the ORIGIN (the spin mover places it at the pivot).
    const runner = [
      ...drumY([0, 0, 0], R_DISC, 0.5, 18, '#8f96a1', '#7d848e', 'runner'),
      ...boxFaces([0, 0, 0], [0.5, 3.6, 0.5], '#7d848e', 'runner'),
    ];
    for (let b = 0; b < N_BUCKETS; b++) runner.push(...bucketFaces(TAU * b / N_BUCKETS, R_PITCH, [0.6, 0.9, 0.85], '#c6ccd4', 'runner'));
    faces.push(...runner);

    // the nozzle — feed pipe + necking tip, firing −x along the tangent at the wheel's bottom bucket.
    faces.push(...boxFaces([12.2, 0, JZ], [3.0, 0.95, 0.95], '#6d7683', 'nozzle'));
    faces.push(...tubeFaces([9.2, 0, JZ], [6.4, 0, JZ], 0.5, '#565c66', 'nozzle', 0.6));

    // the jet flies free from the nozzle to the tangent point (x≈0), where the bottom bucket takes it,
    // + the two-sided spray a real Pelton bucket splits.
    const vJet = chain.jet.v;
    const jetPeriod = clamp(34 / vJet, 0.6, 2.4);
    const tracers = [-0.28, 0, 0.28].map((dy) => ({
      path: [[15.0, dy, JZ], [0.9, dy, JZ]], color: WATER_DOT, size: 0.42, period: jetPeriod, trail: 6, trailLag: 0.008,
    }));
    for (const sy of [1, -1]) tracers.push({
      path: [[0.6, 0, JZ], [-1.0, sy * 1.5, JZ + 0.3], [-2.6, sy * 2.6, JZ - 0.1]],
      color: WATER_DOT, size: 0.34, period: jetPeriod * 1.4, trail: 5, trailLag: 0.01,
    });

    // the runner spins — real ω is quoted; the render is clamped to a watchable rate.
    const omega = clamp(chain.runner.omega, 0.5, 2.0);
    const movers = [{ group: 'runner', spin: { axis: [0, 1, 0], omega }, pivot: [0, 0, CZ], basePos: [0, 0, 0] }];

    const F = chain.runner.jetForce;
    const forceSet = { color: 0xffe066, curve: false, samples: [{ pos: [1.4, 0, JZ + 1.2], dir: [-1, 0, 0], amp: clamp(F / 4e5, 0.8, 4), color: 0xffe066 }] };
    const picks = [
      { name: 'runner', kind: 'runner', label: 'Pelton runner', fields: compactFields([
        ['buckets', `${N_BUCKETS} — each turns the jet ~180°`], ['best speed', `u = v/2 = ${F1(chain.runner.u)} m/s`],
        ['real rate', `${Math.round(chain.runner.rpm)} rpm`], ['torque', `τ = P/ω = ${Math.round(chain.runner.torque / 1000)} kN·m`],
      ]) },
      { name: 'nozzle', kind: 'nozzle', label: 'Nozzle', fields: compactFields([
        ['jet', `v = ${F1(vJet)} m/s`], ['force', `F = ρQ(v−u)(1−cosθ) = ${Math.round(F / 1000)} kN`],
      ]) },
    ];
    return {
      faces, picks, tracers, movers,
      field: {
        animate: false,
        sets: [forceSet],
        lines: [],
        readout: ['Hydroelectric, arc 3 — the turbine: momentum → torque',
          'each bucket TURNS the jet around — changing momentum is a FORCE',
          `F = ρQ(v−u)(1−cosθ) = ${Math.round(F / 1000)} kN, applied at radius R = ${chain.runner.radius} m → torque`,
          `max power at bucket speed u = v/2 → ${Math.round(chain.runner.rpm)} rpm (shown slowed)`],
      },
      span: 40,
    };
  },

  // ARC 4 — the GENERATOR: spin → electricity. Poles sweep the coils, flux changes, Faraday's EMF.
  generator(P, chain) {
    const CZ = 7.5, R_ROT = 3.4, N_POLE = 12, R_COIL = 5.3, N_COIL = 9;
    const faces = [];
    faces.push(...boxFaces([0, 0, 0.4], [7.4, 7.4, 0.4], '#4a505a', 'base'));

    // the rotor — an N/S pole drum on a vertical shaft, authored centred on the ORIGIN.
    const rotor = [
      ...drumZ([0, 0, 0], R_ROT, 2.9, N_POLE, ['#cf5548', '#4a6fd0'], '#7d848e', 'rotor'),
      ...boxFaces([0, 0, -4.2], [0.55, 0.55, 1.3], '#7d848e', 'rotor'),      // the shaft from the turbine below
    ];
    faces.push(...rotor);

    // the stator — a ring of copper coils the poles sweep past.
    for (let c = 0; c < N_COIL; c++) faces.push(...coilFaces(TAU * c / N_COIL, R_COIL, CZ, [1.0, 0.55, 2.6], '#c07437', 'stator'));

    const omega = clamp(chain.runner.omega, 0.5, 2.0);
    const movers = [{ group: 'rotor', spin: { axis: [0, 0, 1], omega }, pivot: [0, 0, CZ], basePos: [0, 0, 0] }];

    // the EMF wave — what a coil sees as poles sweep by: ε = −dΦ/dt, drawn beside the machine.
    const wavePts = Array.from({ length: 49 }, (_, i) => {
      const t = i / 48;
      return [8.6 + 11 * t, 0, CZ + 1.9 * Math.sin(TAU * 2 * t)];
    });
    const cyclePeriod = (2 * TAU) / (omega * (N_POLE / 2));   // two electrical cycles at the rendered rate
    const tracers = [{ path: wavePts, color: PULSE_DOT, size: 0.4, period: Math.max(1.2, cyclePeriod), trail: 7, trailLag: 0.012 }];

    // flux arrows — the field crossing from poles into the nearest coils.
    const flux = [];
    for (let c = 0; c < 4; c++) {
      const a = TAU * c / 4 + TAU / 8;
      flux.push({ pos: [Math.cos(a) * (R_COIL - 1.3), Math.sin(a) * (R_COIL - 1.3), CZ], dir: [Math.cos(a), Math.sin(a), 0], amp: 1.1, color: 0x9fb2c8 });
    }

    const g = chain.generator;
    const picks = [
      { name: 'rotor', kind: 'rotor', label: 'Rotor (field poles)', fields: compactFields([
        ['poles', `${g.poles} (red N / blue S)`], ['spins at', `${Math.round(chain.runner.rpm)} rpm — the turbine shaft`],
      ]) },
      { name: 'stator', kind: 'stator', label: 'Stator coils', fields: compactFields([
        ['Faraday', 'ε = −dΦ/dt'], ['each pole pass', 'flips the flux → one EMF cycle'],
        ['frequency', `f = p·n/60 = ${F1(g.f)} Hz`], ['output', MW(chain.power.elec)],
      ]) },
    ];
    return {
      faces, picks, tracers, movers,
      field: {
        animate: false,
        sets: [{ color: 0x9fb2c8, curve: false, samples: flux }],
        lines: [{ pts: wavePts, color: 0xffe066, opacity: 0.85 }],
        readout: ['Hydroelectric, arc 4 — the generator: spin → electricity',
          'magnet poles sweep past the coils → the flux through each coil CHANGES',
          'Faraday: ε = −dΦ/dt — no motion, no volts; the gold wave is the EMF',
          `${g.poles} poles × ${Math.round(chain.runner.rpm)} rpm → f = ${F1(g.f)} Hz · P = ${MW(chain.power.elec)}`],
      },
      span: 42,
    };
  },

  // ARC 5 — the PLANT: the whole chain in one world. Water rides the water path; power rides the wire.
  plant(P, chain) {
    const H = 10, W = 7, T = 7.5, wl = H * 0.94;
    const faces = [];
    faces.push(solid([[-24, -W - 8, 0], [44, -W - 8, 0], [44, W + 8, 0], [-24, W + 8, 0]], '#5c665a', 'ground'));
    faces.push(...prismFaces([[0, 0], [0, H], [1.6, H], [T, 0]], W, '#a2a8b0', 'dam'));
    faces.push(...waterBox([-11.5, 0, wl / 2], [11.5, W, wl / 2], WATER, 'reservoir', 0.22));
    faces.push(...waterBox([27, 0, 0.5], [8, W * 0.55, 0.5], WATER, 'tailrace', 0.25));

    // the powerhouse — translucent walls so the machines inside read.
    faces.push(...boxFaces([16, 0, 0.25], [5.5, 4.6, 0.25], '#4a505a', 'powerhouse'));
    faces.push(...waterBox([16, 0, 3.6], [5.5, 4.6, 3.4], '#9aa1ab', 'powerhouse', 0.16));

    // the penstock through the dam, down to the runner.
    const A = [-0.8, 0, 6.4], B = [9, 0, 1.9], C = [12.6, 0, 1.9];
    faces.push(...tubeFaces(A, B, 0.85, '#88909c', 'penstock', 0.35));
    faces.push(...tubeFaces(B, C, 0.7, '#88909c', 'penstock', 0.35));

    // runner + generator on ONE shaft along y — both authored around the origin, spun by twin movers.
    const runner = [
      ...drumY([0, -1.6, 0], 1.55, 0.35, 14, '#8f96a1', '#7d848e', 'runner'),
      ...boxFaces([0, 0.2, 0], [0.3, 2.2, 0.3], '#7d848e', 'runner'),        // the shared shaft
    ];
    for (let b = 0; b < 10; b++) runner.push(...bucketFaces(TAU * b / 10, 1.9, [0.3, 0.4, 0.4], '#c6ccd4', 'runner').map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1] - 1.6, c[2]]) })));
    faces.push(...runner);
    faces.push(...drumY([0, 1.9, 0], 1.45, 1.1, 10, '#cf5548', '#7d848e', 'rotor'));
    const PIVOT = [15, 0, 2.2];
    const omega = clamp(chain.runner.omega, 0.5, 2.0);
    const movers = [
      { group: 'runner', spin: { axis: [0, 1, 0], omega }, pivot: PIVOT, basePos: [0, 0, 0] },
      { group: 'rotor', spin: { axis: [0, 1, 0], omega }, pivot: PIVOT, basePos: [0, 0, 0] },
    ];

    // the pylon + the line out — power leaves along the wire.
    faces.push(...boxFaces([30, 1.1, 5.2], [0.28, 0.28, 5.2], '#565c66', 'pylon'));
    faces.push(...boxFaces([30, -1.1, 5.2], [0.28, 0.28, 5.2], '#565c66', 'pylon'));
    faces.push(...boxFaces([30, 0, 10.6], [0.32, 2.6, 0.32], '#565c66', 'pylon'));
    const wire = (a, b, sag, n = 16) => Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - sag * 4 * t * (1 - t)];
    });
    const wireA = wire([19.5, 0, 7.2], [30, 0, 10.4], 1.1);
    const wireB = wire([30, 0, 10.4], [43, 0, 9.2], 1.6);
    const lines = [
      { pts: wireA, color: 0x8b93a0, opacity: 0.9 },
      { pts: wireB, color: 0x8b93a0, opacity: 0.9 },
    ];
    const tracers = [
      { path: [...wireA, ...wireB.slice(1)], color: PULSE_DOT, size: 0.34, period: 1.6, trail: 7, trailLag: 0.012 },
    ];

    // the water path: reservoir → intake → penstock → runner → tailrace.
    const vJet = chain.jet.v;
    const pts = [[-10, 0, 8.2], [-1.2, 0, 6.8], A, B, C, [15, 0, 1.6], [21, 0, 0.8], [33, 0, 0.6]];
    const speeds = [0.5, 0.8, 1.1, 2.4, vJet / 3.2, vJet / 4, 1.6, 1.1];
    tracers.push(...strandTracers(pts, speeds, 0.05, [-0.45, 0.45], { size: 0.4, slow: 3 }));

    const picks = [
      { name: 'dam', kind: 'dam', label: 'Dam', fields: compactFields([['stores', `${chain.spec.head} m of head`], ['P = ρgh', 'pressure grows with depth']]) },
      { name: 'penstock', kind: 'penstock', label: 'Penstock', fields: compactFields([['converts', 'PE → KE (Bernoulli)'], ['jet', `v = ${F1(vJet)} m/s`]]) },
      { name: 'runner', kind: 'runner', label: 'Turbine', fields: compactFields([['momentum → torque', `${Math.round(chain.runner.rpm)} rpm`], ['u = v/2', `${F1(chain.runner.u)} m/s`]]) },
      { name: 'rotor', kind: 'rotor', label: 'Generator', fields: compactFields([['Faraday', 'ε = −dΦ/dt'], ['f', `${F1(chain.generator.f)} Hz`], ['output', MW(chain.power.elec)]]) },
      { name: 'pylon', kind: 'pylon', label: 'Transmission', fields: compactFields([['carries', MW(chain.power.elec)], ['≈ homes', `${chain.homes.toLocaleString('en-US')}`]]) },
    ];
    return {
      faces, picks, tracers, movers,
      field: {
        animate: false,
        sets: [],
        lines,
        readout: ['Hydroelectric power — the whole chain',
          'head → jet → torque → EMF:  PE → KE → rotation → electricity',
          `P = η·ρ·g·Q·H = ${MW(chain.power.elec)} ≈ ${chain.homes.toLocaleString('en-US')} homes`,
          'arcs: dam → penstock → turbine → generator (mint each for the close-up)'],
      },
      span: 70,
    };
  },

  // ── arc 6: the SPILLWAY at night — the plant's real face, shedding the flood ────────────────
  // A gravity dam with N gate bays, a white veil falling through EACH bay, warm crest lights, a
  // snow-capped ridge behind. The water is two surface-channel sheets: the reservoir stands AT
  // HEAD behind the wall (grid.cz), culled against the dam strip + banks (masks — the walls,
  // mapped), and the tailrace is the double-slit WAVEFIELD with every gate mouth a coherent
  // point source — the churn downstream IS their interference fan. Gate count follows the
  // design discharge; the readout quotes the real chain numbers (visual scale compressed).
  spillway(P, chain) {
    const flow = chain.spec.flow, head = chain.spec.head;
    const gates = Math.round(clamp(4 + flow / 12, 4, 12));
    const qGate = flow / gates;
    const GATE_W = 4.6, PIER_W = 1.3;
    const span = gates * GATE_W + (gates + 1) * PIER_W;
    const X0 = -span / 2;
    const SILL = 6.6, DECK = 10.8, DECK_TOP = 11.6;
    const faces = [], tracers = [];
    const lit = (corners, rgb, group) => tquad(corners, rgbToHex(rgb.map((v) => v * 255)), group);

    // battered downstream face (front = −y) + wall body + piers + parked leaves
    const WSEG = 24;
    for (let i = 0; i < WSEG; i++) {
      const xa = X0 + (span * i) / WSEG, xb = X0 + (span * (i + 1)) / WSEG;
      faces.push(solid([[xa, -0.4, SILL], [xb, -0.4, SILL], [xb, -2.2, 0], [xa, -2.2, 0]], '#4e5768', 'dam'));
    }
    faces.push(...boxFaces([X0 + span / 2, 1.4, SILL / 2], [span / 2, 1.8, SILL / 2], '#434b5c', 'dam'));
    for (let g = 0; g <= gates; g++) {
      const px = X0 + g * (GATE_W + PIER_W);
      faces.push(...boxFaces([px + PIER_W / 2, 0.5, (SILL + DECK) / 2], [PIER_W / 2, 2.1, (DECK - SILL) / 2], '#4e5768', 'dam'));
      faces.push(lit([[px, -1.6, DECK - 1.1], [px + PIER_W, -1.6, DECK - 1.1], [px + PIER_W, -1.6, DECK], [px, -1.6, DECK]], [0.55, 0.52, 0.44], 'deck'));
      if (g < gates) faces.push(...boxFaces([px + PIER_W + GATE_W / 2, 0.8, (SILL + 1.1 + DECK - 0.6) / 2], [GATE_W / 2, 0.4, (DECK - 0.6 - SILL - 1.1) / 2], '#1a1e26', 'gate'));
    }
    // deck + lit parapet + crest lamps
    faces.push(...boxFaces([X0 + span / 2, 0.45, (DECK + DECK_TOP) / 2], [span / 2 + 0.6, 2.35, (DECK_TOP - DECK) / 2], '#565f70', 'deck'));
    faces.push(lit([[X0 - 0.6, -1.9, DECK], [X0 + span + 0.6, -1.9, DECK], [X0 + span + 0.6, -1.9, DECK_TOP], [X0 - 0.6, -1.9, DECK_TOP]], [0.62, 0.56, 0.42], 'deck'));
    for (let g = 0; g <= gates; g++) {
      const px = X0 + g * (GATE_W + PIER_W) + PIER_W / 2;
      faces.push(...boxFaces([px, -1.3, DECK_TOP + 0.6], [0.10, 0.10, 0.6], '#2a2e38', 'deck'));
      for (const f of boxFaces([px, -1.3, DECK_TOP + 1.41], [0.28, 0.25, 0.21], '#000000', 'deck')) faces.push({ ...f, fill: '#ffde8c' });
    }
    // gatehouse with lit windows, on the left abutment
    faces.push(...boxFaces([X0 - 3.3, 0.5, DECK_TOP + 1.7], [4.5, 1.9, 1.7], '#3a4150', 'deck'));
    for (let wI = 0; wI < 4; wI++) {
      const wx = X0 - 6.6 + wI * 2.0;
      faces.push(lit([[wx, -1.41, DECK_TOP + 1.0], [wx + 1.1, -1.41, DECK_TOP + 1.0], [wx + 1.1, -1.41, DECK_TOP + 2.2], [wx, -1.41, DECK_TOP + 2.2]], [1.0, 0.9, 0.62], 'deck'));
    }
    // rock banks containing the raised reservoir
    faces.push(...boxFaces([X0 - 20, 5.9, (DECK_TOP + 0.8) / 2], [20, 8.1, (DECK_TOP + 0.8) / 2], '#20242e', 'dam'));
    faces.push(...boxFaces([X0 + span + 20, 5.9, (DECK_TOP + 0.8) / 2], [20, 8.1, (DECK_TOP + 0.8) / 2], '#20242e', 'dam'));

    // the veils — LIVE falling sheets: one spout surface per bay, ripples + streak bands sliding
    // down the arc (the river-mode treatment bent onto a fall), plus a falling tracer per gate.
    const veil = (t) => ({ y: -(0.5 + 4.6 * t * t + 0.6 * t), z: SILL * (1 - t * t) - 0.25 * t });
    const veilPath = Array.from({ length: 12 }, (_, k) => { const p = veil(k / 11); return [p.y, p.z]; });
    const spouts = [];
    for (let g = 0; g < gates; g++) {
      const gx0 = X0 + PIER_W + g * (GATE_W + PIER_W) + 0.12, gw = GATE_W - 0.24;
      spouts.push({
        grid: { w: 1, d: 1, nx: 12, ny: 18 },
        spout: { x0: gx0, x1: gx0 + gw, path: veilPath, lam: 3.4, speed: 9, amp: 0.13, accel: 1.6, strips: 7, seed: g + 1 },
        amax: 0.15, sun: [-24, -30, 60], noLights: true,
        // the veil glows at night (the long-exposure look): a soft self-light under the streaks,
        // kept low enough that the sliding bands still read
        emissive: [0.26, 0.29, 0.36], emissiveIntensity: 0.6,
        deep: [0.42, 0.52, 0.70], surf: [0.78, 0.84, 0.94], crest: [1.0, 1.0, 1.0],
      });
      const cx = gx0 + gw / 2;
      const path = Array.from({ length: 10 }, (_, k) => { const p = veil(k / 9); return [cx, p.y, p.z + 0.3]; });
      path.push([cx, -12, 0.5], [cx, -16, 0.4]);
      tracers.push({ path, color: [205, 228, 255], size: 0.42, period: 1.7, trail: 4, trailLag: 0.01 });
    }
    // foam apron the veils plunge into (pickable as the tailrace)
    for (let i = 0; i < WSEG; i++) {
      const xa = X0 + (span * i) / WSEG, xb = X0 + (span * (i + 1)) / WSEG;
      const f = 0.85 + 0.15 * hash2(i, 3);
      faces.push(lit([[xa, -4.6, 0.5], [xb, -4.6, 0.5], [xb, -7.6, 0.32], [xa, -7.6, 0.32]], [0.88 * f, 0.93 * f, 0.99 * f], 'tailrace'));
      faces.push(lit([[xa, -7.6, 0.32], [xb, -7.6, 0.32], [xb, -9.6, 0.22], [xa, -9.6, 0.22]], [0.55 * f, 0.64 * f, 0.78 * f], 'tailrace'));
    }

    // the ridge behind (snow above the shoulder) + a dark conifer band at the far shore
    const RX0 = -120, RX1 = 120, RY0 = 34, RY1 = 100, RNX = 56, RNY = 18;
    const ridgeZ = (x, y) => Math.max(0, fbm2(x * 1.6, y * 1.2) * (18 + 58 * ((y - RY0) / (RY1 - RY0))) - 3);
    for (let j = 0; j < RNY; j++) for (let i = 0; i < RNX; i++) {
      const xa = RX0 + ((RX1 - RX0) * i) / RNX, xb = RX0 + ((RX1 - RX0) * (i + 1)) / RNX;
      const ya = RY0 + ((RY1 - RY0) * j) / RNY, yb = RY0 + ((RY1 - RY0) * (j + 1)) / RNY;
      const p00 = [xa, ya, ridgeZ(xa, ya)], p10 = [xb, ya, ridgeZ(xb, ya)], p11 = [xb, yb, ridgeZ(xb, yb)], p01 = [xa, yb, ridgeZ(xa, yb)];
      const zc = (p00[2] + p10[2] + p11[2] + p01[2]) / 4;
      const snow = clamp((zc - 11) / 10, 0, 1);
      faces.push(solid([p00, p10, p11, p01], rgbToHex(mix3([0.11, 0.13, 0.20], [0.80, 0.85, 0.94], snow).map((v) => v * 255)), 'ridge'));
    }
    for (let i = 0; i < 40; i++) {
      const xa = RX0 + ((RX1 - RX0) * i) / 40, xb = RX0 + ((RX1 - RX0) * (i + 1)) / 40;
      const h = 2.2 + 2.4 * hash2(i, 9);
      faces.push(lit([[xa, 34, 0], [xb, 34, 0], [xb, 33.4, h], [xa, 33.4, h]], [0.03, 0.07, 0.06], 'ridge'));
    }

    // the water: reservoir AT HEAD behind the wall (walls mapped via masks), and the tailrace
    // wavefield — every gate a coherent source, the fan their interference.
    const gateCenters = Array.from({ length: gates }, (_, g) => X0 + PIER_W + g * (GATE_W + PIER_W) + GATE_W / 2);
    const surfaces = [
      {
        grid: { w: 130, d: 32.5, nx: 160, ny: 44, cx: 0, cy: 16.9, cz: SILL * 1.24 },
        masks: [
          [X0 - 0.9, X0 + span + 0.9, -2.4, 3.6],
          [-90, X0, -2.4, 14.5],
          [X0 + span, 90, -2.4, 14.5],
        ],
        waves: [
          { dx: 0.94, dy: 0.34, A: 0.10, k: 0.55, om: 0.7, ph: 0.4, Q: 0.3 },
          { dx: -0.71, dy: 0.71, A: 0.06, k: 0.9, om: 1.0, ph: 2.6, Q: 0.3 },
        ],
        amax: 0.16, sun: [-24, -30, 60],
        deep: [0.012, 0.03, 0.08], surf: [0.03, 0.07, 0.15], crest: [0.30, 0.38, 0.55],
      },
      {
        grid: { w: 130, d: 58, nx: 150, ny: 80, cx: 0, cy: -38.6 },
        waves: [],
        sources: gateCenters.map((x) => [x, -8.4]),
        k: 1.5, om: 2.4, A: 0.18, decay: 0.05, barrierY: -1000, amax: 0.22,
        sun: [-24, -30, 60],
        deep: [0.04, 0.09, 0.18], surf: [0.10, 0.19, 0.32], crest: [0.72, 0.80, 0.92],
      },
      ...spouts,
    ];

    const vFall = Math.sqrt(2 * 9.81 * head);
    const picks = [
      { name: 'dam', kind: 'dam', label: 'Gravity dam', fields: compactFields([
        ['holds back', `${head} m of head`],
        ['base pressure', `P = ρgh = ${(chain.pressure.base / 1e3).toFixed(0)} kPa`]]) },
      { name: 'gate', kind: 'gate', label: 'Spillway gate', fields: compactFields([
        ['discharge', `${qGate.toFixed(1)} m³/s per gate × ${gates}`],
        ['fall', `v = √(2gH) ≈ ${vFall.toFixed(1)} m/s`]]) },
      { name: 'tailrace', kind: 'tailrace', label: 'Tailrace', fields: compactFields([
        ['each gate', 'a coherent ripple source'],
        ['the churn', 'their interference fan (the double-slit move)']]) },
      { name: 'deck', kind: 'deck', label: 'Crest deck', fields: compactFields([
        ['gates hoisted from here', `${gates} bays`],
        ['spilling', `${flow} m³/s total`]]) },
    ];

    return {
      faces, picks, tracers, movers: [],
      surfaces,
      field: {
        animate: false,
        sets: [],
        lines: [],
        readout: ['Hydroelectric, arc 6 — the SPILLWAY sheds the flood at night',
          `${gates} gates × ${qGate.toFixed(1)} m³/s ≈ ${flow} m³/s past the powerhouse`,
          'reservoir stands AT HEAD behind the wall; every gate mouth is a coherent ripple source',
          'the tailrace churn is their interference fan — the double-slit move, scaled to a dam'],
      },
      span: 70,
    };
  },
};

// deterministic value-noise for the spillway ridge (seeded; no dice).
function hash2(ix, iy) { let h = (ix * 374761393 + iy * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function vnoise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
function fbm2(x, y) { let s = 0, a = 0.5, f = 0.03; for (let o = 0; o < 4; o++) { s += a * vnoise2(x * f + 7, y * f + 3); f *= 2.1; a *= 0.5; } return s; }
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const HYDRO_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into faces + picks + movers + tracers + the field channel. Pure.
 * @returns {{ faces, picks, movers, tracers, fields, bounds, stats }}
 */
export function planHydroScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'dam';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const chain = planHydroChain({ head: recipe.head, flow: recipe.flow });
  const built = SCENARIOS[scenario]({ head: recipe.head, flow: recipe.flow }, chain);

  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = built.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const movers = built.movers.map((mv) => ({ ...mv, pivot: sc(mv.pivot), basePos: sc(mv.basePos) }));
  const tracers = built.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  // spillway carries surface-channel water; lengths scale, times (om) don't, and decay divides
  // (it multiplies a distance) so the ripple pattern is scale-invariant.
  const surfaces = (built.surfaces || []).map((sf) => ({
    ...sf,
    grid: { ...sf.grid, w: sf.grid.w * scale, d: sf.grid.d * scale, cx: (sf.grid.cx || 0) * scale, cy: (sf.grid.cy || 0) * scale, ...(sf.grid.cz ? { cz: sf.grid.cz * scale } : {}) },
    ...(sf.masks ? { masks: sf.masks.map((m) => m.map((v) => v * scale)) } : {}),
    ...(sf.sources ? { sources: sf.sources.map((s) => [s[0] * scale, s[1] * scale]), k: sf.k / scale, decay: sf.decay / scale, A: sf.A * scale, barrierY: sf.barrierY * scale } : {}),
    ...(sf.waves ? { waves: sf.waves.map((w) => ({ ...w, A: w.A * scale, k: w.k / scale })) } : {}),
    ...(sf.spout ? { spout: { ...sf.spout, x0: sf.spout.x0 * scale, x1: sf.spout.x1 * scale, path: sf.spout.path.map((p) => [p[0] * scale, p[1] * scale]), lam: sf.spout.lam * scale, amp: sf.spout.amp * scale, speed: sf.spout.speed * scale } } : {}),
    amax: sf.amax * scale,
  }));
  const fields = [{
    ...built.field,
    sets: built.field.sets.map((st) => ({ ...st, samples: st.samples.map((s) => ({ ...s, pos: sc(s.pos), amp: s.amp * scale })) })),
    lines: built.field.lines.map((ln) => ({ ...ln, pts: ln.pts.map(sc) })),
  }];

  // bounds over faces + arrows + lines + tracers.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; } };
  for (const f of faces) for (const c of f.corners) bump(c);
  for (const st of fields[0].sets) for (const s of st.samples) bump(s.pos);
  for (const ln of fields[0].lines) for (const p of ln.pts) bump(p);
  for (const tr of tracers) for (const p of tr.path) bump(p);
  for (const sf of surfaces) {
    const g = sf.grid, cz = g.cz || 0;
    bump([g.cx - g.w / 2, g.cy - g.d / 2, cz - sf.amax]);
    bump([g.cx + g.w / 2, g.cy + g.d / 2, cz + sf.amax]);
  }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of [mn, mx]) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));
  radius = radius || built.span * scale;

  return {
    faces, picks: built.picks, movers, tracers, fields, surfaces,
    bounds: { center, radius },
    stats: {
      scenario,
      head: chain.spec.head, flow: chain.spec.flow,
      jetV: chain.jet.v, rpm: chain.runner.rpm, omegaRender: movers.length ? movers[0].spin.omega : 0,
      f: chain.generator.f, poles: chain.generator.poles,
      powerMW: { hydraulic: chain.power.hydraulic / 1e6, mech: chain.power.mech / 1e6, elec: chain.power.elec / 1e6 },
      homes: chain.homes,
    },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. Outdoor arcs get daylight; machine-room arcs go
 * dark so the water dots and the EMF wave carry the light. Orbit-only; glow off.
 */
export function assembleHydroScene(recipe = {}, { title } = {}) {
  const plan = planHydroScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.3;
  const scenario = plan.stats.scenario;
  // spillway frames like the photograph it depicts — the ridge needs headroom, so its cameras
  // are authored in world units (× the recipe scale), not derived from the bounds sphere.
  const sScale = clampNum(recipe.scale, 0.2, 5, 1);
  if (scenario === 'spillway') {
    const sv = (v) => v.map((c) => c * sScale);
    return {
      faces: plan.faces,
      picks: plan.picks,
      movers: plan.movers,
      tracers: plan.tracers,
      fields: plan.fields,
      surfaces: plan.surfaces,
      cameras: [
        { name: 'photo', worldFraming: { cameraPosition: sv([12, -54, 13]), lookAt: sv([0, 30, 11]), horizontalFov: 58 } },
        { name: 'aerial', worldFraming: { cameraPosition: sv([0, -66, 42]), lookAt: sv([0, 8, 4]), horizontalFov: 64 } },
        { name: 'side', worldFraming: { cameraPosition: sv([-58, -26, 9]), lookAt: sv([0, -2, 6]), horizontalFov: 62 } },
      ],
      viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
      title: title || recipe.title || 'mojulo hydro spillway',
      bg: (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0d1b36',
      glow: false,
    };
  }
  const cameras = scenario === 'dam' || scenario === 'penstock'
    ? [
        { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.25, center[2] + d * 0.1], lookAt: center, horizontalFov: 46 } },
        { name: '3/4', worldFraming: { cameraPosition: [center[0] + d * 0.5, center[1] - d * 0.9, center[2] + d * 0.45], lookAt: center, horizontalFov: 46 } },
      ]
    : scenario === 'plant'
      ? [
          { name: 'aerial', worldFraming: { cameraPosition: [center[0] + d * 0.35, center[1] - d * 0.95, center[2] + d * 0.55], lookAt: center, horizontalFov: 48 } },
          { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.25, center[2] + d * 0.12], lookAt: center, horizontalFov: 46 } },
        ]
      : [
          { name: 'front', worldFraming: { cameraPosition: [center[0] + d * 0.3, center[1] - d * 1.05, center[2] + d * 0.35], lookAt: center, horizontalFov: 48 } },
          { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.25, center[2] + d * 0.08], lookAt: center, horizontalFov: 46 } },
        ];
  const OUTDOOR = scenario === 'dam' || scenario === 'penstock' || scenario === 'plant';
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : (OUTDOOR ? '#9cc4e8' : '#0b0f16');
  return {
    faces: plan.faces,
    picks: plan.picks,
    movers: plan.movers,
    tracers: plan.tracers,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo hydro ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
