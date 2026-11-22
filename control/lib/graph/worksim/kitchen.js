/**
 * THE KITCHEN: a work card laid as a designed arena for one to four cooks on one screen. A kitchen is a room of ZONES
 * (the floor a cook can walk), its places laid along its walls by the role each plays in the card, and its PASSES
 * (a shelf set in a counter between two zones: put down from one side, taken up from the other). Where the zones are
 * sealed from each other the card can only be worked by handing things across: the handoff is laid, not scripted
 * (docs/local-multiplayer-principles.md, principle 8: the step between players is visible).
 *
 * THE ROLES a card's places play (read from the card alone):
 *   crate      a raw thing's source
 *   prep       a station that takes only raw things (or nothing): chop, the pot, the field, the spade
 *   assembly   a station that takes a made thing: plating, the mill, the pour, bagging
 *   shelf      a made thing a station takes, or one the card stores (the mechanic's own shelves)
 *   serve      the hand-in
 *
 * THE KITCHENS (a new kitchen is a row):
 *   island     one zone round a central island of shelves: every cook reaches everything; crowding is the pressure
 *   split      two zones either side of a counter: prep on one, assembly and the hand-in on the other, every shelf a
 *              thing crosses on a pass in the counter. Seats alternate sides (1 and 3 prep, 2 and 4 assembly)
 *
 *   KITCHENS                                   the rows: { about, zones, sealed }
 *   layKitchen(card, { kitchen?, origin?, cooks?, room?, mirror?, obstacles? }) → {
 *     kitchen, card (read), at (the work mechanic's `at`: crates, stations, shelves, serve), heading (0),
 *     zones: [{ id, rect: [x0, y0, x1, y1] }], zoneOf: { <place id>: zone index }, passes: [<item>],
 *     blocks: [{ min, max, kind }] (walls, counters, passes and their hoods), spawns: [[x, y, z]] a seat,
 *     seatZone: [zone index] a seat, bounds: [x0, y0, x1, y1], frame: { at, focus } (one fixed overhead station) }
 *     `room`: a side the room is stretched to (a square room of the game room's area, kitchen-level.js), never shrunk
 *     `mirror`: the kitchen flipped west for east, its prep on the other side (heading π: its shelves' pads turned with
 *     it); `obstacles`: a counter island standing in each side's floor (a map that changes the walks, not the work)
 *   kitchenLaws(K, { jump? }) → [{ law, holds, says }]   advice, never a refusal (docs/bicycles.md); `jump`: the cooks'
 *     jump in metres (a feel's apex), which the sealed law holds the counter above
 *   cooksOf(K, n?) → [{ spawn, reach(at) }]   the work proof's cooks: each seat its zone
 *
 * Laid facing north (heading 0): the shelves' pads run along x, put on the west side and taken on the east, so a
 * split kitchen's prep is west of its counter. Pure, no dice.
 */
import { readCard, isRaw } from './card.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
// a cook's body, the walkway two cooks pass in, the floor grid's step
const BODY = 0.3, WALKWAY = 0.38, STEP = 0.25;
// along a wall: a place a 1 m counter, 2.2 m apart (the pads either side of a shelf stand clear of its neighbours)
const PITCH = 2.2, WALL = 0.3, HIGH = 2.2;
// the counter between the sides and its passes: counter height, so the overhead camera sees over it and onto a pass,
// and a cook who cannot jump it stays on its side (the sealed law asks the cooks' jump)
const PASS = { w: 0.6, h: 1.1 }, STEP_UP = 0.3;
// how far from a place's middle its E reaches (the quick shift's counters: quick.js WORK_REACH), and a pad's
const REACH = 1.6, PAD = 0.6;

export const KITCHENS = Object.freeze({
  island: Object.freeze({ about: 'one floor round a central island of shelves: every cook reaches everything', zones: 1, sealed: false }),
  split: Object.freeze({ about: 'prep on one side of a counter, assembly and the hand-in on the other, what crosses on a pass in the counter', zones: 2, sealed: true }),
});
export const KITCHEN_IDS = Object.freeze(Object.keys(KITCHENS));

