/**
 * fluid-view — a fluid-dynamics depictor, opening with LIFT as the first principle. An airfoil sits
 * in a real POTENTIAL FLOW computed by the Joukowski conformal map, rendered in the traversable
 * three.js World. Lift is not a drawn arrow — it EMERGES: the Kutta condition fixes the circulation
 * Γ, the flow runs faster over the top (lower pressure, Bernoulli), and the net force is
 * Kutta–Joukowski L = ρ·V·Γ.
 *
 * Reuses every existing channel — the new work is the flow SOLVER, not a renderer primitive:
 *   • airfoil      → solid faces (Joukowski profile, extruded along the span)
 *   • streamlines  → the field channel's `lines` (warm where the flow is fast)
 *   • velocity     → the field channel's `sets` (arrows, length ∝ speed, per-sample colour by speed)
 *   • flow         → the tracer channel, sampled at equal TIME so particles speed up over the top
 *   • lift + facts → a static field arrow toward the suction side + a real-relationship readout
 *
 * Stored manifest IS the recipe (geometry regenerated on render):
 *   { kind:'fluid-view', scenario?, angle?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (like field-view / mechanics-view) — no walk, no CSS-3D /scene form.
 */

import { lowerObjectFaces, WORKBENCH_LIGHT } from '../worlds/workbench.js';   // (Stokes spheres)

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── minimal complex arithmetic ([re, im]) ──
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cscale = (a, s) => [a[0] * s, a[1] * s];
const cconj = (a) => [a[0], -a[1]];
const cabs = (a) => Math.hypot(a[0], a[1]);
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1] || 1e-12; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const csqrt = (a) => { const r = cabs(a); const re = Math.sqrt(Math.max(0, (r + a[0]) / 2)); let im = Math.sqrt(Math.max(0, (r - a[0]) / 2)); if (a[1] < 0) im = -im; return [re, im]; };
const cexp_i = (t) => [Math.cos(t), Math.sin(t)];   // e^{it}

const G = 9.8;   // gravity for the hydrostatic scenarios

const lerpColor = (lo, hi, t) => {
  const u = clamp(t, 0, 1);
  return (Math.round(lo[0] + (hi[0] - lo[0]) * u) << 16) | (Math.round(lo[1] + (hi[1] - lo[1]) * u) << 8) | Math.round(lo[2] + (hi[2] - lo[2]) * u);
};
// colour by speed ratio v/U: slow → blue, ~1 → pale, fast → red (the aerodynamic pressure read).
const speedColor = (ratio) => lerpColor([74, 134, 240], [240, 90, 70], (ratio - 0.3) / 1.5);
// colour by hydrostatic depth fraction: shallow → pale cyan, deep → deep blue (higher pressure).
const pressureColor = (depthFrac) => lerpColor([150, 205, 235], [22, 62, 165], depthFrac);

// ── a lathe sphere (Stokes falling balls), via the workbench monomer machinery. ──
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const circleProfile = (R, n = 18) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return { t, radius: R * Math.sin(Math.PI * t) }; });
const sphereSpec = (center, radius, tint, samples = 20) => ({ axisFrom: pt([center[0], center[1], center[2] - radius]), axisTo: pt([center[0], center[1], center[2] + radius]), profile: circleProfile(radius, 18), crossSections: 22, samples, tint });

// ── a solid (or translucent) box as six quads — water bodies, blocks, tank walls. ──
const quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function boxFaces(center, half, fill, group, alpha) {
  const [cx, cy, cz] = center, [hx, hy, hz] = half;
  const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  return [
    quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group, alpha),
    quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group, alpha),
    quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group, alpha),
  ];
}

// ── Joukowski potential flow. a=1; the circle (centre μ, radius R through ζ=a) maps to the airfoil. ──
function makeFlow({ muX, muY, alpha, U }) {
  const a = 1, mu = [muX, muY];
  const R = cabs(csub([a, 0], mu));
  const beta0 = Math.atan2(muY, a - muX);
  const Gamma = 4 * Math.PI * R * U * Math.sin(alpha + beta0);   // Kutta condition
  const eMa = cexp_i(-alpha), ePa = cexp_i(alpha);

  const dWdz_zeta = (zeta) => {                                   // dW/dζ
    const d = csub(zeta, mu);
    const t1 = cscale(eMa, U);
    const t2 = cscale(cdiv(ePa, cmul(d, d)), -U * R * R);
    const t3 = cdiv([0, Gamma / TAU], d);                         // iΓ/(2π(ζ−μ))
    return cadd(cadd(t1, t2), t3);
  };
  const dzdzeta = (zeta) => csub([1, 0], cdiv([a * a, 0], cmul(zeta, zeta)));   // 1 − a²/ζ²
  const map = (zeta) => cadd(zeta, cdiv([a * a, 0], zeta));                     // z = ζ + a²/ζ
  // physical flow velocity (u, v) = conj(dW/dζ ÷ dz/dζ)
  const velAtZeta = (zeta) => cconj(cdiv(dWdz_zeta(zeta), dzdzeta(zeta)));
  // inverse map: ζ = (z ± √(z²−4a²))/2, take the root OUTSIDE the circle; null if inside the body.
  const invMap = (z) => {
    const w = csqrt(csub(cmul(z, z), [4 * a * a, 0]));
    const z1 = cscale(cadd(z, w), 0.5), z2 = cscale(csub(z, w), 0.5);
    const zeta = cabs(csub(z1, mu)) >= cabs(csub(z2, mu)) ? z1 : z2;
    return cabs(csub(zeta, mu)) >= R * 1.02 ? zeta : null;
  };
  const velAtZ = (z) => { const zt = invMap(z); return zt ? velAtZeta(zt) : null; };
  // airfoil outline = image of the circle.
  const outline = Array.from({ length: 121 }, (_, i) => map(cadd(mu, cscale(cexp_i(TAU * (i / 120)), R))));
  return { a, mu, R, beta0, Gamma, U, map, velAtZ, outline };
}

// integrate one streamline downstream from a physical seed; return { pts, speeds } (a-units).
function streamline(flow, seed, { ds = 0.04, maxSteps = 620, xMax = 5.4, zMax = 3.2 }) {
  const pts = [], speeds = [];
  let z = seed;
  for (let i = 0; i < maxSteps; i++) {
    const v = flow.velAtZ(z); if (!v) break;
    const sp = cabs(v); if (sp < 1e-4) break;
    pts.push(z); speeds.push(sp);
    z = cadd(z, cscale(v, ds / sp));            // step ds along the flow direction
    if (z[0] > xMax || Math.abs(z[1]) > zMax) { pts.push(z); speeds.push(sp); break; }
  }
  return { pts, speeds };
}

// resample a streamline to EQUAL TIME (dt) using per-vertex speed → the tracer particle then speeds
// up where the flow is fast (faster over the top). Speed floored so stagnation doesn't stall forever.
function resampleEqualTime(pts, speeds, dt) {
  const tCum = [0];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = cabs(csub(pts[i + 1], pts[i])), sp = Math.max(0.12, (speeds[i] + speeds[i + 1]) / 2);
    tCum.push(tCum[i] + seg / sp);
  }
  const T = tCum[tCum.length - 1]; if (!(T > 0)) return null;
  const n = Math.max(8, Math.round(T / dt)), out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * T;
    while (j < tCum.length - 2 && tCum[j + 1] < t) j++;
    const span = tCum[j + 1] - tCum[j] || 1e-6, f = clamp((t - tCum[j]) / span, 0, 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
  }
  return out;
}

