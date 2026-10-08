/**
 * THE GAMEWORLD — a game is a series of levels, and a gameworld is what they share. The world carries the broad
 * strokes, its STYLE GUIDE: the kit its ground is drawn in, the building language its towns speak, the fortification
 * its castles raise, and the character of its ground (how trails rise and fall, how climbs are built, how towns and
 * castles are laid out). Every level inherits all of it. A level is a local lord: it executes the world's style in
 * place and interprets it, and it may override any part of it (its own kit, its own language, a steeper trail);
 * a section may override its level the same way. Every override is kept in a LEDGER beside the value it replaced,
 * so a level's page can say how it differs from its world.
 *
 *   gameworld: {
 *     id, name?, seed?,
 *     style?: { kit?, anchor?, fort?, trail?: {…}, meru?: {…}, town?: {…}, castle?: {…} },   // the style guide
 *     levels: { '<id>': {
 *       name?, seed?,                     // the seed derives from the world's and the level's id unless named
 *       style?: { … },                    // the level's overrides, the style guide's shape
 *       walk: { layout?, root?, nodes, edges?, spawn? },   // the level graph (level/graph.js) less its kit and seed
 *       places?: { town?: true | {…}, castle?: true | {…} | false },   // what stands on its ground, not yet placed
 *     } },
 *     links?: [ { from, to, kind?: 'road' | 'gate' } ],   // how the levels lead on, one to the next
 *     start?: '<level id>',
 *     characters?, mechanics?,            // reserved: what is not on the ground is left open
 *   }
 *
 * `resolveLevel(world, id)` answers the level recipe `layLevel` reads, the town's recipe (its castle in it), the
 * level's whole style, and its ledger. Pure: the same world resolves the same levels.
 */
import { STAGE_KITS, resolveKitId } from '../era/stage.js';
import { readOutTrail } from '../era/out-trail.js';
import { readLocalMeru } from '../local-meru/plan.js';
import { readTownPlan } from '../era/out-town.js';
import { readCastlePlan } from '../era/out-castle.js';
import { readLevel } from '../level/graph.js';

