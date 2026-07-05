/**
 * orbit-view — an orbital-mechanics depictor: bodies moving on real orbits around a central mass,
 * rendered in the traversable three.js World. The "space frame" sibling of mechanics-view (the
 * "ground frame") and the moving-system counterpart to create_planetary's single static body.
 *
 * Accurate motion, artistic scale — the orrery compromise. True scale is unviewable (the Moon is
 * ~60 Earth-radii away, a pixel wide), so distances and body sizes are COMPRESSED to read in one
 * frame, while the MOTION stays physically exact:
 *   • orbit shape (true eccentricity, the ellipse with the star at a focus),
 *   • Kepler's 2nd law (equal areas in equal time → the body visibly speeds up at perihelion — it
 *     falls out for free from sampling the mean anomaly uniformly, since M is linear in time),
 *   • Kepler's 3rd law (playback periods are the real periods × one global time-scale → exact ratios),
 *   • and the readout shows REAL distance / speed (vis-viva) / period. Compressed picture, honest physics.
 *
 * The motion rides emitThreeWorld's mover channel (multiple movers + a faint `track` line per orbit).
 *
 * Stored manifest IS the recipe (geometry regenerated on render, ~nothing stored):
 *   { kind:'orbit-view', scenario?, scale?, vectors?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (like mechanics-view / atom-view) — no walk, no CSS-3D /scene form.
 */

import { lowerObjectFaces, WORKBENCH_LIGHT } from '../../worlds/workbench.js';
import { TAU, DEG, clampNum, clamp, add, sub, scl, len, norm } from '../../worlds/motion-vocabulary.js';

// ── workbench lathe sphere (bodies + central star), same machinery cellular / mechanics use. ──
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const circleProfile = (R, n = 18) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return { t, radius: R * Math.sin(Math.PI * t) }; });
const sphereSpec = (center, radius, tint, samples = 22) => ({
  axisFrom: pt(add(center, [0, 0, -radius])), axisTo: pt(add(center, [0, 0, radius])),
  profile: circleProfile(radius, 18), crossSections: 24, samples, tint,
});

// ── physical constants (km, s) ──
const AU_KM = 1.495978707e8;
const MU_SUN = 1.32712440018e11;   // km³/s²
const MU_EARTH = 3.986004418e5;
const R_EARTH_KM = 6371;

// ── Kepler's equation: M = E − e·sinE → eccentric anomaly E (Newton). ──
function solveE(M, e) {
  let m = ((M % TAU) + TAU) % TAU;
  let E = e < 0.8 ? m : Math.PI;
  for (let i = 0; i < 16; i++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d; if (Math.abs(d) < 1e-13) break;
  }
  return E;
}

// real orbital period from the semi-major axis (Kepler's 3rd law).
const realPeriod = (aKm, mu) => TAU * Math.sqrt((aKm * aKm * aKm) / mu);

const N_SAMPLES = 168;

// ── the artistic scale (the orrery). Orbital radii compress by a gentle power (ordering + rough
// proportion kept, but inner & outer fit one frame). Body sizes compress by cube root (Jupiter still
// reads bigger than Mercury without being 11×). The central star is size-capped so it doesn't swallow
// the inner orbit. None of this touches the MOTION — only how far/big things are drawn. ──
const ORBIT_GAMMA = 0.62;          // radius compression exponent
const R_INNER = 7;                 // render radius of the innermost orbit
const BODY_BASE = 0.62, BODY_MIN = 0.42, BODY_MAX = 2.1;
const STAR_MAX = 2.5;
const PLAY_INNER = 4.5;            // playback seconds for the innermost (fastest) orbit; sets the global time-scale

const bodySize = (rKm) => clamp(BODY_BASE * Math.cbrt(rKm / R_EARTH_KM), BODY_MIN, BODY_MAX);

