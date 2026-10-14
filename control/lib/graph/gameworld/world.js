/**
 * THE GAMEWORLD — a game is a series of levels, and a gameworld is what they share. The world carries the broad
 * strokes in two concerns:
 *
 *   STYLE           the ground: the kit it is drawn in (palette, tiles, light, flora), its character (how trails
 *                   rise and fall, how climbs are built), its LAND (era/out-land.js: each form's variant and where it
 *                   stands from little to many: its clouds, rocks, cliffs, landmarks), and which civilization builds
 *                   where no one else is named
 *   CIVILIZATIONS   who builds on it: each its building language, its fortification, how it lays out a town and
 *                   raises a castle, and its TECHNOLOGY: its machines, and what the crafter (tech-crafter.js) makes of
 *                   its words: the vehicles it goes in, the tech-structures it raises, the weapons it fights with. A
 *                   world keeps as many as it likes; a level is settled by one, and any town or castle on it may be
 *                   built by another (a conqueror's castle over an older town). Only what a civilization builds and
 *                   makes is here; its people are left open with the world's characters
 *   CHARACTERS      who walks it (characters.js): the character book, its direction and its hero; read here,
 *                   resolved there
 *   EQUIPMENT       what can be equipped (equipment.js): a row per class of gear, read here, resolved there
 *   MECHANICS       the game's systems (mechanics.js): the stats and the HUD, derived from the hero's actions
 *
 * Every level inherits both. A level is a local lord: it executes the world's style in place and interprets it, and
 * may override any part of it (its own kit, a steeper trail, another civilization); a section or a place may override
 * its level the same way. Every override is kept in a LEDGER beside the value it replaced.
 *
 *   gameworld: {
 *     id, name?, seed?,
 *     style?: { kit?, civilization?, trail?: {…}, meru?: {…}, weather?: '<climate>' | {…}, land?: { <form>: variant | many | { variant?, many? } } },
 *     civilizations?: { '<id>': { name?, anchor?, fort?, town?: {…}, castle?: {…}, builds?,
 *                                 technology?: { finish?, blocks?, things?, vehicles?, structures?, weapons? } } },
 *     levels: { '<id>': {
 *       name?, seed?,                     // the seed derives from the world's and the level's id unless named
 *       style?: { … },                    // the level's overrides, the style's shape
 *       walk: { layout?, root?, nodes, edges?, spawn? },   // the level graph (level/graph.js) less its kit and seed
 *       ground?: { cell?, tune?, edits? },   // the level's ground on a top-down grid of cells (level/ground.js)
 *       places?: { town?: true | { civilization?, … }, castle?: true | false | { civilization?, … } },
 *       building?: { use, seed?, rooms?, add?, kit? | geocube?, goal?, from?, civilization? } | { ref, goal? },
 *                                         // in place of `walk`: the level is a building (era/programs.js), laid by its
 *                                         // civilization's language, entered at its way in, played to its goal room
       city?: { grammar?, board?, sites?, segments?, cars?, …, civilization?, from?, to? },
                                         // in place of `walk`: the level is a planned city (city/plan/) in its
                                         // civilization's language, painted by the level's geocube, played by its
                                         // segments from `from` (the core's) to `to` (the farthest): a line of them
                                         // along the way in a linear world, all of them joined at their portals in a map
       roadway?: { form?: 'circuit' | 'stage', course?, dress?, kit?: true | '<kit id>', scape?: true | { set?, seed?, landmark?, surrounds? } },
                                         // in place of `walk`: the level is a roadway built for driving (roads/track.js)
                                         // — a lap or a stage, by preset name or course spec, on its own ground; a
                                         // race on it reads its contract (its checkpoints, grid and racing line)
 *     } },
 *     links?: [ { from, to, kind?: 'road' | 'gate' } ],
 *     start?: '<level id>',
 *     characters?: { direction, hero? },  // the character book (characters.js)
 *     equipment?: { classes? },           // the gear classes, seeded by the hero's adornment (equipment.js)
 *     mechanics?: { stats?, scale?, hud?, ui?, gear? },   // the game's systems, numbered from the actions (mechanics.js)
 *     mode?, review?, brief?,             // the workflow's: gated or autonomous, the creator's verdicts, the prompt
 *     made?,                              // what a run made, and the prints it made it from (made.js; the runner writes it)
 *     quick?,                             // a quick game: one level, one goal, any hero or none (quick.js)
 *     front?,                             // the game's title over a cover, start menu, credits, end (game/play-front.js),
 *                                         // carried whole onto the game the run makes
 *     intent?: { from?, cube?, why? },    // what game it is, as a cosmos cube (intent.js): what the levels are laid for
 *   }
 *
 * `resolveLevel(world, id)` answers the level recipe `layLevel` reads, the town's recipe (its castle in it), the
 * level's whole style, who built what, and its ledger. Pure: the same world resolves the same levels.
 */
import { STAGE_KITS, resolveKitId, stageKit } from '../era/stage.js';
import { readScenes } from '../playscape/ui/scenes.js';
import { readStory, readGameQuests } from './story.js';
import { readOutTrail } from '../era/out-trail.js';
import { readLocalMeru } from '../local-meru/plan.js';
import { readTownPlan } from '../era/out-town.js';
import { readCastlePlan } from '../era/out-castle.js';
import { readLevel } from '../level/graph.js';
import { LAND_FORMS, LAND_FORM_IDS } from '../era/out-land.js';
import { tunnelBuilding } from './tunnel-buildings.js';
import { tunnelTech } from './tunnel-tech.js';
import { craftTech } from './tech-crafter.js';
import { readTechDirection, USES_BY_LIST } from './tech-direction.js';
import { INTEREST } from '../playscape/objects/laws.js';
import { composeLook } from './tunnel-land.js';
import { readPaletteSpec, solvePalette } from '../color-theorist/solve.js';
import { paletteLook } from '../color-theorist/look.js';
import { STARTER_BLOCKS } from '../era/tech-blocks.js';
import { readBlock, FINISHES } from '../era/blocks.js';
import { readCharacters } from './characters.js';
import { readEquipment } from './equipment.js';
import { readMade } from './made.js';
import { readQuick } from './quick.js';
import { readIntent, cubeOfWorld } from './intent.js';
import { concernIds } from './concerns.js';
import { LAID, groundLays, fieldSite, boardSite, loopSite } from './lay-concerns.js';
import { levelFrame, GROUND_CELL } from '../level/ground.js';
import { sequentialOrder } from '../level/sequential.js';
import { CAMERAS } from './cameras.js';
import { readMechanics } from './mechanics.js';
import { readWeather } from '../weather/weather.js';
import { PROGRAM_IDS } from '../era/programs.js';
import { STRUCTURE_RAILS, hasStructureRails } from '../era/out-structures.js';
import { civilizationGrammar } from '../city/plan/civilization.js';
import { TRACK_FORMS } from '../roads/track.js';
import { COURSE_PRESETS } from '../roads/course.js';
import { SETS, TRACK_BLOCKS } from '../roads/set-pieces.js';
import { LANDS, SETTLEMENTS } from '../roads/surrounds.js';
import { readFront } from '../game/play-front.js';

