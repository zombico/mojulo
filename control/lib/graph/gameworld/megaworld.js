/**
 * THE MEGAWORLD — how a game's maps join: not a line of next levels but a topology the player travels, the loaded map the
 * CURRENT map (the game's state: game/store-kernel.js flags, the shell's atlas), not the next level.
 *
 * A level plans its tiles into segments and joins them by gates (level/plan.js); the megaworld is the same at the next
 * scale up: zones (the world's levels) in RINGS, joined by ways, written once and lowered into the `links` a map world
 * already walks, so the shell's travel, keys and story flags work as they are.
 *
 *   megaworld: {
 *     shape: 'mandala' | 'chain' | 'hub' | 'open',   // gmn.js WORLD_SHAPES
 *     rings: [['town'], ['woods', 'meadows'], ['citadel']],   // the first ring where it sets out; a mandala's last its core
 *     gates?: { <zone>: { key, keyAt } | { needs } },         // what opens the way INTO a zone
 *   }
 *
 *   MANDALA  each zone joins the next ring's by its sector (the zone at the same share round its ring); the core is the
 *            last ring, one zone, and a way in is gated. WCD's geometry at the world's scale: deeper inward, keys inside
 *   CHAIN    one zone a ring, each the next; HUB the first ring's zone joined to every other; OPEN one ring, each joined
 *            to its neighbours round it, so none is the only way on
 *
 *   readMegaworld(v, levels, at?)  → v, read; throws, teaching
 *   megaworldLinks(M)              → the links it lowers to: [{ from, to, kind, key?, keyAt?, needs? }]
 *   megaworldLaws(M)               → [{ law, ok, says }]: it advises, as WCD's own laws do
 *   stampMegaworld(world)          → the world with its links, topology, start and hub laid; a world without one, itself
 *   atlasOf(M, stages, refs)       → the game manifest's `atlas`: { slice, rings: [[level ref]] }
 *   coreOf(M, stages, refs)        → a mandala's core as a level ref: the level whose first win completes the game; else null
 * Pure.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: megaworld${m}`);
export const MEGAWORLD_SHAPES = Object.freeze(['mandala', 'chain', 'hub', 'open']);
export const ATLAS_SLICE = 'atlas';

export function readMegaworld(v, levels = {}, at = '') {
  if (v === undefined) return null;
  if (!isObj(v)) throw fail(`${at} is { shape, rings, gates? }: the world's zones in rings, the ways between them`);
  for (const k of Object.keys(v)) if (!['shape', 'rings', 'gates'].includes(k)) throw fail(`.${k} is not part of it (shape, rings, gates)`);
  if (!MEGAWORLD_SHAPES.includes(v.shape)) throw fail(`.shape is ${MEGAWORLD_SHAPES.join(', ')}`);
  if (!Array.isArray(v.rings) || !v.rings.length || v.rings.some((r) => !Array.isArray(r) || !r.length)) throw fail('.rings is a list of rings, each a list of zones (levels), the first where it sets out');
  const zones = v.rings.flat(), seen = new Set();
  for (const z of zones) {
    if (!isObj(levels[z])) throw fail(`.rings: '${z}' is no level of this world (${Object.keys(levels).join(', ') || 'none'})`);
    if (seen.has(z)) throw fail(`.rings: '${z}' stands in two places`);
    seen.add(z);
  }
  if (zones.length < 2) throw fail('.rings joins two zones or more (one map needs no megaworld)');
  if (v.shape === 'mandala' && v.rings.at(-1).length !== 1) throw fail('.rings: a mandala\'s last ring is its core, one zone');
  if (v.shape === 'chain' && v.rings.some((r) => r.length !== 1)) throw fail('.rings: a chain is one zone a ring');
  if (v.shape === 'hub' && (v.rings.length !== 2 || v.rings[0].length !== 1)) throw fail('.rings: a hub is two rings, the home alone in the first');
  if (v.shape === 'open' && v.rings.length !== 1) throw fail('.rings: an open world is one ring, each zone joined to its neighbours');
  if (v.gates !== undefined) {
    if (!isObj(v.gates)) throw fail('.gates is { <zone>: { key, keyAt } | { needs } }: what opens the way into a zone');
    for (const [z, g] of Object.entries(v.gates)) {
      if (!seen.has(z)) throw fail(`.gates.${z}: no such zone`);
      if (z === v.rings[0][0]) throw fail(`.gates.${z}: where the world sets out is never shut`);
      if (!isObj(g) || (g.needs === undefined) === (g.key === undefined)) throw fail(`.gates.${z} is { key, keyAt } or { needs }, one or the other`);
      if (g.key !== undefined && !seen.has(g.keyAt)) throw fail(`.gates.${z}.keyAt is the zone its key is found in`);
    }
  }
  return v;
}

/** The links it lowers to, in ring order. */
export function megaworldLinks(M) {
  const R = M.rings, out = [], gate = (to) => {
    const g = M.gates?.[to];
    return g ? (g.key !== undefined ? { key: g.key, keyAt: g.keyAt } : { needs: g.needs }) : {};
  };
  const link = (from, to) => out.push({ from, to, kind: gate(to).key || gate(to).needs ? 'gate' : 'road', ...gate(to) });
  if (M.shape === 'open') { const [ring] = R; ring.forEach((z, i) => { if (ring.length > 2 || i === 0) link(z, ring[(i + 1) % ring.length]); }); return out; }
  for (let i = 0; i + 1 < R.length; i++) {
    const inner = R[i + 1];
    // (a zone joins out to the next ring by its share of the way round its own)
    inner.forEach((to, j) => link(R[i][Math.min(R[i].length - 1, Math.floor((j * R[i].length) / inner.length))], to));
  }
  return out;
}

