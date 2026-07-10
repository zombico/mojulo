/**
 * mechanics-view — a classical-Newtonian MECHANICS depictor, rendered in the traversable three.js
 * World. The science/educational sibling of atom-view / cellular-view: where those show STRUCTURE
 * (a thing with parts you orbit + click), this shows BEHAVIOUR — an actual solid OBJECT moving
 * under the fundamentals (velocity, acceleration, gravity g, periodic motion).
 *
 * A tiny recipe (a `scenario` + a few physical params) → a deterministic simulation → a solid body
 * that translates along its REAL trajectory, with live velocity / acceleration vectors and a numeric
 * readout. No glow / bloom — the motion of the object is the point.
 *
 * The core trick: emitThreeWorld's mover channel walks a body along its `path` polyline at a CONSTANT
 * parameter rate. So if we sample the trajectory at EQUAL TIME STEPS (equal dt, NOT equal arc length),
 * the body's visible speed already encodes its acceleration — under gravity the samples bunch near the
 * apex and stretch near the ground, so the body visibly speeds up. All the physics lives in HOW this
 * planner samples the polyline; the renderer needs no time-warp logic. Velocity / acceleration are
 * finite-differenced from the same equal-dt polyline, so the readout shows real m/s and m/s².
 *
 * Frame: x = horizontal, z = up, y = depth (motion lives in the x–z plane); gravity is along −z.
 *
 * Stored manifest IS the recipe (geometry regenerated on render, ~nothing stored):
 *   { kind:'mechanics-view', scenario?, v0?, angle?, g?, mu?, length?, height?, scale?, vectors?,
 *     viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (like atom-view / cellular-view) — no walk, no CSS-3D /scene form.
 */

import { lowerObjectFaces, WORKBENCH_LIGHT } from '../../worlds/workbench.js';
import { clampNum, add, sub, scl, len, norm, DEG, deriveKinematics, MECHANICS_RULES, MECHANICS_SAMPLES,
  MACHINE_RULES, MACHINE_SCENARIOS, MACHINE_SAMPLES, ENGINE_RULES, ENGINE_SCENARIOS } from '../../worlds/motion-vocabulary.js';

// ── workbench lathe sphere (the body + the pendulum pivot marker), same machinery cellular-view uses.
// The lathe interpolates its profile LINEARLY, so a round ball needs a finely sampled sinusoid. ──
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const circleProfile = (R, n = 16) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return { t, radius: R * Math.sin(Math.PI * t) }; });
const sphereSpec = (center, radius, tint, samples = 22) => ({
  axisFrom: pt(add(center, [0, 0, -radius])), axisTo: pt(add(center, [0, 0, radius])),
  profile: circleProfile(radius, 18), crossSections: 24, samples, tint,
});
// hex → [r,g,b] 0..1 for the lit-sphere (planets) channel. The focal MOVING body of each scenario is
// a real lit sphere now (not a lathe "onion"); it rides the mover with geometry at the origin, so its
// planet carries center [0,0,0] and the mover's basePos is [0,0,0] (small/faint/pulse spheres — strobe
// ghosts, pivots, flywheel rim marks, engine sparks — stay lathe faces; no prominent onion there).
const hexRgb = (hex) => { const h = String(hex).replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
const litBody = (group, radius, tint) => ({ group, center: [0, 0, 0], radius, tint: hexRgb(tint), rough: 0.5 });

// ── flat set-dressing as explicit quads (ground, ramp): a face is { corners:[[x,y,z]…], fill, group }.
// Solid, untextured, never picked — the body is the only interactive thing. ──
const quad = (corners, fill, group) => ({ corners, fill, group });
// a triangular-prism ramp: a 2D polygon in the x–z plane, extruded along y by ±yHalf.
function prismFaces(poly, yHalf, topFill, sideFill, group) {
  const faces = [];
  const lo = poly.map(([x, z]) => [x, -yHalf, z]);
  const hi = poly.map(([x, z]) => [x, yHalf, z]);
  for (let i = 0; i < poly.length; i++) {            // side walls
    const j = (i + 1) % poly.length;
    faces.push(quad([lo[i], lo[j], hi[j], hi[i]], i === 0 ? topFill : sideFill, group));
  }
  faces.push(quad(lo.slice().reverse(), sideFill, group));   // end caps
  faces.push(quad(hi.slice(), sideFill, group));
  return faces;
}

// ── machine set-dressing (levers, pulleys, wheels, screws): the structure is static (the engine only
// translates), so beams / discs / threads are drawn once in group 'scene' and never picked. ──
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a rectangular beam (box) between two x-positions at height z, thin in z and depth y.
function beamBox(x0, x1, z, thickZ, halfY, fill, group) {
  return prismFaces([[x0, z - thickZ / 2], [x1, z - thickZ / 2], [x1, z + thickZ / 2], [x0, z + thickZ / 2]], halfY, fill, fill, group);
}
// a short solid cylinder (a wheel / pulley / shaft) about `axis`. The renderer is QUAD-only (3-corner
// faces are dropped), so cap "fans" are emitted as degenerate quads (last corner repeated → one real
// triangle each).
function cylinderFaces(center, R, axis, halfLen, fill, group, seg = 20) {
  const ax = norm(axis);
  const ref = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(sub(ref, scl(ax, ref[0] * ax[0] + ref[1] * ax[1] + ref[2] * ax[2]))), v = cross(ax, u);
  const c0 = sub(center, scl(ax, halfLen)), c1 = add(center, scl(ax, halfLen));
  const ring = (c) => Array.from({ length: seg }, (_, i) => { const t = (i / seg) * Math.PI * 2; return add(c, add(scl(u, R * Math.cos(t)), scl(v, R * Math.sin(t)))); });
  const r0 = ring(c0), r1 = ring(c1), faces = [];
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    faces.push(quad([r0[i], r0[j], r1[j], r1[i]], fill, group));            // side wall
    faces.push(quad([c0, r0[j], r0[i], r0[i]], fill, group));               // near cap (degenerate quad)
    faces.push(quad([c1, r1[i], r1[j], r1[j]], fill, group));               // far cap (degenerate quad)
  }
  return faces;
}
// a triangular prism with QUAD caps (3 side walls + 2 degenerate-quad caps), so the triangular faces
// actually render under the quad-only mesh builder (unlike prismFaces, whose 3-corner caps get dropped).
function triPrism(poly, yHalf, fill, group) {
  const lo = poly.map(([x, z]) => [x, -yHalf, z]), hi = poly.map(([x, z]) => [x, yHalf, z]), faces = [];
  for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; faces.push(quad([lo[i], lo[j], hi[j], hi[i]], fill, group)); }
  faces.push(quad([lo[0], lo[1], lo[2], lo[2]], fill, group));              // near cap
  faces.push(quad([hi[2], hi[1], hi[0], hi[0]], fill, group));              // far cap
  return faces;
}
// a toothed GEAR about `axis`: a cog whose outline alternates root radius R and tip radius R+th (square
// teeth), extruded by ±halfY, with degenerate-quad cap fans. Counter-rotating meshed gears read at a
// glance, and the teeth make the rotation unmistakable.
function gearFaces(center, R, th, nTeeth, axis, halfY, fill, group) {
  const ax = norm(axis);
  const ref = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(sub(ref, scl(ax, ref[0] * ax[0] + ref[1] * ax[1] + ref[2] * ax[2]))), v = cross(ax, u);
  const c0 = sub(center, scl(ax, halfY)), c1 = add(center, scl(ax, halfY));
  const s = (Math.PI * 2) / nTeeth, pts = [];
  for (let t = 0; t < nTeeth; t++) { const a = t * s; pts.push([a, R], [a, R + th], [a + s * 0.5, R + th], [a + s * 0.5, R]); }
  const at = (c, ar) => add(c, add(scl(u, ar[1] * Math.cos(ar[0])), scl(v, ar[1] * Math.sin(ar[0]))));
  const r0 = pts.map((p) => at(c0, p)), r1 = pts.map((p) => at(c1, p)), faces = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    faces.push(quad([r0[i], r0[j], r1[j], r1[i]], fill, group));
    faces.push(quad([c0, r0[j], r0[i], r0[i]], fill, group));
    faces.push(quad([c1, r1[i], r1[j], r1[j]], fill, group));
  }
  return faces;
}
// a solid cone (an arrowhead): a base ring perpendicular to base→apex, fanned to the apex, with a base cap.
function coneFaces(baseCenter, apex, R, fill, group, seg = 16) {
  const ax = norm(sub(apex, baseCenter));
  const ref = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(sub(ref, scl(ax, ref[0] * ax[0] + ref[1] * ax[1] + ref[2] * ax[2]))), v = cross(ax, u);
  const ring = Array.from({ length: seg }, (_, i) => { const t = (i / seg) * Math.PI * 2; return add(baseCenter, add(scl(u, R * Math.cos(t)), scl(v, R * Math.sin(t)))); });
  const faces = [];
  for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; faces.push(quad([ring[i], ring[j], apex, apex], fill, group)); faces.push(quad([baseCenter, ring[j], ring[i], ring[i]], fill, group)); }
  return faces;
}
// a solid 3-D arrow (shaft cylinder + cone head) from `from` to `to` — a field / force vector.
function solidArrow(from, to, fill, group, shaftR) {
  const d = sub(to, from), Lr = len(d) || 1e-6, dir = norm(d), headLen = Math.min(Lr * 0.42, shaftR * 4.5), shaftLen = Lr - headLen;
  const shaftEnd = add(from, scl(dir, shaftLen));
  return [...cylinderFaces(add(from, scl(dir, shaftLen / 2)), shaftR, dir, shaftLen / 2, fill, group), ...coneFaces(shaftEnd, to, shaftR * 2.2, fill, group)];
}
// a helical thread ribbon winding `turns` times up a cylinder of radius R along +z (the screw thread).
function helixRibbon(center, R, axisLen, turns, fill, group, seg = 96) {
  const w = R * 0.45, faces = [];
  const at = (s) => { const th = s * turns * Math.PI * 2, z = center[2] + s * axisLen; return [center[0] + R * Math.cos(th), center[1] + R * Math.sin(th), z]; };
  for (let i = 0; i < seg; i++) {
    const a = at(i / seg), b = at((i + 1) / seg);
    faces.push(quad([[a[0], a[1], a[2] - w], [b[0], b[1], b[2] - w], [b[0], b[1], b[2] + w], [a[0], a[1], a[2] + w]], fill, group));
  }
  return faces;
}

const N_SAMPLES = MECHANICS_SAMPLES;

// The Newtonian scenario generators (projectile / free-fall / inclined-plane / pendulum / spring /
// circular) now live in the neutral motion-vocabulary module as MECHANICS_RULES; this view consumes
// them. 'collision' is a two-body scenario handled by its own planner (planCollisionScene) below — not
// a rule generator, but a selectable scenario, so it joins the public list the tool validates against.
const MOTOR_SCENARIOS = ['dc-motor', 'ac-motor'];   // electric motors — electromagnetism, not mechanical linkages
const VEHICLE_SCENARIOS = ['drone', 'drone-flight', 'submarine'];   // Newtonian force-balance vehicles: air (thrust) / water (buoyancy)
export const MECHANICS_SCENARIOS = [...Object.keys(MECHANICS_RULES), 'collision', ...MACHINE_SCENARIOS, ...ENGINE_SCENARIOS, ...MOTOR_SCENARIOS, ...VEHICLE_SCENARIOS];
const MACHINE_SET = new Set(MACHINE_SCENARIOS);
const ENGINE_SET = new Set(ENGINE_SCENARIOS);

const BODY_TINT = '#e0b15f';
const BODY2_TINT = '#7fa8d6';   // the second body in a collision — steel-blue, distinct from the gold
const GHOST_TINT = '#6a5733';   // dim, desaturated body — the strobe copies read as "afterimages"
const GHOST2_TINT = '#3f4a5e';  // dim steel-blue strobe for the second (compare) body
const TRACE_FILL = '#3a4a63';   // dim blue-grey path band
const GROUND_FILL = '#222a3b';
const GROUND_EDGE = '#2c3650';
const RAMP_TOP = '#6b5238';
const RAMP_SIDE = '#4a3a28';
const PIVOT_TINT = '#8e9bb6';

// ── trajectory ribbon: a thin flat band lying IN the motion plane (x–z, y=0), offset perpendicular
// to the path so it reads face-on to the side camera and edge-on when orbited. Static set-dressing,
// never picked — the persistent shape of the arc, visible even at t=0. ──
function traceRibbonFaces(path, halfW, fill, group) {
  const faces = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i], q = path[i + 1];
    const tx = q[0] - p[0], tz = q[2] - p[2];
    const tl = Math.hypot(tx, tz) || 1;
    const px = (tz / tl) * halfW, pz = (-tx / tl) * halfW;   // perpendicular in x–z
    const a = [p[0] + px, 0, p[2] + pz], b = [p[0] - px, 0, p[2] - pz];
    const c = [q[0] - px, 0, q[2] - pz], d = [q[0] + px, 0, q[2] + pz];
    faces.push(quad([a, b, c, d], fill, group));
  }
  return faces;
}

const compactFields = (pairs) => pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));

