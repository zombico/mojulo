/**
 * rupa/wind-solver.js — the wind's depiction solved for a whole scene: each element is read by its physics and handed
 * the script that shows it, grouped into batches a GPU draws in one call each. Nothing is one-lined by hand. rupa is the
 * internal name.
 *
 * THE DECISION, element by element (each with its reason in numbers):
 *   DRIFT     a free thing light enough that the air carries it: its drag catches it up with the air in τ = v_t/g; under
 *             half a second it moves at the wind and its path is the closed form in wind-script.js (leaves, litter,
 *             petals, ash, snow)
 *   BEND      a thing fixed at its foot that flexes (grass, reeds, a sapling, a signpost): the wind's pressure q = ½ρu²
 *             loads it as a cantilever, along its length (w = q·Cd·width) and at its crown (F = q·Cd·A), so its tip goes
 *             δ = wL⁴/8EI + FL³/3EI along the beam's own curve, and it sways at its first mode,
 *             f = (1/2π)·√(3EI/L³ ÷ (0.24·m_beam + m_crown)). A rigid thing whose base the strongest gust stresses past
 *             its strength (σ = M/S) SNAPS and goes to the physics; a blade lies down instead (it streamlines)
 *   HANG      a thing that hangs (a flag, a banner, a lantern, a hanging sign): it leans until the drag balances its
 *             weight, θ = atan(q·Cd·A ÷ m·g), and swings as a pendulum, f = (1/2π)·√(g/L)
 *   STILL     the wind can't move it: a free thing whose drag under the strongest gust, on the face the wind meets, stays
 *             below what friction holds (½ρ·Cd·A·u² < μ·m·g), or a bending or hanging thing it would move under half a degree
 *   SIMULATE  too heavy to follow the wind, yet moved by it, or snapped by it: the runtime's bodies and wind load
 * The strongest gust is the wind at the element's height times (1 + gust). The wind is the runtime's (windOf, windAt),
 * so a scripted grass blade and a simulated crate feel the same air.
 *
 *   solveWind(elements, windSpec, { wakes?, field?, floor? }) → { batches, simulate, still, reasons }
 *     wakes: the scene's barriers [{ min, max, porosity? }]: they shelter every script alike
 *     an element: { id, kind, place: { min, max }, count?, height? } — kind a preset (KINDS), a species (vegetation/species.js:
 *                 a plant by PLANT_FORMS at its height, else its range's middle) or { script, ... } its own numbers
 *     a batch:    { script: 'drift' | 'bend' | 'hang', kind, ids, count, script numbers, instances?, shelter? }
 *                 shelter: each instance's share of the wind behind the scene's barriers (the runtime's blocking law)
 *   bendAt(batch, i, t) → { angle, sway } · hangAt(batch, i, t) → { angle } · instanceOf(batch, i) → [x, y, z]
 *   PLANT_FORMS, plantKind(kind | species | leaf form, height), plantOfLeaf(form), breakSpeed(kind) → the wind at its
 *   crown that snaps it
 *   BEND_GLSL, HANG_GLSL: the same formulas for the GPU (drift's is wind-script.js GLSL)
 */
import { rupaPhysics } from './index.js';
import { MATTER } from './matter.js';
import { scriptOf, fallSpeed } from './wind-script.js';
import { SPECIES } from '../vegetation/species.js';
import { LEAF_FORMS } from '../era/leaf-forms.js';

const G = 9.81, MU = 0.5, TAU_MAX = 0.5, STILL_DEG = 0.5;
const rad = (deg) => (deg * Math.PI) / 180;

