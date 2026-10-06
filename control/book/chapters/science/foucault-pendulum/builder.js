/**
 * foucault-pendulum — the recipe book's Tier-0 pilot builder: a Foucault
 * pendulum swinging over a compass floor, its swing plane precessing with
 * latitude while the rosette trail accumulates beneath it.
 *
 * The physics kept honest (small-angle pendulum + Earth-rotation precession):
 *   • the swing plane precesses at Ω = 15.04°/h × sin(latitude) — the full
 *     sidereal rate at the pole, zero at the equator (sin 0 = 0), reversed in
 *     the southern hemisphere;
 *   • the bob path is the superposition r(t) = A·cos(ω_s t) with the plane
 *     azimuth φ(t) advancing slowly — the classic star-rosette trace;
 *   • render time is compressed (a real half-turn takes hours to days — the
 *     readout carries the true rate); the LOOP is seamless because the swing
 *     completes N + ½ cycles while the plane turns exactly π (so the endpoint
 *     lands back on the start), or N whole cycles when there is no precession.
 *
 * Tier-0 discipline: PURE data out, zero imports, seeded nothing — the same
 * recipe returns a byte-identical scene forever. Animation rides mojulo's
 * generic mover channel as plain JSON (path + period + tether + track), with
 * optional finite-differenced kinematics for the v/a arrow overlay.
 *
 * Stored manifest IS the recipe:
 *   { kind:'foucault-pendulum-view', scenario?, latitude?, amplitude?, scale?,
 *     vectors?, viewBox?, scene?:{ bg? }, title? }
 */

const TAU = Math.PI * 2;
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── tiny face helpers (same quad currency every mojulo face-list consumer reads) ──
const _quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function _box(c, h, fill, group, alpha) {
  const v = (sx, sy, sz) => [c[0] + sx * h, c[1] + sy * h, c[2] + sz * h];
  return [
    _quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group, alpha),
    _quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group, alpha),
    _quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group, alpha),
  ];
}

// ── scenario presets: the famous installations + the two poles of the effect ──
const SCENARIOS = {
  // the Panthéon original (Léon Foucault, 1851) — the mid-latitude classic.
  paris: { lat: 48.8566, label: 'Paris Panthéon' },
  // at the pole the plane turns the full sidereal rate — one circle per day.
  pole: { lat: 90, label: 'North Pole' },
  // at the equator sin(0) = 0 — the control case: no precession at all.
  equator: { lat: 0, label: 'Equator' },
};
export const FOUCAULT_SCENARIOS = Object.keys(SCENARIOS);

const SIDEREAL_DEG_PER_HOUR = 15.04;   // 360° / 23.934 h
const T_LOOP = 16;                     // seconds per render loop (artistic compression)
const SAMPLES = 720;                   // equal-TIME path samples per loop

export const kind = {
  id: 'foucault-pendulum',
  manifestKind: 'foucault-pendulum-view',
  family: 'science',
  title: 'mojulo Foucault pendulum',
};

/**
 * Resolve a recipe into { faces, movers, fields, bounds, stats }. Pure — no DB,
 * no HTML, no dice. Same recipe → identical plan.
 */
