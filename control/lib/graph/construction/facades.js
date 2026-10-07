// construction/facades — the pieces built on the workbench, saved as FACADES a room or a condo can place: what shows of
// each (its boards and legs, its padding, cushions and cloth) and none of what does not (joints, bores, screws, springs,
// the frame inside the padding). A facade is a function of a footprint: the saved recipe is re-dialled to the size the
// room planner gives it, lowered once, turned to face +y like every room asset, and scaled into the room's unit.
//
//   facadeFaces(kind, { w, d, h, unitMm?, palette?, light? }) → faces
//     kind:    one of FACADE_KINDS — 'sofa', 'armchair', 'chesterfield', 'coffee-table', 'dining-table', 'chair',
//              'bookcase', 'media-console', 'sideboard', 'chest', 'nightstand'
//     w, d, h: the footprint along its width, its depth (front +y) and its height, in the room's unit
//     unitMm:  millimetres a unit (304.8: the floor plans and condos are in feet)
//     palette: a house style's finish — { upholstery, wood, cabinet } colours — for the cloth, the timber and the boards
//     light:   the room's light (the lowering is lit mirrored, so the piece turned to face +y shades as if built so)
// Faces are centred on the footprint in x and y, stand on z = 0, and are memoized: a condo repeats its sizes.
//
// What a facade drops: every joint (so no fitting, bore or cut, and no exact kernel), and the fittings with them; the
// padding hides the frame inside it (frame.js, the finished view). Soft parts mesh on a 45 mm grid (a room is seen from
// across it), timber is tinted flat (a room cannot carry a figure texture for every timber face), and board and cloth
// tiles, shared by every part of one material, stay.
// What a facade adds that the construction does not model: a pull on every door and drawer front (a bar handle, 128 mm
// centres), a television on a media console and a lamp on a nightstand (above the footprint, as the room's own do).
import { lowerFrame } from './frame.js';
import { expandBuild } from './furniture-builds.js';
import { makeLight, shadeHexMat } from '../polygonizer/vexar.js';
import { resolveMaterial } from '../polygonizer/materials.js';
import { boxPolys, frustumPolys } from './prims.js';
import { styleFrame } from '../furnishings/forms.js';
import { shapeLegs } from './legs.js';

const FT = 304.8;
const ROOM_LIGHT = makeLight({ direction: [0.4, -0.5, 0.74], ambient: 0.5, diffuse: 0.56, fill: { diffuse: 0.34 } });   // the workbench asset light
/** The saved pieces: each a footprint (mm) → a frame recipe (mm, front −y, from the origin). They are the first of the
 *  furnishing styles (furnishings/forms.js), which compose them from slot forms and a finish. */
export const FACADE_KINDS = Object.freeze(Object.fromEntries(
  ['sofa', 'armchair', 'chesterfield', 'coffee-table', 'dining-table', 'chair', 'bookcase', 'media-console', 'sideboard', 'chest', 'nightstand']
    .map((kind) => [kind, (W, D, H, p) => styleFrame(kind, W, D, H, p)]),
));

/** The facade recipe for a kind and a footprint (mm): the build's members and soft parts, no joints. */
export function facadeRecipe(kind, { W, D, H, palette = null }) {
  const make = FACADE_KINDS[kind]; if (!make) throw new Error(`facade: '${kind}' is not one of ${Object.keys(FACADE_KINDS).join(', ')}`);
  const r = make(W, D, H, palette);
  return frameOf(kind, r);
}

/** A frame recipe ({ build, fabric?, tint?, legs? }) → the facade recipe: the build's members and soft parts, no joints. */
function frameOf(id, r) {
  const x = expandBuild({ unit: 'mm', build: r.build });
  return { id, unit: 'mm', members: x.members, ...(x.soft ? { soft: x.soft, softCell: 45 } : {}), ...(r.fabric ? { fabric: r.fabric } : {}), ...(r.tint ? { tint: r.tint } : {}), ...(r.legs && r.legs !== 'block' ? { legs: r.legs } : {}) };
}

const mirror = (L) => {
  const m = (v) => (Array.isArray(v) ? [-v[0], -v[1], v[2]] : v);
  return { ...L, dir: m(L.dir), toLight: m(L.toLight), ...(L.fillToLight ? { fillToLight: m(L.fillToLight) } : {}) };
};

