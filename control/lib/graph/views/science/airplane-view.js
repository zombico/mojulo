/**
 * airplane-view — a FIXED-WING FLIGHT depictor rendered in the traversable three.js World:
 * the atmospheric sibling of rocket-view, over the physics/airplane.js integrator. A whole
 * airline flight — takeoff roll, rotation, climb, cruise, the 3° descent, approach, flare,
 * touchdown, rollout — or the 'glide' mission: engines out at cruise, best-L/D deadstick to
 * the runway (the glide-ratio lesson). Every acceleration from the four real forces (lift
 * with a stall curve, parasite + induced drag, jet thrust with altitude lapse, weight);
 * the pilot is scripted and the facts panel says so.
 *
 * The AIRCRAFT BODY is the airport primitive's own plane: the fixed-wing vehicle net from
 * the meta-fabricator registry (vehicleFaces — airliner / widebody / regional / bizjet),
 * lowered to mesh faces, recentred, and walked by a pose mover along the true-scale flight
 * path (equal-dt — the mechanics trick: visible speed IS acceleration; the strobe ghosts
 * spread as the takeoff roll accelerates). Trajectory true-scale and FLAT, as real flights
 * are; the plane is drawn oversized exactly as every mechanics body is.
 *
 * Stored manifest IS the recipe:
 *   { kind:'airplane-view', mission?, plane?, aircraft?, guidance?, playback?, trace?,
 *     strobe?, strobeEvery?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form. Frame: x downrange, z up.
 */

import { clampNum, add, sub, deriveKinematics } from '../../worlds/motion-vocabulary.js';
import { lowerObjectFaces, WORKBENCH_LIGHT } from '../../worlds/workbench.js';
import { vehicleFaces } from '../../vehicles/vehicles-css3d.js';
import { flyAirplane } from '../../physics/airplane.js';

export const AIRPLANE_MISSIONS = ['hop', 'glide'];
export const AIRPLANE_BODIES = ['airliner', 'widebody', 'regional', 'bizjet'];
const N_SAMPLES = 420;

// ── local helpers (same idiom as rocket-view: each view carries its own) ──
const quad = (corners, fill, group) => ({ corners, fill, group });
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
function box(x0, x1, y0, y1, z0, z1, fill, group) {
  const c = (x, y, z) => [x, y, z];
  return [
    quad([c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1)], fill, group),
    quad([c(x0, y1, z0), c(x1, y1, z0), c(x1, y0, z0), c(x0, y0, z0)], fill, group),
    quad([c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)], fill, group),
    quad([c(x1, y1, z0), c(x0, y1, z0), c(x0, y1, z1), c(x1, y1, z1)], fill, group),
    quad([c(x0, y1, z0), c(x0, y0, z0), c(x0, y0, z1), c(x0, y1, z1)], fill, group),
    quad([c(x1, y0, z0), c(x1, y1, z0), c(x1, y1, z1), c(x1, y0, z1)], fill, group),
  ];
}

const GHOST_TINT = '#4a5340';
const TRACE_FILL = '#3a4a63';
const GROUND_FILL = '#22301f';    // grass beside the runways
const RUNWAY_FILL = '#3d434e';
const RUNWAY_MARK = '#8b93a1';

const PHASE_LABELS = {
  roll: 'Takeoff roll', rotate: 'Rotation', climb: 'Climb', cruise: 'Cruise',
  descent: 'Descent', approach: 'Final approach', flare: 'Flare', rollout: 'Rollout', stop: 'Stopped',
};
const phaseLabel = (s) => (s.thrust === 0 && (s.phase === 'descent' || s.phase === 'cruise') ? 'Glide — engines out' : (PHASE_LABELS[s.phase] || s.phase));

