/**
 * A CITY SEGMENT AS A LEVEL. A segment (segments.js) is played the way a building on the rail is (structure/level.js):
 * its recipe asks with one field, `level: { segment }`, and its `game` channel, walker, camera and colliders are
 * lowered from the city on every read, never stored, so an edit to the city moves its levels with it.
 *
 *   - its ways out: one reach-exit per neighbour, named for it (`exit: <segment id>`), at the portal on their shared
 *     edge, where the street crosses; a map game's level exits name the same ids
 *   - its arrivals: coming in from a neighbour's level, the walker stands a few metres inside that portal
 *     (`arrive:<that level's ref>`); a segment's neighbours' levels are `<city ref>-<segment id>` unless `refs` says
 *   - its spawn: the crossing nearest the segment's middle, facing along its street
 *   - its walls: every built mass (lots and sites) in reach, and the segment's own edges, open only at its portals:
 *     the city goes on past them as the backdrop, and a walker leaves only by a street
 *   - a segment with no neighbours: its goal is the crossing farthest along the walk from its spawn
 *
 * Everything is in the world's units (the legacy city's, CITY_METERS_PER_UNIT).
 */
import { CITY_METERS_PER_UNIT } from '../fractal-city.js';
import { registerLevelKind } from '../../structure/level.js';
import { designCity } from './design.js';

const U = CITY_METERS_PER_UNIT;
const r3 = (v) => Math.round(v * 1000) / 1000;
const u = (v) => r3(v / U);
export const CITY_LEVEL = Object.freeze({ eye: 1.7, speed: 5, wall: 8, arrive: 7, radius: 0.4 });

const inside = (rect, x, y, m = 0) => x >= rect.x0 - m && x <= rect.x1 + m && y >= rect.y0 - m && y <= rect.y1 + m;

function walkPath(g, from, to) {
  const adj = g.nodes.map(() => []);
  for (const e of g.edges) { adj[e.a].push([e.b, e.len]); adj[e.b].push([e.a, e.len]); }
  const dist = new Float64Array(g.nodes.length).fill(Infinity), prev = new Int32Array(g.nodes.length).fill(-1), done = new Uint8Array(g.nodes.length);
  dist[from] = 0;
  for (;;) {
    let v = -1;
    for (let i = 0; i < dist.length; i++) if (!done[i] && dist[i] < Infinity && (v < 0 || dist[i] < dist[v])) v = i;
    if (v < 0) break;
    done[v] = 1;
    for (const [w, len] of adj[v]) if (dist[v] + len < dist[w]) { dist[w] = dist[v] + len; prev[w] = v; }
  }
  const path = [];
  if (to !== undefined && dist[to] < Infinity) for (let v = to; v >= 0; v = prev[v]) path.unshift(v);
  return { dist, path };
}

