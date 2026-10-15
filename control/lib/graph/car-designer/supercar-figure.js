/**
 * THE SUPERCAR ON THE GRID — a composed supercar (vehicle-library.js) as a vehicle rig a race drives, on the rule its
 * own frame gives the sports class, lit in the race's mood.
 *
 *   supercarFigure(spec)          spec { preset?, seed?, surface?, mood? } → the rig (vehicle-rig.js packVehicleFigure):
 *                                 root, four wheels (wheelFL … wheelRR, the hubs the design's anchors) and the lamps'
 *                                 bones (lampHead, lampBrake: the status slots the page lights), its `live` (the front
 *                                 wheels steer, the body leans, squats and dives about the wheelbase's middle, a car's
 *                                 measure of it) and its `juice` (rubber smoke and sparks off the rear tyres, a flame
 *                                 at the tail pipes, the headlamps' glow brighter as the mood darkens; in a dark mood
 *                                 the headlamps' pool on the road (`juice.beams`), after dark the tail lamps' ribbons
 *                                 (`juice.trails`), in the wet a mist off the rear tyres)
 *   supercarRule(design, opts)    the sports class (roads/vehicles.js) at the design's length, width, height,
 *                                 wheelbase, track and wheel radius, at a tuning and in conditions
 *   readSupercarSpec(spec)        the spec checked (throws naming what is wrong)
 *
 * The game quality's mesh (vehicle-odm-surface.js), each face its baked fill; in a mood each face is lit again from its
 * albedo and corner normals under the mood's key and ambient (roads/race-mood.js), the lamps left as they shine.
 * Deterministic: the spec is the recipe.
 */
import { composeSupercar, SUPERCAR_LIBRARY } from './vehicle-library.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { JUICE, STATUS, MOTION, FX, bakeJuice } from './juice.js';
import { VEHICLES, ruleOf } from '../roads/vehicles.js';
import { moodOf, relightAlbedo, RACE_MOOD_IDS } from '../roads/race-mood.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const SPEC_KEYS = ['preset', 'seed', 'surface', 'mood'];
export function readSupercarSpec(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('supercar: a spec is { preset?, seed?, surface?, mood? }');
  for (const k of Object.keys(spec)) if (!SPEC_KEYS.includes(k)) throw new Error(`supercar: '${k}' is not one of ${SPEC_KEYS.join(', ')}`);
  if (spec.preset !== undefined && !Object.hasOwn(SUPERCAR_LIBRARY, spec.preset)) throw new Error(`supercar: preset is one of ${Object.keys(SUPERCAR_LIBRARY).join(', ')}`);
  if (spec.seed !== undefined && !Number.isInteger(spec.seed)) throw new Error('supercar: seed is a whole number');
  if (spec.mood !== undefined && !RACE_MOOD_IDS.includes(spec.mood)) throw new Error(`supercar: mood is one of ${RACE_MOOD_IDS.join(', ')}`);
  return spec;
}

/** The sports class at the design's own frame (its mass, power and grip the class's). */
export function supercarRule(design, { tuning = 'arcade', conditions = 'dry' } = {}) {
  const F = design.frame, A = design.topology.anchors;
  const row = { ...VEHICLES.sports, L: r4(F.L), W: r4(F.W), H: r4(F.H), wheelbase: r4(A.wheelFL[1] - A.wheelRL[1]), track: r4(F.track), wheelRadius: r4(F.wheelRadius) };
  return ruleOf(row, { tuning, conditions, vehicle: 'sports' });
}