// linear interpolation over the integrator record stream (records ~0.2 s apart)
function interpAt(samples, t, cursor) {
  let i = cursor.i;
  while (i < samples.length - 2 && samples[i + 1].t <= t) i++;
  cursor.i = i;
  const a = samples[i], b = samples[Math.min(samples.length - 1, i + 1)];
  const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const lerp = (k) => a[k] + (b[k] - a[k]) * f;
  const near = f < 0.5 ? a : b;
  return { x: lerp('x'), z: lerp('z'), v: lerp('v'), pitch: lerp('pitch'), alpha: lerp('alpha'),
    cl: lerp('cl'), ld: lerp('ld'), lift: lerp('lift'), drag: lerp('drag'), thrust: lerp('thrust'),
    phase: near.phase, config: near.config, gear: near.gear, thrustNear: near.thrust };
}

function runFlight(recipe = {}) {
  const mission = AIRPLANE_MISSIONS.includes(recipe.mission) ? recipe.mission : 'hop';
  return {
    mission,
    flight: flyAirplane({
      mission,
      ...(recipe.aircraft === 'a320' || (recipe.aircraft && typeof recipe.aircraft === 'object') ? { aircraft: recipe.aircraft } : {}),
      ...(recipe.guidance && typeof recipe.guidance === 'object' ? { guidance: recipe.guidance } : {}),
    }),
  };
}

/**
 * Resolve a recipe into a placed face list + picks + the pose mover + HUD arrays.
 * Pure — no DB, no HTML. Same recipe → identical scene.
 * @returns {{ faces, picks, movers, bounds, stats }}
 */
