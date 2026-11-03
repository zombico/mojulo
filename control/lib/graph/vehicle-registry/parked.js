/**
 * PARKED VEHICLES: registry vehicles standing still in a level, each its realistic loft (car-designer/realistic.js) at a
 * place and a heading, solid to whoever walks there. A level asks for them by a manifest's `parked`, lowered on every
 * read by the world (world-scene.js): each a static figure and a box collider over its footprint, added to the stage's
 * own colliders. A base building's `parked` (gameworld/world.js) lays them in its hangar, painted as its foes' faction
 * dresses (a crew in desert colours drives desert camo) or, with no faction, in its setting's camo.
 *
 *   PARKED_MAX                    the most a level stands
 *   BASE_PARKED                   what a base parks when it says only `true`: a truck and a carrier
 *   readParked(list, at?)         → [{ vehicle, class | craft, at, heading, livery?, wear?, look?, fold?, pad?, seed }],
 *                                   each word read through the registry (a row with a realistic loft, or a craft off the
 *                                   shelf, that can stand parked), or throws naming why. A craft (a helicopter, an
 *                                   aircraft, a drone) takes its family's `look`, the air's livery and wear, `fold`
 *                                   (its blades or wings, 0 spread … 1 folded) and `pad` (a helipad under it: true or
 *                                   { size }); its collider is its body's box, not its rotor's disc
 *   parkIn(room, words, { seed?, livery?, wear? }) → `parked` entries side by side across a room, noses to its +x
 *                                   (a hangar's doors), as many as it holds; a craft folded, in the air's nearest camo
 *   parkable(word, at?)          → { vehicle, class }, or throws naming why the word cannot stand parked
 *   readBuildingParked(word, at?) → a base building's `parked` read: true (BASE_PARKED), [words], or
 *                                   { vehicles?, livery?, wear? }, as { vehicles, livery?, wear? }
 *   paintOfDress(dress)           → the livery a faction's colourway paints its vehicles (a camo it names, else its own
 *                                   colour flat), or null
 *   withParked(manifest)          → { manifest, colliders }: the figures and static entities added, the boxes apart
 *
 * Vehicle space (+y forward) turned to the world's heading (0: nose along +x). Pure and deterministic.
 */
import { resolveVehicle, handlesOf, suggestVehicles } from './roster.js';
import { loftable } from './builds.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { MILITARY_CLASSES } from '../car-designer/road-military.js';
import { CAMO, readLivery } from '../car-designer/livery-cut.js';
import { readWear } from '../car-designer/mil-wear.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { CRAFT_ARCHETYPES, CRAFT_ODM, craftFootprint } from '../craft-shelf/index.js';
import { readAirLivery } from '../craft-shelf/air-surface.js';
import { lookCard } from '../craft-shelf/drone-looks.js';
import { lookFamily } from '../craft-shelf/heli-looks.js';

export const PARKED_MAX = 6;
export const BASE_PARKED = Object.freeze(['cargo-truck', 'apc']);
const KEYS = ['vehicle', 'at', 'heading', 'livery', 'wear', 'seed', 'look', 'fold', 'pad'];
// (a craft's own words: a road car and a field vehicle take none of them)
const CRAFT_KEYS = ['look', 'fold', 'pad'];
// a field camo's nearest in the air's patterns (air-surface.js): a base's colours on its helicopters
const AIR_OF_CAMO = Object.freeze({ woodland: 'wraparound', desert: 'desert', tiger: 'splinter', winter: 'arctic', urban: 'counterShaded', digital: 'splinter' });
/** A livery as a craft wears it: an air livery as it is, a field camo's nearest air pattern, else none. */
const airLivery = (livery) => { const L = typeof livery === 'string' && AIR_OF_CAMO[livery] ? AIR_OF_CAMO[livery] : livery; try { readAirLivery(L); return L; } catch { return undefined; } };
const r3 = (n) => Math.round(n * 1e3) / 1e3 + 0;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The row and class (a road or field vehicle's realistic loft) or craft (the craft shelf's archetype: a helicopter, an
 *  aircraft, a drone) a parked word names, or throws. */
export function parkable(word, at = 'parked') {
  const hit = typeof word === 'string' ? resolveVehicle(word) : null;
  if (!hit) throw new Error(`${at}: '${word}' is no vehicle; ${suggestVehicles(String(word ?? ''))}`);
  const craft = (handlesOf(hit.id).craft ?? []).find((k) => CRAFT_ARCHETYPES[k]?.realm === 'earth');
  if (craft && hit.row.uses.includes('parked')) return { vehicle: hit.id, craft };
  const cls = (handlesOf(hit.id).physics ?? []).find(loftable);
  if (!cls || !hit.row.uses.includes('parked')) throw new Error(`${at}: the ${hit.row.label} has no realistic body that stands parked`);
  return { vehicle: hit.id, class: cls };
}

