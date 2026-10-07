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
  let prev = null;   // the trail just walked: { node, recipe (its whole `after` chain), kit, seed }
  for (const id of order) {
    const n = G.nodes[id];
    if (prev && prev.section !== 'trail') throw new Error(`level: sequential: '${id}' follows the ${prev.section} '${prev.node}'; a section follows a trail (nothing follows a ${prev.section} yet)`);
    let manifest;
    if (n.section === 'trail') {
      const recipe = { ...n.recipe, id };
      if (prev) {
        // a trail followed is planned in its follower's look: two trails in a row share one
        if (styleOfKit(prev.kit) !== styleOfKit(n.kit)) throw new Error(`level: sequential: '${prev.node}' (${prev.kit}) to '${id}' (${n.kit}): two trails in a row are drawn in one look; a seam between looks is not drawn yet`);
        recipe.after = { ...prev.recipe, seed: prev.seed };
      }
      manifest = { kind: 'stage', kit: n.kit, seed: n.seed, trail: recipe };
      prev = { node: id, section: 'trail', recipe, kit: n.kit, seed: n.seed };
    } else {
      const meru = { ...n.recipe, id };
      if (prev) meru.after = { trail: prev.recipe, kit: styleOfKit(prev.kit), seed: prev.seed };
      manifest = { kind: 'stage', kit: n.kit, seed: n.seed, meru };
      prev = { node: id, section: n.section };
    }
    stages.push({ node: id, section: n.section, manifest });
  }
  return { layout: 'sequential', root: G.root, spawn: G.spawn, order, edges: G.edges, stages };
}
