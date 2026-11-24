/**
 * THE SPIRALLING BOX (docs/metroidvania-map.md): a metroidvania's map as one BOX of screens, entered from the left, its
 * way spiralling inward ring by ring to a CORE. Written as words, read and refused with teaching, laid on a grid of
 * screen cells (a cell one screen, as a metroidvania's map squares are).
 *
 * The walk of a ring, turning `ccw` (the default): from its corner at the bottom left, along the floor, up the far
 * side, back along the top, down the near side, ending beside where it began; a gated STEP then into the ring inside it,
 * whose walk starts in its own bottom-left corner. `cw` climbs the near side first. The rings are the walled-core
 * dungeon's layers (wcd/wcd.js: deeper at every gated door, the core the deepest) and the megaworld's mandala
 * (megaworld.js) folded into one continuous map, so every ring lies against the one outside it: that is what a power
 * found inside spends, opening SHORTCUTS back out and POCKETS in rooms already walked.
 *
 *   metroidvania: { premise?, box: [cols, rows], turn?, theme?, powers, rings: [RING, …, CORE] }
 *     box       [cols, rows] in screens; each ring takes a cell off every side, so a ring needs three each way
 *     turn      'ccw' (along the floor first) | 'cw' (up the near side first)
 *     theme     what it is made of and how it is lit, ring by ring (themes.js: `castle`); unsaid, greybox
 *     powers    { <id>: { opens: <gate>, name? } }: what the box hands the hero, each opening one gate kind (gates.js)
 *     RING      { id, place, finds?, boss?, key?, inward, pockets? }   outermost first
 *       finds   a power's id: its boss's prize where it has one, else a relic room in its far top corner
 *       boss    the boss's name: it stands in the ring's last corner, its way on sealed until it falls
 *       key     true: a key in the ring's second corner, its lock on the top leg's middle door
 *       inward  the gate on the step into the next ring (gates.js; never a boss's: a boss seals its own room)
 *       pockets [{ gate, holds }]: an alcove in one of its corridors behind a gate, holding a prize (a power found
 *               later opens it: the box walked again)
 *     CORE      the last: { id, place, boss? }: what is left in the middle, its halls walked to the throne
 *
 *   readBox(v) → the words as read (each ring's rect in cells); throws, teaching
 *   layBox(v)  → {
 *     box, turn, premise?, entry: { cell, side },
 *     rings:  [{ i, id, place, rect: [c0, c1, r0, r1], core?, legs: [{ dir, axis, cells }] }],
 *     rooms:  [{ id, ring, i, rect: [c, r, w, h], kind, role, walk, save?, boss?, finds?, key?, lock?, pockets }]
 *             kind turn | corridor | shaft | hall; role gate | turn | relic | boss | corridor | shaft | antechamber | throne
 *     doors:  [{ id, a, b, cells: [[c, r], [c, r]], axis: 'h' | 'v', kind, gate?, oneWay? }]
 *             kind path (the walk), step (into the ring inside), loop (the ring's last room back to its gate: a drop),
 *             shortcut (a ring's floor dropped out to the ring outside, its top climbed out to it), entry
 *     walk:   the room ids in the order the spiral walks them; cells: how many cells the rooms take, of cols × rows
 *   }
 *   CELL_RUN, CELL_SHAFT, TURNS
 *
 * Pure, no dice: the box is laid from its words alone.
 */
import { GATES, GATE_IDS } from './gates.js';
import { BOX_THEMES, BOX_THEME_IDS } from './themes.js';

export const TURNS = Object.freeze({ ccw: 'along the floor first, up the far side, back along the top, down the near side', cw: 'up the near side first, along the top, down the far side, back along the floor' });
/** the most cells a corridor runs, and a shaft climbs, before it is two rooms */
export const CELL_RUN = 3;
export const CELL_SHAFT = 3;
/** a core's halls: as wide as a corridor, the core's height */
const HALL = 3;

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const word = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 80;
const fail = (m) => { throw new Error(`metroidvania: ${m}`); };
const BOX_KEYS = ['premise', 'box', 'turn', 'theme', 'powers', 'rings'];
const RING_KEYS = ['id', 'place', 'finds', 'boss', 'key', 'inward', 'pockets'];
const CORE_KEYS = ['id', 'place', 'boss'];