// a car's measure of a cartoon's motion: the body moves a third as far
const CAR_MOTION = { lean: 0.35, squat: 0.4, dive: 0.4, bounce: 0.5 };
const CAR_JUICE = ['throttleFlame', 'boostFlame', 'boostTrail', 'driftSpark', 'skidSmoke', 'surfaceDust', 'landingRing', 'damageSmoke'];
// how dark a mood is: its ambient and half its key against noon's (0 at noon, 1 in no light at all)
const mean = (v) => (v[0] + v[1] + v[2]) / 3;
const darkness = (m) => r4(Math.max(0, Math.min(1, 1 - (mean(m.ambient) + 0.5 * mean(m.key)) / 0.8)));
// the headlamps' pool: from the nose, a length on the road, a width (of the car's), two lobes that merge as they reach
const BEAM = { len: 17, width: 2.6, spread: 0.32, colour: '#fff0c8', amount: 0.95 }, BEAM_DARK = 0.4;
// the tail lamps' ribbons: their width (m), how long a point lives (s), how many, above what speed, brighter on the brake
const TRAIL = { colour: '#ff2414', width: 0.11, life: 0.3, points: 24, minSpeed: 6, amount: 0.7, brake: 1.6 }, TRAIL_DARK = 0.8;
// rain off the rear tyres: a mist the colour of the sky it falls from, never brighter than the light it is seen in
const hexOf = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const SPRAY_LIT = [128, 140, 160];   // (the lamps and the cars' own light the spray is seen in, after dark)
const rainSpray = (m, dark) => {
  const c = m.sky.horizon.map((v, k) => v + (SPRAY_LIT[k] - v) * 0.55 * dark);
  return { id: 'rainSpray', when: 'speed > 7', at: 'contact.rear', look: 'smoke', colours: [hexOf(c.map((v) => v * 1.15)), hexOf(c.map((v) => v * 0.85))], rate: 28, life: 0.55, size: 0.7, budget: 40 };
};
// the genre's streaks after dark: the colour of the night, not a white that glares on it
const DARK_STREAK = '#7d8fbf';
const darkFx = (dark) => (dark < TRAIL_DARK ? FX : Object.fromEntries(Object.entries(FX).map(([id, r]) => [id, r.look === 'streak' || r.look === 'screen' ? { ...r, colours: [DARK_STREAK] } : r])));
const fan = (f) => {
  const n = f.corners.length; if (n <= 4) return [f];
  const out = []; for (let i = 1; i + 1 < n; i += 2) { const idx = i + 2 < n ? [0, i, i + 1, i + 2] : [0, i, i + 1]; out.push({ ...f, corners: idx.map((j) => f.corners[j]), ...(f.cornerFills ? { cornerFills: idx.map((j) => f.cornerFills[j]) } : {}), ...(f.cornerNormals ? { cornerNormals: idx.map((j) => f.cornerNormals[j]) } : {}) }); }
  return out;
};
const mid = (fs) => { const p = fs.flatMap((f) => f.corners); return [0, 1, 2].map((k) => r4(p.reduce((s, q) => s + q[k], 0) / p.length)); };

