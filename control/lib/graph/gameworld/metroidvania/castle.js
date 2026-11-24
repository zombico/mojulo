/**
 * A CASTLE OF BOXES (docs/metroidvania-map.md "A castle of boxes"): several boxes (box.js, each a shape of its own:
 * shapes.js) set on one grid of screens and joined by CONNECTORS through their PORTS, laid as one map: the megaworld's
 * rings at the next scale, a level of several regions walked one into the next.
 *
 *   PORTS          where a box is entered and left, a door on its side: every box is entered by its gate (`in`, its left
 *                  side's bottom room); a box that passes through or joins is left by its `out`: a serpentine where its
 *                  top row runs to (its last room's far side), a hub at its top right (its upper right wing's far
 *                  corner); a spiral is a destination and is never left
 *   CONNECTORS     what joins one box's `out` to the next box's `in` across the night between them, a row each:
 *                    bridge      a span open to the night, `length` screens, its far end gated where it says (a power's
 *                                gate)
 *                    gatehouse   a gate-tower of two rooms: its hall a save room, then its gate on the way on (a boss
 *                                standing in it, `boss`, or a power's gate)
 *                  a box whose out room holds its core's boss is sealed by it: what passes through a box beats it
 *   THE CASTLE     its boxes in the order the walk takes them, each placed by its join: the next box's gate level with
 *                  the last's out, `length` screens on; the walk the boxes' walks one after another through their
 *                  connectors; the castle's core the last box's
 *
 *   castle: { premise?, theme?, powers, boxes: [{ id, ...a box's words (no powers, no theme) }], joins: [{ from, to, by,
 *             length?, gate?, boss?, place? }] }
 *
 *   CONNECTORS, CASTLE_LAWS, BOX_SHARE
 *   isCastle(v)            whether a map's words are a castle's (it has `boxes`)
 *   readCastle(v)          the words read, refused with teaching
 *   portsOf(L)             a laid box's ports: { in, out? } each { side, cell, room }
 *   layCastle(v)           → a laid map of the boxes' shape (box.js layBox's: rings, rooms, doors, walk, entry, …) on the
 *                          castle's grid, its `castle` the boxes placed ({ id, shape, rect, in, out }) and the joins
 *                          laid ({ id, from, to, by, ring, rooms, gate }), its boxes' own layouts in `castle.laid`
 *   castleLaws(C, { solved?, greybox? }) → [{ id, holds, says, rooms? }]: each box held to its own shape's laws
 *                          (`<box>:<law>`, BOX_SHARE), the castle to the laws a walk through all of it is held to
 *
 * Pure: a castle is laid from its words alone.
 */
import { layBox, readBox } from './box.js';
import { boxLaws, BACK } from './laws.js';
import { solveBox } from './solve.js';
import { greyboxOf } from './rooms.js';
import { GATES, GATE_IDS } from './gates.js';
import { BOX_THEMES } from './themes.js';

export const CONNECTORS = Object.freeze({
  bridge: Object.freeze({ read: 'a span open to the night between two boxes, its far end gated where it says', place: 'the bridge', length: Object.freeze([1, 4]), look: 'open', gates: 'a power\'s gate, or none' }),
  gatehouse: Object.freeze({ read: 'a gate-tower of two rooms: its hall a save room, then its gate on the way on', place: 'the gatehouse', length: Object.freeze([2, 2]), look: 'last', gates: 'a boss standing in it, or a power\'s gate' }),
});
export const CONNECTOR_IDS = Object.freeze(Object.keys(CONNECTORS));
/** the laws each box is held to on its own: its shape and its rhythm; a walk's laws are the castle's */
export const BOX_SHARE = Object.freeze(['entered-left', 'fills-the-box', 'shape', 'both-axes', 'gated-in', 'one-new-thing', 'saves', 'boss-at-core']);
/** the laws the castle is held to, walked whole */
export const CASTLE_LAWS = Object.freeze(['joined', 'roles', 'connectors', 'found-before', 'solvable', 'revisits', 'pockets', 'way-back', 'no-kick', 'sill-holds', 'saves']);
const CASTLE_KEYS = ['premise', 'theme', 'powers', 'boxes', 'joins'];
const JOIN_KEYS = ['from', 'to', 'by', 'length', 'gate', 'boss', 'place'];
const ID = /^[a-z][a-z0-9-]{0,23}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const word = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 80;
const fail = (m) => { throw new Error(`metroidvania: castle: ${m}`); };
const pct = (v) => `${Math.round(v * 100)}%`;