const PULL = '#34363a', SCREEN = '#12161c', BEZEL = '#2b2e33';
/** Pulls and a television for a facade recipe (mm, the recipe's frame) → [{ corners, n, hex, group }]. */
function extras(kind, spec) {
  const out = [];
  const box = (c, size, hex, group) => { for (const p of boxPolys(c, size)) out.push({ ...p, hex, group }); };
  for (const m of spec.members) {
    const id = m.id, b = m.box; if (!b) continue;
    const door = /^door(-[lr])?$/.test(id), drawer = /^d\d+-front$/.test(id);
    if (!door && !drawer) continue;
    const y = b.min[1] - 14, zc = (b.min[2] + b.max[2]) / 2;
    if (door) {
      // on the edge away from the hinge: a left-hung door's right edge
      const x = id === 'door-r' ? b.min[0] + 45 : b.max[0] - 45;
      const z = Math.min(zc, b.min[2] + 900);
      box([x, y, z], [12, 28, 140], PULL, 'pull');
    } else box([(b.min[0] + b.max[0]) / 2, y, zc + (b.max[2] - b.min[2]) * 0.12], [140, 28, 12], PULL, 'pull');
  }
  if (kind === 'media-console') {
    const X = Math.max(...spec.members.map((m) => m.box.max[0])), Y = Math.max(...spec.members.map((m) => m.box.max[1])), Z = Math.max(...spec.members.map((m) => m.box.max[2]));
    const tvW = Math.min(X * 0.62, 1400), tvH = tvW * 0.56, cx = X / 2, cy = Y * 0.55, z0 = Z + 60;
    box([cx, cy, Z + 30], [tvW * 0.18, 180, 60], BEZEL, 'tv');
    box([cx, cy, z0 + tvH / 2], [tvW, 40, tvH], BEZEL, 'tv');
    box([cx, cy - 21, z0 + tvH / 2], [tvW * 0.96, 2, tvH * 0.92], SCREEN, 'tv');
  }
  if (kind === 'nightstand') {
    const X = Math.max(...spec.members.map((m) => m.box.max[0])), Y = Math.max(...spec.members.map((m) => m.box.max[1])), Z = Math.max(...spec.members.map((m) => m.box.max[2]));
    const c = [X / 2, Y * 0.55], at = (z) => [c[0], c[1], Z + z];
    for (const p of frustumPolys(at(0), at(20), 70, 60, 16)) out.push({ ...p, hex: '#6d6a64', group: 'lamp' });
    for (const p of frustumPolys(at(20), at(260), 9, 9, 8)) out.push({ ...p, hex: '#6d6a64', group: 'lamp' });
    for (const p of frustumPolys(at(220), at(400), 150, 95, 20)) out.push({ ...p, hex: '#ece4d0', group: 'lamp' });
  }
  return out;
}

/** A recipe lowered as a facade: its faces (legs shaped, pulls and dressing on) and the box of the piece itself. */
function lowerFacade(kind, spec, L) {
  const LM = mirror(L);
  let { faces } = lowerFrame(spec, { light: LM, timberFigure: 'flat' });
  if (spec.legs) faces = shapeLegs(faces, spec, LM);
  // the footprint is the piece's own: measured before its pulls and television go on
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; }
  const steel = resolveMaterial('steel');
  for (const p of extras(kind, spec)) faces.push({ corners: p.corners, fill: shadeHexMat(p.hex, p.n, steel, { light: LM }), doubleSided: true, outNormal: p.n, group: p.group });
  return { faces, lo, hi };
}

/** Faces turned to face +y (a half turn about z), centred, on the floor, scaled per axis. */
const place = (faces, lo, hi, [sx, sy, sz]) => {
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
  return faces.map((f) => ({
    ...f,
    corners: f.corners.map((c) => [-(c[0] - cx) * sx, -(c[1] - cy) * sy, (c[2] - lo[2]) * sz]),
    ...(Array.isArray(f.outNormal) ? { outNormal: [-f.outNormal[0], -f.outNormal[1], f.outNormal[2]] } : {}),
  }));
};

// keyed on the exact footprint: the faces are scaled to it, so a near size (7.0004 against 7.0001 ft) is its own entry
// and a piece draws the same whatever the process drew before it (a condo's repeats are exact repeats)
const CACHE = new Map(); const CACHE_MAX = 96;
const remember = (key, out) => { CACHE.set(key, out); if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value); return out; };

/** The facade's faces in the room's frame and unit (see the header). */
export function facadeFaces(kind, { w, d, h, unitMm = FT, palette = null, light = null } = {}) {
  if (!(w > 0 && d > 0 && h > 0)) throw new Error('facade: w, d and h must be positive');
  const L = light || ROOM_LIGHT;
  const key = JSON.stringify([kind, w, d, h, unitMm, palette, L]);
  if (CACHE.has(key)) return CACHE.get(key);
  const spec = facadeRecipe(kind, { W: w * unitMm, D: d * unitMm, H: h * unitMm, palette });
  const { faces, lo, hi } = lowerFacade(kind, spec, L);
  // scaled to the footprint exactly
  return remember(key, place(faces, lo, hi, [w / (hi[0] - lo[0]), d / (hi[1] - lo[1]), h / (hi[2] - lo[2])]));
}

/** A LOCKED piece (furnishings/forms.js resolveFurniture) → its faces in a unit of `unitMm` millimetres: centred, on
 *  the floor, facing +y. At the build's own size, or with `fit` scaled per axis to the lock's `sizeMm` exactly (an
 *  asset fills the size it is given, as a room's facade fills its footprint). */
export function lockedFurnitureFaces(locked, { unitMm = FT, light = null, fit = false, dress = null } = {}) {
  if (!locked || !locked.build) throw new Error('facade: a locked piece { kind, build, legs, sizeMm, fabric?, tint? }');
  const L = light || ROOM_LIGHT;
  const key = JSON.stringify(['locked', locked, unitMm, L, fit, dress]);
  if (CACHE.has(key)) return CACHE.get(key);
  const spec = frameOf(locked.kind, locked);
  // `dress` names a facade kind whose room dressing the piece takes (a media console's television, a nightstand's lamp)
  const { faces, lo, hi } = lowerFacade(dress || locked.kind, spec, L);
  const k = 1 / unitMm;
  const scale = fit ? [0, 1, 2].map((a) => (locked.sizeMm[a] / (hi[a] - lo[a])) * k) : [k, k, k];
  return remember(key, place(faces, lo, hi, scale));
}