export function planAirplaneScene(recipe = {}) {
  const { mission, flight } = runFlight(recipe);
  const { samples, events, aircraft, summary } = flight;
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const trace = recipe.trace === false ? false : true;
  const strobe = recipe.strobe === false ? false : true;
  const strobeEvery = Math.round(clampNum(recipe.strobeEvery, 6, 60, 16));
  const period = clampNum(recipe.playback, 20, 240, 70);
  const planeType = AIRPLANE_BODIES.includes(recipe.plane) ? recipe.plane : 'airliner';

  const T = samples[samples.length - 1].t;
  const dt = T / (N_SAMPLES - 1);

  // scene scale: true-proportion, normalized to ~320 units of downrange.
  const xMax = Math.max(...samples.map((s) => s.x), 1);
  const K = (320 / xMax) * scale;
  const span = 320 * scale;

  // ── the plane body: the airport primitive's fixed-wing net, lowered to mesh faces,
  // recentred at the origin, scaled to the marker size (nose along +x). ──
  const raw = vehicleFaces({ type: planeType, cx: 0, cy: 0 });
  const mnP = [Infinity, Infinity, Infinity], mxP = [-Infinity, -Infinity, -Infinity];
  for (const f of raw) for (const c of f.corners || []) for (let i = 0; i < 3; i++) { if (c[i] < mnP[i]) mnP[i] = c[i]; if (c[i] > mxP[i]) mxP[i] = c[i]; }
  const netLen = mxP[0] - mnP[0] || 1;
  const LB = span * 0.045;
  const Kp = LB / netLen;
  const mid = [(mnP[0] + mxP[0]) / 2, (mnP[1] + mxP[1]) / 2, (mnP[2] + mxP[2]) / 2];
  const planeFaces = raw.map((f) => ({
    ...f, group: 'plane',
    corners: (f.corners || []).map((c) => [(c[0] - mid[0]) * Kp, (c[1] - mid[1]) * Kp, (c[2] - mid[2]) * Kp]),
  }));
  const halfH = ((mxP[2] - mnP[2]) / 2) * Kp;

  // equal-dt resample: path + pitch + the HUD arrays, all in step. Path z carries the
  // half-height offset so the belly rides the runway during the ground phases.
  const cur = { i: 0 };
  const path = [], tiltAngles = [];
  const hud = { phase: [], t: [], alt: [], speed: [], aoa: [], cl: [], ld: [], thrust: [], cfg: [] };
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = i * dt, s = interpAt(samples, t, cur);
    path.push([s.x * K, 0, s.z * K + halfH]);
    tiltAngles.push(-s.pitch);   // rotation about +y tips the +x nose DOWN for positive angles
    hud.phase.push(phaseLabel({ phase: s.phase, thrust: s.thrustNear }));
    hud.t.push(+t.toFixed(1));
    hud.alt.push(+s.z.toFixed(0));
    hud.speed.push(+s.v.toFixed(1));
    hud.aoa.push(+(s.alpha / Math.PI * 180).toFixed(1));
    hud.cl.push(+s.cl.toFixed(2));
    hud.ld.push(+s.ld.toFixed(1));
    hud.thrust.push(Math.round(s.thrust));
    hud.cfg.push(`${s.config}${s.gear ? ' · gear' : ''}`);
  }

  const faces = [], picks = [];
  const tag = (fs) => { for (const f of fs) faces.push(f); };

  if (trace) tag(traceRibbonFaces(path, Math.max(span * 0.003, LB * 0.05), TRACE_FILL, 'scene'));
  if (strobe) {
    for (let i = strobeEvery; i < N_SAMPLES - 1; i += strobeEvery) {
      tag(lowerObjectFaces({ lathes: [sphereSpec(path[i], LB * 0.06, GHOST_TINT, 10)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group: 'scene' })));
    }
  }

  for (const f of planeFaces) faces.push(f);
  picks.push({
    name: 'plane', kind: 'body', label: `${aircraft.label} (${planeType})`,
    fields: [
      { k: 'mission', v: mission === 'glide' ? 'engines-out glide' : 'airline hop' },
      { k: 'mass', v: `${(aircraft.mass / 1000).toFixed(0)} t · wing ${aircraft.S} m²` },
      { k: 'rotate', v: `${summary.Vr.toFixed(0)} m/s after ${events.liftoff.groundRoll.toFixed(0)} m` },
      { k: 'touchdown', v: `${events.touchdown.sink.toFixed(1)} m/s sink` },
      ...(summary.glideRatio ? [{ k: 'glide ratio', v: `${summary.glideRatio.toFixed(1)} : 1` }] : []),
      { k: 'honesty', v: 'four real forces · scripted pilot · 2-D planar' },
    ],
  });

  // ── dressing: grass band + runway A (departure) + runway B (arrival) with centreline marks ──
  const yHalf = Math.max(span * 0.04, LB);
  tag(box(-span * 0.02, span * 1.02, -yHalf, yHalf, -span * 0.004, 0, GROUND_FILL, 'scene'));
  const runway = (x0, x1, name) => {
    tag(box(x0, x1, -LB * 0.35, LB * 0.35, 0, span * 0.0012, RUNWAY_FILL, name));
    const n = 7, seg = (x1 - x0) / (2 * n);
    for (let i = 0; i < n; i++) tag(box(x0 + (2 * i + 0.5) * seg, x0 + (2 * i + 1.3) * seg, -LB * 0.02, LB * 0.02, span * 0.0012, span * 0.0016, RUNWAY_MARK, name));
  };
  runway(-LB * 0.5, (events.liftoff.groundRoll + 800) * K, 'runwayA');
  runway((events.touchdown.x - 600) * K, (events.stop.x + 700) * K, 'runwayB');
  picks.push({ name: 'runwayA', kind: 'site', label: 'Departure runway', fields: [{ k: 'ground roll', v: `${events.liftoff.groundRoll.toFixed(0)} m to rotate` }] });
  picks.push({ name: 'runwayB', kind: 'site', label: 'Arrival runway', fields: [{ k: 'rollout', v: `${events.stop.rolloutLen.toFixed(0)} m to stop` }] });

  // ── the pose mover: fly the route + pitch into it; carries the flight-deck readout ──
  const movers = [{
    group: 'plane', basePos: [0, 0, 0], pose: true, path, tilt: { axis: [0, 1, 0], angles: tiltAngles },
    period, loop: false, hold: 2.5,
    label: `${aircraft.label} — ${mission === 'glide' ? 'engines-out glide' : 'takeoff to touchdown'}`,
    plane: hud,
  }];

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; } };
  for (const f of faces) for (const c of f.corners) bump(c);
  for (const c of path) { bump(add(c, [LB, 0, LB])); bump(sub(c, [LB, 0, LB])); }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of [...path, ...faces.flatMap((f) => f.corners)]) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));

  return {
    faces, picks, movers,
    bounds: { center, radius: radius || span },
    stats: {
      mission, plane: planeType, T: +T.toFixed(1), samples: N_SAMPLES, period, loop: false,
      groundRoll: +events.liftoff.groundRoll.toFixed(0),
      touchdownSink: +events.touchdown.sink.toFixed(2),
      rangeKm: +(summary.range / 1000).toFixed(1),
      glideRatio: summary.glideRatio != null ? +summary.glideRatio.toFixed(1) : null,
    },
  };
}