/**
 * Resolve a recipe into a placed face list + body pick + the mover channel payload. Pure — no DB,
 * no HTML. Same seed/params → identical faces and identical mover path.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
// scenarios that support side-by-side comparison (single-body trajectories with a flight time / period).
const COMPARE_SCENARIOS = new Set(['projectile', 'free-fall', 'inclined-plane', 'pendulum']);
const MOON_G = 1.62;

export function planMechanicsScene(recipe = {}) {
  if (recipe.scenario === 'collision') return planCollisionScene(recipe);   // two-body branch
  if (recipe.scenario === 'dc-motor') return planDcMotorScene(recipe);       // brushed-DC motor branch
  if (recipe.scenario === 'ac-motor') return planAcMotorScene(recipe);       // AC induction motor branch
  if (recipe.scenario === 'drone') return planDroneScene(recipe);            // multirotor hover (force balance)
  if (recipe.scenario === 'drone-flight') return planDroneFlightScene(recipe);   // multirotor traversing changing air
  if (recipe.scenario === 'submarine') return planSubmarineScene(recipe);    // buoyancy: dive/rise via ballast
  if (ENGINE_SET.has(recipe.scenario)) return planEngineScene(recipe);       // reciprocating-engine branch
  if (MACHINE_SET.has(recipe.scenario)) return planMachineScene(recipe);     // simple-machine branch
  if (recipe.compare && COMPARE_SCENARIOS.has(recipe.scenario)) return planCompareScene(recipe);   // side-by-side
  const scenario = MECHANICS_RULES[recipe.scenario] ? recipe.scenario : 'projectile';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const g = clampNum(recipe.g, 0.5, 40, 9.8);
  const vectors = recipe.vectors === false ? false : true;
  const trace = recipe.trace === false ? false : true;
  const strobe = recipe.strobe === false ? false : true;
  const strobeEvery = Math.round(clampNum(recipe.strobeEvery, 4, 40, 12));
  const energy = recipe.energy === false ? false : true;
  const forces = recipe.forces === true;   // opt-in: the moving free-body diagram (weight/normal/friction/tension)
  const mass = clampNum(recipe.mass, 0.1, 100, 1);

  const P = { g, mass, v0: recipe.v0, angle: recipe.angle, mu: recipe.mu, length: recipe.length, height: recipe.height, k: recipe.k, amplitude: recipe.amplitude, radius: recipe.radius };
  const sim = MECHANICS_RULES[scenario](P);
  const rawPath = sim.path;

  // scene scale: size the body + arrows relative to the trajectory extent so every scenario frames well.
  const xs = rawPath.map((p) => p[0]), zs = rawPath.map((p) => p[2]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs), zMax = Math.max(...zs);
  const span = Math.max(xMax - xMin, zMax, 1) * scale;
  const path = scale === 1 ? rawPath : rawPath.map((p) => scl(p, scale));
  const rB = sim.bobR != null ? sim.bobR * scale : Math.min(1.2 * scale, Math.max(0.4, span * 0.03));
  const arrowLen = Math.max(2.5, span * 0.18);

  const faces = [], picks = [], planets = [];
  const tag = (fs, group) => { for (const f of fs) faces.push({ ...f, group }); };

  // trajectory ribbon — the persistent shape of the arc, drawn first so the body/ghosts sit over it.
  // (a static body has no trajectory to trace, and its strobe copies would just stack on the rest point.)
  if (trace && !sim.static) tag(traceRibbonFaces(path, Math.max(rB * 0.3, span * 0.006), TRACE_FILL, 'scene'), 'scene');

  // stroboscopic afterimages — faint body copies at every Nth equal-dt sample. Because the samples are
  // equal-TIME, their spacing IS the acceleration (bunched where fast, stretched where slow); the strobe
  // makes that visible WITHOUT playing the animation. Smaller + dimmed, group 'scene' so never picked.
  if (strobe && !sim.static) {
    const rG = rB * 0.72;
    for (let i = strobeEvery; i < path.length - 1; i += strobeEvery) {
      tag(lowerObjectFaces({ lathes: [sphereSpec(path[i], rG, GHOST_TINT, 16)] }, WORKBENCH_LIGHT), 'scene');
    }
  }

  // the body — a real lit sphere the mover walks along `path` (geometry at origin, basePos [0,0,0]).
  planets.push(litBody('body', rB, BODY_TINT));
  picks.push({ name: 'body', kind: 'body', label: sim.label, fields: compactFields([['g', `${g} m/s²`], ...sim.facts]) });

  // ground line under the motion (every scenario rests on z = 0).
  const pad = Math.max(span * 0.15, 3 * scale), yHalf = Math.max(span * 0.12, 2 * scale);
  const gx0 = xMin * scale - pad, gx1 = xMax * scale + pad;
  tag([quad([[gx0, -yHalf, 0], [gx1, -yHalf, 0], [gx1, yHalf, 0], [gx0, yHalf, 0]], GROUND_FILL, 'scene'),
    quad([[gx0, -yHalf, 0], [gx0, yHalf, 0], [gx0, yHalf, -span * 0.04], [gx0, -yHalf, -span * 0.04]], GROUND_EDGE, 'scene')], 'scene');

  // scenario-specific dressing: the ramp wedge / the pendulum pivot.
  if (sim.ramp) {
    const R = sim.ramp, T = scl(R.top, scale), C = scl(R.bottomCorner, scale), O = [0, 0, 0];
    tag(prismFaces([[T[0], T[2]], [C[0], C[2]], [O[0], O[2]]], R.depth * scale, RAMP_TOP, RAMP_SIDE, 'scene'), 'scene');
  }
  if (sim.pivot) {
    const piv = scl(sim.pivot, scale);
    tag(lowerObjectFaces({ lathes: [sphereSpec(piv, rB * 0.55, PIVOT_TINT, 14)] }, WORKBENCH_LIGHT), 'scene');
  }

  // mover channel: the body walks `path` (equal-dt), with finite-differenced velocity / accel for the
  // arrows + readout. period (playback seconds) ≈ real flight time, clamped to a watchable range.
  const dt = sim.T / (N_SAMPLES - 1);
  const k = deriveKinematics(path, dt);          // directions from the (possibly scaled) world path — scaling preserves direction
  const kPhys = deriveKinematics(rawPath, dt);   // magnitudes from the unscaled metres → real m/s and m/s² in the readout
  const period = Math.max(2.5, Math.min(7, sim.T));

  // per-sample energy (real joules, from the UNSCALED metres): KE = ½mv²; PE is gravitational mgz by
  // default, or whatever a scenario supplies via `peArray` (the spring ships elastic ½kx²). For
  // conservative scenarios the total stays flat as KE↔PE trade; on the inclined plane with μ>0 it visibly
  // SINKS (friction → heat). `noEnergy` scenarios (idealised circular motion) opt out entirely.
  const zFloor = Math.min(...rawPath.map((p) => p[2]));
  const ke = Array.isArray(sim.keArray) ? sim.keArray : kPhys.speed.map((v) => 0.5 * mass * v * v);
  const pe = Array.isArray(sim.peArray) ? sim.peArray : rawPath.map((p) => mass * g * (p[2] - zFloor));
  const etotal = ke.map((e, i) => e + pe[i]);
  const emax = Math.max(...etotal, 1e-6);

  // force channels (Phase 2a, opt-in): the per-sample free-body diagram. maxForce scales every arrow
  // against the largest force present, so their relative lengths read honestly (weight vs normal vs …).
  const forceChannels = forces && Array.isArray(sim.forceChannels) ? sim.forceChannels : null;
  const maxForce = forceChannels
    ? Math.max(...forceChannels.flatMap((c) => c.vecs.map((v) => len(v))), 1e-6) : 0;

  const movers = [{
    group: 'body', path, basePos: [0, 0, 0],
    vdir: k.vdir, speed: kPhys.speed, avec: k.avec, accel: kPhys.accel,
    ...(energy && !sim.static && !sim.noEnergy ? { energy: true, ke, pe, etotal, emax } : {}),
    ...(forceChannels ? { forces: forceChannels, maxForce } : {}),
    maxSpeed: kPhys.maxSpeed, maxAccel: kPhys.maxAccel,
    period, loop: !!sim.loop, hold: sim.hold != null ? sim.hold : 1.2,
    vectors, arrowLen, duration: sim.T, g, label: sim.label,
    ...(sim.tether ? { tether: scl(sim.tether, scale) } : {}),
  }];

  // bounds over geometry AND the full trajectory, so the camera frames the whole motion.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; } };
  for (const f of faces) for (const c of f.corners) bump(c);
  for (const c of path) bump(c);
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of [...path, ...faces.flatMap((f) => f.corners)]) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));
  radius = radius || span;

  return { faces, picks, movers, planets, bounds: { center, radius }, stats: { scenario, g, bodyRadius: rB, samples: N_SAMPLES, period, loop: !!sim.loop, T: sim.T } };
}

// ── the physical read-back channel (measure_view). The renderer computes the full equal-dt
// trajectory on every mint/render and throws it away; this returns it as data instead. Sampled
// from the UNSCALED rule output — positions in real metres, speed/accel in real m/s and m/s²
// (the same kPhys numbers the readout shows), never the render-scaled world path. Restricted to
// the single-body MECHANICS_RULES dynamics scenarios: machines are quasi-static, engines are
// kinematic linkages, compare/collision are multi-mover — none of those yield one honest
// SI time-series, so they refuse rather than return numbers that would lie. ──
export const MEASURABLE_MECHANICS_SCENARIOS = Object.keys(MECHANICS_RULES);

export function sampleMechanicsPhysics(recipe = {}, { every = 1 } = {}) {
  const scenario = recipe.scenario;
  if (recipe.compare) {
    throw new Error(
      "sampleMechanicsPhysics: compare recipes are two movers — measure each variant as its own recipe (drop `compare`).",
    );
  }
  if (!MECHANICS_RULES[scenario]) {
    throw new Error(
      `sampleMechanicsPhysics: scenario '${scenario}' has no single-body dynamics rule. Measurable scenarios: ${MEASURABLE_MECHANICS_SCENARIOS.join(', ')}.`,
    );
  }
  // same parameter resolution as planMechanicsScene, so measured numbers match the rendered readout.
  const g = clampNum(recipe.g, 0.5, 40, 9.8);
  const mass = clampNum(recipe.mass, 0.1, 100, 1);
  const P = { g, mass, v0: recipe.v0, angle: recipe.angle, mu: recipe.mu, length: recipe.length, height: recipe.height, k: recipe.k, amplitude: recipe.amplitude, radius: recipe.radius };
  const sim = MECHANICS_RULES[scenario](P);
  const dt = sim.T / (N_SAMPLES - 1);
  const k = deriveKinematics(sim.path, dt);
  const zFloor = Math.min(...sim.path.map((p) => p[2]));
  const ke = Array.isArray(sim.keArray) ? sim.keArray : k.speed.map((v) => 0.5 * mass * v * v);
  const pe = Array.isArray(sim.peArray) ? sim.peArray : sim.path.map((p) => mass * g * (p[2] - zFloor));
  const step = Math.max(1, Math.round(clampNum(every, 1, N_SAMPLES, 1)));
  const samples = [];
  for (let i = 0; i < sim.path.length; i += step) {
    samples.push({
      t: +(i * dt).toFixed(6),
      pos: sim.path[i].map((c) => +c.toFixed(6)),
      speed: +k.speed[i].toFixed(6),
      accel: +k.accel[i].toFixed(6),
      ...(sim.noEnergy ? {} : { ke: +ke[i].toFixed(6), pe: +pe[i].toFixed(6) }),
    });
  }
  return {
    scenario, label: sim.label, T: sim.T, dt, loop: !!sim.loop, static: !!sim.static,
    units: { t: 's', pos: 'm', speed: 'm/s', accel: 'm/s²', ...(sim.noEnergy ? {} : { ke: 'J', pe: 'J' }) },
    facts: sim.facts, samples, count: samples.length,
  };
}

/**
 * Two-body 1-D COLLISION (Phase 3a): two bodies on a horizontal track approach, collide, and separate
 * with velocities set by conservation of momentum + a restitution e (e=1 elastic / KE conserved, e=0
 * perfectly inelastic / they stick). TWO movers + a SYSTEM readout: total momentum p stays CONSTANT
 * (the headline) while total KE holds (elastic) or visibly drops (inelastic). Bodies are sized by mass.
 * @returns {{ faces, picks, movers, bounds, stats }} — same shape as planMechanicsScene.
 */
function planCollisionScene(recipe = {}) {
  const m1 = clampNum(recipe.m1, 0.1, 50, 1), m2 = clampNum(recipe.m2, 0.1, 50, 1);
  let u1 = clampNum(recipe.u1, -30, 30, 5), u2 = clampNum(recipe.u2, -30, 30, 0);
  if (u1 - u2 <= 0) u1 = u2 + 4;                 // the bodies must close (right body slower) to collide
  const e = clampNum(recipe.e, 0, 1, 1);
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const vectors = recipe.vectors === false ? false : true;

  // 1-D collision solution: momentum conserved, separation = e·approach.
  const M = m1 + m2;
  const v1 = (m1 * u1 + m2 * u2 + m2 * e * (u2 - u1)) / M;
  const v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / M;

  const r1 = 0.95 * Math.cbrt(m1), r2 = 0.95 * Math.cbrt(m2);   // radius ∝ m^⅓ (constant density)
  const tpre = 1.2, tpost = 1.2, T = tpre + tpost, dt = T / (N_SAMPLES - 1);
  const x1c = -r1, x2c = r2;                      // centres at contact (surfaces meet at x = 0)
  const px1 = (t) => x1c + (t <= tpre ? u1 : v1) * (t - tpre);
  const px2 = (t) => x2c + (t <= tpre ? u2 : v2) * (t - tpre);

  const rawP1 = [], rawP2 = [], vx1 = [], vx2 = [], keNow = [];
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = i * dt, a = t <= tpre ? u1 : v1, b = t <= tpre ? u2 : v2;
    rawP1.push([px1(t), 0, r1]); rawP2.push([px2(t), 0, r2]);
    vx1.push(a); vx2.push(b); keNow.push(0.5 * m1 * a * a + 0.5 * m2 * b * b);
  }
  const pTotal = m1 * u1 + m2 * u2, keBefore = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;

  const sc = (p) => (scale === 1 ? p : scl(p, scale));
  const sp1 = rawP1.map(sc), sp2 = rawP2.map(sc), R1 = r1 * scale, R2 = r2 * scale;
  const span = Math.max(...sp2.map((p) => p[0])) - Math.min(...sp1.map((p) => p[0])) || 1;
  const arrowLen = Math.max(2.5, span * 0.14);

  const faces = [], picks = [], planets = [];
  const tag = (fs, group) => { for (const f of fs) faces.push({ ...f, group }); };
  planets.push(litBody('body', R1, BODY_TINT));
  planets.push(litBody('body2', R2, BODY2_TINT));
  picks.push({ name: 'body', kind: 'body', label: `Body 1 (${m1} kg)`, fields: compactFields([['mass', `${m1} kg`], ['u₁', `${u1} m/s`], ['v₁', `${v1.toFixed(2)} m/s`], ['e', `${e}`]]) });
  picks.push({ name: 'body2', kind: 'body', label: `Body 2 (${m2} kg)`, fields: compactFields([['mass', `${m2} kg`], ['u₂', `${u2} m/s`], ['v₂', `${v2.toFixed(2)} m/s`], ['e', `${e}`]]) });

  // ground line under the track.
  const gx0 = Math.min(...sp1.map((p) => p[0])) - 2 * scale, gx1 = Math.max(...sp2.map((p) => p[0])) + 2 * scale;
  const yHalf = Math.max(span * 0.1, 2 * scale);
  tag([quad([[gx0, -yHalf, 0], [gx1, -yHalf, 0], [gx1, yHalf, 0], [gx0, yHalf, 0]], GROUND_FILL, 'scene'),
    quad([[gx0, -yHalf, 0], [gx0, yHalf, 0], [gx0, yHalf, -span * 0.03], [gx0, -yHalf, -span * 0.03]], GROUND_EDGE, 'scene')], 'scene');

  const k1 = deriveKinematics(sp1, dt), k1p = deriveKinematics(rawP1, dt);
  const k2 = deriveKinematics(sp2, dt), k2p = deriveKinematics(rawP2, dt);
  const period = 4.5;
  const system = { e, m1, m2, pTotal, keBefore, vx1, vx2, keNow };
  const movers = [
    { group: 'body', path: sp1, basePos: [0, 0, 0], vdir: k1.vdir, speed: k1p.speed, avec: k1.avec, accel: k1p.accel,
      maxSpeed: k1p.maxSpeed, maxAccel: k1p.maxAccel, period, loop: false, hold: 1.6, vectors, arrowLen,
      duration: T, label: `Collision · e = ${e}`, system },
    { group: 'body2', path: sp2, basePos: [0, 0, 0], vdir: k2.vdir, speed: k2p.speed, avec: k2.avec, accel: k2p.accel,
      maxSpeed: k2p.maxSpeed, maxAccel: k2p.maxAccel, period, loop: false, hold: 1.6, vectors, arrowLen,
      duration: T, label: 'Body 2' },
  ];

  // bounds over both bodies' tracks + ground.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; } };
  for (const f of faces) for (const c of f.corners) bump(c);
  for (const c of [...sp1, ...sp2]) bump(c);
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of [...sp1, ...sp2, ...faces.flatMap((f) => f.corners)]) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, planets, bounds: { center, radius: radius || span }, stats: { scenario: 'collision', g: 0, samples: N_SAMPLES, period, loop: false, T } };
}

