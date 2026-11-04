/**
 * rupa/wind-script.js — the wind drawn without simulating it: light things (leaves, litter, petals, ash) moved by a
 * closed-form script of time, derived from the same wind and the same drag the physics uses. rupa is the internal name.
 *
 * WHY IT IS EXACT ENOUGH. A leaf's drag relaxes it to the air's motion in τ = v_t / g, about a quarter of a second
 * (v_t its falling speed through still air, about 2 m/s), against seconds of falling. So, to within τ, a light thing
 * moves AT the wind while it sinks at v_t: no step-by-step integration is needed, and its path is a formula:
 *   height   z(t) = z0 − v_t·t, down to the ground
 *   drift    the wind's speed summed over the fall. The wind rises with height by a power law, U(z) = U10·(z/10)^α
 *            (held at its 0.5 m value below that, as the runtime's windAt does), so the sum is exact:
 *            ∫U dt = U10 / 10^α · (z0^(α+1) − z^(α+1)) / ((α + 1)·v_t)
 *   gusts    each of the wind's three seeded waves adds its own exact sum, (gust·U/3)·(sin(ωt + φ) − sin(ω(t − age) + φ))/ω
 *   shelter  behind a barrier (below its top, within its width) the air is its wake, by the runtime's blocking law: speed
 *            β·U close behind (β what its porosity bleeds through), then U·(1 − c/√x), c = 0.98·√(Cd·2h). Moving at the air
 *            through it, the time to go x is exact: x/β to the cap's end x_c = (c/(1 − β))², then
 *            G(x) − G(x_c), G(x) = x + 2c√x + 2c²·ln(√x − c); a few Newton steps invert it (a solid wall holds what drifts
 *            into its still air at its face, where it settles: a drift behind a fence)
 *   ground   landed, it skitters once the wind beats its friction: ½ρ·Cd·A·u² > μ·m·g gives u > √μ·v_t, and it then
 *            moves at the wind's excess over that, shelter included; after `rest` seconds on the ground it fades and
 *            starts again from its release point, so the script loops forever on its own
 * A GPU runs the same formula per vertex (GLSL below), so thousands of leaves cost the CPU one time uniform a frame.
 *
 *   scriptOf(wind, { kind?, source, wakes?, field?, rest?, floor? }) → script (plain numbers: the shader's uniforms)
 *     wind    the level's wind ({ speed, dir, terrain?, gust?, seed? }), resolved by rupaPhysics.windOf
 *     kind    'leaf' (default) | 'litter' | 'ash' | { size: [x, y, z], mass }: what flies, its falling speed from drag
 *     source  { min, max }: where things are released (a tree's canopy, a street's whole width)
 *     wakes   barriers [{ min, max, porosity? }] (each a footprint, a height and its open share), at most 8
 *     field   { min, max } [x, y] the drift wraps within, so things stay in view
 *   leafAt(script, i, t) → { pos, age, falling, flutter }: the JS reference of the shader, for tests and the CPU
 *   releaseOf(script, i) → [x, y, z]: thing i's seeded release point
 *   GLSL      the vertex chunk: `vec3 windScript(float i, float t)` over the uniforms `scriptUniforms(script)` names
 */
import { rupaPhysics } from './index.js';

const G = 9.81, CD = 1.05, MU = 0.5, MAX_WAKES = 8;
const KINDS = Object.freeze({
  leaf: { size: [0.06, 0.04, 0.002], mass: 0.06 * 0.04 * 0.0003 * 600 },
  litter: { size: [0.21, 0.297, 0.002], mass: 0.21 * 0.297 * 80e-3 },   // a sheet of A4 paper, 80 g/m²
  ash: { size: [0.01, 0.01, 0.002], mass: 0.01 * 0.01 * 0.0002 * 300 },
});

const frac = (x) => x - Math.floor(x);
const hash = (n) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);   // the shader's hash, identical in JS

// a thing's falling speed through still air: its weight against the drag on its tumbling area (rupaPhysics.dragArea)
export function fallSpeed(kind = 'leaf') {
  const k = typeof kind === 'string' ? KINDS[kind] : kind;
  if (!k || !Array.isArray(k.size) || !(k.mass > 0)) throw new Error(`windScript: kind is ${Object.keys(KINDS).join(', ')} or { size, mass }`);
  const A = rupaPhysics.dragArea({ min: [0, 0, 0], max: k.size }, [0, 0, -1]);
  return Math.sqrt((2 * k.mass * G) / (rupaPhysics.AIR.density * CD * A));
}