/** Whether a map's words are a castle's. */
export const isCastle = (v) => isObj(v) && v.boxes !== undefined;

/** A laid box's ports: its gate on its left, and where it is left, if it is. */
export function portsOf(L) {
  const [cols, rows] = L.box, at = (c) => L.rooms.find((r) => r.cells.some((q) => q[0] === c[0] && q[1] === c[1]));
  const ports = { in: { side: 'left', cell: [...L.entry.cell], room: L.entry.room } };
  if (L.shape === 'serpentine') {
    const cell = L.exit.cell;
    ports.out = { side: cell[0] === cols - 1 ? 'right' : 'left', cell: [...cell], room: L.exit.room };
  } else if (L.shape === 'hub') ports.out = { side: 'right', cell: [cols - 1, rows - 1], room: at([cols - 1, rows - 1]).id };
  return ports;
}

/** The castle's words read. */
export function readCastle(v) {
  if (!isObj(v)) fail('a castle is { premise?, theme?, powers, boxes: [{ id, …a box\'s words }], joins: [{ from, to, by }] }');
  for (const k of Object.keys(v)) if (!CASTLE_KEYS.includes(k)) fail(`${k} is not a castle's word (${CASTLE_KEYS.join(', ')}); a box's words go in its boxes`);
  if (v.premise !== undefined && !word(v.premise)) fail('premise is a sentence: what the castle is');
  if (v.theme !== undefined && !BOX_THEMES[v.theme]) fail(`theme is ${Object.keys(BOX_THEMES).join(' | ')}`);
  if (!isObj(v.powers)) fail('powers is { <id>: { opens, name } }: the castle\'s, found in its boxes');
  if (!(Array.isArray(v.boxes) && v.boxes.length >= 2)) fail('boxes is a list of two or more boxes, the first the one the castle is entered by');
  const ids = new Set(), found = new Map(), boxes = v.boxes.map((B, i) => {
    if (!isObj(B)) fail(`boxes[${i}] is { id, …a box's words }`);
    const { id, ...words } = B;
    if (!ID.test(id ?? '')) fail(`boxes[${i}].id is a short lower-case name`);
    if (ids.has(id)) fail(`boxes[${i}].id '${id}' is used twice`);
    ids.add(id);
    for (const k of ['powers', 'theme']) if (words[k] !== undefined) fail(`boxes[${i}].${k}: a castle's boxes share its ${k}; say it once on the castle`);
    let M;
    try { M = readBox({ ...words, powers: v.powers, ...(v.theme ? { theme: v.theme } : {}) }); } catch (e) { fail(`boxes[${i}] (${id}): ${e.message.replace(/^metroidvania:\s*/, '')}`); }
    for (const R of M.rings) if (R.finds) { if (found.has(R.finds)) fail(`${id}'s ${R.id} finds '${R.finds}', found in ${found.get(R.finds)} already: a power is found once in a castle`); found.set(R.finds, `${id}'s ${R.id}`); }
    return { id, words: { ...words, powers: v.powers, ...(v.theme ? { theme: v.theme } : {}) }, shape: M.shape };
  });
  if (!Array.isArray(v.joins) || v.joins.length !== boxes.length - 1) fail(`joins is a list of ${boxes.length - 1}: each box past the first joined from one before it, in the walk's order`);
  const placed = new Set([boxes[0].id]);
  const joins = v.joins.map((J, i) => {
    const at = `joins[${i}]`;
    if (!isObj(J)) fail(`${at} is { from, to, by, length?, gate?, boss?, place? }`);
    for (const k of Object.keys(J)) if (!JOIN_KEYS.includes(k)) fail(`${at}.${k} is not a join's word (${JOIN_KEYS.join(', ')})`);
    const C = CONNECTORS[J.by];
    if (!C) fail(`${at}.by is a connector: ${CONNECTOR_IDS.map((k) => `${k} (${CONNECTORS[k].read})`).join('; ')}`);
    if (!placed.has(J.from)) fail(`${at}.from '${J.from}' is a box joined before it (${[...placed].join(', ')})`);
    if (!ids.has(J.to) || placed.has(J.to)) fail(`${at}.to is a box not yet joined (${boxes.map((b) => b.id).filter((b) => !placed.has(b)).join(', ')})`);
    if (boxes.find((b) => b.id === J.to) !== boxes[i + 1]) fail(`${at}.to: the boxes are listed in the order the walk takes them; ${boxes[i + 1].id} is next`);
    placed.add(J.to);
    const length = J.length ?? C.length[0];
    if (!(Number.isInteger(length) && length >= C.length[0] && length <= C.length[1])) fail(`${at}.length: a ${J.by} is ${C.length[0] === C.length[1] ? C.length[0] : `${C.length[0]} to ${C.length[1]}`} screens`);
    if (J.gate !== undefined) {
      if (!GATES[J.gate] || J.gate === 'key' || (J.gate === 'boss' && J.by !== 'gatehouse')) fail(`${at}.gate is ${J.by === 'gatehouse' ? 'boss | ' : ''}${GATE_IDS.filter((g) => g !== 'key' && g !== 'boss').join(' | ')} (${C.gates})`);
      if (J.gate !== 'boss' && !Object.values(v.powers).some((p) => p.opens === J.gate)) fail(`${at}.gate '${J.gate}' is opened by no power`);
    }
    if ((J.gate === 'boss') !== (J.boss !== undefined)) fail(`${at}: a gatehouse's boss and its gate go together: gate: 'boss', boss: '<its name>'`);
    if (J.boss !== undefined && !word(J.boss)) fail(`${at}.boss is the boss's name`);
    if (J.place !== undefined && !word(J.place)) fail(`${at}.place is the place it is, a word`);
    return { id: `${J.by}-${i}`, from: J.from, to: J.to, by: J.by, length, ...(J.gate ? { gate: J.gate } : {}), ...(J.boss ? { boss: J.boss.trim() } : {}), place: (J.place ?? C.place).trim() };
  });
  return { ...(v.premise ? { premise: v.premise.trim() } : {}), ...(v.theme ? { theme: v.theme } : {}), powers: v.powers, boxes, joins };
}