/** What each kind is, in the numbers its script needs. A new kind is a row. */
export const KINDS = Object.freeze({
  // drift: a free thing (size [x, y, z] m, mass kg)
  leaf: { script: 'drift', size: [0.06, 0.04, 0.002], mass: 0.06 * 0.04 * 0.0003 * 600 },
  petal: { script: 'drift', size: [0.02, 0.015, 0.001], mass: 0.02 * 0.015 * 0.0002 * 500 },
  litter: { script: 'drift', size: [0.21, 0.297, 0.002], mass: 0.21 * 0.297 * 80e-3 },
  ash: { script: 'drift', size: [0.01, 0.01, 0.002], mass: 0.01 * 0.01 * 0.0002 * 300 },
  snow: { script: 'drift', size: [0.005, 0.005, 0.001], mass: 3e-6 },
  brick: { script: 'drift', size: [0.215, 0.1025, 0.065], mass: 0.215 * 0.1025 * 0.065 * 1900 },   // lying loose: still
  crate: { script: 'drift', size: [0.6, 0.6, 0.6], mass: 0.6 * 0.6 * 0.6 * 350 * 0.05 },          // a hollow one
  // bend: fixed at the foot. form 'blade' (width × thick) or 'pole' (diameter), its matter's E and strength, a crown
  grass: { script: 'bend', form: 'blade', length: 0.3, width: 0.005, thick: 0.001, E: 1e9, density: 600 },
  reed: { script: 'bend', form: 'blade', length: 1.5, width: 0.01, thick: 0.003, E: 5e9, density: 500 },
  sapling: { script: 'bend', form: 'pole', length: 3, diameter: 0.05, matter: 'pine', crown: { area: 2, cd: 0.5, mass: 15 } },
  signpost: { script: 'bend', form: 'pole', length: 2.5, diameter: 0.06, matter: 'steel', crown: { area: 0.5, cd: 1.2, mass: 8 } },
  // hang: from a point (length to its centre of mass, area facing the wind, mass, drag coefficient)
  flag: { script: 'hang', length: 0.75, area: 1.5, mass: 0.3, cd: 0.6 },
  banner: { script: 'hang', length: 1, area: 3, mass: 1.2, cd: 0.8 },
  lantern: { script: 'hang', length: 0.4, area: 0.07, mass: 0.5, cd: 0.5 },
  sign: { script: 'hang', length: 0.35, area: 0.4, mass: 6, cd: 1.2 },
});

/**
 * PLANTS as the solver reads them (a species' kind, vegetation/species.js, at its height): a pole fixed at its foot by
 * GEOMETRIC SIMILARITY, its trunk a fixed share of its height (`slender`: height over diameter) and its crown's frontal
 * area a fixed share of its height squared (`crown`, its drag `cd` after its leaves streamline), the crown's drag at the
 * top. Its base stress then grows as u² and its section and lever together as H³, so the wind that snaps it is the same
 * at every size: with green wood's strength (`mor`) and these shares about 39 m/s at its crown, as storms break trees of
 * every size near 42 m/s (Virot et al. 2016). A conifer's dense crown catches more and its wood is weaker: it goes
 * sooner (about 31 m/s), as it does in storms. A palm's fronds stream out (a small, low-drag crown on a slender trunk:
 * about a broadleaf's 40 m/s). A culm is hollow (`hollow`: its bore over its diameter), stiffer and stronger than wood,
 * on a much slenderer stem: it bends far and goes near 32 m/s.
 */
export const PLANT_FORMS = Object.freeze({
  tree: { slender: 40, crown: 0.15, cd: 0.4, E: 9e9, mor: 45e6, density: 750, crownMass: 0.02 },
  conifer: { slender: 45, crown: 0.12, cd: 0.5, E: 9e9, mor: 40e6, density: 700, crownMass: 0.025 },
  palm: { slender: 60, crown: 0.03, cd: 0.3, E: 6e9, mor: 40e6, density: 600, crownMass: 0.03 },
  culm: { slender: 90, hollow: 0.8, crown: 0.03, cd: 0.3, E: 15e9, mor: 120e6, density: 700, crownMass: 0.002 },
});
/** The plant form of a geocube's tree (its biocube's leaf form, era/leaf-forms.js): an evergreen cone of tiers is a
 *  conifer, every other crown a broadleaf's. */
