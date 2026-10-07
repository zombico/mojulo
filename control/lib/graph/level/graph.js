/**
 * THE LEVEL GRAPH — a level is a graph of sections, and its LAYOUT is a behaviour of that graph, not of the sections.
 * Nodes are sections (a trail, a local meru); edges are the joins between them; one node is the ROOT, node 0: the
 * origin of the level's frame (position 0, heading +y, the meru axis), whatever kind of place it is. Where the player
 * starts is a separate concern, the SPAWN (a node and where on it), the root's entry unless it says otherwise.
 *
 *   level: {
 *     layout: 'sequential',               // the behaviour that lays the graph out (sequential.js)
 *     kit?, seed?,                        // what every node takes unless it names its own
 *     root?: '<node id>',                 // node 0; the first node listed unless named
 *     nodes: { '<id>': { trail: {…} | true, kit?, seed? } | { meru: {…} | true, kit?, seed? }, … },
 *     edges?: [ { from, to, kind?: 'seam' } ],   // sequential: omitted, the nodes in the order listed
 *     spawn?: { node, at?: 'entry' },
 *   }
 *
 * A node's recipe is its section's own (era/out-trail.js `readOutTrail`, local-meru/plan.js `readLocalMeru`) less its
 * `id` and `after`: the node's key is its id, and the graph says what it follows.
 */
import { STAGE_KITS, resolveKitId } from '../era/stage.js';

export const LEVEL_LAYOUTS = Object.freeze(['sequential']);
export const LEVEL_SECTIONS = Object.freeze(['trail', 'meru']);
export const LEVEL_EDGES = Object.freeze({ seam: 'the next section starts where this one leaves: its line, heading, height and ground' });
export const SPAWN_AT = Object.freeze(['entry']);

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const KEYS = ['layout', 'kit', 'seed', 'root', 'nodes', 'edges', 'spawn'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A kit id as the level reads it: known, and resolved from any older name. */
function kitOf(where, k) {
  const id = resolveKitId(k);
  if (!STAGE_KITS[id]) throw new Error(`level: ${where}.kit '${k}' is not a stage kit`);
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

  // NODES: each one section, keyed by its id
  if (!isObj(L.nodes) || !Object.keys(L.nodes).length) throw new Error('level: nodes is { <id>: { trail | meru, kit?, seed? } }, at least one');
  const nodes = {}, ids = Object.keys(L.nodes);
  for (const id of ids) {
    const n = L.nodes[id], at = `nodes.${id}`;
    if (!ID.test(id)) throw new Error(`level: node '${id}': an id is a short lower-case name (letters, digits, hyphens)`);
    if (!isObj(n)) throw new Error(`level: ${at} is { ${LEVEL_SECTIONS.join(' | ')}, kit?, seed? }`);
    const sections = LEVEL_SECTIONS.filter((s) => n[s] !== undefined);
    if (sections.length !== 1) throw new Error(`level: ${at} is one section: ${LEVEL_SECTIONS.join(' or ')}${sections.length ? ` (it names ${sections.join(' and ')})` : ''}`);
    for (const k of Object.keys(n)) if (!['kit', 'seed', ...LEVEL_SECTIONS].includes(k)) throw new Error(`level: ${at}.${k} is not a node setting (settings: ${LEVEL_SECTIONS.join(' | ')}, kit, seed)`);
    const section = sections[0], raw = n[section];
    if (raw !== true && !isObj(raw)) throw new Error(`level: ${at}.${section} is its section's recipe (or true)`);
    const recipe = raw === true ? {} : { ...raw };
    for (const k of ['id', 'after']) if (recipe[k] !== undefined) throw new Error(`level: ${at}.${section}.${k}: the graph owns it (the node's key is its id; an edge says what it follows)`);
    if (n.seed !== undefined && !Number.isFinite(n.seed)) throw new Error(`level: ${at}.seed is a number`);
    nodes[id] = { id, section, recipe, kit: n.kit === undefined ? kit : kitOf(at, n.kit), seed: n.seed === undefined ? seed : n.seed };
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
      for (const k of Object.keys(e)) if (!['from', 'to', 'kind'].includes(k)) throw new Error(`level: edges[${i}].${k} is not an edge setting (settings: from, to, kind)`);
      for (const k of ['from', 'to']) if (!nodes[e[k]]) throw new Error(`level: edges[${i}].${k} '${e[k]}' is not a node (nodes: ${ids.join(', ')})`);
      if (e.from === e.to) throw new Error(`level: edges[${i}] joins '${e.from}' to itself`);
      const kind = e.kind === undefined ? 'seam' : e.kind;
      if (!LEVEL_EDGES[kind]) throw new Error(`level: edges[${i}].kind '${kind}' is not an edge kind (kinds: ${Object.keys(LEVEL_EDGES).join(', ')})`);
      return { from: e.from, to: e.to, kind };
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

  return { layout, kit, seed, root, nodes, ids, edges, spawn };
}

/** The look a kit draws its open ground in (a trail followed is planned in its follower's look). */
export const styleOfKit = (kit) => STAGE_KITS[kit].style || null;
