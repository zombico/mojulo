/**
 * THE RACER'S SMOOTH FINISH — the supercar's finish (vehicle-surface-finish.js) on a cartoon racer, its cartoon kept.
 *
 *   shadeRacerFaces(faces, { palette, motif, sun }) → faces with `fill`, `cornerFills`, `albedo`, `material`,
 *                                                     `outNormal`, `cornerNormals`
 *
 * Corner normals are averaged over the faces that share a corner in the same paint slot and lie within the motif's
 * crease angle, so a lofted shell grades and a chamfer stays a line. Each corner is lit by the racer's own toon light
 * (racer.js `lit`) with its shadow step softened to a band across n·L, and the underside's darkening the same; a lamp
 * is its colour, never shaded. `fill` is the face's own normal through the same light, for a renderer that reads one
 * colour a face. Faces arrive fanned (at most four corners) and rounded; nothing here rolls a die.
 */
import { VEHICLE_MATERIALS } from './vehicle-surface-finish.js';
import { bakeChannels } from '../polygonizer/surface-bake.js';

/** A slot's material: the supercar's rows, and cloth for the driver's suit. */
export const KART_MATERIALS = Object.freeze({
  ...VEHICLE_MATERIALS,
  cloth: Object.freeze({ metalness: 0, roughness: 0.82 }),
  // the gloss wheel's: the tread blocks rougher than the rubber they stand in, the rim's lip and boss polished chrome
  tread: Object.freeze({ metalness: 0, roughness: 0.97 }),
  chrome: Object.freeze({ metalness: 1, roughness: 0.1 }),
});
const MATERIAL_OF = Object.freeze({
  'tech:body': 'paint', 'tech:skin': 'paint', 'str:paint': 'paint', 'driver:helmet': 'paint',
  'tech:trim': 'alloy', 'tech:frame': 'carbon', 'tech:glass': 'glass', 'tech:light': 'lamp', 'lamp:brake': 'tail',
  'tech:cable': 'rubber', seat: 'seal', 'driver:suit': 'cloth', 'driver:glove': 'seal', 'lamp:rim': 'seal',
  'wheel:groove': 'tread', 'wheel:stripe': 'paint', 'wheel:lip': 'chrome', 'wheel:boss': 'chrome',
});
export const materialOfSlot = (slot) => MATERIAL_OF[slot] ?? 'paint';
const EMISSIVE = new Set(['tech:light', 'lamp:brake']);

/** A lamp's rim: the supercar's slim headlight kept a dark perimeter so its signature read against bright paint. */
export const LAMP_RIM = '#1d2026';
const area = (c) => { let s = [0, 0, 0]; for (let i = 1; i + 1 < c.length; i++) { const u = c[i].map((x, k) => x - c[0][k]), w = c[i + 1].map((x, k) => x - c[0][k]); s = [s[0] + u[1] * w[2] - u[2] * w[1], s[1] + u[2] * w[0] - u[0] * w[2], s[2] + u[0] * w[1] - u[1] * w[0]]; } return Math.hypot(...s) / 2; };
/** One part's faces, its lamps rimmed: a lit face turned more than 45° from the part's lens (the lit face that most
 *  faces out from `centre`, the machine's middle, by its area) takes the `lamp:rim` slot. A part with no lamp is
 *  returned as it came. */
export function rimLamps(faces, centre = [0, 0, 0]) {
  const lit = faces.filter((f) => EMISSIVE.has(f.slot ?? f.group));
  if (!lit.length) return faces;
  const out = (f) => { const c = f.corners.reduce((s, p) => s.map((x, k) => x + p[k] / f.corners.length), [0, 0, 0]); return area(f.corners) * dot(newell(f.corners), unit(c.map((x, k) => x - centre[k]))); };
  const lens = newell(lit.reduce((a, f) => (out(f) > out(a) + 1e-12 ? f : a)).corners);
  return faces.map((f) => (EMISSIVE.has(f.slot ?? f.group) && dot(newell(f.corners), lens) < Math.SQRT1_2 ? { ...f, slot: 'lamp:rim' } : f));
}

