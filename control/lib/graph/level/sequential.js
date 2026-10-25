/**
 * SEQUENTIAL — the layout that reads a level's graph as one walk: a path from the root, each section starting where
 * the one before leaves. However the walk twists in 3D, the graph is a line, and distance along it is counted from the
 * root. It compiles to what the sections already know, the `after` chain: each node's stage recipe carries the whole
 * recipe of the node it follows, so a page built from the graph is the page a hand-written chain builds, byte for byte.
 *
 * `sequentialLevel(level)` → { layout, root, spawn, order, edges, stages: [{ node, section, manifest }] }: one stage
 * recipe a page, in walking order.
 */
import { readLevel, styleOfKit } from './graph.js';
import { compileLevelGround } from './ground.js';
import { geocubeTown } from '../era/geocube.js';

/** The walk from the root, or what stops the graph being one. */
export function sequentialOrder(G) {
  const out = {}, inn = {};
  for (const e of G.edges) {
    if (out[e.from]) throw new Error(`level: sequential: '${e.from}' leads on to both '${out[e.from]}' and '${e.to}'; a sequential level is one walk (a branch is a junction, not laid out yet)`);
    if (inn[e.to]) throw new Error(`level: sequential: '${e.to}' follows both '${inn[e.to]}' and '${e.from}'; a sequential level is one walk`);
    out[e.from] = e.to; inn[e.to] = e.from;
  }
  if (inn[G.root]) throw new Error(`level: sequential: the root '${G.root}' follows '${inn[G.root]}'; the walk starts at the root`);
  const order = [G.root];
  for (let n = out[G.root]; n !== undefined; n = out[n]) order.push(n);
  const off = G.ids.filter((id) => !order.includes(id));
  if (off.length) throw new Error(`level: sequential: ${off.map((id) => `'${id}'`).join(', ')} ${off.length > 1 ? 'are' : 'is'} not on the walk from the root '${G.root}'`);
  return order;
}

/** A level recipe laid out as one walk: its stage recipes, in walking order. */
export function sequentialLevel(recipe) {
  const G = recipe && recipe.nodes && recipe.ids ? recipe : readLevel(recipe);
  if (G.layout !== 'sequential') throw new Error(`level: '${G.layout}' is not the sequential layout`);
  const order = sequentialOrder(G), stages = [];
  // the level's own ground (ground.js), laid on its trails' recipes in their own metres before they are chained
  const laid = G.ground ? compileLevelGround(G, order) : null;
  let prev = null;   // the trail just walked: { node, recipe (its whole `after` chain), kit, seed }
  // a domain's town (era/geocube.js geocubeTown): its street on the first trail it paints, once
  let street = G.paint?.domain ? geocubeTown(G.paint.cube, G.paint.domain.domain) : null;
  for (const id of order) {
    const n = G.nodes[id];
    if (prev && prev.section !== 'trail') throw new Error(`level: sequential: '${id}' follows the ${prev.section} '${prev.node}'; a section follows a trail (nothing follows a ${prev.section} yet)`);
    let manifest;
    if (n.section === 'trail') {
      const recipe = { ...(laid?.recipes[id] ?? n.recipe), id };
      if (prev) {
        // a trail followed is planned in its follower's look: two trails in a row share one
        if (styleOfKit(prev.kit) !== styleOfKit(n.kit)) throw new Error(`level: sequential: '${prev.node}' (${prev.kit}) to '${id}' (${n.kit}): two trails in a row are drawn in one look; a seam between looks is not drawn yet`);
        recipe.after = { ...prev.recipe, seed: prev.seed };
      }
      manifest = { kind: 'stage', ...paintOf(G, n), seed: n.seed, trail: recipe, ...(n.weather ? { weather: n.weather } : {}), ...(street && n.painted ? { town: street } : {}) };
      if (n.painted) street = null;
      prev = { node: id, section: 'trail', recipe, kit: n.kit, seed: n.seed };
    } else {
      const meru = { ...n.recipe, id };
      if (prev) meru.after = { trail: prev.recipe, kit: styleOfKit(prev.kit), seed: prev.seed };
      manifest = { kind: 'stage', ...paintOf(G, n), seed: n.seed, meru, ...(n.weather ? { weather: n.weather } : {}) };
      prev = { node: id, section: n.section };
    }
    stages.push({ node: id, section: n.section, manifest });
  }
  const ground = laid ? { cell: laid.frame.cell, cols: laid.frame.cols, rows: laid.frame.rows, spans: laid.frame.spans.map(({ node, section, origin, D }) => ({ node, section, origin, D })), placed: laid.placed } : null;
  const hour = G.paint?.hour ?? G.paint?.domain?.domain.hour;
  const paint = G.paint ? { geocube: G.paint.cube.id, ...(G.paint.domain ? { domain: G.paint.domain.name, ...(hour !== undefined ? { hour } : {}) } : hour !== undefined ? { hour } : {}),
    terrain: G.paint.terrain.name, from: G.paint.terrain.from, offered: G.paint.terrain.offered,
    ...(G.paint.terrain.wanted ? { wanted: G.paint.terrain.wanted } : {}), nodes: order.filter((id) => G.nodes[id].painted) } : null;
  return { layout: 'sequential', root: G.root, spawn: G.spawn, order, edges: G.edges, stages, ...(ground ? { ground } : {}), ...(paint ? { paint } : {}) };
}
// a node's paint: its kit, or (painted by the level's geocube) the cube itself and the terrain (or the domain) the level
// picked, and the hour the level lights it at, so the stage carries what it is drawn by and lowers it on every read
function paintOf(G, n) {
  if (!n.painted) return { kit: n.kit };
  const lit = G.paint.hour !== undefined ? { hour: G.paint.hour } : {};
  if (G.paint.domain) return { geocube: G.paint.cube, domain: G.paint.ask, ...lit };
  const T = G.paint.terrain;
  return { geocube: G.paint.cube, terrain: T.from === 'level' ? T.name : { ...(T.from === 'heartbeat' || T.wanted ? { hint: T.from === 'heartbeat' ? T.name : T.wanted } : {}) }, ...lit };
}