// ── scenario presets: real orbital elements (compressed only at render time). `featured` carries the
// vectors + readout; `omega` rotates the periapsis so a multi-planet system's ellipses don't align. ──
const SCENARIOS = {
  circular: () => ({
    mu: MU_SUN, central: { label: 'Star', size: 1.8, tint: '#ffd27a' },
    bodies: [{ name: 'planet', label: 'Planet (circular)', tint: '#5b8fd6', aKm: AU_KM, e: 0, rKm: R_EARTH_KM, omega: 0, featured: true }],
    distUnit: 'AU', distDiv: AU_KM, speedUnit: 'km/s', accelUnit: 'mm/s²',
  }),
  ellipse: () => ({
    mu: MU_SUN, central: { label: 'Star', size: 1.9, tint: '#ffd27a' },
    bodies: [{ name: 'planet', label: 'Planet (e=0.6)', tint: '#d98c4a', aKm: AU_KM, e: 0.6, rKm: R_EARTH_KM * 0.9, omega: 0, featured: true }],
    distUnit: 'AU', distDiv: AU_KM, speedUnit: 'km/s', accelUnit: 'mm/s²',
  }),
  // the inner solar system at true elements — Kepler's 3rd law (outer = slower, longer period).
  system: () => ({
    mu: MU_SUN, central: { label: 'Sun', size: STAR_MAX, tint: '#ffce6b' },
    bodies: [
      { name: 'mercury', label: 'Mercury', tint: '#b9a48c', aKm: 0.3871 * AU_KM, e: 0.2056, rKm: 2440, omega: 29 * DEG, featured: true },
      { name: 'venus', label: 'Venus', tint: '#d9b98a', aKm: 0.7233 * AU_KM, e: 0.0068, rKm: 6052, omega: 55 * DEG },
      { name: 'earth', label: 'Earth', tint: '#5b8fd6', aKm: 1.0 * AU_KM, e: 0.0167, rKm: 6371, omega: 102 * DEG },
      { name: 'mars', label: 'Mars', tint: '#c1593b', aKm: 1.5237 * AU_KM, e: 0.0934, rKm: 3390, omega: 286 * DEG },
    ],
    distUnit: 'AU', distDiv: AU_KM, speedUnit: 'km/s', accelUnit: 'mm/s²',
  }),
  // Earth + Moon — the operator's example. Lunar distance is compressed hard for visibility; the
  // compression factor is surfaced in the readout footer, but period + speed stay exact.
  moon: () => ({
    mu: MU_EARTH, central: { label: 'Earth', size: 1.7, tint: '#5b8fd6' },
    bodies: [{ name: 'moon', label: 'Moon', tint: '#cfd3da', aKm: 3.844e5, e: 0.0549, rKm: 1737, omega: 0, featured: true }],
    distUnit: '10³ km', distDiv: 1e3, speedUnit: 'km/s', accelUnit: 'mm/s²',
    moonCompression: true,
  }),
};

export const ORBIT_SCENARIOS = Object.keys(SCENARIOS);

const compactFields = (pairs) => pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));
const fmtPeriod = (sec) => { const d = sec / 86400; return d < 1 ? `${(d * 24).toFixed(1)} h` : d < 400 ? `${d.toFixed(1)} d` : `${(d / 365.25).toFixed(2)} yr`; };

