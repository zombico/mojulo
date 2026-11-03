/**
 * PARKED VEHICLES: registry vehicles standing still in a level, each its realistic loft (car-designer/realistic.js), or a
 * machine ridden astride its cycle shelf machine on its stand (cycle-shelf/: `look` dresses it), at a place and a heading, solid to whoever walks there. A level asks for them by a manifest's `parked`, lowered on every
 * read by the world (world-scene.js): each a static figure and a box collider over its footprint, added to the stage's
 * own colliders. A base building's `parked` (gameworld/world.js) lays them in its hangar, painted as its foes' faction
 * dresses (a crew in desert colours drives desert camo) or, with no faction, in its setting's camo.
 *
 *   PARKED_MAX                    the most a level stands
 *   BASE_PARKED                   what a base parks when it says only `true`: a truck and a carrier
 *   readParked(list, at?)         → [{ vehicle, class, cycle?, at, heading, livery?, wear?, look?, seed }], each word
 *                                   read through the registry (a row with a realistic loft, or a cycle with a stand, that can
 *                                   stand parked), or throws naming why
 *   parkIn(room, words, { seed?, livery?, wear? }) → `parked` entries side by side across a room, noses to its +x
 *                                   (a hangar's doors), as many as it holds
 *   parkable(word, at?)          → { vehicle, class, cycle? }, or throws naming why the word cannot stand parked
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
import { CYCLE_ARCHETYPES } from '../cycle-shelf/cycle-archetypes.js';
import { CYCLE_ODM } from '../cycle-shelf/cycle-odm.js';
import { lookCard } from '../cycle-shelf/cycle-looks.js';
import { wheelLayout } from '../roads/vehicles.js';

export const PARKED_MAX = 6;
export const BASE_PARKED = Object.freeze(['cargo-truck', 'apc']);
const KEYS = ['vehicle', 'at', 'heading', 'livery', 'wear', 'look', 'seed'];
const r3 = (n) => Math.round(n * 1e3) / 1e3 + 0;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The row and class a parked word names, or throws. */
export function parkable(word, at = 'parked') {
  const hit = typeof word === 'string' ? resolveVehicle(word) : null;
  if (!hit) throw new Error(`${at}: '${word}' is no vehicle; ${suggestVehicles(String(word ?? ''))}`);
  const h = handlesOf(hit.id), cls = (h.physics ?? []).find(loftable);
  if (cls && hit.row.uses.includes('parked')) return { vehicle: hit.id, class: cls };
  // (a machine ridden astride: its cycle shelf machine, standing on its stand; one with none is held up by hand)
  const cycle = (h.cycle ?? [])[0];
  if (cycle && hit.row.uses.includes('parked')) {
    // (two in line stand on a stand; three wheels or four stand on their own)
    const inline = wheelLayout(PHYSICS[h.physics[0]]) === 'inline';
    if (inline && !CYCLE_ARCHETYPES[cycle].layout.some((e) => CYCLE_ODM[e.sku].kind === 'cycle-stand')) throw new Error(`${at}: the ${hit.row.label} has no stand to stand on`);
    return { vehicle: hit.id, class: h.physics[0], cycle };
  }
  throw new Error(`${at}: the ${hit.row.label} has no realistic body that stands parked`);
}