/** What each place of a card is: its raws, its prep and assembly stations, its shelves (the mechanic's), and who makes and takes each made thing. */
export function rolesOf(card) {
  const C = card.producer ? card : readCard(card);
  const takes = (sid) => Object.keys(C.stations[sid].takes);
  const raws = [...new Set(Object.keys(C.stations).flatMap(takes).filter((i) => isRaw(C, i)))];
  const assembly = Object.keys(C.stations).filter((sid) => takes(sid).some((i) => !isRaw(C, i)));
  const prep = Object.keys(C.stations).filter((sid) => !assembly.includes(sid));
  // the mechanic's shelves (work-mechanics.js layWork): each made thing a station takes, and each the card stores
  const taken = new Set(Object.keys(C.stations).flatMap(takes));
  const shelves = Object.keys(C.items).filter((i) => !isRaw(C, i) && (taken.has(i) || C.items[i].store !== Infinity));
  const users = (i) => Object.keys(C.stations).filter((sid) => C.stations[sid].takes[i]);
  const wanted = new Set(C.demand.orders.flatMap((o) => Object.keys(o.wants)));
  return { C, raws, prep, assembly, shelves, users, wanted };
}

export function layKitchen(card, { kitchen = 'split', origin = [0, 0, 0], cooks = 2, room = null, mirror = false, obstacles = false } = {}) {
  const T = KITCHENS[kitchen];
  if (!T) throw new Error(`kitchen: '${kitchen}' is one of ${KITCHEN_IDS.join(', ')}`);
  if (!(Number.isInteger(cooks) && cooks >= 1 && cooks <= 4)) throw new Error('kitchen: cooks is 1 to 4');
  const R = rolesOf(card), C = R.C, z = origin[2];
  const slots = (sid) => Array.from({ length: C.stations[sid].slots }, (_, k) => `${sid}#${k}`);
  // which zone each station stands in: split, prep west (0) and assembly east (1); one zone, all of it
  const zoneOfStation = (sid) => (T.zones === 1 ? 0 : R.prep.includes(sid) ? 0 : 1);
  // a crate on the side its users are (all of them on one side: that side; on both: the prep side, and said)
  const crateZone = (i) => { const zs = [...new Set(R.users(i).map(zoneOfStation))]; return zs.length === 1 ? zs[0] : 0; };
  // a made thing's maker and takers (the hand-in for an order's want), by zone: a thing made on one side and taken on
  // the other crosses on a pass
  const makers = (i) => [...new Set((C.producers[i] ?? []).map(zoneOfStation))];
  const takers = (i) => [...new Set([...R.users(i).map(zoneOfStation), ...(R.wanted.has(i) ? [T.zones === 1 ? 0 : 1] : [])])];
  const crosses = (i) => T.zones > 1 && makers(i).some((a) => takers(i).some((b) => b !== a));
  const passes = R.shelves.filter(crosses), inner = R.shelves.filter((i) => !crosses(i));
  // each zone's wall rows (north and south): its stations' slots, then the shelves made and taken on its side
  const rows = Array.from({ length: T.zones }, () => []);
  for (const sid of Object.keys(C.stations)) for (const s of slots(sid)) rows[zoneOfStation(sid)].push({ kind: 'station', sid, id: s });
  // (one floor's shelves stand on its island, not its walls)
  if (T.zones > 1) for (const i of inner) rows[makers(i)[0] ?? 0].push({ kind: 'shelf', item: i, id: `shelf:${i}` });
  // each zone's outer wall (west for zone 0, east for the last): its crates, and the hand-in on the last zone's
  const cols = Array.from({ length: T.zones }, () => []);
  for (const i of R.raws) cols[crateZone(i)].push({ kind: 'crate', item: i, id: `crate:${i}` });
  // THE SIZE: each zone wide enough for its rows (half north, half south, from its outer wall in), deep enough for its
  // column and, split, the passes down the middle
  const across = (n) => 1.6 + Math.max(1, Math.ceil(n / 2)) * PITCH;
  const islandLen = T.zones === 1 ? Math.max(1, R.shelves.length) * PITCH : 0;
  const zw0 = rows.map((r) => Math.max(4.5, across(r.length), T.zones === 1 ? islandLen + 4 : 0));
  const colLen = (k) => cols[k].length * 1.5 + (k === T.zones - 1 ? 2.4 : 0);
  const D = r3(Math.max(7, ...cols.map((_, k) => colLen(k) + 2.5), passes.length * 2 + 2.5, T.zones === 1 ? 9 : 0, room ?? 0));
  // (stretched to a room's side: the room the zones share out evenly)
  const W0 = zw0.reduce((t, w) => t + w, 0), more = room && room > W0 ? (room - W0) / zw0.length : 0, zw = zw0.map((w) => r3(w + more));
  const W = r3(zw.reduce((t, w) => t + w, 0));
  const x0 = r3(origin[0] - W / 2), y0 = r3(origin[1] - D / 2), x1 = r3(x0 + W), y1 = r3(y0 + D);
  // zone k spans [ax[k], ax[k + 1]]; split's counter stands on ax[1]
  const ax = [x0]; for (const w of zw) ax.push(r3(ax[ax.length - 1] + w));
  const zones = zw.map((_, k) => ({ id: T.zones === 1 ? 'floor' : ['prep', 'assembly'][k], rect: [ax[k], y0, ax[k + 1], y1] }));
  const P = (x, y) => [r3(x), r3(y), z];
  const at = { crates: {}, stations: {}, shelves: {}, serve: null }, zoneOf = {}, blocks = [];
  const box = (min, max, kind) => blocks.push({ min: min.map(r3), max: max.map(r3), kind });
  // the walls round the room (no door: the cooks start inside)
  box([x0 - WALL, y0 - WALL, z], [x1 + WALL, y0, z + HIGH], 'wall');
  box([x0 - WALL, y1, z], [x1 + WALL, y1 + WALL, z + HIGH], 'wall');
  box([x0 - WALL, y0, z], [x0, y1, z + HIGH], 'wall');
  box([x1, y0, z], [x1 + WALL, y1, z + HIGH], 'wall');
  const counter = (p, w, d, h, kind) => box([p[0] - w / 2, p[1] - d / 2, z], [p[0] + w / 2, p[1] + d / 2, z + h], kind);
  rows.forEach((row, k) => {
    // from the zone's outer side in: zone 0 from the west wall, a last zone of two from the east, alternating north and south
    const west = k === 0, startX = west ? ax[k] + 1.6 : ax[k + 1] - 1.6, dir = west ? 1 : -1;
    row.forEach((p, q) => {
      const north = q % 2 === 0, x = startX + dir * Math.floor(q / 2) * PITCH, y = north ? y1 - 0.5 : y0 + 0.5, pt = P(x, y);
      zoneOf[p.id] = k;
      if (p.kind === 'station') { (at.stations[p.sid] ??= []).push(pt); counter(pt, 1, 1, 0.9, 'station'); }
      else { at.shelves[p.item] = pt; counter(pt, PASS.w, PASS.w, PASS.h, 'shelf'); }
    });
  });
  cols.forEach((col, k) => {
    const west = k === 0, x = west ? ax[k] + 0.5 : ax[k + 1] - 0.5, last = k === T.zones - 1;
    // (the last zone's hand-in in the middle of its outer wall, its crates either side of it)
    const ys = col.map((_, q) => (last ? (q % 2 ? -1 : 1) * (1.9 + Math.floor(q / 2) * 1.5) : (q - (col.length - 1) / 2) * 1.5));
    col.forEach((p, q) => { const pt = P(x, origin[1] + ys[q]); at.crates[p.item] = pt; zoneOf[p.id] = k; counter(pt, 0.8, 0.8, 0.7, 'crate'); });
    if (last) { at.serve = P(ax[k + 1] - 0.5, origin[1]); zoneOf.serve = k; counter(at.serve, 0.8, 1.6, 1, 'serve'); }
  });
  // THE PASSES (split): the counter on the line between the zones, each pass a gap in it with a shelf under a hood
  if (T.zones === 2) {
    const cx = ax[1], ys = passes.map((_, q) => r3(origin[1] + (q - (passes.length - 1) / 2) * 2));
    passes.forEach((i, q) => { at.shelves[i] = P(cx, ys[q]); zoneOf[`shelf:${i}`] = 'pass'; });
    let from = y0;
    for (const y of [...ys, null]) {
      const to = y == null ? y1 : y - PASS.w / 2;
      if (to > from + 1e-9) box([cx - 0.3, from, z], [cx + 0.3, to, z + PASS.h], 'counter');
      if (y == null) break;
      box([cx - PASS.w / 2, y - PASS.w / 2, z], [cx + PASS.w / 2, y + PASS.w / 2, z + PASS.h], 'pass');
      from = y + PASS.w / 2;
    }
  } else {
    // THE ISLAND (one zone): the shelves down the middle, east to west
    R.shelves.forEach((i, q) => { const pt = P(origin[0] + (q - (R.shelves.length - 1) / 2) * PITCH, origin[1]); at.shelves[i] = pt; zoneOf[`shelf:${i}`] = 0; counter(pt, PASS.w, PASS.w, PASS.h, 'shelf'); });
  }
  // THE SEATS: split alternates the sides (1 and 3 prep, 2 and 4 assembly); one floor, round the island
  const seatZone = Array.from({ length: cooks }, (_, k) => (T.zones === 1 ? 0 : k % 2));
  const spawns = seatZone.map((zk, k) => {
    const r = zones[zk].rect, cx = (r[0] + r[2]) / 2;
    if (T.zones === 1) return P(origin[0] + [-1, 1, -1, 1][k] * Math.min(2.5, W / 4), origin[1] + [-1.6, -1.6, 1.6, 1.6][k]);
    return P(cx, origin[1] + (k < 2 ? -1 : 1) * 1.2);
  });
  // the one fixed overhead station: high over the room's middle, a little to the south, the whole room in frame
  const span = Math.max(W, D * 1.4);
  const frame = { at: P(origin[0], origin[1] - D * 0.45), focus: P(origin[0], origin[1]) };
  frame.at[2] = r3(z + span * 1.05);
  // OBSTACLES: a counter island standing in each side's floor, between its spawns, so no walk is straight across it
  if (obstacles) zones.forEach((zn) => { const cx = (zn.rect[0] + zn.rect[2]) / 2; counter(P(cx, origin[1]), 1.3, 0.7, 0.9, 'island'); });
  const out = { kitchen, card: C, at, heading: 0, zones, zoneOf, passes, blocks, spawns, seatZone, bounds: [x0, y0, x1, y1], frame, size: [W, D], ...(mirror ? { mirror: true } : {}), ...(obstacles ? { obstacles: true } : {}) };
  return mirror ? mirrored(out, origin[0]) : out;
}