// ── superposed potential-flow wind from point "spiral" emitters (source + vortex): Gyro's two balls ──
function makeWindField(emitters) {
  const E = emitters.map((e) => ({ p: [e.x, e.y], S: e.gust || 0, K: e.spin || 0, r2min: (e.r || 0.5) ** 2 }));
  const velAt = (q) => {
    let vx = 0, vy = 0;
    for (const e of E) {
      const dx = q[0] - e.p[0], dy = q[1] - e.p[1];
      const r2 = Math.max(e.r2min, dx * dx + dy * dy);
      const cs = e.S / TAU / r2, cv = e.K / TAU / r2;
      vx += cs * dx - cv * dy;     // source (radial out) + vortex (tangential, CCW for K>0)
      vy += cs * dy + cv * dx;
    }
    return [vx, vy];
  };
  return { velAt };
}

// integrate a tracer through an arbitrary 2-D field; returns { pts, speeds } (flow-units).
function traceField(velAt, seed, { ds = 0.06, maxSteps = 260, rMax = 5.4 } = {}) {
  const pts = [], speeds = [];
  let q = seed;
  for (let i = 0; i < maxSteps; i++) {
    const v = velAt(q); const sp = Math.hypot(v[0], v[1]); if (sp < 1e-4) break;
    pts.push(q); speeds.push(sp);
    q = [q[0] + v[0] * ds / sp, q[1] + v[1] * ds / sp];
    if (Math.hypot(q[0], q[1]) > rMax) { pts.push(q); speeds.push(sp); break; }
  }
  return { pts, speeds };
}

const compactFields = (pairs) => pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));

// extrude a 2-D outline (in the x–z plane, points [re, im]) along the span (±yHalf) into a wing.
function extrudeAirfoil(outline2d, SC, yHalf, fill, group) {
  const ring = outline2d.map((p) => [p[0] * SC, p[1] * SC]);
  const faces = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const A = ring[i], B = ring[i + 1];
    faces.push({ corners: [[A[0], -yHalf, A[1]], [B[0], -yHalf, B[1]], [B[0], yHalf, B[1]], [A[0], yHalf, A[1]]], fill, group });
  }
  const cap = (y) => ({ corners: ring.slice(0, -1).map((p) => [p[0], y, p[1]]), fill, group });
  faces.push(cap(-yHalf)); faces.push(cap(yHalf));
  return faces;
}

// extrude a 2-D outline (in the HORIZONTAL x–y plane, points [re, im]) UP the mast (z: zLo→zHi): a sail.
function extrudeSail(outline2d, SC, zLo, zHi, fill, group) {
  const ring = outline2d.map((p) => [p[0] * SC, p[1] * SC]);
  const faces = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const A = ring[i], B = ring[i + 1];
    faces.push({ corners: [[A[0], A[1], zLo], [B[0], B[1], zLo], [B[0], B[1], zHi], [A[0], A[1], zHi]], fill, group });
  }
  const cap = (z) => ({ corners: ring.slice(0, -1).map((p) => [p[0], p[1], z]), fill, group });
  faces.push(cap(zLo)); faces.push(cap(zHi));
  return faces;
}

const SC = 4;            // render scale (a-units → world units)
const Y_HALF = 4;        // half-span of the extruded wing