/** The words as read: throws, teaching, on any it does not know. */
export function readBox(v) {
  if (!isObj(v)) fail('the map is { box: [cols, rows], powers, rings: [ … ] }: one box of screens, its rings spiralling in');
  for (const k of Object.keys(v)) if (!BOX_KEYS.includes(k)) fail(`${k} is not the map's word (${BOX_KEYS.join(', ')})`);
  const out = {};
  if (v.premise !== undefined) { if (!(typeof v.premise === 'string' && v.premise.trim() && v.premise.length <= 240)) fail('premise is one sentence: who storms this place, and toward what'); out.premise = v.premise.trim(); }
  if (!(Array.isArray(v.box) && v.box.length === 2 && v.box.every((n) => Number.isInteger(n) && n >= 3))) fail('box is [cols, rows] in screens, each a whole number, three or more (a ring needs a middle)');
  const [cols, rows] = v.box;
  out.box = [cols, rows];
  if (v.theme !== undefined) { if (!BOX_THEMES[v.theme]) fail(`theme is ${BOX_THEME_IDS.join(' | ')} (what the box is made of and how it is lit: themes.js)`); out.theme = v.theme; }
  out.turn = v.turn ?? 'ccw';
  if (!TURNS[out.turn]) fail(`turn is ${Object.entries(TURNS).map(([k, s]) => `${k} (${s})`).join('; ')}`);
  // the powers: each opens one gate kind that a power opens
  const powers = v.powers ?? {};
  if (!isObj(powers)) fail('powers is { <id>: { opens, name? } }: what the box hands the hero');
  out.powers = {};
  for (const [id, p] of Object.entries(powers)) {
    if (!ID.test(id)) fail(`powers.${id}: a power's id is a short lower-case name`);
    if (!isObj(p)) fail(`powers.${id} is { opens, name? }`);
    for (const k of Object.keys(p)) if (!['opens', 'name'].includes(k)) fail(`powers.${id}.${k} is not a power's word (opens, name)`);
    if (!(GATES[p.opens] && GATES[p.opens].by === 'power')) fail(`powers.${id}.opens is the gate it opens: ${GATE_IDS.filter((g) => GATES[g].by === 'power').join(' | ')}`);
    out.powers[id] = { opens: p.opens, ...(p.name !== undefined ? { name: word(p.name) ? p.name.trim() : fail(`powers.${id}.name is words`) } : {}) };
  }
  const opened = new Set(Object.values(out.powers).map((p) => p.opens));
  // the rings: as many as the box has depth for, the last the core
  if (!(Array.isArray(v.rings) && v.rings.length >= 2)) fail('rings is a list, outermost first, the last the core: at least a ring and its core');
  const K = v.rings.length - 1;
  if (cols - 2 * (K - 1) < 3 || rows - 2 * (K - 1) < 3) fail(`rings: a ${cols} × ${rows} box holds ${Math.max(0, Math.min(Math.floor((cols - 3) / 2), Math.floor((rows - 3) / 2)) + 1)} rings round a core, not ${K} (each takes a cell off every side and needs three each way)`);
  const ids = new Set(), found = new Map();
  out.rings = v.rings.map((R, i) => {
    const at = `rings[${i}]`, core = i === K;
    if (!isObj(R)) fail(`${at} is { id, place, … }`);
    for (const k of Object.keys(R)) if (!(core ? CORE_KEYS : RING_KEYS).includes(k)) fail(`${at}.${k} is not ${core ? 'the core\'s' : 'a ring\'s'} word (${(core ? CORE_KEYS : RING_KEYS).join(', ')})${core && RING_KEYS.includes(k) ? ': the core is walked to its throne, never out of' : ''}`);
    if (!ID.test(R.id ?? '')) fail(`${at}.id is a short lower-case name`);
    if (ids.has(R.id)) fail(`${at}.id '${R.id}' is used twice`);
    ids.add(R.id);
    if (!word(R.place)) fail(`${at}.place is the place it is, a word (the outer wall, the great halls)`);
    const r = { i, id: R.id, place: R.place.trim(), rect: [i, cols - 1 - i, i, rows - 1 - i], ...(core ? { core: true } : {}) };
    if (R.boss !== undefined) { if (!word(R.boss)) fail(`${at}.boss is the boss's name`); r.boss = R.boss.trim(); }
    if (core) return r;
    if (R.finds !== undefined) {
      if (!out.powers[R.finds]) fail(`${at}.finds is a power's id (${Object.keys(out.powers).join(', ') || 'none: say them in powers'})`);
      if (found.has(R.finds)) fail(`${at}.finds: '${R.finds}' is found in ${found.get(R.finds)} already`);
      found.set(R.finds, R.id);
      r.finds = R.finds;
    }
    if (R.key !== undefined) { if (R.key !== true) fail(`${at}.key is true: a key in the ring, its lock on its top leg`); r.key = true; }
    if (!(GATES[R.inward] && R.inward !== 'boss')) fail(`${at}.inward is the gate on the step into the ring inside: ${GATE_IDS.filter((g) => g !== 'boss').join(' | ')} (a boss seals its own room)`);
    if (GATES[R.inward].by === 'power' && !opened.has(R.inward)) fail(`${at}.inward '${R.inward}' is opened by no power (say one in powers)`);
    if (R.inward === 'key' && !r.key) fail(`${at}.inward is a key's: say key: true, so the ring holds one`);
    r.inward = R.inward;
    if (R.pockets !== undefined) {
      if (!Array.isArray(R.pockets)) fail(`${at}.pockets is [{ gate, holds }]`);
      r.pockets = R.pockets.map((p, k) => {
        if (!isObj(p) || Object.keys(p).some((x) => !['gate', 'holds'].includes(x))) fail(`${at}.pockets[${k}] is { gate, holds }`);
        if (!(GATES[p.gate] && GATES[p.gate].by === 'power' && opened.has(p.gate))) fail(`${at}.pockets[${k}].gate is a gate a power opens (${[...opened].join(' | ') || 'none said'})`);
        if (!word(p.holds)) fail(`${at}.pockets[${k}].holds is the prize, a word (a heart, a relic)`);
        return { gate: p.gate, holds: p.holds.trim() };
      });
    }
    return r;
  });
  return out;
}

