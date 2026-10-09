/**
 * THE GAMEWORLD GRAPH — a world as data: what it holds and how its parts bear on each other, with no drawing in it.
 * A document draws it however it needs: a map of levels in the bible, an outline in a note, a flowchart in a doc
 * (`graphOutline`, `graphMermaid`). Nodes and edges carry their kind and what a drawing needs to label them.
 *
 *   nodes   world · kit (the style) · civilization · language · fort · thing (its technology) · level · section
 *           (a trail, a climb) · place (town, castle)
 *   edges   contains   the world its levels and civilizations, a level its sections and places, a town its castle
 *           styled     the world to its kit, and to the civilization that builds unless another is named
 *           drawn-in   a level (or a section that overrides it) to the kit its ground is drawn in
 *           settled-by a level to the civilization that builds on it unless another is named
 *           built-by   a town or a castle to the civilization that built it
 *           speaks     a civilization to its building language
 *           raises     a civilization to the fortification it raises
 *           makes      a civilization to a thing of its technology (its tier and the functions it shows on the node)
 *           seam       a section to the one that follows it
 *           leads      a level to the next (a road, a gate)
 *           overrides  a level (or a section, a place) to its world, one edge a key: the world's value and its own
 *
 * `gameworldGraph(world)` → { id, nodes: [{ id, kind, label, … }], edges: [{ from, to, kind, … }] }, in a fixed
 * order: the same world, the same graph.
 */
import { readGameworld, resolveLevel } from './world.js';
import { readLevel } from '../level/graph.js';
import { ELEMENT_SETS } from '../era/out-anchor-elements.js';

const nameOf = (v, fallback) => (typeof v === 'string' ? v : v && typeof v === 'object' ? (v.id ?? (v.seed !== undefined ? `seeded-${v.seed}` : fallback)) : fallback);
export const languageId = (anchor, kit) => (anchor === undefined || anchor === null ? `kit-${kit}` : nameOf(anchor, 'its-own'));
export const fortId = (fort) => nameOf(fort, 'its-own');

export function gameworldGraph(world) {
  const G = readGameworld(world), nodes = [], edges = [], seen = new Set();
  const node = (id, kind, label, more = {}) => { if (!seen.has(id)) { seen.add(id); nodes.push({ id, kind, label, ...more }); } return id; };
  const edge = (from, to, kind, more = {}) => edges.push({ from, to, kind, ...more });
  const kitN = (k) => node(`kit:${k}`, 'kit', k);
  const langN = (a, k) => { const id = languageId(a, k); return node(`language:${id}`, 'language', ELEMENT_SETS[id] ? id : a === undefined || a === null ? `the ${k} kit's own` : id); };
  const fortN = (f) => node(`fort:${fortId(f)}`, 'fort', fortId(f));

  node('world', 'world', G.name, { seed: G.seed, start: G.start });
  edge('world', kitN(G.style.kit), 'styled', { key: 'kit' });
  for (const cid of G.civIds) {
    const C = G.civilizations[cid], cn = node(`civilization:${cid}`, 'civilization', C.name);
    edge('world', cn, 'contains');
    edge(cn, langN(C.anchor, G.style.kit), 'speaks');
    edge(cn, fortN(C.fort), 'raises');
    for (const [tid, t] of Object.entries(C.technology?.things ?? {})) edge(cn, node(`thing:${cid}/${tid}`, 'thing', tid, { tier: t.block.tier, functions: t.block.functions, intent: t.intent }), 'makes');
  }
  edge('world', `civilization:${G.style.civilization}`, 'styled', { key: 'civilization' });

  for (const id of G.ids) {
    const R = resolveLevel(G, id), lv = `level:${id}`, walk = readLevel(R.level);
    node(lv, 'level', R.name, { seed: R.seed, kit: R.style.kit, start: id === G.start });
    edge('world', lv, 'contains');
    edge(lv, kitN(R.style.kit), 'drawn-in');
    edge(lv, `civilization:${R.style.civilization}`, 'settled-by');
    for (const sid of walk.ids) {
      const n = walk.nodes[sid], s = `section:${id}/${sid}`;
      node(s, 'section', sid, { section: n.section, seed: n.seed, kit: n.kit, root: sid === walk.root });
      edge(lv, s, 'contains');
      if (n.kit !== R.style.kit) edge(s, kitN(n.kit), 'drawn-in');
    }
    for (const e of walk.edges) edge(`section:${id}/${e.from}`, `section:${id}/${e.to}`, e.kind);
    if (R.town) {
      const t = node(`place:${id}/town`, 'place', 'town', { place: 'town' });
      edge(lv, t, 'contains');
      edge(t, `civilization:${R.built.town}`, 'built-by');
      if (R.town.castle) {
        const c = node(`place:${id}/castle`, 'place', 'castle', { place: 'castle' });
        edge(t, c, 'contains');
        edge(c, `civilization:${R.built.castle}`, 'built-by');
      }
    }
    for (const o of R.ledger) {
      const from = o.scope === 'level' ? lv : o.scope === 'section' ? `section:${o.at}` : `place:${o.at}`;
      edge(from, 'world', 'overrides', { key: o.key, world: o.world, local: o.local });
    }
  }
  for (const l of G.links) edge(`level:${l.from}`, `level:${l.to}`, 'leads', { via: l.kind });
  return { id: G.id, nodes, edges };
}

