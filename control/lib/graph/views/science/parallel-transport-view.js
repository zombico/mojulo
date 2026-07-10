/**
 * parallel-transport-view — HOLONOMY made visible. Carry a tangent arrow around a closed loop on a
 * surface WITHOUT ever actively turning it (parallel transport: at each step you slide it along,
 * keeping it as parallel as the surface allows). On a FLAT surface it comes home pointing exactly as it
 * started. On a CURVED surface it comes home ROTATED — and that rotation angle, the HOLONOMY, equals
 * the curvature enclosed by the loop (the Gauss–Bonnet theorem). For the unit sphere the enclosed
 * curvature is just the enclosed AREA = the solid angle, so the viewer can read the holonomy off the
 * geometry and check it against the theorem on screen.
 *
 * The same fact wears four hats, which are the four scenarios:
 *   • sphere-triangle — the textbook 90° proof: a triangle with three right angles, holonomy = π/2.
 *   • foucault        — the Foucault pendulum: its swing plane is parallel-transported around a circle
 *                       of latitude; the geometric holonomy is 2π(1−sin λ), and the precession you see
 *                       against the GROUND is the leftover 360°·sin λ per day.
 *   • berry           — the quantum geometric (Berry) phase: a spin in a slowly-steered field traces a
 *                       loop on the Bloch sphere and picks up γ = ½ × (enclosed solid angle).
 *   • flat-plane      — the control: transport around a square on a flat plane, holonomy = 0 (the
 *                       contrast that shows curvature is the whole point).
 *
 * Rides emitThreeWorld's new TRANSPORT channel (scene-three.js): a loop line, a fan of faded
 * breadcrumb arrows (the carried vector sampled around the trip — its rotation is visible as a fan), a
 * bright traveller, and the green START vs red RETURNED arrow whose gap IS the holonomy. The transport
 * physics is computed here (pure, deterministic, tested); the renderer just plays back the arrays.
 *
 * Stored manifest IS the recipe: { kind:'parallel-transport-view', scenario?, latitude?, loopSize?,
 * scale?, viewBox?, scene?:{ bg? }, title? }. Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── tiny 3-vector helpers (unit-sphere math is all we need) ──
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a) => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };

// Rodrigues: rotate v about unit axis k by angle θ.
function rotate(v, k, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return add(add(scl(v, c), scl(cross(k, v), s)), scl(k, dot(k, v) * (1 - c)));
}

// Discrete parallel transport on the unit sphere: moving from p0 to p1 (both unit), the surface itself
// rotates p0→p1 about the axis p0×p1 by the angle between them; carrying the vector by that SAME rotation
// is exact parallel transport along the connecting geodesic. Finely sampled, this transports along any loop.
function transportStep(p0, p1, v) {
  const ax = cross(p0, p1), m = Math.hypot(ax[0], ax[1], ax[2]);
  if (m < 1e-12) return v;                       // p0≈p1: no move, no turn
  const angle = Math.atan2(m, dot(p0, p1));
  return rotate(v, scl(ax, 1 / m), angle);
}

// the tangent at p0 pointing toward p1 (the initial carried direction = along the path).
const tangentToward = (p0, p1) => norm(sub(p1, scl(p0, dot(p1, p0))));

// signed angle from a to b about the outward normal n (the holonomy, with sign).
function signedAngle(a, b, n) {
  return Math.atan2(dot(n, cross(a, b)), dot(a, b));
}

// enclosed solid angle of a spherical polygon, fanned into triangles from loop[0] (Van Oosterom–Strackee
// per triangle). INDEPENDENT of the transport integration, so it's the Gauss–Bonnet cross-check.
function enclosedSolidAngle(loop) {
  let s = 0;
  for (let i = 1; i < loop.length - 1; i++) {
    const a = loop[0], b = loop[i], c = loop[i + 1];
    const num = dot(a, cross(b, c));
    const den = 1 + dot(a, b) + dot(b, c) + dot(c, a);
    s += 2 * Math.atan2(num, den);
  }
  return s;
}

// slerp two unit vectors (a geodesic arc sample).
function slerp(a, b, t) {
  const o = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (o < 1e-9) return a.slice();
  const s = Math.sin(o);
  return norm(add(scl(a, Math.sin((1 - t) * o) / s), scl(b, Math.sin(t * o) / s)));
}

// a geodesic arc A→B as n segments (excludes A, includes B — so arcs chain without duplicate vertices).
function geodesicArc(A, B, n) {
  const out = [];
  for (let k = 1; k <= n; k++) out.push(slerp(A, B, k / n));
  return out;
}

// a circle of latitude λ (deg) on the unit sphere, as a closed loop (first vertex repeated at the end).
function latitudeLoop(latDeg, n = 160) {
  const th = (90 - latDeg) * DEG;            // colatitude
  const st = Math.sin(th), ct = Math.cos(th), loop = [];
  for (let k = 0; k <= n; k++) { const ph = TAU * (k / n); loop.push([st * Math.cos(ph), st * Math.sin(ph), ct]); }
  return loop;
}

// ── scenarios ──
const SCENARIOS = {
  // the classic proof: a geodesic triangle N → equator(0°) → equator(90°) → N, three right angles.
  'sphere-triangle': {
    surface: 'sphere', accent: 0xffd24a,
    loop: () => {
      const N = [0, 0, 1], A = [1, 0, 0], B = [0, 1, 0], n = 54;
      return [N, ...geodesicArc(N, A, n), ...geodesicArc(A, B, n), ...geodesicArc(B, N, n)];
    },
    frame: () => ['three right angles → spherical excess = π/2', 'holonomy = enclosed area of the octant'],
  },
  // Foucault pendulum: the swing plane parallel-transported around a circle of latitude.
  foucault: {
    surface: 'sphere', accent: 0x9fe0ff, latitude: 48,
    loop: (p) => latitudeLoop(p.latitude),
    frame: (p, h) => {
      const lat = p.latitude;
      const ground = 360 * Math.sin(lat * DEG);
      return [`latitude ${lat}° (Foucault, Paris ≈ 48.9°)`, `swing-plane precession vs ground: 360°·sin λ = ${ground.toFixed(1)}°/day`];
    },
  },
  // quantum Berry phase: a spin's field traces a cone (a latitude loop) on the Bloch sphere.
  berry: {
    surface: 'sphere', accent: 0xc6a0ff, latitude: 35,
    loop: (p) => latitudeLoop(p.latitude),
    frame: (p, h, omega) => [`field cone half-angle ${90 - p.latitude}° on the Bloch sphere`, `Berry phase γ = ½·Ω = ${(Math.abs(omega) * 0.5 / DEG).toFixed(1)}°`],
  },
  // the control: a square loop on a FLAT plane — transport changes nothing.
  'flat-plane': {
    surface: 'plane', accent: 0x8fa4c8,
    frame: () => ['a flat surface has zero curvature', 'the arrow returns unchanged — holonomy = 0'],
  },
};

export const PARALLEL_TRANSPORT_SCENARIOS = Object.keys(SCENARIOS);

// the translucent globe is now a real lit three.js sphere (emitThreeWorld's `planets` channel), not a
// lathe "onion". It is STATIC (no mover) at the origin, radius R — the curved surface the vector rides
// on. The transported vector / loop / breadcrumbs are computed from pure unit-sphere math (scaled by R),
// not sampled from this body, so swapping the body's geometry leaves the holonomy visualization intact.
const hexRgb = (hex) => { const h = String(hex).replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };

// a flat checkerboard plane (hand-built quads) for the flat-plane control.
function planeFaces(S, nx) {
  const faces = [], step = (2 * S) / nx;
  for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) {
    const x0 = -S + i * step, y0 = -S + j * step, x1 = x0 + step, y1 = y0 + step;
    const tint = (i + j) % 2 ? '#1b2742' : '#141d33';
    faces.push({ corners: [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], fill: tint, group: 'plane' });
  }
  return faces;
}

const lerpHex = (a, b, t) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)) >>> 0;
};
const GREEN = 0x66e0a0, RED = 0xff5a5a;

/**
 * Resolve a recipe into the transport channel payload + the surface faces. Pure & deterministic.
 * @returns {{ faces, transports, bounds, stats }}
 */
