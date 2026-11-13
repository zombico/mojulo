/**
 * PARKED VEHICLES: registry vehicles standing still in a level, each its realistic loft (car-designer/realistic.js), or a
 * machine ridden astride its cycle shelf machine on its stand (cycle-shelf/: `look` dresses it), or a site machine its
 * construction shelf machine (construction-shelf/: `pose` poses it, a crane's outriggers out by its 'rigged'; `tool`,
 * `height` and `palette` beside it), at a place and a heading, solid to whoever walks there. A level asks for them by a manifest's `parked`, lowered on every
 * read by the world (world-scene.js): each a static figure and a box collider over its footprint, added to the stage's
 * own colliders. A base building's `parked` (gameworld/world.js) lays them in its hangar, painted as its foes' faction
 * dresses (a crew in desert colours drives desert camo) or, with no faction, in its setting's camo.
 *
 *   PARKED_MAX                    the most a level stands
 *   BASE_PARKED                   what a base parks when it says only `true`: a truck and a carrier
 *   readParked(list, at?)         → [{ vehicle, class | craft, car?, cycle?, construction?, at, heading, livery?, wear?, look?,
 *                                   fold?, pad?, reach?, pose?, tool?, height?, palette?, seed }], each word read through the registry (a row with a realistic loft, a cycle
 *                                   with a stand, or a craft off the shelf, that can stand parked), or throws naming why. A
 *                                   craft (a helicopter, an aircraft, a drone) takes its family's `look`, the air's livery and
 *                                   wear, `fold` (its blades or wings, 0 spread … 1 folded), `pad` (a helipad under it: true or
 *                                   { size }) and `crew` (true: its role's ground crew; or a list of them): the crew follow it
 *                                   in the list, each placed and posed to its doors, holds and nose gear (turnaround.js). Its
 *                                   collider is its body's box, not its rotor's disc. An airside body takes `reach` (its lift,
 *                                   belt, platform or cradle, metres: road-airside.js). A cycle takes its look; a site machine its
 *                                   pose, tool, height and palette (construction-shelf/con-figure.js); a personal or family car
 *                                   its `car` (the car shelf's card or composition, car-shelf/car-library.js: a car row stands
 *                                   as its own card, but one the highway fleet lofts keeps its class's plain loft)
 *                                   A walker (a mecha shelf frame: mecha-shelf/) stands at its stance, fitted for a `role`
 *                                   when it names one (MECHA_ROLES: 'assault', 'recon', …), in its livery and wear where its
 *                                   frame is a dressed one; its collider a box over what its frame takes up.
 *   parkIn(room, words, { seed?, livery?, wear? }) → `parked` entries side by side across a room, noses to its +x
 *                                   (a hangar's doors), as many as it holds; a craft folded, in the air's nearest camo
 *   parkable(word, at?)          → { vehicle, class, cycle?, construction? } or { vehicle, craft }, or throws naming why
 *                                   the word cannot stand parked
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
import { readMechaSpec, mechaFootprint } from '../mecha-shelf/mecha-figure.js';
import { lookFamily } from '../craft-shelf/heli-looks.js';
import { CYCLE_ARCHETYPES } from '../cycle-shelf/cycle-archetypes.js';
import { CYCLE_ODM } from '../cycle-shelf/cycle-odm.js';
import { lookCard as cycleLookCard } from '../cycle-shelf/cycle-looks.js';
import { wheelLayout } from '../roads/vehicles.js';
import { AIRSIDE_REACH } from '../car-designer/road-airside.js';
import { CIVIC_REACH, CIVIC_CLASSES } from '../car-designer/road-civic.js';
import { crewFor, turnaround } from './turnaround.js';
import { conFootprint, readConSpec } from '../construction-shelf/con-figure.js';
import { CAR_CARDS, readCarSpec } from '../car-shelf/car-library.js';

export const PARKED_MAX = 6;
export const BASE_PARKED = Object.freeze(['cargo-truck', 'apc']);
const KEYS = ['vehicle', 'at', 'heading', 'livery', 'wear', 'look', 'seed', 'fold', 'pad', 'crew', 'reach', 'pose', 'tool', 'height', 'palette', 'car', 'role'];
// (a craft's own words: a road car, a field vehicle and a cycle take none of them)
const CRAFT_KEYS = ['fold', 'pad', 'crew'];
// (the most a level stands with every craft's crew about it)
export const PARKED_CREWED_MAX = 30;
// (a site machine's own words: construction-shelf/con-figure.js)
const SITE = Object.freeze(['pose', 'tool', 'height', 'palette']);
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
  const h = handlesOf(hit.id);
  // (a craft off the shelf: a helicopter, an aircraft, a drone, standing on its gear)
  const craft = (h.craft ?? []).find((k) => CRAFT_ARCHETYPES[k]?.realm === 'earth');
  if (craft && hit.row.uses.includes('parked')) return { vehicle: hit.id, craft };
  // (a personal or family car stands as its row's own card, car-shelf/; a row the highway fleet lofts (the sedan, the
  // compact, the crossover) parked its class's plain loft before, and keeps it unless its entry names a `car`)
  const card = (h.car ?? [])[0];
  if (card && !h.fleet && hit.row.uses.includes('parked')) return { vehicle: hit.id, class: CAR_CARDS[card].class, car: card };
  const cls = (h.physics ?? []).find(loftable);
  if (cls && hit.row.uses.includes('parked')) return { vehicle: hit.id, class: cls };
  if (card && hit.row.uses.includes('parked')) return { vehicle: hit.id, class: CAR_CARDS[card].class, car: card };
  // (a machine ridden astride: its cycle shelf machine, standing on its stand; one with none is held up by hand)
  const cycle = (h.cycle ?? [])[0];
  if (cycle && hit.row.uses.includes('parked')) {
    // (two in line stand on a stand; three wheels or four stand on their own)
    const inline = wheelLayout(PHYSICS[h.physics[0]]) === 'inline';
    if (inline && !CYCLE_ARCHETYPES[cycle].layout.some((e) => CYCLE_ODM[e.sku].kind === 'cycle-stand')) throw new Error(`${at}: the ${hit.row.label} has no stand to stand on`);
    return { vehicle: hit.id, class: h.physics[0], cycle };
  }
  // (a walker: its mecha shelf frame, standing at its stance)
  const mecha = (h.mecha ?? [])[0];
  if (mecha && hit.row.uses.includes('parked')) return { vehicle: hit.id, mecha };
  // (a site machine: its construction shelf machine, at its rest unless its words pose it)
  const site = (h.construction ?? [])[0];
  if (site && hit.row.uses.includes('parked')) return { vehicle: hit.id, class: (h.physics ?? [])[0] ?? null, construction: site };
  throw new Error(`${at}: the ${hit.row.label} has no realistic body that stands parked`);
}

export function readParked(list, at = 'parked') {
  if (!Array.isArray(list) || !list.length || list.length > PARKED_MAX) throw new Error(`${at} is a list of 1 to ${PARKED_MAX} vehicles { vehicle, at: [x, y, z], heading?, livery?, wear?, seed? }`);
  const read = list.flatMap((p, k) => {
    const w = `${at}[${k}]`;
    if (!isObj(p)) throw new Error(`${w} is { vehicle, at: [x, y, z], heading?, livery?, wear?, seed? }`);
    for (const key of Object.keys(p)) if (!KEYS.includes(key)) throw new Error(`${w}.${key} is not a parked vehicle's setting (${KEYS.join(', ')})`);
    const { vehicle, class: cls0, craft, cycle, construction, car: card, mecha } = parkable(p.vehicle, `${w}.vehicle`);
    // (a car's own card or composition, read as the car shelf reads it: any row the car shelf builds takes one)
    if (p.car !== undefined && !card && !(handlesOf(vehicle).car ?? []).length) throw new Error(`${w}.car: the ${vehicle} is no car the car shelf builds; a car is a sedan's, a hatchback's, an estate's …`);
    const car = p.car ?? card;
    if (p.car !== undefined) readCarSpec(p.car);
    const cls = car !== undefined ? (typeof car === 'object' && car.class) || CAR_CARDS[typeof car === 'string' ? car : car.preset]?.class || cls0 : cls0;
    if (!Array.isArray(p.at) || p.at.length !== 3 || !p.at.every(Number.isFinite)) throw new Error(`${w}.at is [x, y, z], metres`);
    if (p.heading !== undefined && !Number.isFinite(p.heading)) throw new Error(`${w}.heading is radians (0: its nose along +x)`);
    if (p.seed !== undefined && !Number.isInteger(p.seed)) throw new Error(`${w}.seed is an integer`);
    if (mecha) {
      // (a walker: its role, its livery and wear read as its shelf reads them; nothing of a craft's, a car's or a site's)
      for (const key of [...CRAFT_KEYS, ...SITE.filter((q) => q !== 'palette'), 'look', 'reach', 'car']) if (p[key] !== undefined) throw new Error(`${w}.${key}: the ${vehicle} is a walker; it takes a role, a palette, a livery and a wear`);
      const words = Object.fromEntries(['role', 'palette', 'livery', 'wear'].filter((q) => p[q] !== undefined).map((q) => [q, p[q]]));
      readMechaSpec({ archetype: mecha, ...words }, w);
      return [{ vehicle, mecha, at: p.at.map(r3), heading: r3(p.heading ?? 0), ...words, seed: p.seed ?? k + 1 }];
    }
    if (craft) {
      // (a craft: its look (a card of its family), its livery and wear the air's, its blades folded, a helipad under it)
      if (p.look !== undefined) lookCard(p.look, lookFamily(CRAFT_ARCHETYPES[craft], CRAFT_ODM));
      if (p.livery !== undefined) readAirLivery(p.livery);
      if (p.wear !== undefined) readWear(p.wear);
      if (p.fold !== undefined && !(Number.isFinite(p.fold) && p.fold >= 0 && p.fold <= 1)) throw new Error(`${w}.fold is 0 (spread) to 1 (folded)`);
      if (p.pad !== undefined && p.pad !== true && p.pad !== false && !(isObj(p.pad) && Object.keys(p.pad).every((k) => k === 'size') && Number.isFinite(p.pad.size) && p.pad.size >= 4 && p.pad.size <= 40)) throw new Error(`${w}.pad is true (a helipad under it) or { size: 4 to 40 metres }`);
      if (p.reach !== undefined) throw new Error(`${w}.reach: the ${vehicle} lifts nothing; a reach is a catering truck's, a belt loader's, a stair truck's or a pushback's`);
      const entry = { vehicle, craft, at: p.at.map(r3), heading: r3(p.heading ?? 0), ...Object.fromEntries(['look', 'livery', 'wear', 'fold'].filter((k) => p[k] !== undefined).map((k) => [k, p[k]])), ...(p.pad ? { pad: p.pad } : {}), seed: p.seed ?? k + 1 };
      if (p.crew === undefined || p.crew === false) return [entry];
      // (its crew about it, each placed and posed to its doors, holds and nose gear: turnaround.js)
      crewFor(craft, p.crew, `${w}.crew`);
      const crew = turnaround(entry, { crew: p.crew, seed: (entry.seed * 100) + 1 }).map((e) => {
        const { class: cls } = parkable(e.vehicle, `${w}.crew`);
        return { vehicle: e.vehicle, class: cls, at: e.at, heading: e.heading, ...(e.reach !== undefined ? { reach: e.reach } : {}), ...(e.livery !== undefined ? { livery: e.livery } : {}), seed: e.seed };
      });
      return [entry, ...crew];
    }
    for (const key of CRAFT_KEYS) if (p[key] !== undefined) throw new Error(`${w}.${key}: the ${vehicle} is no craft; a fold and a helipad are a craft's`);
    // (a livery and a wear are a field vehicle's: a road car is painted and weathered by its own build)
    const field = !!MILITARY_CLASSES[cls];
    for (const key of ['livery', 'wear']) if (p[key] !== undefined && !field) throw new Error(`${w}.${key}: the ${vehicle} is ${key === 'livery' ? 'painted' : 'weathered'} by its own build; only a field vehicle takes one`);
    if (p.livery !== undefined) readLivery(p.livery);
    if (p.wear !== undefined) readWear(p.wear);
    // (a look dresses a cycle: a car is dressed by its own build)
    if (p.look !== undefined && !cycle) throw new Error(`${w}.look: the ${vehicle} is dressed by its own build; a look dresses a machine ridden astride`);
    if (p.look !== undefined) cycleLookCard(p.look);
    // (a reach lifts an airside body: its galley, its belt, its platform, a pushback's cradle; metres, clamped to its range)
    // (or a city's body that deploys: a refuse truck's tailgate, a plough's blade, a sweeper's brooms, a ladder's tip, a
    // bucket's floor; its range its own)
    const civic = field && CIVIC_REACH[CIVIC_CLASSES[cls]];
    if (p.reach !== undefined && !(field && (AIRSIDE_REACH[MILITARY_CLASSES[cls]] || civic))) throw new Error(`${w}.reach: the ${vehicle} lifts nothing; a reach is a catering truck's, a belt loader's, a stair truck's or a pushback's, or a city vehicle's that deploys (a garbage truck, a snowplow, a street sweeper, a ladder truck, a bucket truck)`);
    const top = civic ? civic.range[1] : 10;
    if (p.reach !== undefined && !(Number.isFinite(p.reach) && p.reach >= 0 && p.reach <= top)) throw new Error(`${w}.reach is metres from the ground, 0 to ${top}`);
    // (a pose, a tool, a height and a palette are a site machine's: read as its shelf reads them)
    for (const key of SITE) if (p[key] !== undefined && !construction) throw new Error(`${w}.${key}: the ${vehicle} is posed by its own build; a ${key} is a site machine's`);
    const site = construction ? Object.fromEntries(SITE.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) : null;
    if (construction) readConSpec({ archetype: construction, ...site }, w);
    return [{ vehicle, class: cls, ...(car !== undefined ? { car } : {}), ...(cycle ? { cycle } : {}), ...(construction ? { construction, ...site } : {}), at: p.at.map(r3), heading: r3(p.heading ?? 0), ...(p.livery !== undefined ? { livery: p.livery } : {}), ...(p.wear !== undefined ? { wear: p.wear } : {}), ...(p.look !== undefined ? { look: p.look } : {}), ...(p.reach !== undefined ? { reach: p.reach } : {}), seed: p.seed ?? k + 1 }];
  });
  if (read.length > PARKED_CREWED_MAX) throw new Error(`${at}: ${read.length} vehicles with their crews, more than a level stands (${PARKED_CREWED_MAX})`);
  return read;
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
    const v = r.construction ? conFootprint({ archetype: r.construction }) : PHYSICS[r.class];
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
    if (p.mecha) {
      // (a walker: its frame's figure at its stance, still; a box its frame's envelope, turned to the heading)
      const id = `parked-${k}`, c = Math.cos(p.heading), s = Math.sin(p.heading), v = mechaFootprint({ archetype: p.mecha, ...(p.role !== undefined ? { role: p.role } : {}) });
      figures[id] = { mecha: { archetype: p.mecha, ...Object.fromEntries(['role', 'palette', 'livery', 'wear'].filter((q) => p[q] !== undefined).map((q) => [q, p[q]])) } };
      entities.push({ id, rule: { type: 'static' }, body: { type: 'figure-rig', figure: id }, transform: { pos: p.at, heading: p.heading } });
      const hx = (Math.abs(c) * v.L + Math.abs(s) * v.W) / 2, hy = (Math.abs(s) * v.L + Math.abs(c) * v.W) / 2;
      colliders.push({ min: [r3(p.at[0] - hx), r3(p.at[1] - hy), p.at[2]], max: [r3(p.at[0] + hx), r3(p.at[1] + hy), r3(p.at[2] + v.H)] });
      return;
    }
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
    const id = `parked-${k}`, c = Math.cos(p.heading), s = Math.sin(p.heading);
    // (a site machine's footprint is what it stands on at its pose: a crane's floats out, a tower crane's base)
    const spec = p.construction ? { archetype: p.construction, ...Object.fromEntries(SITE.filter((key) => p[key] !== undefined).map((key) => [key, p[key]])) } : null;
    const v = spec ? conFootprint(spec) : PHYSICS[p.class];
    figures[id] = spec ? { construction: spec } : p.cycle ? { cycle: { archetype: p.cycle, ...(p.look !== undefined ? { look: p.look } : {}) } }
      : { loft: { class: p.class, ...(p.car !== undefined ? { car: p.car } : {}), seed: p.seed, light: 'form', ...(p.livery !== undefined ? { livery: p.livery } : {}), ...(p.wear !== undefined ? { wear: p.wear } : {}), ...(p.reach !== undefined ? { reach: p.reach } : {}) } };
    entities.push({ id, rule: { type: 'static' }, body: { type: 'figure-rig', figure: id }, transform: { pos: p.at, heading: p.heading } });
    // (its footprint turned: nose along the heading, its length that way, its width across)
    const hx = (Math.abs(c) * v.L + Math.abs(s) * v.W) / 2, hy = (Math.abs(s) * v.L + Math.abs(c) * v.W) / 2;
    colliders.push({ min: [r3(p.at[0] - hx), r3(p.at[1] - hy), p.at[2]], max: [r3(p.at[0] + hx), r3(p.at[1] + hy), r3(p.at[2] + v.H)] });
  });
  // (SAID ONCE: two parked vehicles that are the same vehicle, in the same dress, are one figure stood twice; the page
  // carries its body once)
  const first = new Map();
  for (const e of entities) {
    const id = e && e.body && e.body.figure;
    if (typeof id !== 'string' || !/^parked-\d+$/.test(id) || !figures[id]) continue;
    const key = JSON.stringify(figures[id]), kept = first.get(key);
    if (kept === undefined) first.set(key, id); else if (kept !== id) { e.body = { ...e.body, figure: kept }; delete figures[id]; }
  }
  const { parked: _p, ...rest } = manifest;
  return { manifest: { ...rest, figures, entities }, colliders };
}
