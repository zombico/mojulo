/**
 * THE SUPERCAR ON THE GRID — a composed supercar (vehicle-library.js) as a vehicle rig a race drives, on the rule its
 * own frame gives the sports class, lit in the race's mood.
 *
 *   supercarFigure(spec)          spec { preset?, seed?, surface?, mood? } → the rig (vehicle-rig.js packVehicleFigure):
 *                                 root, four wheels (wheelFL … wheelRR, the hubs the design's anchors) and the lamps'
 *                                 bones (lampHead, lampBrake: the status slots the page lights), its `live` (the front
 *                                 wheels steer, the body leans, squats and dives about the wheelbase's middle, a car's
 *                                 measure of it) and its `juice` (rubber smoke and sparks off the rear tyres, a flame
 *                                 at the tail pipes, the headlamps' glow brighter as the mood darkens)
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
import { JUICE, STATUS, MOTION, bakeJuice } from './juice.js';
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
  const juice = bakeJuice(CAR_JUICE.map((id) => ({ id, ...JUICE[id] })), anchors, r4(F.wheelRadius * 2), { slots: { ...(head.length ? { head: 'lampHead' } : {}), ...(brake.length ? { brake: 'lampBrake' } : {}) }, status: lamps });
  return {
    ...packVehicleFigure(bones, buckets, { rolls: wheels.map((w) => w.id) }),
    live, juice,
    figH: r4(Math.max(...shell.flatMap((f) => f.corners.map((p) => p[2])))),
    wheelbase: r4(WB), wheelRadius: r4(F.wheelRadius), warnings: [],
  };
}