/** WCD's laws at the world's scale. They advise. */
export function megaworldLaws(M) {
  const links = megaworldLinks(M), laws = [], R = M.rings, depth = new Map(R.flatMap((r, i) => r.map((z) => [z, i])));
  // REACHED, walking only what a key found on the way (or a story flag) lets through
  const seen = new Set([R[0][0]]);
  const opens = (l) => !l.key || seen.has(l.keyAt);
  for (let moved = true; moved;) { moved = false; for (const l of links) for (const [a, b] of [[l.from, l.to], [l.to, l.from]]) if (seen.has(a) && !seen.has(b) && opens(l)) { seen.add(b); moved = true; } }
  const lost = [...depth.keys()].filter((z) => !seen.has(z));
  laws.push({ law: 'reached', ok: !lost.length, says: lost.length ? `never reached: ${lost.join(', ')} (a key found behind its own gate?)` : 'every zone is reached, each key before its gate' });
  if (M.shape === 'mandala') {
    const core = R.at(-1)[0], gated = links.some((l) => l.to === core && (l.key || l.needs));
    laws.push({ law: 'gated', ok: gated, says: gated ? `the way into ${core} is gated` : `nothing shuts the way into the core, ${core}: a key or a story flag makes it the climb's end` });
    const inside = Object.values(M.gates ?? {}).filter((g) => g.key).every((g) => depth.get(g.keyAt) < R.length - 1);
    laws.push({ law: 'keys-inside', ok: inside, says: inside ? 'every key is found on the way in, none past the core' : 'a key lies in the core, past what it opens' });
  }
  return laws;
}

/** The world with its links, topology, start and hub laid from its megaworld (read at authoring, the recipe's own words
 * thereafter). A hand-written link goes with it: the rings are what is said. */
export function stampMegaworld(world) {
  const M = world?.megaworld;
  if (M === undefined) return world;
  readMegaworld(M, world.levels);
  const home = M.rings[0][0];
  return { ...world, topology: 'interconnected', start: home, links: megaworldLinks(M), ...(M.shape === 'hub' ? { hub: home } : {}) };
}

/** The game manifest's atlas: each ring's zones as the level refs the shell knows, each its first stage. */
export function atlasOf(M, stages, refs) {
  const first = (level) => { const i = stages.findIndex((s) => s.level === level && s.section !== 'interior'); return i < 0 ? null : refs[i]; };
  return { slice: ATLAS_SLICE, shape: M.shape, rings: M.rings.map((r) => r.map(first).filter(Boolean)).filter((r) => r.length) };
}

/** A mandala's core, the game's final level: its first win completes the game. Any other shape has no one end. */
export function coreOf(M, stages, refs) {
  if (M?.shape !== 'mandala') return null;
  const i = stages.findIndex((s) => s.level === M.rings.at(-1)[0] && s.section !== 'interior');
  return i < 0 ? null : refs[i];
}
