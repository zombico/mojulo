/**
 * rocket-view — a Falcon-9-class LAUNCH + RETURN depictor, rendered in the traversable
 * three.js World (rocket-view.plan.md, v1). The mission sibling of mechanics-view: where
 * mechanics shows one Newtonian fundamental, this walks a whole flight — liftoff, gravity
 * turn, Max-Q, MECO, stage separation, (RTLS) boostback, entry burn, tail-first descent and
 * the hoverslam landing — integrated by physics/rocket.js with every acceleration coming
 * from a real force (thrust/mass-flow, Mach-dependent drag against US76 air, inverse-square
 * gravity). Guidance is scripted, not closed-loop; the facts panel says so.
 *
 * The mechanics trick carries the show: the trajectory is resampled at equal TIME steps, so
 * the booster's visible speed IS its acceleration — the strobe ghosts bunch at liftoff
 * (TWR 1.5, sluggish) and stretch toward MECO as the propellant burns off. Two `pose`
 * movers ride the scene: the booster (translate + pitch program, carrying the rocket HUD)
 * and stage 2 (rides the stack to separation, then pulls away toward orbit). The TRAJECTORY
 * is true-scale; the vehicles are drawn oversized exactly as every mechanics body is —
 * base shapes in v1 (cylinders + a cone), the Falcon 9 likeness comes later.
 *
 * Stored manifest IS the recipe (geometry regenerated on render):
 *   { kind:'rocket-view', scenario?, payload?, vehicle?, guidance?, playback?, trace?,
 *     strobe?, strobeEvery?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form. Frame: x downrange, z up.
 */

import { clampNum, add, sub, scl, len, norm, deriveKinematics } from '../../worlds/motion-vocabulary.js';
import { lowerObjectFaces, WORKBENCH_LIGHT } from '../../worlds/workbench.js';
import { flyMission, G0 } from '../../physics/rocket.js';

export const ROCKET_SCENARIOS = ['rtls', 'asds'];
const N_SAMPLES = 420;   // equal-dt mission samples — denser than mechanics' 140: a ~9-minute flight

// ── local geometry helpers (each view carries its own — same idiom as mechanics-view) ──
const quad = (corners, fill, group) => ({ corners, fill, group });
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function cylinderFaces(center, R, axis, halfLen, fill, group, seg = 14) {
  const ax = norm(axis);
  const ref = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(sub(ref, scl(ax, ref[0] * ax[0] + ref[1] * ax[1] + ref[2] * ax[2]))), v = cross(ax, u);
  const c0 = sub(center, scl(ax, halfLen)), c1 = add(center, scl(ax, halfLen));
  const ring = (c) => Array.from({ length: seg }, (_, i) => { const t = (i / seg) * Math.PI * 2; return add(c, add(scl(u, R * Math.cos(t)), scl(v, R * Math.sin(t)))); });
  const r0 = ring(c0), r1 = ring(c1), faces = [];
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    faces.push(quad([r0[i], r0[j], r1[j], r1[i]], fill, group));
    faces.push(quad([c0, r0[j], r0[i], r0[i]], fill, group));   // cap fans as degenerate quads
    faces.push(quad([c1, r1[i], r1[j], r1[j]], fill, group));
  }
  return faces;
}
function coneFaces(baseCenter, apex, R, fill, group, seg = 14) {
  const ax = norm(sub(apex, baseCenter));
  const ref = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(sub(ref, scl(ax, ref[0] * ax[0] + ref[1] * ax[1] + ref[2] * ax[2]))), v = cross(ax, u);
  const ring = Array.from({ length: seg }, (_, i) => { const t = (i / seg) * Math.PI * 2; return add(baseCenter, add(scl(u, R * Math.cos(t)), scl(v, R * Math.sin(t)))); });
  const faces = [];
  for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; faces.push(quad([ring[i], ring[j], apex, apex], fill, group)); faces.push(quad([baseCenter, ring[j], ring[i], ring[i]], fill, group)); }
  return faces;
}
function box(x0, x1, y0, y1, z0, z1, fill, group) {
  const c = (x, y, z) => [x, y, z];
  return [
    quad([c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1)], fill, group),   // top
    quad([c(x0, y1, z0), c(x1, y1, z0), c(x1, y0, z0), c(x0, y0, z0)], fill, group),   // bottom
    quad([c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)], fill, group),
    quad([c(x1, y1, z0), c(x0, y1, z0), c(x0, y1, z1), c(x1, y1, z1)], fill, group),
    quad([c(x0, y1, z0), c(x0, y0, z0), c(x0, y0, z1), c(x0, y1, z1)], fill, group),
    quad([c(x1, y0, z0), c(x1, y1, z0), c(x1, y1, z1), c(x1, y0, z1)], fill, group),
  ];
}
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const circleProfile = (R, n = 12) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n; return { t, radius: R * Math.sin(Math.PI * t) }; });
const sphereSpec = (center, radius, tint, samples = 14) => ({
  axisFrom: pt(add(center, [0, 0, -radius])), axisTo: pt(add(center, [0, 0, radius])),
  profile: circleProfile(radius, 12), crossSections: 14, samples, tint,
});
function traceRibbonFaces(path, halfW, fill, group) {
  const faces = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i], q = path[i + 1];
    const tx = q[0] - p[0], tz = q[2] - p[2];
    const tl = Math.hypot(tx, tz) || 1;
    const px = (tz / tl) * halfW, pz = (-tx / tl) * halfW;
    faces.push(quad([[p[0] + px, 0, p[2] + pz], [p[0] - px, 0, p[2] - pz], [q[0] - px, 0, q[2] - pz], [q[0] + px, 0, q[2] + pz]], fill, group));
  }
  return faces;
}