/** The kitchen MIRRORED across its middle (west for east): its prep on the other side, its shelves' pads turned with it
 * (heading π: put from the east, taken from the west), so what crosses is still put from the side it is made on. */
function mirrored(K, ox) {
  const fx = (x) => r3(2 * ox - x), pt = (p) => [fx(p[0]), p[1], p[2]];
  const at = {
    crates: Object.fromEntries(Object.entries(K.at.crates).map(([i, p]) => [i, pt(p)])),
    stations: Object.fromEntries(Object.entries(K.at.stations).map(([sid, list]) => [sid, list.map(pt)])),
    shelves: Object.fromEntries(Object.entries(K.at.shelves).map(([i, p]) => [i, pt(p)])),
    serve: pt(K.at.serve),
  };
  const blocks = K.blocks.map((b) => ({ ...b, min: [fx(b.max[0]), b.min[1], b.min[2]], max: [fx(b.min[0]), b.max[1], b.max[2]] }));
  const zones = K.zones.map((zn) => ({ ...zn, rect: [fx(zn.rect[2]), zn.rect[1], fx(zn.rect[0]), zn.rect[3]] }));
  return { ...K, at, heading: Math.PI, blocks, zones, spawns: K.spawns.map(pt), bounds: [fx(K.bounds[2]), K.bounds[1], fx(K.bounds[0]), K.bounds[3]], frame: { at: pt(K.frame.at), focus: pt(K.frame.focus) } };
}