export const plantOfLeaf = (form) => (LEAF_FORMS[form] ? (LEAF_FORMS[form].evergreen ? 'conifer' : 'tree') : null);
/** A plant of `kind` (a PLANT_FORMS row, a species' name, or a biocube leaf form) `height` metres tall, as a bend kind. */
export function plantKind(kind, height) {
  const f = PLANT_FORMS[kind] ?? PLANT_FORMS[SPECIES[kind]?.kind] ?? PLANT_FORMS[plantOfLeaf(kind)];
  if (!f) throw new Error(`windSolver: a plant is ${Object.keys(PLANT_FORMS).join(', ')} or a species (${Object.keys(SPECIES).filter((s) => PLANT_FORMS[SPECIES[s].kind]).join(', ')})`);
  if (!(height > 0)) throw new Error('windSolver: a plant\'s height is metres above 0');
  const area = f.crown * height * height;
  return { script: 'bend', form: 'pole', plant: true, length: height, diameter: height / f.slender, ...(f.hollow ? { hollow: f.hollow } : {}), E: f.E, density: f.density, strength: f.mor,
    crown: { area, cd: f.cd, mass: f.crownMass * area * height } };
}
/** The wind at its crown that snaps a plant (or any pole kind): its foot's stress at its strength, σ = M/S. */
export function breakSpeed(k) {
  const b = beam(k);
  return b.strength ? Math.sqrt((b.strength * b.S) / b.moment) : Infinity;
}

const frac = (x) => x - Math.floor(x);
const hash = (n) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// the wind at a height, as the runtime's windAt has it, and its strongest gust there
const windSpeed = (w, pos, t) => (w ? Math.hypot(...rupaPhysics.windAt(w, pos, t)) : 0);
const strongest = (w, z) => (w ? w.speed * Math.pow(Math.max(0.5, z) / 10, w.alpha) * (1 + w.gust) : 0);

function kindOf(el) {
  // a species by name, at the element's height (else the middle of its range)
  if (typeof el.kind === 'string' && !KINDS[el.kind] && SPECIES[el.kind] && PLANT_FORMS[SPECIES[el.kind].kind]) {
    const h = el.height ?? (SPECIES[el.kind].heights[0] + SPECIES[el.kind].heights[1]) / 2;
    return plantKind(el.kind, h);
  }
  const k = typeof el.kind === 'string' ? KINDS[el.kind] : el.kind;
  if (!k || !['drift', 'bend', 'hang'].includes(k.script)) throw new Error(`windSolver: ${el.id}'s kind is one of ${Object.keys(KINDS).join(', ')} or { script: drift | bend | hang, … }`);
  return k;
}

// a cantilever's numbers: stiffness, the load it takes per (wind speed)², its base moment per u², its first mode
function beam(k) {
  const m = k.matter ? MATTER[k.matter] : null, E = k.E ?? m.E, density = k.density ?? m.density, L = k.length;
  // (a hollow pole, a culm: its bore `hollow` × its diameter; its wall all that bends and all that weighs)
  const pole = k.form === 'pole', bore = pole && k.hollow ? 1 - k.hollow ** 4 : 1, I = pole ? (Math.PI * k.diameter ** 4 * bore) / 64 : (k.width * k.thick ** 3) / 12;
  const S = pole ? (Math.PI * k.diameter ** 3 * bore) / 32 : (k.width * k.thick ** 2) / 6, wide = pole ? k.diameter : k.width;
  const halfRho = 0.5 * rupaPhysics.AIR.density, cw = halfRho * 1.2 * wide, cf = k.crown ? halfRho * k.crown.cd * k.crown.area : 0;
  const dU = (cw * L ** 4) / (8 * E * I), dF = (cf * L ** 3) / (3 * E * I);                 // tip deflection per u², each load
  const moment = (cw * L * L) / 2 + cf * L;                                                    // base moment per u²
  const mBeam = density * L * (pole ? (Math.PI * k.diameter ** 2 * (k.hollow ? 1 - k.hollow ** 2 : 1)) / 4 : k.width * k.thick), mTip = k.crown?.mass ?? 0;
  const freq = Math.sqrt((3 * E * I) / L ** 3 / (0.2427 * mBeam + mTip)) / (2 * Math.PI);
  const strength = k.strength ?? (m ? (m.tensile || m.compressive) : null);
  return { L, deflect: dU + dF, tipShare: dU + dF > 0 ? dF / (dU + dF) : 0, moment, S, freq, strength, blade: !pole };
}