const HULL = '#c9cdd4';          // the white-ish airframe
const HULL_DARK = '#6a7280';     // interstage / engine section
const S2_TINT = '#aeb4bf';
const NOSE_TINT = '#8e959f';
const GHOST_TINT = '#565d4a';    // dim strobe afterimages
const TRACE_FILL = '#3a4a63';
const GROUND_FILL = '#222a3b';
const GROUND_EDGE = '#2c3650';
const PAD_FILL = '#3a4150';
const LZ_FILL = '#2e4a3f';
const SHIP_FILL = '#37414f';

const PHASE_LABELS = {
  liftoff: 'Liftoff', ascent: 'Ascent', separation: 'MECO · separation', flip: 'Flip maneuver',
  boostback: 'Boostback burn', coast: 'Coast', entry: 'Entry burn', descent: 'Descent (grid fins)',
  landing: 'Landing burn', down: 'Touchdown',
};

// linear-interpolated read of the integrator record stream at time t (records are ~0.2 s apart).
function interpAt(samples, t, cursor) {
  let i = cursor.i;
  while (i < samples.length - 2 && samples[i + 1].t <= t) i++;
  cursor.i = i;
  const a = samples[i], b = samples[Math.min(samples.length - 1, i + 1)];
  const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const lerp = (ka) => a[ka] + (b[ka] - a[ka]) * f;
  return { a, f, x: lerp('x'), z: lerp('z'), vx: lerp('vx'), vz: lerp('vz'), m: lerp('m'),
    pitch: lerp('pitch'), thrust: lerp('thrust'), q: lerp('q'), mach: lerp('mach'),
    drag: lerp('drag'), prop: lerp('prop'), phase: (f < 0.5 ? a : b).phase || a.phase };
}

// resolve recipe → mission (shared by planner + sampler so numbers always agree)
function runMission(recipe = {}) {
  const scenario = ROCKET_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'rtls';
  return {
    scenario,
    mission: flyMission({
      profile: scenario,
      ...(Number.isFinite(+recipe.payload) ? { payload: +recipe.payload } : {}),
      ...(recipe.vehicle != null ? { vehicle: recipe.vehicle } : {}),
      ...(recipe.guidance && typeof recipe.guidance === 'object' ? { guidance: recipe.guidance } : {}),
    }),
  };
}

