/**
 * A COMPLEX — several buildings on one site, joined below grade, walked as one map: a stage recipe's `complex`
 * (era/stage.js). Each building is of the core shape (era/programs.js: an office, a clinic, a lab, a warehouse, a base's
 * hangar, barracks, armoury, command …) set into the site with a BASEMENT (network/building.js), its storey 1 at the
 * yard; the network (network/edges.js, passage.js) joins their basements by passages of one section; the yard is laid
 * round them and each wears its outside.
 *
 *   { kind: 'stage', complex: { buildings | campus, network?, yard?, seed? }, hour? }
 *     buildings  [{ id, use, at: [x, y] | { beside: <id>, side: '+x' | '-x' | '+y' | '-y', gap? }, facing?, seed?,
 *                storeys?, wings?, loading?, bays?, look? }]: `at` its front door's middle on the yard, or BESIDE another
 *                (its footprint `gap` m off that one's side, 20 m by default, slid along it so a room of its basement
 *                faces one of the other's straight across the gap, else centred on it); `facing` its way in's
 *                (-y by default); `look` its finish on the bay axes ({ construction?, palette?, plot?, dressing? })
 *     campus     a complex by its name (network/campuses.js: 'hospital', 'base'): its buildings, their looks and its
 *                network; a `network` given beside it changes the campus's
 *     network    { section?: 'service' (the default) | 'passage' | 'bunker' | 'vehicle' | { from, …changes }, links?:
 *                [[a, b] | { between: [a, b], section }, …] }: its passages' section, and which pairs may be joined, each
 *                by the network's section or its own (every pair that faces another across one gap, when absent)
 *     yard       { margin? }: how far the yard runs out past the buildings (m)
 *
 *   level      (the stage's own, beside `complex`) { from?, to?, mechanics?, exit?, radius? }: played from one
 *                building's front door to another's goal room, through its passages (complexRoute)
 *
 *   readComplex(c) → c, checked (refused by name)
 *   layComplex(c, { built? }) → { sec, F, nodes, byId, passages }   placed, fitted, joined; built, or laid only
 *   complexRoute(manifest) → the level's spawn, goal and route through the passages (below), or { error }
 *   complexLaws(manifest) → its network's laws from its layout alone, and its level's route ({ law, ok, value, want })
 *   assembleComplexScene(manifest, ctx) → the World payload: faces (the yard, each building inside and out, each
 *       passage), colliders, lights, cameras (the site, each front door, the first passage, a basement), sky, walk, anchors
 *       (a `building` a building: its door, rooms, way down and ways out; a `tunnel` a passage), and `complex`: its
 *       buildings, passages and laws (network/laws.js: every building reached, cover, grade, run; and two buildings a
 *       passage joins unalike)
 *
 * Metres, z up, the yard at 0. Pure; seeded dice only (a building's facade colour).
 */
import { buildingFit, buildingNode } from './building.js';
import { networkEdges, pathOf } from './edges.js';
import { passageOf } from './passage.js';
import { networkLaws } from './laws.js';
import { readSection } from './sections.js';
import { campusOf } from './campuses.js';
import { groundLess } from '../geocity/podium.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const KEYS = ['buildings', 'campus', 'network', 'yard', 'seed'];
const B_KEYS = ['id', 'use', 'at', 'facing', 'seed', 'storeys', 'wings', 'loading', 'bays', 'look'];
const SIDES = ['+x', '-x', '+y', '-y'];
// the yard's light (a fixed sun, the page draws every face unlit: its light baked), its colours, a facade's palette
const SUN = [0.42, -0.5, 0.76], YARD = '#8d8a83', ROOF = '#6f6e6a', GLASS = '#2e3a44';
const FACADES = ['#b9b2a4', '#9ea3a6', '#a7856a', '#c4c0b6', '#7f8a86'];
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);
const shade = (hex, n) => { const g = 0.62 + 0.42 * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]); return `#${[1, 3, 5].map((i) => Math.round(Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) * g))).toString(16).padStart(2, '0')).join('')}`; };

