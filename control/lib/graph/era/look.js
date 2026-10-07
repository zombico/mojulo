/**
 * LOOK — a sixth-gen look as a setting any world can carry (`look: 'gothic-night' | { id, cell? }` on the manifest).
 * The look-layer laws (laws.js) leave the stage kind here:
 *
 *  - baked-light      the world resolves unshaded (raw albedo) and its light is baked into the vertices by the
 *                     stage's own bake (bakeStageLight): the look's ambient, its sun with cast shadows and ground bounce;
 *  - vertex-density   a large face is first split into cells, so the light has corners to land on;
 *  - shade-is-colour  the shade is the look's ambient, a colour, never black;
 *  - depth-by-air     the look's fog becomes the page haze and background;
 *  - sky-is-a-place   the look's dome becomes the page sky.
 *
 * Only a kind that resolves to true raw albedo can be re-baked (world-scene.js UNSHADED_LAMBERT_KINDS); any other
 * kind takes the air and sky only, and the payload says so (`lookNote`), never silently. The value order, palette and
 * the surface laws are later phases. Deterministic: a pure function of the payload and the look.
 */
import { SIXTH_GEN_REFERENCES, SIXTH_GEN_LOOK_IDS, resolveLook } from './sixth-gen.js';
import { bakeStageLight, torchFaces, STAGE_KITS } from './stage.js';
import { makeSunShadow, sunDir } from './sun.js';
import { hexRgb, rgbHex, r5 } from './geom.js';

/** The cell a lit face is split to (metres), and the most faces a look may leave a world with. */
export const LOOK_CELL = 2;
export const LOOK_MAX_FACES = 120000;
// the daylight rig a look bakes with outside a kit: the plaza's sky (a fill share of the ambient, warm ground bounce)
const DAY_SKY = Object.freeze({ fill: 0.55, bounce: [0.95, 0.82, 0.62], bounceGain: 0.22, sunGain: 1.05 });

/** The manifest's `look` → `{ id, refId, ref, cell }`, or null when absent. An unknown look throws with the list. */
export function resolveLookSpec(look) {
  if (look == null || look === false) return null;
  const o = typeof look === 'string' ? { id: look } : look;
  if (!o || typeof o.id !== 'string') throw new Error(`look: give a look id (known: ${SIXTH_GEN_LOOK_IDS.join(', ')})`);
  const refId = resolveLook(o.id);
  if (!refId) throw new Error(`look: unknown look '${o.id}' (known: ${SIXTH_GEN_LOOK_IDS.join(', ')})`);
  const cell = o.cell == null ? LOOK_CELL : Number(o.cell);
  if (!(cell >= 0.5 && cell <= 16)) throw new Error('look: cell must be between 0.5 and 16 metres');
  return { id: o.id, refId, ref: SIXTH_GEN_REFERENCES[refId], cell };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** A face's unit normal by Newell's method (a face that carries one keeps it). */
function normalOf(f) {
  if (Array.isArray(f.normal) && f.normal.length === 3) return f.normal;
  const n = [0, 0, 0], c = f.corners;
  for (let i = 0; i < c.length; i++) {
    const p = c[i], q = c[(i + 1) % c.length];
    n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]);
  }
  const l = Math.hypot(...n) || 1;
  return n.map((v) => v / l);
}

// a face the bake can light: a solid colour on three or more corners; glows, cards, page overlays and emissives keep theirs
const bakeable = (f) => Array.isArray(f.corners) && f.corners.length >= 3 && typeof f.fill === 'string' && /^#[0-9a-f]{6}$/i.test(f.fill)
  && !f.emissive && !f.glow && !f.html && !f.card && !f.lit && !f.cornerFills;

/** A quad cut into nu × nv cells, its uv (when it has one) interpolated with it. */
function splitQuad(f, nu, nv) {
  const [a, b, c, d] = f.corners, lerp = (p, q, t) => p.map((v, k) => v + (q[k] - v) * t), out = [];
  const at = (s, t) => lerp(lerp(a, b, s), lerp(d, c, s), t).map(r5);
  const uv = f.uv ? (s, t) => lerp(lerp(f.uv[0], f.uv[1], s), lerp(f.uv[3], f.uv[2], s), t).map(r5) : null;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const s0 = i / nu, s1 = (i + 1) / nu, t0 = j / nv, t1 = (j + 1) / nv;
    out.push({ ...f, corners: [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)], ...(uv ? { uv: [uv(s0, t0), uv(s1, t0), uv(s1, t1), uv(s0, t1)] } : {}) });
  }
  return out;
}