/**
 * COMPARISON mode (Phase 3d): run the SAME scenario twice with one parameter varied, in two depth lanes,
 * so the operator can watch them race. `compare:'gravity'` → Earth-g vs Moon-g (the slow ball lands
 * later); `compare:'mass'` → light vs heavy, where the motions stay locked together (Galileo: mass
 * cancels). One-shot scenarios share a reset cycle so they restart in step; the pendulum loops at each
 * body's own period (so they correctly drift apart). A dual readout names both bodies + their times.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planCompareScene(recipe = {}) {
  const scenario = COMPARE_SCENARIOS.has(recipe.scenario) ? recipe.scenario : 'free-fall';
  const mode = recipe.compare === 'mass' ? 'mass' : 'gravity';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const vectors = recipe.vectors === false ? false : true;
  const strobe = recipe.strobe === false ? false : true;
  const strobeEvery = Math.round(clampNum(recipe.strobeEvery, 4, 40, 12));
  const g = clampNum(recipe.g, 0.5, 40, 9.8);
  const massA = clampNum(recipe.mass, 0.1, 100, 1);
  const baseP = (gg, mm) => ({ g: gg, mass: mm, v0: recipe.v0, angle: recipe.angle, mu: recipe.mu, length: recipe.length, height: recipe.height });

  let PA, PB, labA, labB, note;
  if (mode === 'mass') {
    const massB = clampNum(recipe.mass2, 0.1, 100, 6);
    PA = baseP(g, massA); PB = baseP(g, massB);
    labA = `${massA} kg`; labB = `${massB} kg`; note = 'same motion — mass cancels (Galileo)';
  } else {
    const gB = clampNum(recipe.g2, 0.5, 40, MOON_G);
    PA = baseP(g, massA); PB = baseP(gB, massA);
    labA = `g ${g}`; labB = `g ${gB}`; note = 'lower g → slower';
  }
  const simA = MECHANICS_RULES[scenario](PA), simB = MECHANICS_RULES[scenario](PB);
  const unitLabel = simA.loop ? 'T' : 'lands';

  const extent = (sim) => { const xs = sim.path.map((p) => p[0]), zs = sim.path.map((p) => p[2]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs), 1); };
  const span = Math.max(extent(simA), extent(simB)) * scale;
  const baseR = Math.min(1.2 * scale, Math.max(0.4, span * 0.03));
  const rA = baseR * Math.cbrt(PA.mass), rB = baseR * Math.cbrt(PB.mass);
  const laneGap = Math.max(span * 0.16, 2.2 * scale);
  const mapLane = (p, y) => [p[0] * scale, y, p[2] * scale];
  const pathA = simA.path.map((p) => mapLane(p, -laneGap)), pathB = simB.path.map((p) => mapLane(p, laneGap));

  const faces = [], picks = [], planets = [];
  const tag = (fs, group) => { for (const f of fs) faces.push({ ...f, group }); };

  // strobe afterimages per lane (their differing spacing IS the comparison, frozen) — dim, never picked.
  if (strobe) {
    for (let i = strobeEvery; i < N_SAMPLES - 1; i += strobeEvery) {
      tag(lowerObjectFaces({ lathes: [sphereSpec(pathA[i], rA * 0.72, GHOST_TINT, 14)] }, WORKBENCH_LIGHT), 'scene');
      tag(lowerObjectFaces({ lathes: [sphereSpec(pathB[i], rB * 0.72, GHOST2_TINT, 14)] }, WORKBENCH_LIGHT), 'scene');
    }
  }

  planets.push(litBody('body', rA, BODY_TINT));
  planets.push(litBody('body2', rB, BODY2_TINT));
  picks.push({ name: 'body', kind: 'body', label: `A · ${labA}`, fields: compactFields([[mode === 'mass' ? 'mass' : 'g', labA], [unitLabel === 'T' ? 'period' : 't_land', `${simA.T.toFixed(2)} s`], ...simA.facts]) });
  picks.push({ name: 'body2', kind: 'body', label: `B · ${labB}`, fields: compactFields([[mode === 'mass' ? 'mass' : 'g', labB], [unitLabel === 'T' ? 'period' : 't_land', `${simB.T.toFixed(2)} s`], ...simB.facts]) });

  // ground spanning both lanes.
  const allX = [...pathA, ...pathB].map((p) => p[0]);
  const pad = Math.max(span * 0.12, 3 * scale);
  const gx0 = Math.min(...allX) - pad, gx1 = Math.max(...allX) + pad;
  const yLo = -laneGap - laneGap * 0.7, yHi = laneGap + laneGap * 0.7;
  tag([quad([[gx0, yLo, 0], [gx1, yLo, 0], [gx1, yHi, 0], [gx0, yHi, 0]], GROUND_FILL, 'scene'),
    quad([[gx0, yLo, 0], [gx0, yHi, 0], [gx0, yHi, -span * 0.04], [gx0, yLo, -span * 0.04]], GROUND_EDGE, 'scene')], 'scene');
  if (simA.ramp) {   // both bodies share one inclined plane drawn between the lanes
    const R = simA.ramp, Tp = scl(R.top, scale), C = scl(R.bottomCorner, scale);
    tag(prismFaces([[Tp[0], Tp[2]], [C[0], C[2]], [0, 0]], laneGap * 1.4, RAMP_TOP, RAMP_SIDE, 'scene'), 'scene');
  }

  const dtA = simA.T / (N_SAMPLES - 1), dtB = simB.T / (N_SAMPLES - 1);
  const kA = deriveKinematics(pathA, dtA), kAp = deriveKinematics(simA.path, dtA);
  const kB = deriveKinematics(pathB, dtB), kBp = deriveKinematics(simB.path, dtB);
  const arrowLen = Math.max(2.5, span * 0.16);
  // timing: scale both real times by one factor so the slower body visibly lags. One-shot scenarios share
  // a reset cycle (restart together); looping pendulums run at their own period (drift apart, correctly).
  const Tmax = Math.max(simA.T, simB.T), scaleP = 3.5 / Tmax, loop = !!simA.loop;
  const cycle = Tmax * scaleP + 1.2;
  const mk = (group, path, base, k, kp, sim) => ({
    group, path, basePos: base, vdir: k.vdir, speed: kp.speed, avec: k.avec, accel: kp.accel,
    maxSpeed: kp.maxSpeed, maxAccel: kp.maxAccel, vectors, arrowLen, duration: sim.T,
    period: sim.T * scaleP, loop, hold: loop ? 0 : cycle - sim.T * scaleP,
    ...(sim.tether ? { tether: mapLane(sim.tether, group === 'body' ? -laneGap : laneGap) } : {}),
  });
  const movers = [
    { ...mk('body', pathA, [0, 0, 0], kA, kAp, simA), label: `Compare · ${mode}`,
      compare: { mode, labA, labB, ta: simA.T, tb: simB.T, unitLabel, note } },
    mk('body2', pathB, [0, 0, 0], kB, kBp, simB),
  ];

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; } };
  for (const f of faces) for (const c of f.corners) bump(c);
  for (const c of [...pathA, ...pathB]) bump(c);
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of [...pathA, ...pathB, ...faces.flatMap((f) => f.corners)]) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, planets, bounds: { center, radius: radius || span }, stats: { scenario, g, samples: N_SAMPLES, period: cycle, loop, T: Tmax } };
}

const MACHINE_FILL = '#3a4150';     // beams / shafts / frames — cool steel set-dressing
const MACHINE_EDGE = '#2a3040';
const RIM_TINT = '#cf8a4a';         // a contrasting paint mark on a wheel rim, so its rotation is legible
const LOAD_TINT = '#e0b15f';        // the load being moved (gold, the dynamics body colour)
const EFFORT_TINT = '#7fa8d6';      // the effort marker (steel-blue, distinct from the load)

const TAU2 = Math.PI * 2;
const phase = (n, ang) => Array.from({ length: n }, (_, i) => ang * (i / (n - 1)));   // 0→ang over the stroke
// author faces RELATIVE to `center` and pair them with a phase-driven `turn` mover that pivots them about it.
function turnMover(absFaces, center, axis, angles, group, period, hold) {
  const faces = absFaces.map((f) => ({ ...f, group, corners: f.corners.map((c) => sub(c, center)) }));
  return { faces, mover: { group, basePos: [0, 0, 0], turn: { axis, center, angles }, period, loop: false, hold, vectors: false } };
}
// contrasting spokes across a wheel's FRONT face (at depth `yf`) — radial bars whose rotation is
// unmistakable (a smooth disc spinning is invisible). `n` bars, each a thin quad centre→rim.
function wheelSpokes(center, R, yf, n = 4) {
  const faces = [], w = Math.max(0.08, R * 0.07);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), px = -dz * w, pz = dx * w;
    const ox = center[0], oz = center[2], tx = center[0] + dx * R * 0.92, tz = center[2] + dz * R * 0.92;
    faces.push(quad([[ox + px, yf, oz + pz], [ox - px, yf, oz - pz], [tx - px, yf, tz - pz], [tx + px, yf, tz + pz]], RIM_TINT, 'wheel'));
  }
  return faces;
}

/**
 * Build a machine's structure AND its articulation: static frame faces go to group 'scene'; the parts that
 * actually MOVE (a tilting lever beam, a spinning wheel/screw, a driven wedge) are authored as their own
 * groups paired with a `turn`/slide mover on the same play→hold→replay cycle as the load. Returns the extra
 * movers + every part's WORLD-space corners (for camera-framing bounds, since the turn faces are stored
 * pivot-relative). Pure; tags faces through `tag`.
 */