/** The work proof's cooks (work-proof.js `cooks`): seat k at its spawn, reaching what stands in its zone. */
export function cooksOf(K, n = K.spawns.length) {
  return Array.from({ length: n }, (_, k) => {
    const r = K.zones[K.seatZone[k % K.seatZone.length]].rect;
    return { spawn: K.spawns[k % K.spawns.length].slice(), reach: (p) => p[0] > r[0] && p[0] < r[2] && p[1] > r[1] && p[1] < r[3] };
  });
}

// THE FLOOR: the room on a grid, a cell blocked where a body cannot stand (a block taller than a step, grown by the body)
function floorOf(K, pad = BODY) {
  const [x0, y0, x1, y1] = K.bounds, nx = Math.ceil((x1 - x0) / STEP), ny = Math.ceil((y1 - y0) / STEP), z = K.frame.focus[2];
  const blocked = new Uint8Array(nx * ny), solid = K.blocks.filter((b) => b.max[2] - z > 0.45 && b.min[2] - z < 1.0);
  const cx = (i) => x0 + (i + 0.5) * STEP, cy = (j) => y0 + (j + 0.5) * STEP;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = cx(i), y = cy(j);
    if (x < x0 + pad || x > x1 - pad || y < y0 + pad || y > y1 - pad) { blocked[j * nx + i] = 1; continue; }
    for (const b of solid) if (x > b.min[0] - pad && x < b.max[0] + pad && y > b.min[1] - pad && y < b.max[1] + pad) { blocked[j * nx + i] = 1; break; }
  }
  const flood = (p) => {
    const seen = new Uint8Array(nx * ny), i0 = Math.floor((p[0] - x0) / STEP), j0 = Math.floor((p[1] - y0) / STEP), s = j0 * nx + i0;
    if (i0 < 0 || j0 < 0 || i0 >= nx || j0 >= ny || blocked[s]) return seen;
    const q = [s]; seen[s] = 1;
    while (q.length) {
      const c = q.pop(), i = c % nx, j = (c - i) / nx;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const k = b * nx + a;
        if (!blocked[k] && !seen[k]) { seen[k] = 1; q.push(k); }
      }
    }
    return seen;
  };
  const reaches = (seen, at, r) => {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (seen[j * nx + i] && Math.hypot(cx(i) - at[0], cy(j) - at[1]) <= r) return true;
    return false;
  };
  const meet = (a, b) => a.some((v, k) => v && b[k]);
  return { flood, reaches, meet };
}

