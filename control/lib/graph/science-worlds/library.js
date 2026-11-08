/**
 * A thing from the studio's libraries as a classical BODY: `as: { vehicle: 'sedan' }` or `as: { part: 'crate', size }`.
 * The library says what it is; the body takes its numbers, and the page draws it as itself.
 *
 *   vehicle   a row of the vehicle roster by any word people say for it: its mass from the road physics table (with its
 *             driver), its size from the highway fleet's true dimensions (else the physics table's), its mesh the fleet's
 *             true-dimension loft where it has one (else its box, said so)
 *   part      a building or prop part by its destructible-physics class (a crate, a barrel, a door, a wall block, a
 *             boulder…): its matter and the solid share of its box from the class table, its size the recipe's
 *             ([length, width, height]), its mass that matter's density × the box × the share; drawn as its box
 *
 * Its CONTACTS are a sphere's, as every classical body's: the bounding sphere of its box (half its diagonal), so it
 * touches a wall or a body no closer than that. It is drawn resting on its base: the mesh sits low in that sphere, its
 * bottom where the sphere's is, so a body at rest on a floor stands on it. It does not turn as it moves; its nose points
 * the way it first moves across the ground. All of it is declared on the page.
 *
 *   readLibraryBody(spec, where) → { kind, word, id, label, dims: [L, W, H], R, mass, massFrom, matter?, mesh: 'loft' | 'box', fleet? }
 *   libraryFaces(lib, heading, tint) → faces in metres about the body's centre (base at −R), nose along `heading`
 */

import { resolveVehicle, handlesOf } from '../vehicle-registry/roster.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { FLEET, buildVehicle } from '../roads/fleet.js';
import { CLASS_MATTER, resolveMatter } from '../rupa/matter.js';
import { quantity } from './contract.js';

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const LIBRARY_KINDS = ['vehicle', 'part'];

export function readLibraryBody(spec, where) {
  if (!isObj(spec)) fail(where, "wants { vehicle: '<a vehicle people name>' } or { part: '<a part class>', size: [L, W, H] }");
  const kind = LIBRARY_KINDS.find((k) => spec[k] !== undefined);
  if (!kind) fail(where, `names a vehicle or a part (${LIBRARY_KINDS.join(', ')})`);
  const extra = Object.keys(spec).filter((k) => k !== kind && !(kind === 'part' && k === 'size'));
  if (extra.length) fail(`${where}.${extra[0]}`, kind === 'vehicle' ? 'a vehicle takes its size and mass from its tables' : "a part takes 'size' and nothing else");
  const word = String(spec[kind]);
  if (kind === 'vehicle') {
    const hit = resolveVehicle(word);
    if (!hit) fail(`${where}.vehicle`, `no vehicle '${word}' in the roster (a word people say for one: 'sedan', 'pickup truck', 'bus', 'bicycle', …)`);
    const id = typeof hit === 'string' ? hit : hit.id, h = handlesOf(id);
    const phys = h.physics?.map((k) => PHYSICS[k]).find(Boolean);
    const fleetKey = h.fleet?.find((k) => FLEET[k]);
    const sz = fleetKey ? FLEET[fleetKey] : phys;
    if (!sz?.L || !phys?.mass) fail(`${where}.vehicle`, `the ${id}'s ${!phys?.mass ? 'mass' : 'size'} is in no table yet: give the body a mass and a radius instead`);
    const dims = [sz.L, sz.W, sz.H];
    return {
      kind, word, id, label: (typeof hit === 'object' && hit.row?.label) || id, dims, R: Math.hypot(...dims) / 2,
      mass: phys.mass, massFrom: `the road physics table, with its driver (${phys.words ?? id})`,
      sizeFrom: fleetKey ? 'the highway fleet\'s true dimensions' : 'the road physics table', mesh: fleetKey ? 'loft' : 'box', ...(fleetKey ? { fleet: fleetKey } : {}),
    };
  }
  const cls = CLASS_MATTER[word];
  if (!cls) fail(`${where}.part`, `no part '${word}' (${Object.keys(CLASS_MATTER).join(', ')})`);
  if (!Array.isArray(spec.size) || spec.size.length !== 3) fail(`${where}.size`, 'wants [length, width, height]');
  const dims = spec.size.map((v, k) => {
    const x = quantity(v, 'length', `${where}.size[${k}]`);
    if (!(x > 0)) fail(`${where}.size[${k}]`, 'is above 0');
    return x;
  });
  const matter = resolveMatter(cls.fill !== undefined ? { is: cls.matter, fill: cls.fill } : cls.matter, `${where}.part`);
  const fill = matter.fill ?? 1;
  return {
    kind, word, id: word, label: word, dims, R: Math.hypot(...dims) / 2,
    mass: matter.density * dims[0] * dims[1] * dims[2] * fill, massFrom: `the density of ${(matter.label ?? matter.id).toLowerCase()} × its box${fill < 1 ? ` × ${fill} (the solid share of a ${word})` : ''}`,
    sizeFrom: 'the recipe', matter, mesh: 'box',
  };
}

// a box about the origin: L along x, W along y, base at z0
function boxFaces([L, W, H], z0, fill, group) {
  const x = L / 2, y = W / 2, P = [[-x, -y, z0], [x, -y, z0], [x, y, z0], [-x, y, z0], [-x, -y, z0 + H], [x, -y, z0 + H], [x, y, z0 + H], [-x, y, z0 + H]];
  return [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].map((f) => ({ corners: f.map((k) => P[k].slice()), fill, group }));
}

/** The body's drawing in metres about its centre: its base at −R (where its contact sphere's bottom is), nose along `heading`. */
export function libraryFaces(lib, heading, tint, group) {
  const z0 = -lib.R;
  const raw = lib.mesh === 'loft'
    ? (() => { const v = buildVehicle(lib.fleet); return [...v.paint, ...v.trim, ...(v.trailer || [])].map((f) => ({ ...f, corners: f.corners.map((p) => [p[0], p[1], p[2] + z0]), group })); })()
    : boxFaces(lib.dims, z0, tint, group);
  const c = Math.cos(heading), s = Math.sin(heading);
  return raw.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x * c - y * s, x * s + y * c, z]) }));
}