export function planParallelTransportScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'sphere-triangle';
  const S = SCENARIOS[scenario];
  const scale = clampNum(recipe.scale, 0.3, 4, 1);
  const params = { latitude: clampNum(recipe.latitude, 5, 85, S.latitude ?? 45) };
  const R = 8 * scale;
  const arrowLen = R * 0.34;

  let faces, planets = [], loopRender, vecsUnit, holonomy, omega, surface;

  if (S.surface === 'plane') {
    surface = 'plane';
    const half = R * 1.4, sq = R * 0.78;
    faces = planeFaces(half, 8);
    // a square loop in the z=0 plane; transport on a plane is the identity → constant vector.
    const corners = [[-sq, -sq, 0], [sq, -sq, 0], [sq, sq, 0], [-sq, sq, 0]];
    loopRender = [];
    for (let e = 0; e < 4; e++) { const a = corners[e], b = corners[(e + 1) % 4]; for (let k = 0; k < 24; k++) loopRender.push(add(a, scl(sub(b, a), k / 24))); }
    loopRender.push(corners[0]);
    const dir = [1, 0, 0];
    vecsUnit = loopRender.map(() => dir);
    holonomy = 0; omega = 0;
  } else {
    surface = 'sphere';
    faces = [];
    // the globe: a static translucent lit sphere at the origin (replaces the old lathe onion faces).
    planets.push({ group: 'globe', center: [0, 0, 0], radius: R, tint: hexRgb('#2c4a7a'), opacity: 0.16, star: false });
    const loopUnit = S.loop(params);
    // parallel-transport the tangent around the loop.
    vecsUnit = [tangentToward(loopUnit[0], loopUnit[1])];
    for (let i = 1; i < loopUnit.length; i++) vecsUnit.push(transportStep(loopUnit[i - 1], loopUnit[i], vecsUnit[i - 1]));
    holonomy = signedAngle(vecsUnit[0], vecsUnit[vecsUnit.length - 1], loopUnit[0]);
    omega = enclosedSolidAngle(loopUnit);
    loopRender = loopUnit.map((p) => scl(p, R));
  }

  // breadcrumb fan: a faded arrow at evenly-spaced stations, coloured green→red along the trip so the
  // accumulating rotation reads as a fan even in a frozen still.
  const K = 26, breadcrumbs = [];
  for (let s = 0; s < K; s++) {
    const idx = Math.round((s / (K - 1)) * (loopRender.length - 1));
    breadcrumbs.push({ at: loopRender[idx], dir: vecsUnit[idx], color: lerpHex(GREEN, RED, s / (K - 1)) });
  }

  const holoDeg = holonomy / DEG, omegaDeg = omega / DEG;
  const transport = {
    surface, R, loop: loopRender, vectors: vecsUnit, breadcrumbs,
    startAt: loopRender[0], startDir: vecsUnit[0], endDir: vecsUnit[vecsUnit.length - 1],
    arrowLen, dotR: R * 0.045, period: 7.5, accent: S.accent,
    startColor: GREEN, endColor: RED, loopColor: 0x7fd0ff,
    title: 'parallel transport',
    holonomyDeg: +holoDeg.toFixed(1), solidAngleSr: +omega.toFixed(3), predictedDeg: +omegaDeg.toFixed(1),
    lines: S.frame(params, holonomy, omega),
  };

  return {
    faces, planets, transports: [transport],
    bounds: { center: [0, 0, 0], radius: surface === 'plane' ? R * 1.5 : R * 1.25 },
    stats: { scenario, surface, holonomyDeg: transport.holonomyDeg, solidAngleSr: transport.solidAngleSr },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — a 3/4 camera looking onto the loop, plus a second
 * angle. Dark background.
 */
export function assembleParallelTransportScene(recipe = {}, { title } = {}) {
  const plan = planParallelTransportScene(recipe);
  const { radius } = plan.bounds;
  const d = radius * 2.6;
  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [d * 0.55, -d * 0.75, d * 0.62], lookAt: [0, 0, 0], horizontalFov: 48 } },
    { name: 'pole', worldFraming: { cameraPosition: [d * 0.05, -d * 0.05, d * 1.15], lookAt: [0, 0, 0], horizontalFov: 46 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#070b16';
  return {
    faces: plan.faces,
    planets: plan.planets,
    transports: plan.transports,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} parallel transport`,
    bg,
    glow: false,
  };
}