/** The style: the ground, and who builds on it unless a place says otherwise. */
export const WORLD_STYLE = Object.freeze({
  kit: 'the stage kit its open ground is drawn in: palette, tiles, light, flora',
  civilization: 'the civilization that builds where no other is named',
  trail: 'the ground\'s character on a trail: run, heartbeat, bumpiness',
  meru: 'how a climb is built: its preset',
  land: `the land's forms, each a variant and a step from little to many (${LAND_FORM_IDS.join(', ')}); the kit's own where left out`,
  weather: 'the sky: a climate\'s name or { climate, dwell?, blend?, start?, surface? }; a level or section may name its own',
  geocube: 'a geocube that paints the level once: its look on every section naming no kit; the level\'s keys win',
  terrain: 'which of the geocube\'s terrains (its heartbeat\'s when left out, else the cube\'s own)',
  look: 'the look in words ("a grounded frontier of rust plains…", or { intent, seed? }): tunnelled from the kit, the ground drawn in it',
  pixel: 'the pixel look: true (4) or 2 to 8 screen pixels a drawn one',
  // (a spec recolours the kit or the look, and skins the game's HUD; false keeps the kit's own: color-theorist/)
  palette: 'pick_palette\'s spec, or false',
});
/** A civilization: what it builds, and how. */
export const CIVILIZATION = Object.freeze({
  name: 'what it is called',
  anchor: 'its building language (an anchor structure, or its elements); the kit\'s own when left out',
  fort: 'the fortification its castles raise (crenellated, battered, or its elements)',
  town: 'how it lays out a town: length, sway, branches, levels, back, farms, heartbeat, secondary',
  castle: 'how it raises a castle: size, wards, rise',
  builds: 'what it builds, in words ("a modular sci-fi habitat", or { intent, seed? }): tunnelled through its blocks into its building language, from its anchor when one is named',
  technology: 'its technology: { finish?, blocks?: { <id>: block }, direction?, things?, vehicles?, structures?, weapons? }, each list a { <id>: words | { intent, seed?, rank?, use? } }: its machines (things) tunnelled, its vehicles, tech-structures and weapons crafted, each into a block its library keeps; direction (tech-direction.js) the style, motif, elements, tone and team colour they share',
});
const GROUPS = Object.freeze({
  trail: ['run', 'heartbeat', 'bumpiness'],
  meru: ['preset'],
  town: ['length', 'sway', 'branches', 'levels', 'back', 'farms', 'heartbeat', 'secondary'],
  castle: ['size', 'wards', 'rise'],
});
// how a world's levels join in play (cosmos space.topology); absent: a line, each level after the one before it
export const TOPOLOGIES = Object.freeze({
  linear: 'a line: each level opens when the one before it is beaten, picked from the list',
  interconnected: 'a map: every link runs both ways, a level is left by one of its exits and the game travels on; a link can be locked by a key found in another level',
});
export const LINK_KINDS = Object.freeze({ road: 'the walk goes on: the next level starts where this one leaves', gate: 'a door between them: a portal, a stair down, a boat' });
/** Not on the ground and not built yet: named so a world can say it, left open (none today). */
export const RESERVED = Object.freeze([]);
/** The slots a world's bible names open while the world leaves them out: its characters and its systems. */
export const OPEN_SLOTS = Object.freeze(['characters', 'mechanics', ...RESERVED]);
/** What a civilization's technology lists: its machines (the technology tunnel), then what the crafter makes, by kind. */
export const CRAFTED = Object.freeze({ vehicles: 'vehicle', structures: 'structure', weapons: 'weapon' });
const TECH_LISTS = ['things', ...Object.keys(CRAFTED)];
/** The civilization a world without any keeps: the kit's own language, crenellated. */
export const NATIVE = 'native';

