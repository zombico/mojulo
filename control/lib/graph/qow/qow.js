/**
 * THE QUEST OPEN WORLD (QOW) — the walled-core dungeon's opposite pole. A WCD forces the player in: layers on a critical
 * path toward a core, each gated. A QOW never does: its map is REGIONS joined sideways, connected and loaded as they are
 * passed, every one reached without a gate, always two ways round; a lock is optional, a side door, never the only way
 * on. Its regions are a geocity's neighbourhoods and its region graph (geocity/design.js: each neighbourhood a node,
 * each pair across an arterial an edge with its portal), a city or an island; its quests are placed on them; its
 * landmarks are what every region sees to find its way.
 *
 * The recipe (a design_game world's `qow`):
 *   { map: { geocity: { … }, seed? },                       the regions: a geocity's (its own recipe, geocity/metro.js)
 *     spawn?: '<region id>',                                 where play starts (by default the core's nearest the seat)
 *     locks?: [{ region, gate: { clearance: 1…9 } | { power: '<id>' }, why? }],   a region kept shut until its gate opens
 *     quests?: [{ id, at: '<region id>', kind?: 'main' | 'side', after?: ['<quest id>'] }],
 *     landmarks?: 'auto' | [{ at: '<region id>', name?, height? }],   what every region sees (auto: the core's tallest
 *                                                            tower and each secondary node's, geocity/heights.js)
 *     stream?: { hops?, blocks? },                           a region's stream ring: itself and its neighbours `hops`
 *                                                            away, at most `blocks` blocks loaded at once
 *     level?: '<world level id>' }                           the level it is played in (city hunter's)
 *
 * Refused (malformed): an unknown key, a region or a quest that is none, a lock with no gate, a level the world lacks.
 * Advised (the PRINCIPLES, as laws: measured, never refusing), each { law, holds, says }:
 *   open        every region is reached from the spawn without passing a lock (the locked ones aside)
 *   sideways    no open region is the only way between two others: always two ways round (no cut vertex)
 *   unforced    no main quest waits behind a lock or on a chain that runs through every region one after another
 *   seen        every region sees a landmark: within its sight (its height times SIGHT)
 *   streamed    every region's stream ring holds at most its blocks: what is loaded as it is passed stays small
 *   spread      the quests stand in more than one ring of the city: the world is crossed, not entered
 *
 *   QOW_PRINCIPLES
 *   readQow(spec, { levels? }) → { regions, edges, spawn, locks, quests, landmarks, stream, level?, laws }
 *   qowLaws(read)              → the laws above
 *
 * Pure: the map's dice are its geocity's.
 */
import { designGeocity } from '../geocity/design.js';
import { partsOf } from '../geocity/laws.js';

export const QOW_PRINCIPLES = Object.freeze({
  open: 'Open: every region is reached from the spawn without passing a lock.',
  sideways: 'Sideways: no region is the only way between two others; always two ways round.',
  unforced: 'Unforced: no main quest waits behind a lock, and the quests are not one corridor through the map.',
  seen: 'Seen: every region sees a landmark to find its way by.',
  streamed: 'Streamed: what is loaded as a region is passed (it and its neighbours) stays small.',
  spread: 'Spread: the quests stand in more than one ring of the city; the world is crossed, not entered.',
});
// how far a landmark is seen: this many times its height (a 200 m tower over 6 km of a clear day's city)
export const SIGHT = 30;
const KEYS = ['map', 'spawn', 'locks', 'quests', 'landmarks', 'stream', 'level'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`qow: ${msg}`); };
const law = (id, holds, says) => ({ law: id, holds, says });
const r1 = (v) => Math.round(v * 10) / 10;