/** a ring's legs, in its walk: [{ dir, axis, cells }] — the corners their own legs of one cell */
function legsOf([c0, c1, r0, r1], turn) {
  const span = (a, b) => { const o = []; for (let k = a; a <= b ? k <= b : k >= b; k += a <= b ? 1 : -1) o.push(k); return o; };
  const H = (r, a, b, dir) => ({ dir, axis: 'h', cells: span(a, b).map((c) => [c, r]) });
  const V = (c, a, b, dir) => ({ dir, axis: 'v', cells: span(a, b).map((r) => [c, r]) });
  const corner = (c, r) => ({ dir: 'corner', axis: null, cells: [[c, r]] });
  if (turn === 'ccw') return [corner(c0, r0), H(r0, c0 + 1, c1 - 1, 'right'), corner(c1, r0), V(c1, r0 + 1, r1 - 1, 'up'), corner(c1, r1), H(r1, c1 - 1, c0 + 1, 'left'), corner(c0, r1), V(c0, r1 - 1, r0 + 1, 'down')];
  return [corner(c0, r0), V(c0, r0 + 1, r1 - 1, 'up'), corner(c0, r1), H(r1, c0 + 1, c1 - 1, 'right'), corner(c1, r1), V(c1, r1 - 1, r0 + 1, 'down'), corner(c1, r0), H(r0, c1 - 1, c0 + 1, 'left')];
}
/** a run of n cells cut into pieces of at most `most`, as even as they come, the longer first */
function pieces(n, most) {
  const k = Math.ceil(n / most), base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}
const rectOf = (cells) => {
  const cs = cells.map((c) => c[0]), rs = cells.map((c) => c[1]);
  const c = Math.min(...cs), r = Math.min(...rs);
  return [c, r, Math.max(...cs) - c + 1, Math.max(...rs) - r + 1];
};
const touches = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