const SCENARIOS = {
  // an airfoil in potential flow — lift emerges from the Kutta circulation.
  airfoil(P) {
    const alpha = clampNum(P.angle, -8, 16, 6) * DEG;
    const flow = makeFlow({ muX: -0.1, muY: 0.08, alpha, U: 1 });

    // streamlines from upstream seeds (skip the dividing seed so none impales the stagnation point).
    const seeds = [];
    for (let y = -2.6; y <= 2.6; y += 0.34) if (Math.abs(y) > 0.04) seeds.push([-3.2, y]);
    const streams = seeds.map((s) => streamline(flow, s, {})).filter((sl) => sl.pts.length > 8);

    const lines = streams.map((sl) => ({
      pts: sl.pts.map((z) => [z[0] * SC, 0, z[1] * SC]),
      color: speedColor(Math.max(...sl.speeds) / flow.U), opacity: 0.5,
    }));
    const tracers = streams.map((sl) => {
      const rs = resampleEqualTime(sl.pts, sl.speeds, 0.05); if (!rs) return null;
      return { path: rs.map((z) => [z[0] * SC, 0, z[1] * SC]), color: [210, 226, 255], size: 0.5, period: Math.max(2.5, rs.length * 0.05), trail: 6, trailLag: 0.004 };
    }).filter(Boolean);

    // velocity arrows on a grid (skip inside the body); coloured + sized by speed.
    const arrows = [];
    let topSpeed = flow.U, vTop = 0, vBot = 0;
    for (let x = -2.8; x <= 5.0; x += 0.7) for (let zz = -2.6; zz <= 2.6; zz += 0.7) {
      const v = flow.velAtZ([x, zz]); if (!v) continue;
      const sp = cabs(v); const dir = cscale(v, 1 / sp);
      arrows.push({ pos: [x * SC, 0, zz * SC], dir: [dir[0], 0, dir[1]], amp: clamp(sp / flow.U * 1.4, 0.4, 2.6), color: speedColor(sp / flow.U) });
      if (Math.abs(x) < 1) { if (zz > 0.4) { vTop = Math.max(vTop, sp); topSpeed = Math.max(topSpeed, sp); } else if (zz < -0.4) vBot = Math.max(vBot, sp); }
    }

    // lift arrow at ~quarter-chord, toward the suction (faster) side; length ∝ |Γ|.
    const suctionUp = vTop >= vBot;
    const liftLen = clamp(Math.abs(flow.Gamma) / (4 * Math.PI) * 5, 0.6, 4.5);
    const liftArrow = { color: 0xffe066, curve: false, samples: [{ pos: [-1.0 * SC, 0, (suctionUp ? 0.2 : -0.2) * SC], dir: [0, 0, suctionUp ? 1 : -1], amp: liftLen }] };

    const faces = extrudeAirfoil(flow.outline, SC, Y_HALF, '#cdd2db', 'airfoil');
    const picks = [{ name: 'airfoil', kind: 'airfoil', label: 'Airfoil', fields: compactFields([
      ['α (angle of attack)', `${Math.round(alpha / DEG)}°`], ['Γ (circulation)', flow.Gamma.toFixed(2)],
      ['top speed', `${(vTop / flow.U).toFixed(2)}·V∞`], ['lift', 'L = ρ·V·Γ'],
    ]) }];

    return {
      faces, picks, tracers,
      field: {
        animate: false,
        sets: [{ color: 0x9fb2c8, curve: false, samples: arrows }, liftArrow],
        lines,
        readout: ['Airfoil — potential flow (Joukowski)', `α = ${Math.round(alpha / DEG)}°`,
          `Γ = ${flow.Gamma.toFixed(2)} (Kutta condition)`, `top speed ≈ ${(vTop / flow.U).toFixed(2)}·V∞ → lower pressure`, 'lift L = ρ·V·Γ'],
      },
      span: 6 * SC,
      stats: { Gamma: flow.Gamma, alphaDeg: alpha / DEG, topRatio: vTop / flow.U, R: flow.R, beta0: flow.beta0 },
    };
  },

  // SAIL (Bernoulli, the counterintuitive case) — a sail IS a vertical airfoil. The same Joukowski
  // potential flow gives lift perpendicular to the APPARENT wind; the keel then resolves it. Because
  // the boat's heading points up INTO the wind, that sideways lift has a forward component along the
  // hull → the boat is driven to WINDWARD ("propelled by the headwind"). The leftover sideways
  // component (heel/leeway) is cancelled by the keel. The airfoil section lies in the horizontal x–y
  // plane (mast = +z); `angle` is the POINT OF SAIL β (apparent-wind angle off the bow), trim α fixed.
  sail(P) {
    const TRIM = 16 * DEG;                                   // sail angle of attack to the apparent wind
    const beta = clampNum(P.angle, 20, 90, 42) * DEG;       // point of sail (off the bow) — the knob
    const flow = makeFlow({ muX: -0.02, muY: 0.13, alpha: TRIM, U: 1 });   // thin, well-cambered

    const ZF = 5;                                            // flow slice height (mid-mast)
    const PF = (z) => [z[0] * SC, z[1] * SC, ZF];           // map flow 2-D (re→x, im→y) into the slice

    // apparent-wind streamlines + flow particles (they speed up over the lee / suction side).
    const seeds = [];
    for (let y = -2.6; y <= 2.6; y += 0.34) if (Math.abs(y) > 0.04) seeds.push([-3.2, y]);
    const streams = seeds.map((s) => streamline(flow, s, {})).filter((sl) => sl.pts.length > 8);
    const lines = streams.map((sl) => ({ pts: sl.pts.map(PF), color: speedColor(Math.max(...sl.speeds) / flow.U), opacity: 0.5 }));
    const tracers = streams.map((sl) => {
      const rs = resampleEqualTime(sl.pts, sl.speeds, 0.05); if (!rs) return null;
      return { path: rs.map(PF), color: [210, 226, 255], size: 0.5, period: Math.max(2.5, rs.length * 0.05), trail: 6, trailLag: 0.004 };
    }).filter(Boolean);

    // velocity grid (the apparent wind), per-sample colour by speed; track lee vs windward speed.
    const arrows = [];
    let vLee = flow.U, vWind = 0;
    for (let x = -2.8; x <= 5.0; x += 0.7) for (let yy = -2.6; yy <= 2.6; yy += 0.7) {
      const v = flow.velAtZ([x, yy]); if (!v) continue;
      const sp = cabs(v), dir = cscale(v, 1 / sp);
      arrows.push({ pos: PF([x, yy]), dir: [dir[0], dir[1], 0], amp: clamp(sp / flow.U * 1.4, 0.4, 2.6), color: speedColor(sp / flow.U) });
      if (Math.abs(x) < 1) { if (yy > 0.4) vLee = Math.max(vLee, sp); else if (yy < -0.4) vWind = Math.max(vWind, sp); }
    }

    // FORCE RESOLUTION. Lift ⟂ apparent wind (+y). Heading Ĥ points up into the wind (β off the
    // dead-upwind axis, −x). Drive = lift·Ĥ along the hull; the rest is heel/leeway, resisted by the
    // keel. Drive ∝ sin β; the upwind velocity-made-good ∝ sin β·cos β = ½ sin 2β (peaks at β = 45°).
    const H = [-Math.cos(beta), Math.sin(beta), 0];         // boat course (unit)
    const SIDE = [Math.sin(beta), Math.cos(beta), 0];       // heel / leeway direction (unit, ⟂ Ĥ)
    const L = clamp(Math.abs(flow.Gamma) / (4 * Math.PI) * 6, 1.0, 5.0);   // total aero force (render length)
    const drive = L * Math.sin(beta), heel = L * Math.cos(beta);
    const aero = [0, 0.2 * SC, ZF];                         // ~quarter-chord force anchor
    const keelAt = [0, 0, -2.8];
    const forces = [
      { pos: aero, dir: [0, 1, 0], amp: L, color: 0xffe066 },                    // total lift (⟂ wind)
      { pos: aero, dir: H, amp: drive, color: 0x66dd99 },                        // DRIVE (forward → windward)
      { pos: aero, dir: SIDE, amp: heel, color: 0xff7a4d },                      // heel / leeway (sideways)
      { pos: keelAt, dir: [-SIDE[0], -SIDE[1], 0], amp: heel, color: 0x4d8cff }, // keel reaction (resists leeway)
    ];
    const wind = [{ pos: [-3.4 * SC, 2.2 * SC, ZF], dir: [1, 0, 0], amp: 3.2, color: 0xaeb8c6 }];   // apparent wind

    // the boat's course, drawn as a heading line through the rig.
    const Hlen = 3.4 * SC;
    const headingLine = { pts: [[aero[0] - H[0] * Hlen, aero[1] - H[1] * Hlen, 0.2 * SC], [aero[0] + H[0] * Hlen, aero[1] + H[1] * Hlen, 0.2 * SC]], color: 0xc8d2e1, opacity: 0.85 };

    // geometry: the sail (vertical airfoil), a slender hull along the course, a keel fin below it.
    const faces = extrudeSail(flow.outline, SC, 0, 10, '#e6e9ef', 'sail');
    const theta = Math.PI - beta;                           // hull yaw (bow toward −x, turned by β)
    const ct = Math.cos(theta), st = Math.sin(theta);
    const HULL = 2.0, zDeck = -0.6;
    const hullLocal = [[3, 0], [1.2, 0.55], [-2.2, 0.5], [-2.6, 0], [-2.2, -0.5], [1.2, -0.55]];
    const deck = { corners: hullLocal.map(([px, py]) => { const X = px * HULL, Y = py * HULL; return [X * ct - Y * st, X * st + Y * ct, zDeck]; }), fill: '#7c5a3a', group: 'hull' };
    const kh = 2.6, kbot = -5;
    const kf = [H[0] * kh, H[1] * kh], ka = [-H[0] * kh, -H[1] * kh];
    const keel = { corners: [[ka[0], ka[1], zDeck], [kf[0], kf[1], zDeck], [kf[0], kf[1], kbot], [ka[0], ka[1], kbot]], fill: '#5b6470', group: 'keel' };
    faces.push(deck, keel);

    const inNoGo = beta < 30 * DEG;
    const picks = [{ name: 'sail', kind: 'sail', label: 'Sail', fields: compactFields([
      ['point of sail', `${Math.round(beta / DEG)}° off the wind`], ['Γ (circulation)', flow.Gamma.toFixed(2)],
      ['trim α', `${Math.round(TRIM / DEG)}°`], ['drive', `${Math.sin(beta).toFixed(2)}·L (along the hull)`],
      ['lee speed', `${(vLee / flow.U).toFixed(2)}·V`],
    ]) }];

    return {
      faces, picks, tracers,
      field: {
        animate: false,
        sets: [
          { color: 0x9fb2c8, curve: false, samples: arrows },
          { color: 0xffffff, curve: false, samples: forces },
          { color: 0xaeb8c6, curve: false, samples: wind },
        ],
        lines: [...lines, headingLine],
        readout: ['Sail — lift drives the boat to windward',
          `point of sail β = ${Math.round(beta / DEG)}° off the apparent wind`,
          `Γ = ${flow.Gamma.toFixed(2)} (Kutta), trim α = ${Math.round(TRIM / DEG)}°`,
          'lift ⟂ wind → DRIVE (green) along the hull + HEEL (orange) the keel resists (blue)',
          'drive ∝ sin β · upwind VMG ∝ sin 2β (best ≈ 45°)',
          inNoGo ? 'near the NO-GO zone — pinching, drive collapses toward zero' : 'the flow shown is the APPARENT wind (true wind + the boat’s own motion)'],
      },
      span: 12 * SC,
      stats: { Gamma: flow.Gamma, betaDeg: beta / DEG, trimDeg: TRIM / DEG, drive, vmg: drive * Math.cos(beta), heel, topRatio: vLee / flow.U, L },
    };
  },

  // SPIN-SAIL ("Gyro Zeppeli") — the wind is not a uniform freestream: it is CONJURED, summed from two
  // arbitrary point emitters (Gyro's two spinning steel balls — each a potential-flow VORTEX, the Spin,
  // optionally with a source "gust"). Counter-rotating, they fling a JET of wind out between them; a
  // sail set in that jet develops lift ⟂ the LOCAL wind via the same Kutta circulation. The wind field
  // is the EXACT superposition of the two singularities; the sail reads the wind it locally sees.
  'spin-sail'(P) {
    const TRIM = clampNum(P.angle, 4, 24, 16) * DEG;        // sail angle of attack to the local wind
    const spin = clampNum(P.spin, 0, 24, 6);                // |Spin| of each steel ball (vortex strength)
    const def = [{ x: -1.6, y: 1.1, spin: +spin, gust: 0 }, { x: -1.6, y: -1.1, spin: -spin, gust: 0 }];
    const emitters = (Array.isArray(P.emitters) && P.emitters.length >= 2)
      ? P.emitters.slice(0, 2).map((e, i) => ({ x: clampNum(e.x, -4, 4, def[i].x), y: clampNum(e.y, -4, 4, def[i].y), spin: clampNum(e.spin, -24, 24, def[i].spin), gust: clampNum(e.gust, -12, 12, 0), r: 0.5 }))
      : def.map((e) => ({ ...e, r: 0.5 }));
    const wind = makeWindField(emitters);

    const ZF = 5;
    const PF = (q) => [q[0] * SC, q[1] * SC, ZF];

    const sailAt = [1.4, 0];
    const Wv = wind.velAt(sailAt);
    const U = Math.hypot(Wv[0], Wv[1]) || 1e-3;             // local apparent-wind speed at the sail
    const phi = Math.atan2(Wv[1], Wv[0]);                   // local wind direction
    const Uref = U;                                          // colour/length reference = the jet at the sail

    // sail geometry (Joukowski profile), rotated so its chord meets the local wind at trim α.
    const prof = makeFlow({ muX: -0.02, muY: 0.13, alpha: 0, U: 1 });
    const R = prof.R, beta0 = prof.beta0;
    const Gamma = 4 * Math.PI * R * U * Math.sin(TRIM + beta0);   // Kutta circulation from the local wind
    const L = clamp(U * Gamma * 11, 0.8, 5);                       // lift render length (L = ρ·U·Γ)
    const cr = Math.cos(phi), sr = Math.sin(phi);                  // align chord (+x) with the wind
    const place = (p) => [sailAt[0] + (p[0] * cr - p[1] * sr), sailAt[1] + (p[0] * sr + p[1] * cr)];
    const faces = extrudeSail(prof.outline.map(place), SC, 0, 10, '#e6e9ef', 'sail');

    // the two steel balls (spheres in the flow plane).
    emitters.forEach((e, i) => {
      faces.push(...lowerObjectFaces({ lathes: [sphereSpec([e.x * SC, e.y * SC, ZF], e.r * SC * 0.9, '#aab0ba', 18)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group: `ball:${i}` })));
    });

    // wind field — arrows on a grid (skip inside a ball), speed-coloured by the jet reference.
    const arrows = [];
    for (let x = -3.4; x <= 4.4; x += 0.6) for (let y = -3.0; y <= 3.0; y += 0.6) {
      let inside = false; for (const e of emitters) if (Math.hypot(x - e.x, y - e.y) < e.r * 1.1) inside = true;
      if (inside) continue;
      const v = wind.velAt([x, y]); const sp = Math.hypot(v[0], v[1]); if (sp < 1e-4) continue;
      arrows.push({ pos: PF([x, y]), dir: [v[0] / sp, v[1] / sp, 0], amp: clamp(sp / Uref * 1.2, 0.35, 2.4), color: speedColor(sp / Uref) });
    }

    // spiraling dust motes (the Spin made visible): seeds ring each ball + a rake upstream of the sail.
    const seeds = [];
    emitters.forEach((e) => { for (let k = 0; k < 6; k++) { const t = TAU * k / 6; seeds.push([e.x + Math.cos(t) * 0.9, e.y + Math.sin(t) * 0.9]); } });
    for (let y = -2.2; y <= 2.2; y += 0.7) seeds.push([-3.2, y]);
    const traces = seeds.map((s) => traceField(wind.velAt, s, {})).filter((t) => t.pts.length > 6);
    const lines = traces.map((t) => ({ pts: t.pts.map(PF), color: speedColor(Math.max(...t.speeds) / Uref), opacity: 0.4 }));
    const tracers = traces.map((t) => {
      const rs = resampleEqualTime(t.pts, t.speeds, 0.06); if (!rs) return null;
      return { path: rs.map(PF), color: [214, 226, 255], size: 0.42, period: Math.max(2.4, rs.length * 0.06), trail: 6, trailLag: 0.004 };
    }).filter(Boolean);

    // forces & reads: lift ⟂ local wind, a local-wind arrow at the sail, a spin hint on each ball.
    const liftDir = [Math.cos(phi + Math.PI / 2), Math.sin(phi + Math.PI / 2), 0];
    const forces = [
      { pos: PF([sailAt[0], sailAt[1] + 0.1]), dir: liftDir, amp: L, color: 0xffe066 },     // lift (⟂ wind)
      { pos: PF([sailAt[0] - 0.9 * cr, sailAt[1] - 0.9 * sr]), dir: [cr, sr, 0], amp: clamp(U / Uref * 1.6, 0.6, 2.4), color: 0xaeb8c6 },  // local wind
    ];
    const spinArrows = emitters.map((e) => {
      const sgn = e.spin >= 0 ? 1 : -1;       // CCW (+) → tangential nudge at the top of the ball
      return { pos: PF([e.x, e.y + e.r * 1.1]), dir: [-sgn, 0, 0], amp: clamp(Math.abs(e.spin) / 8, 0.4, 1.6), color: 0xff7a4d };
    });

    const picks = [
      { name: 'sail', kind: 'sail', label: 'Sail', fields: compactFields([['local wind', `${(U / Uref).toFixed(2)}·U_jet @ ${Math.round(phi / DEG)}°`], ['Γ (Kutta)', Gamma.toFixed(2)], ['trim α', `${Math.round(TRIM / DEG)}°`], ['lift', 'L = ρ·U·Γ']]) },
      ...emitters.map((e, i) => ({ name: `ball:${i}`, kind: 'ball', label: `Steel ball ${i + 1}`, fields: compactFields([['spin Γ', e.spin.toFixed(1)], ['gust', e.gust ? e.gust.toFixed(1) : '0'], ['at', `(${e.x.toFixed(1)}, ${e.y.toFixed(1)})`]]) })),
    ];

    return {
      faces, picks, tracers,
      field: {
        animate: false,
        sets: [
          { color: 0x9fb2c8, curve: false, samples: arrows },
          { color: 0xffffff, curve: false, samples: forces },
          { color: 0xff7a4d, curve: false, samples: spinArrows },
        ],
        lines,
        readout: ['Spin-sail — wind conjured from two points (Gyro Zeppeli)',
          'two spinning steel balls = two potential-flow vortices (the Spin)',
          'counter-rotating, they fling a JET of wind out between them',
          `the sail reads the LOCAL wind (${(U / Uref).toFixed(2)}·U_jet) → lift via Kutta Γ = ${Gamma.toFixed(2)}`,
          'wind = EXACT superposition of the two singularities; sail lift from the local sample'],
      },
      span: 12 * SC,
      stats: { Gamma, U, phiDeg: phi / DEG, L, spin, emitters: emitters.map((e) => [e.x, e.y, e.spin]) },
    };
  },

  // ROTOR-SAIL (Magnus / Flettner) — "Gyro's balls behind him, a headwind in front." Spinning balls in
  // a real headwind are MAGNUS rotors: the freestream + the spin's circulation give EACH ball a force
  // ρ·U∞·Γ ⟂ to the wind (the same Kutta–Joukowski law, now from SPIN not camber). When the wind is off
  // the bow that sideways force has a FORWARD component the keel resolves into drive — so the spin
  // drives you forward INTO a headwind (this is how Flettner rotor ships sail). Honest caveats: dead
  // into the wind still gives zero drive (the force is ⟂ the wind), the two balls must spin the SAME
  // sense or their forces cancel, and the two-ball flow is point-vortex superposition.
  'rotor-sail'(P) {
    const beta = clampNum(P.angle, 15, 80, 42) * DEG;       // headwind angle off the bow
    const spin = clampNum(P.spin, 0.5, 24, 6);              // |Γ| of each ball (same sense → forces add)
    const Uinf = 1;
    const Wdir = [-Math.cos(beta), Math.sin(beta)];         // headwind blows toward the boat, from off the bow
    const Uvec = [Wdir[0] * Uinf, Wdir[1] * Uinf];
    const def = [{ x: -1.8, y: 1.0, spin, gust: 0 }, { x: -1.8, y: -1.0, spin, gust: 0 }];   // balls AFT, same spin
    const emitters = (Array.isArray(P.emitters) && P.emitters.length >= 2)
      ? P.emitters.slice(0, 2).map((e, i) => ({ x: clampNum(e.x, -4, 4, def[i].x), y: clampNum(e.y, -4, 4, def[i].y), spin: clampNum(e.spin, -24, 24, def[i].spin), gust: clampNum(e.gust, -12, 12, 0), r: 0.5 }))
      : def.map((e) => ({ ...e, r: 0.5 }));
    const wf = makeWindField(emitters);
    const velAt = (q) => { const v = wf.velAt(q); return [v[0] + Uvec[0], v[1] + Uvec[1]]; };

    const ZF = 5, PF = (q) => [q[0] * SC, q[1] * SC, ZF];

    // MAGNUS force on each ball = ρ·U∞·Γ ⟂ to the wind (KJ). For this vortex convention (Γ>0 = CCW) the
    // force is the wind rotated CLOCKWISE, scaled by the signed spin; same-sense balls add.
    const rotCW = (v) => [v[1], -v[0]];
    const Funit = rotCW(Wdir);                              // force direction for a unit positive spin
    let Fx = 0, Fy = 0, M = 0;
    const ballForces = emitters.map((e) => {
      const mag = Uinf * e.spin;                            // ρ = 1; sign carried by the spin
      const f = [Funit[0] * mag, Funit[1] * mag]; Fx += f[0]; Fy += f[1]; M += Math.abs(mag);
      return { e, f, mag };
    });
    const drive = Fx, heel = Fy;                            // heading is +x → drive = Fx, heel = Fy
    const GAIN = 0.7;
    const lenOf = (val) => clamp(Math.abs(val) * GAIN, 0.4, 5);

    // speed asymmetry near a ball (the Magnus / Bernoulli read): faster on the force side → lower pressure.
    const probe = emitters[0], s = probe.r * 1.6, ps = Math.sign(probe.spin) || 1;
    const fd = [Funit[0] * ps, Funit[1] * ps];             // this ball's force side
    const spFast = Math.hypot(...velAt([probe.x + fd[0] * s, probe.y + fd[1] * s]));
    const spSlow = Math.hypot(...velAt([probe.x - fd[0] * s, probe.y - fd[1] * s]));

    // wind field — arrows on a grid (skip inside a ball), speed-coloured (Magnus asymmetry shows here).
    const arrows = [];
    for (let x = -3.8; x <= 4.4; x += 0.6) for (let y = -3.0; y <= 3.0; y += 0.6) {
      let inside = false; for (const e of emitters) if (Math.hypot(x - e.x, y - e.y) < e.r * 1.1) inside = true;
      if (inside) continue;
      const v = velAt([x, y]); const sp = Math.hypot(v[0], v[1]); if (sp < 1e-4) continue;
      arrows.push({ pos: PF([x, y]), dir: [v[0] / sp, v[1] / sp, 0], amp: clamp(sp / Uinf * 1.1, 0.35, 2.4), color: speedColor(sp / Uinf) });
    }

    // streamlines + flow particles, seeded across the incoming headwind (front) and around the balls.
    const seeds = [];
    for (let t = -3.0; t <= 3.0; t += 0.55) seeds.push([4.2, t]);     // the headwind, coming from ahead
    emitters.forEach((e) => { for (let k = 0; k < 5; k++) { const a = TAU * k / 5; seeds.push([e.x + Math.cos(a) * 0.85, e.y + Math.sin(a) * 0.85]); } });
    const traces = seeds.map((sd) => traceField(velAt, sd, { ds: 0.06, maxSteps: 300 })).filter((t) => t.pts.length > 6);
    const lines = traces.map((t) => ({ pts: t.pts.map(PF), color: speedColor(Math.max(...t.speeds) / Uinf), opacity: 0.4 }));
    const tracers = traces.map((t) => {
      const rs = resampleEqualTime(t.pts, t.speeds, 0.06); if (!rs) return null;
      return { path: rs.map(PF), color: [214, 226, 255], size: 0.42, period: Math.max(2.4, rs.length * 0.06), trail: 6, trailLag: 0.004 };
    }).filter(Boolean);

    // geometry: the boat (hull along +x, into the wind) + keel; the two balls AFT (behind).
    const faces = [];
    const HULL = 2.0, zDeck = -0.6;
    const hullLocal = [[3, 0], [1.2, 0.55], [-2.2, 0.5], [-2.6, 0], [-2.2, -0.5], [1.2, -0.55]];
    faces.push({ corners: hullLocal.map(([px, py]) => [px * HULL, py * HULL, zDeck]), fill: '#7c5a3a', group: 'hull' });
    const kh = 2.6, kbot = -5;
    faces.push({ corners: [[-kh, 0, zDeck], [kh, 0, zDeck], [kh, 0, kbot], [-kh, 0, kbot]], fill: '#5b6470', group: 'keel' });
    emitters.forEach((e, i) => {
      faces.push(...lowerObjectFaces({ lathes: [sphereSpec([e.x * SC, e.y * SC, ZF], e.r * SC * 0.9, '#aab0ba', 18)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group: `ball:${i}` })));
    });

    // force diagram: per-ball Magnus arrows, total DRIVE (forward), HEEL, keel reaction; spin + headwind hints.
    const forces = [
      ...ballForces.map(({ e, f }) => { const m = Math.hypot(f[0], f[1]) || 1; return { pos: PF([e.x, e.y]), dir: [f[0] / m, f[1] / m, 0], amp: lenOf(Math.hypot(f[0], f[1])), color: 0xffe066 }; }),   // Magnus per ball
      { pos: PF([0.4, 0]), dir: [1, 0, 0], amp: lenOf(drive), color: 0x66dd99 },                 // DRIVE (forward, into the wind)
      { pos: PF([0.4, 0]), dir: [0, heel >= 0 ? 1 : -1, 0], amp: lenOf(heel), color: 0xff7a4d }, // heel / leeway
      { pos: [0, 0, -2.8], dir: [0, heel >= 0 ? -1 : 1, 0], amp: lenOf(heel), color: 0x4d8cff }, // keel reaction
    ];
    const spinArrows = emitters.map((e) => ({ pos: PF([e.x, e.y + e.r * 1.1]), dir: [e.spin >= 0 ? -1 : 1, 0, 0], amp: clamp(Math.abs(e.spin) / 8, 0.4, 1.6), color: 0xff7a4d }));
    const windHints = [];
    for (const y of [-1.8, 0, 1.8]) windHints.push({ pos: PF([4.2, y]), dir: [Wdir[0], Wdir[1], 0], amp: 2.4, color: 0xaeb8c6 });

    const inNoGo = beta < 25 * DEG;
    const picks = [
      { name: 'hull', kind: 'hull', label: 'Hull', fields: compactFields([['heading', 'into the headwind (+x)'], ['drive', drive.toFixed(2)], ['Magnus law', 'F = ρ·U∞·Γ']]) },
      ...emitters.map((e, i) => ({ name: `ball:${i}`, kind: 'ball', label: `Steel ball ${i + 1}`, fields: compactFields([['spin Γ', e.spin.toFixed(1)], ['Magnus |F|', Math.abs(Uinf * e.spin).toFixed(2)], ['at', `(${e.x.toFixed(1)}, ${e.y.toFixed(1)}) — aft`]]) })),
    ];

    return {
      faces, picks, tracers,
      field: {
        animate: false,
        sets: [
          { color: 0x9fb2c8, curve: false, samples: arrows },
          { color: 0xffffff, curve: false, samples: forces },
          { color: 0xff7a4d, curve: false, samples: spinArrows },
          { color: 0xaeb8c6, curve: false, samples: windHints },
        ],
        lines,
        readout: ['Rotor-sail — the Magnus effect (Flettner)',
          'spinning balls behind + a real headwind ahead',
          `headwind β = ${Math.round(beta / DEG)}° off the bow; each ball: F = ρ·U∞·Γ ⟂ the wind`,
          'same-sense spin → forces ADD → forward DRIVE (green) the keel resolves (blue)',
          inNoGo ? 'near the no-go zone — drive collapses (the force is ⟂ the wind)' : `faster on the force side (${(spFast / Uinf).toFixed(2)}·U∞ vs ${(spSlow / Uinf).toFixed(2)}) → lower pressure`],
      },
      span: 12 * SC,
      stats: { drive, heel, vmg: drive * Math.cos(beta), M, betaDeg: beta / DEG, spin, fastRatio: spFast / Uinf, slowRatio: spSlow / Uinf, emitters: emitters.map((e) => [e.x, e.y, e.spin]) },
    };
  },

  // BUOYANCY (Archimedes) — a block in water. The bottom face sits deeper than the top, so the
  // upward pressure on it EXCEEDS the downward pressure on the top: that imbalance IS the buoyant
  // force. A float settles where buoyancy = weight; a denser body sinks. Object density is the knob.
  buoyancy(P) {
    const rho = clampNum(P.density, 0.05, 6, 0.6);       // object density relative to water (ρ_water = 1)
    const H = 12, halfW = 9, halfY = 5;
    const water = boxFaces([0, 0, -H / 2], [halfW, halfY, H / 2], '#2d6fb0', 'water', 0.18);
    const bw = 2.6, bd = 2.6, bh = 2.2;                  // block half-extents (x, y, z)
    const floats = rho < 0.999;
    const f = floats ? rho : 1;                          // submerged fraction (Archimedes: f = ρ for a floater)
    const subH = f * (2 * bh);
    const zTop = floats ? (2 * bh - subH) : (-H + 2 * bh);   // at the waterline, or resting on the bottom
    const zc = zTop - bh;
    const block = boxFaces([0, 0, zc], [bw, bd, bh], floats ? '#c98b4a' : '#9aa3ad', 'block');

    const zBot = zc - bh, zTopF = zc + bh;
    const ampOf = (z) => clamp(0.3 + 1.7 * (-z) / H, 0.3, 1.9);
    const pcol = (z) => pressureColor((-z) / H);
    const surf = [];
    // bottom face: upward pressure (deepest → longest).
    if (zBot < 0) for (const x of [-bw * 0.6, 0, bw * 0.6]) for (const y of [-bd * 0.5, bd * 0.5]) surf.push({ pos: [x, y, zBot], dir: [0, 0, 1], amp: ampOf(zBot), color: pcol(zBot) });
    // top face (only if submerged): downward pressure (shorter).
    if (zTopF < 0) for (const x of [-bw * 0.6, 0, bw * 0.6]) for (const y of [-bd * 0.5, bd * 0.5]) surf.push({ pos: [x, y, zTopF], dir: [0, 0, -1], amp: ampOf(zTopF), color: pcol(zTopF) });
    // side faces: inward pressure, growing with depth (they cancel horizontally).
    const zLo = Math.max(zBot, -H), zHi = Math.min(zTopF, 0);
    if (zHi > zLo) for (let k = 0; k < 3; k++) { const z = zLo + (zHi - zLo) * ((k + 0.5) / 3); surf.push({ pos: [bw, 0, z], dir: [-1, 0, 0], amp: ampOf(z), color: pcol(z) }); surf.push({ pos: [-bw, 0, z], dir: [1, 0, 0], amp: ampOf(z), color: pcol(z) }); }

    const V = (2 * bw) * (2 * bd) * (2 * bh), Vsub = (2 * bw) * (2 * bd) * subH;
    const Fb = G * Vsub, W = rho * G * V;                // ρ_water = 1
    const lenOf = (val) => clamp(val / (G * V) * 4.5, 0.5, 5);
    const forces = [
      { pos: [0, 0, zBot + subH / 2], dir: [0, 0, 1], amp: lenOf(Fb), color: 0x66dd99 },   // buoyant force (up)
      { pos: [0, 0, zc], dir: [0, 0, -1], amp: lenOf(W), color: 0xff6b6b },                // weight (down)
    ];
    const verdict = floats ? (rho > 0.97 ? 'neutral' : 'floats') : 'sinks';
    return {
      faces: [...water, ...block], picks: [{ name: 'block', kind: 'body', label: 'Object', fields: compactFields([['ρ', `${rho.toFixed(2)}·ρ_water`], ['state', verdict], ['submerged', `${Math.round(f * 100)}%`]]) }],
      tracers: [],
      field: { animate: false, sets: [{ color: 0x9fb2c8, curve: false, samples: surf }, { color: 0xffffff, curve: false, samples: forces }], lines: [],
        readout: ['Buoyancy — Archimedes', `object ρ = ${rho.toFixed(2)}·ρ_water`, `${verdict} · submerged ${Math.round(f * 100)}%`, 'F_b = ρ_water·g·V_displaced', 'green = buoyancy · red = weight'] },
      span: H + 4,
      stats: { rho, floats, submergedFrac: f, Fb, W },
    };
  },

  // WATER PRESSURE — hydrostatic P = ρgh. Pressure arrows on the tank walls grow with depth, and
  // jets from holes at three depths shoot out at v = √(2gh) (Torricelli): the deeper hole jets
  // FASTER. The flow particles ride the tracer channel.
  'water-pressure'() {
    const H = 12, x0 = -5, halfY = 4;
    const water = boxFaces([x0 / 2, 0, -H / 2], [Math.abs(x0) / 2, halfY, H / 2], '#2d6fb0', 'water', 0.2);
    const wall = boxFaces([0, 0, -H / 2], [0.12, halfY, H / 2], '#8a93a0', 'wall');
    const ampOf = (z) => clamp(0.3 + 1.8 * (-z) / H, 0.3, 2.0);
    const pcol = (z) => pressureColor((-z) / H);
    const press = [];
    for (const z of [-2, -4.5, -7, -9.5, -11]) press.push({ pos: [x0, 0, z], dir: [1, 0, 0], amp: ampOf(z), color: pcol(z) });   // back wall, into the water
    for (const x of [-4, -2.5, -1]) press.push({ pos: [x, 0, -H], dir: [0, 0, 1], amp: ampOf(-H + 0.01), color: pcol(-H) });       // floor, upward

    const tracers = [], lines = [];
    for (const h of [2.5, 6, 9.5]) {
      const v = Math.sqrt(2 * G * h), tEnd = Math.sqrt(2 * (H - h) / G), dt = 0.045, N = Math.max(8, Math.floor(tEnd / dt));
      const path = [];
      for (let i = 0; i <= N; i++) { const t = Math.min(tEnd, i * dt); path.push([v * t, 0, Math.max(-H, -h - 0.5 * G * t * t)]); }
      tracers.push({ path, color: [185, 218, 255], size: 0.36, period: Math.max(2, N * 0.045 * 5), trail: 5, trailLag: 0.005 });
      lines.push({ pts: path, color: speedColor(v / 9), opacity: 0.5 });
    }
    return {
      faces: [...water, ...wall], picks: [{ name: 'wall', kind: 'wall', label: 'Tank wall', fields: compactFields([['holes', '3 depths'], ['jet', 'v = √(2gh)']]) }],
      tracers,
      field: { animate: false, sets: [{ color: 0x9fb2c8, curve: false, samples: press }], lines,
        readout: ['Hydrostatic pressure', 'P = ρ·g·h  (depth h)', 'deeper → higher pressure', 'jet speed v = √(2gh)  (Torricelli)'] },
      span: H + 6,
      stats: { H, holes: 3 },
    };
  },

  // VISCOSITY (the effect) — the Stokes falling-sphere viscometer. Identical spheres dropped through
  // fluids of very different viscosity reach terminal velocity v = (2/9)(ρ_s−ρ_f)g·r²/μ, so the honey
  // ball crawls while the water ball drops. The enormous real μ range is COMPRESSED for a watchable
  // side-by-side (ordering + relative sense kept; real μ shown on each column). Balls ride the mover
  // channel; columns are translucent.
  'falling-sphere'() {
    const H = 22, cw = 4.2, gap = 2.6, r = 1.15, rhoS = 2500;
    const fluids = [
      { key: 'water', name: 'Water', mu: 0.001, rhoF: 1000, tint: '#2f74b8' },
      { key: 'oil', name: 'Oil', mu: 0.1, rhoF: 900, tint: '#b8893a' },
      { key: 'honey', name: 'Honey', mu: 10, rhoF: 1400, tint: '#a8761f' },
    ];
    const xc = (i) => (i - 1) * (cw * 2 + gap);
    const vRel = fluids.map((fl) => (rhoS - fl.rhoF) / fl.mu);   // ∝ terminal velocity
    const vMax = Math.max(...vRel);
    const faces = [], movers = [], picks = [];
    fluids.forEach((fl, i) => {
      const x = xc(i);
      faces.push(...boxFaces([x, 0, H / 2], [cw, cw, H / 2], fl.tint, `fluid:${fl.key}`, 0.3));
      faces.push(...lowerObjectFaces({ lathes: [sphereSpec([x, 0, H - r], r, '#b9bfc8', 20)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group: `ball:${fl.key}` })));
      const path = Array.from({ length: 26 }, (_, k) => { const t = k / 25; return [x, 0, (H - r) + (r - (H - r)) * t]; });
      movers.push({ group: `ball:${fl.key}`, path, basePos: path[0], period: clamp(1.4 * Math.pow(vMax / vRel[i], 0.22), 1.4, 8), loop: false, hold: 0.7 });
      picks.push({ name: `fluid:${fl.key}`, kind: 'fluid', label: fl.name, fields: compactFields([['μ (viscosity)', `${fl.mu} Pa·s`], ['fall speed', `${(vRel[i] / vMax * 100).toFixed(vRel[i] / vMax < 0.05 ? 2 : 0)}% of fastest`], ['Stokes', 'v ∝ 1/μ']]) });
    });
    return {
      faces, picks, movers, tracers: [],
      field: { animate: false, sets: [], lines: [],
        readout: ['Viscosity — Stokes falling-sphere', 'v = (2/9)(ρ_s−ρ_f)·g·r² / μ', 'higher viscosity → slower fall', 'water ≪ oil ≪ honey (μ: 0.001 → 0.1 → 10 Pa·s)'] },
      span: H + 4,
      stats: { viscosities: fluids.map((f) => f.mu) },
    };
  },

  // VISCOSITY (the definition) — Couette shear flow: fluid between a fixed floor and a top plate
  // dragged at speed V. The velocity profile is LINEAR (v ∝ height); viscosity μ is the resistance,
  // so the shear stress is τ = μ·(dv/dy). Particle layers slide (faster higher up); the `viscosity`
  // knob scales the gold stress arrow on the plate.
  shear(P) {
    const mu = clampNum(P.viscosity, 0.1, 10, 1);
    const h = 10, halfX = 9, halfY = 4, Vr = 4.2;
    const faces = [
      ...boxFaces([0, 0, -0.4], [halfX, halfY, 0.4], '#6b727e', 'floor'),
      ...boxFaces([0, 0, h + 0.4], [halfX, halfY, 0.4], '#aab2bd', 'plate'),
      ...boxFaces([0, 0, h / 2], [halfX, halfY, h / 2], '#2f74b8', 'fluid', 0.16),
    ];
    const vAt = (z) => Vr * (z / h);
    const arrows = [];
    for (const x of [-5, 0, 5]) for (const z of [1, 3, 5, 7, 9]) arrows.push({ pos: [x, 0, z], dir: [1, 0, 0], amp: clamp(vAt(z), 0.2, Vr), color: speedColor(0.4 + (z / h) * 1.1) });
    const stress = { color: 0xffd24a, curve: false, samples: [{ pos: [0, 0, h + 0.95], dir: [1, 0, 0], amp: clamp(mu * 1.3, 0.5, 5) }] };
    const tracers = [];
    for (const z of [2, 4, 6, 8]) { const path = Array.from({ length: 20 }, (_, k) => { const t = k / 19; return [-8 + 16 * t, 0, z]; }); tracers.push({ path, color: [210, 226, 255], size: 0.42, period: clamp(2.0 * (h / z), 1.2, 9), trail: 5, trailLag: 0.006 }); }
    // a MARKED fluid PARCEL — the deform channel shears it (a square → a parallelogram) so the velocity
    // profile is visible as the actual SHEAR DEFORMATION, not just sliding dots. The Couette shear is
    // x += γ·z (displacement ∝ height, from the fixed floor), i.e. the matrix [[1,0,γ],[0,1,0],[0,0,1]];
    // γ ramps then resets (loop) as fresh fluid is dragged. Note: the strain RATE is V/h, independent of
    // μ (μ sets the stress arrow, not the deformation) — so γ is fixed, not tied to viscosity.
    faces.push(...boxFaces([-4, 0, h / 2], [2.3, 0.55, h / 2 - 0.6], '#79e6ff', 'parcel', 0.5));
    const GAMMA = 0.52;
    const deforms = [{ group: 'parcel', mode: 'morph', to: [[1, 0, GAMMA], [0, 1, 0], [0, 0, 1]], period: 4.2, hold: 0.5, loop: true, pivot: [0, 0, 0] }];
    return {
      faces, movers: [], deforms,
      picks: [
        { name: 'plate', kind: 'plate', label: 'Moving plate', fields: compactFields([['drives', 'shear flow'], ['τ', 'μ·dv/dy'], ['μ', `${mu} Pa·s`]]) },
        { name: 'parcel', kind: 'parcel', label: 'fluid parcel — sheared', fields: compactFields([['shape', 'square → parallelogram'], ['why', 'each layer slides faster the higher it is (v ∝ z)'], ['strain rate', 'V/h — set by the plate, NOT by μ']]) },
      ],
      tracers,
      field: { animate: false, sets: [{ color: 0x9fb2c8, curve: false, samples: arrows }, stress], lines: [],
        readout: ['Couette shear flow', 'viscosity μ resists shearing', 'τ = μ · dv/dy  (shear stress)', 'the cyan PARCEL shears (square → parallelogram) — that IS the deformation', `μ = ${mu} Pa·s → gold stress arrow ∝ μ`] },
      span: 22,
      stats: { mu },
    };
  },
};