/** The kitchen's laws, measured on its floor: advice, never a refusal. */
export function kitchenLaws(K, { jump = null } = {}) {
  const laws = [], F = floorOf(K), seen = K.spawns.map((s) => F.flood(s)), T = KITCHENS[K.kitchen], R = rolesOf(K.card);
  // (the pads either side of a shelf, as the mechanic lays them: work-mechanics.js shelfPads, heading 0)
  const c = Math.cos(K.heading ?? 0), pads = (p) => [[r3(p[0] - 0.65 * c), p[1], p[2]], [r3(p[0] + 0.65 * c), p[1], p[2]]];
  const zoneSeen = (zk) => { const ks = K.seatZone.map((z, k) => (z === zk ? k : -1)).filter((k) => k >= 0); return ks.length ? seen[ks[0]] : null; };
  // REACHABLE: every place from the floor of its zone (a pass: put from the side its thing is made on, taken from the other)
  const missed = [];
  const want = (name, zk, at, r) => { const s = zoneSeen(zk); if (s && !F.reaches(s, at, r)) missed.push(name); };
  for (const [sid, list] of Object.entries(K.at.stations)) list.forEach((p, k) => want(`${sid} ${k + 1}`, K.zoneOf[`${sid}#${k}`], p, REACH));
  for (const [i, p] of Object.entries(K.at.crates)) want(`the ${i} crate`, K.zoneOf[`crate:${i}`], p, REACH);
  want('the hand-in', K.zoneOf.serve, K.at.serve, REACH);
  for (const [i, p] of Object.entries(K.at.shelves)) {
    const zk = K.zoneOf[`shelf:${i}`], [put, take] = pads(p);
    if (zk === 'pass') { want(`the ${i} pass (put)`, 0, put, PAD); want(`the ${i} pass (take)`, 1, take, PAD); }
    else { want(`the ${i} shelf (put)`, zk, put, PAD); want(`the ${i} shelf (take)`, zk, take, PAD); }
  }
  const seated = [...new Set(K.seatZone)];
  laws.push({ law: 'reachable', holds: !missed.length, says: missed.length ? `out of reach of the cooks on its side: ${missed.join(', ')}` : `every place reached from its side${seated.length < K.zones.length ? ` (the ${K.zones.filter((_, k) => !seated.includes(k)).map((zn) => zn.id).join(', ')} side has no cook)` : ''}` });
  // SEALED (a kitchen that claims the handoff): no cook walks to another side; the passes are the only way across
  if (T.sealed) {
    const leak = seen.some((a, p) => seen.some((b, q) => K.seatZone[p] !== K.seatZone[q] && F.meet(a, b)));
    // (and over: a cook who jumps higher than the counter less a step climbs onto it and walks across)
    const low = Math.min(...K.blocks.filter((b) => b.kind === 'counter' || b.kind === 'pass').map((b) => b.max[2] - b.min[2]));
    const over = Number.isFinite(jump) && jump + STEP_UP >= low;
    laws.push({ law: 'sealed', holds: !leak && !over, says: leak ? 'a cook can walk round to the other side: the passes are not the only way across' : over ? `the cooks jump ${jump} m, onto the ${low} m counter and over it: a feel that jumps lower, or a taller counter` : 'the sides are sealed: what crosses, crosses on a pass' });
  }
  // HANDOFF: every order needs something carried across (its wants, and what they are made of, made on both sides)
  if (T.zones > 1) {
    const sideOf = (sid) => (R.prep.includes(sid) ? 0 : 1);
    const sides = (i, seenI = new Set()) => { if (seenI.has(i) || isRaw(R.C, i)) return new Set(); seenI.add(i); const out = new Set(); for (const sid of R.C.producers[i] ?? []) { out.add(sideOf(sid)); for (const j of Object.keys(R.C.stations[sid].takes)) for (const s of sides(j, seenI)) out.add(s); } return out; };
    const crossing = R.C.demand.orders.filter((o) => Object.keys(o.wants).some((i) => sides(i).has(0)));
    const all = crossing.length === R.C.demand.orders.length;
    laws.push({ law: 'handoff', holds: all, says: `${crossing.length} of ${R.C.demand.orders.length} orders cross the pass${all ? '' : `: ${R.C.demand.orders.filter((o) => !crossing.includes(o)).map((o) => o.name).join(', ')} never do`}` });
    // PASSES: every thing made on one side and wanted on the other has a pass (the mechanic's shelf for it)
    const lack = R.C.demand.orders.flatMap((o) => Object.keys(o.wants)).filter((i, k, a) => a.indexOf(i) === k && !isRaw(R.C, i) && sides(i).has(0) && !sides(i).has(1) && !K.passes.includes(i));
    const stocked = R.raws.filter((i) => new Set(R.users(i).map(sideOf)).size > 1);
    laws.push({ law: 'passes', holds: !lack.length && !stocked.length, says: lack.length ? `made on the prep side and wanted at the hand-in with no pass: ${lack.join(', ')} (give it a store on the card)` : stocked.length ? `wanted raw on both sides, crated on the prep side only: ${stocked.join(', ')}` : `${K.passes.length} passes carry everything that crosses (${K.passes.join(', ')})` });
  }
  // CLEARANCE: two cooks pass each other on the way from each spawn to its places (a 760 mm walkway)
  const Fw = floorOf(K, Math.max(BODY, WALKWAY)), wide = K.spawns.map((s) => Fw.flood(s));
  const tight = K.spawns.filter((_, k) => !Object.entries(K.at.stations).some(([sid, list]) => list.some((p, q) => K.zoneOf[`${sid}#${q}`] === K.seatZone[k] && Fw.reaches(wide[k], p, REACH))));
  laws.push({ law: 'clearance', holds: !tight.length, says: tight.length ? `${tight.length} cook${tight.length > 1 ? 's' : ''} cannot get to a station by a 760 mm walkway` : 'a 760 mm walkway from every cook to its stations' });
  // FRAME: the whole room on one fixed screen, nothing taller than the overhead camera sees past
  const [W, D] = K.size, tall = K.blocks.filter((b) => b.max[2] - K.frame.focus[2] > 2.5);
  const fits = Math.max(W, D) <= 24 && !tall.length;
  laws.push({ law: 'frame', holds: fits, says: fits ? `${W} × ${D} m, the whole room on one fixed screen` : Math.max(W, D) > 24 ? `${W} × ${D} m is too big for one fixed screen (24 m at most)` : 'something stands taller than the overhead camera sees past' });
  return laws;
}