const touches = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
const rectOf = (cells) => { const cs = cells.map((c) => c[0]), rs = cells.map((c) => c[1]), c = Math.min(...cs), r = Math.min(...rs); return [c, r, Math.max(...cs) - c + 1, Math.max(...rs) - r + 1]; };
const pieces = (n, most) => { const k = Math.ceil(n / most), base = Math.floor(n / k), extra = n % k; return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)); };

/** The castle laid: its boxes placed by their joins, their connectors between, one map. */
export function layCastle(v) {
  const C = readCastle(v), T = C.theme ? BOX_THEMES[C.theme] : null;
  const laid = new Map(C.boxes.map((b) => [b.id, layBox(b.words)])), at = new Map([[C.boxes[0].id, [0, 0]]]);
  const ports = new Map([...laid].map(([id, L]) => [id, portsOf(L)]));
  // PLACED: each next box's gate level with the last box's out, its connector's length on across the night
  for (const J of C.joins) {
    const out = ports.get(J.from).out, from = C.boxes.find((b) => b.id === J.from);
    if (!out) fail(`${J.id}: ${J.from} is a ${from.shape}, a destination: it is never left (a serpentine passes through, a hub joins)`);
    if (out.side !== 'right') fail(`${J.id}: ${J.from} is left on its ${out.side}, and the castle is walked rightward: a serpentine of an odd number of rows leaves on its right`);
    const [fc, fr] = at.get(J.from), inn = ports.get(J.to).in;
    at.set(J.to, [fc + out.cell[0] + 1 + J.length - inn.cell[0], fr + out.cell[1] - inn.cell[1]]);
  }
  // (the grid: from the lowest box's bottom to the highest's top)
  const lo = Math.min(...[...at.values()].map((p) => p[1]));
  for (const [id, p] of at) at.set(id, [p[0], p[1] - lo]);
  const cols = Math.max(...C.boxes.map((b) => at.get(b.id)[0] + laid.get(b.id).box[0])), rows = Math.max(...C.boxes.map((b) => at.get(b.id)[1] + laid.get(b.id).box[1]));
  const rooms = [], doors = [], walk = [], rings = [], boxes = [], joins = [];
  const lookIx = (L, ring, k) => (T ? (ring.look ?? T.looks.indexOf(lookOfIx(T, k, L.rings.length))) : undefined);
  const door = (a, b, kind, cells, extra = {}) => doors.push({ id: `d${doors.length}`, a, b, cells, axis: cells[0][1] === cells[1][1] ? 'h' : 'v', kind, ...extra });
  const last = C.boxes.at(-1).id;
  C.boxes.forEach((B, bi) => {
    const L = laid.get(B.id), [dc, dr] = at.get(B.id), off = rings.length, name = (id) => `${B.id}-${id}`, move = (c) => [c[0] + dc, c[1] + dr];
    // (its regions, its rooms and its doors, moved onto the castle's grid and named for their box)
    L.rings.forEach((R, k) => {
      const { core, legs, ...rest } = R;
      rings.push({ ...rest, i: off + k, id: name(R.id), box: B.id, rect: [R.rect[0] + dc, R.rect[1] + dc, R.rect[2] + dr, R.rect[3] + dr], ...(legs ? { legs } : {}), ...(core ? (B.id === last ? { core: true } : { boxCore: true }) : {}), ...(T ? { look: lookIx(L, R, k) } : {}) });
    });
    for (const r of L.rooms) rooms.push({ ...r, id: name(r.id), box: B.id, ring: r.ring + off, cells: r.cells.map(move), rect: [r.rect[0] + dc, r.rect[1] + dr, r.rect[2], r.rect[3]], pockets: r.pockets.map((p) => ({ ...p })) });
    for (const d of L.doors) door(name(d.a), name(d.b), d.kind, d.cells.map(move), Object.fromEntries(Object.entries(d).filter(([k]) => !['id', 'a', 'b', 'cells', 'axis', 'kind'].includes(k))));
    walk.push(...L.walk.map(name));
    const P = ports.get(B.id);
    boxes.push({ id: B.id, shape: L.shape, rect: [dc, dr, L.box[0], L.box[1]], in: { ...P.in, cell: move(P.in.cell), room: name(P.in.room) }, ...(P.out && C.joins.some((J) => J.from === B.id) ? { out: { ...P.out, cell: move(P.out.cell), room: name(P.out.room) } } : {}) });
    // THE CONNECTOR on from it, where one leaves it
    const J = C.joins.find((x) => x.from === B.id);
    if (!J) return;
    const out = boxes.at(-1).out, ring = { i: rings.length, id: J.id, place: J.place, connector: J.by, ...(T ? { look: CONNECTORS[J.by].look === 'open' ? T.looks.findIndex((x) => x.open) : T.looks.length - 1 } : {}) };
    const cells = Array.from({ length: J.length }, (_, k) => [out.cell[0] + 1 + k, out.cell[1]]);
    ring.rect = [cells[0][0], cells.at(-1)[0], out.cell[1], out.cell[1]];
    rings.push(ring);
    const mine = [], add = (cs, kind, role) => { const R = { id: `${J.id}-${mine.length}`, ring: ring.i, rect: rectOf(cs), kind, role, cells: cs, pockets: [], connector: J.by }; rooms.push(R); mine.push(R); walk.push(R.id); return R; };
    if (J.by === 'bridge') { let k = 0; for (const n of pieces(J.length, 3)) { add(cells.slice(k, k + n), 'corridor', 'bridge'); k += n; } }
    else { const hall = add([cells[0]], 'corridor', 'gatehouse'); hall.save = true; const gate = add([cells[1]], 'corridor', 'portcullis'); if (J.boss) gate.boss = J.boss; }
    for (let k = 1; k < mine.length; k++) door(mine[k - 1].id, mine[k].id, 'path', [mine[k - 1].cells.at(-1), mine[k].cells[0]]);
    // (its doors: from the box's out, sealed by the box's own boss where its out room holds it; on to the next box's gate)
    const outRoom = rooms.find((r) => r.id === out.room);
    door(out.room, mine[0].id, 'port', [out.cell, mine[0].cells[0]], outRoom.boss ? { gate: 'boss' } : {});
    const toAt = at.get(J.to), inn = ports.get(J.to).in;
    door(mine.at(-1).id, `${J.to}-${inn.room}`, 'port', [mine.at(-1).cells.at(-1), [inn.cell[0] + toAt[0], inn.cell[1] + toAt[1]]], J.gate ? { gate: J.gate } : {});
    joins.push({ id: J.id, from: J.from, to: J.to, by: J.by, ring: ring.i, rooms: mine.map((r) => r.id), ...(J.gate ? { gate: J.gate } : {}) });
  });
  rooms.forEach((r, k) => { r.i = k; r.walk = walk.indexOf(r.id); });
  for (const d of doors) if (!touches(...d.cells)) fail(`${d.a} and ${d.b} do not meet (a castle's door is between rooms side by side)`);
  const first = boxes[0], entry = { cell: [...first.in.cell], side: 'left', room: first.in.room };
  return {
    box: [cols, rows], shape: 'castle', ...(C.premise ? { premise: C.premise } : {}), ...(C.theme ? { theme: C.theme } : {}), powers: C.powers, entry,
    rings, rooms, doors, walk, cells: rooms.reduce((n, r) => n + r.cells.length, 0),
    castle: { boxes, joins, laid: Object.fromEntries(laid) },
  };
}
// (themes.js lookOf, by index: the castle names a ring's look by its place in the theme's looks)
function lookOfIx(T, ring, rings) {
  const L = T.looks, last = rings - 1;
  if (ring === 0) return L[0];
  if (ring === last) return L[L.length - 1];
  const mid = L.slice(1, -1);
  return mid.length ? mid[(ring - 1) % mid.length] : L[Math.min(ring, L.length - 1)];
}