const ID = /^[a-z][a-z0-9-]{0,47}$/;
// mode, review and brief are the workflow's (review.js, compose.js): read there, carried here
const KEYS = ['id', 'name', 'seed', 'mode', 'review', 'brief', 'made', 'quick', 'intent', 'camera', 'topology', 'style', 'civilizations', 'levels', 'links', 'start', 'characters', 'equipment', 'mechanics', 'story', 'quests', 'front', ...RESERVED];
const LEVEL_KEYS = ['name', 'seed', 'style', 'walk', 'ground', 'places', 'scenes', 'building', 'city', 'roadway'];
// a roadway level (roads/track.js): a lap or a stage, its course (a preset's name or a spec), the land dressed, and its
// kit (roads/track-kit.js): true, the world's (or the level's) look; a kit's id; a look in words ({ look }); absent,
// the roadway's own tiles; and
// its scape (roads/trackscape-dress.js): true, or { set?: 'gt' | 'kart', seed?, landmark?, surrounds? }, the track dressed
// where a driver looks (its surrounds: the land beyond the venue, roads/surrounds.js)
const ROADWAY_LEVEL_KEYS = ['form', 'course', 'dress', 'kit', 'scape'];
// a city level (city/plan/): the plan's own settings, who builds it, and the segments it is entered at and left from
const CITY_LEVEL_KEYS = ['grammar', 'seed', 'board', 'spine', 'districts', 'sites', 'transit', 'lots', 'segments', 'cars', 'play', 'look', 'paint', 'civilization', 'from', 'to'];
const BUILDING_KEYS = ['use', 'seed', 'rooms', 'add', 'kit', 'geocube', 'goal', 'from', 'civilization', 'ref'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A level's seed from its world's and its own id: FNV-1a, folded to 1…9973. */
export function levelSeed(worldSeed, id) {
  let h = 2166136261;
  for (const c of `${worldSeed}:${id}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 9973) + 1;
}

const group = (k, v, at) => {
  if (!isObj(v)) throw new Error(`gameworld: ${at} is { ${GROUPS[k].join(', ')} }`);
  for (const g of Object.keys(v)) if (!GROUPS[k].includes(g)) throw new Error(`gameworld: ${at}.${g} is not a ${k} setting a world hands down (${GROUPS[k].join(', ')})`);
  return { ...v };
};
// a style (the world's or a level's)
function readStyle(s, at) {
  if (s === undefined) return {};
  if (!isObj(s)) throw new Error(`gameworld: ${at} is { ${Object.keys(WORLD_STYLE).join(', ')} }`);
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (!WORLD_STYLE[k]) throw new Error(`gameworld: ${at}.${k} is not part of the style (${Object.keys(WORLD_STYLE).join(', ')})${CIVILIZATION[k] ? `; ${k} belongs to a civilization` : ''}`);
    if (k === 'kit') {
      const id = resolveKitId(v);
      if (!stageKit(id) || !stageKit(id).shell) throw new Error(`gameworld: ${at}.kit '${v}' is not an outdoor stage kit (${Object.keys(STAGE_KITS).filter((x) => STAGE_KITS[x].shell).join(', ')})`);
      out.kit = id;
    } else if (k === 'land') out.land = readLand(v, `${at}.land`);
    else if (k === 'weather') { try { out.weather = readWeather(v, `${at}.weather`); } catch (e) { throw new Error(`gameworld: ${e.message}`); } }
    else if (k === 'look') out.look = intentOf(v, `${at}.look`);
    else if (k === 'palette') { try { out.palette = readPaletteSpec(v, `${at}.palette`); } catch (e) { throw new Error(`gameworld: ${e.message}`); } }
    else if (k === 'pixel') { if (!(v === true || (Number.isInteger(v) && v >= 2 && v <= 8))) throw new Error(`gameworld: ${at}.pixel is true or 2 to 8`); out.pixel = v === true ? 4 : v; }
    else if (GROUPS[k]) out[k] = group(k, v, `${at}.${k}`);
    else out[k] = v;
  }
  return out;
}
// the land: each form a variant, a step from little to many (0…1), or both
function readLand(v, at) {
  if (!isObj(v)) throw new Error(`gameworld: ${at} is { ${LAND_FORM_IDS.join(', ')} }`);
  const out = {};
  for (const [f, x] of Object.entries(v)) {
    if (!LAND_FORMS[f]) throw new Error(`gameworld: ${at}.${f} is not a land form (${LAND_FORM_IDS.join(', ')})`);
    const o = typeof x === 'string' ? { variant: x } : typeof x === 'number' ? { many: x } : isObj(x) ? { ...x } : null;
    if (!o) throw new Error(`gameworld: ${at}.${f} is a variant, a step from little to many (0…1), or { variant, many }`);
    for (const k of Object.keys(o)) if (!['variant', 'many'].includes(k)) throw new Error(`gameworld: ${at}.${f}.${k} is not a land setting (variant, many)`);
    if (o.variant !== undefined && !LAND_FORMS[f].variants[o.variant]) throw new Error(`gameworld: ${at}.${f}.variant '${o.variant}' is not a ${f} (${Object.keys(LAND_FORMS[f].variants).join(', ')})`);
    if (o.many !== undefined && !(typeof o.many === 'number' && o.many >= 0 && o.many <= 1)) throw new Error(`gameworld: ${at}.${f}.many is a step from little (0) to many (1)`);
    out[f] = o;
  }
  return out;
}
// a civilization
function readCivilization(c, at) {
  if (!isObj(c)) throw new Error(`gameworld: ${at} is { ${Object.keys(CIVILIZATION).join(', ')} }`);
  const out = { fort: 'crenellated' };
  for (const [k, v] of Object.entries(c)) {
    if (!CIVILIZATION[k]) throw new Error(`gameworld: ${at}.${k} is not part of a civilization (${Object.keys(CIVILIZATION).join(', ')})${k === 'characters' || k === 'people' ? '; its people are left open for now' : ''}`);
    out[k] = GROUPS[k] ? group(k, v, `${at}.${k}`) : v;
  }
  if (out.builds !== undefined) out.builds = intentOf(out.builds, `${at}.builds`);
  if (out.technology !== undefined) {
    const T = out.technology;
    if (!isObj(T)) throw new Error(`gameworld: ${at}.technology is { finish?, blocks?, direction?, ${TECH_LISTS.join('?, ')}? }`);
    for (const k of Object.keys(T)) if (!['finish', 'blocks', 'direction', ...TECH_LISTS].includes(k)) throw new Error(`gameworld: ${at}.technology.${k} is not a technology setting (finish, blocks, direction, ${TECH_LISTS.join(', ')})`);
    if (T.finish !== undefined && !FINISHES[T.finish]) throw new Error(`gameworld: ${at}.technology.finish '${T.finish}' is not a finish (${Object.keys(FINISHES).join(', ')})`);
    if (T.blocks !== undefined && !isObj(T.blocks)) throw new Error(`gameworld: ${at}.technology.blocks is { <id>: block }`);
    // every list is { <id>: words }: one library, so a crafted thing's id names it alone (things keep their old
    // standing: one may share a block's id and stand in for it)
    const named = new Map(Object.keys(T.blocks ?? {}).map((id) => [id, 'blocks']));
    const list = (k) => Object.fromEntries(Object.entries(T[k] ?? {}).map(([id, v]) => {
      if (!ID.test(id)) throw new Error(`gameworld: ${at}.technology.${k} '${id}': an id is a short lower-case name`);
      if (named.has(id) && (k !== 'things' || named.get(id) !== 'blocks')) throw new Error(`gameworld: ${at}.technology.${k} '${id}' is already named in ${named.get(id)}: an id names one thing in the civilization's library`);
      named.set(id, k);
      // a crafted thing may say how much it matters (its interest rank) and how it is met (its use); a machine is
      // words, as it always was
      if (k !== 'things' && isObj(v) && (v.rank !== undefined || v.use !== undefined)) {
        if (v.rank !== undefined && !INTEREST[v.rank]) throw new Error(`gameworld: ${at}.technology.${k}.${id}.rank '${v.rank}' is not an interest rank (${Object.keys(INTEREST).join(', ')})`);
        if (v.use !== undefined && !USES_BY_LIST[k].includes(v.use)) throw new Error(`gameworld: ${at}.technology.${k}.${id}.use '${v.use}' is not a use for its ${k} (${USES_BY_LIST[k].join(', ')})`);
        const { rank, use, ...rest } = v;
        return [id, { ...intentOf(rest, `${at}.technology.${k}.${id}`), ...(rank !== undefined ? { rank } : {}), ...(use !== undefined ? { use } : {}) }];
      }
      return [id, intentOf(v, `${at}.technology.${k}.${id}`)];
    }));
    for (const k of TECH_LISTS) if (T[k] !== undefined && !isObj(T[k])) throw new Error(`gameworld: ${at}.technology.${k} is { <id>: words | { intent, seed? } }`);
    out.technology = { finish: T.finish ?? 'alloy', blocks: { ...(T.blocks ?? {}) }, things: list('things'), ...Object.fromEntries(Object.keys(CRAFTED).filter((k) => T[k] !== undefined).map((k) => [k, list(k)])), ...(T.direction !== undefined ? { direction: readTechDirection(T.direction, `${at}.technology.direction`) } : {}) };
  }
  return out;
}
const intentOf = (v, at) => {
  const o = typeof v === 'string' ? { intent: v } : isObj(v) ? { ...v } : null;
  if (!o || typeof o.intent !== 'string' || !o.intent.trim()) throw new Error(`gameworld: ${at} is a few words, or { intent, seed? }`);
  for (const k of Object.keys(o)) if (!['intent', 'seed'].includes(k)) throw new Error(`gameworld: ${at}.${k} is not an intent setting (intent, seed)`);
  return o;
};
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').filter((w) => !['a', 'an', 'the', 'of', 'and', 'with'].includes(w)).slice(0, 4).join('-');
// the tunnels a world reads run once per what they are given: the same words, seed and blocks tunnel the same way
const TUNNELS = new Map();
const once = (key, fn) => { if (!TUNNELS.has(key)) { if (TUNNELS.size > 256) TUNNELS.clear(); TUNNELS.set(key, fn()); } return TUNNELS.get(key); };
/** A look from words, on a base kit: the kit id it registers under, and what its tunnel did. */
const lookFor = (look, base, seed, name) => {
  const L = once(JSON.stringify(['l', look, base, seed, name]), () => composeLook(look.intent, { seed: look.seed ?? seed, base, name }));
  composedFrom(L.id, base, { look: look.intent, seed: look.seed ?? seed, base, name });
  return { kit: L.id, look: { ...look, base: L.base, id: L.id, tunnel: logOf(L.record) } };
};
/** A palette on a kit (color-theorist/look.js): the kit id the recoloured look registers under, and what it read. */
const paletteFor = (spec, base, name) => {
  // a nature or jungle kit is painted by its card, not by ramps: its kit stays, and its stages carry the palette
  // (levels.js; color-theorist/recolour.js)
  if (['nature', 'jungle'].includes(stageKit(base)?.shell)) {
    const K = solvePalette(spec === 'auto' ? {} : spec);
    return { colours: { palette: K.id, base, scheme: K.read.scheme, key: K.read.key, painted: true } };
  }
  const P = once(JSON.stringify(['p', spec, base, name]), () => {
    try { return paletteLook(spec === 'auto' ? {} : spec, { base, name }); } catch (e) { throw new Error(`gameworld: ${e.message}`); }
  });
  composedFrom(P.id, base, { palette: spec === 'auto' ? {} : spec, base, name });
  return { kit: P.id, colours: { palette: P.contract.id, look: P.id, base: P.base, scheme: P.contract.read.scheme, key: P.contract.read.key, laws: P.laws.filter((l) => !l.ok).map((l) => l.law), tweaks: P.tweaks } };
};
// THE RECIPES of the looks a world composed, by the kit id each registers under: a stored stage names its kit by id, and
// the look registry is the process's own, so a stage drawn in a composed look (from words, a palette, or both) carries
// the chain that composes its kit again (`looks`, read by the scene: color-theorist/look.js ensureLooks).
// Content-addressed like the registry.
const COMPOSED = new Map();
function composedFrom(id, base, recipe) { if (!COMPOSED.has(id)) COMPOSED.set(id, [...(COMPOSED.get(base) ?? []), { id, ...recipe }]); }
/** The recipes that compose a kit id, base first, when the world composed it (else null: a written kit). */
export const looksOfKit = (id) => COMPOSED.get(id) ?? null;
/** What a tunnel did, for the bible and the graph: the traits it read, its passes, its gaps. */
const logOf = (r) => ({ intent: r.intent, seed: r.seed, traits: r.read.traits.map((t) => t.id), unread: r.read.unread, passes: r.passes.length, tweaks: r.passes.flatMap((p) => p.changed ?? []), gaps: r.gaps.map(({ trait, why, proposal }) => ({ trait, why, proposal })), held: r.held, complete: r.complete });
// a civilization's tunnels: its building language from its words, its things from theirs, in its library
/** A civilization's library: the starter blocks, then its own (each named by its key), checked against the rest. */
export function civLibrary(C) {
  const library = { ...STARTER_BLOCKS };
  for (const [id, B] of Object.entries(C.technology?.blocks ?? {})) { library[id] = { ...B, id }; readBlock(library[id], library); }
  return library;
}
function tunnelCivilization(C, cid, kit, seed) {
  const out = { ...C }, library = civLibrary(C);
  if (C.builds) {
    const b = C.builds, r = once(JSON.stringify(['b', b, C.anchor ?? null, kit, Object.keys(library)]), () => tunnelBuilding(b.intent, { seed: b.seed ?? seed, base: C.anchor, kitId: kit, library }));
    if (C.anchor !== undefined) out.from = C.anchor;
    // the language the tunnel made: named and read by its words, no longer the seed it may have started from
    const { seeded: _s, ...anchor } = r.plan.anchor;
    out.anchor = { ...anchor, id: slugOf(b.intent) || `${cid}-language`, read: `${b.intent}: ${r.plan.read}` };
    out.fittings = r.plan.mounts;
    out.tunnel = logOf(r);
  }
  if (C.technology) {
    const things = {};
    for (const [id, t] of Object.entries(C.technology.things)) {
      const r = once(JSON.stringify(['t', id, t, Object.keys(library)]), () => tunnelTech(t.intent, { seed: t.seed ?? seed, id, library }));
      things[id] = { ...t, block: r.plan.block, tunnel: logOf(r) };
      library[id] = r.plan.block;
    }
    out.technology = { ...C.technology, things };
    // what the crafter makes: each in its kind's grammar, kept in the same library
    for (const [list, kind] of Object.entries(CRAFTED)) {
      if (!C.technology[list]) continue;
      const made = {};
      for (const [id, t] of Object.entries(C.technology[list])) {
        const r = once(JSON.stringify(['c', kind, id, t, Object.keys(library)]), () => craftTech(kind, t.intent, { seed: t.seed ?? seed, id, library }));
        const { block, form, variant, dials, carries } = r.plan;
        made[id] = { ...t, block, form, variant, dials, ...(carries ? { carries } : {}), tunnel: logOf(r) };
        library[id] = block;
      }
      out.technology[list] = made;
    }
  }
  return out;
}
// one style laid over another: the scalars replaced, the groups merged key by key
const over = (base, top) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(top)) out[k] = k === 'land' ? Object.fromEntries([...new Set([...Object.keys(base.land || {}), ...Object.keys(v)])].map((f) => [f, { ...(base.land?.[f] || {}), ...(v[f] || {}) }])) : GROUPS[k] ? { ...(base[k] || {}), ...v } : v;
  return out;
};
// what `top` changes of `base`, as ledger entries
function differences(base, top, scope, at) {
  const out = [];
  for (const [k, v] of Object.entries(top)) {
    if (k === 'land') { for (const [f, o] of Object.entries(v)) for (const [g, w] of Object.entries(o)) if (!same(base.land?.[f]?.[g], w)) out.push({ scope, at, key: `land.${f}.${g}`, world: base.land?.[f]?.[g] ?? null, local: w }); }
    else if (GROUPS[k]) { for (const [g, w] of Object.entries(v)) if (!same(base[k]?.[g], w)) out.push({ scope, at, key: `${k}.${g}`, world: base[k]?.[g] ?? null, local: w }); }
    else if (!same(base[k], v)) out.push({ scope, at, key: k, world: base[k] ?? null, local: v });
  }
  return out;
}