const cutsOf = (f, cell) => {
  const [a, b, , d] = f.corners, len = (p, q) => Math.hypot(...sub(p, q));
  return [Math.max(1, Math.ceil(len(a, b) / cell)), Math.max(1, Math.ceil(len(a, d) / cell))];
};

/** Every bakeable face split to the cell, the cell grown (deterministically) until the world stays under the face cap. */
export function densify(faces, cell, max = LOOK_MAX_FACES) {
  let c = cell;
  for (;;) {
    const total = faces.reduce((s, f) => s + (bakeable(f) && f.corners.length === 4 ? cutsOf(f, c)[0] * cutsOf(f, c)[1] : 1), 0);
    if (total <= max || c >= 64) break;
    c *= 1.5;
  }
  return { cell: r5(c), faces: faces.flatMap((f) => (bakeable(f) && f.corners.length === 4 ? splitQuad(f, ...cutsOf(f, c)) : [f])) };
}

// a world's own point lights (an unshaded resolve hands them over, e.g. the dungeon's torches) baked at the stage's torch
const TORCH = STAGE_KITS['gothic-stone'].torch;
const placedLights = (payload) => (Array.isArray(payload.lights) ? payload.lights : []).filter((l) => l.type === 'point' && Array.isArray(l.position))
  .map((l) => ({ at: l.position.map(r5), n: [1, 0], color: Array.isArray(l.color) ? rgbHex(l.color) : TORCH.color, intensity: TORCH.intensity, radius: TORCH.radius, fixture: 'torch' }));

/** Apply a resolved look to a world payload. `bake`: the payload carries raw albedo and may be re-lit. */
export function applyLook(payload, spec, { bake }) {
  const R = spec.ref, air = R.air;
  // an interior (the kind declares it) keeps the sun out and its dark behind, whatever the look's sky
  const interior = payload.sky && payload.sky.preset === 'interior';
  const key = interior ? null : R.light.key;
  const notes = [];
  if (bake && Array.isArray(payload.faces) && payload.faces.length) {
    const lights = placedLights(payload);
    if (!key && !lights.length) notes.push('this look has no sun and the world places no lights, so it bakes the ambient alone: place lights to light it');
    // the cell is metres; a world authored in other units (the city's storey is 3.66 m to the unit) says so
    const mpu = Number(payload.metersPerUnit) > 0 ? Number(payload.metersPerUnit) : 1;
    const { cell: cellUnits, faces } = densify(payload.faces, spec.cell / mpu);
    const cell = r5(cellUnits * mpu);
    const prepared = faces.map((f) => (bakeable(f) ? { ...f, normal: normalOf(f), tint: hexRgb(f.fill) } : f));
    const sun = key ? (() => {
      const dir = sunDir(key.elevation, key.azimuth ?? 225);
      return { dir, rgb: hexRgb(key.color), gain: DAY_SKY.sunGain, bounce: DAY_SKY.bounce, bounceGain: DAY_SKY.bounceGain,
        shadow: makeSunShadow(prepared.filter((f) => f.tint), dir) };
    })() : null;
    // daylight takes a fill share of the ambient; a look with no sun is lit by its ambient alone, lifted as the stage lifts it
    const ambient = sun ? hexRgb(R.light.ambient).map((v) => v * DAY_SKY.fill) : hexRgb(R.light.ambient).map((v) => Math.min(1, v * 1.7));
    // the lights' flames are drawn as the stage draws a torch's (an unshaded resolve dropped the kind's own)
    payload.faces = [...bakeStageLight(prepared, lights, ambient, undefined, sun), ...lights.flatMap((l) => torchFaces(l))];
    payload.look = { id: spec.id, cell, baked: true, lights: lights.length };
  } else {
    payload.look = { id: spec.id, baked: false };
    notes.push('this kind bakes its own light, so the look set its air and sky only; its light, value order and palette are not the look\'s');
  }
  if (notes.length) payload.lookNote = notes.join('; ');
  payload.haze = { color: air.fog.color, density: air.fog.density };
  payload.bg = key ? rgbHex(air.dome.horizon.map((v) => v / 255)) : air.fog.color;
  if (!interior) payload.sky = { zenith: air.dome.zenith, horizon: air.dome.horizon, day: key ? 1 : 0, stars: 0, seed: 1 };
  return payload;
}