export function scriptOf(windSpec, { kind = 'leaf', source, wakes = [], field = null, rest = 4, floor = 0 } = {}) {
  if (!source || !Array.isArray(source.min) || !Array.isArray(source.max)) throw new Error('windScript: source is { min, max }, where things are released');
  const w = rupaPhysics.windOf(windSpec) || { speed: 0, dir: [1, 0], alpha: 0.14, gust: 0, phases: [{ w: 1, k: 0, p: 0 }, { w: 1, k: 0, p: 0 }, { w: 1, k: 0, p: 0 }] };
  const vt = fallSpeed(kind), d = w.dir, across = [-d[1], d[0]];
  const ws = wakes.slice(0, MAX_WAKES).map((b) => {
    const cs = [[b.min[0], b.min[1]], [b.max[0], b.min[1]], [b.min[0], b.max[1]], [b.max[0], b.max[1]]];
    const along = cs.map((c) => c[0] * d[0] + c[1] * d[1]), side = cs.map((c) => c[0] * across[0] + c[1] * across[1]);
    return [Math.max(...along), Math.min(...side), Math.max(...side), b.max[2] - floor, b.porosity ?? 0];   // lee face, side span, height, porosity
  });
  return {
    u10: w.speed, dir: [...d], alpha: w.alpha, gust: w.gust, phases: w.phases.map((p) => [p.w, p.k, p.p]),
    vt, skitter: Math.sqrt(MU) * vt, rest, floor, wakes: ws,
    source: { min: [...source.min], max: [...source.max] }, field: field ? { min: [...field.min], max: [...field.max] } : null,
  };
}

export function releaseOf(s, i) {
  return [0, 1, 2].map((k) => s.source.min[k] + hash(i * 3 + k + 0.5) * (s.source.max[k] - s.source.min[k]));
}

// the free wind's speed at height z, and its sum over a fall from z0 to z (exact, the 0.5 m floor included)
const U = (s, z) => s.u10 * Math.pow(Math.max(0.5, z) / 10, s.alpha);
function driftFall(s, z0, z) {
  const a1 = s.alpha + 1, k = s.u10 / Math.pow(10, s.alpha) / (a1 * s.vt), lo = 0.5;
  const hi = (p, q) => k * (Math.pow(p, a1) - Math.pow(q, a1));
  if (z >= lo) return hi(z0, z);
  return (z0 > lo ? hi(z0, lo) : 0) + (U(s, lo) * (Math.min(z0, lo) - z)) / s.vt;
}
// the gusts' sum over [t − age, t] at a mean speed u
function driftGust(s, u, t, age) {
  let g = 0;
  for (const [w, , p] of s.phases) g += (Math.sin(w * t + p) - Math.sin(w * (t - age) + p)) / w;
  return (s.gust * u * g) / s.phases.length;
}
// shelter: the free distance s past a barrier's lee face mapped to the distance actually gone through its wake (exact)
const { bleed, blockDrag } = rupaPhysics;
export function wakeGone(free, h, phi) {
  const beta = bleed(phi), c = 0.98 * Math.sqrt(blockDrag(phi) * 2 * h);
  if (beta >= 1) return free;
  if (!(beta > 0)) return 0;                                   // a solid wall: held in its still air at the face
  const xc = (c / (1 - beta)) ** 2;
  if (free <= xc / beta) return beta * free;
  const Gf = (x) => { const y = Math.sqrt(x); return x + 2 * c * y + 2 * c * c * Math.log(y - c); };
  const target = Gf(xc) + free - xc / beta;
  let x = Math.max(xc * 1.0001, target);
  for (let k = 0; k < 8; k++) x = Math.max(xc * 1.0001, x - (Gf(x) - target) * (1 - c / Math.sqrt(x)));
  return x;
}
function sheltered(s, pos, freeAlong) {
  const d = s.dir, across = [-d[1], d[0]], ps = pos[0] * across[0] + pos[1] * across[1];
  let best = freeAlong;
  for (const [lee, s0, s1, h, phi] of s.wakes) {
    if (ps < s0 || ps > s1 || pos[2] - s.floor >= h || freeAlong <= lee) continue;
    best = Math.min(best, lee + wakeGone(freeAlong - lee, h, phi));
  }
  return best;
}

export function leafAt(s, i, t) {
  const r0 = releaseOf(s, i), z0 = r0[2] - s.floor, fall = z0 / s.vt, cycle = fall + s.rest;
  const age = (((t + hash(i + 0.25) * cycle) % cycle) + cycle) % cycle, falling = age < fall;
  const z = falling ? z0 - s.vt * age : 0, d = s.dir;
  let drift = driftFall(s, z0, z) + driftGust(s, U(s, (z0 + z) / 2), t, Math.min(age, fall));
  if (!falling) {   // on the ground: skitters at the wind's excess over what friction holds
    const ug = U(s, 0.5), over = Math.max(0, ug - s.skitter);
    drift += over * (age - fall);
  }
  const along0 = r0[0] * d[0] + r0[1] * d[1], pos = [r0[0] + d[0] * drift, r0[1] + d[1] * drift, z + s.floor];
  const along = sheltered(s, pos, along0 + drift), k = along - (along0 + drift);
  pos[0] += d[0] * k; pos[1] += d[1] * k;
  if (s.field) for (const j of [0, 1]) { const lo = s.field.min[j], span = s.field.max[j] - lo; pos[j] = lo + ((((pos[j] - lo) % span) + span) % span); }
  return { pos, age, falling, flutter: falling ? age * (3 + 4 * hash(i + 0.75)) : 0 };
}

