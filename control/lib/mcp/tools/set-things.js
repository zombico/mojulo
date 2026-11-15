/**
 * set-things — a film's set DRESSED BY WORD: a thing named as people say it ("a sedan", "a crate", "a chesterfield"),
 * found on the shelves mojulo already has and stood in a scene as itself, at its real size. The set dresser names a
 * thing; it never makes one. A thing no shelf has is a row on that shelf, by that shelf's rules, not a film's own.
 *
 * The shelves, in the order a word is read:
 *   prop       the corner things a stage gathers (era/props.js PROP_KINDS): a crate, a barrel, planks, an amphora …
 *   furniture  a style or a kind of furniture (furnishings/forms.js), or a room piece's word whose row names its style
 *              (furnishings/roster.js)
 *   vehicle    the vehicle registry (vehicle-registry/roster.js): any word it names, as the vehicle door shows it
 *              parked, at its true size (builds.js dimsOf)
 *
 *   readThing(word) → { shelf, id, label, metres: [long, wide, high] | null } or throws naming what the shelves have
 *   thingPayload(T, { seed?, unshaded? }) → the thing's World payload (its faces, metres or its own unit), never stored
 *   thingScale(T, size) → how many times larger it stands than its faces measure (`size`: [x, y, z] metres as read), so
 *                        a thing a shelf measures stands at that measure; 1 where the shelf gives none
 *
 * readThing is pure. thingPayload resolves a recipe held in memory (worlds/world-scene.js), as a stored one is.
 */
import { PROP_KINDS, buildProp, propSurfaces } from '@/lib/graph/era/props.js';
import { FURNITURE_KINDS, FURNITURE_STYLES, resolveFurniture } from '@/lib/graph/furnishings/forms.js';
import { furnitureAssetBuild } from '@/lib/graph/furnishings/asset.js';
import { resolveFurnishing } from '@/lib/graph/furnishings/roster.js';
import { resolveVehicle, suggestVehicles } from '@/lib/graph/vehicle-registry/roster.js';
import { dimsOf } from '@/lib/graph/vehicle-registry/builds.js';

export const THING_SHELVES = Object.freeze(['prop', 'furniture', 'vehicle']);
const word = (w) => String(w ?? '').toLowerCase().trim().replace(/^(a|an|the)\s+/, '').replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

/** A thing by its word (see the header) */
export function readThing(raw) {
  const w = word(raw);
  if (!w) throw new Error('a thing is named by a word: a vehicle (sedan, bus, motorcycle), a piece of furniture (sofa, table, bookcase), a prop (crate, barrel)');
  if (PROP_KINDS.includes(w) && w !== 'debris') return { shelf: 'prop', id: w, label: w, metres: null };
  if (FURNITURE_STYLES[w]) return { shelf: 'furniture', id: w, label: w.replace(/-/g, ' '), like: w, metres: null };
  if (FURNITURE_KINDS[w]) return { shelf: 'furniture', id: w, label: w, kind: w, metres: null };
  const V = resolveVehicle(raw);
  if (V) {
    const D = dimsOf(V.id), m = D ? [D.L ?? D.length, D.W ?? D.span, D.H ?? D.height] : null;
    return { shelf: 'vehicle', id: V.id, label: V.row.label ?? V.id, metres: m && m.every((v) => Number.isFinite(v) && v > 0) ? m : null };
  }
  const F = resolveFurnishing(raw), style = F?.row?.style ?? null;
  if (style && FURNITURE_STYLES[style]) return { shelf: 'furniture', id: F.id, label: F.row.label ?? style, like: style, metres: null };
  throw new Error(`'${raw}' is on no shelf a set is dressed from. Props: ${PROP_KINDS.filter((k) => k !== 'debris').join(', ')}. Furniture: ${Object.keys(FURNITURE_STYLES).join(', ')}. Vehicles: ${suggestVehicles(raw)}. Anything else mojulo made stands by its ref.`);
}

/** The thing's World payload (see the header) */
export async function thingPayload(T, { seed = 1, unshaded = false } = {}) {
  if (T.shelf === 'prop') {
    const faces = [];
    // (built on its own at the origin, its back to a wall that is not there: era/props.js buildProp)
    buildProp(T.id, faces, [0, 0, 0], [0, -1, 0], [1, 0, 0], 0, seed, propSurfaces());
    return { faces, metersPerUnit: 1, title: T.label };
  }
  // (a vehicle as the vehicle door shows it, its realistic build where it has one: tools/preview-vehicle.js)
  let vehicle = null;
  if (T.shelf === 'vehicle') {
    const { readVehicleWord } = await import('@/lib/mcp/tools/preview-vehicle.js');
    try { vehicle = readVehicleWord({ vehicle: T.id, tier: 'realistic' }); } catch { vehicle = readVehicleWord({ vehicle: T.id }); }
  }
  const manifest = vehicle
    ? { kind: 'vehicle-instance', vehicle: T.id, ...Object.fromEntries(Object.entries(vehicle.instance).filter(([, v]) => v !== undefined)) }
    : { kind: 'workbench', build: furnitureAssetBuild(resolveFurniture(T.like ? { like: T.like } : { kind: T.kind }).locked), units: 'mm', title: T.label };
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
  const { payload } = await resolveWorldScene({ ref: null, title: T.label, manifest }, unshaded ? { unshaded: true } : {});
  return payload;
}

/** How many times larger a thing stands than its faces measure (see the header) */
export function thingScale(T, size) {
  if (!T.metres || !Array.isArray(size)) return 1;
  const read = Math.max(size[0], size[1]), real = Math.max(T.metres[0], T.metres[1]);
  return read > 1e-6 && real > 0 ? Math.round((real / read) * 1e4) / 1e4 : 1;
}