/** The castle's laws: each box's own, then the castle walked whole. */
export function castleLaws(C, { solved, greybox } = {}) {
  const S = solved ?? solveBox(C), G = greybox ?? greyboxOf(C), out = [];
  const law = (id, holds, says, rooms) => out.push({ id, holds: !!holds, says, ...(rooms && rooms.length ? { rooms } : {}) });
  const room = new Map(C.rooms.map((r) => [r.id, r]));
  // each box on its own: its shape, its rhythm (what it is walked for is the castle's)
  for (const B of C.castle.boxes) for (const l of boxLaws(C.castle.laid[B.id])) if (BOX_SHARE.includes(l.id)) out.push({ ...l, id: `${B.id}:${l.id}`, ...(l.rooms ? { rooms: l.rooms.map((r) => `${B.id}-${r}`) } : {}) });
  // joined: every box on the walk's chain, its joins from an out to an in across the night, nothing laid over another
  const taken = new Map(), over = [];
  for (const r of C.rooms) for (const c of r.cells) { const k = c.join(','); if (taken.has(k)) over.push(`${taken.get(k)} and ${r.id}`); taken.set(k, r.id); }
  const bad = C.castle.joins.filter((J) => { const ds = C.doors.filter((d) => d.kind === 'port' && (J.rooms.includes(d.a) || J.rooms.includes(d.b))); return ds.length !== 2 || ds.some((d) => d.axis !== 'h'); }).map((J) => J.id);
  law('joined', !over.length && !bad.length, over.length ? `laid over each other: ${over.slice(0, 3).join('; ')}` : bad.length ? `${bad.join(', ')} not joined port to port` : `${C.castle.boxes.length} boxes joined by ${C.castle.joins.length} connectors, each from a box's out to the next box's gate`);
  // roles: a destination is never passed through, and is where the castle ends; what passes through or joins is left
  const wrong = C.castle.boxes.filter((B, k) => (B.shape === 'spiral' ? k !== C.castle.boxes.length - 1 : k !== C.castle.boxes.length - 1 && !B.out)).map((B) => B.id);
  const endsIn = C.castle.boxes.at(-1);
  law('roles', !wrong.length && C.rings.some((r) => r.core && r.box === endsIn.id), wrong.length ? `${wrong.join(', ')} used against ${wrong.length === 1 ? 'its' : 'their'} shape's role` : `${C.castle.boxes.map((B) => `${B.id} a ${B.shape}`).join(', ')}: the castle ends in ${endsIn.id}'s core`);
  // connectors: a bridge open to the night; a gatehouse a save room and a gate on the way on
  const off = C.castle.joins.filter((J) => {
    const rs = J.rooms.map((id) => room.get(id)), on = C.doors.find((d) => d.kind === 'port' && d.a === J.rooms.at(-1));
    return J.by === 'gatehouse' ? !(rs[0].save && (on.gate || rs.at(-1).boss)) : false;
  }).map((J) => J.id);
  law('connectors', !off.length, off.length ? `${off.join(', ')} short of what ${off.length === 1 ? 'its' : 'their'} row says` : C.castle.joins.map((J) => `${J.id} (${J.by}${J.gate ? `, ${J.gate}` : ''})`).join(', '));
  // the castle walked whole: the walk's laws (box laws over the whole map)
  const whole = boxLaws(C, { solved: S, greybox: G });
  for (const id of ['found-before', 'solvable', 'revisits', 'pockets', 'no-kick', 'sill-holds', 'saves']) out.push(whole.find((l) => l.id === id));
  // the way back: from the castle's core to its gate, everything held, a fraction of the way in
  const ratio = S.wayIn && S.wayBack !== null ? S.wayBack / S.wayIn : Infinity;
  law('way-back', ratio <= BACK, `the way back from the castle's core is ${S.wayBack ?? 'shut'} cells, the way in ${S.wayIn} (${Number.isFinite(ratio) ? pct(ratio) : 'none'}; at most ${pct(BACK)})`);
  // (in CASTLE_LAWS' order, each box's own first)
  const own = out.filter((l) => l.id.includes(':')), rest = CASTLE_LAWS.map((id) => out.find((l) => l.id === id));
  return [...own, ...rest];
}