export const FLUID_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into faces + picks + the field channel + flow-particle tracers. Pure.
 * @returns {{ faces, picks, fields, tracers, bounds, stats }}
 */
export function planFluidScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'airfoil';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const built = SCENARIOS[scenario]({ angle: recipe.angle, density: recipe.density, viscosity: recipe.viscosity, spin: recipe.spin, emitters: recipe.emitters });

  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = built.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const fields = [{
    ...built.field,
    sets: built.field.sets.map((st) => ({ ...st, samples: st.samples.map((s) => ({ ...s, pos: sc(s.pos), amp: s.amp * scale })) })),
    lines: built.field.lines.map((ln) => ({ ...ln, pts: ln.pts.map(sc) })),
  }];
  const tracers = (built.tracers || []).map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const movers = (built.movers || []).map((mv) => ({ ...mv, path: mv.path.map(sc), basePos: sc(mv.basePos) }));
  // deform channel (opt-in): scale only the pivot — the `to`/`basis` matrices are scale-invariant ratios.
  const deforms = (built.deforms || []).map((d) => ({ ...d, ...(d.pivot ? { pivot: sc(d.pivot) } : {}) }));

  // bounds over faces + arrows + lines.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; } };
  for (const f of faces) for (const c of f.corners) bump(c);
  for (const st of fields[0].sets) for (const s of st.samples) bump(s.pos);
  for (const ln of fields[0].lines) for (const p of ln.pts) bump(p);
  for (const tr of tracers) for (const p of tr.path) bump(p);   // jets reach beyond the tank
  for (const mv of movers) for (const p of mv.path) bump(p);
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of [mn, mx]) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));
  radius = radius || built.span * scale;

  return { faces, picks: built.picks, fields, tracers, movers, deforms, bounds: { center, radius }, stats: { scenario, ...built.stats } };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. Orbit-only; side view primary (the flow reads
 * best in the x–z plane). glow off.
 */