export function readParked(list, at = 'parked') {
  if (!Array.isArray(list) || !list.length || list.length > PARKED_MAX) throw new Error(`${at} is a list of 1 to ${PARKED_MAX} vehicles { vehicle, at: [x, y, z], heading?, livery?, wear?, seed? }`);
  return list.map((p, k) => {
    const w = `${at}[${k}]`;
    if (!isObj(p)) throw new Error(`${w} is { vehicle, at: [x, y, z], heading?, livery?, wear?, seed? }`);
    for (const key of Object.keys(p)) if (!KEYS.includes(key)) throw new Error(`${w}.${key} is not a parked vehicle's setting (${KEYS.join(', ')})`);
    const { vehicle, class: cls, craft } = parkable(p.vehicle, `${w}.vehicle`);
    if (!Array.isArray(p.at) || p.at.length !== 3 || !p.at.every(Number.isFinite)) throw new Error(`${w}.at is [x, y, z], metres`);
    if (p.heading !== undefined && !Number.isFinite(p.heading)) throw new Error(`${w}.heading is radians (0: its nose along +x)`);
    if (p.seed !== undefined && !Number.isInteger(p.seed)) throw new Error(`${w}.seed is an integer`);
    if (craft) {
      // (a craft: its look (a card of its family), its livery and wear the air's, its blades folded, a helipad under it)
      if (p.look !== undefined) lookCard(p.look, lookFamily(CRAFT_ARCHETYPES[craft], CRAFT_ODM));
      if (p.livery !== undefined) readAirLivery(p.livery);
      if (p.wear !== undefined) readWear(p.wear);
      if (p.fold !== undefined && !(Number.isFinite(p.fold) && p.fold >= 0 && p.fold <= 1)) throw new Error(`${w}.fold is 0 (spread) to 1 (folded)`);
      if (p.pad !== undefined && p.pad !== true && p.pad !== false && !(isObj(p.pad) && Object.keys(p.pad).every((k) => k === 'size') && Number.isFinite(p.pad.size) && p.pad.size >= 4 && p.pad.size <= 40)) throw new Error(`${w}.pad is true (a helipad under it) or { size: 4 to 40 metres }`);
      return { vehicle, craft, at: p.at.map(r3), heading: r3(p.heading ?? 0), ...Object.fromEntries(['look', 'livery', 'wear', 'fold'].filter((k) => p[k] !== undefined).map((k) => [k, p[k]])), ...(p.pad ? { pad: p.pad } : {}), seed: p.seed ?? k + 1 };
    }
    for (const key of CRAFT_KEYS) if (p[key] !== undefined) throw new Error(`${w}.${key}: the ${vehicle} is no craft; a look, a fold and a helipad are a craft's`);
    // (a livery and a wear are a field vehicle's: a road car is painted and weathered by its own build)
    const field = !!MILITARY_CLASSES[cls];
    for (const key of ['livery', 'wear']) if (p[key] !== undefined && !field) throw new Error(`${w}.${key}: the ${vehicle} is ${key === 'livery' ? 'painted' : 'weathered'} by its own build; only a field vehicle takes one`);
    if (p.livery !== undefined) readLivery(p.livery);
    if (p.wear !== undefined) readWear(p.wear);
    return { vehicle, class: cls, at: p.at.map(r3), heading: r3(p.heading ?? 0), ...(p.livery !== undefined ? { livery: p.livery } : {}), ...(p.wear !== undefined ? { wear: p.wear } : {}), seed: p.seed ?? k + 1 };
  });
}

export function readBuildingParked(word, at = 'building.parked') {
  const P = word === true ? {} : Array.isArray(word) ? { vehicles: word } : isObj(word) ? word : null;
  if (!P) throw new Error(`${at} is true (a truck and a carrier), a list of vehicles, or { vehicles?, livery?, wear? }`);
  for (const k of Object.keys(P)) if (!['vehicles', 'livery', 'wear'].includes(k)) throw new Error(`${at}.${k} is not one of its words (vehicles, livery, wear)`);
  const vehicles = P.vehicles ?? [...BASE_PARKED];
  if (!Array.isArray(vehicles) || !vehicles.length || vehicles.length > PARKED_MAX) throw new Error(`${at}.vehicles is a list of 1 to ${PARKED_MAX} vehicles`);
  vehicles.forEach((w, k) => parkable(w, `${at}.vehicles[${k}]`));
  if (P.livery !== undefined) readLivery(P.livery);
  if (P.wear !== undefined) readWear(P.wear);
  return { vehicles, ...(P.livery !== undefined ? { livery: P.livery } : {}), ...(P.wear !== undefined ? { wear: P.wear } : {}) };
}

/** A faction's colourway as its vehicles' paint: the camo of that name, else the colourway's own colour, flat. */
export function paintOfDress(dress) {
  if (!dress?.faction || !dress.colourway) return null;
  if (CAMO[dress.colourway]) return dress.colourway;
  // (its top's colour, the most of it a crew wears, else its first)
  const pal = GRUNT_STYLES[dress.faction]?.colourways?.[dress.colourway]?.palette ?? {}, top = pal.Top ?? Object.values(pal).find((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c));
  return top ? { pattern: 'mono', colours: [top.toLowerCase()] } : null;
}