// ── the physical read-back channel (measure_view): the flight in real SI, unscaled. ──
export function sampleAirplanePhysics(recipe = {}, { every = 1 } = {}) {
  const { mission, flight } = runFlight(recipe);
  const { samples, events, aircraft, summary } = flight;
  const T = samples[samples.length - 1].t;
  const dt = T / (N_SAMPLES - 1);
  const cur = { i: 0 };
  const rows = [], realPath = [];
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = i * dt, s = interpAt(samples, t, cur);
    realPath.push([s.x, 0, s.z]);
    rows.push({ t: +t.toFixed(3), pos: [+s.x.toFixed(2), 0, +s.z.toFixed(2)], speed: +s.v.toFixed(3),
      alpha: +(s.alpha / Math.PI * 180).toFixed(3), cl: +s.cl.toFixed(4),
      lift: +s.lift.toFixed(0), drag: +s.drag.toFixed(0), thrust: +s.thrust.toFixed(0), phase: s.phase });
  }
  const k = deriveKinematics(realPath, dt);
  const step = Math.max(1, Math.round(clampNum(every, 1, N_SAMPLES, 1)));
  const out = [];
  for (let i = 0; i < rows.length; i += step) out.push({ ...rows[i], accel: +k.accel[i].toFixed(3) });
  return {
    scenario: mission, label: `${aircraft.label} — ${mission}`, T, dt, loop: false, static: false,
    units: { t: 's', pos: 'm', speed: 'm/s', accel: 'm/s²', alpha: 'deg', cl: '1', lift: 'N', drag: 'N', thrust: 'N' },
    facts: [
      ['aircraft', `${aircraft.label} · ${(aircraft.mass / 1000).toFixed(0)} t · S ${aircraft.S} m² · AR ${aircraft.AR}`],
      ['rotate', `${summary.Vr.toFixed(1)} m/s @ ${events.rotate.x.toFixed(0)} m`],
      ['liftoff', `T+${events.liftoff.t.toFixed(0)} s · ground roll ${events.liftoff.groundRoll.toFixed(0)} m`],
      ...(events.enginesOut ? [['engines out', `T+${events.enginesOut.t.toFixed(0)} s @ ${events.enginesOut.alt.toFixed(0)} m`]] : []),
      ['touchdown', `T+${events.touchdown.t.toFixed(0)} s · ${events.touchdown.sink.toFixed(1)} m/s sink · ${(events.touchdown.x / 1000).toFixed(1)} km`],
      ...(summary.glideRatio ? [['glide ratio', `${summary.glideRatio.toFixed(1)} : 1`]] : []),
      ['honesty', 'four real forces; scripted pilot; 2-D planar; constant mass'],
    ],
    samples: out, count: out.length,
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. Orbit-only; a flight reads best side-on.
 */
export function assembleAirplaneScene(recipe = {}, { title } = {}) {
  const plan = planAirplaneScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.2;
  const side = { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.15, center[2]], lookAt: center, horizontalFov: 46 } };
  const angle = { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.5, center[1] - d * 0.9, center[2] + d * 0.4], lookAt: center, horizontalFov: 46 } };
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0b1020';
  return {
    faces: plan.faces,
    picks: plan.picks,
    movers: plan.movers,
    cameras: [side, angle],
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo airplane ${plan.stats.mission}`,
    bg,
    glow: false,
  };
}