/**
 * Resolve a recipe into a placed face list + picks + the two pose movers + HUD arrays.
 * Pure — no DB, no HTML. Same recipe → identical faces and identical mover paths.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
export function planRocketScene(recipe = {}) {
  const { scenario, mission } = runMission(recipe);
  const { samples, stage2Samples, events, vehicle, summary } = mission;
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const trace = recipe.trace === false ? false : true;
  const strobe = recipe.strobe === false ? false : true;
  const strobeEvery = Math.round(clampNum(recipe.strobeEvery, 6, 60, 18));
  const period = clampNum(recipe.playback, 20, 240, 75);

  const T = samples[samples.length - 1].t;
  const dt = T / (N_SAMPLES - 1);

  // scene scale: true-proportion trajectory normalized so the tallest extent ≈ 320 units.
  const xs = samples.map((s) => s.x), zs = samples.map((s) => s.z);
  const xMin = Math.min(...xs, 0), xMax = Math.max(...xs, 1), zMax = Math.max(...zs, 1);
  const extent = Math.max(xMax - xMin, zMax);
  const K = (320 / extent) * scale;
  const toScene = (x, z) => [x * K, 0, z * K];

  // equal-dt booster resample: path + pitch + the HUD arrays, all in step.
  const cur = { i: 0 };
  const path = [], pitch = [], hud = { phase: [], t: [], alt: [], speed: [], mach: [], mass: [], thrust: [], twr: [], q: [], prop: [] };
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = i * dt, s = interpAt(samples, t, cur);
    path.push(toScene(s.x, s.z)); pitch.push(s.pitch);
    hud.phase.push(PHASE_LABELS[s.phase] || s.phase);
    hud.t.push(+t.toFixed(1));
    hud.alt.push(+(s.z / 1000).toFixed(2));
    hud.speed.push(+Math.hypot(s.vx, s.vz).toFixed(1));
    hud.mach.push(+s.mach.toFixed(2));
    hud.mass.push(Math.round(s.m));
    hud.thrust.push(Math.round(s.thrust));
    hud.twr.push(+(s.thrust / (s.m * G0)).toFixed(2));
    hud.q.push(Math.round(s.q));
    hud.prop.push(+(s.prop / vehicle.stage1.prop).toFixed(4));
  }

  // vehicle sizes: oversized markers against the true-scale trajectory (the mechanics idiom).
  const span = 320 * scale;
  const LB = span * 0.05, rB = LB / 9;
  const L2 = LB * 0.36, r2 = rB;
  const stackOffset = (LB + L2) / 2;

  const faces = [], picks = [];
  const tag = (fs) => { for (const f of fs) faces.push(f); };

  // trace ribbon + strobe ghosts along the booster's mission (equal-dt spacing IS the physics).
  if (trace) tag(traceRibbonFaces(path, Math.max(rB * 0.35, span * 0.004), TRACE_FILL, 'scene'));
  if (strobe) {
    for (let i = strobeEvery; i < N_SAMPLES - 1; i += strobeEvery) {
      tag(lowerObjectFaces({ lathes: [sphereSpec(path[i], rB * 0.6, GHOST_TINT, 10)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group: 'scene' })));
    }
  }

  // ── the booster (group 'booster'), authored VERTICAL and centered at the origin — a base
  // shape in v1: hull cylinder + darker engine section + interstage collar. The pose mover
  // places + pitches it; the Falcon 9 likeness (grid fins, legs, engines) is a later pass. ──
  tag(cylinderFaces([0, 0, 0], rB, [0, 0, 1], LB / 2 - LB * 0.09, HULL, 'booster'));
  tag(cylinderFaces([0, 0, -LB / 2 + LB * 0.05], rB * 1.04, [0, 0, 1], LB * 0.05, HULL_DARK, 'booster'));   // engine section
  tag(cylinderFaces([0, 0, LB / 2 - LB * 0.045], rB * 1.02, [0, 0, 1], LB * 0.045, HULL_DARK, 'booster'));  // interstage
  picks.push({
    name: 'booster', kind: 'body', label: `${vehicle.label} booster`,
    fields: [
      { k: 'profile', v: scenario === 'rtls' ? 'return to launch site' : 'droneship landing' },
      { k: 'liftoff', v: `${(summary.liftoffMass / 1000).toFixed(0)} t · TWR ${summary.liftoffTWR.toFixed(2)}` },
      { k: 'MECO', v: `T+${events.meco.t.toFixed(0)} s · ${events.meco.v.toFixed(0)} m/s` },
      { k: 'apogee', v: `${(events.apogee.alt / 1000).toFixed(0)} km` },
      { k: 'touchdown', v: `${events.touchdown ? events.touchdown.v.toFixed(1) : '—'} m/s` },
      { k: 'honesty', v: 'real forces · scripted guidance · 2-D planar' },
    ],
  });

  // ── stage 2 + payload (group 'stage2'): rides the stack to separation, then pulls away.
  // Base shape: cylinder + nose cone, authored centered at the origin. ──
  tag(cylinderFaces([0, 0, -L2 * 0.18], r2, [0, 0, 1], L2 * 0.32, S2_TINT, 'stage2'));
  tag(coneFaces([0, 0, L2 * 0.14], [0, 0, L2 * 0.5], r2, NOSE_TINT, 'stage2'));
  picks.push({
    name: 'stage2', kind: 'body', label: 'Stage 2 + payload',
    fields: [
      { k: 'engine', v: 'MVac — vacuum-optimized' },
      { k: 'after sep', v: 'burns on toward orbit' },
      { k: 'payload', v: `${(mission.payload / 1000).toFixed(1)} t` },
    ],
  });

  // stage-2 path: stack position (booster + rotated stack offset) until sep, its own
  // integrated trajectory after — truncated when it leaves the framed neighbourhood.
  const sepT = events.sep ? events.sep.t : T;
  const s2cur = { i: 0 };
  const s2path = [], s2pitch = [];
  const xLim = Math.max(Math.abs(xMin), Math.abs(xMax)) * 1.45 + extent * 0.05, zLim = zMax * 1.35;
  let T2 = 0;
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = i * dt;
    let px, pz, ang;
    if (t <= sepT || !stage2Samples.length) {
      const s = interpAt(samples, t, s2cur); px = s.x; pz = s.z; ang = s.pitch;
    } else {
      const t2i = Math.min(stage2Samples.length - 1, Math.max(0, Math.round((t - sepT) / 0.2)));
      const s2 = stage2Samples[t2i]; px = s2.x; pz = s2.z; ang = s2.pitch;
      if (Math.abs(px) > xLim || pz > zLim) break;   // out of frame — stop the stage-2 path here
    }
    const sc = toScene(px, pz);
    s2path.push([sc[0] + stackOffset * Math.sin(ang), 0, sc[2] + stackOffset * Math.cos(ang)]);
    s2pitch.push(ang);
    T2 = t;
  }

  // ── dressing: ground band, launch pad, and the landing target (LZ ring or droneship) ──
  const gx0 = Math.min(xMin * K, 0) - span * 0.06, gx1 = xMax * K + span * 0.06;
  const yHalf = Math.max(span * 0.05, LB);
  tag([quad([[gx0, -yHalf, 0], [gx1, -yHalf, 0], [gx1, yHalf, 0], [gx0, yHalf, 0]], GROUND_FILL, 'scene'),
    quad([[gx0, -yHalf, 0], [gx0, yHalf, 0], [gx0, yHalf, -span * 0.02], [gx0, -yHalf, -span * 0.02]], GROUND_EDGE, 'scene')]);
  tag(box(-rB * 3, rB * 3, -rB * 3, rB * 3, 0, LB * 0.12, PAD_FILL, 'pad'));            // pad apron
  tag(box(rB * 3.5, rB * 5, -rB * 0.7, rB * 0.7, 0, LB * 0.5, HULL_DARK, 'pad'));       // strongback tower
  picks.push({ name: 'pad', kind: 'site', label: 'Launch pad', fields: [{ k: 'site', v: 'x = 0 — where the mission starts (and, RTLS, ends)' }] });
  if (events.touchdown) {
    const tdX = events.touchdown.x * K;
    if (scenario === 'asds') tag(box(tdX - LB * 0.9, tdX + LB * 0.9, -LB * 0.5, LB * 0.5, 0, LB * 0.05, SHIP_FILL, 'scene'));   // droneship deck
    else tag(cylinderFaces([tdX, yHalf * 0.45, LB * 0.02], LB * 0.55, [0, 0, 1], LB * 0.02, LZ_FILL, 'scene', 20));            // LZ ring (depth-offset beside the pad)
  }

  // ── the two pose movers, on one shared cycle so separation stays in step ──
  const holdEnd = 2.5;
  const cycle = period + holdEnd;
  const period2 = period * (T2 / T);
  const movers = [
    {
      group: 'booster', basePos: [0, 0, 0], pose: true, path, tilt: { axis: [0, 1, 0], angles: pitch },
      period, loop: false, hold: holdEnd, label: `${vehicle.label} — ${scenario === 'rtls' ? 'launch & return to pad' : 'launch & droneship landing'}`,
      rocket: hud,
    },
    {
      group: 'stage2', basePos: [0, 0, 0], pose: true, path: s2path, tilt: { axis: [0, 1, 0], angles: s2pitch },
      period: period2, loop: false, hold: cycle - period2,
    },
  ];

  // bounds over dressing + both paths (+ the vehicle marker size)
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; } };
  for (const f of faces) for (const c of f.corners) bump(c);
  for (const c of [...path, ...s2path]) { bump(add(c, [LB, 0, LB])); bump(sub(c, [LB, 0, LB])); }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of [...path, ...s2path, ...faces.flatMap((f) => f.corners)]) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return {
    faces, picks, movers,
    bounds: { center, radius: radius || span },
    stats: {
      scenario, payload: mission.payload, T: +T.toFixed(1), samples: N_SAMPLES, period, loop: false,
      mecoV: +events.meco.v.toFixed(0), apogeeKm: +(events.apogee.alt / 1000).toFixed(1),
      touchdownV: events.touchdown ? +events.touchdown.v.toFixed(2) : null,
      touchdownX: events.touchdown ? +events.touchdown.x.toFixed(0) : null,
    },
  };
}

// ── the physical read-back channel (measure_view): the full mission time-series in real SI,
// sampled from the UNSCALED integrator output — the same numbers the HUD shows. ──
export function sampleRocketPhysics(recipe = {}, { every = 1 } = {}) {
  const { scenario, mission } = runMission(recipe);
  const { samples, events, vehicle, summary } = mission;
  const T = samples[samples.length - 1].t;
  const dt = T / (N_SAMPLES - 1);
  const cur = { i: 0 };
  const rows = [], realPath = [];
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = i * dt, s = interpAt(samples, t, cur);
    realPath.push([s.x, 0, s.z]);
    rows.push({ t: +t.toFixed(3), pos: [+s.x.toFixed(2), 0, +s.z.toFixed(2)],
      speed: +Math.hypot(s.vx, s.vz).toFixed(3), mass: +s.m.toFixed(1),
      thrust: +s.thrust.toFixed(0), drag: +s.drag.toFixed(0), q: +s.q.toFixed(1), phase: s.phase });
  }
  const k = deriveKinematics(realPath, dt);
  const step = Math.max(1, Math.round(clampNum(every, 1, N_SAMPLES, 1)));
  const out = [];
  for (let i = 0; i < rows.length; i += step) out.push({ ...rows[i], accel: +k.accel[i].toFixed(3) });
  return {
    scenario, label: `${vehicle.label} — ${scenario}`, T, dt, loop: false, static: false,
    units: { t: 's', pos: 'm', speed: 'm/s', accel: 'm/s²', mass: 'kg', thrust: 'N', drag: 'N', q: 'Pa' },
    facts: [
      ['liftoff', `${(summary.liftoffMass / 1000).toFixed(0)} t · TWR ${summary.liftoffTWR.toFixed(2)}`],
      ['max-Q', `${(events.maxQ.q / 1000).toFixed(1)} kPa @ T+${events.maxQ.t.toFixed(0)} s`],
      ['MECO', `T+${events.meco.t.toFixed(0)} s · ${events.meco.v.toFixed(0)} m/s · ${(events.meco.alt / 1000).toFixed(0)} km`],
      ['apogee', `${(events.apogee.alt / 1000).toFixed(0)} km`],
      ...(events.landingIgnition ? [['landing burn', `ignites ${events.landingIgnition.alt.toFixed(0)} m @ ${events.landingIgnition.v.toFixed(0)} m/s`]] : []),
      ...(events.touchdown ? [['touchdown', `T+${events.touchdown.t.toFixed(0)} s · ${events.touchdown.v.toFixed(1)} m/s · x ${(events.touchdown.x / 1000).toFixed(2)} km`]] : []),
      ['honesty', 'real forces; scripted guidance; 2-D planar; kinematic attitude'],
    ],
    samples: out, count: out.length,
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. Orbit-only; the side elevation leads —
 * a launch reads best side-on (the RTLS loop, the ASDS arc). glow off.
 */
export function assembleRocketScene(recipe = {}, { title } = {}) {
  const plan = planRocketScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.4;
  const side = { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.2, center[2]], lookAt: center, horizontalFov: 46 } };
  const angle = { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.6, center[1] - d * 0.95, center[2] + d * 0.35], lookAt: center, horizontalFov: 46 } };
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0b1020';
  return {
    faces: plan.faces,
    picks: plan.picks,
    movers: plan.movers,
    cameras: [side, angle],
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo rocket ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
