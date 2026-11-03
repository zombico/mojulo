/**
 * vehicle-registry/builds — what a registry row can be drawn as, tier by tier, and how far each build reaches today.
 *
 * A row names a vehicle (roster.js). A BUILD is that vehicle at a TIER, made by one of the builders its handles point
 * at. Three tiers, the fidelity a game is drawn at:
 *
 *   toy        cartoon, chibi, mascot, kart: the racer's parts grammar (the gloss racer)
 *   stylised   the painted and banded worlds: the swept, box and fuselage nets, the assembled builds
 *   realistic  the realistic hero's world: the true-dimension lofts, the supercar's surface compiler, the craft shelf,
 *              the cycle shelf
 *
 * Each build says how far it reaches (`status`):
 *   live      a game or a world draws it today (`where` says which)
 *   preview   only the studio grid shows it (mint_solid's vehicle preview): no game drives it yet
 *   asleep    the code builds it and nothing reaches it yet
 *   (an upscale from preview or asleep is wiring, not modelling)
 *   concept   the technology crafter's block plan only (the bible's plates, the RTS roster): every row has one
 *
 *   buildsOf(id)         → [{ tier, via, key, status, uses, where, why, car? }] every build the row has, toy first (`uses`:
 *                          what it serves, roster.js USES: the fleet's loft is traffic, never a hero's car; `car`: a loft
 *                          that is the car shelf's card, car-shelf/car-library.js)
 *   buildOf(id, tier, { use? })   → { asked, tier, build, fell? } the build a game at that tier draws (for that use): a
 *                          live one at the tier, else an asleep one (said), else the nearest tier's (said), else the concept
 *   upscaleOf(id)        → { id, use, realistic: live | preview | asleep | none, next } what the row needs to be drawn realistic
 *                          for the use that matters most (driven when it can be, else its first)
 *   dimsOf(id)           → { L, W, H } metres, or { length, span, height } for a craft, from the table that measures it
 *
 * Pure: reads the measuring tables, never writes them.
 */
import { VEHICLES as ROWS, handlesOf } from './roster.js';
import { VEHICLES as PHYSICS, wheelLayout, steerOf } from '../roads/vehicles.js';
import { FLEET } from '../roads/fleet.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { OPEN_FRAME } from '../car-designer/realistic.js';
import { CLASS_TRAITS } from '../car-designer/facets.js';
import { UNBUILT } from '../car-designer/sheet.js';
import { MILITARY_CLASSES } from '../car-designer/road-military.js';
import { CAR_CARDS } from '../car-shelf/car-library.js';

export const TIERS = Object.freeze({
  toy: 'cartoon, chibi, mascot, kart: the racer\'s parts grammar',
  stylised: 'the painted and banded worlds: the nets and the assembled builds',
  realistic: 'the realistic hero\'s world: true-dimension lofts, the supercar compiler, the craft shelf',
});
export const TIER_IDS = Object.freeze(Object.keys(TIERS));
export const STATUSES = Object.freeze(['live', 'preview', 'asleep', 'concept']);

// the nearest tiers, in the order a game at a tier falls back to them
const FALLS = Object.freeze({ toy: ['stylised', 'realistic'], stylised: ['realistic', 'toy'], realistic: ['stylised', 'toy'] });

/** A physics class the realistic loft (car-designer/realistic.js compileRealistic) builds: a sheet class with a body to
 *  loft (not an open frame, whose body is the racer's, nor a class the sheet has no traits for: the dirt bike, nor one
 *  whose body is not built yet: the field's truck and carrier), or a military class, whose body is the hull kit's. */
export const loftable = (cls) => Boolean(CLASS_TRAITS[cls]) && !OPEN_FRAME.includes(cls) && !UNBUILT[cls];

// the uses each builder serves (roster.js USES): a traffic loft is not a car a hero drives
const SERVES = Object.freeze({
  racer: ['driven', 'parked', 'watched'], ride: ['driven'], scenery: ['traffic', 'parked', 'watched'], assembly: ['driven', 'parked'],
  net: ['traffic', 'parked'], supercar: ['driven', 'parked', 'watched'], craft: ['driven', 'parked', 'watched', 'crewed'],
  fleet: ['traffic'], loft: ['driven', 'parked', 'watched'], tech: ['driven', 'traffic', 'parked', 'watched', 'crewed'],
  cycle: ['driven', 'parked', 'watched'],
  construction: ['parked', 'watched'],
});
const B = (tier, via, key, status, where, why, uses = SERVES[via]) => ({ tier, via, key, status, uses, where, why });
// a tracked class (roads/vehicles.js `running: 'track'`), or a wheeled one that skid steers, is drawn, parked and
// watched, not driven: skid steer is not built
const tracked = (cls) => Boolean(PHYSICS[cls]) && steerOf(PHYSICS[cls]) === 'skid';
// a cycle class (two in line, or a three-wheeler) is the cycle shelf's to build, never the car loft's
const cycleClass = (cls) => Boolean(PHYSICS[cls]) && wheelLayout(PHYSICS[cls]) !== 'axles';
const UNDRIVEN = Object.freeze(SERVES.loft.filter((u) => u !== 'driven'));