/** The angle (degrees) past which two faces keep their edge, by the body's motif (ROUND_OF's reading of it). */
export const CREASE = Object.freeze({ smooth: 60, organic: 70, ornate: 50, riveted: 30, spiked: 30, faceted: 25 });
/** Half the width of the light's shadow step across n·L (the cel light steps at 0.15). */
export const BAND = 0.12;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const step = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => `#${c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
function newell(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  return unit(n);
}

/** The racer's toon light at a normal, its two steps eased: the cel light's lit and shadow colours, blended. */
function toon(base, value, n, sun) {
  const v = 1 + (value - 0.6) * 0.35, lam = dot(n, sun), t = step(0.15 - BAND, 0.15 + BAND, lam);
  const lit = base.map((x) => x * v * (1 + 0.06 * n[2])), dark = base.map((x, i) => x * v * 0.68 + [6, 10, 22][i]);
  const under = 1 - 0.4 * step(-0.35, -0.65, n[2]);
  return rgbHex(lit.map((x, i) => (dark[i] + (x - dark[i]) * t) * under));
}

export function shadeRacerFaces(faces, { palette, motif, sun }) {
  const slots = faces.map((f) => f.slot ?? f.group), normals = faces.map((f) => newell(f.corners));
  const crease = Math.cos(((CREASE[motif] ?? 45) * Math.PI) / 180), shared = new Map();
  const key = (i, p) => `${slots[i]}:${p.join(',')}`;
  faces.forEach((f, i) => { for (const p of f.corners) { const k = key(i, p); if (!shared.has(k)) shared.set(k, []); shared.get(k).push(i); } });
  return faces.map((f, i) => {
    const slot = slots[i], albedo = palette[slot] ?? palette['tech:body'], base = hexRgb(albedo), value = f.value ?? 0.6;
    const cornerNormals = f.corners.map((p) => {
      const near = shared.get(key(i, p)).filter((j) => dot(normals[i], normals[j]) > crease);
      return unit(near.reduce((s, j) => s.map((x, k) => x + normals[j][k]), [0, 0, 0]));
    });
    const out = { corners: f.corners, albedo, material: materialOfSlot(slot), outNormal: normals[i].map(r4), cornerNormals: cornerNormals.map((n) => n.map(r4)) };
    if (EMISSIVE.has(slot)) { const c = rgbHex(base.map((x) => x * (1 + (value - 0.6) * 0.35))); return { ...out, fill: c, cornerFills: f.corners.map(() => c) }; }
    return { ...out, fill: toon(base, value, normals[i], sun), cornerFills: cornerNormals.map((n) => toon(base, value, n, sun)) };
  });
}

/** A smooth-shaded solved racer as the vehicle review page's input (vehicle-review.js `emitVehicleReview`). */
export function racerReviewInput(S) {
  const faces = { root: S.faces.root, wheels: S.faces.wheels.flatMap((w) => w.faces), bones: S.faces.bones.flatMap((b) => b.faces) };
  if (!faces.root.every((f) => f.material && f.albedo)) throw new Error('car-designer: a racer opens in the review solved with shade: \'smooth\'');
  return { faces, materials: KART_MATERIALS, census: S.census };
}

/**
 * THE GLOSS WHEEL'S PAINTED LIGHT — the character bake stack's cheats (polygonizer/surface-bake.js, the sixth
 * generation's painted light) on a wheel, as decoration: its corners darkened by occlusion (the tyre's bead in the rim,
 * the dish under its lip, the spokes' roots) and lifted at an edge (the lip's rim, a tread block's shoulder). Only the
 * channels a turning wheel keeps: a sky band, a height or a rise would turn with it. The baked fills take it (the paint
 * render) and so does each corner's albedo (`cornerAlbedo`: the form render paints the decoration and lights the rest).
 *   bakeWheel(faces) → the faces, each with its corners' fills and albedo so painted
 */
const WHEEL_BAKE = Object.freeze({ occlusion: 0.6, edge: 0.32, chromeEdge: 0.55 });
export function bakeWheel(faces) {
  if (!faces.length) return faces;
  const vertices = [], provenance = [], tris = [], corner = [];
  faces.forEach((f, fi) => {
    const base = vertices.length;
    f.corners.forEach((p, j) => { vertices.push(p); provenance.push({ part: f.material }); corner.push([fi, j]); });
    for (let j = 1; j + 1 < f.corners.length; j++) tris.push([base, base + j, base + j + 1]);
  });
  const ch = bakeChannels({ vertices, faces: tris, provenance });
  const out = faces.map((f) => ({ ...f, cornerFills: [...(f.cornerFills ?? f.corners.map(() => f.fill))], cornerAlbedo: f.corners.map(() => f.albedo) }));
  corner.forEach(([fi, j], vi) => {
    const f = out[fi];
    if (EMISSIVE_MATERIALS.has(f.material)) return;
    const k = (1 - WHEEL_BAKE.occlusion * ch.occlusion[vi]) * (1 + (f.material === 'chrome' ? WHEEL_BAKE.chromeEdge : WHEEL_BAKE.edge) * ch.edge[vi]);
    const scale = (h) => rgbHex(hexRgb(h).map((x) => x * k));
    f.cornerFills[j] = scale(f.cornerFills[j]);
    f.cornerAlbedo[j] = scale(f.cornerAlbedo[j]);
  });
  return out;
}
const EMISSIVE_MATERIALS = new Set(['lamp', 'tail']);
