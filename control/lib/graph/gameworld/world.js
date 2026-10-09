/**
 * THE GAMEWORLD — a game is a series of levels, and a gameworld is what they share. The world carries the broad
 * strokes in two concerns:
 *
 *   STYLE           the ground: the kit it is drawn in (palette, tiles, light, flora), its character (how trails
 *                   rise and fall, how climbs are built), its LAND (era/out-land.js: each form's variant and where it
 *                   stands from little to many: its clouds, rocks, cliffs, landmarks), and which civilization builds
 *                   where no one else is named
 *   CIVILIZATIONS   who builds on it: each its building language, its fortification, how it lays out a town and
 *                   raises a castle. A world keeps as many as it likes; a level is settled by one, and any town or
 *                   castle on it may be built by another (a conqueror's castle over an older town). Only what a
 *                   civilization builds is here; its people are left open with the world's characters
 *
 * Every level inherits both. A level is a local lord: it executes the world's style in place and interprets it, and
 * may override any part of it (its own kit, a steeper trail, another civilization); a section or a place may override
 * its level the same way. Every override is kept in a LEDGER beside the value it replaced.
 *
 *   gameworld: {
 *     id, name?, seed?,
 *     style?: { kit?, civilization?, trail?: {…}, meru?: {…}, weather?: '<climate>' | {…}, land?: { <form>: variant | many | { variant?, many? } } },
 *     civilizations?: { '<id>': { name?, anchor?, fort?, town?: {…}, castle?: {…}, builds?, technology? } },
 *     levels: { '<id>': {
 *       name?, seed?,                     // the seed derives from the world's and the level's id unless named
 *       style?: { … },                    // the level's overrides, the style's shape
 *       walk: { layout?, root?, nodes, edges?, spawn? },   // the level graph (level/graph.js) less its kit and seed
 *       places?: { town?: true | { civilization?, … }, castle?: true | false | { civilization?, … } },
 *     } },
 *     links?: [ { from, to, kind?: 'road' | 'gate' } ],
 *     start?: '<level id>',
 *     characters?, mechanics?,            // reserved: what is not on the ground is left open
 *     mode?, review?, brief?,             // the workflow's: gated or autonomous, the creator's verdicts, the prompt
 *   }
 *
 * `resolveLevel(world, id)` answers the level recipe `layLevel` reads, the town's recipe (its castle in it), the
 * level's whole style, who built what, and its ledger. Pure: the same world resolves the same levels.
 */
import { STAGE_KITS, resolveKitId, stageKit } from '../era/stage.js';
import { readOutTrail } from '../era/out-trail.js';
import { readLocalMeru } from '../local-meru/plan.js';
import { readTownPlan } from '../era/out-town.js';
import { readCastlePlan } from '../era/out-castle.js';
import { readLevel } from '../level/graph.js';
import { LAND_FORMS, LAND_FORM_IDS } from '../era/out-land.js';
import { tunnelBuilding } from './tunnel-buildings.js';
import { tunnelTech } from './tunnel-tech.js';
import { composeLook } from './tunnel-land.js';
import { STARTER_BLOCKS } from '../era/tech-blocks.js';
import { readBlock, FINISHES } from '../era/blocks.js';
import { readWeather } from '../weather/weather.js';

/** The style: the ground, and who builds on it unless a place says otherwise. */
export const WORLD_STYLE = Object.freeze({
  kit: 'the stage kit its open ground is drawn in: palette, tiles, light, flora',
  civilization: 'the civilization that builds where no other is named',
  trail: 'the ground\'s character on a trail: run, heartbeat, bumpiness',
  meru: 'how a climb is built: its preset',
  land: `the land's forms, each a variant and a step from little to many (${LAND_FORM_IDS.join(', ')}); the kit's own where left out`,
  weather: 'what the sky does: a climate\'s name or { climate, dwell?, blend?, start?, surface? } (weather/weather.js); a level and a section may name their own',
  look: 'the look in words ("a grounded frontier of rust plains…", or { intent, seed? }): tunnelled from the kit into a look of its own, which the ground is drawn in',
});
/** A civilization: what it builds, and how. */
export const CIVILIZATION = Object.freeze({
  name: 'what it is called',
  anchor: 'its building language (an anchor structure, or its elements); the kit\'s own when left out',
  fort: 'the fortification its castles raise (crenellated, battered, or its elements)',
  town: 'how it lays out a town: length, sway, branches, levels, back, farms, heartbeat, secondary',
  castle: 'how it raises a castle: size, wards, rise',
  builds: 'what it builds, in words ("a modular sci-fi habitat", or { intent, seed? }): tunnelled through its blocks into its building language, from its anchor when one is named',
  technology: 'its technology: { finish?, blocks?: { <id>: block }, things?: { <id>: words | { intent, seed? } } }, each thing tunnelled into a block its library keeps',
});
const GROUPS = Object.freeze({
  trail: ['run', 'heartbeat', 'bumpiness'],
  meru: ['preset'],
  town: ['length', 'sway', 'branches', 'levels', 'back', 'farms', 'heartbeat', 'secondary'],
  castle: ['size', 'wards', 'rise'],
});
export const LINK_KINDS = Object.freeze({ road: 'the walk goes on: the next level starts where this one leaves', gate: 'a door between them: a portal, a stair down, a boat' });
/** Not on the ground: named so a world can say it, left open. */
export const RESERVED = Object.freeze(['characters', 'mechanics']);
/** The civilization a world without any keeps: the kit's own language, crenellated. */
export const NATIVE = 'native';