export function readParked(list, at = 'parked') {
  if (!Array.isArray(list) || !list.length || list.length > PARKED_MAX) throw new Error(`${at} is a list of 1 to ${PARKED_MAX} vehicles { vehicle, at: [x, y, z], heading?, livery?, wear?, seed? }`);
  return list.map((p, k) => {
    const w = `${at}[${k}]`;
    if (!isObj(p)) throw new Error(`${w} is { vehicle, at: [x, y, z], heading?, livery?, wear?, seed? }`);
    for (const key of Object.keys(p)) if (!KEYS.includes(key)) throw new Error(`${w}.${key} is not a parked vehicle's setting (${KEYS.join(', ')})`);
    const { vehicle, class: cls, cycle } = parkable(p.vehicle, `${w}.vehicle`);
    if (!Array.isArray(p.at) || p.at.length !== 3 || !p.at.every(Number.isFinite)) throw new Error(`${w}.at is [x, y, z], metres`);
    if (p.heading !== undefined && !Number.isFinite(p.heading)) throw new Error(`${w}.heading is radians (0: its nose along +x)`);
    if (p.seed !== undefined && !Number.isInteger(p.seed)) throw new Error(`${w}.seed is an integer`);
    // (a livery and a wear are a field vehicle's: a road car is painted and weathered by its own build)
    const field = !!MILITARY_CLASSES[cls];
    for (const key of ['livery', 'wear']) if (p[key] !== undefined && !field) throw new Error(`${w}.${key}: the ${vehicle} is ${key === 'livery' ? 'painted' : 'weathered'} by its own build; only a field vehicle takes one`);
    if (p.livery !== undefined) readLivery(p.livery);
    if (p.wear !== undefined) readWear(p.wear);
    // (a look dresses a cycle: a car is dressed by its own build)
    if (p.look !== undefined && !cycle) throw new Error(`${w}.look: the ${vehicle} is dressed by its own build; a look dresses a machine ridden astride`);
    if (p.look !== undefined) lookCard(p.look);
    return { vehicle, class: cls, ...(cycle ? { cycle } : {}), at: p.at.map(r3), heading: r3(p.heading ?? 0), ...(p.livery !== undefined ? { livery: p.livery } : {}), ...(p.wear !== undefined ? { wear: p.wear } : {}), ...(p.look !== undefined ? { look: p.look } : {}), seed: p.seed ?? k + 1 };
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
    const v = PHYSICS[r.class];
    if (v.L + 2 * gap > room.w || y + v.W + gap > room.y + room.d) return;
    const field = !!MILITARY_CLASSES[r.class];
    out.push({ vehicle: r.vehicle, at: [r3(room.x + room.w / 2), r3(y + v.W / 2), r3(room.z ?? 0)], heading: 0, ...(field && livery !== undefined && livery !== null ? { livery } : {}), ...(field && wear !== undefined ? { wear } : {}), seed: seed + k });
    y += v.W + gap;
  });
  return out;
}

/** A manifest's parked vehicles lowered: each a loft or cycle figure and a static entity, and a box over its footprint. */
export function withParked(manifest) {
  const P = readParked(manifest.parked);
  const figures = { ...(manifest.figures ?? {}) }, entities = [...(manifest.entities ?? [])], colliders = [];
  P.forEach((p, k) => {
    const id = `parked-${k}`, v = PHYSICS[p.class], c = Math.cos(p.heading), s = Math.sin(p.heading);
    figures[id] = p.cycle ? { cycle: { archetype: p.cycle, ...(p.look !== undefined ? { look: p.look } : {}) } }
      : { loft: { class: p.class, seed: p.seed, light: 'form', ...(p.livery !== undefined ? { livery: p.livery } : {}), ...(p.wear !== undefined ? { wear: p.wear } : {}) } };
    entities.push({ id, rule: { type: 'static' }, body: { type: 'figure-rig', figure: id }, transform: { pos: p.at, heading: p.heading } });
    // (its footprint turned: nose along the heading, its length that way, its width across)
    const hx = (Math.abs(c) * v.L + Math.abs(s) * v.W) / 2, hy = (Math.abs(s) * v.L + Math.abs(c) * v.W) / 2;
    colliders.push({ min: [r3(p.at[0] - hx), r3(p.at[1] - hy), p.at[2]], max: [r3(p.at[0] + hx), r3(p.at[1] + hy), r3(p.at[2] + v.H)] });
  });
  const { parked: _p, ...rest } = manifest;
  return { manifest: { ...rest, figures, entities }, colliders };
}