/** Every build a row has, toy first, then stylised, realistic, the concept last. */
export function buildsOf(id) {
  const h = handlesOf(id);
  if (!h) return null;
  const out = [];
  if (h.racer) out.push(B('toy', 'racer', null, 'live', ['quick race (racers)', 'mint_solid vehicle preview'], 'the racer\'s parts grammar, solved round its driver'));
  for (const k of h.ride ?? []) out.push(B('stylised', 'ride', k, 'live', ['quick ride'], 'the assembled ride the quick game drives'));
  for (const k of h.scenery ?? []) out.push(B('stylised', 'scenery', k, 'live', ['city and airfield scenery', 'mint_solid vehicle preview'], 'the swept or fuselage net, its light baked'));
  for (const k of (h.assembly ?? []).filter(() => !h.ride)) out.push(B('stylised', 'assembly', k, 'asleep', [], 'the vehicle designer\'s assembled build: no door names it yet'));
  for (const k of h.net ?? []) out.push(B('stylised', 'net', k, 'asleep', [], 'a swept net no scenery entry builds'));
  for (const k of h.supercar ?? []) out.push(B('realistic', 'supercar', k, 'live', ['quick race (supercars)', 'mint_solid vehicle preview', 'transformer'], 'the supercar\'s surface compiler, streamlined in the form render'));
  for (const k of h.craft ?? []) {
    // (a boat on the shelf is built and floated, and no door draws one yet: the transformer's craft fly)
    if (CRAFT_ARCHETYPES[k]?.realm === 'water') { out.push(B('realistic', 'craft', k, 'asleep', [], 'the craft shelf\'s boat at its class\'s true figures, floated on the waterline its weight sets: no door draws a boat yet')); continue; }
    out.push(B('realistic', 'craft', k, 'live', ['transformer'], 'the craft shelf\'s assembly at its class\'s true figures'));
  }
  for (const k of h.cycle ?? []) out.push(B('realistic', 'cycle', k, 'live', ['quick ride', 'mint_solid vehicle preview', 'a level\'s parked vehicles'], 'the cycle shelf\'s machine, its parts on its solved chassis at its class\'s numbers (cycle-shelf/): ridden, its rider astride, or parked on its stand'));
  // (a site machine is the construction shelf's: built, posed and held to its laws, drawn on the studio grid at a pose and
  // parked in a level; watched and parked, never driven, until its ride is built)
  for (const k of h.construction ?? []) out.push(B('realistic', 'construction', k, 'live', ['mint_solid vehicle preview', 'a level\'s parked vehicles'], 'the construction shelf\'s machine, its carrier, its upper, its front on its chain and its tool at its class\'s numbers (construction-shelf/): drawn at a pose (its rest, a named pose, its joints\' values), parked in a level', SERVES.construction));
  for (const k of h.fleet ?? []) out.push(B('realistic', 'fleet', k, 'live', ['roadway traffic'], 'the highway fleet\'s loft at true dimensions, at traffic distance'));
  // (a personal or family car: the car shelf's card, a loft of its class with the card's body, language, trim and paint,
  // car-shelf/; before the class's plain loft, so a game asking for the row draws the card)
  for (const k of h.car ?? []) out.push({ ...B('realistic', 'loft', CAR_CARDS[k].class, 'live', ['quick ride', 'mint_solid vehicle preview', 'a level\'s parked vehicles'], `the car shelf's ${CAR_CARDS[k].title.toLowerCase()} (car-shelf/: its body, its design language, its trim and its paint at its class's true numbers), driven on its class's own physics`), car: k });
  for (const k of (h.physics ?? []).filter(loftable).slice(0, 1)) {
    if (tracked(k)) { out.push(B('realistic', 'loft', k, 'live', ['mint_solid vehicle preview', 'a level\'s parked vehicles'], 'the military hull kit\'s body of its class on its running gear (road-military.js, mil-track.js), drawn and parked: not driven until skid steer is built', UNDRIVEN)); continue; }
    out.push(B('realistic', 'loft', k, 'live', ['quick ride', 'mint_solid vehicle preview'], MILITARY_CLASSES[k]
      ? 'the military hull kit\'s body of its class at its true numbers (road-military.js): plates, welds and fittings, driven on its class\'s own physics'
      : 'the realistic pole\'s loft of its class at its true numbers (compileRealistic), driven on its class\'s own physics'));
  }
  for (const k of h.tech ?? []) out.push(B(null, 'tech', k, 'concept', ['bible plates', 'RTS roster'], 'the technology crafter\'s block plan'));
  return out;
}