function buildMachineRig(sim, scale, span, period, hold, tag) {
  const st = sim.structure, halfY = Math.max(1.2, span * 0.07), thickZ = Math.max(0.5, span * 0.025);
  const N = sim.loadPath.length, movers = [], pts = [];
  const stat = (fs) => { tag(fs, 'scene'); for (const f of fs) for (const c of f.corners) pts.push(c); };
  const turn = (absFaces, center, axis, angles, group) => {
    for (const f of absFaces) for (const c of f.corners) pts.push(c);   // world extent for bounds
    const tp = turnMover(absFaces, center, axis, angles, group, period, hold);
    tag(tp.faces, group); movers.push(tp.mover);
  };

  if (st.type === 'lever') {
    const fulc = scl(st.fulcrum, scale), base = Math.max(0.7, span * 0.05);
    stat(triPrism([[fulc[0], fulc[2]], [fulc[0] - base, 0], [fulc[0] + base, 0]], halfY, MACHINE_EDGE, 'scene'));
    const lx = st.loadEnd[0] * scale, ex = st.effortEnd[0] * scale, x0 = Math.min(lx, ex), x1 = Math.max(lx, ex);
    const beam = beamBox(x0, x1, fulc[2], thickZ, halfY * 0.7, MACHINE_FILL, 'lever_beam');   // tilts about the fulcrum
    turn(beam, fulc, [0, 1, 0], phase(N, st.sense * st.theta), 'lever_beam');
  } else if (st.type === 'wheel-axle') {
    const c0 = scl(st.center, scale), yBack = halfY * 1.1, c = [c0[0], yBack, c0[2]], R = st.R * scale, r = st.r * scale;
    const wheel = [...cylinderFaces(c, R, [0, 1, 0], halfY, MACHINE_FILL, 'wa'),
      ...cylinderFaces(c, r, [0, 1, 0], halfY * 1.6, MACHINE_EDGE, 'wa'),
      ...wheelSpokes(c, R, c[1] - halfY - 0.05, 6)];
    turn(wheel, c, [0, 1, 0], phase(N, -st.turn), 'wa_wheel');                 // turns as the rope unwinds
  } else if (st.type === 'pulley') {
    const topZ = st.topZ * scale, yBack = halfY * 1.1, prr = Math.max(0.8, span * 0.05);
    stat(beamBox(-3 * scale, 4.4 * scale, topZ, thickZ, halfY, MACHINE_FILL, 'scene'));
    const xs = st.ptype === 'fixed' ? [0] : [0, 3 * scale];
    xs.forEach((cx, k) => {                                                    // each wheel spins about its OWN centre
      const ctr = [cx, yBack, topZ - prr];
      const w = [...cylinderFaces(ctr, prr, [0, 1, 0], halfY, MACHINE_EDGE, 'pw'), ...wheelSpokes(ctr, prr, ctr[1] - halfY - 0.05, 4)];
      turn(w, ctr, [0, 1, 0], phase(N, -st.pr * 4), `pulley_w${k}`);
    });
  } else if (st.type === 'incline') {
    const ax = st.L * Math.cos(st.al) * scale, hh = st.h * scale;             // the load rolls up the real slope —
    stat(triPrism([[0, 0], [ax, 0], [ax, hh]], halfY, RAMP_TOP, 'scene'));    // a sphere needs no spin, so the ramp is static
  } else if (st.type === 'wedge') {
    const Wd = st.L * 0.6 * scale, t = st.t * scale, z0 = st.cz0 * scale, drive = st.L * scale;
    const wedge = triPrism([[-Wd, z0 - 0.4 * scale], [Wd, z0 - 0.4 * scale], [-Wd, z0 - 0.4 * scale + t]], halfY, MACHINE_FILL, 'wedge_tool');
    const path = Array.from({ length: N }, (_, i) => [-drive * (1 - i / (N - 1)), 0, 0]);   // driven IN (+x) over the stroke
    for (const f of wedge) { for (const c of f.corners) { pts.push(c); pts.push([c[0] - drive, c[1], c[2]]); } }
    tag(wedge.map((f) => ({ ...f, group: 'wedge_tool' })), 'wedge_tool');
    movers.push({ group: 'wedge_tool', path, basePos: [0, 0, 0], period, loop: false, hold, vectors: false });
  } else if (st.type === 'screw') {
    const len2 = (st.axisLen * scale) / 2, baseZ = scale * 0.4, ctr = [0, 0, baseZ + len2];
    const body = [...cylinderFaces(ctr, st.r * scale * 0.6, [0, 0, 1], len2, MACHINE_EDGE, 'sc'),
      ...helixRibbon([0, 0, baseZ], st.r * scale, st.axisLen * scale, st.turns, MACHINE_FILL, 'sc')];
    turn(body, ctr, [0, 0, 1], phase(N, -st.turns * TAU2), 'screw_thread');    // the thread turns as the nut descends
  } else if (st.type === 'gear-train') {
    // each gear is its own `turn` group spinning about its own y-axis at its own (signed, ratioed) angle —
    // so meshing gears visibly counter-rotate at ω ∝ 1/r. A crank arm rides the driver; a drum + rope lift.
    const yB = halfY * 1.1, gth = Math.max(0.5, halfY * 0.5);
    st.gears.forEach((G, k) => {
      const c = [G.x * scale, yB, G.z * scale], R = G.r * scale, depth = G.shaft ? halfY * 0.7 : halfY;
      const faces = gearFaces(c, R, R * 0.18, G.teeth, [0, 1, 0], depth, k === 0 ? MACHINE_FILL : MACHINE_EDGE, 'g');
      if (G.crank) {   // a contrasting crank arm + handle pin on the driver, so the input rotation reads
        const hr = G.crank * scale;
        faces.push(...beamBox(0, hr, c[2], gth, gth, RIM_TINT, 'g').map((f) => ({ ...f, corners: f.corners.map((p) => [p[0] + c[0], p[1] + (c[1] - halfY - 0.05) - 0, p[2]]) })));
        faces.push(...lowerObjectFaces({ lathes: [sphereSpec([c[0] + hr, c[1] - halfY - 0.05, c[2]], gth * 1.3, RIM_TINT, 12)] }, WORKBENCH_LIGHT));
      }
      turn(faces, c, [0, 1, 0], phase(N, G.angle), `gear${k}`);
    });
    const dc = [st.drum.x * scale, yB, st.drum.z * scale];                      // output drum (winds the load rope)
    stat(cylinderFaces(dc, st.drum.r * scale, [0, 1, 0], halfY * 1.3, MACHINE_FILL, 'scene'));
  } else if (st.type === 'screw-jack') {
    // a vertical screw (rod + thread) plus a horizontal lever ARM, ALL one `turn` group about the screw
    // axis; the load nut (the body) climbs the turning thread.
    const len2 = (st.axisLen * scale) / 2, baseZ = scale * 0.4, ctr = [0, 0, baseZ + len2], rr = st.r * scale;
    const L = st.L * scale, lz = st.leverZ * scale, lh = Math.max(0.5, halfY * 0.5);
    const body = [...cylinderFaces(ctr, rr * 0.7, [0, 0, 1], len2, MACHINE_EDGE, 'sj'),
      ...helixRibbon([0, 0, baseZ], rr, st.axisLen * scale, st.turns, MACHINE_FILL, 'sj'),
      ...beamBox(-L, L, lz, lh, lh, RIM_TINT, 'sj'),                            // the lever arm (turns the screw)
      ...lowerObjectFaces({ lathes: [sphereSpec([L, 0, lz], lh * 1.4, RIM_TINT, 12)] }, WORKBENCH_LIGHT)];
    turn(body, [0, 0, lz], [0, 0, 1], phase(N, st.angle), 'jack_screw');
    stat(cylinderFaces([0, 0, 0.3 * scale], rr * 1.5, [0, 0, 1], 0.3 * scale, MACHINE_FILL, 'scene'));   // base
  } else if (st.type === 'crane') {
    const yB = halfY * 1.1, R = st.R * scale, r = st.r * scale, cz = st.cz * scale, px = st.px * scale, topZ = st.topZ * scale;
    const crank = [...cylinderFaces([0, yB, cz], R, [0, 1, 0], halfY, MACHINE_FILL, 'cw'),   // crank wheel & axle
      ...cylinderFaces([0, yB, cz], r, [0, 1, 0], halfY * 1.5, MACHINE_EDGE, 'cw'),
      ...wheelSpokes([0, yB, cz], R, yB - halfY - 0.05, 6)];
    turn(crank, [0, yB, cz], [0, 1, 0], phase(N, st.theta), 'crane_crank');
    const pr = Math.max(0.8, span * 0.045);                                    // fixed head pulley + a jib boom
    stat(cylinderFaces([px, yB, topZ], pr, [0, 1, 0], halfY, MACHINE_EDGE, 'scene'));
    stat(beamBox(0, px + pr, topZ + pr, Math.max(0.4, span * 0.02), halfY, MACHINE_FILL, 'scene'));
  }
  return { movers, pts };
}