const ID = /^[a-z][a-z0-9-]{0,47}$/;
// mode, review and brief are the workflow's (review.js, compose.js): read there, carried here
const KEYS = ['id', 'name', 'seed', 'mode', 'review', 'brief', 'style', 'civilizations', 'levels', 'links', 'start', ...RESERVED];
const LEVEL_KEYS = ['name', 'seed', 'style', 'walk', 'places'];
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
    if (!isObj(T)) throw new Error(`gameworld: ${at}.technology is { finish?, blocks?, things? }`);
    for (const k of Object.keys(T)) if (!['finish', 'blocks', 'things'].includes(k)) throw new Error(`gameworld: ${at}.technology.${k} is not a technology setting (finish, blocks, things)`);
    if (T.finish !== undefined && !FINISHES[T.finish]) throw new Error(`gameworld: ${at}.technology.finish '${T.finish}' is not a finish (${Object.keys(FINISHES).join(', ')})`);
    if (T.blocks !== undefined && !isObj(T.blocks)) throw new Error(`gameworld: ${at}.technology.blocks is { <id>: block }`);
    if (T.things !== undefined && !isObj(T.things)) throw new Error(`gameworld: ${at}.technology.things is { <id>: words | { intent, seed? } }`);
    out.technology = { finish: T.finish ?? 'alloy', blocks: { ...(T.blocks ?? {}) }, things: Object.fromEntries(Object.entries(T.things ?? {}).map(([id, v]) => { if (!ID.test(id)) throw new Error(`gameworld: ${at}.technology.things '${id}': an id is a short lower-case name`); return [id, intentOf(v, `${at}.technology.things.${id}`)]; })) };
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
  return { kit: L.id, look: { ...look, base: L.base, id: L.id, tunnel: logOf(L.record) } };
};
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
  // what a civilization says in words is tunnelled through its blocks, on the world's kit
  for (const id of civIds) if (civilizations[id].builds || civilizations[id].technology) civilizations[id] = tunnelCivilization(civilizations[id], id, style.kit, seed);
  if (!isObj(W.levels) || !Object.keys(W.levels).length) throw new Error('gameworld: levels is { <id>: { walk, … } }, at least one');
  const ids = Object.keys(W.levels), levels = {};
  for (const id of ids) {
    const L = W.levels[id], at = `levels.${id}`;
    if (!ID.test(id)) throw new Error(`gameworld: level '${id}': an id is a short lower-case name (letters, digits, hyphens)`);
    if (!isObj(L)) throw new Error(`gameworld: ${at} is { ${LEVEL_KEYS.join(', ')} }`);
    for (const k of Object.keys(L)) if (!LEVEL_KEYS.includes(k)) throw new Error(`gameworld: ${at}.${k} is not a level setting (settings: ${LEVEL_KEYS.join(', ')})`);
    if (!isObj(L.walk)) throw new Error(`gameworld: ${at}.walk is the level's graph { nodes, edges?, … }`);
    for (const k of ['kit', 'seed']) if (L.walk[k] !== undefined) throw new Error(`gameworld: ${at}.walk.${k}: a level's ${k} is its own (${k === 'kit' ? `${at}.style.kit` : `${at}.seed`}), handed to its sections`);
    if (L.seed !== undefined && !Number.isFinite(L.seed)) throw new Error(`gameworld: ${at}.seed is a number`);
    const st = readStyle(L.style, `${at}.style`);
    if (st.look) Object.assign(st, lookFor(st.look, st.kit ?? style.kit, seed, `${W.id}-${id}`));
    if (st.civilization !== undefined) civ(st.civilization, `${at}.style.civilization`);
    if (L.places !== undefined) {
      if (!isObj(L.places)) throw new Error(`gameworld: ${at}.places is { town?, castle? }`);
      for (const k of Object.keys(L.places)) {
        if (!['town', 'castle'].includes(k)) throw new Error(`gameworld: ${at}.places.${k} is not a place (town, castle)`);
        if (isObj(L.places[k]) && L.places[k].civilization !== undefined) civ(L.places[k].civilization, `${at}.places.${k}.civilization`);
      }
    }
    levels[id] = { ...L, style: st };
  }
  const links = (W.links ?? []).map((e, i) => {
    if (!isObj(e)) throw new Error(`gameworld: links[${i}] is { from, to, kind? }`);
    for (const k of Object.keys(e)) if (!['from', 'to', 'kind'].includes(k)) throw new Error(`gameworld: links[${i}].${k} is not a link setting (from, to, kind)`);
    for (const k of ['from', 'to']) if (!levels[e[k]]) throw new Error(`gameworld: links[${i}].${k} '${e[k]}' is not a level (levels: ${ids.join(', ')})`);
    if (e.from === e.to) throw new Error(`gameworld: links[${i}] leads '${e.from}' to itself`);
    const kind = e.kind ?? 'road';
    if (!LINK_KINDS[kind]) throw new Error(`gameworld: links[${i}].kind '${kind}' is not a link (${Object.keys(LINK_KINDS).join(', ')})`);
    return { from: e.from, to: e.to, kind };
  });
  const start = W.start ?? ids[0];
  if (!levels[start]) throw new Error(`gameworld: start '${start}' is not a level (levels: ${ids.join(', ')})`);
  return { id: W.id, name: W.name ?? W.id, seed, style, civilizations, civIds, levels, ids, links, start, [READ]: true };
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
  const level = { ...L.walk, kit: style.kit, seed, nodes };
  readLevel(level);

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
  return { id, name: L.name ?? id, seed, style, built, ledger, level, town };
}

/** Every level of a world, resolved, in the order listed: `{ world, levels: [resolved…] }`. */
export function resolveWorld(world) {
  const G = readGameworld(world);
  return { world: G, levels: G.ids.map((id) => resolveLevel(G, id)) };
}