/** Read a gameworld and say what is wrong. → { id, name, seed, style, civilizations, civIds, levels, ids, links, start }. */
const READ = Symbol('read gameworld');
export function readGameworld(W) {
  if (W && W[READ]) return W;
  if (!isObj(W)) throw new Error('gameworld: a world is { id, name?, seed?, style?, civilizations?, levels, links?, start? }');
  for (const k of Object.keys(W)) if (!KEYS.includes(k)) throw new Error(`gameworld: '${k}' is not a world setting (settings: ${KEYS.join(', ')})`);
  for (const k of RESERVED) if (W[k] !== undefined && W[k] !== null) throw new Error(`gameworld: ${k} are not on the ground: the world leaves them open for now (null, or leave it out)`);
  if (typeof W.id !== 'string' || !ID.test(W.id)) throw new Error('gameworld: id is a short lower-case name (letters, digits, hyphens)');
  if (W.seed !== undefined && !Number.isFinite(W.seed)) throw new Error('gameworld: seed is a number');
  const seed = W.seed ?? 1;
  if (W.topology !== undefined && !TOPOLOGIES[W.topology]) throw new Error(`gameworld: topology is one of ${Object.entries(TOPOLOGIES).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  if (W.camera !== undefined && !CAMERAS[W.camera]) throw new Error(`gameworld: camera is one of ${Object.entries(CAMERAS).map(([k, v]) => `${k} (${v})`).join('; ')}`);

  // CIVILIZATIONS: as many as the world keeps; the kit's own when it keeps none
  if (W.civilizations !== undefined && (!isObj(W.civilizations) || !Object.keys(W.civilizations).length)) throw new Error('gameworld: civilizations is { <id>: { name?, anchor?, fort?, town?, castle?, builds?, technology? } }, at least one (or leave it out)');
  const civilizations = {}, civIds = Object.keys(W.civilizations ?? { [NATIVE]: {} });
  for (const id of civIds) {
    if (!ID.test(id)) throw new Error(`gameworld: civilization '${id}': an id is a short lower-case name (letters, digits, hyphens)`);
    civilizations[id] = { name: id, ...readCivilization((W.civilizations ?? { [NATIVE]: { name: 'the kit\'s own' } })[id], `civilizations.${id}`) };
  }
  const civ = (v, at) => { if (!civilizations[v]) throw new Error(`gameworld: ${at} '${v}' is not a civilization (civilizations: ${civIds.join(', ')})`); return v; };

  const style = { kit: 'isekai-meadow', civilization: civIds[0], ...readStyle(W.style, 'style') };
  civ(style.civilization, 'style.civilization');
  // a look in words is tunnelled from the kit it names (or the meadow) into a look of its own, drawn as a kit is
  if (style.look) Object.assign(style, lookFor(style.look, style.kit, seed, W.id));
  // a palette recolours the kit the world is drawn in (or the look its words composed): the stock kit is its start
  if (style.palette) Object.assign(style, paletteFor(style.palette, style.kit, W.id));
  // what a civilization says in words is tunnelled through its blocks, on the world's kit
  for (const id of civIds) if (civilizations[id].builds || civilizations[id].technology) civilizations[id] = tunnelCivilization(civilizations[id], id, style.kit, seed);
  if (!isObj(W.levels) || !Object.keys(W.levels).length) throw new Error('gameworld: levels is { <id>: { walk, … } }, at least one');
  const ids = Object.keys(W.levels), levels = {}, sceneSets = {};
  for (const id of ids) {
    const L = W.levels[id], at = `levels.${id}`;
    if (!ID.test(id)) throw new Error(`gameworld: level '${id}': an id is a short lower-case name (letters, digits, hyphens)`);
    if (!isObj(L)) throw new Error(`gameworld: ${at} is { ${LEVEL_KEYS.join(', ')} }`);
    for (const k of Object.keys(L)) if (!LEVEL_KEYS.includes(k)) throw new Error(`gameworld: ${at}.${k} is not a level setting (settings: ${LEVEL_KEYS.join(', ')})`);
    if (L.roadway !== undefined) {
      // a roadway level: a track built for driving (roads/track.js), laid on its own ground
      if (L.walk !== undefined || L.building !== undefined || L.city !== undefined) throw new Error(`gameworld: ${at}: a level is a walk, a building, a city or a roadway, one of them`);
      if (L.places !== undefined || L.ground !== undefined) throw new Error(`gameworld: ${at}: a roadway lays its own ground and holds no town`);
      const Rw = L.roadway;
      if (!isObj(Rw)) throw new Error(`gameworld: ${at}.roadway is { ${ROADWAY_LEVEL_KEYS.join(', ')} } (every one optional)`);
      for (const k of Object.keys(Rw)) if (!ROADWAY_LEVEL_KEYS.includes(k)) throw new Error(`gameworld: ${at}.roadway.${k} is not a roadway level setting (${ROADWAY_LEVEL_KEYS.join(', ')})`);
      if (Rw.form !== undefined && !TRACK_FORMS.includes(Rw.form)) throw new Error(`gameworld: ${at}.roadway.form is ${TRACK_FORMS.join(' or ')} (a lap, or end to end)`);
      if (Rw.course !== undefined && !(isObj(Rw.course) || COURSE_PRESETS[Rw.course])) throw new Error(`gameworld: ${at}.roadway.course is a preset (${Object.keys(COURSE_PRESETS).join(', ')}) or a course spec ({ pis, … } or { class, length, … })`);
      if (Rw.dress !== undefined && Rw.dress !== true && Rw.dress !== false && !isObj(Rw.dress)) throw new Error(`gameworld: ${at}.roadway.dress is true, false or { trees?, rocks?, clear? }`);
      if (Rw.kit !== undefined && Rw.kit !== true && Rw.kit !== false && typeof Rw.kit !== 'string' && !(isObj(Rw.kit) && typeof Rw.kit.look === 'string')) throw new Error(`gameworld: ${at}.roadway.kit is true (the world's look), a kit's id, or a look in words ({ look })`);
      const SU = Rw.scape?.surrounds, okSurrounds = SU === undefined || SU === true || SU === false || (isObj(SU) && Object.keys(SU).every((k) => ['land', 'settlement', 'seed'].includes(k)) && (SU.land === undefined || LANDS[SU.land]) && (SU.settlement === undefined || SETTLEMENTS.includes(SU.settlement)));
      if (Rw.scape !== undefined && Rw.scape !== true && Rw.scape !== false && !(isObj(Rw.scape) && Object.keys(Rw.scape).every((k) => ['set', 'seed', 'landmark', 'surrounds'].includes(k)) && (Rw.scape.set === undefined || SETS[Rw.scape.set]) && (Rw.scape.landmark === undefined || TRACK_BLOCKS[Rw.scape.landmark]) && okSurrounds)) throw new Error(`gameworld: ${at}.roadway.scape is true or { set?: ${Object.keys(SETS).join(' | ')}, seed?, landmark?, surrounds?: false | { land?: ${Object.keys(LANDS).join(' | ')}, settlement?: ${SETTLEMENTS.join(' | ')}, seed? } }`);
    } else if (L.city !== undefined) {
      // a city level: a planned city (city/plan/), built in its civilization's language, played by its segments
      if (L.walk !== undefined || L.building !== undefined) throw new Error(`gameworld: ${at}: a level is a walk, a building or a city, one of them`);
      if (L.places !== undefined) throw new Error(`gameworld: ${at}.places: a city level holds its own buildings (a town stands on a walk)`);
      const Cy = L.city;
      if (!isObj(Cy)) throw new Error(`gameworld: ${at}.city is { ${CITY_LEVEL_KEYS.join(', ')} } (every one optional)`);
      for (const k of Object.keys(Cy)) if (!CITY_LEVEL_KEYS.includes(k)) throw new Error(`gameworld: ${at}.city.${k} is not a city level setting (${CITY_LEVEL_KEYS.join(', ')})`);
      if (Cy.civilization !== undefined) civ(Cy.civilization, `${at}.city.civilization`);
      for (const k of ['from', 'to']) if (Cy[k] !== undefined && typeof Cy[k] !== 'string') throw new Error(`gameworld: ${at}.city.${k} names a segment ('r1c2': the city book's Segments sheet), where the level is ${k === 'from' ? 'entered' : 'left'}`);
      // the plan itself is held to the city card where it is laid (levels.js cityStages)
    } else if (L.building !== undefined) {
      // a building level: its rooms laid from a use (or a building already made, by ref), in place of a walk
      if (L.walk !== undefined) throw new Error(`gameworld: ${at}: a level is a walk or a building, not both`);
      if (L.places !== undefined) throw new Error(`gameworld: ${at}.places: a building level holds no town (a town stands on a walk)`);
      const B = L.building;
      if (!isObj(B)) throw new Error(`gameworld: ${at}.building is { use, seed?, rooms?, add?, kit? | geocube?, goal?, civilization? } or { ref, goal? }`);
      for (const k of Object.keys(B)) if (!BUILDING_KEYS.includes(k)) throw new Error(`gameworld: ${at}.building.${k} is not a building setting (${BUILDING_KEYS.join(', ')})`);
      if ((B.ref === undefined) === (B.use === undefined)) throw new Error(`gameworld: ${at}.building names a use (${PROGRAM_IDS.join(', ')}) or the ref of a building already made, one of them`);
      if (B.ref !== undefined && typeof B.ref !== 'string') throw new Error(`gameworld: ${at}.building.ref is a sketch ref`);
      if (B.ref !== undefined && Object.keys(B).some((k) => !['ref', 'goal'].includes(k))) throw new Error(`gameworld: ${at}.building: a building by ref is played as it was made (ref, goal?)`);
      if (B.use !== undefined && !PROGRAM_IDS.includes(B.use)) throw new Error(`gameworld: ${at}.building.use '${B.use}' is not one (${PROGRAM_IDS.join(', ')})`);
      if (B.kit !== undefined && B.geocube !== undefined) throw new Error(`gameworld: ${at}.building: a kit or a geocube dresses it, not both`);
      if (B.kit !== undefined && !(STAGE_KITS[resolveKitId(B.kit)]?.grid)) throw new Error(`gameworld: ${at}.building.kit '${B.kit}' is not a room kit (${Object.keys(STAGE_KITS).filter((x) => STAGE_KITS[x].grid).join(', ')})`);
      if (B.civilization !== undefined) civ(B.civilization, `${at}.building.civilization`);
    } else {
      if (!isObj(L.walk)) throw new Error(`gameworld: ${at}.walk is the level's graph { nodes, edges?, … } (or a building: ${at}.building)`);
      for (const k of ['kit', 'seed']) if (L.walk[k] !== undefined) throw new Error(`gameworld: ${at}.walk.${k}: a level's ${k} is its own (${k === 'kit' ? `${at}.style.kit` : `${at}.seed`}), handed to its sections`);
    }
    if (L.seed !== undefined && !Number.isFinite(L.seed)) throw new Error(`gameworld: ${at}.seed is a number`);
    const st = readStyle(L.style, `${at}.style`);
    if (st.look) Object.assign(st, lookFor(st.look, st.kit ?? style.kit, seed, `${W.id}-${id}`));
    if (st.palette) Object.assign(st, paletteFor(st.palette, st.kit ?? style.kit, `${W.id}-${id}`));
    if (st.civilization !== undefined) civ(st.civilization, `${at}.style.civilization`);
    if (L.places !== undefined) {
      if (!isObj(L.places)) throw new Error(`gameworld: ${at}.places is { town?, castle?, buildings? }`);
      for (const k of Object.keys(L.places)) {
        if (!['town', 'castle', 'buildings', 'street'].includes(k)) throw new Error(`gameworld: ${at}.places.${k} is not a place (town, castle, buildings, street)`);
        if (k === 'street') {
          // the town's street on the walk (era/stage-buildings.js): its first houses standing beside the trail
          const St = L.places.street;
          if (St !== true && !isObj(St)) throw new Error(`gameworld: ${at}.places.street is true or { houses?, enter?, goal? }`);
          if (isObj(St)) for (const kk of Object.keys(St)) if (!['houses', 'enter', 'goal', 'doors'].includes(kk)) throw new Error(`gameworld: ${at}.places.street.${kk} is not a street setting (houses, enter, goal, doors)`);
          if (isObj(St) && St.houses !== undefined && !(Number.isInteger(St.houses) && St.houses >= 1 && St.houses <= 12)) throw new Error(`gameworld: ${at}.places.street.houses is 1 to 12`);
          if (isObj(St) && St.enter !== undefined && !(Number.isInteger(St.enter) && St.enter >= 0 && St.enter <= 4)) throw new Error(`gameworld: ${at}.places.street.enter is 0 to 4 (the houses walked into)`);
          if (!L.places.town) throw new Error(`gameworld: ${at}.places.street is the town's street: give the level its town (places.town)`);
          continue;
        }
        if (k === 'buildings') {
          // buildings walked into as terrain (era/stage-buildings.js), each standing in a pocket of the walk
          const Bs = L.places.buildings;
          if (!Array.isArray(Bs) || !Bs.length) throw new Error(`gameworld: ${at}.places.buildings is [{ use, seed?, at?, node?, goal?, civilization?, kit? }], at least one`);
          Bs.forEach((b, i) => {
            if (!isObj(b) || !PROGRAM_IDS.includes(b.use)) throw new Error(`gameworld: ${at}.places.buildings[${i}].use is one of ${PROGRAM_IDS.join(', ')}`);
            for (const kk of Object.keys(b)) if (!['use', 'seed', 'at', 'node', 'goal', 'enter', 'civilization', 'kit', 'id', 'rooms', 'add'].includes(kk)) throw new Error(`gameworld: ${at}.places.buildings[${i}].${kk} is not a building setting`);
            if (b.enter !== undefined && !['walk', 'door'].includes(b.enter)) throw new Error(`gameworld: ${at}.places.buildings[${i}].enter is 'walk' (walked into as terrain) or 'door' (the scene changes at its door)`);
            if (b.node !== undefined && !L.walk?.nodes?.[b.node]) throw new Error(`gameworld: ${at}.places.buildings[${i}].node '${b.node}' is not a section of the walk`);
            if (b.civilization !== undefined) civ(b.civilization, `${at}.places.buildings[${i}].civilization`);
          });
          if (Bs.filter((b) => b.goal).length > 1) throw new Error(`gameworld: ${at}.places.buildings: one building holds the level's end (goal: true), at most`);
          continue;
        }
        if (isObj(L.places[k]) && L.places[k].civilization !== undefined) civ(L.places[k].civilization, `${at}.places.${k}.civilization`);
      }
    }
    // SCENES (playscape/ui/scenes.js): a level's directed moments, kept beside the level (the level itself lays without
    // them); each plays in one of the level's stages, its first unless `stage` names another
    const { scenes: sc, ...lv } = L;
    if (sc !== undefined) {
      if (!Array.isArray(sc)) throw new Error(`gameworld: ${at}.scenes is a list of scenes (get_play_vocab({ id: 'ui-scenes' })), each with stage?: '<node>'`);
      const nodes = Object.keys(L.walk.nodes || {});
      const bare = sc.map((s, i) => {
        if (!isObj(s)) throw new Error(`gameworld: ${at}.scenes[${i}] is a scene { id, when, beats, if?, sets?, stage? }`);
        if (s.stage !== undefined && !nodes.includes(s.stage)) throw new Error(`gameworld: ${at}.scenes[${i}].stage names one of the level's stages (${nodes.join(', ')})`);
        const { stage: _, ...rest } = s;
        return rest;
      });
      try { readScenes({ scenes: bare }); } catch (e) { throw new Error(`gameworld: ${at}.${e.message.replace(/^play\./, '')}`); }
      sceneSets[id] = sc.map((s) => ({ ...s }));
    }
    levels[id] = { ...lv, style: st };
  }
  const links = (W.links ?? []).map((e, i) => {
    if (!isObj(e)) throw new Error(`gameworld: links[${i}] is { from, to, kind? }`);
    for (const k of Object.keys(e)) if (!['from', 'to', 'kind', 'key', 'keyAt'].includes(k)) throw new Error(`gameworld: links[${i}].${k} is not a link setting (from, to, kind, key, keyAt)`);
    for (const k of ['from', 'to']) if (!levels[e[k]]) throw new Error(`gameworld: links[${i}].${k} '${e[k]}' is not a level (levels: ${ids.join(', ')})`);
    if (e.from === e.to) throw new Error(`gameworld: links[${i}] leads '${e.from}' to itself`);
    const kind = e.kind ?? 'road';
    if (!LINK_KINDS[kind]) throw new Error(`gameworld: links[${i}].kind '${kind}' is not a link (${Object.keys(LINK_KINDS).join(', ')})`);
    // a KEY locks the way from `from` to `to` in a map world: an item or one of the hero's powers (levels.js tells them
    // apart), laid as a pickup in level `keyAt` (a level other
    // than `to`), carried in the bag; going back the other way is never locked
    if (e.key !== undefined || e.keyAt !== undefined) {
      if (W.topology !== 'interconnected') throw new Error(`gameworld: links[${i}].key locks a door in a map world: set topology: 'interconnected', or leave the key out`);
      if (typeof e.key !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(e.key)) throw new Error(`gameworld: links[${i}].key is one lower-case id, what opens it: an item (key, rune, lantern…) or one of the hero's powers`);
      if (!levels[e.keyAt]) throw new Error(`gameworld: links[${i}].keyAt names the level the ${e.key} is found in (levels: ${ids.join(', ')})`);
      if (e.keyAt === e.to) throw new Error(`gameworld: links[${i}].keyAt is behind its own door: lay the ${e.key} in a level reached without it`);
    }
    return { from: e.from, to: e.to, kind, ...(e.key ? { key: e.key, keyAt: e.keyAt } : {}) };
  });
  const start = W.start ?? ids[0];
  if (!levels[start]) throw new Error(`gameworld: start '${start}' is not a level (levels: ${ids.join(', ')})`);
  // the character book, the equipment and the mechanics: read here, so a world says what is wrong with them at once; kept only when present
  const characters = W.characters === undefined || W.characters === null ? null : readCharacters(W.characters);
  const equipment = W.equipment === undefined || W.equipment === null ? null : readEquipment(W.equipment);
  const mechanics = W.mechanics === undefined || W.mechanics === null ? null : readMechanics(W.mechanics);
  if (W.made !== undefined && W.made !== null) readMade(W.made);   // the runner's record: read, never carried
  if (W.quick !== undefined && W.quick !== null) readQuick(W.quick);   // a quick game's goal (quick.js): read, never carried
  // the front: its shape read here (its menu against a game of several levels; the game's own check sees the count)
  if (W.front !== undefined) { const e = readFront(W.front, { levels: 2, run: !!(isObj(W.quick) && W.quick.run), where: 'gameworld: front' }); if (e.length) throw new Error(e.join('\n')); }
  if (W.intent !== undefined) readIntent(W.intent);   // what game it is (intent.js): read here, laid by the levels
  return { id: W.id, name: W.name ?? W.id, seed, style, civilizations, civIds, levels, ids, links, start, ...(characters ? { characters } : {}), ...(equipment ? { equipment } : {}), ...(mechanics ? { mechanics } : {}), ...(W.camera ? { camera: W.camera } : {}), ...(W.topology ? { topology: W.topology } : {}), ...(W.quick ? { quick: W.quick } : {}), ...(W.front !== undefined ? { front: W.front } : {}), ...(W.intent !== undefined ? { intent: W.intent } : {}), ...(Object.keys(sceneSets).length ? { scenes: sceneSets } : {}), ...(W.story !== undefined ? { story: readStory(W.story) } : {}), ...(W.quests !== undefined ? { quests: readGameQuests(W.quests, readStory(W.story)) } : {}), [READ]: true };
}

/**
 * A level as its world hands it down: `{ id, name, seed, style, built, ledger, level, town }`. `level` is the recipe
 * `layLevel` reads; `town` the town's recipe in its civilization's language, its castle raised by its own, or null;
 * `built` who built them ({ town, castle } civilization ids); `ledger` every override, the level's and its parts'.
 */
export function resolveLevel(world, id) {
  const G = readGameworld(world);
  const L = G.levels[id];
  if (!L) throw new Error(`gameworld: '${id}' is not a level (levels: ${G.ids.join(', ')})`);
  const style = over(G.style, L.style), seed = L.seed ?? levelSeed(G.seed, id);
  const ledger = differences(G.style, L.style, 'level', id);

  // a roadway level: its course and its form (a lap unless its course runs end to end), laid by levels.js
  if (L.roadway) {
    const { course = 'kart-oval', dress, form, kit, scape } = L.roadway;
    const open = form === undefined && (course === 'rally-stage' || (isObj(course) && course.closed === false));
    // the kit: the look's words (composed again wherever the track is drawn) or the kit's id
    const drawn = kit === true ? (style.look ? { look: style.look.intent, base: style.look.base, ...(Number.isInteger(style.look.seed) ? { seed: style.look.seed } : Number.isInteger(G.seed) ? { seed: G.seed } : {}) } : style.kit) : kit || null;
    return { id, name: L.name ?? id, seed, style, built: null, ledger, level: null, town: null, roadway: { form: form ?? (open ? 'stage' : 'circuit'), course, ...(dress ? { dress } : {}), ...(drawn ? { kit: drawn } : {}), ...(scape ? { scape } : {}) } };
  }

  // a city level: its plan, built in its civilization's language (unless it names a grammar document of its own), painted
  // by the level's geocube, cut into the segments it is played by (levels.js lays them)
  if (L.city) {
    const { civilization, from, to, ...plan } = L.city, civId = civilization ?? style.civilization, C = G.civilizations[civId];
    if (civId !== style.civilization) ledger.push({ scope: 'level', at: `${id}/city`, key: 'civilization', world: style.civilization, local: civId });
    const kit = hasStructureRails(style.kit) ? style.kit : 'isekai-meadow', anchor = C.anchor ?? STRUCTURE_RAILS[kit]?.anchor ?? null;
    const grammar = isObj(plan.grammar) ? plan.grammar : civilizationGrammar(anchor, kit, seed, typeof plan.grammar === 'string' ? { base: plan.grammar } : {});
    // its buildings walked into, not entered by a door: a door's inside is not a level of this world yet
    const sg = plan.segments === undefined || plan.segments === true ? {} : plan.segments;
    const city = { ...plan, seed: plan.seed ?? seed, grammar, segments: { ...sg, enter: { walk: 2, door: 0, ...(sg.enter ?? {}) } }, ...(plan.paint === undefined && style.geocube !== undefined ? { paint: { geocube: style.geocube } } : {}) };
    return { id, name: L.name ?? id, seed, style, built: { city: civId }, ledger, level: null, town: null, city: { plan: city, civilization: civId, ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) } };
  }

  // a building level: who built it, in what language, and the program it is laid from (levels.js lays it)
  if (L.building) {
    const B = L.building, civId = B.civilization ?? style.civilization, C = G.civilizations[civId];
    if (civId !== style.civilization) ledger.push({ scope: 'level', at: `${id}/building`, key: 'civilization', world: style.civilization, local: civId });
    const anchor = C.anchor ?? STRUCTURE_RAILS[style.kit]?.anchor ?? null;
    const building = B.ref !== undefined ? { ref: B.ref, ...(B.goal !== undefined ? { goal: B.goal } : {}) }
      : { ...B, seed: B.seed ?? seed, civilization: civId, ...(anchor !== null ? { anchor } : {}) };
    return { id, name: L.name ?? id, seed, style, built: { building: civId }, ledger, level: null, town: null, building };
  }

  // the walk: each section given the ground's character first, its own recipe over it
  const nodes = {};
  for (const [nid, n] of Object.entries(L.walk.nodes || {})) {
    const section = ['trail', 'meru'].find((s) => n && n[s] !== undefined), at = `${id}/${nid}`;
    if (!section) { nodes[nid] = n; continue; }   // readLevel says what is wrong with it
    const own = n[section] === true ? {} : n[section];
    if (!isObj(own)) { nodes[nid] = n; continue; }
    const recipe = { ...(style[section] || {}), ...own };
    for (const k of Object.keys(own)) if (GROUPS[section].includes(k) && style[section]?.[k] !== undefined && !same(style[section][k], own[k])) ledger.push({ scope: 'section', at, key: `${section}.${k}`, world: style[section][k], local: own[k] });
    if (n.kit !== undefined && resolveKitId(n.kit) !== style.kit) ledger.push({ scope: 'section', at, key: 'kit', world: style.kit, local: resolveKitId(n.kit) });
    if (section === 'trail') readOutTrail(recipe); else readLocalMeru(recipe);
    nodes[nid] = { ...n, [section]: recipe };
  }
  // the sky: the level's own (the world's or its override), each section's stage takes it; a node's own is the ledger's
  // the level's own ground (level/ground.js): its grid, its dials and its edits, laid on its trails when it is laid out
  const level = { ...L.walk, kit: style.kit, seed, nodes, ...(style.weather ? { weather: style.weather } : {}), ...(L.ground !== undefined ? { ground: L.ground } : {}),
    ...(style.geocube !== undefined ? { geocube: style.geocube } : {}), ...(style.terrain !== undefined ? { terrain: style.terrain } : {}) };
  let lv = readLevel(level);
  // what game it is (intent.js): the ground laid for its concerns (lay-concerns.js), under the level's own; a world
  // whose cube lays nothing on the ground is as it was
  const ids = concernIds(cubeOfWorld(G).cube), lays = ids.some((c) => LAID[c]?.includes('ground')) ? groundLays(ids, lv, levelFrame(lv, sequentialOrder(lv), lv.ground?.cell ?? GROUND_CELL.d)) : null;
  let field = null, board = null, loop = null;
  if (lays?.laid.length) {
    const g = L.ground ?? {};
    level.ground = { ...g, ...(lays.tune ? { tune: { ...lays.tune, ...(g.tune ?? {}) } } : {}), ...(lays.edits.length ? { edits: [...(g.edits ?? []), ...lays.edits] } : {}) };
    lv = readLevel(level);
    const F2 = levelFrame(lv, sequentialOrder(lv), lv.ground?.cell ?? GROUND_CELL.d);
    if (lays.laid.includes('fields')) field = fieldSite(F2)?.centre ?? null;
    if (lays.laid.includes('board')) board = boardSite(F2)?.centre ?? null;
    if (lays.laid.includes('loop')) loop = loopSite(F2);
  }
  for (const [nid, n] of Object.entries(L.walk.nodes || {})) if (n && n.weather !== undefined && !same(lv.nodes[nid].weather, style.weather)) ledger.push({ scope: 'section', at: `${id}/${nid}`, key: 'weather', world: style.weather ?? null, local: lv.nodes[nid].weather });

  // the places: the town built by its civilization, its castle raised by its own (the town's unless named)
  let town = null, built = null;
  const P = L.places || {}, hasCastle = P.castle !== undefined && P.castle !== false;
  if (P.town || hasCastle) {
    const own = isObj(P.town) ? { ...P.town } : {}, townCiv = own.civilization ?? style.civilization, C = G.civilizations[townCiv];
    delete own.civilization;
    if (townCiv !== style.civilization) ledger.push({ scope: 'place', at: `${id}/town`, key: 'civilization', world: style.civilization, local: townCiv });
    for (const k of Object.keys(own)) if (GROUPS.town.includes(k) && C.town?.[k] !== undefined && !same(C.town[k], own[k])) ledger.push({ scope: 'place', at: `${id}/town`, key: `town.${k}`, world: C.town[k], local: own[k] });
    town = { ...(C.town || {}), ...own };
    if (C.anchor !== undefined && town.anchor === undefined) town.anchor = C.anchor;
    built = { town: townCiv, castle: null };
    if (hasCastle) {
      const c = isObj(P.castle) ? { ...P.castle } : {}, castleCiv = c.civilization ?? townCiv, K = G.civilizations[castleCiv];
      delete c.civilization;
      if (castleCiv !== townCiv) ledger.push({ scope: 'place', at: `${id}/castle`, key: 'civilization', world: townCiv, local: castleCiv });
      for (const k of Object.keys(c)) if (GROUPS.castle.includes(k) && K.castle?.[k] !== undefined && !same(K.castle[k], c[k])) ledger.push({ scope: 'place', at: `${id}/castle`, key: `castle.${k}`, world: K.castle[k], local: c[k] });
      town.castle = { fort: K.fort, ...(K.castle || {}), ...c };
      if (castleCiv !== townCiv && K.anchor !== undefined) town.castle.anchor = K.anchor;
      readCastlePlan(town.castle);
      built.castle = castleCiv;
    }
    readTownPlan(town);
  }
  // the buildings walked into: each in its builders' language (its civilization's anchor, else the kit's own)
  const buildings = (P.buildings ?? []).map((b) => {
    const C = G.civilizations[b.civilization ?? style.civilization], anchor = C.anchor ?? STRUCTURE_RAILS[style.kit]?.anchor;
    const { civilization: _c, ...rest } = b;
    return { ...rest, ...(anchor !== undefined ? { civilization: anchor } : {}) };
  });
  // the town's street on the walk: the town's recipe (its castle aside: the street is its houses), in its language
  const street = P.street && town ? (() => { const { castle: _k, anchor, ...recipe } = town, S = P.street === true ? {} : P.street; return { ...S, ...(anchor !== undefined ? { anchor } : {}), recipe }; })() : null;
  return { id, name: L.name ?? id, seed, style, built, ledger, level, town, ...(buildings.length ? { buildings } : {}), ...(street ? { street } : {}), ...(lays?.laid.length ? { laid: lays.laid, ...(field ? { field } : {}), ...(board ? { board } : {}), ...(loop ? { loop } : {}) } : {}) };
}

/** Every level of a world, resolved, in the order listed: `{ world, levels: [resolved…] }`. */
export function resolveWorld(world) {
  const G = readGameworld(world);
  return { world: G, levels: G.ids.map((id) => resolveLevel(G, id)) };
}
