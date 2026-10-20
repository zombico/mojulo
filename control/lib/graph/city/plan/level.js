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
 *   - its buildings (doors.js): a walk-in's lobby is part of the map, walked into off the street; a door-scene's door is
 *     a `door` zone on the walk before it, its inside a level of its own the game links to it
 *   - its walls: every built mass (lots and sites) in reach, every street tree's trunk and planter (the walk's own), and the segment's own edges, open only at its portals:
 *     the city goes on past them as the backdrop, and a walker leaves only by a street
 *   - a segment with no neighbours: its goal is the crossing farthest along the walk from its spawn
 *
 * Everything is in the world's units (the legacy city's, CITY_METERS_PER_UNIT).
 *
 * THE HERO (opt-in `level.hero`: { ref?, gaits?, wall?, gear? }, the city stalker): a third-person hero plays the segment in place of
 * the walker. It is the player slot every game uses (playscape/player.js playerWorld: the platform rule, a figure-rig
 * body, its clips), tuned in metres (CITY_HERO) and turned into the city's units once here: every length and speed of
 * its rule and its camera divided by the unit, its body drawn at 1 / unit. With no `ref` a stand-in box plays it. Its
 * roofs are ground (a lot's box top, the page's faces and the sim's alike), the page's wall pull-in keeps a tower from
 * standing between the chase camera and the hero (its stand-off read off the hero's own capsule, so it holds in the
 * city's units: follow-pull-in.js), and the segment's edges rise to the sky (a hero who climbs is not held by
 * a walker's 8 m wall, and not one it can hold: `hold: false`). It holds any other wall (wall.js), crawls it and mantles
 * onto its roof, unless `wall: false`, and swings on the swinger's line (swing.js; F held in the air, a zip on the ground),
 * unless `gear: false`; its figure's clips fall back for those states (player.js traversalStates).
 * A hero's district carries a cloud deck (`clouds`, unless the recipe names its own), dark by night. Absent, the walker
 * plays it, byte for byte.
 */
import { CITY_METERS_PER_UNIT } from '../fractal-city.js';
import { registerLevelKind } from '../../structure/level.js';
import { designCity } from './design.js';
import { lobbyOf, LOBBY } from './doors.js';
import { cityGreen, PLANTER } from './green.js';
import { playerWorld, traversalStates } from '../../playscape/player.js';
import { readCityLook, readPaint } from './look.js';
import { resolveLookSpec } from '../../era/look.js';
import { reachOf } from '../../game/reach.js';
// a tree's trunk as a walker meets it (m, half its side)
const TRUNK = 0.35;

const U = CITY_METERS_PER_UNIT;
const r3 = (v) => Math.round(v * 1000) / 1000;
const u = (v) => r3(v / U);
export const CITY_LEVEL = Object.freeze({ eye: 1.7, speed: 5, wall: 8, arrive: 7, radius: 0.4 });
/** The city's hero, in metres: its rule's run, jump and fall (a person's, as playerWorld's, falling as the platform rule
 *  does by default), its capsule, the chase camera, and the sky its edges rise to over the tallest mass in reach. */
export const CITY_HERO = Object.freeze({
  rule: { speed: 6, jumpSpeed: 6.5, gravity: 20, maxFall: 26, step: 0.35, snap: 0.15, collideRadius: 0.35, collideHeight: 1.7, wall: true, gear: 'swinger' },
  camera: { dist: 5.5, height: 2.4, lookH: 1.1, lead: 1.5 },
  standIn: { size: [0.5, 0.5, 1.7], color: '#d8b04a' },
  sky: 60,
  // the cloud deck over a hero's district (world-scene.js composeCloudDeck, its band defaults already in the city's units:
  // 44 m over the tallest mass, 48 m deep), dark by night so it reads against the sky instead of glowing
  clouds: { day: { coverage: 0.35 }, night: { coverage: 0.4, color: [0.16, 0.17, 0.2] } },
});
// the lengths a platform rule reads (and its speeds and accelerations, in lengths per second): the ones a unit divides
const RULE_LENGTHS = ['speed', 'jumpSpeed', 'gravity', 'fallGravity', 'maxFall', 'step', 'snap', 'stride', 'collideRadius', 'collideHeight', 'eye', 'glideFall'];
/** A power's grant in metres (gameworld actions.js TRAVERSAL_MOVES), in the city's units: its lengths divided. */
export function grantInUnits(g) {
  const { metre: _m, ...rest } = ruleInUnits(g);
  return rest;
}
/** A rule in metres, in the city's units: its lengths divided, and `metre` (world units per metre) stamped for what
 *  keeps its defaults in metres (the wall's, wall.js). */
export function ruleInUnits(rule) {
  return { ...Object.fromEntries(Object.entries(rule).map(([k, v]) => [k, RULE_LENGTHS.includes(k) && Number.isFinite(v) ? u(v) : v])), metre: u(1) };
}

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
export function segmentLevel(d, segId, { refs = {}, cityRef = null, route = null, ways = [], hero = false } = {}) {
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
  const portals = seg.neighbours.map((nb) => {
    const p = nb.portal, n = { e: [-1, 0], w: [1, 0], s: [0, -1], n: [0, 1] }[nb.side], step = p.half + CITY_LEVEL.arrive;
    return { id: nb.id, to: refOf(nb.id), at: p.at, radius: p.half + 1.5, arrive: [p.at[0] + n[0] * step, p.at[1] + n[1] * step], street: p.street, side: nb.side, gap: p.half };
  });
  for (const k of ['from', 'to']) if (route && route[k] !== undefined && !portals.some((x) => x.id === route[k])) return { error: `segment '${segId}' has no neighbour '${route[k]}' to be routed ${k} (neighbours: ${portals.map((x) => x.id).join(', ') || 'none'})` };
  // on a route only its two portals open: the way it came in by, the way on (its exit); the rest of the city is backdrop
  const exits = route ? portals.filter((x) => x.id === route.to) : portals;
  const open = route ? portals.filter((x) => x.id === route.from || x.id === route.to) : portals;
  // entered along a route, the walker stands where it came in, facing on into the segment
  let start0 = start;
  const cameIn = route && route.from ? portals.find((x) => x.id === route.from) : null;
  if (cameIn) start0 = nodesIn.reduce((b, n) => (!b || Math.hypot(n.x - cameIn.arrive[0], n.y - cameIn.arrive[1]) < Math.hypot(b.x - cameIn.arrive[0], b.y - cameIn.arrive[1]) ? n : b), null);
  const { dist } = walkPath(g, start0.id);
  let goal = null;
  // the end (no way on, or a map world's way out at it): the crossing farthest along the walk from where it starts
  const far0 = nodesIn.reduce((b, n) => (dist[n.id] < Infinity && (!b || dist[n.id] > dist[b.id]) ? n : b), null);
  if (!exits.length) {
    const best = nodesIn.reduce((b, n) => (dist[n.id] < Infinity && (!b || dist[n.id] > dist[b.id]) ? n : b), null);
    goal = { at: [best.x, best.y], node: best.id };
  }
  // the audit's walk: along the streets to the first way out (or the goal)
  const target = goal ? goal.node : (() => { const p = exits[0].at; return nodesIn.reduce((b, n) => (!b || Math.hypot(n.x - p[0], n.y - p[1]) < Math.hypot(b.x - p[0], b.y - p[1]) ? n : b), null).id; })();
  const via = walkPath(g, start0.id, target).path.map((i) => [g.nodes[i].x, g.nodes[i].y]);
  // a map world's ways out of the city: at its start, a stride behind where the walker stands; at its end, its far crossing
  const e0 = g.edges.find((e) => e.a === start0.id || e.b === start0.id), f0 = e0 ? g.nodes[e0.a === start0.id ? e0.b : e0.a] : null;
  const heading0 = cameIn ? (() => { const n = via[1] ?? [far0.x, far0.y]; return Math.atan2(n[1] - start0.y, n[0] - start0.x); })() : start0 === start ? heading : Math.atan2((f0?.y ?? cy) - start0.y, (f0?.x ?? cx) - start0.x);
  const extra = ways.map((w) => {
    const at = w.at === 'end' ? [far0.x, far0.y] : [start0.x - 9 * Math.cos(heading0), start0.y - 9 * Math.sin(heading0)];
    const arrive = w.at === 'end' ? [far0.x + (start0.x - far0.x) * 0.1, far0.y + (start0.y - far0.y) * 0.1] : [start0.x, start0.y];
    return { id: w.id, to: w.to, at, radius: 4, arrive, ...(w.gate ? { gate: w.gate } : {}), way: true };
  });
  // the walls: every built mass within reach, and the segment's edges with a gap at each portal
  const reach = 40, colliders = [];
  // a walk-in lot is its lobby's walls and the building over it; a door-scene lot is solid, its door a zone before it
  const entries = (d.entries || []).filter((e) => !e.error && e.segment === seg.id), walkIn = new Set(entries.filter((e) => e.enter === 'walk').map((e) => e.lot));
  const toU = (c) => ({ ...c, min: c.min.map(u), max: c.max.map(u) });
  for (const l of d.lots) {
    if (l.use === 'parking' || !(l.h > 0) || l.x1 < R.x0 - reach || l.x0 > R.x1 + reach || l.y1 < R.y0 - reach || l.y0 > R.y1 + reach) continue;
    if (walkIn.has(l.id)) {
      const lb = lobbyOf(l, {});
      colliders.push(...lb.colliders.filter((c) => !c.of.endsWith('stair')).map(toU), { min: [u(l.x0), u(l.y0), u(lb.height)], max: [u(l.x1), u(l.y1), u(l.h)], of: `lot:${l.id}:over` });
      // the lobby's stair: one ramp of a box under its flight (a walker goes no higher than the level does)
      const st = lb.colliders.filter((c) => c.of.endsWith('stair'));
      if (st.length) colliders.push(toU({ min: [Math.min(...st.map((c) => c.min[0])), Math.min(...st.map((c) => c.min[1])), 0], max: [Math.max(...st.map((c) => c.max[0])), Math.max(...st.map((c) => c.max[1])), LOBBY.height], of: `lobby:${l.id}:stair` }));
      // behind the lobby, the building's ground storey stays solid
      continue;
    }
    colliders.push({ min: [u(l.x0), u(l.y0), 0], max: [u(l.x1), u(l.y1), u(l.h)], of: `lot:${l.id}` });
  }
  const doors = entries.filter((e) => e.enter === 'door').map((e) => ({ id: e.door.id, lot: e.lot, inside: e.inside, at: [u(e.door.at[0]), u(e.door.at[1]), 0], radius: u(1.4), spawn: [u(e.door.spawn[0]), u(e.door.spawn[1]), 0], heading: e.door.heading }));
  const lobbies = entries.filter((e) => e.enter === 'walk').map((e) => e.lot);
  // the green (green.js): a street tree's trunk and a planter's box stop a walker on the walk; a shrub, a crown, a park's
  // trees and a median's do not (a walker crosses a median between its trees, and the walk runs down the middle line)
  for (const g of cityGreen(d)) {
    if (g.strip || g.kind !== 'street' || g.plant === 'shrub' || !inside(R, g.x, g.y, reach)) continue;
    const r = g.plant === 'planter' ? PLANTER.side / 2 : TRUNK, h = g.plant === 'planter' ? PLANTER.h : 3;
    colliders.push({ min: [u(g.x - r), u(g.y - r), 0], max: [u(g.x + r), u(g.y + r), u(h)], of: `green:${g.key}` });
  }
  for (const s of d.sites) if (s.mass && !(s.mass.x1 < R.x0 - reach || s.mass.x0 > R.x1 + reach || s.mass.y1 < R.y0 - reach || s.mass.y0 > R.y1 + reach)) colliders.push({ min: [u(s.mass.x0), u(s.mass.y0), 0], max: [u(s.mass.x1), u(s.mass.y1), u(s.mass.h)], of: `site:${s.id}` });
  // a hero's segment is walled to the sky: over the tallest mass in reach, so no climb or jump leaves it but by a street
  const T = 0.5, H = hero ? Math.max(CITY_LEVEL.wall, ...colliders.map((c) => c.max[2] * U)) + CITY_HERO.sky : CITY_LEVEL.wall;
  const side = (name, a0, a1, fixed, horizontal) => {
    const gaps = open.filter((x) => x.side === name).map((x) => [(horizontal ? x.at[0] : x.at[1]) - x.gap, (horizontal ? x.at[0] : x.at[1]) + x.gap]).sort((p, q) => p[0] - q[0]);
    let a = a0;
    for (const [g0, g1] of [...gaps, [a1, a1]]) {
      // (a hero's edge is not a wall to climb: `hold: false`, wall.js)
      if (g0 - a > 0.2) colliders.push({ ...(horizontal ? { min: [u(a), u(fixed - T), 0], max: [u(g0), u(fixed + T), u(H)] } : { min: [u(fixed - T), u(a), 0], max: [u(fixed + T), u(g0), u(H)] }), of: `edge:${name}`, ...(hero ? { hold: false } : {}) });
      a = Math.max(a, g1);
    }
  };
  side('n', R.x0, R.x1, R.y0, true); side('s', R.x0, R.x1, R.y1, true); side('w', R.y0, R.y1, R.x0, false); side('e', R.y0, R.y1, R.x1, false);
  return {
    segment: seg.id, rect: R,
    // entered along a route, the walker stands just inside the portal it came in by, on its street
    spawn: cameIn ? [u(cameIn.arrive[0]), u(cameIn.arrive[1]), 0] : [u(start0.x), u(start0.y), 0], heading: r3(cameIn ? Math.atan2(cameIn.arrive[1] - cameIn.at[1], cameIn.arrive[0] - cameIn.at[0]) : heading0),
    exits: [...exits, ...extra].map((x) => ({ ...x, at: [u(x.at[0]), u(x.at[1]), 0], radius: u(x.radius), arrive: [u(x.arrive[0]), u(x.arrive[1]), 0] })),
    ...(route ? { route } : {}),
    ...(goal ? { goal: { at: [u(goal.at[0]), u(goal.at[1]), 0] } } : {}),
    via: via.map((p) => [u(p[0]), u(p[1])]),
    colliders, doors, lobbies,
  };
}

/**
 * A city manifest with its segment's level lowered (the building-on-the-rail contract): the `game` channel (a
 * reach-exit per way out, or the goal), arrivals that move the walker, a first-person walker at the spawn, its camera,
 * and the walls. `ref` is the level's own sketch ref; `cityRef` the city it was cut from.
 */
export function withCityLevel(m, d, ref) {
  const H = m.level.hero ?? null;
  const L = segmentLevel(d, m.level.segment, { refs: m.level.refs ?? {}, cityRef: m.cityRef ?? null, route: m.level.route ?? null, ways: m.level.ways ?? [], hero: !!H });
  if (L.error) throw new Error(`level: ${L.error}`);
  const pilot = H ? cityHero(H, L) : null;
  const eye = pilot ? pilot.eye : u(CITY_LEVEL.eye);
  const via = L.via.length ? { via: L.via } : {};
  // on a route the level ends (success) at its way on, or its end: no exit named, the line's gates do the rest
  const mechanics = L.route
    ? (L.goal ? [{ kind: 'reach-exit', at: L.goal.at, radius: u(4), ...via }] : [{ kind: 'reach-exit', at: L.exits[0].at, radius: L.exits[0].radius, ...via }])
    : [
      ...(L.goal && !L.exits.length ? [{ kind: 'reach-exit', at: L.goal.at, radius: u(4), ...via }] : []),
      ...L.exits.map((x, i) => ({ kind: 'reach-exit', exit: x.id, at: x.at, radius: x.radius, ...(i === 0 && L.via.length ? { via: L.via } : {}) })),
    ];
  const arrivals = L.route ? [] : L.exits.filter((x) => x.to);
  // each door-scene building's door: a zone on the walk before it, a walker coming back out standing on the walk
  const eyeAt = (p) => [p[0], p[1], 0];
  const doorMechs = L.doors.map((x) => ({ kind: 'door', id: x.id, at: eyeAt(x.at), radius: x.radius, spawn: eyeAt(x.spawn), heading: x.heading }));
  const found = cityFound(m.level.found ?? [], L, pilot, eye);
  const grants = pilot && m.level.powers ? Object.fromEntries(Object.entries(m.level.powers).map(([id, g]) => [id, grantInUnits(g)])) : {};
  const held = m.level.powers || (m.level.found ?? []).some((f) => f.into === 'powers');
  const game = {
    levelRef: ref, mechanics: [...doorMechs, ...mechanics, ...found], fall: { mode: 'respawn' }, ...(arrivals.length ? { arrive: arrivals.map((x) => x.to) } : {}),
    ...(held ? { consumes: [{ slice: 'powers' }] } : {}),
    ...(Object.keys(grants).length ? { powers: { slice: 'powers', target: pilot.id, grants } } : {}),
  };
  const reactions = arrivals.map((x) => ({ on: `arrive:${x.to}`, do: 'move', target: pilot ? pilot.id : 'player', to: [x.arrive[0], x.arrive[1], eye] }));
  if (pilot) {
    return {
      ...m,
      ...(m.clouds === undefined ? { clouds: CITY_HERO.clouds[nightOf(m) ? 'night' : 'day'] } : {}),
      game,
      ...(pilot.figures ? { figures: { ...(m.figures || {}), ...pilot.figures } } : {}),
      entities: [pilot.entity],
      camera: pilot.camera,
      events: { ...pilot.events, reactions: [...(pilot.events.reactions || []), ...reactions] },
      colliders: L.colliders,
      walk: false,
    };
  }
  return {
    ...m,
    game,
    entities: [{ id: 'player', pilotable: true, rule: { type: 'walk', speed: r3(CITY_LEVEL.speed / U), turn: 2.4, eye, turnMode: 'look', lookPitch: true, keyTurn: true, strafe: 1, collideRadius: u(CITY_LEVEL.radius), collideHeight: eye }, body: { type: 'none' }, transform: { pos: [L.spawn[0], L.spawn[1], eye], heading: L.heading } }],
    camera: { rule: 'eye', target: 'player', height: 0, mouseLook: true },
    events: { reactions },
    colliders: L.colliders,
    walk: false,
  };
}

/** The keys a map world lays in a segment (`level.found`: [{ item, into: 'bag' | 'powers' }], gameworld levels.js): one row
 *  of pickups on the TALLEST ROOF of the segment the hero's own moves reach (game/reach.js: a key the climb, or the line,
 *  wins), taken only up there (planar: false); with no hero, or no roof it reaches, on the walk halfway along its way. */
function cityFound(found, L, pilot, eye) {
  if (!found.length) return [];
  let at = null, planar = true;
  if (pilot) {
    const R = reachOf({ colliders: L.colliders, start: [pilot.entity.transform.pos[0], pilot.entity.transform.pos[1], 0] }, pilot.entity.rule);
    const [x0, y0, x1, y1] = [L.rect.x0, L.rect.y0, L.rect.x1, L.rect.y1].map(u);
    const roofs = R.surfaces.filter((s) => !s.ground && R.reached.has(s.id) && s.rect.x0 >= x0 && s.rect.x1 <= x1 && s.rect.y0 >= y0 && s.rect.y1 <= y1);
    const top = roofs.reduce((b, s) => (!b || s.z > b.z ? s : b), null);
    if (top) { at = [r3((top.rect.x0 + top.rect.x1) / 2), r3((top.rect.y0 + top.rect.y1) / 2), r3(top.z + eye)]; planar = false; }
  }
  if (!at) { const v = L.via[Math.floor(L.via.length / 2)] ?? L.spawn; at = [v[0], v[1], eye]; }
  const out = [];
  for (const into of ['bag', 'powers']) {
    const row = found.map((f, j) => ({ ...f, j })).filter((f) => f.into === into);
    if (row.length) out.push({ kind: 'collect', into, pickups: row.map((f) => ({ item: f.item, at: [r3(at[0] + u(1.5) * f.j), at[1], at[2]], radius: u(1.6), ...(planar ? {} : { planar: false }) })) });
  }
  return out;
}

/** Whether the city's look (its own, or its paint's cube's) has no sun: its night (look.js lookLight's reading). */
function nightOf(m) {
  const paint = readPaint(m.paint), spec = readCityLook(m.look) || (paint ? resolveLookSpec(paint.cube.light.reference) : null);
  return !!(spec && !spec.ref.light.key);
}

/** The hero who plays a segment (`level.hero`), in the city's units: the player slot's entity at the spawn, its figure
 *  (a made character by `ref`, drawn at 1 / unit) or a stand-in box, the chase camera, and the controls legend. The stand-in stands at its half height (a box body is drawn about the entity's point). */
function cityHero(H, L) {
  const C = CITY_HERO.camera, legend = `W / S  run · A / D  turn · Space  jump${H.gear === false ? '' : ' · F  swing (in the air), zip (on the ground)'}`;
  const P = playerWorld({ heroRef: H.ref ?? 'none', ...(H.gaits ? { gaits: H.gaits } : {}), id: 'hero', controls: legend });
  const standIn = !H.ref, half = CITY_HERO.standIn.size[2] / 2;
  const { wall, gear, ...base } = CITY_HERO.rule;
  const rule = ruleInUnits({ ...P.entities[0].rule, ...base, ...(H.wall === false ? {} : { wall }), ...(H.gear === false ? {} : { gear }), ...(standIn ? { eye: half } : {}) });
  const eye = standIn ? u(half) : 0;
  const body = standIn ? { type: 'mesh', shape: 'box', size: CITY_HERO.standIn.size.map(u), color: CITY_HERO.standIn.color } : { ...P.entities[0].body, scale: r3(1 / U) };
  return {
    id: 'hero', eye,
    ...(standIn ? {} : { figures: { hero: { ...P.figures.hero, clips: traversalStates(P.figures.hero.clips) } } }),
    entity: { ...P.entities[0], rule, body, transform: { pos: [L.spawn[0], L.spawn[1], eye], heading: L.heading } },
    camera: { rule: 'follow', target: 'hero', dist: u(C.dist), height: u(C.height), lookH: u(C.lookH), lead: u(C.lead) },
    events: P.events || {},
  };
}

// a city segment is lowered as a building on the rail is, wherever a level is (world-scene, game-resolve)
registerLevelKind('city', (m, ref) => withCityLevel(m, designCity(m), ref));