/**
 * SIMPLE MACHINE (lever / wheel-axle / pulley / inclined plane / wedge / screw): a quasi-static depictor
 * of MECHANICAL ADVANTAGE and the CONSERVATION OF WORK. The load body moves along its real path while an
 * optional effort marker moves through the larger effort distance; a machine readout (MA, effort vs load
 * force) + work bars (W_in vs W_out, with a friction gap when η<1) carry the lesson that a machine
 * multiplies force, never work. Same recipe shape as planMechanicsScene's siblings.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planMachineScene(recipe = {}) {
  const scenario = MACHINE_RULES[recipe.scenario] ? recipe.scenario : 'lever';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const g = clampNum(recipe.g, 0.5, 40, 9.8);
  const eff = clampNum(recipe.efficiency, 0.2, 1, 1);
  // pass `mass` raw so each rule applies its OWN sensible default (a screw jack lifts a heavier load than a
  // lever); the effective load mass is then read back from the resolved load force for body sizing.
  const P = { g, mass: recipe.mass, efficiency: eff, angle: recipe.angle, length: recipe.length,
    armEffort: recipe.armEffort, armLoad: recipe.armLoad, leverClass: recipe.leverClass,
    rWheel: recipe.rWheel, rAxle: recipe.rAxle, ropes: recipe.ropes, pulleyType: recipe.pulleyType,
    thickness: recipe.thickness, radius: recipe.radius, pitch: recipe.pitch };
  const sim = MACHINE_RULES[scenario](P);

  const sc = (p) => (scale === 1 ? p : scl(p, scale));
  const loadPath = sim.loadPath.map(sc);
  const effortPath = sim.effortPath ? sim.effortPath.map(sc) : null;
  const allPts = [...loadPath, ...(effortPath || [])];

  const xs = allPts.map((p) => p[0]), zs = allPts.map((p) => p[2]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 4);
  const rLoad = Math.max(0.5, 0.55 * Math.cbrt(sim.loadForce / g)) * scale, rEff = rLoad * 0.7;

  const faces = [], picks = [], planets = [];
  const tag = (fs, group) => { for (const f of fs) faces.push({ ...f, group }); };

  const period = 3.2, hold = 1.4;
  const rig = buildMachineRig(sim, scale, span, period, hold, tag);

  planets.push(litBody('body', rLoad, LOAD_TINT));
  if (effortPath) planets.push(litBody('body2', rEff, EFFORT_TINT));

  picks.push({ name: 'body', kind: 'body', label: sim.label, fields: compactFields([
    ['MA', sim.MA_ideal.toFixed(2)], ['effort', `${sim.effortForce.toFixed(0)} N`], ['load', `${sim.loadForce.toFixed(0)} N`],
    ['d_in', `${sim.dIn.toFixed(1)} m`], ['d_out', `${sim.dOut.toFixed(1)} m`], ['efficiency', `${(sim.efficiency * 100).toFixed(0)}%`], ...sim.facts]) });
  if (effortPath) picks.push({ name: 'body2', kind: 'body', label: 'Effort', fields: compactFields([['force', `${sim.effortForce.toFixed(0)} N`], ['travels', `${sim.dIn.toFixed(1)} m`]]) });

  const yHalf = Math.max(span * 0.12, 2 * scale), gpad = Math.max(span * 0.12, 3 * scale);
  const allX = rig.pts.map((c) => c[0]).concat(xs);
  const gx0 = Math.min(...allX) - gpad, gx1 = Math.max(...allX) + gpad;
  const ground = [quad([[gx0, -yHalf, 0], [gx1, -yHalf, 0], [gx1, yHalf, 0], [gx0, yHalf, 0]], GROUND_FILL, 'scene'),
    quad([[gx0, -yHalf, 0], [gx0, yHalf, 0], [gx0, yHalf, -span * 0.04], [gx0, -yHalf, -span * 0.04]], GROUND_EDGE, 'scene')];
  tag(ground, 'scene');

  const dt = sim.T / (loadPath.length - 1);
  const kLoad = deriveKinematics(loadPath, dt);
  const arrowLen = Math.max(2.5, span * 0.16);
  const machine = { type: sim.machine, MA_ideal: sim.MA_ideal, MA_actual: sim.MA_actual,
    effortForce: sim.effortForce, loadForce: sim.loadForce, dIn: sim.dIn, dOut: sim.dOut, efficiency: sim.efficiency,
    workIn: sim.workIn, workOut: sim.workOut, workFriction: sim.workFriction, maxWork: Math.max(...sim.workIn, 1e-6),
    ...(sim.stages ? { stages: sim.stages } : {}) };

  // optional rope tethers (pulley / wheel-axle): a line from a fixed anchor to the moving marker reads as
  // the rope, so the load and effort no longer float disconnected.
  const loadAnchor = sim.structure.loadAnchor ? sc(sim.structure.loadAnchor) : null;
  const effortAnchor = sim.structure.effortAnchor ? sc(sim.structure.effortAnchor) : null;
  const movers = [{
    group: 'body', path: loadPath, basePos: [0, 0, 0],
    vdir: kLoad.vdir, speed: kLoad.speed, avec: kLoad.avec, accel: kLoad.accel,
    maxSpeed: kLoad.maxSpeed, maxAccel: kLoad.maxAccel,
    period, loop: false, hold: 1.4, vectors: false, arrowLen, duration: sim.T, g, label: sim.label, machine,
    ...(loadAnchor ? { tether: loadAnchor } : {}),
  }];
  if (effortPath) {
    const kEff = deriveKinematics(effortPath, dt);
    movers.push({ group: 'body2', path: effortPath, basePos: [0, 0, 0],
      vdir: kEff.vdir, speed: kEff.speed, avec: kEff.avec, accel: kEff.accel,
      maxSpeed: kEff.maxSpeed, maxAccel: kEff.maxAccel,
      period, loop: false, hold, vectors: false, arrowLen, duration: sim.T, label: 'Effort',
      ...(effortAnchor ? { tether: effortAnchor } : {}) });
  }
  movers.push(...rig.movers);   // the articulating structure (tilting beam, spinning wheel/screw, driven wedge)

  // bounds over WORLD points: the motion paths + every structure corner (the `turn` faces are stored
  // pivot-relative, so we use the world extents the rig collected) + the ground.
  const wpts = [...allPts, ...rig.pts, ...ground.flatMap((f) => f.corners)];
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of wpts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of wpts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, planets, bounds: { center, radius: radius || span }, stats: { scenario, g, samples: MACHINE_SAMPLES, period, loop: false, T: sim.T } };
}

/**
 * RECIPROCATING ENGINE (steam): the slider-crank that converts a piston's reciprocating motion into the
 * crankshaft's rotary motion. A flywheel (TURN) carries the crank; a connecting rod (the new LINK mover)
 * spans the orbiting crank pin to the reciprocating crosshead (TRANSLATE); a static cylinder + crosshead
 * guides + bed frame it. Loops continuously. The crosshead carries an `engine` readout (crank angle, the
 * dead-centres where the piston stops, rpm). Pure kinematics — exact slider-crank.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planEngineScene(recipe = {}) {
  if (recipe.scenario === 'inline-four') return planInlineScene(recipe);       // inline multi-cylinder branch
  if (recipe.scenario === 'combustion') return planCombustionScene(recipe);   // vertical 4-stroke branch
  const scenario = ENGINE_RULES[recipe.scenario] ? recipe.scenario : 'steam-engine';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const sim = ENGINE_RULES[scenario]({ crankRadius: recipe.crankRadius, rodLength: recipe.rodLength, flywheelR: recipe.flywheelR, rpm: recipe.rpm });
  const sc = (p) => scl(p, scale);
  const crankPin = sim.crankPin.map(sc), pistonPin = sim.pistonPin.map(sc);
  const C = sc(sim.crankCenter), r = sim.r * scale, fR = sim.fR * scale, zc = sim.zc * scale;
  const N = crankPin.length, period = sim.period;

  const allX = [...crankPin, ...pistonPin].map((p) => p[0]);
  const span = (Math.max(...allX) + fR) - Math.min(...allX);
  const halfY = Math.max(1.0, span * 0.035), yBack = halfY * 1.1, thick = Math.max(0.22, span * 0.011);
  const bore = Math.max(0.8, fR * 0.32);

  const faces = [], picks = [], movers = [], pts = [];
  for (const c of [...crankPin, ...pistonPin]) pts.push(c);
  const addStatic = (fs) => { for (const f of fs) { faces.push(f); for (const c of f.corners) pts.push(c); } };
  const addTurn = (absFaces, center, angles, group) => {
    for (const f of absFaces) for (const c of f.corners) pts.push(c);
    const tp = turnMover(absFaces, center, [0, 1, 0], angles, group, period, 0);
    for (const f of tp.faces) faces.push(f);
    movers.push({ ...tp.mover, loop: true });   // an engine runs continuously
  };

  // ── flywheel + crank web + crank pin: ONE turn group about the crank axis. The disc sits BEHIND (yBack);
  // the crank web + pin ride the FRONT (y≈0) so the connecting rod meets the pin cleanly.
  const fly = [
    ...cylinderFaces([C[0], yBack, zc], fR, [0, 1, 0], halfY, MACHINE_FILL, 'fly'),
    ...cylinderFaces([C[0], yBack, zc], fR * 0.16, [0, 1, 0], halfY * 1.5, MACHINE_EDGE, 'fly'),     // hub
    ...wheelSpokes([C[0], yBack, zc], fR, yBack - halfY - 0.05, 6),
    ...beamBox(C[0], C[0] + r, zc, thick * 2.2, thick * 2.2, RIM_TINT, 'fly'),                       // crank web (front)
    ...cylinderFaces([C[0] + r, 0, zc], thick * 2.4, [0, 1, 0], thick * 3, RIM_TINT, 'fly'),         // crank pin (front)
  ];
  addTurn(fly, [C[0], 0, zc], sim.angle, 'flywheel');

  // ── connecting rod: a LINK spanning the crank pin (A) → the crosshead pin (B), authored as a unit bar.
  const rodGeo = beamBox(0, 1, 0, thick * 1.8, thick * 1.8, RIM_TINT, 'conrod');
  for (const f of rodGeo) faces.push({ ...f, group: 'conrod' });
  movers.push({ group: 'conrod', basePos: [0, 0, 0], link: true, from: crankPin, to: pistonPin, period, loop: true, vectors: false });

  // ── crosshead + piston rod: a TRANSLATE group reciprocating along the cylinder axis. The piston itself
  // is hidden inside the cylinder; the rod slides through the gland to the crosshead (where the rod pins).
  const p0 = pistonPin[0], rodGap = sim.stroke * scale + bore + 1.2 * scale;
  const crosshead = [
    ...beamBox(p0[0] - bore * 0.5, p0[0] + bore * 0.5, zc, bore * 1.7, bore * 0.85, LOAD_TINT, 'cross'),   // crosshead block
    ...beamBox(p0[0] - rodGap, p0[0], zc, thick * 1.6, thick * 1.6, MACHINE_EDGE, 'cross'),                // piston rod
  ];
  for (const f of crosshead) faces.push({ ...f, group: 'cross' });
  const dtReal = (60 / sim.rpm) / (N - 1), kPhys = deriveKinematics(sim.pistonPin, dtReal);
  movers.push({ group: 'cross', path: pistonPin, basePos: p0, period, loop: true, hold: 0, vectors: false,
    speed: kPhys.speed, maxSpeed: kPhys.maxSpeed, label: sim.label,
    engine: { engine: sim.engine, rpm: sim.rpm, stroke: sim.stroke, angle: sim.angle } });
  picks.push({ name: 'cross', kind: 'body', label: sim.label, fields: compactFields([['type', 'slider-crank'], ['stroke', `${sim.stroke.toFixed(1)} m`], ['rpm', `${sim.rpm}`], ['rod', `${sim.L.toFixed(1)} m`], ['flywheel R', `${sim.fR.toFixed(1)} m`]]) });

  // the crosshead drives the readout → it must be the FIRST mover.
  movers.unshift(movers.pop());

  // ── static frame: cylinder (the piston hides inside), crosshead guides, the bed, and the crank pedestal.
  const pminX = Math.min(...pistonPin.map((p) => p[0])), pmaxX = Math.max(...pistonPin.map((p) => p[0]));
  const cylRight = pminX - 0.2 * scale, cylLeft = pminX - rodGap - bore;
  addStatic(cylinderFaces([(cylLeft + cylRight) / 2, 0, zc], bore * 1.12, [1, 0, 0], (cylRight - cylLeft) / 2, MACHINE_EDGE, 'scene'));
  const gGap = bore * 1.5;
  addStatic(beamBox(pminX - 1.2 * scale, pmaxX + 1.2 * scale, zc + gGap, thick * 2, halfY, MACHINE_FILL, 'scene'));
  addStatic(beamBox(pminX - 1.2 * scale, pmaxX + 1.2 * scale, zc - gGap, thick * 2, halfY, MACHINE_FILL, 'scene'));
  addStatic(cylinderFaces([C[0], yBack, zc * 0.5], thick * 3.5, [0, 0, 1], zc * 0.5, MACHINE_FILL, 'scene'));   // crank pedestal
  const bedX0 = cylLeft - 1.5 * scale, bedX1 = C[0] + fR + 1.5 * scale;
  addStatic(beamBox(bedX0, bedX1, 0.45 * scale, 0.9 * scale, halfY * 1.5, MACHINE_FILL, 'scene'));

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of pts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of pts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, bounds: { center, radius: radius || span }, stats: { scenario: sim.engine, g: 0, samples: N, period, loop: true, T: period } };
}

const VALVE_IN = '#5fd0c0', VALVE_EX = '#e0606a', SPARK_TINT = '#ffd36b';   // intake teal / exhaust red / spark

/**
 * SINGLE-CYLINDER 4-STROKE (Otto) ENGINE: the slider-crank mounted VERTICALLY, in cutaway, with the full
 * thermodynamic cycle over two revolutions. The piston (TRANSLATE) is visible between cutaway bore walls;
 * the connecting rod (LINK) runs to the crank pin on a flywheel (TURN, two turns per cycle); poppet INTAKE
 * and EXHAUST valves (TRANSLATE, cam-profile lift) breathe over their strokes; a combustion flash (PULSE)
 * fires at the power stroke. The piston carries the 4-stroke readout (intake → compression → power → exhaust).
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planCombustionScene(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const sim = ENGINE_RULES.combustion({ crankRadius: recipe.crankRadius, rodLength: recipe.rodLength, flywheelR: recipe.flywheelR, rpm: recipe.rpm });
  const sc = (p) => scl(p, scale);
  const crankPin = sim.crankPin.map(sc), pistonPin = sim.pistonPin.map(sc);
  const C = sc(sim.crankCenter), r = sim.r * scale, fR = sim.fR * scale, bore = sim.bore * scale, zC = sim.zC * scale;
  const N = crankPin.length, period = sim.period;
  const TDC = zC + r + sim.L * scale, BDC = zC - r + sim.L * scale;
  const halfY = Math.max(1.0, bore * 1.15), yBack = halfY * 1.1, thick = Math.max(0.2, bore * 0.16);
  const wall = bore * 0.5, pistonH = bore * 1.0;

  const faces = [], picks = [], movers = [], pts = [];
  for (const c of [...crankPin, ...pistonPin]) pts.push(c);
  const addStatic = (fs) => { for (const f of fs) { faces.push(f); for (const c of f.corners) pts.push(c); } };
  const addGroup = (fs, group) => { for (const f of fs) { faces.push({ ...f, group }); for (const c of f.corners) pts.push(c); } };

  // ── flywheel + crank web + pin (TURN about the crank axis; two revolutions per cycle) ──
  const fly = [
    ...cylinderFaces([C[0], yBack, zC], fR, [0, 1, 0], halfY, MACHINE_FILL, 'fly'),
    ...cylinderFaces([C[0], yBack, zC], fR * 0.16, [0, 1, 0], halfY * 1.5, MACHINE_EDGE, 'fly'),
    ...wheelSpokes([C[0], yBack, zC], fR, yBack - halfY - 0.05, 6),
    ...beamBox(C[0] - thick, C[0] + thick, zC + r * 0.5, r, thick * 2.2, RIM_TINT, 'fly'),                // crank web (hub → pin)
    ...cylinderFaces([C[0], 0, zC + r], thick * 2.4, [0, 1, 0], thick * 3, RIM_TINT, 'fly'),              // crank pin (front, φ=0 = top)
  ];
  for (const f of fly) for (const c of f.corners) pts.push(c);
  { const tp = turnMover(fly, [C[0], 0, zC], [0, 1, 0], sim.angle, 'flywheel', period, 0); for (const f of tp.faces) faces.push(f); movers.push({ ...tp.mover, loop: true }); }

  // ── connecting rod (LINK: crank pin → piston wrist pin) ──
  const rodGeo = beamBox(0, 1, 0, thick * 1.8, thick * 1.8, RIM_TINT, 'conrod');
  for (const f of rodGeo) faces.push({ ...f, group: 'conrod' });
  movers.push({ group: 'conrod', basePos: [0, 0, 0], link: true, from: crankPin, to: pistonPin, period, loop: true, vectors: false });

  // ── piston (TRANSLATE, visible in the cutaway bore) ──
  const p0 = pistonPin[0];
  const piston = cylinderFaces(p0, bore * 0.92, [0, 0, 1], pistonH / 2, LOAD_TINT, 'piston');
  for (const f of piston) faces.push({ ...f, group: 'piston' });
  const dtReal = (2 * 60 / sim.rpm) / (N - 1), kPhys = deriveKinematics(sim.pistonPin, dtReal);
  movers.push({ group: 'piston', path: pistonPin, basePos: p0, period, loop: true, hold: 0, vectors: false,
    speed: kPhys.speed, maxSpeed: kPhys.maxSpeed, label: sim.label,
    engine: { engine: sim.engine, rpm: sim.rpm, stroke: sim.stroke, angle: sim.angle } });
  picks.push({ name: 'piston', kind: 'body', label: sim.label, fields: compactFields([['cycle', '4-stroke / 720°'], ['stroke', `${sim.stroke.toFixed(1)} m`], ['rpm', `${sim.rpm}`], ['bore', `${(sim.bore * 2).toFixed(1)} m`]]) });

  // ── poppet valves (TRANSLATE: a stem + head that lift DOWN over their stroke) ──
  const chamberTop = TDC + bore * 0.5, headH = bore * 1.2, maxLift = bore * 0.6, stemH = headH * 1.4;
  const mkValve = (vx, tint, lift, group) => {
    const v = [...beamBox(vx - thick, vx + thick, chamberTop + stemH / 2, stemH, thick * 1.6, tint, group),   // stem
      ...cylinderFaces([vx, 0, chamberTop], bore * 0.3, [0, 0, 1], thick * 1.6, tint, group)];                 // valve head
    for (const f of v) faces.push({ ...f, group });
    const path = lift.map((Lf) => [vx, 0, chamberTop - Lf * maxLift]);
    for (const p of path) pts.push([vx, 0, p[2]]);
    movers.push({ group, path, basePos: [vx, 0, chamberTop], period, loop: true, hold: 0, vectors: false });
  };
  mkValve(-bore * 0.5, VALVE_IN, sim.intakeLift, 'intake');
  mkValve(bore * 0.5, VALVE_EX, sim.exhaustLift, 'exhaust');

  // ── spark plug + combustion flash (PULSE, fires once per cycle at the power stroke) ──
  addStatic(beamBox(-thick, thick, chamberTop + bore * 0.2, bore * 0.5, thick * 1.4, MACHINE_EDGE, 'scene'));   // plug body
  const flash = lowerObjectFaces({ lathes: [sphereSpec([0, 0, 0], 1, SPARK_TINT, 14)] }, WORKBENCH_LIGHT);
  for (const f of flash) faces.push({ ...f, group: 'spark' });
  movers.push({ group: 'spark', basePos: [0, 0, 0], pulse: { phase: sim.sparkPhase, width: 0.05, size: bore * 1.2, at: [0, 0, TDC + bore * 0.2] }, period, loop: true, vectors: false });

  // ── static frame: cutaway bore walls, head, crankcase, bed ──
  const cylBot = BDC - pistonH, cylTop = chamberTop;
  const wallMidZ = (cylBot + cylTop) / 2, wallH = cylTop - cylBot;
  addStatic(beamBox(-bore - wall, -bore, wallMidZ, wallH, halfY, MACHINE_EDGE, 'scene'));     // left bore wall
  addStatic(beamBox(bore, bore + wall, wallMidZ, wallH, halfY, MACHINE_EDGE, 'scene'));       // right bore wall
  addStatic(beamBox(-bore - wall, bore + wall, chamberTop + headH / 2, headH, halfY, MACHINE_FILL, 'scene'));   // head
  addStatic(beamBox(-bore - wall - 0.5 * scale, -bore - wall, (cylBot + zC) / 2, cylBot - zC + 1, halfY, MACHINE_FILL, 'scene'));   // crankcase wall L
  addStatic(beamBox(bore + wall, bore + wall + 0.5 * scale, (cylBot + zC) / 2, cylBot - zC + 1, halfY, MACHINE_FILL, 'scene'));     // crankcase wall R
  addStatic(beamBox(-bore - wall - 1.2 * scale, C[0] + fR + 1.2 * scale, 0.45 * scale, 0.9 * scale, halfY * 1.6, MACHINE_FILL, 'scene'));   // bed

  const ei = movers.findIndex((m) => m.engine);   // the piston drives the readout → it must be the FIRST mover
  if (ei > 0) movers.unshift(movers.splice(ei, 1)[0]);

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of pts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of pts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, bounds: { center, radius: radius || fR * 4 }, stats: { scenario: 'four-stroke', g: 0, samples: N, period, loop: true, T: period } };
}

/**
 * INLINE-4 four-stroke engine: four vertical slider-cranks on ONE crankshaft (rotating about its long
 * x-axis, so the throws sweep in 3D and the crank pins carry depth). The four cylinders are phased so they
 * fire 1-3-4-2, one power stroke every half-revolution. Each cylinder reuses the 4-stroke parts (piston
 * TRANSLATE, rod LINK, valves TRANSLATE, spark PULSE); the shared crankshaft (journal + 4 throws +
 * counterweights + flywheel) is one TURN group. Cylinder 1's piston carries the inline readout.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planInlineScene(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const sim = ENGINE_RULES['inline-four']({ crankRadius: recipe.crankRadius, rodLength: recipe.rodLength, flywheelR: recipe.flywheelR, rpm: recipe.rpm });
  const sc = (p) => scl(p, scale);
  const r = sim.r * scale, L = sim.L * scale, fR = sim.fR * scale, zC = sim.zC * scale, bore = sim.bore * scale, spacing = sim.spacing * scale;
  const N = sim.angle.length, period = sim.period;
  const halfY = Math.max(1.0, bore * 1.15), thick = Math.max(0.2, bore * 0.16), wall = bore * 0.5, pistonH = bore * 1.0;
  const TDCz = zC + r + L, BDCz = zC - r + L, chamberTop = TDCz + bore * 0.4, headH = bore * 1.1, cylBot = BDCz - pistonH;
  const maxLift = bore * 0.5, stemH = headH * 1.3, dtReal = (2 * 60 / sim.rpm) / (N - 1);

  const faces = [], picks = [], movers = [], pts = [];
  const addStatic = (fs) => { for (const f of fs) { faces.push(f); for (const c of f.corners) pts.push(c); } };
  const addG = (fs, group) => { for (const f of fs) { faces.push({ ...f, group }); for (const c of f.corners) pts.push(c); } };
  const xL = sim.cylinders[0].x * scale, xR = sim.cylinders[3].x * scale, xFly = xR + spacing * 0.7;

  // ── one crankshaft (TURN about its long x-axis): journal + a throw pin & counterweight per cylinder + flywheel ──
  const cs = [...cylinderFaces([(xL + xR) / 2, 0, zC], thick * 2, [1, 0, 0], (xR - xL) / 2 + spacing * 0.5, MACHINE_EDGE, 'crank')];
  for (const c of sim.cylinders) {
    const a0 = c.delta, x = c.x * scale;                                       // geometric throw angle at φ=0
    cs.push(...cylinderFaces([x, r * Math.sin(a0), zC + r * Math.cos(a0)], thick * 2.2, [1, 0, 0], spacing * 0.16, RIM_TINT, 'crank'));         // crank pin
    cs.push(...cylinderFaces([x, -r * 0.7 * Math.sin(a0), zC - r * 0.7 * Math.cos(a0)], r * 0.6, [1, 0, 0], thick * 1.4, MACHINE_FILL, 'crank'));   // counterweight
  }
  cs.push(...cylinderFaces([xFly, 0, zC], fR, [1, 0, 0], thick * 2.5, MACHINE_FILL, 'crank'));                                    // flywheel
  cs.push(...lowerObjectFaces({ lathes: [sphereSpec([xFly + thick * 2.7, 0, zC + fR * 0.6], fR * 0.13, RIM_TINT, 12)] }, WORKBENCH_LIGHT));   // rim mark
  for (const f of cs) for (const c of f.corners) pts.push(c);
  { const tp = turnMover(cs, [(xL + xR) / 2, 0, zC], [1, 0, 0], sim.angle, 'crank', period, 0); for (const f of tp.faces) faces.push(f); movers.push({ ...tp.mover, loop: true }); }

  // ── per cylinder: piston + rod + valves + spark + bore walls/head ──
  sim.cylinders.forEach((c, k) => {
    const x = c.x * scale, crankPin = c.crankPin.map(sc), pistonPin = c.pistonPin.map(sc), p0 = pistonPin[0];
    addG(cylinderFaces(p0, bore * 0.9, [0, 0, 1], pistonH / 2, LOAD_TINT, `pist${k}`), `pist${k}`);
    const kPhys = deriveKinematics(c.pistonPin, dtReal);
    const pistonMover = { group: `pist${k}`, path: pistonPin, basePos: p0, period, loop: true, hold: 0, vectors: false, speed: kPhys.speed, maxSpeed: kPhys.maxSpeed };
    if (k === 0) { pistonMover.label = sim.label; pistonMover.engine = { engine: 'inline', rpm: sim.rpm, angle: sim.angle, deltas: sim.deltas, order: sim.order }; }
    movers.push(pistonMover);
    for (const f of beamBox(0, 1, 0, thick * 1.6, thick * 1.6, RIM_TINT, `rod${k}`)) faces.push({ ...f, group: `rod${k}` });
    movers.push({ group: `rod${k}`, basePos: [0, 0, 0], link: true, from: crankPin, to: pistonPin, period, loop: true, vectors: false });
    addStatic(beamBox(x - bore - wall, x - bore, (cylBot + chamberTop) / 2, chamberTop - cylBot, halfY, MACHINE_EDGE, 'scene'));
    addStatic(beamBox(x + bore, x + bore + wall, (cylBot + chamberTop) / 2, chamberTop - cylBot, halfY, MACHINE_EDGE, 'scene'));
    addStatic(beamBox(x - bore - wall, x + bore + wall, chamberTop + headH / 2, headH, halfY, MACHINE_FILL, 'scene'));
    const mkValve = (vx, tint, lift, grp) => {
      addG([...beamBox(vx - thick, vx + thick, chamberTop + stemH / 2, stemH, thick * 1.4, tint, grp), ...cylinderFaces([vx, 0, chamberTop], bore * 0.26, [0, 0, 1], thick * 1.4, tint, grp)], grp);
      movers.push({ group: grp, path: lift.map((Lf) => [vx, 0, chamberTop - Lf * maxLift]), basePos: [vx, 0, chamberTop], period, loop: true, hold: 0, vectors: false });
    };
    mkValve(x - bore * 0.5, VALVE_IN, c.intakeLift, `intk${k}`);
    mkValve(x + bore * 0.5, VALVE_EX, c.exhaustLift, `exh${k}`);
    for (const f of lowerObjectFaces({ lathes: [sphereSpec([0, 0, 0], 1, SPARK_TINT, 12)] }, WORKBENCH_LIGHT)) faces.push({ ...f, group: `spk${k}` });
    movers.push({ group: `spk${k}`, basePos: [0, 0, 0], pulse: { phase: c.sparkU, width: 0.04, size: bore, at: [x, 0, TDCz + bore * 0.2] }, period, loop: true, vectors: false });
    picks.push({ name: `pist${k}`, kind: 'body', label: `Cylinder ${k + 1}`, fields: compactFields([['fires at', `${sim.deltas[k]}° offset`]]) });
  });

  addStatic(beamBox(xL - spacing * 0.6, xFly + fR + 1 * scale, 0.4 * scale, 0.8 * scale, halfY * 1.6, MACHINE_FILL, 'scene'));   // bed

  const ei = movers.findIndex((m) => m.engine);   // cylinder-1 piston drives the readout → first mover
  if (ei > 0) movers.unshift(movers.splice(ei, 1)[0]);

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of pts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of pts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, bounds: { center, radius: radius || fR * 6 }, stats: { scenario: 'inline', g: 0, samples: N, period, loop: true, T: period } };
}

const N_TINT = '#c0504a', S_TINT = '#4a6fc0', COIL_TINT = '#d08a4a', B_TINT = '#6f93d6';   // N red / S blue / copper / field
const F_TINT = '#e0606a', COMM_TINT = '#caa05a', BRUSH_TINT = '#2c2f3a';                    // force / commutator / brushes

/**
 * BRUSHED DC MOTOR — an ELECTROMAGNETIC machine (not a linkage): a current-carrying armature coil spinning
 * in the field of N/S stator poles. The motor effect F = I L × B pushes the two coil sides in OPPOSITE
 * directions → a torque → rotation; a split-ring commutator flips the current every half-turn so the torque
 * never reverses. The coil + commutator are `turn` movers; the B field and the force couple are solid
 * arrows. The first scene to use the rotation channel to tell a FIELD story. Rotation axis = +y (the side
 * camera looks straight down it, the textbook cross-section view).
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planDcMotorScene(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const R = 3 * scale, H = 2.2 * scale, zc = R + 1.9 * scale, wireR = 0.2 * scale, O = [0, 0, zc];
  const period = 2.6, N = 96, angles = phase(N, -TAU2);   // continuous spin (sense set to agree with the force arrows)
  const faces = [], picks = [], movers = [], pts = [];
  const addStatic = (fs) => { for (const f of fs) { faces.push(f); for (const c of f.corners) pts.push(c); } };
  const addTurn = (abs, group) => { for (const f of abs) for (const c of f.corners) pts.push(c); const tp = turnMover(abs, O, [0, 1, 0], angles, group, period, 0); for (const f of tp.faces) faces.push(f); movers.push({ ...tp.mover, loop: true }); };
  const seg = (a, b, rad, fill, group) => cylinderFaces(scl(add(a, b), 0.5), rad, norm(sub(b, a)), len(sub(b, a)) / 2, fill, group);

  // ── stator poles + the (uniform) magnetic field N → S ──
  const poleX = R + 1.5 * scale, poleW = 1.2 * scale, poleH = R * 2.2, poleD = H * 1.2;
  addStatic(beamBox(-poleX - poleW, -poleX, zc, poleH, poleD, N_TINT, 'scene'));   // N pole (left)
  addStatic(beamBox(poleX, poleX + poleW, zc, poleH, poleD, S_TINT, 'scene'));     // S pole (right)
  // the magnetic field N → S is rendered through the real EM `fields` channel (curved field lines bowing
  // across the gap + a few direction needles), not hand-rolled arrows — see `fields` below.
  const fieldY = H * 0.7, fx0 = -poleX + 0.25 * scale, fx1 = poleX - 0.25 * scale, fieldLines = [];
  for (const f of [-1.15, -0.6, 0, 0.6, 1.15]) {
    const dz = f * R, pts = [];
    for (let t = 0; t <= 1.0001; t += 0.1) pts.push([fx0 + t * (fx1 - fx0), fieldY, zc + dz + dz * 0.3 * Math.sin(Math.PI * t)]);   // outer lines fringe outward
    fieldLines.push({ pts, color: 0x6f93d6, opacity: 0.6 });
  }
  const needles = [];
  for (const nz of [-R * 0.7, 0, R * 0.7]) for (const nx of [-R * 0.5, R * 0.5]) needles.push({ pos: [nx, fieldY, zc + nz], dir: [1, 0, 0], amp: 1.05 * scale, phase0: 0 });
  const fields = [{ animate: false, sets: [{ color: 0x6f93d6, curve: false, samples: needles }], lines: fieldLines }];   // no `readout` → the motor HUD owns the readout
  picks.push({ name: 'npole', kind: 'pole', label: 'N pole', fields: compactFields([['field', 'B runs N → S']]) });
  picks.push({ name: 'spole', kind: 'pole', label: 'S pole', fields: compactFields([['field', 'uniform between the poles']]) });

  // ── armature coil (TURN about +y) ──
  const A1 = [R, -H, zc], A2 = [R, H, zc], B1 = [-R, -H, zc], B2 = [-R, H, zc];
  addTurn([...seg(A1, A2, wireR, COIL_TINT, 'coil'), ...seg(B1, B2, wireR, COIL_TINT, 'coil'), ...seg(A2, B2, wireR, COIL_TINT, 'coil'), ...seg(A1, B1, wireR, COIL_TINT, 'coil')], 'coil');
  movers[movers.length - 1].motor = { note: 'brushed DC motor' };
  movers[movers.length - 1].label = 'Electric motor (brushed DC)';
  picks.push({ name: 'coil', kind: 'coil', label: 'Armature coil', fields: compactFields([['carries', 'current I'], ['feels', 'F = I L × B']]) });

  // ── the motor-effect force couple: left wire up, right wire down (always — the commutator guarantees it) ──
  addStatic(solidArrow([-R, 0, zc + wireR * 2], [-R, 0, zc + R * 0.85], F_TINT, 'scene', 0.12 * scale));
  addStatic(solidArrow([R, 0, zc - wireR * 2], [R, 0, zc - R * 0.85], F_TINT, 'scene', 0.12 * scale));

  // ── split-ring commutator (TURN) + a rim mark so its rotation reads against the static brushes ──
  const comY = -H - 0.9 * scale, drumR = wireR * 3.4, drumL = 0.6 * scale;
  addTurn([...cylinderFaces([0, comY, zc], drumR, [0, 1, 0], drumL, COMM_TINT, 'comm'), ...cylinderFaces([0, comY, zc + drumR], wireR * 0.9, [0, 1, 0], drumL * 1.05, BRUSH_TINT, 'comm')], 'comm');
  addStatic(cylinderFaces([0, comY, zc + drumR + 0.35 * scale], wireR * 1.6, [0, 0, 1], 0.35 * scale, BRUSH_TINT, 'scene'));   // top brush
  addStatic(cylinderFaces([0, comY, zc - drumR - 0.35 * scale], wireR * 1.6, [0, 0, 1], 0.35 * scale, BRUSH_TINT, 'scene'));   // bottom brush

  // ── axle + base + pole supports ──
  addStatic(cylinderFaces([0, (comY - 0.4 * scale + H) / 2, zc], wireR * 1.3, [0, 1, 0], (H - (comY - 0.4 * scale)) / 2, MACHINE_EDGE, 'scene'));
  const baseHalfY = poleD * 1.5;
  addStatic(beamBox(-poleX - poleW - scale, poleX + poleW + scale, 0.4 * scale, 0.8 * scale, baseHalfY, MACHINE_FILL, 'scene'));   // base
  for (const sx of [-1, 1]) addStatic(beamBox(sx * (poleX + poleW * 0.5) - poleW * 0.3, sx * (poleX + poleW * 0.5) + poleW * 0.3, (0.8 * scale + zc - poleH / 2) / 2, zc - poleH / 2 - 0.8 * scale, poleD * 0.5, MACHINE_FILL, 'scene'));   // pillars

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of pts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of pts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, fields, bounds: { center, radius: radius || R * 4 }, stats: { scenario: 'dc-motor', g: 0, samples: N, period, loop: true, T: period } };
}

const PH_A = '#d05a5a', PH_B = '#5ab06a', PH_C = '#5a7fd0';                 // 3-phase windings A/B/C
const ROTOR_TINT = '#8a93a6', CAGE_TINT = '#caa05a', RFIELD_TINT = '#ffd36b';   // rotor steel / copper cage / field

/**
 * AC INDUCTION MOTOR — no brushes, no commutator, no electrical contact with the rotor at all. The 3-phase
 * stator windings make a MAGNETIC FIELD THAT ROTATES (synchronous speed); that sweeping field induces
 * currents in the squirrel-cage rotor, and the force on those induced currents drags the rotor around. The
 * rotor chases the field but never catches it — the lag is SLIP (no slip → no induced current → no torque).
 * Two `turn` movers at different rates: the field (faster) and the rotor (slower) — both wrap cleanly
 * (integer turns/loop) so the field visibly LAPS the rotor each cycle. Axis +y (the side camera looks down it).
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planAcMotorScene(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const Rout = 4.6 * scale, Rbore = 2.7 * scale, Rrotor = 2.25 * scale, zc = Rout + 1.4 * scale, O = [0, 0, zc];
  const depth = 1.8 * scale, yBack = depth * 0.5, wireR = 0.18 * scale;
  const N = 120, period = 4.0, fieldTurns = 6, rotorTurns = 5;            // field laps the rotor once per loop → slip
  const slip = Math.round((fieldTurns - rotorTurns) / fieldTurns * 100);
  const fieldAngles = phase(N, -fieldTurns * TAU2), rotorAngles = phase(N, -rotorTurns * TAU2);
  const faces = [], picks = [], movers = [], pts = [];
  const addStatic = (fs) => { for (const f of fs) { faces.push(f); for (const c of f.corners) pts.push(c); } };
  const addTurnA = (abs, group, angles) => { for (const f of abs) for (const c of f.corners) pts.push(c); const tp = turnMover(abs, O, [0, 1, 0], angles, group, period, 0); for (const f of tp.faces) faces.push(f); movers.push({ ...tp.mover, loop: true }); };
  const seg = (a, b, rad2, fill, group) => cylinderFaces(scl(add(a, b), 0.5), rad2, norm(sub(b, a)), len(sub(b, a)) / 2, fill, group);
  const rad = (ang, rr) => [O[0] + rr * Math.cos(ang), 0, O[2] + rr * Math.sin(ang)];   // a point in the x-z plane

  // ── stator: a thin back ring + six colour-coded phase poles (A·C·B·A·C·B at 60°) pointing into the bore ──
  addStatic(cylinderFaces([O[0], yBack + 0.35 * scale, zc], Rout, [0, 1, 0], 0.15 * scale, MACHINE_EDGE, 'scene'));   // back plate
  const phaseCols = [PH_A, PH_C, PH_B, PH_A, PH_C, PH_B], outer = [];
  for (let k = 0; k < 6; k++) {
    const ang = k * 60 * DEG, inP = rad(ang, Rbore), outP = rad(ang, Rout * 0.84);
    outer.push(rad(ang, Rout * 0.9));
    addStatic(seg(inP, outP, 0.45 * scale, phaseCols[k], 'scene'));   // a winding pole
  }
  for (let k = 0; k < 6; k++) addStatic(seg(outer[k], outer[(k + 1) % 6], 0.34 * scale, MACHINE_EDGE, 'scene'));   // yoke ring
  picks.push({ name: 'stator', kind: 'stator', label: 'Stator (3-phase windings)', fields: compactFields([['makes', 'a ROTATING B field'], ['phases', 'A·B·C, 120° apart']]) });

  // ── squirrel-cage rotor (TURN, slower): a steel cylinder + axial copper bars + a bright key to read slip ──
  const rotor = [...cylinderFaces(O, Rrotor, [0, 1, 0], depth * 0.5, ROTOR_TINT, 'rotor')];
  for (let k = 0; k < 8; k++) { const p = rad(k * 45 * DEG, Rrotor * 0.92); rotor.push(...cylinderFaces([p[0], 0, p[2]], wireR, [0, 1, 0], depth * 0.55, CAGE_TINT, 'rotor')); }
  rotor.push(...seg([O[0], -depth * 0.55, zc], [O[0] + Rrotor * 0.8, -depth * 0.55, zc], wireR * 1.7, '#f0c070', 'rotor'));   // key mark
  addTurnA(rotor, 'rotor', rotorAngles);
  picks.push({ name: 'rotor', kind: 'rotor', label: 'Squirrel-cage rotor', fields: compactFields([['no', 'brushes or windings'], ['current', 'INDUCED by the rotating field']]) });

  // ── the rotating magnetic field, drawn as one bold arrow sweeping the bore (TURN, faster) — FIRST mover ──
  const yf = -depth * 0.78;   // in front of the rotor so the field arrow is never hidden
  addTurnA(solidArrow([O[0], yf, zc], [O[0] + Rbore * 0.92, yf, zc], RFIELD_TINT, 'field', 0.16 * scale), 'field', fieldAngles);
  const fm = movers[movers.length - 1];
  fm.motor = { type: 'ac', syncRpm: 1800, rotorRpm: Math.round(1800 * rotorTurns / fieldTurns), slip, note: 'AC induction motor' };
  fm.label = 'Electric motor (AC induction)';
  const mi = movers.findIndex((m) => m.motor);   // the field arrow drives the readout → first mover
  if (mi > 0) movers.unshift(movers.splice(mi, 1)[0]);

  // ── base + support ──
  addStatic(beamBox(-Rout - scale, Rout + scale, 0.4 * scale, 0.8 * scale, depth * 1.4, MACHINE_FILL, 'scene'));
  addStatic(beamBox(-0.9 * scale, 0.9 * scale, (0.8 * scale + zc - Rout) / 2, Math.max(0.4 * scale, zc - Rout - 0.8 * scale), depth * 0.6, MACHINE_FILL, 'scene'));

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of pts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of pts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, bounds: { center, radius: radius || Rout * 2 }, stats: { scenario: 'ac-motor', g: 0, samples: N, period, loop: true, T: period } };
}

const DRONE_BODY = '#3a4150', DRONE_ARM = '#2a3040', HUB_TINT = '#caa05a', BLADE_TINT = '#9aa3b5';
const THRUST_INT = 0x5fd0c0, WEIGHT_INT = 0xe05a5a;   // lift (teal) vs weight (red) — the free-body diagram

/**
 * QUADCOPTER (multirotor flight) — the WHOLE-AIRCRAFT free-body problem: ΣF = ma, where the forces are the
 * rotor thrusts (up) and weight mg (down). The drone's vertical motion is INTEGRATED from a = (ΣT − mg)/m
 * (the same equal-dt sampling every trajectory uses), so it climbs when lift > weight, arrests, and HOVERS
 * when ΣT = mg (net zero → holds altitude — Newton's first law). The four rotors `spin` (each a motor)
 * AND rise with the craft (the new spin `lift`); the body translates the same path and carries the
 * thrust/weight force arrows + the lift-vs-weight readout. Pure Newtonian physics, looped (climb→hover→land).
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planDroneScene(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const m = clampNum(recipe.mass, 0.2, 50, 1.4), g = clampNum(recipe.g, 0.5, 40, 9.8), nRotors = 4;
  const W = m * g, k = 0.42, A = k * g, tau = 1.0, P = 5.5 * tau, N = 160, dt = P / (N - 1), Hpk = A * tau * tau;
  // analytic vertical flight: climb(+A,τ) → arrest(−A,τ) → hover(0,1.5τ) → descend(−A,τ) → land(+A,τ); loops.
  const za = (t) => {
    if (t < tau) return { z: 0.5 * A * t * t, a: A };
    if (t < 2 * tau) { const s = t - tau; return { z: 0.5 * A * tau * tau + A * tau * s - 0.5 * A * s * s, a: -A }; }
    if (t < 3.5 * tau) return { z: Hpk, a: 0 };
    if (t < 4.5 * tau) { const s = t - 3.5 * tau; return { z: Hpk - 0.5 * A * s * s, a: -A }; }
    const s = t - 4.5 * tau; return { z: Hpk - 0.5 * A * tau * tau - A * tau * s + 0.5 * A * s * s, a: A };
  };
  const z0 = 1.0 * scale, armLen = 3.2 * scale, bodyR = 1.1 * scale, bodyH = 0.5 * scale, rotorR = 1.5 * scale, armR = 0.16 * scale;
  const path = [], thrust = [], lift = [];
  for (let i = 0; i < N; i++) { const { z, a } = za(i * dt); path.push([0, 0, z0 + z * scale]); thrust.push(W + m * a); lift.push(z * scale); }

  const faces = [], picks = [], pts = [];
  const seg = (a, b, rad, fill, group) => cylinderFaces(scl(add(a, b), 0.5), rad, norm(sub(b, a)), len(sub(b, a)) / 2, fill, group);
  const addG = (fs, group) => { for (const f of fs) { faces.push({ ...f, group }); for (const c of f.corners) pts.push(c); } };

  // ── body + arms + landing legs (group 'drone' — the translating airframe) ──
  addG(beamBox(-bodyR, bodyR, z0, bodyH, bodyR, DRONE_BODY, 'drone'), 'drone');
  const tips = [45, 135, 225, 315].map((deg) => { const a = deg * DEG; return [Math.cos(a) * armLen, Math.sin(a) * armLen, z0]; });
  const rotorZ = z0 + bodyH * 0.5 + 0.25 * scale;
  for (const tp of tips) {
    addG(seg([0, 0, z0], tp, armR, DRONE_ARM, 'drone'), 'drone');                                   // arm
    addG(seg([tp[0] * 0.5, tp[1] * 0.5, z0 - bodyH * 0.4], [tp[0] * 0.5, tp[1] * 0.5, 0.15 * scale], armR * 0.8, DRONE_ARM, 'drone'), 'drone');   // leg
  }
  picks.push({ name: 'drone', kind: 'body', label: 'Quadcopter', fields: compactFields([['mass', `${m} kg`], ['weight', `${W.toFixed(0)} N`], ['rotors', `${nRotors}`], ['hovers when', 'ΣT = mg']]) });

  // ── the whole-craft free-body mover: thrust (up, varying) + weight (down) → the readout's lift/weight balance ──
  const k2 = deriveKinematics(path, dt), arrowLen = armLen * 1.35;
  const movers = [{
    group: 'drone', path, basePos: path[0],
    vdir: k2.vdir, speed: k2.speed, avec: k2.avec, accel: k2.accel, maxSpeed: k2.maxSpeed, maxAccel: k2.maxAccel,
    forces: [{ label: 'thrust ΣT', color: THRUST_INT, vecs: thrust.map((t) => [0, 0, t]) }, { label: 'weight mg', color: WEIGHT_INT, vecs: thrust.map(() => [0, 0, -W]) }],
    maxForce: W * (1 + k), vectors: false, arrowLen, period: P, loop: true, hold: 0, duration: P, g,
    drone: { thrust, weight: W, rotors: nRotors }, label: 'Quadcopter — lift vs weight',
  }];

  // ── four rotors (each a motor): SPIN about +z AND rise with the craft (spin `lift`) ──
  tips.forEach((tp, ri) => {
    addG([...cylinderFaces([0, 0, 0], 0.22 * scale, [0, 0, 1], 0.14 * scale, HUB_TINT, `rotor${ri}`),
      ...beamBox(-rotorR, rotorR, 0, 0.07 * scale, 0.32 * scale, BLADE_TINT, `rotor${ri}`)], `rotor${ri}`);
    movers.push({ group: `rotor${ri}`, basePos: [0, 0, 0], pivot: [tp[0], tp[1], rotorZ], spin: { axis: [0, 0, 1], omega: 17 + ri * 0.7 }, lift, period: P, loop: true });
  });
  // the rotor faces are authored at the origin; bounds must see them at their pivots + full lift.
  for (const tp of tips) { pts.push([tp[0] - rotorR, tp[1], rotorZ]); pts.push([tp[0] + rotorR, tp[1], rotorZ + Hpk * scale]); }
  for (const p of path) pts.push(p);

  // ── landing pad (static reference) ──
  addG(beamBox(-armLen * 1.5, armLen * 1.5, 0.08 * scale, 0.16 * scale, armLen * 1.5, '#222a3b', 'scene'), 'scene');

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of pts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of pts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, bounds: { center, radius: radius || armLen * 2 }, stats: { scenario: 'drone', g, samples: N, period: P, loop: true, T: P } };
}

/**
 * DRONE TRAVERSAL — the same multirotor, now FLYING A ROUTE through changing air: a climb-out, calm cruise,
 * a HEADWIND it pitches into, a THERMAL UPDRAFT that bumps it up, a GUST that buffets it, then a descent to
 * land. The craft both TRANSLATES along the route and TILTS (the new `pose` mover) — pitching its thrust
 * vector to fly the line. The wind in each zone is rendered through the real EM-style `fields` channel
 * (direction arrows + a faint route line); a flight readout names the live condition + the craft's response.
 * @returns {{ faces, picks, movers, fields, bounds, stats }}
 */
