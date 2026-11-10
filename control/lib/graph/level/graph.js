/**
 * THE LEVEL GRAPH — a level is a graph of sections, and its LAYOUT is a behaviour of that graph, not of the sections.
 * Nodes are sections (a trail, a local meru); edges are the joins between them; one node is the ROOT, node 0: the
 * origin of the level's frame (position 0, heading +y, the meru axis), whatever kind of place it is. Where the player
 * starts is a separate concern, the SPAWN (a node and where on it), the root's entry unless it says otherwise.
 *
 *   level: {
 *     layout: 'sequential' | 'map',       // the behaviour that lays the graph out: one walk (sequential.js), or a map
 *                                         // whose junctions branch (map.js: every section placed, one page)
 *     kit?, seed?,                        // what every node takes unless it names its own
 *     root?: '<node id>',                 // node 0; the first node listed unless named
 *     nodes: { '<id>': { trail: {…} | true, kit?, seed? } | { meru: {…} | true, kit?, seed? }
 *              | { junction: { radius?, gates: { '<gate>': <bearing°> } }, kit?, seed? }, … },   // a junction: a hub
 *                                         // (map layout), flat, its gates on its edge at compass bearings (0 its +y)
 *     edges?: [ { from, to, kind?: 'seam', gate? } ],   // sequential: omitted, the nodes in the order listed; `gate`:
 *                                         // the junction gate the edge leaves from (or arrives at)
 *     spawn?: { node, at?: 'entry' },
 *     ground?: { heartbeat?, cell?, tune?, rise?, edits? },   // the level's own ground, on a top-down grid (ground.js)
 *     geocube?: <cube>, terrain?: '<name>',   // the cube paints every section once (its outside's look on one of its
 *                                         // terrains: the level's, else its heartbeat's, else the cube's own); a
 *                                         // node's own kit wins. Each stage says what it got (`painted`)
 *     domain?: <ask>,                     // or one of the levels the cube makes (era/geocube.js pickDomain: a name,
 *                                         // { from, …changes } or a composition), outside: its terrain at its hour;
 *                                         // asking neither, on a cube that names its domains: its heartbeat's, else
 *                                         // the cube's first outside
 *     hour?: <hour>,                      // the cube's outside lit at that hour (era/geocube-hours.js readHour: a
 *                                         // word or 0 to 24), on every section it paints; over its domain's own
 *     clouds?: <clouds>,                  // the cube's outside under that sky (matte-paint/sky.js readClouds: a kind
 *                                         // or { kind, cover?, seed? }), on every section it paints
 *   }
 *
 * A node's recipe is its section's own (era/out-trail.js `readOutTrail`, local-meru/plan.js `readLocalMeru`) less its
 * `id` and `after`: the node's key is its id, and the graph says what it follows.
 */
import { STAGE_KITS, resolveKitId, stageKit } from '../era/stage.js';
import { readWeather } from '../weather/weather.js';
import { readLevelGround } from './ground.js';
import { readGeocube, pickTerrain, pickDomain, lowerGeocube, geocubeTerrains } from '../era/geocube.js';
import { readHour } from '../era/geocube-hours.js';
import { readClouds } from '../matte-paint/sky.js';