const short = (v) => (typeof v === 'object' && v !== null ? nameOf(v, 'its own') : String(v));

/** The graph as an indented outline: what contains what, each node's other edges beside it. */
export function graphOutline(g) {
  const by = Object.fromEntries(g.nodes.map((n) => [n.id, n])), lines = [];
  const kids = (id) => g.edges.filter((e) => e.from === id && e.kind === 'contains').map((e) => e.to);
  const notes = (id) => g.edges.filter((e) => e.from === id && e.kind !== 'contains').map((e) => (e.kind === 'overrides' ? `overrides ${e.key}: ${short(e.local)} (world: ${short(e.world)})` : `${e.kind}${e.via ? ` (${e.via})` : ''} → ${by[e.to].label}`));
  const walk = (id, depth) => {
    const n = by[id], extra = notes(id);
    lines.push(`${'  '.repeat(depth)}${n.kind} · ${n.label}${n.section ? ` (${n.section})` : ''}${extra.length ? ` — ${extra.join('; ')}` : ''}`);
    for (const k of kids(id)) walk(k, depth + 1);
  };
  walk('world', 0);
  return lines.join('\n');
}

/** The graph as a Mermaid flowchart: the levels as boxes holding their sections, the style guide beside them. */
export function graphMermaid(g, { overrides = true } = {}) {
  const key = (id) => id.replace(/[^a-zA-Z0-9]/g, '_'), q = (s) => `"${String(s).replace(/"/g, "'")}"`;
  const by = Object.fromEntries(g.nodes.map((n) => [n.id, n])), out = ['flowchart LR'];
  out.push(`  ${key('world')}([${q(by.world.label)}])`);
  out.push('  subgraph style_guide["style and civilizations"]');
  for (const n of g.nodes.filter((x) => ['kit', 'civilization', 'language', 'fort', 'thing'].includes(x.kind))) out.push(`    ${key(n.id)}[${q(`${n.kind}: ${n.label}`)}]`);
  out.push('  end');
  for (const lv of g.nodes.filter((x) => x.kind === 'level')) {
    out.push(`  subgraph ${key(lv.id)}[${q(lv.label)}]`);
    const inside = new Set(), add = (id) => { for (const e of g.edges.filter((x) => x.from === id && x.kind === 'contains')) { inside.add(e.to); add(e.to); } };
    add(lv.id);
    for (const id of inside) { const n = by[id]; out.push(`    ${key(id)}${n.kind === 'place' ? `{{${q(n.label)}}}` : `[${q(`${n.label} · ${n.section}`)}]`}`); }
    out.push('  end');
  }
  for (const e of g.edges) {
    if (e.kind === 'contains' && by[e.from].kind !== 'world') continue;
    if (e.kind === 'overrides' && !overrides) continue;
    const lab = e.kind === 'overrides' ? `overrides ${e.key}` : e.kind === 'leads' ? `${e.via}` : e.kind;
    const arrow = e.kind === 'seam' || e.kind === 'leads' ? '-->' : '-.->';
    out.push(`  ${key(e.from)} ${arrow}|${q(lab)}| ${key(e.to)}`);
  }
  return out.join('\n');
}