export function assembleFluidScene(recipe = {}, { title } = {}) {
  const plan = planFluidScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.4;
  // the sail reads from ABOVE (its airfoil section is in the horizontal plane); everything else from the side.
  const cameras = ['sail', 'spin-sail', 'rotor-sail'].includes(plan.stats.scenario)
    ? [
        { name: 'aerial', worldFraming: { cameraPosition: [center[0] - d * 0.35, center[1] - d * 0.55, center[2] + d * 1.15], lookAt: center, horizontalFov: 48 } },
        { name: 'top', worldFraming: { cameraPosition: [center[0] + d * 0.04, center[1] - d * 0.06, center[2] + d * 1.7], lookAt: center, horizontalFov: 46 } },
      ]
    : [
        { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.3, center[2]], lookAt: center, horizontalFov: 46 } },
        { name: '3/4', worldFraming: { cameraPosition: [center[0] + d * 0.45, center[1] - d * 0.9, center[2] + d * 0.5], lookAt: center, horizontalFov: 46 } },
      ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#070b14';
  return {
    faces: plan.faces,
    picks: plan.picks,
    fields: plan.fields,
    tracers: plan.tracers,
    movers: plan.movers,
    ...(plan.deforms && plan.deforms.length ? { deforms: plan.deforms } : {}),
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