export function readComplex(c0) {
  const no = (m) => { throw new Error(`complex: ${m}`); };
  if (!c0 || typeof c0 !== 'object' || Array.isArray(c0)) no(`a complex is { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(c0)) if (!KEYS.includes(k)) no(`'${k}' is not a setting (${KEYS.join(', ')})`);
  // (a campus by its name: its buildings and its network, network/campuses.js; a network of the recipe's own over it)
  if (c0.campus !== undefined && c0.buildings !== undefined) no('a campus is its own buildings: give campus or buildings, not both');
  const cp = c0.campus !== undefined ? campusOf(c0.campus) : null;
  const c = cp ? { ...c0, buildings: cp.buildings, network: { ...cp.network, ...(c0.network ?? {}) } } : c0;
  if (!Array.isArray(c.buildings) || c.buildings.length < 1) no('buildings is a list of at least one building ({ id, use, at })');
  const ids = new Set();
  c.buildings.forEach((b, i) => {
    if (!b || typeof b !== 'object') no(`buildings[${i}] is { id, use, at }`);
    for (const k of Object.keys(b)) if (!B_KEYS.includes(k)) no(`buildings[${i}].${k} is not a setting (${B_KEYS.join(', ')})`);
    if (typeof b.id !== 'string' || ids.has(b.id)) no(`buildings[${i}] needs an id of its own`);
    ids.add(b.id);
    if (typeof b.use !== 'string') no(`buildings[${i}] (${b.id}) needs a use`);
    const at = b.at;
    if (!(Array.isArray(at) && at.length === 2 && at.every(Number.isFinite)) && !(at && typeof at === 'object' && typeof at.beside === 'string' && SIDES.includes(at.side) && (at.gap === undefined || (Number.isFinite(at.gap) && at.gap > 0)))) no(`buildings[${i}] (${b.id}).at is [x, y] or { beside: <id>, side: ${SIDES.join(' | ')}, gap? }`);
    if (b.facing !== undefined && !['-y', '+y', '-x', '+x'].includes(b.facing)) no(`buildings[${i}] (${b.id}).facing is -y, +y, -x or +x`);
  });
  for (const b of c.buildings) if (b.at?.beside !== undefined && !ids.has(b.at.beside)) no(`${b.id} stands beside '${b.at.beside}', which is not one of its buildings`);
  if (c.network !== undefined) {
    if (!c.network || typeof c.network !== 'object' || Object.keys(c.network).some((k) => !['section', 'links'].includes(k))) no('network is { section?, links? }');
    const pair = (l) => (Array.isArray(l) ? l : l && typeof l === 'object' && Object.keys(l).every((k) => ['between', 'section'].includes(k)) && Array.isArray(l.between) ? l.between : null);
    if (c.network.links !== undefined && !(Array.isArray(c.network.links) && c.network.links.every((l) => { const p = pair(l); return p && p.length === 2 && p.every((x) => ids.has(x)); }))) no('network.links is [[a, b] | { between: [a, b], section? }, …], each a pair of its buildings\' ids');
    readSection(c.network.section ?? 'service');
    for (const l of c.network.links ?? []) if (!Array.isArray(l) && l.section !== undefined) readSection(l.section);
  }
  return c;
}

/** A complex laid: its buildings placed and fitted, its network's edges, each building as a node (built, or laid only:
 *  its plan, routes and rooms, none of its faces) and each passage. */
export function layComplex(C, { built = true } = {}) {
  const sec = readSection(C.network?.section ?? 'service');
  // ── the buildings placed: each where it says, or beside one already placed (its footprint a gap off that one's side) ──
  const fits = new Map(), order = [], pending = [...C.buildings];
  while (pending.length) {
    const i = pending.findIndex((b) => !b.at?.beside || fits.has(b.at.beside));
    if (i < 0) throw new Error(`complex: ${pending.map((b) => b.id).join(', ')} stand beside each other in a ring: one needs an at: [x, y]`);
    const b = pending.splice(i, 1)[0], facing = b.facing ?? '-y', spec = { use: b.use, ...Object.fromEntries(['seed', 'storeys', 'wings', 'loading', 'bays'].filter((k) => b[k] !== undefined).map((k) => [k, b[k]])), ...(b.look ? { compose: b.look } : {}) };
    let at = b.at;
    if (!Array.isArray(at)) {
      // (its footprint off the other's side by the gap, its middle along that side the other's)
      const O = fits.get(at.beside).footprint, probe = buildingFit(spec, { id: b.id, at: [0, 0], facing, door: sec.door }), F = probe.footprint, gap = at.gap ?? 20;
      const k = at.side.endsWith('x') ? 0 : 1, o = 1 - k, lo = [0, 0];
      lo[k] = at.side.startsWith('+') ? O[k + 2] + gap - F[k] : O[k] - gap - F[k + 2];
      lo[o] = (O[o] + O[o + 2]) / 2 - (F[o] + F[o + 2]) / 2;
      // (slid along that side so a room of its basement faces one of the other's straight across the gap, a passage's
      // way between them: the pairing that slides it least from the middle; none, it stands in the middle)
      const sideB = at.side, sideA = { '+x': '-x', '-x': '+x', '+y': '-y', '-y': '+y' }[sideB], other = fits.get(at.beside).node.rooms.filter((r) => r.sides.includes(sideB));
      const mine = probe.node.rooms.filter((r) => r.sides.includes(sideA)), shifts = [];
      for (const ra of other) for (const rb of mine) shifts.push((ra.rect[o] + ra.rect[o + 2]) / 2 - ((rb.rect[o] + rb.rect[o + 2]) / 2 + lo[o]));
      const best = shifts.filter((d) => Math.abs(d) <= (F[o + 2] - F[o]) / 2).sort((p, q) => Math.abs(p) - Math.abs(q))[0];
      if (best !== undefined) lo[o] += best;
      at = lo.map(r5);
    }
    fits.set(b.id, buildingFit(spec, { id: b.id, at, facing, door: sec.door }));
    order.push(b);
  }
  const F = order.map((b) => fits.get(b.id));
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
    const a = F[i].footprint, c = F[j].footprint;
    if (a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3]) throw new Error(`complex: ${F[i].id} and ${F[j].id} stand on each other: give one another at or a gap`);
  }
  // ── the network: a passage between each two buildings facing each other across one gap (the pairs `links` names) ──
  // (the pairs its links name, each by its own section or the network's; every pair by the network's, when none)
  const linked = new Map();
  for (const l of C.network?.links ?? []) { const [a, b] = Array.isArray(l) ? l : l.between, S = Array.isArray(l) || l.section === undefined ? sec : readSection(l.section); linked.set(`${a}|${b}`, S); linked.set(`${b}|${a}`, S); }
  const sectionOf = C.network?.links ? (a, b) => linked.get(`${a}|${b}`) ?? null : null;
  const edges = networkEdges(F.map((f) => f.node), { section: sec, sectionOf, blocks: F.map((f) => f.footprint) });
  const portsOf = (id) => edges.flatMap((e) => (e.a === id ? [{ id: `${e.a}-${e.b}`, room: e.roomA, side: e.sideA, u: e.uA, width: e.doorA }] : e.b === id ? [{ id: `${e.a}-${e.b}`, room: e.roomB, side: e.sideB, u: e.uB, width: e.doorB }] : []));
  const nodes = F.map((f) => buildingNode(f, { padZ: 0, ports: portsOf(f.id), built })), byId = new Map(nodes.map((n) => [n.id, n]));
  const inAny = (x, y) => F.some((f) => x >= f.footprint[0] && x <= f.footprint[2] && y >= f.footprint[1] && y <= f.footprint[3]);
  const over = (x, y) => ({ z: 0, under: inAny(x, y) ? 'slab' : 'ground' });
  const end = (q) => { const ax = q.side.endsWith('y') ? 0 : 1, P = (u) => { const p = [0, 0]; p[ax] = u; p[1 - ax] = q.plane; return p; }; return { z0: q.z0, lo: P(q.lo), hi: P(q.hi), top: q.top, plane: q.plane }; };
  const passages = edges.map((e) => {
    const id = `${e.a}-${e.b}`, pa = end(byId.get(e.a).ports.find((p) => p.id === id)), pb = end(byId.get(e.b).ports.find((p) => p.id === id));
    const S = e.section ?? sec;
    return { ...passageOf({ id, path: pathOf(e, pa, pb), a: pa, b: pb, section: S, over, look: { light: 0.45 }, prefix: 'complex' }), a: e.a, b: e.b, kind: e.kind, section: S };
  });
  return { sec, F, nodes, byId, passages };
}

export function assembleComplexScene(manifest = {}, ctx = {}) {
  const C = readComplex(manifest.complex), margin = C.yard?.margin ?? 20, { sec, F, nodes, passages } = layComplex(C);
  // ── the yard: laid in cells round the buildings, out to its margin, cut at each footprint ──
  const xs = F.flatMap((f) => [f.footprint[0], f.footprint[2]]), ys = F.flatMap((f) => [f.footprint[1], f.footprint[3]]);
  const site = [Math.min(...xs) - margin, Math.min(...ys) - margin, Math.max(...xs) + margin, Math.max(...ys) + margin].map(r5);
  let yard = [];
  for (let x = site[0]; x < site[2] - 1e-6; x += 4) for (let y = site[1]; y < site[3] - 1e-6; y += 4) {
    const q = [x, y, Math.min(x + 4, site[2]), Math.min(y + 4, site[3])], fill = shade(YARD, [0, 0, 1]);
    yard.push({ corners: [[q[0], q[1], 0], [q[2], q[1], 0], [q[2], q[3], 0], [q[0], q[3], 0]].map(P3), normal: [0, 0, 1], outNormal: [0, 0, 1], group: 'complex:yard', fill, cornerFills: [fill, fill, fill, fill] });
  }
  // (cut by each ground room's walls' outer faces: a building's plan is an L or a T, its notches the yard's)
  for (const N of nodes) for (const r of N.rooms.filter((q) => q.storey === 1)) yard = yard.flatMap((g) => groundLess(g, [r.box.min[0] - 0.5, r.box.min[1] - 0.5, r.box.max[0] + 0.5, r.box.max[1] + 0.5]));
  // ── each building's outside: its walls where no room of its storey stands against them, a band of glass a storey,
  // its door cut through its front, a flat roof behind a parapet over each room with none over it ──
  const outside = nodes.flatMap((N, i) => outsideOf(N, F[i], FACADES[Math.floor(mulberry32(hash(`${C.seed ?? 1}|${N.id}`))() * FACADES.length)]));
  // ── cameras: the site from over a corner, each front door from the yard, the first passage, a basement ──
  const [cx, cy] = [(site[0] + site[2]) / 2, (site[1] + site[3]) / 2], span = Math.max(site[2] - site[0], site[3] - site[1]);
  const cameras = [{ name: 'site', worldFraming: { cameraPosition: P3([cx + span * 0.55, cy - span * 0.75, span * 0.55]), lookAt: P3([cx, cy, 4]), horizontalFov: 55 } }];
  for (const N of nodes) { const d = N.door; cameras.push({ name: `door-${N.id}`, worldFraming: { cameraPosition: P3([d.at[0] + d.N[0] * 14, d.at[1] + d.N[1] * 14, 1.7]), lookAt: P3([d.at[0], d.at[1], 3]), horizontalFov: 65 } }); }
  const t0 = passages[0];
  if (t0) { const a = t0.line[Math.min(2, t0.line.length - 1)], b = t0.line[Math.max(0, t0.line.length - 3)]; cameras.push({ name: 'tunnel', worldFraming: { cameraPosition: P3([a[0], a[1], a[2] + 1.7]), lookAt: P3([b[0], b[1], b[2] + 1.4]), horizontalFov: 70 } }); }
  { const N = nodes[0], cc = N.rooms.find((r) => r.id === 'concourse').box; cameras.push({ name: 'basement', worldFraming: { cameraPosition: P3([cc.min[0] + 1, cc.min[1] + 1, cc.min[2] + 1.7]), lookAt: P3([cc.max[0], cc.max[1], cc.min[2] + 1.2]), horizontalFov: 75 } }); }
  const laws = [...networkLaws(F.map((f) => ({ id: f.id })), passages, { section: sec, prefix: 'complex', noun: 'building' }), distinctLaw(C, passages)];
  const d0 = nodes[0].door;
  return {
    faces: [...yard, ...outside, ...nodes.flatMap((N) => N.faces), ...passages.flatMap((t) => t.faces)],
    colliders: [...nodes.flatMap((N) => N.colliders), ...passages.flatMap((t) => t.colliders)],
    lights: nodes.flatMap((N) => N.lights), cameras, viewBox: { width: 1280, height: 720 }, title: ctx.title || manifest.title || 'a complex',
    bg: '#c9d6e0', sky: { zenith: '#6f9ccc', horizon: '#d8e2ea', day: 1, stars: 0, seed: 1, sun: { dir: SUN, size: 1.2, glow: 1.1 } },
    walk: { speed: 5, spawn: P3([d0.at[0] + d0.N[0] * 6, d0.at[1] + d0.N[1] * 6, 1.7]), minEye: 1.7, gravity: 22, radius: 0.3 },
    anchors: [
      ...nodes.map((N) => ({ id: `building-${N.id}`, kind: 'building', use: N.use, enter: 'walk', at: N.door.at, N: [...N.door.N, 0], floor: 0, rise: N.rise, rooms: N.rooms, down: N.down, ports: N.ports.map((q) => ({ id: q.id, side: q.side, room: q.room, reach: q.reach })) })),
      ...passages.map((t) => ({ id: `tunnel-${t.id}`, kind: 'tunnel', from: `building-${t.a}`, to: `building-${t.b}`, length: t.length, line: t.line, section: t.section.id })),
    ],
    complex: {
      ...(C.campus !== undefined ? { campus: C.campus } : {}), site, section: sec.id,
      buildings: nodes.map((N) => ({ id: N.id, use: N.use, rise: N.rise, ports: N.ports.length, footprint: N.footprint })),
      passages: passages.map((t) => ({ id: t.id, kind: t.kind, section: t.section.id, length: t.length, cover: t.cover, slab: t.slab, grade: t.grade, turns: t.turns, ends: t.ends, ...(t.findings.length ? { findings: t.findings } : {}) })),
      laws: laws.map((l) => ({ law: l.law, ok: l.ok, value: l.value })),
    },
  };
}

// (a complex laid only, by its recipe: a level's lowering and its run's beats read it more than once)
const LAID = new Map();
const laid = (C) => { const k = JSON.stringify(C); if (!LAID.has(k)) { if (LAID.size >= 8) LAID.delete(LAID.keys().next().value); LAID.set(k, layComplex(C, { built: false })); } return LAID.get(k); };

/**
 * A complex as a level (structure/level.js lowers a stage recipe's `complex` with a `level` by it): entered from the yard
 * at the front door of the building `level.from` (the first, by default), won in the program's goal room of
 * `level.to` (the last, by default), by the fewest passages between them: in at the door, down to the basement, through
 * each passage and each basement between, up the last building's stair to its goal room.
 *   → { spawn, heading, from, to, hops, goal: { building, room, at }, route, rooms } | { error }
 *   `route` the walk (each point a height the walk starts from, the ground under it what it stands on); `rooms` every
 *   building's rooms ({ building, id, storey, box }), for a run's beats.
 */
export function complexRoute(manifest) {
  const C = readComplex(manifest.complex), L = laid(C), lv = manifest.level ?? {}, ids = L.nodes.map((n) => n.id);
  const from = lv.from ?? ids[0], to = lv.to ?? ids[ids.length - 1];
  for (const [k, v] of [['from', from], ['to', to]]) if (!ids.includes(v)) return { error: `the level's '${k}' names no building of the complex (${ids.join(', ')})` };
  // (breadth first over the passages, in the order they were laid)
  const prev = new Map([[from, null]]), queue = [from];
  while (queue.length) {
    const id = queue.shift();
    for (const t of L.passages) { const nx = t.a === id ? t.b : t.b === id ? t.a : null; if (nx !== null && !prev.has(nx)) { prev.set(nx, { t, id }); queue.push(nx); } }
  }
  if (!prev.has(to)) return { error: `no passage leads from '${from}' to '${to}': stand them facing each other across one gap, or link them (network.links)` };
  const hops = [];
  for (let id = to; prev.get(id); id = prev.get(id).id) hops.unshift({ t: prev.get(id).t, from: prev.get(id).id, to: id });
  const A = L.byId.get(from), B = L.byId.get(to), route = [...A.down];
  for (const h of hops) {
    const X = L.byId.get(h.from), Y = L.byId.get(h.to), line = h.t.a === h.from ? h.t.line : h.t.line.slice().reverse();
    route.push(...X.ports.find((p) => p.id === h.t.id).reach.slice(1), ...line.slice(1), ...Y.ports.find((p) => p.id === h.t.id).reach.slice().reverse().slice(1));
  }
  route.push(...B.up.route.slice(1));
  const d = A.door, spawn = P3([d.at[0] + d.N[0] * 6, d.at[1] + d.N[1] * 6, d.at[2]]);
  return {
    spawn, heading: r5(Math.atan2(-d.N[1], -d.N[0])), from, to, hops: hops.map((h) => h.t.id),
    goal: { building: to, room: B.up.room, at: B.up.at }, route,
    rooms: L.nodes.flatMap((N) => N.rooms.map((r) => ({ building: N.id, id: r.id, storey: r.storey, box: r.box }))),
  };
}

/** A complex's network held to its laws (network/laws.js), from its layout alone: every building reached, cover, grade,
 *  run; and, played as a level, whether a way through its passages leads from its `from` to its `to`. */
export function complexLaws(manifest) {
  const C = readComplex(manifest.complex), L = laid(C);
  const laws = [...networkLaws(L.F.map((f) => ({ id: f.id })), L.passages, { section: L.sec, prefix: 'complex', noun: 'building' }), distinctLaw(C, L.passages)];
  if (!manifest.level) return laws;
  const R = complexRoute(manifest);
  return [...laws, { law: 'complex-route', ok: !R.error, value: R.error ?? `${R.from} → ${R.to} by ${R.hops.length ? R.hops.join(', ') : 'no passage'}`, want: 'a way through the passages from the building it is entered by to the one it is won in' }];
}

/** Two buildings a passage joins look unlike each other (a walked-through layer changes: the walled-core dungeon's
 *  `distinct`), read where both wear a look. */
function distinctLaw(C, passages) {
  const look = new Map(C.buildings.map((b) => [b.id, b.look])), same = [];
  let unread = 0;
  for (const t of passages) {
    const a = look.get(t.a), b = look.get(t.b);
    if (!a || !b) { unread++; continue; }
    if (a.construction === b.construction && a.palette === b.palette) same.push(`${t.a} – ${t.b} (${a.construction ?? '-'}, ${a.palette ?? '-'})`);
  }
  return { law: 'complex-distinct', ok: !same.length, value: same.length ? `${same.join('; ')}: the same construction and palette` : passages.length && unread === passages.length ? 'no passage joins two buildings that both wear a look' : `every passage joins two looks that differ${unread ? ` (${unread} unread: a building wears no look)` : ''}`, want: 'two buildings a passage joins differ in construction or palette' };
}

/** A building's outside, from its built rooms: on each storey from 1 up, each room's walls where no room of its storey
 *  stands against them (a wall's outer face), a band of glass along each a storey, its front door cut through the
 *  lobby's front; a flat roof over each room with none over it, behind a parapet. */
function outsideOf(N, fit, facade) {
  // (a stage's wall is half a metre between two rooms' insides: an outside wall's outer face that far off its room's)
  const out = [], rooms = N.rooms.filter((r) => r.storey >= 1), T = 0.5;
  const face = (cs, n, group, hex) => { const f = shade(hex, n); out.push({ corners: cs.map(P3), normal: P3(n), outNormal: P3(n), group, fill: f, cornerFills: cs.map(() => f) }); };
  const wind = (cs, n) => { const e1 = [cs[1][0] - cs[0][0], cs[1][1] - cs[0][1], cs[1][2] - cs[0][2]], e2 = [cs[3][0] - cs[0][0], cs[3][1] - cs[0][1], cs[3][2] - cs[0][2]], c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; return c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0 ? cs.slice().reverse() : cs; };
  const door = N.door;
  for (const r of rooms) {
    // (its box out to its walls' outer faces; its floor and the top of what it holds: the next storey's floor, or a slab)
    const b = r.box, x0 = b.min[0] - T, y0 = b.min[1] - T, x1 = b.max[0] + T, y1 = b.max[1] + T, z0 = b.min[2], above = rooms.find((q) => q.storey === r.storey + 1 && cover(q.box, b));
    // (a room with none over it roofed over a plenum, behind its parapet: what hangs from its ceiling and glows is
    // under its roof from any side)
    const z1 = above ? above.box.min[2] : b.max[2] + 1.6;
    for (const [side, n] of [['-y', [0, -1, 0]], ['+y', [0, 1, 0]], ['-x', [-1, 0, 0]], ['+x', [1, 0, 0]]]) {
      const ax = side.endsWith('y') ? 0 : 1, line = side === '-y' ? y0 : side === '+y' ? y1 : side === '-x' ? x0 : x1, a0 = ax === 0 ? x0 : y0, a1 = ax === 0 ? x1 : y1;
      // (the spans of this side a room of its storey stands against)
      const taken = rooms.filter((q) => q !== r && q.storey === r.storey).map((q) => {
        // (a room against this side: its facing inside on this wall's outer face)
        const qb = q.box, qLine = side === '-y' ? qb.max[1] : side === '+y' ? qb.min[1] : side === '-x' ? qb.max[0] : qb.min[0];
        if (Math.abs(qLine - line) > 0.3) return null;
        return [Math.max(a0, (ax === 0 ? qb.min[0] : qb.min[1]) - T), Math.min(a1, (ax === 0 ? qb.max[0] : qb.max[1]) + T)];
      }).filter((s) => s && s[1] > s[0]).sort((p, q) => p[0] - q[0]);
      const free = [];
      let u = a0;
      for (const [lo, hi] of taken) { if (lo > u) free.push([u, lo]); u = Math.max(u, hi); }
      if (u < a1) free.push([u, a1]);
      const P = (uu, z) => (ax === 0 ? [uu, line, z] : [line, uu, z]), Pg = (uu, z) => (ax === 0 ? [uu, line + n[1] * 0.03, z] : [line + n[0] * 0.03, uu, z]);
      // (the front door: cut through the lobby's front wall, where it stands)
      const isDoor = r.id === 'lobby' && door.N[0] === n[0] && door.N[1] === n[1];
      for (const [s0, s1] of free) {
        const cuts = isDoor ? [door.span] : [];
        const pieces = [];
        let v = s0;
        for (const [c0, c1] of cuts) { if (c1 <= s0 || c0 >= s1) continue; if (c0 > v) pieces.push([v, c0, z0, z1]); pieces.push([Math.max(s0, c0), Math.min(s1, c1), z0 + door.top, z1]); v = c1; }
        if (v < s1) pieces.push([v, s1, z0, z1]);
        for (const [p0, p1, za, zb] of pieces) if (p1 - p0 > 1e-3 && zb - za > 1e-3) face(wind([P(p0, za), P(p1, za), P(p1, zb), P(p0, zb)], n), n, 'complex:facade', facade);
        // (a band of glass along it, sill to head, short of its corners and its door)
        if (s1 - s0 > 3 && !(isDoor && cuts.some(([c0, c1]) => c0 < s1 && c1 > s0))) face(wind([Pg(s0 + 0.8, z0 + 1), Pg(s1 - 0.8, z0 + 1), Pg(s1 - 0.8, z0 + 2.6), Pg(s0 + 0.8, z0 + 2.6)], n), n, 'complex:glass', GLASS);
      }
    }
    if (!above) {
      // (its roof, flat, and a parapet's coping round it)
      face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], 'complex:roof', ROOF);
    }
  }
  return out;
}

/** Whether a box's plan covers another's middle. */
function cover(a, b) { const mx = (b.min[0] + b.max[0]) / 2, my = (b.min[1] + b.max[1]) / 2; return mx >= a.min[0] && mx <= a.max[0] && my >= a.min[1] && my <= a.max[1]; }