export function solveWind(elements, windSpec, { wakes = [], field = null, floor = 0 } = {}) {
  const w = rupaPhysics.windOf(windSpec);
  const batches = [], simulate = [], still = [], reasons = {};
  // what shelters each instance: the wind left where it stands, behind the barriers, by the runtime's blocking law
  const shelterAt = (p, z) => {
    if (!w) return 1;
    const d = w.dir, across = [-d[1], d[0]], pa = p[0] * d[0] + p[1] * d[1], ps = p[0] * across[0] + p[1] * across[1];
    let f = 1;
    for (const b of wakes) {
      if (z >= b.max[2] - floor) continue;
      const cs = [[b.min[0], b.min[1]], [b.max[0], b.min[1]], [b.min[0], b.max[1]], [b.max[0], b.max[1]]];
      const al = cs.map((c) => c[0] * d[0] + c[1] * d[1]), si = cs.map((c) => c[0] * across[0] + c[1] * across[1]);
      if (ps < Math.min(...si) || ps > Math.max(...si)) continue;
      f = Math.min(f, rupaPhysics.wakeFactor(pa - Math.max(...al), b.max[2] - floor, b.porosity ?? 0));
    }
    return f;
  };
  const instancesOf = (el, n) => Array.from({ length: n }, (_, i) => [0, 1, 2].map((a) => el.place.min[a] + hash(i * 3 + a + 0.5 + (el.seed ?? 0) * 101) * (el.place.max[a] - el.place.min[a])));
  for (const el of elements) {
    if (!el || typeof el.id !== 'string' || !el.place) throw new Error('windSolver: each element is { id, kind, place: { min, max }, count? }');
    const k = kindOf(el), count = el.count ?? 1, top = el.place.max[2];
    if (k.script === 'drift') {
      const vt = fallSpeed(k), tau = vt / G, ug = strongest(w, Math.max(0.5, el.place.min[2] - floor));
      // what holds it on the ground against a wind along it: friction μ·m·g against the drag on the face the wind meets
      // (a tumbling plate's quarter-surface; a brick's narrow side), as the runtime's wind on resting bodies has it
      const side = rupaPhysics.dragArea({ min: [0, 0, 0], max: k.size }, [1, 0, 0]), holds = Math.sqrt((2 * MU * k.mass * G) / (rupaPhysics.AIR.density * 1.05 * side));
      if (tau < TAU_MAX) {
        reasons[el.id] = `drift: it catches up with the air in ${tau.toFixed(2)} s (falling ${vt.toFixed(1)} m/s), so it moves at the wind`;
        batches.push({ script: 'drift', kind: typeof el.kind === 'string' ? el.kind : 'custom', ids: [el.id], count, ...scriptOf(windSpec, { kind: k, source: el.place, wakes, field, floor }) });
      } else if (ug > holds) {
        reasons[el.id] = `simulate: too heavy to follow the air (${tau.toFixed(1)} s to catch up), yet the strongest gust here (${ug.toFixed(1)} m/s) beats what holds it (${holds.toFixed(1)} m/s)`;
        simulate.push(el.id);
      } else {
        reasons[el.id] = `still: the strongest gust here (${ug.toFixed(1)} m/s) is under what holds it (${holds.toFixed(1)} m/s)`;
        still.push(el.id);
      }
      continue;
    }
    if (k.script === 'bend') {
      // (a plant feels the wind at its crown: its foot's height and its own)
      const b = beam(k), ug = strongest(w, k.plant ? el.place.min[2] - floor + b.L : top), angle = Math.atan((b.deflect * ug * ug) / b.L), sigma = b.moment * ug * ug / b.S;
      if (!b.blade && b.strength && sigma > b.strength) {
        reasons[el.id] = `simulate: the strongest gust (${ug.toFixed(1)} m/s) stresses its foot to ${(sigma / 1e6).toFixed(0)} MPa, past its ${(b.strength / 1e6).toFixed(0)}: it snaps`;
        simulate.push(el.id); continue;
      }
      if (angle < rad(STILL_DEG)) { reasons[el.id] = `still: the strongest gust bends it ${(angle * 180 / Math.PI).toFixed(2)}°`; still.push(el.id); continue; }
      reasons[el.id] = `bend: the strongest gust bends it ${Math.min(80, angle * 180 / Math.PI).toFixed(0)}°${b.blade && sigma > 3e7 ? ' (it lies down rather than breaks)' : ''}, swaying at ${b.freq.toFixed(1)} Hz`;
      const ins = instancesOf(el, count);
      batches.push({ script: 'bend', kind: typeof el.kind === 'string' ? el.kind : 'custom', ids: [el.id], count, wind: w, length: b.L, deflect: b.deflect, tipShare: b.tipShare, freq: b.freq, instances: ins, shelter: ins.map((p) => shelterAt(p, p[2] - floor + b.L)) });
      continue;
    }
    // hang
    const ug = strongest(w, top), K = (0.5 * rupaPhysics.AIR.density * k.cd * k.area) / (k.mass * G), angle = Math.atan(K * ug * ug), freq = Math.sqrt(G / k.length) / (2 * Math.PI);
    if (angle < rad(1)) { reasons[el.id] = `still: the strongest gust leans it ${(angle * 180 / Math.PI).toFixed(2)}°`; still.push(el.id); continue; }
    reasons[el.id] = `hang: the strongest gust leans it ${(angle * 180 / Math.PI).toFixed(0)}° (drag ${(K * ug * ug * k.mass * G).toFixed(0)} N against ${(k.mass * G).toFixed(0)} N of weight), swinging at ${freq.toFixed(2)} Hz`;
    const ins = instancesOf(el, count);
    batches.push({ script: 'hang', kind: typeof el.kind === 'string' ? el.kind : 'custom', ids: [el.id], count, wind: w, lean: K, length: k.length, freq, instances: ins, shelter: ins.map((p) => shelterAt(p, p[2] - floor)) });
  }
  // one batch per kind and script for bend and hang: their instances join (drift batches keep their own release regions)
  const merged = [];
  for (const b of batches) {
    const same = b.script !== 'drift' && merged.find((m) => m.script === b.script && m.kind === b.kind && m.kind !== 'custom');
    if (same) { same.ids.push(...b.ids); same.count += b.count; same.instances.push(...b.instances); same.shelter.push(...b.shelter); } else merged.push(b);
  }
  return { batches: merged, simulate, still, reasons };
}