export function supercarFigure(spec = {}) {
  readSupercarSpec(spec);
  const car = composeSupercar({ preset: spec.preset ?? 'razor', seed: spec.seed ?? 1, surface: { ...(spec.surface ?? {}), quality: 'game' } });
  const mood = spec.mood ? moodOf(spec.mood) : null, A = car.design.topology.anchors;
  // a face as the rig draws it: its fill (in a mood, lit again from its albedo; a lamp shines as it is)
  const lamp = (f) => f.material === 'lamp' || f.material === 'tail';
  const draw = (f) => {
    const out = { corners: f.corners, fill: f.fill, ...(f.cornerFills ? { cornerFills: f.cornerFills } : {}) };
    if (!mood || lamp(f) || !f.albedo) return out;
    const lit = (n) => relightAlbedo(f.albedo, n, mood, undefined, { figure: true });
    return { corners: f.corners, fill: lit(f.outNormal), cornerFills: (f.cornerNormals ?? f.corners.map(() => f.outNormal)).map(lit) };
  };
  const shell = [...car.faces.body, ...car.faces.detail].flatMap(fan);
  const head = shell.filter((f) => f.part === 'headlamp'), brake = shell.filter((f) => f.part === 'taillamp');
  const root = shell.filter((f) => f.part !== 'headlamp' && f.part !== 'taillamp');
  // the wheels: one list in the order they were built, port front and rear, then starboard front and rear
  const W = car.faces.wheels.flatMap(fan), q = W.length / 4;
  const wheels = [['wheelFL', 0, A.wheelFL], ['wheelRL', 1, A.wheelRL], ['wheelFR', 2, A.wheelFR], ['wheelRR', 3, A.wheelRR]].map(([id, k, hub]) => ({ id, hub: hub.map(r4), faces: W.slice(k * q, (k + 1) * q) }));
  const bones = [{ id: 'root', head: [0, 0, 0] }, ...wheels.map((w) => ({ id: w.id, head: w.hub })), ...(head.length ? [{ id: 'lampHead', head: mid(head) }] : []), ...(brake.length ? [{ id: 'lampBrake', head: mid(brake) }] : [])];
  const buckets = new Map([['root', root.map(draw)], ...wheels.map((w) => [w.id, w.faces.map(draw)]), ...(head.length ? [['lampHead', head.map(draw)]] : []), ...(brake.length ? [['lampBrake', brake.map(draw)]] : [])]);
  const F = car.design.frame, WB = A.wheelFL[1] - A.wheelRL[1], tailY = -F.L / 2;
  const live = {
    steer: ['wheelFL', 'wheelFR'],
    body: { bones: ['root', ...(head.length ? ['lampHead'] : []), ...(brake.length ? ['lampBrake'] : [])], pivot: [0, r4(A.wheelRL[1] + WB / 2), 0] },
    gains: { steer: MOTION.steer.gain * 0.6, steerMax: MOTION.steer.limit * 0.8, lean: MOTION.lean.gain * CAR_MOTION.lean, leanMax: MOTION.lean.limit * CAR_MOTION.lean, squat: MOTION.squat.gain * CAR_MOTION.squat, dive: MOTION.dive.gain * CAR_MOTION.dive, bounce: MOTION.bounce.gain * CAR_MOTION.bounce, wobble: 0, wobbleMax: 0 },
  };
  // the juice: two pipes at the tail, the four contact patches; the headlamps as bright as the mood is dark
  const anchors = [
    ...[-1, 1].map((s) => ({ kind: 'tip', bone: 'root', at: [r4(s * F.W * 0.18), r4(tailY - 0.02), r4(F.groundClearance + 0.12)], dir: [0, -1, 0] })),
    ...wheels.map((w) => ({ kind: w.id.includes('F') ? 'contact.front' : 'contact.rear', bone: null, at: [w.hub[0], w.hub[1], 0], dir: [0, 0, 1] })),
    { kind: 'body', bone: 'root', at: [0, 0, r4(F.H * 0.6)], dir: [0, 0, 1] },
  ];
  const lamps = mood ? { ...STATUS, headlamps: { ...STATUS.headlamps, amount: mood.headlamps, halo: 0.5 + mood.headlamps } } : STATUS;
  const dark = mood ? darkness(mood) : 0;
  const rows = [...CAR_JUICE.map((id) => ({ id, ...JUICE[id] })), ...(mood?.wet ? [rainSpray(mood, dark)] : [])];
  const juice = bakeJuice(rows, anchors, r4(F.wheelRadius * 2), { slots: { ...(head.length ? { head: 'lampHead' } : {}), ...(brake.length ? { brake: 'lampBrake' } : {}) }, status: lamps, fx: darkFx(dark) });
  // the car's own light in the dark: the headlamps' pool on the road ahead, the tail lamps' ribbons after dark
  if (dark >= BEAM_DARK && head.length) {
    const nose = Math.max(...head.flatMap((f) => f.corners.map((p) => p[1])));
    juice.beams = { from: r4(nose - 0.1), len: BEAM.len, width: r4(F.W * BEAM.width), spread: BEAM.spread, colour: BEAM.colour, amount: r4(BEAM.amount * dark) };
  }
  if (dark >= TRAIL_DARK && brake.length) {
    const side = (sg) => brake.filter((f) => Math.sign(f.corners.reduce((a, p) => a + p[0], 0)) === sg);
    juice.trails = { bone: 'lampBrake', at: [-1, 1].map(side).filter((fs) => fs.length).map(mid), colour: TRAIL.colour, width: TRAIL.width, life: TRAIL.life, points: TRAIL.points, minSpeed: TRAIL.minSpeed, amount: r4(TRAIL.amount * dark), brake: TRAIL.brake };
  }
  return {
    ...packVehicleFigure(bones, buckets, { rolls: wheels.map((w) => w.id), packed: true }),
    live, juice,
    figH: r4(Math.max(...shell.flatMap((f) => f.corners.map((p) => p[2])))),
    wheelbase: r4(WB), wheelRadius: r4(F.wheelRadius), warnings: [],
  };
}
