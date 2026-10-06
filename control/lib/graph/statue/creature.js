// statue/creature — the statue FILTER over the creature designer's animal (kind `animal`, the species door): the same
// laws the hero's statue build obeys, laid on the animal's World faces at read time (opt-in; absent ⇒ the animal as it
// was, byte for byte).
//
//   statue: { type: 'statue', material?, base?, dials?: { wear }, laws? }   (or `true`: marble on a block)
//
//   CARVE    one material over every face (law 1): the coat, its countershading and markings, the eyes, nose, hooves and
//            mane all one stone or one metal, shaded by each face's own normal; no fur splats, no skin texture
//   SURFACE  the faces carry the material's surface for the exports (a bronze in its patina's colour; law 1)
//   BASE     an oblong plinth under the whole animal (law 7: a quadruped's base runs its length), the animal lifted onto it
//
// An equestrian statue's horse is this filter over the creature designer's horse (law 10, `mountedStatue`: the ring plan
// of polygonizer/horse-form.js): a hero statue with `stand: 'mounted'` sits astride it, the World resolver composing the two.
// Pure and deterministic.
import { STATUE_LAWS_VERSION, STATUE_MATERIALS, MATERIAL_WORDS, BASE_WORDS, METAL_BASE_MATERIAL, MOUNT_GROUP, MOUNT, weatherTone } from './principles.js';
import { horsePlan } from '../polygonizer/horse-form.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { layeredFaces } from '../polygonizer/station-loft-faces.js';
import { rigNodesAt } from '../polygonizer/station-loft-rig.js';
import { statueMaterial } from './expand.js';
import { statueBaseFaces } from './base.js';
import { shadeHex, scaleHex } from '../polygonizer/vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from '../polygonizer/materials.js';

const FIELDS = ['type', 'material', 'base', 'dials', 'laws'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** `true` is marble on a block; an object is the build */
export const normalizeCreatureStatue = (s) => (s === true ? { type: 'statue' } : s);

/** Form errors for an animal's `statue` (empty = valid) */
export function validateCreatureStatue(input) {
  if (input === undefined) return [];
  const s = normalizeCreatureStatue(input);
  if (!isObj(s) || s.type !== 'statue') return ["statue: true, or { type: 'statue', material?, base?, dials?: { wear } } — the animal carved as sculpture"];
  const errs = [];
  if (s.material !== undefined && !MATERIAL_WORDS.includes(s.material)) errs.push(`statue.material: one of ${MATERIAL_WORDS.join(', ')}`);
  if (s.material === 'painted') errs.push("statue.material: a creature's painted polychromy has no zones yet (its coat is one skin); carve it in stone or metal");
  if (s.base !== undefined && !BASE_WORDS.includes(s.base)) errs.push(`statue.base: one of ${BASE_WORDS.join(', ')}`);
  const d = s.dials ?? {};
  if (!isObj(d)) errs.push('statue.dials: { wear }');
  else { for (const k of Object.keys(d)) if (k !== 'wear') errs.push(`statue.dials.${k}: not a dial (wear)`);
    if (d.wear !== undefined && !(Number.isFinite(d.wear) && d.wear >= 0 && d.wear <= 1)) errs.push('statue.dials.wear: a number 0–1'); }
  for (const k of Object.keys(s)) if (!FIELDS.includes(k)) errs.push(`statue.${k}: not a field (${FIELDS.join(', ')})`);
  if (s.laws !== undefined && s.laws !== STATUE_LAWS_VERSION) errs.push(`statue.laws: ${s.laws} is unknown — this kernel carries statue laws ${STATUE_LAWS_VERSION}`);
  return errs;
}

/** The build's words: its material (marble), base (block) and wear */
export function creatureStatueWords(input) {
  const s = normalizeCreatureStatue(input);
  return { material: s.material ?? 'marble', base: s.base ?? 'block', wear: s.dials?.wear ?? 0 };
}

/** CARVE + SURFACE: the faces in one material, shaded by `light` → new faces (group kept) */
export function carveCreatureFaces(faces, input, { light }) {
  const { material, wear } = creatureStatueWords(input), { tone, surface } = statueMaterial(material, { wear });
  const out = faces.map(({ fill, cornerFills: _c, texture: _t, uv: _u, textureLit: _l, island: _i, ...f }) => ({ ...f, fill: Array.isArray(f.outNormal) ? shadeHex(tone, f.outNormal, light) : tone }));
  tagFacesWithMaterial(out, resolveMaterial(surface));
  return out;
}

/** a palette group carved as a GROOVE (a channel cut in the stone: the nemes' stripes): its name ends `Groove` */
export const isGrooveGroup = (g) => /Groove$/.test(g);
/** the shade a groove takes of the material (its channel in shadow) */
export const GROOVE_SHADE = 0.8;
/** CARVE + SURFACE on a layered recipe (a creature designer's plan): every palette group the material's tone, a groove a
 * shade darker; the surfaces `{ '*': the material's }` → a new recipe */
export function carveCreatureRecipe(recipe, input) {
  const { material, wear } = creatureStatueWords(input), { tone, surface } = statueMaterial(material, { wear });
  const groups = new Set(Object.keys(recipe.palette || {}));
  for (const p of Object.values(recipe.parts || {})) { groups.add(p.group ?? 'Body'); for (const v of Object.values(p.groups || {})) groups.add(v); for (const v of Object.values(p.bandGroups || {})) for (const g of v) if (g) groups.add(g); for (const v of Object.values(p.capGroups || {})) if (v) groups.add(v); }
  const palette = Object.fromEntries([...groups].sort().map((g) => [g, isGrooveGroup(g) ? scaleHex(tone, GROOVE_SHADE) : tone]));
  const { emissive: _glow, ...rest } = recipe;
  return { ...rest, palette, surfaces: { '*': surface } };
}

/** BASE: the base's word and stone (a metal animal stands on limestone, law 7) */
export function creatureBaseOf(input) {
  const { base, material, wear } = creatureStatueWords(input), stone = STATUE_MATERIALS[material].metal ? METAL_BASE_MATERIAL : material;
  return { kind: base, tone: weatherTone(STATUE_MATERIALS[stone].tone, wear), surface: STATUE_MATERIALS[stone].surface };
}

/**
 * The animal carved and stood on its base: `faces` its World faces → { faces, lift, trace }. The base runs under the
 * whole animal (oblong); the animal (and anything composed with it, a rider) is lifted by `lift`.
 */
export function creatureStatue(faces, input, { light }) {
  const carved = carveCreatureFaces(faces, input, { light }), B = creatureBaseOf(input), words = creatureStatueWords(input);
  const based = statueBaseFaces(carved, { kind: B.kind, tone: B.tone, light, oblong: true, tag: (fs) => tagFacesWithMaterial(fs, resolveMaterial(B.surface)) });
  const lift = based.lift;
  const body = lift ? carved.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], Math.round((c[2] + lift) * 1e9) / 1e9]) })) : carved;
  return { faces: [...body, ...based.faces], lift, trace: { ...words, basis: 'unverified', laws: STATUE_LAWS_VERSION } };
}