export function plan(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const preset = SCENARIOS[recipe.scenario] ? recipe.scenario : 'paris';
  const lat = clampNum(recipe.latitude, -90, 90, SCENARIOS[preset].lat);
  const label = SCENARIOS[preset] && recipe.latitude == null ? SCENARIOS[preset].label : `latitude ${lat.toFixed(1)}°`;

  const L = 24 * scale;                                    // tether length
  const zPiv = 26 * scale;                                 // anchor height
  const A = clampNum(recipe.amplitude, 3 * scale, 0.6 * L, 10 * scale);   // swing amplitude

  const sinLat = Math.sin((lat * Math.PI) / 180);
  const hasPrecession = Math.abs(sinLat) > 0.02;
  // seamless-loop trick: with precession the plane turns exactly π over the loop
  // while the swing completes N + ½ cycles — r flips sign as φ flips direction,
  // so path(T_LOOP) === path(0). Without precession, N whole cycles closes it.
  const swings = hasPrecession ? 12.5 : 12;
  const omegaSwing = (TAU * swings) / T_LOOP;
  // northern hemisphere: viewed from above the plane turns CLOCKWISE (φ decreasing).
  const dir = sinLat >= 0 ? -1 : 1;
  const precessTotal = hasPrecession ? dir * Math.PI : 0;

  // ── the bob path, sampled at equal time steps (mover walks it at constant u-rate) ──
  const path = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (T_LOOP * i) / SAMPLES;
    const r = A * Math.cos(omegaSwing * t);
    const phi = precessTotal * (t / T_LOOP);
    path.push([r * Math.cos(phi), r * Math.sin(phi), zPiv - Math.sqrt(L * L - r * r)]);
  }
  path[SAMPLES] = path[0].slice();   // exact closure (the trick above makes this a no-op numerically)

  // ── faces: compass floor, pin ring, anchor block, the bob ──
  const faces = [];
  const rIn = A * 1.12, rOut = A * 1.3, SEG = 48;
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * TAU, a1 = ((i + 1) / SEG) * TAU, z = 0.02 * scale;
    faces.push(_quad([
      [Math.cos(a0) * rIn, Math.sin(a0) * rIn, z], [Math.cos(a1) * rIn, Math.sin(a1) * rIn, z],
      [Math.cos(a1) * rOut, Math.sin(a1) * rOut, z], [Math.cos(a0) * rOut, Math.sin(a0) * rOut, z],
    ], '#1d2a44', 'floor', 0.92));
  }
  for (let i = 0; i < 8; i++) {   // compass ticks, cardinals brighter
    const a = (i / 8) * TAU, card = i % 2 === 0;
    const r0 = rOut + 0.2 * scale, r1 = rOut + (card ? 1.6 : 0.9) * scale, w = (card ? 0.22 : 0.12) * scale;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa * w, py = ca * w, z = 0.03 * scale;
    faces.push(_quad([
      [ca * r0 + px, sa * r0 + py, z], [ca * r1 + px, sa * r1 + py, z],
      [ca * r1 - px, sa * r1 - py, z], [ca * r0 - px, sa * r0 - py, z],
    ], card ? '#7bd6e8' : '#3a4560', 'floor', 0.9));
  }
  const PINS = 36;
  for (let i = 0; i < PINS; i++) {   // the sand-pin ring the precessing plane sweeps
    const a = (i / PINS) * TAU, rp = A * 1.02;
    faces.push(..._box([Math.cos(a) * rp, Math.sin(a) * rp, 0.35 * scale], 0.22 * scale, '#d9b96a', 'pins'));
  }
  faces.push(..._box([0, 0, 0.06 * scale], 0.3 * scale, '#8e9bb6', 'floor'));       // centre marker
  faces.push(..._box([0, 0, zPiv + 0.5 * scale], 0.7 * scale, '#9aa3b8', 'anchor')); // ceiling anchor
  faces.push(..._box(path[0], 0.7 * scale, '#ffd36a', 'bob'));                       // the bob (mover group)

  // ── the mover: path walk + tether (the wire) + track (the rosette trail) ──
  const mover = {
    group: 'bob', basePos: path[0].slice(), path, period: T_LOOP, loop: true,
    tether: [0, 0, zPiv], track: true, trackColor: 0x37527d,
  };
  if (recipe.vectors === true) {   // optional v/a arrows + kinematic readout (finite-differenced)
    const dt = T_LOOP / SAMPLES, vdir = [], avec = [], speed = [], accel = [];
    const at = (i) => path[((i % SAMPLES) + SAMPLES) % SAMPLES];
    for (let i = 0; i <= SAMPLES; i++) {
      const pm = at(i - 1), p0 = at(i), pp = at(i + 1);
      const v = [(pp[0] - pm[0]) / (2 * dt), (pp[1] - pm[1]) / (2 * dt), (pp[2] - pm[2]) / (2 * dt)];
      const a = [(pp[0] - 2 * p0[0] + pm[0]) / (dt * dt), (pp[1] - 2 * p0[1] + pm[1]) / (dt * dt), (pp[2] - 2 * p0[2] + pm[2]) / (dt * dt)];
      const vn = Math.hypot(v[0], v[1], v[2]) || 1e-6;
      vdir.push([v[0] / vn, v[1] / vn, v[2] / vn]); avec.push(a);
      speed.push(vn); accel.push(Math.hypot(a[0], a[1], a[2]));
    }
    Object.assign(mover, {
      vectors: true, vdir, avec, speed, accel,
      maxSpeed: Math.max(...speed), maxAccel: Math.max(...accel),
      arrowLen: 4 * scale, duration: T_LOOP, g: 9.81, label: 'Foucault pendulum',
      footer: `Ω = ${SIDEREAL_DEG_PER_HOUR}°/h × sin(${lat.toFixed(1)}°)`,
    });
  }

  const omegaDegPerHour = SIDEREAL_DEG_PER_HOUR * Math.abs(sinLat);
  const daysPerRotation = hasPrecession ? 360 / omegaDegPerHour / 24 : null;
  const fields = [{ animate: false, sets: [], lines: [], readout: [
    'Foucault pendulum — the swing plane holds; the Earth turns beneath it',
    `${label} · Ω = ${SIDEREAL_DEG_PER_HOUR}°/h × sin(lat) = ${omegaDegPerHour.toFixed(2)}°/h`,
    hasPrecession
      ? `a full circle takes ${daysPerRotation.toFixed(1)} days — compressed here to ${T_LOOP} s per half-turn`
      : 'at the equator sin(0) = 0 — the plane never precesses (the control case)',
    'the rosette trail is the path traced over many swings',
  ] }];

  return {
    faces, movers: [mover], fields,
    bounds: { center: [0, 0, zPiv * 0.4], radius: Math.hypot(A * 1.5, zPiv * 0.65) },
    stats: {
      scenario: recipe.latitude == null ? preset : 'custom',
      latitudeDeg: +lat.toFixed(2),
      omegaDegPerHour: +omegaDegPerHour.toFixed(2),
      daysPerRotation: daysPerRotation == null ? null : +daysPerRotation.toFixed(1),
      swings, tLoop: T_LOOP,
    },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — a low 3/4 camera that reads
 * the swing in relief + a top-down camera that reveals the rosette.
 */
export function assemble(recipe = {}, { title } = {}) {
  const p = plan(recipe);
  const d = p.bounds.radius;
  const zMid = p.bounds.center[2];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#070a14';
  return {
    faces: p.faces,
    movers: p.movers,
    fields: p.fields,
    cameras: [
      { name: '3/4', worldFraming: { cameraPosition: [d * 1.0, -d * 1.45, zMid * 1.15], lookAt: [0, 0, zMid * 0.75], horizontalFov: 52 } },
      { name: 'top', worldFraming: { cameraPosition: [d * 0.01, -d * 0.05, d * 2.1], lookAt: [0, 0, 0], horizontalFov: 48 } },
    ],
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `${kind.title} (${p.stats.scenario === 'custom' ? `${p.stats.latitudeDeg}°` : p.stats.scenario})`,
    bg,
    glow: false,
  };
}
