/**
 * vehicle-registry/builds — what a registry row can be drawn as, tier by tier, and how far each build reaches today.
 *
 * A row names a vehicle (roster.js). A BUILD is that vehicle at a TIER, made by one of the builders its handles point
 * at. Three tiers, the fidelity a game is drawn at:
 *
 *   toy        cartoon, chibi, mascot, kart: the racer's parts grammar (the gloss racer)
 *   stylised   the painted and banded worlds: the swept, box and fuselage nets, the assembled builds
 *   realistic  the realistic hero's world: the true-dimension lofts, the supercar's surface compiler, the craft shelf
 *
 * Each build says how far it reaches (`status`):
 *   live      a game or a world draws it today (`where` says which)
 *   preview   only the studio grid shows it (mint_solid's vehicle preview): no game drives it yet
 *   asleep    the code builds it and nothing reaches it yet
 *   (an upscale from preview or asleep is wiring, not modelling)
 *   concept   the technology crafter's block plan only (the bible's plates, the RTS roster): every row has one
 *
 *   buildsOf(id)         → [{ tier, via, key, status, uses, where, why }] every build the row has, toy first (`uses`:
 *                          what it serves, roster.js USES: the fleet's loft is traffic, never a hero's car)
 *   buildOf(id, tier, { use? })   → { asked, tier, build, fell? } the build a game at that tier draws (for that use): a
 *                          live one at the tier, else an asleep one (said), else the nearest tier's (said), else the concept
 *   upscaleOf(id)        → { id, use, realistic: live | preview | asleep | none, next } what the row needs to be drawn realistic
 *                          for the use that matters most (driven when it can be, else its first)
 *   dimsOf(id)           → { L, W, H } metres, or { length, span, height } for a craft, from the table that measures it
 *
 * Pure: reads the measuring tables, never writes them.
 */
import { VEHICLES as ROWS, handlesOf } from './roster.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { FLEET } from '../roads/fleet.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { OPEN_FRAME } from '../car-designer/realistic.js';
import { CLASS_TRAITS } from '../car-designer/facets.js';

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
 *  loft (not an open frame, whose body is the racer's, nor a class the sheet has no traits for: the dirt bike). */
export const loftable = (cls) => Boolean(CLASS_TRAITS[cls]) && !OPEN_FRAME.includes(cls);

// the uses each builder serves (roster.js USES): a traffic loft is not a car a hero drives
const SERVES = Object.freeze({
  racer: ['driven', 'parked', 'watched'], ride: ['driven'], scenery: ['traffic', 'parked', 'watched'], assembly: ['driven', 'parked'],
  net: ['traffic', 'parked'], supercar: ['driven', 'parked', 'watched'], craft: ['driven', 'parked', 'watched', 'crewed'],
  fleet: ['traffic'], loft: ['driven', 'parked', 'watched'], tech: ['driven', 'traffic', 'parked', 'watched', 'crewed'],
});
const B = (tier, via, key, status, where, why) => ({ tier, via, key, status, uses: SERVES[via], where, why });

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
  for (const k of h.craft ?? []) out.push(B('realistic', 'craft', k, 'live', ['transformer'], 'the craft shelf\'s assembly at its class\'s true figures'));
  for (const k of h.fleet ?? []) out.push(B('realistic', 'fleet', k, 'live', ['roadway traffic'], 'the highway fleet\'s loft at true dimensions, at traffic distance'));
  for (const k of (h.physics ?? []).filter(loftable).slice(0, 1)) out.push(B('realistic', 'loft', k, 'preview', ['mint_solid vehicle preview'], 'the realistic pole\'s loft of its class at its true numbers (compileRealistic): shown, not yet driven in a game'));
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
  const next = has.physics ? 'a realistic body for its physics class (the loft has no frame for it)' : 'a realistic body and its physics';
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