// ── law 10: the mount ──────────────────────────────────────────────────────────────────────────────────────────────
const r9 = (x) => Math.round(x * 1e9) / 1e9;
/** The saddle: the top of the back's midline at MOUNT.saddleAt of the body's length from the rear → [x, y, z] */
export function saddleOf(faces) {
  const C = faces.flatMap((f) => f.corners); let y0 = Infinity, y1 = -Infinity;
  for (const c of C) { y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }
  // the back's midline top line near the saddle: the highest midline corner within a ring's spacing of it (a plan's rings
  // stand tens of centimetres apart, a marched skin's a few)
  const y = y0 + MOUNT.saddleAt * (y1 - y0); let top = -Infinity;
  for (const c of C) if (Math.abs(c[1] - y) < 0.2 && Math.abs(c[0]) < 0.05 && c[2] > top) top = c[2];
  if (!Number.isFinite(top)) throw new Error('statue: the mount has no back at its saddle to sit the rider on');
  return [0, y, top];
}
/** Where a rider sits, from its body (never its clothes, whose hem hangs between the thighs): the midpoint of the posed
 * hip joints, dropped by the rest body's own depth from the hips to the fork (the midline's lowest body point below
 * them), in the faces' frame (`dz` the seat the faces were lifted by) → [x, y, z] */
export function riderSeat({ R, pose, mesh, recipe, dz = 0 }) {
  const { nodes } = rigNodesAt(R, pose), L = R.legs.L, Rt = R.legs.R, hl = nodes[L.hip], hr = nodes[Rt.hip];
  const restZ = (R.joints[L.hip][2] + R.joints[Rt.hip][2]) / 2; let fork = Infinity;
  mesh.vertices.forEach((v, i) => { const part = recipe.parts[mesh.provenance[i].part]; if (part?.garment || Math.abs(v[0]) > 0.03 || v[2] > restZ || v[2] < restZ - 0.35) return; if (v[2] < fork) fork = v[2]; });
  const drop = Number.isFinite(fork) ? restZ - fork : 0;
  return [(hl[0] + hr[0]) / 2, (hl[1] + hr[1]) / 2, (hl[2] + hr[2]) / 2 - drop + dz];
}
/** The statue horse's faces (horse-form.js's ring plan, compiled and seated on the floor), carved in `material` */
export function statueHorseFaces({ material = 'marble', wear = 0 } = {}, { light }) {
  const recipe = expandPlan(horsePlan()), faces = layeredFaces(compileLayered(recipe), recipe, { light });
  return carveCreatureFaces(faces, { type: 'statue', material, dials: { wear } }, { light });
}
/**
 * An equestrian statue: the horse carved in the rider's material and moved so its saddle lies under the rider's seat
 * (the rider stays in its own frame, so its rig pack's lift holds), then the base under both, oblong under the horse.
 * `rider` the posed rider's faces, `seat` where it sits (riderSeat); `base` its statueBaseOf → { faces (the horse, group MOUNT_GROUP, and the base, both
 * lifted), lift (the rider's) }.
 */
export function mountedStatue(rider, base, { light, tag = null, seat }) {
  const horse = statueHorseFaces(base, { light }), at = saddleOf(horse);
  const d = [seat[0] - at[0], seat[1] - at[1], seat[2] - at[2] + MOUNT.sink];
  const placed = horse.map((f) => ({ ...f, corners: f.corners.map((c) => [r9(c[0] + d[0]), r9(c[1] + d[1]), r9(c[2] + d[2])]), group: MOUNT_GROUP }));
  const kind = base.kind === 'none' ? 'none' : 'block', based = statueBaseFaces(placed, { kind, tone: base.tone, light, oblong: true, tag });
  // the base stands under the hooves; with 'none' the horse stands on the floor
  const lift = kind === 'none' ? -Math.min(...placed.flatMap((f) => f.corners.map((c) => c[2]))) : based.lift;
  const up = (fs) => fs.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], r9(c[2] + lift)]) }));
  return { faces: [...up(placed), ...based.faces], lift: r9(lift) };
}
