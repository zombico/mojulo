/**
 * THE ROAD LOFT IN THE FORM RENDER (era/eras.js gen-7: a surface carries its material and its form, and the renderer
 * lights it): the realistic pole's loft (realistic.js, over roads/fleet.js and roads/bodywork.js) named face by face and
 * smoothed, for vehicle-rig.js packFormMesh.
 *
 * The fleet's faces carry only their light baked under one sun. Their colour as asked and their outward normal are
 * read from the albedo recorder (roads/road-faces.js withAlbedo), which the compile turns on only for the form render.
 * The colour says what a face is, since the fleet draws each kind in its own (FLEET_TRIM, the lamps' smoked housing,
 * the hubs' styles):
 *
 *   paint      the body, the roof of a two-tone, a patched panel, the livery's stripe and number, a box or a trailer
 *   glass      every pane (the side glass, the screen, the rear glass, a bus's window band)
 *   rubber     the tyre
 *   alloy      the rim (any hub style) and the chrome (a semi's grille and its tanks)
 *   carbon     the black plastics a face shows (the grille, the intake, the cladding, the lamps' smoked housing)
 *   seal       what faces the road (the floor, the frame)
 *   lamp/tail  the head and tail lamps, lit by their own emissive
 *
 *   formFace(f, rec, { part?, hex? })    → the face as the form render reads it: { corners, fill, part, material, albedo,
 *                                          outNormal }
 *   roadPart(hex, n, where)              → { part, material } for a recorded colour (where: 'trim' | 'wheel')
 *   smoothForm(faces, { crease? })       → the faces with crease-aware corner normals: coincident corners of one
 *                                          material whose faces turn less than the crease share a normal (a face with
 *                                          no area left out: it has no normal to light)
 *   bakeForm(faces)                      → the faces baked for the studio grid (its light in each corner, polygons fanned)
 *   ROAD_MATERIALS                        the slots' response (vehicle-surface-finish.js, a road car's paint a touch
 *                                          less glassy than a supercar's)
 *
 * Pure.
 */
import { FLEET_TRIM as T } from '../roads/fleet.js';
import { SMOKE } from '../roads/bodywork.js';
import { VEHICLE_MATERIALS } from './vehicle-surface-finish.js';

export const ROAD_MATERIALS = Object.freeze({
  ...VEHICLE_MATERIALS,
  paint: Object.freeze({ metalness: 0.18, roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.16 }),
  // (a patched panel's primer: no clearcoat, no sheen; a number plate's painted card)
  primer: Object.freeze({ metalness: 0, roughness: 0.82 }),
  plate: Object.freeze({ metalness: 0.05, roughness: 0.55 }),
  // (a bus's destination sign and a truck's marker lamps: amber, lit by their own)
  sign: Object.freeze({ metalness: 0, roughness: 0.3, emissive: '#ffa62b', emissiveIntensity: 0.9 }),
  marker: Object.freeze({ metalness: 0, roughness: 0.3, emissive: '#ff9a1f', emissiveIntensity: 0.7 }),
});

const unit = (n) => { const d = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / d, n[1] / d, n[2] / d]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lo = (h) => String(h).toLowerCase();

// the trim's colours → what they draw (a hub's own colour is any other on a wheel: realistic.js HUBS)
const TRIM = new Map([
  [lo(T.glass), { part: 'glass', material: 'glass' }],
  [lo(T.tyre), { part: 'tyre', material: 'rubber' }],
  [lo(T.hub), { part: 'rim', material: 'alloy' }],
  [lo(T.lamp), { part: 'headlamp', material: 'lamp' }],
  [lo(T.tail), { part: 'taillamp', material: 'tail' }],
  [lo(T.chrome), { part: 'chrome', material: 'alloy' }],
  [lo(T.box), { part: 'box', material: 'paint' }],
  [lo(T.frame), { part: 'frame', material: 'seal' }],
  [lo(SMOKE), { part: 'lamp.bezel', material: 'carbon' }],
]);

/** What a recorded colour draws: on a wheel, the tyre, the windows between the spokes or the rim; elsewhere the
 *  trim's own, the plastics split by where they face (the floor faces the road), and any other colour paint. */
export function roadPart(hex, n, where = 'trim') {
  const h = lo(hex);
  if (where === 'wheel') {
    if (h === lo(T.tyre)) return { part: 'tyre', material: 'rubber' };
    if (h === lo(T.plastic)) return { part: 'wheel.window', material: 'carbon' };
    return { part: 'rim', material: 'alloy' };
  }
  if (h === lo(T.plastic)) return n && n[2] < -0.6 ? { part: 'floor', material: 'seal' } : { part: 'grille', material: 'carbon' };
  return TRIM.get(h) ?? { part: 'body', material: 'paint' };
}