// a barrier's wake constants for the GPU: its bleed β and the deficit's scale c (the shader needs no porosity law)
function wakeConsts(h, phi) { return [bleed(phi), 0.98 * Math.sqrt(blockDrag(phi) * 2 * h)]; }
/** The shader's uniforms, named as GLSL reads them. */
export function scriptUniforms(s) {
  const wakes = Array.from({ length: MAX_WAKES }, (_, k) => s.wakes[k] || [0, 0, 0, 0, 0]);
  return {
    uU10: s.u10, uDir: s.dir, uAlpha: s.alpha, uGust: s.gust, uPhases: s.phases, uVt: s.vt, uSkitter: s.skitter, uRest: s.rest,
    uFloor: s.floor, uWakes: wakes.map((w) => w.slice(0, 4)), uWakeB: wakes.map((w) => (w[4] === undefined ? 0 : wakeConsts(w[3], w[4]))), uWakeN: s.wakes.length, uSrcMin: s.source.min, uSrcMax: s.source.max,
    uFieldMin: s.field ? s.field.min : [-1e9, -1e9], uFieldMax: s.field ? s.field.max : [1e9, 1e9],
  };
}

/** The same formula on the GPU: `vec4 windScript(float i, float t)` → xyz the position, w the flutter phase (−1 landed). */
export const GLSL = `
uniform float uU10, uAlpha, uGust, uVt, uSkitter, uRest, uFloor; uniform vec2 uDir, uFieldMin, uFieldMax;
uniform vec3 uPhases[3]; uniform vec4 uWakes[${MAX_WAKES}]; uniform vec2 uWakeB[${MAX_WAKES}]; uniform int uWakeN; uniform vec3 uSrcMin, uSrcMax;
float wsHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float wsU(float z) { return uU10 * pow(max(0.5, z) / 10.0, uAlpha); }
float wsG(float x, float c) { float y = sqrt(x); return x + 2.0 * c * y + 2.0 * c * c * log(y - c); }
float wsWake(float free, vec2 bc) {   // bc: the barrier's bleed β and deficit scale c (the runtime's blocking law)
  float beta = bc.x, c = bc.y;
  if (beta >= 1.0) return free;
  if (beta <= 0.0) return 0.0;
  float xc = pow(c / (1.0 - beta), 2.0);
  if (free <= xc / beta) return beta * free;
  float target = wsG(xc, c) + free - xc / beta, x = max(xc * 1.0001, target);
  for (int k = 0; k < 8; k++) x = max(xc * 1.0001, x - (wsG(x, c) - target) * (1.0 - c / sqrt(x)));
  return x;
}
float wsFall(float z0, float z) {
  float a1 = uAlpha + 1.0, k = uU10 / pow(10.0, uAlpha) / (a1 * uVt);
  if (z >= 0.5) return k * (pow(z0, a1) - pow(z, a1));
  return (z0 > 0.5 ? k * (pow(z0, a1) - pow(0.5, a1)) : 0.0) + wsU(0.5) * (min(z0, 0.5) - z) / uVt;
}
vec4 windScript(float i, float t) {
  vec3 r0 = uSrcMin + vec3(wsHash(i * 3.0 + 0.5), wsHash(i * 3.0 + 1.5), wsHash(i * 3.0 + 2.5)) * (uSrcMax - uSrcMin);
  float z0 = r0.z - uFloor, fall = z0 / uVt, cycle = fall + uRest;
  float age = mod(t + wsHash(i + 0.25) * cycle, cycle); bool falling = age < fall;
  float z = falling ? z0 - uVt * age : 0.0;
  float g = 0.0, a = min(age, fall);
  for (int k = 0; k < 3; k++) g += (sin(uPhases[k].x * t + uPhases[k].z) - sin(uPhases[k].x * (t - a) + uPhases[k].z)) / uPhases[k].x;
  float drift = wsFall(z0, z) + uGust * wsU((z0 + z) * 0.5) * g / 3.0;
  if (!falling) drift += max(0.0, wsU(0.5) - uSkitter) * (age - fall);
  vec2 across = vec2(-uDir.y, uDir.x);
  vec3 pos = vec3(r0.xy + uDir * drift, z + uFloor);
  float along0 = dot(r0.xy, uDir), freeA = along0 + drift, best = freeA, ps = dot(pos.xy, across);
  for (int k = 0; k < ${MAX_WAKES}; k++) {
    if (k >= uWakeN) break;
    vec4 w = uWakes[k];
    if (ps < w.y || ps > w.z || pos.z - uFloor >= w.w || freeA <= w.x) continue;
    best = min(best, w.x + wsWake(freeA - w.x, uWakeB[k]));
  }
  pos.xy += uDir * (best - freeA);
  vec2 span = uFieldMax - uFieldMin; pos.xy = uFieldMin + mod(pos.xy - uFieldMin, span);
  return vec4(pos, falling ? age * (3.0 + 4.0 * wsHash(i + 0.75)) : -1.0);
}
`;