export const LEVEL_LAYOUTS = Object.freeze(['sequential', 'map']);
export const LEVEL_SECTIONS = Object.freeze(['trail', 'meru', 'junction']);
/** A JUNCTION's reach: its radius in metres (a crossroads to a town square), and how many gates it takes. */
export const JUNCTION = Object.freeze({ radius: [8, 60, 14], gates: [2, 6] });
export const LEVEL_EDGES = Object.freeze({ seam: 'the next section starts where this one leaves: its line, heading, height and ground' });
export const SPAWN_AT = Object.freeze(['entry']);

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const KEYS = ['layout', 'kit', 'seed', 'root', 'nodes', 'edges', 'spawn', 'weather', 'ground', 'geocube', 'terrain', 'domain', 'hour', 'clouds'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A kit id as the level reads it: known, and resolved from any older name. */
function kitOf(where, k) {
  const id = resolveKitId(k);
  if (!stageKit(id)) throw new Error(`level: ${where}.kit '${k}' is not a stage kit`);
  return id;
}

/** Read a level recipe and say what is wrong. → { layout, kit, seed, root, nodes: { id: { id, section, recipe, kit, seed } }, ids, edges, spawn }. */
export function readLevel(L) {
  if (!isObj(L)) throw new Error('level: a level is { layout?, kit?, seed?, root?, nodes, edges?, spawn? }');
  for (const k of Object.keys(L)) if (!KEYS.includes(k)) throw new Error(`level: '${k}' is not a level setting (settings: ${KEYS.join(', ')})`);
  const layout = L.layout === undefined ? 'sequential' : L.layout;
  if (!LEVEL_LAYOUTS.includes(layout)) throw new Error(`level: layout '${layout}' is not a layout (layouts: ${LEVEL_LAYOUTS.join(', ')})`);
  const kit = L.kit === undefined ? 'isekai-meadow' : kitOf('level', L.kit);
  if (L.seed !== undefined && !Number.isFinite(L.seed)) throw new Error('level: seed is a number');
  const seed = L.seed === undefined ? 1 : L.seed;
  // the sky (weather/weather.js): the level's, a node's own over it; every section's stage takes it, and so shares the level's
  // seed, hence its sky: the level's own clock, seeded from the world's through the level's seed
  const weather = L.weather === undefined ? null : readWeather(L.weather, 'level.weather');

  // the GROUND (ground.js) and the PAINT: a geocube's outside on one of its terrains, picked two ways (the level asks;
  // its heartbeat says what it was made for; the cube offers), laid once on every node that names no kit of its own
  const ground = readLevelGround(L.ground);
  let paint = null;
  const cube = L.geocube === undefined ? null : readGeocube(L.geocube);
  // the hour its painted sections are lit at (each stage takes it: era/geocube.js withGeocube); a cube's outside's only
  if (L.hour !== undefined) {
    if (!cube) throw new Error('level: hour lights a geocube\'s outside: name the level\'s geocube');
    try { readHour(L.hour); } catch (e) { throw new Error(`level: ${e.message}`); }
  }
  // the sky its painted sections are drawn under (each stage takes it: era/geocube.js withGeocube), a cube's outside's only
  if (L.clouds !== undefined) {
    if (!cube) throw new Error('level: clouds are a geocube\'s outside\'s sky: name the level\'s geocube');
    try { readClouds(L.clouds); } catch (e) { throw new Error(`level: ${e.message}`); }
  }
  const lit = { ...(L.hour !== undefined ? { hour: L.hour } : {}), ...(L.clouds !== undefined ? { clouds: L.clouds } : {}) };
  // the look the painted sections are drawn in, lowered as each stage lowers it (its hour and its clouds), so a climb's
  // `after.kit` names the look its own stage registers
  const sky = L.clouds === undefined ? undefined : readClouds(L.clouds);
  if (cube && (L.domain !== undefined || (L.terrain === undefined && cube.domains))) {
    // a domain: the level the cube makes, its terrain at its hour (every section is outside); asked, else (the cube naming
    // its levels) its heartbeat's, else its first outside
    if (L.terrain !== undefined) throw new Error('level: domain or terrain, not both: a domain names its terrain');
    const domain = pickDomain(cube, L.domain, ground?.heartbeat?.terrain, 'outside'), D = domain.domain;
    if (D.side !== 'outside') throw new Error(`level: the domain is inside (interior '${D.interior}'); a level's sections are outside, so ask an outside domain`);
    const terrain = { name: D.terrain, from: domain.from, offered: geocubeTerrains(cube).map((t) => t.name) };
    const hour = L.hour ?? D.hour;
    paint = { cube, terrain, domain, ask: L.domain ?? domain.name, ...lit, kit: lowerGeocube(cube, 'outside', D.terrain, hour === undefined ? undefined : readHour(hour), sky).kit };
  } else if (cube) {
    const terrain = pickTerrain(cube, L.terrain, ground?.heartbeat?.terrain);
    paint = { cube, terrain, ...lit, kit: lowerGeocube(cube, 'outside', terrain.name, L.hour === undefined ? undefined : readHour(L.hour), sky).kit };
  } else if (L.terrain !== undefined || L.domain !== undefined) throw new Error(`level: ${L.terrain !== undefined ? 'terrain is one of a geocube\'s terrains' : 'domain is one of the levels a geocube makes'}: name the level's geocube`);

  // NODES: each one section, keyed by its id
  if (!isObj(L.nodes) || !Object.keys(L.nodes).length) throw new Error('level: nodes is { <id>: { trail | meru, kit?, seed? } }, at least one');
  const nodes = {}, ids = Object.keys(L.nodes);
  for (const id of ids) {
    const n = L.nodes[id], at = `nodes.${id}`;
    if (!ID.test(id)) throw new Error(`level: node '${id}': an id is a short lower-case name (letters, digits, hyphens)`);
    if (!isObj(n)) throw new Error(`level: ${at} is { ${LEVEL_SECTIONS.join(' | ')}, kit?, seed? }`);
    const sections = LEVEL_SECTIONS.filter((s) => n[s] !== undefined);
    if (sections.length !== 1) throw new Error(`level: ${at} is one section: ${LEVEL_SECTIONS.join(' or ')}${sections.length ? ` (it names ${sections.join(' and ')})` : ''}`);
    for (const k of Object.keys(n)) if (!['kit', 'seed', 'weather', ...LEVEL_SECTIONS].includes(k)) throw new Error(`level: ${at}.${k} is not a node setting (settings: ${LEVEL_SECTIONS.join(' | ')}, kit, seed, weather)`);
    const section = sections[0], raw = n[section];
    if (raw !== true && !isObj(raw)) throw new Error(`level: ${at}.${section} is its section's recipe (or true)`);
    const recipe = raw === true ? {} : { ...raw };
    for (const k of ['id', 'after']) if (recipe[k] !== undefined) throw new Error(`level: ${at}.${section}.${k}: the graph owns it (the node's key is its id; an edge says what it follows)`);
    if (section === 'junction') {
      if (layout !== 'map') throw new Error(`level: ${at} is a junction: a junction branches, so its level is laid as a map (layout: 'map')`);
      readJunction(recipe, at);
    }
    if (n.seed !== undefined && !Number.isFinite(n.seed)) throw new Error(`level: ${at}.seed is a number`);
    const sky = n.weather === undefined ? weather : readWeather(n.weather, `${at}.weather`);
    const painted = !!paint && n.kit === undefined;
    nodes[id] = { id, section, recipe, kit: n.kit !== undefined ? kitOf(at, n.kit) : painted ? paint.kit : kit, seed: n.seed === undefined ? seed : n.seed, ...(sky ? { weather: sky } : {}), ...(painted ? { painted } : {}) };
  }

  // ROOT: node 0
  const root = L.root === undefined ? ids[0] : L.root;
  if (!nodes[root]) throw new Error(`level: root '${root}' is not a node (nodes: ${ids.join(', ')})`);

  // EDGES: the joins; a sequential level may leave them out and be read in the order its nodes are listed
  let edges;
  if (L.edges === undefined) {
    if (layout !== 'sequential') throw new Error(`level: a ${layout} level names its edges`);
    const order = [root, ...ids.filter((id) => id !== root)];
    edges = order.slice(1).map((to, i) => ({ from: order[i], to, kind: 'seam' }));
  } else {
    if (!Array.isArray(L.edges)) throw new Error('level: edges is a list of { from, to, kind? }');
    edges = L.edges.map((e, i) => {
      if (!isObj(e)) throw new Error(`level: edges[${i}] is { from, to, kind? }`);
      for (const k of Object.keys(e)) if (!['from', 'to', 'kind', 'gate'].includes(k)) throw new Error(`level: edges[${i}].${k} is not an edge setting (settings: from, to, kind, gate)`);
      for (const k of ['from', 'to']) if (!nodes[e[k]]) throw new Error(`level: edges[${i}].${k} '${e[k]}' is not a node (nodes: ${ids.join(', ')})`);
      if (e.from === e.to) throw new Error(`level: edges[${i}] joins '${e.from}' to itself`);
      const kind = e.kind === undefined ? 'seam' : e.kind;
      if (!LEVEL_EDGES[kind]) throw new Error(`level: edges[${i}].kind '${kind}' is not an edge kind (kinds: ${Object.keys(LEVEL_EDGES).join(', ')})`);
      // (a gate is a junction's: the one the edge leaves from, else the one it arrives at)
      const J = nodes[e.from].section === 'junction' ? nodes[e.from] : nodes[e.to].section === 'junction' ? nodes[e.to] : null;
      if (e.gate !== undefined && !J) throw new Error(`level: edges[${i}].gate: neither '${e.from}' nor '${e.to}' is a junction`);
      if (J && e.gate === undefined) throw new Error(`level: edges[${i}] meets the junction '${J.id}': name its gate (gates: ${Object.keys(J.recipe.gates).join(', ')})`);
      if (J && !Object.hasOwn(J.recipe.gates, e.gate)) throw new Error(`level: edges[${i}].gate '${e.gate}' is not one of '${J.id}''s gates (gates: ${Object.keys(J.recipe.gates).join(', ')})`);
      return { from: e.from, to: e.to, kind, ...(J ? { gate: e.gate } : {}) };
    });
  }

  // SPAWN: where the player starts, apart from where the level's frame starts
  let spawn = { node: root, at: 'entry' };
  if (L.spawn !== undefined) {
    if (!isObj(L.spawn)) throw new Error('level: spawn is { node, at? }');
    for (const k of Object.keys(L.spawn)) if (!['node', 'at'].includes(k)) throw new Error(`level: spawn.${k} is not a spawn setting (settings: node, at)`);
    if (!nodes[L.spawn.node]) throw new Error(`level: spawn.node '${L.spawn.node}' is not a node (nodes: ${ids.join(', ')})`);
    const at = L.spawn.at === undefined ? 'entry' : L.spawn.at;
    if (!SPAWN_AT.includes(at)) throw new Error(`level: spawn.at '${at}' is not a place on a node (places: ${SPAWN_AT.join(', ')})`);
    spawn = { node: L.spawn.node, at };
  }

  return { layout, kit, seed, root, nodes, ids, edges, spawn, ...(weather ? { weather } : {}), ...(ground ? { ground } : {}), ...(paint ? { paint } : {}) };
}

/** The look a kit draws its open ground in (a trail followed is planned in its follower's look). */
export const styleOfKit = (kit) => stageKit(kit).style || null;

/** Read a junction's recipe (map.js): { radius?, gates: { <gate>: <bearing°, 0 the frame's +y, clockwise> } }. */
export function readJunction(r, at = 'junction') {
  for (const k of Object.keys(r)) if (!['radius', 'gates', 'surface'].includes(k)) throw new Error(`level: ${at}.junction.${k} is not a junction setting (settings: radius, gates, surface)`);
  const [lo, hi] = JUNCTION.radius;
  if (r.radius !== undefined && !(Number.isFinite(r.radius) && r.radius >= lo && r.radius <= hi)) throw new Error(`level: ${at}.junction.radius is ${lo} to ${hi} metres`);
  const g = r.gates, names = isObj(g) ? Object.keys(g) : [];
  if (!isObj(g) || names.length < JUNCTION.gates[0] || names.length > JUNCTION.gates[1]) throw new Error(`level: ${at}.junction.gates is { <gate>: <bearing in degrees> }, ${JUNCTION.gates[0]} to ${JUNCTION.gates[1]} of them`);
  for (const n of names) {
    if (!ID.test(n)) throw new Error(`level: ${at}.junction.gates: '${n}' is a short lower-case name`);
    if (!Number.isFinite(g[n])) throw new Error(`level: ${at}.junction.gates.${n} is a bearing in degrees (0 the level's +y, clockwise)`);
  }
  return { radius: r.radius ?? JUNCTION.radius[2], gates: { ...g } };
}