const RANK = { live: 0, preview: 1, asleep: 2 };
const atTier = (builds, tier, use) => builds.filter((b) => b.tier === tier && (!use || b.uses.includes(use))).sort((a, b) => RANK[a.status] - RANK[b.status])[0] ?? null;

/** The build a game drawn at `tier` gets for a row: the tier's own (live before asleep), else the nearest tier's, else
 *  the concept. `fell` says why when it is not the tier's live build. */
export function buildOf(id, tier = 'stylised', { use } = {}) {
  if (!TIERS[tier]) throw new Error(`vehicle-registry: tier '${tier}' is one of ${TIER_IDS.join(', ')}`);
  const builds = buildsOf(id);
  if (!builds) return null;
  const own = atTier(builds, tier, use);
  if (own) return { asked: tier, tier, build: own, ...(own.status !== 'live' ? { fell: `its ${tier} build is ${own.status === 'preview' ? 'shown on the studio grid only' : 'asleep'}: ${own.why}` } : {}) };
  for (const t of FALLS[tier]) {
    const near = atTier(builds, t, use);
    if (near) return { asked: tier, tier: t, build: near, fell: `no ${tier} build yet: drawn ${t}` };
  }
  const concept = builds.find((b) => b.status === 'concept');
  return { asked: tier, tier: null, build: concept, fell: `no build at any tier yet: the technology crafter's ${concept.key}` };
}

/** What a row needs to be drawn realistic: live already, preview or asleep (built: wire it), or none (a body to build). */
export function upscaleOf(id) {
  const builds = buildsOf(id);
  if (!builds) return null;
  const uses = ROWS[id].uses, use = uses.includes('driven') ? 'driven' : uses[0];
  const real = atTier(builds, 'realistic', use);
  if (real?.status === 'live') return { id, use, realistic: 'live', via: real.via, next: null };
  if (real) return { id, use, realistic: real.status, via: real.via, next: `wire the ${real.via} build into the games (${real.why})` };
  const has = handlesOf(id);
  const cls = [has.physics ?? []].flat()[0];
  // (a tracked class's body is live for what it serves; driving it is what it needs)
  if (cls && tracked(cls) && atTier(builds, 'realistic')?.status === 'live') return { id, use, realistic: 'none', via: null, next: 'driving it: a tracked class steers by skid steer, not built yet (its realistic body is live, parked and watched)' };
  // (a site machine's body is the construction shelf's, live for what it serves: driving it is what it needs)
  if (ROWS[id].role === 'construction' && atTier(builds, 'realistic')?.via === 'construction') return { id, use, realistic: 'none', via: null, next: 'driving it: the construction shelf\'s machine is live, drawn and parked; its ride is not built yet' };
  const next = ROWS[id].role === 'construction' ? `its realistic body: the construction shelf's (construction-shelf/), its carrier, its upper, its front and its tool, not built yet`
    : cls && UNBUILT[cls] ? `its realistic body: ${UNBUILT[cls]}`
    : cls && cycleClass(cls) ? `its realistic body: the cycle shelf's (cycle-shelf/), a ${wheelLayout(PHYSICS[cls])} machine ridden astride, not built yet`
      : cls ? 'a realistic body for its physics class (the loft has no frame for it)' : 'a realistic body and its physics';
  return { id, use, realistic: 'none', via: null, next };
}

/** The row's size, from the table that measures it (never retyped in the roster). */
export function dimsOf(id) {
  const h = handlesOf(id);
  if (!h) return null;
  const fleet = h.fleet && FLEET[h.fleet[0]];
  if (fleet) return { L: fleet.L, W: fleet.W, H: fleet.H, from: 'fleet' };
  const phys = h.physics && PHYSICS[h.physics[0]];
  if (phys?.L) return { L: phys.L, W: phys.W, H: phys.H, from: 'physics' };
  const craft = h.craft && CRAFT_ARCHETYPES[h.craft[0]];
  if (craft?.reference) return { length: craft.reference.length, span: craft.reference.span, height: craft.reference.height, from: 'craft' };
  return null;
}

/** Every row's upscale, for the gaps page and a readout: `{ live: [ids], preview: [ids], asleep: [ids], none: [ids] }`. */
export function upscaleLedger() {
  const out = { live: [], preview: [], asleep: [], none: [] };
  for (const id of Object.keys(ROWS)) out[upscaleOf(id).realistic].push(id);
  return out;
}
