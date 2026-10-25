/**
 * THE VEHICLE CONFORMANCE CORPUS — a racer's rig as the Godot kernel poses it and reads its juice (kernel/vehicle.gd,
 * since 0.31.0) against the page's own functions: the live overlay's springs (__rigLive), the clip sampled at the
 * wheel's phase (__rigBone, __clipLookup) through the gait crossfade (worlds/controllable/gait.js advanceGaitMix), the
 * facts the juice's triggers read (the page's own lines in __updateRacerJuice), the triggers (__rjWhen) and the status
 * rows' tints, halos and bubble (__rjStatus). Those are taken from the page as the controllable channel emits it for a
 * live, juiced figure and run against the page's three (public/vendor/three), so the corpus holds the port to the page
 * and not to a copy of it. A scenario is a machine (a cartoon kart off the racer solver, a supercar in the darkest
 * mood) driven by the web's drive rule (game/level-sim.js) over a piece of land with a held input a frame, and the facts
 * a game sets (a boost, a hit, damage, a shield, a star, an item, charge) laid on it after its step; both sides print
 * one canonical string a frame: every bone's pose, the facts, the rows on, the bones' tints and the halos, to 1e-9.
 *
 *   SCENARIOS, corpus(), runVehicle(sc) → [string], scenarioById(id)
 *
 * One scenario per path through the overlay and the juice: a kart with a spinning mast and a steering wheel launched off
 * a ramp and landed (the bounce, the landing's ring); a kart with steered fenders stopped dead (a bump), thrown into
 * corners, braked and reversed, standing to idle and back (the crossfade, the slide, the corner's tiers); the supercar
 * at night with every status a game can set.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { simLevel } from '../game/level-sim.js';
import { faceGround } from '../game/level-equivalence.js';
import { buildGait } from '../worlds/controllable/gait.js';
import { controllableChannelScript } from './channels/controllable/index.js';
import { rollEgocube } from '../egocube/egocube.js';
import { racerFromSheet, solveRacer } from '../car-designer/racer.js';
import { supercarFigure } from '../car-designer/supercar-figure.js';
import { vehicleRow } from './engine-score.js';

export const DT = 1 / 30;
const clone = (x) => JSON.parse(JSON.stringify(x));
const nano = (x) => (Number.isFinite(x) ? Math.floor(x * 1e9 + 0.5) / 1e9 : null);
function canon(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

const quad = (x0, y0, x1, y1, z = 0) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]] });
const trianglesOf = (faces) => faces.flatMap((f) => f.corners.slice(1, -1).map((_, i) => [f.corners[0], f.corners[i + 1], f.corners[i + 2]]));
const run = (...parts) => parts.flatMap(([n, input, set]) => Array.from({ length: n }, (_, i) => ({ input: { ...input }, ...(set && i === 0 ? { set: { ...set } } : {}) })));
const RAMP = [quad(-60, -10, 20, 10), { corners: [[20, -10, 0], [26, -10, 1.6], [26, 10, 1.6], [20, 10, 0]] }, quad(26, -10, 29, 10, 1.6), quad(29, -10, 160, 10, 0)];
const FLAT = [quad(-200, -200, 200, 200)];

// the machines: one kart per bone layout the overlay has (a spinning mast and a steering wheel; steered fenders and a
// still mast), the supercar after dark in the rain (its beams, trails and spray; head and brake slots only)
const kart = (archetype) => solveRacer(racerFromSheet(rollEgocube({ facets: { archetype }, seed: 11 }), { seed: 3 }), { seed: 3 }).figure;
const FIGS = { jester: () => kart('jester'), sage: () => kart('sage'), night: () => supercarFigure({ mood: 'night-rain' }) };
const ruleOf = (fig, extra = {}) => ({ type: 'drive', horsepower: 60, mass: 320, wheelbase: fig.wheelbase, wheelRadius: fig.wheelRadius, eye: 0.2, air: true, topSpeed: 24, ...extra });

export const SCENARIOS = [
  { id: 'vehicle-mast-ramp', about: 'a kart with a spinning mast and a steering wheel off a ramp: the squat, the flight, the landing\'s bounce and ring, a turn after',
    fig: 'jester', rule: {}, pos: [0, 0, 0.2], faces: RAMP, frames: run([10, {}], [70, { forward: 1 }], [40, { forward: 1, turn: 0.7 }], [20, { forward: -1 }], [20, {}]) },
  { id: 'vehicle-fenders-corners', about: 'a kart with steered fenders stopped dead (a crash a game sets), thrown into corners, braked, reversed, stood to idle and away again; the facts a game sets on it',
    fig: 'sage', rule: { horsepower: 90, grip: 0.8 }, pos: [0, 0, 0.2], faces: FLAT,
    frames: run([60, { forward: 1 }], [10, { forward: 1 }, { speed: 1 }], [50, { forward: 1, turn: 1 }], [25, { forward: -1, turn: -1 }], [40, { forward: -1 }], [30, {}], [20, { forward: 1 }, { charge: 0.5 }], [15, { forward: 1 }, { charge: 1, item: true }],
      [10, { forward: 1 }, { boosting: true, charge: 0, item: false }], [10, { forward: 1 }, { boosting: false, hit: true }], [20, { forward: 1 }, { hit: false, damage: 0.7 }]) },
  { id: 'vehicle-night-status', about: 'the supercar after dark: its head lamps and brake lamps, a boost, a hit, damage\'s flicker, a shield, a star',
    fig: 'night', rule: { horsepower: 400, mass: 1400, eye: 0.4, topSpeed: 60 }, pos: [0, 0, 0.4], faces: FLAT,
    frames: run([45, { forward: 1 }], [20, { forward: -1 }], [10, { forward: 1 }, { boosting: true }], [10, { forward: 1 }, { boosting: false, hit: true }], [5, { forward: 1 }, { hit: false }],
      [20, { forward: 1, turn: -0.5 }, { damage: 0.5 }], [15, { forward: 1 }, { damage: 0, shield: true }], [20, { forward: 1 }, { shield: false, invulnerable: true }], [10, {}, { invulnerable: false }]) },
];

// ── the page's functions, as the controllable channel emits them for a live, juiced figure ──────────────────────────
const fnText = (src, name) => {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`vehicle corpus: the page has no ${name}`);
  let depth = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; }
  return src.slice(i, j + 1);
};
const lineOf = (src, start) => { const i = src.indexOf(start); if (i < 0) throw new Error(`vehicle corpus: the page has no '${start}'`); return src.slice(i, src.indexOf('\n', i)); };
async function page() {
  const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
  const fig = FIGS.jester();
  const src = controllableChannelScript([{ id: 'car', pilotable: true, rule: ruleOf(fig), transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'figure', figure: 'car' } }], null, { car: fig });
  // the facts: the page's lines from the slide's clock to the facts it reads, run as one body
  const a = src.indexOf('rj.skidT = e.skidding'), b = src.indexOf('for (const row of rj.J.rows)', a);
  const factsBody = src.slice(a, b);
  const body = [
    lineOf(src, 'const __lvQ = '), lineOf(src, 'const __LV_X = '), fnText(src, '__rigLive'), fnText(src, '__clipLookup'), fnText(src, '__rigBone'),
    lineOf(src, 'let __rjSeed = '), lineOf(src, 'const __rjRnd = '), fnText(src, '__rjWhen'), lineOf(src, 'const __rjC = '), fnText(src, '__rjStatus'),
    `function __facts(e, rj, d) { ${factsBody} return F; }`,
    'return { __rigLive, __rigBone, __rjWhen, __rjStatus, __facts, reseed: () => { __rjSeed = 12345; } };',
  ].join('\n');
  // eslint-disable-next-line no-new-func
  return { THREE, make: new Function('THREE', '__world', body) };
}
// (loaded once, as the module loads: the corpus compares synchronously)
const PAGE = await page();

const GAIT = {}; buildGait(GAIT);

// the page's rig loop over a vehicle's bones (__syncRigEntity: the gait crossfade, then the live overlay; a vehicle
// has no head to turn, no arm to lay over and no aim) → [qx, qy, qz, qw, px, py, pz] a bone
function poseOf(P, THREE, fig, rig, e, dt) {
  const mode = e.moving ? e.locomotion : 'idle';
  const mix = GAIT.advanceGaitMix(rig.mix, mode, e.gaitPhase, dt || 0, rig.blendTime);
  const w = mix.prevMode ? mix.w * mix.w * (3 - 2 * mix.w) : 1;
  const hasIdle = !!fig.clips.idle;
  const LV = fig.live ? P.__rigLive(e, rig, dt) : null;
  const QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), H = new THREE.Vector3(), PA = [0, 0, 0], PB = [0, 0, 0], out = [];
  for (let bi = 0; bi < fig.bones.length; bi++) {
    P.__rigBone(fig, mix.mode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.mode, mix.phase, mix.mode === 'idle' && !hasIdle, bi, QA, PA);
    if (mix.prevMode) {
      P.__rigBone(fig, mix.prevMode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.prevMode, mix.prevPhase, mix.prevMode === 'idle' && !hasIdle, bi, QB, PB);
      QA.slerp(QB, 1 - w);
      for (let k = 0; k < 3; k++) PA[k] += (PB[k] - PA[k]) * (1 - w);
    }
    if (LV && LV.role[bi]) {
      const role = LV.role[bi];
      if (role === 'steer') QA.premultiply(LV.steer);
      else {
        if (role === 'wheel') QA.premultiply(LV.wheel);
        else if (role === 'mast') QA.premultiply(LV.mast);
        const Pv = LV.pivot;
        H.set(PA[0] - Pv[0], PA[1] - Pv[1], PA[2] - Pv[2]).applyQuaternion(LV.body);
        PA[0] = Pv[0] + H.x; PA[1] = Pv[1] + H.y; PA[2] = Pv[2] + H.z + LV.dz;
        QA.premultiply(LV.body);
      }
    }
    out.push([QA.x, QA.y, QA.z, QA.w, PA[0], PA[1], PA[2]]);
  }
  return out;
}

// the bones with a part (a part-less bone has no mesh and no node) and the slots' bones among them
const meshed = (fig) => fig.bones.map((_, i) => i).filter((i) => !!fig.parts[i]);
function slotBones(fig) {
  const has = meshed(fig), out = { all: has };
  for (const [k, id] of Object.entries(fig.juice.slots || {})) { const i = fig.bones.findIndex((b) => b.id === id); if (i >= 0 && has.includes(i)) out[k] = [i]; }
  return out;
}

const snap = (pose, F, on, st) => canon({
  pose: pose.map((b) => b.map(nano)), facts: Object.fromEntries(Object.entries(F).map(([k, v]) => [k, nano(Number(v))])), on,
  tint: st.u.map((u) => [...u.tint, u.mix, ...u.mixCol, ...u.add].map(nano)), halo: Object.fromEntries(Object.entries(st.halo).map(([k, v]) => [k, nano(v)])),
  bubble: st.bubble ? { on: st.bubble.on, col: st.bubble.col.map(nano), a: nano(st.bubble.a) } : null,
});

export function runVehicle(sc) {
  const { THREE, make } = PAGE;
  const world = { time: 0 }, P = make(THREE, world);
  P.reseed();
  const fig = FIGS[sc.fig](), rule = ruleOf(fig, sc.rule);
  const sim = simLevel({ entities: [{ id: 'hero', pilotable: true, rule: clone(rule), transform: { pos: sc.pos.slice(), heading: 0 }, body: { type: 'none' } }], events: {} }, { ground: faceGround(sc.faces) });
  const rig = { fig, mix: {}, blendTime: undefined };
  // the juice's state as __rjBuild lays it: each bone's uniforms, the slots, the halos, the bubble
  const J = fig.juice, has = meshed(fig), S = slotBones(fig);
  const st = fig.bones.map((_, i) => (has.includes(i) ? { uTint: { value: new THREE.Vector3(1, 1, 1) }, uMix: { value: 0 }, uMixCol: { value: new THREE.Color(1, 1, 1) }, uAdd: { value: new THREE.Vector3() } } : null));
  const slot = Object.fromEntries(Object.entries(S).map(([k, is]) => [k, is.map((i) => st[i])]));
  const halos = (J.status || []).filter((r) => r.halo).map((row) => ({ row, spr: { material: { opacity: 0 } } }));
  const bubble = (J.status || []).some((r) => r.look === 'bubble') ? { visible: false, material: { uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uA: { value: 0 } } } } : null;
  const rj = { J, st, slot, halos, bubble, on: {}, flashT: {}, skidT: 0, prevV: 0, accel: 0, impactCD: 0, wasBoost: false };
  const snaps = [];
  sc.frames.forEach((f, i) => {
    for (const k of Object.keys(sim.input)) delete sim.input[k];
    Object.assign(sim.input, f.input);
    sim.frame(DT);
    const e = sim.world.byId.hero;
    if (f.set) Object.assign(e, f.set);
    world.time = (i + 1) * DT;
    const pose = poseOf(P, THREE, fig, rig, e, DT);
    const d = Math.min(0.05, DT), F = P.__facts(e, rj, d);
    const on = [...J.rows, ...(J.fx || [])].filter((r) => !!P.__rjWhen(r.when, F)).map((r) => r.id);
    P.__rjStatus(rj, F, d, world.time);
    const u = st.map((x) => (x ? { tint: [x.uTint.value.x, x.uTint.value.y, x.uTint.value.z], mix: x.uMix.value, mixCol: [x.uMixCol.value.r, x.uMixCol.value.g, x.uMixCol.value.b], add: [x.uAdd.value.x, x.uAdd.value.y, x.uAdd.value.z] } : null)).filter(Boolean);
    const halo = Object.fromEntries(halos.map((h) => [h.row.id, h.spr.material.opacity]));
    const b = bubble ? { on: bubble.visible, col: [bubble.material.uniforms.uCol.value.r, bubble.material.uniforms.uCol.value.g, bubble.material.uniforms.uCol.value.b], a: bubble.material.uniforms.uA.value } : null;
    snaps.push(snap(pose, F, on, { u, halo, bubble: b }));
  });
  return snaps;
}

// what the Godot side reads: the figure as score.vehicles carries it, the slots' bones, the rule, the land, the frames
export function corpus() {
  return SCENARIOS.map((sc) => {
    const fig = FIGS[sc.fig]();
    return clone({ id: sc.id, vehicle: vehicleRow(fig), slots: slotBones(fig), rule: ruleOf(fig, sc.rule), pos: sc.pos, tris: trianglesOf(sc.faces), frames: sc.frames, dt: DT });
  });
}

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id);