/** The cut vertices of a graph (an undirected { nodes, edges: [{ a, b }] }). */
export function cutsOf(nodes, edges) {
  const adj = new Map(nodes.map((n) => [n, []]));
  for (const e of edges) if (adj.has(e.a) && adj.has(e.b)) { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
  const disc = new Map(), low = new Map(), out = new Set();
  let t = 0;
  for (const root of nodes) {
    if (disc.has(root)) continue;
    let rootKids = 0;
    const stack = [[root, null, 0]];
    disc.set(root, t); low.set(root, t); t++;
    while (stack.length) {
      const top = stack[stack.length - 1], [u, parent] = top, list = adj.get(u);
      if (top[2] < list.length) {
        const v = list[top[2]++];
        if (v === parent) continue;
        if (!disc.has(v)) { disc.set(v, t); low.set(v, t); t++; stack.push([v, u, 0]); if (u === root) rootKids++; } else low.set(u, Math.min(low.get(u), disc.get(v)));
      } else {
        stack.pop();
        if (stack.length) { const p = stack[stack.length - 1][0]; low.set(p, Math.min(low.get(p), low.get(u))); if (p !== root && low.get(u) >= disc.get(p)) out.add(p); }
      }
    }
    if (rootKids > 1) out.add(root);
  }
  return [...out];
}

/** The recipe's `qow`, checked and read over its map. */
export function readQow(spec, { levels = null } = {}) {
  if (!isObj(spec)) no('qow is { map, spawn?, locks?, quests?, landmarks?, stream?, level? }');
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a setting of a quest open world (${KEYS.join(', ')})`);
  if (!isObj(spec.map) || !isObj(spec.map.geocity ?? {})) no('map is { geocity: { … }, seed? }: the regions are a geocity\'s');
  for (const k of Object.keys(spec.map)) if (!['geocity', 'seed'].includes(k)) no(`map.${k} is not a setting (geocity, seed)`);
  if (spec.map.seed !== undefined && !Number.isInteger(spec.map.seed)) no('map.seed is an integer');
  const d = (() => { try { return designGeocity(spec.map.geocity ?? {}, { seed: spec.map.seed ?? 1 }); } catch (e) { no(`map: ${e.message}`); return null; } })();
  const office = d.grammar.floorH.office;
  const regions = d.regions.map((r) => ({ id: r.id, ring: r.ring, builds: r.builds, rect: r.rect, mid: r.mid, park: r.park, blocks: r.blocks.length, storeys: r.storeys.median, ...(r.node ? { node: r.node } : {}), ...(r.beyond.length ? { beyond: r.beyond } : {}) }));
  const byId = new Map(regions.map((r) => [r.id, r])), has = (id, what) => { if (!byId.has(id)) no(`${what} '${id}' is not a region (${regions.map((r) => r.id).join(', ')})`); return id; };
  const near = (r) => Math.hypot(r.mid[0] - d.seat[0], r.mid[1] - d.seat[1]);
  const spawn = spec.spawn !== undefined ? has(spec.spawn, 'spawn') : regions.filter((r) => r.builds === 'core' && !r.park).sort((a, b) => near(a) - near(b))[0]?.id ?? regions[0].id;
  const locks = (spec.locks ?? []).map((l, i) => {
    if (!isObj(l)) no(`locks[${i}] is { region, gate, why? }`);
    for (const k of Object.keys(l)) if (!['region', 'gate', 'why'].includes(k)) no(`locks[${i}].${k} is not a setting (region, gate, why)`);
    const g = l.gate;
    if (!isObj(g) || !((Number.isInteger(g.clearance) && g.clearance >= 1 && g.clearance <= 9 && !g.power) || (typeof g.power === 'string' && g.clearance === undefined))) no(`locks[${i}].gate is { clearance: 1…9 } or { power: '<id>' }`);
    if (l.region === spawn) no(`locks[${i}]: the spawn '${spawn}' is never locked`);
    return { region: has(l.region, `locks[${i}].region`), gate: { ...g }, ...(l.why ? { why: String(l.why) } : {}) };
  });
  const quests = (spec.quests ?? []).map((q, i) => {
    if (!isObj(q) || typeof q.id !== 'string') no(`quests[${i}] is { id, at, kind?, after? }`);
    for (const k of Object.keys(q)) if (!['id', 'at', 'kind', 'after'].includes(k)) no(`quests[${i}].${k} is not a setting (id, at, kind, after)`);
    if (q.kind !== undefined && !['main', 'side'].includes(q.kind)) no(`quests[${i}].kind is main or side`);
    if (q.after !== undefined && !(Array.isArray(q.after) && q.after.every((x) => typeof x === 'string'))) no(`quests[${i}].after is quest ids`);
    return { id: q.id, at: has(q.at, `quests[${i}].at`), kind: q.kind ?? 'side', after: q.after ?? [] };
  });
  const qIds = new Set(quests.map((q) => q.id));
  for (const q of quests) for (const a of q.after) if (!qIds.has(a)) no(`quest '${q.id}' comes after '${a}', which is no quest`);
  // the landmarks: the core's tallest tower and each node's, unless the recipe names its own
  let landmarks;
  if (spec.landmarks === undefined || spec.landmarks === 'auto') {
    const tallest = (r) => Math.max(r.storeys.median * office, ...r.blocks.flatMap((b) => (b.towers ?? []).map((t) => t.storeys * office)));
    const core = d.regions.filter((r) => r.builds === 'core').sort((a, b) => tallest(b) - tallest(a))[0];
    landmarks = [...(core ? [{ at: core.id, name: 'the core', height: r1(tallest(core)) }] : []),
      ...d.heights.nodes.map((n) => { const r = d.regions.filter((x) => x.node === n.id).sort((a, b) => tallest(b) - tallest(a))[0]; return r && r.id !== core?.id ? { at: r.id, name: n.id, height: r1(tallest(r)) } : null; }).filter(Boolean)];
  } else {
    if (!Array.isArray(spec.landmarks)) no('landmarks is \'auto\' or [{ at, name?, height? }]');
    landmarks = spec.landmarks.map((m, i) => {
      if (!isObj(m)) no(`landmarks[${i}] is { at, name?, height? }`);
      const r = d.regions.find((x) => x.id === has(m.at, `landmarks[${i}].at`));
      return { at: m.at, name: m.name ?? m.at, height: m.height ?? r1(Math.max(r.storeys.median * office, ...r.blocks.flatMap((b) => (b.towers ?? []).map((t) => t.storeys * office)))) };
    });
  }
  // the stream ring: each region and its neighbours `hops` away (what is loaded as it is passed)
  const S = spec.stream ?? {};
  if (!isObj(S) || Object.keys(S).some((k) => !['hops', 'blocks'].includes(k))) no('stream is { hops?, blocks? }');
  const hops = S.hops ?? 1, budget = S.blocks ?? 160;
  if (!(Number.isInteger(hops) && hops >= 0 && hops <= 3)) no('stream.hops is 0 to 3');
  if (!(Number.isInteger(budget) && budget > 0)) no('stream.blocks is a whole number of blocks');
  const adj = new Map(regions.map((r) => [r.id, []]));
  for (const e of d.graph.edges) { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
  const stream = Object.fromEntries(regions.map((r) => {
    const seen = new Set([r.id]);
    let front = [r.id];
    for (let h = 0; h < hops; h++) front = front.flatMap((u) => adj.get(u).filter((v) => !seen.has(v) && seen.add(v)));
    return [r.id, [...seen]];
  }));
  if (spec.level !== undefined && (typeof spec.level !== 'string' || (levels && !levels.includes(spec.level)))) no(`level '${spec.level}' is not one of the world's levels${levels ? ` (${levels.join(', ')})` : ''}`);
  const read = { regions, edges: d.graph.edges.map((e) => ({ id: e.id, a: e.a, b: e.b, street: e.street, portal: e.portal, z: e.z })), seat: d.seat, spawn, locks, quests, landmarks, stream: { hops, blocks: budget, rings: stream }, ...(spec.level ? { level: spec.level } : {}) };
  read.laws = qowLaws(read);
  return read;
}

export function qowLaws(Q) {
  const out = [], locked = new Set(Q.locks.map((l) => l.region)), open = Q.regions.map((r) => r.id).filter((id) => !locked.has(id));
  const openEdges = Q.edges.filter((e) => !locked.has(e.a) && !locked.has(e.b));
  // open: one part, the spawn's, among the open regions
  const parts = partsOf({ nodes: open, edges: openEdges }), mine = parts.find((p) => p.includes(Q.spawn)) ?? [], cut = open.filter((id) => !mine.includes(id));
  out.push(law('open', !cut.length, cut.length ? `${cut.join(', ')} ${cut.length === 1 ? 'is' : 'are'} reached only through a lock` : `every region reached from '${Q.spawn}' without a gate${locked.size ? ` (${[...locked].join(', ')} locked aside)` : ''}`));
  // sideways: no cut vertex among the open regions
  const cuts = cutsOf(open, openEdges);
  out.push(law('sideways', !cuts.length, cuts.length ? `${cuts.join(', ')} ${cuts.length === 1 ? 'is' : 'are'} the only way between parts of the map` : 'always two ways round'));
  // unforced: no main quest behind a lock; the quests' chain not a corridor through every region
  const behind = Q.quests.filter((q) => q.kind === 'main' && locked.has(q.at)).map((q) => q.id);
  const depth = (q, seen = new Set()) => (seen.has(q.id) ? 0 : (seen.add(q.id), 1 + Math.max(0, ...q.after.map((a) => depth(Q.quests.find((x) => x.id === a), seen)))));
  const longest = Q.quests.length ? Math.max(...Q.quests.map((q) => depth(q))) : 0, corridor = Q.quests.length >= 3 && longest === Q.quests.length;
  out.push(law('unforced', !behind.length && !corridor, [...behind.map((id) => `the main quest '${id}' waits behind a lock`), ...(corridor ? [`every quest waits on the one before it: a corridor of ${longest}`] : [])].join('; ') || 'no main quest behind a lock; the quests open side by side'));
  // seen: every region within sight of a landmark
  const sees = (r) => Q.landmarks.some((m) => { const L = Q.regions.find((x) => x.id === m.at); return Math.hypot(L.mid[0] - r.mid[0], L.mid[1] - r.mid[1]) <= m.height * SIGHT; });
  const blind = Q.regions.filter((r) => !sees(r)).map((r) => r.id);
  out.push(law('seen', Q.landmarks.length > 0 && !blind.length, !Q.landmarks.length ? 'no landmark to find a way by' : blind.length ? `${blind.join(', ')} see${blind.length === 1 ? 's' : ''} no landmark` : `every region sees ${Q.landmarks.map((m) => `${m.name} (${m.height} m)`).join(' or ')}`));
  // streamed: each stream ring's blocks under the budget
  const blocksOf = new Map(Q.regions.map((r) => [r.id, r.blocks]));
  const heavy = Object.entries(Q.stream.rings).filter(([, ids]) => ids.reduce((a, id) => a + blocksOf.get(id), 0) > Q.stream.blocks).map(([id]) => id);
  out.push(law('streamed', !heavy.length, heavy.length ? `${heavy.join(', ')} load more than ${Q.stream.blocks} blocks with their neighbours` : `each region loads at most ${Q.stream.blocks} blocks with its neighbours ${Q.stream.hops} away`));
  // spread: the quests across more than one ring
  const rings = new Set(Q.quests.map((q) => Q.regions.find((r) => r.id === q.at).ring));
  out.push(law('spread', Q.quests.length < 2 || rings.size > 1, Q.quests.length < 2 ? 'fewer than two quests' : rings.size > 1 ? `quests in the ${[...rings].join(', ')}` : `every quest in the ${[...rings][0]}`));
  return out;
}