function planDroneFlightScene(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const L = 34 * scale, zc = 9 * scale, zg = 0.7 * scale, N = 180, period = 8.0;
  const smooth = (t) => t * t * (3 - 2 * t);
  // route keyframes (u, x as fraction of L, altitude z, pitch°) — smooth-interpolated. +pitch = nose-down.
  const keys = [
    { u: 0.00, x: 0.00, z: zg, p: 0 }, { u: 0.10, x: 0.06, z: zc, p: -10 }, { u: 0.26, x: 0.26, z: zc, p: 7 },
    { u: 0.40, x: 0.35, z: zc - 0.4 * scale, p: 18 }, { u: 0.50, x: 0.40, z: zc, p: 14 },
    { u: 0.60, x: 0.55, z: zc + 2.4 * scale, p: -3 }, { u: 0.68, x: 0.62, z: zc, p: 6 },
    { u: 0.74, x: 0.68, z: zc + 1.0 * scale, p: 13 }, { u: 0.80, x: 0.74, z: zc - 1.0 * scale, p: -5 },
    { u: 0.86, x: 0.82, z: zc, p: 7 }, { u: 1.00, x: 1.00, z: zg, p: -12 },
  ];
  const at = (u) => {
    let a = keys[0], b = keys[keys.length - 1];
    for (let j = 0; j < keys.length - 1; j++) if (u >= keys[j].u && u <= keys[j + 1].u) { a = keys[j]; b = keys[j + 1]; break; }
    const t = b.u > a.u ? smooth((u - a.u) / (b.u - a.u)) : 0;
    return { x: (a.x + (b.x - a.x) * t) * L, z: a.z + (b.z - a.z) * t, p: (a.p + (b.p - a.p) * t) * DEG };
  };
  const zones = [
    { u: 0.10, c: 'take-off', n: 'climbing to cruise', col: '#9aa3b5' }, { u: 0.30, c: 'calm air', n: 'cruising steady', col: '#5fd0c0' },
    { u: 0.50, c: 'headwind', n: 'pitching into the wind', col: '#6f93d6' }, { u: 0.66, c: 'thermal updraft', n: 'lifted by rising air', col: '#5ab06a' },
    { u: 0.84, c: 'gust / turbulence', n: 'buffeted — correcting', col: '#e0a05a' }, { u: 1.01, c: 'landing', n: 'descending to land', col: '#9aa3b5' },
  ];

  const path = [], pitch = [], condition = [], note = [], col = [], alt = [];
  for (let i = 0; i < N; i++) { const u = i / (N - 1), s = at(u), zn = zones.find((z) => u <= z.u) || zones[zones.length - 1]; path.push([s.x, 0, s.z]); pitch.push(s.p); condition.push(zn.c); note.push(zn.n); col.push(zn.col); alt.push(s.z / scale); }
  const dt = period / (N - 1), speed = path.map((p, i) => Math.abs((path[Math.min(N - 1, i + 1)][0] - path[Math.max(0, i - 1)][0]) / (2 * dt)) / scale);

  const faces = [], picks = [], pts = [];
  const seg = (a, b, rad, fill, group) => cylinderFaces(scl(add(a, b), 0.5), rad, norm(sub(b, a)), len(sub(b, a)) / 2, fill, group);
  const addG = (fs, group) => { for (const f of fs) { faces.push({ ...f, group }); for (const c of f.corners) pts.push(c); } };

  // ── the craft, authored CENTERED AT ORIGIN (the `pose` mover places + tilts it) ──
  const bodyR = 1.1 * scale, bodyH = 0.5 * scale, armLen = 2.6 * scale, rotorR = 1.2 * scale, armR = 0.14 * scale, rz = bodyH * 0.5 + 0.2 * scale;
  addG(beamBox(-bodyR, bodyR * 1.3, 0, bodyH, bodyR, DRONE_BODY, 'craft'), 'craft');   // body (longer toward +x = nose)
  for (const deg of [40, 140, 220, 320]) {
    const a = deg * DEG, tp = [Math.cos(a) * armLen, Math.sin(a) * armLen, 0];
    addG(seg([0, 0, 0], tp, armR, DRONE_ARM, 'craft'), 'craft');
    addG([...cylinderFaces([tp[0], tp[1], rz], 0.18 * scale, [0, 0, 1], 0.1 * scale, HUB_TINT, 'craft'),
      ...seg([tp[0] - rotorR, tp[1], rz], [tp[0] + rotorR, tp[1], rz], 0.05 * scale, BLADE_TINT, 'craft'),
      ...seg([tp[0], tp[1] - rotorR, rz], [tp[0], tp[1] + rotorR, rz], 0.05 * scale, BLADE_TINT, 'craft')], 'craft');
  }
  picks.push({ name: 'craft', kind: 'body', label: 'Quadcopter (in flight)', fields: compactFields([['route', 'climb → cruise → land'], ['conditions', 'wind · thermal · gust']]) });

  // ── the pose mover: TRANSLATE the route + TILT (pitch) into it; carries the flight readout ──
  const movers = [{
    group: 'craft', basePos: [0, 0, 0], pose: true, path, tilt: { axis: [0, 1, 0], angles: pitch },
    period, loop: false, hold: 1.6, label: 'Drone — flying the route',
    flight: { condition, note, col, alt, speed },
  }];

  // ── wind in each zone, via the real `fields` channel: headwind (←), updraft (↑), gust (scattered) + route line ──
  const xAtU = (u) => at(u).x, windSets = [];
  const head = []; for (const dz of [-2.4, 0, 2.4]) for (const fx of [0.30, 0.37]) head.push({ pos: [xAtU(fx === 0.30 ? 0.34 : 0.46), 0, zc + dz * scale], dir: [-1, 0, 0], amp: 1.7 * scale });
  const up = []; for (const fx of [0.52, 0.58]) for (const dz of [-2.5, 0, 2.5]) up.push({ pos: [xAtU(fx), 0, zc + dz * scale - 1 * scale], dir: [0, 0, 1], amp: 1.7 * scale });
  const gust = []; const gdir = [[1, 0, 0.6], [-0.7, 0, 1], [0.4, 0, -1], [-1, 0, -0.3], [0.8, 0, 0.8], [-0.5, 0, -0.8]];
  for (let j = 0; j < gdir.length; j++) gust.push({ pos: [xAtU(0.70 + (j % 3) * 0.045), 0, zc + (j < 3 ? 2 : -2) * scale], dir: gdir[j], amp: 1.3 * scale });
  windSets.push({ color: 0x6f93d6, curve: false, samples: head }, { color: 0x5ab06a, curve: false, samples: up }, { color: 0xe0a05a, curve: false, samples: gust });
  const routeLine = { pts: path.filter((_, i) => i % 6 === 0).concat([path[N - 1]]), color: 0x44506a, opacity: 0.5 };
  const fields = [{ animate: false, sets: windSets, lines: [routeLine] }];   // no readout → the flight HUD owns it
  for (const s of [...head, ...up, ...gust]) pts.push(s.pos);

  // ── ground strip under the route ──
  addG(beamBox(-2 * scale, L + 2 * scale, 0.1 * scale, 0.2 * scale, 4 * scale, '#222a3b', 'scene'), 'scene');
  for (const p of path) pts.push(p);
  pts.push([0, 0, zg], [L, 0, zc + 3 * scale]);

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of pts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of pts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, fields, bounds: { center, radius: radius || L }, stats: { scenario: 'drone-flight', g: clampNum(recipe.g, 0.5, 40, 9.8), samples: N, period, loop: false, T: period } };
}