/**
 * Resolve a recipe into a placed face list + per-body picks + the mover channel payload. Pure — no DB,
 * no HTML. Same recipe → identical faces + identical mover paths.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
export function planOrbitScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'system';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const vectors = recipe.vectors === false ? false : true;
  const S = SCENARIOS[scenario]();

  // render-radius compression: map true semi-major axes → render radii (artistic), ordering preserved.
  const aMin = Math.min(...S.bodies.map((b) => b.aKm));
  const renderR = (aKm) => R_INNER * scale * Math.pow(aKm / aMin, ORBIT_GAMMA);
  // global time-scale from the fastest (innermost) real period → exact Kepler-3rd ratios in playback.
  const tMin = Math.min(...S.bodies.map((b) => realPeriod(b.aKm, S.mu)));
  const timeScale = PLAY_INNER / tMin;

  const faces = [], picks = [], movers = [];
  const tag = (fs, group) => { for (const f of fs) faces.push({ ...f, group }); };

  // central body (Sun / Earth) at the focus — static, pickable.
  const star = scl([0, 0, 0], 1);
  tag(lowerObjectFaces({ lathes: [sphereSpec(star, S.central.size * scale, S.central.tint, 28)] }, WORKBENCH_LIGHT), 'central');
  picks.push({ name: 'central', kind: 'central', label: S.central.label, fields: compactFields([['role', 'central mass'], ['at', 'orbit focus']]) });

  for (const b of S.bodies) {
    const aR = renderR(b.aKm), e = b.e, co = Math.cos(b.omega), so = Math.sin(b.omega);
    const realT = realPeriod(b.aKm, S.mu);
    const period = realT * timeScale;     // playback seconds — Kepler-3rd-accurate ratio

    // sample the orbit at UNIFORM mean anomaly = uniform time → equal-dt render path (closed loop).
    const path = [], rArr = [], speed = [], accel = [];
    for (let k = 0; k <= N_SAMPLES; k++) {
      const M = TAU * (k / N_SAMPLES);
      const E = solveE(M, e);
      const cosv = (Math.cos(E) - e) / (1 - e * Math.cos(E));
      const sinv = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E));
      const rr = aR * (1 - e * Math.cos(E));                 // render distance from focus
      const x = rr * cosv, y = rr * sinv;
      path.push([x * co - y * so, x * so + y * co, 0]);      // rotate periapsis by omega, orbital plane = x–y
      // real kinematics at the same M (vis-viva), for the readout + arrow lengths.
      const rReal = b.aKm * (1 - e * Math.cos(E));
      rArr.push(rReal / S.distDiv);
      speed.push(Math.sqrt(S.mu * (2 / rReal - 1 / b.aKm)));   // km/s
      accel.push((S.mu / (rReal * rReal)) * 1e6);             // km/s² → mm/s²
    }

    // velocity direction = render tangent; acceleration direction = render centripetal (toward focus).
    const N = path.length;
    const vdir = path.map((p, i) => norm(sub(path[Math.min(N - 1, i + 1)], p)));
    const avec = path.map((p) => norm(scl(p, -1)));   // points at the star (origin)

    const sizeR = bodySize(b.rKm) * scale;
    tag(lowerObjectFaces({ lathes: [sphereSpec(path[0], sizeR, b.tint, 22)] }, WORKBENCH_LIGHT), `body:${b.name}`);
    picks.push({ name: `body:${b.name}`, kind: 'body', label: b.label, fields: compactFields([
      ['a (semi-major)', `${(b.aKm / S.distDiv).toFixed(2)} ${S.distUnit}`], ['eccentricity', e.toFixed(4)],
      ['period', fmtPeriod(realT)], ['v (mean)', `${(Math.sqrt(S.mu / b.aKm)).toFixed(2)} km/s`],
    ]) });

    const footer = S.moonCompression
      ? `dist ×${((b.aKm / R_EARTH_KM) / (aR / (S.central.size * scale))).toFixed(0)} compressed`
      : `T = ${fmtPeriod(realT)} · e = ${e.toFixed(3)}`;

    movers.push({
      group: `body:${b.name}`, path, basePos: path[0],
      vdir, avec, speed, accel,
      maxSpeed: Math.max(...speed), maxAccel: Math.max(...accel),
      period, loop: true, hold: 0,
      vectors: vectors && !!b.featured,    // arrows + readout only on the featured body (keeps a system legible)
      arrowLen: 0, duration: period,       // arrowLen filled below once span is known
      label: b.label, g: 0,
      track: true, trackColor: 0x42577f,
      dist: rArr, distUnit: S.distUnit, speedUnit: S.speedUnit, accelUnit: S.accelUnit, accelDecimals: 2,
      footer,
    });
  }

  // bounds over every orbit path + body, then size the arrows to the system span.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; } };
  for (const f of faces) for (const c of f.corners) bump(c);
  for (const mv of movers) for (const c of mv.path) bump(c);
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const mv of movers) for (const c of mv.path) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));
  for (const f of faces) for (const c of f.corners) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));
  radius = radius || R_INNER * scale;
  const arrowLen = Math.max(2, radius * 0.22);
  for (const mv of movers) mv.arrowLen = arrowLen;

  return { faces, picks, movers, bounds: { center, radius }, stats: { scenario, bodies: S.bodies.length, periods: movers.map((m) => +m.period.toFixed(2)) } };
}

// ── the physical read-back channel (measure_view). The rendered path is the orrery compromise —
// radii compressed by ORBIT_GAMMA, artistic and honest only in shape — so this recomputes the
// SAME Kepler sweep in real units instead: positions in km in the orbital plane (periapsis
// rotated by omega, focus at the origin), r from the true semi-major axis, speed from vis-viva,
// accel = μ/r². Uniform mean anomaly = uniform time, so t is real seconds of the real period. ──
export function sampleOrbitPhysics(recipe = {}, { every = 1 } = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'system';
  const S = SCENARIOS[scenario]();
  const step = Math.max(1, Math.round(clampNum(every, 1, N_SAMPLES, 1)));
  const series = S.bodies.map((b) => {
    const realT = realPeriod(b.aKm, S.mu);
    const co = Math.cos(b.omega), so = Math.sin(b.omega);
    const samples = [];
    for (let k = 0; k <= N_SAMPLES; k += step) {
      const M = TAU * (k / N_SAMPLES);
      const E = solveE(M, b.e);
      const cosv = (Math.cos(E) - b.e) / (1 - b.e * Math.cos(E));
      const sinv = (Math.sqrt(1 - b.e * b.e) * Math.sin(E)) / (1 - b.e * Math.cos(E));
      const rKm = b.aKm * (1 - b.e * Math.cos(E));
      const x = rKm * cosv, y = rKm * sinv;
      samples.push({
        t: +((k / N_SAMPLES) * realT).toFixed(3),
        pos: [+(x * co - y * so).toFixed(3), +(x * so + y * co).toFixed(3), 0],
        r: +rKm.toFixed(3),
        speed: +Math.sqrt(S.mu * (2 / rKm - 1 / b.aKm)).toFixed(6),
        accel: +(S.mu / (rKm * rKm)).toFixed(9),
      });
    }
    return { name: b.name, label: b.label, a_km: b.aKm, e: b.e, period_s: +realT.toFixed(3), samples, count: samples.length };
  });
  return {
    scenario,
    units: { t: 's', pos: 'km', r: 'km', speed: 'km/s', accel: 'km/s²' },
    mu_km3_s2: S.mu,
    series,
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. Orbit-only; a 3/4 view over the orbital plane is
 * primary (with a top-down second), glow off.
 */
export function assembleOrbitScene(recipe = {}, { title } = {}) {
  const plan = planOrbitScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.4;
  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [center[0] + d * 0.35, center[1] - d * 0.7, center[2] + d * 0.8], lookAt: center, horizontalFov: 46 } },
    { name: 'top', worldFraming: { cameraPosition: [center[0], center[1] - d * 0.02, center[2] + d * 1.25], lookAt: center, horizontalFov: 46 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#05070f';
  return {
    faces: plan.faces,
    picks: plan.picks,
    movers: plan.movers,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} orbit`,
    bg,
    glow: false,
  };
}