/** The box laid: rings, rooms, doors and the walk. */
export function layBox(v) {
  const M = readBox(v), [cols, rows] = M.box, K = M.rings.length - 1;
  const rooms = [], doors = [], walk = [], rings = [];
  const door = (a, b, kind, extra = {}) => {
    const A = rooms.find((r) => r.id === a), B = rooms.find((r) => r.id === b);
    // (where the walk crosses: the pair given where its cells touch, else one with A's last cell, else B's first, else
    // the lowest: a door on the floor)
    const all = []; for (const x of A.cells) for (const y of B.cells) if (touches(x, y)) all.push([x, y]);
    const same = (p, q) => p[0] === q[0] && p[1] === q[1];
    const pair = (extra.cells && touches(...extra.cells) ? extra.cells : null) ?? all.find((p) => same(p[0], A.cells.at(-1))) ?? all.find((p) => same(p[1], B.cells[0])) ?? all.sort((p, q) => Math.min(p[0][1], p[1][1]) - Math.min(q[0][1], q[1][1]))[0];
    if (!pair) throw new Error(`metroidvania: no wall between ${a} and ${b} (a door joins rooms side by side)`);
    const { cells: _c, ...rest } = extra;
    doors.push({ id: `d${doors.length}`, a, b, cells: pair, axis: pair[0][1] === pair[1][1] ? 'h' : 'v', kind, ...rest });
  };
  const room = (ring, cells, kind, role) => {
    const R = { id: `${M.rings[ring].id}-${rooms.filter((x) => x.ring === ring).length}`, ring, i: rooms.length, rect: rectOf(cells), kind, role, walk: walk.length, cells, pockets: [] };
    rooms.push(R); walk.push(R.id);
    return R;
  };

  for (let k = 0; k <= K; k++) {
    const R = M.rings[k], ring = { i: k, id: R.id, place: R.place, rect: R.rect, ...(R.core ? { core: true } : {}) };
    rings.push(ring);
    const [c0, c1, r0, r1] = R.rect, first = rooms.length;
    if (R.core) {
      // THE CORE: what is left in the middle, cut into halls the core's height, walked toward the far side to the throne
      const w = c1 - c0 + 1, cut = pieces(w, HALL);
      let c = c0;
      cut.forEach((n, j) => {
        const cells = []; for (let x = c; x < c + n; x++) for (let y = r0; y <= r1; y++) cells.push([x, y]);
        const last = j === cut.length - 1;
        room(k, cells, 'hall', last ? 'throne' : 'antechamber');
        c += n;
      });
      if (R.boss) rooms.at(-1).boss = R.boss;
    } else {
      // A RING: its legs in its walk, each corner a room (a turn), each leg cut into corridors or shafts
      ring.legs = legsOf(R.rect, M.turn);
      let corner = 0;
      for (const L of ring.legs) {
        if (L.dir === 'corner') { room(k, L.cells, 'turn', corner === 0 ? 'gate' : 'turn'); corner++; continue; }
        let at = 0;
        for (const n of pieces(L.cells.length, L.axis === 'h' ? CELL_RUN : CELL_SHAFT)) { room(k, L.cells.slice(at, at + n), L.axis === 'h' ? 'corridor' : 'shaft', L.axis === 'h' ? 'corridor' : 'shaft'); at += n; }
      }
      const mine = rooms.slice(first), corners = mine.filter((x) => x.kind === 'turn');
      // the gate corner and the far top corner are save rooms
      corners[0].save = true; corners[2].save = true;
      // a boss stands in the ring's last corner, its prize the ring's power; else the power in the far top corner, a relic room
      if (R.boss) { corners[3].role = 'boss'; corners[3].boss = R.boss; if (R.finds) corners[3].finds = R.finds; }
      else if (R.finds) { corners[2].role = 'relic'; corners[2].finds = R.finds; }
      if (R.key) corners[1].key = true;
      // pockets: in the ring's corridors, spread along them
      const corridors = mine.filter((x) => x.kind === 'corridor');
      (R.pockets ?? []).forEach((p, j) => { const at = corridors[Math.floor(((j + 0.5) * corridors.length) / R.pockets.length)]; at.pockets.push({ ...p }); });
    }
    // the walk's doors inside the ring, one between each room and the next
    const mine = rooms.slice(first);
    for (let j = 1; j < mine.length; j++) {
      const a = mine[j - 1], b = mine[j], gate = a.boss ? 'boss' : undefined;
      // (the walk crosses where the last cell of one meets the first of the next)
      // (a core's halls meet at their floor: the hall's last column and the next's first, on the core's bottom row)
      const cells = R.core ? [[a.rect[0] + a.rect[2] - 1, r0], [b.rect[0], r0]] : [a.cells.at(-1), b.cells[0]];
      door(a.id, b.id, 'path', { cells, ...(gate ? { gate } : {}) });
    }
    if (R.core) continue;
    // a key's lock: on the top leg, at its middle door (the key in the second corner, walked past first)
    if (R.key) {
      const top = mine.filter((x) => x.cells.every((c) => c[1] === r1));
      const pd = doors.filter((d) => top.some((t) => t.id === d.a) && top.some((t) => t.id === d.b));
      const mid = pd[Math.floor((pd.length - 1) / 2)] ?? doors.find((d) => d.b === top.find((t) => t.kind === 'corridor')?.id);
      if (mid) { mid.gate = 'key'; mine.find((x) => x.id === mid.b).lock = true; }
    }
    // the LOOP: the ring's last room back to its gate, a drop (one-way), so the gate corner is a step away
    const last = mine.at(-1), gateRoom = mine[0];
    if (touches(last.cells.at(-1), gateRoom.cells[0])) {
      const pair = [last.cells.at(-1), gateRoom.cells[0]], down = pair[0][1] > pair[1][1];
      door(last.id, gateRoom.id, 'loop', { cells: pair, ...(down ? { oneWay: true } : {}) });
    }
  }
  // the STEPS: each ring's last room into the next ring's first, through its inward gate
  for (let k = 0; k < K; k++) {
    const a = rooms.filter((x) => x.ring === k).at(-1), b = rooms.find((x) => x.ring === k + 1);
    door(a.id, b.id, 'step', { gate: M.rings[k].inward });
  }
  // the SHORTCUTS: each ring past the first, out to the ring outside it — its floor's middle corridor dropped through
  // (one-way, out), its top's middle corridor climbed through, gated by what the ring finds (opened from inside)
  for (let k = 1; k < K; k++) {
    const R = M.rings[k], [, , r0, r1] = R.rect, mine = rooms.filter((x) => x.ring === k), outer = rooms.filter((x) => x.ring === k - 1);
    const midOf = (row) => { const cs = mine.filter((x) => x.kind === 'corridor' && x.cells.every((c) => c[1] === row)); return cs[Math.floor((cs.length - 1) / 2)]; };
    const through = (from, dr) => {
      if (!from) return null;
      const cell = from.cells[Math.floor((from.cells.length - 1) / 2)], to = outer.find((x) => x.cells.some((c) => c[0] === cell[0] && c[1] === cell[1] + dr));
      return to ? { from, to, pair: [cell, [cell[0], cell[1] + dr]] } : null;
    };
    const fl = through(midOf(r0), -1);
    if (fl) door(fl.from.id, fl.to.id, 'shortcut', { cells: fl.pair, oneWay: true });
    const tp = through(midOf(r1), +1);
    const opener = R.finds ? M.powers[R.finds].opens : M.rings[k].inward;
    if (tp) door(tp.from.id, tp.to.id, 'shortcut', { cells: tp.pair, gate: opener });
  }
  // the ENTRY: the first room's near wall, on the box's left side
  const entry = { cell: [0, 0], side: 'left', room: rooms[0].id };
  const used = new Set(rooms.flatMap((x) => x.cells.map((c) => c.join(','))));
  return {
    box: M.box, turn: M.turn, ...(M.premise ? { premise: M.premise } : {}), ...(M.theme ? { theme: M.theme } : {}), powers: M.powers, entry,
    rings, rooms: rooms.map(({ cells, ...r }) => ({ ...r, cells })), doors, walk, cells: used.size,
  };
}