const HULL_TINT = '#4a5260', SAIL_TINT = '#343b48', PROP_TINT = '#caa05a';
const BUOY_INT = 0x5fd0c0, SUBWEIGHT_INT = 0xe05a5a;   // buoyancy (teal, up) vs weight (red, down)

/**
 * SUBMARINE (buoyancy) — the WATER twin of the drone: the same ΣF = ma, but now the up force is Archimedes'
 * BUOYANCY (fixed, B = ρVg) and the crew controls WEIGHT via ballast water. Flood the tanks → W > B → it
 * dives; blow them with air → W < B → it rises; trim to neutral → W = B → it holds depth. The depth is
 * INTEGRATED from a = (B − W)/m; the free-body shows buoyancy vs weight; the propeller `spin`s and follows
 * the hull (spin `lift`). It dives → holds → rises → surfaces, looped. Reuses the drone's exact pattern.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
function planSubmarineScene(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const m = clampNum(recipe.mass, 0.2, 80, 4), g = clampNum(recipe.g, 0.5, 40, 9.8), B = m * g;   // buoyancy = neutral weight
  const k = 0.45, A = k * g, tau = 1.4, P = 5.5 * tau, N = 170, dt = P / (N - 1), Hpk = A * tau * tau;
  const surf = 12, zStart = surf - 1, zDeep = zStart - Hpk;   // metres (depth column); world z = metres·scale
  // dive(−A,τ) → arrest(+A,τ) → neutral(0,1.5τ) → rise(+A,τ) → surface-arrest(−A,τ); loops. a is up-positive.
  const za = (t) => {
    if (t < tau) return { z: zStart - 0.5 * A * t * t, a: -A };
    if (t < 2 * tau) { const s = t - tau; return { z: zStart - (0.5 * A * tau * tau + A * tau * s - 0.5 * A * s * s), a: A }; }
    if (t < 3.5 * tau) return { z: zDeep, a: 0 };
    if (t < 4.5 * tau) { const s = t - 3.5 * tau; return { z: zDeep + 0.5 * A * s * s, a: A }; }
    const s = t - 4.5 * tau; return { z: zDeep + (0.5 * A * tau * tau + A * tau * s - 0.5 * A * s * s), a: -A };
  };
  const path = [], weight = [], depth = [], lift = [], ballast = [];
  for (let i = 0; i < N; i++) { const { z, a } = za(i * dt); const W = B - m * a; path.push([0, 0, z * scale]); weight.push(W); depth.push(surf - z); lift.push((z - zStart) * scale); ballast.push((W - B * (1 - k)) / (2 * k * B)); }

  const faces = [], picks = [], pts = [];
  const addG = (fs, group, extra) => { for (const f of fs) { faces.push({ ...f, group, ...extra }); for (const c of f.corners) pts.push(c); } };
  const hullR = 1.0 * scale, hullLen = 7 * scale, z0 = zStart * scale;

  // ── water medium: a translucent column + a bright surface band + the seabed ──
  addG(beamBox(-hullLen, hullLen, surf * 0.5 * scale, surf * scale, hullLen * 0.9, '#1d3a55', 'water'), 'water', { alpha: 0.16 });
  addG(beamBox(-hullLen, hullLen, surf * scale, 0.18 * scale, hullLen * 0.9, '#3f6f96', 'scene'), 'scene');   // waterline
  addG(beamBox(-hullLen * 1.1, hullLen * 1.1, -0.4 * scale, 0.8 * scale, hullLen, '#3a3320', 'scene'), 'scene');   // seabed

  // ── the submarine, authored at the rest depth (z0); the translate mover walks it through the column ──
  addG(cylinderFaces([0, 0, z0], hullR, [1, 0, 0], hullLen / 2, HULL_TINT, 'sub'), 'sub');
  addG(coneFaces([hullLen / 2, 0, z0], [hullLen / 2 + 1.3 * scale, 0, z0], hullR, HULL_TINT, 'sub'), 'sub');     // bow
  addG(coneFaces([-hullLen / 2, 0, z0], [-hullLen / 2 - 1.1 * scale, 0, z0], hullR * 0.85, HULL_TINT, 'sub'), 'sub');   // stern taper
  addG(beamBox(-1.1 * scale, 0.9 * scale, z0 + hullR + 0.55 * scale, 1.1 * scale, 0.5 * scale, SAIL_TINT, 'sub'), 'sub');   // sail / conning tower
  addG(cylinderFaces([0.1 * scale, 0, z0 + hullR + 1.5 * scale], 0.08 * scale, [0, 0, 1], 0.55 * scale, '#2a3040', 'sub'), 'sub');   // periscope
  addG(beamBox(hullLen * 0.32, hullLen * 0.46, z0, 0.12 * scale, 1.7 * scale, HULL_TINT, 'sub'), 'sub');         // bow planes
  addG(beamBox(-hullLen * 0.5, -hullLen * 0.4, z0, 1.8 * scale, 0.12 * scale, HULL_TINT, 'sub'), 'sub');         // tail rudder (vertical)
  addG(beamBox(-hullLen * 0.5, -hullLen * 0.4, z0, 0.12 * scale, 1.6 * scale, HULL_TINT, 'sub'), 'sub');         // tail planes (horizontal)
  picks.push({ name: 'sub', kind: 'body', label: 'Submarine', fields: compactFields([['up force', 'buoyancy ρVg'], ['down force', 'weight (ballast)'], ['dive', 'flood tanks → W>B'], ['rise', 'blow tanks → W<B']]) });

  // ── whole-boat free-body mover: buoyancy (up, fixed) + weight (down, ballast-controlled) → the readout ──
  const kin = deriveKinematics(path, dt), arrowLen = hullLen * 0.7;
  const movers = [{
    group: 'sub', path, basePos: path[0], vdir: kin.vdir, speed: kin.speed, avec: kin.avec, accel: kin.accel, maxSpeed: kin.maxSpeed, maxAccel: kin.maxAccel,
    forces: [{ label: 'buoyancy B', color: BUOY_INT, vecs: weight.map(() => [0, 0, B]) }, { label: 'weight W', color: SUBWEIGHT_INT, vecs: weight.map((w) => [0, 0, -w]) }],
    maxForce: B * (1 + k), vectors: false, arrowLen, period: P, loop: true, hold: 0, duration: P, g,
    sub: { buoyancy: B, weight, depth, ballast }, label: 'Submarine — buoyancy vs weight',
  }];

  // ── the MECHANISM: a cutaway ballast tank on the hull whose water level FLOODS (dive) and BLOWS (rise). ──
  // The translucent tank shell rides with the boat (its own translate mover); the water inside is a `fill`
  // mover (scale.z = the ballast fraction) that also follows the boat's depth via `lift`.
  const tx = -hullLen * 0.16, tankR = 0.62 * scale, tankH = 2.7 * scale, tBot = z0 + hullR * 0.55;
  addG(cylinderFaces([tx, 0, tBot + tankH / 2], tankR, [0, 0, 1], tankH / 2, '#aebccf', 'subtank'), 'subtank', { alpha: 0.13 });   // glass shell
  movers.push({ group: 'subtank', path, basePos: path[0], period: P, loop: true, vectors: false });   // shell rides with the boat
  // water authored FROM THE TANK FLOOR UP (z ∈ [0, tankH]); the fill mover scales it by the ballast fraction.
  const water = [];
  for (let s = 0; s < 12; s++) { const a0 = s / 12 * TAU2, a1 = (s + 1) / 12 * TAU2, r = tankR * 0.86; const p0 = [tx + r * Math.cos(a0), r * Math.sin(a0)], p1 = [tx + r * Math.cos(a1), r * Math.sin(a1)]; water.push(quad([[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], tankH], [p0[0], p0[1], tankH]], '#2f6fa8', 'ballast')); }
  water.push(quad([[tx - tankR * 0.86, -tankR * 0.86, tankH], [tx + tankR * 0.86, -tankR * 0.86, tankH], [tx + tankR * 0.86, tankR * 0.86, tankH], [tx - tankR * 0.86, tankR * 0.86, tankH]], '#3f7fb8', 'ballast'));   // top surface
  for (const f of water) { faces.push(f); }
  movers.push({ group: 'ballast', basePos: [0, 0, 0], fill: { frac: ballast, base: tBot }, lift, period: P, loop: true, vectors: false });
  // flood/vent ports: a sea inlet at the tank floor (water in) + an air vent at the top
  addG(solidArrow([tx, tankR + 0.5 * scale, tBot + 0.3 * scale], [tx, tankR * 0.2, tBot + 0.3 * scale], 0x5fd0c0, 'sub', 0.07 * scale), 'sub');   // flood ← sea
  addG(cylinderFaces([tx, 0, tBot + tankH + 0.25 * scale], 0.09 * scale, [0, 0, 1], 0.25 * scale, '#caa05a', 'sub'), 'sub');   // air line on top
  picks.push({ name: 'ballast', kind: 'tank', label: 'Ballast tank', fields: compactFields([['flood', 'sea water in → heavier → dive'], ['blow', 'compressed air in → lighter → rise']]) });

  // ── propeller at the stern: SPIN about the fore-aft axis AND follow the hull's depth (spin `lift`) ──
  const propX = -hullLen / 2 - 1.1 * scale;   // a 4-blade screw: hub + two crossed blades in the y-z plane
  addG([...cylinderFaces([0, 0, 0], 0.2 * scale, [1, 0, 0], 0.18 * scale, PROP_TINT, 'prop'),
    ...beamBox(-0.06 * scale, 0.06 * scale, 0, 0.1 * scale, 0.95 * scale, PROP_TINT, 'prop'),
    ...beamBox(-0.06 * scale, 0.06 * scale, 0, 0.95 * scale, 0.1 * scale, PROP_TINT, 'prop')], 'prop');
  movers.push({ group: 'prop', basePos: [0, 0, 0], pivot: [propX, 0, z0], spin: { axis: [1, 0, 0], omega: 14 }, lift, period: P, loop: true });
  for (const p of path) pts.push([propX, 0, p[2]]);

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of pts) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of pts) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return { faces, picks, movers, bounds: { center, radius: radius || hullLen * 2 }, stats: { scenario: 'submarine', g, samples: N, period: P, loop: true, T: P } };
}

/**
 * Resolve a recipe into the emitThreeWorld payload (faces + body pick + mover channel + framing).
 * Orbit-only; side elevation is the primary camera (Newtonian motion reads best side-on). glow off.
 */
export function assembleMechanicsScene(recipe = {}, { title } = {}) {
  const plan = planMechanicsScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.6;
  const side = { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.25, center[2]], lookAt: center, horizontalFov: 46 } };
  const angle = { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.7, center[1] - d * 0.95, center[2] + d * 0.45], lookAt: center, horizontalFov: 46 } };
  // comparison mode separates the bodies in DEPTH (y), which the side camera looks straight down — so the
  // angled 3/4 view leads there; the inline engine's crank throws sweep in depth too, so it also leads
  // with the angled view; everything else reads best side-on.
  const angleFirst = (recipe.compare && COMPARE_SCENARIOS.has(recipe.scenario)) || recipe.scenario === 'inline-four';
  const cameras = angleFirst ? [angle, side] : [side, angle];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0b1020';
  return {
    faces: plan.faces,
    picks: plan.picks,
    movers: plan.movers,
    ...(plan.planets ? { planets: plan.planets } : {}),   // focal moving bodies as lit spheres
    ...(plan.fields ? { fields: plan.fields } : {}),   // the EM field channel (motors emit real B-field lines)
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