export const instanceOf = (batch, i) => batch.instances[i % batch.instances.length];

// the cantilever's curve, its tip 1: a uniform load's and a tip load's, blended by how much of the bend each makes
export function bendShape(s, tipShare) {
  const uniform = (s * s * (6 - 4 * s + s * s)) / 3, tip = (s * s * (3 - s)) / 2;
  return (1 - tipShare) * uniform + tipShare * tip;
}

export function bendAt(batch, i, t) {
  const p = instanceOf(batch, i), top = [p[0], p[1], p[2] + batch.length], u = windSpeed(batch.wind, top, t) * (batch.shelter ? batch.shelter[i % batch.shelter.length] : 1);
  const angle = Math.min(1.4, Math.atan((batch.deflect * u * u) / batch.length));
  const sway = 0.12 * angle * Math.sin(2 * Math.PI * batch.freq * t + hash(i + 0.37) * 6.283);
  return { angle: angle + sway, sway };
}

export function hangAt(batch, i, t) {
  const p = instanceOf(batch, i), u = windSpeed(batch.wind, p, t) * (batch.shelter ? batch.shelter[i % batch.shelter.length] : 1), lean = Math.atan(batch.lean * u * u);
  return { angle: lean + 0.15 * lean * Math.sin(2 * Math.PI * batch.freq * t + hash(i + 0.61) * 6.283) };
}