/** The level a segment makes, in units: { spawn, heading, exits, arrivals, goal?, colliders, via }; or { error }. */
export function segmentLevel(d, segId, { refs = {}, cityRef = null } = {}) {
  const seg = (d.segments || []).find((s) => s.id === segId);
  if (!seg) return { error: `the city has no segment '${segId}' (${(d.segments || []).map((s) => s.id).join(', ') || 'cut it with segments: true'})` };
  const R = seg.rect, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, g = d.walk;
  const nodesIn = g.nodes.filter((n) => inside(R, n.x, n.y, -2) && n.degree >= 2);
  if (!nodesIn.length) return { error: `segment '${segId}' has no street to stand on` };
  const start = nodesIn.reduce((b, n) => (!b || Math.hypot(n.x - cx, n.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? n : b), null);
  const edge = g.edges.find((e) => (e.a === start.id || e.b === start.id) && inside(R, g.nodes[e.a === start.id ? e.b : e.a].x, g.nodes[e.a === start.id ? e.b : e.a].y));
  const far = edge ? g.nodes[edge.a === start.id ? edge.b : edge.a] : { x: cx, y: cy };
  const heading = Math.atan2(far.y - start.y, far.x - start.x);
  const refOf = (id) => refs[id] ?? (cityRef ? `${cityRef}-${id}` : null);
  // each way out: at the portal, and coming in by it, a few metres inside along the crossing street
  const exits = seg.neighbours.map((nb) => {
    const p = nb.portal, n = { e: [-1, 0], w: [1, 0], s: [0, -1], n: [0, 1] }[nb.side], step = p.half + CITY_LEVEL.arrive;
    return { id: nb.id, to: refOf(nb.id), at: p.at, radius: p.half + 1.5, arrive: [p.at[0] + n[0] * step, p.at[1] + n[1] * step], street: p.street, side: nb.side, gap: p.half };
  });
  const { dist } = walkPath(g, start.id);
  let goal = null;
  if (!exits.length) {
    const best = nodesIn.reduce((b, n) => (dist[n.id] < Infinity && (!b || dist[n.id] > dist[b.id]) ? n : b), null);
    goal = { at: [best.x, best.y], node: best.id };
  }
  // the audit's walk: along the streets to the first way out (or the goal)
  const target = goal ? goal.node : (() => { const p = exits[0].at; return nodesIn.reduce((b, n) => (!b || Math.hypot(n.x - p[0], n.y - p[1]) < Math.hypot(b.x - p[0], b.y - p[1]) ? n : b), null).id; })();
  const via = walkPath(g, start.id, target).path.map((i) => [g.nodes[i].x, g.nodes[i].y]);
  // the walls: every built mass within reach, and the segment's edges with a gap at each portal
  const reach = 40, colliders = [];
  for (const l of d.lots) if (l.use !== 'parking' && l.h > 0 && !(l.x1 < R.x0 - reach || l.x0 > R.x1 + reach || l.y1 < R.y0 - reach || l.y0 > R.y1 + reach)) colliders.push({ min: [u(l.x0), u(l.y0), 0], max: [u(l.x1), u(l.y1), u(l.h)], of: `lot:${l.id}` });
  for (const s of d.sites) if (s.mass && !(s.mass.x1 < R.x0 - reach || s.mass.x0 > R.x1 + reach || s.mass.y1 < R.y0 - reach || s.mass.y0 > R.y1 + reach)) colliders.push({ min: [u(s.mass.x0), u(s.mass.y0), 0], max: [u(s.mass.x1), u(s.mass.y1), u(s.mass.h)], of: `site:${s.id}` });
  const T = 0.5, H = CITY_LEVEL.wall;
  const side = (name, a0, a1, fixed, horizontal) => {
    const gaps = exits.filter((x) => x.side === name).map((x) => [(horizontal ? x.at[0] : x.at[1]) - x.gap, (horizontal ? x.at[0] : x.at[1]) + x.gap]).sort((p, q) => p[0] - q[0]);
    let a = a0;
    for (const [g0, g1] of [...gaps, [a1, a1]]) {
      if (g0 - a > 0.2) colliders.push(horizontal ? { min: [u(a), u(fixed - T), 0], max: [u(g0), u(fixed + T), u(H)], of: `edge:${name}` } : { min: [u(fixed - T), u(a), 0], max: [u(fixed + T), u(g0), u(H)], of: `edge:${name}` });
      a = Math.max(a, g1);
    }
  };
  side('n', R.x0, R.x1, R.y0, true); side('s', R.x0, R.x1, R.y1, true); side('w', R.y0, R.y1, R.x0, false); side('e', R.y0, R.y1, R.x1, false);
  return {
    segment: seg.id, rect: R,
    spawn: [u(start.x), u(start.y), 0], heading: r3(heading),
    exits: exits.map((x) => ({ ...x, at: [u(x.at[0]), u(x.at[1]), 0], radius: u(x.radius), arrive: [u(x.arrive[0]), u(x.arrive[1]), 0] })),
    ...(goal ? { goal: { at: [u(goal.at[0]), u(goal.at[1]), 0] } } : {}),
    via: via.map((p) => [u(p[0]), u(p[1])]),
    colliders,
  };
}

/**
 * A city manifest with its segment's level lowered (the building-on-the-rail contract): the `game` channel (a
 * reach-exit per way out, or the goal), arrivals that move the walker, a first-person walker at the spawn, its camera,
 * and the walls. `ref` is the level's own sketch ref; `cityRef` the city it was cut from.
 */
export function withCityLevel(m, d, ref) {
  const L = segmentLevel(d, m.level.segment, { refs: m.level.refs ?? {}, cityRef: m.cityRef ?? null });
  if (L.error) throw new Error(`level: ${L.error}`);
  const eye = u(CITY_LEVEL.eye);
  const mechanics = L.goal
    ? [{ kind: 'reach-exit', at: L.goal.at, radius: u(4), ...(L.via.length ? { via: L.via } : {}) }]
    : L.exits.map((x, i) => ({ kind: 'reach-exit', exit: x.id, at: x.at, radius: x.radius, ...(i === 0 && L.via.length ? { via: L.via } : {}) }));
  const arrivals = L.exits.filter((x) => x.to);
  const game = { levelRef: ref, mechanics, fall: { mode: 'respawn' }, ...(arrivals.length ? { arrive: arrivals.map((x) => x.to) } : {}) };
  return {
    ...m,
    game,
    entities: [{ id: 'player', pilotable: true, rule: { type: 'walk', speed: r3(CITY_LEVEL.speed / U), turn: 2.4, eye, turnMode: 'look', lookPitch: true, keyTurn: true, strafe: 1, collideRadius: u(CITY_LEVEL.radius), collideHeight: eye }, body: { type: 'none' }, transform: { pos: [L.spawn[0], L.spawn[1], eye], heading: L.heading } }],
    camera: { rule: 'eye', target: 'player', height: 0, mouseLook: true },
    events: { reactions: arrivals.map((x) => ({ on: `arrive:${x.to}`, do: 'move', target: 'player', to: [x.arrive[0], x.arrive[1], eye] })) },
    colliders: L.colliders,
    walk: false,
  };
}

// a city segment is lowered as a building on the rail is, wherever a level is (world-scene, game-resolve)
registerLevelKind('city', (m, ref) => withCityLevel(m, designCity(m), ref));