/** The style guide: what a world hands down, and what each part of it is. */
export const WORLD_STYLE = Object.freeze({
  kit: 'the stage kit its open ground is drawn in: palette, tiles, light, flora',
  anchor: 'the building language its towns and castles speak (an anchor structure, or its elements)',
  fort: 'the fortification its castles raise (crenellated, battered, or its elements)',
  trail: 'the ground\'s character on a trail: run, heartbeat, bumpiness',
  meru: 'how a climb is built: its preset',
  town: 'how a town is laid out: length, sway, branches, levels, back, farms, heartbeat, secondary',
  castle: 'how a castle is drawn: size, wards, rise',
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

const ID = /^[a-z][a-z0-9-]{0,47}$/;
const KEYS = ['id', 'name', 'seed', 'style', 'levels', 'links', 'start', ...RESERVED];
const LEVEL_KEYS = ['name', 'seed', 'style', 'walk', 'places'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A level's seed from its world's and its own id: FNV-1a, folded to 1…9973. */
export function levelSeed(worldSeed, id) {
  let h = 2166136261;
  for (const c of `${worldSeed}:${id}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 9973) + 1;
}

// a style (the world's or a level's): its keys, each group's keys
function readStyle(s, at) {
  if (s === undefined) return {};
  if (!isObj(s)) throw new Error(`gameworld: ${at} is { ${Object.keys(WORLD_STYLE).join(', ')} }`);
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (!WORLD_STYLE[k]) throw new Error(`gameworld: ${at}.${k} is not part of the style guide (${Object.keys(WORLD_STYLE).join(', ')})`);
    if (k === 'kit') {
      const id = resolveKitId(v);
      if (!STAGE_KITS[id] || !STAGE_KITS[id].shell) throw new Error(`gameworld: ${at}.kit '${v}' is not an outdoor stage kit (${Object.keys(STAGE_KITS).filter((x) => STAGE_KITS[x].shell).join(', ')})`);
      out.kit = id;
    } else if (GROUPS[k]) {
      if (!isObj(v)) throw new Error(`gameworld: ${at}.${k} is { ${GROUPS[k].join(', ')} }`);
      for (const g of Object.keys(v)) if (!GROUPS[k].includes(g)) throw new Error(`gameworld: ${at}.${k}.${g} is not a ${k} setting a world hands down (${GROUPS[k].join(', ')})`);
      out[k] = { ...v };
    } else out[k] = v;
  }
  return out;
}
// one style laid over another: the scalars replaced, the groups merged key by key
const over = (base, top) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(top)) out[k] = GROUPS[k] ? { ...(base[k] || {}), ...v } : v;
  return out;
};
// what `top` changes of `base`, as ledger entries
function differences(base, top, scope, at) {
  const out = [];
  for (const [k, v] of Object.entries(top)) {
    if (GROUPS[k]) { for (const [g, w] of Object.entries(v)) if (!same(base[k]?.[g], w)) out.push({ scope, at, key: `${k}.${g}`, world: base[k]?.[g] ?? null, local: w }); }
    else if (!same(base[k], v)) out.push({ scope, at, key: k, world: base[k] ?? null, local: v });
  }
  return out;
}

/** Read a gameworld and say what is wrong. → { id, name, seed, style, levels: { id: raw }, ids, links, start }. */
const READ = Symbol('read gameworld');
export function readGameworld(W) {
  if (W && W[READ]) return W;
  if (!isObj(W)) throw new Error('gameworld: a world is { id, name?, seed?, style?, levels, links?, start? }');
  for (const k of Object.keys(W)) if (!KEYS.includes(k)) throw new Error(`gameworld: '${k}' is not a world setting (settings: ${KEYS.join(', ')})`);
  for (const k of RESERVED) if (W[k] !== undefined && W[k] !== null) throw new Error(`gameworld: ${k} are not on the ground: the world leaves them open for now (null, or leave it out)`);
  if (typeof W.id !== 'string' || !ID.test(W.id)) throw new Error('gameworld: id is a short lower-case name (letters, digits, hyphens)');
  if (W.seed !== undefined && !Number.isFinite(W.seed)) throw new Error('gameworld: seed is a number');
  const seed = W.seed ?? 1;
  const style = { kit: 'isekai-meadow', fort: 'crenellated', ...readStyle(W.style, 'style') };
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
    if (L.places !== undefined) {
      if (!isObj(L.places)) throw new Error(`gameworld: ${at}.places is { town?, castle? }`);
      for (const k of Object.keys(L.places)) if (!['town', 'castle'].includes(k)) throw new Error(`gameworld: ${at}.places.${k} is not a place (town, castle)`);
    }
    levels[id] = { ...L, style: readStyle(L.style, `${at}.style`) };
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
  return { id: W.id, name: W.name ?? W.id, seed, style, levels, ids, links, start, [READ]: true };
}

/**
 * A level as its world hands it down: `{ id, name, seed, style, ledger, level, town }`. `level` is the recipe
 * `layLevel` reads (the level's kit and seed on it, every trail and climb given the world's ground first); `town` is
 * the town's recipe, its castle in it, or null; `ledger` lists every override, the level's and its sections'.
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

  // the places: the town in the world's language, its castle raised in the world's fortification
  let town = null;
  const P = L.places || {};
  if (P.town || (P.castle !== undefined && P.castle !== false)) {
    const own = isObj(P.town) ? P.town : {};
    for (const k of Object.keys(own)) if (GROUPS.town.includes(k) && style.town?.[k] !== undefined && !same(style.town[k], own[k])) ledger.push({ scope: 'place', at: `${id}/town`, key: `town.${k}`, world: style.town[k], local: own[k] });
    town = { ...(style.town || {}), ...own };
    if (style.anchor !== undefined && town.anchor === undefined) town.anchor = style.anchor;
    if (P.castle !== undefined && P.castle !== false) {
      const c = isObj(P.castle) ? P.castle : {};
      for (const k of Object.keys(c)) if (GROUPS.castle.includes(k) && style.castle?.[k] !== undefined && !same(style.castle[k], c[k])) ledger.push({ scope: 'place', at: `${id}/castle`, key: `castle.${k}`, world: style.castle[k], local: c[k] });
      town.castle = { fort: style.fort, ...(style.castle || {}), ...c };
      readCastlePlan(town.castle);
    }
    readTownPlan(town);
  }
  return { id, name: L.name ?? id, seed, style, ledger, level, town };
}

/** Every level of a world, resolved, in the order listed: `{ world, levels: [resolved…] }`. */
export function resolveWorld(world) {
  const G = readGameworld(world);
  return { world: G, levels: G.ids.map((id) => resolveLevel(G, id)) };
}