/** The shared wind on the GPU, the runtime's windAt: a power-law rise and three travelling gust waves. */
const WIND_GLSL = `
uniform float uW10, uWAlpha, uWGust; uniform vec2 uWDir; uniform vec3 uWPhases[3];
float windSpeedAt(vec3 p, float t) {
  float base = uW10 * pow(max(0.5, p.z) / 10.0, uWAlpha), x = dot(p.xy, uWDir), g = 0.0;
  for (int k = 0; k < 3; k++) g += sin(uWPhases[k].x * t - uWPhases[k].y * x + uWPhases[k].z) / 3.0;
  return max(0.0, base * (1.0 + uWGust * g));
}
float wsHash2(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
`;
/** Bend: a vertex at height z (0 at the foot, uLength at the tip) of instance i, anchored at `anchor`, moved along the beam's curve. */
export const BEND_GLSL = WIND_GLSL + `
uniform float uLength, uDeflect, uTipShare, uFreq;
vec3 windBend(vec3 local, vec3 anchor, float i, float t, float shelter) {
  float u = windSpeedAt(anchor + vec3(0.0, 0.0, uLength), t) * shelter;
  float a = min(1.4, atan(uDeflect * u * u / uLength));
  a += 0.12 * a * sin(6.2831853 * uFreq * t + wsHash2(i + 0.37) * 6.283);
  float s = clamp(local.z / uLength, 0.0, 1.0);
  float shape = (1.0 - uTipShare) * s * s * (6.0 - 4.0 * s + s * s) / 3.0 + uTipShare * s * s * (3.0 - s) / 2.0;
  vec3 p = local; p.xy += uWDir * uLength * sin(a) * shape; p.z -= uLength * (1.0 - cos(a)) * shape;
  return anchor + p;
}
`;
/** Hang: a vertex of instance i hanging from `pivot` (local z ≤ 0), leaned downwind about the pivot. */
export const HANG_GLSL = WIND_GLSL + `
uniform float uLean, uFreq;
vec3 windHang(vec3 local, vec3 pivot, float i, float t, float shelter) {
  float u = windSpeedAt(pivot, t) * shelter, a = atan(uLean * u * u);
  a += 0.15 * a * sin(6.2831853 * uFreq * t + wsHash2(i + 0.61) * 6.283);
  float along = dot(local.xy, uWDir); vec2 side = local.xy - uWDir * along;
  // turned about the pivot in the wind's vertical plane: a point hanging at (0, −L) goes to (L·sin a, −L·cos a), downwind
  float a2 = along * cos(a) - local.z * sin(a), z2 = along * sin(a) + local.z * cos(a);
  return pivot + vec3(side + uWDir * a2, z2);
}
`;

/** A batch's uniforms for its shader, wind first. */
export function batchUniforms(batch) {
  const w = batch.wind || { speed: 0, alpha: 0.14, gust: 0, dir: [1, 0], phases: [{ w: 1, k: 0, p: 0 }, { w: 1, k: 0, p: 0 }, { w: 1, k: 0, p: 0 }] };
  const wind = { uW10: w.speed, uWAlpha: w.alpha, uWGust: w.gust, uWDir: w.dir, uWPhases: w.phases.map((p) => [p.w, p.k, p.p]) };
  if (batch.script === 'bend') return { ...wind, uLength: batch.length, uDeflect: batch.deflect, uTipShare: batch.tipShare, uFreq: batch.freq };
  if (batch.script === 'hang') return { ...wind, uLean: batch.lean, uFreq: batch.freq };
  return null;   // drift: wind-script.js scriptUniforms
}