/** Vehicles side by side across a room ({ x, y, w, d, z }), their noses to its +x, a gap between them; as many as fit. */
export function parkIn(room, words, { seed = 1, livery, wear } = {}) {
  const rows = words.map((w, k) => parkable(w, `parked[${k}]`));
  const gap = 1.6, out = [];
  let y = room.y + gap;
  rows.forEach((r, k) => {
    if (r.craft) {
      // (a craft under a roof: its blades and wings folded, its whole folded extent the room it takes; its livery the
      // base's own where the air has it)
      const F = craftFootprint(r.craft, { fold: 1 }), L = F.max[1] - F.min[1], W = F.max[0] - F.min[0];
      if (L + 2 * gap > room.w || y + W + gap > room.y + room.d) return;
      const air = livery !== undefined && livery !== null ? airLivery(livery) : undefined;
      out.push({ vehicle: r.vehicle, at: [r3(room.x + room.w / 2), r3(y + W / 2), r3(room.z ?? 0)], heading: 0, fold: 1, ...(air !== undefined ? { livery: air } : {}), ...(wear !== undefined ? { wear } : {}), seed: seed + k });
      y += W + gap;
      return;
    }
    const v = PHYSICS[r.class];
    if (v.L + 2 * gap > room.w || y + v.W + gap > room.y + room.d) return;
    const field = !!MILITARY_CLASSES[r.class];
    out.push({ vehicle: r.vehicle, at: [r3(room.x + room.w / 2), r3(y + v.W / 2), r3(room.z ?? 0)], heading: 0, ...(field && livery !== undefined && livery !== null ? { livery } : {}), ...(field && wear !== undefined ? { wear } : {}), seed: seed + k });
    y += v.W + gap;
  });
  return out;
}

/** A manifest's parked vehicles lowered: each a loft figure and a static entity, and a box over its footprint. */
export function withParked(manifest) {
  const P = readParked(manifest.parked);
  const figures = { ...(manifest.figures ?? {}) }, entities = [...(manifest.entities ?? [])], colliders = [];
  P.forEach((p, k) => {
    if (p.craft) {
      // (a craft: its form figure standing on its gear (a helipad under it when asked), still; a box over its body, not
      // its rotor's disc, so a walker passes under the blades)
      const id = `parked-${k}`, c = Math.cos(p.heading), s = Math.sin(p.heading);
      figures[id] = { craft: { archetype: p.craft, seed: p.seed, ...Object.fromEntries(['look', 'livery', 'wear', 'fold', 'pad'].filter((q) => p[q] !== undefined).map((q) => [q, p[q]])) } };
      entities.push({ id, rule: { type: 'static' }, body: { type: 'figure-rig', figure: id }, transform: { pos: p.at, heading: p.heading } });
      // (its body's box in its own frame (+y its nose), turned to the heading (0: nose along +x))
      const F = craftFootprint(p.craft, { rotors: false, ...(p.fold !== undefined ? { fold: p.fold } : {}), ...(p.look ? { look: p.look } : {}) });
      const xs = [], ys = [];
      for (const x of [F.min[0], F.max[0]]) for (const y of [F.min[1], F.max[1]]) { xs.push(x * s + y * c); ys.push(-x * c + y * s); }
      colliders.push({ min: [r3(p.at[0] + Math.min(...xs)), r3(p.at[1] + Math.min(...ys)), p.at[2]], max: [r3(p.at[0] + Math.max(...xs)), r3(p.at[1] + Math.max(...ys)), r3(p.at[2] + F.max[2])] });
      return;
    }
    const id = `parked-${k}`, v = PHYSICS[p.class], c = Math.cos(p.heading), s = Math.sin(p.heading);
    figures[id] = { loft: { class: p.class, seed: p.seed, light: 'form', ...(p.livery !== undefined ? { livery: p.livery } : {}), ...(p.wear !== undefined ? { wear: p.wear } : {}) } };
    entities.push({ id, rule: { type: 'static' }, body: { type: 'figure-rig', figure: id }, transform: { pos: p.at, heading: p.heading } });
    // (its footprint turned: nose along the heading, its length that way, its width across)
    const hx = (Math.abs(c) * v.L + Math.abs(s) * v.W) / 2, hy = (Math.abs(s) * v.L + Math.abs(c) * v.W) / 2;
    colliders.push({ min: [r3(p.at[0] - hx), r3(p.at[1] - hy), p.at[2]], max: [r3(p.at[0] + hx), r3(p.at[1] + hy), r3(p.at[2] + v.H)] });
  });
  const { parked: _p, ...rest } = manifest;
  return { manifest: { ...rest, figures, entities }, colliders };
}