// a face's outward normal when nothing recorded one (the livery's marks): its Newell normal, turned away from `inside`
function newell(c, inside) {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const m = c.reduce((s, p) => [s[0] + p[0] / c.length, s[1] + p[1] / c.length, s[2] + p[2] / c.length], [0, 0, 0]);
  const u = unit(n);
  return dot(u, [m[0] - inside[0], m[1] - inside[1], m[2] - inside[2]]) < 0 ? u.map((v) => -v) : u;
}

/** A face as the form render reads it. `rec` is the recorder's { hex, n } (or null: a mark of the livery's own);
 *  `part` and `hex` name it outright (the paint's part and its colour, the compile's own). */
export function formFace(f, rec, { part, hex, where = 'trim', inside = [0, 0, 1] } = {}) {
  const asked = hex ?? rec?.hex ?? f.fill;
  const named = part ? { part, material: 'paint' } : roadPart(asked, rec?.n, where);
  return { corners: f.corners, fill: f.fill, part: named.part, material: named.material, albedo: asked, outNormal: rec?.n ? unit(rec.n) : newell(f.corners, inside) };
}

/** Crease-aware corner normals: a corner shared by faces of one material that turn less than `crease` degrees from
 *  this one takes their mean, so the paint curves across the loft's stations and a panel's edge stays an edge. */
export function smoothForm(all, { crease = 40 } = {}) {
  // (a face with no area has no normal and cannot be lit: the fleet's own loft closes a few to a line; left out)
  const faces = all.filter((f) => Math.hypot(f.outNormal[0], f.outNormal[1], f.outNormal[2]) > 1e-9);
  const cos = Math.cos((crease * Math.PI) / 180), at = new Map();
  const key = (m, p) => `${m}|${p[0].toFixed(5)},${p[1].toFixed(5)},${p[2].toFixed(5)}`;
  faces.forEach((f, i) => { for (const p of f.corners) { const k = key(f.material, p); if (!at.has(k)) at.set(k, []); at.get(k).push(i); } });
  return faces.map((f) => ({
    ...f,
    cornerNormals: f.corners.map((p) => unit(at.get(key(f.material, p)).map((j) => faces[j].outNormal).filter((n) => dot(n, f.outNormal) > cos).reduce((s, n) => [s[0] + n[0], s[1] + n[1], s[2] + n[2]], [0, 0, 0]))),
  }));
}

// ── the studio grid ───────────────────────────────────────────────────────────────
// the light the grid's preview is baked under (the grid draws a face's fill as it is): a key from the front quarter and
// above, an ambient, a touch of sky in the glass by how far it faces up, a lit slot (a lamp, a sign) in its own colour
const STUDIO = Object.freeze({ key: [0.35, 0.45, 0.82], ambient: 0.42, diffuse: 0.62, sky: [0.62, 0.71, 0.79] });
const LIT_SLOTS = new Set(['lamp', 'tail', 'sign', 'marker']);
function studioFill(hex, material, n) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  if (LIT_SLOTS.has(material)) return hex;
  const k = unit(STUDIO.key), lam = STUDIO.ambient + STUDIO.diffuse * Math.max(0, dot(n, k)) + (material === 'alloy' ? 0.12 : 0);
  const sky = material === 'glass' ? 0.35 * Math.max(0, n[2] + 0.3) : 0;
  const out = c.map((v, i) => Math.min(1, v * lam * (1 - sky) + STUDIO.sky[i] * sky));
  return `#${out.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** The form faces baked for the studio grid (the grid draws a face's first four corners, so a polygon is fanned into
 *  triangles): each corner's fill its albedo under the studio's light by its corner normal. */
export function bakeForm(faces) {
  return faces.flatMap((f) => {
    const ns = f.cornerNormals ?? f.corners.map(() => f.outNormal);
    const fans = f.corners.length <= 4 ? [[...f.corners.keys()]] : Array.from({ length: f.corners.length - 2 }, (_, j) => [0, j + 1, j + 2]);
    // (a face's own colour per corner where it carries one: a field vehicle's dust and grounding, mil-wear.js)
    return fans.map((ix) => ({ corners: ix.map((i) => f.corners[i]), fill: studioFill(f.albedo, f.material, f.outNormal), cornerFills: ix.map((i) => studioFill(f.cornerAlbedo?.[i] ?? f.albedo, f.material, ns[i])) }));
  });
}
